import type Phaser from 'phaser';
import { LIGHT, RADIUS, SURFACE } from '../theme';
import { PAUSE_BUTTON } from '../hud/PauseScreen';
import {
  BAND, BAR, CHIP, CHIP_BLEED, DUEL, EDGE_DEPTH, HUD_W, PANEL_H, PAUSE_BLEED, PIP,
  SHADOW_H, TITAN_BAR, TITAN_ROW,
} from '../hud/HudLayout';

/**
 * Textures for the HUD band and its feedback (2026-09-24, the highway
 * redesign): the panel with its lit bottom edge and soft shadow, the chip
 * faces, the duel well and tug bar, the pause face, the Titan's bar, the
 * stage banner's lane slab and the damage vignette. Every gradient, rounded
 * corner and shadow is drawn here ONCE on a 2D canvas and handed to Phaser as
 * a texture, so the HUD draws only Images at runtime - no Graphics redraws,
 * no filters.
 *
 * Anything that changes colour at runtime is baked WHITE and tinted (the tug
 * fill, the chip flash, the pips, the banner edges, the vignette).
 */
export function makeUi(scene: Phaser.Scene): void {
  // The rail and the strip: one panel. The strip is a darker tray the chips
  // sit up out of; a hairline parts the two rows; the bottom edge is lit in
  // the highway's own light, and a soft shadow falls onto the field.
  bake(scene, 'hud-panel', HUD_W, PANEL_H + SHADOW_H, (c) => {
    const rail = c.createLinearGradient(0, 0, 0, 72);
    rail.addColorStop(0, css(0x10101c));
    rail.addColorStop(1, css(SURFACE.panel));
    c.fillStyle = rail;
    c.fillRect(0, 0, HUD_W, 72);
    const tray = c.createLinearGradient(0, 72, 0, PANEL_H);
    tray.addColorStop(0, css(0x08080f));
    tray.addColorStop(1, css(0x0a0a13));
    c.fillStyle = tray;
    c.fillRect(0, 72, HUD_W, PANEL_H - 72);
    c.fillStyle = css(SURFACE.hairline);
    c.fillRect(0, 72, HUD_W, 1);
    litEdge(c, PANEL_H);
  });
  bake(scene, 'hud-titanrow', HUD_W, TITAN_ROW.h + SHADOW_H, (c) => {
    c.fillStyle = css(0x0a0a13);
    c.fillRect(0, 0, HUD_W, TITAN_ROW.h);
    litEdge(c, TITAN_ROW.h);
  });

  // Chip faces, one per width: raised, rounded, a top highlight, a soft
  // offset shadow. The glow is the same shape in white, for the change flash.
  for (const w of new Set<number>(CHIP.widths)) {
    const tw = w + 2 * CHIP_BLEED.x;
    const th = CHIP.h + CHIP_BLEED.top + CHIP_BLEED.bottom;
    bake(scene, `hud-chip-${w}`, tw, th, (c) => raisedFace(c, CHIP_BLEED.x, CHIP_BLEED.top, w, CHIP.h, RADIUS.chip));
    bake(scene, `hud-chipglow-${w}`, tw, th, (c) => {
      const g = c.createLinearGradient(0, CHIP_BLEED.top, 0, CHIP_BLEED.top + CHIP.h);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(1, 'rgba(255,255,255,0.25)');
      c.fillStyle = g;
      roundRect(c, CHIP_BLEED.x, CHIP_BLEED.top, w, CHIP.h, RADIUS.chip);
      c.fill();
    });
  }

  // The duel's well: inset, darker than the rail, lit along its lower lip.
  bake(scene, 'hud-duel', DUEL.w, DUEL.h, (c) => {
    c.fillStyle = css(0x06060b);
    roundRect(c, 0.5, 0.5, DUEL.w - 1, DUEL.h - 1, RADIUS.chip);
    c.fill();
    c.save();
    roundRect(c, 0.5, 0.5, DUEL.w - 1, DUEL.h - 1, RADIUS.chip);
    c.clip();
    const inner = c.createLinearGradient(0, 0, 0, 10);
    inner.addColorStop(0, 'rgba(0,0,0,0.7)');
    inner.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = inner;
    c.fillRect(0, 0, DUEL.w, 10);
    c.restore();
    c.strokeStyle = css(SURFACE.hairline, 0.9);
    c.lineWidth = 1;
    roundRect(c, 0.5, 0.5, DUEL.w - 1, DUEL.h - 1, RADIUS.chip);
    c.stroke();
    c.fillStyle = 'rgba(201,204,255,0.10)';
    c.fillRect(RADIUS.chip, DUEL.h - 1.5, DUEL.w - 2 * RADIUS.chip, 1);
  });

  // The tug bar: par's side is the track, yours the white fill (tinted to
  // the standing colour and cropped to the split).
  bake(scene, 'hud-bar-track', BAR.w, BAR.h, (c) => {
    c.fillStyle = css(0x2b2d47);
    roundRect(c, 0, 0, BAR.w, BAR.h, BAR.h / 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.fillRect(BAR.h / 2, 0, BAR.w - BAR.h, 1);
  });
  bake(scene, 'hud-bar-fill', BAR.w, BAR.h, (c) => {
    const g = c.createLinearGradient(0, 0, 0, BAR.h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#c4c7de');
    c.fillStyle = g;
    roundRect(c, 0, 0, BAR.w, BAR.h, BAR.h / 2);
    c.fill();
  });
  bake(scene, 'hud-px', 4, 4, (c) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, 4, 4); });
  // The target marker: a small downward notch over the bar, so it cannot be
  // taken for the knot that rides the split.
  bake(scene, 'hud-tick', 9, 6, (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(9, 0);
    c.lineTo(4.5, 6);
    c.closePath();
    c.fill();
  });

  // Sense pips, drawn: a lit disc with a soft halo, and an empty ring.
  bake(scene, 'hud-pip-on', PIP.size + 6, PIP.size + 6, (c) => {
    const m = (PIP.size + 6) / 2;
    const halo = c.createRadialGradient(m, m, PIP.size * 0.3, m, m, m);
    halo.addColorStop(0, 'rgba(255,255,255,0.35)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, PIP.size + 6, PIP.size + 6);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(m, m, PIP.size / 2 - 0.5, 0, Math.PI * 2);
    c.fill();
  });
  bake(scene, 'hud-pip-off', PIP.size + 6, PIP.size + 6, (c) => {
    const m = (PIP.size + 6) / 2;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(m, m, PIP.size / 2 - 1.3, 0, Math.PI * 2);
    c.stroke();
  });

  // PAUSE: a raised face at the button's exact size, the two-bar glyph baked
  // above where the word sits.
  {
    const { width: w, height: h } = PAUSE_BUTTON;
    bake(scene, 'hud-pause', w + 2 * PAUSE_BLEED.x, h + PAUSE_BLEED.top + PAUSE_BLEED.bottom, (c) => {
      raisedFace(c, PAUSE_BLEED.x, PAUSE_BLEED.top, w, h, RADIUS.button);
      c.fillStyle = css(0xb7bad8);
      const cx = PAUSE_BLEED.x + w / 2;
      const top = PAUSE_BLEED.top + 8;
      roundRect(c, cx - 5.5, top, 3.5, 11, 1);
      c.fill();
      roundRect(c, cx + 2, top, 3.5, 11, 1);
      c.fill();
    });
  }

  // The Titan's bar: a dark track and a lavender-to-purple fill, cropped to HP.
  bake(scene, 'hud-titan-track', TITAN_BAR.w, TITAN_BAR.h, (c) => {
    c.fillStyle = css(0x1d1530);
    roundRect(c, 0, 0, TITAN_BAR.w, TITAN_BAR.h, TITAN_BAR.h / 2);
    c.fill();
  });
  bake(scene, 'hud-titan-fill', TITAN_BAR.w, TITAN_BAR.h, (c) => {
    const g = c.createLinearGradient(0, 0, 0, TITAN_BAR.h);
    g.addColorStop(0, '#d7a6ff');
    g.addColorStop(0.45, '#9b4fd0');
    g.addColorStop(1, '#5e2380');
    c.fillStyle = g;
    roundRect(c, 0, 0, TITAN_BAR.w, TITAN_BAR.h, TITAN_BAR.h / 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fillRect(TITAN_BAR.h / 2, 1, TITAN_BAR.w - TITAN_BAR.h, 1);
  });

  // The stage banner's lane slab: a near-black body with white lit edges
  // (tinted per banner) and a faint wash off each edge. Three abut.
  bake(scene, 'hud-band', BAND.lane, BAND.h, (c) => {
    const body = c.createLinearGradient(0, 0, 0, BAND.h);
    body.addColorStop(0, 'rgba(12,12,22,0.94)');
    body.addColorStop(0.5, 'rgba(7,7,13,0.94)');
    body.addColorStop(1, 'rgba(12,12,22,0.94)');
    c.fillStyle = body;
    c.fillRect(0, 0, BAND.lane, BAND.h);
    for (const [y0, y1] of [[0, 18], [BAND.h, BAND.h - 18]] as const) {
      const wash = c.createLinearGradient(0, y0, 0, y1);
      wash.addColorStop(0, 'rgba(255,255,255,0.22)');
      wash.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = wash;
      c.fillRect(0, Math.min(y0, y1), BAND.lane, 18);
    }
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, BAND.lane, 2);
    c.fillRect(0, BAND.h - 2, BAND.lane, 2);
    // The lane seam: where two slabs meet, the highway's divider shows through.
    c.fillStyle = 'rgba(255,255,255,0.16)';
    c.fillRect(0, 2, 1, BAND.h - 4);
  });

  // The damage vignette: one soft falloff, baked in both orientations and
  // stretched along each edge. Tinted breach red / fire orange at runtime.
  bake(scene, 'hud-edge-v', 4, EDGE_DEPTH, (c) => {
    for (let y = 0; y < EDGE_DEPTH; y++) {
      const t = 1 - y / EDGE_DEPTH;
      c.fillStyle = `rgba(255,255,255,${Math.pow(t, 1.7).toFixed(4)})`;
      c.fillRect(0, y, 4, 1);
    }
  });
  bake(scene, 'hud-edge-h', EDGE_DEPTH, 4, (c) => {
    for (let x = 0; x < EDGE_DEPTH; x++) {
      const t = 1 - x / EDGE_DEPTH;
      c.fillStyle = `rgba(255,255,255,${Math.pow(t, 1.7).toFixed(4)})`;
      c.fillRect(x, 0, 1, 4);
    }
  });
}

/** A lit 1px lower edge at `y`, and a soft shadow falling below it. */
function litEdge(c: CanvasRenderingContext2D, y: number): void {
  c.fillStyle = css(LIGHT.rail, 0.2);
  c.fillRect(0, y - 1, HUD_W, 1);
  const shadow = c.createLinearGradient(0, y, 0, y + SHADOW_H);
  shadow.addColorStop(0, 'rgba(0,0,0,0.6)');
  shadow.addColorStop(0.4, 'rgba(0,0,0,0.25)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = shadow;
  c.fillRect(0, y, HUD_W, SHADOW_H);
}

/** A raised rounded face with a soft offset drop shadow and a lit top edge. */
function raisedFace(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.75)';
  c.shadowBlur = 6;
  c.shadowOffsetY = 2;
  c.fillStyle = css(SURFACE.raised);
  roundRect(c, x, y, w, h, r);
  c.fill();
  c.restore();
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, css(0x1c1d31));
  g.addColorStop(1, css(0x121321));
  c.fillStyle = g;
  roundRect(c, x, y, w, h, r);
  c.fill();
  c.strokeStyle = css(SURFACE.hairline);
  c.lineWidth = 1;
  roundRect(c, x + 0.5, y + 0.5, w - 1, h - 1, r);
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.09)';
  c.fillRect(x + r, y + 1, w - 2 * r, 1);
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function css(color: number, alpha = 1): string {
  return `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
}

/** Draw once on a 2D canvas and register it as a texture. */
function bake(
  scene: Phaser.Scene, key: string, w: number, h: number,
  draw: (c: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w);
  canvas.height = Math.ceil(h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  draw(ctx);
  scene.textures.addCanvas(key, canvas);
}
