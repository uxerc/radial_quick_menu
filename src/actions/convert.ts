import { PDFDocument, StandardFonts } from 'pdf-lib';
import { basename, dirname, splitExt, withExt } from '../fs/paths';
import type { ActionResult } from '../wheel/types';
import { fail, ok } from './deps';
import type { ActionDeps } from './deps';

export type Format = 'png' | 'jpg' | 'webp' | 'pdf' | 'txt';
type Kind = 'image' | 'pdf' | 'text' | 'other';

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif', 'ico']);
const TEXT_EXT = new Set(['txt', 'md', 'csv', 'json', 'log', 'xml', 'html', 'htm', 'yaml', 'yml', 'ini', 'url']);
const MIME: Record<Exclude<Format, 'pdf' | 'txt'>, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

export function kindOf(name: string): Kind {
  const ext = splitExt(name).ext.toLowerCase();
  if (IMAGE_EXT.has(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (TEXT_EXT.has(ext)) return 'text';
  return 'other';
}

export async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function canvasBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`Browser cannot encode ${mime}`))), mime, quality),
  );
}

/** JPG has no alpha, so transparent areas become white instead of black. */
export async function encodeImage(source: CanvasImageSource & { width: number; height: number }, format: 'png' | 'jpg' | 'webp', quality = 0.92): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const g = canvas.getContext('2d')!;
  if (format === 'jpg') {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, canvas.width, canvas.height);
  }
  g.drawImage(source, 0, 0);
  return canvasBlob(canvas, MIME[format], quality);
}

function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

async function pdfjs() {
  // Legacy build: the modern one relies on very new JS built-ins (Map.getOrInsertComputed).
  const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!lib.GlobalWorkerOptions.workerPort) {
    const { default: code } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw');
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    lib.GlobalWorkerOptions.workerPort = new Worker(url, { type: 'module' });
  }
  return lib;
}

async function pdfToImages(file: File, format: 'png' | 'jpg' | 'webp'): Promise<Blob[]> {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: Blob[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
    pages.push(await encodeImage(canvas, format));
  }
  return pages;
}

async function pdfToText(file: File): Promise<string> {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : '')).join(''));
  }
  return pages.join('\n\n');
}

async function imageToPdf(file: File): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const img = await loadImage(file);
  const png = await (await encodeImage(img, 'png')).arrayBuffer();
  const embedded = await pdf.embedPng(png);
  pdf.addPage([embedded.width, embedded.height]).drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  return pdfBlob(await pdf.save());
}

/** Helvetica only covers WinAnsi; anything else is replaced rather than failing the whole file. */
async function textToPdf(text: string): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const size = 11;
  const margin = 50;
  const [width, height] = [595, 842];
  const maxWidth = width - margin * 2;
  const safe = (s: string) => [...s].map((ch) => { try { font.encodeText(ch); return ch; } catch { return '?'; } }).join('');

  const lines: string[] = [];
  for (const paragraph of safe(text.replace(/\t/g, '    ')).split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }

  const perPage = Math.floor((height - margin * 2) / (size * 1.4));
  for (let i = 0; i < Math.max(lines.length, 1); i += perPage) {
    const page = pdf.addPage([width, height]);
    lines.slice(i, i + perPage).forEach((line, j) =>
      page.drawText(line, { x: margin, y: height - margin - (j + 1) * size * 1.4, size, font }),
    );
  }
  return pdfBlob(await pdf.save());
}

async function convertOne(file: File, format: Format): Promise<Array<{ name: string; data: Blob | string }>> {
  const kind = kindOf(file.name);
  const sameFormat = splitExt(file.name).ext.toLowerCase().replace('jpeg', 'jpg') === format;
  if (sameFormat) throw new Error(`already ${format.toUpperCase()}`);

  if (format === 'pdf') {
    if (kind === 'image') return [{ name: withExt(file.name, 'pdf'), data: await imageToPdf(file) }];
    if (kind === 'text') return [{ name: withExt(file.name, 'pdf'), data: await textToPdf(await file.text()) }];
  } else if (format === 'txt') {
    if (kind === 'pdf') {
      const text = await pdfToText(file);
      if (text.trim() === '') throw new Error('no text layer (scanned PDF needs OCR, which only the native build has)');
      return [{ name: withExt(file.name, 'txt'), data: text }];
    }
    if (kind === 'text') return [{ name: withExt(file.name, 'txt'), data: await file.text() }];
    if (kind === 'image') throw new Error('image to text needs OCR, which only the native build has');
  } else {
    if (kind === 'image') return [{ name: withExt(file.name, format), data: await encodeImage(await loadImage(file), format) }];
    if (kind === 'pdf') {
      const pages = await pdfToImages(file, format);
      const { stem } = splitExt(file.name);
      return pages.map((data, i) => ({ name: pages.length === 1 ? `${stem}.${format}` : `${stem} p${i + 1}.${format}`, data }));
    }
  }
  throw new Error(`can't convert ${kind} files to ${format.toUpperCase()}`);
}

/** Writes beside the original and never overwrites it. */
export async function convert(deps: ActionDeps, format: Format): Promise<ActionResult> {
  const created: string[] = [];
  const errors: string[] = [];
  for (const path of deps.explorer.selection) {
    try {
      const file = await deps.workspace.read(path);
      for (const out of await convertOne(file, format)) {
        const written = await deps.workspace.write(dirname(path), out.name, out.data);
        deps.recent.add(written);
        created.push(written);
      }
    } catch (error) {
      errors.push(`${basename(path)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (created.length > 0) await deps.explorer.navigate(deps.explorer.currentFolder, created);
  const summary = created.length > 0 ? `Created ${created.map(basename).join(', ')}` : '';
  if (errors.length === 0) return ok(summary);
  return created.length > 0 ? ok(`${summary}. Skipped ${errors.join('; ')}`) : fail(errors.join('; '));
}
