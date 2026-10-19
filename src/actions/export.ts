import { idbGet, idbSet } from '../fs/idb';
import { basename, dirname, splitExt } from '../fs/paths';
import { copyInto, writeHandle } from '../fs/workspace';
import type { ActionResult } from '../wheel/types';
import { fail, isAbort, ok, stub } from './deps';
import type { ActionDeps } from './deps';
import { encodeImage, kindOf, loadImage } from './convert';

const DESKTOP_KEY = 'send-to-desktop';

async function files(deps: ActionDeps): Promise<File[]> {
  return Promise.all(deps.explorer.selection.map((p) => deps.workspace.read(p)));
}

async function guarded(run: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await run();
  } catch (error) {
    return isAbort(error) ? fail('Cancelled') : fail(error instanceof Error ? error.message : String(error));
  }
}

/** Pickers need the click's user activation, so they open before any file is read. */
async function copyToPicked(deps: ActionDeps, id: string, startIn?: WellKnownDirectory): Promise<ActionResult> {
  const dir = await window.showDirectoryPicker({ id, mode: 'readwrite', ...(startIn ? { startIn } : {}) });
  const written = await Promise.all((await files(deps)).map((f) => copyInto(dir, f)));
  return ok(`Copied to ${written.join(', ')}`);
}

async function grantedDesktop(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await idbGet<FileSystemDirectoryHandle>(DESKTOP_KEY).catch(() => undefined);
  if (!handle) return null;
  const state = await handle.requestPermission({ mode: 'readwrite' });
  return state === 'granted' ? handle : null;
}

export function exportAction(deps: ActionDeps, id: string): Promise<ActionResult> {
  return guarded(async () => {
    switch (id) {
      case 'saveAs': {
        const [first] = deps.explorer.selection;
        if (deps.explorer.selection.length > 1) return copyToPicked(deps, 'export-folder');
        const handle = await window.showSaveFilePicker({ id: 'save-as', suggestedName: basename(first) });
        await writeHandle(handle, await deps.workspace.read(first));
        return ok(`Saved as ${handle.name}`);
      }
      case 'toFolder':
        return copyToPicked(deps, 'export-folder');
      case 'shareLink':
        return stub('share links need a cloud upload service');
      case 'share': {
        const shared = await files(deps);
        if (!navigator.canShare?.({ files: shared })) return fail('This browser cannot share these files');
        await navigator.share({ files: shared });
        return ok(`Shared ${shared.length} file(s)`);
      }
      default:
        return fail(`export.${id}: unknown`);
    }
  });
}

export function sendToAction(deps: ActionDeps, id: string): Promise<ActionResult> {
  return guarded(async () => {
    switch (id) {
      case 'desktop': {
        // Browsers can't resolve the Desktop path; the user confirms it once and the handle is remembered.
        let dir = await grantedDesktop();
        if (!dir) {
          dir = await window.showDirectoryPicker({ id: 'desktop', mode: 'readwrite', startIn: 'desktop' });
          await idbSet(DESKTOP_KEY, dir);
        }
        const target = dir;
        const written = await Promise.all((await files(deps)).map((f) => copyInto(target, f)));
        return ok(`Sent to ${written.join(', ')}`);
      }
      case 'folder':
        return copyToPicked(deps, 'send-to');
      case 'slack':
        return stub('Slack needs an integration');
      case 'email':
        return stub('email with attachments needs the native build (mailto cannot attach files)');
      default:
        return fail(`sendTo.${id}: unknown`);
    }
  });
}

/** Re-encodes images at lower quality beside the original; PNGs become WebP since PNG has no quality knob. */
async function compress(deps: ActionDeps): Promise<ActionResult> {
  const created: string[] = [];
  const skipped: string[] = [];
  for (const path of deps.explorer.selection) {
    const file = await deps.workspace.read(path);
    if (kindOf(file.name) !== 'image') {
      skipped.push(basename(path));
      continue;
    }
    const ext = splitExt(file.name).ext.toLowerCase();
    const format = ext === 'jpg' || ext === 'jpeg' ? 'jpg' : 'webp';
    const blob = await encodeImage(await loadImage(file), format, 0.7);
    const name = `${splitExt(file.name).stem} (compressed).${format}`;
    const written = await deps.workspace.write(dirname(path), name, blob);
    deps.recent.add(written);
    created.push(`${basename(written)} ${Math.round((1 - blob.size / file.size) * 100)}% smaller`);
  }
  if (created.length > 0) await deps.explorer.refresh();
  if (created.length === 0) return fail(`Only images can be compressed (skipped ${skipped.join(', ')})`);
  return ok(`Created ${created.join(', ')}${skipped.length ? `; skipped ${skipped.join(', ')}` : ''}`);
}

export function editAction(deps: ActionDeps, id: string): Promise<ActionResult> {
  if (id === 'compress') return guarded(() => compress(deps));
  return Promise.resolve(stub(`${id} opens an editor that is not built yet`));
}
