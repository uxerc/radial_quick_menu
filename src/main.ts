import './styles.css';
import { loadHotkeyTexts, parseAll } from './app/hotkeys';
import { bindInput } from './app/input';
import { ContextStore } from './app/store';
import { mountDevPanel } from './dev/panel';
import { BrowserAdapter } from './platform/browser';
import { closeOverlay, isTauri, onWheelOpen } from './platform/tauri';
import { WheelController } from './wheel/controller';
import { renderWheel } from './wheel/render';

const svg = document.querySelector<SVGSVGElement>('#wheel')!;
const controller = new WheelController();
const store = new ContextStore();
store.subscribe((ctx) => controller.setContext(ctx));
controller.subscribe(() => renderWheel(svg, controller.view()));

let hotkeys = parseAll(loadHotkeyTexts());
let log = (message: string): void => console.info(message);
let pasteTarget = (): HTMLTextAreaElement | null => null;

if (!isTauri) {
  document.body.classList.add('dev');
  const panel = mountDevPanel(document.querySelector<HTMLElement>('#dev')!, store, (texts) => {
    hotkeys = parseAll(texts);
  });
  log = panel.log;
  pasteTarget = panel.pasteTarget;
}

const adapter = new BrowserAdapter(pasteTarget);

const input = bindInput(
  controller,
  (item) => {
    void adapter
      .run(item.action)
      .then((result) => log(`${result.ok ? '✓' : '✗'} ${result.message}`))
      .catch((error: unknown) => log(`✗ ${item.action.id}: ${String(error)}`));
  },
  { onClosed: isTauri ? closeOverlay : undefined },
  () => hotkeys,
);

if (isTauri) {
  onWheelOpen(({ x, y, shift }) => input.openAt(x, y, shift));
} else {
  document.querySelector<HTMLButtonElement>('#dev-open')?.addEventListener('click', () => {
    input.openAt(window.innerWidth / 2 + 180, window.innerHeight / 2, false);
  });
}
