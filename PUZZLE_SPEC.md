# Engine #4 — THE LOCKS (co-op puzzle, 2–4 phones)

_Spec of record, 25 Oct 2026._

## §a — The loop

A row of locks. Each lock asks two or three questions **about the family or the
group** — the customer wrote them in the intake ("איפה סבא וסבתא נפגשו?",
"השיר שאמא שרה במקלחת"). The trick: **the answers are split across the phones.**

- One phone holds **the lock**: it sees the questions with multiple-choice
  options and must pick.
- Every other question's answer sits on a **different phone** as a clue card.
  Only its holder can see it. They have to say it out loud.
- Pick right → the lock opens, the next one appears, the lock passes to the
  next phone. Pick wrong → a strike. Three strikes and the door stays shut.
- A clock runs across the whole row. Open every lock before it ends.

Nobody can finish alone: the lock holder cannot see the answers, the clue
holders cannot touch the lock. Solo play gives you all the cards and is a quiz.

## §b — Decided

- Same room, same transport, same host-as-client as DROPBOTS and the fighter.
- Pure engine, seeded. Dealing which phone holds which clue is deterministic
  from the seed, so a round can be replayed in a test.
- **Distractors come from the pack itself** — wrong options are other facts'
  answers — so a stranger's content still makes a real puzzle and nobody can
  guess from general knowledge.
- Minimum content: `locks × cluesPerLock` facts, every answer unique. The
  intake tells the customer how many more facts to write, exactly like the
  DROPBOTS joke counter.
- The lock rotates, so every phone holds it at least once in a six-lock row.

## §c — Pack contract (adds to the shared pack)

`facts[]`: `{ id, prompt, answer }`. Optional `photo` per fact for later.
`locks`: how many in the row (default 6). `cluesPerLock`: 2 or 3.
`tuning`: `secondsTotal` (default 300), `strikes` (default 3).

## §d — Not in v1

Photos on cards, hints, difficulty tiers, a story between locks, more than four
phones.

## §e — Open for Avi

1. Does a wrong pick also cost time (−20 s) or only a strike?
2. Four phones with two clues per lock leaves one phone idle each lock — give
   that phone a decoy card, or accept the breather?
