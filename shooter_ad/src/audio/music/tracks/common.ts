/**
 * What the four tracks share: the section vocabulary and how a phrase cycles
 * through it at each intensity level. A track overrides what it must.
 *
 * Level 0 is the start of a run, 4 a late wave under pressure. The lead
 * plays only in drops and breaks, and a drop is never followed by a drop
 * more than once, because a hook heard every eight bars is the fastest way
 * to make a track grate.
 */
import type { Section, SectionName, TrackDef } from '../types';

export const SECTIONS: Partial<Record<SectionName, Section>> = {
  menu: { layers: ['pad', 'arp'], arp: 'soft' },
  intro: { layers: ['pad', 'arp'], drums: 'intro', arp: 'soft' },
  groove: { layers: ['bass', 'pad'], drums: 'groove', bass: 'main' },
  build: { layers: ['bass', 'pad', 'arp'], drums: 'groove', bass: 'main', arp: 'main', riser: true, fill: true },
  drop: { layers: ['bass', 'pad', 'arp', 'lead'], drums: 'drive', bass: 'drive', arp: 'main' },
  break: { layers: ['pad', 'arp', 'lead'], drums: 'break', arp: 'soft' },
  boss: { layers: ['bass', 'pad', 'lead'], drums: 'boss', bass: 'drive', motif: true },
  boss2: { layers: ['bass', 'pad', 'arp'], drums: 'boss', bass: 'drive', arp: 'main', fill: true },
};

export const ARRANGEMENT: SectionName[][] = [
  ['intro'],
  ['intro', 'groove', 'groove'],
  ['groove', 'build', 'groove', 'break'],
  ['build', 'drop', 'groove', 'drop', 'break'],
  ['drop', 'build', 'drop', 'groove', 'drop', 'break'],
];

export const BOSS_ARRANGEMENT: SectionName[] = ['boss', 'boss2'];

/** The shared shape, with a track's own sections merged over it. */
export function sections(over: Partial<Record<SectionName, Section>> = {}): TrackDef['sections'] {
  return { ...SECTIONS, ...over };
}
