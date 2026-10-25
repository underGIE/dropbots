# THE PLAN — personalised games as gifts

_25 Oct 2026. One page that says what we are doing, in what order, and which
model does which work. Everything else in this repo hangs off it._

## The idea in one paragraph

People pay for gifts that are about *them*. Echoes proved it with a video; we do
it with a game you play together in a room. The customer writes the inside
jokes, names the players, records ten seconds of each voice, picks a vibe. We
turn that into a web game delivered as one link — no app store, no install —
within days, with Avi approving every piece of art before it ships. The engine
never changes per order; the pack (words, art, music, voice) is the whole gift.

## Why web, why one pack contract

- Web: no Apple licence, no store payment rules, unlimited small builds, one
  link that opens on any phone. (Decided 25 Oct.)
- One pack contract across every engine: one intake form, one art pipeline,
  one voice recorder, one delivery step. Five games, one factory.

## The five engines

| # | Engine | One line | Status |
|---|---|---|---|
| 1 | DROPBOTS | 2–4 phones, shout each other's controls, crowd hype | playable, 46 tests |
| 2 | The fighter | friends as fighters; versus + a story mode vs a villain they name | playable hot-seat, 16 tests |
| 3 | Co-op puzzle | one puzzle split across phones, nobody finishes alone | spec next |
| 4 | The moving one | the phone is the controller; play with your body | spike first |
| 5 | Shanzia web-lite | trivia + crossword + gallery from the iOS game, as a link | port, data already exists |

Rule: five is the ceiling until two have been sold.

## How an order flows (see OPERATIONS.md for costs)

intake → pack built in seconds → art first pass → **Avi approves** → voice
(customer-recorded) + music → **Avi plays it once** → link + QR + card.
Target: 90 minutes of Avi per order by order #10. Cost of goods ≈ ₪15–25.

## Missions, in order, with the model that runs each one

Routing rule (Avi's): Sonnet for mechanical and browser work, Opus for
judgment, Fable only where the call is hard or several threads must be held at
once. Codex burns its credits on bulk ports before the 28th.

| # | Mission | Model | Why that model | Done when |
|---|---|---|---|---|
| M1 | Device-motion spike: a page that reads tilt/shake on iPhone + Android and shows the permission flow | **Sonnet** | mechanical, well-documented APIs, the answer is yes/no | a page at `/motion/` with a written verdict per platform |
| M2 | Delivery: QR + printable gift card generated from the pack | **Sonnet** | pure plumbing | `/card/?p=…` prints an A5 card with the QR |
| M3 | Fighter over two phones: secret simultaneous picks, shared reveal, on the existing room/transport | **Opus** | protocol and feel decisions | two tabs fight; tests for the pick protocol |
| M4 | Co-op puzzle: spec + engine core | **Fable** | new mechanic, has to be fun with strangers' content | spec §a–§g, engine with tests |
| M5 | Fighter story mode: ladder, taunts, villain, ending — all pack data | **Opus** | content model + pacing | a 5-fight ladder plays from JSON |
| M6 | Voice: record in the order form, store, play in-game | **Opus** | depends on Supabase Storage (needs Avi's keys) | a recorded line plays on a correct press |
| M7 | Shanzia web-lite: port trivia, crossword, gallery to this stack | **Codex** | bulk mechanical port of data-driven views | three pages play Shani's real content |
| M8 | Image API first pass + approval grid | **Opus**, after Avi's yes | touches his art rule | 8 bot portraits in a grid, approve/regenerate |
| M9 | Order #0: Avi's own order through the whole pipeline, hours logged | **Avi** | it is his product | hours per step in OPERATIONS.md |
| M10 | Playtest with two real humans, filmed | **Avi** | red blocker before any sale | a 30-second video and a list of what broke |

**Live since 25 Oct 07:50 at https://undergie.github.io/dropbots/ (public repo `underGIE/dropbots`, branch deploy).** **Status 25 Oct, 07:40** — M1 (motion spike), M2 (QR card), M3 (duel on two
phones) and M4 (THE LOCKS, engine + playable page) are done and committed; the
suite is 134 green. Pack links are now deflated (`?c=`), which took an
8-joke order from 1960 to 785 characters and the QR from unscannable to the
edge of comfortable. M5 (story mode, 4-fight ladder vs the villain, all pack data, 27 tests) landed 08:30 — 161 green. Order #0 plumbing landed ~09:10: ONE intake for all engines, one deflated gift link (`/gift/?o=`, ~560 chars), hub page, every game builds its pack from the order; `HOURS.md` is the log. 176 green. M6 and M8 wait on Avi. M7 is a Codex brief.

## Gates Avi owns

1. Supabase keys (blocks real phones for every engine, and voice).
2. Image API in the pipeline — yes or no.
3. Payment provider + business registration.
4. The three pilot orders and the agreement to film them.

## What we refuse

Native apps. Sprite sheets of real faces. Any engine change for a customer.
Public use of a pack built from real people's photos. A sixth engine.
