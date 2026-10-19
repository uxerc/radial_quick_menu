import type { Filing } from '../actions/filing';
import { parseRules } from '../actions/rules';
import { loadHotkeyTexts, parseCombo, saveHotkeyTexts } from '../app/hotkeys';
import { clipLabel } from '../app/store';
import type { ContextStore } from '../app/store';
import { readClipboardText } from '../platform/clipboard';
import type { WheelContext } from '../wheel/types';

export interface SidePanel {
  pasteTarget: HTMLTextAreaElement;
  log: (message: string) => void;
}

export function mountSidePanel(
  root: HTMLElement,
  store: ContextStore,
  filing: Filing,
  onHotkeys: (texts: string[]) => void,
): SidePanel {
  root.innerHTML = `
    <h1>Radial file wheel</h1>
    <div class="hint">Alt+right-click or a hotkey opens the wheel. Shift swaps layers, Space locks, Esc cancels.
      Over the file list it acts on the folder and selection; over the paste box it inserts text.</div>

    <h2>Hotkeys (comma separated)</h2>
    <input id="dev-hotkeys" data-testid="dev-hotkeys" />
    <div class="hint" id="dev-hotkeys-hint"></div>

    <h2>Paste box</h2>
    <textarea id="paste-target" data-testid="dev-paste-target" placeholder="Open the wheel over this box to paste text here."></textarea>

    <h2>Screenshot filing rules</h2>
    <textarea id="dev-rules" data-testid="dev-rules" placeholder="app: Google Chrome -> Screenshots/Browser&#10;title: Jira -> Screenshots/Jira"></textarea>
    <div class="hint" id="dev-rules-hint">No match → Screenshots/Inbox. Signals: window title and app (from the title).</div>

    <h2>Pinned snippets</h2>
    <input id="dev-pin-input" data-testid="dev-pin-input" placeholder="Snippet, Enter to pin" />
    <ul id="dev-pinned"></ul>

    <h2>Clipboard history</h2>
    <div class="hint">Ctrl+C/X on this page (files too), or Ctrl+V of anything copied elsewhere.</div>
    <ul id="dev-history"></ul>

    <h2>Action log</h2>
    <div class="log" id="dev-log"></div>
  `;

  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const pasteTarget = q<HTMLTextAreaElement>('#paste-target');
  const pinInput = q<HTMLInputElement>('#dev-pin-input');
  const pinnedList = q<HTMLUListElement>('#dev-pinned');
  const historyList = q<HTMLUListElement>('#dev-history');
  const logBox = q<HTMLDivElement>('#dev-log');
  const hotkeys = q<HTMLInputElement>('#dev-hotkeys');
  const hotkeysHint = q<HTMLDivElement>('#dev-hotkeys-hint');
  const rules = q<HTMLTextAreaElement>('#dev-rules');
  const rulesHint = q<HTMLDivElement>('#dev-rules-hint');

  hotkeys.value = loadHotkeyTexts().join(', ');
  hotkeys.addEventListener('input', () => {
    const texts = hotkeys.value.split(',').map((t) => t.trim()).filter(Boolean);
    const invalid = texts.filter((t) => parseCombo(t) === null);
    hotkeysHint.textContent = invalid.length > 0 ? `Ignored (need a modifier and one key): ${invalid.join(', ')}` : '';
    const valid = texts.filter((t) => parseCombo(t) !== null);
    saveHotkeyTexts(valid);
    onHotkeys(valid);
  });

  rules.value = filing.rulesText;
  filing.onRulesChanged((text) => {
    if (rules.value !== text) rules.value = text;
  });
  rules.addEventListener('input', () => {
    filing.rulesText = rules.value;
    const { invalid } = parseRules(rules.value);
    rulesHint.textContent = invalid.length > 0 ? `Not understood: ${invalid.join(' | ')}` : 'No match → Screenshots/Inbox.';
  });

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
        li.textContent = `${c.kind === 'text' ? '' : `[${c.kind}] `}${clipLabel(c)}`;
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
  // Ctrl+V anywhere on the page records what was copied in other apps, without a permission prompt.
  document.addEventListener('paste', (e) => {
    for (const file of e.clipboardData?.files ?? []) if (file.type.startsWith('image/')) store.recordImage(file);
    store.recordClipboard(e.clipboardData?.getData('text/plain') ?? '');
  });

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
    pasteTarget,
    log: (message) => {
      const row = document.createElement('div');
      row.textContent = `${new Date().toLocaleTimeString()} ${message}`;
      logBox.prepend(row);
    },
  };
}
