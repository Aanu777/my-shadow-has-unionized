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
  private conveyorRollers: Phaser.GameObjects.Container[] = [];
  private scannerBeams: Array<{ x: number; beam: Phaser.GameObjects.Rectangle; glow: Phaser.GameObjects.Rectangle; sweep: Phaser.GameObjects.Rectangle; lamp: Phaser.GameObjects.Arc; phase: number }> = [];
  private drones: Phaser.GameObjects.Container[] = [];
  private startTime = 0;
  private failureCall?: Phaser.Time.TimerEvent;
  private activeConsolePuzzle = -1;
  private consoleInputProgress = 0;
  private readonly consoleSequences: string[][] = [["A", "D", "A"], ["D", "A", "D"]];

  constructor() { super("ShiftThreeScene"); }

  create(): void {
    this.playerVx = 0; this.playerVy = 0; this.grounded = false;
    this.files = []; this.consoles = []; this.consoleStates = [false, false];
    this.doorOpen = false; this.won = false; this.dead = false;
    this.eWasDown = false; this.rWasDown = false; this.checkpointX = 110;
    this.conveyorArrows = []; this.conveyorRollers = []; this.scannerBeams = []; this.drones = [];
    this.startTime = this.time.now;
    this.failureCall = undefined;
    this.activeConsolePuzzle = -1; this.consoleInputProgress = 0;
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
    if (this.won) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) window.location.href = "./index.html";
      return;
    }
    if (this.dead) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.respawnAtCheckpoint();
      return;
    }
    if (this.activeConsolePuzzle >= 0) {
      this.updateConsolePuzzle();
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
      scanner.beam.setAlpha(active ? 0.42 + 0.16 * (0.5 + 0.5 * Math.sin(this.time.now * 0.012)) : 0.025);
      scanner.glow.setAlpha(active ? 0.12 : 0.015);
      scanner.sweep.setAlpha(active ? 0.78 : 0.04);
      scanner.lamp.setFillStyle(active ? 0xff6c67 : 0x72d8bb, 1);
      scanner.lamp.setScale(active ? 1 + 0.16 * Math.sin(this.time.now * 0.01) : 0.82);
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
    this.conveyorArrows.forEach((g, i) => {
      const speed = this.consoleStates[i] ? -1 : 1;
      g.x = Phaser.Math.Wrap(this.time.now * 0.035 * speed, -42, 42);
    });
    this.conveyorRollers.forEach((roller, i) => {
      roller.rotation = this.time.now * 0.004 * (i < 14 ? 1 : -1);
    });
    const e = this.keys.E.isDown;
    if (e && !this.eWasDown) this.interact();
    this.eWasDown = e;
    const r = this.keys.R.isDown;
    if (r && !this.rWasDown) this.scene.restart();
    this.rWasDown = r;
    if (this.checkpointX < 875 && this.player.x >= 875) { this.checkpointX = 875; this.say("CHECKPOINT LOGGED. HR WILL STILL DENY THIS HAPPENED."); }
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
    const width = x2 - x1;
    const g = this.add.graphics().setDepth(4);
    // Heavy steel chassis with layered bevels and recessed belt channel.
    g.fillStyle(0x08070d, 1); g.fillRoundedRect(x1 - 4, FLOOR - 18, width + 8, 24, 4);
    g.fillStyle(0x24202e, 1); g.fillRoundedRect(x1, FLOOR - 17, width, 20, 3);
    g.fillStyle(0x4a4056, 1); g.fillRect(x1 + 3, FLOOR - 16, width - 6, 2);
    g.fillStyle(0x0a0911, 1); g.fillRect(x1 + 4, FLOOR - 13, width - 8, 11);
    g.lineStyle(1, 0x8c7898, 0.9); g.strokeRoundedRect(x1, FLOOR - 17, width, 20, 3);
    // Side hazard markings make the machinery readable without adding clutter.
    for (let x = x1 + 5; x < x2 - 10; x += 28) {
      g.fillStyle(0xf4b860, 0.9);
      g.fillTriangle(x, FLOOR - 17, x + 10, FLOOR - 17, x, FLOOR - 12);
    }
    // Rotating steel rollers, each with a bright axle and spoke.
    for (let x = x1 + 10; x < x2 - 5; x += 18) {
      const roller = this.add.container(x, FLOOR - 6).setDepth(5);
      const rg = this.add.graphics();
      rg.fillStyle(0x17131f, 1); rg.fillCircle(0, 0, 6);
      rg.lineStyle(2, 0x7e6d8c, 1); rg.strokeCircle(0, 0, 5);
      rg.lineStyle(1, 0xf4b860, 0.9); rg.lineBetween(-3, 0, 3, 0);
      rg.lineBetween(0, -3, 0, 3);
      rg.fillStyle(0xc5a8ff, 1); rg.fillCircle(0, 0, 1.5);
      roller.add(rg);
      this.conveyorRollers.push(roller);
    }
    // Moving direction chevrons travel over the belt; console interaction reverses them.
    const arrows = this.add.graphics().setDepth(6);
    arrows.fillStyle(index === 0 ? 0xf4b860 : 0xc5a8ff, 0.92);
    for (let x = x1 + 18; x < x2 - 10; x += 42) {
      arrows.fillTriangle(x, FLOOR - 13, x + 11, FLOOR - 9, x, FLOOR - 5);
      arrows.fillTriangle(x + 12, FLOOR - 13, x + 23, FLOOR - 9, x + 12, FLOOR - 5);
    }
    arrows.setAlpha(0.9);
    this.conveyorArrows.push(arrows);
    // Small status lamp reflects the selected routing direction.
    const status = this.add.circle(x2 - 8, FLOOR - 20, 3, 0xff6c67, 1).setDepth(7);
    this.tweens.add({ targets: status, alpha: { from: 0.35, to: 1 }, duration: 420, yoyo: true, repeat: -1 });
  }

  private createScanner(x: number, phase: number): void {
    const housing = this.add.container(x, 0).setDepth(6);
    const g = this.add.graphics();
    // Ceiling-mounted scanner head with a glass aperture and warning fins.
    g.fillStyle(0x08070d, 1); g.fillRoundedRect(-22, 68, 44, 38, 5);
    g.fillStyle(0x282033, 1); g.fillRoundedRect(-17, 73, 34, 27, 3);
    g.lineStyle(2, 0x8d719e, 1); g.strokeRoundedRect(-17, 73, 34, 27, 3);
    g.fillStyle(0x0c0a12, 1); g.fillRoundedRect(-10, 79, 20, 12, 3);
    g.fillStyle(0xff6c67, 1); g.fillRoundedRect(-6, 82, 12, 5, 2);
    g.fillStyle(0x4a334f, 1); g.fillRect(-25, 77, 4, 17); g.fillRect(21, 77, 4, 17);
    g.fillStyle(0xf4b860, 0.95); g.fillRect(-8, 101, 16, 3);
    housing.add(g);
    const glow = this.add.rectangle(x, 300, 15, 380, 0xff5369, 0.12).setDepth(6);
    const beam = this.add.rectangle(x, 300, 3, 380, 0xff7484, 0.48).setDepth(7);
    const sweep = this.add.rectangle(x, 300, 18, 3, 0xffd5c8, 0.85).setDepth(8);
    const lamp = this.add.circle(x, 110, 5, 0xff6c67, 1).setDepth(9);
    this.tweens.add({ targets: sweep, y: { from: 145, to: 460 }, duration: 1050 + phase * 100, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.tweens.add({ targets: glow, alpha: { from: 0.07, to: 0.18 }, duration: 500, yoyo: true, repeat: -1 });
    this.scannerBeams.push({ x, beam, glow, sweep, lamp, phase });
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
      { x: 360, title: "FORM 08-B", clue: "FILE 08-B: ROUTE ALL DISPUTED SHADOWS TO ARCHIVE C. BELT A CALIBRATION: A → D → A." },
      { x: 1015, title: "ROUTE SLIP", clue: "ROUTE SLIP: BELT A MUST RUN LEFT. RIGHTWARD FLOW IS A TRAP. ENTER THE CALIBRATION KEYS IN ORDER." },
      { x: 1515, title: "TERMINATION", clue: "TERMINATION ORDER: SORTER B MUST ROUTE LEFT. CALIBRATION: D → A → D." }
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
      if (this.consoleStates[consoleIndex]) {
        this.say(consoleIndex === 0 ? "BELT A IS ALREADY LOCKED TO LEFTWARD FLOW." : "SORTER B IS ALREADY LOCKED TO ARCHIVE C.");
        return;
      }
      this.activeConsolePuzzle = consoleIndex;
      this.consoleInputProgress = 0;
      this.playerVx = 0;
      this.say(consoleIndex === 0
        ? "CALIBRATION A // ENTER: A  →  D  →  A. WRONG KEY RESETS THE SEQUENCE."
        : "CALIBRATION B // ENTER: D  →  A  →  D. WRONG KEY RESETS THE SEQUENCE.");
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

  private updateConsolePuzzle(): void {
    const expected = this.consoleSequences[this.activeConsolePuzzle][this.consoleInputProgress];
    const pressed = Phaser.Input.Keyboard.JustDown(this.keys.A) ? "A" :
      Phaser.Input.Keyboard.JustDown(this.keys.D) ? "D" : null;
    if (!pressed) return;
    if (pressed !== expected) {
      this.consoleInputProgress = 0;
      this.say(this.activeConsolePuzzle === 0
        ? "CALIBRATION REJECTED. SEQUENCE RESET: A  →  D  →  A."
        : "CALIBRATION REJECTED. SEQUENCE RESET: D  →  A  →  D.");
      return;
    }
    this.consoleInputProgress++;
    if (this.consoleInputProgress < this.consoleSequences[this.activeConsolePuzzle].length) {
      const remaining = this.consoleSequences[this.activeConsolePuzzle].slice(this.consoleInputProgress).join("  →  ");
      this.say("KEY ACCEPTED. NEXT: " + remaining);
      return;
    }
    const index = this.activeConsolePuzzle;
    this.consoleStates[index] = true;
    this.activeConsolePuzzle = -1;
    this.consoleInputProgress = 0;
    const art = this.consoles[index].getAt(0) as Phaser.GameObjects.Graphics;
    art.clear();
    art.fillStyle(0x15111f, 1); art.fillRect(-19, -36, 38, 40);
    art.lineStyle(2, 0xf4b860, 1); art.strokeRect(-19, -36, 38, 40);
    art.fillStyle(0x5b3c24, 1); art.fillRect(-13, -29, 26, 19);
    art.fillStyle(0xf4b860, 1); art.fillRect(-9, -24, 18, 3); art.fillRect(-9, -18, 18, 3);
    art.fillStyle(0xf4b860, 1); art.fillCircle(0, -4, 4);
    this.cameras.main.flash(90, 244, 184, 96);
    this.say(index === 0 ? "BELT A CALIBRATED. LEFTWARD FLOW LOCKED." : "SORTER B CALIBRATED. ARCHIVE C ROUTE LOCKED.");
    this.updateObjective();
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
      targets: this.door, scaleX: 0.08, alpha: 0.15, duration: 900, ease: "Cubic.inOut",
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
    this.cameras.main.shake(260, 0.009);
    // Security capture: the pumpkin gets flash-scanned, knocked back, then fades into a shadow stamp.
    const flash = this.add.rectangle(this.player.x, this.player.y, 78, 78, 0xff5369, 0.55).setDepth(18);
    const stamp = this.add.graphics().setDepth(19);
    stamp.fillStyle(0x090711, 0.9); stamp.fillEllipse(this.player.x, this.player.y + 12, 48, 16);
    stamp.lineStyle(2, 0xc5a8ff, 0.9); stamp.strokeEllipse(this.player.x, this.player.y + 12, 48, 16);
    this.tweens.add({
      targets: this.player, y: this.player.y - 20, angle: this.player.x < WORLD / 2 ? -18 : 18,
      scaleX: 0.18, scaleY: 1.25, alpha: 0.12, duration: 420, ease: "Cubic.out"
    });
    this.tweens.add({
      targets: flash, alpha: 0, scale: 2.6, duration: 360,
      onComplete: () => flash.destroy()
    });
    this.tweens.add({
      targets: stamp, alpha: 0, duration: 650, delay: 120,
      onComplete: () => stamp.destroy()
    });
    this.time.delayedCall(300, () => {
      const overlay: Phaser.GameObjects.GameObject[] = [];
      const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x07060c, 0.94).setScrollFactor(0).setDepth(50);
      overlay.push(shade);

      // Hard-edged arcade pixel panel with a tiny pixel pumpkin mascot.
      const panel = this.add.graphics().setScrollFactor(0).setDepth(51);
      panel.fillStyle(0x100d18,1); panel.fillRect(144,76,672,448);
      panel.fillStyle(0x59405f,1); panel.fillRect(144,76,672,4); panel.fillRect(144,520,672,4); panel.fillRect(144,76,4,448); panel.fillRect(812,76,4,448);
      panel.fillStyle(0xff5369,1); panel.fillRect(164,76,112,4); panel.fillRect(684,76,112,4);
      panel.fillStyle(0x211524,1); panel.fillRect(148,84,664,38);
      panel.fillStyle(0x35243d,1); panel.fillRect(164,132,632,2);
      overlay.push(panel);

      const topLabel=this.add.text(168,96,"D.L.S. // PERSONNEL SYSTEM",{fontFamily:"monospace",fontSize:"10px",color:"#c5a8ff"}).setScrollFactor(0).setDepth(52);
      const incident=this.add.text(792,96,"ERR_03",{fontFamily:"monospace",fontSize:"10px",color:"#ff6b72"}).setOrigin(1,0).setScrollFactor(0).setDepth(52);
      overlay.push(topLabel,incident);

      const mascot=this.add.graphics().setScrollFactor(0).setDepth(52);
      mascot.fillStyle(0x030208,1); mascot.fillRect(445,145,70,6); mascot.fillRect(435,151,90,6); mascot.fillRect(429,157,102,12); mascot.fillRect(435,169,90,12); mascot.fillRect(445,181,70,6);
      mascot.fillStyle(0xff7a2f,1); mascot.fillRect(459,151,42,6); mascot.fillRect(447,157,66,12); mascot.fillRect(453,169,54,12); mascot.fillRect(465,181,30,6);
      mascot.fillStyle(0x759447,1); mascot.fillRect(477,139,12,12);
      mascot.fillStyle(0x100d18,1); mascot.fillRect(459,163,12,6); mascot.fillRect(489,163,12,6); mascot.fillRect(471,175,18,6);
      mascot.fillStyle(0xff5369,1); mascot.fillRect(477,193,6,6); mascot.fillRect(465,199,30,6); mascot.fillRect(453,205,54,6); mascot.fillRect(447,211,66,6);
      overlay.push(mascot);

      const title=this.add.text(W/2,246,"SHIFT FAILED",{fontFamily:"monospace",fontSize:"30px",color:"#fff0ee",fontStyle:"bold",align:"center",letterSpacing:2}).setOrigin(0.5).setScrollFactor(0).setDepth(52);
      const status=this.add.text(W/2,282,"EMPLOYEE RECORD: VOIDED",{fontFamily:"monospace",fontSize:"10px",color:"#f4b860",align:"center"}).setOrigin(0.5).setScrollFactor(0).setDepth(52);
      overlay.push(title,status);

      const plate=this.add.graphics().setScrollFactor(0).setDepth(52);
      plate.fillStyle(0x211524,1); plate.fillRect(184,310,592,48); plate.fillStyle(0xff5369,1); plate.fillRect(184,310,4,48);
      overlay.push(plate);
      const sub=this.add.text(W/2,334,message,{fontFamily:"monospace",fontSize:"10px",color:"#e8d9f8",align:"center",wordWrap:{width:540},lineSpacing:3}).setOrigin(0.5).setScrollFactor(0).setDepth(53);
      overlay.push(sub);

      const divider=this.add.graphics().setScrollFactor(0).setDepth(52);
      divider.fillStyle(0x59405f,1); divider.fillRect(208,382,544,2); divider.fillStyle(0xc5a8ff,1); divider.fillRect(208,382,48,2);
      overlay.push(divider);
      const hintBg=this.add.graphics().setScrollFactor(0).setDepth(52);
      hintBg.fillStyle(0x2b202b,1); hintBg.fillRect(280,404,400,36); hintBg.fillStyle(0xf4b860,1); hintBg.fillRect(280,404,4,36); hintBg.fillRect(676,404,4,36);
      overlay.push(hintBg);
      const hint=this.add.text(W/2,422,"[ R ]  TRY AGAIN",{fontFamily:"monospace",fontSize:"13px",color:"#f4b860",fontStyle:"bold",letterSpacing:2}).setOrigin(0.5).setScrollFactor(0).setDepth(53);
      overlay.push(hint);
      this.tweens.add({targets:hint,alpha:{from:1,to:0.5},duration:450,yoyo:true,repeat:-1});
      const footer=this.add.text(W/2,475,"FORM 404-B   /   APPEAL WINDOW: NEVER",{fontFamily:"monospace",fontSize:"9px",color:"#75677e"}).setOrigin(0.5).setScrollFactor(0).setDepth(52);
      overlay.push(footer);

      this.data.set("failureOverlay", overlay);
    });
  }

  private respawnAtCheckpoint(): void {
    const overlay = this.data.get("failureOverlay") as Phaser.GameObjects.GameObject[] | undefined;
    overlay?.forEach(item => item.destroy());
    this.data.remove("failureOverlay");
    this.failureCall?.remove(false);
    this.failureCall = undefined;
    this.dead = false;
    this.tweens.killTweensOf(this.player);
    this.player.setAlpha(1).setScale(1, 1).setAngle(0);
    this.player.setPosition(this.checkpointX, FLOOR - 17);
    this.playerVx = 0; this.playerVy = 0; this.grounded = false;
    this.cameras.main.centerOn(this.checkpointX, H / 2);
    this.say(this.checkpointX > 110 ? "CHECKPOINT RESTORED. PLEASE FILE FORM 12-C FOR YOUR OWN RESCUE." : "REASSIGNED TO ENTRY. TRY NOT TO GET SCANNED.");
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
