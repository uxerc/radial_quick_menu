import type { WheelController } from '../wheel/controller';

export interface InputHooks {
  onClosed?: () => void;
}

/** Browser stand-in for the native trigger: Ctrl+Alt+Space or Alt+right-click opens at the cursor. */
export function bindInput(
  controller: WheelController,
  run: (item: NonNullable<ReturnType<WheelController['commit']>['item']>) => void,
  hooks: InputHooks = {},
): { openAt: (x: number, y: number, shift: boolean) => void } {
  let last = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
  const openAt = (x: number, y: number, shift: boolean) => controller.open(x, y, viewport(), shift);
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
        if (e.ctrlKey && e.altKey && e.code === 'Space') {
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
