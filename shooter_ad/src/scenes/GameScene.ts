import Phaser from 'phaser';
import {
  ARENA, CAGE, COLORS, ENEMY_FIRE, GATES, SQUAD, STREAK, VIEW, WAVE, WEAPON,
} from '../config';
import { TIERS } from '../data/tiers';
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
import { VERSION } from '../version';
import { pierceMultiplier } from '../systems/Progression';
import { RAIL_HEIGHT } from './hud/TopRail';
import type { HudPayload } from './hud/types';

const SKIN = 0xf2c9a0;

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
  private traveled = 0;
  private lastX = VIEW.width / 2;
  private streak = 0;
  private over = false;
  /** Held at the start screen until the player commits. */
  private waiting = true;

  private seed = 0;
  private mode: MatchMode = 'normal';

  constructor() { super('Game'); }

  create(): void {
    const { rng, seed } = createRng();
    this.seed = seed;
    this.rng = rng;
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
        this.difficulty.observeGateOffer(offer);
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
        invited: matchFromQuery(window.location.search) !== null,
      });
    });
    this.game.events.once('startmatch', () => { this.waiting = false; });
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
      if (p.isDown) this.targetX = p.worldX;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.over) this.restart();
      else this.targetX = p.worldX;
    });
    this.input.keyboard?.on('keydown-SPACE', () => { if (this.over) this.restart(); });
  }

  private restart(): void {
    this.over = false;
    this.kills = 0;
    this.streak = 0;
    this.targetX = VIEW.width / 2;
    this.squad = new Squad(VIEW.width / 2, ARENA.laneY, SQUAD.startPower, this.rng);
    this.bullets = new Bullets();
    this.enemyFire.reset();
    this.difficulty.reset();
    this.log.reset();
    this.elapsed = 0;
    this.breachLoss = 0;
    this.fireLoss = 0;
    this.traveled = 0;
    this.lastX = VIEW.width / 2;
    this.waiting = false;
    this.enemies.reset();
    this.gates.reset();
    this.game.events.emit('restart');
    this.emitHud();
  }

  override update(_time: number, delta: number): void {
    if (this.over || this.waiting) return;
    // Clamp dt: a long frame would otherwise let fast enemies and bullets skip
    // past each other between collision checks.
    const dt = Math.min(delta / 1000, 1 / 30);
    this.elapsed += dt;

    this.handleKeys(dt);
    this.squad.update(dt, this.targetX);
    this.traveled += Math.abs(this.squad.x - this.lastX);
    this.lastX = this.squad.x;
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
    });

    if (newWave) {
      this.squad.addPower(WAVE.clearBonus);
      this.difficulty.awardWaveClear();
      this.toast(`WAVE ${this.enemies.wave.index}`);
    }

    this.collide();
    this.checkGates();
    this.applyBreaches();
    this.applyIncomingFire();

    this.render();
    this.emitHud();
  }

  private handleKeys(dt: number): void {
    if (!this.cursors) return;
    if (this.cursors.left.isDown) this.targetX -= SQUAD.moveSpeed * dt;
    if (this.cursors.right.isDown) this.targetX += SQUAD.moveSpeed * dt;
    this.targetX = Math.max(ARENA.minX, Math.min(ARENA.maxX, this.targetX));
  }

  private fire(dt: number): void {
    const { guns, pierce } = this.squad.upgrades;
    for (const u of this.squad.units) {
      u.cooldown -= dt;
      if (u.cooldown > 0) continue;
      u.cooldown += this.squad.shotInterval(u.share);
      const damage = this.squad.damagePerShot(u.share);
      for (let g = 0; g < guns; g++) {
        const offset = guns === 1 ? 0 : (g - (guns - 1) / 2) * WEAPON.volleySpread;
        const angle = -Math.PI / 2 + offset * 0.12;
        this.bullets.spawn(
          u.x, u.y - 10,
          Math.cos(angle) * WEAPON.bulletSpeed,
          Math.sin(angle) * WEAPON.bulletSpeed,
          damage, pierce,
        );
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
        if (this.enemies.damage(e, b.damage, b.vx / len, b.vy / len)) this.onKill();
        if (b.pierce > 0) b.pierce--;
        else b.active = false;
      });

      if (!b.active) continue;
      for (const c of this.enemies.cages) {
        if (!c.active) continue;
        const dx = c.x - b.x, dy = c.y - b.y;
        const r = CAGE.radius + WEAPON.bulletRadius;
        if (dx * dx + dy * dy > r * r) continue;
        c.hp -= b.damage;
        b.active = false;
        if (c.hp <= 0) {
          c.active = false;
          this.squad.addPower(CAGE.reward);
          this.difficulty.awardCage();
          this.toast(`RESCUED +${CAGE.reward}`);
        }
        break;
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
    const cost = this.enemies.collectBreaches();
    if (cost <= 0) return;
    this.squad.addPower(-cost * SQUAD.breachLoss);
    this.breachLoss += cost * SQUAD.breachLoss;
    this.cameras.main.shake(120, 0.006);
    if (!this.squad.alive) {
      this.over = true;
      this.emitGameOver();
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
  private emitGameOver(): void {
    const match = { seed: this.seed, mode: this.mode };
    this.game.events.emit('gameover', {
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
  private scoreLiveGates() {
    const live = this.gates.items.filter((g) => g.active);
    const byPair = new Map<number, typeof live>();
    for (const g of live) {
      const group = byPair.get(g.pair);
      if (group) group.push(g); else byPair.set(g.pair, [g]);
    }
    const out = [];
    for (const group of byPair.values()) {
      const scored = scoreOffer(this.squad.progress, group.map((g) => g.type));
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
      rate: Number(this.enemies.spawnRate.toFixed(2)),
      wave: this.enemies.wave.index,
      tier: this.squad.topTier,
      tierName: TIERS[this.squad.topTier].name,
      units: this.squad.units.length,
      kills: this.kills,
      over: this.over,
      seed: this.seed,
      gates,
      breachLoss: Math.round(this.breachLoss),
      fireLoss: Math.round(this.fireLoss),
      traveled: Math.round(this.traveled),
      decisions: this.log.count,
      optimal: Number(this.log.fractionOfOptimal.toFixed(4)),
      tally: this.log.tally,
    });
    const u = this.squad.upgrades;
    const hud: HudPayload = {
      power: Math.floor(this.squad.power),
      wave: this.enemies.wave.index,
      tier: this.squad.topTier,
      tierName: TIERS[this.squad.topTier].name,
      tierColor: TIERS[this.squad.topTier].shirt,
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

  private renderBullets(): void {
    this.bulletPool.begin();
    for (const b of this.bullets.items) {
      if (!b.active) continue;
      this.bulletPool.claim().setPosition(b.x, b.y).setTint(COLORS.bullet);
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
      const tier = TIERS[u.tier];
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
        .setSize(g.width - 4, GATES.height)
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
