// faces.js — gemalte Gesichter (Canvas-2D) als Decal auf Kugelköpfen. Simpsons-/Rick-&-Morty-Stil:
// große runde Augen mit dicker Kontur, kleine Pupillen, Lidlinien, Mund + Brauen als Striche.
// Das Decal ist ein vorderes Kugel-Segment (gleiche Verformung wie der Kopf, minimal größer) mit
// transparenter Textur; u=0 = linke Bildseite aus Betrachtersicht, v=1 = oben.
import * as THREE from 'three';
import { toon, rng } from './toon.js';

const S = 1024;

function eye(ctx, cx, cy, r, { lid = 0, lidTilt = 0, lidColor = '#f0b98a', pupil = 24, px = 0, py = 0, veins = 0, bag = false, seed = 1, stroke = 16 }) {
  const rand = rng(seed);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // Äderchen: vom Rand Richtung Pupille, verzweigt
  ctx.strokeStyle = '#d93a3a';
  ctx.lineWidth = 4;
  for (let i = 0; i < veins; i++) {
    const a = rand() * Math.PI * 2;
    const x0 = cx + Math.cos(a) * r * 0.95, y0 = cy + Math.sin(a) * r * 0.95;
    const x1 = cx + Math.cos(a) * r * 0.45 + (rand() - 0.5) * 20, y1 = cy + Math.sin(a) * r * 0.45 + (rand() - 0.5) * 20;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + (rand() - 0.5) * 30, (y0 + y1) / 2 + (rand() - 0.5) * 30, x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo((x0 + x1) / 2, (y0 + y1) / 2);
    ctx.lineTo((x0 + x1) / 2 + (rand() - 0.5) * 40, (y0 + y1) / 2 + (rand() - 0.5) * 40); ctx.stroke();
  }
  // Pupille
  ctx.fillStyle = '#111111';
  ctx.beginPath(); ctx.arc(cx + px, cy + py, pupil, 0, Math.PI * 2); ctx.fill();
  // Lid: Hautfarbe über dem oberen Teil, geclippt auf den Augapfel, mit dicker Lidlinie
  if (lid > 0) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.translate(cx, cy); ctx.rotate(lidTilt);
    const edge = -r + 2 * r * lid;
    ctx.fillStyle = lidColor;
    ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, edge + r * 1.5);
    ctx.strokeStyle = '#111111'; ctx.lineWidth = stroke * 0.8;
    ctx.beginPath(); ctx.moveTo(-r * 1.2, edge); ctx.lineTo(r * 1.2, edge); ctx.stroke();
    ctx.restore();
  }
  if (bag) {
    ctx.strokeStyle = '#111111'; ctx.lineWidth = stroke * 0.5;
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.55, r * 0.75, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  }
  // Kontur
  ctx.strokeStyle = '#111111'; ctx.lineWidth = stroke;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
}

function strokePath(ctx, pts, width, color = '#111111') {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].length === 4) ctx.quadraticCurveTo(pts[i][0], pts[i][1], pts[i][2], pts[i][3]);
    else ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.stroke();
}

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  return [c, ctx];
}

function finish(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Schluffi: verpeilt + selig — schwere, schräge Lider, Pupillen nach innen-oben, schiefes Grinsen, Stoppeln
export function schluffiFace(skinCss) {
  const [c, ctx] = makeCanvas();
  eye(ctx, 372, 330, 128, { lid: 0.48, lidTilt: 0.18, lidColor: skinCss, pupil: 24, px: 30, py: 14, veins: 3, seed: 3 });
  eye(ctx, 652, 330, 128, { lid: 0.48, lidTilt: -0.18, lidColor: skinCss, pupil: 24, px: -30, py: 14, veins: 3, seed: 4 });
  // entspannte, hochgezogene Brauen
  strokePath(ctx, [[260, 215], [360, 160, 470, 200]], 22);
  strokePath(ctx, [[554, 200], [664, 160, 764, 215]], 22);
  // Stoppeln am Kinn
  const rand = rng(9);
  ctx.fillStyle = 'rgba(80, 45, 20, 0.55)';
  for (let i = 0; i < 140; i++) {
    const x = 300 + rand() * 424, y = 600 + rand() * 300;
    if (Math.hypot(x - 512, y - 560) < 90) continue; // Platz für die 3D-Nase
    ctx.beginPath(); ctx.arc(x, y, 3.5 + rand() * 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // schiefes seliges Grinsen
  strokePath(ctx, [[330, 625], [520, 750, 730, 585]], 20);
  strokePath(ctx, [[730, 585], [752, 607]], 20);
  return finish(c);
}

// Turnschuh-Typ: misstrauisch / zu wachsam — schmale Lider, Pupillen zum Schluffi (links), V-Brauen, Tränensäcke
export function runnerFace(skinCss) {
  const [c, ctx] = makeCanvas();
  eye(ctx, 352, 330, 136, { lid: 0.32, lidTilt: 0.05, lidColor: skinCss, pupil: 24, px: -48, py: 6, bag: true, seed: 5 });
  eye(ctx, 672, 330, 136, { lid: 0.32, lidTilt: -0.05, lidColor: skinCss, pupil: 24, px: -48, py: 6, bag: true, seed: 6 });
  // skeptische Brauen, innen tiefer
  strokePath(ctx, [[220, 130], [470, 200]], 22);
  strokePath(ctx, [[560, 185], [800, 110]], 22);
  // zusammengekniffener Mund, ein Mundwinkel runter
  strokePath(ctx, [[370, 680], [520, 692, 670, 680]], 19);
  strokePath(ctx, [[670, 680], [700, 708]], 19);
  // Kieferlinie / Wangenknochen als dünne Striche
  strokePath(ctx, [[150, 560], [190, 680]], 8);
  strokePath(ctx, [[874, 560], [834, 680]], 8);
  return finish(c);
}

// Sonne: stoned — Schlafzimmeraugen, rote Äderchen, seliges Grinsen, rote Bäckchen
export function sunFace() {
  const [c, ctx] = makeCanvas();
  ctx.fillStyle = 'rgba(255, 110, 120, 0.55)';
  ctx.beginPath(); ctx.arc(215, 600, 70, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(809, 600, 70, 0, Math.PI * 2); ctx.fill();
  eye(ctx, 335, 390, 150, { lid: 0.6, lidTilt: 0.22, lidColor: '#ffd93b', pupil: 38, px: 20, py: 25, veins: 7, seed: 7, stroke: 20 });
  eye(ctx, 689, 390, 150, { lid: 0.6, lidTilt: -0.22, lidColor: '#ffd93b', pupil: 38, px: -45, py: 15, veins: 7, seed: 8, stroke: 20 });
  strokePath(ctx, [[250, 680], [512, 930, 775, 660]], 26);
  strokePath(ctx, [[775, 660], [800, 685]], 26);
  strokePath(ctx, [[250, 680], [232, 700]], 26);
  return finish(c);
}

/**
 * Decal-Mesh: vorderes Kugel-Segment, Radius r (minimal größer als der Kopf).
 * shape(geometry) wendet dieselben Transformationen an wie beim Kopf (Scale/Deform).
 */
export function faceDecal(texture, r, shape, { basic = false } = {}) {
  const geo = new THREE.SphereGeometry(r, 40, 32, Math.PI / 2 - 1.05, 2.1, Math.PI * 0.22, Math.PI * 0.62);
  if (shape) shape(geo);
  const mat = basic
    ? new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.02, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    : toon(0xffffff, { map: texture, transparent: true, alphaTest: 0.02, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = false;
  m.receiveShadow = true;
  m.name = 'face';
  return m;
}
