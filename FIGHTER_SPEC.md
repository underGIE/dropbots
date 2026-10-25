# Engine #3 — the fighter (working title)

From Avi, 25 Oct 2026: a group of friends club together for one joint gift.
Everyone in the group is a fighter. Two ways to play, both in the same build:

- **Versus** — any two of them fight, on one screen or two phones.
- **Story mode** — the whole group works down a ladder of fights to take out
  **the villain**, who is someone they choose and name (the boss, the one who
  always cancels, the groom's future father-in-law).

They send one request with all the details, pay a small symbolic sum, and it runs.

## §a — What the buyer fills in

The same six-question shape as DROPBOTS, plus the parts a fighter needs:

| Field | Becomes |
|---|---|
| fighters: name + photo + one trait each | roster, portrait, and that trait's special move |
| the villain: name + photo + why | final boss, their taunt lines, the ending card |
| group in-jokes | move names, crowd shouts, KO lines |
| occasion | intro card and the ending |
| vibe (rock / Japan / 80s / whatever) | art style lock and the soundtrack |

## §b — Decided

- **Web, link-delivered.** Same rule as DROPBOTS: no app store, no install.
- **Two poses per fighter, never a sprite sheet.** Idle and hit, plus a portrait.
  Consistent multi-frame animation of a real person's likeness is the one art
  problem that reliably fails; the engine must look good without it.
- **No frame data, no combos.** Timing-and-choice combat (a round is reads and
  commitment, not execution), so it is fun on a phone and fair between a gamer
  and an uncle who never plays.
- **Built on the BamBasti base** — that web game already has combat feel work
  and 151 tests. The fighter is a mode on top, not a new codebase.
- **Story mode is content, not code.** The ladder, the taunts and the ending are
  pack JSON, exactly like DROPBOTS' controls.

## §c — Open, for Avi

1. Versus on one phone (hot seat) in v1, or two phones from the start?
2. How many fighters does one gift seat — 4, 6, 8?
3. The villain's photo is usually of a real person who did not consent. Private
   build only, no public gallery, no marketing with it. Confirm that is the rule.
4. Symbolic price: what number, and is it per group or per fighter?

## §d — Not in v1

Online matchmaking, ranked play, more than two poses, voice acting beyond the
recorded one-liners, a store.
