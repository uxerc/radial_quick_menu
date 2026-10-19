import { describe, expect, it } from 'vitest';
import { matches, parseCombo } from './hotkeys';

const key = (init: Partial<KeyboardEvent>) => init as KeyboardEvent;

describe('hotkeys', () => {
  it('parses combos and rejects ones without a modifier or key', () => {
    expect(parseCombo('Ctrl+Alt+Space')).toMatchObject({ ctrl: true, alt: true, code: 'Space' });
    expect(parseCombo('ctrl+shift+k')).toMatchObject({ ctrl: true, shift: true, code: 'KeyK' });
    expect(parseCombo('Space')).toBeNull();
    expect(parseCombo('Ctrl+Alt')).toBeNull();
    expect(parseCombo('Ctrl+Banana')).toBeNull();
  });

  it('ignores Shift unless the combo requires it', () => {
    const combo = parseCombo('Ctrl+Alt+Space')!;
    const base = { code: 'Space', ctrlKey: true, altKey: true, metaKey: false };
    expect(matches(combo, key({ ...base, shiftKey: false }))).toBe(true);
    expect(matches(combo, key({ ...base, shiftKey: true }))).toBe(true);
    expect(matches(combo, key({ ...base, ctrlKey: false, shiftKey: false }))).toBe(false);
  });
});
