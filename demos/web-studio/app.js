"use strict";
// Web Studio — marco de la app: inicio con proyectos, barra superior, espacio de trabajo (editor), ajustes,
// asistente de Claude Code, tareas con progreso y toasts. Sin dependencias externas.
// Contrato con editor.js: window.WDVS (ver docs/uso-app.md §3.2 y docs/editor.md §1). editor.js no usa globales de app.js.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mb = (b) => (b / 1e6).toFixed(b > 1e8 ? 0 : 1) + " MB";
const num = (n) => (n ?? 0).toLocaleString("es-MX");
const dur = (s) => s == null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
// Iconos: un solo set (Lucide, vendor/lucide/lucide.js). ic(nombre, tamaño) -> <svg>.
const ic = (n, t = 16, c = "") => (window.WDVS && WDVS.icono ? WDVS.icono(n, t, c) : "");
const ICONO = { get x() { return ic("x"); }, get mas() { return ic("ellipsis"); }, get film() { return ic("film", 38); } };
function hidratarIconos(raiz = document) { for (const e of raiz.querySelectorAll("[data-ico]")) if (!e.firstChild) e.innerHTML = ic(e.dataset.ico, +(e.dataset.tam || 16)); }

let actual = null;        // id del proyecto abierto
let datos = null;         // resumen del proyecto abierto
let sondeo = null;
let ultimaFin = null;
let proyectosCache = [];
const WDVS = (window.WDVS = window.WDVS || {});
WDVS.hidratarIconos = hidratarIconos;
hidratarIconos();
const dev = () => { try { return sessionStorage.getItem("wdvs-dev") === "1"; } catch { return false; } };

// ================================================================== API y avisos
async function api(ruta, opts = {}) {
  const o = { ...opts };
  if (o.json !== undefined) { o.body = JSON.stringify(o.json); o.headers = { "Content-Type": "application/json" }; delete o.json; }
  let r;
  try { r = await fetch(ruta, o); }
  catch { const e = new Error("No hay conexión con Web Studio. ¿Se cerró la ventana negra de iniciar.bat?"); e.datos = {}; throw e; }
  const t = await r.text();
  let d; try { d = t ? JSON.parse(t) : {}; } catch { d = { detail: t }; }
  if (!r.ok) { const e = new Error(typeof d.detail === "string" ? d.detail : r.statusText); e.datos = d; e.status = r.status; throw e; }
  return d;
}
WDVS.api = api;

// sugerencias locales para errores que llegan como texto (estado.json, chat)
function sugerir(msg, d = {}) {
  if (d.accion) return d;
  const m = String(msg || "");
  if (/No encontré Claude Code|ClaudeNoInstalado|No se pudo ejecutar Claude/i.test(m)) return { titulo: "Claude Code no está instalado", accion: { ir: "ajustes/claude", etiqueta: "Instalar en Ajustes" } };
  if (/sesión iniciada|not logged in|\/login/i.test(m)) return { titulo: "Falta iniciar sesión en Claude", accion: { ir: "ajustes/claude", etiqueta: "Iniciar sesión" } };
  if (/límite de uso/i.test(m)) return { titulo: "Se alcanzó el límite de uso de Claude" };
  if (/ffmpeg|ffprobe/i.test(m)) return { titulo: "Problema con ffmpeg", accion: { ir: "ajustes/deps", etiqueta: "Revisar en Ajustes" } };
  return {};
}
function irA(destino) { const [v, sec] = destino.split("/"); if (v === "ajustes") abrirAjustes(sec || "general"); }

function toast(msg, tipo = "info", op = {}) {
  const t = document.createElement("div");
  t.className = `toast ${tipo}`;
  t.setAttribute("role", tipo === "error" ? "alert" : "status");
  t.innerHTML = ic({ ok: "circle-check", error: "circle-alert", aviso: "triangle-alert" }[tipo] || "info", 16) + `<div class="toast-txt">${op.titulo ? `<b>${esc(op.titulo)}</b><br>` : ""}${esc(msg)}</div>`;
  if (op.accion) {
    const b = document.createElement("button"); b.className = "btn chico primario"; b.textContent = op.accion.etiqueta;
    b.onclick = () => { t.remove(); op.accion.fn ? op.accion.fn() : irA(op.accion.ir); };
    t.appendChild(b);
  }
  const x = document.createElement("button"); x.className = "icono-btn"; x.innerHTML = ICONO.x; x.setAttribute("aria-label", "Cerrar aviso"); x.onclick = () => t.remove();
  t.appendChild(x);
  $("#toasts").appendChild(t);
  const ms = op.ms ?? (tipo === "error" ? 12000 : 4500);
  if (ms) setTimeout(() => t.remove(), ms);
  return t;
}
function errorToast(err, titulo) {
  const s = sugerir(err.message, err.datos || {});
  toast(err.message.split("\nDetalle")[0], "error", { titulo: s.titulo || titulo, accion: s.accion });
}
function aviso(msg) { toast(msg, "info"); }   // compatibilidad
WDVS.toast = toast; WDVS.errorToast = errorToast; WDVS.sugerir = sugerir; WDVS.irA = irA;

function confirmar({ titulo, cuerpo = "", si = "Aceptar", no = "Cancelar", peligro = false, input = null }) {
  const d = $("#dlg-confirmar");
  $("#conf-titulo").textContent = titulo; $("#conf-cuerpo").innerHTML = cuerpo; $("#conf-no").textContent = no;
  const inp = $("#conf-input"); inp.hidden = !input;
  if (input) { inp.value = input.valor || ""; inp.placeholder = input.placeholder || ""; }
  const b = $("#conf-si"); b.textContent = si; b.classList.toggle("peligro", peligro);
  d.showModal(); if (input) { inp.focus(); inp.select(); } else b.focus();
  return new Promise((ok) => {
    const fin = (v) => { d.close(); b.onclick = $("#conf-no").onclick = null; ok(v); };
    b.onclick = () => fin(input ? inp.value.trim() || false : true);
    $("#conf-no").onclick = () => fin(false);
    d.onclose = () => fin(false);
    inp.onkeydown = (e) => { if (e.key === "Enter") b.click(); };
  });
}
WDVS.confirmar = confirmar;
$$("dialog [data-cerrar]").forEach((b) => b.onclick = () => b.closest("dialog").close());

// ================================================================== tareas: texto, progreso y tiempo estimado
const TEXTO_PASO = { analisis: "Revisando tus videos", plan: "La IA está pensando el video", validar: "Revisando que todo cuadre",
  preview: "Armando la vista previa", ajuste: "Aplicando el cambio", final: "Renderizando en alta calidad" };
const TEXTO_TAREA = { generar: "Creando tu video", ajustar: "Aplicando cambios", preview: "Vista previa", final: "Render final",
  analizar: "Analizando tus archivos", preview_rango: "Vista previa del rango", exportar: "Exportando" };
function progresoTarea(e) {
  const pasos = e.pasos || [];
  const hechos = pasos.filter((p) => p.estado === "ok").length;
  const cur = pasos.find((p) => p.estado === "en_curso");
  const frac = pasos.length ? Math.min(1, (hechos + (cur ? cur.progreso || 0 : 0)) / pasos.length) : 0;
  const trans = e.inicio ? (Date.now() - new Date(e.inicio).getTime()) / 1000 : 0;
  const eta = frac > 0.08 && trans > 5 ? trans * (1 - frac) / frac : null;
  const texto = cur ? (TEXTO_PASO[cur.id] || cur.nombre) : (TEXTO_TAREA[e.tarea] || e.tarea || "");
  return { texto, frac, eta, trans, titulo: TEXTO_TAREA[e.tarea] || e.tarea };
}
const fmtEta = (s) => s == null ? "" : s < 60 ? `≈ ${Math.max(5, Math.round(s / 5) * 5)} s` : `≈ ${Math.round(s / 60)} min`;
WDVS.progresoTarea = progresoTarea; WDVS.fmtEta = fmtEta;

// ================================================================== CENTRO DE TAREAS (no bloqueante)
// WDVS.tareas.poner(id, {titulo, texto, frac (0-1 o null = sin medida), eta (s), tipo, cancelar: fn, silenciosa})
// WDVS.tareas.terminar(id, ok, {texto, accion: {etiqueta, fn}}) · WDVS.tareas.quitar(id)
// Fuentes: tareas del proyecto (estado.json), vistas fluidas (proxies), subidas, IA del chat e instalaciones.
const ICO_TAREA = { generar: "sparkles", ajustar: "wand-sparkles", preview: "monitor-play", preview_rango: "monitor-play", final: "film", analizar: "scan",
  exportar: "share", proxies: "gauge", subir: "upload", chat: "message-square", instalar: "download" };
const Tareas = (() => {
  const L = new Map();
  let abierto = false;
  const notifOn = () => { try { return sessionStorage.getItem("wdvs-notif") === "1"; } catch { return false; } };
  function poner(id, d) {
    const t = L.get(id) || { id, inicio: Date.now(), estado: "corriendo" };
    Object.assign(t, d, d.estado ? {} : { estado: "corriendo", fin: null });
    L.set(id, t); pintar();
    return t;
  }
  function terminar(id, ok, d = {}) {
    const t = L.get(id) || poner(id, { titulo: d.titulo || id, silenciosa: d.silenciosa });
    Object.assign(t, d, { estado: ok === "cancelado" ? "cancelado" : ok ? "ok" : "error", fin: Date.now(), frac: ok ? 1 : t.frac, cancelar: null, eta: null });
    pintar();
    if (!(t.silenciosa && !document.hidden)) {
      const tipo = t.estado === "ok" ? "ok" : t.estado === "cancelado" ? "info" : "error";
      toast(d.texto || (t.estado === "ok" ? "Listo." : t.estado === "cancelado" ? "Cancelada." : "No se pudo terminar."), tipo,
        { titulo: t.titulo, accion: d.accion, ms: tipo === "error" ? 12000 : 6000 });
      if (document.hidden && notifOn() && "Notification" in window && Notification.permission === "granted")
        try { new Notification(`${t.titulo}: ${t.estado === "ok" ? "listo" : "con error"}`, { body: d.texto || "", tag: id }); } catch { /* */ }
    }
    if (t.estado !== "error") setTimeout(() => { const x = L.get(id); if (x && x.fin && Date.now() - x.fin > 59000) { L.delete(id); pintar(); } }, 60000);
  }
  function quitar(id) { L.delete(id); pintar(); }
  function corriendo() { return [...L.values()].filter((t) => t.estado === "corriendo"); }
  function pintar() {
    const run = corriendo(), btn = $("#tareas-btn"); if (!btn) return;
    const medidas = run.filter((t) => typeof t.frac === "number");
    const frac = medidas.length ? medidas.reduce((a, t) => a + t.frac, 0) / medidas.length : 0;
    btn.classList.toggle("activo", run.length > 0);
    btn.classList.toggle("indet", run.length > 0 && !medidas.length);
    btn.classList.toggle("fallo", !run.length && [...L.values()].some((t) => t.estado === "error"));
    $("#tareas-anillo").style.strokeDashoffset = String(94.25 * (1 - (run.length ? frac : 0)));
    const n = run.length || [...L.values()].filter((t) => t.estado === "error").length;
    const num = $("#tareas-num"); num.hidden = !n; num.textContent = n;
    const ico = $("#tareas-ico"); const nombre = run.length ? "loader-circle" : "list-checks";
    if (ico.dataset.n !== nombre) { ico.dataset.n = nombre; ico.innerHTML = ic(nombre, 17, run.length ? "gira" : ""); }
    const p = run[0];
    $("#tareas-resumen").textContent = p ? `${p.titulo}${typeof p.frac === "number" ? " " + Math.round(p.frac * 100) + "%" : "…"}${p.eta ? " · " + fmtEta(p.eta) : ""}` : "";
    btn.setAttribute("aria-label", run.length ? `Centro de tareas: ${run.length} en curso` : "Centro de tareas");
    document.title = p && typeof p.frac === "number" ? `(${Math.round(frac * 100)}%) Web Studio` : "Web Studio";
    if (abierto) pintarLista();
  }
  function pintarLista() {
    const cont = $("#tareas-lista");
    const ts = [...L.values()].sort((a, b) => (a.estado === "corriendo" ? 0 : 1) - (b.estado === "corriendo" ? 0 : 1) || b.inicio - a.inicio);
    if (!ts.length) { cont.innerHTML = `<div class="tp-vacio">${ic("list-checks", 28)}<b>No hay tareas en curso</b><span class="pequeno">Aquí verás el análisis de tus archivos, la IA, las vistas previas, el render y las exportaciones. Puedes seguir editando mientras trabajan.</span></div>`; return; }
    cont.innerHTML = "";
    for (const t of ts) {
      const d = document.createElement("div"); d.className = "tarea " + t.estado;
      const est = t.estado === "corriendo" ? (typeof t.frac === "number" ? `${Math.round(t.frac * 100)}%` : "en curso") : t.estado === "ok" ? "listo" : t.estado === "cancelado" ? "cancelada" : "con error";
      const dur = ((t.fin || Date.now()) - t.inicio) / 1000;
      d.innerHTML = `<span class="t-ico">${ic(t.estado === "ok" ? "check" : t.estado === "error" ? "circle-alert" : ICO_TAREA[t.tipo] || "loader-circle", 15)}</span>
        <span class="t-tit" title="${esc(t.titulo)}">${esc(t.titulo)}</span><span class="t-acc"></span>
        <span class="t-sub"><span class="txt" title="${esc(t.texto || "")}">${esc(t.texto || "")}</span><span class="num">${est}${t.estado === "corriendo" && t.eta ? " · " + fmtEta(t.eta) : t.estado !== "corriendo" ? " · " + (dur < 60 ? Math.round(dur) + " s" : Math.round(dur / 60) + " min") : ""}</span></span>
        ${t.estado === "corriendo" ? `<div class="barra${typeof t.frac === "number" ? "" : " indet"}"><div style="width:${(t.frac || 0) * 100}%"></div></div>` : ""}`;
      const acc = d.querySelector(".t-acc");
      if (t.estado === "corriendo" && t.cancelar) { const b = document.createElement("button"); b.className = "btn chico"; b.textContent = "Cancelar"; b.onclick = () => t.cancelar(); acc.append(b); }
      if (t.estado !== "corriendo" && t.accion) { const b = document.createElement("button"); b.className = "btn chico primario"; b.textContent = t.accion.etiqueta; b.onclick = () => t.accion.fn(); acc.append(b); }
      if (t.estado !== "corriendo") { const b = document.createElement("button"); b.className = "icono-btn"; b.style.width = b.style.height = "24px"; b.innerHTML = ic("x", 14); b.setAttribute("aria-label", "Quitar de la lista"); b.onclick = () => quitar(t.id); acc.append(b); }
      cont.append(d);
    }
  }
  function alternar(v) {
    abierto = v ?? !abierto;
    $("#tareas-panel").hidden = !abierto; $("#tareas-btn").setAttribute("aria-expanded", String(abierto));
    if (abierto) { pintarLista(); $("#tareas-notif").checked = notifOn(); }
  }
  $("#tareas-btn").onclick = (e) => { e.stopPropagation(); alternar(); };
  $("#tareas-panel").onclick = (e) => e.stopPropagation();
  document.addEventListener("click", () => abierto && alternar(false));
  $("#tareas-limpiar").onclick = () => { for (const [k, t] of L) if (t.estado !== "corriendo") L.delete(k); pintar(); pintarLista(); };
  $("#tareas-notif").onchange = async (e) => {
    let ok = e.target.checked;
    if (ok && "Notification" in window && Notification.permission !== "granted") ok = (await Notification.requestPermission()) === "granted";
    e.target.checked = ok; try { sessionStorage.setItem("wdvs-notif", ok ? "1" : "0"); } catch { /* */ }
  };
  setInterval(() => { if (corriendo().length && abierto) pintarLista(); }, 1000);
  return { poner, terminar, quitar, corriendo, alternar, pintar, lista: L, abierto: () => abierto,
    demo() { poner("demo:1", { titulo: "Render final", tipo: "final", texto: "Renderizando en alta calidad", frac: 0.42, eta: 130, cancelar: () => {} });
      poner("demo:2", { titulo: "Vista fluida", tipo: "proxies", texto: "2 de 5 videos listos", frac: 0.4 });
      terminar("demo:3", true, { titulo: "Análisis de archivos", tipo: "analizar", texto: "5 archivos revisados", silenciosa: true }); alternar(true); },
    cerrarPanel() { alternar(false); for (const k of [...L.keys()]) if (k.startsWith("demo:")) L.delete(k); pintar(); } };
})();
WDVS.tareas = Tareas;
Tareas.pintar();

function iniciarSondeo(rapido) {
  clearInterval(sondeo);
  const f = async () => {
    if (!actual) return;
    let e; try { e = await api(`/api/proyectos/${encodeURIComponent(actual)}/estado`); } catch { return; }
    pintarTarea(e);
    window.dispatchEvent(new CustomEvent("wdvs:estado", { detail: { pid: actual, estado: e } }));
    if (!e.corriendo && e.fin && e.fin !== ultimaFin) {
      const primera = ultimaFin === null; ultimaFin = e.fin;
      const id = "proy:" + actual;
      if (primera && !Tareas.lista.has(id)) return;
      await refrescar();
      const pid = actual, tit = TEXTO_TAREA[e.tarea] || e.tarea;
      if (e.ok) {
        const acc = e.tarea === "final" ? { etiqueta: "Descargar", fn: () => comando("descargar") }
          : e.tarea === "exportar" ? { etiqueta: "Abrir carpeta", fn: () => api(`/api/proyectos/${encodeURIComponent(pid)}/editor/exportar/abrir`, { method: "POST", json: { que: "carpeta" } }).catch(errorToast) } : undefined;
        Tareas.terminar(id, true, { titulo: tit, tipo: e.tarea, texto: { final: "Tu video en alta calidad está listo.", exportar: "Proyecto para Premiere / DaVinci listo.", generar: "Tu video ya está en el editor.", ajustar: "Cambio aplicado." }[e.tarea] || "Listo.",
          accion: acc, silenciosa: ["preview_rango", "preview", "analizar"].includes(e.tarea) });
        if (["generar", "ajustar", "preview"].includes(e.tarea)) window.dispatchEvent(new CustomEvent("wdvs:plan-cambiado", { detail: { pid: actual, tarea: e.tarea } }));
      } else if (e.error) {
        const s = e.sugerencia || sugerir(e.error);
        Tareas.terminar(id, s.codigo === "cancelado" ? "cancelado" : false, { titulo: s.titulo || `${tit}: con error`, texto: e.error.split("\n")[0].slice(0, 300), accion: s.accion ? { etiqueta: s.accion.etiqueta, fn: () => irA(s.accion.ir) } : undefined });
      } else Tareas.quitar(id);
      window.dispatchEvent(new CustomEvent("wdvs:tarea-terminada", { detail: { pid: actual, estado: e } }));
    }
  };
  f(); sondeo = setInterval(f, rapido ? 800 : 1500);
}
WDVS.vigilar = () => iniciarSondeo(true);
function pintarTarea(e) {
  if (!e.corriendo || !actual) return;
  const p = progresoTarea(e);
  Tareas.poner("proy:" + actual, { titulo: p.titulo || "Tarea", tipo: e.tarea, texto: e.cancelando ? "Cancelando…" : p.texto, frac: p.frac, eta: p.eta, cancelar: cancelarTareaProyecto });
}
async function cancelarTareaProyecto() {
  if (!actual) return;
  if (!await confirmar({ titulo: "¿Cancelar la tarea?", cuerpo: "Se detiene lo que se está haciendo. No se pierde nada de lo ya guardado.", si: "Cancelar tarea", peligro: true })) return;
  try { await api(`/api/proyectos/${encodeURIComponent(actual)}/cancelar`, { method: "POST" }); toast("Cancelando…"); } catch (e) { errorToast(e); }
};
WDVS.cancelarTarea = cancelarTareaProyecto;

// ================================================================== inicio: proyectos en tarjetas
function haceCuanto(iso) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "hace un momento"; if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`; if (s < 86400 * 7) return `hace ${Math.round(s / 86400)} días`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}
async function cargarProyectos() {
  let d; try { d = await api("/api/proyectos"); } catch (e) { errorToast(e); return; }
  proyectosCache = d.proyectos;
  if (d.perfil) { const h = $("#hola-perfil"); if (h) h.textContent = d.perfil.nombre && d.perfil.id !== "principal" ? `Hola, ${d.perfil.nombre}` : ""; }
  $("#raiz-proyectos").textContent = "Carpeta de proyectos: " + d.raiz;
  $("#rejilla-proy").setAttribute("aria-busy", "false");
  pintarProyectos();
}
function pintarProyectos() {
  const q = ($("#buscar-proy").value || "").toLowerCase();
  const ps = proyectosCache.filter((p) => !q || (p.nombre || p.id).toLowerCase().includes(q));
  $("#rejilla-proy").innerHTML = ps.map((p) => {
    const s = p.salida;
    const img = `<div class="sin-mini">${ICONO.film}</div>` + (s ? `<img loading="lazy" src="/api/proyectos/${encodeURIComponent(p.id)}/miniatura?t=${Math.round(s.mtime)}" alt="" onerror="this.remove()">` : "");
    return `<article class="tarjeta-proy" data-id="${esc(p.id)}" tabindex="0">
      <div class="mini">${img}${s?.duracion ? `<span class="dur">${dur(s.duracion)}</span>` : ""}${p.ocupado ? `<span class="insignia"><span class="giro"></span>trabajando…</span>` : ""}${p.aprobacion === "aprobado" ? `<span class="insignia-apr ok sobre">${ic("check", 12)} Aprobado</span>` : p.aprobacion === "cambios" ? `<span class="insignia-apr aviso sobre">Cambios pedidos</span>` : ""}</div>
      <div class="info"><div class="nom" title="${esc(p.nombre)}">${esc(p.nombre)}</div>
        <div class="sub">${esc(haceCuanto(p.modificado))} · ${p.medios} archivo${p.medios === 1 ? "" : "s"}${p.tiene_plan ? "" : " · sin video"}</div></div>
      <button class="icono-btn mas" data-menu-proy title="Opciones del proyecto" aria-label="Opciones de ${esc(p.nombre)}">${ICONO.mas}</button></article>`;
  }).join("") || `<div class="vacio vacio-guia">${ic(q ? "search" : "clapperboard", 40)}<b>${q ? "Sin resultados" : "Todavía no hay proyectos"}</b>
      <span>${q ? "Prueba con otro nombre." : "Arrastra tus grabaciones a esta ventana o crea tu primer video: la IA arma el primer corte por ti."}</span>
      ${q ? "" : `<div class="acciones"><button class="btn primario" onclick="WDVS.nuevoProyecto()">${ic("plus", 14)} Nuevo proyecto</button></div>`}</div>`;
  $$("#rejilla-proy .tarjeta-proy").forEach((c) => {
    c.onclick = (e) => { if (!e.target.closest("[data-menu-proy]")) abrirProyecto(c.dataset.id); };
    c.onkeydown = (e) => { if (e.key === "Enter") abrirProyecto(c.dataset.id); };
    $("[data-menu-proy]", c).onclick = (e) => { e.stopPropagation(); menuProyecto(c.dataset.id, e.currentTarget); };
  });
}
$("#buscar-proy").oninput = pintarProyectos;

function menuProyecto(pid, ancla) {
  $$(".menu-flotante").forEach((m) => m.remove());
  const m = document.createElement("div"); m.className = "menu-flotante";
  m.setAttribute("role", "menu");
  m.innerHTML = `<button data-a="abrir" role="menuitem">${ic("folder-open", 15)}<span>Abrir</span></button><button data-a="renombrar" role="menuitem">${ic("type", 15)}<span>Renombrar…</span></button><button data-a="duplicar" role="menuitem">${ic("copy", 15)}<span>Duplicar</span></button><button data-a="mnproj" role="menuitem">${ic("package", 15)}<span>Exportar (.wsproj)…</span></button><hr><button data-a="borrar" class="peligro" role="menuitem">${ic("trash-2", 15)}<span>Borrar…</span></button>`;
  document.body.appendChild(m);
  const r = ancla.getBoundingClientRect();
  m.style.top = `${r.bottom + 4}px`; m.style.left = `${Math.max(8, r.right - 180)}px`;
  m.onclick = async (e) => { const b = e.target.closest("[data-a]"); if (!b) return; m.remove(); await accionProyecto(b.dataset.a, pid); };
  m.querySelector("button").focus();
  m.onkeydown = (e) => { const bs = [...m.querySelectorAll("button")], i = bs.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length].focus(); } else if (e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); } else if (e.key === "Escape") { m.remove(); ancla.focus(); } };
  setTimeout(() => document.addEventListener("click", () => m.remove(), { once: true }), 0);
}
async function accionProyecto(a, pid) {
  const p = proyectosCache.find((x) => x.id === pid) || { nombre: datos?.nombre || pid };
  const url = `/api/proyectos/${encodeURIComponent(pid)}`;
  try {
    if (a === "abrir") return abrirProyecto(pid);
    if (a === "mnproj") return WDVS.colab && WDVS.colab.abrir(pid, "mnproj");
    if (a === "renombrar") {
      const n = await confirmar({ titulo: "Renombrar proyecto", si: "Guardar", input: { valor: p.nombre } });
      if (n) { await api(`${url}/nombre`, { method: "PUT", json: { nombre: n } }); toast("Nombre actualizado", "ok"); if (pid === actual) $("#proy-nombre").value = n; }
    } else if (a === "duplicar") {
      const q = await api(`${url}/duplicar`, { method: "POST" }); toast(`Se creó «${q.nombre}»`, "ok");
    } else if (a === "borrar") {
      const ok = await confirmar({ titulo: `¿Borrar «${p.nombre}»?`, peligro: true, si: "Borrar para siempre",
        cuerpo: `Se borra la carpeta del proyecto (plan, historial, renders y archivos subidos). <b>No se puede deshacer.</b><br>
          Los videos que agregaste desde otra carpeta de tu PC no se tocan.` });
      if (!ok) return;
      await api(`${url}?confirmar=${encodeURIComponent(pid)}`, { method: "DELETE" }); toast("Proyecto borrado", "ok");
      if (pid === actual) mostrarInicio();
    }
  } catch (e) { errorToast(e); }
  cargarProyectos();
}

// ================================================================== vistas
function mostrarInicio() {
  if (actual) { if (WDVS.cerrarEditor) WDVS.cerrarEditor(); else if (window.Editor) Editor.cerrar(); }
  actual = null; datos = null; clearInterval(sondeo);
  $("#inicio").hidden = false; $("#workspace").hidden = true; cerrarCajonIA();
  $("#proy-nombre-caja").hidden = true; $("#btn-ia").hidden = true; $("#modo-caja").hidden = true;
  for (const [k] of [...Tareas.lista]) if (k.startsWith("proy:") || k.startsWith("proxies:")) Tareas.quitar(k);
  document.body.classList.remove("en-proyecto", "modo-editor"); document.body.classList.add("en-inicio");
  history.replaceState(null, "", location.pathname);
  menuSegunVista();
  cargarProyectos();
  window.dispatchEvent(new CustomEvent("wdvs:inicio"));   // perfiles.js cierra la sesión del proyecto (autoguardado)
}
async function abrirProyecto(pid) {
  try { await WDVS.abrirEditor(pid, $("#workspace")); } catch (e) { errorToast(e); mostrarInicio(); }
}
// editor.js (cargado después) registra su montaje en WDVS.editorMontar; esta función es la de la app: muestra el
// espacio de trabajo, la barra del proyecto y el sondeo de tareas, y luego monta el editor en `contenedor`.
WDVS.abrirEditor = async (pid, contenedor) => {
  actual = pid; ultimaFin = null;
  datos = await api(`/api/proyectos/${encodeURIComponent(pid)}`);
  $("#inicio").hidden = true;
  const ws = contenedor || $("#workspace"); ws.hidden = false;
  document.body.classList.add("en-proyecto", "modo-editor"); document.body.classList.remove("en-inicio");
  $("#proy-nombre-caja").hidden = false; $("#proy-nombre").value = datos.nombre || pid; $("#btn-ia").hidden = false; $("#modo-caja").hidden = false;
  history.replaceState(null, "", "#p=" + encodeURIComponent(pid));
  menuSegunVista();
  iniciarSondeo();
  if (WDVS.editorMontar) await WDVS.editorMontar(pid, ws);
  else if (window.Editor) await Editor.abrir(pid);
  window.dispatchEvent(new CustomEvent("wdvs:proyecto-abierto", { detail: { pid, datos } }));
  hidratarIconos($("#appbar"));
  setTimeout(() => Tour.quizas(), 900);
  if (!datos.tiene_plan && !(datos.historial || []).length) abrirCajonIA();
};
WDVS.cerrarProyecto = mostrarInicio;
WDVS.refrescarInicio = () => { if (!actual) cargarProyectos(); };
WDVS.proyectoActual = () => actual;

async function refrescar() {
  if (!actual) return;
  try { datos = await api(`/api/proyectos/${encodeURIComponent(actual)}`); } catch { return; }
  if (document.activeElement !== $("#proy-nombre")) $("#proy-nombre").value = datos.nombre || actual;
  if (window.Editor) Editor.refrescar();
}
WDVS.refrescar = refrescar;

$("#proy-nombre").onchange = async (e) => {
  const n = e.target.value.trim(); if (!n || !actual) return;
  try { await api(`/api/proyectos/${encodeURIComponent(actual)}/nombre`, { method: "PUT", json: { nombre: n } }); datos.nombre = n; toast("Nombre guardado", "ok", { ms: 1800 }); } catch (err) { errorToast(err); }
};
$("#proy-nombre").onkeydown = (e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { e.target.value = datos?.nombre || ""; e.target.blur(); } };
$("#ir-inicio").onclick = mostrarInicio;

// ================================================================== menú Archivo y atajos
function menuSegunVista() {
  $$("#menu-archivo [data-proy]").forEach((b) => b.hidden = !actual);
  $$("#menu-archivo [data-dev]").forEach((b) => b.hidden = !actual || !dev());
}
$("#menu-archivo [data-menu]").onclick = (e) => { e.stopPropagation(); const ab = $("#menu-archivo").classList.toggle("abierto"); e.currentTarget.setAttribute("aria-expanded", String(ab)); if (ab && e.detail === 0) { const b = $("#menu-archivo .menu-lista button:not([hidden])"); if (b) b.focus(); } };
$("#menu-archivo .menu-lista").onkeydown = (e) => { const bs = $$("#menu-archivo .menu-lista button:not([hidden])"), i = bs.indexOf(document.activeElement);
  if (e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length].focus(); } else if (e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
  else if (e.key === "Escape") { $("#menu-archivo").classList.remove("abierto"); $("#menu-archivo [data-menu]").focus(); } };
document.addEventListener("click", () => { const m = $("#menu-archivo"); if (m) { m.classList.remove("abierto"); $("[data-menu]", m).setAttribute("aria-expanded", "false"); } });
$$("#menu-archivo [data-cmd]").forEach((b) => b.onclick = () => { $("#menu-archivo").classList.remove("abierto"); comando(b.dataset.cmd); });
async function comando(c) {
  const pid = actual;
  if (c === "nuevo") return WDVS.nuevoProyecto();
  if (c === "abrir") return mostrarInicio();
  if (c === "ajustes") return abrirAjustes();
  if (!pid) return;
  if (c === "guardar") {
    const ev = new CustomEvent("wdvs:guardar-version", { detail: { pid }, cancelable: true });
    if (window.dispatchEvent(ev)) toast("Tus cambios se guardan solos: cada cambio queda como versión en el historial.", "ok");
  } else if (c === "exportar") {
    const ev = new CustomEvent("wdvs:exportar", { detail: { pid }, cancelable: true });
    if (window.dispatchEvent(ev)) {   // nadie lo atendió: descarga el final o propone hacerlo
      if (datos?.salidas?.final) comando("descargar");
      else if (await confirmar({ titulo: "Todavía no hay video final", cuerpo: "¿Hago el render final en 1920x1080? Tarda unos minutos.", si: "Hacer render final" })) comando("final");
    }
  } else if (c === "final") {
    try { await api(`/api/proyectos/${encodeURIComponent(pid)}/tareas/final`, { method: "POST", json: {} }); iniciarSondeo(true); toast("Render final en curso…"); } catch (e) { errorToast(e); }
  } else if (c === "descargar") {
    if (!datos?.salidas?.final) return toast("Todavía no hay video final. Usa Archivo > Render final.");
    const a = document.createElement("a"); a.href = `/api/proyectos/${encodeURIComponent(pid)}/video/final`; a.download = `${datos.nombre || pid}.mp4`; a.click();
  } else if (c === "duplicar") accionProyecto("duplicar", pid);
  else if (c === "regenerar") WDVS.asistenteIA(pid);
  else if (c === "plan") verPlan();
}
WDVS.comando = comando;
// Atajos globales (solo con Ctrl/Cmd, salvo Esc). Las teclas sueltas (espacio, S, J/K/L…) y Ctrl+Z/Y/C/V/D/A son
// del editor, que las ignora cuando el foco está en un campo, en el cajón del asistente o en un diálogo.
document.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  const cajon = $("#cajon-ia");
  if (!mod) {
    if (e.key === "Escape" && !$("#panel-ayuda").hidden) { cerrarAyuda(); return; }
    if (e.key === "Escape" && Tareas.abierto()) { Tareas.alternar(false); return; }
    if (e.key === "Escape" && cajon && !cajon.hidden && !document.querySelector("dialog[open]")) cerrarCajonIA();
    // «?» abre la ayuda (en el editor la atiende editor.js, que llama a WDVS.ayuda)
    if (e.key === "?" && !e.target.closest("input, textarea, select, [contenteditable]") && !document.querySelector("dialog[open]") && !document.querySelector("#wded:not([hidden])")) { e.preventDefault(); WDVS.ayuda(); }
    return;
  }
  const k = (e.key || "").toLowerCase();
  if (document.querySelector("dialog[open]")) return;   // con un diálogo abierto (Ajustes, Nuevo video…) no hay atajos globales
  const mapa = { n: "nuevo", o: "abrir", ",": "ajustes", e: "exportar", s: "guardar" };
  if (k === "k" && actual) { e.preventDefault(); return asistenteVisible() ? cerrarCajonIA() : abrirCajonIA(); }
  if (mapa[k] && !e.shiftKey && !e.altKey) { e.preventDefault(); comando(mapa[k]); }
});

// ================================================================== plan JSON (solo modo desarrollador)
async function verPlan() {
  if (!actual) return;
  $("#dlg-plan").showModal(); $("#validacion").textContent = "";
  try { $("#plan-json").textContent = JSON.stringify(await api(`/api/proyectos/${encodeURIComponent(actual)}/plan`), null, 1); }
  catch (e) { $("#plan-json").textContent = e.message; }
}
$("#btn-validar").onclick = async () => {
  $("#validacion").textContent = "Validando…";
  try {
    const r = await api(`/api/proyectos/${encodeURIComponent(actual)}/validar`);
    $("#validacion").innerHTML = (r.ok ? `<p class="estado-ok">Plan válido</p>` : `<p class="estado-error">Plan con errores</p>`)
      + r.errores.map((x) => `<div class="estado-error">• ${esc(x)}</div>`).join("") + r.avisos.map((x) => `<div class="tenue">• ${esc(x)}</div>`).join("");
  } catch (e) { $("#validacion").textContent = e.message; }
};

// ================================================================== archivos: subir, explorar, arrastrar y soltar
function subirArchivo(pid, f, onprog) {
  return new Promise((ok, mal) => {
    const fd = new FormData(); fd.append("archivo", f); fd.append("rol", "");
    const x = new XMLHttpRequest();
    x.open("POST", `/api/proyectos/${encodeURIComponent(pid)}/subir`);
    x.upload.onprogress = (e) => onprog && e.total && onprog(e.loaded / e.total);
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch { /* */ } x.status < 300 ? ok(d) : mal(new Error(d.detail || x.statusText)); };
    x.onerror = () => mal(new Error("Falló la subida de " + f.name));
    x.send(fd);
  });
}
WDVS.subirArchivo = subirArchivo;
async function subirVarios(pid, files, onprog) {
  const ok = [];
  const total = [...files].reduce((a, f) => a + f.size, 0) || 1; let hecho = 0;
  const id = "subir:" + Date.now(), t0 = Date.now();
  for (const f of files) {
    try {
      ok.push(await subirArchivo(pid, f, (fr) => {
        const x = (hecho + fr * f.size) / total, s = (Date.now() - t0) / 1000;
        Tareas.poner(id, { titulo: `Subiendo ${files.length} archivo(s)`, tipo: "subir", texto: f.name, frac: x, eta: x > 0.05 && s > 3 ? s * (1 - x) / x : null });
        onprog && onprog(x, f.name);
      }));
    } catch (e) { errorToast(e, "No se pudo agregar " + f.name); }
    hecho += f.size;
  }
  Tareas.terminar(id, ok.length > 0, { titulo: `Subiendo ${files.length} archivo(s)`, texto: `${ok.length} de ${files.length} agregados`, silenciosa: true });
  return ok;
}
WDVS.subirVarios = subirVarios;

// ------------------------------------------------------------------ diálogo nativo de Windows (lo abre el servidor)
// WDVS.elegirNativo({tipo: "archivos"|"carpeta", filtro: "medios"|"videos"|"audio"|"imagenes"|"ejecutable"|"todo",
// multiple, titulo}) -> lista de rutas ([] si canceló) o null si la ventana de Windows no se pudo abrir.
let eligiendo = false;
WDVS.elegirNativo = async (op = {}) => {
  if (eligiendo) { toast("Ya hay una ventana para elegir archivos abierta; búscala en la barra de tareas.", "info"); return []; }
  eligiendo = true;
  const t = toast("Se abrió la ventana de Windows para elegir. Si no la ves, búscala en la barra de tareas.", "info", { ms: 0 });
  try {
    const r = await api("/api/sistema/elegir", { method: "POST", json: { tipo: op.tipo || "archivos", filtro: op.filtro || "medios", multiple: op.multiple !== false, titulo: op.titulo || null } });
    return r.rutas || [];
  } catch (e) {
    if (e.status === 409) { toast(e.message, "info"); return []; }
    console.warn("diálogo nativo no disponible:", e.message);
    return null;
  } finally { eligiendo = false; t.remove(); }
};
// respaldo del navegador: <input type=file> (sube una copia al proyecto)
function elegirConNavegador(accept = "video/*,audio/*,image/png,image/jpeg,image/webp,.mkv,.mov") {
  return new Promise((ok) => {
    const i = document.createElement("input"); i.type = "file"; i.multiple = true; i.accept = accept; i.hidden = true;
    i.onchange = () => { ok([...i.files]); i.remove(); };
    window.addEventListener("focus", () => setTimeout(() => { if (!i.files || !i.files.length) { ok([]); i.remove(); } }, 400), { once: true });
    document.body.appendChild(i); i.click();
  });
}
// Agrega medios al proyecto con la ventana de Windows, sin copiarlos (usa el archivo donde está). Con carpeta: true
// agrega todos los videos, audios e imágenes de la carpeta elegida. Devuelve los medios agregados.
WDVS.elegirMedios = async (pid, op = {}) => {
  const rutas = await WDVS.elegirNativo({ tipo: op.carpeta ? "carpeta" : "archivos", filtro: op.filtro || "medios", titulo: op.carpeta ? "Elige la carpeta con tus videos" : "Elige tus videos, música o logo" });
  if (rutas === null) {   // sin ventana nativa: el selector del navegador (sube una copia)
    const files = await elegirConNavegador();
    return files.length ? subirVarios(pid, files) : [];
  }
  let archivos = rutas;
  if (op.carpeta && rutas.length) {
    try { const d = await api(`/api/explorar?dir=${encodeURIComponent(rutas[0])}`); archivos = d.entradas.filter((e) => !e.dir).map((e) => e.ruta); }
    catch (e) { errorToast(e); return []; }
    if (!archivos.length) { toast("Esa carpeta no tiene videos, audio ni imágenes.", "info"); return []; }
    if (archivos.length > 8 && !await confirmar({ titulo: `¿Agregar ${archivos.length} archivos?`, cuerpo: `Se agregan todos los videos, audios e imágenes de <b>${esc(rutas[0])}</b>. No se copian: se usan donde están.`, si: "Agregar" })) return [];
  }
  const ok = [];
  for (const ruta of archivos) {
    try { ok.push(await api(`/api/proyectos/${encodeURIComponent(pid)}/medios`, { method: "POST", json: { ruta } })); }
    catch (e) { errorToast(e, "No se pudo agregar " + ruta.split(/[\\/]/).pop()); }
  }
  return ok;
};
// compatibilidad: WDVS.explorar(pid, alAgregar) ahora abre la ventana de Windows
WDVS.explorar = async (pid, alAgregar) => { const ms = await WDVS.elegirMedios(pid); ms.forEach((m) => alAgregar && alAgregar(m)); return ms; };

let arrastres = 0;
const conArchivos = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
window.addEventListener("dragenter", (e) => { if (conArchivos(e)) { arrastres++; $("#soltar").hidden = false; } });
window.addEventListener("dragleave", () => { if (--arrastres <= 0) { arrastres = 0; $("#soltar").hidden = true; } });
window.addEventListener("dragover", (e) => { if (conArchivos(e)) e.preventDefault(); });
window.addEventListener("drop", (e) => {
  if (!conArchivos(e)) return;
  e.preventDefault(); arrastres = 0; $("#soltar").hidden = true;
  WDVS.soltarArchivos([...e.dataTransfer.files]);
});
// a dónde van los archivos soltados en la ventana: al chat visible, o al proyecto abierto, o a un proyecto nuevo
WDVS.soltarArchivos = async (files) => {
  if (!files.length) return;
  const chatVisible = $("#dlg-nuevo").open ? nuevoChat : iaEditorVisible() ? (document.getElementById("der-ia")._chat || null)
    : (!$("#cajon-ia").hidden ? cajonChat : null);
  if (chatVisible) return chatVisible.adjuntar(files);
  if (actual) {
    const t = toast(`Agregando ${files.length} archivo(s)…`, "info", { ms: 0 });
    const ok = await subirVarios(actual, files, (fr) => { $(".toast-txt", t).textContent = `Agregando archivos… ${Math.round(fr * 100)}%`; });
    t.remove();
    if (ok.length) {
      toast(`${ok.length} archivo(s) agregados al proyecto`, "ok");
      api(`/api/proyectos/${encodeURIComponent(actual)}/chat/evento`, { method: "POST", json: { tipo: "adjunto", texto: "Agregaste: " + ok.map((m) => m.nombre).join(", ") } })
        .then(() => iniciarSondeo(true)).catch(() => {});
      refrescar();
    }
    return;
  }
  WDVS.nuevoProyecto(files);
};

// ================================================================== asistente IA: nuevo proyecto, regenerar y cajón
let nuevoChat = null, nuevoPid = null, cajonChat = null;
// nuevoProyecto(files?) pide el NOMBRE y ofrece dos caminos: «Crear con IA» (chat grande) o «Proyecto en blanco»
// (directo al editor vacío). Con un id de proyecto (texto), como lo llama el botón «Regenerar» del editor, abre
// «Regenerar con IA» de ese proyecto en vez de crear otro.
const nombrePorDefecto = () => { const f = new Date(); return `Video nuevo ${f.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" })} ${f.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`; };
async function crearProyecto(nombre) {
  try { return await api("/api/proyectos", { method: "POST", json: { nombre: (nombre || "").trim() || nombrePorDefecto() } }); }
  catch (e) { errorToast(e, "No se pudo crear el proyecto"); return null; }
}
let archivosNuevo = null;
WDVS.nuevoProyecto = (files) => {
  if (typeof files === "string") return WDVS.regenerar(files);
  archivosNuevo = files && files.length ? [...files] : null;
  const d = $("#dlg-proy-nuevo"), inp = $("#pn-nombre");
  inp.value = nombrePorDefecto();
  $("#pn-archivos").textContent = archivosNuevo ? `${archivosNuevo.length} archivo(s) listos para agregar` : "";
  if (!d.open) d.showModal();
  inp.focus(); inp.select();
};
WDVS.nuevoConIA = async (nombre) => { const p = await crearProyecto(nombre); if (p) abrirDialogoIA(p.id, true); return p; };
WDVS.nuevoEnBlanco = async (nombre) => { const p = await crearProyecto(nombre); if (p) await abrirProyecto(p.id); return p; };
$("#form-proy-nuevo").addEventListener("submit", async (e) => {
  e.preventDefault();
  const modo = (e.submitter && e.submitter.value) || "ia";
  const nombre = $("#pn-nombre").value, files = archivosNuevo; archivosNuevo = null;
  $("#dlg-proy-nuevo").close();
  const p = await crearProyecto(nombre); if (!p) return;
  if (modo === "blanco") {
    await abrirProyecto(p.id);
    if (files) WDVS.soltarArchivos(files);
    toast(`Proyecto «${p.nombre || nombre}» creado. Importa tus videos para empezar.`, "ok");
  } else abrirDialogoIA(p.id, true, files);
});
WDVS.asistenteIA = (pid, esNuevo = false) => abrirDialogoIA(pid || actual, esNuevo);
WDVS.regenerar = (pid) => abrirDialogoIA(pid || actual, false);
function abrirDialogoIA(pid, esNuevo, files) {
  nuevoPid = pid;
  $("#nuevo-titulo").textContent = esNuevo ? "Nuevo video con IA" : "Regenerar con IA";
  $("#nuevo-sub").textContent = esNuevo ? "Arrastra aquí tus videos, música o logo y cuéntame qué quieres." : "Cuéntale a la IA qué quieres distinto; si lo pides, arma el video de nuevo (queda en el historial).";
  const d = $("#dlg-nuevo"); d.dataset.nuevo = esNuevo ? "1" : ""; d.showModal();
  nuevoChat = WDVS.montarChat(pid, $("#nuevo-chat"), {
    grande: true,
    bienvenida: esNuevo ? "¡Hola! ¿Qué video quieres hacer hoy? Arrastra aquí tus videos (y si tienes, la música y el logo) y cuéntame de qué se trata."
      : "¿Qué quieres cambiar del video? Puedo ajustarlo o armarlo de nuevo desde cero.",
    opciones: esNuevo ? ["Un tráiler épico de mi juego", "Un comercial de 30 segundos", "Un video para presentar en la empresa"] : ["Ármalo de nuevo desde cero", "Hazlo más corto"],
    alTerminar: (tarea, ok) => { if (ok && tarea === "generar") { d.dataset.nuevo = ""; d.close(); abrirProyecto(pid); } },
  });
  if (files && files.length) nuevoChat.adjuntar(files);
  mediosNuevo.montar(pid);
}
$("#dlg-nuevo").addEventListener("close", async () => {
  const d = $("#dlg-nuevo"), pid = nuevoPid;
  if (nuevoChat) { nuevoChat.desmontar(); nuevoChat = null; }
  mediosNuevo.desmontar();
  if (d.dataset.nuevo === "1" && pid) {   // proyecto nuevo sin nada: se PREGUNTA si se descarta; nunca en silencio
    try {
      const p = await api(`/api/proyectos/${encodeURIComponent(pid)}`);
      const c = await api(`/api/proyectos/${encodeURIComponent(pid)}/chat`);
      const vacio = !p.medios.length && !c.mensajes.some((m) => m.rol === "usuario") && !p.ocupado;
      if (vacio && await confirmar({ titulo: "¿Descartar el proyecto vacío?", cuerpo: `«${esc(p.nombre || pid)}» no tiene archivos ni mensajes. Si lo conservas, queda en Inicio para seguir después.`, si: "Descartar", no: "Conservar", peligro: true }))
        await api(`/api/proyectos/${encodeURIComponent(pid)}?confirmar=${encodeURIComponent(pid)}`, { method: "DELETE" });
      else toast("El proyecto quedó guardado en Inicio.", "info");
    } catch { /* */ }
    if (!actual) cargarProyectos();
  }
});
$("#btn-nuevo-grande").onclick = () => WDVS.nuevoProyecto();
$("#btn-nuevo-ia").onclick = () => WDVS.nuevoProyecto();
$("#nuevo-editar").onclick = () => { const d = $("#dlg-nuevo"), pid = nuevoPid; d.dataset.nuevo = ""; d.close(); if (pid) abrirProyecto(pid); };

// ------------------------------------------------------------------ archivos del proyecto en «Nuevo video con IA»
// Lista los archivos que se van agregando (por el chat o arrastrándolos) con su ROL editable y el campo
// «¿Cómo te gustaría usarlo?» (se guardan en proyecto.json -> medios[i].rol / .nota con PATCH …/medios).
const MEDIO_ROLES = { video: ["video"], audio: ["musica", "voz", "efecto"], imagen: ["imagen", "logo", "fondo", "personaje", "marca_agua"] };
const MEDIO_ROL_TXT = { video: "Gameplay / toma", musica: "Música", voz: "Voz", efecto: "Efecto de sonido", imagen: "Imagen", logo: "Logo", fondo: "Fondo", personaje: "Personaje", marca_agua: "Marca de agua" };
const MEDIO_NOTA_PH = "Opcional. Ej.: usar al final con el logo; solo los primeros 30 s; música de fondo suave. Si lo dejas en blanco, la IA decide.";
WDVS.medioRoles = { roles: MEDIO_ROLES, textos: MEDIO_ROL_TXT, placeholder: MEDIO_NOTA_PH };
WDVS.cambiarMedio = (pid, ruta, cambios) => api(`/api/proyectos/${encodeURIComponent(pid)}/medios`, { method: "PATCH", json: { ruta, ...cambios } });
const mediosNuevo = (() => {
  let pid = null, caja = null, h = null, firma = "";
  function estilos() {
    if (document.getElementById("wdvs-medios-css")) return;
    const st = document.createElement("style"); st.id = "wdvs-medios-css";
    st.textContent = `.medios-nuevo{border-top:1px solid rgba(128,128,128,.25);padding:6px 14px 8px;max-height:34%;overflow:auto;flex:none}
.medios-nuevo summary{cursor:pointer;font-size:12px;opacity:.8;padding:2px 0}
.medios-nuevo .mfila{display:grid;grid-template-columns:minmax(120px,1.1fr) 150px 2fr;gap:8px;align-items:start;padding:5px 0;border-bottom:1px solid rgba(128,128,128,.15)}
.medios-nuevo .mnom{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.medios-nuevo .mnom small{display:block;opacity:.6}
.medios-nuevo select,.medios-nuevo textarea{width:100%;box-sizing:border-box;font:inherit;font-size:12px;padding:4px 6px;border-radius:5px}
.medios-nuevo textarea{resize:vertical;min-height:44px;height:46px}
.medios-nuevo .mok{font-size:10px;opacity:.7;min-height:11px}
@media (max-width:640px){.medios-nuevo .mfila{grid-template-columns:1fr 1fr}.medios-nuevo .mfila>label{grid-column:1/-1}}`;
    document.head.append(st);
  }
  function fila(m) {
    const div = document.createElement("div"); div.className = "mfila"; div.dataset.ruta = m.ruta;
    const roles = MEDIO_ROLES[m.tipo] || [m.rol];
    div.innerHTML = `<div class="mnom" title="${esc(m.ruta)}">${esc(m.nombre)}<small>${esc({ video: "video", audio: "audio", imagen: "imagen" }[m.tipo] || "")}${m.rol_origen === "sugerido" ? " · rol sugerido" : ""}</small></div>
      <select aria-label="Rol">${roles.map((r) => `<option value="${r}"${r === m.rol ? " selected" : ""}>${esc(MEDIO_ROL_TXT[r] || r)}</option>`).join("")}</select>
      <label><textarea maxlength="600" aria-label="¿Cómo te gustaría usarlo?" placeholder="${esc(MEDIO_NOTA_PH)}">${esc(m.nota || "")}</textarea><div class="mok"></div></label>`;
    const ok = $(".mok", div), sel = $("select", div), ta = $("textarea", div);
    const guardar = async (c) => { ok.textContent = "Guardando…"; try { await WDVS.cambiarMedio(pid, m.ruta, c); ok.textContent = "Guardado ✓"; firma = ""; } catch (e) { ok.textContent = ""; errorToast(e, "No se pudo guardar"); } };
    sel.onchange = () => guardar({ rol: sel.value });
    let ult = ta.value, t = null;
    const gNota = () => { clearTimeout(t); if (ta.value.trim() === ult.trim()) return; ult = ta.value; guardar({ nota: ta.value.trim() }); };
    ta.oninput = () => { clearTimeout(t); t = setTimeout(gNota, 900); };
    ta.onblur = gNota;
    return div;
  }
  async function refrescar() {
    if (!pid || !caja) return;
    if (caja.contains(document.activeElement)) return;   // no pisar lo que se está escribiendo
    let p; try { p = await api(`/api/proyectos/${encodeURIComponent(pid)}`); } catch { return; }
    const ms = p.medios || [];
    const f = JSON.stringify(ms.map((m) => [m.ruta, m.rol, m.nota]));
    if (f === firma || !caja || caja.contains(document.activeElement)) return;
    firma = f;
    caja.hidden = !ms.length;
    const abierto = caja.querySelector("details")?.open ?? true;
    caja.innerHTML = `<details${abierto ? " open" : ""}><summary>Archivos del proyecto (${ms.length}) · elige el rol y, si quieres, cómo usar cada uno</summary><div class="mlista"></div></details>`;
    const l = $(".mlista", caja);
    ms.forEach((m) => l.append(fila(m)));
  }
  return {
    montar(id) {
      estilos(); pid = id; firma = "";
      const cont = $("#nuevo-chat"); if (!cont) return;
      caja = document.getElementById("nuevo-medios");
      if (!caja) { caja = document.createElement("div"); caja.id = "nuevo-medios"; caja.className = "medios-nuevo"; cont.after(caja); }
      caja.innerHTML = ""; caja.hidden = true;
      refrescar(); clearInterval(h); h = setInterval(refrescar, 2500);
    },
    desmontar() { clearInterval(h); h = null; pid = null; if (caja) { caja.innerHTML = ""; caja.hidden = true; } },
    refrescar,
  };
})();
WDVS.refrescarMediosNuevo = () => mediosNuevo.refrescar();

// Con el editor montado, el asistente vive en su pestaña «Asistente IA» (panel derecho): así no se encoge el
// espacio de trabajo. El cajón lateral queda como respaldo si el editor no tiene esa pestaña.
const tabIAEditor = () => (!$("#workspace").hidden && document.querySelector('#der-tabs button[data-d="ia"]')) || null;
const iaEditorVisible = () => { const d = document.getElementById("der-ia"); return !!(tabIAEditor() && d && !d.hidden); };
function asistenteVisible() { return iaEditorVisible() || !$("#cajon-ia").hidden; }
function abrirCajonIA() {
  if (!actual) return;
  const tab = tabIAEditor();
  if (tab) {
    tab.click();
    setTimeout(() => { const ta = document.querySelector("#der-ia textarea"); if (ta) ta.focus(); }, 60);
    return;
  }
  $("#cajon-ia").hidden = false; document.body.classList.add("con-cajon");
  if (!cajonChat || cajonChat.pid !== actual) {
    cajonChat && cajonChat.desmontar();
    cajonChat = WDVS.montarChat(actual, $("#cajon-chat"), {
      bienvenida: "¿Qué le cambio al video? Dímelo con tus palabras, por ejemplo «textos más grandes» o «más rápido al final».",
      opciones: datos?.tiene_plan ? ["Haz los textos más grandes", "Más rápido al final", "Render final"] : ["Ármalo con lo que ya subí"],
    });
  }
  setTimeout(() => cajonChat && cajonChat.enfocar(), 50);
}
function cerrarCajonIA() {
  if (iaEditorVisible()) { const t = document.querySelector('#der-tabs button[data-d="insp"]'); if (t) t.click(); }
  const c = $("#cajon-ia"); if (c) c.hidden = true; document.body.classList.remove("con-cajon");
}
$("#btn-ia").onclick = () => { asistenteVisible() ? cerrarCajonIA() : abrirCajonIA(); setTimeout(() => $("#btn-ia").setAttribute("aria-pressed", String(asistenteVisible())), 80); };
window.addEventListener("wdvs:panel-derecho", () => $("#btn-ia").setAttribute("aria-pressed", String(asistenteVisible())));
$("#cajon-cerrar").onclick = cerrarCajonIA;
WDVS.abrirAsistente = abrirCajonIA;

// ================================================================== indicador de Claude
async function pintarClaudeChip() {
  try {
    const u = await api("/api/uso?n=400");
    const hoy = new Date().toLocaleDateString("sv-SE");
    const de = u.llamadas.filter((x) => (x.ts || "").startsWith(hoy) && x.uso);
    const tot = de.reduce((a, x) => a + (x.uso.entrada || 0) + (x.uso.salida || 0) + (x.uso.cache_lectura || 0) + (x.uso.cache_escritura || 0), 0);
    $("#claude-txt").textContent = de.length ? `Claude hoy: ${de.length} · ${tot >= 1000 ? (tot / 1000).toFixed(1) + "k" : tot} tokens` : "Claude";
  } catch { /* */ }
}
$("#claude-chip").onclick = () => abrirAjustes("uso");

// ================================================================== AJUSTES
const SEM = { ok: "Listo", aviso: "Atención", falta: "Falta", error: "Error" };
const semaforo = (s) => `<span class="sem ${s}" title="${SEM[s] || s}"></span>`;
let acciones = null, trabajo = null;
async function abrirAjustes(sec = "general", aviso = null) {
  const d = $("#dlg-ajustes"); if (!d.open) d.showModal();
  const b = $("#aj-aviso"); b.hidden = !aviso; if (aviso) b.innerHTML = aviso;
  irSeccion(sec);
  cargarConfig();
}
WDVS.abrirAjustes = abrirAjustes;
$("#btn-ajustes").onclick = () => abrirAjustes();
$$("#aj-nav [data-sec]").forEach((b) => b.onclick = () => irSeccion(b.dataset.sec));
function irSeccion(sec) {
  $$("#aj-nav [data-sec]").forEach((b) => b.classList.toggle("activa", b.dataset.sec === sec));
  $$(".aj-sec").forEach((s) => s.hidden = s.dataset.sec !== sec);
  if (sec === "claude") cargarClaude();
  if (sec === "deps") cargarDeps();
  if (sec === "uso") cargarUso();
  if (sec === "avanzado") { $("#modo-dev").checked = dev(); }
  if (sec === "metricas" && WDVS.pintarMetricas) WDVS.pintarMetricas();
  if (sec === "estilo") {   // Ajustes › Mi estilo (estilo_panel.js, docs/estilo.md): se monta al abrirla
    const c = $("#aj-estilo");
    if (c && WDVS.estilo && WDVS.estilo.montar) { c.innerHTML = ""; try { WDVS.estilo.montar(c); } catch (e) { console.warn(e); } }
    else if (c) c.innerHTML = '<div class="vacio-guia"><b>Mi estilo</b><span>Abre un proyecto una vez para cargar el perfil de estilo.</span></div>';
  }
}
async function cargarConfig() {
  try {
    const r = await api("/api/ajustes");
    const f = $("#form-ajustes");
    for (const [k, v] of Object.entries(r.config)) { const el = f.elements[k]; if (el) el.value = v ?? ""; }
    $("#aj-ruta").textContent = "Se guarda en " + r.ruta; $("#av-config").textContent = r.ruta;
  } catch (e) { errorToast(e); }
}
$("#form-ajustes").onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target, cambios = {};
  for (const el of f.elements) if (el.name) cambios[el.name] = el.type === "number" ? Number(el.value) : el.value;
  try { await api("/api/ajustes", { method: "PUT", json: cambios }); toast("Ajustes guardados", "ok"); }
  catch (err) { errorToast(err, "No se guardaron los ajustes"); }
};
$("#aj-examinar-carpeta").onclick = async () => {
  const r = await WDVS.elegirNativo({ tipo: "carpeta", filtro: "todo", titulo: "Elige la carpeta de proyectos" });
  if (r && r.length) { $('#form-ajustes [name="carpeta_proyectos"]').value = r[0]; toast("Pulsa Guardar para aplicar la carpeta (se usa al reiniciar la app).", "info"); }
  else if (r === null) toast("No se pudo abrir la ventana de Windows; escribe la ruta a mano.", "info");
};
$("#modo-dev").onchange = (e) => { try { sessionStorage.setItem("wdvs-dev", e.target.checked ? "1" : "0"); } catch { /* */ } menuSegunVista(); toast(e.target.checked ? "Modo desarrollador activado" : "Modo desarrollador desactivado"); };

// ---------- Claude Code
async function cargarClaude() {
  $("#cli-estado").textContent = "Buscando Claude Code…";
  let e; try { e = await api("/api/ajustes/claude"); } catch (err) { return errorToast(err); }
  $("#cli-sem").innerHTML = semaforo(e.semaforo); $("#nav-sem-claude").className = "sem " + e.semaforo;
  const cands = e.candidatos.map((c) => `<label class="cand"><input type="radio" name="cli-ruta" value="${esc(c.ruta)}" ${c.ruta === e.ruta ? "checked" : ""}>
      <span><code>${esc(c.ruta)}</code> <span class="tenue">· ${esc(c.fuente)}</span></span></label>`).join("");
  const s = e.sesion;
  $("#cli-estado").innerHTML = `<p><b>${esc(e.resumen)}</b></p>
    ${e.ruta ? `<p class="pequeno">Versión <b>${esc(e.version || "?")}</b> · en uso: <code>${esc(e.ruta)}</code></p>` : ""}
    <p class="pequeno tenue">Sesión: ${s.credenciales ? "credenciales guardadas ✓" : "sin credenciales"}${s.token_entorno ? " · token de larga duración ✓" : ""}${s.api_key ? " · ANTHROPIC_API_KEY definida" : ""}
      · Git for Windows: ${e.git_bash ? "sí ✓" : "no (recomendado)"}</p>
    ${cands ? `<details ${e.candidatos.length > 1 ? "open" : ""}><summary class="pequeno">Instalaciones encontradas (${e.candidatos.length}) — elige cuál usar</summary><div class="cands">${cands}</div></details>` : ""}
    <div class="fila"><input id="cli-ruta-manual" placeholder="…o pega la ruta de claude.exe"><button class="btn sec chico" id="cli-ruta-examinar" title="Busca claude.exe con la ventana de Windows">Examinar…</button><button class="btn sec chico" id="cli-ruta-guardar">Usar esta ruta</button>
      <button class="btn sec chico" id="cli-ruta-auto" title="Volver a la detección automática">Automático</button></div>`;
  $$('[name="cli-ruta"]').forEach((r) => r.onchange = () => guardarRutaCli(r.value));
  $("#cli-ruta-examinar").onclick = async () => { const r = await WDVS.elegirNativo({ tipo: "archivos", filtro: "ejecutable", multiple: false, titulo: "Busca claude.exe" }); if (r && r.length) { $("#cli-ruta-manual").value = r[0]; guardarRutaCli(r[0]); } else if (r === null) toast("No se pudo abrir la ventana de Windows; pega la ruta a mano.", "info"); };
  $("#cli-ruta-guardar").onclick = () => guardarRutaCli($("#cli-ruta-manual").value.trim().replace(/^"|"$/g, ""));
  $("#cli-ruta-auto").onclick = () => guardarRutaCli("");
  if (!acciones) try { acciones = await api("/api/ajustes/acciones"); } catch { acciones = {}; }
  const inst = !!e.ruta;
  $("#cli-metodos").innerHTML = [["claude_nativo", "Recomendado"], ["claude_winget", ""], ["claude_npm", ""]].map(([id, et]) => {
    const a = acciones[id] || {};
    return `<div class="metodo"><div><b>${esc(a.titulo || id)}</b> ${et ? `<span class="etq">${et}</span>` : ""}<br><code>${esc(a.comando || "")}</code>
      ${a.nota ? `<div class="tenue pequeno">${esc(a.nota)}</div>` : ""}</div><button class="btn ${id === "claude_nativo" ? "" : "sec"} chico" data-instalar="${id}">${inst ? "Reinstalar" : "Instalar"}</button></div>`;
  }).join("") + (inst ? `<div class="fila"><button class="btn sec chico" data-instalar="claude_update">Actualizar (claude update)</button>
      <button class="btn sec chico" data-instalar="claude_doctor">Diagnóstico (claude doctor)</button></div>` : "");
  $$("#cli-metodos [data-instalar]").forEach((b) => b.onclick = () => instalar(b.dataset.instalar));
  ["cli-login", "cli-setup-token", "cli-probar"].forEach((id) => $("#" + id).disabled = !inst);
}
async function guardarRutaCli(ruta) {
  try { await api("/api/ajustes", { method: "PUT", json: { claude_cli: ruta } }); toast(ruta ? "Ruta de Claude guardada" : "Detección automática", "ok"); cargarClaude(); }
  catch (e) { errorToast(e); }
}
$("#cli-detectar").onclick = cargarClaude;
$("#cli-login").onclick = async () => {
  try { await api("/api/ajustes/claude/terminal", { method: "POST", json: { modo: "login" } });
    toast("Se abrió una ventana de Claude. Inicia sesión en el navegador; al terminar, vuelve y pulsa «Probar conexión».", "ok", { ms: 12000 }); }
  catch (e) { errorToast(e); }
};
$("#cli-setup-token").onclick = async () => {
  try { await api("/api/ajustes/claude/terminal", { method: "POST", json: { modo: "setup-token" } });
    toast("Autoriza en el navegador y copia el token que aparece en la ventana negra; pégalo abajo.", "ok", { ms: 12000 }); $("#cli-p3 details").open = true; }
  catch (e) { errorToast(e); }
};
$("#cli-token-guardar").onclick = async () => {
  try { await api("/api/ajustes/claude/token", { method: "POST", json: { token: $("#cli-token").value } }); $("#cli-token").value = ""; toast("Token guardado cifrado en tu perfil de Windows", "ok"); cargarClaude(); }
  catch (e) { errorToast(e); }
};
$("#cli-token-borrar").onclick = async () => { try { await api("/api/ajustes/claude/token", { method: "DELETE" }); toast("Token quitado", "ok"); cargarClaude(); } catch (e) { errorToast(e); } };
$("#cli-probar").onclick = async () => {
  const b = $("#cli-probar"); b.disabled = true; $("#cli-prueba").innerHTML = `<p class="tenue"><span class="giro"></span> Llamando a Claude…</p>`;
  try {
    const r = await api("/api/ajustes/claude/probar", { method: "POST", json: {} });
    const u = r.uso || {};
    $("#cli-prueba").innerHTML = r.ok
      ? `<div class="resultado ok">✔ Conexión correcta · modelo <b>${esc(r.modelo)}</b> · ${r.segundos} s · entrada ${num(u.entrada)} + caché ${num(u.cache_lectura)}/${num(u.cache_escritura)} · salida ${num(u.salida)} tokens</div>`
      : `<div class="resultado error">✖ ${esc((r.error || "Sin respuesta válida").split("\nDetalle")[0])}</div>`;
    if (!r.ok) { const s = sugerir(r.error || ""); if (s.titulo) toast(s.titulo, "error"); }
    pintarClaudeChip();
  } catch (e) { $("#cli-prueba").innerHTML = `<div class="resultado error">✖ ${esc(e.message)}</div>`; }
  b.disabled = false;
};

// ---------- instalación con salida en vivo
async function instalar(accion) {
  if (!acciones) acciones = await api("/api/ajustes/acciones");
  const a = acciones[accion];
  if (!a) return;
  const ok = await confirmar({ titulo: a.titulo, si: "Ejecutar",
    cuerpo: `Se ejecutará en esta PC:<pre class="log">${esc(a.comando)}</pre>${a.nota ? `<p class="tenue">${esc(a.nota)}</p>` : ""}<p class="tenue">Verás la salida en vivo. Puede tardar varios minutos.</p>` });
  if (!ok) return;
  try { trabajo = await api("/api/ajustes/instalar", { method: "POST", json: { accion, confirmado: true } }); }
  catch (e) { return errorToast(e); }
  $("#instalacion").hidden = false; $("#inst-titulo").textContent = trabajo.titulo; $("#inst-log").textContent = "";
  const idT = "instalar:" + trabajo.id;
  Tareas.poner(idT, { titulo: trabajo.titulo, tipo: "instalar", texto: "Instalando…", frac: null, cancelar: () => $("#inst-cancelar").click() });
  $("#inst-cancelar").hidden = false; $("#inst-cerrar").hidden = true;
  let desde = 0;
  const paso = async () => {
    let t; try { t = await api(`/api/ajustes/tareas/${trabajo.id}?desde=${desde}`); } catch { return setTimeout(paso, 1500); }
    desde = t.total;
    const log = $("#inst-log"); if (t.lineas.length) { log.textContent += t.lineas.join("\n") + "\n"; log.scrollTop = log.scrollHeight; }
    $("#inst-estado").textContent = { corriendo: `en curso · ${Math.round(t.segundos)} s`, ok: "terminó bien ✓", error: `terminó con error (código ${t.codigo})`, cancelado: "cancelado" }[t.estado];
    if (t.estado === "corriendo") return setTimeout(paso, 600);
    $("#inst-cancelar").hidden = true; $("#inst-cerrar").hidden = false;
    Tareas.terminar(idT, t.estado === "ok" ? true : t.estado === "cancelado" ? "cancelado" : false, { titulo: t.titulo, texto: t.estado === "ok" ? "Instalación terminada." : `Terminó: ${t.estado}` });
    acciones = null; cargarClaude(); if (!$('.aj-sec[data-sec="deps"]').hidden) cargarDeps();
  };
  paso();
}
WDVS.instalar = instalar;
$("#inst-cancelar").onclick = async () => { if (trabajo) try { await api(`/api/ajustes/tareas/${trabajo.id}/cancelar`, { method: "POST" }); } catch (e) { errorToast(e); } };
$("#inst-cerrar").onclick = () => { $("#instalacion").hidden = true; };

// ---------- dependencias
async function cargarDeps() {
  const tb = $("#tabla-deps tbody");
  tb.innerHTML = `<tr><td colspan="5" class="tenue"><span class="giro"></span> Revisando (la GPU tarda unos segundos)…</td></tr>`;
  let r; try { r = await api("/api/ajustes/dependencias"); } catch (e) { return errorToast(e); }
  if (!acciones) try { acciones = await api("/api/ajustes/acciones"); } catch { acciones = {}; }
  const peor = r.dependencias.filter((d) => d.critico).reduce((a, d) => ({ falta: 3, error: 3, aviso: 1, ok: 0 }[d.semaforo] > ({ falta: 3, error: 3, aviso: 1, ok: 0 }[a]) ? d.semaforo : a), "ok");
  $("#nav-sem-deps").className = "sem " + peor;
  tb.innerHTML = r.dependencias.map((d) => `<tr><td>${semaforo(d.semaforo)}</td>
    <td><b>${esc(d.nombre)}</b>${d.critico ? "" : ' <span class="etq">opcional</span>'}<div class="tenue pequeno">${esc(d.ayuda || "")}</div>${d.ruta ? `<div class="tenue pequeno ruta">${esc(d.ruta)}</div>` : ""}</td>
    <td>${esc(d.version || "—")}</td><td class="pequeno">${esc(d.detalle)}</td>
    <td>${d.id === "claude" ? `<button class="btn sec chico" data-ir-claude>Abrir asistente</button>`
      : d.accion && acciones[d.accion]?.disponible !== false ? `<button class="btn chico" data-instalar="${d.accion}">Instalar o reparar</button>` : ""}</td></tr>`).join("");
  $$("#tabla-deps [data-instalar]").forEach((b) => b.onclick = () => instalar(b.dataset.instalar));
  $$("#tabla-deps [data-ir-claude]").forEach((b) => b.onclick = () => irSeccion("claude"));
}
$("#deps-recargar").onclick = cargarDeps;

// ---------- uso de Claude
async function cargarUso() {
  let r; try { r = await api("/api/ajustes/uso"); } catch (e) { return errorToast(e); }
  $("#uso-log").textContent = "Registro: " + r.log;
  $("#tabla-uso-dia tbody").innerHTML = r.por_dia.map((d) => `<tr><td>${esc(d.dia)}</td><td>${d.llamadas}</td><td>${num(d.entrada)}</td><td>${num(d.cache_lectura)} / ${num(d.cache_escritura)}</td><td>${num(d.salida)}</td></tr>`).join("")
    || `<tr><td colspan="5" class="tenue">Sin llamadas registradas</td></tr>`;
  $("#tabla-uso-proy tbody").innerHTML = r.por_proyecto.map((d) => `<tr><td>${esc(d.dia)}</td><td>${esc(d.nombre)}</td><td>${d.llamadas}</td><td>${num(d.entrada + d.cache_lectura + d.cache_escritura)}</td><td>${num(d.salida)}</td></tr>`).join("")
    || `<tr><td colspan="5" class="tenue">Sin llamadas en proyectos</td></tr>`;
}

// ================================================================== TOOLTIPS con atajo (reemplazan el title nativo de los botones)
// Cualquier botón con title="Texto (Ctrl+Z)" muestra un tooltip propio con el atajo como tecla; también con el foco del
// teclado. El title se guarda en data-tip (y en aria-label si el botón no tiene texto visible).
const Tip = (() => {
  const tip = document.createElement("div"); tip.className = "tip"; tip.setAttribute("role", "tooltip"); document.body.append(tip);
  let hT = null, actual_ = null;
  const SEL = "button, [role=button], .ib, .bt, a.enlace, [data-tip]";
  function preparar(el) {
    if (el.hasAttribute("title")) {
      const t = el.getAttribute("title"); el.removeAttribute("title");
      if (t) { el.dataset.tip = t; if (!el.getAttribute("aria-label") && !el.textContent.trim()) el.setAttribute("aria-label", t.replace(/\s*\(([^)]{1,18})\)\s*$/, "")); }
    }
    return el.dataset.tip;
  }
  function mostrar(el) {
    const t = preparar(el); if (!t) return;
    const m = t.match(/^([\s\S]*?)\s*\(([^()]{1,18})\)\s*$/);
    const kbd = m && /^(Ctrl|Shift|Alt|Supr|Espacio|Enter|Esc|F\d|[A-Z0-9?+\-−\/←→↑↓ ]{1,9}$)/.test(m[2]) ? m[2] : null;
    tip.innerHTML = `<span>${esc(kbd ? m[1] : t)}</span>${kbd ? kbd.split(/\s*\/\s*/).map((k) => `<kbd>${esc(k)}</kbd>`).join("") : ""}`;
    const r = el.getBoundingClientRect();
    tip.style.left = "0px"; tip.style.top = "0px"; tip.classList.add("ver");
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let top = r.bottom + 6; if (top + h > innerHeight - 4) top = r.top - h - 6;
    tip.style.left = Math.max(4, Math.min(innerWidth - w - 4, r.left + r.width / 2 - w / 2)) + "px"; tip.style.top = top + "px";
    actual_ = el;
  }
  function ocultar() { clearTimeout(hT); tip.classList.remove("ver"); actual_ = null; }
  document.addEventListener("pointerover", (e) => {
    const el = e.target.closest(SEL); if (!el || el === actual_) return;
    if (el.hasAttribute("title") || el.dataset.tip) { preparar(el); ocultar(); hT = setTimeout(() => el.isConnected && mostrar(el), 450); }
  });
  document.addEventListener("pointerout", (e) => { if (actual_ || hT) { const el = e.target.closest(SEL); if (el && !el.contains(e.relatedTarget)) ocultar(); } });
  document.addEventListener("pointerdown", ocultar, true);
  document.addEventListener("focusin", (e) => { const el = e.target.closest(SEL); if (el && el.matches(":focus-visible") && (el.hasAttribute("title") || el.dataset.tip)) mostrar(el); });
  document.addEventListener("focusout", ocultar);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") ocultar(); });
  return { ocultar };
})();

// ================================================================== MODO SIMPLE / AVANZADO (divulgación progresiva)
function modoActual() { try { return sessionStorage.getItem("wdvs-modo") || "simple"; } catch { return "simple"; } }
function ponerModo(m) {
  try { sessionStorage.setItem("wdvs-modo", m); } catch { /* */ }
  document.body.classList.toggle("modo-simple", m === "simple"); document.body.classList.toggle("modo-avanzado", m !== "simple");
  $$("#modo-caja [data-modo]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modo === m)));
  window.dispatchEvent(new CustomEvent("wdvs:modo", { detail: { modo: m } }));
}
WDVS.modo = modoActual; WDVS.ponerModo = ponerModo;
$$("#modo-caja [data-modo]").forEach((b) => b.onclick = () => { ponerModo(b.dataset.modo); toast(b.dataset.modo === "simple" ? "Modo Simple: solo lo esencial." : "Modo Avanzado: fotogramas clave, ripple, rango I/O y todas las opciones.", "info", { ms: 2500 }); });
ponerModo(modoActual());

// ================================================================== deslizadores: relleno del avance (--p)
WDVS.pintarRango = (r) => { const mn = +r.min || 0, mx = +r.max || 100; r.style.setProperty("--p", `${((+r.value - mn) / ((mx - mn) || 1)) * 100}%`); };
document.addEventListener("input", (e) => { if (e.target.type === "range") WDVS.pintarRango(e.target); });

// ================================================================== AYUDA: panel de atajos (?)
const ATAJOS_APP = [["Ctrl+N", "Nuevo proyecto"], ["Ctrl+O", "Abrir proyecto (Inicio)"], ["Ctrl+S", "Guardar versión"], ["Ctrl+E", "Exportar"],
  ["Ctrl+K", "Abrir o cerrar el Asistente IA"], ["Ctrl+,", "Ajustes"], ["?", "Esta ayuda"], ["Esc", "Cerrar paneles y menús"]];
function abrirAyuda() {
  const p = $("#panel-ayuda"); p.hidden = false; hidratarIconos(p);
  const pintar = () => {
    const q = ($("#ayuda-buscar").value || "").toLowerCase();
    const grupos = [["General", ATAJOS_APP], ["Editor", (window.WDED && WDED.ATAJOS) || []]];
    $("#ayuda-lista").innerHTML = grupos.map(([g, ls]) => {
      const f = ls.filter(([k, d]) => !q || (k + " " + d).toLowerCase().includes(q));
      return f.length ? `<h4>${g}</h4>` + f.map(([k, d]) => `<div class="ayuda-fila"><span>${esc(d)}</span><span class="teclas">${k.split(/\s*\/\s*|\s+o\s+/).map((x) => `<kbd>${esc(x)}</kbd>`).join("")}</span></div>`).join("") : "";
    }).join("") || `<p class="tenue">Sin resultados.</p>`;
  };
  $("#ayuda-buscar").oninput = pintar; pintar();
  setTimeout(() => $("#ayuda-buscar").focus(), 30);
}
function cerrarAyuda() { $("#panel-ayuda").hidden = true; }
WDVS.ayuda = () => $("#panel-ayuda").hidden ? abrirAyuda() : cerrarAyuda();
$("#btn-ayuda").onclick = WDVS.ayuda; $("#ayuda-cerrar").onclick = cerrarAyuda;
$("#ayuda-tour").onclick = () => { cerrarAyuda(); Tour.iniciar(true); };

// ================================================================== RECORRIDO de primer uso (4 pasos, saltable)
const Tour = (() => {
  const PASOS = [
    { sel: "#wd-izq", tit: "Tus archivos", txt: "Importa o arrastra aquí tus videos, música y logo. No se copian: se usan donde están. Luego arrástralos a la línea de tiempo." },
    { sel: ".wd-centro", tit: "El visor", txt: "Reproduce con Espacio. Arriba puedes activar el área segura, las guías y el zoom. Arrastra un texto para moverlo." },
    { sel: "#tl", tit: "La línea de tiempo", txt: "Cada fila es una pista: bloquéala, ocúltala o silénciala desde su cabecera. Las herramientas (Seleccionar V, Cortar C, Texto T) están en la barra de arriba." },
    { sel: "#btn-ia", tit: "La IA y tus tareas", txt: "Pídele cambios con tus palabras (Ctrl+K). La vista previa, el render y la exportación trabajan en segundo plano: míralos en el centro de tareas, junto a este botón." },
  ];
  let i = 0;
  const visto = () => { try { return sessionStorage.getItem("wdvs-tour-visto") === "1"; } catch { return true; } };
  function colocar() {
    const p = PASOS[i], el = document.querySelector(p.sel);
    if (!el || !el.getClientRects().length) { if (i < PASOS.length - 1) { i++; return colocar(); } return fin(); }
    const r = el.getBoundingClientRect(), pad = 4;
    Object.assign($("#tour-foco").style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + 2 * pad + "px", height: r.height + 2 * pad + "px" });
    $("#tour-paso").textContent = `Paso ${i + 1} de ${PASOS.length}`; $("#tour-tit").textContent = p.tit; $("#tour-txt").textContent = p.txt;
    $("#tour-atras").hidden = i === 0; $("#tour-sig").textContent = i === PASOS.length - 1 ? "Empezar a editar" : "Siguiente";
    const c = $("#tour-caja"), w = 340, h = c.offsetHeight || 170;
    let left = r.right + 14, top = r.top + 10;
    if (left + w > innerWidth - 10) { left = Math.max(10, Math.min(innerWidth - w - 10, r.left + r.width / 2 - w / 2)); top = r.bottom + 14 > innerHeight - h - 10 ? r.top - h - 14 : r.bottom + 14; }
    if (top < 10) top = Math.min(innerHeight - h - 10, r.top + 40);
    c.style.left = left + "px"; c.style.top = Math.max(10, Math.min(innerHeight - h - 10, top)) + "px";
    $("#tour-sig").focus();
  }
  function iniciar(forzar) {
    if (!forzar && visto()) return;
    if (!document.querySelector("#wded")) return toast("El recorrido se muestra dentro del editor: abre un proyecto.", "info");
    i = 0; $("#tour").hidden = false; colocar();
  }
  function fin() { $("#tour").hidden = true; try { sessionStorage.setItem("wdvs-tour-visto", "1"); } catch { /* */ } }
  $("#tour-sig").onclick = () => { if (i >= PASOS.length - 1) return fin(); i++; colocar(); };
  $("#tour-atras").onclick = () => { if (i > 0) { i--; colocar(); } };
  $("#tour-saltar").onclick = fin;
  $("#tour").addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); fin(); } if (e.key === "ArrowRight") $("#tour-sig").click(); if (e.key === "ArrowLeft") $("#tour-atras").click(); });
  addEventListener("resize", () => { if (!$("#tour").hidden) colocar(); });
  return { iniciar, quizas: () => { if (!visto() && !document.querySelector("dialog[open]")) iniciar(); }, fin };
})();
WDVS.recorrido = Tour;

// ================================================================== arranque
(async () => {
  menuSegunVista();
  const m = location.hash.match(/^#p=([^/]+)/) || location.hash.match(/^#([^=/][^/]*)/);
  if (m) await abrirProyecto(decodeURIComponent(m[1])); else cargarProyectos();
  pintarClaudeChip(); setInterval(pintarClaudeChip, 60000);
  try {   // primer arranque: si falta algo crítico, a Ajustes
    const r = await api("/api/ajustes/primer-arranque");
    $("#claude-punto").className = "punto-estado " + (r.faltan.some((f) => f.id === "claude") ? "falta" : "ok");
    if (r.faltan.length) {
      const cli = r.faltan.some((f) => f.id === "claude");
      abrirAjustes(cli ? "claude" : "deps", `<b>Antes de empezar falta:</b> ${r.faltan.map((f) => esc(f.nombre)).join(", ")}. Instálalo desde aquí con un clic.`);
    }
  } catch { /* */ }
})();
