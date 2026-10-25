import { describe, expect, it } from 'vitest';
import {
  clamp,
  fmt,
  initialShake,
  isShake,
  magnitude,
  pruneOld,
  sampleRate,
  shakeStrength,
  stepShake,
  tiltToOffset,
  type AccelSample,
} from '../src/motion/detect';

const s = (x: number, y: number, z: number, t = 0): AccelSample => ({ x, y, z, t });

describe('magnitude', () => {
  it('is the euclidean norm', () => {
    expect(magnitude(3, 4, 0)).toBe(5);
    expect(magnitude(0, 0, 0)).toBe(0);
  });
});

describe('isShake', () => {
  it('is false for an empty window', () => {
    expect(isShake([], 15)).toBe(false);
  });
  it('is false for a phone resting or gently carried', () => {
    expect(isShake([s(0.1, 0.2, 0.1), s(1, 1, 1), s(2, 0, 3)], 15)).toBe(false);
  });
  it('is true when one sample passes the threshold', () => {
    expect(isShake([s(0, 0, 0), s(20, 0, 0)], 15)).toBe(true);
  });
  it('counts a diagonal jolt by magnitude, not by single axis', () => {
    expect(isShake([s(10, 10, 10)], 15)).toBe(true);
    expect(isShake([s(10, 10, 10)], 18)).toBe(false);
  });
  it('treats the threshold as inclusive', () => {
    expect(isShake([s(15, 0, 0)], 15)).toBe(true);
  });
  it('uses a sane default threshold', () => {
    expect(isShake([s(30, 0, 0)])).toBe(true);
    expect(isShake([s(2, 0, 0)])).toBe(false);
  });
});

describe('shakeStrength', () => {
  it('prefers linear acceleration', () => {
    expect(shakeStrength({ x: 3, y: 4, z: 0 }, { x: 0, y: 0, z: 9.81 })).toBe(5);
  });
  it('falls back to deviation from 1 g when linear is missing', () => {
    expect(shakeStrength(null, { x: 0, y: 0, z: 9.81 })).toBeCloseTo(0, 5);
    expect(shakeStrength(null, { x: 0, y: 0, z: 25 })).toBeCloseTo(25 - 9.81, 5);
  });
  it('is zero with no data at all', () => {
    expect(shakeStrength(null, null)).toBe(0);
  });
});

describe('stepShake (debounce)', () => {
  it('fires on the first strong reading', () => {
    const r = stepShake(initialShake, 20, 1000, 15, 300);
    expect(r.fired).toBe(true);
    expect(r.state.count).toBe(1);
  });
  it('ignores weak readings', () => {
    const r = stepShake(initialShake, 5, 1000, 15, 300);
    expect(r.fired).toBe(false);
    expect(r.state).toBe(initialShake);
  });
  it('swallows a second jolt inside the debounce window', () => {
    const a = stepShake(initialShake, 20, 1000, 15, 300);
    const b = stepShake(a.state, 25, 1200, 15, 300);
    expect(b.fired).toBe(false);
    expect(b.state.count).toBe(1);
  });
  it('fires again once the window has passed', () => {
    const a = stepShake(initialShake, 20, 1000, 15, 300);
    const b = stepShake(a.state, 25, 1300, 15, 300);
    expect(b.fired).toBe(true);
    expect(b.state.count).toBe(2);
  });
});

describe('tiltToOffset', () => {
  it('is centred when flat', () => {
    expect(tiltToOffset(0, 0)).toEqual({ x: 0, y: 0 });
  });
  it('centres on null readings', () => {
    expect(tiltToOffset(null, null)).toEqual({ x: 0, y: 0 });
  });
  it('maps gamma to x and beta to y', () => {
    expect(tiltToOffset(0, 22.5)).toEqual({ x: 0.5, y: 0 });
    expect(tiltToOffset(-22.5, 0)).toEqual({ x: 0, y: -0.5 });
  });
  it('clamps at the edge of the square', () => {
    expect(tiltToOffset(180, -90)).toEqual({ x: -1, y: 1 });
  });
  it('honours a custom maxDeg', () => {
    expect(tiltToOffset(0, 10, 20)).toEqual({ x: 0.5, y: 0 });
  });
});

describe('sampleRate', () => {
  it('is 0 with no samples', () => {
    expect(sampleRate([], 1000)).toBe(0);
  });
  it('counts only the last second', () => {
    const ts = [0, 100, 600, 1100, 1500];
    // at now=1600, window keeps 600, 1100, 1500
    expect(sampleRate(ts, 1600)).toBe(3);
  });
  it('reads 60 Hz from 60 evenly spaced samples', () => {
    const ts = Array.from({ length: 60 }, (_, i) => 1000 + i * (1000 / 60));
    expect(sampleRate(ts, 2000)).toBe(60);
  });
});

describe('pruneOld', () => {
  it('drops stale timestamps', () => {
    expect(pruneOld([0, 500, 1500], 1600)).toEqual([1500]);
  });
});

describe('helpers', () => {
  it('clamp bounds a value', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.3, 0, 1)).toBe(0.3);
  });
  it('fmt shows a dash for missing values', () => {
    expect(fmt(null)).toBe('—');
    expect(fmt(undefined)).toBe('—');
    expect(fmt(NaN)).toBe('—');
    expect(fmt(1.2345, 1)).toBe('1.2');
  });
});
