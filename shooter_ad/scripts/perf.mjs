/**
 * Frame cost: the instrument for the performance target (2026-09-24, the
 * author: "60fps mid-range phone" - no dropped frames on a 3-4 year old
 * mid-range Android at wave 41 with a full ring, ECHO and a dense stream).
 *
 * It serves `dist/`, throttles the CPU through the DevTools protocol
 * (`PERF_THROTTLE`, default 4x - the Lighthouse convention for a mid-range
 * phone), injects a scenario through `__startOverride`, steers the squad on a
 * seeded sine sweep through `__autopilot` so the ring moves and takes gates,
 * waits out a warm-up and then records, per scenario:
 *
 *   - cpu ms / frame: wall time from Phaser's PRE_STEP to its POST_RENDER,
 *     i.e. simulation + render-list build + GL command submission. This is
 *     the number to hold under budget; it is what a slow phone pays.
 *   - frame interval: rAF-to-rAF, median / p95 / p99, and the share of
 *     frames over 1.5x the 60Hz interval ("dropped").
 *   - draw calls and texture uploads per frame, by wrapping the WebGL
 *     context's draw and texImage/texSubImage calls. Uploads are mostly
 *     Text objects re-rendering after setText - the cost a static text
 *     count cannot see.
 *   - live display objects (visible, in both scenes) at the end.
 *
 * What it is NOT. Headless Chromium renders WebGL on SwiftShader, a CPU
 * rasteriser, so GPU fill cost lands on the CPU and is inflated relative to
 * a real phone's GPU; the absolute numbers are a pessimistic proxy and only
 * a before / after pair on the same machine is a finding. It is also one
 * machine's wall clock: read medians over the scenario's window, run it
 * twice before believing a difference under ~10%, and never run it beside
 * another Chromium probe.
 *
 *   npm run build && npm run perf
 *   PERF_DIST=/tmp/dist-before npm run perf        # the before half of a pair
 *   PERF_THROTTLE=6 PERF_SECONDS=10 npm run perf   # a slower phone, longer
 *   PERF_ONLY=late npm run perf                    # one scenario
 *   PERF_PROFILE=1 PERF_ONLY=late npm run perf     # + top functions by self time
 */
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = process.env.PERF_DIST ?? new URL('../dist/', import.meta.url).pathname;
const OUT_DIR = new URL('../.verify/', import.meta.url).pathname;
const THROTTLE = Number(process.env.PERF_THROTTLE ?? 4);
const SECONDS = Number(process.env.PERF_SECONDS ?? 6);
const WARMUP = Number(process.env.PERF_WARMUP ?? 2.5);
const ONLY = process.env.PERF_ONLY ?? '';
const PROFILE = process.env.PERF_PROFILE === '1';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };

// The late build `npm run hud` calls hud-late, plus every RISK axis held and
// four ECHO levels: the most the renderer can be asked to draw at once.
const LATE = {
  power: 38400,
  upgrades: {
    damageBonus: 18.4, damageMult: 9.65, rateBonus: 7.2, rateMult: 4.4, guns: 4, pierce: 3,
    echo: 4, shield: 3, sense: 2, move: 3,
  },
};
const SCENARIOS = [
  { name: 'early', start: null, note: 'wave 1 from the real start: one soldier, sparse field' },
  { name: 'mid', start: { power: 44, upgrades: { rateBonus: 0.88, guns: 1, pierce: 1 }, wave: 16 }, note: 'wave 16, the hud-mid build' },
  { name: 'late', start: { ...LATE, wave: 41 }, note: 'wave 41, full ring, ECHO 4, SHIELD 3, full sway' },
  { name: 'titan', start: { ...LATE, wave: 40 }, note: 'wave 40, the Titan wave, same build' },
].filter((s) => !ONLY || ONLY.split(',').includes(s.name));

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (path === '/favicon.ico') { res.writeHead(204).end(); return; }
  const file = join(DIST, path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {});
await mkdir(OUT_DIR, { recursive: true });

/** Installed before the page's own scripts: GL call counters and a rAF clock. */
function instrument() {
  const counts = { draws: 0, uploads: 0 };
  window.__perfCounts = counts;
  for (const proto of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
    if (!proto) continue;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const orig = proto[name];
      if (!orig) continue;
      proto[name] = function (...args) { counts.draws++; return orig.apply(this, args); };
    }
    for (const name of ['texImage2D', 'texSubImage2D']) {
      const orig = proto[name];
      if (!orig) continue;
      proto[name] = function (...args) { counts.uploads++; return orig.apply(this, args); };
    }
  }
  // A seeded, simulated-clock sweep across the three lanes: the ring moves,
  // takes gates and meets the stream, the same on every run.
  window.__autopilot = (s) => 270 + 180 * Math.sin(s.elapsed * 0.9);
}

function pct(sorted, p) {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/** Self time per function (name + file:line), top 25, as a share of samples. */
function topSelf(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const hits = new Map();
  for (const id of profile.samples) hits.set(id, (hits.get(id) ?? 0) + 1);
  const total = profile.samples.length;
  const agg = new Map();
  for (const [id, n] of hits) {
    const f = byId.get(id).callFrame;
    const file = f.url.split('/').pop();
    const key = `${f.functionName || '(anon)'}  ${file}:${f.lineNumber + 1}:${f.columnNumber + 1}`;
    agg.set(key, (agg.get(key) ?? 0) + n);
  }
  return [...agg].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => `${(100 * n / total).toFixed(1).padStart(5)}%  ${k}`);
}

const errors = [];
const rows = [];
const profiles = [];
for (const sc of SCENARIOS) {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${sc.name}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${sc.name}: ${e.message}`));
  await page.addInitScript(instrument);
  if (sc.start) await page.addInitScript((start) => { window.__startOverride = start; }, sc.start);
  const cdp = await page.context().newCDPSession(page);
  await page.goto(`http://127.0.0.1:${port}/?seed=11`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.game?.scene?.getScene('Game')?.registry?.get('stats'), null, { timeout: 30000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await page.waitForTimeout(WARMUP * 1000);
  if (PROFILE) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
  }

  const result = await page.evaluate(async (seconds) => {
    const game = window.game;
    const counts = window.__perfCounts;
    const cpu = [];
    const intervals = [];
    let t0 = 0;
    const onPre = () => { t0 = performance.now(); };
    const onPost = () => { if (t0) cpu.push(performance.now() - t0); t0 = 0; };
    game.events.on('prestep', onPre);
    game.events.on('postrender', onPost);
    const d0 = counts.draws, u0 = counts.uploads;
    const stats0 = game.registry.get('stats');
    const sim0 = stats0?.elapsed ?? 0;
    await new Promise((resolve) => {
      let last = performance.now();
      const end = last + seconds * 1000;
      const tick = (now) => {
        intervals.push(now - last);
        last = now;
        if (now < end) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    game.events.off('prestep', onPre);
    game.events.off('postrender', onPost);
    const stats = game.registry.get('stats');
    const visible = (scene) => scene.children.list.filter((o) => o.visible !== false).length;
    return {
      cpu, intervals,
      draws: counts.draws - d0, uploads: counts.uploads - u0,
      frames: intervals.length,
      simSeconds: (stats?.elapsed ?? 0) - sim0,
      objects: visible(game.scene.getScene('Game')) + visible(game.scene.getScene('UI')),
      wave: stats?.wave, over: stats?.over, power: stats?.power,
      enemies: game.scene.getScene('Game').enemies.items.filter((e) => e.active).length,
      bullets: game.scene.getScene('Game').bullets.items.filter((b) => b.active).length,
    };
  }, SECONDS);
  if (PROFILE) {
    const { profile } = await cdp.send('Profiler.stop');
    profiles.push({ name: sc.name, top: topSelf(profile) });
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.screenshot({ path: join(OUT_DIR, `perf-${sc.name}.png`) });
  await page.close();

  const cpu = [...result.cpu].sort((a, b) => a - b);
  const iv = [...result.intervals].sort((a, b) => a - b);
  const dropped = result.intervals.filter((x) => x > 1.5 * (1000 / 60)).length;
  rows.push({
    name: sc.name, note: sc.note,
    cpuMed: pct(cpu, 0.5), cpuP95: pct(cpu, 0.95), cpuP99: pct(cpu, 0.99),
    ivMed: pct(iv, 0.5), ivP95: pct(iv, 0.95), ivP99: pct(iv, 0.99),
    dropped: dropped / Math.max(1, result.frames),
    fps: result.frames / SECONDS,
    simRate: result.simSeconds / SECONDS,
    drawsPerFrame: result.draws / Math.max(1, result.frames),
    uploadsPerFrame: result.uploads / Math.max(1, result.frames),
    objects: result.objects, enemies: result.enemies, bullets: result.bullets,
    wave: result.wave, over: result.over,
  });
}
await browser.close();
server.close();

const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
console.log(`\nframe cost at ${THROTTLE}x CPU throttle, ${SECONDS}s after ${WARMUP}s warm-up, seed 11, ${DIST}`);
console.log('SwiftShader rasterises on the CPU: absolute numbers are a pessimistic proxy; compare pairs.\n');
console.log('scenario  cpu ms med/p95/p99   frame ms med/p95/p99   dropped   fps   sim/s   draws/f  uploads/f  objects  enemies  bullets  wave');
for (const r of rows) {
  console.log(
    `${r.name.padEnd(8)}  ${`${f1(r.cpuMed)} / ${f1(r.cpuP95)} / ${f1(r.cpuP99)}`.padEnd(19)}  `
    + `${`${f1(r.ivMed)} / ${f1(r.ivP95)} / ${f1(r.ivP99)}`.padEnd(21)}  `
    + `${(100 * r.dropped).toFixed(1).padStart(6)}%  ${f1(r.fps).padStart(4)}  ${r.simRate.toFixed(2).padStart(5)}  `
    + `${f1(r.drawsPerFrame).padStart(7)}  ${f1(r.uploadsPerFrame).padStart(9)}  ${String(r.objects).padStart(7)}  `
    + `${String(r.enemies).padStart(7)}  ${String(r.bullets).padStart(7)}  ${r.wave}${r.over ? ' (over)' : ''}`,
  );
}
for (const r of rows) console.log(`  ${r.name}: ${r.note}`);
console.log(`\nstills: ${rows.map((r) => `.verify/perf-${r.name}.png`).join(', ')}`);
for (const p of profiles) console.log(`\nprofile ${p.name} (self time, minified bundle):\n${p.top.join('\n')}`);
console.log(`errors: ${errors.length}`);
for (const e of errors) console.log(`  ${e}`);
process.exit(errors.length ? 1 : 0);
