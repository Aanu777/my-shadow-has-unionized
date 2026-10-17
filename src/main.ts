import Phaser from "phaser";
import "./style.css";
import { drawShift01Background, preloadShift01Background } from "./levels/shift-01/background";

const W = 960;
const H = 600;

type Platform = { x: number; y: number; w: number; h: number };

class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private player!: Phaser.GameObjects.Container;
  private playerBody!: Phaser.GameObjects.Rectangle;
  private playerArt!: Phaser.GameObjects.Graphics;
  private shadowArt!: Phaser.GameObjects.Graphics;
  private playerVx = 0;
  private playerVy = 0;
  private grounded = false;
  private jumpBuffer = 0;
  private coyoteTime = 0;
  private platforms: Platform[] = [];
  private lanternX = 260;
  private lanternMin = 190;
  private lanternMax = 405;
  private lantern!: Phaser.GameObjects.Container;
  private shadow!: Phaser.GameObjects.Container;
  private shadowLabel!: Phaser.GameObjects.Text;
  private coffee!: Phaser.GameObjects.Container;
  private switchObject!: Phaser.GameObjects.Container;
  private gate!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private demandText!: Phaser.GameObjects.Text;
  private dialogueText!: Phaser.GameObjects.Text;
  private hasCoffee = false;
  private coffeeHintShown = false;
  private demandSatisfied = false;
  private switchOn = false;
  private won = false;
  private transitioning = false;
  private level = 1;
  private eWasDown = false;
  private rWasDown = false;
  private enterWasDown = false;
  private messageUntil = 0;
  private message = "THE SHADOW IS ON A BREAK. AGAIN.";
  private floorY = 500;

  constructor() { super("GameScene"); }
  preload(): void { preloadShift01Background(this); }

  create(): void {
    this.level = Number(this.registry.get("shiftLevel") ?? 1);
    // Scene.restart reuses this scene instance: reset every run/shift flag here.
    this.transitioning = false;
    this.won = false;
    this.hasCoffee = false;
    this.coffeeHintShown = false;
    this.demandSatisfied = false;
    this.switchOn = false;
    this.playerVx = 0;
    this.playerVy = 0;
    this.grounded = false;
    this.jumpBuffer = 0;
    this.coyoteTime = 0;
    this.eWasDown = false;
    this.rWasDown = false;
    this.enterWasDown = false;
    this.messageUntil = 0;
    this.message = "THE SHADOW IS ON A BREAK. AGAIN.";
    this.lanternX = this.level === 1 ? 260 : 350;
    this.lanternMin = this.level === 1 ? 190 : 175;
    this.lanternMax = this.level === 1 ? 405 : 405;
    this.cameras.main.setBackgroundColor(this.level === 1 ? "#17131f" : "#101c22");
    // Do not draw Shift 01's SVG into Shift 02; each shift owns its backdrop.
    if (this.level === 1) drawShift01Background(this);
    else this.drawLevelTwoBackdrop();
    this.createAtmosphere();

    // Only the solid ground remains. All floating platforms are removed.
    this.platforms = [{ x: 0, y: this.floorY, w: W, h: H - this.floorY }];
    this.drawPlatforms();

    this.player = this.makePumpkin(105, 483);
    this.player.setDepth(5);
    this.playerBody = this.add.rectangle(0, 0, 30, 34, 0xffffff, 0);
    this.player.add(this.playerBody);
    this.playerArt = this.player.getAt(1) as Phaser.GameObjects.Graphics;

    this.lantern = this.makeLantern(this.lanternX, 438);
    this.tweens.add({ targets: this.lantern, scaleX: 1.055, scaleY: 1.055, duration: 920, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.shadow = this.makeShadow(500, 460);
    this.shadowArt = this.shadow.getAt(0) as Phaser.GameObjects.Graphics;
    this.shadowLabel = this.add.text(0, 0, "ON BREAK", {
      fontFamily: "monospace", fontSize: "10px", color: "#c5a8ff",
      backgroundColor: "#21182f", padding: { x: 5, y: 3 }
    }).setOrigin(0.5);

    this.coffee = this.makeCoffee(this.level === 1 ? 342 : 475, 467, this.level === 1 ? "COFFEE" : "FUSE");
    this.switchObject = this.makeSwitch(670, 470);
    this.gate = this.makeGate(865, 425);
    this.gate.setDepth(3);

    this.statusText = this.add.text(28, 24, this.level === 1 ? "PROBATION  //  SHIFT 01" : "NIGHT AUDIT  //  SHIFT 02", {
      fontFamily: "monospace", fontSize: "13px", color: "#f39a45", letterSpacing: 2
    }).setScrollFactor(0);
    this.demandText = this.add.text(28, 48, this.level === 1 ? "UNION DEMAND: ONE (1) COFFEE BREAK" : "OBJECTIVE: RECOVER THE FUSE", {
      fontFamily: "monospace", fontSize: "12px", color: "#d8cfe6"
    }).setScrollFactor(0);
    this.dialogueText = this.add.text(W / 2, 550, this.message, {
      fontFamily: "monospace", fontSize: "12px", color: "#f0e8d8",
      backgroundColor: "#21182f", padding: { x: 12, y: 7 },
      align: "center", wordWrap: { width: 820 }
    }).setOrigin(0.5).setDepth(8);

    this.add.text(W - 26, 24,
      "MOVE  A/D OR ←/→\nJUMP  SPACE / W / ↑\nINTERACT  E   •   ENTER  EXIT\nRESTART  R", {
      fontFamily: "monospace", fontSize: "11px", color: "#d8cfe6",
      backgroundColor: "#21182f", padding: { x: 10, y: 8 },
      lineSpacing: 5, align: "right"
    }).setOrigin(1, 0).setDepth(8);

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys("A,D,W,E,R,ENTER") as Record<string, Phaser.Input.Keyboard.Key>;
    }
    this.physicslessHint();
    this.refreshShadow();
  }

  private physicslessHint(): void {
    this.add.text(28, 78,
      this.level === 1
        ? "GOAL: GET COFFEE → ALIGN LANTERN RIGHT → ACTIVATE SWITCH.\nAT EXIT, PRESS ENTER TO LOAD SHIFT 02."
        : "GOAL: RECOVER FUSE → ALIGN LANTERN LEFT → ACTIVATE SWITCH.\nAT EXIT, PRESS ENTER TO FINISH SHIFT 02.", {
      fontFamily: "monospace", fontSize: "10px", color: "#c5a8ff",
      backgroundColor: "#21182f", padding: { x: 8, y: 6 },
      lineSpacing: 4, wordWrap: { width: 440 }
    }).setDepth(8);
  }

  update(_time: number, delta: number): void {
    if (this.transitioning) return;
    if (this.won) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.restartFromShiftOne();
      return;
    }
    const dt = Math.min(delta / 1000, 0.033);
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up)
      || Phaser.Input.Keyboard.JustDown(this.cursors.space)
      || Phaser.Input.Keyboard.JustDown(this.keys.W);

    const targetVx = left === right ? 0 : left ? -230 : 230;
    // Ease into movement and settle naturally instead of snapping between full speed and stillness.
    const acceleration = targetVx === 0 ? 13 : 18;
    this.playerVx = Phaser.Math.Linear(
      this.playerVx,
      targetVx,
      Math.min(1, dt * acceleration)
    );
    if (jumpPressed) this.jumpBuffer = 0.14;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.grounded) this.coyoteTime = 0.11;
    else this.coyoteTime = Math.max(0, this.coyoteTime - dt);
    if (this.jumpBuffer > 0 && (this.grounded || this.coyoteTime > 0)) {
      this.playerVy = -455; this.grounded = false; this.coyoteTime = 0; this.jumpBuffer = 0;
    }
    this.playerVy += 1050 * dt;

    const oldX = this.player.x;
    const oldY = this.player.y;
    let nextX = Phaser.Math.Clamp(oldX + this.playerVx * dt, 18, W - 18);
    let nextY = oldY + this.playerVy * dt;
    this.grounded = false;

    const playerLeft = nextX - 15;
    const playerRight = nextX + 15;
    const oldFeet = oldY + 17;
    const nextFeet = nextY + 17;
    for (const p of this.platforms) {
      const overlapsX = playerRight > p.x && playerLeft < p.x + p.w;
      if (overlapsX && this.playerVy >= 0 && oldFeet <= p.y + 2 && nextFeet >= p.y) {
        nextY = p.y - 17;
        this.playerVy = 0;
        this.grounded = true;
      }
    }
    if (nextY > H + 80) {
      nextX = 105; nextY = 483; this.playerVy = 0;
      this.say("YOU HAVE FALLEN OUTSIDE THE EMPLOYEE HANDBOOK.");
    }

    this.player.setPosition(nextX, nextY);
    this.player.setScale(this.playerVx < 0 ? -1 : 1, 1);
    const moving = this.grounded && Math.abs(this.playerVx) > 8;
    const walkCycle = this.time.now * 0.016;
    const bob = moving ? Math.abs(Math.sin(walkCycle)) * 2.2 : Math.sin(this.time.now * 0.003) * 0.45;
    this.playerArt.setY(bob);
    this.playerArt.setAngle(moving ? Math.sin(walkCycle) * 2.2 : Math.sin(this.time.now * 0.0025) * 0.4);
    const faceArt = this.player.getAt(2) as Phaser.GameObjects.Graphics;
    faceArt.setY(bob);
    faceArt.setAngle(moving ? Math.sin(walkCycle) * 2.2 : Math.sin(this.time.now * 0.0025) * 0.4);
    this.playerArt.setScale(
      moving ? 1 + Math.sin(walkCycle) * 0.035 : 1,
      moving ? 1 - Math.sin(walkCycle) * 0.045 : 1 + Math.sin(this.time.now * 0.003) * 0.012
    );

    const eDown = this.keys.E.isDown;
    if (eDown && !this.eWasDown) this.interact();
    this.eWasDown = eDown;
    const rDown = this.keys.R.isDown;
    if (rDown && !this.rWasDown) this.restartFromShiftOne();
    this.rWasDown = rDown;
    const enterDown = this.keys.ENTER.isDown;
    if (enterDown && !this.enterWasDown && this.switchOn && this.isAtExit()) this.handleExitEnter();
    this.enterWasDown = enterDown;

    this.refreshShadow();
    this.updateCoffee();
    this.updateGate();
    if (this.time.now > this.messageUntil && this.messageUntil !== 0) {
      this.dialogueText.setText("A/D MOVE   SPACE JUMP   E INTERACT");
      this.messageUntil = 0;
    }
  }

  private createAtmosphere(): void {
    const fireflyPoints = [
      [82, 365], [145, 330], [220, 286], [318, 365], [375, 310],
      [430, 355], [535, 290], [585, 345], [700, 315], [742, 365],
      [835, 300], [900, 355], [510, 420], [290, 445], [760, 445]
    ];
    fireflyPoints.forEach(([x, y], i) => {
      const dot = this.add.circle(x, y, i % 4 === 0 ? 2 : 1.4, this.level === 2 ? (i % 3 === 0 ? 0x9ce2c4 : 0x5f9380) : (i % 3 === 0 ? 0xf39a45 : 0xc5a8ff), 0.15).setDepth(1);
      this.tweens.add({
        targets: dot, alpha: { from: 0.12, to: i % 3 === 0 ? 0.85 : 0.58 },
        scale: { from: 0.75, to: 1.5 }, x: x + (i % 2 === 0 ? 10 : -12),
        y: y - (8 + (i % 5) * 3), duration: 1500 + (i % 5) * 360,
        yoyo: true, repeat: -1, delay: i * 95, ease: "Sine.inOut"
      });
    });
    for (let i = 0; i < 5; i++) {
      const spark = this.add.circle(this.lanternX + (i - 2) * 12, 414 - (i % 3) * 8, 1.5, this.level === 2 ? 0xb5efd3 : 0xffdf91, 0.6).setDepth(4);
      this.tweens.add({
        targets: spark, y: spark.y - 9 - (i % 3) * 3, alpha: 0,
        duration: 700 + i * 130, delay: i * 170, repeat: -1,
        onRepeat: () => {
          spark.setPosition(this.lanternX + (i - 2) * 12, 414 - (i % 3) * 8);
          spark.setAlpha(0.6);
        }, ease: "Sine.out"
      });
    }
  }

  private drawPlatforms(): void {
    const g = this.add.graphics().setDepth(2);
    for (const p of this.platforms) {
      const ground = p.y >= 450;
      g.fillStyle(this.level === 2 ? 0x17252b : 0x21172f, 1);
      g.fillRect(p.x, p.y, p.w, p.h);
      g.fillStyle(this.level === 2 ? 0x79a38c : 0x8f5a43, 1);
      g.fillRect(p.x, p.y, p.w, 3);
      g.fillStyle(this.level === 2 ? 0x314b48 : 0x50305f, 0.9);
      g.fillRect(p.x, p.y + 3, p.w, 2);
      if (ground) {
        for (let x = p.x + 5; x < p.x + p.w - 3; x += 8) {
          const n = (Math.floor(x * 13) % 5);
          g.lineStyle(1, this.level === 2 ? 0x79a38c : (n % 2 === 0 ? 0x8b5b4d : 0xc18b55), 0.88);
          g.lineBetween(x, p.y + 1, x - 1, p.y - 2 - n);
        }
        g.lineStyle(1, this.level === 2 ? 0x35544d : 0x3d294c, 0.95);
        for (let x = p.x + 12; x < p.x + p.w - 4; x += 27) {
          g.lineBetween(x, p.y + 11, x, Math.min(p.y + 39, p.y + p.h - 2));
        }
        g.fillStyle(this.level === 2 ? 0x142126 : 0x130e1c, 0.75);
        for (let x = p.x + 19; x < p.x + p.w - 10; x += 61) {
          g.fillRect(x, p.y + 17 + (x % 7), 7, 2);
        }
      }
    }
    const mushrooms = this.add.graphics().setDepth(3);
    for (const [x, y] of [[58, 500], [285, 500], [744, 500], [928, 500]]) {
      mushrooms.fillStyle(0xd9c9b7, 0.95);
      mushrooms.fillRect(x - 1, y - 1, 3, 6);
      mushrooms.fillStyle(0x9c5268, 1);
      mushrooms.fillEllipse(x, y - 3, 11, 7);
      mushrooms.fillStyle(0xf0e8d8, 0.95);
      mushrooms.fillRect(x - 3, y - 4, 2, 2);
      mushrooms.fillRect(x + 1, y - 2, 2, 2);
    }
  }

  private makePumpkin(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const groundShadow = this.add.graphics();
    groundShadow.fillStyle(0x05040a, 0.42);
    groundShadow.fillEllipse(0, 19, 48, 11);
    groundShadow.fillStyle(0xf39a45, 0.12);
    groundShadow.fillEllipse(0, 18, 35, 7);
    c.add(groundShadow);

    // Layered, hand-drawn pumpkin body: dark silhouette, lobes, carved grooves and rim light.
    const g = this.add.graphics();
    g.fillStyle(0x3b1721, 1);
    g.fillEllipse(0, 0, 39, 35);
    g.fillStyle(0xb94725, 1);
    g.fillEllipse(-9, 1, 19, 31);
    g.fillEllipse(9, 1, 19, 31);
    g.fillStyle(0xf17a2e, 1);
    g.fillEllipse(0, 0, 23, 32);
    g.fillStyle(0xffa447, 0.92);
    g.fillEllipse(-2, -3, 14, 24);
    g.fillStyle(0xd95a26, 1);
    g.fillEllipse(-15, 1, 7, 24);
    g.fillEllipse(15, 1, 7, 24);
    g.lineStyle(1.5, 0x8f351f, 0.9);
    g.beginPath(); g.arc(-8, 0, 10, -1.18, 1.18, false); g.strokePath();
    g.beginPath(); g.arc(8, 0, 10, Math.PI - 1.18, Math.PI + 1.18, false); g.strokePath();
    g.lineStyle(1, 0xffbd67, 0.72);
    g.lineBetween(-7, -12, -9, -5);
    g.lineBetween(2, -13, 3, -6);
    // Stem and a small leaf make the silhouette readable even at game scale.
    g.fillStyle(0x493a22, 1); g.fillRoundedRect(-4, -22, 8, 11, 2);
    g.fillStyle(0x759447, 1); g.fillRoundedRect(-2, -23, 4, 9, 1);
    g.fillStyle(0x9bb85b, 1);
    g.fillEllipse(7, -20, 13, 5);
    g.lineStyle(1, 0x4e6c38, 1); g.lineBetween(2, -20, 12, -20);
    c.add(g);

    const face = this.add.graphics();
    // Warm, glowing carved eyes with dark sockets and sharp pumpkin-gold pupils.
    face.fillStyle(0x401821, 1);
    face.fillTriangle(-11, -7, -3, 1, -12, 2);
    face.fillTriangle(11, -7, 3, 1, 12, 2);
    face.fillStyle(0xffd36e, 1);
    face.fillTriangle(-9, -5, -5, 0, -10, 0);
    face.fillTriangle(9, -5, 5, 0, 10, 0);
    face.fillStyle(0x401821, 1);
    face.fillTriangle(-8, 5, -4, 7, -6, 10);
    face.fillTriangle(-4, 7, 0, 5, 0, 10);
    face.fillTriangle(0, 5, 4, 7, 0, 10);
    face.fillTriangle(4, 7, 8, 5, 6, 10);
    face.fillStyle(0xffd36e, 0.92);
    face.fillTriangle(-7, 5, 7, 5, 0, 12);
    face.fillStyle(0x7e291f, 1);
    face.fillTriangle(-3, 6, 0, 10, 1, 6);
    c.add(face);
    return c;
  }

  private makeLantern(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const aura = this.add.circle(0, -15, 53, 0xf39a45, 0.055);
    const glow = this.add.circle(0, -15, 34, 0xffa33f, 0.11);
    const g = this.add.graphics();
    // Antique iron lantern with a glass chamber, brass rails and a living flame.
    g.fillStyle(0x17131b, 0.92); g.fillRoundedRect(-15, -31, 30, 31, 5);
    g.fillStyle(0x6b3a26, 1); g.fillRoundedRect(-12, -29, 24, 25, 4);
    g.fillStyle(0x321f25, 1); g.fillRoundedRect(-9, -26, 18, 20, 3);
    g.fillStyle(0xf39a45, 0.28); g.fillRoundedRect(-7, -24, 14, 17, 2);
    g.fillStyle(0xffb84f, 0.28); g.fillEllipse(0, -15, 25, 27);
    g.fillStyle(0xffd36e, 1);
    g.fillTriangle(0, -25, -5, -13, -2, -7);
    g.fillTriangle(0, -23, 5, -12, 1, -9);
    g.fillStyle(0xfff0b2, 1); g.fillTriangle(0, -21, -2, -12, 2, -13);
    g.lineStyle(2, 0xe0b86e, 1); g.strokeRoundedRect(-15, -31, 30, 31, 5);
    g.lineStyle(1, 0x8d613c, 1);
    g.lineBetween(-9, -27, -9, -5); g.lineBetween(9, -27, 9, -5);
    g.lineBetween(0, -28, 0, -4);
    g.fillStyle(0x3b2a2c, 1); g.fillRoundedRect(-16, -34, 32, 5, 2);
    g.fillStyle(0xd8ad68, 1); g.fillRoundedRect(-12, -35, 24, 3, 1);
    g.fillStyle(0x3b2a2c, 1); g.fillRoundedRect(-13, -3, 26, 6, 2);
    g.fillStyle(0xd8ad68, 1); g.fillRoundedRect(-10, -2, 20, 2, 1);
    g.lineStyle(2, 0xe0b86e, 1);
    g.beginPath(); g.arc(0, -34, 9, Math.PI, 0, false); g.strokePath();
    g.lineStyle(1, 0x9b7549, 1); g.beginPath(); g.arc(0, -34, 6, Math.PI, 0, false); g.strokePath();
    g.fillStyle(0xe0b86e, 1); g.fillCircle(-13, -30, 2); g.fillCircle(13, -30, 2);
    c.add([aura, glow, g]); c.setDepth(3); return c;
  }

  private makeShadow(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x05040b, 0.96);
    g.fillEllipse(0, -3, 33, 35);
    g.fillTriangle(-15, 2, -12, 22, -4, 9);
    g.fillTriangle(-5, 8, 2, 25, 5, 7);
    g.fillTriangle(5, 7, 13, 21, 15, 0);
    g.fillStyle(0x191126, 1);
    g.fillEllipse(0, -8, 23, 25);
    g.fillStyle(0x9c7be8, 0.2);
    g.fillEllipse(0, -7, 29, 31);
    g.fillStyle(0xe0d0ff, 1);
    g.fillTriangle(-9, -8, -3, -5, -10, -3);
    g.fillTriangle(9, -8, 3, -5, 10, -3);
    g.fillStyle(0x9c7be8, 0.8);
    g.fillTriangle(-2, 2, 2, 2, 0, 7);
    c.add(g); c.setDepth(4); return c;
  }

  private makeCoffee(x: number, y: number, label = "COFFEE"): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    if (label === "FUSE") {
      g.fillStyle(0x182d2d, 1); g.fillRoundedRect(-12, -10, 24, 20, 3);
      g.lineStyle(2, 0x9ce2c4, 1); g.strokeRoundedRect(-12, -10, 24, 20, 3);
      g.fillStyle(0x9ce2c4, 1); g.fillRect(-5, -6, 10, 12);
      g.fillStyle(0xd7f3e6, 1); g.fillRect(-2, -13, 4, 3); g.fillRect(-2, 10, 4, 3);
    } else {
      // Takeaway cup with a dark plum sleeve, brass rim, and warm coffee surface.
      g.fillStyle(0x09070f, 0.35); g.fillEllipse(0, 8, 34, 7);
      g.fillStyle(0xe4d3bd, 1); g.fillRoundedRect(-10, -12, 20, 19, 3);
      g.fillStyle(0x392344, 1); g.fillRoundedRect(-9, -5, 18, 9, 2);
      g.fillStyle(0xc18b55, 1); g.fillRect(-10, -12, 20, 3);
      g.fillStyle(0x2a172f, 1); g.fillRoundedRect(-8, -15, 16, 4, 2);
      g.fillStyle(0x6b3c2d, 1); g.fillEllipse(0, -12, 13, 3);
      g.lineStyle(3, 0xe4d3bd, 1); g.strokeCircle(11, -3, 5);
      g.lineStyle(1, 0xc18b55, 1); g.strokeCircle(11, -3, 3);
      g.fillStyle(0xc18b55, 1); g.fillCircle(0, 0, 2);
      g.lineStyle(2, 0xf5bd70, 0.8);
      g.beginPath(); g.moveTo(-4, -17); g.lineTo(-6, -21); g.moveTo(3, -17); g.lineTo(1, -22); g.strokePath();
      g.fillStyle(0xf5bd70, 0.9); g.fillCircle(-6, -23, 1.2); g.fillCircle(1, -24, 1.2);
    }
    c.add(g); c.setDepth(5);
    this.add.text(x, y + 15, label, { fontFamily: "monospace", fontSize: "9px", color: label === "FUSE" ? "#9ce2c4" : "#f0e8d8" }).setOrigin(0.5);
    return c;
  }

  private makeSwitch(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x21182f, 1); g.fillRoundedRect(-17, -20, 34, 29, 4);
    g.lineStyle(2, 0x7055a5, 1); g.strokeRoundedRect(-17, -20, 34, 29, 4);
    g.fillStyle(0x7055a5, 1); g.fillCircle(0, -6, 8);
    g.fillStyle(0xf0e8d8, 1); g.fillCircle(0, -6, 3);
    g.lineStyle(2, 0x7055a5, 0.85);
    g.lineBetween(-8, -25, 8, -25);
    c.add(g);
    this.add.text(x, y + 16, "SWITCH", { fontFamily: "monospace", fontSize: "9px", color: "#c5b7d7" }).setOrigin(0.5);
    return c;
  }

  private makeGate(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const art = this.add.graphics();
    this.drawGateArt(art, false);
    c.add(art);
    this.add.text(x, y + 73, this.level === 2 ? "EXIT 02" : "EXIT 01", {
      fontFamily: "monospace", fontSize: "10px",
      color: this.level === 2 ? "#9ce2c4" : "#f39a45",
      backgroundColor: "#17131f", padding: { x: 5, y: 3 }
    }).setOrigin(0.5).setDepth(6);
    return c;
  }

  private drawGateArt(g: Phaser.GameObjects.Graphics, active: boolean): void {
    const levelTwo = this.level === 2;
    const stone = levelTwo ? 0x263b3d : 0x30213f;
    const stoneLight = levelTwo ? 0x52776e : 0x67436f;
    const trim = levelTwo ? 0x79a38c : 0x8d5aab;
    const flame = levelTwo ? 0x9ce2c4 : 0xffa13b;
    const hot = levelTwo ? 0xd7f3e6 : 0xffdf91;

    // Cast shadow and broad, broken-stone plinth.
    g.fillStyle(0x05040a, 0.5); g.fillEllipse(0, 60, 100, 13);
    g.fillStyle(0x15121d, 1); g.fillRoundedRect(-43, -48, 86, 108, 7);
    g.fillStyle(stone, 1); g.fillRoundedRect(-39, -45, 78, 103, 6);
    g.fillStyle(stoneLight, 1); g.fillRoundedRect(-34, -41, 68, 96, 5);

    // Pointed gothic arch, double rim, and tall side buttresses.
    g.fillStyle(0x15111e, 1);
    g.fillTriangle(-39, -28, 0, -82, 39, -28);
    g.fillRect(-39, -30, 78, 83);
    g.fillStyle(stone, 1);
    g.fillTriangle(-32, -28, 0, -72, 32, -28);
    g.fillRect(-32, -28, 64, 81);
    g.lineStyle(4, trim, 1);
    g.beginPath(); g.moveTo(-33, 48); g.lineTo(-33, -26); g.lineTo(0, -75); g.lineTo(33, -26); g.lineTo(33, 48); g.strokePath();
    g.lineStyle(1, hot, 0.45);
    g.beginPath(); g.moveTo(-26, 44); g.lineTo(-26, -25); g.lineTo(0, -64); g.lineTo(26, -25); g.lineTo(26, 44); g.strokePath();

    // Dark doorway with a sealed, smoky void.
    g.fillStyle(0x090811, 1);
    g.fillTriangle(-25, -23, 0, -59, 25, -23);
    g.fillRect(-25, -23, 50, 68);
    g.fillStyle(levelTwo ? 0x142421 : 0x21132e, 1);
    g.fillEllipse(0, 5, 43, 70);
    g.fillStyle(flame, active ? 0.16 : 0.07);
    g.fillEllipse(0, 3, 34, 60);
    g.lineStyle(2, trim, active ? 0.9 : 0.65);
    g.beginPath(); g.arc(0, 4, 17, -1.2, 1.4, false); g.strokePath();
    g.beginPath(); g.arc(0, 4, 11, 1.8, 4.5, false); g.strokePath();

    if (active) {
      // Open portal: a bright, spiralling path draws the eye through the doorway.
      g.lineStyle(3, flame, 0.95);
      g.beginPath(); g.arc(0, 3, 23, -1.35, 1.25, false); g.strokePath();
      g.lineStyle(2, hot, 0.9);
      g.beginPath(); g.arc(0, 3, 14, 0.15, 4.95, false); g.strokePath();
      g.fillStyle(hot, 1); g.fillCircle(0, -1, 4);
      g.fillStyle(flame, 0.95);
      g.fillCircle(-17, -13, 2); g.fillCircle(16, 9, 2); g.fillCircle(10, -21, 1.5);
    } else {
      // The locked portal has two ember eyes beneath the pumpkin crest.
      g.fillStyle(levelTwo ? 0x9ce2c4 : 0xc5a8ff, 0.9);
      g.fillTriangle(-13, -1, -5, 3, -14, 5);
      g.fillTriangle(13, -1, 5, 3, 14, 5);
    }

    // Buttress pillars, engraved runes, and little caged side flames.
    for (const side of [-1, 1]) {
      g.fillStyle(0x17121e, 1); g.fillRect(side * 36 - 5, -15, 10, 62);
      g.fillStyle(stoneLight, 1); g.fillRect(side * 36 - 3, -13, 6, 58);
      g.fillStyle(flame, active ? 0.95 : 0.55);
      g.fillTriangle(side * 36, -7, side * 33, 0, side * 38, 2);
      g.lineStyle(1, hot, 0.75);
      g.lineBetween(side * 36, 14, side * 36 - side * 2, 20);
      g.lineBetween(side * 36 - side * 2, 20, side * 36, 26);
      g.fillStyle(0x17121e, 1); g.fillRect(side * 36 - 8, -19, 16, 5);
      g.fillStyle(trim, 1); g.fillRect(side * 36 - 7, -18, 14, 2);
    }

    // Spiked crown and a tiny carved jack-o'-lantern emblem to match the player.
    g.fillStyle(0x17121e, 1);
    g.fillTriangle(-28, -48, -37, -70, -16, -51);
    g.fillTriangle(28, -48, 37, -70, 16, -51);
    g.fillStyle(stoneLight, 1);
    g.fillTriangle(-27, -50, -35, -66, -18, -52);
    g.fillTriangle(27, -50, 35, -66, 18, -52);
    g.fillStyle(0x211521, 1); g.fillCircle(0, -57, 15);
    g.fillStyle(levelTwo ? 0x45695c : 0x8f432c, 1); g.fillCircle(0, -57, 12);
    g.fillStyle(levelTwo ? 0x9ce2c4 : 0xf17a2e, 1); g.fillEllipse(0, -57, 18, 17);
    g.fillStyle(hot, active ? 1 : 0.88);
    g.fillTriangle(-7, -60, -2, -55, -8, -54);
    g.fillTriangle(7, -60, 2, -55, 8, -54);
    g.fillTriangle(-6, -52, 6, -52, 0, -48);
    g.fillStyle(0x759447, 1); g.fillRoundedRect(-2, -72, 4, 5, 1);
    g.lineStyle(2, trim, 1); g.lineBetween(-27, 52, 27, 52);
    g.fillStyle(hot, active ? 0.95 : 0.45); g.fillCircle(0, 52, 3);
  }

  private refreshShadow(): void {
    const projectedX = Phaser.Math.Clamp(this.lanternX + 180 + (this.player.x - 260) * 0.22, 445, 625);
    const projectedY = this.demandSatisfied ? 447 : 463;
    const shadowBob = Math.sin(this.time.now * 0.004) * 2;
    this.shadow.setPosition(projectedX, projectedY + shadowBob);
    this.shadow.setAlpha(this.demandSatisfied ? 1 : 0.78);
    this.shadow.setScale(1 + Math.sin(this.time.now * 0.003) * 0.035, 1 - Math.sin(this.time.now * 0.003) * 0.025);
    this.shadowArt.clear();
    this.shadowArt.fillStyle(0x05040b, 0.96);
    this.shadowArt.fillEllipse(0, -3, 33, 35);
    this.shadowArt.fillTriangle(-15, 2, -12, 22, -4, 9);
    this.shadowArt.fillTriangle(-5, 8, 2, 25, 5, 7);
    this.shadowArt.fillTriangle(5, 7, 13, 21, 15, 0);
    this.shadowArt.fillStyle(0x191126, 1);
    this.shadowArt.fillEllipse(0, -8, 23, 25);
    this.shadowArt.fillStyle(this.demandSatisfied ? 0xf39a45 : 0x9c7be8, 0.22);
    this.shadowArt.fillEllipse(0, -7, 29, 31);
    this.shadowArt.fillStyle(this.demandSatisfied ? 0xffdf91 : 0xe0d0ff, 1);
    this.shadowArt.fillTriangle(-9, -8, -3, -5, -10, -3);
    this.shadowArt.fillTriangle(9, -8, 3, -5, 10, -3);
    this.shadowArt.fillStyle(this.demandSatisfied ? 0xf39a45 : 0x9c7be8, 0.9);
    this.shadowArt.fillTriangle(-2, 2, 2, 2, 0, 7);
    this.shadowLabel.setPosition(projectedX, projectedY - 31);
    this.shadowLabel.setText(this.demandSatisfied ? "READY TO WORK" : "ON BREAK");
    this.shadowLabel.setColor(this.demandSatisfied ? "#f39a45" : "#c5a8ff");
    let route = this.data.get("routeGraphics") as Phaser.GameObjects.Graphics | undefined;
    if (!route) { route = this.add.graphics(); route.setDepth(2); this.data.set("routeGraphics", route); }
    route.clear();

    // The lantern's position determines where the shadow appears; this dotted route
    // then leads toward the switch so the player can read the puzzle at a glance.
    const routeColor = this.level === 2 ? (this.demandSatisfied ? 0x9ce2c4 : 0x4e8d83) : (this.demandSatisfied ? 0xf39a45 : 0x7055a5);
    const routeAlpha = this.demandSatisfied ? 0.95 : 0.55;
    route.lineStyle(1, routeColor, routeAlpha * 0.45);
    route.lineBetween(this.lanternX, 456, projectedX, 480);
    for (let x = projectedX; x < this.switchObject.x - 18; x += 14) {
      const progress = (x - projectedX) / Math.max(1, this.switchObject.x - projectedX);
      const y = Phaser.Math.Linear(projectedY + 17, 480, progress)
        - Math.sin(progress * Math.PI) * 10
        + Math.sin((x + this.time.now * 0.05) * 0.04) * 2;
      route.fillStyle(routeColor, routeAlpha);
      route.fillCircle(x, y, this.demandSatisfied ? 2.4 : 1.8);
    }
    route.fillStyle(routeColor, routeAlpha);
    route.fillCircle(this.switchObject.x - 20, 480, this.demandSatisfied ? 3 : 2);
  }

  private updateCoffee(): void {
    const nearCoffee = !this.hasCoffee
      && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.coffee.x, this.coffee.y) < 38;

    // Only show the proximity hint once per approach; don't reset the dialogue timer every frame.
    if (nearCoffee && !this.coffeeHintShown) {
      this.say(this.level === 1 ? "PRESS E TO OFFER THE SHADOW A COFFEE." : "PRESS E TO PICK UP THE FUSE.");
      this.coffeeHintShown = true;
    } else if (!nearCoffee) {
      this.coffeeHintShown = false;
    }
  }

  private interact(): void {
    const px = this.player.x;
    if (!this.hasCoffee && Phaser.Math.Distance.Between(px, this.player.y, this.coffee.x, this.coffee.y) < 55) {
      this.hasCoffee = true; this.coffee.setVisible(false); this.demandSatisfied = true;
      this.demandText.setText(this.level === 1 ? "UNION DEMAND: COFFEE BREAK APPROVED ✓" : "FUSE RECOVERED ✓  //  ALIGN LANTERN LEFT");
      this.say(this.level === 1 ? "SHADOW: 'Acceptable. I will consider doing my job.'" : "FUSE SECURED. THE LANTERN MUST BE MOVED LEFT.");
      this.refreshShadow(); return;
    }
    if (Phaser.Math.Distance.Between(px, this.player.y, this.lanternX, 438) < 72) {
      const direction = px < this.lanternX ? 1 : -1;
      this.lanternX = Phaser.Math.Clamp(this.lanternX + direction * 45, this.lanternMin, this.lanternMax);
      this.lantern.setX(this.lanternX); this.say("LANTERN REPOSITIONED. SHADOW ROUTE UPDATED."); this.refreshShadow(); return;
    }
    if (Phaser.Math.Distance.Between(px, this.player.y, this.switchObject.x, this.switchObject.y) < 65) {
      if (!this.demandSatisfied) {
        this.say(this.level === 1 ? "GET THE SHADOW ITS COFFEE FIRST." : "RECOVER THE FUSE FIRST.");
        return;
      }
      const aligned = this.level === 1 ? this.lanternX >= 350 : this.lanternX <= 245;
      if (!aligned) {
        this.say(this.level === 1 ? "LANTERN MISALIGNED. MOVE IT RIGHT." : "LANTERN MISALIGNED. MOVE IT LEFT INTO THE GREEN ZONE.");
        return;
      }
      if (!this.switchOn) {
        this.switchOn = true;
        const switchArt = this.switchObject.getAt(0) as Phaser.GameObjects.Graphics;
        switchArt.clear();
        const color = this.level === 2 ? 0x9ce2c4 : 0xf39a45;
        switchArt.fillStyle(0x21182f, 1); switchArt.fillRoundedRect(-17, -20, 34, 29, 4);
        switchArt.lineStyle(2, color, 1); switchArt.strokeRoundedRect(-17, -20, 34, 29, 4);
        switchArt.fillStyle(color, 1); switchArt.fillCircle(0, -6, 8);
        switchArt.fillStyle(0xffdf91, 1); switchArt.fillCircle(0, -6, 3);
        this.say(this.level === 1 ? "SWITCH ONLINE. REACH EXIT 01 AND PRESS ENTER." : "CIRCUIT RESTORED. REACH EXIT 02.");
        this.updateGate();
      } else this.say("SWITCH IS ALREADY ONLINE. REACH THE EXIT.");
      return;
    }
    if (Phaser.Math.Distance.Between(px, this.player.y, this.shadow.x, this.shadow.y) < 70 && !this.demandSatisfied) {
      this.say(this.level === 1 ? "SHADOW: 'I am legally entitled to one (1) coffee.'" : "THE FUSE CIRCUIT IS STILL OFFLINE."); return;
    }
    this.say(this.level === 1 ? "GET COFFEE, ALIGN THE LANTERN RIGHT, THEN ACTIVATE THE SWITCH." : "RECOVER THE FUSE, ALIGN THE LANTERN LEFT, THEN ACTIVATE THE SWITCH.");
  }

  private updateGate(): void {
    const art = this.gate.getAt(0) as Phaser.GameObjects.Graphics;
    art.clear();
    this.drawGateArt(art, this.switchOn);
  }

  private showWin(): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x100d16, 0.88).setDepth(20);
    this.add.text(W / 2, 215, "SHIFT 02 COMPLETE!", {
      fontFamily: "monospace", fontSize: "34px", color: "#f39a45", fontStyle: "bold", align: "center"
    }).setOrigin(0.5).setDepth(21);
    this.add.text(W / 2, 280,
      "You restored the broken circuit and escaped the night forest.\nThe shadow has filed a formal request for paid overtime.\n\nA historic victory for workplace relations.",
      { fontFamily: "monospace", fontSize: "15px", color: "#f0e8d8", align: "center", lineSpacing: 9 }
    ).setOrigin(0.5).setDepth(21);
    this.add.text(W / 2, 385, "PRESS R TO RESTART FROM SHIFT 01", {
      fontFamily: "monospace", fontSize: "12px", color: "#c5a8ff"
    }).setOrigin(0.5).setDepth(21);
  }

  private drawLevelTwoBackdrop(): void {
    const g = this.add.graphics().setDepth(-10);
    // Shift 02 is a derelict lantern foundry swallowed by the swamp.
    g.fillStyle(0x0b171d, 0.96); g.fillRect(0, 245, W, 255);
    g.fillStyle(0x142329, 1);
    // Distant factory skyline with chimneys, roof breaks and tiny lit windows.
    for (const [x, y, w, h] of [[0,342,94,58],[112,348,62,52],[190,335,64,65],[277,348,67,52],[362,332,61,68],[428,350,52,50],[500,342,60,58],[590,347,65,53],[675,338,66,62],[762,350,69,50],[849,342,65,58]]) {
      g.fillRect(x, y, w, h);
      g.fillStyle(0x20383a, 1); g.fillRect(x + 7, y + 9, Math.max(4, w - 14), 2);
      g.fillStyle(0x9ce2c4, 0.62);
      for (let wx = x + 12; wx < x + w - 7; wx += 19) g.fillRect(wx, y + 19 + ((wx + y) % 7), 4, 8);
      g.fillStyle(0x142329, 1);
    }
    g.fillRect(390, 286, 12, 54); g.fillRect(386, 276, 20, 8);
    g.fillRect(704, 307, 14, 38); g.fillRect(700, 297, 22, 8);
    g.fillRect(875, 303, 13, 43); g.fillRect(871, 293, 21, 8);
    // Broken ridge planes create visible depth instead of a flat gradient.
    g.fillStyle(0x203b3a, 1); g.beginPath();
    g.moveTo(0, 397); g.lineTo(76, 354); g.lineTo(136, 369); g.lineTo(206, 315);
    g.lineTo(259, 354); g.lineTo(327, 334); g.lineTo(385, 372); g.lineTo(451, 326);
    g.lineTo(508, 358); g.lineTo(573, 294); g.lineTo(633, 348); g.lineTo(690, 329);
    g.lineTo(754, 364); g.lineTo(816, 311); g.lineTo(866, 348); g.lineTo(921, 316);
    g.lineTo(960, 341); g.lineTo(960, 500); g.lineTo(0, 500); g.closePath(); g.fillPath();
    g.lineStyle(2, 0x5f9380, 0.65); g.beginPath();
    g.moveTo(0,397); g.lineTo(76,354); g.lineTo(136,369); g.lineTo(206,315); g.lineTo(259,354);
    g.lineTo(327,334); g.lineTo(385,372); g.lineTo(451,326); g.lineTo(508,358); g.lineTo(573,294);
    g.lineTo(633,348); g.lineTo(690,329); g.lineTo(754,364); g.lineTo(816,311); g.lineTo(866,348);
    g.lineTo(921,316); g.lineTo(960,341); g.strokePath();
    // Thick pipework and joints across the ruined back wall.
    g.lineStyle(14, 0x0b171d, 1); g.beginPath(); g.moveTo(0,408); g.lineTo(0,383); g.lineTo(105,383); g.lineTo(105,399); g.lineTo(165,399); g.lineTo(165,374); g.lineTo(218,374); g.strokePath();
    g.lineStyle(5, 0x4c7169, 1); g.strokePath();
    g.lineStyle(16, 0x0b171d, 1); g.beginPath(); g.moveTo(585,392); g.lineTo(585,365); g.lineTo(656,365); g.lineTo(656,386); g.lineTo(730,386); g.lineTo(730,354); g.lineTo(804,354); g.lineTo(804,389); g.lineTo(960,389); g.strokePath();
    g.lineStyle(5, 0x4c7169, 1); g.strokePath();
    // Masonry frames and broken brick seams at the edges.
    g.fillStyle(0x17272a, 1); g.fillRect(0,263,47,237); g.fillRect(915,281,45,219);
    g.fillStyle(0x42655d, 1); g.fillRect(0,263,47,7); g.fillRect(915,281,45,7);
    g.lineStyle(1, 0x8bb7a0, 0.24);
    for (let y = 289; y < 490; y += 22) { g.lineBetween(0,y,47,y); g.lineBetween(915,y+9,960,y+9); }
    g.lineStyle(1, 0x54796e, 0.2);
    for (let y = 300; y < 490; y += 28) { g.lineBetween(22,y,22,y+12); g.lineBetween(938,y+9,938,y+22); }
    // Dead swamp trees in the foreground, intentionally different from Shift 01 pines.
    g.fillStyle(0x0b171d, 1);
    for (const [x,y,h] of [[58,394,106],[265,403,97],[630,395,105],[915,392,108]]) {
      g.fillTriangle(x-17,y+70,x,y,x+15,y+70);
      g.fillTriangle(x-15,y+38,x-27,y+53,x-7,y+49);
      g.fillTriangle(x+10,y+51,x+28,y+63,x+9,y+65);
      g.fillRect(x-3,y+58,6,h-58);
    }
    // Pale swamp lights and a cool moon halo.
    g.fillStyle(0x9ce2c4, 0.1); g.fillCircle(760,130,100);
    g.fillStyle(0x9ce2c4, 0.2); g.fillCircle(760,130,44);
    g.fillStyle(0xd7f3e6, 0.42); g.fillCircle(760,130,29);
    for (let i = 0; i < 20; i++) {
      const x = (i * 137 + 31) % W, y = 105 + ((i * 53) % 185);
      g.fillStyle(i % 3 === 0 ? 0x9ce2c4 : 0x78a6a0, 0.4);
      g.fillCircle(x, y, i % 4 === 0 ? 2 : 1);
    }
    // Layered swamp-bank edge; gameplay collision floor remains unchanged at y=500.
    g.fillStyle(0x122629, 1); g.fillRect(0, 500, W, 100);
    g.fillStyle(0x79a38c, 1); g.fillRect(0, 500, W, 4);
    g.fillStyle(0x375d56, 1); g.fillRect(0, 505, W, 4);
    g.lineStyle(2, 0x426d64, 0.8); g.beginPath();
    g.moveTo(0,516); g.lineTo(67,511); g.lineTo(116,521); g.lineTo(187,513); g.lineTo(249,523);
    g.lineTo(321,512); g.lineTo(395,522); g.lineTo(467,514); g.lineTo(545,524); g.lineTo(624,512);
    g.lineTo(701,521); g.lineTo(779,513); g.lineTo(850,522); g.lineTo(916,513); g.lineTo(960,518); g.strokePath();
  }
  private isAtExit(): boolean { return Phaser.Math.Distance.Between(this.player.x,this.player.y,this.gate.x,this.gate.y)<78; }
  private handleExitEnter(): void { if(this.level===1){this.transitionToShiftTwo();return;}this.won=true;this.showWin(); }
  private transitionToShiftTwo(): void {
    if(this.transitioning)return;this.transitioning=true;
    const overlay=this.add.rectangle(W/2,H/2,W,H,0x08070d,1).setDepth(30).setAlpha(0);
    const panel=this.add.rectangle(W/2,H/2,390,142,0x17212a,0.98).setDepth(31).setAlpha(0);
    const title=this.add.text(W/2,H/2-25,"SHIFT CHANGE",{fontFamily:"monospace",fontSize:"24px",color:"#9ce2c4",letterSpacing:3}).setOrigin(0.5).setDepth(32).setAlpha(0);
    const sub=this.add.text(W/2,H/2+16,"RECONFIGURING TERRAIN  //  02",{fontFamily:"monospace",fontSize:"11px",color:"#d7f3e6",letterSpacing:1}).setOrigin(0.5).setDepth(32).setAlpha(0);
    const bar=this.add.rectangle(W/2-150,H/2+48,0,4,0x9ce2c4).setOrigin(0,0.5).setDepth(32);
    this.tweens.add({targets:[overlay,panel,title,sub],alpha:1,duration:260,ease:"Sine.out"});
    this.tweens.add({targets:bar,width:300,duration:1050,delay:180,ease:"Cubic.inOut",onComplete:()=>{this.registry.set("shiftLevel",2);this.scene.restart();}});
  }
  private restartFromShiftOne(): void {this.registry.set("shiftLevel",1);this.scene.restart();}

  private say(text: string): void {
    this.message = text; this.dialogueText.setText(text); this.messageUntil = this.time.now + 2800;
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, parent: "app", width: W, height: H,
  backgroundColor: "#17131f", pixelArt: true, antialias: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  scene: [GameScene]
};

new Phaser.Game(config);
