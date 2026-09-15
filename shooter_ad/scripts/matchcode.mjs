/**
 * Round-trip check for match codes.
 *
 * A sharing code that loses a bit is worse than no sharing at all: two people
 * compare scores on what they believe is one match and the leaderboard is
 * quietly wrong, with nothing on screen to say so. This is cheap to run and the
 * failure it guards against is invisible in play.
 */
import { register } from 'node:module';
register('./ts-resolve.mjs', import.meta.url);

const { encodeMatch, decodeMatch, matchUrl, matchFromQuery } =
  await import('../src/systems/MatchCode.ts');

let failures = 0;
const fail = (msg) => { console.error(`  FAIL ${msg}`); failures++; };

// Exhaustive over the interesting edges, then a wide random sweep. A seed is a
// 32-bit unsigned, so the boundaries are where an off-by-one would hide.
const edges = [0, 1, 31, 32, 1023, 1024, 0x7FFFFFFF, 0x80000000, 0xFFFFFFFE, 0xFFFFFFFF];
const seeds = [...edges];
for (let i = 0; i < 20000; i++) seeds.push(Math.floor(Math.random() * 0x100000000));

console.log('=== round trip, both modes ===');
for (const seed of seeds) {
  for (const mode of ['normal', 'hard']) {
    const code = encodeMatch({ seed, mode });
    const back = decodeMatch(code);
    if (!back) { fail(`${seed}/${mode} -> ${code} -> null`); continue; }
    if (back.seed !== seed) fail(`seed ${seed} -> ${code} -> ${back.seed}`);
    if (back.mode !== mode) fail(`mode ${mode} -> ${code} -> ${back.mode}`);
  }
}
console.log(`  ${seeds.length * 2} codes round-tripped`);

console.log('\n=== a person typing it badly ===');
const canonical = encodeMatch({ seed: 3042291225, mode: 'hard' });
const mangled = [
  canonical.toLowerCase(),
  canonical.replace(/-/g, ''),
  canonical.replace(/-/g, ' '),
  ` ${canonical} `,
];
console.log(`  canonical ${canonical}`);
for (const variant of mangled) {
  const back = decodeMatch(variant);
  if (!back || back.seed !== 3042291225 || back.mode !== 'hard') {
    fail(`"${variant}" did not decode back`);
  } else {
    console.log(`  ok  "${variant}"`);
  }
}

console.log('\n=== url derives from the code, and reads back ===');
const match = { seed: 12345678, mode: 'normal' };
const url = matchUrl(match, 'https://example.test/shooter_ad/?old=1#frag');
const back = matchFromQuery(url.slice(url.indexOf('?')));
console.log(`  ${url}`);
if (!back || back.seed !== match.seed || back.mode !== match.mode) {
  fail('url did not round-trip');
}
if (url.includes('#') || url.includes('old=1')) fail('url kept stale query or fragment');

console.log('\n=== garbage is rejected, not silently accepted ===');
for (const bad of ['', 'x', 'ABC', '---']) {
  if (decodeMatch(bad) !== null) fail(`"${bad}" should not have decoded`);
}
console.log('  short and empty inputs rejected');

// Length is a product constraint, not a detail: this has to be readable off a
// photo and sayable out loud.
console.log('\n=== shape ===');
console.log(`  ${canonical}  (${canonical.length} chars)`);
if (canonical.length > 12) fail('code too long to read off a screenshot');

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nPASS');
