import { basename, safeFileName } from '../fs/paths';
import { withTimeout } from '../platform/clipboard';
import type { ActionResult, ClipItem } from '../wheel/types';
import { toast } from '../ui/toast';
import { NO_FOLDER, fail, ok, timestamp } from './deps';
import type { ActionDeps } from './deps';

const URL_PATTERN = /^https?:\/\/\S+$/;
const PASTE_WAIT_MS = 15000;

type Mode = 'default' | 'plain' | 'link' | 'png' | 'file';

interface ClipContent {
  text: string | null;
  image: Blob | null;
  html: string | null;
}

async function readClipboardApi(): Promise<ClipContent> {
  const items = await navigator.clipboard.read();
  const content: ClipContent = { text: null, image: null, html: null };
  for (const item of items) {
    const imageType = item.types.find((t) => t.startsWith('image/'));
    if (imageType && !content.image) content.image = await item.getType(imageType);
    if (item.types.includes('text/plain') && content.text === null) content.text = await (await item.getType('text/plain')).text();
    if (item.types.includes('text/html') && content.html === null) content.html = await (await item.getType('text/html')).text();
  }
  return content;
}

async function clipboardPermission(): Promise<PermissionState | 'unknown'> {
  try {
    return (await navigator.permissions.query({ name: 'clipboard-read' as PermissionName })).state;
  } catch {
    return 'unknown';
  }
}

function insertText(element: HTMLTextAreaElement, text: string): void {
  element.focus();
  element.setRangeText(text, element.selectionStart, element.selectionEnd, 'end');
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function urlShortcut(url: string): string {
  return `[InternetShortcut]\r\nURL=${url.trim()}\r\n`;
}

async function writeToFolder(deps: ActionDeps, name: string, data: Blob | string): Promise<ActionResult> {
  if (!deps.workspace.isOpen) return NO_FOLDER;
  const path = await deps.workspace.write(deps.explorer.currentFolder, name, data);
  deps.recent.add(path);
  await deps.explorer.navigate(deps.explorer.currentFolder, [path]);
  return ok(`Created ${basename(path)}`);
}

async function pasteContent(deps: ActionDeps, content: ClipContent, mode: Mode): Promise<ActionResult> {
  const target = deps.target();
  const text = content.text ?? '';
  const isUrl = URL_PATTERN.test(text.trim());

  if (target.kind === 'text') {
    if (mode === 'png' || mode === 'file') return fail('Paste as PNG/File needs a folder: open the wheel over the file list');
    if (mode === 'link') {
      if (!isUrl) return fail('Clipboard is not a link');
      insertText(target.element, `[${text.trim()}](${text.trim()})`);
      return ok('Pasted as link');
    }
    if (!text) return fail(content.image ? 'Clipboard holds an image; open the wheel over the file list to paste it as a file' : 'Clipboard has no text');
    insertText(target.element, text);
    return ok(`Pasted ${text.length} characters`);
  }

  const stamp = timestamp();
  if (mode === 'png' || (mode !== 'plain' && mode !== 'link' && content.image)) {
    if (!content.image) return fail('Clipboard holds no image');
    return writeToFolder(deps, `Pasted image ${stamp}.png`, content.image);
  }
  if (mode === 'link' || (mode === 'default' && isUrl)) {
    if (!isUrl) return fail('Clipboard is not a link');
    return writeToFolder(deps, `${safeFileName(text.replace(/^https?:\/\//, ''), 'link')}.url`, urlShortcut(text));
  }
  if (mode === 'file' && content.html) return writeToFolder(deps, `Pasted ${stamp}.html`, content.html);
  if (!text) return fail('Clipboard is empty');
  return writeToFolder(deps, `${safeFileName(text.split('\n')[0], 'Snippet')} ${stamp}.txt`, text);
}

/**
 * Pages opened from disk (file://) never get clipboard-read permission and a pending prompt
 * never settles, but a real Ctrl+V always delivers the clipboard. So unless access is already
 * granted, take whichever comes first: the permission prompt being allowed, or a Ctrl+V.
 */
async function readClipboard(): Promise<ClipContent | null> {
  if ((await clipboardPermission()) === 'granted') {
    const content = await withTimeout(readClipboardApi()).catch(() => null);
    if (content) return content;
  }
  toast('Press Ctrl+V to paste (or allow clipboard access if Chrome asks).');
  return new Promise((resolve) => {
    let settled = false;
    const finish = (content: ClipContent | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      document.removeEventListener('paste', onPaste, true);
      resolve(content);
    };
    const timer = setTimeout(() => finish(null), PASTE_WAIT_MS);
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const data = e.clipboardData;
      const image = [...(data?.files ?? [])].find((f) => f.type.startsWith('image/')) ?? null;
      finish({ text: data?.getData('text/plain') || null, image, html: data?.getData('text/html') || null });
    };
    document.addEventListener('paste', onPaste, true);
    readClipboardApi().then(finish, () => undefined);
  });
}

export async function pasteAction(deps: ActionDeps, mode: Mode): Promise<ActionResult> {
  const content = await readClipboard();
  if (!content) return fail('No Ctrl+V within 15 seconds, paste cancelled');
  return pasteContent(deps, content, mode);
}

/** Pasting a history item also makes it the current clipboard, like Win+V. */
export async function pasteItem(deps: ActionDeps, item: ClipItem): Promise<ActionResult> {
  if (item.kind === 'file') {
    if (deps.target().kind === 'text') return fail('Files paste into a folder: open the wheel over the file list');
    if (!deps.workspace.isOpen) return NO_FOLDER;
    const file = await deps.workspace.read(item.text);
    return writeToFolder(deps, file.name, file);
  }
  if (item.kind === 'image' && item.blob) {
    await navigator.clipboard.write([new ClipboardItem({ [item.blob.type]: item.blob })]).catch(() => undefined);
    return pasteContent(deps, { text: null, image: item.blob, html: null }, 'default');
  }
  await navigator.clipboard.writeText(item.text).catch(() => undefined);
  return pasteContent(deps, { text: item.text, image: null, html: null }, 'default');
}
