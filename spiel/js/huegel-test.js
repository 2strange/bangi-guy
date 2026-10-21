// huegel-test.js — Mini-Szene für den Mentor-Hügel: Boden, Hecke mit zwei Lücken, der Hügel aus zone-huegel.js,
// steuerbarer Schluffi, dessen Höhe der Bodenhöhe folgt (height(x, z)); Kamera hebt sich mit.
import * as THREE from 'three';
import { toonMesh } from './toon.js';
import { hedge } from './props.js';
import { schluffi } from './figures.js';
import { buildHuegel } from './zone-huegel.js';
import { HECKE_LUECKE } from './zone-huegel-layout.js';
import { inputToDir, stepPlayer, followCamera, waddlePose, CAM_OFFSET, DEFAULT_CAM_YAW } from './logic.js';

const q = (name) => (location.search.match(new RegExp('[?&]' + name + '=([-a-z0-9.]+)')) || [])[1];
const SNAP = q('snap') === '1';
const AT = q('at');
const CY = q('cy');
const T0 = parseFloat(q('t') || '2.5'); // Zeitpunkt der Idle-Animation im Standbild

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: SNAP });
renderer.setPixelRatio(SNAP ? 1 : Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fe0ff);
scene.fog = new THREE.Fog(0x9fe6ff, 70, 230);
const camera = new THREE.PerspectiveCamera(44, 1.6, 0.5, 600);
const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.9);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
const sc = sunLight.shadow.camera;
sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 120;
sunLight.shadow.bias = -0.0006;
sunLight.shadow.normalBias = 0.03;
scene.add(sunLight, sunLight.target);
scene.add(new THREE.HemisphereLight(0xcfeeff, 0xd9b27a, 0.75));

const world = new THREE.Group();
scene.add(world);
const grass = toonMesh(new THREE.PlaneGeometry(520, 520), 0x5fc74a, { outline: 0, shadow: false });
grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; grass.userData.noFade = true; world.add(grass);
const sand = toonMesh(new THREE.PlaneGeometry(520, 60), 0xf7d984, { outline: 0, shadow: false });
sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, 15); sand.receiveShadow = true; sand.userData.noFade = true; world.add(sand);
// Hecke in zwei Teilen: Lücke für die Wäschegasse (-4 … 4) und für die Serpentine
world.add(hedge(-66, -8, -25.5, { gapFrom: HECKE_LUECKE.from, gapTo: HECKE_LUECKE.to, seed: 3 }));
world.add(hedge(-6, 66, -25.5, { gapFrom: -4, gapTo: 4, seed: 4 }));

const colliders = [
  { x: -60, z: -25.5, w: 12, d: 3 }, { x: -25, z: -25.5, w: 42, d: 3 }, { x: 35, z: -25.5, w: 62, d: 3 },
];
const huegel = buildHuegel(world, colliders);
world.updateMatrixWorld(true);

const player = schluffi();
scene.add(player);
const P = player.userData.parts;
const WORLD = { minX: -66, maxX: 66, minZ: -80 };
const spots = { ...huegel.spots, overview: { x: -44, z: -40, yaw: Math.PI } };
const startSpot = spots[AT] || spots.huegel;
let state = { x: startSpot.x, z: startSpot.z, yaw: startSpot.yaw, phase: 0, speed: 0 };
let camYaw = DEFAULT_CAM_YAW + (CY ? parseFloat(CY) * Math.PI / 180 : 0);
let cam = { x: state.x, y: CAM_OFFSET.up, z: state.z - CAM_OFFSET.back, tx: state.x, ty: CAM_OFFSET.targetY, tz: state.z };

const keys = { up: false, down: false, left: false, right: false, run: false, rotL: false, rotR: false };
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run', KeyQ: 'rotL', KeyE: 'rotR' };
window.addEventListener('keydown', (e) => { const k = KEYMAP[e.code]; if (k) { keys[k] = true; e.preventDefault(); } });
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function applyPose(st) {
  player.position.set(st.x, huegel.height(st.x, st.z), st.z);
  player.rotation.y = st.yaw;
  const pose = waddlePose(st.phase, st.speed, st.running);
  P.legs[0].rotation.x = pose.legL; P.legs[1].rotation.x = pose.legR;
  P.legs[0].children[2].rotation.x = Math.max(0, pose.legL) * 0.9;
  P.legs[1].children[2].rotation.x = Math.max(0, pose.legR) * 0.9;
  P.arms[0].rotation.x = pose.armL; P.arms[1].rotation.x = pose.armR * 0.4;
  P.body.position.y = 0.9 + pose.bob;
  P.body.rotation.set(P.baseBodyRot.x + pose.lean, 0, P.baseBodyRot.z + pose.sway);
  P.head.rotation.set(P.baseHeadRot.x - pose.lean * 0.5, P.baseHeadRot.y, P.baseHeadRot.z - pose.sway * 0.8);
}
function applyCamera() {
  const h = huegel.height(state.x, state.z); // Kamera hebt sich mit dem Boden
  camera.position.set(cam.x, cam.y + h, cam.z);
  camera.lookAt(cam.tx, cam.ty + h, cam.tz);
  sunLight.position.set(state.x + 20, 40, state.z + 14);
  sunLight.target.position.set(state.x, 0, state.z);
}
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, true);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

if (SNAP) {
  huegel.update(T0);
  applyPose(state);
  for (let i = 0; i < 300; i++) cam = followCamera(cam, state, 1 / 60, camYaw);
  applyCamera();
  if (AT === 'overview') { camera.position.set(-20, 34, -16); camera.lookAt(-44, 2, -54); }
  camera.updateMatrixWorld();
  world.updateMatrixWorld(true);
  const shoot = () => { resize(); renderer.render(scene, camera); requestAnimationFrame(() => { resize(); renderer.render(scene, camera); }); };
  if (document.readyState === 'complete') shoot(); else window.addEventListener('load', shoot);
  window.addEventListener('resize', shoot);
} else {
  resize();
  window.addEventListener('resize', resize);
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (keys.rotL) camYaw += 1.5 * dt;
    if (keys.rotR) camYaw -= 1.5 * dt;
    state = stepPlayer(state, { dir: inputToDir(keys, camYaw), run: keys.run }, dt, colliders, WORLD);
    applyPose(state);
    huegel.update(now / 1000);
    cam = followCamera(cam, state, dt, camYaw);
    applyCamera();
    renderer.render(scene, camera);
  });
}
