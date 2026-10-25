import type { GameMsg, Transport } from './types';

/** In-process loopback bus, for tests and solo play. */
export function localBus<M = GameMsg>(): { make: () => Transport<M> } {
  const handlers = new Set<(msg: M) => void>();
  return {
    make: () => {
      let mine: ((msg: M) => void) | null = null;
      return {
        send(msg) {
          for (const h of handlers) {
            if (h !== mine) {
              h(msg);
            }
          }
        },
        onMessage(cb) {
          mine = cb;
          handlers.add(cb);
        },
        close() {
          if (mine) {
            handlers.delete(mine);
          }
        },
      };
    },
  };
}
