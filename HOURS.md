# Hours log — the business model, measured

One row per step per order. Minutes of a human, not of a machine. Machines are
free; this table is the price.

The rule from OPERATIONS.md: **≤ 180 min of Avi per order by order #10**, under
20 min for a re-theme of a pack already shipped. An order over 15 hours means
the price or the scope is wrong — fix that before the next one.

## How to log

Start a timer when you open the step, stop it when you hand it on. Round to 5
minutes. "Who" is `Avi`, `ChatGPT` (Avi driving), `Claude`, or `customer`.
Anything the customer did themselves (recording voice, writing facts) costs 0
and is logged as such — that is the point of the form.

## Order #0 — Avi's own order (the dry run)

Date started: ____ · Occasion: ____ · Engines wanted: ____

| # | Step | Who | Start | End | Min | Notes (what was slow, what broke) |
|---|---|---|---|---|---|---|
| 1 | Intake — fill the form at `/order/` | customer | | | | |
| 2 | Payment | — | | | | skipped on #0 |
| 3 | Pack build — the gift link exists | machine | | | 0 | automatic |
| 4 | Character art (ChatGPT project, `ART_BRIEF.md`) | Avi | | | | prompts written / regenerated |
| 5 | Voice (not built yet) | — | | | | |
| 6 | Music (Suno) | Avi | | | | |
| 7 | QA — one play-through of each engine | Avi | | | | |
| 8 | Delivery — link + QR card handed over | Avi | | | | |
| | **Total human minutes** | | | | **0** | |

### After the dry run, answer

1. Which step ate the most minutes? That is the next thing to automate.
2. What did the customer (you) not understand on the form? Fix the copy.
3. Did any engine come out "not ready"? Was the missing-line text enough to fix it?

## Order #1 — first real pilot

(copy the table above)
