import Phaser from "phaser";

const W = 960;
const H = 600;

/**
 * Shift 02 — Hostile Work Environment.
 * A distinct colder, denser woodland palette. Kept separate from Shift 01 so
 * this level can use its own silhouettes, lighting, and terrain without
 * changing the probation level.
 */
export function drawShift02Background(scene: Phaser.Scene): void {
  const sky = scene.add.graphics().setDepth(-20);
  sky.fillStyle(0x171a2b, 1);
  sky.fillRect(0, 0, W, H);
  sky.fillStyle(0x3b345d, 0.24);
  sky.fillCircle(760, 132, 94);
  sky.fillStyle(0x81749b, 0.2);
  sky.fillCircle(760, 132, 57);
  for (let i = 0; i < 64; i++) {
    const x = (i * 113 + 31) % W;
    const y = 62 + ((i * 67 + 17) % 330);
    sky.fillStyle(i % 6 === 0 ? 0xb7a6d5 : 0xd8d2e6, i % 3 === 0 ? 0.35 : 0.18);
    sky.fillRect(x, y, i % 8 === 0 ? 2 : 1, i % 8 === 0 ? 2 : 1);
  }

  // Distant slate ridges.
  const far = scene.add.graphics().setDepth(-18);
  far.fillStyle(0x24253a, 1);
  far.fillTriangle(-20, 420, 155, 250, 340, 420);
  far.fillTriangle(225, 420, 470, 215, 710, 420);
  far.fillTriangle(575, 420, 810, 245, 1000, 420);
  far.fillStyle(0x302d49, 0.7);
  far.fillTriangle(30, 420, 300, 300, 520, 420);
  far.fillTriangle(470, 420, 710, 290, 960, 420);

  // Denser bare trees, with angular branch clusters.
  const trees = scene.add.graphics().setDepth(-15);
  for (const [x, base, height, width] of [
    [34, 444, 145, 6], [118, 442, 91, 3], [286, 440, 136, 5],
    [420, 441, 95, 3], [635, 443, 150, 6], [760, 440, 104, 3],
    [927, 444, 142, 6]
  ]) {
    trees.lineStyle(width, 0x11121e, 0.98);
    trees.lineBetween(x, base, x + 1, base - height);
    trees.lineBetween(x, base - height * 0.25, x - 21, base - height * 0.42);
    trees.lineBetween(x, base - height * 0.43, x + 23, base - height * 0.61);
    trees.lineBetween(x, base - height * 0.64, x - 15, base - height * 0.8);
    trees.lineBetween(x, base - height * 0.7, x + 16, base - height * 0.88);
  }

  // Cold ground fog and foreground silhouettes.
  const fog = scene.add.graphics().setDepth(-12);
  fog.fillStyle(0x77708f, 0.07);
  fog.fillRect(0, 390, W, 100);
  fog.fillStyle(0x11121e, 0.35);
  fog.fillRect(0, 465, W, 35);
  const foreground = scene.add.graphics().setDepth(4);
  foreground.fillStyle(0x121321, 0.8);
  foreground.fillTriangle(0, 500, 0, 472, 33, 500);
  foreground.fillTriangle(960, 500, 960, 469, 925, 500);
  foreground.fillStyle(0x39344f, 0.45);
  for (let x = 10; x < W; x += 61) {
    foreground.fillEllipse(x, 496, 13, 3);
  }
}
