/** The rotation: a new run starts the next track; so does every second Titan felled. */
import { BREAKLINE } from './breakline';
import { CHIPRUSH } from './chiprush';
import { NEON } from './neon';
import { OVERDRIVE } from './overdrive';
import type { TrackDef } from '../types';

export const TRACKS: TrackDef[] = [NEON, OVERDRIVE, BREAKLINE, CHIPRUSH];
