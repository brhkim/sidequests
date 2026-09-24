/**
 * OVERDRIVE - electro house, 124 BPM, E Dorian. Four on the floor, an
 * offbeat bass, syncopated saw stabs, a square hook, a hard sidechain pump.
 */
import type { TrackDef } from '../types';
import { arpPluck, bassPluck, KITS, leadSquare, padSaws, stabSaw } from '../instruments';
import { ARRANGEMENT, BOSS_ARRANGEMENT, sections } from './common';

export const OVERDRIVE: TrackDef = {
  id: 'overdrive', name: 'OVERDRIVE', bpm: 124, key: 4, scale: 'dorian',
  progressions: [
    { chords: [{ deg: 0, seventh: true }, { deg: 0, seventh: true }, { deg: 3 }, { deg: 3 }], leads: [
      '3.3.2...3.4.3... 2.1.0...a....... 1.1.2...3.4.3... 2...1...0.......',
      '0.2.3.2.4___3___ 0.2.3.2.4___5___ 1.2.3.2.1___0___ a_______________',
    ] },
    { chords: [{ deg: 0 }, { deg: 6 }, { deg: 3 }, { deg: 0 }], leads: [
      '3___2.3.4___3___ 3___2.3.4___3___ 2___1.2.3___2___ 3_______________',
    ] },
    { chords: [{ deg: 2 }, { deg: 6 }, { deg: 3 }, { deg: 0, seventh: true }], leads: [
      '2___3.2.1___0___ 2___3.2.1___0___ 2___3.4.5___4___ 3_______________',
    ] },
    { chords: [{ deg: 0 }, { deg: 6 }, { deg: 2 }, { deg: 3 }], leads: [
      '3.2.3.4.3___2___ 3.2.3.4.3___2___ 1.2.3.4.3___2___ 1.2.3.4.5_______',
    ] },
  ],
  boss: [
    { chords: [{ deg: 0, scale: 'phrygian' }, { deg: 1, scale: 'phrygian' }, { deg: 0, scale: 'phrygian' }, { deg: 6, scale: 'phrygian' }], leads: ['0___________a___'] },
    { chords: [{ deg: 0, scale: 'phrygian' }, { deg: 5, scale: 'phrygian' }, { deg: 1, scale: 'phrygian' }, { deg: 0, scale: 'phrygian' }], leads: ['0___________a___'] },
  ],
  drums: {
    intro: { kick: 'X...X...X...X...', hat: '..x...x...x...x.' },
    groove: { kick: 'X...X...X...X...', snare: '....X.......X...', open: '..x...x...x...x.', hat: 'g.g.g.g.g.g.g.g.' },
    drive: { kick: 'X...X...X...X...', snare: '....X.......X...', open: '..x...x...x...x.', hat: 'xgxgxgxgxgxgxgxg', perc: '...x......x.....' },
    break: { hat: '..x...x...x...x.', perc: '........x.......' },
    boss: { kick: 'X...X...X...X.x.', snare: '....X.......X...', hat: 'xgxgxgxgxgxgxgxg', open: '..x...x...x...x.', perc: 'x..x..x...x..x..' },
  },
  fills: ['....X...X.XXX.XX', '..X...X.X.X.XXXX', 'X.X.X.X.XXXXXXXX'],
  bass: { main: '..0...0...0...0.', drive: '..00..0...00..0+' },
  arps: { main: '0.2.3.2.0.2.3.2.', soft: '0...3...2...3...' },
  stabs: { main: '..x..x.....x..x.' },
  sections: sections({
    groove: { layers: ['bass', 'pad'], drums: 'groove', bass: 'main' },
    drop: { layers: ['bass', 'pad', 'stab', 'lead'], drums: 'drive', bass: 'drive' },
    boss: { layers: ['bass', 'stab', 'lead'], drums: 'boss', bass: 'drive', motif: true },
    boss2: { layers: ['bass', 'pad', 'stab'], drums: 'boss', bass: 'drive', fill: true },
  }),
  arrangement: ARRANGEMENT,
  bossArrangement: BOSS_ARRANGEMENT,
  octave: { bass: 2, pad: 4, arp: 5, lead: 4, stab: 4 },
  instruments: { bass: bassPluck(900, 250, 0.35), pad: padSaws(1200, 300), arp: arpPluck('square', 3000), lead: leadSquare(), stab: stabSaw() },
  kit: KITS.punch,
  mix: { kick: -2, snare: -7, hat: -17, open: -15, perc: -13, crash: -15, riser: -18, bass: -8, pad: -20, arp: -17, lead: -13, stab: -13 },
  wet: { snare: 0.3, pad: 0.35, arp: 0.25, lead: 0.25, stab: 0.2, crash: 0.2 },
  echo: { lead: 0.25, stab: 0.15, arp: 0.2 },
  echoBeats: 0.75,
  pump: 0.65,
};
