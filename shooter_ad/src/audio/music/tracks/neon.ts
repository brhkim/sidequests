/**
 * NEON LANES - synthwave, 100 BPM, A minor. The home track: octave bass,
 * gated saw pads, a rolling arp and a singing saw lead with a dotted echo.
 */
import type { TrackDef } from '../types';
import { arpPluck, bassPluck, KITS, leadSaw, padSaws, stabSaw } from '../instruments';
import { ARRANGEMENT, BOSS_ARRANGEMENT, sections } from './common';

export const NEON: TrackDef = {
  id: 'neon', name: 'NEON LANES', bpm: 100, key: 9, scale: 'aeolian',
  progressions: [
    { chords: [{ deg: 0 }, { deg: 5 }, { deg: 2 }, { deg: 6 }], leads: [
      '3___2_1_2_______ 3___2_1_2___1___ 1___2_3_4_______ 3___2___1___+___',
      '2_3_4___3_2_____ 2_3_4___3_2_____ 1_2_3___2_1_____ 1___0___a_______',
    ] },
    { chords: [{ deg: 5 }, { deg: 6 }, { deg: 0 }, { deg: 0 }], leads: [
      '1___2___3_______ 1___2___3_______ 3___4___5___4___ 3_______________',
      '2_1_2___3_______ 2_1_2___3_______ 4_3_4___5___4___ 3_______________',
    ] },
    { chords: [{ deg: 0 }, { deg: 4 }, { deg: 5 }, { deg: 6 }], leads: [
      '2___3___2_1_0___ 2___3___2_1_0___ 2___3___4_______ 3___2___1___+___',
    ] },
    { chords: [{ deg: 3 }, { deg: 5 }, { deg: 2 }, { deg: 6 }], leads: [
      '0___1___2_______ 2___1___0_______ 1___2___3_______ 2___1___+___-___',
    ] },
  ],
  boss: [
    { chords: [{ deg: 0, scale: 'phrygian' }, { deg: 1, scale: 'phrygian' }, { deg: 0, scale: 'phrygian' }, { deg: 6, scale: 'phrygian' }], leads: ['0___________a___'] },
    { chords: [{ deg: 0, scale: 'harmonic' }, { deg: 5, scale: 'harmonic' }, { deg: 1, scale: 'phrygian' }, { deg: 4, scale: 'harmonic' }], leads: ['0___________a___'] },
  ],
  drums: {
    intro: { kick: 'X.......X.......', hat: '..x...x...x...x.' },
    groove: { kick: 'X.......X.......', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' },
    drive: { kick: 'X...X...X...X...', snare: '....X.......X...', hat: 'xgxgxgxgxgxgxgxg', open: '..............x.' },
    break: { hat: '..x...x...x...x.' },
    boss: { kick: 'X..xX...X..xX...', snare: '....X.......X..g', hat: 'xgxgxgxgxgxgxgxg', perc: '......x.......x.' },
  },
  fills: ['....X...X.X.XXXX', 'X.x.X.x.XxXxXXXX', '....X..X..X.XXXX'],
  bass: { main: '0.0.0.0.0.0.0.0.', drive: '0.3.0.3.0.3.0.3.' },
  arps: { main: '0.2.3.2.4.2.3.2.', soft: '0...2...3...2...' },
  sections: sections(),
  arrangement: ARRANGEMENT,
  bossArrangement: BOSS_ARRANGEMENT,
  octave: { bass: 2, pad: 4, arp: 4, lead: 4, stab: 4 },
  instruments: { bass: bassPluck(1300, 320), pad: padSaws(1500, 500), arp: arpPluck('sawtooth', 3800), lead: leadSaw(3200), stab: stabSaw() },
  kit: KITS.punch,
  mix: { kick: -3, snare: -6, hat: -16, open: -14, perc: -12, crash: -14, riser: -18, bass: -8, pad: -17, arp: -16, lead: -12, stab: -14 },
  wet: { snare: 0.35, pad: 0.4, arp: 0.3, lead: 0.3, perc: 0.2, crash: 0.2 },
  echo: { lead: 0.3, arp: 0.25 },
  echoBeats: 0.75,
  pump: 0.5,
};
