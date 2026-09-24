---
version: 1
slug: "src-scenes-render-fieldrender-ts"
primary_target: "src/scenes/render/FieldRender.ts"
related_targets: ["src/scenes/render/GateCards.ts","src/scenes/hud/TopRail.ts","src/scenes/hud/BonusStrip.ts","src/scenes/hud/StartScreen.ts","src/scenes/hud/EndScreen.ts","src/scenes/hud/PauseScreen.ts","src/scenes/render/SpriteRender.ts"]
---

# Surface: the playfield and everything around it (the highway redesign)

Scope: the whole game, Experience mode on the field (the player is inside the
work), Operate mode on the HUD and the three screens. Audience, job and
constraints are PRODUCT.md's; this brief carries only the direction.

Author's answers (2026-09-24): world "Rhythm-game highway"; every old
design-system rule may break ("all bets are off ... we can adjudicate
later"), a bundled font, more motion, gradients / glow / rounding, and a HUD
restructure all approved; performance target 60fps on a mid-range phone at
wave 41 with a full ring, ECHO and a dense stream.

## Direction contract

THESIS: The field is a three-lane note highway. Offers are notes riding
their lanes down to a lit judgment line at the squad; the grade lands like a
rhythm game's judgment. It refuses the flat navy instrument panel of square
tinted rectangles, and the neon-on-black cliche: the road is near-neutral so
every vocabulary colour (axis, rank, creature, grade) owns its hue.

OWN-WORLD: near-neutral void #07070d, lane beds #0d0e18 / #10111d, cool
desaturated highway light #c9ccff for rails and beat lines, a white-hot
judgment line, one warm light (fail red) at the breach line. Notes are
rounded (8-10px) baked-gradient cards in their axis colour with a lit cap,
an inner edge highlight and a soft drop shadow. Type is Saira Semi
Condensed only: 800 upright for numbers, 800 slanted for grade words, 600
tracked caps for labels. Soft shadows with offset, baked once.

STORY: at a glance the player sees three notes coming down three lanes,
reads three numbers, sees which lane their squad sits in (the receptor on
the judgment line lights in that note's colour), moves, and is told
PERFECT / GOOD / BAD / INVEST / MISS with a burst they feel. Beat lines
stream down the lanes at the live gate speed, so the rising tempo is seen,
not just felt.

FIRST VIEWPORT: 540x960 portrait. HUD band at top (0-184, height fixed by
`HUD_ROWS`): wave and DPS-vs-PAR head-to-head, then the five DPS inputs as
compact chips. Below it the highway: three lanes, two lit dividers, beat
lines; three notes mid-descent; creatures on dark contact shadows; the
squad on the judgment line (888) with receptor marks; the fail line (950)
glowing red below; nothing under 950 but dark ground for the thumb.

FORM: rhythm-game note highway (osu!mania / DDR / Guitar Hero grammar:
lanes, notes, judgment line, receptors, judgment bursts, a results screen);
second on my ordered list (my own top pick; the author chose it over the
dealt war-table diorama). Seed key a94baab5.

SIGNATURE INTERACTION / MOTION GRAMMAR: the judgment. As a note reaches the
line the receptor under it lights in its axis colour; on the pick the note
bursts (expanding ring, sparks in the grade colour) and the grade word
punches in slanted with an overshoot, then lifts. Everything else lands on
the beat: entrances snap with a small overshoot (140ms, Back.out), changed
values punch (1.18 to 1, 180ms), screens wipe in lane by lane. All motion
is render-only, phased off the simulated clock or the scene clock, never
the seeded RNG. No runtime filters or post-processing: glows are baked.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
