/**
 * The probe bot, and the dist server both probes run against.
 *
 * Shared by `npm run balance` and `npm run repeat` so there is exactly one bot.
 * Two copies would let the reproducibility check pass against a bot the balance
 * numbers were never produced by, which is the same silent-drift failure
 * `Scoring.ts` exists to prevent on the game side.
 *
 * **The bot steers from inside the page, on the simulation clock.** It is
 * installed as `window.__autopilot` and the simulation calls it once per fixed
 * step (see `GameScene.steerAutopilot`). Its predecessor issued real mouse
 * moves on a 100ms wall-clock poll, so its input landed at a different
 * SIMULATED moment on every repeat: with the simulation itself already
 * deterministic, three repeats of seed 1 still gave 4, 6 and 4 decisions and a
 * 30% survival spread. Determinism is a product feature here, so an instrument
 * that cannot reproduce a run cannot settle anything.
 *
 * It remains a crude player: no threat avoidance, no positioning for breaches,
 * and it cannot dodge enemy fire at all. A floor on difficulty, not a verdict.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };

/** Seeded so a given (seed, skill) pair reproduces exactly. */
export function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Serves a built game on an ephemeral port. Returns `{ port, close }`.
 *
 * Defaults to `dist/`. The argument exists for `npm run neutral`, which plays
 * the same seeds against two builds at once to prove a change was rendering
 * only - that needs both served simultaneously, because rebuilding between them
 * would mean the two runs never existed at the same time to be compared.
 */
export async function serveDist(dir = DIST) {
  const server = createServer(async (req, res) => {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (p === '/favicon.ico') { res.writeHead(204).end(); return; }
    const file = join(dir, p === '/' ? 'index.html' : p);
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      }).end(body);
    } catch { res.writeHead(404).end('nf'); }
  });
  await new Promise((r) => server.listen(0, r));
  return { port: server.address().port, close: () => server.close() };
}

/**
 * Installs the bot before the page boots, so the very first simulation step
 * already has a driver.
 *
 * `skill` is the probability of reaching for the best option, otherwise picking
 * uniformly among the offer. It is an INPUT; the `optimal` figure the run
 * reports is the OUTPUT, and they are not the same quantity.
 */
export async function installBot(page, { seed, skill }) {
  await page.addInitScript(
    ({ skill: s, botSeed, mulberrySrc }) => {
      const rng = new Function(`return (${mulberrySrc})`)()(botSeed);
      // One commitment per offer. Re-rolling every step would average the skill
      // knob away and steer the squad into the gap between two gates.
      const chosen = new Map();
      let sweep = 0;
      window.__autopilot = ({ gates }) => {
        // 820: below this an offer has passed the lane line, unreachable.
        const reachable = gates.filter((g) => g.y < 820);
        if (reachable.length === 0) {
          // No offer in reach: sweep, so kill rate is not an accident of phase.
          // /66 at a 60Hz step is the ~7s period the old 10Hz poll had at /11.
          sweep += 1;
          return 270 + 227 * Math.sin(sweep / 66);
        }
        const nearest = reachable.reduce((a, b) => (b.y > a.y ? b : a)).pair;
        const offer = reachable.filter((g) => g.pair === nearest);
        if (!chosen.has(nearest)) {
          const best = offer.find((g) => g.best) ?? offer[0];
          const pick = rng() < s
            ? best
            : offer[Math.min(offer.length - 1, Math.floor(rng() * offer.length))];
          chosen.set(nearest, pick.x);
        }
        return chosen.get(nearest);
      };
    },
    {
      skill,
      botSeed: (seed * 2654435761 + Math.round(skill * 1000)) | 0,
      mulberrySrc: mulberry32.toString(),
    },
  );
}

/**
 * Plays one seed to death or `seconds` of wall clock and returns the run.
 *
 * The polling loop below only OBSERVES - the bot is inside the page - so how
 * fast this machine polls cannot change the run it is watching.
 */
export async function playSeed(
  browser, port,
  { seed, skill, seconds, mode = 'normal', mercy, pressure, targetFraction, sampleEvery = 5 },
) {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await installBot(page, { seed, skill });
  // The mercy clamp, injected per page rather than rebuilt per value - see the
  // seam in Difficulty.ts. Injected BEFORE the page loads so the very first
  // budget is computed with it.
  if (typeof mercy === 'number') {
    await page.addInitScript((v) => { window.__mercyOverride = v; }, mercy);
  }
  // Same seam, same reason, for the two knobs that set how hard ordinary
  // enemies are - see `npm run pressure`. Answering "how much pressure" means
  // dozens of runs across several values, and rebuilding between each would
  // measure every value against a slightly different dist/.
  if (typeof pressure === 'number') {
    await page.addInitScript((v) => { window.__pressureOverride = v; }, pressure);
  }
  if (typeof targetFraction === 'number') {
    await page.addInitScript((v) => { window.__targetFractionOverride = v; }, targetFraction);
  }
  // `?seed=` is the instrument form and skips the start screen; `?m=` is the
  // shared form and does not. `mode` rides alongside so a probe can play the
  // same seed on either difficulty.
  const query = `?seed=${seed}` + (mode === 'normal' ? '' : `&mode=${mode}`);
  await page.goto(`http://127.0.0.1:${port}/${query}`, { waitUntil: 'load' });

  const rows = [];
  let last = null;
  // The budget is in SIMULATED seconds. Budgeting in wall clock would make how
  // much game a run gets depend on what else this machine is doing: the
  // simulation drops steps under load rather than spiralling (SIM.maxStepsPerFrame),
  // so a contended run covers less game per real second and would be truncated
  // early - a measurement artefact indistinguishable from the run dying.
  // `hardStop` is only a guard against a wedged page, set far above any real run.
  const hardStop = Date.now() + seconds * 4000;
  while ((last?.elapsed ?? 0) < seconds && Date.now() < hardStop) {
    const s = await page.evaluate(() =>
      window.game?.scene?.getScene('Game')?.registry?.get('stats') ?? null);
    if (s) {
      last = s;
      // Sample the series on SIMULATED seconds. Sampling on the poll count
      // would put the rows back on wall-clock intervals, which is the mistake
      // this file exists to have stopped making.
      const bucket = Math.floor(s.elapsed / sampleEvery);
      if (rows.length === 0 || bucket > rows[rows.length - 1].bucket) {
        rows.push({ bucket, t: bucket * sampleEvery, ...s });
      }
      if (s.over) break;
    }
    await page.waitForTimeout(100);
  }
  await page.close();

  // SIMULATED seconds. The simulation advances on a fixed step now (config
  // SIM), so this no longer drifts against wall clock with render load - but
  // they remain different quantities and only this one is a property of the
  // game rather than of the machine it ran on.
  return {
    seed, mode, mercy, pressure, targetFraction, rows, errors,
    // Whether the run ENDED or merely ran out of budget. Read off the final
    // poll, never off the last sampled row: rows are bucketed every few
    // simulated seconds, so the last one is a snapshot from before the end and
    // its `over` is false in every run, dead or not. A truncation column built
    // that way reported every run truncated including ones that died at 43s.
    died: last?.over === true,
    survived: Number((last?.elapsed ?? 0).toFixed(1)),
    wave: last?.wave ?? 0,
    optimal: last?.optimal ?? 1,
    decisions: last?.decisions ?? 0,
    tally: last?.tally ?? { top: 0, mid: 0, low: 0 },
    breachLoss: last?.breachLoss ?? 0,
    fireLoss: last?.fireLoss ?? 0,
    traveled: last?.traveled ?? 0,
    kills: last?.kills ?? 0,
    dps: last?.dps ?? 0,
    parDps: last?.parDps ?? 0,
    hpMult: last?.hpMult ?? 1,
    // Read off the running build rather than recomputed here. Two scripts used
    // to carry their own copies of the difficulty constants and both printed a
    // threshold from a version that no longer existed.
    clampThreshold: last?.clampThreshold ?? 0,
  };
}
