/**
 * What a rescue cage is worth, measured on the built game rather than argued.
 *
 * The probe bot never aims at a cage, so `npm run balance` cannot see the
 * reward at all - a first-wave cage was five gates' worth (+5 on an army of
 * 1, a x6 in DPS) for three versions and no instrument said so. This one
 * FORCES it: at each army size below it holds the squad at that power, drops
 * a one-hit cage into the column, waits for it to open, and reads the army
 * and the standing before and after. Every reward is asserted against
 * `cageReward` from Progression, and the label the cage carried is asserted
 * against the army it actually gave. The last column is the DPS multiplier
 * one cage buys, which is also the jump in standing against a par that did
 * not move - the number the author wanted small.
 *
 *   npm run build && npm run rescue
 */
import { register } from 'node:module';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { serveDist } from './probe-bot.mjs';
register('./ts-resolve.mjs', import.meta.url);

const { cageReward } = await import('../src/systems/Progression.ts');
const { CAGE } = await import('../src/config.ts');

const POWERS = [1, 3, 10, 19, 30, 100, 1000];
const dist = await serveDist();
const port = dist.port;
const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {});
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
// Stand still: the cage is dropped straight over the squad.
await page.addInitScript(() => { window.__autopilot = ({ squadX }) => squadX; });
await page.goto(`http://127.0.0.1:${port}/?seed=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.game?.scene?.getScene('Game')?.registry?.get('stats'), null, { timeout: 15000 });

const stats = () => page.evaluate(() => window.game.scene.getScene('Game').registry.get('stats'));
const cageLabels = () => page.evaluate(() => window.game.scene.getScene('Game').children.list
  .filter((o) => o.type === 'Text' && o.visible && /^\+\d+$/.test(o.text)).map((o) => o.text));

console.log(`share ${CAGE.share}  floor ${CAGE.minReward}\n`);
console.log('army    label  gave  expected  dps before -> after   one cage buys');
for (const power of POWERS) {
  await page.evaluate((p) => {
    const g = window.game.scene.getScene('Game');
    g.squad.progress.power = p;
    g.squad.rebuild();
    for (const c of g.enemies.cages) c.active = false;
  }, power);
  await page.waitForTimeout(80);
  const before = await stats();
  // Dropped unbreakable so the label can be read off a frame, then made a
  // one-hit cage: past a few hundred DPS a 1hp cage opens before it is drawn.
  await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    g.enemies.cages.push({ x: g.squad.x, y: g.squad.y - 140, hp: 1e12, maxHp: 1e12, hitFlash: -1, active: true });
  });
  await page.waitForTimeout(100);
  const label = (await cageLabels())[0] ?? '(none)';
  await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    const c = g.enemies.cages.find((x) => x.active);
    if (c) { c.hp = 1; c.maxHp = 1; }
  });
  await page.waitForFunction(
    (n) => window.game.scene.getScene('Game').registry.get('stats').rescues > n,
    before.rescues, { timeout: 8000, polling: 20 },
  ).catch(() => errors.push(`power ${power}: the cage did not open inside 8s`));
  await page.waitForTimeout(80);
  const after = await stats();
  const gave = after.power - before.power;
  const expected = cageReward(power);
  if (gave !== expected) errors.push(`power ${power}: gave ${gave}, cageReward says ${expected}`);
  if (label !== `+${expected}`) errors.push(`power ${power}: cage label ${label}, gave ${gave}`);
  console.log(
    `${String(power).padStart(5)}  ${label.padStart(6)}  ${String(gave).padStart(4)}  ${String(expected).padStart(8)}`
    + `  ${String(before.dps).padStart(6)} -> ${String(after.dps).padEnd(6)}`
    + `   x${(after.dps / before.dps).toFixed(2)}`,
  );
}

await browser.close();
dist.close();
if (errors.length) {
  console.error(`\nFAIL\n${errors.join('\n')}`);
  process.exit(1);
}
console.log('\nrescue: every cage gave cageReward(power) and carried that label');
