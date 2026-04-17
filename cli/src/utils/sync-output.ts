/**
 * Patches process.stdout.write to use Synchronized Output protocol.
 * This prevents flickering in terminals that support it (iTerm2, kitty, etc).
 *
 * The protocol wraps each write in Begin/End markers so the terminal
 * buffers the output and paints it all at once instead of progressively.
 *
 * See: https://gist.github.com/christianparpart/d8a62cc1ab659194571cd72825afb6e0
 */

const BEGIN_SYNC = '\x1B[?2026h';
const END_SYNC = '\x1B[?2026l';

let patched = false;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let inSync = false;

export function enableSyncOutput() {
  if (patched) return;
  patched = true;

  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = function (
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void),
    callback?: (err?: Error | null) => void,
  ): boolean {
    // Start a synchronized update block
    if (!inSync) {
      inSync = true;
      originalWrite(BEGIN_SYNC);
    }

    // Clear any pending end-sync timer
    if (pendingTimer) {
      clearTimeout(pendingTimer);
    }

    // Schedule ending the sync block after a microtask
    // This batches all writes in the same tick
    pendingTimer = setTimeout(() => {
      originalWrite(END_SYNC);
      inSync = false;
      pendingTimer = null;
    }, 0);

    return originalWrite(chunk, encodingOrCallback as BufferEncoding, callback);
  } as typeof process.stdout.write;
}

export function disableSyncOutput() {
  // Nothing needed — process exits or we restore stdout
  if (inSync) {
    process.stdout.write('\x1B[?2026l');
    inSync = false;
  }
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}
