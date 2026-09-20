import type Phaser from 'phaser';
import { ANALYTICS } from '../config';

/**
 * Anonymous analytics: how many people play, how many runs, how far they
 * get, how long they last. GoatCounter, the author's choice: no cookies,
 * no personal data, no consent banner, a public counter script.
 *
 * It follows audio's rule exactly. It reads `game.events` and nothing else,
 * is installed once from `main.ts`, and no scene file knows it exists. It
 * never runs on an instrument page (`?seed=`) and never when `ANALYTICS.site`
 * is empty, so the headless checks and a local dev server send nothing.
 * Every call is in try/catch: a blocked script or an offline player must
 * cost the game nothing, and nothing here may ever reach the simulation.
 *
 * GoatCounter counts events as named paths, so the numbers are encoded in
 * the path: `run/end/normal/wave-07`. Time played is bucketed - it stores
 * counts, not values - and the buckets are the ones a person would ask
 * about.
 */
type Counter = { count: (o: { path: string; title?: string; event?: boolean }) => void };

const SCRIPT = 'https://gc.zgo.at/count.js';

interface EndLike { wave: number; mode: string; cause?: string; elapsed?: number }

export function installAnalytics(events: Phaser.Events.EventEmitter, search: string): void {
  if (!ANALYTICS.site) return;
  let params: URLSearchParams;
  try { params = new URLSearchParams(search); } catch { return; }
  if (params.has('seed')) return;

  const endpoint = `https://${ANALYTICS.site}.goatcounter.com/count`;
  try {
    const s = document.createElement('script');
    s.async = true;
    s.src = SCRIPT;
    s.dataset.goatcounter = endpoint;
    // The pageview is counted once the script is up; runs are counted here.
    document.head.appendChild(s);
  } catch {
    return;
  }

  const count = (path: string, title?: string) => {
    try {
      const gc = (window as unknown as { goatcounter?: Counter }).goatcounter;
      gc?.count({ path, title, event: true });
    } catch {
      // A blocked or absent counter is the expected case, not an error.
    }
  };

  events.on('startmatch', () => count('run/start'));
  events.on('gameover', (p: EndLike) => {
    const wave = String(Math.max(0, Math.floor(p.wave))).padStart(2, '0');
    count(`run/end/${p.mode}/wave-${wave}`, p.cause);
    if (typeof p.elapsed === 'number') count(`run/time/${timeBucket(p.elapsed)}`);
  });
}

/** Coarse on purpose: the question is "do people play for a minute or ten". */
export function timeBucket(seconds: number): string {
  if (seconds < 30) return 'under-30s';
  if (seconds < 60) return '30s-1m';
  if (seconds < 120) return '1-2m';
  if (seconds < 240) return '2-4m';
  if (seconds < 480) return '4-8m';
  return 'over-8m';
}
