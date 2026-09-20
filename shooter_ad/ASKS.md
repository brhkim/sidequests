# Author's asks — session of 2026-09-19

Verbatim record of everything the author asked for in this session, in the
order asked, with the decisions they made when questioned and a status
column. **Review this for completion before closing the session.** Nothing
here is paraphrased except where marked `[summary]`.

Status key: `open` not started · `planned` a plan exists · `building`
delegated and in progress · `landed` in the tree, verified · `done` verified
and pushed · `declined` with reason.

## 1. Opening brief

> Load the /impeccable skill and let's do some cleaning up and improvement to
> the UX.

Status: `done` (commit "the field says what is about to hit you"); the
impeccable finish review ran at the end of the session and its fixes
landed (rail backing opaque, cause of death as the end screen's heading,
SENSE mark legible, three creature silhouettes, Lancer off the bullet hue,
pause notes at contrast, side stripes dropped, boss bar under the rail,
one type scale across the three screens; `npm run neutral` identical on
5/5 seeds). One review item was kept as the author intends it: waves
survived stays the headline number, recorded in `PRODUCT.md`. The
skill was installed mid-session by the author via the GitHub UI; loaded,
`PRODUCT.md` written under its init flow.

> I think it'd be nice to also start adjusting the visuals for greater visual
> clarity: can we start to have some actual unit graphics? Even simple ones,
> we don't necessarily need to do anything fancy but simple geometric shapes,
> colors, flat graphics are currently leaving a lot to be desired. It's of
> UTMOST importance that visual clarity remain non-negotiable and always
> preserved, but there's a lot of room to run here to make this a more
> aesthetically pleasing experience.

Status: `done` (commit "creatures, not discs"; `npm run roster` is the
photograph). Decision when asked: **creatures vs soldiers** (squad stays
human; enemies organic, one silhouette per type). Motion (pulse, swell, gun
tracking) unverified by a human.

> I'd like us to remove the Healer enemy type; it's far too troublesome in the
> context of the Titan, which makes the game feel unfair

Status: `done` (commit "enemies have a hurt box..."). Trait code removed with it.

> I'd also like us to adjust the enemy bullets to look more bullet-like; it's
> currently very easy to visually mistake them for other enemies.

Status: `done` (same commit): outlined magenta darts oriented along
velocity, on a hue no enemy body wears.

> I'd like us to also think about audio design. Something fairly minimal for
> now; enemy death sounds (should be very minor since they'll be constant and
> stacking), bonus sounds for grabbing gate bonuses, clearing rescued army,
> etc. etc.

Status: `done` (commit "sound, procedural and collapsed"): procedural WebAudio, no assets, 21 cues, kill
sounds bundled at most 10 voices/s and pitched down a semitone per
doubling, never louder; mute on the pause screen and the M key; `npm run
audio` writes every cue to `.verify/audio/*.wav` for listening. Nobody has
listened yet.

> Enemies should also have a hit/hurt box -- that is, the army actually
> hitting the enemy should cause damage to the army. That includes the Titan
> (instant kill). Enemies going to the "end-zone" or touching the player
> should cause the same amount of damage. I think damage should scale by enemy
> type and as a function of army size. Something like:
> Basic enemy: 2% of army size, floor 1 raw army
> Medium enemy: 4% of army size, floor 2 raw army
> Large enemy: 6% of army size, floor 3 raw army
> Titan: 100% of army size
> Something like that.

Status: `done` (commit "enemies have a hurt box..."; the share regime
above 75 power is unmeasured by any instrument). Decisions when asked: enemy is
**destroyed on contact**; tiers **by body size** (Basic = Grunt, Runner;
Medium = Shielder, Spitter, Splitter, Lancer; Large = Brute, Bomber);
**keep Large floor 3** even though the Bomber's early cost drops from 5.

> This is a few separate and discrete strands of work, so I think it'd be
> valuable for you to use subagents to write out some comprehensive plan
> proposals for you to review before deciding how to delegate and parse out
> work.

Status: `done`. Four read-only planners (visual, UX, gameplay, audio); plans
saved in the session scratchpad; reviewed; delegation decided (gameplay
first, then three parallel worktrees).

## 2. Skill install

> Okay, pause your work for a second, I'm going to install the impeccable
> skill into the repo (I'll do it via GUI in github) and then you'll need to
> sync the github stuff carefully

> Okay, should be good to go, please sync changes to the branch on remote and
> try to load the impeccable skill

Status: `done`. Fast-forwarded onto the two install commits; the launcher
lost its execute bit in the upload and is run through `sh`.

## 3. Answers to the first question round

- Art world: **Creatures vs soldiers**.
- Contact rule: **Destroyed on contact**.
- Damage tiers: **By body size**.
- UX pain, from play: **Mid-wave readability**, **Feedback moments feel
  flat**, **Screens feel rough**. (Controls and squad handling NOT selected.)

## 4. Answers to the second question round

- Bomber cost: **Keep Large floor 3**.
- End screen replay: **Replay button** (not tap-anywhere).
- Landing marks: **Build it, default off** (enemy-bullet landing dashes
  behind a RENDER flag; breach ticks ship either way).
- Pick label, verbatim:

> Colour wash and word as described, but lets use "PERFECT/GOOD/BAD" and then
> if they literally don't pick one due to the gaps, "MISS" so it's almost
> like DDR

Status: `done` (same commit). The end-screen tally reads PERFECT · GOOD ·
BAD; a MISS count was NOT added because `DecisionLog.tally` has no miss
field and adding one would move the `neutral` comparison (misses sit in
BAD and in the decisions count). MISS is drawn at the lane line, but with
lanes tiling the width it cannot yet happen in play: it becomes reachable
with the dead-space strand. The audio `miss` cue ships ON at -20 dB.

## 5. Dead space between gates, and the difficulty-curve audit

> Two more things to consider for our design:
>
> 1. As the waves go on and difficulty increases, I'd like to start
> introducing dead space between the bonus-gates. So players not only need to
> make the decision, but need increasing precision in movement to do so
> despite the noise of everything going on (and so they can fully miss a
> bonus!). This was an issue we actually fixed a while ago, but I think we can
> now incorporate into the actual game design
>
> 2. When exactly do the increased decimal places now start appearing? I
> think I'd like us to do an audit basically of the difficulty curve in
> concept matched with #1 above

Status: `done` (commit "dead space between gates is the fourth judgment lever, v0.5"). Dead space between gates ships as `GATES.deadSpace`: zero
until wave 4, 6px a wave from wave 5, capped at 72px from wave 16 (a 108px
gate in a 180px lane), on `judgmentWave` so hard mode starts at 12px. The
width is the hit test, the card is drawn to it, and MISS is now reachable in
play (the word lands over the nearest option). Cards grew 64 -> 88px tall
with a two-line label so every value stays legible at the narrowest width.
`npm run model` prints "the judgment curve, per wave" for both modes, which
is the audit in a reproducible form; `npm run moments` photographs a wave-16
offer (`moment-deadspace.png`). Version 0.5. Pending: the root-table
schedule below (5a).

### 5a. Follow-up on gate frequency and the curve (verbatim)

> Okay great great, the difficulty curve is a really nice breakdown. Before I
> offer suggestions, how often do bonus gates appear? Is it one per wave? Or
> how do we set it up?

Answered: fixed 7.5s clock, ~8 offers a minute, not per wave.

> For the dead-space proposal, let's make sure the text remains legible for
> all upgrade types and larger values for bonuses. We may need to stack gates
> and make them "taller" perhaps?
>
> For the difficulty curve, my thinking is:
> 1 to 5: 1.1, 1.25, 1.5
> 6-10: 1.1, 1.2, 1.3, 1.4, 1.5 (remove 1.25 temporarily if possible)
> 11-15: Every .05 (1.05, 1.1, 1.15, etc.)
> 16-20: Every hundredth
>
> The rest of the difficulty parts look good to me

Status: `open` (tables), `done` (legibility, same commit). The taller two-line cards
shipped with §5: magnitude over axis, and a magnitude too wide for the card
shrinks to fit rather than truncating. The root-table schedule is still
pending: the tiers must share a mean (arithmetic and geometric) or the
legibility axis is a power axis in disguise; "tenths" cannot be mean-neutral
inside the fixed [1.05, 1.5] range. Awaiting the author's choice between
accepting the drift or a neutral variant. Today decimals start at wave 11
normal / 6 hard (`notes.md`, "Numeric legibility").

## 6. Anonymous analytics

> Is there any way for us to capture anonymous analytics? Time played, rounds
> played, people playing, high scores, etc.? I don't know what that would
> entail so curious to hear from you what that would take/cost

Status: `open`. Options and cost answered in chat; nothing built until the
author picks one.

## 7. This log

> I should flag: I've asked a LOT of you throughout this session; please make
> sure to log verbatim as much of what you can about my suggestions/asks so
> we can review them intensively later on for completion

Status: `done` (this file). Keep it updated as strands land.

---

# Author's asks — session of 2026-09-20

Same format. The author opened by reading `RESTART.md` and listing seven
thoughts, then answered questions on each.

## 1. The seven thoughts (verbatim)

> 1. End-screen should show Peak DPS Reached as a score output

Status: `landed`. `GameScene` samples `peakDps` every step and the end
screen shows it beside OF OPTIMAL PLAY, captioned PEAK DPS; it is also in
the `stats` registry for the probes.

> 2. the UI and explainers and menus and stuff like that remain way too
> barebones and text-heavy with very little visual flair.

Status: `open`. Not started this session by agreement - the balance and
scoring batches came first. Needs a comp-first design pass (impeccable) on
the three screens; the two phone findings below (text size, strip position)
were taken now because they were blocking play.

> 3. When the player selects a bonus gate that is intentionally 0-dps (TIME,
> MOVE, SENSE), we should have a separate evaluation note
> (perfect/good/bad/miss whatever) that says "RISK". We should have something
> in the pause/tutorial about all of these stats

Follow-up when told the three were priced by an access factor:

> 3. How could MOVE/TIME/SENSE ever be optimal against other dps-associated
> picks? They should have zero impact on DPS and thus should never be
> valuable for par and thus never worth picking

Status: `landed`. `progressValue` is `squadDps`; the access and sense factors
are deleted; `RISK_AXES` names the three; par never takes one beside a damage
option; the wash says RISK in lavender, with its own cue; the end screen has
RISK and MISS columns; the pause BONUSES rows for MOVE / TIME / SENSE say
`RISK: no DPS, par never takes it` and DETAILS says taking one is a RISK. A
RISK pick counts as no growth in the optimal percentage (my call: the gamble
is real and the number should say so; easy to exclude instead).

> 4. I don't think wave completion should give you more ARMY, that throws
> everything off (not intuitive and throws off my calculations for picking
> bonuses)

> 4. Yes, throw out that power bonus for kill streaks, not valuable and
> removes player agency. Please surface for me anything else "automated" in
> terms of power upgrades in our system

Status: `landed`. Wave-clear army and streak army are gone on both sides
(player and par); the streak track left the rail, the `streak` event and cue
are gone, the wave banner no longer says `+4 ARMY`. **Everything automated,
surfaced:** those two were the only sources of army that arrived without a
choice. What remains is gates (chosen) and rescue cages (must be shot open;
par never gets them). Nothing else calls `addPower` with a positive amount.
**One number moved with it, my call:** `SQUAD.startPower` 1 -> 5, because
with the wave-1 `+4` gone a start of 1 made the first leaked Grunt at ~30s the
end of the run on three seeds in five; 5 is what a player held through wave 2
before. Revert to 1 if you want the harder open.

> 5. The rescue mechanic I think needs to appear a little less often, say 25%
> less often than it currently does.

> 5. Yeah drop it to 40% chance

Status: `landed`. `CAGE.chancePerWave` 0.75 -> 0.4.

> 6. I also want to think carefully about how par is calculated with the
> rescue mechanic in place...

> 6. Roger okay, that sounds fine to me as-is

Status: `done` (explained; no change). Recorded in `notes.md` under "Rescue
cages are the catch-up".

> 7. The play should also lose if they hit 0 army, right?

Status: `done` (already true: `Squad.alive` is `power > 0`, checked after
every charge, cause `overrun`).

## 2. Answers to the open items from last session

> Root-table schedule: Yes that's fine to accept the drift

Status: `landed`. Four tiers at waves 1 / 6 / 11 / 16: `[1.1, 1.25, 1.5]`,
tenths, every `.05`, every `.01`. Drift measured against the finest tier:
+0.38% / +1.91% / -0.09% per draw. `npm run model` caps it at 2.5%.

> I didn't see any options for anonymous analytics, so please raise to me
> here

Status: `open`. Options raised in the session summary; nothing built.

> Motion and audio work well! No issues on my pass. Text is really small on
> mobile, really small. Legible on a high DPI screen but just barely

Status: `landed` (text). Every HUD and screen text size under 18px went up
two to three points (10 -> 13, 11/12 -> 14, 13 -> 15, 14 -> 16, 15 -> 17,
16 -> 18). Verified only in 540x960 stills; not on a phone.

> Also, I'm resolved: The current bonuses status bar at the bottom of the
> screen needs to be moved to the top. On mobile play, the thumb I'm using to
> play the game covers it, and I'm constantly flicking my eyes from the
> bottom to the top. It should be just below the par/wave status bar

Status: `landed`. The strip sits at y 72-166 directly under the rail; the
pause button moved into the rail's right-hand 80px (below both it landed on
the right-hand gate card); the ground continues in a darker step below the
breach line where the strip used to be.

## 3. Second round (verbatim)

> Okay great. Let's roll option 1 out.

> Done with goatcounter, got this bit of code for you:
> `<script data-goatcounter="https://brhkim.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>`

Status: `done`. `ANALYTICS.site` is `brhkim`; the hook loads that script
and posts to that endpoint on the deployed page only (never on `?seed=`
pages or local hosts). Counts: pageviews, `run/start`,
`run/end/<mode>/wave-NN`, `run/time/<bucket>`. Nothing has been observed
arriving at the dashboard from this session: the sandbox cannot reach the
counter, so the first real count is yours to check after deploy.

> It looks like the DPS status bar moved up but the rest of the screen
> elements did not move down accordingly, is that right? We need to move it,
> as well as the "endzone" line carefully.

Status: `landed`, v0.7. Correct - only the strip had moved. The lane went
800 -> 888 and the line 862 -> 950 (the strip is 94px; 88 keeps the line
10px off the bottom edge), so the visible descent is 722px against 728
before the strip moved. Every offset inside the field (ring, ground band,
MISS, contact geometry) is unchanged; every descent is 88px longer, which is
why it is a version bump.

> RISK should count against the optimal percentage, it's an investment by
> the player.

Status: `done` (already so): a RISK pick's delta is zero, so the compounded
percentage treats it as no growth against the best option's growth.

> Let's also bump sense to 25, 50, 75 -- we do need to reward the player for
> doing it

Status: `landed`, v0.7. `SENSE.chance` is `[0, 0.25, 0.5, 0.75]`.

> And yes, let's start talking about the UI decisions please

> Yeah those sound fine to me, please proceed!

Status: `landed` (see §4). The four decisions the author approved: the
screens borrow the gate card; the pause rows become card tiles with one
tap-to-read line; the start screen is a first wave, not a menu; two more
authored motions at most, both on screens.

## 4. The UI pass (impeccable, code-led)

No image generation in this session, so the pass ran code-led with the
game's own stills as the comp; the direction contract is in
`.impeccable/surfaces/src-scenes-hud-startscreen-ts.md`. Built:

- `hud/CardTile.ts`: the gate card off the field (roof, tinted body, stroke,
  magnitude over axis word) as a stat tile and as the shape of every primary
  button (START MATCH, RESUME, REPLAY THIS MATCH).
- Start screen: the first wave. A demo offer of three real cards (`+25%
  DMG`, `×1.25 DMG`, `+2 GUNS`) descends on a 6s loop below the author's
  verbatim first pitch beat; the squad stands on the real ground band at the
  real line; START MATCH is a card. Every instrument anchor kept.
- Pause BONUSES: the ruler stays; the ten rows are eight card tiles in DPS
  order then the RISK three, held tiles lit and unheld dim as strip cells
  are, with one tap-to-read line beneath (opens on ARMY).
- End screen: the waves number counts up (the second new motion); REPLAY is
  a card.
Verified: `npm run endscreen` and `npm run verify` pass; stills in
`.impeccable/review/`. The finish review's verdict is in the session summary.

