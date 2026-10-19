import { basename, safeFileName } from '../fs/paths';
import { readClipboardText, withTimeout } from '../platform/clipboard';
import type { ActionResult, ClipItem } from '../wheel/types';
import { NO_FOLDER, fail, ok, timestamp } from './deps';
import type { ActionDeps } from './deps';

const URL_PATTERN = /^https?:\/\/\S+$/;
const READ_BLOCKED =
  'Clipboard read blocked by the browser. Allow clipboard access for this page, or press Ctrl+V once in the page to add it to history.';

type Mode = 'default' | 'plain' | 'link' | 'png' | 'file';

interface ClipContent {
  text: string | null;
  image: Blob | null;
  html: string | null;
}

async function readClipboard(): Promise<ClipContent | null> {
  try {
    const items = await withTimeout(navigator.clipboard.read());
    const content: ClipContent = { text: null, image: null, html: null };
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith('image/'));
      if (imageType && !content.image) content.image = await item.getType(imageType);
      if (item.types.includes('text/plain') && content.text === null) content.text = await (await item.getType('text/plain')).text();
      if (item.types.includes('text/html') && content.html === null) content.html = await (await item.getType('text/html')).text();
    }
    return content;
  } catch {
    const text = await readClipboardText();
    return text === null ? null : { text, image: null, html: null };
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

export async function pasteAction(deps: ActionDeps, mode: Mode): Promise<ActionResult> {
  const content = await readClipboard();
  if (!content) return fail(READ_BLOCKED);
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
