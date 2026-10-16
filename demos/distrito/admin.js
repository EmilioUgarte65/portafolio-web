/* Distrito — panel del director (administracion). */
'use strict';

function periodosAdmin() {
  const out = [], d = new Date(hoyISO().slice(0, 8) + '01T12:00:00');
  for (let i = 0; i < 3; i++) { out.push(d.toISOString().slice(0, 7)); d.setMonth(d.getMonth() - 1); }
  const asOf = S.estado?.sync?.data_as_of?.slice(0, 7);
  if (asOf && !out.includes(asOf)) out.push(asOf);
  return [...out, 'total'];
}
const nombrePer = (p) => p === 'total' ? 'Historico' : `${MESES[+p.slice(5, 7) - 1]} ${p.slice(0, 4)}`;
S.periodoAdmin = null;

/* "Ver como asesor": el director entra al juego con un jugador de prueba (monedas infinitas) */
async function entrarModoPrueba(reiniciar) {
  try {
    const r = await api('/api/admin/ver-como', { method: 'POST', body: JSON.stringify({ reiniciar }) });
    store.set('sesionDirector', S.sesion);
    S.sesion = { ...r, demo: true }; store.set('sesion', S.sesion);
    S.verAsesor = null; S.base = null; S.vista = 'base';
    render(); window.scrollTo(0, 0);
    toast(reiniciar ? 'Prueba desde cero: monedas infinitas' : 'Modo prueba: monedas infinitas');
  } catch (e) { toast(e.message, true); }
}

/* Hojas de confirmar y de pedir datos (en lugar de confirm/prompt del navegador: en el telefono se ven mejor,
   traen el teclado correcto y dicen claro que va a pasar). Regresan una promesa: true/false o los valores (null si cancela). */
function pedirAdm({ titulo, texto = '', campos = [], boton = 'Aceptar', peligro = false }) {
  return new Promise((listo) => {
    const velo = document.createElement('div');
    velo.className = 'velo velo-adm';
    velo.innerHTML = `<form class="hoja hoja-adm" novalidate><div class="asa"></div>
      <div class="hoja-cab"><h2>${esc(titulo)}</h2><button type="button" class="hud-btn" data-cerrar aria-label="Cerrar">${ic('cerrar')}</button></div>
      ${texto ? `<p class="ha-texto">${texto}</p>` : ''}
      ${campos.map((c, i) => `<div class="campo"><label for="ha-${i}">${esc(c.label)}</label>
        ${c.area ? `<textarea class="input" id="ha-${i}" name="${c.name}" rows="3" placeholder="${esc(c.placeholder || '')}"></textarea>`
          : `<input class="input" id="ha-${i}" name="${c.name}" type="${c.type || 'text'}" ${c.inputmode ? `inputmode="${c.inputmode}"` : ''} ${c.pattern ? `pattern="${c.pattern}"` : ''}
            ${c.maxlength ? `maxlength="${c.maxlength}"` : ''} autocomplete="off" placeholder="${esc(c.placeholder || '')}" value="${esc(c.valor ?? '')}">`}
        ${c.ayuda ? `<small class="ayuda">${esc(c.ayuda)}</small>` : ''}<small class="error-msg" data-err hidden></small></div>`).join('')}
      <div class="fila-acciones"><button type="button" class="b3 gris" data-cerrar>Cancelar</button><button type="submit" class="b3 ${peligro ? 'rojo' : 'verde'}">${esc(boton)}</button></div></form>`;
    document.body.appendChild(velo);
    const f = $('form', velo);
    let hecho = false;
    const cerrar = (v) => { if (hecho) return; hecho = true; velo.remove(); listo(v); };
    velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-cerrar]')) cerrar(campos.length ? null : false); });
    // si la hoja se cierra por otro lado (jalandola hacia abajo) la promesa tambien termina
    new MutationObserver((_, ob) => { if (!velo.isConnected) { ob.disconnect(); cerrar(campos.length ? null : false); } }).observe(document.body, { childList: true });
    f.onsubmit = (ev) => {
      ev.preventDefault();
      if (!campos.length) return cerrar(true);
      const vals = {}; let ok = true;
      campos.forEach((c, i) => {
        const el = $('#ha-' + i, f), err = el.parentElement.querySelector('[data-err]');
        const v = el.value.trim(), msg = c.validar ? c.validar(v) : (v ? '' : 'Este dato es obligatorio');
        err.hidden = !msg; err.textContent = msg || ''; el.classList.toggle('mal', !!msg);
        if (msg && ok) { ok = false; el.focus(); }
        vals[c.name] = v;
      });
      if (ok) cerrar(vals);
    };
    setTimeout(() => (campos.length ? $('#ha-0', f) : $('[type=submit]', f))?.focus({ preventScroll: true }), 60);
  });
}
const confirmarAdm = (titulo, texto, boton = 'Sí, continuar', peligro = false) => pedirAdm({ titulo, texto, boton, peligro });

async function vistaAdmin() {
  const v = $('#vista');
  const tab = S.adminTab;
  v.innerHTML = `<div class="vista adm">
    <div class="cab-vista"><div><h1>Panel del administrador</h1><p>Asesores, reglas, premios, tienda e impacto del juego.</p></div></div>
    <div class="ver-como">
      <div class="vc-txt"><b>Ver el juego como asesor</b><small class="muted">Con monedas infinitas para probar todo. No aparece en rankings y no toca datos reales.</small></div>
      <div class="vc-acc"><button class="b3 morado chico" id="b-ver-como">${ic('play')}Ver como asesor</button>
      <button class="enlace" id="b-ver-como-limpio" title="Borra lo que compraste y abriste en la prueba">Prueba desde cero</button></div>
    </div>
    <nav class="chips-adm" id="seg-adm" aria-label="Secciones del panel">
      ${[['asesores', 'Asesores', 'equipo'], ['reglas', 'Reglas', 'ajuste'], ['mercado', 'Premios', 'regalo'], ['catalogo', 'Tienda', 'bolsa'], ['canjes', 'Canjes', 'check'], ['comportamiento', 'Comportamiento', 'reloj'], ['impacto', 'Impacto', 'rayo']].map(([k, t, i]) => `<button data-t="${k}" class="${tab === k ? 'activo' : ''}" ${tab === k ? 'aria-current="page"' : ''}>${ic(i)}${t}</button>`).join('')}
    </nav><div id="adm">${esqueleto(3, 90)}</div></div>`;
  $$('#seg-adm [data-t]').forEach((b) => (b.onclick = () => {
    if (S.adminTab === b.dataset.t) return;
    S.adminTab = b.dataset.t; S.compAsesor = null;
    const cab = $('#seg-adm'); if (cab && window.scrollY > cab.offsetTop) window.scrollTo(0, 0);
    vistaAdmin();
  }));
  $('#seg-adm .activo')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  $('#b-ver-como').onclick = () => entrarModoPrueba(false);
  $('#b-ver-como-limpio').onclick = async () => { if (await confirmarAdm('Empezar la prueba desde cero', 'Se borra todo lo que compraste y abriste en el modo prueba. Los datos reales no se tocan.', 'Borrar y empezar', true)) entrarModoPrueba(true); };
  const c = $('#adm');
  try {
    await cargarEstado();
    if (!S.periodoAdmin) S.periodoAdmin = hoyMes();
    if (S.estado?.simulado) $('.cab-vista p', v).innerHTML = `Modo demostracion: el juego cree que hoy es <b>${fechaCorta(S.estado.hoy)} ${S.estado.hoy.slice(0, 4)}</b>.`;
    await ({ asesores: admAsesores, reglas: admReglas, mercado: admPremios, catalogo: admCatalogo, canjes: admCanjes, comportamiento: admComportamiento, impacto: admImpacto }[tab])(c);
  } catch (e) { c.innerHTML = vacio('No se pudo cargar', e.message, 'aviso'); }
}

/* ------------------------------------------------------------ claves por correo (dentro de Asesores) */
async function pintarCorreo(cont, filas) {
  if (!cont) return;
  let d;
  try { d = await api('/api/admin/correo'); } catch (e) { cont.innerHTML = ''; return; }
  cont.innerHTML = `<details class="panel correo-adm" ${store.get('admCorreoAbierto') ? 'open' : ''}>
    <summary><span class="ca-ic">${ic('sobre')}</span><span class="ca-tit"><b>Claves por correo</b>
      <small>${d.configurado ? `${d.auto ? 'Envío automático encendido' : 'Envío automático apagado'} · ${nf.format(d.pendientes)} sin PIN` : 'Falta configurar el correo'}</small></span>${ic('flecha', 'ca-fl')}</summary>
    ${d.configurado ? `<p class="muted ca-desde">Se mandan desde <b>${esc(d.remitente)}</b>${d.app_url ? ` con la liga <b>${esc(d.app_url)}</b>` : ' · <b>falta APP_URL</b> en .env (la liga que va en el correo)'}.</p>`
      : `<p class="error-msg" style="margin:0 0 10px">Falta configurar el correo en el archivo .env: Microsoft 365 (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET y MAIL_FROM) o SMTP, y APP_URL.</p>`}
    ${d.prueba ? `<div class="aviso" style="margin:0 0 10px"><span><b>Modo prueba:</b> todos los correos llegan a <b>${esc(d.prueba)}</b>; ningún asesor recibe nada.</span></div>` : ''}
    <label class="ca-auto"><span><b>Envío automático</b><small>A cada asesor nuevo sin PIN se le manda su clave después de cada sincronización.</small></span>
      <input type="checkbox" class="sw-adm" id="c-auto" ${d.auto ? 'checked' : ''} ${d.configurado ? '' : 'disabled'}></label>
    <button class="b3 verde chico ancho" id="c-mandar" ${d.configurado && d.pendientes ? '' : 'disabled'}>${ic('sobre')}Mandar clave a los que no tienen PIN (${nf.format(d.pendientes)})</button>
    <div class="ca-prueba"><input class="input" id="c-para" type="email" inputmode="email" autocomplete="email" placeholder="Tu correo para una prueba" aria-label="Correo para la prueba">
      <button class="b3 gris chico" id="c-prueba" ${d.configurado ? '' : 'disabled'}>Mandar prueba</button></div>
    ${d.sin_correo.length ? `<details class="ca-mas"><summary><b>${d.sin_correo.length}</b> asesores sin correo en el ERP (no se les puede mandar)</summary>
      <p class="muted" style="margin:6px 0 0">${d.sin_correo.map((a) => esc(`${a.nombre} (${a.codigo})`)).join(', ')}</p></details>` : ''}
    ${d.ultimos.length ? `<details class="ca-mas"><summary>Últimos envíos</summary><table class="tabla-comp t-envios" style="margin-top:6px"><tbody>
      ${d.ultimos.map((u) => `<tr><td class="te-fe">${esc(fechaCorta(u.fecha) + ' ' + u.fecha.slice(11, 16))}</td><td class="te-nom"><b>${esc(dosNombres(u.nombre || u.asesor))}</b></td><td class="te-mail">${esc(u.email || '')}</td>
        <td class="te-est">${u.estado === 'enviado' ? '<span class="chip-ok">Enviado</span>' : `<span class="error-msg">Error: ${esc(u.error || '')}</span>`}</td></tr>`).join('')}</tbody></table></details>` : ''}
  </details>`;
  $('.correo-adm', cont).ontoggle = (e) => store.set('admCorreoAbierto', e.target.open);
  $('#c-auto', cont).onchange = async (e) => {
    try { const r = await api('/api/admin/correo', { method: 'PUT', body: JSON.stringify({ auto: e.target.checked }) });
      toast(r.auto ? 'Envío automático encendido' : 'Envío automático apagado'); } catch (err) { toast(err.message, true); e.target.checked = !e.target.checked; }
  };
  $('#c-mandar', cont).onclick = async (e) => {
    if (!await confirmarAdm('Mandar claves por correo', `A <b>${nf.format(d.pendientes)}</b> asesores sin PIN les llega un correo con su clave para entrar.`, 'Mandar correos')) return;
    e.target.disabled = true;
    try { const r = await api('/api/admin/correo/pines', { method: 'POST', body: '{}' });
      toast(`${r.enviados.length} enviados${r.errores.length ? ` · ${r.errores.length} con error` : ''}`, !!r.errores.length); vistaAdmin(); }
    catch (err) { toast(err.message, true); e.target.disabled = false; }
  };
  $('#c-prueba', cont).onclick = async (e) => {
    const para = $('#c-para', cont).value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) { toast('Escribe un correo válido para mandar la prueba', true); $('#c-para', cont).focus(); return; }
    e.target.disabled = true;
    try { await api('/api/admin/correo/prueba', { method: 'POST', body: JSON.stringify({ para }) }); toast('Correo de prueba enviado a ' + para); }
    catch (err) { toast(err.message, true); }
    e.target.disabled = false;
  };
}

/* ------------------------------------------------------------ comportamiento: qué hace cada asesor en la app */
// nombres legibles de lo que se tocó (los toques se guardan con un nombre corto: tab:base, acc:whatsapp, item:casco...)
const NOMBRE_TOQUE = { 'acc:whatsapp': 'WhatsApp a un cliente', 'acc:llamada': 'Llamar a un cliente', 'acc:reportar': 'Reportar visita',
  'acc:otro': 'Ver otro encargo', 'acc:anterior': 'Encargo anterior', 'tab:base': 'Pestaña Inicio', 'tab:encargos': 'Pestaña Encargos',
  'tab:equipo': 'Pestaña Equipo', 'tab:tienda': 'Pestaña Tienda', '#b-comer': 'Darle de comer', '#b-jugar': 'Jugar con la mascota',
  '#b-banar': 'Bañar a la mascota', '#b-decorar': 'Decorar el cuarto', '#b-lupa': 'Acercarse a la mascota', '#b-diario': 'Bono de llegada',
  '#b-album': 'Álbum de cartas', '#b-mascota': 'Ver su mascota', '#b-visita': 'Reportar visita', 'canvas:cuarto-3d': 'Tocar el cuarto 3D',
  'canvas:vitrina': 'Girar la vitrina' };
const PANTALLA_NOMBRE = { base: 'Inicio', encargos: 'Encargos', equipo: 'Equipo', tienda: 'Tienda', perfil: 'Perfil', temporada: 'Temporada', reglas: 'Reglas', cuarto: 'Cuarto' };
const nombreToque = (o) => NOMBRE_TOQUE[o] || o.replace(/^item:/, 'Artículo: ').replace(/^pestaña:/, 'Tienda › ').replace(/^lugar:/, 'Lugar: ').replace(/^tab:/, 'Pestaña ');
const nombrePantalla = (p) => p.split('/').map((x, i) => (i ? x : PANTALLA_NOMBRE[x] || x)).join(' › ');
// barras horizontales de una serie: el texto va en tinta normal, la barra solo marca la magnitud
const barrasH = (filas, valor, etiqueta, sufijo = '') => {
  const max = Math.max(1, ...filas.map(valor));
  return filas.length ? `<div class="barras-h">${filas.map((f) => `<div class="bh-fila" title="${esc(etiqueta(f))}: ${nf.format(valor(f))}${sufijo}">
    <span class="bh-et">${esc(etiqueta(f))}</span><span class="bh-pista"><i style="width:${Math.max(2, Math.round(100 * valor(f) / max))}%"></i></span>
    <b class="bh-v num">${nf.format(valor(f))}${sufijo}</b></div>`).join('')}</div>` : '<p class="muted">Sin datos todavía.</p>';
};
// columnas por hora o por día (una serie, con su dato al pasar el dedo)
const columnas = (vals, etq) => {
  const max = Math.max(1, ...vals);
  return `<div class="columnas">${vals.map((v, i) => `<span class="col" title="${esc(etq(i))}: ${nf.format(v)}"><i style="height:${v ? Math.max(4, Math.round(100 * v / max)) : 0}%"></i></span>`).join('')}</div>`;
};
S.diasComp = S.diasComp || 30;
async function admComportamiento(c) {
  if (S.compAsesor) return admComportamientoAsesor(c, S.compAsesor);
  const d = await api('/api/admin/comportamiento?dias=' + S.diasComp);
  const t = d.totales, cmp = d.comparativo;
  const poco = d.usos.filter((u) => u.asesores <= Math.max(1, Math.round(t.activos * 0.15))).slice(-10);
  c.innerHTML = `
    <div class="fila-acciones" style="margin-bottom:12px"><span class="muted">Periodo:</span>
      ${[7, 30, 90].map((n) => `<button class="chip-filtro ${S.diasComp === n ? 'activo' : ''}" data-dias="${n}">${n} días</button>`).join('')}</div>
    <div class="tiles-comp">
      <div class="tile"><b class="num">${t.activos}<small>/${t.de}</small></b><span>asesores usaron la app</span></div>
      <div class="tile"><b class="num">${nf.format(t.sesiones)}</b><span>veces que entraron</span></div>
      <div class="tile"><b class="num">${t.activos ? nf.format(Math.round(t.minutos / t.activos)) : 0}</b><span>minutos por asesor</span></div>
    </div>
    ${t.activos ? '' : `<div class="panel" style="margin:12px 0"><p class="muted" style="margin:0">Todavía no hay actividad registrada. Se empieza a juntar en cuanto los asesores usen la app (el administrador y su modo prueba no cuentan).</p></div>`}
    ${cmp ? `<div class="panel" style="margin:12px 0"><h3 style="margin:0 0 4px">Lo que hacen distinto los que más ganan</h3>
      <p class="muted" style="margin:0 0 10px">Promedio del 25 % con más puntos (${cmp.grupo} asesores) contra el 25 % con menos, entre los que usan la app.</p>
      <table class="tabla-comp"><thead><tr><th></th><th>Los de arriba</th><th>Los de abajo</th></tr></thead><tbody>
        ${cmp.metricas.map((m) => `<tr><td>${esc(m.metrica)}</td><td class="num">${nf.format(m.arriba)}</td><td class="num">${nf.format(m.abajo)}</td></tr>`).join('')}</tbody></table>
      <h4 style="margin:14px 0 6px">Botones que usan más los de arriba (% de cada grupo que los toca)</h4>
      <table class="tabla-comp"><thead><tr><th></th><th>Arriba</th><th>Abajo</th></tr></thead><tbody>
        ${cmp.botones.map((b) => `<tr><td>${esc(nombreToque(b.objetivo))}</td><td class="num">${b.arriba}%</td><td class="num">${b.abajo}%</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="panel" style="margin:12px 0"><h3 style="margin:0 0 8px">Qué se usa más</h3><p class="muted" style="margin:0 0 8px">Cuántos asesores tocaron cada cosa.</p>
      ${barrasH(d.usos.slice(0, 15), (u) => u.asesores, (u) => nombreToque(u.objetivo), ' asesores')}</div>
    ${poco.length ? `<div class="panel" style="margin:12px 0"><h3 style="margin:0 0 8px">Casi nadie lo usa</h3>
      ${barrasH(poco, (u) => u.asesores, (u) => nombreToque(u.objetivo), ' asesores')}</div>` : ''}
    <div class="panel" style="margin:12px 0"><h3 style="margin:0 0 8px">Dónde pasan el tiempo</h3>
      ${barrasH(d.pantallas.slice(0, 10), (p) => p.minutos, (p) => nombrePantalla(p.pantalla), ' min')}</div>
    <div class="panel" style="margin:12px 0"><h3 style="margin:0 0 8px">A qué hora usan la app</h3>
      ${columnas(d.horas, (h) => `${h}:00`)}<div class="eje-horas"><span>0 h</span><span>6</span><span>12</span><span>18</span><span>23</span></div></div>
    <div class="panel" style="margin:12px 0"><h3 style="margin:0 0 8px">Cada asesor</h3><p class="muted" style="margin:0 0 8px">Toca un asesor para ver su perfil.</p>
      <input class="input buscar-adm" id="cp-filtro" type="search" placeholder="Buscar asesor" aria-label="Buscar asesor">
      <div class="tabla-x"><table class="tabla-comp t-cada"><thead><tr><th>Asesor</th><th>Días</th><th>Min</th><th>Entradas</th><th>Contactos</th><th>Seguim.</th><th>Puntos</th><th>Última vez</th></tr></thead><tbody>
        ${d.asesores.map((a) => `<tr class="fila-click" data-cod="${esc(a.codigo)}" data-nom="${esc((a.codigo + ' ' + a.nombre).toLowerCase())}"><td class="tc-nom"><b>${esc(dosNombres(a.nombre))}</b>${ic('flecha', 'tc-fl')}</td><td class="num" data-l="Días">${a.dias_activos}</td><td class="num" data-l="Min">${nf.format(a.minutos)}</td>
          <td class="num" data-l="Entradas">${nf.format(a.sesiones)}</td><td class="num" data-l="Contactos">${nf.format(a.contactos)}</td><td class="num" data-l="Seguim.">${nf.format(a.seguimientos)}</td><td class="num" data-l="Puntos">${nf.format(a.puntos)}</td>
          <td class="tc-ult" data-l="Última vez">${a.ultima ? esc(fechaCorta(a.ultima) + ' ' + a.ultima.slice(11, 16)) : '<span class="muted">nunca</span>'}</td></tr>`).join('')}</tbody></table></div>
      ${d.asesores.length ? '<p class="muted sin-res" id="cp-vacio" hidden>Ningún asesor coincide con la búsqueda.</p>' : '<p class="muted">Sin asesores en este periodo.</p>'}</div>`;
  $$('[data-dias]', c).forEach((b) => (b.onclick = () => { S.diasComp = +b.dataset.dias; admComportamiento(c); }));
  $$('[data-cod]', c).forEach((r) => (r.onclick = () => { S.compAsesor = r.dataset.cod; c.innerHTML = esqueleto(3, 90); admComportamiento(c).catch((e) => (c.innerHTML = vacio('No se pudo cargar', e.message, 'aviso'))); window.scrollTo(0, 0); }));
  $('#cp-filtro', c).oninput = (e) => {
    const q = e.target.value.trim().toLowerCase(); let n = 0;
    $$('.t-cada tbody tr', c).forEach((tr) => { const si = tr.dataset.nom.includes(q); tr.hidden = !si; n += si; });
    const vac = $('#cp-vacio', c); if (vac) vac.hidden = !!n;
  };
}
async function admComportamientoAsesor(c, cod) {
  const d = await api(`/api/admin/comportamiento/asesor?asesor=${encodeURIComponent(cod)}&dias=${S.diasComp}`);
  const r = d.resumen, maxEmb = Math.max(1, ...d.embudo.map((e) => e.n));
  c.innerHTML = `
    <button class="enlace" id="b-volver-comp">${ic('atras')} Todos los asesores</button>
    <div class="cab-vista" style="margin:8px 0"><div><h2 style="margin:0">${esc(d.asesor.nombre)}</h2>
      <p class="muted" style="margin:0">${esc(d.asesor.tienda || '')} · ${esc(d.asesor.especialidad || '')} · últimos ${d.dias} días</p></div></div>
    <div class="tiles-comp">
      <div class="tile"><b class="num">${r.dias_activos}</b><span>días que entró</span></div>
      <div class="tile"><b class="num">${nf.format(r.minutos)}</b><span>minutos en la app</span></div>
      <div class="tile"><b class="num">${nf.format(r.puntos)}</b><span>puntos ganados</span></div>
    </div>
    <div class="panel" style="margin:12px 0"><h3 style="margin:0 0 8px">Actividad por día (minutos)</h3>
      ${columnas(d.actividad.map((a) => a.minutos), (i) => fechaCorta(d.actividad[i].fecha))}</div>
    <div class="panel" style="margin:12px 0"><h3 style="margin:0 0 8px">Su embudo con clientes</h3>
      ${d.embudo.map((e) => `<div class="bh-fila" title="${esc(e.paso)}: ${e.n}"><span class="bh-et">${esc(e.paso)}</span>
        <span class="bh-pista"><i style="width:${Math.max(2, Math.round(100 * e.n / maxEmb))}%"></i></span><b class="bh-v num">${e.n}</b></div>`).join('')}</div>
    <div class="panel" style="margin:12px 0"><h3 style="margin:0 0 8px">Dónde pasa el tiempo</h3>
      ${barrasH(d.pantallas.slice(0, 8), (p) => p.minutos, (p) => nombrePantalla(p.pantalla), ' min')}</div>
    <div class="panel" style="margin:12px 0"><h3 style="margin:0 0 8px">Lo que más toca</h3>
      ${barrasH(d.usos.slice(0, 12), (u) => u.clics, (u) => nombreToque(u.objetivo), '')}</div>
    <div class="panel" style="margin:12px 0"><h3 style="margin:0 0 8px">A qué hora entra</h3>
      ${columnas(d.horas, (h) => `${h}:00`)}<div class="eje-horas"><span>0 h</span><span>6</span><span>12</span><span>18</span><span>23</span></div></div>
    ${d.compras.length ? `<div class="panel" style="margin:12px 0"><h3 style="margin:0 0 8px">Lo que compró en la tienda</h3>
      <table class="tabla-comp"><tbody>${d.compras.map((x) => `<tr><td>${esc(fechaCorta(x.fecha))}</td><td>${esc(x.tipo)} · ${esc(x.clave)}</td><td class="num">${nf.format(x.costo)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="panel" style="margin:12px 0;overflow-x:auto"><h3 style="margin:0 0 8px">Lo último que hizo</h3>
      <table class="tabla-comp"><tbody>${d.ultimos.map((e) => `<tr><td>${esc(fechaCorta(e.ts) + ' ' + e.ts.slice(11, 16))}</td><td>${esc(
        e.tipo === 'clic' ? 'Tocó: ' + nombreToque(e.objetivo) : e.tipo === 'pantalla' ? 'Abrió ' + nombrePantalla(e.pantalla)
          : e.tipo === 'tiempo' ? `Estuvo ${Math.round(e.ms / 1000)} s en ${nombrePantalla(e.pantalla)}` : e.tipo === 'sesion_inicio' ? 'Entró a la app' : 'Salió de la app')}</td></tr>`).join('') || '<tr><td class="muted">Sin actividad registrada.</td></tr>'}</tbody></table></div>`;
  $('#b-volver-comp').onclick = () => { S.compAsesor = null; admComportamiento(c); };
}

/* ------------------------------------------------------------ asesores */
async function admAsesores(c) {
  const d = await api('/api/admin/asesores?periodo=' + S.periodoAdmin);
  const sync = S.estado?.sync || {};
  const filas = d.filas;
  const activos = filas.filter((f) => f.activo), sinPin = activos.filter((f) => !f.pin).length;
  const filtro = S.admFiltroAs || 'todos';
  c.innerHTML = `
    <div class="panel p-azul sync-adm"><div class="sa-fila">
      <div class="sa-txt"><b class="num">Ventas al ${sync.data_as_of ? fechaCorta(sync.data_as_of) + ' ' + sync.data_as_of.slice(0, 4) : '—'}</b>
        <small>${S.estado?.sincronizando ? '<span class="punto-vivo"></span>Sincronizando ahora…' : sync.terminado ? `Última lectura del ERP ${esc(fechaCorta(sync.terminado.slice(0, 10)) + ' ' + sync.terminado.slice(11, 16))} · ${nf.format(sync.ventas || 0)} ventas en ${nf.format(sync.segundos || 0)} s` : 'Nunca sincronizado'}</small>
        ${S.estado?.error_sync ? `<div class="error-msg">${esc(S.estado.error_sync)}</div>` : ''}</div>
      <div class="sa-acc"><button class="b3 blanco chico" id="a-sync" ${S.estado?.sincronizando ? 'disabled' : ''}>${ic('refrescar')}Sincronizar</button>
      <button class="b3 blanco chico" id="a-csv" aria-label="Descargar CSV">${ic('descargar')}CSV</button></div>
    </div>${avisoDatos()}</div>
    <div class="kpis kpis-adm">
      <div class="kpi panel"><small>Asesores que juegan</small><b class="num">${nf.format(activos.length)}</b><small>de ${nf.format(filas.length)} en la lista</small></div>
      <div class="kpi panel ${sinPin ? 'k-alerta' : ''}"><small>Sin PIN</small><b class="num">${nf.format(sinPin)}</b><small>${sinPin ? 'aún no pueden entrar con PIN' : 'todos tienen PIN'}</small></div>
      <div class="kpi panel"><small>Monedas · ${esc(nombrePer(S.periodoAdmin))}</small><b class="num">${nf.format(activos.reduce((t, f) => t + (f.puntos || 0), 0))}</b><small>entre los que juegan</small></div>
      <div class="kpi panel"><small>Documentos 90 días</small><b class="num">${nf.format(activos.reduce((t, f) => t + (f.docs_90d || 0), 0))}</b><small>ventas en el ERP</small></div>
    </div>
    <div id="a-correo"></div>
    <div class="seccion"><div class="barra-adm">
      <div class="ba-fila"><label class="sr" for="a-per">Periodo</label><select class="input" id="a-per">${periodosAdmin().map((p) => `<option value="${p}" ${p === S.periodoAdmin ? 'selected' : ''}>${nombrePer(p)}</option>`).join('')}</select>
        <input class="input buscar-adm" id="a-filtro" type="search" placeholder="Buscar por nombre o código" aria-label="Buscar asesor"></div>
      <div class="ba-fila"><div class="filtros-adm" role="group" aria-label="Filtrar">${[['todos', 'Todos'], ['sinpin', 'Sin PIN'], ['nojuegan', 'No juegan']].map(([k, t]) => `<button class="chip-filtro ${filtro === k ? 'activo' : ''}" data-fil="${k}">${t}</button>`).join('')}</div>
        <span class="muted ba-cuenta" id="a-cuenta"></span></div>
      <button class="b3 oro chico ancho-movil" id="a-pines">${ic('candado')}Generar PIN a quien no tenga</button>
    </div>
    <div class="tabla-wrap t-cartas"><table class="tabla t-ases"><thead><tr><th>Juega</th><th>Código</th><th>Nombre</th><th>Tienda</th><th class="r">Docs 90d</th><th class="r">Monedas</th><th>PIN</th><th></th></tr></thead>
    <tbody id="a-tbody">${filas.map((f) => `<tr data-cod="${esc(f.codigo)}" data-nom="${esc((f.codigo + ' ' + f.nombre).toLowerCase())}" data-tienepin="${f.pin ? 1 : 0}" data-on="${f.activo ? 1 : 0}">
      <td class="ta-act"><button class="interruptor ${f.activo ? 'on' : ''}" data-act aria-label="Participa en el juego" title="Participa en el juego"></button><small>Juega</small></td>
      <td class="num ta-cod">${esc(f.codigo)}</td><td class="ta-nom"><b>${esc(f.nombre)}</b></td><td class="ta-tie">${esc(tiendaNombre(f.tienda))}</td>
      <td class="r ta-docs" data-l="Docs 90d">${nf.format(f.docs_90d)}</td><td class="r num ta-mon" data-l="Monedas">${nf.format(f.puntos)}</td>
      <td class="ta-pin" data-l="PIN">${f.pin ? '<span class="chip-ok">Sí</span>' : '<span class="chip-no">No</span>'}</td>
      <td class="ta-acc"><div class="fila-acciones"><button class="b3 gris chico" data-pin>${ic('candado')}PIN</button><button class="b3 morado chico" data-ver>${ic('play')}Ver juego</button><button class="b3 gris chico" data-aju>${ic('efectivo')}Ajuste</button></div></td></tr>`).join('')}</tbody></table>
    </div><div id="a-vacio" hidden>${vacio('Nadie coincide', 'Prueba con otro nombre, código o filtro.', 'buscar')}</div></div>`;
  const aplicarFiltro = () => {
    const q = $('#a-filtro').value.trim().toLowerCase(), fil = S.admFiltroAs || 'todos'; let n = 0;
    $$('#a-tbody tr').forEach((tr) => {
      const si = tr.dataset.nom.includes(q) && (fil === 'todos' || (fil === 'sinpin' ? tr.dataset.tienepin === '0' : tr.dataset.on === '0'));
      tr.style.display = si ? '' : 'none'; n += si;
    });
    $('#a-cuenta').textContent = `${nf.format(n)} de ${nf.format(filas.length)}`;
    $('#a-vacio').hidden = !!n; $('.t-ases').parentElement.hidden = !n;
  };
  aplicarFiltro();
  $$('[data-fil]', c).forEach((b) => (b.onclick = () => { S.admFiltroAs = b.dataset.fil; $$('[data-fil]', c).forEach((x) => x.classList.toggle('activo', x === b)); aplicarFiltro(); }));
  $('#a-per').onchange = (e) => { S.periodoAdmin = e.target.value; vistaAdmin(); };
  $('#a-sync').onclick = async () => { try { await api('/api/admin/sincronizar', { method: 'POST' }); toast('Leyendo el ERP…'); esperarSync(); } catch (e) { toast(e.message, true); } };
  $('#a-csv').onclick = async () => {
    try {
      const res = await fetch('/api/admin/exportar?periodo=' + S.periodoAdmin, { headers: { Authorization: 'Bearer ' + S.sesion.token } });
      if (!res.ok) throw new Error('No se pudo exportar');
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement('a'), { href: url, download: `puntos-${S.periodoAdmin}.csv` }).click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { toast(e.message, true); }
  };
  $('#a-filtro').oninput = aplicarFiltro;
  pintarCorreo($('#a-correo'), filas);
  $('#a-pines').onclick = async () => {
    if (!await confirmarAdm('Generar PIN', `Se crea un PIN de 6 dígitos para cada asesor que juega y no tiene PIN (${nf.format(sinPin)}). <b>Solo se muestran una vez</b>: tenlos a la mano para entregarlos o imprimirlos.`, 'Generar PIN')) return;
    try { const r = await api('/api/admin/pines', { method: 'POST' }); r.filas.length ? mostrarPines(r.filas) : toast('Todos ya tienen PIN'); } catch (e) { toast(e.message, true); }
  };
  $('#a-tbody').onclick = async (e) => {
    const tr = e.target.closest('tr'); if (!tr) return;
    const cod = tr.dataset.cod, f = filas.find((x) => x.codigo === cod);
    const url = '/api/admin/asesores/' + encodeURIComponent(cod);
    try {
      if (e.target.closest('[data-act]')) {
        const sw = e.target.closest('[data-act]');
        if (f.activo && !await confirmarAdm('Sacar del juego', `<b>${esc(f.nombre)}</b> deja de aparecer en el juego y en los rankings. Puedes volver a encenderlo cuando quieras.`, 'Sacar del juego', true)) return;
        sw.disabled = true;
        try { await api(url, { method: 'POST', body: JSON.stringify({ activo: !f.activo }) }); } finally { sw.disabled = false; }
        f.activo = !f.activo; sw.classList.toggle('on', f.activo); tr.dataset.on = f.activo ? '1' : '0';
        toast(f.activo ? `${dosNombres(f.nombre)} ya juega` : `${dosNombres(f.nombre)} salió del juego`);
      } else if (e.target.closest('[data-pin]')) {
        const r = await pedirAdm({ titulo: 'Cambiar PIN', texto: `PIN nuevo para <b>${esc(f.nombre)}</b> (${esc(cod)}).${f.pin ? ' El PIN que tenía deja de servir.' : ''}`,
          campos: [{ name: 'pin', label: 'PIN nuevo', type: 'password', inputmode: 'numeric', maxlength: 8, placeholder: '4 a 8 dígitos', ayuda: 'Solo números. Dáselo al asesor en persona.',
            validar: (v) => (/^\d{4,8}$/.test(v) ? '' : 'Escribe de 4 a 8 dígitos, solo números') }], boton: 'Guardar PIN', peligro: !!f.pin });
        if (!r) return;
        await api(url, { method: 'POST', body: JSON.stringify({ pin: r.pin }) }); toast('PIN actualizado'); vistaAdmin();
      } else if (e.target.closest('[data-ver]')) {
        S.verAsesor = { codigo: cod, nombre: f.nombre }; S.base = null; S.vista = 'base'; render();
      } else if (e.target.closest('[data-aju]')) {
        const r = await pedirAdm({ titulo: 'Ajuste de monedas', texto: `Para <b>${esc(f.nombre)}</b> · hoy tiene <b>${nf.format(f.puntos)}</b> monedas en ${esc(nombrePer(S.periodoAdmin))}.`,
          campos: [{ name: 'puntos', label: 'Monedas', type: 'text', inputmode: 'numeric', placeholder: 'Ej. 50 o -20', ayuda: 'Positivo suma, con signo menos (-) resta.',
            validar: (v) => (/^-?\d+$/.test(v) && +v !== 0 ? '' : 'Escribe un número entero distinto de cero (ej. 50 o -20)') },
          { name: 'motivo', label: 'Motivo', area: true, placeholder: 'Ej. Venta que el ERP no registró', ayuda: 'Queda guardado junto con el ajuste.' }], boton: 'Aplicar ajuste' });
        if (!r) return;
        await api('/api/admin/ajustes', { method: 'POST', body: JSON.stringify({ asesor: cod, puntos: parseInt(r.puntos, 10), motivo: r.motivo }) });
        toast(`Ajuste aplicado: ${+r.puntos > 0 ? '+' : ''}${nf.format(+r.puntos)} monedas`); vistaAdmin();
      }
    } catch (er) { toast(er.message, true); }
  };
}

function mostrarPines(filas) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="hoja" data-fijo style="max-width:760px"><div class="asa no-print"></div>
    <div class="hoja-cab"><h2>PIN nuevos (${filas.length})</h2><button class="b3 blanco chico no-print" id="p-print">Imprimir</button><button class="hud-btn no-print" data-cerrar>${ic('cerrar')}</button></div>
    <p class="no-print" style="font-size:13px;margin-top:0">Entrégalos a cada asesor. No se volverán a mostrar.</p>
    <div class="tabla-wrap t-cartas"><table class="tabla t-pines"><thead><tr><th>Tienda</th><th>Código</th><th>Nombre</th><th>PIN</th></tr></thead>
    <tbody>${filas.map((f) => `<tr><td class="tp-tie">${esc(tiendaNombre(f.tienda))}</td><td class="tp-cod">${esc(f.codigo)}</td><td class="tp-nom"><b>${esc(f.nombre)}</b></td><td class="num tp-pin">${esc(f.pin)}</td></tr>`).join('')}</tbody></table></div></div>`;
  document.body.appendChild(velo);
  velo.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) { velo.remove(); vistaAdmin(); } });
  $('#p-print', velo).onclick = () => window.print();
}

async function esperarSync() {
  for (let i = 0; i < 90; i++) {
    await espera(4000);
    const e = await cargarEstado();
    if (e && !e.sincronizando) { toast(e.error_sync ? 'Error: ' + e.error_sync : 'Lectura del ERP terminada', !!e.error_sync); if (S.vista === 'admin') vistaAdmin(); return; }
  }
}

/* ------------------------------------------------------------ reglas */
function bloqueRegla(clave, titulo, r, campos, color = '') {
  return `<div class="panel ${color}"><h3>${esc(titulo)}${'activa' in r ? `<button type="button" class="interruptor ${r.activa ? 'on' : ''}" data-onoff="${clave}" aria-label="Activa"></button>` : ''}</h3>
    ${campos.map(([k, t]) => `<div class="campo"><label for="r-${clave}-${k}">${esc(t)}</label><input class="input" id="r-${clave}-${k}" type="number" min="0" ${k.startsWith('factor') ? 'step="any" inputmode="decimal"' : 'step="1" inputmode="numeric"'} required name="${clave}.${k}" data-r="${clave}" value="${r[k]}"></div>`).join('')}</div>`;
}
async function admReglas(c) {
  const R = (await api('/api/reglas')).reglas;
  c.innerHTML = `<form id="f-reglas">
    <div class="panel p-morado" style="margin-bottom:14px"><div class="fila-acciones">
      <div class="campo" style="margin:0"><label for="r-inicio">El juego cuenta desde</label><input class="input" id="r-inicio" type="date" name="inicio" value="${esc(R.inicio)}"></div>
      <div class="campo" style="margin:0;flex:1;min-width:220px"><label for="r-excl">Códigos que no juegan</label><input class="input" id="r-excl" name="excluidos" value="${esc(R.asesores_excluidos.join(', '))}" autocapitalize="characters">
        <small class="ayuda">Separados por coma, ej. ECOMMERCE, 1234</small></div>
    </div></div>
    <p class="muted ayuda-reglas">Cambia los números y toca <b>Guardar y recalcular</b> abajo. El interruptor de cada tarjeta enciende o apaga esa regla.</p>
    <div class="form-reglas">
      ${bloqueRegla('prospeccion', 'Cliente nuevo (prospección)', R.prospeccion, [['puntos', 'Monedas']], 'p-verde')}
      ${bloqueRegla('retencion', 'Cliente que regresa (retención)', R.retencion, [['puntos', 'Monedas'], ['dias_max', 'Vuelve en menos de (días)']], 'p-verde')}
      ${bloqueRegla('desarrollo', 'Cliente que crece (desarrollo)', R.desarrollo, [['puntos', 'Monedas'], ['factor', 'Compra estas veces su promedio'], ['min_compras', 'Con al menos (compras previas)']], 'p-verde')}
      ${bloqueRegla('reactivacion', 'Despertar vecino (reactivación)', R.reactivacion, [['puntos', 'Monedas'], ['min_compras', 'Recurrente: mínimo de compras (días distintos)'], ['min_meses', 'Recurrente: en al menos (meses distintos)'], ['factor_ritmo', 'Dormido: veces su tiempo normal entre compras'], ['dias_minimo', 'Dormido: mínimo de días sin comprar'], ['dias_inactivo', 'Respaldo: cualquier cliente que vuelve tras (días)']], 'p-verde')}
      ${bloqueRegla('cotizacion', 'Encargo cobrado (cotización pagada)', R.cotizacion, [['puntos', 'Monedas por cotización pagada']], 'p-azul')}
      ${bloqueRegla('seguimiento', 'Visita reportada (seguimiento)', R.seguimiento, [['puntos', 'Monedas'], ['max_por_dia', 'Máximo con monedas al día'], ['bono_compra', 'Bono si compra'], ['dias_compra', 'Días para que compre'], ['vigencia_dias', 'Vigencia de una cotización (días, si el ERP no la trae)'], ['aviso_vence_dias', 'Encargo pendiente: vence en los próximos (días; 2 = hoy, mañana y pasado mañana)']], 'p-naranja')}
      ${bloqueRegla('complementos', 'Combos (complementos)', R.complementos, [['cada', 'Cada cuantos productos'], ['puntos', 'Monedas por meta']], 'p-morado')}
      ${bloqueRegla('ventas_pequenas', 'Gemas (ventas pequeñas)', R.ventas_pequenas, [['importe_max', 'Importe menor a $ (sin IVA)'], ['cada', 'Cada cuantas ventas'], ['puntos', 'Monedas por meta']], 'p-turquesa')}
      ${bloqueRegla('retos', 'Contratos semanales (retos)', R.retos, [['puntos', 'Monedas por contrato'], ['bono_completo', 'Bono por los 3'], ['aumento', '% arriba de su promedio'], ['min_reactivar', 'Mínimo vecinos'], ['min_seguimientos', 'Mínimo visitas'], ['min_complementos', 'Mínimo combos']], 'p-verde')}
      ${bloqueRegla('misiones', 'Misiones diarias', R.misiones, [['puntos', 'Puntos por misión']], 'p-azul')}
      ${bloqueRegla('sorpresa', 'Cofre del día (al completar las 3 misiones)', R.sorpresa, [['min', 'Premio mínimo'], ['max', 'Premio máximo']], 'p-amarillo')}
      <div class="panel p-turquesa"><h3>Pago con QR<button type="button" class="interruptor ${R.qr.activa ? 'on' : ''}" data-onoff="qr"></button></h3>
        <div class="campo"><label>Puntos por venta con QR</label><input class="input" type="number" min="0" name="qr.puntos" data-r="qr" value="${R.qr.puntos}"></div>
        <div class="campo"><label>Formas de pago del ERP que cuentan como QR (códigos)</label><input class="input" name="qr.formas" value="${esc(R.qr.formas_pago.join(', '))}"></div></div>
      ${bloqueRegla('racha', 'Racha de misiones (y crecimiento de la mascota)', R.racha, [['cada', 'Premio cada N días hábiles'], ['puntos', 'Monedas']], 'p-naranja')}
      ${bloqueRegla('aplausos', 'Aplausos', R.aplausos, [['puntos', 'Monedas por aplauso'], ['max_recibidos_dia', 'Max. recibidos al día'], ['max_dados_dia', 'Max. dados al día']], 'p-rosa')}
      ${bloqueRegla('meta_equipo', 'Jefe de la semana (meta por gremio)', R.meta_equipo, [['porcentaje_extra', '% extra sobre el promedio semanal'], ['semanas_historial', 'Semanas de historial (52 = 4 trimestres)'], ['puntos_por_asesor', 'Vida por asesor al mes (si aún no hay historial)']], 'p-rosa')}
      ${bloqueRegla('pase', 'Temporada (ciudad)', R.pase, [['cada', 'Monedas por escalón'], ['escalones', 'Escalones']], 'p-azul')}
      <div class="panel p-amarillo"><h3>Bono de llegada<button type="button" class="interruptor ${R.diario.activa ? 'on' : ''}" data-onoff="diario"></button></h3>
        <div class="campo"><label>Monedas día 1 a 7 (separadas por coma)</label><input class="input" name="diario.premios" value="${esc(R.diario.premios.join(', '))}"></div></div>
    </div>
    <div class="panel p-noche" style="margin-top:14px"><h3 class="num" style="margin:0 0 10px;font-weight:400">Mensajes de WhatsApp de DE</h3>
      <p style="font-size:12px;margin:0 0 10px">Los usa quien no ha escrito el suyo (cada asesor puede personalizarlo en Encargos). Variables: {cliente} {asesor} {folio} {vence}</p>
      <div class="campo"><label>Cotización por vencer</label><textarea class="input" name="pl.cotizacion_vence">${esc(R.plantillas.cotizacion_vence)}</textarea></div>
      <div class="campo"><label>Cliente dormido</label><textarea class="input" name="pl.reactivar">${esc(R.plantillas.reactivar)}</textarea></div>
    </div>
    <div class="guardar-adm"><span class="ga-txt" id="r-estado">Las monedas se recalculan desde la fecha de inicio con las reglas nuevas.</span><button class="b3 verde" type="submit">${ic('check')}Guardar y recalcular</button></div>
  </form>`;
  const marcar = () => { $('.guardar-adm', c).classList.add('cambios'); $('#r-estado').textContent = 'Tienes cambios sin guardar'; };
  $$('[data-onoff]', c).forEach((b) => (b.onclick = () => { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); marcar(); }));
  $('#f-reglas').oninput = marcar;
  $('#f-reglas').onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    if (!await confirmarAdm('Guardar y recalcular', `Las monedas de todos los asesores se vuelven a calcular desde el <b>${esc(fechaCorta(f.inicio.value))} ${esc(f.inicio.value.slice(0, 4))}</b> con estas reglas. Puede tardar unos segundos.`, 'Guardar y recalcular')) return;
    const nuevas = { inicio: f.inicio.value, asesores_excluidos: f.excluidos.value.split(',').map((x) => x.trim()).filter(Boolean),
      plantillas: { cotizacion_vence: f['pl.cotizacion_vence'].value, reactivar: f['pl.reactivar'].value } };
    for (const k of ['prospeccion', 'retencion', 'desarrollo', 'reactivacion', 'cotizacion', 'seguimiento', 'complementos', 'ventas_pequenas', 'retos', 'sorpresa', 'racha', 'aplausos', 'meta_equipo', 'pase', 'misiones', 'qr']) {
      nuevas[k] = {};
      const sw = f.querySelector(`[data-onoff="${k}"]`); if (sw) nuevas[k].activa = sw.classList.contains('on');
      $$(`[data-r="${k}"]`, f).forEach((i) => (nuevas[k][i.name.split('.')[1]] = Number(i.value)));
    }
    nuevas.qr.formas_pago = f['qr.formas'].value.split(',').map((x) => x.trim()).filter((x) => /^[A-Za-z0-9]{1,10}$/.test(x));
    const premios = f['diario.premios'].value.split(',').map((x) => parseInt(x, 10)).filter((x) => x >= 0);
    nuevas.diario = { activa: f.querySelector('[data-onoff="diario"]').classList.contains('on'), premios: premios.length ? premios : [2, 3, 4, 5, 6, 8, 15] };
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    const txtBtn = btn.innerHTML; btn.innerHTML = 'Guardando…';
    try { const r = await api('/api/admin/reglas', { method: 'PUT', body: JSON.stringify({ reglas: nuevas }) }); toast(`Reglas guardadas · ${nf.format(r.movimientos)} movimientos recalculados`);
      $('.guardar-adm', c).classList.remove('cambios'); $('#r-estado').textContent = 'Guardado. Las monedas ya están recalculadas.'; }
    catch (e) { toast(e.message, true); }
    btn.disabled = false; btn.innerHTML = txtBtn;
  };
}

/* ------------------------------------------------------------ premios */
async function admPremios(c) {
  const d = await api('/api/admin/premios');
  c.innerHTML = `
    <div class="panel p-amarillo"><b class="num" style="font-size:18px">Premios del mercado</b>
      <p style="margin:4px 0 0;font-size:13px">Los asesores canjean monedas por estos premios; tu marcas la entrega en "Canjes". Los de ejemplo vienen apagados: enciende solo los que de verdad vayas a dar.</p></div>
    ${d.filas.length ? `<div class="tabla-wrap t-cartas" style="margin-top:14px"><table class="tabla t-prem"><thead><tr><th>Estado</th><th>Premio</th><th class="r">Costo</th><th class="r">Existencias</th><th class="r">Canjeados</th><th></th></tr></thead>
      <tbody>${d.filas.map((p) => `<tr class="${p.activo ? '' : 'apagado'}"><td class="tp-est">${p.activo ? '<span class="chip-ok">Visible</span>' : '<span class="chip-gris">Apagado</span>'}</td><td class="tp-nom"><b>${esc(p.nombre)}</b>${p.descripcion ? `<small class="muted">${esc(p.descripcion)}</small>` : ''}</td>
        <td class="r num tp-costo" data-l="Costo">${nf.format(p.costo)}</td><td class="r tp-stock" data-l="Existencias">${p.stock === null ? 'Sin límite' : nf.format(p.stock)}</td><td class="r tp-canj" data-l="Canjeados">${nf.format(p.canjeados)}</td>
        <td class="tp-acc"><button class="b3 gris chico" data-edit="${p.id}">${ic('pincel')}Editar</button></td></tr>`).join('')}</tbody></table></div>`
      : vacio('Todavía no hay premios', 'Crea el primero con el botón de abajo.', 'regalo')}
    <button class="b3 verde ancho-movil" id="p-nuevo" style="margin-top:14px">${ic('mas')}Nuevo premio</button>`;
  $('#p-nuevo').onclick = () => editarPremio({});
  $$('[data-edit]', c).forEach((b) => (b.onclick = () => editarPremio(d.filas.find((p) => p.id === +b.dataset.edit))));
}
function editarPremio(p) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<form class="hoja" id="f-premio"><div class="asa"></div><div class="hoja-cab"><h2>${p.id ? 'Editar premio' : 'Nuevo premio'}</h2><button type="button" class="hud-btn" data-cerrar>${ic('cerrar')}</button></div>
    <div class="campo"><label>Nombre</label><input class="input" name="nombre" required value="${esc(p.nombre || '')}"></div>
    <div class="campo"><label>Descripción</label><input class="input" name="descripcion" value="${esc(p.descripcion || '')}"></div>
    <div class="dos-campos"><div class="campo"><label>Costo en monedas</label><input class="input" name="costo" type="number" inputmode="numeric" min="1" required value="${p.costo || ''}"></div>
      <div class="campo"><label>Existencias</label><input class="input" name="stock" type="number" inputmode="numeric" min="0" value="${p.stock ?? ''}" placeholder="Sin límite"><small class="ayuda">Vacío = sin límite</small></div></div>
    <div class="campo"><label>Ícono</label><select class="input" name="icono">${Object.keys(ICONO_PREMIO).map((k) => `<option ${p.icono === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
    <label class="ca-auto"><span><b>Visible en el mercado</b><small>Si lo apagas, los asesores ya no lo ven ni lo pueden canjear.</small></span><input type="checkbox" class="sw-adm" name="activo" ${p.id ? (p.activo ? 'checked' : '') : 'checked'}></label>
    <div class="fila-acciones"><button class="b3 gris" type="button" data-cerrar>Cancelar</button><button class="b3 verde" type="submit">${ic('check')}Guardar</button></div></form>`;
  document.body.appendChild(velo);
  velo.addEventListener('click', (e) => { if (e.target === velo || e.target.closest('[data-cerrar]')) velo.remove(); });
  $('#f-premio', velo).onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.target, btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await api('/api/admin/premios', { method: 'POST', body: JSON.stringify({ id: p.id, nombre: f.nombre.value, descripcion: f.descripcion.value, costo: f.costo.value, stock: f.stock.value, icono: f.icono.value, activo: f.activo.checked }) });
      velo.remove(); toast('Premio guardado'); vistaAdmin();
    } catch (e) { toast(e.message, true); btn.disabled = false; }
  };
}

/* ------------------------------------------------------------ tienda (catalogo de articulos) */
async function admCatalogo(c) {
  const d = await api('/api/admin/catalogo');
  // primero lo de la mascota y su cuarto; colores y marcos eran del avatar viejo y ya no se muestran
  const ORDEN = ['monstruo', 'cabeza', 'cara', 'cuello', 'espalda', 'torso', 'cama', 'sillon', 'tapete', 'planta', 'lampara', 'cuadro', 'tech', 'deco', 'pared', 'piso', 'pelaje', 'ojos', 'titulo'];
  const grupos = {};
  d.filas.filter((f) => ORDEN.includes(f.tipo)).sort((a, b) => ORDEN.indexOf(a.tipo) - ORDEN.indexOf(b.tipo))
    .forEach((f) => (grupos[f.tipo] ||= { nombre: f.tipo_nombre, filas: [] }).filas.push(f));
  const fila = (f) => `<tr data-k="${esc(f.tipo + ':' + f.clave)}" class="${f.oculto ? 'oculto' : ''}">
    <td class="tk-nom"><b>${esc(f.nombre)}</b>${f.ajustado ? ' <span class="chip oro chip-aj">Ajustado</span>' : ''}</td><td class="tk-rar"><span class="rareza-adm" style="--r:${({ comun: "#a9a3c2", rara: "#4c8dff", epica: "#a35cff", legendaria: "#ffb020" })[f.rareza] || "#a9a3c2"}">${esc(RAREZA_TXT[f.rareza] || f.rareza)}</span></td>
    <td class="tk-req" data-l="Cómo se consigue">${esc(f.requisito)}${f.agotada ? ' <small class="muted">(agotada)</small>' : ''}${f.requisito !== f.requisito_codigo ? `<br><small class="muted">Original: ${esc(f.requisito_codigo)}</small>` : ''}</td>
    ${f.editable ? `<td class="tk-pre" data-l="Precio"><input class="input" name="precio" type="number" inputmode="numeric" min="0" max="100000" step="1" value="${f.precio ?? ''}" placeholder="${f.precio_codigo ?? ''}" aria-label="Precio de ${esc(f.nombre)}"></td>
      <td class="tk-lim" data-l="Edición limitada (mes)"><input class="input" name="limitada" type="month" value="${f.limitada && f.limitada !== f.limitada_codigo ? f.limitada : ''}" placeholder="${f.limitada_codigo || ''}" aria-label="Mes de edición limitada de ${esc(f.nombre)}">${f.limitada_codigo ? `<small class="muted">Del juego: ${esc(f.limitada_codigo)}</small>` : ''}</td>`
      : `<td colspan="2" class="tk-nota"><small class="muted">${f.ocultable ? 'Se gana con logros: solo se puede ocultar' : 'Gratis para todos: no se modifica'}</small></td>`}
    <td class="tk-ocu">${f.ocultable ? `<label class="lbl-check"><input type="checkbox" name="oculto" ${f.oculto ? 'checked' : ''}> Oculto</label>` : ''}</td>
    <td class="r tk-due" data-l="Lo tienen">${nf.format(f.duenos)}</td>
    <td class="tk-acc">${f.ocultable ? `<div class="fila-acciones"><button class="b3 verde chico" data-guardar>Guardar</button>${f.ajustado ? '<button class="b3 gris chico" data-restaurar>Original</button>' : ''}</div>` : ''}</td></tr>`;
  c.innerHTML = `
    <div class="panel p-amarillo"><b class="num" style="font-size:18px">Tienda de la mascota</b>
      <p style="margin:4px 0 0;font-size:13px">Cambia precios, elige en qué mes se vende cada edición limitada (vacío = la del juego o ninguna) y oculta artículos. Quien ya compró un artículo oculto lo conserva. Los diseños 3D no cambian.</p></div>
    <div class="barra-adm"><div class="ba-fila"><select class="input" id="t-grupo" aria-label="Grupo"><option value="">Todos los grupos</option>${Object.entries(grupos).map(([k, g]) => `<option value="${esc(k)}">${esc(g.nombre)} (${g.filas.length})</option>`).join('')}</select>
      <input class="input buscar-adm" id="t-filtro" type="search" placeholder="Buscar artículo" aria-label="Buscar artículo"></div></div>
    ${Object.entries(grupos).map(([k, g]) => `<div class="seccion" data-grupo="${esc(k)}"><h3 class="grupo-tit">${esc(g.nombre)} <small class="muted">${g.filas.length}</small></h3>
      <div class="tabla-wrap t-cartas"><table class="tabla t-cat"><thead><tr><th>Artículo</th><th>Rareza</th><th>Cómo se consigue</th><th>Precio</th><th>Edición limitada (mes)</th><th>Visible</th><th class="r">Lo tienen</th><th></th></tr></thead>
      <tbody>${g.filas.map(fila).join('')}</tbody></table></div></div>`).join('')}
    <div id="t-vacio" hidden>${vacio('Nada coincide', 'Prueba con otro nombre o grupo.', 'buscar')}</div>`;
  const filtrar = () => {
    const t = $('#t-filtro').value.trim().toLowerCase(), gr = $('#t-grupo').value; let total = 0;
    $$('[data-grupo]', c).forEach((sec) => {
      let n = 0;
      if (!gr || sec.dataset.grupo === gr) $$('tr[data-k]', sec).forEach((tr) => { const si = tr.textContent.toLowerCase().includes(t); tr.style.display = si ? '' : 'none'; n += si; });
      sec.hidden = !n; total += n;
    });
    $('#t-vacio').hidden = !!total;
  };
  $('#t-filtro').oninput = filtrar;
  $('#t-grupo').onchange = filtrar;
  const enviar = async (tr, cuerpo) => {
    const [tipo, clave] = tr.dataset.k.split(':');
    $$('button', tr).forEach((b) => (b.disabled = true));
    try { await api('/api/admin/catalogo', { method: 'PUT', body: JSON.stringify({ tipo, clave, ...cuerpo }) }); toast('Tienda actualizada'); vistaAdmin(); }
    catch (e) { toast(e.message, true); $$('button', tr).forEach((b) => (b.disabled = false)); }
  };
  $$('[data-guardar]', c).forEach((b) => (b.onclick = () => {
    const tr = b.closest('tr'), f = d.filas.find((x) => x.tipo + ':' + x.clave === tr.dataset.k);
    const cuerpo = { oculto: $('[name=oculto]', tr).checked };
    if (f.editable) {
      const p = $('[name=precio]', tr).value.trim();
      cuerpo.precio = p === '' || +p === f.precio_codigo ? null : parseInt(p, 10);
      cuerpo.limitada = $('[name=limitada]', tr).value || null;
    }
    enviar(tr, cuerpo);
  }));
  // lo que cambias en una tarjeta enciende su boton Guardar (en el telefono solo aparece entonces)
  const marcarCambio = (e) => { const tr = e.target.closest('tr[data-k]'); if (tr) tr.classList.add('cambio'); };
  c.addEventListener('input', marcarCambio); c.addEventListener('change', marcarCambio);
  $$('[data-restaurar]', c).forEach((b) => (b.onclick = async () => {
    const tr = b.closest('tr');
    if (await confirmarAdm('Volver al original', `<b>${esc($('.tk-nom b', tr).textContent)}</b> regresa a su precio, mes y visibilidad del juego.`, 'Volver al original', true)) enviar(tr, { precio: null, limitada: null, oculto: false });
  }));
}

/* ------------------------------------------------------------ canjes */
async function admCanjes(c) {
  const est = S.canjeFiltro || 'pendiente';
  const d = await api('/api/admin/canjes?estado=' + est);
  const NOM_EST = { pendiente: 'Pendientes', entregado: 'Entregados', rechazado: 'Rechazados', todos: 'Todos' };
  c.innerHTML = `<div class="segmentos seg-canjes" id="seg-cj">${['pendiente', 'entregado', 'rechazado', 'todos'].map((k) => `<button data-e="${k}" class="${est === k ? 'activo' : ''}">${NOM_EST[k]}</button>`).join('')}</div>
    ${d.filas.length ? `<div class="tabla-wrap t-cartas" style="margin-top:14px"><table class="tabla t-canj"><thead><tr><th>Fecha</th><th>Asesor</th><th>Tienda</th><th>Premio</th><th class="r">Monedas</th><th>Estado</th><th></th></tr></thead>
    <tbody>${d.filas.map((x) => `<tr><td class="tc-fe">${esc(fechaCorta(x.creado.slice(0, 10)) + ' ' + x.creado.slice(0, 4) + ' · ' + x.creado.slice(11, 16))}</td><td class="tc-as">${esc(x.asesor_nombre || x.asesor)}</td><td class="tc-ti">${esc(tiendaNombre(x.tienda) || '')}</td><td class="tc-pr"><b>${esc(x.nombre)}</b></td><td class="r num tc-mo" data-l="Monedas">${nf.format(x.costo)}</td>
      <td class="tc-es"><span class="estado-canje ec-${x.estado}">${x.estado}</span></td>
      <td class="tc-acc">${x.estado === 'pendiente' ? `<div class="fila-acciones"><button class="b3 verde chico" data-ok="${x.id}">${ic('check')}Entregado</button><button class="b3 gris chico" data-no="${x.id}">Rechazar</button></div>` : x.nota ? `<small class="muted">${esc(x.nota)}</small>` : ''}</td></tr>`).join('')}</tbody></table></div>`
    : vacio(est === 'pendiente' ? 'Nada por entregar' : 'Sin canjes', est === 'pendiente' ? 'Cuando un asesor canjee un premio aparece aquí para que marques la entrega.' : 'No hay canjes con este estado.', 'regalo')}`;
  $$('#seg-cj [data-e]').forEach((b) => (b.onclick = () => { S.canjeFiltro = b.dataset.e; vistaAdmin(); }));
  const resolver = async (id, estado) => {
    const x = d.filas.find((y) => String(y.id) === String(id)) || {};
    const quien = `<b>${esc(x.nombre || 'el premio')}</b> de ${esc(x.asesor_nombre || x.asesor || 'el asesor')}`;
    let nota = '';
    if (estado === 'rechazado') {
      const r = await pedirAdm({ titulo: 'Rechazar canje', texto: `Se rechaza ${quien} y sus <b>${nf.format(x.costo || 0)}</b> monedas se le devuelven.`,
        campos: [{ name: 'nota', label: 'Motivo', area: true, placeholder: 'Ej. Ya no hay existencias', ayuda: 'El asesor verá este motivo.' }], boton: 'Rechazar canje', peligro: true });
      if (!r) return; nota = r.nota;
    } else if (!await confirmarAdm('Marcar como entregado', `Confirma que ya entregaste ${quien}.`, 'Sí, ya lo entregué')) return;
    try { await api('/api/admin/canjes/' + id, { method: 'POST', body: JSON.stringify({ estado, nota }) }); toast('Canje actualizado'); vistaAdmin(); } catch (e) { toast(e.message, true); }
  };
  $$('[data-ok]', c).forEach((b) => (b.onclick = () => resolver(b.dataset.ok, 'entregado')));
  $$('[data-no]', c).forEach((b) => (b.onclick = () => resolver(b.dataset.no, 'rechazado')));
}

/* ------------------------------------------------------------ impacto */
async function admImpacto(c) {
  const d = await api('/api/admin/impacto');
  const k = d.kpis;
  const barras = (filas, valor, etiqueta, cls = '') => {
    const max = Math.max(1, ...filas.map(valor));
    return `<div class="grafica">${filas.map((f) => `<div class="col ${cls}"><span>${valor(f)}</span><div class="barra-col"><i style="height:${(valor(f) / max) * 100}%"></i></div><small>${etiqueta(f)}</small></div>`).join('') || '<p class="muted">Aún sin datos</p>'}</div>`;
  };
  c.innerHTML = `
    <div class="kpis">
      <div class="kpi panel p-azul"><small>Asesores jugando (7 días)</small><b>${nf.format(k.jugando_7d)}</b><small>de ${k.asesores_activos} activos</small></div>
      <div class="kpi panel p-naranja"><small>Con visitas reportadas (7d)</small><b>${nf.format(k.con_seguimiento_7d)}</b></div>
      <div class="kpi panel p-verde"><small>Visitas reportadas (7d)</small><b>${nf.format(k.seguimientos_7d)}</b></div>
      <div class="kpi panel p-rosa"><small>Visitas que terminaron en compra (30d)</small><b>${k.efectividad_30d === null ? '—' : Math.round(k.efectividad_30d * 100) + '%'}</b></div>
      <div class="kpi panel p-morado"><small>Aplausos (7d)</small><b>${nf.format(k.aplausos_7d)}</b></div>
      <div class="kpi panel p-amarillo"><small>Canjes por entregar</small><b>${nf.format(k.canjes_pendientes)}</b></div>
    </div>
    <div class="seccion"><div class="panel p-noche"><b class="num" style="font-size:18px">Visitas reportadas por día (30 días)</b>
      ${barras(d.por_dia, (f) => f.seguimientos, (f) => fechaCorta(f.fecha))}</div></div>
    <div class="seccion"><div class="panel p-noche"><b class="num" style="font-size:18px">Clientes reactivados por semana (del ERP)</b>
      ${barras(d.reactivaciones_semana, (f) => f.n, (f) => fechaCorta(f.lunes), 'azul')}</div></div>
    <div class="aviso">${ic('ayuda')}<span>Para medir el efecto real del juego, compara estas cifras (reactivaciones, cotizaciones pagadas, complementos) contra las semanas anteriores al lanzamiento o contra una tienda piloto que aún no juegue. Revísalo a las 4, 8 y 12 semanas.</span></div>`;
}
