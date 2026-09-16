/**
 * Short codes that identify a match: a seed plus the mode it was played on.
 *
 * People share runs by screenshotting them, and a screenshot loses the
 * clipboard. So whatever identifies a match has to survive as pixels somebody
 * reads off a photo and types back in - which rules out a query string with a
 * ten-digit seed in it. The code is the source of truth here and the URL is
 * derived from it, not the other way round.
 *
 * Three properties, all of them about a human in the loop:
 *
 * - **Readable from a photo.** Crockford's base32 alphabet drops the glyphs
 *   that get misread - no I, L, O or U - so there is no 0/O or 1/I confusion
 *   and no accidental profanity.
 * - **Typeable.** Eight characters in groups of four, with a mode letter.
 * - **Sayable.** Short enough to read down a phone call.
 *
 * Decoding is deliberately forgiving: case-insensitive, punctuation optional,
 * and the ambiguous glyphs a person might type anyway are folded to what they
 * look like. Somebody copying from a screenshot should not be punished for
 * typing O instead of 0.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export type MatchMode = 'normal' | 'hard';

const MODE_LETTER: Record<MatchMode, string> = { normal: 'N', hard: 'H' };

export interface Match {
  readonly seed: number;
  readonly mode: MatchMode;
}

/** `7K2P-9XQ4-H`. Seven characters of seed, then the mode as its own group. */
export function encodeMatch(match: Match): string {
  let seed = match.seed >>> 0;
  let body = '';
  for (let i = 0; i < 7; i++) {
    body = ALPHABET[seed % 32] + body;
    seed = Math.floor(seed / 32);
  }
  return `${body.slice(0, 4)}-${body.slice(4)}-${MODE_LETTER[match.mode]}`;
}

/**
 * Parses a code a person typed. Returns null only when the input cannot be a
 * match code at all, so a caller can fall back to a fresh random seed.
 */
export function decodeMatch(input: string): Match | null {
  const cleaned = input
    .toUpperCase()
    // Fold the glyphs Crockford excludes onto what a person meant by them.
    .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V')
    .replace(/[^0-9A-Z]/g, '');
  if (cleaned.length < 8) return null;

  const mode: MatchMode = cleaned[cleaned.length - 1] === 'H' ? 'hard' : 'normal';
  const body = cleaned.slice(0, 7);

  let seed = 0;
  for (const ch of body) {
    const digit = ALPHABET.indexOf(ch);
    if (digit === -1) return null;
    seed = seed * 32 + digit;
  }
  return { seed: seed >>> 0, mode };
}

/** The link that opens this match, derived from the code rather than beside it. */
export function matchUrl(match: Match, origin: string): string {
  const base = origin.split('?')[0].split('#')[0];
  return `${base}?m=${encodeMatch(match).replace(/-/g, '')}`;
}

/** Reads a match out of a URL query string, if it carries one. */
export function matchFromQuery(search: string): Match | null {
  const code = new URLSearchParams(search).get('m');
  return code ? decodeMatch(code) : null;
}
