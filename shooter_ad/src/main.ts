import Phaser from 'phaser';
import { COLORS, VIEW } from './config';
import { ENEMIES } from './data/enemies';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { installAudio } from './audio/AudioEvents';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.width,
  height: VIEW.height,
  backgroundColor: COLORS.bg,
  // Sound is raw WebAudio in `src/audio/`, so Phaser's sound manager is not
  // created at all: one context, made inside the first gesture, not two.
  audio: { noAudio: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, GameScene, UIScene],
});

// Phaser's registry is the game's own data store, not test scaffolding. Exposing
// the game instance lets the headless check read real gameplay state (kills,
// power, tier) instead of guessing from pixels.
(window as unknown as { game: Phaser.Game }).game = game;
// Same rationale for the roster: `scripts/behaviour.mjs` spawns one cohort of
// each type directly rather than waiting for the bot to survive to wave 8,
// which it does not reliably do.
(window as unknown as { enemyTypes: typeof ENEMIES }).enemyTypes = ENEMIES;
// Audio subscribes to `game.events` and nothing else; it is installed here,
// outside every scene, so no scene file knows it exists. `?seed=` pages (the
// instruments) get no context unless they ask with `audio=1`.
installAudio(game.events, window.location.search);
