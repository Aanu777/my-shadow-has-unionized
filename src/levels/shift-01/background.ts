import Phaser from "phaser";

const W = 960;
const H = 600;

/**
 * Shift 01 — Probation.
 * Drawn to match the game's existing plum, lavender and muted-olive palette.
 * Every terrain plane is separate so this level can evolve independently.
 */
export function drawShift01Background(scene: Phaser.Scene): void {
  const sky = scene.add.graphics().setDepth(-20);
  sky.fillStyle(0x21182f, 1);
  sky.fillRect(0, 0, W, H);

  // Moon bloom and distant stars.
  sky.fillStyle(0x3a2a50, 0.35);
  sky.fillCircle(780, 125, 91);
  sky.fillStyle(0x5d496d, 0.38);
  sky.fillCircle(780, 125, 64);
  sky.fillStyle(0xb7a2c7, 0.22);
  sky.fillCircle(780, 125, 45);
  for (let i = 0; i < 58; i++) {
    const x = (i * 137 + 19) % W;
    const y = 70 + ((i * 71 + 23) % 315);
    sky.fillStyle(i % 5 === 0 ? 0xd5b9e8 : 0xf0e8d8, i % 4 === 0 ? 0.48 : 0.24);
    sky.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
  }

  // Plane 1: far ridgelines, low contrast to preserve play readability.
  const far = scene.add.graphics().setDepth(-18);
  far.fillStyle(0x2a203a, 1);
  far.fillTriangle(-40, 410, 190, 205, 405, 410);
  far.fillTriangle(235, 410, 500, 230, 750, 410);
  far.fillTriangle(590, 410, 815, 205, 1020, 410);
  far.fillStyle(0x342644, 0.5);
  far.fillTriangle(70, 410, 290, 275, 490, 410);
  far.fillTriangle(500, 410, 690, 285, 900, 410);

  // Plane 2: overlapping dark forest silhouettes with irregular branch forks.
  const trees = scene.add.graphics().setDepth(-15);
  const tree = (x: number, base: number, height: number, width: number) => {
    trees.lineStyle(width, 0x17131f, 0.98);
    trees.lineBetween(x, base, x + 2, base - height);
    trees.lineBetween(x + 1, base - height * 0.35, x - 17, base - height * 0.54);
    trees.lineBetween(x + 1, base - height * 0.47, x + 20, base - height * 0.66);
    trees.lineBetween(x + 2, base - height * 0.7, x - 12, base - height * 0.86);
    trees.lineBetween(x + 2, base - height * 0.73, x + 15, base - height * 0.91);
    trees.lineStyle(Math.max(2, width - 2), 0x21182f, 0.95);
    trees.lineBetween(x + 1, base - height * 0.25, x + 11, base - height * 0.39);
  };
  tree(46, 435, 130, 5);
  tree(258, 433, 123, 5);
  tree(620, 435, 128, 5);
  tree(925, 435, 133, 5);
  tree(145, 440, 77, 3);
  tree(840, 440, 88, 3);

  // Plane 3: distant ground haze, restrained and kept behind gameplay objects.
  const haze = scene.add.graphics().setDepth(-12);
  haze.fillStyle(0x5c456c, 0.12);
  haze.fillRect(0, 398, W, 87);
  haze.fillStyle(0x17131f, 0.3);
  haze.fillRect(0, 465, W, 35);

  // Plane 4: small foreground silhouettes at the very bottom edge.
  // These are deliberately low contrast and do not overlap the playable floor.
  const foreground = scene.add.graphics().setDepth(4);
  foreground.fillStyle(0x1b1524, 0.78);
  foreground.fillTriangle(0, 500, 0, 474, 28, 500);
  foreground.fillTriangle(960, 500, 960, 470, 930, 500);
  foreground.fillStyle(0x4a355d, 0.45);
  for (let x = 16; x < W; x += 73) {
    foreground.fillEllipse(x, 496, 17, 3);
  }
}
