import { describe, expect, it } from 'vitest';
import { summarize } from './usage';
import type { UsageEvent } from './usage';

describe('usage summary', () => {
  it('counts opens, commits, cancels and per-item medians', () => {
    const events: UsageEvent[] = [
      { t: 1, type: 'open', trigger: 'alt-right' },
      { t: 2, type: 'commit', item: 'convert.png', label: 'PNG', layer: 'A', method: 'release', ms: 400 },
      { t: 3, type: 'open', trigger: 'hotkey' },
      { t: 4, type: 'commit', item: 'convert.png', label: 'PNG', layer: 'A', method: 'click', ms: 800, ok: false },
      { t: 5, type: 'open', trigger: 'alt-right' },
      { t: 6, type: 'commit', item: 'edit.compress', label: 'Compress', layer: 'B', method: 'keys', ms: 300 },
      { t: 7, type: 'open', trigger: 'alt-right' },
      { t: 8, type: 'cancel', reason: 'escape', ms: 1200, trigger: 'alt-right' },
    ];
    const s = summarize(events);
    expect(s).toMatchObject({ opens: 4, commits: 3, cancels: 1, layerB: 1, medianMs: 400 });
    expect(s.byTrigger).toEqual({ 'alt-right': 3, hotkey: 1 });
    expect(s.cancelReasons).toEqual({ escape: 1 });
    expect(s.items[0]).toMatchObject({ item: 'convert.png', count: 2, medianMs: 600, failed: 1 });
  });
});
