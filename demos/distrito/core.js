/* Distrito — nucleo: estado, API, utilidades, HUD y navegacion. */
'use strict';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('es-MX');
const mf = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const ic = (id, cls = '') => `<svg class="ic ${cls}"><use href="#i-${id}"/></svg>`;
const coin = (cls = '') => `<svg class="coin ${cls}" viewBox="0 0 24 24"><use href="#moneda"/></svg>`;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (iso) => { if (!iso) return ''; const [y, m, d] = iso.slice(0, 10).split('-'); return `${+d} ${MESES[+m - 1]}`; };
const iniciales = (n) => String(n || '?').split(/\s+/).map((w) => w.replace(/[^\p{L}]/gu, '')).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const primerNombre = (n) => String(n || '').split(/\s+/).slice(0, 1).join(' ');
const dosNombres = (n) => String(n || '').split(/\s+/).slice(0, 2).join(' ');
// La fecha "de hoy" la dicta el servidor (puede estar simulada); el reloj del telefono solo es respaldo.
const hoyISO = () => { if (typeof S !== 'undefined' && S.estado?.hoy) return S.estado.hoy; const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const hoyMes = () => hoyISO().slice(0, 7);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* Vocabulario del juego: cada actividad real tiene su nombre "de juego" (y su explicacion real en Reglas). */
// multiplicador de monedas por racha (motor.py: reglas "multiplicador")
const MULT_RACHA = [[15, 1.5], [10, 1.4], [5, 1.3], [3, 1.2]];
const multRacha = (dias) => (MULT_RACHA.find(([d]) => (dias || 0) >= d) || [0, 1])[1];
const ICONO_TIPO = { multiplicador: 'fuego', prospeccion: 'estrella', retencion: 'reactivar', desarrollo: 'complementos', reactivacion: 'reactivar', cotizacion: 'cotizacion', seguimiento: 'seguimiento', seguimiento_efectivo: 'efectivo', complementos: 'complementos', ventas_pequenas: 'pequenas', sorpresa: 'cofre', racha: 'fuego', aplauso: 'aplauso', reto: 'reto', diario: 'diario', limpieza: 'banio', mision: 'misiones', qr: 'qr', ajuste: 'ajuste' };
const NOMBRE_TIPO = { reactivacion: 'Vecinos despertados', cotizacion: 'Encargos cobrados', seguimiento: 'Visitas reportadas', seguimiento_efectivo: 'Visitas que compraron', complementos: 'Combos', ventas_pequenas: 'Bolsas de gemas', sorpresa: 'Cofres diarios', racha: 'Rachas', aplauso: 'Aplausos', reto: 'Contratos', diario: 'Bonos de llegada', mision: 'Misiones diarias', qr: 'Cobros con QR', ajuste: 'Ajustes' };
const COLOR_TIPO = { reactivacion: '#12b06a', cotizacion: '#2f6bff', seguimiento: '#ff6a3d', seguimiento_efectivo: '#ff3d86', complementos: '#e1211c', ventas_pequenas: '#0fa9b8', sorpresa: '#ffb21e', racha: '#ff5e00', aplauso: '#ff3d86', reto: '#12b06a', diario: '#ffb21e', mision: '#2f6bff', qr: '#0fa9b8', ajuste: '#8495bb' };
const MEDIOS = { whatsapp: ['WhatsApp', 'wa'], facebook: ['Facebook', 'fb'], llamada: ['Llamada', 'tel'], visita: ['En tienda', 'casa'], correo: ['Correo', 'seguimiento'] };
/* Monstruitos 3D */
const NOMBRE_MONSTRUO = { obra: 'Ladrillín', pisos: 'Azulín', pintura: 'Brochi', plomeria: 'Gotita', ferreteria: 'Tuerquín',
  patito: 'Patito', cocodrilo: 'Coco', gatito: 'Michi', xolo: 'Xolo', ajolote: 'Ajolotito', pinguino: 'Pingui',
  conejito: 'Conejito', panda: 'Pandita', unicornio: 'Unicornio', murcielago: 'Murci' };
const ES_ANIMAL = new Set(['patito', 'cocodrilo', 'gatito', 'xolo', 'ajolote', 'pinguino', 'conejito', 'panda', 'unicornio', 'murcielago']);
const nombreMascota = (b) => (b?.perfil?.mascota_nombre || NOMBRE_MONSTRUO[miMonstruo(b).especie]);
const ETAPAS = ['Bebé', 'Joven', 'Adulto', 'Legendario'];
const etapaDe = (indiceNivel) => (indiceNivel >= 4 ? 2 : indiceNivel >= 2 ? 1 : 0);
function miMonstruo(b) {
  const p = b?.perfil || {};
  const ms = b?.mascota;
  return { especie: p.monstruo || b?.gremio?.clave || 'obra', equipo: p.equipo || {},
    etapa: ms ? ms.etapa : etapaDe(b?.nivel?.indice || 0), crecimiento: ms ? (ms.crecimiento ?? Math.min(1, (ms.nivel - 1) / 24)) : undefined,
    color: p.pelaje || '', ojos: p.ojos || 'normal' };
}
function cuandoMonstruos() {
  return window.Monstruos ? Promise.resolve(window.Monstruos)
    : new Promise((ok) => window.addEventListener('monstruos-listos', () => ok(window.Monstruos), { once: true }));
}
async function montarMonstruo(el, opciones) {
  const M = await cuandoMonstruos();
  await M.cargar?.(opciones?.especie);
  if (!M.disponible || !el || !el.isConnected) return null;
  try { return M.montar(el, opciones); } catch { return null; }
}

// Jefe de la semana: rotan cada semana (lunes a domingo); Don Rezago abre la semana del lanzamiento (31-ago-2026)
const JEFES_MES = [
  ['rezago', 'Don Rezago', 'Se alimenta de los clientes olvidados.'],
  ['cotizon', 'La Cotización Olvidada', 'Junta cada cotización a la que nadie le dio seguimiento.'],
  ['fantasma', 'El Cliente Fantasma', 'Vino una vez… y nadie le volvió a llamar.'],
  ['dormilon', 'Don Dormilón', 'Arrulla a los clientes que dejaste de visitar.'],
  ['regateo', 'La Reina del Regateo', 'Te saca descuento si no defiendes el valor.'],
  ['sinmas', 'El Sin-Complemento', 'Pintura sin brocha, taladro sin brocas: así le gusta.'],
];
// punto debil de cada jefe: que encargos le pegan justo ahi (cotizacion = por vencer, reactivar = dormidos)
const DEBILIDAD_JEFE = {
  rezago: ['reactivar', 'Los clientes olvidados', 'Escríbele a un cliente que dejó de venir.'],
  cotizon: ['cotizacion', 'Las cotizaciones sin seguimiento', 'Dale seguimiento a las que están por vencer.'],
  fantasma: ['todos', 'Los clientes a los que nadie volvió a llamar', 'Llama o escríbele a cualquiera de tus encargos.'],
  dormilon: ['reactivar', 'Los clientes que dejaste de visitar', 'Despierta a un vecino dormido.'],
  regateo: ['cotizacion', 'Defender el valor', 'Cierra tus cotizaciones con complemento, sin regalar descuento.'],
  sinmas: ['cotizacion', 'Las ventas sin complemento', 'Ofrece un complemento en cada cotización.'],
};
function jefeDelMes(desde, tipoEquipo = '') {   // desde: lunes de la semana; tipoEquipo: el que manda el servidor para tu equipo
  const f = desde ? new Date(desde + 'T12:00:00') : new Date();
  const lunes = new Date(f); lunes.setDate(f.getDate() - ((f.getDay() + 6) % 7));
  const n = Math.round((lunes - new Date('2026-08-31T12:00:00')) / (7 * 864e5));
  // cada equipo (gremio + tienda) tiene su propio enemigo: lo decide el servidor (server.jefe_de)
  const [tipo, nombre, lema] = JEFES_MES.find((j) => j[0] === tipoEquipo) || JEFES_MES[((n % JEFES_MES.length) + JEFES_MES.length) % JEFES_MES.length];
  const [encargo, debil, como] = DEBILIDAD_JEFE[tipo] || ['todos', '', ''];
  return { tipo, nombre, lema, debilidad: { encargo, debil, como } };
}
// Monedas: en modo prueba son infinitas
const fmtMonedas = (n) => (n >= 1e8 ? '∞' : nf.format(n));
function salirModoPrueba() {
  const dir = store.get('sesionDirector');
  document.querySelector('.franja-prueba')?.remove();
  if (!dir) { salir(false); return; }
  S.sesion = dir; store.set('sesion', dir); store.del('sesionDirector');
  S.base = null; S.verAsesor = null; S.vista = 'admin'; render(); window.scrollTo(0, 0);
}
// Sucursales por su nombre (el ERP usa codigos)
const NOMBRE_TIENDA = { DEMO_A: 'Sucursal demo A', DEMO_B: 'Sucursal demo B', DEMO_C: 'Sucursal demo C', DEMO_D: 'Sucursal demo D' };
const tiendaNombre = (cod) => NOMBRE_TIENDA[cod] || cod || '';
const RAREZA = { comun: 'Común', rara: 'Rara', epica: 'Épica', legendaria: 'Legendaria' };

const store = {
  get(k, d = null) { try { const v = sessionStorage.getItem('pmn.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem('pmn.' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  del(k) { try { sessionStorage.removeItem('pmn.' + k); } catch { /* sin almacenamiento */ } },
};

const S = {
  sesion: store.get('sesion'),
  vista: 'base',
  base: null,          // ultimo paquete de /api/base
  estado: null,        // /api/estado
  verAsesor: null,     // admin mirando el juego de un asesor
  equipoTab: 'jefe',
  arena: 'liga',
  encargosTab: 'todos',
  perfilTab: 'color',
  adminTab: 'asesores',
  jugadaIdx: 0,
};

/* ------------------------------------------------------------ API */
// Las ventas del ERP cambian una vez al dia: lo que se lee (GET) se guarda en memoria 45 s y al volver a una pantalla se
// pinta al instante. Cualquier accion (POST/PUT/DELETE) borra lo guardado para que nunca se vea algo viejo despues de actuar.
const memApi = new Map();
const SIN_MEMORIA = /^\/api\/(estado|novedades|foto|sesion|publico)/;
async function api(path, opts = {}) {
  const metodo = (opts.method || 'GET').toUpperCase();
  if (metodo !== 'GET') memApi.clear();
  else if (!SIN_MEMORIA.test(path)) {
    const m = memApi.get(path);
    if (m && Date.now() - m.t < 45000) return structuredClone(m.d);
    const d = await apiRed(path, opts);
    memApi.set(path, { t: Date.now(), d: structuredClone(d) });
    return d;
  }
  return apiRed(path, opts);
}
// lo último que se leyó de esa dirección aunque ya tenga más de 45 s (hasta 10 min): para pintar al instante y refrescar por
// detrás. Cualquier acción (POST/PUT/DELETE) lo borra igual que lo de memApi, así que nunca sale algo de antes de actuar.
function apiReciente(path, maxMs = 600000) { const m = memApi.get(path); return m && Date.now() - m.t < maxMs ? structuredClone(m.d) : null; }
const apiFresca = (path) => { const m = memApi.get(path); return !!m && Date.now() - m.t < 45000; };
async function apiRed(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.sesion?.token) headers.Authorization = 'Bearer ' + S.sesion.token;
  let res;
  // los errores dicen que hacer (sin señal, servidor caido), no solo "Failed to fetch"
  try { res = await fetch(path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } }); }
  catch { throw new Error('Sin conexión. Revisa tu señal o tu wifi y vuelve a intentar.'); }
  if (res.status === 401 && S.sesion) { salir(false); throw new Error('Tu sesión expiró: vuelve a entrar con tu código y tu PIN.'); }
  const data = res.headers.get('Content-Type')?.includes('json') ? await res.json().catch(() => null) : null;
  if (!res.ok) { const e = new Error(data?.error || (res.status >= 500 ? `Algo falló de nuestro lado (error ${res.status}). Intenta de nuevo en un momento.` : `No se pudo (error ${res.status}). Intenta de nuevo.`)); e.status = res.status; throw e; }
  return data;
}
const conAsesor = (path) => (S.sesion?.rol === 'admin' && S.verAsesor ? path + (path.includes('?') ? '&' : '?') + 'asesor=' + encodeURIComponent(S.verAsesor.codigo) : path);
const esAsesor = () => S.sesion?.rol === 'asesor';

/* Comportamiento en la app (para el panel del director): cada toque, cada cambio de pantalla y cuánto tiempo pasa en
   cada una. Se junta en el teléfono y se manda en paquetes cada 20 s o al salir de la app (no uno por uno), para no
   cargar al servidor. Solo asesores reales: el director y su modo prueba no cuentan. */
const Rastro = (() => {
  const sesion = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  let cola = [], pantalla = '', desde = Date.now();
  try { cola = JSON.parse(sessionStorage.getItem('pmn.rastro') || '[]'); } catch { cola = []; }
  const activo = () => esAsesor() && !S.sesion?.demo;
  const donde = () => [S.vista, S.vista === 'tienda' || S.vista === 'mercado' ? S.tiendaTab : ''].filter(Boolean).join('/');
  const guardar = () => { try { sessionStorage.setItem('pmn.rastro', JSON.stringify(cola.slice(-500))); } catch { /* sin almacenamiento */ } };
  function agregar(tipo, objetivo = '', ms = 0, en = donde()) {
    if (!activo()) return;
    cola.push({ ts: new Date().toISOString().slice(0, 19), tipo, pantalla: en, objetivo, ms: Math.round(ms) });
    if (cola.length >= 60) enviar(); else guardar();
  }
  function enviar(alSalir = false) {
    if (!cola.length || !S.sesion?.token || !activo()) return;
    const lote = cola.splice(0, 300); guardar();
    fetch('/api/eventos', { method: 'POST', keepalive: alSalir, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.sesion.token },
      body: JSON.stringify({ sesion, eventos: lote }) })
      .then((r) => { if (!r.ok && r.status >= 500) throw new Error(); })
      .catch(() => { cola = lote.concat(cola); guardar(); });   // sin red: se reintenta en el siguiente paquete
  }
  // el tiempo en una pantalla se cierra al cambiar de pantalla o al salir de la app
  function cerrarTiempo() { if (pantalla) agregar('tiempo', '', Date.now() - desde, pantalla); desde = Date.now(); }
  function cambio() {
    const ahora = donde();
    if (ahora === pantalla) return;
    cerrarTiempo(); pantalla = ahora; agregar('pantalla', '', 0, ahora);
  }
  // qué se tocó: un nombre corto y estable (id, acción o pestaña), no el texto completo
  function nombre(el) {
    const d = el.dataset || {};
    if (el.id) return '#' + el.id;
    for (const [k, p] of [['acc', 'acc:'], ['v', 'tab:'], ['t', 'pestaña:'], ['l', 'lugar:'], ['comida', 'comida:'], ['campo', 'estilo:'], ['k', 'item:']]) if (d[k] !== undefined) return p + d[k];
    if (el.tagName === 'CANVAS') return 'canvas:' + (el.parentElement?.id || '3d');
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return (el.className && typeof el.className === 'string' ? el.className.split(' ')[0] + ':' : '') + txt;
  }
  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('button, a, [data-acc], [data-k], [data-t], [data-l], [data-v], canvas');
    if (el) agregar('clic', nombre(el));
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { cerrarTiempo(); agregar('sesion_fin'); enviar(true); }
    else { desde = Date.now(); agregar('sesion_inicio'); }
  });
  setInterval(() => enviar(), 20000);
  return { cambio, agregar, enviar };
})();

// varias pantallas piden la base al mismo tiempo al abrir la app: comparten la misma peticion en lugar de hacer tres
let baseEnCamino = null;
function cargarBase(forzar = false) {
  if (!baseEnCamino) baseEnCamino = traerBase(forzar).finally(() => { baseEnCamino = null; });
  return baseEnCamino;
}
async function traerBase(forzar) {
  const llave = 'base:' + (S.verAsesor?.codigo || S.sesion?.codigo);
  try {
    const [b] = await Promise.all([api(conAsesor('/api/base')), cargarEstado()]);
    S.base = b; S.baseHora = Date.now(); store.set(llave, b);
  } catch (e) {
    if (!S.base || forzar) S.base = store.get(llave);
    if (!S.base) throw e;
    toast('Sin conexion: mostrando lo ultimo guardado', true);
  }
  pintarHud();
  return S.base;
}
async function cargarEstado() {
  try { S.estado = await api('/api/estado'); } catch { /* sin red */ }
  return S.estado;
}

/* ------------------------------------------------------------ retroalimentacion */
let toastT;
function toast(msg, err = false, ms = 0) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'ver' + (err ? ' err' : '');
  // lo largo se queda mas tiempo en pantalla (para leerlo con calma); un error, al menos 4.5 s
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = ''), ms || Math.min(9000, Math.max(err ? 4500 : 3000, String(msg).length * 55)));
  if (err) Juego.Sonido.error();
}
function flotante(texto, el) {
  const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
  const f = document.createElement('div');
  f.className = 'flotante'; f.textContent = texto;
  f.style.left = r.left + r.width / 2 + 'px'; f.style.top = r.top + 'px';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1300);
}
// Todo boton "fisico" suena y vibra al presionarse: la respuesta inmediata hace que el juego se sienta vivo.
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button, [role="button"], .b3, .tab, .opcion, .titulo-op, .carta[data-carta], .carta[data-falta], #mi-carta .carta, #p-carta .carta, .fila-click');
  if (!b || b.disabled) return;
  Juego.Sonido.init(); if (b.matches('.tab, [data-ciudad]')) Juego.Sonido.tab?.(); else Juego.Sonido.pop(); Juego.vibrar(8);
}, { passive: true });
// toda hoja (el panel que sube desde abajo) suena al abrirse, una vez por hoja (si se vuelve a pintar no); juego.js no la encima con un swoosh
{
  const hojasOidas = new WeakSet();
  new MutationObserver((cambios) => {
    for (const c of cambios) for (const n of c.addedNodes) {
      if (n.nodeType !== 1) continue;
      const v = n.classList.contains('velo') ? n : n.classList.contains('hoja') && n.parentElement?.classList.contains('velo') ? n.parentElement : null;
      if (v && !hojasOidas.has(v) && v.querySelector(':scope > .hoja')) { hojasOidas.add(v); Juego.Sonido.hoja?.(); }
    }
  }).observe(document.body, { childList: true, subtree: true });
}

// toda hoja se cierra jalandola hacia abajo desde su asita (o desde arriba cuando ya esta hasta arriba del scroll),
// como en las apps del telefono. Al soltar: si bajo bastante o rapido, se cierra; si no, regresa.
{
  let arr = null;
  const cerrarHoja = (velo) => {
    const x = velo.querySelector('[data-cerrar]:not(.x-hoja), [data-no]');
    if (x) x.click(); else velo.remove();
  };
  document.addEventListener('pointerdown', (e) => {
    const hoja = e.target.closest('.velo > .hoja');
    if (!hoja || e.button > 0 || hoja.hasAttribute('data-fijo')) return;
    const enAsa = e.target.closest('.asa, .hoja-cab') || e.clientY - hoja.getBoundingClientRect().top < 44;
    if (!enAsa && hoja.scrollTop > 0) return;
    if (!enAsa && e.target.closest('input, textarea, select, .chips-scroll, [data-sin-arrastre]')) return;
    arr = { hoja, y0: e.clientY, t0: performance.now(), dy: 0, activo: false, asa: !!enAsa, id: e.pointerId };
  }, { passive: true });
  document.addEventListener('pointermove', (e) => {
    if (!arr || e.pointerId !== arr.id) return;
    const dy = e.clientY - arr.y0;
    if (!arr.activo) { if (dy > 8 && (arr.asa || arr.hoja.scrollTop <= 0)) { arr.activo = true; arr.hoja.style.transition = 'none'; } else if (Math.abs(dy) > 8) { arr = null; return; } else return; }
    arr.dy = Math.max(0, dy);
    arr.hoja.style.transform = `translateY(${arr.dy}px)`;
    arr.hoja.parentElement.style.background = `rgba(10, 15, 40, ${Math.max(0, .45 - arr.dy / 900)})`;
  }, { passive: true });
  const soltar = () => {
    if (!arr) return;
    const { hoja, dy, t0, activo } = arr; arr = null;
    if (!activo) return;
    const rapido = dy / Math.max(1, performance.now() - t0) > 0.6;
    hoja.style.transition = 'transform .22s ease-out';
    if (dy > Math.min(140, hoja.offsetHeight * 0.25) || (rapido && dy > 40)) {
      hoja.style.transform = 'translateY(110%)';
      Juego.Sonido.swoosh?.();
      setTimeout(() => cerrarHoja(hoja.parentElement), 200);
    } else {
      hoja.style.transform = ''; hoja.parentElement.style.background = '';
      setTimeout(() => { hoja.style.transition = ''; }, 230);
    }
  };
  document.addEventListener('pointerup', soltar); document.addEventListener('pointercancel', soltar);
  // tocar lo oscuro de afuera tambien cierra (en todas las hojas, aunque la hoja no lo haya programado)
  document.addEventListener('click', (e) => { if (e.target.classList?.contains('velo') && e.target.querySelector(':scope > .hoja:not([data-fijo])')) cerrarHoja(e.target); });

  // toda hoja lleva una X arriba a la derecha que no se va al bajar (las que no la traen de fabrica la reciben aqui)
  const ponerX = (h) => {
    const cab = h.querySelector(':scope > .hoja-cab .hud-btn');
    if (cab) { if (!cab.getAttribute('aria-label')) cab.setAttribute('aria-label', 'Cerrar'); return; }
    if (h.hasAttribute('data-fijo') || h.querySelector(':scope > .x-hoja-fila')) return;
    const f = document.createElement('div');
    f.className = 'x-hoja-fila';
    f.innerHTML = `<button type="button" class="hud-btn x-hoja" aria-label="Cerrar" title="Cerrar">${ic('cerrar')}</button>`;
    h.prepend(f); h.classList.add('con-x');
    f.firstChild.onclick = (e) => { e.stopPropagation(); if (h.parentElement) cerrarHoja(h.parentElement); };
  };
  new MutationObserver((cambios) => {
    for (const c of cambios) for (const n of c.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.matches('.velo > .hoja')) ponerX(n);
      else if (n.matches('.velo')) n.querySelectorAll(':scope > .hoja').forEach(ponerX);
    }
  }).observe(document.body, { childList: true, subtree: true });

  /* El boton "atras" del telefono (o del navegador) cierra lo que este abierto encima (hoja, festejo, tutorial) o
     regresa de una sub-pantalla (perfil, temporada, reglas, cuarto de otro) en vez de salirse de la app. Se guarda
     un solo lugar en el historial por capa abierta y uno por sub-pantalla; al cerrarlas con su boton se devuelven. */
  const SUB = ['perfil', 'temporada', 'reglas', 'cuarto'];
  const capas = () => [...document.body.children].filter((e) => e.matches('.velo, .cofre-velo, .guia'));
  let nivel = 0, ignorar = 0, pila = [], vistaVista = null, regresando = false, tAj = 0;
  const ajustar = () => {
    tAj = 0;
    if (ignorar) return;
    if (S.vista !== vistaVista) {
      if (!SUB.includes(S.vista)) pila = [];
      else if (vistaVista && !regresando && vistaVista !== S.vista) pila.push(vistaVista);
      vistaVista = S.vista; regresando = false;
    }
    const L = !S.sesion ? 0 : (SUB.includes(S.vista) ? Math.min(3, pila.length || 1) : 0) + (capas().length ? 1 : 0);
    if (L > nivel) for (; nivel < L; nivel++) history.pushState({ mn: nivel + 1 }, '');
    else if (L < nivel) { ignorar++; history.go(L - nivel); nivel = L; }
  };
  const pedirAjuste = () => { if (!tAj) tAj = setTimeout(ajustar, 0); };
  const cerrarCapa = (c) => {
    const h = c.matches('.velo') && c.querySelector(':scope > .hoja');
    if (h && !h.hasAttribute('data-fijo')) return cerrarHoja(c);
    const b = [...c.querySelectorAll('[data-cerrar], [data-no], [data-g="saltar"], [data-g="atras"], .saltar, #sp-saltar, #b-listo, #rp-listo, #b-cambio-ok, #sellos-ok')]
      .find((x) => !x.disabled && !x.hidden && x.getClientRects().length);
    if (b) b.click();
  };
  addEventListener('popstate', () => {
    if (ignorar) { ignorar--; pedirAjuste(); return; }
    nivel = Math.max(0, nivel - 1);
    const cs = capas();
    if (cs.length) cerrarCapa(cs[cs.length - 1]);
    else if (S.sesion && SUB.includes(S.vista)) { regresando = true; irA(pila.pop() || 'base'); }
    setTimeout(pedirAjuste, 450);   // si lo de encima no se pudo cerrar (una animacion), se vuelve a guardar su lugar
  });
  const obs = new MutationObserver(pedirAjuste);
  obs.observe(document.body, { childList: true });
  const app = document.getElementById('app');
  if (app) obs.observe(app, { childList: true });
}

/* ------------------------------------------------------------ avatar */
function avatar(nombre, apariencia = {}, tam = 46, nivel = null) {
  const color = apariencia.color || 'naranja', marco = apariencia.marco || 'ninguno';
  // foto real solo si ya te salio su carta (el servidor lo decide); si no, sus iniciales de colores
  const m = apariencia.mascota, conFoto = !!(m?.foto && m.codigo);
  const cara = conFoto ? `<img class="avatar-foto" alt="" src="${VACIO_IMG}" data-asesor="${esc(m.codigo)}" data-v="${m.fv || ''}">` : esc(iniciales(nombre));
  return `<div class="avatar ${conFoto ? 'con-mascota' : `c-${esc(color)}`} ${marco !== 'ninguno' ? 'm-' + esc(marco) : ''}" style="--av:${tam}px">${cara}${nivel ? `<span class="nv">${nivel}</span>` : ''}</div>`;
}

/* ------------------------------------------------------------ sesión */
function salir(avisar = true) {
  if (avisar && S.sesion) api('/api/logout', { method: 'POST' }).catch(() => {});
  memApi.clear(); document.getElementById('cuarto-guardado')?.remove(); document.getElementById('jefe-guardado')?.remove();
  S.sesion = null; S.verAsesor = null; S.base = null; store.del('sesion');
  render();
}

// la app que pidio la liga pregunta cada 2.5 s si ya se toco (aunque se abra en el navegador o en otro celular) y entra sola
let esperaLiga = null;
function esperarLiga(espera) {
  clearInterval(esperaLiga);
  const hasta = Date.now() + 15 * 60 * 1000;
  const aviso = document.getElementById('l-esperando');
  if (aviso) aviso.hidden = false;
  esperaLiga = setInterval(async () => {
    if (S.sesion || Date.now() > hasta || !document.getElementById('l-codigo')) { clearInterval(esperaLiga); return; }
    if (document.hidden) return;
    try {
      const r = await api('/api/entrar/espera', { method: 'POST', body: JSON.stringify({ espera }) });
      if (r.token) {
        clearInterval(esperaLiga);
        S.sesion = r; store.set('sesion', r); store.set('ultimoCodigo', r.codigo); S.vista = r.rol === 'admin' ? 'admin' : 'base';
        Juego.Sonido.exito?.(); render(); if (esAsesor()) setTimeout(arranqueJugador, 700);
      }
    } catch { /* sin red: se reintenta */ }
  }, 2500);
}
// entrar sin PIN: con tu usuario te llega al correo una liga que al tocarla inicia tu sesion (un solo uso, 15 min)
function enlazarLigaAdmin() {
  const cod = $('#l-codigo'), btn = $('#l-liga');
  if (!cod || !btn) return;
  btn.hidden = false;
  btn.onclick = async () => {
    const usuario = cod.value.trim();
    if (!usuario) { toast('Primero escribe tu código de asesor'); cod.focus(); return; }
    btn.disabled = true;
    try {
      const r = await api('/api/entrar/liga', { method: 'POST', body: JSON.stringify({ usuario }) });
      toast(r.mensaje || 'Revisa tu correo');
      if (r.espera) esperarLiga(r.espera);
      btn.textContent = 'Listo: revisa tu correo y toca el link';
      setTimeout(() => { btn.disabled = false; btn.textContent = 'Mándame otro link'; }, 30000);
    } catch (e) { toast(e.message, true); btn.disabled = false; }
  };
}
function vistaLogin() {
  $('#app').innerHTML = `
  <div class="login">
    <picture><source srcset="./img/web-dev-eyes.svg" type="image/webp"><img class="logo-login" src="./img/web-dev-eyes.svg" alt="Distrito" width="320" height="279" fetchpriority="high"></picture>
    <form class="panel p-morado" id="f-login" autocomplete="on">
      <div class="brillo"></div>
      <p>Cuida a tu mascota, junta cartas y sube en el ranking con tus ventas.</p>
      <div class="campo"><label for="l-codigo">Tu codigo</label>
        <input class="input" id="l-codigo" name="username" inputmode="text" autocapitalize="off" required placeholder="Ej. 3453" value="${esc(store.get('ultimoCodigo', ''))}"></div>
      <div class="campo"><label for="l-pin">PIN secreto</label>
        <input class="input" id="l-pin" name="password" type="password" inputmode="numeric" autocomplete="current-password" required placeholder="4 a 8 digitos"></div>
      <div class="error-msg" id="l-err"></div>
      <button class="b3 verde ancho grande" type="submit">${ic('play')}Jugar</button>
      <button type="button" class="b-liga" id="l-liga" hidden>Mándame un link a mi correo para entrar</button>
      <p class="l-esperando" id="l-esperando" hidden>Esperando a que toques el link del correo… Cuando lo toques, esta app entra sola (aunque se abra en el navegador).</p>
    </form>
  </div>`;
  $('#l-codigo').value ? $('#l-pin').focus() : $('#l-codigo').focus();
  if (S.avisoEntrada) { $('#l-err').textContent = S.avisoEntrada; S.avisoEntrada = null; }   // liga ya usada o caducada
  enlazarLigaAdmin();
  $('#f-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = ev.target.querySelector('button'); btn.disabled = true; $('#l-err').textContent = '';
    Juego.Sonido.init();
    try {
      const codigo = $('#l-codigo').value.trim();
      const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ codigo, pin: $('#l-pin').value }) });
      S.sesion = r; store.set('sesion', r); store.set('ultimoCodigo', codigo);
      S.vista = r.rol === 'admin' ? 'admin' : 'base';
      Juego.Sonido.exito();
      render();
      if (r.rol === 'asesor') setTimeout(arranqueJugador, 600);
    } catch (e) { $('#l-err').textContent = e.message; btn.disabled = false; Juego.Sonido.error(); }
  });
}

/* ------------------------------------------------------------ armazon del juego */
const TABS = [['base', 'Inicio', 'casa'], ['encargos', 'Encargos', 'mapa'], ['_jugar', 'Jugar', 'rayo'], ['equipo', 'Equipo', 'escudo'], ['tienda', 'Tienda', 'bolsa']];
const VISTAS = () => ({ base: vistaBase, encargos: vistaEncargos, equipo: vistaEquipo, tienda: vistaTienda, mercado: vistaTienda, perfil: vistaPerfil,
  temporada: vistaTemporada, reglas: vistaReglas, admin: vistaAdmin, monstruo: vistaTienda, cuarto: vistaCuarto });

// el cuarto 3D de Inicio no se destruye al cambiar de pantalla: se guarda escondido (no dibuja mientras no se ve) y al
// volver se pone el mismo, al instante, en lugar de volver a armarlo
function guardarCuarto() {
  const hero = document.querySelector('#vista .inicio .cuarto-hero');
  // solo el de Inicio (el cuarto de un compañero que visitas usa el mismo armazon, pero no se guarda)
  if (!hero || !hero.querySelector('#b-mascota') || typeof ctlInicio === 'undefined' || !ctlInicio) return;
  let caja = document.getElementById('cuarto-guardado');
  if (!caja) { caja = document.createElement('div'); caja.id = 'cuarto-guardado'; caja.style.display = 'none'; document.body.appendChild(caja); }
  caja.replaceChildren(hero);
}
function render() {
  if (!S.sesion) { document.getElementById('cuarto-guardado')?.remove(); document.getElementById('jefe-guardado')?.remove(); return vistaLogin(); }
  const admin = S.sesion.rol === 'admin' && !S.verAsesor;
  if (admin && S.vista !== 'admin') S.vista = 'admin';
  guardarCuarto();
  if (typeof guardarJefe === 'function') guardarJefe();
  $('#app').innerHTML = `
  <div class="juego">
    <header class="hud"><div class="wrap ${admin ? 'ancho' : ''}" id="hud"></div></header>
    <main class="wrap ${admin ? 'ancho' : ''}" id="vista"></main>
    ${admin ? '' : `<nav class="tabbar" aria-label="Navegacion"><div class="wrap">
      ${TABS.map(([v, t, i]) => v === '_jugar'
        ? `<button class="tab tab-jugar" data-jugar aria-label="Jugar"><span class="boton-jugar">${ic(i)}</span><span class="lbl">${t}</span></button>`
        : `<button class="tab ${S.vista === v ? 'activo' : ''}" data-v="${v}">${ic(i)}<span>${t}</span>${v === 'encargos' ? '<span class="globo" id="globo-enc" hidden></span>' : ''}</button>`).join('')}
    </div></nav>`}
  </div>`;
  pintarHud();
  // en pantallas que no cargan la base, el encabezado la pide para mostrar monedas y mascota
  if (!admin && !S.base) cargarBase().then(pintarHud).catch(() => {});
  $$('.tabbar [data-v]').forEach((b) => (b.onclick = () => irA(b.dataset.v)));
  const j = $('.tabbar [data-jugar]');
  if (j) j.onclick = () => jugar();
  (VISTAS()[S.vista] || vistaBase)();
  Rastro.cambio();
}

function irA(vista) {
  if (S.vista === vista) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  S.vista = vista; Juego.Sonido.swoosh(); render(); window.scrollTo(0, 0);
}

function pintarHud() {
  const h = $('#hud');
  if (!h) return;
  if (S.sesion.rol === 'admin' && !S.verAsesor) {
    h.innerHTML = `<div class="hud-yo"><div class="logo-mini"><img src="./img/web-dev-eyes.svg" alt="Distrito" width="40" height="40"></div>
      <div class="info"><span class="nombre">Panel del administrador</span><small class="muted">Distrito</small></div></div>
      <button class="hud-btn" id="b-salir" aria-label="Salir">${ic('salir')}</button>`;
    $('#b-salir').onclick = () => salir();
    return;
  }
  const b = S.base;
  const nombre = S.verAsesor?.nombre || S.sesion.nombre || '';
  const nivelIdx = b ? b.nivel.indice + 1 : 1;
  const racha = b?.racha || { dias: 0 };
  h.innerHTML = `
    <button class="hud-yo" id="hud-yo" aria-label="Mi perfil">${avatar(nombre, b ? { ...b.perfil, mascota: b.carta?.carta?.mascota } : {}, 46, nivelIdx)}
      <span class="info"><span class="nombre">${esc(dosNombres(nombre))}</span>
        <span class="barra azul" title="Experiencia"><i style="width:${b ? Math.round(b.nivel.avance * 100) : 0}%"></i><span class="barra-txt">${b ? esc(b.nivel.nombre) : ''}</span></span></span></button>
    <span class="hud-pill" id="hud-monedas" title="Monedas" role="button" tabindex="0" aria-label="Mis monedas: ¿qué son?">${coin()}<span class="num" id="hud-saldo">${b ? fmtMonedas(b.saldo.monedas) : '—'}</span>${b?.misiones?.monedas_por_confirmar ? `<b class="por-llegar" title="Monedas por confirmar">+${b.misiones.monedas_por_confirmar}<span class="pl-txt"> mañana</span></b>` : ''}</span>
    <span class="hud-pill fuego ${racha.dias ? (racha.hoy ? 'vivo' : '') : 'apagado'}" title="Racha" role="button" tabindex="0" aria-label="Mi racha: ¿qué es?">${ic('fuego')}<span class="num">${racha.dias || 0}</span>${multRacha(racha.dias) > 1 ? `<b class="mult">×${multRacha(racha.dias)}</b>` : ''}</span>
    ${S.verAsesor ? `<button class="hud-btn" id="b-dejar" aria-label="Volver al panel">${ic('cerrar')}</button>` : `<button class="hud-btn" id="b-sonido" aria-label="Sonido">${ic(Juego.Sonido.activo ? 'sonido' : 'mudo')}</button>`}`;
  $('#hud-yo').onclick = () => irA('perfil');
  // las dos pastillas del encabezado se explican solas al tocarlas (monedas y racha confunden a quien empieza)
  const porLlegar = b?.misiones?.monedas_por_confirmar;
  $('#hud-monedas').onclick = () => toast(`Monedas: las ganas con tus ventas, visitas y misiones, y las gastas en la Tienda.${porLlegar ? ` Las +${porLlegar} llegan mañana, cuando el sistema confirme tus ventas.` : ''} Tus puntos del ranking son otra cosa y nunca se gastan.`);
  $('.hud-pill.fuego', h).onclick = () => toast(racha.dias ? `Racha: llevas ${racha.dias} día${racha.dias === 1 ? '' : 's'} seguidos cumpliendo tus 3 misiones.${racha.hoy ? ' Hoy ya cumpliste.' : ' Cumple las 3 de hoy para que no se apague.'}` : 'Racha: cumple tus 3 misiones del día varios días seguidos. Desde 3 días ganas monedas extra.');
  // franja del modo prueba del director
  document.querySelector('.franja-prueba')?.remove();
  if (S.sesion.demo) {
    const f = document.createElement('div');
    f.className = 'franja-prueba';
    f.innerHTML = `<span><b>Modo prueba</b> · monedas ∞</span><button id="b-salir-prueba">Volver al panel</button>`;
    document.body.appendChild(f);
    $('#b-salir-prueba', f).onclick = salirModoPrueba;
  }
  fotosPendientes(h);
  const son = $('#b-sonido');
  if (son) son.onclick = () => { const on = Juego.Sonido.alternar(); son.innerHTML = ic(on ? 'sonido' : 'mudo'); toast(on ? 'Sonido activado' : 'Sonido en silencio'); };
  const dejar = $('#b-dejar');
  if (dejar) dejar.onclick = () => { S.verAsesor = null; S.base = null; S.vista = 'admin'; render(); };
  const globo = $('#globo-enc');
  if (globo && b) { const n = b.jugadas.length; globo.hidden = !n; globo.textContent = n > 9 ? '9+' : n; }
}

/* Cuando el saldo cambia, el contador del HUD sube con monedas que vuelan hacia el. */
function animarSaldo(antes, después, desdeEl) {
  const el = $('#hud-saldo');
  if (!el || después <= antes || después >= 1e8) { if (el) el.textContent = fmtMonedas(después); return; }
  Juego.monedas(desdeEl || $('#vista'), $('#hud-monedas'), Math.min(10, 3 + Math.round((después - antes) / 15)), () => {});
  setTimeout(() => Juego.contar(el, antes, después, 900, true), 500);
}

/* ------------------------------------------------------------ piezas comunes */
const esqueleto = (n = 3, h = 110) => Array.from({ length: n }, () => `<div class="sk" style="height:${h}px;margin-top:16px"></div>`).join('');
// si algo no se pudo cargar, ahi mismo esta el boton para volver a intentarlo
const vacio = (titulo, detalle, icono = 'vacio') => `<div class="vacio">${ic(icono)}<b>${esc(titulo)}</b>${esc(detalle)}${titulo === 'No se pudo cargar' ? '<button class="b3 blanco chico" data-reintentar style="margin-top:12px">Volver a intentar</button>' : ''}</div>`;
document.addEventListener('click', (e) => { if (e.target.closest('[data-reintentar]')) render(); });
function avisoDatos() {
  const asOf = S.estado?.sync?.data_as_of;
  if (!asOf) return '';
  const días = Math.round((new Date(hoyISO() + 'T12:00:00') - new Date(asOf + 'T12:00:00')) / 864e5);
  if (días <= 2) return '';
  return `<div class="aviso">${ic('aviso')}<span>Las compras de los clientes se actualizan hasta el <b>${fechaCorta(asOf)}</b>. Tus visitas reportadas cuentan desde hoy; los premios por compras llegarán cuando se actualice el sistema.</span></div>`;
}
function aro(frac, tam = 70, grosor = 9) {
  const r = (tam - grosor) / 2, C = 2 * Math.PI * r;
  return `<svg viewBox="0 0 ${tam} ${tam}"><circle class="fondo" cx="${tam / 2}" cy="${tam / 2}" r="${r}" fill="none" stroke-width="${grosor}"/>
    <circle class="av" cx="${tam / 2}" cy="${tam / 2}" r="${r}" fill="none" stroke-width="${grosor}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.max(0, Math.min(1, frac)))}"/></svg>`;
}
const telLimpio = (t) => String(t || '').replace(/\D/g, '');
const waNum = (t) => { const d = telLimpio(t); return d.length === 10 ? '52' + d : d; };
