import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GameMsg, Transport } from './types';

const EVENT = 'msg';

/** The slice of the realtime API this transport needs — keeps it testable. */
export interface RealtimeLike {
  channel(
    name: string,
    opts?: { config?: { broadcast?: { self?: boolean; ack?: boolean } } },
  ): ChannelLike;
  removeChannel(channel: ChannelLike): void;
}

export interface ChannelLike {
  on(type: 'broadcast', filter: { event: string }, cb: (payload: unknown) => void): ChannelLike;
  subscribe(cb?: (status: string) => void): ChannelLike;
  send(args: { type: 'broadcast'; event: string; payload: unknown }): unknown;
}

export function readEnv(env: Record<string, string | undefined>): { url: string; key: string } | null {
  const url = env['VITE_SUPABASE_URL'];
  const key = env['VITE_SUPABASE_ANON_KEY'];
  if (!url || !key) {
    return null;
  }
  return { url, key };
}

export function clientFromEnv(env: Record<string, string | undefined>): SupabaseClient | null {
  const conf = readEnv(env);
  if (!conf) {
    return null;
  }
  return createClient(conf.url, conf.key, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
}

/**
 * Real-phone transport: one ephemeral broadcast channel per room.
 * Nothing is written to the database — the match lives in the host's memory,
 * exactly as it does over BroadcastChannel.
 */
export function supabaseTransport<M = GameMsg>(room: string, client: RealtimeLike): Transport<M> {
  let handler: ((msg: M) => void) | null = null;
  let ready = false;
  const outbox: M[] = [];

  const channel = client.channel(`twodjs:${room}`, {
    config: { broadcast: { self: false, ack: false } },
  });

  channel.on('broadcast', { event: EVENT }, (payload) => {
    const body = (payload as { payload?: M }).payload;
    if (body && handler) {
      handler(body);
    }
  });

  const flush = () => {
    while (outbox.length > 0) {
      const next = outbox.shift();
      if (next) {
        channel.send({ type: 'broadcast', event: EVENT, payload: next });
      }
    }
  };

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      ready = true;
      flush();
    }
  });

  return {
    send(msg) {
      // anything sent before the socket is up would be dropped on the floor
      if (!ready) {
        outbox.push(msg);
        return;
      }
      channel.send({ type: 'broadcast', event: EVENT, payload: msg });
    },
    onMessage(cb) {
      handler = cb;
    },
    close() {
      handler = null;
      client.removeChannel(channel);
    },
  };
}
