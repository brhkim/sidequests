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

## Deployment

Every folder that produces a `dist/` is published to GitHub Pages by
`.github/workflows/pages.yml` at `/<folder>/`. Games must therefore build with
a relative base path (`base: './'` in `vite.config.ts`).
