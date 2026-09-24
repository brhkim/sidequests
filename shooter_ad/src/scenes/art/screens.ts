import type Phaser from 'phaser';
import { RADIUS } from '../theme';

/**
 * Textures for the start, pause and end screens: button faces, note tiles,
 * soft shadows and glows. Owned by the screens workstream of the 2026-09-24
 * redesign; called once from `BootScene`.
 *
 * Every one is baked ONCE on a 2D canvas (real gradients, real blurred
 * shadows via the canvas shadow - never a runtime filter) and drawn through
 * a `NineSlice`, so one small texture serves every width and height a
 * button or tile comes in. Faces meant to take a colour are drawn in GREY:
 * under Phaser's multiply tint white becomes the colour and the grey steps
 * become darker steps of the same hue, so one texture serves every axis,
 * grade and button colour. `SCREEN_TEX` names them and carries each one's
 * slice insets, which the hud/Screen* and hud/CardTile code reads.
 */

/** A texture's key and the NineSlice insets that keep its corners whole. */
export interface Slice { key: string; size: number; inset: number; pad: number }

const BTN_R = RADIUS.button;
const NOTE_R = RADIUS.card;

export const SCREEN_TEX = {
  /** Soft black drop shadow for buttons and tiles; `pad` px of blur around the shape. */
  shadow: { key: 'scr-shadow', size: 96, inset: 32, pad: 18 },
  /** White halo, tinted: the primary button's glow and the lit receptor. */
  glow: { key: 'scr-glow', size: 120, inset: 40, pad: 26 },
  /** A button face in grey steps, tinted to its colour: primary and lit segments. */
  fill: { key: 'scr-fill', size: 64, inset: 18, pad: 0 },
  /** A raised neutral plate, never tinted: every resting secondary button. */
  plate: { key: 'scr-plate', size: 64, inset: 18, pad: 0 },
  /** A 1.5px ring, tinted: the edge that says which colour a button is. */
  rim: { key: 'scr-rim', size: 64, inset: 18, pad: 0 },
  /** A note's body in grey steps with its lit cap, tinted to the axis colour. */
  note: { key: 'scr-note', size: 48, inset: 14, pad: 0 },
  /** The note's untinted gloss: a white sheen over its upper half and a specular top line. */
  gloss: { key: 'scr-gloss', size: 48, inset: 14, pad: 0 },
  /** A plain rounded panel (plots, receptors), tinted. */
  panel: { key: 'scr-panel', size: 48, inset: 14, pad: 0 },
} as const satisfies Record<string, Slice>;

/** Pure-white 1px texture, for tinted rules and bars that must batch as images. */
export const SCREEN_PIXEL = 'scr-px';

export function makeScreens(scene: Phaser.Scene): void {
  bake(scene, SCREEN_TEX.shadow, (ctx, s) => {
    const { pad } = SCREEN_TEX.shadow;
    softShape(ctx, pad, pad, s - pad * 2, s - pad * 2, BTN_R, 9, 'rgba(0,0,0,0.85)');
  });
  bake(scene, SCREEN_TEX.glow, (ctx, s) => {
    const { pad } = SCREEN_TEX.glow;
    softShape(ctx, pad, pad, s - pad * 2, s - pad * 2, BTN_R, 14, 'rgba(255,255,255,0.9)');
  });

  bake(scene, SCREEN_TEX.fill, (ctx, s) => {
    // Body: bright at the top falling to ~half, so the tinted face reads as
    // lit from above; the top 2px ring is the full colour (the lit edge);
    // a faint lighter band along the inside of the edge is the bevel.
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, grey(0.86));
    g.addColorStop(0.5, grey(0.70));
    g.addColorStop(1, grey(0.52));
    rounded(ctx, 0, 0, s, s, BTN_R);
    ctx.fillStyle = g;
    ctx.fill();
    edgeLight(ctx, s, s, BTN_R, grey(1), grey(0.62));
  });

  bake(scene, SCREEN_TEX.plate, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#20223a');
    g.addColorStop(0.55, '#171829');
    g.addColorStop(1, '#111220');
    rounded(ctx, 0, 0, s, s, BTN_R);
    ctx.fillStyle = g;
    ctx.fill();
    edgeLight(ctx, s, s, BTN_R, 'rgba(255,255,255,0.16)', 'rgba(0,0,0,0.25)');
  });

  bake(scene, SCREEN_TEX.rim, (ctx, s) => {
    rounded(ctx, 0.75, 0.75, s - 1.5, s - 1.5, BTN_R - 0.75);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  bake(scene, SCREEN_TEX.note, (ctx, s) => {
    // The note: a deep gradient body in the axis colour (0.62 falling to
    // 0.30 of it, so white type holds contrast on every axis including
    // SENSE's near-white), a lit cap - the top 5px at the full colour - and
    // a lighter inner edge. The shadow is a separate slice under it.
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, grey(0.66));
    g.addColorStop(0.45, grey(0.46));
    g.addColorStop(1, grey(0.30));
    rounded(ctx, 0, 0, s, s, NOTE_R);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    rounded(ctx, 0, 0, s, s, NOTE_R);
    ctx.clip();
    const cap = ctx.createLinearGradient(0, 0, 0, 7);
    cap.addColorStop(0, grey(1));
    cap.addColorStop(0.7, grey(1));
    cap.addColorStop(1, grey(0.66));
    ctx.fillStyle = cap;
    ctx.fillRect(0, 0, s, 7);
    ctx.restore();
    rounded(ctx, 1, 1, s - 2, s - 2, NOTE_R - 1);
    ctx.strokeStyle = grey(0.86);
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  bake(scene, SCREEN_TEX.gloss, (ctx, s) => {
    ctx.save();
    rounded(ctx, 0, 0, s, s, NOTE_R);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, 'rgba(255,255,255,0.30)');
    g.addColorStop(0.16, 'rgba(255,255,255,0.12)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.03)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    // The specular line along the cap's top edge.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(NOTE_R, 0.5, s - NOTE_R * 2, 1);
    ctx.restore();
  });

  bake(scene, SCREEN_TEX.panel, (ctx, s) => {
    rounded(ctx, 0, 0, s, s, NOTE_R);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });

  bake(scene, { key: SCREEN_PIXEL, size: 2, inset: 0, pad: 0 }, (ctx, s) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, s, s);
  });
}

function bake(
  scene: Phaser.Scene, t: Slice, draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): void {
  if (scene.textures.exists(t.key)) return;
  const tex = scene.textures.createCanvas(t.key, t.size, t.size);
  if (!tex) return;
  draw(tex.context, t.size);
  tex.refresh();
}

function grey(v: number): string {
  const c = Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${c},${c},${c})`;
}

/** A rounded-rectangle path (no `roundRect`: older Safari lacks it). */
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * A blurred copy of a rounded shape with the shape itself pushed off the
 * canvas: the canvas shadow is the one blur every browser bakes (Safari has
 * no `ctx.filter`), and drawing the source out of frame leaves only the halo.
 */
function softShape(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  r: number, blur: number, color: string,
): void {
  const away = 4096;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = away;
  rounded(ctx, x - away, y, w, h, r);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();
}

/**
 * The lit top edge and the darker bottom lip, clipped to the shape: a 2px
 * highlight hugging the top curve, a 1px shade along the bottom.
 */
function edgeLight(
  ctx: CanvasRenderingContext2D, w: number, h: number, r: number, light: string, shade: string,
): void {
  ctx.save();
  rounded(ctx, 0, 0, w, h, r);
  ctx.clip();
  rounded(ctx, 0, 1, w, h + 6, r);
  ctx.strokeStyle = light;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  rounded(ctx, 0, -6, w, h + 5, r);
  ctx.strokeStyle = shade;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}
