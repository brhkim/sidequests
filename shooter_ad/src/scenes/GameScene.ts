import Phaser from 'phaser';
import {
  ARENA, CAGE, ENEMY_FIRE, GATES, RENDER, SIM, SQUAD, VIEW, WAVE, WEAPON,
} from '../config';
import { tierRow } from '../data/tiers';
import { Squad } from '../systems/Squad';
import { Bullets } from '../systems/Bullets';
import { EnemyBullets } from '../systems/EnemyBullets';
import { Enemies, type Consumed, type Enemy } from '../systems/Enemies';
import { contactCost } from '../systems/Contact';
import { EventQueue } from '../systems/SimEvents';
import { FORMATION_HALF_WIDTH } from '../systems/Formation';
import { Gates } from '../systems/Gates';
import { Difficulty } from '../systems/Difficulty';
import { DecisionLog } from '../systems/DecisionLog';
import { scoreOffer } from '../systems/Scoring';
import { Grid } from '../systems/Grid';
import { createRng } from '../systems/Rng';
import { encodeMatch, matchFromQuery, matchUrl, type MatchMode } from '../systems/MatchCode';
import { modeFromQuery, setMode } from '../systems/Mode';
import { VERSION } from '../version';
import {
  bundleFactor, cageReward, moveSpeed, pierceMultiplier, senseChance, type Upgrades,
} from '../systems/Progression';
import { Shield } from '../systems/Shield';
import { mulberry32 } from '../systems/Rng';
import { armorAgainst } from '../systems/EnemyMotion';
import { strike } from '../systems/Bullets';
import { PAUSE_BUTTON } from './hud/PauseScreen';
import { REPLAY_BUTTON } from './hud/EndScreen';
import { SpriteRender } from './render/SpriteRender';
import { FieldRender } from './render/FieldRender';
import type { HudPayload } from './hud/types';

/** One live gate, priced by the game's own `scoreOffer`. */
interface ScoredGate {
  x: number; y: number;
  label: string; axis: string; form: string;
  pair: number;
  index: number;
  delta: number;
  best: boolean;
  /** This gate is the best of a SENSED offer, and is drawn marked. */
  sensed: boolean;
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
  /** The live Titan, so an instrument can park the squad under it. */
  titan: { x: number; y: number; progress: number; hpFrac: number } | null;
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

  /** The two rendering layers. See `render/`. */
  private sprites!: SpriteRender;
  private field!: FieldRender;
  private cursors?: { left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  /**
   * The seeded stream, behind one level of indirection: every system holds
   * `rng`, and `rngImpl` is what a match code or a restart swaps out. So a
   * restart replays the SAME match (the code on the end screen was a lie
   * before - the stream simply carried on under the old seed's name), and a
   * code typed on the start screen re-seeds every consumer at once.
   */
  private rngImpl: () => number = Math.random;
  private readonly rng: () => number = () => this.rngImpl();
  private targetX = VIEW.width / 2;
  private kills = 0;
  /**
   * Why runs end, and what they cost to steer. Published so the probe can
   * separate "the player chose badly" from "the player could not be in two
   * places at once" - the survival curve falls as PROBE_SKILL rises and these
   * are what decide whether that is the bot's positioning or the game's clamp.
   */
  private contactLoss = 0;
  private breachLoss = 0;
  private fireLoss = 0;
  /** Enemy bullets the SHIELD absorbed this run. */
  private blocked = 0;
  /**
   * What the simulation did this step, for the renderer. Pushed only inside
   * `step`, drained at the top of `render`; nothing in `systems/` reads it.
   */
  private readonly sim = new EventQueue();
  /** Highest offer pair announced as sensed, so the event fires once per offer. */
  private lastSensedPair = -1;
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
  /** Cages opened this run and the army they gave; `npm run balance` prints both. */
  private rescues = 0;
  private rescuedPower = 0;
  /** Highest damage output the run reached; the end screen's second score. */
  private peakDps = 0;
  /**
   * Shots charged against enemy bodies this run. Divided by the shots fired
   * (`Bullets.shotsSpawned`) it is the measured hits per shot - what pierce is
   * really worth on this board, next to the `pierceMultiplier` it is priced
   * at. Read by the probes; nothing in the simulation reads it.
   */
  private shotHits = 0;
  /** Shots that met at least one body. `shotHits / shotLandings` is the
   * measured pierce; `shotLandings / shotsSpawned` is how much of the stream
   * lands at all. */
  private shotLandings = 0;
  /**
   * One entry per Titan this run met: the player's single-target standing at
   * the moment it spawned, the fraction of its descent it had covered when it
   * died - `null` while it is alive, and forever if it landed, which is
   * `cause === 'titan'` - and where on that descent it was consumed if it did
   * land, on the ring or at the line. The boss budget is written in exactly
   * these numbers, so this is what `npm run titan` reads.
   */
  private titanChecks: { standing: number; killedAt: number | null; landedAt: number | null }[] = [];
  private lastX = VIEW.width / 2;
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
    this.rngImpl = rng;
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
      (pair, offer, sensed) => {
        // Both read the same arrival moment: par takes its pick and the log
        // records the state the player was actually deciding from.
        this.log.open_(
          pair, this.squad.progress, offer, this.enemies.wave.index, this.elapsed, sensed,
        );
        this.difficulty.observeGateOffer(offer, this.enemies.wave.index);
      },
      (pair) => {
        this.log.resolve(pair, -1);
        // MISS lands on the option the squad was nearest, so the word sits in
        // the lane the player was standing in - beside the dead space they
        // stopped in, not in the middle of the screen. The offer's slots are
        // still intact here: expiry is reported in the same update that
        // dropped them, before any spawn can reuse one.
        let x = VIEW.width / 2;
        let best = Infinity;
        for (const g of this.gates.items) {
          if (g.pair !== pair) continue;
          const d = Math.abs(g.x - this.squad.x);
          if (d < best) { best = d; x = g.x; }
        }
        this.sim.push({ kind: 'miss', x, y: ARENA.laneY, pair });
      },
    );
    this.grid = new Grid<Enemy>(48, VIEW.width);

    this.field = new FieldRender(this);
    this.sprites = new SpriteRender(this);

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
    const instrument = params.has('seed');
    if (instrument) {
      this.applyStartOverride();
      this.waiting = false;
    } else {
      // Wait for the UI scene before announcing the match. Scenes start in the
      // order main.ts lists them, so GameScene.create runs BEFORE UIScene.create
      // and an event emitted here would land before anything was listening -
      // the screen would never appear and the run would never begin.
      this.game.events.once('uiready', () => this.announceMatch());
    }
    // The match controls are wired on EVERY page, instrument pages included.
    // They used to be skipped behind the `?seed=` return above, so the end
    // screen's "new match" did nothing on any page a script had opened - and
    // a control no check can press is a control nothing has ever tested.
    this.game.events.on('startmatch', () => { this.waiting = false; });
    // Chosen on the start screen, before the run exists. Re-announcing the
    // match is what redraws the code, which must change with the mode: a hard
    // run is not the same match as a normal one on the same seed, and the code
    // is the thing people compare off a screenshot.
    this.game.events.on('modechange', (mode: MatchMode) => {
      if (this.mode === mode || !this.waiting) return;
      this.mode = mode;
      setMode(mode);
      this.announceMatch();
    });
    // A code typed on the start screen, or a request for a fresh random match.
    // Both re-seed every consumer through `rngImpl` and rebuild the squad, so
    // the run that follows is the one the code names - nothing has been drawn
    // from the old stream that the new run could inherit.
    this.game.events.on('matchrequest', (match: { seed: number; mode: MatchMode } | null) => {
      if (!this.waiting) return;
      const next = match ?? { seed: Math.floor(Math.random() * 0xffffffff), mode: this.mode };
      this.seed = next.seed;
      this.mode = next.mode;
      setMode(this.mode);
      this.reseed();
      this.announceMatch();
    });
    // From the end screen: back to the start screen with a fresh code, rather
    // than replaying the match that just ended. Not gated on `over`: the same
    // tap also reaches this scene's own pointer handler, and whichever runs
    // first must not decide the outcome - a replay followed by this is still
    // a fresh match on the start screen.
    this.game.events.on('newmatchrequest', () => {
      this.seed = Math.floor(Math.random() * 0xffffffff);
      this.restart();
      this.waiting = true;
      this.announceMatch();
    });
  }

  /** The start screen's payload: what the button will play right now. */
  private announceMatch(): void {
    // One HUD frame of the start state, so the start screen's HOW TO PLAY
    // (the pause screen's pages, before a run exists) has real numbers to
    // teach against. Nothing simulates while waiting, so nothing else would
    // publish one.
    this.emitHud();
    this.game.events.emit('showstart', {
      code: encodeMatch({ seed: this.seed, mode: this.mode }),
      version: VERSION,
      mode: this.mode,
      invited: matchFromQuery(window.location.search) !== null,
    });
  }

  /**
   * Restarts the seeded stream from `seed` and rebuilds the squad on it. The
   * squad is rebuilt because its constructor draws the first unit's firing
   * jitter, and that draw has to be the new stream's first, not the old one's
   * second.
   */
  private reseed(): void {
    this.rngImpl = mulberry32(this.seed);
    this.squad = new Squad(VIEW.width / 2, ARENA.laneY, SQUAD.startPower, this.rng);
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
      if (!this.over && !this.waiting && inButton(PAUSE_BUTTON, p.worldX, p.worldY)) {
        this.setPaused(!this.paused);
        return;
      }
      if (this.paused) return;
      if (this.over) { if (inButton(REPLAY_BUTTON, p.worldX, p.worldY)) this.restart(); }
      else this.targetX = p.worldX;
    });
    this.input.keyboard?.on('keydown-SPACE', () => { if (this.over) this.restart(); });
    const toggle = () => { if (!this.over && !this.waiting) this.setPaused(!this.paused); };
    this.input.keyboard?.on('keydown-ESC', toggle);
    this.input.keyboard?.on('keydown-P', toggle);
    // M mutes; the pause screen's SOUND line is the same request by touch.
    this.input.keyboard?.on('keydown-M', () => this.game.events.emit('mutetoggle'));
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
    this.titanChecks = [];
    this.targetX = VIEW.width / 2;
    // The same match again, from its first draw. "Tap to play again" used to
    // continue the stream under the same code, so the run it produced was one
    // nobody could reproduce from the code on screen.
    this.reseed();
    this.bullets = new Bullets();
    this.enemyFire.reset();
    this.difficulty.reset();
    this.log.reset();
    this.elapsed = 0;
    this.accumulator = 0;
    this.contactLoss = 0;
    this.breachLoss = 0;
    this.fireLoss = 0;
    this.blocked = 0;
    this.sim.drain();
    this.sprites.reset();
    this.field.reset();
    this.lastSensedPair = -1;
    this.drawCredit = 0;
    this.simCredit = 0;
    this.pendingShots = 0;
    this.pendingDamage = 0;
    this.traveled = 0;
    this.peakPower = 0;
    this.rescues = 0;
    this.rescuedPower = 0;
    this.peakDps = 0;
    this.shotHits = 0;
    this.shotLandings = 0;
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
    if (this.squad.dps > this.peakDps) this.peakDps = this.squad.dps;
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
      guns: this.squad.upgrades.guns,
      pierce: this.squad.upgrades.pierce,
      sense: this.squad.upgrades.sense,
      shield: this.squad.upgrades.shield,
    }, this.squad.upgrades);

    if (newWave) {
      // No army for surviving a wave, and none for kill streaks: every unit
      // the player holds was chosen at a gate or shot out of a cage. The
      // author's call - automatic power made the sum at the next offer
      // unreadable. Par is not credited either (see Difficulty).
      const boss = this.enemies.wave.index % WAVE.bossEvery === 0;
      this.sim.push({ kind: 'wave', index: this.enemies.wave.index, titan: boss });
      if (boss) {
        this.titanChecks.push({
          standing: Number(this.difficulty.singleTargetStanding(this.squad.progress).toFixed(3)),
          killedAt: null,
          landedAt: null,
        });
        if (this.enemies.titan) this.sim.push({ kind: 'titan', phase: 'arrive' });
      }
    }
    if (this.enemies.titan?.volleyed) this.sim.push({ kind: 'titan', phase: 'volley' });
    this.announceSensed();

    // Bullets first, so a body a shot kills this step is a kill and never a
    // contact; contacts before breaches, so a body satisfying both (a Grunt
    // at the line is 17px from the bottom rank, inside the 19px it takes to
    // touch) is a contact.
    this.collide();
    this.applyContacts();
    this.checkGates();
    this.applyBreaches();
    this.applyIncomingFire();
  }

  /** One `sense` event per sensed offer, on the step it first appears. */
  private announceSensed(): void {
    for (const g of this.gates.items) {
      if (!g.active || !g.sensed || g.pair <= this.lastSensedPair) continue;
      this.lastSensedPair = g.pair;
      this.sim.push({ kind: 'sense', pair: g.pair });
      return;
    }
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
    this.peakDps = this.squad.dps;
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
    const t = this.enemies.titan;
    const x = fn({
      elapsed: this.elapsed,
      squadX: this.squad.x,
      wave: this.enemies.wave.index,
      gates: this.scoreLiveGates(),
      titan: t
        ? { x: t.x, y: t.y, progress: Enemies.titanProgress(t), hpFrac: t.hp / t.maxHp }
        : null,
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

        // Every shot spawns inside the FIRING COLUMN, `WEAPON.columnWidth`,
        // centred on the squad: the unit's offset from the centre is scaled
        // down from the formation's footprint, and extra guns spread a further
        // `gunSpread` around that, parallel rather than fanned. A fan scatters
        // damage at range; a column the Titan's own width is what lets every
        // shot from a squad parked under the boss land on it, which is the
        // assumption its HP budget is built on. Firing from each unit's own x
        // made the column ~170px against a 72px boss, and half the volley
        // missed a perfectly placed target.
        //
        // Centred on the LEADER'S DRAWN x, not the squad's logical centre.
        // Units ease toward their slots, so under a moving finger the ring
        // trails the centre by ~18px and a column built on the centre left
        // the character's body - visibly off-centre. Stationary, the two are
        // one point, so a squad parked under the boss is unchanged.
        const centre = this.squad.units[0].x;
        const unitSpan = (WEAPON.columnWidth - WEAPON.gunSpread) / 2;
        const unitLateral = (u.x - centre) / FORMATION_HALF_WIDTH * unitSpan;
        const gunLateral = guns === 1
          ? 0
          : (g / (guns - 1) - 0.5) * WEAPON.gunSpread;
        const x = centre + unitLateral + gunLateral;
        for (let k = 0; k < honoured; k++) {
          // The render stride, over SPAWNED bullets. Same shape, separate
          // state, and it may never feed anything above this line.
          this.drawCredit += drawnShare;
          const drawn = this.drawCredit >= 1;
          if (drawn) this.drawCredit -= 1;
          this.bullets.spawn(
            x, u.y - 10,
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
        // One encounter per body. The bullet is still inside a large body on
        // the steps after it struck, and the shots that pierced have already
        // been charged for this one - see `Bullet.struck`.
        if (b.struck.includes(e)) return;
        b.struck.push(e);
        const len = Math.hypot(b.vx, b.vy) || 1;
        const ux = b.vx / len, uy = b.vy / len;
        // The body consumes as many of the bullet's shots as it takes to kill
        // it, each spending a pierce; the rest fly on. A one-shot bullet is the
        // old rule exactly: one hit, then pierce down or gone.
        const perShot = b.damage * (1 - armorAgainst(e, ux, uy));
        // The pierce instrument. Fresh shots sit at the top pierce level and
        // only ever leave it, so the top level's drop is the number of shots
        // meeting their FIRST body here; every shot charged is a hit. Hits per
        // landing shot is what `pierceMultiplier` claims. Diagnostics only.
        const topBefore = b.bundle[b.bundle.length - 1];
        const consumed = strike(b, e.hp, perShot, true);
        this.shotHits += consumed;
        this.shotLandings += topBefore - b.bundle[b.bundle.length - 1];
        const titan = e.type.id === 'titan' ? Enemies.titanProgress(e) : -1;
        if (this.enemies.damage(e, consumed * b.damage, ux, uy)) {
          this.sim.push({
            kind: 'kill', x: e.x, y: e.y, radius: e.radius, color: e.type.color, titan: titan >= 0,
          });
          this.onKill();
          if (titan >= 0) {
            this.sim.push({ kind: 'titan', phase: 'down' });
            const check = this.titanChecks[this.titanChecks.length - 1];
            if (check) check.killedAt = Number(titan.toFixed(3));
          }
        }
      });

      if (!b.active) continue;
      for (const c of this.enemies.cages) {
        if (!c.active) continue;
        const dx = c.x - b.x, dy = c.y - b.y;
        const r = CAGE.radius + WEAPON.bulletRadius;
        if (dx * dx + dy * dy > r * r) continue;
        // A cage is a body to the stream: the shots that open it spend one
        // pierce and fly on, the rest carry on untouched, and a bullet meets
        // a cage once - the same `struck` guard as an enemy, without which a
        // piercing shot would be charged against the bars on every step it
        // was inside them. Until 1.2 a cage spent every shot whatever its
        // pierce (the author: "RESCUE boxes seem not to be affected by PIERCE
        // but should be").
        if (b.struck.includes(c)) continue;
        b.struck.push(c);
        const consumed = strike(b, c.hp, b.damage, true);
        c.hp -= consumed * b.damage;
        c.hitFlash = this.elapsed;
        if (c.hp <= 0) {
          c.active = false;
          // A share of the army held at the moment the cage opens, whole,
          // floored - see CAGE in config. Par is NOT credited.
          const reward = cageReward(this.squad.power);
          this.squad.addPower(reward);
          this.rescues++;
          this.rescuedPower += reward;
          this.sim.push({ kind: 'rescue', x: c.x, y: c.y, amount: reward });
        }
        if (!b.active) break;
      }
    }
  }

  private onKill(): void {
    this.kills++;
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
      const d = this.log.resolve(g.pair, g.index);
      if (d !== null) {
        this.sim.push({
          kind: 'pick', x: g.x, y: g.y, width: g.width, axis: g.type.axis, label: g.type.label,
          grade: d.risk ? 'risk' : d.rank <= 0.001 ? 'perfect' : d.rank >= 0.999 ? 'bad' : 'good',
        });
      }
      this.squad.applyGate(g.type);
    }
  }

  /** Bodies touching the ring, consumed at the contact price. */
  private applyContacts(): void {
    const { consumed, titan } = this.enemies.collectContacts(this.squad.units, SQUAD.unitRadius);
    if (consumed.length === 0) return;
    this.contactLoss += this.charge(consumed, 'contact');
    this.cameras.main.shake(titan ? 260 : 120, titan ? 0.014 : 0.006);
    this.endIfLost(titan);
  }

  /** Bodies past the line that missed the ring. Same price, same function. */
  private applyBreaches(): void {
    const { consumed, titan } = this.enemies.collectBreaches();
    if (consumed.length === 0) return;
    this.breachLoss += this.charge(consumed, 'breach');
    this.cameras.main.shake(titan ? 260 : 120, titan ? 0.014 : 0.006);
    this.endIfLost(titan);
  }

  /** Prices every body against the power held BEFORE any of them landed. */
  private charge(consumed: readonly Consumed[], kind: 'contact' | 'breach'): number {
    const power = this.squad.power;
    let total = 0;
    for (const c of consumed) {
      const cost = contactCost(c.type, power);
      total += cost;
      const titan = c.type.id === 'titan';
      this.sim.push({
        kind, x: c.x, y: c.y, cost, share: power > 0 ? cost / power : 1, tier: c.type.tier, titan,
      });
      if (titan) {
        const check = this.titanChecks[this.titanChecks.length - 1];
        if (check) check.landedAt = Number(Enemies.titanProgressAt(c.y).toFixed(3));
      }
    }
    this.squad.addPower(-total);
    return total;
  }

  /**
   * A Titan reaching the army ends the run outright, whatever power is left.
   * Its HP is budgeted so that killing it is achievable at `bossKillPar` of
   * par over `bossKillDistance` of its descent; letting it land and merely
   * taking damage would make that budget meaningless.
   */
  private endIfLost(titan: boolean): void {
    // Once, whichever check ended it: a Titan contact zeroes the army, and
    // fire landing on the same step must not re-announce the end as attrition.
    if (this.over || (!titan && this.squad.alive)) return;
    this.over = true;
    this.emitGameOver(titan ? 'titan' : 'overrun');
  }

  /**
   * Squad power destroyed by enemy fire. Separate from the contact price on
   * purpose: a body reaching you is a failure to kill, while fire is a tax on
   * standing still, and the two need to read differently.
   */
  private applyIncomingFire(): void {
    // SHIELD sees each landing bullet first and may absorb it: one charge
    // per bullet, shell or dart, and an absorbed bullet costs nothing. The
    // pool is the squad's, stepped in `Squad.update`; the decision is here so
    // `EnemyBullets` stays a pool of bullets.
    const shield = this.squad.shield;
    const hits = this.enemyFire.collide(this.squad.units, SQUAD.unitRadius, (b) => {
      if (!shield.tryBlock()) return false;
      this.blocked++;
      this.sim.push({ kind: 'block', x: b.x, y: b.y, shell: b.shell, left: shield.ready });
      return true;
    });
    if (hits <= 0) return;
    // A bullet costs a share of the army you hold, floored to whole power and
    // never less than one - read once, from the power before this step's
    // hits, so several bullets landing together each cost the same.
    const power = this.squad.power;
    const perHit = Math.max(ENEMY_FIRE.minCost, Math.floor(power * ENEMY_FIRE.powerShare));
    const cost = hits * perHit;
    this.squad.addPower(-cost);
    this.fireLoss += cost;
    this.sim.push({ kind: 'fire', cost, share: power > 0 ? cost / power : 1, hits });
    this.cameras.main.shake(70, 0.003);
    this.endIfLost(false);
  }

  /**
   * The end screen's whole payload, including the match code, because that
   * screen is a shareable artefact rather than a summary - see hud/EndScreen.
   */
  private emitGameOver(cause: 'overrun' | 'titan'): void {
    this.cause = cause;
    this.sim.push({ kind: 'over', cause });
    const match = { seed: this.seed, mode: this.mode };
    this.game.events.emit('gameover', {
      cause,
      wave: this.enemies.wave.index,
      elapsed: Number(this.elapsed.toFixed(1)),
      kills: this.kills,
      optimal: this.log.fractionOfOptimal,
      peakDps: Math.round(this.peakDps),
      tally: this.log.tally,
      contactLoss: Math.round(this.contactLoss),
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
          index: g.index,
          delta: Number(scored.options[i].delta.toFixed(5)),
          best: i === scored.best,
          sensed: g.sensed && i === scored.best,
        });
      }
    }
    return out;
  }

  private emitHud(): void {
    const par = this.difficulty.snapshot();
    const gates = this.scoreLiveGates();
    const u = this.squad.upgrades;
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
      // The boss check, in the unit its budget is written in: where each Titan
      // died as a fraction of its descent, and the live one's state.
      titanChecks: this.titanChecks,
      titan: (() => {
        const t = this.enemies.titan;
        return t
          ? { progress: Number(Enemies.titanProgress(t).toFixed(3)), hpFrac: Number((t.hp / t.maxHp).toFixed(3)) }
          : null;
      })(),
      seed: this.seed,
      gates,
      contactLoss: Math.round(this.contactLoss),
      breachLoss: Math.round(this.breachLoss),
      fireLoss: Math.round(this.fireLoss),
      blocked: this.blocked,
      shield: u.shield,
      cages: this.enemies.cagesSpawned,
      rescues: this.rescues,
      rescuedPower: this.rescuedPower,
      traveled: Math.round(this.traveled),
      peakPower: Math.floor(this.peakPower),
      peakDps: Math.round(this.peakDps),
      // The pierce claim against the pierce measurement, both in bodies hit
      // per shot that lands. Cumulative over the run, so it lags a pierce pick
      // by the shots already counted; read it over a long window. `landed` is
      // the share of fired shots that met anything at all.
      pierce: u.pierce,
      pierceClaim: Number(pierceMultiplier(u.pierce).toFixed(3)),
      hitsPerLanding: this.shotLandings > 0
        ? Number((this.shotHits / this.shotLandings).toFixed(3))
        : 0,
      landed: this.bullets.shotsSpawned > 0
        ? Number((this.shotLandings / this.bullets.shotsSpawned).toFixed(3))
        : 0,
      sense: u.sense,
      // SIMULATED seconds, which is what a run should be measured in. The
      // simulation advances on clamped frame deltas, so wall-clock time and
      // game time are not the same quantity and their ratio moves with how much
      // rendering the scene happens to be doing.
      elapsed: Number(this.elapsed.toFixed(2)),
      decisions: this.log.count,
      optimal: Number(this.log.fractionOfOptimal.toFixed(4)),
      tally: this.log.tally,
    });
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
      moveMult: u.moveMult,
      gateSpeedMult: u.gateSpeedMult,
      sense: u.sense,
      senseChance: senseChance(u.sense),
      shield: u.shield,
      shieldReady: this.squad.shield.ready,
      shieldCapacity: Shield.capacity(u.shield),
      titan: (() => { const t = this.enemies.titan; return t ? { hpFrac: t.hp / t.maxHp, progress: Enemies.titanProgress(t) } : null; })(),
    };
    this.game.events.emit('hud', hud);
  }

  // --- rendering ------------------------------------------------------------

  /**
   * One frame. Everything the steps since the last frame did is drained
   * first, in order, as one `moment` emit and one call into each layer: the
   * renderer's, the HUD's and the audio's single account of the step. The
   * layers live in `render/`; this scene only hands them the state.
   */
  private render(): void {
    const events = this.sim.drain();
    if (events.length) {
      this.game.events.emit('moment', events);
      this.sprites.onEvents(events);
      this.field.onEvents(events);
    }
    this.sprites.render({
      enemies: this.enemies, bullets: this.bullets, enemyFire: this.enemyFire,
      squad: this.squad, elapsed: this.elapsed,
    });
    const marked = new Set<string>();
    for (const s of this.scoreLiveGates()) if (s.sensed) marked.add(`${s.pair}:${s.index}`);
    this.field.render({
      gates: this.gates, enemies: this.enemies, squad: this.squad, marked, elapsed: this.elapsed,
    });
  }
}

/** Shared with the UI scene, which draws the controls these rectangles describe. */
function inButton(b: { x: number; y: number; width: number; height: number }, x: number, y: number): boolean {
  return Math.abs(x - b.x) <= b.width / 2 && Math.abs(y - b.y) <= b.height / 2;
}
