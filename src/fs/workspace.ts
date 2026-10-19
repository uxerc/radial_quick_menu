import { idbGet, idbSet } from './idb';
import { basename, dirname, joinPath, uniqueName } from './paths';

export interface Entry {
  name: string;
  path: string;
  kind: 'file' | 'directory';
}

type Listener = () => void;

const ROOT_KEY = 'workspace-root';

/** A user-picked folder, addressed by paths relative to it. Writes go to the real disk. */
export class Workspace {
  private root: FileSystemDirectoryHandle | null = null;
  private listeners = new Set<Listener>();

  get isOpen(): boolean {
    return this.root !== null;
  }

  get name(): string {
    return this.root?.name ?? '';
  }

  subscribe(listener: Listener): void {
    this.listeners.add(listener);
  }

  changed(): void {
    for (const listener of this.listeners) listener();
  }

  async pick(): Promise<void> {
    const handle = await window.showDirectoryPicker({ id: 'workspace', mode: 'readwrite' });
    await this.use(handle);
  }

  async use(handle: FileSystemDirectoryHandle): Promise<void> {
    this.root = handle;
    await idbSet(ROOT_KEY, handle).catch(() => undefined);
    this.changed();
  }

  /** Returns the stored folder; permission needs a user gesture, so the caller calls reconnect() from a click. */
  async stored(): Promise<FileSystemDirectoryHandle | undefined> {
    return idbGet<FileSystemDirectoryHandle>(ROOT_KEY).catch(() => undefined);
  }

  async reconnect(handle: FileSystemDirectoryHandle): Promise<boolean> {
    const state = await handle.requestPermission({ mode: 'readwrite' });
    if (state !== 'granted') return false;
    await this.use(handle);
    return true;
  }

  async dir(path: string, create = false): Promise<FileSystemDirectoryHandle> {
    if (!this.root) throw new Error('No folder opened');
    let handle = this.root;
    for (const part of joinPath(path).split('/').filter(Boolean)) {
      handle = await handle.getDirectoryHandle(part, { create });
    }
    return handle;
  }

  async list(path: string): Promise<Entry[]> {
    const dir = await this.dir(path);
    const entries: Entry[] = [];
    for await (const [name, handle] of dir.entries()) {
      entries.push({ name, kind: handle.kind, path: joinPath(path, name) });
    }
    return entries.sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.kind === 'directory' ? -1 : 1,
    );
  }

  async read(path: string): Promise<File> {
    const dir = await this.dir(dirname(path));
    return (await dir.getFileHandle(basename(path))).getFile();
  }

  async exists(path: string): Promise<boolean> {
    try {
      const dir = await this.dir(dirname(path));
      await dir.getFileHandle(basename(path));
      return true;
    } catch {
      return false;
    }
  }

  /** Writes into folderPath (created if needed) under a free name; returns the final path. */
  async write(folderPath: string, name: string, data: Blob | string): Promise<string> {
    const dir = await this.dir(folderPath, true);
    const taken = new Set<string>();
    for await (const key of dir.keys()) taken.add(key);
    const finalName = uniqueName(name, (n) => taken.has(n));
    await writeHandle(await dir.getFileHandle(finalName, { create: true }), data);
    this.changed();
    return joinPath(folderPath, finalName);
  }

  async remove(path: string): Promise<void> {
    const dir = await this.dir(dirname(path));
    await dir.removeEntry(basename(path));
    this.changed();
  }

  async move(path: string, folderPath: string, newName = basename(path)): Promise<string> {
    const file = await this.read(path);
    const target = await this.write(folderPath, newName, file);
    await this.remove(path);
    return target;
  }

  async rename(path: string, newName: string): Promise<string> {
    return this.move(path, dirname(path), newName);
  }
}

export async function writeHandle(handle: FileSystemFileHandle, data: Blob | string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

/** Copies into a folder outside the workspace (Send to, To folder). */
export async function copyInto(dir: FileSystemDirectoryHandle, file: File): Promise<string> {
  const taken = new Set<string>();
  for await (const key of dir.keys()) taken.add(key);
  const name = uniqueName(file.name, (n) => taken.has(n));
  await writeHandle(await dir.getFileHandle(name, { create: true }), file);
  return `${dir.name}/${name}`;
}
