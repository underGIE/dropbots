# The product line: three engines, one pack contract

Written 25 Oct 2026, after Avi corrected the order of work: **build the games
first, the shop later.**

## The offer

Three games. A customer picks one and we re-theme it for them. Per order the
only things that change are **character graphics, the theme, the music and
their own recorded voice** — never engine code. Reggae becomes rock, becomes
Japan, becomes Pesach, whatever the gift is about.

## The three engines

| # | Engine | What it is | Where it stands | Delivery |
|---|---|---|---|---|
| 1 | **Shanzia** | music adventure: trivia, crossword, map, dub studio | built, deep, 90% theme-clean per its own engine audit (half a day per re-theme) | **iOS native — cannot be sent as a link.** The open question below. |
| 2 | **DROPBOTS** | co-op party game, 2–4 phones shouting at each other | built this week, web, 46 tests, playable now | link + QR, no install |
| 3 | **The fighter** | a group of friends as fighters: versus, plus a story mode that takes down a villain they name. One joint gift, one symbolic payment. See `FIGHTER_SPEC.md` | not built; BamBasti is the web base (lives, 151 tests, combat feel spec) | link + QR |

## What a theme pack is, across all three

Same contract, so one intake form feeds any engine:

| Layer | What the customer gives | What we do |
|---|---|---|
| **Graphics** | photos / a vibe ("rock", "Japan", "Pesach") | character art via the ChatGPT project, style-locked per `ART_BRIEF.md`; file-drop into the engine's slots |
| **Theme** | occasion, inside jokes, names | colours + copy + the word bank, all as JSON — already live in DROPBOTS (`packs/*.json`, `?p=` links) |
| **Music** | genre, or a track they love | Suno-made track per theme; DROPBOTS already keys hype to the beat, Shanzia has riddims |
| **Their voice** | a 10-second recording per person | browser `MediaRecorder` → the crowd, the callouts, the win sting. **This is the part nobody can copy**, and it is not built in any engine yet. |

## The rule that keeps this a business

If a customer's request needs an engine change, the engine has a bug: it should
be reading that from the pack. Hours per order go in the pack spec; a pack over
15 hours means the price or the scope is wrong.

## Decided 25 Oct 2026: everything is web

Avi's call, and the reason is commercial, not technical: a native app drags in
the Apple developer licence and the store's payment rules, and you cannot ship
many small personalised builds through a store at all. A browser game plays fine
on a phone, costs nothing per build, and is delivered as a link.

So: the shared layers — recorded voice, music, art slots, pack JSON — are
written **once, for web**. Shanzia's path is web-lite: trivia, crossword and
gallery are already pure data and port in days; the dub studio stays native and
stays the premium boutique product.

## The market, checked 25 Oct 2026

- **bdaygame.com** sells personalised pixel games as gifts: USD 250 for a fixed
  story with customised dialogue (a few days), USD 450+ for a fully custom story
  (several weeks). Delivered as **Windows files over WeTransfer**, single player.
- **Etsy** sells $30 fake "video game cases" for proposals — the wish exists at
  volume, with no playable product behind it.
- **Israel**: custom escape rooms built from a questionnaire run about ₪500 with
  an operator; event gaming trucks start around ₪330. The event budget is local
  and real, but nobody delivers a personalised digital game.
- **Fiverr** benchmarks a small browser game commission around $80 and a full
  game around $230 — that is the ceiling a one-off commission can charge.
- The personalised gifts category was about USD 30B in 2024 and is forecast at
  5-9% CAGR, so personalisation itself is not the risk.

**The gap:** nobody sells a personalised, link-delivered, multiplayer party game.
bdaygame is single player, download-only and Windows. Our edge is web delivery,
two to four phones in a room, Hebrew, and the recorded voice.

**The constraint:** hours per order. At 15 hours an order ₪199 is a loss. The
whole business is "engine fixed, pack is data" and an order that takes under
three hours.
