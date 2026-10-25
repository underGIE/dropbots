/* Pure detection logic for the phone-as-controller spike. No DOM, no events:
   the page feeds numbers in, these functions answer yes/no. */

export interface AccelSample {
  x: number;
  y: number;
  z: number;
  /** milliseconds, any monotonic clock */
  t: number;
}

export interface Offset {
  /** -1 (left) .. 1 (right) */
  x: number;
  /** -1 (top) .. 1 (bottom) */
  y: number;
}

export type PermissionState = 'not-requested' | 'granted' | 'denied' | 'unsupported';

/** Earth gravity in m/s^2. */
export const GRAVITY = 9.81;

/** A hard flick of the wrist on a handheld phone is roughly 15-30 m/s^2 of linear acceleration. */
export const DEFAULT_SHAKE_THRESHOLD = 15;

export const DEFAULT_DEBOUNCE_MS = 350;

export function magnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Some Android devices report no linear acceleration (null), only the reading
 * with gravity. Then the shake strength is how far the total is from 1 g.
 */
export function shakeStrength(
  linear: { x: number; y: number; z: number } | null,
  withGravity: { x: number; y: number; z: number } | null,
): number {
  if (linear) return magnitude(linear.x, linear.y, linear.z);
  if (withGravity) return Math.abs(magnitude(withGravity.x, withGravity.y, withGravity.z) - GRAVITY);
  return 0;
}

/** True when any sample in the window is a shake-sized jolt. Samples are linear (gravity-free) acceleration. */
export function isShake(samples: readonly AccelSample[], threshold = DEFAULT_SHAKE_THRESHOLD): boolean {
  for (const s of samples) {
    if (magnitude(s.x, s.y, s.z) >= threshold) return true;
  }
  return false;
}

export interface ShakeState {
  count: number;
  /** time of the last counted shake, or -Infinity */
  lastAt: number;
}

export const initialShake: ShakeState = { count: 0, lastAt: -Infinity };

/**
 * Feed one strength reading. Counts a shake when it crosses the threshold and
 * the debounce window since the previous counted shake has passed. Returns
 * the new state and whether this reading fired.
 */
export function stepShake(
  state: ShakeState,
  strength: number,
  t: number,
  threshold = DEFAULT_SHAKE_THRESHOLD,
  debounceMs = DEFAULT_DEBOUNCE_MS,
): { state: ShakeState; fired: boolean } {
  if (strength >= threshold && t - state.lastAt >= debounceMs) {
    return { state: { count: state.count + 1, lastAt: t }, fired: true };
  }
  return { state, fired: false };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Map device orientation to a dot offset on a square.
 * gamma = left/right roll (-90..90), beta = front/back pitch (-180..180).
 * `maxDeg` is the tilt that pushes the dot to the edge. Null readings (no
 * sensor yet) sit in the centre.
 */
export function tiltToOffset(beta: number | null, gamma: number | null, maxDeg = 45): Offset {
  const b = beta ?? 0;
  const g = gamma ?? 0;
  return { x: clamp(g / maxDeg, -1, 1), y: clamp(b / maxDeg, -1, 1) };
}

/** Samples per second, counting timestamps (ms) inside the trailing window. */
export function sampleRate(timestamps: readonly number[], now: number, windowMs = 1000): number {
  let n = 0;
  for (const t of timestamps) {
    if (now - t <= windowMs && t <= now) n += 1;
  }
  return (n * 1000) / windowMs;
}

/** Drop timestamps older than the window, so the buffer never grows. */
export function pruneOld(timestamps: number[], now: number, windowMs = 1000): number[] {
  return timestamps.filter((t) => now - t <= windowMs);
}

/** One-line number format for the live readouts. */
export function fmt(v: number | null | undefined, digits = 2): string {
  return v == null || Number.isNaN(v) ? '—' : v.toFixed(digits);
}
