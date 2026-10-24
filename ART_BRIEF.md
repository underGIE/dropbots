# DROPBOTS — art brief (style-locked, generate-only)

Pipeline rule, unchanged: **ChatGPT generates, Avi downloads, nothing here makes
public art by hand.** This file is the brief that goes into a ChatGPT project
called "GRAPHICS FOR DROPBOTS". Claude never extracts images from that session.

The game ships playable with the current grey boxes. Art drops into the slots
below without touching engine code — every path is referenced from a pack JSON.

## The name

**DROPBOTS** — the drop is the one word techno, trance, disco and hip-hop all
share, and the robots are the crew you play as. Plural, so it scales to packs
("DROPBOTS: Purim Edition"). Runner-ups if you want to switch: SYNC OR SINK
(names the co-op mechanic), KILOWATT, BASSBOT.

## Style lock — paste this line into EVERY prompt, unchanged

> Retro-futuristic club robots, chunky 1980s industrial hardware crossed with
> modern club gear, thick clean outlines, flat cel shading with one hard rim
> light, limited 6-colour palette per image, matte plastic and brushed metal,
> no photorealism, no lens flare, no gradients wider than a third of the frame,
> no text or letters anywhere in the image, dark club background, square format.

Anything that does not carry that line is off-model and gets regenerated.

## Four worlds (each is a pack skin, data only)

| World | Palette anchor | Bot read |
|---|---|---|
| TECHNO | near-black `#07080c`, violet `#b14cff`, mint `#17e5b0` | industrial, exposed cables, single visor eye |
| TRANCE | deep blue `#060b1f`, cyan `#36d8ff`, white bloom | smooth chrome, halo ring, softer silhouette |
| DISCO | warm brown `#140d0a`, gold `#f0b429`, hot pink `#ff5fa2` | rounded, mirror-ball facets, wide collar |
| HIP-HOP | charcoal `#0d0d0d`, orange `#ff7a1a`, concrete grey | boombox chest, thick gold chain, cap, bold blocky |

## Asset slots

Generate per world unless the row says "once". Square 1:1 unless noted.

| # | Asset | Count | Format | Lands in |
|---|---|---|---|---|
| A1 | Bot DJ crew portraits, one per player seat | 4 per world | PNG, transparent, 1024² | `Content/<world>/bots/bot-1..4.png` |
| A2 | Control icons (pad / knob / fader / fx), flat glyphs on the world palette | 4 per world | PNG, transparent, 512² | `Content/<world>/icons/<kind>.png` |
| A3 | Booth backdrop, empty centre so the UI sits on top | 1 per world | PNG, 1536×2048 (9:16-ish) | `Content/<world>/backdrop.png` |
| A4 | Crowd meter: the same crowd at hype 10 / 50 / 100 | 3 per world | PNG, 1024×256 | `Content/<world>/crowd-<low/mid/high>.png` |
| A5 | DROP overlay — a single burst frame, transparent | 1 per world | PNG, transparent, 1024² | `Content/<world>/drop.png` |
| A6 | DROPBOTS wordmark, letters drawn as machine parts | once | PNG, transparent, 2048×512 | `Content/brand/wordmark.png` |
| A7 | Share card: two bots facing each other over a booth | once | PNG, 1200×630 | `Content/brand/share.png` |
| A8 | App icon, one bot head, legible at 64px | once | PNG, 1024² | `Content/brand/icon.png` |

## Prompt skeletons

Replace `<WORLD>` and the palette, keep everything else:

**A1 bot** — `Portrait of a <WORLD> club DJ robot, waist up, facing the viewer,
holding one hand on a mixer, palette <anchors>. <style lock>`

**A2 icon** — `A single flat icon of a <pad / rotary knob / channel fader / FX
button>, centred, no background, palette <anchors>. <style lock>`

**A3 backdrop** — `An empty <WORLD> DJ booth seen head-on, speakers stacked left
and right, the centre third deliberately empty and unlit, palette <anchors>.
<style lock>`

**A4 crowd** — `A wide silhouette crowd in a <WORLD> club, <bored and still /
nodding / arms up screaming>, seen from the booth, palette <anchors>. <style lock>`

## Hard rules

- **No text in any image.** Hebrew gets mangled; all labels are live DOM text.
- **No real faces, ever** — these are robots. Customer photos stay private, and a
  pack built from someone's photos is a private build that is never shown publicly.
- Transparent background wherever the table says transparent; no baked shadows.
- Every asset of one world comes out of one session, so the palette stays locked.
- Reject and regenerate anything with: letters, a watermark, photoreal skin,
  a gradient background, or a fifth hue outside the world palette.

## Acceptance pass before filing

1. Open the four A1 bots of a world side by side — they must read as one crew.
2. Shrink A8 to 64px: still a bot head, not mush.
3. Drop A3 behind the live screen: the shout banner must still be readable.
4. Only then file into `Content/<world>/` and add the paths to that world's pack.
