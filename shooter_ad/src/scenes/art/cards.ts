import type Phaser from 'phaser';
import { ARENA, GATES, HUD_ROWS, VIEW } from '../../config';
import { LIGHT, RADIUS } from '../theme';

/**
 * Textures for the highway: the beat line, the notes (gate
 * cards) and their states, the receptors on the judgment line, and the
 * judgment burst. Owned by the field workstream of the 2026-09-24 redesign;
 * called once from `BootScene`.
 *
 * Every glow, gradient, shadow and rounded corner on a moving thing is baked
 * HERE, once, into a canvas texture - nothing on the field runs a filter or
 * redraws a Graphics path per frame. Canvas 2D is used rather than `Graphics#generateTexture`
 * because it has real gradients and `shadowBlur`, which is what a baked glow
 * is. Textures are 1x: the game canvas is 540x960 and so is the backing store.
 *
 * Shapes that the renderer tints are drawn in white and greys (a luminance
 * ramp), so one texture serves every axis, grade and rank colour.
 *
 * Keys are prefixed `hw-` so they cannot collide with another workstream's.
 */
export const HW = {
  beat: 'hw-beat',
  note: 'hw-note',
  noteShadow: 'hw-note-shadow',
  noteGlow: 'hw-note-glow',
  noteRim: 'hw-note-rim',
  noteEdge: 'hw-note-edge',
  noteFill: 'hw-note-fill',
  groove: 'hw-groove',
  opMult: 'hw-op-mult',
  opAdd: 'hw-op-add',
  crown: 'hw-crown',
  recBar: 'hw-rec-bar',
  recCapL: 'hw-rec-cap-l',
  recCapR: 'hw-rec-cap-r',
  recCapCoreL: 'hw-rec-cap-core-l',
  recCapCoreR: 'hw-rec-cap-core-r',
  leader: 'hw-leader',
  leaderCore: 'hw-leader-core',
  chevron: 'hw-chevron',
  chevronCore: 'hw-chevron-core',
  tick: 'hw-tick',
  ring: 'hw-ring',
  spark: 'hw-spark',
  failFlash: 'hw-fail-flash',
} as const;

/**
 * The note textures' geometry, which the renderer needs for NineSlice
 * slices. A note is 3-sliced horizontally (its height is always
 * `GATES.height`), so width changes stretch only the flat middle column.
 */
export const NOTE = {
  /** Source width of the body, rim, edge, fill and groove textures. */
  width: 40,
  /** Left / right slice of those textures: the rounded corner lives inside. */
  slice: 12,
  /** Padding around the shadow and glow textures, for the blur to fall off in. */
  pad: 16,
  /** The lit cap along the top edge (the note head), px. */
  cap: 10,
} as const;

/** Where the road's regions begin, shared with the renderer. */
export const ROAD = {
  /** The spawn line: the HUD covers everything above it. */
  top: HUD_ROWS.bottom,
  /** A full ring's front rank: the ground band (contact) starts here. */
  ground: ARENA.laneY - 60,
  judgment: ARENA.laneY,
  fail: ARENA.breachY,
  lane: VIEW.width / 3,
} as const;

export function makeCards(scene: Phaser.Scene): void {
  makeBeat(scene);
  makeNotes(scene);
  makeMarks(scene);
  makeBurst(scene);
}

// --- helpers -----------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const c = tex.context;
  c.clearRect(0, 0, w, h);
  draw(c);
  tex.refresh();
}

function rgba(color: number, a: number): string {
  return `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${a})`;
}

/** A grey of luminance `v` (0..1): the ramp a tint multiplies. */
function grey(v: number, a = 1): string {
  const n = Math.round(v * 255);
  return `rgba(${n},${n},${n},${a})`;
}

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.arcTo(x + w, y, x + w, y + rr, rr);
  c.lineTo(x + w, y + h - rr);
  c.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  c.lineTo(x + rr, y + h);
  c.arcTo(x, y + h, x, y + h - rr, rr);
  c.lineTo(x, y + rr);
  c.arcTo(x, y, x + rr, y, rr);
  c.closePath();
}

// --- the road ----------------------------------------------------------------
//
// The static road itself is NOT a texture: `render/Highway` draws it as
// vertex-coloured rects. A full-screen textured quad measured ~25% slower
// frames under `npm run perf` than the flat fills it replaced (SwiftShader
// rasterises on the CPU, and a texture fetch on 518k fragments is the cost);
// vertex colours carry the same gradients with no fetch and no stacked fills.

/**
 * One beat line: three lane-long segments with soft ends and a 1px core, a
 * gap at each divider. White; the renderer tints it the rail light.
 */
function makeBeat(scene: Phaser.Scene): void {
  const W = VIEW.width;
  const lane = ROAD.lane;
  canvas(scene, HW.beat, W, 9, (c) => {
    const rows = [[2, 0.1], [3, 0.35], [4, 1], [5, 0.35], [6, 0.1]] as const;
    for (let i = 0; i < 3; i++) {
      const x0 = i * lane + 12;
      const x1 = (i + 1) * lane - 12;
      const g = c.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.18, 'rgba(255,255,255,1)');
      g.addColorStop(0.82, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      for (const [y, a] of rows) {
        c.globalAlpha = a;
        c.fillRect(x0, y, x1 - x0, 1);
      }
    }
    c.globalAlpha = 1;
  });
}

// --- the notes ---------------------------------------------------------------

function makeNotes(scene: Phaser.Scene): void {
  const w = NOTE.width;
  const h = GATES.height;
  const r = RADIUS.card;
  const { pad, cap } = NOTE;

  // The body: a luminance ramp the axis colour multiplies. A bright cap (the
  // note head), a 1px seam under it, the body falling from 0.62 to 0.34, a
  // 1px inner highlight and a crisp edge.
  canvas(scene, HW.note, w, h, (c) => {
    c.save();
    roundRect(c, 0, 0, w, h, r);
    c.clip();
    const body = c.createLinearGradient(0, cap, 0, h);
    body.addColorStop(0, grey(0.58));
    body.addColorStop(1, grey(0.3));
    c.fillStyle = body;
    c.fillRect(0, 0, w, h);
    const head = c.createLinearGradient(0, 0, 0, cap);
    head.addColorStop(0, grey(1));
    head.addColorStop(1, grey(0.92));
    c.fillStyle = head;
    c.fillRect(0, 0, w, cap);
    c.fillStyle = grey(0.24);
    c.fillRect(0, cap, w, 1);
    // A faint lift just under the seam: light off the cap.
    const lift = c.createLinearGradient(0, cap + 1, 0, cap + 10);
    lift.addColorStop(0, grey(1, 0.14));
    lift.addColorStop(1, grey(1, 0));
    c.fillStyle = lift;
    c.fillRect(0, cap + 1, w, 9);
    c.restore();
    c.lineWidth = 1;
    c.strokeStyle = grey(0.9, 0.45);
    roundRect(c, 1.5, 1.5, w - 3, h - 3, r - 1.5);
    c.stroke();
    c.strokeStyle = grey(0.95, 1);
    roundRect(c, 0.5, 0.5, w - 1, h - 1, r - 0.5);
    c.stroke();
  });

  // The soft offset drop shadow: black, blurred, drawn under the body.
  canvas(scene, HW.noteShadow, w + pad * 2, h + pad * 2, (c) => {
    c.shadowColor = 'rgba(0,0,0,1)';
    c.shadowBlur = 11;
    c.fillStyle = 'rgba(0,0,0,0.9)';
    roundRect(c, pad, pad, w, h, r);
    c.fill();
  });

  // The target's breathing glow: the same blur in white, tinted and added.
  canvas(scene, HW.noteGlow, w + pad * 2, h + pad * 2, (c) => {
    c.shadowColor = 'rgba(255,255,255,1)';
    c.shadowBlur = 10;
    c.fillStyle = 'rgba(255,255,255,0.8)';
    roundRect(c, pad, pad, w, h, r);
    c.fill();
  });

  // The target's white inner rim, inset from the edge.
  canvas(scene, HW.noteRim, w, h, (c) => {
    c.lineWidth = 1.5;
    c.strokeStyle = '#ffffff';
    roundRect(c, 3.25, 3.25, w - 6.5, h - 6.5, r - 3);
    c.stroke();
  });

  // The SENSE mark's white edge, ON the card's edge (never outside it).
  canvas(scene, HW.noteEdge, w, h, (c) => {
    c.lineWidth = 2.5;
    c.strokeStyle = '#ffffff';
    roundRect(c, 1.25, 1.25, w - 2.5, h - 2.5, r - 1);
    c.stroke();
  });

  // A solid note, for the judgment burst's flash.
  canvas(scene, HW.noteFill, w, h, (c) => {
    c.fillStyle = '#ffffff';
    roundRect(c, 0, 0, w, h, r);
    c.fill();
  });

  // The sway groove: a recessed channel in the lane, a faint rail through its
  // middle and a lit stop at each limit. Furniture: no axis colour, no white.
  canvas(scene, HW.groove, w, h, (c) => {
    c.save();
    roundRect(c, 0, 0, w, h, r + 1);
    c.clip();
    c.fillStyle = 'rgba(0,0,0,0.34)';
    c.fillRect(0, 0, w, h);
    const inner = c.createLinearGradient(0, 0, 0, 12);
    inner.addColorStop(0, 'rgba(0,0,0,0.35)');
    inner.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = inner;
    c.fillRect(0, 0, w, 12);
    c.restore();
    c.lineWidth = 1;
    c.strokeStyle = rgba(LIGHT.rail, 0.12);
    roundRect(c, 0.5, 0.5, w - 1, h - 1, r + 0.5);
    c.stroke();
    c.fillStyle = rgba(LIGHT.rail, 0.2);
    c.fillRect(0, h / 2 - 0.5, w, 1);
    c.fillStyle = rgba(LIGHT.rail, 0.5);
    roundRect(c, 3, 22, 3, h - 44, 1.5);
    c.fill();
    roundRect(c, w - 6, 22, 3, h - 44, 1.5);
    c.fill();
  });

  // The operator glyphs, drawn rather than typed: Saira's `×` is x-height
  // small and reads as a speck beside a 26px figure. Both are the same bold
  // weight and size, white with a dark keyline, so the FORM reads by shape
  // and never by colour.
  const glyph = (key: string, angle: number, arm: number) => canvas(scene, key, 24, 24, (c) => {
    c.translate(12, 12);
    c.rotate(angle);
    c.lineCap = 'round';
    for (const [width, style] of [[8, 'rgba(7,7,13,0.9)'], [4.2, '#ffffff']] as const) {
      c.lineWidth = width;
      c.strokeStyle = style;
      c.beginPath();
      c.moveTo(-arm / 2, 0); c.lineTo(arm / 2, 0);
      c.moveTo(0, -arm / 2); c.lineTo(0, arm / 2);
      c.stroke();
    }
  });
  glyph(HW.opAdd, 0, 15);
  glyph(HW.opMult, Math.PI / 4, 16);
}

// --- marks on and around the notes ------------------------------------------

function makeMarks(scene: Phaser.Scene): void {
  // The SENSE crown: a white pill with a notch pointing down at the note head.
  canvas(scene, HW.crown, 84, 36, (c) => {
    c.shadowColor = 'rgba(255,255,255,0.7)';
    c.shadowBlur = 5;
    c.fillStyle = '#ffffff';
    roundRect(c, 4, 4, 76, 21, 10.5);
    c.fill();
    c.beginPath();
    c.moveTo(34, 24); c.lineTo(50, 24); c.lineTo(42, 32);
    c.closePath();
    c.fill();
  });

  // The receptor bar: the target's footprint on the judgment line. A 2px core
  // in a soft vertical glow, 3-sliced so it takes any card width.
  canvas(scene, HW.recBar, 40, 28, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 28);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 40, 28);
    c.fillStyle = '#ffffff';
    c.fillRect(0, 12, 40, 4);
  });

  // Receptor end caps: a bracket at each edge of the footprint, standing on
  // the line, with a foot pointing inward along it. Left and right.
  // These three stand on top of the squad, whose shirts can be any rank
  // colour - including Gold, the same hue as the RATE axis - so each is TWO
  // textures: a dark keyline under a broad stroke baked white and tinted the
  // axis colour (`...`), and an untinted white core line down its middle
  // (`...Core`). The white core reads on every shirt; the coloured edge says
  // which axis; the keyline parts both from the road.
  const KEY = 'rgba(7,7,13,0.9)';
  const pair = (
    edgeKey: string, coreKey: string, w: number, h: number,
    path: (c: Ctx) => void, glow: number,
  ): void => {
    canvas(scene, edgeKey, w, h, (c) => {
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = KEY;
      c.lineWidth = 8;
      path(c);
      c.shadowColor = 'rgba(255,255,255,0.9)';
      c.shadowBlur = glow;
      c.strokeStyle = '#ffffff';
      c.lineWidth = 4.6;
      path(c);
    });
    canvas(scene, coreKey, w, h, (c) => {
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.7;
      path(c);
    });
  };
  const bracket = (flip: boolean) => (c: Ctx): void => {
    c.save();
    if (flip) { c.translate(24, 0); c.scale(-1, 1); }
    c.beginPath();
    c.moveTo(7.5, 7); c.lineTo(7.5, 37);
    c.moveTo(7.5, 22); c.lineTo(18, 22);
    c.stroke();
    c.restore();
  };
  pair(HW.recCapL, HW.recCapCoreL, 24, 44, bracket(false), 5);
  pair(HW.recCapR, HW.recCapCoreR, 24, 44, bracket(true), 5);

  // The leader's mark: a lit ring round the unit that selects.
  pair(HW.leader, HW.leaderCore, 60, 60, (c) => {
    c.beginPath();
    c.arc(30, 30, 19, 0, Math.PI * 2);
    c.stroke();
  }, 6);

  // A chevron over the leader's head, pointing up the lane at the note.
  pair(HW.chevron, HW.chevronCore, 28, 20, (c) => {
    c.beginPath();
    c.moveTo(5, 15); c.lineTo(14, 6); c.lineTo(23, 15);
    c.stroke();
  }, 4);

  // The breach tick: a short bar standing on the fail line, with glow.
  canvas(scene, HW.tick, 14, 22, (c) => {
    c.shadowColor = 'rgba(255,255,255,0.9)';
    c.shadowBlur = 4;
    c.fillStyle = '#ffffff';
    roundRect(c, 5.5, 6, 3, 16, 1.5);
    c.fill();
  });

  // The fail line's flash when a Titan lands: a band of red light.
  canvas(scene, HW.failFlash, VIEW.width, 48, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 48);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.83, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, VIEW.width, 48);
  });
}

// --- the judgment burst ------------------------------------------------------

function makeBurst(scene: Phaser.Scene): void {
  // The expanding ring: a lit circle with a soft halo, tinted the grade.
  canvas(scene, HW.ring, 132, 132, (c) => {
    c.shadowColor = 'rgba(255,255,255,1)';
    c.shadowBlur = 9;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(66, 66, 54, 0, Math.PI * 2);
    c.stroke();
  });
  // A spark: a short streak, hot at its head.
  canvas(scene, HW.spark, 22, 8, (c) => {
    const g = c.createLinearGradient(1, 0, 21, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.shadowColor = 'rgba(255,255,255,0.9)';
    c.shadowBlur = 3;
    c.fillStyle = g;
    roundRect(c, 1, 2.5, 20, 3, 1.5);
    c.fill();
  });
}
