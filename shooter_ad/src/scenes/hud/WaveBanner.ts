import Phaser from 'phaser';
import { VIEW } from '../../config';
import { FONT } from './types';

const Y = 330;

/**
 * A wave cleared, announced once across the field: the wave number and what
 * clearing it paid. Enters, holds long enough to read, and leaves; a second
 * announcement inside that window replaces the first rather than stacking.
 * Also carries `TITAN DOWN`, on a purple band held longer.
 */
export class WaveBanner {
  private readonly band: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    const cx = VIEW.width / 2;
    this.band = scene.add.rectangle(cx, Y, VIEW.width, 64, 0x0b0f1c, 0.75).setDepth(44).setVisible(false);
    this.title = scene.add.text(cx, Y - 8, '', {
      fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: '#f2f6ff',
    }).setOrigin(0.5).setLetterSpacing(4).setDepth(44).setVisible(false);
    this.sub = scene.add.text(cx, Y + 22, '', {
      fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#3ecf7a',
    }).setOrigin(0.5).setLetterSpacing(1.5).setDepth(44).setVisible(false);
  }

  wave(index: number, bonus: number): void {
    this.show(`WAVE ${index}`, `+${bonus} ARMY`, 0x0b0f1c, 0.75, 600);
  }

  titanDown(): void {
    this.show('TITAN DOWN', '', 0x6b2b8c, 0.5, 1200);
  }

  private show(title: string, sub: string, color: number, alpha: number, hold: number): void {
    const parts = [this.band, this.title, this.sub];
    this.scene.tweens.killTweensOf(parts);
    this.band.setFillStyle(color, alpha);
    this.title.setText(title).setY(Y + (sub ? -8 : 0));
    this.sub.setText(sub);
    for (const p of parts) p.setAlpha(0).setVisible(true);
    this.band.setScale(1, 0.6);
    this.scene.tweens.add({ targets: parts, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this.band, scaleY: 1, duration: 180, ease: 'Quad.easeOut' });
    this.scene.tweens.add({
      targets: parts, alpha: 0, delay: 180 + hold, duration: 240, ease: 'Quad.easeIn',
      onComplete: () => { for (const p of parts) p.setVisible(false); },
    });
  }

  reset(): void {
    const parts = [this.band, this.title, this.sub];
    this.scene.tweens.killTweensOf(parts);
    for (const p of parts) p.setVisible(false);
  }
}
