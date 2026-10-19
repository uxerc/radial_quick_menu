import type { ContextStore } from '../app/store';
import type { Explorer } from '../explorer/explorer';
import type { Workspace } from '../fs/workspace';
import type { ActionResult } from '../wheel/types';
import type { Filing } from './filing';
import type { RecentSaves } from './recent';

/** Where the wheel was opened: over the paste box it inserts text, anywhere else it acts on the folder. */
export type PasteTarget = { kind: 'text'; element: HTMLTextAreaElement } | { kind: 'folder' };

export interface ActionDeps {
  workspace: Workspace;
  explorer: Explorer;
  store: ContextStore;
  recent: RecentSaves;
  filing: Filing;
  target: () => PasteTarget;
}

export const ok = (message: string): ActionResult => ({ ok: true, message });
export const fail = (message: string): ActionResult => ({ ok: false, message });

export const NO_FOLDER = fail('Open a folder first');

export function stub(reason: string): ActionResult {
  return fail(`Stub in v1: ${reason}`);
}

export function timestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}.${pad(date.getMinutes())}.${pad(date.getSeconds())}`;
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError');
}
