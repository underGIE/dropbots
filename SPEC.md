# TWO DJS — spec of record (v1)

A co-op party game you give as a gift. 2–4 phones in one room, one room code,
Spaceteam loop re-skinned as a DJ booth: the instruction on YOUR phone belongs to
SOMEONE ELSE's deck, so you have to shout it. Crowd hype replaces hull integrity.

Business frame: the engine never changes per customer. A **theme pack** is pure data
(control vocabulary, crowd samples, song, intro card, photos). Marginal art cost per
order is one cropped photo per player — no generated sprites, no character consistency
problem. That is what makes a self-serve gift funnel possible at all.

## §a — The loop (30 seconds of play)

1. Each player's phone shows a **deck**: a grid of 4–8 labelled controls (their own
   inside jokes: "תוריד את הבס של שרון", "טיפקס", "סבתא על הרמקול").
2. The phone also shows **one instruction**, which names a control that is (usually)
   on a DIFFERENT player's deck.
3. You read it out loud. The owner finds it and presses it before the deadline.
4. Correct press → crowd hype up, next instruction for that player.
   Wrong press or deadline passed → hype down, new instruction.
5. Every `dropEverySec` a **DROP** wave fires: deadlines shorten, hype swing doubles.
6. Match ends on `targetScore` reached (win) or hype hitting 0 (crowd walks out).

## §b — Decided (not open)

- **Delivery = web, one private URL + QR. No app store, ever.** Native is what
  blocks Shanzia from being a gift; this product refuses that dependency.
- **Transport is abstracted.** `BroadcastTransport` (BroadcastChannel) for same-device
  / dev / tests, `SupabaseTransport` (realtime broadcast channel, ephemeral, no DB
  writes) for real phones. The engine never imports a transport.
- **The host is a client.** Lowest-id player holds authoritative match state and
  broadcasts snapshots; others send intents. No server-side game logic, no DB rows.
- **Pure engine, seeded RNG.** Every engine function is deterministic given a seed,
  so a match is reproducible in a test.
- **Hebrew-first, RTL.** Labels are content, not code; LTR packs work unchanged.
- **Solo practice mode ships in v1.** A gift opened by one person alone must still
  do something, or it is a refund.

## §c — Theme pack contract (the only thing that varies per customer)

`packs/<slug>.json`:

| field | what |
|---|---|
| `title`, `subtitle` | shown on the intro card |
| `intro.names` | the recipients, printed before round 1 (Echoes' proven "personal intro") |
| `controls[]` | `{id, label, kind}` — the inside-joke vocabulary. Needs >= 4 per player |
| `instructionTemplates[]` | phrasings with `{label}` placeholder, e.g. "דחוף {label}!" |
| `tuning` | `targetScore`, `startHype`, `baseDeadlineMs`, `dropEverySec`, `hypeUp`, `hypeDown` |

Nothing else. If a customer request needs an engine change, the engine has a bug.

## §d — Session shape

Lobby (room code, names) → intro card → live waves → result screen with the crowd
verdict and a shareable line. Target match length 3–5 minutes.

## §e — Pricing (mirrors Echoes' one-time gift ladder)

₪99 four decks (family) · ₪199 eight decks (friends/holiday) ·
₪690 class edition (bracket on a projector). One-time, no subscription,
30-day money back, first round free with no card.

## §f — Open, needs Avi

1. Supabase project for the game (own project, or a second schema on PARTYAH's).
2. Crowd samples + which Suno track ships with the demo pack.
3. Playtest with 2 real humans in one room — red blocker before any order is taken.

## §g — Not in v1

Real-time scoreboard across rooms, the fighter pack, photo sleeves, bracket mode,
accounts, payments. v1 ends at "two phones in a room have fun for 4 minutes".
