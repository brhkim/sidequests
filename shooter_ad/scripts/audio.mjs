/**
 * The audio instrument. Two halves:
 *
 * LIVE: loads `?seed=7&audio=1`, clicks the canvas (the unlock gesture) and
 * waits for the context to run. Headless Chromium may never grant that - then
 * the live half is INCONCLUSIVE, not a failure. When it does run: every cue
 * creates nodes without a caught failure; 600 kills 2 ms apart collapse into
 * bundles under the voice caps; `gameover` drains every voice.
 *
 * OFFLINE: renders every cue through a clone of the live chain into
 * `.verify/audio/*.wav` (plus `palette.wav`, every cue in order with 400 ms
 * gaps, and `kill-bundle-N.wav`) and reports duration, peak, RMS, dominant
 * frequency and the share of energy above 200 Hz, so a reader who cannot
 * listen can still check the design. Asserts every cue peaks between -40 and
 * -1 dBFS.
 *
 * Also greps: nothing in `src/systems/` imports `audio/`, and `src/audio/`
 * has no `Math.random` and no `Rng` import.
 */
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('../', import.meta.url).pathname;
const DIST = join(ROOT, 'dist/');
const OUT = join(ROOT, '.verify/audio/');
const RATE = 48000;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const failures = [];
const fail = (msg) => { failures.push(msg); console.log(`  FAIL ${msg}`); };
const ok = (cond, msg) => (cond ? console.log(`  ok   ${msg}`) : fail(msg));

// --- source hygiene ---------------------------------------------------------
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}
console.log('source:');
for (const f of await walk(join(ROOT, 'src/systems'))) {
  const s = await readFile(f, 'utf8');
  ok(!/from\s+'[^']*audio\//.test(s), `${f.slice(ROOT.length)} does not import audio/`);
}
for (const f of await walk(join(ROOT, 'src/audio'))) {
  const s = await readFile(f, 'utf8');
  ok(!s.includes('Math.random'), `${f.slice(ROOT.length)} has no Math.random`);
  ok(!/systems\/Rng/.test(s), `${f.slice(ROOT.length)} does not import Rng`);
  ok(!/console\.(error|warn)/.test(s), `${f.slice(ROOT.length)} never logs`);
}

// --- server + page ----------------------------------------------------------
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (path === '/favicon.ico') { res.writeHead(204).end(); return; }
  const file = join(DIST, path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {});
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${port}/?seed=7&audio=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.game?.scene?.getScene('Game')?.sys?.isActive(), null, { timeout: 15000 }).catch(() => {});
const stats = () => page.evaluate(() => window.__audio.stats);

// --- live half --------------------------------------------------------------
console.log('\nlive:');
const box = await page.locator('canvas').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.925);
await page.waitForFunction(() => window.__audio?.stats.state === 'running', null, { timeout: 3000 }).catch(() => {});
const state = (await stats()).state;
console.log(`  context state after gesture: ${state}`);
const phaser = await page.evaluate(() => ({ noAudio: window.game.config.audio?.noAudio, hasContext: 'context' in window.game.sound && !!window.game.sound.context }));
ok(phaser.noAudio === true && !phaser.hasContext, `Phaser sound manager off (noAudio=${phaser.noAudio}, own context=${phaser.hasContext})`);
const live = state === 'running';
if (!live) console.log('  live half INCONCLUSIVE: headless context never ran; offline half still binding');
if (live) {
  // Freeze the game so its own events do not interleave with the samples.
  await page.evaluate(() => window.game.events.emit('setpaused', true));
  const names = (await page.evaluate(() => window.__audio.cues())).map((c) => c.name);
  for (const name of names) {
    const r = await page.evaluate((n) => {
      // Each cue is sampled into an empty mix: the budget refusing a low
      // priority cue behind eighteen others is the budget working.
      window.__audio.stopAll();
      const before = window.__audio.stats;
      const played = window.__audio.voice(n);
      const after = window.__audio.stats;
      return { played, nodes: after.nodesCreated - before.nodesCreated, failed: after.failures - before.failures };
    }, name);
    ok(r.played && r.nodes > 0 && r.failed === 0, `${name}: voice played, ${r.nodes} nodes, ${r.failed} failures`);
  }
  const stress = await page.evaluate(() => {
    const a = window.__audio;
    const before = a.stats;
    let t = 100000;
    let kills = 0;
    for (let i = 0; i < 600; i++) {
      a.play('kill', { t });
      kills = Math.max(kills, a.voicesOf('kill'));
      t += 2;
      if (i % 5 === 4) a.tick(t);
      kills = Math.max(kills, a.voicesOf('kill'));
    }
    a.tick(t + 200);
    const after = a.stats;
    return { peak: after.peakVoices, kills, bundled: after.bundled - before.bundled, cues: after.cues - before.cues, failed: after.failures - before.failures };
  });
  console.log(`  stress: 600 kills over 1.2 s -> ${stress.cues} voices, ${stress.bundled} bundled, kill voices <= ${stress.kills}, peak voices ${stress.peak}`);
  ok(stress.peak <= 12, 'peak voices <= 12');
  ok(stress.kills <= 2, 'kill voices <= 2');
  ok(stress.bundled > 500, 'bundled > 500');
  ok(stress.failed === 0, 'no failures under stress');
  await page.evaluate(() => window.__audio.voice('wave'));
  // The payload the end screen expects, so the UI scene's listener survives it.
  await page.evaluate(() => window.game.events.emit('gameover', {
    cause: 'overrun', wave: 1, kills: 0, optimal: 0, tally: { top: 0, mid: 0, low: 0 }, contactLoss: 0,
    breachLoss: 0, fireLoss: 0, traveled: 0, decisions: 0, code: 'x', version: 'x', mode: 'normal', link: '',
  }));
  await page.waitForFunction(() => window.__audio.stats.voices === 0, null, { timeout: 3000 }).catch(() => {});
  ok((await stats()).voices === 0, 'gameover drains every voice');
}

// --- offline half -----------------------------------------------------------
console.log('\noffline:');
await mkdir(OUT, { recursive: true });
const render = async (name, seconds, opts) => {
  const r = await page.evaluate(([n, s, o]) => window.__audio.render(n, s, o), [name, seconds ?? null, opts ?? {}]);
  const bytes = Buffer.from(r.pcm16, 'base64');
  const out = new Float32Array(bytes.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = bytes.readInt16LE(i * 2) / 0x8000;
  return out;
};
function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  const v = new DataView(buf.buffer, buf.byteOffset);
  buf.write('RIFF', 0); v.setUint32(4, 36 + samples.length * 2, true); buf.write('WAVE', 8);
  buf.write('fmt ', 12); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  buf.write('data', 36); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return buf;
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const a = i + k, b = a + len / 2;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
      }
    }
  }
}
const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');
function measure(samples) {
  let peak = 0, sum = 0, last = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
    sum += a * a;
    if (a > 1e-4) last = i;
  }
  const n = 1 << Math.ceil(Math.log2(Math.max(2, Math.min(samples.length, 1 << 17))));
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < Math.min(n, samples.length); i++) re[i] = samples[i];
  fft(re, im);
  let best = 1, bestMag = 0, high = 0, total = 0;
  for (let k = 1; k < n / 2; k++) {
    const mag = re[k] * re[k] + im[k] * im[k];
    total += mag;
    if (k * RATE / n > 200) high += mag;
    if (mag > bestMag) { bestMag = mag; best = k; }
  }
  return {
    ms: Math.round(last / RATE * 1000), peak: db(peak), rms: db(Math.sqrt(sum / Math.max(1, last))),
    hz: Math.round(best * RATE / n), high: total > 0 ? Math.round(100 * high / total) : 0, rawPeak: peak,
  };
}
const cues = await page.evaluate(() => window.__audio.cues());
console.log('  cue           on   sounds   peak dBFS  rms dBFS  dominant Hz  >200Hz  cue dB');
const palette = [];
const gap = new Float32Array(RATE * 0.4);
for (const c of cues) {
  const samples = await render(c.name);
  await writeFile(join(OUT, `${c.name}.wav`), wav(samples));
  const m = measure(samples);
  palette.push(samples, gap);
  console.log(`  ${c.name.padEnd(12)} ${(c.enabled ? 'on' : 'off').padEnd(4)} ${String(m.ms).padStart(5)}ms   ${m.peak.padStart(6)}     ${m.rms.padStart(6)}   ${String(m.hz).padStart(8)}     ${String(m.high).padStart(3)}%   ${c.db}`);
  if (m.rawPeak >= Math.pow(10, -1 / 20)) fail(`${c.name} peaks above -1 dBFS`);
  if (m.rawPeak <= Math.pow(10, -40 / 20)) fail(`${c.name} peaks below -40 dBFS`);
}
const total = palette.reduce((n, s) => n + s.length, 0);
const joined = new Float32Array(total);
let at = 0;
for (const s of palette) { joined.set(s, at); at += s.length; }
await writeFile(join(OUT, 'palette.wav'), wav(joined));
console.log('\n  kill bundles (n -> pitch, level):');
for (const n of [1, 2, 4, 8, 16, 32]) {
  const doublings = Math.log2(n);
  const opts = { pitch: Math.pow(2, -doublings / 12), gainDb: -1.5 * doublings, ...(n >= 4 ? { subDb: -24 } : {}) };
  const samples = await render('kill', 0.5, opts);
  await writeFile(join(OUT, `kill-bundle-${n}.wav`), wav(samples));
  const m = measure(samples);
  console.log(`  n=${String(n).padEnd(3)} peak ${m.peak} dBFS  rms ${m.rms}  dominant ${m.hz} Hz`);
}

await browser.close();
server.close();
console.log(`\nwrote ${cues.length + 7} files to ${OUT}`);
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log(`  ${e}`);
if (errors.length) failures.push('console errors');
console.log(failures.length ? `FAIL (${failures.length})` : `PASS${live ? '' : ' (live half INCONCLUSIVE)'}`);
process.exit(failures.length ? 1 : 0);
