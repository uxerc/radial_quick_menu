import { basename, dirname } from '../fs/paths';
import { copyInto } from '../fs/workspace';
import type { ActionResult, RecentSave } from '../wheel/types';
import { NO_FOLDER, fail, isAbort, ok } from './deps';
import type { ActionDeps } from './deps';

export async function openRecent(deps: ActionDeps, save: RecentSave): Promise<ActionResult> {
  if (!deps.workspace.isOpen) return NO_FOLDER;
  if (!(await deps.workspace.exists(save.path))) {
    deps.recent.remove(save.id);
    return fail(`${save.file} no longer exists`);
  }
  await deps.explorer.navigate(dirname(save.path), [save.path]);
  return ok(`Showing ${save.path}`);
}

/** Picker starts in the workspace; a folder inside it becomes a move, one outside becomes a copy + delete. */
async function pickFolder(deps: ActionDeps): Promise<{ inside: string } | { outside: FileSystemDirectoryHandle }> {
  const root = await deps.workspace.dir('');
  const picked = await window.showDirectoryPicker({ id: 'move-to', mode: 'readwrite', startIn: root });
  const parts = await root.resolve(picked);
  return parts ? { inside: parts.join('/') } : { outside: picked };
}

export async function fixRecent(deps: ActionDeps, id: string): Promise<ActionResult> {
  const save = deps.recent.latest;
  if (!save) return fail('No recent saves');
  if (!deps.workspace.isOpen) return NO_FOLDER;
  if (id !== 'moveTo' && !(await deps.workspace.exists(save.path))) {
    deps.recent.remove(save.id);
    return fail(`${save.file} no longer exists`);
  }

  try {
    switch (id) {
      case 'undo': {
        if (save.origin.kind === 'moved') {
          const back = await deps.workspace.move(save.path, dirname(save.origin.from), basename(save.origin.from));
          deps.recent.remove(save.id);
          await deps.explorer.navigate(dirname(back), [back]);
          return ok(`Moved back to ${back}`);
        }
        await deps.workspace.remove(save.path);
        deps.recent.remove(save.id);
        return ok(`Deleted ${save.path}`);
      }
      case 'moveTo': {
        const destination = await pickFolder(deps);
        if (!(await deps.workspace.exists(save.path))) return fail(`${save.file} no longer exists`);
        if ('outside' in destination) {
          const written = await copyInto(destination.outside, await deps.workspace.read(save.path));
          await deps.workspace.remove(save.path);
          deps.recent.remove(save.id);
          return ok(`Moved out of the workspace to ${written} (not undoable)`);
        }
        if (destination.inside === dirname(save.path)) return fail('Already in that folder');
        const moved = await deps.workspace.move(save.path, destination.inside);
        deps.recent.remove(save.id);
        deps.recent.add(moved, { kind: 'moved', from: save.path }, save.signals);
        deps.filing.recordCorrection(save, destination.inside);
        await deps.explorer.navigate(dirname(moved), [moved]);
        return ok(`Moved to ${moved}`);
      }
      case 'rename': {
        const name = window.prompt('Rename to', save.file)?.trim();
        if (!name || name === save.file) return fail('Rename cancelled');
        const renamed = await deps.workspace.rename(save.path, name);
        deps.recent.relocate(save.id, renamed);
        await deps.explorer.navigate(dirname(renamed), [renamed]);
        return ok(`Renamed to ${basename(renamed)}`);
      }
      case 'openFolder':
        return openRecent(deps, save);
      default:
        return fail(`fixRecent.${id}: unknown`);
    }
  } catch (error) {
    return isAbort(error) ? fail('Cancelled') : fail(error instanceof Error ? error.message : String(error));
  }
}
