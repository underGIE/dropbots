import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { QR_MAX_BYTES, qrMatrix, qrSvg } from '../src/share/qr';

const url = (n: number): string => 'https://example.com/play/?p=' + 'Ab1_-xyZ9Q'.repeat(Math.ceil(n / 10)).slice(0, n);

function fingerprint(text: string): { version: number; ecc: string; mask: number; dark: number; sha: string } {
  const m = qrMatrix(text);
  const flat = m.modules.map((r) => r.map((c) => (c ? '1' : '0')).join('')).join('\n');
  return {
    version: m.version,
    ecc: m.ecc,
    mask: m.mask,
    dark: flat.split('1').length - 1,
    sha: createHash('sha256').update(flat).digest('hex').slice(0, 16),
  };
}

describe('qrSvg', () => {
  it('is a well-formed svg with one path and a quiet zone', () => {
    const svg = qrSvg('https://example.com/play/?p=abc');
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg.match(/<svg /g)).toHaveLength(1);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg.match(/<path /g)).toHaveLength(1);
    const { size } = qrMatrix('https://example.com/play/?p=abc');
    expect(svg).toContain(`viewBox="0 0 ${size + 8} ${size + 8}"`);
    expect(svg.match(/<rect /g)).toHaveLength(1);
  });

  it('scales with the size option and defaults to 256', () => {
    expect(qrSvg('hi')).toContain('width="256" height="256"');
    expect(qrSvg('hi', { size: 120 })).toContain('width="120" height="120"');
    expect(qrSvg('hi', { size: 600 })).toContain('width="600" height="600"');
  });

  it('draws the three finder patterns and the timing line', () => {
    const { modules, size } = qrMatrix(url(400));
    const ring = (x0: number, y0: number): void => {
      for (let i = 0; i < 7; i++) {
        expect(modules[y0]?.[x0 + i]).toBe(true);
        expect(modules[y0 + 6]?.[x0 + i]).toBe(true);
        expect(modules[y0 + i]?.[x0]).toBe(true);
        expect(modules[y0 + i]?.[x0 + 6]).toBe(true);
      }
      expect(modules[y0 + 3]?.[x0 + 3]).toBe(true);
      expect(modules[y0 + 1]?.[x0 + 1]).toBe(false);
    };
    ring(0, 0);
    ring(size - 7, 0);
    ring(0, size - 7);
    for (let i = 8; i < size - 8; i++) {
      expect(modules[6]?.[i]).toBe(i % 2 === 0);
    }
  });

  it('picks the smallest version and prefers level M, falling back to L', () => {
    expect(qrMatrix('HELLO').version).toBe(1);
    expect(qrMatrix('HELLO').ecc).toBe('M');
    expect(qrMatrix(url(100)).version).toBeLessThan(qrMatrix(url(1000)).version);
    expect(qrMatrix('x'.repeat(2331)).ecc).toBe('M'); // version 40-M is exactly full
    expect(qrMatrix('x'.repeat(2332)).ecc).toBe('L');
  });

  it('encodes up to the 2953-byte ceiling without throwing, and refuses past it', () => {
    expect(QR_MAX_BYTES).toBe(2953);
    expect(() => qrSvg(url(2900))).not.toThrow();
    expect(qrMatrix(url(2900)).version).toBe(40);
    expect(() => qrSvg('x'.repeat(2953))).not.toThrow();
    expect(() => qrSvg('x'.repeat(2954))).toThrow(/too|more than/);
  });

  it('counts UTF-8 bytes, not characters', () => {
    const hebrew = 'שלום'.repeat(740); // 2960 chars, 5920 bytes
    expect(() => qrSvg(hebrew)).toThrow();
    expect(() => qrSvg('שלום עולם')).not.toThrow();
  });

  it('is deterministic and its output is pinned so regressions show', () => {
    expect(qrSvg(url(300))).toBe(qrSvg(url(300)));
    // These fingerprints were decoded with a reference scanner (macOS Core Image)
    // when recorded; a change here means the encoder changed.
    expect(fingerprint('HELLO')).toEqual({ version: 1, ecc: 'M', mask: 4, dark: 228, sha: 'c346c75add569873' });
    expect(fingerprint('https://example.com/play/?p=abc')).toEqual({ version: 3, ecc: 'M', mask: 2, dark: 447, sha: 'ceb79da97f7841b7' });
  });
});
