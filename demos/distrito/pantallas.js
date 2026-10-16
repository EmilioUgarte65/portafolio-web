/* Distrito — pantallas del jugador. */
'use strict';

/* ============================================================ escena: la ciudad del jugador
   Cada escalón del pase de temporada levanta un edificio. El primero es gratis (progreso con ventaja). */
const PALETA = ['#ff7a1a', '#2f8bff', '#12b06a', '#ff3d86', '#e1211c', '#ffb21e', '#0fa9b8', '#ff5e5e', '#5b6fb3', '#14d2c6'];

/* ============================================================ el jefe del mes: "Don Rezago" */
/* ============================================================ BASE (ciudad) */
const ICONO_MISION = { visitas: 'seguimiento', complementos: 'complementos', cotizaciones: 'cotizacion', qr: 'qr', aplauso: 'aplauso', mascota: 'perfil', reactivar: 'reactivar' };
// festeja las misiones que se cumplieron desde la última vez que se vio la pantalla (una vez por misión al día)
function festejarMisiones(b, cont) {
  const m = b?.misiones; if (!m || !esAsesor()) return;
  const llave = 'pmn.misiones.' + (S.sesion?.codigo || '') + '.' + new Date().toISOString().slice(0, 10);
  let vistas = []; try { vistas = JSON.parse(sessionStorage.getItem(llave) || '[]'); } catch { /* sin almacenamiento */ }
  const hechas = m.lista.filter((x) => x.hecha).map((x) => x.clave), nuevas = hechas.filter((k) => !vistas.includes(k));
  try { sessionStorage.setItem(llave, JSON.stringify(hechas)); } catch { /* sin almacenamiento */ }
  if (!nuevas.length) return;
  const filas = [...(cont || document).querySelectorAll('.mision-fila')];
  nuevas.forEach((k, j) => setTimeout(() => Juego.celebrar('mision', { i: hechas.indexOf(k), el: filas[m.lista.findIndex((x) => x.clave === k)] }), 400 + j * 700));
  if (hechas.length === m.lista.length) setTimeout(() => Juego.celebrar('misiones'), 400 + nuevas.length * 700 + 200);
}
// El ERP trae las ventas un dia despues. Hoy: las misiones de ventas se marcan a mano ("por confirmar", sin puntos) para
// sentir el avance al momento; mañana temprano el sistema las confirma y arriba sale el resultado de ayer con su cofre.
function filaMision(x, hoy) {
  const tuyo = x.erp && hoy && !x.hecha ? Math.min(x.meta, x.propio || 0) : 0;
  const lista = tuyo >= x.meta;   // la marco completa, falta que el sistema la confirme
  const avance = Math.max(x.actual, tuyo);
  return `<div class="mision-fila ${x.hecha ? 'hecha' : lista ? 'por-confirmar' : ''}" data-mision="${x.clave}">
    <span class="mis-ic">${ic(x.hecha ? 'check' : lista ? 'reloj' : ICONO_MISION[x.clave] || 'estrella')}</span>
    <div class="txt"><b>${esc(x.texto)}</b>
      <div class="barra ${x.hecha ? 'verde' : lista ? 'azul' : avance / x.meta >= 0.66 ? 'casi' : ''}"><i style="width:${(x.actual / x.meta) * 100}%"></i>${tuyo > x.actual ? `<i class="tuyo" style="left:${(x.actual / x.meta) * 100}%;width:${((tuyo - x.actual) / x.meta) * 100}%"></i>` : ''}<span class="barra-txt">${avance}/${x.meta}</span></div>
      ${x.erp && hoy && !x.hecha ? `<div class="mis-marcar"><small>${lista ? '¡Lista! El sistema la confirma mañana temprano' : 'Márcala al vender: el sistema la confirma mañana'}</small>
        <button class="mis-btn" data-av="-1" aria-label="Quitar una" ${tuyo ? '' : 'disabled'}>−</button><button class="mis-btn mas" data-av="1">+1 Lo vendí</button></div>` : ''}</div>
    <span class="chip ${x.hecha ? 'blanco' : lista ? 'azul' : 'oro'}">${x.hecha ? '¡Hecho!' : lista ? 'Por confirmar' : `+${x.puntos}`}</span></div>`;
}
function tarjetaMisiones(b) {
  const m = b.misiones;
  if (!m || !m.activa) return '';
  const todas = m.cumplidas === m.lista.length, casi = m.cumplidas + (m.por_confirmar || 0) === m.lista.length;
  const a = m.ayer;
  const ayer = a ? `<div class="mis-ayer ${a.cumplidas === a.lista.length ? 'ok' : ''}">
      <b>${ic(a.cumplidas === a.lista.length ? 'check' : 'calendario')} Ayer (${fechaCorta(a.fecha)}): ${a.cumplidas} de ${a.lista.length} confirmadas${a.cofre ? ` · cofre +${a.cofre}` : ''}</b>
      ${a.lista.map((x) => `<span class="${x.hecha ? 'si' : 'no'}">${x.hecha ? '✓' : '✗'} ${esc(x.texto)}${x.erp && x.propio && x.propio !== x.actual ? ` <em>(marcaste ${x.propio}, el sistema confirmó ${x.actual})</em>` : ''}</span>`).join('')}
    </div>` : '';
  return `<div class="seccion" id="sec-misiones"><div class="seccion-cab">${ic('misiones')}<h2>Misiones del día</h2><span class="der">${m.cumplidas}/${m.lista.length}</span></div>
    ${ayer}
    ${m.equipo_activos ? `<div class="mis-equipo">${ic('equipo')}<span><b>${m.equipo_activos} ${m.equipo_activos === 1 ? 'compañero' : 'compañeros'} de tu tienda</b> ya ${m.equipo_activos === 1 ? 'se movió' : 'se movieron'} hoy. ¡Que no te ganen!</span></div>` : ''}
    <div class="panel p-turquesa misiones-dia ${todas ? 'completas' : ''}"><div class="brillo"></div>
      ${m.lista.map((x) => filaMision(x, true)).join('')}
      <div class="cofre-misiones">
        <div class="cofre-dia ${todas ? '' : m.cumplidas === m.lista.length - 1 || casi ? 'lista' : ''}">${imgFoto({ objeto: 'cofre', clave: 'cerrado' }, 64)}</div>
        <span>${m.cofre ? `¡Cofre abierto: +${m.cofre}!` : todas ? '¡Cofre listo!' : casi ? '¡Todo listo! Tu cofre se abre mañana cuando el sistema confirme tus ventas' : `Cumple las ${m.lista.length} y abre el cofre (${m.rango[0]} a ${m.rango[1]})`}</span>
      </div>
    </div></div>`;
}
// los botones "+1 Lo vendí" / "−" de las misiones de ventas
function enlazarMisiones(raiz = document) {
  $$('#sec-misiones [data-av]', raiz).forEach((btn) => (btn.onclick = async () => {
    if (!esAsesor()) return;
    const fila = btn.closest('[data-mision]'), clave = fila.dataset.mision, delta = +btn.dataset.av;
    const antes = S.base.misiones.lista.find((x) => x.clave === clave);
    btn.disabled = true;
    try {
      const r = await api('/api/mision/avance', { method: 'POST', body: JSON.stringify({ clave, delta }) });
      S.base.misiones = r.misiones;
      const ahora = r.misiones.lista.find((x) => x.clave === clave);
      const sec = $('#sec-misiones'); if (sec) { sec.outerHTML = tarjetaMisiones(S.base); fotosPendientes($('#sec-misiones')); enlazarMisiones(); }
      pintarHud();
      if (delta > 0) {
        const f = $(`#sec-misiones [data-mision="${clave}"]`), boton = f?.querySelector('.mis-btn.mas');
        const falta = ahora.meta - Math.min(ahora.meta, ahora.propio);
        flotante('+1', boton); Juego.vibrar?.(15);
        // la mascota lo festeja: se pone feliz y lo dice
        try { ctlInicio?.feliz?.(); } catch { /* sin cuarto */ }
        const globo = $('#globo-animo');
        if (globo) { globo.textContent = falta ? (falta === 1 ? '¡Nos falta una!' : '¡Eso! Vamos por más') : '¡Lo logramos! Mañana cobramos'; globo.classList.remove('oculto'); }
        if (ahora.propio >= ahora.meta && (antes?.propio || 0) < ahora.meta) {
          Juego.celebrar('mision', { el: f, i: 1 }); toast(`¡Misión lista! Mañana el sistema la confirma y cobras +${ahora.puntos}`);
        } else {
          Juego.Sonido.sumar?.(ahora.propio / Math.max(1, ahora.meta)); Juego.estrellas?.(boton, 6);
          toast(falta === 1 ? '¡Te falta 1!' : `¡Bien! Te faltan ${falta}`);
        }
      } else Juego.Sonido.restar?.();
    } catch (e) { toast(e.message, true); btn.disabled = false; }
  }));
}

const COFRE_MINI = `<svg viewBox="0 0 140 120"><g><rect x="12" y="24" width="116" height="32" rx="8" fill="#ff7a1a"/><rect x="62" y="24" width="16" height="32" fill="#ffe57a"/><rect x="12" y="24" width="116" height="8" rx="4" fill="#ffad4d"/></g>
  <rect x="18" y="56" width="104" height="58" rx="8" fill="#c24e0a"/><rect x="62" y="56" width="16" height="58" fill="#ffcc2e"/><rect x="58" y="64" width="24" height="18" rx="4" fill="#fff6c9"/></svg>`;

async function reclamarDiario(btn) {
  btn.disabled = true;
  const antes = S.base.saldo.monedas;
  try {
    const r = await api('/api/diario', { method: 'POST' });
    Juego.celebrar('diario', { el: btn, puntos: r.puntos });
    flotante('+' + r.puntos, btn);
    S.monstruoCiudad?.feliz();
    Juego.confeti({ cantidad: 60, origenY: 0.55, fuerza: 0.7 });
    await cargarBase();
    animarSaldo(antes, S.base.saldo.monedas, btn);
    setTimeout(() => vistaBase(), 900);
  } catch (e) { toast(e.message, true); btn.disabled = false; }
}

/* ============================================================ encargos */
function textoEncargo(j) {
  if (j.tipo === 'cotizacion' && j.por_vencer) {   // encargo pendiente: vence hoy, mañana o pasado mañana
    const cuando = j.dias_vence === 0 ? 'hoy' : j.dias_vence === 1 ? 'mañana' : j.dias_vence === 2 ? 'pasado mañana' : `en ${j.dias_vence} días`;
    return { etiqueta: `Misión · cotización vence ${cuando}`, icono: 'reloj', motivo: `Su cotización vence ${cuando}`, real: `Cotización ${j.cotizacion} · vence ${fechaCorta(j.vence)}` };
  }
  if (j.tipo === 'cotizacion') {
    return { etiqueta: 'Misión · encargo sin recoger', icono: 'cofre', motivo: `Dejó un encargo sin recoger`, real: `Cotización ${j.cotizacion} · ${fechaCorta(j.fecha)}` };
  }
  // siempre "N días sin comprar" (singular con 1), aunque el servidor mande el texto viejo "lleva N sin venir"
  const motivo = (j.motivo || '').replace(/lleva (\d+) sin venir/, 'lleva $1 días sin comprar').replace(/\b1 días sin comprar/, '1 día sin comprar');
  return { etiqueta: 'Misión · cliente dormido', icono: 'reactivar', motivo, real: `Última compra ${fechaCorta(j.fecha)}` };
}

// en las cotizaciones por vencer la etiqueta es la urgencia: ninguna venta es chica
const URGENCIA = { 0: '¡Último día!', 1: 'Vence mañana', 2: 'Quedan 2 días' };
function tarjetaEncargo(j, destacado = false) {
  const t = textoEncargo(j), tel = telLimpio(j.telefono);
  return `<article class="panel encargo r-${j.rareza} ${j.por_vencer ? 'por-vencer' : ''}">
    <div class="franja">${ic(t.icono)}${t.etiqueta}<span class="rareza-tag">${j.tipo === 'cotizacion' && j.por_vencer ? URGENCIA[j.dias_vence] || 'Por vencer' : RAREZA[j.rareza]}</span></div>
    <div class="cuerpo">
      <div class="personaje">${avatar(j.nombre, { color: { comun: 'azul', rara: 'verde', epica: 'morado', legendaria: 'dorado' }[j.rareza] }, 60)}${j.tipo === 'reactivar' ? '<span class="zz">Zz</span>' : ''}</div>
      <div class="txt"><h3>${esc(dosNombres(j.nombre))}</h3><div class="motivo">${esc(t.motivo)}</div><div class="real">${esc(t.real)}</div>
        <div class="premios"><span class="chip oro">${coin()} +${j.premio_ahora} al reportar</span><span class="chip oro">${coin()} +${j.premio_despues} si compra</span></div>
        ${j.tipo === 'cotizacion' && !j.complementos ? `<div class="pista">${ic('complementos')}<span><b>Sin complemento.</b> Ofrécele uno: suma a tu combo y a tu misión del día.</span></div>` : ''}
        ${j.tipo === 'cotizacion' ? `<div class="pista qr">${ic('qr')}<span>Si paga con <b>QR</b> ganas +10 extra.</span></div>` : ''}</div>
    </div>
    ${esAsesor() ? `<div class="acciones">
      ${tel ? `<button class="b3 wa chico" data-acc="whatsapp">${ic('wa')}WhatsApp</button><button class="b3 azul chico" data-acc="llamada">${ic('tel')}Llamar</button>`
        : `<button class="b3 blanco chico" data-acc="reportar">${ic('seguimiento')}Reportar visita</button>`}
    </div>` : ''}
    ${destacado ? `<div class="pie"><button class="enlace" data-acc="anterior" aria-label="Encargo anterior">${ic('atras')} Anterior</button><button class="enlace" data-acc="otro">Otro encargo ${ic('flecha')}</button></div>` : ''}
  </article>`;
}

function enlazarEncargo(cont, j, destacado) {
  if (!cont || !j) return;
  $$('[data-acc]', cont).forEach((b) => (b.onclick = () => {
    const a = b.dataset.acc;
    if (a === 'otro' || a === 'anterior') {
      const n = S.base.jugadas.length;
      S.jugadaIdx = (S.jugadaIdx + (a === 'otro' ? 1 : n - 1)) % n;
      const nj = S.base.jugadas[S.jugadaIdx];
      cont.innerHTML = tarjetaEncargo(nj, destacado);
      cont.firstElementChild.classList.add('rebote');
      if (nj.rareza === 'legendaria' || nj.rareza === 'epica') Juego.Sonido.revelar();
      enlazarEncargo(cont, nj, destacado);
      return;
    }
    if (a === 'reportar') { hojaReporte({ ...j, medio: 'llamada' }); return; }
    contactar(j, a);
  }));
}

/* Tocar la puerta: abre WhatsApp (con el mensaje ya escrito) o la llamada. Al volver a la app
   se abre solo el reporte de la visita, para que registrar no cueste nada. */
function contactar(j, medio) {
  store.set('pendiente', { j, medio, t: Date.now() });
  if (medio === 'whatsapp') window.open(`https://wa.me/${waNum(j.telefono)}?text=${encodeURIComponent(j.mensaje || '')}`, '_blank', 'noopener');
  else location.href = `tel:${telLimpio(j.telefono)}`;
  setTimeout(() => toast('Al volver, reporta la visita y cobra tus monedas'), 400);
}
function revisarContactoPendiente() {
  const p = store.get('pendiente');
  if (!p || !esAsesor() || document.querySelector('.velo, .cofre-velo, .tour')) return;
  if (Date.now() - p.t < 2500) return;
  store.del('pendiente');
  if (Date.now() - p.t > 3 * 3600e3) return;
  const nota = p.j.tipo === 'cotizacion'
    ? `${p.medio === 'whatsapp' ? 'Le escribí por WhatsApp' : 'Le llamé'} sobre su cotización ${p.j.cotizacion}.`
    : `${p.medio === 'whatsapp' ? 'Le escribí por WhatsApp' : 'Le llamé'} para invitarlo a volver.`;
  hojaReporte({ ...p.j, medio: p.medio, nota });
}

function jugar() {
  if (!esAsesor()) { toast('Vista de solo lectura'); return; }
  const lista = S.base?.jugadas || [];
  if (!lista.length) { hojaReporte(); return; }
  const j = lista[S.jugadaIdx % lista.length];
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="hoja"><div class="asa"></div>
    <div class="hoja-cab"><h2>¡A jugar!</h2><button class="hud-btn" data-cerrar aria-label="Cerrar">${ic('cerrar')}</button></div>
    <div id="jugar-encargo">${tarjetaEncargo(j, true)}</div>
    <button class="b3 blanco ancho" id="j-otro-cliente" style="margin-top:16px">${ic('buscar')}Reportar visita a otro cliente</button>
  </div>`;
  document.body.appendChild(velo);
  velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-cerrar]')) velo.remove(); });
  const cont = $('#jugar-encargo', velo);
  enlazarEncargo(cont, j, true);
  cont.addEventListener('click', (e) => { if (e.target.closest('[data-acc="whatsapp"],[data-acc="llamada"],[data-acc="reportar"]')) setTimeout(() => velo.remove(), 50); });
  $('#j-otro-cliente', velo).onclick = () => { velo.remove(); hojaReporte(); };
}

async function vistaEncargos() {
  const v = $('#vista');
  v.innerHTML = `<div class="vista"><div class="cab-vista"><div><h1>Encargos</h1><p>Toca la puerta, reporta la visita y cobra.</p></div></div>${esqueleto(4, 150)}</div>`;
  let filas;
  try { filas = (await api(conAsesor('/api/jugadas'))).filas; store.set('cacheEnc', filas); }
  catch (e) { filas = store.get('cacheEnc'); if (!filas) { v.innerHTML = `<div class="vista">${vacio('No se pudo cargar', e.message, 'aviso')}</div>`; return; } }
  const tab = S.encargosTab;
  const lista = filas.filter((f) => tab === 'todos' || (tab === 'cot' ? f.tipo === 'cotizacion' : f.tipo === 'reactivar'));
  const nLeg = filas.filter((f) => f.rareza === 'legendaria' && f.tipo !== 'cotizacion').length, nHoy = filas.filter((f) => f.tipo === 'cotizacion' && f.dias_vence === 0).length;
  v.innerHTML = `<div class="vista">
    <div class="cab-vista"><div><h1>Encargos</h1><p>Tienes ${filas.length} ${filas.length === 1 ? 'misión' : 'misiones'}${nHoy ? ` · <b style="color:var(--oro-t)">${nHoy} ${nHoy === 1 ? 'vence' : 'vencen'} hoy</b>` : ''}${nLeg ? ` · <b style="color:var(--oro-t)">${nLeg} ${nLeg === 1 ? 'es legendaria' : 'son legendarias'}</b>` : ''}</p></div>
      ${esAsesor() ? `<button class="b3 blanco chico" id="b-mensajes">${ic('wa')}Mis mensajes</button>` : ''}</div>
    <div class="segmentos" id="seg-enc">
      <button data-t="todos" class="${tab === 'todos' ? 'activo' : ''}">Todos</button>
      <button data-t="cot" class="${tab === 'cot' ? 'activo' : ''}">Pendientes</button>
      <button data-t="rea" class="${tab === 'rea' ? 'activo' : ''}">Dormidos</button>
    </div>
    ${avisoDatos()}
    <div id="lista-enc" style="margin-top:16px">${lista.length ? lista.map((j, i) => `<div data-i="${i}">${tarjetaEncargo(j)}</div>`).join('<div style="height:14px"></div>')
      : `<div class="panel p-verde">${vacio('Todo atendido', 'No hay encargos de este tipo por ahora.', 'check')}</div>`}</div>
  </div>`;
  $$('#seg-enc [data-t]').forEach((b) => (b.onclick = () => { S.encargosTab = b.dataset.t; vistaEncargos(); }));
  const bm = $('#b-mensajes'); if (bm) bm.onclick = () => hojaMensajes(filas);
  $$('#lista-enc [data-i]').forEach((c) => enlazarEncargo(c, lista[+c.dataset.i], false));
}

/* ============================================================ mis mensajes de WhatsApp (los escribe cada asesor) */
const VARIABLE_MSJ = { cliente: 'Nombre del cliente', asesor: 'Tu nombre', folio: 'Folio', vence: 'Cuándo vence' };
async function hojaMensajes(filas = []) {
  let d;
  try { d = await api('/api/mensajes'); } catch (e) { toast(e.message, true); return; }
  const cot = filas.find((f) => f.tipo === 'cotizacion'), rea = filas.find((f) => f.tipo === 'reactivar');
  const ejemplo = { cliente: ((cot || rea)?.nombre || 'Juan Pérez').split(' ')[0], asesor: d.asesor || 'tu nombre',
    folio: cot?.cotizacion || 'COT-12345', vence: 'mañana' };
  const vista = (t) => t.replace(/\{(\w+)\}/g, (m, k) => (k in ejemplo ? ejemplo[k] : m));
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="hoja hoja-mensajes"><div class="asa"></div><h2>Mis mensajes de WhatsApp</h2>
    <p class="muted">Se escriben solos al tocar WhatsApp en un encargo. Usa los botones para poner los datos de cada cliente.</p>
    ${Object.entries(d.mensajes).map(([t, m]) => `<section class="msj" data-tipo="${t}">
      <h3 class="sub">${esc(m.nombre)} ${m.propio ? '<span class="chip">Tuyo</span>' : '<span class="chip gris">El de DE</span>'}</h3>
      <textarea class="input" rows="4" maxlength="600">${esc(m.texto)}</textarea>
      <div class="vars">${m.variables.map((v) => `<button class="chip-var" data-var="${v}">+ ${VARIABLE_MSJ[v] || v}</button>`).join('')}</div>
      <div class="previa"><small>Así le llega:</small><p>${esc(vista(m.texto))}</p></div>
      <div class="fila-acciones">${m.propio ? '<button class="enlace" data-msj="mn">Usar el de DE</button>' : ''}<button class="b3 verde chico" data-msj="guardar">Guardar</button></div>
    </section>`).join('')}
    <div class="fila-acciones"><button class="b3 gris" data-cerrar>Cerrar</button></div></div>`;
  document.body.appendChild(velo);
  $$('.msj', velo).forEach((sec) => {
    const ta = $('textarea', sec), pv = $('.previa p', sec);
    let tocado = false; ta.addEventListener('focus', () => { tocado = true; });
    ta.oninput = () => { pv.textContent = vista(ta.value); };
    $$('[data-var]', sec).forEach((b) => (b.onclick = () => {   // inserta {variable} donde esta el cursor
      const v = `{${b.dataset.var}}`, i = tocado ? ta.selectionStart : ta.value.length, f = tocado ? ta.selectionEnd : i;
      ta.value = ta.value.slice(0, i) + v + ta.value.slice(f); ta.focus(); ta.selectionStart = ta.selectionEnd = i + v.length; ta.oninput();
    }));
    $$('[data-msj]', sec).forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      try {
        await api('/api/mensajes', { method: 'PUT', body: JSON.stringify({ tipo: sec.dataset.tipo, texto: b.dataset.msj === 'mn' ? '' : ta.value }) });
        Juego.Sonido.exito(); toast(b.dataset.msj === 'mn' ? 'Listo: vuelves a usar el mensaje de DE' : 'Mensaje guardado');
        velo.remove(); if (S.vista === 'encargos') vistaEncargos(); else hojaMensajes(filas);
      } catch (e) { toast(e.message, true); b.disabled = false; }
    }));
  });
  velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-cerrar]')) velo.remove(); });
}

/* ============================================================ reportar visita (seguimiento) */
function hojaReporte(pre = null) {
  if (!esAsesor()) return;
  const st = { cliente: pre && pre.cliente ? pre : null, medio: pre?.medio || 'whatsapp' };
  const vis = S.base?.misiones?.lista.find((x) => x.clave === 'visitas');
  const val = S.base?.valores || { visita: 3, bono_compra: 20, dias_compra: 15 };
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="hoja" role="dialog" aria-modal="true" aria-labelledby="h-tit">
    <div class="asa"></div>
    <div class="hoja-cab"><h2 id="h-tit">Reportar visita</h2><button class="hud-btn" data-cerrar aria-label="Cerrar">${ic('cerrar')}</button></div>
    <div class="fila-acciones" style="margin-bottom:14px"><span class="chip oro">${coin()} +${val.visita} ahora</span><span class="chip oro">${coin()} +${val.bono_compra} si compra en ${val.dias_compra} días</span>
      ${vis && !vis.hecha ? `<span class="chip blanco">${ic('misiones')} Misión: ${vis.actual}/${vis.meta} visitas</span>` : ''}</div>
    <div class="campo"><label>Vecino (cliente)</label><div id="h-cliente"></div></div>
    <div class="campo"><label>Cómo tocaste la puerta</label><div class="medios" id="h-medios"></div></div>
    <div class="campo"><label for="h-nota">Qué pasó</label><textarea class="input" id="h-nota" maxlength="500" placeholder="Ej. Le recordé su cotización; pasa el sabado por el material.">${esc(pre?.nota || '')}</textarea></div>
    <div class="error-msg" id="h-err"></div>
    <button class="b3 ancho grande" id="h-ok">${coin()} Cobrar monedas</button>
  </div>`;
  document.body.appendChild(velo);
  const cerrar = () => velo.remove();
  velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-cerrar]')) cerrar(); });

  const pintarMedios = () => {
    $('#h-medios', velo).innerHTML = Object.entries(MEDIOS).map(([k, [t, i]]) => `<button type="button" data-m="${k}" class="${st.medio === k ? 'activo' : ''}">${ic(i)}${t}</button>`).join('');
    $$('[data-m]', velo).forEach((b) => (b.onclick = () => { st.medio = b.dataset.m; pintarMedios(); }));
  };
  const pintarCliente = () => {
    const box = $('#h-cliente', velo);
    if (st.cliente) {
      box.innerHTML = `<div class="elegido"><div class="txt"><b>${esc(st.cliente.cliente_nombre || st.cliente.nombre || st.cliente.cliente)}</b><span>${esc(st.cliente.cliente)}${st.cliente.cotizacion ? ' · ' + esc(st.cliente.cotizacion) : ''}${st.cliente.telefono ? ' · ' + esc(st.cliente.telefono) : ''}</span></div>
        <button class="hud-btn" id="h-cambiar" aria-label="Cambiar cliente" style="color:#06205c;background:#e8eefd">${ic('cerrar')}</button></div>`;
      $('#h-cambiar', velo).onclick = () => { st.cliente = null; pintarCliente(); };
      return;
    }
    box.innerHTML = `<input class="input" id="h-buscar" placeholder="Nombre, número o teléfono" autocomplete="off"><div id="h-res"></div>`;
    const inp = $('#h-buscar', velo);
    let t;
    setTimeout(() => inp.focus(), 300);
    inp.oninput = () => {
      clearTimeout(t);
      const q = inp.value.trim();
      if (q.length < 3) { $('#h-res', velo).innerHTML = ''; return; }
      t = setTimeout(async () => {
        $('#h-res', velo).innerHTML = '<div class="sk" style="height:50px;margin-top:8px"></div>';
        try {
          const r = await api('/api/clientes?q=' + encodeURIComponent(q));
          if (inp.value.trim() !== q) return;
          $('#h-res', velo).innerHTML = r.filas.length ? `<div class="resultados">${r.filas.map((c, i) => `<button type="button" data-c="${i}"><b>${esc(c.cliente_nombre)}</b><span>${esc(c.cliente)} · ${esc(c.ciudad || '')}${c.telefono ? ' · ' + esc(c.telefono) : ''}</span></button>`).join('')}</div>` : '<p style="font-size:13px">Sin resultados.</p>';
          $$('[data-c]', velo).forEach((b) => (b.onclick = () => { st.cliente = r.filas[+b.dataset.c]; pintarCliente(); }));
        } catch (e) { $('#h-res', velo).innerHTML = `<p class="error-msg">${esc(e.message)}</p>`; }
      }, 350);
    };
  };
  pintarMedios(); pintarCliente();

  $('#h-ok', velo).onclick = async () => {
    const err = $('#h-err', velo);
    if (!st.cliente) { err.textContent = 'Elige al vecino que visitaste'; Juego.Sonido.error(); return; }
    const nota = $('#h-nota', velo).value.trim();
    if (nota.length < 5) { err.textContent = 'Cuenta brevemente que paso'; Juego.Sonido.error(); return; }
    const payload = { cliente: st.cliente.cliente, cliente_nombre: st.cliente.cliente_nombre || st.cliente.nombre || '', medio: st.medio, nota, cotizacion: st.cliente.cotizacion || '' };
    const btn = $('#h-ok', velo); btn.disabled = true; err.textContent = '';
    const antes = S.base?.saldo.monedas ?? 0;
    try {
      const r = await api('/api/seguimientos', { method: 'POST', body: JSON.stringify(payload) });
      cerrar();
      if (r.puntos) { festejo('+' + r.puntos); } else { Juego.Sonido.exito(); toast(r.mensaje); }
      S.monstruoEvento = 'comer';  // tu monstruo se come una galleta por cada visita reportada
      if (S.base) S.base.jugadas = S.base.jugadas.filter((x) => x.cliente !== payload.cliente);
      await cargarBase();
      animarSaldo(antes, S.base.saldo.monedas);
      if (S.vista === 'base') vistaBase(); else if (S.vista === 'encargos') vistaEncargos();
      setTimeout(async () => {
        const hubo = await revisarNovedades(true);
        if (!hubo) { const msg = mensajeAnticipacion(); if (msg) toast(msg); }
      }, 1300);
    } catch (e) {
      btn.disabled = false;
      if (!e.status) {
        const cola = store.get('cola', []); cola.push({ ...payload, fecha: hoyISO() }); store.set('cola', cola);
        cerrar(); toast('Sin conexion: se enviará al reconectar');
      } else { err.textContent = e.message; Juego.Sonido.error(); }
    }
  };
}

function mensajeAnticipacion() {
  const b = S.base;
  if (!b) return '';
  const mis = b.misiones;
  if (mis?.activa && !mis.cofre) {
    const vis = mis.lista.find((x) => x.clave === 'visitas' && !x.hecha);
    if (vis && vis.meta - vis.actual === 1) return '¡1 visita más y cumples la misión del día!';
    if (mis.cumplidas === mis.lista.length - 1) return '¡Te falta 1 misión para abrir el cofre del día!';
    if (vis) return `Misión del día: ${vis.actual}/${vis.meta} visitas`;
  }
  const r = b.retos.lista.find((x) => !x.logrado && x.meta - x.actual <= 2);
  if (r) return `¡Casi! Te faltan ${r.meta - r.actual} para el contrato "${{ reactivar: 'Despierta vecinos', seguimientos: 'Reporta visitas', complementos: 'Haz combos' }[r.clave]}"`;
  if (b.racha.dias > 1) return `Racha de ${b.racha.dias} días encendida`;
  return '';
}

/* ============================================================ EQUIPO: jefe, muro y arena */
async function vistaEquipo() {
  const v = $('#vista');
  const tab = S.equipoTab;
  guardarJefe();   // el jefe 3D se queda escondido, vivo, para volver a la pestaña al instante
  v.innerHTML = `<div class="vista"><div class="cab-vista"><div><h1>Tu equipo</h1><p>Juntos contra el jefe de la semana.</p></div></div>
    <div class="segmentos chips-scroll" id="seg-eq">
      ${[['jefe', 'Jefe'], ['cartas', 'Cartas'], ['cuartos', 'Ciudad'], ['arena', 'Ranking'], ['muro', 'Muro']].map(([k, t]) => `<button data-t="${k}" class="${tab === k ? 'activo' : ''}">${t}</button>`).join('')}
    </div><div id="eq-cont">${esqueleto(3, 120)}</div></div>`;
  $$('#seg-eq [data-t]').forEach((b) => (b.onclick = () => { S.equipoTab = b.dataset.t; vistaEquipo(); }));
  const cont = $('#eq-cont');
  try {
    if (!S.base) await cargarBase();
    if (tab === 'jefe') await pintarJefe(cont);
    else if (tab === 'muro') await pintarMuro(cont);
    else if (tab === 'cartas') await pintarAlbum(cont);
    else if (tab === 'cuartos') pintarEntradaCiudad(cont);
    else await pintarArena(cont);
  } catch (e) { cont.innerHTML = vacio('No se pudo cargar', e.message, 'aviso'); }
}

async function pintarMuro(cont) {
  const d = await api(conAsesor('/api/equipo'));
  const restantes = Math.max(0, d.max_dados_dia - d.aplausos_dados_hoy);
  const puedo = esAsesor() && d.aplausos_activos;
  cont.innerHTML = `
    ${puedo ? `<div class="panel p-rosa" style="margin-top:16px;display:flex;align-items:center;gap:12px"><div class="brillo"></div>${ic('aplauso')}
      <span>Te quedan <b class="num" id="ap-rest" style="font-size:20px">${restantes}</b> aplausos hoy. Cada uno le regala monedas a tu compañero.</span></div>` : ''}
    <div class="panel p-noche" style="margin-top:16px;padding:4px 16px">${d.filas.length ? d.filas.map((f, i) => `
      <div class="muro-item">${avatar(f.nombre, f, 42)}
        <div class="txt"><b>${esc(dosNombres(f.nombre))}${f.asesor === d.yo ? ' (tu)' : ''}</b><span>${esc(tituloJuego(f))} · ${fechaCorta(f.fecha)}</span></div>
        <button class="btn-aplauso ${f.aplaudido ? 'hecho' : ''}" data-i="${i}" ${!puedo || f.asesor === d.yo ? 'disabled' : ''} aria-label="Aplaudir">${ic('aplauso')}<span>${f.aplausos || ''}</span></button>
      </div>`).join('') : vacio('Aún no hay logros', 'Los logros de tu tienda aparecerán aqui.', 'equipo')}</div>`;
  fotosPendientes(cont);
  let quedan = restantes;
  $$('.btn-aplauso', cont).forEach((b) => (b.onclick = async () => {
    const f = d.filas[+b.dataset.i];
    if (f.aplaudido) return toast('Ya aplaudiste este logro');
    if (quedan <= 0) return toast('Ya diste todos tus aplausos de hoy', true);
    Juego.Sonido.palmada(); Juego.corazones(b, 7); Juego.vibrar(25);
    b.classList.add('hecho', 'rebote'); f.aplaudido = true;
    const span = b.querySelector('span'); span.textContent = (f.aplausos || 0) + 1;
    try {
      const r = await api('/api/aplausos', { method: 'POST', body: JSON.stringify({ clave: f.clave }) });
      f.aplausos = r.aplausos; span.textContent = r.aplausos; quedan = r.restantes;
      const rest = $('#ap-rest'); if (rest) rest.textContent = Math.max(0, quedan);
    } catch (e) { b.classList.remove('hecho'); f.aplaudido = false; span.textContent = f.aplausos || ''; toast(e.message, true); }
  }));
}

function tituloJuego(f) {
  const t = f.titulo || '';
  if (f.tipo === 'reactivacion') return t.replace('Reactivaste a', 'Despertó a');
  if (f.tipo === 'sorpresa') return 'Abrió el cofre del día';
  if (f.tipo === 'complementos') return t.replace('productos complemento en el mes', 'combos este mes');
  if (f.tipo === 'ventas_pequenas') return t.replace('ventas pequeñas atendidas en el mes', 'gemas este mes');
  if (f.tipo === 'seguimiento_efectivo') return t.replace('compró tras tu seguimiento', 'compró tras su visita');
  return t;
}

const DIVISIONES = { tienda: 'Mi tienda', gremio: 'Mi gremio', liga: 'Mi nivel', global: 'Todos' };
const ICONO_GREMIO = { obra: 'casa', pisos: 'complementos', pintura: 'pequenas', plomeria: 'tel', ferreteria: 'ajuste' };

function posicionEn(div, b) {
  if (div === 'gremio') return { pos: b.gremio.posicion, tam: b.gremio.tamano };
  if (div === 'liga') return { pos: b.liga.posicion, tam: b.liga.tamano };
  if (div === 'global') return { pos: b.posicion, tam: b.participantes };
  return { pos: b.posicion_tienda, tam: b.tamano_tienda };
}
function tarjetaDivision(div, color, icono, titulo, _x, b) {
  const { pos, tam } = posicionEn(div, b);
  return `<button class="panel division ${color}" data-div="${div}"><div class="brillo"></div>
    <span class="div-ic">${ic(div === 'gremio' ? (ICONO_GREMIO[b.gremio.clave] || 'estrella') : icono)}</span>
    <span class="div-pos num">${pos ? '#' + pos : '—'}</span><span class="div-tit">${titulo}</span><small>${tam ? `de ${tam}` : 'sin datos'}</small></button>`;
}

// los 4 rankings cuentan lo mismo (puntos de este mes); solo cambia contra quien compites
const MESES_TXT = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function quienCompite(div, b) {
  const tienda = tiendaNombre(b.asesor.tienda), gremio = (b.gremio.nombre || '').replace('Gremio de ', '');
  return {
    tienda: { t: `Tienda ${tienda}`, d: `Compites contra tus compañeros de ${tienda}, de todos los gremios.` },
    gremio: { t: gremio ? `Gremio ${gremio}` : 'Mi gremio', d: gremio ? `Compites contra los asesores de ${gremio} de todas las tiendas.` : 'Compites contra los asesores de tu misma especialidad en todas las tiendas.' },
    liga: { t: `Nivel ${b.liga.nombre}`, d: `Compites solo contra quienes tienen tu mismo nivel (${b.liga.nombre}): la competencia más pareja.` },
    global: { t: 'Todo Web Dev-Eyes', d: 'Compites contra todos los asesores, de todas las tiendas y gremios.' },
  }[div];
}
function hojaRankings(b) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  const fila = (k, icono) => { const q = quienCompite(k, b); return `<div class="rk-ayuda">${ic(icono)}<div><b>${DIVISIONES[k]}</b><span>${esc(q.d)}</span></div></div>`; };
  velo.innerHTML = `<div class="hoja"><div class="asa"></div>
    <div class="hoja-cab"><h2>¿Cómo funcionan los rankings?</h2><button class="hud-btn" data-cerrar aria-label="Cerrar">${ic('cerrar')}</button></div>
    <p>Los 4 rankings cuentan lo mismo: <b>los puntos que juntas este mes</b>. Gana quien tenga más. Solo cambia <b>contra quién compites</b>:</p>
    ${fila('tienda', 'casa')}${fila('gremio', 'equipo')}${fila('liga', 'insignia')}${fila('global', 'trofeo')}
    <h3 class="sub">¿Cómo sumo puntos?</h3>
    <p class="muted">Con tus ventas, cotizaciones, seguimientos, clientes que recuperas, misiones del día y corazones de tus compañeros. En <b>Encargos</b> ves qué te da más puntos.</p>
    <h3 class="sub">¿Qué es mi nivel?</h3>
    <p class="muted">Sube con <b>todos</b> los puntos que has juntado desde que empezaste y nunca baja: Bronce → Plata (2,000) → Oro (6,000) → Platino (12,000) → Diamante (25,000).</p>
    <p class="muted">El día 1 de cada mes los rankings empiezan de cero. Tus puntos no se gastan: lo que gastas en la tienda son monedas.</p>
    <div class="fila-acciones"><button class="b3" data-cerrar>Entendido</button></div></div>`;
  document.body.appendChild(velo);
  velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-cerrar]')) velo.remove(); });
}

async function pintarArena(cont) {
  const b = S.base, div = S.arena in DIVISIONES ? S.arena : 'tienda';
  const q = div === 'tienda' ? `&tienda=${encodeURIComponent(b.asesor.tienda)}` : div === 'gremio' && b.gremio.clave ? `&gremio=${encodeURIComponent(b.gremio.clave)}` : '';
  const d = await api(`/api/ranking?periodo=${hoyMes()}${q}`);
  let filas = d.filas;
  if (div === 'liga') filas = filas.filter((f) => f.nivel === b.liga.nombre);
  filas = filas.map((f, i, arr) => ({ ...f, posicion: i && arr[i - 1].puntos === f.puntos ? null : i + 1 }));
  filas.forEach((f, i) => { if (f.posicion === null) f.posicion = filas[i - 1].posicion; });
  const yo = S.verAsesor?.codigo || S.sesion.codigo;
  const top = filas.slice(0, 3);
  const lugar = (f, n) => f ? `<div class="lugar p${n}">${n === 1 ? ic('corona', 'corona') : ''}${avatar(f.nombre, f, n === 1 ? 76 : 58)}<div class="nombre">${esc(primerNombre(f.nombre))}</div><div class="peana">${nf.format(f.puntos)}</div></div>` : '<div></div>';
  const qc = quienCompite(div, b);
  // cuando se acaba el mes
  const hoy = new Date(), fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1), quedan = Math.max(1, Math.ceil((fin - hoy) / 864e5));
  // donde voy yo y cuanto me falta para pasar al de arriba
  const k = filas.findIndex((f) => f.codigo === yo), mia = filas[k];
  const arriba = mia ? filas.slice(0, k).reverse().find((f) => f.puntos > mia.puntos) : null;
  const estado = !mia ? '' : !mia.puntos ? 'Aún no sumas puntos este mes: cumple tus misiones para entrar a la tabla.'
    : !arriba ? `¡Vas en 1er lugar! Mantente: quedan ${quedan} ${quedan === 1 ? 'día' : 'días'}.`
    : `Te faltan <strong>${nf.format(arriba.puntos - mia.puntos + 1)} puntos</strong> para pasar a ${esc(primerNombre(arriba.nombre))} (lugar ${arriba.posicion}).`;
  // en cada fila solo lo que no es igual para todos en este ranking
  const detalle = (f) => [div !== 'tienda' && tiendaNombre(f.tienda), div !== 'liga' && `Nivel ${f.nivel}`,
    div !== 'gremio' && f.gremio && d.gremios[f.gremio] && d.gremios[f.gremio].replace('Gremio de ', '')].filter(Boolean).map(esc).join(' · ');
  cont.innerHTML = `
    <div class="segmentos div4" id="seg-arena" style="margin-top:12px">${Object.entries(DIVISIONES).map(([kk, t]) => `<button data-a="${kk}" class="${div === kk ? 'activo' : ''}">${t}</button>`).join('')}</div>
    <div class="panel ${{ tienda: 'p-naranja', gremio: 'p-turquesa', liga: 'p-morado', global: 'p-rosa' }[div]} cab-division"><div class="brillo"></div>
      <div class="cab-division-fila"><b class="num">${esc(qc.t)}</b><button class="rk-info" id="rk-info" aria-label="¿Cómo funcionan los rankings?">${ic('ayuda')}</button></div>
      <small>${esc(qc.d)} Gana quien junte <strong>más puntos en ${MESES_TXT[hoy.getMonth()]}</strong>; el 1 de ${MESES_TXT[fin.getMonth()]} empieza de cero (quedan ${quedan} ${quedan === 1 ? 'día' : 'días'}).</small>
      ${mia ? `<div class="rk-mio"><span class="rk-mio-pos">${mia.puntos ? `#${mia.posicion}<small>de ${filas.length}</small>` : '0<small>puntos</small>'}</span><span>${estado}</span></div>` : ''}</div>
    ${top.length && top[0].puntos > 0 ? `<div class="podio">${lugar(top[1], 2)}${lugar(top[0], 1)}${lugar(top[2], 3)}</div>` : '<div style="height:16px"></div>'}
    <div class="panel p-noche lista-rk">${filas.map((f) => `<div class="rk ${f.codigo === yo ? 'yo' : ''}"><span class="pos">${f.posicion}</span>${avatar(f.nombre, f, 42)}
      <div class="txt"><b>${f.codigo === yo ? 'Tú' : esc(dosNombres(f.nombre))}</b><span>${detalle(f)}</span></div><span class="p">${nf.format(f.puntos)}<small>pts</small></span></div>`).join('') || vacio('Sin rivales', '')}</div>
    <p class="muted" style="text-align:center;font-size:12px;margin-top:10px">Puntos ganados en ${MESES_TXT[hoy.getMonth()]}. Toca el signo de pregunta para ver cómo funciona cada ranking.</p>`;
  fotosPendientes(cont);
  $('#rk-info', cont).onclick = () => hojaRankings(b);
  $$('#seg-arena [data-a]', cont).forEach((x) => (x.onclick = () => { S.arena = x.dataset.a; pintarArena(cont); }));
  const mio = $('.rk.yo', cont);
  if (mio && filas.length > 8) setTimeout(() => mio.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
}

/* ============================================================ MERCADO */
function confirmarCanje(p, saldo) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="hoja" style="text-align:center"><div class="asa"></div>
    <div class="icono-premio" style="width:90px;height:90px;margin:0 auto;border-radius:30px;display:grid;place-items:center;background:rgba(255,255,255,.25);border:3px solid #fff">${ic(ICONO_PREMIO[p.icono] || 'regalo')}</div>
    <h2 class="num" style="font-size:28px;margin:12px 0 4px">${esc(p.nombre)}</h2><p style="margin:0 0 16px">${esc(p.descripcion)}</p>
    <p style="margin:0 0 18px">Pagas <b>${nf.format(p.costo)}</b> monedas · te quedan <b>${nf.format(saldo - p.costo)}</b></p>
    <div class="fila-acciones" style="justify-content:center"><button class="b3 gris" data-cerrar>Ahora no</button><button class="b3 oro" id="c-ok">${coin()} ¡Canjear!</button></div></div>`;
  document.body.appendChild(velo);
  velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-cerrar]')) velo.remove(); });
  $('#c-ok', velo).onclick = async (e) => {
    const boton = e.currentTarget;
    boton.disabled = true;
    try {
      await api('/api/canjes', { method: 'POST', body: JSON.stringify({ premio_id: p.id }) });
      velo.remove();
      Juego.Sonido.nivel(); Juego.vibrar([60, 40, 120]); Juego.confeti({ cantidad: 180, fuerza: 1.2 });
      toast('¡Canjeado! El administrador te lo entregará pronto');
      await cargarBase(); vistaTienda();
    } catch (er) { toast(er.message, true); boton.disabled = false; }
  };
}

/* ============================================================ PERFIL */
/* ============================================================ TEMPORADA */
async function vistaTemporada() {
  const v = $('#vista');
  const b = S.base || await cargarBase();
  const p = b.pase;
  const nodos = Array.from({ length: p.total }, (_, i) => {
    const n = i + 1, rec = p.recompensas[String(n)] || [];
    const estado = n <= p.escalon ? 'hecho' : n === p.escalon + 1 ? 'actual' : '';
    const premio = rec.length ? rec.map((x) => ({ color: 'Color', marco: 'Marco', titulo: 'Título' }[x.tipo] + ' ' + x.nombre)).join(' + ') : 'Edificio nuevo en tu ciudad';
    return `<div class="nodo ${estado}"><div class="bola">${n <= p.escalon ? ic('check') : n}</div>
      <div class="premio-nodo"><b>${esc(premio)}</b>${nf.format(n * p.cada)} monedas del mes${estado === 'actual' ? ` · te faltan ${nf.format(n * p.cada - p.puntos)}` : ''}</div></div>`;
  }).join('');
  v.innerHTML = `<div class="vista">
    <div class="cab-vista"><button class="atras" id="b-atras" aria-label="Volver">${ic('atras')}</button><div><h1>Temporada ${esc(b.temporada)}</h1><p>Quedan ${b.dias_temporada} días · cada escalón levanta un edificio</p></div></div>
    <div class="panel p-naranja"><div class="brillo"></div>
      <div style="display:flex;align-items:center;gap:14px"><div class="hexa" style="width:64px;height:70px;display:grid;place-items:center;font-family:var(--titulo);font-size:26px;color:#5a3b00;background:linear-gradient(180deg,#ffe57a,#ffcc2e);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)">${p.escalon}</div>
        <div style="flex:1"><b class="num" style="font-size:20px">Escalón ${p.escalon} de ${p.total}</b><div class="barra" style="margin-top:8px"><i style="width:${(p.en_escalon / p.cada) * 100}%"></i></div>
        <small>${p.escalon < p.total ? `${nf.format(p.cada - p.en_escalon)} monedas para el siguiente` : '¡Temporada completa!'}</small></div></div>
      <p style="margin:12px 0 0;font-size:13px">Tus niveles y lo que desbloquees se quedan para siempre. Cada mes empieza una temporada nueva.</p>
    </div>
    <div class="camino" style="margin-top:18px">${nodos}</div>
  </div>`;
  $('#b-atras').onclick = () => irA('perfil');   // se llega desde tu perfil
  const actual = $('.nodo.actual');
  if (actual) setTimeout(() => actual.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
}

/* ============================================================ COMO SE JUEGA */
const GLOSARIO = [
  ['reactivar', 'Despertar un vecino dormido', 'Venderle a un cliente que llevaba {dias_inactivo} días o más sin comprar.', 'p-verde'],
  ['cofre', 'Cobrar un encargo pendiente', 'Que el cliente pague una cotización tuya (en caja o con factura).', 'p-azul'],
  ['seguimiento', 'Reportar una visita', 'Registrar un seguimiento: WhatsApp, Facebook, llamada, visita o correo.', 'p-naranja'],
  ['efectivo', 'Visita con compra', 'El cliente te compra en los {dias_compra} días siguientes a tu seguimiento.', 'p-rosa'],
  ['complementos', 'Combos', 'Vender productos complemento (adhesivos, herrajes, accesorios...).', 'p-morado'],
  ['qr', 'Cobro con QR', 'Que el cliente pague con un pago QR.', 'p-turquesa'],
  ['casa', 'Tu mascota y su cuarto', 'Crece con tus puntos (que nunca se gastan). Cada nivel abre lugares nuevos del cuarto: cama, lámpara, sillón, tecnología...', 'p-morado'],
  ['cartas', 'Tu carta de jugador', 'Cambia cada trimestre y se mide con lo que hiciste el trimestre anterior. Digital: contactos por WhatsApp o Facebook y cobros QR. Cotizador: cotizaciones hechas. Reanimador: clientes reanimados. Complemento: productos complemento vendidos. Cada uno va de 1 a 99 (99 es el top 10% de DE) y la media es el promedio.', 'p-azul'],
  ['sobre', 'Sobres y álbum', 'Cada día que cumples las 3 misiones ganas un sobre con 3 cartas de tus compañeros. Junta el álbum del trimestre.', 'p-rosa'],
  ['bolsa', 'Monedas y tienda', 'Cada punto te da una moneda. Las monedas se gastan en mascotas, ropa, muebles, comida y sobres de cartas; hay objetos de edición limitada que solo se venden un mes.', 'p-naranja'],
  ['escudo', 'El jefe de la semana', 'Cada lunes llega un villano distinto: Don Rezago (se alimenta de los clientes olvidados), La Cotización Olvidada, El Cliente Fantasma, Don Dormilón, La Reina del Regateo y El Sin-Complemento. Cada equipo —tu gremio (Pisos, Plomería, Pintura, Ferretería, Obra Negra) en tu tienda— pelea contra su propio enemigo: Equipo demo A y Equipo demo B tienen villanos distintos. Cada moneda que gana tu equipo le quita vida, y cada villano tiene su debilidad: búscala en la pestaña Jefe para pegarle donde más le duele.', 'p-rosa'],
];
async function vistaReglas() {
  const v = $('#vista');
  v.innerHTML = `<div class="vista">${esqueleto(4, 90)}</div>`;
  let d;
  try { d = await api('/api/reglas'); } catch (e) { v.innerHTML = `<div class="vista">${vacio('No se pudo cargar', e.message, 'aviso')}</div>`; return; }
  const niveles = [...d.reglas.niveles].sort((a, b) => a[0] - b[0]);
  v.innerHTML = `<div class="vista">
    <div class="cab-vista"><button class="atras" id="b-atras" aria-label="Volver">${ic('atras')}</button><div><h1>Cómo se juega</h1><p>Lo que haces en el juego, y lo que significa en la tienda.</p></div></div>
    ${GLOSARIO.map(([i, j, r, c]) => `<div class="panel ${c}" style="display:flex;gap:14px;align-items:center"><div class="brillo"></div><div class="icono-q">${ic(i)}</div>
      <div style="flex:1"><b class="num" style="font-size:18px">${j}</b><div style="font-size:13px">${r.replace('{dias_inactivo}', d.reglas.reactivacion.dias_inactivo).replace('{dias_compra}', d.reglas.seguimiento.dias_compra)}</div></div></div>`).join('')}
    <div class="seccion"><div class="seccion-cab">${coin()}<h2>Cuantas monedas da cada cosa</h2></div>
      <div class="panel p-noche">${d.textos.map((t) => `<div class="muro-item" style="${t.activa ? '' : 'opacity:.5'}"><div class="icono-q" style="background:${COLOR_TIPO[t.tipo] || '#e1211c'}">${ic(ICONO_TIPO[t.tipo] || 'estrella')}</div>
        <div class="txt"><b>${esc(NOMBRE_TIPO[t.tipo] || d.tipos[t.tipo])}</b><span>${esc(t.texto)}</span></div><span class="premio-q">${esc(t.puntos)}</span></div>`).join('')}</div></div>
    <div class="seccion"><div class="seccion-cab">${ic('subir')}<h2>Niveles</h2></div>
      <div class="panel p-azul"><div class="stats" style="grid-template-columns:repeat(${niveles.length},1fr)">${niveles.map((n, i) => `<div class="stat"><b style="font-size:18px">${i + 1}</b><small>${esc(n[1])}<br>${nf.format(n[0])} XP</small></div>`).join('')}</div></div></div>
    <div class="seccion"><div class="panel p-verde" style="font-size:13px"><div class="brillo"></div><b class="num" style="font-size:18px">Juego limpio</b><br>
      Las monedas grandes llegan solo cuando el cliente compra de verdad. Una cotización paga una sola vez. Un vecino despertado cuenta una vez al día.
      Las visitas tienen tope diario y una por cliente al día. Si una venta se cancela en el sistema, sus monedas se retiran. Tus niveles y desbloqueos son para siempre.</div></div>
  </div>`;
  $('#b-atras').onclick = () => irA('perfil');
}
