"use strict";
// Web Studio — perfiles de usuario, kit de marca, plantillas, autoguardado/recuperación y métricas.
// Docs: docs/perfiles.md, docs/marca.md, docs/colaboracion.md. Se carga después de app.js (usa window.WDVS).
// API pública para otros módulos (el editor, chat…):
//   WDVS.perfil.actual()                -> {id, nombre, color, avatar, …} (cache; evento "wdvs:perfil-cambiado")
//   WDVS.perfil.pref(clave) / guardarPref(clave, valor)   preferencias del perfil (espacio de trabajo, favoritos…)
//   WDVS.perfil.reciente(tipo, valor)   recientes por perfil
//   WDVS.autoguardado.borrador(pid, clave, datos) / limpiar(pid, clave) / borradores(pid)   (sessionStorage)
//   WDVS.plantillas.guardar(pid, {desde, hasta})   diálogo «Guardar como plantilla» (el editor puede pasar su rango I/O)
(() => {
  const WD = window.WDVS;
  const q = (s, el = document) => el.querySelector(s);
  const qq = (s, el = document) => [...el.querySelectorAll(s)];
  const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ic = (n, t = 16) => (WD.icono ? WD.icono(n, t) : "");
  const api = (...a) => WD.api(...a);
  const enc = encodeURIComponent;
  const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* */ } } };
  const ls = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* */ } }, del: (k) => { try { sessionStorage.removeItem(k); } catch { /* */ } } };
  const min = (m) => m == null ? "–" : m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`;
  const miles = (n) => (n ?? 0).toLocaleString("es-MX");
  // iconos Lucide que faltan en el subconjunto de vendor/lucide (se agregan sin tocar ese archivo)
  if (WD.iconos) {
    const I = WD.iconos, nuevos = {
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
      wifi: '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>',
      palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z"/>',
      package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.7 4.73a2 2 0 0 0 2 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>',
      archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
      pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
      "layout-template": '<rect width="18" height="7" x="3" y="3" rx="1"/><rect width="9" height="7" x="3" y="14" rx="1"/><rect width="5" height="7" x="16" y="14" rx="1"/>',
      "badge-check": '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
      "columns-2": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>',
      "life-buoy": '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
      "circle-dashed": '<circle cx="12" cy="12" r="10" stroke-dasharray="3.2 3"/>',
      megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
      "swatch-book": '<path d="M11 17a4 4 0 0 1-8 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2Z"/><path d="M16.7 13H19a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7"/><path d="M7 17h.01"/><path d="m11 8 2.3-2.3a2.4 2.4 0 0 1 3.4 0L18.6 7.6a2.4 2.4 0 0 1 0 3.4L9.9 19.8"/>',
      "chart-no-axes-column": '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
    };
    const alias = { "settings-2": "sliders-horizontal", "user-pen": "pencil", "message-square-text": "message-square", "message-square-plus": "message-square",
      "message-square-warning": "message-square", "message-square-quote": "message-square", "link-2-off": "ban", "folder-output": "download", "package-open": "upload" };
    for (const [k, v] of Object.entries(nuevos)) if (!I[k]) I[k] = v;
    for (const [k, v] of Object.entries(alias)) if (!I[k] && I[v]) I[k] = I[v];
    // los [data-ico] de index.html ya se hidrataron con el ícono de reemplazo: se rehacen
    qq("[data-ico]").forEach((el) => { if (nuevos[el.dataset.ico] || alias[el.dataset.ico]) el.innerHTML = ic(el.dataset.ico, +(el.dataset.tam || 16)); });
  }

  function dialogo(id, clase, html) {
    let d = q("#" + id);
    if (!d) { d = document.createElement("dialog"); d.id = id; document.body.appendChild(d); }
    d.className = clase; d.innerHTML = html;
    qq("[data-cerrar]", d).forEach((b) => b.onclick = () => d.close());
    WD.hidratarIconos && WD.hidratarIconos(d);
    return d;
  }
  const iniciales = (n) => (n || "?").trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
  const avatarHTML = (p, tam = 40) => `<span class="avatar-perfil" style="--c:${e(p.color || "#F5B82E")};--t:${tam}px">${e(p.avatar || iniciales(p.nombre))}</span>`;

  // ================================================================== estado del perfil
  let perfil = null, estadoSel = null, prefs = {};
  async function cargarPerfil() {
    try { const d = await api("/api/perfiles/actual"); perfil = d; prefs = d.prefs || {}; pintarBoton(); return d; } catch { return null; }
  }
  WD.perfil = {
    actual: () => perfil,
    pref: (k) => prefs[k],
    guardarPref: async (k, v) => { prefs[k] = v; try { await api("/api/perfiles/actual/prefs", { method: "PUT", json: { [k]: v } }); } catch (err) { console.warn(err); } },
    reciente: (tipo, valor) => api("/api/perfiles/actual/reciente", { method: "POST", json: { tipo, valor } }).catch(() => null),
    cambiar: () => mostrarSeleccion(true),
    editar: (pid) => editarPerfil(pid || perfil?.id),
  };

  function pintarBoton() {
    let b = q("#btn-perfil");
    if (!b || !perfil) return;
    b.innerHTML = avatarHTML(perfil, 26);
    b.title = `Perfil: ${perfil.nombre} (cambiar, editar, kit de marca, métricas)`;
    b.setAttribute("aria-label", `Perfil ${perfil.nombre}`);
  }

  // ================================================================== pantalla de selección (al abrir y «Cambiar de perfil»)
  async function mostrarSeleccion(forzar = false, administrar = false) {
    try { estadoSel = await api("/api/perfiles"); } catch (err) { WD.errorToast(err); return false; }
    if (!forzar && (!estadoSel.requiere_seleccion || ss.get("wdvs-perfil-ok") === estadoSel.activo)) return false;
    let p = q("#pantalla-perfiles");
    if (!p) { p = document.createElement("div"); p.id = "pantalla-perfiles"; p.className = "pantalla-perfiles"; p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "true"); p.setAttribute("aria-label", "Elegir perfil"); document.body.appendChild(p); }
    const tarjetas = estadoSel.perfiles.map((x) => `<div class="perfil-tarjeta-caja">
        <button class="perfil-tarjeta" data-id="${e(x.id)}" aria-label="Entrar como ${e(x.nombre)}">${avatarHTML(x, 96)}
          <span class="pt-nombre">${e(x.nombre)}${x.tiene_pin ? ` <span class="pt-candado" title="Con PIN">${ic("lock", 13)}</span>` : ""}</span></button>
        ${administrar ? `<button class="btn chico pt-editar" data-editar="${e(x.id)}">${ic("pencil", 13)} Editar</button>` : ""}
        <form class="pt-pin" data-pin="${e(x.id)}" hidden><input inputmode="numeric" autocomplete="off" maxlength="8" placeholder="PIN" aria-label="PIN de ${e(x.nombre)}"><button class="btn primario chico">Entrar</button></form></div>`).join("");
    p.innerHTML = `<div class="pp-cont"><div class="pp-logo"><span class="logo">WD</span> VideoStudio</div>
      <h1>¿Quién va a editar?</h1>
      <div class="pp-rejilla">${tarjetas}
        <div class="perfil-tarjeta-caja"><button class="perfil-tarjeta nuevo" id="pp-nuevo" aria-label="Agregar perfil"><span class="avatar-perfil vacio" style="--t:96px">${ic("plus", 40)}</span><span class="pt-nombre">Agregar perfil</span></button></div></div>
      <div class="pp-pie"><button class="btn" id="pp-admin">${ic(administrar ? "check" : "settings-2", 14)} ${administrar ? "Listo" : "Administrar perfiles"}</button>
        ${forzar && estadoSel.activo ? `<button class="btn fantasma" id="pp-cerrar">Seguir como ${e((estadoSel.perfiles.find((x) => x.id === estadoSel.activo) || {}).nombre || "")}</button>` : ""}</div>
      <p class="muy-tenue pequeno">Cada perfil tiene sus proyectos, su estilo, sus plugins, su kit de marca y su configuración de IA. La biblioteca de la empresa se comparte.</p></div>`;
    p.hidden = false; document.body.classList.add("con-perfiles");
    qq(".perfil-tarjeta[data-id]", p).forEach((b) => b.onclick = () => elegir(b.dataset.id));
    qq("[data-editar]", p).forEach((b) => b.onclick = () => editarPerfil(b.dataset.editar, () => mostrarSeleccion(true, true)));
    qq("form[data-pin]", p).forEach((f) => f.onsubmit = (ev) => { ev.preventDefault(); elegir(f.dataset.pin, q("input", f).value); });
    q("#pp-nuevo", p).onclick = () => editarPerfil(null, () => mostrarSeleccion(true, administrar));
    q("#pp-admin", p).onclick = () => mostrarSeleccion(true, !administrar);
    const c = q("#pp-cerrar", p); if (c) c.onclick = () => ocultarSeleccion();
    (q(`.perfil-tarjeta[data-id="${CSS.escape(estadoSel.ultimo || estadoSel.activo)}"]`, p) || q(".perfil-tarjeta", p)).focus();
    return true;
  }
  function ocultarSeleccion() { const p = q("#pantalla-perfiles"); if (p) p.hidden = true; document.body.classList.remove("con-perfiles"); }

  async function elegir(pid, pin) {
    const x = estadoSel.perfiles.find((y) => y.id === pid);
    if (x && x.tiene_pin && pin == null) {
      qq("form[data-pin]").forEach((f) => f.hidden = f.dataset.pin !== pid);
      const f = q(`form[data-pin="${CSS.escape(pid)}"]`); q("input", f).value = ""; q("input", f).focus(); return;
    }
    try {
      await api(`/api/perfiles/${enc(pid)}/activar`, { method: "POST", json: { pin: pin || null } });
    } catch (err) {
      if (err.status === 403) { WD.toast("PIN incorrecto", "error", { ms: 2500 }); const f = q(`form[data-pin="${CSS.escape(pid)}"] input`); if (f) { f.value = ""; f.focus(); } return; }
      return WD.errorToast(err);
    }
    ss.set("wdvs-perfil-ok", pid);
    ocultarSeleccion();
    await alCambiarPerfil();
  }

  async function alCambiarPerfil() {
    const antes = perfil?.id;
    await cargarPerfil();
    if (WD.cerrarProyecto && (antes !== perfil?.id || !(WD.proyectoActual && WD.proyectoActual()))) WD.cerrarProyecto();
    window.dispatchEvent(new CustomEvent("wdvs:perfil-cambiado", { detail: { perfil } }));
    revisarRecuperacion();
  }

  // ================================================================== crear / editar / borrar perfil
  async function editarPerfil(pid, despues) {
    if (!estadoSel) estadoSel = await api("/api/perfiles");
    const x = pid ? estadoSel.perfiles.find((y) => y.id === pid) : null;
    const nuevo = !x;
    const p = x || { nombre: "", color: estadoSel.colores[estadoSel.perfiles.length % estadoSel.colores.length], avatar: "" };
    const d = dialogo("dlg-perfil", "dlg-chico dlg-perfil", `<form method="dialog" id="fp">
      <h3>${nuevo ? "Nuevo perfil" : "Editar perfil"}</h3>
      <div class="fp-prev">${avatarHTML(p, 64)}</div>
      <label class="campo">Nombre<input name="nombre" maxlength="40" required value="${e(p.nombre)}" autocomplete="off"></label>
      <div class="campo">Avatar<div class="fp-avatares"><button type="button" data-av="" class="${p.avatar ? "" : "sel"}" title="Iniciales">${e(iniciales(p.nombre || "A"))}</button>
        ${estadoSel.avatares.map((a) => `<button type="button" data-av="${a}" class="${p.avatar === a ? "sel" : ""}">${a}</button>`).join("")}</div></div>
      <div class="campo">Color<div class="fp-colores">${estadoSel.colores.map((c) => `<button type="button" data-col="${c}" style="--c:${c}" class="${(p.color || "").toUpperCase() === c ? "sel" : ""}" aria-label="Color ${c}"></button>`).join("")}</div></div>
      <label class="campo">PIN opcional (4 a 8 números)<input name="pin" inputmode="numeric" maxlength="8" autocomplete="new-password" placeholder="${x?.tiene_pin ? "•••• (déjalo vacío para no cambiarlo)" : "Sin PIN"}"></label>
      ${x?.tiene_pin ? `<label class="campo">PIN actual (para cambiarlo o quitarlo)<input name="pin_actual" inputmode="numeric" maxlength="8" autocomplete="off"></label>
        <label class="interruptor pequeno"><input type="checkbox" name="quitar_pin"> <span>Quitar el PIN</span></label>` : ""}
      ${pid !== "principal" ? `<label class="campo">Carpeta de proyectos<span class="fila sin-margen"><input name="carpeta" placeholder="${e(x?.carpeta_proyectos_efectiva || "Automática")}" value="${e(x?.carpeta_proyectos || "")}"><button type="button" class="btn" id="fp-examinar">${ic("folder-open", 14)}</button></span>
        <small class="tenue">Vacío = automática. Los proyectos de cada perfil viven en su propia carpeta.</small></label>` : `<p class="tenue pequeno">Carpeta de proyectos: <code>${e(x?.carpeta_proyectos_efectiva || "")}</code> (se cambia en Ajustes › General).</p>`}
      <p class="tenue pequeno">${ic("bot", 13)} Modelo y esfuerzo de la IA de este perfil: Ajustes › General (con el perfil activo).</p>
      <p class="muy-tenue pequeno">El PIN evita entrar por error al perfil de otra persona; no cifra los archivos.</p>
      <div class="fila derecha">${!nuevo && pid !== "principal" ? `<button type="button" class="btn peligro" id="fp-borrar">${ic("trash-2", 14)} Borrar perfil…</button><span class="espacio"></span>` : ""}
        <button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario" value="ok">${nuevo ? "Crear perfil" : "Guardar"}</button></div></form>`);
    let av = p.avatar || "", col = p.color;
    const prev = () => { q(".fp-prev", d).innerHTML = avatarHTML({ nombre: q("[name=nombre]", d).value || "?", avatar: av, color: col }, 64); };
    qq("[data-av]", d).forEach((b) => b.onclick = () => { av = b.dataset.av; qq("[data-av]", d).forEach((y) => y.classList.toggle("sel", y === b)); prev(); });
    qq("[data-col]", d).forEach((b) => b.onclick = () => { col = b.dataset.col; qq("[data-col]", d).forEach((y) => y.classList.toggle("sel", y === b)); prev(); });
    q("[name=nombre]", d).oninput = prev;
    const ex = q("#fp-examinar", d); if (ex) ex.onclick = async () => { const r = await WD.elegirNativo({ tipo: "carpeta", filtro: "todo", titulo: "Carpeta de proyectos del perfil" }); if (r && r.length) q("[name=carpeta]", d).value = r[0]; };
    const bb = q("#fp-borrar", d); if (bb) bb.onclick = () => { d.close(); borrarPerfil(x, despues); };
    q("#fp", d).onsubmit = async (ev) => {
      ev.preventDefault();
      const f = ev.target, nombre = f.nombre.value.trim(), pin = f.pin.value.trim();
      try {
        if (nuevo) {
          await api("/api/perfiles", { method: "POST", json: { nombre, color: col, avatar: av, pin: pin || null, carpeta_proyectos: f.carpeta?.value || null } });
          WD.toast(`Perfil «${nombre}» creado`, "ok");
        } else {
          const cambios = { nombre, color: col, avatar: av };
          if (f.carpeta) cambios.carpeta_proyectos = f.carpeta.value.trim();
          if (pin) cambios.pin = pin; else if (f.quitar_pin?.checked) cambios.pin = "";
          await api(`/api/perfiles/${enc(pid)}`, { method: "PUT", json: { cambios, pin_actual: f.pin_actual?.value || null } });
          WD.toast("Perfil guardado", "ok");
        }
        d.close(); estadoSel = await api("/api/perfiles"); await cargarPerfil();
        if (despues) despues();
      } catch (err) { WD.errorToast(err, "No se guardó el perfil"); }
    };
    d.showModal(); q("[name=nombre]", d).focus();
  }

  async function borrarPerfil(x, despues) {
    const d = dialogo("dlg-perfil-borrar", "dlg-chico", `<form id="fb"><h3>¿Borrar el perfil «${e(x.nombre)}»?</h3>
      <p class="pequeno">Su estilo, plugins personales, kit de marca y preferencias se guardan en un respaldo (no se pierden).</p>
      <label class="interruptor"><input type="checkbox" name="conservar" checked> <span>Conservar sus proyectos en <code>${e(x.carpeta_proyectos_efectiva)}</code></span></label>
      <p class="tenue pequeno">Si no los conservas, la carpeta se mueve a una papelera (<code>.papelera_perfiles</code>) junto a ella; puedes recuperarla a mano.</p>
      ${x.tiene_pin ? `<label class="campo">PIN del perfil<input name="pin" inputmode="numeric" maxlength="8" autocomplete="off"></label>` : ""}
      <label class="campo">Escribe <b>${e(x.nombre)}</b> para confirmar<input name="conf" autocomplete="off"></label>
      <div class="fila derecha"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn peligro">Borrar perfil</button></div></form>`);
    q("#fb", d).onsubmit = async (ev) => {
      ev.preventDefault(); const f = ev.target;
      try {
        const r = await api(`/api/perfiles/${enc(x.id)}/borrar`, { method: "POST", json: { confirmar: f.conf.value, conservar_proyectos: f.conservar.checked, pin: f.pin?.value || null } });
        d.close(); WD.toast(r.proyectos_conservados ? "Perfil borrado; sus proyectos siguen en su carpeta." : "Perfil borrado; sus proyectos quedaron en la papelera de perfiles.", "ok", { ms: 7000 });
        await alCambiarPerfil(); if (despues) despues();
      } catch (err) { WD.errorToast(err, "No se borró el perfil"); }
    };
    d.showModal();
  }

  // ================================================================== menú del perfil (barra superior)
  function menuPerfil(ancla) {
    qq(".menu-flotante").forEach((m) => m.remove());
    const m = document.createElement("div"); m.className = "menu-flotante menu-perfil"; m.setAttribute("role", "menu");
    m.innerHTML = `<div class="mp-cab">${avatarHTML(perfil || {}, 34)}<div><b>${e(perfil?.nombre)}</b><div class="tenue pequeno">Perfil activo</div></div></div><hr>
      <button data-a="cambiar" role="menuitem">${ic("users", 15)}<span>Cambiar de perfil</span></button>
      <button data-a="editar" role="menuitem">${ic("user-pen", 15)}<span>Editar mi perfil…</span></button>
      <button data-a="marca" role="menuitem">${ic("swatch-book", 15)}<span>Kit de marca…</span></button>
      <button data-a="plantillas" role="menuitem">${ic("layout-template", 15)}<span>Plantillas…</span></button>
      <button data-a="metricas" role="menuitem">${ic("chart-no-axes-column", 15)}<span>Métricas y tiempo ahorrado</span></button>
      <hr><button data-a="respaldo" role="menuitem">${ic("archive", 15)}<span>Respaldar mis datos ahora</span></button>`;
    document.body.appendChild(m);
    const r = ancla.getBoundingClientRect();
    m.style.top = `${r.bottom + 6}px`; m.style.left = `${Math.max(8, Math.min(innerWidth - 250, r.right - 240))}px`;
    m.onclick = async (ev) => {
      const b = ev.target.closest("[data-a]"); if (!b) return; m.remove();
      const a = b.dataset.a;
      if (a === "cambiar") mostrarSeleccion(true);
      else if (a === "editar") editarPerfil(perfil.id);
      else if (a === "marca") abrirMarca();
      else if (a === "plantillas") abrirPlantillas();
      else if (a === "metricas") WD.abrirAjustes("metricas");
      else if (a === "respaldo") { try { const x = await api("/api/perfiles/respaldo", { method: "POST" }); WD.toast(x.ruta, "ok", { titulo: "Respaldo creado", ms: 9000 }); } catch (err) { WD.errorToast(err); } }
    };
    q("button", m).focus();
    m.onkeydown = (ev) => { const bs = qq("button", m), i = bs.indexOf(document.activeElement);
      if (ev.key === "ArrowDown") { ev.preventDefault(); bs[(i + 1) % bs.length].focus(); } else if (ev.key === "ArrowUp") { ev.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); } else if (ev.key === "Escape") { m.remove(); ancla.focus(); } };
    setTimeout(() => document.addEventListener("click", () => m.remove(), { once: true }), 0);
  }

  // ================================================================== KIT DE MARCA
  let marca = null, ambito = "perfil";
  async function abrirMarca(amb) {
    if (amb) ambito = amb;
    try { marca = await api("/api/marca"); } catch (err) { return WD.errorToast(err); }
    const d = dialogo("dlg-marca", "dlg-grande dlg-marca", `<div class="dlg-cab"><div class="dlg-cab-tit"><span class="t-ico">${ic("swatch-book", 18)}</span><div><h2>Kit de marca</h2>
        <div class="tenue pequeno">Todo video nuevo lo usa: logo, colores, tipografías, intro y outro, marca de agua, música y LUTs.</div></div></div>
        <button class="icono-btn" data-cerrar aria-label="Cerrar">${ic("x")}</button></div>
      <div class="km-barra"><div class="segmentado" role="tablist">${["perfil", "empresa"].map((a) => `<button role="tab" data-amb="${a}" aria-pressed="${a === ambito}">${a === "perfil" ? "Mi kit" : "Empresa (compartido)"}</button>`).join("")}</div>
        <label class="pequeno">Videos nuevos usan <select id="km-origen"><option value="auto">Automático (mi kit; si está vacío, el de la empresa)</option><option value="perfil">Solo mi kit</option><option value="empresa">El de la empresa</option><option value="ninguno">Ninguno</option></select></label></div>
      <div class="km-cuerpo" id="km-cuerpo"></div>`);
    q("#km-origen", d).value = marca.origen;
    q("#km-origen", d).onchange = async (ev) => { await api("/api/marca/origen", { method: "PUT", json: { origen: ev.target.value } }); refrescarMarca(); };
    qq("[data-amb]", d).forEach((b) => b.onclick = () => { ambito = b.dataset.amb; qq("[data-amb]", d).forEach((y) => y.setAttribute("aria-pressed", String(y === b))); pintarMarca(); });
    pintarMarca();
    if (!d.open) d.showModal();
  }
  WD.abrirMarca = abrirMarca;
  async function refrescarMarca() { try { marca = await api("/api/marca"); pintarMarca(); } catch (err) { WD.errorToast(err); } }
  const urlArch = (a) => `/api/marca/${ambito}/archivo/${enc(a)}`;

  function pintarMarca() {
    const k = marca[ambito], c = q("#km-cuerpo");
    const lista = (tipo, xs, campo) => xs.map((x) => `<div class="km-item">${tipo === "logo" ? `<img src="${urlArch(x.archivo)}" alt="">` : `<span class="km-ico">${ic(tipo === "musica" ? "music" : "palette", 16)}</span>`}
        <span class="km-nom" title="${e(x.archivo)}">${e(x.nombre)}</span>
        <label class="pequeno"><input type="radio" name="${tipo}-def" data-def="${tipo}" value="${e(x.archivo)}" ${x[campo] ? "checked" : ""}> ${campo === "principal" ? "principal" : "por defecto"}</label>
        <button class="icono-btn" data-quitar="${tipo}" data-arch="${e(x.archivo)}" aria-label="Quitar ${e(x.nombre)}">${ic("trash-2", 14)}</button></div>`).join("") || `<div class="tenue pequeno">Sin ${tipo === "logo" ? "logos" : tipo === "musica" ? "música" : "LUTs"}.</div>`;
    const clip = (cual) => { const x = k[cual]; return x ? `<div class="km-item"><span class="km-ico">${ic("clapperboard", 16)}</span><span class="km-nom">${e(x.nombre)}</span>
        ${x.dur ? `<label class="pequeno">dura <input type="number" min="0.5" max="15" step="0.5" value="${x.dur}" data-dur="${cual}" style="width:64px"> s</label>` : ""}
        <button class="icono-btn" data-quitar="${cual}" data-arch="${e(x.archivo)}" aria-label="Quitar">${ic("trash-2", 14)}</button></div>` : `<div class="tenue pequeno">Sin ${cual}.</div>`; };
    const tipos = Object.values(k.tipografias || {}).filter((v) => /\.(ttf|otf)$/i.test(v));
    c.innerHTML = `<div class="km-col">
      <section><h4>Identidad</h4>
        <label class="campo">Nombre de la marca<input data-campo="nombre" value="${e(k.nombre)}" placeholder="p. ej. WD"></label>
        <label class="interruptor"><input type="checkbox" data-campo="usar_en_nuevos" ${k.usar_en_nuevos ? "checked" : ""}> <span>Usar en todo video nuevo</span></label></section>
      <section><div class="fila entre"><h4>Logos</h4><button class="btn chico" data-agregar="logo">${ic("plus", 13)} Agregar</button></div>${lista("logo", k.logos, "principal")}</section>
      <section><h4>Colores</h4><div class="km-colores">${["primario", "secundario", "acento", "texto", "fondo"].map((n) => `<label class="km-color"><input type="color" data-color="${n}" value="${e(k.colores[n] || "#000000")}" ${k.colores[n] ? "" : "data-vacio"}><span>${n}</span><small>${e(k.colores[n] || "—")}</small></label>`).join("")}</div></section>
      <section><div class="fila entre"><h4>Tipografías</h4><button class="btn chico" data-agregar="tipografia">${ic("plus", 13)} Fuente (.ttf/.otf)</button></div>
        ${["titulos", "texto"].map((n) => `<label class="campo">${n === "titulos" ? "Títulos" : "Texto"}<input data-tipo="${n}" list="km-fuentes" value="${e(k.tipografias[n] || "")}" placeholder="Archivo del kit o fuente de Windows (p. ej. Montserrat)"></label>`).join("")}
        <datalist id="km-fuentes">${tipos.map((t) => `<option value="${e(t)}">`).join("")}</datalist></section>
      <section><h4>Textos de la marca</h4>${[["cierre", "Texto de cierre"], ["cta", "Llamado a la acción"], ["eslogan", "Eslogan"]].map(([n, t]) => `<label class="campo">${t}<input data-texto="${n}" value="${e(k.textos[n] || "")}"></label>`).join("")}</section>
    </div><div class="km-col">
      <section><div class="fila entre"><h4>Intro</h4><button class="btn chico" data-agregar="intro">${ic("upload", 13)} Elegir</button></div>${clip("intro")}
        <div class="fila entre"><h4>Outro</h4><button class="btn chico" data-agregar="outro">${ic("upload", 13)} Elegir</button></div>${clip("outro")}</section>
      <section><h4>Marca de agua</h4><label class="interruptor"><input type="checkbox" data-ma="activa" ${k.marca_agua.activa ? "checked" : ""}> <span>Poner el logo como marca de agua</span></label>
        <div class="fila"><label class="pequeno">Posición <select data-ma="pos">${marca.posiciones.map((p) => `<option value="${p}" ${k.marca_agua.pos === p ? "selected" : ""}>${p.replace(/_/g, " ").replace("sup", "superior").replace("inf", "inferior").replace("der", "derecha").replace("izq", "izquierda")}</option>`).join("")}</select></label>
          <label class="pequeno">Ancho <input type="number" data-ma="ancho" min="40" max="800" value="${k.marca_agua.ancho}" style="width:70px"> px</label>
          <label class="pequeno">Opacidad <input type="range" data-ma="opacidad" min="0.1" max="1" step="0.05" value="${k.marca_agua.opacidad}"></label></div></section>
      <section><div class="fila entre"><h4>Música</h4><button class="btn chico" data-agregar="musica">${ic("plus", 13)} Agregar</button></div>${lista("musica", k.musica, "por_defecto")}</section>
      <section><div class="fila entre"><h4>LUTs (.cube)</h4><button class="btn chico" data-agregar="lut">${ic("plus", 13)} Agregar</button></div>${lista("lut", k.luts, "por_defecto")}</section>
      <section class="km-ia"><h4>${ic("sparkles", 14)} Lo que recibe la IA</h4><p class="pequeno">${e(marca.para_ia || "Todavía no hay kit activo.")}</p>
        <p class="muy-tenue pequeno">Kit activo para videos nuevos: <b>${marca.activo === "perfil" ? "el tuyo" : marca.activo === "empresa" ? "el de la empresa" : "ninguno"}</b>.</p></section>
    </div>`;
    WD.hidratarIconos && WD.hidratarIconos(c);
    let t = null, pend = {};
    const guardar = (c1) => {   // junta los cambios seguidos (colores, textos…) en un solo PUT
      for (const [k, v] of Object.entries(c1)) pend[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...(pend[k] || {}), ...v } : v;
      clearTimeout(t); t = setTimeout(async () => { const cambios = pend; pend = {}; try { marca[ambito] = await api(`/api/marca/${ambito}`, { method: "PUT", json: cambios }); const m2 = await api("/api/marca"); marca.para_ia = m2.para_ia; marca.activo = m2.activo; const p = q(".km-ia p", c); if (p) p.textContent = marca.para_ia || "Todavía no hay kit activo."; } catch (err) { WD.errorToast(err, "No se guardó el kit"); } }, 350); };
    qq("[data-campo]", c).forEach((i) => i.onchange = () => guardar({ [i.dataset.campo]: i.type === "checkbox" ? i.checked : i.value }));
    qq("[data-color]", c).forEach((i) => i.onchange = () => { i.removeAttribute("data-vacio"); i.parentElement.querySelector("small").textContent = i.value.toUpperCase(); guardar({ colores: { [i.dataset.color]: i.value } }); });
    qq("[data-tipo]", c).forEach((i) => i.onchange = () => guardar({ tipografias: { [i.dataset.tipo]: i.value } }));
    qq("[data-texto]", c).forEach((i) => i.onchange = () => guardar({ textos: { [i.dataset.texto]: i.value } }));
    qq("[data-ma]", c).forEach((i) => i.onchange = () => guardar({ marca_agua: { [i.dataset.ma]: i.type === "checkbox" ? i.checked : i.type === "text" || i.tagName === "SELECT" ? i.value : Number(i.value) } }));
    qq("[data-dur]", c).forEach((i) => i.onchange = () => guardar({ [`${i.dataset.dur}_dur`]: Number(i.value) }));
    qq("[data-def]", c).forEach((i) => i.onchange = () => guardar({ [{ logo: "logos_principal", musica: "musica_por_defecto", lut: "luts_por_defecto" }[i.dataset.def]]: i.value }));
    qq("[data-quitar]", c).forEach((b) => b.onclick = async () => { try { marca[ambito] = await api(`/api/marca/${ambito}/archivo?tipo=${enc(b.dataset.quitar)}&archivo=${enc(b.dataset.arch)}`, { method: "DELETE" }); refrescarMarca(); } catch (err) { WD.errorToast(err); } });
    qq("[data-agregar]", c).forEach((b) => b.onclick = () => agregarAlKit(b.dataset.agregar));
  }

  async function agregarAlKit(tipo) {
    const filtro = { logo: "imagenes", musica: "audio", intro: "medios", outro: "medios", lut: "todo", tipografia: "todo" }[tipo];
    const r = await WD.elegirNativo({ tipo: "archivos", filtro, multiple: tipo === "logo" || tipo === "musica" || tipo === "lut", titulo: `Agregar al kit: ${tipo}` });
    try {
      if (r && r.length) { for (const ruta of r) await api(`/api/marca/${ambito}/archivo_ruta`, { method: "POST", json: { tipo, ruta } }); }
      else if (r === null) {   // sin ventana nativa: subir con el navegador
        const inp = document.createElement("input"); inp.type = "file";
        inp.accept = (marca.tipos[tipo] || []).join(",");
        const f = await new Promise((ok) => { inp.onchange = () => ok(inp.files[0]); inp.click(); });
        if (!f) return;
        const fd = new FormData(); fd.append("tipo", tipo); fd.append("archivo", f);
        await api(`/api/marca/${ambito}/archivo`, { method: "POST", body: fd });
      } else return;
      WD.toast("Agregado al kit", "ok", { ms: 1800 }); refrescarMarca();
    } catch (err) { WD.errorToast(err, "No se agregó al kit"); }
  }

  // ================================================================== PLANTILLAS
  async function abrirPlantillas() {
    let ls_; try { ls_ = (await api("/api/plantillas")).plantillas; } catch (err) { return WD.errorToast(err); }
    const fmt = (x) => x.ancho && x.alto ? (x.ancho > x.alto ? "16:9" : x.ancho < x.alto ? "9:16" : "1:1") : "";
    const grupo = (amb, tit) => { const xs = ls_.filter((x) => x.ambito === amb); return xs.length ? `<h4>${tit}</h4><div class="pl-rejilla">${xs.map((x) => `<article class="pl-tarjeta" tabindex="0" data-id="${e(x.id)}">
        <span class="pl-ico">${ic(x.icono || "layout-template", 22)}</span><div class="pl-info"><b>${e(x.nombre)}</b><span class="tenue pequeno">${e(x.descripcion)}</span>
        <span class="pl-chips"><span class="etq">${fmt(x)}</span>${x.duracion ? `<span class="etq">~${Math.round(x.duracion)} s</span>` : ""}<span class="etq">${x.huecos.length} huecos</span></span></div>
        ${amb !== "incluida" ? `<button class="icono-btn pl-borrar" data-borrar="${e(x.id)}" aria-label="Borrar plantilla ${e(x.nombre)}">${ic("trash-2", 14)}</button>` : ""}</article>`).join("")}</div>` : ""; };
    const d = dialogo("dlg-plantillas", "dlg-grande dlg-plantillas", `<div class="dlg-cab"><div class="dlg-cab-tit"><span class="t-ico">${ic("layout-template", 18)}</span><div><h2>Nuevo desde plantilla</h2>
        <div class="tenue pequeno">Elige una plantilla y reemplaza sus huecos con tus videos o fotos. Se arma sin IA (o pídeselo a la IA).</div></div></div>
        <button class="icono-btn" data-cerrar aria-label="Cerrar">${ic("x")}</button></div>
      <div class="pl-cuerpo">${grupo("incluida", "Incluidas")}${grupo("empresa", "De la empresa")}${grupo("perfil", "Mis plantillas")}
        <p class="muy-tenue pequeno">Para guardar tus propias plantillas: abre un proyecto y usa Archivo › Guardar como plantilla.</p></div>`);
    qq(".pl-tarjeta", d).forEach((t) => { const ir = async (ev) => { if (ev.target.closest("[data-borrar]")) return; d.close(); await crearDesdePlantilla(ls_.find((x) => x.id === t.dataset.id)); };
      t.onclick = ir; t.onkeydown = (ev) => { if (ev.key === "Enter") ir(ev); }; });
    qq("[data-borrar]", d).forEach((b) => b.onclick = async (ev) => { ev.stopPropagation();
      if (!(await WD.confirmar({ titulo: "¿Borrar la plantilla?", peligro: true, si: "Borrar" }))) return;
      try { await api(`/api/plantillas/${enc(b.dataset.borrar)}`, { method: "DELETE" }); abrirPlantillas(); } catch (err) { WD.errorToast(err); } });
    if (!d.open) d.showModal();
  }
  WD.abrirPlantillas = abrirPlantillas;

  async function crearDesdePlantilla(pl) {
    const nombre = await WD.confirmar({ titulo: `Nuevo proyecto: ${pl.nombre}`, si: "Crear", input: { valor: `${pl.nombre} ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" })}` } });
    if (!nombre) return;
    try {
      const p = await api(`/api/plantillas/${enc(pl.id)}/proyecto`, { method: "POST", json: { nombre } });
      await WD.abrirEditor(p.id, q("#workspace"));
      abrirHuecos(p.id);
    } catch (err) { WD.errorToast(err, "No se creó el proyecto"); }
  }

  async function abrirHuecos(pid) {
    pid = pid || (WD.proyectoActual && WD.proyectoActual());
    if (!pid) return;
    let st; try { st = (await api(`/api/proyectos/${enc(pid)}/plantilla`)).plantilla; } catch (err) { return WD.errorToast(err); }
    if (!st) return WD.toast("Este proyecto no se creó desde una plantilla. Para crear una: Archivo › Guardar como plantilla.", "info", { ms: 6000 });
    const tipoTxt = { video: "video", imagen: "foto", medio: "video o foto", audio: "audio" };
    const d = dialogo("dlg-huecos", "dlg-grande dlg-huecos", `<div class="dlg-cab"><div class="dlg-cab-tit"><span class="t-ico">${ic("layout-template", 18)}</span><div><h2>${e(st.plantilla.nombre)}</h2>
        <div class="tenue pequeno">${e(st.plantilla.descripcion || "Reemplaza cada hueco con tu archivo y escribe tus textos.")}</div></div></div>
        <button class="icono-btn" data-cerrar aria-label="Cerrar">${ic("x")}</button></div>
      <div class="hu-cuerpo"><div><h4>Huecos</h4><ol class="hu-lista">${st.huecos.map((h) => `<li class="hu ${h.ruta ? "lleno" : ""}">
          <span class="hu-num">${e(h.id)}</span><div class="hu-info"><b>${e(h.titulo || h.id)}</b>${h.opcional ? ' <span class="etq">opcional</span>' : ""}
            <span class="tenue pequeno">${e(h.nota || "")} · ${tipoTxt[h.tipo] || h.tipo}${h.dur ? ` · ~${h.dur} s` : ""}</span>
            ${h.ruta ? `<span class="hu-arch">${ic(h.existe ? "check" : "triangle-alert", 13)} ${e(h.nombre)}</span>` : ""}</div>
          <button class="btn chico ${h.ruta ? "" : "primario"}" data-elegir="${e(h.id)}" data-tipo="${e(h.tipo)}">${ic("folder-open", 13)} ${h.ruta ? "Cambiar" : "Elegir…"}</button>
          ${h.ruta ? `<button class="icono-btn" data-vaciar="${e(h.id)}" aria-label="Quitar archivo">${ic("x", 14)}</button>` : ""}</li>`).join("")}</ol></div>
        <div><h4>Textos</h4>${Object.entries(st.textos).map(([k, v]) => `<label class="campo">${e(st.etiquetas[k] || k)}<input data-txt="${e(k)}" value="${e(v)}"></label>`).join("") || '<p class="tenue pequeno">Sin textos editables.</p>'}</div></div>
      <div class="hu-pie"><span class="tenue pequeno">${st.listo ? `${ic("circle-check", 14)} Listo para armar` : `Faltan ${st.faltan.length} hueco(s)`}${st.armado ? ` · armado (v${st.armado.version})` : ""}</span><span class="espacio"></span>
        <button class="btn" id="hu-ia">${ic("sparkles", 14)} Que lo arme la IA</button>
        <button class="btn primario" id="hu-armar" ${st.listo && st.con_plan ? "" : "disabled"}>${ic("wand-sparkles", 14)} Armar video (sin IA)</button></div>`);
    qq("[data-elegir]", d).forEach((b) => b.onclick = async () => {
      const filtro = { video: "videos", imagen: "imagenes", audio: "audio" }[b.dataset.tipo] || "medios";
      const r = await WD.elegirNativo({ tipo: "archivos", filtro, multiple: false, titulo: "Archivo para el hueco " + b.dataset.elegir });
      try {
        if (r && r.length) await api(`/api/proyectos/${enc(pid)}/plantilla/hueco`, { method: "PUT", json: { hueco: b.dataset.elegir, ruta: r[0] } });
        else if (r === null) {
          const inp = document.createElement("input"); inp.type = "file"; inp.accept = "video/*,image/*,audio/*";
          const f = await new Promise((ok) => { inp.onchange = () => ok(inp.files[0]); inp.click(); }); if (!f) return;
          const fd = new FormData(); fd.append("hueco", b.dataset.elegir); fd.append("archivo", f);
          await api(`/api/proyectos/${enc(pid)}/plantilla/hueco_subir`, { method: "POST", body: fd });
        } else return;
        abrirHuecos(pid);
      } catch (err) { WD.errorToast(err); }
    });
    qq("[data-vaciar]", d).forEach((b) => b.onclick = async () => { try { await api(`/api/proyectos/${enc(pid)}/plantilla/hueco`, { method: "PUT", json: { hueco: b.dataset.vaciar, ruta: null } }); abrirHuecos(pid); } catch (err) { WD.errorToast(err); } });
    qq("[data-txt]", d).forEach((i) => i.onchange = async () => { try { await api(`/api/proyectos/${enc(pid)}/plantilla/textos`, { method: "PUT", json: { textos: { [i.dataset.txt]: i.value } } }); } catch (err) { WD.errorToast(err); } });
    q("#hu-ia", d).onclick = () => { d.close(); WD.asistenteIA(pid); };
    q("#hu-armar", d).onclick = async () => {
      try {
        await Promise.all(qq("[data-txt]", d).map((i) => api(`/api/proyectos/${enc(pid)}/plantilla/textos`, { method: "PUT", json: { textos: { [i.dataset.txt]: i.value } } })));
        const r = await api(`/api/proyectos/${enc(pid)}/plantilla/armar`, { method: "POST" });
        d.close(); WD.toast(`Video armado (${Math.round(r.duracion)} s, ${r.grupos} partes). Haciendo la vista previa…`, "ok");
        window.dispatchEvent(new CustomEvent("wdvs:plan-cambiado", { detail: { pid, tarea: "plantilla" } }));
        WD.vigilar && WD.vigilar(); WD.refrescar && WD.refrescar();
      } catch (err) { WD.errorToast(err, "No se pudo armar"); }
    };
    if (!d.open) d.showModal();
  }
  WD.abrirHuecos = abrirHuecos;

  async function guardarComoPlantilla(pid, rango = {}) {
    pid = pid || (WD.proyectoActual && WD.proyectoActual()); if (!pid) return;
    const d = dialogo("dlg-guardar-plantilla", "dlg-chico", `<form id="gp"><h3>Guardar como plantilla</h3>
      <p class="tenue pequeno">Cada video o foto se vuelve un hueco para reemplazar y cada texto, un campo editable.</p>
      <label class="campo">Nombre<input name="nombre" maxlength="60" required placeholder="p. ej. Apertura con logo"></label>
      <label class="campo">Descripción<input name="desc" maxlength="200"></label>
      <div class="campo">Qué parte<div class="fila"><label class="interruptor pequeno"><input type="radio" name="parte" value="todo" ${rango.desde == null ? "checked" : ""}> <span>Todo el video</span></label>
        <label class="interruptor pequeno"><input type="radio" name="parte" value="tramo" ${rango.desde != null ? "checked" : ""}> <span>Un tramo:</span></label>
        <input name="desde" type="number" min="0" step="0.1" style="width:72px" value="${rango.desde ?? 0}"> a <input name="hasta" type="number" min="0" step="0.1" style="width:72px" value="${rango.hasta ?? 5}"> s</div>
        <small class="tenue">Se toman los grupos completos que tocan el tramo.</small></div>
      <div class="campo">Dónde<div class="fila"><label class="interruptor pequeno"><input type="radio" name="amb" value="perfil" checked> <span>Mis plantillas</span></label>
        <label class="interruptor pequeno"><input type="radio" name="amb" value="empresa"> <span>Empresa (compartida)</span></label></div></div>
      <div class="fila derecha"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Guardar plantilla</button></div></form>`);
    q("#gp", d).onsubmit = async (ev) => {
      ev.preventDefault(); const f = ev.target, tramo = f.parte.value === "tramo";
      try {
        const r = await api(`/api/proyectos/${enc(pid)}/guardar_plantilla`, { method: "POST", json: { nombre: f.nombre.value, descripcion: f.desc.value, ambito: f.amb.value, desde: tramo ? Number(f.desde.value) : null, hasta: tramo ? Number(f.hasta.value) : null } });
        d.close(); WD.toast(`Plantilla «${r.nombre}» guardada: ${r.huecos} huecos y ${r.textos} textos.`, "ok", { accion: { etiqueta: "Ver plantillas", fn: abrirPlantillas } });
      } catch (err) { WD.errorToast(err, "No se guardó la plantilla"); }
    };
    d.showModal(); q("[name=nombre]", d).focus();
  }
  WD.plantillas = { abrir: abrirPlantillas, huecos: abrirHuecos, guardar: guardarComoPlantilla };

  // ================================================================== AUTOGUARDADO: latido, cierre y borradores
  const sesion = Math.random().toString(36).slice(2, 12);
  let pidLatido = null, tLatido = null, ultimaAccion = Date.now();
  ["keydown", "mousedown", "wheel", "pointermove"].forEach((ev) => addEventListener(ev, () => { ultimaAccion = Date.now(); }, { passive: true }));
  function latir() {
    if (!pidLatido) return;
    const activo = document.visibilityState === "visible" && Date.now() - ultimaAccion < 90000;
    api(`/api/proyectos/${enc(pidLatido)}/latido`, { method: "POST", json: { sesion, activo } }).catch(() => { /* */ });
  }
  function cerrarSesion(pid) {
    if (!pid) return;
    try { navigator.sendBeacon(`/api/proyectos/${enc(pid)}/cerrar`, new Blob([JSON.stringify({ sesion })], { type: "text/plain" })); } catch { /* */ }
  }
  addEventListener("wdvs:proyecto-abierto", (ev) => {
    if (pidLatido && pidLatido !== ev.detail.pid) cerrarSesion(pidLatido);
    pidLatido = ev.detail.pid; clearInterval(tLatido); latir(); tLatido = setInterval(latir, 30000);
    WD.perfil.reciente("proyectos", pidLatido);
  });
  addEventListener("pagehide", () => cerrarSesion(pidLatido));
  // al volver a Inicio (app.js emite wdvs:inicio) la sesión se cierra bien
  addEventListener("wdvs:inicio", () => { cerrarSesion(pidLatido); pidLatido = null; clearInterval(tLatido); });

  WD.autoguardado = {
    borrador(pid, clave, datos) { ls.set(`wdvs-borrador:${pid}:${clave}`, JSON.stringify({ ts: Date.now(), perfil: perfil?.id, datos })); },
    limpiar(pid, clave) { ls.del(`wdvs-borrador:${pid}:${clave}`); },
    borradores(pid) {
      const out = [];
      try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k && k.startsWith(`wdvs-borrador:${pid ? pid + ":" : ""}`)) { const [, p, c] = k.split(":"); out.push({ pid: p, clave: c, ...JSON.parse(sessionStorage.getItem(k)) }); } } } catch { /* */ }
      return out;
    },
  };

  // ================================================================== RECUPERACIÓN tras un cierre inesperado
  async function revisarRecuperacion() {
    let r; try { r = await api("/api/recuperacion"); } catch { return; }
    const borr = WD.autoguardado.borradores().filter((b) => !b.perfil || b.perfil === perfil?.id);
    if (!r.pendientes.length && !borr.length) return;
    const hora = (iso) => iso ? new Date(iso).toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "";
    const d = dialogo("dlg-recuperar", "dlg-chico dlg-recuperar", `<h3>${ic("life-buoy", 18)} Recuperar tu trabajo</h3>
      <p class="pequeno">La app se cerró sin terminar bien. Tus cambios en el editor se guardan solos; aquí puedes volver a un punto de autoguardado o retomar lo que quedó a medias.</p>
      <div class="rec-lista">${r.pendientes.map((x) => `<div class="rec" data-pid="${e(x.id)}"><div class="fila entre"><b>${e(x.nombre)}</b><span class="tenue pequeno">${x.cierre_inesperado ? `abierto hasta ${hora(x.ultimo_latido)}` : ""}</span></div>
          ${x.version_actual ? `<div class="tenue pequeno">Versión actual: v${x.version_actual.n} (${hora(x.version_actual.ts)})</div>` : ""}
          ${x.tarea_interrumpida ? `<div class="pequeno aviso-rec">${ic("triangle-alert", 13)} Quedó a medias: <b>${e(x.tarea_interrumpida.tarea)}</b>${x.tarea_interrumpida.recuperable ? " (el plan de la IA se guardó: se retoma sin gastar tokens)" : ""}</div>` : ""}
          <div class="fila">${x.puntos.length ? `<select data-punto aria-label="Punto de autoguardado">${x.puntos.map((p) => `<option value="${e(p.archivo)}">Autoguardado ${hora(p.ts)}</option>`).join("")}</select><button class="btn chico" data-a="restaurar">Restaurar</button>` : ""}
            ${x.tarea_interrumpida ? `<button class="btn chico" data-a="retomar">Retomar ${e(x.tarea_interrumpida.tarea)}</button>` : ""}
            <span class="espacio"></span><button class="btn chico primario" data-a="abrir">Abrir</button><button class="btn chico fantasma" data-a="descartar">Descartar aviso</button></div></div>`).join("")}
        ${borr.map((b) => `<div class="rec" data-borrador="${e(b.pid)}:${e(b.clave)}"><b>Cambios sin enviar en el navegador</b><div class="tenue pequeno">${e(b.pid)} · ${e(b.clave)} · ${new Date(b.ts).toLocaleString("es-MX")}</div>
            <div class="fila"><span class="espacio"></span><button class="btn chico primario" data-a="borrador-abrir">Abrir y recuperar</button><button class="btn chico fantasma" data-a="borrador-descartar">Descartar</button></div></div>`).join("")}</div>
      <div class="fila derecha"><button class="btn" data-cerrar>Cerrar</button></div>`);
    d.onclick = async (ev) => {
      const b = ev.target.closest("[data-a]"); if (!b) return;
      const caja = b.closest(".rec"), pid = caja.dataset.pid, a = b.dataset.a;
      try {
        if (a === "restaurar") { const v = await api(`/api/proyectos/${enc(pid)}/recuperar`, { method: "POST", json: { archivo: q("[data-punto]", caja).value } }); WD.toast(`Recuperado como versión v${v.version.n}`, "ok");
          if (q('[data-a="retomar"]', caja)) { q("[data-punto]", caja).remove(); b.remove(); } else caja.remove(); }
        else if (a === "retomar") { await api(`/api/proyectos/${enc(pid)}/recuperar/retomar`, { method: "POST" }); WD.toast("Retomando…", "ok"); caja.remove(); }
        else if (a === "descartar") { await api(`/api/proyectos/${enc(pid)}/recuperar/descartar`, { method: "POST" }); caja.remove(); }
        else if (a === "abrir") { await api(`/api/proyectos/${enc(pid)}/recuperar/descartar`, { method: "POST" }); d.close(); await WD.abrirEditor(pid, q("#workspace")); }
        else if (a.startsWith("borrador")) {
          const [p, c] = caja.dataset.borrador.split(":");
          const x = borr.find((y) => y.pid === p && y.clave === c);
          if (a === "borrador-abrir") { d.close(); await WD.abrirEditor(p, q("#workspace")); window.dispatchEvent(new CustomEvent("wdvs:recuperar-borrador", { detail: { pid: p, clave: c, datos: x.datos } })); }
          WD.autoguardado.limpiar(p, c); caja.remove();
        }
        if (!q(".rec", d)) d.close();
        WD.refrescar && WD.refrescar();
      } catch (err) { WD.errorToast(err); }
    };
    d.showModal();
  }
  WD.revisarRecuperacion = revisarRecuperacion;

  // ================================================================== MÉTRICAS (Ajustes › Métricas)
  async function pintarMetricas() {
    const c = q("#aj-metricas"); if (!c) return;
    c.innerHTML = '<p class="tenue">Calculando…</p>';
    let m; try { m = await api("/api/metricas"); } catch (err) { c.innerHTML = ""; return WD.errorToast(err); }
    const t = m.total;
    c.innerHTML = `<h3>Métricas <span class="tenue pequeno">perfil ${e(perfil?.nombre || "")}</span></h3>
      <div class="met-tarjetas"><div class="met"><span>Tiempo ahorrado (estimado)</span><b>${min(t.ahorrado_min)}</b></div>
        <div class="met"><span>Tiempo editando</span><b>${min(t.tiempo_activo_min)}</b></div>
        <div class="met"><span>Tokens (entrada + caché / salida)</span><b>${miles(t.entrada + t.cache_lectura + t.cache_escritura)} / ${miles(t.salida)}</b></div>
        <div class="met"><span>Videos que funcionaron</span><b>${t.funcionaron} de ${t.proyectos}</b></div></div>
      <p class="muy-tenue pequeno">${e(m.formula)} Marca un video con Archivo › «Este video funcionó»: su estilo pesa el triple en lo que aprende tu perfil.</p>
      <h4>Por proyecto</h4><div class="tabla-scroll"><table class="tabla pequeno"><thead><tr><th>Proyecto</th><th>Video</th><th>Editando</th><th>A mano (est.)</th><th>Ahorrado</th><th>Llamadas</th><th>Tokens entrada</th><th>Salida</th><th>Funcionó</th></tr></thead>
        <tbody>${m.proyectos.map((p) => `<tr><td>${e(p.nombre)}</td><td>${p.dur_video_s ? Math.round(p.dur_video_s) + " s" : "–"}</td><td>${min(p.tiempo_activo_min)}</td><td>${min(p.manual_min)}</td><td><b>${min(p.ahorrado_min)}</b></td>
          <td>${miles(p.tokens.llamadas)}</td><td>${miles(p.tokens.entrada + p.tokens.cache_lectura + p.tokens.cache_escritura)}</td><td>${miles(p.tokens.salida)}</td><td>${p.funciono ? (p.funciono.valor ? "✓" : "✗") : ""}</td></tr>`).join("") || '<tr><td colspan="9" class="tenue">Sin proyectos.</td></tr>'}</tbody></table></div>
      ${m.por_perfil.length > 1 ? `<h4>Por perfil</h4><table class="tabla pequeno"><thead><tr><th>Perfil</th><th>Proyectos</th><th>Ahorrado</th><th>Editando</th><th>Llamadas</th><th>Tokens salida</th></tr></thead><tbody>
        ${m.por_perfil.map((p) => `<tr><td>${avatarHTML(p, 18)} ${e(p.nombre)}</td><td>${p.proyectos}</td><td>${min(p.ahorrado_min)}</td><td>${min(p.tiempo_activo_min)}</td><td>${miles(p.llamadas)}</td><td>${miles(p.salida)}</td></tr>`).join("")}</tbody></table>` : ""}`;
  }
  WD.pintarMetricas = pintarMetricas;

  async function marcarFunciono(pid) {
    pid = pid || (WD.proyectoActual && WD.proyectoActual()); if (!pid) return;
    const nota = await WD.confirmar({ titulo: "¿Este video funcionó?", cuerpo: "Tu perfil de estilo aprenderá más de este video (pesa el triple). ¿Qué funcionó? (opcional)", si: "Sí, funcionó", input: { valor: "", placeholder: "p. ej. muchas vistas, el cliente lo aprobó…" } });
    if (nota === false) return;
    try { const r = await api(`/api/proyectos/${enc(pid)}/funciono`, { method: "POST", json: { valor: true, nota: nota === true ? "" : nota } }); WD.toast(r.estilo_actualizado ? "Anotado: tu estilo aprendió de este video." : "Anotado.", "ok"); }
    catch (err) { WD.errorToast(err); }
  }
  WD.marcarFunciono = marcarFunciono;

  // ================================================================== Archivo › y menú extra (proyecto)
  const comandoOrig = WD.comando;
  WD.comando = async (c) => {
    const pid = WD.proyectoActual && WD.proyectoActual();
    if (c === "plantillas") return abrirPlantillas();
    if (c === "marca") return abrirMarca();
    if (c === "perfil") return mostrarSeleccion(true);
    if (c === "importar") return WD.colab && WD.colab.importar();
    if (pid) {
      if (c === "plantilla-huecos") return abrirHuecos(pid);
      if (c === "guardar-plantilla") return guardarComoPlantilla(pid);
      if (c === "funciono") return marcarFunciono(pid);
      if (["revision", "comparar", "historial", "mnproj", "aprobacion"].includes(c)) return WD.colab && WD.colab.abrir(pid, c);
    }
    return comandoOrig(c);
  };
  qq("#menu-archivo [data-cmd]").forEach((b) => { b.onclick = (ev) => { ev.stopPropagation(); q("#menu-archivo").classList.remove("abierto"); WD.comando(b.dataset.cmd); }; });

  // ================================================================== arranque
  const bp = q("#btn-perfil"); if (bp) bp.onclick = (ev) => { ev.stopPropagation(); menuPerfil(bp); };
  qq("[data-abrir-plantillas]").forEach((b) => b.onclick = abrirPlantillas);
  qq("[data-importar-mnproj]").forEach((b) => b.onclick = () => WD.colab && WD.colab.importar());
  (async () => {
    await cargarPerfil();
    const mostrada = await mostrarSeleccion(false);
    if (!mostrada) { ss.set("wdvs-perfil-ok", perfil?.id || ""); revisarRecuperacion(); }
  })();
})();
