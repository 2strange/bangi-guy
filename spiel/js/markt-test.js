// markt-test.js — Mini-Szene für Dorf + Mango-Markt + Posten 7: Boden, Hecke, Dorf (ohne Absperrungen),
// Markt/Posten aus zone-markt.js mit Animation, steuerbarer Schluffi.
// Bewegung/Kamera über die reinen Funktionen aus logic.js; Verdeckung vereinfacht (Raycast auf Dorf-Props).
import * as THREE from 'three';
import { toonMesh } from './toon.js';
import { hedge, hut } from './props.js';
import { schluffi } from './figures.js';
import { buildDorf } from './zone-dorf.js';
import { buildMarkt } from './zone-markt.js';
import { inputToDir, stepPlayer, followCamera, waddlePose, CAM_OFFSET, DEFAULT_CAM_YAW, buildingScale } from './logic.js';

const q = (name) => (location.search.match(new RegExp('[?&]' + name + '=([-a-z0-9.]+)')) || [])[1];
const SNAP = q('snap') === '1';
const AT = q('at');
const CY = q('cy');

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

// ----- Umgebung (vereinfachte Kulisse der Strandzone) -----
const world = new THREE.Group();
scene.add(world);
const grass = toonMesh(new THREE.PlaneGeometry(520, 520), 0x5fc74a, { outline: 0, shadow: false });
grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; grass.userData.noFade = true; world.add(grass);
const sand = toonMesh(new THREE.PlaneGeometry(520, 60), 0xf7d984, { outline: 0, shadow: false });
sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, 15); sand.receiveShadow = true; sand.userData.noFade = true; world.add(sand);
// Hügel wie in world.js (Kuppe im Nordwesten, Kokoshain im Nordosten)
const hillGeo = new THREE.SphereGeometry(1, 28, 16);
hillGeo.scale(44, 14, 30);
const hill = toonMesh(hillGeo, 0x3f9d37, { outline: 0.12 });
hill.position.set(-45, -2, -52); hill.userData.noFade = true; world.add(hill);
const hill2Geo = hillGeo.clone(); hill2Geo.scale(0.6, 0.5, 0.7);
const hill2 = toonMesh(hill2Geo, 0x4cae3c, { outline: 0.12 });
hill2.position.set(88, -2, -62); // Kokoshain hinter die Bühnenkante (Markt liegt davor) hill2.userData.noFade = true; world.add(hill2);
const mentor = hut({ w: 3, h: 2.4, d: 2.6, lean: 0.35, wall: 0x8b5a2b, straw: true, seed: 8 });
mentor.position.set(-45, 11.5, -52); mentor.rotation.y = 0.4; mentor.scale.setScalar(buildingScale('mentor')); world.add(mentor);
world.add(hedge(-66, 66, -25.5, { gapFrom: -4, gapTo: 4, seed: 3 }));

// ----- Dorf -----
const colliders = [];
const dorf = buildDorf(world, colliders, { exits: { markt: false, posten: false } });
const markt = buildMarkt(world, colliders);
world.updateMatrixWorld(true);
{
  const box = new THREE.Box3(), sph = new THREE.Sphere();
  for (const o of world.children) {
    if (o.userData.noFade) continue;
    box.setFromObject(o);
    if (box.isEmpty()) continue;
    box.getBoundingSphere(sph);
    o.userData.sphere = sph.clone();
  }
}

const player = schluffi();
scene.add(player);
const P = player.userData.parts;
const WORLD = { minX: -66, maxX: 66, minZ: markt.bounds.minZ };

const spots = { ...dorf.spots, ...markt.spots, overview: { x: 14, z: -48, yaw: Math.PI }, marktoben: { x: 51, z: -51 }, postenoben: { x: 8, z: -84 } };
const startSpot = spots[AT] || spots.dorf;
let state = { x: startSpot.x, z: startSpot.z, yaw: startSpot.yaw, phase: 0, speed: 0 };
let camYaw = DEFAULT_CAM_YAW + (CY ? parseFloat(CY) * Math.PI / 180 : 0);
let cam = { x: state.x, y: CAM_OFFSET.up, z: state.z - CAM_OFFSET.back, tx: state.x, ty: CAM_OFFSET.targetY, tz: state.z };

const keys = { up: false, down: false, left: false, right: false, run: false, rotL: false, rotR: false };
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run', KeyQ: 'rotL', KeyE: 'rotR' };
window.addEventListener('keydown', (e) => { const k = KEYMAP[e.code]; if (k) { keys[k] = true; e.preventDefault(); } });
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function applyPose(st) {
  player.position.set(st.x, 0, st.z);
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
  camera.position.set(cam.x, cam.y, cam.z);
  camera.lookAt(cam.tx, cam.ty, cam.tz);
  sunLight.position.set(state.x + 20, 40, state.z + 14);
  sunLight.target.position.set(state.x, 0, state.z);
}

// Verdeckung: Props zwischen Kamera und Spieler (Kopf- und Kniehöhe) werden durchsichtig
const faded = new Map();
const ray = new THREE.Raycaster();
const tmp = new THREE.Vector3();
function fadeMesh(m) {
  if (faded.has(m) || !m.isMesh) return;
  const orig = m.material; faded.set(m, orig);
  const mats = (Array.isArray(orig) ? orig : [orig]).map((mat) => {
    const c = mat.clone(); c.transparent = true;
    if (c.isShaderMaterial) c.uniforms.opacity.value = 0.25; else c.opacity = 0.25;
    c.depthWrite = false; return c;
  });
  m.material = Array.isArray(orig) ? mats : mats[0];
}
function updateFade() {
  const keep = new Set(), groups = new Set();
  const candidates = world.children.filter((o) => o.userData.sphere);
  for (const h of [2.5, 0.8]) {
    const target = tmp.set(state.x, h, state.z);
    const dist = camera.position.distanceTo(target);
    ray.set(camera.position, target.clone().sub(camera.position).normalize());
    ray.far = dist - 0.8;
    const near = candidates.filter((o) => ray.ray.intersectsSphere(o.userData.sphere));
    for (const hit of ray.intersectObjects(near, true)) {
      let o = hit.object;
      while (o.parent && o.parent !== world) o = o.parent;
      groups.add(o);
    }
  }
  // direkt vor der Linse: Mesh-Kugel nahe an der Kamera
  const sph = new THREE.Sphere();
  for (const o of candidates) {
    if (groups.has(o)) continue;
    o.traverse((m) => {
      if (groups.has(o) || !m.isMesh || !m.geometry.boundingSphere) return;
      sph.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld);
      if (sph.distanceToPoint(camera.position) < 2.5) groups.add(o);
    });
  }
  for (const g of groups) g.traverse((m) => { if (m.isMesh) { fadeMesh(m); keep.add(m); } });
  for (const [m, orig] of faded) {
    if (keep.has(m)) continue;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((c) => c.dispose());
    m.material = orig; faded.delete(m);
  }
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, true);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

if (SNAP) {
  applyPose(state);
  for (let i = 0; i < 300; i++) cam = followCamera(cam, state, 1 / 60, camYaw);
  markt.update(parseFloat(q('t') || '1.2'));
  if (AT === 'overview') cam = { x: 16, y: 62, z: 8, tx: 14, ty: 0, tz: -50 };
  if (AT === 'marktoben') cam = { x: 51, y: 34, z: -22, tx: 51, ty: 0, tz: -52 };
  if (AT === 'postenoben') cam = { x: 14, y: 26, z: -62, tx: 6, ty: 0, tz: -86 };
  applyCamera();
  camera.updateMatrixWorld();
  world.updateMatrixWorld(true);
  if (!['overview', 'marktoben', 'postenoben'].includes(AT)) updateFade();
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
    markt.update(now / 1000);
    cam = followCamera(cam, state, dt, camYaw);
    applyCamera();
    camera.updateMatrixWorld();
    updateFade();
    renderer.render(scene, camera);
  });
}
