import type { Order } from '../order/order-types';
import { looksLikeOrder } from '../order/order-types';
import { fromBase64Url, pipe, toBase64Url } from './pack-link';

/**
 * The gift link carries the whole order, deflated and base64url, as `?o=`.
 * Every game page decodes it and builds its own pack, so nothing is stored.
 */
export async function encodeOrder(order: Order): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(order));
  return toBase64Url(await pipe(raw, new CompressionStream('deflate-raw')));
}

export async function decodeOrder(encoded: string): Promise<Order | null> {
  try {
    const bytes = await pipe(fromBase64Url(encoded), new DecompressionStream('deflate-raw'));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return looksLikeOrder(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** The order a page was opened with, or null when `?o=` is absent or junk. */
export async function orderFromParams(params: URLSearchParams): Promise<Order | null> {
  const encoded = params.get('o');
  return encoded ? decodeOrder(encoded) : null;
}

/**
 * `from` is the page building the link (the order form), `path` the hop to the
 * target, so the link is right at the domain root and under /dropbots/ alike.
 */
export async function giftLink(order: Order, from: string, path = '../gift/'): Promise<string> {
  const base = new URL(path, from);
  base.searchParams.set('o', await encodeOrder(order));
  return base.toString();
}
