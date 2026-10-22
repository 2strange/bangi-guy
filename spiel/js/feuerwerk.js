// feuerwerk.js — bunte Partikel-Bursts überm Meer (Erfolgs-Tableau am Wochenende).
// feuerwerk(scene, { x, z, hoehe, breite }) → { start(), stop(), update(t), gruppe } — update(t) mit t in Sekunden pro Frame;
// start() zündet alle 0,7–1,3 s eine Rakete (Aufstieg mit Funkenschweif, dann Burst aus 60 Funken, die fallen und verglühen),
// stop() lässt die laufenden ausbrennen und zündet keine neuen. Alles Points-Geometrie, ohne Licht; Farben flach wie der Rest.
import * as THREE from 'three';
import { rng } from './toon.js';

const FARBEN = [0xffd54a, 0xe8463a, 0x3dd6e0, 0xff5fa2, 0x3bb84a, 0xffffff, 0xff7f3f];
const N_FUNKEN = 90, MAX_RAKETEN = 8;

export function feuerwerk(scene, { x = 0, z = 30, hoehe = 14, breite = 24, seed = 5 } = {}) {
  const gruppe = new THREE.Group(); gruppe.name = 'feuerwerk'; gruppe.userData.noFade = true; scene.add(gruppe);
  const rand = rng(seed);
  const raketen = [];
  const S = { an: false, naechste: 0, tLast: 0 };

  function rakete() {
    const pos = new Float32Array(N_FUNKEN * 3), col = new Float32Array(N_FUNKEN * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 1.3, vertexColors: true, transparent: true, opacity: 1, sizeAttenuation: true, depthWrite: false });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; gruppe.add(pts);
    return { pts, geo, mat, pos, col, vel: new Float32Array(N_FUNKEN * 3), phase: 'aus', t0: 0, start: new THREE.Vector3(), ziel: new THREE.Vector3(), farbe: new THREE.Color() };
  }
  for (let i = 0; i < MAX_RAKETEN; i++) raketen.push(rakete());

  function zuenden(t) {
    const r = raketen.find((q) => q.phase === 'aus'); if (!r) return;
    r.phase = 'steigt'; r.t0 = t;
    r.start.set(x + (rand() - 0.5) * breite, 0.5, z + (rand() - 0.5) * 6);
    r.ziel.set(r.start.x + (rand() - 0.5) * 3, hoehe * (0.75 + rand() * 0.45), r.start.z);
    r.farbe.setHex(FARBEN[Math.floor(rand() * FARBEN.length)]);
    r.zweiteFarbe = new THREE.Color(FARBEN[Math.floor(rand() * FARBEN.length)]);
    r.mat.opacity = 1; r.mat.size = 0.8;
    for (let i = 0; i < N_FUNKEN; i++) { r.pos.set([r.start.x, r.start.y, r.start.z], i * 3); r.col.set([1, 0.95, 0.7], i * 3); }
    r.geo.attributes.position.needsUpdate = true; r.geo.attributes.color.needsUpdate = true;
  }
  function burst(r, t) {
    r.phase = 'burst'; r.t0 = t; r.mat.size = 1.3;
    const ring = rand() < 0.35; // jeder dritte ein Ring, sonst Kugel
    for (let i = 0; i < N_FUNKEN; i++) {
      const u = rand() * Math.PI * 2, v = ring ? 0 : Math.acos(2 * rand() - 1) - Math.PI / 2;
      const sp = ring ? 7 : 4.5 + rand() * 4;
      r.vel.set([Math.cos(u) * Math.cos(v) * sp, Math.sin(v) * sp + (ring ? 0 : 1), Math.sin(u) * Math.cos(v) * sp * 0.6], i * 3);
      r.pos.set([r.ziel.x, r.ziel.y, r.ziel.z], i * 3);
      const c = i % 2 ? r.farbe : r.zweiteFarbe; r.col.set([c.r, c.g, c.b], i * 3);
    }
    r.geo.attributes.position.needsUpdate = true; r.geo.attributes.color.needsUpdate = true;
  }
  function update(t) {
    const dt = Math.min(0.1, Math.max(0, t - S.tLast)); S.tLast = t;
    if (S.an && t >= S.naechste) { zuenden(t); S.naechste = t + 0.7 + rand() * 0.6; }
    for (const r of raketen) {
      if (r.phase === 'aus') continue;
      if (r.phase === 'steigt') { // Aufstieg: Funken als Schweif hinter dem Kopf, 1,1 s
        const u = (t - r.t0) / 1.1;
        if (u >= 1) { burst(r, t); continue; }
        const k = 1 - (1 - u) * (1 - u); // bremst oben ab
        for (let i = 0; i < N_FUNKEN; i++) {
          const lag = (i / N_FUNKEN) * 0.25;
          const ku = Math.max(0, k - lag);
          r.pos.set([r.start.x + (r.ziel.x - r.start.x) * ku + (rand() - 0.5) * 0.15, r.start.y + (r.ziel.y - r.start.y) * ku, r.start.z + (rand() - 0.5) * 0.15], i * 3);
        }
        r.geo.attributes.position.needsUpdate = true;
      } else { // Burst: fliegen, fallen, verglühen (2,2 s)
        const u = (t - r.t0) / 2.2;
        if (u >= 1) { r.phase = 'aus'; r.mat.opacity = 0; continue; }
        for (let i = 0; i < N_FUNKEN; i++) {
          const j = i * 3;
          r.vel[j] *= 0.985; r.vel[j + 2] *= 0.985; r.vel[j + 1] = r.vel[j + 1] * 0.985 - 4.5 * dt;
          r.pos[j] += r.vel[j] * dt; r.pos[j + 1] += r.vel[j + 1] * dt; r.pos[j + 2] += r.vel[j + 2] * dt;
        }
        r.mat.opacity = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
        r.mat.size = 1.3 * (1 - 0.5 * u) * (0.8 + 0.2 * Math.sin(t * 30 + r.t0)); // Flackern
        r.geo.attributes.position.needsUpdate = true;
      }
    }
  }
  function start() { S.an = true; S.naechste = S.tLast; }
  function stop() { S.an = false; }
  function dispose() { for (const r of raketen) { r.geo.dispose(); r.mat.dispose(); } scene.remove(gruppe); }
  return { gruppe, start, stop, update, dispose, get an() { return S.an; } };
}
