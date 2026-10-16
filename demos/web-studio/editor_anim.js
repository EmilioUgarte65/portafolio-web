"use strict";
// Web Studio — Editor: escenas animadas (motor /anim/core/motor.js) y rigging dentro del editor.
// - Visor: un <canvas> encima del video dibuja en vivo las escenas activas (reproducción y scrub), con caché de
//   escenas cargadas por JSON, beats del plan, caja del actor seleccionado y arrastre para moverlo.
// - Biblioteca, pestaña «Animar» (WDVS.registrarPanel): presets con miniatura animada, firma animada, personaje
//   con huesos (POST /api/rig/crear), modelo 3D y editor de huesos; sugerencias con los medios personaje / logo.
// - Inspector de una escena (ED.inspEscena): actores, transformar, comportamientos en lenguaje llano, mundo y semilla.
// Ver docs/animacion.md §10 y docs/editor.md.
(() => {
  const ED = window.WDED;
  const { E, V, $, el, esc, pedir, hacer, toast, fmt, r3, clamp, debounce, humano } = ED;
  const WD = () => window.WDVS || {};
  const ico = (n, t = 14) => ED.ico(n, t);

  const A = {
    motor: null, cache: new Map(), rec: new Map(), resueltas: new Map(), cargandoRes: null,
    sel: null,          // {i, actor}: actor elegido dentro de la escena i
    borrador: null,     // {i, escena}: versión en edición (vista previa sin guardar)
    arr: null, raf: 0, stats: { ms: [], cuadros: 0 }, oculto: false,
  };
  const motor = () => (A.motor ||= import("/anim/core/motor.js"));

  // ================================================================== catálogo en lenguaje llano
  const TIPOS = {
    imagen: ["Imagen", "image"], sprite: ["Sprite", "image"], texto: ["Texto", "type"], forma: ["Forma", "diamond"],
    grupo: ["Grupo", "layers"], particulas: ["Partículas", "sparkles"], firma: ["Firma", "pencil"],
    rig2d: ["Personaje con huesos", "bone"], modelo3d: ["Modelo 3D", "rotate-ccw"], globo: ["Globo de diálogo", "message-square"],
    fondo: ["Fondo", "image"], corazones: ["Corazones", "sparkles"], silueta: ["Silueta de personaje", "person-standing"], aparicion: ["Aparición animada", "wand-sparkles"],
  };
  const ANIMS_RIG = [["caminar", "Caminar"], ["correr", "Correr"], ["saltar", "Saltar"], ["saludar", "Saludar"],
    ["bailar", "Bailar al beat"], ["ondear", "Ondear (banderas, logos)"], ["respirar", "Respirar"], ["idle", "Quieto"]];
  // Biblioteca de animaciones de personajes (GET /api/rig/animaciones?rig=<id>, del módulo de rigging): el actor rig2d
  // recibe params.animacion = id. Mientras el servidor no la tenga, se usan las procedurales de rig2d (ANIMS_RIG, params.anim).
  let hayBiblio = null;
  const cacheAnims = new Map();
  function biblioDisponible() { return (hayBiblio ||= fetch("/openapi.json").then((r) => (r.ok ? r.json() : {})).then((d) => !!(d.paths && d.paths["/api/rig/animaciones"])).catch(() => false)); }
  async function animacionesDe(rid) {
    if (!(await biblioDisponible())) return null;
    const k = rid || "";
    if (!cacheAnims.has(k)) cacheAnims.set(k, pedir("/api/rig/animaciones" + (rid ? "?rig=" + encodeURIComponent(rid) : "")).then((r) => { const l = r.ok ? (Array.isArray(r.d) ? r.d : r.d.animaciones) : null; return Array.isArray(l) && l.length ? l : null; }));
    return cacheAnims.get(k);
  }
  const opcionesAnim = (l) => (l ? l.map((a) => [a.id, a.nombre || humano(a.id), (a.etiquetas || []).join(", ")]) : ANIMS_RIG);
  const nombreAnim = (id, l) => ((l || []).find((a) => a.id === id) || {}).nombre || (ANIMS_RIG.find((x) => x[0] === id) || [0, humano(id)])[1];
  const paramsAnim = (id, l) => ((l || []).some((a) => a.id === id) ? { animacion: id } : { anim: [{ nombre: id }] });
  // Editor de huesos/animaciones DENTRO de la app (iframe a pantalla completa, del equipo de rigging). El editor avisa
  // por postMessage {origen: "wdvs-rig", tipo: "rig-guardado" | "animacion-guardada" | "rig-cerrar"}; al cerrar se
  // quita el marco y, si hubo cambios, se recargan los rigs/animaciones del visor. modo: "animar" | "huesos".
  function abrirAnimar(rid, modo = "animar") {
    const q = new URLSearchParams();
    if (rid) q.set("rig", rid);
    if (modo === "animar") q.set("modo", "animar");
    if (E.pid) q.set("proyecto", E.pid);
    document.getElementById("wd-rig-marco")?.remove();
    const capa = el("div", { id: "wd-rig-marco", role: "dialog", "aria-modal": "true", "aria-label": "Editor de huesos y animaciones",
      style: "position:fixed;inset:0;z-index:9000;background:var(--bg-0,#0E0F11)" });
    const fr = el("iframe", { src: `/anim/rig/editor.html?${q}`, title: "Editor de huesos y animaciones", style: "border:0;width:100%;height:100%;display:block" });
    capa.append(fr);
    document.body.append(capa);
    const foco = document.activeElement;
    let cambios = false;
    const alMensaje = (ev) => {
      const d = ev.data;
      if (ev.source !== fr.contentWindow || !d || d.origen !== "wdvs-rig") return;
      if (d.tipo === "rig-guardado" || d.tipo === "animacion-guardada") cambios = true;
      if (d.tipo === "rig-guardado" && d.rig) registrarPersonaje(d.rig).catch(() => null);   // recurso del proyecto
      if (d.tipo !== "rig-cerrar") return;
      window.removeEventListener("message", alMensaje);
      capa.remove();
      if (foco && foco.focus) foco.focus();
      if (cambios) {
        cacheAnims.clear(); A.cache.clear(); A.rec.clear();
        pedirPintar();
        if (ED.refrescarPanel) ED.refrescarPanel();
        WD().toast && WD().toast("Personaje y animaciones actualizados", "ok", { ms: 3000 });
      }
    };
    window.addEventListener("message", alMensaje);
    fr.addEventListener("load", () => { try { fr.contentWindow.focus(); } catch { /* */ } }, { once: true });
  }
  (window.WDVS ||= {}).abrirEditorHuesos = (rig, modo = "huesos") => abrirAnimar(rig, modo);
  // Personajes como RECURSO del proyecto: al crearlos o editarlos en Animar se registran (POST /api/proyectos/{id}/personajes)
  // para que la IA los use por su alias ("rig": "pj:M") sin pedir que se vuelvan a subir; el servidor deja el evento
  // «Agregaste el personaje «M» (con huesos)» en la conversación.
  const GENERICOS = /^(idle|run|walk|jump|throw|death|die|attack|hurt|hit|fall|fly|sprites?|sheet|spritesheet|frames?|image|imagen|img|pose|hammer|shoot|dash|stand|personaje|character|correr|caminar|saltar|downloads?|descargas?|desktop|escritorio|documents|documentos|pictures|imagenes|imágenes|media|assets|tmp|temp|scratchpad|captura.*|screenshot.*|gemini.*|chatgpt.*|dall.?e.*|img[_ -]?\d+|image[_ -]?\d+|\d+)$/i;
  const limpiarNombre = (n) => String(n || "").replace(/[-_ ](?=[0-9a-f]*\d)[0-9a-f]{6}$/, "").replace(/[ _-]*(sprites?|transparentes?|spritesheet|sheet)(?=[ _-]|$)/gi, "").replace(/_+/g, " ").trim();
  function nombreSugerido(ruta) {
    const partes = String(ruta || "").split(/[\\/]/), arch = limpiarNombre((partes.pop() || "").replace(/\.[^.]+$/, ""));
    if (arch && !GENERICOS.test(arch.replace(/\s*\(\d+\)$/, "").trim())) return { nombre: arch, claro: true };
    const carpeta = limpiarNombre(partes.pop() || "");   // «M_sprites_transparentes\idle.png» -> «M»
    if (carpeta && !GENERICOS.test(carpeta) && carpeta.length <= 40) return { nombre: carpeta, claro: false };
    return { nombre: arch || "Personaje", claro: false };
  }
  async function registrarPersonaje(rig, nombre) {
    if (!E.pid || !rig) return null;
    const r = await pedir(`/api/proyectos/${encodeURIComponent(E.pid)}/personajes`, { method: "POST", json: { rig, nombre: nombre || null } });
    return r.ok ? r.d : null;
  }
  function llenarSelect(sel, ops, valor) {
    sel.innerHTML = "";
    for (const [v, t, tit] of ops) sel.append(el("option", { value: v, title: tit || "", selected: v === valor }, t));
    if (valor && !ops.some(([v]) => v === valor)) sel.append(el("option", { value: valor, selected: true }, humano(valor)));
  }
  // [clave, etiqueta, tipo, min, max, paso, defecto, opciones]
  const COMP = {
    fisica: { n: "Física: cae y rebota", d: "Cae con gravedad, rebota en el suelo y choca con los demás.", p: [["rebote", "Rebote", "num", 0, 1, 0.05, 0.4], ["friccion", "Fricción", "num", 0, 1, 0.05, 0.3], ["giro", "Giro al caer", "num", -360, 360, 5, 0, null, "°/s"]], nuevo: { rebote: 0.5 } },
    aparecer: { n: "Aparecer", d: "Entra con un rebote al empezar.", p: [["modo", "Estilo", "sel", 0, 0, 0, "pop", [["pop", "Pop"], ["rebote", "Rebote"], ["elastico", "Elástico"], ["caer", "Caer"], ["deslizar", "Deslizar"]]], ["dur", "Duración", "num", 0.1, 2, 0.05, 0.45, null, "s"]], nuevo: { modo: "rebote" } },
    desaparecer: { n: "Desaparecer", d: "Sale al final (fundido, encoger o pop).", p: [["modo", "Estilo", "sel", 0, 0, 0, "fundido", [["fundido", "Fundido"], ["encoger", "Encoger"], ["pop", "Pop"]]], ["en", "Cuándo", "num", 0, 30, 0.05, 0, null, "s"], ["dur", "Duración", "num", 0.1, 2, 0.05, 0.3, null, "s"]], nuevo: { modo: "fundido" } },
    flotar: { n: "Flotar", d: "Sube y baja suavemente.", p: [["amplitud", "Altura", "num", 0, 120, 1, 12, null, "px"], ["periodo", "Ciclo", "num", 0.3, 8, 0.1, 2.4, null, "s"]], nuevo: { amplitud: 16 } },
    pulso: { n: "Latir con la música", d: "Crece un poco en cada beat.", p: [["escala", "Fuerza", "num", 0, 0.5, 0.01, 0.08], ["cada", "Cada cuántos beats", "num", 0.5, 8, 0.5, 1], ["al_beat", "Al ritmo de la música", "bool", 0, 0, 0, true]], nuevo: { al_beat: true } },
    squash: { n: "Aplastar y estirar", d: "Se aplasta al tocar el suelo o en cada beat.", p: [["fuerza", "Fuerza", "num", 0, 0.8, 0.01, 0.25], ["al_beat", "Al ritmo de la música", "bool", 0, 0, 0, false]], nuevo: {} },
    disparador: { n: "Reaccionar al ritmo", d: "Salta, gira o se sacude con la música.", p: [["accion", "Qué hace", "sel", 0, 0, 0, "saltar", [["saltar", "Saltar"], ["girar", "Girar"], ["pulso", "Latir"], ["sacudir", "Sacudirse"], ["parpadeo", "Parpadear"]]], ["cada", "Cada cuántos beats", "num", 0.5, 8, 0.5, 1], ["al_beat", "Al ritmo de la música", "bool", 0, 0, 0, true]], nuevo: { al_beat: true, accion: "saltar" } },
    wiggle: { n: "Temblor suave", d: "Se mueve un poco al azar, como vivo.", p: [["amplitud", "Intensidad", "num", 0, 80, 1, 10, null, "px"], ["frecuencia", "Rapidez", "num", 0.2, 12, 0.1, 2], ["rot", "Giro", "num", 0, 30, 1, 0, null, "°"]], nuevo: {} },
    oscilar: { n: "Oscilar", d: "Va y viene en una propiedad (como un péndulo).", p: [["prop", "Qué oscila", "sel", 0, 0, 0, "rot", [["rot", "Rotación"], ["x", "Horizontal"], ["y", "Vertical"], ["escala", "Tamaño"]]], ["amplitud", "Amplitud", "num", 0, 200, 1, 10], ["periodo", "Ciclo", "num", 0.2, 8, 0.1, 2, null, "s"]], nuevo: { prop: "rot", amplitud: 10, periodo: 2 } },
    orbita: { n: "Girar alrededor", d: "Da vueltas alrededor de un punto u otro actor.", p: [["radio", "Radio", "num", 10, 900, 5, 200, null, "px"], ["periodo", "Vuelta cada", "num", 0.3, 12, 0.1, 3, null, "s"], ["objetivo", "Alrededor de", "actor"]], nuevo: { radio: 200 } },
    seguir: { n: "Seguir a otro", d: "Va detrás de otro actor.", p: [["objetivo", "A quién", "actor"], ["retardo", "Retraso", "num", 0, 2, 0.05, 0.25, null, "s"]], nuevo: { retardo: 0.25 } },
    mirar: { n: "Mirar a otro", d: "Gira para apuntar hacia otro actor.", p: [["objetivo", "A quién", "actor"]], nuevo: {} },
    resorte: { n: "Resorte", d: "Los cambios de posición llegan con rebote.", p: [["rigidez", "Rigidez", "num", 20, 500, 5, 170], ["amortiguacion", "Amortiguación", "num", 1, 40, 1, 12]], nuevo: {} },
    llegar: { n: "Llegar a su lugar", d: "Al final se acomoda en un destino.", p: [["en", "Cuándo", "num", 0, 30, 0.05, 1, null, "s"], ["dur", "Duración", "num", 0.1, 3, 0.05, 0.8, null, "s"], ["rot", "Rotación final", "num", -180, 180, 1, 0, null, "°"]], nuevo: { rot: 0 } },
    parpadeo: { n: "Parpadear", d: "Titila.", p: [["frecuencia", "Rapidez", "num", 0.5, 30, 0.5, 8]], nuevo: {} },
    ruta: { n: "Seguir un camino", d: "Recorre una curva (se edita en el JSON).", p: [["dur", "Duración", "num", 0.2, 20, 0.1, 3, null, "s"], ["orientar", "Mirar hacia donde va", "bool", 0, 0, 0, false]], nuevo: { puntos: [[0, 0], [300, -150], [600, 0]], relativo: true, dur: 3 } },
  };
  const nombreActor = (a) => a.nombre || humano(String(a.id || a.tipo || "actor"));

  // ================================================================== escenas del plan
  const plantilla = () => ({ formato: "web-studio/escena@1", ancho: V().W, alto: V().H, semilla: 1 + Math.floor(Math.random() * 9999), recursos: {}, actores: [] });
  function crudo(i) { const o = (E.plan.overlays || [])[i]; return o && o.escena; }
  // JSON de la escena i: borrador en edición, objeto del plan o (si es una ruta .escena.json) la versión que resolvió el servidor
  function jsonDe(i) {
    if (A.borrador && A.borrador.i === i) return A.borrador.escena;
    const x = crudo(i);
    if (typeof x === "string") { if (!A.resueltas.has(x)) resolver(); return A.resueltas.get(x) || null; }
    return x || null;
  }
  function resolver() {
    if (A.cargandoRes) return;
    A.cargandoRes = pedir(`${ED.pidURL()}/editor/overlays_todos`).then((r) => {
      A.cargandoRes = null;
      if (!r.ok) return;
      for (const o of r.d.overlays) { const x = crudo(o.i); if (o.tipo === "escena" && typeof x === "string" && o.escena) A.resueltas.set(x, o.escena); }
      pedirPintar();
    });
  }
  function escenas() {
    const out = []; if (!E.plan) return out;
    const vo = V().overlays;
    (E.plan.overlays || []).forEach((o, i) => {
      if (!o || !("escena" in o) || !vo[i]) return;
      out.push({ i, json: jsonDe(i), t_in: vo[i].t_in, t_out: vo[i].t_out, pista: vo[i].pista || 1 });
    });
    return out;
  }
  // como el motor: sin ritmo propio, la escena recibe la rejilla de beats del plan en segundos de la escena
  function conRitmo(j, a, b) {
    if (!j || j.ritmo) return j;
    const bs = V().beats.map((x) => x[0]).filter((t) => t >= a - 2 && t <= b + 2).map((t) => r3(t - a));
    return bs.length ? { ...j, ritmo: { beats: bs } } : j;
  }
  // caché de escenas cargadas (clave = JSON); los recursos (imágenes, rigs) se comparten entre versiones
  function cargada(j) {
    const k = JSON.stringify(j);
    let c = A.cache.get(k);
    if (c) { A.cache.delete(k); A.cache.set(k, c); return c; }
    c = { esc: null, err: null };
    c.p = motor().then((m) => m.cargarEscena(JSON.parse(k), { cache: A.rec })).then((e) => { c.esc = e; if (e.errores.length) console.warn("[anim]", e.errores.join("; ")); pedirPintar(); },
      (e) => { c.err = String(e && e.message || e); console.warn("[anim] no se pudo cargar la escena:", c.err); pedirPintar(); });
    A.cache.set(k, c);
    while (A.cache.size > 14) A.cache.delete(A.cache.keys().next().value);
    return c;
  }
  const escDe = (s) => (s.json ? cargada(conRitmo(s.json, s.t_in, s.t_out)) : null);

  // ================================================================== lienzo del visor
  function lienzo() {
    const vis = $("#visor"); if (!vis || !E.plan) return null;
    let cv = $("#visor-escenas");
    if (!cv) { cv = el("canvas", { id: "visor-escenas", class: "visor-escenas", "aria-hidden": "true" }); vis.append(cv); }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.round(vis.clientWidth * dpr), h = Math.round(vis.clientHeight * dpr);
    if (w > V().W) { h = Math.round(h * V().W / w); w = V().W; }
    if (w > 0 && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
    return cv;
  }
  function pintar(t = E.t) {
    if (!E.plan || !E.abierto) return;
    const lista = escenas();
    const cv = lista.length ? lienzo() : $("#visor-escenas");
    if (!cv) return;
    const ctx = cv.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    if (A.sel && !(E.sel && E.sel.tipo === "overlays" && E.sel.i === A.sel.i && ED.esEscena(A.sel.i))) A.sel = null;
    if (!lista.length || A.oculto || E.video) { cv.hidden = true; return; }
    cv.hidden = false;
    const t0 = performance.now();
    const act = lista.filter((s) => t >= s.t_in - 1e-6 && t < s.t_out && !E.oculto["capa" + s.pista]).sort((a, b) => a.pista - b.pista || a.i - b.i);
    for (const s of act) {
      const c = escDe(s); if (!c || !c.esc) continue;
      try { c.esc.dibujar(ctx, t - s.t_in, { limpiar: false }); } catch (e) { console.warn("[anim]", e); }
    }
    for (const s of lista) if (s.t_in > t && s.t_in - t < 3) escDe(s);     // precarga las que vienen
    if (!E.reproduciendo) cajas(ctx, act, t);
    if (act.length) { const ms = performance.now() - t0; const st = A.stats; st.ms.push(ms); if (st.ms.length > 300) st.ms.shift(); st.cuadros++; }
  }
  function cajas(ctx, act, t) {
    if (!E.sel || E.sel.tipo !== "overlays") return;
    const s = act.find((x) => x.i === E.sel.i); if (!s) return;
    const c = escDe(s); if (!c || !c.esc) return;
    const k = ctx.canvas.width / c.esc.W, tl = t - s.t_in;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const e of c.esc.estado(tl)) {
      if (!e.visible || e.tipo === "grupo") continue;
      const [x0, y0, x1, y1] = e.caja, elegido = A.sel && A.sel.actor === e.id;
      ctx.lineWidth = elegido ? 2 : 1;
      ctx.setLineDash(elegido ? [7, 4] : [3, 4]);
      ctx.strokeStyle = elegido ? "#F5B82E" : "rgba(255,255,255,.35)";
      ctx.strokeRect(x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k);
      if (elegido) {
        const act0 = (c.esc.json.actores || []).find((a) => (a.id ?? "") === e.id) || {};
        const txt = nombreActor({ ...act0, id: e.id });
        ctx.setLineDash([]); ctx.font = "600 11px 'Inter var', 'Segoe UI', sans-serif";
        const w = ctx.measureText(txt).width + 10;
        ctx.fillStyle = "#F5B82E"; ctx.fillRect(x0 * k, Math.max(0, y0 * k - 17), w, 16);
        ctx.fillStyle = "#17130A"; ctx.fillText(txt, x0 * k + 5, Math.max(0, y0 * k - 17) + 12);
      }
    }
    ctx.restore();
  }
  function pedirPintar() { if (E.reproduciendo) return; cancelAnimationFrame(A.raf); A.raf = requestAnimationFrame(() => pintar(E.t)); }

  // ================================================================== visor: elegir y mover actores
  function aEscena(e, s, c) {
    const r = $("#visor").getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * c.esc.W, (e.clientY - r.top) / r.height * c.esc.H];
  }
  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !E.abierto || !E.plan || E.reproduciendo || E.video) return;
    const vis = e.target.closest && e.target.closest("#visor"); if (!vis || e.target.closest(".ov")) return;
    const act = escenas().filter((s) => E.t >= s.t_in - 1e-6 && E.t < s.t_out && !E.oculto["capa" + s.pista]).sort((a, b) => b.pista - a.pista || b.i - a.i);
    for (const s of act) {
      const c = escDe(s); if (!c || !c.esc) continue;
      const [x, y] = aEscena(e, s, c);
      const id = c.esc.tocar(x, y, E.t - s.t_in);
      if (!id) continue;
      e.preventDefault();
      A.sel = { i: s.i, actor: id };
      if (!(E.sel && E.sel.tipo === "overlays" && E.sel.i === s.i && E.multi.length === 1)) ED.seleccionar({ tipo: "overlays", i: s.i }, "solo");
      else { ED.renderInspector(); pedirPintar(); }
      A.arr = { s, c, id, x0: x, y0: y, base: JSON.parse(JSON.stringify(s.json)), movido: false, ult: 0 };
      return;
    }
  });
  document.addEventListener("pointermove", (e) => {
    const a = A.arr; if (!a) return;
    const [x, y] = aEscena(e, a.s, a.c);
    const dx = Math.round(x - a.x0), dy = Math.round(y - a.y0);
    if (!a.movido && Math.abs(dx) + Math.abs(dy) < 3) return;
    a.movido = true; a.dx = dx; a.dy = dy;
    if (performance.now() - a.ult < 50) return;     // la vista previa recarga la escena (física incluida): ~20 por segundo
    a.ult = performance.now();
    A.borrador = { i: a.s.i, escena: mover(a.base, a.id, dx, dy) };
    pintar(E.t);
  });
  document.addEventListener("pointerup", () => {
    const a = A.arr; A.arr = null; if (!a || !a.movido) return;
    const nueva = mover(a.base, a.id, a.dx, a.dy);
    A.borrador = { i: a.s.i, escena: nueva };
    guardarEscena(a.s.i, nueva, "mover");
  });
  function mover(j, id, dx, dy) {
    const n = JSON.parse(JSON.stringify(j));
    const act = (n.actores || []).find((x, k) => (x.id ?? `a${k}`) === id); if (!act) return n;
    act.x = Math.round((act.x || 0) + dx); act.y = Math.round((act.y || 0) + dy);
    for (const k of act.keyframes || []) { if (typeof k.x === "number") k.x = Math.round(k.x + dx); if (typeof k.y === "number") k.y = Math.round(k.y + dy); }
    return n;
  }
  function guardarEscena(i, escena, desc, opc = {}) {
    A.borrador = { i, escena };
    pedirPintar();
    return hacer({ op: "lista_props", lista: "overlays", i, props: { escena } }, { reInsp: !!opc.reInsp, mantenerSel: true }).then((ok) => {
      if (A.borrador && A.borrador.escena === escena) A.borrador = null;
      if (ok && opc.reInsp === undefined) ED.renderInspector();
      pedirPintar();
      return ok;
    });
  }

  // ================================================================== insertar escenas
  function pistaLibre(a, b) {
    const sol = V().overlays.filter((o) => o.t_in < b && o.t_out > a).map((o) => o.pista || 1);
    return Math.max(2, ...sol.map((p) => p + 1));
  }
  async function insertar(escena, dur, desc) {
    if (!E.plan) { toast("Primero abre un video en el editor."); return false; }
    const tot = V().total;
    dur = Math.min(dur || escena.duracion || 4, Math.max(0.5, tot));
    const a = r3(clamp(E.t, 0, Math.max(0, tot - dur))), b = r3(a + dur);
    const ok = await hacer({ op: "lista_nuevo", lista: "overlays", item: { escena, t_in: a, t_out: b, pista: pistaLibre(a, b) } });
    if (ok) {
      const i = E.plan.overlays.length - 1;
      A.sel = { i, actor: ((escena.actores || [])[0] || {}).id || null };
      ED.seleccionar({ tipo: "overlays", i }, "solo");
      if (E.t < a || E.t >= b) ED.ponerT(a + Math.min(1, dur / 2));
      WD().toast && WD().toast(`${desc || "Animación"} agregada en ${fmt(a)}. Elige un actor en el visor para moverlo.`, "ok", { ms: 3500 });
    }
    return ok;
  }
  function rutaLogo() {
    const m = (E.medios || []).find((x) => x.rol === "logo" && /\.(png|webp|jpe?g|svg)$/i.test(x.ruta || ""));
    if (m) return m.ruta.replace(/\\/g, "/");
    const f = E.fuentes && (E.fuentes.logo || Object.values(E.fuentes).find((x) => x.tipo === "imagen"));
    return f && f.ruta ? f.ruta.replace(/\\/g, "/") : null;
  }
  async function escenaPreset(id, extra = {}) {
    const params = { ancho: V().W, alto: V().H, ...extra };
    if (id === "logo_cae" && !params.logo) { const l = rutaLogo(); if (l) params.logo = l; }
    const r = await pedir("/api/anim/preset", { method: "POST", json: { preset: id, params } });
    if (!r.ok) throw new Error(r.d.detail || "no se pudo crear la animación");
    return r.d.escena;
  }
  async function insertarPreset(id, extra = {}) {
    try {
      const p = (A.presets || []).find((x) => x.id === id);
      const escena = await escenaPreset(id, { dur: 4, ...extra });
      escena.nombre = (p && p.nombre) || humano(id);
      return insertar(escena, escena.duracion || 4, escena.nombre);
    } catch (e) { toast(String(e.message || e)); return false; }
  }
  const archivoUrl = (ruta) => "/api/anim/recurso?ruta=" + encodeURIComponent(ruta);
  async function firmaDe(fd, desc) {
    const T = WD().tareas, id = "firma:" + Date.now();
    if (T) T.poner(id, { titulo: "Firma animada", tipo: "anim", texto: "Siguiendo el trazo de la pluma…", frac: null });
    try {
      const r = await fetch("/api/anim/firma", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "no se pudo leer la firma");
      const escena = await escenaPreset("firma_animada", { dur: 4, ...d.actor.params.trazos ? { trazos: d.actor.params.trazos } : { svg: d.actor.params.svg } });
      escena.nombre = desc;
      if (T) T.terminar(id, true, { titulo: "Firma animada", texto: "Firma lista.", silenciosa: true });
      return insertar(escena, 4, desc);
    } catch (e) { if (T) T.terminar(id, false, { titulo: "Firma animada", texto: String(e.message || e) }); else toast(String(e.message || e)); return false; }
  }
  function firmaTexto(txt) {
    txt = String(txt || "").trim(); if (!txt) { toast("Escribe el nombre para la firma.", "info"); return false; }
    const fd = new FormData(); fd.append("texto", txt); fd.append("ancho", String(Math.round(V().W * 0.47)));
    return firmaDe(fd, `Firma de ${txt}`);
  }
  async function firmaImagen(ruta) {
    if (!ruta) { const r = await WD().elegirNativo({ filtro: "todo", multiple: false, titulo: "Elige la foto o el SVG de la firma" }); if (!r || !r.length) return false; ruta = r[0]; }
    const b = await fetch(archivoUrl(ruta)); if (!b.ok) { toast("No se pudo leer ese archivo (usa PNG, JPG o SVG)."); return false; }
    const fd = new FormData(); fd.append("archivo", await b.blob(), ruta.split(/[\\/]/).pop()); fd.append("ancho", String(Math.round(V().W * 0.47)));
    return firmaDe(fd, "Firma animada");
  }
  // Personaje con huesos: imagen → rig (IA local) → actor rig2d con su animación
  async function crearPersonaje(ruta, anim = "caminar", op = {}) {
    if (!ruta) { const r = await WD().elegirNativo({ filtro: "imagenes", multiple: false, titulo: "Elige la imagen del personaje (PNG con fondo transparente es lo mejor)" }); if (!r || !r.length) return false; ruta = r[0]; }
    // nombre del personaje: el del archivo; si no es claro («idle.png», «Gemini_Generated_Image…») se pregunta
    const sug = nombreSugerido(ruta);
    let nombre = op.nombre || sug.nombre;
    if (!sug.claro && !op.nombre && anim !== "ondear") {
      const n = prompt("¿Cómo se llama este personaje? (con ese nombre se lo puedes pedir a la IA)", sug.nombre);
      if (n === null) return false;
      nombre = n.trim() || sug.nombre;
    }
    const T = WD().tareas, id = "rig:" + Date.now();
    if (T) T.poner(id, { titulo: `Personaje con huesos: ${nombre}`, tipo: "anim", texto: "Detectando la figura y sus articulaciones…", frac: null });
    try {
      const fd = new FormData();
      fd.append("ruta", ruta); fd.append("nombre", nombre);
      fd.append("tipo", anim === "ondear" ? "objeto" : "auto");
      // una hoja de sprites se parte por columnas vacías y se usa el primer cuadro (con una sola figura no cambia nada);
      // los logos y objetos («ondear») van completos: sus letras separadas no son cuadros
      if (op.cuadro !== undefined && op.cuadro !== null) fd.append("cuadro", String(op.cuadro));
      else if (anim !== "ondear") fd.append("cuadro", "0");
      const r = await fetch("/api/rig/crear", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "no se pudo crear el personaje");
      if (T) T.poner(id, { titulo: `Personaje con huesos: ${nombre}`, tipo: "anim", texto: `${d.huesos} huesos listos; preparando la animación…`, frac: 0.9 });
      const rj = await pedir(`/api/rig/${encodeURIComponent(d.id)}`);
      const rig = rj.ok ? rj.d : {};
      const lista = await animacionesDe(d.id);
      d.nombre = nombre;
      if (anim !== "ondear") registrarPersonaje(d.id, nombre).catch(() => null);   // recurso del proyecto + evento en el chat
      const escena = escenaPersonaje(d, rig, anim, op.dur || 5, lista);
      if (T) T.terminar(id, true, { titulo: `Personaje con huesos: ${nombre}`, texto: `«${nombre}» ya tiene ${d.huesos} huesos (${rig.tipo === "humanoide" ? "personaje" : "objeto"})${rig.fuente && rig.fuente.cuadros > 1 ? `; era una hoja de ${rig.fuente.cuadros} cuadros y se usó el primero` : ""}.`, accion: { etiqueta: "Editar huesos", fn: () => ED.abrirEditorHuesos(d.id) } });
      return insertar(escena, op.dur || 5, `${nombre}: ${nombreAnim(anim, lista).toLowerCase()}`);
    } catch (e) {
      if (T) T.terminar(id, false, { titulo: `Personaje con huesos: ${nombre}`, texto: String(e.message || e) }); else toast(String(e.message || e));
      return false;
    }
  }
  function escenaPersonaje(d, rig, anim, dur, lista) {
    const W = V().W, H = V().H, es = plantilla();
    const humano_ = rig.tipo === "humanoide" || rig.tipo === "cuadrupedo";
    const alto = Math.round(H * (humano_ ? 0.46 : 0.34));
    const piv = humano_ && Array.isArray(rig.ancla) && rig.ancho ? [r3(rig.ancla[0] / rig.ancho), r3(rig.ancla[1] / rig.alto)] : [0.5, 0.5];
    const act = { id: "personaje", nombre: d.nombre || rig.nombre || "Personaje", tipo: "rig2d", x: Math.round(W / 2), y: Math.round(humano_ ? H * 0.9 : H / 2), pivote: piv,
      params: { rig: d.ruta, alto, ...paramsAnim(anim, lista) } };
    if (anim === "caminar" || anim === "correr") {
      act.x = Math.round(W * 0.18);
      act.keyframes = [{ t: 0, x: Math.round(W * 0.18), ease: "lineal" }, { t: dur, x: Math.round(W * (anim === "correr" ? 0.9 : 0.72)) }];
    }
    act.comportamientos = [{ tipo: "aparecer", modo: "pop", dur: 0.35 }];
    es.actores.push(act);
    es.nombre = act.nombre;
    es.duracion = dur;
    return es;
  }
  async function modelo3d(ruta) {
    if (!ruta) { const r = await WD().elegirNativo({ filtro: "todo", multiple: false, titulo: "Elige un modelo 3D (.glb o .gltf)" }); if (!r || !r.length) return false; ruta = r[0]; }
    if (!/\.(glb|gltf)$/i.test(ruta)) { toast("Elige un archivo .glb o .gltf."); return false; }
    const W = V().W, H = V().H, es = plantilla(), nom = ruta.split(/[\\/]/).pop().replace(/\.[^.]+$/, "");
    es.nombre = nom; es.duracion = 5;
    es.actores.push({ id: "modelo", nombre: nom, tipo: "modelo3d", x: Math.round(W / 2), y: Math.round(H / 2),
      params: { src: ruta.replace(/\\/g, "/"), ancho: Math.round(W * 0.45), alto: Math.round(H * 0.7), clip: 0, rotar: 20, sombra: true },
      comportamientos: [{ tipo: "aparecer", modo: "pop", dur: 0.4 }] });
    return insertar(es, 5, `Modelo 3D: ${nom}`);
  }

  // ================================================================== panel «Animar»
  function tituloSec(icono, t, sub) { return el("div", { class: "anim-sec" }, el("span", { html: ico(icono, 15) }), el("div", {}, el("b", {}, t), sub ? el("span", {}, sub) : null)); }
  let miniLoop = 0;
  function montarPanel(cont) {
    cont.innerHTML = "";
    cont.classList.add("anim-panel");
    // Animar › Firmas y apariciones · Personajes · Presets de escena · Partículas · 3D (acordeón, una abierta a la vez)
    const secs = [
      { id: "firmas", titulo: "Firmas y apariciones", icono: "pencil", ayuda: "Firma trazo a trazo y apariciones animadas de tu logo o imágenes", montar: secFirmas },
      { id: "personajes", titulo: "Personajes", icono: "bone", ayuda: "Tus personajes y logos con huesos y movimiento", montar: secPersonajes },
      { id: "escenas", titulo: "Presets de escena", icono: "clapperboard", ayuda: "Escenas completas: diálogos, romántica, celebración…", montar: secEscenas },
      { id: "particulas", titulo: "Partículas", icono: "sparkles", ayuda: "Confeti, monedas y ráfagas al ritmo", montar: (cu) => galeria(cu, "particulas") },
      { id: "3d", titulo: "3D", icono: "box", ayuda: "Modelos .glb o .gltf con sus animaciones", montar: sec3d },
    ];
    if (ED.bib && ED.bib.acordeon) ED.bib.acordeon(cont, secs, { clave: "animar" });
    else for (const s of secs) { cont.append(tituloSec(s.icono, s.titulo, s.ayuda)); const d = el("div"); cont.append(d); s.montar(d); }
    animarMinis(cont);
  }
  // galería de presets de un clic de una categoría (miniatura animada)
  function galeria(cu, cat) {
    const gal = el("div", { class: "anim-gal" });
    cu.append(gal);
    for (let k = 0; k < 2; k++) gal.append(el("div", { class: "anim-card skel" }));
    cargarPresets().then((ps) => {
      gal.innerHTML = "";
      const ls = ps.filter((p) => (ED.catAnimar ? ED.catAnimar(p.id) : "escenas") === cat);
      if (!ls.length) gal.replaceWith(el("div", { class: "acord-vacio" }, "Sin animaciones de un clic en esta categoría."));
      for (const p of ls) {
        const cv = el("canvas", { width: 176, height: 99, "aria-hidden": "true" });
        gal.append(el("button", { class: "anim-card", title: `${p.nombre}: ${p.descripcion}\nClic para agregarla en el cabezal`, "data-preset": p.id, onclick: () => insertarPreset(p.id) },
          el("div", { class: "mini" }, cv), el("span", { class: "nom" }, p.nombre)));
        escenaPreset(p.id, { dur: p.id === "logo_cae" ? 4 : 5 }).then((j) => { cv._c = cargada(j); cv._dur = j.duracion || 4; }).catch(() => { /* sin miniatura */ });
      }
    });
  }
  // escena + sonidos (blips, SFX) del compositor: la escena en su capa y los sonidos como sfx con archivo en su tiempo
  async function insertarConSonidos(d, desc) {
    const tot = V().total, dur = Math.min(d.escena.duracion || 4, Math.max(0.5, tot));
    const a = r3(clamp(E.t, 0, Math.max(0, tot - dur)));
    d.escena.nombre = d.escena.nombre || desc;
    const ok = await insertar(d.escena, dur, desc);
    const sn = (d.sonidos || []).filter((s) => s && s.archivo);
    if (ok && sn.length) await hacer({ op: "lista_pegar", lista: "sfx", items: sn.map((s) => ({ archivo: s.archivo, t: r3(s.t || 0), volumen: s.volumen ?? 0.8 })), dt: a }, { mantenerSel: true });
    return ok;
  }
  function secFirmas(cu) {
    // descríbelo con tus palabras: la app interpreta el texto y llena los controles (POST /api/anim/interpretar)
    const modo = { v: "firma" };
    const seg = el("div", { class: "segmentado", role: "group", "aria-label": "Qué crear" });
    const cuerpo = el("div", { class: "anim-form" });
    const pintar = () => {
      seg.innerHTML = "";
      for (const [k, t] of [["firma", "Firma"], ["aparicion", "Aparición de imagen"]]) seg.append(el("button", { "aria-pressed": String(modo.v === k), onclick: () => { modo.v = k; pintar(); } }, t));
      cuerpo.innerHTML = "";
      (modo.v === "firma" ? formFirma : formAparicion)(cuerpo);
    };
    cu.append(seg, cuerpo);
    pintar();
    cu.append(el("div", { class: "bib-cat" }, "De un clic"));
    galeria(cu, "firmas");
  }
  function campoDescribe(tipo, alEntender) {
    const ta = el("textarea", { rows: 2, placeholder: tipo === "firma" ? "Descríbelo con tus palabras: «elegante, dorada y rápida»" : "Descríbelo con tus palabras: «que se dibuje como en pizarrón»", "aria-label": "Descríbelo con tus palabras" });
    const ent = el("div", { class: "anim-entendido muy-tenue", "aria-live": "polite" });
    ta.addEventListener("input", ED.debounce(async () => {
      const txt = ta.value.trim(); if (!txt) { ent.textContent = ""; return; }
      const r = await pedir("/api/anim/interpretar", { method: "POST", json: { tipo, texto: txt } });
      if (!r.ok) return;
      const op = r.d.opciones || {};
      const txtOp = Object.entries(op).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => `${humano(k)}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
      ent.textContent = txtOp ? "Entendí: " + txtOp : "";
      alEntender(op);
    }, 500));
    return { ta, ent };
  }
  function formFirma(c) {
    const nom = el("input", { type: "text", placeholder: "Nombre para la firma", "aria-label": "Nombre para la firma", maxlength: 40 });
    const { ta, ent } = campoDescribe("firma", () => {});
    const firmar = async () => {
      const txt = nom.value.trim(); if (!txt) return toast("Escribe el nombre para la firma.", "info");
      const T = WD().tareas, id = "firma:" + Date.now();
      if (T) T.poner(id, { titulo: "Firma animada", tipo: "anim", texto: "Creando la firma…", frac: null });
      const r = await pedir("/api/anim/firma_descrita", { method: "POST", json: { texto: txt, descripcion: ta.value.trim() || undefined, ancho: V().W, alto: V().H } });
      if (!r.ok) { if (T) T.terminar(id, false, { texto: r.d.detail || "No se pudo crear la firma" }); else toast(r.d.detail || "No se pudo crear la firma"); return; }
      if (T) T.terminar(id, true, { texto: "Firma lista.", silenciosa: true });
      insertarConSonidos(r.d, `Firma de ${txt}`);
    };
    nom.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); firmar(); } });
    c.append(nom, ta, ent, el("div", { class: "anim-acc" }, el("button", { class: "btn primario", onclick: firmar }, "Firmar"),
      el("button", { class: "btn fantasma", html: `${ico("image")} Desde una foto o SVG…`, onclick: () => firmaImagen() })));
  }
  let estilosAp = null;
  function formAparicion(c) {
    const imgs = (E.medios || []).filter((m) => /\.(png|webp|jpe?g|svg)$/i.test(m.ruta || ""));
    const selImg = el("select", { "aria-label": "Imagen" }, ...imgs.map((m) => el("option", { value: m.ruta, selected: m.rol === "logo" }, `${m.rol === "logo" ? "Logo · " : ""}${(m.nombre || m.ruta.split(/[\\/]/).pop())}`)));
    const selEst = el("select", { "aria-label": "Estilo de aparición" }, el("option", { value: "" }, "Automático (según la descripción)"));
    (estilosAp ? Promise.resolve(estilosAp) : pedir("/api/anim/apariciones").then((r) => (estilosAp = r.ok ? r.d.estilos || [] : [])))
      .then((ls) => { for (const s of ls) selEst.append(el("option", { value: s.id, title: s.descripcion }, s.nombre)); });
    const { ta, ent } = campoDescribe("aparicion", (op) => { if (op.estilo && [...selEst.options].some((o) => o.value === op.estilo)) selEst.value = op.estilo; });
    const aparecer = async () => {
      if (!selImg.value) return toast("Importa una imagen o tu logo en Medios primero.", "info");
      const T = WD().tareas, id = "aparicion:" + Date.now();
      if (T) T.poner(id, { titulo: "Aparición animada", tipo: "anim", texto: "Creando la animación…", frac: null });
      const r = await pedir("/api/anim/aparicion", { method: "POST", json: { imagen: selImg.value, estilo: selEst.value || undefined, descripcion: ta.value.trim() || undefined, ancho: V().W, alto: V().H } });
      if (!r.ok) { if (T) T.terminar(id, false, { texto: r.d.detail || "No se pudo crear la aparición" }); else toast(r.d.detail || "No se pudo crear la aparición"); return; }
      if (T) T.terminar(id, true, { texto: "Aparición lista.", silenciosa: true });
      insertarConSonidos(r.d, "Aparición");
    };
    if (!imgs.length) { c.append(el("div", { class: "acord-vacio" }, "Importa tu logo o una imagen en Medios para animar su aparición.")); return; }
    c.append(el("div", { class: "anim-fila" }, el("label", {}, "Imagen"), selImg), el("div", { class: "anim-fila" }, el("label", {}, "Estilo"), selEst), ta, ent,
      el("div", { class: "anim-acc" }, el("button", { class: "btn primario", onclick: aparecer }, "Aparecer")));
  }
  function secPersonajes(cu) {
    const selAnim = el("select", { "aria-label": "Movimiento del personaje" });
    llenarSelect(selAnim, ANIMS_RIG.slice(0, 7), "caminar");
    animacionesDe(null).then((l) => { if (l) llenarSelect(selAnim, opcionesAnim(l), selAnim.value); });
    const sug = (E.medios || []).filter((m) => (m.rol === "personaje" || m.rol === "logo") && /\.(png|webp|jpe?g)$/i.test(m.ruta || ""));
    cu.append(el("div", { class: "anim-fila" }, el("label", {}, "Movimiento"), selAnim),
      el("div", { class: "anim-acc" }, el("button", { class: "btn primario", html: `${ico("person-standing")} Elegir imagen…`, title: "Elige un dibujo o sprite: la IA le pone huesos y lo anima", onclick: () => crearPersonaje(null, selAnim.value) }),
        el("button", { class: "btn fantasma", html: `${ico("bone")} Editor de huesos`, title: "Ajusta huesos y pesos a mano (a pantalla completa, con Volver)", onclick: () => ED.abrirEditorHuesos(null, "huesos") }),
        el("button", { class: "btn fantasma", html: `${ico("plus")} Crear animación…`, title: "Anima un personaje a mano en el editor de huesos", onclick: () => abrirAnimar(null, "animar") })));
    // biblioteca de movimientos con su vista previa (GET /api/rig/animaciones?proyecto=): elegir uno fija el movimiento
    const galA = el("div", {});
    cu.append(el("div", { class: "bib-cat" }, "Movimientos"), galA);
    pedir("/api/rig/animaciones" + (E.pid ? "?proyecto=" + encodeURIComponent(E.pid) : "")).then((r) => {
      const l = r.ok ? (Array.isArray(r.d) ? r.d : r.d.animaciones) : null;
      if (!Array.isArray(l) || !l.length) { galA.append(el("div", { class: "acord-vacio" }, "Usa los movimientos de la lista de arriba.")); return; }
      const items = l.map((a) => ({ id: "rig:" + a.id, nombre: a.nombre || humano(a.id), desc: [a.descripcion, (a.etiquetas || []).join(", "), a.duracion ? a.duracion.toFixed(1) + " s" : ""].filter(Boolean).join(" · "),
        mini: a.preview_url || a.miniatura_url ? `<img src="${ED.esc(a.preview_url || a.miniatura_url)}" loading="lazy" alt="">` : ico("person-standing", 20),
        pista: "Doble clic: usar este movimiento", accion: () => { if (![...selAnim.options].some((o) => o.value === a.id)) selAnim.append(el("option", { value: a.id }, a.nombre || a.id)); selAnim.value = a.id; toast(`Movimiento: ${a.nombre || a.id}. Elige la imagen del personaje.`, "info", 2200); } }));
      if (ED.bib) ED.bib.rejilla(galA, items, "animar:movimientos");
    });
    if (sug.length) {
      const lista = el("div", { class: "anim-sug" });
      for (const m of sug.slice(0, 6)) {
        const nom = (m.ruta || "").split(/[\\/]/).pop();
        const acciones = m.rol === "logo"
          ? [el("button", { class: "btn chico", onclick: () => insertarPreset("logo_cae", { logo: m.ruta.replace(/\\/g, "/") }) }, "Logo que cae"), el("button", { class: "btn chico", onclick: () => crearPersonaje(m.ruta, "ondear") }, "Ondear")]
          : [el("button", { class: "btn chico primario", onclick: () => crearPersonaje(m.ruta, selAnim.value) }, "Animar")];
        lista.append(el("div", { class: "anim-sug-item" }, el("img", { src: archivoUrl(m.ruta), alt: "", loading: "lazy" }),
          el("div", { class: "txt" }, el("b", { title: nom }, nom), el("span", {}, m.rol === "logo" ? "Logo" : "Personaje"), el("div", { class: "acc" }, ...acciones))));
      }
      cu.append(el("div", { class: "bib-cat" }, "Con tus archivos"), lista);
    }
    galeria(cu, "personajes");
  }
  function secEscenas(cu) {
    galeria(cu, "escenas");
    const caja = el("div", { class: "anim-comp" });
    cu.append(el("div", { class: "bib-cat" }, "Escenas compuestas (con globos y sonidos)"), caja);
    pedir("/api/anim/escenas").then((r) => {
      for (const p of (r.ok ? r.d.presets : []) || []) caja.append(el("button", { class: "anim-comp-item", title: p.descripcion, onclick: async () => {
        const T = WD().tareas, id = "componer:" + Date.now();
        if (T) T.poner(id, { titulo: p.nombre, tipo: "anim", texto: "Componiendo la escena…", frac: null });
        const q = await pedir("/api/anim/componer", { method: "POST", json: { guion: { preset: p.id }, ancho: V().W, alto: V().H, dur: 8 } });
        if (!q.ok) { if (T) T.terminar(id, false, { texto: q.d.detail || "No se pudo componer" }); else toast(q.d.detail || "No se pudo componer"); return; }
        if (T) T.terminar(id, true, { texto: "Escena lista. Pídele a la IA que la adapte a tus personajes.", silenciosa: true });
        insertarConSonidos(q.d, p.nombre);
      } }, el("span", { html: ico("clapperboard", 14) }), el("span", {}, p.nombre)));
    });
  }
  function sec3d(cu) {
    cu.append(el("div", { class: "anim-acc" }, el("button", { class: "btn", html: `${ico("folder-open")} Modelo 3D…`, onclick: () => modelo3d() }),
      el("button", { class: "btn fantasma", title: "Zorro de ejemplo (Khronos, CC BY 4.0: da crédito si lo publicas)", onclick: () => modelo3d("/anim/rig/modelos/Fox.glb") }, "Zorro de ejemplo")),
      el("div", { class: "acord-vacio" }, "Archivos .glb o .gltf con sus animaciones. Las cámaras y luces 3D por capa están en la lista de pendientes (docs/paridad-premiere-ae.md)."));
  }
  async function cargarPresets() {
    if (!A.presets) { const r = await pedir("/api/anim/presets"); A.presets = r.ok ? r.d.presets : []; }
    return A.presets;
  }
  // miniaturas animadas (~15 cuadros/s) solo mientras el panel está a la vista y el video no se reproduce
  function animarMinis(cont) {
    cancelAnimationFrame(miniLoop);
    let ult = 0;
    const paso = (ahora) => {
      if (!cont.isConnected) return;
      miniLoop = requestAnimationFrame(paso);
      if (cont.hidden || E.reproduciendo || ahora - ult < 66) return;
      ult = ahora;
      for (const cv of cont.querySelectorAll(".anim-card canvas")) {
        const c = cv._c; if (!c || !c.esc) continue;
        const d = cv._dur || 4, t = ((ahora / 1000) % (d + 0.8));
        c.esc.dibujar(cv.getContext("2d"), Math.min(t, d - 0.01));
      }
    };
    miniLoop = requestAnimationFrame(paso);
  }

  // ================================================================== inspector de una escena
  function interruptor(on, alCambiar, etiqueta) {
    const c = el("input", { type: "checkbox", checked: !!on, "aria-label": etiqueta || "" });
    c.addEventListener("change", () => alCambiar(c.checked));
    return el("label", { class: "interruptor", title: etiqueta || "" }, c);
  }
  function valorProp(a, prop, tl, def) {
    const ks = (a.keyframes || []).filter((k) => typeof k[prop] === "number").sort((p, q) => p.t - q.t);
    if (!ks.length) return a[prop] ?? def;
    let v = ks[0][prop]; for (const k of ks) if (k.t <= tl + 1e-6) v = k[prop];
    return v;
  }
  function ajustarProp(a, prop, nuevo, def) {
    const viejo = valorProp(a, prop, A.tl || 0, def);
    const kf = (a.keyframes || []).filter((k) => typeof k[prop] === "number");
    if (prop === "escala") {
      const f = viejo ? nuevo / viejo : 1;
      a.escala = r3((a.escala ?? 1) * f); for (const k of kf) k.escala = r3(k.escala * f);
    } else if (prop === "opacidad") {
      a.opacidad = r3(clamp((a.opacidad ?? 1) + nuevo - viejo, 0, 1)); for (const k of kf) k.opacidad = r3(clamp(k.opacidad + nuevo - viejo, 0, 1));
    } else {
      const d = nuevo - viejo; a[prop] = Math.round(((a[prop] ?? def) + d) * 100) / 100; for (const k of kf) k[prop] = Math.round((k[prop] + d) * 100) / 100;
    }
  }
  function inspEscena(c, i) {
    const U = ED.ui, o = E.plan.overlays[i], v = V().overlays[i];
    const j0 = jsonDe(i);
    if (!j0) { c.append(el("div", { class: "nota" }, "Cargando la animación…")); resolver(); return; }
    const actores = j0.actores || [];
    if (!A.sel || A.sel.i !== i || !actores.some((a, k) => (a.id ?? `a${k}`) === A.sel.actor)) A.sel = { i, actor: actores.length ? (actores[0].id ?? "a0") : null };
    A.tl = E.t - v.t_in;
    const kAct = actores.findIndex((a, k) => (a.id ?? `a${k}`) === A.sel.actor);
    // edición: copia → cambio → vista previa inmediata → guardado (con retardo mientras se arrastra)
    const guardarLuego = debounce((j) => guardarEscena(i, j, "animación", { reInsp: false }), 450);
    const editar = (fn, modo = "luego") => {
      const j = JSON.parse(JSON.stringify(jsonDe(i)));
      fn(j, j.actores[kAct]);
      A.borrador = { i, escena: j };
      pintar(E.t);
      if (modo === "ya") return guardarEscena(i, j, "animación");
      if (modo === "luego") guardarLuego(j);
    };
    if (E.t < v.t_in || E.t >= v.t_out) ED.ponerT(Math.min(v.t_out - 0.02, v.t_in + Math.min(1, (v.t_out - v.t_in) / 2)));
    // resumen
    c.append(el("div", { class: "anim-cab" }, el("span", { class: "anim-ic", html: ico("sparkles", 16) }),
      el("div", {}, el("b", {}, j0.nombre || "Animación"), el("span", { class: "tenue" }, `${actores.length} actor${actores.length === 1 ? "" : "es"} · ${fmt(v.t_in)} – ${fmt(v.t_out)}`))));
    // actores
    const lista = el("div", { class: "anim-actores", role: "listbox", "aria-label": "Actores de la animación" });
    actores.forEach((a, k) => {
      const id = a.id ?? `a${k}`, [tn, ti] = TIPOS[a.tipo || "forma"] || [humano(a.tipo), "layers"];
      const b = el("button", { class: "anim-actor" + (id === A.sel.actor ? " on" : ""), role: "option", "aria-selected": String(id === A.sel.actor), title: `${nombreActor({ ...a, id })} (${tn})`,
        onclick: () => { A.sel = { i, actor: id }; ED.renderInspector(); pedirPintar(); } },
        el("span", { class: "ic", html: ico(ti, 14) }), el("span", { class: "nom" }, nombreActor({ ...a, id })), el("span", { class: "tipo" }, tn));
      lista.append(b);
    });
    c.append(lista, el("div", { class: "nota" }, "Clic en un actor del visor para elegirlo; arrástralo para moverlo."));
    const a = actores[kAct];
    if (a) {
      c.append(U.seccion("Transformar"));
      const num = (prop, def) => U.inNum(Math.round(valorProp(a, prop, A.tl, def)), (x) => x !== null && editar((j, b) => ajustarProp(b, prop, x, def), "ya"), { step: 1 });
      const conFis = (a.comportamientos || []).some((p) => p.tipo === "fisica" && p.activo !== false);
      c.append(el("div", { class: "cmp2" }, U.cmp("X", num("x", 0)), U.cmp("Y", num("y", 0))),
        ...(conFis ? [el("div", { class: "nota" }, "Con física, X e Y son el punto desde donde empieza a caer.")] : []),
        U.cmp("Escala", U.deslizador(valorProp(a, "escala", A.tl, 1), (x) => editar((j, b) => ajustarProp(b, "escala", x, 1)), { min: 0.05, max: 4, step: 0.01, factor: 100, unidad: "%", vivo: (x) => editar((j, b) => ajustarProp(b, "escala", x, 1), "vivo") })),
        U.cmp("Rotación", U.deslizador(valorProp(a, "rot", A.tl, 0), (x) => editar((j, b) => ajustarProp(b, "rot", x, 0)), { min: -180, max: 180, step: 1, unidad: "°", vivo: (x) => editar((j, b) => ajustarProp(b, "rot", x, 0), "vivo") })),
        U.cmp("Opacidad", U.deslizador(valorProp(a, "opacidad", A.tl, 1), (x) => editar((j, b) => ajustarProp(b, "opacidad", x, 1)), { min: 0, max: 1, step: 0.01, factor: 100, unidad: "%", vivo: (x) => editar((j, b) => ajustarProp(b, "opacidad", x, 1), "vivo") })));
      propiasActor(c, a, editar, U);
      // comportamientos
      c.append(U.seccion("Comportamientos"));
      const comps = a.comportamientos || [];
      if (!comps.length) c.append(el("div", { class: "nota" }, "Sin comportamientos: agrega uno para darle vida."));
      comps.forEach((p, n) => c.append(tarjetaComp(p, n, actores, a, editar, U)));
      const selN = el("select", { "aria-label": "Agregar un comportamiento" }, el("option", { value: "" }, "Agregar comportamiento…"),
        ...Object.entries(COMP).map(([k, d]) => el("option", { value: k, title: d.d }, `${d.n} — ${d.d}`)));
      selN.addEventListener("change", () => {
        const t = selN.value; if (!t) return;
        editar((j, b) => {
          b.comportamientos = [...(b.comportamientos || []), { tipo: t, ...JSON.parse(JSON.stringify(COMP[t].nuevo || {})) }];
          if (t === "fisica" && !j.fisica) j.fisica = { gravedad: 2400, suelo: Math.round((j.alto || V().H) * 0.85), paredes: true };
          if ((t === "orbita" || t === "seguir" || t === "mirar") && !b.comportamientos[b.comportamientos.length - 1].objetivo) {
            const otro = j.actores.find((x) => x !== b); if (otro) b.comportamientos[b.comportamientos.length - 1].objetivo = otro.id; else if (t === "orbita") b.comportamientos[b.comportamientos.length - 1].centro = [Math.round(j.ancho / 2), Math.round(j.alto / 2)];
          }
        }, "ya");
      });
      c.append(el("div", { class: "anim-agregar" }, selN));
    }
    // mundo, ritmo y variación
    c.append(U.seccion("Mundo y ritmo"));
    const hayFis = !!j0.fisica || actores.some((x) => (x.comportamientos || []).some((p) => p.tipo === "fisica"));
    if (hayFis) {
      const f = j0.fisica || {};
      c.append(U.cmp("Gravedad", U.deslizador(f.gravedad ?? 2400, (x) => editar((j) => { j.fisica = { ...(j.fisica || {}), gravedad: Math.round(x) }; }), { min: 0, max: 8000, step: 50, vivo: (x) => editar((j) => { j.fisica = { ...(j.fisica || {}), gravedad: Math.round(x) }; }, "vivo") }), "Qué tan rápido caen las cosas (0 = flotan)"),
        U.cmp("Suelo", U.deslizador(f.suelo ?? Math.round((j0.alto || V().H) * 0.9), (x) => editar((j) => { j.fisica = { ...(j.fisica || {}), suelo: Math.round(x) }; }), { min: 0, max: j0.alto || V().H, step: 5, unidad: "px", vivo: (x) => editar((j) => { j.fisica = { ...(j.fisica || {}), suelo: Math.round(x) }; }, "vivo") }), "Altura del piso invisible donde rebotan"),
        U.cmp("Paredes", interruptor(f.paredes !== false, (x) => editar((j) => { j.fisica = { ...(j.fisica || {}), paredes: x }; }, "ya"), "Rebota en los bordes de la pantalla")));
    }
    const ritmoMusica = !j0.ritmo;
    c.append(U.cmp("Al ritmo de la música", interruptor(ritmoMusica, (x) => editar((j) => { if (x) delete j.ritmo; else j.ritmo = { bpm: V().bpm || 120 }; }, "ya"), "Usa los beats de la música del video"), "Lo que late o salta con el beat sigue la música del video"));
    const inSem = U.inNum(j0.semilla ?? 1, (x) => x !== null && editar((j) => { j.semilla = Math.round(x); }, "ya"), { step: 1, min: 0 });
    c.append(U.cmp("Variación", el("div", { class: "linea" }, inSem, el("button", { class: "btn chico", title: "Otra versión al azar (confeti, chispas, temblores)", html: `${ico("sparkles", 13)} Variar`, onclick: () => editar((j) => { j.semilla = 1 + Math.floor(Math.random() * 99999); }, "ya") })), "Cambia el azar de partículas y temblores"));
    // tiempo
    c.append(U.seccion("Tiempo y capa"),
      el("div", { class: "cmp2" },
        U.cmp("Aparece en", U.inNum(r3(v.t_in), (x) => x !== null && hacer({ op: "lista_props", lista: "overlays", i, props: { t_in: x } }, { reInsp: false }), { min: 0, step: 0.05 })),
        U.cmp("Termina en", U.inNum(r3(v.t_out), (x) => x !== null && hacer({ op: "lista_props", lista: "overlays", i, props: { t_out: x } }, { reInsp: false }), { min: 0, step: 0.05 }))),
      U.cmp("Capa", U.inSel([1, 2, 3, 4, 5, 6].map((p) => [p, `V${p + 1}`]), o.pista || 1, (x) => hacer({ op: "lista_props", lista: "overlays", i, props: { pista: Number(x) === 1 ? null : Number(x) } })), "Las capas más altas se dibujan encima"),
      el("div", { class: "botones" }, U.boton("Empezar en el cabezal", () => hacer({ op: "lista_mover", lista: "overlays", i, a: r3(E.t) }), "chico"),
        U.boton("Duplicar", ED.duplicarSel, "chico"), U.boton("Borrar", ED.borrarSel, "chico peligro")));
    // avanzado: JSON
    const ta = el("textarea", { class: "anim-json", rows: 10, spellcheck: "false", "aria-label": "Escena en JSON" }, JSON.stringify(j0, null, 1));
    c.append(U.avanzado("Editar el JSON de la escena", ta, el("div", { class: "botones" }, U.boton("Aplicar", async () => {
      let j; try { j = JSON.parse(ta.value); } catch (e) { return toast("El JSON no es válido: " + e.message); }
      const r = await pedir("/api/anim/validar", { method: "POST", json: { escena: j } });
      if (r.ok && r.d.errores && r.d.errores.length) return toast(r.d.errores.slice(0, 4).join("\n"));
      guardarEscena(i, j, "json", { reInsp: true });
    }, "chico"))));
  }
  function propiasActor(c, a, editar, U) {
    const p = a.params || {}, set = (k, x, modo = "luego") => editar((j, b) => { b.params = { ...(b.params || {}) }; if (x === null) delete b.params[k]; else b.params[k] = x; }, modo);
    if (a.tipo === "rig2d") {
      const capas = Array.isArray(p.anim) ? p.anim : p.anim ? [p.anim] : [];
      const primera = capas[0] ? (typeof capas[0] === "string" ? { nombre: capas[0] } : capas[0]) : { nombre: "respirar" };
      const setAnim = (cam) => editar((j, b) => { const cs = Array.isArray(b.params.anim) ? b.params.anim.map((x) => typeof x === "string" ? { nombre: x } : { ...x }) : [{}]; cs[0] = { ...cs[0], ...primera, ...cam }; b.params = { ...b.params, anim: cs }; delete b.params.animacion; }, cam.nombre ? "ya" : "luego");
      const rid = /rigs[\\/]([^\\/]+)[\\/]rig\.json$/i.exec(String(p.rig || ""));
      const deBiblio = p.animacion !== undefined && p.animacion !== null;
      const actual = deBiblio ? (typeof p.animacion === "string" ? p.animacion : ((Array.isArray(p.animacion) ? p.animacion[0] : p.animacion) || {}).id) : primera.nombre;
      const selMov = el("select", { "aria-label": "Movimiento" });
      llenarSelect(selMov, ANIMS_RIG, actual);
      let lista = null;
      animacionesDe(rid && rid[1]).then((l) => { if (l && selMov.isConnected) { lista = l; llenarSelect(selMov, opcionesAnim(l), actual); } });
      selMov.addEventListener("change", () => {
        const x = selMov.value; if (!x) return;
        if (lista && lista.some((q) => q.id === x)) editar((j, b) => { b.params = { ...b.params, animacion: x }; delete b.params.anim; }, "ya");
        else setAnim({ nombre: x });
      });
      c.append(U.seccion("Personaje"),
        U.cmp("Movimiento", selMov),
        deBiblio ? U.cmp("Velocidad", U.deslizador(p.velocidad ?? 1, (x) => set("velocidad", r3(x) === 1 ? null : r3(x)), { min: 0.2, max: 3, step: 0.05, factor: 100, unidad: "%" }))
          : U.cmp("Velocidad", U.deslizador(primera.velocidad ?? 1, (x) => setAnim({ velocidad: r3(x) }), { min: 0.2, max: 3, step: 0.05, factor: 100, unidad: "%" })),
        ...(deBiblio ? [] : [U.cmp("Intensidad", U.deslizador(primera.amplitud ?? 1, (x) => setAnim({ amplitud: r3(x) }), { min: 0, max: 2, step: 0.05, factor: 100, unidad: "%" }), "Qué tanto se mueven brazos y piernas")]),
        U.cmp("Tamaño", U.deslizador(p.alto ?? 400, (x) => set("alto", Math.round(x)), { min: 40, max: V().H * 1.2, step: 2, unidad: "px" })),
        U.cmp("Mirar al otro lado", interruptor(!!p.espejo, (x) => set("espejo", x || null, "ya"), "Voltear horizontalmente")),
        ...(rid ? [el("div", { class: "botones" }, el("button", { class: "btn chico", html: `${ico("bone", 13)} Editar huesos`, onclick: () => ED.abrirEditorHuesos(rid[1]) }),
          el("button", { class: "btn chico", html: `${ico("plus", 13)} Crear animación nueva…`, title: "Anima este personaje a mano en el editor de huesos", onclick: () => abrirAnimar(rid[1]) }))] : []));
    } else if (a.tipo === "modelo3d") {
      c.append(U.seccion("Modelo 3D"),
        U.cmp("Animación", U.inTxt(p.clip ?? "", (x) => set("clip", x === null ? null : (/^\d+$/.test(x) ? Number(x) : x), "ya"), { ph: "0 = la primera" }), "Nombre o número del clip del .glb"),
        U.cmp("Girar", U.deslizador(p.rotar ?? 0, (x) => set("rotar", Math.round(x) || null), { min: -120, max: 120, step: 1, unidad: "°/s" })),
        U.cmp("Sombra", interruptor(p.sombra !== false, (x) => set("sombra", x, "ya"), "Sombra suave en el piso")));
    } else if (a.tipo === "texto") {
      c.append(U.seccion("Texto"), U.cmp("Texto", U.inTxt(p.texto ?? "", (x) => set("texto", x ?? ""))),
        U.cmp("Tamaño", U.deslizador(p.tamano ?? 120, (x) => set("tamano", Math.round(x)), { min: 12, max: 400, step: 1, unidad: "px" })),
        U.cmp("Color", U.inColor(p.color ?? "#FFFFFF", (x) => set("color", x))));
    } else if (a.tipo === "imagen" || a.tipo === "sprite") {
      c.append(U.seccion("Imagen"), U.cmp("Ancho", U.deslizador(p.ancho ?? 600, (x) => set("ancho", Math.round(x)), { min: 20, max: V().W, step: 2, unidad: "px" })));
    } else if (a.tipo === "firma") {
      c.append(U.seccion("Firma"), U.cmp("Color", U.inColor(p.color ?? "#101828", (x) => set("color", x))),
        U.cmp("Duración del trazo", U.deslizador(p.dur ?? 2.5, (x) => set("dur", r3(x)), { min: 0.5, max: 8, step: 0.1, unidad: "s" })));
    } else if (a.tipo === "particulas") {
      c.append(U.seccion("Partículas"), U.cmp("Tipo", U.inSel([["chispas", "Chispas"], ["confeti", "Confeti"], ["humo", "Humo"], ["monedas", "Monedas"], ["estrellas", "Estrellas"]], p.preset || "chispas", (x) => set("preset", x, "ya"))));
    } else if (a.tipo === "globo") {
      const ids = (jsonDe(A.sel.i).actores || []).map((x, q) => x.id ?? `a${q}`).filter((x) => x !== a.id && x !== undefined);
      c.append(U.seccion("Globo de diálogo"),
        U.cmp("Texto", U.inTxt(p.texto ?? "", (x) => set("texto", x ?? ""))),
        U.cmp("Apunta a", U.inSel(ids.map((x) => [x, humano(x)]), p.objetivo || "", (x) => set("objetivo", x, "ya"), { vacio: "Nadie (narrador)" }), "El personaje que habla: el globo lo sigue"),
        U.cmp("Estilo", U.inSel([["pixel", "Pixel"], ["comic", "Cómic"], ["elegante", "Elegante"], ["pensamiento", "Pensamiento"]], p.estilo || "pixel", (x) => set("estilo", x, "ya"))),
        U.cmp("Emoción", U.inSel([["normal", "Normal"], ["amor", "Amor"], ["grito", "Grito"], ["susurro", "Susurro"]], p.emocion || "normal", (x) => set("emocion", x, "ya"))));
    } else if (a.tipo === "fondo" || a.tipo === "silueta" || a.tipo === "corazones" || a.tipo === "aparicion") {
      const campos = [];
      if (typeof p.color === "string") campos.push(U.cmp("Color", U.inColor(p.color, (x) => set("color", x))));
      if (typeof p.estilo === "string") campos.push(U.cmp("Estilo", U.inTxt(p.estilo, (x) => set("estilo", x, "ya"))));
      if (typeof p.modo === "string") campos.push(U.cmp("Modo", U.inTxt(p.modo, (x) => set("modo", x, "ya"))));
      for (const k of ["fuerza", "tasa", "dur"]) if (typeof p[k] === "number") campos.push(U.cmp(humano(k), U.deslizador(p[k], (x) => set(k, r3(x)), { min: 0, max: Math.max(3, p[k] * 3), step: 0.05 })));
      c.append(U.seccion(TIPOS[a.tipo][0]), ...(campos.length ? campos : [el("div", { class: "nota" }, "Muévelo en el visor o ajusta su tiempo abajo.")]));
    } else {
      // tipos nuevos (p. ej. «globo» de diálogo): su texto y los parámetros que apuntan a otro actor, sin conocer sus claves
      const ids = (jsonDe(A.sel.i).actores || []).map((x, q) => x.id ?? `a${q}`).filter((x) => x !== a.id);
      const campos = [];
      if (typeof p.texto === "string") campos.push(U.cmp("Texto", U.inTxt(p.texto, (x) => set("texto", x ?? ""))));
      for (const [k, v] of Object.entries(p)) if (typeof v === "string" && ids.includes(v)) campos.push(U.cmp(k === "objetivo" || k === "apunta" || k === "personaje" ? "Apunta a" : humano(k), U.inSel(ids.map((x) => [x, humano(x)]), v, (x) => set(k, x, "ya"))));
      if (typeof p.estilo === "string") campos.push(U.cmp("Estilo", U.inTxt(p.estilo, (x) => set("estilo", x, "ya"))));
      if (campos.length) c.append(U.seccion((TIPOS[a.tipo] || [humano(a.tipo)])[0]), ...campos);
    }
  }
  function tarjetaComp(p, n, actores, a, editar, U) {
    const d = COMP[p.tipo] || { n: humano(p.tipo), d: "", p: [] };
    const on = p.activo !== false;
    const setP = (k, x, modo = "luego") => editar((j, b) => { const q = b.comportamientos[n]; if (x === null || x === undefined) delete q[k]; else q[k] = x; }, modo);
    const cuerpo = el("div", { class: "comp-cuerpo" });
    for (const [k, et, tipo, mn, mx, st, def, ops, uni] of d.p) {
      if (tipo === "num") cuerpo.append(U.cmp(et, U.deslizador(p[k] ?? def, (x) => setP(k, r3(x)), { min: mn, max: mx, step: st, unidad: uni, vivo: (x) => editar((j, b) => { b.comportamientos[n][k] = r3(x); }, "vivo") })));
      else if (tipo === "bool") cuerpo.append(U.cmp(et, interruptor(p[k] ?? def, (x) => setP(k, x, "ya"), et)));
      else if (tipo === "sel") cuerpo.append(U.cmp(et, U.inSel(ops, p[k] ?? def, (x) => setP(k, x, "ya"))));
      else if (tipo === "actor") cuerpo.append(U.cmp(et, U.inSel(actores.filter((x) => x !== a).map((x, q) => [x.id ?? `a${q}`, nombreActor(x)]), p[k] ?? "", (x) => setP(k, x, "ya"), { vacio: k === "objetivo" && p.tipo === "orbita" ? "Un punto fijo" : "Nadie" })));
    }
    return el("div", { class: "comp" + (on ? "" : " apagado") },
      el("div", { class: "comp-cab" }, interruptor(on, (x) => setP("activo", x ? null : false, "ya"), on ? "Desactivar" : "Activar"),
        el("div", { class: "comp-tit", title: d.d }, el("b", {}, d.n), el("span", {}, d.d)),
        el("button", { class: "ib", title: "Quitar comportamiento", "aria-label": "Quitar comportamiento", html: ico("x", 13), onclick: () => editar((j, b) => { b.comportamientos.splice(n, 1); }, "ya") })),
      on && d.p.length ? cuerpo : null);
  }

  // ================================================================== API
  ED.inspEscena = inspEscena;
  ED.anim = {
    pintar, pedirPintar,
    planCambiado() { A.borrador = A.arr ? A.borrador : null; if (E.plan) for (const o of E.plan.overlays || []) if (typeof o.escena === "string" && !A.resueltas.has(o.escena)) { resolver(); break; } pedirPintar(); },
    ocultar() { const cv = $("#visor-escenas"); if (cv) cv.hidden = true; },
    insertarPreset, crearPersonaje, modelo3d, firmaTexto, firmaImagen, insertar, escenaPreset,
    seleccionarActor(i, actor) { A.sel = { i, actor }; ED.seleccionar({ tipo: "overlays", i }, "solo"); },
    // actor elegido en el visor, para las secciones de otros módulos en el inspector (boca y expresión)
    actorSel() { if (!A.sel || !E.plan) return null; const j = jsonDe(A.sel.i); const k = j ? (j.actores || []).findIndex((a, n) => (a.id ?? `a${n}`) === A.sel.actor) : -1; return k < 0 ? null : { i: A.sel.i, id: A.sel.actor, actor: j.actores[k], escena: j, guardar: (nueva) => guardarEscena(A.sel.i, nueva, "personaje") }; },
    stats() { const m = [...A.stats.ms].sort((a, b) => a - b); return { cuadros: A.stats.cuadros, mediana_ms: m.length ? r3(m[m.length >> 1]) : null, p95_ms: m.length ? r3(m[Math.floor(m.length * 0.95)]) : null, max_ms: m.length ? r3(m[m.length - 1]) : null, escenas_en_cache: A.cache.size }; },
    resetStats() { A.stats = { ms: [], cuadros: 0 }; },
    _A: A,
  };
  if (WD().registrarPanel) WD().registrarPanel("animar", (cont) => montarPanel(cont), { titulo: "Animar", icono: "person-standing" });
})();
