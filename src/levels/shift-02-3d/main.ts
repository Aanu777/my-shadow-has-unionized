import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
root.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight("#b8a6df", "#201426", 1.4));
const moonLight = new THREE.DirectionalLight("#c8b5ff", 2.1);
moonLight.position.set(-7, 12, 3);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
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
  floor: new THREE.MeshStandardMaterial({ color: "#242033", roughness: 0.84, metalness: 0.25 }),
  wall: new THREE.MeshStandardMaterial({ color: "#30283e", roughness: 0.76, metalness: 0.45 }),
  dark: new THREE.MeshStandardMaterial({ color: "#171321", roughness: 0.68, metalness: 0.55 }),
  copper: new THREE.MeshStandardMaterial({ color: "#a96543", roughness: 0.42, metalness: 0.68 }),
  glow: new THREE.MeshStandardMaterial({ color: "#e7a76c", emissive: "#d46c35", emissiveIntensity: 2.1, roughness: 0.35 }),
  violet: new THREE.MeshStandardMaterial({ color: "#7660a8", emissive: "#4b347b", emissiveIntensity: 0.6, roughness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({ color: "#171b37", emissive: "#282a65", emissiveIntensity: 0.8, metalness: 0.65, roughness: 0.18 })
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
  box(group, 0, 0.42, 0, 1.1, 0.84, 0.95, materials.dark);
  box(group, 0, 0.86, 0, 1.22, 0.08, 1.04, materials.copper);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.18, 8), materials.wall);
  pedestal.position.y = 1.02;
  pedestal.castShadow = true;
  group.add(pedestal);
  let symbol: THREE.Mesh;
  if (kind === "circle") {
    symbol = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.07, 8, 24), materials.glow);
  } else if (kind === "triangle") {
    symbol = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.55, 3), materials.glow);
    symbol.rotation.y = Math.PI;
  } else {
    symbol = new THREE.Mesh(new THREE.OctahedronGeometry(0.31, 0), materials.glow);
    symbol.scale.set(0.78, 1.2, 0.78);
  }
  symbol.position.y = 1.43;
  symbol.castShadow = true;
  group.add(symbol);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 6, 28), materials.violet);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.08;
  group.add(ring);
  const pin = new THREE.PointLight("#df945b", 1.8, 3, 2);
  pin.position.set(0, 1.5, 0);
  group.add(pin);
  return { group, kind, active: false, position: new THREE.Vector3(x, 0, z) };
}

function buildEnvironment(): void {
  box(scene, 0, -0.32, -5, 16, 0.6, 40, materials.floor, false);
  for (let z = 14; z >= -24; z -= 2) {
    box(scene, 0, 0.005, z, 15.8, 0.025, 0.035, materials.copper, false);
  }
  for (const side of [-1, 1]) {
    box(scene, side * 8, 2.4, -5, 0.6, 5, 40, materials.wall);
    box(scene, side * 7.55, 4.65, -5, 0.3, 0.25, 40, materials.dark);
    for (let z = 11; z >= -21; z -= 4) {
      box(scene, side * 7.63, 2.5, z, 0.13, 2.7, 1.35, materials.dark);
      lightStrip(side * 7.54, 3.7, z, 0.06, 0.65);
      box(scene, side * 7.48, 1.1, z, 0.12, 0.28, 0.42, materials.copper, false);
    }
  }
  for (let z = 12; z >= -22; z -= 6) {
    box(scene, 0, 5.05, z, 15.7, 0.32, 0.42, materials.dark);
    for (let x = -6; x <= 6; x += 3) {
      box(scene, x, 4.78, z, 0.16, 0.42, 0.6, materials.copper);
    }
  }
  for (const x of [-5.8, 5.8]) {
    for (const z of [1, -5, -11, -17]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.2, 8), materials.dark);
      pipe.position.set(x, 2.3, z);
      scene.add(pipe);
      box(scene, x, 0.35, z, 0.42, 0.12, 0.42, materials.copper, false);
    }
  }
  // Window into the planet-lit void at the end of the corridor.
  box(scene, 0, 3.1, -23.2, 8.8, 4.7, 0.42, materials.dark);
  box(scene, 0, 3.15, -22.96, 7.8, 3.8, 0.06, materials.glass, false);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(2.25, 24, 16), new THREE.MeshStandardMaterial({ color: "#a58bc2", emissive: "#4d356c", emissiveIntensity: 0.55, roughness: 1 }));
  planet.position.set(-1.8, 3.4, -24.4);
  scene.add(planet);
  const planetLight = new THREE.PointLight("#9b7ac9", 17, 18, 2);
  planetLight.position.set(-2, 4, -20);
  scene.add(planetLight);
  for (let i = 0; i < 45; i++) {
    const star = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? "#e3b58d" : "#a7a0d8" }));
    star.position.set(-6.5 + ((i * 37) % 130) / 10, 1.2 + ((i * 19) % 30) / 10, -24.6);
    scene.add(star);
  }
  // The sealed gate is physical geometry, not a flat UI overlay.
  box(scene, 0, 2.25, -18.2, 5.3, 4.5, 0.35, materials.dark);
  box(scene, 0, 2.2, -17.98, 4.45, 4.05, 0.12, materials.wall);
  for (let x = -1.8; x <= 1.8; x += 0.9) {
    box(scene, x, 2.1, -17.87, 0.08, 3.75, 0.1, materials.copper);
  }
  lightStrip(0, 4.15, -17.78, 3.8, 0.08);
  // Industrial consoles and cable trays add scale to the room.
  for (const side of [-1, 1]) {
    box(scene, side * 5.4, 0.62, -15.8, 2.3, 1.2, 1.3, materials.dark);
    box(scene, side * 5.4, 1.28, -15.8, 2.35, 0.1, 1.34, materials.copper);
    for (let i = 0; i < 4; i++) box(scene, side * 5.4 - 0.72 + i * 0.48, 1.36, -15.8, 0.22, 0.035, 0.16, i % 2 ? materials.violet : materials.glow, false);
  }
  for (let z = 8; z >= -14; z -= 5.5) {
    box(scene, -3.2, 0.18, z, 1.2, 0.25, 0.9, materials.dark);
    box(scene, 3.2, 0.18, z - 1.5, 1.2, 0.25, 0.9, materials.dark);
  }
}

buildEnvironment();

// Imported CC0 model props add authored silhouettes and real mesh detail. The scene
// still loads if the optional remote asset host is unavailable.
const gltfLoader = new GLTFLoader();
const machineAssetUrl = "https://api.flockbay.com/bootstrap/library/models/v1/9039d1705335f47d3766f467a9aa188a9cac395e2b5eec87a69d971b2a1e9eab/machine_generator.glb";
const importedProps: THREE.Group[] = [];
gltfLoader.load(machineAssetUrl, (gltf) => {
  const model = gltf.scene;
  model.scale.setScalar(2.15);
  model.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  for (const [x, z, rotation] of [[-5.4, -12.2, 0], [5.4, -12.2, Math.PI], [-5.4, 2.2, 0], [5.4, 2.2, Math.PI]] as const) {
    const prop = model.clone(true);
    prop.position.set(x, 0.95, z);
    prop.rotation.y = rotation;
    scene.add(prop);
    importedProps.push(prop);
  }
}, undefined, () => {
  console.warn("Optional CC0 machine model could not be loaded; continuing with fallback scene props.");
});
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
      if (child instanceof THREE.Mesh && (Math.abs(child.position.z + 17.87) < 0.02 || Math.abs(child.position.z + 17.98) < 0.02) && Math.abs(child.position.x) < 2.3) child.position.y += 5;
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
  for (const relay of relays) {
    const symbol = relay.group.children[3];
    if (symbol) symbol.rotation.y += delta * (relay.active ? 0.2 : 0.65);
    const glow = relay.group.children[4];
    if (glow) glow.scale.setScalar(1 + Math.sin(t * 2.2 + relay.position.x) * 0.045);
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
      const glow = relay.group.children[4] as THREE.Mesh | undefined;
      if (glow) {
        const material = glow.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = relay.active ? 2.8 : 0.6 + Math.max(0, Math.sin(t * 2 + relay.position.x)) * 0.5;
      }
    }
  }
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
});
