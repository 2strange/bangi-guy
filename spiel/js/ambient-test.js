// ambient-test.js — Standbild der Ambient-Figuren (ambient.js), t über ?t= (Sekunden).
// ?what=kinder   → drei Kinder: rennend mit Wasserpistole, spritzend, mit Eis fragend
// ?what=paar     → streitendes Ehepaar (Streit · Pause · Umarmung)
// ?what=steg     → Influencerin mit Blitz und Reflektor-Freund, daneben der Betrunkene
// ?what=liegen   → Liegen mit Handtuch-Reservierung, fliegende Handtuchrolle, Betrunkener schlafend
// ?what=pong     → Pong wach und schlafend (Mütze über den Augen)
import * as THREE from 'three';
import { toonMesh } from './toon.js';
import { lounger } from './props.js';
import { buildKind, buildEhepaar, buildInfluencerin, buildBetrunkener, handtuchAufLiege, handtuchRolle, HANDTUCH_FARBEN } from './ambient.js';
import { pong, setPongSchlaeft, updatePongSchlaf } from './zone-markt.js';

const q = (name) => (location.search.match(new RegExp('[?&]' + name + '=([-a-z0-9.]+)')) || [])[1];
const WHAT = q('what') || 'kinder';
const T = parseFloat(q('t') || '1.3');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fe0ff);
const camera = new THREE.PerspectiveCamera(40, 1.6, 0.1, 200);
const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.9);
sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048);
const sc = sunLight.shadow.camera; sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 80;
sunLight.shadow.bias = -0.0006; sunLight.shadow.normalBias = 0.03;
sunLight.position.set(8, 20, 10); scene.add(sunLight, sunLight.target);
scene.add(new THREE.HemisphereLight(0xcfeeff, 0xd9b27a, 0.75));
const sand = toonMesh(new THREE.PlaneGeometry(200, 200), 0xf7d984, { outline: 0, shadow: false });
sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true; scene.add(sand);

if (WHAT === 'kinder') {
  const a = buildKind({ seed: 1, item: 'wasserpistole' }); a.position.set(-2.4, 0, 0); a.rotation.y = 0.4; a.userData.update(T, { rennt: true }); scene.add(a);
  const b = buildKind({ seed: 2, item: 'wasserpistole' }); b.position.set(0, 0, 0.3); b.rotation.y = -0.3; b.userData.update(T, { rennt: false, spritzt: true }); scene.add(b);
  const c = buildKind({ seed: 3, item: 'eis' }); c.position.set(2.4, 0, 0); c.userData.pose('fragen'); c.userData.update(T, { rennt: false }); c.userData.pose('fragen'); scene.add(c);
  camera.position.set(0, 1.6, 6.2); camera.lookAt(0, 0.8, 0);
} else if (WHAT === 'paar') {
  [[-4.6, 'streit'], [0, 'pause'], [4.6, 'umarmung']].forEach(([x, zustand]) => {
    const p = buildEhepaar(); p.gruppe.position.set(x, 0, 0);
    if (zustand === 'pause') p.setStreit(false); if (zustand === 'umarmung') p.setVersoehnt(true);
    p.update(T); scene.add(p.gruppe);
  });
  camera.position.set(0, 3.2, 11); camera.lookAt(0, 1.4, 0);
} else if (WHAT === 'steg') {
  const inf = buildInfluencerin(); inf.gruppe.position.set(-2.2, 0, 0); inf.update(1.4); scene.add(inf.gruppe); // u = 0.583: Blitz an
  const bet = buildBetrunkener(); bet.position.set(3.2, 0, 0.5); bet.rotation.y = -0.3; bet.userData.update(T); scene.add(bet);
  camera.position.set(0.5, 3.0, 9.5); camera.lookAt(0.5, 1.4, 0);
} else if (WHAT === 'liegen') {
  [0, 1, 2].forEach((i) => {
    const lo = lounger(i % 2 ? ['#3a7bd5', '#ffffff'] : ['#e8463a', '#fff5e0']); lo.position.set(-4.5 + i * 3.2, 0, 0); lo.rotation.y = 0.2 - i * 0.15; lo.scale.setScalar(1.3); scene.add(lo);
    if (i < 2) handtuchAufLiege(lo, HANDTUCH_FARBEN[(i + 2) % 4]);
  });
  const r = handtuchRolle(HANDTUCH_FARBEN[3]); r.position.set(2.2, 2.4, 1.2); r.userData.update(0.3); scene.add(r);
  const bet = buildBetrunkener(); bet.userData.setSchlaeft(true); bet.position.set(4.6, 0.5, 1.5); bet.rotation.y = 0.4; bet.userData.update(T); scene.add(bet);
  camera.position.set(0, 4.5, 10); camera.lookAt(0, 0.8, 0);
} else if (WHAT === 'pong') {
  const a = pong(); a.position.set(-1.8, 0, 0); a.rotation.y = 0.2; scene.add(a);
  const b = pong(); b.position.set(1.8, 0, 0); b.rotation.y = -0.2; setPongSchlaeft(b, true); updatePongSchlaf(b, T); scene.add(b);
  camera.position.set(0, 2.6, 7.5); camera.lookAt(0, 1.8, 0);
}

function shoot() {
  renderer.setSize(window.innerWidth, window.innerHeight, true);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  requestAnimationFrame(() => renderer.render(scene, camera));
}
if (document.readyState === 'complete') shoot(); else window.addEventListener('load', shoot);
window.addEventListener('resize', shoot);
