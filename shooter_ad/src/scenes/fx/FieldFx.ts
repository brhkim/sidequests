import Phaser from 'phaser';
import { ARENA, RENDER, VIEW } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import type { SimEvent } from '../../systems/SimEvents';
import { FONT, GRADE_COLOR, GRADE_WORD, hex, type Grade } from '../hud/types';
import { compact } from '../../format';
import { HW } from '../art/cards';
import { INK, LIGHT, MOTION, SURFACE, TYPE } from '../theme';
import { Bursts } from './Bursts';
import { FloatingLabels } from './FloatingLabels';

const WORDS = 4;
const RED = GRADE_COLOR.bad;
/** How far above the taken note the grade word lands: clear of the ring's heads. */
const WORD_LIFT = 44;
/** The scale a grade word punches in from, before its overshoot settles it. */
const PUNCH_FROM = 1.7;
/** How far over the lane line a word about the ring lands (MISS, `-N`): above its heads. */
const FLOAT_LIFT = 60;

interface Judgment {
  word: Phaser.GameObjects.Text;
  /** `N IN A ROW` under a PERFECT, when the run of PERFECTs is two or more. */
  streak: Phaser.GameObjects.Text;
}

/**
 * Feedback that happens AT a place on the field: the judgment on a pick,
 * `MISS` at the lane line when an offer passes untaken, `+N ARMY` over an
 * opened cage, `-N` where a body touched the ring, `BLOCK` over an absorbed
 * bullet, and the beat of darkness a run ends on. HUD-space feedback (edge
 * flashes, the boss bar, the wave banner) lives in UIScene, which does not
 * shake.
 *
 * The judgment is the signature moment, the rhythm game's: the note bursts
 * in its own footprint (`Bursts` - a flash, a ring and sparks in the grade
 * colour) and the grade word - PERFECT / GOOD / BAD / INVEST - punches in
 * slanted with an overshoot (`MOTION.snap`, Back.out), holds for `pickHold`,
 * then lifts and fades over `pickFade`. Two or more PERFECTs in a row add a
 * `N IN A ROW` line under the word; any other grade or a MISS ends the run.
 * That count is pure feedback, kept here from the pick events and read by
 * nothing else.
 *
 * Everything here is driven by `SimEvent`s and tweens on the scene clock;
 * nothing reads back.
 */
export class FieldFx {
  private readonly labels: FloatingLabels;
  private readonly bursts: Bursts;
  private readonly words: Judgment[] = [];
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly horizon: Phaser.GameObjects.Image;
  private nextWord = 0;
  private perfects = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.bursts = new Bursts(scene, 26);
    this.labels = new FloatingLabels(scene, 6, 27);
    for (let i = 0; i < WORDS; i++) {
      this.words.push({
        word: scene.add.text(0, 0, '', {
          fontFamily: FONT, fontSize: `${TYPE.grade.size}px`, fontStyle: `${TYPE.grade.style} ${TYPE.grade.weight}`,
          color: '#ffffff', stroke: '#07070d', strokeThickness: 5,
          shadow: { offsetX: 0, offsetY: 3, color: 'rgba(0,0,0,0.6)', blur: 4, stroke: true, fill: true },
          // Italic overhangs its advance; pad so the slant is not clipped.
          padding: { left: 6, right: 6 },
        }).setOrigin(0.5).setLetterSpacing(1).setDepth(27).setVisible(false),
        streak: scene.add.text(0, 0, '', {
          fontFamily: FONT, fontSize: `${TYPE.label.size}px`, fontStyle: '800', color: INK.primary,
          stroke: '#07070d', strokeThickness: 4,
        }).setOrigin(0.5).setLetterSpacing(TYPE.label.tracking).setDepth(27).setVisible(false),
      });
    }
    // 29: over everything on the field, under the HUD backing (30).
    this.dim = scene.add.rectangle(VIEW.width / 2, VIEW.height / 2, VIEW.width, VIEW.height, SURFACE.void, 1)
      .setDepth(29).setAlpha(0).setVisible(false);
    // The fail line flaring when a Titan lands on it: the band's bright row
    // sits on the line.
    this.horizon = scene.add.image(VIEW.width / 2, ARENA.breachY, HW.failFlash).setOrigin(0.5, 0.83)
      .setTint(LIGHT.fail).setBlendMode(Phaser.BlendModes.ADD).setDepth(28).setAlpha(0).setVisible(false);
  }

  onEvents(events: readonly SimEvent[]): void {
    for (const e of events) {
      switch (e.kind) {
        case 'pick': this.pick(e.x, e.y, e.width, e.grade); break;
        case 'miss':
          this.perfects = 0;
          // 60px up: the lane line is where the ring's heads are, and the word
          // used to spawn on them. Slanted: it is a judgment like the grades.
          this.labels.spawn(e.x, e.y - FLOAT_LIFT, 'MISS', RED, {
            size: 24, tracking: 2, stroke: 5, rise: 24, duration: 900, hold: 260, italic: true,
          });
          break;
        case 'rescue':
          this.labels.spawn(e.x, e.y - 20, `+${compact(e.amount)} ARMY`, AXIS_COLOR.army, { size: 20, stroke: 5, rise: 40, duration: 860, hold: 120 });
          break;
        case 'contact':
          // Clear of the ring like MISS: 60px over the lane line (or over
          // the body, if it touched the front rank higher up), with MISS's
          // stroke - at the body it landed among the heads.
          if (!e.titan) {
            this.labels.spawn(e.x, Math.min(e.y, ARENA.laneY) - FLOAT_LIFT, `-${e.cost}`, RED, {
              size: 18, stroke: 5, rise: 26, duration: 760, hold: 120,
            });
          }
          break;
        case 'block':
          // Above where the bullet would have landed - clear of the ring and
          // the ground band - in the axis colour, held like MISS so it can be
          // read: the gamble paying off is worth a word, and a shell's is the
          // bigger one.
          this.labels.spawn(e.x, e.y - 44, 'BLOCK', AXIS_COLOR.shield, { size: e.shell ? 19 : 17, tracking: 2, stroke: 4, rise: 30, duration: 900, hold: 260 });
          break;
        case 'over': this.death(e.cause); break;
        default: break;
      }
    }
  }

  /**
   * The judgment. The note bursts where it was taken, and the grade word
   * punches in above it - 1.7x to 1 with an overshoot in 140ms - holds, then
   * lifts 26px and fades.
   */
  private pick(x: number, y: number, width: number, grade: Grade): void {
    const color = GRADE_COLOR[grade];
    this.bursts.burst(x, y, width, color);
    this.perfects = grade === 'perfect' ? this.perfects + 1 : 0;

    const j = this.words[this.nextWord];
    this.nextWord = (this.nextWord + 1) % WORDS;
    this.scene.tweens.killTweensOf([j.word, j.streak]);
    // Keep the word on screen: a note taken at the lane's edge must not push
    // PERFECT half off it.
    const wx = Phaser.Math.Clamp(x, 70, VIEW.width - 70);
    const wy = Math.min(y, ARENA.laneY - 40) - WORD_LIFT;
    j.word.setText(GRADE_WORD[grade]).setColor(hex(color))
      .setPosition(wx, wy).setScale(PUNCH_FROM).setAlpha(0.4).setVisible(true);
    const streak = grade === 'perfect' && this.perfects >= 2;
    if (streak) {
      const text = `${this.perfects} IN A ROW`;
      if (j.streak.text !== text) j.streak.setText(text);
      j.streak.setPosition(wx, wy + 25).setScale(0.6).setAlpha(0).setVisible(true);
    } else {
      j.streak.setVisible(false);
    }
    const { pickHold, pickFade } = RENDER.moments;
    this.scene.tweens.add({
      targets: j.word, scale: 1, alpha: 1, duration: MOTION.snap, ease: MOTION.snapEase,
    });
    if (streak) {
      this.scene.tweens.add({
        targets: j.streak, scale: 1, alpha: 1, delay: 60, duration: MOTION.snap, ease: MOTION.snapEase,
      });
    }
    const targets = streak ? [j.word, j.streak] : [j.word];
    this.scene.tweens.add({
      targets, y: `-=26`, alpha: 0,
      delay: MOTION.snap + pickHold, duration: pickFade, ease: MOTION.exitEase,
      onComplete: () => { j.word.setVisible(false); j.streak.setVisible(false); },
    });
  }

  /**
   * The death beat: the field goes dark over `deathBeat`, and UIScene holds
   * the end screen back for the same interval, so the last frame of the run
   * is seen before the results replace it. A Titan landing also flares the
   * fail line - the line it just crossed is the reason.
   */
  private death(cause: 'overrun' | 'titan'): void {
    this.perfects = 0;
    this.scene.tweens.killTweensOf([this.dim, this.horizon]);
    this.dim.setAlpha(0).setVisible(true);
    this.scene.tweens.add({
      targets: this.dim, alpha: 0.7,
      duration: RENDER.moments.deathBeat - 60, ease: 'Quad.easeOut',
    });
    if (cause === 'titan') {
      this.horizon.setAlpha(1).setVisible(true);
      this.scene.tweens.add({
        targets: this.horizon, alpha: 0, duration: RENDER.moments.deathBeat, ease: 'Quad.easeOut',
        onComplete: () => this.horizon.setVisible(false),
      });
    }
  }

  reset(): void {
    this.labels.reset();
    this.bursts.reset();
    this.perfects = 0;
    for (const j of this.words) {
      this.scene.tweens.killTweensOf([j.word, j.streak]);
      j.word.setVisible(false);
      j.streak.setVisible(false);
    }
    this.scene.tweens.killTweensOf([this.dim, this.horizon]);
    this.dim.setAlpha(0).setVisible(false);
    this.horizon.setAlpha(0).setVisible(false);
  }
}
