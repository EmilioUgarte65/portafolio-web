"use strict";
// Web Studio — exportación (bloque I) y rendimiento (J2-J4), 5-oct-2026. docs/editor.md §9.
// - Exportar: calidad Rápida/Normal/Máxima × plataformas (YouTube, Shorts, TikTok, Reels, cuadrado, LinkedIn, WhatsApp,
//   pantalla de evento) → cola de render en segundo plano (sigues editando), con cancelar y reintentar; portada
//   automática, GIF, solo audio y fotogramas; proyecto para Premiere/DaVinci y versiones 9:16.
//   Presets: GET /api/editor/exportar/presets (los del motor si los publica; si no, los de editor/salida.py).
// - J3 advertencias tempranas: chip en la barra de la línea de tiempo con lo que fallaría al exportar.
// - J2 render de fondo: los tramos con efectos se renderizan solos al quedarte quieto; la regla muestra una franja
//   roja (falta) / verde (listo) y al reproducir sobre un tramo verde se ve con efectos.
// - J4 modo de bajo consumo: menos trabajo en segundo plano (sin render de fondo ni miniaturas animadas).
(() => {
  const ED = window.WDED; if (!ED) return;
  const { E, $, $$, el, esc, pedir, toast, r3, ico, pidURL, lsGet, lsSet } = ED;
  const V = () => E.vista;
  const ic = (n, t = 14) => el("span", { class: "i", "aria-hidden": "true", html: ico(n, t) });
  const WD = () => window.WDVS || {};
  const X = { presets: null, cola: [], sondeo: null, avisados: new Set(), diag: [], fondo: { hash: "", rangos: [] } };
  const cerrar = () => { const m = $("#wd-modal"); if (m) m.remove(); };
  const ORDEN = ["youtube", "shorts", "tiktok", "reels", "instagram_1x1", "linkedin", "whatsapp", "evento"];
  const ICO_PL = { youtube: "youtube", shorts: "smartphone", tiktok: "smartphone", reels: "instagram", instagram_1x1: "square", linkedin: "linkedin", whatsapp: "message-circle", evento: "presentation", original: "film" };

  async function presets() { if (!X.presets) { const r = await pedir("/api/editor/exportar/presets"); X.presets = r.ok ? r.d : { plataformas: {}, calidades: {} }; } return X.presets; }

  // ================================================================== ventana Exportar
  async function abrir() {
    const p = await presets();
    const elegidas = new Set(lsGet("wded_exp_plat", ["youtube"]));
    let calidad = lsGet("wded_exp_calidad", "normal");
    const diag = await diagnosticar();
    const segs = el("div", { class: "segmentado exp-cal", role: "radiogroup", "aria-label": "Calidad" }, ...Object.entries(p.calidades).map(([id, c]) =>
      el("button", { role: "radio", "aria-checked": String(id === calidad), "data-c": id, title: c.nota, onclick: () => { calidad = id; lsSet("wded_exp_calidad", id); $$(".exp-cal button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.c === id))); } }, c.nombre)));
    const plats = el("div", { class: "exp-plats" }, ...ORDEN.filter((id) => p.plataformas[id]).map((id) => {
      const pl = p.plataformas[id];
      const b = el("button", { class: "exp-plat", role: "checkbox", "aria-checked": String(elegidas.has(id)), onclick: () => { elegidas.has(id) ? elegidas.delete(id) : elegidas.add(id); b.setAttribute("aria-checked", String(elegidas.has(id))); lsSet("wded_exp_plat", [...elegidas]); btn.textContent = textoBtn(); btn.disabled = !elegidas.size; } },
        el("span", { html: ico(ICO_PL[id] || "film", 18) }), el("b", {}, pl.nombre), el("span", { class: "tenue" }, `${pl.formato || "igual"} · ${pl.nota || ""}`));
      return b;
    }));
    const textoBtn = () => elegidas.size > 1 ? `Exportar ${elegidas.size} videos` : "Exportar video";
    const btn = el("button", { class: "bt acento", disabled: !elegidas.size, onclick: async () => {
      const errs = X.diag.filter((d) => d.nivel === "error");
      if (errs.length && !(WD().confirmar ? await WD().confirmar({ titulo: "El video tiene problemas", cuerpo: errs.map((e) => e.texto).join("\n"), si: "Exportar igual" }) : confirm("El video tiene problemas. ¿Exportar igual?"))) return;
      const trabajos = [...elegidas].map((plataforma) => ({ plataforma, calidad }));
      const r = await pedir(`${pidURL()}/editor/cola`, { method: "POST", json: { trabajos } });
      if (!r.ok) return toast(r.d.detail || "No se pudo exportar");
      X.cola = r.d.cola; pintarCola(); vigilar();
      toast(`${trabajos.length > 1 ? `${trabajos.length} videos en la cola` : "Exportando"} en segundo plano. Sigue editando; te aviso al terminar.`, "info", 3500);
    } }, textoBtn());
    const colaCaja = el("div", { class: "exp-cola", id: "exp-cola" });
    const est = el("span", { class: "tenue", "aria-live": "polite" }, "Se renderiza en segundo plano");
    const estimar = async () => {
      const r = await pedir(`${pidURL()}/editor/estimar?calidad=${calidad}`);
      if (r.ok && r.d.segundos) est.textContent = `Se renderiza en segundo plano · ≈ ${r.d.segundos < 90 ? Math.round(r.d.segundos) + " s" : Math.round(r.d.segundos / 60) + " min"} por video`;
    };
    estimar();
    segs.addEventListener("click", () => setTimeout(estimar, 0));
    const extras = el("div", { class: "exp-extras" },
      el("button", { class: "bt", onclick: portada }, ic("image", 14), "Portada automática"),
      el("button", { class: "bt", onclick: () => derivado("gif") }, ic("film", 14), "GIF"),
      el("button", { class: "bt", onclick: () => derivado("audio") }, ic("audio-lines", 14), "Solo audio"),
      el("button", { class: "bt", onclick: () => derivado("fotogramas") }, ic("images", 14), "Fotogramas"),
      el("button", { class: "bt", onclick: () => { cerrar(); ED.exportarNLE(); } }, ic("clapperboard", 14), "Premiere / DaVinci"),
      ED.guias && ED.guias.menuVersiones ? el("button", { class: "bt", onclick: (e) => { const b = e.currentTarget.getBoundingClientRect(); ED.guias.menuVersiones(b.left, b.bottom); } }, ic("smartphone", 14), "Versión 9:16 editable") : null);
    const avisos = diag.length ? el("div", { class: "exp-diag" }, ...diag.slice(0, 5).map((d) => el("div", { class: "diag " + d.nivel }, el("span", { html: ico(d.nivel === "error" ? "circle-alert" : d.nivel === "aviso" ? "triangle-alert" : "info", 14) }), d.texto))) : null;
    const m = ED.modal("Exportar", avisos, el("div", { class: "exp-sec" }, el("b", {}, "Calidad"), segs),
      el("div", { class: "exp-sec" }, el("b", {}, "¿Dónde lo vas a publicar?"), el("span", { class: "tenue" }, "Elige uno o varios: cada uno sale con su formato, peso y volumen ideales.")), plats,
      el("div", { class: "botones" }, btn, est),
      el("div", { class: "exp-sec" }, el("b", {}, "Cola de render")), colaCaja,
      el("div", { class: "exp-sec" }, el("b", {}, "Más formatos")), extras);
    m.classList.add("ancha", "exp-modal");
    await cargarCola(); pintarCola();
  }

  // ================================================================== cola
  async function cargarCola() { const r = await pedir(`${pidURL()}/editor/cola`); if (r.ok) X.cola = r.d.cola || []; }
  const ESTADO = { en_cola: "En espera", renderizando: "Renderizando", listo: "Listo", error: "Falló", cancelado: "Cancelado" };
  function pintarCola() {
    const c = $("#exp-cola"); if (!c) return;
    c.innerHTML = "";
    const p = X.presets || { plataformas: {}, calidades: {} };
    if (!X.cola.length) return c.append(el("div", { class: "tenue" }, "Nada en la cola."));
    for (const j of [...X.cola].reverse().slice(0, 12)) {
      const pl = p.plataformas[j.plataforma] || { nombre: j.plataforma }, ca = p.calidades[j.calidad] || { nombre: j.calidad };
      const acc = [];
      if (j.estado === "listo") acc.push(el("a", { class: "bt chico acento", href: `${pidURL()}/editor/cola/archivo?id=${j.id}&descargar=true`, download: "" }, ic("download", 12), "Descargar"),
        el("button", { class: "bt chico", onclick: () => ED.playVideo && (cerrar(), ED.playVideo(`${pidURL()}/editor/cola/archivo?id=${j.id}`, 0, `${pl.nombre} · ${ca.nombre}`)) }, ic("play", 12), "Ver"));
      if (j.estado === "en_cola" || j.estado === "renderizando") acc.push(el("button", { class: "bt chico", onclick: () => accion("cancelar", j.id) }, "Cancelar"));
      if (j.estado === "error" || j.estado === "cancelado") acc.push(el("button", { class: "bt chico", onclick: () => accion("reintentar", j.id) }, ic("rotate-ccw", 12), "Reintentar"));
      c.append(el("div", { class: "cola-it " + j.estado },
        el("span", { html: ico(ICO_PL[j.plataforma] || "film", 16) }),
        el("div", { class: "cola-txt" }, el("b", {}, `${pl.nombre} · ${ca.nombre}`),
          el("span", { class: "tenue" }, j.estado === "renderizando" ? `${ESTADO[j.estado]} ${Math.round((j.pct || 0) * 100)} %` : j.estado === "listo" ? `${ESTADO.listo} · ${j.mb} MB` : j.estado === "error" ? `${ESTADO.error}: ${WD().sugerir ? (WD().sugerir(j.error || "", {}).titulo || "") : ""} ${String(j.error || "").split("\n").pop().slice(0, 120)}` : ESTADO[j.estado]),
          j.estado === "renderizando" ? el("div", { class: "barra" }, el("div", { style: { width: `${Math.round((j.pct || 0) * 100)}%` } })) : null),
        el("div", { class: "botones" }, ...acc)));
    }
    if (X.cola.some((j) => ["listo", "error", "cancelado"].includes(j.estado))) c.append(el("button", { class: "enlace", onclick: async () => { const r = await pedir(`${pidURL()}/editor/cola/limpiar`, { method: "POST" }); if (r.ok) { X.cola = r.d.cola; pintarCola(); } } }, "Limpiar terminados"));
  }
  async function accion(que, id) {
    const r = await pedir(`${pidURL()}/editor/cola/${que}`, { method: "POST", json: { id } });
    if (!r.ok) return toast(r.d.detail || "No se pudo");
    X.cola = r.d.cola; pintarCola(); vigilar();
  }
  function vigilar() {
    clearTimeout(X.sondeo);
    const T = WD().tareas, p = X.presets || { plataformas: {}, calidades: {} };
    const tic = async () => {
      if (!E.pid) return;
      await cargarCola(); pintarCola();
      for (const j of X.cola) {
        const idT = "cola:" + j.id, nom = `${(p.plataformas[j.plataforma] || {}).nombre || j.plataforma} · ${(p.calidades[j.calidad] || {}).nombre || j.calidad}`;
        if (j.estado === "renderizando" || j.estado === "en_cola") { if (T) T.poner(idT, { titulo: `Exportando ${nom}`, tipo: "render", texto: j.estado === "en_cola" ? "En espera" : j.etapa || "", frac: j.pct || 0 }); }
        else if (!X.avisados.has(idT) && (j.fin || 0) * 1000 > Date.now() - 600000) {
          X.avisados.add(idT);
          if (T) T.terminar(idT, j.estado === "listo", { texto: j.estado === "listo" ? `${nom}: listo (${j.mb} MB)` : `${nom}: ${ESTADO[j.estado]}` });
          else if (j.estado === "listo") toast(`${nom}: listo`, "info", 5000);
        }
      }
      if (X.cola.some((j) => j.estado === "renderizando" || j.estado === "en_cola")) X.sondeo = setTimeout(tic, 1500);
    };
    tic();
  }

  // ================================================================== extras
  function rangoGIF() {
    if (E.rango) return E.rango;
    const t = ED.tomaEn(E.t); if (t) return [t.t0, Math.min(t.t0 + t.dur, t.t0 + 15)];
    return [E.t, E.t + 5];
  }
  async function derivado(tipo) {
    const listo = [...X.cola].reverse().find((j) => j.estado === "listo");
    const [a, b] = tipo === "gif" ? rangoGIF() : tipo === "fotogramas" && E.rango ? E.rango : [0, null];
    const formato = tipo === "audio" ? (await elegir("Formato del audio", [["m4a", "M4A (AAC)"], ["mp3", "MP3"], ["wav", "WAV sin compresión"]])) : "m4a";
    if (!formato) return;
    const T = WD().tareas, idT = "deriv:" + Date.now();
    if (T) T.poner(idT, { titulo: { gif: "Creando GIF", audio: "Extrayendo el audio", fotogramas: "Sacando fotogramas" }[tipo], tipo: "render", frac: null });
    const r = await pedir(`${pidURL()}/editor/derivado`, { method: "POST", json: { tipo, id: listo ? listo.id : null, a: r3(a), b: b == null ? null : r3(b), cada: 1, formato } });
    if (T) T.terminar(idT, r.ok, { texto: r.ok ? `${r.d.nombre} (${r.d.mb} MB)` : (r.d.detail || "No se pudo"), silenciosa: true });
    if (!r.ok) return toast(r.d.detail || "No se pudo", r.status === 404 ? "info" : "error");
    const a2 = el("a", { href: r.d.url, download: r.d.nombre }); document.body.append(a2); a2.click(); a2.remove();
    toast(`Listo: ${r.d.nombre} (${r.d.mb} MB)`, "info", 3000);
  }
  function elegir(titulo, ops) {
    return new Promise((ok) => {
      const m = ED.modal(titulo, el("div", { class: "botones" }, ...ops.map(([v, t]) => el("button", { class: "bt", onclick: () => { m.closest(".wd-modal").remove(); ok(v); } }, t))));
      m.closest(".wd-modal").addEventListener("click", (e) => { if (e.target.classList.contains("wd-modal")) ok(null); });
    });
  }
  async function portada() {
    const img = el("img", { alt: "Portada del video", class: "portada-img" });
    const tit = el("input", { type: "text", value: (E.plan && E.plan.titulo) || "", "aria-label": "Título de la portada" });
    const nota = el("div", { class: "nota" }, "Busco el cuadro más nítido y llamativo…");
    const gen = async () => {
      nota.textContent = "Busco el cuadro más nítido y llamativo…";
      const r = await pedir(`${pidURL()}/editor/portada`, { method: "POST", json: { titulo: tit.value } });
      if (!r.ok) { nota.textContent = r.d.detail || "No se pudo"; return; }
      img.src = r.d.url + "&t=" + Date.now(); nota.textContent = `Cuadro elegido en ${r.d.t.toFixed(1)} s (de ${r.d.candidatos.length} candidatos).`;
      dl.href = r.d.url.replace("descargar=false", "descargar=true");
    };
    const dl = el("a", { class: "bt acento", download: "portada.jpg" }, ic("download", 14), "Descargar");
    ED.modal("Portada automática", img, nota, el("label", { class: "fila-ctl" }, "Título: ", tit), el("div", { class: "botones" }, el("button", { class: "bt", onclick: gen }, ic("refresh-cw", 14), "Rehacer"), dl)).classList.add("ancha");
    gen();
  }

  // ================================================================== J3: advertencias tempranas
  async function diagnosticar() {
    if (!E.pid || !E.plan) return [];
    const r = await pedir(`${pidURL()}/editor/diagnostico`); if (!r.ok) return [];
    X.diag = r.d.problemas || [];
    let b = $("#ed-diag");
    const est = $("#ed-estado");
    const serios = X.diag.filter((d) => d.nivel !== "info");
    if (!b && est) { b = el("button", { class: "ib diag-btn", id: "ed-diag", onclick: () => panelDiag(b) }); est.before(b); }
    if (b) {
      b.hidden = !serios.length;
      b.className = "ib diag-btn " + (X.diag.some((d) => d.nivel === "error") ? "err" : "warn");
      b.innerHTML = ico("triangle-alert", 15) + `<span class="badge">${serios.length}</span>`;
      b.title = `${serios.length} detalle(s) que conviene revisar antes de exportar`; b.setAttribute("aria-label", b.title);
    }
    return X.diag;
  }
  function panelDiag(b) {
    const old = $("#pop-diag"); if (old) return old.remove();
    const r = b.getBoundingClientRect();
    const pop = el("div", { class: "wd-pop sug-pop", id: "pop-diag", role: "dialog", "aria-label": "Antes de exportar", style: { left: Math.max(8, r.left - 140) + "px", bottom: innerHeight - r.top + 6 + "px", width: "330px" } },
      el("b", {}, "Antes de exportar"),
      ...X.diag.filter((d) => d.nivel !== "info").map((d) => el("div", { class: "sug " + (d.nivel === "error" ? "alta" : "media") }, el("div", {}, d.texto),
        el("div", { class: "botones" }, d.t != null ? el("button", { class: "bt chico", onclick: () => { ED.ponerT(d.t, { seguir: true }); if (d.sel) ED.seleccionar(d.sel, "solo"); } }, "Ir") : null,
          d.relinkear ? el("button", { class: "bt chico acento", onclick: () => relinkear(d.relinkear) }, "Buscar el archivo") : null))));
    document.body.append(pop);
    setTimeout(() => document.addEventListener("pointerdown", function f(ev) { if (!ev.target.closest("#pop-diag, #ed-diag")) { pop.remove(); document.removeEventListener("pointerdown", f); } }), 0);
  }
  async function relinkear(alias) {
    const MNr = WD();
    const ms = MNr.elegirNativo ? await MNr.elegirNativo({ titulo: `Busca el archivo de ${alias}`, multiple: false }) : null;
    const ruta = Array.isArray(ms) ? (ms[0] && (ms[0].ruta || ms[0])) : ms && (ms.ruta || ms.rutas && ms.rutas[0]);
    if (!ruta) return;
    const v = E.plan.fuentes[alias];
    const nuevo = typeof v === "string" || !v ? ruta : { ...v, ruta };
    if (await ED.hacer({ op: "seccion_props", seccion: "fuentes", props: { [alias]: nuevo }, desc: `relinkear ${alias}` })) { toast(`Listo: ${alias} apunta al archivo nuevo.`, "info"); diagnosticar(); }
  }
  ED.relinkear = relinkear;
  const diagLuego = ED.debounce(diagnosticar, 1800);
  window.addEventListener("wded:editado", diagLuego);
  window.addEventListener("wdvs:plan-cambiado", diagLuego);

  // ================================================================== J2: render de fondo
  function rangosFx() {
    const v = V(); if (!v) return [];
    const rs = [];
    for (const g of v.grupos) for (const t of g.tomas) if ((t.efectos || []).length || t.fx_grupo) rs.push([t.t0, t.t0 + t.dur]);
    for (const e of v.efectos || []) if (!e.todo) rs.push([e.desde, e.hasta]);
    rs.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const [a, b] of rs) { if (out.length && a <= out[out.length - 1][1] + 0.05) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b); else out.push([a, b]); }
    // tramos de 12 s como máximo (el render de un tramo debe ser corto)
    return out.flatMap(([a, b]) => { const p = []; for (let x = a; x < b - 0.05; x += 12) p.push([r3(x), r3(Math.min(b, x + 12))]); return p; }).slice(0, 30);
  }
  let tFondo = null, sondeoFondo = null;
  async function fondo() {
    if (!E.plan || !E.abierto || ligero() || E.reproduciendo || document.hidden) return;
    const rs = rangosFx();
    if (!rs.length) { X.fondo = { hash: E.hash, rangos: [] }; return dibujarFondo(); }
    const r = await pedir(`${pidURL()}/editor/fondo`, { method: "POST", json: { rangos: rs, hash: E.hash } });
    if (!r.ok || r.d.viejo) return;
    X.fondo = { hash: E.hash, rangos: r.d.rangos };
    dibujarFondo();
    clearTimeout(sondeoFondo);
    if (X.fondo.rangos.some((x) => x.estado !== "listo")) sondeoFondo = setTimeout(fondo, 4000);
  }
  const fondoLuego = () => { clearTimeout(tFondo); clearTimeout(sondeoFondo); X.fondo.rangos = (X.fondo.rangos || []).map((x) => ({ ...x, estado: "falta" })); dibujarFondo(); tFondo = setTimeout(fondo, 5000); };
  window.addEventListener("wded:editado", fondoLuego);
  window.addEventListener("wdvs:plan-cambiado", fondoLuego);
  function dibujarFondo() {
    const cont = $("#tl-cont"); if (!cont || !V()) return;
    let capa = $("#tl-render", cont);
    if (!capa) { capa = el("div", { class: "tl-render", id: "tl-render", "aria-hidden": "true" }); cont.append(capa); }
    capa.innerHTML = "";
    if (ligero() || X.fondo.hash !== E.hash) return;
    for (const x of X.fondo.rangos || []) {
      const l = ED.xDe(x.a), w = Math.max(2, ED.xDe(x.b) - l);
      capa.append(el("span", { class: "rb " + (x.estado === "listo" ? "ok" : "falta"), style: { left: l + "px", width: w + "px" }, title: x.estado === "listo" ? "Con efectos: listo para reproducir" : "Con efectos: renderizando en segundo plano" }));
    }
  }
  ED.ganchosTimeline.push(dibujarFondo);
  // al reproducir sobre un tramo verde, se ve el render con efectos; al terminar ese tramo sigue la vista en vivo
  ED.antesDePlay = () => {
    if (ligero() || X.fondo.hash !== E.hash || !ED.playVideo) return false;
    const x = (X.fondo.rangos || []).find((r) => r.estado === "listo" && E.t >= r.a && E.t < r.b - 0.1);
    if (!x) return false;
    ED.playVideo(`${pidURL()}/editor/fondo/video?clave=${x.clave}`, x.a, "con efectos (render de fondo)");
    const vid = E.video;
    if (vid) vid.addEventListener("ended", () => setTimeout(() => { if (!E.reproduciendo && Math.abs(E.t - x.b) < 0.4) { ED.ponerT(x.b + 0.001); ED.play(); } }, 30));
    return true;
  };

  // ================================================================== J4: modo de bajo consumo
  function ligero() { return document.body.classList.contains("wded-ligero"); }
  function ponerLigero(on, aviso = true) {
    document.body.classList.toggle("wded-ligero", on); lsSet("wded_ligero", on);
    if (on) { E.calidad = "fluida"; const s = $("#ed-calidad"); if (s) s.value = "fluida"; clearTimeout(tFondo); clearTimeout(sondeoFondo); }
    dibujarFondo();
    const b = $("#ed-ligero"); if (b) { b.setAttribute("aria-pressed", String(on)); b.classList.toggle("on", on); }
    if (aviso) toast(on ? "Modo de bajo consumo: sin render de fondo ni animaciones de miniaturas." : "Modo normal.", "info", 2500);
    if (!on) fondoLuego();
  }
  ED.ligero = { ponerLigero, activo: ligero };
  if (lsGet("wded_ligero", false)) ponerLigero(true, false);
  if (navigator.getBattery) navigator.getBattery().then((bat) => {
    const revisar = () => { if (!bat.charging && bat.level < 0.35 && !ligero() && !sessionStorage.getItem("wded_bat")) { sessionStorage.setItem("wded_bat", "1"); WD().toast ? WD().toast("Tu laptop está con poca batería. ¿Activo el modo de bajo consumo?", "info", { accion: { etiqueta: "Activar", fn: () => ponerLigero(true) } }) : null; } };
    bat.addEventListener("levelchange", revisar); bat.addEventListener("chargingchange", revisar); revisar();
  }).catch(() => {});

  // ================================================================== arranque y comandos
  let pidVisto = null;
  setInterval(() => {
    if (!E.abierto || !E.plan || E.pid === pidVisto) return;
    pidVisto = E.pid; X.fondo = { hash: "", rangos: [] };
    diagnosticar(); cargarCola().then(() => { if (X.cola.some((j) => j.estado === "renderizando" || j.estado === "en_cola")) presets().then(vigilar); });
    fondoLuego();
  }, 1200);
  if (ED.comando) [
    { id: "exportar", titulo: "Exportar video (calidad y plataformas)", grupo: "Exportar", icono: "upload", accion: abrir, claves: "render mp4 youtube tiktok reels whatsapp" },
    { id: "portada", titulo: "Portada automática", grupo: "Exportar", icono: "image", accion: portada, claves: "miniatura thumbnail" },
    { id: "gif", titulo: "Exportar GIF del clip o rango", grupo: "Exportar", icono: "film", accion: () => derivado("gif") },
    { id: "audio_solo", titulo: "Exportar solo el audio", grupo: "Exportar", icono: "audio-lines", accion: () => derivado("audio") },
    { id: "fotogramas", titulo: "Exportar fotogramas (PNG)", grupo: "Exportar", icono: "images", accion: () => derivado("fotogramas") },
    { id: "nle", titulo: "Proyecto para Premiere / DaVinci", grupo: "Exportar", icono: "clapperboard", accion: () => ED.exportarNLE() },
    { id: "diagnostico", titulo: "Revisar antes de exportar", grupo: "Exportar", icono: "triangle-alert", accion: async () => { await diagnosticar(); const b = $("#ed-diag"); if (b && !b.hidden) panelDiag(b); else toast("Todo listo para exportar.", "info", 2000); } },
    { id: "ligero", titulo: "Modo de bajo consumo (laptop)", grupo: "Vista", icono: "battery-low", accion: () => ponerLigero(!ligero()), claves: "bateria rendimiento" },
    { id: "fondo", titulo: "Renderizar ya los tramos con efectos", grupo: "Vista", icono: "monitor-play", accion: () => { if (ligero()) ponerLigero(false, false); fondo(); toast("Renderizando en segundo plano los tramos con efectos.", "info", 2500); } },
  ].forEach(ED.comando);
  ED.exp = { abrir, cargarCola, pintarCola, vigilar, derivado, portada, diagnosticar, panelDiag, fondo, rangosFx, X };
})();
