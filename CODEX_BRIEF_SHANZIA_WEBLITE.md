# Codex brief — M7: Shanzia web-lite (burn credits before 28 Oct)

Paste this to Codex as the task. Mechanical port, no design decisions.

## Context
Repo: `~/Documents/Claude/Projects/Dropbots` — Vite multi-page app, TypeScript
strict with `noUncheckedIndexedAccess`, vitest, vanilla DOM, Hebrew RTL. Read
`PLAN.md`, then `src/main.ts` and `src/order/main.ts` for the page style, and
`src/engine/rng.ts` for the seeded RNG every engine uses.

Source content lives in the iOS game:
`~/Documents/Claude/Projects/shanzia/reggae-trivia-game/` —
`questions.json`, `questions_legends.json`, `crosswords.json`, `tashhetz_v4.json`
(+ `TASHHETZ_SCHEMA.md`), `records.json`, `hotspots.json`. Copy the files you need
into `public/shanzia/` in this repo; do not edit the originals.

## Deliver three pages, pure data in, playable out
1. `/quiz/` — trivia from `questions.json` (+ legends tier if the schema is the
   same): 10 questions a round, seeded shuffle, score, a results screen. Engine in
   `src/shanzia/quiz.ts` (pure, tested), UI in `src/shanzia/quiz-main.ts`.
2. `/crossword/` — the classic crossword from `crosswords.json`: RTL grid, tap a
   cell, type, check. Engine `src/shanzia/crossword.ts` (pure: placement from
   the JSON, validation of a filled grid), tests for validation.
3. `/gallery/` — the records/collectibles from `records.json` as a browsable
   grid with a detail card.

Register each page in `vite.config.ts` `input`. Put page CSS in
`src/shanzia/*.css`, **do not edit `src/ui/styles.css`**.

## Rules
- Pure engines, vitest tests for every engine function; `npx tsc --noEmit` and
  `npx vitest run` green before you stop.
- Do not change any schema. If a JSON field is unclear, read
  `TASHHETZ_SCHEMA.md` and the Swift loaders under
  `~/Documents/Claude/Projects/shanzia/ShaniSoundSystem/` for the meaning —
  read only.
- No dev server runs needed; no commits — leave the tree for review.
- Placeholder design: grey boxes, big type, RTL correct.

## Report
Files written, test counts, which JSON fields you had to interpret and how,
and anything in the content that would not load.
