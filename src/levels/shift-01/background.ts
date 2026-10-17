import Phaser from "phaser";

/**
 * Shift 01 — Probation.
 * Uses a dedicated illustrated SVG asset rather than drawing terrain with
 * procedural graphics. The SVG contains the sky, ridgeline, trees and ground
 * atmosphere as one composed environment.
 */
export function preloadShift01Background(scene: Phaser.Scene): void {
  scene.load.svg("shift-01-terrain", "/assets/levels/shift-01-terrain.svg", {
    width: 960,
    height: 600
  });
}

export function drawShift01Background(scene: Phaser.Scene): void {
  scene.add.image(480, 300, "shift-01-terrain").setDepth(-20).setOrigin(0.5);
}
