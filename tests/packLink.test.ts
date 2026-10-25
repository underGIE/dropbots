import { describe, expect, it } from 'vitest';
import demo from '../packs/demo-family.json';
import { buildPack } from '../src/order/build-pack';
import { decodePack, encodePack, looksLikePack, playLink } from '../src/share/pack-link';
import type { ThemePack } from '../src/engine/types';

const PACK = demo as ThemePack;

describe('pack links', () => {
  it('survives a round trip, Hebrew labels included', () => {
    const back = decodePack(encodePack(PACK));
    expect(back).toEqual(PACK);
    expect(back?.controls[1]?.label).toBe(PACK.controls[1]?.label);
  });

  it('is url safe', () => {
    expect(encodePack(PACK)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('refuses junk instead of handing it to the engine', () => {
    expect(decodePack('not-base64!!')).toBeNull();
    expect(decodePack(btoa('{"nope":1}'))).toBeNull();
    expect(looksLikePack({ ...PACK, controls: [] })).toBe(false);
    expect(looksLikePack({ ...PACK, tuning: undefined })).toBe(false);
    expect(looksLikePack({ ...PACK, instructionTemplates: [] })).toBe(false);
  });

  it('builds a link a phone can open', () => {
    const { pack } = buildPack({
      names: ['אבי'],
      players: 2,
      jokes: ['טיפקס', 'סבתא על הרמקול'],
      world: 'disco',
      crowd: 'mixed',
      occasion: 'חג',
    });
    const link = playLink(pack, 'https://undergie.github.io/dropbots/order/');
    expect(link.startsWith('https://undergie.github.io/dropbots/play/?p=')).toBe(true);
    const carried = decodePack(new URL(link).searchParams.get('p')!);
    expect(carried?.controls[0]?.label).toBe('טיפקס');
    expect(carried?.theme?.hot).toBe('#ff5fa2');
  });

  it('stays short enough to be a link people send', () => {
    const { pack } = buildPack({
      names: ['אבי', 'שני', 'דודו', 'מיכל'],
      players: 4,
      jokes: Array.from({ length: 32 }, (_, i) => `בדיחה ארוכה מספר ${i + 1}`),
      world: 'techno',
      crowd: 'mixed',
      occasion: 'ראש השנה',
    });
    expect(playLink(pack, 'https://undergie.github.io/dropbots/order/').length).toBeLessThan(4000);
  });
});
