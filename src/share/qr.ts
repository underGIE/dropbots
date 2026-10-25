/**
 * A QR code generator, byte mode only, error-correction L or M, versions 1-40.
 * Pure TypeScript, no network, no dependency: the gift card has to render
 * offline and the link inside it can be ~3 KB because it carries a whole pack.
 *
 * The structure follows ISO/IEC 18004: build the data codewords, add
 * Reed-Solomon blocks, interleave, place on the grid around the function
 * patterns, then pick the mask with the lowest penalty.
 */

export type EccLevel = 'L' | 'M';

export interface QrMatrix {
  version: number;
  ecc: EccLevel;
  mask: number;
  size: number;
  /** modules[y][x] is true for a dark module. */
  modules: boolean[][];
}

/** Largest payload (bytes) a version-40 code can carry at level L. */
export const QR_MAX_BYTES = 2953;

// Index = version (0 unused). Per-block ECC codewords and block counts.
const ECC_PER_BLOCK: Record<EccLevel, number[]> = {
  L: [
    0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  M: [
    0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28,
    28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  ],
};
const BLOCKS: Record<EccLevel, number[]> = {
  L: [
    0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19,
    19, 20, 21, 22, 24, 25,
  ],
  M: [
    0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31,
    33, 35, 37, 38, 40, 43, 45, 47, 49,
  ],
};
const FORMAT_BITS: Record<EccLevel, number> = { L: 1, M: 0 };

function at<T>(list: readonly T[], i: number): T {
  const v = list[i];
  if (v === undefined) {
    throw new Error(`QR: table index ${i} out of range`);
  }
  return v;
}

/** Data + ECC modules available in a version, before dividing into bytes. */
function rawModules(version: number): number {
  let n = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (version >= 7) {
      n -= 36;
    }
  }
  return n;
}

function dataCodewords(version: number, ecc: EccLevel): number {
  return (
    Math.floor(rawModules(version) / 8) - at(ECC_PER_BLOCK[ecc], version) * at(BLOCKS[ecc], version)
  );
}

/** Bytes of payload that fit: data codewords minus the mode and count header. */
function byteCapacity(version: number, ecc: EccLevel): number {
  const headerBits = 4 + (version < 10 ? 8 : 16);
  return Math.floor((dataCodewords(version, ecc) * 8 - headerBits) / 8);
}

function chooseVersion(length: number): { version: number; ecc: EccLevel } {
  // M is sturdier to print and scan; fall back to L only when M cannot hold it.
  for (const ecc of ['M', 'L'] as const) {
    for (let v = 1; v <= 40; v++) {
      if (byteCapacity(v, ecc) >= length) {
        return { version: v, ecc };
      }
    }
  }
  throw new Error(`QR: ${length} bytes is more than a QR code can hold (max ${QR_MAX_BYTES})`);
}

// ---- Reed-Solomon over GF(256), polynomial 0x11D ----

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    EXP[i] = EXP[i - 255] ?? 0;
  }
})();

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : (EXP[(LOG[a] ?? 0) + (LOG[b] ?? 0)] ?? 0);
}

function rsGenerator(degree: number): number[] {
  // Coefficients of prod (x - a^i), highest power first, leading 1 omitted.
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    poly.forEach((c, j) => {
      next[j] = (next[j] ?? 0) ^ c;
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(c, EXP[i] ?? 0);
    });
    poly = next;
  }
  return poly.slice(1);
}

function rsRemainder(data: number[], generator: number[]): number[] {
  const rem = new Array<number>(generator.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ (rem.shift() ?? 0);
    rem.push(0);
    generator.forEach((g, i) => {
      rem[i] = (rem[i] ?? 0) ^ gfMul(g, factor);
    });
  }
  return rem;
}

// ---- codewords ----

function buildCodewords(bytes: Uint8Array, version: number, ecc: EccLevel): number[] {
  const bits: number[] = [];
  const push = (value: number, count: number): void => {
    for (let i = count - 1; i >= 0; i--) {
      bits.push((value >>> i) & 1);
    }
  };
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) {
    push(b, 8);
  }
  const capacityBits = dataCodewords(version, ecc) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) {
    push(pad, 8);
  }
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | (bits[i + j] ?? 0);
    }
    data.push(byte);
  }

  const numBlocks = at(BLOCKS[ecc], version);
  const eccLen = at(ECC_PER_BLOCK[ecc], version);
  const rawCodewords = Math.floor(rawModules(version) / 8);
  const numShort = numBlocks - (rawCodewords % numBlocks);
  const shortLen = Math.floor(rawCodewords / numBlocks);
  const generator = rsGenerator(eccLen);

  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  let k = 0;
  for (let i = 0; i < numBlocks; i++) {
    const len = shortLen - eccLen + (i < numShort ? 0 : 1);
    const block = data.slice(k, k + len);
    k += len;
    dataBlocks.push(block);
    eccBlocks.push(rsRemainder(block, generator));
  }

  const out: number[] = [];
  const longest = shortLen - eccLen + 1;
  for (let i = 0; i < longest; i++) {
    for (const block of dataBlocks) {
      const v = block[i];
      if (v !== undefined) {
        out.push(v);
      }
    }
  }
  for (let i = 0; i < eccLen; i++) {
    for (const block of eccBlocks) {
      out.push(block[i] ?? 0);
    }
  }
  return out;
}

// ---- the grid ----

function alignmentPositions(version: number, size: number): number[] {
  if (version === 1) {
    return [];
  }
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const positions = [6];
  for (let pos = size - 7; positions.length < count; pos -= step) {
    positions.splice(1, 0, pos);
  }
  return positions;
}

class Grid {
  readonly modules: boolean[][];
  readonly fixed: boolean[][];

  constructor(readonly size: number) {
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }

  setFixed(x: number, y: number, dark: boolean): void {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) {
      return;
    }
    (this.modules[y] as boolean[])[x] = dark;
    (this.fixed[y] as boolean[])[x] = true;
  }

  get(x: number, y: number): boolean {
    return this.modules[y]?.[x] ?? false;
  }

  drawFunctionPatterns(version: number): void {
    const { size } = this;
    for (let i = 0; i < size; i++) {
      this.setFixed(6, i, i % 2 === 0);
      this.setFixed(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [
      [3, 3],
      [size - 4, 3],
      [3, size - 4],
    ] as const) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          this.setFixed(cx + dx, cy + dy, dist !== 2 && dist !== 4);
        }
      }
    }
    const align = alignmentPositions(version, size);
    const last = align.length - 1;
    align.forEach((cx, i) => {
      align.forEach((cy, j) => {
        const onFinder = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
        if (onFinder) {
          return;
        }
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            this.setFixed(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      });
    });
    this.drawFormat(0, 0); // reserve the area; rewritten once the mask is known
    this.drawVersion(version);
  }

  drawFormat(ecc: number, mask: number): void {
    const { size } = this;
    const data = (ecc << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) {
      rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    }
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number): boolean => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) {
      this.setFixed(8, i, bit(i));
    }
    this.setFixed(8, 7, bit(6));
    this.setFixed(8, 8, bit(7));
    this.setFixed(7, 8, bit(8));
    for (let i = 9; i < 15; i++) {
      this.setFixed(14 - i, 8, bit(i));
    }
    for (let i = 0; i < 8; i++) {
      this.setFixed(size - 1 - i, 8, bit(i));
    }
    for (let i = 8; i < 15; i++) {
      this.setFixed(8, size - 15 + i, bit(i));
    }
    this.setFixed(8, size - 8, true);
  }

  drawVersion(version: number): void {
    if (version < 7) {
      return;
    }
    let rem = version;
    for (let i = 0; i < 12; i++) {
      rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    }
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFixed(a, b, dark);
      this.setFixed(b, a, dark);
    }
  }

  placeData(codewords: number[]): void {
    const { size } = this;
    let i = 0;
    const total = codewords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) {
        right = 5;
      }
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!(this.fixed[y] as boolean[])[x] && i < total) {
            const byte = codewords[i >>> 3] ?? 0;
            (this.modules[y] as boolean[])[x] = ((byte >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
      }
    }
  }

  applyMask(mask: number): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if ((this.fixed[y] as boolean[])[x]) {
          continue;
        }
        let invert: boolean;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        }
        if (invert) {
          const row = this.modules[y] as boolean[];
          row[x] = !row[x];
        }
      }
    }
  }

  penalty(): number {
    const { size } = this;
    let score = 0;
    const line = (get: (i: number) => boolean): void => {
      // rule 1: runs of 5+ in one colour
      let run = 1;
      for (let i = 1; i < size; i++) {
        if (get(i) === get(i - 1)) {
          run++;
        } else {
          if (run >= 5) {
            score += 3 + (run - 5);
          }
          run = 1;
        }
      }
      if (run >= 5) {
        score += 3 + (run - 5);
      }
      // rule 3: finder-like 1:1:3:1:1 with a light stretch on one side
      for (let i = 0; i + 11 <= size; i++) {
        const w = (k: number): boolean => get(i + k);
        const core = w(0) && !w(1) && w(2) && w(3) && w(4) && !w(5) && w(6);
        if (core && !w(7) && !w(8) && !w(9) && !w(10)) {
          score += 40;
        }
      }
      for (let i = 0; i + 11 <= size; i++) {
        const w = (k: number): boolean => get(i + k);
        const core = w(4) && !w(5) && w(6) && w(7) && w(8) && !w(9) && w(10);
        if (core && !w(0) && !w(1) && !w(2) && !w(3)) {
          score += 40;
        }
      }
    };
    for (let y = 0; y < size; y++) {
      line((x) => this.get(x, y));
    }
    for (let x = 0; x < size; x++) {
      line((y) => this.get(x, y));
    }
    // rule 2: 2x2 blocks
    let dark = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const c = this.get(x, y);
        if (c) {
          dark++;
        }
        if (x + 1 < size && y + 1 < size && c === this.get(x + 1, y) && c === this.get(x, y + 1) && c === this.get(x + 1, y + 1)) {
          score += 3;
        }
      }
    }
    // rule 4: balance of dark and light
    const total = size * size;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }
}

/** Encode text (as UTF-8 bytes) to a module matrix. Throws if it is too long. */
export function qrMatrix(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  const { version, ecc } = chooseVersion(bytes.length);
  const size = version * 4 + 17;
  const grid = new Grid(size);
  grid.drawFunctionPatterns(version);
  grid.placeData(buildCodewords(bytes, version, ecc));

  let best = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    grid.applyMask(mask);
    grid.drawFormat(FORMAT_BITS[ecc], mask);
    const score = grid.penalty();
    if (score < bestScore) {
      best = mask;
      bestScore = score;
    }
    grid.applyMask(mask); // XOR again: back to the unmasked data
  }
  grid.applyMask(best);
  grid.drawFormat(FORMAT_BITS[ecc], best);
  return { version, ecc, mask: best, size, modules: grid.modules };
}

/**
 * A QR code as an inline SVG string. One path, crisp edges, a 4-module quiet
 * zone (the spec minimum) baked in so it scans on any background.
 */
export function qrSvg(text: string, opts: { size?: number } = {}): string {
  const px = opts.size ?? 256;
  const { size, modules } = qrMatrix(text);
  const quiet = 4;
  const span = size + quiet * 2;
  let d = '';
  modules.forEach((row, y) => {
    let x = 0;
    while (x < size) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < size && row[x]) {
        x++;
      }
      d += `M${start + quiet} ${y + quiet}h${x - start}v1h${start - x}z`;
    }
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${span} ${span}" width="${px}" height="${px}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="QR">` +
    `<rect width="${span}" height="${span}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
  );
}
