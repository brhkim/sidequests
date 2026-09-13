/**
 * Lets the model script import the game's own TypeScript sources directly.
 *
 * The point is that there is exactly ONE definition of squad strength: a model
 * script that reimplemented `squadDps` in JS would drift from the game and
 * start reporting numbers about a game nobody is playing.
 */
export function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
    return next(`${specifier}.ts`, context);
  }
  return next(specifier, context);
}
