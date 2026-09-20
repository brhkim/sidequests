---
name: shooter_ad (DPS Golf)
description: A 540x960 portrait Phaser 4 canvas; dark navy instrument panel, one colour per bonus axis, white-with-black-detail creatures at 2x.
colors:
  ground: "#0a0c14"
  lane: "#151a2b"
  ground-band: "#171d2e"
  panel: "#0b0f1c"
  screen: "#05070f"
  hairline: "#2a3350"
  track: "#1b2236"
  track-wide: "#232b40"
  text: "#e8ecf8"
  text-bright: "#f2f6ff"
  text-working: "#c9d2ea"
  caption: "#8f9ab5"
  small: "#6f7b99"
  strip-sub: "#8b99bb"
  disabled: "#4d5670"
  axis-army: "#3ecf7a"
  axis-rate: "#ffc93c"
  axis-damage: "#ff6b4a"
  axis-guns: "#b56bff"
  axis-pierce: "#6be8d4"
  axis-move: "#4ea8ff"
  axis-time: "#ff9fe0"
  axis-sense: "#eaf2ff"
  grade-perfect: "#3ecf7a"
  grade-good: "#ffc93c"
  grade-bad: "#ff4757"
  grade-risk: "#c9a7ff"
  breach: "#ff4d5e"
  loss: "#ff5566"
  fire: "#ff8a5c"
  warning-text: "#ff7b54"
  standing-above: "#6ee7a0"
  standing-near: "#ffd166"
  standing-low: "#ff9f4a"
  cage: "#b9a06a"
  shield: "#bcd8ff"
  bullet: "#fff3b0"
  enemy-bullet: "#ff2fa6"
  titan: "#6b2b8c"
  titan-edge: "#bf8fdc"
  titan-text: "#e9d5ff"
  code: "#9fe8ff"
  link: "#6be8d4"
  skin: "#f2c9a0"
  white: "#ffffff"
typography:
  display:
    fontFamily: "system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    letterSpacing: "2px"
  headline-number:
    fontFamily: "system-ui, sans-serif"
    fontSize: "112px"
    fontWeight: 700
  heading:
    fontFamily: "system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    letterSpacing: "0"
  magnitude:
    fontFamily: "system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
  value:
    fontFamily: "system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 700
  button:
    fontFamily: "system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    letterSpacing: "1px"
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.3
  link:
    fontFamily: "system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
  note:
    fontFamily: "system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.25
  caption:
    fontFamily: "system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
  label:
    fontFamily: "system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    letterSpacing: "1.5px"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "40px"
    fontWeight: 700
  working:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "16px"
    fontWeight: 400
rounded:
  none: "0px"
spacing:
  hairline: "1px"
  roof: "4px"
  bar: "6px"
  gap: "8px"
  fade: "12px"
  bracket: "14px"
  hit-bar: "44px"
  button-h: "56px"
  tally-h: "64px"
  start-button-h: "64px"
  rail: "72px"
  gate-h: "88px"
  tally-w: "88px"
  tile-w: "120px"
  demo-w: "160px"
  button-w: "300px"
  start-button-w: "380px"
components:
  button-primary:
    backgroundColor: "{colors.axis-army}"
    textColor: "{colors.axis-army}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    width: "{spacing.button-w}"
    height: "{spacing.button-h}"
  button-primary-start:
    backgroundColor: "{colors.axis-army}"
    textColor: "{colors.axis-army}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    width: "{spacing.start-button-w}"
    height: "{spacing.start-button-h}"
  card-tile:
    backgroundColor: "{colors.axis-army}"
    textColor: "{colors.text}"
    typography: "{typography.magnitude}"
    rounded: "{rounded.none}"
    width: "{spacing.tile-w}"
    height: "{spacing.gate-h}"
  card-tile-unheld:
    backgroundColor: "{colors.axis-army}"
    textColor: "{colors.text}"
    typography: "{typography.magnitude}"
    rounded: "{rounded.none}"
    width: "{spacing.tile-w}"
    height: "{spacing.gate-h}"
  tally-footprint:
    backgroundColor: "{colors.grade-perfect}"
    textColor: "{colors.text}"
    typography: "{typography.magnitude}"
    rounded: "{rounded.none}"
    width: "{spacing.tally-w}"
    height: "{spacing.tally-h}"
  button-pause:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.caption}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    width: "88px"
    height: "44px"
  text-link:
    textColor: "{colors.link}"
    typography: "{typography.link}"
    height: "{spacing.hit-bar}"
  tappable-line:
    textColor: "{colors.caption}"
    typography: "{typography.link}"
    height: "{spacing.hit-bar}"
  gate-card:
    backgroundColor: "{colors.axis-army}"
    textColor: "{colors.text}"
    typography: "{typography.magnitude}"
    rounded: "{rounded.none}"
    height: "{spacing.gate-h}"
  rail-cell:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    typography: "{typography.value}"
    height: "{spacing.rail}"
  strip-cell:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text-bright}"
    typography: "{typography.magnitude}"
    padding: "0 0 0 18px"
  sense-tag:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.axis-sense}"
    typography: "{typography.label}"
    width: "64px"
    height: "22px"
---

# Design System: shooter_ad (DPS Golf)

## Overview

**Creative North Star: "The Instrument Panel"**

There was no direction contract for this world. It is code-led, with no comp:
the system below is read off the shipped build (`.verify/*.png`, 2026-09-19)
and the modules that draw it, not off a plan. Where this record and the code
disagree, the code is stale or this record is; re-scan rather than defend.

The game is a dark navy field with a data rail and a data strip stacked above it,
and every colour on it is a word: an axis, a rank, a grade, a threat. The
three screens are built from the field's one recognisable object, the gate
card: a stat tile on pause, a scorecard footprint on the end screen, and the
shape of every primary button (2026-09-20; `hud/CardTile`). The
squad is human (skin head, rank-coloured shirt); everything it fights is a
creature drawn white-with-black-detail and tinted at runtime, because the
build ships no asset files at all. Type is the system sans everywhere and the
system monospace for match codes and the DPS working, because nothing may be
fetched. The one rule under all of it: rendering is a photograph of the
simulation and never feeds it.

**Key Characteristics:**
- Flat, opaque, unrounded. Depth is a Phaser depth number, never a shadow.
- One colour per bonus axis; both forms of an axis share it.
- Text on the field is bold and never dimmer than `{colors.small}`.
- Three authored motions, one per place (the pick wash on the field, the
  demo offer's descent on the start screen, the end screen's count-up);
  everything else is a state flash of a fixed duration from `RENDER.moments`.
- Procedural everything: textures, audio, labels.

## Colors

A near-black navy ground with a handful of saturated vocabulary hues, each of
which means exactly one thing.

### Primary (vocabulary: must not change)
- **Axis colours** (`AXIS_COLOR` in `src/data/gates.ts`): ARMY green
  `{colors.axis-army}`, RATE amber `{colors.axis-rate}`, DMG coral
  `{colors.axis-damage}`, GUNS violet `{colors.axis-guns}`, PIERCE mint
  `{colors.axis-pierce}`, MOVE sky `{colors.axis-move}`, TIME pink
  `{colors.axis-time}`, SENSE near-white `{colors.axis-sense}`. Used on the
  gate card (fill, stroke, roof), the strip and pause-list labels, the rail's
  SENSE pips, and the `+N ARMY` floats. A player reads the axis off the tint.
- **Rank palette** (`TIERS` in `src/data/tiers.ts`, twelve rows, cycling):
  Grey `#9aa3b5`, Green `#4ad07a`, Blue `#4aa8ff`, Purple `#a96bff`, Orange
  `#ff9838`, Red `#ff4757`, Bronze `#c87f3a`, Silver `#d7dde8`, Gold
  `#ffd24a`, Platinum `#9fe8ff`, Diamond `#7af0d8`, Prismatic `#ff8ff0`. Worn
  by squad shirts, the ARMY cell's rank word, and squad bullets by density
  (tier 0 is cream `{colors.bullet}`). Row 12 wears Grey again; the cycle is
  unmarked by design.
- **Creature colours** (`src/data/enemies.ts`, body / accent): Grunt olive
  `#7f8a63`, Runner yellow `#e8d44d`, Brute brick `#b5473f`, Shielder slate
  `#5b7fa8` / plate `{colors.shield}`, Splitter green `#63c76a`, Bomber orange
  `#ff7a2f` / ember `#ffe066`, Spitter teal `#3fc9c9`, Lancer indigo `#6a5acd`,
  Titan purple `#8a3fb8` / eyes `#ffd7ff`. No body wears the enemy-bullet
  magenta `{colors.enemy-bullet}`.

### Secondary (feedback)
- **Grades** (`GRADE_COLOR`): PERFECT `{colors.grade-perfect}`, GOOD
  `{colors.grade-good}`, BAD `{colors.grade-bad}`, and RISK
  `{colors.grade-risk}` (lavender, off every axis colour) for a MOVE / TIME /
  SENSE pick, which is told rather than graded. The pick wash, the end
  screen's tally footprints (MISS, which is no grade, wears
  `{colors.caption}`), and the pick cues.
- **Breach red** `{colors.breach}`: the horizon glow, breach ticks, the
  Titan-landing horizon flash, the edge flash on contact or breach.
- **Loss red** `{colors.loss}`: `-N` floats, `MISS`, the OVERRUN heading, the
  overrun edge flash, the standing bar and DPS figure below 65% of target.
- **Fire orange** `{colors.fire}`: the edge flash and ARMY-cell float when
  enemy fire lands. The start screen's warning line and HARD tag use
  `{colors.warning-text}`.
- **Standing** (rail bar and DPS figure): `{colors.standing-above}` at or
  above par, `{colors.standing-near}` above target, `{colors.standing-low}`
  above 65% of target, else `{colors.loss}`.
- **Cage tan** `{colors.cage}`: cage bars, its HP bar and `+N` caption.
- **Titan purple** `{colors.titan}` with edge `{colors.titan-edge}` and text
  `{colors.titan-text}`: the warning band, the boss bar, the TITAN DOWN band.
- **Code cyan** `{colors.code}` for match codes and the active pause tab
  underline; **link teal** `{colors.link}` for text links.

### Neutral
- **Ground** `{colors.ground}` (field and rail backing at 0.96), **lane**
  `{colors.lane}` (the 260px band around the squad), **ground band**
  `{colors.ground-band}` (y 740 to the breach line), **panel**
  `{colors.panel}` (strip, pause button, SENSE tag backing, wave band at
  0.75), **screen** `{colors.screen}` (start, pause and end screens; the
  death dim; every label stroke).
- **Hairline** `{colors.hairline}` for dividers and the ground band's top
  edge; **track** `{colors.track}` and `{colors.track-wide}` for empty bars.
- **Text** `{colors.text}` (values, headings), `{colors.text-bright}` (strip
  mains, wave banner), `{colors.text-working}` (body copy, mono working),
  `{colors.caption}` (~7:1 on the panels; also the MISS footprint's tint),
  `{colors.small}` (~4.6:1, the floor), `{colors.disabled}` (SENSE pips at
  zero only).

### Named Rules
**The One Word Rule.** A vocabulary colour (axis, rank, creature) names one
thing and is never reused for feedback; feedback colours (grade, breach,
loss, fire, Titan) are never used to label a bonus.
**The Floor Rule.** Nothing is drawn as text dimmer than `{colors.small}`;
unheld strip cells dim by alpha (0.55), not by a darker colour.
**The Neutral Rule.** No colour choice may change a simulation outcome;
`npm run neutral` must read identical on every seed after any change here.

## Typography

**Display Font:** system-ui (with sans-serif)
**Body Font:** system-ui (with sans-serif)
**Label/Mono Font:** ui-monospace (with SFMono-Regular, Menlo, monospace)

**Character:** The system sans at bold, everywhere, because no font file may
ship; monospace only where characters must be counted (match codes, the DPS
working). Uppercase tracked labels name data; sentence-case regular copy
speaks to the player.

### Hierarchy
- **Display** (bold, 56px, tracking 2): the title on the start screen only.
- **Headline number** (bold, 112px): the waves-survived figure on the end
  screen; the pause tally figure is 28px, the end percentage 28px bold.
- **Heading** (bold, 28px, untracked): PAUSED, OVERRUN, THE TITAN LANDED. The
  wave banner is 40px bold tracking 4 on a 64px band.
- **Magnitude** (bold, 26px): gate card top line, card tile top line and
  strip cell main; shrinks to the card's inner width (`width - 8`) when wider
  (`+1840%`). Rail values are 23px, the boss warning 22px tracking 6. The end
  screen's two scores (percentage, peak DPS) are 44px.
- **Value sub** (bold, 17px, `{colors.strip-sub}`): the strip's second line.
- **Body** (regular, 17px, line spacing 5, `{colors.text-working}`): start
  screen copy; the HAVE FUN beat is 18px.
- **Link** (regular, 17px): text links on the start screen and the pause
  tabs (17px bold tracking 1.6); the difficulty line is 17px bold caption
  colour; RESTART 17px bold tracking 1.5. The end screen's links are 16px
  and 15px.
- **Note** (regular, 16px, line spacing 4, `{colors.caption}`): the 16px
  step the Phone Floor made a used one - the pause page's axis note (wrapped
  to 488px), the end screen's detail line and score captions, the DETAILS
  working. Bold at 16px: the ruler heads and the DPS · PAR line.
- **Caption** (regular, 15px, `{colors.caption}`): under the value it names.
  Secondary captions are 14px `{colors.small}`, untracked. The end screen
  keeps two 13px tracked captions and a 12px version line (see drift).
- **Label** (bold, 14px, tracking 1.4-2, uppercase): rail column names,
  strip axis names, pause section heads, PAUSE, the tile's axis word
  (tracking 2, never scaled). The field's SENSE tag is 16px tracking 2.
- **Code** (mono bold, 40px): the match code on start and end.
- **Working** (mono regular, 16px): the DETAILS tab; its answer line is white
  bold and the only bright line.

**The Phone Floor** (2026-09-20). Nothing under 13px, and labels at 14: the
author read the 11px labels on a phone, where `Scale.FIT` draws the canvas
at ~0.72, as barely legible. Every size under 18px went up two to three
points in one pass; the values above and in the token block are the new
ones. Verified in 540x960 stills only.

### Named Rules
**The Two-Line Card Rule.** A gate label is always magnitude over axis word,
split at the last space; `+SENSE` is `+` over `SENSE`. `type.label` is not
changed for display.
**The Stroke Rule.** Text that floats over the field wears a 3px
`{colors.screen}` stroke (4px for rescues); text on a panel wears none.

## Layout

A fixed 540x960 logical canvas under `Scale.FIT`; nothing is responsive. Top
to bottom: rail (0-72, four equal columns WAVE / DPS / PAR / SENSE, label at
11px over a 23px value over an 11px sub); standing bar (6px at y 72 with a
3x12 white tick at the target fraction; a 12px fade strip under it carries
the Titan bar at y 77); field; lane band (768-960); ground band (828-950)
with its 1px top edge and a 24px breach glow to the line at 950, and a
darker step of ground (`0x0e1220`) from the line to the bottom edge. The
lane (888) and the line (950) moved down 88px with the strip's move up, so
the visible descent from the strip's edge to the lane is 722px, what it was
when the strip sat at the bottom. The
strip sits directly under the rail (72-166, five cells 100/128/128/92/92
wide, 18px inset, 1px dividers 12px below the top, a 1px hairline along its
bottom edge) - moved up from 864-960 on 2026-09-20 because a thumb on a
phone covered it. The pause button sits in the rail's right-hand 80px at (500,33), 68x44.
Gate cards are 88px tall, drawn `width - 8`, and emerge from beneath the
strip. Screens are full-bleed opaque panels with content centred on x 270,
hairlines 380 (start) or 420 (end) wide, the primary card button 300x56
(380x64 on the start screen), every tappable line on a 44px hit bar, the
version at 812 (start) or 756 (end).

The start screen is a first wave, not a menu: DPS GOLF at y 54, the pitch
from 96, a demo offer of three 160x88 card tiles in the three lanes (x 90 /
270 / 450) descending 214 to 330, the remaining pitch beats 368-448, the
match block between hairlines 490 and 626 (code at 530, caption 564, the two
links at 600 on 150x44 bars), the difficulty line at 660 on a 480x48 bar
with its hint at 688, START MATCH at 736, then the field's own ground: the
lane band from 776, the ground band 828-950 with its 1px `{colors.hairline}`
top edge, an 18px three-step breach glow (6px at 0.05 / 0.035 / 0.02), the
2px `{colors.breach}` line at 950 at 0.6, the darker ground below, and a
three-body squad from the real textures at the lane (888). The pause
BONUSES page keeps the ruler (heads 118, three mono lines from 160), a
hairline at 276, eight 120x88 card tiles in a 4x2 grid from (18, 298) with
8px gaps in DPS order (ARMY, DMG, RATE, GUNS, PIERCE) then the RISK three
(MOVE, TIME, SENSE), the hint 8px under the grid, one axis-headed note line
34px under it, the DPS · PAR line at 648, RESUME at 740. The end screen's
tally is five 88x64 footprints on a 96px pitch at y 446 under the two 44px
scores at 346, the detail line at 520, the hairline at 572, the code at
620, REPLAY THIS MATCH at 836.

## Elevation & Depth

No shadows. Depth is stacking order alone, and every layer is opaque or a
flat alpha tint. Field depth map: ground 0, ground band 1, gate cards and
roofs 4, overlay ticks/cage bars 6, Titan body/accent 8/9, enemy body/accent
10/11, cage inmates and squad bullets 12, cage bars 13, shards 14, gate labels
and SENSE tag 15, health bars 18, squad body/head 20/21, enemy bullet
trail/bullet 22/23, brackets 25, field feedback 27, Titan horizon 28, death
dim 29, rail backing 30. HUD scene (unshaken): pause button 40, boss bar 42,
wave band 44, edge flash 45, end screen 50, pause screen 55, start screen 60.

### Named Rules
**The Panel Alpha Rule.** Backings the stream can cross (rail, strip, pause
button, SENSE tag) sit at 0.96; the wave band at 0.75; the Titan warning at
0.35; nothing else is translucent at rest.

## Shapes

Everything is a rectangle with square corners: cards, bars, buttons, hit
bars, dividers. The recurring silhouette is the gate card: a 4px solid roof
along the top edge of a tinted, stroked body, on the field, on every screen
tile and on every primary button. Strokes are 1px (hairlines, pause button),
1.5px (drawn SENSE pips), 2px (buttons at 0.9, sibling and resting cards,
tiles at 0.8), 3px (targeted or marked card, brackets, label strokes). Creatures are the exception: organic silhouettes drawn at 2x and
shown at 0.5 so a 3px black seam stays crisp, each fitted inside its hit
circle with appendages crossing by at most a quarter of r. Squad bullets are
a 6x14 cream pill with no outline; enemy bullets an 8x16 black-outlined dart
rotated along velocity with a fainter copy (0.45 alpha, 0.35 scale) behind.

## Components

### Buttons
- **Shape:** the card's shape (`cardButton` in `hud/CardTile`): square
  (0px), a 4px solid roof along the top edge in the button's colour, body
  filled in that colour at 0.2, 2px stroke at 0.9, the label 22px bold
  tracking 1 in the same colour, 1px below centre.
- **Primary (START MATCH 380x64, RESUME 300x56, REPLAY THIS MATCH 300x56):**
  ARMY green. The only filled button; one per screen. The primary action is
  itself an offer.
- **Pause:** 88x44 panel fill at 0.96, 1px `{colors.small}` stroke at 0.9,
  14px bold tracking 1.5 caption-colour PAUSE.
- **States:** none drawn; hit-tested by GameScene, hand cursor only.

### Text link and tappable line
- **Link:** 15px regular `{colors.link}`, no underline; an invisible 300x44
  rectangle behind it is the target.
- **Tappable line:** the same bar behind a caption-colour line (SOUND ON —
  tap to mute; NORMAL / HARD; enter a code); RESTART is 15px bold tracking
  1.5 in `{colors.grade-bad}`. Its hint sits below at 13px caption.

### Card tile
A gate card off the field (`hud/CardTile`), so a player who has taken one
offer reads a pause tile, a demo card or a tally footprint without learning
anything new.
- **Anatomy:** 120x88 by default (160x88 for the start screen's demo offer,
  88x64 for the end tally); a 4px roof in the tile's colour along the top
  edge; body tinted 0.18 with a 2px stroke at 0.8 when held; 26px bold
  magnitude 9px above centre over a 14px bold tracking-2 axis word 18px
  below, both `{colors.text}`. The magnitude shrinks to the inner width
  (`width - 8`); the axis word never scales and is written to fit.
- **Unheld:** fill 0.06, stroke 0.45, roof 0.55, magnitude 0.6, axis word
  0.8; dimmed by alpha exactly as an unheld strip cell is.
- **Selected:** two white 3px L-brackets (14px legs, alpha 0.95) at the
  bottom corners - the field's target mark, never the white stroke, which
  is the SENSE mark. The pause grid opens on ARMY and follows the finger.
- **SENSE:** three drawn pips (r 8, 24px apart, 1.5px `{colors.text}`
  stroke at 0.9) in place of a magnitude, filled at 0.9 for the count held.
- **Tally footprint:** the same tile in the grade colours (PERFECT, GOOD,
  BAD, RISK) and `{colors.caption}` for MISS, count over word, unheld when
  the count is zero.

### Gate card
- Axis-coloured rectangle 88px tall, fill 0.16 at rest, 0.30 when targeted,
  0.10 for the target's siblings; 2px axis stroke (3px on the target); a 4px
  solid axis roof along the top edge; magnitude 26px over axis word 14px in
  `{colors.text}` at depth 15.
- **Targeted:** two white 14px L-brackets at the card's bottom corners (3px,
  alpha 0.47-0.9 as the squad nears), plus a 3px axis-coloured 16px ring and
  24px stem over the leader.
- **Marked (SENSE):** an 8px `{colors.axis-sense}` bar above the roof pulsing
  0.8-1.0 on the simulated clock, a 64x22 panel backing with SENSE at 14px
  tracking 2, and the card's stroke switches to white. Answer and target never
  look alike.

### Rail cell
- Column of 135px: 11px tracked label in `{colors.small}` (SENSE in its axis
  colour), 23px bold value in `{colors.text}` (DPS takes the standing
  colour), 11px bold sub. KILLS carries a 60x2 streak track filling
  `{colors.standing-above}`; SENSE is three 1px-stroked pips.

### Strip cell
- Axis-coloured 14px tracked label, 26px bold main in `{colors.text-bright}`,
  17px bold sub in `{colors.strip-sub}`; 1px `{colors.hairline}` dividers,
  no side stripes. Unheld cells at 0.55 alpha. A change flashes the main from
  scale 1.25 in the event's colour over 500ms; ARMY floats `-N` in loss or
  fire colour at 18px, lifting 26px over 700ms.

### Screens
- Full-bleed `{colors.screen}` panels built from card tiles and one card
  button each (layout in Layout).
- **Start (a first wave):** the title, the pitch in `{colors.text-working}`
  (the warning beat in `{colors.warning-text}`, HAVE FUN in ARMY green), the
  demo offer descending on its loop, the match block, the difficulty line,
  the START card, and the field's own ground with a Grey three-body squad
  standing at the lane. The demo tiles are always held.
- **Pause:** 28px PAUSED, two 17px tracked tabs with a 120x2 code-cyan
  underline on the active one; BONUSES is the ruler (16px axis-coloured
  heads, 14px caption divide line, 17px mono bold rows), the 4x2 tile grid
  with a 14px `{colors.small}` hint under it, one note (14px tracked axis
  head in the axis colour over a wrapped 16px caption line) and the DPS ·
  PAR line, 16px bold in the standing colour (`standingColor` from
  `hud/TopRail`); DETAILS a 16px mono working with one bold white answer
  line. RESUME, then SOUND (15px caption), RESTART, the key hint.
- **End:** heading in `{colors.loss}`, the 112px number counting up, the
  tracked 13px caption under it, the two 44px scores with 16px
  `{colors.small}` captions, the five-footprint tally, the 16px detail line,
  the mono code between hairlines with its 13px caption, the copy link, the
  12px version, REPLAY THIS MATCH, the new-match link. The panel enters over
  200ms from alpha 0 after the death beat.

### Field feedback
- **Pick wash (the field's authored moment):** the grade colour at 0.55 with a
  3px stroke in the card's own footprint, the grade word 16px bold tracking 3
  in `{colors.screen}`; holds 240ms, lifts 24px and fades over 480ms.
- **Floats:** MISS 18px tracking 3 loss-red 60px above the lane line (800ms,
  200ms hold); `+N ARMY` in axis-green (20px, 4px stroke for rescues; 16px
  for streaks); `-N` 16px loss-red at contact.
- **Death beat:** the field dims to 0.7 over 420ms; a Titan landing also
  flashes the horizon 6px breach-red from 0.9 over 480ms; the end screen is
  held for the beat.
- **Edge flash:** 12px bands on all four sides; breach-red 0.15-0.75 by share
  over 360ms, fire-orange 0.12-0.6 over 280ms, loss-red 0.85 over the death
  beat on overrun.
- **Banners:** WAVE N / +N ARMY on a 0.75 panel band, 180ms in, 600ms hold,
  240ms out; TITAN DOWN on Titan purple at 0.5 for 1200ms. The Titan warning
  pulses three times at 200ms.

### Screen motion
The two authored motions off the field, both on the scene clock and neither
touching the simulation:
- **Demo descent (start):** the three demo tiles fall 214 to 330 on a 2.6s
  linear loop (~45px/s, a descent rather than a hover), fading in over the
  first 12% and out over the last 15% so they never touch the warning line.
- **Count-up (end):** the waves headline counts 0 to N over
  `min(900, 240 + 60N)` ms Quad.easeOut after a 120ms delay, then snaps to N.
- The standing bar's one-shot swell (6 to 10px over 300ms, yoyo) on crossing
  the target line is a state flash, not an authored motion.

### Creatures and projectiles
- White-with-black-detail textures tinted per type; a second hue is an
  accent overlay one depth up. Hit: pure white for 0.07s; wounded: bleached
  35% toward white at zero HP, never faded. Death: 3 shards (12 for a Titan)
  for 0.28s; contact: 2 duller shards for 0.18s; a 96-shard ring, spokes
  phased off the simulated clock. Health bars for radius >= 14: 0.5 black
  under `{colors.loss}` at 0.95. The Splitter swells and the Bomber's ember
  pulses; nothing else animates.

### Sound palette
All synthesised (`src/audio/cues.ts`); no files. Levels are dB before the
-6 dB master; priorities decide eviction from twelve voices.

| cue | recipe | dB | pri | note |
| --- | --- | --- | --- | --- |
| kill | sine 1500→900 Hz, 60ms, highpass | -18 | 10 | bundled 100ms; a semitone down and 1.5 dB quieter per doubling |
| contact | sine 140→70 + lowpass noise | -14 | 45 | bundled 80ms; rises with share |
| breach | square 110→45 + noise | -9 | 70 | bundled 120ms; ducks kills 6 dB |
| fireHit | triangle 2400 Hz, 18ms | -16 | 20 | bundled 60ms |
| pickPerfect | triangle C5-E5-G5 arpeggio | -8 | 65 | |
| pickGood | triangle E5 twice | -10 | 65 | |
| pickBad | square E5 then a flat Eb sag | -12 | 65 | |
| miss | bandpass noise 160ms | -20 | 25 | |
| rescue | sine G5-B5-D6-G6 over a G3 | -11 | 60 | |
| streak | triangle A5-E6 | -12 | 50 | |
| wave | sine+square C5-G5-C6 | -8 | 55 | |
| sense | sine C6-E6, slow | -12 | 40 | |
| titanArrive | saw+sine 55 Hz swell, three square knocks | 0 | 85 | ducks |
| titanPulse | sine 55 + square 110, 120ms | -16 | 30 | heartbeat quickening over 20s |
| titanVolley | square 330→220, 60ms | -14 | 35 | at most every 250ms |
| titanKill | noise sweep + saw 160→40, then a C major pad | 0 | 90 | ducks |
| titanLand | sine 90→25, noise, square 65 | 0 | 100 | ducks |
| playerDeath | triangle 440→110 + noise | 0 | 95 | |
| start | sine 660 + 1320 | 0 | 5 | |
| pause / resume | sine 880 / 1100, 40ms | -16 | 5 | |

## Do's and Don'ts

### Do:
- **Do** keep rendering read-only: sprites, HUD, FX and audio consume
  `SimEvent`s and `HudPayload`; nothing they do reaches `systems/`.
- **Do** phase every visual pulse off the simulated clock or a Bresenham
  stride; never the seeded RNG and never `Math.random()`.
- **Do** prove any visual change with `npm run neutral` identical on five
  seeds, and look at the stills from `hud`, `moments`, `roster`, `endscreen`.
- **Do** add a creature as one white-with-black texture at 2x plus a row in
  `CREATURE_ART`; fit the drawing to `radius`, never the reverse.
- **Do** give every tappable line a fixed 44px hit bar and every screen
  exactly one filled button, in the card's shape (roof, 0.2 fill, 2px
  stroke).
- **Do** build a screen's stat or score out of card tiles (`hud/CardTile`)
  rather than text rows, held and unheld by alpha as the strip does.
- **Do** keep the three type roles: system sans for everything, monospace
  for codes and working, and `{colors.small}` as the dimmest text.

### Don't:
- **Don't** reuse an axis, rank or creature colour for feedback, or a
  feedback colour to label a bonus.
- **Don't** add shadows, gradients, rounded corners or a loaded font or
  image; the build ships no assets and draws flat rectangles.
- **Don't** fade a wounded body by alpha; flash white and bleach.
- **Don't** add a fourth authored motion. Three exist by the author's
  decision (2026-09-20): the pick wash on the field, the demo offer's
  descent on the start screen, the end screen's count-up. New feedback is a
  fixed-duration state flash keyed from `RENDER.moments`.
- **Don't** draw landing dashes or anything else that tells the player where
  to stand (`RENDER.landingDashes` stays off).
- **Don't** put coloured side stripes on cells or rows; the label already
  carries the axis colour and dividers are 1px hairlines.
