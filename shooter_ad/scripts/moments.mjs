/**
 * Photographs every feedback moment mid-animation, which no other check sees.
 *
 * `verify` proves the game boots and `endscreen` photographs the screens, but
 * a pick wash, a breach flash, a wave banner or the death beat lasts under a
 * second and lands between their screenshots. Each one is FORCED here - the
 * squad is steered into a chosen gate, a body is moved into the ring, a cage
 * is dropped into the column - and shot at a fixed offset after the event.
 *
 * It asserts what a still can assert: zero errors, the expected text visible
 * at the expected moment, and the end screen held back for the death beat
 * (measured on the UI scene's own clock - see the death section for why not
 * wall time) and shown after it. It cannot see motion; look at the images.
 *   npm run build && npm run moments
 */
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = process.env.HUD_DIST ?? new URL('../dist/', import.meta.url).pathname;
const OUT_DIR = new URL('../.verify/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

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
await mkdir(OUT_DIR, { recursive: true });

const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {});
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

// The bot: steer into the option at `window.__pickRank` of the nearest offer
// (0 best, 2 worst, by the game's own deltas), and stay put when there is
// nothing to reach, so the forced moments below happen under a still squad.
await page.addInitScript(() => {
  window.__pickRank = 0;
  const chosen = new Map();
  window.__autopilot = ({ gates, squadX }) => {
    const reachable = gates.filter((g) => g.y < 820);
    if (reachable.length === 0) return squadX;
    const pair = reachable.reduce((a, b) => (b.y > a.y ? b : a)).pair;
    if (!chosen.has(pair)) {
      const offer = reachable.filter((g) => g.pair === pair).sort((a, b) => b.delta - a.delta);
      chosen.set(pair, offer[Math.min(offer.length - 1, window.__pickRank)].x);
    }
    return chosen.get(pair);
  };
});
await page.goto(`http://127.0.0.1:${port}/?seed=5`, { waitUntil: 'load' });
await page.waitForFunction(() => window.game?.scene?.getScene('Game')?.registry?.get('stats'), null, { timeout: 15000 });

const stats = () => page.evaluate(() => window.game.scene.getScene('Game').registry.get('stats'));
/** Every visible text on the field and loose in the UI (banners, bars). */
const shownTexts = () => page.evaluate(() => {
  const pick = (scene) => scene.children.list
    .filter((o) => o.type === 'Text' && o.visible && o.alpha > 0.05 && o.text !== '')
    .map((o) => o.text);
  return [...pick(window.game.scene.getScene('Game')), ...pick(window.game.scene.getScene('UI'))];
});
const shoot = (name) => page.screenshot({ path: join(OUT_DIR, `${name}.png`) });
const expect = (name, texts, want) => {
  const hit = want.some((w) => texts.some((t) => t.includes(w)));
  console.log(`${name}.png  ${hit ? 'shows' : 'MISSING'} ${want.join(' | ')}  [${texts.join(', ')}]`);
  if (!hit) errors.push(`${name}: expected one of ${want.join(' | ')} on screen`);
};

// --- picks: one per grade, photographed 150ms into the wash -----------------
for (const [rank, name] of [[0, 'perfect'], [1, 'good'], [2, 'bad']]) {
  await page.evaluate((r) => { window.__pickRank = r; }, rank);
  const before = (await stats()).decisions;
  await page.waitForFunction(
    (n) => window.game.scene.getScene('Game').registry.get('stats').decisions > n,
    before, { timeout: 30000, polling: 30 },
  ).catch(() => errors.push(`pick-${name}: no decision inside 30s`));
  await page.waitForTimeout(150);
  await shoot(`moment-pick-${name}`);
  // Any grade word proves the wash; the WORD depends on the offer's spread
  // (three near-identical options grade every pick PERFECT), so it is
  // reported rather than asserted.
  expect(`moment-pick-${name}`, await shownTexts(), ['PERFECT', 'GOOD', 'BAD', 'RISK']);
}

// --- a missed offer: its gates are dropped untaken, which the log grades ----
{
  await page.evaluate(() => { window.__pickRank = 99; });
  await page.waitForFunction(
    () => window.game.scene.getScene('Game').registry.get('stats').gates.some((g) => g.y > 300),
    null, { timeout: 30000, polling: 30 },
  ).catch(() => errors.push('miss: no offer in reach inside 30s'));
  await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    for (const gate of g.gates.items) gate.active = false;
  });
  await page.waitForTimeout(250);
  await shoot('moment-miss');
  expect('moment-miss', await shownTexts(), ['MISS']);
}

// --- damage: breach, contact, fire. Each moves a live body or bullet. ------
const withEnemy = (place) => page.evaluate((fn) => {
  const g = window.game.scene.getScene('Game');
  const e = g.enemies.items.find((x) => x.active && x.type.id !== 'titan');
  if (!e) return false;
  new Function('e', 'g', fn)(e, g);
  return true;
}, place);
// The forced charges below land on an army that starts at 5 and, since the
// wave-clear army went, is never topped up by the game: on 5 power the
// contact, the breach, the fire and the Titan's Runners took the run to zero
// before the dead-space frame. Hold 24 through the damage frames.
const holdPower = (n) => page.evaluate((p) => {
  const g = window.game.scene.getScene('Game');
  g.squad.progress.power = p;
  g.squad.rebuild();
}, n);
await holdPower(24);
{
  const ok = await withEnemy('e.x = Math.min(470, g.squad.x + 160); e.y = g.squad.y + 70; e.hp = e.maxHp = 1e9;');
  if (!ok) errors.push('breach: no live enemy to move');
  await page.waitForTimeout(120);
  await shoot('moment-breach');
  expect('moment-breach', await shownTexts(), ['-']);
}
{
  const ok = await withEnemy('e.x = g.squad.x; e.y = g.squad.y - 2; e.hp = e.maxHp = 1e9;');
  if (!ok) errors.push('contact: no live enemy to move');
  await page.waitForTimeout(120);
  await shoot('moment-contact');
  expect('moment-contact', await shownTexts(), ['-']);
}
{
  await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    for (let i = 0; i < 3; i++) g.enemyFire.spawn(g.squad.x + (i - 1) * 6, g.squad.y - 30, 0, 400, 1);
  });
  await page.waitForTimeout(330);
  await shoot('moment-fire');
  expect('moment-fire', await shownTexts(), ['-']);
}

// --- rescue: a one-hit cage dropped into the column ------------------------
{
  await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    g.enemies.cages.push({ x: g.squad.x, y: g.squad.y - 140, hp: 1, maxHp: 1, active: true });
  });
  await page.waitForTimeout(350);
  await shoot('moment-rescue');
  expect('moment-rescue', await shownTexts(), ['ARMY']);
}

// --- wave clear, then the Titan (wave 5): the warning, then its bar --------
{
  await holdPower(24);
  await page.evaluate(() => { window.game.scene.getScene('Game').enemies.wave.timeLeft = 0.01; });
  await page.waitForTimeout(300);
  await shoot('moment-wave');
  expect('moment-wave', await shownTexts(), ['WAVE ']);
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    g.enemies.wave.index = 4;
    g.enemies.wave.timeLeft = 0.01;
  });
  await page.waitForTimeout(300);
  await shoot('moment-titan-arrive');
  const arrive = await shownTexts();
  expect('moment-titan-arrive', arrive, ['TITAN']);
  await page.waitForTimeout(1500);
  await shoot('moment-titan-bar');
  const s = await stats();
  console.log(`moment-titan-bar.png  titan ${s.titan ? `hp ${Math.round(s.titan.hpFrac * 100)}%` : 'MISSING'}`);
  if (!s.titan) errors.push('titan-bar: no Titan on the board on wave 5');
}

// --- dead space: a wave-16 offer, where the cards are narrowest ------------
// Wave 16 is where `GATES.deadSpace` caps (108px cards in 180px lanes), so
// this is the two-line label at the smallest size it ever renders, with the
// gaps an offer can be missed through beside it. The wave is set through the
// same seam `npm run from` uses and the next offer forced rather than waited
// for. The squad is given a wave-16-sized army first: the wave-16 bodies that
// arrive in the ~4s the offer takes to descend would otherwise walk a
// nine-power ring to nothing before the shot, and the offer is rolled against
// the army it is shown to. The Titan the previous frame left on the board is
// retired so it cannot end the run first; the death frame below sets the
// power it needs itself.
{
  await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    for (const e of g.enemies.items) if (e.type.id === 'titan') e.active = false;
    g.squad.progress.power = 3000;
    g.squad.rebuild();
    g.enemies.startAt(16);
    window.__pickRank = 99;
    for (const gate of g.gates.items) gate.active = false;
    g.gates.accum = 1e9;
  });
  await page.waitForFunction(
    () => window.game.scene.getScene('Game').registry.get('stats').gates.some((g) => g.y > 380 && g.y < 640),
    null, { timeout: 30000, polling: 16 },
  ).catch(() => errors.push('deadspace: no wave-16 offer reached mid-screen inside 30s'));
  await shoot('moment-deadspace');
  const widths = await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    return g.gates.items.filter((x) => x.active).map((x) => x.width);
  });
  const texts = await shownTexts();
  const same = widths.length > 0 && widths.every((w) => w === widths[0]);
  console.log(`moment-deadspace.png  gates ${widths.join('/')}px wide at wave 16  [${texts.join(', ')}]`);
  if (!same || widths[0] >= 180) errors.push(`deadspace: expected narrowed gates at wave 16, got ${widths.join('/')}`);
}

// --- death: the beat, then the end screen ----------------------------------
// Measured in the UI scene's OWN clock, not wall time: under headless Chromium
// Phaser steps a fixed 17ms per frame whatever the frame actually took, so an
// idle scene runs its timers fast and a busy one slow. `__overAt` is stamped
// in-page on the `gameover` event; the end screen counts as shown once its
// panel is past half opacity (it fades in over 200ms).
{
  await page.evaluate(() => {
    const ui = window.game.scene.getScene('UI');
    window.__overAt = null;
    window.game.events.once('gameover', () => { window.__overAt = ui.time.now; });
    const g = window.game.scene.getScene('Game');
    g.squad.progress.power = 1;
    g.squad.rebuild();
  });
  // A forced moment needs a body to force. The wave-16 army the dead-space
  // frame left behind clears the board in a blink, so on some seeds no
  // enemy is live at this instant (seed 5 at startPower 1, 0.9); wait for
  // the spawner rather than fail on the board's phase.
  await page.waitForFunction(
    () => window.game.scene.getScene('Game').enemies.items.some((x) => x.active && x.type.id !== 'titan'),
    null, { timeout: 5000, polling: 16 },
  ).catch(() => {});
  const ok = await withEnemy('e.x = g.squad.x; e.y = g.squad.y - 2; e.hp = e.maxHp = 1e9;');
  if (!ok) errors.push('death: no live enemy to move');
  await page.waitForFunction(() => window.__overAt !== null, null, { timeout: 5000, polling: 10 })
    .catch(() => errors.push('death: the run did not end'));
  const endShown = () => page.evaluate(() => {
    const ui = window.game.scene.getScene('UI');
    const end = ui.children.list.find((c) => c.type === 'Container'
      && c.list.some((o) => o.type === 'Text' && o.text === 'REPLAY THIS MATCH'));
    return { shown: !!end && end.visible && end.alpha > 0.5, now: ui.time.now, overAt: window.__overAt };
  });
  const first = await endShown();
  await shoot('moment-death');
  let last = first;
  for (let i = 0; i < 200 && !last.shown; i++) { await page.waitForTimeout(15); last = await endShown(); }
  await shoot('moment-end');
  const heldFor = Math.round(last.now - last.overAt);
  console.log(`moment-death.png  ${first.shown ? 'end screen ALREADY SHOWN at' : 'field only,'} +${Math.round(first.now - first.overAt)}ms of scene time;`
    + `  moment-end.png  end screen ${last.shown ? 'shown' : 'MISSING'} at +${heldFor}ms (beat 480, fade 200)`);
  if (first.shown) errors.push('death: the end screen showed before the beat');
  if (!last.shown) errors.push('end: the end screen did not show within 3s');
  if (last.shown && heldFor < 480) errors.push(`end: shown after ${heldFor}ms of scene time, before the 480ms beat`);
}

await browser.close();
server.close();
console.log(`errors: ${errors.length}`);
for (const e of errors) console.log(`  ${e}`);
if (errors.length > 0) process.exit(1);
console.log('screenshots in .verify/ - look at them');
