// world.js — die Zone „Bangi Beach“ als flache Bühne: Sand, Sichelbucht, Gras und Hügel im Norden,
// Bauten und Deko mit passenden Collidern (Kreise für Stämme/Pfosten, Rechtecke für Gebäude).
import * as THREE from 'three';
import { toonMesh, toon, basicMat, deform, rng } from './toon.js';
import { palm, beachBar, pier, boat, signpost, hammock, parasol, beachBall, coconut, crab, cloud, sun, footprints, limb, hut, mailbox, hotel, lounger, rental, sleepingSurfer, barrier, lamp, hedge } from './props.js';
import { shoreZ, WORLD } from './logic.js';

export const WATER_Y = 0.06;

// Polygon-Fläche aus einer oberen und unteren Kantenfunktion (z = f(x)), flach auf y
function stripMesh(top, bottom, color, y, { x0 = -240, x1 = 240, step = 4, basic = false } = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(x0, -top(x0));
  for (let x = x0 + step; x <= x1; x += step) shape.lineTo(x, -top(x));
  for (let x = x1; x >= x0; x -= step) shape.lineTo(x, -bottom(x));
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape, 1);
  geo.rotateX(-Math.PI / 2);
  const m = toonMesh(geo, color, { outline: 0, shadow: false, basic });
  m.position.y = y;
  m.receiveShadow = !basic;
  return m;
}

export function buildWorld() {
  const g = new THREE.Group();
  const colliders = [];
  const rand = rng(21);
  const circle = (x, z, r) => colliders.push({ x, z, r });
  const rect = (x, z, w, d) => colliders.push({ x, z, w, d });

  // Boden: Sand überall, darüber Gras im Norden, nasser Sand + Schaum + Wasser im Süden
  const sand = toonMesh(new THREE.PlaneGeometry(520, 520), 0xf7d984, { outline: 0, shadow: false });
  sand.rotation.x = -Math.PI / 2;
  sand.receiveShadow = true;
  g.add(sand);
  const grassEdge = (x) => -15 + 2.2 * Math.sin(x / 7) + 1.1 * Math.sin(x / 2.3 + 1);
  g.add(stripMesh(() => -260, grassEdge, 0x5fc74a, 0.02));
  g.add(stripMesh(() => -260, (x) => grassEdge(x) - 0.9, 0x4cae3c, 0.025)); // dunkler Grasrand
  g.add(stripMesh((x) => shoreZ(x) - 1.4, (x) => shoreZ(x) + 6, 0xe2bf6e, 0.02)); // nasser Sand
  g.add(stripMesh((x) => shoreZ(x) - 0.15, (x) => shoreZ(x) + 0.6, 0xeaf9ff, WATER_Y + 0.015, { basic: true })); // Schaum
  g.add(stripMesh((x) => shoreZ(x) + 0.1, () => 260, 0x1d9be6, WATER_Y));
  // Wellenlinien im Wasser
  for (let i = 0; i < 14; i++) {
    const x = -120 + i * 18 + rand() * 8, z0 = shoreZ(Math.max(WORLD.minX, Math.min(WORLD.maxX, x))) + 5 + rand() * 20;
    const w = toonMesh(new THREE.PlaneGeometry(4 + rand() * 4, 0.25), 0xdff4ff, { outline: 0, shadow: false, basic: true });
    w.rotation.x = -Math.PI / 2; w.position.set(x, WATER_Y + 0.01, z0); g.add(w);
  }

  // Hügel im Nordwesten (Kiffer-Kuppe, nur Kulisse) + Kokoshain-Hügel im Nordosten
  const hillGeo = new THREE.SphereGeometry(1, 28, 16);
  hillGeo.scale(44, 14, 30);
  const hill = toonMesh(hillGeo, 0x3f9d37, { outline: 0.12 });
  hill.position.set(-45, -2, -52);
  g.add(hill);
  const hill2Geo = hillGeo.clone();
  hill2Geo.scale(0.6, 0.5, 0.7); // vor toonMesh skalieren, sonst passt die Kontur-Hülle nicht
  const hill2 = toonMesh(hill2Geo, 0x4cae3c, { outline: 0.12 });
  hill2.position.set(60, -2, -48);
  g.add(hill2);
  // Mentor-Hütte oben auf dem Hügel
  const mentor = hut({ w: 3, h: 2.4, d: 2.6, lean: 0.35, wall: 0x8b5a2b, straw: true, seed: 8 });
  mentor.position.set(-45, 11.5, -52);
  mentor.rotation.y = 0.4;
  g.add(mentor);

  // Krummgassen-Kulisse hinter dem Nordrand
  const huts = [[-8, -36, 0xf08ac4, 0x2fa9b9, 0.5, 2], [6, -40, 0xffb347, 0xd62e2e, -0.4, 3], [20, -35, 0x9fd8ff, 0xffd54a, 0.45, 4], [34, -41, 0xc9a0ff, 0x3bb84a, -0.5, 5]];
  for (const [x, z, wall, roofColor, lean, seed] of huts) {
    const h = hut({ w: 3.2, h: 3.0, d: 3.0, lean, wall, roofColor, seed });
    h.position.set(x, 0, z);
    h.rotation.y = (seed - 3) * 0.3;
    g.add(h);
  }

  // Promenade: gepflasterter Weg am Nordrand des Strands, mit Laternen
  g.add(stripMesh((x) => -12.2 + 0.4 * Math.sin(x / 5), (x) => -9.4 + 0.4 * Math.sin(x / 5 + 1), 0xd9c4a3, 0.03, { x0: -64, x1: 66, step: 2 }));
  for (let x = -50; x <= 62; x += 16) {
    const l = lamp(); l.position.set(x, 0, -12.6); l.rotation.y = rand() * 0.4; g.add(l); circle(x, -12.6, 0.2);
  }
  // Hecke als Nordrand (mit Lücke für die Wäschegasse)
  g.add(hedge(-66, 66, -25.5, { gapFrom: -4, gapTo: 4, seed: 3 }));
  // Absperrungen an den drei Ausgängen (Wege enden hier erstmal)
  const bN = barrier('KRUMMGASSEN – Wäsche hängt'); bN.position.set(0, 0, -23.5); g.add(bN); rect(0, -23.5, 5, 1.2);
  const bW = barrier('SURFER-BUCHT – bald'); bW.position.set(-64.5, 0, -2); bW.rotation.y = Math.PI / 2; g.add(bW); rect(-64.5, -2, 1.2, 5);
  const bE = barrier('PROMENADE – im Bau'); bE.position.set(64.5, 0, -10.8); bE.rotation.y = -Math.PI / 2; g.add(bE); rect(64.5, -10.8, 1.2, 5);

  // Hotel Palmenschatten im Osten (Kulisse), Pool, Rutsche, Liegen mit Rentnern-Handtüchern
  const ho = hotel();
  ho.position.set(38, 0, -17);
  g.add(ho);
  rect(38.3, -17, 15.2, 7.4);
  rect(38 + ho.userData.poolOffset.x, -17 + ho.userData.poolOffset.z, 11, 8.6); // Pool + Rutsche
  for (let i = 0; i < 4; i++) {
    const lo = lounger(i % 2 ? ['#3a7bd5', '#ffffff'] : ['#e8463a', '#fff5e0']);
    lo.position.set(30 + i * 3.2, 0, -4 + (i % 2) * 1.2);
    lo.rotation.y = Math.PI + (rand() - 0.5) * 0.3;
    g.add(lo);
    rect(30 + i * 3.2, -4 + (i % 2) * 1.2, 1.2, 2.4);
  }

  // Verleih im Westen + Surfer-Siesta
  const re = rental();
  re.position.set(-50, 0, -6);
  re.rotation.y = 0.25;
  g.add(re);
  rect(-50, -6, 4.2, 3.4);
  rect(-46.2, -5, 3.4, 1.0);
  const su = sleepingSurfer();
  su.position.set(-44, 0, 6);
  su.rotation.y = 0.5;
  g.add(su);
  rect(-44, 6, 1.4, 3.0);

  // Felsen an den Enden des Strands
  for (const [x, z, sc] of [[-60, 8, 1.6], [-63, 4, 1.1], [62, 6, 1.4], [65, 1, 1.0], [58, 10, 0.8]]) {
    const rg = new THREE.SphereGeometry(sc, 6, 5);
    deform(rg, (v) => { v.multiplyScalar(0.85 + 0.3 * rand()); });
    rg.scale(1.3, 0.8, 1);
    const rock = toonMesh(rg, 0x8d8fa0, { outline: 0.06 });
    rock.position.set(x, 0.1, z); rock.rotation.y = rand() * 3; g.add(rock);
    circle(x, z, sc * 1.1);
  }

  // Palmen entlang des Strands (Position, Neigung, Seed)
  const palms = [
    [-58, -2, [1.2, 0, 0.6], 1], [-48, 4, [-0.9, 0, 0.8], 2], [-40, -8, [0.8, 0, 0.3], 3],
    [-14, 1, [1.1, 0, 0.5], 4], [-9, 5, [-0.8, 0, 0.7], 5], [2, -9, [0.6, 0, 0.9], 6],
    [16, 3, [-1.0, 0, 0.6], 7], [26, -6, [1.2, 0, -0.3], 8], [52, 2, [0.7, 0, 0.9], 9],
    [60, -9, [-1.1, 0, 0.4], 10], [-30, -12, [0.5, 0, 1.0], 11], [22, 8, [-0.6, 0, 0.8], 12],
  ];
  const palmObjs = [];
  for (const [x, z, l, s] of palms) {
    const p = palm({ lean: new THREE.Vector3(...l), seed: s, height: 4.3 + (s % 3) * 0.3 });
    p.position.set(x, 0, z);
    g.add(p);
    palmObjs.push(p);
    circle(x, z, 0.45);
  }
  // Hängematte zwischen Palme 4 und 5 (Versteck hinter der Bar)
  {
    const a = palmObjs[3].userData.curve.getPointAt(0.42).add(palmObjs[3].position);
    const b = palmObjs[4].userData.curve.getPointAt(0.42).add(palmObjs[4].position);
    g.add(hammock(a, b));
  }

  // Bangi Bar (Westen der Mitte), davor Start
  const bar = beachBar();
  bar.position.set(-28, 0, -6);
  bar.rotation.y = 0.08;
  g.add(bar);
  rect(-28, -5.6, 5.0, 2.2);   // Theke + Rückwand
  circle(-30.1, -7.1, 0.25); circle(-25.9, -7.1, 0.25); circle(-29.9, -5, 0.25); circle(-25.9, -5, 0.25);
  circle(-29.1, -4.1, 0.4); circle(-27.5, -4.1, 0.4); // Hocker

  // Steg vom Strand ins Meer, mit Boot
  const pierObj = pier({ length: 14, seed: 5 });
  pierObj.position.set(-34, 0, shoreZ(-34) - 3);
  g.add(pierObj);
  rect(-34, shoreZ(-34) + 4, 2.4, 14); // Steg als Block (man geht am Strand drumherum)
  const b = boat();
  b.position.set(-30.5, WATER_Y + 0.05, shoreZ(-34) + 10);
  b.rotation.set(0.04, 0.9, 0.06);
  g.add(b);

  // Wegweiser: „POLIZEI 2km“ zeigt nach Nordosten (Posten 7)
  const sp = signpost();
  sp.position.set(4, 0, -1);
  sp.rotation.y = -0.6;
  g.add(sp);
  circle(4, -1, 0.3);

  // Strand-Deko
  const ps = parasol(); ps.position.set(-18, 0, 6); g.add(ps); circle(-17.65, 6, 0.15);
  const ps2 = parasol(); ps2.position.set(44, 0, 4); ps2.rotation.y = 2.2; g.add(ps2); circle(44.35, 4, 0.15);
  const ball = beachBall(); ball.position.set(-20, 0.42, 9.5); g.add(ball); circle(-20, 9.5, 0.45);
  const mb = mailbox(); mb.position.set(-23, 0, -9.5); mb.rotation.y = 0.4; g.add(mb); circle(-23, -9.5, 0.35);
  for (const [x, z] of [[-12, 8], [-11.4, 8.4], [30, 7], [57, 3]]) {
    const c = coconut(); c.position.set(x, 0, z); c.rotation.z = rand() * 2; g.add(c);
  }
  const cr = crab(); cr.position.set(10, 0, 9); cr.rotation.y = 1.3; g.add(cr);
  g.add(footprints('sandal', new THREE.Vector3(-26, 0, 1), new THREE.Vector3(-14, 0, 7), 7));
  g.add(footprints('sneaker', new THREE.Vector3(22, 0, 10), new THREE.Vector3(14, 0, 2), 6));

  // Himmel: Sonne (stoned) und Wolken weit weg
  const s = sun(); s.position.set(70, 48, -170); s.scale.setScalar(5); g.add(s);
  for (const [x, y, z, k] of [[-120, 42, -180, 1], [-20, 50, -200, 2], [140, 38, -150, 3], [-200, 30, -60, 4], [220, 34, -20, 5]]) {
    const c = cloud(k); c.position.set(x, y, z); c.scale.setScalar(4); g.add(c);
  }

  // Snap-/Startpunkte: Spielerposition + Blickrichtung
  const spots = {
    start: { x: -24, z: 3, yaw: 0.35 },
    bar: { x: -28, z: -1, yaw: Math.PI },
    pier: { x: -37, z: 9, yaw: -0.3 },
    mitte: { x: 4, z: 4, yaw: -1.2 },
    hotel: { x: 36, z: 1, yaw: 2.6 },
    verleih: { x: -46, z: 0, yaw: 2.4 },
    ost: { x: 58, z: -2, yaw: Math.PI / 2 },
    nord: { x: 0, z: -18, yaw: 0.2 },
  };
  return { group: g, colliders, spots };
}
