// world.js — die Zone „Bangi Beach“ als flache Bühne: Sand, Sichelbucht, Gras und Hügel im Norden,
// Bauten und Deko mit passenden Collidern (Kreise für Stämme/Pfosten, Rechtecke für Gebäude).
import * as THREE from 'three';
import { toonMesh, toon, basicMat, deform, rng } from './toon.js';
import { palm, beachBar, pier, boat, signpost, hammock, parasol, beachBall, coconut, crab, cloud, sun, limb, hut, mailbox, hotel, lounger, rental, sleepingSurfer, barrier, finaleHuette, setHuette, setWegweiserText, lamp, hedge, shell, starfish, sandcastle, driftwood } from './props.js';
import { shoreZ, WORLD, buildingScale, scaledRect, scaledCircle, BUILDING_POS, buildingFootprints, poolLadderCollider } from './logic.js';
import { buildDorf } from './zone-dorf.js';
import { buildHuegel } from './zone-huegel.js';
import { buildMarkt } from './zone-markt.js';
import { buildPier } from './zone-pier.js';
import { lichterkette } from './licht.js';
import { buildReisfeld, buildKokoshain } from './zone-reisfeld.js';
import { buildNong } from './figures.js';

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
  m.userData.noFade = true;
  return m;
}

export function buildWorld() {
  const g = new THREE.Group();
  const colliders = [];
  const rand = rng(21);
  const circle = (x, z, r) => colliders.push({ x, z, r });
  const rect = (x, z, w, d) => colliders.push({ x, z, w, d });
  // Gebäude werden als Gruppe um BUILDING_SCALE vergrößert; ihre Collider rechnen Offsets/Maße mit
  const bRect = (o, s, dx, dz, w, d) => colliders.push(scaledRect(o, s, dx, dz, w, d));
  const bCircle = (o, s, dx, dz, r) => colliders.push(scaledCircle(o, s, dx, dz, r));

  // Boden: Sand überall, darüber Gras im Norden, nasser Sand + Schaum + Wasser im Süden
  const sand = toonMesh(new THREE.PlaneGeometry(520, 520), 0xf7d984, { outline: 0, shadow: false });
  sand.rotation.x = -Math.PI / 2;
  sand.receiveShadow = true;
  sand.userData.noFade = true;
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
    w.rotation.x = -Math.PI / 2; w.position.set(x, WATER_Y + 0.01, z0); w.userData.noFade = true; g.add(w);
  }

  // Hügel im Nordwesten (Kiffer-Kuppe, nur Kulisse) + Kokoshain-Hügel im Nordosten
  // Hügel im Nordwesten = Mentor-Hügel (eigenes Modul, siehe unten). Der frühere Kokoshain-Kulissenhügel im
  // Nordosten ist weg: sein flacher Rand lag als Ring/Streifen unter dem Markt (Platz gehört jetzt Markt + Pier-Ausgang).
  // Mentor-Hütte oben auf dem Hügel

  // Dorf „Krummgassen“ nördlich der Hecke (eigenes Modul): Häuser, Gassen, Wäscheleinen, Collider inkl. Heckenrand
  const dorf = buildDorf(g, colliders, { exits: { markt: false, posten: false } }); // Ausgänge führen jetzt wirklich weiter
  // Mentor-Hügel „Kiffer-Kuppe“ (eigenes Modul): Heightfield, Serpentine, Hütte, Garten, Mentor; liefert height(x, z)
  const huegel = buildHuegel(g, colliders);
  // Mango-Markt (östlich des Dorfs) + Posten 7 (nördlich) mit Ringstraße (eigenes Modul)
  const markt = buildMarkt(g, colliders, { exits: { pier: false, stadt: true } }); // Pier-Ausgang ist offen, Stadt bleibt gesperrt
  // Tuk-Tuk-Pier (Hafen) östlich von x 66: Steg, Fähre, Tuk-Tuk, Furt zum Hotelstrand (eigenes Modul)
  const hafen = buildPier(g, colliders); // nicht `pier` nennen: so heißt der Steg-Baustein aus props.js
  const reis = buildReisfeld(g, colliders);   // Reisfeld mit Bauer Nok (zwischen Kuppe und Posten)
  const hain = buildKokoshain(g, colliders);  // Kokoshain-Ecke im Osten (Versteck)

  // Promenade: gepflasterter Weg am Nordrand des Strands, mit Laternen
  g.add(stripMesh((x) => -12.2 + 0.4 * Math.sin(x / 5), (x) => -9.4 + 0.4 * Math.sin(x / 5 + 1), 0xd9c4a3, 0.03, { x0: -64, x1: 66, step: 2 }));
  for (let x = -50; x <= 62; x += 16) {
    const l = lamp(); l.position.set(x, 0, -12.6); l.rotation.y = rand() * 0.4; l.scale.setScalar(1.4); g.add(l); circle(x, -12.6, 0.28);
  }
  // Hecke als Nordrand (mit Lücke für die Wäschegasse)
  // Hecke in zwei Teilen: Lücke zur Serpentine (x −54…−46) und zur Wäschegasse (x −4…4)
  g.add(hedge(-66, -8, -25.5, { gapFrom: -54, gapTo: -46, seed: 3 }));
  g.add(hedge(-6, 66, -25.5, { gapFrom: -4, gapTo: 4, seed: 4 }));
  // Absperrungen an den drei Ausgängen (Wege enden hier erstmal)
  const bW = barrier('SURFER-BUCHT – bald'); bW.position.set(-64.5, 0, -2); bW.rotation.y = Math.PI / 2; bW.scale.setScalar(1.3); g.add(bW); rect(-64.5, -2, 1.5, 6.5);

  // Hotel Palmenschatten im Osten (Kulisse), Pool, Rutsche, Liegen mit Rentnern-Handtüchern
  const ho = hotel();
  const hoPos = BUILDING_POS.hotel;
  ho.position.set(hoPos.x, 0, hoPos.z);
  const hs = buildingScale('hotel');
  ho.scale.setScalar(hs);
  // Pool nicht voll mitskalieren (sonst liegt er auf der Promenade): 1.2-fach, östlich neben dem Gebäude
  ho.userData.pool.scale.setScalar(1.2 / hs);
  ho.userData.pool.position.set((BUILDING_POS.pool.x - hoPos.x) / hs, 0, (BUILDING_POS.pool.z - hoPos.z) / hs);
  g.add(ho);
  // Gebäude-Collider kommen aus logic.js (dort gegen die Promenade getestet)
  for (const f of buildingFootprints()) if (f.name === 'hotel' || f.name === 'pool') rect(f.x, f.z, f.w, f.d);
  colliders.push(poolLadderCollider()); // Rutschen-Leiter + Gestell außen am Ostrand des Beckens (getestet in logic.test.js)
  // Strandliegen: Rückenteil am Kopfende (−z lokal), die Leute sitzen mit Blick nach +z = aufs Meer. Sitzpunkt (userData.sitz)
  // in Welt für die Anker liege_1..3 (Liege 3 bleibt frei)
  const liegen = {};
  const liegeId = { 0: 'liege_1', 1: 'liege_2', 3: 'liege_3' };
  for (let i = 0; i < 4; i++) {
    const lo = lounger(i % 2 ? ['#3a7bd5', '#ffffff'] : ['#e8463a', '#fff5e0']);
    const yaw = (rand() - 0.5) * 0.3, ls = 1.3;
    lo.position.set(28 + i * 3.8, 0, -4 + (i % 2) * 1.4);
    lo.rotation.y = yaw;
    lo.scale.setScalar(ls);
    g.add(lo);
    rect(28 + i * 3.8, -4 + (i % 2) * 1.4, 1.6, 3.1);
    const sz = lo.userData.sitz || { x: 0, y: 0.52, z: -0.35 };
    if (liegeId[i]) liegen[liegeId[i]] = { sitz: { x: lo.position.x + (sz.x * Math.cos(yaw) + sz.z * Math.sin(yaw)) * ls, y: sz.y * ls, z: lo.position.z + (-sz.x * Math.sin(yaw) + sz.z * Math.cos(yaw)) * ls }, yaw };
  }

  // Verleih im Westen + Surfer-Siesta
  const re = rental();
  const rePos = BUILDING_POS.rental;
  re.position.set(rePos.x, 0, rePos.z);
  re.rotation.y = 0.25;
  const rs = buildingScale('rental');
  re.scale.setScalar(rs);
  g.add(re);
  for (const f of buildingFootprints()) if (f.name.startsWith('rental')) rect(f.x, f.z, f.w, f.d);
  const su = sleepingSurfer();
  su.position.set(-40, 0, 8);
  su.rotation.y = 0.5;
  g.add(su);
  rect(-40, 8, 1.4, 3.0);

  // Felsen an den Enden des Strands
  for (const [x, z, sc] of [[-60, 8, 1.6], [-63, 4, 1.1], [62, 6, 1.4], [65, 1, 1.0], [58, 10, 0.8]]) {
    const rg = new THREE.SphereGeometry(sc, 6, 5);
    deform(rg, (v) => { v.multiplyScalar(0.85 + 0.3 * rand()); });
    rg.scale(1.3, 0.8, 1);
    const rock = toonMesh(rg, 0x8d8fa0, { outline: 0.06 });
    rock.position.set(x, 0.1, z); rock.rotation.y = rand() * 3; g.add(rock);
    circle(x, z, sc * 1.1);
  }

  // Finale-Hütte auf den Felsen am Weststrand (Zustand aus dem Wochenbogen: verkauf → deine / halb / posten8)
  const huette = finaleHuette(); setHuette(huette, 'verkauf');
  huette.position.set(-62.5, 0, 8.5); huette.rotation.y = Math.PI / 2; huette.scale.setScalar(1.5); g.add(huette); // Tür nach Osten
  rect(-62.5, 8.5, 3.8, 3.5);

  // Palmen entlang des Strands (Position, Neigung, Seed)
  const palms = [
    [-60, -1, [1.2, 0, 0.6], 1], [-57, 7, [-0.9, 0, 0.8], 2], [-36, -9, [0.8, 0, 0.3], 3],
    [-14, 1, [1.1, 0, 0.5], 4], [-9, 5, [-0.8, 0, 0.7], 5], [2, -9, [0.6, 0, 0.9], 6],
    [16, 3, [-1.0, 0, 0.6], 7], [26, -6, [1.2, 0, -0.3], 8], [52, 2, [0.7, 0, 0.9], 9],
    [60, -9, [-1.1, 0, 0.4], 10], [-38, -13, [0.5, 0, 1.0], 11], [22, 8, [-0.6, 0, 0.8], 12],
  ];
  const palmObjs = [];
  for (const [x, z, l, s] of palms) {
    const p = palm({ lean: new THREE.Vector3(...l), seed: s, height: 4.3 + (s % 3) * 0.3 });
    p.position.set(x, 0, z);
    p.scale.setScalar(1.4); // neben den größeren Gebäuden sonst winzig
    g.add(p);
    palmObjs.push(p);
    circle(x, z, 0.63);
    // Krone als Kugel (Welt): Mitte = Stammspitze, Radius = Blattlänge. Für die Verdeckung reicht der Strahl bei
    // der großen flachen Krone nicht, deshalb wird die ganze Palme ausgeblendet, sobald die Kugel die Sichtlinie berührt.
    const top = p.userData.curve.getPointAt(1).multiplyScalar(1.4);
    p.userData.crown = { x: x + top.x, y: top.y - 0.6, z: z + top.z, r: 4.8 };
  }
  // Hängematte zwischen Palme 4 und 5 (Versteck hinter der Bar)
  {
    const a = palmObjs[3].userData.curve.getPointAt(0.42).multiplyScalar(1.4).add(palmObjs[3].position);
    const b = palmObjs[4].userData.curve.getPointAt(0.42).multiplyScalar(1.4).add(palmObjs[4].position);
    g.add(hammock(a, b));
  }

  // Bangi Bar (Westen der Mitte), davor Start
  const bar = beachBar();
  const barPos = BUILDING_POS.bar;
  bar.position.set(barPos.x, 0, barPos.z);
  bar.rotation.y = 0.08;
  const bs = buildingScale('bar');
  bar.scale.setScalar(bs);
  g.add(bar);
  // Barkeeper Nong hinter der Theke (bar-lokal zwischen Regal und Theke, Skala auf Figurenmaß zurück)
  const nong = buildNong(); nong.position.set(-0.7, 0, -0.1); nong.scale.setScalar(1 / bs); bar.add(nong);
  // Lichterkette rundherum an der Dachkante (abends glühen die Birnchen, siehe licht.js); dreht mit der Bar mit
  { const c = Math.cos(bar.rotation.y), sn = Math.sin(bar.rotation.y);
    const V = (lx, ly, lz) => new THREE.Vector3(barPos.x + (lx * c + lz * sn) * bs, ly * bs, barPos.z + (-lx * sn + lz * c) * bs);
    // unter der Traufe (Dachsaum endet bei y 2.75, Radius ≈ 4.1 × 3.4): knapp darunter, nicht im Dach. Drei Seiten (Rückwand + Flanken),
    // die Tresenseite bleibt frei: von der Meerseite (Bar-Kamera) hingen die Birnen sonst vor den Gesichtern
    g.add(lichterkette([V(-3.4, 2.6, 2.7), V(-3.4, 2.6, -2.7), V(3.4, 2.6, -2.7), V(3.4, 2.6, 2.7)])); }
  for (const f of buildingFootprints()) if (f.name === 'bar') rect(f.x, f.z, f.w, f.d); // Theke + Rückwand
  bCircle(barPos, bs, -2.1, -1.1, 0.25); bCircle(barPos, bs, 2.1, -1.1, 0.25); bCircle(barPos, bs, -1.9, 1.0, 0.25); bCircle(barPos, bs, 2.1, 1.0, 0.25);
  bCircle(barPos, bs, -1.1, 1.9, 0.4); bCircle(barPos, bs, 0.5, 1.9, 0.4); // Hocker

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
  sp.scale.setScalar(1.25);
  g.add(sp);
  circle(4, -1, 0.38);

  // Strand-Deko
  const ps = parasol(); ps.position.set(-18, 0, 6); ps.scale.setScalar(1.3); g.add(ps); circle(-17.55, 6, 0.2);
  const ps2 = parasol(); ps2.position.set(46, 0, 4); ps2.rotation.y = 2.2; ps2.scale.setScalar(1.3); g.add(ps2); circle(46.45, 4, 0.2);
  const ball = beachBall(); ball.position.set(-20, 0.42, 9.5); g.add(ball); circle(-20, 9.5, 0.45);
  const mb = mailbox(); mb.position.set(-18.5, 0, -8.5); mb.rotation.y = 0.4; mb.scale.setScalar(1.2); g.add(mb); circle(-18.5, -8.5, 0.42);
  for (const [x, z] of [[-12, 8], [-11.4, 8.4], [30, 7], [57, 3]]) {
    const c = coconut(); c.position.set(x, 0, z); c.rotation.z = rand() * 2; g.add(c);
  }
  const cr = crab(); cr.position.set(10, 0, 9); cr.rotation.y = 1.3; g.add(cr);

  // Himmel: Sonne (stoned) und Wolken weit weg
  // Himmelsobjekte: nicht faden und nicht im Nebel verblassen (eigene Materialkopien ohne fog)
  const noFog = (o) => o.traverse((m) => {
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const copies = mats.map((mat) => { if (mat.isShaderMaterial) return mat; const c = mat.clone(); c.fog = false; return c; });
    m.material = Array.isArray(m.material) ? copies : copies[0];
  });
  const sonne = sun(); sonne.position.set(70, 48, -170); sonne.scale.setScalar(5); sonne.userData.noFade = true; noFog(sonne); g.add(sonne); // wandert über licht.js
  for (const [x, y, z, k] of [[-120, 42, -180, 1], [-20, 50, -200, 2], [140, 38, -150, 3], [-200, 30, -60, 4], [220, 34, -20, 5]]) {
    const c = cloud(k); c.position.set(x, y, z); c.scale.setScalar(4); c.userData.noFade = true; noFog(c); g.add(c);
  }

  // Hingucker: in jedem Kamerablick sollen 2–3 kleine Dinge liegen
  const sc = sandcastle(); sc.position.set(-6, 0, 9); sc.rotation.y = 0.4; g.add(sc); circle(-6, 9, 1.3);
  const sc2 = sandcastle(); sc2.position.set(48, 0, 9); sc2.scale.setScalar(0.7); g.add(sc2); circle(48, 9, 0.9);
  for (const [x, z, sd] of [[-38, 11, 2], [20, 12, 3], [-55, 10, 4]]) {
    const d = driftwood(sd); d.position.set(x, 0, z); g.add(d);
  }
  const shellColors = [0xffd5e0, 0xfff1c2, 0xffb6a3, 0xf4f4f8, 0xd9b3ff];
  for (let i = 0; i < 26; i++) {
    const x = WORLD.minX + 4 + rand() * (WORLD.maxX - WORLD.minX - 8);
    const z = shoreZ(x) - 1 - rand() * 9;
    const sh = shell(shellColors[i % shellColors.length], i + 7);
    sh.position.set(x, 0, z); sh.scale.setScalar(0.7 + rand() * 0.6); g.add(sh);
  }
  for (const [x, z, col] of [[-16, 11, 0xff8c42], [8, 13, 0xff5fa2], [34, 12, 0xffd54a], [-48, 12, 0xff8c42], [60, 7, 0xff5fa2]]) {
    const st = starfish(col); st.position.set(x, 0, z); st.rotation.y = rand() * 3; g.add(st);
  }
  const cr2 = crab(); cr2.position.set(-30, 0, 11); cr2.rotation.y = -0.8; g.add(cr2);
  const cr3 = crab(); cr3.position.set(52, 0, 6); cr3.rotation.y = 2.4; g.add(cr3);

  // Snap-/Startpunkte: Spielerposition + Blickrichtung (Kamera steht im Norden → yaw ≈ π schaut zur Kamera)
  const spots = {
    start: { x: -11, z: 5, yaw: 2.7 }, // östlich der Hängematten-Palme: Bar-Dach und Palmenkrone bleiben aus dem Startbild
    bar: { x: -27, z: 2.5, yaw: 0.4 },
    pier: { x: -37, z: 9, yaw: 0.4 },
    mitte: { x: 6, z: 5, yaw: -2.4 },
    hotel: { x: 20, z: -4, yaw: 1.3 },
    liegen: { x: 33, z: 2.5, yaw: Math.PI },
    verleih: { x: -46, z: 7, yaw: 0.3 },
    ost: { x: 58, z: -2, yaw: Math.PI / 2 },
    hecke: { x: 8, z: -17, yaw: 0.3 }, // Strandseite vor der Heckenlücke („nord“ gehört dem Dorf)
  };
  return { group: g, colliders, spots: { ...spots, ...dorf.spots, ...huegel.spots, ...markt.spots, ...hafen.spots, ...reis.spots, ...hain.spots }, hideouts: [...dorf.hideouts, ...(markt.hideouts || []), ...(hafen.hideouts || []), ...(hain.hideouts || [])], dorf, huegel, markt, pier: hafen, reis, hain, sonne, nong, huette, wegweiser: sp, liegen, surfer: su };
}
