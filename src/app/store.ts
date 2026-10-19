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

/** Selection and recent saves have no native source yet, so the dev panel supplies them. */
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

  setSelection(files: string[]): void {
    this.selection = files;
    this.emit();
  }

  setRecentSaves(entries: string[]): void {
    this.recentSaves = entries.map((entry, i) => {
      const cut = entry.lastIndexOf('/');
      return {
        id: String(i),
        folder: cut === -1 ? entry : entry.slice(0, cut).split('/').pop() ?? entry,
        file: cut === -1 ? entry : entry.slice(cut + 1),
      };
    });
    this.emit();
  }

  recordClipboard(text: string): void {
    if (text.trim() === '') return;
    this.clipboard = [toClipItem(text), ...this.clipboard.filter((c) => c.text !== text)].slice(0, HISTORY_LIMIT);
    this.emit();
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

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

function loadPinned(): ClipItem[] {
  try {
    return JSON.parse(localStorage.getItem(PINNED_KEY) ?? '[]') as ClipItem[];
  } catch {
    return [];
  }
}
