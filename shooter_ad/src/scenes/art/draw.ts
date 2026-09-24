import Phaser from 'phaser';

/**
 * One procedural texture. Every sprite in the game is drawn WHITE with its
 * details in pure BLACK: under the default multiply tint white takes the
 * runtime colour and black stays black, so eyes, seams and outlines live in
 * the one texture and a single image serves every hue. Anything that needs a
 * SECOND hue (a pale plate, a hot fuse) is a separate overlay texture.
 *
 * Textures are drawn at 2x and rendered at `setScale(0.5)`, which is what
 * keeps a 3px black seam crisp rather than a smeared grey line.
 *
 * `texture` is the flat drawing; `bake` (below) is the same drawing FINISHED
 * with light, a rim and an outline, still for the multiply tint.
 */
export function texture(
  scene: Phaser.Scene, key: string, width: number, height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

export const WHITE = 0xffffff;
export const BLACK = 0x000000;

/** Two black eyes; every creature has them. */
export function eyes(g: Phaser.GameObjects.Graphics, x1: number, x2: number, y: number, r: number): void {
  g.fillStyle(BLACK, 1);
  g.fillCircle(x1, y, r);
  g.fillCircle(x2, y, r);
}

/** A black stroked arc, for carapace seams. Angles in fractions of PI. */
export function seam(
  g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  from: number, to: number, width: number,
): void {
  g.lineStyle(width, BLACK, 1);
  g.beginPath();
  g.arc(x, y, r, from * Math.PI, to * Math.PI);
  g.strokePath();
}

// --- the finish ------------------------------------------------------------

/**
 * The transparent margin, in texture px, every baked sprite carries on each
 * side for its outline and glow. It is symmetric, so the texture's centre is
 * still the hit circle's centre and `setOrigin(0.5)` still fits the drawing to
 * the radius; only an off-centre origin (the Spitter's tube) has to add it.
 */
export const PAD = 8;

/**
 * How a white-and-black drawing is finished, once, at boot. It stays a
 * MULTIPLY texture: the lit top is pure white (the vocabulary colour
 * exactly), the underside falls to a grey (the colour in shade), the edge of
 * the silhouette darkens a little more, and a dark outline is dilated around
 * the whole shape. Black detail stays black because the finish multiplies
 * the drawing's own value.
 *
 * Why not the OVERLAY tint mode, which could light a hue brighter than
 * itself: Phaser 4.2.1's quad shader picks the tint mode with `tintMode ==
 * 5.0` on a value interpolated across the triangle, and on a ROTATED quad the
 * interpolation drifts off the integer - half the sprite then draws
 * untinted grey (measured: a turned Shielder went grey-and-black). MULTIPLY
 * is mode 0, which no interpolation error can miss. The highlight a multiply
 * tint cannot show lives instead in a small untinted GLOSS texture
 * (`<key>-gloss`, cropped, with `GLOSS_ORIGIN` pinning it to the body's
 * centre) that the renderer draws above the body.
 */
export interface Finish {
  /** The scale of the lighting, in texture px: the hit circle (2r) for a creature. */
  readonly r?: number;
  /** Dark outline dilated around the silhouette, texture px; 0 for none. */
  readonly outline?: number;
  /** Value at the unlit underside and at the light's centre (1 = the tint exactly). */
  readonly lo?: number;
  readonly hi?: number;
  /** Peak alpha of the white gloss highlight; 0 or absent for none. */
  readonly gloss?: number;
  /** Light centre as fractions of `r` from the texture centre (up is negative). */
  readonly light?: readonly [number, number];
  /** How far the silhouette's edge darkens (0 none, 0.3 strong). */
  readonly rim?: number;
  /** A constant value instead of lighting (a hot core, a glow). */
  readonly flat?: number;
  /** A soft halo of the hue around the silhouette: blur radius, texture px. */
  readonly glow?: number;
  readonly glowAlpha?: number;
  /** Hologram scanlines: every `scan` rows, the second half at `scanAlpha`. */
  readonly scan?: number;
  readonly scanAlpha?: number;
  /** Margin override, texture px. */
  readonly pad?: number;
}

/** The creature finish: a lit back, a shaded belly, a darker rim, a crisp outline, a gloss. */
export const BODY: Finish = { outline: 3, lo: 0.56, hi: 1, gloss: 0.6, rim: 0.3 };

/** Where each gloss texture's origin must sit so it rotates about its body's centre. */
export const GLOSS_ORIGIN: Record<string, { x: number; y: number }> = {};

/**
 * `texture` plus the finish: the drawing is made with `PAD` of margin, then
 * its pixels are relit once, here, at boot. Nothing about this runs per
 * frame and no runtime filter is involved.
 */
export function bake(
  scene: Phaser.Scene, key: string, width: number, height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void, finish: Finish = BODY,
): void {
  const pad = finish.pad ?? PAD;
  const W = width + pad * 2, H = height + pad * 2;
  const g = scene.add.graphics();
  g.translateCanvas(pad, pad);
  draw(g);
  g.generateTexture(key, W, H);
  g.destroy();
  const tex = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
  const canvas = tex.getSourceImage() as HTMLCanvasElement;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, W, H);
  const gloss = finishPixels(img.data, W, H, finish, Math.min(width, height) * 0.4);
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  if (gloss) glossTexture(scene, `${key}-gloss`, gloss, W, H);
}

/** A texture drawn with the 2D canvas API (gradients, soft edges). */
export function canvasTexture(
  scene: Phaser.Scene, key: string, width: number, height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): void {
  const tex = scene.textures.createCanvas(key, width, height);
  if (!tex) return;
  const ctx = tex.getContext();
  draw(ctx, width, height);
  tex.refresh();
}

/** Crops a full-box gloss alpha map to its lit pixels and records the origin. */
function glossTexture(scene: Phaser.Scene, key: string, alpha: Float32Array, W: number, H: number): void {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (alpha[y * W + x] < 0.02) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  canvasTexture(scene, key, w, h, (ctx) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = 255;
        img.data[o + 3] = Math.round(alpha[(y + y0) * W + x + x0] * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  GLOSS_ORIGIN[key] = { x: (W / 2 - x0) / w, y: (H / 2 - y0) / h };
}

// --- the atlas -------------------------------------------------------------

/** The one texture every field sprite is drawn from (`fx.ts` packs it). */
export const ATLAS = 'field-atlas';

/**
 * Copies the named textures into ONE canvas texture as frames of the same
 * names (shelf-packed, 2px apart), so every pooled sprite on the field
 * samples a single texture.
 *
 * It is a correctness fix before it is a batching win. Phaser 4.2.1's
 * multi-texture quad shader selects its sampler with `outTexDatum ==
 * float(INDEX)` on a value interpolated across the triangle; on a ROTATED
 * quad the interpolation drifts off the integer and one triangle samples
 * nothing - a turned Shielder lost its plate, then half its body, in the
 * roster stills. Unit 0 is the one index no drift can miss, and a batch
 * that begins with the atlas binds it to unit 0 (`SpriteRender` starts its
 * batches on a blend switch for that reason). The source textures stay
 * registered: the start screen still draws `body` and `head` by key.
 */
export function packAtlas(scene: Phaser.Scene, names: readonly string[], width = 1024): void {
  const items: { name: string; src: HTMLCanvasElement; x: number; y: number }[] = [];
  for (const name of names) {
    if (!scene.textures.exists(name)) continue;
    const src = scene.textures.get(name).getSourceImage() as HTMLCanvasElement;
    items.push({ name, src, x: 0, y: 0 });
  }
  items.sort((a, b) => b.src.height - a.src.height);
  const gap = 2;
  let x = gap, y = gap, row = 0;
  for (const it of items) {
    if (x + it.src.width + gap > width) { x = gap; y += row + gap; row = 0; }
    it.x = x; it.y = y;
    x += it.src.width + gap;
    row = Math.max(row, it.src.height);
  }
  const tex = scene.textures.createCanvas(ATLAS, width, y + row + gap);
  if (!tex) return;
  const ctx = tex.getContext();
  for (const it of items) {
    ctx.drawImage(it.src, it.x, it.y);
    tex.add(it.name, 0, it.x, it.y, it.src.width, it.src.height);
  }
  tex.refresh();
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Two passes of a separable box blur: close enough to a gaussian at this size. */
function blur(src: Float32Array, W: number, H: number, k: number): Float32Array {
  let a = src;
  for (let pass = 0; pass < 2; pass++) {
    const tmp = new Float32Array(W * H);
    const out = new Float32Array(W * H);
    const n = 2 * k + 1;
    for (let y = 0; y < H; y++) {
      let sum = 0;
      for (let x = 0; x <= k && x < W; x++) sum += a[y * W + x];
      for (let x = 0; x < W; x++) {
        tmp[y * W + x] = sum / n;
        const add = x + k + 1, sub = x - k;
        if (add < W) sum += a[y * W + add];
        if (sub >= 0) sum -= a[y * W + sub];
      }
    }
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (let y = 0; y <= k && y < H; y++) sum += tmp[y * W + x];
      for (let y = 0; y < H; y++) {
        out[y * W + x] = sum / n;
        const add = y + k + 1, sub = y - k;
        if (add < H) sum += tmp[add * W + x];
        if (sub >= 0) sum -= tmp[sub * W + x];
      }
    }
    a = out;
  }
  return a;
}

/** Alpha dilated by a disc of radius `r`, with a one-pixel soft edge. */
function dilate(src: Float32Array, W: number, H: number, r: number): Float32Array {
  const out = new Float32Array(W * H);
  const R = Math.ceil(r + 1);
  const offs: number[] = [];
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const w = Math.min(1, Math.max(0, r + 0.5 - Math.hypot(dx, dy)));
      if (w > 0) offs.push(dx, dy, w);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      for (let k = 0; k < offs.length; k += 3) {
        const sx = x + offs[k], sy = y + offs[k + 1];
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const v = src[sy * W + sx] * offs[k + 2];
        if (v > m) { m = v; if (m >= 1) break; }
      }
      out[y * W + x] = m;
    }
  }
  return out;
}

/** Relights `data` in place; returns the gloss alpha map when the finish asks for one. */
function finishPixels(
  data: Uint8ClampedArray, W: number, H: number, f: Finish, fallbackR: number,
): Float32Array | null {
  const N = W * H;
  const A = new Float32Array(N);
  const V = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    A[i] = data[i * 4 + 3] / 255;
    V[i] = data[i * 4] / 255;
  }
  const r = f.r ?? fallbackR;
  const lo = f.lo ?? BODY.lo!, hi = f.hi ?? BODY.hi!;
  const rim = f.rim ?? 0;
  const [lfx, lfy] = f.light ?? [-0.2, -0.45];
  const cx = W / 2, cy = H / 2;
  const lx = cx + lfx * r, ly = cy + lfy * r;
  const sx = lx - 0.12 * r, sy = ly - 0.08 * r;
  const B = rim > 0 ? blur(A, W, H, Math.max(2, Math.round(r * 0.1))) : null;
  const D = f.outline ? dilate(A, W, H, f.outline) : null;
  const G = f.glow ? blur(D ?? A, W, H, f.glow) : null;
  const glowAlpha = f.glowAlpha ?? 0.6;
  const S = f.gloss ? new Float32Array(N) : null;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let a = A[i];
      let s: number;
      if (f.flat !== undefined) {
        s = f.flat;
      } else {
        const d = Math.hypot(x - lx, y - ly) / (1.5 * r);
        const l = Math.max(0, 1 - d);
        s = lo + (hi - lo) * l * l * (3 - 2 * l);
      }
      const edge = B ? smooth(0.3, 0.85, B[i]) : 1;
      if (B) s *= 1 - rim + rim * edge;
      if (S && f.gloss) {
        // The highlight: a soft oval on the lit back, only on white body
        // pixels and away from the silhouette's edge.
        const sd = Math.hypot((x - sx) / (0.26 * r), (y - sy) / (0.17 * r));
        S[i] = smooth(1, 0.2, sd) * f.gloss * V[i] * A[i] * edge;
      }
      let v = V[i] * s;
      if (D) {
        const o = D[i];
        const na = a + o * (1 - a);
        v = na > 0 ? (v * a) / na : 0;
        a = na;
      }
      if (G) {
        const g = Math.min(1, G[i] * 1.6) * glowAlpha;
        const na = a + g * (1 - a);
        v = na > 0 ? (v * a + g * (1 - a)) / na : 0;
        a = na;
      }
      if (f.scan && y % f.scan >= f.scan / 2) a *= f.scanAlpha ?? 0.35;
      const c = Math.round(Math.min(1, Math.max(0, v)) * 255);
      data[i * 4] = c; data[i * 4 + 1] = c; data[i * 4 + 2] = c;
      data[i * 4 + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  return S;
}
