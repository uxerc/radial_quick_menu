import { toast } from '../ui/toast';
import type { ActionResult } from '../wheel/types';
import { NO_FOLDER, fail, isAbort, ok, timestamp } from './deps';
import type { ActionDeps } from './deps';
import { canvasBlob } from './convert';
import { appFromTitle } from './rules';
import { selectArea } from './areaSelect';

type Surface = 'monitor' | 'window' | 'browser';

interface Frame {
  canvas: HTMLCanvasElement;
  title: string;
  surface: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function countdown(seconds: number): Promise<void> {
  for (let s = seconds; s > 0; s--) {
    toast(`Capturing in ${s}…`);
    await sleep(1000);
  }
}

/** Must be called straight from the click: getDisplayMedia needs the user gesture. */
function requestStream(surface: Surface): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: surface },
    audio: false,
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'exclude',
    monitorTypeSurfaces: 'include',
  } as DisplayMediaStreamOptions);
}

async function grab(stream: MediaStream): Promise<Frame> {
  const track = stream.getVideoTracks()[0];
  const video = document.createElement('video');
  video.muted = true;
  video.srcObject = stream;
  try {
    await video.play();
    await new Promise<void>((resolve) => {
      if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(() => resolve());
      else setTimeout(resolve, 200);
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    return { canvas, title: track.label, surface: track.getSettings().displaySurface ?? 'unknown' };
  } finally {
    for (const t of stream.getTracks()) t.stop();
    video.srcObject = null;
  }
}

export async function capture(
  deps: ActionDeps,
  mode: { surface: Surface; delaySeconds?: number; area?: boolean },
): Promise<ActionResult> {
  if (!deps.workspace.isOpen) return NO_FOLDER;
  let stream: MediaStream;
  try {
    stream = await requestStream(mode.surface);
  } catch (error) {
    return isAbort(error) ? fail('Capture cancelled') : fail(`Capture failed: ${String(error)}`);
  }

  if (mode.delaySeconds) await countdown(mode.delaySeconds);
  const frame = await grab(stream);
  let canvas = frame.canvas;
  if (mode.area) {
    const cropped = await selectArea(canvas);
    if (!cropped) return fail('Capture cancelled');
    canvas = cropped;
  }

  const blob = await canvasBlob(canvas, 'image/png');
  const signals = { title: frame.title, app: appFromTitle(frame.title) };
  const save = await deps.filing.file(blob, `Screenshot ${timestamp()}.png`, signals);
  return ok(`Captured ${frame.surface} “${frame.title}” → ${save.path}`);
}
