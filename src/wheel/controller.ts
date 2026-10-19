import { clampCenter, hitTest } from './geometry';
import type { Hit } from './geometry';
import { buildSlots } from './slots';
import type { Layer, WheelContext, WheelItem, WheelSlot } from './types';

export interface WheelView {
  open: boolean;
  center: { x: number; y: number };
  layer: Layer;
  latched: boolean;
  slots: WheelSlot[];
  hit: Hit;
  expandedSlot: number | null;
  centerLabel: { text: string; icon: WheelSlot['icon'] | null; muted: boolean };
  status: string;
}

const EMPTY_CONTEXT: WheelContext = { selection: [], clipboard: [], pinned: [], recentSaves: [] };

export class WheelController {
  private isOpen = false;
  private origin = { x: 0, y: 0 };
  private pointer = { x: 0, y: 0 };
  private shiftHeld = false;
  private latched = false;
  private hit: Hit = { kind: 'cancel' };
  private expandedSlot: number | null = null;
  /** Set by number keys; the next real pointer move hands control back to the mouse. */
  private keyHit: Hit | null = null;
  private context: WheelContext = EMPTY_CONTEXT;
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get isWheelOpen(): boolean {
    return this.isOpen;
  }

  setContext(context: WheelContext): void {
    this.context = context;
    if (this.isOpen) this.refresh();
  }

  open(x: number, y: number, viewport: { width: number; height: number }, shiftHeld: boolean): void {
    this.origin = clampCenter(x, y, viewport.width, viewport.height);
    this.pointer = { x, y };
    this.shiftHeld = shiftHeld;
    this.latched = false;
    this.isOpen = true;
    this.hit = { kind: 'cancel' };
    this.expandedSlot = null;
    this.keyHit = null;
    this.refresh();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.expandedSlot = null;
    this.emit();
  }

  pointerMove(x: number, y: number): void {
    if (x === this.pointer.x && y === this.pointer.y) return;
    this.pointer = { x, y };
    this.keyHit = null;
    if (this.isOpen) this.refresh();
  }

  get hitKind(): Hit['kind'] {
    return this.hit.kind;
  }

  /**
   * Number keys: with a slice expanded, n picks child n; otherwise n picks slot n.
   * Returns the child item when one was picked, so the caller can run it straight away.
   */
  pressNumber(n: number): WheelItem | null {
    if (!this.isOpen) return null;
    const slots = this.slots();
    if (this.expandedSlot !== null) {
      const child = slots[this.expandedSlot].children[n - 1];
      if (!child) return null;
      this.keyHit = { kind: 'child', slot: this.expandedSlot, child: n - 1 };
      this.refresh();
      return child;
    }
    if (n < 1 || n > slots.length) return null;
    this.keyHit = { kind: 'slice', slot: n - 1 };
    this.refresh();
    return null;
  }

  /** Backspace: from the outer ring back to choosing a slot. */
  back(): void {
    if (!this.isOpen) return;
    this.keyHit = { kind: 'cancel' };
    this.expandedSlot = null;
    this.refresh();
  }

  setShift(held: boolean): void {
    if (this.shiftHeld === held) return;
    this.shiftHeld = held;
    if (this.isOpen) this.refresh();
  }

  toggleLatch(): void {
    if (!this.isOpen) return;
    this.latched = !this.latched;
    this.refresh();
  }

  /** Returns the item to run, or null when the click should only cancel/do nothing. */
  commit(): { item: WheelItem | null; close: boolean } {
    if (!this.isOpen) return { item: null, close: false };
    const { hit } = this;
    if (hit.kind === 'child') {
      const item = this.slots()[hit.slot].children[hit.child];
      return { item, close: true };
    }
    if (hit.kind === 'slice') return { item: null, close: false };
    return { item: null, close: true };
  }

  view(): WheelView {
    const slots = this.slots();
    const { hit } = this;
    let centerLabel: WheelView['centerLabel'] = { text: 'Cancel', icon: null, muted: false };
    let status = '';

    if (hit.kind === 'child') {
      const item = slots[hit.slot].children[hit.child];
      centerLabel = { text: item.label, icon: item.icon, muted: false };
      status = `${slots[hit.slot].label} › ${item.fullLabel}`;
    } else if (hit.kind === 'slice') {
      const slot = slots[hit.slot];
      centerLabel = { text: slot.label, icon: slot.icon, muted: slot.disabledReason !== null };
      status = slot.disabledReason ?? slot.label;
    }

    return {
      open: this.isOpen,
      center: this.origin,
      layer: this.layer(),
      latched: this.latched,
      slots,
      hit,
      expandedSlot: this.expandedSlot,
      centerLabel,
      status,
    };
  }

  private layer(): Layer {
    return this.latched || this.shiftHeld ? 'B' : 'A';
  }

  private slots(): WheelSlot[] {
    return buildSlots(this.layer(), this.context);
  }

  private refresh(): void {
    const slots = this.slots();
    const expanded =
      this.expandedSlot !== null
        ? { slot: this.expandedSlot, childCount: slots[this.expandedSlot].children.length }
        : null;
    this.hit = this.keyHit ?? hitTest(this.pointer.x - this.origin.x, this.pointer.y - this.origin.y, expanded);
    if (this.hit.kind === 'child' && !slots[this.hit.slot].children[this.hit.child]) {
      this.hit = { kind: 'slice', slot: this.hit.slot };
    }

    this.expandedSlot = null;
    if (this.hit.kind === 'slice' || this.hit.kind === 'child') {
      const slot = slots[this.hit.slot];
      if (slot.disabledReason === null && slot.children.length > 0) this.expandedSlot = slot.index;
    }
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
