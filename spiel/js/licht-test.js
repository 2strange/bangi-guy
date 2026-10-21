// licht-test.js — Tagesablauf-Streifen: vier Tageszeiten nebeneinander in einem Bild (Morgen, Mittag,
// Sonnenuntergang, Nacht), jeweils Strand mit Bar + Lichterkette, Laternen, Hütte, Sonne/Mond, Mentor am Tresen.
// ?t=0.74 zeigt eine einzelne Tageszeit bildfüllend.
import * as THREE from 'three';
import { toonMesh } from './toon.js';
import { beachBar, lamp, hut, sun, palm } from './props.js';
import { schluffi } from './figures.js';
import { mentor, mentorBarSpot } from './zone-huegel.js';
import { pose } from './figures.js';
import { initLicht, lichterkette } from './licht.js';
import { BUILDING_POS, buildingScale } from './logic.js';

const q = (name) => (location.search.match(new RegExp('[?&]' + name + '=([-a-z0-9.]+)')) || [])[1];
const SINGLE = q('t') ? parseFloat(q('t')) : null;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
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

const sand = toonMesh(new THREE.PlaneGeometry(520, 520), 0xf7d984, { outline: 0, shadow: false });
sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true; scene.add(sand);
const sea = toonMesh(new THREE.PlaneGeometry(520, 200), 0x1d9be6, { outline: 0, shadow: false });
sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.06, 114); scene.add(sea);
const grass = toonMesh(new THREE.PlaneGeometry(520, 100), 0x5fc74a, { outline: 0, shadow: false });
grass.rotation.x = -Math.PI / 2; grass.position.set(0, 0.02, -62); grass.receiveShadow = true; scene.add(grass);

// Bar mit Lichterkette, Laternen, Hütte, Palmen, Sonne, Figuren
const barPos = BUILDING_POS.bar, bs = buildingScale('bar');
const bar = beachBar(); bar.position.set(barPos.x, 0, barPos.z); bar.scale.setScalar(bs); scene.add(bar);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const kette = lichterkette([V(barPos.x - 2.3 * bs, 3.3 * bs, barPos.z + 1.2 * bs), V(barPos.x, 3.5 * bs, barPos.z + 1.5 * bs), V(barPos.x + 2.3 * bs, 3.3 * bs, barPos.z + 1.2 * bs), V(barPos.x + 3.6 * bs, 2.6 * bs, barPos.z + 3.4 * bs)]);
scene.add(kette);
for (const x of [-42, -14]) { const l = lamp(); l.position.set(x, 0, -12.6); l.scale.setScalar(1.4); scene.add(l); }
const h = hut({ w: 3.2, h: 3.0, d: 3.0, lean: 0.4, wall: 0xf08ac4, roofColor: 0x2fa9b9, seed: 2 }); h.position.set(-12, 0, -24); h.rotation.y = 0.4; h.scale.setScalar(2.1); scene.add(h);
for (const [x, z, l, s] of [[-40, 2, [1.1, 0, 0.5], 4], [-16, 4, [-0.8, 0, 0.7], 5]]) { const p = palm({ lean: V(...l), seed: s }); p.position.set(x, 0, z); p.scale.setScalar(1.4); scene.add(p); }
const sonne = sun(); sonne.scale.setScalar(5); sonne.userData.noFade = true; scene.add(sonne);
const player = schluffi(); player.position.set(-24, 0, 1); player.rotation.y = 2.6; scene.add(player);
const m = mentor(); m.scale.setScalar(0.95); scene.add(m);
{ const b = mentorBarSpot(); const { offsetY } = pose(m, 'sitzen'); m.position.set(b.x, b.y + offsetY, b.z); m.rotation.y = b.yaw; m.userData.parts.hoe.visible = false; m.userData.parts.can.visible = false; m.userData.parts.arms[1].rotation.x = -1.2; }

const licht = initLicht(scene, { sonne });
const CAM = { pos: V(-25, 11, 18), look: V(-27, 2.5, -4) };
const times = SINGLE !== null ? [SINGLE] : [0.25, 0.5, 0.74, 0.95];

function render() {
  const W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H, true);
  renderer.setScissorTest(true);
  const n = times.length, pw = Math.floor(W / n);
  times.forEach((t, i) => {
    licht.set(t);
    const o = licht.sunOffset(t);
    sunLight.position.set(player.position.x + o.x, o.y, player.position.z + o.z);
    sunLight.target.position.copy(player.position);
    sunLight.target.updateMatrixWorld();
    camera.aspect = pw / H; camera.updateProjectionMatrix();
    camera.position.copy(CAM.pos); camera.lookAt(CAM.look);
    renderer.setViewport(i * pw, 0, pw, H); renderer.setScissor(i * pw, 0, pw, H);
    renderer.render(scene, camera);
  });
  renderer.setScissorTest(false);
}
const shoot = () => { render(); requestAnimationFrame(render); };
if (document.readyState === 'complete') shoot(); else window.addEventListener('load', shoot);
window.addEventListener('resize', shoot);
