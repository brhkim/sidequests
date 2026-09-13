# sidequests

A collection of small, self-contained games and experiments. **Each top-level
folder is an independent project** with its own `package.json`, its own build,
and its own `CLAUDE.md`.

## Ground rules

- Work inside exactly one sidequest folder unless explicitly told otherwise.
- Read that folder's `CLAUDE.md` before changing anything in it. It carries the
  real build/test commands; this file does not.
- Never add a root `package.json` or npm workspace. Folders stay independent so
  one project's dependency choices can never break another's.
- Run `npm ci` (or `npm install`) **inside** the folder you're working in.
- Commit subjects are prefixed with the folder name, e.g.
  `shooter_ad: cap ring size at three rings`.
- **A typecheck is not verification.** Code that compiles cleanly ships black
  screens. Every project here owns a headless check that loads the built
  output and fails on console errors, a blank frame, or a dead simulation. Run
  it before reporting anything as working, and look at the screenshot it
  produces rather than trusting the exit code.
- Where a project has a `notes.md`, that is the **design intent** and its
  `CLAUDE.md` is the mechanics. If they disagree, `notes.md` wins and the
  `CLAUDE.md` is stale — say so rather than quietly following the code.

## Measuring before tuning

Any change justified by a number — balance, performance, difficulty — needs an
instrument you trust first. Three separate conclusions in `shooter_ad` turned
out to be wrong for measurement reasons rather than code reasons, and each cost
a full round trip:

- **Seed the run.** An unseeded game varied ~2x on luck alone, which is larger
  than most effects being measured. Route every consumer of randomness through
  one seeded generator — a stray `Math.random()` in unrelated code is enough to
  break reproducibility.
- **Compare like with like.** A ratio built from two different quantities
  reported values above 20 and looked plausible for an hour.
- **One run proves nothing.** Read medians across several seeds.
- **A bot is not a player.** State plainly what an automated harness does and
  does not exercise, and treat its output as a floor rather than a verdict.

Write the instrument down as a script in the project, not as a one-off command,
so the next session can reproduce the number instead of re-deriving it.

## Layout

```
sidequests/
  .claude/
    settings.json     # the ONE settings file - cloud sessions start at repo root
    skills/           # shared skills (Phaser 4 conventions, v3->v4 drift guard)
    agents/           # shared subagents (playtester)
  scripts/
    session-index.sh  # SessionStart hook; prints the project index
  <folder>/           # one self-contained sidequest
```

Per-folder `CLAUDE.md` and per-folder `.claude/skills/` both work and load on
demand when Claude reads files in that folder. Per-folder
`.claude/settings.json` does **not** load in cloud sessions, which always start
at the repository root - so hooks and permissions live only in the root file.

## Engine choice

Default to **Phaser 4** for 2D browser games. Consult `.claude/skills/phaser4/`
before writing engine code, and `.claude/skills/phaser4-migration/` whenever
you're unsure whether an API is v3-only. Model priors skew heavily toward
Phaser 3; that skill is the correction.

## Permissions

`permissions.deny` in the root settings blocks whole operations, not just the
one you had in mind. A blanket `Read(./**/dist/**/*)` once blocked publishing
the build it was meant to keep out of context — the rule cannot tell "do not
read this into the conversation" from "hand this file to a publisher". Keep
deny rules narrow: `dist/` is gitignored and content searches already respect
gitignore, so a blanket rule adds little beyond blocking deliberate reads.

## Deployment

Every folder that produces a `dist/` is published to GitHub Pages by
`.github/workflows/pages.yml` at `/<folder>/`. Games must therefore build with
a relative base path (`base: './'` in `vite.config.ts`).

Two setup traps, both hit here:

- The workflow triggers on pushes to `main`. A repo created empty has no
  `main`, and the first branch pushed becomes the default — so the trigger
  silently never fires. Check the actual default branch before assuming.
- Enabling Pages auto-creates a `github-pages` environment pinned to whatever
  the default branch was called **at that moment**. Renaming the branch later
  does not update it, and deploys fail with "not allowed to deploy to
  github-pages due to environment protection rules" while the build job passes.
  Fix under Settings > Environments, not in the workflow.
