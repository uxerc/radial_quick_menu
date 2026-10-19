import { summarize } from '../app/usage';
import type { UsageLog } from '../app/usage';

const pct = (part: number, whole: number) => (whole === 0 ? '0%' : `${Math.round((part / whole) * 100)}%`);

export function mountUsage(root: HTMLElement, usage: UsageLog): void {
  const render = () => {
    const s = summarize(usage.all);
    root.replaceChildren();

    const totals = document.createElement('div');
    totals.className = 'hint';
    const reasons = Object.entries(s.cancelReasons).map(([r, n]) => `${r} ${n}`).join(', ');
    totals.textContent =
      `${s.opens} opens (Alt+right ${s.byTrigger['alt-right']}, hotkey ${s.byTrigger.hotkey}) · ` +
      `${s.commits} picks, median ${s.medianMs} ms · cancelled ${pct(s.cancels, s.opens)}${reasons ? ` (${reasons})` : ''} · ` +
      `release ${s.byMethod.release}, click ${s.byMethod.click}, keys ${s.byMethod.keys} · layer B ${pct(s.layerB, s.commits)}`;
    root.append(totals);

    if (s.items.length > 0) {
      const table = document.createElement('table');
      table.className = 'usage';
      table.dataset.testid = 'usage-table';
      table.innerHTML = '<thead><tr><th>Item</th><th>Picks</th><th>Median</th><th>Failed</th></tr></thead>';
      const body = document.createElement('tbody');
      for (const item of s.items.slice(0, 15)) {
        const row = document.createElement('tr');
        for (const value of [item.label, String(item.count), `${item.medianMs} ms`, String(item.failed)]) {
          const cell = document.createElement('td');
          cell.textContent = value;
          row.append(cell);
        }
        body.append(row);
      }
      table.append(body);
      root.append(table);
    }

    const actions = document.createElement('div');
    actions.className = 'row';
    const exportButton = document.createElement('button');
    exportButton.textContent = 'Export JSON';
    exportButton.dataset.testid = 'usage-export';
    exportButton.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ summary: s, events: usage.all }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `wheel-usage-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear';
    clearButton.dataset.testid = 'usage-clear';
    clearButton.addEventListener('click', () => {
      if (window.confirm('Delete all usage data?')) usage.clear();
    });
    actions.append(exportButton, clearButton);
    root.append(actions);
  };
  usage.subscribe(render);
  render();
}
