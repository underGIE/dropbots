# DROPBOTS

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

Two tabs, same room code (the code can ride in the link: `/#PRTY`).
