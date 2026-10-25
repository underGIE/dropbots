import type { ThemePack } from '../engine/types';

/**
 * A gift link has to carry the whole pack: the two phones in the room are
 * different devices, so local storage cannot be the hand-off. The pack rides
 * in the query string as base64url — no server, no database, no account.
 */
export function encodePack(pack: ThemePack): string {
  const bytes = new TextEncoder().encode(JSON.stringify(pack));
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodePack(encoded: string): ThemePack | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return looksLikePack(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** A link is untrusted input: check the shape before the engine ever sees it. */
export function looksLikePack(value: unknown): value is ThemePack {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const p = value as Partial<ThemePack>;
  if (typeof p.title !== 'string' || typeof p.slug !== 'string') {
    return false;
  }
  if (!Array.isArray(p.controls) || p.controls.length < 4) {
    return false;
  }
  if (
    !p.controls.every(
      (c) => typeof c?.id === 'string' && typeof c?.label === 'string' && typeof c?.kind === 'string',
    )
  ) {
    return false;
  }
  if (!Array.isArray(p.instructionTemplates) || p.instructionTemplates.length === 0) {
    return false;
  }
  if (!p.tuning || typeof p.tuning.targetScore !== 'number' || typeof p.tuning.baseDeadlineMs !== 'number') {
    return false;
  }
  return true;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(encoded: string): Uint8Array {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/**
 * Pack JSON is repetitive (`{"id":"c01","label":…,"kind":"pad"}` × 32), so
 * deflate roughly halves it. That is the difference between a QR nobody can
 * scan at A5 and one that reads first try. Carried as `?c=`; the raw `?p=`
 * form still decodes, for links already sent.
 */
export async function encodePackCompressed(pack: ThemePack): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(pack));
  return toBase64Url(await pipe(raw, new CompressionStream('deflate-raw')));
}

export async function decodePackCompressed(encoded: string): Promise<ThemePack | null> {
  try {
    const bytes = await pipe(fromBase64Url(encoded), new DecompressionStream('deflate-raw'));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return looksLikePack(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Whatever a link carries, compressed or raw, or nothing. */
export async function packFromParams(params: URLSearchParams): Promise<ThemePack | null> {
  const compressed = params.get('c');
  if (compressed) {
    return decodePackCompressed(compressed);
  }
  const raw = params.get('p');
  return raw ? decodePack(raw) : null;
}

/**
 * The link you actually send someone. `from` is the order page's own URL, so
 * the default hop is one level up and into /play/ — that keeps the link correct
 * at the domain root and under a project path like /dropbots/ alike.
 */
export async function playLink(pack: ThemePack, from: string, path = '../play/'): Promise<string> {
  const base = new URL(path, from);
  base.searchParams.set('c', await encodePackCompressed(pack));
  return base.toString();
}

/** The uncompressed form, kept for tests and for anything that cannot await. */
export function playLinkRaw(pack: ThemePack, from: string, path = '../play/'): string {
  const base = new URL(path, from);
  base.searchParams.set('p', encodePack(pack));
  return base.toString();
}
