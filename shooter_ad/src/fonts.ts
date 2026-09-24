import w500 from './assets/fonts/saira-semi-condensed-latin-500-normal.woff2?url';
import w600 from './assets/fonts/saira-semi-condensed-latin-600-normal.woff2?url';
import w700 from './assets/fonts/saira-semi-condensed-latin-700-normal.woff2?url';
import w800 from './assets/fonts/saira-semi-condensed-latin-800-normal.woff2?url';

/**
 * The one face the game ships (2026-09-24, the redesign): Saira Semi
 * Condensed, OFL, latin subset, four weights of ~18KB each, bundled by Vite
 * into `dist/` - a static file beside the game, never a network fetch.
 * Condensed because a late-wave card is 75px inside and has to hold
 * `+1.84K%`; tall, open numerals because the whole game is reading three
 * numbers under time pressure. There is no italic file: the grade words ask
 * for `italic` and the browser slants the upright, which reads as intended.
 *
 * Canvas text measures with whatever font is ready at the moment a Text is
 * created, so the game must not boot until these are in `document.fonts`.
 * `loadFonts` resolves when they are, or after `timeoutMs` whatever happens -
 * a blocked or failed load falls back to the system stack in `FONT` and the
 * game still starts. It never throws and never logs (`npm run verify` fails
 * on any console error).
 */
export const FACE = 'Saira Semi Condensed';

export async function loadFonts(timeoutMs = 2500): Promise<void> {
  try {
    const faces = [
      new FontFace(FACE, `url(${w500})`, { weight: '500' }),
      new FontFace(FACE, `url(${w600})`, { weight: '600' }),
      new FontFace(FACE, `url(${w700})`, { weight: '700' }),
      new FontFace(FACE, `url(${w800})`, { weight: '800' }),
    ];
    const all = Promise.all(faces.map(async (f) => {
      try { (document.fonts as unknown as { add(f: FontFace): void }).add(await f.load()); } catch { /* fall back to the system stack */ }
    }));
    await Promise.race([all, new Promise((r) => setTimeout(r, timeoutMs))]);
  } catch { /* FontFace unsupported: the system stack it is */ }
}
