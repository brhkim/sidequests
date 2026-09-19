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

Status: `building` (UX strand). The skill was installed mid-session by the
author via the GitHub UI; loaded, `PRODUCT.md` written under its init flow.

> I think it'd be nice to also start adjusting the visuals for greater visual
> clarity: can we start to have some actual unit graphics? Even simple ones,
> we don't necessarily need to do anything fancy but simple geometric shapes,
> colors, flat graphics are currently leaving a lot to be desired. It's of
> UTMOST importance that visual clarity remain non-negotiable and always
> preserved, but there's a lot of room to run here to make this a more
> aesthetically pleasing experience.

Status: `planned` (visual strand). Decision when asked: **creatures vs
soldiers** (squad stays human; enemies organic, one silhouette per type).

> I'd like us to remove the Healer enemy type; it's far too troublesome in the
> context of the Titan, which makes the game feel unfair

Status: `building` (gameplay strand). Trait code removed with it.

> I'd also like us to adjust the enemy bullets to look more bullet-like; it's
> currently very easy to visually mistake them for other enemies.

Status: `planned` (visual strand): outlined magenta darts oriented along
velocity.

> I'd like us to also think about audio design. Something fairly minimal for
> now; enemy death sounds (should be very minor since they'll be constant and
> stacking), bonus sounds for grabbing gate bonuses, clearing rescued army,
> etc. etc.

Status: `planned` (audio strand): procedural WebAudio, no assets, kill
sounds bundled and pitched down by count, never louder.

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

Status: `building` (gameplay strand). Decisions when asked: enemy is
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

Status: `planned` (UX strand). Consequences: the end-screen tally
vocabulary follows (PERFECT · GOOD · BAD, and MISS counted if the log
separates it); the audio `miss` cue ships ON, quiet.

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

Status: `open`. Audit answered in chat (see "Judgment curve audit" in
`notes.md` once landed); dead space to be built as a wave-scaled gate width
on the judgment axis (`judgmentWave`, so hard mode gets it earlier), with
the MISS grade and cue tied to it.

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
