import Phaser from 'phaser';
import { VIEW } from '../../config';
import { gateSpeed, type Upgrades } from '../../systems/Progression';
import { HW, ROAD } from '../art/cards';
import { RAIL_HEIGHT } from '../hud/TopRail';
import { LIGHT, SURFACE } from '../theme';

/** Px between beat lines. Fixed on the road, so a faster descent is more beats a second. */
const BEAT = 96;
/** Every fourth beat is a bar line, a step brighter. */
const BAR = 4;
const BEAT_ALPHA = 0.13;
const BAR_ALPHA = 0.26;
/** Beat lines fade in under the HUD edge and out before the ground band. */
const FADE_IN = 70;
const FADE_OUT = 90;
/** Enough pooled lines to cover the road at any phase. */
const LINES = Math.ceil((ROAD.ground - ROAD.top) / BEAT) + 1;

/** The road's light, as shares mixed into a bed colour. */
const SHEEN = 0.018;
const VIGNETTE = { width: 30, share: 0.55 };
const DIVIDER = { glow: 0.075, core: 0.34, halfWidth: 9, farShare: 0.3, bandShare: 0.55 };

/**
 * The road itself: the static highway (depth 0), the beat lines that stream
 * down the lanes at the live gate speed (depth 1), and the rail's opaque
 * backing (depth 30) that the offers slide in under.
 *
 * The static road is ONE Graphics of vertex-coloured rects, built once: three
 * lane beds (the centre one lighter) with a soft sheen down each, a calm
 * top-to-bottom tonal gradient, two lit dividers, the ground band (the end of
 * the highway, where contact happens), the white-hot judgment line, the red
 * fail line glowing up the band, and dark ground below. Every gradient is a
 * per-corner colour, so the beds are drawn once with no stacked fills and no
 * texture fetch - see `art/cards.ts` for why it is not a baked image.
 *
 * The beat lines are the tempo made visible. Their offset is integrated from
 * the SIMULATED clock - `offset += speed * (elapsed - last)` - with the speed
 * `Gates.update` uses (`gateSpeed(enemies.wave.index, upgrades)`), so they
 * stop on pause, rise smoothly when a wave raises the speed or `+TIME` slows
 * it, and restart with the run. Rendering only: nothing here is read back.
 */
export class Highway {
  private readonly lines: Phaser.GameObjects.Image[] = [];
  private offset = 0;
  private last = 0;

  constructor(scene: Phaser.Scene) {
    drawRoad(scene.add.graphics().setDepth(0));
    for (let i = 0; i < LINES; i++) {
      this.lines.push(scene.add.image(VIEW.width / 2, 0, HW.beat)
        .setDepth(1).setTint(LIGHT.rail).setVisible(false));
    }
    // Opaque: nothing on the field needs to show through the rail, and the
    // offers are revealed below it.
    scene.add.rectangle(0, 0, VIEW.width, RAIL_HEIGHT, SURFACE.panel, 1).setOrigin(0, 0).setDepth(30);
  }

  update(elapsed: number, wave: number, upgrades: Upgrades): void {
    const dt = elapsed - this.last;
    this.last = elapsed;
    // A restart (elapsed back to 0) or a jump is not travel.
    if (dt > 0 && dt < 1) this.offset = (this.offset + gateSpeed(wave, upgrades) * dt) % (BEAT * BAR * 64);
    const phase = this.offset % BEAT;
    const base = Math.floor(this.offset / BEAT);
    for (let k = 0; k < this.lines.length; k++) {
      const line = this.lines[k];
      const y = ROAD.top + phase + (k - 1) * BEAT;
      const a = Math.min(
        Phaser.Math.Clamp((y - ROAD.top) / FADE_IN, 0, 1),
        Phaser.Math.Clamp((ROAD.ground - y) / FADE_OUT, 0, 1),
      );
      if (a <= 0) { line.setVisible(false); continue; }
      const bar = (base - k + 1) % BAR === 0;
      line.setVisible(true).setY(y).setAlpha(a * (bar ? BAR_ALPHA : BEAT_ALPHA));
    }
  }

  reset(): void {
    this.offset = 0;
    this.last = 0;
  }
}

// --- the static road ---------------------------------------------------------

function mix(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t;
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** Vertical breakpoints of the lane beds: the tonal gradient is linear between them. */
const FAR_MID = ROAD.top + 0.45 * (ROAD.ground - ROAD.top);
const NEAR_FROM = ROAD.top + 260;

/** The far end sinks toward the void: 0.62 at the spawn line, 0.12 at 45%, 0 at the band. */
function far(y: number): number {
  if (y <= FAR_MID) return 0.62 + (0.12 - 0.62) * (y - ROAD.top) / (FAR_MID - ROAD.top);
  return Math.max(0, 0.12 * (1 - (y - FAR_MID) / (ROAD.ground - FAR_MID)));
}

/** The near end lifts a little toward the line's light. */
function near(y: number): number {
  return y <= NEAR_FROM ? 0 : 0.03 * (y - NEAR_FROM) / (ROAD.ground - NEAR_FROM);
}

/** A bed's colour at (x, y); `band` is the ground band, which has no tonal gradient. */
function bed(x: number, y: number, band: boolean): number {
  const i = Math.min(2, Math.max(0, Math.floor(x / ROAD.lane)));
  let c: number = i === 1 ? SURFACE.laneCentre : SURFACE.lane;
  const u = (x - i * ROAD.lane) / ROAD.lane;
  c = mix(c, LIGHT.rail, SHEEN * (1 - Math.abs(2 * u - 1)));
  if (band) {
    c = mix(c, LIGHT.rail, 0.03);
  } else {
    c = mix(c, SURFACE.void, far(y));
    c = mix(c, LIGHT.rail, near(y));
  }
  const edge = Math.min(x, VIEW.width - x);
  if (edge < VIGNETTE.width) c = mix(c, SURFACE.void, VIGNETTE.share * (1 - edge / VIGNETTE.width));
  return c;
}

function drawRoad(g: Phaser.GameObjects.Graphics): void {
  const W = VIEW.width;
  const H = VIEW.height;
  const { top, ground, judgment, fail, lane } = ROAD;
  const rect = (x0: number, y0: number, x1: number, y1: number,
    tl: number, tr: number, bl: number, br: number,
    atl = 1, atr = 1, abl = 1, abr = 1): void => {
    g.fillGradientStyle(tl, tr, bl, br, atl, atr, abl, abr);
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
  };
  const flat = (x0: number, y0: number, x1: number, y1: number, c: number, a = 1): void => {
    rect(x0, y0, x1, y1, c, c, c, c, a, a, a, a);
  };
  // A band whose colour is fixed and whose alpha runs top to bottom.
  const fade = (x0: number, y0: number, x1: number, y1: number, c: number, aTop: number, aBottom: number): void => {
    rect(x0, y0, x1, y1, c, c, c, c, aTop, aTop, aBottom, aBottom);
  };

  // The beds: every column break where the sheen or the vignette bends, every
  // row break where the tonal gradient does. Opaque, drawn once each.
  const xs = [0, VIGNETTE.width, lane / 2, lane, lane * 1.5, lane * 2, lane * 2.5, W - VIGNETTE.width, W];
  // Sample a hair inside each column so a divider's x resolves to its own lane.
  const at = (x: number, from: number): number => (x === from ? x + 1e-3 : x - 1e-3);
  const road = [top, NEAR_FROM, FAR_MID, ground];
  for (let c = 0; c < xs.length - 1; c++) {
    const x0 = xs[c];
    const x1 = xs[c + 1];
    const l = at(x0, x0);
    const r = at(x1, x0);
    for (let k = 0; k < road.length - 1; k++) {
      const y0 = road[k];
      const y1 = road[k + 1];
      rect(x0, y0, x1, y1, bed(l, y0, false), bed(r, y0, false), bed(l, y1, false), bed(r, y1, false));
    }
    rect(x0, ground, x1, fail, bed(l, ground, true), bed(r, ground, true), bed(l, fail, true), bed(r, fail, true));
  }

  // The ground band's lit lip and hairline.
  fade(0, ground, W, ground + 14, LIGHT.rail, 0.07, 0);
  flat(0, ground, W, ground + 1, LIGHT.rail, 0.2);

  // Dividers: a crisp core in a soft glow, fading toward the far end so the
  // road recedes, quieter across the ground band.
  const { halfWidth: hw, glow, core, farShare, bandShare } = DIVIDER;
  for (const x of [lane, lane * 2]) {
    for (const [y0, y1, k0, k1] of [[top, ground, farShare, 1], [ground, fail, bandShare, bandShare]] as const) {
      const c = LIGHT.rail;
      rect(x - hw, y0, x, y1, c, c, c, c, 0, glow * k0, 0, glow * k1);
      rect(x, y0, x + hw, y1, c, c, c, c, glow * k0, 0, glow * k1, 0);
      fade(x - 0.75, y0, x + 0.75, y1, c, core * k0, core * k1);
    }
  }

  // The judgment line: white-hot core, soft glow both ways.
  fade(0, judgment - 18, W, judgment, LIGHT.judgment, 0, 0.13);
  fade(0, judgment, W, judgment + 18, LIGHT.judgment, 0.13, 0);
  flat(0, judgment - 2, W, judgment + 2, LIGHT.judgment, 0.22);
  flat(0, judgment - 1, W, judgment + 1, LIGHT.judgment, 0.58);

  // Below the fail line: dark ground for the thumb.
  rect(0, fail, W, H, 0x0a0a12, 0x0a0a12, 0x050509, 0x050509);

  // The fail line: the one warm light on the road, glowing up the band.
  fade(0, fail - 40, W, fail - 12, LIGHT.fail, 0, 0.07);
  fade(0, fail - 12, W, fail, LIGHT.fail, 0.07, 0.26);
  fade(0, fail, W, fail + 8, LIGHT.fail, 0.22, 0);
  flat(0, fail - 1, W, fail + 1, LIGHT.fail, 0.95);
}
