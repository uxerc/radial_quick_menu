import { describe, expect, it } from 'vitest';
import { WheelController } from './controller';
import { GEOMETRY } from './geometry';
import type { WheelContext } from './types';

const viewport = { width: 1000, height: 800 };
const ctx: WheelContext = {
  selection: ['a.png'],
  clipboard: [{ id: '1', kind: 'text', text: 'hello' }],
  pinned: [],
  recentSaves: [],
};

function at(c: WheelController, r: number, deg: number): void {
  const rad = (deg * Math.PI) / 180;
  c.pointerMove(500 + r * Math.sin(rad), 400 - r * Math.cos(rad));
}

function opened(context: WheelContext = ctx): WheelController {
  const c = new WheelController();
  c.setContext(context);
  c.open(500, 400, viewport, false);
  return c;
}

describe('WheelController', () => {
  it('shows Cancel while idle and expands the hovered slice', () => {
    const c = opened();
    expect(c.view().centerLabel.text).toBe('Cancel');
    at(c, 80, 60);
    expect(c.view().centerLabel.text).toBe('Paste');
    expect(c.view().expandedSlot).toBe(1);
  });

  it('keeps disabled slices in place, greyed and not expandable', () => {
    const c = opened();
    at(c, 80, 240);
    const view = c.view();
    expect(view.slots[4].disabledReason).toBe('No recent saves');
    expect(view.expandedSlot).toBeNull();
    expect(view.centerLabel.muted).toBe(true);
  });

  it('swaps layer in place with Shift and honors the latch', () => {
    const c = opened();
    at(c, 80, 0);
    expect(c.view().centerLabel.text).toBe('Clipboard');
    c.setShift(true);
    expect(c.view().layer).toBe('B');
    expect(c.view().slots.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5]);
    c.toggleLatch();
    c.setShift(false);
    expect(c.view().layer).toBe('B');
    c.toggleLatch();
    expect(c.view().layer).toBe('A');
  });

  it('commits a hovered child and ignores a bare parent slice', () => {
    const c = opened();
    at(c, 80, 0);
    expect(c.commit()).toEqual({ item: null, close: false });
    at(c, 150, 0);
    const { item, close } = c.commit();
    expect(item?.action.id).toBe('clipboard.paste');
    expect(close).toBe(true);
  });

  it('closes expansion beyond the tolerance and cancels on click outside', () => {
    const c = opened();
    at(c, 80, 0);
    at(c, 150, 0);
    expect(c.view().expandedSlot).toBe(0);
    at(c, GEOMETRY.outerOuter + GEOMETRY.tolerance + 5, 0);
    expect(c.view().expandedSlot).toBeNull();
    expect(c.commit()).toEqual({ item: null, close: true });
  });

  it('clamps the wheel center on screen', () => {
    const c = new WheelController();
    c.open(2, 2, viewport, false);
    expect(c.view().center).toEqual({ x: 198, y: 198 });
  });

  it('opens straight into layer B when Shift is already held', () => {
    const c = new WheelController();
    c.open(500, 400, viewport, true);
    expect(c.view().layer).toBe('B');
  });
});
