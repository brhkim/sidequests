import type Phaser from 'phaser';
import { SQUAD } from '../../config';
import { CREATURE_ART, FALLBACK_ART } from './creatures';
import { canvasTexture, packAtlas } from './draw';

/**
 * Textures for effects on the field: contact shadows, glows, rings, the
 * health bar and the SHIELD's arc segments. Owned by the sprites workstream
 * of the 2026-09-24 redesign; called once from `BootScene`. Everything soft
 * is baked here with the 2D canvas once - nothing on the field uses a
 * runtime filter or post-processing.
 *
 * Everything tinted is drawn white-to-grey for the multiply tint: white is
 * the tint exactly, grey is it in shade. The shadow and the bar backing are drawn in
 * their final colour and are never tinted.
 */

/** The SHIELD ring's radius around the leader, screen px (`SQUAD.unitSpacing` x 2.6). */
export const SHIELD_RADIUS = SQUAD.unitSpacing * 2.6;
/** Radians left dark between two segments. */
export const SHIELD_GAP = 0.16;
/** Pool capacities a segment texture is baked for: `blocksPerLevel` x levels 1-3. */
export const SHIELD_CAPACITIES = [2, 4, 6] as const;
/** Where the ring's centre sits inside a segment texture, as an origin. */
export const shieldOrigin: Record<number, { x: number; y: number }> = {};

const SHIELD_MARGIN = 8;

export function makeFx(scene: Phaser.Scene): void {
  // Contact shadow: a soft dark ellipse, 2:1, scaled per body by its radius.
  canvasTexture(scene, 'fx-shadow', 64, 32, (ctx, w, h) => {
    ctx.save();
    ctx.scale(1, h / w);
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.9)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.62)');
    g.addColorStop(0.8, 'rgba(0,0,0,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
    ctx.restore();
  });

  // A soft glow: white-hot centre falling to the tint, then to nothing.
  canvasTexture(scene, 'fx-glow', 64, 64, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });

  // A ring for kill pops and the block ping: hot core line inside a soft band.
  canvasTexture(scene, 'fx-ring', 128, 128, (ctx, w) => {
    const c = w / 2, r = 52;
    const strokes: [number, string][] = [
      [18, 'rgba(255,255,255,0.12)'], [11, 'rgba(255,255,255,0.3)'],
      [6, 'rgba(205,205,205,0.8)'], [2.5, 'rgba(255,255,255,1)'],
    ];
    for (const [width, style] of strokes) {
      ctx.lineWidth = width;
      ctx.strokeStyle = style;
      ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
    }
  });

  // An ordinary kill's ring: the hot core line and one narrow halo, no wide
  // soft band. The full `fx-ring` above, grown to 4x a body and held, read
  // as a reticle left behind in an empty lane; this one is a quick pulse.
  canvasTexture(scene, 'fx-ring-kill', 64, 64, (ctx, w) => {
    const c = w / 2, r = 26;
    const strokes: [number, string][] = [[6, 'rgba(255,255,255,0.22)'], [2.5, 'rgba(255,255,255,1)']];
    for (const [width, style] of strokes) {
      ctx.lineWidth = width;
      ctx.strokeStyle = style;
      ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
    }
  });

  // The contact puff: a lumpy soft cloud at the tint's own value.
  canvasTexture(scene, 'fx-puff', 64, 64, (ctx) => {
    const lumps: [number, number, number][] = [[32, 34, 20], [22, 28, 13], [42, 27, 14], [26, 42, 12], [41, 42, 12]];
    for (const [x, y, r] of lumps) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });

  // Health bar: a rounded fill (tinted, white top edge for a lit look) and
  // its dark backing, both at 2x. The fill is 32x5 on screen, the backing
  // 1.5px larger on every side; both are scaled on x to the body's width.
  canvasTexture(scene, 'fx-bar', 64, 10, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#f2f2f2');
    g.addColorStop(1, '#b8b8b8');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(0, 0, w, h, h / 2); ctx.fill();
  });
  canvasTexture(scene, 'fx-bar-back', 70, 16, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(3,3,8,0.88)';
    ctx.beginPath(); ctx.roundRect(0, 0, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(0.75, 0.75, w - 1.5, h - 1.5, h / 2 - 0.75); ctx.stroke();
  });

  // SHIELD segments, one texture per pool capacity: an arc of the ring
  // centred straight UP, with a hot core line in a soft band. The ring's
  // centre sits outside the texture box (`shieldOrigin`), so a segment is
  // rotated about the leader without a mostly-empty full-ring texture.
  for (const cap of SHIELD_CAPACITIES) {
    const half = Math.PI / cap - SHIELD_GAP / 2;
    const R = SHIELD_RADIUS;
    const m = SHIELD_MARGIN;
    const w = Math.ceil(2 * (R * Math.sin(half) + m));
    const h = Math.ceil(R - R * Math.cos(half) + 2 * m);
    const cx = w / 2, cy = R + m;
    shieldOrigin[cap] = { x: 0.5, y: cy / h };
    canvasTexture(scene, `fx-shield-${cap}`, w, h, (ctx) => {
      ctx.lineCap = 'round';
      const strokes: [number, string][] = [
        [12, 'rgba(255,255,255,0.14)'], [7, 'rgba(255,255,255,0.4)'],
        [4, 'rgba(200,200,200,1)'], [1.5, 'rgba(255,255,255,1)'],
      ];
      for (const [width, style] of strokes) {
        ctx.lineWidth = width;
        ctx.strokeStyle = style;
        ctx.beginPath();
        ctx.arc(cx, cy, R, -Math.PI / 2 - half + 0.04, -Math.PI / 2 + half - 0.04);
        ctx.stroke();
      }
    });
  }
  packAtlas(scene, fieldFrames());
}

/**
 * Every texture the field draws, by name: the frames of the atlas. The
 * creature table supplies its own; a missing name (a creature with no
 * gloss) is skipped by the packer.
 */
function fieldFrames(): string[] {
  const names: string[] = [];
  for (const art of [...Object.values(CREATURE_ART), FALLBACK_ART]) {
    names.push(art.body, `${art.body}-gloss`);
    if (art.accent) names.push(art.accent);
  }
  names.push(
    'cage', 'cage-inmates', 'bullet-streak', 'ebullet', 'eshell', 'shard',
    'body', 'head', 'head-lead', 'sq-holo-body', 'sq-holo-head', 'sq-holo-head-lead',
    'fx-shadow', 'fx-glow', 'fx-ring', 'fx-ring-kill', 'fx-puff', 'fx-bar', 'fx-bar-back',
  );
  for (const cap of SHIELD_CAPACITIES) names.push(`fx-shield-${cap}`);
  return names;
}
