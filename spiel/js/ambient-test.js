// ambient-test.js — Standbild der Ambient-Figuren (ambient.js) mit den Posen aus data/szenen.json, t über ?t= (Sekunden).
// ?what=kinder → kind_1 rennen_kreis · kind_2 flipflop_verlieren · kind_3 eimer_kippen · kaputte Sandburg
// ?what=liegen → Ehepaar in drei Pose-Paaren (handy_hochhalten/dose_heben · zeitschrift_rollen/schnorchel_runter ·
//                hinterherrufen/zurueckkommen_nass) · Handtuch-Werfer (handtuch_werfen · zaehlen) an Liegen mit Handtüchern
// ?what=strand → Chad (an_tresen_lehnen · kippen_fangen · moewe_anreden · einschlafen_tresen) · Influencerin (pose_steg · foto)
//                mit Reflektor-Freund (reflektor_heben · blick_ins_meer) und Stativ
// ?what=pong   → Pong am Pausentisch: fuesse_hoch · schnarchen · aufwachen
// ?what=dieb   → Dieb (schleichen · greifen mit Tasche · rennen mit Kamera), Schläferin auf der Liege (schlafen · aufschrecken), Tourist (fotografieren · aufschrecken)
// ?what=paar   → das Ehepaar von vorn: drei Pose-Paare, beide leicht zur Kamera gedreht
import * as THREE from 'three';
import { toonMesh, BLACK } from './toon.js';
import { lounger, limb } from './props.js';
import { buildAmbientFigur, handtuchAufLiege, handtuchRolle, HANDTUCH_FARBEN, sandburgKaputt, bierdosenHaufen, stativ, handtasche } from './ambient.js';
import { pose } from './figures.js';
import { pong, pongPose, updatePongPose } from './zone-markt.js';

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

// Figur an Ort x/z mit Blick yaw, Pose name bei Fortschritt u (0…1): Posenstart so gelegt, dass update(T) genau u trifft
function stelle(fig, x, z, yaw, name = null, u = 0.5, dauer = 4) {
  fig.position.set(x, 0, z); fig.rotation.y = yaw;
  if (name) fig.userData.pose(name, T - u * dauer, dauer);
  fig.userData.update(T);
  scene.add(fig);
  return fig;
}

if (WHAT === 'kinder') {
  stelle(buildAmbientFigur('kind_1'), -2.6, 0, 0.4, 'rennen_kreis', 0.5);
  stelle(buildAmbientFigur('kind_2'), 0, 0.2, 0.3, 'flipflop_verlieren', 0.45, 3);
  stelle(buildAmbientFigur('kind_3'), 2.6, 0, -0.2, 'eimer_kippen', 0.6, 3);
  const sb = sandburgKaputt(); sb.position.set(4.8, 0, 1.6); sb.scale.setScalar(0.6); scene.add(sb);
  camera.position.set(1.0, 1.9, 8.5); camera.lookAt(1.0, 0.8, 0);
} else if (WHAT === 'liegen') {
  const paare = [['handy_hochhalten', 'dose_heben'], ['zeitschrift_rollen', 'schnorchel_runter'], ['hinterherrufen', 'zurueckkommen_nass']];
  paare.forEach(([ps, pe], i) => {
    const x = -7 + i * 4.2;
    stelle(buildAmbientFigur('ehe_sie'), x - 0.9, 0.6, 0.9, ps, i === 1 ? 0.3 : 0.5);
    stelle(buildAmbientFigur('ehe_er'), x + 0.9, 0.6, -0.9, pe, i === 2 ? 0.3 : 0.5);
  });
  [0, 1].forEach((i) => { const lo = lounger(HANDTUCH_FARBEN[i]); lo.position.set(5.2 + i * 2.4, 0, -1.5); lo.scale.setScalar(1.3); scene.add(lo); if (i === 0) handtuchAufLiege(lo, HANDTUCH_FARBEN[2]); });
  stelle(buildAmbientFigur('werfer_1'), 6.2, 2.6, 2.8, 'handtuch_werfen', 0.3, 3);
  stelle(buildAmbientFigur('werfer_2'), 8.4, 2.6, 2.6, 'zaehlen', 0.5);
  const r = handtuchRolle(HANDTUCH_FARBEN[1]); r.position.set(7.4, 2.2, 0.3); r.userData.update(0.3); scene.add(r);
  camera.position.set(1.0, 4.0, 19); camera.lookAt(1.0, 1.2, 0);
} else if (WHAT === 'strand') {
  const tresen = toonMesh(new THREE.BoxGeometry(5.5, 1.05, 0.8), 0xc47a3a, { outline: 0.05 }); tresen.position.set(-5, 0.52, -0.9); scene.add(tresen);
  ['an_tresen_lehnen', 'kippen_fangen', 'moewe_anreden', 'einschlafen_tresen'].forEach((p, i) => stelle(buildAmbientFigur('chad'), -7.4 + i * 1.7, 0, 0.15, p, p === 'einschlafen_tresen' ? 0.8 : 0.45));
  const h = bierdosenHaufen(); h.position.set(-3.2, 0, 0.9); scene.add(h);
  stelle(buildAmbientFigur('influencerin'), 1.6, 0, Math.PI + 0.4, 'pose_steg', 0.5);
  stelle(buildAmbientFigur('influencerin'), 3.6, 0, Math.PI - 0.4, 'foto', 0.19);
  stelle(buildAmbientFigur('reflektor_freund'), 6.0, 0.8, -0.4, 'reflektor_heben', 0.7);
  stelle(buildAmbientFigur('reflektor_freund'), 8.4, 0.8, -0.6, 'blick_ins_meer', 0.6, 5);
  const st = stativ(); st.position.set(4.9, 0, 1.6); scene.add(st);
  camera.position.set(0.8, 3.6, 17); camera.lookAt(0.8, 1.3, 0);
} else if (WHAT === 'dieb') {
  stelle(buildAmbientFigur('dieb'), -6.5, 0, 0.5, 'schleichen', 0.4, 5);
  const d2 = buildAmbientFigur('dieb'); d2.userData.setBeute('tasche'); stelle(d2, -4.0, 0, 0.2, 'greifen', 0.8, 2);
  const d3 = buildAmbientFigur('dieb'); d3.userData.setBeute('kamera'); stelle(d3, -1.6, 0, -0.4, 'rennen', 0.5, 6);
  [['schlafen', 1.2], ['aufschrecken', 4.2]].forEach(([p, x], i) => {
    const lo = lounger(HANDTUCH_FARBEN[i]); lo.position.set(x, 0, 0.4); lo.rotation.y = 0.2; lo.scale.setScalar(1.3); scene.add(lo);
    const f = buildAmbientFigur('schlaeferin'); const { offsetY, offsetZ } = pose(f, 'liegestuhl');
    const sitz = new THREE.Vector3(lo.userData.sitz.x, lo.userData.sitz.y, lo.userData.sitz.z); lo.localToWorld(sitz);
    f.position.set(sitz.x + Math.sin(0.2) * offsetZ, sitz.y + offsetY, sitz.z + Math.cos(0.2) * offsetZ); f.rotation.y = 0.2;
    f.userData.pose(p, T - 0.5 * 3, 3); f.userData.update(T); scene.add(f);
    const ht = handtasche(); ht.position.set(x - 1.1, 0, 1.2); ht.rotation.y = 0.5; scene.add(ht);
  });
  stelle(buildAmbientFigur('tourist_kamera'), 7.0, 0, 0.3, 'fotografieren', 0.18, 3);
  stelle(buildAmbientFigur('tourist_kamera'), 9.4, 0, -0.2, 'aufschrecken', 0.5, 3).userData.ambient.props.kamera.visible = false;
  camera.position.set(1.2, 3.6, 16.5); camera.lookAt(1.2, 1.2, 0);
} else if (WHAT === 'paar') {
  const paare = [['handy_hochhalten', 'dose_heben'], ['zeitschrift_rollen', 'schnorchel_runter'], ['hinterherrufen', 'zurueckkommen_nass']];
  paare.forEach(([ps, pe], i) => {
    const x = -4.4 + i * 4.4;
    stelle(buildAmbientFigur('ehe_sie'), x - 1.0, 0, 0.55, ps, i === 1 ? 0.3 : 0.5);
    stelle(buildAmbientFigur('ehe_er'), x + 1.0, 0, -0.55, pe, i === 2 ? 0.3 : 0.5);
  });
  camera.position.set(0, 3.0, 11.5); camera.lookAt(0, 1.4, 0);
} else if (WHAT === 'pong') {
  const tisch = (x) => { const g = new THREE.Group(); g.position.set(x, 0, 0); const platte = toonMesh(new THREE.BoxGeometry(1.6, 0.08, 1.0), 0xd8a85a, { outline: 0.035 }); platte.position.set(0, 0.75, 1.6); g.add(platte); for (const [dx, dz] of [[-0.7, 1.2], [0.7, 1.2], [-0.7, 2.0], [0.7, 2.0]]) g.add(limb(new THREE.Vector3(dx, 0, dz), new THREE.Vector3(dx, 0.72, dz), 0.04, 0x8b5a2b, { outline: 0.02 })); const sitz = toonMesh(new THREE.BoxGeometry(0.8, 0.07, 0.8), 0x8b5a2b, { outline: 0.03 }); sitz.position.y = 0.55; g.add(sitz); const lehne = toonMesh(new THREE.BoxGeometry(0.8, 0.7, 0.07), 0x8b5a2b, { outline: 0.03 }); lehne.position.set(0, 0.95, -0.37); g.add(lehne); scene.add(g); return g; };
  [['fuesse_hoch', 0.95, 6], ['schnarchen', 0.5, 20], ['aufwachen', 0.5, 5]].forEach(([name, u, dauer], i) => {
    const x = -4 + i * 4; tisch(x);
    const p = pong(); scene.add(p);
    pongPose(p, name, T - u * dauer, dauer, { x, z: 0, rot: 0 }, { x, z: -2, rot: 0 }); updatePongPose(p, T);
  });
  camera.position.set(0, 3.2, 9.5); camera.lookAt(0, 1.3, 0.8);
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
