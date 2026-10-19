import { describe, expect, it } from 'vitest';
import { angleOf, clampCenter, childCenterAngle, hitTest, sliceAtAngle } from './geometry';

const polar = (r: number, deg: number) => ({
  dx: r * Math.sin((deg * Math.PI) / 180),
  dy: -r * Math.cos((deg * Math.PI) / 180),
});

describe('angleOf', () => {
  it('is 0 at top and proceeds clockwise', () => {
    expect(angleOf(0, -10)).toBeCloseTo(0);
    expect(angleOf(10, 0)).toBeCloseTo(90);
    expect(angleOf(0, 10)).toBeCloseTo(180);
    expect(angleOf(-10, 0)).toBeCloseTo(270);
  });
});

describe('sliceAtAngle', () => {
  it('centers slice 0 on top and wraps', () => {
    expect(sliceAtAngle(0)).toBe(0);
    expect(sliceAtAngle(29)).toBe(0);
    expect(sliceAtAngle(31)).toBe(1);
    expect(sliceAtAngle(359)).toBe(0);
    expect(sliceAtAngle(180)).toBe(3);
  });
});

describe('hitTest', () => {
  it('cancels inside the cancel zone', () => {
    expect(hitTest(10, 10, null)).toEqual({ kind: 'cancel' });
  });

  it('picks slices in the inner ring', () => {
    const { dx, dy } = polar(80, 120);
    expect(hitTest(dx, dy, null)).toEqual({ kind: 'slice', slot: 2 });
  });

  it('ignores the outer ring when nothing is expanded', () => {
    const { dx, dy } = polar(140, 0);
    expect(hitTest(dx, dy, null)).toEqual({ kind: 'outside' });
  });

  it('crosses the gap between rings without losing the slice', () => {
    for (const r of [100, 110, 115]) {
      const { dx, dy } = polar(r, 60);
      const hit = hitTest(dx, dy, { slot: 1, childCount: 3 });
      expect(hit.kind === 'child' || hit.kind === 'slice').toBe(true);
      expect(hit).toMatchObject({ slot: 1 });
    }
  });

  it('centers children on the parent slice', () => {
    expect(childCenterAngle(0, 1, 3)).toBeCloseTo(0);
    expect(childCenterAngle(0, 0, 2)).toBeCloseTo(-13);
    expect(childCenterAngle(0, 1, 2)).toBeCloseTo(13);
  });

  it('hits children by angle in the outer ring, 5 children spanning 130 degrees', () => {
    const expanded = { slot: 0, childCount: 5 };
    for (let child = 0; child < 5; child++) {
      const { dx, dy } = polar(150, childCenterAngle(0, child, 5));
      expect(hitTest(dx, dy, expanded)).toEqual({ kind: 'child', slot: 0, child });
    }
  });

  it('falls through to the slice under the cursor outside the child span', () => {
    const { dx, dy } = polar(150, 60);
    expect(hitTest(dx, dy, { slot: 0, childCount: 3 })).toEqual({ kind: 'slice', slot: 1 });
  });

  it('keeps expansion alive within the tolerance and closes past it', () => {
    const near = polar(176 + 20, 0);
    const far = polar(176 + 23, 0);
    expect(hitTest(near.dx, near.dy, { slot: 0, childCount: 3 }).kind).toBe('child');
    expect(hitTest(far.dx, far.dy, { slot: 0, childCount: 3 })).toEqual({ kind: 'outside' });
  });
});

describe('clampCenter', () => {
  it('keeps the wheel fully on screen', () => {
    expect(clampCenter(0, 0, 1000, 800)).toEqual({ x: 198, y: 198 });
    expect(clampCenter(999, 799, 1000, 800)).toEqual({ x: 802, y: 602 });
    expect(clampCenter(500, 400, 1000, 800)).toEqual({ x: 500, y: 400 });
  });
});
