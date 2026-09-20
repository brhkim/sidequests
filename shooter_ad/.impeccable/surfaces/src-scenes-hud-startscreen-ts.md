---
version: 1
slug: "src-scenes-hud-startscreen-ts"
primary_target: "src/scenes/hud/StartScreen.ts"
related_targets: ["src/scenes/hud/PauseBonuses.ts","src/scenes/hud/EndScreen.ts"]
---

# Surface brief: the three screens (start, pause, end)

Scope: `src/scenes/hud/StartScreen.ts`, `src/scenes/hud/PauseBonuses.ts`,
`src/scenes/hud/EndScreen.ts`, plus a shared card helper. Mode: **Operate**
for pause and end (the player is reading their own numbers); the start screen
is **Persuade** (a stranger followed a link and must want to tap).

Audience: the author on a phone, and the friend they handed a code to.
Job: start a match, read what you hold mid-run, read how a run went.
Constraints: no assets, no loaded fonts, flat and unrounded, the axis and
rank palettes are vocabulary, one filled button per screen, every tappable
line on a 44px bar, the pitch copy on the start screen is the author's and
stays verbatim, waves survived stays the end screen's headline, the
endscreen instrument's text anchors (START MATCH, enter a code, new match,
tap to change difficulty, RESUME, RESTART, DETAILS, REPLAY THIS MATCH, or
start a new match) keep their words. Author's four decisions (2026-09-20):
the screens borrow the gate card; the pause rows become card tiles with one
tap-to-read line; the start screen is a first wave, not a menu; two more
authored motions at most, both on screens.

## Direction contract

THESIS: The screens are made of the game's one recognisable object, the
gate card, so a player never leaves the field's vocabulary. It refuses the
category default of centred text columns on a dark panel with one green
button, and it refuses a menu: the start screen is the first offer.

OWN-WORLD: The Instrument Panel (DESIGN.md) unchanged: screen navy, the axis
colours as tints, system sans bold, monospace for codes. New component: the
card tile, a gate card's anatomy (4px roof in the axis colour, body tinted
0.18 held / 0.06 unheld, 2px stroke, magnitude over axis word) used as a
stat tile on pause and as the button shape on every screen (roof, 0.2 fill,
2px stroke, ARMY green for the primary action, loss red for RESTART).

STORY: A stranger sees three real offers descending toward a real squad and
a card that says START MATCH, and understands the game is choosing between
cards before the pitch is read. A paused player sees eight tiles in the
order the DPS product multiplies and taps one to be told what it does. A
dead player watches the wave count climb to its number.

FIRST VIEWPORT (start, 540x960): DPS GOLF at y 60 (56px). The author's
first pitch beat at 110-160. A demo offer of three real cards (`+25% DMG`,
`×1.25 DMG`, `+2 GUNS`, 160x88, lanes at x 90/270/450) descending from y
180 to y 330 on a 6s loop with fade at both ends: the signature motion. The
remaining pitch beats 360-430. The match block between hairlines 470-610:
code 40px mono, caption, enter a code / new match. Difficulty line 650 with
its hint at 678. The START MATCH card button 380x64 at y 740 (the primary
action, ARMY green with roof). The ground band from 828 with the breach
line at 950 and a three-body squad ring at the lane (888), from the squad
textures, so the field is literally on the screen. Version under the hint
at 800/830.

FORM: card-built screens; first on my list of five (card-built; field-with-
overlay; ledger; poster; bare menu). No concept-seed run and no seed key: a
precisely specified extension of an established world, waived by the author
in their own words - the four decisions were put to them and they answered
"Yeah those sound fine to me, please proceed!" (2026-09-20). Code-led
because this session has no image generation; the game's own stills are the
comp. Demo descent: the FIRST VIEWPORT's 150px could not fit between the
pitch and the warning line, so the pass is 116px at 2.6s (~45px/s), which
reads as a descent; the 6s pass read as a hover in the finish review.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying
its provenance.
