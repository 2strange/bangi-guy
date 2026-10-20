// main.js — Szene, Kamera, Licht, Snap-Modus (?snap=1: einmal rendern, keine Schleife).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildIsland, WATER_Y } from './island.js';
import { palm, hut, beachBar, pier, boat, mailbox, signpost, hammock, parasol, beachBall, coconut, crab, cloud, sun, limb, footprints } from './props.js';
import { figure, nameTag } from './figures.js';

const SNAP = /[?&]snap=1/.test(location.search);
const VIEW = window.BANGI_VIEW || (location.search.match(/view=([a-z]+)/) || [])[1] || 'start';

const VIEWS = {
  start: { pos: [0.2, 6.1, 16.8], target: [0.2, 1.7, 0.3] },
  shoes: { pos: [0.1, 1.9, 10.6], target: [0.05, 0.55, 5.3] },
  faces: { pos: [0.1, 3.0, 10.9], target: [0.05, 2.6, 5.3] },
  side: { pos: [-16, 6, 10], target: [0, 1, 0] },
};

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: SNAP });
renderer.setPixelRatio(SNAP ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fe0ff);

const camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 500);
const view = VIEWS[VIEW] || VIEWS.start;
camera.position.fromArray(view.pos);

// Licht: eine Sonne (harte Toon-Stufen + Schatten) + Hemisphäre als flache Grundhelligkeit
const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.9);
sunLight.position.set(9, 16, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
const sc = sunLight.shadow.camera;
sc.left = -17; sc.right = 17; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 60;
sunLight.shadow.bias = -0.0006;
sunLight.shadow.normalBias = 0.03;
scene.add(sunLight, sunLight.target);
scene.add(new THREE.HemisphereLight(0xcfeeff, 0xd9b27a, 0.75));

// ---------- Szene ----------
scene.add(buildIsland());

// Palmen (Position, Neigung, Seed)
const palms = [
  [[-10.2, 0, 0.3], [1.3, 0, 0.5], 1],
  [[-6.3, 0, 4.6], [-0.8, 0, 0.6], 2],
  [[8.8, 0, 2.4], [1.0, 0, 0.8], 3],
  [[10.2, 0, -4.0], [0.6, 0, -0.9], 4],
  [[3.4, 0, -8.6], [-1.2, 0, -0.4], 5],
  [[-7.0, 2.3, -6.4], [0.9, 0, 0.7], 6],
];
const palmObjs = palms.map(([p, l, s]) => {
  const o = palm({ lean: new THREE.Vector3(...l), seed: s, height: 4.2 + s * 0.15 });
  o.position.set(...p);
  scene.add(o);
  return o;
});

// Hängematte zwischen Palme 1 und 2 (Stammpunkte bei ~40 % Höhe)
{
  const a = palmObjs[0].userData.curve.getPointAt(0.42).add(palmObjs[0].position);
  const b = palmObjs[1].userData.curve.getPointAt(0.42).add(palmObjs[1].position);
  scene.add(hammock(a, b));
}

// Hütten + Bar
const hutA = hut({ w: 2.8, h: 2.4, d: 2.6, lean: 0.45, wall: 0xd8a85a, straw: true, stilts: 1.3, door: 0x5a3b1a, seed: 2 });
hutA.position.set(-6.2, 0, -2.2);
hutA.rotation.y = 0.5;
scene.add(hutA);
const hutB = hut({ w: 3.0, h: 2.7, d: 2.6, lean: -0.5, wall: 0xf08ac4, roofColor: 0x2fa9b9, door: 0x4a2e1a, seed: 3 });
hutB.position.set(6.4, 0, -3.2);
hutB.rotation.y = -0.55;
scene.add(hutB);
const bar = beachBar();
bar.position.set(0.3, 0, -3.6);
bar.rotation.y = 0.08;
scene.add(bar);

// Steg nach vorne rechts ins Wasser + Boot
const pierObj = pier({ length: 8.2 });
pierObj.position.set(6.3, 0, 6.2);
pierObj.rotation.y = -0.25;
scene.add(pierObj);
const boatObj = boat();
boatObj.position.set(9.6, WATER_Y + 0.05, 13.0);
boatObj.rotation.set(0.04, 0.9, 0.06);
scene.add(boatObj);
scene.add(limb(new THREE.Vector3(8.2, 0.9, 13.6), new THREE.Vector3(9.0, WATER_Y + 0.4, 12.6), 0.025, 0xfff1c2, { outline: 0.012 }));

// Kleinkram
const mb = mailbox(); mb.position.set(4.4, 0, 6.6); mb.rotation.y = 0.4; scene.add(mb);
const sp = signpost(); sp.position.set(-4.2, 0, 7.6); sp.rotation.y = 0.1; scene.add(sp);
const ps = parasol(); ps.position.set(-4.2, 0, 2.6); scene.add(ps);
const ball = beachBall(); ball.position.set(-5.6, 0.42, 8.9); scene.add(ball);
const cn1 = coconut(); cn1.position.set(3.0, 0, 7.5); cn1.rotation.z = 0.4; scene.add(cn1);
const cn2 = coconut(); cn2.position.set(3.6, 0, 7.8); cn2.rotation.z = -0.9; scene.add(cn2);
const cr = crab(); cr.position.set(-2.3, 0, 7.0); cr.rotation.y = -1.2; scene.add(cr);
// Fußspuren: Turnschuh kommt vom Steg, Sandalen von der Hängematte
scene.add(footprints('sneaker', new THREE.Vector3(6.2, 0, 7.6), new THREE.Vector3(3.2, 0, 6.2), 5));
scene.add(footprints('sandal', new THREE.Vector3(-7.2, 0, 3.4), new THREE.Vector3(-3.4, 0, 4.9), 5));

// Die zwei Figuren: Schluffi (Sandalen) links, Turnschuh-Typ rechts
const slob = figure('schluffi');
slob.position.set(-1.95, 0, 5.2);
slob.rotation.y = 0.28;
scene.add(slob);
const runner = figure('sneaker');
runner.position.set(2.05, 0, 5.3);
runner.rotation.y = -0.3;
scene.add(runner);

// Himmel
const s = sun(); s.position.set(14.5, 8.3, -31); s.rotation.y = -0.3; s.scale.setScalar(1.35); scene.add(s);
const c1 = cloud(1); c1.position.set(-18, 8.5, -34); c1.rotation.y = 0.3; scene.add(c1);
const c2 = cloud(2); c2.position.set(2, 10, -40); scene.add(c2);
const c3 = cloud(3); c3.position.set(24, 7.5, -26); c3.rotation.y = -0.5; scene.add(c3);

// ---------- Kamera / Controls ----------
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.fromArray(view.target);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 3;
controls.maxDistance = 60;
controls.update();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, true);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
function render() { renderer.render(scene, camera); }

if (SNAP) {
  // Einmal rendern, keine Schleife. Größe erst NACH load setzen (Headless meldet vorher zu klein).
  const shoot = () => { resize(); render(); requestAnimationFrame(() => { resize(); render(); }); };
  if (document.readyState === 'complete') shoot(); else window.addEventListener('load', shoot);
  window.addEventListener('resize', () => { resize(); render(); });
} else {
  resize();
  window.addEventListener('resize', resize);
  renderer.setAnimationLoop(() => { controls.update(); render(); });
}
