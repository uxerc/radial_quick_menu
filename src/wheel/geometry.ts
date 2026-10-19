export const GEOMETRY = {
  cancelRadius: 44,
  centerRadius: 38,
  innerOuter: 108,
  outerInner: 113,
  outerOuter: 176,
  tolerance: 22,
  sliceCount: 6,
  sliceDegrees: 60,
  childDegrees: 26,
  maxChildren: 5,
} as const;

export type Hit =
  | { kind: 'cancel' }
  | { kind: 'outside' }
  | { kind: 'slice'; slot: number }
  | { kind: 'child'; slot: number; child: number };

/** Degrees clockwise from 12 o'clock, in [0, 360). Screen y grows downward. */
export function angleOf(dx: number, dy: number): number {
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function slotCenterAngle(slot: number): number {
  return slot * GEOMETRY.sliceDegrees;
}

export function childCenterAngle(slot: number, child: number, count: number): number {
  return slotCenterAngle(slot) + (child - (count - 1) / 2) * GEOMETRY.childDegrees;
}

function angularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function sliceAtAngle(angle: number): number {
  return Math.floor(((angle + GEOMETRY.sliceDegrees / 2) % 360) / GEOMETRY.sliceDegrees);
}

/**
 * Selection is purely angular. In the outer ring children take priority over the
 * slice under the cursor, so entering the ring from a slice never switches slices;
 * angles outside the child span fall through to the slice at that angle.
 */
export function hitTest(
  dx: number,
  dy: number,
  expanded: { slot: number; childCount: number } | null,
): Hit {
  const r = Math.hypot(dx, dy);
  if (r < GEOMETRY.cancelRadius) return { kind: 'cancel' };

  const reach = expanded ? GEOMETRY.outerOuter + GEOMETRY.tolerance : GEOMETRY.innerOuter + GEOMETRY.tolerance;
  if (r > reach) return { kind: 'outside' };

  const angle = angleOf(dx, dy);

  if (expanded && r >= GEOMETRY.outerInner) {
    for (let child = 0; child < expanded.childCount; child++) {
      const center = childCenterAngle(expanded.slot, child, expanded.childCount);
      if (angularDistance(angle, center) <= GEOMETRY.childDegrees / 2) {
        return { kind: 'child', slot: expanded.slot, child };
      }
    }
  }

  return { kind: 'slice', slot: sliceAtAngle(angle) };
}

export function clampCenter(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const extent = GEOMETRY.outerOuter + GEOMETRY.tolerance;
  return {
    x: Math.min(Math.max(x, extent), Math.max(extent, width - extent)),
    y: Math.min(Math.max(y, extent), Math.max(extent, height - extent)),
  };
}
