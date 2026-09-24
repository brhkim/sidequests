/**
 * The HUD band's fit. Loads the built page, forces the WIDEST state every
 * readout can reach - thousands of kills, standing past a billion percent,
 * SENSE and SHIELD at their caps, pools and multipliers in the thousands,
 * an army in the tens of millions - lets the value-change punches settle,
 * reads every text's rendered bounds off the UI scene (scale included, so a
 * figure fitted into its box is measured as drawn), and FAILS if
 *
 *   - two texts whose INK shares any height come within `MIN_GAP` px side
 *     by side, or two stacked lines come within `MIN_LEADING` px ink to
 *     ink - which is what the eye reads as one word (the rail since 1.1;
 *     the strip since the 2026-09-24 redesign, after `+1.84K%` ran into
 *     `+720%` at the late state),
 *   - a text inside a panel (the duel's well, a chip face, the pause
 *     button) comes within `INSET` px of that panel's side, or a text
 *     outside it touches it,
 *   - anything logged an error.
 *
 * Ink, not the text box: a Phaser Text's box carries the font's whole line
 * height, so two stacked lines "overlap" by their padding while their glyphs
 * are well apart. The ink is the canvas's own measurement of the string in
 * the text's font, placed on its baseline.
 *
 * It forces two states - the widest, and the narrowest (nothing held,
 * standing far below par) - because a fitted figure is checked at both ends
 * of its range. A layout constant changed by hand is checked here rather
 * than by looking at one still at one state.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = process.env.HUD_DIST ?? new URL('../dist/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const MIN_GAP = 8;
const INSET = 4;
/** Ink to ink between two stacked lines. */
const MIN_LEADING = 3;
/** The HUD band: the rail, the strip, the Titan row. */
const BAND_BOTTOM = 184;

const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (p === '/favicon.ico') { res.writeHead(204).end(); return; }
  const file = join(DIST, p === '/' ? 'index.html' : p);
  let body;
  try { body = await readFile(file); } catch { res.writeHead(404).end('nf'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
});
await new Promise((r) => server.listen(0, r));
const EXE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(EXE) ? { executablePath: EXE } : {});
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/?seed=3`, { waitUntil: 'load' });
await page.waitForFunction(() => window.game?.scene?.getScene('Game')?.squad, null, { timeout: 15000 });
await page.waitForTimeout(800);

const STATES = {
  widest: {
    kills: 1234, power: 19 * 2 ** 20,
    u: { sense: 3, shield: 3, damageBonus: 1234, damageMult: 1e4, rateBonus: 999, rateMult: 1234, guns: 99, pierce: 99 },
  },
  narrowest: {
    kills: 0, power: 1, parBoost: 40,
    u: { sense: 0, shield: 0, damageBonus: 0, damageMult: 1, rateBonus: 0, rateMult: 1, guns: 1, pierce: 0 },
  },
};

const fail = [];
for (const [name, state] of Object.entries(STATES)) {
  await page.evaluate((s) => {
    const g = window.game.scene.getScene('Game');
    g.paused = true;
    g.kills = s.kills;
    Object.assign(g.squad.progress.upgrades, s.u);
    g.squad.progress.power = s.power;
    g.squad.rebuild();
    if (s.parBoost) {
      // Par far ahead: the same build at many times the army.
      g.difficulty.ideal = { power: s.power * s.parBoost, upgrades: { ...g.squad.progress.upgrades, guns: 3, damageBonus: 2 } };
    }
    g.squad.shield.update(1 / 60, s.u.shield);
    g.emitHud();
  }, state);
  // The layout is judged at rest; `HudText.punch` separately caps its
  // overshoot to the padding the figure has.
  await page.waitForTimeout(700);
  const { texts, panels } = await page.evaluate(() => {
    const ui = window.game.scene.getScene('UI');
    const ctx = document.createElement('canvas').getContext('2d');
    const box = (o) => { const b = o.getBounds(); return { left: b.x, right: b.x + b.width, top: b.y, bottom: b.y + b.height }; };
    const ink = (t) => {
      const b = box(t);
      const st = t.style;
      ctx.font = `${st.fontStyle} ${st.fontSize} ${st.fontFamily}`;
      const m = ctx.measureText(t.text);
      const ascent = st.metrics?.ascent ?? ((b.bottom - b.top) / t.scaleY) * 0.78;
      const base = b.top + ((t.padding?.top ?? 0) + ascent) * t.scaleY;
      return { inkTop: base - m.actualBoundingBoxAscent * t.scaleY, inkBottom: base + m.actualBoundingBoxDescent * t.scaleY };
    };
    const shown = (o) => o.visible && o.alpha > 0.05;
    return {
      texts: ui.children.list
        .filter((o) => o.type === 'Text' && shown(o) && o.text !== '' && o.y < 184)
        .map((t) => ({ text: t.text, ...box(t), ...ink(t) })),
      panels: ui.children.list
        .filter((o) => o.type === 'Image' && shown(o) && /^hud-(duel|chip-\d+|pause)$/.test(o.texture.key))
        .map((o) => {
          // Chip and pause faces carry a baked shadow bleed; measure the face.
          const b = box(o);
          const bleed = o.texture.key === 'hud-duel' ? { x: 0, top: 0, bottom: 0 } : { x: 5, top: 3, bottom: 8 };
          return { key: o.texture.key, left: b.left + bleed.x, right: b.right - bleed.x, top: b.top + bleed.top, bottom: b.bottom - bleed.bottom };
        }),
    };
  });

  console.log(`\n${name}:`);
  for (const t of [...texts].sort((a, b) => a.inkTop - b.inkTop || a.left - b.left)) {
    console.log(`  ${t.text.padEnd(14)} x ${t.left.toFixed(0).padStart(3)}..${t.right.toFixed(0).padEnd(3)}  ink y ${t.inkTop.toFixed(0).padStart(3)}..${t.inkBottom.toFixed(0)}`);
  }
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      const hGap = Math.max(b.left - a.right, a.left - b.right);
      const vGap = Math.max(b.inkTop - a.inkBottom, a.inkTop - b.inkBottom);
      // Side by side: their ink shares height, so they need MIN_GAP across.
      if (vGap < 0 && hGap < MIN_GAP) fail.push(`${name}: "${a.text}" and "${b.text}" are ${hGap.toFixed(0)}px apart`);
      // Stacked: they share columns, so their ink needs air between lines.
      if (vGap >= 0 && hGap < 0 && vGap < MIN_LEADING) {
        fail.push(`${name}: "${a.text}" and "${b.text}" are ${vGap.toFixed(1)}px apart vertically`);
      }
    }
  }
  for (const t of texts) {
    if (t.right > 540 || t.left < 0 || t.inkBottom > BAND_BOTTOM) fail.push(`${name}: "${t.text}" leaves the HUD band`);
    for (const p of panels) {
      const cx = (t.left + t.right) / 2, cy = (t.inkTop + t.inkBottom) / 2;
      const centred = cx > p.left && cx < p.right && cy > p.top && cy < p.bottom;
      if (centred) {
        const room = Math.min(t.left - p.left, p.right - t.right, t.inkTop - p.top, p.bottom - t.inkBottom);
        if (room < INSET) fail.push(`${name}: "${t.text}" is ${room.toFixed(0)}px from the edge of ${p.key}`);
      } else if (Math.min(t.inkBottom, p.bottom) > Math.max(t.inkTop, p.top)) {
        const gap = Math.max(p.left - t.right, t.left - p.right);
        if (gap < INSET) fail.push(`${name}: "${t.text}" touches ${p.key} (${gap.toFixed(0)}px)`);
      }
    }
  }
}
await browser.close();
server.close();

if (errors.length) fail.push(`${errors.length} console/page errors: ${errors[0]}`);
for (const f of fail) console.log(`FAIL: ${f}`);
console.log(fail.length ? 'FAIL' : `PASS  (neighbours keep ${MIN_GAP}px across and ${MIN_LEADING}px between lines; texts sit ${INSET}px inside their panels)`);
process.exit(fail.length ? 1 : 0);
