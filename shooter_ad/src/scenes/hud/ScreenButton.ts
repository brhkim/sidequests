import Phaser from 'phaser';
import { SCREEN_TEX, type Slice } from '../art/screens';
import { MOTION } from '../theme';
import { FONT, hex } from './types';

/**
 * The screens' buttons (2026-09-24, the highway redesign): rounded, baked
 * faces with a lit top edge and a soft offset shadow, in three weights.
 *
 * - **primary**: the one filled action per screen (START MATCH, RESUME,
 *   REPLAY THIS MATCH) - a lit face in its colour with a baked glow under
 *   it and dark ink, so it is the brightest object on the screen.
 * - **secondary**: every other action - a raised neutral plate with a ring
 *   and the word in the button's colour.
 * - **danger**: RESTART - the secondary build in loss red.
 *
 * `setActive` lights a secondary button (a segmented control's chosen
 * segment, the guide's open topic): its face fills with a deep step of its
 * colour, the ring goes to full and the word turns text white `#e8ecf8` -
 * `npm run endscreen` reads the difficulty that way.
 *
 * Every part is a plain object at the button's own x / y with its origin at
 * the centre, never a nested Container: the probes find a control by its
 * label's position, and the press scales each part about that one centre.
 * The hit area is a Zone at least 44px tall that never scales or moves.
 *
 * Nothing here runs per frame. Hover and press are event-driven; the press
 * is one 140ms tween.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger';

/** The lit segment's word: the probes read the chosen difficulty by this colour. */
export const LIT_TEXT = '#e8ecf8';
/** Dark ink on a filled face (~7:1 on ARMY green). */
const FILLED_TEXT = '#06140c';
/** How far a lit segment's face is taken toward black: deep enough for white type. */
const LIT_FACE = 0.5;
/** The press: a physical give, then back. */
const PRESS_SCALE = 0.96;
const PRESS_DARKEN = 0.72;
const SHADOW_DROP = 5;
const MIN_HIT = 44;

export interface CardButton {
  readonly parts: Phaser.GameObjects.GameObject[];
  /** The fixed hit area: bind the tap here (or hit-test it from GameScene). */
  readonly hit: Phaser.GameObjects.Zone;
  readonly label: Phaser.GameObjects.Text;
  setLabel(text: string): CardButton;
  setActive(on: boolean): CardButton;
  setColor(color: number): CardButton;
  /** Moves every part to a new centre x (the pause screen re-centres SOUND). */
  setX(x: number): CardButton;
  setVisible(on: boolean): CardButton;
  /** Wires the tap with hover and pressed feedback; the handler runs on pointerdown. */
  bind(on: () => void): CardButton;
}

/** A NineSlice of one of the baked screen textures at a given outer size. */
export function slice(
  scene: Phaser.Scene, t: Slice, x: number, y: number, width: number, height: number,
): Phaser.GameObjects.NineSlice {
  const w = Math.max(width + t.pad * 2, t.inset * 2 + 2);
  const h = Math.max(height + t.pad * 2, t.inset * 2 + 2);
  return scene.add.nineslice(x, y, t.key, undefined, w, h, t.inset, t.inset, t.inset, t.inset);
}

export function darken(color: number, k: number): number {
  const r = ((color >> 16) & 0xff) * k, g = ((color >> 8) & 0xff) * k, b = (color & 0xff) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export function cardButton(
  scene: Phaser.Scene, x: number, y: number, width: number, height: number,
  color: number, label: string, fontSize = 20, variant: ButtonVariant = 'primary',
): CardButton {
  const primary = variant === 'primary';
  const glow = primary
    ? slice(scene, SCREEN_TEX.glow, x, y + 2, width, height).setTint(color).setAlpha(0.3)
    : null;
  const shadow = slice(scene, SCREEN_TEX.shadow, x, y + SHADOW_DROP, width, height).setAlpha(0.7);
  const fill = slice(scene, SCREEN_TEX.fill, x, y, width, height);
  const plate = slice(scene, SCREEN_TEX.plate, x, y, width, height);
  const rim = slice(scene, SCREEN_TEX.rim, x, y, width, height);
  const text = scene.add.text(x, y, label, {
    fontFamily: FONT, fontSize: `${fontSize}px`, color: hex(color), fontStyle: '700',
  }).setOrigin(0.5).setLetterSpacing(fontSize >= 20 ? 1.5 : 1.2);
  const hit = scene.add.zone(x, y, width, Math.max(MIN_HIT, height));

  let tint = color;
  let active = primary;
  let hovered = false;
  let pressed = false;
  let visible = true;
  const scaled: Phaser.GameObjects.Components.Transform[] = [shadow, fill, plate, rim, text];
  if (glow) scaled.unshift(glow);

  const paint = () => {
    const filled = active;
    fill.setVisible(visible && filled);
    plate.setVisible(visible && !filled);
    if (filled) {
      // Primary: the colour itself, lifted a touch on hover. A lit
      // segment: a deep step of its colour so the white word holds.
      const base = primary ? (hovered && !pressed ? lift(tint, 0.1) : tint) : darken(tint, LIT_FACE);
      fill.setTint(pressed ? darken(base, PRESS_DARKEN) : base);
    } else {
      plate.setTint(pressed ? 0xa8a8a8 : hovered ? 0xffffff : 0xe4e4e4);
    }
    rim.setTint(primary ? lift(tint, 0.35) : tint)
      .setAlpha(filled ? 1 : hovered || pressed ? 0.95 : 0.55);
    text.setColor(primary ? FILLED_TEXT : filled ? LIT_TEXT : hex(tint));
    glow?.setTint(tint).setAlpha(hovered ? 0.42 : 0.3);
  };

  const press = () => {
    pressed = true;
    scene.tweens.killTweensOf(scaled);
    for (const o of scaled) o.setScale(PRESS_SCALE);
    shadow.y = y + SHADOW_DROP - 3;
    paint();
    // Back out over the press time. The screen this button is on usually
    // hides on the tap; the pressed look must not be what it shows next.
    scene.tweens.add({
      targets: scaled, scale: 1, duration: MOTION.snap, delay: 60, ease: 'Quad.easeOut',
      onComplete: () => { pressed = false; shadow.y = y + SHADOW_DROP; paint(); },
    });
  };

  // Only a bound button is interactive. An interactive object in this scene
  // takes the tap, so a button GameScene hit-tests (PAUSE, REPLAY THIS
  // MATCH) must stay inert here or GameScene never sees it.
  const wire = (on: () => void) => {
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { hovered = true; paint(); });
    hit.on('pointerout', () => { hovered = false; paint(); });
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      press();
      // The tap's tick. Audio listens for it; this file does not know audio exists.
      scene.game.events.emit('uitap');
      on();
    });
  };

  const parts: Phaser.GameObjects.GameObject[] = [];
  if (glow) parts.push(glow);
  parts.push(shadow, fill, plate, rim, text, hit);

  const button: CardButton = {
    parts, hit, label: text,
    setLabel(t) { if (text.text !== t) text.setText(t); return button; },
    setActive(on) { active = primary || on; paint(); return button; },
    setColor(c) { tint = c; paint(); return button; },
    setX(nx) {
      for (const o of [...scaled, hit]) o.x = nx;
      x = nx;
      return button;
    },
    setVisible(on) {
      visible = on;
      for (const o of [glow, shadow, rim, text, hit]) o?.setVisible(on);
      paint();
      return button;
    },
    bind(on) { wire(on); return button; },
  };
  paint();
  return button;
}

/** Toward white by `k`, for a hovered or rimmed primary. */
function lift(color: number, k: number): number {
  const ch = (s: number) => Math.round(((color >> s) & 0xff) + (255 - ((color >> s) & 0xff)) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * A row of segments, one lit: the difficulty choice and the pause tabs.
 * Each segment is a secondary button; `set` lights the chosen key, whose
 * face fills in its own colour (HARD in the warning orange, the tabs in
 * code cyan). The unlit segments sit on the neutral plate with a dim ring.
 */
export function segmented<K extends string>(
  scene: Phaser.Scene, cx: number, y: number, width: number, height: number, gap: number,
  items: readonly { key: K; label: string; color: number }[], fontSize: number,
  onPick: (key: K) => void,
): { parts: Phaser.GameObjects.GameObject[]; set(key: K): void } {
  const total = items.length * width + (items.length - 1) * gap;
  const buttons = items.map((item, i) => {
    const x = cx - total / 2 + width / 2 + i * (width + gap);
    return cardButton(scene, x, y, width, height, item.color, item.label, fontSize, 'secondary')
      .bind(() => onPick(item.key));
  });
  return {
    parts: buttons.flatMap((b) => b.parts),
    set(key) { buttons.forEach((b, i) => b.setActive(items[i].key === key)); },
  };
}
