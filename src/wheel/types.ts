import type { IconNode } from 'lucide';

export type Layer = 'A' | 'B';

export interface ClipItem {
  id: string;
  kind: 'text' | 'url' | 'image' | 'file';
  /** Display text; for files the workspace path. */
  text: string;
  blob?: Blob;
}

export interface CaptureSignals {
  title: string;
  app: string;
}

export interface RecentSave {
  id: string;
  path: string;
  /** Destination folder name, shown as the wheel label. */
  folder: string;
  file: string;
  origin: { kind: 'created' } | { kind: 'moved'; from: string };
  signals?: CaptureSignals;
}

export interface WheelContext {
  selection: string[];
  clipboard: ClipItem[];
  pinned: ClipItem[];
  recentSaves: RecentSave[];
}

export interface WheelAction {
  id: string;
  payload?: unknown;
}

export interface WheelItem {
  id: string;
  label: string;
  fullLabel: string;
  icon: IconNode;
  action: WheelAction;
}

export interface WheelSlot {
  index: number;
  label: string;
  icon: IconNode;
  children: WheelItem[];
  disabledReason: string | null;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface PlatformAdapter {
  run(action: WheelAction): Promise<ActionResult>;
}
