import './styles.css';
import { Filing } from './actions/filing';
import { BrowserActions } from './actions/index';
import type { PasteTarget } from './actions/deps';
import { RecentSaves } from './actions/recent';
import { loadHotkeyTexts, parseAll } from './app/hotkeys';
import { bindInput } from './app/input';
import { ContextStore } from './app/store';
import { mountSidePanel } from './dev/panel';
import { Explorer } from './explorer/explorer';
import { Workspace } from './fs/workspace';
import { closeOverlay, isTauri, onWheelOpen } from './platform/tauri';
import { toast } from './ui/toast';
import { WheelController } from './wheel/controller';
import { renderWheel } from './wheel/render';

const svg = document.querySelector<SVGSVGElement>('#wheel')!;
const controller = new WheelController();
const store = new ContextStore();
const workspace = new Workspace();
const recent = new RecentSaves(() => workspace.name);
const filing = new Filing(workspace, recent);

store.subscribe((ctx) => controller.setContext(ctx));
recent.subscribe((saves) => store.setRecentSaves(saves));
controller.subscribe(() => renderWheel(svg, controller.view()));

let hotkeys = parseAll(loadHotkeyTexts());
const panel = mountSidePanel(document.querySelector<HTMLElement>('#side')!, store, filing, (texts) => {
  hotkeys = parseAll(texts);
});
const explorer = new Explorer(document.querySelector<HTMLElement>('#explorer')!, workspace, store);

let target: PasteTarget = { kind: 'folder' };
const actions = new BrowserActions({ workspace, explorer, store, recent, filing, target: () => target });

const input = bindInput(
  controller,
  (item) => {
    // Called synchronously from the click, so pickers and screen capture keep the user gesture.
    void actions
      .run(item.action)
      .then((result) => {
        panel.log(`${result.ok ? '✓' : '✗'} ${item.fullLabel}: ${result.message}`);
        if (!result.ok) toast(result.message, undefined, 'error');
      })
      .catch((error: unknown) => {
        panel.log(`✗ ${item.action.id}: ${String(error)}`);
        toast(String(error), undefined, 'error');
      });
  },
  {
    onOpen: (x, y) => {
      const under = document.elementFromPoint(x, y);
      target = under === panel.pasteTarget ? { kind: 'text', element: panel.pasteTarget } : { kind: 'folder' };
    },
    onClosed: isTauri ? closeOverlay : undefined,
  },
  () => hotkeys,
);

if (isTauri) onWheelOpen(({ x, y, shift }) => input.openAt(x, y, shift));
