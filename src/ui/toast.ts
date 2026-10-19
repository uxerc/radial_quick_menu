export interface ToastAction {
  label: string;
  run: () => void;
}

const VISIBLE_MS = 5000;

export function toast(message: string, action?: ToastAction, tone: 'ok' | 'error' = 'ok'): void {
  let host = document.querySelector<HTMLDivElement>('#toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    document.body.append(host);
  }
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.textContent = message;
  if (action) {
    const button = document.createElement('button');
    button.textContent = action.label;
    button.dataset.testid = 'toast-action';
    button.addEventListener('click', () => {
      action.run();
      el.remove();
    });
    el.append(button);
  }
  host.append(el);
  setTimeout(() => el.remove(), action ? VISIBLE_MS * 2 : VISIBLE_MS);
}
