export interface Combo {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  code: string;
}

const STORAGE_KEY = 'radial-file-wheel.hotkeys';
// Ctrl+Alt+Space is taken by the Claude desktop app's quick entry.
export const DEFAULT_HOTKEYS = ['Ctrl+Shift+Space'];

const NAMED_CODES: Record<string, string> = { space: 'Space', enter: 'Enter', tab: 'Tab' };

export function parseCombo(text: string): Combo | null {
  const combo: Combo = { ctrl: false, alt: false, shift: false, meta: false, code: '' };
  for (const part of text.split('+').map((p) => p.trim().toLowerCase())) {
    if (part === 'ctrl' || part === 'control') combo.ctrl = true;
    else if (part === 'alt' || part === 'option') combo.alt = true;
    else if (part === 'shift') combo.shift = true;
    else if (part === 'meta' || part === 'win' || part === 'cmd') combo.meta = true;
    else if (NAMED_CODES[part]) combo.code = NAMED_CODES[part];
    else if (/^[a-z]$/.test(part)) combo.code = `Key${part.toUpperCase()}`;
    else if (/^[0-9]$/.test(part)) combo.code = `Digit${part}`;
    else if (/^f([1-9]|1[0-2])$/.test(part)) combo.code = part.toUpperCase();
    else return null;
  }
  const hasModifier = combo.ctrl || combo.alt || combo.meta;
  return combo.code !== '' && hasModifier ? combo : null;
}

/** Shift is only compared when the combo asks for it, so Shift can pre-select layer B. */
export function matches(combo: Combo, e: KeyboardEvent): boolean {
  return (
    e.code === combo.code &&
    e.ctrlKey === combo.ctrl &&
    e.altKey === combo.alt &&
    e.metaKey === combo.meta &&
    (!combo.shift || e.shiftKey)
  );
}

export function loadHotkeyTexts(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as string[] | null;
    return stored && stored.length > 0 ? stored : DEFAULT_HOTKEYS;
  } catch {
    return DEFAULT_HOTKEYS;
  }
}

export function saveHotkeyTexts(texts: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(texts));
}

export function parseAll(texts: string[]): Combo[] {
  return texts.map(parseCombo).filter((c): c is Combo => c !== null);
}
