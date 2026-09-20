/**
 * The ring cap's answer applied to sound: past a rate the ear cannot follow,
 * N events become ONE voice that encodes N, rather than N voices that add up
 * to mud. Same shape as the bullet-stream collapse, and like it, invisible to
 * the simulation - the bundler only ever reads events.
 *
 * Two regimes per cue:
 * - sparse: the last voice for this cue ended more than `gapMs` ago, so the
 *   event plays at once as a bundle of 1 and opens a window;
 * - dense: events inside an open window (`windowMs`) are tallied, and when it
 *   closes the tally plays as one voice. So the cue's voice rate is capped at
 *   1000 / windowMs, and the first event of a burst is never late.
 *
 * `now` is whatever clock the caller keeps - wall time in play, a synthetic
 * one under the instrument. Nothing here reads a clock of its own.
 */
export interface BundleRule { windowMs: number; gapMs: number }

export interface Flush {
  name: string;
  /** Events this voice stands for. */
  count: number;
  /** Largest `share` seen among them (contact and breach size the voice by it). */
  share: number;
}

interface Window { closeAt: number; count: number; share: number }

export class Bundler {
  private open = new Map<string, Window>();
  private lastVoice = new Map<string, number>();
  /** Events absorbed into a tally rather than played on their own. */
  bundled = 0;

  /** Returns a flush to play right now, or null when the event joined a tally. */
  add(name: string, rule: BundleRule, now: number, share = 0): Flush | null {
    const window = this.open.get(name);
    if (window) {
      window.count++;
      window.share = Math.max(window.share, share);
      this.bundled++;
      return null;
    }
    const last = this.lastVoice.get(name);
    if (last === undefined || now - last >= rule.gapMs) {
      this.open.set(name, { closeAt: now + rule.windowMs, count: 0, share: 0 });
      this.lastVoice.set(name, now);
      return { name, count: 1, share };
    }
    this.open.set(name, { closeAt: now + rule.windowMs, count: 1, share });
    this.bundled++;
    return null;
  }

  /** Closes every window that has run out; each with a tally becomes a flush. */
  update(now: number): Flush[] {
    const out: Flush[] = [];
    for (const [name, window] of this.open) {
      if (window.closeAt > now) continue;
      this.open.delete(name);
      if (window.count > 0) {
        this.lastVoice.set(name, now);
        out.push({ name, count: window.count, share: window.share });
      }
    }
    return out;
  }

  reset(): void {
    this.open.clear();
    this.lastVoice.clear();
  }
}

/**
 * How a bundle of `count` sounds: one semitone down per doubling, 1.5 dB
 * quieter per doubling, and from four a partial an octave below. Never louder
 * than a single event - a stack of kills is heavier, not shoutier.
 */
export function encodeBundle(count: number): { pitch: number; gainDb: number; subDb?: number } {
  const doublings = Math.log2(Math.max(1, count));
  return {
    pitch: Math.pow(2, -doublings / 12),
    gainDb: -1.5 * doublings,
    subDb: count >= 4 ? -24 : undefined,
  };
}
