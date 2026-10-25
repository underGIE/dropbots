import { describe, expect, it } from 'vitest';
import { emptyOrder, type Order } from '../src/order/order-types';
import { decodeOrder, encodeOrder, giftLink, orderFromParams } from '../src/share/order-link';

function sample(): Order {
  return {
    ...emptyOrder(),
    names: ['אבי', 'דודו', 'שני'],
    players: 3,
    occasion: 'יום הולדת 40 לדודו',
    jokes: ['תמיד מאחר', 'הבעיטה של אבי'],
    facts: [],
    traits: { אבי: 'לא מוותר', דודו: 'תמיד מאחר' },
    villain: { name: 'הבוס', trait: 'מצלם הכל', why: 'כי כן', taunts: ['חה'] },
    createdAt: '2026-10-25T10:00:00.000Z',
  };
}

describe('order link', () => {
  it('round-trips an order with Hebrew', async () => {
    const order = sample();
    expect(await decodeOrder(await encodeOrder(order))).toEqual(order);
  });

  it('is url-safe', async () => {
    const encoded = await encodeOrder(sample());
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('refuses junk', async () => {
    expect(await decodeOrder('not-an-order!!')).toBeNull();
    expect(await decodeOrder('')).toBeNull();
    // valid deflate, wrong shape
    const wrong = await encodeOrder({ version: 2 } as unknown as Order);
    expect(await decodeOrder(wrong)).toBeNull();
  });

  it('orderFromParams: empty and garbage give null, a real one decodes', async () => {
    expect(await orderFromParams(new URLSearchParams(''))).toBeNull();
    expect(await orderFromParams(new URLSearchParams('o=garbage'))).toBeNull();
    const order = sample();
    const params = new URLSearchParams({ o: await encodeOrder(order) });
    expect(await orderFromParams(params)).toEqual(order);
  });

  it('giftLink resolves from /dropbots/order/ to /dropbots/gift/', async () => {
    const order = sample();
    const link = await giftLink(order, 'https://example.com/dropbots/order/');
    const url = new URL(link);
    expect(url.pathname).toBe('/dropbots/gift/');
    expect(await orderFromParams(url.searchParams)).toEqual(order);
    const play = new URL(await giftLink(order, 'https://example.com/dropbots/order/', '../play/'));
    expect(play.pathname).toBe('/dropbots/play/');
  });
});
