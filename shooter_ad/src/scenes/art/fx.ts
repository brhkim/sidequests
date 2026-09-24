import type Phaser from 'phaser';

/**
 * Textures for effects on the field: glows, rings, sparks, bullet streaks.
 * Owned by the sprites workstream of the 2026-09-24 redesign; called once
 * from `BootScene`. Bake here; never use runtime filters or post-processing.
 */
export function makeFx(_scene: Phaser.Scene): void {}
