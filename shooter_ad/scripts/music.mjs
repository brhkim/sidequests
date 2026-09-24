/**
 * The music instrument. Nobody running this can listen, so it measures what
 * a listener would notice first, in two halves:
 *
 * STATIC (Node, the game's own TypeScript): every pattern in every track is
 * a whole bar, every lead line covers its progression, every section and
 * pattern a track names exists; then 40 phrases are ARRANGED at each
 * intensity level, in boss mode and in the menu, and every note the
 * composer emits is checked to be in the scale of the chord under it, in
 * its layer's register. It prints how varied the arrangement is: distinct
 * section / progression / lead combinations, and how often the lead rests.
 *
 * RENDER (headless Chromium, OfflineAudioContext, the live chain): each
 * track through menu, intensity 1-4, a Titan section and a drop, written to
 * `.verify/music/<track>.wav` (stereo) with a spectrogram beside it
 * (`<track>.png`: time across, 40 Hz-16 kHz up, section edges in white).
 * Per section: integrated loudness (BS.1770 K-weighted, gated), peak, the
 * energy share under 150 Hz / 150 Hz-2 kHz / above (a phone speaker keeps
 * only the last two), and stereo width. Asserts no clipping, loudness in a
 * sane window, intensity 4 louder than 1, and enough energy above 150 Hz.
 *
 * MIX: NEON LANES at intensity 3 with a synthetic stream of effects laid
 * over it (kills four a second, contacts, a PERFECT each 7.5 s, a wave), each
 * resolved against the chord playing - rendered three ways (both, music
 * alone, effects alone) - and reports how far each PERFECT stands over the
 * music in its 300 ms. Asserts at least 3 LU: the reward must read.
 *
 * What it cannot say: whether any of it is GOOD. A human has to listen to
 * the .wav files; this only rules out the ways music is measurably broken.
 *   npm run build && npm run music
 */
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { register } from 'node:module';
import { deflateSync } from 'node:zlib';
import { chromium } from 'playwright';

register('./ts-resolve.mjs', import.meta.url);
const { TRACKS } = await import('../src/audio/music/tracks/index.ts');
const { planPhrase, barEvents, BARS } = await import('../src/audio/music/composer.ts');
const { SCALES } = await import('../src/audio/harmony.ts');

const ROOT = new URL('../', import.meta.url).pathname;
const DIST = join(ROOT, 'dist/');
const OUT = join(ROOT, '.verify/music/');
const RATE = 48000;
const failures = [];
const fail = (msg) => { failures.push(msg); console.log(`  FAIL ${msg}`); };
const ok = (cond, msg) => (cond ? console.log(`  ok   ${msg}`) : fail(msg));
const clean = (s) => s.replace(/[\s|]/g, '');

// --- static -----------------------------------------------------------------
console.log('static:');
const RANGE = { bass: [26, 67], pad: [36, 88], arp: [52, 100], lead: [38, 96], stab: [45, 88] };
const LINE = /^[0-9ab+\-_.]*$/;
const DRUM = /^[Xxg.]*$/;
for (const t of TRACKS) {
  const bad = [];
  const bar = (name, s, re) => { const c = clean(s); if (c.length !== 16 || !re.test(c)) bad.push(`${name} "${s}"`); };
  for (const [k, set] of Object.entries(t.drums)) for (const [p, s] of Object.entries(set)) bar(`drums.${k}.${p}`, s, DRUM);
  t.fills.forEach((s, i) => bar(`fills[${i}]`, s, DRUM));
  for (const [k, s] of Object.entries(t.bass)) bar(`bass.${k}`, s, LINE);
  for (const [k, s] of Object.entries(t.arps)) bar(`arps.${k}`, s, LINE);
  for (const [k, s] of Object.entries(t.stabs ?? {})) bar(`stabs.${k}`, s, /^[xX.]*$/);
  for (const [i, p] of [...t.progressions, ...t.boss].entries()) {
    if (![4, 8].includes(p.chords.length)) bad.push(`progression ${i} has ${p.chords.length} chords`);
    for (const l of p.leads) {
      const c = clean(l);
      if (!LINE.test(c) || (c.length !== p.chords.length * 16 && c.length !== 16)) bad.push(`progression ${i} lead "${l.slice(0, 20)}..." is ${c.length} steps`);
    }
  }
  for (const [name, sec] of Object.entries(t.sections)) {
    if (sec.drums && !t.drums[sec.drums]) bad.push(`section ${name} drums "${sec.drums}"`);
    if (sec.layers.includes('bass') && !t.bass[sec.bass ?? 'main']) bad.push(`section ${name} bass "${sec.bass}"`);
    if (sec.layers.includes('arp') && !t.arps[sec.arp ?? 'main']) bad.push(`section ${name} arp "${sec.arp}"`);
    if (sec.layers.includes('stab') && !t.stabs?.[sec.stab ?? 'main']) bad.push(`section ${name} stab`);
  }
  for (const list of [...t.arrangement, t.bossArrangement]) for (const n of list) if (!t.sections[n]) bad.push(`arrangement names "${n}"`);
  ok(bad.length === 0, `${t.id}: every pattern a whole bar, every lead its progression, every name resolves${bad.length ? ` - ${bad.slice(0, 3).join('; ')}` : ''}`);

  // Arrange 40 phrases per mode/level and check every note.
  const modes = [['menu', 0], ['play', 1], ['play', 2], ['play', 3], ['play', 4], ['boss', 3]];
  const offKey = [];
  const range = [];
  const rows = [];
  for (const [mode, level] of modes) {
    const combos = new Set();
    let leads = 0, notes = 0, bars = 0;
    let prev;
    for (let p = 0; p < 40; p++) {
      const plan = planPhrase(t, mode, level, p, p, 12345, { prev });
      prev = plan.name;
      combos.add(`${plan.name}/${t.progressions.indexOf(plan.prog)}/${plan.lead[0]?.midi ?? '-'}`);
      if (plan.lead.length) leads++;
      for (let b = 0; b < BARS; b++) {
        bars++;
        const h = plan.harmonies[b];
        const scale = SCALES[h.chord.scale ?? h.scale];
        for (const ev of barEvents(t, plan, b, 12345, p)) {
          for (const n of ev.notes) {
            notes++;
            const pc = (((n - h.key) % 12) + 12) % 12;
            if (!scale.includes(pc)) offKey.push(`${mode}${level} ${ev.layer} ${n} over deg ${h.chord.deg}`);
            const [lo, hi] = RANGE[ev.layer] ?? [0, 127];
            if (n < lo || n > hi) range.push(`${ev.layer} ${n}`);
          }
        }
      }
    }
    rows.push(`    ${`${mode} ${level}`.padEnd(7)} ${String(combos.size).padStart(3)} distinct phrases   lead in ${String(Math.round((100 * leads) / 40)).padStart(3)}%   ${(notes / bars).toFixed(1).padStart(5)} notes/bar`);
  }
  console.log(rows.join('\n'));
  ok(offKey.length === 0, `${t.id}: every note in the scale of its chord${offKey.length ? ` - ${offKey.slice(0, 4).join('; ')}` : ''}`);
  ok(range.length === 0, `${t.id}: every note in its layer's register${range.length ? ` - ${[...new Set(range)].slice(0, 6).join('; ')}` : ''}`);
}

// --- signal helpers -----------------------------------------------------------
function biquad(x, b, a) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
const kWeight = (x) => biquad(biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]),
  [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
/** BS.1770 integrated loudness of a stereo slice: 400 ms blocks, 75% overlap, -70 LUFS and -10 LU gates. */
function lufs(L, R) {
  const kl = kWeight(L), kr = kWeight(R);
  const block = Math.floor(0.4 * RATE), hop = Math.floor(0.1 * RATE);
  const z = [];
  for (let s = 0; s + block <= kl.length; s += hop) {
    let a = 0, b = 0;
    for (let i = s; i < s + block; i++) { a += kl[i] * kl[i]; b += kr[i] * kr[i]; }
    z.push((a + b) / block);
  }
  if (!z.length) { let a = 0; for (let i = 0; i < kl.length; i++) a += kl[i] * kl[i] + kr[i] * kr[i]; z.push(a / Math.max(1, kl.length)); }
  const L_ = (m) => -0.691 + 10 * Math.log10(Math.max(1e-12, m));
  const abs = z.filter((m) => L_(m) > -70);
  if (!abs.length) return -Infinity;
  const mean = (arr) => arr.reduce((p, c) => p + c, 0) / arr.length;
  const rel = L_(mean(abs)) - 10;
  const gated = abs.filter((m) => L_(m) > rel);
  return L_(mean(gated.length ? gated : abs));
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
    const wr0 = Math.cos(ang), wi0 = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = wr * wr0 - wi * wi0; wi = wr * wi0 + wi * wr0; wr = t;
      }
    }
  }
}
/** Energy shares under 150 Hz, 150 Hz-2 kHz and above, from 4096-point frames across the slice. */
function bands(M) {
  const n = 4096;
  let lo = 0, mid = 0, hi = 0;
  for (let s = 0; s + n <= M.length; s += n * 2) {
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = M[s + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
    fft(re, im);
    for (let k = 1; k < n / 2; k++) {
      const f = (k * RATE) / n, e = re[k] * re[k] + im[k] * im[k];
      if (f < 150) lo += e; else if (f < 2000) mid += e; else hi += e;
    }
  }
  const t = lo + mid + hi || 1;
  return [lo / t, mid / t, hi / t];
}
const dbfs = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

// --- png ----------------------------------------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function heat(v) {
  const stops = [[0, 0, 0], [40, 10, 90], [170, 30, 110], [250, 120, 30], [255, 240, 160]];
  const x = Math.max(0, Math.min(0.9999, v)) * (stops.length - 1);
  const i = Math.floor(x), f = x - i;
  return stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * f));
}
/** Time across (one column per 46 ms), log frequency up, the section edges in white. */
function spectrogram(M, edges) {
  const n = 2048, hop = 2205, H = 220, fLo = 40, fHi = 16000;
  const cols = Math.floor((M.length - n) / hop);
  const rgb = Buffer.alloc(cols * H * 3);
  for (let c = 0; c < cols; c++) {
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = M[c * hop + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
    fft(re, im);
    for (let y = 0; y < H; y++) {
      const f = fLo * Math.pow(fHi / fLo, 1 - y / (H - 1));
      const k = Math.min(n / 2 - 1, Math.round((f * n) / RATE));
      const db = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-12);
      const [r, g, b] = heat((db + 30) / 70);
      const o = (y * cols + c) * 3;
      rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b;
    }
  }
  for (const e of edges) {
    const c = Math.round((e * RATE) / hop);
    if (c < 0 || c >= cols) continue;
    for (let y = 0; y < H; y += 2) { const o = (y * cols + c) * 3; rgb[o] = rgb[o + 1] = rgb[o + 2] = 255; }
  }
  return png(cols, H, rgb);
}
function wav(L, R) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  const v = new DataView(buf.buffer, buf.byteOffset);
  buf.write('RIFF', 0); v.setUint32(4, 36 + n * 4, true); buf.write('WAVE', 8);
  buf.write('fmt ', 12); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  buf.write('data', 36); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 0x7fff, true);
    v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 0x7fff, true);
  }
  return buf;
}
const decode = (b64) => {
  const bytes = Buffer.from(b64, 'base64');
  const out = new Float32Array(bytes.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = bytes.readInt16LE(i * 2) / 0x8000;
  return out;
};

// --- render -------------------------------------------------------------------
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (path === '/favicon.ico') { res.writeHead(204).end(); return; }
  const file = join(DIST, path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
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
await page.waitForFunction(() => !!window.__audio && !!window.game, null, { timeout: 15000 });
// The game itself would run beside the renders on the software rasteriser and starve them.
await page.evaluate(() => window.game.loop.sleep());
await mkdir(OUT, { recursive: true });

const SCRIPT = [
  { label: 'menu', mode: 'menu', level: 0, bars: 4 },
  { label: 'level 1', mode: 'play', level: 1, bars: 8 },
  { label: 'level 2', mode: 'play', level: 2, bars: 8 },
  { label: 'level 3', mode: 'play', level: 3, bars: 16 },
  { label: 'level 4', mode: 'play', level: 4, bars: 16 },
  { label: 'titan', mode: 'boss', level: 4, bars: 16, crash: true },
  { label: 'drop', mode: 'play', level: 4, bars: 8, force: 'drop', crash: true },
];
const only = process.env.MUSIC_ONLY;
console.log('\nrender:');
const summary = [];
for (const [ti, t] of TRACKS.entries()) {
  if (only && only !== t.id) continue;
  const started = Date.now();
  const r = await page.evaluate(([i, s]) => window.__audio.renderMusic(i, s, 4242), [ti, SCRIPT]);
  const L = decode(r.left), R = decode(r.right);
  await writeFile(join(OUT, `${t.id}.wav`), wav(L, R));
  const barSec = (60 / t.bpm) * 4;
  const edges = [];
  let at = 0.05;
  console.log(`  ${t.name} (${t.bpm} BPM) - rendered ${r.seconds.toFixed(0)}s in ${((Date.now() - started) / 1000).toFixed(1)}s, ${Math.round(r.nodes / r.sections.length)} nodes/bar`);
  console.log('    section    LUFS    peak   <150Hz  150-2k  >2kHz  width   sections');
  const loud = {};
  let peakAll = 0;
  for (const seg of SCRIPT) {
    const a = Math.floor(at * RATE), b = Math.floor((at + seg.bars * barSec) * RATE);
    edges.push(at);
    const l = L.subarray(a, b), rr = R.subarray(a, b);
    const M = new Float32Array(l.length);
    let peak = 0, side = 0, mid = 0;
    for (let i = 0; i < l.length; i++) {
      M[i] = (l[i] + rr[i]) / 2;
      peak = Math.max(peak, Math.abs(l[i]), Math.abs(rr[i]));
      side += ((l[i] - rr[i]) / 2) ** 2; mid += M[i] ** 2;
    }
    peakAll = Math.max(peakAll, peak);
    const lu = lufs(l, rr);
    const [lo, md, hi] = bands(M);
    loud[seg.label] = lu;
    const secs = [...new Set(r.sections.slice(Math.round((at - 0.05) / barSec), Math.round((at - 0.05) / barSec) + seg.bars))].join(', ');
    console.log(`    ${seg.label.padEnd(9)} ${lu.toFixed(1).padStart(6)}  ${dbfs(peak).toFixed(1).padStart(6)}   ${String(Math.round(lo * 100)).padStart(4)}%  ${String(Math.round(md * 100)).padStart(5)}%  ${String(Math.round(hi * 100)).padStart(4)}%  ${(Math.sqrt(side / Math.max(mid, 1e-12))).toFixed(2).padStart(5)}   ${secs}`);
    if (seg.label !== 'menu' && lo > 0.85) fail(`${t.id} ${seg.label}: ${Math.round(lo * 100)}% of the energy under 150 Hz - a phone would hear almost nothing`);
    at += seg.bars * barSec;
  }
  await writeFile(join(OUT, `${t.id}.png`), spectrogram((() => { const M = new Float32Array(L.length); for (let i = 0; i < L.length; i++) M[i] = (L[i] + R[i]) / 2; return M; })(), edges));
  ok(peakAll < Math.pow(10, -0.3 / 20), `${t.id}: peak ${dbfs(peakAll).toFixed(1)} dBFS, under -0.3 (the limiter holds)`);
  ok(Object.values(loud).every((v) => v > -34 && v < -11), `${t.id}: every section between -34 and -11 LUFS`);
  ok(loud['level 4'] > loud['level 1'] + 1, `${t.id}: intensity 4 is louder than 1 (${loud['level 1'].toFixed(1)} -> ${loud['level 4'].toFixed(1)} LUFS)`);
  summary.push([t.id, loud]);
}

// --- mix ----------------------------------------------------------------------
if (!only || only === 'mix') {
  console.log('\nmix (NEON LANES, intensity 3, 16 bars, effects resolved against the chord playing):');
  const seg = [{ mode: 'play', level: 3, bars: 16, force: 'drop', crash: true }];
  const bar = 2.4;
  const hits = [];
  for (let t = 0.3, k = 0; t < 16 * bar; t += 0.25, k++) hits.push({ t, cue: 'kill', opts: { climb: [0, 1, 2, 3, 4, 5, 4, 3, 2, 1][k % 10], pan: ((k % 5) - 2) * 0.15 } });
  for (let t = 1.7; t < 16 * bar; t += 3.1) hits.push({ t, cue: 'contact', opts: { pan: -0.2 } });
  const picks = [];
  for (let t = 2.4 * 2; t < 16 * bar - 1; t += 7.5) { picks.push(t); hits.push({ t, cue: 'pickPerfect', opts: { climb: picks.length - 1 } }); }
  hits.push({ t: bar * 8, cue: 'wave' });
  const both = await page.evaluate(([s, h]) => window.__audio.renderMusic(0, s, 99, h, true), [seg, hits]);
  const mus = await page.evaluate(([s]) => window.__audio.renderMusic(0, s, 99, [], true), [seg]);
  const fx = await page.evaluate(([s, h]) => window.__audio.renderMusic(0, s, 99, h, false), [seg, hits]);
  const [BL, BR] = [decode(both.left), decode(both.right)];
  await writeFile(join(OUT, 'mix.wav'), wav(BL, BR));
  const [ML, MR, FL, FR] = [decode(mus.left), decode(mus.right), decode(fx.left), decode(fx.right)];
  console.log(`    whole mix ${lufs(BL, BR).toFixed(1)} LUFS   music alone ${lufs(ML, MR).toFixed(1)}   effects alone ${lufs(FL, FR).toFixed(1)}`);
  const margins = picks.map((t) => {
    const a = Math.floor(t * RATE), b = Math.floor((t + 0.4) * RATE);
    return lufs(FL.subarray(a, b), FR.subarray(a, b)) - lufs(ML.subarray(a, b), MR.subarray(a, b));
  });
  console.log(`    PERFECT over the music, per pick (400 ms): ${margins.map((m) => `${m >= 0 ? '+' : ''}${m.toFixed(1)} LU`).join('  ')}`);
  ok(margins.every((m) => m >= 3), 'every PERFECT stands at least 3 LU over the music under it');
  let peak = 0;
  for (let i = 0; i < BL.length; i++) peak = Math.max(peak, Math.abs(BL[i]), Math.abs(BR[i]));
  ok(peak < Math.pow(10, -0.3 / 20), `mix peak ${dbfs(peak).toFixed(1)} dBFS, under -0.3`);
}

await browser.close();
server.close();
console.log(`\nwrote .wav and .png per track to ${OUT}`);
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log(`  ${e}`);
if (errors.length) failures.push('console errors');
console.log(failures.length ? `FAIL (${failures.length})` : 'PASS');
process.exit(failures.length ? 1 : 0);
