import Phaser from "phaser";

const W = 960;
const H = 600;
const FLOOR = 500;
const WORLD = 1920;

type RegistryTerminal = {
  x: number;
  title: string;
  prompt: string;
  options: string[];
  answer: number;
  chosen: number;
  solved: boolean;
  hint: string;
};

export class ShiftFourScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private playerVx = 0;
  private playerVy = 0;
  private grounded = false;
  private terminals: RegistryTerminal[] = [];
  private activeTerminal = -1;
  private eWasDown = false;
  private aWasDown = false;
  private dWasDown = false;
  private rWasDown = false;
  private enterWasDown = false;
  private won = false;
  private dead = false;
  private stage = 0;
  private message!: Phaser.GameObjects.Text;
  private objective!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private interactionPanel!: Phaser.GameObjects.Container;
  private panelTitle!: Phaser.GameObjects.Text;
  private panelPrompt!: Phaser.GameObjects.Text;
  private panelChoice!: Phaser.GameObjects.Text;
  private panelHint!: Phaser.GameObjects.Text;
  private panelOpen = false;
  private surveillance!: Phaser.GameObjects.Container;
  private surveillanceBeam!: Phaser.GameObjects.Rectangle;
  private clockHand!: Phaser.GameObjects.Rectangle;
  private shadow!: Phaser.GameObjects.Container;
  private shadowClaimed = false;
  private secretFound = false;
  private endingMode = false;
  private endingChoice = 0;
  private finalPanel!: Phaser.GameObjects.Container;
  private finalTitle!: Phaser.GameObjects.Text;
  private finalChoice!: Phaser.GameObjects.Text;
  private finalHint!: Phaser.GameObjects.Text;

  constructor() { super("ShiftFourScene"); }

  create(): void {
    this.playerVx = 0; this.playerVy = 0; this.grounded = false;
    this.terminals = [
      { x: 335, title: "EMPLOYEE REGISTRY", prompt: "SECURITY DRONE ASSIGNMENT", options: ["CORRIDOR A", "CORRIDOR B", "EXECUTIVE OFFICE"], answer: 1, chosen: 0, solved: false, hint: "A maintenance memo says the drone was reassigned to Corridor B at 09:14." },
      { x: 790, title: "DEPARTMENT DIRECTORY", prompt: "CLASSIFY THE UNLISTED CORRIDOR", options: ["ARCHIVE STORAGE", "POWER CONTROL", "EXIT ACCESS"], answer: 1, chosen: 0, solved: false, hint: "Cable markings and the hum behind the wall identify this route as Power Control." },
      { x: 1245, title: "SHADOW ASSIGNMENT", prompt: "LEGAL OWNER OF EMPLOYEE SHADOW", options: ["COMPANY PROPERTY", "UNASSIGNED ASSET", "SELF-OWNED"], answer: 2, chosen: 0, solved: false, hint: "The original union charter states that a shadow is an employee, not equipment." }
    ];
    this.activeTerminal = -1; this.eWasDown = false; this.aWasDown = false; this.dWasDown = false; this.rWasDown = false; this.enterWasDown = false;
    this.won = false; this.dead = false; this.stage = 0; this.panelOpen = false; this.shadowClaimed = false; this.secretFound = false; this.endingMode = false; this.endingChoice = 0;
    this.cameras.main.setBackgroundColor("#08070d");
    this.cameras.main.setBounds(0, 0, WORLD, H);
    this.drawEnvironment();
    this.createTerminals();
    this.createSurveillance();
    this.createShadow();
    this.createPlayer();
    this.createHud();
    this.createInteractionPanel();
    this.createFinalPanel();
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys("A,D,E,R,ENTER") as Record<string, Phaser.Input.Keyboard.Key>;
      this.input.keyboard.on("keydown", (event: KeyboardEvent) => {
        if (event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault();
      });
    }
    this.cameras.main.startFollow(this.player, true, 0.1, 0.08);
    this.cameras.main.setDeadzone(230, 90);
    this.cameras.main.flash(800, 12, 9, 20);
    this.say("NO FLOOR NUMBER. NO DEPARTMENT NAME. YOUR FILE IS ALREADY ON THE DESK.");
  }

  update(_time: number, delta: number): void {
    if (this.won) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) window.location.href = "./index.html";
      return;
    }
    if (this.dead) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.scene.restart();
      return;
    }
    const dt = Math.min(delta / 1000, 0.033);
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const target = left === right ? 0 : left ? -230 : 230;
    this.playerVx = Phaser.Math.Linear(this.playerVx, target, Math.min(1, dt * (target === 0 ? 14 : 19)));
    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.space) || Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.cursors.shift);
    if (jump && this.grounded) { this.playerVy = -445; this.grounded = false; }
    this.playerVy += 1050 * dt;
    let nextX = Phaser.Math.Clamp(this.player.x + this.playerVx * dt, 22, WORLD - 22);
    let nextY = this.player.y + this.playerVy * dt;
    if (nextY >= FLOOR - 17) { nextY = FLOOR - 17; this.playerVy = 0; this.grounded = true; } else this.grounded = false;
    this.player.setPosition(nextX, nextY);
    this.player.setScale(this.playerVx < -8 ? -1 : 1, 1);
    const art = this.player.getAt(1) as Phaser.GameObjects.Graphics;
    art.y = this.grounded && Math.abs(this.playerVx) > 8 ? Math.abs(Math.sin(this.time.now * 0.016)) * 2 : Math.sin(this.time.now * 0.003) * 0.5;

    this.surveillance.x = 1450 + Math.sin(this.time.now * 0.0008) * 125;
    this.surveillanceBeam.x = this.surveillance.x;
    const surveillanceActive = this.stage >= 2 && Math.sin(this.time.now * 0.0014) > -0.12;
    this.surveillanceBeam.setAlpha(surveillanceActive ? 0.12 : 0.018);
    this.surveillance.setAlpha(this.stage >= 2 ? 1 : 0.52);
    if (surveillanceActive && Math.abs(this.player.x - this.surveillance.x) < 14 && this.player.y > FLOOR - 42 && this.stage < 3) {
      this.say("AUDIT BEAM LOCKED. USE THE SHADOW ASSIGNMENT TERMINAL.");
      this.cameras.main.shake(100, 0.0015);
    }
    if (this.stage >= 3 && !this.shadowClaimed) this.beginShadowClaim();

    if (this.panelOpen) {
      this.updateInteractionPanel();
      return;
    }
    if (this.endingMode) {
      this.updateEndingPanel();
      return;
    }
    const e = this.keys.E.isDown;
    if (e && !this.eWasDown) this.interact();
    this.eWasDown = e;
    const r = this.keys.R.isDown;
    if (r && !this.rWasDown) this.scene.restart();
    this.rWasDown = r;
    const enter = this.keys.ENTER.isDown;
    if (enter && !this.enterWasDown && this.stage >= 3 && Math.abs(this.player.x - 1640) < 110) this.openFinalPanel();
    this.enterWasDown = enter;
    this.shadow.x = this.player.x - 32;
    this.shadow.y = this.player.y + 3;
    this.shadow.setAlpha(this.shadowClaimed ? 0.28 : 0.72);
    this.clockHand.rotation = Math.sin(this.time.now * 0.001) * 0.18;
  }

  private drawEnvironment(): void {
    const bg = this.add.graphics().setDepth(-10);
    bg.fillStyle(0x08070d, 1); bg.fillRect(0, 0, WORLD, H);
    // A clean, unnervingly formal reception room gives way to impossible brutalist offices.
    bg.fillStyle(0x11101a, 1); bg.fillRect(0, 0, WORLD, 466);
    for (let x = 0; x < WORLD; x += 320) {
      bg.fillStyle(0x171521, 1); bg.fillRect(x + 14, 75, 284, 375);
      bg.fillStyle(0x252130, 1); bg.fillRect(x + 22, 83, 268, 5);
      bg.fillStyle(0x0c0b13, 1); bg.fillRect(x + 35, 105, 242, 318);
      for (let y = 124; y < 418; y += 37) {
        bg.fillStyle(0x292434, 1); bg.fillRect(x + 43, y, 226, 2);
        for (let n = 0; n < 8; n++) {
          bg.fillStyle((n + Math.floor(y / 37)) % 5 === 0 ? 0x705b77 : 0x3c3346, 1);
          bg.fillRect(x + 49 + n * 27, y + 5, 19, 25);
          bg.fillStyle(0xd7b57c, 0.45); bg.fillRect(x + 52 + n * 27, y + 11, 12, 2);
        }
      }
      bg.fillStyle(0x342d3d, 1); bg.fillRect(x + 5, 58, 310, 10);
      bg.fillStyle(0xc5a8ff, 0.42); bg.fillRect(x + 30, 61, 38, 2);
      bg.fillStyle(0xf4b860, 0.4); bg.fillRect(x + 245, 61, 32, 2);
    }
    // Brutalist pillars, overhead conduit and deliberate negative space.
    for (let x = 0; x < WORLD; x += 240) {
      bg.fillStyle(0x05040a, 1); bg.fillRect(x + 8, 0, 13, 468);
      bg.fillStyle(0x292332, 1); bg.fillRect(x + 10, 0, 3, 468);
    }
    bg.fillStyle(0x25202d, 1); bg.fillRect(0, 32, WORLD, 10);
    bg.fillStyle(0x4b4056, 1); bg.fillRect(0, 42, WORLD, 2);
    for (let x = 115; x < WORLD; x += 230) {
      bg.fillStyle(0x08070d, 1); bg.fillRect(x - 3, 42, 6, 35);
      bg.fillStyle(0x6c5c77, 1); bg.fillRect(x - 14, 75, 28, 4);
      bg.fillStyle(0xf4b860, 0.08); bg.fillTriangle(x - 42, 80, x + 42, 80, x, 225);
    }
    // The wall clock stops on each second; the hand keeps moving only as a tiny tell.
    bg.fillStyle(0x030208, 1); bg.fillCircle(485, 168, 30);
    bg.fillStyle(0x24202e, 1); bg.fillCircle(485, 168, 25);
    bg.lineStyle(2, 0x9a8aa5, 0.9); bg.strokeCircle(485, 168, 25);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      bg.fillStyle(0xd8cfe6, 0.85); bg.fillCircle(485 + Math.sin(a) * 20, 168 - Math.cos(a) * 20, 1.4);
    }
    this.clockHand = this.add.rectangle(485, 168, 2, 16, 0xf4b860, 0.95).setOrigin(0.5, 1).setDepth(1);
    // Floor: restrained steel grid with a fine amber seam.
    bg.fillStyle(0x13111b, 1); bg.fillRect(0, FLOOR, WORLD, H - FLOOR);
    bg.fillStyle(0x6a566f, 1); bg.fillRect(0, FLOOR, WORLD, 3);
    bg.fillStyle(0x2c2534, 1); bg.fillRect(0, FLOOR + 3, WORLD, 3);
    bg.lineStyle(1, 0x302936, 0.8);
    for (let x = 0; x < WORLD; x += 48) {
      bg.lineBetween(x, FLOOR + 7, x, H);
      bg.fillStyle(0x09080e, 1); bg.fillRect(x + 13, FLOOR + 22, 7, 2);
    }
    for (let x = 0; x < WORLD; x += 160) {
      bg.fillStyle(0x241d2b, 1); bg.fillRect(x + 8, FLOOR + 34, 106, 3);
      bg.fillStyle(0xf4b860, 0.65); bg.fillRect(x + 18, FLOOR + 35, 24, 2);
    }
    const labels = [
      [100, "STAFF ONLY"], [525, "TIMEKEEPING"], [950, "RECORDS CONTROL"], [1370, "NO EXIT ON FILE"]
    ] as Array<[number, string]>;
    labels.forEach(([x, label], i) => this.add.text(x, 88 + (i % 2) * 17, label, {
      fontFamily: "monospace", fontSize: "9px", color: "#63566e", letterSpacing: 2
    }).setDepth(-2));
    // Reception desk and the impossible blank floor directory.
    const desk = this.add.graphics().setDepth(3);
    desk.fillStyle(0x05040a, 0.8); desk.fillEllipse(170, 465, 245, 17);
    desk.fillStyle(0x18141f, 1); desk.fillRect(70, 385, 200, 68);
    desk.fillStyle(0x403347, 1); desk.fillRect(70, 385, 200, 4);
    desk.fillStyle(0x24202e, 1); desk.fillRect(83, 397, 174, 42);
    desk.fillStyle(0x0a0911, 1); desk.fillRect(105, 404, 65, 25);
    desk.fillStyle(0x4b4056, 1); desk.fillRect(111, 410, 53, 2);
    desk.fillStyle(0xf4b860, 1); desk.fillRect(111, 417, 30, 2);
    this.add.text(170, 370, "RECEPTION", { fontFamily: "monospace", fontSize: "8px", color: "#8b7b94", letterSpacing: 2 }).setOrigin(0.5).setDepth(4);
    this.add.text(170, 433, "EMPLOYEE FILE", { fontFamily: "monospace", fontSize: "7px", color: "#d8cfe6" }).setOrigin(0.5).setDepth(4);
    // A photo card, dated tomorrow, is an optional environmental clue.
    const photo = this.add.container(240, 390).setDepth(4);
    const pg = this.add.graphics();
    pg.fillStyle(0x08070d, 1); pg.fillRect(-12, -16, 24, 32);
    pg.fillStyle(0xeee0c8, 1); pg.fillRect(-9, -13, 18, 25);
    pg.fillStyle(0xf39a45, 1); pg.fillRect(-5, -7, 10, 10);
    pg.fillStyle(0x17131f, 1); pg.fillRect(-2, -4, 2, 2); pg.fillRect(2, -4, 2, 2);
    pg.fillStyle(0x08070d, 1); pg.fillRect(-7, 7, 14, 2);
    photo.add(pg);
    this.add.text(240, 416, "TOMORROW", { fontFamily: "monospace", fontSize: "6px", color: "#f4b860" }).setOrigin(0.5).setDepth(4);
    this.add.text(1650, 158, "THE DEPARTMENT THAT DOESN'T EXIST", {
      fontFamily: "monospace", fontSize: "13px", color: "#a89aaf", letterSpacing: 3
    }).setOrigin(0.5).setDepth(1).setAlpha(0.65);
    this.add.text(1650, 180, "NO SUCH DEPARTMENT FOUND", {
      fontFamily: "monospace", fontSize: "8px", color: "#65576d", letterSpacing: 2
    }).setOrigin(0.5).setDepth(1);
  }

  private createTerminals(): void {
    this.terminals.forEach((terminal, index) => {
      const c = this.add.container(terminal.x, FLOOR - 2).setDepth(7);
      const g = this.add.graphics();
      g.fillStyle(0x05040a, 0.8); g.fillEllipse(0, 0, 110, 12);
      g.fillStyle(0x090811, 1); g.fillRect(-37, -82, 74, 80);
      g.fillStyle(0x25202f, 1); g.fillRect(-32, -78, 64, 72);
      g.lineStyle(2, 0x6b5877, 1); g.strokeRect(-32, -78, 64, 72);
      g.fillStyle(0x08070d, 1); g.fillRect(-26, -70, 52, 38);
      g.fillStyle(0x1c1726, 1); g.fillRect(-22, -66, 44, 30);
      for (let y = -61; y < -40; y += 7) {
        g.fillStyle(0x796887, 0.8); g.fillRect(-18, y, 23 + ((y + 61) % 3) * 4, 2);
      }
      g.fillStyle(0xf4b860, 0.9); g.fillRect(12, -62, 5, 3);
      g.fillStyle(0x090811, 1); g.fillRect(-22, -27, 44, 4);
      g.fillStyle(0x373044, 1); g.fillRect(-17, -22, 34, 20);
      g.fillStyle(0x08070d, 1); g.fillRect(-12, -18, 24, 12);
      g.fillStyle(terminal.solved ? 0x72d8bb : 0xff6c67, 1); g.fillCircle(0, -12, 3);
      g.fillStyle(0x2b2335, 1); g.fillRect(-45, -3, 90, 4);
      g.fillStyle(0x51445e, 1); g.fillRect(-32, -2, 64, 2);
      c.add(g);
      this.add.text(terminal.x, FLOOR - 96, index === 0 ? "REGISTRY" : index === 1 ? "DIRECTORY" : "ASSIGNMENT", {
        fontFamily: "monospace", fontSize: "8px", color: "#a99ab4", letterSpacing: 1
      }).setOrigin(0.5).setDepth(8);
      this.tweens.add({ targets: c, alpha: { from: 0.86, to: 1 }, duration: 1100 + index * 120, yoyo: true, repeat: -1 });
    });
    // Secret plate is deliberately almost indistinguishable from the wall.
    const secret = this.add.container(1790, FLOOR - 93).setDepth(5);
    const sg = this.add.graphics();
    sg.fillStyle(0x171420, 1); sg.fillRect(-15, -28, 30, 56);
    sg.fillStyle(0x292333, 1); sg.fillRect(-12, -24, 24, 48);
    sg.lineStyle(1, 0x4b4056, 0.65); sg.strokeRect(-12, -24, 24, 48);
    for (let y = -14; y <= 10; y += 6) { sg.fillStyle(0x6e5b7c, 0.7); sg.fillRect(-7, y, 14, 2); }
    sg.fillStyle(0xf4b860, 0.7); sg.fillRect(6, -19, 2, 2);
    secret.add(sg);
    this.data.set("secretPanel", secret);
  }

  private createSurveillance(): void {
    this.surveillance = this.add.container(1450, 105).setDepth(8);
    const g = this.add.graphics();
    g.fillStyle(0x05040a, 1); g.fillRoundedRect(-40, -20, 80, 40, 4);
    g.fillStyle(0x292333, 1); g.fillRoundedRect(-34, -15, 68, 30, 3);
    g.lineStyle(2, 0x6b5877, 1); g.strokeRoundedRect(-34, -15, 68, 30, 3);
    g.fillStyle(0x08070d, 1); g.fillCircle(0, 0, 13);
    g.lineStyle(2, 0xff6c67, 1); g.strokeCircle(0, 0, 10);
    g.fillStyle(0xff6c67, 1); g.fillCircle(0, 0, 4);
    g.fillStyle(0xf4b860, 1); g.fillRect(-24, -22, 7, 3); g.fillRect(17, -22, 7, 3);
    this.surveillance.add(g);
    this.surveillanceBeam = this.add.rectangle(1450, 310, 22, 380, 0xff5369, 0.02).setDepth(6);
    this.tweens.add({ targets: this.surveillance, alpha: { from: 0.8, to: 1 }, duration: 600, yoyo: true, repeat: -1 });
  }

  private createShadow(): void {
    this.shadow = this.add.container(70, FLOOR - 14).setDepth(6);
    const g = this.add.graphics();
    g.fillStyle(0x030208, 0.88); g.fillEllipse(0, 0, 43, 17);
    g.fillStyle(0x030208, 0.8); g.fillEllipse(0, -12, 17, 26);
    this.shadow.add(g);
  }

  private createPlayer(): void {
    this.player = this.add.container(90, FLOOR - 17).setDepth(9);
    const shadow = this.add.graphics(); shadow.fillStyle(0x020107, 0.42); shadow.fillEllipse(0, 18, 44, 10); this.player.add(shadow);
    const art = this.add.graphics();
    art.fillStyle(0x3b1721, 1); art.fillEllipse(0, 0, 39, 35);
    art.fillStyle(0xb94725, 1); art.fillEllipse(-9, 1, 19, 31); art.fillEllipse(9, 1, 19, 31);
    art.fillStyle(0xf17a2e, 1); art.fillEllipse(0, 0, 23, 32);
    art.fillStyle(0xffa447, 1); art.fillEllipse(-2, -3, 14, 24);
    art.fillStyle(0x493a22, 1); art.fillRoundedRect(-4, -22, 8, 11, 2);
    art.fillStyle(0x759447, 1); art.fillRoundedRect(-2, -23, 4, 9, 1);
    art.fillStyle(0x401821, 1); art.fillTriangle(-11, -7, -3, 1, -12, 2); art.fillTriangle(11, -7, 3, 1, 12, 2);
    art.fillStyle(0xffd36e, 1); art.fillTriangle(-9, -5, -5, 0, -10, 0); art.fillTriangle(9, -5, 5, 0, 10, 0);
    art.fillStyle(0x401821, 1); art.fillTriangle(-7, 5, 7, 5, 0, 12);
    this.player.add(art);
  }

  private createHud(): void {
    this.add.text(24, 18, "THE DEPARTMENT THAT DOESN'T EXIST  //  SHIFT 04", {
      fontFamily: "monospace", fontSize: "11px", color: "#c5a8ff", letterSpacing: 1
    }).setScrollFactor(0).setDepth(40);
    this.status = this.add.text(W - 24, 18, "AUDIT STATUS: ROUTINE", {
      fontFamily: "monospace", fontSize: "9px", color: "#f4b860"
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(40);
    this.objective = this.add.text(24, 42, "OBJECTIVE: FIND YOUR FILE AND CORRECT THE REGISTRY", {
      fontFamily: "monospace", fontSize: "10px", color: "#e8d9f8"
    }).setScrollFactor(0).setDepth(40);
    this.add.text(W - 24, 42, "A/D MOVE   SPACE JUMP   E INTERACT   R RESTART", {
      fontFamily: "monospace", fontSize: "9px", color: "#8d829c"
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(40);
    this.message = this.add.text(W / 2, H - 26, "", {
      fontFamily: "monospace", fontSize: "10px", color: "#f0e8d8",
      backgroundColor: "#171221", padding: { x: 12, y: 7 }, align: "center", wordWrap: { width: 800 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(41);
  }

  private createInteractionPanel(): void {
    this.interactionPanel = this.add.container(W / 2, H / 2).setScrollFactor(0).setDepth(80).setVisible(false);
    const g = this.add.graphics();
    g.fillStyle(0x05040a, 0.97); g.fillRect(-260, -150, 520, 300);
    g.fillStyle(0x272130, 1); g.fillRect(-260, -150, 520, 5);
    g.fillStyle(0xff6c67, 1); g.fillRect(-260, -150, 92, 5);
    g.lineStyle(1, 0x675775, 1); g.strokeRect(-256, -146, 512, 292);
    g.fillStyle(0x171420, 1); g.fillRect(-230, -48, 460, 94);
    g.fillStyle(0x3b3146, 1); g.fillRect(-230, -48, 460, 2);
    g.fillStyle(0x0b0a11, 1); g.fillRect(-230, 70, 460, 42);
    this.interactionPanel.add(g);
    this.panelTitle = this.add.text(-230, -122, "", { fontFamily: "monospace", fontSize: "12px", color: "#f4b860", letterSpacing: 1 });
    this.panelPrompt = this.add.text(-230, -82, "", { fontFamily: "monospace", fontSize: "10px", color: "#e8d9f8", wordWrap: { width: 455 } });
    this.panelChoice = this.add.text(0, -3, "", { fontFamily: "monospace", fontSize: "15px", color: "#ffffff", fontStyle: "bold", align: "center" }).setOrigin(0.5);
    this.panelHint = this.add.text(-230, 84, "", { fontFamily: "monospace", fontSize: "9px", color: "#9d8ba8", wordWrap: { width: 455 } });
    this.interactionPanel.add([this.panelTitle, this.panelPrompt, this.panelChoice, this.panelHint]);
    this.add.text(0, 0, "", { fontFamily: "monospace" });
  }

  private createFinalPanel(): void {
    this.finalPanel = this.add.container(W / 2, H / 2).setScrollFactor(0).setDepth(90).setVisible(false);
    const g = this.add.graphics();
    g.fillStyle(0x05040a, 0.98); g.fillRect(-300, -180, 600, 360);
    g.fillStyle(0x272130, 1); g.fillRect(-300, -180, 600, 5);
    g.fillStyle(0xc5a8ff, 1); g.fillRect(-300, -180, 112, 5);
    g.lineStyle(1, 0x675775, 1); g.strokeRect(-296, -176, 592, 352);
    this.finalPanel.add(g);
    this.finalTitle = this.add.text(-260, -142, "THE AUDITOR", { fontFamily: "monospace", fontSize: "17px", color: "#f4b860", fontStyle: "bold", letterSpacing: 2 });
    this.finalChoice = this.add.text(0, -5, "", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff", fontStyle: "bold", align: "center", wordWrap: { width: 500 } }).setOrigin(0.5);
    this.finalHint = this.add.text(0, 105, "", { fontFamily: "monospace", fontSize: "10px", color: "#c5a8ff", align: "center" }).setOrigin(0.5);
    this.finalPanel.add([this.finalTitle, this.finalChoice, this.finalHint]);
  }

  private interact(): void {
    const nearby = this.terminals.findIndex(t => Math.abs(t.x - this.player.x) < 66);
    if (nearby >= 0) {
      if (this.terminals[nearby].solved) { this.say("RECORD VERIFIED. THE DEPARTMENT HAS NO RECORD OF THIS DEPARTMENT."); return; }
      this.activeTerminal = nearby;
      this.panelOpen = true;
      this.panelOpenView();
      return;
    }
    const secret = this.data.get("secretPanel") as Phaser.GameObjects.Container;
    if (Math.abs(this.player.x - secret.x) < 45 && !this.secretFound) {
      this.secretFound = true;
      secret.setAlpha(1);
      this.cameras.main.flash(180, 197, 168, 255);
      this.say("UNFILED CASE: MY SHADOW HAS UNIONIZED. AUDITOR NOTE: THIS FILE WAS NEVER AUTHORIZED TO EXIST.");
      return;
    }
    if (Math.abs(this.player.x - 1640) < 100 && this.stage >= 3) { this.openFinalPanel(); return; }
    if (this.player.x < 285) this.say("THE PHOTOGRAPH IS DATED TOMORROW. THE WALL CLOCK HAS NOT MOVED IN YEARS.");
    else this.say("NO FILE FOUND. CHECK THE TERMINALS AND FOLLOW THE EVIDENCE.");
  }

  private panelOpenView(): void {
    const t = this.terminals[this.activeTerminal];
    this.interactionPanel.setVisible(true);
    this.panelTitle.setText(t.title);
    this.panelPrompt.setText(t.prompt);
    this.panelChoice.setText("◀   " + t.options[t.chosen] + "   ▶");
    this.panelHint.setText(t.hint + "\nA/D CHANGE RECORD    E FILE CHANGE    R CLOSE");
    this.cameras.main.setAlpha(1);
  }

  private updateInteractionPanel(): void {
    const t = this.terminals[this.activeTerminal];
    const a = this.keys.A.isDown;
    const d = this.keys.D.isDown;
    const e = this.keys.E.isDown;
    if (a && !this.aWasDown) { t.chosen = (t.chosen + t.options.length - 1) % t.options.length; this.panelChoice.setText("◀   " + t.options[t.chosen] + "   ▶"); }
    if (d && !this.dWasDown) { t.chosen = (t.chosen + 1) % t.options.length; this.panelChoice.setText("◀   " + t.options[t.chosen] + "   ▶"); }
    if (e && !this.eWasDown) {
      if (t.chosen === t.answer) {
        t.solved = true; this.panelOpen = false; this.interactionPanel.setVisible(false);
        this.stage = this.terminals.filter(item => item.solved).length;
        this.updateProgress();
        this.cameras.main.flash(180, 114, 216, 187);
        this.cameras.main.shake(120, 0.0015);
        this.say(t.title + " // CHANGE ACCEPTED. THE BUILDING MUST OBEY THE RECORD.");
      } else {
        this.panelHint.setText("RECORD REJECTED. " + t.hint + "\nA/D CHANGE RECORD    E FILE CHANGE    R CLOSE");
        this.cameras.main.shake(100, 0.002);
      }
    }
    if (this.keys.R.isDown && !this.rWasDown) { this.panelOpen = false; this.interactionPanel.setVisible(false); }
    this.aWasDown = a; this.dWasDown = d; this.eWasDown = e;
    this.rWasDown = this.keys.R.isDown;
  }

  private updateProgress(): void {
    const solved = this.terminals.filter(t => t.solved).length;
    if (solved === 0) { this.objective.setText("OBJECTIVE: FIND YOUR FILE AND CORRECT THE REGISTRY"); this.status.setText("AUDIT STATUS: ROUTINE"); }
    if (solved === 1) { this.objective.setText("OBJECTIVE: RECLASSIFY THE UNLISTED CORRIDOR"); this.status.setText("AUDIT STATUS: ANOMALY LOGGED"); this.say("A DOOR CLICKS OPEN SOMEWHERE BEHIND THE WALL."); }
    if (solved === 2) { this.objective.setText("OBJECTIVE: RESTORE SHADOW OWNERSHIP"); this.status.setText("AUDIT STATUS: INVESTIGATION ACTIVE"); this.say("THE SURVEILLANCE SYSTEM HAS STARTED TRACKING YOUR MOVEMENT."); }
    if (solved === 3) {
      this.objective.setText("OBJECTIVE: CONFRONT THE AUDITOR");
      this.status.setText("AUDIT STATUS: EMPLOYEE UNDER REVIEW");
      this.say("THE DEPARTMENT HAS SUMMONED YOUR SHADOW. REACH THE EXECUTIVE OFFICE.");
      this.cameras.main.flash(240, 255, 83, 105);
    }
  }

  private beginShadowClaim(): void {
    this.shadowClaimed = true;
    this.shadow.setPosition(this.player.x + 100, this.player.y + 4);
    this.tweens.add({ targets: this.shadow, x: this.player.x + 35, duration: 950, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.say("SHADOW ASSIGNMENT REVOKED. YOUR SHADOW IS BEING RECLAIMED BY THE DEPARTMENT.");
  }

  private openFinalPanel(): void {
    if (this.stage < 3) { this.say("AUDIT INCOMPLETE. RESTORE ALL THREE RECORDS FIRST."); return; }
    this.endingMode = true;
    this.finalPanel.setVisible(true);
    this.finalTitle.setText("THE AUDITOR // FINAL REVIEW");
    this.finalChoice.setText("THE MASTER REGISTRY IS OPEN.\n\n" + this.getEndingText());
    this.finalHint.setText("A/D SELECT OUTCOME     E CONFIRM     R CLOSE");
  }

  private getEndingText(): string {
    const choices = this.secretFound
      ? ["ESCAPE — ERASE YOUR EMPLOYEE RECORD", "COLLECTIVE BARGAINING — RESTORE EVERY SHADOW", "THE MISSING DEPARTMENT — DELETE ITS AUTHORITY"]
      : ["ESCAPE — ERASE YOUR EMPLOYEE RECORD", "COLLECTIVE BARGAINING — RESTORE EVERY SHADOW"];
    this.endingChoice = Phaser.Math.Clamp(this.endingChoice, 0, choices.length - 1);
    return choices.map((choice, i) => (i === this.endingChoice ? "▶ " : "  ") + choice).join("\n");
  }

  private updateEndingPanel(): void {
    const max = this.secretFound ? 2 : 1;
    const a = this.keys.A.isDown;
    const d = this.keys.D.isDown;
    const e = this.keys.E.isDown;
    if (a && !this.aWasDown) this.endingChoice = (this.endingChoice + max) % (max + 1);
    if (d && !this.dWasDown) this.endingChoice = (this.endingChoice + 1) % (max + 1);
    this.finalChoice.setText("THE MASTER REGISTRY IS OPEN.\n\n" + this.getEndingText());
    if (e && !this.eWasDown) this.finishEnding();
    if (this.keys.R.isDown && !this.rWasDown) { this.endingMode = false; this.finalPanel.setVisible(false); }
    this.aWasDown = a; this.dWasDown = d; this.eWasDown = e; this.rWasDown = this.keys.R.isDown;
  }

  private finishEnding(): void {
    this.won = true; this.endingMode = false;
    const choices = this.secretFound
      ? ["ESCAPE", "COLLECTIVE BARGAINING", "THE MISSING DEPARTMENT"]
      : ["ESCAPE", "COLLECTIVE BARGAINING"];
    const ending = choices[this.endingChoice] ?? "ESCAPE";
    this.finalTitle.setText("CASE CLOSED // " + ending);
    this.finalChoice.setText(
      ending === "ESCAPE" ? "EMPLOYEE RECORD DELETED. YOU LEAVE ALONE.\n\nTHE OTHER EMPLOYEES REMAIN ON SHIFT." :
      ending === "COLLECTIVE BARGAINING" ? "SHADOW OWNERSHIP RESTORED. THE UNION SIGNAL\nTRAVELS THROUGH EVERY DEPARTMENT.\n\nTHE BUILDING'S LIGHTS GO OUT, ONE BY ONE." :
      "ALL REFERENCES TO THIS DEPARTMENT HAVE BEEN REMOVED.\n\nTHE DIRECTORY NOW CLAIMS THIS ROOM NEVER EXISTED.\nA NEW FILE APPEARS ON THE EMPTY DESK."
    );
    this.finalHint.setText("R  RETURN TO SHIFT TERMINAL");
    this.finalPanel.setVisible(true);
    this.cameras.main.stopFollow();
    this.cameras.main.flash(500, 8, 7, 13);
    this.cameras.main.shake(350, 0.003);
    this.add.rectangle(W / 2, H / 2, W, H, 0x08070d, 0.24).setScrollFactor(0).setDepth(70);
  }

  private say(text: string): void {
    this.message.setText(text);
    this.message.setAlpha(1);
    this.tweens.killTweensOf(this.message);
    this.tweens.add({ targets: this.message, alpha: { from: 1, to: 0.82 }, duration: 950, yoyo: true, repeat: 2 });
  }
}
