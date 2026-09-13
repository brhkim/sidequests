# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo.
Phase 0 of a redesign is merged to `main` and deployed. Your job is Phase 1.

Branch from `main` for your work (`claude/<something>`), commit and push as you
go, and open a PR when a phase is done. Do not commit directly to `main`.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, plus lessons on
   verification, measurement, permissions and deployment that cost real time to
   learn.
2. `shooter_ad/CLAUDE.md` — how the code works, what is known-broken, and the
   **two-regime** note under "Difficulty is closed-loop". Do not skip that note;
   it changes how every balance number should be read.
3. `shooter_ad/notes.md` — **the design intent**, and the most important
   document here. If it and `CLAUDE.md` disagree, `notes.md` wins and
   `CLAUDE.md` is stale — say so rather than quietly following the code.
4. `git log --oneline -20` — commit messages carry the reasoning behind several
   non-obvious decisions, including two that were reversed.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify && npm run model
```

Look at `.verify/screenshot.png`. Do not start until you have seen it render.

## 2. What the game is

**DPS golf.** Every few seconds the player is shown a set of bonuses and must
judge, before they arrive, which most increases their damage output. The mob,
the formation and the breach line exist to punish a wrong call and reward a
right one. Two rules follow:

- A bonus that does not change damage output is noise.
- A bonus whose value is *obvious* is not a decision.

## 3. What already exists

Phase 0 is merged. Do not rebuild any of it:

- **Rank ladder** runs twelve tiers, Grey through Diamond/Prismatic.
  `SQUAD.maxPower` is derived from the top row, so the old dead region above 608
  power cannot return.
- **`Progression.ts`** is the single definition of squad strength — the squad
  fires from it and the difficulty model budgets against it. Stats follow
  `base × (1 + bonusPool) × mult`. Pierce is valued on a fixed `q = 0.5`,
  deliberately not live enemy density.
- **`data/roots.ts`** generates every bonus magnitude from one root table.
  Bonuses carry an `axis` (army / rate / damage / guns / pierce) and a `form`
  (raw or multiplicative). A live offer reads `+5% RATE` against `+6 ARMY`.
- **`Difficulty.ts`** budgets enemies against a shadow "par" player that takes
  the best offer every time, scored by resulting DPS. Ties break toward the
  option leaving the most power.
- **`Rng.ts`** seeds everything; `?seed=123` fixes a run.

Four scripts, all worth knowing:

| command | what it does |
| --- | --- |
| `npm run verify` | builds nothing — run `build` first. Serves `dist/`, plays headlessly, fails on console errors, blank frames, zero kills, stalled waves |
| `npm run balance` | time series across fixed seeds: power, DPS, par DPS, standing, enemy knobs |
| `npm run model` | validates the design's load-bearing claims by importing the game's own `Progression.ts` — no test reimplementation |
| `npm run dev` | vite, hot reload |

## 4. Ground rules

- **A typecheck is not verification.** Run `verify` and look at the screenshot
  before claiming anything works.
- **Never tune balance on one run.** Read medians across seeds. Probes take
  ~2.5 min per seed — background them.
- **`Progression.ts` stays the single source of squad strength.** Par and the
  player must price every bonus with the same function, or the death screen's
  "optimal pick" marker lies to the player about their own mistake.
- **Determinism is a product feature** — seeds are meant to be shareable. No
  stray `Math.random()`, nothing gameplay-affecting off wall-clock timing.
- Commit subjects prefixed `shooter_ad:`. Push per phase; no giant diffs.
- Check `.claude/skills/phaser4-migration/` before any unfamiliar Phaser API.
  Model priors skew to Phaser 3, and v3 answers look right and fail at runtime.
- **There is no CI on pull requests**, by the user's choice. The Pages deploy
  runs only after merge to `main`, so a bad merge reaches the live site before
  anything complains. Your local `verify` is the real gate.

## 5. Phase 1 — do these

Item 1 first and alone; it unblocks 2 and most of Phase 2. Items 3–5 touch
mostly disjoint files and are good subagent work — give each agent §1, §4, and
one item, and require `npm run verify` output in its report.

1. **`DecisionLog`.** Record each offer: the options shown, the progress state
   at that moment, which was taken, and the computed DPS delta for every option.
   Blocks the death screen, the halo flash, and the probe rebuild.
2. **Rebuild the probe bot** on that scoring, with a `PROBE_SKILL` knob — the
   probability of taking the best option, else picking at random. Today the bot
   ranks offers by *axis*, and the decision the game asks is between two
   magnitudes of the *same* axis, so it cannot express the choice and every
   balance number is soft. `PROBE_SKILL` also closes the loop with design:
   `DIFFICULTY.targetFraction` is a claim about what fraction of optimal the
   game expects, and this is how that claim gets tested. Probing at 0.5 / 0.7 /
   0.9 should produce visibly different runs; if not, the curve is not
   responding to skill. **Re-baseline after this** — those are the first
   trustworthy numbers of the redesign.
3. **HUD.** Soldiers, player DPS, par DPS on the top rail, par **always
   visible**. Plus the active-bonus readout in the strip **directly beneath the
   red line**, where the player's eye already is. The strip is wide and short,
   so this has to be genuinely parsimonious — real design work, not a label
   dump. Iterate, and show the user a screenshot rather than declaring it done.
4. **Three options per offer.** `GATES.perOffer` is still `2`; the offer system
   already generalises. Also enlarge the leader unit so it is obvious the centre
   is what selects.
5. **Gate approach speed scales with wave**, plus `×MOVE` and `+TIME` bonuses.
   Requires slowing base squad movement or `×MOVE` is worthless.

## 6. Phase 2 — the payoff

6. **Death screen readout.** Every decision as a row, the pick and the optimum
   marked, a tier indicator, and a headline "you played at N% of optimal".
   Scrollable. This is what makes the whole framing land.
7. **Pick-quality halo flash** — green / yellow / red on selection, from the
   same scoring as the death screen so they can never disagree.
8. **Escalating numeric legibility** by wave. Round values early, awkward ones
   later; the significant-figure count escalates too. The difficulty axis that
   scales furthest.
9. **Seed display and entry**, with a version tag — a seed is only comparable
   within a version.
10. **Help / pause screen.** Resume, restart, options, a full itemised bonus
    readout, and an explanation of every bonus type. Must teach the
    additive-versus-multiplicative distinction or the core mechanic stays hidden.
11. **Hard mode** — start gate speed and legibility advanced, not more enemy HP.
    It should test the same skill harder, not a different one.

## 7. Phase 3 — tuning and content

12. **Soften the mercy clamp** (`DIFFICULTY.maxOverPlayer`), then re-probe.
    Losing control should be legible, not prevented. Removing it entirely
    reproduces a death spiral around wave 7, so move it in steps — this is the
    constant most likely to make the game miserable if overcorrected.
13. **Enemy behaviour variety.** Five of eight types move identically because
    their cases fall through to `default` in `Enemies.applyBehaviour`; `charger`
    is dead code; `shielder`'s "frontal armour" is direction-independent so the
    name describes nothing. Add waypoint movement, limited retreat, diagonal
    dashes, and **enemies that shoot back** — needs an enemy projectile system
    and squad damage from fire, not only from breaches. Best standalone subagent
    task in the list; it barely touches the bonus system.

## 8. Known problems, measured

- **The central choice decays.** `npm run model` reports the chance additive is
  the right pick: 42% at an empty pool, 22% at +100%, **3% at +800%**. Late in a
  run multiplicative always wins and the decision the game is built on becomes a
  formality. Nobody has fixed this. Options worth weighing: decay the pool,
  scale raw draws against pool size, or cap the pool. **Raise it with the user
  before choosing** — it is a design question, not a tuning one.
- **The probe bot cannot see the game's decision** (Phase 1 item 2). Until it is
  rebuilt, treat anything depending on picking *well* as unmeasured.
- **Two difficulty regimes.** The mercy clamp takes over below
  `standing = targetFraction / maxOverPlayer` — 0.52 at current constants. Above
  that the curve is par-driven; below it, enemy pressure is just 1.35× whatever
  the player is doing and par is irrelevant. The bot lives almost entirely below
  0.52, so most existing numbers describe a regime the par curve never entered.

## 9. Settled — do not relitigate

- Bonus readout sits beneath the red line, not in a right rail. Portrait layout
  makes a rail cost too much playfield under `Scale.FIT`.
- Par is always visible on the top rail.
- `×N ARMY` stays, and all magnitudes come from the root-table generator.
- Pierce uses a fixed `q`, not live density — density swings across a wave, so a
  density-derived number scores a pick against a truth that lasted one second.
- No PR CI for now.

Open, ask if you hit it: whether the root table's upper bound should widen with
difficulty or only its granularity. Widening makes picks swingier; holding it at
`[1.05, 1.50]` keeps the game about precision rather than luck.

## 10. How to report

After each phase: what landed, what the probe and model say (with seeds), what
you could not verify, and what you would do next. **Name unverified claims as
unverified.** An earlier session reported several confident balance conclusions
that were all wrong for measurement reasons — a blind bot, an unseeded run, and
a ratio built from two different quantities — and each cost a full round trip to
undo. The game code has held up better than the instruments measuring it.

One loose end the user may ask about: a published artifact of this game exists
from early in its life and is badly out of date. It is not linked from the repo
and nothing depends on it.
