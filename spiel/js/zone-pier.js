// zone-pier.js — Zone „Tuk-Tuk-Pier“ (Z4, Hafen): Diesel, Fischkisten, umgedrehte Boote (Versteck V4),
// Holzsteg ins Meer mit Anleger, die Fähre kommt alle 60 s (tutet, legt an, Zivi P3 steigt aus — Gag 12:
// bringt frisch gebügelte Hemden), Tuk-Tuk mit Fahrer Somchai (Motor säuft ab — Gag 11, Fluchtmittel F3 später),
// Fischer mit Angel, Furt F2 zum Hotelstrand (Untiefe mit Trittsteinen, nur Sandalen).
// Einbau: buildPier(gruppe, colliders) → { spots, update(t), ferry(t), anchors, hideouts, tuktuk, furt, steg, bounds }.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMesh, toon, deform, rng, textTexture, stripeTexture, BLACK } from './toon.js';
import { limb, barrier, lamp, boat, palm } from './props.js';
import { sandal } from './figures.js';
import { face, faceDecal } from './faces.js';
import { plate, cobbleTexture, paving } from './zone-dorf.js';
import { WATER_Y } from './world.js';
import { LANES, PROPS, EXITS, STEG, FERRY, FERRY_SPAWN, FURT, HAFENPLATZ, PIER_SPOTS, PIER_ANCHORS, WORLD_MAX_X, SHORE_Z, pierColliders, ferryAt, furtRadius } from './zone-pier-layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- Steg: breite Planken auf krummen Pfählen, Poller ----------
function dock() {
  const g = new THREE.Group();
  const rand = rng(61);
  const S = STEG, len = S.z1 - S.z0;
  for (let z = 0; z < len; z += 0.7) {
    if (Math.round(z / 0.7) === 9) continue; // eine Planke fehlt
    const plank = toonMesh(new THREE.BoxGeometry(S.w + (rand() - 0.5) * 0.3, 0.14, 0.55), z % 2.1 < 0.7 ? 0xb87a3e : 0xc98a48, { outline: 0.04 });
    plank.position.set((rand() - 0.5) * 0.15, 0.42 + (rand() - 0.5) * 0.06, z);
    plank.rotation.set((rand() - 0.5) * 0.05, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.05);
    g.add(plank);
  }
  for (let z = 0.3; z < len; z += 2.4) {
    for (const x of [-S.w / 2 + 0.3, S.w / 2 - 0.3]) {
      g.add(limb(V(x, -2.2, z), V(x + (rand() - 0.5) * 0.3, 0.6 + rand() * 0.25, z + (rand() - 0.5) * 0.2), 0.16, 0x7a4b22, { outline: 0.045 }));
    }
  }
  // Geländer rechts (Seeseite), links frei zum Anleger
  for (let z = 0.5; z < len; z += 3) g.add(limb(V(-S.w / 2 + 0.1, 0.45, z), V(-S.w / 2 + 0.05, 1.5, z), 0.06, 0xd8a85a, { outline: 0.025 }));
  g.add(limb(V(-S.w / 2 + 0.05, 1.45, 0.5), V(-S.w / 2 + 0.05, 1.55, len - 0.5), 0.05, 0xd8a85a, { outline: 0.025 }));
  // Poller am Anleger + Gummireifen als Fender
  for (const z of [len - 1.5, len - 6]) {
    const b = limb(V(S.w / 2 - 0.4, 0.45, z), V(S.w / 2 - 0.35, 1.2, z), 0.14, 0x5a3b1a, { outline: 0.04 }); g.add(b);
    const tire = toonMesh(new THREE.TorusGeometry(0.45, 0.14, 8, 16), 0x222222, { outline: 0.03 });
    tire.position.set(S.w / 2 + 0.15, 0.2, z + 2); tire.rotation.y = Math.PI / 2; g.add(tire);
  }
  const sign = plate('FÄHRE · ALLE 60 s · ODER SO', 2.2, 0.42, { font: 'bold 56px sans-serif', tw: 1024, th: 160, thick: 0.05 });
  sign.position.set(-S.w / 2 + 0.1, 1.9, 1.5); sign.rotation.set(0, Math.PI / 2, 0.05); g.add(sign);
  g.add(limb(V(-S.w / 2 + 0.1, 0.45, 1.5), V(-S.w / 2 + 0.1, 2.2, 1.5), 0.06, 0x7a4b22, { outline: 0.025 }));
  return g;
}

// ---------- Fähre: Rumpf, Aufbau, Schornstein, Flagge, Tut-Blase ----------
function ferry() {
  const g = new THREE.Group();
  const hullGeo = new THREE.BoxGeometry(10, 2.2, 3.6, 6, 1, 1);
  deform(hullGeo, (v) => { const t = (v.x + 5) / 10; if (t > 0.75) v.z *= 1 - 0.75 * (t - 0.75) / 0.25; if (v.y < 0) { v.z *= 0.7; v.x *= 0.92; } if (t > 0.9) v.y += 0.3; });
  const hull = toonMesh(hullGeo, 0x3a7bd5, { outline: 0.07 }); hull.position.y = 0.6; g.add(hull);
  const stripe = toonMesh(new THREE.BoxGeometry(9.6, 0.3, 3.75), 0xffffff, { outline: 0.03 }); stripe.position.y = 1.4; g.add(stripe);
  const deck = toonMesh(new THREE.BoxGeometry(9.0, 0.2, 3.3), 0xd8a85a, { outline: 0.03 }); deck.position.y = 1.75; g.add(deck);
  const cabin = toonMesh(new RoundedBoxGeometry(4.2, 2.0, 2.8, 3, 0.15), 0xfff1c2, { outline: 0.06 }); cabin.position.set(-0.8, 2.8, 0); g.add(cabin);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const w = toonMesh(new THREE.BoxGeometry(0.8, 0.6, 0.1), 0x7fd8ff, { outline: 0.025 }); w.position.set(-2.0 + i * 1.2, 3.0, s * 1.42); g.add(w); }
  const roof = toonMesh(new THREE.BoxGeometry(4.8, 0.2, 3.2), 0xe8463a, { outline: 0.04 }); roof.position.set(-0.8, 3.9, 0); g.add(roof);
  const funnel = toonMesh(new THREE.CylinderGeometry(0.4, 0.5, 1.6, 10), 0xe8463a, { outline: 0.04 }); funnel.position.set(-2.2, 4.6, 0); funnel.rotation.z = 0.12; g.add(funnel);
  const funnelTop = toonMesh(new THREE.CylinderGeometry(0.45, 0.4, 0.2, 10), 0x222222, { outline: 0.03 }); funnelTop.position.set(-2.3, 5.4, 0); g.add(funnelTop);
  g.add(limb(V(3.5, 1.8, 0), V(3.6, 4.6, 0), 0.06, 0x555566, { outline: 0.025 }));
  const flag = toonMesh(new THREE.BoxGeometry(1.0, 0.6, 0.04), 0xffd54a, { outline: 0.025 }); flag.position.set(3.1, 4.3, 0); g.add(flag);
  // Bügelbretter mit Hemden an Deck (Gag 12: bringt frisch gebügelte Hemden)
  for (let i = 0; i < 3; i++) {
    const sh = toonMesh(new THREE.BoxGeometry(0.5, 0.65, 0.05), [0xffffff, 0xf4f4f8, 0xdfe3ee][i], { outline: 0.025 });
    sh.position.set(2.2 + i * 0.6, 2.4, -1.2); sh.rotation.y = 0.3; g.add(sh);
  }
  const rail = toonMesh(new THREE.BoxGeometry(9.0, 0.06, 0.06), 0xffffff, { outline: 0.02 }); rail.position.set(0, 2.5, 1.6); g.add(rail);
  for (let i = -4; i <= 4; i++) g.add(limb(V(i, 1.85, 1.6), V(i, 2.5, 1.6), 0.035, 0xffffff, { outline: 0.015 }));
  const horn = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.8), new THREE.MeshBasicMaterial({ map: textTexture('TUUUT!', { bg: 'rgba(0,0,0,0)', fg: '#1a1a1a', font: 'bold 110px sans-serif', w: 512, h: 170 }), transparent: true, depthWrite: false }));
  horn.position.set(-2.2, 6.6, 0.4); horn.visible = false; g.add(horn);
  const smoke = [];
  for (let i = 0; i < 3; i++) { const p = toonMesh(new THREE.SphereGeometry(0.3, 8, 6), 0x9a9aa6, { outline: 0.05, shadow: false, basic: true }); p.userData.phase = i / 3; p.position.set(-2.3, 5.6, 0); g.add(p); smoke.push(p); }
  g.userData.horn = horn; g.userData.smoke = smoke;
  return g;
}

// ---------- Tuk-Tuk mit Fahrer Somchai ----------
function tuktuk() {
  const g = new THREE.Group();
  const body = toonMesh(new RoundedBoxGeometry(2.6, 1.0, 1.6, 3, 0.15), 0x3bb84a, { outline: 0.05 }); body.position.set(0.2, 0.9, 0); g.add(body);
  const nose = toonMesh(new RoundedBoxGeometry(0.9, 0.8, 1.0, 3, 0.2), 0xffd54a, { outline: 0.045 }); nose.position.set(1.6, 0.85, 0); g.add(nose);
  const screen = toonMesh(new THREE.BoxGeometry(0.1, 0.9, 1.3), 0x7fd8ff, { outline: 0.025 }); screen.position.set(1.0, 1.75, 0); screen.rotation.z = 0.25; g.add(screen);
  for (const [x, y, z] of [[-0.9, 1.4, -0.7], [-0.9, 1.4, 0.7], [1.2, 1.4, -0.7], [1.2, 1.4, 0.7]]) g.add(limb(V(x, y, z), V(x, 2.3, z), 0.04, 0x222222, { outline: 0.02 }));
  const canopy = toonMesh(new THREE.BoxGeometry(2.6, 0.08, 1.8, 6, 1, 1), toon(0xffffff, { map: stripeTexture(['#e8463a', '#ffd54a', '#e8463a', '#ffd54a', '#e8463a'], { vertical: true }) }), { outline: 0.03 });
  deform(canopy.geometry, (v) => { v.y += 0.08 * Math.sin(v.x * 3); });
  canopy.position.set(0.15, 2.35, 0); canopy.rotation.z = 0.04; g.add(canopy);
  const fringe = toonMesh(new THREE.BoxGeometry(2.6, 0.2, 0.04), 0xffd54a, { outline: 0.02 }); fringe.position.set(0.15, 2.25, 0.9); g.add(fringe);
  for (const [x, z] of [[-0.7, -0.95], [-0.7, 0.95]]) { const w = toonMesh(new THREE.TorusGeometry(0.34, 0.14, 8, 14), 0x222222, { outline: 0.03 }); w.position.set(x, 0.4, z); g.add(w); }
  const fw = toonMesh(new THREE.TorusGeometry(0.3, 0.12, 8, 14), 0x222222, { outline: 0.03 }); fw.position.set(1.9, 0.36, 0); fw.rotation.y = 0.2; g.add(fw);
  const seat = toonMesh(new THREE.BoxGeometry(1.2, 0.3, 1.3), 0xe8463a, { outline: 0.03 }); seat.position.set(-0.5, 1.5, 0); g.add(seat);
  const sign = plate('TUK-TUK · 20 MANGOS', 1.6, 0.34, { bg: '#ffd54a', font: 'bold 60px sans-serif', tw: 768, th: 160, thick: 0.03 });
  sign.position.set(-1.18, 1.05, 0); sign.rotation.y = -Math.PI / 2; g.add(sign);
  // Somchai: sitzt vorn, Hände am Lenker, Blick nach +x
  const skin = 0xd9a06e;
  const torso = toonMesh(new THREE.CylinderGeometry(0.32, 0.36, 0.8, 10), 0xff7f3f, { outline: 0.04 }); torso.position.set(0.5, 1.75, 0); g.add(torso);
  const head = new THREE.Group(); head.position.set(0.5, 2.45, 0); head.rotation.y = Math.PI / 2; g.add(head);
  head.add(toonMesh(new THREE.SphereGeometry(0.33, 14, 10), skin, { outline: 0.04 }));
  head.add(faceDecal(face('kunde', 'selig', { skin: '#d9a06e', bart: 'stoppel', seed: 91 }), 0.335, null));
  const cap = toonMesh(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), 0x2fa9b9, { outline: 0.03 }); cap.position.set(0, 0.08, 0); head.add(cap);
  const brim = toonMesh(new THREE.BoxGeometry(0.4, 0.05, 0.3), 0x2fa9b9, { outline: 0.025 }); brim.position.set(0, 0.2, 0.4); head.add(brim);
  for (const s of [-1, 1]) g.add(limb(V(0.5, 2.05, s * 0.3), V(1.0, 1.75, s * 0.35), 0.07, skin, { outline: 0.03 }));
  const bar = toonMesh(new THREE.BoxGeometry(0.08, 0.08, 1.0), 0x555566, { outline: 0.02 }); bar.position.set(1.05, 1.7, 0); g.add(bar);
  // Auspuff mit Puffwolken (Gag 11: Motor säuft ab)
  g.add(limb(V(-1.1, 0.5, -0.5), V(-1.5, 0.45, -0.5), 0.06, 0x555566, { outline: 0.025 }));
  const puffs = [];
  for (let i = 0; i < 3; i++) { const p = toonMesh(new THREE.SphereGeometry(0.22, 8, 6), 0x9a9aa6, { outline: 0.045, shadow: false, basic: true }); p.userData.phase = i / 3; p.position.set(-1.6, 0.5, -0.5); g.add(p); puffs.push(p); }
  g.userData.puffs = puffs; g.userData.body = body;
  return g;
}

// ---------- Kleinkram ----------
function fishCrates(seed) {
  const g = new THREE.Group();
  const rand = rng(seed);
  for (let i = 0; i < 3; i++) {
    const c = toonMesh(new RoundedBoxGeometry(1.2, 0.4, 0.8, 3, 0.05), i % 2 ? 0xdfe8f0 : 0xd8a85a, { outline: 0.035 });
    c.position.set((rand() - 0.5) * 0.3, 0.2 + i * 0.4, (rand() - 0.5) * 0.3); c.rotation.y = (rand() - 0.5) * 0.4; g.add(c);
  }
  for (let i = 0; i < 3; i++) {
    const f = toonMesh(new THREE.SphereGeometry(0.16, 8, 6), 0x8d9fb5, { outline: 0.02 }); f.geometry.scale(1.8, 0.6, 1);
    f.position.set(-0.4 + i * 0.35, 1.3, (i % 2) * 0.2 - 0.1); f.rotation.y = rand(); g.add(f);
  }
  const ice = toonMesh(new THREE.BoxGeometry(1.0, 0.08, 0.6), 0xeaf9ff, { outline: 0.02 }); ice.position.set(0, 1.23, 0); g.add(ice);
  return g;
}
function netPole() {
  const g = new THREE.Group();
  g.add(limb(V(0, 0, 0), V(0.1, 2.8, 0), 0.08, 0x7a4b22, { outline: 0.03 }));
  g.add(limb(V(0.1, 2.6, 0), V(1.9, 2.3, 0.2), 0.05, 0x7a4b22, { outline: 0.025 }));
  const net = toonMesh(new THREE.BoxGeometry(1.6, 1.4, 0.04, 8, 6, 1), toon(0x9bd1c8, { transparent: true, opacity: 0.75 }), { outline: 0.02 });
  deform(net.geometry, (v) => { v.z += 0.06 * Math.sin(v.x * 5 + v.y * 4); v.y -= 0.15 * Math.abs(v.x) * (v.y < 0 ? 1 : 0); });
  net.position.set(1.0, 1.7, 0.1); net.rotation.z = -0.1; g.add(net);
  for (let i = 0; i < 4; i++) { const f = toonMesh(new THREE.SphereGeometry(0.1, 6, 5), 0xe8463a, { outline: 0.015 }); f.position.set(0.3 + i * 0.45, 0.95, 0.1); g.add(f); }
  return g;
}
function gull() {
  const g = new THREE.Group();
  const body = toonMesh(new THREE.SphereGeometry(0.17, 10, 8), 0xffffff, { outline: 0.03 }); body.geometry.scale(1.5, 1, 1); g.add(body);
  const head = toonMesh(new THREE.SphereGeometry(0.12, 8, 6), 0xffffff, { outline: 0.025 }); head.position.set(0.22, 0.17, 0); g.add(head);
  const beak = toonMesh(new THREE.ConeGeometry(0.05, 0.18, 6), 0xffb13b, { outline: 0.02 }); beak.position.set(0.38, 0.15, 0); beak.rotation.z = -Math.PI / 2; g.add(beak);
  const wing = toonMesh(new THREE.BoxGeometry(0.4, 0.04, 0.2), 0xc9cfdc, { outline: 0.015 }); wing.position.set(-0.05, 0.08, 0); g.add(wing);
  return g;
}
function fisherman() {
  const root = new THREE.Group();
  const skin = 0xd9a06e;
  // sitzt auf der Stegkante, Beine baumeln nach +z
  const torso = toonMesh(new THREE.CylinderGeometry(0.38, 0.42, 0.9, 12), 0x3a7bd5, { outline: 0.045 }); torso.position.set(0, 0.95, 0); root.add(torso);
  for (const s of [-1, 1]) {
    root.add(limb(V(s * 0.2, 0.55, 0.1), V(s * 0.25, 0.1, 0.75), 0.11, 0xd9c08a, { outline: 0.035 }));
    const shoe = sandal(skin, s < 0 ? 'L' : 'R'); shoe.position.set(s * 0.25, -0.25, 0.85); shoe.rotation.x = -0.9; shoe.scale.setScalar(0.9); root.add(shoe);
  }
  root.add(limb(V(0.4, 1.3, 0), V(0.7, 0.9, 0.5), 0.09, skin, { outline: 0.035 }));
  root.add(limb(V(-0.4, 1.3, 0), V(-0.5, 0.8, 0.4), 0.09, skin, { outline: 0.035 }));
  const head = new THREE.Group(); head.position.set(0, 1.85, 0); root.add(head);
  head.add(toonMesh(new THREE.SphereGeometry(0.4, 14, 10), skin, { outline: 0.045 }));
  head.add(faceDecal(face('kunde', 'neutral', { skin: '#d9a06e', bart: 'vollbart', haare: 'weiss', seed: 93 }), 0.405, null));
  const hat = toonMesh(new THREE.ConeGeometry(0.75, 0.5, 12), 0xe3b04b, { outline: 0.035 }); hat.position.set(0, 0.5, 0); hat.rotation.z = 0.1; head.add(hat);
  // Angel + Schnur + Schwimmer
  root.add(limb(V(0.7, 0.9, 0.5), V(1.4, 2.6, 2.6), 0.03, 0xd8a85a, { outline: 0.015 }));
  root.add(limb(V(1.4, 2.6, 2.6), V(1.5, 0.0, 4.2), 0.012, 0xffffff, { outline: 0.006 }));
  const bob = toonMesh(new THREE.SphereGeometry(0.1, 8, 6), 0xe8463a, { outline: 0.02 }); bob.position.set(1.5, 0.05, 4.2); root.add(bob);
  const bucket = toonMesh(new THREE.CylinderGeometry(0.28, 0.24, 0.4, 10), 0xe8463a, { outline: 0.03 }); bucket.position.set(-0.9, 0.2, 0.2); root.add(bucket);
  root.userData.bob = bob;
  return root;
}

/**
 * Baut die Pier-Zone in `parent`, pusht Collider. Rückgabe { spots, update(t), ferry(t), anchors, hideouts, tuktuk, furt, steg, bounds }.
 */
export function buildPier(parent, colliders) {
  const rand = rng(67);
  const add = (o) => { parent.add(o); return o; };
  paving(parent, cobbleTexture(), { zufahrt: LANES.hafen_zufahrt, promenade: LANES.hafen_promenade, quer: LANES.markt_quer }, HAFENPLATZ);

  // Steg + Fähre
  const steg = dock(); steg.position.set(STEG.x, 0, STEG.z0); add(steg);
  const fahre = ferry(); fahre.position.y = WATER_Y + 0.05; add(fahre);
  // Furt: organische Untiefe (wabbelige Ellipse, innen hell, zum Rand ins Meerblau verlaufend), Schaumrand, Glitzern, Trittsteine
  const sparkles = [];
  {
    const N = 48, inner = new THREE.Color(0x8ff0ef), sea = new THREE.Color(0x1d9be6);
    const pos = [], col = [], idx = [];
    const ring = (k, rf, c) => {
      for (let i = 0; i < N; i++) {
        const a = i / N * Math.PI * 2, f = furtRadius(a) * rf;
        pos.push(FURT.cx + Math.cos(a) * FURT.rx * f, 0, FURT.cz + Math.sin(a) * FURT.rz * f);
        col.push(c.r, c.g, c.b);
      }
    };
    pos.push(FURT.cx, 0, FURT.cz); col.push(inner.r, inner.g, inner.b);      // 0: Mitte
    ring(1, 1.0, inner);                                                     // 1..N: Rand der Untiefe
    ring(2, 1.35, sea);                                                      // N+1..2N: Übergang ins Meer
    for (let i = 0; i < N; i++) { const j = (i + 1) % N; idx.push(0, 1 + j, 1 + i); }
    for (let i = 0; i < N; i++) { const j = (i + 1) % N; idx.push(1 + i, 1 + j, 1 + N + i, 1 + j, 1 + N + j, 1 + N + i); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const shallow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
    shallow.position.y = WATER_Y + 0.02; shallow.renderOrder = 1; shallow.userData.noFade = true; add(shallow);
    // Schaumrand als dünne Röhre am Umriss, leicht wellig
    const pts = [];
    for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, f = furtRadius(a) * 1.04; pts.push(V(FURT.cx + Math.cos(a) * FURT.rx * f, WATER_Y + 0.05, FURT.cz + Math.sin(a) * FURT.rz * f)); }
    const foam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.12, 5, true), new THREE.MeshBasicMaterial({ color: 0xeaf9ff }));
    foam.userData.noFade = true; add(foam);
    // Glitzern: kleine helle Punkte, die mit der Zeit auf- und abblenden
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.85 * furtRadius(a);
      const sp = new THREE.Mesh(new THREE.CircleGeometry(0.12 + rand() * 0.1, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      sp.rotation.x = -Math.PI / 2; sp.position.set(FURT.cx + Math.cos(a) * FURT.rx * r, WATER_Y + 0.08, FURT.cz + Math.sin(a) * FURT.rz * r);
      sp.userData.phase = rand() * Math.PI * 2; sp.userData.noFade = true; sparkles.push(add(sp));
    }
    for (const [x, z] of FURT.stones) {
      const st = toonMesh(new THREE.SphereGeometry(0.7, 8, 6), 0x8d8fa0, { outline: 0.04 }); st.geometry.scale(1.3, 0.5, 1.1);
      st.position.set(x, WATER_Y + 0.1, z); st.rotation.y = rand() * 3; st.userData.noFade = true; add(st);
    }
    const s = new THREE.Group();
    s.add(limb(V(0, 0, 0), V(0.08, 2.2, 0), 0.07, 0x7a4b22, { outline: 0.03 }));
    const b = plate('FURT → HOTEL · NUR SANDALEN', 2.6, 0.42, { font: 'bold 54px sans-serif', tw: 1024, th: 160, thick: 0.05 });
    b.position.set(0.08, 2.2, 0); b.rotation.set(0, 0.9, 0.05); s.add(b);
    const b2 = plate('(Turnschuhe werden nass)', 2.0, 0.3, { bg: '#e8c57a', font: 'bold 54px sans-serif', tw: 1024, th: 160, thick: 0.05 });
    b2.position.set(0.05, 1.7, 0); b2.rotation.set(0, 1.0, -0.05); s.add(b2);
    s.position.set(68, 0, 10.5); add(s); colliders.push({ x: 68, z: 10.5, r: 0.25 });
  }

  // Kulissen
  let tuk = null;
  const hideouts = [];
  let fisher = null;
  for (const p of PROPS) {
    let o = null;
    switch (p.kind) {
      case 'tuktuk': o = tuk = tuktuk(); break;
      case 'boot': { o = boat(); o.rotation.z = Math.PI; o.position.y = 0.75; hideouts.push({ x: p.x, z: p.z, r: 1.9 }); break; }
      case 'kisten': o = fishCrates(70 + Math.round(p.x)); break;
      case 'netz': o = netPole(); break;
      case 'poller': { o = limb(V(0, 0, 0), V(0.05, 1.0, 0), 0.16, 0x5a3b1a, { outline: 0.04 }); const gu = gull(); gu.position.set(0.05, 1.0, 0); gu.rotation.y = rand() * 6; o = new THREE.Group().add(o, gu); break; }
      case 'fischer': o = fisher = fisherman(); o.position.y = 0.5; break;
      case 'schild': {
        o = new THREE.Group();
        o.add(limb(V(0, 0, 0), V(-0.2, 2.7, 0.1), 0.1, 0x7a4b22, { outline: 0.04 }));
        [['← MARKT', 2.4, 0.3], ['BAR 60 s →', 1.9, -0.4], ['FÄHRE ↓', 1.4, 0.1]].forEach(([txt, y, rot], i) => {
          const b = plate(txt, 1.9, 0.4, { bg: '#e8c57a', font: 'bold 66px sans-serif', tw: 640, th: 128, thick: 0.08 });
          deform(b.geometry, (v) => { if (v.x > 0.8) v.y *= 0.55; });
          b.position.set(-0.2 * (y / 2.7), y, 0); b.rotation.set(0, rot, (i % 2 ? -1 : 1) * 0.07); o.add(b);
        });
        break;
      }
      case 'laterne': o = lamp(); o.scale.setScalar(1.4); break;
    }
    if (!o) continue;
    o.position.x = p.x; o.position.z = p.z; if (p.rot) o.rotation.y = p.rot;
    add(o);
  }
  // Palme am Hafenplatz, Absperrung zur Nachbarinsel, Hügel-Collider
  {
    const x = 94, z = -16;
    const p = palm({ lean: new THREE.Vector3(-1.1, 0, 0.5), seed: 24, height: 4.6 }); p.position.set(x, 0, z); p.scale.setScalar(1.4); add(p); colliders.push({ x, z, r: 0.63 });
    const top = p.userData.curve.getPointAt(1).multiplyScalar(1.4); p.userData.crown = { x: x + top.x, y: top.y - 0.6, z: z + top.z, r: 4.8 };
  }
  for (const e of Object.values(EXITS)) { const b = barrier(e.text); b.position.set(e.x, 0, e.z); b.rotation.y = e.rot; b.scale.setScalar(1.3); add(b); }
  for (const c of pierColliders()) colliders.push(c);

  // ----- Animation: Fähre (Position, Tuten, Rauch), Tuk-Tuk (Puffs, Motor säuft ab), Schwimmer, Möwen -----
  function update(t) {
    const f = ferryAt(t);
    fahre.position.x = f.x; fahre.position.z = f.z; fahre.rotation.y = f.yaw;
    fahre.rotation.z = 0.02 * Math.sin(t * 1.3); fahre.position.y = WATER_Y + 0.05 + 0.05 * Math.sin(t * 0.9);
    fahre.visible = f.state !== 'away';
    fahre.userData.horn.visible = f.horn; fahre.userData.horn.scale.setScalar(1 + 0.15 * Math.sin(t * 20));
    for (const s of fahre.userData.smoke) { const u = ((t * 0.5) + s.userData.phase) % 1; s.position.set(-2.3 - u * 1.5, 5.6 + u * 1.8, 0); s.scale.setScalar(0.5 + u * 1.3); s.visible = f.state !== 'docked' || u < 0.5; }
    if (tuk) { // Motor säuft ab: alle 8 s drei Puffs, dazwischen Ruhe und ein Schütteln
      const k = t % 8;
      const on = k < 2.5;
      tuk.userData.puffs.forEach((p) => { const u = ((k * 0.8) + p.userData.phase) % 1; p.visible = on; p.position.set(-1.6 - u * 1.4, 0.5 + u * 0.9, -0.5 - u * 0.3); p.scale.setScalar(0.5 + u); });
      tuk.userData.body.position.y = 0.9 + (on ? 0.03 * Math.sin(t * 40) : 0);
      tuk.userData.body.rotation.z = on ? 0.01 * Math.sin(t * 37) : 0;
    }
    if (fisher) fisher.userData.bob.position.y = 0.05 + 0.08 * Math.sin(t * 2.2);
    for (const sp of sparkles) sp.material.opacity = Math.max(0, Math.sin(t * 2.6 + sp.userData.phase)) ** 3 * 0.9;
  }
  update(0);
  return {
    spots: PIER_SPOTS, update, ferry: ferryAt, anchors: PIER_ANCHORS, hideouts,
    tuktuk: { x: PROPS[0].x, z: PROPS[0].z, r: 2.2 }, ferrySpawn: { ...FERRY_SPAWN },
    furt: { ...FURT }, steg: { ...STEG }, bounds: { maxX: WORLD_MAX_X },
  };
}
