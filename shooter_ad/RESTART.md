# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo.
Work on `main`. A previous session built the game and then redesigned what it is
for; your job is to execute that redesign.

## 1. Orient before touching anything

Read, in this order:

1. `CLAUDE.md` at the repo root — repo conventions, and hard-won lessons about
   verification, measurement, permissions and deployment.
2. `shooter_ad/CLAUDE.md` — how this game's code actually works, plus a
   **"Known-broken, measured, not yet fixed"** section you must not tune around.
3. `shooter_ad/notes.md` — **the design intent.** This is the most important
   document. If it and `CLAUDE.md` disagree, `notes.md` wins and `CLAUDE.md` is
   stale; say so rather than quietly following the code.
4. `git log --oneline -15` — the commit messages carry the reasoning behind
   several non-obvious decisions.

Then `cd shooter_ad && npm ci && npm run build && npm run verify` and look at
`.verify/screenshot.png`. Do not start until you have seen the game render.

## 2. What the game is now

**DPS golf.** Every few seconds the player is shown three bonuses and must
judge, before they arrive, which most increases their damage output. The mob,
the formation and the breach line exist to punish a wrong call and reward a
right one. Two consequences drive everything:

- A bonus that does not change damage output is noise.
- A bonus whose value is *obvious* is not a decision.

The current bonus table predates this and is mostly wrong for it.

## 3. Ground rules

- **A typecheck is not verification.** `npm run verify` before claiming anything
  works, and look at the screenshot.
- **Never tune balance on one run.** `npm run balance` plays fixed seeds and
  prints a time series. Read medians. The bot is crude — a floor on difficulty,
  not a verdict on feel. Probes take ~2.5 min per seed; background them.
- **`Progression.ts` is the single definition of squad strength.** Par and the
  player must price every bonus with the same function, or the death screen's
  "optimal pick" marker lies to the player about their own mistake.
- **Determinism is a product feature**, not a test convenience — seeds are meant
  to be shareable. No stray `Math.random()`, nothing gameplay-affecting off
  wall-clock time.
- Commit subjects prefixed `shooter_ad:`. Commit and push each phase; do not
  accumulate a giant diff.
- Consult `.claude/skills/phaser4-migration/` before using any unfamiliar Phaser
  API. Model priors skew to Phaser 3 and v3 answers look right and fail at
  runtime.

## 4. Work in this order — the phases are dependency-ordered

### Phase 0 — DONE, do not redo

All four items landed on `claude/laughing-feynman-ghh9r3` (PR #1). Verify before
building on them, then move to Phase 1:

1. ~~Break `observeGateOffer` ties~~ — par now breaks ties toward the option
   leaving the most power.
2. ~~Extend the rank ladder past red~~ — six ranks past red, and
   `SQUAD.maxPower` is derived from the top row so the dead region above 608
   power cannot return.
3. ~~Rewrite the stat model~~ — additive/multiplicative split is in
   `Progression.ts`.
4. ~~Rewrite the bonus table~~ — bonuses now carry `axis` and `form`, drawn from
   the root-table generator. A live offer looks like `+5% RATE` against
   `+6 ARMY`.

Read `CLAUDE.md` § "Known-broken, measured, not yet fixed" for what is still
broken, and § "Difficulty is closed-loop" for the **two-regime** note added
during the re-baseline — it explains why most probe numbers describe a regime
the par curve never touches. That note changes how you should read any balance
measurement, so do not skip it.

Start at Phase 1 item 5.

### Phase 1 — fan out (parallelise with subagents)

These touch mostly disjoint files once Phase 0 is stable. Give each subagent the
orientation reading from §1, the ground rules from §3, and one item. Require
each to run `npm run verify` and report its output.

5. **`DecisionLog`** — record each offer: the three options, the progress state
   at that moment, the pick, and computed DPS deltas for all three. Blocks both
   the death screen and the halo flash, so do it first among these.
6. **Rebuild the probe bot** on the `DecisionLog` scoring, and add a
   `PROBE_SKILL` knob — the probability of taking the best option, otherwise
   picking at random. Its current preference-over-kinds ranking cannot express a
   choice between `+12% DMG` and `×1.05 DMG`, so until this lands every balance
   number is soft. `PROBE_SKILL` also closes the loop with design:
   `DIFFICULTY.targetFraction` is a claim about what fraction of optimal the
   game expects, and this is how you test it. Probing at 0.5 / 0.7 / 0.9 should
   produce visibly different runs; if it does not, the curve is not responding
   to skill and something upstream is wrong. **Re-baseline again once this is
   in** — those are the first trustworthy numbers of the redesign.
7. **HUD**: soldiers, player DPS, par DPS on the top rail, with **par always
   visible** — not saved for the death screen. Plus the active-bonus readout in
   the strip **directly beneath the red line**, where the player's eye already
   is. Placement is decided; the hard part is that the strip is wide and short,
   so the readout must be genuinely parsimonious. Expect to iterate on it, and
   show the user a screenshot rather than declaring it done.
8. **Three gates per offer**, and enlarge the leader unit so it is obvious the
   centre is what selects.
9. **Gate approach speed scales with wave**; add `×MOVE` and `+TIME` bonuses.
   Requires slowing base squad movement, or `×MOVE` is worthless.

### Phase 2 — the payoff features

10. **Death screen readout** — every decision as a row of three, pick and optimum
   marked, tier indicator, and a headline "you played at N% of optimal".
   Scrollable. This is the feature that makes the whole framing land.
11. **Pick-quality halo flash** — green / yellow / red on selection, from the
    same scoring as the death screen.
12. **Escalating numeric legibility** by wave — round values early, deliberately
    awkward ones later. The difficulty axis that scales furthest.
13. **Seed display and seed entry**, with a version tag beside it.
14. **Help / pause screen** — resume, restart, options, full itemised bonus
    readout, and an explanation of every bonus type. Must teach the
    additive-vs-multiplicative distinction or the core mechanic stays hidden.
15. **Hard mode** — advanced starting gate speed and legibility tier.

### Phase 3 — content and tuning

16. **Soften the mercy clamp** (`DIFFICULTY.maxOverPlayer`), then re-probe
    across seeds. Losing control should be legible, not prevented. Removing it
    entirely reproduces a death spiral around wave 7 — this is the constant
    most likely to make the game miserable if overcorrected.
17. **Enemy behaviour variety** — five of eight types currently move
    identically; `charger` is dead code; `shielder`'s armour is
    direction-independent. Add waypoint movement, limited retreat, diagonal
    dashes, and **enemies that shoot back** (needs an enemy projectile system
    and squad damage from fire, not only breaches). Good standalone subagent
    task — it barely touches the bonus system.

## 5. Already decided — do not relitigate

- **Bonus readout sits beneath the red line.** Not a right rail; portrait
  layout makes a rail cost too much playfield.
- **Par is always visible on the top rail.**
- **`×N ARMY` stays**, and every bonus magnitude in the game comes from one
  generator. **Read `notes.md` § "One root table, two presentations" before
  writing the bonus table** — it is the single most load-bearing section for
  Phase 0 item 4.

  In short: each legibility tier owns a root multiplier table (coarse early,
  every hundredth later). Every bonus draws from it *independently*, then
  presents according to form — multiplicative shows `×1.2`, raw converts to an
  absolute against current army (`+round2sf(army × 0.2)`). Raw bonuses
  therefore never go dead at large armies, and because the draws are
  independent the two forms in one offer are usually not equivalent, so the
  player has to convert rather than assume. That conversion is the test.

  Round to significant figures, not a fixed step, and escalate the figure count
  with the legibility tier — 2sf early (`+120`), 3sf later (`+127`).

Genuinely open, ask if you hit it: whether the root table's upper bound should
widen with difficulty or only its granularity. Widening makes picks swingier;
holding it at `[1.05, 1.50]` keeps the game about precision rather than luck.

## 6. How to report

After each phase: what landed, what the probe says (with the seeds), what you
could not verify, and what you would do next. State plainly when a number is
unmeasured or a claim is unverified — a previous session reported three
confident balance conclusions that were all wrong for measurement reasons, and
each cost a full round trip to undo.
