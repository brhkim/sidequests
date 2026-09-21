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

// Pierce carries past a cage (1.2, the author's ask). At each pierce level a
// one-hit cage is dropped over the squad on a cleared field and, in the frame
// it opens, the bullets that met it are counted: with no pierce the opening
// shot is spent at the bars, with one it flies on with a shot at the level
// below. The count is taken INSIDE the poll that sees the open - a bullet
// crosses the field in under a second, and a round trip later it may already
// have met the next spawn.
console.log('\npierce  bullets flying on past the cage they opened');
for (const pierce of [0, 1, 2]) {
  await page.evaluate((pl) => {
    const g = window.game.scene.getScene('Game');
    g.squad.progress.power = 19;
    g.squad.progress.upgrades.pierce = pl;
    g.squad.rebuild();
    for (const c of g.enemies.cages) c.active = false;
    for (const e of g.enemies.items) e.active = false;
    // And no bullets in flight: the cage is 140px up, and a shot spawned
    // under the previous level would be the one to open it.
    for (const b of g.bullets.items) b.active = false;
    g.enemies.cages.push({ x: g.squad.x, y: g.squad.y - 140, hp: 1, maxHp: 1, hitFlash: -1, active: true, probe: pl });
  }, pierce);
  const seen = await page.waitForFunction((pl) => {
    const g = window.game.scene.getScene('Game');
    const cage = g.enemies.cages.find((c) => c.probe === pl);
    if (!cage || cage.active) return null;
    const met = g.bullets.items.filter((b) => b.struck.includes(cage));
    return { met: met.length, through: met.filter((b) => b.active).length};
  }, pierce, { timeout: 8000, polling: 1 })
    .then((h) => h.jsonValue())
    .catch(() => { errors.push(`pierce ${pierce}: the cage did not open inside 8s`); return { met: 0, through: 0 }; });
  const want = pierce > 0;
  if (seen.met === 0) errors.push(`pierce ${pierce}: no bullet on record met the cage`);
  if ((seen.through > 0) !== want) errors.push(`pierce ${pierce}: ${seen.through} bullets flew on past the cage; expected ${want ? 'some' : 'none'}`);
  console.log(`${String(pierce).padStart(6)}  ${seen.through} of ${seen.met} that met it`);
}

await browser.close();
dist.close();
if (errors.length) {
  console.error(`\nFAIL\n${errors.join('\n')}`);
  process.exit(1);
}
console.log('\nrescue: every cage gave cageReward(power) and carried that label');
