# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo,
on branch `claude/laughing-feynman-ghh9r3`. The gameplay version tag is still
**1.7** (nothing in the simulation changed last session); the last session
was a whole-game VISUAL redesign, rendering only, and it is waiting on the
author's per-item approval. §4 is what the author still has to do or
decide, §5 what nobody has verified.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root - conventions, the shared-tree rules for
   subagents, measuring before tuning.
2. `shooter_ad/ASKS.md` - the author's asks verbatim with a status each. The
   last section (2026-09-24, seventh session: the visual redesign) is the
   one this session is judged against.
3. The review page https://claude.ai/artifact/3VVNMrDroWnNn6moQMN541
   (private to the author): 35 change items (F1-F6 road and feedback, N1-N5
   notes, C1-C8 creatures / squad / shots, H1-H7 HUD, S1-S5 screens, T1,
   P1, P2, I1), before / after stills, and a Keep / Revise / Roll back mark
   per item. **Read the author's marks first**: `ArtifactData` `list` on
   that URL, collection `verdicts` (one document per item id: `verdict`
   keep / revise / rollback / null, `note`). Treat the notes as the
   author's asks and log them verbatim in ASKS.md.
4. `shooter_ad/.impeccable/surfaces/src-scenes-render-fieldrender-ts.md` -
   the direction contract (rhythm-game note highway).
5. `shooter_ad/DESIGN.md` and `.impeccable/design.json` - the design
   system, rewritten from the build by the impeccable documenter.
6. `shooter_ad/notes.md` "The field is a note highway (2026-09-24)" - the
   author's decisions and the four items marked pending.
7. `shooter_ad/CLAUDE.md` - mechanics; "The highway (2026-09-24 redesign)",
   "Art" (the one field atlas and the Phaser 4.2.1 rotated-quad hazard) and
   the `npm run perf` paragraphs are new.
8. `git log --oneline -20` - the workstream commits carry the reasoning.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify
npm run hud && npm run moments && npm run endscreen && npm run roster && npm run sway && npm run rail
npm run perf                      # frame cost at 4x throttle, four scenarios
NEUTRAL_REF=/path/to/pre-change-dist npm run neutral   # any rendering change
```

Run headless probes ONE AT A TIME. Look at `.verify/hud-late.png`,
`sway-41.png`, `moment-pick-perfect.png`, `start-invited.png`,
`end-good.png` before starting.

## 2. What the game is

Unchanged from 1.7: **DPS golf.** Every 7.5s three bonuses descend and you
judge, before they arrive, which most increases your damage output; par is
a shadow player who takes the best DPS option every time. `ASKS.md` and
`notes.md` hold the judgment curve (speed, dead space, legibility,
shooters, sway by wave).

## 3. What changed last session

All rendering; `npm run neutral` read 5/5 seeds identical against the
pre-redesign build, `npm run repeat` 0.00%, `model` PASS.

- **The world**: a rhythm-game note highway - lane beds, lit dividers, beat
  lines scrolling at the live gate speed, a white judgment line at the squad
  (888) with receptors lighting the note you will take, a red fail line
  (950). Notes are rounded baked-gradient cards with a lit cap; the × / +
  operator is a drawn glyph (`render/Operator.ts`). Judgment bursts with a
  slanted grade word; an "N IN A ROW" PERFECT streak line (pending).
- **Sprites**: baked volume / outline / gloss on creatures, one field atlas,
  a hue-preserving hit flash (at most every 0.5s), streak bullets, darts and
  shells with halos, holographic ECHO ghosts, a segmented SHIELD ring, kill
  shards with no ring (only the Titan rings).
- **HUD**: a duel rail (YOUR DPS vs PAR with a tug bar), five input chips
  with axis caps, a stage banner docked at y 184-228, a Titan HP row with a
  trailing chunk, a damage vignette. Texture uploads 11 a frame -> 0.
- **Screens**: NineSlice card buttons with a press, a lane-wipe entrance, a
  start-screen mini highway, a fixed pause grid with an INVEST row, a
  results-table end screen.
- **Font**: Saira Semi Condensed (OFL), bundled, loaded before boot.
- **Instruments**: `npm run perf` (new); `moments` asserts BAD; `rail`
  checks glyph ink; `hud` adds `hud-close` / `hud-behind`; `roster` adds
  `roster-fx`.

**Measured** (`npm run perf`, 4x throttle, paired runs, wave 41): cpu per
frame 10.0 / 17-21 / 23-27ms -> 6.7 / 12 / 16ms (med / p95 / p99); draws
18 -> 12; uploads 11.1 -> 0.1; textured fill 0.32 -> 0.78 screens (seven
full-screen Graphics fills -> two). SwiftShader frame rate: level late
(~22fps), ~33.5 -> ~29.6fps at wave 1.

## 3b. Eighth session (2026-09-24): depth and sound

Asks in `ASKS.md` (last section). Rendering / audio only; `neutral` 5/5
identical against the pre-session build, `repeat` 0.00%.

- **Notes draw above every body on the road** (`GateCards` `NOTE_DEPTH`
  11.6-11.8; `SpriteRender` depths). `roster-notes.png` is the still.
- **Audio rebuilt**: `CLAUDE.md` "Audio" is the mechanics, `notes.md`
  "Sound" the intent. Effects in the music's key, four tracks, a Titan
  boss mode, SOUND and MUSIC separate. `npm run music` (new) and `npm run
  audio` are the instruments; `.verify/music/*.wav` and `.verify/audio/*.wav`
  are what to listen to. An audition page for the author is linked in the
  session's final message.
- **Unverified**: nobody has listened to any of it; real-time audio load on
  a phone is unmeasured (offline proxy: 0.09x on this machine).

## 4. What the author still has to do or decide

- **Listen** to the four tracks and the palette, and say which to keep.

- **Mark the review page.** Every item is separable; a roll back is a code
  edit in the file the item names (the workstreams landed as four merge
  commits, not per-item commits).
- **Play it on a phone.** Nothing since 0.5 has been played by a human, and
  none of the motion (beat lines, bursts, wipes, punches, the note's
  breathing glow) has been seen outside stills.
- The four pending calls: N IN A ROW; no contact shadows under ordinary
  enemies (the brief promised them; invisible on the road); the duel rail;
  the results-table end screen.
- Everything from earlier handoffs still stands (see ASKS.md and the
  previous RESTART in git history, `git show 4f865d3:shooter_ad/RESTART.md`):
  play 1.7's curve and sway, the peak-anchored damage, legibility past 35,
  the shooter share, deploying and watching GoatCounter.

## 5. Known gaps — name these as unverified if you report on them

- **60fps on a real phone GPU is unmeasured.** Headless Chromium rasterises
  on the CPU (SwiftShader); `perf` is a pessimistic proxy, compare pairs.
- **The SENSE crown** never appears in a still: `sense-mark.png` catches
  the card under the HUD. The white edge does show.
- **The docked banner** shares y 184-228 with notes emerging from the HUD;
  a WAVE word can briefly sit on a new card's magnitude. No still shows it.
- **REPLAY THIS MATCH has no pressed state**: it is hit-tested by
  GameScene, and making it interactive in UIScene would steal the tap.
- **`RENDER.gate` in config** (`fill`, `targetFill`, `track*`) is dead;
  `roof` is still read by `CardTile`. Left in place (config was out of
  bounds for a rendering-only pass).
- The canvas is 540x960 under `Scale.FIT` at resolution 1, so text is
  upscaled on high-DPI phones; raising resolution costs fill. Untried.
- Everything in the previous handoff's §5 (ECHO wastage, the bot not
  dodging, `fractionOfOptimal`, the RISK wash end to end, ...) still holds.

## 6. Ground rules

- **A typecheck is not verification.** Look at the images.
- Rendering never feeds the simulation; visual randomness is a hash of a
  counter or the simulated clock, never `Math.random()` or the seeded RNG.
  A rendering-only change is proven with `npm run neutral` against a
  `dist/` snapshot taken BEFORE the change.
- **Performance rules the redesign follows**: bake glows / gradients /
  shadows once at boot; no runtime filters; no per-frame `setText` unless
  the string changed; pooled sprites and ring buffers; field sprites from
  the one atlas (rotated sprites from their own texture inside a
  multi-texture batch draw half-blank on Phaser 4.2.1). Measure with
  `npm run perf` before and after.
- `HUD_ROWS` (184) is also the enemy spawn line: changing it is a balance
  change.
- Run headless probes one at a time; don't rebuild `dist/` under a running
  probe; stage explicit paths, never `git add -A`; subjects `shooter_ad:`.
- The impeccable skill lives at `.claude/skills/impeccable/`; run its
  `context` once per session before UI work.
- Subagents: the author asked for Opus subagents only (pass `model: opus`).
