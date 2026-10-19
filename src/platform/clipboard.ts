const CLIPBOARD_TIMEOUT_MS = 1500;

/** A pending permission prompt never settles in some embeds, so give up instead of hanging. */
export function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), CLIPBOARD_TIMEOUT_MS)),
  ]);
}

export async function readClipboardText(): Promise<string | null> {
  try {
    return await withTimeout(navigator.clipboard.readText());
  } catch {
    return null;
  }
}
