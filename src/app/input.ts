import type { WheelController } from '../wheel/controller';
import type { WheelItem } from '../wheel/types';
import { matches } from './hotkeys';
import type { Combo } from './hotkeys';
import type { CancelReason, CommitMethod, Trigger } from './usage';

export interface InputHooks {
  onOpen?: (x: number, y: number, trigger: Trigger) => void;
  onCommit?: (item: WheelItem, method: CommitMethod, ms: number) => void;
  onCancel?: (reason: CancelReason, ms: number, trigger: Trigger) => void;
  onClosed?: () => void;
}

/** Held trigger: release over a child commits (marking-menu style); release without picking leaves the wheel open for clicking. */
type Hold = { kind: 'button' } | { kind: 'key'; code: string } | null;

const DIGIT = /^(?:Digit|Numpad)([1-9])$/;

/**
 * Browser stand-in for the native trigger: hotkeys or Alt+right-click open at the cursor.
 * Number keys use e.code so they work the same on every keyboard layout.
 */
export function bindInput(
  controller: WheelController,
  run: (item: WheelItem) => void,
  hooks: InputHooks = {},
  hotkeys: () => Combo[] = () => [],
): { openAt: (x: number, y: number, shift: boolean, trigger?: Trigger) => void } {
  let last = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let hold: Hold = null;
  let trigger: Trigger = 'hotkey';
  let openedAt = 0;
  // A hotkey that contains Shift must not count as "Shift held" for layer B until Shift is let go once.
  let ignoreShift = false;
  // Windows fires contextmenu after the right button goes up, Linux/macOS on the way down.
  let swallowContextMenuUntil = 0;

  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
  const elapsed = () => Math.round(performance.now() - openedAt);

  const openAt = (x: number, y: number, shift: boolean, how: Trigger = 'hotkey') => {
    trigger = how;
    openedAt = performance.now();
    hooks.onOpen?.(x, y, how);
    controller.open(x, y, viewport(), shift);
  };

  const close = () => {
    hold = null;
    controller.close();
    hooks.onClosed?.();
  };

  const cancel = (reason: CancelReason) => {
    if (!controller.isWheelOpen) return;
    hooks.onCancel?.(reason, elapsed(), trigger);
    close();
  };

  const commit = (item: WheelItem, method: CommitMethod) => {
    hooks.onCommit?.(item, method, elapsed());
    close();
    run(item);
  };

  const release = () => {
    hold = null;
    const { item } = controller.commit();
    if (item) return commit(item, 'release');
    if (controller.hitKind === 'outside') cancel('release');
  };

  window.addEventListener('pointermove', (e) => {
    last = { x: e.clientX, y: e.clientY };
    controller.pointerMove(e.clientX, e.clientY);
  });

  window.addEventListener(
    'contextmenu',
    (e) => {
      if (controller.isWheelOpen || e.altKey || performance.now() < swallowContextMenuUntil) e.preventDefault();
    },
    true,
  );

  window.addEventListener(
    'pointerdown',
    (e) => {
      if (!controller.isWheelOpen) {
        if (e.button === 2 && e.altKey) {
          e.preventDefault();
          swallowContextMenuUntil = performance.now() + 2000;
          hold = { kind: 'button' };
          openAt(e.clientX, e.clientY, e.shiftKey, 'alt-right');
        }
        return;
      }
      e.preventDefault();
      if (e.button !== 0) {
        swallowContextMenuUntil = performance.now() + 2000;
        return cancel('right-click');
      }
      const { item, close: shouldClose } = controller.commit();
      if (item) return commit(item, 'click');
      if (shouldClose) cancel(controller.hitKind === 'cancel' ? 'center' : 'outside');
    },
    true,
  );

  window.addEventListener(
    'pointerup',
    (e) => {
      if (hold?.kind === 'button' && e.button === 2) {
        e.preventDefault();
        release();
      }
    },
    true,
  );

  window.addEventListener(
    'keydown',
    (e) => {
      if (!controller.isWheelOpen) {
        const combo = hotkeys().find((c) => matches(c, e));
        if (combo) {
          e.preventDefault();
          hold = { kind: 'key', code: combo.code };
          ignoreShift = combo.shift;
          openAt(last.x, last.y, combo.shift ? false : e.shiftKey, 'hotkey');
        }
        return;
      }
      const digit = DIGIT.exec(e.code);
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel('escape');
      } else if (e.key === 'Shift') {
        if (!ignoreShift) controller.setShift(true);
      } else if (digit) {
        e.preventDefault();
        const item = controller.pressNumber(Number(digit[1]));
        if (item) commit(item, 'keys');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        controller.back();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const { item } = controller.commit();
        if (item) commit(item, 'keys');
      } else if (e.code === 'Space' && !e.repeat && hold?.kind !== 'key') {
        e.preventDefault();
        controller.toggleLatch();
      } else if (e.code === 'Space') {
        e.preventDefault();
      }
    },
    true,
  );

  window.addEventListener(
    'keyup',
    (e) => {
      if (e.key === 'Shift') {
        ignoreShift = false;
        controller.setShift(false);
      }
      if (hold?.kind === 'key' && e.code === hold.code) {
        e.preventDefault();
        release();
      }
    },
    true,
  );

  window.addEventListener('blur', () => cancel('blur'));

  return { openAt };
}
