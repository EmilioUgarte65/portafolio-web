/* Distrito — todo el mundo 3D del juego (Three.js). Mascotas: modelos esculpidos (web/modelos/mascotas.json, ver RIG) con respaldo procedural.
   Estilo "clay" kawaii: materiales mate aterciopelados, luz suave con contraluz, sin contornos;
   cuerpo-cabeza tipo mochi, ojos grandes y brillantes muy separados, boca diminuta y cachetes.

   API global (window.Monstruos):
     montar(contenedor, op)        mascota sola            -> { set, feliz, saludar, comer, destruir }
     montarCuarto(contenedor, op)  cuarto con la mascota   -> igual que montar
     montarJefe(contenedor, op)    jefe del mes (JEFES)    -> { set, golpe, destruir, datos }
     foto(op, tam) / fotoObjeto(tipo, clave, tam)          -> miniaturas dataURL
   op de mascota: { especie, color, ojos, equipo: {cabeza, cara, cuello, torso, espalda}, etapa, crecimiento }
   op de cuarto:  { mascota, muebles: {tapete, cama, sillon, planta, lampara, cuadro, tech, deco}, pared, piso }
   op de jefe:    { tipo (clave de JEFES, default 'rezago'), vida (0..1), derrotado } */
import * as THREE from './vendor/three.module.min.js';
import { mergeGeometries, mergeVertices } from './vendor/BufferGeometryUtils.js';

/* ============================================================ ACABADOS DE CAJA ("skins" estilo Counter-Strike)
   Un accesorio salido de caja trae acabado (a), desgaste 0..1 (d) y patron 0..999 (p): el patron decide el dibujo (no
   hay dos tigres iguales) y el desgaste le pone rayones y polvo. Se REEMPLAZA el material (los de clay() son compartidos
   por todas las mascotas); los materiales nuevos se guardan en cacheMat para que liberar() no los destruya. */
function azarDe(semilla) { let a = (semilla * 2654435761) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function desgastar(x, n, d, az) {   // rayones y polvo segun el desgaste
  if (d < 0.07) return;
  x.globalAlpha = Math.min(0.5, d * 0.7);
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1;
  for (let i = 0; i < 40 * d; i++) { const sx = az() * n, sy = az() * n; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (az() - 0.5) * 40, sy + (az() - 0.5) * 12); x.stroke(); }
  x.fillStyle = 'rgba(120,100,80,.35)';
  for (let i = 0; i < 120 * d; i++) { x.beginPath(); x.arc(az() * n, az() * n, 1 + az() * 3, 0, 7); x.fill(); }
  x.globalAlpha = 1;
}
const DIBUJO_SKIN = {
  concreto: (x, n, az) => { x.fillStyle = '#9b9a96'; x.fillRect(0, 0, n, n); for (let i = 0; i < 900; i++) { x.fillStyle = az() < 0.5 ? 'rgba(60,60,60,.35)' : 'rgba(230,230,225,.35)'; x.fillRect(az() * n, az() * n, 2, 2); } },
  plano: (x, n, az) => { x.fillStyle = '#1d4fa6'; x.fillRect(0, 0, n, n); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1;
    for (let i = 0; i <= n; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, n); x.moveTo(0, i); x.lineTo(n, i); x.stroke(); }
    x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = az() * n, b = az() * n; x.strokeRect(a, b, 20 + az() * 60, 14 + az() * 40); } },
  cinta: (x, n, az) => { x.fillStyle = '#c9a46a'; x.fillRect(0, 0, n, n); for (let y = 0; y < n; y += 22) { x.fillStyle = `rgba(255,240,200,${0.15 + az() * 0.2})`; x.fillRect(0, y, n, 12); } },
  ladrillo: (x, n) => { x.fillStyle = '#e8d8c4'; x.fillRect(0, 0, n, n); for (let f = 0; f < n / 20; f++) for (let c = -1; c < n / 40; c++) {
    x.fillStyle = ['#b4512d', '#a8482a', '#c15a33'][(f + c) % 3]; x.fillRect(c * 40 + (f % 2) * 20 + 2, f * 20 + 2, 36, 16); } },
  camuflaje: (x, n, az) => { x.fillStyle = '#7b7a4a'; x.fillRect(0, 0, n, n); for (const col of ['#4b5320', '#2f2f22', '#a89f68']) for (let i = 0; i < 14; i++) {
    x.fillStyle = col; x.beginPath(); const cx = az() * n, cy = az() * n; for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.28, r = 10 + az() * 22; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.fill(); } },
  senaletica: (x, n) => { x.fillStyle = '#f5c400'; x.fillRect(0, 0, n, n); x.fillStyle = '#1b1b1b'; for (let i = -n; i < n * 2; i += 36) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 18, 0); x.lineTo(i + 18 - n, n); x.lineTo(i - n, n); x.fill(); } },
  oxido: (x, n, az) => { x.fillStyle = '#6e3418'; x.fillRect(0, 0, n, n); for (let i = 0; i < 60; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 30);
    g.addColorStop(0, 'rgba(214,110,40,.7)'); g.addColorStop(1, 'rgba(214,110,40,0)'); x.save(); x.translate(az() * n, az() * n); x.fillStyle = g; x.fillRect(-30, -30, 60, 60); x.restore(); } },
  tigre: (x, n, az) => { x.fillStyle = '#f0891c'; x.fillRect(0, 0, n, n); x.fillStyle = '#1a1208'; for (let i = 0; i < 11; i++) { const y = az() * n, w = 6 + az() * 10; x.beginPath(); x.moveTo(0, y);
    for (let k = 0; k <= 8; k++) x.lineTo((k / 8) * n, y + Math.sin(k * 1.3 + i) * 14); for (let k = 8; k >= 0; k--) x.lineTo((k / 8) * n, y + w + Math.sin(k * 1.3 + i) * 10); x.fill(); } },
  fuego: (x, n, az) => { const g = x.createLinearGradient(0, n, 0, 0); g.addColorStop(0, '#ff2a00'); g.addColorStop(0.5, '#ff8a00'); g.addColorStop(1, '#ffe14a'); x.fillStyle = g; x.fillRect(0, 0, n, n);
    x.fillStyle = 'rgba(120,10,0,.55)'; for (let i = 0; i < 12; i++) { const cx = az() * n; x.beginPath(); x.moveTo(cx - 14, n); x.quadraticCurveTo(cx - 20, n * 0.5, cx, n * (0.15 + az() * 0.3)); x.quadraticCurveTo(cx + 16, n * 0.5, cx + 14, n); x.fill(); } },
  neon: (x, n, az) => { x.fillStyle = '#120c2a'; x.fillRect(0, 0, n, n); x.lineWidth = 3; for (let i = 0; i < 14; i++) { x.strokeStyle = az() < 0.5 ? '#ff3df0' : '#29f0ff'; x.shadowColor = x.strokeStyle; x.shadowBlur = 8;
    x.beginPath(); x.moveTo(az() * n, az() * n); x.lineTo(az() * n, az() * n); x.stroke(); } x.shadowBlur = 0; },
  galaxia: (x, n, az) => { const g = x.createRadialGradient(n * 0.4, n * 0.5, 4, n / 2, n / 2, n * 0.7); g.addColorStop(0, '#b05cff'); g.addColorStop(0.4, '#3b1c8f'); g.addColorStop(1, '#0a0620'); x.fillStyle = g; x.fillRect(0, 0, n, n);
    for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + az() * 0.7})`; const r = az() < 0.94 ? 0.8 : 2; x.beginPath(); x.arc(az() * n, az() * n, r, 0, 7); x.fill(); } },
  lava: (x, n, az) => { x.fillStyle = '#1c1210'; x.fillRect(0, 0, n, n); x.strokeStyle = '#ff6a00'; x.shadowColor = '#ffb000'; x.shadowBlur = 10; x.lineWidth = 3;
    for (let i = 0; i < 16; i++) { x.beginPath(); let px = az() * n, py = az() * n; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (az() - 0.5) * 60; py += (az() - 0.5) * 60; x.lineTo(px, py); } x.stroke(); } x.shadowBlur = 0; },
  arcoiris: (x, n) => { const g = x.createLinearGradient(0, 0, n, n); ['#ff3b3b', '#ff9f1c', '#ffe14a', '#3ddc84', '#29b6ff', '#7c4dff', '#ff3df0'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c)); x.fillStyle = g; x.fillRect(0, 0, n, n); },
};
const BRILLO_SKIN = { neon: 1.3, lava: 1.5, galaxia: 0.5, fuego: 0.35 };   // estos acabados emiten luz
function matSkin(ac) {
  const a = ac.a, d = Math.max(0, Math.min(1, ac.d ?? 0.2)), p = ac.p ?? 0;
  const llave = `skin|${a}|${p}|${Math.round(d * 10)}`;
  if (cacheMat.has(llave)) return cacheMat.get(llave);
  let m;
  // sin mapa de entorno un metal puro sale negro: brillo de laca + un poco de luz propia para que se lea como metal
  if (a === 'oro') m = new THREE.MeshPhysicalMaterial({ color: 0xffbf2e, metalness: 0.55, roughness: 0.22 + d * 0.3, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x7a4b00, emissiveIntensity: 0.35, sheen: 0.6, sheenColor: new THREE.Color(0xfff1b0) });
  else if (a === 'diamante') m = new THREE.MeshPhysicalMaterial({ color: 0xdff6ff, metalness: 0.25, roughness: 0.04 + d * 0.2, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.8, sheen: 1, sheenColor: new THREE.Color(0x9fe8ff), emissive: 0x6fd8ff, emissiveIntensity: 0.12 });
  else if (a === 'holograma') m = new THREE.MeshPhysicalMaterial({ color: 0xbfd2ff, metalness: 0.35, roughness: 0.12 + d * 0.25, iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [100, 900], clearcoat: 1, emissive: 0x5a6cff, emissiveIntensity: 0.18, sheen: 1, sheenColor: new THREE.Color(0xff9ff3) });
  else {
    const az = azarDe(p + 1);
    const tex = texCanvas((x, n) => { (DIBUJO_SKIN[a] || DIBUJO_SKIN.concreto)(x, n, az); desgastar(x, n, d, az); }, 256);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.offset.set((p % 37) / 37, (p % 23) / 23);
    m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.45 + d * 0.4, metalness: a === 'oxido' ? 0.55 : 0.05, clearcoat: d < 0.15 ? 0.7 : 0.2, clearcoatRoughness: 0.2,
      ...(BRILLO_SKIN[a] ? { emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: BRILLO_SKIN[a] * (1 - d * 0.5) } : {}),
      ...(a === 'arcoiris' ? { iridescence: 0.7, roughness: 0.22 + d * 0.3 } : {}) });
  }
  cacheMat.set(llave, m);
  return m;
}
function aplicarAcabado(obj, ac) {
  if (!obj || !ac?.a) return obj;
  const m = matSkin(ac);
  obj.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    const mt = o.material;
    if (mt.opacity < 0.95 || mt.transmission > 0 || mt.isMeshBasicMaterial) return;   // vidrios y luces se quedan como estan
    if (o.isInstancedMesh && o.instanceColor) o.instanceColor = null;   // plumas: su color por pieza taparia el acabado
    if (mt.side === THREE.FrontSide) { o.material = m; return; }
    const llave = `skin|lado${mt.side}|${ac.a}|${ac.p ?? 0}|${Math.round((ac.d ?? 0.2) * 10)}`;   // cascos y capas se ven por las dos caras
    if (!cacheMat.has(llave)) { const c = m.clone(); c.side = mt.side; cacheMat.set(llave, c); }
    o.material = cacheMat.get(llave);
  });
  return obj;
}

/* ============================================================ materiales "clay" */
const cacheMat = new Map();
function clay(color, extra = {}) {
  const llave = color + JSON.stringify(extra);
  const usarCache = !extra.map;
  if (usarCache && cacheMat.has(llave)) return cacheMat.get(llave);
  const c = new THREE.Color(color);
  const m = new THREE.MeshPhysicalMaterial({
    color: c, roughness: 0.7, metalness: 0, sheen: 0.6, sheenRoughness: 0.7,
    sheenColor: c.clone().lerp(new THREE.Color(0xffffff), 0.5), clearcoat: 0.1, clearcoatRoughness: 0.55, ...extra,
  });
  if (usarCache) cacheMat.set(llave, m);
  return m;
}
const brillo = (color) => clay(color, { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0 });
const metal = (color) => clay(color, { roughness: 0.25, metalness: 0.85, sheen: 0, clearcoat: 0.6 });
const plano = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
const esf = (r = 1, s = 40) => new THREE.SphereGeometry(r, s, Math.round(s * 0.75));
function malla(geo, mat, { pos = [0, 0, 0], esc = [1, 1, 1], rot = [0, 0, 0] } = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.scale.set(...esc); m.rotation.set(...rot);
  m.castShadow = true; return m;
}
const aclarar = (hex, k = 0.6) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), k).getHex();
const oscurecer = (hex, k = 0.25) => new THREE.Color(hex).lerp(new THREE.Color(0x000000), k).getHex();
function texCanvas(dibujar, tam = 256) {
  const c = document.createElement('canvas'); c.width = c.height = tam; dibujar(c.getContext('2d'), tam);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const radial = (rgba) => texCanvas((x, n) => {
  const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, `rgba(${rgba},1)`); g.addColorStop(1, `rgba(${rgba},0)`); x.fillStyle = g; x.fillRect(0, 0, n, n);
}, 64);
const TEX_CACHETE = radial('255,120,150');
const TEX_SOMBRA = radial('90,50,40');
const TEXTURAS_FIJAS = new Set([TEX_CACHETE, TEX_SOMBRA]);

/* Cuerpo "mochi": esfera aplanada abajo y un poco mas ancha en la base. */
function mochi(achatar = 0.45) {
  const g = new THREE.SphereGeometry(1, 56, 40), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    if (v.y < -0.35) { const k = -0.35 - v.y; v.y = -0.35 - k * achatar; v.x *= 1 + k * 0.18; v.z *= 1 + k * 0.18; }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
function corazonGeo(k = 0.2) {
  const s = new THREE.Shape();
  s.moveTo(0, -k * 0.9);
  s.bezierCurveTo(k * 1.4, k * 0.1, k * 0.7, k * 1.1, 0, k * 0.45);
  s.bezierCurveTo(-k * 0.7, k * 1.1, -k * 1.4, k * 0.1, 0, -k * 0.9);
  const g = new THREE.ExtrudeGeometry(s, { depth: k * 0.35, bevelEnabled: true, bevelSize: k * 0.12, bevelThickness: k * 0.12, bevelSegments: 4 });
  g.center(); return g;
}
function estrellaGeo(r1 = 0.18, r2 = 0.08) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 10; i++) { const r = i % 2 ? r2 : r1, a = (i / 10) * Math.PI * 2 + Math.PI / 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 });
  g.center(); return g;
}
const arco = (r = 0.12, grosor = 0.035, ang = Math.PI) => new THREE.TorusGeometry(r, grosor, 12, 24, ang);

/* ============================================================ pelajes */
export const PELAJES = {
  amarillo: 0xffd75e, naranja: 0xffa25c, rojo: 0xff8a8a, rosa: 0xffa9cf, morado: 0xc3a3ff, azul: 0x8fb8ff,
  cielo: 0x9fdcff, turquesa: 0x7fe0d1, verde: 0x9be08a, lima: 0xd5f27a, cafe: 0xc9926a, gris: 0xb9bfcc,
  negro: 0x5a5e7a, blanco: 0xfdfaf6, menta: 0xb5f5dc, dorado: 0xffcf3f, lavanda: 0xd9c8ff, durazno: 0xffc4a8,
};
export const OJOS = ['normal', 'feliz', 'estrella', 'dormilon', 'corazon'];

/* ============================================================ especies (todas kawaii) */
export const ESPECIES = {
  // extras(cab, colores, def, x): x = { cuerpo, raiz, piel, tor, info, ojos, atras, sombrero, sobre(), sobreTorso() }
  obra: { nombre: 'Ladrillín', color: 0xffa25c,
    extras(g, c, def, x) {
      // mezcla de cemento escurriendo sobre la cabeza (su sello) y un ladrillito suelto encima
      const cem = clay(0xf7ecdc);
      g.add(malla(superesfera(4, 32), cem, { pos: [0, 0.84, 0], esc: [1.04, 0.17, 0.98] }));
      for (const [dx, l] of [[-0.62, 0.12], [-0.24, 0.26], [0.2, 0.08], [0.58, 0.2]]) {
        const [p] = x.sobre(dx, 0.66 - l / 2, 0.75);
        g.add(malla(new THREE.CapsuleGeometry(0.07, l, 6, 12), cem, { pos: [p.x, p.y, p.z - 0.035], rot: [-0.3, 0, 0] }));
      }
      if (!x.sombrero) g.add(malla(superesfera(4, 24), clay(oscurecer(c.cuerpo, 0.08)), { pos: [0.3, 1.05, 0.02], esc: [0.3, 0.13, 0.16], rot: [0, 0.5, 0.18] }));
    } },
  pisos: { nombre: 'Azulín', color: 0x7fe0d1,
    extras(g, c, def, x) {
      // separadores de azulejo (crucecitas blancas) arriba, como pasadores
      if (!x.sombrero) for (const [dx, rz] of [[-0.42, 0.3], [0.38, -0.2]]) {
        const cruz = new THREE.Group(); cruz.position.set(dx, 0.76, 0.1); cruz.rotation.set(-Math.PI / 2 + 0.25, 0, rz);
        for (const r of [0, Math.PI / 2]) cruz.add(malla(new THREE.BoxGeometry(0.3, 0.08, 0.07), clay(0xffffff), { rot: [0, 0, r] }));
        g.add(cruz);
      }
    } },
  pintura: { nombre: 'Brochi', color: 0xc3a3ff,
    extras(g, c, def, x) {
      const tinta = clay(0xff5c9a);
      if (!x.sombrero) {
        // casquillo de metal y cerdas de brocha con la punta mojada en pintura
        g.add(malla(new THREE.CylinderGeometry(0.3, 0.37, 0.2, 28), metal(0xd7dce6), { pos: [0, 0.9, 0] }));
        g.add(malla(new THREE.TorusGeometry(0.34, 0.025, 8, 28), metal(0xc2c8d4), { pos: [0, 0.86, 0], rot: [Math.PI / 2, 0, 0] }));
        const cerdas = new THREE.Group(); cerdas.position.set(0, 0.98, 0); cerdas.rotation.z = -0.22; g.add(cerdas);
        const perfil = [[0.01, 0], [0.29, 0.02], [0.31, 0.16], [0.27, 0.32], [0.16, 0.5], [0.01, 0.66]].map(([a, b]) => new THREE.Vector2(a, b));
        cerdas.add(malla(new THREE.LatheGeometry(perfil, 24), clay(0xf3d9a4)));
        cerdas.add(malla(new THREE.LatheGeometry(perfil.slice(2).map((v) => new THREE.Vector2(v.x * 1.06 + 0.006, v.y + 0.006)), 24), tinta));
      }
      // charquito de pintura en la coronilla que escurre por la cabeza
      g.add(malla(esf(1, 40), tinta, { pos: [0, 0.72, 0], esc: [0.72, 0.3, 0.68] }));
      for (const [dx, l] of [[-0.42, 0.22], [-0.12, 0.34], [0.2, 0.16], [0.48, 0.28]]) {
        const [p, n] = x.sobre(dx, 0.62 - l / 2, 0.66, -0.03), gota = new THREE.Group();
        gota.add(malla(new THREE.CapsuleGeometry(0.07, l, 6, 12), tinta, { esc: [1, 1, 0.6] }));
        gota.add(malla(esf(0.09, 16), tinta, { pos: [0, -l / 2 - 0.02, 0], esc: [1, 1, 0.65] }));
        pegar(g, gota, p, n);
      }
    } },
  plomeria: { nombre: 'Gotita', color: 0x9fdcff,
    extras(g, c, def, x) {
      // destellos de agua (raya y puntito) que la hacen ver de cristal
      const luz = plano(0xffffff, { transparent: true, opacity: 0.85 });
      let [p, n] = x.sobre(-0.66, 0.28, 0.7, 0.01); pegar(g, malla(esf(1, 20), luz, { esc: [0.06, 0.24, 0.02] }), p, n).rotateZ(-0.45);
      [p, n] = x.sobre(-0.42, 0.62, 0.66, 0.01); pegar(g, malla(esf(0.055, 12), luz, { esc: [1, 1, 0.3] }), p, n);
      [p, n] = x.sobre(0.62, -0.62, 0.5, 0.01); pegar(g, malla(esf(1, 16), plano(0xffffff, { transparent: true, opacity: 0.35 }), { esc: [0.16, 0.05, 0.02] }), p, n).rotateZ(0.5);
    } },
  ferreteria: { nombre: 'Tuerquín', color: 0x9be08a, ojosSep: 0.3,
    extras(g, c, def, x) {
      const acero = metal(0xd7dce6), tope = 0.9;
      if (!x.sombrero) {  // tornillo-antena con foquito
        const t = new THREE.Group(); t.position.y = tope; g.add(t);
        t.add(malla(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 16), acero, { pos: [0, 0.18, 0] }));
        for (let i = 0; i < 4; i++) t.add(malla(new THREE.TorusGeometry(0.08, 0.024, 6, 16), acero, { pos: [0, 0.05 + i * 0.08, 0], rot: [Math.PI / 2 + 0.2, 0, 0] }));
        const foco = malla(esf(0.14, 24), new THREE.MeshBasicMaterial({ color: 0xfff27a }), { pos: [0, 0.48, 0] }); t.add(foco); g.userData.foco = foco;
      }
      // cabezas de tornillo a los lados (orejitas) y remaches en la cara
      for (const s of [-1, 1]) {
        g.add(malla(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 6), acero, { pos: [s * 1.06, 0, 0], rot: [0, 0, Math.PI / 2] }));
        for (const y of [0.66, -0.66]) g.add(malla(esf(0.045, 10), acero, { pos: [s * 0.42, y, 0.54] }));
      }
    } },
  patito: { nombre: 'Patito', color: 0xffd75e, boca: 'pico', brazos: 'ala', pies: 0xffa04a,
    extras(g, c, def, x) {
      const pico = new THREE.Group(); pico.position.set(0, -0.08, 0.93);
      pico.add(malla(esf(0.2), clay(0xffa04a), { esc: [1.2, 0.4, 0.75], pos: [0, 0.03, 0] }));
      const inf = malla(esf(0.17), clay(0xff8a2a), { esc: [1.05, 0.3, 0.65], pos: [0, -0.05, -0.02] });
      pico.add(inf); g.add(pico); g.userData.mandibula = inf;
      // copetito de tres plumas y colita de plumas parada
      if (!x.sombrero) for (const i of [-1, 0, 1]) g.add(malla(new THREE.CapsuleGeometry(0.055, 0.16, 4, 10), x.piel, { pos: [i * 0.09, 0.97 + (i ? 0 : 0.05), 0.02], rot: [0.15, 0, -i * 0.6] }));
      for (const i of [-1, 0, 1]) x.cuerpo.add(malla(new THREE.ConeGeometry(0.1, 0.32, 14), x.piel, { pos: [i * 0.09, x.tor.y + 0.02, x.atras + 0.02], rot: [-1.0, 0, -i * 0.5], esc: [1, 1, 0.55] }));
    } },
  cocodrilo: { nombre: 'Coco', color: 0x8fd67a, boca: 'hocico', ojosY: 0.5, ojosZ: 0.74, ojosSep: 0.36,
    extras(g, c, def, x) {
      const osc = clay(oscurecer(c.cuerpo, 0.18)), diente = clay(0xffffff);
      // hocico largo con dientitos y fosas nasales
      const hocico = new THREE.Group(); hocico.position.set(0, -0.16, 0.6); g.add(hocico);
      hocico.add(malla(esf(0.5), x.piel, { esc: [0.9, 0.42, 1.08], pos: [0, 0.06, 0.32] }));
      for (const s of [-1, 1]) {
        hocico.add(malla(esf(0.08, 16), x.piel, { pos: [s * 0.13, 0.22, 0.74] }));
        hocico.add(malla(esf(0.028, 10), plano(0x3d2b4f), { pos: [s * 0.13, 0.27, 0.79] }));
        for (const a of [0.5, 0.9, 1.25]) hocico.add(malla(new THREE.ConeGeometry(0.04, 0.1, 8), diente, { pos: [s * 0.43 * Math.cos(a), -0.02, 0.32 + 0.51 * Math.sin(a)], rot: [Math.PI, 0, 0] }));
      }
      const inf = malla(esf(0.44), clay(c.panza), { esc: [0.86, 0.27, 1.0], pos: [0, -0.1, 0.28] }); hocico.add(inf); g.userData.mandibula = inf;
      for (const s of [-1, 1]) g.add(malla(esf(0.26), x.piel, { pos: [s * 0.36, 0.5, 0.52] }));
      // cresta de escamas: cabeza, espalda y cola
      for (const t of [0.55, 0.9, 1.25]) g.add(malla(esf(0.1, 12), osc, { pos: [0, 0.86 * Math.cos(t) + 0.03, -Math.sin(t) - 0.02], esc: [0.55, 1, 1.2], rot: [-t, 0, 0] }));
      const { cuerpo, tor, atras } = x, ry = tor.r * tor.esc[1], rz = tor.r * tor.esc[2];
      for (const t of [0.95, 1.35, 1.75, 2.15]) cuerpo.add(malla(esf(0.09, 12), osc, { pos: [0, tor.y + ry * Math.cos(t), -rz * Math.sin(t) - 0.02], esc: [0.55, 1, 1.2], rot: [-t, 0, 0] }));
      // colota gruesa que llega al suelo y se curva
      for (let i = 0; i < 7; i++) {
        const r = 0.27 - i * 0.03, z = atras + 0.05 - i * 0.15, y = tor.y - 0.32 - i * 0.055, px = i * i * 0.012;
        cuerpo.add(malla(esf(r, 20), x.piel, { pos: [px, y, z] }));
        if (i % 2 === 0) cuerpo.add(malla(esf(0.07, 10), osc, { pos: [px, y + r * 0.92, z], esc: [0.6, 1, 1.1] }));
      }
    } },
  ajolote: { nombre: 'Ajolotito', color: 0xffa9cf, ojosSep: 0.46, boca: 'sonrisa',
    extras(g, c, def, x) {
      const branq = clay(new THREE.Color(c.cuerpo).offsetHSL(-0.03, 0.2, -0.12).getHex());
      // tres pares de branquias con flequito
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        const rama = new THREE.Group(); rama.position.set(s * (1.0 - i * 0.04), 0.42 - i * 0.27, -0.12); rama.rotation.set(-0.15, 0, s * (-0.4 - i * 0.55));
        rama.add(malla(new THREE.CapsuleGeometry(0.06, 0.4, 6, 10), branq, { pos: [0, 0.24, 0] }));
        for (let k = 0; k < 3; k++) for (const f of [-1, 1]) rama.add(malla(esf(0.06, 12), branq, { pos: [f * 0.075, 0.16 + k * 0.12 + (f > 0 ? 0.05 : 0), 0], esc: [1.1, 0.75, 0.75] }));
        g.add(rama);
      }
      // aleta en la espalda y colita de pez
      const aleta = clay(aclarar(c.cuerpo, 0.35)), { cuerpo, tor, atras } = x;
      cuerpo.add(malla(esf(1, 24), aleta, { pos: [0, tor.y + 0.08, atras + 0.03], esc: [0.03, 0.3, 0.2] }));
      const cola = new THREE.Group(); cola.position.set(0, tor.y - 0.28, atras + 0.02); cola.rotation.set(0.35, 0.4, 0); cuerpo.add(cola);
      cola.add(malla(esf(1, 24), x.piel, { pos: [0, 0, -0.3], esc: [0.13, 0.17, 0.42] }));
      cola.add(malla(esf(1, 24), aleta, { pos: [0, 0.02, -0.4], esc: [0.035, 0.3, 0.5] }));
    } },
  xolo: { nombre: 'Xolo', color: 0x8a90a8, boca: 'gato', bocaPos: [-0.29, 1.13],
    extras(g, c, def, x) {
      for (const s of [-1, 1]) {  // orejotas de murcielago
        const oreja = new THREE.Group(); oreja.position.set(s * 0.42, 0.7, -0.08); oreja.rotation.set(-0.12, 0, s * -0.3); g.add(oreja);
        oreja.add(malla(new THREE.ConeGeometry(0.3, 0.82, 32), x.piel, { pos: [0, 0.36, 0], esc: [1, 1, 0.42] }));
        oreja.add(malla(new THREE.ConeGeometry(0.2, 0.6, 24), clay(0xffb3c6), { pos: [0, 0.3, 0.07], esc: [1, 1, 0.3] }));
      }
      // hocico largo con naricita
      g.add(malla(esf(1, 32), clay(aclarar(c.cuerpo, 0.2)), { pos: [0, -0.2, 0.76], esc: [0.36, 0.27, 0.42] }));
      g.add(malla(esf(0.085, 16), brillo(0x2d2440), { pos: [0, -0.1, 1.16], esc: [1.4, 0.9, 0.8] }));
      // copetito de pelo y arruguitas en la frente
      if (!x.sombrero) for (const [px, py, pz, r] of [[0, 1.1, 0.12, 0.14], [-0.15, 1.02, 0.2, 0.11], [0.15, 1.03, 0.16, 0.12], [0, 1.05, -0.08, 0.13], [0.05, 0.98, 0.32, 0.1]]) g.add(malla(esf(r, 16), clay(0xfff4e4), { pos: [px, py, pz] }));
      for (const k of [0, 1]) { const [p, n] = x.sobre(0, 0.56 + k * 0.1, 0.8, 0); pegar(g, malla(arco(0.1 - k * 0.025, 0.013, 2.2), plano(oscurecer(c.cuerpo, 0.3))), p, n).rotateZ(0.47); }
      // colita delgada parada
      const { cuerpo, tor, atras } = x;
      const curva = new THREE.CatmullRomCurve3([[0, 0, 0], [0, 0.12, -0.18], [0.05, 0.38, -0.3], [0.12, 0.55, -0.22]].map((p) => new THREE.Vector3(...p)));
      cuerpo.add(malla(new THREE.TubeGeometry(curva, 16, 0.045, 8), x.piel, { pos: [0, tor.y - 0.1, atras + 0.03] }));
      cuerpo.add(malla(esf(0.045, 10), x.piel, { pos: [0.12, tor.y + 0.45, atras - 0.19] }));
    } },
  gatito: { nombre: 'Michi', color: 0xffc48a, boca: 'gato',
    extras(g, c, def, x) {
      const bigote = plano(oscurecer(c.cuerpo, 0.5));
      for (const s of [-1, 1]) {
        const oreja = new THREE.Group(); oreja.position.set(s * 0.56, 0.6, -0.02); oreja.rotation.set(-0.1, 0, s * -0.5); g.add(oreja);
        oreja.add(malla(new THREE.ConeGeometry(0.29, 0.46, 24), x.piel, { pos: [0, 0.2, 0], esc: [1, 1, 0.55] }));
        oreja.add(malla(new THREE.ConeGeometry(0.17, 0.3, 20), clay(0xffb3c6), { pos: [0, 0.17, 0.08], esc: [1, 1, 0.35] }));
        // bigotes
        for (let i = -1; i <= 1; i++) g.add(malla(new THREE.CylinderGeometry(0.009, 0.009, 0.34, 5), bigote, { pos: [s * 0.84, -0.1 + i * 0.065, 0.72], rot: [0, s * 0.45, Math.PI / 2 + s * i * 0.15] }));
      }
      g.add(malla(esf(0.055, 16), clay(0xff8fa3), { pos: [0, -0.02, 0.99], esc: [1.3, 0.85, 0.7] }));
      // colita enroscada con la punta oscura
      const { cuerpo, tor, atras } = x;
      const curva = new THREE.CatmullRomCurve3([[0, 0, 0.05], [0.04, 0.02, -0.22], [0.14, 0.28, -0.4], [0.2, 0.58, -0.36], [0.12, 0.72, -0.18], [0.02, 0.66, -0.08]].map((p) => new THREE.Vector3(...p)));
      cuerpo.add(malla(new THREE.TubeGeometry(curva, 28, 0.065, 10), x.piel, { pos: [0, tor.y - 0.12, atras] }));
      cuerpo.add(malla(esf(0.075, 14), clay(oscurecer(c.cuerpo, 0.25)), { pos: [0.02, tor.y + 0.54, atras - 0.08] }));
    } },
  pinguino: { nombre: 'Pingui', color: 0x4f5677, panzaFija: 0xfdfaf6, boca: 'piquito', brazos: 'aleta', pies: 0xffa04a, ojosZ: 0.93, ojosZPlano: 1.0, mejillaSalir: 0.07,
    extras(g, c, def, x) {
      // antifaz blanco en forma de corazon
      const blanco = clay(0xfdfaf6);
      for (const s of [-1, 1]) g.add(malla(esf(0.46, 32), blanco, { pos: [s * 0.27, 0.16, 0.64], esc: [1, 1.05, 0.8] }));
      g.add(malla(esf(0.44, 32), blanco, { pos: [0, -0.14, 0.64], esc: [1.15, 0.85, 0.78] }));
      if (!x.sombrero) for (const i of [-1, 0, 1]) g.add(malla(new THREE.CapsuleGeometry(0.045, 0.14, 4, 8), x.piel, { pos: [i * 0.07, 0.96 + (i ? 0 : 0.04), 0], rot: [0.1, 0, -i * 0.6] }));
    } },
  conejito: { nombre: 'Conejito', color: 0xfdfaf6, boca: 'gato',
    extras(g, c, def, x) {
      const rosa = clay(0xffb3c6);
      for (const s of [-1, 1]) {
        const oreja = new THREE.Group(); oreja.position.set(s * 0.3, 0.8, -0.02); oreja.rotation.z = s * -0.2;
        oreja.add(malla(new THREE.CapsuleGeometry(0.15, 0.36, 8, 16), x.piel, { pos: [0, 0.3, 0], esc: [1, 1, 0.65] }));
        oreja.add(malla(new THREE.CapsuleGeometry(0.085, 0.3, 8, 12), rosa, { pos: [0, 0.3, 0.07], esc: [1, 1, 0.5] }));
        const punta = new THREE.Group(); punta.position.y = 0.58; punta.rotation.set(s > 0 ? 0.3 : 0.08, 0, s > 0 ? -1.15 : 0); oreja.add(punta);  // la derecha se dobla hacia afuera
        punta.add(malla(new THREE.CapsuleGeometry(0.15, 0.2, 8, 16), x.piel, { pos: [0, 0.14, 0], esc: [1, 1, 0.65] }));
        punta.add(malla(new THREE.CapsuleGeometry(0.085, 0.16, 8, 12), rosa, { pos: [0, 0.12, 0.07], esc: [1, 1, 0.5] }));
        g.add(oreja); g.userData[s < 0 ? 'orejaI' : 'orejaD'] = oreja;
      }
      // naricita y dientitos
      g.add(malla(esf(0.05, 12), clay(0xff8fa3), { pos: [0, -0.02, 0.99], esc: [1.3, 0.9, 0.8] }));
      for (const s of [-1, 1]) g.add(malla(new THREE.BoxGeometry(0.05, 0.065, 0.03), clay(0xffffff), { pos: [s * 0.028, -0.15, 0.975] }));
      // colita de pompon
      const { cuerpo, tor, atras } = x, blanco = clay(aclarar(c.cuerpo, 0.7));
      for (const [px, py, pz] of [[0, 0, 0], [0.08, 0.06, -0.03], [-0.08, 0.05, -0.02], [0.05, -0.07, -0.02], [-0.06, -0.06, -0.03]]) cuerpo.add(malla(esf(0.12, 16), blanco, { pos: [px, tor.y - 0.15 + py, atras - 0.06 + pz] }));
    } },
  panda: { nombre: 'Pandita', color: 0xfdfaf6, boca: 'gato', ojoClaro: true, parches: 0x4a4d63, bocaPos: [-0.2, 1.0],
    extras(g, c, def, x) {
      const negro = clay(def.parches);
      for (const s of [-1, 1]) g.add(malla(esf(0.25, 24), negro, { pos: [s * 0.66, 0.72, -0.05], esc: [1, 1, 0.7] }));
      g.add(malla(esf(1, 32), clay(aclarar(c.cuerpo, 0.4)), { pos: [0, -0.16, 0.74], esc: [0.3, 0.2, 0.26] }));
      g.add(malla(esf(0.065, 12), brillo(0x2d2440), { pos: [0, -0.07, 1.0], esc: [1.4, 0.9, 0.8] }));
      // banda negra de hombro a hombro y colita
      const { cuerpo, tor } = x;
      cuerpo.add(malla(new THREE.TorusGeometry(tor.r * 0.86, 0.2, 12, 28, Math.PI), negro, { pos: [0, tor.y + 0.12, -0.04], rot: [-Math.PI / 2, 0, 0], esc: [1.12, 1, 1.0] }));
      cuerpo.add(malla(esf(0.13, 16), negro, { pos: [0, tor.y - 0.3, x.atras + 0.02] }));
    } },
  murcielago: { nombre: 'Murci', color: 0xb7a3ec, boca: 'gato',
    extras(g, c, def, x) {  // respaldo procedural: orejotas puntiagudas
      for (const s of [-1, 1]) g.add(malla(new THREE.ConeGeometry(0.3, 0.7, 24), x.piel, { pos: [s * 0.6, 0.85, -0.05], rot: [0, 0, s * -0.5], esc: [1, 1, 0.4] }));
    } },
  capibara: { nombre: 'Capi', color: 0xb98a5c, boca: 'gato' },
  mapache: { nombre: 'Mapachito', color: 0x86868a, boca: 'gato', ojoClaro: true },
  tiburon: { nombre: 'Tibu', color: 0x6f86a3, boca: 'sonrisa' },
  unicornio: { nombre: 'Unicornio', color: 0xfdf4ff, bocaPos: [-0.47, 1.1],
    extras(g, c, def, x) {
      const ARCO = [0xff9ccf, 0xffb38a, 0xffe07a, 0x9be08a, 0x8fd8ff, 0xc3a3ff];
      // cuerno en espiral
      const cuerno = deformar(new THREE.ConeGeometry(0.13, 0.55, 24, 12), (v) => { const a = Math.atan2(v.z, v.x), k = 1 + 0.16 * Math.sin(a * 2 + v.y * 26); v.x *= k; v.z *= k; });
      g.add(malla(cuerno, metal(0xffd36b), { pos: [0, 1.1, 0.22], rot: [0.3, 0, 0] }));
      for (const s of [-1, 1]) {  // orejitas
        g.add(malla(new THREE.ConeGeometry(0.12, 0.32, 16), x.piel, { pos: [s * 0.4, 0.86, -0.12], rot: [0, 0, s * -0.4], esc: [1, 1, 0.6] }));
        g.add(malla(new THREE.ConeGeometry(0.07, 0.2, 12), clay(0xffc4dc), { pos: [s * 0.41, 0.85, -0.07], rot: [0, 0, s * -0.4], esc: [1, 1, 0.4] }));
      }
      // hocico pastel con fosas
      g.add(malla(esf(1, 32), clay(new THREE.Color(c.cuerpo).lerp(new THREE.Color(0xffc4e6), 0.35).getHex()), { pos: [0, -0.3, 0.72], esc: [0.48, 0.38, 0.46] }));
      for (const s of [-1, 1]) g.add(malla(esf(0.045, 12), plano(0xb48ac8), { pos: [s * 0.14, -0.26, 1.15], esc: [1, 1.4, 0.5] }));
      // copete y crin arcoiris que cae por la nuca
      for (const [i, dx, dy, r] of [[0, -0.3, 0.8, 0.22], [5, -0.02, 0.92, 0.19]]) { const [p] = x.sobre(dx, dy, 0.42, -0.07); g.add(malla(esf(r, 20), clay(ARCO[i]), { pos: [p.x, p.y, p.z] })); }
      // la crin cae de lado (hacia su izquierda) en rizos grandes, de la coronilla al cuello
      [[0.25, 0.95, -0.1, 0.27], [0.62, 0.72, -0.2, 0.29], [0.86, 0.36, -0.22, 0.28], [0.95, -0.04, -0.2, 0.26], [0.88, -0.44, -0.18, 0.24], [0.66, -0.78, -0.2, 0.22]].forEach(([dx, dy, dz, r], i) => {
        const [p] = x.sobre(dx, dy, dz, -0.05); g.add(malla(esf(r, 22), clay(ARCO[i]), { pos: [p.x, p.y, p.z] }));
      });
      for (let i = 0; i < 4; i++) { const t = 0.7 + i * 0.45, [p] = x.sobre(0.05, Math.cos(t), -Math.sin(t), -0.06); g.add(malla(esf(0.24, 18), clay(ARCO[(i + 2) % 6]), { pos: [p.x, p.y, p.z] })); }
      // cola arcoiris esponjada
      const { cuerpo, tor, atras } = x;
      for (let i = 0; i < 6; i++) cuerpo.add(malla(esf(0.2 - i * 0.012, 18), clay(ARCO[i]), { pos: [0.06 + i * 0.05, tor.y + 0.02 - i * 0.13, atras - 0.14 - Math.sin(i * 0.6) * 0.16] }));
      // pestanitas y estrellita en la cadera
      for (const o of x.ojos.children) { const s = Math.sign(o.position.x); for (const k of [0, 1]) o.add(malla(new THREE.CapsuleGeometry(0.018, 0.07, 4, 6), plano(NEGRO_OJO), { pos: [s * (0.15 + k * 0.045), 0.17 - k * 0.06, 0.02], rot: [0, 0, -s * (0.6 + k * 0.5)] })); }
      const [p, n] = x.sobreTorso(0.85, -0.35, 0.4, 0.0); pegar(cuerpo, malla(estrellaGeo(0.09, 0.04), metal(0xffd36b)), p, n);
    } },
};

/* ============================================================ ojos (5 estilos) */
const NEGRO_OJO = 0x2d2440;
// claro: la especie trae antifaz/parche oscuro detrás del ojo (mapache, panda): los ojos de línea van claros para leerse
function ojo(estilo, claro = false) {
  const g = new THREE.Group(), linea = claro ? 0xfff4e4 : NEGRO_OJO;
  // con trazo claro, un contorno oscuro fino detrás: se lee sobre el antifaz oscuro y sobre el pelo blanco
  const contorno = (r, gr, o) => { if (claro) g.add(malla(arco(r, gr + 0.013), plano(NEGRO_OJO), { ...o, pos: [o.pos[0], o.pos[1], o.pos[2] - 0.035] })); };
  if (estilo === 'feliz') { contorno(0.11, 0.032, { pos: [0, -0.04, 0.02] }); g.add(malla(arco(0.11, 0.032), plano(linea), { pos: [0, -0.04, 0.02] })); return g; }
  if (estilo === 'dormilon') { contorno(0.1, 0.03, { rot: [0, 0, Math.PI], pos: [0, 0.03, 0.02] }); g.add(malla(arco(0.1, 0.03), plano(linea), { rot: [0, 0, Math.PI], pos: [0, 0.03, 0.02] })); return g; }
  if (estilo === 'corazon') { g.add(malla(corazonGeo(0.15), brillo(0xff4f7b), { esc: [1, 1, 0.6] }));
    g.add(malla(esf(0.03, 10), plano(0xffffff), { pos: [-0.05, 0.05, 0.06] })); return g; }
  if (estilo === 'estrella') { g.add(malla(estrellaGeo(0.17, 0.08), brillo(0xffb800)));
    g.add(malla(esf(0.03, 10), plano(0xffffff), { pos: [-0.04, 0.04, 0.05] })); return g; }
  if (estilo === 'guino') { contorno(0.1, 0.03, { pos: [0, -0.03, 0.02], rot: [0, 0, 0.12], esc: [1, 0.85, 1] }); g.add(malla(arco(0.1, 0.03), plano(linea), { pos: [0, -0.03, 0.02], rot: [0, 0, 0.12], esc: [1, 0.85, 1] }));
    g.add(malla(new THREE.CapsuleGeometry(0.014, 0.05, 4, 6), plano(linea), { pos: [0.11, 0.0, 0.02], rot: [0, 0, -0.9] })); return g; }
  // saltón (Party Animals: pato, dino): bola blanca brillante con pupila negra chica y destello
  if (estilo === 'salton') { g.add(malla(esf(1, 24), brillo(0xfbfbf8), { esc: [0.12, 0.13, 0.09] }));
    g.add(malla(esf(1, 16), brillo(0x141018), { pos: [0.0, 0.0, 0.075], esc: [0.045, 0.05, 0.03] }));
    g.add(malla(esf(0.014, 8), plano(0xffffff), { pos: [-0.015, 0.02, 0.1], esc: [1, 1, 0.5] })); return g; }
  // cuenta (peluche): canica negra brillante con un destello grande y uno chico
  if (estilo === 'cuenta') { g.add(malla(GEO_OJO, matCuenta(), { esc: [0.092, 0.1, 0.062] }));
    g.add(malla(esf(0.03, 12), plano(0xffffff), { pos: [-0.032, 0.042, 0.055], esc: [1, 1, 0.45] }));
    g.add(malla(esf(0.012, 8), plano(0xffffff), { pos: [0.036, -0.038, 0.055], esc: [1, 1, 0.45] })); return g; }
  // normal: ojo de vinil con iris degradado (oscuro arriba, violeta abajo) y dos destellos
  g.add(malla(GEO_OJO, matIris(), { esc: [0.162, 0.188, 0.075] }));
  g.add(malla(esf(0.055, 16), plano(0xffffff), { pos: [-0.05, 0.065, 0.07], esc: [1, 1.1, 0.4] }));
  g.add(malla(esf(0.026, 12), plano(0xffffff), { pos: [0.055, -0.065, 0.062], esc: [1, 1, 0.4] }));
  return g;
}
// esfera unitaria con uv plano (para pintar el iris de frente)
const GEO_OJO = (() => { const g = new THREE.SphereGeometry(1, 32, 24), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.5 + 0.5, p.getY(i) * 0.5 + 0.5);
  g.userData.fija = true; return g; })();
// ojo de peluche (Party Animals): pupila negra grande, iris café oscuro con aro cálido sutil, orilla oscura
let MAT_CUENTA = null;
function matCuenta() {
  if (MAT_CUENTA) return MAT_CUENTA;
  const t = texCanvas((x, n) => {
    const r = x.createRadialGradient(n * 0.5, n * 0.5, 0, n * 0.5, n * 0.5, n * 0.5);
    r.addColorStop(0, '#0d0a0c'); r.addColorStop(0.55, '#16100f'); r.addColorStop(0.74, '#4a2c1f');
    r.addColorStop(0.88, '#2a1a14'); r.addColorStop(1, '#0d0a0c');
    x.fillStyle = r; x.fillRect(0, 0, n, n);
  }, 128);
  TEXTURAS_FIJAS.add(t);
  MAT_CUENTA = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 });
  cacheMat.set('cuenta', MAT_CUENTA); return MAT_CUENTA;
}
let MAT_IRIS = null;
function matIris() {
  if (MAT_IRIS) return MAT_IRIS;
  const t = texCanvas((x, n) => {
    const g = x.createLinearGradient(0, 0, 0, n); g.addColorStop(0, '#1b1328'); g.addColorStop(0.45, '#2a1f45'); g.addColorStop(1, '#6d55c4');
    x.fillStyle = g; x.fillRect(0, 0, n, n);
    const r = x.createRadialGradient(n * 0.5, n * 0.92, 0, n * 0.5, n * 0.92, n * 0.42); r.addColorStop(0, 'rgba(185,160,255,0.95)'); r.addColorStop(1, 'rgba(185,160,255,0)');
    x.fillStyle = r; x.fillRect(0, 0, n, n);
  }, 128);
  TEXTURAS_FIJAS.add(t);
  MAT_IRIS = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 });
  cacheMat.set('iris', MAT_IRIS); return MAT_IRIS;
}

/* ============================================================ prendas (por parte del cuerpo)
   Se disenan una sola vez contra las anclas del RIG (ver infoRig):
   cabeza/cara en el marco de la cabeza: asiento (donde se apoya un sombrero), cima, ancho, ojosY/ojosZ/sep, bocaY/bocaZ
   cuello/espalda en el marco del cuerpo: cuelloY/cuelloR, pechoY/pechoZ, espaldaY/espaldaZ */
const torneado = (pts, s = 36) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), s);
const dobleCara = (c, extra = {}) => clay(c, { side: THREE.DoubleSide, ...extra });
const tubo = (pts, r, seg = 24, rs = 8) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, rs);
// sombreros que tapan la coronilla: con ellos las orejas separadas se doblan hacia afuera (no atraviesan el ala)
// V8.2: salvo el casco (aprobado, se dejó como estaba), ningún sombrero dobla orejas hacia los lados (se leían como
// cuernitos al revés): los de copa usan ajustarDomo / gorraPegada (oreja que apenas asoma se guarda bajo la tela; la que asoma mucho sale DERECHA por un ojal arriba)
const SOMBREROS_CON_ALA = new Set(['casco']);   // el casco se conserva como estaba (aprobado): dobla orejas
// grupo de sombrero apoyado en el asiento de la cabeza (escala con el ancho de la cabeza)
function sombreroEn(c, dy = 0, inclina = -0.12) {
  const g = new THREE.Group(), asiento = (c.asiento ?? c.cima - 0.1) - 0.05;
  g.position.set(0, asiento + dy, -0.03); g.rotation.x = inclina; g.scale.setScalar((c.ancho ?? 0.48) / 0.48); return g;
}
/* V8: domo de sombrero contra la cabeza REAL. perfil = [[r, y], ...] del domo en el marco del sombrero (antes de escalar).
   1) crece lo justo (hasta kmax) para que el cráneo quede adentro con un margen (esquinas de la tuerca de Tuerquín, etc.)
   2) lo que aun así sale (orejas que no se doblan, cuerno, cresta, aleta) atraviesa la tela por un OJAL: se calcula el
      contorno exacto donde la malla cruza el domo y se le cose un ribete, como en los sombreros de peluche. */
function ajustarDomo(c, g, perfil, { ribete = 0xffe17a, margen = 0.035, kmax = 1.22, grueso = 0.028, tipos = ['oreja', 'cuerno', 'cuerpo'], simetrico = true } = {}) {
  const mallas = c.mallasCabeza?.(); if (!mallas?.length) return { k: 1, ojales: 0 };
  const P = [...perfil].sort((a, b) => a[1] - b[1]), y0 = P[0][1], ytop = P[P.length - 1][1];
  const rDe = (y) => { if (y <= y0) return P[0][0]; for (let i = 1; i < P.length; i++) if (y <= P[i][1]) { const [ra, ya] = P[i - 1], [rb, yb] = P[i]; return ra + (rb - ra) * (y - ya) / (yb - ya || 1); } return 0; };
  g.updateMatrix();
  const inv = g.matrix.clone().invert(), s0 = g.scale.x, v = new THREE.Vector3();
  const loc = mallas.map((m) => { const a = new Float32Array(m.n * 3); for (let i = 0; i < m.n; i++) { v.fromArray(m.pos, i * 3).applyMatrix4(inv); a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z; } return a; });
  // 1) crecer: solo el cráneo (tipo cuerpo); lo que ni con kmax cabe es un saliente (aleta) y va por ojal
  const fuera = (k, x, y, z) => { const yy = y / k, m = margen / (s0 * k); return yy > 0.02 && (yy > ytop - m || Math.hypot(x, z) / k > rDe(yy) - m); };
  // un saliente delgado (aleta de tiburón) se reconoce porque a ±25° la piel queda mucho más adentro: no agranda
  const delgado = new Map(), esDelgado = (m, i) => {
    const x = m.pos[i * 3], y = m.pos[i * 3 + 1], z = m.pos[i * 3 + 2], a = Math.atan2(x, z), r = Math.hypot(x, z);
    const llave = Math.round(y / 0.04) + ':' + Math.round(a / 0.17);
    if (!delgado.has(llave)) {
      if (!c.craneo) { delgado.set(llave, false); return false; }
      const vec = [-0.45, 0.45].map((da) => { const p = c.craneo(y, a + da); return p ? Math.hypot(p.x, p.z) : 0; });
      delgado.set(llave, r - Math.max(...vec) > 0.1);
    }
    return delgado.get(llave);
  };
  const cand = [];
  mallas.forEach((m, j) => { if (m.tipo !== 'cuerpo') return; const a = loc[j];
    for (let i = 0; i < m.n; i++) if (fuera(1, a[i * 3], a[i * 3 + 1], a[i * 3 + 2]) && !esDelgado(m, i)) cand.push(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]); });
  let k = 1, sube = 0;
  if (cand.length) {
    const ok = (kk, dyl = 0) => { for (let i = 0; i < cand.length; i += 3) if (fuera(kk, cand[i], cand[i + 1] - dyl * kk, cand[i + 2])) return false; return true; };
    if (ok(kmax)) { let lo = 1, hi = kmax; for (let it = 0; it < 12; it++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; } k = hi; }
    else {   // ni creciendo cabe (punta de la gota, cráneo alto): además se sube lo justo
      k = kmax; let lo = 0, hi = 0.5;
      for (let it = 0; it < 12; it++) { const mid = (lo + hi) / 2; if (ok(k, mid)) hi = mid; else lo = mid; }
      sube = hi;
    }
  }
  g.scale.multiplyScalar(k);
  if (sube) { g.position.y += sube * s0 * k; for (const a of loc) for (let i = 1; i < a.length; i += 3) a[i] -= sube * k; }
  // 2) ojales: aristas de la malla que cruzan la superficie del domo
  const d = (a, i) => Math.hypot(a[i * 3], a[i * 3 + 2]) / k - rDe(a[i * 3 + 1] / k), cruces = [];
  // reglas de peluche (sin estados intermedios): un apéndice que se puede guardar (oreja, cuerno, mechón de crin) y
  // asoma menos de ~45% se guarda completo bajo la tela; si asoma más sale por un ojal ovalado arriba de la copa.
  // Un ojal nunca llega al ala: si el cruce de una oreja baja hasta ahí, la oreja se guarda.
  const grupos = new Map();
  mallas.forEach((m, j) => { if (!tipos.includes(m.tipo) && m.tipo !== 'crin') return; const key = m.nodo || j; if (!grupos.has(key)) grupos.set(key, []); grupos.get(key).push(j); });
  const cruzar = (j) => {
    const m = mallas[j], a = loc[j], idx = m.idx, nt = idx ? idx.length : m.n, dd = new Float32Array(m.n), out = [];
    for (let i = 0; i < m.n; i++) dd[i] = d(a, i);
    const arista = (i1, i2) => {
      const d1 = dd[i1], d2 = dd[i2]; if ((d1 > 0) === (d2 > 0) || Math.abs(d1) > 0.4 || Math.abs(d2) > 0.4) return;
      const t = d1 / (d1 - d2), y = (a[i1 * 3 + 1] + (a[i2 * 3 + 1] - a[i1 * 3 + 1]) * t) / k;
      if (y < 0.02 || y > ytop) return;
      out.push(new THREE.Vector3(a[i1 * 3] + (a[i2 * 3] - a[i1 * 3]) * t, a[i1 * 3 + 1] + (a[i2 * 3 + 1] - a[i1 * 3 + 1]) * t, a[i1 * 3 + 2] + (a[i2 * 3 + 2] - a[i1 * 3 + 2]) * t).divideScalar(k));
    };
    for (let t = 0; t + 2 < nt; t += 3) { const i0 = idx ? idx[t] : t, i1 = idx ? idx[t + 1] : t + 1, i2 = idx ? idx[t + 2] : t + 2; arista(i0, i1); arista(i1, i2); arista(i2, i0); }
    return out;
  };
  const yMinOjal = 0.09;
  for (const [key, js] of grupos) {
    let dentro = 0, total = 0;
    for (const j of js) { const a = loc[j], m = mallas[j]; for (let i = 0; i < m.n; i++) { const y = a[i * 3 + 1] / k; if (y < 0) continue; total++; if (y < ytop && d(a, i) < 0) dentro++; } }
    const guardable = typeof key !== 'number';
    if (!total || dentro === 0) continue;                                      // no toca el sombrero
    let pts = js.flatMap(cruzar);
    if (guardable && (dentro / total > 0.55 || pts.some((p) => p.y < yMinOjal))) { key.visible = false; continue; }
    if (mallas[js[0]].tipo === 'crin') { if (pts.length) key.visible = false; continue; }   // mechón que atraviesa la tela: se guarda (sin ojal)
    pts = pts.filter((p) => p.y >= yMinOjal);
    // oreja que cruza la tela muy de lado (ojal enorme, alargado): mejor guardada
    if (guardable && mallas[js[0]].tipo === 'oreja' && pts.length) {
      const b = new THREE.Box3().setFromPoints(pts), sz = b.getSize(new THREE.Vector3());
      if (Math.max(sz.x, sz.y, sz.z) * s0 * k > 0.44) { key.visible = false; continue; }
    }
    cruces.push(...pts.map((p) => Object.assign(p, { grupoBase: key })));
  }
  // las orejas van parejas: si una se guarda, se guardan las dos (salvo sombreros chuecos, como el de fiesta)
  if (simetrico) {
    const orejas = [...grupos.keys()].filter((key) => typeof key !== 'number' && mallas[grupos.get(key)[0]].tipo === 'oreja');
    if (orejas.some((o) => !o.visible)) { orejas.forEach((o) => { o.visible = false; }); for (let i = cruces.length - 1; i >= 0; i--) if (orejas.includes(cruces[i].grupoBase)) cruces.splice(i, 1); }
  }
  if (!cruces.length) return { k, ojales: 0 };
  // agrupar cruces cercanos del mismo apéndice (cada grupo es un ojal)
  const grupo = new Int32Array(cruces.length).fill(-1); let ng = 0;
  for (let i = 0; i < cruces.length; i++) {
    if (grupo[i] >= 0) continue; grupo[i] = ng; const pila = [i];
    while (pila.length) { const q = pila.pop(); for (let j = 0; j < cruces.length; j++) if (grupo[j] < 0 && cruces[j].grupoBase === cruces[q].grupoBase && cruces[j].distanceToSquared(cruces[q]) < 0.01) { grupo[j] = ng; pila.push(j); } }
    ng++;
  }
  const mat = clay(ribete, { roughness: 0.55 }), tl = grueso / (s0 * k), holgura = 0.035 / (s0 * k);
  let ojales = 0;
  for (let gi = 0; gi < ng; gi++) {
    const pts = cruces.filter((_, i) => grupo[i] === gi); if (pts.length < 4) continue;
    const C = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(pts.length);
    const rho = Math.hypot(C.x, C.z) || 1e-6, dr = (rDe(C.y + 0.01) - rDe(C.y - 0.01)) / 0.02;
    const n = new THREE.Vector3(C.x / rho, -dr, C.z / rho).normalize();
    const t1 = new THREE.Vector3().crossVectors(Math.abs(n.y) > 0.95 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0), n).normalize(), t2 = new THREE.Vector3().crossVectors(n, t1);
    // óvalo limpio: ejes principales del contorno, medio ancho y medio alto + holgura (sin ondas ni picos)
    const uv = pts.map((p) => { const u = p.clone().sub(C); return [u.dot(t1), u.dot(t2)]; });
    let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of uv) { sxx += x * x; syy += y * y; sxy += x * y; }
    const fi = 0.5 * Math.atan2(2 * sxy, sxx - syy), e1 = [Math.cos(fi), Math.sin(fi)], e2 = [-Math.sin(fi), Math.cos(fi)];
    const pr = (v, e) => v[0] * e[0] + v[1] * e[1], l1 = uv.map((v) => pr(v, e1)), l2 = uv.map((v) => pr(v, e2));
    const c1 = (Math.max(...l1) + Math.min(...l1)) / 2, c2 = (Math.max(...l2) + Math.min(...l2)) / 2;
    const A = (Math.max(...l1) - Math.min(...l1)) / 2 + holgura + tl * 0.6, B = (Math.max(...l2) - Math.min(...l2)) / 2 + holgura + tl * 0.6;
    const lazo = [];
    for (let b = 0; b < 32; b++) {
      const ang = (b / 32) * Math.PI * 2, x = c1 + Math.cos(ang) * A, y = c2 + Math.sin(ang) * B, X = x * e1[0] + y * e2[0], Y = x * e1[1] + y * e2[1];
      const p = C.clone().addScaledVector(t1, X).addScaledVector(t2, Y);
      const rh = Math.hypot(p.x, p.z), rs = rDe(p.y) + tl * 0.3; if (rh > 1e-4) { p.x *= rs / rh; p.z *= rs / rh; }
      lazo.push(p);
    }
    g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lazo, true), 64, tl, 8, true), mat));
    ojales++;
  }
  return { k, ojales };
}
// patitas de lentes que se van hacia las orejas
function patitas(g, c, col) {
  for (const s of [-1, 1]) g.add(malla(tubo([[s * (c.sep + 0.19), 0.02, -0.02], [s * (c.sep + 0.3), 0.04, -0.25], [s * (c.sep + 0.34), 0.02, -0.55]], 0.018, 12, 6), clay(col)));
}
const _texCache = {};
function texFija(llave, dibujar, tam = 128) {
  if (!_texCache[llave]) { const t = texCanvas(dibujar, tam); t.wrapS = t.wrapT = THREE.RepeatWrapping; TEXTURAS_FIJAS.add(t); _texCache[llave] = t; }
  return _texCache[llave];
}
function copoNieve(col) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) g.add(malla(new THREE.BoxGeometry(0.11, 0.018, 0.012), clay(col), { rot: [0, 0, (i * Math.PI) / 3] }));
  g.add(malla(esf(0.018, 8), clay(col))); return g;
}
function flor(col, r = 0.05) {
  const f = new THREE.Group();
  for (let k = 0; k < 5; k++) { const b = (k / 5) * Math.PI * 2; f.add(malla(esf(r, 12), clay(col), { pos: [Math.cos(b) * r * 1.1, Math.sin(b) * r * 1.1, 0], esc: [1, 1, 0.45] })); }
  f.add(malla(esf(r * 0.6, 10), clay(0xffcf3f), { pos: [0, 0, r * 0.35] })); return f;
}
/* ala de ángel (docs: investigación 7-oct-2026). Anatomía real simplificada: hueso de 3 segmentos (húmero, antebrazo,
   mano) con quiebre en codo y muñeca; primarias en abanico en la mano (las más largas, la 2ª-3ª desde afuera es la
   mayor), secundarias en el antebrazo, terciarias junto al cuerpo, cobertoras mayores encima y una "nube" de
   cobertoras menores en el borde de ataque. Cada pluma es una esfera low-poly deformada a lágrima (volumen cerrado:
   se ve igual de frente y de espalda). Traslape en teja: la pluma más interna queda más hacia el dorso (-Z).
   Degradado lila en la raíz = sombra falsa entre plumas. 1 malla fusionada por segmento. */
const _D = THREE.MathUtils.degToRad, _L = THREE.MathUtils.lerp;
function geoPluma({ largo, ancho, grosor, panza = 0.62, curva = 0.1, asim = 0.15, segR = 6, segL = 6, colRaiz, colPunta, tono = 1 }) {
  let g = new THREE.SphereGeometry(0.5, segR, segL);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const k = Math.log(0.5) / Math.log(panza), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), u = y + 0.5;
    const rc = Math.sqrt(Math.max(0.25 - y * y, 1e-8)), cx = x / rc, cz = z / rc;
    const w = Math.pow(Math.max(Math.sin(Math.PI * Math.pow(u, k)), 0), 0.55);
    const lado = cx < 0 ? 1 - asim : 1 + asim;
    pos.setXYZ(i, cx * 0.5 * ancho * w * lado, u * largo, cz * 0.5 * grosor * w * (1.15 - 0.5 * u) - curva * largo * u * u);
    c.copy(colRaiz).lerp(colPunta, THREE.MathUtils.smoothstep(u, 0.05, 0.7)).multiplyScalar(tono);
    if (cz > 0.3) c.multiplyScalar(0.94);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
let MAT_PLUMA = null;
function matPluma() {
  if (MAT_PLUMA) return MAT_PLUMA;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });
  m.onBeforeCompile = (sh) => {   // borde de luz (rim) por las dos caras: plumón esponjado
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float frP = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
      totalEmissiveRadiance += vec3(0.78, 0.84, 1.0) * frP * 0.35;`);
  };
  m.customProgramCacheKey = () => 'pluma';
  cacheMat.set('pluma', m); MAT_PLUMA = m; return m;
}
function alaAngel(s = {}) {
  const P = Object.assign({
    nPri: 7, nSec: 6, nTer: 3, nCobM: 8, nCobm: 7, nEsc: 2,
    brazo: [0.28, 52], antebrazo: [0.34, 22], mano: [0.34, 40],
    largoPri: [0.55, 0.8, 0.7], largoSec: [0.48, 0.55], largoTer: [0.38, 0.45],
    abanicoPri: [-92, -4], abanicoSec: [-104, -84], abanicoTer: [-160, -138],
    capa: 0.008, roll: -10, colPunta: 0xffffff, colRaiz: 0xcfc6ef,
  }, s);
  const mat = matPluma(), cR = new THREE.Color(P.colRaiz), cP = new THREE.Color(P.colPunta);
  const ala = new THREE.Group(), brazo = new THREE.Group(), codo = new THREE.Group(), muneca = new THREE.Group();
  ala.add(brazo); brazo.add(codo); codo.add(muneca);
  brazo.rotation.z = _D(P.brazo[1]);
  codo.position.x = P.brazo[0]; codo.rotation.z = _D(P.antebrazo[1] - P.brazo[1]);
  muneca.position.x = P.antebrazo[0]; muneca.rotation.z = _D(P.mano[1] - P.antebrazo[1]);
  const lst = { brazo: [], ante: [], mano: [] }, tmp = new THREE.Object3D(); tmp.rotation.order = 'ZYX';
  const pon = (seg, opt, x, y, z, phi, roll = P.roll) => {
    const g = geoPluma({ ...opt, colRaiz: cR, colPunta: cP });
    tmp.position.set(x, y, z); tmp.rotation.set(0, _D(roll), _D(phi - 90)); tmp.updateMatrix();
    g.applyMatrix4(tmp.matrix); lst[seg].push(g);
  };
  const VUELO = { segR: 6, segL: 6, grosor: 0.045 }, COB = { segR: 6, segL: 4 };
  let o = 0;
  for (let i = P.nPri - 1; i >= 0; i--, o++) {   // primarias: abanico en la mano, más juntas hacia la punta
    const q = i / (P.nPri - 1), [a, pk, b] = P.largoPri, largo = q < 0.8 ? _L(a, pk, q / 0.8) : _L(pk, b, (q - 0.8) / 0.2);
    pon('mano', { ...VUELO, largo, ancho: 0.27, panza: 0.68, asim: 0.12 }, P.mano[0] * (0.03 + 0.97 * Math.pow(q, 0.8)), -0.02, -o * P.capa,
      _L(P.abanicoPri[0], P.abanicoPri[1], q));
  }
  for (let i = 0; i < P.nSec; i++, o++) {        // secundarias: de la muñeca al codo
    const q = i / (P.nSec - 1);
    pon('ante', { ...VUELO, largo: _L(P.largoSec[1], P.largoSec[0], q), ancho: 0.27, panza: 0.68, asim: 0.06 }, P.antebrazo[0] * _L(0.97, 0.05, q), -0.02,
      -o * P.capa, _L(P.abanicoSec[1], P.abanicoSec[0], q));
  }
  for (let i = 0; i < P.nTer; i++, o++) {        // terciarias: rellenan el hueco con la espalda
    const q = i / Math.max(P.nTer - 1, 1);
    pon('brazo', { ...VUELO, largo: _L(P.largoTer[1], P.largoTer[0], q), ancho: 0.26, panza: 0.66, asim: 0 }, P.brazo[0] * _L(0.9, 0.3, q), -0.02,
      -o * P.capa, _L(P.abanicoTer[1], P.abanicoTer[0], q));
  }
  const nA = Math.round(P.nCobM * 0.6), nM = P.nCobM - nA;   // cobertoras mayores, capa dorsal
  for (let i = 0; i < nM; i++) { const q = (i + 0.5) / nM;
    pon('mano', { ...COB, largo: 0.3, ancho: 0.22, grosor: 0.06, panza: 0.6 }, P.mano[0] * _L(0.1, 0.75, q), 0, -0.035 - (nM - i) * P.capa * 0.5,
      _L(P.abanicoPri[0], P.abanicoPri[1] - 20, q)); }
  for (let i = 0; i < nA; i++) { const q = (i + 0.5) / nA;
    pon('ante', { ...COB, largo: 0.27, ancho: 0.23, grosor: 0.06, panza: 0.6 }, P.antebrazo[0] * _L(1.0, 0.0, q), 0, -0.035 - (nM + i) * P.capa * 0.5,
      _L(P.abanicoSec[1], P.abanicoSec[0], q)); }
  const Lt = P.brazo[0] + P.antebrazo[0];          // cobertoras menores: la "nube" gruesa del borde de ataque
  for (let i = 0; i < P.nCobm; i++) {
    const d = (i + 0.5) / P.nCobm * Lt, enBrazo = d < P.brazo[0];
    pon(enBrazo ? 'brazo' : 'ante', { ...COB, largo: 0.21, ancho: 0.22, grosor: 0.11, panza: 0.5, curva: 0.05, tono: 1.03 },
      enBrazo ? d : d - P.brazo[0], 0.05, -0.015 - (P.nCobm - i) * 0.002, -85, 0);
  }
  // la nube sigue por la mano hasta la punta y una pluma gordita tapa la muñeca: sin hueco entre abanico y secundarias
  for (let i = 0; i < 4; i++) { const q = (i + 0.3) / 4;
    pon('mano', { ...COB, largo: 0.2 - 0.03 * q, ancho: 0.21 - 0.05 * q, grosor: 0.1, panza: 0.5, curva: 0.05, tono: 1.03 },
      P.mano[0] * 0.75 * q, 0.04, -0.015 - (4 - i) * 0.002, -80 + 20 * q, 0); }
  pon('ante', { ...COB, largo: 0.3, ancho: 0.26, grosor: 0.1, panza: 0.55 }, P.antebrazo[0] * 0.92, 0.0, -0.04, -60, 0);
  pon('mano', { ...COB, largo: 0.3, ancho: 0.24, grosor: 0.08, panza: 0.55 }, 0.03, 0.0, -0.045, -78, 0);
  for (let i = 0; i < P.nEsc; i++) pon('brazo', { ...COB, largo: 0.32, ancho: 0.17, grosor: 0.06 }, P.brazo[0] * (0.05 + 0.2 * i), 0, -0.05, -155, 0);
  pon('mano', { ...COB, largo: 0.17, ancho: 0.07, grosor: 0.035, panza: 0.6 }, 0.02, 0.03, -0.05, 12, 0);   // álula
  const mk = (arr, padre) => { const m = new THREE.Mesh(mergeGeometries(arr), mat); m.castShadow = true; padre.add(m); arr.forEach((g) => g.dispose()); };
  mk(lst.brazo, brazo); mk(lst.ante, codo); mk(lst.mano, muneca);
  ala.userData.seg = { codo, muneca };
  return ala;
}
function alaPlumas(s) {   // grupo animado por el juego > espejo (lado) > barrido hacia atrás 25° > ala
  const g = new THREE.Group(), espejo = new THREE.Group(); espejo.scale.x = s; g.add(espejo);
  const ala = alaAngel(); ala.rotation.set(_D(-10), _D(25), 0); ala.scale.setScalar(1.25); espejo.add(ala);
  return g;
}
function ponerAlas(g, c, crear) {
  for (const s of [-1, 1]) {
    const ala = crear(s), ancla = c.alasAnclas?.[s < 0 ? 0 : 1] || [s * 0.30, c.cuelloY - 0.15, c.espaldaZ + 0.10];
    ala.position.set(...ancla); ala.rotation.y = s * 0.2; ala.name = s < 0 ? 'alaAccesorioI' : 'alaAccesorioD';
    g.add(ala); g.userData[s < 0 ? 'alaI' : 'alaD'] = ala;
  }
  return g;
}
function alaMembrana(s) {  // ala de dragon: membrana festoneada con varillas
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.35, 0.32, 0.72, 0.28);
  sh.quadraticCurveTo(0.6, 0.1, 0.62, -0.04); sh.quadraticCurveTo(0.5, 0.02, 0.42, -0.12); sh.quadraticCurveTo(0.32, -0.02, 0.22, -0.16); sh.quadraticCurveTo(0.14, -0.04, 0, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 10 });
  const ala = new THREE.Group(), m = malla(geo, clay(0xa77bff)); m.scale.x = s; ala.add(m);
  for (const [x, y] of [[0.72, 0.28], [0.62, -0.04], [0.42, -0.12]]) ala.add(malla(tubo([[0, 0, 0.02], [s * x * 0.5, y * 0.6 + 0.08, 0.03], [s * x, y, 0.02]], 0.018, 10, 6), clay(0x7c55d6)));
  return ala;
}
function cohetito(s) {
  const g = new THREE.Group(); g.position.x = s * 0.18;
  g.add(malla(torneado([[0, -0.26], [0.1, -0.24], [0.12, -0.1], [0.12, 0.12], [0.09, 0.22], [0, 0.3]], 24), metal(0xd7dce6)));
  g.add(malla(torneado([[0.122, 0.04], [0.122, 0.12], [0.095, 0.21], [0, 0.29]], 24), clay(0xff6b6b)));
  for (const a of [0, 2.1, 4.2]) g.add(malla(new THREE.BoxGeometry(0.02, 0.12, 0.1), clay(0xff6b6b), { pos: [Math.sin(a) * 0.12, -0.2, Math.cos(a) * 0.12], rot: [0, a, 0] }));
  const fuego = new THREE.Group(); fuego.position.y = -0.27;
  fuego.add(malla(new THREE.ConeGeometry(0.085, 0.3, 16), new THREE.MeshBasicMaterial({ color: 0xff8a2a }), { pos: [0, -0.15, 0], rot: [Math.PI, 0, 0] }));
  fuego.add(malla(new THREE.ConeGeometry(0.05, 0.18, 12), new THREE.MeshBasicMaterial({ color: 0xffe066 }), { pos: [0, -0.1, 0], rot: [Math.PI, 0, 0] }));
  g.add(fuego); return [g, fuego];
}
// V8: mochila en los omóplatos, recargada en la espalda real, con correas que abrazan el cuerpo
function mochilaPegada(c) {
  const G = new THREE.Group(), menta = clay(0x6fdcbc, { roughness: 0.8, sheen: 0.9 }), osc = clay(0x45bf9c), alto = 0.66;
  const g = enEspaldaAlta(c, new THREE.Group(), alto, 0.16); G.add(g);
  g.add(malla(cajaR(0.64, alto, 0.32, 0.16, 4), menta));                                       // V8.2: más acolchada
  g.add(malla(cajaR(0.66, 0.25, 0.34, 0.12, 3), osc, { pos: [0, 0.23, -0.01] }));            // tapa
  g.add(malla(cajaR(0.42, 0.24, 0.11, 0.07, 3), osc, { pos: [0, -0.13, -0.18] }));           // bolsillo
  g.add(malla(cajaR(0.08, 0.06, 0.03, 0.01, 2), metal(0xffcf3f), { pos: [0, 0.12, -0.185] }));
  for (const s of [-1, 1]) g.add(malla(cajaR(0.09, 0.26, 0.2, 0.045, 3), osc, { pos: [s * 0.33, -0.12, -0.02] }));   // bolsas laterales
  g.add(malla(new THREE.TorusGeometry(0.07, 0.02, 6, 16, Math.PI), osc, { pos: [0, alto / 2 + 0.01, 0] }));   // asa
  G.add(correasPegadas(c, c.espaldaAltaY + alto * 0.42, c.espaldaAltaY - alto * 0.38, osc));
  return G;
}
function cohetePegado(c) {
  // V8.2: más arriba (los cohetes arrancan a la altura de los omóplatos y las llamas no tapan la cola)
  const G = new THREE.Group(), alto = 0.5, dy = 0.08;
  const g = enEspaldaAlta(c, new THREE.Group(), alto, 0.16, dy); G.add(g);
  const k = new THREE.Group(); k.scale.setScalar(1.35); g.add(k);
  k.add(malla(cajaR(0.3, 0.38, 0.12, 0.04, 2), clay(0x5a6378), { pos: [0, 0.02, 0.06] }));
  for (const s of [-1, 1]) { const [r, fuego] = cohetito(s); k.add(r); G.userData[s < 0 ? 'fuegoI' : 'fuegoD'] = fuego; }
  G.add(correasPegadas(c, c.espaldaAltaY + dy + alto * 0.4, c.espaldaAltaY + dy - alto * 0.35, clay(0x3f4656), 0.038));
  return G;
}
function capaPegada(c) {
  /* V8.4: capa de peluche que CAE de los hombros con gravedad, mismo largo relativo en todas las mascotas (casi al
     suelo). La piel (cola, aletas, picos incluidos) es un colisionador: la tela pasa POR ENCIMA de todo lo que
     sobresale y se relaja para quedar continua (sin rasgaduras, picos ni cortes). Si una cola larga sale por la parte
     baja de la espalda, el dobladillo sube en esa zona como una carpa suave y la cola sale por debajo. Sin aberturas. */
  const g = new THREE.Group(), roja = clay(0xff5a6a, { side: THREE.FrontSide, roughness: 0.78, sheen: 0.9 }), forro = clay(0xc93a4c, { side: THREE.BackSide, roughness: 0.8, sheen: 0.6 });
  const dobl = clay(0xd9404f);
  const arriba = c.cuelloY - 0.02, alto = arriba - (RIG.suelo + 0.2), NU = 32, NV = 26, ang = (u, v) => u * (1.1 + v * 0.3);
  const muestreo = (yDe) => {
    const R = [];
    for (let j = 0; j <= NV; j++) { const f = []; for (let i = 0; i <= NU; i++) f.push(c.radio(yDe(j, i), ang((i / NU) * 2 - 1, j / NV))); R.push(f); }
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) if (R[j][i] == null) R[j][i] = j ? R[j - 1][i] : (c.cuelloRx ?? c.cuelloR);
    return R;
  };
  // radio del cuerpo sin salientes: por columna, de arriba abajo, un salto brusco hacia afuera no se sigue
  const cuerpoDe = (R) => {
    const B = R.map((f) => f.slice());
    for (let i = 0; i <= NU; i++) for (let j = 1; j <= NV; j++) { const p = B[j - 1][i]; B[j][i] = R[j][i] - p > 0.06 ? p + 0.01 : Math.min(R[j][i], p + 0.06); }
    for (let j = 0; j <= NV; j++) for (let i = 1; i < NU; i++) { const m = Math.max(B[j][i - 1], B[j][i + 1]); if (B[j][i] - m > 0.06) B[j][i] = m; }
    return B;
  };
  // 1) primera pasada a todo lo largo: ¿dónde sale una cola larga por la parte baja? -> ahí sube el dobladillo
  let R = muestreo((j) => arriba - (j / NV) * alto), B = cuerpoDe(R);
  const hem = [];
  for (let i = 0; i <= NU; i++) { let jt = NV; for (let j = Math.ceil(NV * 0.5); j <= NV; j++) if (R[j][i] - B[j][i] > 0.1) { jt = j; break; } hem.push(jt); }
  // arco redondeado (no en V): parábola ancha alrededor de cada columna con cola
  const hemS = hem.map((_, i) => { let m = NV; for (let k = 0; k <= NU; k++) if (hem[k] < NV) { const t = (i - k) / 6.5; m = Math.min(m, hem[k] - 1 + t * t * (NV - hem[k] + 1)); } return Math.min(NV, Math.max(NV * 0.5, m)); });
  for (let it = 0; it < 3; it++) { const h2 = hemS.slice(); for (let i = 1; i < NU; i++) hemS[i] = (h2[i - 1] + 2 * h2[i] + h2[i + 1]) / 4; }
  // 2) rejilla final: cada columna termina en su dobladillo (las filas se reparten hasta ahí)
  const yDe = (j, i) => arriba - (j / NV) * (hemS[i] / NV) * alto;
  R = muestreo(yDe); B = cuerpoDe(R);
  // 3) tela: cuerpo a plomo en la mitad baja (sin bultos de pañal) + colisión con todo lo que sobresale + relajación
  const D = B.map((f) => f.slice());
  for (let it = 0; it < 6; it++) for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const n = [D[j][i], D[j][Math.max(0, i - 1)], D[j][Math.min(NU, i + 1)], D[Math.max(0, j - 1)][i], D[Math.min(NV, j + 1)][i]];
    D[j][i] = Math.max(B[j][i] + 0.035, n.reduce((s, x) => s + x, 0) / n.length);
  }
  for (let j = 1; j <= NV; j++) for (let i = 0; i <= NU; i++) D[j][i] = Math.max(D[j][i], D[j - 1][i] - (j / NV > 0.45 ? 0.004 : 0.03));
  for (let it = 0; it < 14; it++) {   // colisión + relajación: nunca dentro de la piel, sin picos
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) D[j][i] = Math.max(D[j][i], Math.min(R[j][i], B[j][i] + 0.12) + 0.04);
    const E = D.map((f) => f.slice());
    for (let j = 1; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const n = [E[j][Math.max(0, i - 1)], E[j][Math.min(NU, i + 1)], E[j - 1][i], E[Math.min(NV, j + 1)][i]];
      D[j][i] = Math.max(E[j][i], 0.5 * E[j][i] + 0.5 * n.reduce((s, x) => s + x, 0) / 4);
    }
  }
  // colisión final acotada: lo que sobresale más de 0.12 (cola larga) ya quedó bajo el dobladillo alzado
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) D[j][i] = Math.max(D[j][i], Math.min(R[j][i], B[j][i] + 0.12) + 0.04);
  const P = [];
  for (let j = 0; j <= NV; j++) { const fila = []; for (let i = 0; i <= NU; i++) {
    const u = (i / NU) * 2 - 1, v = j / NV, a = ang(u, v), r = D[j][i] + 0.025 + v * v * 0.03 + Math.sin(u * 14) * 0.012 * (0.3 + 0.7 * v);
    fila.push(new THREE.Vector3(Math.sin(a) * r, yDe(j, i), c.zc - Math.cos(a) * r)); } P.push(fila); }
  const pos = [], idx = [], id = (j, i) => j * (NU + 1) + i;
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) pos.push(P[j][i].x, P[j][i].y, P[j][i].z);
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) idx.push(id(j, i), id(j + 1, i), id(j, i + 1), id(j, i + 1), id(j + 1, i), id(j + 1, i + 1));
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  g.add(malla(geo, roja)); g.add(malla(geo, forro));
  g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P[NV]), 96, 0.02, 6), dobl));   // dobladillo
  g.add(malla(new THREE.TorusGeometry(c.cuelloR, 0.04, 8, 40), dobl, { pos: [0, arriba, c.zc], rot: [Math.PI / 2, 0, 0], esc: aroEsc(c, 1) }));
  for (const s of [-1, 1]) g.add(malla(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), metal(0xffcf3f), { pos: [s * 0.1, arriba - 0.02, c.zc + (c.cuelloRz ?? c.cuelloR) + 0.02], rot: [Math.PI / 2, 0, 0] }));
  return g;
}
/* V8.3: Gorra DE que ABRAZA el cráneo. La copa no es un domo fijo: se mide con rayos la piel de cada cabeza (casquete
   en coordenadas esféricas desde el centro de la cabeza) y la tela va a un grosor fijo encima, suavizada. La orilla es un
   corte inclinado (alto al frente, libre de los ojos; bajo en la nuca) con una banda acolchada que toca la piel toda la
   vuelta. Visera al frente, un poco caída, del ancho de la frente. Seis gajos con costura, botón y parche DE.
   Orejas/cuerno/aleta: si apenas asoman se guardan; si asoman mucho salen DERECHAS por un ojal con ribete. */
function lozaGeo(T, grosor, abajo) {   // placa con grosor a partir de una rejilla de puntos de arriba T[a][b]
  const A = T.length, B = T[0].length, pos = [], idx = [], id = (cara, a, b) => cara * A * B + a * B + b;
  for (const cara of [0, 1]) for (let a = 0; a < A; a++) for (let b = 0; b < B; b++) { const p = T[a][b].clone().addScaledVector(abajo, cara * grosor); pos.push(p.x, p.y, p.z); }
  for (let a = 0; a < A - 1; a++) for (let b = 0; b < B - 1; b++) {
    idx.push(id(0, a, b), id(0, a + 1, b), id(0, a, b + 1), id(0, a + 1, b), id(0, a + 1, b + 1), id(0, a, b + 1));
    idx.push(id(1, a, b), id(1, a, b + 1), id(1, a + 1, b), id(1, a + 1, b), id(1, a, b + 1), id(1, a + 1, b + 1));
  }
  const borde = [];
  for (let a = 0; a < A; a++) borde.push([a, 0]);
  for (let b = 1; b < B; b++) borde.push([A - 1, b]);
  for (let a = A - 2; a >= 0; a--) borde.push([a, B - 1]);
  for (let b = B - 2; b >= 0; b--) borde.push([0, b]);
  for (let n = 0; n < borde.length - 1; n++) {
    const [a1, b1] = borde[n], [a2, b2] = borde[n + 1];
    idx.push(id(0, a1, b1), id(1, a1, b1), id(0, a2, b2), id(1, a1, b1), id(1, a2, b2), id(0, a2, b2));
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
function gorraPegada(c) {
  const g = new THREE.Group();
  const az = clay(0x4f8ff0, { side: THREE.DoubleSide, roughness: 0.85, sheen: 0.9 }), osc = clay(0x2f6fd6, { side: THREE.DoubleSide, roughness: 0.85, sheen: 0.8 });
  const C = new THREE.Vector3(0, Math.max(c.ojosY + 0.02, c.cima - 0.5), -0.02), OFF = 0.05;
  const zF = c.ojosZ ?? 0.5, t = 0.3, yB = c.ojosY + 0.3 - t * zF, yCorte = (z) => yB + t * z;
  const NA = 48, NP = 18, dir = (th, ph) => new THREE.Vector3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
  const piel = (d) => { const h = c.cascaron(C.clone().addScaledVector(d, 4).toArray(), d.clone().negate().toArray()); return h ? h.distanceTo(C) : null; };
  // 1) por azimut: dónde corta la orilla y el radio de la piel en cada fila
  const thCut = [], R = [];
  for (let i = 0; i < NA; i++) {
    const ph = (i / NA) * Math.PI * 2; let th = 0.05, ultimo = piel(dir(0, ph)) ?? 0.5;
    for (; th < 2.4; th += 0.04) { const d = dir(th, ph), r = piel(d) ?? ultimo; ultimo = r; const p = C.clone().addScaledVector(d, r); if (p.y < yCorte(p.z)) break; }
    thCut.push(th);
  }
  for (let it = 0; it < 4; it++) { const t2 = thCut.slice(); for (let i = 0; i < NA; i++) thCut[i] = (t2[(i + 1) % NA] + t2[(i + NA - 1) % NA] + 2 * t2[i]) / 4; }
  for (let i = 0; i < NA; i++) {
    const ph = (i / NA) * Math.PI * 2, fila = []; let prev = null;
    for (let k = 0; k <= NP; k++) { const r = piel(dir((k / NP) * thCut[i], ph)); fila.push(r ?? prev ?? 0.5); prev = fila[k]; }
    R.push(fila);
  }
  // 2) picos delgados en azimut (aleta del tiburón) no inflan la tela: se recortan a sus vecinos
  for (let it = 0; it < 2; it++) for (let i = 0; i < NA; i++) for (let k = 1; k <= NP; k++) {
    const vec = Math.max(R[(i + 3) % NA][k], R[(i + NA - 3) % NA][k]); if (R[i][k] - vec > 0.1) R[i][k] = vec;
  }
  // 3) tela: suavizada (sin hundirse en la piel) + grosor fijo
  const S = R.map((f) => f.slice());
  for (let it = 0; it < 5; it++) for (let i = 0; i < NA; i++) for (let k = 0; k <= NP; k++) {
    const m = (S[(i + 1) % NA][k] + S[(i + NA - 1) % NA][k] + S[i][Math.max(0, k - 1)] + S[i][Math.min(NP, k + 1)] + 2 * S[i][k]) / 6;
    S[i][k] = Math.max(R[i][k], m);
  }
  const punto = (i, k, extra = 0) => { const ph = (i / NA) * Math.PI * 2; return C.clone().addScaledVector(dir((k / NP) * thCut[i], ph), S[i][k] + OFF + extra); };
  const pos = [], idx = [];
  for (let i = 0; i < NA; i++) for (let k = 0; k <= NP; k++) { const p = punto(i, k); pos.push(p.x, p.y, p.z); }
  for (let i = 0; i < NA; i++) for (let k = 0; k < NP; k++) { const a = i * (NP + 1) + k, b = ((i + 1) % NA) * (NP + 1) + k; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const copa = new THREE.BufferGeometry(); copa.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); copa.setIndex(idx); copa.computeVertexNormals();
  g.add(malla(copa, az));
  // banda acolchada en la orilla (toca la piel toda la vuelta)
  const banda = []; for (let i = 0; i < NA; i++) banda.push(punto(i, NP, -0.008));
  g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(banda, true), 96, 0.036, 8, true), osc));
  // gajos y botón
  for (let m = 0; m < 6; m++) {
    const i = (m * 8 + 4) % NA, pts = []; for (let k = 0; k < NP; k++) pts.push(punto(i, k, 0.008));
    g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.009, 5), osc));
  }
  g.add(malla(esf(0.055, 14), osc, { pos: punto(0, 0, 0.01).toArray(), esc: [1, 0.6, 1] }));
  // visera: de la banda delantera hacia el frente, un poco caída, del ancho de la frente
  const anchoF = Math.abs(punto(NA / 4, NP).x - punto((3 * NA) / 4, NP).x) / 2, L = 0.4 * THREE.MathUtils.clamp(anchoF / 0.55, 0.8, 1.25);
  const filas = [];
  for (let j = -10; j <= 10; j++) {
    const i = (j + NA) % NA, I = punto(i, NP, 0.012), ph = (j / NA) * Math.PI * 2, larg = L * Math.pow(Math.cos(ph), 0.8) + 0.02;
    const h = new THREE.Vector3(I.x, 0, I.z - C.z).normalize().add(new THREE.Vector3(0, 0, 0.7)).normalize();
    const fila = [];
    for (let q = 0; q <= 5; q++) { const s = q / 5; fila.push(I.clone().addScaledVector(h, larg * s).add(new THREE.Vector3(0, -larg * (0.1 * s + 0.08 * s * s), 0))); }
    filas.push(fila);
  }
  g.add(malla(lozaGeo(filas, 0.03, new THREE.Vector3(0, -1, 0)), osc));
  // parche DE al frente de la copa
  const tex = texFija('logoMN', (x, n) => {
    x.clearRect(0, 0, n, n); x.fillStyle = '#ff8a3d'; x.beginPath(); x.roundRect(n * 0.06, n * 0.2, n * 0.88, n * 0.6, n * 0.16); x.fill();
    x.strokeStyle = '#ffffff'; x.lineWidth = n * 0.035; x.setLineDash([n * 0.05, n * 0.035]); x.beginPath(); x.roundRect(n * 0.11, n * 0.25, n * 0.78, n * 0.5, n * 0.12); x.stroke();
    x.fillStyle = '#ffffff'; x.font = '900 ' + Math.round(n * 0.34) + 'px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('DE', n / 2, n * 0.515);
  }, 256);
  const kp = Math.round(NP * 0.6), Pp = punto(0, kp, 0.012), Pa = punto(0, kp - 1), Pb = punto(0, kp + 1);
  const ladoP = Math.min(0.32, anchoF * 0.55), parche = malla(new THREE.PlaneGeometry(ladoP, ladoP), clay(0xffffff, { map: tex, transparent: true, alphaTest: 0.5, roughness: 0.8 }), { pos: Pp.toArray() });
  const nP = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), Pa.clone().sub(Pb)).normalize(); if (nP.z < 0) nP.negate();
  parche.lookAt(Pp.clone().add(nP)); g.add(parche);
  // 4) orejas, cuerno, crin, aleta: guardar u ojal
  const Sde = (v) => {   // radio de la tela en la dirección de v (s null si está fuera de la copa)
    const d = v.clone().sub(C), r = d.length(); d.divideScalar(r || 1);
    let ph = Math.atan2(d.x, d.z); if (ph < 0) ph += Math.PI * 2;
    const fi = (ph / (Math.PI * 2)) * NA, i0 = Math.floor(fi) % NA, i1 = (i0 + 1) % NA, w = fi - Math.floor(fi);
    const th = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1)), tc = thCut[i0] * (1 - w) + thCut[i1] * w, kf = (th / tc) * NP;
    if (kf > NP) return { r, s: null, kf };
    const k0 = Math.min(NP - 1, Math.floor(kf)), wk = kf - k0, s0 = S[i0][k0] * (1 - wk) + S[i0][k0 + 1] * wk, s1 = S[i1][k0] * (1 - wk) + S[i1][k0 + 1] * wk;
    return { r, s: s0 * (1 - w) + s1 * w + OFF, kf };
  };
  const mallas = c.mallasCabeza?.() || [], grupos = new Map(), V = new THREE.Vector3(), cruces = [];
  mallas.forEach((m, j) => { if (!['oreja', 'cuerno', 'crin', 'cuerpo'].includes(m.tipo)) return; const key = m.nodo || j; if (!grupos.has(key)) grupos.set(key, []); grupos.get(key).push(j); });
  for (const [key, js] of grupos) {
    let dentro = 0, total = 0; const pts = [];
    for (const j of js) {
      const m = mallas[j], a = m.pos, dd = new Float32Array(m.n).fill(NaN);
      for (let i = 0; i < m.n; i++) { V.fromArray(a, i * 3); if (V.y < yCorte(V.z) - 0.02) continue; const q = Sde(V); if (q.s == null) continue; dd[i] = q.r - q.s; total++; if (dd[i] < 0) dentro++; }
      const idx2 = m.idx, nt = idx2 ? idx2.length : m.n;
      const arista = (i1, i2) => {
        const d1 = dd[i1], d2 = dd[i2]; if (isNaN(d1) || isNaN(d2) || (d1 > 0) === (d2 > 0)) return;
        pts.push(new THREE.Vector3().fromArray(a, i1 * 3).lerp(new THREE.Vector3().fromArray(a, i2 * 3), d1 / (d1 - d2)));
      };
      for (let tt = 0; tt + 2 < nt; tt += 3) { const i0 = idx2 ? idx2[tt] : tt, i1 = idx2 ? idx2[tt + 1] : tt + 1, i2 = idx2 ? idx2[tt + 2] : tt + 2; arista(i0, i1); arista(i1, i2); arista(i2, i0); }
    }
    if (!total || !dentro || !pts.length) continue;
    const tipo = mallas[js[0]].tipo, guardable = typeof key !== 'number', bajo = pts.some((p) => Sde(p).kf > NP * 0.82);
    if (guardable && (dentro / total > 0.55 || bajo)) { key.visible = false; continue; }
    if (tipo === 'crin') { key.visible = false; continue; }   // mechón que atraviesa la tela: se guarda
    if (guardable && tipo === 'oreja') { const b = new THREE.Box3().setFromPoints(pts).getSize(new THREE.Vector3()); if (Math.max(b.x, b.y, b.z) > 0.44) { key.visible = false; continue; } }
    cruces.push(...pts.filter((p) => Sde(p).kf <= NP * 0.82).map((p) => Object.assign(p, { grupoBase: key })));
  }
  const orejas = [...grupos.keys()].filter((key) => typeof key !== 'number' && mallas[grupos.get(key)[0]].tipo === 'oreja');
  if (orejas.some((o) => !o.visible)) { orejas.forEach((o) => { o.visible = false; }); for (let i = cruces.length - 1; i >= 0; i--) if (orejas.includes(cruces[i].grupoBase)) cruces.splice(i, 1); }
  // ribetes: un óvalo limpio por grupo de cruces
  const grupo = new Int32Array(cruces.length).fill(-1); let ng = 0;
  for (let i = 0; i < cruces.length; i++) {
    if (grupo[i] >= 0) continue; grupo[i] = ng; const pila = [i];
    while (pila.length) { const q = pila.pop(); for (let j = 0; j < cruces.length; j++) if (grupo[j] < 0 && cruces[j].grupoBase === cruces[q].grupoBase && cruces[j].distanceToSquared(cruces[q]) < 0.01) { grupo[j] = ng; pila.push(j); } }
    ng++;
  }
  for (let gi = 0; gi < ng; gi++) {
    const pts = cruces.filter((_, i) => grupo[i] === gi); if (pts.length < 4) continue;
    const Cc = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(pts.length), n = Cc.clone().sub(C).normalize();
    const t1 = new THREE.Vector3().crossVectors(Math.abs(n.y) > 0.95 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0), n).normalize(), t2 = new THREE.Vector3().crossVectors(n, t1);
    const uv = pts.map((p) => { const u = p.clone().sub(Cc); return [u.dot(t1), u.dot(t2)]; });
    let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of uv) { sxx += x * x; syy += y * y; sxy += x * y; }
    const fi = 0.5 * Math.atan2(2 * sxy, sxx - syy), e1 = [Math.cos(fi), Math.sin(fi)], e2 = [-Math.sin(fi), Math.cos(fi)];
    const l1 = uv.map((v) => v[0] * e1[0] + v[1] * e1[1]), l2 = uv.map((v) => v[0] * e2[0] + v[1] * e2[1]);
    const c1 = (Math.max(...l1) + Math.min(...l1)) / 2, c2 = (Math.max(...l2) + Math.min(...l2)) / 2;
    const A = (Math.max(...l1) - Math.min(...l1)) / 2 + 0.05, B = (Math.max(...l2) - Math.min(...l2)) / 2 + 0.05, lazo = [];
    for (let b = 0; b < 32; b++) {
      const an = (b / 32) * Math.PI * 2, x = c1 + Math.cos(an) * A, y = c2 + Math.sin(an) * B;
      const p = Cc.clone().addScaledVector(t1, x * e1[0] + y * e2[0]).addScaledVector(t2, x * e1[1] + y * e2[1]), q = Sde(p);
      if (q.s != null) p.copy(C).addScaledVector(p.clone().sub(C).normalize(), q.s + 0.01);
      lazo.push(p);
    }
    g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lazo, true), 64, 0.026, 8, true), osc));
  }
  return g;
}
// tubo de grosor variable (r(t), t de 0 a 1) con puntas redondas: bigote, correas que adelgazan
function tuboVar(pts, rDe, seg = 40, rs = 12) {
  const curva = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(curva, seg, 1, rs), p = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    curva.getPointAt(i / seg, c); const r = rDe(i / seg);
    for (let j = 0; j <= rs; j++) { const k = i * (rs + 1) + j; v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c); p.setXYZ(k, v.x, v.y, v.z); }
  }
  geo.computeVertexNormals();
  return { geo, ini: curva.getPointAt(0), fin: curva.getPointAt(1), r0: rDe(0), r1: rDe(1) };
}
// altura del bigote (marco del suelo) donde la boca medida no es la boca de dibujo: debajo de las fosas
const BIGOTE_Y = { capibara: 1.76, unicornio: 1.43, cocodrilo: 1.6, patito: 1.77, tiburon: 1.6, pinguino: 1.6 };
const BIGOTE_COLOR = { xolo: 0xe9e3da };   // piel oscura: bigote canoso para que se lea
// V8: bigote de fieltro (manubrio) que se apoya en la piel del hocico: cada punto se proyecta sobre la cara,
// el ancho sale del hocico medido y las puntas se enroscan hacia arriba sin salirse de la cara
function bigotePegado(c) {
  const g = new THREE.Group(), col = BIGOTE_COLOR[c.especie] ?? 0x3a2418,
    caf = clay(col, { roughness: 0.85, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(col).lerp(new THREE.Color(0xffe0c0), 0.55), clearcoat: 0 });
  const y0 = BIGOTE_Y[c.especie] != null ? BIGOTE_Y[c.especie] + RIG.suelo - RIG.cabeza.y : c.bocaY + 0.08;
  const h0 = c.cara(0, y0);
  if (!h0) return g;
  // medio ancho del hocico: hasta donde la cara se va hacia atrás
  let w = 0.1;
  for (let x = 0.02; x <= 0.42; x += 0.02) { const h = c.cara(x, y0); if (!h || h.z < h0.z - 0.13) break; w = x; }
  const half = THREE.MathUtils.clamp(w * 1.02, 0.2, 0.3), k = half / 0.24, R = 0.064 * Math.sqrt(k);
  const plantilla = [[0, 0], [0.18, -0.035], [0.42, -0.06], [0.68, -0.05], [0.88, -0.005], [0.98, 0.06], [0.93, 0.115]];
  for (const s of [-1, 1]) {
    let ultimo = h0;
    const pts = plantilla.map(([u, v], i) => {
      const x = s * u * half, y = y0 + v * half * 0.95, h = c.cara(x, y) || ultimo; ultimo = h;
      const r = R * (1 - 0.6 * (i / (plantilla.length - 1)));
      return new THREE.Vector3(x, y, h.z).addScaledVector(h.n, r * 0.8 + 0.012);   // encima del pelo
    });
    const t = tuboVar(pts, (q) => R * (1 - 0.62 * Math.pow(q, 1.2)) * (q < 0.08 ? 0.92 + q : 1), 40, 12);
    g.add(malla(t.geo, caf));
    g.add(malla(esf(t.r1, 12), caf, { pos: t.fin.toArray() }));
  }
  g.add(malla(esf(R * 1.12, 16), caf, { pos: [0, y0 + 0.005, h0.z + R * 0.75], esc: [1.25, 0.85, 0.75] }));   // nudo central
  return g;
}
// V8: lentes apoyados en cada ojo (siguen la normal del ojo: en caras con ojos de lado, como capibara o tiburón,
// el armazón se abre), puente que pasa por encima del hocico real y patitas que corren por la piel hasta la sien.
// lente(s) crea la pieza de cada lado mirando a +z; r es su medio ancho (para el puente y las patitas)
function gafasPegadas(c, lente, col, r = 0.2, grueso = 0.022) {
  const g = new THREE.Group(), mat = clay(col, { roughness: 0.35, clearcoat: 0.8 }), N = c.ojoN || [0, 0, 1];
  const Z = new THREE.Vector3(0, 0, 1), lados = {};
  for (const s of [-1, 1]) {
    const n = new THREE.Vector3(s * N[0], N[1] * 0.5, N[2]).normalize(), dir = Z.clone().lerp(n, 0.6).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(Z, dir), centro = new THREE.Vector3(s * c.sep, c.ojosY, c.ojosZ).addScaledVector(n, 0.085);
    const borde = (dx, dy) => new THREE.Vector3(dx, dy, 0).applyQuaternion(q).add(centro);
    // el armazón no se sale de la silueta de la cabeza (ojos muy de lado): se recorre hacia adentro
    const ancho = c.craneo(c.ojosY, s * Math.PI / 2), sobra = ancho ? Math.abs(borde(s * r, 0).x) - (Math.abs(ancho.x) + 0.03) : 0;
    if (sobra > 0) centro.x -= s * sobra;
    const pz = lente(s); pz.position.copy(centro); pz.quaternion.copy(q); g.add(pz);
    lados[s] = { adentro: borde(-s * r * 0.96, 0.03), afuera: borde(s * r * 0.98, 0.03) };
  }
  // puente: arquea sobre la piel del hocico entre los ojos
  const ym = c.ojosY + 0.05, hm = c.cara(0, ym), zm = Math.max(hm ? hm.z + 0.05 : 0, (lados[-1].adentro.z + lados[1].adentro.z) / 2);
  g.add(malla(tubo([lados[-1].adentro.toArray(), [0, ym + 0.02, zm], lados[1].adentro.toArray()], grueso, 16, 6), mat));
  // patitas: del borde de afuera, pegadas a la piel (encima del pelo), hasta perderse en la sien
  for (const s of [-1, 1]) {
    const a0 = lados[s].afuera, y = a0.y, aa = Math.atan2(a0.x, a0.z), pts = [a0];
    for (const [t, off] of [[0.3, 0.05], [0.6, 0.04], [0.85, 0.03], [1, 0.0]]) {
      const a = aa + (s * 1.75 - aa) * t, p = c.craneo(y - 0.02 * t, a, off);
      if (p) pts.push(p);
    }
    if (pts.length > 2) g.add(malla(tubo(pts.map((p) => p.toArray()), grueso * 0.85, 24, 6), mat));
  }
  return g;
}
export const PRENDAS = {
  cabeza: {
    casco(c) { const g = sombreroEn(c, -0.02), am = clay(0xffc93c, { side: THREE.DoubleSide, roughness: 0.4, clearcoat: 0.6 });
      g.add(malla(torneado([[0, 0.42], [0.2, 0.405], [0.36, 0.34], [0.47, 0.23], [0.53, 0.11], [0.55, 0.0]]), am));
      g.add(malla(torneado([[0.54, 0.02], [0.64, -0.01], [0.7, -0.05], [0.66, -0.07], [0.54, -0.03]]), am, { pos: [0, 0, 0.05], esc: [1, 1, 1.12] }));
      g.add(malla(new THREE.TorusGeometry(0.4, 0.035, 10, 36, Math.PI), clay(0xffe17a), { pos: [0, 0.02, 0], rot: [0, Math.PI / 2, 0] }));
      g.add(malla(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 24), clay(0xff8a3d), { pos: [0, 0.22, 0.47], rot: [Math.PI / 2 - 0.65, 0, 0] }));
      return g; },
    gorra(c) { if (c.cascaron) return gorraPegada(c);
      const g = sombreroEn(c, -0.02); g.rotation.y = 0.35; const az = clay(0x5b9cff, { side: THREE.DoubleSide });
      g.add(malla(torneado([[0, 0.34], [0.2, 0.33], [0.38, 0.26], [0.5, 0.14], [0.55, 0.03], [0.55, -0.02]]), az));
      for (const a of [0, Math.PI / 3, -Math.PI / 3]) g.add(malla(new THREE.TorusGeometry(0.34, 0.008, 6, 30, Math.PI), clay(0x3f7fe0), { pos: [0, 0.0, 0], rot: [0, a + Math.PI / 2, 0], esc: [1.55, 1, 1] }));
      g.add(malla(esf(0.05, 12), clay(0xff8a5c), { pos: [0, 0.345, 0] }));
      g.add(malla(esf(1, 32), clay(0x3f7fe0), { pos: [0, 0.0, 0.52], esc: [0.42, 0.035, 0.3], rot: [0.12, 0, 0] }));
      g.add(malla(new THREE.TorusGeometry(0.545, 0.03, 8, 40), clay(0xffffff), { rot: [Math.PI / 2, 0, 0], pos: [0, 0.03, 0] }));
      ajustarDomo(c, g, [[0.55, -0.02], [0.55, 0.03], [0.5, 0.14], [0.38, 0.26], [0.2, 0.33], [0, 0.34]], { ribete: 0xffffff });
      return g; },
    audifonos(c) { const g = new THREE.Group(); g.position.y = c.audifonos ? c.audifonos.y : 0.04;
      const w = c.audifonos ? c.audifonos.w : Math.max(0.84, (c.ancho ?? 0.48) * 1.75);
      g.add(malla(new THREE.TorusGeometry(w, 0.055, 12, 48, Math.PI), clay(0x7c6cff), { esc: [1, 0.95, 1] }));
      g.add(malla(new THREE.TorusGeometry(w - 0.02, 0.03, 8, 40, Math.PI * 0.5), clay(0xb8adff), { rot: [0, 0, Math.PI * 0.25], pos: [0, 0.02, 0] }));
      for (const s of [-1, 1]) { const k = new THREE.Group(); k.position.set(s * w, -0.04, 0); k.rotation.z = Math.PI / 2; g.add(k);
        k.add(malla(new THREE.CylinderGeometry(0.22, 0.24, 0.14, 32), clay(0xff8fb8)));
        k.add(malla(new THREE.TorusGeometry(0.19, 0.06, 12, 32), clay(0xfff0f6), { rot: [Math.PI / 2, 0, 0], pos: [0, s * -0.06, 0] }));
        k.add(malla(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 24), clay(0xffd75e), { pos: [0, s * 0.08, 0] })); }
      return g; },
    chef(c) { const g = sombreroEn(c, 0.0, -0.08), bl = clay(0xffffff, { side: THREE.DoubleSide });
      g.add(malla(torneado([[0.5, -0.02], [0.52, 0.1], [0.52, 0.2]]), bl));
      g.add(malla(torneado([[0.5, 0.18], [0.6, 0.3], [0.64, 0.46], [0.56, 0.6], [0.36, 0.68], [0, 0.68]]), bl));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(malla(esf(0.22, 20), bl, { pos: [Math.sin(a) * 0.38, 0.5, Math.cos(a) * 0.38] })); }
      g.add(malla(new THREE.TorusGeometry(0.52, 0.02, 8, 40), clay(0xe9e3f5), { rot: [Math.PI / 2, 0, 0], pos: [0, 0.12, 0] }));
      ajustarDomo(c, g, [[0.5, -0.02], [0.52, 0.1], [0.52, 0.2], [0.6, 0.3], [0.64, 0.46], [0.56, 0.6], [0.36, 0.68], [0, 0.69]], { ribete: 0xe9e3f5 });
      return g; },
    conejo(c) { const g = sombreroEn(c, -0.06, -0.05), rosa = clay(0xff9ccf), bl = clay(0xffffff);
      g.add(malla(new THREE.TorusGeometry(0.56, 0.04, 10, 36, Math.PI), rosa, { rot: [0, 0, 0], pos: [0, -0.1, 0.05], esc: [1, 0.7, 1] }));
      for (const s of [-1, 1]) { const o = new THREE.Group(); o.position.set(s * 0.24, 0.24, 0.05); o.rotation.z = s * -0.18; g.add(o);
        o.add(malla(new THREE.CapsuleGeometry(0.1, 0.42, 8, 16), bl, { pos: [0, 0.22, 0], esc: [1, 1, 0.6] }));
        o.add(malla(new THREE.CapsuleGeometry(0.055, 0.32, 8, 12), clay(0xffb3c6), { pos: [0, 0.22, 0.045], esc: [1, 1, 0.4] })); }
      g.add(malla(corazonGeo(0.08), clay(0xff6fa5), { pos: [0.28, 0.08, 0.42], esc: [1, 1, 0.6] }));
      return g; },
    flores(c) { const g = sombreroEn(c, -0.04, -0.28);
      g.add(malla(new THREE.TorusGeometry(0.53, 0.03, 8, 48), clay(0x6cbf5a), { rot: [Math.PI / 2, 0, 0] }));
      const col = [0xff9ccf, 0xffd75e, 0xffffff, 0xc3a3ff, 0x8fd8ff];
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, f = flor(col[i % 5], 0.05 + (i % 2) * 0.012);
        f.position.set(Math.sin(a) * 0.54, 0.03, Math.cos(a) * 0.54); f.lookAt(Math.sin(a) * 2, 0.6, Math.cos(a) * 2); g.add(f);
        g.add(malla(esf(1, 10), clay(0x7cc46a), { pos: [Math.sin(a + 0.33) * 0.55, 0.0, Math.cos(a + 0.33) * 0.55], esc: [0.07, 0.025, 0.035], rot: [0, a + 0.33, 0.4] })); }
      return g; },
    fiesta(c) { const g = sombreroEn(c, -0.02, -0.05); g.position.x = 0.16; g.rotation.z = -0.3;
      const tex = texFija('fiesta', (x, n) => { x.fillStyle = '#ff7bb0'; x.fillRect(0, 0, n, n); x.fillStyle = '#ffe066';
        for (let i = -n; i < n * 2; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 14, 0); x.lineTo(i + 14 + n, n); x.lineTo(i + n, n); x.fill(); }
        x.fillStyle = '#8fd8ff'; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc((i * 47) % n, (i * 71) % n, 6, 0, 7); x.fill(); } });
      g.add(malla(new THREE.ConeGeometry(0.28, 0.62, 32, 1, true), clay(0xffffff, { map: tex, side: THREE.DoubleSide }), { pos: [0, 0.31, 0] }));
      g.add(malla(new THREE.TorusGeometry(0.28, 0.035, 8, 32), clay(0x8fd8ff), { rot: [Math.PI / 2, 0, 0] }));
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; g.add(malla(esf(0.05, 10), clay([0xffd75e, 0x8fd8ff, 0xb7a3ec][i % 3]), { pos: [Math.sin(a) * 0.04, 0.66 + Math.cos(a) * 0.04, Math.cos(a) * 0.04] })); }
      g.add(malla(esf(0.07, 14), clay(0xffd75e), { pos: [0, 0.66, 0] }));
      ajustarDomo(c, g, [[0.28, 0], [0.14, 0.31], [0, 0.62]], { ribete: 0x8fd8ff, kmax: 1, simetrico: false });
      return g; },
    bruja(c) { const g = sombreroEn(c, -0.01, -0.1); g.rotation.z = 0.08; const mor = clay(0x6b4ea0, { side: THREE.DoubleSide });
      g.add(malla(deformar(torneado([[0.36, 0.0], [0.6, -0.01], [0.82, 0.03], [0.86, 0.06], [0.8, 0.04], [0.58, 0.02], [0.36, 0.03]], 48), (v) => { v.y += Math.sin(Math.atan2(v.z, v.x) * 5) * 0.02 * Math.min(1, Math.hypot(v.x, v.z) / 0.8); }), mor));
      g.add(malla(deformar(torneado([[0.5, 0.02], [0.42, 0.25], [0.28, 0.5], [0.15, 0.72], [0.02, 0.92], [0, 0.93]], 32), (v) => { const t = Math.max(0, v.y - 0.3); v.x -= t * t * 0.55; v.y -= t * t * 0.18; }), mor));
      g.add(malla(torneado([[0.51, 0.03], [0.475, 0.14]]), clay(0xffa25c, { side: THREE.DoubleSide })));
      const heb = new THREE.Group(); heb.position.set(0, 0.085, 0.5); heb.rotation.x = -0.15; g.add(heb);
      for (const [w, h, x, y] of [[0.16, 0.025, 0, 0.05], [0.16, 0.025, 0, -0.05], [0.025, 0.12, 0.07, 0], [0.025, 0.12, -0.07, 0]]) heb.add(malla(new THREE.BoxGeometry(w, h, 0.02), metal(0xffcf3f), { pos: [x, y, 0] }));
      g.add(malla(estrellaGeo(0.06, 0.028), metal(0xffd75e), { pos: [-0.2, 0.4, 0.33], rot: [-0.3, -0.4, 0] }));
      ajustarDomo(c, g, [[0.5, 0.02], [0.42, 0.25], [0.28, 0.5], [0.12, 0.7], [0, 0.78]], { ribete: 0xffa25c });
      return g; },
    charro(c) { const g = sombreroEn(c, -0.02, -0.16), caf = clay(0x6b4a32, { side: THREE.DoubleSide }), oro = metal(0xffcf3f);
      g.add(malla(torneado([[0.5, 0.0], [0.72, 0.0], [0.9, 0.05], [1.02, 0.17], [1.04, 0.23], [1.0, 0.2], [0.88, 0.09], [0.7, 0.03], [0.5, 0.03]], 56), caf));
      g.add(malla(torneado([[0.52, 0.0], [0.5, 0.24], [0.42, 0.44], [0.26, 0.54], [0.0, 0.5]], 40), caf));
      g.add(malla(new THREE.TorusGeometry(1.03, 0.025, 8, 56), oro, { rot: [Math.PI / 2, 0, 0], pos: [0, 0.22, 0] }));
      g.add(malla(new THREE.TorusGeometry(0.51, 0.035, 8, 40), oro, { rot: [Math.PI / 2, 0, 0], pos: [0, 0.05, 0] }));
      for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; g.add(malla(esf(0.022, 8), oro, { pos: [Math.sin(a) * 0.78, 0.05, Math.cos(a) * 0.78] })); }
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.add(malla(esf(0.03, 8), oro, { pos: [Math.sin(a) * 0.45, 0.3, Math.cos(a) * 0.45] })); }
      ajustarDomo(c, g, [[0.52, 0], [0.5, 0.24], [0.42, 0.44], [0.26, 0.54], [0, 0.55]], { ribete: 0xffcf3f });
      return g; },
    corona(c) { const g = sombreroEn(c, 0.06, -0.08); g.rotation.z = 0.12; const oro = metal(0xffcf3f), r = 0.4;
      g.add(malla(torneado([[r, 0], [r + 0.02, 0.02], [r + 0.02, 0.13], [r, 0.15], [r - 0.02, 0.13], [r - 0.02, 0.02], [r, 0]], 40), oro));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2;
        g.add(malla(new THREE.ConeGeometry(0.075, 0.2, 4), oro, { pos: [Math.sin(a) * r, 0.24, Math.cos(a) * r], rot: [0, a, 0], esc: [1, 1, 0.45] }));
        g.add(malla(esf(0.04, 12), oro, { pos: [Math.sin(a) * r, 0.35, Math.cos(a) * r] }));
        g.add(malla(esf(0.04, 12), brillo([0xff5c8a, 0x3ec3ff, 0x5ad36b][i % 3]), { pos: [Math.sin(a) * (r + 0.02), 0.075, Math.cos(a) * (r + 0.02)], esc: [1, 1, 0.6] })); }
      return g; },
    aureola(c) { const g = new THREE.Group(); g.position.set(0, c.cima + 0.3, -0.04); g.rotation.x = 0.35;
      g.add(malla(new THREE.TorusGeometry(0.36, 0.045, 14, 48), new THREE.MeshBasicMaterial({ color: 0xffe066, toneMapped: false }), { rot: [Math.PI / 2, 0, 0] }));
      g.add(malla(new THREE.TorusGeometry(0.36, 0.09, 8, 48), new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.35, depthWrite: false }), { rot: [Math.PI / 2, 0, 0] }));
      return g; },
  },
  cara: {
    lentes(c) { if (c.cara) return gafasPegadas(c, () => { const l = new THREE.Group(), marco = clay(0x3a3350, { roughness: 0.35, clearcoat: 0.8 });
        l.add(malla(new THREE.TorusGeometry(0.2, 0.03, 12, 36), marco));
        l.add(malla(new THREE.CircleGeometry(0.19, 32), plano(0xcfeaff, { transparent: true, opacity: 0.25 }), { pos: [0, 0, -0.005] })); return l; }, 0x3a3350);
      const g = new THREE.Group(); g.position.set(0, c.ojosY, c.ojosZ + 0.1); const marco = clay(0x3a3350, { roughness: 0.35, clearcoat: 0.8 });
      for (const x of [-c.sep, c.sep]) { g.add(malla(new THREE.TorusGeometry(0.2, 0.03, 12, 36), marco, { pos: [x, 0, 0] }));
        g.add(malla(new THREE.CircleGeometry(0.19, 32), plano(0xcfeaff, { transparent: true, opacity: 0.25 }), { pos: [x, 0, -0.005] })); }
      g.add(malla(tubo([[-c.sep + 0.19, 0.02, 0], [0, 0.07, 0.02], [c.sep - 0.19, 0.02, 0]], 0.022, 12, 6), marco));
      patitas(g, c, 0x3a3350); return g; },
    sol(c) { if (c.cara) return gafasPegadas(c, (s) => { const l = new THREE.Group();
        l.add(malla(esf(1, 32), brillo(0x2b2440), { pos: [0, -0.01, 0], esc: [0.22, 0.17, 0.035], rot: [0, 0, s * -0.08] }));
        l.add(malla(torneado([[0.2, 0], [0.225, 0.02], [0.2, 0.035]], 32), metal(0xffcf3f), { rot: [Math.PI / 2, 0, 0], esc: [1.02, 1, 0.8], pos: [0, -0.01, 0] }));
        l.add(malla(esf(1, 12), plano(0xffffff, { transparent: true, opacity: 0.5 }), { pos: [-0.07, 0.06, 0.03], esc: [0.06, 0.025, 0.01], rot: [0, 0, 0.5] })); return l; }, 0xffcf3f, 0.22);
      const g = new THREE.Group(); g.position.set(0, c.ojosY, c.ojosZ + 0.1); const oro = metal(0xffcf3f);
      for (const s of [-1, 1]) { g.add(malla(esf(1, 32), brillo(0x2b2440), { pos: [s * c.sep, -0.01, 0], esc: [0.22, 0.17, 0.035], rot: [0, s * 0.15, s * -0.08] }));
        g.add(malla(esf(1, 12), plano(0xffffff, { transparent: true, opacity: 0.5 }), { pos: [s * c.sep - 0.07, 0.06, 0.03], esc: [0.06, 0.025, 0.01], rot: [0, 0, 0.5] })); }
      g.add(malla(new THREE.BoxGeometry(c.sep * 2 + 0.4, 0.04, 0.04), oro, { pos: [0, 0.14, 0] }));
      patitas(g, c, 0xffcf3f); return g; },
    corazones(c) { if (c.cara) return gafasPegadas(c, () => { const l = new THREE.Group();
        l.add(malla(corazonGeo(0.2), brillo(0xff5c8a), { esc: [1, 1, 0.35] }));
        l.add(malla(esf(0.03, 8), plano(0xffffff), { pos: [-0.07, 0.07, 0.05] })); return l; }, 0xff5c8a, 0.19, 0.02);
      const g = new THREE.Group(); g.position.set(0, c.ojosY, c.ojosZ + 0.1);
      for (const x of [-c.sep, c.sep]) { g.add(malla(corazonGeo(0.2), brillo(0xff5c8a), { pos: [x, 0, 0], esc: [1, 1, 0.35] }));
        g.add(malla(esf(0.03, 8), plano(0xffffff), { pos: [x - 0.07, 0.07, 0.05] })); }
      g.add(malla(tubo([[-c.sep + 0.18, 0.04, 0], [0, 0.08, 0.02], [c.sep - 0.18, 0.04, 0]], 0.02, 12, 6), clay(0xff5c8a)));
      patitas(g, c, 0xff5c8a); return g; },
    estrellas(c) { if (c.cara) return gafasPegadas(c, () => { const l = new THREE.Group();
        l.add(malla(estrellaGeo(0.24, 0.12), brillo(0xffcf3f), { esc: [1, 1, 0.5] })); return l; }, 0xffb800, 0.17, 0.02);
      const g = new THREE.Group(); g.position.set(0, c.ojosY, c.ojosZ + 0.1);
      for (const x of [-c.sep, c.sep]) g.add(malla(estrellaGeo(0.24, 0.12), brillo(0xffcf3f), { pos: [x, 0, 0], esc: [1, 1, 0.5] }));
      g.add(malla(tubo([[-c.sep + 0.16, 0.03, 0], [0, 0.07, 0.02], [c.sep - 0.16, 0.03, 0]], 0.02, 12, 6), clay(0xffb800)));
      patitas(g, c, 0xffb800); return g; },
    bigote(c) { if (c.cara) return bigotePegado(c);
      const g = new THREE.Group(); g.position.set(0, c.bocaY + 0.1, c.bocaZ + 0.03); const caf = clay(0x5a3e2b);
      for (const s of [-1, 1]) g.add(malla(tubo([[0, 0, 0], [s * 0.07, -0.015, 0.0], [s * 0.15, -0.0, -0.02], [s * 0.2, 0.04, -0.04], [s * 0.18, 0.08, -0.05]], 0.032, 20, 8), caf));
      g.add(malla(esf(0.05, 12), caf, { esc: [1.2, 0.8, 0.8] })); return g; },
  },
  cuello: {
    mono(c) { const g = new THREE.Group(); g.position.set(0, c.pechoY + 0.06, (c.sup ? c.sup(0, c.pechoY + 0.06, 1) ?? c.pechoZ : c.pechoZ) + 0.04); const rosa = clay(0xff7bb0);
      const lazo = new THREE.Shape(); lazo.moveTo(0, 0); lazo.bezierCurveTo(0.08, 0.12, 0.2, 0.13, 0.21, 0.04); lazo.lineTo(0.21, -0.04); lazo.bezierCurveTo(0.2, -0.13, 0.08, -0.12, 0, 0);
      const geo = new THREE.ExtrudeGeometry(lazo, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3, curveSegments: 10 });
      for (const s of [-1, 1]) g.add(malla(geo, rosa, { esc: [s, 1, 1], pos: [0, 0, -0.025] }));
      g.add(malla(esf(0.055, 16), clay(0xff9ccf), { esc: [1, 1.1, 0.8] })); if (c.sup) g.scale.setScalar(1.35); return g; },
    bufanda(c) { const g = new THREE.Group(); g.position.set(0, c.cuelloY, c.cuelloZc ?? 0);
      const tex = texFija('bufanda', (x, n) => { x.fillStyle = '#4f9be8'; x.fillRect(0, 0, n, n); x.fillStyle = '#3d86d6'; for (let i = 0; i < n; i += 16) x.fillRect(i, 0, 7, n); });
      const lana = clay(0xffffff, { map: tex, roughness: 0.9, sheen: 1, sheenRoughness: 0.5, clearcoat: 0 });
      g.add(malla(new THREE.TorusGeometry(c.cuelloR, 0.11, 16, 48), lana, { rot: [Math.PI / 2, 0, 0], esc: aroEsc(c, 1.1) }));
      const cola = new THREE.Group(); cola.position.set(c.cuelloR * 0.42, -0.06, (c.cuelloRz ?? c.pechoZ - c.cuelloR * 0.1) + 0.08); cola.rotation.set(-0.32, 0.15, 0.14); g.add(cola);
      cola.add(malla(cajaR(0.2, 0.44, 0.07, 0.03, 2), lana, { pos: [0, -0.2, 0] }));
      for (let i = 0; i < 5; i++) cola.add(malla(new THREE.CapsuleGeometry(0.014, 0.06, 3, 6), clay(0x3d86d6), { pos: [-0.08 + i * 0.04, -0.45, 0] }));
      const copo = copoNieve(0xffffff); copo.position.set(0, -0.24, 0.04); cola.add(copo);
      return g; },
    collar(c) { const g = new THREE.Group(); g.position.set(0, c.cuelloY, c.cuelloZc ?? 0); const rx = c.cuelloRx ?? c.cuelloR, rz = c.cuelloRz ?? c.cuelloR;
      g.add(malla(new THREE.TorusGeometry(c.cuelloR, 0.045, 10, 48), clay(0xff6fa5, { roughness: 0.4, clearcoat: 0.7 }), { rot: [Math.PI / 2, 0, 0], esc: aroEsc(c, 1.6) }));
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(malla(esf(0.022, 8), metal(0xffffff), { pos: [Math.sin(a) * (rx + 0.04), 0, Math.cos(a) * (rz + 0.04)] })); }
      g.add(malla(new THREE.TorusGeometry(0.035, 0.012, 6, 16), metal(0xffcf3f), { pos: [0, -0.06, rz + 0.05] }));
      g.add(malla(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 6), metal(0xffcf3f), { pos: [0, -0.15, rz + 0.06], rot: [Math.PI / 2, 0, 0] }));
      g.add(malla(corazonGeo(0.035), clay(0xff6fa5), { pos: [0, -0.15, rz + 0.075], esc: [1, 1, 0.4] }));
      return g; },
    panuelo(c) { const g = new THREE.Group(); g.position.set(0, c.cuelloY - 0.02, c.cuelloZc ?? 0); const rz = c.cuelloRz ?? c.cuelloR, rx = c.cuelloRx ?? c.cuelloR;
      const tex = texFija('panuelo', (x, n) => { x.fillStyle = '#e8453c'; x.fillRect(0, 0, n, n); x.strokeStyle = '#ffd75e'; x.lineWidth = 5;
        x.beginPath(); for (let i = 0; i <= 8; i++) x.lineTo(i * n / 8, n * 0.62 + (i % 2 ? 10 : -10)); x.stroke();
        x.fillStyle = '#ffd75e'; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(n * 0.1 + i * n / 6, n * 0.82, 5, 0, 7); x.fill(); }
        x.beginPath(); x.arc(n / 2, n * 0.3, 9, 0, 7); x.fill(); }, 128);
      const tela = clay(0xffffff, { map: tex, roughness: 0.85, sheen: 0.8, clearcoat: 0, side: THREE.DoubleSide });
      g.add(malla(new THREE.TorusGeometry(c.cuelloR, 0.055, 10, 48), clay(0xe8453c, { roughness: 0.85 }), { rot: [Math.PI / 2, 0, 0], esc: aroEsc(c, 1.4) }));
      // triangulo que cae sobre el pecho, curvado sobre el torso
      const sh = new THREE.Shape(); sh.moveTo(-0.34, 0); sh.quadraticCurveTo(0, 0.04, 0.34, 0); sh.quadraticCurveTo(0.08, -0.22, 0, -0.38); sh.quadraticCurveTo(-0.08, -0.22, -0.34, 0);
      const geo = deformar(new THREE.ShapeGeometry(sh, 12), (v) => { v.z = -v.x * v.x * 1.1 + v.y * 0.35; });
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + 0.34) / 0.68, (uv.getY(i) + 0.38) / 0.42);
      // V8: el triángulo baja pegado al pecho real (el pecho sobresale bajo el cuello)
      const zTri = c.sup ? Math.max(rz, (c.sup(0, c.cuelloY - 0.06, 1) ?? 0) - (c.cuelloZc ?? 0) + 0.03) : rz * 0.98;
      g.add(malla(geo, tela, { pos: [0, -0.01, zTri], rot: [c.sup ? -0.62 : -0.25, 0, 0], esc: c.sup ? [1.2, 1.2, 1] : [1, 1, 1] }));
      g.add(malla(esf(0.06, 12), clay(0xe8453c), { pos: [rx * 0.7, 0.0, rz * 0.75], esc: [1, 0.8, 0.8] }));
      return g; },
    corbata(c) { const g = new THREE.Group(); g.position.set(0, c.pechoY + 0.12, c.sup ? (c.sup(0, c.pechoY + 0.02, 1) ?? c.pechoZ) + 0.035 : c.pechoZ - 0.02); g.rotation.x = -0.18;
      const tex = texFija('corbata', (x, n) => { x.fillStyle = '#6a7bff'; x.fillRect(0, 0, n, n); x.strokeStyle = '#ffd75e'; x.lineWidth = 6;
        for (let i = -n; i < n * 2; i += 28) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + n, n); x.stroke(); } });
      const tela = clay(0xffffff, { map: tex, roughness: 0.6 });
      g.add(malla(cajaR(0.11, 0.09, 0.06, 0.02, 2), clay(0x5566e8)));
      const sh = new THREE.Shape(); sh.moveTo(-0.045, 0); sh.lineTo(0.045, 0); sh.lineTo(0.09, -0.3); sh.lineTo(0, -0.38); sh.lineTo(-0.09, -0.3); sh.lineTo(-0.045, 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 3);
      g.add(malla(geo, tela, { pos: [0, -0.04, 0.0] }));
      for (const s of [-1, 1]) g.add(malla(new THREE.ConeGeometry(0.07, 0.14, 3), clay(0xffffff), { pos: [s * 0.08, 0.03, -0.02], rot: [0, 0, s * 2.2], esc: [1, 1, 0.3] }));
      if (c.sup) g.scale.setScalar(1.4);   // V8: mascotas más grandes
      return g; },
  },
  espalda: {
    mochila(c) { if (c.pegar) return mochilaPegada(c);
      const g = new THREE.Group(); g.position.set(0, c.espaldaY + 0.04, c.espaldaZ - 0.1); const menta = clay(0x6fdcbc), osc = clay(0x45bf9c);
      g.add(malla(cajaR(0.56, 0.6, 0.28, 0.12, 3), menta));
      g.add(malla(cajaR(0.58, 0.24, 0.3, 0.1, 3), osc, { pos: [0, 0.2, -0.01] }));
      g.add(malla(cajaR(0.38, 0.22, 0.1, 0.06, 3), osc, { pos: [0, -0.12, -0.16] }));
      g.add(malla(cajaR(0.08, 0.06, 0.03, 0.01, 2), metal(0xffcf3f), { pos: [0, 0.1, -0.165] }));
      g.add(malla(new THREE.TorusGeometry(0.06, 0.018, 6, 16, Math.PI), osc, { pos: [0, 0.32, 0] }));
      if (c.sup) {   // V8: correas sobre la superficie real, del hombro al pecho
        for (const s of [-1, 1]) {
          const pts = [];
          for (let k = 0; k <= 6; k++) { const yy = c.cuelloY + 0.02 - k * 0.09, zz = c.sup(s * 0.27, yy, 1); if (zz != null) pts.push([s * 0.27, yy - g.position.y, zz + 0.03 - g.position.z]); }
          if (pts.length > 2) g.add(malla(tubo(pts, 0.05, 24, 8), osc));
          g.add(malla(cajaR(0.09, 0.05, 0.03, 0.01, 2), metal(0xffcf3f), { pos: pts[pts.length - 1] || [0, 0, 0] }));
        }
      } else for (const s of [-1, 1]) g.add(malla(tubo([[s * 0.16, 0.22, 0.14], [s * 0.24, 0.38, 0.4], [s * 0.26, 0.24, 0.78], [s * 0.24, -0.1, 0.88]], 0.035, 20, 6), osc));
      return g; },
    capa(c) { if (c.radio) return capaPegada(c);
      const g = new THREE.Group(); g.position.set(0, c.cuelloY - 0.02, 0); const roja = clay(0xff5a6a, { side: THREE.DoubleSide, roughness: 0.75, sheen: 0.8 });
      // tela: arco detras del cuerpo que se abre hacia abajo con pliegues
      const geo = new THREE.PlaneGeometry(1, 1, 24, 12), p = geo.attributes.position, alto = 0.98 + c.cuelloY;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) * 2, v = 0.5 - p.getY(i), a = u * (1.15 + v * 0.35), r = c.cuelloR + 0.04 + v * 0.3 + Math.sin(u * 9) * 0.025 * v;
        p.setXYZ(i, Math.sin(a) * r, -v * alto, -Math.cos(a) * r);
      }
      geo.computeVertexNormals(); g.add(malla(geo, roja));
      g.add(malla(new THREE.TorusGeometry(c.cuelloR + 0.03, 0.04, 8, 40), clay(0xd9404f), { rot: [Math.PI / 2, 0, 0] }));
      for (const s of [-1, 1]) g.add(malla(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), metal(0xffcf3f), { pos: [s * 0.08, -0.02, c.cuelloR + 0.04], rot: [Math.PI / 2, 0, 0] }));
      return g; },
    alas(c) { return ponerAlas(new THREE.Group(), c, alaPlumas); },
    dragon(c) { const g = ponerAlas(new THREE.Group(), c, (s) => { const ala = alaMembrana(s); ala.scale.setScalar(1.3); return ala; });
      for (let i = 0; i < 3; i++) g.add(malla(new THREE.ConeGeometry(0.05, 0.12, 4), clay(0x7c55d6), { pos: [0, c.cuelloY - 0.03 - i * 0.16, c.espaldaZ], rot: [-0.5, 0, 0] }));
      return g; },
    cohete(c) { if (c.pegar) return cohetePegado(c);
      const g = new THREE.Group(); g.position.set(0, c.espaldaY + 0.04, c.espaldaZ - 0.12);
      g.add(malla(cajaR(0.26, 0.34, 0.1, 0.04, 2), clay(0x5a6378), { pos: [0, 0.02, 0.06] }));
      for (const s of [-1, 1]) { const [r, fuego] = cohetito(s); g.add(r); g.userData[s < 0 ? 'fuegoI' : 'fuegoD'] = fuego; }
      return g; },
  },
};
// compatibilidad con el antiguo campo "accesorio"
const ACC_A_SLOT = { casco: 'cabeza', gorra: 'cabeza', corona: 'cabeza', audifonos: 'cabeza', lentes: 'cara', mono: 'cuello', bufanda: 'cuello' };

/* ============================================================ accesorios nuevos (oct-2026, edición Halloween)
   Ayudas propias (sufijo N) para que cada prenda se mida contra la cabeza/cuerpo REAL de cada especie.
   perfilCabezaN: perfil horizontal del cráneo en el marco de la cabeza, medido con c.radio (solo la malla del
   cuerpo: sin orejas ni copetes). R(yh, al): distancia al eje (0, zc) a la altura yh, ángulo al (0 = frente, +x a la
   derecha). Sin medidas (miniatura de la tienda) usa una esfera del RIG. */
const _perfilN = new Map();
function perfilCabezaN(c) {
  if (c._perfilN) return c._perfilN;
  if (c.especie && c.radio && _perfilN.has(c.especie)) return (c._perfilN = _perfilN.get(c.especie));
  const Y0 = RIG.cabeza.y, zc = c.zc ?? 0, NA = 40, PASO = 0.025, y0 = -0.45, cima = (c.cima ?? RIG.cabeza.cima) + 0.3;
  const tabla = [];
  for (let yh = y0; yh <= cima; yh += PASO) {
    const fila = [];
    for (let i = 0; i < NA; i++) {
      const al = (i / NA) * Math.PI * 2;
      let r = c.radio ? c.radio(yh + Y0, Math.PI - al) : null;
      if (!c.radio) { const R0 = RIG.cabeza.r * 0.98, k = R0 * R0 - yh * yh; r = k > 0 ? Math.sqrt(k) : null; }
      fila.push(r ?? 0);
    }
    tabla.push(fila);
  }
  const R = (yh, al) => {
    const fy = (yh - y0) / PASO; if (fy < 0 || fy > tabla.length - 1) return 0;
    const j = Math.max(0, Math.min(tabla.length - 2, Math.floor(fy))), ty = Math.max(0, Math.min(1, fy - j));
    let fa = ((al / (Math.PI * 2)) % 1 + 1) % 1 * NA; const i = Math.floor(fa) % NA, i2 = (i + 1) % NA, ta = fa - Math.floor(fa);
    const v = (jj) => tabla[jj][i] * (1 - ta) + tabla[jj][i2] * ta;
    return v(j) * (1 - ty) + v(j + 1) * ty;
  };
  const P = (yh, al, off = 0) => { const r = R(yh, al) + off; return new THREE.Vector3(Math.sin(al) * r, yh, zc + Math.cos(al) * r); };
  const cimaReal = (() => { let m = -1; for (let j = 0; j < tabla.length; j++) if (Math.max(...tabla[j]) > 0.02) m = y0 + j * PASO; return m; })();
  const pf = { R, P, zc, cima: cimaReal };
  if (c.especie && c.radio) _perfilN.set(c.especie, pf);
  return (c._perfilN = pf);
}
// punto de la cara (marco de la cabeza) con su normal; sin medidas: esfera del RIG
function caraN(c, x, y) {
  if (c.cara) { const h = c.cara(x, y); if (h) return { p: new THREE.Vector3(h.x, h.y, h.z), n: h.n.clone().normalize() }; return null; }
  const R0 = RIG.cabeza.r * 0.95, k = R0 * R0 - x * x - y * y; if (k <= 0) return null;
  const p = new THREE.Vector3(x, y, Math.sqrt(k)); return { p, n: p.clone().normalize() };
}
// rayo contra el perfil del cráneo: de lejos hacia o por la dirección -d; devuelve el primer punto de piel
function rayoCabezaN(pf, o, d, lejos = 1.6) {
  const p = new THREE.Vector3();
  for (let t = lejos; t >= 0; t -= 0.008) {
    p.copy(o).addScaledVector(d, t);
    const al = Math.atan2(p.x, p.z - pf.zc);
    if (pf.R(p.y, al) >= Math.hypot(p.x, p.z - pf.zc)) return p.clone();
  }
  return null;
}
// tubo por puntos (Vector3)
const tuboN = (pts, r, seg = 48, rs = 10) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, rs);
// malla de rejilla NU x NV a partir de una función (i, j) -> [x, y, z]
function rejillaN(NU, NV, f) {
  const pos = [], idx = [];
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) pos.push(...f(i, j));
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + NU + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

// techo de la cabeza visto desde arriba (incluye cuernos, aletas y crestas de la malla de la cabeza; sin orejas).
// ext(yh, al): cuánto hay que separarse del eje para cubrir lo que sobresale a esa altura, con bulto suavizado
// (baja en ángulo y sigue un poco arriba de la punta: una aleta queda como bulto redondo, no como caja)
const _techoN = new Map();
function techoCabezaN(c) {
  if (c._techoN) return c._techoN;
  if (c.especie && _techoN.has(c.especie)) return (c._techoN = _techoN.get(c.especie));
  const pf = perfilCabezaN(c), NA = 48, Y0 = -0.2, PASO = 0.03, NY = 48, raw = [], celdas = [];
  for (let j = 0; j < NY; j++) raw.push(new Float32Array(NA));
  if (c.cara) for (let x = -0.96; x <= 0.961; x += 0.06) for (let z = -1.02; z <= 1.021; z += 0.06) {
    const d = Math.hypot(x, z - pf.zc); if (d > 1.05) continue;
    const dy = 40, h = c.cara(x, 0.6 - dy * z, dy);
    if (!h) continue;
    const b = ((Math.round((Math.atan2(x, z - pf.zc) / (Math.PI * 2)) * NA) % NA) + NA) % NA;
    celdas.push([x, z, h.y]);
    for (let j = 0; j < NY && Y0 + j * PASO <= h.y; j++) if (d > raw[j][b]) raw[j][b] = d;
  }
  const S = raw.map(() => new Float32Array(NA));
  for (let j = 0; j < NY; j++) for (let b = 0; b < NA; b++) {
    let m = 0;
    for (let jj = 0; jj <= j; jj++) for (let bb = 0; bb < NA; bb++) {
      if (!raw[jj][bb]) continue;
      let da = Math.abs(bb - b); da = Math.min(da, NA - da) * (Math.PI * 2 / NA);
      const v = raw[jj][bb] - 0.35 * da - 1.4 * (j - jj) * PASO; if (v > m) m = v;
    }
    S[j][b] = m;
  }
  const ext = (yh, al) => {
    const fy = (yh - Y0) / PASO; if (fy < 0) return S[0][0] * 0; const j = Math.min(NY - 2, Math.floor(fy)), ty = Math.min(1, fy - j);
    const fa = ((al / (Math.PI * 2)) % 1 + 1) % 1 * NA, b = Math.floor(fa) % NA, b2 = (b + 1) % NA, ta = fa - Math.floor(fa);
    const v = (jj) => S[jj][b] * (1 - ta) + S[jj][b2] * ta;
    return v(j) * (1 - ty) + v(j + 1) * ty;
  };
  const t = { ext, celdas };
  if (c.especie && c.cara) _techoN.set(c.especie, t);
  return (c._techoN = t);
}
// holgura: radio mínimo (al eje de la cabeza) que debe tener una prenda que cubre la cabeza a la altura yh y ángulo al,
// juntando cráneo, cuernos/aletas/crestas y suavizando (un bulto delgado no hace escalón ni caja)
// especies cuya aleta/protuberancia grande sale por un agujerito del gorro (no se envuelve)
const SALE_POR_HOYO_N = new Set(['tiburon', 'plomeria', 'unicornio', 'ajolote']);   // aleta, punta, cuerno, branquias
const _holguraN = new Map();
function holguraN(c) {
  if (c._holguraN) return c._holguraN;
  if (c.especie && c.cara && _holguraN.has(c.especie)) return (c._holguraN = _holguraN.get(c.especie));
  const pf = perfilCabezaN(c), te = techoCabezaN(c), NA = 48, Y0 = -0.3, PASO = 0.03, NY = 50, raw = [], S = [];
  for (let j = 0; j < NY; j++) { const f = new Float32Array(NA); for (let b = 0; b < NA; b++) { const al = (b / NA) * Math.PI * 2, yh = Y0 + j * PASO; if (SALE_POR_HOYO_N.has(c.especie)) {   // mediana angular: quita lo delgado (aleta, punta de gota) y deja el cráneo
        const m = []; for (let k = -4; k <= 4; k++) m.push(pf.R(yh, al + k * 0.13)); m.sort((x, y) => x - y); f[b] = m[4];
      } else f[b] = Math.max(pf.R(yh, al), te.ext(yh, al)); } raw.push(f); }
  for (let j = 0; j < NY; j++) { const f = new Float32Array(NA); for (let b = 0; b < NA; b++) { let m = 0;
    for (let jj = Math.max(0, j - 6); jj <= Math.min(NY - 1, j + 6); jj++) for (let bb = 0; bb < NA; bb++) { if (!raw[jj][bb]) continue;
      let da = Math.abs(bb - b); da = Math.min(da, NA - da) * (Math.PI * 2 / NA);
      const v = raw[jj][bb] - 0.3 * da * da * 2 - 1.2 * Math.max(0, j - jj) * PASO - 3 * Math.max(0, jj - j) * PASO * 0; if (v > m) m = v; }
    f[b] = m; } S.push(f); }
  const R = (yh, al) => {
    const fy = (yh - Y0) / PASO; if (fy < 0 || fy > NY - 1) return 0; const j = Math.min(NY - 2, Math.floor(fy)), ty = fy - j;
    const fa = ((al / (Math.PI * 2)) % 1 + 1) % 1 * NA, b = Math.floor(fa) % NA, b2 = (b + 1) % NA, ta = fa - Math.floor(fa);
    const v = (jj) => S[jj][b] * (1 - ta) + S[jj][b2] * ta;
    return v(j) * (1 - ty) + v(j + 1) * ty;
  };
  const h = { R };
  if (c.especie && c.cara) _holguraN.set(c.especie, h);
  return (c._holguraN = h);
}
// agujerito con orilla donde una aleta/cuerno atraviesa una prenda cerrada. fuera(p) = distancia con signo a la
// superficie de la prenda (+ afuera); y0..y1 alturas que cubre la prenda. Agrupa los cruces y pone un aro en cada uno.
function arosSalidaN(g, c, fuera, y0, y1, mat) {
  const te = techoCabezaN(c), pts = [];
  for (const [x, z, top] of te.celdas || []) for (let y = y0; y <= Math.min(top, y1); y += 0.02) { const q = new THREE.Vector3(x, y, z); if (Math.abs(fuera(q)) < 0.03) pts.push(q); }
  const grupos = [];
  for (const q of pts) { const gr = grupos.find((G) => G.c.distanceTo(q) < 0.22); if (gr) { gr.p.push(q); gr.c.multiplyScalar(gr.p.length - 1).add(q).divideScalar(gr.p.length); } else grupos.push({ c: q.clone(), p: [q] }); }
  for (const G of grupos) {
    if (G.p.length < 3) continue;
    const zc = perfilCabezaN(c).zc, al = Math.atan2(G.c.x, G.c.z - zc), n = new THREE.Vector3(Math.sin(al), 0, Math.cos(al));
    const u = new THREE.Vector3(Math.cos(al), 0, -Math.sin(al)); let ru = 0.03, rv = 0.03, ymin = 9, ymax = -9;
    for (const q of G.p) { ru = Math.max(ru, Math.abs(q.clone().sub(G.c).dot(u))); ymin = Math.min(ymin, q.y); ymax = Math.max(ymax, q.y); }
    rv = Math.max(rv, (ymax - ymin) / 2); const cen = G.c.clone(); cen.y = (ymin + ymax) / 2;
    const aro = malla(new THREE.TorusGeometry(ru + 0.05, 0.035, 10, 28), mat, { esc: [1, (rv + 0.05) / (ru + 0.05), 1] });
    pegar(g, aro, cen.addScaledVector(n, 0.01), n);
  }
}
/* ---------- HALLOWEEN 2026 */
// calabaza: calabacita hueca puesta como gorro; cada gajo se separa del cráneo medido (no lo atraviesa)
function calabazaN(c) {
  const g = new THREE.Group(), pf = perfilCabezaN(c), ho = holguraN(c);
  // asentado en lo ancho del cráneo (justo arriba de los ojos) y achatadito: calabacita, no gorro de chef
  const yRim = Math.max((c.asiento ?? RIG.cabeza.cima - 0.15) - 0.2, (c.ojosY ?? RIG.ojos.y) + 0.22), H = 0.56 * Math.max(1, (c.ancho ?? 0.48) / 0.52);
  const NU = 64, NV = 22, r0 = [];
  for (let i = 0; i <= NU; i++) r0.push(pf.R(yRim, (i / NU) * Math.PI * 2) + 0.07);
  const rMed = r0.reduce((a, b) => a + b, 0) / r0.length;
  const radioAl = (al, v) => {
    const yh = yRim + v * H, fi = ((al / (Math.PI * 2)) % 1 + 1) % 1 * NU, i0 = Math.floor(fi), r0i = r0[i0] + (r0[i0 + 1] - r0[i0]) * (fi - i0);
    const base = THREE.MathUtils.lerp(r0i, rMed, Math.min(1, v * 2.2));
    let r = base * (1 + 0.2 * Math.sin(Math.PI * Math.min(1, v * 1.1))) * Math.pow(Math.max(0, 1 - Math.pow(v, 2.6)), 0.55);
    r *= 1 + 0.055 * Math.cos(al * 8) * Math.sin(Math.PI * v);   // gajos
    const piel = ho.R(yh, al); if (piel > 0) r = Math.max(r, piel + 0.07);
    return r;
  };
  const radio = (i, v) => radioAl((i / NU) * Math.PI * 2, v);
  const alt = (v) => yRim + v * H - 0.06 * Math.pow(Math.max(0, v - 0.85) / 0.15, 2);
  const punto = (i, v) => { const al = (i / NU) * Math.PI * 2, r = radio(i % NU, v); return [Math.sin(al) * r, alt(v), pf.zc + Math.cos(al) * r]; };
  g.add(malla(rejillaN(NU, NV, (i, j) => punto(i, j / NV)), clay(0xff9636, { roughness: 0.55, clearcoat: 0.35, sheen: 0.3, side: THREE.DoubleSide })));
  const borde = []; for (let i = 0; i < NU; i++) borde.push(new THREE.Vector3(...punto(i, 0)));
  g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(borde, true), 96, 0.035, 8, true), clay(0xf07f22, { roughness: 0.6 })));
  // carita amigable al frente
  // carita discreta en la parte alta (naranja oscuro, no compite con la cara de la mascota)
  const cafe = clay(0xb5501e, { roughness: 0.6, sheen: 0 });
  const enSup = (al, v, m, salir = 0.008) => { const i = Math.round((((al / (Math.PI * 2)) % 1 + 1) % 1) * NU) % NU, p = new THREE.Vector3(...punto(i, v));
    const n = new THREE.Vector3(Math.sin(al), 0.35, Math.cos(al)).normalize(); p.addScaledVector(n, salir); pegar(g, m, p, n); return m; };
  const ojoSh = new THREE.Shape(); ojoSh.moveTo(0, 0.07); ojoSh.quadraticCurveTo(0.07, -0.01, 0.045, -0.045); ojoSh.quadraticCurveTo(0, -0.07, -0.045, -0.045); ojoSh.quadraticCurveTo(-0.07, -0.01, 0, 0.07);
  const ext = { depth: 0.01, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 10 };
  for (const s of [-1, 1]) enSup(s * 0.3, 0.55, malla(new THREE.ExtrudeGeometry(ojoSh, ext), cafe, { esc: [1.05, 1.05, 1] }));
  const son = new THREE.Shape(); son.moveTo(-0.15, 0.02); son.quadraticCurveTo(0, -0.12, 0.15, 0.02); son.quadraticCurveTo(0, -0.05, -0.15, 0.02);
  enSup(0, 0.38, malla(new THREE.ExtrudeGeometry(son, ext), cafe, { esc: [1.0, 1.0, 1] }));
  // tallo, hojita y zarcillo
  const top = new THREE.Vector3(0, alt(1) - 0.02, pf.zc), verde = clay(0x6b8f3a, { roughness: 0.7 });
  g.add(malla(tuboVar([top.clone(), top.clone().add(new THREE.Vector3(0, 0.1, 0)), top.clone().add(new THREE.Vector3(0.06, 0.17, -0.02))], (q) => 0.05 * (1 - 0.35 * q), 16, 10).geo, clay(0x7a5a2e, { roughness: 0.8 })));
  g.add(malla(hojaGeo(0.26, 0.13), verde, { pos: [top.x - 0.02, top.y + 0.04, top.z], rot: [-0.3, 0.6, 1.25] }));
  const zar = []; for (let k = 0; k <= 30; k++) { const t = k / 30, a = t * Math.PI * 3.2; zar.push(new THREE.Vector3(top.x + 0.06 + t * 0.16 + Math.cos(a) * 0.045, top.y + 0.05 + Math.sin(a) * 0.045, top.z + 0.05)); }
  g.add(malla(tuboN(zar, 0.016, 60, 6), verde));
  if (SALE_POR_HOYO_N.has(c.especie)) arosSalidaN(g, c, (p) => { const v = (p.y - yRim) / H; if (v < 0 || v > 1) return 9;
    return Math.hypot(p.x, p.z - pf.zc) - radioAl(Math.atan2(p.x, p.z - pf.zc), v); }, yRim, yRim + H, clay(0xf07f22, { roughness: 0.6 }));
  // orejas: la que apenas asoma queda tapada; la que sale mucho sale DERECHA por un ojal con orilla (no se doblan)
  const fuera = (p) => { const v = (p.y - yRim) / H; if (v < 0.03 || v > 1) return 9; return Math.hypot(p.x, p.z - pf.zc) - radioAl(Math.atan2(p.x, p.z - pf.zc), v); };
  orejasOjalN(g, fuera, clay(0xf07f22, { roughness: 0.6 }));
  return g;
}
PRENDAS.cabeza.calabaza = calabazaN;

// cuernitos de diablito: diadema que abraza la cabeza (por delante de las orejas) con dos cuernitos de peluche
// cráneo "liso": mediana angular del perfil (quita aletas, puntas de gota y crestas delgadas)
function cranioLisoN(pf) {
  if (pf._liso) return pf._liso;
  const R = (y, al) => { const m = []; for (let k = -3; k <= 3; k++) m.push(pf.R(y, al + k * 0.14)); m.sort((a, b) => a - b); return m[3]; };
  return (pf._liso = { R, zc: pf.zc });
}
function cuernitosN(c) {
  const g = new THREE.Group(), pf = perfilCabezaN(c), liso = cranioLisoN(pf);
  const rojo = clay(0xff4a5e, { roughness: 0.8, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xffb0bc), clearcoat: 0 }), negro = clay(0x3a2e4a, { roughness: 0.75, sheen: 0.8, clearcoat: 0 });
  const C = new THREE.Vector3(0, (c.ojosY ?? 0) + 0.05, pf.zc + 0.06), fi = 0.42;
  const dir = (t) => new THREE.Vector3(Math.sin(t), Math.cos(t) * Math.cos(fi), Math.cos(t) * Math.sin(fi)).normalize();
  // diadema gordita (0.05) pegada al cráneo liso; donde cruza una aleta o cresta se corta en dos mitades con punta redonda
  const tramos = [[]];
  for (let k = 0; k <= 40; k++) { const t = -1.3 + (k / 40) * 2.6, d = dir(t), h = rayoCabezaN(liso, C, d); if (!h) continue;
    const al = Math.atan2(h.x, h.z - pf.zc), sobra = pf.R(h.y, al) - liso.R(h.y, al) > 0.07;
    if (sobra) { if (tramos[tramos.length - 1].length) tramos.push([]); continue; }
    tramos[tramos.length - 1].push(h.addScaledVector(d, 0.06)); }
  for (const tr of tramos) if (tr.length > 3) { g.add(malla(tuboN(tr, 0.05, tr.length * 3, 12), negro)); for (const q of [tr[0], tr[tr.length - 1]]) g.add(malla(esf(0.05, 14), negro, { pos: q.toArray() })); }
  const tC = c.especie === 'unicornio' ? 0.62 : 0.46;   // el unicornio ya trae cuerno al centro: los cuernitos van más abiertos
  for (const s of [-1, 1]) {
    const t = s * tC, h = rayoCabezaN(liso, C, dir(t)); if (!h) continue;
    const n = dir(t), cuerno = new THREE.Group();
    // cuernito de fieltro: base gordita en la diadema, sube y la punta (redonda) se curva hacia ADENTRO y ARRIBA (como 😈)
    const eje = [new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0, 0.07, 0), new THREE.Vector3(-s * 0.02, 0.14, 0), new THREE.Vector3(-s * 0.06, 0.19, 0)];
    const tv = tuboVar(eje, (q) => 0.088 * Math.pow(1 - q, 0.85) + 0.02, 28, 16);
    cuerno.add(malla(tv.geo, rojo)); cuerno.add(malla(esf(0.09, 18), rojo, { pos: [0, -0.02, 0], esc: [1, 0.55, 1] })); cuerno.add(malla(esf(tv.r1, 10), rojo, { pos: tv.fin.toArray() }));
    cuerno.position.copy(h).addScaledVector(n, 0.07);
    cuerno.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().lerp(new THREE.Vector3(0, 1, 0), 0.75).normalize());
    g.add(cuerno);
  }
  return g;
}
PRENDAS.cabeza.cuernitos = cuernitosN;

// colmillos de vampiro: dos colmillitos que asoman de la boca y siguen la piel del hocico
// por especie: dx separación, dy ajuste de altura, off cuánto salen de la piel (unicornio: hocico con pelo; xolo: lengua al
// centro; patito: bajo el pico, no en la punta; pingüino: más juntos y con contorno para que se lean sobre la cara blanca)
const COLMILLO_N = { tiburon: { dx: 0.17 }, capibara: { dx: 0.08 }, patito: { dx: 0.09, dy: -0.06, atras: 0.07 }, cocodrilo: { dx: 0.14 },
  unicornio: { dx: 0.1, dy: -0.07, off: 0.07 }, xolo: { dx: 0.11 }, pinguino: { dx: 0.06, contorno: true }, ferreteria: { dx: 0.06 }, plomeria: { dx: 0.07 } };
function colmillosN(c) {
  const g = new THREE.Group(), bl = clay(0xf4f1e8, { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0 }), osc = clay(0x3a2e4a, { roughness: 0.6 });
  const A = COLMILLO_N[c.especie] || {}, dx = A.dx ?? 0.08, y = (c.bocaY ?? RIG.boca.y) - 0.02 + (A.dy ?? 0);
  for (const s of [-1, 1]) {
    const h = caraN(c, s * dx, y) || { p: new THREE.Vector3(s * dx, y, c.bocaZ ?? RIG.boca.z), n: new THREE.Vector3(0, 0, 1) };
    const f = new THREE.Group(); f.position.copy(h.p).addScaledVector(h.n, A.off ?? 0.03); f.position.z -= A.atras ?? 0;
    const n = h.n.clone(); n.y = 0; n.normalize();
    f.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(n, _cero, _arriba));
    // colmillito gordito: cono curvado hacia adentro con punta redonda
    const tv = tuboVar([new THREE.Vector3(0, 0.005, 0), new THREE.Vector3(0, -0.06, 0.008), new THREE.Vector3(-s * 0.012, -0.12, 0.012)], (q) => 0.048 * Math.pow(1 - q, 0.8) + 0.008, 20, 14);
    f.add(malla(tv.geo, bl)); f.add(malla(esf(tv.r1, 10), bl, { pos: tv.fin.toArray() })); f.add(malla(esf(0.05, 14), bl, { pos: [0, 0.008, 0], esc: [1, 0.5, 0.9] }));
    if (A.contorno) f.add(malla(tv.geo, osc, { pos: [0, 0, -0.012], esc: [1.22, 1.08, 0.6] }));
    g.add(f);
  }
  return g;
}
PRENDAS.cara.colmillos = colmillosN;

// antifaz (tipo dominó con puntitas de gato): una sola pieza de tela que cubre los dos ojos con hoyos para que se vean,
// proyectada sobre la cara real (no se monta en hocicos ni picos), orilla gordita y cinta a la nuca sobre el cráneo
function antifazN(c) {
  const g = new THREE.Group(), mor = clay(0x6a3fa0, { roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color(0xc9a8ff), side: THREE.DoubleSide }), orilla = clay(0x452a75, { roughness: 0.5 });
  const sep = Math.max(0.24, c.sep ?? RIG.ojos.sep), oy = c.ojosY ?? RIG.ojos.y, zOjo = c.ojosZ ?? RIG.ojos.z, hx = 0.155, hy = 0.175;
  // banda dominó llena: puente lleno sobre el hocico, huecos chicos y puntitas de gato hacia afuera-arriba
  const mitad = [[0, 0.17], [sep * 0.5, 0.2], [sep, 0.26], [sep + 0.17, 0.27], [sep + 0.3, 0.33], [sep + 0.29, 0.12], [sep + 0.22, -0.1], [sep + 0.02, -0.22], [sep * 0.45, -0.17], [0, -0.1]];
  const ctrl = [...mitad.map(([x, y]) => new THREE.Vector3(x, oy + y, 0)), ...mitad.slice(1, -1).reverse().map(([x, y]) => new THREE.Vector3(-x, oy + y, 0))];
  const contorno = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal').getSpacedPoints(120);
  const dentro = (x, y) => { let k = false; for (let i = 0, j = contorno.length - 1; i < contorno.length; j = i++) { const a = contorno[i], b = contorno[j]; if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) k = !k; } return k; };
  const hoyo = (x, y) => Math.pow((Math.abs(x) - sep) / hx, 2) + Math.pow((y - oy) / hy, 2) < 1;
  const hit = (x, y) => { const h = caraN(c, x, y); if (!h || h.p.z > zOjo + 0.28) return null; return h; };
  // rejilla fina: solo las celdas dentro de la silueta y fuera de los hoyos
  const X0 = -(sep + 0.36), X1 = sep + 0.36, Y0 = oy - 0.25, Y1 = oy + 0.35, NX = 84, NY = 40, P = [], ok = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const x = X0 + (X1 - X0) * (i / NX), y = Y0 + (Y1 - Y0) * (j / NY), h = hit(x, y);
    P.push(h ? h.p.addScaledVector(h.n, 0.065) : null); ok.push(!!h && dentro(x, y) && !hoyo(x, y)); }
  const pos = [], idx = [], id = new Map(), vid = (k) => { if (!id.has(k)) { id.set(k, pos.length / 3); pos.push(P[k].x, P[k].y, P[k].z); } return id.get(k); };
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, cc = a + NX + 1, d = cc + 1;
    if ([a, b, cc, d].every((k) => ok[k])) idx.push(vid(a), vid(b), vid(cc), vid(b), vid(d), vid(cc)); }
  if (idx.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); g.add(malla(geo, mor)); }
  // orillas: contorno y los dos hoyos (tapan el borde escalonado de la rejilla)
  const tuboCara = (pts2, r) => { const pts = []; for (const [x, y] of pts2) { const h = hit(x, y); if (h) pts.push(h.p.addScaledVector(h.n, 0.07)); }
    if (pts.length > 8) g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), pts.length * 2, r, 8, true), orilla)); return pts; };
  tuboCara(contorno.map((v) => [v.x * 0.985, oy + (v.y - oy) * 0.985]), 0.03);
  for (const s of [-1, 1]) { const e = []; for (let i = 0; i < 48; i++) { const u = (i / 48) * Math.PI * 2; e.push([s * sep + Math.cos(u) * hx * 1.03, oy + Math.sin(u) * hy * 1.03]); } tuboCara(e, 0.028); }
  // cinta: nace en la orilla de cada lado del antifaz y rodea la nuca pegada al cráneo medido, con un moñito atrás
  const pf = perfilCabezaN(c), yC = oy + 0.06, xE = sep + 0.25;
  let eD = null; for (let x = xE; x > sep && !eD; x -= 0.02) eD = hit(x, yC);
  const eI = eD ? new THREE.Vector3(-eD.p.x, eD.p.y, eD.p.z) : null;
  const alE = eD ? Math.atan2(eD.p.x, eD.p.z - pf.zc) + 0.12 : Math.PI * 0.4, cinta = [];
  if (eD) cinta.push(eD.p.clone().addScaledVector(eD.n, 0.07));
  for (let k = 0; k <= 40; k++) { const al = alE + (k / 40) * (Math.PI * 2 - 2 * alE); if (pf.R(yC, al) > 0.05) cinta.push(pf.P(yC, al, 0.06)); }
  if (eI) cinta.push(eI.addScaledVector(new THREE.Vector3(-eD.n.x, eD.n.y, eD.n.z), 0.07));
  if (cinta.length > 4) g.add(malla(tuboN(cinta, 0.034, 80, 10), orilla));
  const nuca = pf.P(yC, Math.PI, 0.08);
  for (const s of [-1, 1]) g.add(malla(esf(0.06, 14), mor, { pos: [nuca.x + s * 0.055, nuca.y, nuca.z], esc: [1, 0.6, 0.45], rot: [0, 0, s * 0.4] }));
  g.add(malla(esf(0.03, 10), orilla, { pos: nuca.toArray() }));
  return g;
}
PRENDAS.cara.antifaz = antifazN;

// cuello alto de vampiro: rígido, negro por fuera y rojo por dentro, se abre detrás de la cabeza sin tocarla (radio medido)
function cuelloAltoVampiroN(c) {
  const g = new THREE.Group(), negro = clay(0x2e2540, { roughness: 0.6, sheen: 0.7, side: THREE.DoubleSide }), rojo = clay(0xd6283f, { roughness: 0.55, sheen: 0.6, side: THREE.DoubleSide });
  const y0 = c.cuelloY - 0.04, zc = c.zc ?? c.cuelloZc ?? 0, Hc = 0.4, NU = 40, NV = 14, A0 = 1.75;   // bajo: la cabeza se ve por detrás
  // radio de la piel en (y, a): cuerpo y también la malla de la cabeza (crin del unicornio, cresta): el cuello pasa por encima
  const rad = (y, a) => { let r = c.radio ? c.radio(y, a) : null;
    const q = c.craneo ? c.craneo(y - RIG.cabeza.y, Math.PI - a) : null; if (q) r = Math.max(r ?? 0, Math.hypot(q.x, q.z - zc));
    return r ?? ((c.cuelloRx ?? c.cuelloR) - 0.03); };
  const grid = Array.from({ length: NV + 1 }, () => []);
  for (let i = 0; i <= NU; i++) { const u = (i / NU) * 2 - 1, a = u * A0, borde = 1 - Math.pow(Math.abs(u), 2.5);
    const alto = Hc * (0.3 + 0.7 * Math.pow(borde, 0.7)) * (1 + 0.1 * Math.cos(u * Math.PI * 4) * borde);
    let r = 0;
    for (let j = 0; j <= NV; j++) { const v = j / NV, y = y0 + v * alto; r = Math.max(r, rad(y, a));   // nunca se mete: máximo de lo de abajo
      const rr = r + 0.05 + Math.pow(v, 1.4) * 0.2; grid[j][i] = [Math.sin(a) * rr, y, zc - Math.cos(a) * rr]; } }   // se abre en abanico
  const capa = (off, mat) => g.add(malla(rejillaN(NU, NV, (i, j) => { const [x, y, z] = grid[j][i], a = ((i / NU) * 2 - 1) * A0; return [x + Math.sin(a) * off, y, z - Math.cos(a) * off]; }), mat));
  capa(0, rojo); capa(0.022, negro);
  g.add(malla(tuboN(grid[NV].map(([x, y, z]) => new THREE.Vector3(x, y, z)), 0.02, 80, 6), clay(0x2e2540)));
  return g;
}
// capa de vampiro: la MISMA capa de héroe (capaPegada: largo, cola y vuelo iguales en todas) en negro con forro rojo,
// más el cuello alto y un medallón con cadenita al frente
function vampiroN(c) {
  const g = PRENDAS.espalda.capa(c), negroAfuera = clay(0x2a2236, { side: THREE.BackSide, roughness: 0.75, sheen: 0.9, sheenColor: new THREE.Color(0x7a6a9a) });
  const negro2 = clay(0x2a2236, { side: THREE.DoubleSide, roughness: 0.75, sheen: 0.9 }), forroAdentro = clay(0xc81f3a, { side: THREE.FrontSide, roughness: 0.7, sheen: 0.7 });
  g.traverse((o) => { if (!o.isMesh || !o.material || o.material.metalness > 0.5) return;
    // en capaPegada la cara que mira hacia afuera es la trasera (BackSide): esa va negra y la de adentro, roja
    o.material = o.material.side === THREE.BackSide ? negroAfuera : o.material.side === THREE.DoubleSide ? negro2 : forroAdentro; });
  g.add(cuelloAltoVampiroN(c));
  // medallón al frente con cadenita a los dos botones de la capa
  const yM = c.cuelloY - 0.05, rz = c.cuelloRz ?? c.cuelloR, zf = (c.sup ? c.sup(0, yM, 1) : null) ?? ((c.cuelloZc ?? 0) + rz), oro = metal(0xffcf3f);
  g.add(malla(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 28), oro, { pos: [0, yM, zf + 0.045], rot: [Math.PI / 2, 0, 0] }));
  g.add(malla(esf(0.055, 18), brillo(0xd6283f), { pos: [0, yM, zf + 0.07], esc: [1, 1, 0.6] }));
  const zb = (c.zc ?? c.cuelloZc ?? 0) + rz + 0.03, yb = c.cuelloY - 0.04;
  for (const s of [-1, 1]) g.add(malla(tubo([[s * 0.1, yb, zb], [s * 0.06, yM - 0.03, zf + 0.05], [s * 0.02, yM, zf + 0.05]], 0.012, 12, 6), oro));
  return g;
}
PRENDAS.espalda.vampiro = vampiroN;

// alitas de murciélago: membrana festoneada con dedos, en las anclas de la espalda real
function alaMurciN(s) {
  const sh = new THREE.Shape(); sh.moveTo(0, 0.04);
  sh.quadraticCurveTo(0.3, 0.3, 0.66, 0.34);
  sh.quadraticCurveTo(0.6, 0.12, 0.7, -0.06);
  sh.quadraticCurveTo(0.56, -0.02, 0.48, -0.18);
  sh.quadraticCurveTo(0.38, -0.06, 0.26, -0.2);
  sh.quadraticCurveTo(0.18, -0.06, 0.02, -0.08); sh.lineTo(0, 0.04);
  // membrana de peluche: gruesa (0.04) y con bisel redondo grande, se ve inflada
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.028, bevelSegments: 4, curveSegments: 16 });
  geo.translate(0, 0, -0.02);
  const ala = new THREE.Group(), m = malla(geo, clay(0x5a4482, { roughness: 0.75, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xb9a6ff), clearcoat: 0 })); m.scale.x = s; ala.add(m);
  const hueso = clay(0x3a2a5c, { roughness: 0.6, sheen: 0.6 });
  for (const [x, y] of [[0.66, 0.34], [0.7, -0.06], [0.48, -0.18], [0.26, -0.2]]) {
    ala.add(malla(tubo([[0, 0.02, 0.045], [s * x * 0.5, y * 0.55 + 0.08, 0.055], [s * x, y, 0.045]], 0.02, 12, 8), hueso));
    ala.add(malla(esf(0.026, 10), hueso, { pos: [s * x, y, 0.045] })); }
  ala.add(malla(esf(0.045, 12), hueso, { pos: [s * 0.68, 0.36, 0.03], esc: [1, 1.3, 1] }));   // garrita redonda
  return ala;
}
// alitas de murciélago: abiertas en V hacia atrás y un poco hacia arriba, con un cojincito al centro donde nacen.
// El murciélago ya tiene alas propias: en él no se ponen (se encimarían las membranas).
function alasMurciN(c) {
  const g = new THREE.Group();
  if (c.especie === 'murcielago') return g;
  ponerAlas(g, c, (s) => { const w = new THREE.Group(), a = alaMurciN(s); a.scale.setScalar(1.15); a.rotation.set(0, s * 0.5, s * 0.18); w.add(a); return w; });
  const [aI, aD] = [g.userData.alaI, g.userData.alaD];
  if (aI && aD) { const p = aI.position.clone().add(aD.position).multiplyScalar(0.5);
    g.add(malla(cajaR(0.2, 0.13, 0.07, 0.05, 3), clay(0x3a2a5c, { roughness: 0.7, sheen: 0.7 }), { pos: [p.x, p.y, p.z - 0.02] }));
    g.add(malla(esf(0.045, 12), clay(0x5a4482), { pos: [p.x, p.y, p.z - 0.06] })); }
  return g;
}
PRENDAS.espalda.alasmurci = alasMurciN;

// cubeta-calabaza de dulces como mochila: calabacita con asa, carita y dulces asomando
function cubetaN(c) {
  // misma base que la mochila (mochilaPegada): mismo alto, misma posición en los omóplatos y mismas correas compartidas
  const G = new THREE.Group(), osc = clay(0x3a2e4a), alto = 0.66, esc = 1.35;
  let g;
  if (c.pegar) g = enEspaldaAlta(c, new THREE.Group(), alto, 0.33);   // (V8.2: pegada al pelo de la espalda)
  else { g = new THREE.Group(); g.position.set(0, c.espaldaY + 0.12, c.espaldaZ - 0.28); }
  G.add(g);
  const k = new THREE.Group(); k.rotation.y = Math.PI; k.scale.setScalar(esc); g.add(k);   // la carita mira hacia atrás
  const perfil = [[0.0, -0.24], [0.2, -0.24], [0.28, -0.17], [0.31, -0.04], [0.29, 0.1], [0.24, 0.19], [0.22, 0.21], [0.2, 0.2]];
  const geo = deformar(torno(perfil, 48), (v) => { const a = Math.atan2(v.z, v.x), r = 1 + 0.06 * Math.cos(a * 8); v.x *= r; v.z *= r; });
  k.add(malla(geo, clay(0xff9636, { roughness: 0.5, clearcoat: 0.4, side: THREE.DoubleSide })));
  k.add(malla(new THREE.TorusGeometry(0.21, 0.025, 8, 40), clay(0xf07f22), { pos: [0, 0.205, 0], rot: [Math.PI / 2, 0, 0] }));
  k.add(malla(new THREE.TorusGeometry(0.2, 0.018, 8, 32, Math.PI), osc, { pos: [0, 0.2, 0] }));
  const cafe = clay(0x5a2a14, { roughness: 0.5, emissive: new THREE.Color(0xff7a1a), emissiveIntensity: 0.22, sheen: 0 });
  for (const s of [-1, 1]) k.add(malla(new THREE.ConeGeometry(0.05, 0.07, 3), cafe, { pos: [s * 0.1, 0.04, 0.29], rot: [Math.PI / 2, 0, 0], esc: [1, 1, 0.3] }));
  k.add(malla(new THREE.TorusGeometry(0.1, 0.022, 8, 20, Math.PI), cafe, { pos: [0, -0.04, 0.29], rot: [0, 0, Math.PI] }));
  const cols = [0xff6fa8, 0x7ed6ff, 0xffe066, 0x9be08a];
  [[-0.1, 0.22, 0.04], [0.06, 0.23, -0.06], [0.11, 0.22, 0.08], [-0.03, 0.24, -0.1]].forEach(([x, y, z], i) => {
    const d = new THREE.Group(); d.position.set(x, y, z); d.rotation.set(i * 0.7, i * 1.3, 0.4 * i); k.add(d);
    d.add(malla(esf(0.05, 14), brillo(cols[i]), { esc: [1.2, 1, 1] }));
    for (const s of [-1, 1]) d.add(malla(new THREE.ConeGeometry(0.035, 0.05, 8), clay(cols[i]), { pos: [s * 0.075, 0, 0], rot: [0, 0, s * Math.PI / 2] })); });
  // parche oscuro acolchado del lado de la espalda: ahí se cosen las correas a la cubeta
  k.add(malla(cajaR(0.34, 0.3, 0.07, 0.05, 3), osc, { pos: [0, -0.02, -0.33] }));
  if (c.pegar) G.add(correasPegadas(c, c.espaldaAltaY + alto * 0.42, c.espaldaAltaY - alto * 0.38, osc));
  return G;
}
PRENDAS.espalda.cubeta = cubetaN;
// aros (orillas de agujerito) donde algo atraviesa la superficie de una prenda cerrada. normal(p) = normal de la
// superficie en p. Agrupa los cruces cercanos y pone un aro ovalado que abraza cada cruce.
function arosDePuntosN(g, pts, normal, mat, minPts = 3, grueso = 0.034) {
  const grupos = [];
  for (const q of pts) { const gr = grupos.find((G) => G.c.distanceTo(q) < 0.2); if (gr) { gr.p.push(q); gr.c.multiplyScalar(gr.p.length - 1).add(q).divideScalar(gr.p.length); } else grupos.push({ c: q.clone(), p: [q] }); }
  for (const G of grupos) {
    if (G.p.length < minPts) continue;
    const n = normal(G.c), u = new THREE.Vector3().crossVectors(Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0), n).normalize(), w = new THREE.Vector3().crossVectors(n, u);
    let ru = 0.02, rv = 0.02; for (const q of G.p) { const d = q.clone().sub(G.c); ru = Math.max(ru, Math.abs(d.dot(u))); rv = Math.max(rv, Math.abs(d.dot(w))); }
    const aro = malla(new THREE.TorusGeometry(ru + 0.045, grueso, 10, 32), mat);
    aro.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, w, n)); aro.scale.set(1, (rv + 0.045) / (ru + 0.045), 1);
    aro.position.copy(G.c).addScaledVector(n, 0.008); g.add(aro);
  }
}
// parche que sigue una superficie: contorno 2D (u, v) cerrado, sup(u, v) -> {p, n}. Rejilla fina recortada por el
// contorno (la orilla escalonada la tapa un tubo encima). Devuelve los puntos 3D del contorno.
function parcheSupN(g, contorno, sup, mat, off, matOrilla = null, rOrilla = 0.02) {
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9; for (const [u, v] of contorno) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const dentro = (x, y) => { let k = false; for (let i = 0, j = contorno.length - 1; i < contorno.length; j = i++) { const a = contorno[i], b = contorno[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) k = !k; } return k; };
  const N = 40, P = [], ok = [];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const u = u0 + (u1 - u0) * (i / N), v = v0 + (v1 - v0) * (j / N), h = sup(u, v); P.push(h.p.clone().addScaledVector(h.n, off)); ok.push(dentro(u, v)); }
  const pos = [], idx = [], id = new Map(), vid = (k) => { if (!id.has(k)) { id.set(k, pos.length / 3); pos.push(P[k].x, P[k].y, P[k].z); } return id.get(k); };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, cc = a + N + 1, d = cc + 1;
    if (ok[a] || ok[b] || ok[cc] || ok[d]) if ([a, b, cc, d].filter((k) => ok[k]).length >= 3) idx.push(vid(a), vid(b), vid(cc), vid(b), vid(d), vid(cc)); }
  if (idx.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); g.add(malla(geo, mat)); }
  const pts = contorno.map(([u, v]) => { const h = sup(u, v); return h.p.clone().addScaledVector(h.n, off + rOrilla * 0.4); });
  if (matOrilla) g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), contorno.length * 2, rOrilla, 8, true), matOrilla));
  return pts;
}

// normal de una superficie dada por su distancia con signo fuera(p)
function normalDeN(fuera, p) { const e = 0.01, f0 = fuera(p); return new THREE.Vector3(fuera(p.clone().setX(p.x + e)) - f0, fuera(p.clone().setY(p.y + e)) - f0, fuera(p.clone().setZ(p.z + e)) - f0).normalize(); }
// orejas contra una prenda de cabeza cerrada (fuera(p) en el marco de la cabeza, + afuera). Corre cuando la prenda ya
// está colgada de la cabeza: la oreja que apenas asoma (< 0.12) se guarda adentro; la que sale mucho sale DERECHA por un
// ojal con orilla. Nunca se doblan hacia los lados.
function orejasOjalN(g, fuera, mat, ocultarCabeza = false) {
  g.addEventListener('added', () => {
    const cab = g.parent; if (!cab) return; let raiz = cab; while (raiz.parent) raiz = raiz.parent;
    raiz.updateMatrixWorld(true); const inv = cab.matrixWorld.clone().invert(), v = new THREE.Vector3();
    for (const nombre of ['orejaI', 'orejaD']) { const o = raiz.getObjectByName(nombre); if (!o) continue; const ps = []; let sale = 0, punta = null, dPunta = -1;
      const base = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(inv);
      o.traverse((m) => { if (m.isMesh && !m.isInstancedMesh) { const Pp = m.geometry.attributes.position; for (let i = 0; i < Pp.count; i += 2) { v.fromBufferAttribute(Pp, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv); const f = fuera(v); if (f < 5) sale = Math.max(sale, f); if (Math.abs(f) < 0.02) ps.push(v.clone());
        const d = v.distanceTo(base); if (d > dPunta) { dPunta = d; punta = v.clone(); } } } });
      if (sale < 0.2) o.visible = false;   // la que asoma solo la puntita se guarda (no parece falla)
      // el ojal abraza la oreja: su eje es el de la oreja (de la raíz a la punta), no la pared del gorro
      else { const eje = punta ? punta.clone().sub(base).normalize() : null; arosDePuntosN(g, ps, (p) => eje || normalDeN(fuera, p), mat, 6, 0.036); } }
    // disfraz completo: lo de la cabeza que casi no sale (crin, hocico, copetes) se guarda; lo que sale mucho se queda y lleva ojal
    if (ocultarCabeza) { const nodo = raiz.getObjectByName('cabeza'); nodo?.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh) return; for (let p = m; p && p !== nodo; p = p.parent) if (/^oreja/i.test(p.name)) return;
      const Pp = m.geometry.attributes.position; let sale = 0, dentro = 0, n = 0;
      for (let i = 0; i < Pp.count; i += 3) { v.fromBufferAttribute(Pp, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv); const f = fuera(v); n++; if (f < 5) { sale = Math.max(sale, f); if (f < 0) dentro++; } }
      if (sale < 0.12 && dentro > n * 0.3) m.visible = false; }); }
  });
  return g;
}

/* cabeza de calabaza (disfraz, ref. docs/diseno/accesorios-nuevos/REF-cabeza-calabaza.png): la calabaza SUSTITUYE la
   cabeza. Calabaza grande y redonda (ovalada si la cabeza es larga) con gajos hondos, medida para tragarse toda la
   cabeza de cada especie (cráneo, hocico, pico); su cara tallada es la cara de la mascota: ojos de corazón y
   sonrisa dentada, hueco oscuro con un brillo tibio. Lo grande que sobresale (orejas largas, aleta, cuerno,
   branquias) sale por cortes con orilla de pulpa. El borde de abajo queda arriba del cuello (no pisa bufandas
   ni playeras). */
function cabezaCalabazaN(c) {
  const g = new THREE.Group(), pf = perfilCabezaN(c), zc = pf.zc, celdas = techoCabezaN(c).celdas || [];
  const yBot = Math.max((c.bocaY ?? RIG.boca.y) - 0.22, (c.cuelloY ?? RIG.cuello.y) - RIG.cabeza.y + 0.12);
  // volumen de la cabeza por altura y ángulo: cráneo + todo lo que se ve desde arriba (hocico, pico, cuernos...)
  const NA = 48, PY = 0.04, NY = Math.ceil((1.3 - yBot) / PY) + 1, T = [];
  for (let j = 0; j < NY; j++) { const y = yBot + j * PY, f = new Float32Array(NA); for (let b = 0; b < NA; b++) f[b] = pf.R(y, (b / NA) * Math.PI * 2); T.push(f); }
  for (const [x, z, top] of celdas) { const d = Math.hypot(x, z - zc), b = ((Math.round((Math.atan2(x, z - zc) / (Math.PI * 2)) * NA) % NA) + NA) % NA;
    for (let j = 0; j < NY && yBot + j * PY <= top; j++) if (d > T[j][b]) T[j][b] = d; }
  // mediana angular (7 gajos de ángulo): lo delgado (aleta, cuerno, branquias) sale por un corte; las orejas no cuentan
  const pts = [];
  for (let j = 0; j < NY; j++) for (let b = 0; b < NA; b++) { const m = []; for (let k = -3; k <= 3; k++) m.push(T[j][(b + k + NA) % NA]); m.sort((x, y) => x - y);
    const d = m[3]; if (d > 0.02) { const al = (b / NA) * Math.PI * 2; pts.push(new THREE.Vector3(Math.sin(al) * d, yBot + j * PY, zc + Math.cos(al) * d)); } }
  if (!pts.length) for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2; pts.push(new THREE.Vector3(Math.sin(a) * 0.7, 0, Math.cos(a) * 0.7), new THREE.Vector3(0, 0.74, 0)); }
  let x1 = 0, z0 = 9, z1 = -9, top = -9; for (const p of pts) { x1 = Math.max(x1, Math.abs(p.x)); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); top = Math.max(top, p.y); }
  // forma: radios horizontales Rx/Rz y verticales distintos arriba y abajo (fondo más lleno, sin inflar de más)
  const zE = (z0 + z1) / 2, yc = yBot + 0.4 * (top - yBot), Rup = top - yc + 0.13, Rdn = yc - yBot + 0.16;
  let Rx0 = x1, Rz0 = Math.max((z1 - z0) / 2, x1 * 0.9);
  if (Rz0 < Rx0 * 1.12) Rz0 = Rx0 = Math.max(Rx0, Rz0);          // cabeza redonda: calabaza redonda
  const tY = (y) => (y >= yc ? Math.pow((y - yc) / Rup, 2) : Math.pow((yc - y) / Rdn, 2.6));
  let s = 1; for (const p of pts) { const k = 1 - tY(p.y); const hd = Math.hypot(p.x / Rx0, (p.z - zE) / Rz0); if (k > 0.02) s = Math.max(s, hd / Math.sqrt(k)); }
  const Rx = (Rx0 * s + 0.09) * 1.04, Rz = (Rz0 * s + 0.09) * 1.04, Ry = Rup;   // 1.04: el surco del gajo tampoco toca
  const NG = 10, gajo = (al) => Math.pow(Math.abs(Math.cos(al * NG / 2)), 0.6);           // 1 en el lomo, 0 en el surco
  const rho = (al, y) => { const k = 1 - tY(y); if (k <= 0) return 0;
    const e = 1 / Math.sqrt(Math.pow(Math.sin(al) / Rx, 2) + Math.pow(Math.cos(al) / Rz, 2)); return e * Math.sqrt(k) * (0.9 + 0.1 * gajo(al)); };
  const yTope = yc + Rup * 0.93, alt = (v) => yBot + v * (yTope - yBot);
  const sup = (al, y) => { const r = rho(al, y); return new THREE.Vector3(Math.sin(al) * r, y, zE + Math.cos(al) * r); };
  const fuera = (p) => { if (p.y < yBot || p.y > yTope + 0.02) return 9; const al = Math.atan2(p.x, p.z - zE); return Math.hypot(p.x, p.z - zE) - rho(al, p.y); };
  const normal = (p) => normalDeN(fuera, p);
  // cáscara con color por vértice: surcos y polos más oscuros
  const NU = 120, NV = 44, pos = [], col = [], idx = [], cA = new THREE.Color(0xff9a3a), cB = new THREE.Color(0xc25a12), cc = new THREE.Color();
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const v = j / NV, al = (i / NU) * Math.PI * 2, y = alt(v), p = j === NV ? new THREE.Vector3(0, yTope - 0.04, zE) : sup(al, y);
    pos.push(p.x, p.y, p.z);
    const polo = Math.pow(tY(y), 1.5);
    cc.copy(cA).lerp(cB, Math.min(1, (1 - gajo(al)) * 0.75 + polo * 0.6)); col.push(cc.r, cc.g, cc.b);
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + NU + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  g.add(malla(geo, clay(0xffffff, { vertexColors: true, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.2, side: THREE.DoubleSide })));
  // fondo: cierra hacia el cuerpo
  const rFondo = (al) => { const d = pf.R(yBot, al); return d > 0 ? d + 0.035 : 0.1; };
  const fondo = rejillaN(NU, 2, (i, j) => { const al = (i / NU) * Math.PI * 2, P0 = sup(al, yBot), r1 = rFondo(al), P1 = new THREE.Vector3(Math.sin(al) * r1, yBot, zc + Math.cos(al) * r1); return P0.lerp(P1, j / 2).toArray(); });
  g.add(malla(fondo, clay(0xc25a12, { roughness: 0.7, side: THREE.DoubleSide })));
  const anillo = []; for (let i = 0; i < NU; i++) { const al = (i / NU) * Math.PI * 2, r = rFondo(al); anillo.push(new THREE.Vector3(Math.sin(al) * r, yBot - 0.005, zc + Math.cos(al) * r)); }
  g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(anillo, true), 96, 0.035, 8, true), clay(0xb4520f, { roughness: 0.7 })));
  // orilla de abajo redondeada (labio gordito): la calabaza no termina en un corte duro
  const labio = []; for (let i = 0; i < NU; i++) { const al = (i / NU) * Math.PI * 2, p = sup(al, yBot + 0.03); p.x *= 0.985; p.z = zE + (p.z - zE) * 0.985; labio.push(p); }
  g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(labio, true), 120, 0.06, 12, true), clay(0xd9701c, { roughness: 0.55, clearcoat: 0.3 })));
  // cara tallada: (u, v) = (arco horizontal desde el frente, altura)
  const rF = rho(0, yc), supUV = (u, v) => { const al = u / rF, p = sup(al, v); return { p, n: normal(p) }; };
  const oscuro = new THREE.MeshBasicMaterial({ color: 0x2a0f06 }), brasa = new THREE.MeshBasicMaterial({ color: 0xe0772c, toneMapped: false }), pulpa = clay(0xf2b04a, { roughness: 0.6, sheen: 0 });
  const tallar = (cont, glow = 0.55) => {
    parcheSupN(g, cont, supUV, oscuro, 0.006, pulpa, 0.022);
    const [cu, cv] = cont.reduce((a, [u, v]) => [a[0] + u / cont.length, a[1] + v / cont.length], [0, 0]);
    parcheSupN(g, cont.map(([u, v]) => [cu + (u - cu) * glow, cv + (v - cv) * glow - 0.012]), supUV, brasa, 0.009);
  };
  const ancho = Math.min(rF, Rx), eu = ancho * 0.36, ev = yc + Ry * 0.22, k = Math.min(1.25, Math.max(0.85, ancho / 0.85));
  const corazon = (cx, cy, r) => { const o = []; for (let i = 0; i < 40; i++) { const t = (i / 40) * Math.PI * 2, x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); o.push([cx + x * r / 16, cy + y * r / 16]); } return o; };
  for (const sg of [-1, 1]) tallar(corazon(sg * eu, ev, 0.15 * k));
  // sonrisa dentada: arco de abajo liso, arriba con dientitos
  const mw = ancho * 0.62, mv = yc - Ry * 0.12, son = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, u = -mw + 2 * mw * t; son.push([u, mv - 0.17 * k * Math.sin(Math.PI * t) + 0.04 * k * Math.pow(Math.abs(2 * t - 1), 3)]); }
  for (let i = 24; i >= 0; i--) { const t = i / 24, u = -mw + 2 * mw * t, diente = (i % 4 === 2) && i > 2 && i < 22 ? -0.07 * k : 0; son.push([u, mv - 0.04 * k * Math.sin(Math.PI * t) + diente + 0.045 * k * Math.pow(Math.abs(2 * t - 1), 3)]); }
  tallar(son, 0.5);
  // tallo corto y hojita
  const tp = new THREE.Vector3(0, yTope - 0.05, zE), verde = clay(0x6b8f3a, { roughness: 0.7 });
  g.add(malla(tuboVar([tp.clone(), tp.clone().add(new THREE.Vector3(0, 0.12, 0)), tp.clone().add(new THREE.Vector3(0.07, 0.2, -0.02))], (q) => 0.075 * (1 - 0.3 * q), 16, 10).geo, clay(0x7a5a2e, { roughness: 0.85 })));
  g.add(malla(hojaGeo(0.3, 0.15), verde, { pos: [tp.x - 0.03, tp.y + 0.05, tp.z], rot: [-0.3, 0.6, 1.25] }));
  // cortes por donde sale lo grande (cuerno, aleta, branquias) y las orejas que no caben
  // (solo en la mitad alta: abajo, lo que cruza es el regreso de una aleta al cuerpo, no una salida)
  const corte = clay(0xf2b04a, { roughness: 0.65, sheen: 0.3 }), cruces = [];
  for (const [x, z, t2] of celdas) for (let y = Math.max(yBot + 0.14, yc + 0.08); y <= Math.min(t2, yTope); y += 0.02) { const q = new THREE.Vector3(x, y, z); if (Math.abs(fuera(q)) < 0.025) cruces.push(q); }
  arosDePuntosN(g, cruces, normal, corte, 3, 0.04);
  orejasOjalN(g, fuera, corte, true);
  return g;
}
PRENDAS.cabeza.cabezacalabaza = cabezaCalabazaN;
// casco de minero: EXACTAMENTE el casco de obra (mismo ajuste, mismo cascarón, mismas orejas), en gris oscuro, con
// lamparita al frente y su cinta. Solo se cambia el color y se agrega la lámpara: el ajuste es el del casco.
function mineroN(c) {
  const g = PRENDAS.cabeza.casco(c), gris = clay(0x5a6070, { side: THREE.DoubleSide, roughness: 0.4, clearcoat: 0.6 });
  g.traverse((o) => { if (o.isMesh && o.material?.color && o.material.color.getHex() === 0xffc93c) o.material = gris; });
  // la lámpara va en la frente de la copa del casco (marco del casco: la copa mide r 0.47 a y 0.22, donde va su calcomanía)
  const lam = new THREE.Group(); lam.position.set(0, 0.22, 0.455); lam.rotation.x = -0.62;
  lam.add(malla(cajaR(0.34, 0.07, 0.05, 0.02, 2), clay(0x2b2b38, { roughness: 0.7 }), { pos: [0, 0, -0.02] }));          // cinta
  lam.add(malla(new THREE.CylinderGeometry(0.1, 0.085, 0.09, 24), clay(0x3a3f4c, { roughness: 0.35, clearcoat: 0.8 }), { rot: [Math.PI / 2, 0, 0], pos: [0, 0, 0.04] }));
  lam.add(malla(new THREE.TorusGeometry(0.095, 0.02, 8, 24), metal(0xc9ced8), { pos: [0, 0, 0.085] }));
  lam.add(malla(new THREE.CircleGeometry(0.08, 24), new THREE.MeshBasicMaterial({ color: 0xfff2a8, toneMapped: false }), { pos: [0, 0, 0.087] }));
  g.add(lam);
  return g;
}
PRENDAS.cabeza.minero = mineroN;
SOMBREROS_CON_ALA.add('minero');   // mismas orejas que el casco de obra
/* ============================================================ fin de accesorios nuevos (oct-2026) */


/* ============================================================ siluetas: cada especie con su propia forma */
// cabeza: redonda | cubo | losa | gota | hex | huevo | ancha      torso: normal | gordito | delgado | huevo | cubo | unido | ninguno
// textura/texturaTorso: piel pintada (PIELES); acabado: brillo del material; panza: ovalo | ninguna | escamas | panel
// brazos: mano | ala | aleta | robot | garra | pezuna      pie: pata | palmeada | garra | pezuna | conejo | robot | nub
const ESMALTE = { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.2 };
const VIDRIO = { roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, sheen: 0, ior: 1.33, specularIntensity: 1 };
export const FORMAS = {
  obra: { cabeza: 'cubo', torso: 'cubo', textura: 'ladrillo', texturaTorso: 'ladrillo', panza: 'ninguna', cima: 1.0 },  // ladrillo con cemento
  pisos: { cabeza: 'losa', torso: 'normal', textura: 'azulejo', acabado: ESMALTE },                                    // azulejo de talavera
  pintura: { cabeza: 'redonda', torso: 'delgado', texturaTorso: 'manchas', panza: 'ninguna', cima: 0.95 },             // brocha manchada
  plomeria: { cabeza: 'gota', cab: { y: -0.08, esc: 0.98 }, torso: 'ninguno', pie: 'nub', acabado: VIDRIO, cima: 0.98,             // gota de agua de una pieza
    info: { cuelloY: -0.44, cuelloR: 0.95, espaldaY: -0.3, espaldaZ: -0.98, pechoY: -0.34, pechoZ: 0.94 } },
  ferreteria: { cabeza: 'hex', torso: 'cubo', brazos: 'robot', pie: 'robot', panza: 'panel',                          // tuerca robot
    acabado: { roughness: 0.35, metalness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2, sheen: 0 } },
  patito: { cabeza: 'redonda', cab: { y: 0.6, esc: 0.64 }, torso: 'huevo', pie: 'palmeada' },
  cocodrilo: { cabeza: 'ancha', cab: { y: 0.56, esc: 0.72 }, torso: 'gordito', brazos: 'garra', pie: 'garra', panza: 'escamas' },
  ajolote: { cabeza: 'ancha', cab: { y: 0.66, esc: 0.8 }, torso: 'delgado' },
  xolo: { cabeza: 'huevo', cab: { y: 0.74, esc: 0.68 }, torso: 'delgado', patas: 'largas' },
  gatito: { cabeza: 'ancha', torso: 'normal', textura: 'rayas', texturaTorso: 'rayas' },
  pinguino: { cabeza: 'redonda', cab: { y: 0.42, esc: 0.74 }, torso: 'unido', patas: 'ninguna', pie: 'palmeada' },
  conejito: { cabeza: 'huevo', torso: 'gordito', pie: 'conejo' },
  panda: { cabeza: 'redonda', cab: { y: 0.66, esc: 0.8 }, torso: 'gordito', extremidades: 0x4a4d63 },
  unicornio: { cabeza: 'huevo', cab: { y: 0.82, esc: 0.66 }, torso: 'delgado', patas: 'largas', brazos: 'pezuna', pie: 'pezuna', pies: 0xb59ad8 },
};
// esfera "cuadrada" (superelipsoide): n=2 es esfera, mientras mas grande mas cubo
function superesfera(n = 4, seg = 48) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = Math.pow(Math.abs(v.x) ** n + Math.abs(v.y) ** n + Math.abs(v.z) ** n, 1 / n) || 1;
    p.setXYZ(i, v.x / k, v.y / k, v.z / k);
  }
  g.computeVertexNormals(); return g;
}
function deformar(g, f) {
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); f(v); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
// deformaciones de la esfera unitaria (tambien sirven para encontrar puntos sobre la piel)
const cuadrar = (n) => (v) => { const k = Math.pow(Math.abs(v.x) ** n + Math.abs(v.y) ** n + Math.abs(v.z) ** n, 1 / n) || 1; v.divideScalar(k); };
const ahuevar = (v) => { if (v.y > 0) { v.x *= 1 - 0.2 * v.y; v.z *= 1 - 0.2 * v.y; } v.y *= 1.06; };
const engotar = (v) => { if (v.y > 0.15) { const t = (v.y - 0.15) / 0.85; v.x *= 1 - t * 0.82; v.z *= 1 - t * 0.82; v.y += t * 0.5; v.x += t * t * 0.2; } };  // punta ladeada
function hexGeo() {  // tuerca vista de frente: hexagono biselado con la cara en la cara plana
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; i ? s.lineTo(Math.cos(a), Math.sin(a)) : s.moveTo(1, 0); }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.8, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.14, bevelSegments: 3, curveSegments: 1 });
  g.center(); return g;  // arista plana arriba (para los sombreros), vertices a los lados
}
const CABEZAS = {  // ojosZ: profundidad de los ojos; ojoRot: giro de los ojos hacia los lados; plano: cara plana (sin deformacion esferica)
  redonda: { geo: () => esf(1, 56), esc: [1.06, 0.94, 1], cima: 0.9, ojosZ: 0.88 },
  ancha: { geo: () => esf(1, 56), esc: [1.22, 0.86, 1], cima: 0.82, ojosZ: 0.88 },
  cubo: { geo: () => superesfera(4), deform: cuadrar(4), esc: [1, 0.9, 0.95], cima: 0.88, ojosZ: 0.88, ojoRot: 0.15 },
  losa: { geo: () => superesfera(5), deform: cuadrar(5), esc: [1.14, 0.76, 0.92], cima: 0.74, ojosZ: 0.86, ojoRot: 0.15 },
  hex: { geo: hexGeo, esc: [0.92, 0.92, 1], cima: 0.98, ojosZ: 0.48, ojoRot: 0, plano: { mejX: 0.52, z: 0.555 } },
  huevo: { geo: () => deformar(esf(1, 56), ahuevar), deform: ahuevar, esc: [1, 1, 1], cima: 1.0, ojosZ: 0.88 },
  gota: { geo: () => deformar(esf(1, 64), engotar), deform: engotar, esc: [1.04, 0.95, 1], cima: 1.12, ojosZ: 0.88 },
};
const TORSOS = {  // y: centro; r: radio; esc; hombro: x de los brazos; ninguno: el cuerpo es la cabeza (gota)
  normal: { y: -0.25, r: 0.55, esc: [1, 1.05, 0.92], hombro: 0.45 },
  gordito: { y: -0.28, r: 0.62, esc: [1.1, 0.98, 0.98], hombro: 0.56 },
  delgado: { y: -0.22, r: 0.46, esc: [0.92, 1.25, 0.85], hombro: 0.36 },
  huevo: { y: -0.25, r: 0.6, esc: [1, 1.12, 0.95], hombro: 0.5 },
  cubo: { y: -0.25, r: 0.5, esc: [1.08, 1.1, 0.86], hombro: 0.5, cubo: true },
  unido: { y: -0.22, r: 0.78, esc: [1, 1.1, 0.95], hombro: 0.68 },
  ninguno: { y: -0.3, r: 0.9, esc: [1, 1, 1], hombro: 0.92, ninguno: true },
};
// punto y normal sobre una piel (esfera unitaria deformada y escalada) en la direccion (x, y, z)
const _arriba = new THREE.Vector3(0, 1, 0), _lado = new THREE.Vector3(1, 0, 0), _cero = new THREE.Vector3(), _mPegar = new THREE.Matrix4();
function sobre(tipo, x, y, z, salir = 0) {
  const E = new THREE.Vector3(...tipo.esc);
  const P = (v) => { const w = v.clone().normalize(); tipo.deform?.(w); return w.multiply(E); };
  const u = new THREE.Vector3(x, y, z).normalize(), p = P(u);
  const t1 = new THREE.Vector3().crossVectors(u, Math.abs(u.y) < 0.9 ? _arriba : _lado).normalize(), t2 = new THREE.Vector3().crossVectors(u, t1);
  const a = P(u.clone().addScaledVector(t1, 0.01)).sub(p), b = P(u.clone().addScaledVector(t2, 0.01)).sub(p);
  const n = new THREE.Vector3().crossVectors(a, b).normalize(); if (n.dot(p) < 0) n.negate();
  return [p.addScaledVector(n, salir), n];
}
// coloca una pieza en p mirando hacia n (su eje z sale de la piel, su eje y queda "hacia arriba")
function pegar(padre, m, p, n) { m.position.copy(p); m.quaternion.setFromRotationMatrix(_mPegar.lookAt(n, _cero, _arriba)); padre.add(m); return m; }
// pata de pato palmeada (tres dedos), plana sobre el piso y con los dedos al frente
function pataPato() {
  const s = new THREE.Shape(); s.moveTo(0, -0.05);
  s.quadraticCurveTo(-0.21, 0.1, -0.17, 0.25); s.quadraticCurveTo(-0.11, 0.19, -0.06, 0.28);
  s.quadraticCurveTo(0, 0.22, 0.06, 0.28); s.quadraticCurveTo(0.11, 0.19, 0.17, 0.25); s.quadraticCurveTo(0.21, 0.1, 0, -0.05);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3, curveSegments: 8 });
  g.rotateX(Math.PI / 2); return g;
}

/* ============================================================ pieles pintadas (canvas equirectangular con el color ya horneado) */
const css = (h) => '#' + new THREE.Color(h).getHexString();
function azar(semilla) { let s = semilla; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function texPiel(dibujar, w = 512, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; dibujar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function matPiel(map, color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({ color: 0xffffff, map, roughness: 0.7, metalness: 0, sheen: 0.6, sheenRoughness: 0.7,
    sheenColor: new THREE.Color(aclarar(color, 0.5)), clearcoat: 0.1, clearcoatRoughness: 0.55, ...extra });
}
const PIELES = {
  ladrillo: (col) => texPiel((x, w, h) => {  // ladrillos con junta clara solo en la banda de los lados (arriba y abajo lisos)
    const r = azar(17), filas = 6, y0 = h * 0.25, fh = (h * 0.5) / filas, cw = w / 12;
    x.fillStyle = css(col); x.fillRect(0, 0, w, h);
    x.fillStyle = css(aclarar(col, 0.6)); x.fillRect(0, y0 - 3, w, h * 0.5 + 6);
    for (let f = 0; f < filas; f++) for (let k = -1; k <= 12; k++) {
      x.fillStyle = css(new THREE.Color(col).lerp(new THREE.Color(r() < 0.5 ? 0xffffff : 0x000000), r() * 0.1).getHex());
      x.beginPath(); x.roundRect(k * cw + (f % 2) * cw / 2 + 3, y0 + f * fh + 3, cw - 6, fh - 6, 5); x.fill();
    }
  }),
  azulejo: (col) => texPiel((x, w, h) => {  // talavera: medallones en las juntas, marco y florecita (la cara del frente va limpia)
    const azul = css(oscurecer(col, 0.55)), cw = w / 4, y0 = h * 0.25, y1 = h * 0.75;
    x.fillStyle = css(col); x.fillRect(0, 0, w, h); x.fillStyle = azul; x.strokeStyle = azul; x.lineWidth = 5;
    const flor = (cx, cy, r, n) => { for (let k = 0; k < n; k++) { x.beginPath(); x.ellipse(cx + Math.cos(k * 2 * Math.PI / n) * r * 0.5, cy + Math.sin(k * 2 * Math.PI / n) * r * 0.5, r * 0.5, r * 0.2, k * 2 * Math.PI / n, 0, 7); x.fill(); } };
    for (let i = 0; i <= 4; i++) for (const cy of [y0, y1]) { flor(w * 0.125 + i * cw, cy, 36, 8); x.beginPath(); x.arc(w * 0.125 + i * cw, cy, 13, 0, 7); x.fill(); }
    for (let i = 0; i <= 4; i++) {
      const cx = i * cw; x.strokeRect(cx - cw / 2 + 20, y0 + 20, cw - 40, y1 - y0 - 40);
      for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(cx - cw / 2 + 30 + k * (cw - 60) / 5, y0 + 9, 3, 0, 7); x.fill(); x.beginPath(); x.arc(cx - cw / 2 + 30 + k * (cw - 60) / 5, y1 - 9, 3, 0, 7); x.fill(); }
      if (i % 4 === 1) continue;
      flor(cx, h / 2, 34, 4); x.beginPath(); x.arc(cx, h / 2, 9, 0, 7); x.fill();
    }
    x.fillStyle = '#fffaf0';
    for (let i = 0; i <= 4; i++) { x.fillRect(w * 0.125 + i * cw - 3, 0, 6, h); for (const cy of [y0, y1]) { x.beginPath(); x.arc(w * 0.125 + i * cw, cy, 6, 0, 7); x.fill(); } x.beginPath(); x.arc(i * cw, h / 2, 5, 0, 7); x.fill(); }
    x.fillRect(0, y0 - 3, w, 6); x.fillRect(0, y1 - 3, w, 6);
  }),
  manchas: (col) => texPiel((x, w, h) => {  // salpicaduras de pintura de colores
    const r = azar(5), pal = ['#ff6fa8', '#ffd75e', '#5ec8f2', '#7ed67a', '#ff9a4d', '#ffffff'];
    x.fillStyle = css(col); x.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const cx = r() * w, cy = h * 0.2 + r() * h * 0.6, rr = 9 + r() * 14; x.fillStyle = pal[i % pal.length];
      x.beginPath(); x.arc(cx, cy, rr, 0, 7); x.fill();
      for (let k = 0; k < 5; k++) { const a = r() * 7, d = rr + 3 + r() * 10; x.beginPath(); x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2 + r() * 4, 0, 7); x.fill(); }
    }
  }),
  rayas: (col) => texPiel((x, w, h) => {  // rayas de gato: frente, lados y lomo
    x.fillStyle = css(col); x.fillRect(0, 0, w, h); x.fillStyle = css(oscurecer(col, 0.25));
    const raya = (cx, cy, rx, ry) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill(); };
    raya(128, h * 0.2, 9, 26); raya(104, h * 0.23, 7, 17); raya(152, h * 0.23, 7, 17);
    for (const cx of [0, 256, 512]) for (const k of [0, 1]) raya(cx, h * (0.42 + k * 0.1), 30, 6);
    for (let k = 0; k < 4; k++) raya(384, h * (0.22 + k * 0.13), 70, 8);
  }),
  escamas: (col) => texPiel((x, w, h) => {  // panza de cocodrilo con placas
    x.fillStyle = css(col); x.fillRect(0, 0, w, h); x.fillStyle = css(oscurecer(col, 0.12));
    for (let k = 1; k < 9; k++) x.fillRect(0, k * h / 9 - 2, w, 4);
  }),
};

/* ============================================================ RIG estandar + modelos esculpidos (SDF horneado)
   Todas las especies comparten estas proporciones y anclas (unidades de la raiz, antes del crecimiento).
   La cabeza tiene su propio marco: origen en RIG.cabeza (cabeza/cara de PRENDAS van ahi).
   Los modelos salen de herramientas/esculpir_mascotas.py -> web/modelos/mascotas.json */
export const RIG = {
  suelo: -1.06,
  cabeza: { y: 0.6, z: 0, r: 0.76, cima: 0.74, ancho: 0.48 },  // cima: tope de la esfera (local); ancho: medio ancho donde asienta un sombrero
  ojos: { y: -0.02, sep: 0.3, z: 0.7 },                        // local de cabeza (la z real sale de cada especie)
  boca: { y: -0.3, z: 0.72 },
  cuello: { y: -0.1, r: 0.4 },
  pecho: { y: -0.28, z: 0.42 },
  espalda: { y: -0.44, z: -0.46 },
  hombro: { x: 0.42, y: -0.17, z: 0.04 },                       // pivote del brazo; el derecho saluda girando ~2.1 rad en z
  pies: { x: 0.24, z: 0.08 },
};
// info que reciben las PRENDAS (cabeza/cara en marco de cabeza; cuello/espalda en marco del cuerpo)
function infoRig(mod) {
  const A = mod?.anclas || {}, oj = A.ojo?.[0], bo = A.boca;
  return { cima: RIG.cabeza.cima, ancho: RIG.cabeza.ancho, ojosY: oj ? oj[1] : RIG.ojos.y, ojosZ: oj ? oj[2] : RIG.ojos.z, sep: oj ? Math.abs(oj[0]) : RIG.ojos.sep,
    asiento: A.asiento ?? RIG.cabeza.cima - 0.15, bocaY: bo ? bo[1] : RIG.boca.y, bocaZ: bo ? bo[2] : RIG.boca.z, cuelloY: RIG.cuello.y, cuelloR: RIG.cuello.r,
    pechoY: RIG.pecho.y, pechoZ: RIG.pecho.z, espaldaY: RIG.espalda.y, espaldaZ: RIG.espalda.z, ...(mod?.info || {}) };
}
const MODELOS = {};
const bytes64 = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
// indices: delta zigzag en LEB128
function desVarint(u, n) {
  const out = new Uint16Array(n); let p = 0, prev = 0;
  for (let i = 0; i < n; i++) { let z = 0, sh = 0, b; do { b = u[p++]; z += (b & 0x7f) * 2 ** sh; sh += 7; } while (b & 0x80); prev += z & 1 ? -((z + 1) / 2) : z / 2; out[i] = prev; }
  return out;
}
function geoParte(p, textura) {
  const q = new Int16Array(bytes64(p.pos).buffer), pos = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) pos[i] = q[i] * p.esc[i % 3] + p.off[i % 3];
  const g = new THREE.BufferGeometry(), nor = new Int8Array(bytes64(p.nor).buffer);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
  g.setIndex(new THREE.BufferAttribute(desVarint(bytes64(p.idx), p.grupos.reduce((t, gr) => t + gr[1], 0)), 1));
  if (textura) {  // proyeccion de caja por el eje dominante de la normal
    const uv = new Float32Array(p.n * 2);
    for (let i = 0; i < p.n; i++) {
      const ax = Math.abs(nor[i * 3]), ay = Math.abs(nor[i * 3 + 1]), az = Math.abs(nor[i * 3 + 2]), x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const [u, v] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [x, z] : [x, y];
      uv[i * 2] = u * 1.7; uv[i * 2 + 1] = v * 1.7;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  for (const [a, n, c] of p.grupos) g.addGroup(a, n, c);
  g.computeBoundingSphere(); g.userData = { reg: bytes64(p.reg), fija: true };
  return g;
}
// la version de la app (?v=...) viaja a los modelos: el telefono los guarda y solo los vuelve a bajar si cambian
const VER_APP = new URL(import.meta.url).search;
// los modelos llevan su propia version (la pone el servidor en la pagina): un cambio en el codigo ya no obliga a bajar
// otra vez los 5 MB de mascotas; sin ella (servidor viejo) se usa la de la app
const VER_MOD = (() => { try { const v = document.querySelector('meta[name="version-modelos"]')?.content; return v ? '?v=' + v : VER_APP; } catch { return VER_APP; } })();
let usoRespaldo = false;   // el ultimo armado salio de respaldo porque su GLB venia en camino: esa foto no se guarda
const GLB = { lista: null, cargador: null, prom: new Map(), fallidas: new Set() };
let esculpidas = null;   // mascotas.json: solo hace falta de respaldo, si un GLB no carga
let esculpidasListas = false;
async function cargarModelos() {
  try {
    const r = await fetch(new URL('./modelos/mascotas.json' + VER_MOD, import.meta.url));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const datos = await r.json();
    for (const [k, d] of Object.entries(datos.especies || {})) {
      try {
        const partes = {};
        for (const [n, p] of Object.entries(d.partes)) partes[n] = geoParte(p, !!d.textura);
        MODELOS[k] = { ...d, partes, cache: new Map() };
      } catch (e) { console.warn('modelo', k, e); }
    }
  } catch (e) { console.warn('sin modelos esculpidos, uso los procedurales', e); }
}
function colorRegion(spec, base) {
  if (spec === 'base' || spec == null) return base;
  if (Array.isArray(spec)) {
    const [t, a, b] = spec;
    if (t === 'claro') return aclarar(base, a);
    if (t === 'osc') return oscurecer(base, a);
    if (t === 'mezcla') return new THREE.Color(base).lerp(new THREE.Color(a), b).getHex();
  }
  return spec;
}
// geometria con colores por vertice para un pelaje (comparte posiciones, normales e indices)
function geoColor(mod, parte, base) {
  const llave = parte + '|' + base;
  if (mod.cache.has(llave)) return mod.cache.get(llave);
  const src = mod.partes[parte], reg = src.userData.reg, n = reg.length, col = new Float32Array(n * 3), c = new THREE.Color();
  const tabla = {};
  for (const [id, spec] of Object.entries(mod.colores)) tabla[id] = new THREE.Color(colorRegion(spec, base));
  for (let i = 0; i < n; i++) { const t = tabla[reg[i]] || c.setHex(base); col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b; }
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) if (src.attributes[k]) g.setAttribute(k, src.attributes[k]);
  g.setIndex(src.index); for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.boundingSphere = src.boundingSphere; g.userData = { fija: true };
  mod.cache.set(llave, g); return g;
}
// acabados del vinil: suave satinado por defecto
const ACABADOS = {
  vinil: { roughness: 0.5, sheen: 0.45, sheenRoughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.35 },
  esmalte: { roughness: 0.22, sheen: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 },
  plastico: { roughness: 0.32, sheen: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.15 },
  vidrio: { roughness: 0.06, sheen: 0, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, ior: 1.4 },
};
function texLadrillo(col) {
  return texCanvas((x, n) => {  // ladrillos del color del pelaje con junta de cemento clara (repetible)
    const r = azar(17), fh = n / 4, cw = n / 2;
    x.fillStyle = css(aclarar(col, 0.72)); x.fillRect(0, 0, n, n);
    for (let f = 0; f < 4; f++) for (let k = -1; k <= 2; k++) {
      x.fillStyle = css(new THREE.Color(col).lerp(new THREE.Color(r() < 0.5 ? 0xffffff : 0x000000), r() * 0.12).getHex());
      x.beginPath(); x.roundRect(k * cw + (f % 2) * cw / 2 + 5, f * fh + 5, cw - 10, fh - 10, 9); x.fill();
    }
  }, 256);
}
function matsModelo(mod, base) {
  const llave = 'modelo|' + (mod.acabado || 'vinil') + '|' + (mod.textura || '') + '|' + base;
  if (cacheMat.has(llave)) return cacheMat.get(llave);
  const ac = ACABADOS[mod.acabado] || ACABADOS.vinil, sh = new THREE.Color(aclarar(base, 0.6));
  const comun = { color: 0xffffff, vertexColors: true, metalness: 0, sheenColor: sh, ...ac };
  const mats = [new THREE.MeshPhysicalMaterial(comun),
    new THREE.MeshPhysicalMaterial({ ...comun, ...ACABADOS.esmalte, roughness: 0.15 }),
    new THREE.MeshPhysicalMaterial({ ...comun, roughness: 0.28, metalness: 0.75, sheen: 0, clearcoat: 0.6 })];
  if (mod.textura === 'ladrillo') {
    const t = texLadrillo(base); t.wrapS = t.wrapT = THREE.RepeatWrapping; TEXTURAS_FIJAS.add(t);
    mats.push(new THREE.MeshPhysicalMaterial({ ...comun, vertexColors: false, map: t }));
  }
  mats.forEach((m, i) => cacheMat.set(llave + '|' + i, m));
  cacheMat.set(llave, mats); return mats;
}
function mallaModelo(mod, parte, base) {
  const m = new THREE.Mesh(geoColor(mod, parte, base), matsModelo(mod, base)); m.castShadow = true; return m;
}
// boca grande que se abre al comer (la sonrisa abierta ya viene esculpida)
function bocaComiendo(p) {
  const g = new THREE.Group(); g.position.set(p[0], p[1] - 0.03, p[2] - 0.02);
  g.add(malla(esf(0.13, 24), brillo(0x6e1f3c), { esc: [1, 0.9, 0.35] }));
  g.add(malla(esf(0.08, 16), clay(0xff8fa3), { pos: [0, -0.05, 0.03], esc: [1, 0.55, 0.5] }));
  g.visible = false; return g;
}
const _mOjo = new THREE.Matrix4(), _vN = new THREE.Vector3();
function orientar(o, n) { _vN.set(...n); o.quaternion.setFromRotationMatrix(_mOjo.lookAt(_vN, _cero, _arriba)); }
function armarModelo(op, def, mod) {
  const color = op.color && PELAJES[op.color] !== undefined ? PELAJES[op.color] : (mod.color ?? def.color);
  const raiz = new THREE.Group(), cuerpo = new THREE.Group(); raiz.add(cuerpo);
  const eq = { ...(op.equipo || {}) };
  if (op.accesorio && ACC_A_SLOT[op.accesorio] && !eq[ACC_A_SLOT[op.accesorio]]) eq[ACC_A_SLOT[op.accesorio]] = op.accesorio;
  const sombrero = !!PRENDAS.cabeza[eq.cabeza];
  cuerpo.add(mallaModelo(mod, 'cuerpo', color));
  if (mod.partes.collar && !PRENDAS.cuello[eq.cuello]) cuerpo.add(mallaModelo(mod, 'collar', color));
  const cab = new THREE.Group(); cab.position.set(0, RIG.cabeza.y, RIG.cabeza.z); cuerpo.add(cab);
  cab.add(mallaModelo(mod, 'cabeza', color));
  if (mod.partes.copete && !sombrero) cab.add(mallaModelo(mod, 'copete', color));
  const A = mod.anclas, info = infoRig(mod);
  // ojos en la superficie de la cara (el guiño es el ojo izquierdo del personaje)
  const ojos = new THREE.Group(); ojos.position.y = A.ojo[0][1]; cab.add(ojos);
  const estilo = op.ojos || 'normal';
  for (const s of [-1, 1]) {
    const est = estilo === 'normal' && mod.guino && s > 0 ? 'guino' : estilo;
    const o = ojo(est), [px, , pz] = A.ojo[0], n = [s * A.ojo[1][0], A.ojo[1][1], A.ojo[1][2]];
    const hund = est === 'normal' ? -0.035 : est === 'cuenta' ? 0.025 : est === 'salton' ? 0.04 : 0.012;
    o.position.set(s * px + n[0] * hund, n[1] * hund, pz + n[2] * hund); orientar(o, n); ojos.add(o);
  }
  // cachetes difuminados
  const geoC = new THREE.PlaneGeometry(0.34, 0.22), matC = new THREE.MeshBasicMaterial({ map: TEX_CACHETE, transparent: true, depthWrite: false, opacity: 0.8 });
  if (A.mejilla) for (const s of [-1, 1]) {
    const [p, n] = A.mejilla, ch = malla(geoC, matC); ch.castShadow = false;
    ch.position.set(s * p[0] + s * n[0] * 0.012, p[1] + n[1] * 0.012, p[2] + n[2] * 0.012); orientar(ch, [s * n[0], n[1], n[2]]); cab.add(ch);
  }
  const bocaAbierta = bocaComiendo(A.boca); cab.add(bocaAbierta);
  if (A.foco && !sombrero) {  // foquito de Tuerquin
    const foco = malla(esf(0.12, 24), new THREE.MeshBasicMaterial({ color: 0xfff27a }), { pos: A.foco }); cab.add(foco); cab.userData.foco = foco;
  }
  // brazos: pivote en el hombro; el izquierdo es espejo del derecho
  const H = A.hombro ? { x: A.hombro[0], y: A.hombro[1], z: A.hombro[2] } : RIG.hombro, brazos = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * H.x, H.y, H.z);
    const b = mallaModelo(mod, 'brazo', color); if (s < 0) b.scale.x = -1;
    piv.add(b); cuerpo.add(piv); brazos.push(piv);
  }
  def.extrasModelo?.(cab, cuerpo, { color, info, sombrero, mod });
  for (const slot of ['cabeza', 'cara', 'cuello', 'espalda']) {
    const f = PRENDAS[slot]?.[eq[slot]];
    if (f) { const p = aplicarAcabado(f(info), op.acabados?.[slot]); (slot === 'cabeza' || slot === 'cara' ? cab : cuerpo).add(p); Object.assign(cuerpo.userData, p.userData); p.userData.prendaSlot = slot; }
  }
  Object.assign(cuerpo.userData, cab.userData);
  cuerpo.userData.bocaY = RIG.cabeza.y + A.boca[1];
  cuerpo.userData.bocaZ = RIG.cabeza.z + A.boca[2];
  cuerpo.userData.cab = cab;
  crecerYBrillar(raiz, op);
  return { raiz, cuerpo, ojos, boca: null, bocaAbierta, brazos, mandibula: null, foco: cuerpo.userData.foco, ud: cuerpo.userData, estiloOjos: estilo };
}
/* ---------- modelos externos (p. ej. GLB hechos en Blender): ver docs/diseno/mascotas-v2/RIG.md
   MODELOS_EXTERNOS[especie] = { cuerpo: Object3D, brazoD: Object3D, brazoI?: Object3D, anclas: {...}, color?, guino? }
   Coordenadas del modelo: origen en el piso entre los pies, Y arriba, +Z al frente, mismas unidades que RIG.
   Si el cuerpo trae un nodo 'cabeza' se cuelga del grupo de cabeza (para inclinarla); nodos 'copete*' se
   ocultan con sombrero y 'collar*' con prenda de cuello. Materiales cuyo nombre empieza con 'base' toman el pelaje. */
export const MODELOS_EXTERNOS = {};
function registrarModelo(especie, datos) { MODELOS_EXTERNOS[especie] = datos; fotos.clear(); }
const _alSuelo = (p) => [p[0], p[1] + RIG.suelo, p[2]];                               // modelo -> raiz
const _aCabeza = (p) => [p[0], p[1] + RIG.suelo - RIG.cabeza.y, p[2] - RIG.cabeza.z];  // modelo -> cabeza
// 'base_osc25' = pelaje oscurecido 25 %, 'base_claro70' = aclarado 70 % (rayas, panzas que siguen al pelaje)
function tonoBase(nombre, c) {
  const a = /claro(\d+)/i.exec(nombre), o = /osc(\d+)/i.exec(nombre);
  return a ? aclarar(c, a[1] / 100) : o ? oscurecer(c, o[1] / 100) : c;
}
// Modelos V7: la textura trae el color pintado (hocico, boca, rayas...) y en el alfa la máscara de teñido:
// máscara 1 = toma el pelaje del jugador, 0 = conserva su color. El alfa se guarda como 0.2 + 0.8 × máscara
// (el WebP con pérdida borra el color de los píxeles con alfa 0). El material lleva extras {mascara: 1}.
function tenirConMascara(n, t) {
  const tinte = new THREE.Color(t);
  n.color.setHex(0xffffff);
  n.onBeforeCompile = (sh) => {
    sh.uniforms.uTinte = { value: tinte };
    sh.fragmentShader = 'uniform vec3 uTinte;\n' + sh.fragmentShader.replace('#include <map_fragment>',
      '#ifdef USE_MAP\n  vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n' +
      '  float mascara = clamp( ( sampledDiffuseColor.a - 0.2 ) / 0.8, 0.0, 1.0 );\n' +
      '  diffuseColor.rgb *= sampledDiffuseColor.rgb * mix( vec3( 1.0 ), uTinte, mascara );\n#endif');
  };
  n.customProgramCacheKey = () => 'tinte-mascara';
}
function clonRecoloreado(obj, color, llave) {
  const c = obj.clone(true);
  c.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    if (o.geometry) { o.geometry.userData ??= {}; o.geometry.userData.fija = true; }
    const pinta = (m) => {
      if (!/^base/i.test(m?.name || '')) { if (m) cacheMat.set('ext|' + m.uuid, m); return m; }
      const k = 'ext|' + llave + '|' + m.uuid + '|' + color;
      if (!cacheMat.has(k)) {
        const n = m.clone(), t = tonoBase(m.name, color);
        if (m.userData?.mascara && n.map) tenirConMascara(n, t); else n.color?.setHex(t);
        if (n.sheenColor) n.sheenColor.setHex(aclarar(t, 0.6)); cacheMat.set(k, n);
      }
      return cacheMat.get(k);
    };
    o.material = Array.isArray(o.material) ? o.material.map(pinta) : pinta(o.material);
  });
  return c;
}
/* Pelaje de peluche (estilo Party Animals): capas (shells) infladas por la normal, dibujadas con un InstancedMesh
   hijo de cada pieza (gl_InstanceID = capa). Hebras con ruido celular 3D en coordenadas del objeto (sin costuras de
   UV). Largo por material (extras {pelo: k}) × máscara por vértice (COLOR_0.r, 0 = sin pelo: boca, nariz). */
// capas de pelo según el equipo: menos en celulares modestos (el costo es de relleno de pantalla)
const _nucleos = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
export const PELO = { capas: _nucleos <= 4 ? 6 : 10, largo: 0.036, densidad: 46, rim: 0.36 };
function matPelo(base, conMascara) {
  const k = 'pelo|' + base.uuid + '|' + conMascara;
  if (cacheMat.has(k)) return cacheMat.get(k);
  const m = base.clone(), previo = base.onBeforeCompile, factor = base.userData?.pelo ?? 1;
  m.vertexColors = false;
  m.onBeforeCompile = (sh, r) => {
    if (previo) previo(sh, r);
    Object.assign(sh.uniforms, { uLargo: { value: PELO.largo * factor }, uCapas: { value: PELO.capas },
      uDens: { value: PELO.densidad }, uRim: { value: PELO.rim }, uGrav: { value: new THREE.Vector3(0, -0.5, 0) } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        ${conMascara ? 'attribute vec4 color;' : ''}
        uniform float uLargo, uCapas, uDens; uniform vec3 uGrav; varying float vH; varying float vM; varying vec3 vPeloP;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vH = (float(gl_InstanceID) + 1.0) / uCapas;
        vM = ${conMascara ? 'color.r' : '1.0'};
        vPeloP = position * uDens;
        transformed += normalize(objectNormal) * uLargo * vH * vM + uGrav * uLargo * vH * vH * vM;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uRim; varying float vH; varying float vM; varying vec3 vPeloP;
        float hashP(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float hebra(vec3 p) { vec3 c = floor(p), f = fract(p) - 0.5;
          vec3 j = vec3(hashP(c), hashP(c + 13.1), hashP(c + 27.7)) - 0.5; return length(f - j * 0.45); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vM < 0.08) discard;
        float d = min(hebra(vPeloP), hebra(vPeloP * 1.37 + 7.3));
        float grosor = 0.62 * (1.0 - pow(vH, 1.1)) + 0.04;
        if (d > grosor) discard;
        diffuseColor.rgb *= mix(0.72, 1.06, vH);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fresP = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.5);
        totalEmissiveRadiance += diffuseColor.rgb * uRim * fresP * vH;`);
  };
  m.customProgramCacheKey = () => 'pelo|' + conMascara + '|' + (base.customProgramCacheKey?.() || '');
  cacheMat.set(k, m);
  return m;
}
function ponerPelaje(modelo) {
  const mallas = [];
  modelo.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.material?.userData?.pelo) mallas.push(o); });
  for (const o of mallas) {
    const conMascara = !!o.geometry.attributes.color;
    const capas = new THREE.InstancedMesh(o.geometry, matPelo(o.material, conMascara), PELO.capas);
    capas.frustumCulled = false; capas.castShadow = false; capas.name = 'pelo';
    o.add(capas);
  }
  // la máscara de pelo viene en COLOR_0: que no tiña los materiales lisos
  modelo.traverse((o) => { if (o.isMesh && o.geometry.attributes.color) for (const m of [o.material].flat()) if (m?.vertexColors) { m.vertexColors = false; m.needsUpdate = true; } });
}
function armarExterno(op, def, ext) {
  const color = op.color && PELAJES[op.color] !== undefined ? PELAJES[op.color] : (ext.color ?? def.color);
  const raiz = new THREE.Group(), cuerpo = new THREE.Group(); raiz.add(cuerpo);
  const eq = { ...(op.equipo || {}) };
  if (op.accesorio && ACC_A_SLOT[op.accesorio] && !eq[ACC_A_SLOT[op.accesorio]]) eq[ACC_A_SLOT[op.accesorio]] = op.accesorio;
  const sombrero = !!PRENDAS.cabeza[eq.cabeza], E = ext.anclas || {};
  const modelo = clonRecoloreado(ext.cuerpo, color, op.especie); modelo.position.y = RIG.suelo; cuerpo.add(modelo);
  ponerPelaje(modelo);
  // cabA se anima (mirada); cab lleva la inclinacion de pose del modelo (anclas.inclina) con cabeza, ojos y prendas
  const cabA = new THREE.Group(); cabA.position.set(0, RIG.cabeza.y, RIG.cabeza.z); cuerpo.add(cabA);
  const cab = new THREE.Group(); cabA.add(cab);
  const nodoCab = modelo.getObjectByName('cabeza');
  // Una pieza: conservar también hocico, orejas y copetes en la jerarquía original.
  // El marco de la cara y las prendas sigue al mismo cuerpo, sin separar el cuello.
  if (nodoCab && !E.unaPieza) { cuerpo.updateMatrixWorld(true); cab.attach(nodoCab); }
  if (E.inclina && !E.unaPieza) cab.rotation.z = E.inclina;
  if (sombrero) cab.traverse((o) => { if (/^copete/i.test(o.name)) o.visible = false; });
  if (sombrero) modelo.traverse((o) => { if (/^copete/i.test(o.name)) o.visible = false; });
  if (PRENDAS.cuello[eq.cuello] || PRENDAS.torso?.[eq.torso]) modelo.traverse((o) => { if (/^collar/i.test(o.name)) o.visible = false; });
  // anclas al formato interno (marco de cabeza / raiz)
  const A = { ojo: E.ojo ? [_aCabeza(E.ojo[0]), E.ojo[1]] : [[RIG.ojos.sep, RIG.ojos.y, RIG.ojos.z], [0.3, 0, 0.95]],
    mejilla: E.mejilla ? [_aCabeza(E.mejilla[0]), E.mejilla[1]] : null,
    boca: E.boca ? _aCabeza(E.boca) : [0, RIG.boca.y, RIG.boca.z],
    asiento: E.asiento != null ? E.asiento + RIG.suelo - RIG.cabeza.y : undefined };
  const info = infoRig({ anclas: A, info: E.info }); info.especie = op.especie; info.ojoN = A.ojo[1];
  const ojos = new THREE.Group(); ojos.position.y = A.ojo[0][1]; cab.add(ojos);
  const estilo = op.ojos || 'normal';
  if (!E.ojosPropios) for (const s of [-1, 1]) {
    const est0 = estilo === 'normal' && E.ojos ? E.ojos : estilo, est = est0 === (E.ojos || 'normal') && ext.guino && s > 0 ? 'guino' : est0, o = ojo(est, !!def.ojoClaro), [px, , pz] = A.ojo[0], n = [s * A.ojo[1][0], A.ojo[1][1], A.ojo[1][2]];
    const hund = est === 'normal' ? -0.035 : est === 'cuenta' ? 0.025 : est === 'salton' ? 0.04 : 0.012; o.position.set(s * px + n[0] * hund, n[1] * hund, pz + n[2] * hund); orientar(o, n);
    if (E.ojoEsc) o.scale.setScalar(E.ojoEsc);
    if (E.parpadeoIndividual) {
      o.userData.parpadea = ['normal', 'cuenta', 'salton'].includes(est);
      o.userData.escalaYAbierto = o.scale.y;
    }
    ojos.add(o);
  }
  ojos.userData.parpadeoIndividual = !!E.parpadeoIndividual;
  if (A.mejilla) { const geoC = new THREE.PlaneGeometry(0.34, 0.22), matC = new THREE.MeshBasicMaterial({ map: TEX_CACHETE, transparent: true, depthWrite: false, opacity: 0.8 });
    for (const s of [-1, 1]) { const [p, n] = A.mejilla, ch = malla(geoC, matC); ch.castShadow = false; ch.position.set(s * p[0], p[1], p[2] + 0.012); orientar(ch, [s * n[0], n[1], n[2]]); cab.add(ch); } }
  const bocaAbierta = bocaComiendo(A.boca); cab.add(bocaAbierta);
  const H = E.hombro ? _alSuelo(E.hombro) : [RIG.hombro.x, RIG.hombro.y, RIG.hombro.z], brazos = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * H[0], H[1], H[2]);
    const fuente = s < 0 ? ext.brazoI : ext.brazoD;
    if (fuente || ext.brazoD) { const b = clonRecoloreado(fuente || ext.brazoD, color, op.especie); if (!fuente) b.scale.x = -1; ponerPelaje(b); piv.add(b); }
    cuerpo.add(piv); brazos.push(piv);
  }
  raiz.updateMatrixWorld(true);
  // Anclas medidas sobre la espalda real, en vez de colgar ambas alas fuera de un centro genérico.
  const ray = new THREE.Raycaster(), meshes = [];
  (modelo.isMesh ? [modelo] : modelo.children.filter(o => o.isMesh && /^cuerpo/.test(o.name))).forEach(o => meshes.push(o));
  info.alasAnclas = [-1, 1].map(s => {
    const p = new THREE.Vector3(s * 0.30, H[1] - 0.05, -5); cuerpo.localToWorld(p);
    const d = new THREE.Vector3(0, 0, 1).transformDirection(cuerpo.matrixWorld); ray.set(p, d);
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit ? cuerpo.worldToLocal(hit.point.clone()).add(new THREE.Vector3(0, 0, 0.045)).toArray() : [s * 0.30, H[1] - 0.05, info.espaldaZ + 0.10];
  });
  if (E.unaPieza) {
    const cabezaMallas = [...meshes];
    const fuera = (o) => { for (let p = o; p && p !== nodoCab; p = p.parent) if (/^(oreja|copete)/i.test(p.name)) return true; return false; };
    nodoCab?.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !fuera(o)) cabezaMallas.push(o); });
    medirPrendas(info, meshes, cuerpo, cabezaMallas);
    info.remedir = () => medirPrendas(info, meshes, cuerpo, cabezaMallas);   // la playera vuelve a medir sobre la tela
  }
  if (E.unaPieza && SOMBREROS_CON_ALA.has(eq.cabeza)) for (const [nombre, s] of [['orejaI', -1], ['orejaD', 1]]) {
    const o = modelo.getObjectByName(nombre) || cab.getObjectByName(nombre);
    if (o) { o.rotation.z += -s * 1.0; o.scale.multiplyScalar(0.82); }   // salen hacia los lados, bajo el ala
  }
  if (E.alasDeformables) cuerpo.userData.alasModelo = prepararAlasModelo(modelo, cuerpo, brazos, E.alaPuntaX ?? 1.06);
  if (E.saludoAngulo != null) cuerpo.userData.saludoAngulo = E.saludoAngulo;
  info.ropa = { cuerpo, meshes, brazos, encima: !!(eq.cuello || eq.espalda) };   // la playera (torso) sale del cuerpo y brazos reales; va primero
  for (const slot of ['torso', 'cabeza', 'cara', 'cuello', 'espalda']) {
    const f = PRENDAS[slot]?.[eq[slot]];
    if (f) { const p = aplicarAcabado(f(info), op.acabados?.[slot]); (slot === 'cabeza' || slot === 'cara' ? cab : cuerpo).add(p); Object.assign(cuerpo.userData, p.userData); p.userData.prendaSlot = slot; }
  }
  Object.assign(cuerpo.userData, cab.userData);
  cuerpo.userData.bocaY = RIG.cabeza.y + A.boca[1]; cuerpo.userData.bocaZ = RIG.cabeza.z + A.boca[2];
  cuerpo.userData.cab = E.unaPieza ? null : cabA;   // V8: cabeza y cuerpo son una sola malla: la cabeza no gira aparte
  crecerYBrillar(raiz, op);
  return { raiz, cuerpo, ojos, boca: null, bocaAbierta, brazos, mandibula: null, foco: null, ud: cuerpo.userData, estiloOjos: estilo };
}
// Mascotas V8 (pera de una pieza): bufanda, collar, paliacate, corbata, moño y mochila se acomodan sobre la
// superficie REAL del cuerpo (rayos), no con medidas genéricas: el cuello es ovalado y el pecho está más adelante.
function medirPrendas(info, meshes, cuerpo, cabezaMallas = meshes) {
  const ray = new THREE.Raycaster();
  const tiro = (o, d, lista = meshes) => {
    const p = new THREE.Vector3(...o); cuerpo.localToWorld(p);
    ray.set(p, new THREE.Vector3(...d).transformDirection(cuerpo.matrixWorld));
    const h = ray.intersectObjects(lista, false)[0];
    return h ? cuerpo.worldToLocal(h.point.clone()) : null;
  };
  // cabeza (marco de la cabeza: y - RIG.cabeza.y): coronilla, ancho donde asienta el sombrero y altura de las orejas
  const yc = RIG.cabeza.y, arriba = tiro([0, 6, 0], [0, -1, 0], cabezaMallas);
  if (arriba) {
    // ancho: el mayor entre el cráneo (cuerpo) y la cabeza (tuerca de Tuerquín); la melena no lo achica
    // salientes (branquias, perillas, tornillos, cuerno) no cuentan para el ancho del sombrero: atraviesan por ojal
    const cima = arriba.y - yc, anchoEn = (y) => { const a = tiro([5, y + yc, 0], [-1, 0, 0]), b = tiro([5, y + yc, 0], [-1, 0, 0], cabezaMallas);
      const v = Math.max(a ? a.x : 0, b ? b.x : 0); return v || null; };
    // coronilla del cráneo (sin melena ni tuerca) para medir el ancho real; el asiento queda sobre lo que haya encima
    const craneo = tiro([0, 6, 0], [0, -1, 0]), cimaCraneo = craneo ? craneo.y - yc : cima;
    const asiento = Math.max(cimaCraneo - 0.24, cima - 0.3);   // abarca la parte alta de la cabeza (no encaramado)
    info.cima = cima;
    info.asiento = asiento + 0.05;                       // sombreroEn le resta 0.05
    info.ancho = Math.max(0.4, (anchoEn(Math.min(asiento, cimaCraneo - 0.24)) ?? 0.48) * 1.06 + 0.04);   // + margen para el pelo
    const yAud = cima - 0.5, wAud = (anchoEn(yAud) ?? 0.55) + 0.1;
    info.audifonos = { y: cima + 0.07 - wAud, w: wAud };   // la diadema toca la coronilla; bocinas a los lados
  }
  // superficie de la cara vista de frente, en el marco de la cabeza: { z, n } (normal hacia afuera) en (x, y)
  const _n = new THREE.Matrix3();
  info.cara = (x, y, dy = 0) => {
    const d = new THREE.Vector3(0, -dy, -1).normalize(), p = new THREE.Vector3(x, y + yc + dy * 5, 5); cuerpo.localToWorld(p);
    ray.set(p, d.transformDirection(cuerpo.matrixWorld));
    const h = ray.intersectObjects(cabezaMallas, false)[0];
    if (!h) return null;
    const q = cuerpo.worldToLocal(h.point.clone()), n = h.face.normal.clone().applyMatrix3(_n.getNormalMatrix(h.object.matrixWorld)).transformDirection(cuerpo.matrixWorld.clone().invert());
    if (n.z < 0) n.negate();
    return { x: q.x, y: q.y - yc, z: q.z, n };
  };
  // cráneo: punto de la piel en la altura y (marco de cabeza) llegando horizontal desde el ángulo a (0 = frente, +pi/2 = +x)
  info.craneo = (y, a, off = 0) => {
    const p = new THREE.Vector3(Math.sin(a) * 5, y + yc, Math.cos(a) * 5); cuerpo.localToWorld(p);
    ray.set(p, new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)).transformDirection(cuerpo.matrixWorld));
    const h = ray.intersectObjects(cabezaMallas, false)[0];
    if (!h) return null;
    const q = cuerpo.worldToLocal(h.point.clone()); q.y -= yc;
    return q.add(new THREE.Vector3(Math.sin(a) * off, 0, Math.cos(a) * off));
  };
  // casquete: rayo desde 'o' en dirección 'd' (marco de cabeza) contra el cráneo sin salientes ni crin -> punto de piel
  const craneoMallas = cabezaMallas.filter((o) => !/cuerno|cresta|branquia|perilla|tornillo|crin/i.test([o.material].flat()[0]?.name || ''));
  info.cascaron = (o, d) => {
    const p = new THREE.Vector3(o[0], o[1] + yc, o[2]); cuerpo.localToWorld(p);
    ray.set(p, new THREE.Vector3(...d).normalize().transformDirection(cuerpo.matrixWorld));
    const h = ray.intersectObjects(craneoMallas, false)[0];
    if (!h) return null;
    const q = cuerpo.worldToLocal(h.point.clone()); q.y -= yc; return q;
  };
  // mallas de la parte alta de la cabeza en el marco de la cabeza (se leen al armar la prenda, ya con orejas
  // dobladas y copetes ocultos): para ajustar domos y abrir ojales donde salen orejas, cuerno o aleta.
  // tipo: 'oreja' | 'cuerno' (cuerno, cresta) | 'cuerpo'. La crin no cuenta (se acomoda bajo la tela).
  const modelo = meshes[0] ? (meshes[0].parent !== cuerpo ? meshes[0].parent : meshes[0]) : null;
  let _mc = null;
  info.mallasCabeza = () => {
    if (_mc || !modelo) return _mc || [];
    cuerpo.updateMatrixWorld(true); _mc = [];
    const inv = cuerpo.matrixWorld.clone().invert(), v = new THREE.Vector3(), ymin = (info.cima ?? 0.7) - 0.75;
    modelo.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh) return;
      let tipo = 'cuerpo', nodo = null;
      for (let p = o; p && p !== cuerpo; p = p.parent) { if (!p.visible || /^(brazo|ala|collar)/i.test(p.name)) return; if (/^oreja/i.test(p.name)) { tipo = 'oreja'; nodo = p; } }
      const mat = [o.material].flat()[0]?.name || '';
      if (/crin/i.test(mat)) { tipo = 'crin'; nodo = o; }                                  // melena: se guarda o asoma
      if (/cuerno|cresta|branquia|perilla|tornillo/i.test(mat)) { tipo = 'cuerno'; if (/cuerno/i.test(mat)) nodo = o; }   // salientes: no agrandan el sombrero
      const pa = o.geometry.attributes.position, m = inv.clone().multiply(o.matrixWorld), pos = new Float32Array(pa.count * 3);
      let alto = false;
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(m); v.y -= yc; pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; if (v.y > ymin) alto = true; }
      if (alto) _mc.push({ pos, idx: o.geometry.index ? o.geometry.index.array : null, n: pa.count, tipo, nodo });
    });
    return _mc;
  };
  // superficie del frente (lado 1) o de la espalda (lado -1) en (x, y): z en el marco del cuerpo
  info.sup = (x, y, lado = 1) => { const h = tiro([x, y, lado * 5], [0, 0, -lado]); return h ? h.z : null; };
  const y = info.cuelloY, fz = info.sup(0, y, 1), bz = info.sup(0, y, -1), sx = tiro([5, y, (fz + bz) / 2 || 0], [-1, 0, 0]);
  if (fz == null || bz == null || !sx) return;
  info.cuelloZc = (fz + bz) / 2;
  info.cuelloRz = (fz - bz) / 2 + 0.03;
  info.cuelloRx = sx.x + 0.03;
  info.pechoY = y - 0.12;
  info.pechoZ = info.sup(0, info.pechoY, 1) ?? info.pechoZ;
  info.espaldaY = y - 0.42;
  info.espaldaZ = info.sup(0, info.espaldaY, -1) ?? info.espaldaZ;
  info.espaldaAltaY = y - 0.32;   // omóplatos: ahí van mochila, cohete y bolsas (V8.2: centrada en la espalda alta)
  // proyección radial (horizontal, desde el eje del cuerpo) sobre la superficie: para correas y capa que abrazan
  // el cuerpo real. Devuelve la distancia al eje en esa altura y ángulo (o null si el rayo no toca).
  const zc = info.cuelloZc;
  info.radio = (y, a) => {
    const d = [Math.sin(a), 0, -Math.cos(a)], h = tiro([d[0] * 5, y, zc + d[2] * 5], [-d[0], 0, -d[2]]);
    return h ? Math.hypot(h.x, h.z - zc) : null;
  };
  // punto (x, y, lado) -> punto sobre la piel + 'off' hacia afuera; lado -1 espalda, 0 costado, 1 frente
  info.pegar = (x, y, lado, off = 0.035) => {
    const a = Math.atan2(x, -lado * 0.6 - 1e-6), r = info.radio(y, a);
    return r == null ? null : new THREE.Vector3(Math.sin(a) * (r + off), y, zc - Math.cos(a) * (r + off));
  };
  info.zc = zc;
}
// correas de mochila (compartidas: mochila, cohete y bolsas): cada correa sale de lo alto de la bolsa en la espalda,
// pasa POR ENCIMA del hombro, baja un tramo corto por el frente del hombro y regresa POR DEBAJO de la axila a la
// esquina de abajo de la bolsa. Sin cinturón ni correa de pecho: de frente solo se ven dos correas cortas sobre los
// hombros. Cinta plana pegada a la piel (proyección radial). En el marco del cuerpo.
// cuello corto / cabeza grande (o pétalos en el cuello): la cresta del hombro no se mete bajo la cabeza
const CRESTA_BAJA = { capibara: 0.06, mapache: 0.06, panda: 0.06, tiburon: 0.06, pintura: 0.08 };
function correasPegadas(c, yArriba, yAbajo, mat, grueso = 0.042) {
  const g = new THREE.Group(), w = grueso * 1.25, h = grueso * 0.42, off = h + 0.022;   // cinta plana encima del pelo
  // ySob = la axila: la correa regresa JUSTO bajo el brazo (queda escondida) y de ahí baja en DIAGONAL a la esquina de la
  // bolsa. Antes regresaba más abajo dando la vuelta horizontal al costado y de perfil se leía como cinturón (8-oct).
  const yH = c.cuelloY + 0.03, ySob = Math.max(yH - 0.30, yAbajo + 0.12), cresta = yH + (CRESTA_BAJA[c.especie] ?? 0.12);
  // ángulo desde la espalda (0) hacia el frente (pi) por el lado s
  const enA = (s, a, y) => { const r = c.radio(y, s * a); return r == null ? null : new THREE.Vector3(Math.sin(s * a) * (r + off), y, c.zc - Math.cos(s * a) * (r + off)); };
  for (const s of [-1, 1]) {
    // dos tramos que se esconden en la raíz del brazo (personajes frijol: el brazo tapa la axila): el de arriba pasa
    // por encima del hombro y baja por el pecho hasta el FRENTE del brazo; el de abajo sube en diagonal desde la esquina
    // de abajo de la bolsa hasta ATRÁS del brazo. Ningún tramo rodea el costado: de perfil no hay "cinturón".
    const tramos = [[[0.3, yArriba], [0.7, yH + 0.05], [1.35, cresta], [2.25, yH + 0.02], [2.5, yH - 0.16], [2.05, ySob + 0.04]],
      [[0.42, yAbajo], [0.85, yAbajo + (ySob - yAbajo) * 0.45], [1.3, ySob - 0.01]]];
    for (const tr of tramos) {
      const ctrl = tr.map(([a, y]) => enA(s, a, y)).filter(Boolean);
      if (ctrl.length < 3) continue;
      // se pega a la piel con pocos puntos (cada uno es un rayo, caro) y luego se suaviza para la cinta
      const pegados = pegarCurva(c, new THREE.CatmullRomCurve3(ctrl).getPoints(14), off);
      g.add(malla(cintaGeo(new THREE.CatmullRomCurve3(pegados).getPoints(56), c, w, h), mat));
    }
    const aj = enA(s, 2.62, yH - 0.24);   // pasador de ajuste en el frente del hombro
    if (aj) { aj.addScaledVector(new THREE.Vector3(aj.x, 0, aj.z - c.zc).normalize(), h); const p = malla(cajaR(w * 2.3, 0.05, 0.025, 0.01, 2), metal(0xffcf3f), { pos: aj.toArray() }); p.rotation.y = Math.atan2(aj.x, aj.z - c.zc); g.add(p); }
  }
  return g;
}
// re-pega cada punto de una curva a la piel (proyección radial desde el eje del cuerpo) con un despegue
function pegarCurva(c, pts, off) {
  return pts.map((p) => {
    const a = Math.atan2(p.x, -(p.z - c.zc)), r = c.radio(p.y, a);
    return r == null ? p : new THREE.Vector3(Math.sin(a) * (r + off), p.y, c.zc - Math.cos(a) * (r + off));
  });
}
// cinta plana (correa) a lo largo de pts: ancho w tangente a la piel, grosor h hacia afuera, esquinas redondeadas
function cintaGeo(pts, c, w, h, R = 10) {
  const n = pts.length, pos = new Float32Array(n * R * 3), idx = [], t = new THREE.Vector3(), nn = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    t.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    nn.set(pts[i].x, 0, pts[i].z - c.zc).normalize(); nn.addScaledVector(t, -nn.dot(t)).normalize(); b.crossVectors(t, nn).normalize();
    for (let k = 0; k < R; k++) {
      const th = (k / R) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
      const u = Math.sign(cs) * Math.pow(Math.abs(cs), 0.45) * w, v = Math.sign(sn) * Math.pow(Math.abs(sn), 0.45) * h;
      pos.set([pts[i].x + b.x * u + nn.x * v, pts[i].y + b.y * u + nn.y * v, pts[i].z + b.z * u + nn.z * v], (i * R + k) * 3);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < R; k++) { const a = i * R + k, a2 = i * R + (k + 1) % R; idx.push(a, a + R, a2, a2, a + R, a2 + R); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// coloca una pieza en la espalda alta, recargada e inclinada como la espalda real
function enEspaldaAlta(c, pieza, alto, separa, dy = 0) {
  const y = c.espaldaAltaY + dy, zMid = c.sup(0, y, -1), zA = c.sup(0, y + alto / 2, -1), zB = c.sup(0, y - alto / 2, -1);
  pieza.position.set(0, y, (zMid ?? c.espaldaZ) - separa);
  if (zA != null && zB != null) pieza.rotation.x = Math.atan2(zA - zB, alto);
  return pieza;
}
// escala de un aro (toro en XY girado a XZ) para que abrace un cuello ovalado
const aroEsc = (c, grueso) => [(c.cuelloRx ?? c.cuelloR) / c.cuelloR, (c.cuelloRz ?? c.cuelloR) / c.cuelloR, grueso];
/* ============================================================ TORSO: playera DevEyes (uniforme de DE)
   La playera es un CASCARÓN sacado del cuerpo real de cada mascota (no una pieza genérica): se corta el cuerpo en
   rebanadas horizontales y, en cada una, rayos desde el eje hacia afuera (el primer cruce = la piel) dan el radio en una
   rejilla ángulo × altura; se recortan los bultos que no son torso (cola, aletas, quijada) y se infla por la normal.
   Las mangas salen igual alrededor del eje de cada brazo y cuelgan de su pivote (se mueven con él). El pelo bajo la
   tela se apaga en la máscara COLOR_0 (copia de la geometría). Logos, botones y cartera son calcas muestreadas sobre
   el mismo cascarón: quedan pegadas al pecho, sin flotar. Todo es geometría 2D por rebanada: unos ms por mascota. */
// corte: altura del cambio naranja/marino (fracción del cuello a la bastilla); escote: altura del escote sobre cuelloY
const CAMISA = { naranja: 0xf26a1b, puno: 0xd2520c, marino: 0x1e2433, holgura: 0.026, holguraManga: 0.018, corte: 0.44, largo: 0.68,
  escoteFrente: 0.02, escoteAtras: 0.17, hombro: 0.06, ve: 0.06 };
const _V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// triángulos de las mallas en el marco 'marco' (9 números por triángulo)
function triangulosEn(marco, mallas) {
  marco.updateMatrixWorld(true);
  const inv = marco.matrixWorld.clone().invert(), out = [], v = _V();
  for (const o of mallas) {
    const m = inv.clone().multiply(o.matrixWorld), pa = o.geometry.attributes.position, ix = o.geometry.index, P = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(m); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
    const n = ix ? ix.count : pa.count;
    for (let t = 0; t < n; t++) { const k = (ix ? ix.getX(t) : t) * 3; out.push(P[k], P[k + 1], P[k + 2]); }
  }
  return Float32Array.from(out);
}
// corta los triángulos con el plano (o, w) y lanza rayos 2D desde o: distancia al primer cruce en cada dirección
// dirs[k] = [c1, c2] en la base (e1, e2) del plano. NaN si no cruza nada.
function radiosSeccion(tris, o, w, e1, e2, dirs) {
  const segs = [], d = [0, 0, 0], px = [0, 0, 0], py = [0, 0, 0];
  for (let t = 0; t < tris.length; t += 9) {
    let pos = 0, neg = 0;
    for (let k = 0; k < 3; k++) {
      const x = tris[t + k * 3] - o.x, y = tris[t + k * 3 + 1] - o.y, z = tris[t + k * 3 + 2] - o.z;
      d[k] = x * w.x + y * w.y + z * w.z; px[k] = x * e1.x + y * e1.y + z * e1.z; py[k] = x * e2.x + y * e2.y + z * e2.z;
      if (d[k] > 0) pos++; else neg++;
    }
    if (!pos || !neg) continue;
    const s = [];
    for (let k = 0; k < 3; k++) {
      const a = k, b = (k + 1) % 3;
      if ((d[a] > 0) !== (d[b] > 0)) { const f = d[a] / (d[a] - d[b]); s.push(px[a] + (px[b] - px[a]) * f, py[a] + (py[b] - py[a]) * f); }
    }
    if (s.length === 4) segs.push(s);
  }
  return dirs.map(([dx, dy]) => {
    let mejor = Infinity;
    for (const [x1, y1, x2, y2] of segs) {
      const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const tt = (x1 * ey - y1 * ex) / den, ss = (x1 * dy - y1 * dx) / den;
      if (tt > 1e-4 && ss >= 0 && ss <= 1 && tt < mejor) mejor = tt;
    }
    return mejor === Infinity ? NaN : mejor;
  });
}
function lienzo(llave, w, h, dibujar) {
  if (_texCache[llave]) return _texCache[llave];
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; dibujar(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; TEXTURAS_FIJAS.add(t);
  return (_texCache[llave] = t);
}
function matCamisa(llave, crear) { const k = 'camisa|' + llave; if (!cacheMat.has(k)) cacheMat.set(k, crear()); return cacheMat.get(k); }
const TELA_PLAYERA = { roughness: 0.86, metalness: 0, sheen: 0.7, sheenRoughness: 0.55, clearcoat: 0 };
// piqué: naranja arriba, marino abajo (corte recto), con puntitos de tejido. v = 1 arriba (cuello)
function texPlayera() {
  return lienzo('playera', 512, 512, (x, w, h) => {
    const corte = Math.round(h * 0.5);   // v = 0.5: la altura del corte se fija con la UV (ver playeraSobre)
    x.fillStyle = '#f26a1b'; x.fillRect(0, 0, w, corte); x.fillStyle = '#1e2433'; x.fillRect(0, corte, w, h - corte);
    const r = azar(7);
    for (let i = 0; i < 9000; i++) { const px = r() * w, py = r() * h; x.fillStyle = i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'; x.fillRect(px, py, 2, 2); }
    x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(0, corte - 2, w, 3);   // costura del corte
  });
}
// mezclilla: azul índigo con sarga diagonal y motas claras (el pespunte de la bastilla es geometría)
function texMezclilla() {
  const t = !_texCache['mezclilla'], tex = lienzo('mezclilla', 512, 512, (x, w, h) => {
    x.fillStyle = '#2f3a52'; x.fillRect(0, 0, w, h);
    x.lineWidth = 1.5;
    for (let i = -h; i < w; i += 5) { x.strokeStyle = i % 10 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.10)'; x.beginPath(); x.moveTo(i, h); x.lineTo(i + h, 0); x.stroke(); }
    const r = azar(11);
    for (let i = 0; i < 7000; i++) { const px = r() * w, py = r() * h; x.fillStyle = i % 3 ? 'rgba(170,190,225,.09)' : 'rgba(10,15,30,.12)'; x.fillRect(px, py, 2 + r() * 3, 1.5); }
  });
  if (t) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.needsUpdate = true; }
  return tex;
}
const matPlayera = (est = ESTILOS_CAMISA.deveyes) => matCamisa('cuerpo|' + est.clave, () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: est.tex(), side: THREE.DoubleSide, sheenColor: new THREE.Color(est.brillo), ...TELA_PLAYERA }));
const matTela = (c, lado = THREE.FrontSide) => matCamisa('tela' + c + '|' + lado, () => new THREE.MeshPhysicalMaterial({ color: c, side: lado, sheenColor: new THREE.Color(aclarar(c, 0.45)), ...TELA_PLAYERA }));
function matCalca(llave, tex) {
  return matCamisa('calca|' + llave, () => new THREE.MeshPhysicalMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.8, sheen: 0.3,
    sheenRoughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
}
// ícono real de DevEyes (cuchara de albañil + casita + techo), blanco con alfa: web/./img/web-dev-eyes.svg
const ICONO_DEVEYES = (() => { if (typeof Image === 'undefined') return null; const im = new Image(); im.src = new URL('./img/web-dev-eyes.svg', import.meta.url).href; return im; })();
// dibuja el ícono centrado en cx, de 'alto' px y sin deformar; color = teñido (source-in) o null = blanco como viene
function iconoDevEyes(x, cx, y, alto, color, sombra) {
  const im = ICONO_DEVEYES; if (!im?.complete || !im.naturalWidth) return;
  const w = alto * im.naturalWidth / im.naturalHeight, tinta = (c) => {
    const t = document.createElement('canvas'); t.width = Math.ceil(w); t.height = Math.ceil(alto);
    const k = t.getContext('2d'); k.drawImage(im, 0, 0, w, alto); k.globalCompositeOperation = 'source-in'; k.fillStyle = c; k.fillRect(0, 0, w, alto); return t;
  };
  if (sombra) x.drawImage(tinta(sombra), cx - w / 2 + 3, y + 3);
  x.drawImage(color ? tinta(color) : im, cx - w / 2, y, w, alto);
}
// textura con el ícono: si la imagen aún no carga, se vuelve a dibujar al cargar (y se borran las miniaturas viejas)
function lienzoConIcono(llave, w, h, dibujar) {
  const nuevo = !_texCache[llave], t = lienzo(llave, w, h, dibujar), im = ICONO_DEVEYES;
  if (nuevo && im && !(im.complete && im.naturalWidth)) im.addEventListener('load', () => {
    const x = t.image.getContext('2d'); x.clearRect(0, 0, w, h); dibujar(x, w, h); t.needsUpdate = true; fotos.clear();
  });
  return t;
}
// logo DevEyes de la polo: ícono blanco arriba (tan alto como las letras) y la palabra en blanco, cursiva y gruesa
function texDevEyes() {
  return lienzoConIcono('logo-deveyes', 512, 224, (x, w) => {
    x.lineJoin = 'round';
    iconoDevEyes(x, w * 0.5, 0, 108, null, 'rgba(122,42,5,.8)');
    x.font = 'italic 900 96px "Arial Black", "Segoe UI Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.lineWidth = 12; x.strokeStyle = 'rgba(122,42,5,.85)'; x.strokeText('DevEyes', w / 2 + 3, 182, w - 16);
    x.fillStyle = '#ffffff'; x.fillText('DevEyes', w / 2, 178, w - 16);
    x.fillRect(w * 0.16, 196, w * 0.68, 9);
  });
}
// parche "WEB DEV-EYES": recuadro blanco con letras en cursiva y la leyenda chica abajo
function texConstruGanas() {
  return lienzo('logo-construganas', 384, 320, (x, w) => {
    x.lineJoin = 'round'; x.strokeStyle = '#ffffff'; x.lineWidth = 12;
    x.beginPath(); rectR(x, 34, 12, w - 68, 186, 22); x.stroke();
    x.fillStyle = '#ffffff'; x.font = 'italic 900 70px "Arial Black", "Segoe UI Black", Arial, sans-serif'; x.textAlign = 'center';
    x.fillText('CONSTRU', w / 2, 96, w - 100); x.fillText('GANAS', w / 2, 172, w - 100);
    x.font = 'italic 700 34px Arial, sans-serif'; x.fillText('¡Solicita tu monedero', w / 2, 252, w - 20); x.fillText('y empieza a ganar!', w / 2, 296, w - 20);
  });
}
function texCartera() {
  return lienzo('cartera', 64, 256, (x, w, h) => {
    x.fillStyle = '#ea6418'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(150,50,0,.55)'; x.lineWidth = 4; x.strokeRect(2, -4, w - 4, h + 2);
    x.strokeStyle = 'rgba(255,214,180,.8)'; x.lineWidth = 2; x.setLineDash([7, 6]);
    for (const px of [10, w - 10]) { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h - 8); x.stroke(); }
    x.beginPath(); x.moveTo(10, h - 9); x.lineTo(w - 10, h - 9); x.stroke();
  });
}
// logos bordados de la camisa de mezclilla: palabra blanca con subrayado naranja; parche naranja relleno
function texDevEyesMezclilla() {
  return lienzoConIcono('logo-deveyes-mezclilla', 512, 224, (x, w) => {
    x.lineJoin = 'round';
    iconoDevEyes(x, w * 0.5, 0, 108, '#f26a1b', 'rgba(10,14,28,.6)');   // en la mezclilla el ícono va naranja
    x.font = 'italic 900 96px "Arial Black", "Segoe UI Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.lineWidth = 10; x.strokeStyle = 'rgba(10,14,28,.6)'; x.strokeText('DevEyes', w / 2 + 3, 182, w - 16);
    x.fillStyle = '#ffffff'; x.fillText('DevEyes', w / 2, 178, w - 16);
    x.fillStyle = '#f26a1b'; x.fillRect(w * 0.12, 194, w * 0.76, 12);
  });
}
function texConstruGanasMezclilla() {
  return lienzo('logo-construganas-mezclilla', 384, 320, (x, w) => {
    x.lineJoin = 'round'; x.fillStyle = '#f26a1b'; x.beginPath(); rectR(x, 30, 10, w - 60, 190, 18); x.fill();
    x.strokeStyle = '#ffffff'; x.lineWidth = 7; x.beginPath(); rectR(x, 48, 26, w - 96, 158, 12); x.stroke();
    x.fillStyle = '#ffffff'; x.font = 'italic 900 64px "Arial Black", "Segoe UI Black", Arial, sans-serif'; x.textAlign = 'center';
    x.fillText('CONSTRU', w / 2, 96, w - 120); x.fillText('GANAS', w / 2, 166, w - 120);
    x.font = 'italic 700 34px Arial, sans-serif'; x.fillText('¡Solicita tu monedero', w / 2, 252, w - 20); x.fillText('y empieza a ganar!', w / 2, 296, w - 20);
  });
}
// tapeta de botones ocultos: tira de mezclilla con dos pespuntes claros
function texTapeta() {
  return lienzo('tapeta-mezclilla', 64, 512, (x, w, h) => {
    x.fillStyle = 'rgba(40,50,72,1)'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(10,14,26,.6)'; x.lineWidth = 4; x.strokeRect(1, -4, w - 2, h + 8);
    x.strokeStyle = 'rgba(214,200,170,.4)'; x.lineWidth = 2.5; x.setLineDash([9, 7]);
    for (const px of [11, w - 11]) { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h); x.stroke(); }
  });
}
// bolsa de pecho con pespunte y la orilla doblada arriba
function texBolsa() {
  return lienzo('bolsa-mezclilla', 256, 288, (x, w, h) => {
    x.fillStyle = '#34405a'; x.beginPath(); x.moveTo(8, 8); x.lineTo(w - 8, 8); x.lineTo(w - 8, h - 40); x.lineTo(w / 2, h - 8); x.lineTo(8, h - 40); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(8,12,24,.7)'; x.lineWidth = 6; x.stroke();
    x.strokeStyle = 'rgba(214,200,170,.85)'; x.lineWidth = 3.5; x.setLineDash([12, 8]);
    x.beginPath(); x.moveTo(22, 22); x.lineTo(w - 22, 22); x.lineTo(w - 22, h - 48); x.lineTo(w / 2, h - 24); x.lineTo(22, h - 48); x.closePath(); x.stroke();
    x.beginPath(); x.moveTo(22, 70); x.lineTo(w - 22, 70); x.stroke();
    x.setLineDash([]); x.strokeStyle = 'rgba(8,12,24,.45)'; x.lineWidth = 4; x.beginPath(); x.moveTo(12, 60); x.lineTo(w - 12, 60); x.stroke();
  });
}
const _mediana = (a) => { const s = Float32Array.from(a).sort(); return s[s.length >> 1]; };
// cascarón del torso: R[j][i] = radio de la piel en (ángulo i, altura j) medido desde el eje (0, y, zc)
function cascaronTorso(trisTodos, yTop, yBajo, zc, yArriba) {
  const NU = 96, dy = (yTop - yBajo) / 32, NV = Math.round((yArriba - yBajo) / dy) + 1, R = [], ven = new Float32Array(23);
  const banda = [];   // solo los triángulos que cruzan la banda de la playera
  for (let t = 0; t < trisTodos.length; t += 9) {
    const a = trisTodos[t + 1], b = trisTodos[t + 4], c = trisTodos[t + 7];
    if (Math.max(a, b, c) >= yBajo - dy && Math.min(a, b, c) <= yArriba + dy) for (let k = 0; k < 9; k++) banda.push(trisTodos[t + k]);
  }
  const tris = Float32Array.from(banda);
  const dirs = Array.from({ length: NU }, (_, i) => { const a = -Math.PI + 2 * Math.PI * i / NU; return [Math.sin(a), Math.cos(a)]; });
  const X = _V(1, 0, 0), Y = _V(0, 1, 0), Z = _V(0, 0, 1);
  for (let j = 0; j < NV; j++) {
    const fila = Float32Array.from(radiosSeccion(tris, _V(0, yBajo + dy * j, zc), Y, X, Z, dirs));
    const base = _mediana(fila.filter(Number.isFinite)) || (j ? _mediana(R[j - 1]) : 0.6);
    for (let i = 0; i < NU; i++) if (!Number.isFinite(fila[i])) fila[i] = base;
    // bultos que no son torso (cola, aleta, cresta): más lejos que la mediana de sus vecinos -> se van
    for (let it = 0, W = 11; it < 2; it++) {
      const m = Array.from(fila, (_, i) => { for (let k = 0; k <= 2 * W; k++) ven[k] = fila[(i - W + k + NU) % NU]; return Float32Array.from(ven).sort()[W]; });
      for (let i = 0; i < NU; i++) if (fila[i] > m[i] + Math.max(0.02, m[i] * 0.04)) fila[i] = m[i];
    }
    R.push(fila);
  }
  // de abajo hacia arriba: la quijada que sobresale bajo la barbilla no jala la tela
  for (let j = 1; j < NV; j++) for (let i = 0; i < NU; i++) R[j][i] = Math.min(R[j][i], R[j - 1][i] + dy * 1.1);
  // de la parte más ancha hacia abajo la tela cae casi vertical (no se mete bajo la panza)
  for (let j = NV - 2; j >= 0; j--) for (let i = 0; i < NU; i++) if (yBajo + dy * j < yTop - (yTop - yBajo) * 0.35) R[j][i] = Math.max(R[j][i], R[j + 1][i] * 0.99);
  for (let pase = 0; pase < 2; pase++) {   // suavizado ligero (circular en el ángulo)
    const S = R.map((f) => Float32Array.from(f));
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const jm = Math.max(0, j - 1), jM = Math.min(NV - 1, j + 1), im = (i + NU - 1) % NU, iM = (i + 1) % NU;
      R[j][i] = (S[j][i] * 4 + S[j][im] + S[j][iM] + S[jm][i] + S[jM][i]) / 8;
    }
  }
  const P = [], N = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const [s, c] = dirs[i]; P.push(_V(s * R[j][i], yBajo + dy * j, zc + c * R[j][i])); }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const ta = P[j * NU + (i + 1) % NU].clone().sub(P[j * NU + (i + NU - 1) % NU]);
    const ty = P[Math.min(NV - 1, j + 1) * NU + i].clone().sub(P[Math.max(0, j - 1) * NU + i]);
    N.push(ta.cross(ty).normalize());
  }
  // muestra bilineal: punto de la piel (+ off por la normal) en (ángulo, altura)
  const muestra = (a, y, off = 0) => {
    let fi = ((a + Math.PI) / (2 * Math.PI)) * NU; fi = ((fi % NU) + NU) % NU;
    const fj = (y - yBajo) / dy, i0 = Math.floor(fi), i1 = (i0 + 1) % NU, j0 = THREE.MathUtils.clamp(Math.floor(fj), 0, NV - 2), tu = fi - i0, tv = fj - j0;
    const mez = (L) => L[j0 * NU + i0].clone().multiplyScalar((1 - tu) * (1 - tv)).addScaledVector(L[j0 * NU + i1], tu * (1 - tv))
      .addScaledVector(L[(j0 + 1) * NU + i0], (1 - tu) * tv).addScaledVector(L[(j0 + 1) * NU + i1], tu * tv);
    const n = mez(N).normalize(), p = mez(P);
    return { p: p.addScaledVector(n, off), n };
  };
  const radio = (a, y) => { const { p } = muestra(a, y); return Math.hypot(p.x, p.z - zc); };
  return { NU, yTop, yBajo, zc, muestra, radio };
}
// tira de superficie sobre el cascarón: f(u, v) -> {a, y, off}; u/v de 0 a 1
function tiraSobre(T, nu, nv, f, mat) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const q = f(i / nu, j / nv), { p, n } = T.muestra(q.a, q.y, q.off);
    pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(q.u ?? i / nu, q.v ?? j / nv);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
}
// calca plana de ancho × alto (unidades del mundo) centrada en (a0, y0)
function calcaSobre(T, a0, y0, ancho, alto, off, mat) {
  const r = T.radio(a0, y0) + off;
  const m = tiraSobre(T, 14, 8, (u, v) => ({ a: a0 + (u - 0.5) * ancho / r, y: y0 + (v - 0.5) * alto, off }), mat);
  m.castShadow = false; m.renderOrder = 2; return m;
}
// apaga el pelo de los vértices tapados por la tela (copia la geometría: la original la comparten las demás mascotas)
function sinPeloBajoTela(malla, tapa) {
  const capas = malla.children.find((o) => o.name === 'pelo');
  if (!capas || !malla.geometry.attributes.color) return false;
  const g = malla.geometry.clone(); g.userData = { fija: false };
  const col = g.attributes.color, pos = g.attributes.position, v = _V();
  for (let i = 0; i < pos.count; i++) if (tapa(v.fromBufferAttribute(pos, i))) col.setX(i, 0);
  col.needsUpdate = true; malla.geometry = g; capas.geometry = g; return true;
}
const _tieneMat = (o, re) => [o.material].flat().some((m) => re.test(m?.name || ''));
// manga corta (en el marco del pivote del hombro): es la PIEL DEL BRAZO inflada por su normal y cortada con un plano
// perpendicular al brazo. Así abraza cualquier brazo (patita, aleta plana, ala de murciélago) sin aire ni aros, nace
// dentro del torso (la raíz del brazo está metida en el cuerpo) y se mueve con el pivote. El dobladillo se pinta con
// color por vértice en la orilla (y pespunte claro en la mezclilla). En aletas planas es una manga casquillo corta.
// afuera(p) -> distancia radial de p (marco del pivote) a la piel del torso (> 0 = fuera del cuerpo)
const _NO_BRAZO = /mango|casquillo|cerdas|herramienta/i;
const mallasBrazo = (piv) => { const l = []; piv.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.name !== 'pelo' && o.parent?.name !== 'manga' && !_tieneMat(o, _NO_BRAZO)) l.push(o); }); return l; };
function matManga(est) {
  return matCamisa('manga|' + est.clave, () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: (est.texManga || est.tex)(), vertexColors: true, side: THREE.DoubleSide, sheenColor: new THREE.Color(est.brillo), ...TELA_PLAYERA }));
}
function mangaCorta(piv, hol, est, afuera, casquillo) {
  const mallas = mallasBrazo(piv);
  if (!mallas.length) return null;
  piv.updateMatrixWorld(true);
  const inv = piv.matrixWorld.clone().invert();
  // piel del brazo en el marco del pivote, con vértices soldados para que la normal sea suave (sin grietas en costuras)
  const partes = mallas.map((o) => { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', o.geometry.attributes.position.clone()); if (o.geometry.index) gg.setIndex(o.geometry.index.clone()); gg.applyMatrix4(inv.clone().multiply(o.matrixWorld)); return gg; });
  let geo = partes.length > 1 ? mergeGeometries(partes) : partes[0];
  geo = mergeVertices(geo, 1e-4); geo.computeVertexNormals();
  partes.forEach((p) => p !== geo && p.dispose());
  const P = geo.attributes.position, N = geo.attributes.normal, n = P.count, v = _V();
  let punta = _V();
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i); if (v.lengthSq() > punta.lengthSq()) punta.copy(v); }
  const L = punta.length(), eje = punta.clone().normalize();
  // dónde sale el brazo del torso y hasta dónde llega la manga (a lo largo del eje del brazo)
  let tSal = L;
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i); const s = v.dot(eje); if (s > 0 && s < tSal && afuera(v) > 0.015) tSal = s; }
  if (tSal >= L) tSal = 0.4 * L;
  const tFin = Math.min(0.85 * L, tSal + Math.max(casquillo ? 0.06 : 0.09, (casquillo ? 0.28 : 0.42) * (L - tSal)));
  // vértices inflados + distancia firmada al plano de corte
  const Q = [], D = [], NN = [];
  for (let i = 0; i < n; i++) {
    const p = _V().fromBufferAttribute(P, i), nn = _V().fromBufferAttribute(N, i);
    Q.push(p.clone().addScaledVector(nn, hol)); NN.push(nn); D.push(p.dot(eje) - tFin);
  }
  const ix = geo.index ? geo.index.array : Array.from({ length: n }, (_, i) => i);
  // color por vértice = multiplicador sobre la tela (lineal): 1 = la tela; puño y pespunte salen de su color real
  const tela = new THREE.Color(est.colorTela), por = (c) => { const k = new THREE.Color(c); return new THREE.Color(k.r / tela.r, k.g / tela.g, k.b / tela.b); };
  const pos = [], nor = [], col = [], uv = [], puno = por(est.puno), base = new THREE.Color(1, 1, 1), pesp = est.pespunteManga ? por(est.pespunteManga) : null;
  const meter = (p, nn) => {
    const d = tFin - p.dot(eje);   // distancia a la orilla (medida sobre el eje)
    const c = d < 0.022 ? puno : pesp && d > 0.03 && d < 0.038 ? pesp : base;
    pos.push(p.x, p.y, p.z); nor.push(nn.x, nn.y, nn.z); col.push(c.r, c.g, c.b);
    if (est.uvLibre) uv.push((Math.abs(nn.x) > Math.abs(nn.z) ? p.z : p.x) * est.uvLibre[0], (Math.abs(nn.y) > 0.7 ? (Math.abs(nn.x) > Math.abs(nn.z) ? p.x : p.z) : p.y) * est.uvLibre[1]);   // tela con dibujo: UV por la cara dominante (el cuadrito no se estira)
    else uv.push(0.5 + Math.atan2(p.z, p.x) / (2 * Math.PI), 0.9);   // polo: v = 0.9 cae en el naranja
  };
  // recorte con dos planos perpendiculares al brazo: tIni (dentro del torso, cerca de la salida: al levantar el brazo
  // la raíz honda no se asoma por encima del cuello) y tFin (la orilla de la manga)
  const tIni = Math.max(0, tSal - 0.05);
  const recorta = (poli, f) => {
    const out = [];
    for (let e = 0; e < poli.length; e++) {
      const A = poli[e], B = poli[(e + 1) % poli.length], da = f(A[2]), db = f(B[2]);
      if (da <= 0) out.push(A);
      if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([A[0].clone().lerp(B[0], t), A[1].clone().lerp(B[1], t).normalize(), A[2] + (B[2] - A[2]) * t]); }
    }
    return out;
  };
  for (let t = 0; t < ix.length; t += 3) {
    let poli = [ix[t], ix[t + 1], ix[t + 2]].map((k) => [Q[k], NN[k], D[k] + tFin]);
    if (poli.every((x) => x[2] > tFin) || poli.every((x) => x[2] < tIni)) continue;
    poli = recorta(recorta(poli, (sv) => sv - tFin), (sv) => tIni - sv);
    for (let k = 1; k + 1 < poli.length; k++) { meter(poli[0][0], poli[0][1]); meter(poli[k][0], poli[k][1]); meter(poli[k + 1][0], poli[k + 1][1]); }
  }
  geo.dispose();
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const grupo = new THREE.Group(); grupo.name = 'manga';
  const manga = new THREE.Mesh(g, matManga(est)); manga.castShadow = true; grupo.add(manga);
  piv.add(grupo);
  // pelo del brazo bajo la manga
  for (const o of mallas) { const m = inv.clone().multiply(o.matrixWorld), q = _V(); sinPeloBajoTela(o, (p) => q.copy(p).applyMatrix4(m).dot(eje) < tFin + 0.012); }
  return grupo;
}
// aletas planas (pingüino, tiburón, patito): la sección del brazo es mucho más ancha que gruesa
function brazoPlano(piv) {
  const mallas = mallasBrazo(piv);
  if (!mallas.length) return false;
  piv.updateMatrixWorld(true);
  const inv = piv.matrixWorld.clone().invert(), caja = new THREE.Box3(), v = _V();
  for (const o of mallas) { const m = inv.clone().multiply(o.matrixWorld), pa = o.geometry.attributes.position; for (let i = 0; i < pa.count; i++) caja.expandByPoint(v.fromBufferAttribute(pa, i).applyMatrix4(m)); }
  const s = caja.getSize(_V()).toArray().sort((a, b) => a - b);
  return s[0] / s[1] < 0.5;
}
// primer cruce (t >= tMin) de un rayo con una lista de triángulos (Möller–Trumbore); Infinity si no hay
function rayoTris(tris, o, d, tMin = -0.02) {
  let mejor = Infinity;
  for (let t = 0; t < tris.length; t += 9) {
    const ax = tris[t], ay = tris[t + 1], az = tris[t + 2];
    const e1x = tris[t + 3] - ax, e1y = tris[t + 4] - ay, e1z = tris[t + 5] - az, e2x = tris[t + 6] - ax, e2y = tris[t + 7] - ay, e2z = tris[t + 8] - az;
    const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x, det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) continue;
    const f = 1 / det, sx = o.x - ax, sy = o.y - ay, sz = o.z - az, u = f * (sx * px + sy * py + sz * pz);
    if (u < 0 || u > 1) continue;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, w = f * (d.x * qx + d.y * qy + d.z * qz);
    if (w < 0 || u + w > 1) continue;
    const tt = f * (e2x * qx + e2y * qy + e2z * qz);
    if (tt >= tMin && tt < mejor) mejor = tt;
  }
  return mejor;
}
// cuello: banda que rodea el cuello (más alta atrás), dobla y cae en dos puntas sobre el pecho. Las solapas tienen
// GROSOR (dos capas + orilla redonda) y las puntas se levantan un poco: en tres cuartos se ve tela, no una raya.
function cuelloPolo(T, hol, est, arriba) {
  const K = est.cuello, g = new THREE.Group(), rF = T.radio(0, arriba(0)), hueco = K.hueco / rF, punta = K.punta, alza = K.alza;
  const dMax = alza + K.dMax, dAtras = alza + K.dAtras, grueso = K.grueso;
  const prof = (a) => { const x = Math.abs(a); if (x < punta) return dMax * Math.max(0, x - hueco) / (punta - hueco); return dAtras + (dMax - dAtras) * Math.exp(-(((x - punta) / 0.34) ** 2)); };
  const ang = (u) => { const a = hueco + (2 * Math.PI - 2 * hueco) * u; return a > Math.PI ? a - 2 * Math.PI : a; };
  const doblez = (a) => arriba(a) + alza;
  const frente = (a) => Math.max(0, 1 - Math.abs(a) / (punta * 1.6));   // las puntas del frente se levantan
  const capa = (extra) => (u, v) => { const a = ang(u); return { a, y: doblez(a) - prof(a) * (1 - v), off: hol + 0.012 + extra + 0.012 * v * v + 0.035 * frente(a) * (1 - v) }; };
  const fuera = tiraSobre(T, 160, 6, capa(grueso), matTela(K.color));
  const dentro = tiraSobre(T, 160, 6, capa(0), matTela(K.dentro, THREE.BackSide));
  g.add(fuera, dentro);
  // orilla redonda (cierra el grosor) y rollo del doblez
  const orilla = [], rollo = [];
  for (let k = 0; k <= 160; k++) { const q = capa(grueso / 2)(k / 160, 0); orilla.push(T.muestra(q.a, q.y, q.off).p); const a = ang(k / 160); rollo.push(T.muestra(a, doblez(a), hol + 0.012 + grueso / 2 + 0.012).p); }
  g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(orilla), 240, grueso / 2, 8), matTela(K.color)));
  g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rollo), 200, grueso * 0.75, 10), matTela(K.color)));
  for (const k of [0, 160]) g.add(malla(esf(grueso * 0.75, 12), matTela(K.color), { pos: rollo[k].toArray() }));
  if (K.pespunte) {   // pespunte claro a lo largo de la orilla (mezclilla)
    const pes = []; for (let k = 0; k <= 160; k++) { const q = capa(grueso + 0.002)(k / 160, 0.16); pes.push(T.muestra(q.a, q.y, q.off).p); }
    g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pes), 240, 0.0035, 4), matTela(K.pespunte)));
  }
  // banda del escote al frente: une las puntas por debajo y remata la orilla de arriba de la playera
  const vivo = []; for (let k = 0; k <= 24; k++) { const a = (k / 24 - 0.5) * 2 * (hueco + 0.22); vivo.push(T.muestra(a, arriba(a) + 0.006, hol + 0.008).p); }
  g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vivo), 48, 0.016, 8), matTela(K.color)));
  if (K.botonesPunta) for (const s of [-1, 1]) {   // cuello abotonado: botoncito en cada punta
    const a = s * punta * 0.9, y = doblez(a) - prof(a) * 0.85, off = hol + 0.012 + grueso + 0.035 * frente(a) * 0.85 + 0.006;
    const { p, n } = T.muestra(a, y, off);
    pegar(g, malla(esf(0.019, 12), clay(K.botonesPunta, { roughness: 0.4, clearcoat: 0.6, sheen: 0 }), { esc: [1, 1, 0.5] }), p, n);
  }
  g.cuelloMalla = fuera;
  return g;
}
// cuello redondo de playera (sin solapas): tira de resorte acanalado que sigue la orilla del escote y un rollito arriba
function cuelloRedondo(T, hol, est, arriba) {
  const K = est.cuello, g = new THREE.Group();
  const banda = tiraSobre(T, 160, 3, (u, v) => { const a = -Math.PI + 2 * Math.PI * u; return { a, y: arriba(a) - K.ancho * (1 - v), off: hol + 0.004 + 0.006 * v, u: u * 64, v }; }, matResorte(K.color));
  g.add(banda);
  const orilla = []; for (let k = 0; k < 160; k++) { const a = -Math.PI + 2 * Math.PI * k / 160; orilla.push(T.muestra(a, arriba(a), hol + 0.006).p); }
  g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(orilla, true), 240, K.grueso, 8, true), matTela(K.color)));
  g.cuelloMalla = banda;
  return g;
}
function matResorte(c) {
  return matCamisa('resorte|' + c, () => {
    const t = lienzo('resorte', 32, 8, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(0, 0, w / 2, h); });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({ color: c, map: t, side: THREE.DoubleSide, sheenColor: new THREE.Color(aclarar(c, 0.45)), ...TELA_PLAYERA });
  });
}
function playeraSobre(ropa, c, est = ESTILOS_CAMISA.deveyes) {
  const { cuerpo, meshes, brazos } = ropa;
  cuerpo.updateMatrixWorld(true);
  const cand = meshes.filter((o) => o.isMesh && _tieneMat(o, /^base/i));
  const principal = (cand.length ? cand : meshes).reduce((b, o) => (o.geometry.attributes.position.count > b.geometry.attributes.position.count ? o : b));
  const pelo = principal.children.some((o) => o.name === 'pelo'), mascara = pelo && !!principal.geometry.attributes.color;
  const hol = pelo && !mascara ? PELO.largo * ([principal.material].flat()[0]?.userData?.pelo ?? 1) * 1.15 + 0.01 : CAMISA.holgura;
  const zc = c.cuelloZc ?? 0, yCuello = c.cuelloY, tris = triangulosEn(cuerpo, [principal]);
  let fondo = Infinity;   // panza: lo más bajo del cuerpo cerca del eje
  for (let t = 0; t < tris.length; t += 3) if (Math.hypot(tris[t], tris[t + 2] - zc) < 0.25) fondo = Math.min(fondo, tris[t + 1]);
  if (!Number.isFinite(fondo)) fondo = yCuello - 1.2;
  const yBajo = yCuello - (yCuello - fondo) * CAMISA.largo;
  // escote: sube por los hombros hasta la base de la cabeza, redondo y más bajo al frente que atrás
  const arriba = (a) => yCuello + CAMISA.escoteFrente + (CAMISA.escoteAtras - CAMISA.escoteFrente) * (1 - Math.cos(a)) / 2
    + CAMISA.hombro * Math.sin(a) ** 2 - (est.ve ?? CAMISA.ve) * Math.max(0, 1 - Math.abs(a) / 0.3);   // hombros arriba, V corta al frente (cuello redondo: sin V)
  // bastilla: recta en la polo; la camisa de mezclilla sube un poco en los costados (faldón)
  const abajo = (a) => yBajo + (est.faldon || 0) * Math.sin(a) ** 2;
  const yMin = yBajo, yMax = arriba(Math.PI), ySplit = yCuello - (yCuello - yBajo) * CAMISA.corte;
  const T = cascaronTorso(tris, yMax, yMin - 0.02, zc, yMax + est.cuello.alza + 0.06);
  // UV v por altura absoluta: el corte naranja/marino (v = 0.5 en la textura) queda recto y a la misma altura
  const vTex = (y) => (y < ySplit ? 0.5 * (y - yMin) / (ySplit - yMin) : 0.5 + 0.5 * (y - ySplit) / (yMax - ySplit));
  const g = new THREE.Group(); g.name = 'playera';
  // donde un brazo descansa pegado al cuerpo (aletas, patas de panda) la tela pasa POR DEBAJO: se acerca a la piel
  // (el pelo ahí ya está apagado) en vez de atravesar el brazo
  const NV = 36, hueco = Array.from({ length: NV + 1 }, () => new Float32Array(T.NU + 1).fill(hol));
  const trisBrazos = Float32Array.from((brazos || []).flatMap((piv) => Array.from(triangulosEn(cuerpo, mallasBrazo(piv)))));
  if (trisBrazos.length) {
    const caja = new THREE.Box3(); for (let t = 0; t < trisBrazos.length; t += 3) caja.expandByPoint(_V(trisBrazos[t], trisBrazos[t + 1], trisBrazos[t + 2]));
    caja.expandByScalar(0.06);
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= T.NU; i++) {
      const a = -Math.PI + 2 * Math.PI * i / T.NU, y = abajo(a) + (arriba(a) - abajo(a)) * j / NV, { p, n } = T.muestra(a, y, 0);
      if (!caja.containsPoint(p)) continue;
      const t = rayoTris(trisBrazos, p, n);
      if (t < hol + 0.012) hueco[j][i] = THREE.MathUtils.clamp(t - 0.008, 0.004, hol);
    }
    const H0 = hueco.map((f) => Float32Array.from(f));   // orilla suave alrededor del brazo
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= T.NU; i++) {
      let s2 = 0, c2 = 0; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const jj = j + dj; if (jj < 0 || jj > NV) continue; s2 += H0[jj][(i + di + T.NU) % T.NU]; c2++; }
      hueco[j][i] = Math.min(H0[j][i], s2 / c2);
    }
  }
  const cuerpoTela = tiraSobre(T, T.NU, NV, (u, v) => { const a = -Math.PI + 2 * Math.PI * u, y = abajo(a) + (arriba(a) - abajo(a)) * v; return { a, y, off: hueco[Math.round(v * NV)][Math.round(u * T.NU)], u, v: vTex(y) }; }, matPlayera(est));
  cuerpoTela.name = 'playera-cuerpo'; g.add(cuerpoTela);
  // dobladillo: cordoncito delgado hundido en la orilla (no un aro)
  const bast = []; for (let k = 0; k < 96; k++) { const a = -Math.PI + 2 * Math.PI * k / 96; bast.push(T.muestra(a, abajo(a) + 0.004, hol - 0.002).p); }
  g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bast, true), 192, est.grosorBastilla, 6, true), matTela(est.bastilla)));
  if (est.pespunteBastilla) {
    const pes = []; for (let k = 0; k < 96; k++) { const a = -Math.PI + 2 * Math.PI * k / 96; pes.push(T.muestra(a, abajo(a) + 0.03, hol + 0.001).p); }
    g.add(malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pes, true), 192, 0.0035, 4, true), matTela(est.pespunteBastilla)));
  }
  const cuello = (est.cuello.redondo ? cuelloRedondo : cuelloPolo)(T, hol, est, arriba); g.add(cuello);
  est.frente(g, T, { yCuello, yTop: arriba(0), yBajo, hol });
  // mangas en los pivotes de los brazos (se mueven con el brazo)
  for (const piv of brazos || []) {
    piv.updateMatrixWorld(true);
    const mC = cuerpo.matrixWorld.clone().invert().multiply(piv.matrixWorld), q = _V();
    // distancia radial de un punto del brazo a la piel del torso (> 0 = ya salió del cuerpo)
    const afuera = (p) => { q.copy(p).applyMatrix4(mC); if (q.y < yMin || q.y > yMax + 0.1) return 1; const a = Math.atan2(q.x, q.z - zc); return Math.hypot(q.x, q.z - zc) - T.radio(a, q.y); };
    if (!brazoPlano(piv)) mangaCorta(piv, CAMISA.holguraManga, est, afuera, false);   // aletas: sin manga, el hombro queda cubierto
  }
  // sin pelo bajo la tela: vértices del cuerpo dentro de la banda y no más afuera que la piel medida (la cola conserva su pelo)
  if (mascara) {
    const m = cuerpo.matrixWorld.clone().invert().multiply(principal.matrixWorld);
    sinPeloBajoTela(principal, (p) => {
      q2.copy(p).applyMatrix4(m); const a = Math.atan2(q2.x, q2.z - zc);
      if (q2.y < abajo(a) - 0.004 || q2.y > arriba(a) + est.cuello.alza + 0.02) return false;   // también bajo el cuello
      return Math.hypot(q2.x, q2.z - zc) < T.radio(a, q2.y) + 0.03;
    });
  }
  g.medidas = [cuerpoTela, cuello.cuelloMalla];   // lo que va encima se mide sobre esto
  return g;
}
const q2 = _V();
// frente de cada uniforme (en el marco del cuerpo, sobre el cascarón T). Lado derecho de la mascota = -x (izquierda en pantalla)
const botonPlano = (c) => clay(c, { roughness: 0.35, clearcoat: 0.8, sheen: 0 });
// polo de tienda: piqué naranja entero con costuras de costado (u = 0.25 / 0.75), mangas en piqué marino
function texPoloNaranja() {
  return lienzo('polo-naranja', 512, 512, (x, w, h) => {
    x.fillStyle = '#f26a1b'; x.fillRect(0, 0, w, h);
    const r = azar(13);
    for (let i = 0; i < 9000; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'; x.fillRect(r() * w, r() * h, 2, 2); }
    for (const u of [0.25, 0.75]) { x.fillStyle = 'rgba(120,40,0,.28)'; x.fillRect(u * w - 1.5, 0, 3, h); }
  });
}
function texPoloMarino() {
  return lienzo('polo-marino', 256, 256, (x, w, h) => {
    x.fillStyle = '#1f2f8f'; x.fillRect(0, 0, w, h);
    const r = azar(17);
    for (let i = 0; i < 4000; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.10)'; x.fillRect(r() * w, r() * h, 2, 2); }
  });
}
// cartera marina con pespunte blanco alrededor
function texCarteraPolo() {
  return lienzo('cartera-polo', 64, 256, (x, w, h) => {
    x.fillStyle = '#1f2f8f'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(8,14,60,.6)'; x.lineWidth = 4; x.strokeRect(2, -4, w - 4, h + 2);
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2.5; x.setLineDash([7, 6]);
    for (const px of [10, w - 10]) { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h - 9); x.stroke(); }
    x.beginPath(); x.moveTo(10, h - 9); x.lineTo(w - 10, h - 9); x.stroke();
  });
}
// parche WEB DEV-EYES de la polo: recuadro blanco redondeado, dos renglones y la ® chica
function texConstruGanasPolo() {
  return lienzo('logo-construganas-polo', 384, 256, (x, w, h) => {
    x.lineJoin = 'round'; x.strokeStyle = 'rgba(122,42,5,.7)'; x.lineWidth = 14;
    x.beginPath(); rectR(x, 30, 22, w - 60, h - 44, 34); x.stroke();
    x.strokeStyle = '#ffffff'; x.lineWidth = 11; x.beginPath(); rectR(x, 28, 20, w - 60, h - 44, 34); x.stroke();
    x.font = 'italic 900 78px "Arial Black", "Segoe UI Black", Arial, sans-serif'; x.textAlign = 'center';
    x.fillStyle = 'rgba(122,42,5,.75)'; x.fillText('CONSTRU', w / 2 + 3, 114, w - 110); x.fillText('GANAS', w / 2 + 3, 200, w - 110);
    x.fillStyle = '#ffffff'; x.fillText('CONSTRU', w / 2, 111, w - 110); x.fillText('GANAS', w / 2, 197, w - 110);
    x.font = '700 30px Arial, sans-serif'; x.fillText('®', w - 64, 194);
  });
}
const ESTILOS_CAMISA = {
  // polo naranja/marino: cuello polo con puntas, cartera con tres botones, WEB DEV-EYES y DevEyes
  deveyes: { clave: 'deveyes', tex: texPlayera, colorTela: CAMISA.naranja, brillo: 0x8a8a8a, puno: CAMISA.puno, grosorPuno: 0.012, bastilla: CAMISA.marino, grosorBastilla: 0.007,
    cuello: { color: CAMISA.naranja, dentro: CAMISA.marino, hueco: 0.03, punta: 0.36, dMax: 0.15, dAtras: 0.08, alza: 0.07, grueso: 0.028 },
    frente(g, T, { yTop, hol }) {
      const altoCartera = 0.28, yCart = yTop - altoCartera / 2 + 0.01;
      g.add(calcaSobre(T, 0, yCart, 0.09, altoCartera, hol + 0.004, matCalca('cartera', texCartera())));
      for (let b = 0; b < 3; b++) { const { p, n } = T.muestra(0, yTop - 0.07 - b * 0.08, hol + 0.012); pegar(g, malla(esf(0.025, 14), botonPlano(0xf47c34), { esc: [1, 1, 0.5] }), p, n); }
      const yLogo = yTop - 0.255, aLogo = 0.55;
      g.add(calcaSobre(T, aLogo, yLogo, 0.48, 0.21, hol + 0.006, matCalca('deveyes', texDevEyes())));
      g.add(calcaSobre(T, -aLogo + 0.04, yLogo - 0.005, 0.29, 0.242, hol + 0.006, matCalca('construganas', texConstruGanas())));
    } },
  // polo de tienda: cuerpo naranja, mangas y cuello marino, cartera marina con tres botones, pespunte blanco
  polo_deveyes: { clave: 'polo_deveyes', tex: texPoloNaranja, texManga: texPoloMarino, colorTela: 0x1f2f8f, pespunteManga: 0xf4f4f4, brillo: 0x8a8a8a,
    puno: 0x17226e, grosorPuno: 0.012, bastilla: 0xd2520c, grosorBastilla: 0.007, pespunteBastilla: 0xfbe6d8,
    cuello: { color: 0x1f2f8f, dentro: 0x17226e, pespunte: 0xf4f4f4, hueco: 0.03, punta: 0.36, dMax: 0.15, dAtras: 0.08, alza: 0.07, grueso: 0.028 },
    frente(g, T, { yTop, hol }) {
      const altoCartera = 0.28, yCart = yTop - altoCartera / 2 + 0.01;
      g.add(calcaSobre(T, 0, yCart, 0.095, altoCartera, hol + 0.004, matCalca('cartera-polo', texCarteraPolo())));
      for (let b = 0; b < 3; b++) { const { p, n } = T.muestra(0, yTop - 0.07 - b * 0.08, hol + 0.012); pegar(g, malla(esf(0.024, 14), botonPlano(0x2c3ca8), { esc: [1, 1, 0.5] }), p, n); }
      const yLogo = yTop - 0.255, aLogo = 0.55;
      g.add(calcaSobre(T, aLogo, yLogo, 0.48, 0.21, hol + 0.006, matCalca('deveyes', texDevEyes())));
      g.add(calcaSobre(T, -aLogo + 0.04, yLogo, 0.3, 0.2, hol + 0.006, matCalca('construganas-polo', texConstruGanasPolo())));
    } },
  // camisa de mezclilla: cuello abotonado chico, tapeta de botones ocultos hasta abajo, bolsa de pecho con DevEyes
  // bordado arriba y el parche naranja WEB DEV-EYES del otro lado, en espejo (misma altura y distancia al centro)
  mezclilla: { clave: 'mezclilla', tex: texMezclilla, uvLibre: [0.9, 0.9], colorTela: 0x2f3a52, pespunteManga: 0xb9ad90, brillo: 0x6f7c99, puno: 0x232c40, grosorPuno: 0.011, bastilla: 0x283149, grosorBastilla: 0.009,
    pespunteBastilla: 0xb9ad90, faldon: 0.1,
    cuello: { color: 0x34405b, dentro: 0x26304a, pespunte: 0xb9ad90, hueco: 0.03, punta: 0.26, dMax: 0.11, dAtras: 0.065, alza: 0.06, grueso: 0.024, botonesPunta: 0xd9d2c0 },
    frente(g, T, { yTop, yBajo, hol }) {
      const alto = yTop - yBajo - 0.01;
      g.add(calcaSobre(T, 0, yBajo + 0.01 + alto / 2, 0.09, alto, hol + 0.004, matCalca('tapeta', texTapeta())));
      const yLogo = yTop - 0.17, aLogo = 0.52;
      g.add(calcaSobre(T, aLogo, yLogo, 0.36, 0.158, hol + 0.006, matCalca('deveyes-mezclilla', texDevEyesMezclilla())));
      g.add(calcaSobre(T, aLogo, yLogo - 0.19, 0.2, 0.225, hol + 0.008, matCalca('bolsa', texBolsa())));
      g.add(calcaSobre(T, -aLogo, yLogo - 0.04, 0.26, 0.216, hol + 0.006, matCalca('construganas-mezclilla', texConstruGanasMezclilla())));
    } },
};
// camisa DE HomeCenter: cuadrito vichy azul marino/blanco fino (de lejos se lee azul claro), cuello de camisa de
// puntas, tapeta con botones blancos, bolsa de pecho con el logo DE HomeCenter arriba (lado izquierdo de la mascota)
function texVichy() {
  const t = _texCache['vichy-mn'] ? null : true, tex = lienzo('vichy-mn', 1024, 1024, (x, w, h) => {
    const p = 8;   // 128 cuadritos por lado (raya azul = 50 % de la celda): tela fina; mipmaps + anisotropía evitan el moiré
    x.fillStyle = '#f4f6fb'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(46,72,150,.45)';
    for (let i = 0; i < w; i += p * 2) x.fillRect(i, 0, p, h);
    for (let j = 0; j < h; j += p * 2) x.fillRect(0, j, w, p);
    const r = azar(5);
    for (let i = 0; i < 3000; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.08)' : 'rgba(10,20,60,.07)'; x.fillRect(r() * w, r() * h, 2, 1.5); }
  });
  if (t) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3.25, 0.65); tex.anisotropy = 8; tex.needsUpdate = true; }   // ~46 cuadritos por unidad (~50 a lo ancho del pecho, como la camisa real)
  return tex;
}
function texLogoMN() {
  return lienzo('logo-mn-homecenter', 512, 320, (x, w) => {
    x.lineJoin = 'round';
    const cx = w / 2, cy = 112, R = 96;
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
    x.strokeStyle = '#1f4fb4'; x.lineWidth = 14; x.stroke();
    x.font = 'italic 900 112px "Arial Black", "Segoe UI Black", Arial, sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'right';
    x.fillStyle = '#e1251b'; x.fillText('M', cx + 10, cy + 6);
    x.textAlign = 'left'; x.fillStyle = '#1f4fb4'; x.fillText('N', cx + 2, cy + 6);
    x.font = 'italic 900 66px "Arial Black", "Segoe UI Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.lineWidth = 14; x.strokeStyle = '#ffffff'; x.strokeText('HomeCenter', cx, 290, w - 12);
    x.fillStyle = '#1f4fb4'; x.fillText('HomeCenter', cx, 290, w - 12);
  });
}
function texTapetaMN() {
  return lienzo('tapeta-mn', 64, 512, (x, w, h) => {
    x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, w, h);
    x.strokeStyle = 'rgba(30,45,100,.55)'; x.lineWidth = 3;
    for (const px of [6, w - 6]) { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h); x.stroke(); }
  });
}
function texBolsaMN() {
  return lienzo('bolsa-mn', 256, 288, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.strokeStyle = 'rgba(30,45,100,.6)'; x.lineWidth = 5;
    x.beginPath(); x.moveTo(10, 10); x.lineTo(10, h - 40); x.lineTo(w / 2, h - 10); x.lineTo(w - 10, h - 40); x.lineTo(w - 10, 10); x.stroke();
    x.beginPath(); x.moveTo(10, 46); x.lineTo(w - 10, 46); x.stroke();
    x.fillStyle = 'rgba(20,30,80,.10)'; x.fillRect(12, 48, w - 24, h - 92);
  });
}
ESTILOS_CAMISA.mn = { clave: 'mn', tex: texVichy, uvLibre: [0.22, 1.1], colorTela: 0xb9c3df, brillo: 0x9aa4c0, puno: 0x8f9cc4, grosorPuno: 0.011, bastilla: 0x8f9cc4, grosorBastilla: 0.009,
  cuello: { color: 0xaebadb, dentro: 0x9eabd0, orilla: 0x8d9bc6, hueco: 0.03, punta: 0.3, dMax: 0.14, dAtras: 0.06, alza: 0.05, grueso: 0.02 },
  frente(g, T, { yTop, yBajo, hol }) {
    const alto = yTop - yBajo - 0.01;
    g.add(calcaSobre(T, 0, yBajo + 0.01 + alto / 2, 0.09, alto, hol + 0.004, matCalca('tapeta-mn', texTapetaMN())));
    for (let b = 0; b < 5; b++) {
      const y = yTop - 0.07 - b * (alto - 0.1) / 4; if (y < yBajo + 0.04) break;
      const { p, n } = T.muestra(0, y, hol + 0.01); pegar(g, malla(esf(0.02, 12), botonPlano(0xeef0f4), { esc: [1, 1, 0.45] }), p, n);
    }
    const yLogo = yTop - 0.16, aLogo = 0.52;
    g.add(calcaSobre(T, aLogo, yLogo, 0.38, 0.24, hol + 0.006, matCalca('logo-mn', texLogoMN())));
    g.add(calcaSobre(T, aLogo, yLogo - 0.24, 0.2, 0.225, hol + 0.008, matCalca('bolsa-mn', texBolsaMN())));
  } };
// playera DevEyes gris: jersey gris jaspeado, cuello redondo de resorte, logo DevEyes (casita naranja sobre la
// cuchara marina) al centro del pecho y abajo una cascada de círculos marinos con íconos de ferretería que se achican
function texGrisJaspeado() {
  return lienzo('gris-jaspeado', 512, 512, (x, w, h) => {
    x.fillStyle = '#9a9c9e'; x.fillRect(0, 0, w, h);
    const r = azar(23);
    for (let i = 0; i < 26000; i++) { const k = r(); x.fillStyle = k < 0.5 ? 'rgba(255,255,255,.10)' : k < 0.9 ? 'rgba(40,42,46,.10)' : 'rgba(255,255,255,.18)'; x.fillRect(r() * w, r() * h, 1 + r() * 3, 1); }
  });
}
// logo: casita de línea naranja (puerta y ventana) sobre la cuchara de albañil marina, palabra marina y subrayado naranja
function texLogoDevEyesGris() {
  return lienzo('logo-deveyes-gris', 512, 360, (x, w) => {
    const N = '#262a6b', O = '#f26a1b', cx = w / 2;
    x.lineJoin = 'round'; x.lineCap = 'round';
    // cuchara: hoja triangular hacia abajo-izquierda y mango hacia arriba-derecha
    x.fillStyle = N; x.beginPath(); x.moveTo(cx - 92, 214); x.lineTo(cx + 64, 150); x.lineTo(cx + 18, 116); x.closePath(); x.fill();
    x.strokeStyle = N; x.lineWidth = 12; x.beginPath(); x.moveTo(cx + 40, 134); x.lineTo(cx + 78, 92); x.stroke();
    x.lineWidth = 22; x.beginPath(); x.moveTo(cx + 78, 92); x.lineTo(cx + 108, 58); x.stroke();
    // casita: techo, paredes, puerta y ventana (línea naranja con orilla gris para separarla de la cuchara)
    const casa = () => {
      x.beginPath(); x.moveTo(cx - 78, 84); x.lineTo(cx - 8, 22); x.lineTo(cx + 62, 84);
      x.moveTo(cx - 62, 72); x.lineTo(cx - 62, 162); x.lineTo(cx + 46, 162); x.lineTo(cx + 46, 72);
      x.moveTo(cx - 40, 162); x.lineTo(cx - 40, 112); x.lineTo(cx - 14, 112); x.lineTo(cx - 14, 162);
      x.rect(cx + 2, 96, 26, 24); x.stroke();
    };
    x.strokeStyle = '#9a9c9e'; x.lineWidth = 22; casa();
    x.strokeStyle = O; x.lineWidth = 11; casa();
    x.font = '900 88px "Arial Black", "Segoe UI Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillStyle = N; x.fillText('DevEyes', cx, 312, w - 20);
    x.fillStyle = O; x.fillRect(w * 0.1, 330, w * 0.8, 14);
  });
}
// íconos de línea blanca en un cuadro de -50..50 (centro del círculo)
const ICONOS_FERRETERIA = [
  (x) => {   // bulto de cemento
    x.beginPath(); x.moveTo(-30, -34); x.lineTo(30, -34); x.lineTo(34, 34); x.lineTo(-34, 34); x.closePath(); x.stroke();
    x.beginPath(); x.moveTo(-26, -22); x.lineTo(26, -22); x.stroke();
    x.font = '900 15px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('CEMENTO', 0, 6, 58);
  },
  (x) => {   // llave española
    x.save(); x.rotate(-Math.PI / 4);
    x.beginPath(); rectR(x, -6, -22, 12, 56, 6); x.stroke();
    x.beginPath(); x.arc(0, -34, 15, -Math.PI * 0.3, Math.PI * 1.3); x.stroke();
    x.restore();
  },
  (x) => {   // clavija
    x.beginPath(); rectR(x, -20, -12, 40, 30, 8); x.stroke();
    x.beginPath(); x.moveTo(-9, -12); x.lineTo(-9, -32); x.moveTo(9, -12); x.lineTo(9, -32); x.moveTo(0, 18); x.lineTo(0, 30); x.quadraticCurveTo(0, 40, 14, 40); x.stroke();
  },
  (x) => {   // taza de baño
    x.beginPath(); rectR(x, 4, -38, 22, 34, 4); x.stroke();
    x.beginPath(); x.moveTo(-30, -4); x.lineTo(26, -4); x.quadraticCurveTo(26, 22, 4, 24); x.lineTo(10, 38); x.lineTo(-12, 38); x.lineTo(-10, 22); x.quadraticCurveTo(-30, 16, -30, -4); x.stroke();
  },
  (x) => {   // rodillo de pintura
    x.beginPath(); rectR(x, -34, -34, 52, 20, 6); x.stroke();
    x.beginPath(); x.moveTo(18, -24); x.lineTo(30, -24); x.lineTo(30, -2); x.lineTo(0, -2); x.lineTo(0, 12); x.stroke();
    x.lineWidth *= 1.6; x.beginPath(); x.moveTo(0, 14); x.lineTo(0, 38); x.stroke();
  },
  (x) => {   // tornillo
    x.rotate(Math.PI / 4);   // en diagonal
    x.beginPath(); x.moveTo(-20, -36); x.lineTo(20, -36); x.lineTo(14, -24); x.lineTo(-14, -24); x.closePath(); x.stroke();
    x.beginPath(); x.moveTo(-9, -24); x.lineTo(-9, 22); x.lineTo(0, 38); x.lineTo(9, 22); x.lineTo(9, -24); x.stroke();
    x.beginPath(); for (let k = 0; k < 4; k++) { x.moveTo(-9, -14 + k * 10); x.lineTo(9, -8 + k * 10); } x.stroke();
  },
  (x) => {   // muro de ladrillo
    x.beginPath(); x.rect(-34, -28, 68, 56);
    for (const y of [-10, 10]) { x.moveTo(-34, y); x.lineTo(34, y); }
    for (const [y0, xs] of [[-28, [0]], [-10, [-17, 17]], [10, [0]]]) for (const px of xs) { x.moveTo(px, y0); x.lineTo(px, y0 + 18); }
    x.stroke();
  },
  (x) => {   // carretilla
    x.beginPath(); x.moveTo(-36, -18); x.lineTo(18, -18); x.lineTo(6, 6); x.lineTo(-26, 6); x.closePath(); x.stroke();
    x.beginPath(); x.moveTo(18, -18); x.lineTo(36, -30); x.moveTo(-8, 6); x.lineTo(-8, 20); x.moveTo(-24, 6); x.lineTo(-30, 30); x.stroke();
    x.beginPath(); x.arc(-8, 28, 8, 0, 7); x.stroke();
  },
];
// los 8 círculos tal como en la playera real (medidos en la foto de 600 px: centro x, y y radio); el lienzo cubre
// x 180..420, y 295..455 de esa foto. Orden de íconos = ICONOS_FERRETERIA
const CIRCULOS_GRIS = [[218, 330, 28], [262, 347, 22], [222, 385, 26], [272, 400, 22], [322, 407, 19], [395, 400, 13], [350, 433, 16], [382, 428, 13]];
function texCascadaFerreteria() {
  return lienzo('cascada-ferreteria', 1024, 683, (x) => {
    const S = 1024 / 240;
    CIRCULOS_GRIS.forEach(([rx, ry, rr], i) => {
      const cx = (rx - 180) * S, cy = (ry - 295) * S, r = rr * S;
      x.fillStyle = '#262a6b'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
      x.save(); x.translate(cx, cy); x.scale(r / 62, r / 62);
      x.strokeStyle = x.fillStyle = '#f2f3f5'; x.lineWidth = r < 70 ? 7 : 5.5; x.lineJoin = 'round'; x.lineCap = 'round';
      ICONOS_FERRETERIA[i](x);
      x.restore();
    });
  });
}
ESTILOS_CAMISA.deveyes_gris = { clave: 'deveyes_gris', tex: texGrisJaspeado, colorTela: 0x9a9c9e, brillo: 0xb8babd, puno: 0x88898c, grosorPuno: 0.012, bastilla: 0x8a8c8f, grosorBastilla: 0.007, ve: 0,
  cuello: { redondo: true, color: 0x7f8184, ancho: 0.035, grueso: 0.011, alza: 0.012 },
  frente(g, T, { yTop, yBajo, hol }) {
    // misma composición que la foto: escote ~ y 155, bastilla ~ y 470 (k = unidades por pixel de la foto)
    const k = (yTop - yBajo) / 315, yRef = (py) => yTop - (py - 155) * k;
    const altoLogo = 90 * k, yLogo = yRef(252) + altoLogo * (337 / 360 - 0.5);   // subrayado del lienzo (y 337) en y 252
    g.add(calcaSobre(T, 0, yLogo, altoLogo * 512 / 360, altoLogo, hol + 0.007, matCalca('logo-deveyes-gris', texLogoDevEyesGris())));
    g.add(calcaSobre(T, 0, yRef(378), 240 * k * 1.12, 160 * k * 1.12,   // 12 % más grande: legible en el celular
      hol + 0.006, matCalca('cascada-ferreteria', texCascadaFerreteria())));
  } };
// miniatura de la tienda: la camisa tal como la viste el gatito (sin la mascota); si no hay modelos, sobre un maniquí
function playeraSuelta(clave) {
  const out = new THREE.Group();
  if (faltaGLB('gatito')) { usoRespaldo = true; pedirGLB('gatito'); }   // el maniquí solo mientras llega el gatito
  if (MODELOS_EXTERNOS.gatito?.cuerpo) {
    const m = armar({ especie: 'gatito', etapa: 1, equipo: { torso: clave } });
    m.raiz.scale.setScalar(1); m.raiz.updateMatrixWorld(true);
    const piezas = []; m.raiz.traverse((o) => { if (o.name === 'playera' || o.name === 'manga') piezas.push(o); });
    for (const o of piezas) out.attach(o);
    liberar(m.raiz);
  }
  if (!out.children.length) {
    const raiz = new THREE.Group();
    const cuerpo = new THREE.Mesh(torneado([[0.001, -1.0], [0.42, -0.97], [0.66, -0.82], [0.76, -0.58], [0.79, -0.32], [0.77, -0.06], [0.71, 0.14], [0.64, 0.3], [0.62, 0.46], [0.6, 0.7], [0.45, 1.0], [0.001, 1.12]], 64));
    cuerpo.material.name = 'base'; raiz.add(cuerpo);
    const brazos = [-1, 1].map((s) => {
      const piv = new THREE.Group(); piv.position.set(s * 0.6, 0.16, 0.02); raiz.add(piv);
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.34, 6, 14)); b.material.name = 'base'; b.position.set(s * 0.2, -0.18, 0); b.rotation.z = s * 0.6; piv.add(b);
      return piv;
    });
    raiz.updateMatrixWorld(true);
    out.add(playeraSobre({ cuerpo: raiz, meshes: [cuerpo], brazos }, { cuelloY: 0.28, cuelloZc: 0 }, ESTILOS_CAMISA[clave]));
    for (const piv of brazos) for (const o of [...piv.children]) if (o.name === 'manga') out.attach(o);
    liberar(raiz);
  }
  const vista = new THREE.Group(); vista.add(out); out.rotation.x = -0.28;   // la tienda la ve de arriba: casi de frente
  return vista;
}
function camisaUniforme(c, clave) {
  if (!c.ropa?.meshes?.length) return playeraSuelta(clave);
  const g = playeraSobre(c.ropa, c, ESTILOS_CAMISA[clave]);
  // lo que va encima (moño, corbata, paliacate, mochila, capa) se mide sobre la tela, no sobre la piel
  if (c.remedir && c.ropa.encima) { c.ropa.cuerpo.add(g); g.updateMatrixWorld(true); c.ropa.meshes.push(...g.medidas); c.remedir(); }
  return g;
}
PRENDAS.torso = { deveyes: (c) => camisaUniforme(c, 'deveyes'), mezclilla: (c) => camisaUniforme(c, 'mezclilla'), mn: (c) => camisaUniforme(c, 'mn'), polo_deveyes: (c) => camisaUniforme(c, 'polo_deveyes'),
  deveyes_gris: (c) => camisaUniforme(c, 'deveyes_gris') };
function prepararAlasModelo(modelo, cuerpo, brazos, punta) {
  const piezas = [];
  for (const s of [-1, 1]) {
    const ala = modelo.getObjectByName(s < 0 ? 'alaI' : 'alaD'); if (!ala) continue;
    const brazo = brazos[s < 0 ? 0 : 1];
    const invBody = cuerpo.matrixWorld.clone().invert();
    const bindArmInv = invBody.clone().multiply(brazo.matrixWorld).invert();
    ala.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh) return;
      o.geometry = o.geometry.clone(); o.geometry.userData.fija = false;
      const base = o.geometry.attributes.position.array.slice(), weights = new Float32Array(base.length / 3);
      const toBody = invBody.clone().multiply(o.matrixWorld), fromBody = toBody.clone().invert(), p = new THREE.Vector3();
      for (let i = 0; i < weights.length; i++) {
        p.fromArray(base, i * 3).applyMatrix4(toBody);
        const z = p.y - RIG.suelo, root = 0.62 + 0.17 * THREE.MathUtils.clamp((1.25 - z) / 0.65, 0, 1);
        const t = THREE.MathUtils.clamp((Math.abs(p.x) - root) / (punta - root), 0, 1);
        weights[i] = t * t * (3 - 2 * t);
      }
      piezas.push({ mesh: o, base, weights, toBody, fromBody, bindArmInv, brazo });
    });
  }
  return piezas;
}
function animarAlasModelo(m) {
  if (!m.ud.alasModelo) return;
  m.raiz.updateMatrixWorld(true);
  const inv = m.cuerpo.matrixWorld.clone().invert(), p = new THREE.Vector3(), q = new THREE.Vector3();
  for (const a of m.ud.alasModelo) {
    const delta = inv.clone().multiply(a.brazo.matrixWorld).multiply(a.bindArmInv), out = a.mesh.geometry.attributes.position;
    for (let i = 0; i < a.weights.length; i++) {
      p.fromArray(a.base, i * 3).applyMatrix4(a.toBody); q.copy(p).applyMatrix4(delta);
      p.lerp(q, a.weights[i]).applyMatrix4(a.fromBody); out.setXYZ(i, p.x, p.y, p.z);
    }
    out.needsUpdate = true; a.mesh.geometry.computeVertexNormals(); a.mesh.geometry.computeBoundingSphere();
  }
}
// crecimiento continuo con los puntos y brillos de etapa
function crecerYBrillar(raiz, op) {
  const crec = op.crecimiento ?? [0.1, 0.45, 0.75, 1][Math.max(0, Math.min(3, op.etapa ?? 1))];
  raiz.scale.setScalar(0.74 + Math.max(0, Math.min(1, crec)) * 0.34);
  if ((op.etapa ?? 0) >= 2) {
    const n = 30, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + i, r = 1.25 + (i % 5) * 0.08; pos.set([Math.cos(a) * r, -0.8 + ((i * 37) % 23) / 10, Math.sin(a) * r], i * 3); }
    const pts = new THREE.BufferGeometry(); pts.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const chispas = new THREE.Points(pts, new THREE.PointsMaterial({ color: op.etapa >= 3 ? 0xffd75e : 0xffffff, size: 0.08, transparent: true, opacity: 0.85 }));
    raiz.add(chispas); raiz.userData.chispas = chispas;
  }
}
function armar(op) {
  const def = ESPECIES[op.especie] || ESPECIES.obra, mod = MODELOS[op.especie] || (!ESPECIES[op.especie] && MODELOS.obra);
  // prioridad: modelo externo registrado -> modelo esculpido horneado -> procedural
  const ext = MODELOS_EXTERNOS[op.especie];
  if (ext?.cuerpo) { try { return armarExterno(op, def, ext); } catch (e) { console.warn('armarExterno', op.especie, e); } }
  if (faltaGLB(op.especie)) { usoRespaldo = true; pedirGLB(op.especie); }   // su modelo va en camino: por ahora el respaldo
  if (mod) { try { return armarModelo(op, def, mod); } catch (e) { console.warn('armarModelo', op.especie, e); } }
  return armarProcedural(op);
}

/* ============================================================ armado procedural (respaldo si no cargan los modelos) */
function armarProcedural(op) {
  const def = ESPECIES[op.especie] || ESPECIES.obra;
  const color = op.color && PELAJES[op.color] !== undefined ? PELAJES[op.color] : def.color;
  const colores = { cuerpo: color, panza: def.panzaFija ?? aclarar(color, 0.55) };
  const raiz = new THREE.Group(), cuerpo = new THREE.Group(); raiz.add(cuerpo);
  // Proporciones chibi: cabeza grande (sus coordenadas son las de siempre, radio 1) sobre un cuerpo pequeno.
  const forma = FORMAS[op.especie] || {};
  const tipoCab = CABEZAS[forma.cabeza] || CABEZAS.redonda, tor = TORSOS[forma.torso] || TORSOS.normal;
  const largas = forma.patas === 'largas', alzar = largas ? 0.2 : 0;
  cuerpo.position.y = alzar;
  const eq = { ...(op.equipo || {}) };
  if (op.accesorio && ACC_A_SLOT[op.accesorio] && !eq[ACC_A_SLOT[op.accesorio]]) eq[ACC_A_SLOT[op.accesorio]] = op.accesorio;
  // piel: lisa, con acabado propio (vidrio, esmalte, metal) o con dibujo pintado
  const acabado = forma.acabado || {};
  const piel = forma.textura ? matPiel(PIELES[forma.textura](color), color, acabado) : clay(color, acabado);
  const pielTorso = forma.texturaTorso === forma.textura ? piel : forma.texturaTorso ? matPiel(PIELES[forma.texturaTorso](color), color, acabado) : clay(color, acabado);
  const CAB = { y: 0.66, esc: 0.78, ...(forma.cab || {}) };
  const cab = new THREE.Group(); cab.position.y = CAB.y; cab.scale.setScalar(CAB.esc); cuerpo.add(cab);
  const geoCab = tipoCab.geo(); geoCab.computeBoundingBox();
  cab.add(malla(geoCab, piel, { esc: tipoCab.esc }));
  // pecho: justo bajo la barbilla, sobre el frente del torso (ahi van corbata y monito)
  const pechoY = CAB.y + CAB.esc * geoCab.boundingBox.min.y * tipoCab.esc[1] - 0.03, dyP = (pechoY - tor.y) / (tor.r * tor.esc[1]);
  const info = { ancho: 0.62, ojosY: def.ojosY ?? 0.12, ojosZ: def.ojosZ ?? tipoCab.ojosZ ?? 0.88, sep: def.ojosSep ?? 0.38, cima: forma.cima ?? tipoCab.cima,
    cuelloY: CAB.y - CAB.esc * 0.72, cuelloR: tor.r * 0.82, espaldaY: tor.y, espaldaZ: -tor.r * tor.esc[2] - 0.02,
    pechoY, pechoZ: tor.r * tor.esc[2] * Math.sqrt(Math.max(0.1, 1 - dyP * dyP)) + 0.01, ...(forma.info || {}) };
  // punto sobre la piel de la cabeza (en cabezas de cara plana x, y son coordenadas directas)
  const sobreCab = (x, y, z, salir = 0) => tipoCab.plano ? [new THREE.Vector3(x, y, tipoCab.plano.z + salir), new THREE.Vector3(0, 0, 1)] : sobre(tipoCab, x, y, z, salir);
  if (def.parches) for (const s of [-1, 1]) cab.add(malla(esf(0.2), clay(def.parches), { pos: [s * info.sep, info.ojosY - 0.03, info.ojosZ - 0.02], esc: [1, 1.25, 0.45], rot: [0, s * 0.34, s * -0.4] }));
  // cachetes difuminados, pegados a la piel
  const geoC = new THREE.PlaneGeometry(0.36, 0.24), matC = new THREE.MeshBasicMaterial({ map: TEX_CACHETE, transparent: true, depthWrite: false, opacity: 0.85 });
  for (const s of [-1, 1]) {
    const [p, n] = tipoCab.plano ? sobreCab(s * tipoCab.plano.mejX, info.ojosY - 0.17, 0, 0.005) : sobreCab(s * 0.58, info.ojosY - 0.17, 0.8, def.mejillaSalir ?? 0.012);
    const ch = malla(geoC, matC); ch.castShadow = false; pegar(cab, ch, p, n);
  }
  // ojos
  const ojos = new THREE.Group(); ojos.position.y = info.ojosY; cab.add(ojos);
  // los estilos planos (corazon, estrella, arcos) se asientan sobre la piel para que no se hundan
  const zPiel = (px, py) => { if (tipoCab.plano) return tipoCab.plano.z; const d = new THREE.Vector3(px, py, 0.8);
    for (let i = 0; i < 5; i++) { const [p] = sobre(tipoCab, d.x, d.y, d.z); d.x *= px / (p.x || 1e-3) || 1; d.y *= py / (p.y || 1e-3) || 1; }
    return sobre(tipoCab, d.x, d.y, d.z)[0].z; };
  const estilo = op.ojos || 'normal', zOjo = estilo === 'normal' ? info.ojosZ : Math.max(info.ojosZ, def.ojosZPlano ?? 0, zPiel(info.sep, info.ojosY) - 0.02);
  for (const s of [-1, 1]) { const o = ojo(estilo); o.position.set(s * info.sep, 0, zOjo); o.rotation.y = s * (tipoCab.ojoRot ?? 0.34); ojos.add(o); }
  // boca (bocaPos de la especie si tiene hocico)
  const [bocaY, bocaZ] = def.bocaPos ?? [info.ojosY - 0.15, sobreCab(0, info.ojosY - 0.15, 0.95)[0].z];
  let boca = null, bocaAbierta = null;
  if (def.boca === 'gato') {
    boca = new THREE.Group(); boca.position.set(0, bocaY - 0.04, bocaZ - 0.012);
    for (const s of [-1, 1]) boca.add(malla(arco(0.045, 0.014), plano(NEGRO_OJO), { pos: [s * 0.045, 0, 0], rot: [0, 0, Math.PI] }));
    cab.add(boca);
  } else if (def.boca === 'piquito') {
    const pico = malla(esf(0.09, 20), clay(0xffa04a), { pos: [0, bocaY + 0.01, bocaZ + 0.02], esc: [1.3, 0.75, 1.2] });
    cab.add(pico); cab.userData.mandibula = pico;
  } else if (!def.boca || def.boca === 'sonrisa') {
    const ancha = def.boca === 'sonrisa';
    boca = malla(arco(ancha ? 0.11 : 0.065, 0.02), plano(NEGRO_OJO), { pos: [0, bocaY + (ancha ? 0.02 : 0), bocaZ - 0.01], rot: [0, 0, Math.PI], esc: [1, ancha ? 0.6 : 1, 1] });
    bocaAbierta = malla(esf(0.085, 20), plano(0x8a2a4a), { pos: [0, bocaY - 0.05, bocaZ - 0.045], esc: [1, 0.85, 0.4] });
    bocaAbierta.add(malla(esf(0.045, 12), plano(0xff8fa3), { pos: [0, -0.03, 0.04] }));
    bocaAbierta.visible = false; cab.add(boca, bocaAbierta);
  }
  // torso con pancita (la gota no tiene torso: es de una pieza)
  if (!tor.ninguno) {
    cuerpo.add(malla(tor.cubo ? superesfera(4, 36) : esf(1), pielTorso, { pos: [0, tor.y, 0], esc: tor.esc.map((e) => e * tor.r) }));
    const panza = forma.panza ?? 'ovalo', zPanza = tor.r * tor.esc[2] * 0.45;
    if (panza === 'ovalo' || panza === 'escamas') cuerpo.add(malla(esf(1), panza === 'escamas' ? matPiel(PIELES.escamas(colores.panza), colores.panza) : clay(colores.panza), { pos: [0, tor.y - 0.06, zPanza], esc: [tor.r * 0.78, tor.r * tor.esc[1] * 0.82, tor.r * 0.62] }));
    else if (panza === 'panel') {  // pantallita de robot con foquitos
      const zf = tor.r * tor.esc[2];
      cuerpo.add(malla(superesfera(4, 24), clay(0x3a3f55, { roughness: 0.2, clearcoat: 1, sheen: 0 }), { pos: [0, tor.y + 0.02, zf - 0.02], esc: [0.26, 0.19, 0.06] }));
      [0xff6b8a, 0xffd75e, 0x6be08a].forEach((c, i) => cuerpo.add(malla(esf(0.035, 10), plano(c), { pos: [(i - 1) * 0.1, tor.y + 0.07, zf + 0.03] })));
      cuerpo.add(malla(new THREE.BoxGeometry(0.26, 0.03, 0.02), plano(0x7fe0d1), { pos: [0, tor.y - 0.05, zf + 0.03] }));
    }
  }
  const atras = -tor.r * tor.esc[2];
  // bracitos: el pivote es el hombro (asi el saludo levanta todo el brazo)
  const tipoBrazo = forma.brazos ?? def.brazos ?? 'mano', matExt = forma.extremidades != null ? clay(forma.extremidades) : null;
  const colPie = forma.pies ?? forma.extremidades ?? def.pies, matPie = colPie != null ? clay(colPie) : clay(oscurecer(color, 0.05), acabado);
  const acero = metal(0xc9ced8), blanco = clay(0xffffff);
  const brazos = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * tor.hombro, tor.y + 0.25, 0.04);
    if (tipoBrazo === 'robot') {
      piv.add(malla(esf(0.09, 16), acero));
      piv.add(malla(new THREE.CylinderGeometry(0.055, 0.055, 0.3, 12), acero, { pos: [s * 0.08, -0.16, 0], rot: [0, 0, s * 0.45] }));
      piv.add(malla(esf(0.065, 12), acero, { pos: [s * 0.15, -0.29, 0.01] }));
      piv.add(malla(new THREE.TorusGeometry(0.08, 0.032, 8, 16, Math.PI * 1.4), acero, { pos: [s * 0.18, -0.37, 0.02], rot: [Math.PI / 2, 0, s * 0.6] }));
    } else if (tipoBrazo === 'ala') {  // alita con dos plumas en la punta
      piv.add(malla(esf(0.2, 24), piel, { pos: [s * 0.08, -0.18, -0.02], rot: [0, 0, s * 0.35], esc: [0.38, 1, 0.7] }));
      piv.add(malla(esf(0.09, 16), piel, { pos: [s * 0.15, -0.34, -0.02], rot: [0, 0, s * 0.7], esc: [0.4, 1, 0.7] }));
      piv.add(malla(esf(0.08, 16), piel, { pos: [s * 0.09, -0.36, -0.01], rot: [0, 0, s * 0.25], esc: [0.4, 1, 0.7] }));
    } else if (tipoBrazo === 'aleta') {
      piv.add(malla(esf(1, 24), piel, { pos: [s * 0.1, -0.2, 0], rot: [0, 0, s * 0.3], esc: [0.075, 0.27, 0.15] }));
    } else {
      piv.add(malla(new THREE.CapsuleGeometry(0.1, 0.22, 6, 12), matExt ?? piel, { pos: [s * 0.08, -0.17, 0], rot: [0, 0, s * 0.45] }));
      if (tipoBrazo === 'pezuna') piv.add(malla(new THREE.CylinderGeometry(0.1, 0.115, 0.1, 20), matPie, { pos: [s * 0.17, -0.31, 0.01], rot: [0, 0, s * 0.45] }));
      else {
        piv.add(malla(esf(0.115, 20), matExt ?? clay(aclarar(color, 0.12), acabado), { pos: [s * 0.17, -0.33, 0.02], esc: [1, 0.92, 0.95] }));
        if (tipoBrazo === 'garra') for (const k of [-1, 0, 1]) piv.add(malla(new THREE.ConeGeometry(0.025, 0.07, 6), blanco, { pos: [s * 0.17 + k * 0.05, -0.41, 0.07], rot: [Math.PI, 0, 0] }));
      }
    }
    cuerpo.add(piv); brazos.push(piv);
  }
  // piernitas y pies (fuera del "cuerpo" para que no se aplasten al rebotar); la planta queda en y = -1.06
  const tipoPie = forma.pie ?? 'pata';
  for (const s of [-1, 1]) {
    const x = s * Math.min(0.24, tor.r * 0.42);
    if (forma.patas !== 'ninguna' && tipoPie !== 'nub') {
      const largo = 0.16 + alzar, rad = tipoPie === 'palmeada' ? 0.055 : tipoPie === 'garra' ? 0.15 : largas ? 0.1 : 0.13;
      if (tipoPie === 'robot') raiz.add(malla(new THREE.CylinderGeometry(0.07, 0.07, largo + 0.2, 12), acero, { pos: [x, -0.98 + (largo + 0.2) / 2, 0] }));
      else raiz.add(malla(new THREE.CapsuleGeometry(rad, largo, 6, 14), matExt ?? (tipoPie === 'palmeada' ? matPie : piel), { pos: [x, -0.98 + (largo + 2 * rad) / 2, 0] }));
    }
    if (tipoPie === 'palmeada') raiz.add(malla(pataPato(), matPie, { pos: [x, -0.995, -0.03], rot: [0, s * 0.25, 0] }));
    else if (tipoPie === 'pezuna') {
      raiz.add(malla(new THREE.CylinderGeometry(0.13, 0.15, 0.15, 24), matPie, { pos: [x, -0.985, 0.02] }));
      raiz.add(malla(new THREE.TorusGeometry(0.135, 0.02, 8, 24), metal(0xffd36b), { pos: [x, -0.92, 0.02], rot: [Math.PI / 2, 0, 0] }));
    } else if (tipoPie === 'robot') raiz.add(malla(superesfera(4, 24), clay(0x4a4f66, { roughness: 0.4, clearcoat: 0.6, sheen: 0 }), { pos: [x, -0.975, 0.06], esc: [0.17, 0.09, 0.24] }));
    else if (tipoPie === 'nub') raiz.add(malla(esf(0.15, 20), piel, { pos: [x * 1.15, -0.97, 0.14], esc: [1.15, 0.6, 1.3] }));
    else {
      const largoPie = tipoPie === 'conejo' ? 1.9 : 1.35, zPie = tipoPie === 'conejo' ? 0.15 : 0.08, r = tipoPie === 'garra' ? 0.19 : 0.17;
      raiz.add(malla(esf(r, 24), matPie, { pos: [x, -1.06 + r * 0.6, zPie], esc: [1.1, 0.6, largoPie] }));
      const punta = zPie + r * largoPie * 0.82;
      for (const d of [-1, 0, 1]) {  // deditos o garritas
        if (tipoPie === 'garra') raiz.add(malla(new THREE.ConeGeometry(0.035, 0.1, 8), blanco, { pos: [x + d * 0.08, -1.02, punta + 0.04], rot: [Math.PI / 2, 0, 0] }));
        else raiz.add(malla(esf(0.055, 12), matPie, { pos: [x + d * 0.075, -1.0, punta - Math.abs(d) * 0.035] }));
      }
    }
  }
  const sombrero = !!PRENDAS.cabeza[eq.cabeza];
  const sobreTorso = (x, y, z, salir = 0) => { const [p, n] = sobre({ esc: tor.esc.map((e) => e * tor.r), deform: tor.cubo ? cuadrar(4) : null }, x, y, z, salir); p.y += tor.y; return [p, n]; };
  def.extras?.(cab, colores, def, { cuerpo, raiz, piel, tor, info, ojos, atras, sombrero, sobre: sobreCab, sobreTorso });
  // prendas: cabeza y cara van en la cabeza; cuello y espalda en el cuerpo
  for (const slot of ['cabeza', 'cara', 'cuello', 'espalda']) {
    const f = PRENDAS[slot]?.[eq[slot]];
    if (f) { const p = aplicarAcabado(f(info), op.acabados?.[slot]); (slot === 'cabeza' || slot === 'cara' ? cab : cuerpo).add(p); Object.assign(cuerpo.userData, p.userData); p.userData.prendaSlot = slot; }
  }
  Object.assign(cuerpo.userData, cab.userData);
  cuerpo.userData.bocaY = alzar + CAB.y + CAB.esc * (bocaY - 0.02);
  cuerpo.userData.bocaZ = CAB.esc * bocaZ;
  cuerpo.userData.cab = cab;
  crecerYBrillar(raiz, op);
  return { raiz, cuerpo, ojos, boca, bocaAbierta, brazos, mandibula: cuerpo.userData.mandibula, foco: cuerpo.userData.foco, ud: cuerpo.userData, estiloOjos: op.ojos || 'normal' };
}

/* ============================================================ muebles del cuarto (8 lugares) */
const g0 = () => new THREE.Group();

/* ---------- utilidades solo del cuarto (no tocan las de la mascota) */
// materiales y texturas del cuarto: se guardan para siempre (liberar() no los destruye)
function matCuarto(llave, crear) { const k = 'cuarto|' + llave; if (!cacheMat.has(k)) cacheMat.set(k, crear()); return cacheMat.get(k); }
const cacheTexCuarto = new Map();
function texCuarto(llave, dibujar, tam = 256, rep = null) {
  if (cacheTexCuarto.has(llave)) return cacheTexCuarto.get(llave);
  const t = texCanvas(dibujar, tam); t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); }
  TEXTURAS_FIJAS.add(t); cacheTexCuarto.set(llave, t); return t;
}
const conTex = (llave, tex, extra = {}) => matCuarto('t|' + llave, () => clay(0xffffff, { map: tex, ...extra }));
const tela = (c) => clay(c, { roughness: 0.92, sheen: 1, sheenRoughness: 0.45, clearcoat: 0 });
const madera = (c) => clay(c, { roughness: 0.55, sheen: 0.15, clearcoat: 0.3, clearcoatRoughness: 0.35 });
const ceramica = (c) => clay(c, { roughness: 0.28, sheen: 0, clearcoat: 0.9, clearcoatRoughness: 0.12 });
const luz = (c) => matCuarto('luz|' + c, () => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
const hex = (c) => '#' + new THREE.Color(c).getHexString();
const azarCon = (s) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const cil = (r1, r2, h, s = 24, abierto = false) => new THREE.CylinderGeometry(r1, r2, h, s, 1, abierto);
// detalle chico: no proyecta sombra (ahorra dibujado en el mapa de sombras)
function det(geo, mat, o) { const m = malla(geo, mat, o); m.castShadow = false; return m; }
// muchas piezas iguales en una sola llamada de dibujo: [{ pos, esc, rot | quat, color }]
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _e4 = new THREE.Euler(), _p4 = new THREE.Vector3(), _s4 = new THREE.Vector3();
function muchos(geo, mat, lista, sombra = false) {
  const im = new THREE.InstancedMesh(geo, mat, lista.length);
  lista.forEach((it, i) => {
    if (it.quat) _q4.copy(it.quat); else _q4.setFromEuler(_e4.set(...(it.rot || [0, 0, 0])));
    im.setMatrixAt(i, _m4.compose(_p4.set(...it.pos), _q4, _s4.set(...(it.esc || [1, 1, 1]))));
    if (it.color !== undefined) im.setColorAt(i, new THREE.Color(it.color));
  });
  im.castShadow = sombra; im.receiveShadow = true; return im;
}
// caja redondeada: esfera partida en 8 y estirada (sus normales ya son las correctas)
function cajaR(w, h, d, r = 0.06, s = 3) {
  r = Math.max(0.005, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
  const g = new THREE.SphereGeometry(1, s * 4 + 1, s * 2 + 1), p = g.attributes.position, hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  // signo con tolerancia: la costura (z≈±0) y los polos (x,z≈1e-16) deben caer en el mismo punto, si no la tapa queda con un hueco triangular
  const sg = (v) => (Math.abs(v) < 1e-6 ? 0 : Math.sign(v));
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x * r + sg(x) * hw, y * r + sg(y) * hh, z * r + sg(z) * hd); }
  g.computeBoundingSphere(); return g;
}
// cojin esponjado: esfera "cuadrada" con las esquinas mas delgadas
function cojinGeo(w, h, d) {
  const g = esf(1, 24), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ex = Math.sign(x) * Math.abs(x) ** 0.6, ez = Math.sign(z) * Math.abs(z) ** 0.6;
    p.setXYZ(i, ex * w / 2, y * h / 2 * (1 - 0.5 * Math.max(Math.abs(ex), Math.abs(ez)) ** 3), ez * d / 2);
  }
  g.computeVertexNormals(); return g;
}
// perfil girado (macetas, copas, bases): pares [radio, altura]
const torno = (pts, s = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), s);
// hoja: forma de gota extruida con bisel suave (se ve de plastilina)
function hojaGeo(l = 0.4, a = 0.16) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(a, l * 0.45, 0, l); s.quadraticCurveTo(-a, l * 0.45, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -0.004); return g;
}
const TEX_HALO = texCuarto('halo', (x, n) => {
  const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n);
}, 64);
// resplandor que siempre mira a la camara (sin costo de luz real)
const _hp = new THREE.Vector3(), _hs = new THREE.Vector3(), _hq = new THREE.Quaternion();
function halo(color, tam, opacidad = 0.5, mirar = true) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam), matCuarto(`halo|${color}|${opacidad}`, () => new THREE.MeshBasicMaterial({ map: TEX_HALO, color, transparent: true, opacity: opacidad, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  if (mirar) m.onBeforeRender = (r, e, cam) => { m.matrixWorld.decompose(_hp, _hq, _hs); m.matrixWorld.compose(_hp, cam.quaternion, _hs); };
  m.raycast = () => {}; m.renderOrder = 2; return m;
}
// sombra de contacto bajo cada mueble (oclusion falsa, muy barata)
function sombraContacto(w, d, op = 0.42) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), matCuarto('contacto|' + op, () => new THREE.MeshBasicMaterial({ map: TEX_SOMBRA, transparent: true, opacity: op, depthWrite: false })));
  m.rotation.x = -Math.PI / 2; m.raycast = () => {}; return m;
}
// dibuja algo repetido en los bordes para que la textura empate sin costuras
const envolver = (n, x, y, f) => { for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) f(x + dx, y + dy); };

// estampados de las cobijas (se dibujan una vez)
const COBIJAS = {
  nube: (x, n) => { x.fillStyle = '#9fd3ff'; x.fillRect(0, 0, n, n);
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2; x.setLineDash([6, 5]);
    for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(i * n / 4, 0); x.lineTo(i * n / 4, n); x.moveTo(0, i * n / 4); x.lineTo(n, i * n / 4); x.stroke(); }
    x.setLineDash([]);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const cx = (i + 0.5) * n / 4, cy = (j + 0.5) * n / 4;
      if ((i + j) % 2) { x.fillStyle = '#ffffff'; for (const [dx, dy, r] of [[-12, 4, 11], [0, -4, 14], [13, 4, 10]]) { x.beginPath(); x.arc(cx + dx, cy + dy, r, 0, 7); x.fill(); } x.fillRect(cx - 22, cy + 4, 44, 10); }
      else { x.fillStyle = '#ffe27a'; x.beginPath(); for (let k = 0; k <= 10; k++) { const r = k % 2 ? 6 : 14, a = k / 10 * Math.PI * 2 - Math.PI / 2; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.fill(); } } },
  princesa: (x, n) => { x.fillStyle = '#ff9ccf'; x.fillRect(0, 0, n, n);
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 3; const k = n / 6;
    for (let i = -6; i <= 12; i++) { x.beginPath(); x.moveTo(i * k, 0); x.lineTo(i * k + n, n); x.stroke(); x.beginPath(); x.moveTo(i * k, 0); x.lineTo(i * k - n, n); x.stroke(); }
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) { x.fillStyle = (i + j) % 2 ? '#ffffff' : '#ffd75e'; x.beginPath(); x.arc(i * k + ((j % 2) * k) / 2 * 0, j * k, 3.5, 0, 7); x.fill(); }
    x.strokeStyle = '#ffd75e'; x.lineWidth = 8; x.strokeRect(4, 4, n - 8, n - 8); },
  gamer: (x, n) => { x.fillStyle = '#7a52e6'; x.fillRect(0, 0, n, n); const p = n / 32;
    for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) if ((i * 7 + j * 13) % 11 === 0) { x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(i * p, j * p, p, p); }
    const bicho = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'];
    [[3, 4, '#3ef0ff'], [18, 14, '#ff4fd8'], [5, 22, '#ffe27a']].forEach(([ox, oy, col]) => { x.fillStyle = col; bicho.forEach((f, j) => [...f].forEach((b, i) => { if (b === '1') x.fillRect((ox + i) * p, (oy + j) * p, p, p); })); });
    x.strokeStyle = '#3ef0ff'; x.lineWidth = 6; x.strokeRect(3, 3, n - 6, n - 6); },
};
// lo que se ve en las pantallas
const PANTALLAS = {
  show: (x, n) => { const g = x.createLinearGradient(0, 0, 0, n); g.addColorStop(0, '#7fc8ff'); g.addColorStop(1, '#d9f1ff'); x.fillStyle = g; x.fillRect(0, 0, n, n);
    ['#ff9ccf', '#ffb38a', '#ffe27a', '#9fe3a6', '#8fd0ff', '#c3a3ff'].forEach((c, i) => { x.strokeStyle = c; x.lineWidth = n * 0.045; x.beginPath(); x.arc(n / 2, n * 0.95, n * (0.62 - i * 0.045), Math.PI, 0); x.stroke(); });
    x.fillStyle = '#fff'; for (const [cx, cy] of [[0.18, 0.78], [0.82, 0.8]]) for (const [dx, r] of [[-18, 16], [0, 24], [18, 15]]) { x.beginPath(); x.arc(n * cx + dx, n * cy, r, 0, 7); x.fill(); }
    x.fillStyle = '#ffd75e'; x.beginPath(); x.arc(n * 0.5, n * 0.62, n * 0.13, 0, 7); x.fill();
    x.fillStyle = '#3a2a40'; for (const s of [-1, 1]) { x.beginPath(); x.arc(n * 0.5 + s * n * 0.045, n * 0.6, n * 0.016, 0, 7); x.fill(); }
    x.strokeStyle = '#3a2a40'; x.lineWidth = 3; x.beginPath(); x.arc(n * 0.5, n * 0.64, n * 0.03, 0.2, Math.PI - 0.2); x.stroke();
    x.fillStyle = '#ffa04a'; x.beginPath(); x.ellipse(n * 0.5, n * 0.635, n * 0.03, n * 0.014, 0, 0, 7); x.fill();
    const v = x.createRadialGradient(n / 2, n / 2, n * 0.3, n / 2, n / 2, n * 0.72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,20,80,.45)'); x.fillStyle = v; x.fillRect(0, 0, n, n);
    x.fillStyle = 'rgba(255,255,255,.08)'; for (let y = 0; y < n; y += 4) x.fillRect(0, y, n, 1); },
  juego: (x, n) => { const g = x.createLinearGradient(0, 0, 0, n); g.addColorStop(0, '#5b3fd6'); g.addColorStop(1, '#ff8fc8'); x.fillStyle = g; x.fillRect(0, 0, n, n);
    const p = n / 32;
    x.fillStyle = '#fff'; for (let i = 0; i < 14; i++) x.fillRect(((i * 37) % 32) * p, ((i * 11) % 14) * p, p * 0.6, p * 0.6);
    for (let i = 0; i < 32; i++) { x.fillStyle = '#4fd18a'; x.fillRect(i * p, 26 * p, p, p); x.fillStyle = i % 2 ? '#a0603c' : '#8a5030'; x.fillRect(i * p, 27 * p, p, 5 * p); }
    for (const [bx, by] of [[10, 18], [11, 18], [12, 18], [20, 14], [21, 14]]) { x.fillStyle = '#ffb347'; x.fillRect(bx * p, by * p, p, p); x.fillStyle = '#ffe27a'; x.fillRect(bx * p + 1, by * p + 1, p - 3, p - 3); }
    x.fillStyle = '#ffe27a'; for (const [cx, cy] of [[11, 15], [20.5, 11], [26, 22], [15, 22]]) { x.beginPath(); x.ellipse(cx * p, cy * p, p * 0.45, p * 0.6, 0, 0, 7); x.fill(); }
    const heroe = ['0011100', '0111110', '0101010', '0111110', '0011100', '0111110', '0100010'];
    heroe.forEach((f, j) => [...f].forEach((b, i) => { if (b === '1') { x.fillStyle = j < 5 ? '#ffd75e' : '#ff7a59'; x.fillRect((5 + i) * p, (19 + j) * p, p, p); } }));
    x.fillStyle = '#fff'; x.font = `bold ${p * 2}px monospace`; x.fillText('★ 0420', p, p * 2.6); x.fillText('1UP', n - p * 7, p * 2.6); },
};
// mueble bajo de madera para la tele (con cajones y patitas)
function muebleTele() {
  const g = g0(), mad = madera(0xf0c595);
  for (const x of [-0.56, 0.56]) for (const z of [-0.2, 0.2]) g.add(det(cil(0.035, 0.025, 0.16, 8), madera(0xc98f62), { pos: [x, 0.08, z] }));
  g.add(malla(cajaR(1.32, 0.44, 0.58, 0.06), mad, { pos: [0, 0.38, 0] }));
  for (const s of [-1, 1]) { g.add(det(cajaR(0.58, 0.32, 0.02, 0.03), madera(0xf8d5ad), { pos: [s * 0.32, 0.38, 0.29] })); g.add(det(esf(0.03, 10), clay(0xff9e8a), { pos: [s * 0.32, 0.38, 0.31] })); }
  return g;
}
// cama base: patas, base, colchon, cobija estampada con doblez, dos almohadas y piecera
function camaBase({ marco, cobija, borde = 0xffffff, almohada = 0xffffff, pata = null }) {
  const g = g0(), mMarco = madera(marco);
  for (const x of [-0.7, 0.7]) for (const z of [-0.98, 0.98]) g.add(det(cil(0.07, 0.055, 0.16, 12), madera(pata ?? oscurecer(marco, 0.12)), { pos: [x, 0.08, z] }));
  g.add(malla(cajaR(1.66, 0.26, 2.2, 0.08), mMarco, { pos: [0, 0.28, 0] }));
  g.add(malla(cajaR(1.54, 0.24, 2.06, 0.1), tela(0xffffff), { pos: [0, 0.48, 0.02] }));
  const tex = texCuarto('cobija-' + cobija, COBIJAS[cobija], 256);
  const base = { nube: 0x9fd3ff, princesa: 0xff9ccf, gamer: 0x7a52e6 }[cobija];
  g.add(malla(cajaR(1.62, 0.2, 1.42, 0.08), tela(base), { pos: [0, 0.53, 0.37] }));
  const estampado = conTex('cobija-' + cobija, tex, { roughness: 0.92, clearcoat: 0, sheen: 1 });
  g.add(det(new THREE.PlaneGeometry(1.5, 1.3), estampado, { pos: [0, 0.632, 0.4], rot: [-Math.PI / 2, 0, 0] })).children.at(-1).name = 'cobija';
  g.add(det(cajaR(1.64, 0.1, 0.24, 0.05), tela(borde), { pos: [0, 0.62, -0.31] })).children.at(-1).name = 'doblez';
  const cojG = cojinGeo(0.62, 0.22, 0.42);
  for (const s of [-1, 1]) g.add(malla(cojG, tela(almohada), { pos: [s * 0.36, 0.71, -0.74], rot: [-0.35, s * 0.08, 0] }));
  g.add(malla(cajaR(1.66, 0.36, 0.12, 0.05), mMarco, { pos: [0, 0.4, 1.1] }));
  // para acostar a la mascota: altura de la cobija, hasta donde llega la cabeza (almohadas) y los pies, medio ancho util
  g.userData.colchon = { y: 0.632, cab: -0.66, pie: 1.0, ancho: 0.74, cobija: estampado, borde: tela(borde) };
  return g;
}

export const MUEBLES = {
  tapete: {
    // tapete tejido redondo: anillos trenzados con puntadas y florecitas
    redondo: () => { const g = g0();
      const tex = texCuarto('tap-redondo', (x, n) => {
        const c = n / 2, anillos = ['#f6b49c', '#fff1e2', '#f7c7b3', '#ffe3d3', '#f3a98f', '#fff6ec', '#ffd2bf'];
        anillos.forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(c, c, c * (1 - i * 0.13), 0, 7); x.fill(); });
        x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 3; x.setLineDash([7, 7]);
        for (const k of [0.93, 0.67, 0.41]) { x.beginPath(); x.arc(c, c, c * k, 0, 7); x.stroke(); }
        x.setLineDash([]);
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, px = c + Math.cos(a) * c * 0.8, py = c + Math.sin(a) * c * 0.8;
          x.fillStyle = i % 2 ? '#c9b3ff' : '#ff8fa8'; for (let p = 0; p < 5; p++) { const b = p / 5 * Math.PI * 2; x.beginPath(); x.arc(px + Math.cos(b) * 6, py + Math.sin(b) * 6, 4.5, 0, 7); x.fill(); }
          x.fillStyle = '#ffe27a'; x.beginPath(); x.arc(px, py, 3.5, 0, 7); x.fill(); }
      }, 512);
      const borde = tela(0xf0a58c);
      g.add(det(cil(1.1, 1.12, 0.035, 56), [borde, conTex('tap-redondo', tex, { roughness: 0.95, clearcoat: 0 }), borde], { pos: [0, 0.018, 0] }));
      g.add(det(new THREE.TorusGeometry(1.1, 0.03, 8, 72), borde, { pos: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0] }));
      return g; },
    // arcoiris pastel con nubecitas esponjadas en las orillas
    arcoiris: () => { const g = g0();
      const tex = texCuarto('tap-arcoiris', (x, n) => {
        const c = n / 2, bandas = ['#ffffff', '#ff9ccf', '#ffb38a', '#ffe27a', '#9fe3a6', '#8fd0ff', '#c3a3ff', '#fff4fb'];
        bandas.forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(c, c, c * (1 - i * 0.115), 0, 7); x.fill(); });
        x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 2.5; x.setLineDash([6, 6]);
        for (let i = 1; i < 8; i++) { x.beginPath(); x.arc(c, c, c * (1 - i * 0.115) + 1, 0, 7); x.stroke(); }
        x.setLineDash([]); x.fillStyle = '#fff'; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; x.beginPath(); x.arc(c + Math.cos(a) * 18, c + Math.sin(a) * 18, 3, 0, 7); x.fill(); }
      }, 512);
      g.add(det(cil(1.18, 1.2, 0.035, 56), [tela(0xffd6ec), conTex('tap-arcoiris', tex, { roughness: 0.95, clearcoat: 0 }), tela(0xffd6ec)], { pos: [0, 0.018, 0] }));
      g.add(det(new THREE.TorusGeometry(1.18, 0.035, 8, 72), tela(0xffffff), { pos: [0, 0.032, 0], rot: [Math.PI / 2, 0, 0] }));
      const nubes = [];
      for (const s of [-1, 1]) for (const [dx, dy, r] of [[0, 0.1, 0.2], [0.17, 0.07, 0.15], [-0.17, 0.07, 0.15], [0.05, 0.05, 0.13]]) nubes.push({ pos: [s * 1.12 + dx * s, dy, 0.55 + dx * 0.4], esc: [r, r * 0.72, r] });
      g.add(muchos(esf(1, 20), tela(0xffffff), nubes));
      const estrella = det(estrellaGeo(0.1, 0.045), luz(0xffe27a), { pos: [0, 0.05, -0.02], rot: [-Math.PI / 2, 0, 0] }); g.add(estrella);
      g.userData.piezas = { estrella };
      return g; },
    // tapete de osito (piel de peluche con carita)
    oso: () => { const g = g0();
      const tex = texCuarto('tap-oso', (x, n) => {
        const k = n / 256, cafe = '#d8a274', claro = '#f3d2ae';
        x.fillStyle = cafe;
        const ov = (cx, cy, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx * k, cy * k, rx * k, ry * k, 0, 0, 7); x.fill(); };
        for (const [cx, cy] of [[52, 150], [204, 150], [70, 222], [186, 222]]) ov(cx, cy, 34, 30, cafe);   // patitas
        ov(128, 165, 82, 72, cafe); ov(128, 172, 50, 44, claro);                                            // cuerpo y panza
        ov(78, 30, 24, 24, cafe); ov(178, 30, 24, 24, cafe); ov(78, 32, 13, 13, '#f2a7a0'); ov(178, 32, 13, 13, '#f2a7a0');
        ov(128, 74, 62, 54, cafe);                                                                          // cabeza
        for (const [cx, cy] of [[52, 158], [204, 158], [70, 230], [186, 230]]) ov(cx, cy, 14, 12, claro);
        ov(100, 70, 7, 8, '#3a2a2a'); ov(156, 70, 7, 8, '#3a2a2a'); ov(102, 67, 2.5, 2.5, '#fff'); ov(158, 67, 2.5, 2.5, '#fff');
        ov(86, 88, 11, 7, 'rgba(255,130,150,.55)'); ov(170, 88, 11, 7, 'rgba(255,130,150,.55)');
        x.strokeStyle = 'rgba(120,70,40,.35)'; x.lineWidth = 2 * k; x.setLineDash([5 * k, 5 * k]); x.beginPath(); x.ellipse(128 * k, 172 * k, 42 * k, 36 * k, 0, 0, 7); x.stroke();
      }, 512);
      const m = det(new THREE.PlaneGeometry(2.3, 2.3), conTex('tap-oso', tex, { roughness: 0.95, clearcoat: 0, alphaTest: 0.5 }), { pos: [0, 0.012, -0.45], rot: [-Math.PI / 2, 0, 0] }); g.add(m);
      const hocico = det(esf(0.16, 20), tela(0xf3d2ae), { pos: [0, 0.035, -0.74], esc: [1.1, 0.45, 0.8] }); g.add(hocico);   // hocico
      g.userData.piezas = { hocico };
      g.add(det(esf(0.06, 14), brillo(0x3a2a2a), { pos: [0, 0.085, -0.8], esc: [1.3, 0.8, 1] }));     // naricita
      return g; },
  },
  cama: {
    // cama de nube: cabecera esponjada, cobija de cielo con estrellitas
    nube: () => { const g = camaBase({ marco: 0xf2cfa5, cobija: 'nube', borde: 0xffffff });
      const nubeG = esf(1, 28);
      for (const [x, y, r] of [[-0.55, 0.92, 0.36], [0, 1.08, 0.46], [0.55, 0.92, 0.36], [-0.28, 1.12, 0.3], [0.3, 1.1, 0.3]]) g.add(malla(nubeG, tela(0xf4f8ff), { pos: [x, y, -1.06], esc: [r, r * 0.92, 0.16] }));
      g.add(malla(cajaR(1.66, 0.5, 0.14, 0.06), madera(0xf2cfa5), { pos: [0, 0.6, -1.06] }));
      g.add(det(estrellaGeo(0.12, 0.055), tela(0xffd75e), { pos: [0.45, 0.68, 0.55], rot: [-1.2, 0, 0.3] }));
      return g; },
    // cama de princesa: cabecera de corazon con corona, dosel de tul y lucecitas
    princesa: () => { const g = camaBase({ marco: 0xfff0f6, cobija: 'princesa', borde: 0xffffff, almohada: 0xfff4fa, pata: 0xffcf3f });
      g.userData.colchon.techo = 1.92;   // el dosel: al brincar no se pega
      const oro = metal(0xffcf3f);
      g.add(malla(corazonGeo(0.62), tela(0xff9ccf), { pos: [0, 1.0, -1.05], esc: [1, 0.95, 0.45] }));
      g.add(malla(cajaR(1.66, 0.42, 0.12, 0.05), clay(0xfff0f6), { pos: [0, 0.58, -1.08] }));
      g.add(muchos(esf(0.035, 10), oro, [[-0.25, 1.05], [0.25, 1.05], [0, 0.82], [0, 1.25]].map(([x, y]) => ({ pos: [x, y, -0.96] }))));
      // coronita
      const cor = g0(); cor.position.set(0, 1.62, -1.05);
      cor.add(det(cil(0.17, 0.15, 0.1, 20), oro));
      const ang = [0, 1, 2, 3, 4].map((i) => (i / 5) * Math.PI * 2);
      cor.add(muchos(new THREE.ConeGeometry(0.045, 0.13, 8), oro, ang.map((a) => ({ pos: [Math.cos(a) * 0.15, 0.1, Math.sin(a) * 0.15] }))));
      cor.add(muchos(esf(0.025, 8), luz(0xffffff), ang.map((a, i) => ({ pos: [Math.cos(a) * 0.15, 0.17, Math.sin(a) * 0.15], color: i % 2 ? 0xff7bb0 : 0x7fe9ff }))));
      g.add(cor);
      // postes dorados y dosel
      const esquinas = [[-0.78, -1.05], [-0.78, 1.05], [0.78, -1.05], [0.78, 1.05]];
      g.add(muchos(cil(0.035, 0.04, 2.0, 12), oro, esquinas.map(([x, z]) => ({ pos: [x, 1.15, z] })), true));
      g.add(muchos(esf(0.07, 14), oro, esquinas.map(([x, z]) => ({ pos: [x, 2.18, z] }))));
      g.add(malla(cajaR(1.66, 0.06, 2.2, 0.03), oro, { pos: [0, 2.12, 0] }));
      const tul = clay(0xffc4e1, { transparent: true, opacity: 0.6, side: THREE.DoubleSide, sheen: 1, clearcoat: 0, depthWrite: false });
      g.add(det(cajaR(1.62, 0.04, 2.16, 0.02), tela(0xffd6ea), { pos: [0, 2.16, 0] }));
      // faldon de holanes alrededor del dosel
      const holan = texCuarto('holan', (x, n) => { x.clearRect(0, 0, n, n); x.fillStyle = '#ffb3d6'; x.fillRect(0, 0, n, n * 0.45);
        for (let i = 0; i < 4; i++) { x.beginPath(); x.arc((i + 0.5) * n / 4, n * 0.45, n / 8, 0, Math.PI); x.fill(); }
        x.fillStyle = '#fff'; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc((i + 0.5) * n / 8, n * 0.25, n * 0.025, 0, 7); x.fill(); }
        x.fillStyle = '#ffd75e'; x.fillRect(0, 0, n, n * 0.07); }, 128);
      for (const [w, pos, ry] of [[1.66, [0, 2.06, 1.1], 0], [1.66, [0, 2.06, -1.1], Math.PI], [2.2, [0.83, 2.06, 0], Math.PI / 2], [2.2, [-0.83, 2.06, 0], -Math.PI / 2]]) {
        const mat = matCuarto('holan|' + w, () => { const t = holan.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(w / 0.42, 1); TEXTURAS_FIJAS.add(t);
          return clay(0xffffff, { map: t, alphaTest: 0.5, side: THREE.DoubleSide, sheen: 1, clearcoat: 0 }); });
        g.add(det(new THREE.PlaneGeometry(w, 0.24), mat, { pos, rot: [0, ry, 0] }));
      }
      // cortinas recogidas en las 4 esquinas
      const cortinaG = torno([[0.02, -0.95], [0.2, -0.85], [0.08, -0.25], [0.05, 0], [0.12, 0.6], [0.22, 0.95]], 14);
      g.add(muchos(cortinaG, tul, esquinas.map(([x, z]) => ({ pos: [x * 0.98, 1.15, z * 0.98], esc: [0.8, 1, 0.8] }))));
      g.add(muchos(new THREE.TorusGeometry(0.07, 0.025, 8, 16), tela(0xff7bb0), esquinas.map(([x, z]) => ({ pos: [x * 0.98, 0.9, z * 0.98], rot: [Math.PI / 2, 0, 0] }))));
      // guirnalda de focos al frente del dosel
      g.add(muchos(esf(0.035, 8), luz(0xffffff), Array.from({ length: 9 }, (_, i) => { const k = i / 8; return { pos: [-0.78 + k * 1.56, 1.9 - Math.sin(k * Math.PI) * 0.14, 1.12], color: i % 2 ? 0xfff2b0 : 0xffc4e1 }; })));
      g.add(det(estrellaGeo(0.1, 0.045), tela(0xffd75e), { pos: [-0.4, 0.68, 0.6], rot: [-1.2, 0, -0.3] }));
      g.userData.anim = () => { cor.rotation.y = g.userData.tx || 0; cor.position.y = 1.62 + (g.userData.fx || 0) * 0.06; };   // gira cuando la mascota baila de princesa
      return g; },
    // cama gamer: marco oscuro con tiras LED, cobija pixelada y audifonos
    gamer: () => { const g = camaBase({ marco: 0x3d3a5c, cobija: 'gamer', borde: 0x2e2b47, almohada: 0xe9e4ff, pata: 0x2e2b47 });
      const marco = clay(0x3d3a5c);
      g.add(malla(cajaR(1.72, 1.0, 0.18, 0.08), marco, { pos: [0, 0.82, -1.06] }));
      g.add(malla(cajaR(1.5, 0.08, 0.26, 0.03), marco, { pos: [0, 1.36, -1.0] }));              // repisa
      const leds = [det(cajaR(1.5, 0.025, 0.02, 0.01), luz(0x3ef0ff), { pos: [0, 1.31, -0.86] }), det(cajaR(1.62, 0.025, 0.02, 0.01), luz(0xff4fd8), { pos: [0, 0.12, 1.06] })];
      for (const s of [-1, 1]) leds.push(det(cajaR(0.02, 0.025, 2.1, 0.01), luz(s < 0 ? 0xff4fd8 : 0x3ef0ff), { pos: [s * 0.84, 0.12, 0] }));
      leds.forEach((l) => g.add(l));
      // marquito con pixel corazon y control sobre la repisa
      g.add(det(cajaR(0.3, 0.24, 0.04, 0.02), clay(0x2e2b47), { pos: [-0.45, 1.53, -1.0] }));
      g.add(muchos(new THREE.BoxGeometry(0.03, 0.03, 0.01), luz(0xff5c8a), [[-1, 1], [1, 1], [-2, 0], [0, 0], [2, 0], [-1, -1], [1, -1], [0, -2], [-2, 1], [2, 1], [-1, 0], [1, 0], [0, -1]].map(([px, py]) => ({ pos: [-0.45 + px * 0.03, 1.55 + py * 0.03, -0.975] }))));
      const ctrl = g0(); ctrl.position.set(0.4, 1.45, -0.98); ctrl.rotation.x = -0.4;
      ctrl.add(det(cajaR(0.26, 0.06, 0.12, 0.03), clay(0xffffff)));
      for (const s of [-1, 1]) ctrl.add(det(esf(0.06, 12), clay(0xffffff), { pos: [s * 0.12, -0.01, 0.03] }));
      ctrl.add(det(esf(0.022, 8), luz(0xff5c8a), { pos: [0.07, 0.035, 0] })); ctrl.add(det(esf(0.022, 8), luz(0x3ef0ff), { pos: [-0.07, 0.035, 0] }));
      g.add(ctrl);
      const resp = g.add(halo(0x8f5cff, 2.2, 0.28, false)).children.at(-1); resp.position.set(0, 1.0, -1.17);
      g.userData.anim = (t) => { const f = g.userData.fx || 0; resp.scale.setScalar(1 + f * (0.3 + 0.3 * Math.sin(t * 8)));
        leds.forEach((l, i) => { l.visible = !f || Math.sin(t * 9 + i * 1.7) > -0.5; }); };
      // audifonos sobre la almohada
      const au = g0(); au.position.set(0.32, 0.8, -0.62); au.rotation.set(-1.2, 0, 0.3);
      au.add(det(new THREE.TorusGeometry(0.16, 0.025, 8, 20, Math.PI), clay(0xff4fd8)));
      for (const s of [-1, 1]) au.add(det(cil(0.07, 0.07, 0.06, 16), clay(0x2e2b47), { pos: [s * 0.16, 0, 0], rot: [0, 0, Math.PI / 2] }));
      g.add(au);
      return g; },
  },
  sillon: {
    // puff de frijolitos: aplastadito, con costura y cojin de corazon
    puff: () => { const g = g0(), c = 0xff9fb8;
      g.add(malla(mochi(0.7), tela(c), { pos: [0, 0.36, 0], esc: [0.62, 0.42, 0.6] }));
      g.add(det(esf(0.42, 28), tela(aclarar(c, 0.15)), { pos: [0, 0.5, 0.02], esc: [1, 0.32, 0.95] }));     // hundido del asiento
      g.add(det(new THREE.TorusGeometry(0.5, 0.018, 8, 40), tela(aclarar(c, 0.35)), { pos: [0, 0.42, 0], rot: [Math.PI / 2, 0, 0], esc: [1.18, 1.14, 1] }));
      g.add(malla(corazonGeo(0.2), tela(0xffe27a), { pos: [0.1, 0.66, -0.22], rot: [-0.25, 0, 0.15] }));
      g.userData.asiento = { y: 0.6, atras: -0.1, frente: 0.3, ancho: 0.42 };
      return g; },
    // sofa de dos plazas: brazos redondos, cojines, cojines decorativos y una cobijita tejida
    sofa: () => { const g = g0(), c = 0x95a9f2, cc = aclarar(c, 0.18), pata = madera(0xc98f62);
      for (const x of [-0.75, 0.75]) for (const z of [-0.3, 0.3]) g.add(det(cil(0.045, 0.03, 0.16, 10), pata, { pos: [x, 0.08, z] }));
      g.add(malla(cajaR(1.76, 0.28, 0.86, 0.1), tela(c), { pos: [0, 0.29, 0] }));
      for (const s of [-1, 1]) g.add(malla(cajaR(0.78, 0.17, 0.66, 0.08), tela(cc), { pos: [s * 0.39, 0.5, 0.08] }));
      g.add(malla(cajaR(1.76, 0.66, 0.26, 0.12), tela(c), { pos: [0, 0.66, -0.31] }));
      for (const s of [-1, 1]) g.add(malla(cojinGeo(0.74, 0.44, 0.16), tela(cc), { pos: [s * 0.38, 0.76, -0.17], rot: [-0.15, 0, 0] }));
      for (const s of [-1, 1]) g.add(malla(cajaR(0.24, 0.52, 0.88, 0.12), tela(c), { pos: [s * 0.88, 0.5, 0] }));
      g.add(malla(cojinGeo(0.36, 0.34, 0.13), tela(0xffd27a), { pos: [-0.5, 0.74, -0.04], rot: [-0.2, 0.25, 0.18] }));
      g.add(malla(cojinGeo(0.34, 0.32, 0.13), tela(0xff9e8a), { pos: [0.48, 0.73, -0.03], rot: [-0.2, -0.3, -0.15] }));
      // cobijita sobre el brazo derecho
      g.add(det(cajaR(0.3, 0.05, 0.5, 0.025), tela(0xfff1dc), { pos: [0.88, 0.78, 0.1] }));
      g.add(det(cajaR(0.05, 0.42, 0.5, 0.025), tela(0xfff1dc), { pos: [1.02, 0.58, 0.1] }));
      for (const z of [-0.05, 0.1, 0.25]) g.add(det(cajaR(0.055, 0.42, 0.04, 0.02), tela(0xff9e8a), { pos: [1.025, 0.58, z] }));
      g.userData.asiento = { y: 0.585, atras: -0.06, frente: 0.38, ancho: 0.74 };
      return g; },
    // trono real: respaldo de arco dorado, terciopelo capitonado, gema que brilla y destellos
    trono: () => { const g = g0(), oro = metal(0xffcf3f), tercio = tela(0xe0507a);
      for (const x of [-0.4, 0.4]) for (const z of [-0.32, 0.32]) g.add(det(esf(0.09, 14), oro, { pos: [x, 0.08, z] }));
      g.add(malla(cajaR(1.04, 0.3, 0.86, 0.08), oro, { pos: [0, 0.3, 0] }));
      g.add(malla(cajaR(0.9, 0.16, 0.78, 0.07), tercio, { pos: [0, 0.5, 0.03] }));
      // respaldo: arco extruido
      const arcoF = (w, h) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(-w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0); return s; };
      const ext = (s, d) => { const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 20 }); return geo; };
      g.add(malla(ext(arcoF(1.04, 1.7), 0.12), oro, { pos: [0, 0.42, -0.42] }));
      g.add(malla(ext(arcoF(0.8, 1.42), 0.08), tercio, { pos: [0, 0.56, -0.33] }));
      g.add(muchos(esf(0.035, 10), oro, [[-0.2, 0.95], [0.2, 0.95], [0, 1.2], [-0.2, 1.45], [0.2, 1.45], [0, 0.72]].map(([x, y]) => ({ pos: [x, y, -0.22] }))));
      // brazos con volutas
      for (const s of [-1, 1]) { g.add(malla(cajaR(0.14, 0.12, 0.8, 0.05), oro, { pos: [s * 0.52, 0.72, 0] }));
        g.add(malla(cil(0.04, 0.05, 0.3, 10), oro, { pos: [s * 0.52, 0.56, 0.32] }));
        g.add(det(new THREE.TorusGeometry(0.07, 0.03, 8, 16), oro, { pos: [s * 0.52, 0.76, 0.42], rot: [0, Math.PI / 2, 0] })); }
      // corona y gema
      const cor = g0(); cor.position.set(0, 2.15, -0.36);
      cor.add(det(cil(0.15, 0.13, 0.09, 18), oro));
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; cor.add(det(new THREE.ConeGeometry(0.04, 0.12, 8), oro, { pos: [Math.cos(a) * 0.13, 0.09, Math.sin(a) * 0.13] })); }
      g.add(cor);
      const gema = det(new THREE.OctahedronGeometry(0.11, 0), luz(0x7fe9ff), { pos: [0, 1.76, -0.27], esc: [1, 1.3, 0.6] }); g.add(gema);
      g.add(halo(0x7fe9ff, 0.8, 0.5)).children.at(-1).position.set(0, 1.76, -0.2);
      // destellos flotando
      const chispas = [];
      for (let i = 0; i < 3; i++) { const c = det(new THREE.OctahedronGeometry(0.05, 0), luz(0xfff2a8), { esc: [0.5, 1.4, 0.5] }); g.add(c); chispas.push(c); }
      g.userData.asiento = { y: 0.58, atras: -0.2, frente: 0.38, ancho: 0.43 };
      const brilloG = g.children.at(-4);
      g.userData.anim = (t) => { const f = g.userData.fx || 0, s = 1 + f * (0.2 + 0.2 * Math.sin(t * 6));
        gema.scale.set(s, 1.3 * s, 0.6 * s); gema.rotation.y = f ? t * 2 : 0; brilloG.scale.setScalar(1 + f * (0.5 + 0.4 * Math.sin(t * 6)));
        chispas.forEach((c, i) => { const a = t * (0.6 + f * 1.2) + i * 2.1; c.position.set(Math.cos(a) * 0.7, 1.2 + Math.sin(t * 1.3 + i) * 0.25, Math.sin(a) * 0.45); c.rotation.y = t * 2 + i; }); };
      return g; },
  },
  planta: {
    // costilla de adan en maceta de barro con platito
    maceta: () => { const g = g0(), barro = clay(0xf29a76);
      g.add(det(cil(0.3, 0.3, 0.04, 28), clay(0xe88c6a), { pos: [0, 0.02, 0] }));
      g.add(malla(torno([[0.2, 0.04], [0.25, 0.4], [0.3, 0.42], [0.31, 0.5], [0.27, 0.5], [0.26, 0.46]]), barro));
      g.add(det(cil(0.26, 0.26, 0.02, 24), clay(0x7a5040), { pos: [0, 0.46, 0] }));
      const hojaG = hojaGeo(0.46, 0.22), verdes = [0x6fc46a, 0x86d07a, 0x5bb25c];
      for (let i = 0; i < 8; i++) {
        const piv = g0(); piv.position.set(0, 0.46, 0); piv.rotation.set(0, (i / 8) * Math.PI * 2 + (i % 2) * 0.3, 0);
        const inc = g0(); inc.rotation.x = 0.25 + (i % 3) * 0.17; piv.add(inc);
        const L = 0.38 + (i % 3) * 0.12;
        inc.add(det(cil(0.012, 0.016, L, 6), clay(0x5bb25c), { pos: [0, L / 2, 0] }));
        inc.add(malla(hojaG, clay(verdes[i % 3]), { pos: [0, L - 0.02, 0], rot: [0.9 + (i % 2) * 0.3, 0, 0] }));
        g.add(piv);
      }
      return g; },
    // cactus con carita, florecita y piedritas
    cactus: () => { const g = g0(), verde = clay(0x86d07a);
      g.add(malla(torno([[0.18, 0], [0.24, 0.32], [0.27, 0.34], [0.27, 0.4], [0.23, 0.4]]), ceramica(0xffd3a8)));
      g.add(det(cil(0.244, 0.24, 0.05, 24), ceramica(0xc3a3ff), { pos: [0, 0.2, 0] }));
      g.add(det(cil(0.23, 0.23, 0.02, 20), clay(0xe8c9a0), { pos: [0, 0.38, 0] }));
      for (const [x, z, c] of [[0.13, 0.1, 0xffffff], [-0.12, 0.12, 0xb9bfcc], [0.05, -0.15, 0xfff1dc]]) g.add(det(esf(0.04, 10), clay(c), { pos: [x, 0.4, z], esc: [1, 0.6, 1] }));
      const cuerpo = new THREE.CapsuleGeometry(0.17, 0.48, 8, 18), p = cuerpo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + Math.cos(a * 8) * 0.06; p.setX(i, x * k); p.setZ(i, z * k); }
      cuerpo.computeVertexNormals();
      g.add(malla(cuerpo, verde, { pos: [0, 0.78, 0] }));
      g.add(malla(new THREE.CapsuleGeometry(0.075, 0.16, 6, 12), verde, { pos: [0.22, 0.86, 0], rot: [0, 0, -0.5] }));
      g.add(malla(new THREE.CapsuleGeometry(0.065, 0.12, 6, 12), verde, { pos: [-0.21, 0.74, 0], rot: [0, 0, 0.6] }));
      for (const s of [-1, 1]) { g.add(det(esf(0.022, 10), plano(0x2d2440), { pos: [s * 0.06, 0.82, 0.17] })); g.add(det(esf(0.03, 10), plano(0xff9db5), { pos: [s * 0.1, 0.77, 0.16], esc: [1, 0.6, 0.4] })); }
      g.add(det(arco(0.025, 0.008, Math.PI), plano(0x2d2440), { pos: [0, 0.78, 0.175], rot: [0, 0, Math.PI] }));
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.add(det(esf(0.045, 10), clay(0xff7bb0), { pos: [Math.cos(a) * 0.05, 1.14, Math.sin(a) * 0.05], esc: [1, 0.5, 1] })); }
      g.add(det(esf(0.03, 10), clay(0xffe27a), { pos: [0, 1.16, 0] }));
      return g; },
    // bonsai de cerezo: maceta de porcelana, tronco torcido, nubes de flores y petalos que caen
    sakura: () => { const g = g0(), tronco = clay(0x8a5a44), rosas = [0xffb7d5, 0xffcfe3, 0xff9fc7];
      g.add(det(cajaR(0.82, 0.08, 0.62, 0.03), madera(0x8a5a44), { pos: [0, 0.07, 0] }));
      for (const x of [-0.32, 0.32]) for (const z of [-0.22, 0.22]) g.add(det(cajaR(0.08, 0.06, 0.08, 0.02), madera(0x6e4636), { pos: [x, 0.03, z] }));
      g.add(malla(torno([[0.26, 0.11], [0.34, 0.3], [0.37, 0.32], [0.37, 0.36], [0.33, 0.36]], 32), ceramica(0xffffff), { esc: [1.05, 1, 0.8] }));
      g.add(det(cil(0.352, 0.33, 0.05, 32), ceramica(0x7da7ff), { pos: [0, 0.24, 0], esc: [1.05, 1, 0.8] }));
      g.add(det(esf(0.3, 20), clay(0x86c46f), { pos: [0, 0.34, 0], esc: [1.1, 0.12, 0.85] }));
      // tronco en tramos
      const tramos = [[[0, 0.34, 0], [0.08, 0.7, 0.02]], [[0.08, 0.7, 0.02], [-0.06, 1.0, 0]], [[-0.06, 1.0, 0], [0.04, 1.25, -0.02]], [[0.08, 0.7, 0.02], [0.36, 0.95, 0.05]], [[-0.06, 1.0, 0], [-0.34, 1.16, 0.06]]];
      tramos.forEach(([a, b], i) => { const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), L = va.distanceTo(vb), r = i < 2 ? 0.07 - i * 0.015 : 0.035;
        const m = malla(cil(r * 0.8, r, L + 0.04, 10), tronco); m.position.copy(va).lerp(vb, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()); g.add(m); });
      // nubes de flores
      const flores = [];
      for (const [cx, cy, cz, k] of [[0.04, 1.36, 0, 1], [0.42, 1.04, 0.05, 0.75], [-0.4, 1.24, 0.06, 0.8], [-0.12, 1.2, 0.2, 0.6], [0.22, 1.28, -0.15, 0.6]])
        for (let j = 0; j < 4; j++) { const a = j * 1.7, r = (0.17 - j * 0.02) * k; flores.push({ pos: [cx + Math.cos(a) * 0.12 * k, cy + (j % 2) * 0.07 * k, cz + Math.sin(a) * 0.1 * k], esc: [r * 1.15, r * 0.85, r], color: rosas[(j + Math.round(cx * 10)) % 3] }); }
      g.add(muchos(esf(1, 18), clay(0xffffff), flores, true));
      // petalos en el suelo y cayendo
      const petG = esf(0.035, 8);
      g.add(muchos(petG, clay(0xffb7d5), [[0.5, 0.35], [-0.45, 0.4], [0.2, 0.5], [-0.15, -0.4]].map(([x, z]) => ({ pos: [x, 0.012, z], esc: [1, 0.25, 0.7] }))));
      const caen = [];
      for (let i = 0; i < 4; i++) { const p = det(petG, clay(0xffcfe3), { esc: [1, 0.3, 0.7] }); g.add(p); caen.push(p); }
      g.userData.anim = (t) => caen.forEach((p, i) => { const k = ((t * 0.18 + i * 0.25) % 1); p.position.set(Math.sin(t * 0.9 + i * 2) * 0.35 + (i - 1.5) * 0.15, 1.2 - k * 1.2, 0.25 + Math.cos(t * 0.7 + i) * 0.15); p.rotation.set(t * 2 + i, t + i, 0); p.visible = k < 0.97; });
      return g; },
  },
  lampara: {
    // lampara de pie con tripie de madera y pantalla de tela que brilla
    pie: () => { const g = g0(), mad = madera(0xd9a06e);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; g.add(malla(cil(0.022, 0.028, 0.95, 8), mad, { pos: [Math.cos(a) * 0.13, 0.45, Math.sin(a) * 0.13], rot: [-Math.sin(a) * 0.28, 0, Math.cos(a) * 0.28] })); }
      g.add(malla(cil(0.03, 0.03, 0.5, 8), metal(0xe8c27a), { pos: [0, 1.05, 0] }));
      g.add(malla(cil(0.2, 0.3, 0.36, 28, true), clay(0xfff0d6, { side: THREE.DoubleSide, emissive: 0xffc98a, emissiveIntensity: 0.55, sheen: 1 }), { pos: [0, 1.36, 0] }));
      for (const y of [1.19, 1.53]) g.add(det(new THREE.TorusGeometry(y < 1.3 ? 0.3 : 0.2, 0.012, 6, 32), tela(0xff9e8a), { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] }));
      g.add(det(esf(0.09, 14), luz(0xfff2c8), { pos: [0, 1.3, 0] }));
      const cadena = g0(); cadena.position.set(0.12, 1.22, 0); g.add(cadena);   // cadenita del apagador (se jala)
      cadena.add(det(cil(0.004, 0.004, 0.2, 4), metal(0xe8c27a), { pos: [0, -0.1, 0] }));
      cadena.add(det(esf(0.02, 8), metal(0xe8c27a), { pos: [0, -0.2, 0] }));
      g.userData.piezas = { cadena };
      g.add(halo(0xffd29a, 1.6, 0.4)).children.at(-1).position.set(0, 1.3, 0);
      g.userData.foco = new THREE.Vector3(0, 1.3, 0); g.userData.colorFoco = 0xffc98a;
      return g; },
    // hongo luminoso con hongos bebe
    hongo: () => { const g = g0(), crema = clay(0xfff1dc);
      g.add(det(esf(0.32, 20), clay(0x9fd88a), { esc: [1, 0.18, 1] }));
      g.add(malla(torno([[0.15, 0], [0.12, 0.25], [0.1, 0.5], [0.12, 0.62]], 20), crema));
      const sombrero = clay(0xff7d7d, { emissive: 0xff6b6b, emissiveIntensity: 0.35 });
      g.add(malla(new THREE.SphereGeometry(0.42, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), sombrero, { pos: [0, 0.58, 0], esc: [1, 0.8, 1] }));
      g.add(det(cil(0.41, 0.12, 0.06, 32), clay(0xffe6c8, { emissive: 0xffd2a0, emissiveIntensity: 0.6 }), { pos: [0, 0.56, 0] }));
      g.add(muchos(esf(0.06, 10), clay(0xffffff), [[0.3, 0.9], [1.5, 0.6], [2.6, 1.0], [3.7, 0.7], [4.9, 0.95], [5.8, 0.5], [0, 0.12]].map(([a, e]) => {
        const v = new THREE.Vector3(Math.cos(a) * Math.sin(e), Math.cos(e), Math.sin(a) * Math.sin(e));
        return { pos: [v.x * 0.42, 0.58 + v.y * 0.42 * 0.8, v.z * 0.42], esc: [1, 0.45, 1], quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v) }; })));
      for (const [x, z, k] of [[0.26, 0.14, 0.4], [-0.22, 0.2, 0.3]]) {
        g.add(det(cil(0.08 * k, 0.1 * k, 0.3 * k, 10), crema, { pos: [x, 0.15 * k, z] }));
        g.add(det(new THREE.SphereGeometry(0.26 * k, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), clay(0xffb38a), { pos: [x, 0.28 * k, z] }));
      }
      g.add(halo(0xff9a8a, 1.3, 0.35)).children.at(-1).position.set(0, 0.5, 0);
      g.userData.foco = new THREE.Vector3(0, 0.5, 0); g.userData.colorFoco = 0xffa38a;
      return g; },
    // luna creciente sobre una nube, con estrellas colgando
    luna: () => { const g = g0();
      const nubeG = esf(1, 20);
      for (const [x, y, r] of [[0, 0.14, 0.2], [-0.18, 0.1, 0.15], [0.18, 0.1, 0.15]]) g.add(malla(nubeG, tela(0xe9ddff), { pos: [x, y, 0], esc: [r, r * 0.8, r] }));
      const s = new THREE.Shape(); s.absarc(0, 0, 0.42, Math.PI * 0.35, Math.PI * 1.65, false); s.absarc(0.2, 0, 0.374, -1.597, 1.597, true);
      const lunaG = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 4, curveSegments: 28 }); lunaG.translate(0, 0, -0.06);
      g.add(malla(lunaG, clay(0xfff1a8, { emissive: 0xffd84d, emissiveIntensity: 0.75 }), { pos: [0.05, 0.72, 0] }));
      g.add(det(arco(0.04, 0.01, Math.PI), plano(0x6a5a8a), { pos: [-0.22, 0.76, 0.12], rot: [0, 0, Math.PI] }));   // ojito dormido
      g.add(det(esf(0.035, 10), plano(0xff9db5), { pos: [-0.24, 0.68, 0.12], esc: [1, 0.6, 0.3] }));
      g.add(det(cajaR(0.6, 0.02, 0.04, 0.01), madera(0xd9a06e), { pos: [0.2, 1.0, 0] }));
      g.add(det(cil(0.015, 0.015, 0.8, 6), madera(0xd9a06e), { pos: [0.48, 0.6, 0] }));
      g.add(det(cil(0.1, 0.12, 0.04, 14), madera(0xd9a06e), { pos: [0.48, 0.02, 0] }));
      const colgantes = [];
      for (const [x, L, c] of [[0.22, 0.25, 0xffe27a], [0.36, 0.42, 0xffc4e1]]) {
        const h = g0(); h.position.set(x, 1.0, 0); g.add(h); colgantes.push(h);
        h.add(det(cil(0.004, 0.004, L, 4), clay(0xffffff), { pos: [0, -L / 2, 0] }));
        h.add(det(estrellaGeo(0.07, 0.032), luz(c), { pos: [0, -L - 0.05, 0] }));
      }
      g.userData.anim = (t) => { const f = g.userData.fx || 0; colgantes.forEach((h, i) => { h.rotation.z = f * Math.sin(t * 2.2 + i * 1.3) * 0.22; }); };
      g.add(halo(0xffe27a, 1.6, 0.45)).children.at(-1).position.set(-0.05, 0.68, 0);
      g.userData.foco = new THREE.Vector3(0, 0.7, 0.2); g.userData.colorFoco = 0xffe08a;
      return g; },
  },
  cuadro: {
    // paisaje pintado (colinas, sol y nubes) en marco de madera redondeado
    paisaje: () => { const g = g0();
      g.add(malla(cajaR(1.02, 0.8, 0.07, 0.035), madera(0xe0ac78)));
      g.add(det(cajaR(0.9, 0.68, 0.02, 0.01), clay(0xfff8ee), { pos: [0, 0, 0.03] }));
      const tex = texCuarto('cuadro-paisaje', (x, n) => {
        const h = n, cielo = x.createLinearGradient(0, 0, 0, h); cielo.addColorStop(0, '#8fd0ff'); cielo.addColorStop(1, '#ffe9d6'); x.fillStyle = cielo; x.fillRect(0, 0, n, h);
        x.fillStyle = '#ffd75e'; x.beginPath(); x.arc(n * 0.72, h * 0.3, n * 0.08, 0, 7); x.fill();
        x.fillStyle = '#fff'; for (const [cx, cy, s] of [[0.25, 0.22, 1], [0.5, 0.12, 0.7]]) for (const [dx, r] of [[-14, 12], [0, 17], [15, 11]]) { x.beginPath(); x.arc(n * cx + dx * s * 1.4, h * cy, r * s * 1.4, 0, 7); x.fill(); }
        const colina = (y0, amp, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= 20; i++) x.lineTo(i / 20 * n, h * y0 - Math.sin(i / 20 * Math.PI * 1.6 + y0 * 9) * amp); x.lineTo(n, h); x.fill(); };
        colina(0.62, 18, '#b8e6a0'); colina(0.8, 14, '#86cf72');
        x.fillStyle = '#fff4e6'; x.fillRect(n * 0.2, h * 0.6, 30, 24); x.fillStyle = '#ff8a8a'; x.beginPath(); x.moveTo(n * 0.2 - 5, h * 0.6); x.lineTo(n * 0.2 + 15, h * 0.6 - 18); x.lineTo(n * 0.2 + 35, h * 0.6); x.fill();
      }, 256);
      g.add(det(new THREE.PlaneGeometry(0.82, 0.6), conTex('cuadro-paisaje', tex, { roughness: 0.6, clearcoat: 0.4 }), { pos: [0, 0, 0.042] }));
      return g; },
    // reloj de gatito: orejas, carátula con numeros, minutero que gira y pendulo de cola
    reloj: () => { const g = g0(), cuerpo = clay(0xc8b4ff);
      g.add(malla(cil(0.36, 0.36, 0.08, 40), cuerpo, { rot: [Math.PI / 2, 0, 0] }));
      for (const s of [-1, 1]) { g.add(det(new THREE.ConeGeometry(0.13, 0.2, 3), cuerpo, { pos: [s * 0.22, 0.34, 0], rot: [0, 0, -s * 0.35], esc: [1, 1, 0.4] }));
        g.add(det(new THREE.ConeGeometry(0.07, 0.11, 3), clay(0xffb3c9), { pos: [s * 0.215, 0.33, 0.03], rot: [0, 0, -s * 0.35], esc: [1, 1, 0.3] })); }
      const tex = texCuarto('cuadro-reloj', (x, n) => {
        const c = n / 2; x.fillStyle = '#fffaf2'; x.beginPath(); x.arc(c, c, c, 0, 7); x.fill();
        x.fillStyle = '#6a5a8a'; x.font = `bold ${n * 0.12}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        [[12, 0], [3, 90], [6, 180], [9, 270]].forEach(([t, a]) => { const r = a * Math.PI / 180; x.fillText(t, c + Math.sin(r) * c * 0.72, c - Math.cos(r) * c * 0.72); });
        for (let i = 0; i < 12; i++) if (i % 3) { const r = i / 12 * Math.PI * 2; x.fillStyle = '#ffb3c9'; x.beginPath(); x.arc(c + Math.sin(r) * c * 0.75, c - Math.cos(r) * c * 0.75, n * 0.025, 0, 7); x.fill(); }
        x.fillStyle = 'rgba(255,140,170,.5)'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(c + s * c * 0.42, c + c * 0.32, n * 0.07, n * 0.04, 0, 0, 7); x.fill(); }
      }, 256);
      g.add(det(new THREE.CircleGeometry(0.3, 40), conTex('cuadro-reloj', tex, { roughness: 0.5 }), { pos: [0, 0, 0.042] }));
      g.add(det(cajaR(0.03, 0.16, 0.012, 0.012), plano(0x3a3350), { pos: [-0.05, 0.05, 0.05], rot: [0, 0, 0.9] }));
      const man = g0(); man.position.set(0, 0, 0.055); man.add(det(cajaR(0.022, 0.24, 0.012, 0.01), plano(0xff5c8a), { pos: [0, 0.1, 0] })); g.add(man); g.userData.manecilla = man;
      g.add(det(esf(0.025, 10), metal(0xffcf3f), { pos: [0, 0, 0.06] }));
      // pendulo (cola) que se mece
      const pend = g0(); pend.position.set(0, -0.32, -0.01);
      pend.add(det(cil(0.012, 0.012, 0.3, 6), cuerpo, { pos: [0, -0.15, 0] }));
      pend.add(det(esf(0.06, 14), metal(0xffcf3f), { pos: [0, -0.32, 0], esc: [1, 1, 0.4] }));
      g.add(pend); g.userData.anim = (t) => { pend.rotation.z = Math.sin(t * 3) * 0.3; };
      return g; },
    // letrero de neon: corazon y estrella en tubos que brillan sobre acrilico oscuro
    neon: () => { const g = g0();
      g.add(malla(cajaR(1.1, 0.82, 0.04, 0.05), clay(0x2b2547, { roughness: 0.2, clearcoat: 1, sheen: 0 })));
      for (const [x, y] of [[-0.48, 0.34], [0.48, 0.34], [-0.48, -0.34], [0.48, -0.34]]) g.add(det(esf(0.02, 8), metal(0xdfe6ff), { pos: [x, y, 0.03] }));
      const corazon = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; corazon.push(new THREE.Vector3(16 * Math.sin(a) ** 3 * 0.017, (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 0.017, 0)); }
      const tuboC = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(corazon, true), 96, 0.022, 8, true);
      g.add(det(tuboC, luz(0xff5cc8), { pos: [-0.1, 0.0, 0.06] }));
      const est = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.06 : 0.14, a = (i / 10) * Math.PI * 2 + Math.PI / 2; est.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
      g.add(det(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(est, true, 'catmullrom', 0.05), 60, 0.016, 6, true), luz(0x5ce1ff), { pos: [0.34, 0.2, 0.06] }));
      for (const [x, y] of [[0.36, -0.2], [0.26, -0.28]]) g.add(det(esf(0.025, 8), luz(0xfff2a8), { pos: [x, y, 0.06] }));
      const hC = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), new THREE.MeshBasicMaterial({ map: TEX_HALO, color: 0xff5cc8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      hC.position.set(-0.1, 0, 0.05); hC.raycast = () => {}; g.add(hC);
      g.add(halo(0x5ce1ff, 0.7, 0.45, false)).children.at(-1).position.set(0.34, 0.2, 0.05);
      const cNeon = new THREE.Color(0xff5cc8), hE = g.children.at(-1);
      g.userData.anim = (t) => { const f = g.userData.fx || 0;
        hC.material.opacity = 0.45 + Math.sin(t * 2.2) * 0.08 + (Math.sin(t * 17) > 0.97 ? -0.25 : 0) + f * (0.25 + 0.2 * Math.sin(t * 9));
        if (f) hC.material.color.setHSL((0.87 + Math.sin(t * 1.5) * 0.08 + 1) % 1, 1, 0.6); else hC.material.color.copy(cNeon);
        hE.scale.setScalar(1 + f * (0.4 + 0.4 * Math.sin(t * 6 + 1))); };
      return g; },
  },
  tech: {
    // tele retro con antenas sobre un mueblecito de madera
    tele: () => { const g = muebleTele();
      const tv = g0(); tv.position.set(0, 0.6, -0.02); g.add(tv);
      tv.add(malla(cajaR(0.92, 0.66, 0.5, 0.13), clay(0xc7b5ff), { pos: [0, 0.33, 0] }));
      tv.add(det(cajaR(0.66, 0.52, 0.04, 0.08), clay(0x4a4468), { pos: [-0.1, 0.34, 0.24] }));
      const pantalla = tv.add(det(new THREE.PlaneGeometry(0.58, 0.44), conTex('tv-show', texCuarto('tv-show', PANTALLAS.show, 256), { emissive: 0xffffff, emissiveMap: texCuarto('tv-show', PANTALLAS.show, 256), emissiveIntensity: 0.9, roughness: 0.15, clearcoat: 1, sheen: 0 }), { pos: [-0.1, 0.34, 0.263] })).children.at(-1);
      g.userData.piezas = { pantalla };
      for (const y of [0.46, 0.3]) tv.add(det(cil(0.04, 0.04, 0.04, 14), clay(0xfff1dc), { pos: [0.33, y, 0.25], rot: [Math.PI / 2, 0, 0] }));
      for (let i = 0; i < 3; i++) tv.add(det(cajaR(0.1, 0.012, 0.01, 0.005), clay(0x8f7fc7), { pos: [0.33, 0.16 - i * 0.03, 0.252] }));
      for (const s of [-1, 1]) { tv.add(det(cil(0.008, 0.008, 0.45, 5), metal(0xdfe6ff), { pos: [s * 0.12, 0.85, -0.05], rot: [0, 0, -s * 0.5] })); tv.add(det(esf(0.03, 8), clay(0xff9e8a), { pos: [s * 0.23, 1.05, -0.05] })); }
      tv.add(det(esf(0.06, 12), clay(0xc7b5ff), { pos: [0, 0.67, -0.05], esc: [1.4, 0.6, 1] }));
      g.add(halo(0x8fd8ff, 1.0, 0.25)).children.at(-1).position.set(-0.1, 0.95, 0.35);
      return g; },
    // consola: tele plana con juego, consola con LED y dos controles
    consola: () => { const g = muebleTele();
      g.add(malla(cajaR(0.3, 0.05, 0.2, 0.02), clay(0x2f2c45), { pos: [0, 0.625, -0.08] }));
      g.add(malla(cil(0.025, 0.03, 0.12, 8), clay(0x2f2c45), { pos: [0, 0.69, -0.08] }));
      g.add(malla(cajaR(1.16, 0.7, 0.06, 0.04), clay(0x2f2c45), { pos: [0, 1.08, -0.08] }));
      const tex = texCuarto('tv-juego', PANTALLAS.juego, 256);
      const pantalla = g.add(det(new THREE.PlaneGeometry(1.06, 0.6), conTex('tv-juego', tex, { emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.15, clearcoat: 1, sheen: 0 }), { pos: [0, 1.08, -0.045] })).children.at(-1);
      g.userData.piezas = { pantalla };
      g.add(halo(0xa77bff, 2.0, 0.3, false)).children.at(-1).position.set(0, 1.08, -0.14);
      // consola blanca con luz
      g.add(malla(cajaR(0.42, 0.09, 0.26, 0.03), clay(0xffffff), { pos: [0.3, 0.645, 0.12] }));
      g.add(det(cajaR(0.3, 0.012, 0.01, 0.005), luz(0x3ef0ff), { pos: [0.3, 0.645, 0.253] }));
      const control = (c, pos, rotY) => { const k = g0(); k.position.set(...pos); k.rotation.y = rotY;
        k.add(det(cajaR(0.2, 0.05, 0.1, 0.025), clay(c)));
        for (const s of [-1, 1]) k.add(det(esf(0.045, 10), clay(c), { pos: [s * 0.09, -0.005, 0.03] }));
        k.add(det(esf(0.016, 8), luz(0xffe27a), { pos: [0.05, 0.03, 0] })); k.add(det(cajaR(0.04, 0.012, 0.012, 0.004), clay(0x2f2c45), { pos: [-0.05, 0.03, 0] }));
        g.add(k); };
      control(0xff8fb3, [-0.32, 0.63, 0.12], 0.3); control(0x8fd8ff, [-0.08, 0.63, 0.16], -0.2);
      return g; },
    // acuario: mueble, pecera con arena, castillito, algas que se mecen, burbujas y peces
    acuario: () => { const g = g0(), mad = madera(0xe3b07f);
      g.add(malla(cajaR(1.12, 0.56, 0.56, 0.06), mad, { pos: [0, 0.28, 0] }));
      for (const s of [-1, 1]) { g.add(det(cajaR(0.5, 0.42, 0.02, 0.02), madera(0xf0c595), { pos: [s * 0.27, 0.28, 0.28] })); g.add(det(esf(0.025, 8), metal(0xffcf3f), { pos: [s * 0.06, 0.3, 0.3] })); }
      const tanque = g0(); tanque.position.set(0, 0.56, 0); g.add(tanque);
      tanque.add(malla(cajaR(1.06, 0.05, 0.5, 0.02), clay(0xffffff), { pos: [0, 0.025, 0] }));
      tanque.add(det(cajaR(0.98, 0.1, 0.42, 0.03), clay(0xffe2a8), { pos: [0, 0.09, 0] }));
      const agua = det(new THREE.BoxGeometry(0.98, 0.5, 0.42), clay(0x7fd8ff, { transparent: true, opacity: 0.32, roughness: 0.1, sheen: 0, clearcoat: 1, depthWrite: false }), { pos: [0, 0.34, 0] }); agua.renderOrder = 1; tanque.add(agua);
      const vidrio = det(cajaR(1.04, 0.66, 0.48, 0.04), clay(0xe6f8ff, { transparent: true, opacity: 0.18, roughness: 0.05, sheen: 0, clearcoat: 1, depthWrite: false }), { pos: [0, 0.37, 0] }); vidrio.renderOrder = 2; tanque.add(vidrio);
      tanque.add(malla(cajaR(1.1, 0.07, 0.52, 0.03), clay(0xffffff), { pos: [0, 0.72, 0] }));
      tanque.add(det(cajaR(0.9, 0.012, 0.02, 0.005), luz(0xbff4ff), { pos: [0, 0.68, 0.1] }));
      // castillito y piedras
      tanque.add(det(cil(0.06, 0.07, 0.2, 12), clay(0xffb3c9), { pos: [0.3, 0.24, -0.08] }));
      tanque.add(det(new THREE.ConeGeometry(0.075, 0.1, 12), clay(0xc3a3ff), { pos: [0.3, 0.39, -0.08] }));
      tanque.add(det(cil(0.04, 0.045, 0.13, 10), clay(0xffb3c9), { pos: [0.4, 0.2, -0.1] }));
      for (const [x, z, c] of [[-0.35, -0.1, 0xb9bfcc], [-0.25, 0.05, 0xd8c3ff], [0.12, 0.1, 0xfff1dc]]) tanque.add(det(esf(0.06, 10), clay(c), { pos: [x, 0.15, z], esc: [1.2, 0.7, 1] }));
      // algas
      const algas = [];
      for (const [x, z, h] of [[-0.38, -0.12, 0.38], [-0.3, -0.06, 0.28], [0.05, -0.14, 0.32], [0.42, 0.08, 0.24]]) { const a = det(new THREE.CapsuleGeometry(0.025, h, 4, 8), clay(0x6fc46a), { pos: [x, 0.14 + h / 2, z] }); a.geometry.translate(0, h / 2, 0); a.position.y = 0.14; tanque.add(a); algas.push(a); }
      // peces (el ciclo comun los nada de lado a lado: x relativo al acuario)
      const peces = [];
      for (const [y, z, c] of [[0.92, 0.02, 0xffa23a], [0.8, -0.08, 0xff5c8a], [1.0, 0.1, 0xffe27a]]) {
        const pez = g0(); pez.position.set(0, y, z);
        pez.add(det(esf(0.065, 14), clay(c), { esc: [1.3, 0.9, 0.6] }));
        pez.add(det(new THREE.ConeGeometry(0.05, 0.08, 10), clay(c), { pos: [-0.1, 0, 0], rot: [0, 0, Math.PI / 2], esc: [1, 1, 0.4] }));
        pez.add(det(esf(0.014, 6), plano(0x2d2440), { pos: [0.05, 0.015, 0.035] })); pez.add(det(esf(0.014, 6), plano(0x2d2440), { pos: [0.05, 0.015, -0.035] }));
        g.add(pez); peces.push(pez);
      }
      g.userData.peces = peces;
      // burbujas
      const burb = []; for (let i = 0; i < 4; i++) { const b = det(esf(0.018, 8), clay(0xffffff, { transparent: true, opacity: 0.7 }), {}); tanque.add(b); burb.push(b); }
      g.userData.anim = (t) => { algas.forEach((a, i) => { a.rotation.z = Math.sin(t * 1.5 + i) * 0.18; });
        burb.forEach((b, i) => { const k = (t * 0.35 + i * 0.25) % 1; b.position.set(0.3 + Math.sin(t * 3 + i) * 0.02, 0.45 + k * 0.2 + (i % 2) * 0.05, -0.08); b.position.y = 0.45 + k * 0.2; b.scale.setScalar(0.6 + k * 0.6); }); };
      g.add(halo(0x7fd8ff, 1.6, 0.25)).children.at(-1).position.set(0, 0.95, 0.3);
      return g; },
  },
  deco: {
    // osito de peluche sentado con moño
    peluche: () => { const g = g0(), cafe = tela(0xd9a274), claro = tela(0xf6dcbc);
      g.add(malla(esf(0.3, 28), cafe, { pos: [0, 0.3, 0], esc: [1, 0.98, 0.9] }));
      g.add(det(esf(0.2, 20), claro, { pos: [0, 0.28, 0.12], esc: [1, 1.05, 0.7] }));
      for (const s of [-1, 1]) {
        g.add(malla(new THREE.CapsuleGeometry(0.085, 0.14, 6, 12), cafe, { pos: [s * 0.15, 0.1, 0.2], rot: [Math.PI / 2 - 0.2, 0, 0] }));
        g.add(det(esf(0.07, 12), claro, { pos: [s * 0.15, 0.1, 0.31], esc: [1, 1, 0.35] }));
        g.add(malla(new THREE.CapsuleGeometry(0.07, 0.16, 6, 12), cafe, { pos: [s * 0.27, 0.36, 0.08], rot: [0.5, 0, s * 0.6] }));
      }
      g.add(malla(esf(0.25, 28), cafe, { pos: [0, 0.72, 0.02] }));
      for (const s of [-1, 1]) { g.add(det(esf(0.09, 14), cafe, { pos: [s * 0.18, 0.92, 0], esc: [1, 1, 0.6] })); g.add(det(esf(0.05, 10), tela(0xffb3c9), { pos: [s * 0.18, 0.92, 0.04], esc: [1, 1, 0.4] }));
        g.add(det(esf(0.03, 10), brillo(0x2d2440), { pos: [s * 0.09, 0.76, 0.23] })); g.add(det(esf(0.035, 10), plano(0xff9db5), { pos: [s * 0.15, 0.68, 0.2], esc: [1, 0.6, 0.4] })); }
      g.add(det(esf(0.1, 16), claro, { pos: [0, 0.67, 0.21], esc: [1.2, 0.85, 0.8] }));
      g.add(det(esf(0.035, 10), brillo(0x4a3030), { pos: [0, 0.71, 0.29], esc: [1.3, 0.9, 1] }));
      for (const s of [-1, 1]) g.add(det(new THREE.ConeGeometry(0.07, 0.12, 12), tela(0xff7bb0), { pos: [s * 0.07, 0.52, 0.2], rot: [0, 0, s * Math.PI / 2], esc: [1, 1, 0.5] }));
      g.add(det(esf(0.035, 10), tela(0xff7bb0), { pos: [0, 0.52, 0.22] }));
      return g; },
    // copa de campeon con estrella brillante sobre pedestal con placa
    trofeo: () => { const g = g0(), oro = metal(0xffcf3f);
      g.add(malla(cajaR(0.5, 0.12, 0.5, 0.04), madera(0x7b5a49), { pos: [0, 0.06, 0] }));
      g.add(malla(cajaR(0.38, 0.14, 0.38, 0.04), madera(0x8f6a56), { pos: [0, 0.19, 0] }));
      g.add(det(cajaR(0.22, 0.07, 0.01, 0.01), oro, { pos: [0, 0.19, 0.195] }));
      g.add(malla(torno([[0.11, 0.26], [0.04, 0.32], [0.035, 0.42], [0.06, 0.46], [0.2, 0.56], [0.26, 0.8], [0.27, 0.84], [0.24, 0.84], [0.22, 0.6], [0.0, 0.5]], 32), oro));
      for (const s of [-1, 1]) g.add(malla(new THREE.TorusGeometry(0.1, 0.025, 8, 18, Math.PI * 1.3), oro, { pos: [s * 0.26, 0.66, 0], rot: [0, 0, s > 0 ? -1.2 : Math.PI + 1.2 - Math.PI * 0.3] }));
      const est = det(estrellaGeo(0.13, 0.06), luz(0xffe27a), { pos: [0, 1.0, 0] }); g.add(est);
      g.add(halo(0xffe27a, 0.9, 0.45)).children.at(-1).position.set(0, 1.0, 0.02);
      g.userData.anim = (t) => { est.rotation.y = (t + (g.userData.tx || 0)) * 1.6; est.position.y = 1.0 + Math.sin(t * 2) * 0.03 + (g.userData.fx || 0) * 0.12; };
      return g; },
    // pastel de dos pisos en base de pastel, con betun escurrido, fresas y vela encendida
    pastel: () => { const g = g0();
      g.add(malla(torno([[0.08, 0], [0.1, 0.02], [0.05, 0.05], [0.04, 0.16], [0.36, 0.18], [0.37, 0.2], [0, 0.2]], 32), ceramica(0xffffff)));
      const chispas = texCuarto('pastel-chispas', (x, n) => { x.fillStyle = '#ffc2d9'; x.fillRect(0, 0, n, n); const r = azarCon(7), c = ['#ffffff', '#8fd0ff', '#ffe27a', '#9fe3a6', '#c3a3ff'];
        for (let i = 0; i < 90; i++) { x.save(); x.translate(r() * n, r() * n); x.rotate(r() * 3); x.fillStyle = c[i % 5]; x.fillRect(-5, -1.5, 10, 3); x.restore(); } }, 128);
      g.add(malla(cil(0.32, 0.32, 0.24, 32), [conTex('pastel-chispas', chispas), tela(0xffc2d9), tela(0xffc2d9)], { pos: [0, 0.32, 0] }));
      g.add(det(new THREE.TorusGeometry(0.31, 0.035, 8, 40), clay(0xfffaf2), { pos: [0, 0.44, 0], rot: [Math.PI / 2, 0, 0] }));
      g.add(muchos(new THREE.CapsuleGeometry(0.022, 0.06, 4, 8), clay(0xfffaf2), Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2, k = 1 + (i % 3) * 0.5; return { pos: [Math.cos(a) * 0.32, 0.43 - 0.03 * k, Math.sin(a) * 0.32], esc: [1, k, 1] }; })));
      g.add(malla(cil(0.21, 0.21, 0.18, 32), clay(0xbfeedc), { pos: [0, 0.53, 0] }));
      g.add(det(new THREE.TorusGeometry(0.2, 0.03, 8, 32), clay(0xfffaf2), { pos: [0, 0.62, 0], rot: [Math.PI / 2, 0, 0] }));
      g.add(muchos(esf(0.04, 10), brillo(0xff4d5e), Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2 + 0.3; return { pos: [Math.cos(a) * 0.27, 0.47, Math.sin(a) * 0.27], esc: [1, 1.2, 1] }; })));
      g.add(det(cil(0.018, 0.018, 0.16, 8), clay(0x8fd0ff), { pos: [0, 0.7, 0] }));
      const flama = det(esf(0.03, 10), luz(0xffb347), { pos: [0, 0.81, 0], esc: [1, 1.6, 1] }); g.add(flama);
      const hFlama = g.add(halo(0xffb347, 0.5, 0.6)).children.at(-1); hFlama.position.set(0, 0.81, 0);
      g.userData.piezas = { flama, hFlama };
      g.userData.anim = (t) => { flama.scale.set(1 + Math.sin(t * 13) * 0.12, 1.6 + Math.sin(t * 17) * 0.25, 1); };
      return g; },
    // calabaza gajuda con carita que brilla, tallo y hojita
    // (la cara va pintada en la textura y el fondo toca el piso; ver calabazaCuarto en las decoraciones de temporada)
    calabaza: () => calabazaCuarto({ r: 0.34, cara: 'feliz', giro: 0.3 }),
    // piñata de estrella con picos rayados y flecos, colgando de su base (se mece)
    pinata: () => { const g = g0(), mad = madera(0xd9a06e);
      g.add(malla(cil(0.2, 0.24, 0.06, 20), mad, { pos: [0, 0.03, -0.72] }));
      g.add(malla(cil(0.025, 0.03, 1.85, 8), mad, { pos: [0, 0.95, -0.72] }));
      g.add(malla(cil(0.02, 0.02, 0.8, 8), mad, { pos: [0, 1.86, -0.36], rot: [Math.PI / 2, 0, 0] }));
      const piv = g0(); piv.position.set(0, 1.84, 0); g.add(piv);
      piv.add(det(cil(0.005, 0.005, 0.32, 4), clay(0xfff1dc), { pos: [0, -0.16, 0] }));
      const est = g0(); est.position.y = -0.7; est.scale.setScalar(0.95); piv.add(est);
      const rayas = texCuarto('pinata-rayas', (x, n) => { ['#ff7bb0', '#ffe27a', '#8fd0ff', '#9fe3a6', '#c3a3ff', '#ffa25c'].forEach((c, i) => { x.fillStyle = c; x.fillRect(0, i * n / 6, n, n / 6 + 1); });
        x.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 6; i++) for (let j = 0; j < 16; j++) x.fillRect(j * n / 16, i * n / 6 + n / 6 - 4, n / 32, 4); }, 128);
      est.add(malla(esf(0.3, 28), conTex('pinata-rayas', rayas, { roughness: 0.85, clearcoat: 0 })));
      const cols = [0xff7bb0, 0x8fd0ff, 0xffe27a, 0x9fe3a6], picos = [], flecos = [];
      for (let i = 0; i < 7; i++) {
        const v = i < 5 ? new THREE.Vector3(Math.sin(i / 5 * Math.PI * 2), Math.cos(i / 5 * Math.PI * 2), 0) : new THREE.Vector3(0, 0, i === 5 ? 1 : -1);
        picos.push({ pos: [v.x * 0.42, v.y * 0.42, v.z * 0.42], quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v) });
        for (let f = 0; f < 3; f++) flecos.push({ pos: [v.x * 0.64 + (f - 1) * 0.02, v.y * 0.64 - 0.1, v.z * 0.64], rot: [0, 0, (f - 1) * 0.25], color: cols[(i + f) % 4] });
      }
      est.add(muchos(new THREE.ConeGeometry(0.11, 0.42, 18), conTex('pinata-rayas', rayas, { roughness: 0.85, clearcoat: 0 }), picos, true));
      est.add(muchos(new THREE.BoxGeometry(0.018, 0.22, 0.005), tela(0xffffff), flecos));
      g.userData.anim = (t) => { piv.rotation.z = Math.sin(t * 1.4) * 0.08; est.rotation.y = Math.sin(t * 0.7) * 0.4; };
      return g; },
  },
};
/* ---------- decoraciones de temporada: Halloween (octubre) y Navidad (diciembre). Se suman a MUEBLES por lugar. */
// carita tallada pintada en la textura de la calabaza (equirectangular: el frente +z cae en u=0.25), asi sigue la curva sin flotar ni encajarse
function pintarCalabaza(x, n, cara, luz) {
  if (luz) { x.fillStyle = '#000'; x.fillRect(0, 0, n, n); }
  else {
    const gr = x.createLinearGradient(0, 0, 0, n); gr.addColorStop(0, '#ffb867'); gr.addColorStop(0.55, '#ff9a3c'); gr.addColorStop(1, '#e06f26'); x.fillStyle = gr; x.fillRect(0, 0, n, n);
    const banda = (u, a, rgb, op) => { const g = x.createLinearGradient(u * n - a, 0, u * n + a, 0); g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.5, `rgba(${rgb},${op})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(u * n - a, 0, a * 2, n); };
    for (let j = 0; j <= 8; j++) { banda(j / 8, n / 30, '255,214,160', 0.3); if (j < 8) banda((2 * j + 1) / 16, n / 22, '176,72,18', 0.5); }   // brillo de cada gajo y surcos
  }
  const k = n / (2 * Math.PI);
  x.save(); x.setTransform(k, 0, 0, (2 * k) / 0.78, n * 0.25, n * 0.5); x.lineJoin = 'round'; x.lineCap = 'round';   // unidades = radio de la calabaza
  const hueco = (trazo) => { x.beginPath(); trazo(); if (luz) { x.fillStyle = '#ffc24a'; x.fill(); } else { x.strokeStyle = '#8f3a10'; x.lineWidth = 0.06; x.stroke(); x.fillStyle = '#ffd36e'; x.fill(); } };
  const tapa = (trazo, col = '#f08a34') => { x.beginPath(); trazo(); x.fillStyle = luz ? '#000' : col; x.fill(); };
  const linea = (trazo, w) => { x.beginPath(); trazo(); if (!luz) { x.strokeStyle = '#8f3a10'; x.lineWidth = w + 0.06; x.stroke(); } x.strokeStyle = luz ? '#ffc24a' : '#ffd36e'; x.lineWidth = w; x.stroke(); };
  const ovalo = (cx, cy, rx, ry) => () => x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  if (cara === 'tierna') {          // ojitos redondos con brillo, sonrisa chiquita y chapitas
    for (const s of [-1, 1]) { hueco(ovalo(s * 0.27, -0.13, 0.1, 0.13)); tapa(ovalo(s * 0.27 + 0.035, -0.18, 0.032, 0.035)); }
    hueco(() => { x.moveTo(-0.17, 0.11); x.quadraticCurveTo(0, 0.19, 0.17, 0.11); x.quadraticCurveTo(0, 0.36, -0.17, 0.11); });
    if (!luz) { x.fillStyle = 'rgba(255,110,120,.45)'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 0.43, 0.08, 0.08, 0.05, 0, 0, Math.PI * 2); x.fill(); } }
  } else if (cara === 'guino') {    // guiño, ojo ovalado y boca abierta con lengüita
    linea(() => x.arc(-0.27, -0.06, 0.1, Math.PI * 1.15, Math.PI * 1.85), 0.06);
    hueco(ovalo(0.27, -0.12, 0.09, 0.12));
    hueco(() => { x.moveTo(-0.28, 0.08); x.quadraticCurveTo(0, 0.14, 0.28, 0.08); x.quadraticCurveTo(0.25, 0.4, 0, 0.4); x.quadraticCurveTo(-0.25, 0.4, -0.28, 0.08); });
    tapa(ovalo(0, 0.32, 0.09, 0.05), '#ff7b8a');
  } else {                          // feliz: ojos de triangulo, naricita y sonrisota con un diente
    for (const s of [-1, 1]) hueco(() => { x.moveTo(s * 0.29 - 0.13, -0.06); x.lineTo(s * 0.29 + 0.13, -0.06); x.lineTo(s * 0.29, -0.29); x.closePath(); });
    hueco(() => { x.moveTo(-0.05, 0.06); x.lineTo(0.05, 0.06); x.lineTo(0, -0.01); x.closePath(); });
    hueco(() => { x.moveTo(-0.44, 0.08); x.quadraticCurveTo(0, 0.26, 0.44, 0.08); x.quadraticCurveTo(0.34, 0.44, 0, 0.44); x.quadraticCurveTo(-0.34, 0.44, -0.44, 0.08); });
    tapa(() => x.rect(-0.07, 0.15, 0.14, 0.1));
  }
  x.restore();
}
const matCalabaza = (cara) => matCuarto('calabaza|' + cara, () => clay(0xffffff, {
  map: texCuarto('calabaza-' + cara, (x, n) => pintarCalabaza(x, n, cara, false), 512), roughness: 0.55, sheen: 0.3,
  emissive: 0xffffff, emissiveMap: texCuarto('calabaza-luz-' + cara, (x, n) => pintarCalabaza(x, n, cara, true), 512), emissiveIntensity: 1.1 }));
// calabaza gajuda apoyada en y=0 (el fondo toca el piso), carita viendo hacia 'giro'
function calabazaCuarto({ r = 0.34, cara = 'feliz', giro = 0, tallo = true, resplandor = true } = {}) {
  const g = g0(), geo = esf(r, 40), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 - 0.08 * Math.abs(Math.sin(a * 4)) ** 0.6;
    p.setXYZ(i, x * k, y * (0.78 - (y < 0 ? 0.08 : 0)) * (1 - 0.25 * (Math.abs(y) / r) ** 6), z * k); }
  geo.computeVertexNormals();
  const c = g0(), yc = 0.545 * r; c.rotation.y = giro; g.add(c);
  c.add(malla(geo, matCalabaza(cara), { pos: [0, yc, 0] }));
  if (tallo) {
    c.add(malla(cil(0.09 * r, 0.13 * r, 0.47 * r, 8), clay(0x7a9a4c), { pos: [0.06 * r, yc + 0.76 * r, 0], rot: [0, 0, -0.25] }));
    c.add(det(hojaGeo(0.6 * r, 0.35 * r), clay(0x7cc46a), { pos: [0.12 * r, yc + 0.66 * r, 0.06 * r], rot: [-1.2, 0.6, -0.9] }));
    c.add(det(new THREE.TorusGeometry(0.18 * r, 0.03 * r, 6, 20, Math.PI * 1.6), clay(0x7cc46a), { pos: [-0.24 * r, yc + 0.69 * r, 0.06 * r], rot: [1.2, 0, 0] }));
  }
  if (resplandor) c.add(halo(0xffa04a, 2.4 * r, 0.3)).children.at(-1).position.set(0, yc, r * 1.05);
  return g;
}
// moño de listón (dos lazadas, nudo y puntas) apoyado en y=0
function monoListon(color, k = 1) {
  const m = g0(), t = tela(color);
  for (const s of [-1, 1]) {
    m.add(det(new THREE.TorusGeometry(0.07 * k, 0.026 * k, 10, 22), t, { pos: [s * 0.062 * k, 0.05 * k, 0], rot: [0, 0, s * 0.55], esc: [1, 0.8, 0.75] }));
    m.add(det(cajaR(0.055 * k, 0.016 * k, 0.15 * k, 0.008 * k), t, { pos: [s * 0.04 * k, 0.008 * k, 0.06 * k], rot: [0, s * 0.45, 0] }));
  }
  m.add(det(esf(0.04 * k, 12), t, { pos: [0, 0.03 * k, 0] }));
  return m;
}
// guirnalda que cuelga entre dos puntos de la pared (puntos de la curva con caida)
const curvaCaida = (x0, x1, y, caida, z, n = 24) => new THREE.CatmullRomCurve3(Array.from({ length: n + 1 }, (_, i) => { const k = i / n; return new THREE.Vector3(x0 + (x1 - x0) * k, y - Math.sin(k * Math.PI) * caida, z); }));
// foquitos que titilan: cambia el color de cada instancia (no toca materiales compartidos)
function titilar(focos, lista, vel = 2.6) {
  const base = lista.map((it) => new THREE.Color(it.color)), cc = new THREE.Color();
  return (t) => { base.forEach((c, i) => { const on = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * vel + i * 2.1)); focos.setColorAt(i, cc.copy(c).multiplyScalar(on)); }); focos.instanceColor.needsUpdate = true; };
}
Object.assign(MUEBLES.deco, {
  // tres calabazas apiladas con caritas distintas y hojitas de otoño
  calabazas: () => { const g = g0();
    g.add(calabazaCuarto({ r: 0.36, cara: 'feliz', giro: 0.45, tallo: false }));
    const mediana = calabazaCuarto({ r: 0.25, cara: 'guino', giro: 0.7 }); mediana.position.set(-0.02, 0.4, -0.01); mediana.rotation.z = 0.05; g.add(mediana);
    const chica = calabazaCuarto({ r: 0.19, cara: 'feliz', giro: 0.9 }); chica.position.set(0.62, 0, 0.43); g.add(chica);
    const hojaG = hojaGeo(0.26, 0.14);
    for (const [x, z, a, c] of [[-0.3, 0.3, 0.9, 0xff8a3a], [0.3, 0.36, -0.5, 0xffc23d], [-0.4, -0.05, 1.9, 0xe8603c]]) g.add(det(hojaG, clay(c), { pos: [x, 0.022, z], rot: [-Math.PI / 2, 0, a] }));
    return g; },
  // fantasmita de peluche: holanes en el borde, bracitos, chapitas y moño naranja; respira y se balancea
  fantasma: () => { const g = g0(), blanco = clay(0xf6f3fb, { roughness: 0.92, sheen: 1, sheenRoughness: 0.45, clearcoat: 0, emissive: 0xffffff, emissiveIntensity: 0.08 }), c = g0(); c.rotation.y = 0.5; g.add(c);
    // perfil suave (curva con muchos puntos) y holan ondulado de 6 picos redondos en el borde
    const perfil = new THREE.SplineCurve([[0.001, 0], [0.27, 0.0], [0.31, 0.08], [0.31, 0.2], [0.285, 0.36], [0.225, 0.5], [0.12, 0.6], [0.001, 0.63]].map(([x, y]) => new THREE.Vector2(x, y))).getPoints(40);
    const cuerpoG = new THREE.LatheGeometry(perfil, 72), pv = cuerpoG.attributes.position;
    for (let i = 0; i < pv.count; i++) { const x = pv.getX(i), y = pv.getY(i), z = pv.getZ(i), k = Math.max(0, 1 - y / 0.14) * Math.min(1, Math.hypot(x, z) / 0.27);
      pv.setY(i, y + k * 0.05 * (0.5 - 0.5 * Math.cos(Math.atan2(z, x) * 6))); }
    cuerpoG.computeVertexNormals();
    c.add(malla(cuerpoG, blanco));
    for (const s of [-1, 1]) {
      c.add(det(esf(0.05, 16), brillo(0x2d2440), { pos: [s * 0.095, 0.4, 0.235], esc: [0.8, 1.1, 0.45] }));
      c.add(det(esf(0.015, 8), plano(0xffffff), { pos: [s * 0.095 + 0.015, 0.425, 0.256] }));
      c.add(det(esf(0.04, 12), plano(0xffa3c4), { pos: [s * 0.16, 0.335, 0.236], esc: [1, 0.6, 0.3], rot: [0, s * 0.58, 0] }));
      c.add(malla(new THREE.CapsuleGeometry(0.06, 0.1, 6, 12), blanco, { pos: [s * 0.29, 0.28, 0.05], rot: [0.2, 0, s * 1.0] }));
    }
    c.add(det(arco(0.035, 0.011, Math.PI), plano(0x2d2440), { pos: [0, 0.335, 0.286], rot: [0, 0, Math.PI] }));
    const mono = g0(); mono.position.set(-0.14, 0.56, 0.1); mono.rotation.set(-0.3, -0.5, 0.5); c.add(mono);
    for (const s of [-1, 1]) mono.add(det(esf(0.06, 16), tela(0xffa04a), { pos: [s * 0.06, 0, 0], esc: [1, 0.75, 0.55] }));
    mono.add(det(esf(0.035, 12), tela(0xff8a2a)));
    c.add(halo(0xd9ccff, 1.1, 0.16)).children.at(-1).position.set(0, 0.35, 0);
    g.userData.anim = (t) => { const f = g.userData.fx || 0; c.rotation.y = 0.5 + Math.sin(t * 0.9) * 0.12; const b = Math.sin(t * 2.6), s = 1 + f * 0.3;
      c.scale.set((1 + b * 0.015) * s, (1 - b * 0.02) * (1 + f * 0.4), (1 + b * 0.015) * s); c.position.y = f * 0.1; };
    return g; },
  // caldero de bruja: olla morada con patitas, pocion verde que burbujea, cuchara que se mueve, fogata chiquita y dulces
  caldero: () => { const g = g0(), olla = clay(0x4a3d6b, { side: THREE.DoubleSide, roughness: 0.4, clearcoat: 0.6 }), aro = clay(0x6f5aa8);
    const verde = clay(0x8dff6e, { emissive: 0x3fd94a, emissiveIntensity: 0.85, roughness: 0.2, clearcoat: 1 });
    g.add(det(cil(0.035, 0.035, 0.3, 10), madera(0x9a6a48), { pos: [0, 0.035, 0], rot: [0, 0, Math.PI / 2] }));
    g.add(det(cil(0.035, 0.035, 0.3, 10), madera(0x8a5a44), { pos: [0, 0.062, 0], rot: [0, 2.1, Math.PI / 2] }));
    g.add(muchos(esf(0.03, 8), luz(0xffffff), [[0.06, 0.05, 0xff9a3a], [-0.05, -0.04, 0xffc64a], [0.02, -0.08, 0xff7a2a]].map(([x, z, c]) => ({ pos: [x, 0.03, z], color: c }))));
    g.add(halo(0xff8a3a, 0.7, 0.45)).children.at(-1).position.set(0, 0.07, 0.05);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + Math.PI / 6, x = Math.cos(a) * 0.22, z = Math.sin(a) * 0.22;
      g.add(det(cil(0.04, 0.03, 0.12, 10), olla, { pos: [x, 0.07, z] })); g.add(det(esf(0.042, 12), olla, { pos: [x, 0.025, z], esc: [1, 0.6, 1] })); }
    g.add(malla(torno([[0.001, 0.1], [0.18, 0.1], [0.3, 0.17], [0.37, 0.3], [0.37, 0.44], [0.32, 0.56], [0.3, 0.6], [0.28, 0.6], [0.27, 0.5], [0.2, 0.42]], 36), olla));
    g.add(malla(new THREE.TorusGeometry(0.3, 0.04, 10, 40), aro, { pos: [0, 0.61, 0], rot: [Math.PI / 2, 0, 0] }));
    g.add(det(esf(0.285, 32), verde, { pos: [0, 0.54, 0], esc: [1, 0.14, 1] }));
    for (const a of [0.6, 2.4, 4.3]) {   // escurridos de pocion por fuera
      g.add(det(esf(0.04, 12), verde, { pos: [Math.cos(a) * 0.31, 0.645, Math.sin(a) * 0.31], esc: [1.3, 0.6, 1.3] }));
      g.add(det(new THREE.CapsuleGeometry(0.028, 0.07, 4, 10), verde, { pos: [Math.cos(a) * 0.34, 0.565, Math.sin(a) * 0.34] }));
    }
    const cuchara = g0(); g.add(cuchara);
    cuchara.add(malla(cil(0.018, 0.022, 0.6, 8), madera(0xc98f62), { pos: [0.08, 0.75, -0.05], rot: [0, 0, -0.35] }));
    cuchara.add(det(esf(0.03, 10), madera(0xc98f62), { pos: [0.183, 1.03, -0.05] }));
    for (const [x, z, c] of [[0.44, 0.24, 0xffa04a], [-0.4, 0.3, 0xb48cff]]) {   // dulces envueltos
      const d = g0(); d.position.set(x, 0.045, z); d.rotation.y = x * 2; g.add(d);
      d.add(det(esf(0.045, 12), brillo(c), { esc: [1.3, 1, 1] }));
      for (const s of [-1, 1]) d.add(det(new THREE.ConeGeometry(0.035, 0.06, 10), brillo(c), { pos: [s * 0.08, 0, 0], rot: [0, 0, s * Math.PI / 2] }));
    }
    const burbuja = clay(0xc6ffb0, { emissive: 0x5cff4a, emissiveIntensity: 0.6, roughness: 0.15, clearcoat: 1 });
    const enSuperficie = [0, 1, 2, 3].map(() => { const b = det(esf(0.045, 12), verde); g.add(b); return b; });
    const suben = [0, 1, 2].map(() => { const b = det(esf(0.035, 12), burbuja); g.add(b); return b; });
    g.add(halo(0x7dff6a, 1.2, 0.45)).children.at(-1).position.set(0, 0.68, 0);
    g.userData.anim = (t) => {
      enSuperficie.forEach((b, i) => { const v = t * 0.55 + i * 0.27, k = v % 1, a = i * 1.7 + Math.floor(v) * 2.3, rr = 0.06 + (i % 2) * 0.08, s = Math.sin(k * Math.PI);
        b.position.set(Math.cos(a) * rr, 0.565, Math.sin(a) * rr); b.scale.set(s * 1.1 + 0.01, s * 0.8 + 0.01, s * 1.1 + 0.01); });
      suben.forEach((b, i) => { const k = (t * 0.35 + i / 3) % 1; b.position.set(Math.sin(t * 1.3 + i * 2) * 0.06 + (i - 1) * 0.08, 0.62 + k * 0.5, Math.cos(t + i) * 0.05); b.scale.setScalar((1 - k) * 0.9 + 0.1); b.visible = k < 0.96; });
      cuchara.rotation.y = (t + (g.userData.tx || 0)) * 0.6;
    };
    return g; },
  // regalos apilados con listones y moños; el chiquito brinca de vez en cuando (¡algo se mueve adentro!)
  regalos: () => { const g = g0(), c = g0(); c.rotation.y = 0.3; g.add(c);
    const caja = (w, h, d, color, cinta, pos, ry) => { const k = g0(); k.position.set(...pos); k.rotation.y = ry; c.add(k);
      k.add(malla(cajaR(w, h, d, 0.04), clay(color), { pos: [0, h / 2, 0] }));
      k.add(det(cajaR(w + 0.014, h + 0.014, 0.075, 0.02), tela(cinta), { pos: [0, h / 2, 0] }));
      k.add(det(cajaR(0.075, h + 0.014, d + 0.014, 0.02), tela(cinta), { pos: [0, h / 2, 0] }));
      return k; };
    const grande = caja(0.6, 0.42, 0.52, 0xe5484d, 0xffd34d, [0, 0, 0], 0);
    grande.add(det(cajaR(0.13, 0.09, 0.012, 0.006), clay(0xfffaf2), { pos: [0.17, 0.25, 0.268], rot: [0, 0, 0.18] }));
    grande.add(det(corazonGeo(0.028), clay(0xff5c8a), { pos: [0.17, 0.25, 0.278], rot: [0, 0, 0.18], esc: [1, 1, 0.35] }));
    const media = caja(0.42, 0.3, 0.38, 0x4fb06d, 0xff5c6c, [-0.02, 0.427, 0], 0.45);
    const mm = monoListon(0xff5c6c); mm.position.y = 0.307; media.add(mm);
    const chica = caja(0.3, 0.26, 0.3, 0x7fb8ff, 0xffffff, [0.56, 0, 0.34], -0.35);
    const mc = monoListon(0xffffff, 0.8); mc.position.y = 0.267; chica.add(mc);
    g.userData.anim = (t) => { const f = t % (g.userData.fx ? 1.1 : 3.4), s = f < 0.5 ? Math.sin((f / 0.5) * Math.PI) : 0, w = f < 0.5 ? Math.sin((f / 0.5) * Math.PI * 2) : 0;
      chica.position.y = s * 0.06; chica.scale.set(1 + w * 0.04, 1 - w * 0.06, 1 + w * 0.04); chica.rotation.z = s * 0.06; };
    return g; },
  // muñeco de nieve de peluche: gorro con pompón, bufanda a rayas, nariz de zanahoria, guantes y nieve en el piso
  nieve: () => { const g = g0(), c = g0(); c.rotation.y = 0.45; g.add(c);
    const blanco = tela(0xfbfcff), rojo = tela(0xe5484d), ramita = madera(0x8a5a44);
    g.add(det(esf(0.46, 28), tela(0xffffff), { esc: [1, 0.07, 1] }));
    g.add(muchos(esf(1, 12), tela(0xffffff), [[0.42, 0.16], [-0.3, 0.33], [0.1, -0.45], [-0.44, -0.12]].map(([x, z]) => ({ pos: [x, 0.02, z], esc: [0.07, 0.04, 0.06] }))));
    c.add(malla(esf(0.3, 32), blanco, { pos: [0, 0.28, 0], esc: [1, 0.93, 1] }));
    c.add(malla(esf(0.22, 32), blanco, { pos: [0, 0.7, 0] }));
    for (const [y, z] of [[0.42, 0.255], [0.62, 0.2], [0.72, 0.213]]) c.add(det(esf(0.026, 12), brillo(0x2d2440), { pos: [-0.02, y, z], esc: [1, 1, 0.5] }));
    const rayas = texCuarto('bufanda-rayas', (x, n) => { x.fillStyle = '#e5484d'; x.fillRect(0, 0, n, n); x.fillStyle = '#fff6ec'; for (let i = 0; i < 8; i++) x.fillRect(i * n / 8, 0, n / 16, n); }, 128);
    c.add(malla(new THREE.TorusGeometry(0.165, 0.05, 12, 40), conTex('bufanda-rayas', rayas, { roughness: 0.92, clearcoat: 0, sheen: 1 }), { pos: [0, 0.87, 0], rot: [Math.PI / 2, 0, 0] }));
    // punta de la bufanda: se dobla siguiendo la panza (cada vertice se pega a la bola de en medio)
    const pegar = (w, h, d, y0, off) => { const geo = new THREE.BoxGeometry(w, h, d, 2, 10, 1), p = geo.attributes.position, th = 0.45;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = y0 + p.getY(i), z = p.getZ(i), rr = Math.sqrt(Math.max(0, 0.0484 - (y - 0.7) ** 2)) + off + z;
        p.setXYZ(i, Math.sin(th) * rr + Math.cos(th) * x, y, Math.cos(th) * rr - Math.sin(th) * x); }
      geo.computeVertexNormals(); return geo; };
    c.add(det(pegar(0.1, 0.27, 0.035, 0.725, 0.02), rojo));
    c.add(det(pegar(0.104, 0.05, 0.04, 0.635, 0.021), tela(0xfff6ec)));
    const yF = 0.578, rF = Math.sqrt(0.0484 - (yF - 0.7) ** 2) + 0.022;
    c.add(muchos(new THREE.CapsuleGeometry(0.008, 0.03, 3, 6), tela(0xfff6ec), [-0.03, 0, 0.03].map((x) => ({ pos: [Math.sin(0.45) * rF + Math.cos(0.45) * x, yF, Math.cos(0.45) * rF - Math.sin(0.45) * x] }))));
    for (const s of [-1, 1]) {
      c.add(malla(cil(0.016, 0.022, 0.32, 8), ramita, { pos: [s * 0.3, 0.74, 0], rot: [0, 0, -s * 1.1] }));
      c.add(det(cil(0.01, 0.013, 0.09, 6), ramita, { pos: [s * 0.37, 0.81, 0], rot: [0, 0, -s * 0.2] }));
      c.add(det(esf(0.055, 14), rojo, { pos: [s * 0.45, 0.82, 0], esc: [1, 1.15, 0.85] }));
      c.add(det(esf(0.025, 10), rojo, { pos: [s * 0.42, 0.85, 0.035] }));
    }
    const cab = g0(); cab.position.set(0, 1.0, 0); c.add(cab);
    cab.add(malla(esf(0.18, 32), blanco));
    for (const s of [-1, 1]) {
      cab.add(det(esf(0.03, 14), brillo(0x2d2440), { pos: [s * 0.065, 0.035, 0.158], esc: [0.9, 1.1, 0.6] }));
      cab.add(det(esf(0.009, 6), plano(0xffffff), { pos: [s * 0.065 + 0.01, 0.047, 0.174] }));
      cab.add(det(esf(0.032, 12), plano(0xffa3c4), { pos: [s * 0.11, -0.01, 0.137], esc: [1, 0.6, 0.3], rot: [0, s * 0.65, 0] }));
    }
    cab.add(det(new THREE.ConeGeometry(0.032, 0.14, 12), clay(0xff8a3a), { pos: [0, 0, 0.235], rot: [Math.PI / 2, 0, 0] }));
    cab.add(muchos(esf(0.011, 8), brillo(0x2d2440), [0, 1, 2, 3, 4].map((i) => { const xx = (i - 2) * 0.026, yy = -0.07 + 0.015 * ((i - 2) / 2) ** 2; return { pos: [xx, yy, Math.sqrt(0.0324 - xx * xx - yy * yy) - 0.004] }; })));
    const gorro = g0(); gorro.rotation.set(-0.12, 0, 0.18); cab.add(gorro);
    gorro.add(malla(new THREE.SphereGeometry(0.19, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), rojo, { pos: [0, 0.05, 0] }));
    gorro.add(det(new THREE.TorusGeometry(0.178, 0.042, 10, 36), tela(0x4fb06d), { pos: [0, 0.055, 0], rot: [Math.PI / 2, 0, 0] }));
    gorro.add(det(esf(0.06, 14), tela(0xffffff), { pos: [0, 0.25, 0] }));
    g.userData.anim = (t) => { c.rotation.z = Math.sin(t * 1.1) * 0.03; cab.rotation.z = Math.sin(t * 1.1 + 0.6) * 0.06; cab.rotation.y = Math.sin(t * 0.5) * 0.12; };
    return g; },
});
Object.assign(MUEBLES.lampara, {
  // calabaza con sombrero de bruja sobre una paca de paja, con dos velitas; ilumina naranja
  calabaza: () => { const g = g0(), paja = tela(0xf0cc6e);
    g.add(malla(cajaR(0.82, 0.32, 0.6, 0.08), paja, { pos: [0, 0.16, 0] }));
    for (const x of [-0.22, 0.22]) g.add(det(cajaR(0.05, 0.336, 0.616, 0.03), clay(0xb5793f), { pos: [x, 0.16, 0] }));
    const r = azarCon(3), pajas = [];
    for (let i = 0; i < 16; i++) { const lado = i % 4, u = r() - 0.5, pos = lado === 0 ? [u * 0.76, 0.3, 0.3] : lado === 1 ? [u * 0.76, 0.3, -0.3] : [lado === 2 ? 0.41 : -0.41, 0.3, u * 0.54];
      pajas.push({ pos, rot: [(r() - 0.5) * 1.6, r() * 3, (r() - 0.5) * 1.6] }); }
    g.add(muchos(new THREE.CapsuleGeometry(0.008, 0.1, 3, 6), tela(0xffe08f), pajas));
    const cal = calabazaCuarto({ r: 0.36, cara: 'feliz', giro: 0.35, tallo: false }); cal.position.y = 0.315; g.add(cal);
    const sombrero = g0(); sombrero.position.set(0, 0.71, 0); sombrero.rotation.set(0.03, 0.35, -0.06); g.add(sombrero);
    const morado = tela(0x6b4fa8);
    sombrero.add(malla(esf(0.3, 32), morado, { esc: [1, 0.07, 1] }));
    const conoG = torno([[0.17, 0], [0.155, 0.06], [0.11, 0.2], [0.06, 0.34], [0.001, 0.46]], 24), pc = conoG.attributes.position;
    for (let i = 0; i < pc.count; i++) pc.setX(i, pc.getX(i) - 0.16 * (Math.max(0, pc.getY(i)) / 0.46) ** 2.4);
    conoG.computeVertexNormals();
    sombrero.add(malla(conoG, morado, { pos: [0, 0.01, 0] }));
    sombrero.add(det(cil(0.164, 0.174, 0.05, 28), tela(0xffa04a), { pos: [0, 0.04, 0] }));
    sombrero.add(det(cajaR(0.07, 0.06, 0.02, 0.01), metal(0xffcf3f), { pos: [0, 0.04, 0.172] }));
    sombrero.add(det(estrellaGeo(0.05, 0.022), luz(0xffe27a), { pos: [-0.16, 0.5, 0], esc: [1, 1, 0.4] }));
    const llamas = [];
    for (const [x, z, h] of [[0.36, 0.22, 0.14], [-0.34, 0.24, 0.1]]) {
      g.add(det(cil(0.035, 0.038, h, 14), clay(0xfff1dc), { pos: [x, 0.32 + h / 2, z] }));
      const f = det(esf(0.025, 10), luz(0xffb347), { pos: [x, 0.32 + h + 0.035, z], esc: [1, 1.6, 1] }); g.add(f); llamas.push(f);
      g.add(halo(0xffb347, 0.35, 0.5)).children.at(-1).position.set(x, 0.32 + h + 0.035, z);
    }
    g.add(halo(0xffa04a, 1.6, 0.3)).children.at(-1).position.set(0, 0.5, 0.2);
    g.userData.foco = new THREE.Vector3(0, 0.55, 0.3); g.userData.colorFoco = 0xffa04a;
    const brillos = []; g.traverse((x) => { if (x.isMesh && x.material?.blending === THREE.AdditiveBlending) brillos.push(x); });
    g.userData.anim = (t) => { const k = 1 + (g.userData.fx || 0) * 1.6;
      llamas.forEach((f, i) => f.scale.set((1 + Math.sin(t * 13 + i) * 0.12) * k, (1.6 + Math.sin(t * 17 + i * 2) * 0.25) * k, k)); brillos.forEach((b) => b.scale.setScalar(k)); };
    return g; },
});
Object.assign(MUEBLES.cuadro, {
  // telaraña de estambre en un bastidor, con lunita y una arañita sonriente que sube y baja
  telarana: () => { const g = g0(), hilo = clay(0xf6f2ff, { roughness: 0.5, sheen: 0.6 });
    g.add(malla(new THREE.TorusGeometry(0.5, 0.035, 12, 64), madera(0xe0ac78), { pos: [0, 0, 0.02] }));
    g.add(det(cil(0.5, 0.5, 0.02, 64), tela(0x4b3a7a), { pos: [0, 0, -0.005], rot: [Math.PI / 2, 0, 0] }));
    const s = new THREE.Shape(); s.absarc(0, 0, 0.1, Math.PI * 0.35, Math.PI * 1.65, false); s.absarc(0.048, 0, 0.089, -1.597, 1.597, true);
    g.add(det(new THREE.ShapeGeometry(s, 16), luz(0xffe27a), { pos: [0.24, 0.25, 0.008], rot: [0, 0, 0.5] }));
    g.add(muchos(esf(0.012, 6), luz(0xfff3b0), [[-0.3, 0.2], [-0.12, 0.36], [0.33, -0.12], [-0.28, -0.26], [0.1, -0.36]].map(([x, y]) => ({ pos: [x, y, 0.008] }))));
    for (let i = 0; i < 4; i++) g.add(det(cil(0.013, 0.013, 0.92, 6), hilo, { pos: [0, 0, 0.022], rot: [0, 0, i * Math.PI / 4 + 0.15 - Math.PI / 2] }));
    for (const rr of [0.11, 0.21, 0.31, 0.41]) { const cam = new THREE.CurvePath();
      for (let i = 0; i < 8; i++) { const a0 = i * Math.PI / 4 + 0.15, a1 = a0 + Math.PI / 4, am = (a0 + a1) / 2;
        cam.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(Math.cos(a0) * rr, Math.sin(a0) * rr, 0.024), new THREE.Vector3(Math.cos(am) * rr * 0.8, Math.sin(am) * rr * 0.8, 0.024), new THREE.Vector3(Math.cos(a1) * rr, Math.sin(a1) * rr, 0.024))); }
      g.add(det(new THREE.TubeGeometry(cam, 128, 0.01, 5, true), hilo)); }
    const mono = monoListon(0xffa04a, 0.8); mono.position.set(0, 0.5, 0.05); mono.rotation.x = Math.PI / 2; g.add(mono);
    g.add(det(esf(0.022, 10), hilo, { pos: [0, 0, 0.05] }));
    const hiloA = det(cil(0.005, 0.005, 1, 4), hilo); g.add(hiloA);
    const arana = g0(), cuerpoA = tela(0x3d3358); g.add(arana);
    arana.add(malla(esf(0.09, 20), cuerpoA, { esc: [1, 0.95, 0.9] }));
    for (const s2 of [-1, 1]) {
      arana.add(det(esf(0.032, 12), clay(0xffffff), { pos: [s2 * 0.035, 0.015, 0.072] }));
      arana.add(det(esf(0.018, 10), brillo(0x2d2440), { pos: [s2 * 0.035, 0.012, 0.093] }));
      arana.add(det(esf(0.018, 8), plano(0xff9db5), { pos: [s2 * 0.062, -0.03, 0.053], esc: [1, 0.6, 0.4] }));
      for (let j = 0; j < 3; j++) arana.add(det(arco(0.05, 0.012, Math.PI), cuerpoA, { pos: [s2 * 0.13, 0.03 - j * 0.045, 0], rot: [0, 0, -s2 * (j - 1) * 0.35] }));
    }
    arana.add(det(arco(0.02, 0.006, Math.PI), plano(0x2d2440), { pos: [0, -0.025, 0.079], rot: [0, 0, Math.PI] }));
    g.userData.anim = (t) => { const y = -0.64 - (g.userData.fx || 0) * 0.8 + Math.sin(t * 1.4) * 0.05; arana.position.set(0, y, 0.085); arana.rotation.z = Math.sin(t * 1.1) * 0.12;
      hiloA.position.set(0, (y + 0.085) / 2, 0.075); hiloA.scale.y = -y - 0.085; };
    g.userData.anim(0);
    return g; },
  // guirnalda de murcielaguitos de fieltro (aletean) y lunitas y estrellas que brillan
  murcielagos: () => { const g = g0(), curva = curvaCaida(-0.78, 0.78, 0.24, 0.2, 0.03);
    g.add(det(new THREE.TubeGeometry(curva, 64, 0.012, 6), clay(0xffa04a)));
    for (const s of [-1, 1]) { g.add(det(esf(0.03, 10), metal(0xffcf3f), { pos: [s * 0.78, 0.24, 0.03] }));
      const m = monoListon(0x8a6fd6, 0.7); m.position.set(s * 0.78, 0.24, 0.05); m.rotation.x = Math.PI / 2; g.add(m); }
    const alaG = (() => { const a = new THREE.Shape(); a.moveTo(0, 0.045); a.quadraticCurveTo(0.1, 0.11, 0.2, 0.085);
      const bajo = [[0.2, 0.085], [0.15, 0.0], [0.08, -0.015], [0.0, -0.03]];
      for (let i = 1; i < bajo.length; i++) { const [x0, y0] = bajo[i - 1], [x1, y1] = bajo[i]; a.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 0.035, x1, y1); }
      a.closePath();
      const geo = new THREE.ExtrudeGeometry(a, { depth: 0.012, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 8 }); geo.translate(0, 0, -0.006); return geo; })();
    const lunaG = (() => { const s = new THREE.Shape(); s.absarc(0, 0, 0.07, Math.PI * 0.35, Math.PI * 1.65, false); s.absarc(0.0333, 0, 0.0623, -1.597, 1.597, true);
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 3, curveSegments: 20 }); geo.center(); return geo; })();
    const dorado = clay(0xffe27a, { emissive: 0xffc94d, emissiveIntensity: 0.6 }), colgantes = [], alas = [];
    const murci = (color) => { const b = g0(), piel = tela(color);
      b.add(malla(esf(0.075, 20), piel, { esc: [1, 0.95, 0.9] }));
      for (const s of [-1, 1]) {
        b.add(det(new THREE.ConeGeometry(0.028, 0.06, 10), piel, { pos: [s * 0.04, 0.075, 0], rot: [0, 0, -s * 0.35] }));
        b.add(det(new THREE.ConeGeometry(0.014, 0.035, 8), tela(0xffb3c9), { pos: [s * 0.041, 0.072, 0.015], rot: [0, 0, -s * 0.35] }));
        b.add(det(esf(0.017, 10), brillo(0x2d2440), { pos: [s * 0.026, 0.012, 0.058], esc: [0.9, 1.1, 0.6] }));
        b.add(det(esf(0.006, 6), plano(0xffffff), { pos: [s * 0.026 + 0.006, 0.02, 0.068] }));
        b.add(det(esf(0.014, 8), plano(0xff9db5), { pos: [s * 0.048, -0.012, 0.05], esc: [1, 0.6, 0.4] }));
        b.add(det(new THREE.ConeGeometry(0.006, 0.016, 6), clay(0xffffff), { pos: [s * 0.01, -0.032, 0.058], rot: [Math.PI, 0, 0] }));
        const w = g0(); w.position.set(s * 0.06, 0, -0.005); w.scale.x = s; b.add(w); w.add(det(alaG, tela(oscurecer(color, 0.25)))); alas.push([w, s]);
      }
      return b; };
    [0.14, 0.32, 0.5, 0.68, 0.86].forEach((k, i) => { const p = curva.getPoint(k), h = g0(); h.position.set(p.x, p.y, 0.03); g.add(h); colgantes.push(h);
      const L = i % 2 ? 0.07 : 0.05 + (i % 3) * 0.015, alto = i % 2 ? 0.1 : 0.1;
      h.add(det(cil(0.006, 0.006, L, 4), clay(0xfff1dc), { pos: [0, -L / 2, 0.02] }));
      const cosa = i % 2 ? det(i === 1 ? lunaG : estrellaGeo(0.06, 0.028), dorado, { esc: i === 1 ? [1.5, 1.5, 1.2] : [1.4, 1.4, 0.5] }) : murci(i === 2 ? 0xb39ce6 : 0x9c82d6);
      cosa.position.set(0, -L - alto, 0.05); h.add(cosa); });
    g.userData.anim = (t) => { const f = g.userData.fx || 0, tt = t + (g.userData.tx || 0); colgantes.forEach((h, i) => { h.rotation.z = Math.sin(tt * 1.3 + i) * 0.08 * (1 + f * 2); });
      alas.forEach(([w, s], i) => { w.rotation.y = -s * (0.1 + (0.3 + f * 0.2) * Math.sin(tt * 7 + Math.floor(i / 2))); }); };
    return g; },
  // guirnalda de pino con foquitos que titilan y tres botas navideñas colgadas
  botas: () => { const g = g0(), curva = curvaCaida(-0.8, 0.8, 0.3, 0.13, 0.065);
    g.add(malla(new THREE.TubeGeometry(curva, 64, 0.05, 10), tela(0x3f9a5c)));
    const r = azarCon(21), pino = [];
    for (let i = 0; i < 70; i++) { const p = curva.getPoint(i / 69), a = r() * Math.PI * 2, e = 0.8 + r() * 0.5;
      pino.push({ pos: [p.x + (r() - 0.5) * 0.03, p.y + Math.sin(a) * 0.045, 0.065 + Math.abs(Math.cos(a)) * 0.04], esc: [0.045 * e, 0.035 * e, 0.045 * e], color: i % 3 ? 0x4fb06d : 0x3a8f55 }); }
    g.add(muchos(esf(1, 10), tela(0xffffff), pino));
    const cols = [0xff5c6c, 0xffd34d, 0x6fb6ff, 0x7be08a, 0xff9fd8], lista = [];
    for (let i = 0; i < 14; i++) { const p = curva.getPoint((i + 0.5) / 14); lista.push({ pos: [p.x, p.y + (i % 2 ? 0.04 : -0.045), 0.13], esc: [1, 1.25, 1], color: cols[i % 5] }); }
    const focos = muchos(esf(0.026, 10), luz(0xffffff), lista); g.add(focos);
    for (const s of [-1, 1]) { const m = monoListon(0xe5484d, 0.9); m.position.set(s * 0.8, 0.3, 0.12); m.rotation.x = Math.PI / 2; g.add(m); }
    const botaG = (() => { const s = new THREE.Shape(); s.moveTo(-0.09, 0); s.lineTo(-0.09, -0.3); s.quadraticCurveTo(-0.09, -0.42, 0.02, -0.42); s.lineTo(0.12, -0.42);
      s.quadraticCurveTo(0.21, -0.42, 0.21, -0.35); s.quadraticCurveTo(0.21, -0.27, 0.12, -0.27); s.quadraticCurveTo(0.09, -0.27, 0.09, -0.23); s.lineTo(0.09, 0); s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 4, curveSegments: 10 }); geo.translate(0, 0, -0.025); return geo; })();
    const rayas = texCuarto('bota-rayas', (x, n) => { x.fillStyle = '#fffaf2'; x.fillRect(0, 0, n, n); x.fillStyle = '#e5484d';
      for (const o of [-2 * n, -n, 0, n]) { x.beginPath(); x.moveTo(o, n); x.lineTo(o + n / 2, n); x.lineTo(o + 1.5 * n, 0); x.lineTo(o + n, 0); x.closePath(); x.fill(); } }, 64, [5, 5]);
    const colgadas = [];
    [[-0.56, 'rayas', 1], [-0.04, 0xe5484d, 1], [0.48, 0x4fb06d, 1]].forEach(([x, c, lado], i) => { const p = curva.getPoint((x + 0.8) / 1.6), h = g0(); h.position.set(x, p.y - 0.07, 0.075); g.add(h); colgadas.push(h);
      const b = g0(); b.scale.x = lado; h.add(b);
      b.add(malla(botaG, c === 'rayas' ? conTex('bota-rayas', rayas, { roughness: 0.9, clearcoat: 0, sheen: 1 }) : tela(c), { pos: [0, -0.06, 0] }));
      b.add(malla(cajaR(0.3, 0.11, 0.15, 0.05), tela(0xffffff), { pos: [0, -0.06, 0] }));
      b.add(det(new THREE.TorusGeometry(0.032, 0.01, 8, 18), metal(0xffcf3f), { pos: [0, 0.02, 0.06] }));   // ganchito que la cuelga de la guirnalda
      if (i === 1) b.add(det(estrellaGeo(0.06, 0.027), metal(0xffcf3f), { pos: [0.0, -0.26, 0.062], esc: [1, 1, 0.3] }));
      if (i === 2) b.add(det(corazonGeo(0.055), tela(0xe5484d), { pos: [0.0, -0.26, 0.062], esc: [1, 1, 0.45] }));
      if (i === 0) b.add(det(esf(0.04, 12), metal(0xffcf3f), { pos: [0.16, -0.4, 0.05] }));
    });
    const brilla = titilar(focos, lista);
    g.userData.anim = (t) => { const f = g.userData.fx || 0, tt = t + (g.userData.tx || 0); brilla(tt); colgadas.forEach((h, i) => { h.rotation.z = Math.sin(tt * 1.2 + i * 1.7) * 0.04 * (1 + f * 4); }); };
    return g; },
  // corona navideña: hojitas de fieltro, moras rojas, foquitos y moño grande con colitas
  corona: () => { const g = g0();
    g.add(malla(new THREE.TorusGeometry(0.34, 0.09, 14, 48), tela(0x3a8f55), { pos: [0, 0, 0.065], esc: [1, 1, 0.6] }));
    const r = azarCon(31), hojas = [], verdes = [0x4fb06d, 0x3a8f55, 0x6cc47a];
    for (let i = 0; i < 54; i++) { const a = (i / 54) * Math.PI * 2 + r() * 0.1, fila = i % 3, rad = 0.34 + (fila - 1) * 0.07;
      hojas.push({ pos: [Math.cos(a) * rad, Math.sin(a) * rad, 0.1 + (fila === 1 ? 0.03 : 0)], rot: [(r() - 0.5) * 0.4, (r() - 0.5) * 0.4, a + (r() - 0.5) * 0.5], color: verdes[(i + fila) % 3] }); }
    g.add(muchos(hojaGeo(0.17, 0.075), clay(0xffffff), hojas, true));
    const moras = [];
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.9; for (let j = 0; j < 3; j++) { const b = a + (j - 1) * 0.06; moras.push({ pos: [Math.cos(b) * (0.34 + (j % 2) * 0.03), Math.sin(b) * (0.34 + (j % 2) * 0.03), 0.165] }); } }
    g.add(muchos(esf(0.028, 12), brillo(0xe5484d), moras));
    const cols = [0xfff2a8, 0xffd27a, 0xff9fb8, 0xa8e4ff], lista = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2 + 0.2, rad = i % 2 ? 0.42 : 0.27; return { pos: [Math.cos(a) * rad, Math.sin(a) * rad, 0.15], color: cols[i % 4] }; });
    const focos = muchos(esf(0.022, 8), luz(0xffffff), lista); g.add(focos);
    const lazo = g0(); lazo.position.set(0, -0.36, 0.17); g.add(lazo);
    for (const s of [-1, 1]) {
      lazo.add(det(new THREE.TorusGeometry(0.085, 0.032, 10, 22), tela(0xe5484d), { pos: [s * 0.085, 0.02, 0], rot: [0, 0, s * 0.5], esc: [1, 0.75, 0.7] }));
      lazo.add(det(cajaR(0.06, 0.24, 0.025, 0.012), tela(0xe5484d), { pos: [s * 0.06, -0.14, -0.01], rot: [0, 0, s * 0.25] }));
    }
    lazo.add(det(esf(0.045, 12), tela(0xd63c44), { esc: [1, 1, 0.8] }));
    const brilla = titilar(focos, lista, 2.2);
    g.userData.anim = (t) => { const f = g.userData.fx || 0, tt = t + (g.userData.tx || 0); brilla(tt); lazo.rotation.z = Math.sin(tt * 1.4) * 0.04 * (1 + f * 3); };
    return g; },
});
Object.assign(MUEBLES.planta, {
  // arbolito de Navidad de fieltro: maceta roja, nieve, esferas, foquitos que titilan y estrella que brilla
  navidad: () => { const g = g0(), pino = tela(0x3f9e5e);
    g.add(malla(torno([[0.2, 0], [0.235, 0.05], [0.265, 0.33], [0.29, 0.35], [0.29, 0.41], [0.255, 0.41], [0.25, 0.37]], 32), ceramica(0xe5484d)));
    g.add(det(cil(0.256, 0.262, 0.07, 32), ceramica(0xffffff), { pos: [0, 0.19, 0] }));
    g.add(det(esf(0.26, 24), tela(0xffffff), { pos: [0, 0.38, 0], esc: [1, 0.3, 1] }));
    g.add(det(cil(0.05, 0.065, 0.2, 10), madera(0x8a5a44), { pos: [0, 0.52, 0] }));
    const capas = [[0.42, 0.56, 1.04], [0.34, 0.84, 1.3], [0.25, 1.1, 1.52]], alturas = [[0.68, 0.76], [0.95, 1.02], [1.22, 1.32]];
    const perfil = (rb, b, t) => [[0.001, b + 0.06], [rb * 0.8, b], [rb, b + 0.035], [rb * 0.96, b + 0.08], [rb * 0.55, b + (t - b) * 0.5], [rb * 0.2, t - (t - b) * 0.12], [0.001, t]];
    const radioEn = (pf, y) => { for (let i = 3; i < pf.length - 1; i++) { const [r0, y0] = pf[i], [r1, y1] = pf[i + 1]; if (y >= y0 && y <= y1) return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return 0; };
    const orillas = [], bolas = [], lista = [], colsB = [0xff5c6c, 0xffd34d, 0x6fb6ff, 0xff8fc8, 0xffffff], colsF = [0xfff2a8, 0xff9fb8, 0xa8e4ff, 0xffd27a];
    capas.forEach(([rb, b, t], c) => { const pf = perfil(rb, b, t); g.add(malla(torno(pf, 36), pino));
      const n = Math.round(rb * 40);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + c * 0.3; orillas.push({ pos: [Math.cos(a) * rb * 0.93, b + 0.045, Math.sin(a) * rb * 0.93], esc: [0.065, 0.05, 0.065], color: i % 2 ? 0x56b873 : 0x3f9e5e }); }
      const nb = [7, 6, 4][c], rB = c === 2 ? 0.038 : 0.045;
      for (let i = 0; i < nb; i++) { const a = (i / nb) * Math.PI * 2 + c * 0.7, y = alturas[c][i % 2], rr = radioEn(pf, y) + 0.02;
        bolas.push({ pos: [Math.cos(a) * rr, y, Math.sin(a) * rr], esc: [rB, rB, rB], color: colsB[(i + c) % 5] }); }
      const nf = nb + 2;
      for (let i = 0; i < nf; i++) { const a = ((i + 0.5) / nf) * Math.PI * 2 + c * 0.7, y = (alturas[c][0] + alturas[c][1]) / 2 + (i % 2 ? 0.03 : -0.03), rr = radioEn(pf, y) + 0.012;
        lista.push({ pos: [Math.cos(a) * rr, y, Math.sin(a) * rr], esc: [1, 1.25, 1], color: colsF[(i + c) % 4] }); }
    });
    g.add(muchos(esf(1, 14), tela(0xffffff), orillas, true));
    g.add(muchos(esf(1, 16), brillo(0xffffff), bolas));
    const focos = muchos(esf(0.026, 8), luz(0xffffff), lista); g.add(focos);
    const est = det(estrellaGeo(0.13, 0.06), luz(0xffe27a), { pos: [0, 1.57, 0] }); g.add(est);
    const h = halo(0xffe27a, 1.0, 0.5); h.position.set(0, 1.57, 0); g.add(h);
    const brilla = titilar(focos, lista);
    g.userData.anim = (t) => { const f = g.userData.fx || 0; brilla(t * (1 + f * 2)); est.rotation.y = f ? t * 3 : Math.sin(t * 0.9) * 0.6; h.scale.setScalar(1 + Math.sin(t * 2.4) * 0.12 + f * (0.6 + 0.3 * Math.sin(t * 7))); };
    return g; },
});
// logo de Web Dev-Eyes (círculo azul con M roja y N azul, fondo transparente): web/./img/web-dev-eyes.svg, para el tapete DE
const LOGO_MN = (() => { if (typeof Image === 'undefined') return null; const im = new Image(); im.src = new URL('./img/web-dev-eyes.svg', import.meta.url).href; return im; })();
const logoMnListo = () => !!(LOGO_MN?.complete && LOGO_MN.naturalWidth);
Object.assign(MUEBLES.tapete, {
  // tapete navideño tejido: anillos rojo y verde con copos, arbolitos y estrella; orilla de peluche con pompones
  navidad: () => { const g = g0();
    const tex = texCuarto('tap-navidad', (x, n) => {
      const c = n / 2, anillo = (r, col) => { x.fillStyle = col; x.beginPath(); x.arc(c, c, c * r, 0, 7); x.fill(); };
      anillo(1, '#e5484d'); anillo(0.84, '#fff6ec'); anillo(0.8, '#3f9a5c'); anillo(0.55, '#fff6ec'); anillo(0.51, '#e5484d'); anillo(0.47, '#fff4e6');
      x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 3; x.setLineDash([8, 7]);
      for (const k of [0.92, 0.77, 0.58]) { x.beginPath(); x.arc(c, c, c * k, 0, 7); x.stroke(); }
      x.setLineDash([]);
      x.fillStyle = '#ffffff'; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; x.beginPath(); x.arc(c + Math.cos(a) * c * 0.53, c + Math.sin(a) * c * 0.53, 3.2, 0, 7); x.fill(); }
      x.strokeStyle = '#ffffff'; x.lineWidth = 4; x.lineCap = 'round';
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, px = c + Math.cos(a) * c * 0.675, py = c + Math.sin(a) * c * 0.675;
        for (let k = 0; k < 6; k++) { const b = k * Math.PI / 3 + a, ex = Math.cos(b), ey = Math.sin(b); x.beginPath(); x.moveTo(px, py); x.lineTo(px + ex * 17, py + ey * 17);
          for (const d of [-1, 1]) { const f = b + d * 0.7; x.moveTo(px + ex * 10, py + ey * 10); x.lineTo(px + ex * 10 + Math.cos(f) * 6, py + ey * 10 + Math.sin(f) * 6); } x.stroke(); } }
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5; x.save(); x.translate(c + Math.cos(a) * c * 0.3, c + Math.sin(a) * c * 0.3); x.rotate(a + Math.PI / 2);
        x.fillStyle = '#8a5a44'; x.fillRect(-4, 14, 8, 9); x.fillStyle = '#3f9a5c';
        for (const [w, y0, y1] of [[22, 16, -2], [17, 6, -12], [12, -4, -22]]) { x.beginPath(); x.moveTo(-w, y0); x.lineTo(w, y0); x.lineTo(0, y1); x.closePath(); x.fill(); }
        x.fillStyle = '#ffd34d'; x.beginPath(); x.arc(0, -23, 4, 0, 7); x.fill();
        x.fillStyle = '#ff5c6c'; for (const [bx, by] of [[-8, 9], [7, 2], [-3, -6]]) { x.beginPath(); x.arc(bx, by, 2.5, 0, 7); x.fill(); } x.restore(); }
      x.fillStyle = '#ffd34d'; x.beginPath(); for (let k = 0; k <= 10; k++) { const rr = k % 2 ? c * 0.06 : c * 0.14, a = k / 10 * Math.PI * 2 - Math.PI / 2; x.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); } x.fill();
    }, 512);
    g.add(det(cil(1.1, 1.12, 0.035, 56), [tela(0xe5484d), conTex('tap-navidad', tex, { roughness: 0.95, clearcoat: 0 }), tela(0xe5484d)], { pos: [0, 0.018, 0] }));
    g.add(det(new THREE.TorusGeometry(1.11, 0.055, 10, 72), tela(0xffffff), { pos: [0, 0.035, 0], rot: [Math.PI / 2, 0, 0], esc: [1, 1, 0.8] }));
    g.add(muchos(esf(0.065, 14), tela(0xffffff), Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + 0.2; return { pos: [Math.cos(a) * 1.11, 0.085, Math.sin(a) * 1.11], color: i % 2 ? 0x4fb06d : 0xe5484d }; })));
    return g; },
  // tapete DE (gratis para todos): tejido blanco con el logo de Web Dev-Eyes al centro, orilla de peluche azul marino y cordón dorado
  mn: () => { const g = g0(), n = 1024;
    const dibujar = (x) => {
      const c = n / 2, anillo = (r, col) => { x.fillStyle = col; x.beginPath(); x.arc(c, c, c * r, 0, 7); x.fill(); };
      anillo(1, '#06205c'); anillo(0.9, '#e1211c'); anillo(0.865, '#ffffff'); anillo(0.84, '#f4f6fb');
      x.strokeStyle = '#ffc21a'; x.lineWidth = 7; x.setLineDash([22, 16]); x.lineCap = 'round';   // puntada dorada en la orilla azul
      x.beginPath(); x.arc(c, c, c * 0.952, 0, 7); x.stroke();
      x.strokeStyle = 'rgba(6,32,92,.16)'; x.lineWidth = 4; x.setLineDash([12, 12]);                 // puntadas del tejido
      for (const k of [0.8, 0.7]) { x.beginPath(); x.arc(c, c, c * k, 0, 7); x.stroke(); }
      x.setLineDash([]);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, px = c + Math.cos(a) * c * 0.75, py = c + Math.sin(a) * c * 0.75;   // estrellitas roja / azul / oro
        x.fillStyle = ['#e1211c', '#06205c', '#ffc21a'][i % 3]; x.beginPath();
        for (let k = 0; k <= 10; k++) { const rr = k % 2 ? 11 : 26, b = k / 10 * Math.PI * 2 - Math.PI / 2 + a; x.lineTo(px + Math.cos(b) * rr, py + Math.sin(b) * rr); } x.fill(); }
      if (logoMnListo()) { const L = c * 1.3; x.drawImage(LOGO_MN, c - L / 2, c - L / 2, L, L); }
    };
    const nueva = !cacheTexCuarto.has('tap-mn'), tex = texCuarto('tap-mn', dibujar, n);
    if (nueva && LOGO_MN && !logoMnListo()) LOGO_MN.addEventListener('load', () => {   // llegó el logo: se vuelve a tejer y se rehacen las miniaturas
      const x = tex.image.getContext('2d'); x.clearRect(0, 0, n, n); dibujar(x); tex.needsUpdate = true;
      for (const k of [...fotos.keys()]) if (k.startsWith('o|tapete|mn|')) fotos.delete(k);
    }, { once: true });
    if (!logoMnListo()) g.userData.sinFoto = true;   // miniatura sin logo: no se guarda en el teléfono
    const azul = tela(0x06205c);
    g.add(det(cil(1.1, 1.12, 0.04, 64), [azul, conTex('tap-mn', tex, { roughness: 0.95, clearcoat: 0 }), azul], { pos: [0, 0.02, 0], rot: [0, Math.PI / 2, 0] }));
    g.add(det(new THREE.TorusGeometry(1.11, 0.05, 10, 80), azul, { pos: [0, 0.035, 0], rot: [Math.PI / 2, 0, 0], esc: [1, 1, 0.8] }));
    const cordon = det(new THREE.TorusGeometry(1.0, 0.012, 6, 96), tela(0xffc21a), { pos: [0, 0.042, 0], rot: [Math.PI / 2, 0, 0] }); g.add(cordon);
    g.userData.piezas = { cordon };
    return g; },
});
export const PAREDES = { crema: 0xfff4e6, menta: 0xd6f5e8, lavanda: 0xe9ddff, rosa: 0xffe1ee, cielo: 0xdcefff, durazno: 0xffe0cc, estrellas: 0x34306b, ladrillo: 0xe8a587 };
export const PISOS = { madera: 0xe9b98a, nogal: 0xb07a55, menta: 0xbfeedc, ajedrez: 0xffffff, nube: 0xf4f1ff, pasto: 0xa6dc84 };

/* ---------- papel tapiz (mosaico de 1x1 m), lambrin y pisos (mosaico de 2x2 m) */
const rectR = (x, a, b, w, h, r) => { if (x.roundRect) x.roundRect(a, b, w, h, r); else x.rect(a, b, w, h); };
const PAPEL = {
  rayas: (fondo, raya) => (x, n) => { x.fillStyle = fondo; x.fillRect(0, 0, n, n); x.fillStyle = raya; for (let i = 0; i < 4; i++) x.fillRect(i * n / 4, 0, n / 10, n); },
  lunares: (fondo, punto) => (x, n) => { x.fillStyle = fondo; x.fillRect(0, 0, n, n); x.fillStyle = punto;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc((i + (j % 2) * 0.5) * n / 4, (j + 0.5) * n / 4, n * 0.022, 0, 7); x.fill(); if (j % 2 && i === 3) { x.beginPath(); x.arc(0, (j + 0.5) * n / 4, n * 0.022, 0, 7); x.fill(); } } },
  flores: (fondo, flor) => (x, n) => { x.fillStyle = fondo; x.fillRect(0, 0, n, n);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const cx = (i + (j % 2) * 0.5) * n / 3, cy = (j + 0.5) * n / 3;
      envolver(n, cx, cy, (px, py) => { x.fillStyle = flor; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; x.beginPath(); x.arc(px + Math.cos(a) * 9, py + Math.sin(a) * 9, 6.5, 0, 7); x.fill(); } x.fillStyle = '#fff6c9'; x.beginPath(); x.arc(px, py, 4.5, 0, 7); x.fill(); }); } },
  corazones: (fondo, cor) => (x, n) => { x.fillStyle = fondo; x.fillRect(0, 0, n, n); x.fillStyle = cor;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const cx = (i + (j % 2) * 0.5) * n / 4, cy = (j + 0.5) * n / 4;
      envolver(n, cx, cy, (px, py) => { x.beginPath(); x.moveTo(px, py + 8); x.bezierCurveTo(px + 13, py - 2, px + 6, py - 12, px, py - 4); x.bezierCurveTo(px - 6, py - 12, px - 13, py - 2, px, py + 8); x.fill(); }); } },
  nubes: (fondo) => (x, n) => { x.fillStyle = fondo; x.fillRect(0, 0, n, n); x.fillStyle = 'rgba(255,255,255,.8)';
    for (const [cx, cy] of [[0.25, 0.3], [0.75, 0.78]]) envolver(n, cx * n, cy * n, (px, py) => { for (const [dx, dy, r] of [[-20, 4, 15], [0, -6, 21], [20, 4, 14]]) { x.beginPath(); x.arc(px + dx, py + dy, r, 0, 7); x.fill(); } x.fillRect(px - 34, py + 4, 68, 14); }); },
  estrellas: (x, n) => { const g = x.createLinearGradient(0, 0, 0, n); g.addColorStop(0, '#2f2a66'); g.addColorStop(1, '#3a3478'); x.fillStyle = g; x.fillRect(0, 0, n, n); const r = azarCon(11);
    for (let i = 0; i < 26; i++) { const px = r() * n, py = r() * n, s = 1 + r() * 2.2; x.fillStyle = i % 3 ? '#fff3b0' : '#ffffff'; x.beginPath(); x.arc(px, py, s, 0, 7); x.fill(); }
    x.fillStyle = '#ffe27a'; for (const [cx, cy] of [[0.3, 0.3], [0.78, 0.72]]) envolver(n, cx * n, cy * n, (px, py) => { x.beginPath(); for (let k = 0; k <= 10; k++) { const rr = k % 2 ? 4 : 10, a = k / 10 * Math.PI * 2 - Math.PI / 2; x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } x.fill(); }); },
  ladrillo: (x, n) => { x.fillStyle = '#fbe9dc'; x.fillRect(0, 0, n, n); const filas = 8, h = n / filas, w = n / 4, r = azarCon(5), base = new THREE.Color(0xe8a587);
    for (let f = 0; f < filas; f++) for (let k = -1; k < 5; k++) { const c = base.clone().offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.08);
      x.fillStyle = hex(c); const bx = k * w + (f % 2) * w / 2; x.beginPath(); rectR(x, bx + 3, f * h + 3, w - 6, h - 6, 5); x.fill(); } },
};
const TEMAS_PARED = {
  crema: { papel: PAPEL.rayas('#fff4e6', 'rgba(246,214,180,.45)'), lam: 0xf6cdb2, cort: 0xffab96 },
  menta: { papel: PAPEL.lunares('#d6f5e8', 'rgba(255,255,255,.9)'), lam: 0xa6e0c8, cort: 0xfff0b8 },
  lavanda: { papel: PAPEL.flores('#e9ddff', '#ddccff'), lam: 0xcbb6f5, cort: 0xffc2dc },
  rosa: { papel: PAPEL.corazones('#ffe1ee', '#ffcade'), lam: 0xffbcd4, cort: 0xffffff },
  cielo: { papel: PAPEL.nubes('#cbe6ff'), lam: 0xa6cff7, cort: 0xffe08a },
  durazno: { papel: PAPEL.lunares('#ffe0cc', 'rgba(255,168,128,.4)'), lam: 0xffc09e, cort: 0xa6e0c8 },
  estrellas: { papel: PAPEL.estrellas, lam: 0x27235a, cort: 0x9a8fe6, noche: true },
  ladrillo: { papel: PAPEL.ladrillo, lam: 0xc58c69, cort: 0xfff1dc },
};
// papel tapiz de temporada: noche de brujas (octubre) e invierno nevado (diciembre)
PAPEL.halloween = (x, n) => { const g = x.createLinearGradient(0, 0, 0, n); g.addColorStop(0, '#4a2c6e'); g.addColorStop(1, '#55337c'); x.fillStyle = g; x.fillRect(0, 0, n, n); const r = azarCon(13);
  for (let i = 0; i < 14; i++) { x.fillStyle = i % 3 ? 'rgba(255,240,190,.7)' : '#ffffff'; x.beginPath(); x.arc(r() * n, r() * n, 1 + r() * 1.6, 0, 7); x.fill(); }
  x.fillStyle = '#ffe27a';
  for (const [cx, cy] of [[0.2, 0.22], [0.72, 0.72]]) envolver(n, cx * n, cy * n, (px, py) => { x.save(); x.translate(px, py); x.scale(1.9, 1.9); x.beginPath(); x.arc(0, 0, 13, Math.PI * 0.35, Math.PI * 1.65, false); x.arc(6.2, 0, 11.6, -1.597, 1.597, true); x.fill(); x.restore(); });
  const murci = (px, py, s) => { x.save(); x.translate(px, py); x.scale(s * 2, s * 2); x.fillStyle = '#2a1846';
    x.beginPath(); x.arc(0, 0, 7, 0, 7); x.fill();
    x.beginPath(); x.moveTo(-5, -4); x.lineTo(-6, -11); x.lineTo(-1, -6); x.closePath(); x.moveTo(5, -4); x.lineTo(6, -11); x.lineTo(1, -6); x.closePath(); x.fill();
    for (const d of [-1, 1]) { x.beginPath(); x.moveTo(d * 5, -3); x.quadraticCurveTo(d * 14, -11, d * 24, -5); x.quadraticCurveTo(d * 21, 0, d * 20, 3); x.quadraticCurveTo(d * 16, 0, d * 13, 4); x.quadraticCurveTo(d * 10, 1, d * 5, 4); x.closePath(); x.fill(); }
    x.fillStyle = '#ffe27a'; for (const d of [-1, 1]) { x.beginPath(); x.arc(d * 2.6, -1, 1.7, 0, 7); x.fill(); }
    x.restore(); };
  for (const [cx, cy, s] of [[0.66, 0.24, 1.0], [0.22, 0.7, 0.85]]) envolver(n, cx * n, cy * n, (px, py) => murci(px, py, s));
  envolver(n, n * 0.46, n * 0.48, (px, py) => { x.save(); x.translate(px, py); x.scale(2.4, 2.4); x.fillStyle = '#ff9a3c'; for (const dx of [-5, 0, 5]) { x.beginPath(); x.ellipse(dx, 0, 6, 7, 0, 0, 7); x.fill(); }
    x.fillStyle = '#7cc46a'; x.fillRect(-1.5, -11, 3, 5); x.fillStyle = '#ffe27a'; for (const d of [-1, 1]) { x.beginPath(); x.moveTo(d * 4 - 2, -1); x.lineTo(d * 4 + 2, -1); x.lineTo(d * 4, -4); x.fill(); }
    x.beginPath(); x.arc(0, 1.5, 3.5, 0.2, Math.PI - 0.2); x.fill(); x.restore(); });
};
PAPEL.nevado = (x, n) => { const gr = x.createLinearGradient(0, 0, 0, n); gr.addColorStop(0, '#c4def6'); gr.addColorStop(1, '#d4e8f9'); x.fillStyle = gr; x.fillRect(0, 0, n, n); const r = azarCon(17);
  for (let i = 0; i < 22; i++) { x.fillStyle = '#ffffff'; x.beginPath(); x.arc(r() * n, r() * n, 1.4 + r() * 2, 0, 7); x.fill(); }
  x.strokeStyle = '#ffffff'; x.lineCap = 'round';
  const copo = (px, py, s) => { s *= 1.5; x.lineWidth = Math.max(2.4, s * 0.2); x.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, ex = Math.cos(a), ey = Math.sin(a); x.moveTo(px, py); x.lineTo(px + ex * s, py + ey * s);
      for (const d of [-1, 1]) { const f = a + d * 0.75; x.moveTo(px + ex * s * 0.6, py + ey * s * 0.6); x.lineTo(px + ex * s * 0.6 + Math.cos(f) * s * 0.32, py + ey * s * 0.6 + Math.sin(f) * s * 0.32); } }
    x.stroke(); };
  for (const [cx, cy, s] of [[0.25, 0.25, 18], [0.75, 0.7, 20], [0.72, 0.18, 10], [0.2, 0.78, 11]]) envolver(n, cx * n, cy * n, (px, py) => copo(px, py, s));
};
Object.assign(PAREDES, { halloween: 0x4a2c6e, nevado: 0xcfe4f7 });
Object.assign(TEMAS_PARED, { halloween: { papel: PAPEL.halloween, lam: 0xc9692f, cort: 0xffa04a, noche: true }, nevado: { papel: PAPEL.nevado, lam: 0xe06a66, cort: 0x5fb87a } });
// lambrin de duela vertical
const lambrin = (c) => (x, n) => { x.fillStyle = hex(c); x.fillRect(0, 0, n, n);
  for (let i = 0; i < 5; i++) { x.fillStyle = 'rgba(80,40,60,.13)'; x.fillRect(i * n / 5, 0, 3, n); x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(i * n / 5 + 3, 0, 3, n); } };
// duela de madera: tablas con tono variado, juntas escalonadas y vetas
const duela = (base, seed) => (x, n) => {
  const r = azarCon(seed), filas = 8, h = n / filas, c0 = new THREE.Color(base), junta = hex(oscurecer(base, 0.32));
  for (let f = 0; f < filas; f++) {
    const cortes = [(f * 0.37 % 1) * n];
    cortes.forEach((c, i) => { const fin = i + 1 < cortes.length ? cortes[i + 1] : cortes[0] + n, col = c0.clone().offsetHSL((r() - 0.5) * 0.015, (r() - 0.5) * 0.05, (r() - 0.5) * 0.05);
      for (const dx of [0, -n]) { x.fillStyle = hex(col); x.fillRect(c + dx, f * h, fin - c, h);
        x.strokeStyle = 'rgba(110,60,30,.12)'; x.lineWidth = 1.5;
        for (let v = 0; v < 3; v++) { const yy = f * h + h * (0.25 + v * 0.25); x.beginPath(); x.moveTo(c + dx, yy); for (let s = 0; s <= 8; s++) x.lineTo(c + dx + (fin - c) * s / 8, yy + Math.sin(s * 1.3 + v + f) * 2); x.stroke(); }
        x.fillStyle = junta; x.fillRect(c + dx, f * h, 2, h); } });
    x.fillStyle = junta; x.fillRect(0, f * h, n, 2); x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(0, f * h + 2, n, 2);
  }
};
const PISO_DIBUJO = {
  madera: duela(0xe9b98a, 3), nogal: duela(0xa8714c, 9),
  menta: (x, n) => { const r = azarCon(4), k = 4, l = n / k; x.fillStyle = '#ffffff'; x.fillRect(0, 0, n, n);
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { x.fillStyle = hex(new THREE.Color(0xbfeedc).offsetHSL(0, 0, (r() - 0.5) * 0.06)); x.beginPath(); rectR(x, i * l + 3, j * l + 3, l - 6, l - 6, 8); x.fill();
      x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(i * l + 10, j * l + 10, l * 0.3, 4); } },
  ajedrez: (x, n) => { const k = 4, l = n / k; x.fillStyle = '#f3e3ec'; x.fillRect(0, 0, n, n);
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { x.fillStyle = (i + j) % 2 ? '#ffc9de' : '#fffafc'; x.fillRect(i * l + 2, j * l + 2, l - 4, l - 4); x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(i * l + 8, j * l + 8, l * 0.35, 3); } },
  nube: (x, n) => { x.fillStyle = '#e6deff'; x.fillRect(0, 0, n, n); const r = azarCon(8);
    for (let i = 0; i < 9; i++) { const cx = r() * n, cy = r() * n, s = 0.7 + r() * 0.6;   // nubes esponjadas
      envolver(n, cx, cy, (px, py) => { x.fillStyle = 'rgba(200,185,250,.6)'; for (const [dx, dy, rr] of [[-34, 6, 26], [0, -6, 36], [34, 6, 24]]) { x.beginPath(); x.arc(px + dx * s, py + dy * s + 5, rr * s, 0, 7); x.fill(); }
        x.fillStyle = '#ffffff'; for (const [dx, dy, rr] of [[-34, 6, 26], [0, -6, 36], [34, 6, 24]]) { x.beginPath(); x.arc(px + dx * s, py + dy * s, rr * s, 0, 7); x.fill(); } x.fillRect(px - 34 * s, py + 6 * s, 68 * s, 24 * s); }); }
    for (let i = 0; i < 1500; i++) { x.fillStyle = i % 2 ? 'rgba(180,160,230,.12)' : 'rgba(255,255,255,.5)'; x.fillRect(r() * n, r() * n, 2, 2); } },
  pasto: (x, n) => { x.fillStyle = '#9fd67c'; x.fillRect(0, 0, n, n); const r = azarCon(6), verdes = ['#8bc96a', '#b4e48e', '#7dbd5f', '#a9de86'];
    for (let i = 0; i < 1400; i++) { const px = r() * n, py = r() * n, l = 5 + r() * 7; x.strokeStyle = verdes[i % 4]; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 4, py - l); x.stroke(); }
    for (let i = 0; i < 16; i++) { const cx = r() * n, cy = r() * n, col = ['#ffffff', '#ffe27a', '#ffb3d1'][i % 3];
      envolver(n, cx, cy, (px, py) => { x.fillStyle = col; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; x.beginPath(); x.arc(px + Math.cos(a) * 4, py + Math.sin(a) * 4, 3, 0, 7); x.fill(); } x.fillStyle = '#ffb347'; x.beginPath(); x.arc(px, py, 2, 0, 7); x.fill(); }); } },
};
// vista por la ventana (de dia o de noche)
const VISTA = {
  dia: (x, n) => { const g = x.createLinearGradient(0, 0, 0, n); g.addColorStop(0, '#86ccff'); g.addColorStop(0.75, '#d8f0ff'); g.addColorStop(1, '#fff0dc'); x.fillStyle = g; x.fillRect(0, 0, n, n);
    x.fillStyle = '#fff'; for (const [cx, cy, s] of [[0.25, 0.25, 1], [0.72, 0.4, 0.8]]) for (const [dx, dy, r] of [[-22, 4, 16], [0, -6, 24], [22, 4, 15]]) { x.beginPath(); x.arc(n * cx + dx * s, n * cy + dy * s, r * s, 0, 7); x.fill(); }
    const colina = (y0, amp, f, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, n); for (let i = 0; i <= 24; i++) x.lineTo(i / 24 * n, n * y0 - Math.sin(i / 24 * Math.PI * f + y0 * 7) * amp); x.lineTo(n, n); x.fill(); };
    colina(0.78, 14, 2, '#bfe8a8'); colina(0.88, 10, 3, '#94d47c');
    x.fillStyle = '#7cc46a'; x.beginPath(); x.arc(n * 0.8, n * 0.7, 16, 0, 7); x.fill(); x.fillStyle = '#a0603c'; x.fillRect(n * 0.8 - 3, n * 0.7 + 10, 6, 16); },
  noche: (x, n) => { const g = x.createLinearGradient(0, 0, 0, n); g.addColorStop(0, '#1b1846'); g.addColorStop(1, '#5a4aa8'); x.fillStyle = g; x.fillRect(0, 0, n, n); const r = azarCon(2);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,248,200,${0.5 + r() * 0.5})`; x.beginPath(); x.arc(r() * n, r() * n * 0.75, 0.8 + r() * 1.6, 0, 7); x.fill(); }
    x.fillStyle = '#fff3b0'; x.beginPath(); x.arc(n * 0.72, n * 0.28, 22, 0, 7); x.fill(); x.fillStyle = '#26205a'; x.beginPath(); x.arc(n * 0.72 + 10, n * 0.28 - 6, 19, 0, 7); x.fill();
    x.fillStyle = '#2d2766'; x.beginPath(); x.moveTo(0, n); for (let i = 0; i <= 24; i++) x.lineTo(i / 24 * n, n * 0.85 - Math.sin(i / 24 * Math.PI * 2) * 12); x.lineTo(n, n); x.fill();
    x.fillStyle = '#ffe27a'; for (const [cx, cy] of [[0.2, 0.9], [0.32, 0.88], [0.6, 0.92]]) x.fillRect(n * cx, n * cy, 5, 6); },
};
// mancha de luz de la ventana en el piso
const TEX_MANCHA = texCuarto('mancha-ventana', (x, n) => { x.filter = 'blur(10px)'; x.fillStyle = '#fff';
  for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) x.fillRect(n * 0.12 + i * n * 0.39, n * 0.12 + j * n * 0.39, n * 0.36, n * 0.36); }, 128);

// juego.js es un script clásico: su `const Juego` vive en el ámbito global compartido (no cuelga de window), y un módulo lo ve por nombre
const juego = () => (typeof Juego !== 'undefined' ? Juego : window.Juego);
const Juego3D = { pop() { try { juego()?.Sonido?.pop?.(); juego()?.vibrar?.(12); } catch { /* sin sonido */ } },
  cuarto(ev, k) { try { juego()?.Sonido?.cuarto?.(ev, k); } catch { /* sin sonido */ } } };   // la mascota con sus muebles (juego.js: EFECTOS_CUARTO)

/* ============================================================ escena comun */
function prepararRenderer(contenedor, preserve = false) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: preserve });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.18;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  if (contenedor) { contenedor.innerHTML = ''; contenedor.appendChild(r.domElement); r.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:manipulation'; }
  return r;
}
function luces(escena, sombras = true) {
  escena.add(new THREE.HemisphereLight(0xfffaf2, 0xf0c8b8, 1.5));
  const clave = new THREE.DirectionalLight(0xfff1e0, 1.6); clave.position.set(-3, 6, 5);
  if (sombras) { clave.castShadow = true; clave.shadow.mapSize.set(1024, 1024); clave.shadow.radius = 5; Object.assign(clave.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); clave.shadow.bias = -0.0006; clave.shadow.normalBias = 0.02; }
  escena.add(clave);
  const contra = new THREE.DirectionalLight(0xd8e8ff, 1.2); contra.position.set(3, 3, -5); escena.add(contra);
  const relleno = new THREE.DirectionalLight(0xffffff, 0.45); relleno.position.set(4, 1, 4); escena.add(relleno);
}
function sombraSuave(r = 0.95) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.2, r * 2.2), new THREE.MeshBasicMaterial({ map: TEX_SOMBRA, transparent: true, depthWrite: false, opacity: 0.6 }));
  m.rotation.x = -Math.PI / 2; return m;
}

/* ============================================================ animacion de la mascota */
function animador(m) {
  const e = { salto: 0, giro: 0, comer: 0, saludo: 0, parp: 2 + Math.random() * 3, cierre: 0, mirada: new THREE.Vector2(), obj: new THREE.Vector2() };
  return {
    mascota: m,
    e,
    paso(dt, t, sombra, comida) {
      const resp = Math.sin(t * 2.4) * 0.03;
      let sy = 1 + resp, sxz = 1 - resp * 0.6, y = 0;
      const y0 = m.raiz.userData.y0 || 0;
      if (e.salto > 0) {
        e.salto = Math.max(0, e.salto - dt * 1.7); const k = 1 - e.salto;
        y = Math.sin(k * Math.PI) * 0.7;
        const sq = k < 0.12 ? -0.2 * (k / 0.12) : k > 0.88 ? -0.2 * ((1 - k) / 0.12) : 0.12 * Math.sin(k * Math.PI);
        sy += sq; sxz -= sq * 0.7; m.raiz.rotation.y = e.giro * k * Math.PI * 2;
      } else m.raiz.rotation.y = Math.sin(t * 0.6) * 0.18;
      m.raiz.position.y = y0 + y + Math.sin(t * 1.6) * 0.02;
      m.cuerpo.scale.set(sxz, sy, sxz);
      if (sombra) { sombra.scale.setScalar(1 - y * 0.4); sombra.material.opacity = 0.6 - y * 0.35; }
      e.parp -= dt; if (e.parp <= 0) { e.cierre = 0.13; e.parp = 2.2 + Math.random() * 3.5; }
      if (e.cierre > 0) e.cierre -= dt;
      const cerrando = e.cierre > 0 && m.estiloOjos === 'normal';
      if (m.ojos.userData.parpadeoIndividual) {
        // Un guiño ya es un ojo cerrado: conservar su arco durante el parpadeo.
        m.ojos.scale.y = 1;
        for (const o of m.ojos.children) if (o.userData.parpadea) {
          o.scale.y = o.userData.escalaYAbierto * (cerrando ? 0.12 : 1);
        }
      } else m.ojos.scale.y = cerrando ? 0.12 : 1;
      e.mirada.lerp(e.obj, 0.07);
      m.cuerpo.rotation.x = -e.mirada.y * 0.06; m.cuerpo.rotation.z = -e.mirada.x * 0.04; m.ojos.position.x = e.mirada.x * 0.03;
      if (m.ud.cab) { m.ud.cab.rotation.z = Math.sin(t * 1.3) * 0.05 - e.mirada.x * 0.08; m.ud.cab.rotation.x = -e.mirada.y * 0.12; }
      e.saludo = Math.max(0, e.saludo - dt);
      m.brazos[0].rotation.z = Math.sin(t * 2.2) * 0.1;
      m.brazos[1].rotation.z = e.saludo > 0 ? (m.ud.saludoAngulo ?? 2.1) + Math.sin(t * 16) * (m.ud.saludoAngulo != null ? 0.08 : 0.45) : -Math.sin(t * 2.2) * 0.1;
      animarAlasModelo(m);
      const ud = m.ud;
      if (ud.alaI) { const a = 0.12 + Math.sin(t * 6) * 0.06; ud.alaI.rotation.z = -a; ud.alaD.rotation.z = a; ud.alaI.rotation.y = -0.2 - Math.sin(t * 6) * 0.12; ud.alaD.rotation.y = 0.2 + Math.sin(t * 6) * 0.12; }
      if (ud.fuegoI) { const f = 1 + Math.sin(t * 30) * 0.2; ud.fuegoI.scale.y = f; ud.fuegoD.scale.y = f; }
      if (ud.orejaI) { ud.orejaI.rotation.z = 0.2 + Math.sin(t * 1.7) * 0.06; ud.orejaD.rotation.z = -0.2 - Math.sin(t * 1.7 + 1) * 0.06; }
      if (m.foco) m.foco.material.color.setHSL(0.15, 1, 0.6 + Math.sin(t * 5) * 0.12);
      if (m.raiz.userData.chispas) m.raiz.userData.chispas.rotation.y = t * 0.5;
      if (e.comer > 0 && comida) {
        e.comer = Math.max(0, e.comer - dt); const k = 1 - e.comer / 1.8, g = comida.children[0];
        if (g) {
          if (k < 0.35) { const by = m.ud.bocaY ?? 0.05, bz = (m.ud.bocaZ ?? 1) + 0.12; m.raiz.localToWorld(g.position.set(0, by + 1.8 - (k / 0.35) * 1.8, bz)); g.scale.setScalar(m.raiz.scale.x); g.rotation.z += dt * 8; g.visible = true; }
          else g.visible = false;
        }
        const abierta = k > 0.15 && (!(k > 0.3 && k < 0.95) || Math.sin(t * 22) > 0);
        if (m.mandibula) { m.mandibula.userData.y0 ??= m.mandibula.position.y; m.mandibula.position.y = m.mandibula.userData.y0 - (abierta ? 0.07 : 0); }
        if (m.bocaAbierta) { m.bocaAbierta.visible = abierta; if (m.boca) m.boca.visible = !abierta; }
        if (e.comer === 0) { comida.clear(); if (m.mandibula?.userData.y0 !== undefined) m.mandibula.position.y = m.mandibula.userData.y0; if (m.bocaAbierta) { m.bocaAbierta.visible = false; if (m.boca) m.boca.visible = true; } }
      }
    },
  };
}
function crearComida(tipo) {
  const g = g0();
  if (tipo === 'pastel') { g.add(malla(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 24), clay(0xffd6ec))); g.add(malla(new THREE.CylinderGeometry(0.23, 0.23, 0.05, 24), clay(0xffffff), { pos: [0, 0.11, 0] })); g.add(malla(esf(0.06, 12), brillo(0xff4d5e), { pos: [0, 0.18, 0] })); }
  else if (tipo === 'fruta') { g.add(malla(esf(0.18, 20), clay(0xff6b6b))); g.add(malla(esf(0.07, 10), clay(0x7cc46a), { pos: [0.07, 0.2, 0], esc: [1.4, 0.5, 0.8] })); }
  else { g.add(malla(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 24), clay(0xe0a868), { rot: [Math.PI / 2, 0, 0] }));
    for (let i = 0; i < 5; i++) g.add(malla(esf(0.032, 8), clay(0x6b3e1e), { pos: [Math.cos(i * 1.3) * 0.12, Math.sin(i * 1.3) * 0.12, 0.05] })); }
  return g;
}

function crearPelota3D() {
  const tex = texFija('pelota-playa', (x, n) => {
    const colores = ['#ff665d', '#ffd45f', '#62b6fa', '#78d6ad'];
    for (let i = 0; i < 8; i++) { x.fillStyle = colores[i % 4]; x.fillRect(i * n / 8, 0, n / 8, n); }
    x.strokeStyle = '#fff8e9'; x.lineWidth = 2;
    for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * n / 8, 0); x.lineTo(i * n / 8, n); x.stroke(); }
    x.fillStyle = '#fff8e9'; x.fillRect(0, 0, n, 9); x.fillRect(0, n - 9, n, 9);
  }, 256);
  const bola = malla(new THREE.SphereGeometry(0.20, 32, 24), clay(0xffffff, { map: tex, roughness: 0.48, clearcoat: 0.35 }));
  bola.name = 'pelota3D'; bola.receiveShadow = true; return bola;
}

// Trayectoria 3D controlada: lanzamiento, recepción por la mascota y devolución al jugador.
function juegoPelota3D(c) {
  let bola = null, sombra = null, fase = null, tiempo = 0, atrapadas = 0, callbacks = {};
  const salida = new THREE.Vector3(), desde = new THREE.Vector3(), hacia = new THREE.Vector3();
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let suelo = 0;
  const destino = () => {
    const m = c.getAnim().mascota; m.raiz.updateWorldMatrix(true, false);
    return m.raiz.localToWorld(new THREE.Vector3(0, 0.10, 0.82));
  };
  const limpiar = () => {
    c.getAnim().e.jugando = false;
    if (bola) { c.escena.remove(bola); liberar(bola); }
    if (sombra) { c.escena.remove(sombra); sombra.geometry.dispose(); sombra.material.dispose(); }
    bola = sombra = null; fase = null; callbacks = {};
    c.renderer.domElement.removeAttribute('aria-label');
  };
  const lanzar = () => {
    if (fase !== 'lista') return false;
    desde.copy(bola.position); hacia.copy(destino()); fase = 'lanzamiento'; tiempo = 0;
    callbacks.alLanzar?.(atrapadas + 1); return true;
  };
  return {
    iniciar(op = {}) {
      if (fase) return false;
      callbacks = op; atrapadas = 0; tiempo = 0;
      const m = c.getAnim().mascota; c.getAnim().e.jugando = true;
      m.raiz.updateWorldMatrix(true, true);
      const centro = m.raiz.getWorldPosition(new THREE.Vector3());
      suelo = c.cuarto ? 0.045 : new THREE.Box3().setFromObject(m.raiz).min.y;
      const frente = c.camara.position.clone().sub(centro); frente.y = 0; frente.normalize();
      const lado = new THREE.Vector3(frente.z, 0, -frente.x);
      salida.copy(centro).addScaledVector(frente, c.cuarto ? 1.1 : 1.4).addScaledVector(lado, 0.65); salida.y = suelo + 0.20;
      bola = crearPelota3D(); bola.position.copy(salida); c.escena.add(bola);
      sombra = sombraSuave(0.22); sombra.name = 'sombraPelota'; sombra.position.set(salida.x, suelo + 0.008, salida.z); c.escena.add(sombra);
      fase = 'lista'; c.renderer.domElement.tabIndex = 0;
      c.renderer.domElement.setAttribute('aria-label', 'Pelota 3D: tócala o presiona espacio para lanzarla a tu mascota');
      c.renderer.domElement.focus({ preventScroll: true });
      return true;
    },
    lanzar,
    capturar(ev) {
      if (!bola) return false;
      const rect = c.renderer.domElement.getBoundingClientRect(); mouse.set((ev.clientX - rect.left) / rect.width * 2 - 1, -(ev.clientY - rect.top) / rect.height * 2 + 1);
      c.camara.updateMatrixWorld(); ray.setFromCamera(mouse, c.camara); bola.updateMatrixWorld(true);
      if (!ray.intersectObject(bola, false).length && !(ray.ray.distanceToPoint(bola.position) < 0.29 && ray.ray.direction.dot(bola.position.clone().sub(ray.ray.origin)) > 0)) return false;
      lanzar(); return true;
    },
    paso(dt, t) {
      if (!bola) return;
      tiempo += dt;
      if (fase === 'lista') { bola.rotation.y += dt * 0.25; }
      else if (fase === 'lanzamiento' || fase === 'devolucion') {
        const k = Math.min(1, tiempo / 0.85);
        if (fase === 'lanzamiento') hacia.copy(destino());
        bola.position.lerpVectors(desde, hacia, k); bola.position.y += Math.sin(Math.PI * k) * (c.cuarto ? 0.65 : 0.9);
        bola.rotation.x += dt * 7; bola.rotation.z += dt * 2;
        if (k === 1) {
          tiempo = 0;
          if (fase === 'lanzamiento') {
            fase = 'recepcion'; atrapadas++; const e = c.getAnim().e; e.salto = 1; e.giro = 0; e.saludo = 0.6;
            callbacks.alAtrapar?.(atrapadas);
          } else { fase = 'lista'; bola.position.copy(salida); }
        }
      } else if (fase === 'recepcion') {
        bola.position.copy(destino());
        if (tiempo >= 0.6) {
          if (atrapadas >= 5) { const terminar = callbacks.alTerminar; limpiar(); terminar?.(atrapadas); return; }
          desde.copy(bola.position); hacia.copy(salida); fase = 'devolucion'; tiempo = 0;
        }
      }
      const altura = Math.max(0, bola.position.y - suelo - 0.20);
      sombra.position.set(bola.position.x, suelo + 0.008, bola.position.z); sombra.scale.setScalar(1 + altura * 0.4); sombra.material.opacity = 0.6 / (1 + altura * 1.8);
    },
    cancelar: limpiar,
    activa: () => !!fase,
  };
}

/* ============================================================ montar: mascota sola */
function montar(contenedor, opciones = {}) {
  let op = { especie: 'obra', etapa: 1, color: '', ojos: 'normal', equipo: {}, interactivo: true, ...opciones };
  const renderer = prepararRenderer(contenedor);
  const escena = new THREE.Scene(); luces(escena, false);
  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 50); camara.position.set(0, 0.7, 7.4); camara.lookAt(0, 0.3, 0);
  const sombra = sombraSuave(); sombra.position.y = -1.08; escena.add(sombra);
  const giro = new THREE.Group(); escena.add(giro);   // arrastrar a los lados gira a la mascota para ver su ropa
  usoRespaldo = false;
  let m = armar(op); giro.add(m.raiz);
  // la camara se aleja lo necesario para que quepa todo (orejas, sombreros, alas), con espacio para el salto
  const encuadrarMascota = () => {
    m.raiz.updateMatrixWorld(true);
    const caja = new THREE.Box3(); m.raiz.traverse((o) => { if (o.isMesh) caja.expandByObject(o); });
    const c = caja.getCenter(new THREE.Vector3()), alto = caja.max.y - Math.min(caja.min.y, -1.1) + 0.5;
    const dist = Math.max(7.4, (alto / 2) / Math.tan((15 * Math.PI) / 180) * 1.08);
    camara.position.set(0, c.y + 0.4, dist); camara.lookAt(0, c.y + 0.1, 0);
  };
  encuadrarMascota();
  let anim = animador(m);
  const comida = g0(); escena.add(comida);
  const reconstruir = (nuevas) => {
    op = { ...op, ...nuevas }; giro.remove(m.raiz); liberar(m.raiz); usoRespaldo = false; m = armar(op); giro.add(m.raiz); encuadrarMascota(); const e = anim.e; anim = animador(m); Object.assign(anim.e, { obj: e.obj, mirada: e.mirada, salto: 1, giro: 1 });
    rehacerAlLlegar(op.especie, () => { if (contenedor.isConnected) reconstruir({}); });
  };
  rehacerAlLlegar(op.especie, () => { if (contenedor.isConnected) reconstruir({}); });
  return controlador({ contenedor, renderer, escena, camara, getAnim: () => anim, sombra, comida, op,
    arrastrar: (dx) => { giro.rotation.y += dx * 0.012; }, reconstruir });
}

/* ============================================================ montar: cuarto con la mascota */
// Cada mueble tiene su lugar fijo; los lugares se van abriendo con el nivel de la mascota.
const LUGARES = { tapete: [[0.3, 0, 0.8], 0, 1], cama: [[-1.9, 0, -1.65], 0, 0.95], sillon: [[1.65, 0, -2.25], 0, 0.9], planta: [[-2.45, 0, 1.9], 0, 1],
  lampara: [[-0.55, 0, -2.5], 0, 1], tech: [[2.3, 0, 0.3], -0.4, 0.9], deco: [[2.0, 0, 2.0], -0.6, 0.9], cuadro: [[-2.93, 2.35, 0.6], Math.PI / 2, 1] };
// ventana de la pared del fondo: vista, marco, alfeizar con macetita, cortinas, luz que entra
function ventanaCuarto(tema, noche) {
  const v = g0(); v.position.set(1.0, 2.35, -2.97);
  const blanco = clay(noche ? 0xe6e0ff : 0xfffaf4);
  const vista = texCuarto(noche ? 'vista-noche' : 'vista-dia', noche ? VISTA.noche : VISTA.dia, 256);
  v.add(det(new THREE.PlaneGeometry(1.3, 1.0), matCuarto('vista|' + noche, () => new THREE.MeshBasicMaterial({ map: vista })), { pos: [0, 0, 0.012] }));
  for (const [w, h, x, y] of [[1.5, 0.1, 0, 0.55], [1.5, 0.1, 0, -0.55], [0.1, 1.2, -0.7, 0], [0.1, 1.2, 0.7, 0], [0.045, 1.0, 0, 0], [1.3, 0.045, 0, 0]]) v.add(malla(cajaR(w, h, w < 0.05 || h < 0.05 ? 0.04 : 0.09, 0.02), blanco, { pos: [x, y, 0.045] }));
  v.add(malla(cajaR(1.75, 0.07, 0.26, 0.03), blanco, { pos: [0, -0.63, 0.13] }));
  // macetita en el alfeizar
  v.add(det(cil(0.07, 0.055, 0.12, 14), ceramica(0xff9e8a), { pos: [0.45, -0.54, 0.14] }));
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; v.add(det(esf(0.045, 10), clay(0x86d07a), { pos: [0.45 + Math.cos(a) * 0.035, -0.45, 0.14 + Math.sin(a) * 0.035], esc: [0.7, 1.3, 0.7] })); }
  v.add(det(cajaR(0.16, 0.05, 0.11, 0.015), clay(0xc3a3ff), { pos: [-0.45, -0.57, 0.13], rot: [0, 0.3, 0] }));
  v.add(det(cajaR(0.14, 0.04, 0.1, 0.015), clay(0xffe27a), { pos: [-0.45, -0.525, 0.13], rot: [0, 0.1, 0] }));
  // cortinas con pliegues, recogidas con un lazo
  const cortG = new THREE.PlaneGeometry(0.5, 1.85, 16, 12), p = cortG.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), t = (y + 0.925) / 1.85, nudo = 1 - 0.5 * Math.exp(-((t - 0.32) ** 2) / 0.03);
    p.setXYZ(i, (x + 0.25) * nudo, y, Math.sin((x + 0.25) * 30) * 0.03 * (0.6 + 0.4 * nudo)); }
  cortG.computeVertexNormals();
  const tela2 = clay(tema.cort, { side: THREE.DoubleSide, roughness: 0.9, sheen: 1, sheenRoughness: 0.5, clearcoat: 0 });
  for (const s of [-1, 1]) { const c = malla(cortG, tela2, { pos: [s * 0.95, 0.0, 0.16], esc: [-s, 1, 1] }); c.receiveShadow = true; v.add(c);
    v.add(det(new THREE.TorusGeometry(0.07, 0.02, 6, 14), tela(oscurecer(tema.cort, 0.15)), { pos: [s * 0.83, -0.33, 0.16], rot: [Math.PI / 2, 0, 0], esc: [1.6, 0.8, 1] })); }
  v.add(malla(cil(0.022, 0.022, 2.1, 8), madera(0xd9a06e), { pos: [0, 0.94, 0.18], rot: [0, 0, Math.PI / 2] }));
  for (const s of [-1, 1]) v.add(det(esf(0.045, 10), madera(0xd9a06e), { pos: [s * 1.07, 0.94, 0.18] }));
  // luz que entra: mancha en el piso y haz de luz muy suave
  const cLuz = noche ? 0x8fa0ff : 0xffdcaa;
  const mancha = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.4), matCuarto('mancha|' + noche, () => new THREE.MeshBasicMaterial({ map: TEX_MANCHA, color: cLuz, transparent: true, opacity: noche ? 0.1 : 0.16, blending: THREE.AdditiveBlending, depthWrite: false })));
  mancha.rotation.x = -Math.PI / 2; mancha.position.set(0.05, -2.34, 1.75); mancha.raycast = () => {}; v.add(mancha);
  const pos = [], col = [], c0 = new THREE.Color(cLuz).multiplyScalar(noche ? 0.015 : 0.024), negro = [0, 0, 0];
  const A = [[-0.62, 0.48], [0.62, 0.48], [0.62, -0.48], [-0.62, -0.48]].map(([x, y]) => [x, y, 0.02]), B = [[-0.7, 1.05], [0.75, 1.05], [0.8, 2.4], [-0.75, 2.4]].map(([x, z]) => [x, -2.33, z]);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; [A[i], A[j], B[j], A[i], B[j], B[i]].forEach((q, k) => { pos.push(...q); col.push(...([0, 1, 3].includes(k) ? c0.toArray() : negro)); }); }
  const hazG = new THREE.BufferGeometry(); hazG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hazG.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const haz = new THREE.Mesh(hazG, matCuarto('haz', () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  haz.raycast = () => {}; v.add(haz);
  return v;
}
// repisa en la pared del fondo con libros, fotito y una planta colgante
function repisaCuarto(noche) {
  const r = g0(); r.position.set(-1.75, 2.68, -2.97);
  const mad = madera(0xe0ac78);
  r.add(malla(cajaR(1.15, 0.06, 0.26, 0.025), mad, { pos: [0, 0, 0.13] }));
  for (const s of [-1, 1]) r.add(det(cajaR(0.04, 0.16, 0.18, 0.015), mad, { pos: [s * 0.42, -0.1, 0.09] }));
  [[0xff9e8a, 0.09, 0.3], [0xc3a3ff, 0.07, 0.26], [0x9fe3a6, 0.1, 0.32], [0xffe27a, 0.07, 0.24]].forEach(([c, w, h], i) => r.add(det(cajaR(w, h, 0.2, 0.015), clay(c), { pos: [-0.45 + i * 0.1 + (i > 2 ? 0.03 : 0), 0.03 + h / 2, 0.13], rot: [0, 0, i === 3 ? -0.25 : 0] })));
  r.add(det(cajaR(0.22, 0.18, 0.03, 0.015), clay(0xfffaf4), { pos: [0.05, 0.12, 0.08], rot: [-0.12, 0, 0] }));
  r.add(det(corazonGeo(0.05), clay(0xff7bb0), { pos: [0.05, 0.13, 0.1], rot: [-0.12, 0, 0], esc: [1, 1, 0.4] }));
  r.add(det(cil(0.08, 0.06, 0.13, 14), ceramica(noche ? 0xc3a3ff : 0xfff1dc), { pos: [0.38, 0.095, 0.13] }));
  r.add(muchos(esf(0.045, 8), clay(0xffffff), Array.from({ length: 9 }, (_, i) => { const lado = i % 2 ? 1 : -1, k = Math.floor(i / 2);
    return { pos: [0.38 + lado * 0.06 + Math.sin(i) * 0.02, 0.12 - k * 0.11, 0.2 + (i % 3) * 0.015], esc: [1, 0.6, 0.5], color: i % 3 ? 0x86d07a : 0x6fc46a }; })));
  return r;
}
// guirnalda de foquitos colgada arriba de la pared del fondo y la izquierda
function focosCuarto(noche) {
  const g = g0(), pts = [];
  const tramo = (a, b, n, caida) => { for (let i = 0; i <= n; i++) { const k = i / n; pts.push(new THREE.Vector3().lerpVectors(a, b, k).add(new THREE.Vector3(0, -Math.sin(k * Math.PI) * caida, 0))); } };
  tramo(new THREE.Vector3(-2.92, 3.5, 2.2), new THREE.Vector3(-2.92, 3.55, -0.3), 10, 0.3);
  tramo(new THREE.Vector3(-2.92, 3.55, -0.3), new THREE.Vector3(-2.92, 3.55, -2.92), 10, 0.25);
  tramo(new THREE.Vector3(-2.92, 3.55, -2.92), new THREE.Vector3(-0.1, 3.55, -2.92), 12, 0.28);
  tramo(new THREE.Vector3(-0.1, 3.55, -2.92), new THREE.Vector3(2.8, 3.5, -2.92), 12, 0.1);
  g.add(det(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.008, 4), clay(0x6a5a8a)));
  const cols = [0xfff2b0, 0xffc4e1, 0xbff4ff, 0xffe0a8];
  g.add(muchos(esf(0.035, 8), luz(0xffffff), pts.filter((p, i) => i % 3 === 0).map((p, i) => ({ pos: [p.x, p.y - 0.035, p.z], esc: [1, 1.3, 1], color: cols[i % 4] }))));
  if (noche) pts.forEach((p, i) => { if (i % 6) return; g.add(halo(cols[(i / 3) % 4], 0.45, 0.35)).children.at(-1).position.set(p.x, p.y - 0.04, p.z); });
  return g;
}
function construirCuarto(op) {
  const g = g0();
  const kPared = PAREDES[op.pared] !== undefined ? op.pared : 'crema', kPiso = PISOS[op.piso] !== undefined ? op.piso : 'madera';
  const tema = TEMAS_PARED[kPared], noche = !!tema.noche, piso = PISOS[kPiso], pared = PAREDES[kPared];
  const fijo = (m, sombra = false) => { m.castShadow = sombra; m.receiveShadow = true; return m; };
  // base del diorama
  g.add(fijo(malla(cajaR(6.56, 0.18, 6.56, 0.08), clay(0xd8cbf5), { pos: [-0.03, -0.36, -0.03] })));
  // piso: losa con textura arriba y canto mas oscuro
  const canto = clay(oscurecer(piso, 0.16)), texPiso = texCuarto('piso-' + kPiso, PISO_DIBUJO[kPiso], 512, [3.1, 3.1]);
  const tapa = conTex('piso-' + kPiso, texPiso, kPiso === 'nube' || kPiso === 'pasto' ? { roughness: 0.95, clearcoat: 0, sheen: 0.8 } : { roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.2 });
  g.add(fijo(malla(new THREE.BoxGeometry(6.2, 0.3, 6.2), [canto, canto, tapa, canto, canto, canto], { pos: [0, -0.15, 0] })));
  // paredes: cuerpo, papel tapiz arriba, lambrin abajo, molduras y remate blanco
  const cuerpo = clay(oscurecer(pared, 0.06));
  g.add(fijo(malla(new THREE.BoxGeometry(6.325, 4.3, 0.25), cuerpo, { pos: [-0.0625, 1.85, -3.1] })));
  g.add(fijo(malla(new THREE.BoxGeometry(0.25, 4.3, 6.2), cuerpo, { pos: [-3.1, 1.85, 0] })));
  const remate = clay(noche ? 0xc9c0f5 : 0xfffaf4);
  g.add(fijo(malla(cajaR(6.4, 0.08, 0.33, 0.035), remate, { pos: [-0.06, 4.03, -3.1] })));
  g.add(fijo(malla(cajaR(0.33, 0.08, 6.26, 0.035), remate, { pos: [-3.1, 4.03, 0.02] })));
  const L = 6.075, cx = (3.1 - 2.975) / 2;   // largo interior de cada pared y su centro
  const papel = conTex('papel-' + kPared, texCuarto('papel-' + kPared, tema.papel, 256, [L, 3]), { roughness: 0.85, clearcoat: 0, sheen: 0.3 });
  const lam = conTex('lambrin-' + kPared, texCuarto('lambrin-' + kPared, lambrin(tema.lam), 128, [L, 1]), { roughness: 0.6, clearcoat: 0.3, sheen: 0.1 });
  for (const [m, y, h] of [[papel, 2.5, 3], [lam, 0.5, 1]]) {
    g.add(fijo(malla(new THREE.PlaneGeometry(L, h), m, { pos: [cx, y, -2.97] })));
    g.add(fijo(malla(new THREE.PlaneGeometry(L, h), m, { pos: [-2.97, y, cx], rot: [0, Math.PI / 2, 0] })));
  }
  const moldura = clay(noche ? 0x4a4390 : aclarar(tema.lam, 0.55)), zoclo = clay(noche ? 0x1d1a48 : aclarar(tema.lam, 0.35));
  for (const [y, h, d, m] of [[1.0, 0.07, 0.06, moldura], [0.08, 0.16, 0.05, zoclo]]) {
    g.add(fijo(malla(cajaR(L, h, d, 0.02), m, { pos: [cx, y, -2.975 + d / 2] })));
    g.add(fijo(malla(cajaR(d, h, L, 0.02), m, { pos: [-2.975 + d / 2, y, cx] })));
  }
  g.add(ventanaCuarto(tema, noche));
  g.add(repisaCuarto(noche));
  g.add(focosCuarto(noche));
  const mu = op.muebles || {}, ud = { muebles: {}, noche, anims: [] }, pos0 = op.posiciones || {};
  for (const [lugar, [pos, rotY, escala]] of Object.entries(LUGARES)) {
    const f = MUEBLES[lugar]?.[mu[lugar]]; if (!f) continue;
    const o = f();
    if (lugar !== 'cuadro' && lugar !== 'tapete') {  // sombrita de contacto a la medida del mueble
      const caja = new THREE.Box3(); o.updateMatrixWorld(true);
      o.traverse((x) => { if (x.isMesh && x.material?.blending !== THREE.AdditiveBlending) caja.expandByObject(x); });
      const s = sombraContacto((caja.max.x - caja.min.x) * 1.12 + 0.25, (caja.max.z - caja.min.z) * 1.12 + 0.25);
      s.position.set((caja.min.x + caja.max.x) / 2, 0.008, (caja.min.z + caja.max.z) / 2); o.add(s);
    }
    o.position.set(...pos); o.rotation.y = rotY; o.scale.setScalar(escala);
    const guardada = pos0[lugar];  // donde el asesor lo acomodo
    if (Array.isArray(guardada)) {
      if (lugar === 'cuadro') { o.position.z = guardada[0]; o.position.y = guardada[1]; }
      else { o.position.x = guardada[0]; o.position.z = guardada[1]; o.rotation.y = guardada[2] || 0; }
    }
    o.traverse((x) => { if (x.isMesh) x.receiveShadow = true; });
    g.add(o); Object.assign(ud, o.userData); o.userData.lugar = lugar; ud.muebles[lugar] = o;
    if (o.userData.anim) ud.anims.push(o.userData.anim);
  }
  delete ud.anim; delete ud.foco; delete ud.colorFoco;
  g.userData = ud;
  return g;
}

/* luces del cuarto: cielo calido, sol que entra de frente-derecha (unica luz con sombra),
   relleno frio, contraluz rosado y un foco puntual que sigue a la lampara. De noche todo baja y la lampara manda. */
function lucesCuarto(escena, renderer) {
  renderer.toneMappingExposure = 1.05;
  const cielo = new THREE.HemisphereLight(0xfff4e8, 0xe6c2b4, 1.35); escena.add(cielo);
  const sol = new THREE.DirectionalLight(0xffe2c0, 2.1); sol.position.set(4.5, 7.5, 3.8);
  sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024); Object.assign(sol.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 });
  sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.025; sol.shadow.radius = 4; escena.add(sol);
  const relleno = new THREE.DirectionalLight(0xdfe4ff, 0.55); relleno.position.set(-1, 3, 7); escena.add(relleno);
  const contra = new THREE.DirectionalLight(0xffd6ec, 0.5); contra.position.set(-4, 5, -3); escena.add(contra);
  const foco = new THREE.PointLight(0xffc98a, 0, 5, 1.5); escena.add(foco);
  const v = new THREE.Vector3();
  return {
    ajustar(cuarto) {
      const n = !!cuarto.userData.noche, lamp = cuarto.userData.muebles?.lampara;
      cielo.color.set(n ? 0xe0dcff : 0xfff4e8); cielo.groundColor.set(n ? 0x8a7ab0 : 0xe6c2b4); cielo.intensity = n ? 1.2 : 1.35;
      sol.color.set(n ? 0xb4bfff : 0xffe2c0); sol.intensity = n ? 0.95 : 2.1;
      relleno.intensity = n ? 0.4 : 0.55; contra.intensity = n ? 0.45 : 0.5;
      foco.color.set(lamp?.userData.colorFoco ?? 0xffc98a); foco.intensity = lamp && !lamp.userData.apagada ? (n ? 5 : 2.2) : 0;
    },
    cuadro(cuarto, t) {
      const lamp = cuarto.userData.muebles?.lampara;
      if (lamp?.userData.foco) foco.position.copy(lamp.localToWorld(v.copy(lamp.userData.foco)));
      for (const f of cuarto.userData.anims || []) f(t);
    },
  };
}
function montarCuarto(contenedor, opciones = {}) {
  let op = { mascota: {}, muebles: {}, posiciones: {}, pared: 'crema', piso: 'madera', interactivo: true, ...opciones };
  const renderer = prepararRenderer(contenedor);
  const escena = new THREE.Scene(); const L = lucesCuarto(escena, renderer);
  const camara = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  let cuarto = construirCuarto(op); escena.add(cuarto); L.ajustar(cuarto);
  const sombra = sombraSuave(0.6); escena.add(sombra);
  const PET = new THREE.Vector3(0.3, 0, 0.8);
  const pivote = g0(); pivote.position.copy(PET); escena.add(pivote);
  const ponerMascota = () => {
    usoRespaldo = false;
    const nueva = armar({ etapa: 1, ...op.mascota }); const k = nueva.raiz.scale.x * 0.58;
    nueva.raiz.scale.setScalar(k); nueva.raiz.position.set(0, 1.04 * k, 0); nueva.raiz.userData.y0 = 1.04 * k;
    pivote.add(nueva.raiz);
    // si salio de respaldo, al llegar su modelo se cambia solo la mascota (el cuarto se queda)
    rehacerAlLlegar(op.mascota?.especie, () => {
      if (!contenedor.isConnected || m !== nueva) return;
      pivote.remove(m.raiz); liberar(m.raiz); m = ponerMascota(); ensuciar(); anim = animador(m);
    });
    return nueva;
  };
  let m = ponerMascota();
  let anim = animador(m);
  const comida = g0(); escena.add(comida);

  /* ---------- camara orbital: girar arrastrando, zoom con pellizco o rueda, acercarse a la mascota */
  const LIM = { azMin: 0.08, azMax: 1.5, elMin: 0.12, elMax: 1.15, dMin: 2.6, dMax: 18 };
  const cam = { az: 0.66, el: 0.5, d: 12.4, objetivo: new THREE.Vector3(-0.15, 1.15, -0.15) };  // encuadre con las paredes completas
  const meta = { az: cam.az, el: cam.el, d: cam.d, objetivo: cam.objetivo.clone() };
  let dBase = 13.2, cerca = false;
  const encuadrar = (aspecto) => { dBase = aspecto < 0.8 ? 14.2 : aspecto < 1.1 ? 12.6 : 11.4; if (!cerca) meta.d = dBase; };
  const aplicarCamara = (k) => {
    cam.az += (meta.az - cam.az) * k; cam.el += (meta.el - cam.el) * k; cam.d += (meta.d - cam.d) * k; cam.objetivo.lerp(meta.objetivo, k);
    const o = cam.objetivo;
    camara.position.set(o.x + cam.d * Math.cos(cam.el) * Math.sin(cam.az), o.y + cam.d * Math.sin(cam.el), o.z + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camara.lookAt(o);
  };
  const limitar = () => {
    meta.az = Math.max(LIM.azMin, Math.min(LIM.azMax, meta.az)); meta.el = Math.max(LIM.elMin, Math.min(LIM.elMax, meta.el));
    meta.d = Math.max(LIM.dMin, Math.min(LIM.dMax, meta.d));
  };

  /* ---------- seleccion y arrastre de muebles (modo decorar) */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const planoPiso = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), planoPared = new THREE.Plane(new THREE.Vector3(1, 0, 0), 2.93);
  let decorando = false, elegido = null, cbs = {};
  const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 10, 48), new THREE.MeshBasicMaterial({ color: 0x7c5cff }));
  anillo.visible = false; escena.add(anillo);
  const rayoDesde = (ev) => {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camara);
  };
  /* zoom flexible: se acerca hacia donde apuntas (no siempre al centro) y con dos dedos (o shift / clic derecho) te mueves */
  const CENTRO = new THREE.Vector3(-0.15, 1.15, -0.15);
  const acotar = (v) => v.set(Math.max(-2.6, Math.min(2.6, v.x)), Math.max(0.4, Math.min(2.6, v.y)), Math.max(-2.6, Math.min(2.6, v.z)));
  const puntoBajo = (x, y) => {   // lo que hay bajo el dedo: piso o paredes (si no, el centro)
    rayoDesde({ clientX: x, clientY: y });
    const p = new THREE.Vector3(), pared2 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 2.93);
    if (ray.ray.intersectPlane(planoPiso, p) && Math.abs(p.x) < 3 && Math.abs(p.z) < 3) return acotar(p.setY(Math.max(p.y, 0.6)));
    if (ray.ray.intersectPlane(planoPared, p) || ray.ray.intersectPlane(pared2, p)) return acotar(p);
    return CENTRO.clone();
  };
  const zoomHacia = (x, y, factor) => {
    const antes = meta.d;
    meta.d *= factor; limitar();
    const k = (antes - meta.d) / Math.max(0.01, antes);   // >0 acercando, <0 alejando
    if (k > 0) meta.objetivo.lerp(puntoBajo(x, y), Math.min(1, k * 1.6));
    else if (k < 0) meta.objetivo.lerp(CENTRO, Math.min(1, -k * 1.6));
    if (meta.d >= dBase * 0.97) meta.objetivo.copy(CENTRO);   // alejado del todo: vuelve al centro
    acotar(meta.objetivo);
  };
  const mover = (dx, dy, base) => {   // arrastrar la vista en el plano de la camara
    const esc = meta.d * 0.0016, der = new THREE.Vector3(Math.cos(meta.az), 0, -Math.sin(meta.az));
    meta.objetivo.copy(base).addScaledVector(der, -dx * esc).add(new THREE.Vector3(0, dy * esc, 0));
    acotar(meta.objetivo);
  };
  const muebleEn = () => {
    const hit = ray.intersectObjects(Object.values(cuarto.userData.muebles || {}), true)[0];
    let o = hit?.object; while (o && !o.userData?.lugar) o = o.parent; return o || null;
  };
  const tocaMascota = () => ray.intersectObject(m.raiz, true).length > 0;

  /* ---------- vida propia: pasea por el cuarto (sin atravesar muebles) y voltea a ver a la camara */
  const paseo = { destino: null, espera: 4 + Math.random() * 4, rumbo: 0 };
  const gPopos = g0(); escena.add(gPopos);   // popós en el piso (ver higiene, más abajo): la mascota las rodea
  // caja del mueble sin su sombrita de contacto ni brillos (esos agrandaban la caja y tapaban lugares libres); se recalcula si lo mueven
  const cajaMueble = (o) => {
    const u = o.userData, k = o.position.x + ',' + o.position.y + ',' + o.position.z + ',' + o.rotation.y;
    if (u.cajaK !== k) {
      o.updateMatrixWorld(true); const c = new THREE.Box3();
      o.traverse((x) => { const mt = [x.material].flat()[0]; if (x.isMesh && mt && mt.depthWrite !== false && mt.blending !== THREE.AdditiveBlending) c.expandByObject(x); });
      u.caja = c; u.cajaK = k;
    }
    return u.caja;
  };
  const libre = (x, z, junto = null, lim = 2.3) => {   // junto: ese mueble se puede tener pegadito (abrazar el peluche, pegarle a la piñata); lim: qué tanto se arrima a las paredes
    if (Math.abs(x) > lim || Math.abs(z) > lim) return false;
    if (gPopos.children.some((p) => p.userData.recoger === undefined && Math.hypot(p.position.x - x, p.position.z - z) < 0.45)) return false;
    for (const [lugar, o] of Object.entries(cuarto.userData.muebles || {})) {
      if (lugar === 'tapete' || lugar === 'cuadro') continue;
      const caja = cajaMueble(o).clone().expandByScalar(lugar === junto ? 0.12 : 0.45);
      if (x > caja.min.x && x < caja.max.x && z > caja.min.z && z < caja.max.z) return false;
    }
    return true;
  };
  const libreSin = (x, z, lugar) => libre(x, z, lugar);
  const elegirDestino = () => {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, d = 0.6 + Math.random() * 1.2;
      const x = pivote.position.x + Math.cos(a) * d, z = pivote.position.z + Math.sin(a) * d;
      const mx = (x + pivote.position.x) / 2, mz = (z + pivote.position.z) / 2;
      if (libre(x, z) && libre(mx, mz)) return new THREE.Vector3(x, 0, z);
    }
    return libre(PET.x, PET.z) ? PET.clone() : null;  // si esta encerrada, regresa al tapete
  };
  const anguloSuave = (de, a, k) => { let d = a - de; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return de + d * k; };
  /* interacciones con el cuarto: de vez en cuando elige un mueble, camina a su lado y hace algo con él
     (se sube a la cama a dormir tapada, se sienta en el sillón, huele la planta, baila en el tapete, ve la tele...) */
  pivote.rotation.order = 'YXZ';   // inclinarse hacia donde mira
  /* ACTIVIDADES[lugar] = { _: las de cualquier mueble de ese lugar, <clave>: las propias de ese mueble (si no hay, usa _) }.
     Cada una: { t: tipo (rama de hacerActividad), d: duración en s, p: peso al sortear (1),
       arriba: se hace ENCIMA del mueble (cama: colchon, sillón: asiento; ver planArriba),
       acerca: 'frente' (delante, hacia donde mira el mueble) | 'centro' (encima del tapete) | 'lado' (default: el lado que da al cuarto),
       dist: separación desde la orilla del mueble (m), paso(c) / fin(c): efecto en el mueble cada cuadro / al terminar,
         con c = { o: el mueble, a: la actividad, t, dt } }.
       en: [x, z] (o (o) => [x, z]) punto propio en el marco del mueble donde se para, mira: [x, y, z] hacia donde voltea,
       prop: accesorio en las manos (default: el del tipo), hacer(c): la pose de la mascota en el piso cada cuadro
         (c = { a, k, t, dt, dura, aCam, K: tamaño, o }; devuelve el giro o nada), enCima(c): igual pero encima de la cama /
         sillón (c = { a, t, dt, dura, p: plan, pos, q, aCam, K, o }; devuelve el aplastado sy o nada) }.
     Para agregar la de un mueble nuevo: ACTIVIDADES.deco.pinata = [{ t: 'golpear', d: 4, paso: ... }] y su pose en hacer (o, si
     se comparte, su rama en hacerActividad). El mueble lee o.userData.fx (0..1) y tx (tiempo extra) en su anim para reaccionar. */
  const menear = (o, k) => { o.rotation.z = k; };   // el mueble se mece (planta, piñata)
  const son = (ev, k) => Juego3D.cuarto(ev, k);   // el sonido de lo que hace (juego.js: EFECTOS_CUARTO)
  const lamparaLuz = (o, prendida) => {   // apaga / prende la lámpara: el foco del cuarto y sus brillos
    if (!o.userData.apagada !== !!prendida) son('clic', prendida ? 1 : 0);   // (solo si cambia: al terminar la vuelve a prender aunque ya esté)
    o.userData.apagada = !prendida; L.ajustar(cuarto);
    o.traverse((x) => { if (x.isMesh && x.material?.blending === THREE.AdditiveBlending) x.visible = prendida; });
  };
  // el mueble reacciona: fx (0..1) y tx (tiempo extra, para que su animación vaya más rápido) los lee su userData.anim
  const fxM = (o, v) => { o.userData.fx = v; };
  const masT = (o, dt, vel) => { o.userData.tx = (o.userData.tx || 0) + dt * vel; };
  const apretar = (o, sx, sy) => { const b = (o.userData.esc0 ??= o.scale.x); o.scale.set(b * sx, b * sy, b * sx); };   // se apachurra / estira (sin moverlo)
  const pieza = (o, n) => o.userData.piezas?.[n];
  const enMundo = (o, x, y, z) => o.localToWorld(new THREE.Vector3(x, y, z));
  const azar = (a, b) => a + Math.random() * (b - a);
  const _vh = new THREE.Vector3();
  const hacia = (de, a, vel) => { _vh.copy(a).sub(de).setY(0); const L = _vh.length() || 1; return [(_vh.x / L) * vel, (_vh.z / L) * vel]; };   // velocidad [vx, vz] de de hacia a
  const curva = (x, t0, t1, t2, t3) => (x <= t0 || x >= t3 ? 0 : x < t1 ? suave((x - t0) / (t1 - t0)) : x <= t2 ? 1 : 1 - suave((x - t2) / (t3 - t2)));   // sube, se queda, baja
  const risa = (p = 0.5) => (Math.random() < p ? 'ja' : '♥');
  const fuera = (K, y0, y1, r0 = 1.0, r1 = 1.45) => { const an = Math.random() * Math.PI * 2, r = azar(r0, r1) * K; return { x: Math.sin(an) * r, z: Math.cos(an) * r, y: azar(y0, y1) * K }; };   // un punto alrededor de la mascota (no dentro)
  const OLER = { t: 'oler', d: 4, paso: ({ o, a }) => menear(o, Math.sin(a.t * 14) * 0.035 * Math.max(0, 1 - a.t / 2)), fin: ({ o }) => menear(o, 0) };
  const REGAR = { t: 'regar', d: 5.5, paso: ({ o, a }) => menear(o, Math.sin(a.t * 9) * 0.02), fin: ({ o }) => menear(o, 0) };
  const APAGAR = { t: 'apagar', d: 5, dist: 0.4, paso: ({ o, a }) => { if (!a.luz && a.t > 1.0) { a.luz = 1; lamparaLuz(o, false); } if (a.luz === 1 && a.t > a.act[1] - 1.2) { a.luz = 2; lamparaLuz(o, true); } }, fin: ({ o }) => lamparaLuz(o, true) };

  /* ---- tapetes */
  const TAPETE = [{ t: 'bailar', d: 6.5, p: 2, acerca: 'centro' }, { t: 'ejercicio', d: 6, acerca: 'centro' }, { t: 'estirarse', d: 4.5, acerca: 'centro' }];
  // redondo: trota en círculos por los anillos tejidos y acaba mareada con estrellitas dando vueltas
  const VUELTAS = { t: 'vueltas', d: 6, p: 2, acerca: 'centro', hacer: ({ a, t, dura, K }) => {
    const c0 = (a.c0 ??= pivote.position.clone());
    if (a.t < dura - 1.7) {
      const th = a.t * 2.2, rr = 0.42 * suave(a.t / 0.5), x = c0.x + Math.sin(th) * rr, z = c0.z + Math.cos(th) * rr;
      if (libre(x, z)) pivote.position.set(x, Math.abs(Math.sin(a.t * 11)) * 0.05, z);
      brazosPose(-0.5 + Math.sin(a.t * 11) * 0.4, 0.3);
      if (cada(0.3)) soltarFigura(['chispa|#ff8fa8', 'chispa|#c9b3ff', 'chispa|#ffe27a'][Math.floor(a.t / 0.3) % 3], { y: 0.25 * K, z: -0.5 * K, tam: 0.22, vy: 0.15, vx: 0, dur: 1.3 });
      return Math.atan2(Math.cos(th), -Math.sin(th));   // viendo hacia donde trota
    }
    pivote.position.y = 0; const e = Math.min(1, (dura - a.t) / 0.4); if (!a.mareo) { a.mareo = true; son('mareo'); }
    pivote.rotation.z = Math.sin(t * 7) * 0.14 * e; anim.e.obj.set(Math.cos(t * 8) * 0.7, Math.sin(t * 8) * 0.4);
    if (cada(0.14)) soltarFigura(Math.random() < 0.75 ? '★' : '?', { x: Math.cos(t * 6) * 0.65 * K, y: 2.25 * K, z: Math.sin(t * 6) * 0.65 * K, tam: 0.2, vx: 0, vy: 0.04, dur: 0.7 });
    return pivote.rotation.y;
  } };
  // osito: se hinca junto a la cabeza del oso y la abraza (el hocico se apachurra); o se duerme con la cabeza del oso de almohada
  const OSITO_PASO = ({ o, a }) => { const h = pieza(o, 'hocico'); if (h) { const s = Math.max(0, Math.sin(a.t * 3)) * Math.min(1, a.t); h.scale.set(1.1 * (1 + s * 0.12), 0.45 * (1 - s * 0.35), 0.8 * (1 + s * 0.08)); } };
  const OSITO_FIN = ({ o }) => pieza(o, 'hocico')?.scale.set(1.1, 0.45, 0.8);
  const OSITO = { t: 'osito', d: 6, p: 2, en: [0, -1.4], mira: [0, 0, -0.75], paso: OSITO_PASO, fin: OSITO_FIN, hacer: ({ a, t, dura, K }) => {
    const e = suave(a.t / 0.7) * Math.min(1, (dura - a.t) / 0.5);
    pivote.rotation.x = 0.4 * e; pivote.rotation.z = Math.sin(t * 2.4) * 0.07 * e; pivote.scale.set(1 + 0.05 * e, 1 - 0.14 * e, 1 + 0.05 * e);
    brazosPose(-1.25 * e, -0.45 * e + Math.sin(t * 3) * 0.05); anim.e.obj.set(0, -0.5 * e); if (a.t > 0.8) anim.e.cierre = 0.2;
    if (cada(0.7)) soltarFigura('♥', { tam: 0.22, y: 1.3 * K, z: 0.5 * K });
    if (cada(2 * Math.PI / 3)) son('apapacho');   // cada que lo aprieta (el hocico se apachurra)
  } };
  const SIESTA_OSO = { t: 'dormir', d: 9, en: [0, -0.7], abrazo: true, paso: OSITO_PASO, fin: OSITO_FIN };
  // arcoíris: brinca de banda en banda hacia afuera; cada banda suelta un destello de su color; al final un brincote
  const BANDAS = ['#ff9ccf', '#ffb38a', '#ffe27a', '#9fe3a6', '#8fd0ff', '#c3a3ff'];
  const ARCOIRIS = { t: 'arcoiris', d: 5.8, p: 2, acerca: 'centro', paso: ({ o, dt }) => { const s = pieza(o, 'estrella'); if (s) s.rotation.z += dt * 5; },
    hacer: ({ a, K, aCam }) => {
      const c0 = (a.c0 ??= pivote.position.clone()), dir = (a.dir ??= camara.position.clone().sub(c0).setY(0).normalize());
      const n = Math.floor(a.t / 0.7), u = (a.t % 0.7) / 0.7;
      if (a.nSon !== n) { if (a.nSon !== undefined && n < 6) son('nota', n - 1); a.nSon = n; }   // cae en cada banda: una nota más aguda
      if (n < 6) {
        const r = (n + suave(u)) * 0.13, x = c0.x + dir.x * r, z = c0.z + dir.z * r;
        if (!a.bloq && libre(x, z)) pivote.position.set(x, Math.sin(u * Math.PI) * 0.22, z); else { a.bloq = true; pivote.position.y = 0; }
        const sq = u < 0.14 ? 1 - u / 0.14 : 0; pivote.scale.set(1 + sq * 0.1, 1 - sq * 0.16, 1 + sq * 0.1);
        brazosPose(-1.4 - Math.sin(u * Math.PI) * 0.9, 0.5);
        if (a.t > 0.6 && cada(0.7)) for (let i = 0; i < 2; i++) soltarFigura('chispa|' + BANDAS[(n + 5) % 6], { y: 0.2 * K, tam: 0.2, vy: 0.35, dur: 1.2 });
      } else {
        pivote.position.y = 0; pivote.scale.set(1, 1, 1); brazosPose(-2.6, 0.45);
        if (!a.final) { a.final = true; anim.e.salto = 1; son('arcoirisFin'); for (let i = 0; i < 6; i++) soltarFigura('chispa|' + BANDAS[i], { x: Math.cos(i * 1.05) * 0.45 * K, y: 1.5 * K, z: Math.sin(i * 1.05) * 0.3 * K, tam: 0.22, vy: 0.5, dur: 1.5 }); }
      }
      return aCam;
    } };
  // navideño: nieva encima de ella, trata de atrapar los copos; luego tiembla de frío y suenan cascabeles
  const NEVADA = { t: 'nevada', d: 6, p: 2, acerca: 'centro', hacer: ({ a, t, dura, K, aCam }) => {
    if (a.t < dura - 0.8 && cada(0.1)) soltarFigura('copo', { x: azar(-1.4, 1.4) * K, y: azar(2.3, 2.9) * K, z: azar(-0.9, 1.2) * K, tam: azar(0.08, 0.15), vy: -0.35, vx: azar(-0.08, 0.08), dur: 3.4, gira: azar(-1.5, 1.5) });
    if (a.t < dura - 1.8) {
      anim.e.obj.set(Math.sin(t * 1.3) * 0.6, 1.0); brazosPose(-2.3 + Math.sin(t * 4) * 0.35, 0.35);
      if (a.t > 0.8 && cada(1.4)) { anim.e.salto = 0.45; soltarFigura('♥', { tam: 0.2 }); son('destello'); }
    } else {
      const e = Math.min(1, (dura - a.t) / 0.3); pivote.rotation.z = Math.sin(t * 38) * 0.05 * e; brazosPose(-1.1 * e, -0.5 * e); anim.e.obj.set(0, 0); anim.e.cierre = 0.2;
      if (!a.brr) { a.brr = true; son('brr'); }
      if (cada(0.35)) { soltarFigura(Math.random() < 0.5 ? '♪|#e5484d' : '♫|#3f9a5c', { tam: 0.22 }); son('cascabel'); }
    }
    return aCam;
  } };
  // DE: se para en el logo, echa porras con los brazos arriba (chispas roja / azul / oro) y remata con un brincote: ¡Vamos DE!
  const COLORES_MN = ['#e1211c', '#06205c', '#ffc21a'];
  const PORRA_MN = { t: 'porraMN', d: 6, p: 2, acerca: 'centro',
    paso: ({ o, a }) => { const c = pieza(o, 'cordon'); if (c) c.scale.setScalar(1 + Math.max(0, Math.sin(a.t * Math.PI / 0.7)) * 0.025); },
    fin: ({ o }) => pieza(o, 'cordon')?.scale.setScalar(1),
    hacer: ({ a, t, dura, K, aCam }) => {
      const n = Math.floor(a.t / 0.7);
      if (a.t < dura - 1.8) {
        const u = (a.t % 0.7) / 0.7, arriba = n % 2 ? 1 : 0.55;
        brazosPose(-2.6 * arriba + Math.sin(u * Math.PI) * 0.3, 0.45 + Math.sin(t * 9) * 0.08);
        if (a.n !== n) { a.n = n; if (n > 0) { anim.e.salto = 0.45; son('brinco'); }
          for (let i = 0; i < 2; i++) soltarFigura('chispa|' + COLORES_MN[(n + i) % 3], { y: 1.6 * K, tam: 0.2, vy: 0.4, dur: 1.2 }); }
        if (n === 2 && !a.grito) { a.grito = true; soltarFigura('¡Vamos!|#06205c', { y: 2.1 * K, tam: 0.3, vy: 0.25, vx: 0, dur: 1.6 }); son('ritmo'); }
      } else {
        brazosPose(-2.7, 0.55);
        if (!a.final) { a.final = true; anim.e.salto = 1; son('tada');
          soltarFigura('¡Vamos DE!|#e1211c', { y: 2.2 * K, tam: 0.36, vy: 0.3, vx: 0, dur: 1.8 });
          for (let i = 0; i < 9; i++) soltarFigura('chispa|' + COLORES_MN[i % 3], { x: Math.cos(i * 0.7) * 0.5 * K, y: 1.4 * K, z: Math.sin(i * 0.7) * 0.35 * K, tam: 0.22, vy: 0.55, dur: 1.5 }); }
        if (cada(0.45)) { soltarFigura('★|#ffc21a', { tam: 0.18, y: 1.9 * K }); son('destello'); }
      }
      return aCam;
    } };

  /* ---- camas (encima del colchón) */
  const CAMA = [{ t: 'dormir', d: 11, p: 2, arriba: true }, { t: 'brincarCama', d: 5, p: 1.3, arriba: true }];
  // nube: flota sobre la cama como en una nube, con los brazos abiertos y nubecitas abajo
  const FLOTAR = { t: 'flotar', d: 7, p: 1.5, arriba: true, enCima: ({ a, t, dt, p, pos, q, aCam }) => {
    const e = suave((a.t - 1.2) / 0.9);
    pos.y = p.S.y + (0.2 + Math.sin(t * 2) * 0.05) * e; m.raiz.position.y = m.raiz.userData.y0;   // flota quietecita (sin brinquitos)
    q.slerp(qGiro(aCam + Math.sin(t * 0.7) * 0.35 * e, -0.12 * e), Math.min(1, dt * 4));
    brazosPose(-0.35 * e, (1.15 + Math.sin(t * 2.4) * 0.18) * e); if (e > 0.6) anim.e.cierre = 0.2;
    if (e > 0.2 && cada(0.3)) soltarFigura('nube', { mundo: _w.set(pos.x + azar(-0.35, 0.35), p.S.y + 0.03, pos.z + azar(-0.35, 0.35)), tam: azar(0.22, 0.36), vy: 0.03, vx: 0, dur: 1.6 });
    if (cada(1.6)) soltarFigura('★', { tam: 0.2 });
    if (e > 0.2 && !a.sFlota) { a.sFlota = true; son('flotar'); }
  } };
  // gamer: sentada en la cama jugando en su consolita; las tiras LED laten de colores
  const CONSOLITA = { t: 'consolita', d: 9, p: 1.5, arriba: true, prop: 'consolita', paso: ({ o, a }) => fxM(o, a.tDesp === undefined && a.t > 1.3 ? 1 : 0), fin: ({ o }) => fxM(o, 0),
    enCima: ({ a, t, dt, q, aCam, K }) => {
      q.slerp(qGiro(aCam), Math.min(1, dt * 5)); m.raiz.rotation.y *= 0.3;
      const gana = a.t % 3.2 > 2.6;
      brazosPose(gana ? -2.4 : -1.0 + Math.sin(t * 24) * 0.1, gana ? 0.3 : 0.22); anim.e.obj.set(Math.sin(t * 1.1) * 0.2, gana ? 0.4 : -0.45);
      if (a.prop) { a.prop.position.y = (gana ? 1.3 : 0.86) * K; a.prop.rotation.z = Math.sin(t * 8) * 0.1; }
      if (!gana && a.t > 1.3 && cada(0.3)) son('botones');   // machaca los botones
      if (gana && cada(3.2)) { anim.e.salto = 0.45; son('victoria8'); for (let i = 0; i < 3; i++) soltarFigura(['★|#3ef0ff', '★|#ff4fd8', '★'][i], { tam: 0.24 }); }
      else if (!gana && cada(0.6)) soltarFigura(Math.floor(a.t / 0.6) % 2 ? 'chispa|#3ef0ff' : 'chispa|#ff4fd8', { x: 0, y: 1.05 * K, z: 0.85 * K, tam: 0.12, vy: 0.25, dur: 0.8 });
      return 0.9;
    } };
  // princesa: con coronita, da dos vueltas de bailarina entre destellos y hace una reverencia; la corona de la cabecera gira
  const PRINCESA = { t: 'princesa', d: 6.5, p: 1.5, arriba: true,
    paso: ({ o, a, dt }) => { const on = a.tDesp === undefined && a.t > 1.6; if (on) masT(o, dt, 4); fxM(o, on ? 1 : 0); }, fin: ({ o }) => fxM(o, 0),
    enCima: ({ a, t, p, q, aCam, K }) => {
      const u = a.t - 1.2;
      if (!a.corona && u > 0.2) { a.corona = true; son('magia'); soltarFigura('corona', { x: 0, y: (p.altoM ?? 1.8 * K) - 0.02, z: 0, vx: 0, vy: 0, tam: 0.24, dur: Math.max(1, a.act[1] - a.t) }); }
      const vuelta = suave((u - 0.4) / 2.6) * Math.PI * 4, rev = suave((u - 3.3) / 0.6) * Math.min(1, Math.max(0, (a.act[1] - a.t) / 0.5));
      q.copy(qGiro(aCam + vuelta, 0.4 * rev)); m.raiz.rotation.y = 0;
      brazosPose(-0.3 - 0.5 * rev, 1.2 * (1 - rev) + 0.2);
      if (u > 0.4 && u < 3.0 && cada(0.16)) soltarFigura(Math.random() < 0.5 ? 'chispa|#ff7bb0' : 'chispa|#ffcf3f', { ...fuera(K, 0.3, 1.8), tam: 0.2, vy: 0.2, dur: 1.1 });
      if (u > 0.4 && u < 3.0 && cada(1.3)) son('vuelta');
      if (rev > 0.5 && cada(0.8)) soltarFigura('♥', { tam: 0.24 });
    } };

  /* ---- sillones (sentada en el asiento) */
  const SILLON = [{ t: 'sentarse', d: 6, arriba: true, acerca: 'frente', dist: 0.5 }, { t: 'leer', d: 8, arriba: true, acerca: 'frente', dist: 0.5 },
    { t: 'cabecear', d: 8, arriba: true, acerca: 'frente', dist: 0.5 }];
  const sentada = (p, q, dt) => { q.slerp(p.qL, Math.min(1, dt * 5)); m.raiz.rotation.y *= 0.3; };
  // puff: se deja caer y se hunde en los frijolitos; el puff se apachurra y rebota con ella
  const HUNDIRSE = { t: 'hundirse', d: 7.5, p: 1.5, arriba: true, acerca: 'frente', dist: 0.5,
    paso: ({ o, a, dt }) => {
      const u = (a.t - 1.0) % 2.4, meta = a.tDesp === undefined && a.t > 1.0 ? 0.2 * (0.35 + 0.65 * Math.max(0, Math.cos(u * 9)) * Math.exp(-u * 2.2)) : 0;
      a.sq = a.tDesp === undefined ? meta : Math.max(0, (a.sq || 0) - dt * 0.6); apretar(o, 1 + a.sq * 0.55, 1 - a.sq);
    }, fin: ({ o }) => apretar(o, 1, 1),
    enCima: ({ a, t, dt, p, pos, q }) => {
      sentada(p, q, dt); pos.y = p.S.y * (1 - (a.sq || 0));
      const u = (a.t - 1.0) % 2.4; if (a.t > 3 && u > 1.81 && !a.hop) { a.hop = true; anim.e.salto = 1; son('boing'); } if (u < 1) a.hop = false;
      const ciclo = Math.floor((a.t - 1.0) / 2.4); if (a.t > 1.0 && a.tDesp === undefined && ciclo !== a.ciclo) { a.ciclo = ciclo; son('puff'); }   // se hunde en los frijolitos   // brinca y vuelve a caer: ¡boing!
      if (a.sq > 0.07) anim.e.cierre = 0.2; anim.e.obj.set(Math.sin(t * 0.7) * 0.4, 0.15);
      if (a.t > 1.2 && cada(1.2)) soltarFigura('♥', { tam: 0.24 });
      return 0.92 - (a.sq || 0) * 0.8;
    } };
  // sofá: se acurruca con su taza de chocolatito humeante y le da sorbitos
  const CHOCOLATE = { t: 'chocolate', d: 8, p: 1.5, arriba: true, acerca: 'frente', dist: 0.5, prop: 'taza', enCima: ({ a, t, dt, p, q, K }) => {
    sentada(p, q, dt);
    const u = (a.t - 1.5) % 3, sorbo = u > 1.8 && u < 2.6 ? Math.sin(((u - 1.8) / 0.8) * Math.PI) : 0;
    brazosPose(-1.15 - sorbo * 0.6, 0.18);
    if (a.prop) { a.prop.position.y = (0.9 + sorbo * 0.28) * K; a.prop.position.z = (0.72 - sorbo * 0.12) * K; a.prop.rotation.x = -sorbo * 0.7; }
    anim.e.obj.set(0, sorbo ? 0 : -0.25); if (sorbo > 0.3 || u < 1.2) anim.e.cierre = 0.2;
    if (u > 2.5 && !a.rico) { a.rico = true; soltarFigura('♥', { tam: 0.22 }); } if (u < 1) a.rico = false;
    if (u > 1.8 && !a.sorbo) { a.sorbo = true; son('sorbo'); } if (u < 1) a.sorbo = false;
    if (a.prop && cada(0.45)) soltarFigura('humo', { mundo: a.prop.localToWorld(_w.set(0, 0.14, 0)), tam: 0.13, vy: 0.22, vx: 0.02, dur: 1.3 });
    return 0.9;
  } };
  // trono: sentada como reina con su corona, saluda despacito a su pueblo; la gema del respaldo late
  const REINAR = { t: 'reinar', d: 7.5, p: 1.5, arriba: true, acerca: 'frente', dist: 0.5,
    paso: ({ o, a }) => fxM(o, a.tDesp === undefined && a.t > 1.3 ? 1 : 0), fin: ({ o }) => fxM(o, 0),
    enCima: ({ a, t, dt, p, q, K }) => {
      sentada(p, q, dt);
      if (!a.corona && a.t > 1.5) { a.corona = true; son('reina'); const alto = medir(qGiro(0), 1, [ARR])[0][1]; soltarFigura('corona', { x: 0, y: alto - 0.02, z: 0, vx: 0, vy: 0, tam: 0.24, dur: Math.max(1, a.act[1] - a.t) }); }
      const b = m.brazos?.[1]; if (b && a.t > 1.6) { b.rotation.z = 2.0 + Math.sin(t * 3.2) * 0.3; b.rotation.x = -0.2; }   // saludo real, despacito
      anim.e.obj.set(Math.sin(t * 0.6) * 0.5, 0.25);
      if (cada(0.8)) soltarFigura('chispa|#ffcf3f', { ...fuera(K, 0.6, 2.0), tam: 0.2, vy: 0.15, dur: 1.2 });
      return 0.92;
    } };

  /* ---- plantas */
  // costilla de Adán: le hacen cosquillas las hojas... ¡achú! la planta se sacude y se soba la nariz
  const ESTORNUDO = { t: 'estornudo', d: 5.2, p: 2, dist: 0.35,
    paso: ({ o, a }) => menear(o, a.t < 2.3 ? Math.sin(a.t * 20) * 0.015 : Math.sin(a.t * 16) * 0.13 * Math.exp(-(a.t - 2.3) * 1.6)), fin: ({ o }) => menear(o, 0),
    hacer: ({ a, t, K }) => {
      if (a.t < 2.3) { pivote.rotation.x = (0.3 + Math.sin(t * 9) * 0.04) * suave(a.t / 0.5); if (a.t > 1.3) { anim.e.cierre = 0.2; pivote.scale.set(1, 1 + (a.t - 1.3) * 0.06, 1); if (!a.ah) { a.ah = true; son('preEstornudo'); } } return; }
      if (!a.feliz) { a.feliz = true; anim.e.salto = 0.55; soltarFigura('¡Achú!', { tam: 0.3, y: 1.6 * K, z: 0.5 * K, vy: 0.35, vx: 0 });
        for (let i = 0; i < 4; i++) soltarFigura('o', { tam: 0.08, y: 1.0 * K, z: 0.8 * K, vx: azar(-0.4, 0.4), vy: azar(0.1, 0.5), dur: 0.9 }); }
      pivote.rotation.x = -0.4 * Math.exp(-(a.t - 2.3) * 3); pivote.scale.set(1, 1, 1);
      if (a.t > 3.0) { brazosPose(-1.7 + Math.sin(t * 14) * 0.15, -0.55); anim.e.obj.set(0, -0.2); if (cada(0.9)) { soltarFigura('!', { tam: 0.2 }); son('olfatear'); } }   // se soba la nariz
    } };
  // cactus: lo huele... ¡y se pica! se sacude la mano
  const PICARSE = { t: 'picarse', d: 4.5, p: 2, paso: ({ o, a }) => menear(o, a.t > 2 ? Math.sin(a.t * 18) * 0.05 * Math.exp(-(a.t - 2) * 2) : 0), fin: ({ o }) => menear(o, 0),
    hacer: ({ a, t }) => {
      pivote.rotation.x = (a.t < 2 ? 0.26 : -0.15) * Math.min(1, a.t / 0.6); if (a.t > 0.5 && a.t < 2 && cada(1.0)) son('olfatear');
      if (a.t > 2 && !a.feliz) { a.feliz = true; anim.e.salto = 1; soltarFigura('!', { tam: 0.32 }); soltarFigura('★', { tam: 0.2 }); son('ay'); }
      if (a.t > 2.4) brazosPose(-1.3 + Math.sin(t * 22) * 0.35, 0.3);
    } };
  // sakura: llueven pétalos del cerezo y los trata de atrapar
  const PETALOS = { t: 'petalos', d: 6.5, p: 2, dist: 0.45, paso: ({ o, a }) => menear(o, Math.sin(a.t * 2.2) * 0.02), fin: ({ o }) => menear(o, 0),
    hacer: ({ a, t, o }) => {
      if (o && cada(0.16)) soltarFigura('petalo', { mundo: enMundo(o, azar(-0.5, 0.5), azar(1.0, 1.4), azar(-0.2, 0.35)), tam: azar(0.09, 0.14), vy: -0.28, vx: azar(-0.15, 0.15), dur: 4.5, gira: azar(-3, 3) });
      anim.e.obj.set(Math.sin(t * 1.5) * 0.5, 0.9);
      brazosPose(-2.3 + Math.sin(t * 5) * 0.35, 0.25 + Math.sin(t * 2.5) * 0.15);
      if (a.t > 0.8 && cada(1.4)) { anim.e.salto = 0.5; soltarFigura('♥|#ff9fc7', { tam: 0.22 }); }
      if (cada(0.7)) son('petalo');
    } };
  // arbolito de Navidad: cuelga una esfera dorada de puntitas; la estrella y los foquitos brillan más y aplaude
  const ADORNO = { t: 'adorno', d: 6.5, p: 2, dist: 0.32, prop: 'esfera', paso: ({ o, a }) => fxM(o, a.colgada ? 1 : 0),
    fin: ({ o, a }) => { fxM(o, 0); if (a.colgada) { a.colgada.removeFromParent(); liberar(a.colgada); a.colgada = null; } },
    hacer: ({ a, t, K, o }) => {
      if (a.t < 1.1) { brazosPose(-1.4, 0.2); anim.e.obj.set(0, -0.2); return; }
      if (a.t < 2.6) { const e = suave((a.t - 1.1) / 0.6); pivote.scale.set(1 - 0.04 * e, 1 + 0.1 * e, 1 - 0.04 * e); brazosPose(-1.4 - 1.1 * e, 0.15); anim.e.obj.set(0, 0.9 * e);
        if (a.prop) { a.prop.position.y = (1.0 + 0.55 * e) * K; a.prop.position.z = (0.7 + 0.15 * e) * K; } return; }
      if (!a.colgada && o) {
        const d = o.worldToLocal(pivote.position.clone()).setY(0).normalize(), b = g0(); b.position.set(d.x * 0.31, 0.96, d.z * 0.31);
        b.add(malla(esf(0.055, 16), brillo(0xffd34d))); b.add(malla(cil(0.018, 0.018, 0.025, 8), metal(0xffcf3f), { pos: [0, 0.06, 0] }));
        o.add(b); a.colgada = b; if (a.prop) a.prop.visible = false; son('cascabel');
        for (let i = 0; i < 5; i++) soltarFigura('chispa|#ffe27a', { mundo: b.getWorldPosition(new THREE.Vector3()), tam: 0.14, vx: azar(-0.3, 0.3), vy: azar(0.1, 0.4), dur: 1 });
      }
      pivote.scale.set(1, 1, 1); brazosPose(-1.4 + Math.sin(t * 16) * 0.3, -0.35 + Math.sin(t * 16) * 0.12); anim.e.obj.set(0, 0.5);   // aplaude
      if (cada(1.2)) { anim.e.salto = 0.6; soltarFigura('★', { tam: 0.26 }); son('destello'); }
    } };

  /* ---- lámparas */
  // de pie: jala la cadenita una y otra vez: apaga, prende, apaga, prende... y se ríe
  const CADENITA = { t: 'cadenita', d: 5.6, p: 2, dist: 0.3,
    paso: ({ o, a }) => {
      const c = pieza(o, 'cadena'); if (c) c.position.y = 1.22 - (a.jala || 0) * 0.07;
      const n = a.t > 0.875 ? Math.min(4, Math.floor((a.t - 0.875) / 1.1) + 1) : 0;
      if (n !== (a.n ?? 0)) { a.n = n; son('cadena'); lamparaLuz(o, n % 2 === 0); soltarFigura(n % 2 ? '!' : 'ja', { tam: 0.22 }); }
    }, fin: ({ o }) => { lamparaLuz(o, true); const c = pieza(o, 'cadena'); if (c) c.position.y = 1.22; },
    hacer: ({ a }) => {
      const f = ((a.t - 0.6) % 1.1) / 1.1, jala = a.t > 0.6 && a.t < 5.0 ? (f < 0.25 ? f / 0.25 : f < 0.45 ? 1 : Math.max(0, 1 - (f - 0.45) / 0.25)) : 0;
      a.jala = jala; brazosPose(-2.5 + jala * 0.5, 0.1); anim.e.obj.set(0, 1.0 - jala * 0.3); pivote.scale.set(1, 1 + 0.05 * (1 - jala), 1);
    } };
  // hongo: le da toquecitos al sombrero, rebota y suelta esporas de luz de colores
  const ESPORAS = { t: 'esporas', d: 5.5, p: 2, dist: 0.35,
    paso: ({ o, a, dt }) => { a.golpe = Math.max(0, (a.golpe || 0) - dt * 2.2); const s = a.golpe * Math.sin(a.t * 26); apretar(o, 1 + 0.05 * s, 1 - 0.08 * s); }, fin: ({ o }) => apretar(o, 1, 1),
    hacer: ({ a, t, o }) => {
      const f = (a.t % 1.2) / 1.2, toca = a.t < 4.2;
      if (toca) brazosPose(f < 0.35 ? -1.2 - 1.2 * (f / 0.35) : -2.4 + 1.6 * Math.min(1, (f - 0.35) / 0.15), 0.15);
      if (toca && a.t > 0.4 && cada(1.2)) { a.golpe = 1; anim.e.salto = 0.3; son('esporas');
        if (o) for (let i = 0; i < 6; i++) soltarFigura(['espora|#ffb0e0', 'espora|#fff1a8', 'espora|#a8ffcf'][i % 3], { mundo: enMundo(o, azar(-0.3, 0.3), 1.0, azar(-0.3, 0.3)), tam: azar(0.14, 0.22), vx: azar(-0.25, 0.25), vy: azar(0.2, 0.45), dur: 2.4 }); }
      anim.e.obj.set(Math.sin(t * 1.4) * 0.4, toca ? 0.6 : 1.0);
      if (!toca) { brazosPose(-0.8, 0.5); if (!a.feliz) { a.feliz = true; soltarFigura('♥'); } }
    } };
  // luna: le aúlla a la lunita con los ojos cerrados; las estrellitas colgadas se mecen y brillan
  const AULLAR = { t: 'aullar', d: 5.5, p: 2, dist: 0.45, paso: ({ o }) => fxM(o, 1), fin: ({ o }) => fxM(o, 0), hacer: ({ a, t, K, o }) => {
    const e = suave(a.t / 0.8), aul = curva(a.t, 1.3, 1.7, 3.6, 4.0);
    anim.e.obj.set(Math.sin(t * 0.6) * 0.3 * (1 - aul), 1.3 * e); pivote.rotation.x = -0.12 * e - 0.12 * aul;
    pivote.scale.set(1, 1 + 0.06 * aul, 1); brazosPose(-0.5 * aul, 0.35 * aul); if (aul > 0.3) anim.e.cierre = 0.2;
    if (a.t > 1.5 && !a.aullo) { a.aullo = true; soltarFigura('Auuu~', { tam: 0.3, y: 1.9 * K, z: 0.3 * K, vy: 0.22, vx: 0, dur: 2.6 }); }
    if (o && cada(0.35)) soltarFigura('chispa|#fff3a8', { mundo: enMundo(o, azar(-0.45, 0.6), azar(0.5, 1.15), 0.2), tam: azar(0.08, 0.14), vy: 0.05, vx: 0, dur: 1.1 });
    if (a.t > 4.3 && !a.feliz) { a.feliz = true; soltarFigura('♥'); anim.e.salto = 0.5; }
  } };
  // calabaza: se asoma curiosa... ¡la calabaza se enciende de golpe! brinco del susto y luego se ríe
  const SUSTO = { t: 'susto', d: 5.8, p: 2, dist: 0.38,
    paso: ({ o, a, dt }) => { a.flash = Math.max(0, (a.flash || 0) - dt * 0.7); fxM(o, a.flash); apretar(o, 1 - 0.04 * a.flash, 1 + 0.1 * a.flash * Math.abs(Math.sin(a.t * 14))); },
    fin: ({ o }) => { fxM(o, 0); apretar(o, 1, 1); },
    hacer: ({ a, t, aCam }) => {
      if (a.t < 1.7) { pivote.rotation.x = 0.28 * suave(a.t / 0.6); anim.e.obj.set(Math.sin(t * 2) * 0.3, 0.2); if (a.t > 0.5 && cada(0.8)) soltarFigura('?', { tam: 0.2 }); return; }
      if (!a.susto) { a.susto = true; a.flash = 1; anim.e.salto = 1; son('sustito'); soltarFigura('!', { tam: 0.4 }); soltarFigura('!', { tam: 0.3 }); }
      if (a.t < 3.4) { pivote.rotation.x = -0.3; pivote.rotation.z = Math.sin(t * 34) * 0.04; brazosPose(-2.7, 0.55); anim.e.obj.set(0, 0.3); return; }
      pivote.rotation.x *= 0.85; pivote.rotation.z = 0; brazosPose(-0.7 + Math.sin(t * 12) * 0.2, -0.4);   // se ríe del susto
      if (cada(0.7)) soltarFigura(risa(), { tam: 0.24 }); return aCam;
    } };

  /* ---- cuadros (en la pared) */
  // paisaje: abre los brazos y respira hondo el paisaje, con pajaritos cantando
  const RESPIRAR = { t: 'respirar', d: 5.5, p: 2, hacer: ({ a, dura }) => {
    const e = suave(a.t / 0.8) * Math.min(1, (dura - a.t) / 0.5), b = Math.sin(a.t * 1.7);
    brazosPose(-0.6 * e, 1.35 * e); pivote.scale.set(1 + 0.05 * b * e, 1 + 0.06 * b * e, 1 + 0.05 * b * e); anim.e.obj.set(0, 0.9 * e);
    if (b > 0.2) anim.e.cierre = 0.2;
    if (cada(0.8)) soltarFigura(Math.random() < 0.5 ? '♪|#5fbf55' : '♫|#4dabf7', { tam: 0.2 });
    if (cada(1.7)) soltarFigura('♥', { tam: 0.22 });
    if (cada(1.6)) son('pajaros'); if (a.t > 0.3 && cada(2 * Math.PI / 1.7)) son('inspira');   // pajaritos y respira hondo
  } };
  // reloj: se mece con el péndulo (tic, tac), las manecillas se aceleran... ¡cucú! brinca y aplaude
  const CUCU = { t: 'cucu', d: 6.2, p: 2, paso: ({ a, dt }) => { if (a.t > 2.6 && a.t < 4.0) cuarto.userData.relojExtra = (cuarto.userData.relojExtra || 0) + dt * 9; },
    hacer: ({ a, t, o }) => {
      anim.e.obj.set(0, a.t > 2.6 && a.t < 4 ? 1.0 + Math.sin(t * 14) * 0.08 : 1.0);
      if (a.t > 2.6 && a.t < 4.0 && cada(0.15)) son('tic', Math.floor(a.t / 0.15) % 2);   // las manecillas se aceleran
      if (a.t < 4.0) { pivote.rotation.z = Math.sin(t * 3) * 0.08; if (cada(1.05)) soltarFigura(Math.floor(a.t / 1.05) % 2 ? 'tac' : 'tic', { tam: 0.2, vx: 0 }); return; }
      pivote.rotation.z = 0;
      if (!a.cucu) { a.cucu = true; anim.e.salto = 1; if (o) soltarFigura('¡Cucú!', { mundo: enMundo(o, 0, 0.5, 0.3), tam: 0.32, vy: 0.3, vx: 0 }); soltarFigura('!', { tam: 0.3 }); }
      brazosPose(-1.4 + Math.sin(t * 16) * 0.3, -0.35); if (cada(0.6)) { soltarFigura('♪', { tam: 0.2 }); son('manotazo'); }   // aplaude
    } };
  // neón: fiesta de neón: baila señalando arriba, el letrero parpadea y cambia de color
  const NEON = { t: 'neon', d: 6.5, p: 2, paso: ({ o }) => fxM(o, 1), fin: ({ o }) => fxM(o, 0), hacer: ({ a, t, aCam }) => {
    if (cada(0.5)) { anim.e.salto = 0.45; anim.e.giro = Math.floor(a.t / 0.5) % 4 === 3 ? 1 : 0; son('ritmo', Math.floor(a.t / 0.5)); }
    const lado = Math.floor(a.t / 1.0) % 2; brazosPose(-0.4, 0.35); const b = m.brazos?.[lado]; if (b) b.rotation.x = -2.8;
    pivote.rotation.z = Math.sin(t * 6.3) * 0.12;
    if (cada(0.4)) soltarFigura(['♪|#ff5cc8', '♫|#5ce1ff', 'chispa|#ff5cc8', 'chispa|#5ce1ff'][Math.floor(a.t / 0.4) % 4], { tam: 0.22 });
    return aCam;
  } };
  // telaraña: la arañita baja por su hilo hasta su cara: ¡susto! y luego la saluda
  const ARANA = { t: 'arana', d: 6, p: 2, paso: ({ o, a }) => fxM(o, curva(a.t, 0.6, 2.2, 4.2, 5.4)), fin: ({ o }) => fxM(o, 0), hacer: ({ a, t }) => {
    const f = curva(a.t, 0.6, 2.2, 4.2, 5.4); anim.e.obj.set(Math.sin(t * 2.2) * 0.08, 1.1 - f * 0.9);
    if (a.t > 0.6 && !a.baja) { a.baja = true; son('arana'); }
    if (a.t > 2.2 && !a.susto) { a.susto = true; anim.e.salto = 0.9; soltarFigura('!', { tam: 0.36 }); son('grito'); }
    if (a.t > 2.2 && a.t < 3.2) { pivote.rotation.x = -0.25; brazosPose(-2.4, 0.5); pivote.rotation.z = Math.sin(t * 30) * 0.04; }
    else if (a.t >= 3.2) { pivote.rotation.x *= 0.9; pivote.rotation.z = 0; brazosPose(-0.3, 0.2); if (!a.hola) { a.hola = true; anim.e.saludo = 1.6; soltarFigura('♥'); } }
  } };
  // murciélagos: aletean como locos: se agacha tapándose la cabeza y luego los imita aleteando
  const MURCIELAGOS = { t: 'murcielagos', d: 6, p: 2, paso: ({ o, dt }) => { fxM(o, 1); masT(o, dt, 2.5); }, fin: ({ o }) => fxM(o, 0), hacer: ({ a, t, aCam }) => {
    if (a.t < 2.6) { const e = suave(a.t / 0.4); pivote.scale.set(1 + 0.08 * e, 1 - 0.2 * e, 1 + 0.08 * e); brazosPose(-2.8 * e, -0.25 * e); anim.e.cierre = 0.2; if (cada(0.8)) soltarFigura('!', { tam: 0.22 }); if (cada(0.5)) son('aleteo'); return; }
    pivote.scale.set(1, 1, 1); brazosPose(-0.4, 0.9 + Math.sin(t * 14) * 0.55); anim.e.obj.set(0, 0.5);
    if (cada(0.7)) { anim.e.salto = 0.4; soltarFigura('♥|#9c82d6', { tam: 0.22 }); son('aleteo'); }
    return aCam;
  } };
  // botas: zapateado navideño, como si trajera las botas puestas: pisotones, polvito y cascabeles
  const BOTAS = { t: 'botas', d: 6, p: 2, paso: ({ o, dt }) => { fxM(o, 1); masT(o, dt, 3); }, fin: ({ o }) => fxM(o, 0), hacer: ({ a, dura, aCam, K }) => {
    const f = (a.t % 0.5) / 0.5, lado = Math.floor(a.t / 0.5) % 2 ? 1 : -1, golpe = f < 0.18 ? 1 - f / 0.18 : 0;
    pivote.position.y = a.t < dura - 0.2 ? Math.sin(f * Math.PI) * 0.07 : 0;
    pivote.rotation.z = lado * 0.1 * Math.sin(f * Math.PI); pivote.scale.set(1 + 0.08 * golpe, 1 - 0.12 * golpe, 1 + 0.08 * golpe);
    brazosPose(-0.5 - 0.5 * Math.sin(f * Math.PI), 0.45);
    if (cada(0.5)) { son('pisoton', lado > 0 ? 1 : 0); soltarFigura(lado > 0 ? '♪|#e5484d' : '♫|#3f9a5c', { tam: 0.22 }); soltarFigura('nube', { y: 0.05, x: lado * 0.2 * K, z: 0.15 * K, tam: 0.16, vy: 0.08, dur: 0.6 }); }
    return aCam;
  } };
  // corona navideña: le hace un saludo de soldadito y luego canta un villancico meciéndose
  const VILLANCICO = { t: 'villancico', d: 6.5, p: 2, paso: ({ o, dt }) => { fxM(o, 1); masT(o, dt, 2); }, fin: ({ o }) => fxM(o, 0), hacer: ({ a, t, aCam }) => {
    if (a.t < 1.6) { const b = m.brazos?.[1]; if (b) { b.rotation.x = -2.5; b.rotation.z = -0.55; } anim.e.obj.set(0, 0.9); if (!a.firme) { a.firme = true; soltarFigura('★', { tam: 0.24 }); son('firmes'); } return; }
    pivote.rotation.z = Math.sin(t * 3) * 0.1; brazosPose(-1.3, -0.42); anim.e.obj.set(0, 0.25); anim.e.cierre = 0.2;
    if (cada(0.5)) { soltarFigura(['♪|#ffcf3f', '♫|#e5484d', '♪|#4fb06d'][Math.floor(a.t / 0.5) % 3], { tam: 0.24 }); son('tarareo', Math.floor((a.t - 1.6) / 0.5)); }
    return aCam;
  } };

  /* ---- tele / consola / acuario */
  const VER = { t: 'ver', d: 6, acerca: 'frente', dist: 0.9 }, VIDEOJUEGO = { t: 'videojuego', d: 10, p: 2, acerca: 'frente', dist: 0.9 };
  // tele: sentadita viendo caricaturas, se ríe a carcajadas; la pantalla cambia de colores
  const CARICATURA = { t: 'caricatura', d: 8, p: 2, acerca: 'frente', dist: 0.9,
    paso: ({ o, a }) => pieza(o, 'pantalla')?.material.emissive.setHSL((a.t * 0.12) % 1, 0.7, 0.62), fin: ({ o }) => pieza(o, 'pantalla')?.material.emissive.set(0xffffff),
    hacer: ({ a, t, k }) => {
      const u = a.t % 2.8, r = u > 1.6 ? Math.sin(((u - 1.6) / 1.2) * Math.PI) : 0; if (cada(2.8)) son('tele');   // un efecto de caricatura... y luego la carcajada
      pivote.scale.set(1 + 0.05 * k, 1 - 0.1 * k + 0.03 * r * Math.sin(t * 30), 1 + 0.05 * k);
      pivote.rotation.x = -0.22 * r; brazosPose(-0.7 - 0.3 * r, -0.38 * r + 0.1); anim.e.obj.set(Math.sin(t * 0.9) * 0.2, 0.3);
      if (r > 0.3) { anim.e.cierre = 0.2; if (cada(0.35)) soltarFigura(Math.random() < 0.5 ? 'ja' : 'je', { tam: 0.22 }); }
    } };
  // consola: el videojuego de siempre, y cuando gana la pantalla destella
  const JUEGO_CONSOLA = { ...VIDEOJUEGO, paso: ({ o, a }) => { const p = pieza(o, 'pantalla'); if (p) p.material.emissiveIntensity = a.t % 4.5 > 3.9 ? 1.5 + Math.sin(a.t * 30) * 0.4 : 0.9; },
    fin: ({ o }) => { const p = pieza(o, 'pantalla'); if (p) p.material.emissiveIntensity = 0.9; } };
  // acuario: toca el vidrio con el dedo y los peces salen disparados; salen burbujitas
  const TOCAR_VIDRIO = { t: 'tocarVidrio', d: 6, p: 2, acerca: 'frente', dist: 0.45,
    paso: ({ a, dt }) => { a.prisa = Math.max(0, (a.prisa || 0) - dt * 0.9); cuarto.userData.pecesExtra = (cuarto.userData.pecesExtra || 0) + dt * 5 * a.prisa; },
    hacer: ({ a, t, o }) => {
      const f = (a.t % 1.3) / 1.3; pivote.rotation.x = 0.14 * suave(a.t / 0.5);
      brazosPose(f < 0.2 ? -1.4 - 0.4 * (f / 0.2) : -1.8 + 0.4 * Math.min(1, (f - 0.2) / 0.2), 0.12);
      if (a.t > 0.4 && cada(1.3)) { a.prisa = 1; son('vidrio'); if (o) for (let i = 0; i < 3; i++) soltarFigura('o', { mundo: enMundo(o, azar(-0.3, 0.3), 0.85, 0.05), tam: azar(0.06, 0.1), vy: 0.3, vx: 0, dur: 1.2 }); }
      anim.e.obj.set(Math.sin(t * 3) * 0.8 * (a.prisa || 0), 0.35);
      if (a.prisa > 0.5 && cada(0.5)) soltarFigura(risa(), { tam: 0.2 });
    } };

  /* ---- decoraciones */
  const SALUDAR = { t: 'saludar', d: 3.5 };
  // calabaza: toc, toc... la calabaza se tambalea y al final brinca de risa
  const TOCTOC = { t: 'tocToc', d: 5.2, p: 2, dist: 0.35,
    paso: ({ o, a, dt }) => { a.golpe = Math.max(0, (a.golpe || 0) - dt * 1.5); menear(o, Math.sin(a.t * 15) * 0.07 * a.golpe); apretar(o, 1, 1 + 0.08 * Math.abs(Math.sin((a.t - 3.3) * 10)) * curva(a.t, 3.3, 3.5, 4.4, 4.8)); },
    fin: ({ o }) => { menear(o, 0); apretar(o, 1, 1); },
    hacer: ({ a, aCam }) => {
      const f = ((a.t - 0.5) % 0.9) / 0.9, toca = a.t > 0.5 && a.t < 3.2;
      if (toca) { brazosPose(-1.1, 0.15); const b = m.brazos?.[1]; if (b) b.rotation.x = f < 0.3 ? -1.1 - 0.7 * (f / 0.3) : -1.8 + 0.7 * Math.min(1, (f - 0.3) / 0.15); pivote.rotation.x = 0.12; anim.e.obj.set(0, -0.1); }
      const n = a.t > 0.9 ? Math.min(3, Math.floor((a.t - 0.9) / 0.9) + 1) : 0;
      if (n !== (a.n ?? 0)) { a.n = n; a.golpe = 1; soltarFigura('toc', { mundo: a.centro.clone().setY(0.8), tam: 0.2, vy: 0.3, vx: 0 }); }
      if (a.t >= 3.2) { pivote.rotation.x = 0; brazosPose(-0.7, -0.4); if (!a.feliz) { a.feliz = true; soltarFigura('?', { tam: 0.24 }); } if (a.t > 3.4 && cada(0.6)) soltarFigura(risa(), { tam: 0.22 }); return aCam; }
    } };
  // pastel: toma aire, sopla la vela (se apaga con humito), pide un deseo con los ojos cerrados... y la vela se vuelve a prender
  const SOPLAR = { t: 'soplar', d: 5.6, p: 2, dist: 0.32,
    paso: ({ o, a }) => { const p = o.userData.piezas, on = !(a.t > 1.3 && a.t < 4.4); if (p) { p.flama.visible = on; p.hFlama.visible = on; }
      if (!on && !a.humo) { a.humo = true; for (let i = 0; i < 3; i++) soltarFigura('humo', { mundo: enMundo(o, 0, 0.84 + i * 0.05, 0), tam: 0.12, vy: 0.2, vx: 0, dur: 1.4 }); } },
    fin: ({ o }) => { const p = o.userData.piezas; if (p) { p.flama.visible = true; p.hFlama.visible = true; } },
    hacer: ({ a, K }) => {
      if (a.t < 1.0) { if (!a.sInsp) { a.sInsp = true; son('inspira'); } const e = suave(a.t / 0.8); pivote.rotation.x = 0.3 * e; pivote.scale.set(1 + 0.08 * e, 1 - 0.02 * e, 1 + 0.04 * e); anim.e.obj.set(0, -0.3); return; }   // toma aire (se infla)
      if (a.t < 1.7) { pivote.rotation.x = 0.35; pivote.scale.set(0.97, 1, 1); if (!a.sSopla) { a.sSopla = true; son('soplido'); }
        if (cada(0.08)) { const [vx, vz] = hacia(pivote.position, a.centro, 0.9); soltarFigura('humo', { y: 1.0 * K, z: 0.55 * K, x: 0, vx, vz, vy: -0.05, tam: azar(0.08, 0.13), dur: 0.7 }); } return; }
      pivote.rotation.x *= 0.9; pivote.scale.set(1, 1, 1);
      if (a.t < 4.2) { brazosPose(-1.5, -0.48); anim.e.cierre = 0.2; anim.e.obj.set(0, 0.3); if (cada(0.6)) soltarFigura('★', { tam: 0.2 }); return; }   // pide un deseo
      if (!a.feliz) { a.feliz = true; anim.e.salto = 0.8; soltarFigura('♥'); soltarFigura('♥', { tam: 0.24 }); son('deseo'); }
    } };
  // calabazas: se esconde detrás de la pila (del lado que no ve la cámara), se asoma a los lados... ¡Bu!
  const ESCONDITE = { t: 'escondite', d: 6, p: 2,
    en: (o) => { const c = cajaMueble(o), m0 = c.getCenter(new THREE.Vector3()).setY(0), dir = m0.clone().sub(camara.position).setY(0).normalize();
      const w = m0.addScaledVector(dir, Math.max(c.max.x - c.min.x, c.max.z - c.min.z) / 2 + 0.2 + escK() * 0.5), l = o.worldToLocal(w); return [l.x, l.z]; },
    hacer: ({ a, t, aCam }) => {
      if (a.t < 3.4) { const e = suave(a.t / 0.4), lado = Math.sin(a.t * 1.9); pivote.scale.set(1 + 0.08 * e, 1 - 0.3 * e, 1 + 0.08 * e); pivote.rotation.z = lado * 0.22 * e;
        anim.e.obj.set(lado * 0.7, 0.1); brazosPose(-1.2 * e, -0.3 * e); if (a.t > 1 && cada(1.1)) { soltarFigura('♪|#ff9a3c', { tam: 0.16 }); son('risita', 0.5); } return aCam; }
      if (!a.bu) { a.bu = true; anim.e.salto = 1; soltarFigura('¡Bu!', { tam: 0.34, vy: 0.4, vx: 0 }); }
      pivote.scale.set(1, 1, 1); pivote.rotation.z = 0; brazosPose(-2.6, 0.6); anim.e.obj.set(0, 0.3);
      if (a.t > 4.3 && cada(0.6)) soltarFigura(risa(), { tam: 0.22 });
      return aCam;
    } };
  // fantasma: se infla y le hace ¡BU!; brinca del susto, tiembla y luego se ríen juntos
  const BU = { t: 'bu', d: 5.6, p: 2, dist: 0.4, paso: ({ o, a }) => fxM(o, curva(a.t, 1.2, 1.5, 2.6, 3.4)), fin: ({ o }) => fxM(o, 0), hacer: ({ a, t, o, aCam }) => {
    if (a.t < 1.5) { pivote.rotation.x = 0.15 * suave(a.t / 0.5); anim.e.obj.set(Math.sin(t * 2) * 0.3, 0); return; }
    if (!a.bu) { a.bu = true; if (o) soltarFigura('¡BU!', { mundo: enMundo(o, 0, 0.95, 0.1), tam: 0.36, vy: 0.3, vx: 0 }); }
    if (a.t < 1.75) return;
    if (!a.susto) { a.susto = true; anim.e.salto = 1; soltarFigura('!', { tam: 0.36 }); son('grito'); }
    if (a.t < 3.3) { pivote.rotation.x = -0.3; pivote.rotation.z = Math.sin(t * 32) * 0.05; brazosPose(-2.7, 0.6); anim.e.obj.set(0, 0.4); return; }
    pivote.rotation.x *= 0.85; pivote.rotation.z = 0; brazosPose(-0.7 + Math.sin(t * 12) * 0.2, -0.4);
    if (cada(0.6)) soltarFigura(risa(), { tam: 0.22 });
    if (a.t > 4.2 && !a.adios) { a.adios = true; anim.e.saludo = 1.2; }
    return a.t > 4.2 ? aCam : undefined;
  } };
  // caldero: menea la poción con el cucharón, burbujas verdes... ¡puf! sale una nube de destellos
  const POCION = { t: 'pocion', d: 6.5, p: 2, dist: 0.3, prop: 'cucharon', paso: ({ o, a, dt }) => { if (a.t < 4.8) masT(o, dt, 3); }, hacer: ({ a, t, K, o }) => {
    if (a.t < 4.8) {
      const g = t * 4; pivote.rotation.x = 0.18; pivote.rotation.z = Math.sin(g) * 0.05; brazosPose(-1.15 + Math.sin(g) * 0.15, 0.15 + Math.cos(g) * 0.08);
      if (a.prop) { a.prop.position.x = Math.cos(g) * 0.1 * K; a.prop.position.z = (0.85 + Math.sin(g) * 0.06) * K; }
      anim.e.obj.set(Math.cos(g) * 0.3, -0.4);
      if (cada(0.6)) son('burbujeo');
      if (o && cada(0.22)) soltarFigura(Math.random() < 0.7 ? 'o|#8dff6e' : 'o|#c6ffb0', { mundo: enMundo(o, azar(-0.15, 0.15), 0.72, azar(-0.15, 0.15)), tam: azar(0.08, 0.16), vy: azar(0.25, 0.45), vx: azar(-0.06, 0.06), dur: 1.6 });
      return;
    }
    if (!a.puf) { a.puf = true; anim.e.salto = 0.8; son('puf'); if (a.prop) a.prop.visible = false;
      if (o) for (let i = 0; i < 8; i++) soltarFigura(i % 2 ? 'chispa|#7dff6a' : '★', { mundo: enMundo(o, 0, 0.8, 0), tam: 0.18, vx: azar(-0.5, 0.5), vy: azar(0.3, 0.8), dur: 1.4 }); }
    pivote.rotation.x *= 0.9; pivote.rotation.z = 0; brazosPose(-2.5, 0.5); anim.e.obj.set(0, 0.6);
  } };
  // regalos: agarra un regalito, lo sacude y lo oye... lo abre: la tapa sale volando entre confeti; los de la pila brincan
  const REGALO = { t: 'regalo', d: 6.5, p: 2, dist: 0.4, prop: 'regalo', paso: ({ o, a }) => fxM(o, a.t < 2.6 ? 1 : 0), fin: ({ o }) => fxM(o, 0), hacer: ({ a, t, K, aCam }) => {
    if (a.t < 2.6) { brazosPose(-1.3, 0.2); anim.e.obj.set(0.5, 0); const s = a.t > 0.5 ? 1 : 0;
      if (a.prop) { a.prop.rotation.z = Math.sin(t * 24) * 0.22 * s; a.prop.position.x = Math.sin(t * 24) * 0.03 * K * s; }
      if (a.t > 0.5 && cada(0.45)) son('sonaja');   // lo sacude: ¿qué será?
      if (a.t > 0.6 && cada(0.8)) soltarFigura('?', { tam: 0.2 }); return aCam; }
    if (!a.abierto) { a.abierto = true; anim.e.salto = 0.6; son('abrirRegalo'); const p0 = a.prop ? a.prop.getWorldPosition(new THREE.Vector3()) : pivote.position.clone().setY(1);
      for (let i = 0; i < 9; i++) soltarFigura(['chispa|#ff5c6c', 'chispa|#ffd34d', 'chispa|#6fb6ff', 'chispa|#7be08a', '★'][i % 5], { mundo: p0, tam: azar(0.12, 0.2), vx: azar(-0.5, 0.5), vy: azar(0.4, 0.9), dur: 1.5 }); }
    const tapa = a.prop?.userData.tapa, u = a.t - 2.6;
    if (tapa) { tapa.position.set(0.25 * u, 0.11 + 1.3 * u - 1.6 * u * u, 0); tapa.rotation.z = -u * 5; tapa.visible = u < 0.9; }
    brazosPose(-1.3, -0.3 + Math.sin(t * 8) * 0.05); anim.e.obj.set(0, -0.2);
    if (u > 0.6 && cada(0.7)) soltarFigura('♥', { tam: 0.22 });
    return aCam;
  } };
  // muñeco de nieve: junta nieve, hace una bola y se la avienta: ¡paf!, copos y el muñeco se tambalea; ella se ríe
  const BOLA_NIEVE = { t: 'bolaNieve', d: 6.5, p: 2, prop: 'bolaNieve',
    en: (o) => {   // a un lado del muñeco (de perfil a la cámara), a buena distancia para aventarle la bola
      const c = cajaMueble(o), m0 = c.getCenter(new THREE.Vector3()).setY(0), d = m0.clone().sub(camara.position).setY(0).normalize(), lat = new THREE.Vector3(d.z, 0, -d.x);
      const r = Math.max(c.max.x - c.min.x, c.max.z - c.min.z) / 2 + 0.55 + escK() * 0.5;
      for (const k of [0, 0.3, 0.6, 0.9]) for (const s of [1, -1]) {   // de perfil; si no cabe, girando hacia atrás (lado del cuarto)
        const w = m0.clone().addScaledVector(lat, s * r * Math.cos(k)).addScaledVector(d, r * Math.sin(k)); if (libre(w.x, w.z)) { const l = o.worldToLocal(w); return [l.x, l.z]; } }
      return null; },
    paso: ({ o, a, dt }) => { a.golpe = Math.max(0, (a.golpe || 0) - dt * 1.2); menear(o, Math.sin(a.t * 14) * 0.07 * a.golpe); }, fin: ({ o }) => menear(o, 0),
    hacer: ({ a, t, K }) => {
      if (a.t < 1.5) { if (cada(0.4)) son('nieve'); const e = suave(a.t / 0.4); pivote.rotation.x = 0.5 * e; pivote.scale.set(1, 1 - 0.1 * e, 1); brazosPose(-0.7, 0.05); anim.e.obj.set(0, -0.6);
        if (a.prop) { a.prop.scale.setScalar(a.prop.userData.s0 * (0.3 + 0.7 * suave(a.t / 1.4))); a.prop.position.y = 0.55 * K; } return; }
      if (a.t < 2.2) { pivote.rotation.x = -0.15; pivote.scale.set(1, 1, 1); brazosPose(-0.8, 0.1); const b = m.brazos?.[1]; if (b) b.rotation.x = -2.9;   // toma vuelo
        if (a.prop) a.prop.position.set(0.25 * K, 1.5 * K, -0.1 * K); anim.e.obj.set(0, 0.2); return; }
      if (!a.lanzo) { a.lanzo = true; son('avienta'); if (a.prop) a.prop.visible = false;
        const T = 0.6, d = Math.max(0.3, Math.hypot(a.centro.x - pivote.position.x, a.centro.z - pivote.position.z) - 0.2), [vx, vz] = hacia(pivote.position, a.centro, d / T);
        soltarFigura('bola', { x: 0.2 * K, y: 1.3 * K, z: 0.3 * K, vx, vz, vy: 0.9, cae: true, grav: 3.0, tam: 0.17, dur: T + 0.1 }); a.tGolpe = a.t + T; }
      pivote.rotation.x = 0.1; brazosPose(-1.6, 0.2);
      if (a.t > a.tGolpe && !a.pego) { a.pego = true; a.golpe = 1; son('paf'); for (let i = 0; i < 7; i++) soltarFigura('copo', { mundo: _vh.copy(a.centro).setY(0.75), tam: 0.12, vx: azar(-0.5, 0.5), vy: azar(0.2, 0.7), dur: 1.2, gira: 2 }); }
      if (a.pego) { brazosPose(-0.7 + Math.sin(t * 12) * 0.2, -0.4); pivote.rotation.x = 0; if (cada(0.6)) soltarFigura(risa(), { tam: 0.22 }); }
    } };

  const ACTIVIDADES = {
    cama: { _: CAMA, nube: [...CAMA, FLOTAR], gamer: [...CAMA, CONSOLITA], princesa: [...CAMA, PRINCESA] },
    sillon: { _: SILLON, puff: [...SILLON, HUNDIRSE], sofa: [...SILLON, CHOCOLATE], trono: [...SILLON, REINAR] },
    tech: { _: [VIDEOJUEGO, VER], tele: [CARICATURA, VER], consola: [JUEGO_CONSOLA, { ...VER, d: 6 }],
      acuario: [{ t: 'peces', d: 6, p: 2, acerca: 'frente', dist: 0.45 }, TOCAR_VIDRIO, { t: 'ver', d: 5, acerca: 'frente', dist: 0.7 }] },
    planta: { _: [REGAR, OLER], maceta: [REGAR, OLER, ESTORNUDO], cactus: [REGAR, PICARSE], sakura: [REGAR, OLER, PETALOS], navidad: [REGAR, ADORNO] },
    tapete: { _: TAPETE, redondo: [...TAPETE, VUELTAS], oso: [...TAPETE, OSITO, SIESTA_OSO], arcoiris: [...TAPETE, ARCOIRIS], navidad: [...TAPETE, NEVADA], mn: [...TAPETE, PORRA_MN] },
    lampara: { _: [{ t: 'mirarArriba', d: 4 }, APAGAR], pie: [{ t: 'mirarArriba', d: 4 }, APAGAR, CADENITA], hongo: [{ t: 'mirarArriba', d: 4 }, APAGAR, ESPORAS],
      luna: [{ t: 'mirarArriba', d: 4 }, APAGAR, AULLAR], calabaza: [{ t: 'mirarArriba', d: 4 }, APAGAR, SUSTO] },
    cuadro: { _: [{ t: 'mirarCuadro', d: 4.5, p: 2 }, { t: 'pintar', d: 6.5 }], paisaje: [{ t: 'mirarCuadro', d: 4.5 }, { t: 'pintar', d: 6.5 }, RESPIRAR],
      reloj: [{ t: 'mirarCuadro', d: 5 }, CUCU], neon: [{ t: 'mirarCuadro', d: 4.5 }, NEON], telarana: [{ t: 'mirarCuadro', d: 4.5 }, ARANA],
      murcielagos: [{ t: 'mirarCuadro', d: 4.5 }, MURCIELAGOS], botas: [{ t: 'mirarCuadro', d: 4.5 }, BOTAS], corona: [{ t: 'mirarCuadro', d: 4.5 }, VILLANCICO] },
    deco: { _: [SALUDAR],
      peluche: [{ t: 'abrazar', d: 4.5, p: 2, dist: 0.3, paso: ({ o, a }) => { const s = Math.max(0, Math.sin(a.t * 3)) * Math.min(1, a.t / 0.6); apretar(o, 1 + 0.05 * s, 1 - 0.07 * s); }, fin: ({ o }) => apretar(o, 1, 1) }, SALUDAR],
      pinata: [{ t: 'golpear', d: 4.5, dist: 0.35, paso: ({ o, a }) => menear(o, Math.sin(a.t * 6) * 0.12 * (a.golpe ?? 0)), fin: ({ o }) => menear(o, 0) }],
      trofeo: [{ t: 'presumir', d: 4, paso: ({ o, dt }) => { fxM(o, 1); masT(o, dt, 5); }, fin: ({ o }) => fxM(o, 0) }],
      pastel: [{ ...OLER, paso: null, fin: null }, SOPLAR, SALUDAR], calabaza: [TOCTOC, SALUDAR], calabazas: [ESCONDITE, SALUDAR], fantasma: [BU, SALUDAR],
      caldero: [POCION, SALUDAR], regalos: [REGALO, SALUDAR], nieve: [BOLA_NIEVE, SALUDAR] },
  };
  const VENTANA = new THREE.Vector3(1.0, 2.35, -2.97);   // asomarse por la ventana del fondo (ventanaCuarto)
  // 'libres' se hacen donde esté parada; si: solo cuando aplica (ánimo, suciedad); p: peso
  const LIBRES = [{ t: 'galleta', d: 5 }, { t: 'burbujas', d: 6 }, { t: 'musica', d: 7 }, { t: 'girar', d: 2.6 }, { t: 'estirarse', d: 4.5 }, { t: 'ejercicio', d: 5 },
    { t: 'dormir', d: 9, si: () => !cuarto.userData.muebles?.cama },   // siesta en el piso, solo si no hay cama
    { t: 'panza', d: 4, p: 3, si: () => op.mascota?.animo === 'hambre' }, { t: 'bostezo', d: 3.5, p: 2, si: () => cuarto.userData.noche },
    { t: 'mosca', d: 5, p: 2, si: () => hig.suciedad >= 60 }];
  const sortear = (lista) => {
    const pesos = lista.map((x) => (x.p ?? 1) * (x.t === 'dormir' && cuarto.userData.noche ? 3 : 1));
    let r = Math.random() * pesos.reduce((s, x) => s + x, 0);
    for (let i = 0; i < lista.length; i++) if ((r -= pesos[i]) <= 0) return lista[i];
    return lista.at(-1);
  };
  const listaDe = (lugar) => { const L0 = ACTIVIDADES[lugar]; return L0 && (L0[op.muebles?.[lugar]] || L0._); };
  /* que se lea desde la cámara: junto al mueble de 3/4 (de lado a él, con la cara hacia la cámara) y sin que nada la tape */
  const difAng = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const GIRO_MAX = 0.8;   // lo más que da la espalda a la cámara al ver un mueble (rad; 0 = de frente, 1.57 = de perfil)
  const _rayo = new THREE.Ray();
  const tapada = (x, z, alto, sin) => {   // ¿un mueble queda entre ese punto y la cámara?
    _rayo.origin.set(x, alto, z); _rayo.direction.copy(camara.position).sub(_rayo.origin).normalize();
    for (const [lugar, o] of Object.entries(cuarto.userData.muebles || {})) {
      if (lugar === 'tapete' || lugar === 'cuadro' || lugar === sin) continue;
      if (_rayo.intersectsBox(cajaMueble(o))) return true;
    }
    return false;
  };
  // qué tan bien se ve parada en (x, z) viendo a mira: el mueble de lado (f ≈ ideal), sin taparse, y no muy lejos de donde está
  const vistosa = (x, z, mira, ideal = 1.3) => {
    const K = escK(), f = Math.abs(difAng(Math.atan2(mira.x - x, mira.z - z), Math.atan2(camara.position.x - x, camara.position.z - z)));
    let s = Math.abs(f - ideal) + Math.hypot(x - pivote.position.x, z - pivote.position.z) * 0.06;
    if (tapada(x, z, 1.55 * K)) s += 3; if (tapada(x, z, 0.75 * K)) s += 0.7;
    return s;
  };
  const mejorPunto = (cands, mira, ideal) => {
    let mejor = null, mS = Infinity;
    for (const p of cands) { const s = vistosa(p.x, p.z, mira, ideal); if (s < mS) { mS = s; mejor = p; } }
    return mejor;
  };
  const actividadEn = (solo, tipo) => {
    const opciones = Object.entries(cuarto.userData.muebles || {}).filter(([lugar]) => listaDe(lugar) && (!solo || lugar === solo));
    if (!opciones.length) return null;
    const [lugar, o] = opciones[Math.floor(Math.random() * opciones.length)];
    const lista = listaDe(lugar).filter((x) => !tipo || x.t === tipo); if (!lista.length) return null;
    const def = sortear(lista), act = [def.t, def.d];
    o.updateMatrixWorld(true);
    const caja = cajaMueble(o), centro = caja.getCenter(new THREE.Vector3());
    const arriba = !!def.arriba && !!(o.userData.colchon || o.userData.asiento), r = { lugar, act, def, centro, arriba };
    if (def.en) {   // un punto propio del mueble (junto a la cabeza del osito, detrás de las calabazas...)
      const e = typeof def.en === 'function' ? def.en(o) : def.en; if (!e) return null;
      const w = o.localToWorld(new THREE.Vector3(e[0], 0, e[1])).setY(0), c2 = def.mira ? o.localToWorld(new THREE.Vector3(...def.mira)) : centro;
      return libreSin(w.x, w.z, lugar) ? { ...r, centro: c2, punto: w } : null;
    }
    if (def.acerca === 'centro') return libre(centro.x, centro.z) ? { ...r, punto: new THREE.Vector3(centro.x, 0, centro.z) } : null;
    if (lugar === 'cama' && o.userData.colchon) {   // a un lado del colchón (o a los pies), el lado libre más cercano: de ahí brinca
      const cands = [];
      for (const dd of [0.6, 0.8, 1.05]) for (const [x, z] of [[0.83 + dd, 0.2], [-0.83 - dd, 0.2], [0, 1.1 + dd]]) {
        const w = o.localToWorld(new THREE.Vector3(x, 0, z)).setY(0); if (libre(w.x, w.z)) cands.push(w);
      }
      cands.sort((p, q) => p.distanceTo(pivote.position) - q.distanceTo(pivote.position));
      if (cands.length) return { ...r, punto: cands[0] };
    }
    const medio = Math.max(caja.max.x - caja.min.x, caja.max.z - caja.min.z) / 2;
    if (def.acerca === 'frente') {   // frente a la pantalla / al asiento (hacia donde mira el mueble), en su eje
      const fr = new THREE.Vector3(0, 0, 1).applyQuaternion(o.quaternion).setY(0).normalize(), base = o.position.clone().setY(0);
      const prof = Math.abs(caja.max.x - caja.min.x) * Math.abs(fr.x) + Math.abs(caja.max.z - caja.min.z) * Math.abs(fr.z);   // profundidad aprox. en el eje del frente
      const cands = [];
      for (const ex of [0, -0.2, 0.3]) for (const lat of [0, 0.35, -0.35, 0.7, -0.7]) {
        const p = base.clone().addScaledVector(fr, Math.min(prof, medio * 2) / 2 + (def.dist ?? 0.6) + ex).addScaledVector(new THREE.Vector3(fr.z, 0, -fr.x), lat);
        if (libre(p.x, p.z)) { if (arriba) return { ...r, punto: p }; cands.push(p); }
      }
      // en el piso (tele, acuario): de los lugares de enfrente, el que se ve de 3/4 desde la cámara
      return cands.length ? { ...r, punto: mejorPunto(cands, centro, 1.25) } : null;   // no hay lugar enfrente: no lo hace de lado
    }
    if (lugar === 'cuadro') {   // pegadita a la pared, un poco a un lado del cuadro (no debajo), para verlo hacia arriba
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(o.quaternion).setY(0).normalize(), lat = new THREE.Vector3(n.z, 0, -n.x), base = o.position.clone().setY(0);
      const cands = [];
      for (const d of [0.4, 0.5, 0.62]) for (let l = -1.1; l <= 1.1; l += 0.2) { const p = base.clone().addScaledVector(n, d + escK() * 0.35).addScaledVector(lat, l); if (libre(p.x, p.z, null, 2.62)) cands.push(p); }
      return cands.length ? { ...r, punto: mejorPunto(cands, centro, 1.2) } : null;
    }
    // un punto libre a su lado, el que mejor se ve desde la cámara (de lado al mueble, con la cara visible)
    const radio0 = medio + (def.dist ?? 0.55) + (escK() - 0.5) * 0.5, cerca0 = def.dist !== undefined && def.dist < 0.45;   // una mascota grande se para un poco más lejos
    const cands = [];
    for (const radio of [radio0, radio0 + 0.25]) for (let i = 0; i < 24; i++) {
      const b = (i / 24) * Math.PI * 2, x = centro.x + Math.sin(b) * radio, z = centro.z + Math.cos(b) * radio;
      if (cerca0 ? Math.abs(x) <= 2.3 && Math.abs(z) <= 2.3 && libreSin(x, z, lugar) : libre(x, z)) cands.push(new THREE.Vector3(x, 0, z));
      if (radio > radio0 && cands.length > 3) break;
    }
    return cands.length ? { ...r, punto: mejorPunto(cands, centro) } : null;
  };
  // asomarse por la ventana: un punto libre frente a ella (si un mueble lo tapa, no)
  const libreAqui = (l) => {
    const frente = pivote.position.clone().add(new THREE.Vector3(Math.sin(pivote.rotation.y), 0, Math.cos(pivote.rotation.y)));
    paseo.act = { lugar: 'libre', act: [l.t, l.d], def: l, fase: 'hacer', t: 0, centro: frente };
  };
  const actividadVentana = () => {
    for (const z of [-2.15, -1.85]) for (const x of [1.0, 0.65, 0.3, 1.4, -0.05]) if (libre(x, z)) return { lugar: 'ventana', act: ['asomarse', 5], def: {}, centro: VENTANA.clone(), punto: new THREE.Vector3(x, 0, z) };
    return null;
  };
  // ver su popó con asco: se acerca (sin pisarla) y hace cara de fuchi
  const actividadPopo = () => {
    const p = gPopos.children.find((x) => x.userData.recoger === undefined); if (!p) return null;
    for (let i = 0; i < 8; i++) {
      const b = Math.atan2(pivote.position.x - p.position.x, pivote.position.z - p.position.z) + (i ? (Math.random() - 0.5) * 2 : 0);
      const x = p.position.x + Math.sin(b) * 0.8, z = p.position.z + Math.cos(b) * 0.8;
      if (libre(x, z)) return { lugar: 'popo', act: ['asco', 4], def: {}, centro: p.position.clone(), punto: new THREE.Vector3(x, 0, z) };
    }
    return null;
  };
  /* ---- objetos en las manos (en el marco del pivote: la mascota mira a +Z) y figuritas flotantes */
  const escK = () => m.raiz.scale.x;   // tamaño de la mascota en el cuarto
  const accesorio = (tipo) => {
    const g = new THREE.Group(), k = escK();
    if (tipo === 'videojuego') {   // control de videojuego con cruceta y botones de colores
      const cuerpoC = clay(0x4b3f72, { roughness: 0.4, clearcoat: 0.6 });
      g.add(malla(cajaR(0.42, 0.13, 0.12, 0.05, 3), cuerpoC));
      for (const s of [-1, 1]) g.add(malla(esf(0.085, 14), cuerpoC, { pos: [s * 0.2, -0.05, 0], esc: [1, 1.3, 1] }));
      g.add(malla(new THREE.BoxGeometry(0.09, 0.025, 0.02), clay(0x222233), { pos: [-0.12, 0.0, 0.065] }));
      g.add(malla(new THREE.BoxGeometry(0.025, 0.09, 0.02), clay(0x222233), { pos: [-0.12, 0.0, 0.065] }));
      [[0x5ad36b, 0.12, 0.03], [0xff5c8a, 0.155, 0.0], [0x3ec3ff, 0.085, 0.0], [0xffd43b, 0.12, -0.03]].forEach(([c, x, y]) =>
        g.add(malla(esf(0.02, 10), brillo(c), { pos: [x, y, 0.06] })));
      g.position.set(0, 0.86 * k, 0.78 * k); g.rotation.x = -0.6;
    } else if (tipo === 'leer') {   // libro abierto
      for (const s of [-1, 1]) {
        const h = new THREE.Group(); h.rotation.y = s * 0.35; g.add(h);
        h.add(malla(cajaR(0.22, 0.3, 0.02, 0.01, 2), clay(0xe8453c), { pos: [s * 0.11, 0, 0] }));
        h.add(malla(cajaR(0.2, 0.28, 0.02, 0.005, 1), clay(0xfffaf0), { pos: [s * 0.105, 0, 0.018] }));
      }
      g.position.set(0, 0.95 * k, 0.8 * k); g.rotation.x = -0.5;
    } else if (tipo === 'regar') {   // regadera
      const azul = clay(0x5b9cff);
      g.add(malla(cil(0.1, 0.11, 0.2, 18), azul));
      g.add(malla(cil(0.018, 0.025, 0.26, 10), azul, { pos: [0, 0.03, 0.17], rot: [1.1, 0, 0] }));
      g.add(malla(new THREE.TorusGeometry(0.08, 0.018, 8, 16, Math.PI), azul, { pos: [0, 0.1, -0.02], rot: [0, Math.PI / 2, 0] }));
      g.position.set(0.32 * k, 0.75 * k, 0.65 * k); g.rotation.x = 0.5;
    } else if (tipo === 'galleta') {   // galleta con chispas
      g.add(malla(cil(0.13, 0.13, 0.04, 22), clay(0xd99a52), { rot: [Math.PI / 2, 0, 0] }));
      for (let i = 0; i < 6; i++) g.add(malla(esf(0.018, 6), clay(0x5a3a22), { pos: [Math.cos(i * 2.1) * 0.07, Math.sin(i * 2.1) * 0.07, 0.022] }));
      g.position.set(0.18 * k, 1.05 * k, 1.05 * k); g.rotation.x = -0.4;
    } else if (tipo === 'musica') {   // audífonos grandes
      const mor = clay(0x7c6cff);
      g.add(malla(new THREE.TorusGeometry(0.62, 0.05, 10, 32, Math.PI), mor));
      for (const s of [-1, 1]) g.add(malla(cil(0.17, 0.17, 0.12, 20), clay(0xff8fb8), { pos: [s * 0.62, -0.05, 0], rot: [0, 0, Math.PI / 2] }));
      g.position.set(0, 1.65 * k, 0); g.scale.setScalar(k * 1.15);
      return g;
    } else if (tipo === 'pintar') {   // pincel con la punta de color
      g.add(malla(cil(0.022, 0.022, 0.42, 10), clay(0xc98b5a)));
      g.add(malla(new THREE.ConeGeometry(0.045, 0.12, 12), clay(0xff6f91), { pos: [0, 0.27, 0] }));
      g.position.set(0.36 * k, 1.05 * k, 0.6 * k); g.rotation.set(0.9, 0, -0.5);
    } else if (tipo === 'ejercicio') {   // pesitas
      for (const s of [-1, 1]) {
        const p = new THREE.Group(); p.position.set(s * 0.4, 0, 0); g.add(p);
        p.add(malla(cil(0.025, 0.025, 0.24, 8), metal(0xc9ced6), { rot: [0, 0, Math.PI / 2] }));
        for (const e of [-1, 1]) p.add(malla(cil(0.07, 0.07, 0.05, 16), clay(0xff6b6b), { pos: [e * 0.1, 0, 0], rot: [0, 0, Math.PI / 2] }));
      }
      g.position.set(0, 0.7 * k, 0.5 * k);
    } else if (tipo === 'consolita') {   // consolita portátil con pantalla que brilla (cama gamer)
      g.add(malla(cajaR(0.36, 0.2, 0.05, 0.04, 3), clay(0xe9e4ff)));
      g.add(malla(new THREE.PlaneGeometry(0.17, 0.12), luz(0x7fe9ff), { pos: [0, 0.01, 0.027] }));
      g.add(malla(new THREE.BoxGeometry(0.05, 0.015, 0.012), clay(0x3d3a5c), { pos: [-0.135, 0, 0.03] }));
      g.add(malla(new THREE.BoxGeometry(0.015, 0.05, 0.012), clay(0x3d3a5c), { pos: [-0.135, 0, 0.03] }));
      for (const [c, y] of [[0xff4fd8, 0.025], [0x3ef0ff, -0.02]]) g.add(malla(esf(0.016, 8), luz(c), { pos: [0.135, y, 0.03] }));
      g.position.set(0, 0.86 * k, 0.78 * k); g.rotation.x = -0.7;
    } else if (tipo === 'taza') {   // taza de chocolatito con malvavisco (sofá)
      const rosa = clay(0xff9fb8);
      g.add(malla(cil(0.075, 0.065, 0.14, 18), rosa));
      g.add(malla(new THREE.TorusGeometry(0.04, 0.014, 6, 14), rosa, { pos: [0.08, 0, 0] }));
      g.add(malla(cil(0.066, 0.066, 0.01, 18), clay(0x7a4a32), { pos: [0, 0.062, 0] }));
      g.add(malla(cajaR(0.04, 0.03, 0.04, 0.012), clay(0xffffff), { pos: [0.02, 0.07, 0.01], rot: [0, 0.5, 0] }));
      g.position.set(0, 0.9 * k, 0.72 * k);
    } else if (tipo === 'esfera') {   // esfera de Navidad para colgarla en el arbolito
      g.add(malla(esf(0.07, 16), brillo(0xffd34d)));
      g.add(malla(cil(0.02, 0.02, 0.03, 8), metal(0xffcf3f), { pos: [0, 0.075, 0] }));
      g.add(malla(new THREE.TorusGeometry(0.015, 0.004, 4, 10), metal(0xffcf3f), { pos: [0, 0.098, 0] }));
      g.position.set(0.1 * k, 1.0 * k, 0.7 * k);
    } else if (tipo === 'cucharon') {   // cucharón de madera para menear la poción (caldero)
      g.add(malla(cil(0.018, 0.022, 0.55, 8), madera(0xc98f62), { pos: [0, 0.2, 0] }));
      g.add(malla(new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), madera(0xc98f62), { pos: [0, -0.07, 0] }));
      g.position.set(0, 0.85 * k, 0.85 * k); g.rotation.x = 0.5;
    } else if (tipo === 'regalo') {   // regalito con tapa que sale volando al abrirlo
      g.add(malla(cajaR(0.26, 0.2, 0.26, 0.03), clay(0x7fb8ff)));
      g.add(malla(cajaR(0.27, 0.205, 0.05, 0.015), tela(0xffffff))); g.add(malla(cajaR(0.05, 0.205, 0.27, 0.015), tela(0xffffff)));
      const tapa = g0(); tapa.position.y = 0.11; g.add(tapa);
      tapa.add(malla(cajaR(0.29, 0.05, 0.29, 0.02), clay(0x6aa8f5)));
      const mo = monoListon(0xff5c8a, 0.7); mo.position.y = 0.025; tapa.add(mo);
      g.userData.tapa = tapa;
      g.position.set(0, 0.95 * k, 0.75 * k);
    } else if (tipo === 'bolaNieve') {   // bola de nieve (crece al juntarla)
      g.add(malla(esf(0.09, 16), tela(0xffffff)));
      g.position.set(0, 0.85 * k, 0.75 * k);
    } else return null;
    g.scale.multiplyScalar(k / 0.6); g.userData.s0 = g.scale.x;
    return g;
  };
  // figuritas que flotan desde la cabeza: Z de dormir, notas, corazones, burbujas, estrellas, gotas
  const texFig = {};
  // 'forma|#color' cambia el color; las palabras ('ja', '¡Bu!', 'Auuu~') salen en una tarjeta ancha
  const FORMAS = new Set(['o', 'gota', 'copo', 'petalo', 'espora', 'chispa', 'bola', 'nube', 'humo', 'corona']);
  const figTex = (c) => texFig[c] ??= (() => {
    const [forma, col] = c.split('|'), ancho = !FORMAS.has(forma) && forma.length > 2;
    const cv = document.createElement('canvas'); cv.width = ancho ? 256 : 128; cv.height = 128; const x = cv.getContext('2d');
    const colores = { Z: '#7c6cff', '♪': '#ff6f91', '♫': '#4dabf7', '♥': '#ff5c8a', '★': '#ffc928', '!': '#ff922b', '?': '#4dabf7', ja: '#ff922b', je: '#ff6f91',
      '¡Achú!': '#4dabf7', '¡Bu!': '#8a5cff', '¡BU!': '#8a5cff', 'Auuu~': '#6a5acd', tic: '#6a5a8a', tac: '#6a5a8a', '¡Cucú!': '#ff6f91', toc: '#e06f26' };
    const radial = (c0, c1) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 62); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, c0); g.addColorStop(1, c1); return g; };
    if (forma === 'o' || forma === 'gota') {
      const g = x.createRadialGradient(52, 48, 6, 64, 64, 56); g.addColorStop(0, '#ffffff');
      if (col) { g.addColorStop(0.5, col + '88'); g.addColorStop(1, col + 'cc'); }
      else { g.addColorStop(0.5, forma === 'gota' ? 'rgba(90,170,255,.85)' : 'rgba(170,220,255,.35)'); g.addColorStop(1, forma === 'gota' ? 'rgba(60,140,255,.9)' : 'rgba(140,200,255,.6)'); }
      x.fillStyle = g; x.beginPath(); x.arc(64, 64, 54, 0, 7); x.fill();
      if (forma === 'o') { x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 5; x.stroke(); }
    } else if (forma === 'copo') {   // copito de nieve de seis puntas
      x.translate(64, 64); x.lineCap = 'round';
      for (const [w, s] of [[15, '#ffffff'], [7, col || '#8fd0ff']]) { x.strokeStyle = s; x.lineWidth = w;
        for (let i = 0; i < 6; i++) { x.save(); x.rotate(i * Math.PI / 3); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -50); x.moveTo(0, -30); x.lineTo(-15, -43); x.moveTo(0, -30); x.lineTo(15, -43); x.stroke(); x.restore(); } }
    } else if (forma === 'petalo') {   // pétalo de cerezo
      x.translate(64, 64); x.rotate(0.6); const g = x.createLinearGradient(0, -52, 0, 52); g.addColorStop(0, '#fff0f6'); g.addColorStop(1, col || '#ff9fc7');
      x.fillStyle = g; x.beginPath(); x.moveTo(0, 50); x.quadraticCurveTo(48, 0, 12, -50); x.lineTo(0, -38); x.lineTo(-12, -50); x.quadraticCurveTo(-48, 0, 0, 50); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 4; x.stroke();
    } else if (forma === 'espora' || forma === 'chispa') {   // lucecita que brilla / destello de 4 picos
      x.fillStyle = radial(col || '#fff1a8', 'rgba(255,255,255,0)'); x.fillRect(0, 0, 128, 128);
      if (forma === 'chispa') for (const [r, s] of [[60, '#ffffff'], [44, col || '#ffe27a']]) { x.fillStyle = s; x.beginPath();
        for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.2 : r, a = k * Math.PI / 4 - Math.PI / 2; x.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); } x.closePath();
        if (r > 50) { x.strokeStyle = 'rgba(90,60,120,.35)'; x.lineWidth = 4; x.stroke(); } x.fill(); }
    } else if (forma === 'bola') {   // bola de nieve
      const g = x.createRadialGradient(48, 44, 4, 64, 64, 56); g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#f2f8ff'); g.addColorStop(1, '#bcd8f2');
      x.fillStyle = g; x.beginPath(); x.arc(64, 64, 54, 0, 7); x.fill();
    } else if (forma === 'nube' || forma === 'humo') {   // nubecita (cama de nube, polvito) / humito (vela, chocolate)
      x.fillStyle = forma === 'nube' ? (col || 'rgba(255,255,255,.95)') : 'rgba(255,255,255,.6)';
      for (const [cx, cy, r] of [[40, 74, 26], [64, 58, 34], [90, 74, 24], [64, 82, 24]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
    } else if (forma === 'corona') {   // coronita dorada con joyas
      x.fillStyle = '#ffffff'; x.strokeStyle = '#ffffff'; x.lineWidth = 12; x.lineJoin = 'round';
      const pico = () => { x.beginPath(); x.moveTo(18, 100); x.lineTo(14, 40); x.lineTo(40, 66); x.lineTo(64, 26); x.lineTo(88, 66); x.lineTo(114, 40); x.lineTo(110, 100); x.closePath(); };
      pico(); x.stroke(); x.fillStyle = col || '#ffcf3f'; pico(); x.fill();
      x.fillStyle = '#ffe9a0'; x.fillRect(22, 84, 84, 10);
      for (const [cx, cy, cc] of [[64, 76, '#ff5c8a'], [36, 78, '#7fe9ff'], [92, 78, '#7fe9ff'], [14, 40, '#fff'], [64, 26, '#fff'], [114, 40, '#fff']]) { x.fillStyle = cc; x.beginPath(); x.arc(cx, cy, 7, 0, 7); x.fill(); }
    } else {
      let tam = 96; x.font = `bold ${tam}px system-ui, sans-serif`;
      const w = x.measureText(forma).width, cabe = cv.width - 16; if (w > cabe) { tam = Math.floor(tam * cabe / w); x.font = `bold ${tam}px system-ui, sans-serif`; }
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
      x.lineWidth = 10; x.strokeStyle = '#fff'; x.strokeText(forma, cv.width / 2, 68); x.fillStyle = col || colores[forma] || '#7c6cff'; x.fillText(forma, cv.width / 2, 68);
    }
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.userData.asp = cv.width / cv.height; TEXTURAS_FIJAS.add(tx); return tx;
  })();
  const figuras = [];
  const FIG_SON = { ja: ['risita', 0.8], je: ['risita', 0.8], '¡Achú!': ['estornudo'], 'Auuu~': ['aullido'], '¡Bu!': ['bu'], '¡BU!': ['fantasma'], tic: ['tic', 0], tac: ['tic', 1], '¡Cucú!': ['cucu'], toc: ['toc'] };
  const soltarFigura = (c, opt = {}) => {
    const sf = FIG_SON[c]; if (sf) son(sf[0], sf[1]);
    if (figuras.length > 40) return;
    const tx = figTex(c), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false }));
    const k = escK(), base = opt.mundo ? opt.mundo.clone() : pivote.localToWorld(new THREE.Vector3(opt.x ?? (Math.random() - 0.5) * 0.4 * k, opt.y ?? 1.75 * k, opt.z ?? 0.2 * k));
    const tam = (opt.tam ?? 0.32) * (0.8 + Math.random() * 0.4);
    s.position.copy(base); s.scale.set(tam * (tx.userData.asp || 1), tam, 1);
    // vx / vz / vy: velocidad en el mundo; cae: con gravedad (grav); gira: vueltas del sprite (copos, pétalos)
    s.userData = { vida: 0, dur: opt.dur ?? 2.2, vx: opt.vx ?? (Math.random() - 0.5) * 0.25, vz: opt.vz ?? 0, vy: opt.vy ?? 0.45, cae: !!opt.cae, grav: opt.grav ?? 2.2, gira: opt.gira ?? 0, s0: tam };
    escena.add(s); figuras.push(s);
  };
  const moverFiguras = (dt) => {
    for (let i = figuras.length - 1; i >= 0; i--) {
      const s = figuras[i], u = s.userData; u.vida += dt;
      if (u.cae) u.vy -= dt * u.grav;
      s.position.x += u.vx * dt + Math.sin(u.vida * 4) * 0.004; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
      if (u.gira) s.material.rotation += u.gira * dt;
      s.material.opacity = Math.min(1, u.vida * 4, (u.dur - u.vida) * 2);
      if (u.vida >= u.dur || s.position.y < 0) { escena.remove(s); s.material.dispose(); figuras.splice(i, 1); }
    }
  };
  // bracitos cortos (panda, ajolote...): al levantarlos se estiran un poco para que se lea la acción (abrazar, menear, saludar)
  const largoBrazo = () => {
    const u = m.ud; if (u.largoBrazo !== undefined) return u.largoBrazo;
    const b = m.brazos?.[0]; if (!b) return (u.largoBrazo = 1);
    m.raiz.updateMatrixWorld(true);
    const p = b.getWorldPosition(new THREE.Vector3()), alto = new THREE.Box3().setFromObject(m.raiz).getSize(new THREE.Vector3()).y || 1;
    let l = 0;   // el vértice más lejos del hombro
    b.traverse((o) => { const g = o.isMesh && o.geometry?.attributes.position; if (!g) return; const n = Math.max(1, Math.ceil(g.count / 400));
      for (let i = 0; i < g.count; i += n) l = Math.max(l, p.distanceTo(_w.fromBufferAttribute(g, i).applyMatrix4(o.matrixWorld))); });
    return (u.largoBrazo = l / alto);
  };
  const brazosPose = (dx, dz = 0) => {
    const extra = Math.min(0.25, Math.max(0.1, 0.3 / Math.max(0.05, largoBrazo()) - 1)) * Math.min(1, Math.abs(dx) / 1.2);
    m.brazos?.forEach((b, i) => { b.rotation.x = dx; if (dz) b.rotation.z = (i ? -1 : 1) * dz; b.scale.setScalar(1 + extra); });
  };
  /* ---- subirse a la cama o al sillón: brinco en arco desde el piso, acostarse tapada / sentarse, y bajar de regreso.
     Se calcula con la forma real de la mascota (puntos de su malla) y la posición, giro y tamaño del mueble. */
  const ARR = new THREE.Vector3(0, 1, 0), _w = new THREE.Vector3();
  const espaldas = () => { const r = []; m.raiz.traverse((x) => { if (x.userData.prendaSlot === 'espalda') r.push(x); }); return r; };
  // mochila, alas, capa...: para dormir en la cama se las quita (se encogen) y no cuentan para acostarla ni para la cobija
  const quitarEspalda = (k) => espaldas().forEach((x) => { const e0 = (x.userData.esc0 ??= x.scale.clone()); x.scale.copy(e0).multiplyScalar(Math.max(0.001, 1 - k)); x.visible = k < 1; });
  const puntosMascota = (sinEspalda = false) => {   // muestra de vértices de la mascota en el marco del pivote (parada, sin brincar); se guarda
    const u = m.raiz.userData, llave = sinEspalda ? 'ptsSE' : 'pts'; if (u[llave]) return u[llave];
    m.raiz.updateMatrixWorld(true);
    const k = m.raiz.scale.x, a = new THREE.Matrix4().compose(new THREE.Vector3(0, u.y0 || 0, 0), new THREE.Quaternion(), new THREE.Vector3(k, k, k)).multiply(m.raiz.matrixWorld.clone().invert());
    const mallas = []; let total = 0;
    const fuera = new Set(sinEspalda ? espaldas() : []), recorrer = (o, f) => { if (!o.visible || fuera.has(o)) return; f(o); o.children.forEach((h) => recorrer(h, f)); };
    recorrer(m.raiz, (o) => { const mt = [o.material].flat()[0]; if (o.isMesh && !o.isInstancedMesh && o.geometry?.attributes.position && mt && mt.visible !== false && mt.blending !== THREE.AdditiveBlending && !(mt.transparent && mt.opacity < 0.3)) { mallas.push(o); total += o.geometry.attributes.position.count; } });
    const paso = Math.max(1, Math.ceil(total / 4000)), pts = [], M = new THREE.Matrix4();
    for (const o of mallas) { const p = o.geometry.attributes.position; M.multiplyMatrices(a, o.matrixWorld); for (let i = 0; i < p.count; i += paso) pts.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(M)); }
    return (u[llave] = pts);
  };
  const medir = (q, f, dirs, sinEspalda = false) => {   // [min, max] de la mascota (girada q, escala f) a lo largo de cada dirección, desde el pivote
    const r = dirs.map(() => [Infinity, -Infinity]);
    for (const p of puntosMascota(sinEspalda)) { _w.copy(p).multiplyScalar(f).applyQuaternion(q); dirs.forEach((d, i) => { const v = _w.dot(d); if (v < r[i][0]) r[i][0] = v; if (v > r[i][1]) r[i][1] = v; }); }
    return r;
  };
  const qGiro = (yaw, x = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, yaw, 0, 'YXZ'));
  // acostada de lado con la cabeza hacia h (un poquito levantada, sobre la almohada); lado ±1 elige hacia dónde ve la cara
  const qAcostada = (h, lado, d = 0.15) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, lado < 0 ? Math.atan2(-h.z, h.x) : Math.atan2(h.z, -h.x), lado < 0 ? -Math.PI / 2 + d : Math.PI / 2 - d, 'YXZ'));
  const acostarHacia = (h, centroEn, d) => {   // el lado que le enseña la cara a la cámara
    const cam = camara.position.clone().sub(centroEn).setY(0), qs = [-1, 1].map((l) => qAcostada(h, l, d));
    const cara = (q) => new THREE.Vector3(0, 0, 1).applyQuaternion(q).dot(cam);
    const q = cara(qs[0]) >= cara(qs[1]) ? qs[0] : qs[1];
    return { q, ac: new THREE.Vector3(0, 0, 1).applyQuaternion(q).setY(0).normalize() };
  };
  const planArriba = (a) => {
    const F = pivote.position.clone().setY(0);
    if (!a.arriba) {   // siesta en el piso (no hay cama): de lado, con el cuerpo de perfil a la cámara, donde está parada
      const v = camara.position.clone().sub(F).setY(0).normalize(), h = new THREE.Vector3(v.z, 0, -v.x);
      const { q, ac } = acostarHacia(h, F, 0.05), [ey, eh, ea] = medir(q, 1, [ARR, h, ac]);
      const L = F.clone().addScaledVector(h, -(eh[0] + eh[1]) / 2).addScaledVector(ac, -(ea[0] + ea[1]) / 2); L.y = 0.015 - ey[0];
      return { piso: true, F, S: F.clone(), f: 1, qL: q, L, Z: F.clone().addScaledVector(h, (eh[1] - eh[0]) / 2 - 0.1).setY(L.y + ey[1] + 0.12), sombra: F };
    }
    const o = cuarto.userData.muebles?.[a.lugar]; if (!o) return null;
    o.updateMatrixWorld(true);
    const s = o.scale.x, fr = new THREE.Vector3(0, 0, 1).applyQuaternion(o.quaternion).setY(0).normalize(), lado = new THREE.Vector3().crossVectors(ARR, fr);
    const c = o.userData.colchon;
    if (c) {
      const S = o.localToWorld(new THREE.Vector3(0, c.y, (c.cab + c.pie) / 2)); S.y -= 0.02;
      if (a.act[0] !== 'dormir') return { o, F, S, f: 1, sombra: S, techo: c.techo ? o.localToWorld(new THREE.Vector3(0, c.techo, 0)).y : 99, altoM: medir(qGiro(0), 1, [ARR])[0][1] };
      const h = fr.clone().negate(), { q, ac } = acostarHacia(h, o.position, 0.3);   // de ladito (poco levantada: la cobija queda bajita), la carita hacia la cámara
      const [, eh0, ea0] = medir(q, 1, [ARR, h, ac], true);
      const f = Math.min(1, (c.pie - c.cab) * s / (eh0[1] - eh0[0]), c.ancho * 2 * s / (ea0[1] - ea0[0]));
      const [ey, eh, ea] = medir(q, f, [ARR, h, ac], true), largo = eh[1] - eh[0];
      const cab = o.localToWorld(new THREE.Vector3(0, c.y, c.cab));
      // la cabeza descansa sobre el colchón / almohada; el cuerpo, inclinado, se hunde un poco en el colchón (queda bajo la cobija)
      let yCab = Infinity; for (const pt of puntosMascota(true)) { _w.copy(pt).multiplyScalar(f).applyQuaternion(q); if (_w.dot(h) > eh[1] - largo * 0.42 && _w.y < yCab) yCab = _w.y; }
      const L = cab.clone().addScaledVector(h, -eh[1]).addScaledVector(ac, -(ea[0] + ea[1]) / 2); L.y = Math.max(cab.y + 0.03 - yCab, 0.06 - ey[0]);   // (la cola o las patas pueden hundirse dentro de la cama, nunca bajo el piso)
      const S2 = cab.clone().addScaledVector(h, -largo / 2); S2.y = cab.y - 0.02;
      return { o, c, F, S: S2, f, qL: q, L, largo, ancho: ea[1] - ea[0], grueso: L.y + ey[1] - cab.y, aplana: 0.9, Z: cab.clone().addScaledVector(h, -0.12).setY(L.y + ey[1] + 0.1), sombra: S2 };
    }
    const as = o.userData.asiento; if (!as) return null;
    const q = qGiro(Math.atan2(fr.x, fr.z), -0.08);
    const [, , ex0] = medir(q, 1, [ARR, fr, lado]), f = Math.min(1, as.ancho * 2 * s / (ex0[1] - ex0[0]));
    const [, ez, ex] = medir(q, f, [ARR, fr, lado]);
    const S = o.localToWorld(new THREE.Vector3(0, as.y, Math.min(as.frente, as.atras - ez[0] / s))).addScaledVector(lado, -(ex[0] + ex[1]) / 2); S.y -= 0.03;
    return { o, F, S, f, qL: q, L: S, sombra: S };
  };
  /* la cobija de ESA cama (su mismo material) se levanta y se amolda encima de la mitad de abajo del cuerpo: un mapa de
     alturas hecho con la forma real de la mascota acostada, inflado y suavizado, así nunca la atraviesa; las orillas caen
     al colchón y por los lados de la cama, y la cabeza queda afuera, en la almohada, con el doblez blanco */
  const cobijaEncima = (p) => {
    const o = p.o, c = p.c, s = o.scale.x, L = p.largo / s, z0 = c.cab + L * 0.53, z1 = 1.06, X = 0.88;
    const mat = o.getObjectByName('cobija')?.material || c.cobija, matB = o.getObjectByName('doblez')?.material || c.borde;
    const nx = 30, nz = Math.max(8, Math.round((z1 - z0) / 0.05)), dx = 2 * X / nx, dz = (z1 - z0) / nz;
    const H = Array.from({ length: nz + 1 }, () => new Float32Array(nx + 1).fill(-1));
    o.updateMatrixWorld(true);
    const inv = o.matrixWorld.clone().invert(), v = new THREE.Vector3();
    for (const q of puntosMascota(true)) {   // altura de la mascota en cada celda (en el marco de la cama)
      v.copy(q).multiplyScalar(p.f); v.x *= p.aplana || 1; v.applyQuaternion(p.qL).add(p.L).applyMatrix4(inv);   // (acostada se apachurra tantito en el colchón)
      const i = Math.round((v.x + X) / dx), j = Math.round((v.z - z0) / dz);
      for (let ii = i - 1; ii <= i + 1; ii++)   // (las vecinas tapan los huecos entre muestras)
        if (j >= 0 && j <= nz && ii >= 0 && ii <= nx && v.y > H[j][ii]) H[j][ii] = v.y;
    }
    // la tela se apoya redondita sobre el cuerpo: como una bola de radio R rodando encima, a una holgura G (nunca la atraviesa);
    // luego un suavizado ligero que solo rellena los escalones (no sube la joroba)
    const R = 0.13, G = 0.022, ri = Math.ceil(R / dx), rj = Math.ceil(R / dz), pisoC = c.y + 0.012;
    const B = H.map((r, j) => Array.from(r, (_, i) => { let y = pisoC;
      for (let b = -rj; b <= rj; b++) { const rr = H[j + b]; if (!rr) continue;
        for (let a = -ri; a <= ri; a++) { const h = rr[i + a]; if (h === undefined || h < 0) continue;
          const d2 = (a * dx) ** 2 + (b * dz) ** 2; if (d2 < R * R) y = Math.max(y, h + G + Math.sqrt(R * R - d2) - R); } }
      return y; }));
    let Y = B;
    for (let pas = 0; pas < 4; pas++) Y = Y.map((r, j) => r.map((y, i) => {
      let sum = 0, n = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const rr = Y[j + b]; if (rr && rr[i + a] !== undefined) { sum += rr[i + a]; n++; } }
      return Math.max(sum / n, B[j][i]);
    }));
    const geo = new THREE.PlaneGeometry(2 * X, z1 - z0, nx, nz); geo.rotateX(-Math.PI / 2);
    const pa = geo.attributes.position, uv = geo.attributes.uv;
    for (let k = 0; k < pa.count; k++) {
      const i = k % (nx + 1), j = Math.floor(k / (nx + 1)), x = -X + i * dx, z = z0 + j * dz;
      let y = Y[j][i];
      const lado = Math.max(0, Math.abs(x) - 0.8) / (X - 0.8), pie = Math.max(0, z - 1.0) / (z1 - 1.0);   // cae por los lados y a los pies
      y -= lado * lado * 0.16 + pie * pie * 0.05;
      pa.setXYZ(k, x, y - c.y, z); uv.setXY(k, (x + 0.75) / 1.5, (1.05 - z) / 1.3);   // el estampado empata con el de la cama
    }
    geo.computeVertexNormals();
    const g = g0(); g.position.y = c.y;
    const cob = malla(geo, Object.assign(mat.clone(), { side: THREE.DoubleSide })); cob.receiveShadow = true; g.add(cob);   // por debajo de la orilla también se ve tela
    const borde = []; for (let i = 0; i <= nx; i++) borde.push(new THREE.Vector3(-X + i * dx, Y[0][i] - c.y + 0.012 - (Math.max(0, Math.abs(-X + i * dx) - 0.8) / (X - 0.8)) ** 2 * 0.16, z0 + 0.02));
    g.add(det(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(borde), 48, 0.035, 6), matB));   // doblez
    g.traverse((x) => { x.raycast = () => {}; }); g.scale.y = 0.01; o.add(g); return g;
  };
  const suave = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const despertar = (susto) => {
    const a = paseo.act; if (!a?.arriba && a?.act[0] !== 'dormir') return;
    if (a.tDesp === undefined) { a.tDesp = Math.max(a.t, a.plan?.piso ? 0 : 1.2); if (susto) { soltarFigura('!', { tam: 0.3, dur: 1.2 }); son('despierta'); } }
  };
  const enMueble = (a, dt, t) => {   // devuelve null: el giro lo maneja ella
    const [tipo, dura] = a.act, p = a.plan ??= planArriba(a);
    if (!p) { terminarActividad(); return null; }
    const T0 = p.piso ? 0 : 0.3, T1 = p.piso ? 0 : 1.0, ARRIBA_T = p.piso ? 0 : 1.2;
    const yS = Math.atan2(p.S.x - p.F.x, p.S.z - p.F.z), aCam = Math.atan2(camara.position.x - pivote.position.x, camara.position.z - pivote.position.z);
    if (a.tDesp === undefined && a.t >= dura) a.tDesp = a.t;
    let f = 1, sy = 1, br = 0, piso = p.S.y, ax = 1;   // ax: dormida en la cama se apachurra tantito en el colchón (la cobija queda más bajita)
    const pos = pivote.position, q = pivote.quaternion;
    if (a.tDesp === undefined) {
      if (a.t < T0) { pos.copy(p.F); q.slerp(qGiro(yS), Math.min(1, dt * 10)); sy = 1 - 0.18 * (a.t / T0); piso = 0; }
      else if (a.t < T1) {   // el brinco: arco del piso al colchón / asiento
        const k = (a.t - T0) / (T1 - T0); if (!a.sBrinco) { a.sBrinco = true; son('brinco'); }
        pos.lerpVectors(p.F, p.S, k); pos.y = p.S.y * k + Math.sin(k * Math.PI) * 0.42; q.copy(qGiro(yS));
        f = 1 + (p.f - 1) * k; sy = 1 + 0.12 * Math.sin(k * Math.PI); piso = k < 0.6 ? 0 : p.S.y;
      } else {
        f = p.f; const u = a.t - T1;
        if (!a.sCae && !p.piso) { a.sCae = true; if (a.def?.t !== 'hundirse') son(a.lugar === 'cama' ? 'colchon' : 'cojin'); }   // (el puff suena al hundirse)
        if (u < ARRIBA_T - T1) sy = 1 - 0.15 * Math.sin(u / (ARRIBA_T - T1) * Math.PI);   // aterriza
        if (tipo === 'dormir') {
          const k = suave((a.t - ARRIBA_T) / 0.8);
          pos.lerpVectors(p.S, p.L, k); q.slerpQuaternions(qGiro(p.piso ? aCam : yS), p.qL, k); ax = 1 - (1 - (p.aplana || 1)) * k;
          if (k > 0.3) { anim.e.cierre = 0.2; anim.e.obj.set(0, 0); }
          if (p.c) quitarEspalda(suave((a.t - ARRIBA_T) / 0.5));
          if (k >= 1) { const nR = Math.floor((t * 1.7 + Math.PI / 2) / (Math.PI * 2)); if (a.nRonca !== undefined && nR !== a.nRonca) son('ronquido'); a.nRonca = nR;   // ronca al inhalar
            br = Math.sin(t * 1.7) * 0.03; if (cada(1.1)) soltarFigura('Z', { mundo: p.Z, tam: 0.28, vy: 0.3, dur: 2.8 }); if (a.def?.abrazo && cada(1.9)) soltarFigura('♥', { mundo: p.Z, tam: 0.24, vy: 0.3, dur: 2.4 }); }
          if (p.c && !a.cobija && a.t > ARRIBA_T + 0.5) a.cobija = cobijaEncima(p);
          if (a.cobija) a.cobija.scale.y = Math.min(1 + br, a.cobija.scale.y + dt * 2.5);   // respira y la cobija sube y baja
          m.raiz.rotation.y = 0; m.raiz.position.y = m.raiz.userData.y0;   // quieta: nada de bamboleo acostada
        } else {
          pos.copy(p.S);
          if (a.def?.enCima) { const r2 = a.def.enCima({ a, t, dt, dura, p, pos, q, aCam, K: escK(), o: p.o }); if (r2 !== undefined) sy = Math.min(sy, r2); }
          else if (tipo === 'brincarCama') {   // brinca en el colchón: se hunde al caer y nunca pega con el dosel
            q.slerp(qGiro(aCam), Math.min(1, dt * 5)); if (a.t > 1.4 && a.t < dura - 0.5 && cada(0.8)) { anim.e.salto = 1; son('resorte'); } if (cada(1.6)) soltarFigura('♥', { tam: 0.24 });
            const s0 = anim.e.salto, toca = s0 > 0 ? Math.max(0, 1 - Math.sin((1 - s0) * Math.PI) * 5) : 0; pos.y = p.S.y - 0.07 * toca;
            const dy = m.raiz.position.y - m.raiz.userData.y0, hueco = p.techo - (p.S.y + p.altoM) - 0.05;
            if (dy > 0 && hueco < 0.75) m.raiz.position.y = m.raiz.userData.y0 + dy * Math.max(0, hueco) / 0.75;
          }
          else {   // sentada en el sillón viendo al frente
            q.slerp(p.qL, Math.min(1, dt * 5)); sy = Math.min(sy, 1 - 0.1 * suave((a.t - T1) / 0.4)); m.raiz.rotation.y *= 0.3;
            if (tipo === 'leer') { anim.e.obj.set(Math.sin(t * 0.8) * 0.25, -0.5); brazosPose(-1.0, 0.2); if (cada(2.6)) { soltarFigura(Math.random() < 0.5 ? '?' : '!', { tam: 0.22, dur: 1.6 }); son('pagina'); } }
            else if (tipo === 'cabecear') {   // se queda dormida sentada: cabecea y suelta Z
              const dor = a.t > 2; anim.e.cierre = dor ? 0.2 : 0; anim.e.obj.set(0, dor ? -0.7 + Math.sin(t * 0.9) * 0.2 : 0.1);
              if (dor && cada(1.3)) soltarFigura('Z', { tam: 0.24, vy: 0.3, dur: 2.4 });
              if (dor && cada(3.2)) son('ronquido', 0.55);
            } else anim.e.obj.set(Math.sin(t * 0.5) * 0.6, 0.1);
          }
        }
      }
    } else {   // bajar: se para, se agacha y brinca al piso del lado por donde subió
      const u = a.t - a.tDesp;
      if (!a.desde) { a.desde = { pos: pos.clone(), q: q.clone() }; brazosPose(0); if (a.prop) { pivote.remove(a.prop); liberar(a.prop); a.prop = null; a.sinProp = true; } }
      const yB = p.piso ? aCam : Math.atan2(p.F.x - p.S.x, p.F.z - p.S.z), TB = p.piso ? 0.7 : 1.7;
      f = p.f;
      if (a.cobija) { a.cobija.scale.y = Math.max(0.01, 1 - u / 0.35); if (u > 0.35) { a.cobija.removeFromParent(); liberar(a.cobija); a.cobija = null; } }
      if (u < 0.6) { const k = suave(u / 0.6); pos.lerpVectors(a.desde.pos, p.S, k); q.slerpQuaternions(a.desde.q, qGiro(yB), k); if (p.c) quitarEspalda(1 - k); ax = 1 - (1 - (p.aplana || 1)) * (1 - k); }
      else if (p.piso) { pos.copy(p.S); q.copy(qGiro(yB)); }
      else if (u < 0.85) { pos.copy(p.S); q.copy(qGiro(yB)); sy = 1 - 0.18 * ((u - 0.6) / 0.25); }
      else if (u < 1.5) { const k = (u - 0.85) / 0.65; if (!a.sBaja) { a.sBaja = true; son('bajar'); } pos.lerpVectors(p.S, p.F, k); pos.y = p.S.y * (1 - k) + Math.sin(k * Math.PI) * 0.4; q.copy(qGiro(yB)); f = p.f + (1 - p.f) * k; sy = 1 + 0.12 * Math.sin(k * Math.PI); piso = k < 0.4 ? p.S.y : 0; }
      else { pos.copy(p.F); f = 1; sy = 1 - 0.15 * Math.sin(Math.min(1, (u - 1.5) / 0.2) * Math.PI); piso = 0; if (!a.sPiso) { a.sPiso = true; son('aterrizar'); } }
      if (u >= TB) { a.arriba = false; a.plan = null; terminarActividad(); return null; }
    }
    pivote.scale.set(f * (1 + (1 - sy) * 0.5 + br) * ax, f * sy, f * (1 + (1 - sy) * 0.5 + br));
    const enPiso = piso === 0 && !p.piso;   // en el piso la sombrita sigue a la mascota; encima, se queda en el mueble
    a.sombra = (a.sombra || new THREE.Vector3()).set(enPiso ? pos.x : p.sombra.x, piso, enPiso ? pos.z : p.sombra.z);
    return null;
  };
  const cada = (s) => { const a = paseo.act; a.tiempos ??= {}; const n = Math.floor(a.t / s); if (a.tiempos[s] !== n) { a.tiempos[s] = n; return true; } return false; };
  const terminarActividad = () => {
    if (!paseo.act) return;
    if (paseo.act.prop) { pivote.remove(paseo.act.prop); liberar(paseo.act.prop); }
    if (paseo.act.cobija) { paseo.act.cobija.removeFromParent(); liberar(paseo.act.cobija); }
    const om = cuarto.userData.muebles?.[paseo.act.lugar]; if (om && paseo.act.def?.fin) paseo.act.def.fin({ o: om, a: paseo.act });
    if (paseo.act.plan) { pivote.position.copy(paseo.act.plan.F); quitarEspalda(0); }   // la bajan de golpe (decorar, bañar, comer...): al piso, junto al mueble
    pivote.position.y = 0;   // (las que brincan o se suben la dejan en el aire)
    paseo.act = null; pivote.rotation.x = 0; pivote.rotation.z = 0; pivote.scale.set(1, 1, 1); anim.e.obj.set(0, 0); brazosPose(0);
    paseo.espera = 4 + Math.random() * 6;
  };
  const hacerActividad = (dt, t) => {
    const a = paseo.act; if (paseo.congelada) dt = 0; a.t += dt;
    const [tipo, dura] = a.act, k = Math.min(1, a.t / 0.6);
    if (!a.prop && !a.sinProp && a.t > (a.arriba ? 1.5 : 0.05)) { a.prop = accesorio(a.def?.prop ?? tipo); if (a.prop) pivote.add(a.prop); }
    const om = cuarto.userData.muebles?.[a.lugar];
    if (om && a.def?.paso) a.def.paso({ o: om, a, t, dt });
    if (a.arriba || tipo === 'dormir') return enMueble(a, dt, t);
    let giro = Math.atan2(a.centro.x - pivote.position.x, a.centro.z - pivote.position.z);
    const aCamara = Math.atan2(camara.position.x - pivote.position.x, camara.position.z - pivote.position.z), giro0 = giro;
    const propia = a.def?.hacer;   // la pose propia de ese mueble (ver ACTIVIDADES)
    if (propia) { const g2 = propia({ a, k, t, dt, dura, aCam: aCamara, K: escK(), o: om }); if (g2 !== undefined) giro = g2; }
    else if (tipo === 'videojuego') {   // frente a la tele, inclinada hacia adelante machacando botones; a ratos gana y celebra
      pivote.rotation.x = 0.1 * k; anim.e.obj.set(Math.sin(t * 1.3) * 0.3, 0.15);
      const gana = a.t % 4.5 > 3.9;
      brazosPose(gana ? -2.6 : -0.95 + Math.sin(t * 22) * 0.12, gana ? 0.3 : 0.25);
      if (a.prop) { a.prop.position.y = (gana ? 1.25 : 0.86) * escK() + Math.abs(Math.sin(t * 22)) * 0.01; a.prop.rotation.z = Math.sin(t * 9) * 0.12; }
      if (!gana && cada(0.3)) son('botones');   // machaca los botones
      if (gana && cada(4.5)) { anim.e.salto = 0.8; son('victoria8'); for (let i = 0; i < 4; i++) soltarFigura('★', { tam: 0.28 }); }
      else if (cada(0.9)) soltarFigura(Math.random() < 0.5 ? '!' : '★', { tam: 0.2, dur: 1.2 });
    } else if (tipo === 'brincarCama') {
      if (cada(0.8)) { anim.e.salto = 1; son('resorte'); } giro = aCamara; if (cada(1.6)) soltarFigura('♥', { tam: 0.24 });
    } else if (tipo === 'sentarse') { pivote.scale.set(1 + 0.05 * k, 1 - 0.1 * k, 1 + 0.05 * k); giro = aCamara; }
    else if (tipo === 'leer') {
      pivote.scale.set(1 + 0.05 * k, 1 - 0.1 * k, 1 + 0.05 * k); giro = aCamara; anim.e.obj.set(Math.sin(t * 0.8) * 0.25, -0.5); brazosPose(-1.0, 0.2);
      if (cada(2.6)) { soltarFigura(Math.random() < 0.5 ? '?' : '!', { tam: 0.22, dur: 1.6 }); son('pagina'); }
    } else if (tipo === 'regar') {
      pivote.rotation.x = 0.15 * k; brazosPose(-0.6, 0.15); if (a.prop) a.prop.rotation.x = 0.5 + Math.sin(t * 3) * 0.2;
      if (a.t < dura - 1 && cada(1.6)) son('regar', 1.6);
      if (cada(0.18)) soltarFigura('gota', { x: 0.55 * escK(), y: 0.85 * escK(), z: 0.95 * escK(), tam: 0.09, vy: -0.4, cae: true, dur: 0.9 });
      if (a.t > a.act[1] - 0.6 && !a.feliz) { a.feliz = true; anim.e.salto = 0.7; soltarFigura('♥'); }
    } else if (tipo === 'oler') { pivote.rotation.x = (0.28 + Math.sin(t * 7) * 0.05) * k; if (a.t > 0.4 && cada(1.2)) son('olfatear'); if (a.t > dura - 0.5 && !a.feliz) { a.feliz = true; anim.e.salto = 0.7; soltarFigura('♥'); } }
    else if (tipo === 'bailar') {
      if (cada(0.75)) { anim.e.salto = 0.7; son('pasito', Math.floor(a.t / 0.75)); anim.e.giro = Math.floor(a.t / 0.75) % 3 === 2 ? 1 : 0; soltarFigura(Math.random() < 0.5 ? '♪' : '♫', { tam: 0.26 }); }
      pivote.rotation.z = Math.sin(t * 8) * 0.12; brazosPose(-1.4 + Math.sin(t * 8) * 0.6, 0.4); giro = aCamara;
    } else if (tipo === 'ejercicio') {   // levantar pesitas
      giro = aCamara; const sube = (Math.sin(t * 5) + 1) / 2; brazosPose(-0.4 - 2.2 * sube, 0.35);
      if (a.prop) a.prop.position.y = (0.7 + 1.1 * sube) * escK();
      if (cada(1.25)) { soltarFigura('gota', { tam: 0.08, x: 0.3 * escK(), y: 1.8 * escK(), vy: 0.3, cae: true, dur: 0.9 }); son('pujido'); }
      if (a.t > dura - 0.5 && !a.feliz) { a.feliz = true; anim.e.salto = 0.8; soltarFigura('★'); }
    } else if (tipo === 'pintar') {
      brazosPose(-1.6 + Math.sin(t * 6) * 0.35, 0.2); if (a.prop) a.prop.rotation.z = -0.5 + Math.sin(t * 6) * 0.4; if (cada(0.52)) son('pincel');
      if (cada(0.6)) soltarFigura(['★', '♥', '♪'][Math.floor(a.t / 0.6) % 3], { x: 0.4 * escK(), y: 1.3 * escK(), z: 0.9 * escK(), tam: 0.18, dur: 1.4 });
    } else if (tipo === 'galleta') {
      giro = aCamara; brazosPose(-1.3 + Math.sin(t * 6) * 0.1, 0.2);
      if (cada(1.2)) { anim.e.comer = 0.5; son('mordida'); if (a.prop) a.prop.scale.multiplyScalar(0.8); soltarFigura('♥', { tam: 0.2 }); }
    } else if (tipo === 'burbujas') {
      giro = aCamara; brazosPose(-1.2, 0.1); if (cada(0.25)) soltarFigura('o', { tam: 0.14 + Math.random() * 0.12, y: 1.25 * escK(), z: 0.6 * escK(), vy: 0.35, dur: 2.6 });
      if (cada(2)) anim.e.salto = 0.5; if (cada(0.5)) son('burbujita');
    } else if (tipo === 'musica') {
      giro = aCamara; pivote.rotation.z = Math.sin(t * 6) * 0.08; anim.e.cierre = 0.15; anim.e.obj.set(Math.sin(t * 3) * 0.5, 0.1);
      if (cada(0.7)) soltarFigura(Math.random() < 0.5 ? '♪' : '♫', { tam: 0.24 }); if (cada(0.35)) son('audifonos', Math.floor(a.t / 0.35));
    } else if (tipo === 'girar') { giro = pivote.rotation.y + dt * 8; if (cada(1.2)) { soltarFigura('★', { tam: 0.22 }); son('vuelta'); } }
    else if (tipo === 'estirarse') { giro = aCamara; if (!a.sEst && a.t > 0.3) { a.sEst = true; son('estiron'); } const e = Math.sin(Math.min(1, a.t / dura) * Math.PI); brazosPose(-2.8 * e, 0.15); pivote.scale.set(1 - 0.05 * e, 1 + 0.12 * e, 1 - 0.05 * e); anim.e.cierre = e > 0.5 ? 0.2 : 0; }
    else if (tipo === 'ver') { anim.e.obj.set(0, 0.3); if (a.t > dura - 0.6 && !a.feliz) { a.feliz = true; anim.e.salto = 0.8; anim.e.saludo = 0.6; } }
    else if (tipo === 'mirarArriba') { anim.e.obj.set(0, 1.3 * k); pivote.rotation.x = -0.1 * k; }
    else if (tipo === 'saludar') { if (a.t > 0.4 && !a.feliz) { a.feliz = true; anim.e.saludo = 1.4; soltarFigura('♥'); son('saludo'); } }
    else if (tipo === 'peces') {   // nariz pegada al vidrio siguiendo a los peces
      pivote.rotation.x = 0.16 * k; anim.e.obj.set(Math.sin(t * 1.4) * 0.9, 0.35);
      if (cada(0.9)) { soltarFigura('o', { tam: 0.1 + Math.random() * 0.08, y: 1.2 * escK(), z: 0.7 * escK(), vy: 0.3, dur: 1.8 }); son('burbujita'); }
      if (cada(2.2)) { soltarFigura('♥', { tam: 0.22 }); anim.e.saludo = 0.5; }
    } else if (tipo === 'picarse') {   // huele el cactus... ¡y se pica!
      pivote.rotation.x = (a.t < 2 ? 0.26 : -0.15) * k;
      if (a.t > 2 && !a.feliz) { a.feliz = true; anim.e.salto = 1; soltarFigura('!', { tam: 0.32 }); soltarFigura('★', { tam: 0.2 }); son('ay'); }
    } else if (tipo === 'apagar') {   // estira la mano al apagador; con la luz apagada se asusta tantito, luego la prende
      const e = Math.sin(Math.min(1, a.t / 1.0) * Math.PI); brazosPose(-2.4 * e, 0.1); anim.e.obj.set(0, 0.9 * k);
      if (a.luz === 1 && cada(1.2)) soltarFigura('?', { tam: 0.22 });
      if (a.luz === 2 && !a.feliz) { a.feliz = true; anim.e.salto = 0.8; soltarFigura('★'); }
    } else if (tipo === 'mirarCuadro') {   // admira el cuadro (el reloj: se mece con el péndulo)
      anim.e.obj.set(Math.sin(t * 0.7) * 0.2, 1.4 * k); pivote.rotation.x = (-0.2 + Math.sin(t * 1.2) * 0.03) * k;   // echada para atrás: el cuadro está arriba
      if (op.muebles?.cuadro === 'reloj') { pivote.rotation.z = Math.sin(t * 3) * 0.07; if (cada(1)) soltarFigura('♪', { tam: 0.2 }); if (cada(1.05)) son('tic', Math.floor(a.t / 1.05) % 2); }
      else if (op.muebles?.cuadro === 'paisaje' && cada(1.8)) son('pajaros');
      else if (cada(1.5)) soltarFigura(Math.random() < 0.6 ? '♥' : '★', { tam: 0.22 });
    } else if (tipo === 'abrazar') {   // abraza al peluche
      pivote.rotation.x = 0.18 * k; brazosPose(-1.5, -0.35 + Math.sin(t * 3) * 0.05); anim.e.cierre = a.t > 0.8 ? 0.2 : 0; if (cada(2 * Math.PI / 3)) son('apapacho');
      if (cada(0.8)) soltarFigura('♥', { tam: 0.24 });
    } else if (tipo === 'golpear') {   // le pega a la piñata; se mece y sueltan estrellitas
      const f = (a.t % 0.9) / 0.9; brazosPose(f < 0.3 ? -2.6 * (f / 0.3) : -2.6 + 2.6 * Math.min(1, (f - 0.3) / 0.2), 0.2);
      if (cada(0.9) && a.t > 0.5) { a.golpe = 1; anim.e.salto = 0.35; son('pinata'); soltarFigura('★', { tam: 0.22 }); }
      a.golpe = Math.max(0, (a.golpe ?? 0) - dt * 0.8);
    } else if (tipo === 'presumir') {   // levanta el trofeo imaginario
      giro = aCamara; brazosPose(-2.8, 0.25); if (cada(1.3)) { anim.e.salto = 0.8; soltarFigura('★', { tam: 0.26 }); son(a.tada ? 'destello' : 'tada'); a.tada = true; }
    } else if (tipo === 'asomarse') {   // de puntitas viendo por la ventana
      const e = suave(a.t / 0.6); pivote.scale.set(1 - 0.04 * e, 1 + 0.08 * e, 1 - 0.04 * e); anim.e.obj.set(Math.sin(t * 0.6) * 0.5, 1.1 * e);
      brazosPose(-0.5 * e, 0); if (cada(1.6)) soltarFigura(Math.random() < 0.5 ? '★' : '♥', { tam: 0.22 });
      if (!a.sVen) { a.sVen = true; son('viento'); } if (a.t > 0.6 && cada(1.9)) son('pajaros');
    } else if (tipo === 'asco') {   // ve su popó: se echa para atrás, ¡fuchi!
      pivote.rotation.x = -0.14 * k; anim.e.obj.set(Math.sin(t * 9) * 0.6, -0.4); brazosPose(-1.2, 0.3);
      if (cada(1.1)) soltarFigura('!', { tam: 0.24 }); if (a.t > 0.3 && !a.sAsco) { a.sAsco = true; son('fuchi'); }
      if (a.t > dura - 1 && !a.feliz) { a.feliz = true; giro = aCamara; }
      if (a.feliz) giro = aCamara;
    } else if (tipo === 'panza') {   // con hambre: se soba la panza
      giro = aCamara; pivote.rotation.x = 0.08 * k; brazosPose(-0.7 + Math.sin(t * 5) * 0.15, -0.35); anim.e.obj.set(0, -0.3);
      if (cada(1.4)) soltarFigura('?', { tam: 0.22 }); if (cada(2)) son('tripas');
    } else if (tipo === 'bostezo') {   // con sueño: bosteza y se estira
      giro = aCamara; const e = Math.sin(Math.min(1, a.t / dura) * Math.PI); brazosPose(-2.6 * e, 0.2);
      pivote.scale.set(1 - 0.04 * e, 1 + 0.1 * e, 1 - 0.04 * e); anim.e.cierre = 0.2; if (cada(1.5)) soltarFigura('Z', { tam: 0.22, vy: 0.3, dur: 2.2 });
      if (!a.sBos && a.t > 0.2) { a.sBos = true; son('bostezo'); }
    } else if (tipo === 'mosca') {   // sucia: persigue a las moscas que la rodean
      giro = pivote.rotation.y + dt * 2.6; anim.e.obj.set(0, 0.8); brazosPose(-2 + Math.sin(t * 10) * 0.6, 0.2);
      if (cada(1.3)) { anim.e.salto = 0.6; son('zumbido'); }
    }
    if (giro === giro0 && a.lugar !== 'libre' && a.lugar !== 'ventana') {   // viendo al mueble: de 3/4, sin darle la espalda a la cámara
      const d = difAng(giro, aCamara), gm = a.lugar === 'cuadro' ? GIRO_MAX + 0.3 : GIRO_MAX;   // al cuadro (arriba en la pared) se le puede ver de perfil
      if (Math.abs(d) > gm) giro = aCamara + Math.sign(d) * gm;
    }
    if (a.t >= dura) terminarActividad();
    return giro;
  };
  const vivir = (dt, t) => {
    moverFiguras(paseo.congelada ? 0 : dt);   // (congelada: solo pruebas)
    // con la lupa (cerca) sigue con su actividad: así se ve de cerca lo que hace; solo no empieza a caminar a otro lado
    const forzar = decorando || !!bano || anim.e.comer > 0 || anim.e.jugando;
    const quieta = forzar || dedos.size > 0 || (anim.e.salto > 0 && !paseo.act) || (cerca && !paseo.act);
    let objetivoGiro;
    // girar la cámara no la despierta ni la baja del mueble (tocarla sí: ver feliz); decorar, bañar, comer o jugar la bajan ya
    const enCima = paseo.act?.fase === 'hacer' && (paseo.act.arriba || paseo.act.act[0] === 'dormir');
    if (quieta && paseo.act && (forzar || !enCima)) terminarActividad();
    if (paseo.act && paseo.act.fase === 'hacer') objetivoGiro = hacerActividad(dt, t);
    else if (paseo.destino && !quieta) {
      const dx = paseo.destino.x - pivote.position.x, dz = paseo.destino.z - pivote.position.z, dist = Math.hypot(dx, dz);
      if (dist < 0.05) {
        paseo.destino = null; pivote.position.y = 0; paseo.vel = 0;
        if (paseo.act) { paseo.act.fase = 'hacer'; paseo.act.t = 0; } else paseo.espera = 5 + Math.random() * 7;
      } else {
        // primero voltea hacia donde va (sin caminar de lado ni de reversa), arranca y frena suave
        const rumbo = Math.atan2(dx, dz), dif = Math.abs(difAng(rumbo, pivote.rotation.y));
        const vMeta = 0.7 * Math.max(0, Math.cos(Math.min(Math.PI / 2, dif * 1.3))) * Math.min(1, 0.35 + dist / 0.5);
        paseo.vel = (paseo.vel || 0) + (vMeta - (paseo.vel || 0)) * Math.min(1, dt * 6);
        const paso = Math.min(dist, dt * paseo.vel);
        pivote.position.x += (dx / dist) * paso; pivote.position.z += (dz / dist) * paso;
        paseo.recorrido = ((paseo.recorrido || 0) + paso) % 0.48;   // saltitos al caminar, al compás de lo que avanza (no patina)
        pivote.position.y = Math.abs(Math.sin((paseo.recorrido * Math.PI) / 0.24)) * 0.08 * Math.min(1, paseo.vel / 0.25);
        objetivoGiro = rumbo;
      }
    } else {
      pivote.position.y = 0;
      if (!quieta) {
        paseo.espera -= dt;
        if (paseo.espera <= 0) {
          // 50 %: va a un mueble; 8 %: se asoma por la ventana; 8 %: va a ver su popó; ~20 %: hace algo donde está; si no, pasea
          const r = Math.random(), act = r < 0.5 ? actividadEn() : r < 0.58 ? actividadVentana() : r < 0.66 ? actividadPopo() : null;
          if (act) { paseo.act = { ...act, fase: 'ir', t: 0 }; paseo.destino = act.punto; }
          else if (r < 0.86) libreAqui(sortear(LIBRES.filter((x) => !x.si || x.si())));
          else { paseo.destino = elegirDestino(); paseo.espera = 6; }
        }
      }
    }
    if (objetivoGiro === undefined) objetivoGiro = Math.atan2(camara.position.x - pivote.position.x, camara.position.z - pivote.position.z);
    if (objetivoGiro !== null) pivote.rotation.y = anguloSuave(pivote.rotation.y, objetivoGiro, Math.min(1, dt * 4));
    const sb = paseo.act?.sombra;   // encima de un mueble la sombrita va sobre el colchón / asiento
    if (sb) sombra.position.set(sb.x, sb.y + 0.05, sb.z); else sombra.position.set(pivote.position.x, 0.05, pivote.position.z);
    if (cerca) meta.objetivo.set(pivote.position.x, 0.75 + (sb ? sb.y * 0.8 : 0), pivote.position.z);
  };
  const marcar = (o) => {
    elegido = o; anillo.visible = !!o;
    if (o) { const tam = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()); anillo.scale.setScalar(Math.max(0.4, Math.max(tam.x, tam.z, o.userData.lugar === 'cuadro' ? tam.y : 0) * 0.62)); }
    cbs.alElegir?.(o ? o.userData.lugar : null);
  };
  const posDe = (o) => (o.userData.lugar === 'cuadro'
    ? [+o.position.z.toFixed(2), +o.position.y.toFixed(2), 0]
    : [+o.position.x.toFixed(2), +o.position.z.toFixed(2), +(o.rotation.y % (Math.PI * 2)).toFixed(3)]);

  /* ---------- higiene: popós en el piso (tocarlas las recoge), manchas de lodo según la suciedad y el baño en tina */
  const hig = { suciedad: 0, popos: [] };
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  // mosca caricaturesca: cuerpito negro con dos alitas que aletean; vuela en círculos alrededor de un punto
  const mosca = (r, alto, vel) => {
    const g = g0(), alas = [];
    g.add(det(esf(0.028, 10), clay(0x2b2b33, { roughness: 0.4, clearcoat: 0.6 }), { esc: [1.25, 1, 1] }));
    g.add(det(esf(0.016, 8), clay(0x2b2b33), { pos: [0.032, 0.006, 0] }));
    for (const s of [-1, 1]) { const a = det(esf(0.032, 10), matCuarto('ala-mosca', () => new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.7, depthWrite: false })), { pos: [-0.005, 0.025, s * 0.024], esc: [1, 0.25, 0.55] }); g.add(a); alas.push(a); }
    g.userData = { r, alto, vel: vel * (Math.random() < 0.5 ? -1 : 1), fase: Math.random() * 7, alas };
    return g;
  };
  const volarMoscas = (moscas, t) => moscas.forEach((f) => {
    const u = f.userData, a = t * u.vel + u.fase;
    f.position.set(Math.cos(a) * u.r, u.alto + Math.sin(t * 3.1 + u.fase) * 0.06, Math.sin(a) * u.r);
    f.rotation.y = -a - Math.sign(u.vel) * Math.PI / 2;
    u.alas.forEach((x, i) => { x.rotation.x = (i ? 1 : -1) * (0.3 + Math.abs(Math.sin(t * 60)) * 0.9); });
  });
  // popó: tres bolitas cafés apiladas con su piquito, brillito, líneas de olor y una o dos moscas
  const crearPopo = (id) => {
    const g = g0(), cafe = brillo(0x8a5530), cafeOsc = brillo(0x74431f), blanco = luz(0xffffff);
    [[0.2, 0.08, 0.5], [0.15, 0.19, 0.6], [0.1, 0.28, 0.72]].forEach(([r, y, ey], i) => {
      g.add(malla(esf(r, 28), i % 2 ? cafeOsc : cafe, { pos: [0, y, 0], esc: [1, ey, 1] }));
      if (i) g.add(det(esf(r * 0.17, 12), blanco, { pos: [-r * 0.42, y + r * ey * 0.62, r * 0.55], esc: [1.7, 0.45, 0.6], rot: [0, 0.6, 0.5] }));
    });
    g.add(malla(new THREE.ConeGeometry(0.06, 0.13, 18), cafe, { pos: [0.015, 0.39, 0], rot: [0, 0, -0.35] }));
    const s = sombraContacto(0.6, 0.6, 0.5); s.position.y = 0.006; g.add(s);
    const olor = [];   // tres rayitas onduladas verdes que suben y se desvanecen
    for (let i = 0; i < 3; i++) {
      const pts = Array.from({ length: 9 }, (_, k) => V3(Math.sin(k * 0.9 + i) * 0.035, k * 0.035, 0));
      const l = det(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.011, 5), new THREE.MeshBasicMaterial({ color: 0x9ccc4a, transparent: true, opacity: 0.8, depthWrite: false }));
      l.position.x = (i - 1) * 0.11; l.userData.fase = i / 3; l.raycast = () => {}; g.add(l); olor.push(l);
    }
    const moscas = [mosca(0.3, 0.55, 2.2), ...(Math.random() < 0.6 ? [mosca(0.38, 0.7, 1.6)] : [])];
    moscas.forEach((f) => g.add(f));
    const toque = new THREE.Mesh(esf(0.36, 10), new THREE.MeshBasicMaterial({ visible: false })); toque.position.y = 0.2; g.add(toque);  // área de toque generosa
    g.userData = { popoId: id, olor, moscas, aparecer: 0 };
    g.scale.setScalar(0.001);
    return g;
  };
  // lugar libre en el piso para la popó: el que manda el servidor, o el más cercano lejos de muebles y de otras popós
  const lugarPopo = (x, z) => {
    const ok = (a, b) => libre(a, b) && Math.abs(a) <= 2.2 && Math.abs(b) <= 2.2 && gPopos.children.every((p) => Math.hypot(p.position.x - a, p.position.z - b) > 0.6);
    if (ok(x, z)) return [x, z];
    for (let r = 0.3; r < 3; r += 0.3) for (let i = 0; i < 10; i++) { const a = i * 0.63 + r, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (ok(px, pz)) return [px, pz]; }
    return [x, z];
  };
  const recogerPopo = (p) => {
    if (p.userData.recoger !== undefined) return;
    p.userData.recoger = 0; Juego3D.pop();
    for (let i = 0; i < 6; i++) soltarFigura(i % 2 ? '★' : 'o', { mundo: p.position.clone().add(V3((Math.random() - 0.5) * 0.4, 0.25, (Math.random() - 0.5) * 0.4)), tam: 0.22, vy: 0.8, dur: 1.2 });
    op.alLimpiar?.(p.userData.popoId);
  };
  const popoEn = () => {
    let o = ray.intersectObject(gPopos, true)[0]?.object;
    while (o && o.userData?.popoId === undefined) o = o.parent;
    return o || null;
  };
  // manchas de lodo: se pegan donde un rayo toca el cuerpo (abajo, lados y espalda; nunca la cara)
  const manchas = [], moscasMascota = [];
  const GEO_MANCHA = esf(1, 12); GEO_MANCHA.userData.fija = true;
  const lodos = [0x6e4f33, 0x5c4229, 0x806040];
  const ensuciar = () => {
    manchas.forEach((s) => s.removeFromParent()); manchas.length = 0;
    moscasMascota.forEach((f) => { f.removeFromParent(); liberar(f); }); moscasMascota.length = 0;
    const suc = hig.suciedad, n = suc < 20 ? 0 : Math.round(4 + (Math.min(100, suc) - 20) / 80 * 16);
    if (n) {
      m.raiz.updateMatrixWorld(true);
      const mallas = []; m.raiz.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.name !== 'pelo' && o.visible && !o.material?.transparent && o.material?.blending !== THREE.AdditiveBlending) mallas.push(o); });
      const caja = new THREE.Box3(); mallas.forEach((o) => caja.expandByObject(o));
      const tam = caja.getSize(V3()), rc = new THREE.Raycaster(), azar = azarCon(41), k = escK();
      const local = new THREE.Box3(); mallas.forEach((o) => local.expandByObject(o)); local.applyMatrix4(m.raiz.matrixWorld.clone().invert());
      const cara = local.min.y + (local.max.y - local.min.y) * 0.5;   // arriba de esta altura, por delante, está la cara: queda limpia
      for (let i = 0, intentos = 0; i < n && intentos < n * 10; intentos++) {
        // más manchas al frente (es lo que se ve), apuntando al eje del cuerpo (no al centro de la caja: la cola lo jala)
        const a = (intentos % 5 < 3 ? 0.15 + azar() * 0.7 : azar() * 2) * Math.PI, y = -0.8 + azar() * 1.3, rr = Math.sqrt(1 - y * y), d = V3(Math.cos(a) * rr, y, Math.sin(a) * rr);
        const dirW = d.clone().transformDirection(m.raiz.matrixWorld), meta = m.raiz.localToWorld(V3(0, local.min.y + (local.max.y - local.min.y) * (0.22 + azar() * 0.4), 0));
        rc.set(meta.clone().addScaledVector(dirW, tam.length()), dirW.clone().negate());
        const hit = rc.intersectObjects(mallas, false)[0];
        if (!hit?.face) continue;
        const enRaiz = m.raiz.worldToLocal(hit.point.clone());
        if (enRaiz.y > cara && enRaiz.z > 0) continue;
        const nrm = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        // salpicón: una plasta plana e irregular y un par de gotitas sueltas alrededor
        const s = g0(), col = clay(lodos[i % 3], { roughness: 0.75, sheen: 0.3, clearcoat: 0.25, clearcoatRoughness: 0.5 }), tamS = (0.05 + azar() * 0.05) * k / 0.6;
        s.add(det(GEO_MANCHA, col, { esc: [1.2, 0.75, 0.16] }));
        s.add(det(GEO_MANCHA, col, { pos: [0.45, 0.3, 0], esc: [0.7, 0.55, 0.14] }));
        for (let j = 0; j < 2; j++) { const b = azar() * 7, r = 1.5 + azar() * 0.5; s.add(det(GEO_MANCHA, col, { pos: [Math.cos(b) * r, Math.sin(b) * r, 0], esc: [0.22, 0.22, 0.1] })); }
        // si la malla tiene pelaje de peluche, el lodo va encima de las puntas del pelo
        const pelo = hit.object.children.some((c) => c.name === 'pelo') ? PELO.largo * ([hit.object.material].flat()[0]?.userData?.pelo ?? 1) * hit.object.getWorldScale(V3()).x * 0.85 : 0;
        s.position.copy(hit.point).addScaledVector(nrm, 0.004 + pelo); s.quaternion.setFromUnitVectors(V3(0, 0, 1), nrm); s.rotateZ(azar() * 6);
        s.scale.setScalar(tamS); s.updateMatrixWorld(true);
        // cada pedazo se vuelve a pegar a la superficie (en las orillas curvas el plano recto los dejaba volando);
        // el que no cae sobre el cuerpo se quita
        for (const p of [...s.children]) {
          const wp = p.getWorldPosition(V3());
          rc.set(wp.clone().addScaledVector(nrm, 0.3), nrm.clone().negate());
          const h2 = rc.intersectObjects(mallas, false)[0];
          if (!h2?.face || h2.distance > 0.45) { p.removeFromParent(); continue; }
          const n2 = h2.face.normal.clone().transformDirection(h2.object.matrixWorld);
          s.worldToLocal(wp.copy(h2.point).addScaledVector(n2, 0.004 + pelo)); p.position.copy(wp);
        }
        // en las partes curvas una plasta plana se sale del cuerpo y se ve como un pedazo volando: se revisan sus
        // orillas contra la superficie; si alguna queda despegada se achica, y si aun asi no cabe, se quita
        s.updateMatrixWorld(true);
        for (const p of [...s.children]) {
          let cabe = false;
          for (let intento = 0; intento < 4 && !cabe; intento++) {
            p.updateMatrixWorld(true);
            const radio = p.getWorldScale(V3()).x, tol = Math.max(0.006, radio * 0.22);
            cabe = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]].every(([x, y]) => {
              const wp = p.localToWorld(V3(x, y, 0));
              rc.set(wp.clone().addScaledVector(nrm, 0.3), nrm.clone().negate());
              const h3 = rc.intersectObjects(mallas, false)[0];
              return h3 && Math.abs(h3.distance - 0.3) < tol + pelo;
            });
            if (!cabe) p.scale.multiplyScalar(0.72);
          }
          if (!cabe) p.removeFromParent();
        }
        if (!s.children.length) continue;
        s.updateMatrix(); hit.object.attach(s);
        s.userData.s0 = s.scale.clone(); manchas.push(s); i++;
      }
    }
    // muy sucia: moscas dando vueltas alrededor de la mascota
    const nm = suc >= 80 ? 3 : suc >= 60 ? 2 : 0;
    for (let i = 0; i < nm; i++) { const f = mosca(0.5 + i * 0.12, (1.1 + i * 0.25) * escK() / 0.6, 1.4 + i * 0.5); pivote.add(f); moscasMascota.push(f); }
  };
  const ponerHigiene = (h = {}) => {
    const antes = hig.suciedad;
    hig.suciedad = +h.suciedad || 0; hig.popos = Array.isArray(h.popos) ? h.popos : [];
    const ids = new Set(hig.popos.map((p) => p.id));
    for (const p of [...gPopos.children]) if (!ids.has(p.userData.popoId) && p.userData.recoger === undefined) { gPopos.remove(p); liberar(p); }
    for (const p of hig.popos) {
      if (gPopos.children.some((x) => x.userData.popoId === p.id)) continue;
      const g = crearPopo(p.id), [x, z] = lugarPopo(+p.x || 0, +p.z || 0);
      g.position.set(x, 0, z); g.rotation.y = Math.random() * 6; gPopos.add(g);
    }
    // las manchas cambian por escalones (no en cada actualización)
    const esc = (v) => (v < 20 ? 0 : v < 40 ? 1 : v < 60 ? 2 : v < 80 ? 3 : 4);
    if (!bano && (esc(antes) !== esc(hig.suciedad) || (esc(hig.suciedad) && !manchas.length))) ensuciar();
  };
  /* baño: tina con espuma, regadera que gotea, burbujas que suben; al final sale limpia y brillante */
  let bano = null;
  const armarTina = (r) => {
    const g = g0(), porcelana = ceramica(0xfdf6ff), oro = metal(0xf2c14e);
    g.add(malla(torno([[0, 0.05], [r * 0.92, 0.05], [r * 1.02, 0.12], [r * 1.1, 0.34], [r * 1.14, 0.5], [r * 1.1, 0.52], [r * 1.04, 0.36], [r * 0.96, 0.15], [0, 0.13]], 40), porcelana));
    g.add(malla(new THREE.TorusGeometry(r * 1.13, 0.045, 12, 48), porcelana, { pos: [0, 0.51, 0], rot: [Math.PI / 2, 0, 0] }));
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; g.add(malla(esf(0.075, 14), oro, { pos: [Math.cos(a) * r * 0.85, 0.05, Math.sin(a) * r * 0.85], esc: [1, 0.8, 1] })); }
    g.add(det(new THREE.CircleGeometry(r * 1.06, 40), matCuarto('agua-tina', () => new THREE.MeshPhysicalMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.75, roughness: 0.05, clearcoat: 1, depthWrite: false })), { pos: [0, 0.42, 0], rot: [-Math.PI / 2, 0, 0] }));
    // espuma: montoncitos blancos sobre el agua y desbordando el borde
    const espuma = clay(0xffffff, { roughness: 0.35, sheen: 0.8, sheenColor: new THREE.Color(0xd6ecff), clearcoat: 0.3 }), azar = azarCon(7), bolas = [];
    for (let i = 0; i < 34; i++) {
      const a = azar() * Math.PI * 2, rr = r * (0.55 + azar() * 0.6), tamB = 0.07 + azar() * 0.1;
      const b = det(esf(tamB, 14), espuma, { pos: [Math.cos(a) * rr, 0.45 + azar() * 0.1, Math.sin(a) * rr] }); b.userData.f = azar() * 7; g.add(b); bolas.push(b);
    }
    // regadera: tubo que baja del techo y cabeza plateada que mira hacia abajo
    const reg = g0(), cromo = metal(0xd8dde6); reg.position.set(-r * 0.4, 0, -r * 0.2); g.add(reg);
    reg.add(malla(cil(0.03, 0.03, 1.4, 10), cromo, { pos: [0, 2.75, 0] }));
    reg.add(malla(cil(0.03, 0.03, 0.4, 10), cromo, { pos: [0.18, 2.06, 0], rot: [0, 0, Math.PI / 2] }));
    reg.add(malla(cil(0.07, 0.17, 0.14, 24), cromo, { pos: [0.38, 1.98, 0] }));
    reg.add(det(new THREE.CircleGeometry(0.15, 24), luz(0xa9dcff), { pos: [0.38, 1.905, 0], rot: [Math.PI / 2, 0, 0] }));
    g.userData = { bolas, cabeza: V3(0.38 - r * 0.4, 1.9, -r * 0.2) };
    return g;
  };
  const espumaCabeza = (k) => {   // gorrito de espuma sobre la cabeza
    const g = g0(), espuma = clay(0xffffff, { roughness: 0.35, sheen: 0.8, clearcoat: 0.3 });
    [[0, 0, 0, 0.16], [0.13, -0.03, 0.03, 0.11], [-0.13, -0.03, 0.02, 0.12], [0.03, 0.12, 0, 0.1], [-0.05, -0.02, 0.13, 0.09]].forEach(([x, y, z, r]) => g.add(det(esf(r, 14), espuma, { pos: [x, y, z] })));
    return g;
  };
  const banar = (callbacks = {}) => {
    if (bano || decorando) return false;
    terminarActividad(); paseo.destino = null; pivote.position.y = 0;
    m.raiz.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(m.raiz), tam = caja.getSize(V3());
    const tina = armarTina(Math.max(0.5, Math.max(tam.x, tam.z) * 0.62)); tina.position.set(pivote.position.x, 0, pivote.position.z); tina.scale.setScalar(0.001); escena.add(tina);
    const gorro = espumaCabeza(escK()); gorro.position.set(0, caja.max.y - pivote.position.y - tam.y * 0.08, 0.06 * escK() / 0.6); pivote.add(gorro);   // entre las orejas
    bano = { t: 0, dur: 3.8, tina, gorro, gorro0: escK() / 0.6 * 1.3, cb: callbacks, eraCerca: cerca };
    if (!cerca) { ctl.acercar(); meta.d = 4.6; meta.el = 0.42; }
    return true;
  };
  const animarHigiene = (dt, t) => {
    // popós: aparecen con un rebote, huelen y sus moscas vuelan; al recogerlas se encogen girando
    for (const p of [...gPopos.children]) {
      const u = p.userData;
      if (u.recoger !== undefined) {
        u.recoger += dt; const k = u.recoger < 0.12 ? 1 + u.recoger * 2 : Math.max(0.001, 1.24 * (1 - (u.recoger - 0.12) / 0.3));
        p.scale.setScalar(k); p.rotation.y += dt * 14;
        if (u.recoger > 0.42) { gPopos.remove(p); liberar(p); }
        continue;
      }
      u.aparecer = Math.min(1, u.aparecer + dt * 2.5);
      const a = u.aparecer, rebote = a < 1 ? 1 + Math.sin(a * Math.PI) * 0.25 : 1;
      p.scale.set(a * rebote, a * (1 + Math.sin(t * 2.4 + p.position.x) * 0.03), a * rebote);
      u.olor.forEach((l) => { const f = (t * 0.45 + l.userData.fase) % 1; l.position.y = 0.42 + f * 0.35; l.material.opacity = Math.sin(f * Math.PI) * 0.85; });
      volarMoscas(u.moscas, t);
    }
    volarMoscas(moscasMascota, t);
    if (!bano) return;
    const b = bano; b.t += dt;
    const p = b.t / b.dur, entra = Math.min(1, b.t / 0.4), sale = Math.max(0, (b.t - (b.dur - 0.4)) / 0.4);
    const esc = Math.max(0.001, (entra < 1 ? 1 + Math.sin(entra * Math.PI) * 0.15 : 1) * (1 - sale));
    b.tina.scale.setScalar(esc); b.tina.position.set(pivote.position.x, 0, pivote.position.z);
    b.gorro.scale.setScalar(Math.max(0.001, b.gorro0 * Math.min(1, b.t / 0.8) * (1 - Math.max(0, (b.t - b.dur + 0.9) / 0.5)) * (1 + Math.sin(t * 9) * 0.05)));
    b.tina.userData.bolas.forEach((x) => { x.scale.setScalar(1 + Math.sin(t * 5 + x.userData.f) * 0.12); });
    // la mascota se menea feliz con los ojos cerrados mientras se talla
    if (sale === 0) {
      anim.e.cierre = 0.2; pivote.rotation.z = Math.sin(t * 10) * 0.1; brazosPose(-1.6 + Math.sin(t * 12) * 0.5, 0.35);
      const cab = b.tina.localToWorld(b.tina.userData.cabeza.clone());
      if (b.t > 0.3 && Math.floor(b.t / 0.07) !== Math.floor((b.t - dt) / 0.07)) soltarFigura('gota', { mundo: cab.clone().add(V3((Math.random() - 0.5) * 0.24, -0.05, (Math.random() - 0.5) * 0.24)), tam: 0.08, vy: -1.2, cae: true, dur: 0.8 });
      if (Math.floor(b.t / 0.13) !== Math.floor((b.t - dt) / 0.13)) soltarFigura('o', { mundo: pivote.position.clone().add(V3((Math.random() - 0.5) * 0.9, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.9)), tam: 0.1 + Math.random() * 0.14, vy: 0.5, dur: 2.2 });
    }
    manchas.forEach((s) => s.scale.copy(s.userData.s0).multiplyScalar(Math.max(0.001, 1 - p * 1.4)));   // el lodo se va
    moscasMascota.forEach((f) => { f.userData.r += dt * 1.5; f.userData.alto += dt * 0.8; });          // las moscas huyen
    if (b.t >= b.dur) {
      escena.remove(b.tina); liberar(b.tina); pivote.remove(b.gorro); liberar(b.gorro);
      pivote.rotation.z = 0; brazosPose(0); bano = null;
      hig.suciedad = 0; ensuciar();
      anim.e.salto = 1; anim.e.saludo = 1;
      for (let i = 0; i < 10; i++) soltarFigura(i % 3 ? '★' : '♥', { tam: 0.24, vy: 0.6 + Math.random() * 0.4 });
      if (!b.eraCerca) setTimeout(() => { if (!bano) ctl.alejar(); }, 1600);
      b.cb.alTerminar?.();
    }
  };

  /* ---------- punteros: 1 dedo gira (o arrastra el mueble elegido), 2 dedos hacen zoom; un toque sin mover acaricia */
  const dedos = new Map();
  let gesto = null;
  const el = renderer.domElement;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (ev) => {
    ev.stopPropagation(); try { el.setPointerCapture(ev.pointerId); } catch { /* sin captura */ }
    dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (dedos.size === 2) { const [a, b] = [...dedos.values()]; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      gesto = { tipo: 'pellizco', dist: Math.hypot(a.x - b.x, a.y - b.y), d0: meta.d, mx, my, ultD: meta.d, base: meta.objetivo.clone() }; return; }
    if (ev.button === 2 || ev.shiftKey) { gesto = { tipo: 'mover', x: ev.clientX, y: ev.clientY, base: meta.objetivo.clone(), movio: false }; return; }
    rayoDesde(ev);
    let arrastrar = null;
    if (decorando) { const o = muebleEn(); if (o) { if (o !== elegido) marcar(o); arrastrar = o; } }
    gesto = { tipo: arrastrar ? 'mueble' : 'girar', x: ev.clientX, y: ev.clientY, az: meta.az, el: meta.el, movio: false, obj: arrastrar };
  });
  el.addEventListener('pointermove', (ev) => {
    if (!dedos.has(ev.pointerId) || !gesto) return;
    dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (gesto.tipo === 'pellizco') {
      if (dedos.size === 2) {
        const [a, b] = [...dedos.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const d = gesto.d0 * gesto.dist / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
        zoomHacia(gesto.mx, gesto.my, d / gesto.ultD); gesto.ultD = meta.d;   // hacia donde estan los dedos
        mover(mx - gesto.mx, my - gesto.my, meta.objetivo.clone()); gesto.mx = mx; gesto.my = my;   // y deslizar los dos dedos te mueve
      }
      return;
    }
    if (gesto.tipo === 'mover') { gesto.movio = true; mover(ev.clientX - gesto.x, ev.clientY - gesto.y, gesto.base); return; }
    const dx = ev.clientX - gesto.x, dy = ev.clientY - gesto.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) gesto.movio = true;
    if (!gesto.movio) return;
    if (gesto.tipo === 'girar') { meta.az = gesto.az - dx * 0.008; meta.el = gesto.el + dy * 0.006; limitar(); return; }
    rayoDesde(ev);
    const p = new THREE.Vector3(), o = gesto.obj;
    if (o.userData.lugar === 'cuadro') {
      if (ray.ray.intersectPlane(planoPared, p)) { o.position.z = Math.max(-2.5, Math.min(2.6, p.z)); o.position.y = Math.max(1.0, Math.min(3.4, p.y)); }
    } else if (ray.ray.intersectPlane(planoPiso, p)) { o.position.x = Math.max(-2.6, Math.min(2.6, p.x)); o.position.z = Math.max(-2.6, Math.min(2.6, p.z)); }
  });
  const soltar = (ev) => {
    if (!dedos.has(ev.pointerId)) return;
    dedos.delete(ev.pointerId);
    const g = gesto;
    if (dedos.size === 0) gesto = null;
    if (!g) return;
    if (g.tipo === 'mueble' && g.movio) { Juego3D.pop(); cbs.alMover?.(g.obj.userData.lugar, posDe(g.obj)); return; }
    if (g.tipo === 'pellizco' || g.tipo === 'mover' || g.movio) return;
    rayoDesde(ev);
    if (decorando) { if (!muebleEn()) marcar(null); return; }
    if (op.interactivo && !bano) { const p = popoEn(); if (p) { recogerPopo(p); return; } }   // tocar una popó la recoge
    if (op.interactivo && tocaMascota()) { ctl.feliz(); op.alTocar?.(); }
  };
  el.addEventListener('pointerup', soltar); el.addEventListener('pointercancel', soltar);
  el.addEventListener('wheel', (ev) => { ev.preventDefault(); zoomHacia(ev.clientX, ev.clientY, 1 + Math.sign(ev.deltaY) * 0.12); }, { passive: false });
  el.addEventListener('contextmenu', (ev) => ev.preventDefault());   // clic derecho = mover la vista

  const ctl = controlador({ contenedor, renderer, escena, camara, encuadrar, getAnim: () => anim, sombra, comida, op: { ...op, interactivo: false }, cuarto: () => cuarto,
    cadaCuadro: (dt, t) => {
      vivir(dt, t);
      animarHigiene(dt, t);
      L.cuadro(cuarto, t);
      aplicarCamara(Math.min(1, dt * 7));
      if (anillo.visible && elegido) {
        const enPared = elegido.userData.lugar === 'cuadro';
        anillo.position.set(enPared ? -2.9 : elegido.position.x, enPared ? elegido.position.y : 0.06, elegido.position.z);
        anillo.rotation.set(enPared ? 0 : Math.PI / 2, enPared ? Math.PI / 2 : 0, 0);
        anillo.material.color.setHSL(0.71, 0.95, 0.62 + Math.sin(t * 6) * 0.08);
      }
    },
    reconstruir: (nuevas) => {
      op = { ...op, ...nuevas, mascota: { ...op.mascota, ...(nuevas.mascota || {}) }, muebles: nuevas.muebles ? { ...nuevas.muebles } : op.muebles,
        posiciones: { ...op.posiciones, ...(nuevas.posiciones || {}) } };
      const lugarSel = elegido?.userData.lugar;
      if (paseo.act?.arriba || paseo.act?.plan) terminarActividad();   // el mueble donde estaba se va a rehacer
      escena.remove(cuarto); liberar(cuarto); cuarto = construirCuarto(op); escena.add(cuarto); L.ajustar(cuarto);
      marcar(lugarSel ? cuarto.userData.muebles?.[lugarSel] || null : null);
      pivote.remove(m.raiz); liberar(m.raiz); m = ponerMascota(); ensuciar();
      if (!libre(pivote.position.x, pivote.position.z)) { pivote.position.copy(PET); paseo.destino = null; }  // un mueble nuevo le cayo encima
      anim = animador(m); anim.e.salto = 1;
    } });
  aplicarCamara(1);
  const empezarPelota = ctl.jugarPelota.bind(ctl), feliz0 = ctl.feliz;
  Object.assign(ctl, {
    // tocarla mientras duerme la despierta (se levanta y se baja de la cama); encima del sillón solo brinca de gusto
    feliz() { const a = paseo.act; if (a?.fase === 'hacer' && a.act[0] === 'dormir') despertar(true); else feliz0(); },
    jugarPelota(callbacks = {}) {
      if (decorando || !empezarPelota(callbacks)) return false;
      cerca = true; paseo.destino = null;
      meta.objetivo.set(pivote.position.x, 0.75, pivote.position.z); meta.d = 5.0; meta.el = 0.38;
      return true;
    },
    acercar() { cerca = true; if (!paseo.act) paseo.destino = null; meta.objetivo.set(pivote.position.x, 0.75, pivote.position.z); meta.d = 3.4; meta.el = 0.28; meta.az = Math.max(LIM.azMin, Math.min(LIM.azMax, cam.az)); },
    alejar() { cerca = false; meta.objetivo.set(-0.15, 1.15, -0.15); meta.d = dBase; meta.el = 0.5; meta.az = 0.66; },
    estaCerca: () => cerca,
    // solo pruebas: vista fija, dónde está la mascota y congelar el reloj de la actividad
    _camara(az, el, d, x, y, z) { Object.assign(meta, { az, el, d }); meta.objetivo.set(x, y, z); },
    _donde: () => { const b = paseo.act?.sombra || pivote.position; return [b.x, b.y + 0.5, b.z]; },
    _congelar(v) { paseo.congelada = !!v; },
    // pedirle una actividad: con mueble ('tech', 'cama', 'sillon', 'planta', 'tapete', 'lampara', 'cuadro', 'deco') va hacia él
    // (tipo opcional, ver ACTIVIDADES); 'ventana' y 'popo' también; sin mueble hace una de LIBRES donde está
    actividadActual: () => (paseo.act ? { tipo: paseo.act.act[0], fase: paseo.act.fase, t: +paseo.act.t.toFixed(1), lugar: paseo.act.lugar, prop: !!paseo.act.prop, arriba: !!paseo.act.arriba, f: paseo.act.plan ? +paseo.act.plan.f.toFixed(2) : 1, figuras: figuras.length, brazo: +largoBrazo().toFixed(3), giro: +difAng(pivote.rotation.y, Math.atan2(camara.position.x - pivote.position.x, camara.position.z - pivote.position.z)).toFixed(2) } : null),
    actividad(lugar, tipo) {
      terminarActividad();
      const libreAct = LIBRES.find((x) => x.t === (tipo || lugar));
      if (libreAct && !ACTIVIDADES[lugar]) { libreAqui(libreAct); return true; }
      for (let i = 0; i < 8; i++) {
        const a = lugar === 'ventana' ? actividadVentana() : lugar === 'popo' ? actividadPopo() : actividadEn(lugar, tipo);
        if (a) { paseo.act = { ...a, fase: 'ir', t: 0 }; paseo.destino = a.punto; return true; }
      }
      return false;
    },
    decorar(activo, callbacks = {}) { decorando = !!activo; cbs = callbacks; if (!activo) marcar(null); else if (cerca) ctl.alejar(); },
    girarElegido() {
      if (!elegido || elegido.userData.lugar === 'cuadro') return false;
      elegido.rotation.y += Math.PI / 2; Juego3D.pop(); cbs.alMover?.(elegido.userData.lugar, posDe(elegido)); return true;
    },
    elegir(lugar) { marcar(cuarto.userData.muebles?.[lugar] || null); },
    ponerHigiene,                   // { suciedad, popos: [{ id, x, z }] }: popós en el piso y lodo en la mascota
    banar,                          // baño en tina ({ alTerminar }); false si no se puede ahora
    estaBanando: () => !!bano,
  });
  return ctl;
}

/* ============================================================ jefes del mes (villanos tiernos)
   Cada punto de la tienda le quita 1 de vida. Cara segun la vida: confiado, nervioso (<40%) o mareado (derrotado). */
export const JEFES = {
  rezago:   { nombre: 'Don Rezago', lema: 'Se alimenta de los clientes olvidados.', color: 0x8f7fc7 },
  cotizon:  { nombre: 'La Cotización Olvidada', lema: 'Junta cada cotización a la que nadie le dio seguimiento.', color: 0xfff0a8 },
  fantasma: { nombre: 'El Cliente Fantasma', lema: 'Vino una vez… y nadie le volvió a llamar.', color: 0xdcd8ff },
  dormilon: { nombre: 'Don Dormilón', lema: 'Arrulla a los clientes que dejaste de visitar.', color: 0x9fb0e8 },
  regateo:  { nombre: 'La Reina del Regateo', lema: 'Te saca descuento si no defiendes el valor.', color: 0xf47fbf },
  sinmas:   { nombre: 'El Sin-Complemento', lema: 'Pintura sin brocha, taladro sin brocas: así le gusta.', color: 0x4fb3c8 },
};
const J_NEGRO = 0x2d2440, J_BOCA = 0x5a1f3a;
const jLim = (v) => Math.max(0, Math.min(1, v));
// z de la superficie de un elipsoide (radios ex, ey, ez) en (x, y): para pegar la cara al cuerpo
const jSup = (x, y, ex, ey, ez) => ez * Math.sqrt(Math.max(0, 1 - (x / ex) ** 2 - (y / ey) ** 2));
const jCol = (j, hex) => (j.derrotado ? new THREE.Color(hex).lerp(new THREE.Color(0xb9bfcc), 0.7).getHex() : hex);
const jMedia = (r, abajo = true, seg = 24) => new THREE.SphereGeometry(r, seg, Math.round(seg / 2), 0, Math.PI * 2, abajo ? Math.PI / 2 : 0, Math.PI / 2);
const jV = (x, y, z) => new THREE.Vector3(x, y, z);
const jTubo = (pts, r = 0.02, seg = 20) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 6);
function jTex(w, h, dibujar) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; dibujar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function jEspiral(r = 0.15) {
  const pts = []; for (let i = 0; i <= 36; i++) { const k = i / 36, a = k * Math.PI * 4.6; pts.push(jV(Math.cos(a) * r * (0.12 + k * 0.88), Math.sin(a) * r * (0.12 + k * 0.88), 0)); }
  return jTubo(pts, r * 0.13, 60);
}
// ojo de jefe: esclera + pupila + parpado caido (confiado), pupila chiquita (nervioso), espiral, >< (golpe), dormido, hueco (fantasma)
function jOjo(estilo, s, c = {}) {
  const g = g0(), k = c.tam ?? 1, negro = plano(J_NEGRO);
  const ceja = (y, rz, largo = 0.24) => g.add(malla(new THREE.CapsuleGeometry(0.042 * k, largo * k, 4, 8), negro, { pos: [0, y * k * (c.cejaK ?? 1), 0.06], rot: [0, 0, rz] }));
  if (estilo === 'mareado') { g.add(malla(jEspiral(0.17 * k), negro, { pos: [0, 0, 0.1] })); return g; }
  if (estilo === 'golpe') {
    for (const d of [1, -1]) g.add(malla(new THREE.CapsuleGeometry(0.038 * k, 0.17 * k, 4, 8), negro, { pos: [-s * 0.02 * k, d * 0.06 * k, 0.09], rot: [0, 0, Math.PI / 2 + d * s * 0.55] }));
    return g;
  }
  if (estilo === 'dormido') {
    g.add(malla(arco(0.13 * k, 0.034 * k), negro, { rot: [0, 0, Math.PI], pos: [0, 0.04 * k, 0.1] }));
    for (const i of [0, 1]) g.add(malla(new THREE.CapsuleGeometry(0.016 * k, 0.07 * k, 3, 6), negro, { pos: [s * (0.12 + i * 0.03) * k, -0.04 * k - i * 0.05 * k, 0.09], rot: [0, 0, s * (0.9 + i * 0.5)] }));
    return g;
  }
  const nerv = estilo === 'nervioso' || estilo === 'huecoChico';
  if (estilo === 'hueco' || estilo === 'huecoChico' || c.esclera === false) {
    const r = (nerv ? 0.13 : 0.17) * k;
    g.add(malla(esf(r, 24), brillo(J_NEGRO), { esc: [0.85, 1.22, 0.45] }));
    g.add(malla(esf(r * 0.34, 10), plano(0xffffff), { pos: [-r * 0.3, r * 0.5, r * 0.42] }));
    g.add(malla(esf(r * 0.16, 8), plano(0xffffff), { pos: [r * 0.3, -r * 0.45, r * 0.4] }));
  } else {
    g.add(malla(esf(0.19 * k, 28), clay(0xffffff, { roughness: 0.35 }), { esc: [0.9, 1.1, 0.45] }));
    const rp = (nerv ? 0.065 : 0.105) * k, pup = g0();
    pup.position.set(nerv ? 0 : s * -0.035 * k, nerv ? 0.01 * k : -0.035 * k, 0.07 * k);
    pup.add(malla(esf(rp, 20), brillo(J_NEGRO), { esc: [1, 1.12, 0.5] }));
    pup.add(malla(esf(rp * 0.36, 10), plano(0xffffff), { pos: [-rp * 0.35, rp * 0.42, rp * 0.45] }));
    g.add(pup); g.userData.pupila = pup;
  }
  // parpado caido: mirada de "aqui mando yo"
  if (!nerv && c.piel !== undefined) g.add(malla(jMedia(0.205 * k, false), clay(c.piel), { esc: [0.97, 1.12, 0.55], pos: [0, -0.005 * k, 0.004], rot: [0, 0, s * (c.parpado ?? 0.3)] }));
  if (c.pestanas) for (let i = 0; i < 3; i++) { const a = 0.45 + i * 0.32; g.add(malla(new THREE.CapsuleGeometry(0.02 * k, 0.08 * k, 3, 6), negro, { pos: [s * Math.cos(a) * 0.2 * k, Math.sin(a) * 0.22 * k + 0.02 * k, 0.03], rot: [0, 0, -s * (Math.PI / 2 - a)] })); }
  if (c.cejas) {
    if (nerv) ceja(0.34, s * -1.92);
    else if (c.cejaAlta && s === 1) ceja(0.4, s * -1.5);
    else ceja(0.31, s * -1.22);
  }
  return g;
}
function jCara(j, c) {
  const ojos = g0(), golpe = g0(); ojos.position.y = golpe.position.y = c.y; golpe.visible = false;
  for (const s of [-1, 1]) {
    let est = j.animo;
    if (est !== 'mareado' && c.estilo === 'dormido') est = j.animo === 'nervioso' && s === 1 ? 'nervioso' : 'dormido';
    if (est !== 'mareado' && c.estilo === 'hueco') est = j.animo === 'nervioso' ? 'huecoChico' : 'hueco';
    for (const [grupo, e] of [[ojos, est], [golpe, 'golpe']]) {
      const o = g0(); o.position.set(s * c.sep, 0, c.z); o.rotation.y = s * (c.giro ?? 0.35); o.add(jOjo(e, s, c)); grupo.add(o);
    }
  }
  (c.padre || j.cuerpo).add(ojos, golpe); j.ojos = ojos; j.ojosGolpe = golpe;
}
// bocas: sonrisa con colmillos, grunido, "o", nervio (dientes apretados), lengua (mareado), puchero
function jBoca(estilo, k = 1) {
  const g = g0(), osc = plano(J_BOCA), blanco = clay(0xffffff), rosa = clay(0xff7b9c);
  if (estilo === 'sonrisa') {
    g.add(malla(jMedia(0.25 * k), osc, { esc: [1.45, 1, 0.4] }));
    g.add(malla(esf(0.12 * k, 16), rosa, { pos: [0.04 * k, -0.15 * k, 0.07 * k], esc: [1.4, 0.55, 0.4] }));
    for (const s of [-1, 1]) g.add(malla(new THREE.ConeGeometry(0.05 * k, 0.12 * k, 10), blanco, { pos: [s * 0.17 * k, -0.05 * k, 0.08 * k], rot: [Math.PI, 0, 0] }));
  } else if (estilo === 'grunido') {
    g.add(malla(jMedia(0.22 * k, false), osc, { pos: [0, -0.08 * k, 0], esc: [1.35, 0.8, 0.4] }));
    for (let i = -1; i <= 1; i++) g.add(malla(new THREE.ConeGeometry(0.04 * k, 0.08 * k, 8), blanco, { pos: [i * 0.1 * k, -0.045 * k, 0.07 * k] }));
  } else if (estilo === 'o') {
    g.add(malla(esf(0.075 * k, 16), osc, { esc: [1, 1.2, 0.45] }));
  } else if (estilo === 'nervio') {
    g.add(malla(new THREE.CapsuleGeometry(0.1 * k, 0.3 * k, 4, 12), osc, { rot: [0, 0, Math.PI / 2], esc: [1, 1, 0.45] }));
    g.add(malla(new THREE.BoxGeometry(0.36 * k, 0.1 * k, 0.04 * k), blanco, { pos: [0, 0, 0.035 * k] }));
    for (const x of [-0.09, 0, 0.09]) g.add(malla(new THREE.BoxGeometry(0.012 * k, 0.1 * k, 0.01), osc, { pos: [x * k, 0, 0.056 * k] }));
  } else if (estilo === 'lengua') {
    g.add(malla(arco(0.13 * k, 0.03 * k), osc, { rot: [0, 0, Math.PI] }));
    g.add(malla(esf(0.07 * k, 14), rosa, { pos: [0.05 * k, -0.17 * k, 0.03 * k], esc: [1, 1.3, 0.5] }));
  } else if (estilo === 'puchero') {
    g.add(malla(arco(0.13 * k, 0.035 * k), osc, { pos: [0, -0.06 * k, 0] }));
  }
  return g;
}
const jBocaDe = (j, normal, k) => jBoca(j.derrotado ? 'lengua' : j.animo === 'nervioso' ? 'nervio' : normal, k);
function jCachetes(padre, x, y, z, giro = 0.5, t = 0.34) {
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(t, t * 0.62), new THREE.MeshBasicMaterial({ map: TEX_CACHETE, transparent: true, depthWrite: false, opacity: 0.8 }));
    m.position.set(s * x, y, z); m.rotation.y = s * giro; padre.add(m);
  }
}
function jPies(padre, col, x, y, z, k = 1) { for (const s of [-1, 1]) padre.add(malla(esf(0.24 * k, 24), clay(col), { pos: [s * x, y, z], esc: [1.15, 0.55, 1.2] })); }
function jBrazo(j, s, col, pos, k = 1) {
  const piv = g0(); piv.position.set(...pos); piv.add(malla(esf(0.2 * k, 24), clay(col), { pos: [s * 0.05, -0.03, 0] })); j.cuerpo.add(piv); j.brazos.push(piv); return piv;
}
function jGota(k = 1) {
  const g = g0(), m = brillo(0x8fd3ff);
  g.add(malla(esf(0.07 * k, 16), m, { esc: [1, 1, 0.7] }));
  g.add(malla(new THREE.ConeGeometry(0.066 * k, 0.12 * k, 16), m, { pos: [0, 0.08 * k, 0], esc: [1, 1, 0.7] }));
  return g;
}
function jEstrellas(y) {
  const g = g0(); g.position.y = y; g.visible = false;
  const cols = [0xffd23f, 0xff8fc8, 0x8fd3ff, 0xffd23f];
  for (let i = 0; i < 4; i++) { const e = malla(estrellaGeo(0.12, 0.055), brillo(cols[i])); e.userData.a = (i / 4) * Math.PI * 2; g.add(e); }
  return g;
}
function jBandera() {
  const g = g0();
  g.add(malla(new THREE.CylinderGeometry(0.022, 0.022, 0.8, 8), clay(0xc9926a), { pos: [0, 0.32, 0] }));
  const tela = g0(); tela.position.set(0, 0.62, 0); g.add(tela);
  tela.add(malla(new THREE.BoxGeometry(0.38, 0.24, 0.015), clay(0xffffff), { pos: [0.2, 0, 0] }));
  g.userData.tela = tela; return g;
}
// tela de arana: abanico en el cuarto de arriba-izquierda
function jTelarana(r = 0.34) {
  const g = g0(), m = plano(0xffffff, { transparent: true, opacity: 0.9 });
  for (let i = 0; i <= 3; i++) { const a = Math.PI / 2 + (i / 3) * Math.PI / 2; g.add(malla(new THREE.CylinderGeometry(0.011, 0.011, r, 4), m, { pos: [Math.cos(a) * r / 2, Math.sin(a) * r / 2, 0], rot: [0, 0, a - Math.PI / 2] })); }
  for (const f of [0.38, 0.68, 0.96]) g.add(malla(new THREE.TorusGeometry(r * f, 0.009, 4, 12, Math.PI / 2), m, { rot: [0, 0, Math.PI / 2] }));
  return g;
}
// pelusa de polvo con ojitos (abandono)
function jPelusa(k = 1) {
  const g = g0(), m = clay(0xcfc9d8);
  for (let i = 0; i < 8; i++) { const a = i * 2.4; g.add(malla(esf((0.06 + (i % 3) * 0.012) * k, 10), m, { pos: [Math.cos(a) * 0.075 * k, (0.04 + Math.abs(Math.sin(i * 1.7)) * 0.05) * k, Math.sin(a) * 0.05 * k] })); }
  for (const s of [-1, 1]) g.add(malla(esf(0.018 * k, 8), plano(J_NEGRO), { pos: [s * 0.035 * k, 0.07 * k, 0.1 * k] }));
  return g;
}
// tarjeta de cliente (con su monito) o ticket largo
function jTarjeta(tipo = 'cliente') {
  const g = g0(), linea = plano(0xb9b3c9);
  if (tipo === 'ticket') {
    g.add(malla(new THREE.BoxGeometry(0.2, 0.34, 0.015), clay(0xfffdf5)));
    for (let i = 0; i < 4; i++) g.add(malla(new THREE.BoxGeometry(i === 3 ? 0.07 : 0.13, 0.02, 0.01), i === 3 ? plano(0x3fbf7f) : linea, { pos: [i === 3 ? 0.03 : 0, 0.11 - i * 0.065, 0.01] }));
    return g;
  }
  g.add(malla(new THREE.BoxGeometry(0.36, 0.24, 0.025), clay(0xffffff)));
  g.add(malla(new THREE.BoxGeometry(0.36, 0.05, 0.028), clay(0x7fc8ff), { pos: [0, 0.095, 0] }));
  g.add(malla(esf(0.045, 12), clay(0xffc9a3), { pos: [-0.1, -0.005, 0.014], esc: [1, 1, 0.4] }));
  g.add(malla(jMedia(0.07, false, 12), clay(0x6f9cff), { pos: [-0.1, -0.105, 0.014], esc: [1, 0.85, 0.3] }));
  g.add(malla(new THREE.BoxGeometry(0.15, 0.022, 0.01), linea, { pos: [0.06, 0.01, 0.015] }));
  g.add(malla(new THREE.BoxGeometry(0.1, 0.022, 0.01), linea, { pos: [0.035, -0.045, 0.015] }));
  return g;
}
function jReloj(oro) {
  const g = g0(), osc = plano(J_NEGRO);
  g.add(malla(new THREE.CylinderGeometry(0.21, 0.21, 0.08, 32), oro, { rot: [Math.PI / 2, 0, 0] }));
  g.add(malla(new THREE.CylinderGeometry(0.175, 0.175, 0.02, 32), clay(0xfffaf0), { pos: [0, 0, 0.035], rot: [Math.PI / 2, 0, 0] }));
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; g.add(malla(esf(0.02, 6), osc, { pos: [Math.sin(a) * 0.13, Math.cos(a) * 0.13, 0.05] })); }
  const mano = (largo, grueso) => { const p = g0(); p.position.z = 0.052; p.add(malla(new THREE.BoxGeometry(grueso, largo, 0.01), osc, { pos: [0, largo / 2, 0] })); g.add(p); return p; };
  const minutero = mano(0.14, 0.022), horario = mano(0.09, 0.03);
  g.add(malla(esf(0.022, 8), oro, { pos: [0, 0, 0.056] }));
  g.add(malla(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10), oro, { pos: [0, 0.24, 0] }));
  g.add(malla(new THREE.TorusGeometry(0.05, 0.015, 6, 16), oro, { pos: [0, 0.31, 0] }));
  return { g, minutero, horario };
}

/* ---- Don Rezago: un calendario de bloc viejito y presumido, atorado en 1987. Hojas cremita sobre tapa lila, arillos de
   alambre de copete, cejas tupidas (una arriba), nariz de bola, bigote de morsa enroscado, monoculo de oro y su sello de
   VENCIDO en la mano; zapatea impaciente. Golpe: se le arranca una hoja. Derrotado: arillos chuecos, hojas regadas.
   Pocas piezas grandes y limpias: se lee de un vistazo aun en chiquito. */
// polilla de peluche (alas que aletean en userData.alas)
function jPolilla(j, k = 1) {
  const g = g0(), alas = [], mAla = clay(jCol(j, 0xefe4d0), { side: THREE.DoubleSide }), mCu = clay(jCol(j, 0x9a8472)), mMan = clay(jCol(j, 0xc7b08f)), negro = plano(J_NEGRO);
  g.add(malla(new THREE.CapsuleGeometry(0.035 * k, 0.08 * k, 3, 8), mCu));
  g.add(malla(esf(0.045 * k, 10), mCu, { pos: [0, 0.075 * k, 0.005] }));
  for (const s of [-1, 1]) {
    const p = g0(); g.add(p); alas.push(p);
    p.add(det(new THREE.CircleGeometry(0.11 * k, 14), mAla, { pos: [s * 0.11 * k, 0.035 * k, -0.005], esc: [1.15, 0.85, 1], rot: [0, 0, s * 0.35] }));
    p.add(det(new THREE.CircleGeometry(0.07 * k, 12), mAla, { pos: [s * 0.08 * k, -0.065 * k, -0.006], rot: [0, 0, s * -0.4] }));
    p.add(det(new THREE.CircleGeometry(0.035 * k, 10), mMan, { pos: [s * 0.13 * k, 0.05 * k, 0.001] }));
    g.add(det(esf(0.014 * k, 6), negro, { pos: [s * 0.018 * k, 0.09 * k, 0.035 * k] }));
    g.add(det(new THREE.CapsuleGeometry(0.007 * k, 0.07 * k, 2, 4), mCu, { pos: [s * 0.035 * k, 0.15 * k, 0], rot: [0, 0, -s * 0.5] }));
  }
  g.userData.alas = alas; return g;
}
// dos polillas que revolotean alrededor (derrotado: se van volando). pos = [[x, y], [x, y]]
function rzPolillas(j, pos) {
  const muerto = j.derrotado, pol = [];
  for (let i = 0; i < 2; i++) { const p = jPolilla(j, 1.2 - i * 0.12); p.userData.fase = i / 2; j.raiz.add(p); pol.push(p); }
  return (t) => pol.forEach((p, i) => {
    const f = p.userData.fase, a = f * Math.PI * 2 + t * 0.7;
    if (muerto) { const k = (t * 0.22 + f) % 1; p.position.set(-0.9 + f * 1.8 + Math.sin(t * 3 + a) * 0.25 * k, -0.6 + k * 2.6, 0.6 + Math.cos(a) * 0.3); p.scale.setScalar(Math.sin(k * Math.PI) * 1.1); }
    else { const [x0, y0] = pos[i]; p.position.set(x0 + Math.sin(t * 1.3 + f * 4) * 0.2, y0 + Math.sin(t * 2.6 + f * 2) * 0.14, 0.4 + Math.cos(t * 1.3) * 0.15); }
    p.rotation.set(0.15, Math.sin(a) * 0.4, Math.sin(t * 2 + f * 3) * 0.25);
    p.userData.alas.forEach((w, k) => (w.rotation.y = (k ? -1 : 1) * Math.sin(t * 22 + f * 9) * 1.0));
  });
}
// monoculo de oro con su vidrio
function rzMonoculo(j, r = 0.22) {
  const m = g0(); m.add(malla(new THREE.TorusGeometry(r, r * 0.18, 10, 36), brillo(jCol(j, 0xffc23a))));
  m.add(det(new THREE.CircleGeometry(r * 0.92, 28), plano(0xe6f6ff, { transparent: true, opacity: 0.28, depthWrite: false }))); return m;
}
function jefeRezago(j) {
  const { cuerpo } = j, muerto = j.derrotado, nerv = j.animo === 'nervioso', confiado = j.animo === 'confiado';
  const colB = jCol(j, 0x8f7fd0), tapa = clay(colB, { roughness: 0.5, clearcoat: 0.5 }), colH = jCol(j, 0xf8ecd2), hoja = clay(colH);
  const canas = clay(jCol(j, 0xaea8c0)), colR = jCol(j, 0xff6f86), plata = brillo(jCol(j, 0xd7dbe6));
  const W = 1.5, H = 1.7, Y = 0.0, FZ = 0.27;
  // block: tapa lila atras, hojas cremita al frente con sus orillas
  cuerpo.add(malla(cajaR(W + 0.16, H + 0.12, 0.26, 0.12, 3), tapa, { pos: [0, Y - 0.02, -0.22] }));
  cuerpo.add(malla(cajaR(W, H, 0.44, 0.1, 3), hoja, { pos: [0, Y, 0.05] }));
  for (const dz of [-0.06, 0.04, 0.14]) for (const s of [-1, 1]) cuerpo.add(det(new THREE.BoxGeometry(0.012, H - 0.24, 0.012), plano(jCol(j, 0xd8c8a6)), { pos: [s * (W / 2 + 0.002), Y, dz] }));
  const rojo = '#' + new THREE.Color(colR).getHexString(), papel = '#' + new THREE.Color(colH).getHexString();
  const tx = jTex(300, 340, (x, w, h) => {
    x.fillStyle = papel; x.fillRect(0, 0, w, h);
    x.fillStyle = rojo; x.fillRect(0, 0, w, h * 0.27);
    x.fillStyle = '#fffaf0'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 72px Nunito, Arial, sans-serif'; x.fillText('1987', w / 2, h * 0.145);
    x.fillStyle = '#' + new THREE.Color(jCol(j, 0xe2d2ae)).getHexString(); x.beginPath(); x.moveTo(w, h); x.lineTo(w - 100, h); x.lineTo(w, h - 100); x.fill();
  });
  const mHoja = clay(0xffffff, { map: tx, side: THREE.DoubleSide });
  cuerpo.add(det(new THREE.PlaneGeometry(W - 0.12, H - 0.12), mHoja, { pos: [0, Y, FZ + 0.003] }));
  // esquina enrollada (nervioso: se enrolla mas)
  const rizo = g0(); rizo.position.set(W / 2 - 0.24, Y - H / 2 + 0.24, FZ + 0.07); rizo.rotation.z = Math.PI / 4; cuerpo.add(rizo);
  rizo.add(malla(new THREE.CylinderGeometry(0.085, 0.085, 0.4, 20), hoja, { rot: [0, 0, Math.PI / 2] }));
  if (!confiado) rizo.scale.setScalar(1.35);
  // arillos de alambre arriba: su copete (derrotado: chuecos y uno se cayo)
  const arillos = g0(); arillos.position.set(0, Y + H / 2 + 0.02, -0.08); cuerpo.add(arillos);
  const chueco = [0.45, -0.3, 0.6, 0, -0.5];
  for (let i = 0; i < 5; i++) {
    if (muerto && i === 3) continue;
    const a = malla(new THREE.TorusGeometry(0.16, 0.045, 10, 24), plata, { pos: [-0.52 + i * 0.26, 0.02 + (i === 2 ? 0.03 : 0), 0], rot: [muerto ? chueco[i] : 0, Math.PI / 2, 0] });
    a.userData.y0 = a.position.y; arillos.add(a);
  }
  // cara: ojo izquierdo entrecerrado, el derecho bien abierto tras el monoculo
  jCara(j, { y: Y - 0.04, sep: 0.3, z: FZ + 0.02, giro: 0, tam: 1.05, piel: oscurecer(colH, 0.12), parpado: 0.42 });
  if (confiado) { const o = j.ojos.children[1].children[0]; o.remove(o.children[o.children.length - 1]); }
  // cejas de viejito: tupidas y canosas; una arriba (presumido)
  const cejas = [-1, 1].map((s) => {
    const c = g0(); for (let i = 0; i < 3; i++) c.add(malla(esf(0.062 + i * 0.016, 16), canas, { pos: [s * (0.1 - i * 0.115), (i === 1 ? 0.012 : 0), 0], esc: [1.3, 0.78, 0.6] }));
    cuerpo.add(c); return c;
  });
  const [cI, cD] = cejas, zC = FZ + 0.07;
  if (confiado) { cI.position.set(-0.3, Y + 0.2, zC); cI.rotation.z = -0.28; cD.position.set(0.31, Y + 0.36, zC); cD.rotation.z = 0.12; }
  else if (nerv) { cI.position.set(-0.3, Y + 0.31, zC); cI.rotation.z = 0.32; cD.position.set(0.3, Y + 0.31, zC); cD.rotation.z = -0.32; }
  else { cI.position.set(-0.3, Y + 0.24, zC); cI.rotation.z = 0.3; cD.position.set(0.3, Y + 0.24, zC); cD.rotation.z = -0.3; }
  // nariz de bola, coral
  cuerpo.add(malla(esf(0.11, 20), clay(colR, { clearcoat: 0.6, roughness: 0.4 }), { pos: [0, Y - 0.22, FZ + 0.08], esc: [1.15, 0.95, 0.8] }));
  // bigote de morsa con puntas enroscadas (nervioso / derrotado: se le cae)
  const bigote = [-1, 1].map((s) => {
    const b = g0(); b.position.set(0, Y - 0.35, FZ + 0.06); b.scale.x = s;
    b.add(malla(esf(0.2, 20), canas, { pos: [0.15, 0, 0], rot: [0, 0, -0.22], esc: [1.02, 0.62, 0.55] }));
    b.add(malla(new THREE.TorusGeometry(0.07, 0.036, 10, 20, Math.PI * 1.4), canas, { pos: [0.35, 0.0, 0.0], rot: [0, 0, -Math.PI / 2] }));
    cuerpo.add(b); return b;
  });
  const caeB = confiado ? 0 : 0.28;
  let boca; if (confiado) { boca = jBoca('sonrisa', 0.6); boca.rotation.z = 0.14; } else boca = jBocaDe(j, 'sonrisa', 0.6);
  boca.position.set(0.04, Y - 0.5, FZ + 0.02); boca.scale.z = 0.6; cuerpo.add(boca);
  jCachetes(cuerpo, 0.53, Y - 0.26, FZ + 0.03, 0, 0.24);
  // monoculo de oro (nervioso: se le salta del ojo)
  let mono = null;
  if (!muerto) {
    mono = rzMonoculo(j, 0.23); cuerpo.add(mono);
    if (confiado) mono.position.set(0.3, Y - 0.04, FZ + 0.13);
    else { mono.position.set(0.62, Y + 0.5, FZ + 0.25); mono.rotation.set(0.3, -0.5, 0.6); mono.scale.setScalar(0.8); }
  }
  // brazos chatos; en la derecha su sello de VENCIDO listo para pegarte
  for (const s of [-1, 1]) jBrazo(j, s, colB, [s * 0.86, Y - 0.32, 0.02], 0.9);
  const sello = g0(), mango = clay(jCol(j, 0x4f3f86), { clearcoat: 0.5, roughness: 0.4 });
  sello.add(malla(esf(0.13, 20), mango, { pos: [0, 0.38, 0] }));
  sello.add(malla(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 14), mango, { pos: [0, 0.22, 0] }));
  sello.add(malla(cajaR(0.42, 0.13, 0.26, 0.04, 2), clay(colR), { pos: [0, 0.06, 0] }));
  sello.add(malla(new THREE.BoxGeometry(0.38, 0.04, 0.22), clay(oscurecer(colR, 0.35)), { pos: [0, -0.025, 0] }));
  const txS = jTex(200, 56, (x, w, h) => { x.fillStyle = rojo; x.fillRect(0, 0, w, h); x.fillStyle = '#fffaf0'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 38px Nunito, Arial, sans-serif'; x.fillText('VENCIDO', w / 2, h / 2 + 2); });
  sello.add(det(new THREE.PlaneGeometry(0.38, 0.106), clay(0xffffff, { map: txS }), { pos: [0, 0.06, 0.132] }));
  if (muerto) { sello.position.set(-1.15, -1.02, 0.75); sello.rotation.set(0, 0.5, Math.PI / 2 + 0.1); j.raiz.add(sello); }
  else { sello.position.set(0.12, 0.02, 0.18); sello.rotation.z = 0.2; sello.scale.setScalar(1.15); j.brazos[1].add(sello); }
  // pies (el derecho zapatea, impaciente)
  const pies = [-1, 1].map((s) => { const p = g0(); p.position.set(s * 0.38, -0.98, -0.12); p.add(malla(esf(0.228, 24), clay(colB), { pos: [0, 0, 0.17], esc: [1.15, 0.55, 1.2] })); cuerpo.add(p); return p; });
  // hoja que sale volando al pegarle; derrotado: hojas regadas en el piso
  const volante = g0(); volante.visible = false; j.raiz.add(volante);
  volante.add(det(new THREE.PlaneGeometry(W - 0.12, H - 0.12), plano(0xffffff, { map: tx, side: THREE.DoubleSide })));
  if (muerto) for (const [x, z, r] of [[-0.55, 1.05, 0.5], [1.25, 0.55, -0.7]]) j.raiz.add(det(new THREE.PlaneGeometry((W - 0.12) * 0.42, (H - 0.12) * 0.42), mHoja, { pos: [x, -1.085, z], rot: [-Math.PI / 2, 0, r] }));
  if (muerto) { bigote.forEach((b) => (b.rotation.z = -0.32)); rizo.scale.setScalar(1.2); }
  const polillas = rzPolillas(j, [[-1.3, 1.2], [1.35, 1.05]]);
  Object.assign(j, { cima: muerto ? 1.05 : 1.3, sienes: [[-0.62, 0.32, 0.4], [0.62, 0.3, 0.4]], mano: [1.05, -0.4, 0.3] });
  j.paso = (t, dt, g = 0) => {
    polillas(t);
    rizo.rotation.x = Math.sin(t * (nerv ? 12 : 2)) * (nerv ? 0.25 : 0.12);
    arillos.rotation.z = Math.sin(t * 1.7) * 0.03;
    arillos.children.forEach((a, i) => (a.position.y = a.userData.y0 + Math.abs(Math.sin(t * 34 + i * 1.7)) * g * 0.16));
    if (!muerto) {
      j.brazos[0].rotation.z = 0.2 + Math.sin(t * 1.6) * 0.08;
      j.brazos[1].rotation.z = confiado ? -0.25 - Math.abs(Math.sin(t * 3)) * 0.12 : -0.1 + Math.sin(t * 9) * 0.06;
      bigote.forEach((b) => (b.rotation.z = -caeB + Math.sin(t * 2.3) * 0.035));
    }
    if (confiado) { pies[1].rotation.x = -Math.max(0, Math.sin(t * 6)) * 0.32; cD.position.y = Y + 0.36 + Math.max(0, Math.sin(t * 1.3)) ** 12 * 0.07; }
    if (mono && nerv) { mono.position.y = Y + 0.5 + Math.abs(Math.sin(t * 6)) * 0.08; mono.rotation.z = 0.6 + Math.sin(t * 6) * 0.2; }
    volante.visible = !muerto && g > 0.03;
    if (volante.visible) { const k = 1 - g; volante.position.set(-0.3 - k * 1.5, 0.45 + k * 1.3 - k * k * 0.5, FZ + 0.35 + k * 0.3); volante.rotation.set(k * 1.1, k * 0.6, 0.3 + k * 2.4); volante.scale.setScalar(0.5 - k * 0.12); }
  };
}

/* ---- La Cotizacion Olvidada: monton de hojas en triplicado (blanca, rosa, amarilla, azul), con clip y sello PENDIENTE */
function jefeCotizon(j) {
  const { cuerpo } = j, muerto = j.derrotado, nerv = j.animo === 'nervioso';
  const W = 1.5, H = 1.85, Y = -0.86 + H / 2;
  const copias = [];
  [[0xffcfdc, -0.13, 0.05, -0.33, 0.1], [0xfff0a8, 0.13, -0.02, -0.22, -0.08], [0xcfe6ff, -0.05, 0.08, -0.11, 0.05]].forEach(([c, dx, dy, z, rz]) => {
    const h = malla(new THREE.BoxGeometry(W, H, 0.04), clay(jCol(j, c)), { pos: [dx, Y + dy, z], rot: [0, 0, rz] }); h.userData.rz = rz; cuerpo.add(h); copias.push(h);
  });
  cuerpo.add(malla(new THREE.BoxGeometry(W, H, 0.05), clay(jCol(j, 0xfffcf5)), { pos: [0, Y, 0] }));
  const tex = jTex(256, 316, (x, w, h) => {
    x.fillStyle = '#fffcf5'; x.fillRect(0, 0, w, h);
    x.fillStyle = muerto ? '#b3b0bd' : '#ff8a4c'; x.beginPath(); x.roundRect(16, 14, w - 32, 40, 10); x.fill();
    x.fillStyle = '#fff'; x.font = 'bold 25px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('COTIZACIÓN', w / 2, 35);
    x.fillStyle = '#d3cee0'; for (let i = 0; i < 3; i++) x.fillRect(22, 236 + i * 15, i === 2 ? 90 : 130, 7);
    x.fillStyle = '#6b6480'; x.font = 'bold 21px sans-serif'; x.textAlign = 'right'; x.fillText('V-COT 0420', w - 20, 252);  // folio, nunca montos
    x.save(); x.translate(w / 2, 286); x.rotate(-0.12); x.strokeStyle = x.fillStyle = muerto ? 'rgba(140,140,150,0.8)' : 'rgba(228,52,70,0.88)'; x.lineWidth = 5;
    x.strokeRect(-94, -19, 188, 38); x.font = 'bold 27px sans-serif'; x.textAlign = 'center'; x.fillText('PENDIENTE', 0, 2); x.restore();
  });
  cuerpo.add(malla(new THREE.PlaneGeometry(W, H), clay(0xffffff, { map: tex }), { pos: [0, Y, 0.027] }));
  // esquina doblada que aletea
  const oreja = g0(); oreja.position.set(W / 2, Y + H / 2, 0.03); cuerpo.add(oreja);
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(-0.32, 0); s.lineTo(0, -0.32); s.lineTo(0, 0);
  oreja.add(malla(new THREE.ShapeGeometry(s), clay(jCol(j, 0xe9e1cf), { side: THREE.DoubleSide }), { pos: [-0.01, -0.01, 0.01] }));
  // clip de presion arriba
  const clip = g0(); clip.position.set(-0.15, Y + H / 2, -0.12); clip.rotation.z = 0.08; cuerpo.add(clip);
  clip.add(malla(new THREE.BoxGeometry(0.46, 0.2, 0.5), clay(jCol(j, 0x2f2b3d)), { pos: [0, 0, 0] }));
  for (const sx of [-1, 1]) clip.add(malla(new THREE.TorusGeometry(0.16, 0.022, 8, 20, Math.PI), metal(0xd7dde8), { pos: [sx * 0.07, 0.1, 0], rot: [0, Math.PI / 2, 0], esc: [1, 1.3, 1] }));
  // cara
  jCara(j, { y: Y + 0.12, sep: 0.34, z: 0.04, giro: 0, tam: 1.1, esclera: false, piel: 0xfffcf5, parpado: 0.35, cejas: true });
  const boca = jBocaDe(j, 'grunido', 1.1); boca.position.set(0, Y - 0.24, 0.06); cuerpo.add(boca);
  jCachetes(cuerpo, 0.5, Y - 0.1, 0.05, 0, 0.3);
  const tela = jTelarana(0.36); tela.position.set(-W / 2 + 0.02, Y + H / 2 - 0.02, 0.04); tela.rotation.z = -Math.PI / 2; cuerpo.add(tela);
  jBrazo(j, -1, 0xfffcf5, [-0.82, Y - 0.25, 0.12]); jBrazo(j, 1, 0xfffcf5, [0.82, Y - 0.25, 0.12]);
  jPies(cuerpo, jCol(j, 0x5b4636), 0.38, -0.98, 0.15, 0.9);
  // notitas amarillas de "llamar al cliente" que nadie hizo
  const notas = g0(); j.raiz.add(notas);
  for (let i = 0; i < 3; i++) {
    const n = g0(); n.add(malla(new THREE.BoxGeometry(0.26, 0.26, 0.012), clay(jCol(j, 0xffe066))));
    n.add(malla(new THREE.BoxGeometry(0.16, 0.02, 0.01), plano(0xc9a227), { pos: [0, 0.04, 0.01] })); n.add(malla(new THREE.BoxGeometry(0.11, 0.02, 0.01), plano(0xc9a227), { pos: [-0.02, -0.03, 0.01] }));
    n.userData.fase = i / 3; notas.add(n);
  }
  Object.assign(j, { cima: 1.4, sienes: [[-0.6, Y + 0.38, 0.12], [0.62, Y + 0.34, 0.12]], mano: [0.95, -0.3, 0.25] });
  j.paso = (t) => {
    copias.forEach((h, i) => { h.rotation.z = h.userData.rz + Math.sin(t * (nerv ? 9 : 3) + i * 1.7) * 0.025; });
    oreja.rotation.x = -0.2 - Math.abs(Math.sin(t * 2.5)) * 0.5;
    boca.scale.y = 1 + Math.sin(t * 8) * 0.08;
    if (!muerto) { j.brazos[1].rotation.z = 0.4 + Math.sin(t * 6) * 0.35; j.brazos[1].position.y = Y - 0.1 + Math.abs(Math.sin(t * 6)) * 0.12; }
    // las notitas revolotean a los lados (nunca tapan la cara)
    notas.children.forEach((n, i) => { const [x, y] = [[-1.2, 0.7], [1.22, 0.85], [1.15, -0.15]][i], f = t * 2 + i * 2; n.position.set(x + Math.sin(f) * 0.08, y + Math.sin(f * 0.7) * 0.12, 0.2); n.rotation.set(0.15, Math.sin(f) * 0.6, Math.sin(f * 1.3) * 0.35); });
  };
}

/* ---- El Cliente Fantasma: sabanita que flota, aparece y desaparece; te deja en "visto" y se lleva su canasta vacia */
function jefeFantasma(j) {
  const { cuerpo } = j, muerto = j.derrotado, nerv = j.animo === 'nervioso', col = jCol(j, 0xe2dcff);
  const pts = []; for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * 0.95 + 0.0001, 0.4 + Math.cos(a) * 0.95)); }
  pts.push(new THREE.Vector2(0.99, 0.0), new THREE.Vector2(1.04, -0.4), new THREE.Vector2(1.09, -0.62), new THREE.Vector2(1.12, -0.78));
  const geo = new THREE.LatheGeometry(pts, 56), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < -0.5) { const a = Math.atan2(p.getX(i), p.getZ(i)); p.setY(i, y + Math.sin(a * 7) * 0.13 * Math.min(1, (-0.5 - y) / 0.28)); } }
  geo.computeVertexNormals();
  const mat = clay(col, { transparent: true, opacity: 0.92, side: THREE.DoubleSide }).clone();
  const fan = g0(); cuerpo.add(fan); fan.add(malla(geo, mat));
  const sup = (x, y) => Math.sqrt(Math.max(0, 0.95 ** 2 - x * x - Math.max(0, y - 0.4) ** 2));
  jCara(j, { padre: fan, y: 0.55, sep: 0.33, z: sup(0.33, 0.55) - 0.06, giro: 0.36, tam: 1.2, estilo: 'hueco' });
  // copetito de fantasma
  const pts2 = [jV(0, 1.3, 0), jV(0.02, 1.45, 0.02), jV(0.12, 1.55, 0.03), jV(0.2, 1.48, 0.03), jV(0.14, 1.42, 0.03)];
  fan.add(malla(jTubo(pts2, 0.05, 20), mat)); fan.add(malla(esf(0.05, 10), mat, { pos: [0.14, 1.42, 0.03] }));
  const boca = jBocaDe(j, 'o', 1); boca.position.set(0.12, 0.2, sup(0.12, 0.2) - 0.01); fan.add(boca);
  jCachetes(fan, 0.56, 0.32, sup(0.56, 0.32) + 0.04, 0.6, 0.3);
  // bracitos de sabana; el derecho dice "bye bye"
  for (const s of [-1, 1]) { const piv = g0(); piv.position.set(s * 0.98, -0.02, 0.15); piv.add(malla(esf(0.2, 20), mat, { pos: [s * 0.08, 0, 0], esc: [1.1, 0.65, 0.8] })); fan.add(piv); j.brazos.push(piv); }
  // canasta de compras vacia colgando del brazo izquierdo
  const rojo = clay(jCol(j, 0xff5a5f), { side: THREE.DoubleSide });
  const can = g0(); can.position.set(-0.12, -0.28, 0.1); j.brazos[0].add(can);
  can.add(malla(new THREE.CylinderGeometry(0.25, 0.19, 0.22, 16, 1, true), rojo));
  can.add(malla(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 16), rojo, { pos: [0, -0.11, 0] }));
  can.add(malla(new THREE.TorusGeometry(0.21, 0.02, 6, 20, Math.PI), rojo, { pos: [0, 0.1, 0] }));
  // globito de chat con palomitas azules: te dejo en visto
  const globo = g0(); globo.position.set(1.05, 1.45, 0.2); j.raiz.add(globo);
  globo.add(malla(new THREE.CapsuleGeometry(0.17, 0.3, 6, 14), clay(0xffffff), { rot: [0, 0, Math.PI / 2], esc: [1, 1, 0.5] }));
  globo.add(malla(new THREE.ConeGeometry(0.07, 0.17, 8), clay(0xffffff), { pos: [-0.22, -0.16, 0], rot: [0, 0, -0.7], esc: [1, 1, 0.5] }));
  const azul = plano(jCol(j, 0x34a8f1));
  for (const dx of [-0.07, 0.04]) {
    globo.add(malla(new THREE.CapsuleGeometry(0.022, 0.06, 3, 6), azul, { pos: [dx - 0.03, -0.02, 0.09], rot: [0, 0, Math.PI / 4] }));
    globo.add(malla(new THREE.CapsuleGeometry(0.022, 0.13, 3, 6), azul, { pos: [dx + 0.04, 0.02, 0.09], rot: [0, 0, -0.62] }));
  }
  globo.visible = !muerto;
  Object.assign(j, { cima: 1.7, sienes: [[-0.62, 0.95, 0.6], [0.66, 0.9, 0.58]], mano: [1.15, -0.2, 0.3], fan });
  j.paso = (t) => {
    fan.position.y = 0.12 + Math.sin(t * 1.6) * 0.12; fan.rotation.z = Math.sin(t * 1.2) * 0.05;
    mat.opacity = muerto ? 0.7 : nerv ? 0.55 + Math.abs(Math.sin(t * 9)) * 0.35 : 0.5 + 0.42 * (0.5 + 0.5 * Math.sin(t * 1.1));
    j.ojos.position.x = Math.sin(t * 0.7) * 0.07;
    j.brazos[1].rotation.z = muerto ? 0 : 0.5 + Math.sin(t * 7) * 0.4;
    j.brazos[0].rotation.z = Math.sin(t * 1.6) * 0.1;
    globo.position.y = 1.45 + Math.sin(t * 2) * 0.06;
  };
}

/* ---- Don Dormilon: blob dormido en su almohada con gorro de noche, burbuja de moco y clientitos inactivos arrullados */
function jefeDormilon(j) {
  const { cuerpo } = j, col = jCol(j, 0x9fb0e8), muerto = j.derrotado, nerv = j.animo === 'nervioso';
  const EX = 1.28, EY = 0.88, EZ = 1.1, CY = -0.3, sup = (x, y) => jSup(x, y - CY, EX, EY, EZ);
  cuerpo.add(malla(esf(1, 32), clay(jCol(j, 0xfff3e3)), { pos: [0, -0.86, 0.05], esc: [1.6, 0.27, 1.2] }));
  for (const sx of [-1, 1]) cuerpo.add(malla(esf(0.09, 10), clay(jCol(j, 0xffd0a8)), { pos: [sx * 1.5, -0.84, 0.62] }));
  cuerpo.add(malla(mochi(0.3), clay(col), { pos: [0, CY, 0], esc: [EX, EY, EZ] }));
  cuerpo.add(malla(esf(0.7, 28), clay(aclarar(col, 0.4)), { pos: [0, -0.55, 0.58], esc: [1.25, 0.45, 0.5] }));
  jCara(j, { y: 0.02, sep: 0.44, z: sup(0.44, 0.02) - 0.07, tam: 1.2, estilo: 'dormido', cejas: true });
  const boca = jBocaDe(j, 'o', 1.1); boca.position.set(0.05, -0.27, sup(0.05, -0.27)); cuerpo.add(boca);
  jCachetes(cuerpo, 0.8, -0.16, sup(0.8, -0.16) + 0.03, 0.6);
  // burbuja de moco que crece y se encoge
  const burbuja = malla(esf(0.17, 24), clay(0xbfe6ff, { transparent: true, opacity: 0.55, roughness: 0.1, clearcoat: 1, sheen: 0 }), { pos: [-0.2, -0.13, sup(-0.2, -0.13) + 0.12] });
  burbuja.visible = j.animo === 'confiado'; cuerpo.add(burbuja);
  const baba = jGota(0.8); baba.rotation.z = Math.PI; baba.position.set(0.17, -0.38, sup(0.17, -0.38)); baba.visible = !nerv; cuerpo.add(baba);
  // gorro de noche que se dobla
  const gorro = g0();
  if (muerto) { gorro.position.set(1.1, -0.45, 0.6); gorro.rotation.set(0, 0, -1.6); } else { gorro.position.set(-0.12, 0.46, -0.05); gorro.rotation.z = 0.3; }
  const gg = new THREE.LatheGeometry(Array.from({ length: 13 }, (_, i) => new THREE.Vector2(0.5 * (1 - i / 12) + 0.001, -0.6 + (i / 12) * 1.2)), 28), gp = gg.attributes.position;
  for (let i = 0; i < gp.count; i++) { const y = gp.getY(i), k = (y + 0.6) / 1.2; gp.setX(i, gp.getX(i) + k * k * 0.8); gp.setY(i, y - k * k * k * 0.6); }
  gg.computeVertexNormals();
  gorro.add(malla(gg, clay(jCol(j, 0x5b6cc9)), { pos: [0, 0.6, 0] }));
  gorro.add(malla(new THREE.TorusGeometry(0.48, 0.11, 12, 32), clay(0xffffff), { pos: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0] }));
  gorro.add(malla(esf(0.16, 18), clay(0xffffff), { pos: [0.8, 0.6, 0] }));
  for (const [x, y, z] of [[0.05, 0.45, 0.4], [0.35, 0.75, 0.25], [-0.2, 0.25, 0.43]]) gorro.add(malla(estrellaGeo(0.07, 0.03), brillo(jCol(j, 0xffd23f)), { pos: [x, y, z], esc: [1, 1, 0.5] }));
  cuerpo.add(gorro);
  // clientitos inactivos dormidos en la almohada
  const minis = [];
  for (const [x, z, c] of [[-1.12, 0.78, 0xffc9a3], [1.15, 0.72, 0xffb3c7]]) {
    const m = g0(); m.position.set(x, -0.66, z); cuerpo.add(m); minis.push(m);
    m.add(malla(mochi(0.4), clay(jCol(j, c)), { esc: [0.24, 0.2, 0.22] }));
    for (const s of [-1, 1]) m.add(malla(arco(0.04, 0.012), plano(J_NEGRO), { pos: [s * 0.08, 0.02, 0.2], rot: [0, s * 0.35, Math.PI] }));
    m.add(malla(jMedia(0.14, false, 14), clay(jCol(j, 0x6f9cff)), { pos: [0, 0.13, -0.02], rot: [-0.3, 0, 0.3] }));
  }
  // zetas
  const zs = g0(); j.raiz.add(zs);
  const zf = new THREE.Shape(); [[-0.1, 0.1], [0.1, 0.1], [0.1, 0.06], [-0.035, -0.06], [0.1, -0.06], [0.1, -0.1], [-0.1, -0.1], [-0.1, -0.06], [0.035, 0.06], [-0.1, 0.06]].forEach(([x, y], i) => (i ? zf.lineTo(x, y) : zf.moveTo(x, y)));
  const zg = new THREE.ExtrudeGeometry(zf, { depth: 0.04, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
  if (!muerto && !nerv) for (let i = 0; i < 3; i++) { const z = malla(zg, brillo(0x6f86ff)); z.userData.fase = i / 3; zs.add(z); }
  Object.assign(j, { cima: 1.05, respira: 0.045, sienes: [[-0.75, 0.3, 0.8], [0.8, 0.28, 0.78]], mano: [1.2, -0.45, 0.5] });
  jBrazo(j, -1, col, [-1.22, -0.42, 0.3]); jBrazo(j, 1, col, [1.22, -0.42, 0.3]);
  j.paso = (t) => {
    burbuja.scale.setScalar(0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 1.4)));
    if (!muerto) gorro.rotation.z = 0.3 + Math.sin(t * 1.4) * 0.05;
    minis.forEach((m, i) => m.scale.set(1, 1 + Math.sin(t * 2 + i * 2) * 0.05, 1));
    zs.children.forEach((z) => { const k = (t * 0.3 + z.userData.fase) % 1; z.position.set(0.75 + k * 0.7, 0.6 + k * 1.1, 0.5); z.rotation.z = Math.sin(t * 2 + k * 6) * 0.3; z.scale.setScalar(Math.sin(k * Math.PI) * (0.8 + k * 0.6)); });
  };
}

/* ---- La Reina del Regateo: diva en forma de pera con chongo, corona chueca, cuello real de villana, estola de armino,
   lentes de gato con brillantes y su cetro-etiqueta de -50%. Pocas piezas grandes: corona, lentes, cuello y etiqueta */
// lente "ojo de gato": contorno con la punta de afuera levantada (s = lado)
function jLenteGato(s, armazon, vidrio) {
  const g = g0(), P = (x, y) => new THREE.Vector2(s * x, y);
  const c = [[0, -0.17], [0.2, -0.17], [0.27, -0.04], [0.34, 0.12], [0.5, 0.32], [0.16, 0.22], [-0.12, 0.16], [-0.24, 0.1], [-0.22, -0.06], [-0.15, -0.17]];
  const curva = new THREE.SplineCurve([...c, c[0]].map(([x, y]) => P(x, y))), pts = curva.getPoints(40);
  const sh = new THREE.Shape(pts), cx = s * 0.03, cy = 0.0;
  const hueco = pts.map((p) => new THREE.Vector2(cx + (p.x - cx) * 0.66, cy + (p.y - cy) * 0.6));
  sh.holes.push(new THREE.Path(hueco));
  g.add(malla(new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.018, bevelSegments: 2, curveSegments: 6 }), armazon));
  g.add(det(new THREE.ShapeGeometry(new THREE.Shape(hueco)), vidrio, { pos: [0, 0, 0.01] }));
  return g;
}
function jefeRegateo(j) {
  const { cuerpo } = j, col = jCol(j, 0xf47fbf), muerto = j.derrotado, nerv = j.animo === 'nervioso';
  const perfil = new THREE.SplineCurve([[0.001, -0.95], [0.8, -0.92], [1.12, -0.6], [1.14, -0.2], [0.99, 0.24], [0.82, 0.62], [0.52, 0.92], [0.001, 1.02]].map(([x, y]) => new THREE.Vector2(x, y))).getPoints(36);
  const rA = (y) => { for (let i = 1; i < perfil.length; i++) { const a = perfil[i - 1], b = perfil[i]; if ((y - a.y) * (y - b.y) <= 0) return a.x + ((y - a.y) / (b.y - a.y || 1)) * (b.x - a.x); } return 0.5; };
  const sup = (x, y) => Math.sqrt(Math.max(0, rA(y) ** 2 - x * x));
  const oro = brillo(jCol(j, 0xffc23a)), oroD = clay(jCol(j, 0xffc23a), { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0, side: THREE.DoubleSide });
  const morado = clay(jCol(j, 0x6a3cc8), { side: THREE.DoubleSide, roughness: 0.6, sheen: 1, sheenRoughness: 0.4 }), armino = tela(jCol(j, 0xfffcf8)), negro = plano(J_NEGRO);
  const perla = clay(0xfff6f0, { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0 });
  cuerpo.add(malla(new THREE.LatheGeometry(perfil, 44), clay(col)));
  // chongo de diva con su rizo
  const pelo = clay(jCol(j, 0xc23488), { roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.4 });
  cuerpo.add(malla(esf(0.62, 28), pelo, { pos: [0, 0.98, -0.12], esc: [1.12, 0.7, 0.98] }));
  cuerpo.add(malla(new THREE.TorusGeometry(0.17, 0.1, 10, 22, Math.PI * 1.5), pelo, { pos: [-0.3, 1.0, 0.36], rot: [0.2, 0.25, 0.4] }));
  // cuello real de villana detras de la cabeza, ribete de oro y perlas
  // cuello real de villana: abanico de petalos detras de la cabeza, cada uno con su perla
  const petA = clay(jCol(j, 0x6a3cc8), { roughness: 0.6, sheen: 1, sheenRoughness: 0.4 }), petB = clay(jCol(j, 0x9b6bff), { roughness: 0.6, sheen: 1, sheenRoughness: 0.4 });
  for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 3.0, x = Math.sin(a) * 1.0, y = 0.48 + Math.cos(a) * 1.0;
    cuerpo.add(malla(esf(1, 20), i % 2 ? petB : petA, { pos: [x, y, -0.32 - Math.abs(Math.cos(a)) * 0.05], esc: [0.3, 0.46, 0.07], rot: [0, 0, -a] }));
    cuerpo.add(det(esf(0.06, 10), perla, { pos: [Math.sin(a) * 1.44, 0.48 + Math.cos(a) * 1.44, -0.3] })); }
  // vestido de terciopelo con dobladillo de oro
  const pv = perfil.filter((p) => p.y <= -0.12).map((p) => new THREE.Vector2(p.x * 1.02 + 0.001, p.y - 0.005));
  cuerpo.add(malla(new THREE.LatheGeometry(pv, 44), clay(jCol(j, 0x6a3cc8), { roughness: 0.6, sheen: 1, sheenRoughness: 0.4 })));
  cuerpo.add(malla(new THREE.TorusGeometry(rA(-0.82) * 1.02, 0.04, 8, 44), oro, { pos: [0, -0.82, 0], rot: [Math.PI / 2, 0, 0] }));
  // estola de armino esponjada con colitas negras
  const yE = -0.24, RE = rA(yE) - 0.02;
  cuerpo.add(malla(new THREE.TorusGeometry(RE, 0.19, 14, 44), armino, { pos: [0, yE, 0], rot: [Math.PI / 2, 0, 0] }));
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + 0.3, b = i % 2 ? 0.75 : 0.2, r = RE + Math.cos(b) * 0.2;
    cuerpo.add(det(new THREE.CapsuleGeometry(0.026, 0.055, 3, 6), negro, { pos: [Math.sin(a) * r, yE + Math.sin(b) * 0.2, Math.cos(a) * r] })); }
  // ojos coquetos tras lentes de gato
  const yO = 0.46, sep = 0.33;
  jCara(j, { y: yO, sep, z: sup(sep, yO) - 0.1, giro: 0.4, tam: 1.12, piel: oscurecer(col, 0.1), parpado: 0.1, pestanas: true });
  const lentes = g0(); lentes.position.y = yO; cuerpo.add(lentes);
  const armazon = brillo(jCol(j, 0x8e1466)), vidrio = clay(jCol(j, 0xff5fae), { transparent: true, opacity: 0.2, roughness: 0.05, clearcoat: 1, sheen: 0, depthWrite: false });
  for (const s of [-1, 1]) {
    const l = jLenteGato(s, armazon, vidrio); l.position.set(s * 0.35, 0.0, sup(0.35, yO) + 0.07); l.rotation.y = s * 0.36; lentes.add(l);
    l.add(det(esf(0.05, 10), brillo(jCol(j, 0x7fe3ff)), { pos: [s * 0.46, 0.28, 0.05] }));
    l.add(det(esf(0.032, 8), brillo(jCol(j, 0xffffff)), { pos: [s * 0.33, 0.22, 0.055] }));
  }
  lentes.add(malla(jTubo([jV(-0.13, 0.1, sup(0.13, yO) + 0.05), jV(0, 0.13, sup(0, yO) + 0.07), jV(0.13, 0.1, sup(0.13, yO) + 0.05)], 0.025, 10), armazon));
  if (nerv) { lentes.position.y = yO - 0.07; lentes.position.z = 0.04; lentes.rotation.z = 0.16; }
  if (muerto) { lentes.position.set(0.08, yO - 0.3, 0.08); lentes.rotation.z = -0.45; }
  // cejas finas y arqueadas (la derecha mas alzada)
  const cejas = [];
  for (const s of [-1, 1]) {
    const yc = yO + 0.37 + (s === 1 && !nerv && !muerto ? 0.07 : 0) + (nerv ? 0.05 : 0);
    const pts = [[0.14, -0.04], [0.24, 0.03], [0.37, 0.04], [0.48, -0.03]].map(([x, y]) => { const yy = nerv ? (0.5 - x) * 0.25 - 0.06 + y * 0.3 : y; return jV(s * x, yy, sup(Math.min(x, 0.6), yc + yy) + 0.005); });
    const c = g0(); c.position.y = yc; c.add(malla(jTubo(pts, 0.026, 12), negro)); cuerpo.add(c); cejas.push(c);
  }
  jCachetes(cuerpo, 0.56, 0.22, sup(0.56, 0.22) + 0.03, 0.6, 0.3);
  // labios rojos con sonrisita de lado + lunar
  let boca;
  if (j.animo === 'confiado') {
    boca = g0(); const lab = brillo(jCol(j, 0xe8304f));
    for (const sx of [-1, 1]) boca.add(malla(esf(0.09, 14), lab, { pos: [sx * 0.075, 0.035, 0], esc: [1.25, 0.62, 0.5], rot: [0, 0, sx * -0.3] }));
    boca.add(malla(esf(0.12, 16), lab, { pos: [0, -0.045, 0], esc: [1.45, 0.62, 0.55] }));
    boca.add(det(esf(0.03, 8), plano(0xffffff, { transparent: true, opacity: 0.8 }), { pos: [-0.04, -0.03, 0.065], esc: [1.4, 0.6, 0.4] }));
    boca.rotation.z = 0.2;
  } else boca = jBocaDe(j, 'o', 0.9);
  boca.position.set(0.06, 0.1, sup(0.06, 0.1) - 0.01); cuerpo.add(boca);
  cuerpo.add(det(esf(0.026, 8), negro, { pos: [0.3, 0.13, sup(0.3, 0.13) + 0.005] }));
  // corona grandota y chueca, con su cojin de terciopelo
  const corona = g0();
  if (muerto) { corona.position.set(-1.22, -1.1, 0.62); corona.rotation.set(0.15, 0.4, 0.42); corona.scale.setScalar(1.05); j.raiz.add(corona); }
  else { corona.position.set(0.1, nerv ? 1.42 : 1.3, -0.1); corona.rotation.z = nerv ? -0.42 : -0.24; corona.scale.setScalar(1.3); cuerpo.add(corona); }
  corona.add(malla(new THREE.CylinderGeometry(0.36, 0.33, 0.22, 28, 1, true), oroD, { pos: [0, 0.11, 0] }));
  corona.add(malla(jMedia(0.34, false, 20), clay(jCol(j, 0xc8193c), { roughness: 0.8, sheen: 1 }), { pos: [0, 0.12, 0], esc: [1, 0.75, 1] }));
  for (const y of [0, 0.22]) corona.add(malla(new THREE.TorusGeometry(y ? 0.362 : 0.335, 0.032, 8, 32), oro, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] }));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; corona.add(malla(new THREE.ConeGeometry(0.1, 0.26, 12), oro, { pos: [Math.sin(a) * 0.35, 0.34, Math.cos(a) * 0.35] })); corona.add(malla(esf(0.055, 12), perla, { pos: [Math.sin(a) * 0.35, 0.48, Math.cos(a) * 0.35] })); }
  corona.add(malla(esf(0.085, 16), brillo(jCol(j, 0xff2d55)), { pos: [0, 0.11, 0.35], esc: [1, 1.25, 0.6] }));
  for (const sx of [-1, 1]) corona.add(malla(esf(0.05, 12), brillo(jCol(j, 0x3fd0ff)), { pos: [Math.sin(sx * 0.75) * 0.35, 0.11, Math.cos(sx * 0.75) * 0.35], esc: [1, 1, 0.6] }));
  // brazos: el derecho empuna el cetro-etiqueta de -50%
  jBrazo(j, -1, col, [-1.08, -0.42, 0.42]); jBrazo(j, 1, col, [1.12, -0.42, 0.4]);
  const rojo = clay(jCol(j, 0xe8304f), { roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const tag = g0();
  { const s = new THREE.Shape(); s.moveTo(-0.44, 0); s.lineTo(-0.24, 0.27); s.lineTo(0.38, 0.27); s.quadraticCurveTo(0.44, 0.27, 0.44, 0.21); s.lineTo(0.44, -0.21); s.quadraticCurveTo(0.44, -0.27, 0.38, -0.27); s.lineTo(-0.24, -0.27); s.lineTo(-0.44, 0);
    const h = new THREE.Path(); h.absarc(-0.27, 0, 0.05, 0, Math.PI * 2, true); s.holes.push(h);
    tag.add(malla(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, curveSegments: 8 }), rojo, { pos: [0, 0, -0.025] }));
    const tt = jTex(256, 160, (x, w, hh) => { x.fillStyle = '#fff'; x.font = '900 104px Nunito, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('-50%', w / 2, hh / 2 + 6);
      x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 5; x.setLineDash([12, 9]); x.strokeRect(8, 8, w - 16, hh - 16); });
    tag.add(det(new THREE.PlaneGeometry(0.62, 0.39), new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthWrite: false, color: muerto ? 0xdddddd : 0xffffff }), { pos: [0.08, 0, 0.052] }));
    tag.add(det(new THREE.TorusGeometry(0.05, 0.018, 6, 16), oro, { pos: [-0.27, 0, 0.03] })); }
  const cetro = g0();
  cetro.add(malla(new THREE.CylinderGeometry(0.04, 0.035, 1.55, 10), oro, { pos: [0, 0.2, 0] }));
  cetro.add(malla(esf(0.075, 14), oro, { pos: [0, -0.6, 0] }));
  cetro.add(malla(esf(0.1, 16), oro, { pos: [0, 1.0, 0] }));
  tag.position.set(-0.16, 1.3, 0.02); tag.rotation.z = -0.12; cetro.add(tag);
  if (muerto) { tag.position.set(1.0, -1.06, 0.82); tag.rotation.set(-Math.PI / 2 + 0.25, 0, 0.35); tag.scale.setScalar(0.85); j.raiz.add(tag); cetro.visible = false; }
  cetro.position.set(0.0, 0.02, 0.06); j.brazos[1].add(cetro);
  Object.assign(j, { cima: muerto ? 1.3 : 2.0, sienes: [[-0.66, 0.8, sup(0.66, 0.8) + 0.12], [0.68, 0.76, sup(0.68, 0.76) + 0.12]], mano: [-1.18, -0.4, 0.45] });
  const yL = lentes.position.y;
  j.paso = (t) => {
    j.cuerpo.rotation.z += Math.sin(t * 1.5) * 0.035;
    if (!muerto) {
      cetro.rotation.z = Math.sin(t * (nerv ? 9 : 2.2)) * (nerv ? 0.08 : 0.05);
      tag.rotation.z = -0.12 + Math.sin(t * (nerv ? 11 : 3)) * (nerv ? 0.14 : 0.06);
      j.brazos[1].position.y = -0.42 + Math.abs(Math.sin(t * 2.2)) * 0.04;
      corona.rotation.y = Math.sin(t * 1.5) * 0.08;
    }
    if (nerv) lentes.position.y = yL - Math.abs(Math.sin(t * 3)) * 0.04;
    cejas[1].position.y = cejas[1].position.y * 0.9 + (yO + 0.37 + (!nerv && !muerto ? 0.07 + Math.max(0, Math.sin(t * 1.3)) ** 10 * 0.06 : nerv ? 0.05 : 0)) * 0.1;
  };
}

/* ---- El Sin-Complemento: bote de pintura enfurrunado, brazos cruzados; su brocha (lo que no se vendio) le da vueltas */
function jefeSinmas(j) {
  const { cuerpo } = j, col = jCol(j, 0x4fb3c8), muerto = j.derrotado, nerv = j.animo === 'nervioso';
  const R = 0.86, H = 1.6, Y = -0.95 + H / 2, top = Y + H / 2;
  const lata = clay(col, { metalness: 0.3, roughness: 0.45 }), plata = metal(jCol(j, 0xd7dde8)), pintura = brillo(jCol(j, 0xff8a3d));
  cuerpo.add(malla(new THREE.CylinderGeometry(R, R, H, 44), lata, { pos: [0, Y, 0] }));
  for (const y of [Y - H / 2 + 0.04, top]) cuerpo.add(malla(new THREE.TorusGeometry(R, 0.05, 10, 44), plata, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] }));
  // etiqueta crema con franjas del color de la pintura
  const ye = Y - 0.08;
  cuerpo.add(malla(new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.98, 44, 1, true), clay(jCol(j, 0xfff4e0)), { pos: [0, ye, 0] }));
  for (const dy of [0.45, -0.45]) cuerpo.add(malla(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.07, 44, 1, true), clay(jCol(j, 0xff8a3d)), { pos: [0, ye + dy, 0] }));
  // pintura desbordada arriba con escurrimientos
  cuerpo.add(malla(new THREE.CylinderGeometry(R - 0.03, R - 0.03, 0.05, 40), pintura, { pos: [0, top + 0.02, 0] }));
  cuerpo.add(malla(new THREE.TorusGeometry(R, 0.075, 10, 44), pintura, { pos: [0, top + 0.01, 0], rot: [Math.PI / 2, 0, 0] }));
  for (const [a, L] of [[-0.85, 0.3], [-0.1, 0.18], [0.55, 0.38], [1.2, 0.22], [2.2, 0.3], [-1.8, 0.25], [3.0, 0.2]]) {
    const x = Math.sin(a) * (R + 0.03), z = Math.cos(a) * (R + 0.03);
    cuerpo.add(malla(new THREE.CapsuleGeometry(0.055, L, 4, 10), pintura, { pos: [x, top - L / 2, z] }));
    cuerpo.add(malla(esf(0.075, 12), pintura, { pos: [x, top - L - 0.02, z] }));
  }
  // asa de alambre
  const asa = g0(); asa.position.set(0, top - 0.25, 0); cuerpo.add(asa);
  asa.add(malla(new THREE.TorusGeometry(R + 0.03, 0.025, 8, 36, Math.PI), plata));
  for (const sx of [-1, 1]) cuerpo.add(malla(esf(0.06, 10), plata, { pos: [sx * (R + 0.02), top - 0.25, 0] }));
  // cara enfurrunada
  jCara(j, { y: Y + 0.18, sep: 0.31, z: 0.8, giro: 0.36, tam: 1.1, piel: oscurecer(col, 0.05), parpado: 0.45, cejas: true });
  const boca = jBocaDe(j, 'puchero', 1.1); boca.position.set(0, Y - 0.16, R + 0.02); cuerpo.add(boca);
  jCachetes(cuerpo, 0.5, Y - 0.05, 0.75, 0.6, 0.3);
  // brazos cruzados (derrotado: sueltos)
  const brazoCol = clay(oscurecer(col, 0.06));
  if (!muerto) for (const s of [-1, 1]) cuerpo.add(malla(new THREE.CapsuleGeometry(0.12, 0.62, 6, 12), brazoCol, { pos: [0, Y - 0.48, R + 0.08 + (s > 0 ? 0.04 : 0)], rot: [0, 0, Math.PI / 2 + s * 0.32] }));
  jBrazo(j, -1, oscurecer(col, 0.06), [-0.95, Y - 0.35, 0.1]); jBrazo(j, 1, oscurecer(col, 0.06), [0.95, Y - 0.35, 0.1]);
  j.brazos.forEach((b) => (b.visible = muerto));
  jPies(cuerpo, jCol(j, 0x3b4b63), 0.42, -1.0, 0.35, 0.9);
  // la brocha que nunca le ofrecieron (transparente)
  const brocha = g0(); j.raiz.add(brocha);
  const tr = (c) => clay(jCol(j, c), { transparent: true, opacity: 0.7, depthWrite: false });
  brocha.add(malla(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 12), tr(0xd9a066), { pos: [0, 0.35, 0] }));
  brocha.add(malla(new THREE.BoxGeometry(0.26, 0.14, 0.09), tr(0xd7dde8), { pos: [0, 0.06, 0] }));
  brocha.add(malla(new THREE.BoxGeometry(0.24, 0.24, 0.08), tr(0xf2d39b), { pos: [0, -0.13, 0] }));
  brocha.add(malla(new THREE.BoxGeometry(0.245, 0.08, 0.085), tr(0xff8a3d), { pos: [0, -0.24, 0] }));
  brocha.visible = !muerto; brocha.scale.setScalar(1.3);
  Object.assign(j, { cima: 1.25, sienes: [[-0.62, Y + 0.45, 0.62], [0.64, Y + 0.42, 0.6]], mano: [1.05, -0.4, 0.2] });
  j.paso = (t) => {
    const a = t * 0.8;
    brocha.position.set(Math.cos(a) * 1.55, 0.25 + Math.sin(t * 2) * 0.12, Math.sin(a) * 0.9); brocha.rotation.set(0, -a, 0.4 + Math.sin(t * 3) * 0.2);
    j.ojos.position.x = -Math.cos(a) * 0.05 * (Math.sin(a) > 0 ? 1 : 0.3);   // voltea para otro lado cuando la brocha pasa enfrente
    asa.rotation.x = -0.35 + Math.sin(t * 2.2) * 0.12;
    boca.scale.x = 1 + Math.sin(t * 3) * 0.06;
  };
}

const CONSTRUCTORES_JEFE = { rezago: jefeRezago, cotizon: jefeCotizon, fantasma: jefeFantasma, dormilon: jefeDormilon, regateo: jefeRegateo, sinmas: jefeSinmas };
function armarJefe(op) {
  const tipo = CONSTRUCTORES_JEFE[op.tipo] ? op.tipo : 'rezago';
  const vida = jLim(op.vida ?? 1), derrotado = !!op.derrotado;
  const j = { tipo, vida, derrotado, animo: derrotado ? 'mareado' : vida < 0.4 ? 'nervioso' : 'confiado', raiz: g0(), cuerpo: g0(), brazos: [], respira: 0.02, cima: 1.5, base: -1.1 };
  j.raiz.add(j.cuerpo);
  CONSTRUCTORES_JEFE[tipo](j);
  j.estrellas = jEstrellas(j.cima); j.cuerpo.add(j.estrellas);
  if (j.animo === 'nervioso' && j.sienes) { j.sudor = g0(); j.sienes.forEach((p, i) => { const gt = jGota(1.2); gt.position.set(...p); gt.userData = { y0: p[1], i }; j.sudor.add(gt); }); (j.fan || j.cuerpo).add(j.sudor); }
  if (derrotado) { const b = jBandera(); b.position.set(...(j.mano || [1.1, -0.3, 0.3])); b.scale.setScalar(1.35); j.cuerpo.add(b); j.bandera = b; }
  j.raiz.scale.setScalar(derrotado ? 0.85 : 0.82 + vida * 0.25);
  return j;
}
/* ============================================================ BOTE DE PINTURA (las "cajas" de la tienda)
   Lata metalica con etiqueta impresa (DE + nombre de la caja), tapa con el logo, asa de alambre y pintura escurriendo
   del color de la caja. montarBote() lo pone en vivo: se mece, tiembla, se destapa (la tapa sale volando, salpica pintura,
   sale un haz de luz) y del bote sale el premio en 3D. */
// iconos de la etiqueta segun lo que trae la cubeta
function iconoEtiqueta(x, tema, cx, cy, s) {
  x.save(); x.translate(cx, cy); x.scale(s, s); x.fillStyle = 'rgba(255,255,255,.92)';
  const circ = (a, b, r) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); };
  if (tema === 'mascotas') { circ(0, 8, 13); circ(-14, -8, 6); circ(-5, -15, 6); circ(5, -15, 6); circ(14, -8, 6); }   // huella
  else if (tema === 'accesorios') { x.beginPath(); x.arc(0, 6, 20, Math.PI, 0); x.fill(); x.fillRect(-27, 4, 54, 7); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(-3, -14, 6, 18); }   // casco
  else if (tema === 'habitacion') { x.fillRect(-22, -2, 44, 14); x.fillRect(-26, -12, 8, 24); x.fillRect(18, -12, 8, 24); x.fillRect(-18, -14, 36, 12); x.fillRect(-20, 12, 5, 6); x.fillRect(15, 12, 5, 6); }   // sillon
  else { x.beginPath(); x.moveTo(-28, -2); x.quadraticCurveTo(-18, -14, -10, -2); x.quadraticCurveTo(-5, -12, 0, -4); x.quadraticCurveTo(5, -12, 10, -2);
    x.quadraticCurveTo(18, -14, 28, -2); x.quadraticCurveTo(14, 2, 0, 12); x.quadraticCurveTo(-14, 2, -28, -2); x.fill(); }   // murcielago
  x.restore();
}
// adorno sobre la tapa: anuncia lo que trae la cubeta (se va volando con la tapa)
function adornoBote(tema) {
  let obj = null;
  try {
    if (tema === 'accesorios') {   // casco de obra (el del juego trae piezas invisibles que lo hacen medir de mas)
      obj = g0(); const am = clay(0xffc93c, { roughness: 0.35, clearcoat: 0.8, side: THREE.DoubleSide });
      obj.add(malla(new THREE.SphereGeometry(0.42, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), am));
      obj.add(malla(new THREE.CylinderGeometry(0.56, 0.56, 0.04, 32), am, { pos: [0, 0.01, 0.06] }));
      obj.add(malla(new THREE.TorusGeometry(0.3, 0.035, 8, 24, Math.PI), clay(0xffe17a), { pos: [0, 0.05, 0], rot: [0, Math.PI / 2, 0] }));
      obj.add(malla(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), clay(0xff8a3d), { pos: [0, 0.24, 0.36], rot: [Math.PI / 2 - 0.7, 0, 0] }));
    }
    else if (tema === 'habitacion') obj = MUEBLES.lampara.hongo();
    else if (tema === 'temporada') obj = MUEBLES.deco.calabaza();
    else if (tema === 'mascotas') obj = armar({ especie: 'panda', etapa: 1, crecimiento: 0.6, color: '', ojos: 'feliz', equipo: {} }).raiz;   // una mascota sentada en la tapa
  } catch { obj = null; }
  if (!obj) return null;
  const caja = new THREE.Box3().setFromObject(obj), med = caja.getSize(new THREE.Vector3()), cen = caja.getCenter(new THREE.Vector3());
  const g = g0(); obj.position.set(-cen.x, -caja.min.y, -cen.z); g.add(obj);
  g.scale.setScalar(({ mascotas: 1.15, accesorios: 1.0, habitacion: 1.05, temporada: 0.95 }[tema] || 0.8) / Math.max(med.x, med.y, med.z, 0.01));
  return g;
}
function armarBote({ color = 0x9b6bff, oscuro = 0x3d2391, etiqueta = 'DE', tema = '' } = {}) {
  const raiz = g0(), cuerpo = g0(); raiz.add(cuerpo);
  const R = 0.82, H = 1.5, Y = -0.95 + H / 2, top = Y + H / 2;
  const lata = clay(0xe9edf3, { metalness: 0.55, roughness: 0.3, clearcoat: 0.8, sheen: 0 }), plata = metal(0xd7dde8);
  const pintura = brillo(color);
  cuerpo.add(malla(new THREE.CylinderGeometry(R, R, H, 48), lata, { pos: [0, Y, 0] }));
  for (const y of [Y - H / 2 + 0.03, Y - H / 2 + 0.16, top - 0.02]) cuerpo.add(malla(new THREE.TorusGeometry(R + 0.005, 0.035, 10, 48), plata, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] }));
  // etiqueta impresa alrededor del bote: lienzo con la proporcion de la etiqueta (vuelta completa / alto) para que no se estire
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 184;
  { const x = cv.getContext('2d'), w = cv.width, h = cv.height;
    const c1 = '#' + new THREE.Color(color).getHexString(), c2 = '#' + new THREE.Color(oscuro).getHexString();
    x.fillStyle = '#fff8ec'; x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c1); g.addColorStop(1, c2);
    x.fillStyle = g; x.fillRect(0, h * 0.1, w, h * 0.8);
    x.fillStyle = 'rgba(255,255,255,.16)'; for (let i = -h; i < w; i += 30) { x.beginPath(); x.moveTo(i, h * 0.9); x.lineTo(i + 12, h * 0.9); x.lineTo(i + 12 + h * 0.8, h * 0.1); x.lineTo(i + h * 0.8, h * 0.1); x.fill(); }
    x.fillStyle = c2; x.fillRect(0, h * 0.04, w, h * 0.05); x.fillRect(0, h * 0.91, w, h * 0.05);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const cx of [0, w * 0.5, w]) {   // de frente (u=0, repetido en u=1 por la costura) y de espaldas
      x.fillStyle = '#fff'; x.beginPath(); x.roundRect?.(cx - 150, h * 0.2, 300, h * 0.6, 22) ?? x.rect(cx - 150, h * 0.2, 300, h * 0.6); x.fill();
      x.fillStyle = c2; x.font = `900 ${Math.round(h * 0.34)}px Nunito, Arial, sans-serif`; x.fillText('DE', cx, h * 0.42);
      x.fillStyle = c1; x.font = `900 ${Math.round(h * 0.15)}px Nunito, Arial, sans-serif`; x.fillText(etiqueta.toUpperCase(), cx, h * 0.68);
    }
    for (const cx of [w * 0.25, w * 0.75]) {   // a los lados: iconos de lo que trae (huellas, cascos, sillones, murcielagos)
      if (tema) for (const dx of [-90, 0, 90]) iconoEtiqueta(x, tema, cx + dx, h * (dx ? 0.42 : 0.56), dx ? 1.05 : 1.35);
      else { x.fillStyle = 'rgba(255,255,255,.85)'; x.font = `900 ${Math.round(h * 0.18)}px Nunito, Arial, sans-serif`; x.fillText('CONSTRUCTORES', cx, h * 0.5); }
    } }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
  const etq = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.5, clearcoat: 0.4 });
  cuerpo.add(malla(new THREE.CylinderGeometry(R + 0.012, R + 0.012, H * 0.62, 48, 1, true), etq, { pos: [0, Y - 0.04, 0] }));
  // pintura escurriendo por fuera desde el borde
  const borde = top - 0.01;
  for (const [a, L] of [[-0.6, 0.32], [0.2, 0.18], [0.9, 0.4], [1.7, 0.22], [2.6, 0.3], [3.5, 0.16], [4.4, 0.36], [5.3, 0.2]]) {
    const x = Math.sin(a) * (R + 0.025), z = Math.cos(a) * (R + 0.025);
    cuerpo.add(malla(new THREE.CapsuleGeometry(0.05, L, 4, 10), pintura, { pos: [x, borde - L / 2, z] }));
    cuerpo.add(malla(esf(0.068, 12), pintura, { pos: [x, borde - L - 0.02, z] }));
  }
  cuerpo.add(malla(new THREE.TorusGeometry(R, 0.06, 10, 48), pintura, { pos: [0, borde, 0], rot: [Math.PI / 2, 0, 0] }));
  // asa de alambre con su agarradera
  const asa = g0(); asa.position.set(0, top - 0.32, 0); asa.rotation.x = -0.35; cuerpo.add(asa);
  asa.add(malla(new THREE.TorusGeometry(R + 0.04, 0.022, 8, 40, Math.PI), plata));
  asa.add(malla(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 14), clay(0x2b2b33), { pos: [0, R + 0.04, 0], rot: [0, 0, Math.PI / 2] }));
  for (const sx of [-1, 1]) cuerpo.add(malla(esf(0.06, 10), plata, { pos: [sx * (R + 0.02), top - 0.32, 0] }));
  // la tapa (se va volando al destapar) y la pintura de adentro
  const tapa = g0(); tapa.position.y = top + 0.01; cuerpo.add(tapa);
  tapa.add(malla(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.07, 48), plata));
  tapa.add(malla(new THREE.TorusGeometry(R - 0.12, 0.03, 8, 40), metal(0xb9c1cf), { pos: [0, 0.04, 0], rot: [Math.PI / 2, 0, 0] }));
  const logo = texCanvas((x, n) => { x.fillStyle = '#' + new THREE.Color(color).getHexString(); x.beginPath(); x.arc(n / 2, n / 2, n / 2, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.font = `900 ${Math.round(n * 0.34)}px Nunito, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('DE', n / 2, n / 2 + 4); }, 128);
  tapa.add(malla(new THREE.CircleGeometry(0.34, 32), new THREE.MeshPhysicalMaterial({ map: logo, roughness: 0.35, clearcoat: 1 }), { pos: [0, 0.037, 0], rot: [-Math.PI / 2, 0, 0] }));
  const adorno = adornoBote(tema);
  if (adorno) { adorno.position.y = 0.04; adorno.rotation.y = tema === 'mascotas' ? 0.35 : -0.5; tapa.add(adorno); }
  const dentro = malla(new THREE.CircleGeometry(R - 0.03, 40), pintura, { pos: [0, top - 0.06, 0], rot: [-Math.PI / 2, 0, 0] });
  cuerpo.add(dentro);
  return { raiz, cuerpo, tapa, top, R, color };
}
// objeto 3D del premio (para que salga del bote)
function objetoPremio(p) {
  if (!p) return null;
  if (p.op) return armar({ especie: 'obra', etapa: 2, color: '', ojos: 'normal', equipo: {}, ...p.op }).raiz;
  if (p.acabado && PRENDAS[p.tipo]?.[p.clave]) return aplicarAcabado(PRENDAS[p.tipo][p.clave](infoRig(null)), p.acabado);
  if (MUEBLES[p.tipo]?.[p.clave]) return MUEBLES[p.tipo][p.clave]();
  if (PRENDAS[p.tipo]?.[p.clave]) return PRENDAS[p.tipo][p.clave](infoRig(null));
  if (p.tipo === 'pared' && PAREDES[p.clave] !== undefined) return construirCuarto({ pared: p.clave, piso: 'nube' });
  if (p.tipo === 'piso' && PISOS[p.clave] !== undefined) return construirCuarto({ pared: 'crema', piso: p.clave });
  return null;
}
function fotoBote(opciones = {}, tam = 220) {
  const llave = `bote|${opciones.color}|${opciones.etiqueta}|${opciones.tema || ''}|${tam}`, ya = fotoGuardada(llave);
  if (ya) return ya;
  usoRespaldo = false;
  const { r, esc, cam } = prepararFotografo();
  r.setSize(tam, tam, false);
  const b = armarBote(opciones); b.raiz.rotation.set(0.12, -0.45, 0); esc.add(b.raiz);
  cam.position.set(0, 0.6, 8.2); cam.lookAt(0, 0.05, 0); cam.aspect = 1; cam.updateProjectionMatrix();
  r.render(esc, cam); const url = r.domElement.toDataURL('image/webp', 0.86); esc.remove(b.raiz); liberar(b.raiz); return guardarFoto(llave, url);
}
// la foto del bote sin trabar (la pestaña Cajas compilaba sus 4 botes de golpe: ~1.4 s congelada)
async function fotoBoteSinTrabar(opciones = {}, tam = 220) {
  const llave = `bote|${opciones.color}|${opciones.etiqueta}|${opciones.tema || ''}|${tam}`, ya = fotoGuardada(llave);
  if (ya) return ya;
  const { r } = prepararFotografo();
  const esc = new THREE.Scene(); luces(esc, false);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  usoRespaldo = false;
  const b = armarBote(opciones); b.raiz.rotation.set(0.12, -0.45, 0); esc.add(b.raiz);
  const respaldo = usoRespaldo;
  cam.position.set(0, 0.6, 8.2); cam.lookAt(0, 0.05, 0); cam.aspect = 1; cam.updateProjectionMatrix();
  await compilarSinTrabar(r, esc, cam);
  r.setSize(tam, tam, false); r.render(esc, cam); const url = r.domElement.toDataURL('image/webp', 0.86); liberar(b.raiz);
  usoRespaldo = respaldo; return guardarFoto(llave, url);
}
function montarBote(contenedor, opciones = {}) {
  const renderer = prepararRenderer(contenedor);
  const escena = new THREE.Scene(); luces(escena, false);
  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 60); camara.position.set(0, 1.8, 11.2); camara.lookAt(0, 1.05, 0);
  const sombra = sombraSuave(1.1); sombra.position.y = -0.96; escena.add(sombra);
  const b = armarBote(opciones); escena.add(b.raiz);
  // haz de luz que sale del bote al destaparlo
  const degradado = texCanvas((x, n) => { const g = x.createLinearGradient(0, 0, 0, n); g.addColorStop(0, '#000'); g.addColorStop(0.55, '#555'); g.addColorStop(1, '#fff'); x.fillStyle = g; x.fillRect(0, 0, n, n); }, 64);
  const haz = new THREE.Mesh(new THREE.CylinderGeometry(1.25, b.R * 0.85, 3.4, 32, 1, true),   // se desvanece hacia arriba (sumado: negro = nada)
    new THREE.MeshBasicMaterial({ color: 0xfff1b0, map: degradado, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  haz.position.y = b.top + 1.7; escena.add(haz);
  // gotas de pintura que salpican
  const gotas = [];
  const matGota = brillo(b.color);
  for (let i = 0; i < 46; i++) { const g = malla(esf(0.05 + Math.random() * 0.06, 10), matGota); g.visible = false; escena.add(g); gotas.push({ m: g, v: new THREE.Vector3() }); }
  let tam = '', vivo = true, estado = 'quieto', t0 = 0, tapaV = null, premio = null, premioT = 0, alAcabar = null;
  const ajustar = () => { const w = contenedor.clientWidth || 200, h = contenedor.clientHeight || 200; if (tam === w + 'x' + h) return; tam = w + 'x' + h; renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); };
  ajustar(); const ro = new ResizeObserver(ajustar); ro.observe(contenedor);
  const reloj = new THREE.Clock();
  (function cuadro() {
    if (!vivo) return;
    if (!contenedor.isConnected) { ctl.destruir(); return; }
    requestAnimationFrame(cuadro);
    if (document.hidden) return;
    ajustar();
    const dt = Math.min(0.05, reloj.getDelta()), t = reloj.elapsedTime, e = t - t0;
    if (estado === 'quieto') { b.raiz.rotation.y = Math.sin(t * 0.8) * 0.35; b.raiz.position.y = Math.sin(t * 1.6) * 0.04; }
    if (estado === 'tiembla') {   // tiembla cada vez mas fuerte
      const k = Math.min(1, e / 0.9);
      b.raiz.rotation.z = Math.sin(t * 55) * 0.06 * k; b.raiz.position.x = Math.sin(t * 47) * 0.05 * k;
      b.tapa.position.y = b.top + 0.01 + Math.abs(Math.sin(t * 30)) * 0.05 * k;
      if (e > 0.9) { estado = 'destapa'; t0 = t; b.raiz.rotation.z = 0; b.raiz.position.x = 0;
        tapaV = { v: new THREE.Vector3(1.6, 7.5, 1.2), w: new THREE.Vector3(5, 2, 7) };
        for (const g of gotas) { g.m.visible = true; g.m.position.set((Math.random() - 0.5) * b.R, b.top, (Math.random() - 0.5) * b.R);
          const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3; g.v.set(Math.cos(a) * s, 4 + Math.random() * 5, Math.sin(a) * s); } }
    }
    if (estado === 'destapa' || estado === 'abierto' || estado === 'premio') {
      if (tapaV) { b.tapa.position.addScaledVector(tapaV.v, dt); tapaV.v.y -= 14 * dt; b.tapa.rotation.x += tapaV.w.x * dt; b.tapa.rotation.z += tapaV.w.z * dt;
        if (b.tapa.position.y < -6) { b.tapa.visible = false; tapaV = null; } }
      for (const g of gotas) if (g.m.visible) { g.m.position.addScaledVector(g.v, dt); g.v.y -= 12 * dt; if (g.m.position.y < -1) g.m.visible = false; }
      haz.material.opacity = Math.min(0.55, haz.material.opacity + dt * 1.2) * (0.85 + Math.sin(t * 9) * 0.15);
      haz.scale.y = Math.min(1, haz.scale.y + dt * 2);
      if (estado === 'destapa' && e > 0.7) { estado = 'abierto'; alAcabar?.(); alAcabar = null; }
      b.raiz.rotation.y += dt * 0.25;
    }
    if (premio) {   // el premio sale del bote girando y se queda flotando arriba
      premioT = Math.min(1, premioT + dt / 1.1);
      const k = 1 - Math.pow(1 - premioT, 3), rebote = premioT < 1 ? Math.sin(premioT * Math.PI) * 0.25 : 0;
      premio.position.y = b.top - 0.5 + k * 2.75 + Math.sin(t * 2) * 0.06 * premioT;   // termina bien arriba de la cubeta
      premio.scale.setScalar(premio.userData.esc * (0.35 + k * 0.65 + rebote));
      premio.rotation.y = (1 - k) * Math.PI * 4 + Math.sin(t * 0.9) * 0.3;
    }
    renderer.render(escena, camara);
  })();
  const ctl = {
    // tiembla y se destapa; la promesa se cumple cuando la tapa ya volo (para arrancar la ruleta)
    destapar() { return new Promise((ok) => { estado = 'tiembla'; t0 = reloj.elapsedTime; alAcabar = ok; }); },
    // sale el premio en 3D: { op } (mascota), { tipo, clave, acabado? } (accesorio, mueble...)
    mostrarPremio(p) {
      if (p?.op?.especie && faltaGLB(p.op.especie)) { pedirGLB(p.op.especie).then(() => vivo && ctl.mostrarPremio(p)); return; }   // la mascota nueva sale ya con su modelo
      const obj = objetoPremio(p);
      if (!obj) return;
      const caja = new THREE.Box3().setFromObject(obj), medida = caja.getSize(new THREE.Vector3()), centro = caja.getCenter(new THREE.Vector3());
      const g = g0(); obj.position.sub(centro); g.add(obj);
      g.userData.esc = 1.5 / Math.max(medida.x, medida.y, medida.z, 0.01);
      g.position.set(0, b.top - 0.5, 0); escena.add(g); premio = g; premioT = 0; estado = 'premio';
      haz.material.color.set(p.color || 0xfff1b0);
    },
    destruir() { vivo = false; ro.disconnect(); liberar(escena); renderer.dispose(); renderer.forceContextLoss?.(); renderer.domElement.remove(); },
  };
  return ctl;
}

function montarJefe(contenedor, opciones = {}) {
  let op = { tipo: 'rezago', vida: 1, derrotado: false, ...opciones };
  const renderer = prepararRenderer(contenedor);
  const escena = new THREE.Scene(); luces(escena, false);
  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 50); camara.position.set(0, 0.65, 7.5); camara.lookAt(0, 0.28, 0);
  const sombra = sombraSuave(1.1); sombra.position.y = -1.1; escena.add(sombra);
  let j = armarJefe(op), golpe = 0;
  escena.add(j.raiz);
  let tam = '';
  const ajustar = () => { const w = contenedor.clientWidth || 200, h = contenedor.clientHeight || 200; if (tam === w + 'x' + h) return; tam = w + 'x' + h; renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); };
  // guardado escondido (Equipo lo conserva al cambiar de pestaña) o fuera de la pantalla: no dibuja ni cambia de tamaño
  ajustar(); const ro = new ResizeObserver(() => { if (contenedor.clientWidth) ajustar(); }); ro.observe(contenedor);
  let visible = true; const io = new IntersectionObserver(([x]) => { visible = x.isIntersecting; }); io.observe(contenedor);
  let vivo = true; const reloj = new THREE.Clock();
  function cuadro() {
    if (!vivo) return;
    if (!contenedor.isConnected) { ctl.destruir(); return; }
    requestAnimationFrame(cuadro);
    if (document.hidden || !visible) { reloj.getDelta(); return; }
    ajustar();
    const dt = Math.min(0.05, reloj.getDelta()), t = reloj.elapsedTime;
    golpe = Math.max(0, golpe - dt * 1.8);
    const g = golpe;
    j.raiz.position.x = g > 0 ? Math.sin(t * 60) * 0.1 * g : 0;
    j.raiz.rotation.y = Math.sin(t * 0.7) * 0.2;
    // golpe: aplastado con rebote (anclado al piso); siempre respira
    const ola = g > 0 ? Math.max(-0.3, g * Math.cos((1 - g) * Math.PI * 4)) : 0, resp = Math.sin(t * 2) * j.respira;
    const sy = (1 - ola * 0.22 + resp) * (j.derrotado ? 0.8 : 1), sxz = 1 + ola * 0.15 - resp * 0.5;
    j.cuerpo.scale.set(sxz, sy, sxz);
    j.cuerpo.position.y = j.base * (1 - sy);
    j.cuerpo.rotation.z = j.derrotado ? Math.sin(t * 1.5) * 0.08 : 0;
    if (j.ojosGolpe) { const ay = g > 0.2; j.ojos.visible = !ay; j.ojosGolpe.visible = ay; }
    // estrellitas: al pegarle y, ya derrotado, dando vueltas sobre la cabeza
    const est = j.estrellas; est.visible = j.derrotado || g > 0.05;
    if (est.visible) {
      const r = j.derrotado ? 0.62 : 0.5 + (1 - g) * 0.5;
      est.children.forEach((e) => { const a = e.userData.a + t * 2.6; e.position.set(Math.cos(a) * r, Math.sin(a * 2) * 0.06, Math.sin(a) * r * 0.55); e.rotation.z = t * 4; });
      est.scale.setScalar(j.derrotado ? 1 : Math.min(1, g * 3));
    }
    if (j.sudor) j.sudor.children.forEach((s) => { const k = (t * 0.9 + s.userData.i * 0.5) % 1; s.position.y = s.userData.y0 - k * 0.35; s.scale.setScalar(Math.sin(k * Math.PI) * 1.2); });
    if (j.bandera) { j.bandera.rotation.z = Math.sin(t * 3) * 0.3; j.bandera.userData.tela.rotation.y = Math.sin(t * 7) * 0.4; }
    j.paso?.(t, dt, g);
    renderer.render(escena, camara);
    marcarDibujado(renderer);
  }
  compilarSinTrabar(renderer, escena, camara).then(() => requestAnimationFrame(cuadro));
  const ctl = {
    set(nuevas) { op = { ...op, ...nuevas }; escena.remove(j.raiz); liberar(j.raiz); j = armarJefe(op); escena.add(j.raiz); },
    golpe() { golpe = 1; },
    datos: () => ({ tipo: j.tipo, animo: j.animo, ...JEFES[j.tipo] }),
    destruir() { if (!vivo) return; vivo = false; ro.disconnect(); io.disconnect(); enReposo(() => { liberar(escena); renderer.dispose(); renderer.forceContextLoss?.(); }); },
  };
  return ctl;
}


/* ============================================================ cofre de recompensas en 3D */
function armarCofre() {
  const raiz = g0();
  const madera = clay(0xff9a3c), oscura = clay(0xd9712a), oro = metal(0xffcf3f);
  const base = g0(); raiz.add(base);
  // caja hueca (paredes + fondo) para que al abrir se vea por dentro, llena de tesoro
  const P = 0.1;   // grosor de pared
  for (const z of [-0.55 + P / 2, 0.55 - P / 2]) base.add(malla(new THREE.BoxGeometry(1.6, 0.9, P), madera, { pos: [0, 0.45, z] }));
  for (const x of [-0.8 + P / 2, 0.8 - P / 2]) base.add(malla(new THREE.BoxGeometry(P, 0.9, 1.1 - 2 * P), madera, { pos: [x, 0.45, 0] }));
  base.add(malla(new THREE.BoxGeometry(1.6 - 2 * P, 0.1, 1.1 - 2 * P), oscura, { pos: [0, 0.15, 0] }));
  for (const z of [-0.55 + P + 0.01, 0.55 - P - 0.01]) base.add(det(new THREE.PlaneGeometry(1.6 - 2 * P, 0.86), oscura, { pos: [0, 0.47, z], rot: [0, z < 0 ? 0 : Math.PI, 0] }));   // forro interior mas oscuro
  for (const x of [-0.8 + P + 0.01, 0.8 - P - 0.01]) base.add(det(new THREE.PlaneGeometry(1.1 - 2 * P, 0.86), oscura, { pos: [x, 0.47, 0], rot: [0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0] }));
  for (const x of [-0.5, 0.5]) for (const z of [-0.56, 0.56]) base.add(malla(new THREE.BoxGeometry(0.16, 0.92, 0.04), oro, { pos: [x, 0.45, z] }));   // flejes (solo por fuera)
  base.add(malla(new THREE.BoxGeometry(1.64, 0.1, 1.14), oscura, { pos: [0, 0.05, 0] }));
  // tapa con bisagra atras
  const bisagra = g0(); bisagra.position.set(0, 0.9, -0.55); raiz.add(bisagra);
  const tapa = g0(); tapa.position.set(0, 0, 0.55); bisagra.add(tapa);
  tapa.add(malla(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 32, 1, false, 0, Math.PI), madera, { rot: [0, 0, Math.PI / 2], esc: [1, 1, 1] }));
  for (const x of [-0.5, 0.5]) tapa.add(malla(new THREE.CylinderGeometry(0.57, 0.57, 0.16, 32, 1, false, 0, Math.PI), oro, { pos: [x, 0, 0], rot: [0, 0, Math.PI / 2] }));
  tapa.add(malla(new THREE.BoxGeometry(1.6, 0.06, 1.1), oscura, { pos: [0, 0.02, 0] }));  // fondo de la tapa (no se ve hueca al abrir)
  // candado
  const candado = malla(new THREE.BoxGeometry(0.26, 0.3, 0.1), oro, { pos: [0, 0.82, 0.58] }); raiz.add(candado);
  candado.add(malla(esf(0.04, 10), plano(0x8a4b12), { pos: [0, -0.02, 0.05] }));
  // luz y monedas que salen al abrir
  // resplandor dorado suave que sale del tesoro (antes un cono de luz: se veia falso)
  const brilloTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,240,170,1)'); g.addColorStop(0.35, 'rgba(255,205,80,.55)'); g.addColorStop(1, 'rgba(255,180,40,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const luz = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilloTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  luz.position.set(0, 1.25, 0);
  luz.castShadow = false; raiz.add(luz);
  const oroT = new THREE.MeshPhysicalMaterial({ color: 0xffc93a, roughness: 0.32, metalness: 0.7, clearcoat: 0.6, clearcoatRoughness: 0.2, emissive: 0xff9a00, emissiveIntensity: 0 });
  const monedas = g0(); raiz.add(monedas);
  for (let i = 0; i < 10; i++) {
    const m = malla(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 20), oroT, { rot: [Math.PI / 2, 0, 0] });
    m.visible = false; m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 2.2, 3 + Math.random() * 2, (Math.random() - 0.3) * 1.4);
    monedas.add(m);
  }
  // tesoro adentro: monton de oro (montículo + monedas instanciadas) y unas gemas; brilla al abrir
  const tesoro = g0(); raiz.add(tesoro);
  const AX = 0.66, AZ = 0.41, alto = (x, z) => 0.8 + 0.27 * Math.max(0, 1 - (x / AX) ** 2) * Math.max(0, 1 - (z / AZ) ** 2);
  tesoro.add(det(esf(1, 24), oroT, { pos: [0, 0.74, 0], esc: [AX + 0.03, 0.33, AZ + 0.03] }));
  tesoro.add(det(new THREE.BoxGeometry(1.4, 0.6, 0.9), oroT, { pos: [0, 0.48, 0] }));   // relleno hasta el borde
  const N = 64, mon = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.035, 16), oroT, N);
  const o = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const x = (Math.random() * 2 - 1) * (AX - 0.06), z = (Math.random() * 2 - 1) * (AZ - 0.05);
    o.position.set(x, alto(x, z) + 0.02 + Math.random() * 0.03, z);
    o.rotation.set((Math.random() - 0.5) * 0.9 - x * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.9 + z * 0.4);
    o.updateMatrix(); mon.setMatrixAt(i, o.matrix);
  }
  mon.castShadow = false; tesoro.add(mon);
  const GEMAS = [[0xff4fa3, -0.32, 0.12, 0], [0x3fa9ff, 0.28, -0.08, 1], [0x2fd67a, 0.05, 0.22, 0], [0xb46bff, -0.05, -0.2, 1], [0xff4fa3, 0.48, 0.18, 1]];
  for (const [col, x, z, ico] of GEMAS) {
    const g = det(ico ? new THREE.IcosahedronGeometry(0.085, 0) : new THREE.OctahedronGeometry(0.1, 0), clay(col, { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0, emissive: col, emissiveIntensity: 0.15 }), { pos: [x, alto(x, z) + 0.06, z], rot: [Math.random(), Math.random() * 3, Math.random() * 0.5], esc: ico ? [1, 1, 1] : [1, 1.35, 1] });
    tesoro.add(g);
  }
  const resplandor = new THREE.PointLight(0xffc24a, 0, 3.2, 1.6); resplandor.position.set(0, 1.35, 0.15); raiz.add(resplandor);
  tesoro.position.y = -0.18;   // cerrado: hundido bajo el borde para no atravesar la tapa
  return { raiz, base, bisagra, candado, luz, monedas, tesoro, oroT, resplandor };
}
function montarCofre(contenedor) {
  const renderer = prepararRenderer(contenedor);
  const escena = new THREE.Scene(); luces(escena, false);
  const camara = new THREE.PerspectiveCamera(32, 1, 0.1, 50); camara.position.set(0, 2.4, 5.4); camara.lookAt(0, 0.6, 0);
  const sombra = sombraSuave(1.2); sombra.position.y = 0.01; escena.add(sombra);
  const c = armarCofre(); c.raiz.rotation.y = -0.35; escena.add(c.raiz);
  let agitando = false, abierto = 0, abriendo = false, vivo = true, tam = '';
  const reloj = new THREE.Clock();
  const ajustar = () => { const w = contenedor.clientWidth || 200, h = contenedor.clientHeight || 200; if (tam === w + 'x' + h) return; tam = w + 'x' + h; renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); };
  (function cuadro() {
    if (!vivo) return;
    if (!contenedor.isConnected) { ctl.destruir(); return; }
    requestAnimationFrame(cuadro);
    ajustar();
    const dt = Math.min(0.05, reloj.getDelta()), t = reloj.elapsedTime;
    if (agitando) { c.raiz.rotation.z = Math.sin(t * 28) * 0.05 * (Math.sin(t * 3) > 0 ? 1 : 0.2); c.raiz.position.y = Math.abs(Math.sin(t * 14)) * 0.04; }
    else { c.raiz.rotation.z *= 0.8; c.raiz.position.y = Math.sin(t * 2) * 0.02; }
    if (abriendo) {
      abierto = Math.min(1, abierto + dt * 2.4);
      const k = 1 - Math.pow(1 - abierto, 3);
      c.bisagra.rotation.x = -k * 1.9;
      c.candado.position.y = 0.82 - k * 0.6; c.candado.rotation.z = k * 1.2; c.candado.material.opacity = 1;
      c.luz.material.opacity = 0.7 * k; c.luz.scale.setScalar(1.2 + k * 1.4);
      const kt = Math.min(1, Math.max(0, (abierto - 0.25) / 0.75)), et = 1 - Math.pow(1 - kt, 3);
      c.tesoro.position.y = -0.18 + et * 0.18;
      c.oroT.emissiveIntensity = et * (0.3 + Math.sin(t * 3) * 0.06);
      c.resplandor.intensity = et * (2.6 + Math.sin(t * 4.3) * 0.3);
      c.monedas.children.forEach((m) => {
        m.visible = true; m.userData.v.y -= dt * 6;
        m.position.addScaledVector(m.userData.v, dt); m.rotation.x += dt * 9;
        if (m.position.y < 0.1) { m.position.y = 0.1; m.userData.v.set(0, 0, 0); }
      });
    }
    renderer.render(escena, camara);
  })();
  const ctl = {
    agitar(si = true) { agitando = si; },
    abrir() { agitando = false; abriendo = true; c.monedas.children.forEach((m) => m.position.set(0, 0.9, 0)); },
    destruir() { if (!vivo) return; vivo = false; enReposo(() => { liberar(escena); renderer.dispose(); renderer.forceContextLoss?.(); }); },
  };
  return ctl;
}

/* Los shaders de una escena nueva se compilan en paralelo (KHR_parallel_shader_compile) antes del primer cuadro: antes ese
   primer cuadro congelaba la pantalla 1-2 s mientras la GPU compilaba (getProgramInfoLog). Sin la extension es como antes. */
function compilarSinTrabar(renderer, escena, camara) {
  try { return Promise.race([renderer.compileAsync(escena, camara).catch(() => {}), espera3D(4000)]); } catch { return Promise.resolve(); }
}
const espera3D = (ms) => new Promise((ok) => setTimeout(ok, ms));
const marcarDibujado = (renderer) => { if (!renderer.domElement.dataset.dibujado) renderer.domElement.dataset.dibujado = '1'; };

/* ============================================================ controlador comun (bucle, eventos, limpieza) */
function controlador(c) {
  const { contenedor, renderer, escena, camara, sombra, comida } = c;
  let tam = '';
  const ajustar = () => {
    const w = contenedor.clientWidth || 160, h = contenedor.clientHeight || 160;
    if (tam === w + 'x' + h) return; tam = w + 'x' + h;
    renderer.setSize(w, h, false); camara.aspect = w / h; c.encuadrar?.(w / h); camara.updateProjectionMatrix();
  };
  ajustar();
  const ro = new ResizeObserver(ajustar); ro.observe(contenedor);
  const alMover = (ev) => { const r = renderer.domElement.getBoundingClientRect(); c.getAnim().e.obj.set(Math.max(-1.5, Math.min(1.5, ((ev.clientX - r.left) / r.width) * 2 - 1)), Math.max(-1.5, Math.min(1.5, -(((ev.clientY - r.top) / r.height) * 2 - 1)))); };
  window.addEventListener('pointermove', alMover, { passive: true });
  const pelota3D = juegoPelota3D(c);
  const tocarPelota = ev => { if (pelota3D.capturar(ev)) { ev.preventDefault(); ev.stopImmediatePropagation(); } };
  const teclaPelota = ev => { if (pelota3D.activa() && (ev.code === 'Space' || ev.code === 'Enter')) { ev.preventDefault(); pelota3D.lanzar(); } };
  renderer.domElement.addEventListener('pointerdown', tocarPelota, true);
  renderer.domElement.addEventListener('keydown', teclaPelota);
  let toque = null;   // { x, y, movio }: un toque corto alegra a la mascota; arrastrar la gira
  if (c.arrastrar) renderer.domElement.style.touchAction = 'pan-y';
  if (c.op.interactivo || c.arrastrar) {
    renderer.domElement.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation(); toque = { x: ev.clientX, y: ev.clientY, ultX: ev.clientX, movio: false };
      try { renderer.domElement.setPointerCapture(ev.pointerId); } catch { /* sin captura */ }
    });
    renderer.domElement.addEventListener('pointermove', (ev) => {
      if (!toque || !c.arrastrar) return;
      if (Math.abs(ev.clientX - toque.x) > 6) toque.movio = true;
      if (toque.movio) { c.arrastrar(ev.clientX - toque.ultX); toque.ultX = ev.clientX; }
    });
    const soltarToque = (ev) => {
      if (toque && !toque.movio && ev.type === 'pointerup' && c.op.interactivo) { ctl.feliz(); c.op.alTocar?.(); }
      toque = null;
    };
    renderer.domElement.addEventListener('pointerup', soltarToque);
    renderer.domElement.addEventListener('pointercancel', soltarToque);
  }
  let visible = true, vivo = true;
  const io = new IntersectionObserver(([x]) => { visible = x.isIntersecting; }); io.observe(contenedor);
  const reloj = new THREE.Clock();
  function cuadro() {
    if (!vivo) return;
    if (!contenedor.isConnected) { ctl.destruir(); return; }
    requestAnimationFrame(cuadro);
    if (!visible || document.hidden) return;
    ajustar();  // por si el contenedor cambio de tamano sin avisar
    const dt = Math.min(0.05, reloj.getDelta()), t = reloj.elapsedTime;
    c.getAnim().paso(dt, t, sombra, comida);
    c.cadaCuadro?.(dt, t);
    pelota3D.paso(dt, t);
    const ud = c.cuarto?.()?.userData;
    if (ud?.manecilla) ud.manecilla.rotation.z = -t * 0.5 - (ud.relojExtra || 0);
    const tp = t + (ud?.pecesExtra || 0);   // pecesExtra: se espantan cuando la mascota toca el vidrio
    if (ud?.peces) ud.peces.forEach((p, i) => { p.position.x = Math.sin(tp * (0.8 + i * 0.3) + i) * 0.3; p.rotation.y = Math.cos(tp * (0.8 + i * 0.3) + i) > 0 ? 0 : Math.PI; });
    renderer.render(escena, camara);
    marcarDibujado(renderer);
  }
  compilarSinTrabar(renderer, escena, camara).then(() => requestAnimationFrame(cuadro));
  const ctl = {
    set(nuevas) { pelota3D.cancelar(); c.reconstruir(nuevas); },
    jugarPelota(callbacks = {}) { return pelota3D.iniciar(callbacks); },
    lanzarPelota() { return pelota3D.lanzar(); },
    feliz() { const e = c.getAnim().e; e.salto = 1; e.giro = Math.random() < 0.5 ? 1 : 0; e.saludo = 0.6; },
    saludar() { c.getAnim().e.saludo = 1.4; },
    comer(tipo = 'galleta') { comida.clear(); comida.add(crearComida(tipo)); c.getAnim().e.comer = 1.8; setTimeout(() => ctl.feliz(), 1700); },
    destruir() { if (!vivo) return; vivo = false; pelota3D.cancelar(); ro.disconnect(); io.disconnect(); window.removeEventListener('pointermove', alMover); renderer.domElement.removeEventListener('pointerdown', tocarPelota, true); renderer.domElement.removeEventListener('keydown', teclaPelota); enReposo(() => { liberar(escena); renderer.dispose(); renderer.forceContextLoss?.(); }); },
  };
  return ctl;
}

/* ============================================================ miniaturas (un solo renderer compartido) */
const fotos = new Map();
// miniaturas guardadas en el teléfono (webp comprimido): la segunda vez salen al instante. Cambian con la versión de la
// app (?v= del módulo), así que un cambio de modelos o accesorios las regenera solo.
const VER_FOTOS = 'foto:' + (new URL(import.meta.url).searchParams.get('v') || 'dev') + (VER_MOD !== VER_APP ? '.' + VER_MOD.slice(3) : '') + ':';
try {
  for (let i = sessionStorage.length - 1; i >= 0; i--) { const k = sessionStorage.key(i); if (k?.startsWith('foto:') && !k.startsWith(VER_FOTOS)) sessionStorage.removeItem(k); }
} catch { /* sin almacenamiento */ }
function fotoGuardada(llave) {
  if (fotos.has(llave)) return fotos.get(llave);
  try { const u = sessionStorage.getItem(VER_FOTOS + llave); if (u) { fotos.set(llave, u); return u; } } catch { /* sin almacenamiento */ }
  return null;
}
function guardarFoto(llave, url) {
  if (usoRespaldo) { usoRespaldo = false; return url; }   // salio con un modelo de respaldo: se vuelve a dibujar cuando llegue el bueno
  fotos.set(llave, url);
  try { sessionStorage.setItem(VER_FOTOS + llave, url); } catch { /* lleno o sin almacenamiento: queda solo en memoria */ }
  return url;
}
const llaveFoto = (opciones, tam) => 'm|' + JSON.stringify({ especie: 'obra', etapa: 1, color: '', ojos: 'normal', equipo: {}, ...opciones }) + tam;
// sin dibujar: la miniatura si ya existe (para pintar listas sin parpadeo), o '' si falta dibujarla
const llaveObjeto = (tipo, clave, tam, ac) => `o|${tipo}|${clave}|${tam}${ac?.a ? `|${ac.a}|${ac.p ?? 0}|${Math.round((ac.d ?? 0.2) * 10)}` : ''}`;
function fotoLista(d) { return (d.objeto ? fotoGuardada(llaveObjeto(d.objeto, d.clave, d.tam || 120, d.acabado)) : fotoGuardada(llaveFoto(d.op, d.tam || 150))) || ''; }
// trabajo pesado que no urge (liberar una escena que ya no se ve): cuando el teléfono esté libre, no en el toque
const enReposo = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 60));
let fotografo = null;
function prepararFotografo() {
  if (fotografo) return fotografo;
  const r = prepararRenderer(null, true); r.setPixelRatio(1); r.shadowMap.enabled = false;
  const esc = new THREE.Scene(); luces(esc, false);
  fotografo = { r, esc, cam: new THREE.PerspectiveCamera(30, 1, 0.1, 50) }; return fotografo;
}
// la mascota de una miniatura, ya encuadrada en `cam`: que siempre quepan orejas, cuernos, sombreros y alas
function piezaMascota(opciones, cam) {
  const op = { especie: 'obra', etapa: 1, color: '', ojos: 'normal', equipo: {}, ...opciones };
  const m = armar(op); m.raiz.rotation.y = -0.3;
  m.raiz.updateMatrixWorld(true);
  const caja = new THREE.Box3();
  m.raiz.traverse((o) => { if (o.isMesh && !o.userData.sinEncuadre) caja.expandByObject(o); });   // las chispas y el aura del nivel no cuentan
  const centro = caja.getCenter(new THREE.Vector3()), medida = caja.getSize(new THREE.Vector3());
  const lado = Math.max(medida.y, medida.x * 0.95) * 1.12;
  const dist = Math.max(6.2, (lado / 2) / Math.tan((15 * Math.PI) / 180));
  cam.position.set(centro.x, centro.y + dist * 0.06, centro.z + dist); cam.lookAt(centro); cam.aspect = 1; cam.updateProjectionMatrix();
  return { grupo: m.raiz, sinFoto: false };
}
// un objeto de la tienda (mueble, prenda, comida...) encuadrado en `cam`; null si no existe
function piezaObjeto(tipo, clave, acabado, cam) {
  let obj = null;
  if (MUEBLES[tipo]?.[clave]) obj = MUEBLES[tipo][clave]();
  else if (PRENDAS[tipo]?.[clave]) obj = aplicarAcabado(PRENDAS[tipo][clave](infoRig(null)), acabado);  // anclas del RIG estandar
  else if (tipo === 'comida') obj = crearComida(clave);
  else if (tipo === 'cofre') { const c = armarCofre(); c.raiz.remove(c.luz, c.monedas); obj = c.raiz; }
  else if (tipo === 'pared' && PAREDES[clave] !== undefined) { obj = construirCuarto({ pared: clave, piso: 'nube' }); }
  else if (tipo === 'piso' && PISOS[clave] !== undefined) { obj = construirCuarto({ pared: 'crema', piso: clave }); }
  if (!obj) return null;
  obj.position.set(0, 0, 0); obj.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(obj), centro = caja.getCenter(new THREE.Vector3()), radio = caja.getSize(new THREE.Vector3()).length() / 2;
  const grupo = g0(); obj.position.sub(centro); grupo.add(obj); grupo.rotation.set(tipo === 'tapete' ? 0.95 : 0.35, tipo === 'cuadro' ? 0 : -0.55, 0);  // los tapetes se ven desde arriba
  cam.position.set(0, 0, radio / Math.tan((15 * Math.PI) / 180) * 1.05); cam.lookAt(0, 0, 0); cam.aspect = 1; cam.updateProjectionMatrix();
  return { grupo, sinFoto: !!obj.userData.sinFoto };
}
function foto(opciones = {}, tam = 160) {
  const llave = llaveFoto(opciones, tam), ya = fotoGuardada(llave);
  if (ya) return ya;
  usoRespaldo = false;
  const { r, esc, cam } = prepararFotografo();
  r.setSize(tam, tam, false);
  const p = piezaMascota(opciones, cam); esc.add(p.grupo);
  r.render(esc, cam);
  const url = r.domElement.toDataURL('image/webp', 0.86); esc.remove(p.grupo); liberar(p.grupo); return guardarFoto(llave, url);
}
function fotoObjeto(tipo, clave, tam = 140, acabado = null) {
  const llave = llaveObjeto(tipo, clave, tam, acabado), ya = fotoGuardada(llave);
  if (ya) return ya;
  usoRespaldo = false;
  const { r, esc, cam } = prepararFotografo();
  const p = piezaObjeto(tipo, clave, acabado, cam);
  if (!p) return '';
  r.setSize(tam, tam, false); esc.add(p.grupo);
  r.render(esc, cam); const url = r.domElement.toDataURL('image/webp', 0.86); esc.remove(p.grupo); liberar(p.grupo); return p.sinFoto ? url : guardarFoto(llave, url);
}
// la misma miniatura pero sin trabar la pantalla: sus shaders nuevos se compilan en paralelo antes de dibujarla (las listas
// de la tienda, el perfil y los rankings congelaban 0.3-1 s el teléfono con la primera foto de cada material). En su
// propia escena, para que una foto sincrona que se pida mientras tanto no se le encime.
async function fotoSinTrabar(d = {}) {
  const tam = d.tam || (d.objeto ? 120 : 150);
  const ya = fotoLista({ ...d, tam });
  if (ya) return ya;
  const { r } = prepararFotografo();
  const esc = new THREE.Scene(); luces(esc, false);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  usoRespaldo = false;
  const p = d.objeto ? piezaObjeto(d.objeto, d.clave, d.acabado, cam) : piezaMascota(d.op, cam);
  if (!p) return '';
  const respaldo = usoRespaldo;
  esc.add(p.grupo);
  await compilarSinTrabar(r, esc, cam);
  r.setSize(tam, tam, false); r.render(esc, cam);
  const url = r.domElement.toDataURL('image/webp', 0.86); liberar(p.grupo);
  if (respaldo || p.sinFoto) return url;
  usoRespaldo = false;
  return guardarFoto(d.objeto ? llaveObjeto(d.objeto, d.clave, tam, d.acabado) : llaveFoto(d.op, tam), url);
}

function liberar(obj) {
  const cacheados = new Set(cacheMat.values());
  obj.traverse((o) => {
    if (!o.geometry?.userData?.fija) o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const mt of mats) { if (cacheados.has(mt)) continue; if (mt.map && !TEXTURAS_FIJAS.has(mt.map)) mt.map.dispose(); mt.dispose?.(); }
  });
}
function webglDisponible() {
  try {
    const c = document.createElement('canvas'), gl = window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'));
    gl?.getExtension('WEBGL_lose_context')?.loseContext();   // solo era la prueba: no dejar un contexto de GPU ocupado
    return !!gl;
  } catch { return false; }
}

// modelos hechos en Blender (web/modelos/glb, ver herramientas/blender). Se bajan BAJO PEDIDO: al abrir solo la mascota
// propia (la de Inicio); las demas cuando una lista o pantalla las pide (Monstruos.cargar) y el resto en ratos libres.
// Antes se bajaban las 18 (4.4 MB) y mascotas.json (1.3 MB) antes de poder dibujar nada (14-oct-2026).
const respaldoEsculpido = () => (esculpidas ??= cargarModelos().finally(() => { esculpidasListas = true; }));
// su modelo bueno aun no llega (va en camino): lo que se arme con ella sale de respaldo
const faltaGLB = (k) => !!GLB.lista?.includes(k) && !MODELOS_EXTERNOS[k]?.cuerpo && (!GLB.fallidas.has(k) || !esculpidasListas);
function borrarFotosDe(k) { const marca = `"especie":"${k}"`; for (const llave of [...fotos.keys()]) if (llave.includes(marca)) fotos.delete(llave); }
// los GLB vienen comprimidos con meshopt; el cargador se prepara al abrir la app, mientras se escribe el PIN
const prepararCargadorGLB = () => (GLB.cargador ??= Promise.all([import('./vendor/GLTFLoader.js'), import('./vendor/meshopt_decoder.module.js')])
  .then(([{ GLTFLoader }, { MeshoptDecoder }]) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)));
function pedirGLB(k) {
  if (!faltaGLB(k)) return Promise.resolve();
  if (!GLB.prom.has(k)) GLB.prom.set(k, (async () => {
    try {
      // el archivo se baja al mismo tiempo que se prepara el cargador (antes iba uno detras del otro)
      const url = new URL(`./modelos/glb/${k}.glb` + VER_MOD, import.meta.url).href;
      const bytes = fetch(url).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); });
      bytes.catch(() => {});
      const g = await (await prepararCargadorGLB()).parseAsync(await bytes, new URL('./modelos/glb/', import.meta.url).href);
      const cuerpo = g.scene.getObjectByName('cuerpo'), brazoD = g.scene.getObjectByName('brazoD'), brazoI = g.scene.getObjectByName('brazoI');
      if (!cuerpo || !brazoD) throw new Error('faltan nodos cuerpo/brazoD');
      const d = JSON.parse(cuerpo.userData.mascota || '{}');
      for (const o of [cuerpo, brazoD, brazoI]) if (o) { o.removeFromParent(); o.position.set(0, 0, 0); }  // el brazo se cuelga del pivote del hombro
      MODELOS_EXTERNOS[k] = { cuerpo, brazoD, brazoI: brazoI || undefined, anclas: d.anclas, color: d.color, guino: !!d.guino };
    } catch (e) { console.warn('glb', k, e); GLB.fallidas.add(k); await respaldoEsculpido(); }
    borrarFotosDe(k);   // lo dibujado con el respaldo ya no vale
  })());
  return GLB.prom.get(k);
}
// las pantallas piden las mascotas que van a dibujar antes de dibujarlas (si ya estan, no espera nada)
function cargar(especies = []) { return Promise.all([].concat(especies).filter(Boolean).map(pedirGLB)).then(() => {}); }
// lo que se armo con respaldo (su GLB venia en camino) se vuelve a armar solo en cuanto llega el bueno
function rehacerAlLlegar(especie, rehacer) {
  if (!usoRespaldo) return;
  usoRespaldo = false;
  pedirGLB(especie).then(() => { try { rehacer(); } catch (e) { console.warn('rehacer', especie, e); } });
}
// la mascota del que ya entro antes en este telefono (su ultima base guardada): es la primera que se ve, en Inicio
function especiesPropias() {
  try {
    const ses = JSON.parse(sessionStorage.getItem('pmn.sesion') || 'null');
    const b = ses?.codigo && JSON.parse(sessionStorage.getItem('pmn.base:' + ses.codigo) || 'null');
    return b ? [b.perfil?.monstruo || b.gremio?.clave || 'obra'] : [];
  } catch { return []; }
}
async function cargarGLB() {
  try {
    const r = await fetch(new URL('./modelos/glb/indice.json' + VER_MOD, import.meta.url));
    if (!r.ok) return;
    GLB.lista = (await r.json()).especies || [];
    prepararCargadorGLB().catch(() => {});
    await cargar(especiesPropias());
  } catch (e) { console.warn('sin modelos glb', e); GLB.lista = null; }
}
// el resto, de una en una y en ratos libres (lo que pida una pantalla se adelanta solo)
function cargarResto() {
  const k = GLB.lista?.find((x) => !GLB.prom.has(x) && faltaGLB(x));
  if (k) enReposo(() => pedirGLB(k).finally(() => setTimeout(cargarResto, 300)));
}

// foto fija del cuarto completo con su mascota (para listas): un renderer propio, con sombras, compartido por todas
let fotografoCuarto = null;
// la escena de la foto del cuarto (cada foto en su escena y con su camara)
function escenaFotoCuarto(op, ancho, alto) {
  if (!fotografoCuarto) { const r = prepararRenderer(null, true); r.setPixelRatio(1); fotografoCuarto = { r }; }
  const { r } = fotografoCuarto, cam = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  usoRespaldo = false;
  const escena = new THREE.Scene(), L = lucesCuarto(escena, r);
  const cuarto = construirCuarto(op); escena.add(cuarto); L.ajustar(cuarto); cuarto.updateMatrixWorld(true); L.cuadro(cuarto, 0);
  const az = 0.66, el = 0.42, d = ancho / alto > 1.3 ? 6.7 : 8, o = new THREE.Vector3(0, 1.0, 0.2);   // mas cerca que en el cuarto: que se luzca la mascota
  const pivote = g0(); pivote.position.set(0.3, 0, 0.8); pivote.rotation.y = az - 0.05; escena.add(pivote);
  const m = armar({ etapa: 1, ...op.mascota }), k = m.raiz.scale.x * 0.58 * 1.3;
  m.raiz.scale.setScalar(k); m.raiz.position.set(0, 1.04 * k, 0); pivote.add(m.raiz);
  const sombra = sombraSuave(0.78); sombra.position.set(0.3, 0.05, 0.8); escena.add(sombra);
  cam.position.set(o.x + d * Math.cos(el) * Math.sin(az), o.y + d * Math.sin(el), o.z + d * Math.cos(el) * Math.cos(az));
  cam.aspect = ancho / alto; cam.lookAt(o); cam.updateProjectionMatrix();
  const respaldo = usoRespaldo; usoRespaldo = false;
  return { r, escena, cam, respaldo };
}
const opFotoCuarto = (opciones) => ({ mascota: {}, muebles: {}, posiciones: {}, pared: 'crema', piso: 'madera', ...opciones });
const llaveFotoCuarto = (op, ancho, alto) => 'cu|' + JSON.stringify([op.mascota, op.muebles, op.posiciones, op.pared, op.piso]) + ancho + 'x' + alto;
function revelarFotoCuarto(f, llave, ancho, alto) {
  f.r.setSize(ancho, alto, false); f.r.render(f.escena, f.cam);
  const url = f.r.domElement.toDataURL('image/webp', 0.84); liberar(f.escena);
  if (!f.respaldo) fotos.set(llave, url);   // la mascota salio de respaldo: no se guarda
  return url;
}
function fotoCuarto(opciones = {}, ancho = 480, alto = 300) {
  const op = opFotoCuarto(opciones), llave = llaveFotoCuarto(op, ancho, alto);
  if (fotos.has(llave)) return fotos.get(llave);
  return revelarFotoCuarto(escenaFotoCuarto(op, ancho, alto), llave, ancho, alto);
}
// igual, pero los shaders del cuarto se compilan en paralelo antes de dibujar: la primera casa de la Ciudad trababa ~1 s
async function fotoCuartoSinTrabar(opciones = {}, ancho = 480, alto = 300) {
  const op = opFotoCuarto(opciones), llave = llaveFotoCuarto(op, ancho, alto);
  if (fotos.has(llave)) return fotos.get(llave);
  const f = escenaFotoCuarto(op, ancho, alto);
  await compilarSinTrabar(f.r, f.escena, f.cam);
  return revelarFotoCuarto(f, llave, ancho, alto);
}

await cargarGLB();
if (!GLB.lista) { esculpidas = Promise.resolve(); await cargarModelos(); esculpidasListas = true; }   // sin GLB: las esculpidas de respaldo

window.Monstruos = { montar, montarCuarto, fotoCuarto, fotoCuartoSinTrabar, montarJefe, montarCofre, montarBote, fotoBote, fotoBoteSinTrabar, foto, fotoObjeto, fotoLista, fotoSinTrabar, cargar, ESPECIES, PRENDAS, MUEBLES, PELAJES, OJOS, RIG, MODELOS_EXTERNOS, registrarModelo, THREE, PAREDES, PISOS, LUGARES, JEFES, disponible: webglDisponible() };
window.dispatchEvent(new Event('monstruos-listos'));
// el dibujante de miniaturas se prepara en un rato libre (antes se creaba al abrir la tienda por primera vez)
if (window.Monstruos.disponible) enReposo(() => { try { prepararFotografo(); } catch { /* sin 3D */ } });
if (window.Monstruos.disponible && GLB.lista) setTimeout(cargarResto, 4000);
