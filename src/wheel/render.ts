import { createElement } from 'lucide';
import type { IconNode } from 'lucide';
import type { WheelView } from './controller';
import { GEOMETRY, childCenterAngle, slotCenterAngle } from './geometry';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GAP_DEGREES = 1;

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  className?: string,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (className) el.setAttribute('class', className);
  return el;
}

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function sectorPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  const o0 = polar(cx, cy, r1, a0);
  const o1 = polar(cx, cy, r1, a1);
  const i1 = polar(cx, cy, r0, a1);
  const i0 = polar(cx, cy, r0, a0);
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${r1} ${r1} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${r0} ${r0} 0 ${large} 0 ${i0.x} ${i0.y}`,
    'Z',
  ].join(' ');
}

function icon(node: IconNode, x: number, y: number, size: number): SVGElement {
  const el = createElement(node);
  el.setAttribute('x', String(x - size / 2));
  el.setAttribute('y', String(y - size / 2));
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.setAttribute('class', 'wheel-icon');
  return el;
}

function label(text: string, x: number, y: number): SVGTextElement {
  const el = svgEl('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'hanging' }, 'wheel-label');
  el.textContent = text;
  return el;
}

/** Number-key hint near the outer edge of each cell. */
function digit(cx: number, cy: number, radius: number, angle: number, n: number): SVGTextElement {
  const p = polar(cx, cy, radius, angle);
  const el = svgEl('text', { x: p.x, y: p.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, 'wheel-digit');
  el.textContent = String(n);
  return el;
}

function renderItem(
  group: SVGGElement,
  cx: number,
  cy: number,
  radius: number,
  angle: number,
  iconNode: IconNode,
  text: string,
): void {
  const p = polar(cx, cy, radius, angle);
  group.append(icon(iconNode, p.x, p.y - 7, 18), label(text, p.x, p.y + 4));
}

export function renderWheel(svg: SVGSVGElement, view: WheelView): void {
  svg.replaceChildren();
  svg.classList.toggle('open', view.open);
  if (!view.open) return;

  const { x: cx, y: cy } = view.center;
  const root = svgEl('g', {}, `wheel layer-${view.layer.toLowerCase()}`);
  const half = GEOMETRY.sliceDegrees / 2;
  const ringMid = (GEOMETRY.cancelRadius + GEOMETRY.innerOuter) / 2;
  const outerMid = (GEOMETRY.outerInner + GEOMETRY.outerOuter) / 2;

  for (const slot of view.slots) {
    const center = slotCenterAngle(slot.index);
    const hovered = (view.hit.kind === 'slice' || view.hit.kind === 'child') && view.hit.slot === slot.index;
    const classes = ['wheel-slice'];
    if (slot.disabledReason) classes.push('disabled');
    if (hovered) classes.push('hovered');
    if (view.expandedSlot === slot.index) classes.push('expanded');

    const group = svgEl('g', {}, classes.join(' '));
    group.append(
      svgEl('path', {
        d: sectorPath(
          cx, cy, GEOMETRY.cancelRadius, GEOMETRY.innerOuter,
          center - half + GAP_DEGREES / 2, center + half - GAP_DEGREES / 2,
        ),
      }),
    );
    renderItem(group, cx, cy, ringMid, center, slot.icon, slot.label);
    group.append(digit(cx, cy, GEOMETRY.innerOuter - 9, center, slot.index + 1));
    root.append(group);
  }

  if (view.expandedSlot !== null) {
    const slot = view.slots[view.expandedSlot];
    const count = slot.children.length;
    slot.children.forEach((item, index) => {
      const center = childCenterAngle(slot.index, index, count);
      const hovered = view.hit.kind === 'child' && view.hit.child === index;
      const group = svgEl('g', {}, hovered ? 'wheel-child hovered' : 'wheel-child');
      const span = GEOMETRY.childDegrees / 2 - GAP_DEGREES / 2;
      group.append(
        svgEl('path', {
          d: sectorPath(cx, cy, GEOMETRY.outerInner, GEOMETRY.outerOuter, center - span, center + span),
        }),
      );
      renderItem(group, cx, cy, outerMid, center, item.icon, item.label);
      group.append(digit(cx, cy, GEOMETRY.outerOuter - 8, center, index + 1));
      root.append(group);
    });
  }

  const centerGroup = svgEl('g', {}, view.centerLabel.muted ? 'wheel-center muted' : 'wheel-center');
  centerGroup.append(svgEl('circle', { cx, cy, r: GEOMETRY.centerRadius }));
  if (view.centerLabel.icon) {
    centerGroup.append(icon(view.centerLabel.icon, cx, cy - 8, 18), label(view.centerLabel.text, cx, cy + 3));
  } else {
    const text = label(view.centerLabel.text, cx, cy);
    text.setAttribute('dominant-baseline', 'middle');
    centerGroup.append(text);
  }
  root.append(centerGroup);

  const badge = view.latched ? `${view.layer} · locked` : view.layer;
  const status = svgEl('text', { x: cx, y: cy + GEOMETRY.outerOuter + GEOMETRY.tolerance + 14, 'text-anchor': 'middle' }, 'wheel-status');
  status.textContent = `${badge} — ${view.status || 'Esc cancels · Shift swaps layer · Space locks it'}`;
  root.append(status);

  svg.append(root);
}
