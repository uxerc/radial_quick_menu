import type { WheelController } from '../wheel/controller';
import { matches } from './hotkeys';
import type { Combo } from './hotkeys';

export interface InputHooks {
  onOpen?: (x: number, y: number) => void;
  onClosed?: () => void;
}

/** Browser stand-in for the native trigger: Configured hotkeys or Alt+right-click open at the cursor. */
export function bindInput(
  controller: WheelController,
  run: (item: NonNullable<ReturnType<WheelController['commit']>['item']>) => void,
  hooks: InputHooks = {},
  hotkeys: () => Combo[] = () => [],
): { openAt: (x: number, y: number, shift: boolean) => void } {
  let last = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
  const openAt = (x: number, y: number, shift: boolean) => {
    hooks.onOpen?.(x, y);
    controller.open(x, y, viewport(), shift);
  };
  const close = () => {
    controller.close();
    hooks.onClosed?.();
  };

  window.addEventListener('pointermove', (e) => {
    last = { x: e.clientX, y: e.clientY };
    controller.pointerMove(e.clientX, e.clientY);
  });

  window.addEventListener(
    'contextmenu',
    (e) => {
      if (controller.isWheelOpen) {
        e.preventDefault();
        close();
      } else if (e.altKey) {
        e.preventDefault();
        openAt(e.clientX, e.clientY, e.shiftKey);
      }
    },
    true,
  );

  window.addEventListener(
    'pointerdown',
    (e) => {
      if (!controller.isWheelOpen) return;
      e.preventDefault();
      if (e.button !== 0) return close();
      const { item, close: shouldClose } = controller.commit();
      if (item) run(item);
      if (shouldClose) close();
    },
    true,
  );

  window.addEventListener(
    'keydown',
    (e) => {
      if (!controller.isWheelOpen) {
        if (hotkeys().some((combo) => matches(combo, e))) {
          e.preventDefault();
          openAt(last.x, last.y, e.shiftKey);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Shift') {
        controller.setShift(true);
      } else if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        controller.toggleLatch();
      }
    },
    true,
  );

  window.addEventListener(
    'keyup',
    (e) => {
      if (e.key === 'Shift') controller.setShift(false);
    },
    true,
  );

  window.addEventListener('blur', close);

  return { openAt };
}
