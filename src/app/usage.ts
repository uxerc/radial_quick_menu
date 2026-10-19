import type { Layer } from '../wheel/types';

export type Trigger = 'alt-right' | 'hotkey';
export type CommitMethod = 'click' | 'release' | 'keys';
export type CancelReason = 'escape' | 'right-click' | 'outside' | 'center' | 'blur' | 'release';

export type UsageEvent =
  | { t: number; type: 'commit'; item: string; label: string; layer: Layer; method: CommitMethod; ms: number; ok?: boolean }
  | { t: number; type: 'cancel'; reason: CancelReason; ms: number; trigger: Trigger }
  | { t: number; type: 'open'; trigger: Trigger };

export interface ItemStats {
  item: string;
  label: string;
  count: number;
  medianMs: number;
  failed: number;
  methods: Record<CommitMethod, number>;
}

export interface UsageSummary {
  opens: number;
  commits: number;
  cancels: number;
  layerB: number;
  byTrigger: Record<Trigger, number>;
  byMethod: Record<CommitMethod, number>;
  cancelReasons: Partial<Record<CancelReason, number>>;
  medianMs: number;
  items: ItemStats[];
}

const KEY = 'radial-file-wheel.usage';
const LIMIT = 5000;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

export function summarize(events: UsageEvent[]): UsageSummary {
  const summary: UsageSummary = {
    opens: 0,
    commits: 0,
    cancels: 0,
    layerB: 0,
    byTrigger: { 'alt-right': 0, hotkey: 0 },
    byMethod: { click: 0, release: 0, keys: 0 },
    cancelReasons: {},
    medianMs: 0,
    items: [],
  };
  const items = new Map<string, { label: string; ms: number[]; failed: number; methods: Record<CommitMethod, number> }>();
  const commitMs: number[] = [];

  for (const e of events) {
    if (e.type === 'open') {
      summary.opens++;
      summary.byTrigger[e.trigger]++;
    } else if (e.type === 'cancel') {
      summary.cancels++;
      summary.cancelReasons[e.reason] = (summary.cancelReasons[e.reason] ?? 0) + 1;
    } else {
      summary.commits++;
      summary.byMethod[e.method]++;
      if (e.layer === 'B') summary.layerB++;
      commitMs.push(e.ms);
      const entry = items.get(e.item) ?? { label: e.label, ms: [], failed: 0, methods: { click: 0, release: 0, keys: 0 } };
      entry.ms.push(e.ms);
      entry.methods[e.method]++;
      if (e.ok === false) entry.failed++;
      items.set(e.item, entry);
    }
  }

  summary.medianMs = median(commitMs);
  summary.items = [...items.entries()]
    .map(([item, v]) => ({ item, label: v.label, count: v.ms.length, medianMs: median(v.ms), failed: v.failed, methods: v.methods }))
    .sort((a, b) => b.count - a.count);
  return summary;
}

/** Local only (localStorage); the spec rules out telemetry. Export is a manual download. */
export class UsageLog {
  private events: UsageEvent[] = load();
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): void {
    this.listeners.add(listener);
  }

  get all(): UsageEvent[] {
    return this.events;
  }

  record(event: UsageEvent): void {
    this.events = [...this.events, event].slice(-LIMIT);
    this.persist();
  }

  /** Action results arrive after the commit was logged. */
  markLastCommit(ok: boolean): void {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      if (e.type === 'commit') {
        this.events[i] = { ...e, ok };
        this.persist();
        return;
      }
    }
  }

  clear(): void {
    this.events = [];
    this.persist();
  }

  private persist(): void {
    localStorage.setItem(KEY, JSON.stringify(this.events));
    for (const listener of this.listeners) listener();
  }
}

function load(): UsageEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as UsageEvent[];
  } catch {
    return [];
  }
}
