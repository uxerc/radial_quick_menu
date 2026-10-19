export function joinPath(...parts: string[]): string {
  return parts
    .flatMap((p) => p.split('/'))
    .filter((p) => p !== '' && p !== '.')
    .join('/');
}

export function dirname(path: string): string {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? '' : path.slice(0, cut);
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function splitExt(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? { stem: name, ext: '' } : { stem: name.slice(0, dot), ext: name.slice(dot + 1) };
}

export function withExt(name: string, ext: string): string {
  return `${splitExt(name).stem}.${ext}`;
}

/** "a.png" → "a (1).png", "a (2).png"…, like Explorer. */
export function uniqueName(name: string, taken: (candidate: string) => boolean): string {
  if (!taken(name)) return name;
  const { stem, ext } = splitExt(name);
  for (let i = 1; ; i++) {
    const candidate = ext ? `${stem} (${i}).${ext}` : `${stem} (${i})`;
    if (!taken(candidate)) return candidate;
  }
}

const INVALID = /[<>:"/\\|?*\u0000-\u001f]/g;

export function safeFileName(text: string, fallback: string): string {
  const cleaned = text.replace(INVALID, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return cleaned === '' ? fallback : cleaned;
}
