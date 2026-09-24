import type Phaser from 'phaser';

/**
 * Textures for the gate cards (the notes on the highway) and the field's
 * furniture. Owned by the field workstream of the 2026-09-24 redesign;
 * called once from `BootScene`. Bake glows, gradients and shadows HERE, once,
 * rather than drawing them per frame or through runtime filters.
 */
export function makeCards(_scene: Phaser.Scene): void {}
