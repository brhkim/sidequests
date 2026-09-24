/**
 * The arranger. Pure: a track, a mode, an intensity level and a phrase
 * number go in; a phrase plan and each bar's note events come out. No clock
 * and no randomness - every choice is a hash of the run's music seed and
 * the phrase number, so the live scheduler and the offline renderer in
 * `npm run music` hear the same bars, and nothing here can reach the game.
 *
 * How it avoids droning, in the terms game-music practice uses:
 * - **Vertical layering**: the intensity level (from the wave and the
 *   damage being taken) decides which layers may play at all.
 * - **Horizontal re-sequencing**: each level cycles a list of sections
 *   (intro / groove / build / drop / break), a phrase of eight bars each,
 *   so a drop is always followed by something that is not a drop.
 * - **Cell variation**: progressions rotate every two phrases, lead lines
 *   are chosen per phrase and the lead RESTS outside drops and breaks;
 *   drum fills and crashes mark the phrase edges.
 */
import { chordTones, neighbour, rootOffset, tone, type Harmony } from '../harmony';
import type { Layer, NoteEvent, Progression, Section, SectionName, TrackDef } from './types';

export type MusicMode = 'menu' | 'play' | 'boss';

export const STEPS = 16;
export const BARS = 8;

/**
 * The Titan's leitmotif, the same in every track: root, the scale step
 * above, root, the fifth below - over a Phrygian boss progression the step
 * above is the flat second, which is the whole menace. Last bar leaps.
 */
export const TITAN_MOTIF = '0___+___0___a___ 0___+___0___a___ 0___+___0___a___ 0___+___3_______';

export interface PhrasePlan {
  name: SectionName;
  section: Section;
  prog: Progression;
  harmonies: Harmony[];
  lead: { midi: number; start: number; len: number }[];
  fill: boolean;
  crash: boolean;
}

/** An integer hash to [0, 1): variation without randomness. */
export function hash01(n: number): number {
  let x = Math.imul(Math.floor(n) | 0, 0x9e3779b1) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 0x100000000;
}
const pick = (n: number, seed: number, salt: number): number => Math.floor(hash01(seed * 131 + salt) * n) % n;

const clean = (s: string): string => s.replace(/[\s|]/g, '');

/**
 * Resolves a line against one harmony per bar. Each note takes the chord
 * of the bar it STARTS in; `+` / `-` move a scale step from the previous
 * note; `_` extends it (across bars too).
 */
export function resolveLine(line: string, harm: (bar: number) => Harmony, oct: number): { midi: number; start: number; len: number }[] {
  const out: { midi: number; start: number; len: number }[] = [];
  const s = clean(line);
  let prev = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const h = harm(Math.floor(i / STEPS));
    let midi: number | null = null;
    if (c >= '0' && c <= '9') midi = tone(h, Number(c), oct);
    else if (c === 'a') midi = tone(h, -1, oct);
    else if (c === 'b') midi = tone(h, -2, oct);
    else if (c === '+' && prev >= 0) midi = neighbour(h, prev, 1);
    else if (c === '-' && prev >= 0) midi = neighbour(h, prev, -1);
    else if (c === '_' && out.length) { out[out.length - 1].len++; continue; }
    if (midi === null) continue;
    out.push({ midi, start: i, len: 1 });
    prev = midi;
  }
  return out;
}

/** A chord voiced close around `center`, seventh included where the chord has one. */
export function voice(h: Harmony, center: number, withRoot: boolean): number[] {
  const root = 12 * 5 + h.key + rootOffset(h);
  const notes = chordTones(h, true).map((t) => {
    let m = root + t;
    while (m > center + 5) m -= 12;
    while (m < center - 6) m += 12;
    return m;
  });
  if (withRoot) {
    let r = root;
    while (r > center - 7) r -= 12;
    notes.push(r);
  }
  return notes.sort((a, b) => a - b);
}

function sectionFor(track: TrackDef, mode: MusicMode, level: number, cursor: number): SectionName {
  if (mode === 'menu') return 'menu';
  const list = mode === 'boss' ? track.bossArrangement : track.arrangement[Math.max(0, Math.min(track.arrangement.length - 1, level))];
  return list[cursor % list.length];
}

/** Plans one phrase. `phrase` counts phrases since the track started; `cursor` the position in the level's list. */
export function planPhrase(
  track: TrackDef, mode: MusicMode, level: number, cursor: number, phrase: number, seed: number,
  opts: { crash?: boolean; prev?: SectionName; force?: SectionName } = {},
): PhrasePlan {
  const name = opts.force ?? sectionFor(track, mode, level, cursor);
  const section = track.sections[name] ?? track.sections.groove!;
  const pool = mode === 'boss' || name === 'boss' || name === 'boss2' ? track.boss : track.progressions;
  const prog = mode === 'menu' ? pool[0] : pool[(pick(pool.length, seed, 7) + Math.floor(phrase / 2)) % pool.length];
  const harmonies: Harmony[] = [];
  for (let b = 0; b < BARS; b++) harmonies.push({ key: track.key, scale: track.scale, chord: prog.chords[b % prog.chords.length] });
  let lead: PhrasePlan['lead'] = [];
  if (section.layers.includes('lead')) {
    const oct = track.octave.lead - (section.motif ? 1 : 0);
    const n = prog.leads.length;
    const v = pick(n, seed, phrase * 3 + 1);
    const first = section.motif ? TITAN_MOTIF : prog.leads[v];
    const second = section.motif ? TITAN_MOTIF : prog.leads[(v + 1) % n];
    const len = clean(first).length / STEPS;
    lead = [
      ...resolveLine(first, (b) => harmonies[b % BARS], oct),
      ...resolveLine(second, (b) => harmonies[(b + len) % BARS], oct).map((x) => ({ ...x, start: x.start + len * STEPS })),
    ].filter((x) => x.start < BARS * STEPS);
  }
  const hasDrums = !!section.drums;
  const fill = hasDrums && (section.fill || pick(2, seed, phrase * 5 + 2) === 0);
  const crash = !!opts.crash || (name === 'drop' && opts.prev !== 'drop') || (name === 'boss' && opts.prev !== 'boss');
  return { name, section, prog, harmonies, lead, fill, crash };
}

function drumLine(line: string | undefined, layer: Layer, out: NoteEvent[], from = 0, to = STEPS): void {
  if (!line) return;
  const s = clean(line);
  for (let i = from; i < Math.min(to, s.length); i++) {
    const c = s[i];
    const vel = c === 'X' ? 1 : c === 'x' ? 0.78 : c === 'g' ? 0.42 : 0;
    if (vel > 0) out.push({ step: i, layer, notes: [], hold: 1, vel });
  }
}

function tonalLine(line: string | undefined, layer: Layer, h: Harmony, oct: number, out: NoteEvent[]): void {
  if (!line) return;
  for (const n of resolveLine(line, () => h, oct)) {
    out.push({ step: n.start, layer, notes: [n.midi], hold: n.len, vel: n.start % 4 === 0 ? 0.95 : 0.78 });
  }
}

/** Every event of bar `bar` (0-7) of a phrase. */
export function barEvents(track: TrackDef, plan: PhrasePlan, bar: number, seed: number, phrase: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  const sec = plan.section;
  const h = plan.harmonies[bar];
  const has = (l: Layer): boolean => (sec.layers as Layer[]).includes(l);
  if (sec.drums) {
    const set = track.drums[sec.drums];
    const last = bar === BARS - 1 && plan.fill;
    drumLine(set.kick, 'kick', out, 0, last ? 12 : STEPS);
    drumLine(last ? track.fills[pick(track.fills.length, seed, phrase * 11 + 3)] : set.snare, 'snare', out);
    drumLine(set.hat, 'hat', out);
    drumLine(set.open, 'open', out);
    drumLine(set.perc, 'perc', out);
  }
  if (bar === 0 && plan.crash) out.push({ step: 0, layer: 'crash', notes: [], hold: 1, vel: 1 });
  if (sec.riser && bar === BARS - 2) out.push({ step: 0, layer: 'riser', notes: [], hold: 2 * STEPS, vel: 1 });
  if (has('bass')) tonalLine(track.bass[sec.bass ?? 'main'], 'bass', h, track.octave.bass, out);
  if (has('arp')) tonalLine(track.arps[sec.arp ?? 'main'], 'arp', h, track.octave.arp, out);
  if (has('pad')) {
    const same = (a: Harmony, b: Harmony): boolean => a.chord === b.chord;
    if (bar === 0 || !same(plan.harmonies[bar - 1], h)) {
      let run = 1;
      while (bar + run < BARS && same(plan.harmonies[bar + run], h)) run++;
      out.push({ step: 0, layer: 'pad', notes: voice(h, 12 * (track.octave.pad + 1) + 7, true), hold: run * STEPS, vel: 0.9 });
    }
  }
  if (has('stab') && track.stabs) {
    const s = clean(track.stabs[sec.stab ?? 'main'] ?? '');
    const chord = voice(h, 12 * (track.octave.stab + 1) + 9, false);
    for (let i = 0; i < s.length; i++) if (s[i] === 'x' || s[i] === 'X') out.push({ step: i, layer: 'stab', notes: chord, hold: 2, vel: s[i] === 'X' ? 1 : 0.8 });
  }
  for (const n of plan.lead) {
    if (Math.floor(n.start / STEPS) !== bar) continue;
    out.push({ step: n.start % STEPS, layer: 'lead', notes: [n.midi], hold: n.len, vel: n.start % 4 === 0 ? 0.95 : 0.8 });
  }
  return out;
}
