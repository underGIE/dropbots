import type { GameMsg, Transport } from './types';

/** In-process loopback bus, for tests and solo play. */
export function localBus(): { make: () => Transport } {
  const handlers = new Set<(msg: GameMsg) => void>();
  return {
    make: () => {
      let mine: ((msg: GameMsg) => void) | null = null;
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
