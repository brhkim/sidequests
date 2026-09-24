import type Phaser from 'phaser';

/**
 * Textures for the HUD and the three screens (panels, chips, button faces).
 * Owned by the HUD / screens workstreams of the 2026-09-24 redesign; called
 * once from `BootScene`. Bake here; never use runtime filters.
 */
export function makeUi(_scene: Phaser.Scene): void {}
