import Phaser from 'phaser';
import { COLORS, VIEW } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.width,
  height: VIEW.height,
  backgroundColor: COLORS.bg,
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
