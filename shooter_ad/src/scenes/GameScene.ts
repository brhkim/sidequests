import Phaser from 'phaser';
import {
  ARENA, CAGE, COLORS, ENEMY_FIRE, GATES, RENDER, SIM, SQUAD, STREAK, VIEW, WAVE, WEAPON,
} from '../config';
import { bulletTint, tierRow } from '../data/tiers';
import { Squad } from '../systems/Squad';
import { Bullets } from '../systems/Bullets';
import { EnemyBullets } from '../systems/EnemyBullets';
import { Enemies, type Enemy } from '../systems/Enemies';
import { Gates } from '../systems/Gates';
import { Difficulty } from '../systems/Difficulty';
import { DecisionLog } from '../systems/DecisionLog';
import { scoreOffer } from '../systems/Scoring';
import { Grid } from '../systems/Grid';
import { SpritePool } from '../systems/SpritePool';
import { createRng } from '../systems/Rng';
import { encodeMatch, matchFromQuery, matchUrl, type MatchMode } from '../systems/MatchCode';
import { modeFromQuery, setMode } from '../systems/Mode';
import { VERSION } from '../version';
import { bundleFactor, moveSpeed, pierceMultiplier, type Upgrades } from '../systems/Progression';
import { armorAgainst } from '../systems/EnemyMotion';
import { strike } from '../systems/Bullets';
import { PAUSE_BUTTON } from './hud/PauseScreen';
import { RAIL_HEIGHT } from './hud/TopRail';
import type { HudPayload } from './hud/types';

const SKIN = 0xf2c9a0;

/** One live gate, priced by the game's own `scoreOffer`. */
interface ScoredGate {
  x: number; y: number;
  label: string; axis: string; form: string;
  pair: number;
  delta: number;
  best: boolean;
}

/** See `GameScene.applyStartOverride`. Instruments only. */
interface StartOverride {
  power: number;
  upgrades: Partial<Upgrades>;
  wave: number;
}

/** See `GameScene.steerAutopilot`. Instruments only. */
type AutopilotFn = (state: {
  elapsed: number;
  squadX: number;
  wave: number;
  gates: ScoredGate[];
}) => number | null;

export class GameScene extends Phaser.Scene {
  private squad!: Squad;
  private bullets!: Bullets;
  private enemyFire!: EnemyBullets;
  private enemies!: Enemies;
  private gates!: Gates;
  private difficulty!: Difficulty;
  private log!: DecisionLog;
  /** Seconds of simulated play, for ordering decision rows. */
  private elapsed = 0;
  /** Real time banked but not yet spent on a whole simulation step. */
  private accumulator = 0;
  private grid!: Grid<Enemy>;

  private bodyPool!: SpritePool;
  private headPool!: SpritePool;
  private enemyPool!: SpritePool;
  private bulletPool!: SpritePool;
  private enemyBulletPool!: SpritePool;
  private cagePool!: SpritePool;

  private overlay!: Phaser.GameObjects.Graphics;
  /**
   * The selection guide, on its own layer ABOVE the squad and every
   * projectile. On the shared overlay it sat under the bullet stream and was
   * unreadable exactly when it mattered - mid-wave, with an offer closing.
   */
  private selection!: Phaser.GameObjects.Graphics;
  private gateVisuals: {
    rect: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
  }[] = [];
  private cursors?: { left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  private rng: () => number = Math.random;
  private targetX = VIEW.width / 2;
  private kills = 0;
  /**
   * Why runs end, and what they cost to steer. Published so the probe can
   * separate "the player chose badly" from "the player could not be in two
   * places at once" - the survival curve falls as PROBE_SKILL rises and these
   * are what decide whether that is the bot's positioning or the game's clamp.
   */
  private breachLoss = 0;
  private fireLoss = 0;
  /**
   * Bresenham accumulator deciding which shots are DRAWN. Rendering state; it
   * is read by nothing in the simulation and reset with the run only so a new
   * run's first bullets are not a hangover from the last one's stride.
   */
  private drawCredit = 0;
  /**
   * The SIMULATION's stride, which is a different thing and must stay one.
   * `simCredit` decides which shots become bullets past
   * `WEAPON.maxSimShotsPerSecond`; the shots in between are banked in
   * `pendingShots` / `pendingDamage` and ride in the next bullet spawned. This
   * is gameplay state - it changes what is spawned and what is hit - so it is
   * deterministic by construction (no RNG, simulated steps only) and
   * `npm run repeat` keeps it so.
   */
  private simCredit = 0;
  private pendingShots = 0;
  private pendingDamage = 0;
  private traveled = 0;
  /** Highest power the run reached. The sweep reports it; a run's peak is what
   * says whether the old ceilings were ever within reach of real play. */
  private peakPower = 0;
  private lastX = VIEW.width / 2;
  private streak = 0;
  private over = false;
  /** Why the run ended, for the instruments: a Titan landing and attrition are
   * different failures and the runner has to tell them apart. */
  private cause: 'overrun' | 'titan' | null = null;
  /** Held at the start screen until the player commits. */
  private waiting = true;
  /** Frozen on the pause/help screen. */
  private paused = false;

  private seed = 0;
  private mode: MatchMode = 'normal';

  constructor() { super('Game'); }

  create(): void {
    const { rng, seed } = createRng();
    this.seed = seed;
    this.rng = rng;
    // Set BEFORE anything reads a wave-keyed difficulty number. Hard mode is a
    // wave offset on the judgment axes and every consumer reads it from
    // `Mode.ts`, so this is the one place a run's difficulty is decided.
    this.mode = modeFromQuery(window.location.search);
    setMode(this.mode);
    this.squad = new Squad(VIEW.width / 2, ARENA.laneY, SQUAD.startPower, this.rng);
    this.bullets = new Bullets();
    this.enemyFire = new EnemyBullets();
    this.difficulty = new Difficulty();
    this.enemies = new Enemies(this.rng, this.difficulty, this.enemyFire);
    this.log = new DecisionLog();
    this.gates = new Gates(
      this.rng,
      (pair, offer) => {
        // Both read the same arrival moment: par takes its pick and the log
        // records the state the player was actually deciding from.
        this.log.open_(pair, this.squad.progress, offer, this.enemies.wave.index, this.elapsed);
        this.difficulty.observeGateOffer(offer, this.enemies.wave.index);
      },
      (pair) => this.log.resolve(pair, -1),
    );
    this.grid = new Grid<Enemy>(48, VIEW.width);

    this.drawBackground();
    this.overlay = this.add.graphics().setDepth(6);
    // 25: above the squad (21), below the HUD backing strip (30).
    this.selection = this.add.graphics().setDepth(25);

    this.enemyPool = new SpritePool(this, 'dot', 10);
    this.cagePool = new SpritePool(this, 'cage', 11);
    this.bulletPool = new SpritePool(this, 'bullet', 12);
    this.enemyBulletPool = new SpritePool(this, 'dot', 13);
    this.bodyPool = new SpritePool(this, 'body', 20);
    this.headPool = new SpritePool(this, 'head', 21);

    this.bindInput();
    this.emitHud();

    // A shared link lands on the start screen, showing what it is about to
    // play rather than starting under the player's reading. The same screen
    // appears for a fresh run so the match code is seen at least once - a
    // player who never sees one will not think to pass it on.
    //
    // `?seed=` skips it. That is the instrument form, passed by every script in
    // scripts/, and those measure play rather than the menu. The shared form is
    // `?m=`, which does NOT skip. `npm run endscreen` photographs this screen
    // so it is not left unseen by every automated check.
    const params = new URLSearchParams(window.location.search);
    if (params.has('seed')) {
      this.applyStartOverride();
      this.waiting = false;
      return;
    }
    // Wait for the UI scene before announcing the match. Scenes start in the
    // order main.ts lists them, so GameScene.create runs BEFORE UIScene.create
    // and an event emitted here would land before anything was listening - the
    // screen would never appear and the run would never begin.
    this.game.events.once('uiready', () => {
      this.game.events.emit('showstart', {
        code: encodeMatch({ seed: this.seed, mode: this.mode }),
        version: VERSION,
        mode: this.mode,
        invited: matchFromQuery(window.location.search) !== null,
      });
    });
    this.game.events.once('startmatch', () => { this.waiting = false; });
    // Chosen on the start screen, before the run exists. Re-announcing the
    // match is what redraws the code, which must change with the mode: a hard
    // run is not the same match as a normal one on the same seed, and the code
    // is the thing people compare off a screenshot.
    this.game.events.on('modechange', (mode: MatchMode) => {
      if (this.mode === mode || !this.waiting) return;
      this.mode = mode;
      setMode(mode);
      this.game.events.emit('showstart', {
        code: encodeMatch({ seed: this.seed, mode: this.mode }),
        version: VERSION,
        mode: this.mode,
        invited: matchFromQuery(window.location.search) !== null,
      });
    });
  }

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(COLORS.bg, 1).fillRect(0, 0, VIEW.width, VIEW.height);
    g.fillStyle(COLORS.lane, 1).fillRect(0, ARENA.laneY - 120, VIEW.width, 260);
    g.lineStyle(2, COLORS.breach, 0.35);
    g.lineBetween(0, ARENA.breachY, VIEW.width, ARENA.breachY);
    // Backing strip so the HUD stays legible as enemies walk in from the top.
    const hud = this.add.graphics().setDepth(30);
    hud.fillStyle(COLORS.bg, 0.86).fillRect(0, 0, VIEW.width, RAIL_HEIGHT);
    hud.fillStyle(COLORS.bg, 0.3).fillRect(0, RAIL_HEIGHT, VIEW.width, 12);
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = {
        left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, false),
        right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, false),
      };
    }
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && !this.paused) this.targetX = p.worldX;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // The pause control is hit-tested HERE, not as an interactive object in
      // the UI scene: a tap reaching both scenes would pause the game and also
      // order the squad to the button's x, which it walks to on resume.
      if (!this.over && !this.waiting && inPauseButton(p.worldX, p.worldY)) {
        this.setPaused(!this.paused);
        return;
      }
      if (this.paused) return;
      if (this.over) this.restart();
      else this.targetX = p.worldX;
    });
    this.input.keyboard?.on('keydown-SPACE', () => { if (this.over) this.restart(); });
    const toggle = () => { if (!this.over && !this.waiting) this.setPaused(!this.paused); };
    this.input.keyboard?.on('keydown-ESC', toggle);
    this.input.keyboard?.on('keydown-P', toggle);
    // The pause screen holds no state of its own - it reads the last published
    // HUD frame - so resume and restart are requests back into the simulation.
    this.game.events.on('setpaused', (on: boolean) => this.setPaused(on));
    this.game.events.on('restartrequest', () => { this.paused = false; this.restart(); });
  }

  /** Freezes the simulation and tells the HUD to raise (or drop) the screen. */
  private setPaused(on: boolean): void {
    if (this.paused === on) return;
    this.paused = on;
    this.game.events.emit('paused', on);
  }

  private restart(): void {
    this.over = false;
    this.cause = null;
    this.kills = 0;
    this.streak = 0;
    this.targetX = VIEW.width / 2;
    this.squad = new Squad(VIEW.width / 2, ARENA.laneY, SQUAD.startPower, this.rng);
    this.bullets = new Bullets();
    this.enemyFire.reset();
    this.difficulty.reset();
    this.log.reset();
    this.elapsed = 0;
    this.accumulator = 0;
    this.breachLoss = 0;
    this.fireLoss = 0;
    this.drawCredit = 0;
    this.simCredit = 0;
    this.pendingShots = 0;
    this.pendingDamage = 0;
    this.traveled = 0;
    this.peakPower = 0;
    this.lastX = VIEW.width / 2;
    this.waiting = false;
    this.enemies.reset();
    this.gates.reset();
    this.applyStartOverride();
    this.game.events.emit('restart');
    this.emitHud();
  }

  /**
   * Drains real time into FIXED simulation steps, then renders once.
   *
   * Nothing below this line ever sees a real frame delta - `step` is always
   * handed `SIM.step`. That is what makes a seed reproduce a run exactly and
   * what decouples the amount of game per simulated second from how much the
   * scene is rendering. See the SIM block in config.ts for the measurements
   * that forced it.
   */
  override update(_time: number, delta: number): void {
    if (this.over || this.waiting || this.paused) {
      // Do not bank time spent on a pause or an end screen: it would all be
      // spent in one burst on resume.
      this.accumulator = 0;
      return;
    }

    this.accumulator += Math.min(delta / 1000, SIM.step * SIM.maxStepsPerFrame);
    let steps = 0;
    while (this.accumulator >= SIM.step && steps < SIM.maxStepsPerFrame) {
      this.step(SIM.step);
      this.accumulator -= SIM.step;
      steps++;
      // A breach can end the run mid-drain. Keep the leftover out of the next
      // run's first frame.
      if (this.over || this.waiting) { this.accumulator = 0; break; }
    }

    this.render();
    this.emitHud();
  }

  /**
   * One simulation tick. `dt` is always `SIM.step`; it is a parameter so the
   * systems below stay unit-testable against any step size.
   */
  private step(dt: number): void {
    this.elapsed += dt;

    this.steerAutopilot();
    this.handleKeys(dt);
    this.squad.update(dt, this.targetX);
    this.traveled += Math.abs(this.squad.x - this.lastX);
    this.lastX = this.squad.x;
    if (this.squad.power > this.peakPower) this.peakPower = this.squad.power;
    this.enemies.playerDps = this.squad.dps;
    this.enemies.targetX = this.squad.x;
    this.enemies.targetY = this.squad.y;
    this.fire(dt);
    this.bullets.update(dt);
    this.enemyFire.update(dt);
    const { newWave } = this.enemies.update(dt);
    this.gates.update(dt, this.enemies.wave.index, {
      power: this.squad.power,
      damageBonus: this.squad.upgrades.damageBonus,
      rateBonus: this.squad.upgrades.rateBonus,
    }, this.squad.upgrades);

    if (newWave) {
      this.squad.addPower(WAVE.clearBonus);
      this.difficulty.awardWaveClear();
      this.toast(`WAVE ${this.enemies.wave.index}`);
    }

    this.collide();
    this.checkGates();
    this.applyBreaches();
    this.applyIncomingFire();
  }

  /**
   * Instrument seam for `npm run from`. When `window.__startOverride` is
   * installed, the run begins from that squad state, at that wave, with par
   * set equal to it - see `Difficulty.seedPar`.
   *
   * This exists because the probe bot dies at wave 5 to 9 and has never once
   * reached the regime the late-game work is for: the delivery ceiling, the
   * old power ceiling, the HP pin. Until this, every claim about the late game
   * rested on `npm run model`'s arithmetic and `npm run hud`'s forced stills.
   * Nothing installs it in a shipped game, and it is deliberately not a URL
   * parameter: a run started from an injected state is not a shareable match.
   */
  private applyStartOverride(): void {
    const o = (window as unknown as { __startOverride?: StartOverride }).__startOverride;
    if (!o) return;
    this.squad.progress.power = Math.max(1, o.power);
    Object.assign(this.squad.progress.upgrades, o.upgrades);
    this.squad.rebuild();
    this.difficulty.seedPar(this.squad.progress);
    this.enemies.startAt(o.wave);
    this.peakPower = this.squad.power;
  }

  /**
   * Instrument seam. When `window.__autopilot` is installed, it is asked for a
   * target x ONCE PER SIMULATION STEP and drives the same `targetX` a pointer
   * does.
   *
   * This exists because a fixed timestep alone does not make a probe run
   * reproducible. The bot used to steer by issuing real mouse moves on a
   * wall-clock poll, so its input landed at a different SIMULATED moment on
   * every repeat - and three repeats of one seed diverged to 4 and 6 decisions,
   * different waves, and a 30% spread in survival. The simulation was
   * deterministic; the thing measuring it was not. Steering here makes the bot
   * a pure function of simulated state, which is what lets `npm run repeat`
   * assert a zero spread.
   *
   * It is a seam for instruments only - nothing installs it in a shipped game,
   * and it writes the same field a finger does, so the bot is not given an
   * input path a player lacks.
   */
  private steerAutopilot(): void {
    const fn = (window as unknown as { __autopilot?: AutopilotFn }).__autopilot;
    if (!fn) return;
    const x = fn({
      elapsed: this.elapsed,
      squadX: this.squad.x,
      wave: this.enemies.wave.index,
      gates: this.scoreLiveGates(),
    });
    if (typeof x === 'number' && Number.isFinite(x)) {
      this.targetX = Math.max(ARENA.minX, Math.min(ARENA.maxX, x));
    }
  }

  private handleKeys(dt: number): void {
    if (!this.cursors) return;
    // The keys drive the TARGET; Squad.update is what rate-limits the squad.
    // Moving the target faster than the squad only builds slack, so this reads
    // the same speed the squad actually travels at.
    const speed = moveSpeed(this.squad.upgrades);
    if (this.cursors.left.isDown) this.targetX -= speed * dt;
    if (this.cursors.right.isDown) this.targetX += speed * dt;
    this.targetX = Math.max(ARENA.minX, Math.min(ARENA.maxX, this.targetX));
  }

  private fire(dt: number): void {
    const { guns, pierce } = this.squad.upgrades;
    const want = this.squad.shotsPerSecond();

    // Two collapses of the stream, and they are different things.
    //
    // The SIMULATION's: past `WEAPON.maxSimShotsPerSecond`, one spawned bullet
    // stands for `bundle` real shots and carries their damage. This changes
    // what is spawned and what is hit; `Bullets.strike` keeps the accounting
    // exact. Below the cap `bundle` is 1 and every shot is its own bullet.
    const bundle = bundleFactor(this.squad.progress);
    const simShare = 1 / bundle;
    // The RENDERER's: of the bullets actually spawned, a bounded subset is
    // drawn. Rendering only - nothing here reaches spawn counts or collision.
    // Read off the SPAWN rate, which is what the pool honours, never the
    // intended rate: reading the intended rate once put a density of x212 on
    // the late state and left four bullets on screen.
    const spawnRate = Math.min(want, WEAPON.maxSimShotsPerSecond);
    const drawnShare = spawnRate > 0
      ? Math.min(1, RENDER.maxVisibleShotsPerSecond / spawnRate)
      : 1;
    // Real shots per DRAWN bullet: both collapses multiplied. The tint reads
    // this; encoding the render stride alone would read wrong past the sim
    // ceiling, where every drawn bullet is already several shots.
    const density = bundle / drawnShare;

    for (const u of this.squad.units) {
      u.cooldown -= dt;
      if (u.cooldown > 0) continue;
      // Every shot the unit is owed this step, not one. Past sixty shots a
      // second per unit the interval is shorter than a step, and firing once
      // per step silently capped the whole ring at 60 x units x guns - a third
      // ceiling, hidden behind the pool's, that made the late build fire a
      // quarter of what it was owed even with the pool no longer refusing.
      const interval = this.squad.shotInterval(u.share);
      const n = 1 + Math.floor(-u.cooldown / interval);
      u.cooldown += n * interval;
      const damage = this.squad.damagePerShot(u.share);
      for (let g = 0; g < guns; g++) {
        // Bresenham stride over the shot sequence, for the simulation. An even
        // one-in-K sample, so the bundled bullets stay spread across every
        // unit and every gun and the volley still reads as a column. NOT drawn
        // from the seeded RNG: a deterministic stride is what keeps a seed a
        // seed. A skipped shot is not lost - it is banked and rides in the
        // next bullet honoured, so every shot the build fires is carried by
        // exactly one bullet.
        this.simCredit += n * simShare;
        this.pendingShots += n;
        this.pendingDamage += n * damage;
        const honoured = Math.floor(this.simCredit);
        if (honoured < 1) continue;
        this.simCredit -= honoured;
        // Shots from different units carry different damage; the bundle holds
        // their mean so the total is conserved exactly. Whole shots per bullet,
        // dealt out as `unitShares` deals power.
        const total = this.pendingShots;
        const perShot = this.pendingDamage / total;
        this.pendingShots = 0;
        this.pendingDamage = 0;
        const base = Math.floor(total / honoured);
        const extra = total % honoured;

        // Parallel, not fanned. Extra guns widen the column rather than the
        // angle, so damage stays focused at any range and a full volley lands
        // on a single body - which is what makes the Titan's HP budget honest.
        const lateral = guns === 1
          ? 0
          : (g / (guns - 1) - 0.5) * WEAPON.volleyWidth;
        for (let k = 0; k < honoured; k++) {
          // The render stride, over SPAWNED bullets. Same shape, separate
          // state, and it may never feed anything above this line.
          this.drawCredit += drawnShare;
          const drawn = this.drawCredit >= 1;
          if (drawn) this.drawCredit -= 1;
          this.bullets.spawn(
            u.x + lateral, u.y - 10,
            0, -WEAPON.bulletSpeed,
            perShot, pierce, base + (k < extra ? 1 : 0),
            drawn, density,
          );
        }
      }
    }
  }

  private collide(): void {
    this.grid.clear();
    for (const e of this.enemies.items) if (e.active) this.grid.insert(e);

    for (const b of this.bullets.items) {
      if (!b.active) continue;
      this.grid.forEachNear(b.x, b.y, (e) => {
        if (!b.active || !e.active) return;
        const dx = e.x - b.x, dy = e.y - b.y;
        const r = e.radius + WEAPON.bulletRadius;
        if (dx * dx + dy * dy > r * r) return;
        const len = Math.hypot(b.vx, b.vy) || 1;
        const ux = b.vx / len, uy = b.vy / len;
        // The body consumes as many of the bullet's shots as it takes to kill
        // it, each spending a pierce; the rest fly on. A one-shot bullet is the
        // old rule exactly: one hit, then pierce down or gone.
        const perShot = b.damage * (1 - armorAgainst(e, ux, uy));
        const consumed = strike(b, e.hp, perShot, true);
        if (this.enemies.damage(e, consumed * b.damage, ux, uy)) this.onKill();
      });

      if (!b.active) continue;
      for (const c of this.enemies.cages) {
        if (!c.active) continue;
        const dx = c.x - b.x, dy = c.y - b.y;
        const r = CAGE.radius + WEAPON.bulletRadius;
        if (dx * dx + dy * dy > r * r) continue;
        // A cage stops every shot that hits it, pierce or not; shots past the
        // one that opens it carry on.
        const consumed = strike(b, c.hp, b.damage, false);
        c.hp -= consumed * b.damage;
        if (c.hp <= 0) {
          c.active = false;
          this.squad.addPower(CAGE.reward);
          this.difficulty.awardCage();
          this.toast(`RESCUED +${CAGE.reward}`);
        }
        if (!b.active) break;
      }
    }
  }

  private onKill(): void {
    this.kills++;
    this.streak++;
    if (this.streak >= STREAK.killsPerBonus) {
      this.streak = 0;
      this.squad.addPower(STREAK.bonus);
      this.toast(`STREAK +${STREAK.bonus}`);
    }
  }

  private checkGates(): void {
    for (const g of this.gates.items) {
      if (!g.active) continue;
      const withinY = Math.abs(g.y - this.squad.y) < GATES.height / 2 + 14;
      if (!withinY) continue;
      if (Math.abs(g.x - this.squad.x) > g.width / 2) continue;
      // Order matters. consumePair credits par and opens the log entry for an
      // offer taken before it reached the lane line; resolving first would find
      // nothing and leave that decision permanently open. Both must also run
      // before applyGate, so the options are priced from the state the player
      // was actually deciding in.
      this.gates.consumePair(g.pair);
      const rank = this.log.resolve(g.pair, g.index);
      if (rank !== null) this.flashPick(g.x, g.y, rank);
      this.toast(this.squad.applyGate(g.type));
    }
  }

  private applyBreaches(): void {
    const { cost, titan } = this.enemies.collectBreaches();
    if (cost <= 0) return;
    this.squad.addPower(-cost * SQUAD.breachLoss);
    this.breachLoss += cost * SQUAD.breachLoss;
    // A Titan reaching the line ends the run outright, whatever power is left.
    // Its HP is budgeted so that killing it is achievable at 90% of par over
    // three quarters of its descent; letting it land and merely taking damage
    // would make that budget meaningless.
    this.cameras.main.shake(titan ? 260 : 120, titan ? 0.014 : 0.006);
    if (titan || !this.squad.alive) {
      this.over = true;
      this.emitGameOver(titan ? 'titan' : 'overrun');
    }
  }

  /**
   * Squad power destroyed by enemy fire. Separate from `applyBreaches` on
   * purpose: a breach is a failure to kill, while fire is a tax on standing
   * still, and the two need to read differently.
   */
  private applyIncomingFire(): void {
    const cost = this.enemyFire.collide(this.squad.units, SQUAD.unitRadius);
    if (cost <= 0) return;
    this.squad.addPower(-cost * SQUAD.fireLoss);
    this.fireLoss += cost * SQUAD.fireLoss;
    this.cameras.main.shake(70, 0.003);
    if (!this.squad.alive) {
      this.over = true;
      this.emitGameOver();
    }
  }

  /**
   * Green / amber / red on the gate you just took, graded by the same scoring
   * the death screen will use - so instant feedback and the post-mortem can
   * never disagree about the same pick.
   *
   * The death screen teaches after the fact; this teaches during, which is what
   * actually makes players improve. Graded on the SPREAD of the offer, so
   * taking the second of three near-identical bonuses does not read as a
   * blunder.
   */
  private flashPick(x: number, y: number, rank: number): void {
    const color = rank <= 0.001 ? 0x3ecf7a : rank >= 0.999 ? 0xff4757 : 0xffc93c;
    const halo = this.add.circle(x, y, 34, color, 0.5).setDepth(26);
    this.tweens.add({
      targets: halo,
      scale: 2.6, alpha: 0,
      duration: 420, ease: 'Quad.easeOut',
      onComplete: () => halo.destroy(),
    });
  }

  /**
   * The end screen's whole payload, including the match code, because that
   * screen is a shareable artefact rather than a summary - see hud/EndScreen.
   */
  private emitGameOver(cause: 'overrun' | 'titan' = 'overrun'): void {
    this.cause = cause;
    const match = { seed: this.seed, mode: this.mode };
    this.game.events.emit('gameover', {
      cause,
      wave: this.enemies.wave.index,
      kills: this.kills,
      optimal: this.log.fractionOfOptimal,
      tally: this.log.tally,
      breachLoss: Math.round(this.breachLoss),
      fireLoss: Math.round(this.fireLoss),
      traveled: Math.round(this.traveled),
      decisions: this.log.count,
      code: encodeMatch(match),
      version: VERSION,
      mode: this.mode,
      link: matchUrl(match, window.location.href),
    });
  }

  private toast(text: string): void {
    this.game.events.emit('toast', text);
  }

  /**
   * Live gates with what each is actually worth right now, priced by the same
   * function par and the death screen use.
   *
   * Published so the probe bot can choose the way the game asks a player to.
   * The old bot ranked gates by AXIS, which cannot express the decision at all
   * - the interesting choice is between two magnitudes of the SAME axis - so
   * every balance number it produced was soft.
   */
  private scoreLiveGates(): ScoredGate[] {
    const live = this.gates.items.filter((g) => g.active);
    const byPair = new Map<number, typeof live>();
    for (const g of live) {
      const group = byPair.get(g.pair);
      if (group) group.push(g); else byPair.set(g.pair, [g]);
    }
    const out: ScoredGate[] = [];
    for (const group of byPair.values()) {
      const scored = scoreOffer(
        this.squad.progress, group.map((g) => g.type), this.enemies.wave.index,
      );
      for (let i = 0; i < group.length; i++) {
        const g = group[i];
        out.push({
          x: Math.round(g.x), y: Math.round(g.y),
          label: g.type.label, axis: g.type.axis, form: g.type.form,
          pair: g.pair,
          delta: Number(scored.options[i].delta.toFixed(5)),
          best: i === scored.best,
        });
      }
    }
    return out;
  }

  private emitHud(): void {
    const par = this.difficulty.snapshot();
    const gates = this.scoreLiveGates();
    this.registry.set('stats', {
      power: Math.floor(this.squad.power),
      parPower: par.parPower,
      standing: Number(this.difficulty.standing(this.squad.dps).toFixed(3)),
      parDps: par.parDps,
      dps: Math.round(this.squad.dps),
      hpMult: Number(this.enemies.hpMult.toFixed(2)),
      // The difficulty knobs in force, so no instrument has to hardcode them.
      clampThreshold: par.clampThreshold,
      targetFraction: par.targetFraction,
      pressure: par.pressure,
      rate: Number(this.enemies.spawnRate.toFixed(2)),
      wave: this.enemies.wave.index,
      tier: this.squad.topTier,
      tierName: tierRow(this.squad.topTier).name,
      units: this.squad.units.length,
      kills: this.kills,
      over: this.over,
      cause: this.cause,
      seed: this.seed,
      gates,
      breachLoss: Math.round(this.breachLoss),
      fireLoss: Math.round(this.fireLoss),
      traveled: Math.round(this.traveled),
      peakPower: Math.floor(this.peakPower),
      // SIMULATED seconds, which is what a run should be measured in. The
      // simulation advances on clamped frame deltas, so wall-clock time and
      // game time are not the same quantity and their ratio moves with how much
      // rendering the scene happens to be doing.
      elapsed: Number(this.elapsed.toFixed(2)),
      decisions: this.log.count,
      optimal: Number(this.log.fractionOfOptimal.toFixed(4)),
      tally: this.log.tally,
    });
    const u = this.squad.upgrades;
    const hud: HudPayload = {
      power: Math.floor(this.squad.power),
      wave: this.enemies.wave.index,
      tier: this.squad.topTier,
      tierName: tierRow(this.squad.topTier).name,
      tierColor: tierRow(this.squad.topTier).shirt,
      kills: this.kills,
      capped: this.squad.power > SQUAD.ringCap,
      units: this.squad.units.length,
      dps: this.squad.dps,
      parDps: par.parDps,
      damageBonus: u.damageBonus,
      damageMult: u.damageMult,
      rateBonus: u.rateBonus,
      rateMult: u.rateMult,
      guns: u.guns,
      pierce: u.pierce,
      pierceMult: pierceMultiplier(u.pierce),
    };
    this.game.events.emit('hud', hud);
  }

  // --- rendering ------------------------------------------------------------

  private render(): void {
    this.renderEnemies();
    this.renderBullets();
    this.renderEnemyFire();
    this.renderSquad();
    this.renderGates();
    this.renderOverlay();
    // Last, and on the topmost gameplay layer: the guide has to survive a
    // screen full of bullets.
    this.renderSelection();
  }

  private renderEnemies(): void {
    this.enemyPool.begin();
    this.cagePool.begin();
    for (const e of this.enemies.items) {
      if (!e.active) continue;
      const s = this.enemyPool.claim();
      s.setPosition(e.x, e.y)
        .setDisplaySize(e.radius * 2, e.radius * 2)
        .setTint(e.type.color)
        .setAlpha(0.55 + 0.45 * (e.hp / e.maxHp));
    }
    for (const c of this.enemies.cages) {
      if (!c.active) continue;
      this.cagePool.claim()
        .setPosition(c.x, c.y)
        .setDisplaySize(CAGE.radius * 2, CAGE.radius * 2)
        .setTint(COLORS.cage);
    }
    this.enemyPool.end();
    this.cagePool.end();
  }

  /**
   * Draws the bounded subset `fire` marked, tinted by how much of the stream
   * each one stands for.
   *
   * The simulation is untouched here: every bullet in `items` is still flying
   * and still colliding, drawn or not. Skipping the undrawn ones is the whole
   * mechanism - at high GUNS and RATE the true stream is thousands of shots a
   * second and the playfield went solid cream.
   */
  private renderBullets(): void {
    this.bulletPool.begin();
    for (const b of this.bullets.items) {
      if (!b.active || !b.drawn) continue;
      this.bulletPool.claim().setPosition(b.x, b.y).setTint(bulletTint(b.density));
    }
    this.bulletPool.end();
  }

  private renderEnemyFire(): void {
    this.enemyBulletPool.begin();
    for (const b of this.enemyFire.items) {
      if (!b.active) continue;
      this.enemyBulletPool.claim()
        .setPosition(b.x, b.y)
        .setDisplaySize(ENEMY_FIRE.radius * 2, ENEMY_FIRE.radius * 2)
        .setTint(COLORS.enemyBullet);
    }
    this.enemyBulletPool.end();
  }

  private renderSquad(): void {
    this.bodyPool.begin();
    this.headPool.begin();
    for (const u of this.squad.units) {
      const tier = tierRow(u.tier);
      // Slot 0 is the centre of the formation and the unit that actually
      // selects a gate. Drawing it larger is the only cue that says so.
      const lead = u.slot === 0;
      const scale = lead ? SQUAD.leaderScale : 1;
      this.bodyPool.claim()
        .setPosition(u.x, u.y + (lead ? 3 : 2))
        .setScale(scale)
        .setTint(tier.shirt);
      this.headPool.claim()
        .setPosition(u.x, u.y - 10 * scale)
        .setScale(scale)
        .setTint(SKIN);
    }
    this.bodyPool.end();
    this.headPool.end();
  }

  /**
   * Which gate the squad is about to take, drawn as a line from the leader up
   * to the offer.
   *
   * The selection rule - the CENTRE of the formation is what passes through a
   * gate - is invisible otherwise. A player watching a nineteen-unit ring drift
   * across three lanes has no way to know which one counts, and finds out only
   * after committing. The leader is also drawn larger; this says the same thing
   * a second way, at the moment it matters.
   */
  private renderSelection(): void {
    this.selection.clear();
    let target: { x: number; y: number; color: number } | null = null;
    for (const g of this.gates.items) {
      if (!g.active || g.y > this.squad.y) continue;
      if (Math.abs(g.x - this.squad.x) > g.width / 2) continue;
      if (target === null || g.y > target.y) {
        target = { x: g.x, y: g.y, color: g.type.color };
      }
    }
    if (target === null) return;

    // Fades in as the offer closes, so it guides without nagging.
    const nearness = Phaser.Math.Clamp(
      1 - (this.squad.y - target.y) / 520, 0.12, 0.55,
    );
    this.selection.lineStyle(3, target.color, nearness);
    this.selection.lineBetween(
      this.squad.x, this.squad.y - 18,
      // Never draw up into the rail, for the same reason gates fade in below it.
      this.squad.x, Math.max(target.y + GATES.height / 2, RAIL_HEIGHT + 6),
    );
    this.selection.lineStyle(3, target.color, nearness + 0.25);
    this.selection.strokeCircle(this.squad.x, this.squad.y - 2, 16);
  }

  private renderGates(): void {
    let used = 0;
    for (const g of this.gates.items) {
      if (!g.active) continue;
      let v = this.gateVisuals[used];
      if (!v) {
        v = {
          rect: this.add.rectangle(0, 0, 10, GATES.height, 0xffffff, 0.22).setDepth(4),
          label: this.add.text(0, 0, '', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: `${GATES.labelSize}px`,
            color: COLORS.text,
            fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(5),
        };
        this.gateVisuals.push(v);
      }
      // Fade in clear of the top rail. Gates spawn above the screen and would
      // otherwise slide through the HUD numbers, putting two unrelated sets of
      // figures on top of each other exactly where the player reads par.
      const reveal = Phaser.Math.Clamp((g.y - RAIL_HEIGHT - 6) / 44, 0, 1);
      v.rect.setVisible(reveal > 0).setPosition(g.x, g.y)
        // Inset for the visual separation the hit test no longer has.
        .setSize(g.width - GATES.gap, GATES.height)
        .setFillStyle(g.type.color, 0.22 * reveal)
        .setStrokeStyle(3, g.type.color, 0.9 * reveal);
      v.label.setVisible(reveal > 0).setPosition(g.x, g.y).setAlpha(reveal);
      if (v.label.text !== g.type.label) v.label.setText(g.type.label);
      used++;
    }
    for (let i = used; i < this.gateVisuals.length; i++) {
      this.gateVisuals[i].rect.setVisible(false);
      this.gateVisuals[i].label.setVisible(false);
    }
  }

  private renderOverlay(): void {
    this.overlay.clear();
    // Shield facing. A directional shield the player cannot see is just an
    // unexplained damage number, so draw where it actually points.
    for (const e of this.enemies.items) {
      if (!e.active || !e.type.frontArmor) continue;
      const nx = -e.fy, ny = e.fx;
      const r = e.radius + 3;
      this.overlay.lineStyle(3, COLORS.shield, 0.85);
      this.overlay.lineBetween(
        e.x + e.fx * r - nx * e.radius, e.y + e.fy * r - ny * e.radius,
        e.x + e.fx * r + nx * e.radius, e.y + e.fy * r + ny * e.radius,
      );
    }
    // Health bars for anything big enough to be worth aiming at.
    for (const e of this.enemies.items) {
      if (!e.active || e.radius < 14 || e.hp >= e.maxHp) continue;
      const w = e.radius * 2;
      this.overlay.fillStyle(0x000000, 0.5);
      this.overlay.fillRect(e.x - w / 2, e.y - e.radius - 9, w, 4);
      this.overlay.fillStyle(0xff5566, 0.95);
      this.overlay.fillRect(e.x - w / 2, e.y - e.radius - 9, w * (e.hp / e.maxHp), 4);
    }
    for (const c of this.enemies.cages) {
      if (!c.active) continue;
      this.overlay.fillStyle(0x000000, 0.5);
      this.overlay.fillRect(c.x - CAGE.radius, c.y - CAGE.radius - 9, CAGE.radius * 2, 4);
      this.overlay.fillStyle(COLORS.cage, 0.95);
      this.overlay.fillRect(
        c.x - CAGE.radius, c.y - CAGE.radius - 9,
        CAGE.radius * 2 * (c.hp / c.maxHp), 4,
      );
    }
  }
}

/** Shared with the UI scene, which draws the control this rectangle describes. */
function inPauseButton(x: number, y: number): boolean {
  return Math.abs(x - PAUSE_BUTTON.x) <= PAUSE_BUTTON.width / 2
    && Math.abs(y - PAUSE_BUTTON.y) <= PAUSE_BUTTON.height / 2;
}
