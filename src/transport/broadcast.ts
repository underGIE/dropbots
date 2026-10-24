import type { GameMsg, Transport } from './types';

/**
 * Same-browser transport: real two-client play across tabs, zero backend.
 * Day-1 slice and the test rig. Real phones get the Supabase transport,
 * which implements this same interface and nothing else changes.
 */
export function broadcastTransport(room: string): Transport {
  const channel = new BroadcastChannel(`twodjs:${room}`);
  let handler: ((msg: GameMsg) => void) | null = null;
  channel.onmessage = (event) => handler?.(event.data as GameMsg);
  return {
    send: (msg) => channel.postMessage(msg),
    onMessage: (cb) => {
      handler = cb;
    },
    close: () => channel.close(),
  };
}
