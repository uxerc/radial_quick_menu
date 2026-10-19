import type { ActionResult, ClipItem, PlatformAdapter, WheelAction } from '../wheel/types';

const CLIPBOARD_TIMEOUT_MS = 1500;
const READ_BLOCKED =
  'Clipboard read blocked by the browser. Allow clipboard access for this page, or press Ctrl+V once in the page to add it to history.';

function insertAtCaret(target: HTMLTextAreaElement, text: string): void {
  target.setRangeText(text, target.selectionStart, target.selectionEnd, 'end');
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

/** A pending permission prompt never settles in some embeds, so give up instead of hanging. */
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), CLIPBOARD_TIMEOUT_MS)),
  ]);
}

export async function readClipboardText(): Promise<string | null> {
  try {
    return await withTimeout(navigator.clipboard.readText());
  } catch {
    return null;
  }
}

/** Real clipboard and paste behaviour in a browser; everything native is reported as not implemented. */
export class BrowserAdapter implements PlatformAdapter {
  constructor(private readonly pasteTarget: () => HTMLTextAreaElement | null) {}

  async run(action: WheelAction): Promise<ActionResult> {
    switch (action.id) {
      case 'clipboard.paste':
      case 'pinned.paste':
        return this.pasteItem((action.payload as ClipItem).text);
      case 'paste.default':
      case 'paste.matchStyle':
      case 'pasteAs.plain': {
        const text = await readClipboardText();
        if (text === null) return { ok: false, message: READ_BLOCKED };
        if (text === '') return { ok: false, message: 'Clipboard has no text' };
        return this.insert(text, '');
      }
      default:
        return { ok: false, message: `${action.id}: not implemented yet` };
    }
  }

  /** Pasting a history item also makes it the current clipboard, like Win+V does. */
  private async pasteItem(text: string): Promise<ActionResult> {
    let note = '';
    try {
      await withTimeout(navigator.clipboard.writeText(text));
    } catch {
      note = ' (system clipboard not updated: write blocked by the browser)';
    }
    return this.insert(text, note);
  }

  private insert(text: string, note: string): ActionResult {
    const target = this.pasteTarget();
    if (!target) return { ok: false, message: 'No paste target available' };
    target.focus();
    insertAtCaret(target, text);
    return { ok: true, message: `Pasted ${text.length} characters${note}` };
  }
}
