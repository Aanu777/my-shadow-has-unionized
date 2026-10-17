import Phaser from "phaser";

const W = 960;
const H = 600;
const FLOOR = 500;
const WORLD = 1920;

type ArchiveFile = { x: number; title: string; clue: string; collected: boolean; art: Phaser.GameObjects.Container };

export class ShiftThreeScene extends Phaser.Scene {
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private player!: Phaser.GameObjects.Container;
  private playerVx = 0;
  private playerVy = 0;
  private grounded = false;
  private files: ArchiveFile[] = [];
  private consoles: Phaser.GameObjects.Container[] = [];
  private consoleStates = [false, false];
  private door!: Phaser.GameObjects.Container;
  private doorOpen = false;
  private won = false;
  private dead = false;
  private checkpointX = 110;
  private messageText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private fileCountText!: Phaser.GameObjects.Text;
  private eWasDown = false;
  private rWasDown = false;
  private conveyorArrows: Phaser.GameObjects.Graphics[] = [];
  private scannerBeams: Array<{ x: number; beam: Phaser.GameObjects.Rectangle; lamp: Phaser.GameObjects.Arc; phase: number }> = [];
  private drones: Phaser.GameObjects.Container[] = [];
  private startTime = 0;

  constructor() { super("ShiftThreeScene"); }

  create(): void {
    this.playerVx = 0; this.playerVy = 0; this.grounded = false;
    this.files = []; this.consoles = []; this.consoleStates = [false, false];
    this.doorOpen = false; this.won = false; this.dead = false;
    this.eWasDown = false; this.rWasDown = false; this.checkpointX = 110;
    this.conveyorArrows = []; this.scannerBeams = []; this.drones = [];
    this.startTime = this.time.now;
    this.cameras.main.setBackgroundColor("#0a0912");
    this.cameras.main.setBounds(0, 0, WORLD, H);
    this.drawArchiveBackdrop();
    this.drawFloor();
    this.drawConveyor(480, 730, 0);
    this.drawConveyor(1080, 1340, 1);
    this.createScanner(655, 0.2);
    this.createScanner(1270, 2.5);
    this.createDrone(900, 1110, 414, 0);
    this.createDrone(1450, 1665, 392, 1);
    this.createCheckpoint(875);
    this.createArchiveFiles();
    this.createConsoles();
    this.door = this.createArchiveDoor(1815, 420);

    this.player = this.makePumpkin(108, FLOOR - 17);
    this.player.setDepth(8);
    this.cameras.main.startFollow(this.player, true, 0.11, 0.08);
    this.cameras.main.setDeadzone(250, 90);

    this.add.text(24, 18, "PERSONNEL RECORDS  //  SHIFT 03", {
      fontFamily: "monospace", fontSize: "12px", color: "#c5a8ff", letterSpacing: 2
    }).setScrollFactor(0).setDepth(30);
    this.objectiveText = this.add.text(24, 43, "OBJECTIVE: RECOVER THE THREE MISSING FILES", {
      fontFamily: "monospace", fontSize: "11px", color: "#f0e8d8"
    }).setScrollFactor(0).setDepth(30);
    this.fileCountText = this.add.text(W - 24, 18, "FILES  0 / 3", {
      fontFamily: "monospace", fontSize: "11px", color: "#f4b860"
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(30);
    this.add.text(W - 24, 42, "A/D MOVE   SPACE JUMP   E INTERACT   R RESTART", {
      fontFamily: "monospace", fontSize: "9px", color: "#8d829c"
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(30);
    this.messageText = this.add.text(W / 2, H - 32, "HR HAS MISPLACED YOUR SHADOW. AGAIN.", {
      fontFamily: "monospace", fontSize: "11px", color: "#e8d9f8",
      backgroundColor: "#171221", padding: { x: 12, y: 7 }, align: "center",
      wordWrap: { width: 780 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault();
    });
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys("A,D,W,E,R,ENTER") as Record<string, Phaser.Input.Keyboard.Key>;
    }
    this.tweens.add({ targets: this.messageText, alpha: { from: 0.72, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
  }

  update(_time: number, delta: number): void {
    if (this.won || this.dead) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.scene.start("GameScene");
      return;
    }
    const dt = Math.min(delta / 1000, 0.033);
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.W);
    const target = left === right ? 0 : left ? -230 : 230;
    this.playerVx = Phaser.Math.Linear(this.playerVx, target, Math.min(1, dt * (target === 0 ? 13 : 18)));
    if (jump && this.grounded) { this.playerVy = -455; this.grounded = false; }
    this.playerVy += 1050 * dt;
    const oldX = this.player.x;
    let nextX = Phaser.Math.Clamp(oldX + this.playerVx * dt, 18, WORLD - 20);
    let nextY = this.player.y + this.playerVy * dt;
    const beltOne = nextX > 480 && nextX < 730;
    const beltTwo = nextX > 1080 && nextX < 1340;
    if (beltOne) nextX += this.consoleStates[0] ? -78 * dt : 92 * dt;
    if (beltTwo) nextX += this.consoleStates[1] ? -78 * dt : 92 * dt;
    nextX = Phaser.Math.Clamp(nextX, 18, WORLD - 20);
    if (nextY >= FLOOR - 17) { nextY = FLOOR - 17; this.playerVy = 0; this.grounded = true; }
    else this.grounded = false;
    this.player.setPosition(nextX, nextY);
    this.player.setScale(this.playerVx < -8 ? -1 : 1, 1);
    const walk = this.grounded && Math.abs(this.playerVx) > 8;
    const art = this.player.getAt(1) as Phaser.GameObjects.Graphics;
    art.y = walk ? Math.abs(Math.sin(this.time.now * 0.016)) * 2 : Math.sin(this.time.now * 0.003) * 0.5;

    this.scannerBeams.forEach((scanner, i) => {
      const active = Math.sin(this.time.now * 0.0018 + scanner.phase) > -0.12;
      scanner.beam.setAlpha(active ? 0.62 : 0.08);
      scanner.lamp.setFillStyle(active ? 0xff6c67 : 0x72d8bb, 1);
      if (active && Math.abs(this.player.x - scanner.x) < 18 && this.player.y > 405) {
        this.fail("SECURITY SCAN DETECTED UNAUTHORIZED PUMPKIN.");
      }
    });
    this.drones.forEach((drone, i) => {
      const range = i === 0 ? [900, 1110] : [1450, 1665];
      drone.x = range[0] + (range[1] - range[0]) * (0.5 + 0.5 * Math.sin(this.time.now * (i === 0 ? 0.00085 : 0.00068) + i));
      drone.y = (i === 0 ? 414 : 392) + Math.sin(this.time.now * 0.002 + i) * 8;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y - 4, drone.x, drone.y) < 28) {
        this.fail("DRONE FLAGGED YOUR EMPLOYEE ID. BACK TO THE LAST CHECKPOINT.");
      }
    });
    this.conveyorArrows.forEach((g, i) => { g.x = Math.sin(this.time.now * 0.002 + i) * 4; });
    const e = this.keys.E.isDown;
    if (e && !this.eWasDown) this.interact();
    this.eWasDown = e;
    const r = this.keys.R.isDown;
    if (r && !this.rWasDown) this.scene.restart();
    this.rWasDown = r;
    if (this.player.x > this.checkpointX) this.checkpointX = 875;
    this.updateDoor();
  }

  private drawArchiveBackdrop(): void {
    const bg = this.add.graphics().setDepth(-10);
    bg.fillStyle(0x0a0912, 1); bg.fillRect(0, 0, WORLD, H);
    // Distant stacks of archive cabinets and tall institutional pillars.
    for (let x = 0; x < WORLD; x += 240) {
      bg.fillStyle(0x171322, 1); bg.fillRect(x + 12, 98, 190, 355);
      bg.fillStyle(0x29213a, 1); bg.fillRect(x + 20, 106, 174, 8);
      bg.fillStyle(0x100e19, 1); bg.fillRect(x + 27, 124, 160, 310);
      for (let y = 145; y < 430; y += 42) {
        bg.fillStyle(0x31243d, 1); bg.fillRect(x + 31, y, 152, 3);
        for (let n = 0; n < 6; n++) {
          const fx = x + 37 + n * 24;
          bg.fillStyle((n + Math.floor(y / 42)) % 4 === 0 ? 0x8f6f9f : 0x4d3a59, 1);
          bg.fillRect(fx, y + 5, 15, 27);
          bg.fillStyle(0xd6a16b, 0.65); bg.fillRect(fx + 3, y + 10, 8, 2);
        }
      }
      bg.fillStyle(0x352740, 1); bg.fillRect(x + 5, 78, 204, 16);
      bg.fillStyle(0xc5a8ff, 0.65); bg.fillRect(x + 28, 81, 42, 2);
      bg.fillStyle(0xf4b860, 0.65); bg.fillRect(x + 142, 81, 38, 2);
    }
    // Suspended pipes, hanging lamps and narrow windows to imply an underground megastructure.
    bg.lineStyle(8, 0x21192e, 1); bg.beginPath();
    bg.moveTo(0, 68); bg.lineTo(WORLD, 68); bg.moveTo(0, 85); bg.lineTo(WORLD, 85); bg.strokePath();
    for (let x = 90; x < WORLD; x += 180) {
      bg.fillStyle(0x32233b, 1); bg.fillRect(x, 65, 5, 35);
      bg.fillStyle(0xf4b860, 0.9); bg.fillRoundedRect(x - 12, 99, 29, 4, 2);
      bg.fillStyle(0xf4b860, 0.07); bg.fillTriangle(x - 35, 104, x + 40, 104, x, 230);
    }
    // Back wall labels are decorative diegetic details, not tutorial clutter.
    const labels = ["PERSONNEL / INACTIVE", "DECEASED SHADOWS", "FORM 08-B", "ARCHIVE C"];
    labels.forEach((label, i) => {
      this.add.text(100 + i * 470, 126 + (i % 2) * 16, label, {
        fontFamily: "monospace", fontSize: "9px", color: "#766384", letterSpacing: 2
      }).setDepth(-5);
    });
    const fog = this.add.graphics().setDepth(-4);
    fog.fillStyle(0x6b4b83, 0.05); fog.fillRect(0, 300, WORLD, 160);
    for (let x = 60; x < WORLD; x += 150) {
      const mote = this.add.circle(x, 270 + (x % 5) * 22, 1.5, 0xc5a8ff, 0.35).setDepth(-2);
      this.tweens.add({ targets: mote, y: mote.y - 18, alpha: 0.05, duration: 1700 + x % 500, repeat: -1, yoyo: true, ease: "Sine.inOut" });
    }
  }

  private drawFloor(): void {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x171421, 1); g.fillRect(0, FLOOR, WORLD, H - FLOOR);
    g.fillStyle(0x6b4c7b, 1); g.fillRect(0, FLOOR, WORLD, 4);
    g.fillStyle(0x33263d, 1); g.fillRect(0, FLOOR + 4, WORLD, 3);
    g.lineStyle(1, 0x45344e, 0.9);
    for (let x = 0; x < WORLD; x += 48) {
      g.lineBetween(x, FLOOR + 8, x, H);
      g.fillStyle(0x090811, 1); g.fillRect(x + 10, FLOOR + 19, 8, 2);
    }
    for (let x = 0; x < WORLD; x += 160) {
      g.fillStyle(0x24192e, 1); g.fillRect(x, FLOOR + 34, 112, 4);
      g.fillStyle(0xf4b860, 0.7); g.fillRect(x + 10, FLOOR + 35, 22, 2);
    }
  }

  private drawConveyor(x1: number, x2: number, index: number): void {
    const g = this.add.graphics().setDepth(4);
    g.fillStyle(0x100d18, 1); g.fillRoundedRect(x1, FLOOR - 13, x2 - x1, 16, 3);
    g.fillStyle(0x3a2c47, 1); g.fillRect(x1, FLOOR - 12, x2 - x1, 3);
    g.lineStyle(1, 0x9b7ca9, 0.8);
    for (let x = x1 + 8; x < x2 - 5; x += 18) {
      g.beginPath(); g.moveTo(x, FLOOR - 9); g.lineTo(x + 7, FLOOR - 5); g.lineTo(x, FLOOR - 1); g.strokePath();
    }
    g.lineStyle(2, 0xf4b860, 0.85); g.strokeRect(x1, FLOOR - 15, x2 - x1, 20);
    const arrows = this.add.graphics().setDepth(5);
    arrows.fillStyle(0xf4b860, 0.9);
    for (let x = x1 + 24; x < x2 - 12; x += 52) {
      arrows.fillTriangle(x, FLOOR - 27, x + 12, FLOOR - 22, x, FLOOR - 17);
    }
    arrows.x = index * 2; this.conveyorArrows.push(arrows);
    const console = this.add.container(index === 0 ? x2 + 22 : x2 + 28, FLOOR - 18).setDepth(6);
    const cg = this.add.graphics();
    cg.fillStyle(0x171221, 1); cg.fillRoundedRect(-15, -28, 30, 31, 3);
    cg.lineStyle(2, 0xc5a8ff, 0.9); cg.strokeRoundedRect(-15, -28, 30, 31, 3);
    cg.fillStyle(0x352544, 1); cg.fillRect(-9, -21, 18, 13);
    cg.fillStyle(0xf4b860, 1); cg.fillTriangle(-5, -17, 4, -17, 0, -12);
    cg.fillStyle(0x8c79a5, 1); cg.fillCircle(0, -2, 4);
    console.add(cg);
    this.consoles.push(console);
    this.add.text(console.x, FLOOR - 53, index === 0 ? "BELT A" : "SORTER B", {
      fontFamily: "monospace", fontSize: "8px", color: "#c5a8ff"
    }).setOrigin(0.5).setDepth(7);
  }

  private createScanner(x: number, phase: number): void {
    const housing = this.add.container(x, 0).setDepth(6);
    const g = this.add.graphics();
    g.fillStyle(0x20162a, 1); g.fillRoundedRect(-16, 74, 32, 28, 3);
    g.lineStyle(2, 0x735a86, 1); g.strokeRoundedRect(-16, 74, 32, 28, 3);
    g.fillStyle(0xf4b860, 1); g.fillRect(-8, 82, 16, 3);
    g.fillStyle(0x39283e, 1); g.fillRect(-4, 100, 8, 365);
    housing.add(g);
    const beam = this.add.rectangle(x, 300, 4, 380, 0xff6c67, 0.5).setDepth(7);
    const lamp = this.add.circle(x, 110, 5, 0xff6c67, 1).setDepth(8);
    this.scannerBeams.push({ x, beam, lamp, phase });
  }

  private createDrone(minX: number, maxX: number, y: number, index: number): void {
    const drone = this.add.container(minX, y).setDepth(7);
    const g = this.add.graphics();
    g.fillStyle(0x0b0a12, 1); g.fillRoundedRect(-20, -11, 40, 22, 5);
    g.fillStyle(0x30223e, 1); g.fillRoundedRect(-16, -8, 32, 16, 4);
    g.lineStyle(2, 0x8b6ca1, 1); g.strokeRoundedRect(-16, -8, 32, 16, 4);
    g.fillStyle(0xff6c67, 1); g.fillRect(-4, -2, 8, 4);
    g.fillStyle(0x5b456a, 1); g.fillRect(-26, -3, 7, 6); g.fillRect(19, -3, 7, 6);
    g.lineStyle(1, 0xff6c67, 0.6); g.lineBetween(-7, 14, 7, 14);
    drone.add(g);
    (drone as Phaser.GameObjects.Container & { patrol?: number[] }).patrol = [minX, maxX];
    this.drones.push(drone);
    this.tweens.add({ targets: drone, alpha: { from: 0.8, to: 1 }, duration: 480 + index * 100, yoyo: true, repeat: -1 });
  }

  private createCheckpoint(x: number): void {
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x20162a, 1); g.fillRoundedRect(x - 15, FLOOR - 62, 30, 58, 4);
    g.lineStyle(2, 0xf4b860, 1); g.strokeRoundedRect(x - 15, FLOOR - 62, 30, 58, 4);
    g.fillStyle(0xf4b860, 0.22); g.fillCircle(x, FLOOR - 32, 18);
    g.fillStyle(0xf4b860, 1); g.fillCircle(x, FLOOR - 32, 4);
    this.add.text(x, FLOOR - 72, "SAFE", { fontFamily: "monospace", fontSize: "8px", color: "#f4b860" }).setOrigin(0.5).setDepth(6);
  }

  private createArchiveFiles(): void {
    const specs = [
      { x: 360, title: "FORM 08-B", clue: "FILE 08-B: ROUTE ALL DISPUTED SHADOWS TO ARCHIVE C." },
      { x: 1015, title: "ROUTE SLIP", clue: "ROUTE SLIP: BELT A MUST RUN LEFT. RIGHTWARD FLOW IS A TRAP." },
      { x: 1515, title: "TERMINATION", clue: "TERMINATION ORDER: THE LEGITIMATE DOOR REQUIRES SORTER B TO ROUTE LEFT." }
    ];
    this.files = specs.map((spec, index) => {
      const art = this.add.container(spec.x, FLOOR - 33).setDepth(7);
      const g = this.add.graphics();
      g.fillStyle(0x080710, 0.8); g.fillEllipse(0, 21, 44, 8);
      g.fillStyle(0xd7c8dc, 1); g.fillRoundedRect(-15, -20, 30, 40, 2);
      g.fillStyle(index === 1 ? 0xc5a8ff : 0xf4b860, 1); g.fillRect(-15, -20, 30, 5);
      g.lineStyle(1, 0x5a4867, 1); g.strokeRoundedRect(-15, -20, 30, 40, 2);
      g.fillStyle(0x5d4c65, 1); g.fillRect(-9, -9, 18, 2); g.fillRect(-9, -3, 14, 2); g.fillRect(-9, 3, 17, 2);
      g.fillStyle(0x9e4e54, 1); g.fillRect(3, 8, 8, 7);
      art.add(g);
      const glow = this.add.circle(0, 0, 25, 0xc5a8ff, 0.07); art.addAt(glow, 0);
      this.tweens.add({ targets: art, y: FLOOR - 38, duration: 900 + index * 130, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.add.text(spec.x, FLOOR - 65, spec.title, { fontFamily: "monospace", fontSize: "8px", color: "#c5a8ff" }).setOrigin(0.5).setDepth(7);
      return { ...spec, collected: false, art };
    });
  }

  private createConsoles(): void {
    // Consoles are positioned after each conveyor; E reverses their direction.
    // Belt A's console is at x=752, Sorter B's at x=1364.
    const positions = [752, 1364];
    positions.forEach((x, i) => {
      const c = this.add.container(x, FLOOR - 18).setDepth(7);
      const g = this.add.graphics();
      g.fillStyle(0x15111f, 1); g.fillRoundedRect(-19, -36, 38, 40, 4);
      g.lineStyle(2, 0x8b6ca1, 1); g.strokeRoundedRect(-19, -36, 38, 40, 4);
      g.fillStyle(0x2c2038, 1); g.fillRoundedRect(-13, -29, 26, 19, 2);
      g.fillStyle(0xf4b860, 0.9); g.fillRect(-9, -24, 18, 2); g.fillRect(-9, -18, 12, 2);
      g.fillStyle(0x9c7be8, 1); g.fillCircle(0, -4, 4);
      c.add(g);
      this.add.text(x, FLOOR - 62, i === 0 ? "REVERSE A" : "ROUTE B", {
        fontFamily: "monospace", fontSize: "8px", color: "#c5a8ff"
      }).setOrigin(0.5).setDepth(8);
      this.consoles[i] = c;
    });
  }

  private makePumpkin(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const shadow = this.add.graphics();
    shadow.fillStyle(0x020107, 0.5); shadow.fillEllipse(0, 18, 43, 10); c.add(shadow);
    const body = this.add.graphics();
    body.fillStyle(0x3b1721, 1); body.fillEllipse(0, 0, 39, 35);
    body.fillStyle(0xb94725, 1); body.fillEllipse(-9, 1, 19, 31); body.fillEllipse(9, 1, 19, 31);
    body.fillStyle(0xf17a2e, 1); body.fillEllipse(0, 0, 23, 32);
    body.fillStyle(0xffa447, 1); body.fillEllipse(-2, -3, 14, 24);
    body.fillStyle(0x493a22, 1); body.fillRoundedRect(-4, -22, 8, 11, 2);
    body.fillStyle(0x759447, 1); body.fillRoundedRect(-2, -23, 4, 9, 1);
    body.fillStyle(0x401821, 1); body.fillTriangle(-11, -7, -3, 1, -12, 2); body.fillTriangle(11, -7, 3, 1, 12, 2);
    body.fillStyle(0xffd36e, 1); body.fillTriangle(-9, -5, -5, 0, -10, 0); body.fillTriangle(9, -5, 5, 0, 10, 0);
    body.fillStyle(0x401821, 1); body.fillTriangle(-7, 5, 7, 5, 0, 12);
    c.add(body);
    return c;
  }

  private interact(): void {
    const px = this.player.x;
    const file = this.files.find(f => !f.collected && Math.abs(f.x - px) < 58);
    if (file) {
      file.collected = true; file.art.setVisible(false);
      const count = this.files.filter(f => f.collected).length;
      this.fileCountText.setText(`FILES  ${count} / 3`);
      this.say(file.clue);
      this.cameras.main.flash(100, 197, 168, 255);
      this.updateObjective();
      return;
    }
    const consoleIndex = this.consoles.findIndex(c => Math.abs(c.x - px) < 72);
    if (consoleIndex >= 0) {
      this.consoleStates[consoleIndex] = !this.consoleStates[consoleIndex];
      const art = this.consoles[consoleIndex].getAt(0) as Phaser.GameObjects.Graphics;
      art.clear();
      art.fillStyle(0x15111f, 1); art.fillRoundedRect(-19, -36, 38, 40, 4);
      art.lineStyle(2, this.consoleStates[consoleIndex] ? 0xf4b860 : 0x8b6ca1, 1); art.strokeRoundedRect(-19, -36, 38, 40, 4);
      art.fillStyle(this.consoleStates[consoleIndex] ? 0x5b3c24 : 0x2c2038, 1); art.fillRoundedRect(-13, -29, 26, 19, 2);
      art.fillStyle(this.consoleStates[consoleIndex] ? 0xf4b860 : 0x9c7be8, 1); art.fillCircle(0, -4, 4);
      this.say(consoleIndex === 0
        ? (this.consoleStates[0] ? "BELT A REVERSED. ROUTE NOW FLOWS LEFT." : "BELT A RESTORED TO DEFAULT FLOW. TERRIBLE DECISION.")
        : (this.consoleStates[1] ? "SORTER B ROUTED LEFT. ARCHIVE C SELECTED." : "SORTER B ROUTED RIGHT. THE PAPERWORK IS LYING."));
      this.updateObjective();
      return;
    }
    if (Math.abs(this.player.x - this.door.x) < 82) {
      const count = this.files.filter(f => f.collected).length;
      if (count < 3) { this.say(`ACCESS DENIED. ${3 - count} PERSONNEL FILE(S) STILL MISSING.`); return; }
      if (!this.consoleStates[0]) { this.say("FILE 08-B SAYS BELT A MUST RUN LEFT. REVERSE IT."); return; }
      if (!this.consoleStates[1]) { this.say("TERMINATION ORDER SAYS SORTER B MUST ROUTE LEFT."); return; }
      this.openDoor();
      return;
    }
    this.say("CHECK THE CABINETS, READ THE CLUES, AND FIX BOTH ROUTING CONSOLES.");
  }

  private updateObjective(): void {
    const count = this.files.filter(f => f.collected).length;
    if (count < 3) this.objectiveText.setText("OBJECTIVE: RECOVER THE THREE MISSING FILES");
    else if (!this.consoleStates[0] || !this.consoleStates[1]) this.objectiveText.setText("OBJECTIVE: SET BOTH ROUTES TO LEFT");
    else this.objectiveText.setText("OBJECTIVE: PRESENT THE PAPERWORK AT THE ARCHIVE DOOR");
  }

  private updateDoor(): void {
    if (this.doorOpen && this.player.x > this.door.x + 22) this.showWin();
  }

  private openDoor(): void {
    if (this.doorOpen) return;
    this.doorOpen = true;
    this.say("PAPERWORK VERIFIED. EMPLOYEE STATUS: UNRESOLVED.");
    const art = this.door.getAt(0) as Phaser.GameObjects.Graphics;
    this.tweens.add({
      targets: this.door, x: this.door.x + 74, alpha: 0.15, duration: 900, ease: "Cubic.inOut",
      onComplete: () => { art.setVisible(false); }
    });
    this.cameras.main.shake(180, 0.003);
  }

  private createArchiveDoor(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setDepth(6);
    const g = this.add.graphics();
    g.fillStyle(0x05040a, 0.75); g.fillEllipse(0, 83, 110, 14);
    g.fillStyle(0x191322, 1); g.fillRoundedRect(-44, -65, 88, 125, 4);
    g.fillStyle(0x34243e, 1); g.fillRoundedRect(-38, -59, 76, 115, 3);
    g.lineStyle(3, 0x9b7ca9, 1); g.strokeRoundedRect(-38, -59, 76, 115, 3);
    g.fillStyle(0x0b0912, 1); g.fillRoundedRect(-26, -45, 52, 90, 2);
    g.lineStyle(2, 0xf4b860, 0.9); g.strokeRoundedRect(-22, -41, 44, 82, 2);
    g.fillStyle(0x24182e, 1); g.fillRect(-15, -28, 30, 25);
    g.fillStyle(0xf4b860, 1); g.fillRect(-9, -22, 18, 3); g.fillRect(-9, -14, 18, 3);
    g.fillStyle(0xc5a8ff, 0.9); g.fillCircle(0, 10, 5);
    g.fillStyle(0x0b0912, 1); g.fillRect(-3, 23, 6, 11);
    g.fillStyle(0xf4b860, 0.95); g.fillRect(-32, 48, 64, 3);
    c.add(g);
    this.add.text(x, y - 82, "ARCHIVE C", { fontFamily: "monospace", fontSize: "9px", color: "#f4b860", letterSpacing: 2 }).setOrigin(0.5).setDepth(7);
    return c;
  }

  private say(text: string): void {
    this.messageText.setText(text);
    this.messageText.setAlpha(1);
  }

  private fail(message: string): void {
    if (this.dead) return;
    this.dead = true;
    this.playerVx = 0; this.playerVy = 0;
    this.cameras.main.shake(180, 0.006);
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x080711, 0.86).setScrollFactor(0).setDepth(50);
    const title = this.add.text(W / 2, 220, "SECURITY INCIDENT", {
      fontFamily: "monospace", fontSize: "28px", color: "#ff8d82", fontStyle: "bold", letterSpacing: 2
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    const sub = this.add.text(W / 2, 275, message, {
      fontFamily: "monospace", fontSize: "11px", color: "#e8d9f8", align: "center", wordWrap: { width: 650 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    const hint = this.add.text(W / 2, 345, "PRESS R TO RESTART FROM CHECKPOINT", {
      fontFamily: "monospace", fontSize: "10px", color: "#f4b860"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.data.set("failureOverlay", [shade, title, sub, hint]);
  }

  private showWin(): void {
    if (this.won) return;
    this.won = true;
    this.add.rectangle(W / 2, H / 2, W, H, 0x080711, 0.9).setScrollFactor(0).setDepth(60);
    this.add.text(W / 2, 215, "FILED UNDER: NEVER HAPPENED", {
      fontFamily: "monospace", fontSize: "27px", color: "#f4b860", fontStyle: "bold", align: "center"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
    this.add.text(W / 2, 282,
      "You recovered the shadow's termination paperwork.\nHR has appealed the appeal.\n\nThe department has no record of this department.",
      { fontFamily: "monospace", fontSize: "13px", color: "#e8d9f8", align: "center", lineSpacing: 8 }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(61);
    this.add.text(W / 2, 385, "PRESS R TO RETURN TO THE SHIFT TERMINAL", {
      fontFamily: "monospace", fontSize: "10px", color: "#c5a8ff"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
  }
}
