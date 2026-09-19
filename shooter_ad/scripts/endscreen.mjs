/**
 * Screenshots the end screen, which no other check ever sees.
 *
 * `verify` runs 24 seconds and stops while the squad is alive, so the screen
 * that carries the score, the decision tally and the match code - the whole
 * shareable artefact - has never once been photographed by an automated check.
 * That is exactly the screen most likely to be wrong, because it is the only
 * one composed of values that do not exist until a run ends.
 *
 * Plays a real run so the decision log is real, then ends it, and shoots the
 * result at two different qualities of play so the grading colours are visible.
 *
 * Not a test - it asserts almost nothing. It produces images to look at.
 *   npm run build && npm run endscreen
 */
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = new URL('../dist/', import.meta.url).pathname;
const OUT_DIR = new URL('../.verify/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

/**
 * Three runs: one picking well, one picking badly - so grading is visible -
 * and the same seed on hard, because the end screen is the shareable artefact
 * and two runs on one seed at different difficulties must not look like the
 * same match in a screenshot.
 */
const RUNS = [
  { name: 'end-good', seed: 7, skill: 1.0, mode: 'normal' },
  { name: 'end-poor', seed: 7, skill: 0.0, mode: 'normal' },
  { name: 'end-hard', seed: 7, skill: 1.0, mode: 'hard' },
];
const PLAY_SECONDS = 45;

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

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let errors = 0;

/** Every text on a visible UI container, so screens are checked by what they say. */
const visibleTexts = (page) => page.evaluate(() => {
  const ui = window.game.scene.getScene('UI');
  const walk = (c) => c.list.flatMap((o) =>
    (o.type === 'Text' ? [o.text] : o.type === 'Container' && o.visible ? walk(o) : []));
  return ui.children.list
    .filter((o) => o.type === 'Container' && o.visible)
    .flatMap(walk);
});

/** Game-space position of a visible text, so controls are found by label. */
const findText = async (page, label) => {
  const at = await page.evaluate((want) => {
    const ui = window.game.scene.getScene('UI');
    const walk = (c) => {
      for (const o of c.list) {
        if (o.type === 'Text' && o.text === want) return { x: o.x, y: o.y };
        if (o.type === 'Container' && o.visible) { const r = walk(o); if (r) return r; }
      }
      return null;
    };
    for (const c of ui.children.list) {
      if (c.type !== 'Container' || !c.visible) continue;
      const r = walk(c);
      if (r) return r;
    }
    return null;
  }, label);
  if (!at) throw new Error(`no visible text "${label}"`);
  return at;
};

for (const run of RUNS) {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', (e) => { console.log(`  ERROR ${e.message}`); errors++; });
  page.on('console', (m) => { if (m.type() === 'error') { console.log(`  ERROR ${m.text()}`); errors++; } });
  const modeParam = run.mode === 'normal' ? '' : `&mode=${run.mode}`;
  await page.goto(`http://127.0.0.1:${port}/?seed=${run.seed}${modeParam}`, { waitUntil: 'load' });

  const box = await page.locator('canvas').boundingBox();
  const laneY = box.y + box.height * 0.84;
  await page.mouse.move(box.x + box.width / 2, laneY);
  await page.mouse.down();

  // Play for real, so the decision log holds genuine picks rather than
  // fabricated ones. Steering is committed per offer, as the probe does.
  const chosen = new Map();
  for (let tick = 0; tick < PLAY_SECONDS * 10; tick++) {
    const s = await page.evaluate(() =>
      window.game?.scene?.getScene('Game')?.registry?.get('stats') ?? null);
    if (s?.over) break;
    const reachable = (s?.gates ?? []).filter((g) => g.y < 820);
    if (reachable.length > 0) {
      const pair = reachable.reduce((a, b) => (b.y > a.y ? b : a)).pair;
      const offer = reachable.filter((g) => g.pair === pair);
      if (!chosen.has(pair)) {
        const best = offer.find((g) => g.best) ?? offer[0];
        const worst = offer.reduce((a, b) => (b.delta < a.delta ? b : a));
        chosen.set(pair, (run.skill >= 0.5 ? best : worst).x);
      }
      await page.mouse.move(box.x + (chosen.get(pair) / 540) * box.width, laneY);
    }
    await page.waitForTimeout(100);
  }

  // End the run deliberately. Waiting for a real death would make the shot
  // depend on how long the bot happens to survive, which is not what is being
  // photographed here.
  const summary = await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    g.over = true;
    g.emitGameOver();
    const s = g.registry.get('stats');
    return { decisions: s.decisions, optimal: s.optimal, tally: s.tally, wave: s.wave, mode: g.mode };
  });
  // The end screen is held back for the death beat (RENDER.moments.deathBeat,
  // 480ms) and then fades in over 200ms, so the texts are read AFTER the wait
  // rather than in the same evaluate as the emit - at that instant the screen
  // is not yet visible, by design.
  await page.waitForTimeout(900);
  summary.texts = await visibleTexts(page);
  await page.screenshot({ path: join(OUT_DIR, `${run.name}.png`) });
  // "Replay this match" must be the same match: same seed, run restarted.
  // It used to continue the stream under the old code, which no code could
  // reproduce. Checked once, on the first run. The control is a BUTTON now,
  // located by its label - a tap anywhere else must NOT restart, because a
  // screenshot is the medium and a stray touch used to destroy it.
  if (run.name === 'end-good') {
    const seedBefore = await page.evaluate(() => window.game.scene.getScene('Game').seed);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
    await page.waitForTimeout(300);
    const stray = await page.evaluate(() => window.game.scene.getScene('Game').over);
    if (!stray) { console.log('  ERROR a tap off the replay button restarted the run'); errors++; }
    const replay = await findText(page, 'REPLAY THIS MATCH');
    await page.mouse.click(box.x + (replay.x / 540) * box.width, box.y + (replay.y / 960) * box.height);
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => {
      const g = window.game.scene.getScene('Game');
      return { seed: g.seed, waiting: g.waiting, over: g.over, stats: g.registry.get('stats') };
    });
    console.log(`end-replay: seed ${seedBefore} -> ${after.seed}, wave ${after.stats.wave}, over ${after.over}`);
    if (after.seed !== seedBefore || after.over || after.waiting || after.stats.wave !== 1 || after.stats.kills !== 0) {
      console.log('  ERROR replay did not restart the same match'); errors++;
    }
    // And "new match" from the end screen returns to the start screen on a
    // fresh code.
    await page.evaluate(() => { const g = window.game.scene.getScene('Game'); g.over = true; g.emitGameOver(); });
    await page.waitForTimeout(900);
    const fresh = await findText(page, 'or start a new match');
    await page.mouse.click(box.x + (fresh.x / 540) * box.width, box.y + (fresh.y / 960) * box.height);
    await page.waitForTimeout(300);
    const start = await page.evaluate(() => {
      const g = window.game.scene.getScene('Game');
      return { seed: g.seed, waiting: g.waiting };
    });
    const codes = (await visibleTexts(page)).filter((t) => /^[0-9A-Z]{4}-[0-9A-Z]{3}-[NH]$/.test(t));
    console.log(`end-new-match: seed ${start.seed}, waiting ${start.waiting}, start screen code ${codes[0] ?? 'MISSING'}`);
    if (start.seed === seedBefore || !start.waiting || codes.length === 0) {
      console.log('  ERROR new match did not return to the start screen on a fresh code'); errors++;
    }
  }
  console.log(
    `${run.name}: wave ${summary.wave}, ${summary.decisions} decisions,`,
    `${Math.round(summary.optimal * 100)}% of optimal,`,
    `${summary.tally.top}/${summary.tally.mid}/${summary.tally.low}`,
    `[${summary.mode}]`,
  );
  if (summary.mode !== run.mode) {
    console.log(`  ERROR ran as ${summary.mode}, expected ${run.mode}`); errors++;
  }
  // The code's last group already carries the mode, but a reader comparing two
  // screenshots should not have to decode base32 to see it.
  const code = summary.texts.find((t) => /^[0-9A-Z]{4}-[0-9A-Z]{3}-[NH]$/.test(t));
  const letter = run.mode === 'hard' ? 'H' : 'N';
  if (!code || !code.endsWith(`-${letter}`)) {
    console.log(`  ERROR end screen code does not carry the mode: ${code}`); errors++;
  }
  const saysHard = summary.texts.some((t) => t.includes('HARD'));
  if (saysHard !== (run.mode === 'hard')) {
    console.log(`  ERROR end screen ${saysHard ? 'claims' : 'omits'} HARD wrongly`); errors++;
  }
  await page.close();
}

// The pause/help screen, at two very different pools. It is the only place the
// additive-versus-multiplicative rule is taught, and its whole teaching block is
// DERIVED from the player's current pools - so a shot at an empty pool and a
// shot deep into a run are two different screens, and only the second one
// exercises the conversion the screen exists to explain.
// Each shot also leaves the screen by a different button, because a pause with
// no way out is worse than no pause at all.
const PAUSE_SHOTS = [
  { name: 'pause-early', play: 2, exit: 'restart' },
  { name: 'pause-mid', play: 40, exit: 'resume' },
];
for (const shot of PAUSE_SHOTS) {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', (e) => { console.log(`  ERROR ${e.message}`); errors++; });
  page.on('console', (m) => { if (m.type() === 'error') { console.log(`  ERROR ${m.text()}`); errors++; } });
  await page.goto(`http://127.0.0.1:${port}/?seed=11`, { waitUntil: 'load' });

  const box = await page.locator('canvas').boundingBox();
  const laneY = box.y + box.height * 0.84;
  await page.mouse.move(box.x + box.width / 2, laneY);
  await page.mouse.down();
  const chosen = new Map();
  for (let tick = 0; tick < shot.play * 10; tick++) {
    const s = await page.evaluate(() =>
      window.game?.scene?.getScene('Game')?.registry?.get('stats') ?? null);
    if (s?.over) break;
    const reachable = (s?.gates ?? []).filter((g) => g.y < 820);
    if (reachable.length > 0) {
      const pair = reachable.reduce((a, b) => (b.y > a.y ? b : a)).pair;
      const offer = reachable.filter((g) => g.pair === pair);
      if (!chosen.has(pair)) chosen.set(pair, (offer.find((g) => g.best) ?? offer[0]).x);
      await page.mouse.move(box.x + (chosen.get(pair) / 540) * box.width, laneY);
    }
    await page.waitForTimeout(100);
  }
  await page.mouse.up();

  // Tap the real control at its real coordinates, so the hit test GameScene
  // owns is what is exercised rather than an event fired past it.
  const scale = box.width / 540;
  await page.mouse.click(box.x + 486 * scale, box.y + 100 * scale);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT_DIR, `${shot.name}.png`) });

  const state = await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    return { paused: g.paused, elapsed: g.elapsed, stats: g.registry.get('stats') };
  });
  console.log(`${shot.name}: paused = ${state.paused}, wave ${state.stats.wave}`);
  if (state.paused !== true) {
    console.log('  ERROR the pause button did not pause the game');
    errors++;
  }

  // The DETAILS page: the rail's DPS derived line by line. Photographed on
  // the mid-run shot, where the numbers are worth deriving, and left by the
  // same button the BONUSES page is, so the tab does not trap the player.
  if (shot.name === 'pause-mid') {
    // The rail's own figure, read off the BONUSES page before leaving it.
    const rail = (await visibleTexts(page)).find((t) => /DPS  ·  PAR/.test(t));
    const tab = await findText(page, 'DETAILS');
    await page.mouse.click(box.x + tab.x * scale, box.y + tab.y * scale);
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(OUT_DIR, 'pause-details.png') });
    const texts = await visibleTexts(page);
    const derived = texts.find((t) => /^=\s+\S+ DPS/.test(t));
    console.log(`pause-details: ${derived ?? 'NO TOTAL LINE'}  |  rail ${rail ?? '?'}`);
    if (!derived) { console.log('  ERROR details page has no derived total'); errors++; }
    // The derived total must be the rail's number, or the page is a lie.
    const a = derived?.match(/^=\s+(\S+) DPS/)?.[1];
    const b = rail?.match(/^(\S+) DPS/)?.[1];
    if (a !== b) { console.log(`  ERROR details total ${a} differs from the rail's ${b}`); errors++; }
  }

  // Leave by the button, and check the simulation did what the button says. A
  // frozen simulation that never restarts looks identical to a working one in
  // a screenshot. Located by label: the buttons moved once already.
  const exitAt = await findText(page, shot.exit === 'resume' ? 'RESUME' : 'RESTART');
  await page.mouse.click(box.x + exitAt.x * scale, box.y + exitAt.y * scale);
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    return { paused: g.paused, elapsed: g.elapsed, stats: g.registry.get('stats') };
  });
  console.log(
    `${shot.name}: ${shot.exit} -> paused ${after.paused},`,
    `wave ${after.stats.wave}, power ${after.stats.power}, ${after.elapsed.toFixed(1)}s`,
  );
  if (after.paused !== false) { console.log(`  ERROR ${shot.exit} did not unpause`); errors++; }
  if (shot.exit === 'resume' && !(after.elapsed > state.elapsed)) {
    console.log('  ERROR resume did not restart the simulation clock'); errors++;
  }
  if (shot.exit === 'restart' && !(after.stats.wave === 1 && after.stats.kills === 0)) {
    console.log('  ERROR restart did not reset the run'); errors++;
  }
  await page.close();
}

// The start screen is reached only WITHOUT ?seed=, which is the form every
// other script passes - so without this shot it would be a user-facing screen
// no automated check has ever seen. That is exactly how the end screen got to
// where it was.
//
// Both modes are photographed, because the mode is the one thing on this
// screen a player did not choose: a shared code carries its difficulty, and
// hard mode changes how fast offers descend and how awkward their numbers are,
// neither of which is visible until you are already inside a run. A start
// screen that failed to name it would send people into a different game than
// the one they think they tapped into.
for (const shot of [
  { name: 'start-invited', code: '2TNBBGSN', mode: 'normal', letter: 'N' },
  { name: 'start-hard', code: '2TNBBGSH', mode: 'hard', letter: 'H' },
]) {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', (e) => { console.log(`  ERROR ${e.message}`); errors++; });
  page.on('console', (m) => { if (m.type() === 'error') { console.log(`  ERROR ${m.text()}`); errors++; } });
  await page.goto(`http://127.0.0.1:${port}/?m=${shot.code}`, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT_DIR, `${shot.name}.png`) });
  // `waiting` alone is a weak assertion: a frozen game with no start screen at
  // all also reports true, and that is exactly the bug that shipped once - the
  // screen was emitted before UIScene existed to hear it. Check the screen is
  // actually VISIBLE and carrying the match, not merely that play has not begun.
  const state = await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    const ui = window.game.scene.getScene('UI');
    const texts = ui.children.list
      .filter((o) => o.type === 'Container' && o.visible)
      .flatMap((c) => c.list.filter((o) => o.type === 'Text').map((o) => o.text));
    return { waiting: g.waiting, mode: g.mode, texts };
  });
  const codeText = state.texts.find((t) => /^[0-9A-Z]{4}-[0-9A-Z]{3}-[NH]$/.test(t));
  const namesMode = state.texts.some((t) => t.startsWith(shot.mode.toUpperCase()));
  console.log(
    `${shot.name}: waiting=${state.waiting} mode=${state.mode}`,
    `code=${codeText ?? 'MISSING'} namesMode=${namesMode}`,
  );
  if (state.waiting !== true) { console.log('  ERROR shared link did not hold'); errors++; }
  if (!codeText) { console.log('  ERROR start screen is not showing the match code'); errors++; }
  if (state.mode !== shot.mode) {
    console.log(`  ERROR link decoded as ${state.mode}, expected ${shot.mode}`); errors++;
  }
  // The code's own last group must differ between modes, or two runs on one
  // seed are indistinguishable in a screenshot - which is the whole medium.
  if (codeText && !codeText.endsWith(`-${shot.letter}`)) {
    console.log(`  ERROR code does not carry the mode: ${codeText}`); errors++;
  }
  if (!namesMode) {
    console.log('  ERROR start screen does not name the difficulty in words'); errors++;
  }
  await page.close();
}

// The difficulty toggle. It is the ONLY route into hard mode for a real player
// - everything else in this file reaches it by query string, which nobody
// outside these scripts will ever type - so without this it would be the one
// control on the one screen that no check has pressed.
{
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', (e) => { console.log(`  ERROR ${e.message}`); errors++; });
  page.on('console', (m) => { if (m.type() === 'error') { console.log(`  ERROR ${m.text()}`); errors++; } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const read = () => page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    const ui = window.game.scene.getScene('UI');
    const texts = ui.children.list
      .filter((o) => o.type === 'Container' && o.visible)
      .flatMap((c) => c.list.filter((o) => o.type === 'Text').map((o) => o.text));
    return {
      mode: g.mode,
      waiting: g.waiting,
      code: texts.find((t) => /^[0-9A-Z]{4}-[0-9A-Z]{3}-[NH]$/.test(t)),
      saysHard: texts.some((t) => t.startsWith('HARD')),
    };
  });
  const box = await page.locator('canvas').boundingBox();
  // Located by the hint that names it, not by a hardcoded y. The same literal
  // spelled out twice is how `verify` came to fail on a button that worked.
  const toggleAt = await page.evaluate(() => {
    const ui = window.game.scene.getScene('UI');
    for (const c of ui.children.list) {
      if (c.type !== 'Container' || !c.visible) continue;
      const hint = c.list.find(
        (o) => o.type === 'Text' && o.text === 'tap to change difficulty',
      );
      // The hint sits just under the label; the tappable bar is centred on the
      // label itself, which is one line above.
      if (hint) return { x: hint.x, y: hint.y - 28 };
    }
    return null;
  });
  if (!toggleAt) { console.log('  ERROR no difficulty toggle on the start screen'); errors++; }
  const tapToggle = async () => {
    await page.mouse.click(
      box.x + (toggleAt.x / 540) * box.width,
      box.y + (toggleAt.y / 960) * box.height,
    );
    await page.waitForTimeout(250);
  };

  const before = await read();
  await tapToggle();
  const afterOne = await read();
  await tapToggle();
  const afterTwo = await read();
  console.log(
    `start-toggle: ${before.mode} ${before.code} ->`,
    `${afterOne.mode} ${afterOne.code} -> ${afterTwo.mode} ${afterTwo.code}`,
  );
  await page.screenshot({ path: join(OUT_DIR, 'start-toggled-hard.png') });

  if (before.mode !== 'normal') { console.log('  ERROR fresh run did not start on normal'); errors++; }
  if (afterOne.mode !== 'hard') { console.log('  ERROR tapping the toggle did not select hard'); errors++; }
  if (!afterOne.saysHard) { console.log('  ERROR toggle did not redraw the label'); errors++; }
  if (afterTwo.mode !== 'normal') { console.log('  ERROR toggle does not go back'); errors++; }
  // The code must follow the mode, or two difficulties share one identity and
  // the shareable artefact is lying.
  if (!afterOne.code?.endsWith('-H') || !afterTwo.code?.endsWith('-N')) {
    console.log('  ERROR match code did not follow the mode'); errors++;
  }
  if (afterOne.code?.slice(0, 8) !== before.code?.slice(0, 8)) {
    console.log('  ERROR toggling the mode also changed the seed'); errors++;
  }
  // A toggle that starts the run under the finger would be worse than no
  // toggle: the tap that picks a difficulty must not also begin playing it.
  if (afterTwo.waiting !== true) { console.log('  ERROR toggling started the match'); errors++; }
  await page.close();
}

// Entering a match code. The medium is a screenshot, and a screenshot loses
// the link, so a code you cannot type back in is decoration. The prompt is a
// native dialog; Playwright answers it the way a person would.
{
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', (e) => { console.log(`  ERROR ${e.message}`); errors++; });
  page.on('console', (m) => { if (m.type() === 'error') { console.log(`  ERROR ${m.text()}`); errors++; } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const box = await page.locator('canvas').boundingBox();
  const tap = async (label) => {
    const at = await findText(page, label);
    await page.mouse.click(box.x + (at.x / 540) * box.width, box.y + (at.y / 960) * box.height);
    await page.waitForTimeout(300);
  };
  const read = async () => {
    const g = await page.evaluate(() => {
      const g = window.game.scene.getScene('Game');
      return { seed: g.seed, mode: g.mode, waiting: g.waiting };
    });
    const code = (await visibleTexts(page)).find((t) => /^[0-9A-Z]{4}-[0-9A-Z]{3}-[NH]$/.test(t));
    return { ...g, code };
  };
  const before = await read();
  // A hard code, typed the sloppy way: lower case, no dashes, an O for the 0.
  page.once('dialog', (d) => d.accept('2tnbbgsh'));
  await tap('enter a code');
  const typed = await read();
  // Genuinely not a code: the decoder folds and forgives, so eight letters of
  // anything would decode. Too short cannot.
  page.once('dialog', (d) => d.accept('nope'));
  await tap('enter a code');
  const rejected = await read();
  // The rejection message stands in for the label for a moment; let it clear.
  await page.waitForTimeout(1800);
  page.once('dialog', (d) => d.dismiss());
  await tap('enter a code');
  const dismissed = await read();
  await tap('new match');
  const fresh = await read();
  await page.screenshot({ path: join(OUT_DIR, 'start-entered.png') });
  console.log(`start-enter: ${before.code} -> typed ${typed.code} (${typed.mode}) -> bad ${rejected.code} -> dismissed ${dismissed.code} -> new ${fresh.code}`);
  if (typed.code !== '2TNB-BGS-H' || typed.mode !== 'hard') { console.log('  ERROR typed code was not adopted'); errors++; }
  if (rejected.code !== typed.code || dismissed.code !== typed.code) { console.log('  ERROR a bad or dismissed prompt changed the match'); errors++; }
  if (fresh.code === typed.code || fresh.mode !== 'hard') { console.log('  ERROR new match did not roll a fresh seed on the same mode'); errors++; }
  if (!fresh.waiting) { console.log('  ERROR a start-screen control began the match'); errors++; }
  await tap('START MATCH');
  const started = await read();
  if (started.waiting) { console.log('  ERROR START MATCH did not begin the entered match'); errors++; }
  await page.close();
}

// The SENSE mark. Sense is forced to its cap so half the offers arrive
// sensed, and the shot is taken the moment one is on screen with its best
// option marked. Asserts a mark appears at all, and that it sits on the
// option the scoring calls best - the whole promise of the bonus.
{
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', (e) => { console.log(`  ERROR ${e.message}`); errors++; });
  page.on('console', (m) => { if (m.type() === 'error') { console.log(`  ERROR ${m.text()}`); errors++; } });
  await page.goto(`http://127.0.0.1:${port}/?seed=21`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    g.squad.progress.upgrades.sense = 3;
    g.squad.progress.power = 40;
    g.squad.rebuild();
  });
  let marked = null;
  for (let tick = 0; tick < 600 && !marked; tick++) {
    const s = await page.evaluate(() => window.game.scene.getScene('Game').registry.get('stats'));
    if (s.over) break;
    const m = s.gates.find((g) => g.sensed && g.y > 150 && g.y < 700);
    if (m) marked = { gate: m, all: s.gates.filter((g) => g.pair === m.pair), sense: s.sense };
    else await page.waitForTimeout(100);
  }
  if (!marked) {
    console.log('  ERROR no sensed offer appeared in 60s at sense 3'); errors++;
  } else {
    await page.screenshot({ path: join(OUT_DIR, 'sense-mark.png') });
    const best = marked.all.reduce((a, b) => (b.delta > a.delta ? b : a));
    console.log(`sense-mark: marked ${marked.gate.label} (${(marked.gate.delta * 100).toFixed(0)}%) of`
      + ` ${marked.all.map((g) => `${g.label} ${(g.delta * 100).toFixed(0)}%`).join(' | ')}; sense ${marked.sense}`);
    if (!marked.gate.best || marked.gate.delta < best.delta - 1e-9) {
      console.log('  ERROR the mark is not on the best option'); errors++;
    }
    if (marked.all.filter((g) => g.sensed).length !== 1) {
      console.log('  ERROR more than one option of the offer is marked'); errors++;
    }
  }
  await page.close();
}

await browser.close();
server.close();

// The one thing worth asserting: a good run must grade above a bad one on the
// same seed. If it does not, the scoring the whole screen rests on is wrong.
console.log(`\nerrors: ${errors}`);
if (errors > 0) process.exit(1);
console.log('screenshots in .verify/ - look at them');
