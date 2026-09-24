---
name: shooter_ad (DPS Golf)
description: A three-lane rhythm-game note highway where every offer is a note riding down to a lit judgment line.
colors:
  void: "#07070d"
  lane-bed: "#0d0e18"
  lane-bed-centre: "#10111d"
  panel: "#0b0b15"
  raised: "#151625"
  hairline: "#262840"
  rail-light: "#c9ccff"
  judgment-white: "#eef0ff"
  fail-red: "#ff3b5c"
  ink-primary: "#f2f3ff"
  ink-secondary: "#b7bad8"
  ink-caption: "#8d91b4"
  ink-small: "#737799"
  link-teal: "#6be8d4"
  warning-ember: "#ff7b54"
  button-ink: "#06140c"
  grade-perfect: "#3ecf7a"
  grade-good: "#ffc93c"
  grade-bad: "#ff4757"
  grade-invest: "#c9a7ff"
  axis-army: "#3ecf7a"
  axis-rate: "#ffc93c"
  axis-damage: "#ff6b4a"
  axis-guns: "#b56bff"
  axis-pierce: "#6be8d4"
  axis-move: "#4ea8ff"
  axis-time: "#ff9fe0"
  axis-sense: "#eaf2ff"
  axis-shield: "#d9a066"
  axis-echo: "#9fb4c8"
  titan-signal: "#a35bd6"
  enemy-dart: "#ff2fa6"
  enemy-shell: "#ff3b3b"
typography:
  headline:
    fontFamily: "Saira Semi Condensed, system-ui, sans-serif"
    fontSize: "112px"
    fontWeight: 800
    lineHeight: 1
  display:
    fontFamily: "Saira Semi Condensed, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 800
    lineHeight: 1
  heading:
    fontFamily: "Saira Semi Condensed, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1
  grade:
    fontFamily: "Saira Semi Condensed, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1
  number:
    fontFamily: "Saira Semi Condensed, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1
  value:
    fontFamily: "Saira Semi Condensed, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1
  button:
    fontFamily: "Saira Semi Condensed, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "1.5px"
  body:
    fontFamily: "Saira Semi Condensed, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.3
  label:
    fontFamily: "Saira Semi Condensed, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "1.6px"
  caption:
    fontFamily: "Saira Semi Condensed, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.6px"
rounded:
  chip: "6px"
  card: "9px"
  button: "12px"
spacing:
  card-gap: "8px"
  hit-min: "44px"
  hud-titan-row: "18px"
  hud-rail: "72px"
  beat: "96px"
  hud-strip: "94px"
  lane: "180px"
  hud-bottom: "184px"
components:
  note-card:
    backgroundColor: "{colors.axis-damage}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.number}"
    rounded: "{rounded.card}"
    height: "88px"
  button-primary:
    backgroundColor: "{colors.grade-perfect}"
    textColor: "{colors.button-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    height: "56px"
    width: "300px"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.link-teal}"
    typography: "{typography.caption}"
    rounded: "{rounded.button}"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.grade-bad}"
    rounded: "{rounded.button}"
    height: "44px"
  hud-chip:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.number}"
    rounded: "{rounded.chip}"
  wave-banner:
    backgroundColor: "{colors.void}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.heading}"
    height: "44px"
    width: "540px"
  receptor:
    backgroundColor: "{colors.judgment-white}"
    height: "28px"
  results-row:
    textColor: "{colors.grade-perfect}"
    typography: "{typography.value}"
    height: "32px"
---

# Design System: shooter_ad (DPS Golf)

## Overview

**Creative North Star: "The Note Highway"**

The playfield is a three-lane rhythm-game highway (osu!mania, DDR, Guitar Hero grammar). Offers are notes riding their lanes down to a white-hot judgment line at the squad (y 888); the fail line (y 950) is the one warm light on the road. The player reads three numbers, sees which receptor has lit under their squad, moves, and is judged PERFECT / GOOD / BAD / INVEST / MISS with a burst they feel. Beat lines stream down the lanes at the live gate speed, so rising tempo is seen, not just felt.

The road is near-neutral and dark on purpose: it is the stage for four vocabularies (axis, rank, creature, grade), each of which owns its hue. The highway's own light is a cool, desaturated blue-white that never competes with a colour that means something. Material is soft and baked: rounded gradient cards with a lit cap, soft offset drop shadows, baked glows. Nothing is computed per frame that could be baked once at boot. The world replaces the old flat navy "Instrument Panel" of square tinted rectangles, and it deliberately avoids neon-on-black: glow belongs to vocabulary colours and to the two lines, never to the road.

Motion lands on the beat. Entrances snap with a small overshoot (140ms, Back.out), changed values punch (1.18 to 1 over 180ms), screens and the stage banner wipe in lane by lane (260ms per lane, 40ms stagger), and exits never overshoot (Cubic.in). All motion is render-only, phased off the simulated clock or the scene clock, never the seeded RNG.

**Key Characteristics:**
- 540x960 portrait canvas; HUD band 0-184, highway 184-950, dark thumb ground below 950.
- Three lanes of 180px; centre lane bed one step lighter so lanes read without lines.
- One bundled face, Saira Semi Condensed, four weights (500 / 600 / 700 / 800).
- Notes: 9px-rounded, baked-gradient cards tinted in their axis colour, with a lit cap and a soft drop shadow.
- Judgment grammar: receptors on the line, a burst on the pick, a slanted grade word that punches in.
- Everything baked: one field atlas, no runtime filters, pooled sprites and ring buffers.

## Colors

A near-neutral road under a cool rail light, with every saturated hue reserved for something that means something.

### Primary
- **Rail Light** (rail-light): lane dividers, beat lines (alpha 0.13, every fourth beat a bar line at 0.26), idle receptor footprints, the wave banner's lit edge, the road's faint sheen. It is the highway's light and is never a vocabulary colour.
- **Judgment White** (judgment-white): the judgment line's core (0.58 alpha, 2px) inside a 4px band and an 18px glow each way. The brightest line on the road.

### Secondary
- **Fail Red** (fail-red): the breach line, 2px at 0.95 alpha with a glow rising 40px up the ground band. The one warm light on the road; the end screen's OVERRUN heading takes it.
- **Link Teal** (link-teal): every secondary button's word and rim and every text link.
- **Warning Ember** (warning-ember): the start screen's warning line, HARD, a bad code.

### Tertiary: the four vocabularies
- **Axis colours** (axis-army through axis-echo): name the bonus axis on its note, its HUD chip's top edge and label, its pause tile and its receptor. Both forms of an axis (raw `+` and multiplicative `×`) share one colour. Source of truth: `AXIS_COLOR` in `src/data/gates.ts`.
- **Grade colours** (grade-perfect, grade-good, grade-bad, grade-invest): the grade word, the pick burst's ring and sparks, the results table rows. INVEST (the zero-DPS pick, key `risk` in code) is lavender, off every axis hue. Source: `GRADE_COLOR` in `src/scenes/hud/types.ts`.
- **Rank shirts**: Grey, Green, Blue, Purple, Orange, Red, then Bronze, Silver, Gold, Platinum, Diamond, Prismatic, cycling past row 12; also the bullet density ladder. Source: `TIERS` in `src/data/tiers.ts`, read only through `tierRow(n)`.
- **Creature colours**: one body hue and one accent per type (Grunt olive, Runner yellow, Brute brick, Shielder slate blue, Splitter green, Bomber orange, Spitter cyan, Lancer indigo, Mortar stone, Titan purple). Source: `ENEMIES` in `src/data/enemies.ts`. Titan Signal (titan-signal) is the banner's TITAN edge and word, a lifted relative of the Titan's body.
- **Enemy fire**: Enemy Dart (enemy-dart) hot magenta, worn by no body; Enemy Shell (enemy-shell) scarlet, the Mortar's round.

### Neutral
- **Void** (void): the canvas beyond the highway, the vignette the lane edges sink into, and the far end of each lane bed.
- **Lane Bed / Lane Bed Centre** (lane-bed, lane-bed-centre): the three lane beds, drawn once as vertex-coloured rects with a 1.8% rail sheen down each lane's middle, a far-end fade toward void, and a 30px edge vignette.
- **Panel** (panel): the HUD rail's opaque backing and screen backings.
- **Raised** (raised): HUD chips, inactive and secondary button faces, tiles.
- **Hairline** (hairline): 1px rules between panel regions.
- **Ink Primary / Secondary / Caption / Small** (ink-primary, ink-secondary, ink-caption, ink-small): text, brightest to quietest. Ink Small (~4.6:1 on panel) is the floor; nothing dimmer is text.
- **Button Ink** (button-ink): the word on a filled primary button.

### Named Rules
**The One Word Rule.** Every saturated hue is vocabulary: axis, rank, creature or grade. The road, the HUD furniture and the highway's light stay cool and desaturated so no vocabulary colour has to fight them.

**The Shared Axis Rule.** Colour names the axis and nothing else. The raw and multiplicative forms of an axis wear the same colour, so the choice between them can only be read from the operator and the figure, never from the tint.

**The One Warm Light Rule.** Fail Red is the only warm light the road itself emits. Warmth anywhere else on the field belongs to a note, a creature, a shirt or a grade.

## Typography

**Display Font:** Saira Semi Condensed 800 (with system-ui, sans-serif)
**Body Font:** Saira Semi Condensed 500 / 600
**Label Font:** Saira Semi Condensed 600, tracked caps

**Character:** One condensed face with tall, open numerals, because a late-wave note is 75px inside and must hold `+1.84K%`, and the whole game is reading three numbers under time pressure. Four weights ship as OFL latin-subset woff2 files bundled into `dist/` (`src/fonts.ts`); the game does not boot until they are in `document.fonts` or 2.5s pass, then falls back to the system stack.

### Hierarchy
- **Headline** (800, 112px): the end screen's waves-survived figure, counted up.
- **Display** (800, 56px): the title.
- **Heading** (800, 30px): PAUSED, OVERRUN, screen headings; OVERRUN takes the slant.
- **Grade** (800, 30px, slanted): PERFECT / GOOD / BAD / INVEST / MISS. There is no italic file; the browser slants the upright. The wave banner's word is the same voice at 32px.
- **Number** (800, 26px): a note's magnitude, the HUD's lead figures. Magnitudes wider than the note scale down together with their operator, never separately.
- **Value** (700, 22px): secondary figures; results rows use 21px slanted words and 27px counts.
- **Button** (700, 20px, 1.5px tracking): primary button words (START MATCH, RESUME, REPLAY at 22px); secondary buttons at 14-15px with 1.2px tracking.
- **Body** (500, 17px): the pitch, the guide's explanations.
- **Label** (600, 14px, 1.6px tracking, caps): axis words on notes, chip names, column names (13px in the rail).
- **Caption** (600, 13px, 0.6px tracking): sub-lines, captions under figures.

### Named Rules
**The Phone Floor Rule.** Nothing is set below 13px on the 540px canvas; under Scale.FIT a 390px phone draws at ~0.72, and 13 is the smallest that survives it.

**The Upright Number Rule.** Numbers are upright 800; slant belongs to judgments (grade words, the banner word, OVERRUN). A slanted figure is never a quantity.

## Layout

A fixed 540x960 portrait stage, fitted to the device. The HUD band is fixed by `HUD_ROWS`: rail 72px (WAVE / YOUR DPS vs PAR DPS / SENSE / SHIELD, pause at right), bonus strip 94px (the DPS inputs as compact chips), Titan row 18px; its bottom edge (184) is also the spawn line, and notes fade in over their own height as they emerge beneath it. Below: three 180px lanes, two lit dividers (a 1.5px core in a 9px soft glow, quieter toward the far end and across the ground band), beat lines 96px apart that fade in over 70px under the HUD and out over 90px before the ground band. The ground band (from y 828, a full ring's front rank) is where contact happens; the judgment line sits at 888, the fail line at 950, and nothing but dark ground (#0a0a12 to #050509) lies below it, for the thumb.

Notes are 88px tall, drawn exactly as wide as they hit, with an 8px inset gap; from wave 10 dead space narrows them to as little as 83px. The stage banner docks directly under the HUD, y 184 to 228 (44px), as three lane slabs.

Screens use the same stage: lane beds wipe in lane by lane, content centres on the 540px column, and every tappable thing owns a hit area at least 44px tall that never moves or scales.

## Elevation & Depth

Depth is soft, baked, and scarce. Notes, buttons and tiles sit on soft black drop shadows offset downward (notes +5px, blur ~11px, alpha 0.7 at rest; buttons +5px, blur 9px at 0.85), baked once into textures and 3-sliced so width changes cost no redraw. Glows (the target note's breathing glow, the primary button's halo, the judgment and fail lines, receptor edges) are baked white or colour and added, never computed by a filter.

On the field, contact shadows are kept only where they read: the Titan (1.15x radius, alpha 0.9, plus a breathing aura in its own colour), the squad, and rescue cages. **Ordinary enemies cast no contact shadow.** The contract's first viewport promised "creatures on dark contact shadows"; in the build, black at MULTIPLY on the ~#10111c road measured invisible, and at a wave-41 swarm it was ~60 sprites of fill for nothing, so it was dropped. ECHO ghosts are light on the road and cast none.

### Shadow Vocabulary
- **Note drop** (black, blur 11px, offset 0 5px, alpha 0.7 rest / target, 0.6 sibling): under every note.
- **Button / tile drop** (black 0.85, blur 9px, offset 0 5px): under card buttons and screen tiles.
- **Contact shadow** (black ellipse 2.5r x 1.25r at MULTIPLY, offset 0.42r down): Titan, squad and cages only.
- **Label stroke** (rgba(0,0,0,0.6), offset 0 2px, blur 3px): note figures, so they read over their own gradient.

### Named Rules
**The Baked Light Rule.** Every glow, gradient and shadow is baked once at boot. No runtime filters, no post-processing, no per-frame texture generation.

**The Shadow Earns Its Fill Rule.** A shadow ships only where it is visible on the road it falls on. A shadow nobody can see is fill cost, and it goes.

## Shapes

Rounded but firm. Notes and tiles take a 9px radius, buttons 12px, HUD chips 6px; the SENSE crown is a full pill with a notch pointing at the note head. The note is the house shape: a luminance-ramped body (0.58 falling to 0.30 grey, multiplied by the axis colour), a bright 10px cap along its top (the note head) over a 1px dark seam and a faint light lift, a 1px inner highlight and a crisp outer edge. HUD chips and card buttons carry the same idea as a lit top edge. Marks that must read over anything (receptor caps, the leader ring and chevron, the operator glyphs) are round-capped strokes built as a dark keyline, a broad coloured or white stroke, and a white core. Creatures are drawn white-with-black-detail at 2x and tinted, with an untinted white gloss highlight pinned to the body.

## Components

### Notes (the offer cards)
The signature component: one note per lane, descending at the live gate speed.
- **Shape:** 88px tall, 9px radius, continuous width (NineSlice, 3-sliced); lit cap, seam, inner highlight.
- **Colour:** body tinted in the axis colour. Three states: rest (shade 0.88, alpha 0.9), target (shade 1, alpha 1, white inner rim and a breathing baked glow), sibling of the target (shade 0.8, alpha 0.85, labels at full strength). Siblings are only lightly dimmed so all three numbers still read mid-decision.
- **Label:** two lines, magnitude (Number, 26px) over axis word (Label, 14px), split at the label's last space. The label strings every instrument reads are untouched.
- **Operator:** `×` and `+` are drawn glyphs (white, dark keyline, same weight and size), laid out at the magnitude's size as one group with the figure (`render/Operator.ts`, shared by field notes and off-field tiles). Saira's `×` is an x-height speck; the form is the whole question, so it is drawn.
- **Sway track:** from wave 31 a swaying note rides a faint grey groove (fill 0.09, 1px stroke 0.28) the width of its lane.
- **SENSE mark:** a white pill crown with a notch over the marked note, and a white edge.

### Receptors (the judgment line)
- **Target:** the target note's footprint lights on the judgment line (y 888) as a 28px bar in its axis colour, brightening as the note nears (over 560px of descent), with an end cap at each edge; the leader wears a ring and an up-lane chevron in the same colour.
- **Build:** every mark standing over the squad is an axis-colour edge over a dark keyline with an untinted white core, so it reads on every rank shirt, including a Gold shirt under a RATE note. These replace the old white L-brackets.
- **Idle:** the other two options show their landing footprints as faint rail-light bars (alpha 0.22 at nearest), never coloured.

### Judgment (grade word and burst)
- **Burst:** on a pick the note flashes in its own footprint and throws a ring and ten sparks in the grade colour (additive, one depth, pools of four flashes, four rings and 48 sparks; spark directions hashed, never the RNG).
- **Grade word:** slanted 800 at 30px in the grade colour, punches in from 1.7x with an overshoot in 140ms, holds, lifts 44px. MISS lands 60px above the lane line.
- **Streak line (provisional, pending the author's approval):** from two consecutive PERFECTs, `N IN A ROW` in Label size at 800 appears under the word; any other grade or a MISS ends the run.

### Creature feedback
- **Hit:** a hue-preserving lift, the body's own colour (and its accent) moved halfway to white for 0.07s, at most once per 0.5s of the body's own clock (`FLASH_REPEAT`), so a body under a stream is lit under 15% of the time. The gloss highlight stays through it.
- **Wound:** a bleach toward white of ~19% at zero HP (`RENDER.bleach` 0.35 x 0.55); never an alpha fade. Health bars remain for radius 14 and up.
- **Kill:** an ordinary kill throws hashed-angle shards and a brief glow in the body's lifted colour, with no ring. Only the Titan's death rings.

### Buttons (card buttons)
- **Shape:** NineSlice card faces, 12px radius, soft drop shadow; primary 300x56 (START MATCH 64px tall), secondary 44px.
- **Primary:** filled in Grade Perfect green with a baked halo, Button Ink word; one per screen (START MATCH, RESUME, REPLAY THIS MATCH).
- **Secondary:** Raised face with a Link Teal rim and word (ENTER A CODE, NEW MATCH, COPY LINK, HOW TO PLAY).
- **Danger:** Raised face with a Grade Bad rim and word (RESTART).
- **Segmented:** a row of secondaries with one lit (NORMAL / HARD, the pause tabs); the lit one's word is #e8ecf8.
- **Press:** the face squashes to 0.96 and darkens to 0.72, then eases back to 1 over 140ms; the hit zone never scales.

### HUD chips (the bonus strip)
- **Style:** Raised faces, 6px radius, lit top edge in the axis colour; axis name in Label caps in the axis colour, value in Number, multiplier beneath in Caption. Unheld axes dim to 0.5.
- **Change:** a changed value punches (1.18 to 1, 180ms) and floats its delta at 18px.

### Stage banner
- **Style:** three translucent lane slabs (void at 0.32 with a light wash) docked at y 184-228 (44px), wiping in lane by lane; the word slanted 800 at 32px with its own dark stroke so a body passing behind cannot eat it.
- **Variants:** `WAVE N` in Ink Primary with a rail-light edge, held 400ms; `TITAN` in Titan Signal, pulsing twice on the beat; `TITAN DOWN`, held longer.

### Screens
- **Start:** lane-wipe entrance; a demo offer of three real notes descends on a loop above the squad standing on the judgment line; the pitch, match code, card buttons.
- **Pause:** the same stage, tabs as a segmented row, the bonus tiles and the HOW TO PLAY guide.
- **End (results screen):** OVERRUN heading in Fail Red, the headline figure counted up, then the results table: five rows (PERFECT / GOOD / BAD / INVEST / MISS, 32px apart) of slanted word, share bar and count, landing one by one (260ms after the headline, 70ms apart, each counting over 280ms); the you-vs-PAR plot; the match code; REPLAY and NEW MATCH.

## Do's and Don'ts

### Do:
- **Do** draw every field sprite from the one atlas packed at boot (`art/draw.ts` `packAtlas`), and keep dark layers at MULTIPLY so the atlas stays on texture unit 0. Phaser 4.2.1 can draw one triangle untextured or untinted when rotated sprites from their own textures share a multi-texture batch, or under non-MULTIPLY tint modes.
- **Do** bake every texture, glow and gradient once; pool sprites; keep fixed ring buffers for shards and sparks; call `setText` only when the string changed.
- **Do** hold the frame budget measured by `npm run perf` (4x CPU throttle, wave 41): cpu ms/frame ~6.7 / 12.6 / 14.0 (median / p95 / p99, from 10.9 / 21.5 / 23.7), ~12 draws per frame (from 18), 0.1 texture uploads per frame (from 11.1), ~0.8 screens of textured fill. SwiftShader is a CPU-raster proxy; 60fps on a real phone GPU is unverified.
- **Do** give hit feedback as a lift of the body's own colour, at most once per 0.5s of its clock, and a wound bleach of ~19% at zero HP.
- **Do** keep sibling notes at shade 0.8 / alpha 0.85 with full-strength labels, so all three numbers read.
- **Do** draw the operator as a glyph at the magnitude's size, in white with a dark keyline, through `render/Operator.ts`.
- **Do** build any mark that stands over the squad as coloured edge, dark keyline and white core.
- **Do** phase every animation off the simulated clock or the scene clock, and derive variety from a hash, never the seeded RNG.

### Don't:
- **Don't** paint a live body pure white on a hit; it erases the type under a stream. The kill glow stays the brightest thing a body does.
- **Don't** colour-code the operator; colour names the axis and both forms share it.
- **Don't** give ordinary enemies contact shadows on this road; they are invisible and cost fill.
- **Don't** ring an ordinary kill; only the Titan's death rings.
- **Don't** use runtime filters, post-processing or per-frame texture generation.
- **Don't** set text below 13px or dimmer than Ink Small.
- **Don't** let the road's own light take a saturated hue; the only warm light on it is the fail line.
