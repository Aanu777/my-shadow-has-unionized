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
  private checkpointMarker!: Phaser.GameObjects.Container;
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
  private worldWidth = W;
  private obstacles: Array<{ x: number; y: number; w: number; h: number }> = [];
  private groundGaps: Array<{ x: number; w: number }> = [];
  private checkpointX = 105;
  private checkpointReached = false;
  private dead = false;
  private deathOverlay: Phaser.GameObjects.GameObject[] = [];
  private relayNodes: Phaser.GameObjects.Container[] = [];
  private relayNodeActive: boolean[] = [false, false, false];
  private relaySequence: number[] = [2, 0, 1];
  private relayProgress = 0;
  private puzzleHintUntil = 0;

  constructor() { super("GameScene"); }
  preload(): void { preloadShift01Background(this); this.load.svg("shift02-space", "/shift-02-space.svg", { width: W, height: H }); }

  create(): void {
    if (this.registry.get("showLevelSelect") === true) {
      this.createLevelSelectScreen();
      return;
    }
    this.level = Number(this.registry.get("shiftLevel") ?? 1);
    // Scene.restart reuses this scene instance: reset every run/shift flag here.
    this.transitioning = false;
    this.won = false;
    this.dead = false;
    this.checkpointReached = false;
    this.checkpointX = this.level === 2 ? 1000 : 105;
    this.deathOverlay = [];
    this.relayNodes = []; this.relayNodeActive = [false, false, false]; this.relayProgress = 0; this.puzzleHintUntil = 0;
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
    this.worldWidth = this.level === 2 ? W * 2 : W;
    this.obstacles = this.level === 2 ? [
      { x: 900, y: 438, w: 78, h: 62 }, { x: 1320, y: 448, w: 82, h: 52 }, { x: 1765, y: 456, w: 56, h: 44 }
    ] : [];
    // Irregular gaps force real jumps instead of a flat walk to the exit.
    this.groundGaps = this.level === 2 ? [
      { x: 535, w: 66 }, { x: 790, w: 82 }, { x: 1080, w: 76 },
      { x: 1385, w: 94 }, { x: 1670, w: 88 }
    ] : [];
    this.lanternX = this.level === 1 ? 260 : 350;
    this.lanternMin = this.level === 1 ? 190 : 175;
    this.lanternMax = this.level === 1 ? 405 : 405;
    this.cameras.main.setBackgroundColor(this.level === 1 ? "#17131f" : "#100f24");
    // Do not draw Shift 01's SVG into Shift 02; each shift owns its backdrop.
    if (this.level === 1) drawShift01Background(this);
    else {
      // Two connected foundry spans turn Shift 02 into a side-scrolling level.
      this.drawLevelTwoBackdrop(0);
      this.drawLevelTwoBackdrop(W);
    }
    this.createAtmosphere();

    // Only the solid ground remains. All floating platforms are removed.
    const groundSegments: Platform[] = [];
    let groundStart = 0;
    for (const gap of this.groundGaps) {
      if (gap.x > groundStart) groundSegments.push({ x: groundStart, y: this.floorY, w: gap.x - groundStart, h: H - this.floorY });
      groundStart = gap.x + gap.w;
    }
    if (groundStart < this.worldWidth) groundSegments.push({ x: groundStart, y: this.floorY, w: this.worldWidth - groundStart, h: H - this.floorY });
    this.platforms = [
      ...(this.level === 2 ? groundSegments : [{ x: 0, y: this.floorY, w: this.worldWidth, h: H - this.floorY }]),
      ...this.obstacles.map(({ x, y, w, h }) => ({ x, y, w, h }))
    ];
    this.drawPlatforms();
    if (this.level === 2) { this.drawFoundryObstacles(); this.drawCheckpoint(); this.createRelayPuzzle(); }

    this.player = this.makePumpkin(105, 483);
    this.player.setDepth(5);
    if (this.level === 2) {
      this.cameras.main.setBounds(0, 0, this.worldWidth, H);
      this.cameras.main.startFollow(this.player, true, 0.09, 0.08);
      this.cameras.main.setDeadzone(250, 80);
    }
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
    this.switchObject = this.makeSwitch(this.level === 2 ? 1320 : 670, 470);
    this.gate = this.makeGate(this.level === 2 ? 1830 : 865, 425);
    this.gate.setDepth(3);
    if (this.level === 2) { this.lantern.setVisible(false); this.shadow.setVisible(false); this.shadowLabel.setVisible(false); this.coffee.setVisible(false); this.switchObject.setVisible(false); }

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
    }).setOrigin(0.5).setDepth(8).setScrollFactor(0);

    const controlsText = this.add.text(W - 26, 24,
      "MOVE  A/D OR ←/→\nJUMP  SPACE / W / ↑\nINTERACT  E   •   ENTER  EXIT\nRESTART  R", {
      fontFamily: "monospace", fontSize: "11px", color: "#d8cfe6",
      backgroundColor: "#21182f", padding: { x: 10, y: 8 },
      lineSpacing: 5, align: "right"
    }).setOrigin(1, 0).setDepth(8).setScrollFactor(0);
    if (this.level === 2) { this.statusText.setVisible(false); this.demandText.setVisible(false); this.dialogueText.setVisible(false); controlsText.setVisible(false); }

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys("A,D,W,E,R,ENTER") as Record<string, Phaser.Input.Keyboard.Key>;
    }
    this.physicslessHint();
    this.refreshShadow();
  }

  private physicslessHint(): void {
    if (this.level === 1) this.add.text(28, 78,
      "GOAL: GET COFFEE → ALIGN LANTERN RIGHT → ACTIVATE SWITCH.\nAT EXIT, PRESS ENTER TO LOAD SHIFT 02.", {
      fontFamily: "monospace", fontSize: "10px", color: "#c5a8ff", backgroundColor: "#21182f", padding: { x: 8, y: 6 }, lineSpacing: 4, wordWrap: { width: 440 }
    }).setDepth(8).setScrollFactor(0);
  }

  update(_time: number, delta: number): void {
    if (this.transitioning || this.dead) return;
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
    let nextX = Phaser.Math.Clamp(oldX + this.playerVx * dt, 18, this.worldWidth - 18);
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
    // Debris has solid sides, so the player must jump over it or climb onto it.
    if (this.level === 2) {
      for (const obstacle of this.obstacles) {
        const verticalOverlap = nextY + 17 > obstacle.y + 3 && nextY - 17 < obstacle.y + obstacle.h;
        if (!verticalOverlap) continue;
        if (oldX + 15 <= obstacle.x && nextX + 15 > obstacle.x) nextX = obstacle.x - 15;
        else if (oldX - 15 >= obstacle.x + obstacle.w && nextX - 15 < obstacle.x + obstacle.w) nextX = obstacle.x + obstacle.w + 15;
      }
    }
    if (this.level === 2 && !this.checkpointReached && nextX >= this.checkpointX) {
      this.checkpointReached = true;
      this.say("CHECKPOINT SECURED // IF THE FOUNDRY TAKES YOU, YOU RETURN HERE.");
      this.tweens.add({ targets: this.checkpointMarker, alpha: 1, duration: 220, yoyo: true, repeat: 2 });
    }
    if (nextY > H + 38) {
      this.player.setPosition(nextX, nextY);
      this.triggerMissionFailed();
      return;
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
    if (eDown && !this.eWasDown) { if (this.level === 2) this.interactWithRelay(); else this.interact(); }
    this.eWasDown = eDown;
    const rDown = this.keys.R.isDown;
    if (rDown && !this.rWasDown) this.restartFromShiftOne();
    this.rWasDown = rDown;
    const enterDown = this.keys.ENTER.isDown;
    if (enterDown && !this.enterWasDown && this.switchOn && this.isAtExit()) this.handleExitEnter();
    this.enterWasDown = enterDown;

    if (this.level === 1) { this.refreshShadow(); this.updateCoffee(); } else this.updateRelayHint();
    this.updateGate();
    if (this.time.now > this.messageUntil && this.messageUntil !== 0) {
      this.dialogueText.setText("A/D MOVE   SPACE JUMP   E INTERACT");
      this.messageUntil = 0;
    }
  }

  private createAtmosphere(): void {
    const fireflyPoints = this.level === 2 ? [[74,88],[184,171],[302,74],[438,145],[557,62],[708,120],[864,78],[104,248],[354,218],[623,235],[818,192],[482,320],[902,278]] : [[82,365],[145,330],[220,286],[318,365],[375,310],[430,355],[535,290],[585,345],[700,315],[742,365],[835,300],[900,355],[510,420],[290,445],[760,445]];
    fireflyPoints.forEach(([x, y], i) => {
      const dot = this.add.circle(x, y, i % 4 === 0 ? 2 : 1.4, this.level === 2 ? (i % 3 === 0 ? 0xf4b860 : 0xc77962) : (i % 3 === 0 ? 0xf39a45 : 0xc5a8ff), 0.15).setDepth(1);
      this.tweens.add({
        targets: dot, alpha: { from: 0.12, to: i % 3 === 0 ? 0.85 : 0.58 },
        scale: { from: 0.75, to: 1.5 }, x: x + (i % 2 === 0 ? 10 : -12),
        y: y - (8 + (i % 5) * 3), duration: 1500 + (i % 5) * 360,
        yoyo: true, repeat: -1, delay: i * 95, ease: "Sine.inOut"
      });
    });
    if (this.level === 1) {
      for (let i = 0; i < 5; i++) {
        const spark = this.add.circle(this.lanternX + (i - 2) * 12, 414 - (i % 3) * 8, 1.5, 0xffdf91, 0.6).setDepth(4);
        this.tweens.add({ targets: spark, y: spark.y - 9 - (i % 3) * 3, alpha: 0, duration: 700 + i * 130, delay: i * 170, repeat: -1,
          onRepeat: () => { spark.setPosition(this.lanternX + (i - 2) * 12, 414 - (i % 3) * 8); spark.setAlpha(0.6); }, ease: "Sine.out" });
      }
    }
  }

  private drawPlatforms(): void {
    const g = this.add.graphics().setDepth(2);
    for (const p of this.platforms) {
      const ground = p.y >= 450;
      g.fillStyle(this.level === 2 ? 0x17252b : 0x21172f, 1);
      g.fillRect(p.x, p.y, p.w, p.h);
      g.fillStyle(this.level === 2 ? 0xb46d56 : 0x8f5a43, 1);
      g.fillRect(p.x, p.y, p.w, 3);
      g.fillStyle(this.level === 2 ? 0x3d334f : 0x50305f, 0.9);
      g.fillRect(p.x, p.y + 3, p.w, 2);
      if (ground && this.level === 2) {
        // Orbital catwalk plating: broad panels, recessed joints and sparse cyan guide lights.
        g.fillStyle(0x17182e, 1); g.fillRect(p.x, p.y + 5, p.w, p.h - 5);
        g.lineStyle(1, 0x304b61, 0.95);
        for (let x = p.x + 26; x < p.x + p.w - 8; x += 48) {
          g.lineBetween(x, p.y + 7, x, Math.min(p.y + 43, p.y + p.h - 3));
          g.fillStyle(0xf4b860, 0.65); g.fillRect(x + 4, p.y + 7, 7, 2);
          g.fillStyle(0x020711, 1); g.fillCircle(x + 17, p.y + 13, 1.5);
        }
        g.fillStyle(0x233b4e, 1); g.fillRect(p.x, p.y + 3, p.w, 2);
      } else if (ground) {
        for (let x = p.x + 5; x < p.x + p.w - 3; x += 8) {
          const n = (Math.floor(x * 13) % 5);
          g.lineStyle(1, n % 2 === 0 ? 0x8b5b4d : 0xc18b55, 0.88); g.lineBetween(x, p.y + 1, x - 1, p.y - 2 - n);
        }
        g.lineStyle(1, 0x3d294c, 0.95);
        for (let x = p.x + 12; x < p.x + p.w - 4; x += 27) g.lineBetween(x, p.y + 11, x, Math.min(p.y + 39, p.y + p.h - 2));
        g.fillStyle(0x130e1c, 0.75);
        for (let x = p.x + 19; x < p.x + p.w - 10; x += 61) g.fillRect(x, p.y + 17 + (x % 7), 7, 2);
      }

    }
    const mushrooms = this.add.graphics().setDepth(3);
    if (this.level === 1) for (const [x, y] of [[58, 500], [285, 500], [744, 500], [928, 500]]) {
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
    const groundShadow = this.add.graphics(); groundShadow.fillStyle(0x05040a,0.42); groundShadow.fillEllipse(0,19,48,11); groundShadow.fillStyle(this.level===2?0x65d9df:0xf39a45,0.12); groundShadow.fillEllipse(0,18,35,7); c.add(groundShadow);
    if (this.level === 2) {
      // Compact pixel-art salvage suit: stepped silhouette, hard highlights, no soft vector gloss.
      const suit = this.add.graphics();
      // Life-support pack and antenna.
      suit.fillStyle(0x090d1c, 1); suit.fillRect(-15, -5, 6, 17);
      suit.fillStyle(0x514060, 1); suit.fillRect(-14, -4, 4, 13);
      suit.fillStyle(0xb46d56, 1); suit.fillRect(-14, -2, 2, 4);
      suit.fillStyle(0x090d1c, 1); suit.fillRect(7, -25, 3, 8);
      suit.fillStyle(0xf4b860, 1); suit.fillRect(7, -28, 3, 3);
      // Helmet shell and angular visor.
      suit.fillStyle(0x080b18, 1); suit.fillRect(-12, -25, 24, 22);
      suit.fillStyle(0x302b4a, 1); suit.fillRect(-9, -28, 18, 3);
      suit.fillRect(-15, -21, 3, 13); suit.fillRect(12, -21, 3, 13);
      suit.fillStyle(0x625477, 1); suit.fillRect(-9, -23, 18, 17);
      suit.fillStyle(0x17182f, 1); suit.fillRect(-7, -21, 14, 13);
      suit.fillStyle(0xc7a6ff, 1); suit.fillRect(-6, -20, 3, 2);
      suit.fillRect(-3, -18, 8, 2); suit.fillRect(4, -16, 2, 2);
      suit.fillStyle(0xf4b860, 1); suit.fillRect(-9, -8, 18, 2);
      // Neck, chest plate, shoulder blocks and arm guards.
      suit.fillStyle(0x090d1c, 1); suit.fillRect(-5, -5, 10, 4);
      suit.fillStyle(0x34314f, 1); suit.fillRect(-11, -2, 22, 16);
      suit.fillStyle(0x625477, 1); suit.fillRect(-8, 0, 16, 10);
      suit.fillStyle(0x17182f, 1); suit.fillRect(-5, 2, 10, 7);
      suit.fillStyle(0xf4b860, 1); suit.fillRect(-4, 3, 8, 2);
      suit.fillStyle(0x17182f, 1); suit.fillRect(-15, 0, 4, 11); suit.fillRect(11, 0, 4, 11);
      suit.fillStyle(0xb46d56, 1); suit.fillRect(-15, 3, 4, 3); suit.fillRect(11, 3, 4, 3);
      // Belt, squared legs and heavy magnetic boots.
      suit.fillStyle(0x090d1c, 1); suit.fillRect(-9, 13, 18, 4);
      suit.fillStyle(0x34314f, 1); suit.fillRect(-8, 17, 6, 5); suit.fillRect(2, 17, 6, 5);
      suit.fillStyle(0x625477, 1); suit.fillRect(-9, 21, 8, 3); suit.fillRect(1, 21, 8, 3);
      suit.fillStyle(0xf4b860, 1); suit.fillRect(-8, 22, 6, 1); suit.fillRect(2, 22, 6, 1);
      // Small suit indicator lights, limited to the same warm signal color.
      suit.fillStyle(0xf4b860, 1); suit.fillRect(8, 1, 2, 2); suit.fillRect(-10, 10, 2, 2);
      c.add(suit);
      const visor = this.add.graphics();
      visor.fillStyle(0x090d1c, 1); visor.fillRect(-4, -17, 3, 4); visor.fillRect(2, -17, 3, 4);
      visor.fillStyle(0xffdfa0, 1); visor.fillRect(-4, -17, 1, 1); visor.fillRect(2, -17, 1, 1);
      c.add(visor);
      return c;
    }

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
      g.lineStyle(2, 0xf4b860, 1); g.strokeRoundedRect(-12, -10, 24, 20, 3);
      g.fillStyle(0xf4b860, 1); g.fillRect(-5, -6, 10, 12);
      g.fillStyle(0xffe1a1, 1); g.fillRect(-2, -13, 4, 3); g.fillRect(-2, 10, 4, 3);
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
    if (this.level === 1) this.add.text(x, y + 15, label, { fontFamily: "monospace", fontSize: "9px", color: "#f0e8d8" }).setOrigin(0.5);
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
    if (this.level === 1) this.add.text(x, y + 16, "SWITCH", { fontFamily: "monospace", fontSize: "9px", color: "#c5b7d7" }).setOrigin(0.5);
    return c;
  }

  private makeGate(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const art = this.add.graphics();
    this.drawGateArt(art, false);
    c.add(art);
    if (this.level === 1) this.add.text(x, y + 73, "EXIT 01", { fontFamily: "monospace", fontSize: "10px", color: "#f39a45", backgroundColor: "#17131f", padding: { x: 5, y: 3 } }).setOrigin(0.5).setDepth(6);
    return c;
  }

  private drawGateArt(g: Phaser.GameObjects.Graphics, active: boolean): void {
    const levelTwo = this.level === 2;
    const stone = levelTwo ? 0x263b3d : 0x30213f;
    const stoneLight = levelTwo ? 0x52776e : 0x67436f;
    const trim = levelTwo ? 0xb46d56 : 0x8d5aab;
    const flame = levelTwo ? 0xf4b860 : 0xffa13b;
    const hot = levelTwo ? 0xffe1a1 : 0xffdf91;

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
      g.fillStyle(levelTwo ? 0xf4b860 : 0xc5a8ff, 0.9);
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
    g.fillStyle(levelTwo ? 0xf4b860 : 0xf17a2e, 1); g.fillEllipse(0, -57, 18, 17);
    g.fillStyle(hot, active ? 1 : 0.88);
    g.fillTriangle(-7, -60, -2, -55, -8, -54);
    g.fillTriangle(7, -60, 2, -55, 8, -54);
    g.fillTriangle(-6, -52, 6, -52, 0, -48);
    g.fillStyle(0x759447, 1); g.fillRoundedRect(-2, -72, 4, 5, 1);
    g.lineStyle(2, trim, 1); g.lineBetween(-27, 52, 27, 52);
    g.fillStyle(hot, active ? 0.95 : 0.45); g.fillCircle(0, 52, 3);
  }

  private refreshShadow(): void {
    const projectedX = Phaser.Math.Clamp(
      this.lanternX + 180 + (this.player.x - 260) * 0.22,
      this.level === 2 ? 700 : 445,
      this.level === 2 ? 1010 : 625
    );
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
    const routeColor = this.level === 2 ? (this.demandSatisfied ? 0xf4b860 : 0x9a594e) : (this.demandSatisfied ? 0xf39a45 : 0x7055a5);
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
        const color = this.level === 2 ? 0xf4b860 : 0xf39a45;
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
    this.add.rectangle(W / 2, H / 2, W, H, 0x100d16, 0.88).setDepth(20).setScrollFactor(0);
    this.add.text(W / 2, 215, "SHIFT 02 COMPLETE!", {
      fontFamily: "monospace", fontSize: "34px", color: "#f39a45", fontStyle: "bold", align: "center"
    }).setOrigin(0.5).setDepth(21).setScrollFactor(0);
    this.add.text(W / 2, 280,
      "You restored the broken circuit and escaped the night forest.\nThe shadow has filed a formal request for paid overtime.\n\nA historic victory for workplace relations.",
      { fontFamily: "monospace", fontSize: "15px", color: "#f0e8d8", align: "center", lineSpacing: 9 }
    ).setOrigin(0.5).setDepth(21).setScrollFactor(0);
    this.add.text(W / 2, 385, "PRESS R TO RESTART FROM SHIFT 01", {
      fontFamily: "monospace", fontSize: "12px", color: "#c5a8ff"
    }).setOrigin(0.5).setDepth(21).setScrollFactor(0);
  }

  private drawLevelTwoBackdrop(offsetX = 0): void {
    if (this.level === 2) { this.drawOrbitalBackdrop(offsetX); return; }
    const g = this.add.graphics().setDepth(-10).setPosition(offsetX, 0).setScrollFactor(0.34, 1);
    // Paint an opaque full-canvas base FIRST. Shift 01's SVG is at depth -20,
    // so this masks every pixel of that environment, including its sky and ground.
    // The Shift 02 skyline, moon, swamp and gameplay floor are drawn above this base.
    g.fillStyle(0x0b171d, 1); g.fillRect(0, 0, W, H);
    // Shift 02 is a derelict lantern foundry swallowed by the swamp.
    g.fillStyle(0x0b171d, 0.96); g.fillRect(0, 245, W, 255);
    g.fillStyle(0x142329, 1);
    // Distant factory skyline with chimneys, roof breaks and tiny lit windows.
    for (const [x, y, w, h] of [[0,342,94,58],[112,348,62,52],[190,335,64,65],[277,348,67,52],[362,332,61,68],[428,350,52,50],[500,342,60,58],[590,347,65,53],[675,338,66,62],[762,350,69,50],[849,342,65,58]]) {
      g.fillRect(x, y, w, h);
      g.fillStyle(0x20383a, 1); g.fillRect(x + 7, y + 9, Math.max(4, w - 14), 2);
      g.fillStyle(0xf4b860, 0.62);
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
    g.lineStyle(2, 0xc77962, 0.65); g.beginPath();
    g.moveTo(0,397); g.lineTo(76,354); g.lineTo(136,369); g.lineTo(206,315); g.lineTo(259,354);
    g.lineTo(327,334); g.lineTo(385,372); g.lineTo(451,326); g.lineTo(508,358); g.lineTo(573,294);
    g.lineTo(633,348); g.lineTo(690,329); g.lineTo(754,364); g.lineTo(816,311); g.lineTo(866,348);
    g.lineTo(921,316); g.lineTo(960,341); g.strokePath();
    // Thick pipework and joints across the ruined back wall.
    g.lineStyle(14, 0x0b171d, 1); g.beginPath(); g.moveTo(0,408); g.lineTo(0,383); g.lineTo(105,383); g.lineTo(105,399); g.lineTo(165,399); g.lineTo(165,374); g.lineTo(218,374); g.strokePath();
    g.lineStyle(5, 0x754b54, 1); g.strokePath();
    g.lineStyle(16, 0x0b171d, 1); g.beginPath(); g.moveTo(585,392); g.lineTo(585,365); g.lineTo(656,365); g.lineTo(656,386); g.lineTo(730,386); g.lineTo(730,354); g.lineTo(804,354); g.lineTo(804,389); g.lineTo(960,389); g.strokePath();
    g.lineStyle(5, 0x754b54, 1); g.strokePath();
    // Masonry frames and broken brick seams at the edges.
    g.fillStyle(0x17272a, 1); g.fillRect(0,263,47,237); g.fillRect(915,281,45,219);
    g.fillStyle(0x4e3d5c, 1); g.fillRect(0,263,47,7); g.fillRect(915,281,45,7);
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
    g.fillStyle(0xf4b860, 0.1); g.fillCircle(760,130,100);
    g.fillStyle(0xf4b860, 0.2); g.fillCircle(760,130,44);
    g.fillStyle(0xffe1a1, 0.42); g.fillCircle(760,130,29);
    for (let i = 0; i < 20; i++) {
      const x = (i * 137 + 31) % W, y = 105 + ((i * 53) % 185);
      g.fillStyle(i % 3 === 0 ? 0xf4b860 : 0x78a6a0, 0.4);
      g.fillCircle(x, y, i % 4 === 0 ? 2 : 1);
    }
    // Foreground bank is drawn by the collision platforms so it scrolls at full speed.
  }
  private drawOrbitalBackdrop(offsetX: number): void {
    // Pixel-art sky plate. Crisp-edged SVG art sits behind a few independently moving
    // atmospheric pixels so the level has depth without visual noise.
    this.add.image(offsetX, 0, "shift02-space")
      .setOrigin(0, 0)
      .setDisplaySize(W, H)
      .setDepth(-10)
      .setScrollFactor(0.18, 1);

    const glints = this.add.graphics().setDepth(-9).setScrollFactor(0.34, 1);
    const stars: Array<[number, number, number, number]> = [
      [64, 88, 2, 0xffdfa0], [174, 144, 1, 0xc7a6ff], [312, 72, 2, 0xffdfa0],
      [426, 185, 1, 0xc7a6ff], [590, 92, 2, 0xffdfa0], [738, 188, 1, 0xc7a6ff],
      [858, 76, 2, 0xffdfa0], [924, 223, 1, 0xc7a6ff]
    ];
    for (const [x, y, size, color] of stars) {
      glints.fillStyle(color, 0.85);
      glints.fillRect(x + offsetX, y, size, size);
    }
  }

  private createRelayPuzzle(): void {
    const specs = [{ x: 1210, shape: 0 }, { x: 1575, shape: 1 }, { x: 680, shape: 2 }];
    // Heavy relay pylons are designed as small pieces of orbital machinery, not floating icons.
    this.relayNodes = specs.map(({ x, shape }) => {
      const node = this.add.container(x, this.floorY - 3).setDepth(4);
      const g = this.add.graphics();
      // Ground shadow and a bolted, layered pedestal.
      g.fillStyle(0x02050b, 0.75); g.fillEllipse(0, 0, 82, 15);
      g.fillStyle(0x101a2a, 1); g.fillRoundedRect(-25, -72, 50, 68, 5);
      g.fillStyle(0x34334f, 1); g.fillRoundedRect(-21, -69, 42, 60, 4);
      g.fillStyle(0x111426, 1); g.fillRoundedRect(-16, -64, 32, 48, 3);
      g.lineStyle(1, 0x8b6170, 0.9); g.strokeRoundedRect(-21, -69, 42, 60, 4);
      g.fillStyle(0xf4b860, 0.12); g.fillRoundedRect(-13, -61, 26, 41, 3);
      // Side rails, energy channels and tiny service bolts.
      g.fillStyle(0x62485e, 1); g.fillRoundedRect(-24, -57, 4, 38, 1); g.fillRoundedRect(20, -57, 4, 38, 1);
      g.fillStyle(0xf4b860, 0.95); g.fillRect(-23, -51, 2, 12); g.fillRect(21, -37, 2, 12);
      for (const bx of [-17, 17]) { g.fillStyle(0x07101b, 1); g.fillCircle(bx, -62, 2.4); g.fillStyle(0xf4b860, 0.9); g.fillCircle(bx, -62, 0.8); }
      // Recessed symbol chamber, lens rings and engraved geometric identity.
      g.fillStyle(0x020711, 1); g.fillCircle(0, -42, 18);
      g.lineStyle(2, 0x62485e, 1); g.strokeCircle(0, -42, 15);
      g.lineStyle(1, 0xf4b860, 0.5); g.strokeCircle(0, -42, 11);
      g.fillStyle(0xf4b860, 0.1); g.fillCircle(0, -42, 8);
      g.lineStyle(2.5, 0xc77962, 1);
      if (shape === 0) g.strokeCircle(0, -42, 7);
      else if (shape === 1) { g.beginPath(); g.moveTo(0,-51); g.lineTo(9,-42); g.lineTo(0,-33); g.lineTo(-9,-42); g.closePath(); g.strokePath(); }
      else { g.beginPath(); g.moveTo(0,-52); g.lineTo(10,-34); g.lineTo(-10,-34); g.closePath(); g.strokePath(); }
      g.fillStyle(0xb9fff0, 0.9); g.fillCircle(0, -42, 2);
      // Top crown and floor-contact plates.
      g.fillStyle(0x172b40, 1); g.fillRoundedRect(-12, -78, 24, 8, 2);
      g.fillStyle(0xf4b860, 0.9); g.fillRect(-7, -76, 14, 2);
      g.fillStyle(0x41344d, 1); g.fillRoundedRect(-27, -9, 54, 7, 2);
      g.lineStyle(1, 0x62859a, 0.8); g.lineBetween(-24, -5, 24, -5);
      node.add(g);
      // An orbiting reticle gives the pylon a more readable silhouette in space.
      const ring = this.add.graphics();
      ring.lineStyle(1, 0xc77962, 0.35); ring.strokeEllipse(0, -42, 70, 30);
      ring.lineStyle(1, 0xf4b860, 0.6); ring.beginPath(); ring.moveTo(-37,-42); ring.lineTo(-28,-42); ring.moveTo(28,-42); ring.lineTo(37,-42); ring.strokePath();
      node.add(ring);
      this.tweens.add({ targets: ring, angle: 360, duration: 9000 + shape * 1100, repeat: -1 });
      this.tweens.add({ targets: node, y: this.floorY - 3, duration: 1450 + shape * 190, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      return node;
    });

    // Diegetic circuit-map console: three sockets, a routed trace and a projected sequence.
    const board = this.add.container(300, 394).setDepth(4);
    const bg = this.add.graphics();
    bg.fillStyle(0x020711, 0.88); bg.fillRoundedRect(-91, -45, 182, 73, 7);
    bg.fillStyle(0x122337, 0.96); bg.fillRoundedRect(-86, -41, 172, 64, 5);
    bg.lineStyle(1.5, 0x567b91, 0.9); bg.strokeRoundedRect(-86, -41, 172, 64, 5);
    bg.lineStyle(1, 0x29485d, 0.9);
    for (let x=-73; x<=73; x+=12) bg.lineBetween(x,-35,x,14);
    bg.lineBetween(-75,-13,75,-13); bg.lineBetween(-75,7,75,7);
    // Hologram scan bars and three distinct sequence sockets.
    bg.fillStyle(0xf4b860, 0.12); bg.fillRoundedRect(-72,-31,144,7,2);
    bg.fillStyle(0xf4b860, 0.75); bg.fillRect(-69,-28,49,1); bg.fillRect(28,-28,39,1);
    const socketXs = [-48, 0, 48];
    socketXs.forEach((sx, idx) => {
      bg.fillStyle(0x06101d, 1); bg.fillCircle(sx, -1, 14);
      bg.lineStyle(1.5, idx === 1 ? 0xf4b860 : 0x8b6170, 0.95); bg.strokeCircle(sx, -1, 11);
      bg.lineStyle(2, 0xf4b860, 0.95);
      if (idx === 0) { bg.beginPath(); bg.moveTo(sx,-10); bg.lineTo(sx+8,-1); bg.lineTo(sx,-1); bg.lineTo(sx,-10); bg.strokePath(); }
      if (idx === 1) bg.strokeCircle(sx,-1,5);
      if (idx === 2) { bg.beginPath(); bg.moveTo(sx,-10); bg.lineTo(sx+8,5); bg.lineTo(sx-8,5); bg.closePath(); bg.strokePath(); }
    });
    bg.lineStyle(2, 0xf4b860, 0.8); bg.lineBetween(-34,-1,-15,-1); bg.lineBetween(14,-1,33,-1);
    bg.fillStyle(0xf4b860, 0.8); bg.fillCircle(-75, 17, 2); bg.fillCircle(75, 17, 2);
    bg.lineStyle(1, 0x4b7087, 0.8); bg.lineBetween(-64,17,-7,17); bg.lineBetween(7,17,64,17);
    board.add(bg);
    const beam = this.add.graphics();
    beam.lineStyle(1, 0xf4b860, 0.35); beam.lineBetween(-70, -50, 70, -50);
    board.add(beam);
    this.tweens.add({ targets: board, alpha: { from: 0.82, to: 1 }, duration: 1150, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.tweens.add({ targets: beam, y: 4, duration: 1750, yoyo: true, repeat: -1, ease: "Sine.inOut" });

    // A few cable runs visually tie the relay stations into the foundry.
    const cables = this.add.graphics().setDepth(2);
    cables.lineStyle(2, 0x24485a, 0.85);
    cables.beginPath(); cables.moveTo(680, 497); cables.lineTo(680, 478); cables.lineTo(706, 466); cables.lineTo(706, 451);
    cables.moveTo(1210, 497); cables.lineTo(1210, 477); cables.lineTo(1232, 463); cables.lineTo(1232, 451);
    cables.moveTo(1575, 497); cables.lineTo(1575, 478); cables.lineTo(1551, 463); cables.lineTo(1551, 451); cables.strokePath();
    cables.lineStyle(1, 0xf4b860, 0.55);
    cables.fillStyle(0xf4b860, 0.8);
    for (const [x,y] of [[680,478],[1210,477],[1575,478]]) { cables.strokeCircle(x,y,3); cables.fillCircle(x,y,1.2); }
  }

  private interactWithRelay(): void {
    let target=-1,best=70;this.relayNodes.forEach((node,index)=>{const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,node.x,node.y);if(d<best){best=d;target=index;}});
    if(target<0)return;if(this.relayNodeActive[target]){this.showPuzzlePulse("NODE ALREADY SYNCHRONIZED");return;}
    if(target!==this.relaySequence[this.relayProgress]){this.relayProgress=0;this.relayNodeActive=[false,false,false];this.relayNodes.forEach((node,index)=>this.paintRelayNode(node,index,false));this.showPuzzlePulse("SIGNAL COLLAPSE");this.cameras.main.shake(130,0.0025);return;}
    this.relayNodeActive[target]=true;this.relayProgress++;this.paintRelayNode(this.relayNodes[target],target,true);this.showPuzzlePulse(this.relayProgress===3?"SIGNAL RESTORED":"RELAY SYNCHRONIZED");this.cameras.main.flash(110,70,170,160,false);
    if(this.relayProgress===3){this.switchOn=true;this.updateGate();const halo=this.add.circle(this.gate.x,this.gate.y-25,48,0xf4b860,0.12).setDepth(2);this.tweens.add({targets:halo,alpha:0.02,scale:1.4,duration:700,yoyo:true,repeat:-1});}
  }
  private paintRelayNode(node:Phaser.GameObjects.Container,index:number,active:boolean):void{
    const g=node.getAt(0) as Phaser.GameObjects.Graphics;g.clear();g.fillStyle(0x030710,0.7);g.fillEllipse(0,0,56,12);g.fillStyle(0x111f31,1);g.fillRoundedRect(-16,-55,32,54,4);g.fillStyle(active?0x244d50:0x29253e,1);g.fillRoundedRect(-12,-51,24,46,3);g.lineStyle(2,active?0xf4b860:0x8b6170,0.95);g.strokeRoundedRect(-12,-51,24,46,3);g.fillStyle(0x07101b,1);g.fillCircle(0,-31,13);g.lineStyle(2,active?0xf4b860:0x8b6170,1);
    if(index===0)g.strokeCircle(0,-31,8);else if(index===1){g.beginPath();g.moveTo(0,-41);g.lineTo(9,-31);g.lineTo(0,-21);g.lineTo(-9,-31);g.closePath();g.strokePath();}else{g.beginPath();g.moveTo(0,-42);g.lineTo(10,-24);g.lineTo(-10,-24);g.closePath();g.strokePath();}g.fillStyle(0xf4b860,active?1:0.18);g.fillCircle(0,-31,4);
    if(active){const ring=this.add.circle(node.x,node.y-31,19,0xf4b860,0.12).setDepth(3);this.tweens.add({targets:ring,scale:1.6,alpha:0,duration:420,onComplete:()=>ring.destroy()});}
  }
  private showPuzzlePulse(message:string):void{this.dialogueText.setVisible(true).setText(message).setColor("#b9f5dc").setBackgroundColor("#08111d");this.dialogueText.setPosition(W/2,H-42);this.puzzleHintUntil=this.time.now+1000;}
  private updateRelayHint():void{if(this.time.now>=this.puzzleHintUntil)this.dialogueText.setVisible(false);}

  private drawCheckpoint(): void {
    this.checkpointMarker = this.add.container(this.checkpointX, this.floorY - 2).setDepth(4);
    const g = this.add.graphics();
    g.fillStyle(0x071014, 0.65); g.fillEllipse(0, 0, 48, 10);
    g.fillStyle(0x132b2b, 1); g.fillRoundedRect(-15, -62, 30, 58, 4);
    g.lineStyle(2, 0xf4b860, 1); g.strokeRoundedRect(-15, -62, 30, 58, 4);
    g.lineStyle(1, 0xffe1a1, 0.8); g.lineBetween(-8, -54, 8, -54); g.lineBetween(-8, -47, 8, -47);
    g.fillStyle(0xf4b860, 0.22); g.fillCircle(0, -32, 20);
    g.fillStyle(0xf4b860, 1); g.fillCircle(0, -32, 5);
    g.fillStyle(0xffe1a1, 1); g.fillCircle(-1, -33, 2);
    this.checkpointMarker.add(g);
  }

  private drawFoundryObstacles(): void {
    const g = this.add.graphics().setDepth(3);
    this.obstacles.forEach((o, i) => {
      // Each obstacle is a different piece of machinery, with silhouettes that read at a glance.
      g.fillStyle(0x02050b, 0.78); g.fillEllipse(o.x + o.w/2, 500, o.w + 34, 14);
      if (i === 0) {
        // Stacked pressure pipe housing with a raised elbow and bolted service plate.
        g.fillStyle(0x0a1420,1); g.fillRoundedRect(o.x,o.y+12,o.w,o.h-12,5);
        g.fillStyle(0x253b4e,1); g.fillRoundedRect(o.x+4,o.y+14,o.w-8,o.h-19,4);
        g.fillStyle(0x405e70,1); g.fillRoundedRect(o.x+7,o.y+4,o.w-14,15,4);
        g.fillStyle(0x152638,1); g.fillRoundedRect(o.x+15,o.y-10,18,28,5);
        g.fillStyle(0x8b6170,1); g.fillRoundedRect(o.x+18,o.y-13,12,25,4);
        g.lineStyle(2,0xc77962,0.9); g.strokeRoundedRect(o.x+4,o.y+14,o.w-8,o.h-19,4);
        g.fillStyle(0xf4b860,0.95); g.fillRect(o.x+10,o.y+20,5,3); g.fillRect(o.x+o.w-15,o.y+20,5,3);
        for(let k=0;k<4;k++){g.fillStyle(0x07101b,1);g.fillCircle(o.x+15+k*16,o.y+o.h-10,2.4);g.fillStyle(0x8aaebd,1);g.fillCircle(o.x+15+k*16,o.y+o.h-10,1);}
      } else if (i === 1) {
        // A cracked capacitor crate with a glowing split core.
        g.fillStyle(0x17182e,1);g.fillRoundedRect(o.x,o.y+3,o.w,o.h-3,4);
        g.fillStyle(0x293b4b,1);g.fillRoundedRect(o.x+5,o.y+7,o.w-10,o.h-12,3);
        g.lineStyle(2,0x8b6170,0.9);g.strokeRoundedRect(o.x+5,o.y+7,o.w-10,o.h-12,3);
        g.lineStyle(3,0x0a1420,1);g.lineBetween(o.x+15,o.y+13,o.x+o.w-15,o.y+o.h-7);
        g.lineStyle(2,0xf4b860,0.85);g.lineBetween(o.x+18,o.y+14,o.x+o.w-17,o.y+o.h-8);
        g.fillStyle(0xf4b860,0.22);g.fillRoundedRect(o.x+o.w/2-7,o.y+13,14,o.h-25,3);
        g.fillStyle(0xbaffef,0.95);g.fillRect(o.x+o.w/2-2,o.y+17,4,o.h-34);
        for(const bx of [o.x+10,o.x+o.w-10]){g.fillStyle(0x07101b,1);g.fillCircle(bx,o.y+11,3);g.fillStyle(0xf4b860,1);g.fillCircle(bx,o.y+11,1);}
        const sparks=this.add.graphics();sparks.fillStyle(0xf4b860,0.9);sparks.fillTriangle(o.x+18,o.y-4,o.x+24,o.y-13,o.x+26,o.y-3);sparks.fillTriangle(o.x+o.w-23,o.y-5,o.x+o.w-17,o.y-12,o.x+o.w-16,o.y-3);
        const fx=this.add.container(0,0,[sparks]).setDepth(4);this.tweens.add({targets:fx,alpha:{from:1,to:.25},y:-4,duration:460,yoyo:true,repeat:-1,ease:"Sine.inOut"});
      } else {
        // Compact rotary vent with concentric rings and animated vapor.
        g.fillStyle(0x111d2a,1);g.fillRoundedRect(o.x,o.y+7,o.w,o.h-7,4);
        g.fillStyle(0x314a5c,1);g.fillRoundedRect(o.x+5,o.y+9,o.w-10,o.h-15,3);
        g.fillStyle(0x07101b,1);g.fillCircle(o.x+o.w/2,o.y+8,17);
        g.lineStyle(3,0x8b6170,1);g.strokeCircle(o.x+o.w/2,o.y+8,14);
        g.lineStyle(2,0xf4b860,0.9);g.strokeCircle(o.x+o.w/2,o.y+8,8);
        g.fillStyle(0xf4b860,0.85);g.fillCircle(o.x+o.w/2,o.y+8,3);
        for(let k=0;k<6;k++){const angle=k*Math.PI/3;g.lineStyle(2,0x8aaebd,0.9);g.lineBetween(o.x+o.w/2+Math.cos(angle)*5,o.y+8+Math.sin(angle)*5,o.x+o.w/2+Math.cos(angle)*11,o.y+8+Math.sin(angle)*11);}
        const vapor=this.add.container(o.x+o.w/2,o.y+2).setDepth(4),steam=this.add.graphics();
        steam.fillStyle(0xf4b860,.22);steam.fillEllipse(-9,-4,15,17);steam.fillStyle(0xbfeedd,.25);steam.fillEllipse(6,-14,13,19);steam.fillStyle(0xf4b860,.16);steam.fillEllipse(-1,-23,18,17);vapor.add(steam);
        this.tweens.add({targets:vapor,y:o.y-40,alpha:0,duration:1050,repeat:-1,delay:180,onRepeat:()=>{vapor.setY(o.y+2);vapor.setAlpha(.9);},ease:"Sine.out"});
      }
      // Shared hazard edge lighting and floor-mounted anchor brackets.
      g.lineStyle(1,0xf4b860,0.7);g.lineBetween(o.x+5,o.y+4,o.x+o.w-6,o.y+4);
      g.fillStyle(0x0a1420,1);g.fillRoundedRect(o.x+5,o.y+o.h-4,12,8,1);g.fillRoundedRect(o.x+o.w-17,o.y+o.h-4,12,8,1);
    });
  }

  private isAtExit(): boolean { return Phaser.Math.Distance.Between(this.player.x,this.player.y,this.gate.x,this.gate.y)<78; }
  private handleExitEnter(): void { if(this.level===1){this.transitionToShiftTwo();return;}this.won=true;this.showWin(); }
  private transitionToShiftTwo(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    // Shift 02 is now a separate, real-time 3D first-person page.
    // Keep Shift 01 in Phaser and hand off only after the transition beat.
    const cover = this.add.rectangle(W / 2, H / 2, W, H, 0x0b0914, 1)
      .setDepth(100).setScrollFactor(0).setAlpha(0);
    const title = this.add.text(W / 2, H / 2 - 12, "ENTERING THE FOUNDRY", {
      fontFamily: "monospace", fontSize: "21px", color: "#e4aa73",
      fontStyle: "bold", letterSpacing: 3, align: "center"
    }).setOrigin(0.5).setDepth(101).setScrollFactor(0).setAlpha(0);
    const sub = this.add.text(W / 2, H / 2 + 22, "FIRST-PERSON MODE // SHIFT 02", {
      fontFamily: "monospace", fontSize: "10px", color: "#c5b8d3",
      letterSpacing: 2, align: "center"
    }).setOrigin(0.5).setDepth(101).setScrollFactor(0).setAlpha(0);
    this.tweens.add({
      targets: cover, alpha: 1, duration: 380, ease: "Cubic.in",
      onComplete: () => { window.location.href = "./shift-02-3d.html"; }
    });
    this.tweens.add({ targets: [title, sub], alpha: 1, duration: 260, delay: 180, ease: "Cubic.out" });
  }
  private triggerMissionFailed(): void {
    if (this.dead) return;
    this.dead = true;
    this.playerVy = 0;
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x03080b, 0.88).setDepth(40).setScrollFactor(0).setAlpha(0);
    const panel = this.add.rectangle(W / 2, H / 2, 590, 310, 0x0b171d, 0.98).setStrokeStyle(2, 0xc77962, 0.95).setDepth(41).setScrollFactor(0).setAlpha(0);
    const crack = this.add.graphics().setDepth(42).setScrollFactor(0).setAlpha(0);
    crack.lineStyle(2, 0xf4b860, 0.75);
    crack.beginPath(); crack.moveTo(190, 154); crack.lineTo(228, 179); crack.lineTo(212, 201); crack.lineTo(249, 226); crack.strokePath();
    crack.lineStyle(1, 0xf4b860, 0.35); crack.lineBetween(710, 153, 746, 188); crack.lineBetween(746, 188, 729, 215);
    const title = this.add.text(W / 2, 190, "MISSION FAILED", {
      fontFamily: "monospace", fontSize: "31px", color: "#b8e8d4", fontStyle: "bold", letterSpacing: 3
    }).setOrigin(0.5).setDepth(43).setScrollFactor(0).setAlpha(0);
    const sub = this.add.text(W / 2, 235, "THE FOUNDRY CLAIMS ANOTHER EMPLOYEE.", {
      fontFamily: "monospace", fontSize: "10px", color: "#f4b860", letterSpacing: 1
    }).setOrigin(0.5).setDepth(43).setScrollFactor(0).setAlpha(0);
    const checkpointLabel = this.add.text(W / 2, 270,
      this.checkpointReached ? "LAST SAFE LOCATION: MIDPOINT CHECKPOINT" : "NO CHECKPOINT LOGGED // RETURN TO ENTRY", {
        fontFamily: "monospace", fontSize: "11px", color: "#c2d2cc", align: "center"
      }).setOrigin(0.5).setDepth(43).setScrollFactor(0).setAlpha(0);
    const makeButton = (x: number, y: number, label: string, primary: boolean, callback: () => void) => {
      const bg = this.add.rectangle(x, y, 210, 43, primary ? 0x24483e : 0x17272a, 1)
        .setStrokeStyle(1, primary ? 0xf4b860 : 0xc77962, 1).setDepth(43).setScrollFactor(0).setInteractive({ useHandCursor: true }).setAlpha(0);
      const text = this.add.text(x, y, label, {
        fontFamily: "monospace", fontSize: "12px", color: primary ? "#ffdfa0" : "#a9c3b9", fontStyle: "bold"
      }).setOrigin(0.5).setDepth(44).setScrollFactor(0).setAlpha(0);
      bg.on("pointerover", () => { if (this.dead) bg.setFillStyle(primary ? 0x315e50 : 0x263f40, 1); });
      bg.on("pointerout", () => bg.setFillStyle(primary ? 0x24483e : 0x17272a, 1));
      bg.on("pointerdown", callback);
      this.deathOverlay.push(bg, text);
      return [bg, text];
    };
    makeButton(W / 2 - 118, 340, "TRY AGAIN", true, () => this.respawnAtCheckpoint());
    makeButton(W / 2 + 118, 340, "EXIT TO LEVELS", false, () => this.returnToLevelSelect());
    this.deathOverlay.push(shade, panel, crack, title, sub, checkpointLabel);
    this.tweens.add({ targets: [shade, panel, crack, title, sub, checkpointLabel], alpha: 1, duration: 280, ease: "Cubic.out" });
    this.deathOverlay.forEach((item) => {
      if ("alpha" in item) this.tweens.add({ targets: item, alpha: 1, duration: 280, ease: "Cubic.out" });
    });
    this.cameras.main.shake(180, 0.006);
  }

  private respawnAtCheckpoint(): void {
    this.deathOverlay.forEach((item) => item.destroy());
    this.deathOverlay = [];
    this.dead = false;
    const spawnX = this.level === 2 && this.checkpointReached ? this.checkpointX + 28 : 105;
    this.player.setPosition(spawnX, this.floorY - 17);
    this.playerVy = 0; this.playerVx = 0; this.grounded = false;
    this.jumpBuffer = 0; this.coyoteTime = 0;
    this.cameras.main.centerOn(spawnX, H / 2);
    if (this.level === 2) this.cameras.main.startFollow(this.player, true, 0.09, 0.08);
    this.say(this.checkpointReached ? "BACK ON SHIFT. CHECKPOINT RESTORED." : "BACK ON SHIFT. TRY NOT TO FALL THROUGH REALITY.");
  }

  private returnToLevelSelect(): void {
    this.registry.set("showLevelSelect", true);
    this.scene.restart();
  }

  private createLevelSelectScreen(): void {
    this.cameras.main.setBackgroundColor("#0b171d");
    this.add.rectangle(W / 2, H / 2, W, H, 0x0b171d, 1);
    const backdrop = this.add.graphics().setDepth(1);
    backdrop.lineStyle(1, 0x28423f, 0.45);
    for (let x = 0; x < W; x += 32) backdrop.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 32) backdrop.lineBetween(0, y, W, y);
    backdrop.fillStyle(0xf4b860, 0.06); backdrop.fillCircle(750, 118, 115);
    backdrop.fillStyle(0xffe1a1, 0.18); backdrop.fillCircle(750, 118, 42);
    this.add.text(52, 48, "MY SHADOW HAS UNIONIZED", {
      fontFamily: "monospace", fontSize: "21px", color: "#ffdfa0", fontStyle: "bold", letterSpacing: 2
    }).setDepth(2);
    this.add.text(54, 82, "EMPLOYEE ACCESS TERMINAL  //  SELECT A SHIFT", {
      fontFamily: "monospace", fontSize: "10px", color: "#7cae9c", letterSpacing: 1
    }).setDepth(2);
    const makeLevelCard = (x: number, level: number, title: string, subtitle: string, status: string, color: number, active: boolean) => {
      const y = 205;
      const card = this.add.rectangle(x, y, 350, 190, 0x102126, 0.98).setStrokeStyle(1, color, 0.95).setDepth(2);
      const stripe = this.add.rectangle(x - 158, y, 5, 188, color, 1).setDepth(3);
      this.add.text(x - 145, y - 65, `SHIFT 0${level}`, {
        fontFamily: "monospace", fontSize: "10px", color: `#${color.toString(16).padStart(6,"0")}`, letterSpacing: 2
      }).setDepth(3);
      this.add.text(x - 145, y - 32, title, {
        fontFamily: "monospace", fontSize: "18px", color: "#e0eee8", fontStyle: "bold"
      }).setDepth(3);
      this.add.text(x - 145, y + 1, subtitle, {
        fontFamily: "monospace", fontSize: "10px", color: "#a9c3b9", lineSpacing: 6, wordWrap: { width: 270 }
      }).setDepth(3);
      this.add.text(x - 145, y + 48, status, {
        fontFamily: "monospace", fontSize: "9px", color: active ? "#f4b860" : "#769087"
      }).setDepth(3);
      const launch = this.add.rectangle(x, y + 126, 270, 35, active ? 0x24483e : 0x17272a, 1)
        .setStrokeStyle(1, color, 1).setDepth(3).setInteractive({ useHandCursor: true });
      const launchText = this.add.text(x, y + 126, active ? "ENTER SHIFT" : "REPLAY SHIFT", {
        fontFamily: "monospace", fontSize: "10px", color: "#ffdfa0", fontStyle: "bold"
      }).setOrigin(0.5).setDepth(4);
      launch.on("pointerover", () => launch.setFillStyle(0x315e50, 1));
      launch.on("pointerout", () => launch.setFillStyle(active ? 0x24483e : 0x17272a, 1));
      launch.on("pointerdown", () => {
        if (level === 2) {
          // Level selection must launch the new 3D build, not the legacy side-scroller.
          window.location.href = "./shift-02-3d.html";
          return;
        }
        this.registry.set("showLevelSelect", false);
        this.registry.set("shiftLevel", level);
        this.scene.restart();
      });
    };
    makeLevelCard(245, 1, "Probation", "Coffee diplomacy. A shadow with boundaries.\nA workplace on the edge.", "AVAILABLE  //  PLUM + AMBER", 0xf39a45, true);
    makeLevelCard(715, 2, "The Night Shift", "Broken circuits. Live pipes.\nFive gaps. One checkpoint.", "AVAILABLE  //  MINT + IRON", 0xf4b860, true);
    this.add.text(W / 2, 520, "A/D MOVE     SPACE JUMP     E INTERACT     R RESTART", {
      fontFamily: "monospace", fontSize: "10px", color: "#638b7d", letterSpacing: 1
    }).setOrigin(0.5).setDepth(2);
    this.add.text(W / 2, 558, "THE COMPANY DISCLAIMS ALL RESPONSIBILITY FOR SHADOW-RELATED INCIDENTS.", {
      fontFamily: "monospace", fontSize: "8px", color: "#4d7166", letterSpacing: 0.5
    }).setOrigin(0.5).setDepth(2);
  }

  private restartFromShiftOne(): void {this.registry.set("showLevelSelect", false); this.registry.set("shiftLevel",1);this.scene.restart();}

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
