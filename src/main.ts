import Phaser from "phaser";
import "./style.css";

const W = 960;
const H = 600;

type Platform = { x: number; y: number; w: number; h: number };

class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private player!: Phaser.GameObjects.Container;
  private playerBody!: Phaser.GameObjects.Rectangle;
  private playerVx = 0;
  private playerVy = 0;
  private grounded = false;
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
  private demandSatisfied = false;
  private switchOn = false;
  private won = false;
  private eWasDown = false;
  private rWasDown = false;
  private messageUntil = 0;
  private message = "THE SHADOW IS ON A BREAK. AGAIN.";
  private floorY = 500;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#17131f");
    this.drawBackdrop();

    this.platforms = [
      { x: 0, y: 500, w: 300, h: 100 },
      { x: 390, y: 500, w: 330, h: 100 },
      { x: 720, y: 500, w: 240, h: 100 },
      { x: 95, y: 405, w: 120, h: 18 },
      { x: 450, y: 395, w: 115, h: 18 },
      { x: 760, y: 390, w: 110, h: 18 }
    ];
    this.drawPlatforms();

    this.player = this.makePumpkin(105, 456);
    this.playerBody = this.add.rectangle(0, 0, 30, 34, 0xffffff, 0);
    this.player.add(this.playerBody);

    this.lantern = this.makeLantern(this.lanternX, 438);
    this.shadow = this.makeShadow(500, 460);
    this.shadowLabel = this.add.text(0, 0, "ON BREAK", {
      fontFamily: "monospace", fontSize: "10px", color: "#c5a8ff",
      backgroundColor: "#21182f", padding: { x: 5, y: 3 }
    }).setOrigin(0.5);

    this.coffee = this.makeCoffee(342, 467);
    this.switchObject = this.makeSwitch(670, 470);
    this.gate = this.makeGate(865, 425);

    this.statusText = this.add.text(28, 24, "PROBATION  //  SHIFT 01", {
      fontFamily: "monospace", fontSize: "13px", color: "#f39a45",
      letterSpacing: 2
    }).setScrollFactor(0);
    this.demandText = this.add.text(28, 48, "UNION DEMAND: ONE (1) COFFEE BREAK", {
      fontFamily: "monospace", fontSize: "12px", color: "#d8cfe6"
    }).setScrollFactor(0);
    this.dialogueText = this.add.text(W / 2, 555, this.message, {
      fontFamily: "monospace", fontSize: "13px", color: "#f0e8d8",
      backgroundColor: "#21182f", padding: { x: 12, y: 9 },
      align: "center", wordWrap: { width: 820 }
    }).setOrigin(0.5);

    this.add.text(W - 26, 26, "A/D MOVE   SPACE JUMP   E INTERACT   R RESTART", {
      fontFamily: "monospace", fontSize: "10px", color: "#8c819b"
    }).setOrigin(1, 0);

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys("A,D,W,E,R") as Record<string, Phaser.Input.Keyboard.Key>;
    }

    this.physicslessHint();
    this.refreshShadow();
  }

  private physicslessHint(): void {
    this.add.text(28, H - 22, "TIP: MOVE THE LANTERN. THE SHADOW'S PATH MOVES WITH IT.", {
      fontFamily: "monospace", fontSize: "10px", color: "#82758e"
    });
  }

  update(_time: number, delta: number): void {
    if (this.won) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.scene.restart();
      return;
    }

    const dt = Math.min(delta / 1000, 0.033);
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up)
      || Phaser.Input.Keyboard.JustDown(this.cursors.space)
      || Phaser.Input.Keyboard.JustDown(this.keys.W);

    this.playerVx = left ? -210 : right ? 210 : 0;
    if (jumpPressed && this.grounded) {
      this.playerVy = -390;
      this.grounded = false;
    }
    this.playerVy += 900 * dt;

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
      nextX = 105;
      nextY = 456;
      this.playerVy = 0;
      this.say("YOU HAVE FALLEN OUTSIDE THE EMPLOYEE HANDBOOK.");
    }

    this.player.setPosition(nextX, nextY);
    this.player.setScale(this.playerVx < 0 ? -1 : 1, 1);

    const eDown = this.keys.E.isDown;
    if (eDown && !this.eWasDown) this.interact();
    this.eWasDown = eDown;

    const rDown = this.keys.R.isDown;
    if (rDown && !this.rWasDown) this.scene.restart();
    this.rWasDown = rDown;

    this.refreshShadow();
    this.updateCoffee();
    this.updateGate();
    if (this.time.now > this.messageUntil && this.messageUntil !== 0) {
      this.dialogueText.setText("A/D MOVE   SPACE JUMP   E INTERACT");
      this.messageUntil = 0;
    }
  }

  private drawBackdrop(): void {
    const g = this.add.graphics();
    g.fillStyle(0x21182f, 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(0x2c2040, 1);
    g.fillCircle(780, 125, 54);
    g.fillStyle(0xf0e8d8, 0.16);
    g.fillCircle(780, 125, 44);

    // Layered distant hills.
    g.fillStyle(0x2b2039, 1);
    g.fillTriangle(0, 405, 190, 210, 380, 405);
    g.fillTriangle(245, 410, 500, 235, 735, 410);
    g.fillTriangle(600, 405, 810, 200, 1020, 405);
    g.fillStyle(0x191520, 1);
    g.fillRect(0, 485, W, 115);

    for (let i = 0; i < 44; i++) {
      const x = (i * 137) % W;
      const y = 75 + ((i * 71) % 320);
      g.fillStyle(0xf0e8d8, 0.35 + (i % 3) * 0.15);
      g.fillCircle(x, y, i % 5 === 0 ? 2 : 1);
    }

    // Bare tree silhouettes.
    for (const x of [45, 260, 620, 925]) {
      g.lineStyle(5, 0x17131f, 1);
      g.lineBetween(x, 430, x + 3, 300);
      g.lineBetween(x + 2, 345, x - 20, 315);
      g.lineBetween(x + 2, 370, x + 25, 335);
      g.lineBetween(x + 1, 320, x + 18, 292);
    }
  }

  private drawPlatforms(): void {
    const g = this.add.graphics();
    for (const p of this.platforms) {
      g.fillStyle(0x352747, 1);
      g.fillRoundedRect(p.x, p.y, p.w, p.h, 4);
      g.fillStyle(0x7055a5, 1);
      g.fillRect(p.x, p.y, p.w, 5);
      g.fillStyle(0x4b365b, 1);
      for (let x = p.x + 12; x < p.x + p.w; x += 28) {
        g.fillRect(x, p.y + 12, 2, Math.min(30, p.h - 12));
      }
    }
  }

  private makePumpkin(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(0, 18, 44, 10);
    g.fillStyle(0xe8792f, 1);
    g.fillEllipse(0, 0, 34, 31);
    g.fillEllipse(-8, 0, 18, 29);
    g.fillEllipse(8, 0, 18, 29);
    g.fillStyle(0x7c9b52, 1);
    g.fillRoundedRect(-3, -21, 6, 9, 2);
    g.fillStyle(0x24172b, 1);
    g.fillTriangle(-9, -5, -3, 1, -11, 1);
    g.fillTriangle(9, -5, 3, 1, 11, 1);
    g.fillTriangle(-6, 7, 6, 7, 0, 12);
    c.add(g);
    return c;
  }

  private makeLantern(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const glow = this.add.circle(0, -13, 40, 0xf39a45, 0.09);
    const g = this.add.graphics();
    g.lineStyle(2, 0xf0c77c, 1);
    g.strokeRoundedRect(-11, -28, 22, 26, 4);
    g.fillStyle(0xf39a45, 1);
    g.fillRoundedRect(-8, -25, 16, 20, 3);
    g.fillStyle(0xffdf91, 1);
    g.fillTriangle(0, -23, -4, -11, 2, -8);
    g.lineStyle(2, 0xf0c77c, 1);
    g.beginPath(); g.arc(0, -28, 6, Math.PI, 0, false); g.strokePath();
    c.add([glow, g]);
    c.setDepth(3);
    return c;
  }

  private makeShadow(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x08070d, 0.92);
    g.fillEllipse(0, 0, 30, 36);
    g.fillEllipse(-8, -1, 15, 31);
    g.fillEllipse(8, -1, 15, 31);
    g.fillStyle(0x9c7be8, 1);
    g.fillCircle(-5, -5, 2);
    g.fillCircle(5, -5, 2);
    c.add(g);
    c.setDepth(4);
    return c;
  }

  private makeCoffee(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0xeee1d0, 1);
    g.fillRoundedRect(-9, -11, 18, 17, 3);
    g.lineStyle(3, 0xeee1d0, 1);
    g.strokeCircle(10, -3, 5);
    g.fillStyle(0x6d3d29, 1);
    g.fillRect(-6, -8, 12, 3);
    g.lineStyle(2, 0xf0e8d8, 0.6);
    g.lineBetween(-4, -16, -6, -21);
    g.lineBetween(3, -16, 1, -22);
    c.add(g);
    c.setDepth(5);
    this.add.text(x, y + 15, "COFFEE", {
      fontFamily: "monospace", fontSize: "9px", color: "#f0e8d8"
    }).setOrigin(0.5);
    return c;
  }

  private makeSwitch(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x21182f, 1);
    g.fillRoundedRect(-17, -20, 34, 29, 4);
    g.fillStyle(0x7055a5, 1);
    g.fillCircle(0, -6, 8);
    g.fillStyle(0xf0e8d8, 1);
    g.fillCircle(0, -6, 3);
    c.add(g);
    this.add.text(x, y + 16, "SWITCH", {
      fontFamily: "monospace", fontSize: "9px", color: "#c5b7d7"
    }).setOrigin(0.5);
    return c;
  }

  private makeGate(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x352747, 1);
    g.fillRoundedRect(-30, -58, 60, 116, 5);
    g.lineStyle(4, 0x7055a5, 1);
    g.strokeRoundedRect(-24, -52, 48, 108, 4);
    g.fillStyle(0x17131f, 1);
    g.fillRect(-16, -42, 32, 96);
    g.fillStyle(0xf39a45, 0.8);
    g.fillCircle(0, -7, 6);
    c.add(g);
    this.add.text(x, y + 67, "EXIT", {
      fontFamily: "monospace", fontSize: "10px", color: "#f39a45"
    }).setOrigin(0.5);
    return c;
  }

  private refreshShadow(): void {
    // A stylized gameplay projection: lantern position determines the shadow route.
    // The route shifts horizontally and becomes traversable when the demand is met.
    const projectedX = Phaser.Math.Clamp(
      this.lanternX + 180 + (this.player.x - 260) * 0.22,
      445,
      625
    );
    const projectedY = this.demandSatisfied ? 447 : 463;
    this.shadow.setPosition(projectedX, projectedY);
    this.shadow.setAlpha(this.demandSatisfied ? 1 : 0.78);
    this.shadowLabel.setPosition(projectedX, projectedY - 31);
    this.shadowLabel.setText(this.demandSatisfied ? "READY TO WORK" : "ON BREAK");
    this.shadowLabel.setColor(this.demandSatisfied ? "#f39a45" : "#c5a8ff");

    // Draw a dotted route between the lantern's projected shadow point and switch.
    let route = this.data.get("routeGraphics") as Phaser.GameObjects.Graphics | undefined;
    if (!route) {
      route = this.add.graphics();
      route.setDepth(2);
      this.data.set("routeGraphics", route);
    }
    route.clear();
    route.lineStyle(2, this.demandSatisfied ? 0xf39a45 : 0x7055a5, 0.7);
    const startX = projectedX;
    const endX = 670;
    for (let x = startX; x < endX; x += 14) {
      route.fillStyle(this.demandSatisfied ? 0xf39a45 : 0x7055a5, 0.8);
      route.fillCircle(x, 480 - Math.sin((x + this.time.now * 0.05) * 0.04) * 5, 2);
    }
    // Reuse the same graphics object to avoid allocating a new object every frame.
  }

  private updateCoffee(): void {
    if (!this.hasCoffee && Phaser.Math.Distance.Between(
      this.player.x, this.player.y, this.coffee.x, this.coffee.y
    ) < 38) {
      this.say("PRESS E TO OFFER THE SHADOW A COFFEE.");
    }
  }

  private interact(): void {
    const px = this.player.x;
    if (!this.hasCoffee && Phaser.Math.Distance.Between(px, this.player.y, this.coffee.x, this.coffee.y) < 55) {
      this.hasCoffee = true;
      this.coffee.setVisible(false);
      this.demandSatisfied = true;
      this.demandText.setText("UNION DEMAND: COFFEE BREAK APPROVED ✓");
      this.say("SHADOW: 'Acceptable. I will consider doing my job.'");
      this.refreshShadow();
      return;
    }

    if (Phaser.Math.Distance.Between(px, this.player.y, this.lanternX, 438) < 72) {
      const direction = px < this.lanternX ? 1 : -1;
      this.lanternX = Phaser.Math.Clamp(this.lanternX + direction * 45, this.lanternMin, this.lanternMax);
      this.lantern.setX(this.lanternX);
      this.say("LANTERN REPOSITIONED. SHADOW ROUTE UPDATED.");
      this.refreshShadow();
      return;
    }

    if (this.demandSatisfied && Phaser.Math.Distance.Between(px, this.player.y, this.switchObject.x, this.switchObject.y) < 65) {
      this.switchOn = true;
      this.switchObject.setAlpha(0.45);
      this.say("SHADOW: 'Switch activated. Please update my job title.'");
      this.updateGate();
      return;
    }

    if (Phaser.Math.Distance.Between(px, this.player.y, this.shadow.x, this.shadow.y) < 70 && !this.demandSatisfied) {
      this.say("SHADOW: 'I am legally entitled to one (1) coffee.'");
      return;
    }

    this.say("E: INTERACT. TRY THE LANTERN, COFFEE, OR SWITCH.");
  }

  private updateGate(): void {
    if (!this.switchOn) return;
    this.gate.setAlpha(0.45);
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.gate.x, this.gate.y) < 55) {
      this.won = true;
      this.showWin();
    }
  }

  private showWin(): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x100d16, 0.88).setDepth(20);
    this.add.text(W / 2, 215, "COLLECTIVE ESCAPE!", {
      fontFamily: "monospace", fontSize: "34px", color: "#f39a45",
      fontStyle: "bold", align: "center"
    }).setOrigin(0.5).setDepth(21);
    this.add.text(W / 2, 280,
      "The shadow has agreed to leave the forest.\nManagement has agreed to stop calling it 'the dark bit.'\n\nA historic victory for workplace relations.",
      {
        fontFamily: "monospace", fontSize: "15px", color: "#f0e8d8",
        align: "center", lineSpacing: 9
      }).setOrigin(0.5).setDepth(21);
    this.add.text(W / 2, 385, "PRESS R TO RESTART YOUR SHIFT", {
      fontFamily: "monospace", fontSize: "12px", color: "#c5a8ff"
    }).setOrigin(0.5).setDepth(21);
  }

  private say(text: string): void {
    this.message = text;
    this.dialogueText.setText(text);
    this.messageUntil = this.time.now + 2800;
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: W,
  height: H,
  backgroundColor: "#17131f",
  pixelArt: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H
  },
  scene: [GameScene]
};

new Phaser.Game(config);
