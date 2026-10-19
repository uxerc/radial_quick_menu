import type { ActionResult, ClipItem, PlatformAdapter, RecentSave, WheelAction } from '../wheel/types';
import { capture } from './capture';
import { convert } from './convert';
import type { Format } from './convert';
import { NO_FOLDER, fail, stub } from './deps';
import type { ActionDeps } from './deps';
import { editAction, exportAction, sendToAction } from './export';
import { fixRecent, openRecent } from './fixRecent';
import { pasteAction, pasteItem } from './paste';

const PASTE_MODES = {
  'paste.default': 'default',
  'paste.matchStyle': 'plain',
  'paste.asLink': 'link',
  'pasteAs.plain': 'plain',
  'pasteAs.png': 'png',
  'pasteAs.link': 'link',
  'pasteAs.file': 'file',
} as const;

const NEEDS_FILES = new Set(['convert', 'export', 'sendTo', 'edit']);

/** Real browser implementations of the wheel's actions, on files in the opened folder. */
export class BrowserActions implements PlatformAdapter {
  constructor(private readonly deps: ActionDeps) {}

  run(action: WheelAction): Promise<ActionResult> {
    const [group, id] = action.id.split('.');
    if (NEEDS_FILES.has(group) && !this.deps.workspace.isOpen) return Promise.resolve(NO_FOLDER);
    if (action.id in PASTE_MODES) return pasteAction(this.deps, PASTE_MODES[action.id as keyof typeof PASTE_MODES]);

    switch (group) {
      case 'clipboard':
      case 'pinned':
        return pasteItem(this.deps, action.payload as ClipItem);
      case 'convert':
        return convert(this.deps, id as Format);
      case 'export':
        return exportAction(this.deps, id);
      case 'sendTo':
        return sendToAction(this.deps, id);
      case 'edit':
        return editAction(this.deps, id);
      case 'recent':
        return openRecent(this.deps, action.payload as RecentSave);
      case 'fixRecent':
        return fixRecent(this.deps, id);
      case 'capture':
        return this.capture(id);
      case 'capturePlus':
        return this.capturePlus(id);
      default:
        return Promise.resolve(fail(`${action.id}: unknown action`));
    }
  }

  private capture(id: string): Promise<ActionResult> {
    switch (id) {
      case 'area':
        return capture(this.deps, { surface: 'monitor', area: true });
      case 'window':
        return capture(this.deps, { surface: 'window' });
      case 'screen':
        return capture(this.deps, { surface: 'monitor' });
      case 'timer':
        return capture(this.deps, { surface: 'monitor', delaySeconds: 10 });
      default:
        return Promise.resolve(fail(`capture.${id}: unknown`));
    }
  }

  private capturePlus(id: string): Promise<ActionResult> {
    switch (id) {
      case 'delay3':
        return capture(this.deps, { surface: 'monitor', delaySeconds: 3 });
      case 'delay5':
        return capture(this.deps, { surface: 'monitor', delaySeconds: 5 });
      case 'fullPage':
        return Promise.resolve(stub('full-page capture needs the browser extension (milestone 7)'));
      case 'record':
        return Promise.resolve(stub('screen recording is planned after v1'));
      default:
        return Promise.resolve(fail(`capturePlus.${id}: unknown`));
    }
  }
}
