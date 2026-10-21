// marker.js — Tutorial-Hinweisgrafik: Leuchtring am Boden + schwebender Pfeil über dem Ziel, animiert.
// zielMarker({ x, z, y }) → Gruppe mit update(t), setPosition(x, z, y), show(an). Unbeleuchtet, additiv,
// wirft keinen Schatten, wird nicht ausgeblendet (userData.noFade). Farbe über opts.color.
import * as THREE from 'three';
import { toonMesh } from './toon.js';

export function zielMarker({ x = 0, z = 0, y = 0 } = {}, { color = 0xffd54a, radius = 1.1 } = {}) {
  const g = new THREE.Group();
  const add = (m) => { m.userData.noFade = true; g.add(m); return m; };
  const glow = (opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  // Leuchtring am Boden: fester Ring + pulsierender Außenring
  const ring = add(new THREE.Mesh(new THREE.RingGeometry(radius * 0.72, radius, 32), glow(0.85)));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
  const pulse = add(new THREE.Mesh(new THREE.RingGeometry(radius * 0.9, radius * 1.05, 32), glow(0.5)));
  pulse.rotation.x = -Math.PI / 2; pulse.position.y = 0.05;
  const disc = add(new THREE.Mesh(new THREE.CircleGeometry(radius * 0.7, 24), glow(0.18)));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04;
  // Pfeil: Kegel mit Spitze nach unten + Schaft, mit Kontur
  const arrow = new THREE.Group();
  const tip = toonMesh(new THREE.ConeGeometry(0.42, 0.9, 10), color, { outline: 0.05, shadow: false, basic: true });
  tip.rotation.x = Math.PI; tip.position.y = 0.45; arrow.add(tip);
  const shaft = toonMesh(new THREE.CylinderGeometry(0.16, 0.16, 0.8, 10), color, { outline: 0.04, shadow: false, basic: true });
  shaft.position.y = 1.3; arrow.add(shaft);
  arrow.position.y = 2.6; add(arrow);
  g.position.set(x, y, z);
  g.userData = { noFade: true, ring, pulse, disc, arrow, base: 2.6 };
  g.userData.update = (t) => {
    const u = (t * 0.8) % 1;
    pulse.scale.setScalar(1 + u * 1.1); pulse.material.opacity = 0.5 * (1 - u);
    ring.material.opacity = 0.7 + 0.25 * Math.sin(t * 4);
    arrow.position.y = g.userData.base + 0.3 * Math.sin(t * 3);
    arrow.rotation.y = t * 1.4;
  };
  g.userData.setPosition = (nx, nz, ny = 0) => { g.position.set(nx, ny, nz); };
  g.userData.show = (an) => { g.visible = !!an; };
  return g;
}

export const updateMarker = (m, t) => m.userData.update?.(t);
