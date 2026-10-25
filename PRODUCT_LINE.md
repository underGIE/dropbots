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
| 3 | **The fighter** | friends as fighters, short rounds | not built; BamBasti is the web base (lives, 151 tests, combat feel spec) | link + QR |

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

## Open, blocks the build order

**Shanzia is native iOS.** Three ways to go, and this is Avi's call:

1. **Web port of Shanzia** — the content (questions, crosswords, map, records)
   is already JSON and portable; the Swift UI and the audio engine are not.
   Weeks of work, and it would make all three engines deliverable by link.
2. **Shanzia stays the premium boutique product** — one recipient, one phone,
   needs the paid Apple account; the link-delivered line is DROPBOTS + fighter
   + a third web game.
3. **Shanzia web-lite** — port only trivia + crossword + gallery (the parts that
   are pure data), leave the dub studio native. Days, not weeks.

Nothing else should be built until that is answered, because it decides whether
the shared layers (voice, music, art slots) are written once for web or twice.
