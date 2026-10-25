# Operations: from an order on the site to a finished game in days

Written 25 Oct 2026. The question this answers: how does one person run a
shop that takes orders for personalised games, produces them under his own
supervision, and ships within days — and what does each order cost.

## The pipeline, step by step

| # | Step | Who / what | Today | Target | Avi's gate? |
|---|---|---|---|---|---|
| 1 | Intake — six questions | the site (`/order/`) | **built**, produces a validated pack | same | no |
| 2 | Payment | Grow via Green Invoice: 1.6% + ₪1.2 per charge, ₪29/month on the basic plan; the site needs contact details, terms and a terms checkbox for approval | not built | first ten orders by Bit/PayBox by hand, integrate after | no |
| 3 | Pack build | engine | **built**: a link that carries the whole game, in seconds | same | no |
| 4 | Character art | ChatGPT project, style-locked by `ART_BRIEF.md` | manual, 1–3 h per order, Avi drives every prompt | an image API generates the first pass in minutes; Avi approves or regenerates from a grid — 15 min | **yes** |
| 5 | Their voice | the customer records 10 s per person in the order form | not built | zero labour for us: the customer does it | no |
| 6 | Music | Suno, one track per theme | manual, 15–30 min | a bank of 20 pre-made tracks per world, pick one | light |
| 7 | QA | `validatePack` + the suite + one smoke play | 10 min | same, scripted | **yes** (the one play-through) |
| 8 | Delivery | link + QR + a printable gift card | link exists; QR and card not built | automatic | no |

Target: **90 minutes of Avi per order by order #10**, and under 20 minutes for
a re-theme of a pack he has already shipped once.

The only step that cannot be fully automatic is 4. Everything else is either
already code or becomes the customer's own work (5).

## What one order costs

| Item | Cost | Source |
|---|---|---|
| Images: 12–20 generations with retries | $0.5–2.5 (≈ ₪2–10) at $0.02–0.13 per image | public API pricing, Oct 2026 |
| Music | Suno subscription ≈ $10/month, amortised to pennies | — |
| Hosting | GitHub Pages free; Supabase free tier covers 200 concurrent and 2M realtime messages a month | — |
| Payment fees | 1.6% + ₪1.2 per charge | Grow via Green Invoice |
| **Variable cost per order** | **≈ ₪15–25 all in** | |

So the cost of goods is noise. **The business is priced in Avi's hours:**

| Price | Hours per order | Effective hourly |
|---|---|---|
| ₪199 | 2 h | ≈ ₪90/h |
| ₪199 | 6 h | ≈ ₪30/h |
| ₪199 | 15 h | ≈ ₪12/h — worse than any job |
| ₪690 (class edition) | 4 h | ≈ ₪170/h |

## Prices, per engine (proposal)

| Engine | Tier | Price |
|---|---|---|
| DROPBOTS | 4 decks / 8 decks / class edition | ₪99 / ₪199 / ₪690 |
| The fighter | 4 fighters, versus only | ₪249 |
| The fighter | 8 fighters + story mode against the villain | ₪399 |
| Co-op puzzle | 2–4 phones | ₪149 |
| The moving one | — | not priced until the device-motion spike passes |
| Shanzia web-lite | one recipient, premium | ₪349 |

Every price is one-time, 30-day money back, first round free with no card.
The class edition is the only line with real money per hour: one buyer, one
date, thirty recipients.

## Prototype status

| Engine | Playable | Tests | What a demo still needs |
|---|---|---|---|
| DROPBOTS | yes, 2 tabs; real phones once Supabase keys land | 46 | keys, a two-person playtest |
| The fighter | yes, hot-seat versus | 16 | two phones over the existing room; story mode |
| Co-op puzzle | no | 0 | a spec and a weekend |
| The moving one | no | 0 | a device-motion spike on an iPhone and an Android before anything is promised |
| Shanzia web-lite | no | 0 | port of trivia + crossword + gallery (all data already) |

## The automation order (what to build, in sequence)

1. **Voice in the order form** — moves the most emotional asset to zero labour.
2. **QR + printable card** — one hour, makes delivery automatic.
3. **Image API first pass + approval grid** — the only step that scales; needs
   Avi's decision because it bends his "no unsupervised graphics" rule. The
   rule survives as "nothing ships that Avi did not approve", not "Avi types
   every prompt".
4. **Payment** — only after ten orders by hand prove the demand.
5. **Music bank** — pre-made tracks per world replace per-order Suno sessions.

## Decisions Avi owns

- Image API in the pipeline, with approval, yes or no.
- Payment provider and the business registration behind it (Grow needs a
  registered business; check עוסק status with an accountant).
- The three pilot orders: who, when, and the agreement that they get filmed.
