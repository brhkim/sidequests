import Phaser from 'phaser';
import { ARENA, CAGE, COLORS, GATES, SQUAD, STREAK, VIEW, WAVE, WEAPON } from '../config';
import { TIERS } from '../data/tiers';
import { Squad } from '../systems/Squad';
import { Bullets } from '../systems/Bullets';
import { Enemies, type Enemy } from '../systems/Enemies';
import { Gates } from '../systems/Gates';
import { Difficulty } from '../systems/Difficulty';
import { Grid } from '../systems/Grid';
import { SpritePool } from '../systems/SpritePool';
import { createRng } from '../systems/Rng';

const SKIN = 0xf2c9a0;

export class GameScene extends Phaser.Scene {
  private squad!: Squad;
  private bullets!: Bullets;
  private enemies!: Enemies;
  private gates!: Gates;
  private difficulty!: Difficulty;
  private grid!: Grid<Enemy>;

  private bodyPool!: SpritePool;
  private headPool!: SpritePool;
  private enemyPool!: SpritePool;
  private bulletPool!: SpritePool;
  private cagePool!: SpritePool;

  private overlay!: Phaser.GameObjects.Graphics;
  private gateVisuals: {
    rect: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
  }[] = [];
  private cursors?: { left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  private rng: () => number = Math.random;
  private targetX = VIEW.width / 2;
  private kills = 0;
  private streak = 0;
  private over = false;

  private seed = 0;

  constructor() { super('Game'); }

  create(): void {
    const { rng, seed } = createRng();
    this.seed = seed;
    this.rng = rng;
    this.squad = new Squad(VIEW.width / 2, ARENA.laneY, SQUAD.startPower, this.rng);
    this.bullets = new Bullets();
    this.difficulty = new Difficulty();
    this.enemies = new Enemies(this.rng, this.difficulty);
    this.gates = new Gates(this.rng, (offer) => this.difficulty.observeGateOffer(offer));
    this.grid = new Grid<Enemy>(48, VIEW.width);

    this.drawBackground();
    this.overlay = this.add.graphics().setDepth(6);

    this.enemyPool = new SpritePool(this, 'dot', 10);
    this.cagePool = new SpritePool(this, 'cage', 11);
    this.bulletPool = new SpritePool(this, 'bullet', 12);
    this.bodyPool = new SpritePool(this, 'body', 20);
    this.headPool = new SpritePool(this, 'head', 21);

    this.bindInput();
    this.emitHud();
  }

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(COLORS.bg, 1).fillRect(0, 0, VIEW.width, VIEW.height);
    g.fillStyle(COLORS.lane, 1).fillRect(0, ARENA.laneY - 120, VIEW.width, 260);
    g.lineStyle(2, COLORS.breach, 0.35);
    g.lineBetween(0, ARENA.breachY, VIEW.width, ARENA.breachY);
    // Backing strip so the HUD stays legible as enemies walk in from the top.
    const hud = this.add.graphics().setDepth(30);
    hud.fillStyle(COLORS.bg, 0.82).fillRect(0, 0, VIEW.width, 134);
    hud.fillStyle(COLORS.bg, 0.35).fillRect(0, 134, VIEW.width, 14);
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
    this.difficulty.reset();
    this.enemies.reset();
    this.gates.reset();
    this.game.events.emit('restart');
    this.emitHud();
  }

  override update(_time: number, delta: number): void {
    if (this.over) return;
    // Clamp dt: a long frame would otherwise let fast enemies and bullets skip
    // past each other between collision checks.
    const dt = Math.min(delta / 1000, 1 / 30);

    this.handleKeys(dt);
    this.squad.update(dt, this.targetX);
    this.enemies.playerDps = this.squad.dps;
    this.fire(dt);
    this.bullets.update(dt);
    const { newWave } = this.enemies.update(dt);
    this.gates.update(dt, this.enemies.wave.index, this.squad.power);

    if (newWave) {
      this.squad.addPower(WAVE.clearBonus);
      this.difficulty.awardWaveClear();
      this.toast(`WAVE ${this.enemies.wave.index}`);
    }

    this.collide();
    this.checkGates();
    this.applyBreaches();

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
        if (this.enemies.damage(e, b.damage)) this.onKill();
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
      this.toast(this.squad.applyGate(g.type));
      this.gates.consumePair(g.pair);
    }
  }

  private applyBreaches(): void {
    const cost = this.enemies.collectBreaches();
    if (cost <= 0) return;
    this.squad.addPower(-cost * SQUAD.breachLoss);
    this.cameras.main.shake(120, 0.006);
    if (!this.squad.alive) {
      this.over = true;
      this.game.events.emit('gameover', { wave: this.enemies.wave.index, kills: this.kills });
    }
  }

  private toast(text: string): void {
    this.game.events.emit('toast', text);
  }

  private emitHud(): void {
    const par = this.difficulty.snapshot();
    const gates = this.gates.items
      .filter((g) => g.active)
      .map((g) => ({
        x: Math.round(g.x), y: Math.round(g.y),
        label: g.type.label, axis: g.type.axis, form: g.type.form,
      }));
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
    });
    this.game.events.emit('hud', {
      power: Math.floor(this.squad.power),
      wave: this.enemies.wave.index,
      tier: this.squad.topTier,
      tierName: TIERS[this.squad.topTier].name,
      tierColor: TIERS[this.squad.topTier].shirt,
      kills: this.kills,
      capped: this.squad.power > SQUAD.ringCap,
    });
  }

  // --- rendering ------------------------------------------------------------

  private render(): void {
    this.renderEnemies();
    this.renderBullets();
    this.renderSquad();
    this.renderGates();
    this.renderOverlay();
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

  private renderSquad(): void {
    this.bodyPool.begin();
    this.headPool.begin();
    for (const u of this.squad.units) {
      const tier = TIERS[u.tier];
      this.bodyPool.claim().setPosition(u.x, u.y + 2).setTint(tier.shirt);
      this.headPool.claim().setPosition(u.x, u.y - 10).setTint(SKIN);
    }
    this.bodyPool.end();
    this.headPool.end();
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
            fontSize: '26px',
            color: COLORS.text,
            fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(5),
        };
        this.gateVisuals.push(v);
      }
      v.rect.setVisible(true).setPosition(g.x, g.y)
        .setSize(g.width - 4, GATES.height)
        .setFillStyle(g.type.color, 0.22)
        .setStrokeStyle(3, g.type.color, 0.9);
      v.label.setVisible(true).setPosition(g.x, g.y);
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
