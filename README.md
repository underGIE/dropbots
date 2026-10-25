# DROPBOTS

Live: https://undergie.github.io/dropbots/ — `npm run deploy` republishes.

Co-op party game for 2–4 phones in one room, sold as a one-time gift.
The instruction on your screen names a control on somebody else's deck, so you
have to shout it. Crowd hype instead of hull integrity.

- `SPEC.md` — the spec of record (§a–§g), including what is decided and what is open.
- `src/engine/` — pure, seeded, deterministic match logic. No DOM, no network.
- `src/net/room.ts` — the host is a client: it owns state, applies presses, ticks, broadcasts.
- `src/transport/` — `broadcast.ts` (BroadcastChannel, same browser) and `local.ts` (tests).
  A Supabase realtime transport implements the same interface for real phones.
- `packs/*.json` — the theme pack: the ONLY thing that changes per customer.

```bash
npm install
npm test      # engine + two-client room tests
npm run dev   # http://localhost:5174
```

Three pages: `/` the sales page, `/order/` the six-question intake (answers →
validated pack → straight into the game), `/play/` the game itself.
Two tabs, same room code; the code rides in the link (`/play/#PRTY`).

With `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env.local` the rooms run
over Supabase realtime broadcast and real phones can join. Without them the same
rooms run over BroadcastChannel in one browser. The engine does not know which.
