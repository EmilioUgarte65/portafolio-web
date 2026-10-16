/* Distrito — efectos de las cartas de jugador: inclinacion 3D con muelle, brillo que sigue
   el angulo, paralaje de la foto y destellos de revelado.
   Tomado de MNGameCenter (game/Assets/_Project/Code/UI/EfectoRareza.cs y CartaMovible.cs):
     - el brillo es funcion del angulo (carta plana = casi sin brillo) con una curva que satura pronto;
     - al soltar, la carta vuelve con un muelle suave (rigidez 120, freno 22: casi sin rebote; el usuario la sentía muy fuerte);
     - nada se anima fuera de pantalla y con "menos movimiento" no hay inclinacion ni destellos.
   Solo CSS (transform/opacity) + variables --fx --fy --fk; sin lienzos ni librerias. */
'use strict';

window.CartasFX = (() => {
  const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RIGIDEZ = 120, FRENO = 22;   // muelle suave y casi sin rebote al soltar
  const vivas = new Map();   // carta -> estado del muelle
  let raf = 0, ultimo = 0, encima = null;
  const lim = (v) => Math.max(-1, Math.min(1, v));
  // 0 en reposo, sube rapido y a ~60% de inclinacion ya esta entero (EfectoRareza.Curva)
  const curva = (m) => (m < 0.02 ? 0 : 1 - (1 - Math.min(1, (m - 0.02) / 0.6)) ** 2);

  function estado(c) {
    let e = vivas.get(c);
    if (!e) {
      e = { x: 0, y: 0, vx: 0, vy: 0, mx: 0, my: 0, dedo: null, r: null };
      vivas.set(c, e);
      c.classList.add('fx-mueve');
      if (!raf) { ultimo = performance.now(); raf = requestAnimationFrame(paso); }
    }
    return e;
  }
  function soltarDel(c) {
    vivas.delete(c);
    c.classList.remove('fx-mueve');
    for (const p of ['--fx', '--fy', '--fk']) c.style.removeProperty(p);
  }
  function paso(t) {
    const dt = Math.min(0.05, Math.max(0.001, (t - ultimo) / 1000));
    ultimo = t;
    for (const [c, e] of vivas) {
      if (!c.isConnected) { vivas.delete(c); continue; }
      if (e.dedo !== null) {
        // con el dedo encima persigue rapido (sin muelle) y guarda la velocidad para soltar con impulso
        const k = 1 - Math.exp(-10 * dt);   // sigue al dedo con calma
        const nx = e.x + (e.mx - e.x) * k, ny = e.y + (e.my - e.y) * k;
        e.vx = (nx - e.x) / dt; e.vy = (ny - e.y) / dt; e.x = nx; e.y = ny;
      } else {
        e.vx += (RIGIDEZ * (e.mx - e.x) - FRENO * e.vx) * dt;
        e.vy += (RIGIDEZ * (e.my - e.y) - FRENO * e.vy) * dt;
        e.x += e.vx * dt; e.y += e.vy * dt;
      }
      const enMeta = Math.abs(e.x - e.mx) + Math.abs(e.y - e.my) < 0.003 && Math.abs(e.vx) + Math.abs(e.vy) < 0.02;
      if (e.dedo === null && enMeta && Math.abs(e.mx) + Math.abs(e.my) < 0.03) { soltarDel(c); continue; }
      const s = c.style;
      s.setProperty('--fx', e.x.toFixed(3));
      s.setProperty('--fy', e.y.toFixed(3));
      s.setProperty('--fk', curva(Math.hypot(e.x, e.y)).toFixed(3));
    }
    raf = vivas.size ? requestAnimationFrame(paso) : 0;
  }

  // la meta sale de donde esta el dedo sobre la carta (-1..1); el rect se mide al empezar
  function apuntar(e, ev) {
    const r = e.r;
    if (!r || !r.width) return;
    e.mx = lim(((ev.clientX - r.left) / r.width) * 2 - 1);
    e.my = lim(((ev.clientY - r.top) / r.height) * 2 - 1);
  }
  const tarjeta = (el) => (el && el.closest ? el.closest('.carta:not(.oculta)') : null);
  const soltar = (c) => { const e = vivas.get(c); if (e) { e.dedo = null; e.mx = 0; e.my = 0; } };

  document.addEventListener('pointerdown', (ev) => {
    if (reducido()) return;
    const c = tarjeta(ev.target);
    if (!c) return;
    const e = estado(c);
    e.dedo = ev.pointerId;
    e.r = c.getBoundingClientRect();
    apuntar(e, ev);
    // la carta grande (ficha y revelado) se arrastra sin mover la pagina
    if (c.closest('.carta-grande, .foco') && ev.pointerType !== 'mouse') { try { c.setPointerCapture(ev.pointerId); } catch { /* sin captura */ } }
  }, { passive: true });
  document.addEventListener('pointermove', (ev) => {
    if (reducido()) return;
    for (const [, e] of vivas) if (e.dedo === ev.pointerId) { apuntar(e, ev); return; }
    if (ev.pointerType !== 'mouse' || ev.buttons) return;
    // raton: la carta mira al puntero al pasar por encima
    const c = tarjeta(ev.target);
    if (encima && encima !== c) soltar(encima);
    encima = c;
    if (!c) return;
    const e = estado(c);
    if (!e.r) e.r = c.getBoundingClientRect();
    apuntar(e, ev);
  }, { passive: true });
  const fin = (ev) => {
    for (const [c, e] of vivas) if (e.dedo === ev.pointerId) { e.dedo = null; if (c !== encima) { e.mx = 0; e.my = 0; } }
  };
  document.addEventListener('pointerup', fin, { passive: true });
  document.addEventListener('pointercancel', fin, { passive: true });
  document.addEventListener('pointerleave', () => { if (encima) { soltar(encima); encima = null; } });
  window.addEventListener('scroll', () => { if (encima) { soltar(encima); encima = null; } for (const [, e] of vivas) e.r = null; }, { passive: true, capture: true });

  /* giroscopio: solo donde no pide permiso (Android); la carta destacada se inclina al mover el telefono.
     La base sigue despacio al telefono: si lo dejas quieto, la carta vuelve a quedar plana. */
  let base = null;
  const destacada = () => document.querySelector('.carta-grande .carta:not(.oculta), .foco .carta, #p-carta .carta:not(.oculta)');
  if ('DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function'
      && window.matchMedia('(pointer: coarse)').matches) {
    window.addEventListener('deviceorientation', (ev) => {
      if (reducido() || ev.gamma == null || ev.beta == null) return;
      if (!base) base = { g: ev.gamma, b: ev.beta };
      base.g += (ev.gamma - base.g) * 0.03;
      base.b += (ev.beta - base.b) * 0.03;
      const c = destacada();
      if (!c || !c.classList.contains('fx-vista')) return;
      const gx = lim((ev.gamma - base.g) / 16), gy = lim((ev.beta - base.b) / 16);
      if (Math.abs(gx) + Math.abs(gy) < 0.05 && !vivas.has(c)) return;
      const e = estado(c);
      if (e.dedo === null && c !== encima) { e.mx = gx; e.my = gy; }
    });
  }

  /* solo se animan las cartas que se ven (fx-vista); las demas quedan en pausa */
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => { for (const x of es) x.target.classList.toggle('fx-vista', x.isIntersecting); }, { rootMargin: '40px' })
    : null;
  const cartasEn = (n) => (n.nodeType !== 1 ? [] : n.matches('.carta') ? [n] : n.querySelectorAll ? [...n.querySelectorAll('.carta')] : []);
  function preparar(raiz) {
    for (const c of cartasEn(raiz)) {
      if (c.fxListo) continue;
      c.fxListo = true;
      if (io) io.observe(c); else c.classList.add('fx-vista');
    }
  }
  new MutationObserver((ms) => {
    for (const m of ms) {
      for (const n of m.addedNodes) preparar(n);
      if (io) for (const n of m.removedNodes) for (const c of cartasEn(n)) { io.unobserve(c); c.fxListo = false; }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  preparar(document.documentElement);

  /* ---------------------------------------------- destellos de revelado */
  const reiniciar = (el, cls, ms) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); };
  // un barrido de luz sobre la carta (400 ms, como el revelado de MNGameCenter)
  function destello(c) { if (c && !reducido()) reiniciar(c, 'fx-destello', 1100); }
  // estrellitas de cuatro puntas que salen de la carta (tope bajo: son caras en un telefono modesto)
  function chispas(el, n = 12, color = '') {
    if (!el || reducido()) return;
    const r = el.getBoundingClientRect();
    const capa = document.createElement('div');
    capa.className = 'fx-chispero';
    capa.style.left = r.left + r.width / 2 + 'px';
    capa.style.top = r.top + r.height / 2 + 'px';
    if (color) capa.style.setProperty('--c', color);
    const radio = Math.max(r.width, r.height) * 0.75;
    for (let i = 0; i < Math.min(n, 18); i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const d = radio * (0.55 + Math.random() * 0.6);
      const s = document.createElement('i');
      s.style.cssText = `--x:${(Math.cos(a) * d).toFixed(0)}px;--y:${(Math.sin(a) * d).toFixed(0)}px;--t:${(0.8 + Math.random() * 0.6).toFixed(2)}s;--s:${(0.5 + Math.random() * 0.9).toFixed(2)};--d:${(Math.random() * 0.15).toFixed(2)}s`;
      capa.appendChild(s);
    }
    document.body.appendChild(capa);
    setTimeout(() => capa.remove(), 1700);
  }
  // rafaga de luz a pantalla completa (leyenda): dos golpes de luz y rayos, del tinte de la edicion.
  // Con `donde` (el velo del sobre) va detras de las cartas, no encima.
  function rafaga(tinte = '', donde = document.body) {
    if (reducido()) return;
    const d = document.createElement('div');
    d.className = 'fx-rafaga';
    if (tinte) d.style.setProperty('--tinte', tinte);
    d.innerHTML = '<i></i>';
    donde.prepend(d);
    setTimeout(() => d.remove(), 1500);
  }
  // sacudida corta de la escena (leyenda: ~6 px, 280 ms)
  function sacudir(el) { if (el && !reducido()) reiniciar(el, 'fx-sacude', 320); }

  return { preparar, destello, chispas, rafaga, sacudir, reducido };
})();
