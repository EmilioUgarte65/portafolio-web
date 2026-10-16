/* Distrito — el mundo 3D: inicio con tu cuarto, tienda de coleccion, cartas de jugador y visitas.
   Todo lo que se ve mejora con los puntos reales: la mascota crece, se abren lugares del cuarto y sube tu carta. */
'use strict';

const RAREZA_TXT = { comun: 'Común', rara: 'Rara', epica: 'Épica', legendaria: 'Legendaria' };
const NIVEL_CARTA = { icono: 'Ícono', leyenda: 'Diamante', oro: 'Oro', plata: 'Plata', bronce: 'Bronce' };
const ORDEN_CARTA = { bronce: 0, plata: 1, oro: 2, leyenda: 3, icono: 4 };   // = jugador.ORDEN_NIVEL
// Frases del globo según el ánimo: varían y el globo solo aparece de vez en cuando (no fijo todo el tiempo)
const ANIMO_FRASES = {
  feliz: ['¡Qué buen día!', '¡Me encanta mi cuarto!', '¡Vamos por más clientes!', 'Hoy me siento genial', '¿Viste mi nueva ropa?', '¡Somos un gran equipo!'],
  hambre: ['Tengo hambre…', '¿Me das algo de comer?', 'Mi panza hace ruido', 'Se me antoja una galleta'],
  aburrido: ['¿Jugamos?', 'Me aburro un poquito…', '¿Me lanzas la pelota?', 'Hazme cariñitos'],
  sucio: ['¡Estoy sucio!', '¿Me bañas?', 'Tengo lodo hasta en las orejas', 'Me pica todo… ¡un baño, porfa!', 'Huelo un poquito raro…'],
  popo: ['¡Huele feo aquí!', 'Ups… hice popó', '¿Me ayudas a limpiar?', '¡Hay moscas en mi cuarto!', 'Toca la popó para recogerla'],
  tranquilo: ['Todo bien por aquí', 'Aquí relajándome', '¿Qué hacemos hoy?', 'Cuéntame, ¿cómo vas?', 'Mmm… pensando en cosas'],
};
let ultimaFrase = '';
function fraseAnimo(animo) {
  const l = ANIMO_FRASES[animo] || ANIMO_FRASES.tranquilo, opciones = l.filter((x) => x !== ultimaFrase);
  ultimaFrase = opciones[Math.floor(Math.random() * opciones.length)] || l[0];
  return ultimaFrase;
}
// muestra el globo unos segundos; después se esconde y vuelve a salir cada 20–40 s con otra frase
let relojGlobo = 0;
// popos que ya se vieron: si aparece una nueva suena un "plop" suave (la primera vez que se pinta no suena)
let popoVistos = null;
function notarPopos(lista) {
  const ids = (Array.isArray(lista) ? lista : []).map((x) => x.id);
  if (popoVistos && ids.some((i) => !popoVistos.includes(i))) Juego.Sonido.plop?.(0.15);
  popoVistos = ids;
}
function globoAnimo(animo, ya = true) {
  clearTimeout(relojGlobo);
  const g = $('#globo-animo'); if (!g || !g.isConnected) return;
  const mostrar = () => {
    if (!g.isConnected) return;
    g.textContent = fraseAnimo(animo); g.classList.remove('oculto', 'rebote'); void g.offsetWidth; g.classList.add('rebote');
    relojGlobo = setTimeout(() => { g.classList.add('oculto'); relojGlobo = setTimeout(mostrar, 20000 + Math.random() * 20000); }, 4500);
  };
  if (ya) mostrar(); else { g.classList.add('oculto'); relojGlobo = setTimeout(mostrar, 2500); }
}
const ROPA = ['cabeza', 'cara', 'cuello', 'torso', 'espalda'];
const CUARTO = ['cama', 'sillon', 'tapete', 'planta', 'lampara', 'cuadro', 'tech', 'deco', 'pared', 'piso'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const VACIO_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

/* opciones 3D de la mascota a partir del perfil (y del estado de crecimiento) */
function mascotaOp(perfil = {}, mascota = null, gremio = 'obra') {
  return { especie: perfil.monstruo || gremio || 'obra', color: perfil.pelaje || '', ojos: perfil.ojos || 'normal',
    equipo: perfil.equipo || {}, acabados: perfil.acabados || {}, etapa: mascota ? mascota.etapa : 1,
    crecimiento: mascota ? (mascota.crecimiento ?? Math.min(1, (mascota.nivel - 1) / 24)) : 0.4 };
}
// foto de una joya de la coleccion: la mascota con esa especie, color u ojos
const joyaOp = (base, x) => ({ ...base, ...(x.tipo === 'monstruo' ? { especie: x.clave, equipo: {}, color: '' } : x.tipo === 'pelaje' ? { color: x.clave } : { ojos: x.clave }) });
const nombreDeMascota = (m) => m?.nombre || NOMBRE_MONSTRUO[m?.especie] || 'Mascota';
async function fotoMascota(img, op, tam = 160) {
  const M = await cuandoMonstruos();
  await M.cargar?.(op?.especie);
  if (M.disponible && img.isConnected) img.src = M.foto(op, tam);
}
// Fotos reales de los asesores (solo con sesion): se piden una vez y se guardan en memoria
const fotosAsesor = new Map();
function fotoAsesor(codigo, v = '', estilo = '') {
  const llave = codigo + '|' + v + '|' + estilo;  // v = fecha del archivo: si cambia la foto, se pide de nuevo
  if (!fotosAsesor.has(llave)) {
    fotosAsesor.set(llave, fetch('/api/foto?de=' + encodeURIComponent(codigo) + '&v=' + v + (estilo ? '&estilo=' + estilo : ''), { headers: { Authorization: 'Bearer ' + (S.sesion?.token || '') } })
      .then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? URL.createObjectURL(b) : null)).catch(() => null));
  }
  return fotosAsesor.get(llave);
}
// las fotos reales (~30 KB cada una) se piden solo cuando se ven o están por verse: el álbum o un ranking traían 40-60 de golpe
function ponerFotoAsesor(img) {
  const cod = img.dataset.asesor, v = img.dataset.v || ''; if (!cod) return;
  img.removeAttribute('data-asesor'); img.decoding = 'async';
  fotoAsesor(cod, v, img.dataset.estilo || '').then((url) => { if (url) { img.src = url; img.classList.add('lista'); } });
}
const obsAsesor = 'IntersectionObserver' in window ? new IntersectionObserver((entradas) => {
  for (const e of entradas) if (e.isIntersecting) { obsAsesor.unobserve(e.target); ponerFotoAsesor(e.target); }
}, { rootMargin: '400px' }) : null;
async function fotosPendientes(raiz = document) {
  for (const img of $$('img[data-asesor]', raiz)) {
    // ya la tenemos en memoria, o va en una hoja/sobre/festejo (pocas y se revelan con animación): directo, sin esperar
    if (!obsAsesor || img.closest('.velo, .cofre-velo, .hud') || fotosAsesor.has(img.dataset.asesor + '|' + (img.dataset.v || '') + '|' + (img.dataset.estilo || ''))) ponerFotoAsesor(img);
    else obsAsesor.observe(img);
  }
  const M = await cuandoMonstruos();
  if (!M.disponible) return;
  // solo se dibujan las miniaturas que se ven (o están por verse al bajar): abrir una lista larga ya no congela
  const imgs = $$('img[data-foto]', raiz);
  if (!obsFotos) { colaFotos.push(...imgs); procesarFotos(M); return; }
  imgs.forEach((img) => obsFotos.observe(img));
}
const colaFotos = [];
let dibujandoFotos = false;
const obsFotos = 'IntersectionObserver' in window ? new IntersectionObserver((entradas) => {
  for (const e of entradas) if (e.isIntersecting) { obsFotos.unobserve(e.target); colaFotos.push(e.target); }
  if (colaFotos.length && window.Monstruos) procesarFotos(window.Monstruos);
}, { rootMargin: '300px' }) : null;
// una miniatura por cuadro, para no congelar la pantalla en teléfonos modestos
// la mascota de cada miniatura llega bajo pedido (monstruos3d.js): se piden todas las de la cola de una vez
const especieFoto = (d) => (d.op ? d.op.especie || 'obra' : d.objeto === 'torso' ? 'gatito' : '');
async function procesarFotos(M) {
  if (dibujandoFotos) return;
  dibujandoFotos = true;
  try {
    let n = 0;
    while (colaFotos.length) {
      if (n++ % 8 === 0) M.cargar?.([...new Set(colaFotos.map((x) => { try { return especieFoto(JSON.parse(x.dataset.foto || '{}')); } catch { return ''; } }))]);
      const img = colaFotos.shift();
      if (!img.isConnected || !img.dataset.foto) continue;
      const d = JSON.parse(img.dataset.foto);
      await M.cargar?.(especieFoto(d));
      if (!img.isConnected || !img.dataset.foto) continue;
      // sin trabar: los shaders de cada material nuevo se compilan en paralelo antes de dibujar la foto
      const url = M.fotoSinTrabar ? await M.fotoSinTrabar(d) : d.objeto ? M.fotoObjeto(d.objeto, d.clave, d.tam || 120, d.acabado) : M.foto(d.op, d.tam || 150);
      if (!img.dataset.foto) continue;
      img.src = url;
      img.removeAttribute('data-foto');
      await espera(0);
    }
  } finally { dibujandoFotos = false; }
}
// Cara de un asesor en listas: su foto real si ya te salio su carta; si no, sus iniciales
const caraDe = (m, tam, cls = 'mini-mascota', nombre = '') => (!(m?.foto && m.codigo) && nombre ? avatar(nombre, {}, tam) : m?.foto && m.codigo
  ? `<img class="${cls} foto-real-mini" alt="" width="${tam}" height="${tam}" src="${VACIO_IMG}" data-asesor="${esc(m.codigo)}" data-v="${m.fv || ''}">`
  : imgFoto({ op: m }, tam, cls));
// si la miniatura ya está dibujada (en memoria o guardada en el teléfono) sale directo: la lista no parpadea al cambiarla
const imgFoto = (datos, tam, cls = '') => {
  const ya = window.Monstruos?.fotoLista?.({ ...datos, tam });
  return ya ? `<img class="${cls}" alt="" width="${tam}" height="${tam}" src="${ya}">`
    : `<img class="${cls}" alt="" width="${tam}" height="${tam}" src="${VACIO_IMG}" data-foto='${esc(JSON.stringify({ ...datos, tam }))}'>`;
};

/* ============================================================ CARTA DE JUGADOR (estilo FIFA) */
// tu propia carta tambien se gana: bloqueada hasta el primer dia con las 3 misiones (sale en el siguiente sobre)
const pistaCarta = (cd) => {
  if (cd.propia_lista) return '¡Te la ganaste! Abre un sobre y saldrá tu carta.';
  const p = cd.propia || { dias: 0, meta: 10, repetida_en: 0 };
  return `Gánatela: cumple tus 3 misiones ${p.meta} días del trimestre (llevas ${p.dias}), o cámbiala con un compañero que la tenga repetida${
    p.repetida_en ? ` (hoy ${p.repetida_en === 1 ? '1 la tiene' : `${p.repetida_en} la tienen`})` : ''}.`;
};
/* CARTA ICONO ("ÍCONO DE"): la mas alta del juego, arriba de Diamante. Negro-azul profundo con lamina holografica
   arcoiris y oro que se mueven solas, marco de oro con destellos, corona, marca de agua DE y la foto con halo.
   Bloqueada: el reverso DE de siempre con un "?" de oro y la pista de que sale muy rara. */
const esIcono = (f) => f?.nivel === 'icono';
function cartaIconoHTML(f, d, { chica = false, oculta = false } = {}) {
  const t = d.trimestre;
  if (oculta) return `<div class="carta oculta icono-oculta ${chica ? 'chica' : ''} ed-${t.q}" data-falta="${esc(f.codigo)}">${f.deseo ? '<span class="deseo-badge">♥</span>' : ''}
    <i class="fx-aura ic-aura" aria-hidden="true"></i><div class="carta-in dorso-mn">${DORSO_MN}<span class="ic-incognita" aria-hidden="true"><i class="ic-corona"></i><b>?</b></span>
    <b class="ic-pista">Carta Ícono<small>Sale muy rara en los sobres</small></b><i class="ic-brillo-dorso" aria-hidden="true"></i></div></div>`;
  // la Icono no se mide con los KPI de los asesores: muestra sus propios atributos
  const propios = f.atributos_especiales?.length ? f.atributos_especiales : d.atributos.map((a) => ({ clave: a.clave.toUpperCase(), valor: f.stats?.[a.clave] ?? 99 }));
  const stats = propios.map((a) => `<div class="st"><b class="num">${a.valor}</b><span>${esc(a.clave)}</span></div>`).join('');
  const nombre = f.carta || dosNombres(f.nombre);
  return `<div class="carta icono ${chica ? 'chica' : ''} ed-${t.q}" data-carta="${esc(f.codigo)}">
    <i class="fx-aura ic-aura" aria-hidden="true"></i>
    <div class="carta-in">
      <i class="ic-fondo" aria-hidden="true"></i><i class="ic-marca" aria-hidden="true"></i><i class="ic-halo" aria-hidden="true"></i>
      <div class="carta-media"><b class="num">${f.media}</b><span>DE</span></div>
      <i class="ic-corona" aria-hidden="true"></i>
      <div class="carta-ed">${esc(t.edicion)}<br>${t.clave.slice(-2)} ${t.anio}</div>
      ${f.mascota?.foto ? `<img class="carta-foto foto-real" alt="" src="${VACIO_IMG}" data-asesor="${esc(f.codigo)}" data-v="${f.mascota.fv || ''}"${chica ? '' : ' data-estilo="hd"'}>`
        : `<span class="carta-foto ic-sin-foto" aria-hidden="true"><i class="ic-corona"></i></span>`}
      <span class="ic-badge">★ Ícono ★</span>
      <div class="carta-nombre">${esc(nombre)}</div>
      <div class="ic-puesto">${esc(f.puesto || '')}</div>
      <div class="carta-stats">${stats}</div>
      <div class="carta-pie">Ícono DE · Edición ${esc(t.edicion)}</div>
      ${f.repetidas ? `<span class="rep-badge" title="Repetidas para intercambiar">×${f.repetidas + 1}</span>` : ''}
      <i class="ic-holo" aria-hidden="true"></i><i class="ic-marco" aria-hidden="true"></i>
      <i class="ic-chispas" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></i>
      <i class="fx-brillo" aria-hidden="true"></i><i class="fx-reflejo" aria-hidden="true"></i>
    </div></div>`;
}
function cartaHTML(f, d, { chica = false, oculta = false, bloqueada = false } = {}) {
  if (!f) return '';
  if (esIcono(f)) return cartaIconoHTML(f, d, { chica, oculta });
  const t = d.trimestre;
  // carta que aun no te sale: no se ve nada de ella, solo su lugar en el album
  if (oculta) return `<div class="carta oculta ${chica ? 'chica' : ''} ed-${t.q}" ${bloqueada ? '' : `data-falta="${esc(f.codigo)}"`}>${f.deseo && !bloqueada ? '<span class="deseo-badge">♥</span>' : ''}<div class="carta-in dorso-mn">${DORSO_MN}<span class="silueta">${bloqueada ? ic('candado') : '?'}</span><b>${esc(dosNombres(f.nombre))}</b></div></div>`;
  const stats = d.atributos.map((a) => `<div class="st"><b class="num">${f.stats[a.clave]}</b><span>${a.clave.toUpperCase()}</span></div>`).join('');
  // capas de efecto (cartas-fx.js): lamina del nivel, barrido, reflejo que sigue el angulo y chispas en oro/leyenda
  const fx = `<i class="fx-holo" aria-hidden="true"><i class="fx-lamina"></i></i><i class="fx-brillo" aria-hidden="true"></i><i class="fx-reflejo" aria-hidden="true"></i>${
    f.nivel === 'oro' || f.nivel === 'leyenda' ? '<i class="fx-chispas" aria-hidden="true"><i></i><i></i><i></i></i>' : ''}`;
  return `<div class="carta ${f.nivel} ${chica ? 'chica' : ''} ed-${t.q}" data-carta="${esc(f.codigo)}">
    ${f.nivel === 'leyenda' ? '<i class="fx-aura" aria-hidden="true"></i>' : ''}
    <div class="carta-in">
      <div class="carta-media"><b class="num">${f.media}</b><span>${f.posicion}</span></div>
      <div class="carta-ed">${esc(t.edicion)}<br>${t.clave.slice(-2)} ${t.anio}</div>
      ${f.mascota?.foto ? `<img class="carta-foto foto-real" alt="" src="${VACIO_IMG}" data-asesor="${esc(f.codigo)}" data-v="${f.mascota.fv || ''}">`
        : imgFoto({ op: { ...f.mascota, equipo: f.mascota?.equipo || {} } }, chica ? 110 : 180, 'carta-foto')}
      <div class="carta-nombre">${esc(dosNombres(f.nombre))}</div>
      <div class="carta-stats">${stats}</div>
      <div class="carta-pie">${esc(tiendaNombre(f.tienda))} · ${NIVEL_CARTA[f.nivel]}</div>
      ${f.repetidas ? `<span class="rep-badge" title="Repetidas para intercambiar">×${f.repetidas + 1}</span>` : ''}
      ${fx}
    </div></div>`;
}
function hojaCarta(f, d) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  const icono = esIcono(f);   // la Icono no es asesor: no tiene cuarto ni se mide con el ERP
  velo.innerHTML = `<div class="hoja hoja-carta ${icono ? 'hoja-icono' : ''}"><div class="asa"></div>
    <div class="carta-grande n-${f.nivel}">${cartaHTML(f, d)}</div>
    ${icono ? `<div class="icono-ficha"><b>${esc(f.nombre)}</b><small>${esc(f.puesto || '')}</small>
      ${(f.atributos_especiales || []).length ? `<div class="desglose">${f.atributos_especiales.map((a) => `<div class="fila-st"><div><b>${esc(a.nombre)} <span class="abrev">· en la carta: ${esc(a.clave)}</span></b></div><span class="nota num n-alta">${a.valor}</span></div>`).join('')}</div>` : ''}
      <p>Carta <b>Ícono DE</b>: la más alta del juego, por encima de Diamante. No se mide con los indicadores de los asesores: tiene sus propios atributos. Es rarísima en los sobres y se puede cambiar como las demás.</p></div>`
    : `<div class="desglose">${d.atributos.map((a) => `<div class="fila-st"><div><b>${esc(a.nombre)} <span class="abrev">· en la carta: ${esc(a.clave.toUpperCase())}</span></b><small>${esc(a.descripcion)}</small></div>
      <span class="nota num n-${f.stats[a.clave] >= 70 ? 'alta' : f.stats[a.clave] >= 50 ? 'media' : 'baja'}">${f.stats[a.clave]}</span></div>`).join('')}</div>
    <p class="muted nota-escala">Cada atributo va de 1 a 99: 99 es estar al nivel del top 10% de DE en el trimestre. La media es el promedio de los 4. Edición ${esc(d.trimestre.edicion)} · ${esc(d.trimestre.nombre)}.</p>`}
    <div class="fila-acciones"><button class="b3 gris" data-cerrar>Cerrar</button>
      ${icono ? '' : `<button class="b3 azul" id="b-visitar">${ic('casa')}Ver su cuarto</button>`}
      ${puedeCompartirCarta(f, d) ? `<button class="b3 oro" id="b-compartir-carta">${ic('compartir')}Compartir</button>` : ''}</div></div>`;
  document.body.appendChild(velo);
  fotosPendientes(velo);
  // la carta llega girando (CSS) y al aterrizar le pasa un destello
  Juego.Sonido.swoosh();
  setTimeout(() => window.CartasFX?.destello($('.carta-grande .carta', velo)), 820);
  if (icono) setTimeout(() => { Juego.Sonido.destellos(12, 0); window.CartasFX?.chispas($('.carta-grande .carta', velo), 16, '#ffd65a'); }, 700);
  else if (f.nivel === 'leyenda' || f.nivel === 'oro') Juego.Sonido.destellos(f.nivel === 'leyenda' ? 8 : 4, 0.7);
  velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-cerrar]')) velo.remove(); });
  const bv = $('#b-visitar', velo); if (bv) bv.onclick = () => { velo.remove(); S.visitando = f.codigo; irA('cuarto'); };
  const bc = $('#b-compartir-carta', velo); if (bc) bc.onclick = () => hojaCompartirCarta(f, d);
}

/* ============================================================ COMPARTIR UNA CARTA ("mira la carta que me saqué")
   La imagen se dibuja aquí, en el teléfono de quien TIENE la carta (él sí puede ver la foto real). Se sube y sale un
   enlace público /c/<token> que solo muestra esa imagen: ni ventas, ni códigos, ni nada que no se lea en la carta. */
const puedeCompartirCarta = (f, d) => !!(f && d?.trimestre?.clave && f.tengo !== false && esAsesor() && window.HTMLCanvasElement);
const ACENTO_ED = { 1: '#5cc8ff', 2: '#7cd36a', 3: '#ff6a3d', 4: '#6892f3' };
const COLOR_CARTA = { bronce: ['#e8c39e', '#b98256', '#3b2414'], plata: ['#eef1f6', '#aab3c2', '#2b3240'], oro: ['#fff0b3', '#e0a82e', '#4a3100'],
  leyenda: ['#ffffff', '#6fa5df', '#13294b'], icono: ['#0b1838', '#050b1f', '#ffffff'] };
const BRILLO_NIVEL = { bronce: '#e9a36a', plata: '#dfe7f5', oro: '#ffc21a', leyenda: '#8fd8ff', icono: '#ffd65a' };
const cargaImagen = (src) => new Promise((ok) => { if (!src) { ok(null); return; } const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
// la silueta de la carta (arriba redondeada, abajo en arco como en styles.css: 22px / 46% 14%)
function formaCartaLienzo(x, X, Y, W, H) {
  const r = W * 0.105, rx = W * 0.46, ry = H * 0.14;
  x.beginPath(); x.moveTo(X + r, Y); x.lineTo(X + W - r, Y); x.quadraticCurveTo(X + W, Y, X + W, Y + r); x.lineTo(X + W, Y + H - ry);
  x.ellipse(X + W - rx, Y + H - ry, rx, ry, 0, 0, Math.PI / 2); x.lineTo(X + rx, Y + H);
  x.ellipse(X + rx, Y + H - ry, rx, ry, 0, Math.PI / 2, Math.PI); x.lineTo(X, Y + r); x.quadraticCurveTo(X, Y, X + r, Y); x.closePath();
}
// texto que se encoge hasta caber en `ancho`
function textoAjustado(x, txt, cx, y, ancho, tam, peso = 900) {
  let t = tam; x.font = `${peso} ${t}px Nunito, system-ui, sans-serif`;
  while (t > 8 && x.measureText(txt).width > ancho) { t -= 1; x.font = `${peso} ${t}px Nunito, system-ui, sans-serif`; }
  x.fillText(txt, cx, y); return x.measureText(txt).width;
}
// rayos de luz que salen de (cx, cy): el fondo de los sobres y de las imágenes para presumir
function rayosLienzo(x, cx, cy, largo, n, color, alfa) {
  x.save(); x.translate(cx, cy); x.globalAlpha = alfa; x.fillStyle = color;
  for (let k = 0; k < n; k++) { x.rotate((Math.PI * 2) / n); x.beginPath(); x.moveTo(0, 0); x.lineTo(-largo * 0.07, -largo); x.lineTo(largo * 0.07, -largo); x.closePath(); x.fill(); }
  x.restore();
}
function fondoMNLienzo(x, w, h, cx, cy, brillo) {
  const g = x.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * 0.75);
  g.addColorStop(0, '#1d4fb8'); g.addColorStop(0.35, '#0d2f80'); g.addColorStop(0.7, '#06205c'); g.addColorStop(1, '#031540');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  rayosLienzo(x, cx, cy, Math.max(w, h) * 1.1, 18, '#ffffff', 0.05);
  if (brillo) {
    const b = x.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.55);
    b.addColorStop(0, brillo + '88'); b.addColorStop(0.5, brillo + '22'); b.addColorStop(1, brillo + '00');
    x.fillStyle = b; x.fillRect(0, 0, w, h);
  }
}
// la carta completa dibujada en el lienzo (misma cara que cartaHTML): foto = la imagen ya cargada (real o mascota)
function cartaEnLienzo(x, f, d, foto, X, Y, W) {
  const H = W * 1.4, u = W / 210, nv = COLOR_CARTA[f.nivel] ? f.nivel : 'bronce', [c1, c2, tx] = COLOR_CARTA[nv];
  const icono = nv === 'icono', acento = icono ? '#ffd65a' : ACENTO_ED[d.trimestre.q] || '#ff8a3d', real = !!f.mascota?.foto;
  const fuente = (t, p = 900) => `${p} ${t * u}px Nunito, system-ui, sans-serif`;
  x.save();
  formaCartaLienzo(x, X, Y, W, H); x.save(); x.clip();
  // fondos como en styles.css: Diamante azul hielo, Oro con rayos, Plata cepillada
  const g = x.createLinearGradient(X + W * 0.33, Y, X + W * 0.67, Y + H);
  if (nv === 'leyenda') [[0, '#ffffff'], [0.28, '#e9f5ff'], [0.62, '#b3d4f5'], [1, '#6fa5df']].forEach(([k, c]) => g.addColorStop(k, c));
  else if (nv === 'oro') { g.addColorStop(0, c1); g.addColorStop(0.72, c2); g.addColorStop(1, '#c48a14'); }
  else { g.addColorStop(0, c1); g.addColorStop(1, c2); }
  x.fillStyle = g; x.fillRect(X, Y, W, H);
  if (nv === 'oro') rayosLienzo(x, X + W / 2, Y + H * 0.3, H, 24, '#ffffff', 0.13);
  if (nv === 'plata') for (let yy = Y; yy < Y + H; yy += 4 * u) { x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(X, yy, W, u); x.fillStyle = 'rgba(80,95,120,.045)'; x.fillRect(X, yy + u, W, u); }
  if (icono) {
    const h = x.createRadialGradient(X + W / 2, Y + H * 0.4, 0, X + W / 2, Y + H * 0.4, W * 0.7);
    h.addColorStop(0, 'rgba(255,214,90,.42)'); h.addColorStop(0.45, 'rgba(255,170,40,.12)'); h.addColorStop(1, 'rgba(255,214,90,0)');
    x.fillStyle = h; x.fillRect(X, Y, W, H);
    rayosLienzo(x, X + W / 2, Y + H * 0.4, W * 1.1, 16, '#ffd65a', 0.09);
  } else {
    const h = x.createRadialGradient(X + W / 2, Y + H * 0.25, 0, X + W / 2, Y + H * 0.25, W * 0.7);
    h.addColorStop(0, 'rgba(255,255,255,.55)'); h.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = h; x.fillRect(X, Y, W, H);
  }
  // la foto: real (recorte sin fondo que se desvanece abajo) o la mascota
  const medallon = real && nv === 'leyenda';   // Diamante: la foto va en un medallón redondo con doble aro azul
  if (foto && medallon) {
    const r = 67 * u, cx = X + W / 2, cy = Y + 36 * u + r;
    x.save(); x.shadowColor = 'rgba(40,90,160,.35)'; x.shadowBlur = 10 * u; x.shadowOffsetY = 3 * u;
    x.fillStyle = '#6aa2e0'; x.beginPath(); x.arc(cx, cy, r + 7 * u, 0, Math.PI * 2); x.fill(); x.restore();
    x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(cx, cy, r + 5 * u, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#7fb2e8'; x.beginPath(); x.arc(cx, cy, r + 3 * u, 0, Math.PI * 2); x.fill();
    const fondo = x.createRadialGradient(cx - r * 0.32, cy - r * 0.44, 0, cx, cy, r);
    [[0, '#ffffff'], [0.4, '#e8f3ff'], [0.78, '#c2dcf6'], [1, '#9cc2ea']].forEach(([k, c]) => fondo.addColorStop(k, c));
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip(); x.fillStyle = fondo; x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    const lado = Math.min(foto.naturalWidth, foto.naturalHeight), sx = (foto.naturalWidth - lado) / 2, sy = (foto.naturalHeight - lado) * 0.18;
    x.drawImage(foto, sx, sy, lado, lado, cx - r, cy - r, 2 * r, 2 * r); x.restore();
  } else if (foto && !(icono && !real)) {
    const fw = (icono ? 132 : 146) * u, fh = real ? fw * 1.18 : fw, fx = X + (W - fw) / 2, fy = Y + (icono ? 48 : 34) * u;
    const o = document.createElement('canvas'); o.width = Math.round(fw); o.height = Math.round(fh); const ox = o.getContext('2d');
    const ar = foto.naturalWidth / foto.naturalHeight, ad = fw / fh;
    let sw = foto.naturalWidth, sh = foto.naturalHeight; if (ar > ad) sw = sh * ad; else sh = sw / ad;   // recorte desde arriba (object-position: top)
    ox.drawImage(foto, (foto.naturalWidth - sw) / 2, 0, sw, sh, 0, 0, o.width, o.height);
    if (real) { ox.globalCompositeOperation = 'destination-in'; const m = ox.createLinearGradient(0, 0, 0, o.height); m.addColorStop(0.56, "#000"); m.addColorStop(0.9, "rgba(0,0,0,0)"); ox.fillStyle = m; ox.fillRect(0, 0, o.width, o.height); }
    x.save(); x.shadowColor = 'rgba(40,20,10,.28)'; x.shadowBlur = 8 * u; x.shadowOffsetY = 4 * u; x.drawImage(o, fx, fy, fw, fh); x.restore();
  }
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  const sombraTxt = () => { x.shadowColor = nv === 'leyenda' ? 'rgba(255,255,255,.9)' : icono ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.55)'; x.shadowBlur = (nv === 'leyenda' ? 5 : 3) * u; x.shadowOffsetY = 1 * u; };
  const t = d.trimestre;
  // media y posicion
  const mx = icono ? X + 40 * u : X + W - 40 * u;
  x.save(); sombraTxt(); x.fillStyle = icono ? '#ffe27a' : tx; x.font = fuente(icono ? 40 : 46); x.fillText(String(f.media), mx, Y + (icono ? 58 : 64) * u); x.restore();
  const pos = icono ? 'DE' : String(f.posicion || ''); x.font = fuente(icono ? 11 : 13);
  const pw = x.measureText(pos).width + 12 * u;
  if (nv === 'leyenda') { const pg = x.createLinearGradient(mx - pw / 2, 0, mx + pw / 2, 0); pg.addColorStop(0, '#5aa9ff'); pg.addColorStop(1, '#2f6fd6'); x.fillStyle = pg; } else x.fillStyle = acento;
  x.beginPath(); x.roundRect ? x.roundRect(mx - pw / 2, Y + (icono ? 64 : 70) * u, pw, 18 * u, 6 * u) : x.rect(mx - pw / 2, Y + (icono ? 64 : 70) * u, pw, 18 * u); x.fill();
  x.fillStyle = icono ? '#2a1700' : '#fff'; x.fillText(pos, mx, Y + (icono ? 78 : 84) * u);
  // edicion
  x.save(); x.globalAlpha = 0.85; x.fillStyle = icono ? '#ffe9a8' : tx; x.font = fuente(10); x.textAlign = icono ? 'right' : 'left';
  const ex = icono ? X + W - 20 * u : X + 22 * u;
  x.fillText(String(t.edicion || '').toUpperCase(), ex, Y + 42 * u); x.fillText(`${String(t.clave || '').slice(-2)} ${t.anio || ''}`, ex, Y + 55 * u); x.restore();
  if (icono) {   // corona de oro arriba al centro (y en el medallón si la Ícono no tiene foto)
    const corona = (cx, cy, s) => {
      const g = x.createLinearGradient(0, cy - s * 0.6, 0, cy + s * 0.7); g.addColorStop(0, '#fff1b8'); g.addColorStop(0.5, '#ffd65a'); g.addColorStop(1, '#b8820f');
      x.save(); x.fillStyle = g; x.shadowColor = 'rgba(255,214,90,.8)'; x.shadowBlur = 8 * u;
      x.beginPath(); x.moveTo(cx - s, cy + s * 0.7); x.lineTo(cx - s, cy - s * 0.3); x.lineTo(cx - s * 0.5, cy + s * 0.15); x.lineTo(cx, cy - s * 0.6);
      x.lineTo(cx + s * 0.5, cy + s * 0.15); x.lineTo(cx + s, cy - s * 0.3); x.lineTo(cx + s, cy + s * 0.7); x.closePath(); x.fill(); x.restore();
    };
    corona(X + W / 2, Y + 26 * u, 24 * u);
    if (!real) {
      const cx = X + W / 2, cy = Y + 112 * u, r = 48 * u, m = x.createRadialGradient(cx, cy - r * 0.3, 0, cx, cy, r);
      m.addColorStop(0, '#1f3f8f'); m.addColorStop(1, '#071233');
      x.save(); x.shadowColor = 'rgba(255,214,90,.6)'; x.shadowBlur = 16 * u; x.fillStyle = m; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); x.restore();
      x.strokeStyle = '#ffd65a'; x.lineWidth = 2.5 * u; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
      corona(cx, cy + 4 * u, 26 * u);
    }
  }
  const nombre = (f.carta || dosNombres(f.nombre)).toUpperCase();
  if (icono) {
    const by = Y + 200 * u; x.font = fuente(9); const bw = x.measureText('★ ÍCONO ★').width + 22 * u;
    const g = x.createLinearGradient(X + W / 2 - bw / 2, 0, X + W / 2 + bw / 2, 0); g.addColorStop(0, '#a9740f'); g.addColorStop(0.5, '#fff1b8'); g.addColorStop(1, '#a9740f');
    x.fillStyle = g; x.beginPath(); x.roundRect ? x.roundRect(X + W / 2 - bw / 2, by - 13 * u, bw, 18 * u, 9 * u) : x.rect(X + W / 2 - bw / 2, by - 13 * u, bw, 18 * u); x.fill();
    x.fillStyle = '#2a1700'; x.fillText('★ ÍCONO ★', X + W / 2, by);
    const oroTxt = x.createLinearGradient(0, Y + 210 * u, 0, Y + 228 * u); oroTxt.addColorStop(0, '#fff6cf'); oroTxt.addColorStop(1, '#ffc93a');
    x.save(); x.fillStyle = oroTxt; x.shadowColor = 'rgba(0,0,0,.65)'; x.shadowBlur = 4 * u; x.shadowOffsetY = 1.5 * u; textoAjustado(x, nombre, X + W / 2, Y + 227 * u, W * 0.88, 21 * u); x.restore();
    const puesto = String(f.puesto || '').toUpperCase(); x.fillStyle = '#ffeec0'; x.font = fuente(7.5, 900);
    if ('letterSpacing' in x) x.letterSpacing = `${1.2 * u}px`;
    const pw2 = x.measureText(puesto).width; x.fillText(puesto, X + W / 2, Y + 240 * u); if ('letterSpacing' in x) x.letterSpacing = '0px';
    if (puesto) for (const lado of [-1, 1]) {
      const x1 = X + W / 2 + lado * (pw2 / 2 + 5 * u), lg = x.createLinearGradient(x1, 0, x1 + lado * 16 * u, 0); lg.addColorStop(0, '#ffd65a'); lg.addColorStop(1, 'rgba(255,214,90,0)');
      x.fillStyle = lg; x.fillRect(Math.min(x1, x1 + lado * 16 * u), Y + 237 * u, 16 * u, 1 * u);
    }
    x.fillStyle = 'rgba(255,233,168,.8)'; x.font = fuente(6.5, 900); x.fillText(`ÍCONO DE · EDICIÓN ${String(t.edicion || '').toUpperCase()}`, X + W / 2, Y + 281 * u);
    const st = f.atributos_especiales?.length ? f.atributos_especiales : d.atributos.map((a) => ({ clave: a.clave.toUpperCase(), valor: f.stats?.[a.clave] ?? 99 }));
    const ancho = W * 0.78, col = ancho / st.length, x0 = X + (W - ancho) / 2;
    st.forEach((a, i) => {
      const cx = x0 + col * (i + 0.5);
      if (i) { x.fillStyle = 'rgba(255,214,90,.25)'; x.fillRect(x0 + col * i, Y + 247 * u, 0.8 * u, 25 * u); }
      x.fillStyle = '#ffe27a'; x.font = fuente(15); x.fillText(String(a.valor), cx, Y + 262 * u);
      x.fillStyle = '#ffeec0'; x.font = fuente(6.5); x.fillText(String(a.clave), cx, Y + 271 * u);
    });
  } else {
    x.save(); sombraTxt(); x.fillStyle = tx;
    const dy = medallon ? -6 * u : 0;
    const nw = textoAjustado(x, nombre, X + W / 2, Y + 206 * u + dy, W * 0.86, 18 * u); x.restore();
    x.fillStyle = nv === 'leyenda' ? '#5aa9ff' : acento; x.fillRect(X + W / 2 - nw / 2, Y + 212 * u + dy, nw, 2 * u);
    x.save(); sombraTxt(); x.fillStyle = tx;
    d.atributos.forEach((a, i) => {
      const cx = X + W / 2 + (i % 2 ? 26 : -50) * u, cy = Y + (238 + Math.floor(i / 2) * 22) * u + dy;
      x.textAlign = 'right'; x.font = fuente(19); x.fillText(String(f.stats?.[a.clave] ?? ''), cx + 8 * u, cy);
      x.textAlign = 'left'; x.globalAlpha = 0.85; x.font = fuente(12, 800); x.fillText(a.clave.toUpperCase(), cx + 13 * u, cy); x.globalAlpha = 1;
    });
    x.restore();
    x.textAlign = 'center'; x.globalAlpha = nv === 'leyenda' ? 0.85 : 0.75; x.fillStyle = nv === 'leyenda' ? '#1d3d6e' : tx; x.font = fuente(9, 800);
    textoAjustado(x, `${tiendaNombre(f.tienda)} · ${NIVEL_CARTA[nv]}`.toUpperCase().replace(/^ · /, ''), X + W / 2, Y + 279 * u, W * 0.66, 9 * u, 800);
    x.globalAlpha = 1;
  }
  x.restore();   // fin del recorte
  // marco: blanco (oro en la Icono) con su línea interior
  if (icono) {
    const g = x.createLinearGradient(X, Y, X + W, Y + H); g.addColorStop(0, '#fff1b8'); g.addColorStop(0.3, '#d9a422'); g.addColorStop(0.6, '#fff6cf'); g.addColorStop(1, '#a9740f');
    x.strokeStyle = g; x.lineWidth = 5 * u; formaCartaLienzo(x, X + 2.5 * u, Y + 2.5 * u, W - 5 * u, H - 5 * u); x.stroke();
    x.strokeStyle = 'rgba(255,214,90,.55)'; x.lineWidth = 1.2 * u; formaCartaLienzo(x, X + 8 * u, Y + 8 * u, W - 16 * u, H - 16 * u); x.stroke();
  } else {
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 3 * u; formaCartaLienzo(x, X + 1.5 * u, Y + 1.5 * u, W - 3 * u, H - 3 * u); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 1.5 * u; formaCartaLienzo(x, X + 7 * u, Y + 7 * u, W - 14 * u, H - 14 * u); x.stroke();
  }
  x.restore();
}
// la foto que va en la carta: la real (si la tienes) o tu mascota
async function fotoParaCarta(f) {
  if (f.mascota?.foto) {
    const url = await fotoAsesor(f.codigo, f.mascota.fv || '', esIcono(f) ? 'hd' : '');
    const img = await cargaImagen(url);
    if (img) return img;
  }
  try {
    const M = await cuandoMonstruos(); if (!M.disponible) return null;
    await M.cargar?.(f.mascota?.especie);
    return await cargaImagen(M.foto({ ...f.mascota, equipo: f.mascota?.equipo || {} }, 420));
  } catch { return null; }
}
// lienzo -> JPEG que no pase de ~860 KB (el servidor no acepta más de 900 KB)
function jpegLigero(c) {
  for (const q of [0.88, 0.8, 0.7, 0.6]) { const u = c.toDataURL('image/jpeg', q); if (u.length * 0.75 < 860000) return u; }
  return c.toDataURL('image/jpeg', 0.5);
}
// el logo del juego sin su lema de abajo (va en azul marino y sobre el fondo DE no se leería)
function logoEnLienzo(x, logo, cx, y, w) { if (!logo) return 0; const sh = logo.height * 0.885, h = w * sh / logo.width; x.drawImage(logo, 0, 0, logo.width, sh, cx - w / 2, y, w, h); return h; }
function pildoraLienzo(x, txt, cx, y, tam, fondo, color) {
  x.font = `900 ${tam}px Nunito, system-ui, sans-serif`; const w = x.measureText(txt).width + tam * 1.4, h = tam * 1.7;
  x.fillStyle = fondo; x.beginPath(); x.roundRect ? x.roundRect(cx - w / 2, y - h / 2, w, h, h / 2) : x.rect(cx - w / 2, y - h / 2, w, h); x.fill();
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, cx, y + tam * 0.04); x.textBaseline = 'alphabetic';
}
// las dos imágenes: la vertical (1080x1350) para mandar por WhatsApp/estado y la horizontal (1200x630) de la vista previa
async function imagenesCarta(f, d) {
  try { await document.fonts?.load?.('900 40px Nunito'); } catch { /* sin la fuente: la del sistema */ }
  const [foto, logo] = await Promise.all([fotoParaCarta(f), cargaImagen('./img/web-dev-eyes.svg')]);
  const nv = COLOR_CARTA[f.nivel] ? f.nivel : 'bronce', nombre = f.carta ? f.carta.split(/\s+/).map((p) => p[0] + p.slice(1).toLowerCase()).join(' ') : dosNombres(f.nombre).toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  const nivel = NIVEL_CARTA[nv], brillo = BRILLO_NIVEL[nv], propia = f.codigo === S.sesion?.codigo;
  const colorNivel = { bronce: ['#c98a55', '#fff'], plata: ['#e6ebf3', '#06205c'], oro: ['#ffc21a', '#3d2700'], leyenda: ['#8fd8ff', '#06205c'], icono: ['#ffd65a', '#2a1700'] }[nv];
  const sombraCarta = (x, s) => { x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 50 * s; x.shadowOffsetY = 22 * s; };
  // vertical
  const v = document.createElement('canvas'); v.width = 1080; v.height = 1350; const a = v.getContext('2d');
  fondoMNLienzo(a, 1080, 1350, 540, 610, brillo);
  logoEnLienzo(a, logo, 540, 30, 230);
  a.save(); sombraCarta(a, 1); formaCartaLienzo(a, 260, 236, 560, 784); a.fillStyle = '#06205c'; a.fill(); a.restore();
  cartaEnLienzo(a, f, d, foto, 260, 236, 560);
  a.textAlign = 'center'; a.fillStyle = '#ffc21a'; a.font = '900 34px Nunito, system-ui, sans-serif';
  a.fillText(propia ? '¡ME SALIÓ MI PROPIA CARTA!' : '¡MIRA LA CARTA QUE ME SAQUÉ!', 540, 1094);
  a.save(); a.fillStyle = '#fff'; a.shadowColor = 'rgba(0,0,0,.35)'; a.shadowOffsetY = 4; textoAjustado(a, `¡Me salió ${nombre}!`, 540, 1170, 960, 64); a.restore();
  pildoraLienzo(a, `${nivel.toUpperCase()} · MEDIA ${f.media}`, 540, 1240, 30, colorNivel[0], colorNivel[1]);
  a.fillStyle = 'rgba(255,255,255,.6)'; a.font = '800 24px Nunito, system-ui, sans-serif'; a.fillText(`Distrito · Edición ${d.trimestre.edicion || ''}`, 540, 1318);
  a.fillStyle = '#e1211c'; a.fillRect(0, 1342, 1080, 8);
  // horizontal (vista previa del enlace)
  const h = document.createElement('canvas'); h.width = 1200; h.height = 630; const b = h.getContext('2d');
  fondoMNLienzo(b, 1200, 630, 330, 315, brillo);
  b.save(); sombraCarta(b, 0.7); formaCartaLienzo(b, 160, 40, 390, 546); b.fillStyle = '#06205c'; b.fill(); b.restore();
  cartaEnLienzo(b, f, d, foto, 160, 40, 390);
  logoEnLienzo(b, logo, 860, 46, 250);
  b.textAlign = 'center'; b.fillStyle = '#ffc21a'; b.font = '900 28px Nunito, system-ui, sans-serif';
  b.fillText(propia ? '¡ME SALIÓ MI PROPIA CARTA!' : `¡${String(dosNombres(S.sesion?.nombre || '').split(' ')[0] || 'Mira').toUpperCase()} SACÓ ESTA CARTA!`, 860, 318);
  b.save(); b.fillStyle = '#fff'; b.shadowColor = 'rgba(0,0,0,.35)'; b.shadowOffsetY = 4; textoAjustado(b, nombre, 860, 396, 560, 66); b.restore();
  pildoraLienzo(b, `${nivel.toUpperCase()} · MEDIA ${f.media}`, 860, 464, 28, colorNivel[0], colorNivel[1]);
  b.fillStyle = 'rgba(255,255,255,.6)'; b.font = '800 22px Nunito, system-ui, sans-serif'; b.fillText('El juego de los asesores DE', 860, 548);
  b.fillStyle = '#e1211c'; b.fillRect(0, 622, 1200, 8);
  return { imagen: jpegLigero(v), og: jpegLigero(h), nombre, nivel };
}
const enlacesCarta = new Map();   // enlace ya creado por carta en esta sesión (no se vuelve a subir al reabrir)
async function hojaCompartirCarta(f, d) {
  const velo = document.createElement('div');
  velo.className = 'velo velo-compartir';
  velo.innerHTML = `<div class="hoja hoja-compartir"><div class="asa"></div>
    <div class="hoja-cab"><h2>Presume tu carta</h2><button class="hud-btn" data-cerrar aria-label="Cerrar">${ic('cerrar')}</button></div>
    <div class="cc-vista" id="cc-vista"><div class="cc-cargando"><i class="cc-giro" aria-hidden="true"></i>Preparando tu imagen…</div></div>
    <p class="muted cc-nota">Quien abra el enlace verá solo esta imagen. Nada de tus ventas, tus puntos ni tus datos.</p>
    <div class="fila-acciones cc-acciones">
      <button class="b3 oro" id="cc-compartir" disabled>${ic('compartir')}Compartir</button>
      <button class="b3 verde" id="cc-wa" disabled>WhatsApp</button>
      <button class="b3 gris" id="cc-copiar" disabled>Copiar enlace</button>
    </div><a class="b-texto cc-guardar" id="cc-guardar" hidden>Guardar la imagen</a></div>`;
  document.body.appendChild(velo);
  velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-cerrar]')) velo.remove(); });
  const llave = d.trimestre.clave + '|' + f.codigo;
  let img, url = '', archivo = null;
  try { img = await imagenesCarta(f, d); } catch { img = null; }
  if (!velo.isConnected) return;
  if (!img) { $('#cc-vista', velo).innerHTML = `<div class="cc-cargando">No se pudo preparar la imagen en este teléfono.</div>`; return; }
  $('#cc-vista', velo).innerHTML = `<img alt="Tu carta lista para compartir" src="${img.imagen}">`;
  const bg = $('#cc-guardar', velo); bg.href = img.imagen; bg.download = `carta-${img.nombre.replace(/\W+/g, '-').toLowerCase()}.jpg`; bg.hidden = false;
  try { const blob = await (await fetch(img.imagen)).blob(); archivo = new File([blob], `carta-${img.nombre.replace(/\W+/g, '-').toLowerCase()}.jpg`, { type: 'image/jpeg' }); } catch { archivo = null; }
  const conArchivo = !!(archivo && navigator.canShare?.({ files: [archivo] }));
  const titulo = `¡Mira la carta que me saqué! ${img.nombre} · ${img.nivel}`;
  const pintarBotones = () => {
    $('#cc-compartir', velo).disabled = !(conArchivo || (navigator.share && url));
    $('#cc-wa', velo).disabled = !url; $('#cc-copiar', velo).disabled = !url;
    if (!conArchivo && !navigator.share) $('#cc-compartir', velo).hidden = true;
  };
  pintarBotones();
  try {
    url = enlacesCarta.get(llave)?.img === img.imagen.length ? enlacesCarta.get(llave).url : '';
    if (!url) {
      const r = await api('/api/compartir/carta', { method: 'POST', body: JSON.stringify({ carta: f.codigo, trimestre: d.trimestre.clave, imagen: img.imagen, og: img.og }) });
      url = location.origin + r.enlace; enlacesCarta.set(llave, { url, img: img.imagen.length });
    }
  } catch (e) { toast(conArchivo ? 'Sin enlace por ahora, pero puedes mandar la imagen' : `No se pudo crear el enlace: ${e.message}`, !conArchivo); }
  if (!velo.isConnected) return;
  pintarBotones();
  if (url) $('.cc-nota', velo).insertAdjacentHTML('afterend', `<div class="enlace-presumir cc-enlace"><input readonly value="${esc(url)}" aria-label="Enlace de tu carta"></div>`);
  $('#cc-compartir', velo).onclick = async () => {
    Juego.Sonido.swoosh?.();
    try {
      if (conArchivo) await navigator.share({ files: [archivo], title: titulo, text: url ? `${titulo} ${url}` : titulo });
      else await navigator.share({ title: titulo, text: titulo, url });
    } catch { /* cancelado */ }
  };
  $('#cc-wa', velo).onclick = () => { Juego.Sonido.swoosh?.(); window.open('https://wa.me/?text=' + encodeURIComponent(`${titulo} ${url}`), '_blank', 'noopener'); };
  $('#cc-copiar', velo).onclick = async () => {
    try { await navigator.clipboard.writeText(url); Juego.Sonido.listo?.(); toast('Enlace copiado'); }
    catch { const i = $('.cc-enlace input', velo); i?.select(); toast('Mantén presionado para copiar'); }
  };
}

/* ============================================================ INICIO: tu cuarto 3D */
let ctlInicio = null;
// El cuarto 3D de Inicio se CONSERVA cuando solo se refrescan los datos (cerrar "Lo que ganaste", reportar una visita,
// bono diario, cola sin conexión...). Antes cada refresco borraba la pantalla, ponía el esqueleto gris y volvía a cargar
// el cuarto y la mascota: se sentía como "se recarga a cada rato" (8-oct-2026).
let firmaCuarto = '';
let accionesCuarto = {};   // tocar/limpiar de la vista vigente (el cuarto conservado llama siempre a las más nuevas)
async function vistaBase() {
  const v = $('#vista');
  const heroPrevio = ctlInicio && ($('.inicio .cuarto-hero', v) || $('#cuarto-guardado .cuarto-hero'));
  if (!heroPrevio) v.innerHTML = `<div class="vista"><div class="sk" style="height:330px;border-radius:24px"></div>${esqueleto(2)}</div>`;
  let b;
  // datos de hace menos de 30 s (recién entraste o se acaban de refrescar): se pinta al instante, sin esperar al servidor
  const reciente = S.base && S.baseHora && Date.now() - S.baseHora < 30000;
  try { b = reciente ? S.base : await cargarBase(); } catch (e) { if (!heroPrevio) v.innerHTML = `<div class="vista">${vacio('No se pudo cargar', e.message, 'aviso')}</div>`; return; }
  const p = b.perfil, ms = b.mascota, cd = b.carta;
  const op = mascotaOp(p, ms, b.gremio.clave);
  const firma = JSON.stringify([op, p.cuarto, p.posiciones || {}]);
  const conservar = heroPrevio && heroPrevio.isConnected && firma === firmaCuarto ? heroPrevio : null;
  if (heroPrevio && !conservar && heroPrevio.closest('#cuarto-guardado')) heroPrevio.remove();   // cambio el cuarto: el guardado ya no sirve
  const j = b.jugadas[S.jugadaIdx % Math.max(1, b.jugadas.length)];
  const d = b.diario;
  // siguiente lugar que se abre con el crecimiento de la mascota
  const LUGAR_NV = { cabeza: 1, torso: 1, tapete: 1, planta: 1, cama: 2, cuello: 3, lampara: 4, cara: 5, cuadro: 6, sillon: 8, espalda: 9, tech: 11, deco: 14 };
  const NOMBRE_LUGAR = { cama: 'la cama', cuello: 'ropa de cuello', lampara: 'lámpara', cara: 'lentes', cuadro: 'cuadros', sillon: 'sillón', espalda: 'alas y mochilas', tech: 'tecnología', deco: 'decoración' };
  const prox = Object.entries(LUGAR_NV).filter(([, n]) => n > ms.nivel).sort((x, y) => x[1] - y[1])[0];

  v.innerHTML = `<div class="vista inicio">
    ${avisoDatos()}
    <section class="cuarto-hero">
      <div class="cuarto-3d" id="cuarto-3d"></div>
      <div class="cuarto-top">
        <button class="chip-nombre" id="b-mascota">${esc(nombreMascota(b))} <b>Nv ${ms.nivel}</b></button>
        <span class="cuarto-top-der"><button class="chip-likes boton chip-presumir" id="b-presumir" aria-label="Presumir mi mascota">${ic('compartir')}</button>
          <span class="chip-likes">${ic('corazon')}${nf.format(b.likes || 0)}</span></span>
      </div>
      <div class="globo-animo oculto" id="globo-animo"></div>
      <button class="lupa" id="b-lupa" aria-label="Acercarme a mi mascota">${ic('buscar')}</button>
      <div class="cuarto-acciones" id="acc-normal">
        <button class="accion" id="b-comer" aria-label="Alimentar">${ic('comida')}<span>Comer</span></button>
        <button class="accion" id="b-jugar" aria-label="Jugar">${ic('play')}<span>Jugar</span></button>
        <button class="accion ${ms.suciedad >= 60 ? 'urge' : ''}" id="b-banar" aria-label="Bañar">${ic('banio')}<span>Bañar</span></button>
        <button class="accion destacada" id="b-decorar" aria-label="Decorar">${ic('pincel')}<span>Decorar</span></button>
      </div>
      <div class="barra-decorar" id="acc-decorar" hidden>
        <span class="pista" id="pista-decorar">Toca un mueble y arrástralo</span>
        <div class="botones">
          <button class="accion" id="b-girar" disabled aria-label="Girar">${ic('refrescar')}<span>Girar</span></button>
          <button class="accion" id="b-cambiar" disabled aria-label="Cambiar">${ic('bolsa')}<span>Cambiar</span></button>
          <button class="accion destacada" id="b-listo" aria-label="Listo">${ic('check')}<span>Listo</span></button>
        </div>
      </div>
      <div class="bandeja" id="bandeja" hidden></div>
      <span class="pista-gesto" id="pista-gesto">Arrastra para girar · pellizca para acercar · dos dedos para moverte</span>
    </section>

    <div class="crecer">
      <div class="crecer-txt crecer-racha"><b>${esc(ms.etapa_nombre)} · ${ms.dias_mascota} ${ms.dias_mascota === 1 ? 'día' : 'días'} de racha juntos</b>
        <span>${ms.siguiente_etapa_dias ? `${ms.faltan_dias} ${ms.faltan_dias === 1 ? 'día' : 'días'} de racha más para crecer` : '¡Ya es legendaria!'}</span></div>
      <div class="barra-fina racha"><i style="width:${ms.siguiente_etapa_dias ? Math.round(100 * ms.dias_mascota / ms.siguiente_etapa_dias) : 100}%"></i></div>
      <div class="crecer-txt"><b>Nivel ${ms.nivel}</b><span>${nf.format(ms.hasta - ms.puntos)} puntos para el ${ms.nivel + 1}${prox ? ` · en el ${prox[1]} abres ${NOMBRE_LUGAR[prox[0]] || prox[0]}` : ''}</span></div>
      <div class="barra-fina"><i style="width:${Math.round(ms.avance * 100)}%"></i></div>
      <div class="medidores-mini"><span>${ic('comida')}<i style="--v:${ms.llenura}%"></i></span><span>${ic('corazon')}<i style="--v:${ms.felicidad}%"></i></span><span class="limpieza" title="Limpieza">${ic('banio')}<i style="--v:${100 - (ms.suciedad || 0)}%"></i></span></div>
    </div>

    ${b.racha.en_riesgo && esAsesor() ? `<div class="aviso fuego">${ic('fuego')}<span><b>Racha de ${b.racha.dias} días.</b> Cumple tus 3 misiones hoy para mantenerla y que tu mascota crezca.</span></div>` : ''}
    ${tarjetaMisiones(b)}

    ${cd?.carta ? `<div class="seccion"><div class="seccion-cab">${ic('cartas')}<h2>Tu carta</h2><span class="der">${esc(cd.trimestre.nombre)}</span></div>
      <div class="mi-carta-fila">
        <div id="mi-carta" class="carta-viva">${cartaHTML(cd.carta, cd, { chica: true, oculta: !cd.carta.tengo, bloqueada: true })}</div>
        <div class="mi-carta-info">
          ${cd.carta.tengo ? `<b class="num">#${cd.carta.rank}</b><small>de ${cd.total} en DE</small>` : `<b class="carta-bloq-tit">Carta bloqueada</b><small>${pistaCarta(cd)}</small>`}
          <div class="album-mini"><b>${cd.tengo}/${cd.total}</b> cartas en tu álbum</div>
          <button class="b3 ${cd.sobres.disponibles ? 'oro' : 'blanco'} chico" id="b-album">${ic('sobre')}${cd.sobres.disponibles ? `Abrir sobre (${cd.sobres.disponibles})` : cd.ofertas ? `Intercambios (${cd.ofertas})` : 'Ver álbum'}</button>
        </div>
      </div></div>` : ''}

    <div class="seccion"><div class="seccion-cab">${ic('rayo')}<h2>Tu siguiente encargo</h2><span class="der">${b.jugadas.length ? `${(S.jugadaIdx % b.jugadas.length) + 1} de ${b.jugadas.length}` : ''}</span></div>
      <div id="encargo-destacado">${j ? tarjetaEncargo(j, true) : `<div class="panel">${vacio('Sin encargos pendientes', 'Todos tus clientes están atendidos. Busca uno y reporta una visita.', 'check')}</div>`}</div></div>

    ${d.activo && esAsesor() && !d.reclamado ? `<button class="bono-llegada" id="b-diario">${coin()}<span><b>Bono de llegada</b><small>Día ${d.dia} · +${d.premios[Math.min(d.dia, d.premios.length) - 1] ?? ''}</small></span>${ic('flecha')}</button>` : ''}
  </div>`;

  if (conservar) {   // el cuarto sigue igual: se vuelve a poner el que ya estaba vivo (mismo canvas, sin recargar)
    $('.cuarto-hero', v).replaceWith(conservar);
    $('#b-mascota').innerHTML = `${esc(nombreMascota(b))} <b>Nv ${ms.nivel}</b>`;
    $('.chip-likes').innerHTML = `${ic('corazon')}${nf.format(b.likes || 0)}`;
    $('#b-banar')?.classList.toggle('urge', ms.suciedad >= 60);
  }
  enlazarEncargo($('#encargo-destacado'), j, true);
  const bd = $('#b-diario'); if (bd) bd.onclick = () => reclamarDiario(bd);
  const bmas = $('#b-mascota'); if (!bmas) return;   // te fuiste de Inicio mientras cargaba
  bmas.onclick = () => { S.tiendaTab = 'mascotas'; irA('tienda'); };
  const ba = $('#b-album'); if (ba) ba.onclick = () => { S.equipoTab = 'cartas'; irA('equipo'); };
  const mc = $('#mi-carta .carta'); if (mc) mc.onclick = () => (cd.carta.tengo ? hojaCarta(cd.carta, cd) : toast(pistaCarta(cd)));
  fotosPendientes(v);
  enlazarMisiones(v);

  const M = await cuandoMonstruos();
  await M.cargar?.(op.especie);   // tu mascota (casi siempre ya llego al abrir la app)
  const lienzo = $('#cuarto-3d');
  if (!lienzo) return;
  if (!M.disponible) { lienzo.innerHTML = `<div class="sin-3d">${vacio('Tu teléfono no muestra 3D', 'El juego funciona igual.', 'aviso')}</div>`; return; }
  if (!conservar) {
    ctlInicio = M.montarCuarto(lienzo, { mascota: op, muebles: p.cuarto, posiciones: p.posiciones || {}, pared: p.cuarto.pared, piso: p.cuarto.piso, interactivo: true,
      alTocar: () => accionesCuarto.tocar?.(), alLimpiar: (id) => accionesCuarto.limpiar?.(id) });
    firmaCuarto = firma;
    setTimeout(() => $('#pista-gesto')?.classList.add('ocultar'), 4000);
  }
  ctlInicio.ponerHigiene(ms);   // popós en el piso y lodo en la mascota
  notarPopos(ms.popos);

  $('#b-presumir').onclick = () => hojaPresumir(nombreMascota(b));
  // acercarse a la mascota
  $('#b-lupa').onclick = () => {
    if (ctlInicio.estaCerca()) ctlInicio.alejar(); else { ctlInicio.acercar(); setTimeout(() => { ctlInicio?.saludar(); Juego.Sonido.voz?.(null, 'saludo'); }, 500); }
    $('#b-lupa').classList.toggle('activo', ctlInicio.estaCerca()); Juego.Sonido.swoosh();
  };
  // modo decorar: mover y girar muebles; se guarda solo
  const NOMBRE_MUEBLE = { tapete: 'el tapete', cama: 'la cama', sillon: 'el sillón', planta: 'la planta', lampara: 'la lámpara', cuadro: 'el cuadro', tech: 'la tecnología', deco: 'la decoración' };
  let lugarSel = null;
  const guardar = async (lugar, pos) => {
    if (!esAsesor()) return;
    try { const r = await api('/api/perfil', { method: 'PUT', body: JSON.stringify({ mover: { lugar, pos } }) }); S.base.perfil = r.perfil; }
    catch (e) { toast(e.message, true); }
  };
  const modoDecorar = (on) => {
    $('#acc-normal').hidden = on; $('#acc-decorar').hidden = !on; $('#bandeja').hidden = true;
    $('.cuarto-hero').classList.toggle('decorando', on); $('#b-lupa').classList.remove('activo');
    ctlInicio.decorar(on, {
      alElegir: (lugar) => {
        lugarSel = lugar;
        $('#b-girar').disabled = !lugar || lugar === 'cuadro'; $('#b-cambiar').disabled = !lugar;
        $('#pista-decorar').textContent = lugar ? `Arrastra ${NOMBRE_MUEBLE[lugar] || 'el mueble'} a donde quieras` : 'Toca un mueble y arrástralo';
        if (lugar) Juego.Sonido.pop();
      },
      alMover: guardar,
    });
  };
  $('#b-decorar').onclick = () => { if (!Object.keys(p.cuarto).some((k) => !['pared', 'piso'].includes(k))) { S.tiendaTab = 'cuarto'; irA('tienda'); return; } modoDecorar(true); Juego.Sonido.swoosh(); };
  $('#b-listo').onclick = () => { modoDecorar(false); Juego.Sonido.exito(); Juego.estrellas($('#cuarto-3d'), 12, '#9fb9f4'); toast('¡Tu cuarto quedó guardado!'); };
  $('#b-girar').onclick = () => ctlInicio.girarElegido();
  $('#b-cambiar').onclick = () => { S.tiendaTab = 'cuarto'; S.lugarTab = lugarSel; irA('tienda'); };
  S.monstruoCiudad = ctlInicio;
  if (!conservar) setTimeout(() => { ctlInicio?.saludar(); Juego.Sonido.voz?.(null, ['hambre', 'sucio', 'popo'].includes(ms.animo) ? ms.animo : 'saludo'); }, 700);
  festejarMisiones(b, v);
  // racha en riesgo: un recordatorio amable, una vez al día (sin alarma)
  if (b.racha?.en_riesgo && esAsesor()) { try { const k = 'pmn.rachaRiesgo.' + new Date().toISOString().slice(0, 10); if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); setTimeout(() => Juego.Sonido.rachaRiesgo?.(), 1500); } } catch { /* sin almacenamiento */ } }   // misiones recién cumplidas: campanitas, estrellas y fanfarria si ya van las 3

  let mas = ms;
  globoAnimo(ms.animo, false);
  // al tocarla responde con SU voz: feliz/ronroneo, o su queja si tiene hambre, esta sucia o hay popo
  accionesCuarto = { tocar: () => { Juego.Sonido.voz?.(null, ['hambre', 'sucio', 'popo'].includes(mas.animo) ? mas.animo : 'caricia'); return accionMascota('caricia'); }, limpiar: (id) => limpiarPopo(id) };
  setTimeout(precargarTienda, 1500);   // la tienda queda lista para cuando la toques
  async function accionMascota(tipo, item = '') {
    if (!esAsesor()) return false;
    try {
      const r = await api('/api/mascota', { method: 'POST', body: JSON.stringify({ accion: tipo, item }) });
      mas = r.mascota; S.base.mascota = mas;
      globoAnimo(mas.animo);
      $$('.medidores-mini i').forEach((x, i) => x.style.setProperty('--v', [mas.llenura, mas.felicidad, 100 - mas.suciedad][i] + '%'));
      $('#b-banar')?.classList.toggle('urge', mas.suciedad >= 60);
      ctlInicio?.ponerHigiene(mas);
      notarPopos(mas.popos);   // si salio una popo nueva: plop
      if (tipo === 'caricia') Juego.vibrar(15);   // la voz ya sono al tocarla (accionesCuarto.tocar)
      return r;
    } catch (e) { toast(e.message, true); ctlInicio?.ponerHigiene(mas); return false; }
  }
  // higiene: recoger popós da monedas (con tope al día); bañarla solo la pone feliz
  const refrescarSaldo = (sd) => { const antes = S.base.saldo.monedas; S.base.saldo = sd; animarSaldo(antes, sd.monedas, lienzo); };
  async function limpiarPopo(id) {
    Juego.Sonido.recogerPopo?.(); Juego.vibrar(15);
    const r = await accionMascota('limpiar', id);
    if (!r) return;
    if (r.mascota.premio) { setTimeout(() => { Juego.Sonido.moneda(); flotante(`+${r.mascota.premio}`, lienzo); }, 250); refrescarSaldo(r.saldo); }
    else toast(`¡Gracias por limpiar! Hoy ya juntaste las ${mas.higiene.tope_limpieza} monedas de limpieza`);
    if (!mas.popos.length) setTimeout(() => { Juego.estrellas(lienzo, 10, '#69db7c'); toast('¡Cuarto limpiecito!'); }, 450);
  }
  $('#b-banar').onclick = async () => {
    if (!esAsesor() || ctlInicio.estaBanando()) return;
    if ((mas.suciedad || 0) < 5) { toast('¡Ya está rechinando de limpio!'); ctlInicio.feliz(); return; }
    $('#bandeja').hidden = true;
    const pide = accionMascota('banar');
    if (!ctlInicio.banar({ alTerminar: async () => {
      const r = await pide;
      Juego.Sonido.limpio?.(); Juego.estrellas(lienzo, 16, '#74c0fc');   // se sacude el agua y dice "¡limpio!"
      if (r) { Juego.confeti?.({ cantidad: 80, origenY: 0.5, fuerza: 0.8 }); Juego.vibrar?.([30, 40, 30]); toast('¡Quedó limpiecito y brillante! Está más feliz'); }
    } })) return;
    Juego.Sonido.banio(3.6);
  };
  $('#b-comer').onclick = () => {
    const bandeja = $('#bandeja');
    bandeja.hidden = !bandeja.hidden;
    if (bandeja.hidden) return;
    bandeja.innerHTML = Object.entries(mas.comidas).map(([k, c]) => `<button class="plato ${mas.inventario[k] ? '' : 'vacio'}" data-comida="${k}">
      ${imgFoto({ objeto: 'comida', clave: k }, 56)}<b>${esc(c.nombre)}</b>${mas.inventario[k] ? `<small>x${mas.inventario[k]}</small>` : `<small class="plato-precio">${coin()}${c.precio}</small>`}</button>`).join('');
    fotosPendientes(bandeja);
    $$('[data-comida]', bandeja).forEach((pl) => (pl.onclick = async () => {
      const k = pl.dataset.comida;
      // sin comida: se compra aqui mismo y se le da de una vez
      if (!mas.inventario[k]) {
        const c = mas.comidas[k], tengo = S.base?.saldo?.monedas ?? 0;
        if (!esAsesor()) return;
        if (tengo < c.precio) { toast(`Te faltan ${nf.format(c.precio - tengo)} monedas. ${c.como}.`, true); return; }
        if (!(await confirmarCompra(c.nombre, c.precio, 'comun'))) return;
        try {
          const r = await api('/api/comprar', { method: 'POST', body: JSON.stringify({ tipo: 'comida', clave: k }) });
          const antes = tengo; ponerSaldo(r.saldo); animarSaldo(antes, r.saldo.monedas);
          mas.inventario[k] = (mas.inventario[k] || 0) + 1; tiendaCache = null;
          Juego.Sonido.moneda?.(0.2);
        } catch (e) { toast(e.message, true); return; }
      }
      if (await accionMascota('comer', k)) {
        ctlInicio?.comer(k); Juego.Sonido.masticar?.(k); bandeja.hidden = true;
        setTimeout(() => flotante(`+${mas.comidas[k].llenura}`, lienzo), 1300);
      }
    }));
  };
  $('#b-jugar').onclick = () => jugarPelota(lienzo, ctlInicio, () => accionMascota('jugar'));
}

/* Cinco lanzamientos de una pelota dentro del cuarto 3D. */
function jugarPelota(lienzo, ctl, alTerminar) {
  if (!esAsesor()) return;
  const iniciada = ctl?.jugarPelota({
    alLanzar(n) { Juego.Sonido.lanzar?.(n); },
    alAtrapar(n) { Juego.Sonido.pelota?.(n); if (n < 5) Juego.Sonido.rebote?.(1.45); Juego.vibrar(15); toast(`¡Atrapó ${n} de 5!`); },   // rebote: la pelota vuelve a tu lado
    alTerminar() { alTerminar(); Juego.Sonido.pelotaFin?.(); Juego.confeti({ cantidad: 50, origenY: 0.3, fuerza: 0.6 }); toast('¡Jugaste con tu mascota!'); },
  });
  if (iniciada) { Juego.Sonido.init(); toast('Toca la pelota para lanzársela a tu mascota'); }
  else if (!ctl?.jugarPelota) toast('El cuarto 3D todavía está cargando');
}

// el saldo en todos lados a la vez: el HUD de arriba y el de la tienda (antes el de la tienda se quedaba atras)
function ponerSaldo(sd) { if (S.base) S.base.saldo = sd; pintarHud(); const t = $('#t-monedas'); if (t) t.textContent = fmtMonedas(sd.monedas); }

/* ============================================================ CAJAS (estilo Counter-Strike): la tienda de verdad.
   Se compran con monedas del juego. La ruleta: una tira de casillas que corre, frena suave con tic-tac y cae en tu
   premio (lo decide el servidor antes de girar; la tira es solo el show). */
const COLOR_CAJA = { mascotas: ['#21c8b6', '#0b6e74'], accesorios: ['#769cf4', '#2b4889'], habitacion: ['#ffb347', '#c2481f'], temporada: ['#ff7a18', '#121d37'] };
// cada caja es un bote de pintura de su color (web/monstruos3d.js: armarBote)
const BOTE_CAJA = { mascotas: { color: 0x21c8b6, oscuro: 0x0b6e74, etiqueta: 'Mascotas', tema: 'mascotas' },
  accesorios: { color: 0x9b6bff, oscuro: 0x3d2391, etiqueta: 'Accesorios', tema: 'accesorios' },
  habitacion: { color: 0xff8a3d, oscuro: 0xc2481f, etiqueta: 'Habitación', tema: 'habitacion' },
  temporada: { color: 0xff7a18, oscuro: 0x2b0f3a, etiqueta: 'Temporada', tema: 'temporada' } };
// lo que sale del bote en 3D
function premio3D(o, c) {
  const base = { especie: S.base?.mascota?.especie || 'obra', etapa: 3, crecimiento: 1, equipo: {} };
  const color = parseInt(String(o.color || tierDe(c, o).color).replace('#', ''), 16);
  if (o.clase === 'skin') return { tipo: o.slot, clave: o.base, acabado: { a: o.acabado, d: o.desgaste, p: o.patron }, color };
  if (o.tipo === 'monstruo') return { op: { ...base, especie: o.clave }, color };
  if (o.tipo === 'pelaje') return { op: { ...base, color: o.clave }, color };
  if (o.tipo === 'ojos') return { op: { ...base, ojos: o.clave }, color };
  return { tipo: o.tipo, clave: o.clave, color };
}
const PROB_TXT = (p) => (p >= 0.1 ? `${Math.round(p * 100)} %` : p >= 0.01 ? `${(p * 100).toFixed(1)} %` : `${(p * 100).toFixed(2)} %`);
function fotoDe(o, tam) {   // la foto 3D de lo que puede salir de una caja
  const base = { especie: S.base?.mascota?.especie || 'obra', color: '', ojos: 'normal', equipo: {}, etapa: 2, crecimiento: 0.7 };
  if (o.clase === 'skin' || o.acabado) return imgFoto({ objeto: o.slot, clave: o.base, acabado: { a: o.acabado, d: o.desgaste ?? 0.1, p: o.patron ?? 0 } }, tam, 'ru-img');
  if (o.tipo === 'monstruo') return imgFoto({ op: { ...base, especie: o.clave } }, tam, 'ru-img');
  if (o.tipo === 'pelaje') return imgFoto({ op: { ...base, color: o.clave } }, tam, 'ru-img');
  if (o.tipo === 'ojos') return imgFoto({ op: { ...base, ojos: o.clave } }, tam, 'ru-img');
  return imgFoto({ objeto: o.tipo, clave: o.clave }, tam, 'ru-img');
}
function tierDe(c, o) { return c.tiers[o.tier] || c.tiers.azul; }

async function pintarCajas(cont) {
  let d;
  try { d = await api('/api/cajas'); } catch (e) { cont.innerHTML = vacio('No se pudieron cargar las cajas', e.message, 'aviso'); return; }
  if (!enTienda() || !cont.isConnected) return;
  if (d.saldo) ponerSaldo(d.saldo);
  const top = (c) => [...c.contenido].sort((a, b) => ['comun', 'rara', 'epica', 'legendaria'].indexOf(b.rareza) - ['comun', 'rara', 'epica', 'legendaria'].indexOf(a.rareza))[0];
  cont.innerHTML = `
    <div class="cajas-grid">${d.cajas.map((c) => { const [c1, c2] = COLOR_CAJA[c.clave] || COLOR_CAJA.accesorios; const t = top(c);
      return `<article class="caja-card" style="--c1:${c1};--c2:${c2}">
        <div class="caja-escena"><img class="bote-img" alt="" data-bote="${c.clave}" src="${VACIO_IMG}"></div>
        <h3>${esc(c.nombre)}</h3>
        <p>${c.completa ? '<b class="t-oro">¡Completa!</b> Ya tienes todo' : `Te faltan <b>${c.faltan}</b> de ${c.contenido.length}`}${c.skins.length ? ` · <b class="t-oro">★ acabados</b>` : ''}${c.temporada ? ' · solo este mes' : ''}</p>
        <div class="caja-acc"><button class="enlace" data-ver="${c.clave}">Ver contenido</button>
          <button class="b3 oro" data-abrir="${c.clave}" ${c.completa ? 'disabled' : ''}>${c.completa ? 'Completa' : `Abrir ${coin()}${nf.format(c.precio)}`}</button></div>
      </article>`; }).join('')}</div>
    ${d.inventario.length ? `<div class="seccion"><div class="seccion-cab">${ic('estrella')}<h2>Tus objetos de caja</h2><span class="der">${d.inventario.length}</span></div>
      <div class="inv-grid">${d.inventario.map((o) => `<button class="inv-item ${o.puesto ? 'puesto' : ''}" style="--tc:${o.color}" data-item="${o.id}">
        ${fotoDe({ ...o, clase: 'skin' }, 96)}<b>${esc(o.nombre)}</b><small>${esc(o.desgaste_nombre)}${o.contaventas ? ' · ContaVentas' : ''}</small>${o.puesto ? '<i class="puesto-tag">Puesto</i>' : ''}</button>`).join('')}</div></div>` : ''}
    <p class="muted nota-tienda">Todo sale de las cajas, sin repetidas: lo que ya te salió se quita de la ruleta.</p>`;
  fotosPendientes(cont);
  cuandoMonstruos().then(async (M) => { await M.cargar?.('panda'); if (!M.disponible) return;
    for (const img of $$('[data-bote]', cont)) { const o = BOTE_CAJA[img.dataset.bote] || BOTE_CAJA.accesorios; img.src = M.fotoBoteSinTrabar ? await M.fotoBoteSinTrabar(o, 260) : M.fotoBote(o, 260); } });   // el bote de mascotas trae un panda en la tapa
  $$('[data-ver]', cont).forEach((b) => (b.onclick = () => hojaContenidoCaja(d.cajas.find((c) => c.clave === b.dataset.ver))));
  $$('[data-abrir]', cont).forEach((b) => (b.onclick = () => abrirCajaRuleta(d.cajas.find((c) => c.clave === b.dataset.abrir), cont)));
  $$('[data-item]', cont).forEach((b) => (b.onclick = () => hojaObjetoCaja(d.inventario.find((o) => o.id === +b.dataset.item), cont)));
}

function hojaContenidoCaja(c) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  const orden = ['legendaria', 'epica', 'rara', 'comun'];
  const grupos = orden.map((r) => [r, c.contenido.filter((o) => o.rareza === r)]).filter(([, l]) => l.length);
  velo.innerHTML = `<div class="hoja hoja-contenido"><div class="asa"></div>
    <div class="hoja-cab"><h2>${esc(c.nombre)}</h2><button class="hud-btn" data-cerrar aria-label="Cerrar">${ic('cerrar')}</button></div>
    ${c.skins.length ? `<h3 class="sub" style="color:${c.tiers.oro.color}">Objetos con acabado · ${PROB_TXT(c.prob_skin)} de las veces</h3>
      <div class="cont-grid">${c.skins.slice().reverse().map((o) => `<div class="cont-item" style="--tc:${tierDe(c, o).color}">${fotoDe({ ...o, clase: 'skin' }, 84)}<b>${esc(o.nombre)}</b>
        <small>${tierDe(c, o).nombre} · ${PROB_TXT(c.prob_skin * c.prob_skin_tier[o.tier] / c.skins.filter((x) => x.tier === o.tier).length)}</small></div>`).join('')}</div>` : ''}
    ${grupos.map(([r, l]) => { const o0 = l[0]; const t = tierDe(c, o0);
      return `<h3 class="sub" style="color:${t.color}">${t.nombre} · ${PROB_TXT((1 - c.prob_skin) * c.prob_rareza[r])}</h3>
      <div class="cont-grid">${l.map((o) => `<div class="cont-item ${o.tengo ? 'ya' : ''}" style="--tc:${t.color}">${fotoDe(o, 84)}<b>${esc(o.nombre)}</b>${o.tengo ? '<small>Ya es tuyo</small>' : ''}</div>`).join('')}</div>`; }).join('')}
    <div class="fila-acciones"><button class="b3 gris" data-cerrar>Cerrar</button></div></div>`;
  document.body.appendChild(velo);
  fotosPendientes(velo);
  velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-cerrar]')) velo.remove(); });
}

/* enlace publico para presumir la mascota con gente de fuera: solo ven la mascota y su cuarto (ni ventas ni foto) */
// imágenes del enlace: la vista previa de WhatsApp/Facebook (1200x630: tu cuarto en 3D con la mascota de cerca, su
// nombre en una placa DE y el logo) y la portada de la página (720x800, el cuarto solo: sale al instante mientras carga el 3D)
async function fotoPresumir(nombre) {
  try {
    const M = await cuandoMonstruos(); if (!M.disponible || !S.base) return {};
    const b = S.base, p = b.perfil || {}, ms = b.mascota;
    const mascota = mascotaOp(p, ms, b.gremio?.clave);
    await M.cargar?.(mascota.especie);
    try { await document.fonts?.load?.('900 40px Nunito'); } catch { /* la fuente del sistema */ }
    const op = { mascota, muebles: p.cuarto || {}, posiciones: p.posiciones || {}, pared: p.cuarto?.pared, piso: p.cuarto?.piso };
    const cuarto = (w, h) => (M.fotoCuartoSinTrabar ? M.fotoCuartoSinTrabar(op, w, h) : Promise.resolve(M.fotoCuarto(op, w, h)));
    // el cuarto se dibuja más grande y se recorta al centro: así la mascota sale de cerca y el cuarto alrededor
    const [ancho, portada, logo] = await Promise.all([cuarto(1680, 882).then(cargaImagen), cuarto(720, 800).then(cargaImagen), cargaImagen('./img/web-dev-eyes.svg')]);
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
    fondoMNLienzo(x, 1200, 630, 820, 315, null);
    // el cuarto en un marco redondeado a la derecha
    const R = { x: 452, y: 34, w: 714, h: 562, r: 34 };
    x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 40; x.shadowOffsetY = 16; x.fillStyle = '#0d2f80';
    x.beginPath(); x.roundRect ? x.roundRect(R.x, R.y, R.w, R.h, R.r) : x.rect(R.x, R.y, R.w, R.h); x.fill(); x.restore();
    if (ancho) {
      x.save(); x.beginPath(); x.roundRect ? x.roundRect(R.x, R.y, R.w, R.h, R.r) : x.rect(R.x, R.y, R.w, R.h); x.clip();
      const k = Math.max(R.w / (ancho.naturalWidth * 0.66), R.h / (ancho.naturalHeight * 0.66)), sw = R.w / k, sh = R.h / k;
      x.drawImage(ancho, (ancho.naturalWidth - sw) / 2, (ancho.naturalHeight - sh) * 0.72, sw, sh, R.x, R.y, R.w, R.h);
      const v = x.createLinearGradient(0, R.y + R.h * 0.62, 0, R.y + R.h); v.addColorStop(0, 'rgba(3,21,64,0)'); v.addColorStop(1, 'rgba(3,21,64,.35)');
      x.fillStyle = v; x.fillRect(R.x, R.y, R.w, R.h); x.restore();
    }
    x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 6; x.beginPath(); x.roundRect ? x.roundRect(R.x, R.y, R.w, R.h, R.r) : x.rect(R.x, R.y, R.w, R.h); x.stroke();
    // a la izquierda: logo, nombre en placa DE, dueño y corazones
    const cx = 236;
    logoEnLienzo(x, logo, cx, 40, 220);
    const dueno = String(S.sesion?.nombre || '').split(/\s+/)[0] || '';
    const duenoT = dueno ? dueno[0].toUpperCase() + dueno.slice(1).toLowerCase() : '';
    x.textAlign = 'center'; x.fillStyle = '#ffc21a'; x.font = '900 24px Nunito, system-ui, sans-serif';
    if ('letterSpacing' in x) x.letterSpacing = '2px';
    x.fillText(duenoT ? `LA MASCOTA DE ${duenoT.toUpperCase()}` : 'MI MASCOTA', cx, 286);
    if ('letterSpacing' in x) x.letterSpacing = '0px';
    // placa: blanca con orilla roja DE
    const placa = { x: 36, y: 308, w: 400, h: 112 };
    x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 18; x.shadowOffsetY = 8; x.fillStyle = '#e1211c';
    x.beginPath(); x.roundRect ? x.roundRect(placa.x, placa.y, placa.w, placa.h, 26) : x.rect(placa.x, placa.y, placa.w, placa.h); x.fill(); x.restore();
    x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect ? x.roundRect(placa.x + 6, placa.y + 6, placa.w - 12, placa.h - 18, 21) : x.rect(placa.x + 6, placa.y + 6, placa.w - 12, placa.h - 18); x.fill();
    x.fillStyle = '#06205c'; textoAjustado(x, nombre || 'Mi mascota', cx, placa.y + 76, placa.w - 48, 62);
    x.fillStyle = 'rgba(255,255,255,.92)'; x.font = '900 30px Nunito, system-ui, sans-serif';
    x.fillText(`Nivel ${ms?.nivel || 1}  ·  ♥ ${nf.format(b.likes || 0)}`, cx, 478);
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '800 22px Nunito, system-ui, sans-serif';
    x.fillText('¡Gira mi cuarto en 3D!', cx, 548);
    x.fillStyle = '#e1211c'; x.fillRect(0, 622, 1200, 8);
    const out = { foto: jpegLigero(c) };
    if (portada) {
      const q = document.createElement('canvas'); q.width = 720; q.height = 800; const y = q.getContext('2d');
      y.drawImage(portada, 0, 0, 720, 800); out.cuadro = jpegLigero(q);
    }
    return out;
  } catch (e) { console.warn('fotoPresumir', e); return {}; }
}

// sin la portada si el envío pasa de ~850 KB (el servidor no acepta más)
const cuerpoPresumir = (o) => { const t = JSON.stringify(o); if (t.length < 850000 || !o.cuadro) return t; const { cuadro, ...resto } = o; return JSON.stringify(resto); };
async function hojaPresumir(nombre) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  document.body.appendChild(velo);
  let enlaceVivo = '', vista = '', archivo = null;   // la imagen de la vista previa: se muestra aquí y se manda con el enlace
  const pintar = (enlace) => {
    enlaceVivo = enlace || '';
    const url = enlace ? location.origin + enlace : '';
    velo.innerHTML = `<div class="hoja hoja-presumir"><div class="asa"></div>
      <div class="hoja-cab"><h2>Presume a ${esc(nombre)}</h2><button class="hud-btn" data-cerrar aria-label="Cerrar">${ic('cerrar')}</button></div>
      <p class="muted">${url ? 'Cualquiera con este enlace puede ver tu mascota y tu cuarto en 3D. No ve tus ventas, ni tus puntos, ni tu foto.'
        : 'Crea un enlace para que tu familia o amigos vean tu mascota y tu cuarto en 3D, sin entrar a la app. Solo verán la mascota, tu primer nombre y tus corazones.'}</p>
      ${url && vista ? `<div class="pr-vista"><img alt="Así se verá tu enlace" src="${vista}"></div>` : ''}
      ${url ? `<div class="enlace-presumir"><input readonly value="${esc(url)}" id="pr-url"></div>
        <div class="fila-acciones"><button class="b3" id="pr-compartir">${ic('compartir')} Compartir</button><button class="b3 gris" id="pr-copiar">Copiar</button></div>
        <button class="b-texto" id="pr-apagar">Apagar el enlace</button>`
        : `<div class="fila-acciones"><button class="b3" id="pr-crear">${ic('compartir')} Crear mi enlace</button></div>`}</div>`;
    const crear = $('#pr-crear', velo), comp = $('#pr-compartir', velo), cop = $('#pr-copiar', velo), apagar = $('#pr-apagar', velo);
    const poner = async (activo) => { try { pintar((await api('/api/presumir', { method: 'POST', body: cuerpoPresumir({ activo, nombre, ...(activo ? await fotoPresumir(nombre) : {}) }) })).enlace); Juego.Sonido[activo ? 'exito' : 'listo']?.(); } catch (e) { toast(e.message, true); } };
    if (crear) crear.onclick = () => poner(true);
    if (apagar) apagar.onclick = () => poner(false);
    const copiar = async () => {
      try { await navigator.clipboard.writeText(url); Juego.Sonido.listo?.(); toast('Enlace copiado'); } catch { $('#pr-url', velo).select(); toast('Mantén presionado para copiar'); }
    };
    if (cop) cop.onclick = copiar;
    if (comp) comp.onclick = async () => {
      const texto = `¡Mira a ${nombre}, mi mascota de Distrito!`; Juego.Sonido.swoosh?.();
      if (archivo && navigator.canShare?.({ files: [archivo] })) { try { await navigator.share({ files: [archivo], title: texto, text: `${texto} ${url}` }); } catch { /* cancelado */ } return; }
      if (navigator.share) { try { await navigator.share({ title: texto, text: texto, url }); } catch { /* cancelado */ } return; }
      window.open('https://wa.me/?text=' + encodeURIComponent(`${texto} ${url}`), '_blank', 'noopener');
    };
  };
  velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-cerrar]')) velo.remove(); });
  try { pintar((await api('/api/presumir')).enlace); } catch (e) { velo.remove(); toast(e.message, true); }
  fotoPresumir(nombre).then(async (f) => {
    if (!f.foto) return;
    api('/api/presumir', { method: 'POST', body: cuerpoPresumir({ ...f, nombre }) }).catch(() => {});
    vista = f.foto;
    try { archivo = new File([await (await fetch(f.foto)).blob()], 'mi-mascota-mn.jpg', { type: 'image/jpeg' }); } catch { archivo = null; }
    if (velo.isConnected && enlaceVivo && !$('.pr-vista', velo)) pintar(enlaceVivo);
  });
}

/* una casilla al azar para la tira (con las mismas probabilidades que la caja) */
function casillaAlAzar(c) {
  if (c.skins.length && Math.random() < c.prob_skin) {
    const tiers = Object.keys(c.prob_skin_tier); let x = Math.random(), tier = tiers[0];
    for (const t of tiers) { x -= c.prob_skin_tier[t]; if (x <= 0) { tier = t; break; } }
    const l = c.skins.filter((s) => s.tier === tier); return { ...l[Math.floor(Math.random() * l.length)], clase: 'skin' };
  }
  const quedan = c.contenido.filter((o) => !o.tengo);   // sin repetidas: lo tuyo ya no esta en la ruleta
  if (!quedan.length) { const l = c.skins; return { ...l[Math.floor(Math.random() * l.length)], clase: 'skin' }; }
  const rs = Object.keys(c.prob_rareza).filter((r) => quedan.some((o) => o.rareza === r));
  let x = Math.random() * rs.reduce((s, r) => s + c.prob_rareza[r], 0), rr = rs[0];
  for (const r of rs) { x -= c.prob_rareza[r]; if (x <= 0) { rr = r; break; } }
  const l = quedan.filter((o) => o.rareza === rr); return l[Math.floor(Math.random() * l.length)];
}
const htmlCasilla = (c, o, gana = false) => {
  const t = tierDe(c, o), oro = o.tier === 'oro' && !gana;   // como en CS: lo dorado sale como "★" misterioso en la tira
  return `<div class="ru-casilla ${oro ? 'misterio' : ''}" style="--tc:${t.color}">${oro ? '<span class="ru-estrella">★</span>' : fotoDe(o, 96)}
    <b>${oro ? '★ Especial' : esc(o.nombre)}</b><i class="ru-barra"></i></div>`;
};

async function abrirCajaRuleta(c, cont) {
  if (!esAsesor() || abrirCajaRuleta.ocupada) return;   // dos toques rapidos no abren (ni cobran) dos cajas
  let r;
  abrirCajaRuleta.ocupada = true;
  try { r = await api('/api/cajas/abrir', { method: 'POST', body: JSON.stringify({ caja: c.clave }) }); }
  catch (e) { toast(e.message, true); return; }
  finally { abrirCajaRuleta.ocupada = false; }
  if (r.saldo) ponerSaldo(r.saldo);
  tiendaCache = null;
  const premio = r.objeto;
  const N = 64, GANA = 56;
  const tira = Array.from({ length: N }, (_, i) => (i === GANA ? premio : casillaAlAzar(c)));
  const [c1, c2] = COLOR_CAJA[c.clave] || COLOR_CAJA.accesorios;
  const velo = document.createElement('div');
  velo.className = 'velo velo-ruleta';
  velo.innerHTML = `<div class="ruleta" style="--c1:${c1};--c2:${c2}">
    <p class="ru-titulo">${esc(c.nombre)}</p>
    <div class="ru-bote" id="ru-bote"></div>
    <div class="ru-ventana escondida"><div class="ru-tira">${tira.map((o, i) => htmlCasilla(c, o, i === GANA)).join('')}</div>
      <i class="ru-marca" aria-hidden="true"></i></div>
    <div class="ru-premio" hidden></div>
  </div>`;
  document.body.appendChild(velo);
  fotosPendientes(velo);
  const ventana = $('.ru-ventana', velo), tiraEl = $('.ru-tira', velo);
  const casillas = $$('.ru-casilla', velo);
  // el bote: tiembla, la tapa sale volando, salpica y sale la luz; luego corre la ruleta
  const M = await cuandoMonstruos();
  await M.cargar?.(['panda', premio.tipo === 'monstruo' ? premio.clave : '']);   // la tapa del bote de mascotas y, si es mascota, el premio
  const bote = M.disponible ? M.montarBote($('#ru-bote', velo), BOTE_CAJA[c.clave] || BOTE_CAJA.accesorios) : null;
  if (bote) {
    await espera(500);
    // sonido sincronizado con montarBote: tiembla 0.9 s -> la tapa sale volando, salpica y sube el haz de luz
    const So = Juego.Sonido;
    So.init?.(); So.boteTiembla?.(0.9); So.botePop?.(0.9); So.salpicar?.(0.94); So.haz?.(1.0);
    Juego.vibrar?.([10, 40, 10, 40, 20]);
    setTimeout(() => Juego.vibrar?.([30, 20, 60]), 900);
    await bote.destapar();
  }
  ventana.classList.remove('escondida');
  Juego.Sonido.ruletaAbre?.();
  await espera(380);
  const ancho = casillas[1].offsetLeft - casillas[0].offsetLeft;
  const destino = casillas[GANA].offsetLeft + casillas[GANA].offsetWidth / 2 - ventana.clientWidth / 2 + (Math.random() - 0.5) * casillas[GANA].offsetWidth * 0.7;
  const sinMov = Juego.reducido?.();
  const DUR = sinMov ? 0 : 6800;
  const suave = (t) => 1 - Math.pow(1 - t, 4.2);   // arranca rapido y frena largo, como en CS
  let ultima = -1, tension = null;
  Juego.Sonido.init?.();
  await new Promise((fin) => {
    const t0 = performance.now();
    const paso = (ahora) => {
      const t = DUR ? Math.min(1, (ahora - t0) / DUR) : 1;
      const x = destino * suave(t);
      tiraEl.style.transform = `translateX(${-x}px)`;
      const i = Math.floor((x + ventana.clientWidth / 2) / ancho);
      // tick tipo CS: su tono y brillo siguen la velocidad (derivada de suave) y se tiñe con la rareza de la casilla
      if (i !== ultima) { ultima = i; if (t < 1) { Juego.Sonido.ruletaTick?.(Math.pow(1 - t, 3.2), tira[i]?.tier); if (t > 0.6) Juego.vibrar?.(4); } }
      // frenado final: entra la capa de anticipacion (zumbido que sube + latido que se alarga) hasta que se detiene
      if (!tension && DUR && t >= 0.36 && t < 1) tension = Juego.Sonido.ruletaTension?.((DUR * (1 - t)) / 1000) || 1;
      if (t < 1) requestAnimationFrame(paso); else fin();
    };
    requestAnimationFrame(paso);
  });
  // cae: la casilla ganadora brilla y aparece la ficha del premio
  tension?.parar?.();
  Juego.Sonido.ruletaAterriza?.();
  Juego.Sonido.ruletaPremio?.(premio.tier || 'azul', 0.1);
  const gana = casillas[GANA];
  gana.classList.add('ganadora');
  const t = premio.color || tierDe(c, premio).color;
  const grande = premio.tier === 'rojo' || premio.tier === 'oro';
  if (grande) { Juego.rafaga?.('#ffd43b'); setTimeout(() => Juego.fuegos?.({ n: 6, dur: 3400 }), 900); Juego.confeti?.({ cantidad: premio.tier === 'oro' ? 200 : 120, origenY: 0.3, fuerza: 1 }); Juego.vibrar?.([40, 40, 90]); velo.classList.add('destello'); }
  else if (premio.tier === 'rosa') Juego.confeti?.({ cantidad: 60, origenY: 0.35, fuerza: 0.7 });
  await espera(sinMov ? 0 : 700);
  const caja = $('.ru-premio', velo);
  const skin = premio.clase === 'skin';
  caja.style.setProperty('--tc', t);
  if (bote) { bote.mostrarPremio(premio3D(premio, c)); Juego.Sonido.premioSube?.(premio.tier || 'azul'); velo.querySelector('.ruleta').classList.add('con-bote'); }   // sale del bote en 3D
  caja.innerHTML = `${bote ? '' : `<div class="rp-luz" aria-hidden="true"></div><div class="rp-foto">${fotoDe(premio, 220)}</div>`}
    <small class="rp-rareza">${esc(skin ? premio.rareza_nombre : tierDe(c, premio).nombre)}${skin ? '' : ` · ${({ monstruo: 'Mascota', pelaje: 'Pelaje', ojos: 'Ojos', pared: 'Pared', piso: 'Piso' })[premio.tipo] || NOMBRE_LUGAR_T[premio.tipo] || ''}`}</small>
    <h2>${esc(premio.nombre)}</h2>
    ${skin ? `<p class="rp-datos">${esc(premio.desgaste_nombre)} · <span class="num">${premio.desgaste.toFixed(6)}</span> · patrón ${premio.patron}</p>
      ${premio.contaventas ? '<p class="rp-cv">ContaVentas™ · cuenta tus ventas desde hoy</p>' : ''}`
      : `<p class="rp-nuevo">¡Nuevo! Ya es tuyo</p><small class="muted">${premio.faltan ? `Te faltan ${premio.faltan} en esta caja` : '¡Completaste la caja!'}</small>`}
    <div class="fila-acciones">${skin ? '<button class="b3 azul" id="rp-poner">Ponérmelo</button>' : ''}
      <button class="b3 gris" id="rp-listo">Listo</button><button class="b3 oro" id="rp-otra">Abrir otra ${coin()}${nf.format(c.precio)}</button></div>`;
  caja.hidden = false;
  fotosPendientes(caja);
  velo.querySelector('.ru-ventana').classList.add(bote ? 'recogida' : 'atenuada');
  const cerrar = () => { velo.remove(); if (cont?.isConnected) pintarCajas(cont); };
  $('#rp-listo', velo).onclick = cerrar;
  $('#rp-otra', velo).onclick = async () => {
    velo.remove();
    const d2 = await api('/api/cajas').catch(() => null);   // lo que te acaba de salir ya no esta en la ruleta
    const c2 = d2?.cajas.find((x) => x.clave === c.clave);
    if (!c2 || c2.completa) { toast('¡Ya tienes todo lo de esta caja!'); if (cont?.isConnected) pintarCajas(cont); return; }
    abrirCajaRuleta(c2, cont);
  };
  const bp = $('#rp-poner', velo);
  if (bp) bp.onclick = async () => {
    try { await api('/api/cajas/poner', { method: 'POST', body: JSON.stringify({ id: premio.id, poner: true }) }); Juego.Sonido.listo?.(); toast('¡Listo! Ya lo trae tu mascota'); tiendaCache = null; cerrar(); }
    catch (e) { toast(e.message, true); }
  };
}

function hojaObjetoCaja(o, cont) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="hoja hoja-objeto" style="--tc:${o.color}"><div class="asa"></div>
    <div class="rp-foto">${fotoDe({ ...o, clase: 'skin' }, 200)}</div>
    <small class="rp-rareza">${esc(o.rareza_nombre)}</small><h2>${esc(o.nombre)}</h2>
    <p class="rp-datos">${esc(o.desgaste_nombre)} · <span class="num">${o.desgaste.toFixed(6)}</span> · patrón ${o.patron}</p>
    ${o.contaventas ? `<p class="rp-cv">ContaVentas™ · <b class="num">${nf.format(o.ventas || 0)}</b> ventas desde que lo tienes</p>` : ''}
    <div class="fila-acciones"><button class="b3 gris" data-cerrar>Cerrar</button>
      <button class="b3 ${o.puesto ? 'blanco' : 'azul'}" id="ob-poner">${o.puesto ? 'Quitármelo' : 'Ponérmelo'}</button></div></div>`;
  document.body.appendChild(velo);
  fotosPendientes(velo);
  velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-cerrar]')) velo.remove(); });
  $('#ob-poner', velo).onclick = async () => {
    try { await api('/api/cajas/poner', { method: 'POST', body: JSON.stringify({ id: o.id, poner: !o.puesto }) }); tiendaCache = null; velo.remove(); Juego.Sonido[o.puesto ? 'pop' : 'listo']?.(); toast(o.puesto ? 'Te lo quitaste' : '¡Listo! Ya lo trae tu mascota'); pintarCajas(cont); }
    catch (e) { toast(e.message, true); }
  };
}

/* ============================================================ TIENDA: mascotas, ropa, cuarto, comida y premios */
// 'premios' (premios reales del director) queda oculta: por ahora solo hay premios del juego (7-oct-2026)
// la tienda de verdad son las cajas (y la comida); lo demas es solo para decorar con lo que ya tienes
const TABS_TIENDA = [['cajas', 'Cajas'], ['comida', 'Comida'], ['mascotas', 'Mascotas'], ['ropa', 'Ropa'], ['cuarto', 'Cuarto'], ['estilo', 'Estilo']];
const ES_TIENDA = (t) => t === 'cajas' || t === 'comida';
const NOMBRE_LUGAR_T = { torso: 'Camisa', cabeza: 'Cabeza', cara: 'Cara', cuello: 'Cuello', espalda: 'Espalda', cama: 'Cama', sillon: 'Sillón', tapete: 'Tapete',
  planta: 'Planta', lampara: 'Lámpara', cuadro: 'Pared', tech: 'Tecno', deco: 'Deco', pared: 'Muros', piso: 'Piso' };

// cambiaste de pestaña mientras la tienda cargaba: no pintarla encima de otra pantalla
const enTienda = () => ['tienda', 'mercado', 'monstruo'].includes(S.vista);
// La vitrina 3D de la tienda se CONSERVA mientras sigas en la tienda: cambiar de pestaña, de lugar, de accesorio o de
// mascota solo actualiza la lista y el modelo. Antes cada toque rehacía todo (esqueleto gris + vitrina nueva) y se
// sentía como si la página se recargara (8-oct-2026).
let vitrinaViva = null;   // { el, ctl, modo: 'mascota' | 'cuarto' }
// catálogo de la tienda de hace menos de 60 s: cambiar de pestaña o de lugar es instantáneo (comprar o equipar lo borra)
let tiendaCache = null;   // { llave, hora, d }
// pide el catálogo por detrás (desde Inicio) para que al tocar Tienda ya esté listo
function precargarTienda() {
  const llave = S.verAsesor?.codigo || S.sesion?.codigo;
  if (!llave || (tiendaCache && tiendaCache.llave === llave && Date.now() - tiendaCache.hora < 30000)) return;
  if (tiendaEnCamino?.llave === llave) return;
  const p = api(conAsesor('/api/perfil')).then((d) => { tiendaCache = { llave, hora: Date.now(), d }; return d; })
    .finally(() => { if (tiendaEnCamino?.p === p) tiendaEnCamino = null; });
  tiendaEnCamino = { llave, p }; p.catch(() => {});
}
let tiendaEnCamino = null;   // { llave, p }: la precarga que va en camino (la tienda la espera en vez de pedir otra)
async function vistaTienda() {
  const v = $('#vista');
  const tab = TABS_TIENDA.some(([k]) => k === S.tiendaTab) ? S.tiendaTab : 'cajas';
  const modo = tab === 'cuarto' ? 'cuarto' : 'mascota';
  const previa = vitrinaViva && vitrinaViva.el.isConnected && v.querySelector('.vista.tienda') ? vitrinaViva : null;
  const scroll = window.scrollY;
  if (!previa) v.innerHTML = `<div class="vista"><div class="sk" style="height:250px;border-radius:24px"></div>${esqueleto(2, 160)}</div>`;
  let d, b;
  const llaveT = S.verAsesor?.codigo || S.sesion?.codigo;
  const cache = tiendaCache && tiendaCache.llave === llaveT && Date.now() - tiendaCache.hora < 60000 && S.base ? tiendaCache : null;
  const baseReciente = S.base && S.baseHora && Date.now() - S.baseHora < 30000;
  if (cache) { d = cache.d; b = S.base; }
  else if (tiendaEnCamino?.llave === llaveT) try { [d, b] = await Promise.all([tiendaEnCamino.p, baseReciente ? S.base : cargarBase()]); } catch { d = null; }
  if (!d) try { [d, b] = await Promise.all([api(conAsesor('/api/perfil')), baseReciente ? S.base : cargarBase()]); tiendaCache = { llave: llaveT, hora: Date.now(), d }; }
  catch (e) { if (!previa) v.innerHTML = `<div class="vista">${vacio('No se pudo cargar', e.message, 'aviso')}</div>`; else toast(e.message, true); return; }
  if (!enTienda()) return;
  // un solo saldo en toda la app: si los datos son frescos mandan; si son los guardados, manda el del HUD
  if (!cache) ponerSaldo(d.saldo); else if (S.base?.saldo) d = { ...d, saldo: S.base.saldo };
  const p = d.perfil, cat = d.catalogo, lug = cat._lugares;
  let monedas = d.saldo.monedas;
  const mio = mascotaOp(p, b.mascota, b.gremio.clave);
  const actual = { op: { ...mio, equipo: { ...p.equipo } }, cuarto: { ...p.cuarto } };
  const lugares = tab === 'ropa' ? ROPA : CUARTO;
  if (!lugares.includes(S.lugarTab)) S.lugarTab = lugares[0];
  const lugar = S.lugarTab;
  const col = d.coleccion;

  v.innerHTML = `<div class="vista tienda">
    <div class="cab-tienda"><div><h1>${ES_TIENDA(tab) ? 'Tienda' : 'Decorar'}</h1><p>${ES_TIENDA(tab) ? 'Todo sale de las cajas' : `${col.tengo}/${col.total} en tu colección`}</p></div>
      <span class="saldo-pill">${coin()}<b class="num" id="t-monedas">${fmtMonedas(monedas)}</b></span></div>
    <div class="modo-tienda" id="modo-tienda"><button data-modo="cajas" class="${ES_TIENDA(tab) ? 'activo' : ''}">${ic('regalo')}Cajas</button>
      <button data-modo="mascotas" class="${ES_TIENDA(tab) ? '' : 'activo'}">${ic('casa')}Decorar</button></div>
    ${tab !== 'premios' && !ES_TIENDA(tab) ? `<div class="vitrina ${tab === 'cuarto' ? 'vitrina-cuarto' : ''}" id="vitrina"></div>` : ''}
    <div class="chips-scroll" id="tabs-tienda">${TABS_TIENDA.filter(([k]) => ES_TIENDA(k) === ES_TIENDA(tab)).map(([k, t]) => `<button data-t="${k}" class="${tab === k ? 'activo' : ''}">${t}</button>`).join('')}</div>
    ${!ES_TIENDA(tab) ? `<button class="aviso-cajas" id="ir-cajas">${ic('regalo')}<span>¿Te falta algo? <b>Sale en las cajas</b></span>${ic('flecha')}</button>` : ''}
    ${tab === 'ropa' || tab === 'cuarto' ? `<div class="chips-scroll lugares" id="lugares">${lugares.map((k) => {
      const l = lug[k]; return `<button data-l="${k}" class="${lugar === k ? 'activo' : ''} ${l.abierto ? '' : 'cerrado'}">${l.abierto ? '' : ic('candado')}${NOMBRE_LUGAR_T[k]}</button>`; }).join('')}</div>` : ''}
    <div id="t-cont"></div>
  </div>`;
  // misma vitrina (mismo canvas, sin recargar el modelo) si sigue el mismo modo; se pone de vuelta en este mismo
  // instante (antes de cualquier await) para que su ciclo de dibujo no la dé por quitada
  const reusar = previa && previa.modo === modo && tab !== 'premios' && $('#vitrina', v) ? previa : null;
  if (reusar) $('#vitrina', v).replaceWith(reusar.el);
  if (previa) window.scrollTo(0, scroll);
  $$('#tabs-tienda [data-t]').forEach((x) => (x.onclick = () => { S.tiendaTab = x.dataset.t; S.lugarTab = null; vistaTienda(); }));
  $$('#modo-tienda [data-modo]').forEach((x) => (x.onclick = () => { if (ES_TIENDA(x.dataset.modo) === ES_TIENDA(tab)) return; S.tiendaTab = x.dataset.modo; S.lugarTab = null; vistaTienda(); }));
  const irC = $('#ir-cajas'); if (irC) irC.onclick = () => { S.tiendaTab = 'cajas'; vistaTienda(); };
  $$('#lugares [data-l]').forEach((x) => (x.onclick = () => { S.lugarTab = x.dataset.l; vistaTienda(); }));
  const cont = $('#t-cont');
  if (tab === 'premios') { await pintarPremios(cont, monedas); return; }
  if (tab === 'cajas') { await pintarCajas(cont); return; }

  // vitrina 3D: tu mascota (o tu cuarto) con lo que estas probando
  const M = await cuandoMonstruos();
  if (!enTienda() || !cont.isConnected) return;
  let ctl = null;
  const vit = $('#vitrina');
  if (reusar && reusar.el === vit) {
    ctl = reusar.ctl;   // ya está viva: solo se pone lo que acabas de guardar
    if (modo === 'cuarto') ctl.set?.({ muebles: actual.cuarto, pared: actual.cuarto.pared, piso: actual.cuarto.piso });
    else ctl.set?.(actual.op);
  } else if (M.disponible && vit) {
    ctl = tab === 'cuarto'
      ? M.montarCuarto(vit, { mascota: actual.op, muebles: actual.cuarto, posiciones: p.posiciones || {}, pared: actual.cuarto.pared, piso: actual.cuarto.piso })
      : M.montar(vit, { ...actual.op, interactivo: true });
    vitrinaViva = { el: vit, ctl, modo };
  }
  const probar = (cambio) => {
    if (!ctl) return;
    if (tab === 'cuarto') ctl.set({ muebles: cambio.cuarto || actual.cuarto, pared: (cambio.cuarto || actual.cuarto).pared, piso: (cambio.cuarto || actual.cuarto).piso });
    else ctl.set(cambio.op || actual.op);
  };

  if (tab === 'comida') {
    const ms = b.mascota;
    cont.innerHTML = `<div class="rejilla">${Object.entries(ms.comidas).map(([k, c]) => `<div class="item">
      ${imgFoto({ objeto: 'comida', clave: k }, 96, 'item-img')}<b>${esc(c.nombre)}</b><small>+${c.llenura} llenura · tienes ${ms.inventario[k] || 0}</small>
      <button class="precio-btn" data-comida="${k}">${coin()}${c.precio}</button></div>`).join('')}</div>
      <p class="muted nota-tienda">La comida también se gana sola: galletas con cada visita reportada, pasteles al reanimar clientes.</p>`;
    fotosPendientes(cont);
    $$('[data-comida]', cont).forEach((x) => (x.onclick = async () => {
      const k = x.dataset.comida, c = ms.comidas[k];
      if (await comprar('comida', k, c.precio, c.nombre, 'comun')) { ms.inventario[k] = (ms.inventario[k] || 0) + 1; tiendaCache = null; ctl?.feliz(); vistaTienda(); }
    }));
    return;
  }

  if (tab === 'estilo') {
    const pel = cat.pelaje, ojos = cat.ojos;
    cont.innerHTML = `<h3 class="sub">Color</h3><div class="colores">${pel.map((o) => `<button class="color ${mio.color === o.clave ? 'activo' : ''} ${o.desbloqueado ? '' : 'bloq'}" data-campo="pelaje" data-k="${esc(o.clave)}"
        style="--c:${o.clave ? '#' + (M.PELAJES?.[o.clave] ?? 0).toString(16).padStart(6, '0') : 'conic-gradient(#ffa25c,#ffd75e,#9be08a,#8fb8ff,#aac2f8,#ffa25c)'}" aria-label="${esc(o.nombre)}">
        ${o.desbloqueado ? '' : o.precio ? `<span class="mini-precio">${o.precio}</span>` : ic('candado')}</button>`).join('')}</div>
      <h3 class="sub">Ojos</h3><div class="rejilla">${ojos.map((o) => itemHTML('ojos', o, { op: { ...mio, ojos: o.clave } }, mio.ojos === o.clave)).join('')}</div>
      <h3 class="sub">Nombre</h3><div class="fila-nombre"><input class="input" id="i-nombre" maxlength="16" placeholder="${esc(NOMBRE_MONSTRUO[mio.especie])}" value="${esc(p.mascota_nombre || '')}">
        <button class="b3 verde chico" id="b-nombre">Guardar</button></div>`;
    fotosPendientes(cont);
    $('#b-nombre').onclick = async () => {
      try { const r = await api('/api/perfil', { method: 'PUT', body: JSON.stringify({ mascota_nombre: $('#i-nombre').value }) });
        S.base.perfil.mascota_nombre = r.perfil.mascota_nombre; ctl?.feliz(); Juego.Sonido.exito(); toast('¡Nombre guardado!'); } catch (e) { toast(e.message, true); }
    };
    $$('[data-campo]', cont).forEach((x) => (x.onclick = () => elegirPerfil(x.dataset.campo, x.dataset.k)));
    // los ojos se dibujan con itemHTML (sin data-campo): sin esto no se podían elegir ni comprar
    $$('.rejilla .item[data-k]', cont).forEach((x) => (x.onclick = () => elegirPerfil('ojos', x.dataset.k)));
    return;
  }

  if (tab === 'mascotas') {
    const lista = [...cat.monstruo].sort((a, z) => (z.desbloqueado - a.desbloqueado) || ((a.precio || 0) - (z.precio || 0)));
    cont.innerHTML = `<div class="rejilla">${lista.map((o) => itemHTML('monstruo', o, { op: { ...mio, especie: o.clave, equipo: {} } }, mio.especie === o.clave,
      o.clave === b.gremio.clave ? 'Tu gremio' : '')).join('')}</div>`;
    fotosPendientes(cont);
    $$('[data-k]', cont).forEach((x) => (x.onclick = () => elegirPerfil('monstruo', x.dataset.k)));
    return;
  }

  // ropa o cuarto: un lugar a la vez
  const l = lug[lugar];
  const lista = cat[lugar];
  const usando = tab === 'ropa' ? actual.op.equipo[lugar] || '' : actual.cuarto[lugar] || '';
  cont.innerHTML = `${l.abierto ? '' : `<div class="aviso-lugar">${ic('candado')}<span><b>${esc(l.nombre)}</b> se abre cuando tu mascota llegue a <b>nivel ${l.nivel}</b>. Hoy va en el ${cat._nivel_mascota}: cada punto que ganas la hace crecer.</span></div>`}
    <div class="rejilla">
      ${!['pared', 'piso'].includes(lugar) && l.abierto ? `<button class="item ${usando ? '' : 'usando'}" data-k=""><span class="item-vacio">${ic('cerrar')}</span><b>Nada</b><small>Quitar</small></button>` : ''}
      ${lista.map((o) => itemHTML(lugar, o, { objeto: lugar, clave: o.clave }, usando === o.clave)).join('')}</div>`;
  fotosPendientes(cont);
  $$('[data-k]', cont).forEach((x) => (x.onclick = () => elegirObjeto(lugar, x.dataset.k)));

  function itemHTML(tipo, o, foto, usando, extra = '') {
    const limitada = o.limitada ? `<span class="tag-lim">${o.agotada ? 'Agotada' : 'Solo ' + MESES_LARGOS[+o.limitada.slice(5, 7) - 1]}</span>` : '';
    const pie = o.desbloqueado ? `<small class="estado">${usando ? 'Usando' : 'Tuyo'}</small>`
      : o.precio ? `<span class="precio-btn">${coin()}${nf.format(o.precio)}</span>` : `<small class="req">${esc(o.requisito)}</small>`;
    return `<button class="item r-${o.rareza} ${usando ? 'usando' : ''} ${o.desbloqueado ? '' : 'no-mio'}" data-k="${esc(o.clave)}">
      <span class="rareza">${RAREZA_TXT[o.rareza]}</span>${limitada}${o.desbloqueado ? '' : `<span class="candado-esq" aria-label="Bloqueado">${ic('candado')}</span>`}
      ${imgFoto(foto, 96, 'item-img')}<b>${esc(o.nombre)}</b>${extra ? `<small>${esc(extra)}</small>` : ''}${pie}</button>`;
  }

  async function comprar(tipo, clave, precio, nombre, rareza) {
    if (!esAsesor()) { toast('Solo el asesor puede comprar'); return false; }
    if (monedas < precio) { toast(`Te faltan ${nf.format(precio - monedas)} monedas. Cada punto que ganas te da una.`, true); return false; }
    if (!(await confirmarCompra(nombre, precio, rareza))) return false;
    try {
      const r = await api('/api/comprar', { method: 'POST', body: JSON.stringify({ tipo, clave }) });
      const antes = monedas; monedas = r.saldo.monedas;
      tiendaCache = null; if (S.base) S.base.saldo = r.saldo;   // lo guardado ya no vale (Inicio usa S.base reciente)
      $('#t-monedas').textContent = fmtMonedas(monedas); if (monedas < 1e8) animarSaldo(antes, monedas);
      Juego.celebrar('compra', { rareza, el: $('#vitrina') });
      toast(`¡${nombre} es tuyo!`);
      return true;
    } catch (e) { toast(e.message, true); return false; }
  }

  async function elegirPerfil(campo, k) {
    const o = cat[campo].find((x) => x.clave === k);
    const cambio = { op: { ...actual.op, ...(campo === 'monstruo' ? { especie: k } : campo === 'pelaje' ? { color: k } : { ojos: k }) } };
    probar(cambio);
    if (!o.desbloqueado && !o.precio) { toast(`Así se vería. Se gana con: ${o.requisito}`); setTimeout(() => probar(actual), 2400); return; }
    if (!o.desbloqueado && !(await comprar(campo, k, o.precio, o.nombre, o.rareza))) { probar(actual); return; }
    if (!esAsesor()) return;
    try {
      const r = await api('/api/perfil', { method: 'PUT', body: JSON.stringify({ [campo]: k }) });
      S.base.perfil = r.perfil; tiendaCache = null; Juego.Sonido.exito(); vistaTienda();
    } catch (e) { toast(e.message, true); probar(actual); }
  }

  async function elegirObjeto(tipo, k) {
    const o = lista.find((x) => x.clave === k);
    const cambio = tab === 'ropa' ? { op: { ...actual.op, equipo: { ...actual.op.equipo, [tipo]: k } } } : { cuarto: { ...actual.cuarto, [tipo]: k } };
    if (!k) { if (tab === 'ropa') delete cambio.op.equipo[tipo]; else delete cambio.cuarto[tipo]; }
    probar(cambio);
    if (o && !l.abierto) { toast(`Así se vería. Se abre con tu mascota en nivel ${l.nivel}`); setTimeout(() => probar(actual), 2400); return; }
    if (o && !o.desbloqueado && !o.precio) { toast(o.agotada ? 'Edición limitada agotada: solo la tienen quienes la compraron a tiempo' : `Así se vería. ${o.requisito}`); setTimeout(() => probar(actual), 2400); return; }
    if (o && !o.desbloqueado && !(await comprar(tipo, k, o.precio, o.nombre, o.rareza))) { probar(actual); return; }
    if (!esAsesor()) return;
    try {
      const r = await api('/api/perfil', { method: 'PUT', body: JSON.stringify({ equipar: { tipo, clave: k } }) });
      S.base.perfil = r.perfil; tiendaCache = null; Juego.Sonido.exito(); vistaTienda();
    } catch (e) { toast(e.message, true); probar(actual); }
  }
}

function confirmarCompra(nombre, precio, rareza) {
  if (document.querySelector('.hoja-compra')) return Promise.resolve(false);   // dos toques no abren dos confirmaciones (ni dos compras)
  return new Promise((ok) => {
    const velo = document.createElement('div');
    velo.className = 'velo';
    velo.innerHTML = `<div class="hoja hoja-compra r-${rareza}"><div class="asa"></div>
      <span class="rareza grande">${RAREZA_TXT[rareza] || ''}</span>
      <h2>${esc(nombre)}</h2><p class="muted">Pagas <b>${nf.format(precio)}</b> monedas</p>
      <div class="fila-acciones"><button class="b3 gris" data-no>Ahora no</button><button class="b3 verde" data-si>${coin()}Comprar</button></div></div>`;
    document.body.appendChild(velo);
    const fin = (r) => { velo.remove(); ok(r); };
    velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-no]')) fin(false); if (e.target.closest('[data-si]')) fin(true); });
  });
}

const ICONO_PREMIO = { comida: 'comida', reloj: 'reloj', estrella: 'estrella', sol: 'sol', regalo: 'regalo', trofeo: 'trofeo' };
async function pintarPremios(cont, m) {
  const d = await api(conAsesor('/api/tienda'));
  cont.innerHTML = `<p class="muted nota-tienda">Premios reales que entrega el administrador.</p>
    ${d.premios.length ? `<div class="lista-premios">${d.premios.map((p) => {
      const alcanza = m >= p.costo, agotado = p.stock !== null && p.stock <= 0;
      return `<div class="premio-fila"><span class="premio-ic">${ic(ICONO_PREMIO[p.icono] || 'regalo')}</span>
        <div class="txt"><b>${esc(p.nombre)}</b><small>${esc(p.descripcion)}</small>
          ${alcanza ? '' : `<div class="barra-fina"><i style="width:${Math.min(100, (m / p.costo) * 100)}%"></i></div>`}</div>
        <button class="precio-btn ${alcanza ? '' : 'gris'}" data-p="${p.id}" ${!alcanza || agotado || !esAsesor() ? 'disabled' : ''}>${coin()}${agotado ? 'Agotado' : nf.format(p.costo)}</button></div>`;
    }).join('')}</div>` : vacio('Próximamente', 'El administrador está preparando los premios.', 'regalo')}
    ${d.canjes.length ? `<h3 class="sub">Mis canjes</h3><div class="lista-premios">${d.canjes.map((c) => `<div class="premio-fila"><span class="premio-ic">${ic('regalo')}</span>
      <div class="txt"><b>${esc(c.nombre)}</b><small>${nf.format(c.costo)} monedas · ${fechaCorta(c.creado)}</small></div>
      <span class="estado-canje ec-${c.estado}">${{ pendiente: 'En camino', entregado: 'Entregado', rechazado: 'Devuelto' }[c.estado]}</span></div>`).join('')}</div>` : ''}`;
  $$('[data-p]', cont).forEach((x) => (x.onclick = () => confirmarCanje(d.premios.find((p) => p.id === +x.dataset.p), m)));
}

/* ============================================================ EQUIPO: cartas (album) y cuartos */
async function pintarAlbum(cont) {
  const ed = S.albumEdicion || '';
  const [d, x, eds] = await Promise.all([api('/api/cartas' + (ed ? `?trimestre=${ed}` : '')), esAsesor() ? api('/api/intercambios').catch(() => null) : null,
    esAsesor() ? api('/api/ediciones').catch(() => null) : null]);
  const ofertas = x ? x.responder.filter((o) => !o.motivo).length + x.confirmar.filter((o) => !o.motivo).length : 0;
  const filtro = S.albumFiltro || 'todas';
  const yo = d.yo;
  const mia = d.filas.find((f) => f.codigo === yo);
  let filas = d.filas;
  if (filtro === 'tengo') filas = filas.filter((f) => f.tengo);
  if (filtro === 'faltan') filas = filas.filter((f) => !f.tengo);
  if (filtro === 'tienda' && mia) filas = filas.filter((f) => f.tienda === mia.tienda);
  const sb = d.sobres;
  cont.innerHTML = `
    <div class="album-cab">
      <div><b class="num">${d.tengo ?? d.total}/${d.total}</b><small>Álbum ${esc(d.trimestre.edicion)} · ${esc(d.trimestre.nombre)}</small></div>
      ${sb ? `<div class="sobres-acc">
        <button class="b3 oro chico" id="b-sobre">${ic('sobre')}Sobres${sb.disponibles ? ` · ${sb.disponibles} gratis` : ''}</button></div>` : ''}
    </div>
    ${eds && eds.ediciones.length > 1 ? `<div class="chips-scroll ediciones-album">${eds.ediciones.map((e) => `<button data-ed="${e.clave}" class="ed-chip ed-${e.q} ${e.clave === d.trimestre.clave ? 'activo' : ''}">
      <b>${esc(e.edicion)}</b><small>${esc(e.nombre)} · ${e.tengo}/${e.total}</small></button>`).join('')}</div>` : ''}
    ${x ? `<button class="b3 ${ofertas ? 'azul' : 'blanco'} ancho" id="b-intercambio">${ic('cartas')}Intercambiar${ofertas ? ` · ${ofertas} ${ofertas === 1 ? 'oferta' : 'ofertas'} para ti` : x.mis_repetidas.length ? ` · ${x.mis_repetidas.length} repetida${x.mis_repetidas.length === 1 ? '' : 's'}` : ''}</button>` : ''}
    <p class="muted nota-tienda">Ganas un sobre cada día que cumples las 3 misiones. Cada sobre trae 3 cartas de tus compañeros. Las cartas cambian cada trimestre.</p>
    ${d.por_nivel ? `<div class="niveles-album">${Object.entries(d.por_nivel).map(([n, [t, tot]]) => `<span class="nv nv-${n}">${NIVEL_CARTA[n]} <b>${t}/${tot}</b></span>`).join('')}</div>` : ''}
    <div class="chips-scroll" id="f-album">${[['todas', 'Todas'], ['tengo', 'Mis cartas'], ['faltan', 'Me faltan'], ['tienda', 'Mi tienda']].map(([k, t]) => `<button data-f="${k}" class="${filtro === k ? 'activo' : ''}">${t}</button>`).join('')}</div>
    <div class="album">${filas.map((f) => cartaHTML(f, d, { chica: true, oculta: !f.tengo })).join('') || vacio('Nada por aquí', '')}</div>`;
  // entrada escalonada: solo las primeras esperan, las de abajo entran ya
  $$('.album > .carta', cont).forEach((x, i) => x.style.setProperty('--n', Math.min(i, 14)));
  fotosPendientes(cont);
  $$('#f-album [data-f]', cont).forEach((x) => (x.onclick = () => { S.albumFiltro = x.dataset.f; pintarAlbum(cont); }));
  $$('.carta[data-carta]', cont).forEach((x) => (x.onclick = () => hojaCarta(d.filas.find((f) => f.codigo === x.dataset.carta), d)));
  const bs = $('#b-sobre', cont); if (bs) bs.onclick = () => tiendaSobres(cont, d.trimestre.clave);
  $$('[data-ed]', cont).forEach((b) => (b.onclick = () => { S.albumEdicion = b.dataset.ed; pintarAlbum(cont); }));
  const bi = $('#b-intercambio', cont); if (bi) bi.onclick = () => hojaIntercambio(x, d, cont);
  $$('.carta.oculta[data-falta]', cont).forEach((el) => (el.onclick = () => esAsesor() && hojaDeseo(d.filas.find((f) => f.codigo === el.dataset.falta), d, cont)));
  // cambios que se cerraron mientras no estabas: su animacion, una por una
  if (x?.terminados?.length && !pintarAlbum.animando) {
    pintarAlbum.animando = true;
    (async () => {
      for (const o of x.terminados) {
        const yoEnvie = o.de === S.sesion.codigo;
        await animarIntercambio(yoEnvie ? o.da : o.pide, yoEnvie ? o.pide : o.da, yoEnvie ? o.para_nombre : o.de_nombre, d);
      }
      await api('/api/intercambios/visto', { method: 'POST', body: JSON.stringify({ ids: x.terminados.map((o) => o.id) }) }).catch(() => {});
      pintarAlbum.animando = false;
      pintarAlbum(cont);
    })();
  }

}

/* ============================================================ INTERCAMBIO de cartas repetidas (como en Pokemon TCG Pocket)
   Cambias con quien tu quieras: ofreces una repetida y pides una suya, o le dejas escoger y tu confirmas.
   Cada quien paga por la carta que recibe; saltar mas de un nivel cuesta el doble a los dos. */
const chipCarta = (c) => (c ? `<span class="chip-carta n-${c.nivel}"><i>${NIVEL_CARTA[c.nivel]}</i>${esc(dosNombres(c.nombre))}</span>` : '');
const costoTxt = (n) => `${coin()}${nf.format(n)}`;
function costoCambio(x, da, pide) {   // misma regla que el servidor (jugador.costo_cambio)
  const O = ORDEN_CARTA;
  const salto = Math.abs(O[da.nivel] - O[pide.nivel]) > 1, f = salto ? 2 : 1;
  return { yo: x.costos[pide.nivel] * f, otro: x.costos[da.nivel] * f, salto };
}

async function hojaIntercambio(x, d, cont, tab = null) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  const pendientes = x.responder.length + x.confirmar.length;
  let pest = tab || (pendientes ? 'ofertas' : 'cambiar');
  const cerrar = () => velo.remove();
  const recargar = async (msg) => { if (msg) toast(msg); cerrar(); await pintarAlbum(cont); };

  const filaOferta = (o, tipo) => {
    let cuerpo = '', acc = '';
    if (tipo === 'responder' && o.motivo) {
      cuerpo = `<b>${esc(dosNombres(o.de_nombre))}</b> te ofrecía ${chipCarta(o.carta_da)}<small>${esc(o.motivo)}</small>`;
      acc = `<button class="b3 gris chico" data-resp="${o.id}" data-acepta="0">Quitar</button>`;
    } else if (tipo === 'responder' && !o.pide) {
      cuerpo = `<b>${esc(dosNombres(o.de_nombre))}</b> te ofrece:
        <div class="oferta-vista">${cartaGrande(o.carta_da, d)}</div>
        <small>Si te late, ofrécele tú una de tus repetidas (toca la que quieras darle):</small>
        ${o.opciones.length ? `<div class="mis-repetidas">${o.opciones.map((c) => `<button class="rep-op" data-elegir="${o.id}" data-c="${esc(c.codigo)}">
          ${cartaGrande(c, d)}<span>${c.deseo ? '<b class="corazon">♥ la quiere</b>' : ''}${costoTxt(c.costo)}${c.salto ? ' · doble' : ''}</span></button>`).join('')}</div>`
          : '<small>No tienes repetidas que le falten.</small>'}`;
      acc = `<button class="b3 gris chico" data-resp="${o.id}" data-acepta="0">No, gracias</button>`;
    } else if (tipo === 'responder') {
      cuerpo = `<b>${esc(dosNombres(o.de_nombre))}</b> te da ${chipCarta(o.carta_da)} por tu ${chipCarta(o.carta_pide)}
        <small>Te cuesta ${costoTxt(o.costo_para)}${o.salto ? ' · doble por saltar niveles' : ''}</small>`;
      acc = `<button class="b3 gris chico" data-resp="${o.id}" data-acepta="0">No</button><button class="b3 verde chico" data-resp="${o.id}" data-acepta="1">¡Cambiar!</button>`;
    } else if (tipo === 'confirmar') {
      cuerpo = `<b>${esc(dosNombres(o.para_nombre))}</b> te ofrece esta por tu ${chipCarta(o.carta_da)}:
        <div class="oferta-vista">${cartaGrande(o.carta_pide, d)}</div>
        <small>${o.motivo ? esc(o.motivo) : `Si aceptas, se cambian y pagan los dos: tú ${costoTxt(o.costo_de)} · ${esc(dosNombres(o.para_nombre).split(' ')[0])} ${costoTxt(o.costo_para)}${o.salto ? ' (doble por saltar niveles)' : ''}`}</small>`;
      acc = `<button class="b3 gris chico" data-resp="${o.id}" data-acepta="0">No</button>${o.motivo ? '' : `<button class="b3 verde chico" data-resp="${o.id}" data-acepta="1">¡Cambiar!</button>`}`;
    } else {
      const yoEnvie = o.de === S.sesion.codigo;
      cuerpo = yoEnvie
        ? `Le ofreciste ${chipCarta(o.carta_da)} a <b>${esc(dosNombres(o.para_nombre))}</b><small>${o.motivo ? esc(o.motivo) : 'Esperando que te ofrezca una de las suyas'}</small>`
        : `Le ofreciste ${chipCarta(o.carta_pide)} a <b>${esc(dosNombres(o.de_nombre))}</b> por su ${chipCarta(o.carta_da)}<small>Esperando que acepte</small>`;
      acc = `<button class="b3 gris chico" data-resp="${o.id}" data-acepta="0">Retirar</button>`;
    }
    return `<div class="fila-inter"><div class="txt">${cuerpo}</div><div class="acc">${acc}</div></div>`;
  };

  function pintar() {
    const lista = x.companeros;
    velo.innerHTML = `<div class="hoja hoja-inter"><div class="asa"></div>
      <div class="hoja-cab"><h2>${ic('cartas')}Intercambios</h2><button class="hud-btn" data-cerrar aria-label="Cerrar">${ic('cerrar')}</button></div>
      <div class="segmentos" id="seg-inter">
        <button data-p="ofertas" class="${pest === 'ofertas' ? 'activo' : ''}">Ofertas${pendientes ? ` (${pendientes})` : ''}</button>
        <button data-p="cambiar" class="${pest === 'cambiar' ? 'activo' : ''}">Cambiar con…</button>
      </div>
      ${pest === 'ofertas' ? `
        ${x.responder.length ? `<h3 class="sub">Te ofrecen</h3>${x.responder.map((o) => filaOferta(o, 'responder')).join('')}` : ''}
        ${x.confirmar.length ? `<h3 class="sub">Ya te respondieron</h3>${x.confirmar.map((o) => filaOferta(o, 'confirmar')).join('')}` : ''}
        ${x.esperando.length ? `<h3 class="sub">Esperando</h3>${x.esperando.map((o) => filaOferta(o, 'esperando')).join('')}` : ''}
        ${x.responder.length + x.confirmar.length + x.esperando.length ? '' : `<p class="muted vacio-inter">No tienes ofertas. Ve a <b>Cambiar con…</b> y elige a un compañero.</p>`}
        <p class="muted nota-inter">Las ofertas duran ${x.horas} horas. Cada quien paga por la carta que recibe:
          ${Object.entries(x.costos).map(([n, c]) => `${NIVEL_CARTA[n]} ${nf.format(c)}`).join(' · ')}. Del mismo nivel o uno arriba o abajo es lo normal;
          saltar más (bronce por diamante) cuesta <b>el doble</b> a los dos.</p>`
      : `<input class="input" id="buscar-comp" placeholder="Buscar compañero" autocomplete="off">
        <p class="muted nota-inter">${x.mis_repetidas.length ? `Tienes ${x.mis_repetidas.length} repetida${x.mis_repetidas.length === 1 ? '' : 's'} para cambiar.` : 'Aún no tienes repetidas: salen al abrir sobres.'}
          ${x.mis_deseos.length ? ` · ${x.mis_deseos.length} en tu lista de deseos.` : ' Marca en el álbum las que quieres (♥).'}</p>
        <div class="lista-comp">${lista.map((c) => `<button class="comp" data-comp="${esc(c.codigo)}" data-n="${esc(c.nombre.toLowerCase())}">
          ${avatar(c.nombre, {}, 40)}<span class="txt"><b>${esc(dosNombres(c.nombre))}</b><small>${esc(tiendaNombre(c.tienda))} · ${c.repetidas} repetida${c.repetidas === 1 ? '' : 's'}</small></span>
          <span class="marcas">${c.en_tu_lista ? `<i class="m-deseo">♥ ${c.en_tu_lista}</i>` : ''}${c.te_sirven ? `<i class="m-sirve">${c.te_sirven} te faltan</i>` : ''}${c.quiere_tuyas ? `<i class="m-quiere">quiere ${c.quiere_tuyas} tuya${c.quiere_tuyas === 1 ? '' : 's'}</i>` : ''}</span>
          ${ic('flecha')}</button>`).join('')}</div>`}
    </div>`;
    const bq = $('#buscar-comp', velo);
    if (bq) bq.oninput = () => { const t = bq.value.trim().toLowerCase(); $$('.comp', velo).forEach((b) => { b.hidden = t && !b.dataset.n.includes(t); }); };
  }
  pintar();
  document.body.appendChild(velo);
  fotosPendientes(velo);

  velo.addEventListener('click', async (e) => {
    if (e.target === velo || e.target.closest('[data-cerrar]')) { cerrar(); return; }
    const sp = e.target.closest('#seg-inter [data-p]');
    if (sp) { pest = sp.dataset.p; pintar(); fotosPendientes(velo); return; }
    const bc = e.target.closest('[data-comp]');
    if (bc) { cerrar(); hojaCambioCon(bc.dataset.comp, x, d, cont); return; }
    const b = e.target.closest('button[data-resp], button[data-elegir]');
    if (!b || b.disabled) return;
    b.disabled = true;
    try {
      if (b.dataset.elegir) {
        await api('/api/intercambios/elegir', { method: 'POST', body: JSON.stringify({ id: +b.dataset.elegir, pide: b.dataset.c }) });
        Juego.Sonido.exito();
        await recargar('Listo: le ofreciste tu carta. Si acepta, se cambian');
        return;
      }
      const o = [...x.responder, ...x.confirmar, ...x.esperando].find((y) => y.id === +b.dataset.resp);
      const r = await api('/api/intercambios/responder', { method: 'POST', body: JSON.stringify({ id: +b.dataset.resp, acepta: b.dataset.acepta === '1' }) });
      if (r.saldo) ponerSaldo(r.saldo);
      if (r.estado === 'aceptado') {
        cerrar();
        const otro = o ? (o.de === S.sesion.codigo ? o.para_nombre : o.de_nombre) : '';
        await animarIntercambio(r.das, r.recibes, otro, d);
        await pintarAlbum(cont);
        return;
      }
      await recargar({ rechazado: 'Oferta rechazada', cancelado: 'Oferta retirada' }[r.estado]);
    } catch (err) { toast(err.message, true); b.disabled = false; }
  });
}

/* Armar un cambio con un companero: escoges cual de TUS repetidas le ofreces, viendo las cartas completas.
   La que recibes no la escoges: te la ofrece el, y si los dos estan de acuerdo se cambian. */
const cartaGrande = (c, d) => (c?.stats ? cartaHTML(c, d, { chica: true }) : `<div class="carta oculta chica"><div class="carta-in dorso-mn">${DORSO_MN}<span class="silueta">?</span><b>${esc(dosNombres(c?.nombre || ''))}</b></div></div>`);
async function hojaCambioCon(otro, x, d, cont) {
  let c;
  try { c = await api(`/api/intercambios/companero?de=${encodeURIComponent(otro)}`); } catch (e) { toast(e.message, true); return; }
  let elegida = null;
  const nombre1 = dosNombres(c.companero.nombre).split(' ')[0];
  const velo = document.createElement('div');
  velo.className = 'velo';
  function pintar() {
    const mias = c.mias.map((f) => ({ ...f, ...(d.filas.find((y) => y.codigo === f.codigo) || {}), le_falta: f.le_falta, la_quiere: f.la_quiere }));
    const sel = mias.find((f) => f.codigo === elegida);
    velo.innerHTML = `<div class="hoja hoja-inter hoja-cambio"><div class="asa"></div>
      <div class="hoja-cab"><h2>Cambiar con ${esc(dosNombres(c.companero.nombre))}</h2><button class="hud-btn" data-cerrar aria-label="Cerrar">${ic('cerrar')}</button></div>
      <p class="muted">Escoge cuál de tus repetidas le ofreces. ${esc(nombre1)} te ofrecerá una de las suyas y, si los dos están de acuerdo, se cambian.</p>
      ${c.suyas.length ? `<p class="muted nota-inter">${esc(nombre1)} tiene ${c.suyas.length} repetida${c.suyas.length === 1 ? '' : 's'}${c.suyas.some((f) => f.te_falta) ? `, ${c.suyas.filter((f) => f.te_falta).length} que te faltan` : ''}.</p>` : `<p class="muted nota-inter">${esc(nombre1)} aún no tiene repetidas: quizá no pueda ofrecerte nada.</p>`}
      <div class="mis-repetidas">${mias.map((f) => `<button class="rep-op ${f.codigo === elegida ? 'elegida' : ''}" data-c="${esc(f.codigo)}" ${f.le_falta ? '' : 'disabled'}>
        ${cartaGrande(f, d)}<span>${f.la_quiere ? '<b class="corazon">♥ la quiere</b>' : f.le_falta ? 'Le falta' : 'Ya la tiene'}</span></button>`).join('')
        || '<p class="muted">Aún no tienes repetidas: salen al abrir sobres.</p>'}</div>
      <div class="resumen-cambio">${sel ? `Le ofreces a <b>${esc(dosNombres(sel.nombre))}</b>. ${esc(nombre1)} paga ${costoTxt(x.costos[sel.nivel])} si acepta; tú pagas según la carta que te ofrezca.`
        : 'Toca la carta que le quieres ofrecer.'}</div>
      <div class="fila-acciones"><button class="b3 gris" data-volver>Atrás</button>
        <button class="b3 azul" id="b-enviar" ${sel ? '' : 'disabled'}>${ic('cartas')}Ofrecer carta</button></div>
    </div>`;
    fotosPendientes(velo);
  }
  pintar();
  document.body.appendChild(velo);
  velo.addEventListener('click', async (e) => {
    if (e.target === velo || e.target.closest('[data-cerrar]')) { velo.remove(); return; }
    if (e.target.closest('[data-volver]')) { velo.remove(); hojaIntercambio(x, d, cont, 'cambiar'); return; }
    const op = e.target.closest('.rep-op[data-c]');
    if (op && !op.disabled) { elegida = elegida === op.dataset.c ? null : op.dataset.c; pintar(); return; }
    const be = e.target.closest('#b-enviar');
    if (!be || be.disabled) return;
    be.disabled = true;
    try {
      await api('/api/intercambios', { method: 'POST', body: JSON.stringify({ para: otro, da: elegida }) });
      Juego.Sonido.exito();
      velo.remove();
      toast(`Le ofreciste tu carta a ${dosNombres(c.companero.nombre)}`);
      await pintarAlbum(cont);
    } catch (err) { toast(err.message, true); be.disabled = false; }
  });
}

/* La animacion del cambio: tu carta y la suya suben, giran una alrededor de la otra en un remolino de luz,
   se cruzan y la nueva aterriza al frente con destello, confeti y sonido. */
async function animarIntercambio(das, recibes, otroNombre, d0) {
  // el album de antes no trae los datos de la carta que aun no tenias: se pide ya con el cambio hecho
  const d = await api('/api/cartas').catch(() => d0);
  return new Promise((listo) => {
    const fDa = d.filas.find((f) => f.codigo === das), fRe = d.filas.find((f) => f.codigo === recibes);
    if (!fDa?.stats || !fRe?.stats) { Juego.Sonido.exito?.(); toast('¡Cambio hecho! La carta ya está en tu álbum'); listo(); return; }
    const sinMov = window.CartasFX?.reducido() ?? Juego.reducido();
    const velo = document.createElement('div');
    velo.className = 'velo velo-cambio';
    velo.innerHTML = `<div class="escena-cambio n-${fRe.nivel}">
      <div class="cambio-luz" aria-hidden="true"></div><div class="cambio-remolino" aria-hidden="true"></div>
      <p class="cambio-titulo">Cambio con ${esc(dosNombres(otroNombre || ''))}</p>
      <div class="cambio-carta sale">${cartaHTML({ ...fDa, tengo: true }, d, { chica: true })}<span>La das</span></div>
      <div class="cambio-carta entra"><div class="dorso dorso-mn ed-${d.trimestre.q}">${DORSO_MN}</div>${cartaHTML({ ...fRe, tengo: true }, d, { chica: true })}<span>¡Nueva!</span></div>
      <button class="b3 verde" id="b-cambio-ok" hidden>¡A mi álbum!</button></div>`;
    document.body.appendChild(velo);
    fotosPendientes(velo);
    const esc_ = $('.escena-cambio', velo);
    const fin = () => { velo.remove(); listo(); };
    $('#b-cambio-ok', velo).onclick = fin;
    if (sinMov) { esc_.classList.add('fase-final'); $('#b-cambio-ok', velo).hidden = false; Juego.Sonido.exito(); return; }
    Juego.Sonido.swoosh();
    setTimeout(() => { esc_.classList.add('fase-gira'); Juego.Sonido.remolino?.(1.1); Juego.vibrar?.([20, 40, 20]); }, 650);
    setTimeout(() => { esc_.classList.add('fase-cruza'); Juego.Sonido.swoosh(); }, 1750);
    setTimeout(() => {
      esc_.classList.add('fase-final');
      Juego.Sonido.cartaVoltea?.(fRe.nivel); Juego.Sonido.exito?.(0.12);
      if (esIcono(fRe)) { Juego.Sonido.icono?.(); window.CartasFX?.rafaga('#ffd65a', velo); }
      else if (fRe.nivel === 'oro' || fRe.nivel === 'leyenda') Juego.Sonido.destellos?.(fRe.nivel === 'leyenda' ? 8 : 4, 0.7);
      Juego.confeti?.({ cantidad: esIcono(fRe) ? 200 : fRe.nivel === 'leyenda' ? 140 : 80, origenY: 0.45, fuerza: 0.8 });
      Juego.vibrar?.([40, 30, 60]);
      setTimeout(() => window.CartasFX?.destello($('.entra .carta', velo)), 250);
    }, 2500);
    setTimeout(() => { $('#b-cambio-ok', velo).hidden = false; }, 3100);
  });
}

/* carta que te falta: la puedes poner en tu lista de deseos para que tus companeros lo vean */
async function hojaDeseo(f, d, cont) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="hoja hoja-deseo"><div class="asa"></div>
    <div class="carta-centro">${cartaHTML(f, d, { oculta: true })}</div>
    <h2>${esIcono(f) ? 'Te falta la carta Ícono' : `Te falta ${esc(dosNombres(f.nombre))}`}</h2>
    <p class="muted">${esIcono(f) ? 'Carta Ícono: sale muy rara en los sobres (casi 1 de cada 200). También la puedes cambiar con un compañero que la tenga repetida.'
      : 'Sale en los sobres o cámbiala con un compañero que la tenga repetida.'}${f.deseo ? ' Está en tu lista de deseos: tus compañeros lo ven al cambiar contigo.' : ''}</p>
    <div class="fila-acciones"><button class="b3 gris" data-cerrar>Cerrar</button>
      <button class="b3 ${f.deseo ? 'blanco' : 'rosa'}" id="b-deseo">${f.deseo ? 'Quitar de mi lista' : '♥ La quiero'}</button></div></div>`;
  document.body.appendChild(velo);
  velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-cerrar]')) velo.remove(); });
  $('#b-deseo', velo).onclick = async () => {
    try {
      await api('/api/deseos', { method: 'POST', body: JSON.stringify({ carta: f.codigo, quiero: !f.deseo }) });
      Juego.Sonido[f.deseo ? 'pop' : 'listo']?.(); toast(f.deseo ? 'La quitaste de tu lista' : '¡Agregada a tu lista de deseos!');
      velo.remove(); await pintarAlbum(cont);
    } catch (e) { toast(e.message, true); }
  };
}

/* ============================================================ REVERSO DE LAS CARTAS (todas: album, sobres, intercambios):
   azul DE con el monograma en diagonal, marco dorado, franja roja y el logo redondo de DE al centro. El estilo vive en
   .dorso-mn (styles.css); aqui solo van las piezas. */
const DORSO_MN = '<i class="dmn-marco" aria-hidden="true"></i><i class="dmn-logo" aria-hidden="true"></i>';

/* ============================================================ ARTE DEL SOBRE (v5): un sobre de lamina de verdad
   (v4 plano y v3 con mascotas en docs/diseno/sobres). Sellos prensados en zigzag arriba y abajo, cuerpo inflado
   (sombras curvas, bandas de brillo y orillas oscuras), lamina que cambia con el dedo o al mover el telefono, grosor
   y sombra en el piso. Al frente: el logo del juego, el abanico de 3 cartas, las gemas y el nombre de la edicion.
   La tira de arriba se arranca deslizando el dedo sobre la linea (abrirSobre). */
const SILUETA_CARTA = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="36" r="19"/><path d="M14 100c0-24 16-38 36-38s36 14 36 38z"/></svg>`;
const dorsoCartaMini = (q) => `<div class="pk-mini dorso dorso-mn ed-${q}">${DORSO_MN}</div>`;
// portada del sobre: 'siluetas' (sin asesores) o 'asesores' (las 3 mejores cartas de la edicion con foto). El director escoge.
const PORTADA_SOBRE = () => store.get('portadaSobre', 'siluetas');
const portadas = {};   // clave de edicion -> sus 3 cartas de portada (llegan con /api/ediciones)
const ATRIBUTOS_MINI = [{ clave: 'dig' }, { clave: 'cot' }, { clave: 'rea' }, { clave: 'com' }];
function abanicoAsesores(q, cartas, t) {
  const d = { trimestre: t, atributos: ATRIBUTOS_MINI };
  const [a, b, c] = cartas;   // a = la mejor (al centro)
  return `<div class="pk-abanico con-asesores">
    ${[[b, 'izq'], [c, 'der'], [a, 'centro']].filter(([f]) => f).map(([f, lado]) => `<div class="pk-real ${lado}">${cartaHTML(f, d, { chica: true })}</div>`).join('')}</div>`;
}
function arteSobre(q, edicion, nombre, etiqueta = 'Edición', t = null) {
  const reales = PORTADA_SOBRE() === 'asesores' && t && portadas[t.clave]?.length ? portadas[t.clave] : null;
  return `<i class="pk-suelo" aria-hidden="true"></i><div class="pk" aria-hidden="true">
      <i class="pk-capa c2"></i><i class="pk-capa c1"></i>
      <div class="pk-dorso dorso-mn">${DORSO_MN}</div>
      <div class="pk-cara">
        <i class="pk-fondo"></i><i class="pk-marco"></i>
        <img class="pk-logo" src="./img/web-dev-eyes.svg" alt="" width="240" height="195" draggable="false">
        <div class="pk-cab"><small>${esc(etiqueta)} · ${esc(nombre)}</small></div>
        ${reales ? abanicoAsesores(q, reales, t) : `<div class="pk-abanico">
          ${dorsoCartaMini(q).replace('pk-mini dorso', 'pk-mini dorso izq')}${dorsoCartaMini(q).replace('pk-mini dorso', 'pk-mini dorso der')}
          <div class="pk-mini frente"><i class="pk-media">??</i>${SILUETA_CARTA}<i class="pk-nombre">¿Quién será?</i>
            <i class="pk-stats"><i>?? DIG</i><i>?? COT</i><i>?? REA</i><i>?? COM</i></i></div>
        </div>`}
        <div class="pk-gemas"><i class="g-bronce"></i><i class="g-plata"></i><i class="g-oro"></i><i class="g-leyenda"></i></div>
        <div class="pk-titulo"><b>${esc(edicion)}</b><small>3 cartas por sobre</small></div>
        <i class="pack-holo"></i><i class="pk-bandas"></i><i class="pk-almohada"></i><i class="pk-reflejo"></i>
        <i class="pk-prensa abajo"></i><i class="pk-boca"></i><i class="pk-rasgon"></i>
      </div>
      ${['suelta', 'pegada'].map((c) => `<div class="pk-tira ${c}"><div class="pk-tira-in"><i class="pk-tira-fondo"></i><i class="pk-prensa arriba"></i><i class="pk-rasgon"></i></div></div>`).join('')}
      <i class="pk-corte"><i class="pk-corte-guia"></i><i class="pk-corte-luz"></i><i class="pk-corte-chispa"></i></i>
      <i class="pk-haz"></i>
    </div>`;
}
// el sobre se inclina siguiendo el dedo / el raton (y vuelve a mecerse solo al soltarlo); en Android tambien al
// mover el telefono (sin pedir permiso), como las cartas
function inclinarSobre(el) {
  const pk = el.querySelector('.pk');
  if (!pk || Juego.reducido?.()) return;
  const lim = (v) => Math.max(-1, Math.min(1, v));
  const mover = (ev) => {
    if (el.dataset.rasgando) return;
    const r = el.getBoundingClientRect();
    const x = lim(((ev.clientX - r.left) / r.width) * 2 - 1);
    const y = lim(((ev.clientY - r.top) / r.height) * 2 - 1);
    pk.classList.add('tocando');
    pk.style.setProperty('--rx', `${x * 22}deg`); pk.style.setProperty('--ry', `${-y * 16}deg`);
    pk.style.setProperty('--px', x.toFixed(3)); pk.style.setProperty('--py', y.toFixed(3));
  };
  const soltar = () => { pk.classList.remove('tocando'); for (const v of ['--rx', '--ry', '--px', '--py']) pk.style.removeProperty(v); };
  el.addEventListener('pointermove', mover);
  el.addEventListener('pointerdown', mover);
  el.addEventListener('pointerleave', soltar);
  el.addEventListener('pointerup', (ev) => { if (ev.pointerType !== 'mouse') soltar(); });
  if (inclinarSobre.giro || !('DeviceOrientationEvent' in window) || typeof DeviceOrientationEvent.requestPermission === 'function'
    || !window.matchMedia('(pointer: coarse)').matches) return;
  inclinarSobre.giro = true;
  let base = null;
  window.addEventListener('deviceorientation', (ev) => {
    if (ev.gamma == null || ev.beta == null) return;
    if (!base) base = { g: ev.gamma, b: ev.beta };
    base.g += (ev.gamma - base.g) * 0.03; base.b += (ev.beta - base.b) * 0.03;
    const p = document.querySelector('#sobre:not([data-rasgando]) .pk:not(.tocando), .ts-paquete.al-centro .pk:not(.tocando)');
    if (!p) return;
    const x = lim((ev.gamma - base.g) / 18), y = lim((ev.beta - base.b) / 18);
    if (!p.classList.contains('giro') && Math.abs(x) + Math.abs(y) < 0.08) return;
    p.classList.add('giro');
    p.style.setProperty('--rx', `${x * 20}deg`); p.style.setProperty('--ry', `${-y * 14}deg`);
    p.style.setProperty('--px', x.toFixed(3)); p.style.setProperty('--py', y.toFixed(3));
  });
}

/* ============================================================ SOBRES: uno por edicion (trimestre), como en Pokemon TCG Pocket.
   Deslizas entre los sobres de cada edicion, ves tu avance y abres uno gratis (de las misiones) o lo compras. */
async function tiendaSobres(cont, inicial) {
  if (!esAsesor()) return;
  let e;
  try { e = await api('/api/ediciones'); } catch (err) { toast(err.message, true); return; }
  const eds = e.ediciones, sb = e.sobres;
  for (const x of eds) portadas[x.clave] = x.portada || [];
  let i = Math.max(0, eds.findIndex((x) => x.clave === inicial));
  const velo = document.createElement('div');
  velo.className = 'velo velo-sobres';
  velo.innerHTML = `<div class="tienda-sobres">
    <div class="ts-cab"><h2>Elige un sobre</h2><button class="hud-btn" data-cerrar aria-label="Cerrar">${ic('cerrar')}</button></div>
    <p class="ts-gratis">${sb.disponibles ? `${ic('regalo')}Tienes <b>${sb.disponibles}</b> sobre${sb.disponibles === 1 ? '' : 's'} gratis: ábrelo en la edición que quieras`
      : 'Gana sobres gratis cumpliendo tus 3 misiones del día'}</p>
    <div class="ts-carrusel" id="ts-car">${eds.map((x, k) => `<div class="ts-paquete" data-k="${k}">
      <div class="sobre pack ed-${x.q}">${arteSobre(x.q, x.edicion, x.nombre, x.actual ? 'Nueva edición' : 'Edición', x)}</div></div>`).join('')}</div>
    <div class="ts-puntos">${eds.map((_, k) => `<i data-k="${k}"></i>`).join('')}</div>
    <div class="ts-info" id="ts-info"></div>
  </div>`;
  document.body.appendChild(velo);
  fotosPendientes(velo);
  $$('.sobre.pack', velo).forEach(inclinarSobre);
  const car = $('#ts-car', velo);
  function info() {
    const x = eds[i];
    $$('.ts-paquete', velo).forEach((p) => p.classList.toggle('al-centro', +p.dataset.k === i));
    $$('.ts-puntos i', velo).forEach((p) => p.classList.toggle('on', +p.dataset.k === i));
    $('#ts-info', velo).innerHTML = `<div class="ts-avance"><span>${esc(x.edicion)} · ${esc(x.nombre)}</span><b>${x.tengo}/${x.total}</b></div>
      <div class="barra-fina"><i style="width:${x.total ? Math.round((100 * x.tengo) / x.total) : 0}%"></i></div>
      <small class="muted">${x.actual ? 'La edición más nueva: trae a quienes vendieron ese trimestre. La siguiente sale cuando termine el trimestre.' : 'Edición pasada: trae a quienes estaban ese trimestre.'}</small>
      <div class="ts-botones">
        <button class="b3 oro" id="ts-abrir" ${sb.disponibles ? '' : 'disabled'}>${ic('sobre')}Abrir gratis${sb.disponibles ? ` (${sb.disponibles})` : ''}</button>
        <button class="b3 azul" id="ts-comprar">Comprar ${coin()}${nf.format(x.precio)}</button></div>`;
    $('#ts-abrir', velo).onclick = () => abrirDeEdicion(false);
    $('#ts-comprar', velo).onclick = async () => { if (await confirmarCompra(`Sobre ${x.edicion}`, x.precio, 'rara')) abrirDeEdicion(true); };
  }
  let abriendo = false;   // dos toques rapidos no abren dos sobres
  async function abrirDeEdicion(comprar) {
    if (abriendo) return;
    abriendo = true;
    let d;
    try { d = await api(`/api/cartas?trimestre=${eds[i].clave}`); } catch (err) { abriendo = false; toast(err.message, true); return; }
    velo.remove();
    S.albumEdicion = eds[i].clave;
    abrirSobre(comprar, d, cont);
  }
  // deslizar: el sobre que queda al centro es el elegido
  let t = null;
  car.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const c = car.scrollLeft + car.clientWidth / 2;
      const k = [...car.children].reduce((m, el, n) => (Math.abs(el.offsetLeft + el.offsetWidth / 2 - c) < Math.abs(car.children[m].offsetLeft + car.children[m].offsetWidth / 2 - c) ? n : m), 0);
      if (k !== i) { i = k; info(); Juego.Sonido.swoosh(); }
    }, 90);
  });
  car.addEventListener('click', (ev) => {
    const p = ev.target.closest('.ts-paquete');
    if (!p) return;
    if (+p.dataset.k === i) { if (sb.disponibles) abrirDeEdicion(false); return; }
    p.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
  velo.addEventListener('click', (ev) => { if (ev.target === velo || ev.target.closest('[data-cerrar]')) velo.remove(); });
  info();
  requestAnimationFrame(() => car.children[i]?.scrollIntoView({ inline: 'center', block: 'nearest' }));
}

/* ============================================================ ABRIR UN SOBRE (v5, como Pokemon TCG Pocket)
   1) el sobre se presenta y se mece; 2) deslizas el dedo de lado a lado sobre la linea de arriba: una linea de luz
   sigue al dedo y al terminar la tira se arranca y sale volando; 3) el sobre cae y deja la pila de cartas boca abajo;
   4) la carta de arriba se voltea sola (las de oro y diamante se hacen esperar: tiemblan y brillan por las orillas) y
   la avientas de lado con el dedo (o la tocas) para ver la siguiente; 5) al final, todas juntas.
   Se puede saltar en cualquier momento; si no deslizas en unos segundos aparece el boton "Abrir".
   Solo transform/opacity en la animacion; la API y el orden (de menor a mayor nivel) son los de siempre. */
async function abrirSobre(comprar, d, cont) {
  if (!esAsesor() || abrirSobre.ocupada) return;
  let r;
  abrirSobre.ocupada = true;
  try { r = await api('/api/sobre', { method: 'POST', body: JSON.stringify({ comprar, trimestre: d.trimestre.clave }) }); }
  catch (e) { toast(e.message, true); return; }
  finally { abrirSobre.ocupada = false; }
  // De menor a mayor nivel (como OrdenarParaRevelar de MNGameCenter): son las mismas cartas, pero
  // cada una sube respecto a la anterior y la ultima siempre es la mejor del sobre.
  const cartas = [...r.cartas].sort((a, b) => (ORDEN_CARTA[a.nivel] ?? 0) - (ORDEN_CARTA[b.nivel] ?? 0));
  const n = cartas.length;
  const mejor = n ? cartas[n - 1].nivel : 'bronce';
  const q = d.trimestre.q;
  const tinte = { 1: '#8fe3ff', 2: '#b4f59a', 3: '#ffc06b', 4: '#afc5f8' }[q] || '#fff3b0';
  const Son = Juego.Sonido, fx = window.CartasFX;
  const sinMov = fx?.reducido() ?? Juego.reducido();
  const insignia = (f, corto = false) => (f.propia ? '<span class="nueva">¡Tu carta!</span>' : esIcono(f) && f.nueva ? '<span class="nueva ic-nueva">¡Carta Ícono!</span>' : f.nueva ? '<span class="nueva">¡Nueva!</span>'
    : `<span class="repetida">${corto ? 'Repetida' : 'Repetida · para cambiar'}</span>`);
  const velo = document.createElement('div');
  velo.className = 'velo velo-sobre sp5';
  // la pila va al reves: la primera que se revela queda hasta arriba
  velo.innerHTML = `<div class="sp-escena carga-${mejor}" style="--fx-tinte:${tinte}">
    <div class="sp-barra"><span class="sp-cuenta" hidden></span><button class="sp-saltar" id="sp-saltar">Saltar ${ic('flecha')}</button></div>
    <div class="sp-centro">
      <div class="sp-pila" hidden style="--k:0">${cartas.map((f, i) => ({ f, i })).reverse().map(({ f, i }) => `<div class="sp-carta n-${f.nivel}" data-i="${i}" style="--i:${i}">
        <div class="sp-gira"><div class="sp-cara sp-atras dorso-mn">${DORSO_MN}</div><div class="sp-cara sp-frente">${cartaHTML(f, d)}${insignia(f)}</div></div></div>`).join('')}</div>
      <button class="sobre pack ed-${q}" id="sobre" aria-label="Sobre de cartas: desliza el dedo sobre la línea de arriba para abrirlo">${arteSobre(q, d.trimestre.edicion, d.trimestre.nombre, 'Edición', d.trimestre)}</button>
    </div>
    <div class="sp-pie">
      <p class="sp-pista" id="sp-pista"><span>Desliza el dedo sobre la línea para abrir</span></p>
      <button class="b3 oro sp-abrir" id="sp-abrir" hidden>${ic('sobre')}Abrir</button>
      <button class="b3 chico sp-compartir" id="sp-compartir" hidden>${ic('compartir')}Presumir esta carta</button>
    </div>
    <div class="sp-resumen" hidden></div></div>`;
  document.body.appendChild(velo);
  fotosPendientes(velo);
  const escena = $('.sp-escena', velo), sobre = $('#sobre', velo), pk = $('.pk', sobre), pila = $('.sp-pila', velo);
  const pista = $('#sp-pista', velo), bAbrir = $('#sp-abrir', velo), cuenta = $('.sp-cuenta', velo), bPresumir = $('#sp-compartir', velo);
  // las cartas NUEVAS se pueden presumir en cuanto dan la cara (las de oro para arriba con el boton dorado)
  const presumible = (f) => f && f.nueva && puedeCompartirCarta(f, d);
  bPresumir.onclick = (ev) => { ev.stopPropagation(); if (presumible(cartas[k])) hojaCompartirCarta(cartas[k], d); };
  const vs = $$('.sp-carta', velo).sort((a, b) => a.dataset.i - b.dataset.i);   // vs[k] es cartas[k]
  inclinarSobre(sobre);
  velo.addEventListener('dragstart', (ev) => ev.preventDefault());   // las fotos no se arrastran: el dedo mueve la carta
  Son.revelar();
  let fase = 'sobre';   // sobre -> rasgando -> cartas -> resumen
  const vivo = () => fase !== 'resumen' && velo.isConnected;
  const decir = (txt) => { pista.hidden = !txt; if (txt) { pista.firstElementChild.textContent = txt; pista.classList.remove('entra'); void pista.offsetWidth; pista.classList.add('entra'); } };

  /* ---------- 1-2) rasgar la tira con el dedo. El avance es la posicion del dedo sobre la linea: lo ya rasgado se
     levanta y gira sobre el punto donde sigue pegada; si sueltas a medias se queda colgando de ese punto (con un
     vaiven de gravedad) y al volver a deslizar sigue desde ahi. Solo al llegar a la otra orilla se suelta y cae. */
  let tAyuda = setTimeout(() => { if (fase === 'sobre') bAbrir.hidden = false; }, 3500);
  let gesto = null, prog = 0, dir = 0, tic = 0, arrastro = false;
  const corte = (p, xpx) => {
    pk.style.setProperty('--corte', p.toFixed(3));
    if (xpx != null) pk.style.setProperty('--cx', `${xpx.toFixed(1)}px`);
  };
  // la parte suelta de la tira (de la orilla donde empezaste hasta el dedo) y la que sigue pegada
  const tira = (p) => {
    const a = (p * 100).toFixed(2), b = ((1 - p) * 100).toFixed(2);
    pk.style.setProperty('--clip-s', dir > 0 ? `inset(0 ${b}% 0 0)` : `inset(0 0 0 ${b}%)`);
    pk.style.setProperty('--clip-p', dir > 0 ? `inset(0 0 0 ${a}%)` : `inset(0 ${a}% 0 0)`);
    pk.style.setProperty('--piv', `${dir > 0 ? a : b}% 10%`);
    pk.style.setProperty('--mask-r', dir > 0 ? `linear-gradient(90deg, #000 ${a}%, #0000 ${a}%)` : `linear-gradient(90deg, #0000 ${b}%, #000 ${b}%)`);
    pk.style.setProperty('--ang', `${(dir * (6 + p * 24)).toFixed(2)}deg`);          // levantada mientras jalas
    pk.style.setProperty('--caer', `${(-dir * (10 + p * 14)).toFixed(2)}deg`);       // colgando al soltar
  };
  const empezar = (d) => {
    dir = d; sobre.dataset.rasgando = '1'; pk.classList.remove('tocando', 'giro'); pk.classList.add('rasgando');
    pk.style.setProperty('--corte-o', dir > 0 ? 'left' : 'right'); pk.style.setProperty('--dir', dir);
  };
  const avanzar = (p, anchoPx) => {
    if (p <= prog) return;
    prog = p; pk.classList.remove('colgando');
    zumbido(prog); tira(prog);
    corte(prog, (dir > 0 ? prog : 1 - prog) * anchoPx);
  };
  const zumbido = (hasta) => {   // la cremallera de papel sigue al dedo
    while (tic < hasta - 0.06) { tic += 0.06; Son.golpeRuido?.(0, 0.03, 0.045, { tipo: 'bandpass', f: 1600 + tic * 3400, q: 2, pan: dir * (tic - 0.5) }); }
  };
  sobre.addEventListener('pointerdown', (ev) => {
    if (fase !== 'sobre') return;
    Son.init?.();
    const rc = sobre.getBoundingClientRect();
    if ((ev.clientY - rc.top) / rc.height > 0.45) return;   // abajo solo se inclina
    gesto = { x: ev.clientX, rc, id: ev.pointerId };
    try { sobre.setPointerCapture(ev.pointerId); } catch { /* sin captura */ }
  });
  sobre.addEventListener('pointermove', (ev) => {
    if (!gesto || ev.pointerId !== gesto.id || fase !== 'sobre') return;
    const { rc } = gesto, dx = ev.clientX - gesto.x;
    if (!dir) {
      if (Math.abs(dx) < 10) return;
      empezar(dx > 0 ? 1 : -1);
      Son.soplo?.(0, 0.25, true);
    }
    arrastro = true;
    clearTimeout(tAyuda); decir(''); bAbrir.hidden = true;
    const f = Math.max(0, Math.min(1, (ev.clientX - rc.left) / rc.width));
    avanzar(dir > 0 ? f : 1 - f, rc.width / (parseFloat(getComputedStyle(sobre).scale) || 1));
    if (prog >= 0.96) completar();
  });
  const soltarGesto = (ev) => {
    if (!gesto || ev.pointerId !== gesto.id) return;
    gesto = null;
    if (fase !== 'sobre' || !dir || !prog) return;
    // a medias: la tira se queda colgando de donde llego; nada se regresa ni se completa solo
    pk.classList.add('colgando');
    decir('Sigue deslizando hasta la otra orilla');
    clearTimeout(tAyuda); tAyuda = setTimeout(() => { if (fase === 'sobre') bAbrir.hidden = false; }, 3500);
  };
  sobre.addEventListener('pointerup', soltarGesto);
  sobre.addEventListener('pointercancel', soltarGesto);
  // un toque (o Enter) no abre: avisa como y deja a la mano el boton "Abrir"
  sobre.addEventListener('click', () => {
    if (arrastro) { arrastro = false; return; }
    if (fase !== 'sobre') return;
    bAbrir.hidden = false; decir('Desliza sobre la línea… o toca «Abrir»');
    pk.classList.remove('avisa'); void pk.offsetWidth; pk.classList.add('avisa');
  });
  // boton "Abrir": la linea se traza sola (desde donde se haya quedado)
  bAbrir.onclick = async () => {
    if (fase !== 'sobre') return;
    bAbrir.hidden = true; decir('');
    if (!dir) { empezar(1); Son.soplo?.(0, 0.25, true); }
    const w = sobre.offsetWidth, t0 = performance.now(), desde = prog, dur = sinMov ? 1 : 420 * (1 - desde) + 60;
    await new Promise((fin) => {
      const paso = (t) => {
        const p = Math.min(1, desde + (1 - desde) * ((t - t0) / dur));
        avanzar(p, w);
        if (p < 1) requestAnimationFrame(paso); else fin();
      };
      requestAnimationFrame(paso);
    });
    completar();
  };

  /* ---------- 3) se arranca la tira, salen las cartas y el sobre cae */
  async function completar() {
    if (fase !== 'sobre') return;
    fase = 'rasgando'; clearTimeout(tAyuda); gesto = null;
    bAbrir.hidden = true; decir('');
    if (!dir) dir = 1;
    corte(1); tira(1); pk.classList.remove('colgando');
    // la tira se suelta: una copia fija en la pantalla (para que no se vaya con el sobre) cae con gravedad
    if (!sinMov) {
      const rc = sobre.getBoundingClientRect(), esc = parseFloat(getComputedStyle(sobre).scale) || 1;
      const cae = document.createElement('div');
      cae.className = `sobre pack ed-${q} sp-tira-cae`;
      cae.style.cssText = `left:${(rc.left + rc.width / 2 - 105).toFixed(1)}px;top:${(rc.top + rc.height / 2 - 155).toFixed(1)}px;scale:${esc};--dir:${dir};--clip-s:inset(0)`;
      cae.innerHTML = `<div class="pk">${$('.pk-tira.suelta', pk).outerHTML}</div>`;
      velo.appendChild(cae);
      cae.addEventListener('animationend', () => cae.remove());
      setTimeout(() => cae.remove(), 4000);
    }
    sobre.classList.add('rasgado');
    Son.rasgar?.(); Son.abrir(); Juego.vibrar([20, 30, 60]);
    // la pila sigue escondida dentro hasta que la tira ya se solto; luego sube por la boca rasgada
    await espera(sinMov ? 0 : 380);
    if (!vivo()) return;
    pila.hidden = false; void pila.offsetWidth; escena.classList.add('abierto'); Son.swoosh();
    await espera(sinMov ? 0 : 700);
    if (!vivo()) return;
    escena.classList.add('salen');
    await espera(sinMov ? 0 : 820);
    if (!vivo()) return;
    sobre.hidden = true;
    fase = 'cartas'; cuenta.hidden = false;
    siguiente();
  }

  /* ---------- 4) una por una */
  let k = 0, lista = false, prisa = false;
  const pausa = (ms) => espera(prisa || sinMov ? Math.min(ms, 120) : ms);
  async function siguiente() {
    if (!vivo()) return;
    if (k >= n) { resumen(); return; }
    const c = vs[k], f = cartas[k];
    pila.style.setProperty('--k', k);
    cuenta.textContent = `${k + 1} de ${n}`;
    lista = false; prisa = false;
    await voltear(c, f);
    if (!vivo()) return;
    lista = true;
    decir(k === n - 1 ? 'Desliza para ver todas' : 'Desliza para ver la siguiente');
    if (presumible(f)) { bPresumir.classList.toggle('oro', ORDEN_CARTA[f.nivel] >= 2); bPresumir.classList.toggle('blanco', ORDEN_CARTA[f.nivel] < 2); bPresumir.hidden = false; }
  }
  async function voltear(c, f) {
    const carta = $('.carta', c);
    if (esIcono(f)) { await revelarIcono(c, f, carta); return; }
    if ((f.nivel === 'oro' || f.nivel === 'leyenda') && !sinMov) {
      // se hace esperar: el reverso tiembla y brilla por las orillas (lo que anuncia es lo que da)
      const seg = f.nivel === 'leyenda' ? 1.3 : 0.8;
      c.classList.add('carga'); escena.classList.add('tension');
      Son.sobreCarga?.(seg, f.nivel); Juego.vibrar(f.nivel === 'leyenda' ? [15, 60, 15, 60, 25] : [12, 50, 12]);
      await pausa(seg * 1000);
      c.classList.remove('carga');
      if (!vivo()) return;
    } else await pausa(k ? 160 : 260);
    c.classList.add('vuelta'); Son.pop?.();
    // el brillo del nivel aparece cuando la carta ya da la cara, nunca antes (AUDIO-Y-FEEDBACK §4.5)
    await espera(sinMov ? 0 : 280);
    if (!vivo()) return;
    if (f.nivel === 'leyenda') {
      escena.classList.add('luz'); Son.cartaVoltea?.('leyenda');
      fx?.rafaga(tinte, velo); fx?.sacudir(pila); fx?.chispas(carta, 18, tinte);
      Juego.celebrar('legendaria'); Juego.estrellas(carta, 20, tinte); Juego.vibrar([30, 40, 80]);
      Juego.confeti({ cantidad: 160, origenY: 0.08, fuerza: 1 });   // desde arriba: que no tape la cara
      c.classList.add('fx-flash');
      await pausa(1400);
      escena.classList.remove('tension', 'luz');
    } else if (f.nivel === 'oro') {
      escena.classList.remove('tension');
      c.classList.add('fx-flash'); fx?.chispas(carta, 12, '#ffe27a'); fx?.destello(carta);
      Son.cartaVoltea?.('oro'); Son.exito?.(0.1); Juego.estrellas(carta, 12, '#ffe27a'); Juego.vibrar(25);
      Juego.confeti({ cantidad: 70, origenY: 0.12, fuerza: 0.8 });
      await pausa(700);
    } else if (f.nivel === 'plata') {
      fx?.destello(carta); Son.cartaVoltea?.('plata'); Juego.vibrar(12);
      await pausa(380);
    } else {
      Son.cartaVoltea?.('bronce'); Juego.vibrar(8);
      await pausa(240);
    }
    if (f.nueva) setTimeout(() => Son.palmada(), sinMov ? 0 : 120);
  }
  /* la carta ICONO tiene su propio momento (mas fuerte que el de Diamante): la pantalla se apaga, el reverso late
     con luz de oro cada vez mas rapido (2.6 s), se voltea con una explosion dorada, rayos que giran detras,
     el letrero "¡CARTA ÍCONO!", fuegos artificiales y su sonido (el de leyenda + fanfarria y campanas). */
  async function revelarIcono(c, f, carta) {
    const seg = 2.6;
    if (!sinMov) {
      c.classList.add('carga', 'carga-icono'); escena.classList.add('tension', 'tension-icono');
      decir('Algo muy especial viene…');
      Son.sobreCarga?.(seg, 'icono'); Juego.vibrar([20, 120, 20, 100, 25, 80, 30, 60, 40]);
      await pausa(seg * 1000);
      c.classList.remove('carga', 'carga-icono'); decir('');
      if (!vivo()) return;
    }
    c.classList.add('vuelta'); Son.pop?.();
    await espera(sinMov ? 0 : 420);
    if (!vivo()) return;
    escena.classList.add('luz', 'luz-icono'); c.classList.add('fx-flash');
    Son.icono?.();
    fx?.rafaga('#ffd65a', velo); setTimeout(() => vivo() && fx?.rafaga('#fff3c4', velo), 380);
    fx?.sacudir(pila); fx?.chispas(carta, 18, '#ffd65a'); setTimeout(() => vivo() && fx?.chispas(carta, 18, '#ffffff'), 450);
    Juego.estrellas(carta, 24, '#ffd65a'); Juego.vibrar([40, 40, 120]);
    Juego.letrero?.('¡CARTA ÍCONO!', 'La más top de las tops', '#ffd65a');
    Juego.confeti({ cantidad: 200, origenY: 0.06, fuerza: 1.1, duracion: 3400 });
    setTimeout(() => vivo() && Juego.fuegos?.({ n: 7, dur: 3600, colores: ['#ffd65a', '#fff3c4', '#ff9ccf', '#8fd8ff', '#ffffff'] }), 700);
    await pausa(2800);
    escena.classList.remove('tension', 'tension-icono', 'luz');
    if (f.nueva) setTimeout(() => Son.palmada(), sinMov ? 0 : 120);
  }
  // la de arriba se avienta de lado (sigue al dedo y gira un poco); un toque tambien la pasa
  let arr = null;
  pila.addEventListener('pointerdown', (ev) => {
    if (fase !== 'cartas') return;
    if (!lista) { prisa = true; return; }   // tocar mientras se voltea acelera
    arr = { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId, dx: 0, dy: 0 };
    try { pila.setPointerCapture(ev.pointerId); } catch { /* sin captura */ }
    vs[k].classList.add('arrastra');
  });
  pila.addEventListener('pointermove', (ev) => {
    if (!arr || ev.pointerId !== arr.id) return;
    arr.dx = ev.clientX - arr.x; arr.dy = ev.clientY - arr.y;
    vs[k].style.transform = `translate(${arr.dx.toFixed(1)}px, ${(arr.dy * 0.45).toFixed(1)}px) rotate(${(arr.dx * 0.07).toFixed(2)}deg)`;
  });
  const soltarCarta = (ev) => {
    if (!arr || ev.pointerId !== arr.id) return;
    const { dx, dy, t } = arr; arr = null;
    const c = vs[k]; c.classList.remove('arrastra');
    const v = Math.abs(dx) / Math.max(1, performance.now() - t);
    const toque = Math.abs(dx) < 8 && Math.abs(dy) < 8;
    if (toque || Math.abs(dx) > 70 || v > 0.55) despachar(c, toque ? -1 : Math.sign(dx), toque ? 0 : dy);
    else c.style.transform = '';
  };
  pila.addEventListener('pointerup', soltarCarta);
  pila.addEventListener('pointercancel', soltarCarta);
  function despachar(c, lado, dy) {
    if (!lista) return;
    lista = false; decir(''); bPresumir.hidden = true;
    c.classList.add('ida');
    c.style.transform = `translate(${lado * 115}vw, ${(dy * 0.8 - 60).toFixed(0)}px) rotate(${lado * 32}deg)`;
    Son.swoosh(); Juego.vibrar(8);
    setTimeout(() => { c.hidden = true; }, 520);
    k++;
    siguiente();
  }
  // teclado: Enter / espacio / flechas pasan la carta
  velo.addEventListener('keydown', (ev) => {
    if (fase === 'cartas' && lista && ['Enter', ' ', 'ArrowLeft', 'ArrowRight'].includes(ev.key)) { ev.preventDefault(); despachar(vs[k], ev.key === 'ArrowRight' ? 1 : -1, 0); }
  });

  /* ---------- 5) todas juntas */
  function resumen(saltado = false) {
    if (fase === 'resumen') return;
    fase = 'resumen'; clearTimeout(tAyuda);
    for (const el of [sobre, pila, cuenta, pista, bAbrir, bPresumir, $('#sp-saltar', velo)]) el.hidden = true;
    escena.classList.remove('tension', 'luz'); escena.classList.add('final');
    const nuevas = cartas.filter((f) => f.nueva).length;
    const estrella = [...cartas].reverse().find((f) => presumible(f) && ORDEN_CARTA[f.nivel] >= 2);   // la mejor nueva, de oro para arriba
    const res = $('.sp-resumen', velo);
    res.innerHTML = `<h2>${mejor === 'icono' ? '¡Te salió la carta Ícono!' : '¡Sobre abierto!'}</h2>
      <p>${nuevas ? `${nuevas === 1 ? 'Una carta nueva' : `${nuevas} cartas nuevas`} para tu álbum` : 'Todas repetidas: úsalas para cambiar con tus compañeros'}</p>
      <div class="sp-rejilla">${cartas.map((f, i) => `<div class="sp-mini n-${f.nivel}" style="--i:${i}"><div class="sp-escala">${cartaHTML(f, d, { chica: true })}</div>${insignia(f, true)}${
        presumible(f) ? `<button class="sp-mini-compartir" data-i="${i}" aria-label="Presumir la carta de ${esc(dosNombres(f.nombre))}">${ic('compartir')}</button>` : ''}</div>`).join('')}</div>
      ${estrella ? `<button class="b3 oro sp-presumir" id="b-presumir-carta">${ic('compartir')}Presumir mi ${esc(NIVEL_CARTA[estrella.nivel] || 'carta')}</button>` : ''}
      <button class="b3 verde" id="b-listo">¡A mi álbum!</button>`;
    res.hidden = false;
    fotosPendientes(res);
    Son.listo?.(0.05);
    if (saltado && mejor === 'icono') {
      Son.icono?.(); fx?.rafaga('#ffd65a', velo); Juego.confeti({ cantidad: 180, origenY: 0.1, fuerza: 1 });
    } else if (saltado && (mejor === 'leyenda' || mejor === 'oro')) {
      Son.cartaVoltea?.(mejor); Juego.confeti({ cantidad: mejor === 'leyenda' ? 140 : 60, origenY: 0.1, fuerza: 0.9 });
    }
    $('#b-listo', res).onclick = () => { velo.remove(); pintarAlbum(cont); };
    $$('.sp-mini-compartir', res).forEach((b) => (b.onclick = () => hojaCompartirCarta(cartas[+b.dataset.i], d)));
    const bp = $('#b-presumir-carta', res); if (bp) bp.onclick = () => hojaCompartirCarta(estrella, d);
    $('#b-listo', res).focus({ preventScroll: true });
  }
  $('#sp-saltar', velo).onclick = () => { Son.swoosh(); resumen(true); };
}

async function pintarCuartos(cont) {
  const d = await api('/api/cuartos');
  cont.innerHTML = `<p class="muted nota-tienda">Visita los cuartos de tus compañeros y dale corazón a los que más te gusten (uno por día a cada quien).</p>
    <div class="lista-cuartos">${d.filas.map((f, i) => `<button class="fila-cuarto ${f.codigo === d.yo ? 'yo' : ''}" data-c="${esc(f.codigo)}">
      <span class="pos num">${i + 1}</span>${caraDe(f.mascota, 44, 'mini-mascota', f.nombre)}
      <span class="txt"><b>${esc(dosNombres(f.nombre))}</b><small>${esc(tiendaNombre(f.tienda))} · ${f.coleccion}/${f.total} objetos${f.joya ? ` · ${esc(f.joya.nombre)}` : ''}</small></span>
      <span class="likes ${f.di_like ? 'dado' : ''}">${ic('corazon')}${f.likes}</span></button>`).join('')}</div>`;
  fotosPendientes(cont);
  $$('[data-c]', cont).forEach((x) => (x.onclick = () => { S.visitando = x.dataset.c; irA('cuarto'); }));
}

/* ============================================================ CASAS de los compañeros (Equipo > Ciudad): la foto 3D
   del cuarto de cada quien con su mascota adentro, por gremio. (El mapa ilustrado de la ciudad quedo en archivo/ciudad.) */
const NOMBRE_ZONA = { pisos: 'Cerámica', pintura: 'Pintura', plomeria: 'Plomería', ferreteria: 'Ferretería', obra: 'Obra Negra' };
function htmlCorazones(c) {
  const quedan = Math.max(0, c.tope - c.dados);
  return `<span class="corazones-dia ${quedan ? '' : 'sin'}">${Array.from({ length: c.tope }, (_, i) => `<i class="${i < quedan ? 'lleno' : ''}">${ic('corazon')}</i>`).join('')}
    <small>${quedan ? `Te ${quedan === 1 ? 'queda' : 'quedan'} ${quedan} hoy · +${c.puntos} al dueño` : 'Mañana tienes más'}</small></span>`;
}
const chipsCiudades = (d) => `<div class="chips-scroll ciudades">${d.ciudades.map((c) => `<button data-ciudad="${esc(c.tienda)}" class="${c.tienda === d.tienda ? 'activo' : ''}">${esc(tiendaNombre(c.tienda))}<small>${c.asesores}</small></button>`).join('')}</div>`;

/* ---------- la ciudad se abre en pantalla completa, encima de lo que estabas viendo. `desde` = punto de la pantalla
   de donde sale la transicion (la ventana del cuarto); sin el, sale del centro */

// en la pestaña del equipo: el listado de casas (al mapa de la ciudad se sale por la ventana del cuarto): la foto 3D del cuarto de cada compañero con su mascota adentro, por gremio
function pintarEntradaCiudad(cont) {
  cont.innerHTML = `<div id="lc-cuerpo"><div class="lc-rejilla">${'<div class="sk lc-sk"></div>'.repeat(4)}</div></div>`;
  pintarListaCasas($('#lc-cuerpo', cont)).catch((e) => { const c = $('#lc-cuerpo', cont); if (c) c.innerHTML = vacio('No se pudieron cargar las casas', e.message, 'aviso'); });
}

async function pintarListaCasas(cuerpo) {
  const d = await api('/api/ciudad' + (S.ciudad ? `?tienda=${encodeURIComponent(S.ciudad)}` : ''));
  if (!cuerpo.isConnected) return;
  S.ciudad = d.tienda;
  // primero mi gremio y mi casa; luego los demas gremios, cada uno con sus casas por corazones
  const grupos = d.edificios.filter((e) => e.casitas.length).map((e) => ({ gremio: e.gremio,
    casas: [...e.casitas].sort((a, b) => (b.es_mio - a.es_mio) || (b.likes - a.likes) || String(a.nombre).localeCompare(b.nombre)) }))
    .sort((a, b) => (b.casas[0].es_mio - a.casas[0].es_mio) || b.casas.length - a.casas.length);
  const total = grupos.reduce((n, g) => n + g.casas.length, 0);
  cuerpo.innerHTML = `${d.ciudades.length > 1 ? chipsCiudades(d) : ''}
    <div class="lc-cab"><div><h2>Casas de ${esc(tiendaNombre(d.tienda))}</h2><small>${nf.format(total)} ${total === 1 ? 'constructor' : 'constructores'} · toca una casa para entrar</small></div>${htmlCorazones(d.corazones)}</div>
    ${grupos.map((g) => `<section class="lc-grupo"><h3 class="lc-gremio"><span>${esc(NOMBRE_ZONA[g.gremio] || g.gremio)}</span><small>${g.casas.length}</small></h3>
      <div class="lc-rejilla">${g.casas.map((c) => `<article class="lc-casa ${c.es_mio ? 'mio' : ''}" data-casa="${esc(c.codigo)}" role="button" tabindex="0" aria-label="Entrar al cuarto de ${esc(dosNombres(c.nombre))}">
        <div class="lc-foto" data-cuarto-de="${esc(c.codigo)}"><span class="lc-espera">${imgFoto({ op: c.mascota }, 240, 'lc-pet')}</span>
          ${c.es_mio ? `<span class="lc-tuya">Tu casa</span>` : ''}</div>
        <div class="lc-pie"><span class="lc-quien"><b>${esc(dosNombres(c.nombre))}</b><small>${esc(nombreDeMascota(c.mascota))}</small></span>
          <button class="cs-corazon ${c.di_like ? 'dado' : ''}" data-corazon="${esc(c.codigo)}" ${c.es_mio || !esAsesor() ? 'disabled' : ''} aria-label="Dar corazón">${ic('corazon')}<span>${nf.format(c.likes)}</span></button></div>
      </article>`).join('')}</div></section>`).join('') || vacio('Aún no hay casas', 'Nadie de esta tienda tiene casa todavía.', 'mapa')}`;
  fotosPendientes(cuerpo);
  $$('[data-ciudad]', cuerpo).forEach((b) => (b.onclick = () => { S.ciudad = b.dataset.ciudad; S.calleGremio = null; pintarListaCasas(cuerpo).catch((e) => toast(e.message, true)); }));
  const entrar = (cod) => { S.visitando = cod; S.volverCiudad = false; Juego.Sonido.swoosh?.(); irA('cuarto'); };
  $$('[data-casa]', cuerpo).forEach((el) => {
    el.onclick = () => entrar(el.dataset.casa);
    el.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); entrar(el.dataset.casa); } };
  });
  $$('[data-corazon]', cuerpo).forEach((b) => (b.onclick = async (ev) => {
    ev.stopPropagation();
    const c = d.edificios.flatMap((e) => e.casitas).find((x) => x.codigo === b.dataset.corazon);
    if (!c || c.di_like) { toast('Ya le diste corazón hoy'); return; }
    try {
      const r = await api('/api/cuarto/like', { method: 'POST', body: JSON.stringify({ para: c.codigo }) });
      c.di_like = true; c.likes = r.likes; if (r.corazones) d.corazones = { ...d.corazones, ...r.corazones };
      b.classList.add('dado', 'rebote'); $('span', b).textContent = nf.format(r.likes);
      Juego.corazones?.(b, 9); Juego.Sonido.aplauso?.(); Juego.vibrar?.([20, 40, 20]);
      const hc = $('.lc-cab .corazones-dia', cuerpo); if (hc) hc.outerHTML = htmlCorazones(d.corazones);
      toast(`¡Le diste un corazón a ${dosNombres(c.nombre).split(' ')[0]}!${d.corazones.puntos ? ` Gana +${d.corazones.puntos}` : ''}`);
    } catch (e) { toast(e.message, true); }
  }));
  const M = await cuandoMonstruos();
  if (!M.disponible || !M.fotoCuarto || !cuerpo.isConnected) return;   // sin 3D: se queda la foto de la mascota
  const cajas = $$('[data-cuarto-de]', cuerpo);
  if (!obsCuartosLista) { colaCuartosLista.push(...cajas); dibujarCuartosLista(M); return; }
  obsCuartosLista.disconnect();   // solo hay un listado a la vez: las casas de antes ya no se vigilan
  colaCuartosLista.length = 0;
  cajas.forEach((x) => obsCuartosLista.observe(x));
}
// fotos de cuartos para el listado: se piden y se dibujan solo las que se ven, una por cuadro, y se guardan en memoria
const cuartosLista = new Map();   // codigo -> { llave, url }
const colaCuartosLista = [];
let dibujandoCuartosLista = false;
const obsCuartosLista = 'IntersectionObserver' in window ? new IntersectionObserver((entradas) => {
  for (const e of entradas) if (e.isIntersecting) { obsCuartosLista.unobserve(e.target); colaCuartosLista.push(e.target); }
  if (colaCuartosLista.length && window.Monstruos) dibujarCuartosLista(window.Monstruos);
}, { rootMargin: '250px' }) : null;
function ponerCuartoLista(caja, url) {
  const img = new Image(); img.className = 'lc-cuarto'; img.alt = ''; img.src = url;
  const poner = () => { if (!caja.isConnected) return; caja.querySelector('.lc-cuarto')?.remove(); caja.prepend(img); caja.classList.add('lista'); };
  if (img.decode) img.decode().then(poner, poner); else poner();
}
async function dibujarCuartosLista(M) {
  if (dibujandoCuartosLista) return;
  dibujandoCuartosLista = true;
  try {
    while (colaCuartosLista.length) {
      const caja = colaCuartosLista.shift();
      if (!caja.isConnected) { obsCuartosLista?.unobserve(caja); continue; }
      const cod = caja.dataset.cuartoDe, mio = !!caja.closest('.lc-casa.mio');
      let ya = cuartosLista.get(cod);
      if (ya) ponerCuartoLista(caja, ya.url);
      if (ya && !mio) continue;   // el mio siempre se revisa (pudo decorarlo hace un momento)
      try {
        const r = await api('/api/cuarto?de=' + encodeURIComponent(cod));
        const op = { mascota: r.mascota, muebles: r.cuarto || {}, posiciones: r.posiciones || {}, pared: r.cuarto?.pared, piso: r.cuarto?.piso };
        const llave = JSON.stringify(op);
        if (ya?.llave === llave) continue;
        await M.cargar?.(r.mascota?.especie);
        await new Promise((ok) => requestAnimationFrame(ok));
        if (!caja.isConnected) continue;   // ya te fuiste de la ciudad: no se dibuja (cada foto cuesta ~0.1 s y trababa la pantalla siguiente)
        const url = M.fotoCuartoSinTrabar ? await M.fotoCuartoSinTrabar(op, 480, 300) : M.fotoCuarto(op, 480, 300);
        ya = { llave, url }; cuartosLista.set(cod, ya);
        if (!caja.isConnected) continue;
        ponerCuartoLista(caja, ya.url);
      } catch { /* sin datos o sin 3D: se queda la mascota */ }
    }
  } finally { dibujandoCuartosLista = false; }
}


/* ============================================================ VISITAR el cuarto de alguien */
async function vistaCuarto() {
  const v = $('#vista');
  const cod = S.visitando;
  if (!cod) return irA('equipo');
  v.innerHTML = `<div class="vista"><div class="sk" style="height:340px;border-radius:24px"></div></div>`;
  let d, cartasD;
  try { [d, cartasD] = await Promise.all([api('/api/cuarto?de=' + encodeURIComponent(cod)), api('/api/cartas')]); }
  catch (e) { v.innerHTML = `<div class="vista">${vacio('No se pudo cargar', e.message, 'aviso')}</div>`; return; }
  const f = cartasD.filas.find((x) => x.codigo === cod);
  const c = d.coleccion;
  v.innerHTML = `<div class="vista inicio">
    <div class="cab-tienda"><button class="atras" id="b-atras" aria-label="Volver">${ic('atras')}</button>
      <div><h1>Cuarto de ${esc(primerNombre(d.asesor.nombre))}</h1><p>${esc(tiendaNombre(d.asesor.tienda))} · ${esc(nombreDeMascota(d.mascota))} nivel ${d.mascota.nivel}</p></div></div>
    <section class="cuarto-hero"><div class="cuarto-3d" id="cuarto-3d"></div>
      <button class="lupa" id="b-lupa-v" aria-label="Acercarme a su mascota">${ic('buscar')}</button>
      <div class="cuarto-top"><span class="chip-nombre">${c.tengo}/${c.total} objetos</span>
        <button class="chip-likes boton ${d.di_like ? 'dado' : ''}" id="b-like" ${d.es_mio || !esAsesor() ? 'disabled' : ''}>${ic('corazon')}<span>${nf.format(d.likes)}</span></button></div></section>
    ${c.joyas.length ? `<div class="seccion"><div class="seccion-cab">${ic('estrella')}<h2>Sus joyas</h2></div>
      <div class="joyas">${c.joyas.map((x) => `<div class="joya r-${x.rareza}">${imgFoto(['monstruo', 'pelaje', 'ojos'].includes(x.tipo) ? { op: joyaOp(d.mascota, x) } : { objeto: x.tipo, clave: x.clave }, 64)}
        <b>${esc(x.nombre)}</b><small>${RAREZA_TXT[x.rareza]}${x.limitada ? ' · limitada' : ''}</small></div>`).join('')}</div></div>` : ''}
    ${f ? `<div class="seccion"><div class="seccion-cab">${ic('cartas')}<h2>Su carta</h2></div><div class="carta-centro">${cartaHTML(f, cartasD, { oculta: !f.tengo })}</div>
      ${f.tengo ? '' : '<p class="muted nota-tienda">Aún no tienes su carta: sale en los sobres.</p>'}</div>` : ''}
  </div>`;
  fotosPendientes(v);
  $('#b-atras').onclick = () => { S.equipoTab = 'cuartos'; irA('equipo'); };
  const bl = $('#b-like');
  bl.onclick = async () => {
    if (d.di_like) return toast('Ya le diste corazón hoy');
    try {
      const r = await api('/api/cuarto/like', { method: 'POST', body: JSON.stringify({ para: cod }) });
      d.di_like = true; bl.classList.add('dado', 'rebote'); $('span', bl).textContent = nf.format(r.likes);
      if (r.corazones) toast(`¡Corazón enviado! Te ${r.corazones.tope - r.corazones.dados === 1 ? 'queda' : 'quedan'} ${Math.max(0, r.corazones.tope - r.corazones.dados)} hoy`);
      Juego.corazones(bl, 9); Juego.Sonido.aplauso(); Juego.vibrar([20, 40, 20]); ctlV?.feliz();
    } catch (e) { toast(e.message, true); }
  };
  const mc = $('.carta-centro .carta[data-carta]'); if (mc) mc.onclick = () => hojaCarta(f, cartasD);
  const M = await cuandoMonstruos();
  await M.cargar?.(d.mascota?.especie);
  let ctlV = null;
  if (M.disponible && $('#cuarto-3d')) ctlV = M.montarCuarto($('#cuarto-3d'), { mascota: d.mascota, muebles: d.cuarto, posiciones: d.posiciones || {}, pared: d.cuarto.pared, piso: d.cuarto.piso, interactivo: true });
  const lupa = $('#b-lupa-v');
  if (lupa && ctlV) lupa.onclick = () => { if (ctlV.estaCerca()) ctlV.alejar(); else ctlV.acercar(); lupa.classList.toggle('activo', ctlV.estaCerca()); };
}

/* ============================================================ JEFE 3D de la semana (Don Rezago y compania) */
// Como el cuarto de Inicio: el jefe 3D no se destruye al cambiar de pestaña o de pantalla; se guarda escondido (sin dibujar)
// y al volver se pone el mismo, al instante. Antes cada visita lo volvía a armar y a compilar (~0.5 s, más en el teléfono).
let jefeVivo = null;   // { el, ctl, llave }
function guardarJefe() {
  if (!jefeVivo?.el?.isConnected) { jefeVivo = null; return; }
  let caja = document.getElementById('jefe-guardado');
  if (!caja) { caja = document.createElement('div'); caja.id = 'jefe-guardado'; caja.style.display = 'none'; document.body.appendChild(caja); }
  if (jefeVivo.el.parentElement !== caja) { jefeVivo.el.removeAttribute('id'); caja.replaceChildren(jefeVivo.el); }
}
async function pintarJefe(cont) {
  const eq = S.base.equipo;
  if (!eq) { cont.innerHTML = `<div class="panel" style="margin-top:16px">${vacio('Sin jefe esta semana', 'Aún no tienes gremio o la meta de equipo está pausada.', 'escudo')}</div>`; return; }
  // la lista se pinta al instante con lo último que se vio (aunque tenga más de 45 s) y se refresca por detrás
  const url = `/api/ranking?periodo=${eq.semana?.clave || hoyMes()}&gremio=${encodeURIComponent(eq.gremio)}&tienda=${encodeURIComponent(eq.tienda || '')}`;
  let rk = apiReciente(url);
  if (!rk) rk = await api(url);
  else if (!apiFresca(url)) api(url).then((nuevo) => { if (cont.isConnected && $('.jefe-hero', cont) && JSON.stringify(nuevo) !== JSON.stringify(rk)) pintarJefe(cont); }).catch(() => {});
  if (!cont.isConnected) return;
  const vida = Math.max(0, eq.meta - eq.puntos), frac = eq.meta ? vida / eq.meta : 0;
  const yo = S.verAsesor?.codigo || S.sesion.codigo;
  const jefe = jefeDelMes(eq.semana?.desde, eq.jefe);
  guardarJefe();   // si se vuelve a pintar (datos nuevos), el jefe vivo no se pierde
  cont.innerHTML = `
    <section class="jefe-hero ${eq.logrado ? 'derrotado' : ''}">
      <div class="jefe-3d" id="jefe-3d"></div>
      <h3>${eq.logrado ? `¡${esc(jefe.nombre)} derrotado!` : esc(jefe.nombre)}</h3>
      <p>${eq.logrado ? `${esc(eq.gremio_nombre)} de ${esc(tiendaNombre(eq.tienda))} lo venció esta semana. ¡Juntos!` : `${esc(jefe.lema)} Jefe de la semana de ${esc(eq.gremio_nombre)} de ${esc(tiendaNombre(eq.tienda))} (${nf.format(eq.asesores)} ${eq.asesores === 1 ? 'constructor' : 'constructores'}).`}</p>
      <div class="vida"><i style="width:${frac * 100}%"></i><span>${nf.format(vida)} / ${nf.format(eq.meta)}</span></div>
      ${eq.logrado ? '' : `<div class="jefe-guia">
        <div class="jg-debil">${ic('rayo')}<div><small>Su debilidad</small><b>${esc(jefe.debilidad.debil)}</b><span>${esc(jefe.debilidad.como)}</span></div></div>
        <div class="jg-como"><small>Cómo vencerlo</small>
          <ul><li>${ic('check')}Cada moneda que gana tu equipo le quita 1 de vida.</li>
            <li>${ic('check')}Vende, cotiza, da seguimiento a tus clientes y cumple tus misiones.</li>
            <li>${ic('check')}Ataquen juntos: es de tu gremio en tu tienda, y hay que tumbarlo antes del domingo.</li></ul></div>
      </div>`}
      <small class="muted">Cada equipo pelea contra su propio enemigo. Llega uno nuevo cada lunes.</small>
      ${esAsesor() && !eq.logrado ? `<button class="b3 rojo ancho" id="b-atacar">${ic('espada')}¡Atacar! · ver cómo pegarle</button>` : ''}
    </section>
    <div class="seccion"><div class="seccion-cab">${ic('espada')}<h2>Mayor daño esta semana</h2></div>
      <div class="lista-cuartos">${rk.filas.map((f) => `<div class="fila-cuarto ${f.codigo === yo ? 'yo' : ''}"><span class="pos num">${f.posicion}</span>
        ${caraDe(f.mascota, 44, 'mini-mascota', f.nombre)}<span class="txt"><b>${esc(dosNombres(f.nombre))}</b><small>${esc(f.nivel)}</small></span><span class="likes">${nf.format(f.puntos)}</span></div>`).join('') || vacio('Aún sin daño', '')}</div></div>`;
  fotosPendientes(cont);
  const llave = JSON.stringify([jefe.tipo, frac, !!eq.logrado]);
  const lugar = $('#jefe-3d', cont);
  let ctl = null;
  if (lugar && jefeVivo?.el?.isConnected) {   // el mismo jefe de hace rato: se pone de vuelta (si cambió su vida, solo se actualiza)
    lugar.replaceWith(jefeVivo.el); jefeVivo.el.id = 'jefe-3d'; ctl = jefeVivo.ctl;
    if (jefeVivo.llave !== llave) { ctl.set({ tipo: jefe.tipo, vida: frac, derrotado: !!eq.logrado }); jefeVivo.llave = llave; }
  } else {
    const M = await cuandoMonstruos();
    const el = $('#jefe-3d', cont);
    if (M.disponible && el) { ctl = M.montarJefe(el, { tipo: jefe.tipo, vida: frac, derrotado: !!eq.logrado }); jefeVivo = { el, ctl, llave }; }
  }
  const ba = $('#b-atacar', cont);
  const mio = rk.filas.find((f) => f.codigo === yo)?.puntos || 0;
  if (ba) ba.onclick = () => { ctl?.golpe(); Juego.Sonido.golpe?.(); Juego.vibrar([40, 30, 40]); setTimeout(() => hojaAtaque(eq, jefe, vida, mio), 550); };
}

/* La pelea: el punto debil del jefe de la semana y los encargos que le pegan justo ahi */
function hojaAtaque(eq, jefe, vida, mio) {
  if (!esAsesor()) return;
  const d = jefe.debilidad;
  const todos = S.base?.jugadas || [];
  const golpes = (d.encargo === 'todos' ? todos : todos.filter((j) => j.tipo === d.encargo)).slice(0, 3);
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="hoja hoja-ataque"><div class="asa"></div>
    <div class="hoja-cab"><h2>${ic('espada')}¡A pelear!</h2><button class="hud-btn" data-cerrar aria-label="Cerrar">${ic('cerrar')}</button></div>
    <section class="ataque-jefe">
      <b>${esc(jefe.nombre)}</b>
      <div class="vida"><i style="width:${eq.meta ? (100 * vida) / eq.meta : 0}%"></i><span>${nf.format(vida)} / ${nf.format(eq.meta)}</span></div>
      <small>Tu equipo ya le quitó ${nf.format(eq.puntos)} · tú, ${nf.format(mio)}. Cada moneda que ganas es 1 de daño.</small>
    </section>
    <div class="punto-debil">${ic('rayo')}<div><small>Su punto débil</small><b>${esc(d.debil)}</b><span>${esc(d.como)}</span></div></div>
    <h3 class="sub">${golpes.length ? 'Tus golpes de hoy' : 'Sin golpes en la mira'}</h3>
    <div id="golpes">${golpes.length ? golpes.map((j, i) => `<div data-g="${i}">${tarjetaEncargo(j)}</div>`).join('<div style="height:12px"></div>')
      : `<p class="muted">Por ahora no tienes encargos de este tipo. Cada venta, cotización cobrada, complemento y misión también le pega.</p>`}</div>
    <div class="fila-acciones"><button class="b3 blanco" id="a-encargos">${ic('mapa')}Todos mis encargos</button><button class="b3 gris" data-cerrar>Cerrar</button></div>
  </div>`;
  document.body.appendChild(velo);
  $$('#golpes [data-g]', velo).forEach((c) => enlazarEncargo(c, golpes[+c.dataset.g], false));
  velo.addEventListener('click', (e) => {
    if (e.target === velo || e.target.closest('[data-cerrar]')) { velo.remove(); return; }
    if (e.target.closest('[data-acc="whatsapp"],[data-acc="llamada"],[data-acc="reportar"]')) setTimeout(() => velo.remove(), 50);
  });
  $('#a-encargos', velo).onclick = () => { velo.remove(); irA('encargos'); };
}

/* ============================================================ PERFIL: tu mascota, tu carta y tu coleccion */
async function vistaPerfil() {
  const v = $('#vista');
  v.innerHTML = `<div class="vista"><div class="sk" style="height:260px;border-radius:24px"></div>${esqueleto(2, 140)}</div>`;
  let d, b;
  try { [d, b] = await Promise.all([api(conAsesor('/api/perfil')), cargarBase()]); }
  catch (e) { v.innerHTML = `<div class="vista">${vacio('No se pudo cargar', e.message, 'aviso')}</div>`; return; }
  const p = d.perfil, col = d.coleccion, cd = b.carta, ms = b.mascota;
  const titulos = d.catalogo.titulo;
  const opMia = mascotaOp(p, ms, b.gremio.clave);
  v.innerHTML = `<div class="vista perfil">
    <section class="perfil-hero">
      <button class="perfil-atras" id="b-perfil-atras" aria-label="Volver al inicio">${ic('atras')}</button>
      <div class="perfil-3d" id="perfil-3d"></div>
      <h1>${esc(dosNombres(d.asesor.nombre))}</h1>
      <button class="titulo-chip" id="b-titulo">${esc(p.titulo_nombre)} ${ic('flecha')}</button>
      <p class="muted">${esc(nombreMascota(b))} · ${esc(ms.etapa_nombre)} · ${ms.dias_mascota} días de racha juntos</p>
      <div class="perfil-stats">
        <div><b class="num">${nf.format(d.total)}</b><small>Puntos totales</small></div>
        <div><b class="num">${nf.format(d.seguimientos)}</b><small>Visitas</small></div>
        <div><b class="num">${nf.format(d.likes || 0)}</b><small>Corazones</small></div>
      </div>
    </section>

    ${cd?.carta ? `<div class="seccion"><div class="seccion-cab">${ic('cartas')}<h2>Tu carta</h2><span class="der">${esc(cd.trimestre.nombre)}</span></div>
      <div class="carta-centro carta-viva" id="p-carta">${cartaHTML(cd.carta, cd, { oculta: !cd.carta.tengo, bloqueada: true })}</div>
      ${cd.carta.tengo ? '' : `<p class="muted pista-carta">${ic('candado')}${pistaCarta(cd)}</p>`}</div>` : ''}

    <div class="seccion"><div class="seccion-cab">${ic('estrella')}<h2>Tu colección</h2><span class="der">${col.tengo}/${col.total}</span></div>
      <div class="coleccion-res">
        <div class="barra-fina"><i style="width:${Math.round((col.tengo / col.total) * 100)}%"></i></div>
        <div class="niveles-album">${Object.entries(col.por_rareza).map(([r, n]) => `<span class="nv">${RAREZA_TXT[r]} <b>${n}</b></span>`).join('')}</div>
        ${col.joyas.length ? `<div class="joyas">${col.joyas.map((x) => `<div class="joya r-${x.rareza}">${imgFoto(['monstruo', 'pelaje', 'ojos'].includes(x.tipo)
          ? { op: joyaOp(opMia, x) } : { objeto: x.tipo, clave: x.clave }, 64)}
          <b>${esc(x.nombre)}</b><small>${RAREZA_TXT[x.rareza]}${x.limitada ? ' · limitada' : ''}</small></div>`).join('')}</div>`
          : '<p class="muted nota-tienda">Aún no tienes objetos raros. Encuéntralos en la Tienda.</p>'}
      </div></div>

    <div class="seccion"><div class="seccion-cab">${ic('insignia')}<h2>Medallas del mes</h2></div>
      <div class="medallas">${d.insignias.map((i) => `<div class="medalla ${i.logrado ? 'lograda' : ''}" title="${esc(i.descripcion)}">
        <div class="disco">${ic('insignia')}</div><b>${esc(i.nombre)}</b><small>${i.logrado ? '¡Lograda!' : `${nf.format(i.actual)}/${nf.format(i.meta)}`}</small>
        <div class="barra-fina"><i style="width:${Math.round(i.avance * 100)}%"></i></div></div>`).join('')}</div></div>

    <div class="seccion menu-perfil">
      <button class="fila-menu" id="b-tienda">${ic('bolsa')}<span>Personalizar mi mascota</span>${ic('flecha')}</button>
      <button class="fila-menu" id="b-temp">${ic('mapa')}<span>Temporada y premios</span>${ic('flecha')}</button>
      <button class="fila-menu" id="b-guia">${ic('mapa')}<span>Ver el tutorial</span>${ic('flecha')}</button>
      <button class="fila-menu" id="b-reglas">${ic('ayuda')}<span>Cómo se juega</span>${ic('flecha')}</button>
      ${esAsesor() ? `<button class="fila-menu salir" id="b-out">${ic('salir')}<span>Salir</span></button>` : ''}
    </div>
  </div>`;
  fotosPendientes(v);
  $('#b-tienda').onclick = () => { S.tiendaTab = 'ropa'; irA('tienda'); };
  $('#b-temp').onclick = () => irA('temporada');
  $('#b-perfil-atras').onclick = () => irA('base');
  $('#b-reglas').onclick = () => irA('reglas');
  $('#b-guia').onclick = () => guia();
  const bo = $('#b-out'); if (bo) bo.onclick = () => salir();
  const pc = $('#p-carta .carta'); if (pc) pc.onclick = () => (cd.carta.tengo ? hojaCarta(cd.carta, cd) : toast(pistaCarta(cd)));
  $('#b-titulo').onclick = () => elegirTitulo(titulos, p.titulo);
  const M = await cuandoMonstruos();
  // al entrar se ve como foto (sin crear otro 3D: compilarlo tardaba ~1 s en el telefono); al tocarla se vuelve 3D para girarla
  const p3 = $('#perfil-3d');
  if (M.disponible && p3) {
    p3.innerHTML = imgFoto({ op: opMia }, 420, 'perfil-foto'); fotosPendientes(p3);
    p3.addEventListener('pointerdown', () => { if (p3.isConnected && !p3.querySelector('canvas')) M.montar(p3, { ...opMia, interactivo: true }); }, { once: true });
  }
}

function elegirTitulo(titulos, actual) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="hoja"><div class="asa"></div><h2>Tu título</h2><p class="muted">Sale debajo de tu nombre. Los bloqueados se ganan con logros reales.</p>
    <div class="lista-titulos">${titulos.map((t) => `<button class="titulo-op ${t.clave === actual ? 'elegida' : ''} ${t.desbloqueado ? '' : 'bloqueada'}" data-t="${esc(t.clave)}" ${t.desbloqueado ? '' : 'disabled'}>
      ${ic(t.desbloqueado ? 'estrella' : 'candado')}<span>${esc(t.nombre)}</span><small>${t.desbloqueado ? (t.clave === actual ? 'Usando' : '') : esc(t.requisito)}</small></button>`).join('')}</div>
    <button class="b3 gris ancho" data-cerrar style="margin-top:12px">Cerrar</button></div>`;
  document.body.appendChild(velo);
  velo.addEventListener('click', async (e) => {
    if (e.target === velo || e.target.closest('[data-cerrar]')) { velo.remove(); return; }
    const b = e.target.closest('[data-t]');
    if (!b || !esAsesor()) return;
    try { await api('/api/perfil', { method: 'PUT', body: JSON.stringify({ titulo: b.dataset.t }) }); Juego.Sonido.exito(); velo.remove(); await cargarBase(true); vistaPerfil(); }
    catch (er) { toast(er.message, true); }
  });
}
