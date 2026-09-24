/**
 * CHIPRUSH - chiptune, 150 BPM, C major: the bright one. Square lead with
 * vibrato, the sixteenth-note chord arpeggio, a bouncing triangle bass and
 * a noise kit. Its Titan mode drops to C minor.
 */
import type { TrackDef } from '../types';
import { arpPluck, bassChip, KITS, leadSquare, padChip, stabSaw } from '../instruments';
import { ARRANGEMENT, BOSS_ARRANGEMENT, sections } from './common';

export const CHIPRUSH: TrackDef = {
  id: 'chiprush', name: 'CHIPRUSH', bpm: 150, key: 0, scale: 'ionian',
  progressions: [
    { chords: [{ deg: 0 }, { deg: 4 }, { deg: 5 }, { deg: 3 }], leads: [
      '3___4___5___4_3_ 3___4___5_______ 3___4___5___4_3_ 2___1___0___+___',
      '5_4_3_4_5___3___ 5_4_3_4_5_______ 4_3_2_3_4___2___ 3___2___1___0___',
    ] },
    { chords: [{ deg: 3 }, { deg: 4 }, { deg: 2 }, { deg: 5 }], leads: [
      '2___3___4___3___ 2___3___4_______ 3___4___5___4___ 3_______________',
    ] },
    { chords: [{ deg: 5 }, { deg: 3 }, { deg: 0 }, { deg: 4 }], leads: [
      '3___4___5___4___ 3___2___3___4___ 3___4___5___6___ 5___4___3___+___',
    ] },
    { chords: [{ deg: 3 }, { deg: 4 }, { deg: 0 }, { deg: 0 }], leads: [
      '0_1_2_3_4___3___ 0_1_2_3_4___3___ 3_4_5_6_5___4___ 3_______________',
    ] },
  ],
  boss: [
    { chords: [{ deg: 0, scale: 'aeolian' }, { deg: 5, scale: 'aeolian' }, { deg: 6, scale: 'aeolian' }, { deg: 4, scale: 'harmonic' }], leads: ['0___________a___'] },
    { chords: [{ deg: 0, scale: 'phrygian' }, { deg: 1, scale: 'phrygian' }, { deg: 0, scale: 'phrygian' }, { deg: 4, scale: 'harmonic' }], leads: ['0___________a___'] },
  ],
  drums: {
    intro: { kick: 'X.......X.......', hat: 'x.x.x.x.x.x.x.x.' },
    groove: { kick: 'X.....X.X.......', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' },
    drive: { kick: 'X.....X.X...X...', snare: '....X.......X.X.', hat: 'xgxgxgxgxgxgxgxg', open: '..............x.' },
    break: { hat: 'x.x.x.x.x.x.x.x.' },
    boss: { kick: 'X.X...X.X.X...X.', snare: '....X.......X...', hat: 'xgxgxgxgxgxgxgxg', perc: 'x...x...x...x...' },
  },
  fills: ['....X.X.X.XXXXXX', 'XXXX....XXXX.XXX', '....X...X.X.X.XX'],
  bass: { main: '0.0.3.0.0.0.3.0.', drive: '0.3.0.3.0.3.0.3.' },
  arps: { main: '0123012301230123', soft: '0.1.2.3.2.1.0.1.' },
  sections: sections({
    intro: { layers: ['arp'], drums: 'intro', arp: 'soft' },
    groove: { layers: ['bass', 'arp'], drums: 'groove', bass: 'main', arp: 'soft' },
    build: { layers: ['bass', 'arp'], drums: 'groove', bass: 'main', arp: 'main', riser: true, fill: true },
    drop: { layers: ['bass', 'arp', 'lead'], drums: 'drive', bass: 'drive', arp: 'main' },
    break: { layers: ['arp', 'lead', 'pad'], drums: 'break', arp: 'soft' },
    boss: { layers: ['bass', 'arp', 'lead'], drums: 'boss', bass: 'drive', arp: 'main', motif: true },
  }),
  arrangement: ARRANGEMENT,
  bossArrangement: BOSS_ARRANGEMENT,
  octave: { bass: 3, pad: 4, arp: 5, lead: 4, stab: 4 },
  instruments: { bass: bassChip(), pad: padChip(), arp: arpPluck('square', 5000, 1500), lead: leadSquare(), stab: stabSaw() },
  kit: KITS.chip,
  mix: { kick: -3, snare: -8, hat: -18, open: -16, perc: -16, crash: -16, riser: -20, bass: -8, pad: -22, arp: -19, lead: -12, stab: -16 },
  wet: { snare: 0.15, pad: 0.2, arp: 0.15, lead: 0.2 },
  echo: { lead: 0.2, arp: 0.1 },
  echoBeats: 0.5,
  pump: 0.2,
};
