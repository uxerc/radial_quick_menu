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
    this.refresh();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.expandedSlot = null;
    this.emit();
  }

  pointerMove(x: number, y: number): void {
    this.pointer = { x, y };
    if (this.isOpen) this.refresh();
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
    this.hit = hitTest(this.pointer.x - this.origin.x, this.pointer.y - this.origin.y, expanded);

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
