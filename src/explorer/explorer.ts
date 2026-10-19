import { File as FileIcon, Folder, FolderOpen, Image as ImageIcon, FileText, createElement } from 'lucide';
import type { IconNode } from 'lucide';
import type { ContextStore } from '../app/store';
import { splitExt } from '../fs/paths';
import type { Entry, Workspace } from '../fs/workspace';
import { toast } from '../ui/toast';

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']);
const TEXT_EXT = new Set(['txt', 'md', 'csv', 'json', 'log', 'pdf', 'url']);

function iconFor(entry: Entry): IconNode {
  if (entry.kind === 'directory') return Folder;
  const ext = splitExt(entry.name).ext.toLowerCase();
  if (IMAGE_EXT.has(ext)) return ImageIcon;
  if (TEXT_EXT.has(ext)) return FileText;
  return FileIcon;
}

/** Minimal file manager over the real workspace folder; its selection is what the wheel acts on. */
export class Explorer {
  private cwd = '';
  private entries: Entry[] = [];
  private selected = new Set<string>();
  private anchor: string | null = null;
  private stored: FileSystemDirectoryHandle | undefined;
  private readonly list: HTMLDivElement;
  private readonly header: HTMLDivElement;

  constructor(
    readonly element: HTMLElement,
    private readonly workspace: Workspace,
    private readonly store: ContextStore,
  ) {
    element.innerHTML = `<div class="ex-header"></div><div class="ex-list" tabindex="0" data-testid="explorer-list"></div>`;
    this.header = element.querySelector('.ex-header')!;
    this.list = element.querySelector('.ex-list')!;
    workspace.subscribe(() => void this.refresh());
    this.bindDrop();
    this.list.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && this.selected.size > 0) store.recordFiles(this.selection);
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        this.select(this.entries.filter((en) => en.kind === 'file').map((en) => en.path));
      }
    });
    this.list.addEventListener('click', (e) => {
      if (e.target === this.list) this.select([]);
    });
    void this.init();
  }

  get currentFolder(): string {
    return this.cwd;
  }

  get selection(): string[] {
    return [...this.selected];
  }

  async navigate(path: string, select: string[] = []): Promise<void> {
    this.cwd = path;
    this.selected = new Set(select);
    await this.refresh();
  }

  select(paths: string[]): void {
    this.selected = new Set(paths);
    this.renderList();
    this.store.setSelection(this.selection);
  }

  async refresh(): Promise<void> {
    this.renderHeader();
    if (!this.workspace.isOpen) {
      this.entries = [];
    } else {
      try {
        this.entries = await this.workspace.list(this.cwd);
      } catch {
        this.cwd = '';
        this.entries = await this.workspace.list('');
      }
    }
    const existing = new Set(this.entries.map((e) => e.path));
    this.selected = new Set([...this.selected].filter((p) => existing.has(p)));
    this.renderList();
    this.store.setSelection(this.selection);
  }

  private async init(): Promise<void> {
    this.stored = await this.workspace.stored();
    if (this.stored && (await this.stored.queryPermission({ mode: 'readwrite' })) === 'granted') {
      await this.workspace.use(this.stored);
    } else {
      this.renderHeader();
      this.renderList();
    }
  }

  private renderHeader(): void {
    this.header.replaceChildren();
    const open = button('Open folder…', 'explorer-open', () => void this.workspace.pick().then(() => this.navigate('')));
    this.header.append(open);
    if (!this.workspace.isOpen && this.stored) {
      const stored = this.stored;
      this.header.append(
        button(`Reconnect “${stored.name}”`, 'explorer-reconnect', () => void this.workspace.reconnect(stored)),
      );
    }
    this.header.append(
      button('Test folder (browser storage)', 'explorer-test-folder', () =>
        void navigator.storage
          .getDirectory()
          .then((h) => this.workspace.use(h))
          .then(() => this.navigate(''))
          .catch(() => toast('Browser storage is unavailable for files opened from disk; use Open folder…', undefined, 'error')),
      ),
    );

    if (!this.workspace.isOpen) return;
    const crumbs = document.createElement('div');
    crumbs.className = 'ex-crumbs';
    const parts = this.cwd.split('/').filter(Boolean);
    const segments = [{ name: this.workspace.name || 'root', path: '' }, ...parts.map((p, i) => ({ name: p, path: parts.slice(0, i + 1).join('/') }))];
    segments.forEach((segment, i) => {
      const link = document.createElement('button');
      link.className = 'ex-crumb';
      link.textContent = segment.name;
      link.addEventListener('click', () => void this.navigate(segment.path));
      if (i > 0) crumbs.append(' › ');
      crumbs.append(link);
    });
    this.header.append(crumbs);
  }

  private renderList(): void {
    this.list.replaceChildren();
    if (!this.workspace.isOpen) {
      const hint = document.createElement('div');
      hint.className = 'ex-empty';
      hint.textContent = 'Open a folder to work on real files. Chrome asks for access once.';
      this.list.append(hint);
      return;
    }
    if (this.entries.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'ex-empty';
      hint.textContent = 'Empty folder. Drop files here from Explorer to copy them in.';
      this.list.append(hint);
    }
    for (const entry of this.entries) {
      const row = document.createElement('div');
      row.className = 'ex-row' + (this.selected.has(entry.path) ? ' selected' : '');
      row.dataset.path = entry.path;
      row.dataset.testid = 'explorer-row';
      const icon = createElement(entry.kind === 'directory' && this.selected.has(entry.path) ? FolderOpen : iconFor(entry));
      icon.setAttribute('class', 'ex-icon');
      const name = document.createElement('span');
      name.textContent = entry.name;
      row.append(icon, name);
      row.addEventListener('click', (e) => this.onRowClick(entry, e));
      row.addEventListener('dblclick', () => void this.onOpen(entry));
      this.list.append(row);
    }
  }

  private onRowClick(entry: Entry, e: MouseEvent): void {
    e.stopPropagation();
    if (entry.kind === 'directory') return this.select([]);
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(this.selected);
      if (next.has(entry.path)) next.delete(entry.path);
      else next.add(entry.path);
      this.anchor = entry.path;
      return this.select([...next]);
    }
    if (e.shiftKey && this.anchor) {
      const files = this.entries.filter((en) => en.kind === 'file').map((en) => en.path);
      const [a, b] = [files.indexOf(this.anchor), files.indexOf(entry.path)].sort((x, y) => x - y);
      if (a !== -1) return this.select(files.slice(a, b + 1));
    }
    this.anchor = entry.path;
    this.select([entry.path]);
  }

  private async onOpen(entry: Entry): Promise<void> {
    if (entry.kind === 'directory') return this.navigate(entry.path);
    const file = await this.workspace.read(entry.path);
    window.open(URL.createObjectURL(file), '_blank');
  }

  private bindDrop(): void {
    this.list.addEventListener('dragover', (e) => {
      if (!this.workspace.isOpen) return;
      e.preventDefault();
      this.list.classList.add('dropping');
    });
    this.list.addEventListener('dragleave', () => this.list.classList.remove('dropping'));
    this.list.addEventListener('drop', (e) => {
      e.preventDefault();
      this.list.classList.remove('dropping');
      const files = [...(e.dataTransfer?.files ?? [])];
      void Promise.all(files.map((f) => this.workspace.write(this.cwd, f.name, f))).then((paths) => this.navigate(this.cwd, paths));
    });
  }
}

function button(label: string, testId: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.textContent = label;
  el.dataset.testid = testId;
  el.addEventListener('click', onClick);
  return el;
}

