/**
 * BREAKLINE - drum and bass, 172 BPM, D minor. Half-time at low intensity,
 * the two-step break with ghost snares when it opens up, a detuned reese
 * under a glassy bell lead. Chords change every two bars.
 */
import type { TrackDef } from '../types';
import { arpBell, bassReese, KITS, leadBell, padSaws, stabSaw } from '../instruments';
import { ARRANGEMENT, BOSS_ARRANGEMENT, sections } from './common';

const A = { deg: 4, scale: 'harmonic' as const };

export const BREAKLINE: TrackDef = {
  id: 'breakline', name: 'BREAKLINE', bpm: 172, key: 2, scale: 'aeolian',
  progressions: [
    { chords: [{ deg: 0 }, { deg: 0 }, { deg: 5 }, { deg: 5 }, { deg: 3 }, { deg: 3 }, A, A], leads: [
      '2_______1___0___ ________________ 1_______2___3___ ________________ 1_______0___a___ ________________ 1_______2___+___ 3_______________',
      '0___2___3_______ ____2___1_______ 1___2___3_______ ____2___1_______ 0___1___2_______ ____1___0_______ 1___2___3_______ ________________',
    ] },
    { chords: [{ deg: 0 }, { deg: 0 }, { deg: 2 }, { deg: 2 }, { deg: 6 }, { deg: 6 }, { deg: 5 }, { deg: 5 }], leads: [
      '2_______3_______ 2___1___0_______ 1_______2_______ 1___0___a_______ 1_______2_______ 3___2___1_______ 2_______1_______ 0_______________',
    ] },
    { chords: [{ deg: 5 }, { deg: 5 }, { deg: 6 }, { deg: 6 }, { deg: 0 }, { deg: 0 }, { deg: 0 }, { deg: 0, sus: true }], leads: [
      '1_______2_______ 3_______2_______ 1_______2_______ 3_______4_______ 3_______2_______ 1_______0_______ 2_______1_______ 0_______________',
    ] },
  ],
  boss: [
    { chords: [0, 0, 1, 1, 0, 0, 6, 6].map((deg) => ({ deg, scale: 'phrygian' as const })), leads: ['0___________a___'] },
    { chords: [0, 0, 5, 5, 1, 1, 0, 0].map((deg) => ({ deg, scale: 'phrygian' as const })), leads: ['0___________a___'] },
  ],
  drums: {
    intro: { kick: 'X...............', hat: '..x...x...x...x.' },
    groove: { kick: 'X.........X.....', snare: '........X.......', hat: 'x.x.x.x.x.x.x.x.' },
    drive: { kick: 'X.........X.....', snare: '....X..g..g.X...', hat: 'x.xgx.xgx.xgx.xg', open: '......x.........' },
    break: { hat: 'x.x.x.x.x.x.x.x.', perc: '..........x.....' },
    boss: { kick: 'X.X.......X.....', snare: '....X.......X.gX', hat: 'xgxgxgxgxgxgxgxg', open: '......x.......x.' },
  },
  fills: ['....X.gXg.X.XXXX', 'X.gX.gX.gXgXXXXX', '....X...XgXgXXXX'],
  bass: { main: '0_______________', drive: '0_______0_____a_' },
  arps: { main: '0...2...3...2...', soft: '0.......3.......' },
  sections: sections({ intro: { layers: ['pad'], drums: 'intro' } }),
  arrangement: ARRANGEMENT,
  bossArrangement: BOSS_ARRANGEMENT,
  octave: { bass: 2, pad: 4, arp: 5, lead: 5, stab: 4 },
  instruments: { bass: bassReese(), pad: padSaws(1100, 800), arp: arpBell(), lead: leadBell(), stab: stabSaw() },
  kit: KITS.punch,
  mix: { kick: -2, snare: -5, hat: -18, open: -16, perc: -14, crash: -15, riser: -18, bass: -9, pad: -19, arp: -17, lead: -13, stab: -15 },
  wet: { snare: 0.3, pad: 0.45, arp: 0.35, lead: 0.4, perc: 0.3, crash: 0.2 },
  echo: { lead: 0.35, arp: 0.3 },
  echoBeats: 0.75,
  pump: 0.3,
};
