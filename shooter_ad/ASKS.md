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


---

# Author's asks — session of 2026-09-20 (second session, the UX round)

Same rules as above: verbatim, in order, a status per ask.

## 1. The opening message (verbatim)

> Okay, things are generally looking pretty good across the board! Some
> adjustments:

> 1. Rescues still feel way too common; I think there's some glitch
> happening here.

Status: `landed`. There was. `Enemies.updateCages` reset its clock only
when the 40% roll succeeded, so a failed roll was re-rolled every step until
one passed: a cage within ~40ms of every wave deadline, on every seed
(watched on the 0.7 build: 17.0 / 32.2 / 47.5 / 61.7s). The clock now
restarts on every roll; `npm run balance` prints `cages/min`. Version 0.8.

> 2. The intro explainer screen should show a variety of bonuses, rather
> than just loop the same three

Status: `landed`. Six demo offers deal in rotation, one per 2.6s pass
(DMG/DMG/GUNS, RATE/ARMY/PIERCE, DMG/ARMY/TIME, RATE/RATE/SENSE,
ARMY/GUNS/MOVE, DMG/RATE/PIERCE); `npm run endscreen` asserts the second
pass differs from the first (`start-demo-2.png`).

> 3. The opening screen should also have the option to view the pause
> screen explainers. Something like "TUTORIAL" button

Status: `landed`, as **HOW TO PLAY** under START MATCH: it opens the pause
screen's three pages over the start screen, against the start state's
numbers, with BACK in place of RESUME. `npm run endscreen` opens it, reads
DETAILS, and comes back (`start-guide.png`, `start-guide-details.png`).

> 4. buttons should look like buttons, why is there so many just text
> buttons? Load the impeccable skill and get it with better UX

Status: `landed`. Every control on the three screens and the PAUSE control
is a card button (`cardButton` with `primary` / `secondary` / `danger`
weights, hover and pressed fills); the difficulty and the pause tabs are
segmented rows with one lit. No text links remain.

> 5. A lot of our text explanations rely on players already knowing the
> game terminology like RISK and "Par" -- we need to rewrite everything in a
> beginner-friendly way not assuming they know anything about how this
> works

Status: `landed`. The HOW TO PLAY page (twelve topics), every BONUSES note,
the DETAILS headings, the end screen's captions (OF THE BEST PICKS, PEAK
DAMAGE / SEC, "every card you took, graded against the best of its three",
"type it in to play this exact run"), the rail (YOUR DPS, PAR DPS, BEST
PLAY) and the mode hint. The pitch on the start screen is untouched: it is
yours and PRODUCT.md says not to rewrite it without asking.

> 6. There needs to be more explanation in places that users can find. We
> can reorganize the pause screen; the clickable elements is really great,
> and that's a good start

Status: `landed`. Pause is three pages - HOW TO PLAY / BONUSES / DETAILS -
and HOW TO PLAY uses the tile idea: tappable topics, one explanation at a
time. Reachable from pause and from the start screen.

> Really I'm mostly concerned about UX

## 2. Mid-session (verbatim)

> I'll add to the UX: The Titan healthbar needs to appear distinctly below
> both status/info bars rather than in the middle of them as is the case
> right now.

Status: `landed`. The bar is a full-width panel row (18px, the strip's
backing) directly under the strip's bottom hairline, with the 10px bar and
its TITAN tag; the warning band moved under it. `moment-titan-bar.png`.

> I'd also like the difficulty speed and width of the bonuses to scale up
> two more times (similar curve as-is) in two more increments for 5 waves
> rather than flattening out completely

Status: `landed`, with one judgment call to check. Speed: the same
0.075/wave rise continues to ×3.25 at wave 31 (was ×2.5 at 21). Width: the
6px/wave stage still ends at 72px at wave 16, then a second stage of
2.5px/wave runs to 97px at wave 26 (an 83px gate; `minWidth` 100 → 80).
The late slope is shallower than the first because 6px/wave for ten more
waves leaves a 48px card that cannot hold its axis word. If you want the
full 6px/wave, the label has to shrink or go one-line; say so.

## 3. Later (verbatim)

> Can you get rid of the color note under ARMY? It stopped being relevant a
> long time ago

Status: `landed`. The rank word under the ARMY cell in the strip is gone
(the shirts on the field say it); the BONUSES note no longer names the
rank either. DETAILS keeps "rank" because it is a term in the sum it
derives.

## 4. The finish review (impeccable reviewer, end of session)

Verdict "fix then ship", eight fixes, all taken: START MATCH and HOW TO
PLAY were 4px apart (now 12); the NORMAL segment wore ARMY green beside
START MATCH (now code cyan, so START is the one green card); the guide's
tab said HOW TO PLAY under a heading that said HOW TO PLAY (the tab is
BASICS); a hairline under the tab row so it does not read as the grid's
first row; the guide's and BONUSES' explanation text up to 17px working
white; "OF THE BEST PICKS" contradicted the tally on a poor run ("OF THE
GROWTH ON OFFER"); DETAILS glosses PAR under its answer line; the BONUSES
header stated the conversion four times (now twice).

## 5. Later (verbatim)

> OH yes, please change start power to 1 btw

Status: `landed`, version 0.9. `SQUAD.startPower` 5 → 1. Balance, seeds 1-5
at skill 0.7: median survival 50.0s → 34.9s, optimal 93% → 73% (shorter
runs, fewer decisions), standing 1.00, cages 1.72/min. `npm run verify`'s
sine sweep killed nothing at power 1 and the run ended at the first leak,
so its pointer now stands under the lowest live enemy (still real mouse
input); three runs: 18 / 20 / 14 kills, wave 3, alive.

# Author's asks — session of 2026-09-20 (third session, rescues and the spawn line)

Same rules as above: verbatim, in order, a status per ask. Version **1.0**.

## 1. Rescues (verbatim)

> I think we need to tune rescues a bit more. Right now, getting one early
> on really explodes your DPS versus par. How is it calculated right now?
> Besides the floor of 5?

Answered: +5 flat until 100 power, 5% after, nothing else; DPS is linear in
power under the ring cap, so at power 1 a cage was ×6 and about five
wave-1 gates' worth, standing 2-3 against par.

> The thing is that the army, in and of itself, is its own value because it
> is the health of the player at the end of the day, and it needs to be
> protected, particularly given that the player will continuously take chip
> damage from ranged enemies. My thinking is that we keep it at 5% of army
> size, but we round it to the floor of 1. What do you think of that?

Answered: yes, with two caveats - at 5% it stops being a catch-up (under the
smallest gate root) and the cage's HP does not shrink with the reward.

> Okay, let's move it to 10% of player ARMY floor of 2. Keeping it
> rare-ish at 40% per wave I think balances it well

Status: `landed`. `cageReward(power) = max(2, round(power × 0.10))` in
`Progression`, read by the open and by the cage's label, so the two cannot
disagree; `CAGE.reward` / `shareFrom` are gone, `share` 0.1, `minReward`
2; 40% per wave untouched. `npm run rescue` (new) forces a cage open at
seven army sizes on the built game: +2 at 1 / 3 / 10 / 19, +3 at 30, +10
at 100, +100 at 1000 - ×2.67 in DPS at power 1, ×1.10 from 19 on.
`npm run balance` prints `opened` per seed. The guide's RESCUES topic says
"a tenth of your army joins you, at least 2" and no longer calls it the
way back; `notes.md`'s section is retitled "a refund".

## 2. Mid-session (verbatim)

> 1. The stacked status bars at the top now conceal too much of the
> playfield, and it takes forever for, for example, a Titan to finally be
> visible after spawning but to be visible to the player. I think we need
> to constrain the spawn point to be at the bottom of the status bars but
> then ensure that vertical movement speed scales accordingly (so the game
> doesn't just immediately get harder with less time to kill enemies, if
> that makes sense). Titan health should be scaled carefully with this too

Status: `landed`. `ARENA.spawnY` is `HUD_ROWS.bottom` (184; the three HUD
files read their heights from that block). `ARENA.descentScale` (766/990)
multiplies every vertical speed once, in `applyMotion` and `driftCages`,
so every body and the cage reach the line in exactly the seconds they did
from -40 (asserted per type in `npm run model`). The Titan spawns 40px
above the line and emerges; its HP is priced on `titanTravelSeconds()`,
which went 68.7s to 69.4s (+1%), so the boss is the same deadline, now on
screen for all but 3.4s of it instead of its first 17.6s hidden. Retreat
ceiling is the spawn line. Gates untouched (their hidden 94px was your
accepted cost of the strip's move). `npm run behaviour` passes unchanged.

> 2. Army multiplier at low values needs to be adjusted... if I start at 1
> and pick army x 1.1 it does nothing for me assuming it rounds down. We
> probably need to FLOOR to 1 and calculate PAR accordingly

Status: `landed`. It rounded to nearest, which at 1 × 1.1 is still 1.
`applyGate` now adds `max(1, round(power × (root − 1)))` for a `×ARMY`
gate - the rule raw `+N ARMY` already used - so ×1.1 on 1 gives 2, on 9
gives 10, on 100 gives 110. Par takes gates through the same function, so
it is priced and graded on the same floor; `npm run model` asserts par
scores ×1.1 ARMY on an army of 1 as a real gain and takes it. The guide's
THE SUM topic says a × ARMY card always adds at least one soldier.

## 3. Measured

See the table in `RESTART.md` §3: `npm run balance` seeds 1-5 at skill
0.7 on 0.9 and on 1.0, `npm run repeat` 0.00%, `npm run model`, `verify`,
`moments`, `endscreen`, `hud`, `roster`, `behaviour`, `rescue` all pass.
The bot never aims at a cage and does not reach wave 16, so the reward is
measured by `rescue` and the spawn line by `model` and the stills, not by
survival.

# Author's asks — session of 2026-09-21 (fourth session, the shell and the shield)

Same rules as above: verbatim, in order, a status per ask. Version **1.1**
(a new enemy in the wave-6 pool and a new card in the wave-3 pool both move
the seeded stream, so no 1.0 seed compares with a 1.1 one).

## 1. Opening brief (verbatim)

> Okay a couple new fixes:
>
> 1. We need one of the enemies to have a "Big bullet" type; a slower red
> bullet rather than just the many small bullets. Let's have it do twice as
> much relative damage as a smaller bullet, and it should be fired by a
> specific enemy type (maybe new?)

Status: `landed`. A new type, the **Mortar** (`data/enemies.ts`): medium
tier, wave 6, weight 22, a squat stone-grey pot with a black muzzle that
lobs one aimed **shell** every 3.2s. The shell is `GunSpec.shell`: drawn
as a scarlet round (`eshell`, `COLORS.enemyShell` 0xff3b3b) nearly twice a
dart's size on screen, with a 9px hit circle against the dart's 5, at 105
px/s against the darts' 165-210, and `damage: 2` - so it costs exactly
twice a dart through the same `ENEMY_FIRE.powerShare` arithmetic (2 power
at the floor, 2% of the army past 200). The swept collision reads the
radius per bullet. `npm run model` asserts the type exists, fires a shell,
costs 2 and is slower than every dart; `npm run behaviour` lists it among
the shooters; `npm run roster` puts a shell beside the darts. The guide's
TAKING DAMAGE topic names it. Decisions I made rather than asked: it is a
NEW type (your "maybe new?"), medium tier by body size (r 14), and the
Mortar's body wears grey with the shell's red as its glowing accent so the
body that fires shells is read before it fires one.

> 2. We also ought to create a SHIELD upgrade. The mechanic should be
> something like, blocks up to 2 bullet per 5s per level of SHIELD (up to
> 3 levels, same as SENSE). Also incurs RISK rather than DPS/Par benefit

Status: `landed`. `+SHIELD` is a fourth RISK axis (`RISK_AXES`,
`Upgrades.shield`, `SHIELD` in config: `blocksPerLevel 2, windowSeconds 5,
maxLevel 3`). `systems/Shield.ts` is a charge pool the squad owns: `2 ×
level` charges, refilling continuously at that many per 5s, one charge
spent per landing bullet whatever it cost (a shell is one block), filled
to capacity the moment a level is taken. Priced at zero, never taken by
par, told RISK, counted as no growth, out of the offer pool at three held
- all as SENSE is, and `npm run model` asserts each. Offered from wave 3
at weight 30 (SENSE's weight), one wave before the first gun. On screen:
a bronze arc ring around the leader with one segment per charge (lit while
ready), a BLOCK word over each absorbed bullet, a clink, the rail's fifth
column `ready/capacity` over READY, a ninth pause tile (the BONUSES grid
is now 3x3), the RISK and TOP PANELS guide topics, a demo offer on the
start screen. `npm run moments` forces one level and three bullets and
asserts two BLOCK words and `stats.blocked === 2`; `npm run balance`
prints `shield: N held, M blocked` per seed. One judgment call to check:
the pick FILLS the pool at once rather than starting it empty - the card
is felt on the next volley, which I read as what a RISK pick has to do to
pay for itself.

## 2. Things the work forced, not asked

- **The rail has five columns.** SHIELD's charges change under fire, so
  they have to be on screen; four 115px lanes became 82 / 100 / 96 / 100 /
  82 and the labels and sub-lines went 14 to 13px. `npm run rail` (new)
  forces the widest state and asserts 8px between neighbours; its first
  run failed on six pips at 123px, which is why the value is `4/6` and not
  pips.
- **The pause BONUSES grid is 3x3 of 160x64 tiles**, not 4x2 of 120x88:
  a ninth tile in a 4x2 needed a third row that ran into the note.
- **SHIELD's colour is bronze** (`0xd9a066`). Nine axes on one wheel is
  crowded; it sits between RATE's yellow and DMG's red-orange and reads as
  neither on the stills, but that is a phone question.

# Author's asks — session of 2026-09-21 (fifth session, pierce past cages and the shooter count)

## 1. Opening brief (verbatim)

> Two hopefully small changes to check:
>
> 1. RESCUE boxes seem not to be affected by PIERCE but should be

Status: `landed`, version **1.2**. It was a rule, not a bug: `GameScene.collide`
called `strike(b, c.hp, b.damage, false)` for a cage, so the bars spent every
shot that hit them whatever its pierce (the comment said so; `notes.md` never
did). A cage is now a body to the stream: the shots that open it spend one
pierce and fly on, the rest carry on untouched, and a bullet meets a cage
once through the same `struck` guard a body has - without it a piercing
shot would be charged against the bars on every step inside them, the Titan
double-hit of 0.6 again. `npm run rescue` now drops a one-hit cage at pierce
0 / 1 / 2 on a cleared field and asserts, in the frame it opens, that the
opener is spent at pierce 0 and flies on at 1 and 2. Balance change by
construction (a pierce build's stream past a cage is different), so 1.1 to
1.2; `npm run balance` seeds 1-3 read identical to 1.1 to the decimal, which
is the bot's reach (it never aims at a cage and holds pierce by luck), not a
null result.

> 2. Right now, between the Mortars and the other shooters, the difficulty
> curve seems too hard in terms of enemy projectiles. I think we should
> constrain the number of spawned projectile-shooters per round (not
> inclusive of the Titan) to some number by difficulty range (1-5, 6-10,
> etc. etc.). Can you talk this through with me to think about it?
> Especially because the Waves move faster in the later
> difficulties/waves, we need this to not feel crazy. How do we decide it
> right now?

Status: `open` - discussed, not built. The answer given: nothing decides it
today. `rollEnemy` is one weighted draw per spawn with no memory, so the
shooter count per wave is `duration x spawnRate x shooter weight share`
(12% at wave 4, 21% from wave 7: about 2.7 shooters at wave 4, 5.7 at
wave 7, 7.7 at wave 20, 10.7 at wave 30), and the count ALIVE is higher
because shooters outlive the wave (an unkilled Spitter is on screen 33s,
a Mortar 41s, a Lancer 65s against waves of 9-14s), so late waves inherit
the shooters of the two before them. Proposal on the table: a cap on
LIVE shooters (not spawned per wave) by wave band, with the roll
re-drawn from the non-shooter pool when it is full, and `npm run balance`
/ `npm run from` printing live shooters and shots-per-minute so the cap
is set against a reading. Waiting on the author's numbers.

## 2. The author's answer (verbatim)

> I'm thinking for determinism's sake that we don't constrain the spawns
> per se but tune the spawn rates instead. I think the system you designed
> makes sense but also basically "punishes" the player for clearing ranged
> mobs by instantaneously spawning them again, basically. Rather, players
> are benefitted by clearing them and that's the game.
>
> So I think ranged enemies let's reduce their chances to spawn by half
> relative to the other mobs. Then if we have new ranged enemies spawning
> at later waves, that'll auto-tune the difficulty. Let's change it so
> spitter spawns starting at wave 5, mortar at wave 10, and lancer at wave
> 15.

Status: `landed`, version **1.3**. `data/enemies.ts`: Spitter weight 30 to
15 at wave 5 (was 4), Mortar 22 to 11 at wave 10 (was 6), Lancer 24 to 12
at wave 15 (was 7). The live cap is declined and recorded as such in
`notes.md` ("Shooters spawn at half weight, one new type per five waves").
Shooter share of spawns is 6% at wave 5, 9% from 10, 12% from 15, against
12 / 21 / 21% before.

> Can we change it so that the spitter's shot is ever 3s, the lancer's shot
> is every 4.5s and the mortar's shot is every 6s?

Status: `landed`, in 1.3. `interval` 2.1 to 3, 2.6 to 4.5, 3.2 to 6. The
Titan's gun (3.4s) is untouched.

## 3. The last gameplay round (verbatim)

> 1. Shield should also block any enemies' body damage to the player (but
> NOT those that make it past the end-zone)

Status: `landed`, version **1.4**. `GameScene.applyContacts` offers each
touching body to the pool first: one charge per body whatever its tier,
consumed for nothing, a BLOCK word with `body: true`. Breaches are never
blocked. **The Titan is never blocked** - my call: the run ends on it, and
a charge that negated the boss would make its deadline a suggestion. Say
so if you want it blockable. `npm run moments` forces it
(`moment-block-body.png`: BLOCK, blocked 1, contact loss 0).

> 2. I'd like to make another bonus type, +ECHO. This will make a "ghost"
> double of the player's army to the left (first level) and then the right
> (second level) that shoots exactly the same as the player's army. For
> Par, it should count as roughly 1.7x. Echoes can take no damage, cannot
> block enemies, cannot hit projectiles, and cannot take upgrades. If the
> player moves too far left/right that the echoes go off the screen, they
> should just go off the screen (damage wastage, basically) but with no
> other consequence (they can come back)

Status: `landed`, in 1.4. `notes.md` "+ECHO: a ghost army beside yours"
has the build and the decisions I made unasked: 200px offset, weight 24
from wave 4, slate colour, and the price as **per echo** (1.7x at one,
2.4x at two) rather than 1.7x total - tell me if you meant the latter.
`hud-echo.png` is the still; `npm run model` asserts the arithmetic. No
instrument plays with it: the bot takes it when the scoring says so, and
`from` does not print whether it did.

> 3. I think PIERCE needs to be adjusted for PAR; right now, it's
> definitely one of the best upgrades and "feels" the strongest because it
> increases our damage relative to par even if we don't quite realize it.
> But basically, it's definitely pulling higher weight than a 1.5x damage
> bonus; I'd call it 1.7x for adjustment

Status: `landed`, in 1.4. `WEAPON.pierceQ` 0.5 to 0.7: pierce 1 / 2 / 3 are
1.7x / 2.4x / 3.1x. The instrument backs the feel: `from --dps=1e5` on
1.3 measured 2.2 to 2.5 hits per landing shot at pierce 2 against a claim
of 2.0. `discreteAmount` now offers `+2 PIERCE` at 3 held where it offered
`+3`.
