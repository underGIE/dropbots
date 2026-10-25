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

## §story — Story mode (M5, 25 Oct)

One phone, one human. They pick themself from the group's roster and climb a
ladder of fights against the other friends (computer-driven) up to the villain.
Everything that makes it theirs is pack JSON; the rules are code that never
changes per order.

### Data shape (`packs/fighter-demo.json`, types in `src/fighter/story-types.ts`)

```
{
  "slug", "title", "subtitle",
  "roster":  [ { id, name, trait, special, art?, standIn? } ],   // ≥ 2 friends
  "villain": { id, name, trait, special, art?, intro, defeatLine, taunts: [..], hpScale },
  "ladder":  [ { opponent: "<roster id>" | "villain", intro, persona } ],  // villain last, once
  "ending":  { title, text }
}
```

`persona` is one of `brawler | turtle | trickster | boss`. `validateStoryPack(pack)`
returns plain-words errors (empty list = it plays): missing fields, fewer than 2
fighters, duplicate or reserved ids (`"villain"` is reserved), the villain sharing
an id with a friend, a ladder naming someone not in the roster, an unknown
persona, the villain not last (or twice), empty taunts or an empty taunt,
`hpScale` outside 1–3, no ending, and — walked for every possible hero — a hero
who would have to fight themself with nobody left to take that fight.

### Decisions

- **Nobody fights themself: stand-ins.** A rung written for the hero goes to the
  first roster friend who is *not on the ladder at all* (roster order); each
  stand-in is used once. The stand-in keeps the rung's persona. Because the
  rung's intro line was written about the friend it names, a stand-in uses their
  own optional `standIn` line instead (fallback: a generic "takes the empty
  spot" line). With 4 friends and 3 friend rungs, every hero meets the other
  three. If every friend is on the ladder, validation refuses the pack.
- **The villain's extra health is an HP override, not a tuning change.** The
  fight starts from `createDuel` and then sets `hp[1] = round(startHp × hpScale)`
  (60 → 90 in the demo). Damage numbers are identical for both sides, the boss
  just lasts longer. The story keeps `maxHp` per side and the bars draw against
  it (the shared `bars()` helper takes an optional `maxHp`; versus modes pass
  nothing and are unchanged).
- **The human is always side 0**, so they attack first in every fight; from then
  on `playRound` alternates as usual, and on the computer's attack turns the
  human picks a guard against a hidden, already-rolled attack.
- **Personas are weighted tables** (`src/fighter/ai.ts`). Brawler leans strike
  (6/2/2), turtle leans block/counter (5/1/4), trickster leans grab and dodge.
  Each has a chance to fire the special when it is available (brawler 0.7,
  turtle 0.35, trickster 0.5); none can use it while `canSpecial` is false.
- **The boss adapts.** It fires the special the first turn it is available. On
  attack it adds +2 to each attack that lands clean on each of the human's last
  two guards (a human who keeps blocking sees fewer strikes). On defence it adds
  +2 to the guard that stops each of the human's last two attacks, and +3 to
  counter when the human's special is ready. "A little": the base table still
  dominates after one read.
- **The AI needs the human's history,** which `DuelState` does not keep, so
  `aiAttack/aiGuard` take an optional fifth argument `{ attacks, guards }`; the
  story keeps the last two of each, per fight.
- **Seeded and pure.** No rng object lives in the state: each roll is
  `makeRng(hash(seed, rung, attempt, round))`, so a story replays exactly from
  its seed and `aiChoice(state)` can be peeked (the tests do).
- **Continues.** Start with 2. A loss spends one and retries the same rung at
  full health; a loss with 0 left ends the story. Every rung starts at full
  health. A retry at the villain rolls a fresh taunt.
- **Count.** The demo ladder is 3 friends + the villain = 4 fights (PLAN.md's
  "5-fight ladder" assumed 5 rungs; the decided shape is 4 friends in the roster,
  so 4 fights).
- **Text is neutral on gender.** The pack has no gender field, so story-mode
  lines avoid gendered verbs about the hero or the opponent ("הניצחון של מיכל",
  not "מיכל ניצח"). The shared attack/guard screens still say "אתה".
