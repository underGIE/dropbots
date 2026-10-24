import { describe, expect, it } from 'vitest';
import { readEnv, supabaseTransport, type ChannelLike, type RealtimeLike } from '../src/transport/supabase';
import type { GameMsg } from '../src/transport/types';

/** A realtime double: records sends, lets the test decide when it connects. */
function fakeRealtime() {
  const sent: unknown[] = [];
  let listener: ((payload: unknown) => void) | null = null;
  let statusCb: ((status: string) => void) | null = null;
  let removed = 0;
  let openedWith: { name: string; self?: boolean } | null = null;

  const channel: ChannelLike = {
    on(_type, filter, cb) {
      if (filter.event === 'msg') {
        listener = cb;
      }
      return channel;
    },
    subscribe(cb) {
      statusCb = cb ?? null;
      return channel;
    },
    send(args) {
      sent.push(args);
      return 'ok';
    },
  };

  const client: RealtimeLike = {
    channel(name, opts) {
      openedWith = { name, self: opts?.config?.broadcast?.self };
      return channel;
    },
    removeChannel() {
      removed += 1;
    },
  };

  return {
    client,
    sent,
    get removed() {
      return removed;
    },
    get openedWith() {
      return openedWith;
    },
    connect: () => statusCb?.('SUBSCRIBED'),
    deliver: (msg: GameMsg) => listener?.({ payload: msg }),
  };
}

const JOIN: GameMsg = { t: 'join', playerId: 'g', name: 'שני' };

describe('supabase transport', () => {
  it('opens one room channel and never echoes to the sender', () => {
    const rt = fakeRealtime();
    supabaseTransport('PRTY', rt.client);
    expect(rt.openedWith).toEqual({ name: 'twodjs:PRTY', self: false });
  });

  it('holds messages until the socket is up, then flushes in order', () => {
    const rt = fakeRealtime();
    const t = supabaseTransport('PRTY', rt.client);
    t.send(JOIN);
    t.send({ t: 'start' });
    expect(rt.sent).toHaveLength(0);
    rt.connect();
    expect(rt.sent).toEqual([
      { type: 'broadcast', event: 'msg', payload: JOIN },
      { type: 'broadcast', event: 'msg', payload: { t: 'start' } },
    ]);
  });

  it('sends straight through once connected', () => {
    const rt = fakeRealtime();
    const t = supabaseTransport('PRTY', rt.client);
    rt.connect();
    t.send(JOIN);
    expect(rt.sent).toHaveLength(1);
  });

  it('unwraps an incoming broadcast into a game message', () => {
    const rt = fakeRealtime();
    const t = supabaseTransport('PRTY', rt.client);
    const seen: GameMsg[] = [];
    t.onMessage((m) => seen.push(m));
    rt.connect();
    rt.deliver(JOIN);
    expect(seen).toEqual([JOIN]);
  });

  it('stops listening and drops the channel on close', () => {
    const rt = fakeRealtime();
    const t = supabaseTransport('PRTY', rt.client);
    const seen: GameMsg[] = [];
    t.onMessage((m) => seen.push(m));
    t.close();
    rt.deliver(JOIN);
    expect(seen).toEqual([]);
    expect(rt.removed).toBe(1);
  });
});

describe('env', () => {
  it('needs both the url and the anon key', () => {
    expect(readEnv({})).toBeNull();
    expect(readEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
    expect(
      readEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).toEqual({ url: 'https://x.supabase.co', key: 'k' });
  });
});
