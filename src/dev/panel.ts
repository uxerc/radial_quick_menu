import { loadHotkeyTexts, parseCombo, saveHotkeyTexts } from '../app/hotkeys';
import type { ContextStore } from '../app/store';
import { readClipboardText } from '../platform/browser';
import type { WheelContext } from '../wheel/types';

function lines(value: string): string[] {
  return value.split('\n').map((l) => l.trim()).filter(Boolean);
}

export interface DevPanel {
  pasteTarget: () => HTMLTextAreaElement | null;
  log: (message: string) => void;
  openButton: HTMLButtonElement;
}

export function mountDevPanel(
  root: HTMLElement,
  store: ContextStore,
  onHotkeys: (texts: string[]) => void,
): DevPanel {
  root.innerHTML = `
    <h1>Radial file wheel · dev</h1>
    <button id="dev-open" data-testid="dev-open">Open wheel at last cursor position</button>
    <div class="hint">Alt+right-click or a hotkey opens it. Shift swaps layers, Space locks, Esc cancels.</div>

    <h2>Hotkeys (comma separated, e.g. Ctrl+Alt+Space, Ctrl+Shift+K)</h2>
    <input id="dev-hotkeys" data-testid="dev-hotkeys" />
    <div class="hint" id="dev-hotkeys-hint"></div>

    <h2>Selection override (one path per line, empty = no selection)</h2>
    <textarea id="dev-selection" data-testid="dev-selection" placeholder="C:/Users/me/report.png"></textarea>

    <h2>Recent saves override (folder/file per line, empty = none)</h2>
    <textarea id="dev-recent" data-testid="dev-recent" placeholder="Screenshots/Jira/shot1.png"></textarea>

    <h2>Paste target</h2>
    <textarea id="paste-target" data-testid="dev-paste-target" placeholder="The wheel pastes here. Ctrl+C on this page, or Ctrl+V text copied elsewhere, fills clipboard history."></textarea>

    <h2>Pinned snippets</h2>
    <input id="dev-pin-input" data-testid="dev-pin-input" placeholder="Snippet, Enter to pin" />
    <ul id="dev-pinned"></ul>

    <h2>Clipboard history (copy/cut/paste on this page, plus system clipboard when access is granted)</h2>
    <ul id="dev-history"></ul>

    <h2>Action log</h2>
    <div class="log" id="dev-log"></div>
  `;

  const selection = root.querySelector<HTMLTextAreaElement>('#dev-selection')!;
  const recent = root.querySelector<HTMLTextAreaElement>('#dev-recent')!;
  const pasteTarget = root.querySelector<HTMLTextAreaElement>('#paste-target')!;
  const pinInput = root.querySelector<HTMLInputElement>('#dev-pin-input')!;
  const pinnedList = root.querySelector<HTMLUListElement>('#dev-pinned')!;
  const historyList = root.querySelector<HTMLUListElement>('#dev-history')!;
  const logBox = root.querySelector<HTMLDivElement>('#dev-log')!;
  const openButton = root.querySelector<HTMLButtonElement>('#dev-open')!;

  const hotkeys = root.querySelector<HTMLInputElement>('#dev-hotkeys')!;
  const hotkeysHint = root.querySelector<HTMLDivElement>('#dev-hotkeys-hint')!;
  hotkeys.value = loadHotkeyTexts().join(', ');
  hotkeys.addEventListener('input', () => {
    const texts = hotkeys.value.split(',').map((t) => t.trim()).filter(Boolean);
    const invalid = texts.filter((t) => parseCombo(t) === null);
    hotkeysHint.textContent = invalid.length > 0 ? `Ignored (need a modifier and one key): ${invalid.join(', ')}` : '';
    const valid = texts.filter((t) => parseCombo(t) !== null);
    saveHotkeyTexts(valid);
    onHotkeys(valid);
  });

  selection.addEventListener('input', () => store.setSelection(lines(selection.value)));
  recent.addEventListener('input', () => store.setRecentSaves(lines(recent.value)));
  pinInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    store.pin(pinInput.value);
    pinInput.value = '';
  });

  const renderLists = (ctx: WheelContext) => {
    pinnedList.replaceChildren(
      ...ctx.pinned.map((p) => {
        const li = document.createElement('li');
        li.textContent = p.text;
        const remove = document.createElement('button');
        remove.textContent = '×';
        remove.addEventListener('click', () => store.unpin(p.id));
        li.append(' ', remove);
        return li;
      }),
    );
    historyList.replaceChildren(
      ...ctx.clipboard.slice(0, 5).map((c) => {
        const li = document.createElement('li');
        li.textContent = c.text;
        return li;
      }),
    );
  };
  store.subscribe(renderLists);

  const capture = () => {
    const active = document.activeElement;
    const text =
      active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement
        ? active.value.slice(active.selectionStart ?? 0, active.selectionEnd ?? 0)
        : (document.getSelection()?.toString() ?? '');
    store.recordClipboard(text);
  };
  document.addEventListener('copy', capture);
  document.addEventListener('cut', capture);
  // Ctrl+V anywhere on the page records text copied in other apps, without a permission prompt.
  document.addEventListener('paste', (e) => store.recordClipboard(e.clipboardData?.getData('text/plain') ?? ''));

  // Only poll when access is already granted, so returning to the page never triggers a prompt.
  const pollClipboard = async () => {
    try {
      const status = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
      if (status.state !== 'granted') return;
    } catch {
      return;
    }
    const text = await readClipboardText();
    if (text) store.recordClipboard(text);
  };
  window.addEventListener('focus', () => void pollClipboard());
  void pollClipboard();

  return {
    pasteTarget: () => pasteTarget,
    log: (message) => {
      const row = document.createElement('div');
      row.textContent = `${new Date().toLocaleTimeString()} ${message}`;
      logBox.prepend(row);
    },
    openButton,
  };
}
