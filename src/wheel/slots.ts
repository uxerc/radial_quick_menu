import {
  Aperture,
  Camera,
  ClipboardPaste,
  ClipboardType,
  Clipboard,
  Crop,
  EyeOff,
  FileImage,
  FileText,
  FolderInput,
  FolderOpen,
  FolderSearch,
  History,
  Highlighter,
  Hourglass,
  Link,
  Mail,
  MessageSquare,
  Minimize2,
  Monitor,
  Pencil,
  Pin,
  RefreshCw,
  Save,
  Scan,
  Send,
  Share2,
  Timer,
  Type,
  Undo2,
  Upload,
  Video,
  AppWindow,
  File,
  Globe,
  TextCursorInput,
  CornerUpRight,
  Image as ImageIcon,
} from 'lucide';
import type { IconNode } from 'lucide';
import { GEOMETRY } from './geometry';
import type { ClipItem, Layer, WheelContext, WheelItem, WheelSlot } from './types';

interface StaticItem {
  id: string;
  label: string;
  icon: IconNode;
}

const MAX_LABEL = 10;

export function truncate(text: string, max = MAX_LABEL): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function items(prefix: string, defs: StaticItem[]): WheelItem[] {
  return defs.map((d) => ({
    id: `${prefix}.${d.id}`,
    label: truncate(d.label),
    fullLabel: d.label,
    icon: d.icon,
    action: { id: `${prefix}.${d.id}` },
  }));
}

function clipItems(prefix: string, list: ClipItem[]): WheelItem[] {
  return list.slice(0, GEOMETRY.maxChildren).map((c) => ({
    id: `${prefix}.${c.id}`,
    label: truncate(c.text),
    fullLabel: c.text,
    icon: c.kind === 'url' ? Globe : TextCursorInput,
    action: { id: prefix, payload: c },
  }));
}

const NEEDS_SELECTION = 'Needs a file selection';
const NEEDS_CLIPBOARD = 'Clipboard is empty';
const NEEDS_RECENT = 'No recent saves';

type SlotBuilder = (ctx: WheelContext, index: number) => WheelSlot;

function slot(
  index: number,
  label: string,
  icon: IconNode,
  children: WheelItem[],
  disabledReason: string | null,
): WheelSlot {
  return { index, label, icon, children, disabledReason };
}

const selection = (ctx: WheelContext) => (ctx.selection.length === 0 ? NEEDS_SELECTION : null);
const clipboard = (ctx: WheelContext) => (ctx.clipboard.length === 0 ? NEEDS_CLIPBOARD : null);
const recent = (ctx: WheelContext) => (ctx.recentSaves.length === 0 ? NEEDS_RECENT : null);

const LAYER_A: SlotBuilder[] = [
  (ctx, i) =>
    slot(i, 'Clipboard', Clipboard, clipItems('clipboard.paste', ctx.clipboard), clipboard(ctx)),
  (_, i) =>
    slot(
      i,
      'Paste',
      ClipboardPaste,
      items('paste', [
        { id: 'default', label: 'Paste', icon: ClipboardPaste },
        { id: 'matchStyle', label: 'Match style', icon: Type },
        { id: 'asLink', label: 'As link', icon: Link },
      ]),
      null,
    ),
  (ctx, i) =>
    slot(
      i,
      'Export',
      Upload,
      items('export', [
        { id: 'saveAs', label: 'Save as', icon: Save },
        { id: 'toFolder', label: 'To folder', icon: FolderInput },
        { id: 'shareLink', label: 'Share link', icon: Link },
        { id: 'share', label: 'Share', icon: Share2 },
      ]),
      selection(ctx),
    ),
  (ctx, i) =>
    slot(
      i,
      'Convert',
      RefreshCw,
      items('convert', [
        { id: 'png', label: 'PNG', icon: ImageIcon },
        { id: 'jpg', label: 'JPG', icon: FileImage },
        { id: 'webp', label: 'WEBP', icon: FileImage },
        { id: 'pdf', label: 'PDF', icon: File },
        { id: 'txt', label: 'TXT', icon: FileText },
      ]),
      selection(ctx),
    ),
  (ctx, i) =>
    slot(
      i,
      'Recent',
      History,
      ctx.recentSaves.slice(0, GEOMETRY.maxChildren).map((r) => ({
        id: `recent.open.${r.id}`,
        label: truncate(r.folder),
        fullLabel: `${r.folder}/${r.file}`,
        icon: FolderOpen,
        action: { id: 'recent.open', payload: r },
      })),
      recent(ctx),
    ),
  (_, i) =>
    slot(
      i,
      'Capture',
      Camera,
      items('capture', [
        { id: 'area', label: 'Area', icon: Scan },
        { id: 'window', label: 'Window', icon: AppWindow },
        { id: 'screen', label: 'Screen', icon: Monitor },
        { id: 'timer', label: 'Timer', icon: Timer },
      ]),
      null,
    ),
];

const LAYER_B: SlotBuilder[] = [
  (ctx, i) =>
    slot(
      i,
      'Pinned',
      Pin,
      clipItems('pinned.paste', ctx.pinned),
      ctx.pinned.length === 0 ? 'Nothing pinned' : null,
    ),
  (ctx, i) =>
    slot(
      i,
      'Paste as',
      ClipboardType,
      items('pasteAs', [
        { id: 'plain', label: 'Plain text', icon: Type },
        { id: 'png', label: 'PNG', icon: ImageIcon },
        { id: 'link', label: 'Link', icon: Link },
        { id: 'file', label: 'File', icon: File },
      ]),
      clipboard(ctx),
    ),
  (ctx, i) =>
    slot(
      i,
      'Send to',
      Send,
      items('sendTo', [
        { id: 'desktop', label: 'Desktop', icon: Monitor },
        { id: 'folder', label: 'Folder…', icon: FolderSearch },
        { id: 'slack', label: 'Slack', icon: MessageSquare },
        { id: 'email', label: 'Email', icon: Mail },
      ]),
      selection(ctx),
    ),
  (ctx, i) =>
    slot(
      i,
      'Edit',
      Pencil,
      items('edit', [
        { id: 'crop', label: 'Crop', icon: Crop },
        { id: 'annotate', label: 'Annotate', icon: Highlighter },
        { id: 'redact', label: 'Redact', icon: EyeOff },
        { id: 'compress', label: 'Compress', icon: Minimize2 },
      ]),
      selection(ctx),
    ),
  (ctx, i) =>
    slot(
      i,
      'Fix recent',
      Undo2,
      items('fixRecent', [
        { id: 'undo', label: 'Undo save', icon: Undo2 },
        { id: 'moveTo', label: 'Move to', icon: CornerUpRight },
        { id: 'rename', label: 'Rename', icon: Pencil },
        { id: 'openFolder', label: 'Open folder', icon: FolderOpen },
      ]),
      recent(ctx),
    ),
  (_, i) =>
    slot(
      i,
      'Capture+',
      Aperture,
      items('capturePlus', [
        { id: 'delay3', label: 'Delay 3s', icon: Hourglass },
        { id: 'delay5', label: 'Delay 5s', icon: Hourglass },
        { id: 'fullPage', label: 'Full page', icon: Globe },
        { id: 'record', label: 'Record', icon: Video },
      ]),
      null,
    ),
];

export function buildSlots(layer: Layer, ctx: WheelContext): WheelSlot[] {
  const builders = layer === 'A' ? LAYER_A : LAYER_B;
  return builders.map((build, index) => build(ctx, index));
}
