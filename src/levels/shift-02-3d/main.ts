import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import "./style.css";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Shift 02 3D page is missing required UI element: ${selector}`);
  }
  return element;
}

const root = requireElement<HTMLDivElement>("#game-view");
const intro = requireElement<HTMLElement>("#intro");
const startButton = requireElement<HTMLButtonElement>("#start-button");
const hud = requireElement<HTMLElement>("#hud");
const interaction = requireElement<HTMLElement>("#interaction");
const objectiveTitle = requireElement<HTMLElement>("#objective-title");
const objectiveCopy = requireElement<HTMLElement>("#objective-copy");
const sequenceTrack = requireElement<HTMLElement>("#sequence-track");
const sequenceLabel = requireElement<HTMLElement>(".sequence-label");
let memorySealTimer = 0;
let activePreviewWindow = -1;
const relayProgress = requireElement<HTMLElement>("#relay-progress");
const toast = requireElement<HTMLElement>("#toast");
const endScreen = requireElement<HTMLElement>("#end-screen");
const replayButton = requireElement<HTMLButtonElement>("#replay-button");
const transitScreen = requireElement<HTMLElement>("#transit-screen");
const transitStatus = requireElement<HTMLElement>("#transit-status");

type Relay = { group: THREE.Group; kind: "triangle" | "circle" | "diamond"; active: boolean; position: THREE.Vector3 };
const scene = new THREE.Scene();
scene.background = new THREE.Color("#100d1b");
scene.fog = new THREE.FogExp2("#100d1b", 0.023);
const camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.1, 180);
camera.position.set(0, 1.72, 8);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
root.appendChild(renderer.domElement);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.48,
  0.58,
  0.82
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

scene.add(new THREE.HemisphereLight("#b8a6df", "#201426", 1.4));
const moonLight = new THREE.DirectionalLight("#c8b5ff", 2.1);
moonLight.position.set(-7, 12, 3);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
scene.add(moonLight);
moonLight.shadow.camera.left = -12;
moonLight.shadow.camera.right = 12;
moonLight.shadow.camera.top = 9;
moonLight.shadow.camera.bottom = -9;
moonLight.shadow.bias = -0.00025;
moonLight.shadow.normalBias = 0.025;
const amberLight = new THREE.PointLight("#e59a55", 24, 18, 2);
amberLight.position.set(0, 3.4, -7);
scene.add(amberLight);
const fillLight = new THREE.PointLight("#7965cb", 18, 22, 1.7);
fillLight.position.set(5.5, 3.1, -13);
scene.add(fillLight);
const practicalLights: THREE.PointLight[] = [];
for (const z of [8, 1, -6, -13, -20]) {
  const lamp = new THREE.PointLight("#e7a76c", 10, 8, 1.8);
  lamp.position.set(0, 4.25, z);
  scene.add(lamp);
  practicalLights.push(lamp);
}
const foundryPalette = {
  amber: new THREE.Color("#e59a55"),
  amberPowered: new THREE.Color("#83ffd0"),
  violet: new THREE.Color("#7965cb"),
  violetPowered: new THREE.Color("#5fc8a8"),
  practical: new THREE.Color("#e7a76c"),
  practicalPowered: new THREE.Color("#8fffd0")
};

const materials = {
  floor: new THREE.MeshStandardMaterial({ color: "#252333", roughness: 0.34, metalness: 0.42 }),
  wall: new THREE.MeshStandardMaterial({ color: "#343143", roughness: 0.58, metalness: 0.62 }),
  dark: new THREE.MeshStandardMaterial({ color: "#14131f", roughness: 0.5, metalness: 0.72 }),
  copper: new THREE.MeshStandardMaterial({ color: "#a96543", roughness: 0.32, metalness: 0.78 }),
  glow: new THREE.MeshStandardMaterial({ color: "#ffd4a0", emissive: "#e7793d", emissiveIntensity: 3.2, roughness: 0.22 }),
  violet: new THREE.MeshStandardMaterial({ color: "#8c7bc4", emissive: "#5541a0", emissiveIntensity: 1.15, roughness: 0.28 }),
  glass: new THREE.MeshPhysicalMaterial({ color: "#1d2344", emissive: "#282a65", emissiveIntensity: 1.05, metalness: 0.72, roughness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
  rubber: new THREE.MeshStandardMaterial({ color: "#0a0b12", roughness: 0.94, metalness: 0.04 }),
  ceramic: new THREE.MeshStandardMaterial({ color: "#55536a", roughness: 0.27, metalness: 0.58 }),
  warning: new THREE.MeshStandardMaterial({ color: "#ffb35e", emissive: "#c95a22", emissiveIntensity: 1.7, roughness: 0.35 })
};

function box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, cast = true): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function lightStrip(x: number, y: number, z: number, w: number, d = 0.08): void {
  box(scene, x, y, z, w, 0.035, d, materials.glow, false);
}
function makeRelay(kind: Relay["kind"], x: number, z: number): Relay {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  scene.add(group);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 0.16, 16), materials.rubber);
  base.position.y = 0.1;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.55, 0.54, 16), materials.ceramic);
  plinth.position.y = 0.43;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.045, 8, 32), materials.copper);
  collar.position.y = 0.68;
  group.add(collar);

  const consoleTop = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.48, 0.14, 16), materials.dark);
  consoleTop.position.y = 0.75;
  consoleTop.castShadow = true;
  group.add(consoleTop);
  const screen = new THREE.Mesh(new THREE.CircleGeometry(0.37, 32), materials.glass);
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = 0.83;
  group.add(screen);

  // Small indicator studs make the console read as a designed prop, not a block.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), i % 2 ? materials.violet : materials.glow);
    stud.position.set(Math.cos(a) * 0.43, 0.86, Math.sin(a) * 0.43);
    group.add(stud);
  }

  let symbol: THREE.Mesh;
  if (kind === "circle") {
    symbol = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.065, 12, 40), materials.glow);
  } else if (kind === "triangle") {
    symbol = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.52, 3, 1), materials.glow);
    symbol.rotation.y = Math.PI;
  } else {
    symbol = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), materials.glow);
    symbol.scale.set(0.78, 1.2, 0.78);
  }
  symbol.name = "relay-symbol";
  symbol.position.y = 1.4;
  symbol.castShadow = true;
  group.add(symbol);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.022, 8, 48), materials.violet);
  halo.name = "relay-halo";
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 1.12;
  group.add(halo);
  const pin = new THREE.PointLight("#df945b", 2.8, 4, 1.8);
  pin.position.set(0, 1.5, 0);
  group.add(pin);

  const lowerRing = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.022, 6, 32), materials.glow);
  lowerRing.position.y = 0.25;
  group.add(lowerRing);
  return { group, kind, active: false, position: new THREE.Vector3(x, 0, z) };
}
const exitDoorLeaves: THREE.Group[] = [];
const exitDoorLocks: THREE.Object3D[] = [];
let exitDoorCore: THREE.Group | undefined;
let exitOpeningStartedAt: number | null = null;
let exitOpeningProgress = 0;

// A luminous signal packet travels between machinery nodes after each valid beat.
const transferMaterial = new THREE.MeshBasicMaterial({ color: "#a6ffe0", toneMapped: false });
const transferOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), transferMaterial);
transferOrb.visible = false;
scene.add(transferOrb);
const transferLight = new THREE.PointLight("#78ffd0", 0, 7, 1.8);
scene.add(transferLight);
const transferFrom = new THREE.Vector3();
const transferTo = new THREE.Vector3();
let transferStartedAt: number | null = null;
let transferDuration = 0.72;
let foundryPowerBlend = 0;

function startSignalTransfer(from: Relay, nextBeat: number): void {
  transferFrom.copy(from.position).add(new THREE.Vector3(0, 1.42, 0));
  if (nextBeat < sequence.length) {
    const candidates = relays.filter((item) => item.kind === sequence[nextBeat]);
    const target = candidates.reduce<Relay | null>((best, item) => {
      if (!best) return item;
      return item.position.distanceTo(from.position) < best.position.distanceTo(from.position) ? item : best;
    }, null);
    if (target) transferTo.copy(target.position).add(new THREE.Vector3(0, 1.42, 0));
    else transferTo.set(5.05, 2.2, -18.2);
  } else {
    transferTo.set(5.05, 2.2, -18.2);
  }
  transferStartedAt = clock.elapsedTime;
  transferDuration = nextBeat >= sequence.length - 1 ? 1.12 : 0.72;
  transferOrb.visible = true;
  transferOrb.position.copy(transferFrom);
  transferLight.position.copy(transferFrom);
  transferLight.intensity = 18;
}

function buildEnvironment(): void {
  // Continuous floor with a procedural brushed-metal / panel texture.
  const floorCanvas = document.createElement("canvas");
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const ctx = floorCanvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#242231";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1700; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = i % 4 === 0 ? "rgba(201,151,109,.12)" : "rgba(210,211,235,.035)";
      ctx.fillRect(x, y, 2 + Math.random() * 20, 1);
    }
    ctx.strokeStyle = "rgba(160,147,184,.15)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(512, i * 64); ctx.stroke();
    }
  }
  const floorTexture = new THREE.CanvasTexture(floorCanvas);
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(2.5, 7);
  floorTexture.colorSpace = THREE.SRGBColorSpace;
  const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture, color: "#b8b4c7", roughness: 0.28, metalness: 0.62 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(15.7, 40), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.015, -5);
  floor.receiveShadow = true;
  scene.add(floor);

  // Side walls are layered panel systems, not monolithic corridor cubes.
  for (const side of [-1, 1]) {
    for (let panelIndex = 0, z = 13; z >= -23; z -= 3, panelIndex++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.55, 2.72), materials.wall);
      panel.position.set(side * 7.82, 2.38, z);
      panel.rotation.y = side * -0.035;
      panel.castShadow = true;
      panel.receiveShadow = true;
      scene.add(panel);
      const inset = new THREE.Mesh(new THREE.BoxGeometry(0.035, 2.45, 1.72), materials.dark);
      inset.position.set(side * 7.69, 2.45, z);
      scene.add(inset);
      const insetGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.055, 1.2),
        panelIndex % 4 === 2 ? materials.violet : materials.glow
      );
      insetGlow.position.set(side * 7.66, 3.72, z);
      scene.add(insetGlow);

      // Periodic recessed service grilles break up the corridor's repeated wall
      // rhythm and imply real ventilation / maintenance infrastructure.
      if (panelIndex % 3 === 1) {
        const ventPlate = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.52, 0.92), materials.dark);
        ventPlate.position.set(side * 7.61, 1.8, z - 0.22);
        scene.add(ventPlate);
        for (let slat = 0; slat < 5; slat++) {
          const ventSlat = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.72), materials.ceramic);
          ventSlat.position.set(side * 7.57, 1.62 + slat * 0.09, z - 0.22);
          scene.add(ventSlat);
        }
      }
      const footing = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.65, 12), materials.ceramic);
      footing.rotation.x = Math.PI / 2;
      footing.position.set(side * 7.43, 0.24, z);
      footing.castShadow = true;
      scene.add(footing);
    }
    // Main service conduits and copper coolant lines.
    for (let i = 0; i < 4; i++) {
      const x = side * (6.75 + i * 0.19);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(i === 0 ? 0.105 : 0.045, i === 0 ? 0.105 : 0.045, 37, 12), i === 1 ? materials.copper : materials.dark);
      pipe.position.set(x, 4.1 - i * 0.2, -5);
      pipe.castShadow = true;
      scene.add(pipe);
      for (const z of [10, 2, -6, -14, -22]) {
        const clamp = new THREE.Mesh(new THREE.TorusGeometry(i === 0 ? 0.13 : 0.07, 0.025, 6, 16), materials.copper);
        clamp.rotation.x = Math.PI / 2;
        clamp.position.set(x, 4.1 - i * 0.2, z);
        scene.add(clamp);
      }
    }
  }

  // Repeating ceiling trusses have a curved silhouette and warm recessed strips.
  for (let z = 12; z >= -22; z -= 4) {
    const crossBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 15.1, 12), materials.dark);
    crossBeam.rotation.z = Math.PI / 2;
    crossBeam.position.set(0, 4.92, z);
    crossBeam.castShadow = true;
    scene.add(crossBeam);
    for (const x of [-6.3, -3.15, 0, 3.15, 6.3]) {
      const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.52, 10), materials.copper);
      mount.position.set(x, 4.65, z);
      mount.castShadow = true;
      scene.add(mount);
    }
    const lampHousing = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 4.7, 4, 12), materials.dark);
    lampHousing.rotation.z = Math.PI / 2;
    lampHousing.position.set(0, 4.55, z);
    scene.add(lampHousing);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.025, 0.1), materials.glow);
    lamp.position.set(0, 4.45, z);
    scene.add(lamp);
  }

  // Window and distant planet: layered frame, glass, and floating debris.
  const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(9.2, 5.0, 0.45), materials.dark);
  windowFrame.position.set(0, 3.1, -23.2);
  windowFrame.castShadow = true;
  scene.add(windowFrame);
  const windowGlass = new THREE.Mesh(new THREE.PlaneGeometry(8.1, 3.9), materials.glass);
  windowGlass.position.set(0, 3.15, -22.94);
  scene.add(windowGlass);
  for (const x of [-4.05, -2.7, -1.35, 0, 1.35, 2.7, 4.05]) {
    const mullion = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.9, 8), materials.copper);
    mullion.position.set(x, 3.15, -22.88);
    scene.add(mullion);
  }
  const planetMaterial = new THREE.MeshStandardMaterial({ color: "#a58bc2", emissive: "#4d356c", emissiveIntensity: 0.7, roughness: 0.86, metalness: 0.06 });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(2.25, 48, 32), planetMaterial);
  planet.name = "distant-planet";
  planet.position.set(-1.8, 3.4, -24.4);
  scene.add(planet);
  const planetRim = new THREE.Mesh(new THREE.TorusGeometry(2.36, 0.025, 8, 80), materials.violet);
  planetRim.name = "planet-rim";
  planetRim.position.copy(planet.position);
  planetRim.rotation.set(0.6, 0.2, 0.1);
  scene.add(planetRim);
  const planetLight = new THREE.PointLight("#9b7ac9", 20, 20, 1.8);
  planetLight.position.set(-2, 4, -20);
  scene.add(planetLight);
  for (let i = 0; i < 70; i++) {
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.025 + (i % 3) * 0.008, 6, 6), new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? "#e3b58d" : "#a7a0d8" }));
    star.position.set(-6.5 + ((i * 37) % 130) / 10, 1.2 + ((i * 19) % 30) / 10, -24.6);
    scene.add(star);
  }

  // Signature iris bulkhead: layered octagonal frame, segmented armor petals,
  // a recessed reactor core, and radial lock hardware. This is a proper landmark,
  // not a flat slab with bars painted over it.
  const gateAssembly = new THREE.Group();
  gateAssembly.name = "exit-bulkhead";
  gateAssembly.position.set(5.05, 0, -18.2);
  scene.add(gateAssembly);

  const outerFrame = new THREE.Mesh(new THREE.BoxGeometry(4.25, 4.62, 0.5), materials.dark);
  outerFrame.position.set(0, 2.25, 0);
  outerFrame.castShadow = true;
  outerFrame.receiveShadow = true;
  gateAssembly.add(outerFrame);

  const innerFrame = new THREE.Mesh(new THREE.BoxGeometry(3.82, 4.18, 0.34), materials.copper);
  innerFrame.position.set(0, 2.22, 0.31);
  innerFrame.castShadow = true;
  gateAssembly.add(innerFrame);

  const recessedSocket = new THREE.Mesh(
    new THREE.BoxGeometry(3.56, 3.9, 0.22),
    new THREE.MeshStandardMaterial({ color: "#090d19", metalness: 0.82, roughness: 0.26 })
  );
  recessedSocket.position.set(0, 2.2, 0.51);
  gateAssembly.add(recessedSocket);

  const armor = new THREE.MeshStandardMaterial({
    color: "#35374a", metalness: 0.88, roughness: 0.24,
    emissive: "#21152d", emissiveIntensity: 0.45
  });
  const armorEdge = new THREE.MeshStandardMaterial({
    color: "#a56b4d", metalness: 0.82, roughness: 0.3,
    emissive: "#512817", emissiveIntensity: 0.55
  });
  const coreGlow = new THREE.MeshStandardMaterial({
    color: "#ffc58c", emissive: "#ff6a35", emissiveIntensity: 2.8,
    metalness: 0.22, roughness: 0.2
  });

  // Each armored leaf is its own pivot group so the panels can split apart under power.
  for (let i = 0; i < 6; i++) {
    const x = -1.28 + i * 0.512;
    const leafGroup = new THREE.Group();
    leafGroup.position.set(x, 0, 0);
    leafGroup.name = `exit-door-leaf-${i}`;
    gateAssembly.add(leafGroup);
    exitDoorLeaves.push(leafGroup);

    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.47, 3.26, 0.16), armor);
    leaf.position.set(0, 2.17, 0.68);
    leaf.rotation.z = (i - 2.5) * 0.018;
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    leafGroup.add(leaf);

    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.035, 2.92, 0.045), armorEdge);
    spine.position.set(0, 2.17, 0.78);
    leafGroup.add(spine);

    for (const y of [0.78, 3.55]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 8), materials.ceramic);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(0, y, 0.79);
      leafGroup.add(bolt);
    }
  }

  // The reactor core is mounted on a separate carriage; it retracts before the
  // armor leaves move, so the opening feels like a powered mechanism rather than a teleport.
  exitDoorCore = new THREE.Group();
  exitDoorCore.name = "exit-door-core";
  gateAssembly.add(exitDoorCore);
  const coreHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 0.2, 12), materials.dark);
  coreHousing.rotation.x = Math.PI / 2;
  coreHousing.position.set(0, 2.2, 0.9);
  coreHousing.castShadow = true;
  exitDoorCore.add(coreHousing);
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.61, 0.055, 10, 48), materials.violet);
  coreRing.position.set(0, 2.2, 1.03);
  coreRing.name = "exit-core-ring";
  exitDoorCore.add(coreRing);
  const coreLens = new THREE.Mesh(new THREE.CircleGeometry(0.48, 12), coreGlow);
  coreLens.position.set(0, 2.2, 1.04);
  coreLens.name = "exit-core-lens";
  exitDoorCore.add(coreLens);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const lockGroup = new THREE.Group();
    lockGroup.position.set(Math.cos(angle) * 0.96, 2.2 + Math.sin(angle) * 0.96, 0.91);
    lockGroup.rotation.z = -angle;
    lockGroup.name = `exit-lock-${i}`;
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), armorEdge);
    lockGroup.add(lock);
    exitDoorCore.add(lockGroup);
    exitDoorLocks.push(lockGroup);
  }

  // Heavy horizontal clamps and a top-mounted access rail make the frame feel engineered.
  for (const y of [0.22, 4.2]) {
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.18, 0.32), materials.dark);
    clamp.position.set(0, y, 0.52);
    clamp.castShadow = true;
    gateAssembly.add(clamp);
    for (const x of [-1.75, 1.75]) {
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.2), coreGlow);
      latch.position.set(x, y, 0.72);
      gateAssembly.add(latch);
    }
  }


  // Side console banks and the inset equipment have softened, layered profiles.
  for (const side of [-1, 1]) {
    const consoleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.08, 1.18, 12), materials.dark);
    consoleBase.scale.z = 0.72;
    consoleBase.position.set(side * 5.35, 0.62, -15.8);
    consoleBase.castShadow = true;
    scene.add(consoleBase);
    const consoleTop = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.12, 12), materials.copper);
    consoleTop.scale.z = 0.74;
    consoleTop.position.set(side * 5.35, 1.27, -15.8);
    scene.add(consoleTop);
    for (let i = 0; i < 5; i++) {
      const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), i % 2 ? materials.violet : materials.glow);
      indicator.position.set(side * 5.35 - 0.7 + i * 0.35, 1.37, -15.8);
      scene.add(indicator);
    }
  }
}
buildEnvironment();

// Purposeful set dressing: live telemetry displays and slow ceiling rotors give
// the foundry scale, motion, and evidence of an automated facility at work.
const maintenanceFans: THREE.Group[] = [];
function buildMaintenanceSetDressing(): void {
  const screenPalette = ["#8fffd0", "#d9a7ff", "#ffc58c", "#8bd9ff"];
  for (const side of [-1, 1]) {
    for (const [index, z] of [8, 1, -9, -15].entries()) {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.02, 1.55), materials.dark);
      housing.position.set(side * 7.38, 2.82, z);
      housing.castShadow = true;
      scene.add(housing);

      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      const accent = screenPalette[(index + (side === 1 ? 0 : 1)) % screenPalette.length];
      if (context) {
        context.fillStyle = "#08111b";
        context.fillRect(0, 0, 512, 256);
        context.fillStyle = accent;
        context.globalAlpha = 0.9;
        context.fillRect(22, 22, 72, 5);
        context.font = "bold 24px monospace";
        context.fillText(["CORE TEMP", "PRESSURE", "OXYGEN", "RELAY BUS"][(index + (side === 1 ? 0 : 2)) % 4], 22, 58);
        context.globalAlpha = 0.48;
        for (let row = 0; row < 4; row++) {
          context.fillStyle = accent;
          context.fillRect(22, 82 + row * 31, 145 + ((index * 53 + row * 37) % 210), 7);
          context.fillStyle = "#334052";
          context.fillRect(190, 82 + row * 31, 285, 7);
        }
        context.globalAlpha = 0.95;
        context.strokeStyle = accent;
        context.lineWidth = 3;
        context.beginPath();
        for (let x = 0; x < 430; x += 10) {
          const y = 204 + Math.sin((x + index * 31 + side * 13) * 0.035) * 18 + Math.sin(x * 0.12) * 5;
          if (x === 0) context.moveTo(22 + x, y);
          else context.lineTo(22 + x, y);
        }
        context.stroke();
        context.globalAlpha = 1;
        context.fillStyle = "#e9f6ff";
        context.font = "18px monospace";
        context.fillText("SYS // " + String(index + 14).padStart(2, "0") + "  ONLINE", 22, 242);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const displayMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
      const display = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.59), displayMaterial);
      display.position.set(side * 7.285, 2.82, z);
      display.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(display);

      for (let i = 0; i < 3; i++) {
        const status = new THREE.Mesh(
          new THREE.SphereGeometry(0.035, 8, 8),
          new THREE.MeshBasicMaterial({ color: i === 0 ? accent : i === 1 ? "#ffbf78" : "#4c6178" })
        );
        status.position.set(side * 7.27, 2.28, z - 0.3 + i * 0.3);
        scene.add(status);
      }
    }
  }

  for (const z of [7, -2, -11, -20]) {
    const fan = new THREE.Group();
    fan.name = "maintenance-fan";
    fan.position.set(0, 4.12, z);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.065, 8, 28), materials.copper);
    rim.rotation.x = Math.PI / 2;
    fan.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.18, 12), materials.dark);
    hub.position.y = 0.06;
    fan.add(hub);
    const hubLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 10),
      new THREE.MeshBasicMaterial({ color: "#ffc58c" })
    );
    hubLight.position.y = 0.17;
    fan.add(hubLight);
    for (let bladeIndex = 0; bladeIndex < 4; bladeIndex++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.055, 0.96), materials.ceramic);
      blade.position.y = 0.035;
      blade.rotation.y = bladeIndex * Math.PI / 2;
      blade.position.x = Math.sin(blade.rotation.y) * 0.22;
      blade.position.z = Math.cos(blade.rotation.y) * 0.22;
      fan.add(blade);
    }
    scene.add(fan);
    maintenanceFans.push(fan);
  }
}
buildMaintenanceSetDressing();

// A readable exit landmark: a high-contrast EXIT sign, illuminated door jambs,
// and floor chevrons create a clear visual route to the bulkhead from the relay room.
const exitMint = new THREE.MeshStandardMaterial({
  color: "#baffd9",
  emissive: "#39ffad",
  emissiveIntensity: 3.2,
  roughness: 0.24
});
const exitDark = new THREE.MeshStandardMaterial({
  color: "#102b25",
  emissive: "#06271c",
  emissiveIntensity: 0.7,
  metalness: 0.42,
  roughness: 0.32
});
const exitSign = new THREE.Group();
exitSign.name = "exit-sign";
exitSign.position.set(5.05, 4.55, -17.55);
scene.add(exitSign);
const signBack = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.82, 0.16), materials.dark);
signBack.castShadow = true;
exitSign.add(signBack);
const signFace = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 0.61), exitDark);
signFace.position.z = 0.09;
exitSign.add(signFace);
const signCanvas = document.createElement("canvas");
signCanvas.width = 512;
signCanvas.height = 128;
const signContext = signCanvas.getContext("2d");
if (signContext) {
  signContext.fillStyle = "#09251b";
  signContext.fillRect(0, 0, 512, 128);
  signContext.strokeStyle = "#65ffc0";
  signContext.lineWidth = 7;
  signContext.strokeRect(8, 8, 496, 112);
  signContext.fillStyle = "#baffd9";
  signContext.font = "bold 82px Arial, sans-serif";
  signContext.textAlign = "center";
  signContext.textBaseline = "middle";
  signContext.fillText("EXIT  →", 256, 66);
}
const signTexture = new THREE.CanvasTexture(signCanvas);
signTexture.colorSpace = THREE.SRGBColorSpace;
const signText = new THREE.Mesh(
  new THREE.PlaneGeometry(2.33, 0.6),
  new THREE.MeshBasicMaterial({ map: signTexture, transparent: false, toneMapped: false })
);
signText.position.z = 0.105;
signText.name = "exit-sign-glow";
exitSign.add(signText);
for (const x of [-1.16, 1.16]) {
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.68, 0.035), exitMint);
  border.position.set(x, 0, 0.12);
  exitSign.add(border);
}
const exitSignLight = new THREE.PointLight("#45ffb0", 7, 10, 1.8);
exitSignLight.position.set(5.05, 4.55, -16.8);
scene.add(exitSignLight);

// Tall luminous jambs outline the actual opening, so the exit reads as a doorway.
for (const x of [3.28, 6.82]) {
  const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.09, 4.25, 0.1), exitMint);
  jamb.position.set(x, 2.12, -17.52);
  jamb.name = "exit-jamb";
  scene.add(jamb);
}
const exitThreshold = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.045, 0.42), exitMint);
exitThreshold.position.set(5.05, 0.045, -17.2);
exitThreshold.name = "exit-threshold";
scene.add(exitThreshold);

// Repeating floor arrows point deeper into the foundry toward the exit.
const exitArrowMaterial = new THREE.MeshBasicMaterial({
  color: "#6dffc0",
  transparent: true,
  opacity: 0.82,
  toneMapped: false,
  side: THREE.DoubleSide
});
for (const z of [-12.2, -14.3, -16.2]) {
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(-0.38, -0.28);
  arrowShape.lineTo(0.38, -0.28);
  arrowShape.lineTo(0.38, 0.02);
  arrowShape.lineTo(0.72, 0.02);
  arrowShape.lineTo(0, 0.72);
  arrowShape.lineTo(-0.72, 0.02);
  arrowShape.lineTo(-0.38, 0.02);
  arrowShape.closePath();
  const arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape), exitArrowMaterial);
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(2.0 + ((-z - 12.2) * 0.75), 0.055, z);
  arrow.name = "exit-floor-arrow";
  scene.add(arrow);
}

 // Asset-led set dressing: these are real CC0 glTF meshes, loaded as optional
// scene assets. The authored environment below keeps the level playable if a CDN
// is unavailable, but the models are not replaced by UI tricks or flat images.
const gltfLoader = new GLTFLoader();
const importedProps: THREE.Object3D[] = [];
const kenneyAssetBase = "https://raw.githubusercontent.com/euuuuuuan/voidclad-public/main/assets/vendor/kenney_space_kit/";
function fitModel(model: THREE.Object3D, targetHeight: number): void {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;
  model.scale.multiplyScalar(targetHeight / maxDimension);
  const fitted = new THREE.Box3().setFromObject(model);
  model.position.y -= fitted.min.y;
  model.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach((mat) => {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.envMapIntensity = 1.15;
          mat.needsUpdate = true;
        }
      });
    }
  });
}
function loadAsset(file: string, placements: Array<[number, number, number, number]>): void {
  gltfLoader.load(
    kenneyAssetBase + file,
    (gltf) => {
      const source = gltf.scene;
      fitModel(source, 2.25);
      for (const [x, z, height, rotation] of placements) {
        const instance = source.clone(true);
        instance.position.set(x, height + source.position.y, z);
        instance.rotation.y = rotation;
        scene.add(instance);
        importedProps.push(instance);
      }
    },
    undefined,
    () => console.warn("Optional CC0 model unavailable:", file)
  );
}
// Satellite-dish props intentionally omitted: they looked like random antennas and
// crowded the room without supporting the relay puzzle.

// Kenney Factory Kit assets add recognizable machinery silhouettes and authored
// PBR mesh detail along the route. All of these models are CC0.
const factoryAssetBase = "https://raw.githubusercontent.com/shorepine/kenney/main/3d/factory/";
function loadFactoryAsset(file: string, placements: Array<[number, number, number, number]>): void {
  gltfLoader.load(
    factoryAssetBase + file,
    (gltf) => {
      const source = gltf.scene;
      fitModel(source, 2.4);
      for (const [x, z, height, rotation] of placements) {
        const instance = source.clone(true);
        instance.position.set(x, height + source.position.y, z);
        instance.rotation.y = rotation;
        scene.add(instance);
        importedProps.push(instance);
      }
    },
    undefined,
    () => console.warn("Optional CC0 factory model unavailable:", file)
  );
}
// Keep just two far-end machinery silhouettes; omit cranes and extra window/pipe props.
loadFactoryAsset("machine.glb", [[-5.8, -15.3, 0.05, 0], [5.8, -15.3, 0.05, Math.PI]]);

// Additive architectural detail uses curved profiles, rings, cable runs and
// inset panels to break the original hard-edged block rhythm.
function tubeBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material, segments = 10): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), segments), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
function addSetDressing(): void {
  // Open sightlines: no repeated arches, hoops, reactor drums, floor bolts or
  // suspended pipe bundles. A pair of restrained edge cables keeps the room industrial.
  for (const side of [-1, 1]) {
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 30, 8),
      materials.dark
    );
    cable.position.set(side * 6.65, 3.72, -5);
    cable.castShadow = true;
    scene.add(cable);
  }
}
addSetDressing();
const relays: Relay[] = [makeRelay("triangle", -4.2, -6.8), makeRelay("circle", 0, -6.8), makeRelay("diamond", 4.2, -6.8)];
const sequence: Relay["kind"][] = ["triangle", "diamond", "circle", "diamond", "triangle", "circle", "diamond", "triangle"];
let nextRelay = 0;
let gateOpen = false;
let ended = false;
let started = false;
let yaw = 0;
let pitch = 0;
const keys = new Set<string>();
const clock = new THREE.Clock();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const move = new THREE.Vector3();
const rayOrigin = new THREE.Vector3();
const velocity = new THREE.Vector3();
const toastTimer = { id: 0 };
let audioContext: AudioContext | null = null;
let ambienceGain: GainNode | null = null;
const ambienceOscillators: OscillatorNode[] = [];
let footstepAccumulator = 0;
let previousGrounded = true;
function playSignalTone(startFrequency: number, endFrequency: number, duration: number, type: OscillatorType = "sine", volume = 0.075): void {
  try {
    const AudioContextType = window.AudioContext;
    if (!AudioContextType) return;
    audioContext ??= new AudioContextType();
    if (audioContext.state === "suspended") void audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.035, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  } catch {
    // Audio is optional; the level remains playable if browser audio is blocked.
  }
}

function playSfx(kind: "step" | "jump" | "land" | "denied" | "relay" | "lock" | "door" | "scan"): void {
  const presets: Record<typeof kind, [number, number, number, OscillatorType, number]> = {
    step: [105, 58, 0.075, "triangle", 0.022],
    jump: [180, 360, 0.18, "sine", 0.045],
    land: [92, 38, 0.13, "triangle", 0.055],
    denied: [155, 72, 0.24, "sawtooth", 0.045],
    relay: [510, 980, 0.19, "sine", 0.052],
    lock: [360, 125, 0.12, "square", 0.03],
    door: [95, 34, 0.72, "sawtooth", 0.065],
    scan: [880, 420, 0.14, "sine", 0.026]
  };
  const [start, end, duration, type, volume] = presets[kind];
  playSignalTone(start, end, duration, type, volume);
}

function startFoundryAmbience(): void {
  try {
    const AudioContextType = window.AudioContext;
    if (!AudioContextType) return;
    audioContext ??= new AudioContextType();
    if (audioContext.state === "suspended") void audioContext.resume();
    if (ambienceGain) return;
    ambienceGain = audioContext.createGain();
    ambienceGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    ambienceGain.gain.linearRampToValueAtTime(0.018, audioContext.currentTime + 1.8);
    ambienceGain.connect(audioContext.destination);
    for (const [frequency, type, volume] of [[48, "sine", 0.7], [72, "triangle", 0.22], [144, "sine", 0.08]] as const) {
      const oscillator = audioContext.createOscillator();
      const layerGain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      layerGain.gain.value = volume;
      oscillator.connect(layerGain);
      layerGain.connect(ambienceGain);
      oscillator.start();
      ambienceOscillators.push(oscillator);
    }
  } catch {
    // Browser audio may be unavailable; gameplay never depends on it.
  }
}

// Lightweight first-person character physics. The camera is the player's eye,
// while the horizontal body is approximated by a cylinder/capsule footprint.
const PLAYER_EYE_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.34;
const PLAYER_HEIGHT = 1.8;
const GRAVITY = 22;
const JUMP_SPEED = 8.2;
const WALK_ACCELERATION = 25;
const GROUND_FRICTION = 12;
let playerEyeY = PLAYER_EYE_HEIGHT;
let cameraBob = 0;
let sprintBlend = 0;
let verticalVelocity = 0;
let grounded = true;
let coyoteTime = 0.1;
type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };
const colliders: Collider[] = [
  // Structural walls and end bulkhead frame
  { minX: -8.35, maxX: -7.45, minZ: -25, maxZ: 15 },
  { minX: 7.45, maxX: 8.35, minZ: -25, maxZ: 15 },
  { minX: -8, maxX: 8, minZ: 12.9, maxZ: 13.8 },
  // The sealed bulkhead blocks the route until the relay sequence is solved.
  { minX: 3.25, maxX: 6.85, minZ: -18.45, maxZ: -17.65 },
  // Relay consoles
  { minX: -4.95, maxX: -3.45, minZ: -7.55, maxZ: -6.05 },
  { minX: -0.75, maxX: 0.75, minZ: -7.55, maxZ: -6.05 },
  { minX: 3.45, maxX: 4.95, minZ: -7.55, maxZ: -6.05 },
  // Side machinery and imported environmental props
  { minX: -6.7, maxX: -4.1, minZ: -16.7, maxZ: -14.9 },
  { minX: -6.9, maxX: -4.8, minZ: -5.0, maxZ: -3.0 },
  { minX: 4.8, maxX: 6.9, minZ: -5.0, maxZ: -3.0 },
  { minX: -6.9, maxX: -5.0, minZ: 4.0, maxZ: 6.2 },
  { minX: 5.0, maxX: 6.9, minZ: 4.0, maxZ: 6.2 },
  { minX: 4.1, maxX: 6.7, minZ: -16.7, maxZ: -14.9 },
  // Low floor-level equipment that the player must navigate around
  { minX: -3.95, maxX: -2.45, minZ: 7.4, maxZ: 8.6 },
  { minX: 2.45, maxX: 3.95, minZ: 5.9, maxZ: 7.1 },
  { minX: -3.95, maxX: -2.45, minZ: 1.9, maxZ: 3.1 },
  { minX: 2.45, maxX: 3.95, minZ: 0.4, maxZ: 1.6 },
  { minX: -3.95, maxX: -2.45, minZ: -3.6, maxZ: -2.4 },
  { minX: 2.45, maxX: 3.95, minZ: -5.1, maxZ: -3.9 }
];
const gateAssembly = scene.getObjectByName("exit-bulkhead") as THREE.Group | undefined;

function notify(message: string): void {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer.id);
  toastTimer.id = window.setTimeout(() => toast.classList.remove("visible"), 1900);
}
function updateObjective(): void {
  relayProgress.innerHTML = `SIGNAL <strong>${nextRelay} / ${sequence.length}</strong>`;
  sequenceLabel.innerHTML = `MEMORY LOCK <span>8 BEATS</span>`;
  const symbols: Record<Relay["kind"], string> = { triangle: "△", diamond: "◇", circle: "○" };
  const windowStart = Math.floor(nextRelay / 3) * 3;
  const windowEnd = Math.min(sequence.length, windowStart + 3);
  if (gateOpen) {
    window.clearTimeout(memorySealTimer);
    sequenceTrack.classList.remove("memory-sealed");
    activePreviewWindow = -1;
  } else if (windowStart !== activePreviewWindow || nextRelay === 0) {
    activePreviewWindow = windowStart;
    window.clearTimeout(memorySealTimer);
    sequenceTrack.classList.remove("memory-sealed");
    memorySealTimer = window.setTimeout(() => {
      if (!gateOpen && Math.floor(nextRelay / 3) * 3 === activePreviewWindow) {
        sequenceTrack.classList.add("memory-sealed");
      }
    }, 4200);
  }
  sequenceTrack.innerHTML = sequence.map((kind, index) => {
    const completed = index < nextRelay;
    const visible = index < windowEnd || completed || gateOpen;
    const state = completed ? "completed" : index === nextRelay && !gateOpen ? "current" : visible ? "revealed" : "encrypted";
    const accessible = kind === "triangle" ? "triangle" : kind === "diamond" ? "diamond" : "circle";
    const glyph = completed ? "✓" : visible ? symbols[kind] : "·";
    const aria = visible ? `Beat ${index + 1}: ${accessible}` : `Beat ${index + 1}: encrypted`;
    return `<span class="sequence-beat ${state}" aria-label="${aria}"><span class="beat-symbol">${glyph}</span><i>${String(index + 1).padStart(2, "0")}</i></span>`;
  }).join("");
  sequenceTrack.classList.toggle("sequence-complete", gateOpen);
  if (gateOpen) {
    objectiveTitle.textContent = "The exit is unlocked";
    objectiveCopy.textContent = "Head to the green EXIT gate in the back-right corner and press E at the bulkhead.";
  } else {
    objectiveTitle.textContent = nextRelay === 0 ? "Decode the maintenance rhythm" : nextRelay < sequence.length ? "Hold the pattern in memory" : "Signal accepted";
    objectiveCopy.textContent = "Memorize each three-symbol window, then enter it from memory. Later beats are encrypted. One wrong signal resets all eight beats.";
  }
}
function startGame(): void {
  started = true;
  startFoundryAmbience();
  playSfx("scan");
  intro.classList.add("dismissed");
  hud.classList.add("active");
  renderer.domElement.requestPointerLock?.();
}
startButton.addEventListener("click", startGame);
replayButton.addEventListener("click", () => window.location.reload());
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === renderer.domElement) {
    intro.classList.add("dismissed");
  } else if (started && !ended) {
    intro.classList.remove("dismissed");
    startButton.textContent = "RESUME SHIFT ↗";
  }
});
document.addEventListener("mousemove", (event: MouseEvent) => {
  if (document.pointerLockElement !== renderer.domElement || ended) return;
  yaw -= event.movementX * 0.0022;
  pitch -= event.movementY * 0.0018;
  pitch = THREE.MathUtils.clamp(pitch, -1.18, 1.18);
});
document.addEventListener("keydown", (event: KeyboardEvent) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === "KeyE" && !event.repeat && started && !ended) interact();
  if (event.code === "Space" && !event.repeat && started && grounded && coyoteTime > 0) {
    verticalVelocity = JUMP_SPEED;
    playSfx("jump");
    grounded = false;
    coyoteTime = 0;
  }
  if (event.code === "Escape" && started && !ended && document.pointerLockElement !== renderer.domElement) {
    intro.classList.remove("dismissed");
  }
});
document.addEventListener("keyup", (event: KeyboardEvent) => keys.delete(event.code));
window.addEventListener("blur", () => keys.clear());
renderer.domElement.addEventListener("click", () => {
  if (started && !ended && document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.();
});

function collidesAt(x: number, z: number): boolean {
  const r = PLAYER_RADIUS;
  return colliders.some((c) =>
    x + r > c.minX && x - r < c.maxX &&
    z + r > c.minZ && z - r < c.maxZ
  );
}

function moveWithCollision(dx: number, dz: number): void {
  // Resolve axes independently so the player can slide smoothly along walls.
  const nextX = THREE.MathUtils.clamp(camera.position.x + dx, -7.05, 7.05);
  if (!collidesAt(nextX, camera.position.z)) camera.position.x = nextX;
  const nextZ = THREE.MathUtils.clamp(camera.position.z + dz, -20.8, 12.35);
  if (!collidesAt(camera.position.x, nextZ)) camera.position.z = nextZ;
}

function nearestTarget(): { relay?: Relay; gate: boolean; distance: number } {
  // Interaction is first-person and gaze-based: nearby objects behind the player
  // must never activate just because the camera is standing close to them.
  const lookDirection = camera.getWorldDirection(new THREE.Vector3()).normalize();
  let nearest: Relay | undefined;
  let distance = Infinity;

  for (const relay of relays) {
    const targetPosition = new THREE.Vector3(relay.position.x, 1.2, relay.position.z);
    const toTarget = targetPosition.clone().sub(camera.position);
    const d = toTarget.length();
    const facing = toTarget.normalize().dot(lookDirection);
    if (d <= 2.65 && facing > 0.78 && d < distance) {
      distance = d;
      nearest = relay;
    }
  }

  const gatePosition = new THREE.Vector3(5.05, 1.4, -17.2);
  const toGate = gatePosition.clone().sub(camera.position);
  const gateDistance = toGate.length();
  const gateFacing = toGate.normalize().dot(lookDirection);
  if (gateDistance <= 2.65 && gateFacing > 0.7 && gateDistance < distance) {
    return { gate: true, distance: gateDistance };
  }
  return { relay: nearest, gate: false, distance };
}
function interact(): void {
  const target = nearestTarget();
  if (target.distance > 2.65) { playSfx("denied"); notify("NOT IN RANGE."); return; }
  if (target.gate) {
    if (!gateOpen) { playSfx("denied"); notify("BULKHEAD LOCKED — RESTORE THE SIGNAL."); return; }
    finishGame();
    return;
  }
  const relay = target.relay;
  if (!relay) return;
  // Relays may be selected more than once: this is a six-beat signal, not a one-touch checklist.
  if (relay.kind !== sequence[nextRelay]) {
    playSfx("denied");
    transferStartedAt = null;
    transferOrb.visible = false;
    transferLight.intensity = 0;
    nextRelay = 0;
    for (const item of relays) {
      item.active = false;
      const symbol = item.group.getObjectByName("relay-symbol") as THREE.Mesh | undefined;
      if (symbol) symbol.material = materials.glow;
      const halo = item.group.getObjectByName("relay-halo") as THREE.Mesh | undefined;
      if (halo) halo.scale.setScalar(1);
      item.group.scale.setScalar(1);
    }
    notify("SEQUENCE REJECTED. ALL RELAYS RESET.");
    updateObjective();
    return;
  }
  relay.active = true;
  playSfx("relay");
  playSignalTone(420 + nextRelay * 72, 720 + nextRelay * 90, 0.24, "sine", 0.032);
  startSignalTransfer(relay, nextRelay + 1);
  const relaySymbol = relay.group.getObjectByName("relay-symbol") as THREE.Mesh | undefined;
  if (relaySymbol) {
    const pulseMaterial = new THREE.MeshStandardMaterial({ color: "#fff0d6", emissive: "#8fffd0", emissiveIntensity: 4.4, metalness: 0.18, roughness: 0.2 });
    relaySymbol.material = pulseMaterial;
  }
  const relayHalo = relay.group.getObjectByName("relay-halo") as THREE.Mesh | undefined;
  if (relayHalo) relayHalo.scale.setScalar(1.28);
  relay.group.scale.setScalar(1.08);
  nextRelay++;
  notify(`SIGNAL BEAT ${nextRelay} / ${sequence.length} ACCEPTED.`);
  if (nextRelay === sequence.length) {
    gateOpen = true;
    const gateColliderIndex = colliders.findIndex((c) => c.minX === 3.25 && c.maxX === 6.85 && c.minZ === -18.45);
    if (gateColliderIndex >= 0) colliders.splice(gateColliderIndex, 1);
    // Start a staged mechanical sequence. The actual door motion is driven by
    // elapsed time in animate(), not an instant position jump.
    exitOpeningStartedAt = clock.elapsedTime;
    playSfx("door");
    playSignalTone(260, 880, 1.05, "sawtooth", 0.035);
    notify("POWER RESTORED. BULKHEAD CYCLE INITIATED.");
  }
  updateObjective();
}
function finishGame(): void {
  if (ended) return;
  ended = true;
  document.exitPointerLock?.();
  hud.classList.remove("active");
  transitScreen.hidden = false;
  transitScreen.classList.add("transit-active");

  // The transit overlay is a deliberate inter-level beat. Keep the scene alive
  // underneath it so the final bulkhead lighting and foundry ambience can settle.
  const messages = [
    "EXIT ACCEPTED // PERSONNEL RECORD SEALED",
    "REVOKING EMPLOYEE ACCESS...",
    "DESTINATION NOT APPROVED",
    "SHIFT 03 INITIALIZATION"
  ];
  let messageIndex = 0;
  transitStatus.textContent = messages[0];
  const messageTimer = window.setInterval(() => {
    messageIndex += 1;
    if (messageIndex < messages.length) transitStatus.textContent = messages[messageIndex];
    else window.clearInterval(messageTimer);
  }, 720);

  window.setTimeout(() => {
    window.clearInterval(messageTimer);
    transitStatus.textContent = "SHIFT 03 INITIALIZED // PERSONNEL RECORDS OPEN";
    window.location.href = "./index.html?shift=3";
  }, 3200);
}
updateObjective();

function animate(): void {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  amberLight.intensity = 22 + Math.sin(t * 1.7) * 1.6;
  fillLight.intensity = 16 + Math.sin(t * 0.55 + 2) * 2;
  const dust = scene.getObjectByName("atmospheric-dust");
  if (dust) dust.rotation.y += delta * 0.012;
  const distantPlanet = scene.getObjectByName("distant-planet");
  if (distantPlanet) distantPlanet.rotation.y += delta * 0.035;
  const planetRim = scene.getObjectByName("planet-rim");
  if (planetRim) planetRim.rotation.z += delta * 0.025;
  maintenanceFans.forEach((fan, index) => {
    fan.rotation.y += delta * (index % 2 === 0 ? 1.25 : -0.92);
  });
  const exitSign = scene.getObjectByName("exit-sign");
  if (exitSign) {
    const pulse = 0.88 + (Math.sin(t * 2.6) + 1) * 0.12;
    exitSign.scale.y = pulse;
  }
  // Three-stage exit animation: release the radial locks, retract the reactor
  // core, then peel the six armor leaves sideways to reveal the passage.
  if (exitOpeningStartedAt !== null) {
    const elapsed = t - exitOpeningStartedAt;
    if (elapsed < 0.7 && Math.floor(elapsed / 0.18) !== Math.floor(Math.max(0, elapsed - delta) / 0.18)) playSfx("lock");
    const easeOut = (value: number) => {
      const clamped = THREE.MathUtils.clamp(value, 0, 1);
      return 1 - Math.pow(1 - clamped, 3);
    };
    const lockProgress = easeOut(elapsed / 0.62);
    const coreProgress = easeOut((elapsed - 0.48) / 0.9);
    const leafProgress = easeOut((elapsed - 1.05) / 1.45);
    exitOpeningProgress = leafProgress;

    exitDoorLocks.forEach((lock, i) => {
      const angle = (i / 8) * Math.PI * 2;
      lock.position.z = 0.91 - lockProgress * 0.72;
      lock.position.x = Math.cos(angle) * (0.96 + lockProgress * 0.12);
      lock.position.y = 2.2 + Math.sin(angle) * (0.96 + lockProgress * 0.12);
    });
    if (exitDoorCore) {
      exitDoorCore.position.z = -0.15 - coreProgress * 1.8;
      exitDoorCore.scale.setScalar(1 - coreProgress * 0.24);
      exitDoorCore.rotation.z = coreProgress * Math.PI * 1.5;
    }
    exitDoorLeaves.forEach((leaf, i) => {
      const side = i < 3 ? -1 : 1;
      const rank = i < 3 ? 2 - i : i - 3;
      const spread = 0.24 + rank * 0.16;
      leaf.position.x = (-1.28 + i * 0.512) + side * spread * leafProgress;
      leaf.position.z = leafProgress * 0.42;
      leaf.rotation.y = side * leafProgress * 0.22;
      leaf.rotation.z = (i - 2.5) * 0.018 + side * leafProgress * 0.12;
    });
  }
  // Solving the puzzle changes the whole room from tired amber to powered mint.
  foundryPowerBlend = THREE.MathUtils.damp(foundryPowerBlend, gateOpen ? 1 : 0, 1.8, delta);
  const powerUp = foundryPowerBlend;
  amberLight.color.lerpColors(foundryPalette.amber, foundryPalette.amberPowered, powerUp * 0.82);
  fillLight.color.lerpColors(foundryPalette.violet, foundryPalette.violetPowered, powerUp * 0.72);
  practicalLights.forEach((lamp, i) => {
    lamp.color.lerpColors(foundryPalette.practical, foundryPalette.practicalPowered, powerUp * 0.88);
    const pulse = 0.92 + Math.sin(t * 1.35 + i * 1.7) * 0.045 + Math.sin(t * 7.1 + i) * 0.018;
    const targetIntensity = THREE.MathUtils.lerp(10, 7.5, powerUp) * pulse;
    lamp.intensity = THREE.MathUtils.damp(lamp.intensity, targetIntensity, 2.5, delta);
  });
  exitSignLight.intensity = exitOpeningStartedAt !== null
    ? 8 + Math.sin(t * 18) * (1 - exitOpeningProgress) * 2.2
    : 5.5 + Math.sin(t * 2.2) * 1.0;

  // A bright packet physically travels through the signal route and into the door.
  if (transferStartedAt !== null) {
    const progress = THREE.MathUtils.clamp((t - transferStartedAt) / transferDuration, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    transferOrb.position.lerpVectors(transferFrom, transferTo, eased);
    transferOrb.rotation.x += delta * 4.2;
    transferOrb.rotation.y += delta * 5.4;
    transferOrb.scale.setScalar(0.78 + Math.sin(progress * Math.PI) * 0.6);
    transferLight.position.copy(transferOrb.position);
    transferLight.intensity = 18 * (1 - progress * 0.72);
    if (progress >= 1) {
      transferStartedAt = null;
      transferOrb.visible = false;
      transferLight.intensity = 0;
    }
  }

  for (const relay of relays) {
    const symbol = relay.group.getObjectByName("relay-symbol");
    if (symbol) {
      symbol.rotation.y += delta * (relay.active ? 0.22 : 0.72);
      symbol.position.y = 1.4 + Math.sin(t * 1.65 + relay.position.x) * 0.055;
    }
    const halo = relay.group.getObjectByName("relay-halo");
    if (halo) {
      halo.rotation.z += delta * (relay.active ? -0.18 : 0.28);
      const pulse = 1 + Math.sin(t * 2.2 + relay.position.x) * 0.045;
      halo.scale.setScalar(pulse);
    }
  }
  if (started && !ended) {
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    move.set(0, 0, 0);
    if (keys.has("KeyW") || keys.has("ArrowUp")) move.add(forward);
    if (keys.has("KeyS") || keys.has("ArrowDown")) move.sub(forward);
    if (keys.has("KeyD") || keys.has("ArrowRight")) move.add(right);
    if (keys.has("KeyA") || keys.has("ArrowLeft")) move.sub(right);

    const hasInput = move.lengthSq() > 0;
    if (hasInput) move.normalize();
    const sprinting = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && hasInput;
    const targetSpeed = sprinting ? 6.75 : 4.45;
    const targetX = move.x * targetSpeed;
    const targetZ = move.z * targetSpeed;
    // Exponential damping creates controlled acceleration and a natural stop.
    const response = grounded ? (hasInput ? 10.5 : 8.2) : 2.3;
    velocity.x = THREE.MathUtils.damp(velocity.x, targetX, response, delta);
    velocity.z = THREE.MathUtils.damp(velocity.z, targetZ, response, delta);
    sprintBlend = THREE.MathUtils.damp(sprintBlend, sprinting ? 1 : 0, 5.5, delta);
    camera.fov = THREE.MathUtils.damp(camera.fov, sprinting ? 80 : 76, 4.5, delta);
    camera.updateProjectionMatrix();

    moveWithCollision(velocity.x * delta, velocity.z * delta);

    // Keep physical eye height separate from bob to prevent accumulated drift.
    verticalVelocity -= GRAVITY * delta;
    let eyeY = playerEyeY + verticalVelocity * delta;
    if (eyeY <= PLAYER_EYE_HEIGHT) {
      eyeY = PLAYER_EYE_HEIGHT;
      verticalVelocity = 0;
      grounded = true;
      coyoteTime = 0.1;
    } else {
      grounded = false;
      coyoteTime = Math.max(0, coyoteTime - delta);
    }
    if (!previousGrounded && grounded) playSfx("land");
    previousGrounded = grounded;
    playerEyeY = eyeY;
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    if (grounded && horizontalSpeed > 1.15) {
      footstepAccumulator += delta;
      const stepInterval = sprinting ? 0.29 : 0.43;
      if (footstepAccumulator >= stepInterval) {
        footstepAccumulator = 0;
        playSfx("step");
      }
    } else {
      footstepAccumulator = Math.min(footstepAccumulator, 0.12);
    }
    const bobFrequency = THREE.MathUtils.lerp(9.8, 13.2, sprintBlend);
    const bobAmplitude = THREE.MathUtils.lerp(0.025, 0.045, sprintBlend);
    const bobTarget = grounded && horizontalSpeed > 0.18
      ? Math.sin(t * bobFrequency) * Math.min(bobAmplitude, horizontalSpeed * 0.006)
      : 0;
    cameraBob = THREE.MathUtils.damp(cameraBob, bobTarget, 13, delta);
    camera.position.y = playerEyeY + cameraBob;
    camera.rotation.z = THREE.MathUtils.damp(camera.rotation.z, -velocity.x * 0.009, 4.5, delta);
    const target = nearestTarget();
    if (target.distance <= 2.65) {
      interaction.textContent = target.gate ? (gateOpen ? "[ E ] OPEN THE BULKHEAD" : "BULKHEAD LOCKED · RESTORE SIGNAL") : target.relay?.active ? "[ E ] SEND NEXT SIGNAL BEAT" : "[ E ] ACTIVATE RELAY";
      root.classList.add("target-acquired");
    } else {
      interaction.textContent = "EXPLORE THE FOUNDRY";
      root.classList.remove("target-acquired");
    }
    for (const relay of relays) {
      const symbol = relay.group.getObjectByName("relay-symbol") as THREE.Mesh | undefined;
      if (symbol) {
        const material = symbol.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = relay.active ? 3.5 : 1.7 + Math.max(0, Math.sin(t * 2 + relay.position.x)) * 0.75;
      }
    }
  }
  composer.render();
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});
