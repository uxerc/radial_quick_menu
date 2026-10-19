import type { ActionResult, ClipItem, PlatformAdapter, WheelAction } from '../wheel/types';

function insertAtCaret(target: HTMLTextAreaElement, text: string): void {
  const start = target.selectionStart;
  const end = target.selectionEnd;
  target.setRangeText(text, start, end, 'end');
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Real clipboard and paste behaviour in a browser; everything native is reported as not implemented. */
export class BrowserAdapter implements PlatformAdapter {
  constructor(private readonly pasteTarget: () => HTMLTextAreaElement | null) {}

  async run(action: WheelAction): Promise<ActionResult> {
    switch (action.id) {
      case 'clipboard.paste':
      case 'pinned.paste':
        return this.pasteText((action.payload as ClipItem).text, true);
      case 'paste.default':
      case 'paste.matchStyle':
      case 'pasteAs.plain':
        return this.pasteText(await navigator.clipboard.readText(), false);
      default:
        return { ok: false, message: `${action.id}: not implemented yet` };
    }
  }

  private async pasteText(text: string, writeClipboard: boolean): Promise<ActionResult> {
    const target = this.pasteTarget();
    if (!target) return { ok: false, message: 'No paste target available' };
    if (writeClipboard) await navigator.clipboard.writeText(text);
    target.focus();
    insertAtCaret(target, text);
    return { ok: true, message: `Pasted ${text.length} characters` };
  }
}
