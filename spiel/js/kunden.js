// kunden.js — Kundschaft aus Teilen (alles aus data/kunden.json, normalisiert in game.js):
// Schuhe (sandale, flipflop, turnschuh, barfuss, gummistiefel), Hemd (hawaii, hawaii_neu, polo_sauber, tanktop, ohne,
// uniform_versteckt, kittel, trikot), Hose, Haare, Bart, Brille, Accessoire (cap, ohrknopf, hund, rucksack,
// sonnenbrille, kamera, surfbrett, gehstock, handy, kopfhoerer, fischkiste, bierdose) und Extras (socken, preisschild, stirnband,
// schuerze, riesenhut, faecher,
// halstuch_hund, funkgeraet, strohhut, cocktail, einkaufskorb, bändchen). Die Fallen (Socken, Preisschild, Ohrknopf,
// Hund) sind bewusst groß und kontrastreich.
// Figuren haben Pivot-Gruppen wie der Schluffi (userData.parts), damit sie schlendern können.
// Mimik: face(kind, mood, opts) aus faces.js; setMood() tauscht nur die Gesichtstextur.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMesh, toon, deform, rng, BLACK, textTexture, stripeTexture } from './toon.js';
import { limb } from './props.js';
import { sandal, sneaker, hawaiiTexture } from './figures.js';
import { face, faceDecal, setFace } from './faces.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SKIN = { hell: 0xf4c9a4, mittel: 0xe8a773, dunkel: 0x8d5a3a, sonnenbrand: 0xf0907a };
const HAIR = [0x4a2a12, 0x1a1a1a, 0xffe14a, 0xb8552a, 0x6b4423];
const css = (hex) => '#' + hex.toString(16).padStart(6, '0');

// ---------- weitere Schuhe ----------
// side 'L' | 'R' wie in figures.js: großer Zeh innen. Linker Fuß steht bei −x, innen ist +x → x spiegeln
const toeSign = (side) => (side === 'L' ? -1 : 1);
export function flipflop(skin, color = 0x3dd6e0, side = 'L') {
  const m = toeSign(side);
  const g = new THREE.Group();
  const sole = toonMesh(new RoundedBoxGeometry(0.5, 0.08, 1.06, 3, 0.04), color, { outline: 0.035 });
  sole.position.y = 0.04; g.add(sole);
  const footGeo = new RoundedBoxGeometry(0.42, 0.16, 0.74, 3, 0.07);
  deform(footGeo, (v) => { if (v.z < -0.22) v.y += 0.06; });
  const foot = toonMesh(footGeo, skin, { outline: 0.04 });
  foot.position.set(0, 0.17, -0.12); g.add(foot);
  for (const [x, r] of [[-0.16, 0.11], [-0.04, 0.085], [0.06, 0.075], [0.145, 0.067], [0.22, 0.06]]) {
    const t = toonMesh(new THREE.SphereGeometry(r, 9, 7), skin, { outline: 0.03 });
    t.position.set(x * m, 0.1 + r * 0.5, 0.3 + (0.11 - r) * 0.8); g.add(t);
  }
  // Zehensteg: V-Riemen vom Spann zwischen die ersten Zehen
  g.add(limb(V(-0.1 * m, 0.22, 0.2), V(-0.22 * m, 0.12, -0.1), 0.03, 0x222222, { outline: 0.015 }));
  g.add(limb(V(-0.1 * m, 0.22, 0.2), V(0.2 * m, 0.12, -0.1), 0.03, 0x222222, { outline: 0.015 }));
  return g;
}
export function barefoot(skin, side = 'L') {
  const m = toeSign(side);
  const g = new THREE.Group();
  const footGeo = new RoundedBoxGeometry(0.42, 0.18, 0.78, 3, 0.08);
  deform(footGeo, (v) => { if (v.z < -0.22) v.y += 0.07; });
  const foot = toonMesh(footGeo, skin, { outline: 0.04 });
  foot.position.set(0, 0.1, -0.1); g.add(foot);
  for (const [x, r] of [[-0.16, 0.11], [-0.04, 0.085], [0.06, 0.075], [0.145, 0.067], [0.22, 0.06]]) {
    const t = toonMesh(new THREE.SphereGeometry(r, 9, 7), skin, { outline: 0.03 });
    t.position.set(x * m, r * 0.9, 0.32 + (0.11 - r) * 0.8); g.add(t);
  }
  const sand = toonMesh(new THREE.SphereGeometry(0.12, 6, 5), 0xe2bf6e, { outline: 0 });
  sand.position.set(0.1, 0.05, -0.45); g.add(sand);
  return g;
}
export function rubberBoot(color = 0xffd54a) {
  const g = new THREE.Group();
  const sole = toonMesh(new RoundedBoxGeometry(0.52, 0.16, 1.14, 3, 0.05), 0x222222, { outline: 0.04 });
  sole.position.y = 0.08; g.add(sole);
  const footGeo = new RoundedBoxGeometry(0.48, 0.34, 1.0, 3, 0.12);
  deform(footGeo, (v) => { if (v.z > 0.25 && v.y > 0) v.y -= 0.1 * (v.z - 0.25); });
  const foot = toonMesh(footGeo, color, { outline: 0.045 });
  foot.position.set(0, 0.3, -0.05); g.add(foot);
  const shaft = toonMesh(new THREE.CylinderGeometry(0.2, 0.22, 0.9, 12), color, { outline: 0.045 });
  shaft.position.set(0, 0.85, -0.18); g.add(shaft);
  const rim = toonMesh(new THREE.CylinderGeometry(0.23, 0.23, 0.08, 12), 0x333333, { outline: 0.03 });
  rim.position.set(0, 1.3, -0.18); g.add(rim);
  return g;
}

// ---------- Hund (Accessoire) ----------
function dog(bandana) {
  const g = new THREE.Group();
  const c = 0xc98a5e;
  const body = toonMesh(new THREE.SphereGeometry(0.42, 12, 9), c, { outline: 0.04 });
  body.geometry.scale(1.5, 0.9, 0.9); body.position.y = 0.6; g.add(body);
  const head = toonMesh(new THREE.SphereGeometry(0.34, 12, 9), c, { outline: 0.04 });
  head.position.set(0.62, 0.95, 0); g.add(head);
  const snout = toonMesh(new THREE.SphereGeometry(0.17, 8, 6), 0xe0a86a, { outline: 0.03 });
  snout.position.set(0.3, -0.1, 0); head.add(snout);
  const nose = toonMesh(new THREE.SphereGeometry(0.07, 6, 5), BLACK, { outline: 0, basic: true });
  nose.position.set(0.45, -0.05, 0); head.add(nose);
  for (const s of [-1, 1]) {
    const eye = toonMesh(new THREE.SphereGeometry(0.07, 6, 5), 0xffffff, { outline: 0.02 });
    eye.position.set(0.2, 0.13, s * 0.16); head.add(eye);
    const pupil = toonMesh(new THREE.SphereGeometry(0.035, 6, 5), BLACK, { outline: 0, basic: true });
    pupil.position.set(0.06, 0, 0); eye.add(pupil);
    const ear = toonMesh(new THREE.BoxGeometry(0.1, 0.3, 0.16), 0x8b5a2b, { outline: 0.03 });
    ear.position.set(-0.12, 0.2, s * 0.3); ear.rotation.x = s * 0.3; head.add(ear); // Ohren oben: hellwach
    for (const x of [-0.35, 0.35]) g.add(limb(V(x, 0.35, s * 0.22), V(x, 0.0, s * 0.24), 0.08, c, { outline: 0.03 }));
  }
  g.add(limb(V(-0.6, 0.7, 0), V(-0.95, 1.1, 0.1), 0.06, c, { outline: 0.025 }));
  if (bandana) {
    const tuch = toonMesh(new THREE.ConeGeometry(0.34, 0.4, 3), 0xe8463a, { outline: 0.03 });
    tuch.position.set(0.35, 0.72, 0); tuch.rotation.set(0, 0, Math.PI); g.add(tuch);
  }
  g.userData.head = head;
  return g;
}

// ---------- Hemd-Muster (Canvas): blumen, streifen, punkte, palmen ----------
const shirtTexCache = new Map();
export function shirtTexture(pattern, base = '#3a7bd5') {
  const key = pattern + '|' + base;
  if (shirtTexCache.has(key)) return shirtTexCache.get(key);
  let tex;
  if (pattern === 'blumen') tex = hawaiiTexture(base, ['#ffffff', '#ffd54a']);
  else {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    if (pattern === 'streifen') {
      for (let y = 0; y < 256; y += 48) ctx.fillRect(0, y, 256, 20);
    } else if (pattern === 'punkte') {
      for (let y = 20; y < 256; y += 44) for (let x = (y / 44) % 2 ? 22 : 0; x < 256; x += 44) { ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); }
    } else { // palmen: Stamm + Blätterkranz
      ctx.fillStyle = '#1f6e2a';
      for (const [x, y] of [[60, 70], [190, 60], [120, 180], [40, 200], [210, 190]]) {
        ctx.fillRect(x - 3, y, 6, 36);
        for (let k = 0; k < 5; k++) { const a = -Math.PI + k * (Math.PI / 4); ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 14, y + Math.sin(a) * 8, 16, 5, a, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  }
  shirtTexCache.set(key, tex);
  return tex;
}

/**
 * Figur für einen normalisierten Kunden (siehe game.js). Füße auf y=0, Blick nach +z.
 * userData.parts = { legs, arms, head, decal, capPolice, dog }, userData.faceOpts für setMood.
 */
export function buildKunde(k, seed = 1, outfit = null) {
  const root = new THREE.Group();
  const rand = rng(seed * 31 + 7);
  const skin = SKIN[k.hautton] || 0xe8a773;
  const hairColor = k.haare === 'weiss' ? 0xeeeeee : HAIR[Math.floor(rand() * HAIR.length)];
  const stance = 0.46;
  const hipY = 1.1;
  const hose = k.hose || (k.hemd === 'polo_sauber' || k.hemd === 'uniform_versteckt' ? 'chino' : 'shorts');
  const longPants = hose === 'chino' || hose === 'jogginghose' || hose === 'lang';
  const pantsColor = { chino: 0xd9c08a, jogginghose: 0x777788, lang: 0x334455, badehose: [0xff5fa2, 0x3dd6e0, 0xffd54a][Math.floor(rand() * 3)], rock: 0xc9a0ff }[hose]
    ?? [0x2fa9b9, 0xe8463a, 0x3a7bd5, 0xffd54a][Math.floor(rand() * 4)];
  const extras = new Set(k.extras);
  // Statur: Größe ±15 % (uniform, damit Konturen gleichmäßig bleiben), Bauch bei einem Teil der Kunden
  const height = 0.86 + rand() * 0.3;
  const belly = rand() < 0.45 || k.typ.toLowerCase().includes('stammkunde');
  root.scale.setScalar(height);
  // Schuhfarbe einmal je Kunde (nicht je Bein) ziehen
  const sneakerColor = [0xe8463a, 0x3a7bd5, 0x3bb84a, 0xffffff][Math.floor(rand() * 4)];
  const flipColor = [0x3dd6e0, 0xff5fa2, 0xffd54a][Math.floor(rand() * 3)];
  const bootColor = [0xffd54a, 0x3bb84a][Math.floor(rand() * 2)];

  // Beine als Pivot-Gruppen (Hüfte) mit Schuh
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.28, hipY, 0);
    const fx = s * stance - s * 0.28;
    let shoe;
    const side = s < 0 ? 'L' : 'R'; // Figur schaut nach +z, links = −x
    if (k.schuhe === 'sandale') shoe = sandal(skin, side);
    else if (k.schuhe === 'turnschuh') shoe = sneaker(sneakerColor, side);
    else if (k.schuhe === 'flipflop') shoe = flipflop(skin, flipColor, side);
    else if (k.schuhe === 'gummistiefel') shoe = rubberBoot(bootColor);
    else shoe = barefoot(skin, side);
    shoe.position.set(fx, -hipY, 0);
    shoe.rotation.y = s * 0.3;
    leg.add(shoe);
    if (longPants) {
      leg.add(limb(V(fx, 0.35 - hipY, -0.05), V(0, 0, 0), 0.16, pantsColor, { outline: 0.04 }));
      if (hose === 'jogginghose') {
        const stripe = toonMesh(new THREE.BoxGeometry(0.04, 0.7, 0.05), 0xffffff, { outline: 0.015 });
        stripe.position.set(fx + s * 0.16, 0.7 - hipY, 0); leg.add(stripe);
      }
    } else {
      leg.add(limb(V(fx, 0.3 - hipY, -0.05), V(0, 0, 0), 0.12, skin, { outline: 0.04 }));
      if (hose !== 'rock') {
        const shorts = toonMesh(new THREE.CylinderGeometry(0.2, 0.23, hose === 'badehose' ? 0.32 : 0.45, 12), pantsColor, { outline: 0.04 });
        shorts.position.set(0, -0.15, 0); leg.add(shorts);
      }
    }
    // Falle: Socken (weiß, hoch, auch in Sandalen)
    if (extras.has('socken') && k.schuhe !== 'gummistiefel') {
      const sock = toonMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 12), 0xffffff, { outline: 0.035 });
      sock.position.set(fx, 0.48 - hipY, -0.05); leg.add(sock);
      const rib = toonMesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), 0xdddddd, { outline: 0.02 });
      rib.position.set(fx, 0.7 - hipY, -0.05); leg.add(rib);
    }
    root.add(leg); legs.push(leg);
  }
  if (hose === 'rock') {
    const skirt = toonMesh(new THREE.ConeGeometry(0.62, 0.9, 14, 1, true), toon(pantsColor, { side: THREE.DoubleSide }), { outline: 0.045 });
    skirt.position.set(0, hipY - 0.35, 0); root.add(skirt);
  }

  // Rumpf je Hemd
  const shoulderY = hipY + 0.85;
  let sleeve = skin;
  const hemd = k.hemd;
  const shirtBase = outfit?.color || ['#3a7bd5', '#3bb84a', '#9b59b6', '#e8463a'][Math.floor(rand() * 4)];
  if (hemd === 'hawaii' || hemd === 'hawaii_neu') {
    // Muster + Farbe aus der Tageszuteilung (keine Doppel-Outfits); orange bleibt dem Spieler
    const tg = new THREE.SphereGeometry(belly ? 0.56 : 0.46, 16, 12); tg.scale(1, belly ? 0.95 : 1.05, 0.85);
    const t = toonMesh(tg, toon(0xffffff, { map: shirtTexture(outfit?.pattern || 'blumen', shirtBase) }), { outline: 0.05 });
    t.position.set(0, hipY + 0.45, belly ? 0.08 : 0); root.add(t); sleeve = parseInt(shirtBase.slice(1), 16);
    if (hemd === 'hawaii_neu') {
      // frisch gebügelt: Knickfalte als heller Streifen
      const crease = toonMesh(new THREE.BoxGeometry(0.03, 0.9, 0.04), 0xfff5e0, { outline: 0.01 });
      crease.position.set(0.18, hipY + 0.45, 0.44); root.add(crease);
    }
  } else if (hemd === 'polo_sauber' || hemd === 'uniform_versteckt') {
    const tg = new RoundedBoxGeometry(0.9, 0.95, 0.5, 3, 0.2);
    deform(tg, (v) => { if (v.y > 0) v.x *= 1.2; });
    // Polo: sehr helle Variante der Tagesfarbe, damit „zu sauber“ lesbar bleibt
    const poloColor = new THREE.Color(shirtBase).lerp(new THREE.Color(0xffffff), 0.72).getHex();
    const t = toonMesh(tg, poloColor, { outline: 0.05 });
    t.position.set(0, hipY + 0.48, 0); root.add(t); sleeve = poloColor;
    const collar = toonMesh(new THREE.CylinderGeometry(0.26, 0.3, 0.14, 12), hemd === 'uniform_versteckt' ? 0x2a3f8f : 0xdfe3ee, { outline: 0.03 });
    collar.position.set(0, hipY + 0.95, 0); root.add(collar);
    if (hemd === 'uniform_versteckt') {
      const badge = toonMesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 8), 0xffd54a, { outline: 0.02 });
      badge.position.set(-0.3, hipY + 0.05, 0.28); badge.rotation.x = Math.PI / 2; root.add(badge);
    }
    const belt = toonMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 14), 0x333333, { outline: 0.03 });
    belt.position.set(0, hipY + 0.05, 0); root.add(belt);
  } else if (hemd === 'tanktop') {
    const t = toonMesh(new THREE.CylinderGeometry(0.4, belly ? 0.56 : 0.45, 0.95, 14), parseInt(shirtBase.slice(1), 16), { outline: 0.045 });
    t.position.set(0, hipY + 0.48, 0); root.add(t);
    const sh = toonMesh(new THREE.SphereGeometry(0.44, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), skin, { outline: 0.04 });
    sh.position.set(0, hipY + 0.72, 0); root.add(sh);
  } else if (hemd === 'kittel') {
    // Kittel: geblümt, bis über die Knie
    const tex = stripeTexture(['#cfe8ff', '#ffd5e0', '#cfe8ff', '#fff1c2'], { vertical: false });
    const t = toonMesh(new THREE.CylinderGeometry(0.42, 0.55, 1.5, 14), toon(0xffffff, { map: tex }), { outline: 0.05 });
    t.position.set(0, hipY + 0.2, 0); root.add(t); sleeve = 0xcfe8ff;
    for (let i = 0; i < 3; i++) {
      const btn = toonMesh(new THREE.SphereGeometry(0.035, 6, 5), BLACK, { outline: 0, basic: true });
      btn.position.set(0, hipY + 0.75 - i * 0.3, 0.47 + i * 0.02); root.add(btn);
    }
  } else if (hemd === 'trikot') {
    const tex = stripeTexture(['#e8463a', '#ffffff', '#e8463a', '#ffffff', '#e8463a', '#ffffff'], { vertical: false });
    const t = toonMesh(new THREE.CylinderGeometry(0.42, 0.44, 0.95, 14), toon(0xffffff, { map: tex }), { outline: 0.045 });
    t.position.set(0, hipY + 0.48, 0); root.add(t); sleeve = 0xe8463a;
    const num = textTexture('7', { bg: 'rgba(0,0,0,0)', fg: '#ffffff', font: 'bold 110px sans-serif', w: 128, h: 128 });
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: num, transparent: true }));
    n.position.set(0, hipY + 0.5, 0.45); root.add(n);
  } else {
    // ohne Hemd: Bauch
    const tg = new THREE.SphereGeometry(belly ? 0.58 : 0.5, 16, 12); tg.scale(1, 1.0, 0.9);
    const t = toonMesh(tg, skin, { outline: 0.05 });
    t.position.set(0, hipY + 0.42, 0.05); root.add(t);
    const navel = toonMesh(new THREE.SphereGeometry(0.035, 6, 5), BLACK, { outline: 0, basic: true });
    navel.position.set(0, hipY + 0.3, 0.52); root.add(navel);
  }
  // Falle: Preisschild hängt am Ärmel/Hemd
  if (extras.has('preisschild')) {
    root.add(limb(V(0.42, shoulderY - 0.02, 0.15), V(0.5, shoulderY - 0.35, 0.3), 0.012, 0xffffff, { outline: 0.008 }));
    const tagTex = textTexture('49€', { bg: '#ffffff', fg: '#e8463a', font: 'bold 70px sans-serif', w: 192, h: 128 });
    const plain = toon(0xffffff);
    const tag = toonMesh(new THREE.BoxGeometry(0.3, 0.2, 0.03), [plain, plain, plain, plain, toon(0xffffff, { map: tagTex }), plain], { outline: 0.02 });
    tag.position.set(0.52, shoulderY - 0.45, 0.32); tag.rotation.set(0.1, 0.3, 0.2); root.add(tag);
  }

  // Arme (Pivot Schulter), hängend; rechter Arm hält ggf. etwas
  const arms = [];
  const holds = k.accessoire === 'gehstock' || k.accessoire === 'handy' || k.accessoire === 'surfbrett' || extras.has('cocktail') || extras.has('einkaufskorb');
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.5, shoulderY, 0);
    const bent = s === 1 && k.accessoire === 'handy';
    const handPos = bent ? V(0.05, -0.35, 0.3) : V(s * 0.18, -0.8, 0.08);
    arm.add(limb(V(0, 0, 0), handPos, 0.1, skin, { outline: 0.04 }));
    if (hemd !== 'ohne' && hemd !== 'tanktop') {
      const sl = toonMesh(new THREE.CylinderGeometry(0.15, 0.16, 0.3, 10), sleeve, { outline: 0.035 });
      sl.position.set(s * 0.03, -0.1, 0.02); sl.rotation.z = -s * 0.25; arm.add(sl);
    }
    const hand = toonMesh(new THREE.SphereGeometry(0.19, 12, 9), skin, { outline: 0.04 });
    hand.position.copy(handPos).add(V(s * 0.04, -0.12, 0.02)); arm.add(hand);
    if (extras.has('bändchen') || extras.has('baendchen')) {
      const band = toonMesh(new THREE.TorusGeometry(0.13, 0.03, 6, 12), [0xff5fa2, 0x3bb84a, 0xffd54a][Math.floor(rand() * 3)], { outline: 0.015 });
      band.position.copy(handPos).add(V(0, 0.15, 0)); band.rotation.x = Math.PI / 2; arm.add(band);
    }
    if (s === 1 && holds) {
      const hp = hand.position;
      if (k.accessoire === 'gehstock') {
        arm.add(limb(hp.clone(), V(hp.x + 0.1, -shoulderY + 0.02, hp.z + 0.1), 0.04, 0x5a3b1a, { outline: 0.02 }));
        const hook = toonMesh(new THREE.TorusGeometry(0.1, 0.035, 6, 10, Math.PI), 0x5a3b1a, { outline: 0.02 });
        hook.position.copy(hp).add(V(0.08, 0.08, 0)); arm.add(hook);
      } else if (k.accessoire === 'handy') {
        const phone = toonMesh(new THREE.BoxGeometry(0.16, 0.3, 0.04), 0x222233, { outline: 0.02 });
        phone.position.copy(hp).add(V(0.05, 0.12, 0.08)); phone.rotation.set(-0.3, 0.3, 0.2); arm.add(phone);
        const screen = toonMesh(new THREE.BoxGeometry(0.12, 0.24, 0.02), 0x6ee7ff, { outline: 0, basic: true });
        screen.position.z = 0.02; phone.add(screen);
      } else if (k.accessoire === 'fischkiste') {
        // Fischkiste unterm Arm, zwei Fische gucken raus
        const box = toonMesh(new THREE.BoxGeometry(0.7, 0.35, 0.45), 0xd8a85a, { outline: 0.035 });
        box.position.copy(hp).add(V(0.25, -0.2, 0.05)); arm.add(box);
        for (const dx of [-0.15, 0.15]) {
          const fg = new THREE.SphereGeometry(0.12, 8, 6); fg.scale(1.8, 0.7, 0.5);
          const fish = toonMesh(fg, 0x9fd8ff, { outline: 0.02 });
          fish.position.copy(hp).add(V(0.25 + dx, 0.02, 0.05)); fish.rotation.y = 0.4 * Math.sign(dx); arm.add(fish);
        }
      } else if (k.accessoire === 'bierdose') {
        const can = toonMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 10), 0xffd54a, { outline: 0.025 });
        can.position.copy(hp).add(V(0, 0.2, 0.05)); arm.add(can);
        const ring = toonMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 10), 0xdddddd, { outline: 0.015 });
        ring.position.copy(hp).add(V(0, 0.36, 0.05)); arm.add(ring);
      } else if (extras.has('cocktail')) {
        const glass = toonMesh(new THREE.ConeGeometry(0.16, 0.3, 10), 0xffb13b, { outline: 0.025 });
        glass.geometry.rotateX(Math.PI); glass.position.copy(hp).add(V(0, 0.28, 0.05)); arm.add(glass);
        const umb = toonMesh(new THREE.ConeGeometry(0.16, 0.08, 8), 0xff5fa2, { outline: 0.02 });
        umb.position.copy(hp).add(V(0.1, 0.5, 0.05)); umb.rotation.z = -0.5; arm.add(umb);
      } else if (extras.has('einkaufskorb')) {
        const basket = toonMesh(new THREE.BoxGeometry(0.5, 0.35, 0.3), 0xd8a85a, { outline: 0.035 });
        basket.position.copy(hp).add(V(0.1, -0.35, 0.05)); arm.add(basket);
        const handle = toonMesh(new THREE.TorusGeometry(0.2, 0.03, 6, 12, Math.PI), 0x8b5a2b, { outline: 0.02 });
        handle.position.copy(hp).add(V(0.1, -0.18, 0.05)); arm.add(handle);
        const mango = toonMesh(new THREE.SphereGeometry(0.1, 8, 6), 0xffb13b, { outline: 0.02 });
        mango.position.copy(hp).add(V(0.15, -0.15, 0.1)); arm.add(mango);
      }
    }
    root.add(arm); arms.push(arm);
  }
  // Falle: Ohrknopf mit Kabel (groß, weiß, Kabel bis in den Kragen)
  // (Kopf wird unten gebaut; Kabel hängt am Rumpf)
  // Falle: Funkgerät am Gürtel mit Antenne
  if (extras.has('funkgeraet')) {
    const radio = toonMesh(new THREE.BoxGeometry(0.16, 0.3, 0.12), 0x222222, { outline: 0.03 });
    radio.position.set(-0.4, hipY + 0.05, -0.2); root.add(radio);
    root.add(limb(V(-0.4, hipY + 0.2, -0.2), V(-0.42, hipY + 0.6, -0.22), 0.015, 0x222222, { outline: 0.01 }));
    const led = toonMesh(new THREE.SphereGeometry(0.03, 6, 5), 0xff2222, { outline: 0, basic: true });
    led.position.set(-0.4, hipY + 0.18, -0.13); root.add(led);
  }
  if (extras.has('schuerze')) {
    const ap = toonMesh(new THREE.BoxGeometry(0.72, 1.1, 0.06), 0xf4f4f8, { outline: 0.035 });
    ap.position.set(0, hipY + 0.1, 0.5); root.add(ap);
    const stain = toonMesh(new THREE.CircleGeometry(0.12, 8), 0x9fd8ff, { outline: 0, basic: true });
    stain.position.set(0.12, hipY + 0.2, 0.54); root.add(stain);
  }
  if (extras.has('faecher')) {
    const fan = toonMesh(new THREE.CircleGeometry(0.36, 10, Math.PI * 0.1, Math.PI * 0.8), 0xff5fa2, { outline: 0.025 });
    fan.position.set(-0.75, hipY + 1.2, 0.3); fan.rotation.set(0, 0.6, 0); root.add(fan);
  }
  if (k.accessoire === 'rucksack') {
    const pack = toonMesh(new RoundedBoxGeometry(0.7, 0.9, 0.4, 3, 0.12), 0x3bb84a, { outline: 0.045 });
    pack.position.set(0, hipY + 0.5, -0.5); root.add(pack);
    const roll = toonMesh(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 10), 0xffd54a, { outline: 0.03 });
    roll.position.set(0, hipY + 1.02, -0.5); roll.rotation.z = Math.PI / 2; root.add(roll);
  }
  if (k.accessoire === 'kamera') {
    const cam = toonMesh(new THREE.BoxGeometry(0.34, 0.22, 0.2), 0x222233, { outline: 0.03 });
    cam.position.set(0, hipY + 0.45, 0.45); root.add(cam);
    const lens = toonMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 10), 0x555566, { outline: 0.02 });
    lens.position.set(0, hipY + 0.45, 0.58); lens.rotation.x = Math.PI / 2; root.add(lens);
    root.add(limb(V(-0.17, hipY + 0.5, 0.45), V(-0.35, shoulderY + 0.25, -0.05), 0.02, 0x222233, { outline: 0.01 }));
    root.add(limb(V(0.17, hipY + 0.5, 0.45), V(0.35, shoulderY + 0.25, -0.05), 0.02, 0x222233, { outline: 0.01 }));
  }

  // Hals + Kopf (rund oder kantig)
  const neckY = shoulderY + 0.15;
  root.add(limb(V(0, neckY - 0.2, 0), V(0, neckY + 0.3, 0), 0.14, skin, { outline: 0.035 }));
  const head = new THREE.Group();
  head.position.set(0, neckY + 0.72, 0);
  root.add(head);
  const boxy = rand() > 0.5;
  const shape = (geo) => {
    if (boxy) deform(geo, (v) => {
      const len = v.length(); const n = v.clone().normalize();
      const m = Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z));
      v.copy(n).lerp(n.clone().divideScalar(m), 0.4).multiplyScalar(len);
    });
    geo.scale(1, 1.1, 0.95);
  };
  const hg = new THREE.SphereGeometry(0.52, 28, 20);
  shape(hg);
  head.add(toonMesh(hg, skin, { outline: 0.05 }));
  // Mimik-API: Haut, Bart, Brille, Falten, Seed → faces.js; Schnauzer ist 3D
  const faceOpts = {
    skin: css(skin),
    beard: k.bart === 'vollbart' ? true : k.bart === 'stoppel' ? 'stoppeln' : false,
    glasses: k.brille === 'lesebrille',
    wrinkles: k.haare === 'weiss',
    seed: seed,
    beardColor: css(hairColor),
  };
  const decal = faceDecal(face('kunde', k.stimmung_start || 'neutral', faceOpts), 0.527, shape);
  head.add(decal);
  const nose = toonMesh(new THREE.SphereGeometry(0.13, 10, 8), 0xe89a6a, { outline: 0.03 });
  nose.position.set(0, -0.08, 0.52); head.add(nose);
  if (k.bart === 'schnauzer') {
    const m = toonMesh(new THREE.BoxGeometry(0.34, 0.08, 0.08), hairColor, { outline: 0.025 });
    m.position.set(0, -0.2, 0.52); head.add(m);
  }
  for (const s of [-1, 1]) {
    const ear = toonMesh(new THREE.SphereGeometry(0.1, 8, 6), skin, { outline: 0.03 });
    ear.position.set(s * 0.52, -0.02, 0); head.add(ear);
  }
  // Haare
  const hairKind = k.accessoire === 'cap' || extras.has('strohhut') ? 'kurz' : k.haare;
  if (hairKind === 'lockig') {
    for (let i = 0; i < 8; i++) {
      const a = i * 0.8;
      const h = toonMesh(new THREE.SphereGeometry(0.17, 10, 7), hairColor, { outline: 0.035 });
      h.position.set(Math.cos(a) * 0.36, 0.42 + (i % 2) * 0.1, Math.sin(a) * 0.3 - 0.05); head.add(h);
    }
  } else if (hairKind !== 'glatze') {
    const cap = toonMesh(new THREE.SphereGeometry(0.55, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hairColor, { outline: 0.045 });
    cap.position.set(0, 0.12, -0.05); cap.rotation.x = -0.15; head.add(cap);
    if (hairKind === 'lang') {
      for (const s of [-1, 1]) {
        const strand = toonMesh(new THREE.BoxGeometry(0.16, 0.9, 0.3), hairColor, { outline: 0.035 });
        strand.position.set(s * 0.5, -0.25, -0.15); head.add(strand);
      }
    }
    if (hairKind === 'dutt') {
      const bun = toonMesh(new THREE.SphereGeometry(0.2, 10, 8), hairColor, { outline: 0.035 });
      bun.position.set(0, 0.62, -0.1); head.add(bun);
    }
  } else {
    const shine = toonMesh(new THREE.SphereGeometry(0.08, 6, 5), 0xffffff, { outline: 0 });
    shine.position.set(-0.2, 0.42, 0.25); head.add(shine);
  }

  // Kopf-Accessoires + Extras
  if (k.accessoire === 'cap') {
    const capTop = toonMesh(new THREE.SphereGeometry(0.56, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xe8463a, { outline: 0.045 });
    capTop.position.set(0, 0.2, 0); head.add(capTop);
    const brimGeo = new THREE.BoxGeometry(0.6, 0.07, 0.55);
    deform(brimGeo, (v) => { if (v.z > 0) v.x *= 1 - 0.5 * (v.z / 0.275); });
    const brim = toonMesh(brimGeo, 0xe8463a, { outline: 0.035 });
    brim.position.set(0, 0.36, 0.62); brim.rotation.x = -0.2; head.add(brim);
  }
  if (extras.has('riesenhut')) {
    const top = toonMesh(new THREE.CylinderGeometry(0.46, 0.5, 0.28, 14), 0xfff1c2, { outline: 0.04 });
    top.position.set(0, 0.6, 0); head.add(top);
    const brim = toonMesh(new THREE.CylinderGeometry(1.25, 1.25, 0.05, 20), 0xfff1c2, { outline: 0.045 });
    brim.position.set(0, 0.47, 0); brim.rotation.set(0.08, 0, 0.1); head.add(brim);
    const ribbon = toonMesh(new THREE.CylinderGeometry(0.51, 0.51, 0.09, 14), 0xff5fa2, { outline: 0.02 });
    ribbon.position.set(0, 0.5, 0); head.add(ribbon);
  } else if (extras.has('strohhut')) {
    const top = toonMesh(new THREE.CylinderGeometry(0.42, 0.46, 0.3, 14), 0xe3b04b, { outline: 0.04 });
    top.position.set(0, 0.6, 0); head.add(top);
    const brim = toonMesh(new THREE.CylinderGeometry(0.85, 0.85, 0.05, 18), 0xe3b04b, { outline: 0.04 });
    brim.position.set(0, 0.47, 0); brim.rotation.z = 0.06; head.add(brim);
    const ribbon = toonMesh(new THREE.CylinderGeometry(0.47, 0.47, 0.08, 14), 0xe8463a, { outline: 0.02 });
    ribbon.position.set(0, 0.5, 0); head.add(ribbon);
  }
  if (extras.has('stirnband')) {
    // Stirnband nie rot: das rote gehört dem Spieler
    const band = toonMesh(new THREE.TorusGeometry(0.47, 0.06, 8, 24), [0xffd54a, 0x3a7bd5, 0x3bb84a][Math.floor(rand() * 3)], { outline: 0.03 });
    band.position.set(0, 0.3, 0); band.rotation.x = Math.PI / 2 + 0.1; head.add(band);
  }
  if (k.accessoire === 'kopfhoerer') {
    const band = toonMesh(new THREE.TorusGeometry(0.56, 0.05, 8, 24, Math.PI), 0x222233, { outline: 0.03 });
    band.position.set(0, 0.15, 0); band.rotation.y = Math.PI / 2; head.add(band);
    for (const s of [-1, 1]) {
      const cup = toonMesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 12), 0xe8463a, { outline: 0.03 });
      cup.position.set(s * 0.58, 0, 0); cup.rotation.z = Math.PI / 2; head.add(cup);
    }
  }
  if (k.accessoire === 'ohrknopf') {
    // Falle: Ohrknopf — groß, weiß, mit Spiralkabel in den Kragen
    const bud = toonMesh(new THREE.SphereGeometry(0.09, 8, 6), 0xffffff, { outline: 0.025 });
    bud.position.set(0.58, -0.02, 0.08); head.add(bud);
    root.add(limb(V(0.62, neckY + 0.68, 0.1), V(0.5, neckY + 0.3, 0.25), 0.02, 0xffffff, { outline: 0.012 }));
    root.add(limb(V(0.5, neckY + 0.3, 0.25), V(0.3, neckY - 0.05, 0.2), 0.02, 0xffffff, { outline: 0.012 }));
  }
  if (k.accessoire === 'sonnenbrille' || k.brille === 'sonnenbrille') {
    for (const s of [-1, 1]) {
      const lens = toonMesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), 0x111111, { outline: 0.02 });
      lens.position.set(s * 0.2, 0.08, 0.5); lens.rotation.x = Math.PI / 2; head.add(lens);
    }
    const bridge = toonMesh(new THREE.BoxGeometry(0.1, 0.03, 0.03), BLACK, { outline: 0, basic: true });
    bridge.position.set(0, 0.1, 0.52); head.add(bridge);
  } else if (k.brille === 'sportbrille') {
    const visor = toonMesh(new THREE.BoxGeometry(0.62, 0.16, 0.1), 0x222233, { outline: 0.025 });
    visor.position.set(0, 0.08, 0.5); head.add(visor);
    const glint = toonMesh(new THREE.BoxGeometry(0.5, 0.05, 0.02), 0x6ee7ff, { outline: 0, basic: true });
    glint.position.set(0, 0.1, 0.56); head.add(glint);
  }

  let dogG = null;
  if (k.accessoire === 'hund') {
    dogG = dog(extras.has('halstuch_hund'));
    dogG.position.set(0.95, 0, 0.4);
    dogG.rotation.y = 0.3;
    root.add(dogG);
    root.add(limb(V(0.6, hipY - 0.1, 0.1), V(1.35, 1.0, 0.4), 0.02, 0xe8463a, { outline: 0.01 })); // Leine
  }
  // Polizeimütze für den Reveal (zunächst unsichtbar)
  const capPolice = new THREE.Group();
  const pc = toonMesh(new THREE.CylinderGeometry(0.5, 0.54, 0.3, 14), 0x2a3f8f, { outline: 0.04 });
  pc.position.y = 0.5; capPolice.add(pc);
  const pcTop = toonMesh(new THREE.CylinderGeometry(0.56, 0.5, 0.12, 14), 0x2a3f8f, { outline: 0.04 });
  pcTop.position.y = 0.7; capPolice.add(pcTop);
  const pcBrim = toonMesh(new THREE.BoxGeometry(0.5, 0.05, 0.3), 0x111111, { outline: 0.03 });
  pcBrim.position.set(0, 0.36, 0.55); capPolice.add(pcBrim);
  const pcBadge = toonMesh(new THREE.SphereGeometry(0.08, 8, 6), 0xffd54a, { outline: 0.02 });
  pcBadge.position.set(0, 0.55, 0.5); capPolice.add(pcBadge);
  capPolice.visible = false;
  head.add(capPolice);

  // Surfbrett: quer vor dem Körper in beiden Händen (lange Achse links–rechts, ragt beidseitig über den Körper, Deck nach
  // vorn/leicht oben, Bauchhöhe). Beim Sitzen/Liegen liegt ein zweites Brett daneben im Sand (holdPose).
  let board = null, boardSand = null;
  if (k.accessoire === 'surfbrett') {
    const mk = (sx, sy, sz, stripe) => {
      const bg = new THREE.SphereGeometry(1, 12, 10); bg.scale(sx, sy, sz);
      const b = toonMesh(bg, 0xff5fa2, { outline: 0.045 });
      b.add(toonMesh(new THREE.BoxGeometry(...stripe), 0xffffff, { outline: 0.02 }));
      return b;
    };
    board = mk(1.2, 0.28, 0.07, [2.0, 0.08, 0.17]);
    board.position.set(0, shoulderY - 0.6, 0.72); board.rotation.x = -0.35; root.add(board);
    boardSand = mk(1.2, 0.07, 0.28, [2.0, 0.17, 0.08]); boardSand.visible = false; root.add(boardSand);
  }
  root.userData.parts = { legs, arms, head, decal, capPolice, dog: dogG, board, boardSand };
  root.userData.faceOpts = faceOpts;
  root.userData.kunde = k;
  root.userData.mood = k.stimmung_start || 'neutral';
  return root;
}

/** Stimmung setzen: tauscht nur die Gesichtstextur (face() ist gecacht, nichts wird weggeworfen). */
// Surfbrett nach Pose: gehen/stehen/posieren = beide Arme nach vorn, Brett in den Händen (klebt nicht am Arm);
// sitzen/liegen = Brett liegt neben der Figur im Sand. Nach pose() bzw. der Geh-Animation aufrufen.
export function holdPose(group, poseName = 'stehen') {
  const P = group.userData.parts;
  if (!P?.board) return;
  const liegt = poseName === 'sitzen' || poseName === 'liegen';
  P.board.visible = !liegt; P.boardSand.visible = liegt;
  if (!liegt) { // beide Hände am Brett; Pose-Requisiten (Kamera, Handy) bleiben weg
    for (const a of P.arms) a.rotation.set(-0.9, 0, 0);
    for (const m of Object.values(group.userData.poseProps ?? {})) m.visible = false;
    return;
  }
  const hipY = P.legs[0]?.position.y ?? 1.1;
  if (poseName === 'sitzen') { P.boardSand.position.set(1.05, hipY - 0.32 + 0.07, 0.25); P.boardSand.rotation.set(0, 0.15, 0); } // Boden liegt lokal bei hipY − 0.32
  else { P.boardSand.position.set(1.05, 0.6, -0.43); P.boardSand.rotation.set(Math.PI / 2, 0, 0); } // Figur liegt (−90° um x): lokal +z = oben, Boden bei z −0.5
}
export function setMood(group, mood) {
  const P = group.userData.parts;
  if (!P) return;
  setFace(P.decal, face('kunde', mood, group.userData.faceOpts));
  group.userData.mood = mood;
}

/** Reveal: der Zivi setzt die Polizeimütze auf (unabhängig von der Stimmung). */
export function setRevealed(group, on) {
  const P = group.userData.parts;
  if (P) P.capPolice.visible = !!on;
}
