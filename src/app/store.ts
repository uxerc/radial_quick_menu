import { basename } from '../fs/paths';
import type { ClipItem, RecentSave, WheelContext } from '../wheel/types';

const PINNED_KEY = 'radial-file-wheel.pinned';
const HISTORY_LIMIT = 20;
const URL_PATTERN = /^https?:\/\/\S+$/;

export function toClipItem(text: string): ClipItem {
  return {
    id: crypto.randomUUID(),
    kind: URL_PATTERN.test(text.trim()) ? 'url' : 'text',
    text,
  };
}

export class ContextStore {
  private selection: string[] = [];
  private recentSaves: RecentSave[] = [];
  private clipboard: ClipItem[] = [];
  private pinned: ClipItem[] = loadPinned();
  private listeners = new Set<(ctx: WheelContext) => void>();

  subscribe(listener: (ctx: WheelContext) => void): void {
    this.listeners.add(listener);
    listener(this.snapshot());
  }

  snapshot(): WheelContext {
    return {
      selection: this.selection,
      clipboard: this.clipboard,
      pinned: this.pinned,
      recentSaves: this.recentSaves,
    };
  }

  setSelection(paths: string[]): void {
    this.selection = paths;
    this.emit();
  }

  setRecentSaves(saves: RecentSave[]): void {
    this.recentSaves = saves;
    this.emit();
  }

  recordClipboard(text: string): void {
    if (text.trim() === '') return;
    this.push(toClipItem(text), (c) => c.text === text);
  }

  recordImage(blob: Blob): void {
    const label = `Image ${new Date().toLocaleTimeString()}`;
    this.push({ id: crypto.randomUUID(), kind: 'image', text: label, blob }, (c) => c.blob?.size === blob.size && c.kind === 'image');
  }

  recordFiles(paths: string[]): void {
    for (const path of paths) {
      this.push({ id: crypto.randomUUID(), kind: 'file', text: path }, (c) => c.kind === 'file' && c.text === path);
    }
  }

  pin(text: string): void {
    if (text.trim() === '') return;
    this.pinned = [toClipItem(text), ...this.pinned.filter((p) => p.text !== text)];
    localStorage.setItem(PINNED_KEY, JSON.stringify(this.pinned));
    this.emit();
  }

  unpin(id: string): void {
    this.pinned = this.pinned.filter((p) => p.id !== id);
    localStorage.setItem(PINNED_KEY, JSON.stringify(this.pinned));
    this.emit();
  }

  private push(item: ClipItem, same: (c: ClipItem) => boolean): void {
    this.clipboard = [item, ...this.clipboard.filter((c) => !same(c))].slice(0, HISTORY_LIMIT);
    this.emit();
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export function clipLabel(item: ClipItem): string {
  return item.kind === 'file' ? basename(item.text) : item.text;
}

function loadPinned(): ClipItem[] {
  try {
    return JSON.parse(localStorage.getItem(PINNED_KEY) ?? '[]') as ClipItem[];
  } catch {
    return [];
  }
}
