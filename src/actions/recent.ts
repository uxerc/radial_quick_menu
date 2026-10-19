import { basename, dirname } from '../fs/paths';
import type { CaptureSignals, RecentSave } from '../wheel/types';

const KEY = 'radial-file-wheel.recent';
const LIMIT = 20;

/** Every file the wheel creates or moves, newest first, so each one is undoable. */
export class RecentSaves {
  private saves: RecentSave[] = load();
  private listeners = new Set<(saves: RecentSave[]) => void>();

  constructor(private readonly rootName: () => string) {}

  subscribe(listener: (saves: RecentSave[]) => void): void {
    this.listeners.add(listener);
    listener(this.saves);
  }

  get latest(): RecentSave | undefined {
    return this.saves[0];
  }

  add(path: string, origin: RecentSave['origin'] = { kind: 'created' }, signals?: CaptureSignals): RecentSave {
    const save: RecentSave = { id: crypto.randomUUID(), ...this.describe(path), origin, signals };
    this.saves = [save, ...this.saves].slice(0, LIMIT);
    this.persist();
    return save;
  }

  /** Same entry, new location: keeps the original origin so Undo still knows where it came from. */
  relocate(id: string, path: string): void {
    this.saves = this.saves.map((s) => (s.id === id ? { ...s, ...this.describe(path) } : s));
    this.persist();
  }

  remove(id: string): void {
    this.saves = this.saves.filter((s) => s.id !== id);
    this.persist();
  }

  clear(): void {
    this.saves = [];
    this.persist();
  }

  private describe(path: string): Pick<RecentSave, 'path' | 'folder' | 'file'> {
    const folder = basename(dirname(path)) || this.rootName();
    return { path, folder, file: basename(path) };
  }

  private persist(): void {
    localStorage.setItem(KEY, JSON.stringify(this.saves));
    for (const listener of this.listeners) listener(this.saves);
  }
}

function load(): RecentSave[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as RecentSave[];
  } catch {
    return [];
  }
}
