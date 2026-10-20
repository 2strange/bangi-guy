// main.js — Szene, Eingabe, Spielschleife, Folge-Kamera, prozedurales Watscheln, Snap-Modus.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { schluffi, runner } from './figures.js';
import {
  inputToDir, dirToTarget, stepPlayer, followCamera, waddlePose, npcHeadYaw, CAM_OFFSET, DEFAULT_CAM_YAW,
} from './logic.js';

// Parameter per Regex, weil der Screenshot-Aufruf „?snap=1“ hinter andere Parameter hängt (…?at=bar?snap=1)
const q = (name) => (location.search.match(new RegExp('[?&]' + name + '=([-a-z0-9.]+)')) || [])[1];
const SNAP = q('snap') === '1';
const STATS = q('stats') === '1';
const AT = q('at');
const CY = q('cy'); // Kamera-Gierung in Grad relativ zum Standard, z. B. ?at=hotel&cy=-90 (Kamera im Osten, Blick nach Westen)

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: SNAP });
renderer.setPixelRatio(SNAP ? 1 : Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fe0ff);
scene.fog = new THREE.Fog(0x9fe6ff, 70, 230);

const camera = new THREE.PerspectiveCamera(44, 1.6, 0.5, 600);

// Licht: Sonne mit Schatten, die mit dem Spieler mitwandert (kleine, scharfe Schattenkarte)
const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.9);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
const sc = sunLight.shadow.camera;
sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 120;
sunLight.shadow.bias = -0.0006;
sunLight.shadow.normalBias = 0.03;
scene.add(sunLight, sunLight.target);
scene.add(new THREE.HemisphereLight(0xcfeeff, 0xd9b27a, 0.75));

// Welt + Figuren
const world = buildWorld();
scene.add(world.group);
const colliders = world.colliders.slice();

const player = schluffi();
scene.add(player);
const P = player.userData.parts;

const npc = runner();
const NPC = { x: 10, z: 1, yaw: 2.6 };
npc.position.set(NPC.x, 0, NPC.z);
npc.rotation.y = NPC.yaw;
scene.add(npc);
colliders.push({ x: NPC.x, z: NPC.z, r: 0.7 });

// ---------- Zustand ----------
const startSpot = world.spots[AT] || world.spots.start;
let state = { x: startSpot.x, z: startSpot.z, yaw: startSpot.yaw, phase: 0, speed: 0 };
let camYaw = DEFAULT_CAM_YAW + (CY ? parseFloat(CY) * Math.PI / 180 : 0);
let cam = { x: state.x, y: CAM_OFFSET.up, z: state.z - CAM_OFFSET.back, tx: state.x, ty: CAM_OFFSET.targetY, tz: state.z };
let clickTarget = null;
let npcHead = 0;

// ---------- Eingabe ----------
const keys = { up: false, down: false, left: false, right: false, run: false, rotL: false, rotR: false };
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run', KeyQ: 'rotL', KeyE: 'rotR',
};
window.addEventListener('keydown', (e) => { const k = KEYMAP[e.code]; if (k) { keys[k] = true; clickTarget = null; e.preventDefault(); } });
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// Klick auf den Boden = hinlaufen
const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(groundPlane, hit)) clickTarget = { x: hit.x, z: hit.z };
});

// ---------- Pose anwenden ----------
function applyPose(st) {
  player.position.set(st.x, 0, st.z);
  player.rotation.y = st.yaw;
  const pose = waddlePose(st.phase, st.speed, st.running);
  P.legs[0].rotation.x = pose.legL;
  P.legs[1].rotation.x = pose.legR;
  // Sandale flappt: Ferse hebt sich, wenn das Bein nach hinten schwingt
  P.legs[0].children[2].rotation.x = Math.max(0, pose.legL) * 0.9;
  P.legs[1].children[2].rotation.x = Math.max(0, pose.legR) * 0.9;
  P.arms[0].rotation.x = pose.armL;
  P.arms[1].rotation.x = pose.armR * 0.4;
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

// ---------- Verdeckung: was zwischen Kamera und Spieler steht (oder direkt vor der Linse), wird durchsichtig ----------
// Materialien sind pro Farbe geteilt, deshalb bekommt jedes betroffene Mesh beim Ausblenden eine eigene Kopie.
const faded = new Map(); // mesh -> Originalmaterial
const fadeRay = new THREE.Raycaster();
const tmpV = new THREE.Vector3();
const tmpSphere = new THREE.Sphere();
const FADE_OPACITY = 0.25;
function fadeMesh(m) {
  if (faded.has(m) || !m.isMesh) return;
  const orig = m.material;
  faded.set(m, orig);
  const mats = Array.isArray(orig) ? orig : [orig];
  const clones = mats.map((mat) => {
    const c = mat.clone();
    c.transparent = true;
    if (c.isShaderMaterial) c.uniforms.opacity.value = FADE_OPACITY; else c.opacity = FADE_OPACITY;
    c.depthWrite = false;
    return c;
  });
  m.material = Array.isArray(orig) ? clones : clones[0];
}
function unfadeAll(keep) {
  for (const [m, orig] of faded) {
    if (keep.has(m)) continue;
    const cur = Array.isArray(m.material) ? m.material : [m.material];
    cur.forEach((c) => c.dispose());
    m.material = orig;
    faded.delete(m);
  }
}
function updateFade() {
  const camPos = camera.position;
  const target = tmpV.set(state.x, 1.4, state.z);
  const dist = camPos.distanceTo(target);
  fadeRay.set(camPos, target.clone().sub(camPos).normalize());
  fadeRay.far = dist - 0.8;
  const keep = new Set();
  // Kandidaten: Props in der Nähe des Spielers oder der Kamera (Boden/Wasser sind per noFade ausgenommen)
  const candidates = [];
  for (const o of world.group.children) {
    if (o.userData.noFade) continue;
    const d = Math.min(o.position.distanceTo(target), o.position.distanceTo(camPos));
    if (d < 30) candidates.push(o);
  }
  const hits = fadeRay.intersectObjects(candidates, true);
  const groups = new Set();
  for (const h of hits) {
    let o = h.object;
    while (o.parent && o.parent !== world.group) o = o.parent;
    groups.add(o);
  }
  // direkt vor der Linse: Bounding-Sphere des Meshes nahe an der Kamera
  for (const o of candidates) {
    if (groups.has(o)) continue;
    o.traverse((m) => {
      if (groups.has(o) || !m.isMesh || !m.geometry.boundingSphere) return;
      tmpSphere.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld);
      if (tmpSphere.distanceToPoint(camPos) < 2.5) groups.add(o);
    });
  }
  for (const grp of groups) grp.traverse((m) => { if (m.isMesh) { fadeMesh(m); keep.add(m); } });
  unfadeAll(keep);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, true);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

const hint = document.getElementById('hint');
function stats() {
  if (!hint || !STATS) return;
  const r = renderer.info.render;
  hint.textContent = `calls ${r.calls} · tris ${r.triangles} · ${Math.round(1000 / Math.max(1, frameMs))} fps`;
}
let frameMs = 16;

// ---------- Snap: einmal rendern an fester Stelle ----------
if (SNAP) {
  const overview = AT === 'overview';
  applyPose(state);
  npc.userData.parts.head.rotation.y = npcHeadYaw(NPC, state);
  for (let i = 0; i < 300; i++) cam = followCamera(cam, state, 1 / 60, camYaw);
  if (overview) cam = { x: 0, y: 78, z: -74, tx: 0, ty: 0, tz: 10 };
  applyCamera();
  camera.updateMatrixWorld();
  world.group.updateMatrixWorld(true);
  updateFade();
  const shoot = () => { resize(); renderer.render(scene, camera); requestAnimationFrame(() => { resize(); renderer.render(scene, camera); }); };
  if (document.readyState === 'complete') shoot(); else window.addEventListener('load', shoot);
  window.addEventListener('resize', shoot);
} else {
  resize();
  window.addEventListener('resize', resize);
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    frameMs = now - last;
    last = now;
    if (keys.rotL) camYaw += 1.5 * dt;
    if (keys.rotR) camYaw -= 1.5 * dt;
    let dir = inputToDir(keys, camYaw);
    if (dir.x === 0 && dir.z === 0 && clickTarget) {
      dir = dirToTarget(state, clickTarget);
      if (!dir) clickTarget = null;
    }
    state = stepPlayer(state, { dir, run: keys.run }, dt, colliders);
    applyPose(state);
    // NPC schaut misstrauisch hinterher
    const want = npcHeadYaw(NPC, state);
    npcHead += (want - npcHead) * (1 - Math.exp(-3 * dt));
    npc.userData.parts.head.rotation.y = npcHead;
    cam = followCamera(cam, state, dt, camYaw);
    applyCamera();
    camera.updateMatrixWorld();
    updateFade();
    renderer.render(scene, camera);
    stats();
  });
}
