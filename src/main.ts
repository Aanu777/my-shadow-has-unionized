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
    this.lanternX = this.level === 1 ? 260 : 350;
    this.cameras.main.setBackgroundColor(this.level === 1 ? "#17131f" : "#101c22");
    drawShift01Background(this);
    if (this.level === 2) this.drawLevelTwoBackdrop();
    this.createAtmosphere();

    // Only the solid ground remains. All floating platforms are removed.
    this.platforms = [{ x: 0, y: this.floorY, w: W, h: H - this.floorY }];
    this.drawPlatforms();

    this.player = this.makePumpkin(105, 483);
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
      const dot = this.add.circle(x, y, i % 4 === 0 ? 2 : 1.4, i % 3 === 0 ? 0xf39a45 : 0xc5a8ff, 0.15).setDepth(1);
      this.tweens.add({
        targets: dot, alpha: { from: 0.12, to: i % 3 === 0 ? 0.85 : 0.58 },
        scale: { from: 0.75, to: 1.5 }, x: x + (i % 2 === 0 ? 10 : -12),
        y: y - (8 + (i % 5) * 3), duration: 1500 + (i % 5) * 360,
        yoyo: true, repeat: -1, delay: i * 95, ease: "Sine.inOut"
      });
    });
    for (let i = 0; i < 5; i++) {
      const spark = this.add.circle(260 + (i - 2) * 12, 414 - (i % 3) * 8, 1.5, 0xffdf91, 0.6).setDepth(4);
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
      g.fillStyle(this.level === 2 ? 0x202f35 : 0x30233f, 1);
      g.fillRect(p.x, p.y, p.w, p.h);
      g.fillStyle(this.level === 2 ? 0x79a38c : 0x9b7950, 1);
      g.fillRect(p.x, p.y, p.w, 4);
      if (ground) {
        for (let x = p.x + 5; x < p.x + p.w - 3; x += 8) {
          const n = (Math.floor(x * 13) % 5);
          g.lineStyle(1, this.level === 2 ? 0x79a38c : (n % 2 === 0 ? 0x8b7954 : 0xb5a16a), 0.82);
          g.lineBetween(x, p.y, x - 1, p.y - 3 - n);
        }
        g.lineStyle(1, this.level === 2 ? 0x35544d : 0x5c456b, 0.9);
        for (let x = p.x + 12; x < p.x + p.w - 4; x += 27) {
          g.lineBetween(x, p.y + 11, x, Math.min(p.y + 39, p.y + p.h - 2));
        }
        g.fillStyle(0x241b30, 0.5);
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
    groundShadow.fillStyle(0x000000, 0.28);
    groundShadow.fillEllipse(0, 18, 44, 10);
    c.add(groundShadow);
    const g = this.add.graphics();
    g.fillStyle(0xe8792f, 1);
    g.fillEllipse(0, 0, 34, 31);
    g.fillEllipse(-8, 0, 18, 29);
    g.fillEllipse(8, 0, 18, 29);
    g.fillStyle(0x7c9b52, 1);
    g.fillRoundedRect(-3, -21, 6, 9, 2);
    c.add(g);
    const face = this.add.graphics();
    face.fillStyle(0x24172b, 1);
    face.fillTriangle(-9, -5, -3, 1, -11, 1);
    face.fillTriangle(9, -5, 3, 1, 11, 1);
    face.fillTriangle(-6, 7, 6, 7, 0, 12);
    c.add(face);
    return c;
  }

  private makeLantern(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const glow = this.add.circle(0, -13, 40, 0xf39a45, 0.09);
    const g = this.add.graphics();
    g.lineStyle(2, 0xf0c77c, 1); g.strokeRoundedRect(-11, -28, 22, 26, 4);
    g.fillStyle(0xf39a45, 1); g.fillRoundedRect(-8, -25, 16, 20, 3);
    g.fillStyle(0xffdf91, 1); g.fillTriangle(0, -23, -4, -11, 2, -8);
    g.lineStyle(2, 0xf0c77c, 1);
    g.beginPath(); g.arc(0, -28, 6, Math.PI, 0, false); g.strokePath();
    c.add([glow, g]); c.setDepth(3); return c;
  }

  private makeShadow(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x08070d, 0.92); g.fillEllipse(0, 0, 30, 36);
    g.fillEllipse(-8, -1, 15, 31); g.fillEllipse(8, -1, 15, 31);
    g.fillStyle(0x9c7be8, 1); g.fillCircle(-5, -5, 2); g.fillCircle(5, -5, 2);
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
      g.fillStyle(0xeee1d0, 1); g.fillRoundedRect(-9, -11, 18, 17, 3);
      g.lineStyle(3, 0xeee1d0, 1); g.strokeCircle(10, -3, 5);
      g.fillStyle(0x6d3d29, 1); g.fillRect(-6, -8, 12, 3);
      g.lineStyle(2, 0xf0e8d8, 0.6); g.lineBetween(-4, -16, -6, -21); g.lineBetween(3, -16, 1, -22);
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
    const g = this.add.graphics();
    const frame = this.level === 2 ? 0x79a38c : 0x7055a5;
    const glow = this.level === 2 ? 0x9ce2c4 : 0xf39a45;
    g.fillStyle(0x15141e, 1); g.fillRoundedRect(-34, -61, 68, 122, 8);
    g.fillStyle(this.level === 2 ? 0x233c3c : 0x352747, 1); g.fillRoundedRect(-29, -56, 58, 112, 6);
    g.lineStyle(5, frame, 1); g.strokeRoundedRect(-25, -52, 50, 106, 6);
    g.lineStyle(1, glow, 0.55); g.strokeRoundedRect(-18, -45, 36, 92, 4);
    g.fillStyle(0x101019, 1); g.fillRoundedRect(-15, -41, 30, 88, 4);
    g.lineStyle(2, frame, 0.9); g.lineBetween(-9, -34, -9, 38); g.lineBetween(9, -34, 9, 38);
    g.fillStyle(glow, 0.9); g.fillCircle(0, -7, 7);
    c.add(g);
    this.add.text(x, y + 67, this.level === 2 ? "EXIT 02" : "EXIT 01", { fontFamily: "monospace", fontSize: "10px", color: this.level === 2 ? "#9ce2c4" : "#f39a45" }).setOrigin(0.5);
    return c;
  }

  private refreshShadow(): void {
    const projectedX = Phaser.Math.Clamp(this.lanternX + 180 + (this.player.x - 260) * 0.22, 445, 625);
    const projectedY = this.demandSatisfied ? 447 : 463;
    const shadowBob = Math.sin(this.time.now * 0.004) * 2;
    this.shadow.setPosition(projectedX, projectedY + shadowBob);
    this.shadow.setAlpha(this.demandSatisfied ? 1 : 0.78);
    this.shadow.setScale(1 + Math.sin(this.time.now * 0.003) * 0.035, 1 - Math.sin(this.time.now * 0.003) * 0.025);
    this.shadowArt.clear();
    this.shadowArt.fillStyle(0x08070d, 0.92);
    this.shadowArt.fillEllipse(0, 0, 30, 36);
    this.shadowArt.fillEllipse(-8, -1, 15, 31);
    this.shadowArt.fillEllipse(8, -1, 15, 31);
    this.shadowArt.fillStyle(this.demandSatisfied ? 0xf39a45 : 0x9c7be8, 1);
    this.shadowArt.fillCircle(-5, -5, 2.5); this.shadowArt.fillCircle(5, -5, 2.5);
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
    if (this.switchOn) {
      const art = this.gate.getAt(0) as Phaser.GameObjects.Graphics;
      const frame = this.level === 2 ? 0x79a38c : 0xf39a45;
      const glow = this.level === 2 ? 0x9ce2c4 : 0xffdf91;
      art.clear();
      art.fillStyle(this.level === 2 ? 0x233c3c : 0x352747, 0.55); art.fillRoundedRect(-29,-56,58,112,6);
      art.lineStyle(5,frame,1); art.strokeRoundedRect(-25,-52,50,106,6);
      art.lineStyle(2,glow,0.85); art.strokeRoundedRect(-17,-44,34,90,4);
      art.fillStyle(0x101019,0.4); art.fillRoundedRect(-14,-40,28,86,4);
      art.fillStyle(glow,1); art.fillCircle(0,-7,8);
    }
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
    const g=this.add.graphics().setDepth(-10);
    g.fillStyle(0x102027,0.92);g.fillRect(0,255,W,245);
    g.fillStyle(0x1b3437,1);g.beginPath();g.moveTo(0,395);g.lineTo(95,320);g.lineTo(190,370);g.lineTo(315,285);g.lineTo(435,380);g.lineTo(560,305);g.lineTo(690,370);g.lineTo(815,275);g.lineTo(960,365);g.lineTo(960,500);g.lineTo(0,500);g.closePath();g.fillPath();
    g.fillStyle(0x0b171d,0.8);
    for(const [x,y,h] of [[38,325,100],[150,345,80],[270,318,112],[590,332,96],[735,310,120],[910,335,90]]){g.fillTriangle(x-28,y+h,x,y,x+28,y+h);g.fillRect(x-4,y+h-4,8,42);}
    g.fillStyle(0x9ce2c4,0.15);g.fillCircle(760,130,92);g.fillStyle(0x9ce2c4,0.24);g.fillCircle(760,130,44);g.fillStyle(0xd7f3e6,0.45);g.fillCircle(760,130,30);
    for(let i=0;i<22;i++){const x=(i*137+31)%W;const y=105+((i*53)%185);g.fillStyle(i%3===0?0x9ce2c4:0x78a6a0,0.32);g.fillCircle(x,y,i%4===0?2:1);}
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
