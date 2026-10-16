"use strict";
// Web Studio — edición rápida (bloque A, 5-oct-2026). docs/editor.md §9.
// - Paleta de comandos (Ctrl+P): ED.comando({id, titulo, grupo, atajo, icono, accion, cuando}) registra acciones.
// - Panel derecho «Guion»: edición por texto estilo Descript (borrar palabras corta el video), quitar silencios y
//   muletillas de un clic y subtítulos desde la voz.
// - Clic derecho en un clip: cortar en cada cambio de escena, cortar al beat; multicámara sincronizada por audio con
//   cambio de ángulo en vivo (teclas 1-9).
// - Proxies automáticos de los videos pesados al importarlos.
// - Contrato de paneles derechos: ED.panelDerecho(id, {titulo, icono, montar(cont, {pid, editor})}).
(() => {
  const ED = window.WDED; if (!ED) return;
  const { E, $, $$, el, esc, pedir, hacer, toast, r3, ico, pidURL, lsGet, lsSet } = ED;
  const V = () => E.vista;
  const ic = (n, t = 14) => el("span", { class: "i", "aria-hidden": "true", html: ico(n, t) });
  const WD = () => window.WDVS || {};
  const fmtS = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const normal = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // ================================================================== paleta de comandos (A7)
  const CMD = [];
  ED.comandos = CMD;
  ED.comando = (c) => { const i = CMD.findIndex((x) => x.id === c.id); if (i >= 0) CMD[i] = c; else CMD.push(c); };
  const recientes = () => lsGet("wded_cmd_recientes", []);
  function puntaje(q, txt) {
    if (!q) return 1;
    const t = normal(txt), w = normal(q);
    if (t.includes(w)) return 100 - t.indexOf(w);
    let i = 0, sc = 0;
    for (const ch of w) { const j = t.indexOf(ch, i); if (j < 0) return 0; sc += j === i ? 3 : 1; i = j + 1; }
    return sc;
  }
  function paleta() {
    if ($("#wded-paleta")) return;
    ED.cerrarMenus && ED.cerrarMenus();
    const lista = el("div", { class: "pal-lista", role: "listbox", id: "pal-lista" });
    const inp = el("input", { type: "text", placeholder: "Escribe una acción… (p. ej. «silencios», «exportar», «beat»)", "aria-label": "Buscar acción", "aria-controls": "pal-lista", autocomplete: "off" });
    const caja = el("div", { class: "pal-caja", role: "dialog", "aria-label": "Paleta de comandos" }, el("div", { class: "pal-cab" }, el("span", { html: ico("search", 16) }), inp, el("kbd", {}, "Esc")), lista);
    const fondo = el("div", { class: "wded-paleta", id: "wded-paleta", onpointerdown: (e) => { if (e.target.id === "wded-paleta") cerrar(); } }, caja);
    document.body.append(fondo);
    let sel = 0, vis = [];
    const rec = recientes();
    function pintar() {
      const q = inp.value.trim();
      const disp = CMD.filter((c) => !c.cuando || c.cuando());
      vis = disp.map((c) => ({ c, p: puntaje(q, `${c.titulo} ${c.grupo || ""} ${c.claves || ""}`) + (rec.includes(c.id) && !q ? 50 - rec.indexOf(c.id) : 0) }))
        .filter((x) => x.p > 0).sort((a, b) => b.p - a.p).slice(0, 40).map((x) => x.c);
      sel = Math.min(sel, Math.max(0, vis.length - 1));
      lista.innerHTML = "";
      if (!vis.length) lista.append(el("div", { class: "pal-vacio" }, "Ninguna acción coincide."));
      vis.forEach((c, i) => lista.append(el("button", { class: "pal-item" + (i === sel ? " sel" : ""), role: "option", "aria-selected": String(i === sel), onclick: () => correr(c), onpointermove: () => { if (sel !== i) { sel = i; marcar(); } } },
        el("span", { class: "pal-ico", html: ico(c.icono || "chevron-right", 15) }), el("span", { class: "pal-tit" }, c.titulo), c.grupo ? el("span", { class: "pal-grupo" }, c.grupo) : null, c.atajo ? el("kbd", {}, c.atajo) : null)));
    }
    function marcar() { $$(".pal-item", lista).forEach((b, i) => { b.classList.toggle("sel", i === sel); b.setAttribute("aria-selected", String(i === sel)); }); const b = $$(".pal-item", lista)[sel]; if (b) b.scrollIntoView({ block: "nearest" }); }
    function cerrar() { fondo.remove(); }
    function correr(c) {
      cerrar();
      lsSet("wded_cmd_recientes", [c.id, ...recientes().filter((x) => x !== c.id)].slice(0, 8));
      try { const r = c.accion(); if (r && r.catch) r.catch((e) => toast(String(e.message || e))); } catch (e) { toast(String(e.message || e)); }
    }
    inp.addEventListener("input", () => { sel = 0; pintar(); });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(vis.length - 1, sel + 1); marcar(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); marcar(); }
      else if (e.key === "Enter") { e.preventDefault(); if (vis[sel]) correr(vis[sel]); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cerrar(); }
    });
    pintar(); inp.focus();
  }
  ED.paleta = paleta;

  // ================================================================== paneles del lado derecho (contrato)
  const DER = {};
  function marcarDer(id) {
    $$("#der-tabs button").forEach((x) => { const on = (x.dataset.d || x.dataset.dx) === id; x.classList.toggle("activa", on); x.setAttribute("aria-selected", String(on)); });
    $("#der-insp").hidden = id !== "insp"; $("#der-ia").hidden = id !== "ia";
    for (const k of Object.keys(DER)) { const c = $(`#der-x-${k}`); if (c) c.hidden = k !== id; }
  }
  function abrirDer(id) {
    if (id === "insp" || id === "ia") { const b = $(`#der-tabs button[data-d="${id}"]`); if (b) b.click(); return; }
    const d = DER[id]; if (!d) return;
    asegurarTab(id);
    marcarDer(id);
    const c = $(`#der-x-${id}`);
    if (c._montado !== E.pid) { c._montado = E.pid; c.innerHTML = ""; try { d.montar(c, { pid: E.pid, editor: ED }); } catch (e) { console.error(e); c.append(el("div", { class: "vacio-guia" }, el("b", {}, "No se pudo abrir el panel"), el("span", {}, String(e.message || e)))); } }
    else if (d.alMostrar) d.alMostrar(c);
  }
  function asegurarTab(id) {
    const tabs = $("#der-tabs"), d = DER[id]; if (!tabs || !d) return;
    if (!tabs.querySelector(`button[data-dx="${id}"]`)) {
      const b = el("button", { "data-dx": id, role: "tab", "aria-selected": "false", title: d.titulo, html: `${ico(d.icono || "panel-right", 14)}<span>${esc(d.corto || d.titulo)}</span>`, onclick: () => abrirDer(id) });
      tabs.append(b);
      $("#wd-der").append(el("div", { class: "wd-der-cont wd-scroll", id: `der-x-${id}`, role: "tabpanel", hidden: true }));
    }
  }
  ED.panelDerecho = (id, def) => { DER[id] = def; asegurarTab(id); const c = $(`#der-x-${id}`); if (c) c._montado = null; };
  // los paneles registrados antes de montar el editor reciben su pestaña al aparecer #der-tabs
  setInterval(() => { const t = $("#der-tabs"); if (!t) return; for (const id of Object.keys(DER)) if (!t.querySelector(`button[data-dx="${id}"]`)) asegurarTab(id); t.classList.toggle("muchos", t.children.length > 3); }, 700);
  ED.abrirDer = abrirDer;
  window.addEventListener("wdvs:panel-derecho", (e) => { const p = e.detail && e.detail.panel; if (p === "insp" || p === "ia") marcarDer(p); });

  // ================================================================== Guion: edición por texto (A1, A2)
  const G = { d: null, sondeo: null, silencio: lsGet("wded_silencio", 0.7), sel: null };
  async function cargarGuion(c) {
    const r = await pedir(`${pidURL()}/editor/transcripcion?silencio=${G.silencio}`);
    if (!r.ok) return pintarGuion(c, { estado: "error", error: r.d.detail });
    G.d = r.d; pintarGuion(c, r.d);
    if (r.d.estado === "trabajando" && !G.sondeo) G.sondeo = setTimeout(() => { G.sondeo = null; if (c.isConnected) cargarGuion(c); }, 1500);
  }
  async function transcribir(c) {
    const r = await pedir(`${pidURL()}/editor/transcripcion`, { method: "POST", json: {} });
    if (!r.ok) return toast(r.d.detail || "No se pudo transcribir");
    const T = WD().tareas; if (T) T.poner("guion:" + E.pid, { titulo: "Transcribiendo la voz", tipo: "guion", texto: "Para editar el video como un texto", frac: null });
    cargarGuion(c);
  }
  function parrafos(pal) {
    const out = []; let cur = [];
    pal.forEach((p, k) => { if (cur.length && (p.t0 - pal[k - 1].t1 > 1.2 || cur.length > 60)) { out.push(cur); cur = []; } cur.push(k); });
    if (cur.length) out.push(cur);
    return out;
  }
  function pintarGuion(c, d) {
    const T = WD().tareas;
    c.innerHTML = "";
    const cab = el("div", { class: "guion-cab" }, el("b", {}, "Guion"), el("span", { class: "tenue" }, "Borra palabras y el video se corta solo"));
    c.append(cab);
    if (d.estado === "trabajando") {
      c.append(el("div", { class: "vacio-guia" }, el("span", { class: "spinner", "aria-hidden": "true" }), el("b", {}, "Escuchando tu video…"), el("span", {}, `Transcribiendo la voz (${Math.round((d.pct || 0) * 100)} %). Puedes seguir editando.`)));
      return;
    }
    if (d.estado !== "listo") {
      if (T && d.estado === "error") T.terminar("guion:" + E.pid, false, { texto: d.error || "No se pudo transcribir", silenciosa: true });
      c.append(el("div", { class: "vacio-guia" }, el("span", { html: ico("file-text", 28) }), el("b", {}, "Edita tu video como un documento"),
        el("span", {}, d.estado === "error" ? `No se pudo transcribir: ${d.error || ""}` : "Transcribo lo que se dice en tus clips. Luego borra palabras, pausas o muletillas y el video se corta solo."),
        el("button", { class: "bt acento", onclick: () => transcribir(c) }, ic("audio-lines", 14), "Transcribir la voz")));
      return;
    }
    if (T) T.terminar("guion:" + E.pid, true, { texto: "Ya puedes editar el video como texto.", silenciosa: true });
    const pal = d.palabras || [], lim = d.limpieza || { silencios: [], muletillas: [], total_s: 0 };
    const mul = new Set(lim.muletillas.map((m) => `${m[0]}`));
    const barra = el("div", { class: "guion-barra" },
      el("button", { class: "bt chico acento", title: "Quita las pausas largas y las muletillas (eh, este, mmm) de un clic", onclick: () => limpiar(), disabled: !lim.total_s }, ic("sparkles", 13), lim.total_s ? `Quitar silencios y muletillas (−${lim.total_s.toFixed(1)} s)` : "Sin silencios largos"),
      el("button", { class: "bt chico", title: "Subtítulos desde la voz", onclick: (e) => menuSubtitulos(e.currentTarget) }, ic("captions", 13), "Subtítulos"),
      el("button", { class: "ib", title: "Volver a transcribir", "aria-label": "Volver a transcribir", onclick: () => transcribir(c), html: ico("refresh-cw", 14) }));
    c.append(barra);
    if (!pal.length) { c.append(el("div", { class: "vacio-guia" }, el("b", {}, "No encontré voz en los clips de la línea de tiempo"), el("span", {}, "Si tu video sí tiene voz, revisa que el clip tenga audio."))); return; }
    const txt = el("div", { class: "guion-txt", tabindex: "0", "aria-label": "Transcripción: selecciona palabras y pulsa Supr para quitarlas del video" });
    const sil = lim.silencios || [];
    let si = 0;
    for (const par of parrafos(pal)) {
      const p = el("p", {});
      for (const k of par) {
        const w = pal[k];
        while (si < sil.length && sil[si][1] <= w.t0 + 0.2) {   // pausa larga antes de esta palabra
          const s = sil[si++];
          if (s[0] >= (pal[k - 1] ? pal[k - 1].t0 : -1)) p.append(el("span", { class: "pausa", title: "Pausa: clic para quitarla", "data-a": s[0], "data-b": s[1], onclick: (e) => { e.stopPropagation(); hacer({ op: "tramos_quitar", tramos: [[s[0], s[1]]], desc: "quitar una pausa" }).then(() => cargarGuion(c)); } }, `${(s[1] - s[0]).toFixed(1)} s`), " ");
        }
        p.append(el("span", { class: "pal" + (mul.has(`${w.t0}`) ? " muletilla" : ""), "data-k": k, title: mul.has(`${w.t0}`) ? "Muletilla" : "" }, w.w), " ");
      }
      txt.append(p);
    }
    txt.addEventListener("click", (e) => { const s = e.target.closest(".pal"); if (!s || !window.getSelection().isCollapsed) return; ED.ponerT(pal[+s.dataset.k].t0 + 0.001, { seguir: true }); });
    txt.addEventListener("keydown", (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      e.preventDefault(); e.stopPropagation(); quitarSeleccion(c, pal);
    });
    c.append(txt, el("div", { class: "guion-pie tenue" }, `${pal.length} palabras · selecciona y pulsa `, el("kbd", {}, "Supr"), " para cortar"),
      el("div", { class: "guion-acciones" }, el("button", { class: "bt chico", onclick: () => quitarSeleccion(c, pal) }, ic("scissors", 13), "Quitar lo seleccionado")));
    G.txt = txt; G.pal = pal; resaltar(true);
  }
  function palabrasSeleccionadas(pal) {
    const s = window.getSelection(); if (!s || s.isCollapsed || !G.txt || !G.txt.contains(s.anchorNode)) return null;
    const ks = $$(".pal", G.txt).filter((n) => s.containsNode(n, true)).map((n) => +n.dataset.k);
    return ks.length ? [Math.min(...ks), Math.max(...ks)] : null;
  }
  function quitarSeleccion(c, pal) {
    const r = palabrasSeleccionadas(pal);
    if (!r) return toast("Selecciona primero las palabras que quieres quitar", "info", 2500);
    const [i, j] = r, prev = pal[i - 1], next = pal[j + 1];
    const a = Math.max(prev ? prev.t1 : 0, pal[i].t0 - 0.04);
    const b = next ? Math.min(next.t0 - 0.02, pal[j].t1 + Math.min(0.12, (next.t0 - pal[j].t1) / 2)) : pal[j].t1 + 0.1;
    const frase = pal.slice(i, j + 1).map((p) => p.w).join(" ");
    window.getSelection().removeAllRanges();
    hacer({ op: "tramos_quitar", tramos: [[r3(a), r3(b)]], desc: `quitar «${frase.slice(0, 40)}»` }).then((ok) => { if (ok) cargarGuion(c); });
  }
  let rafG = 0, ultK = -1;
  function resaltar(forzar) {
    cancelAnimationFrame(rafG);
    const paso = () => {
      if (!G.txt || !G.txt.isConnected || G.txt.closest("[hidden]")) return;
      const t = E.t, pal = G.pal || [];
      let lo = 0, hi = pal.length - 1, k = -1;
      while (lo <= hi) { const m = (lo + hi) >> 1; if (pal[m].t0 <= t) { k = m; lo = m + 1; } else hi = m - 1; }
      if (k !== ultK || forzar) {
        const a = G.txt.querySelector(".pal.ahora"); if (a) a.classList.remove("ahora");
        const n = k >= 0 && t <= pal[k].t1 + 0.25 ? G.txt.querySelector(`.pal[data-k="${k}"]`) : null;
        if (n) { n.classList.add("ahora"); if (E.reproduciendo) n.scrollIntoView({ block: "nearest" }); }
        ultK = k; forzar = false;
      }
      rafG = requestAnimationFrame(paso);
    };
    rafG = requestAnimationFrame(paso);
  }
  function limpiar() {
    const d = G.d; if (!d) return;
    const cuerpo = el("div", {});
    const m = ED.modal("Quitar silencios y muletillas", cuerpo);
    const pintar = async () => {
      const r = await pedir(`${pidURL()}/editor/transcripcion?silencio=${G.silencio}&muletillas=${chk.checked ? 1 : 0}`);
      if (!r.ok || !r.d.limpieza) return;
      const l = r.d.limpieza;
      res.textContent = `${l.silencios.length} pausa(s) y ${chk.checked ? l.muletillas.length : 0} muletilla(s): el video queda ${l.total_s.toFixed(1)} s más corto.`;
      lista.innerHTML = "";
      for (const x of l.muletillas.slice(0, 12)) if (chk.checked) lista.append(el("span", { class: "chip" }, `«${x[2]}» ${fmtS(x[0])}`));
      ok.disabled = !l.total_s; ok._l = l;
    };
    const rng = el("input", { type: "range", min: "0.3", max: "2", step: "0.1", value: G.silencio, "aria-label": "Pausa mínima a quitar" });
    const val = el("b", {}, `${G.silencio} s`);
    const chk = el("input", { type: "checkbox", checked: true });
    const res = el("div", { class: "nota" }, "Calculando…"), lista = el("div", { class: "chips" });
    const ok = el("button", { class: "bt acento", onclick: async () => {
      const l = ok._l; if (!l) return;
      const tramos = [...l.silencios, ...(chk.checked ? l.muletillas.map((x) => [x[0] - 0.02, x[1] + 0.03]) : [])];
      ED.cerrarModal && ED.cerrarModal(); const mm = $("#wd-modal"); if (mm) mm.remove();
      if (await hacer({ op: "tramos_quitar", tramos, desc: "quitar silencios y muletillas" })) { toast(`Listo: ${l.total_s.toFixed(1)} s menos. Ctrl+Z lo deshace.`, "info", 3500); const c = $("#der-x-guion"); if (c) cargarGuion(c); }
    } }, "Quitar");
    rng.addEventListener("input", () => { G.silencio = +rng.value; val.textContent = `${G.silencio} s`; lsSet("wded_silencio", G.silencio); });
    rng.addEventListener("change", pintar); chk.addEventListener("change", pintar);
    cuerpo.append(el("label", { class: "fila-ctl" }, "Pausas de más de ", val, rng), el("label", { class: "fila-ctl" }, chk, " También muletillas (eh, este, mmm, o sea)"), res, lista,
      el("div", { class: "botones" }, ok, el("button", { class: "bt", onclick: () => m.closest(".wd-modal").remove() }, "Cancelar")));
    pintar();
  }
  async function menuSubtitulos(btn) {
    const b = btn.getBoundingClientRect();
    ED.menu(b.left, b.bottom + 4, [
      ["Estilo reels: 1-3 palabras grandes al centro", () => subtitular("reels")],
      ["Clásicos: renglones abajo", () => subtitular("clasico")],
    ]);
  }
  async function subtitular(estilo) {
    const r = await pedir(`${pidURL()}/editor/subtitulos`, { method: "POST", json: { estilo, max_palabras: 3 } });
    if (!r.ok) return toast(r.d.detail || "No se pudieron crear los subtítulos");
    const items = r.d.items || []; if (!items.length) return toast("No hay voz para subtitular", "info");
    const usados = new Set((E.plan.overlays || []).map((o) => o.id));
    const ops = items.map((it) => ({ op: "lista_nuevo", lista: "overlays", item: { ...it, id: usados.has(it.id) ? it.id + "_" + Date.now().toString(36) : it.id, pista: 3 } }));
    if (await hacer({ op: "lote", ops, desc: `subtítulos ${estilo === "reels" ? "estilo reels" : "clásicos"} (${items.length})` })) toast(`${items.length} subtítulos agregados en la capa V3.`, "info", 3000);
  }
  ED.panelDerecho("guion", { titulo: "Guion: edita el video como texto", corto: "Guion", icono: "file-text", montar: (c) => cargarGuion(c), alMostrar: (c) => cargarGuion(c) });
  ED.subtitular = subtitular;

  // ================================================================== escenas, beats y multicámara (A3, A4, A5)
  async function cortarEscenas(t) {
    if (!t || !t.fuente) return toast("Elige un clip de video", "info");
    const r = await pedir(`${pidURL()}/editor/escenas`, { method: "POST", json: { fuente: t.fuente, g: t.g, k: t.k } });
    if (!r.ok) return toast(r.d.detail || "No se pudo detectar las escenas");
    const ts = r.d.salida || [];
    if (!ts.length) return toast("No encontré cambios de escena en este clip", "info");
    if (await hacer({ op: "cortes_en", tiempos: ts, desc: `cortes en ${ts.length} cambio(s) de escena` })) toast(`${ts.length} corte(s) en los cambios de escena.`, "info", 2500);
  }
  function cortarBeat(a, b, cada) { return hacer({ op: "cortes_beat", a: r3(a), b: r3(b), cada }); }
  function rangoActual() {
    if (E.rango) return E.rango;
    const tomas = E.multi.filter((m) => m.tipo === "toma").map((m) => V().grupos[m.g] && V().grupos[m.g].tomas[m.k]).filter(Boolean);
    if (tomas.length) return [Math.min(...tomas.map((x) => x.t0)), Math.max(...tomas.map((x) => x.t0 + x.dur))];
    return null;
  }
  ED.ganchosMenu.push((items, d) => {
    if (d && d.tipo === "toma") {
      const t = V().grupos[d.g] && V().grupos[d.g].tomas[d.k];
      items.push("-", ["Cortar en cada cambio de escena", () => cortarEscenas(t)]);
    }
    const r = rangoActual() || (d && d.tipo === "toma" ? [d.a, d.b] : null);
    if (r && (V().beats || []).length) items.push(["Cortar al ritmo (cada beat)", () => cortarBeat(r[0], r[1], 1)], ["Cortar al ritmo (cada compás)", () => cortarBeat(r[0], r[1], V().bpc || 4)]);
    // plantillas del agente de marca (docs/marca.md): guardar el rango I/O como plantilla
    if (E.rango && WD().plantillas && WD().plantillas.guardar) items.push(["Guardar este tramo como plantilla", () => WD().plantillas.guardar(E.pid, { desde: E.rango[0], hasta: E.rango[1] })]);
  });

  // multicámara
  const MC = { d: null, vivo: false, marcas: [] };
  async function multicam() {
    const fu = Object.entries(E.fuentes || {}).filter(([, f]) => f.tipo === "video" && f.existe);
    if (fu.length < 2) return toast("Agrega al menos dos videos grabados al mismo tiempo (distintos ángulos)", "info", 4000);
    const prev = (await pedir(`${pidURL()}/editor/multicam`)).d || {};
    const cks = fu.map(([a]) => el("input", { type: "checkbox", value: a, checked: !prev.desfases || a in (prev.desfases || {}) }));
    const res = el("div", { class: "nota" }, prev.desfases ? textoSync(prev) : "Elige los videos de la misma escena grabados desde distintos ángulos.");
    const btn = el("button", { class: "bt acento", onclick: async () => {
      const sel = cks.filter((c) => c.checked).map((c) => c.value);
      if (sel.length < 2) return toast("Elige al menos dos videos", "info");
      btn.disabled = true; res.textContent = "Escuchando el audio de cada video para alinearlos…";
      const r = await pedir(`${pidURL()}/editor/multicam`, { method: "POST", json: { fuentes: sel } });
      btn.disabled = false;
      if (!r.ok) { res.textContent = r.d.detail || "No se pudo sincronizar"; return; }
      MC.d = r.d; res.textContent = textoSync(r.d); vivoBtn.disabled = false;
    } }, ic("audio-waveform", 14), "Sincronizar por audio");
    const vivoBtn = el("button", { class: "bt", disabled: !prev.desfases, onclick: () => { MC.d = MC.d || prev; const mm = $("#wd-modal"); if (mm) mm.remove(); modoVivo(true); } }, ic("video", 14), "Cambiar de ángulo en vivo");
    ED.modal("Multicámara", el("div", { class: "lista-chk" }, ...fu.map(([a, f], i) => el("label", { class: "fila-ctl" }, cks[i], ` ${a} · ${esc(ED.nombreFuente ? ED.nombreFuente(a) : a)}`))), res,
      el("div", { class: "botones" }, btn, vivoBtn), el("div", { class: "nota" }, "En vivo: reproduce y pulsa 1, 2, 3… para cambiar de cámara; al pausar se aplican los cortes. En pausa, la tecla cambia el clip del cabezal."));
  }
  function textoSync(d) {
    return "Sincronizado: " + Object.entries(d.desfases || {}).map(([a, s]) => `${a} ${s >= 0 ? "+" : ""}${s.toFixed(2)} s${d.confianza && d.confianza[a] < 1.5 && a !== d.ref ? " (poco seguro)" : ""}`).join(" · ");
  }
  function modoVivo(on) {
    MC.vivo = on; MC.marcas = [];
    let b = $("#mc-barra");
    if (!on) { if (b) b.remove(); return; }
    const al = Object.keys(MC.d.desfases || {});
    if (!b) { b = el("div", { class: "mc-barra", id: "mc-barra", role: "toolbar", "aria-label": "Ángulos de la multicámara" }); ($("#mon-prog") || document.body).append(b); }
    b.innerHTML = "";
    b.append(el("span", { class: "tenue" }, "Multicámara"), ...al.map((a, i) => el("button", { class: "bt chico", "data-a": a, onclick: () => angulo(a) }, el("kbd", {}, String(i + 1)), ` ${a}`)), el("button", { class: "ib", title: "Salir de la multicámara", "aria-label": "Salir de la multicámara", onclick: () => modoVivo(false), html: ico("x", 14) }));
  }
  function angulo(a) {
    if (!MC.d) return;
    if (E.reproduciendo) { MC.marcas.push([E.t, a]); $$("#mc-barra button[data-a]").forEach((x) => x.classList.toggle("on", x.dataset.a === a)); return; }
    const t = ED.tomaEn(E.t); if (!t) return;
    hacer({ op: "multicam_angulo", a: r3(E.t), b: r3(t.t0 + t.dur), fuente: a, desfases: MC.d.desfases });
  }
  function aplicarMarcas() {
    if (!MC.marcas.length) return;
    const m = MC.marcas.sort((x, y) => x[0] - y[0]); MC.marcas = [];
    const fin = V().total, ops = [];
    m.forEach(([t, a], i) => ops.push({ op: "multicam_angulo", a: r3(t), b: r3(i + 1 < m.length ? m[i + 1][0] : fin), fuente: a, desfases: MC.d.desfases }));
    hacer({ op: "lote", ops: ops.reverse(), desc: `multicámara: ${ops.length} cambio(s) de ángulo` });
  }
  const pausaOrig = ED.pausa;
  setInterval(() => { if (MC.vivo && !E.reproduciendo && MC.marcas.length) aplicarMarcas(); }, 300);
  ED.ganchosTecla.push((e, ctrl, enCampo) => {
    if (ctrl && !e.shiftKey && (e.key === "p" || e.key === "P")) { e.preventDefault(); paleta(); return true; }
    if (ctrl && e.shiftKey && (e.key === "p" || e.key === "P")) { e.preventDefault(); paleta(); return true; }
    if (!enCampo && MC.vivo && !ctrl && /^[1-9]$/.test(e.key)) { const al = Object.keys(MC.d.desfases || {}); const a = al[+e.key - 1]; if (a) { e.preventDefault(); angulo(a); return true; } }
    return false;
  });
  void pausaOrig;

  // ================================================================== proxies automáticos al importar (A6)
  let nMedios = -1;
  setInterval(() => {
    if (!E.abierto || !E.pid || document.hidden) return;
    const n = (E.medios || []).length;
    if (n !== nMedios) { nMedios = n; if (!document.body.classList.contains("wded-ligero")) pedir(`${pidURL()}/editor/proxies_medios?generar=1`); }
  }, 4000);

  // ================================================================== comandos
  const sel = () => E.sel;
  [
    { id: "guion", titulo: "Editar el video como texto (Guion)", grupo: "Edición rápida", icono: "file-text", accion: () => abrirDer("guion"), claves: "transcripcion descript palabras" },
    { id: "silencios", titulo: "Quitar silencios y muletillas", grupo: "Edición rápida", icono: "sparkles", accion: async () => { abrirDer("guion"); if (G.d && G.d.estado === "listo") limpiar(); else toast("Primero transcribe la voz en el panel Guion", "info"); }, claves: "pausas eh este" },
    { id: "escenas", titulo: "Cortar el clip en cada cambio de escena", grupo: "Edición rápida", icono: "scissors", accion: () => cortarEscenas(sel() && sel().tipo === "toma" ? V().grupos[sel().g].tomas[sel().k] : ED.tomaEn(E.t)) },
    { id: "beat", titulo: "Cortar al ritmo de la música (rango o selección)", grupo: "Edición rápida", icono: "music", accion: () => { const r = rangoActual() || [0, V().total]; return cortarBeat(r[0], r[1], 1); }, cuando: () => !!(V() && (V().beats || []).length) },
    { id: "multicam", titulo: "Multicámara: sincronizar ángulos por audio", grupo: "Edición rápida", icono: "video", accion: multicam },
    { id: "sub_reels", titulo: "Subtítulos animados estilo reels", grupo: "Texto", icono: "captions", accion: () => subtitular("reels") },
    { id: "sub_clasico", titulo: "Subtítulos clásicos", grupo: "Texto", icono: "captions", accion: () => subtitular("clasico") },
    { id: "deshacer", titulo: "Deshacer", grupo: "Edición", atajo: "Ctrl+Z", icono: "undo-2", accion: () => ED.deshacer() },
    { id: "rehacer", titulo: "Rehacer", grupo: "Edición", atajo: "Ctrl+Y", icono: "redo-2", accion: () => ED.rehacer() },
    { id: "dividir", titulo: "Dividir en el cabezal", grupo: "Edición", atajo: "S", icono: "split", accion: () => ED.dividir() },
    { id: "duplicar", titulo: "Duplicar la selección", grupo: "Edición", atajo: "Ctrl+D", icono: "copy", accion: () => ED.duplicarSel() },
    { id: "borrar", titulo: "Borrar la selección", grupo: "Edición", atajo: "Supr", icono: "trash-2", accion: () => ED.borrarSel() },
    { id: "texto", titulo: "Texto nuevo en el cabezal", grupo: "Texto", atajo: "T", icono: "type", accion: () => ED.nuevoTexto() },
    { id: "marcador", titulo: "Marcador en el cabezal", grupo: "Edición", atajo: "M", icono: "bookmark", accion: () => ED.marcador() },
    { id: "zoomsel", titulo: "Acercar a la selección", grupo: "Vista", atajo: "Z", icono: "zoom-in", accion: () => ED.zoomSeleccion() },
    { id: "preview", titulo: "Vista previa con efectos", grupo: "Vista", icono: "monitor-play", accion: () => ED.vistaPrevia() },
    { id: "ia", titulo: "Abrir el Asistente IA", grupo: "IA", atajo: "Ctrl+K", icono: "sparkles", accion: () => abrirDer("ia") },
    { id: "inspector", titulo: "Abrir el inspector", grupo: "Vista", icono: "sliders-horizontal", accion: () => abrirDer("insp") },
    { id: "ayuda", titulo: "Atajos de teclado y ayuda", grupo: "Ayuda", atajo: "?", icono: "keyboard", accion: () => ED.ayuda() },
    { id: "simple", titulo: "Cambiar a modo Simple / Avanzado", grupo: "Vista", icono: "toggle-left", accion: () => WD().ponerModo && WD().ponerModo(document.body.classList.contains("modo-simple") ? "avanzado" : "simple") },
  ].forEach(ED.comando);
  // pestañas de la biblioteca
  [["medios", "Medios", "film"], ["textos", "Texto", "type"], ["efectos", "Efectos", "wand-sparkles"], ["transiciones", "Transiciones", "arrow-right-left"], ["audio", "Audio", "music"], ["animar", "Animar", "person-standing"]]
    .forEach(([id, t, i]) => ED.comando({ id: "bib_" + id, titulo: `Ir a la biblioteca: ${t}`, grupo: "Biblioteca", icono: i, accion: () => ED.elegirBib(id) }));
  ED.rapida = { cargarGuion, transcribir, limpiar, cortarEscenas, cortarBeat, multicam, modoVivo, angulo, aplicarMarcas, G, MC };
})();
