// figures.js — die Figuren, ohne Rig, aber mit Pivot-Gruppen, die sich animieren lassen:
// userData.parts = { body, legs: [L, R], arms: [L, R], head }. Beine/Arme drehen um Hüfte/Schulter (x-Achse).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMesh, toon, deform, BLACK, textTexture, stripeTexture } from './toon.js';
import { limb, coconut } from './props.js';
import { faceDecal, schluffiFace, runnerFace, face, setFace } from './faces.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smoothstep = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- Schuhe ----------
// side: 'L' (links) | 'R' (rechts). Die Figur schaut nach +z, ihr linker Fuß steht bei -x; die Innenseite
// des linken Fußes zeigt also nach +x. Gespiegelt wird über das Vorzeichen m (keine negative Skalierung,
// sonst kippen die Kontur-Hüllen). Großer Zeh innen, Zehenkappe zur Innenseite gezogen, Streifen nur außen.
const sideSign = (side) => (side === 'R' ? -1 : 1);

export function sandal(skin, side = 'L') {
  const m = sideSign(side);
  const g = new THREE.Group();
  const soleGeo = new RoundedBoxGeometry(0.54, 0.15, 1.12, 3, 0.05);
  const toeward = (v) => { if (v.z > 0.1) v.x += m * 0.06 * (v.z - 0.1) / 0.46; }; // Sohle vorn zur Innenseite
  deform(soleGeo, toeward);
  const sole = toonMesh(soleGeo, 0x6e4120, { outline: 0.045 });
  sole.position.y = 0.075;
  g.add(sole);
  const sole2Geo = new RoundedBoxGeometry(0.5, 0.06, 1.06, 3, 0.03);
  deform(sole2Geo, toeward);
  const sole2 = toonMesh(sole2Geo, 0xe0a86a, { outline: 0.025 });
  sole2.position.y = 0.17;
  g.add(sole2);
  const footGeo = new RoundedBoxGeometry(0.42, 0.16, 0.74, 3, 0.07);
  deform(footGeo, (v) => { if (v.z < -0.22) v.y += 0.06; if (v.z > 0.1) v.x += m * 0.04 * (v.z - 0.1) / 0.27; });
  const foot = toonMesh(footGeo, skin, { outline: 0.04 });
  foot.position.set(0, 0.27, -0.12);
  g.add(foot);
  // Zehen: der große innen (+x·m), nach außen kleiner und weiter hinten
  const toes = [[0.16, 0.11], [0.04, 0.085], [-0.06, 0.075], [-0.145, 0.067], [-0.22, 0.06]];
  for (const [x, r] of toes) {
    const t = toonMesh(new THREE.SphereGeometry(r, 9, 7), skin, { outline: 0.03 });
    t.position.set(m * x, 0.2 + r * 0.5, 0.3 + (0.11 - r) * 0.8);
    g.add(t);
    const nail = toonMesh(new THREE.SphereGeometry(r * 0.45, 6, 5), 0xfff0d8, { outline: 0.015 });
    nail.position.set(0, r * 0.5, r * 0.55);
    t.add(nail);
  }
  const strap1 = toonMesh(new THREE.TorusGeometry(0.24, 0.05, 6, 14, Math.PI), 0x3a1e0c, { outline: 0.03 });
  strap1.position.set(m * 0.02, 0.2, 0.1);
  strap1.rotation.y = -m * 0.12; // Riemchen läuft schräg zum großen Zeh
  g.add(strap1);
  const strap2 = toonMesh(new THREE.TorusGeometry(0.26, 0.05, 6, 14, Math.PI), 0x3a1e0c, { outline: 0.03 });
  strap2.position.set(0, 0.22, -0.22);
  strap2.rotation.x = 0.15;
  g.add(strap2);
  return g;
}

export function sneaker(color = 0xe8463a, side = 'L') {
  const m = sideSign(side);
  const g = new THREE.Group();
  const toeward = (v) => { if (v.z > 0.15) v.x += m * 0.08 * (v.z - 0.15) / 0.46; }; // Zehenkappe zur Innenseite
  const soleGeo = new RoundedBoxGeometry(0.54, 0.22, 1.22, 3, 0.08);
  deform(soleGeo, toeward);
  const sole = toonMesh(soleGeo, 0xffffff, { outline: 0.045 });
  sole.position.y = 0.11;
  g.add(sole);
  const soleLineGeo = new RoundedBoxGeometry(0.57, 0.05, 1.25, 2, 0.02);
  deform(soleLineGeo, toeward);
  const soleLine = toonMesh(soleLineGeo, 0xc9cfdc, { outline: 0.02 });
  soleLine.position.y = 0.07;
  g.add(soleLine);
  const upperGeo = new RoundedBoxGeometry(0.48, 0.36, 1.04, 3, 0.12);
  deform(upperGeo, (v) => {
    if (v.z < -0.28) v.y += 0.1;
    if (v.z > 0.25 && v.y > 0) v.y -= 0.12 * (v.z - 0.25);
    toeward(v);
  });
  const upper = toonMesh(upperGeo, color, { outline: 0.045 });
  upper.position.set(0, 0.38, -0.06);
  g.add(upper);
  const cap = toonMesh(new RoundedBoxGeometry(0.46, 0.2, 0.36, 3, 0.1), 0xffffff, { outline: 0.035 });
  cap.position.set(m * 0.05, 0.3, 0.4);
  cap.rotation.y = -m * 0.1;
  g.add(cap);
  // drei Streifen nur an der Außenseite
  for (let i = 0; i < 3; i++) {
    const stripe = toonMesh(new THREE.BoxGeometry(0.03, 0.26, 0.07), 0xffffff, { outline: 0.015 });
    stripe.position.set(-m * 0.245, 0.38, -0.02 + i * 0.14);
    stripe.rotation.x = -0.5;
    g.add(stripe);
  }
  const tongue = toonMesh(new THREE.BoxGeometry(0.24, 0.28, 0.08), 0xb83428, { outline: 0.03 });
  tongue.position.set(m * 0.02, 0.6, -0.28);
  tongue.rotation.set(0.4, 0, -m * 0.08);
  g.add(tongue);
  for (let i = 0; i < 4; i++) {
    const lace = toonMesh(new THREE.BoxGeometry(0.32, 0.055, 0.07), 0xffffff, { outline: 0.02 });
    lace.position.set(m * 0.015 * i, 0.6 - i * 0.05, -0.16 + i * 0.11);
    lace.rotation.set(0.35, 0, -m * 0.1);
    g.add(lace);
  }
  const heel = toonMesh(new THREE.BoxGeometry(0.2, 0.16, 0.05), 0xffffff, { outline: 0.02 });
  heel.position.set(0, 0.62, -0.54);
  g.add(heel);
  return g;
}

// Hawaiihemd-Textur (Canvas)
export function hawaiiTexture(base = '#ff7f3f', petals = ['#ffe14a', '#3bb84a']) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14; i++) {
    const x = (i * 97) % 256, y = (i * 61 + 30) % 256;
    ctx.fillStyle = petals[i % petals.length];
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 1.26) * 16, y + Math.sin(k * 1.26) * 16, 11, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Schluffi (Spielerfigur). Füße auf y=0, Blick nach +z.
 * Aufbau: root → body (Pivot an der Hüfte, schief/zurückgelehnt) → Rumpf, Arme (Pivot Schulter), Kopf.
 *         root → legs[] (Pivot an der Hüfte) → Bein + Shorts + Sandale.
 */
// ---------- Hemd mit Bauch (Spieler, Mentor) ----------
// Eine geschlossene Hemdkugel, die vorn unten selbst die Bauchwölbung trägt und am Saum glatt abgeschnitten ist
// (wellige Kante). Der nackte Bauch ist nur der Teil UNTER dem Saum; sein oberer Teil ist verschlankt und liegt
// mit ≥ 2 cm Luft im Hemd — Teile, die aus dem Hemd herausragen, stechen samt Konturhülle durch. Maße rechnerisch
// geprüft (Hülle 0.035 gegen die verformte Hemdfläche). Rückgabe { torso, belly }, alles hängt an parent.
export function hemdMitBauch(parent, hemdMat, skin, { hipY = 1.0, bellyR = 0.34, knoepfe = false } = {}) {
  const shirtDeform = (v) => {
    const bulge = smoothstep(-v.y, -0.15, 0.32);    // 0 an der Brust … 1 am Saum
    v.z = v.z * 0.85 + 0.36 * bulge * Math.max(0, v.z) / 0.5;
    const hem = -0.32 + 0.03 * Math.sin(5 * Math.atan2(v.z, v.x)); // Saum
    if (v.y < hem) v.y = hem;
  };
  const tg = new THREE.SphereGeometry(0.5, 20, 16);
  deform(tg, shirtDeform);
  const torso = toonMesh(tg, hemdMat, { outline: 0.05 });
  torso.position.set(0, hipY + 0.42, 0.05);
  torso.rotation.x = 0.12;
  parent.add(torso);
  const bellyGeo = new THREE.SphereGeometry(bellyR, 16, 12);
  deform(bellyGeo, (v) => { const k = 1 - 0.7 * smoothstep(v.y, -0.15, 0.18); v.x *= k; v.z *= k; }); // oben schlanker: bleibt im Hemd
  const belly = toonMesh(bellyGeo, skin, { outline: 0.035 });
  belly.position.set(0.02, hipY - 0.02, 0.3);
  parent.add(belly);
  const navel = toonMesh(new THREE.SphereGeometry(0.035, 6, 5), BLACK, { outline: 0, basic: true });
  navel.position.set(0, -0.08, bellyR - 0.015);
  belly.add(navel);
  if (knoepfe) for (let i = 0; i < 3; i++) { // Knöpfe sitzen auf der Hemdfläche (gleiche Verformung), als Kinder des Hemds
    const p = new THREE.Vector3(-0.3 + i * 0.07, 0.2 - i * 0.14, 0);
    p.z = Math.sqrt(Math.max(0, 0.25 - p.x * p.x - p.y * p.y));
    shirtDeform(p);
    const btn = toonMesh(new THREE.SphereGeometry(0.035, 6, 5), 0xfff5e0, { outline: 0.012 });
    btn.position.set(p.x, p.y, p.z + 0.012);
    torso.add(btn);
  }
  return { torso, belly };
}

// ---------- Schattenwurf am Kopf ----------
// Kopfbedeckungen, Haare, Brillen werfen keinen Schatten: Gesichter müssen lesbar bleiben (Kernmechanik), und ein
// Hutschatten übers ganze Gesicht sieht wie ein grauer Schleier aus. Der Schädel (erstes Kind der Kopfgruppe) wirft
// weiter, damit der Bodenschatten einen Kopf hat. Konturhüllen werfen ohnehin nicht.
export function kopfOhneSchattenwurf(head, schaedel = head.children[0]) {
  head.traverse((m) => { if (m.isMesh && m !== schaedel && m.parent !== schaedel) m.castShadow = false; });
  return head;
}
export function keinSchattenwurf(...objs) {
  for (const o of objs) o.traverse((m) => { if (m.isMesh) m.castShadow = false; });
}

// Kopfbedeckungen für den Spieler (Auswahl offen): stirnband (bisher) | radkappe | flatcap | strohhut | bandana
export const SCHLUFFI_KOEPFE = ['stirnband', 'radkappe', 'flatcap', 'strohhut', 'bandana'];
export function punkteTextur(bg = '#e8463a', punkt = '#ffffff') { // uni mit kleinen Punkten (Bandana)
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, 128, 128); ctx.fillStyle = punkt;
  for (let y = 0; y < 128; y += 16) for (let x = 0; x < 128; x += 16) { ctx.beginPath(); ctx.arc(x + 8 + (y / 16 % 2) * 8, y + 8, 2.6, 0, Math.PI * 2); ctx.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 2);
  return tex;
}
// Flacher Streifen auf einer Kugelkappe: dünnes Kugelsegment knapp über der Fläche (keine Stäbe durch den Kopf)
function kappenStreifen(r, color, phiStart, phiLen, thetaStart = 0, thetaLen = Math.PI * 0.45) {
  return toonMesh(new THREE.SphereGeometry(r * 1.012, 12, 6, phiStart, phiLen, thetaStart, thetaLen), color, { outline: 0, shadow: false });
}
function schluffiKopfbedeckung(head, kopf, locken = [], brille = []) {
  const g = new THREE.Group(); head.add(g);
  // Unter Hüten verschwinden die vorderen Locken, die übrigen rutschen auf y 0.06 und werden gestaucht (Oberkante samt Hülle
  // 0.21–0.24, unter Flatcap-Rand 0.45, Strohhut-Krempe ≥ 0.295, Kappen-/Bandana-Rand 0.19–0.21): lugen seitlich und hinten
  // hervor. Die hochgeschobene Sonnenbrille (zwei Ringe oben auf dem Kopf) gibt es nur beim Stirnband.
  if (kopf !== 'stirnband') {
    locken.forEach((h, i) => { if (i === 1 || i === 2) h.visible = false; else { h.position.y = 0.06; h.scale.y = 0.8; } });
    for (const b of brille) b.visible = false;
  }
  const add = (m) => { g.add(m); return m; };
  switch (kopf) {
    case 'radkappe': { // Fahrradmütze: braune Kappe, zwei flache orange Streifen, Schirm an der Unterkante, Kettenblatt vorn auf der Kappe
      const cap = add(toonMesh(new THREE.SphereGeometry(0.58, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.47), 0x6b4423, { outline: 0.045 })); cap.position.set(0, 0.12, -0.03); cap.rotation.x = -0.1;
      for (const s of [-1, 1]) { const st = kappenStreifen(0.58, 0xff7f3f, Math.PI / 2 + s * 0.22 - 0.06, 0.12, 0, Math.PI * 0.42); cap.add(st); } // Streifen von vorn nach hinten, nur auf der Fläche
      const schirm = add(toonMesh(new THREE.BoxGeometry(0.5, 0.035, 0.26), 0x6b4423, { outline: 0.025 })); schirm.position.set(0, 0.2, 0.62); schirm.rotation.x = 0.1; // unten an der Kappe, flach nach vorn
      const schirmUnten = add(toonMesh(new THREE.BoxGeometry(0.46, 0.012, 0.22), 0xff7f3f, { outline: 0, shadow: false })); schirmUnten.position.set(0, 0.178, 0.63); schirmUnten.rotation.x = 0.1;
      const logo = new THREE.Group(); logo.position.set(0, 0.36, 0.5); logo.rotation.x = -0.45; add(logo); // vorn auf der Kappe, folgt der Wölbung
      logo.add(toonMesh(new THREE.TorusGeometry(0.1, 0.022, 6, 14), 0xff7f3f, { outline: 0.01 }));
      for (let i = 0; i < 7; i++) { const z = toonMesh(new THREE.BoxGeometry(0.03, 0.05, 0.02), 0xff7f3f, { outline: 0 }); const a = i / 7 * Math.PI * 2; z.position.set(Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0); z.rotation.z = a; logo.add(z); } // Zähne
      logo.add(toonMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8), 0x2b1b0b, { outline: 0 })).rotation.x = Math.PI / 2;
      break;
    }
    case 'flatcap': { // Schiebermütze: nur minimal größer als der Kopf, flacher Teller, vorn auf den Schirm gezogen, Tweed
      const tellerGeo = new THREE.SphereGeometry(0.59, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.4); tellerGeo.scale(1, 0.62, 1.06);
      const teller = add(toonMesh(tellerGeo, toon(0xffffff, { map: stripeTexture(['#8a6b4a', '#6b5238', '#8a6b4a', '#a0805c'], { vertical: true }) }), { outline: 0.045 })); teller.position.set(0, 0.32, 0.0); teller.rotation.x = 0.16;
      const schirm = add(toonMesh(new THREE.BoxGeometry(0.44, 0.04, 0.24), 0x6b5238, { outline: 0.03 })); schirm.position.set(0, 0.33, 0.6); schirm.rotation.x = -0.08;
      const knopf = add(toonMesh(new THREE.SphereGeometry(0.035, 6, 5), 0x6b5238, { outline: 0.012 })); knopf.position.set(0, 0.69, 0);
      break;
    }
    case 'strohhut': { // zerfranster Strohhut, Krempe krumm, Band aus Gras
      const top = add(toonMesh(new THREE.CylinderGeometry(0.4, 0.46, 0.36, 14), 0xe3b04b, { outline: 0.04 })); top.position.set(0, 0.55, -0.02); top.rotation.z = 0.08;
      const krempeGeo = new THREE.CylinderGeometry(0.92, 0.95, 0.05, 20); deform(krempeGeo, (v) => { v.y += 0.08 * Math.sin(Math.atan2(v.z, v.x) * 4 + 1); });
      const krempe = add(toonMesh(krempeGeo, 0xe3b04b, { outline: 0.04 })); krempe.position.set(0, 0.4, -0.02); krempe.rotation.set(0.12, 0, 0.08);
      const band = add(toonMesh(new THREE.CylinderGeometry(0.42, 0.47, 0.08, 14), 0x3bb84a, { outline: 0.02 })); band.position.set(0, 0.43, -0.02);
      for (let i = 0; i < 6; i++) { const f = toonMesh(new THREE.BoxGeometry(0.03, 0.12, 0.02), 0xd9a84a, { outline: 0 }); const a = i * 1.05; f.position.set(Math.cos(a) * 0.96, 0.4 + 0.08 * Math.sin(a * 4 + 1), Math.sin(a) * 0.96 - 0.02); f.rotation.set(0.4, a, 0.3); add(f); } // Fransen
      break;
    }
    case 'bandana': { // Kopftuch, uni rot mit kleinen weißen Punkten, Knoten im Nacken, Zipfel
      const tuchGeo = new THREE.SphereGeometry(0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.44); deform(tuchGeo, (v) => { if (v.z < -0.3) v.y -= 0.1 * (-v.z - 0.3); });
      const tuch = add(toonMesh(tuchGeo, toon(0xffffff, { map: punkteTextur('#e8463a', '#ffffff') }), { outline: 0.045 })); tuch.position.set(0, 0.1, -0.03); tuch.rotation.x = -0.2;
      const knoten = add(toonMesh(new THREE.SphereGeometry(0.12, 8, 6), 0xe8463a, { outline: 0.025 })); knoten.position.set(0, 0.05, -0.6);
      for (const s of [-1, 1]) { const z = toonMesh(new THREE.BoxGeometry(0.1, 0.4, 0.04), 0xe8463a, { outline: 0.025 }); z.position.set(s * 0.12, -0.15, -0.62); z.rotation.set(0.3, 0, s * 0.5); add(z); }
      break;
    }
    default: { // stirnband (Original)
      const band = add(toonMesh(new THREE.TorusGeometry(0.43, 0.065, 8, 24), 0xe8463a, { outline: 0.03 })); band.position.set(0, 0.44, 0); band.rotation.set(Math.PI / 2 + 0.1, 0, 0.05);
      for (const s of [-1, 1]) { const tail = toonMesh(new THREE.BoxGeometry(0.08, 0.3, 0.05), 0xe8463a, { outline: 0.025 }); tail.position.set(s * 0.1, 0.28, -0.44); tail.rotation.z = s * 0.4; add(tail); }
    }
  }
  return g;
}
export function schluffi({ kopf = 'stirnband' } = {}) {
  const root = new THREE.Group();
  const skin = 0xf0b98a;
  const stance = 0.6;
  const hipY = 1.0;
  const legs = [];
  for (const s of [-1, 1]) {
    const hipX = s * 0.3;
    const leg = new THREE.Group();
    leg.position.set(hipX, hipY, 0);
    const footX = s * stance - hipX;
    leg.add(limb(V(footX * 0.9, 0.25 - hipY, -0.05), V(0, 0, 0), 0.12, skin, { outline: 0.04 }));
    const shorts = toonMesh(new THREE.CylinderGeometry(0.21, 0.24, 0.45, 12), 0x2fa9b9, { outline: 0.04 });
    shorts.position.set(0, -0.15, 0);
    shorts.rotation.z = -s * 0.1;
    leg.add(shorts);
    const shoe = sandal(skin, s < 0 ? 'L' : 'R');
    shoe.position.set(footX, -hipY, 0);
    shoe.rotation.y = s * 0.75;
    leg.add(shoe);
    root.add(leg);
    legs.push(leg);
  }

  // Oberkörper-Pivot an der Hüfte: schief und zurückgelehnt
  const body = new THREE.Group();
  body.position.set(0, hipY - 0.1, 0);
  body.rotation.set(-0.14, 0, 0.09);
  root.add(body);
  const inner = new THREE.Group();
  inner.position.set(0, -(hipY - 0.1), 0);
  body.add(inner);

  // Hemd glatt bis zum Hosenbund (kein Bauch mehr — das Bauch-Design lebt beim Mentor und den Bauch-Kunden weiter)
  const tg = new THREE.SphereGeometry(0.5, 16, 12); tg.scale(1.0, 1.0, 0.85);
  const torso = toonMesh(tg, toon(0xffffff, { map: hawaiiTexture() }), { outline: 0.05 });
  torso.position.set(0, hipY + 0.42, 0.05); torso.rotation.x = 0.12; inner.add(torso);
  for (let i = 0; i < 3; i++) { const btn = toonMesh(new THREE.SphereGeometry(0.035, 6, 5), 0xfff5e0, { outline: 0.012 }); btn.position.set(-0.3 + i * 0.07, hipY + 0.62 - i * 0.14, 0.44 - i * 0.03); inner.add(btn); }

  // Arme: Pivot an der Schulter
  const shoulderY = hipY + 0.66;
  const sleeveColor = 0xff7f3f;
  const arms = [];
  {
    const arm = new THREE.Group();
    arm.position.set(-0.48, shoulderY, 0.05);
    arm.add(limb(V(0, 0, 0), V(-0.24, -0.75, 0.1), 0.1, skin, { outline: 0.04 }));
    const sl = toonMesh(new THREE.CylinderGeometry(0.15, 0.16, 0.3, 10), sleeveColor, { outline: 0.035 });
    sl.position.set(-0.04, -0.1, 0.02); sl.rotation.z = 0.35; arm.add(sl);
    const hand = toonMesh(new THREE.SphereGeometry(0.2, 12, 9), skin, { outline: 0.04 });
    hand.position.set(-0.3, -0.92, 0.13); arm.add(hand);
    inner.add(arm); arms.push(arm);
  }
  {
    const arm = new THREE.Group();
    arm.position.set(0.48, shoulderY, 0.05);
    arm.add(limb(V(0, 0, 0), V(0.27, -0.45, 0.4), 0.1, skin, { outline: 0.04 }));
    const sr = toonMesh(new THREE.CylinderGeometry(0.15, 0.16, 0.3, 10), sleeveColor, { outline: 0.035 });
    sr.position.set(0.04, -0.1, 0.05); sr.rotation.z = -0.45; arm.add(sr);
    const hand = toonMesh(new THREE.SphereGeometry(0.2, 12, 9), skin, { outline: 0.04 });
    hand.position.set(0.32, -0.6, 0.5); arm.add(hand);
    const nut = toonMesh(new THREE.SphereGeometry(0.28, 12, 9), 0x6b4423, { outline: 0.04 });
    nut.position.set(0.32, -0.3, 0.55); arm.add(nut);
    arm.add(limb(V(0.36, -0.1, 0.55), V(0.5, 0.35, 0.5), 0.03, 0xff5fa2, { outline: 0.015 }));
    const umb = toonMesh(new THREE.ConeGeometry(0.2, 0.1, 8), 0x3bb84a, { outline: 0.02 });
    umb.position.set(0.5, 0.38, 0.5); umb.rotation.z = -0.4; arm.add(umb);
    inner.add(arm); arms.push(arm);
  }

  // Hals + Kopf
  const neckY = shoulderY + 0.15;
  inner.add(limb(V(0, neckY - 0.2, 0), V(0, neckY + 0.3, 0), 0.14, skin, { outline: 0.035 }));
  const head = new THREE.Group();
  head.position.set(0, neckY + 0.75, 0.12);
  head.rotation.set(0.1, 0.05, 0.2);
  inner.add(head);
  const slobShape = (geo) => { geo.scale(1, 1.12, 1); deform(geo, (v) => { if (v.y < -0.2) { v.x *= 1.0 + 0.3 * (-v.y - 0.2); } }); };
  const hg = new THREE.SphereGeometry(0.55, 28, 20);
  slobShape(hg);
  head.add(toonMesh(hg, skin, { outline: 0.05 }));
  head.add(faceDecal(schluffiFace('#f0b98a'), 0.557, slobShape));
  const nose = toonMesh(new THREE.SphereGeometry(0.15, 10, 8), 0xe89a6a, { outline: 0.03 });
  nose.position.set(0, -0.08, 0.57); head.add(nose);
  for (const s of [-1, 1]) {
    const ear = toonMesh(new THREE.SphereGeometry(0.11, 8, 6), skin, { outline: 0.03 });
    ear.position.set(s * 0.56, 0.0, 0); head.add(ear);
  }
  const locken = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    const h = toonMesh(new THREE.SphereGeometry(0.16 + (i % 3) * 0.03, 10, 7), 0x4a2a12, { outline: 0.035 });
    h.geometry.scale(1.2, 0.8, 1);
    h.position.set(Math.cos(a) * 0.3, 0.52 + (i % 2) * 0.08, Math.sin(a) * 0.25);
    h.rotation.z = a;
    head.add(h); locken.push(h);
  }
  const brille = [];
  for (const s of [-1, 1]) {
    const lens = toonMesh(new THREE.TorusGeometry(0.11, 0.03, 6, 12), BLACK, { outline: 0, basic: true });
    lens.position.set(s * 0.14, 0.6, 0.3); lens.rotation.x = -0.9; head.add(lens); brille.push(lens);
  }
  schluffiKopfbedeckung(head, kopf, locken, brille);

  root.userData.parts = { body, legs, arms, head, baseBodyRot: body.rotation.clone(), baseHeadRot: head.rotation.clone() };
  kopfOhneSchattenwurf(head);
  return root;
}

/** Turnschuh-Typ (NPC): steht kerzengerade, Kopf drehbar (userData.parts.head). */
export function runner() {
  const root = new THREE.Group();
  const skin = 0xe8a773;
  const stance = 0.48;
  const hipY = 1.15;
  for (const s of [-1, 1]) {
    const shoe = sneaker(0xe8463a, s < 0 ? 'L' : 'R');
    shoe.position.set(s * stance, 0, 0);
    shoe.rotation.y = s * 0.28;
    root.add(shoe);
    const fx = s * stance;
    root.add(limb(V(fx, 0.3, -0.1), V(fx, 0.9, -0.08), 0.12, skin, { outline: 0.035 }));
    const sock = toonMesh(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 12), 0xffffff, { outline: 0.03 });
    sock.position.set(fx, 0.62, -0.09);
    root.add(sock);
    root.add(limb(V(fx, 0.82, -0.08), V(s * 0.3, hipY, 0), 0.17, 0xd9c08a, { outline: 0.04 }));
    const cuff = toonMesh(new THREE.CylinderGeometry(0.19, 0.19, 0.1, 12), 0xc4aa74, { outline: 0.03 });
    cuff.position.set(fx, 0.86, -0.08);
    root.add(cuff);
  }
  const tg = new RoundedBoxGeometry(0.95, 0.95, 0.55, 3, 0.2);
  deform(tg, (v) => { if (v.y > 0) v.x *= 1.25; else v.x *= 0.9; });
  const torso = toonMesh(tg, 0xf4f4f8, { outline: 0.05 });
  torso.position.set(0, hipY + 0.5, 0);
  root.add(torso);
  const collar = toonMesh(new THREE.CylinderGeometry(0.26, 0.3, 0.14, 12), 0xdfe3ee, { outline: 0.03 });
  collar.position.set(0, hipY + 0.98, 0);
  root.add(collar);
  for (let i = 0; i < 2; i++) {
    const btn = toonMesh(new THREE.SphereGeometry(0.03, 6, 5), BLACK, { outline: 0, basic: true });
    btn.position.set(0, hipY + 0.86 - i * 0.12, 0.29);
    root.add(btn);
  }
  const belt = toonMesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 14), 0x333333, { outline: 0.03 });
  belt.position.set(0, hipY + 0.05, 0);
  root.add(belt);
  const buckle = toonMesh(new THREE.BoxGeometry(0.14, 0.1, 0.05), 0xffd54a, { outline: 0.02 });
  buckle.position.set(0, hipY + 0.05, 0.43);
  root.add(buckle);

  const shoulderY = hipY + 0.9;
  const sleeve = 0xf4f4f8;
  root.add(limb(V(-0.55, shoulderY, 0), V(-0.95, shoulderY - 0.45, 0.05), 0.11, skin, { outline: 0.04 }));
  root.add(limb(V(-0.95, shoulderY - 0.45, 0.05), V(-0.5, hipY + 0.1, 0.2), 0.1, skin, { outline: 0.04 }));
  const sl = toonMesh(new THREE.CylinderGeometry(0.17, 0.18, 0.3, 10), sleeve, { outline: 0.035 });
  sl.position.set(-0.6, shoulderY - 0.08, 0.02); sl.rotation.z = 0.6; root.add(sl);
  const hand1 = toonMesh(new THREE.SphereGeometry(0.2, 12, 9), skin, { outline: 0.04 });
  hand1.position.set(-0.5, hipY + 0.08, 0.25); root.add(hand1);
  root.add(limb(V(0.55, shoulderY, 0), V(0.85, shoulderY - 0.55, 0.1), 0.11, skin, { outline: 0.04 }));
  root.add(limb(V(0.85, shoulderY - 0.55, 0.1), V(0.45, shoulderY - 0.35, 0.55), 0.1, skin, { outline: 0.04 }));
  const sr = toonMesh(new THREE.CylinderGeometry(0.17, 0.18, 0.3, 10), sleeve, { outline: 0.035 });
  sr.position.set(0.6, shoulderY - 0.08, 0.02); sr.rotation.z = -0.5; root.add(sr);
  const hand2 = toonMesh(new THREE.SphereGeometry(0.2, 12, 9), skin, { outline: 0.04 });
  hand2.position.set(0.4, shoulderY - 0.3, 0.62); root.add(hand2);
  const phone = toonMesh(new THREE.BoxGeometry(0.2, 0.34, 0.04), 0x222233, { outline: 0.025 });
  phone.position.set(0.32, shoulderY - 0.1, 0.72); phone.rotation.set(-0.5, 0.2, 0.1); root.add(phone);
  const screen = toonMesh(new THREE.BoxGeometry(0.16, 0.28, 0.02), 0x6ee7ff, { outline: 0, basic: true });
  screen.position.z = 0.02; phone.add(screen);

  const neckY = shoulderY + 0.15;
  root.add(limb(V(0, neckY - 0.2, 0), V(0, neckY + 0.3, 0), 0.14, skin, { outline: 0.035 }));
  const head = new THREE.Group();
  head.position.set(0, neckY + 0.75, 0);
  root.add(head);
  const boxify = (v) => {
    const len = v.length();
    const n = v.clone().normalize();
    const m = Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z));
    v.copy(n).lerp(n.clone().divideScalar(m), 0.42).multiplyScalar(len);
    if (v.y < -0.1) v.x *= 1.06;
  };
  const runnerShape = (geo) => { deform(geo, boxify); geo.scale(1.0, 1.12, 0.95); };
  const hg = new THREE.SphereGeometry(0.5, 28, 20);
  runnerShape(hg);
  head.add(toonMesh(hg, skin, { outline: 0.05 }));
  head.add(faceDecal(runnerFace('#e8a773'), 0.507, runnerShape));
  const nose = toonMesh(new THREE.BoxGeometry(0.12, 0.26, 0.14), 0xd9966a, { outline: 0.03 });
  nose.position.set(0, -0.1, 0.5); nose.rotation.x = 0.2; head.add(nose);
  for (const s of [-1, 1]) {
    const ear = toonMesh(new THREE.SphereGeometry(0.1, 8, 6), skin, { outline: 0.03 });
    ear.position.set(s * 0.52, -0.02, 0); head.add(ear);
  }
  const capTop = toonMesh(new THREE.SphereGeometry(0.56, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 0x2a3f8f, { outline: 0.045 });
  capTop.position.set(0, 0.2, 0); capTop.rotation.x = -0.12; head.add(capTop);
  const brimGeo = new THREE.BoxGeometry(0.6, 0.07, 0.55);
  deform(brimGeo, (v) => { if (v.z > 0) v.x *= 1 - 0.5 * (v.z / 0.275); });
  const brim = toonMesh(brimGeo, 0x2a3f8f, { outline: 0.035 });
  brim.position.set(0, 0.36, 0.62); brim.rotation.x = -0.2; head.add(brim);
  const capBtn = toonMesh(new THREE.SphereGeometry(0.06, 6, 5), 0x2a3f8f, { outline: 0.02 });
  capBtn.position.set(0, 0.74, 0); head.add(capBtn);
  const bud = toonMesh(new THREE.SphereGeometry(0.06, 6, 5), 0xffffff, { outline: 0.02 });
  bud.position.set(0.58, -0.02, 0.06); head.add(bud);

  root.userData.parts = { head };
  kopfOhneSchattenwurf(head);
  return root;
}

// ---------- Tätigkeits-Posen für stehende Figuren mit userData.parts { legs, arms, head } ----------
// pose(figur, name) setzt Beine/Arme/Kopf (und Requisiten) für eine feste Tätigkeit und gibt den
// Höhenversatz der Figur zurück ({ offsetY }), z. B. fürs Sitzen auf dem Boden. Die Figur merkt sich die
// Pose in userData.pose; wer pro Frame Geh-Posen setzt, lässt Figuren mit gesetzter Pose aus.
export const POSES = ['stehen', 'sitzen', 'liegen', 'liegestuhl', 'handy', 'foto', 'meer', 'winken'];

function poseProp(figur, name, build, parent, pos, rot) {
  const props = figur.userData.poseProps ?? (figur.userData.poseProps = {});
  if (!props[name]) {
    const m = build(); m.position.copy(pos); if (rot) m.rotation.copy(rot); parent.add(m); props[name] = m;
  }
  props[name].visible = true;
  return props[name];
}

export function pose(figur, name = 'stehen') {
  const P = figur.userData.parts;
  if (!P) return { offsetY: 0 };
  const legs = P.legs ?? [], arms = P.arms ?? [];
  for (const l of legs) l.rotation.set(0, 0, 0);
  for (const a of arms) a.rotation.set(0, 0, 0);
  if (P.head) P.head.rotation.set(0, 0, 0);
  figur.rotation.x = 0; figur.rotation.z = 0;
  for (const m of Object.values(figur.userData.poseProps ?? {})) m.visible = false;
  const hipY = legs[0]?.position.y ?? 1.1;
  const sc = figur.scale.y;
  const armR = arms[1], armL = arms[0];
  const hand = V(0.22, -0.92, 0.1); // hängende Hand im Arm-Pivot (kunden.js/figures.js)
  let offsetY = 0, offsetZ = 0;
  switch (name) {
    case 'sitzen': // auf dem Boden, Beine nach vorn, Hände auf den Knien
      for (const l of legs) l.rotation.x = -Math.PI / 2;
      for (const a of arms) a.rotation.x = -0.55;
      if (P.head) P.head.rotation.x = 0.1;
      offsetY = -(hipY - 0.32) * sc;
      break;
    case 'liegestuhl': { // halb liegend auf der Strandliege: Rücken 20° zurück, Beine flach nach vorn, Arme locker
      const a = 0.35;
      figur.rotation.x = -a;
      for (const l of legs) l.rotation.x = -Math.PI / 2 + a;
      for (const arm of arms) arm.rotation.x = -0.25;
      if (armL) armL.rotation.z = 0.2;
      if (armR) armR.rotation.z = -0.2;
      if (P.head) P.head.rotation.x = 0.15;
      offsetY = (0.3 - hipY * Math.cos(a)) * sc;   // Hüfte 0.3 über der Sitzfläche (Sitzhöhe addiert der Aufrufer)
      offsetZ = hipY * Math.sin(a) * sc;             // Hüfte bleibt über dem Sitzpunkt, obwohl der Rumpf zurückkippt
      break;
    }
    case 'liegen': // auf dem Rücken, Arme hinter dem Kopf
      figur.rotation.x = -Math.PI / 2;
      for (const a of arms) a.rotation.x = -3.0;
      if (armL) armL.rotation.z = 0.5;
      if (armR) armR.rotation.z = -0.5;
      offsetY = 0.5 * sc;
      break;
    case 'handy': // tippt, Kopf gesenkt
      if (armR) { armR.rotation.x = -1.9; armR.rotation.z = -0.4; }
      if (armL) { armL.rotation.x = -1.6; armL.rotation.z = 0.35; }
      if (P.head) P.head.rotation.x = 0.5;
      if (armR && !figur.userData.kunde?.accessoire?.includes?.('handy')) {
        poseProp(figur, 'phone', () => {
          const phone = toonMesh(new THREE.BoxGeometry(0.16, 0.3, 0.04), 0x222233, { outline: 0.02 });
          const screen = toonMesh(new THREE.BoxGeometry(0.12, 0.24, 0.02), 0x6ee7ff, { outline: 0, basic: true });
          screen.position.z = 0.02; phone.add(screen); return phone;
        }, armR, hand.clone().add(V(-0.1, 0.1, 0.22)), new THREE.Euler(-1.2, 0.2, 0));
      }
      break;
    case 'foto': // Kamera vor dem Gesicht, beide Hände dran
      for (const a of arms) a.rotation.x = -2.0;
      if (armL) armL.rotation.z = 0.55;
      if (armR) armR.rotation.z = -0.55;
      if (P.head) P.head.rotation.x = -0.05;
      if (armR) poseProp(figur, 'camera', () => {
        const cam = toonMesh(new THREE.BoxGeometry(0.34, 0.22, 0.2), 0x222233, { outline: 0.03 });
        const lens = toonMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 10), 0x555566, { outline: 0.02 });
        lens.position.set(0, 0, 0.14); lens.rotation.x = Math.PI / 2; cam.add(lens);
        const fl = toonMesh(new THREE.BoxGeometry(0.1, 0.06, 0.04), 0xffffff, { outline: 0.012 });
        fl.position.set(0.1, 0.14, 0.04); cam.add(fl); return cam;
      }, armR, hand.clone().add(V(-0.3, 0.05, 0.15)), new THREE.Euler(-1.6, 0, 0));
      break;
    case 'meer': // Hand über den Augen, andere in die Hüfte, Kinn hoch
      if (armR) { armR.rotation.x = -2.7; armR.rotation.z = -0.45; }
      if (armL) { armL.rotation.x = 0.35; armL.rotation.z = 0.85; }
      if (P.head) P.head.rotation.x = -0.18;
      break;
    case 'winken':
      if (armR) { armR.rotation.x = -2.9; armR.rotation.z = -0.35; }
      if (P.head) P.head.rotation.z = -0.1;
      break;
    default:
      break;
  }
  figur.userData.pose = name === 'stehen' ? null : name;
  figur.userData.poseOffsetY = offsetY; figur.userData.poseOffsetZ = offsetZ;
  return { offsetY, offsetZ }; // offsetZ in Blickrichtung der Figur (lokal +z), nur bei „liegestuhl“ ≠ 0
}

// ---------- Barkeeper Nong: poliert seit Jahren dasselbe Glas; die Möwe „Chef“ sitzt auf der Schulter ----------
// Barfuß, Tanktop, lange Hose, Schürze, Glatze, Schnauzer, dunkle Haut; ein Auge immer halb zu, Mund ein Strich.
// buildNong() → Gruppe (Füße auf y = 0, Blick nach +z); updateNong(g, t) = Idle-Loop (polieren, nicken, Möwe);
// setNongMood(g, 'neutral' | 'muede' | 'gruss' | …) tauscht nur das Gesicht (das halb geschlossene Auge bleibt).
const NONG_SKIN = 0x8d5a3a;
const NONG_FACE = { skin: '#8d5a3a', bart: 'schnauzer', beardColor: '#1c1c1c', seed: 41, lids: [0.55, 0.2] }; // Schnauzer nur gemalt, kein 3D-Klotz davor

export function bareFoot(skin, side = 'L') {
  const m = sideSign(side);
  const g = new THREE.Group();
  const footGeo = new RoundedBoxGeometry(0.42, 0.18, 0.78, 3, 0.07);
  deform(footGeo, (v) => { if (v.z < -0.22) v.y += 0.06; if (v.z > 0.1) v.x += m * 0.05 * (v.z - 0.1) / 0.29; });
  const foot = toonMesh(footGeo, skin, { outline: 0.04 }); foot.position.set(0, 0.1, -0.1); g.add(foot);
  for (const [x, r] of [[0.16, 0.1], [0.04, 0.08], [-0.06, 0.07], [-0.145, 0.065], [-0.22, 0.055]]) {
    const t = toonMesh(new THREE.SphereGeometry(r, 9, 7), skin, { outline: 0.03 });
    t.position.set(m * x, 0.05 + r * 0.5, 0.3 + (0.1 - r) * 0.8); g.add(t);
  }
  return g;
}

function nongGull() {
  const g = new THREE.Group();
  const body = toonMesh(new THREE.SphereGeometry(0.17, 10, 8), 0xffffff, { outline: 0.03 }); body.geometry.scale(1.5, 1, 1); g.add(body);
  const head = new THREE.Group(); head.position.set(0.22, 0.17, 0); g.add(head);
  head.add(toonMesh(new THREE.SphereGeometry(0.12, 8, 6), 0xffffff, { outline: 0.025 }));
  const beak = toonMesh(new THREE.ConeGeometry(0.05, 0.18, 6), 0xffb13b, { outline: 0.02 }); beak.position.set(0.16, -0.02, 0); beak.rotation.z = -Math.PI / 2; head.add(beak);
  for (const s of [-1, 1]) { const e = toonMesh(new THREE.SphereGeometry(0.025, 6, 5), BLACK, { outline: 0, basic: true }); e.position.set(0.06, 0.04, s * 0.08); head.add(e); }
  const wing = toonMesh(new THREE.BoxGeometry(0.4, 0.04, 0.22), 0xc9cfdc, { outline: 0.015 }); wing.position.set(-0.05, 0.1, 0.12); g.add(wing);
  const wing2 = toonMesh(new THREE.BoxGeometry(0.4, 0.04, 0.22), 0xc9cfdc, { outline: 0.015 }); wing2.position.set(-0.05, 0.1, -0.12); g.add(wing2);
  for (const s of [-1, 1]) g.add(limb(V(0.02, -0.12, s * 0.06), V(0.02, -0.3, s * 0.07), 0.02, 0xffb13b, { outline: 0.01 }));
  g.userData.parts = { head, wings: [wing, wing2] };
  return g;
}

export function buildNong() {
  const root = new THREE.Group();
  const skin = NONG_SKIN;
  const hipY = 1.1;
  for (const s of [-1, 1]) {
    const foot = bareFoot(skin, s < 0 ? 'L' : 'R'); foot.position.set(s * 0.3, 0, 0.05); foot.rotation.y = s * 0.2; root.add(foot);
    root.add(limb(V(s * 0.3, 0.25, 0), V(s * 0.26, hipY, 0), 0.16, 0x334455, { outline: 0.04 })); // lange Hose
  }
  const belly = toonMesh(new THREE.CylinderGeometry(0.42, 0.52, 0.95, 14), 0xffffff, { outline: 0.045 }); belly.position.set(0, hipY + 0.48, 0); root.add(belly); // Tanktop
  const shoulders = toonMesh(new THREE.SphereGeometry(0.46, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), skin, { outline: 0.04 }); shoulders.position.set(0, hipY + 0.72, 0); root.add(shoulders);
  const apron = toonMesh(new THREE.BoxGeometry(0.8, 1.2, 0.06), 0x2fa9b9, { outline: 0.035 }); apron.position.set(0, hipY + 0.2, 0.5); apron.rotation.x = 0.06; root.add(apron);
  const strap = toonMesh(new THREE.TorusGeometry(0.2, 0.025, 6, 12, Math.PI), 0x2fa9b9, { outline: 0.012 }); strap.position.set(0, hipY + 0.95, 0.3); strap.rotation.x = Math.PI / 2 + 0.4; root.add(strap);
  const belt = toonMesh(new THREE.CylinderGeometry(0.48, 0.48, 0.1, 14), 0x222222, { outline: 0.03 }); belt.position.set(0, hipY + 0.02, 0); root.add(belt);
  const shoulderY = hipY + 0.9;
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.52, shoulderY, 0.02);
    arm.add(limb(V(0, 0, 0), V(s * 0.1, -0.5, 0.3), 0.1, skin, { outline: 0.04 }));
    arm.add(limb(V(s * 0.1, -0.5, 0.3), V(s * -0.1, -0.55, 0.75), 0.09, skin, { outline: 0.04 }));
    const hand = toonMesh(new THREE.SphereGeometry(0.17, 12, 9), skin, { outline: 0.04 }); hand.position.set(s * -0.12, -0.56, 0.82); arm.add(hand);
    root.add(arm); arms.push(arm);
  }
  // rechts das Glas (nie benutzt), links das Tuch
  const glass = new THREE.Group();
  const gbody = toonMesh(new THREE.CylinderGeometry(0.12, 0.09, 0.32, 10), toon(0xdff4ff, { transparent: true, opacity: 0.75 }), { outline: 0.02 }); glass.add(gbody);
  const glint = toonMesh(new THREE.SphereGeometry(0.045, 6, 5), 0xffffff, { outline: 0, basic: true }); glint.position.set(0.07, 0.1, 0.07); glass.add(glint);
  glass.position.set(-0.12, -0.42, 0.9); arms[1].add(glass);
  const cloth = toonMesh(new THREE.BoxGeometry(0.26, 0.05, 0.3), 0xfff1c2, { outline: 0.02 }); cloth.position.set(0.12, -0.5, 0.95); cloth.rotation.z = 0.3; arms[0].add(cloth);
  // Hals + Kopf: Glatze mit Glanz, Schnauzer, ein Auge halb zu
  const neckY = shoulderY + 0.15;
  root.add(limb(V(0, neckY - 0.2, 0), V(0, neckY + 0.3, 0), 0.15, skin, { outline: 0.035 }));
  const head = new THREE.Group(); head.position.set(0, neckY + 0.72, 0.02); root.add(head);
  const shape = (geo) => { geo.scale(1.02, 1.08, 0.98); };
  const hg = new THREE.SphereGeometry(0.52, 28, 20); shape(hg);
  head.add(toonMesh(hg, skin, { outline: 0.05 }));
  const decal = faceDecal(face('kunde', 'neutral', NONG_FACE), 0.527, shape); head.add(decal);
  const nose = toonMesh(new THREE.SphereGeometry(0.13, 10, 8), 0x7a4a2e, { outline: 0.03 }); nose.position.set(0, -0.08, 0.52); head.add(nose);
  for (const s of [-1, 1]) { const ear = toonMesh(new THREE.SphereGeometry(0.1, 8, 6), skin, { outline: 0.03 }); ear.position.set(s * 0.52, -0.02, 0); head.add(ear); }
  const shine = toonMesh(new THREE.SphereGeometry(0.08, 6, 5), 0xffffff, { outline: 0 }); shine.position.set(-0.2, 0.42, 0.25); head.add(shine);
  // Möwe Chef auf der linken Schulter
  const gull = nongGull(); gull.position.set(-0.62, shoulderY + 0.28, 0.05); gull.rotation.y = 0.6; root.add(gull);
  root.userData.parts = { arms, head, decal, glass, glint, cloth, gull };
  root.userData.mood = 'neutral';
  root.userData.update = (t) => updateNong(root, t);
  kopfOhneSchattenwurf(head);
  return root;
}

// Idle-Loop: Tuch kreist übers Glas, Glas dreht sich langsam, alle ~7 s ein Nicken, die Möwe schaut sich um
// und schlägt alle ~9 s kurz mit den Flügeln; abends glänzt das Glas mehr.
export function updateNong(g, t) {
  const P = g.userData.parts;
  if (!P) return;
  const [armL, armR] = P.arms;
  armR.rotation.set(-0.25 + 0.03 * Math.sin(t * 1.3), 0, 0.15);
  P.glass.rotation.y = t * 0.8;
  armL.rotation.set(-0.3 + 0.12 * Math.sin(t * 6), 0.1 * Math.cos(t * 6), 0.25 + 0.08 * Math.sin(t * 6 + 1));
  P.cloth.rotation.set(0.2 * Math.sin(t * 6), 0, 0.3 + 0.3 * Math.cos(t * 6));
  const nod = (t % 7) < 0.6 ? Math.sin((t % 7) / 0.6 * Math.PI) : 0;
  P.head.rotation.set(0.2 * nod, 0.05, 0.04);
  const abend = g.userData.mood === 'muede' ? 1 : 0;
  P.glint.scale.setScalar(1 + 0.5 * abend + 0.4 * Math.max(0, Math.sin(t * 3)));
  const G = P.gull.userData.parts;
  G.head.rotation.y = 0.7 * Math.sin(t * 0.7) + 0.2 * Math.sin(t * 2.3);
  const flap = (t % 9) < 0.8 ? Math.sin((t % 9) / 0.8 * Math.PI * 4) * 0.6 : 0;
  G.wings[0].rotation.x = -flap; G.wings[1].rotation.x = flap;
  G.head.rotation.x = (t % 9) < 0.8 ? -0.3 : 0;
}

// Moods wie faces.js; zusätzlich 'gruss' = neutrales Gesicht, die Braue über dem offenen Auge geht hoch
export function setNongMood(g, mood) {
  const P = g.userData.parts;
  if (!P) return;
  const opts = mood === 'gruss' ? { ...NONG_FACE, brows: ['normal', 'hoch'] } : NONG_FACE;
  setFace(P.decal, face('kunde', mood === 'gruss' ? 'neutral' : mood, opts));
  g.userData.mood = mood;
}

// ---------- Extras für neue Kunden, die buildKunde() nicht kennt: einmal anhängen (idempotent) ----------
// fischgeruch (Stinklinien + Fliege), bauchtasche, sonnenbrand_streifen (helle Trägerränder auf den Armen),
// kreuzfahrt_baendchen (Armband „DECK 7“), rucksack_leer (baumelnder Riemen + Anhänger „0 kg“),
// faehrenticket (Ticket in der Gesäßtasche), handschellen_umriss (Umriss unterm Hemd an der Hüfte).
// opts.index: bei Kunden mit figuren: 2 die Nummer der Figur (0/1) — das Paar teilt sich Kranz (0) und Cap (1),
// damit die Silhouetten unterscheidbar bleiben.
// ---------- Kokos-Verkäufer „Mister Coconut“: läuft die Promenade auf und ab und ruft „Co-co-nut-juice!“ ----------
// Spec data/texte.json → kokosverkaeufer.aussehen: Flip-Flops, Tanktop, lange Hose, dunkle Haut, Schnauzer, Strohhut,
// Bauchladen voller Kokosnüsse mit Strohhalm, kleine Machete im Gürtel, Strohhalm hinterm Ohr, Handtuch über der Schulter,
// Dauerlächeln mit Goldzahn. buildKokosVerkaeufer() → Gruppe (Füße auf y = 0, Blick +z), userData.parts, und:
//   userData.update(t, opts)   Gehen (Beine, Arm, Wippen, Nüsse klappern, Kopf sucht Kundschaft) + laufende Gags;
//                              opts { beine: false } = Beine macht das Spiel, { gehen: false } = Pause in Ruhestellung
//   userData.setRuf(an)        rechte Hand als Megafon an den Mund, Kopf hoch, Mund weit auf
//   userData.gag(name, t)      'verkauf' = Machetenhieb auf die Nuss ohne hinzusehen (1,2 s), 'besonderes' = Brauen zweimal hoch
//                              und runter wie ein Scheibenwischer (1,4 s); t = aktuelle Zeit wie in update(t)
//   userData.setBangiKokos(an) „Bangi-Kokos“ (Nuss mit Filzstift-Blatt) auf dem Tablett ein-/ausblenden (Running Gag ab Tag 2)
// Der Laufweg kommt vom Spiel (Position/Yaw setzen). Exporte auch als updateKokosVerkaeufer / setKokosRuf / kokosGag / setBangiKokos.
const KOKOS_SKIN = 0x8d5a3a;
const KOKOS_FACE = { skin: '#8d5a3a', bart: 'schnauzer', beardColor: '#1c1c1c', seed: 88, goldzahn: true };
function flipFlopEinfach(color, side) {
  const m = sideSign(side);
  const g = new THREE.Group();
  const sole = toonMesh(new RoundedBoxGeometry(0.4, 0.07, 0.72, 3, 0.03), color, { outline: 0.03 }); sole.position.set(0, 0.035, 0.1); g.add(sole);
  const post = V(m * 0.06, 0.07, 0.3);
  g.add(limb(post, V(-m * 0.17, 0.09, 0.02), 0.018, 0x222222, { outline: 0.01 })); // Riemen außen
  g.add(limb(post, V(m * 0.18, 0.09, 0.02), 0.018, 0x222222, { outline: 0.01 }));  // Riemen innen
  return g;
}
export function buildKokosVerkaeufer() {
  const root = new THREE.Group();
  const skin = KOKOS_SKIN, hipY = 1.05;
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.22, hipY, 0);
    leg.add(limb(V(0, 0, 0), V(0, 0.2 - hipY, 0), 0.1, skin, { outline: 0.04 }));
    const hose = toonMesh(new THREE.CylinderGeometry(0.17, 0.2, 0.92, 10), 0x334455, { outline: 0.035 }); hose.position.y = -0.42; leg.add(hose); // lange Hose
    const ff = flipFlopEinfach(0x3dd6e0, s < 0 ? 'L' : 'R'); ff.position.set(0, -hipY, 0.04); ff.rotation.y = s * 0.15; leg.add(ff);
    root.add(leg); legs.push(leg);
  }
  const body = new THREE.Group(); body.position.set(0, hipY - 0.05, 0); root.add(body);
  const torso = toonMesh(new THREE.CylinderGeometry(0.34, 0.39, 0.95, 12), 0xffd54a, { outline: 0.045 }); torso.position.set(0, 0.5, 0); body.add(torso); // Tanktop
  for (const s of [-1, 1]) { const strap = toonMesh(new THREE.BoxGeometry(0.1, 0.3, 0.06), 0xffd54a, { outline: 0.02 }); strap.position.set(s * 0.2, 1.05, 0.2); strap.rotation.x = 0.3; body.add(strap); }
  const guertel = toonMesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 12), 0x5a3b1a, { outline: 0.025 }); guertel.position.y = 0.05; body.add(guertel);
  // kleine Machete im Gürtel (links), Handtuch über der rechten Schulter
  const machete = new THREE.Group(); machete.position.set(-0.42, 0.1, 0.05); machete.rotation.set(0.2, 0, 0.35); body.add(machete);
  machete.add(toonMesh(new THREE.BoxGeometry(0.05, 0.28, 0.03), 0x5a3b1a, { outline: 0.015 }));
  const klinge = toonMesh(new THREE.BoxGeometry(0.1, 0.55, 0.012), 0xc8ccd0, { outline: 0.015 }); deform(klinge.geometry, (v) => { if (v.y < 0 && v.x > 0) v.x += 0.05 * (-v.y / 0.27); }); klinge.position.set(0.03, -0.4, 0); machete.add(klinge);
  const towel = toonMesh(new THREE.BoxGeometry(0.22, 0.8, 0.05), toon(0xffffff, { map: (() => { const t = textTexture('', { bg: '#ff5fa2', w: 64, h: 64 }); return t; })() }), { outline: 0.03 });
  deform(towel.geometry, (v) => { v.z += 0.12 * Math.cos(v.y * 2.2); v.y += 0.06 * Math.sin(v.x * 20); });
  towel.position.set(0.3, 1.0, 0.0); towel.rotation.set(0, 0, -0.1); body.add(towel);
  // Bauchladen: Kiste vor dem Bauch, am Nackenriemen; Nüsse mit Strohhalm darin, eine Bangi-Kokos (versteckt)
  const laden = new THREE.Group(); laden.position.set(0, 0.62, 0.62); body.add(laden);
  const kiste = toonMesh(new THREE.BoxGeometry(1.15, 0.14, 0.6), 0x2fa9b9, { outline: 0.04 }); laden.add(kiste);
  const rand = toonMesh(new THREE.BoxGeometry(1.15, 0.22, 0.05), 0x2fa9b9, { outline: 0.03 }); rand.position.set(0, 0.1, 0.3); laden.add(rand);
  const schild = toonMesh(new THREE.BoxGeometry(0.8, 0.16, 0.02), [toon(0xfff1c2), toon(0xfff1c2), toon(0xfff1c2), toon(0xfff1c2), toon(0xffffff, { map: textTexture('COCONUT JUICE', { bg: '#fff1c2', fg: '#2b1b0b', font: 'bold 64px sans-serif', w: 512, h: 96 }) }), toon(0xfff1c2)], { outline: 0.015 });
  schild.position.set(0, 0.1, 0.34); laden.add(schild);
  const nuesse = [];
  [[-0.38, -0.1], [-0.12, -0.12], [0.14, -0.1], [0.4, -0.12], [-0.25, 0.12], [0.27, 0.12]].forEach(([x, z], i) => {
    const n = coconut(true); n.scale.setScalar(0.42); n.position.set(x, 0.05, z); n.rotation.y = i * 1.3; laden.add(n); nuesse.push(n);
  });
  const bangi = coconut(true); bangi.scale.setScalar(0.42); bangi.position.set(0.01, 0.05, 0.1); bangi.visible = false; laden.add(bangi);
  { // Filzstift-Blatt: grünes Blatt mit schwarzen Adern, auf die Nuss gemalt
    const tex = textTexture('', { bg: 'rgba(0,0,0,0)', w: 128, h: 128 });
    const c = tex.image; const ctx = c.getContext('2d');
    ctx.fillStyle = '#3bb84a'; ctx.strokeStyle = '#111'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(14, 110); ctx.quadraticCurveTo(10, 30, 100, 14); ctx.quadraticCurveTo(118, 90, 14, 110); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, 104); ctx.lineTo(92, 26); ctx.stroke(); for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(20 + i * 18, 104 - i * 20); ctx.lineTo(44 + i * 18, 96 - i * 14); ctx.stroke(); }
    tex.needsUpdate = true;
    const blatt = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    blatt.position.set(0, 0.42, 0.31); blatt.rotation.x = -0.2; bangi.add(blatt);
  }
  for (const s of [-1, 1]) root.add(limb(V(s * 0.55, hipY + 0.57, 0.62), V(s * 0.12, hipY + 1.15, -0.02), 0.025, 0x5a3b1a, { outline: 0.012 })); // Nackenriemen
  // Arme: links trägt den Laden (Hand unter der Kiste), rechts frei bzw. Megafon am Mund bzw. Machete
  const shoulderY = hipY + 0.82;
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.46, shoulderY, 0);
    arm.add(limb(V(0, 0, 0), V(s * 0.16, -0.72, 0.1), 0.09, skin, { outline: 0.035 }));
    const hand = toonMesh(new THREE.SphereGeometry(0.17, 12, 9), skin, { outline: 0.035 }); hand.position.set(s * 0.18, -0.84, 0.12); arm.add(hand);
    if (s === 1) {
      // Megafon-Hand: offener Trichter in Hautfarbe, nur beim Rufen. Achse so, dass er in der Ruf-Pose (Arm um x ≈ −2.45) nach vorn-oben zeigt
      const horn = toonMesh(new THREE.CylinderGeometry(0.2, 0.08, 0.3, 10, 1, true), toon(skin, { side: THREE.DoubleSide }), { outline: 0.02 });
      const d = V(0, -0.78, -0.62).normalize();
      horn.position.set(0.18, -0.84, 0.12).add(d.clone().multiplyScalar(0.22)); horn.quaternion.setFromUnitVectors(V(0, 1, 0), d);
      horn.visible = false; arm.add(horn); arm.userData.horn = horn;
      // Machete in der Hand (nur beim Hieb), Klinge nach vorn
      const mh = new THREE.Group(); mh.position.set(0.18, -0.84, 0.12); mh.rotation.set(-Math.PI / 2 + 0.3, 0, 0); mh.visible = false; arm.add(mh); arm.userData.macheteHand = mh;
      mh.add(toonMesh(new THREE.BoxGeometry(0.05, 0.28, 0.03), 0x5a3b1a, { outline: 0.015 }));
      const kl = toonMesh(new THREE.BoxGeometry(0.1, 0.55, 0.012), 0xc8ccd0, { outline: 0.015 }); kl.position.set(0.03, 0.4, 0); mh.add(kl);
    }
    root.add(arm); arms.push(arm);
  }
  arms[0].rotation.set(-1.25, 0, 0.1); // linker Arm hält den Laden
  // Hals + Kopf: Strohhut, Schnauzer, Goldzahn-Lächeln, Strohhalm hinterm Ohr
  const neckY = shoulderY + 0.12;
  root.add(limb(V(0, neckY - 0.2, 0), V(0, neckY + 0.3, 0), 0.13, skin, { outline: 0.035 }));
  const head = new THREE.Group(); head.position.set(0, neckY + 0.68, 0.03); root.add(head);
  const shape = (geo) => { geo.scale(1, 1.06, 0.97); };
  const hg = new THREE.SphereGeometry(0.48, 24, 18); shape(hg);
  head.add(toonMesh(hg, skin, { outline: 0.045 }));
  const decal = faceDecal(face('kunde', 'zufrieden', KOKOS_FACE), 0.487, shape); head.add(decal);
  const nose = toonMesh(new THREE.SphereGeometry(0.12, 10, 8), 0x7a4a2e, { outline: 0.03 }); nose.position.set(0, -0.06, 0.47); head.add(nose);
  for (const s of [-1, 1]) { const ear = toonMesh(new THREE.SphereGeometry(0.09, 8, 6), skin, { outline: 0.03 }); ear.position.set(s * 0.48, -0.02, 0); head.add(ear); }
  head.add(limb(V(0.5, 0.02, -0.08), V(0.58, 0.3, 0.26), 0.025, 0xff5fa2, { outline: 0.012 })); // Strohhalm hinterm rechten Ohr
  const hutTop = toonMesh(new THREE.CylinderGeometry(0.4, 0.44, 0.3, 14), 0xe3b04b, { outline: 0.035 }); hutTop.position.set(0, 0.5, -0.02); hutTop.rotation.z = 0.06; head.add(hutTop);
  const krempe = toonMesh(new THREE.CylinderGeometry(0.78, 0.8, 0.05, 18), 0xe3b04b, { outline: 0.035 }); deform(krempe.geometry, (v) => { v.y += 0.06 * Math.sin(Math.atan2(v.z, v.x) * 3); }); krempe.position.set(0, 0.37, -0.02); krempe.rotation.set(0.1, 0, 0.06); head.add(krempe);
  const hutband = toonMesh(new THREE.CylinderGeometry(0.42, 0.45, 0.07, 14), 0xe8463a, { outline: 0.02 }); hutband.position.set(0, 0.4, -0.02); head.add(hutband);
  kopfOhneSchattenwurf(head);
  root.userData.parts = { legs, arms, head, body, laden, nuesse, decal, machete, towel, bangi, baseHeadRot: head.rotation.clone() };
  root.userData.ruf = false;
  root.userData.gagLauf = null;
  root.userData.update = (t, opts) => updateKokosVerkaeufer(root, t, opts);
  root.userData.setRuf = (an) => setKokosRuf(root, an);
  root.userData.gag = (name, t) => kokosGag(root, name, t);
  root.userData.setBangiKokos = (an) => setBangiKokos(root, an);
  return root;
}
export function setKokosRuf(g, an) {
  const P = g.userData.parts; if (!P) return;
  g.userData.ruf = !!an;
  setFace(P.decal, face('kunde', an ? 'ruf' : 'zufrieden', KOKOS_FACE));
  P.arms[1].userData.horn.visible = !!an;
}
export function setBangiKokos(g, an) { const P = g.userData.parts; if (P) P.bangi.visible = !!an; }
/** Gag starten: 'verkauf' (Machetenhieb, 1,2 s) oder 'besonderes' (Brauen-Scheibenwischer, 1,4 s); t wie in update(t). */
export function kokosGag(g, name, t) {
  if (!g.userData.parts) return;
  g.userData.gagLauf = { name, t0: t, dauer: name === 'verkauf' ? 1.2 : 1.4 };
}
// opts.beine = false: Beine lässt das Spiel laufen (eigene Geh-Animation), hier nur Oberkörper, Laden, Kopf, Gags.
// opts.gehen = false: Pause — Beine und Arme in Ruhestellung (weich eingeblendet), Nüsse ruhig, Kopf schaut sich weiter um.
export function updateKokosVerkaeufer(g, t, { beine = true, gehen = true } = {}) {
  const P = g.userData.parts; if (!P) return;
  const S = g.userData.schritt ?? (g.userData.schritt = { amp: 1, tLast: t });
  const dt = Math.min(0.1, Math.max(0, t - S.tLast)); S.tLast = t;
  S.amp += ((gehen ? 1 : 0) - S.amp) * Math.min(1, dt * 6); // Gang in ~0,3 s aus- bzw. einblenden
  const w = t * 7, gang = Math.sin(w) * S.amp;
  if (beine) { P.legs[0].rotation.x = 0.55 * gang; P.legs[1].rotation.x = -0.55 * gang; }
  P.body.position.y = (P.legs[0].position.y - 0.05) + 0.03 * Math.abs(Math.cos(w)) * S.amp;
  P.body.rotation.z = 0.04 * gang;
  P.laden.rotation.x = 0.05 * Math.cos(w * 2) * S.amp;
  P.nuesse.forEach((n, i) => { n.position.y = 0.05 + 0.02 * Math.max(0, Math.sin(w * 2 + i)) * S.amp; });
  P.towel.rotation.x = 0.08 * gang;
  const G = g.userData.gagLauf;
  const armR = P.arms[1], mh = armR.userData.macheteHand;
  if (G && t - G.t0 > G.dauer) { // Gag zu Ende: aufräumen
    g.userData.gagLauf = null; mh.visible = false; P.machete.visible = true; P.nuesse.forEach((n) => { n.rotation.x = 0; });
    setFace(P.decal, face('kunde', g.userData.ruf ? 'ruf' : 'zufrieden', KOKOS_FACE));
  }
  if (g.userData.gagLauf?.name === 'verkauf') { // Hieb: Machete aus dem Gürtel, Arm hoch, Schlag auf die mittlere Nuss, Kopf schaut woandershin
    const u = (t - G.t0) / G.dauer;
    mh.visible = true; P.machete.visible = false;
    const hub = u < 0.45 ? smoothstep(u, 0, 0.45) : 1 - smoothstep(u, 0.45, 0.6); // hoch … zack
    armR.rotation.set(-1.0 - 1.6 * hub, 0, -0.35);
    P.nuesse[2].rotation.x = u > 0.58 ? 0.9 : 0;              // Nuss kippt auf: offen
    P.head.rotation.set(0.05, 0.9, 0.1);                        // schaut demonstrativ weg
    return;
  }
  if (g.userData.gagLauf?.name === 'besonderes') { // Scheibenwischer: zweimal hoch/runter
    const u = (t - G.t0) / G.dauer, hoch = Math.floor(u * 4) % 2 === 0;
    setFace(P.decal, face('kunde', 'zufrieden', { ...KOKOS_FACE, brows: hoch ? ['hoch', 'hoch'] : null }));
    P.head.rotation.set(-0.05, 0.1, hoch ? 0.08 : -0.02);
    armR.rotation.set(-0.3, 0, -0.1);
    return;
  }
  if (g.userData.ruf) {
    armR.rotation.set(-2.45, -0.3, -0.4 + 0.03 * Math.sin(t * 9)); // Hand seitlich am Mund, zittert vom Brüllen
    P.head.rotation.set(-0.3 + 0.03 * Math.sin(t * 9), 0.15, 0.08);
  } else {
    armR.rotation.set(-0.5 * gang, 0, -0.1);
    P.head.rotation.set(0.03 * Math.sin(w), 0.35 * Math.sin(t * 0.6), 0.03); // schaut sich nach Kundschaft um
  }
}

export function kundenExtras(figur, k, { index = 0 } = {}) {
  if (!figur || figur.userData.extrasDran) return figur;
  const P = figur.userData.parts; if (!P) return figur;
  const extras = new Set(k?.extras ?? []);
  if ((k?.figuren ?? 1) === 2 && extras.has('blumenkranz') && extras.has('just_married_cap')) { if (index === 0) extras.delete('just_married_cap'); else extras.delete('blumenkranz'); }
  const hipY = P.legs?.[0]?.position.y ?? 1.1, shoulderY = P.arms?.[0]?.position.y ?? hipY + 0.85;
  const E = figur.userData.extrasObj = {};
  const plateTex = (text, w = 384, h = 128) => textTexture(text, { bg: '#fff1c2', fg: '#2b1b0b', font: 'bold 70px sans-serif', w, h });
  const tag = (text, w, h) => { const t = toonMesh(new THREE.BoxGeometry(w, h, 0.02), [toon(0xfff1c2), toon(0xfff1c2), toon(0xfff1c2), toon(0xfff1c2), toon(0xffffff, { map: plateTex(text) }), toon(0xffffff, { map: plateTex(text) })], { outline: 0.015 }); return t; };
  if (extras.has('fischgeruch')) {
    const g = new THREE.Group(); g.position.set(0, shoulderY + 1.5, 0);
    for (let i = 0; i < 3; i++) {
      const pts = []; for (let j = 0; j <= 6; j++) pts.push(V((i - 1) * 0.22 + 0.08 * Math.sin(j * 1.4 + i), j * 0.14, 0));
      g.add(toonMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.022, 5, false), 0x9fbf7a, { outline: 0.012, shadow: false }));
    }
    const fly = toonMesh(new THREE.SphereGeometry(0.045, 5, 4), BLACK, { outline: 0, basic: true }); fly.position.set(0.4, 0.5, 0.2); g.add(fly);
    E.fly = fly; figur.add(g);
  }
  if (extras.has('bauchtasche')) {
    const bag = toonMesh(new RoundedBoxGeometry(0.5, 0.26, 0.2, 3, 0.06), 0xe8463a, { outline: 0.03 }); bag.position.set(0.05, hipY + 0.08, 0.5); bag.rotation.z = 0.1; figur.add(bag);
    const zip = toonMesh(new THREE.BoxGeometry(0.4, 0.03, 0.03), 0x222222, { outline: 0, basic: true }); zip.position.set(0, 0.08, 0.1); bag.add(zip);
    const strap = toonMesh(new THREE.TorusGeometry(0.46, 0.03, 6, 20), 0x222222, { outline: 0.012 }); strap.position.set(0, hipY + 0.1, 0.05); strap.rotation.x = Math.PI / 2 + 0.15; figur.add(strap);
  }
  if (extras.has('sonnenbrand_streifen')) {
    for (const [i, s] of [[0, -1], [1, 1]]) { const arm = P.arms[i]; if (!arm) continue; const ring = toonMesh(new THREE.CylinderGeometry(0.115, 0.12, 0.1, 10), 0xffe0c8, { outline: 0.015 }); ring.position.set(s * 0.04, -0.3, 0.04); ring.rotation.z = -s * 0.25; arm.add(ring); }
    const neck = toonMesh(new THREE.TorusGeometry(0.17, 0.035, 6, 14), 0xffe0c8, { outline: 0.012 }); neck.position.set(0, shoulderY + 0.22, 0); neck.rotation.x = Math.PI / 2; figur.add(neck);
  }
  if (extras.has('kreuzfahrt_baendchen')) {
    const arm = P.arms[0];
    if (arm) { const band = toonMesh(new THREE.TorusGeometry(0.13, 0.035, 6, 12), 0x3a7bd5, { outline: 0.015 }); band.position.set(-0.18, -0.65, 0.08); band.rotation.x = Math.PI / 2; arm.add(band); const t = tag('DECK 7', 0.22, 0.09); t.position.set(-0.3, -0.62, 0.12); t.rotation.z = 0.3; arm.add(t); }
  }
  if (extras.has('rucksack_leer')) {
    figur.add(limb(V(0.3, hipY + 0.9, -0.55), V(0.42, hipY + 0.15, -0.6), 0.025, 0x2f7a3a, { outline: 0.012 }));
    const t = tag('0 kg', 0.3, 0.14); t.position.set(0.42, hipY + 0.05, -0.62); t.rotation.set(0.2, Math.PI, 0.15); figur.add(t);
  }
  if (extras.has('faehrenticket')) {
    const t = toonMesh(new THREE.BoxGeometry(0.26, 0.15, 0.02), [toon(0xffd54a), toon(0xffd54a), toon(0xffd54a), toon(0xffd54a), toon(0xffffff, { map: textTexture('FÄHRE 14:00', { bg: '#ffd54a', fg: '#1a1a1a', font: 'bold 44px sans-serif', w: 384, h: 128 }) }), toon(0xffd54a)], { outline: 0.012 });
    t.position.set(0.22, hipY - 0.12, -0.32); t.rotation.set(0.1, Math.PI, 0.35); figur.add(t);
  }
  if (extras.has('handschellen_umriss')) {
    const g = new THREE.Group(); g.position.set(0.44, hipY + 0.12, -0.18); g.rotation.set(0, -0.8, 0.2);
    for (const dz of [-0.07, 0.07]) { const c = toonMesh(new THREE.TorusGeometry(0.075, 0.022, 5, 10), 0x6a6a7a, { outline: 0.012 }); c.position.z = dz; c.rotation.y = Math.PI / 2; g.add(c); }
    figur.add(g);
  }
  // --- Accessoires, die buildKunde() nicht kennt ---
  if (k?.accessoire === 'kegelhut' && P.head) {
    const hat = toonMesh(new THREE.ConeGeometry(0.95, 0.55, 14), 0xe3b04b, { outline: 0.04 }); hat.position.set(0, 0.5, 0); hat.rotation.z = 0.06; P.head.add(hat);
    const band = toonMesh(new THREE.TorusGeometry(0.12, 0.02, 6, 10, Math.PI), 0x222222, { outline: 0.01 }); band.position.set(0, -0.3, 0.2); band.rotation.x = 0.4; P.head.add(band); keinSchattenwurf(hat, band);
  }
  if (k?.accessoire === 'helm_delle' && P.head) {
    // Helm groß genug, dass die Haarkappe (r 0.55 um y 0.12) samt Konturhülle ganz drunter bleibt — sonst sticht
    // das Haar oben und an den Seiten durch; lockiges Haar passt unter keinen Helm (unter dem Helm kurz tragen)
    const helm = toonMesh(new THREE.SphereGeometry(0.63, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), 0xffd54a, { outline: 0.045 }); helm.position.set(0, 0.14, 0); helm.rotation.z = 0.08; P.head.add(helm);
    const brim = toonMesh(new THREE.BoxGeometry(0.5, 0.05, 0.3), 0xffd54a, { outline: 0.03 }); brim.position.set(0, 0.2, 0.64); P.head.add(brim);
    const dent = toonMesh(new THREE.SphereGeometry(0.16, 8, 6), 0xe8a034, { outline: 0.02 }); dent.geometry.scale(1, 0.5, 1); dent.position.set(0.29, 0.66, 0.2); dent.rotation.z = -0.6; P.head.add(dent);
    E.helm = helm; keinSchattenwurf(helm, brim, dent);
  }
  if (extras.has('schlamm_bis_knie')) {
    for (const [i, s] of [[0, -1], [1, 1]]) { const leg = P.legs?.[i]; if (!leg) continue; const mud = toonMesh(new THREE.CylinderGeometry(0.16, 0.19, 0.5, 10), 0x6b4a2a, { outline: 0.03 }); mud.position.set(s * 0.18, -hipY + 0.42, -0.03); leg.add(mud); }
  }
  if (extras.has('hose_hochgekrempelt')) {
    for (const [i, s] of [[0, -1], [1, 1]]) { const leg = P.legs?.[i]; if (!leg) continue; const cuff = toonMesh(new THREE.CylinderGeometry(0.19, 0.2, 0.12, 10), 0x55667a, { outline: 0.025 }); cuff.position.set(s * 0.18, -hipY + 0.68, -0.03); leg.add(cuff); }
  }
  if (extras.has('reissack')) {
    const sack = toonMesh(new THREE.SphereGeometry(0.34, 10, 8), 0xd8a85a, { outline: 0.035 }); sack.geometry.scale(1, 1.3, 0.8); sack.position.set(-0.6, shoulderY + 0.25, -0.15); sack.rotation.z = 0.3; figur.add(sack);
    const tie = toonMesh(new THREE.TorusGeometry(0.12, 0.03, 6, 10), 0x8b5a2b, { outline: 0.012 }); tie.position.set(-0.68, shoulderY + 0.66, -0.15); tie.rotation.x = Math.PI / 2; figur.add(tie);
    E.sack = sack;
  }
  if (extras.has('kokosnuss') && P.arms?.[1]) {
    const nut = toonMesh(new THREE.SphereGeometry(0.26, 10, 8), 0x6b4423, { outline: 0.035 }); nut.position.set(0.32, -0.55, 0.3); P.arms[1].add(nut);
    for (let i = 0; i < 3; i++) { const dot = toonMesh(new THREE.SphereGeometry(0.04, 6, 5), 0x3a2211, { outline: 0 }); dot.position.set(0.32 + Math.cos(i * 2.1) * 0.1, -0.5, 0.52 + Math.sin(i * 2.1) * 0.08); P.arms[1].add(dot); }
  }
  if (extras.has('seil_um_huefte')) {
    const rope = toonMesh(new THREE.TorusGeometry(0.5, 0.06, 6, 20), 0xd8a85a, { outline: 0.02 }); rope.position.set(0, hipY + 0.12, 0); rope.rotation.x = Math.PI / 2 + 0.1; figur.add(rope);
    const loop = toonMesh(new THREE.TorusGeometry(0.2, 0.05, 6, 14), 0xd8a85a, { outline: 0.02 }); loop.position.set(0.5, hipY - 0.2, 0.1); loop.rotation.y = Math.PI / 2; figur.add(loop);
  }
  if (extras.has('pflaster_stirn') && P.head) {
    const pl = toonMesh(new THREE.BoxGeometry(0.3, 0.12, 0.04), 0xf2d2b0, { outline: 0.015 }); pl.position.set(0.15, 0.3, 0.47); pl.rotation.set(-0.5, 0.2, -0.4); P.head.add(pl);
    for (const dx of [-0.07, 0.07]) { const l = toonMesh(new THREE.BoxGeometry(0.03, 0.12, 0.045), 0xe8463a, { outline: 0, basic: true }); l.position.set(dx, 0, 0); pl.add(l); }
  }
  if (extras.has('pfeife_am_band')) {
    figur.add(limb(V(-0.22, shoulderY + 0.25, 0.2), V(0.02, shoulderY - 0.4, 0.45), 0.015, 0x222222, { outline: 0.008 }));
    figur.add(limb(V(0.22, shoulderY + 0.25, 0.2), V(0.02, shoulderY - 0.4, 0.45), 0.015, 0x222222, { outline: 0.008 }));
    const w = toonMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8), 0xc9cfdc, { outline: 0.015 }); w.position.set(0.02, shoulderY - 0.5, 0.47); w.rotation.z = Math.PI / 2; figur.add(w);
    E.pfeife = w;
  }
  if (extras.has('haltung_gerade')) { // steht stramm: Arme leicht nach außen, Kinn hoch (Geh-Pose setzt nur rotation.x)
    for (const [i, s] of [[0, -1], [1, 1]]) if (P.arms?.[i]) P.arms[i].rotation.z = -s * 0.14;
    if (P.head) P.head.rotation.x = -0.08;
  }
  if (extras.has('just_married_cap') && P.head) {
    const capTop = toonMesh(new THREE.SphereGeometry(0.56, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xffffff, { outline: 0.045 }); capTop.position.set(0, 0.2, 0); P.head.add(capTop);
    const brim = toonMesh(new THREE.BoxGeometry(0.6, 0.07, 0.55), 0xffffff, { outline: 0.035 }); brim.position.set(0, 0.36, 0.62); brim.rotation.x = -0.2; P.head.add(brim);
    const t = tag('JUST MARRIED', 0.56, 0.16); t.position.set(0, 0.48, 0.5); t.rotation.x = -0.3; P.head.add(t); keinSchattenwurf(capTop, brim, t);
  }
  if (extras.has('blumenkranz') && P.head) {
    // Kranz außerhalb der Haarkappe (r 0.55 + Hülle): Radius 0.62, sonst steckt der Ring im Haar
    const ring = toonMesh(new THREE.TorusGeometry(0.62, 0.05, 6, 20), 0x3bb84a, { outline: 0.02 }); ring.position.set(0, 0.32, 0); ring.rotation.x = Math.PI / 2 + 0.12; P.head.add(ring);
    [0xe8463a, 0xffd54a, 0xff5fa2, 0xffffff, 0xff7f3f, 0xc9a0ff].forEach((c, i) => { const a = i / 6 * Math.PI * 2; const f = toonMesh(new THREE.SphereGeometry(0.09, 8, 6), c, { outline: 0.02 }); f.position.set(Math.cos(a) * 0.62, 0.34 + Math.sin(a) * 0.07, Math.sin(a) * 0.62); P.head.add(f); keinSchattenwurf(f); }); keinSchattenwurf(ring);
  }
  figur.userData.extrasDran = true;
  return figur;
}

// Regenschauer: Plastiktüten über allen Schuhen (Schuhe unlesbar), an/aus — für jede Figur mit parts.legs
export function regenTueten(figur, an) {
  const P = figur?.userData.parts; if (!P?.legs) return;
  if (!figur.userData.tueten) {
    figur.userData.tueten = [];
    for (const leg of P.legs) {
      for (const ch of leg.children) {
        if (!ch.isGroup) continue; // Schuh-Gruppen
        const bag = toonMesh(new THREE.SphereGeometry(0.5, 10, 8), toon(0xeaf4ff, { transparent: true, opacity: 0.8 }), { outline: 0.035 });
        bag.geometry.scale(0.75, 0.55, 1.1); bag.position.copy(ch.position).add(V(0, 0.22, 0.05)); bag.rotation.copy(ch.rotation);
        const knot = toonMesh(new THREE.SphereGeometry(0.08, 6, 5), 0xeaf4ff, { outline: 0.015 }); knot.position.set(0, 0.3, -0.2); bag.add(knot);
        bag.visible = false; leg.add(bag); figur.userData.tueten.push(bag);
      }
    }
  }
  for (const b of figur.userData.tueten) b.visible = !!an;
}

// Animation der Extras (Fliege kreist um den Fischhändler)
export function updateKundenExtras(figur, t) {
  const E = figur?.userData.extrasObj; if (!E) return;
  if (E.fly) E.fly.position.set(0.4 * Math.cos(t * 6), 0.5 + 0.2 * Math.sin(t * 9), 0.3 * Math.sin(t * 6));
}
