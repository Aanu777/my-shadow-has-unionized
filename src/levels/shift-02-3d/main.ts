import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import "./style.css";

const root = document.querySelector<HTMLDivElement>("#game-view");
const intro = document.querySelector<HTMLElement>("#intro");
const startButton = document.querySelector<HTMLButtonElement>("#start-button");
const hud = document.querySelector<HTMLElement>("#hud");
const interaction = document.querySelector<HTMLElement>("#interaction");
const objectiveTitle = document.querySelector<HTMLElement>("#objective-title");
const objectiveCopy = document.querySelector<HTMLElement>("#objective-copy");
const relayProgress = document.querySelector<HTMLElement>("#relay-progress");
const toast = document.querySelector<HTMLElement>("#toast");
const endScreen = document.querySelector<HTMLElement>("#end-screen");
const replayButton = document.querySelector<HTMLButtonElement>("#replay-button");

if (!root || !intro || !startButton || !hud || !interaction || !objectiveTitle || !objectiveCopy || !relayProgress || !toast || !endScreen || !replayButton) {
  throw new Error("Shift 02 3D page is missing a required UI element.");
}

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
    for (let z = 13; z >= -23; z -= 3) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.55, 2.72), materials.wall);
      panel.position.set(side * 7.82, 2.38, z);
      panel.rotation.y = side * -0.035;
      panel.castShadow = true;
      panel.receiveShadow = true;
      scene.add(panel);
      const inset = new THREE.Mesh(new THREE.BoxGeometry(0.035, 2.45, 1.72), materials.dark);
      inset.position.set(side * 7.69, 2.45, z);
      scene.add(inset);
      const insetGlow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 1.2), materials.glow);
      insetGlow.position.set(side * 7.66, 3.72, z);
      scene.add(insetGlow);
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
  planet.position.set(-1.8, 3.4, -24.4);
  scene.add(planet);
  const planetRim = new THREE.Mesh(new THREE.TorusGeometry(2.36, 0.025, 8, 80), materials.violet);
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

  // The bulkhead has a frame, curved locking rods and an emissive access seam.
  const gateFrame = new THREE.Mesh(new THREE.BoxGeometry(5.5, 4.7, 0.42), materials.dark);
  gateFrame.position.set(0, 2.25, -18.2);
  gateFrame.castShadow = true;
  scene.add(gateFrame);
  const gatePanel = new THREE.Mesh(new THREE.BoxGeometry(4.45, 4.05, 0.16), materials.ceramic);
  gatePanel.position.set(0, 2.2, -17.98);
  gatePanel.castShadow = true;
  scene.add(gatePanel);
  for (let x = -1.8; x <= 1.8; x += 0.9) {
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.75, 10), materials.copper);
    rib.position.set(x, 2.1, -17.84);
    scene.add(rib);
  }
  const gateLight = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.045, 0.08), materials.glow);
  gateLight.position.set(0, 4.15, -17.78);
  scene.add(gateLight);

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
        instance.position.set(x, height, z);
        instance.rotation.y = rotation;
        scene.add(instance);
        importedProps.push(instance);
      }
    },
    undefined,
    () => console.warn("Optional CC0 model unavailable:", file)
  );
}
loadAsset("satelliteDish.glb", [[-5.45, -11.7, 0, 0], [5.45, -11.7, 0, Math.PI], [-5.45, 2.6, 0, 0], [5.45, 2.6, 0, Math.PI]]);
loadAsset("satelliteDish_detailed.glb", [[-5.7, -2.8, 0, 0.25], [5.7, -2.8, 0, -0.25]]);
loadAsset("satelliteDish_large.glb", [[-5.6, -18.4, 0, 0.2], [5.6, -18.4, 0, -0.2]]);

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
        instance.position.set(x, height, z);
        instance.rotation.y = rotation;
        scene.add(instance);
        importedProps.push(instance);
      }
    },
    undefined,
    () => console.warn("Optional CC0 factory model unavailable:", file)
  );
}
loadFactoryAsset("machine.glb", [[-5.45, -15.3, 0.05, 0], [5.45, -15.3, 0.05, Math.PI]]);
loadFactoryAsset("crane-lift.glb", [[-5.9, -4.0, 0, Math.PI / 2], [5.9, -4.0, 0, -Math.PI / 2]]);
loadFactoryAsset("machine-window.glb", [[-6.05, 5.1, 0.1, 0], [6.05, 5.1, 0.1, Math.PI]]);
loadFactoryAsset("pipe-large-curve.glb", [[-5.75, -0.6, 0.1, Math.PI / 2], [5.75, -0.6, 0.1, -Math.PI / 2]]);

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
  // Arched ribs, concentric service rings and suspended pipework.
  for (const z of [11, 5, -1, -7, -13, -19]) {
    for (const side of [-1, 1]) {
      const support = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.25, 4.7, 12), materials.ceramic);
      support.position.set(side * 6.9, 2.35, z);
      support.castShadow = true;
      support.receiveShadow = true;
      scene.add(support);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.055, 8, 18), materials.copper);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(side * 6.9, 1.1, z);
      scene.add(collar);
      tubeBetween(new THREE.Vector3(side * 6.9, 4.2, z), new THREE.Vector3(side * 5.7, 4.45, z), 0.075, materials.copper, 12);
    }
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(6.7, 0.055, 8, 64), materials.ceramic);
    hoop.position.set(0, 2.6, z);
    hoop.rotation.x = Math.PI / 2;
    hoop.scale.y = 0.62;
    hoop.castShadow = true;
    scene.add(hoop);
    const lightRing = new THREE.Mesh(new THREE.TorusGeometry(5.95, 0.025, 6, 64), materials.glow);
    lightRing.position.set(0, 4.38, z);
    lightRing.rotation.x = Math.PI / 2;
    lightRing.scale.y = 0.22;
    scene.add(lightRing);
  }

  // Recessed floor plates and small service lights; material roughness varies
  // across the walking surface for a more convincing industrial finish.
  for (let z = 12; z > -22; z -= 1.5) {
    for (const x of [-5.9, -3.9, -1.9, 0.1, 2.1, 4.1, 6.1]) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.035, 1.3), (Math.round(z * 10 + x) % 3 === 0) ? materials.dark : materials.floor);
      plate.position.set(x, 0.012, z);
      plate.receiveShadow = true;
      scene.add(plate);
      if (Math.round(z * 10 + x) % 5 === 0) {
        const boltMat = materials.copper;
        for (const bx of [-0.72, 0.72]) {
          for (const bz of [-0.5, 0.5]) {
            const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.018, 8), boltMat);
            bolt.position.set(x + bx, 0.04, z + bz);
            bolt.rotation.x = Math.PI / 2;
            scene.add(bolt);
          }
        }
      }
    }
  }

  // Cable bundles follow the corridor edges rather than floating as decorations.
  for (const side of [-1, 1]) {
    for (let line = 0; line < 3; line++) {
      const x = side * (5.7 + line * 0.19);
      tubeBetween(new THREE.Vector3(x, 3.85 + line * 0.13, 13), new THREE.Vector3(x, 3.85 + line * 0.13, -22), 0.035 + line * 0.009, line === 1 ? materials.copper : materials.dark, 8);
    }
  }

  // Rounded ventilation drums and reactor housings.
  for (const [x, z] of [[-6.1, -8.8], [6.1, -8.8], [-6.1, 7.5], [6.1, 7.5]] as const) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 1.7, 20, 2), materials.dark);
    drum.position.set(x, 1.0, z);
    drum.rotation.z = Math.PI / 2;
    drum.castShadow = true;
    drum.receiveShadow = true;
    scene.add(drum);
    for (const dx of [-0.58, 0.58]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 8, 24), materials.copper);
      rim.position.set(x + dx, 1.0, z);
      rim.rotation.y = Math.PI / 2;
      scene.add(rim);
    }
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), materials.violet);
    axle.position.set(x, 1.0, z + 0.87);
    axle.castShadow = true;
    scene.add(axle);
  }

  // Distant dust catches the light without covering the reticle or objectives.
  const dustGeometry = new THREE.BufferGeometry();
  const dustCount = 460;
  const positions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    positions[i * 3] = -7.2 + Math.random() * 14.4;
    positions[i * 3 + 1] = 0.45 + Math.random() * 4.2;
    positions[i * 3 + 2] = -22 + Math.random() * 36;
  }
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: "#d8b6ff", size: 0.035, transparent: true, opacity: 0.48, sizeAttenuation: true, depthWrite: false }));
  scene.add(dust);
  dust.name = "atmospheric-dust";
}
addSetDressing();
const relays: Relay[] = [makeRelay("triangle", -4.2, -6.8), makeRelay("circle", 0, -6.8), makeRelay("diamond", 4.2, -6.8)];
const sequence: Relay["kind"][] = ["triangle", "circle", "diamond"];
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

// Lightweight first-person character physics. The camera is the player's eye,
// while the horizontal body is approximated by a cylinder/capsule footprint.
const PLAYER_EYE_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.34;
const PLAYER_HEIGHT = 1.8;
const GRAVITY = 22;
const JUMP_SPEED = 8.2;
const WALK_ACCELERATION = 25;
const GROUND_FRICTION = 12;
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
  { minX: -2.35, maxX: 2.35, minZ: -18.45, maxZ: -17.65 },
  // Relay consoles
  { minX: -4.95, maxX: -3.45, minZ: -7.55, maxZ: -6.05 },
  { minX: -0.75, maxX: 0.75, minZ: -7.55, maxZ: -6.05 },
  { minX: 3.45, maxX: 4.95, minZ: -7.55, maxZ: -6.05 },
  // Side machinery
  { minX: -6.7, maxX: -4.1, minZ: -16.7, maxZ: -14.9 },
  { minX: 4.1, maxX: 6.7, minZ: -16.7, maxZ: -14.9 },
  // Low floor-level equipment that the player must navigate around
  { minX: -3.95, maxX: -2.45, minZ: 7.4, maxZ: 8.6 },
  { minX: 2.45, maxX: 3.95, minZ: 5.9, maxZ: 7.1 },
  { minX: -3.95, maxX: -2.45, minZ: 1.9, maxZ: 3.1 },
  { minX: 2.45, maxX: 3.95, minZ: 0.4, maxZ: 1.6 },
  { minX: -3.95, maxX: -2.45, minZ: -3.6, maxZ: -2.4 },
  { minX: 2.45, maxX: 3.95, minZ: -5.1, maxZ: -3.9 }
];
const gateLeft = scene.children.find((o) => o instanceof THREE.Mesh && Math.abs(o.position.z + 18.2) < 0.01 && o.position.x === 0) as THREE.Mesh | undefined;

function notify(message: string): void {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer.id);
  toastTimer.id = window.setTimeout(() => toast.classList.remove("visible"), 1900);
}
function updateObjective(): void {
  relayProgress.innerHTML = `RELAYS <strong>${nextRelay} / 3</strong>`;
  if (gateOpen) {
    objectiveTitle.textContent = "The exit is unlocked";
    objectiveCopy.textContent = "Reach the bulkhead and press E. Management has lost control.";
  } else {
    objectiveTitle.textContent = nextRelay === 0 ? "Restore the relay sequence" : nextRelay === 1 ? "One relay is online" : "Two relays are online";
    objectiveCopy.textContent = "Activate the terminals in order: triangle, circle, then diamond.";
  }
}
function startGame(): void {
  started = true;
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

  const gatePosition = new THREE.Vector3(0, 1.4, -17.2);
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
  if (target.distance > 2.65) { notify("Nothing within reach."); return; }
  if (target.gate) {
    if (!gateOpen) { notify("BULKHEAD LOCKED — RESTORE THE THREE RELAYS."); return; }
    finishGame();
    return;
  }
  const relay = target.relay;
  if (!relay) return;
  if (relay.active) { notify("THIS RELAY IS ALREADY ONLINE."); return; }
  if (relay.kind !== sequence[nextRelay]) {
    nextRelay = 0;
    for (const item of relays) {
      item.active = false;
      item.group.scale.setScalar(1);
    }
    notify("SEQUENCE REJECTED. ALL RELAYS RESET.");
    updateObjective();
    return;
  }
  relay.active = true;
  relay.group.scale.setScalar(1.08);
  nextRelay++;
  notify(`${relay.kind.toUpperCase()} RELAY ACCEPTED.`);
  if (nextRelay === sequence.length) {
    gateOpen = true;
    const gateColliderIndex = colliders.findIndex((c) => c.minX === -2.35 && c.maxX === 2.35 && c.minZ === -18.45);
    if (gateColliderIndex >= 0) colliders.splice(gateColliderIndex, 1);
    if (gateLeft) gateLeft.position.y = 8;
    for (const child of scene.children) {
      if (child instanceof THREE.Mesh && (Math.abs(child.position.z + 17.84) < 0.02 || Math.abs(child.position.z + 17.98) < 0.02) && Math.abs(child.position.x) < 2.3) child.position.y += 5;
    }
    notify("ACCESS RESTORED. THE BULKHEAD IS OPEN.");
  }
  updateObjective();
}
function finishGame(): void {
  ended = true;
  document.exitPointerLock?.();
  endScreen.hidden = false;
  hud.classList.remove("active");
}
updateObjective();

function animate(): void {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  practicalLights.forEach((lamp, i) => {
    const pulse = 0.92 + Math.sin(t * 1.35 + i * 1.7) * 0.045 + Math.sin(t * 7.1 + i) * 0.018;
    lamp.intensity = 10 * pulse;
  });
  amberLight.intensity = 22 + Math.sin(t * 1.7) * 1.6;
  fillLight.intensity = 16 + Math.sin(t * 0.55 + 2) * 2;
  for (const [index, prop] of importedProps.entries()) {
    if (index % 2 === 0) prop.rotation.y += Math.sin(t * 0.25 + index) * delta * 0.018;
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
    if (hasInput) {
      move.normalize();
      const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
      const maxSpeed = sprinting ? 7.1 : 4.65;
      const accel = grounded ? WALK_ACCELERATION : WALK_ACCELERATION * 0.32;
      velocity.x += move.x * accel * delta;
      velocity.z += move.z * accel * delta;
      const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
      if (horizontalSpeed > maxSpeed) {
        const scale = maxSpeed / horizontalSpeed;
        velocity.x *= scale;
        velocity.z *= scale;
      }
    } else if (grounded) {
      const friction = Math.max(0, 1 - GROUND_FRICTION * delta);
      velocity.x *= friction;
      velocity.z *= friction;
      if (Math.abs(velocity.x) < 0.025) velocity.x = 0;
      if (Math.abs(velocity.z) < 0.025) velocity.z = 0;
    }

    moveWithCollision(velocity.x * delta, velocity.z * delta);

    // Gravity, jump arc, and a stable eye-height landing plane.
    verticalVelocity -= GRAVITY * delta;
    let eyeY = camera.position.y + verticalVelocity * delta;
    if (eyeY <= PLAYER_EYE_HEIGHT) {
      eyeY = PLAYER_EYE_HEIGHT;
      verticalVelocity = 0;
      grounded = true;
      coyoteTime = 0.1;
    } else {
      grounded = false;
      coyoteTime = Math.max(0, coyoteTime - delta);
    }
    camera.position.y = eyeY;
    if (grounded && hasInput) {
      camera.position.y += Math.sin(t * 10.5) * Math.min(0.025, Math.hypot(velocity.x, velocity.z) * 0.004);
    }
    const target = nearestTarget();
    if (target.distance <= 2.65) {
      interaction.textContent = target.gate ? (gateOpen ? "[ E ] OPEN THE BULKHEAD" : "BULKHEAD LOCKED") : target.relay?.active ? "RELAY ONLINE" : "[ E ] ACTIVATE RELAY";
    } else {
      interaction.textContent = "EXPLORE THE FOUNDRY";
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
