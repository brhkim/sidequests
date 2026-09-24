import Phaser from 'phaser';
import { VIEW } from '../../config';
import { LIGHT, MOTION } from '../theme';
import { TITAN_WARNING_MS } from './BossBar';
import { BAND } from './HudLayout';
import { FONT } from './types';

const DEPTH = 44;
const LANES = 3;
/** The Titan's purple, and the lavender its words are set in. */
const TITAN = 0xa35bd6;
const TITAN_INK = 0xefdcff;
const WAVE_INK = 0xf2f3ff;
/** How long WAVE N holds between wiping in and out, ms: a glance, not a stop. */
const WAVE_HOLD = 400;
/** The sub-line's inset from the band's right end. */
const SUB_INSET = 16;

interface Look { title: string; sub: string; edge: number; ink: number; hold: number; pulse: boolean }

/**
 * The stage banner, in the highway's grammar: three translucent lane slabs,
 * docked under the HUD's bottom edge (`BAND`), wipe in one lane after
 * another (`MOTION.wipe`, staggered by `MOTION.wipeStagger`), the word
 * snaps in slanted with a small overshoot, holds, and the lanes wipe out
 * the way they came. It carries
 *
 * - `WAVE N` as each wave begins,
 * - `TITAN` - the boss warning, its lit edges in the Titan's purple, the word
 *   pulsing twice on the beat, the wave number at the band's end - held for
 *   `TITAN_WARNING_MS`, after which the Titan row's bar arrives,
 * - `TITAN DOWN`, held longer.
 *
 * A second announcement inside the window replaces the first rather than
 * stacking; a `WAVE N` that lands while the Titan warning is up becomes its
 * sub-line instead (the two arrive on the same step every fifth wave).
 * Everything is render-only, on the UI scene's own clock.
 */
export class WaveBanner {
  private readonly slabs: Phaser.GameObjects.Image[] = [];
  private readonly title: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  private mode: 'none' | 'wave' | 'titan' | 'down' = 'none';
  private lastWave = 0;
  private exit: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const top = BAND.y - BAND.h / 2;
    for (let i = 0; i < LANES; i++) {
      this.slabs.push(scene.add.image(i * BAND.lane, top, 'hud-band').setOrigin(0, 0)
        .setDepth(DEPTH).setVisible(false));
    }
    // The word carries its own dark stroke: the slab under it is translucent,
    // so a body or a card can pass behind it without eating the letters.
    this.title = scene.add.text(VIEW.width / 2, BAND.y, '', {
      fontFamily: FONT, fontSize: '32px', fontStyle: 'italic 800', color: '#ffffff',
      stroke: '#07070d', strokeThickness: 6,
    }).setOrigin(0.5).setPadding(10, 2, 10, 2).setLetterSpacing(3).setDepth(DEPTH).setVisible(false);
    // The sub-line (the wave under a TITAN warning) sits at the band's right
    // end on the same row: 44px holds one line, not two.
    this.sub = scene.add.text(VIEW.width - SUB_INSET, BAND.y + 1, '', {
      fontFamily: FONT, fontSize: '14px', fontStyle: '700', color: '#ffffff',
      stroke: '#07070d', strokeThickness: 4,
    }).setOrigin(1, 0.5).setLetterSpacing(3).setDepth(DEPTH).setVisible(false);
  }

  wave(index: number): void {
    this.lastWave = index;
    if (this.mode === 'titan') {
      this.setSub(`WAVE ${index}`);
      return;
    }
    this.show({ title: `WAVE ${index}`, sub: '', edge: LIGHT.rail, ink: WAVE_INK, hold: WAVE_HOLD, pulse: false });
  }

  /** The Titan's arrival: the warning, before its bar. */
  titan(): void {
    const sub = this.lastWave > 0 ? `WAVE ${this.lastWave}` : '';
    this.show({
      title: 'TITAN', sub, edge: TITAN, ink: TITAN_INK,
      hold: TITAN_WARNING_MS - MOTION.wipe - MOTION.wipeStagger * (LANES - 1), pulse: true,
    }, 'titan');
  }

  titanDown(): void {
    this.show({ title: 'TITAN DOWN', sub: '', edge: TITAN, ink: TITAN_INK, hold: 1200, pulse: false }, 'down');
  }

  private show(look: Look, mode: 'wave' | 'titan' | 'down' = 'wave'): void {
    this.clear();
    this.mode = mode;
    const top = BAND.y - BAND.h / 2;
    const tweens = this.scene.tweens;

    // In: each lane wipes open left to right, one lane after the next.
    this.slabs.forEach((s, i) => {
      s.setPosition(i * BAND.lane, top).setTint(look.edge).setScale(0, 1).setAlpha(1).setVisible(true);
      tweens.add({
        targets: s, scaleX: 1, delay: i * MOTION.wipeStagger, duration: MOTION.wipe, ease: 'Cubic.easeOut',
      });
    });

    if (this.title.text !== look.title) this.title.setText(look.title);
    this.title.setTint(look.ink).setAlpha(0).setScale(1.3).setVisible(true).setX(VIEW.width / 2 - 24);
    tweens.add({
      targets: this.title, alpha: 1, scale: 1, x: VIEW.width / 2,
      delay: MOTION.wipeStagger, duration: MOTION.snap, ease: MOTION.snapEase,
    });
    this.setSub(look.sub);
    this.sub.setTint(look.ink).setAlpha(0).setVisible(true);
    tweens.add({ targets: this.sub, alpha: 0.9, delay: MOTION.wipeStagger * 2, duration: MOTION.snap });

    const inFor = MOTION.wipe + MOTION.wipeStagger * (LANES - 1);
    if (look.pulse) {
      // The warning beats twice while it holds.
      tweens.add({
        targets: this.title, alpha: 0.35, delay: inFor + 60, duration: 150,
        yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
      });
    }

    // Out: the lanes wipe on across, the same order they came in.
    this.exit = this.scene.time.delayedCall(inFor + look.hold, () => {
      this.exit = null;
      this.slabs.forEach((s, i) => {
        tweens.add({
          targets: s, scaleX: 0, x: (i + 1) * BAND.lane,
          delay: i * MOTION.wipeStagger, duration: MOTION.wipe, ease: MOTION.exitEase,
        });
      });
      tweens.add({
        targets: this.title, alpha: 0, x: VIEW.width / 2 + 24,
        duration: inFor, ease: MOTION.exitEase,
        onComplete: () => this.clear(),
      });
      tweens.add({ targets: this.sub, alpha: 0, duration: inFor, ease: MOTION.exitEase });
    });
  }

  private setSub(s: string): void {
    if (this.sub.text !== s) this.sub.setText(s);
  }

  private clear(): void {
    this.exit?.remove(false);
    this.exit = null;
    const parts = [...this.slabs, this.title, this.sub];
    this.scene.tweens.killTweensOf(parts);
    for (const p of parts) p.setVisible(false);
    this.title.setX(VIEW.width / 2);
    this.mode = 'none';
  }

  reset(): void {
    this.clear();
    this.lastWave = 0;
  }
}
