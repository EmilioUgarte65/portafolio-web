"use strict";
// Web Studio — Editor: inspector (lo básico primero, lo avanzado plegado), fotogramas clave, plantillas de
// texto y pestañas Texto / Efectos / Transiciones / Audio de la biblioteca. Usa window.WDED (editor.js).
(() => {
  const ED = window.WDED;
  const { E, V, $, el, hacer, toast, fmt, r3, clamp, debounce, humano, llano, nombreFuente } = ED;

  // ================================================================== controles
  function cmp(label, control, ayuda) { return el("div", { class: "cmp", title: ayuda || "" }, el("label", {}, label), control); }
  function inNum(valor, alCambiar, o = {}) {
    const i = el("input", { type: "number", step: o.step ?? "any", min: o.min, max: o.max, placeholder: o.ph ?? "", value: valor ?? "" });
    i.addEventListener("change", () => alCambiar(i.value === "" ? null : Number(i.value)));
    return i;
  }
  // Deslizador + número (se guarda al soltar; `vivo` se llama mientras se arrastra).
  function deslizador(valor, alCambiar, o = {}) {
    const v0 = valor ?? o.defecto ?? o.min ?? 0;
    const f = o.factor || 1;
    const r = el("input", { type: "range", min: o.min, max: o.max, step: o.step ?? 0.01, value: v0, "aria-label": o.etiqueta || "" });
    r.style.setProperty("--p", `${clamp((v0 - o.min) / ((o.max - o.min) || 1), 0, 1) * 100}%`);
    const n = el("input", { type: "number", min: o.min * f, max: o.max * f, step: (o.step ?? 0.01) * f, value: r3(v0 * f), class: "num" });
    r.addEventListener("input", () => { n.value = r3(Number(r.value) * f); if (o.vivo) o.vivo(Number(r.value)); });
    r.addEventListener("change", () => alCambiar(Number(r.value)));
    n.addEventListener("change", () => { if (n.value === "") return alCambiar(null); r.value = Number(n.value) / f; alCambiar(Number(n.value) / f); });
    return el("div", { class: "desl" }, r, n, o.unidad ? el("span", { class: "u" }, o.unidad) : null);
  }
  function inTxt(valor, alCambiar, o = {}) {
    const i = el("input", { type: "text", value: valor ?? "", placeholder: o.ph ?? "" });
    i.addEventListener(o.vivo ? "input" : "change", () => alCambiar(i.value === "" ? null : i.value));
    return i;
  }
  function inSel(opciones, valor, alCambiar, o = {}) {
    const s = el("select", {});
    if (o.vacio !== undefined) s.append(el("option", { value: "" }, o.vacio));
    let hay = false;
    for (const op of opciones) {
      const [v, t, tit] = Array.isArray(op) ? op : [op, humano(op)];
      if (String(v) === String(valor)) hay = true;
      s.append(el("option", { value: v, title: tit || "", selected: String(v) === String(valor) }, t));
    }
    if (!hay && valor !== undefined && valor !== null && valor !== "") s.append(el("option", { value: valor, selected: true }, humano(String(valor))));
    s.addEventListener("change", () => alCambiar(s.value === "" ? null : s.value));
    return s;
  }
  function inBool(valor, alCambiar, texto = "") {
    const c = el("input", { type: "checkbox", checked: !!valor });
    c.addEventListener("change", () => alCambiar(c.checked));
    return el("label", { class: "linea" }, c, texto);
  }
  function botonesSeg(opciones, valor, alCambiar) {
    const c = el("div", { class: "seg" });
    for (const [v, t, tit] of opciones) c.append(el("button", { class: String(v) === String(valor) ? "on" : "", title: tit || "", onclick: () => alCambiar(v) }, t));
    return c;
  }
  function inColor(valor, alCambiar, o = {}) {
    const c = el("input", { type: "color", value: ED.hexDe(valor) });
    c.addEventListener(o.vivo ? "input" : "change", () => alCambiar(c.value.toUpperCase()));
    if (o.vivo && o.alSoltar) c.addEventListener("change", () => o.alSoltar(c.value.toUpperCase()));
    const muestras = el("div", { class: "muestras" });
    for (const h of ["#FFFFFF", "#000000", "#FFD23F", "#FF3E6C", "#3EC7FF", "#3ECF8E"]) muestras.append(el("button", { style: { background: h }, title: h, onclick: () => { c.value = h.toLowerCase(); alCambiar(h); } }));
    return el("div", { class: "linea" }, c, muestras);
  }
  function inFuente(valor, alCambiar) {
    const ops = [];
    for (const [a] of Object.entries({ ...ED.BASE().tipografias, ...(E.plan.tipografias || {}) })) ops.push([a, a === "titulo" ? "Segoe UI Black (títulos)" : humano(a)]);
    for (const f of (E.cat ? E.cat.tipografias : [])) ops.push([f.archivo, `${f.familia}${f.estilo && f.estilo !== "Regular" ? " " + f.estilo : ""}`]);
    return inSel(ops, valor, alCambiar, { vacio: "Segoe UI Black" });
  }
  function boton(txt, fn, cls = "", tit = "") {
    const html = String(txt).startsWith("<");
    return el("button", { class: "bt " + cls, title: tit, "aria-label": html ? tit : undefined, onclick: fn, html: html ? txt : undefined }, html ? null : txt);
  }
  // «avanzado»: plegado y solo visible en modo Avanzado (divulgación progresiva)
  function avanzado(titulo, ...hijos) { return el("details", { class: "av solo-avanzado" }, el("summary", {}, titulo), ...hijos); }
  const seccion = (t) => el("h4", {}, t);
  const X = () => ED.ico("x", 12);
  // Secciones plegables: cada <h4> y lo que le sigue se agrupa en un <details class="plegable">; se recuerda qué
  // secciones cerró el usuario. Lo que va antes del primer título (lo básico) queda siempre visible.
  const PLEGADOS = ED.lsGet("wded_insp_plegados", {});
  function plegar(cont) {
    let sec = null;
    for (const n of [...cont.childNodes]) {
      if (n.nodeType === 1 && n.tagName === "H4") {
        const t = n.textContent;
        sec = el("details", { class: "plegable", open: !PLEGADOS[t] }, el("summary", {}, t), el("div", { class: "cuerpo" }));
        sec.addEventListener("toggle", () => { PLEGADOS[t] = !sec.open; ED.lsSet("wded_insp_plegados", PLEGADOS); });
        n.replaceWith(sec); continue;
      }
      if (sec) sec.lastChild.append(n);
    }
  }
  const COLOR_TIPO = { toma: "video", grupo: "video", overlays: "texto", efectos: "efecto", musica: "musica", sfx: "sfx", flashes: "flash", voz: "voz", clips: "video", marcadores: "musica" };

  // ================================================================== inspector
  function renderInspector() {
    const cont = $("#insp"); if (!cont || !E.plan) return;
    const abiertos = new Set([...cont.querySelectorAll("details[open] > summary")].map((s) => s.textContent));
    const scroll = cont.scrollTop;
    cont.innerHTML = "";
    const s = E.sel;
    let tit = "Proyecto";
    try {
      if (E.multi.length > 1) { tit = `${E.multi.length} elementos`; inspVarios(cont); }
      else if (!s) inspProyecto(cont);
      else if (s.tipo === "toma") { tit = "Clip de video"; inspToma(cont, s); }
      else if (s.tipo === "grupo") { tit = "Escena"; inspGrupo(cont, s.g, true); }
      else if (s.tipo === "overlays" && ED.esEscena(s.i) && ED.inspEscena) { tit = "Animación"; ED.inspEscena(cont, s.i); }
      else if (s.tipo === "overlays") { tit = "Texto / capa"; inspOverlay(cont, s.i); }
      else if (s.tipo === "efectos") { tit = "Efecto"; inspEfectoGlobal(cont, s.i); }
      else if (s.tipo === "musica") { tit = "Música"; inspTramo(cont, s.i); }
      else if (s.tipo === "sfx") { tit = "Sonido"; inspSfx(cont, s.i); }
      else if (s.tipo === "flashes") { tit = "Destello"; inspFlash(cont, s.i); }
      else if (s.tipo === "voz") { tit = "Voz en off"; inspVoz(cont, s.i); }
      else if (s.tipo === "clips") { const cv = (V().clips || [])[s.i]; tit = cv ? { video: "Clip de video", imagen: "Imagen", audio: "Clip de audio", ajuste: "Capa de ajuste", secuencia: "Secuencia anidada" }[cv.tipo] || "Clip" : "Clip"; inspClip(cont, s.i); }
      else if (s.tipo === "marcadores") { tit = "Marcador"; inspMarcador(cont, s.i); }
      // secciones de otros módulos (p. ej. boca y expresión de los personajes): WDVS.registrarSeccionInspector(id, fn)
      for (const [id, f] of Object.entries((window.WDVS && WDVS._seccionesInsp) || {})) {
        try { f(cont, { sel: s, multi: E.multi, editor: ED, actor: ED.anim && ED.anim.actorSel ? ED.anim.actorSel() : null }); } catch (err) { console.error("sección del inspector " + id, err); }
      }
    } catch (e) { cont.append(el("div", { class: "nota" }, `No se pudo mostrar: ${e}`)); console.error(e); }
    plegar(cont);
    for (const d of cont.querySelectorAll("details.av")) if (abiertos.has(d.querySelector("summary").textContent)) d.open = true;
    if (document.body.classList.contains("modo-simple") && cont.querySelector(".solo-avanzado"))
      cont.append(el("button", { class: "btn fantasma chico mas-opciones", onclick: () => window.WDVS && WDVS.ponerModo && WDVS.ponerModo("avanzado"), html: `${ED.ico("sliders-horizontal", 13)} Más opciones en modo Avanzado` }));
    cont.scrollTop = scroll;
    const col = E.multi.length > 1 ? "" : s ? (s.tipo === "overlays" && ED.esEscena(s.i) ? "escena" : COLOR_TIPO[s.tipo] || "") : "";
    $("#insp-tit").innerHTML = `${col ? `<span class="tipo-punto" style="background:var(--clip-${col})"></span>` : ED.ico(E.multi.length > 1 ? "layers" : "clapperboard", 14)}<span>${ED.esc(tit)}</span>`;
  }

  function inspVarios(c) {
    const n = E.multi.length;
    c.append(el("div", { class: "nota" }, `${n} elementos seleccionados. Arrástralos juntos en la línea de tiempo o usa estas acciones.`),
      el("div", { class: "botones" }, boton("Copiar", ED.copiar), boton("Borrar", ED.borrarSel, "peligro"),
        boton("Mover al cabezal", () => {
          const ls = E.multi.filter((s) => !["toma", "grupo"].includes(s.tipo));
          if (!ls.length) return toast("Solo se pueden mover textos, sonidos, efectos y música", "info");
          const t0 = Math.min(...ls.map((s) => { const it = ED.listaVista(s.tipo)[s.i]; return s.tipo === "overlays" ? it.t_in : s.tipo === "sfx" ? it.t : (it.en ?? it.desde); }));
          hacer({ op: "lote", desc: "mover al cabezal", ops: ls.map((s) => ({ op: "lista_mover", lista: s.tipo, i: s.i, delta: r3(E.t - t0) })) }, { mantenerSel: true });
        }), boton("Acercar a la selección", ED.zoomSeleccion)));
    const ovs = E.multi.filter((s) => s.tipo === "overlays");
    if (ovs.length > 1) {
      c.append(seccion("Textos seleccionados"),
        cmp("Animación", inSel(animsTexto(), "", (x) => x && hacer({ op: "lote", desc: "animación", ops: ovs.map((s) => ({ op: "lista_props", lista: "overlays", i: s.i, props: { anim: x } })) }, { mantenerSel: true }), { vacio: "— cambiar a todos —" })),
        cmp("Capa", inSel([1, 2, 3, 4].map((p) => [p, `V${p + 1}`]), "", (x) => x && hacer({ op: "lote", desc: "capa", ops: ovs.map((s) => ({ op: "lista_props", lista: "overlays", i: s.i, props: { pista: Number(x) === 1 ? null : Number(x) } })) }, { mantenerSel: true }), { vacio: "— mover a —" })));
    }
  }

  function inspProyecto(c) {
    const v = V(), pr = E.plan.proyecto || {}, lk = pr.look || {}, m = E.plan.musica || {};
    const setP = (props) => hacer({ op: "seccion_props", seccion: "proyecto", props }, { reInsp: false });
    const setL = (props) => hacer({ op: "seccion_props", seccion: "proyecto.look", props }, { reInsp: false });
    const vivoLook = (k) => (x) => { const a = $("#visor .img-area"); if (!a) return; const l = { contraste: lk.contraste ?? 1, saturacion: lk.saturacion ?? 1, brillo: lk.brillo ?? 0, [k]: x }; a.style.filter = `contrast(${l.contraste}) saturate(${l.saturacion}) brightness(${1 + l.brillo})`; };
    c.append(el("div", { class: "nota" }, `${v.W}×${v.H} · ${v.fps} cuadros/s · ${fmt(v.total)} · ${ED.tomasPlanas().length} clips`),
      el("div", { class: "nota" }, "Selecciona un clip, un texto o un sonido para editarlo. Sin selección ajustas el aspecto de todo el video."),
      seccion("Color de todo el video"),
      cmp("Contraste", deslizador(lk.contraste ?? 1, (x) => setL({ contraste: x }), { min: 0.5, max: 1.8, step: 0.01, vivo: vivoLook("contraste") })),
      cmp("Saturación", deslizador(lk.saturacion ?? 1, (x) => setL({ saturacion: x }), { min: 0, max: 2, step: 0.01, vivo: vivoLook("saturacion") })),
      cmp("Brillo", deslizador(lk.brillo ?? 0, (x) => setL({ brillo: x }), { min: -0.3, max: 0.3, step: 0.01, vivo: vivoLook("brillo") })),
      cmp("Viñeta", inBool(lk.vineta, (x) => setL({ vineta: x || null }), " oscurecer las orillas")),
      seccion("Inicio y final"),
      cmp("Aparecer desde negro", deslizador(pr.fundido_entrada ?? 0.3, (x) => setP({ fundido_entrada: x }), { min: 0, max: 3, step: 0.05, unidad: "s" })),
      cmp("Terminar a negro", deslizador(pr.fundido_salida ?? 1.3, (x) => setP({ fundido_salida: x }), { min: 0, max: 5, step: 0.05, unidad: "s" })),
      avanzado("Ritmo de la música",
        cmp("Pulsos por minuto", inNum(m.bpm, (x) => hacer({ op: "seccion_props", seccion: "musica", props: { bpm: x } }, { reInsp: false }), { min: 1 }), "BPM: para que el imán se pegue a los golpes de la música"),
        cmp("Primer golpe (s)", inNum(m.primer_beat, (x) => hacer({ op: "seccion_props", seccion: "musica", props: { primer_beat: x } }, { reInsp: false }), { ph: 0, step: 0.001 })),
        cmp("Volumen general", deslizador(m.volumen ?? 1, (x) => hacer({ op: "seccion_props", seccion: "musica", props: { volumen: x } }, { reInsp: false }), { min: 0, max: 2, step: 0.05, factor: 100, unidad: "%" }))));
    if (E.errores.length) c.append(avanzado(`⚠ ${E.errores.length} problema(s) por revisar`, ...E.errores.map((x) => el("div", { class: "nota err" }, "• " + llano(x)))));
  }

  // ----------------------------------------------------------------- clip de video
  const MOVS = [["fijo", "Fija"], ["push", "Acercar lento"], ["pull", "Alejar lento"], ["pan_der", "Paneo a la derecha"], ["pan_izq", "Paneo a la izquierda"], ["pan_arriba", "Paneo hacia arriba"], ["pan_abajo", "Paneo hacia abajo"]];
  function inspToma(c, s) {
    const x = V().grupos[s.g] && V().grupos[s.g].tomas[s.k];
    if (!x) { c.append(el("div", { class: "nota" }, "El clip ya no existe")); return; }
    const t = ED.tomaCruda(s.g, s.k);
    const enSerie = x.si !== null && x.si !== undefined;
    const set = (props, opc = {}) => hacer({ op: "toma_props", g: s.g, k: s.k, props, toda_serie: enSerie && E.todaSerie }, { reInsp: false, ...opc });
    const setEstr = (props) => hacer({ op: "toma_props", g: s.g, k: s.k, props, toda_serie: enSerie && E.todaSerie });
    c.append(el("div", { class: "nota" }, `${fmt(x.t0)} → ${fmt(x.t0 + x.dur)} · ${x.dur.toFixed(2)} s`));
    const videos = ED.aliasDe("video");
    c.append(
      cmp("Video", inSel(videos.map((a) => [a, nombreFuente(a)]), t.fuente, (v) => set({ fuente: v }), { vacio: t.negro ? "(pantalla negra)" : "—" })),
      cmp("Empieza en", inNum(t.inicio, (v) => set({ inicio: v }), { min: 0, step: 0.04 }), "Segundo del video original donde empieza el clip"),
      cmp("Duración (s)", inNum(r3(x.dur), (v) => v && setEstr({ dur: v }), { min: 0.034, step: 0.01 })));
    const mf = el("input", { type: "checkbox", checked: true });
    c.append(seccion("Velocidad"),
      cmp("Velocidad", deslizador(t.rampa ? t.rampa.v1 : (t.velocidad ?? 1), (v) => v && hacer({ op: "toma_velocidad", g: s.g, k: s.k, velocidad: v, mantener_fuente: mf.checked, toda_serie: enSerie && E.todaSerie }), { min: 0.1, max: 4, step: 0.05, unidad: "x" }), "0.5 = cámara lenta · 2 = el doble de rápido"),
      el("label", { class: "linea nota" }, mf, " Mantener el mismo tramo del video (cambia la duración)"));
    c.append(seccion("Movimiento de cámara"),
      cmp("Movimiento", inSel(MOVS, t.movimiento || "fijo", (v) => set({ movimiento: v === "fijo" ? null : v, zoom: null, pan_x: null, pan_y: null }))),
      cmp("Intensidad", deslizador(t.intensidad ?? 1, (v) => set({ intensidad: v }), { min: 0, max: 3, step: 0.1 })));
    editorKeyframes(c, "toma", s, x, t.keyframes || []);
    if (enSerie) c.append(inBool(E.todaSerie, (v) => { E.todaSerie = v; }, " Aplicar los cambios a todos los clips de este montaje rápido"));
    c.append(avanzado("Más opciones del clip",
      cmp("Zoom inicio → fin", par(t.zoom, (v) => set({ zoom: v }), ["1.0", "1.0"]), "1 = sin zoom"),
      cmp("Paneo horizontal", par(t.pan_x, (v) => set({ pan_x: v }), ["0", "0"]), "-1 izquierda … 1 derecha"),
      cmp("Paneo vertical", par(t.pan_y, (v) => set({ pan_y: v }), ["0", "0"])),
      cmp("Sacudida", deslizador(t.shake || 0, (v) => set({ shake: v || null }), { min: 0, max: 80, step: 2, unidad: "px" }), "Golpe de cámara al inicio del clip"),
      cmp("Congelar imagen", inBool(t.congelar, (v) => set({ congelar: v || null }))),
      cmp("Desenfocar fondo", deslizador(t.desenfoque === true ? 18 : (t.desenfoque || 0), (v) => set({ desenfoque: v || null }), { min: 0, max: 60, step: 1 })),
      cmp("Fundido a negro", deslizador(t.oscurecer || 0, (v) => set({ oscurecer: v || null }), { min: 0, max: Math.max(0.1, x.dur - 0.05), step: 0.05, unidad: "s" }), "Al final del clip"),
      cmp("Cámara lenta progresiva", inBool(!!t.rampa, (on) => setEstr(on ? { rampa: { v1: t.velocidad || 1, v2: 0.4, cambio: r3(x.dur / 2) } } : { rampa: null, velocidad: t.rampa ? t.rampa.v1 : null }))),
      t.rampa ? cmp("Velocidad final", deslizador(t.rampa.v2, (v) => set({ rampa: { ...t.rampa, v2: v } }), { min: 0.1, max: 4, step: 0.05, unidad: "x" })) : null,
      t.rampa ? cmp("Cambia en (s)", inNum(t.rampa.cambio, (v) => v !== null && set({ rampa: { ...t.rampa, cambio: v } }), { min: 0, step: 0.05 })) : null,
      E.plan.voz ? cmp("Voz del clip", inBool(t.voz !== false, (v) => set({ voz: v ? null : false }), " se escucha")) : null,
      cmp("Pantalla negra", inBool(t.negro, (v) => setEstr(v ? { negro: true, fuente: null, inicio: null } : { negro: null, fuente: videos[0], inicio: 0 })))));
    c.append(seccion("Efectos del clip"));
    editorEfectos(c, t.efectos || [], { op: "efecto", g: s.g, k: s.k, donde: "toma", toda_serie: enSerie && E.todaSerie });
    c.append(el("div", { class: "botones" }, boton("Dividir en el cabezal", ED.dividir), boton("Duplicar", ED.duplicarSel), boton("Borrar", ED.borrarSel, "peligro"),
      !t.negro && ED.pro ? boton(`${ED.ico("activity", 13)} Estabilizar`, () => ED.pro.estabilizar({ tipo: "toma", g: s.g, k: s.k }), "", "Quita la vibración de la cámara (vid.stab, como el Warp Stabilizer de Premiere)") : null,
      s.k > 0 ? boton("Separar escena aquí", () => hacer({ op: "grupo_dividir", g: s.g, k: s.k }), "", "Este clip y los siguientes pasan a una escena nueva (para ponerle una transición)") : null));
    inspGrupo(c, s.g, false);
  }
  function par(valor, alCambiar, ph) {
    const v = Array.isArray(valor) ? valor : ["", ""];
    const a = el("input", { type: "number", step: "0.01", value: v[0] ?? "", placeholder: ph[0] });
    const b = el("input", { type: "number", step: "0.01", value: v[1] ?? "", placeholder: ph[1] });
    const f = () => alCambiar(a.value === "" && b.value === "" ? null : [Number(a.value || ph[0]), Number(b.value || ph[1])]);
    a.addEventListener("change", f); b.addEventListener("change", f);
    return el("div", { class: "par" }, a, el("span", {}, "→"), b);
  }
  function transiciones() { return (E.cat ? E.cat.transiciones : []).map((t) => [t.nombre, humano(t.nombre), t.desc]); }
  function inspGrupo(c, g, completo) {
    const gr = E.plan.timeline[g]; const vg = V().grupos[g]; if (!gr) return;
    const set = (props) => hacer({ op: "grupo_props", g, props }, { reInsp: false });
    c.append(seccion(completo ? "Escena" : `Escena "${vg.etiqueta || "Escena " + (g + 1)}"`));
    if (completo) c.append(el("div", { class: "nota" }, `${fmt(vg.t0)} → ${fmt(vg.t0 + vg.dur)} · ${vg.tomas.length} clips`), cmp("Nombre", inTxt(gr.etiqueta, (v) => set({ etiqueta: v }), { ph: `Escena ${g + 1}` })));
    if (g > 0) {
      const tr = vg.transicion;
      c.append(cmp("Transición de entrada", inSel(transiciones(), tr ? tr.tipo : "", (v) => hacer({ op: "grupo_props", g, props: { transicion: v ? { tipo: v, dur: tr ? tr.dur : 0.4 } : null } }), { vacio: "Corte directo" })));
      if (tr) c.append(cmp("Duración", deslizador(tr.dur, (v) => v && set({ transicion: { tipo: tr.tipo, dur: v } }), { min: 0.05, max: 2, step: 0.05, unidad: "s" })));
    }
    if (completo) {
      c.append(seccion("Efectos de toda la escena"));
      editorEfectos(c, gr.efectos || [], { op: "efecto", g, k: 0, donde: "grupo" });
      c.append(el("div", { class: "botones" }, g > 0 ? boton("Unir con la escena anterior", () => hacer({ op: "grupo_unir", g })) : null, boton("Borrar escena", ED.borrarSel, "peligro")));
    }
  }

  // ----------------------------------------------------------------- efectos (humanos: nombre, descripción, deslizadores)
  function editorEfectos(c, lista, base) {
    lista.forEach((e, j) => {
      const nombre = typeof e === "string" ? e : (e.efecto || e.preset);
      const dat = typeof e === "string" ? {} : e;
      const def = ED.catEfecto(nombre);
      const setE = (props) => hacer({ ...base, op: "efecto_props", j, props }, { reInsp: false });
      const caja = el("div", { class: "fx" }, el("div", { class: "cab" }, el("span", {}, humano(nombre)), boton(X(), () => hacer({ ...base, op: "efecto_borrar", j }), "chico solo-ico", "Quitar efecto")));
      if (def && def.desc) caja.append(el("div", { class: "nota" }, def.desc));
      const p = el("div", {});
      if (!def && /@/.test(nombre) && window.WDVS && WDVS.plugins && WDVS.plugins.controles) {   // efecto plugin (docs/plugins.md §9)
        WDVS.plugins.listar("efecto").then((ls) => { const pl = (ls || []).find((x) => x.ref === nombre || nombre.split("@")[0] === x.id); if (pl) { caja.querySelector(".nota") || caja.append(el("div", { class: "nota" }, pl.descripcion || "")); WDVS.plugins.controles(p, pl.parametros || [], dat, (nuevos) => setE(nuevos)); } }).catch(() => {});
      } else paramsEfecto(p, def, dat, setE);
      caja.append(avanzado("Ajustes", p));
      c.append(caja);
    });
    c.append(selectorEfecto((nombre) => hacer({ ...base, op: "efecto_agregar", efecto: nombre })));
  }
  function paramsEfecto(caja, def, dat, setE) {
    const params = def && !def.preset ? def.params : [
      { k: "intensidad", tipo: "num", defecto: 1, min: 0, max: 3, desc: "Fuerza del efecto" }, { k: "desde", tipo: "num", desc: "Segundo donde empieza" }, { k: "hasta", tipo: "num", desc: "Segundo donde termina" }];
    for (const p of params || []) {
      const v = dat[p.k];
      let ctl;
      if (p.tipo === "bool") ctl = inBool(v ?? p.defecto, (x) => setE({ [p.k]: x }));
      else if (p.tipo === "enum") ctl = inSel((p.opciones || []).map((o) => [o, humano(o)]), v ?? p.defecto, (x) => setE({ [p.k]: x }));
      else if (p.tipo === "color") ctl = inColor(v || p.defecto, (x) => setE({ [p.k]: x }));
      else if ((p.tipo === "num" || p.tipo === "int") && p.min !== undefined && p.max !== undefined) ctl = deslizador(v ?? p.defecto, (x) => setE({ [p.k]: p.tipo === "int" ? Math.round(x) : x }), { min: p.min, max: p.max, step: p.tipo === "int" ? 1 : (p.max - p.min) / 100 });
      else if (p.tipo === "num" || p.tipo === "int") ctl = inNum(v, (x) => setE({ [p.k]: x }), { ph: p.defecto ?? "", step: p.tipo === "int" ? 1 : "any" });
      else if (p.tipo === "str") ctl = inTxt(v, (x) => setE({ [p.k]: x }), { ph: p.defecto ?? "" });
      else continue;       // listas u objetos: solo desde la IA
      caja.append(cmp(humano(p.k), ctl, p.desc));
    }
  }
  function selectorEfecto(alElegir) {
    const s = el("select", { class: "agregar" }, el("option", { value: "" }, "+ Agregar efecto…"));
    if (E.cat) {
      const og = el("optgroup", { label: "Combinaciones" }); for (const p of E.cat.presets) og.append(el("option", { value: p.nombre, title: p.desc }, humano(p.nombre))); s.append(og);
      for (const [cat, tit] of Object.entries(E.cat.categorias || {})) {
        const g = el("optgroup", { label: tit });
        for (const e of E.cat.efectos.filter((x) => x.categoria === cat)) g.append(el("option", { value: e.nombre, title: e.desc }, humano(e.nombre)));
        s.append(g);
      }
    }
    s.addEventListener("change", () => { if (s.value) alElegir(s.value); s.value = ""; });
    return s;
  }

  // ----------------------------------------------------------------- textos (con texto en vivo)
  function animsTexto() {
    const a = E.cat ? E.cat.anims.filter((x) => (E.cat.anims_schema || []).includes(x.nombre)) : [{ nombre: "fade" }];
    return a.map((x) => [x.nombre, humano(x.nombre), x.desc]);
  }
  function inspOverlay(c, i) {
    const o0 = (E.plan.overlays || [])[i]; if (!o0) return;
    if (!E.borrador || E.borrador.i !== i) E.borrador = { i, cambios: {}, estilo: {}, vueloC: {}, vueloE: {} };
    const B = E.borrador;
    const cur = () => (E.plan.overlays || [])[i] || o0;
    const o = () => ({ ...cur(), ...B.vueloC, ...B.cambios });
    const tipo = "texto" in o0 ? "texto" : "imagen" in o0 ? "imagen" : "resplandor";
    const nomEst = o0.estilo;
    const est = () => { const n = cur().estilo; return { ...(n ? ED.estilosTodos()[n] || {} : {}), ...B.vueloE, ...B.estilo }; };
    const guardar = debounce(() => {
      const cam = B.cambios, es = B.estilo;
      B.cambios = {}; B.estilo = {}; B.vueloC = { ...B.vueloC, ...cam }; B.vueloE = { ...B.vueloE, ...es };
      const ops = [];
      if (Object.keys(cam).length) ops.push({ op: "lista_props", lista: "overlays", i, props: cam });
      if (Object.keys(es).length) ops.push({ op: "estilo_propio", i, props: es });
      if (!ops.length) return;
      hacer(ops.length === 1 ? ops[0] : { op: "lote", desc: "texto", ops }, { reInsp: false, mantenerSel: true }).then(() => { B.vueloC = {}; B.vueloE = {}; });
    }, 600);
    const vivo = debounce(() => textoVivo(i, o(), B), 120);
    const cambio = (props) => { Object.assign(B.cambios, props); vivo(); guardar(); };
    const cambioEst = (props) => { Object.assign(B.estilo, props); vivo(); guardar(); };
    const v = V().overlays[i];
    if (tipo === "texto") {
      const ta = el("textarea", { class: "texto-grande", rows: 2 }, o0.texto);
      ta.addEventListener("input", () => cambio({ texto: ta.value }));
      c.append(ta);
      const e = est();
      const estilos = ED.estilosTodos();
      c.append(
        cmp("Estilo", inSel(Object.keys(estilos).filter((k) => !k.startsWith("propio_") || k === nomEst).map((k) => [k, humano(k)]), nomEst, (x) => hacer({ op: "lista_props", lista: "overlays", i, props: { estilo: x } }), { vacio: "Sin estilo" })),
        cmp("Fuente", inFuente(o().tipografia ?? e.tipografia, (x) => cambio({ tipografia: x }))),
        cmp("Tamaño", deslizador(o().tamano ?? e.tamano ?? 120, (x) => cambio({ tamano: Math.round(x) }), { min: 12, max: 400, step: 1, unidad: "px", vivo: (x) => cambio({ tamano: Math.round(x) }) })),
        cmp("Color", inColor(o().color ?? e.color ?? "blanco", (x) => cambio({ color: x }), { vivo: true })),
        cmp("Alineación", botonesSeg([["izquierda", "⟸", "Izquierda"], ["centro", "≡", "Centro"], ["derecha", "⟹", "Derecha"]], e.alineacion || "centro", (x) => { cambioEst({ alineacion: x === "centro" ? null : x }); cambio({ alinear: x === "centro" ? null : x }); renderInspector(); })));
      const rs = e.resplandor || null, cj = e.caja || null, dg = e.degradado || null;
      c.append(avanzado("Resplandor (brillo alrededor)",
        cmp("Activar", inBool(!!rs, (on) => { cambioEst({ resplandor: on ? { color: ED.hexDe(e.color || "#FFD23F"), radio: Math.round((e.tamano || 120) / 6), opacidad: 0.8 } : null }); setTimeout(renderInspector, 50); })),
        rs ? cmp("Color", inColor(rs.color || e.color, (x) => cambioEst({ resplandor: { ...est().resplandor, color: x } }))) : null,
        rs ? cmp("Tamaño", deslizador(rs.radio ?? 20, (x) => cambioEst({ resplandor: { ...est().resplandor, radio: Math.round(x) } }), { min: 0, max: 80, step: 1, unidad: "px" })) : null,
        rs ? cmp("Intensidad", deslizador(rs.opacidad ?? 0.8, (x) => cambioEst({ resplandor: { ...est().resplandor, opacidad: x } }), { min: 0, max: 1, step: 0.05, factor: 100, unidad: "%" })) : null));
      c.append(avanzado("Contorno y sombra",
        cmp("Contorno", deslizador(e.borde ?? Math.max(4, Math.floor((o().tamano ?? e.tamano ?? 120) / 16)), (x) => cambioEst({ borde: Math.round(x) }), { min: 0, max: 30, step: 1, unidad: "px" })),
        cmp("Color contorno", inColor(e.borde_color ?? "#0A0A14", (x) => cambioEst({ borde_color: x }))),
        cmp("Sombra", inBool(e.sombra !== false, (x) => cambioEst({ sombra: x ? null : false }))),
        cmp("Opacidad sombra", deslizador(e.sombra_opacidad ?? 0.784, (x) => cambioEst({ sombra_opacidad: x }), { min: 0, max: 1, step: 0.05, factor: 100, unidad: "%" }))));
      c.append(avanzado("Espaciado, degradado y fondo",
        cmp("Entre letras", deslizador(e.espaciado ?? 0, (x) => cambioEst({ espaciado: x || null }), { min: -10, max: 60, step: 1, unidad: "px" })),
        cmp("Entre líneas", deslizador(e.interlineado ?? 1, (x) => cambioEst({ interlineado: x === 1 ? null : x }), { min: 0.6, max: 2.5, step: 0.05 }), "Para textos de varias líneas (Enter en el texto)"),
        cmp("Degradado", inBool(!!dg, (on) => { cambioEst({ degradado: on ? { desde: ED.hexDe(e.color || "#FFFFFF"), hasta: "#FFD23F", angulo: 90 } : null }); setTimeout(renderInspector, 50); })),
        dg ? cmp("Colores", el("div", { class: "linea" }, inColor(dg.desde, (x) => cambioEst({ degradado: { ...est().degradado, desde: x } })), inColor(dg.hasta, (x) => cambioEst({ degradado: { ...est().degradado, hasta: x } })))) : null,
        dg ? cmp("Ángulo", deslizador(dg.angulo ?? 90, (x) => cambioEst({ degradado: { ...est().degradado, angulo: Math.round(x) } }), { min: 0, max: 360, step: 5, unidad: "°" })) : null,
        cmp("Caja de fondo", inBool(!!cj, (on) => { cambioEst({ caja: on ? { color: "#000000", opacidad: 0.6, relleno: Math.round((e.tamano || 120) / 4), radio: 12 } : null }); setTimeout(renderInspector, 50); })),
        cj ? cmp("Color caja", inColor(cj.color || "#000000", (x) => cambioEst({ caja: { ...est().caja, color: x } }))) : null,
        cj ? cmp("Opacidad caja", deslizador(cj.opacidad ?? 0.6, (x) => cambioEst({ caja: { ...est().caja, opacidad: x } }), { min: 0, max: 1, step: 0.05, factor: 100, unidad: "%" })) : null,
        cj ? cmp("Esquinas", deslizador(cj.radio ?? 12, (x) => cambioEst({ caja: { ...est().caja, radio: Math.round(x) } }), { min: 0, max: 80, step: 1, unidad: "px" })) : null));
    } else if (tipo === "imagen") {
      c.append(cmp("Imagen", inSel(ED.aliasDe("imagen").map((a) => [a, nombreFuente(a)]), o0.imagen, (x) => cambio({ imagen: x }))),
        cmp("Ancho", deslizador(o0.ancho ?? 600, (x) => cambio({ ancho: Math.round(x) }), { min: 20, max: V().W, step: 2, unidad: "px" })));
    } else {
      const r = o0.resplandor || {};
      c.append(cmp("Intensidad", deslizador(r.opacidad ?? 0.85, (x) => cambio({ resplandor: { ...r, opacidad: x } }), { min: 0, max: 1, step: 0.05, factor: 100, unidad: "%" })),
        cmp("Suavidad", deslizador(r.desenfoque ?? 120, (x) => cambio({ resplandor: { ...r, desenfoque: Math.round(x) } }), { min: 0, max: 300, step: 5 })));
    }
    // transformar
    c.append(seccion("Transformar"),
      cmp("Escala", deslizador(o0.escala ?? 1, (x) => hacer({ op: "lista_props", lista: "overlays", i, props: { escala: x === 1 ? null : x } }, { reInsp: false }), { min: 0.1, max: 4, step: 0.01, factor: 100, unidad: "%" })),
      cmp("Opacidad", deslizador(o0.opacidad ?? 1, (x) => hacer({ op: "lista_props", lista: "overlays", i, props: { opacidad: x === 1 ? null : x } }, { reInsp: false }), { min: 0, max: 1, step: 0.01, factor: 100, unidad: "%" })),
      cmp("Rotación", deslizador(o0.rotacion ?? 0, (x) => hacer({ op: "lista_props", lista: "overlays", i, props: { rotacion: x || null } }, { reInsp: false }), { min: -180, max: 180, step: 1, unidad: "°" })),
      cmp("Capa", inSel([1, 2, 3, 4, 5].map((p) => [p, `V${p + 1}${p === 1 ? " (textos)" : ""}`]), o0.pista || 1, (x) => hacer({ op: "lista_props", lista: "overlays", i, props: { pista: Number(x) === 1 ? null : Number(x) } })), "Las capas más altas se dibujan encima"),
      el("div", { class: "nota" }, "Arrastra el texto en el visor para moverlo."),
      el("div", { class: "botones pos" }, ...[["arriba", "Arriba"], ["centro", "Centro"], ["tercio_inferior", "Tercio inferior"], ["barra_inferior", "Abajo"]].filter(([p]) => V().posiciones[p] !== undefined).map(([p, s]) =>
        boton(s, () => hacer({ op: "lista_props", lista: "overlays", i, props: { pos: p, x: null, dy: null, dx: null, alinear: null } }), "chico"))));
    editorKeyframes(c, "overlays", { i }, v, o0.keyframes || []);
    // animación y tiempo
    c.append(seccion("Animación y tiempo"),
      cmp("Entrada", inSel(animsTexto(), o0.anim || "fade", (x) => cambio({ anim: x }))),
      cmp("Aparece en", inNum(o0.t_in, (x) => x !== null && hacer({ op: "lista_props", lista: "overlays", i, props: { t_in: x } }, { reInsp: false }), { min: 0, step: 0.05 })),
      cmp("Desaparece en", inNum(o0.t_out === "fin" ? null : o0.t_out, (x) => hacer({ op: "lista_props", lista: "overlays", i, props: { t_out: x === null ? "fin" : x } }, { reInsp: false }), { ph: "al final", min: 0, step: 0.05 })),
      el("div", { class: "botones" },
        boton("Aparecer en el cabezal", () => hacer({ op: "lista_mover", lista: "overlays", i, a: r3(E.t) }), "chico"),
        boton("Terminar en el cabezal", () => E.t > v.t_in && hacer({ op: "lista_props", lista: "overlays", i, props: { t_out: r3(E.t) } }), "chico")),
      el("div", { class: "botones" }, boton("Duplicar", ED.duplicarSel), boton("Borrar", ED.borrarSel, "peligro")));
    if (E.t < v.t_in || E.t >= v.t_out) ED.ponerT(Math.min(v.t_out - 0.02, v.t_in + Math.min(0.6, (v.t_out - v.t_in) / 2)));
  }
  let vivoN = 0;
  async function textoVivo(i, o, B) {
    const n = ++vivoN;
    o = Object.fromEntries(Object.entries(o).filter(([, x]) => x !== null && x !== undefined));
    const est = {};
    const pend = { ...B.vueloE, ...B.estilo };
    if (Object.keys(pend).length) {
      est.__vivo = { ...(ED.estilosTodos()[o.estilo] || {}), ...pend };
      for (const [k, x] of Object.entries(est.__vivo)) if (x === null) delete est.__vivo[k];
      o = { ...o, estilo: "__vivo" };
    }
    const tr = E.t - o.t_in;
    const r = await fetch(`${ED.pidURL()}/editor/texto`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ overlay: o, i, t_rel: tr >= 0 ? tr : null, estilos: est }) });
    if (n !== vivoN) return;
    if (!r.ok) { const d = await r.json().catch(() => ({})); E.vivo = null; toast(`Texto: ${llano(d.detail || r.statusText)}`); return; }
    const geom = JSON.parse(r.headers.get("X-Geom") || "{}");
    const url = URL.createObjectURL(await r.blob());
    if (E.vivo && E.vivo.url) URL.revokeObjectURL(E.vivo.url);
    const vo = V().overlays[i] || {};
    E.vivo = { i, url, geom, t_in: vo.t_in ?? o.t_in, t_out: vo.t_out ?? o.t_out };
    ED.colocarOverlays();
  }

  // ----------------------------------------------------------------- fotogramas clave
  const PROPS_KF = {
    overlays: [["dx", "Mover X", -1920, 1920, 1, "px"], ["dy", "Mover Y", -1080, 1080, 1, "px"], ["escala", "Escala", 0.1, 4, 0.01, "x"], ["opacidad", "Opacidad", 0, 1, 0.01, ""], ["rotacion", "Rotación", -360, 360, 1, "°"]],
    toma: [["zoom", "Zoom", 1, 3, 0.01, "x"], ["pan_x", "Paneo X", -1, 1, 0.01, ""], ["pan_y", "Paneo Y", -1, 1, 0.01, ""]],
  };
  const EASES = [["suave", "Suave"], ["lineal", "Lineal"], ["entrada", "Acelera"], ["salida", "Frena"], ["mantener", "Salto (sin transición)"]];
  function valoresEn(tipo, x, tl) {
    if (tipo === "toma") { const c = ED.camToma(x, tl); return { zoom: r3(c.z), pan_x: r3(c.px), pan_y: r3(c.py) }; }
    const o = { tf: { escala: x.escala, opacidad: x.opacidad, rotacion: x.rotacion, keyframes: x.keyframes }, t_in: x.t_in, t_out: x.t_out };
    const tr = ED.tfOverlay(o, tl, false);
    return { dx: Math.round(tr.dx), dy: Math.round(tr.dy), escala: r3(tr.escala), opacidad: r3(tr.opacidad), rotacion: r3(tr.rotacion) };
  }
  function guardarKf(tipo, s, kfs) {
    kfs = [...kfs].sort((a, b) => a.t - b.t);
    const val = kfs.length ? kfs : null;
    if (tipo === "toma") return hacer({ op: "toma_props", g: s.g, k: s.k, props: { keyframes: val } });
    return hacer({ op: "lista_props", lista: "overlays", i: s.i, props: { keyframes: val } });
  }
  function editorKeyframes(c, tipo, s, x, kfs) {
    const t0 = tipo === "toma" ? x.t0 : x.t_in, dur = tipo === "toma" ? x.dur : x.t_out - x.t_in;
    const tl = r3(clamp(E.t - t0, 0, dur));
    const dentro = E.t >= t0 - 1e-6 && E.t <= t0 + dur + 1e-6;
    const caja = el("div", { class: "kf-caja solo-avanzado" });
    caja.append(el("div", { class: "kf-cab" }, el("b", { html: `${ED.ico("diamond", 13)} Fotogramas clave` }),
      boton(`${ED.ico("plus", 13)} Añadir en el cabezal`, () => agregar(), "chico acento", dentro ? "Guarda los valores actuales en este instante" : "Mueve el cabezal dentro del clip")));
    const agregar = (extra = {}) => {
      if (!dentro) return toast("Pon el cabezal dentro del clip", "info");
      const actual = valoresEn(tipo, x, tl);
      const otros = kfs.filter((k) => Math.abs(k.t - tl) > 1 / 60);
      const previo = kfs.find((k) => Math.abs(k.t - tl) <= 1 / 60);
      const nuevo = { ...actual, ...(previo || {}), ...extra, t: previo ? previo.t : tl, ease: (previo && previo.ease) || "suave" };
      if (!kfs.length && tl > 0.05) otros.push({ ...actual, t: 0, ease: "suave" });
      return guardarKf(tipo, s, [...otros, nuevo]);
    };
    if (!kfs.length) caja.append(el("div", { class: "nota" }, tipo === "toma" ? "Anima el zoom y el encuadre: pon el cabezal, ajusta y añade un fotograma clave; repite en otro instante." : "Anima posición, escala, opacidad o rotación: añade un fotograma clave, mueve el cabezal, arrastra el texto en el visor o cambia los valores."));
    [...kfs].sort((a, b) => a.t - b.t).forEach((k) => {
      const idx = kfs.indexOf(k);
      const setK = (props) => guardarKf(tipo, s, kfs.map((q, j) => j === idx ? { ...q, ...props } : q));
      const fila = el("div", { class: "kf" + (Math.abs(k.t - tl) < 1 / 60 && dentro ? " aqui" : "") },
        el("div", { class: "kf-t" }, el("button", { class: "rombo-b", title: "Ir a este fotograma", onclick: () => ED.ponerT(t0 + k.t, { seguir: true }) }, "◆"),
          inNum(k.t, (v) => v !== null && setK({ t: r3(clamp(v, 0, dur)) }), { step: 0.05, min: 0, max: dur }), el("span", { class: "u" }, "s"),
          inSel(EASES, k.ease || "suave", (v) => setK({ ease: v })), boton(X(), () => guardarKf(tipo, s, kfs.filter((_, j) => j !== idx)), "chico solo-ico", "Quitar este fotograma clave")));
      const det = el("div", { class: "kf-props" });
      for (const [p, lab, mn, mx, st, u] of PROPS_KF[tipo]) {
        if (k[p] === undefined) continue;
        det.append(cmp(lab, deslizador(k[p], (v) => setK({ [p]: v }), { min: mn, max: mx, step: st, unidad: u })));
      }
      fila.append(det);
      caja.append(fila);
    });
    if (kfs.length) caja.append(el("div", { class: "botones" }, boton("Quitar todos", () => guardarKf(tipo, s, []), "chico")));
    c.append(caja);
  }
  // Desde el visor (arrastre de un texto con keyframes) y desde el menú contextual.
  ED.ponerKeyframe = (i, tl, props) => {
    const o = (E.plan.overlays || [])[i]; const x = V().overlays[i]; if (!o || !x) return;
    const kfs = o.keyframes || [];
    tl = r3(clamp(tl, 0, x.t_out - x.t_in));
    const prev = kfs.find((k) => Math.abs(k.t - tl) <= 1 / 60);
    const actual = valoresEn("overlays", x, tl);
    const nuevo = { ...actual, ...(prev || {}), ...props, t: prev ? prev.t : tl, ease: (prev && prev.ease) || "suave" };
    return guardarKf("overlays", { i }, [...kfs.filter((k) => k !== prev), nuevo]);
  };
  ED.agregarKeyframe = () => {
    const s = E.sel; if (!s) return;
    if (s.tipo === "overlays") { const x = V().overlays[s.i]; return ED.ponerKeyframe(s.i, E.t - x.t_in, {}); }
    if (s.tipo === "toma") {
      const x = ED.tomasPlanas().find((y) => y.g === s.g && y.k === s.k); if (!x) return;
      const kfs = (ED.tomaCruda(s.g, s.k) || {}).keyframes || [];
      const tl = r3(clamp(E.t - x.t0, 0, x.dur));
      return guardarKf("toma", s, [...kfs.filter((k) => Math.abs(k.t - tl) > 1 / 60), { ...valoresEn("toma", x, tl), t: tl, ease: "suave" }]);
    }
  };

  // ----------------------------------------------------------------- otros elementos
  function inspEfectoGlobal(c, i) {
    const e0 = (E.plan.efectos || [])[i]; if (e0 === undefined) return;
    const dat = typeof e0 === "string" ? {} : e0;
    const nombre = typeof e0 === "string" ? e0 : (e0.efecto || e0.preset);
    const def = ED.catEfecto(nombre);
    const setE = (props) => hacer({ op: "lista_props", lista: "efectos", i, props }, { reInsp: false });
    c.append(el("h4", {}, humano(nombre)), el("div", { class: "nota" }, def ? def.desc : ""));
    paramsEfecto(c, def, dat, setE);
    c.append(el("div", { class: "botones" }, boton("Usar el rango marcado (I/O)", () => E.rango ? setE({ desde: E.rango[0], hasta: E.rango[1] }) : toast("Marca un rango con I y O", "info")),
      boton("Duplicar", ED.duplicarSel), boton("Borrar", ED.borrarSel, "peligro")));
  }
  function inspTramo(c, i) {
    const t = ((E.plan.musica || {}).tramos || [])[i]; if (!t) return;
    const v = V().musica[i];
    const set = (props) => hacer({ op: "lista_props", lista: "musica", i, props }, { reInsp: false });
    c.append(el("div", { class: "nota" }, `${nombreFuente(v.fuente)} · suena de ${fmt(v.en)} a ${fmt(v.fin)}`),
      cmp("Volumen", deslizador(t.volumen ?? (E.plan.musica || {}).volumen ?? 1, (x) => set({ volumen: x }), { min: 0, max: 2, step: 0.01, factor: 100, unidad: "%" })),
      cmp("Entrada suave", deslizador(t.fade_in ?? 0.008, (x) => set({ fade_in: Math.max(0.008, x) }), { min: 0, max: Math.min(10, (v.fin - v.en) / 2), step: 0.05, unidad: "s" })),
      cmp("Salida suave", deslizador(t.fade_out ?? 0.012, (x) => set({ fade_out: Math.max(0.012, x) }), { min: 0, max: Math.min(10, (v.fin - v.en) / 2), step: 0.05, unidad: "s" })),
      el("div", { class: "nota" }, "También puedes arrastrar la línea de volumen y las esquinas del clip en la línea de tiempo."),
      avanzado("Recorte de la canción",
        cmp("Canción", inSel(ED.aliasDe("musica").map((a) => [a, nombreFuente(a)]), t.fuente || (E.plan.musica || {}).fuente, (x) => set({ fuente: x }))),
        cmp("Desde (s de la canción)", inNum(v.a, (x) => x !== null && set({ desde: x }), { min: 0, step: 0.01 })),
        cmp("Hasta (s de la canción)", inNum(v.b, (x) => x !== null && set({ hasta: x }), { min: 0, step: 0.01 })),
        cmp("Empieza en el video", inNum(v.en, (x) => x !== null && set({ en: x }), { min: 0, step: 0.01 })),
        cmp("Mezcla con la anterior", deslizador(t.crossfade ?? 0, (x) => set({ crossfade: x || null }), { min: 0, max: 4, step: 0.05, unidad: "s" }))),
      el("div", { class: "botones" }, boton("Dividir en el cabezal", ED.dividir), boton("Duplicar", ED.duplicarSel), boton("Borrar", ED.borrarSel, "peligro")));
  }
  const SFX = [["boom", "Golpe grave"], ["hit", "Golpe"], ["riser", "Subida (tensión)"], ["whoosh", "Whoosh"]];
  function inspSfx(c, i) {
    const s = (E.plan.sfx || [])[i]; if (!s) return;
    const set = (props) => hacer({ op: "lista_props", lista: "sfx", i, props }, { reInsp: false });
    c.append(s.archivo ? cmp("Sonido", el("span", { class: "nota", title: s.archivo }, String(s.archivo).split(/[\\/]/).pop())) : cmp("Sonido", inSel(SFX, s.tipo === "golpe" ? "hit" : s.tipo, (x) => set({ tipo: x }))),
      cmp("Volumen", deslizador(s.volumen ?? 0.8, (x) => set({ volumen: x }), { min: 0, max: 2, step: 0.01, factor: 100, unidad: "%" })),
      cmp("Suena en", inNum(s.t, (x) => x !== null && set({ t: x }), { min: 0, step: 0.05 })),
      el("div", { class: "botones" }, boton("Mover al cabezal", () => set({ t: r3(E.t) })), boton("Duplicar", ED.duplicarSel), boton("Borrar", ED.borrarSel, "peligro")));
  }
  function inspFlash(c, i) {
    const f = (E.plan.flashes || [])[i]; if (!f) return;
    const set = (props) => hacer({ op: "lista_props", lista: "flashes", i, props }, { reInsp: false });
    c.append(el("div", { class: "nota" }, "t" in f ? "Destello blanco" : "Serie de destellos"),
      cmp("Intensidad", deslizador(f.intensidad ?? 0.5, (x) => set({ intensidad: x }), { min: 0, max: 2, step: 0.05, factor: 100, unidad: "%" })));
    if (!("t" in f)) c.append(cmp("Cada (s)", inNum(f.cada, (x) => set({ cada: x }), { step: 0.25, min: 0.1 })));
    c.append(el("div", { class: "botones" }, boton("Borrar", ED.borrarSel, "peligro")));
  }
  function inspVoz(c, i) {
    const t = ((E.plan.voz || {}).continua || [])[i]; if (!t) return;
    const set = (props) => hacer({ op: "lista_props", lista: "voz", i, props }, { reInsp: false });
    c.append(cmp("Volumen", deslizador(t.volumen ?? 1, (x) => set({ volumen: x }), { min: 0, max: 2, step: 0.01, factor: 100, unidad: "%" })),
      cmp("Fundido", deslizador(t.fundido ?? 0.05, (x) => set({ fundido: x }), { min: 0, max: 2, step: 0.01, unidad: "s" })),
      avanzado("Tramo de la grabación",
        cmp("Desde (s)", inNum(t.desde, (x) => set({ desde: x }), { step: 0.05 })), cmp("Hasta (s)", inNum(t.hasta, (x) => set({ hasta: x }), { step: 0.05 })),
        cmp("Empieza en el video", inNum(t.en, (x) => set({ en: x }), { step: 0.05 }))),
      el("div", { class: "botones" }, boton("Dividir", ED.dividir), boton("Borrar", ED.borrarSel, "peligro")));
  }

  // ----------------------------------------------------------------- clips libres (pistas V2+ y A): paridad Premiere / After Effects
  const FUSIONES = [["normal", "Normal"], ["multiplicar", "Multiplicar"], ["pantalla", "Trama (pantalla)"], ["superponer", "Superponer"], ["agregar", "Añadir"], ["aclarar", "Aclarar"],
    ["oscurecer", "Oscurecer"], ["diferencia", "Diferencia"], ["luz_suave", "Luz suave"], ["luz_fuerte", "Luz fuerte"], ["exclusion", "Exclusión"], ["sobreexponer", "Sobreexponer color"], ["subexponer", "Subexponer color"]];
  function kfLista(c, kfs, etiqueta, unidad, factor, guardar, valorActual, x) {
    const caja = el("div", { class: "kf-caja" });
    caja.append(el("div", { class: "kf-cab" }, el("b", { html: `${ED.ico("diamond", 13)} ${etiqueta}` }),
      boton(`${ED.ico("plus", 13)} En el cabezal`, () => {
        if (E.t < x.a - 1e-6 || E.t > x.b + 1e-6) return toast("Pon el cabezal dentro del clip", "info");
        const tl = r3(clamp(E.t - x.a, 0, x.dur));
        guardar([...kfs.filter((k) => Math.abs(k.t - tl) > 1 / 60), { t: tl, v: r3(valorActual(tl)) }].sort((a, b) => a.t - b.t));
      }, "chico acento", "Guarda el valor actual en este instante (también con la Pluma, P, sobre el clip)")));
    for (const k of [...kfs].sort((a, b) => a.t - b.t)) {
      caja.append(el("div", { class: "kf" }, el("div", { class: "kf-t" },
        el("button", { class: "rombo-b", title: "Ir a este fotograma", onclick: () => ED.ponerT(x.a + k.t, { seguir: true }) }, "◆"),
        el("span", { class: "num" }, `${k.t.toFixed(2)} s`),
        inNum(r3(k.v * factor), (v) => v !== null && guardar(kfs.map((q) => q === k ? { ...q, v: v / factor } : q)), { step: factor > 1 ? 1 : 0.05 }), el("span", { class: "u" }, unidad),
        boton(X(), () => guardar(kfs.filter((q) => q !== k)), "chico solo-ico", "Quitar este fotograma clave"))));
    }
    c.append(caja);
  }
  function editorMascaras(c, i, k, x) {
    const ms = k.mascaras || [];
    const guardar = (nuevas) => hacer({ op: "lista_props", lista: "clips", i, props: { mascaras: nuevas.length ? nuevas : null } });
    const tl = r3(clamp(E.t - x.a, 0, x.dur));
    ms.forEach((m, j) => {
      const setM = (props) => guardar(ms.map((q, jj) => { if (jj !== j) return q; const n = { ...q, ...props }; for (const z of Object.keys(n)) if (n[z] === null) delete n[z]; return n; }));
      const nom = { rect: "Rectángulo", elipse: "Elipse", pluma: "Pluma" }[m.tipo] || m.tipo;
      const caja = el("div", { class: "fx" }, el("div", { class: "cab" }, el("span", {}, `${nom} ${j + 1}`), boton(X(), () => guardar(ms.filter((_, jj) => jj !== j)), "chico solo-ico", "Quitar máscara")));
      caja.append(cmp("Calado (feather)", deslizador(m.feather ?? 0, (v) => setM({ feather: Math.round(v) }), { min: 0, max: 300, step: 1, unidad: "px" }), "Suaviza el borde de la máscara"),
        cmp("Expansión", deslizador(m.expansion ?? 0, (v) => setM({ expansion: Math.round(v) || null }), { min: -300, max: 300, step: 1, unidad: "px" })),
        cmp("Opacidad", deslizador(m.opacidad ?? 1, (v) => setM({ opacidad: v === 1 ? null : v }), { min: 0, max: 1, step: 0.01, factor: 100, unidad: "%" })),
        cmp("Modo", inSel([["sumar", "Sumar"], ["restar", "Restar"], ["intersectar", "Intersectar"]], m.modo || "sumar", (v) => setM({ modo: v === "sumar" ? null : v }))),
        cmp("Invertir", inBool(m.invertir, (v) => setM({ invertir: v || null }))));
      if (m.tipo !== "pluma") caja.append(avanzado("Posición y tamaño (0-1)",
        cmp("X", inNum(m.x ?? 0, (v) => setM({ x: v }), { step: 0.01 })), cmp("Y", inNum(m.y ?? 0, (v) => setM({ y: v }), { step: 0.01 })),
        cmp("Ancho", inNum(m.w ?? 1, (v) => setM({ w: v }), { step: 0.01 })), cmp("Alto", inNum(m.h ?? 1, (v) => setM({ h: v }), { step: 0.01 }))));
      else caja.append(el("div", { class: "botones" }, boton("Suavizar curva", () => setM({ suave: !m.suave || null }), m.suave ? "chico on" : "chico", "Pasa por los puntos con curvas"),
        boton("Redibujar en el visor", () => ED.pro && ED.pro.dibujarPluma(i, j), "chico")));
      caja.append(el("div", { class: "botones" }, boton(`${ED.ico("diamond", 12)} Animar: fotograma en el cabezal`, () => {
        const kf = { t: tl, feather: m.feather ?? 0, expansion: m.expansion ?? 0, ...(m.tipo === "pluma" ? { puntos: m.puntos } : { x: m.x ?? 0, y: m.y ?? 0, w: m.w ?? 1, h: m.h ?? 1 }) };
        setM({ keyframes: [...(m.keyframes || []).filter((q) => Math.abs(q.t - tl) > 1 / 60), kf].sort((a, b) => a.t - b.t) });
      }, "chico", "Guarda la forma actual de la máscara en este instante; cambia la forma en otro instante y vuelve a guardar"),
      (m.keyframes || []).length ? el("span", { class: "chip" }, `${m.keyframes.length} fotograma(s)`) : null,
      (m.keyframes || []).length ? boton("Quitar animación", () => setM({ keyframes: null }), "chico") : null));
      c.append(caja);
    });
    c.append(el("div", { class: "botones" },
      boton(`${ED.ico("square", 13)} Rectángulo`, () => guardar([...ms, { tipo: "rect", x: 0.2, y: 0.2, w: 0.6, h: 0.6, feather: 20 }]), "chico"),
      boton(`${ED.ico("circle", 13)} Elipse`, () => guardar([...ms, { tipo: "elipse", x: 0.2, y: 0.15, w: 0.6, h: 0.7, feather: 40 }]), "chico"),
      boton(`${ED.ico("pen-tool", 13)} Pluma`, () => ED.pro && ED.pro.dibujarPluma(i, ms.length), "chico", "Haz clic en el visor para poner puntos; doble clic o Enter para cerrar")));
  }
  function inspClip(c, i) {
    const x = (V().clips || [])[i], k = (E.plan.clips || [])[i];
    if (!x || !k) { c.append(el("div", { class: "nota" }, "El clip ya no existe")); return; }
    const set = (props) => hacer({ op: "lista_props", lista: "clips", i, props }, { reInsp: false });
    const setR = (props) => hacer({ op: "lista_props", lista: "clips", i, props });
    const pistaTxt = x.audio ? `A${x.pista}` : `V${x.pista + 1}`;
    c.append(el("div", { class: "nota" }, `${pistaTxt} · ${fmt(x.a)} → ${fmt(x.b)} · ${x.dur.toFixed(2)} s`));
    if (x.enlace) c.append(el("div", { class: "botones" }, el("span", { class: "chip ac", html: `${ED.ico("link", 12)} Enlazado` }), boton("Desenlazar", () => hacer({ op: "clips_desenlazar", is: [i] }), "chico")));
    if (x.tipo === "secuencia") {
      c.append(cmp("Secuencia", inSel((V().secuencias || []).filter((q) => !q.activa).map((q) => [q.id, q.nombre]), k.secuencia, (v) => setR({ secuencia: v }))),
        el("div", { class: "botones" }, boton("Abrir la secuencia", () => hacer({ op: "secuencia_activar", id: k.secuencia }), "chico", "Abre su pestaña para editarla (el clip anidado se actualiza solo)")));
    } else if (x.tipo !== "ajuste") {
      const tipos = x.tipo === "imagen" ? ["imagen"] : x.audio ? ["musica", "video"] : ["video"];
      c.append(cmp(x.tipo === "imagen" ? "Imagen" : "Medio", inSel(tipos.flatMap((t) => ED.aliasDe(t)).map((a) => [a, nombreFuente(a)]), k.fuente, (v) => setR({ fuente: v }))));
    }
    if (!["imagen", "ajuste"].includes(x.tipo)) c.append(cmp("Entrada (s)", inNum(k.inicio ?? 0, (v) => v !== null && set({ inicio: Math.max(0, v) }), { min: 0, step: 0.04 }), "Segundo del medio donde empieza el clip"));
    c.append(cmp("Duración (s)", inNum(r3(x.dur), (v) => v && setR({ dur: v }), { min: 0.034, step: 0.01 })),
      cmp("Empieza en", inNum(r3(x.a), (v) => v !== null && setR({ en: Math.max(0, v) }), { min: 0, step: 0.04 })));
    if (["video", "audio", "secuencia"].includes(x.tipo)) c.append(cmp("Velocidad", deslizador(k.velocidad ?? 1, (v) => v && set({ velocidad: v === 1 ? null : v }), { min: 0.25, max: 4, step: 0.05, unidad: "x" })));
    if (x.visual && x.tipo !== "ajuste") {
      c.append(seccion("Transformar"),
        cmp("Escala", deslizador(k.escala ?? 1, (v) => set({ escala: v === 1 ? null : v }), { min: 0.05, max: 4, step: 0.01, factor: 100, unidad: "%", vivo: (v) => ED.pro && ED.pro.vivoClip(i, { escala: v }) }), "100 % = ajustado al cuadro"),
        cmp("Posición X", deslizador(k.x ?? 0, (v) => set({ x: Math.round(v) || null }), { min: -V().W, max: V().W, step: 1, unidad: "px", vivo: (v) => ED.pro && ED.pro.vivoClip(i, { x: v }) })),
        cmp("Posición Y", deslizador(k.y ?? 0, (v) => set({ y: Math.round(v) || null }), { min: -V().H, max: V().H, step: 1, unidad: "px", vivo: (v) => ED.pro && ED.pro.vivoClip(i, { y: v }) })),
        cmp("Rotación", deslizador(k.rotacion ?? 0, (v) => set({ rotacion: Math.round(v) || null }), { min: -180, max: 180, step: 1, unidad: "°" })),
        el("div", { class: "nota" }, "También puedes arrastrar el clip en el visor."));
    }
    if (x.tipo === "ajuste") {
      const aj = k.ajuste || {};
      const setA = (props) => { const n = { ...aj, ...props }; for (const q of Object.keys(n)) if (n[q] === null) delete n[q]; setR({ ajuste: n }); };
      c.append(seccion("Ajuste (afecta a todo lo que está debajo)"),
        cmp("Contraste", deslizador(aj.contraste ?? 1, (v) => setA({ contraste: v === 1 ? null : v }), { min: 0.3, max: 2, step: 0.01 })),
        cmp("Saturación", deslizador(aj.saturacion ?? 1, (v) => setA({ saturacion: v === 1 ? null : v }), { min: 0, max: 3, step: 0.01 })),
        cmp("Brillo", deslizador(aj.brillo ?? 0, (v) => setA({ brillo: v || null }), { min: -0.5, max: 0.5, step: 0.01 })),
        cmp("Tono", deslizador(aj.tono ?? 0, (v) => setA({ tono: Math.round(v) || null }), { min: -180, max: 180, step: 1, unidad: "°" })),
        cmp("Desenfoque", deslizador(aj.desenfoque ?? 0, (v) => setA({ desenfoque: v || null }), { min: 0, max: 40, step: 0.5, unidad: "px" })),
        cmp("Nitidez", deslizador(aj.nitidez ?? 0, (v) => setA({ nitidez: v || null }), { min: 0, max: 2, step: 0.05 })),
        cmp("Blanco y negro", inBool(aj.byn, (v) => setA({ byn: v || null }))), cmp("Invertir", inBool(aj.invertir, (v) => setA({ invertir: v || null }))),
        cmp("Viñeta", inBool(aj.vineta, (v) => setA({ vineta: v || null }))));
    }
    if (x.visual) {
      c.append(seccion("Opacidad y fusión"),
        cmp("Opacidad", deslizador(k.opacidad ?? 1, (v) => set({ opacidad: v === 1 ? null : v }), { min: 0, max: 1, step: 0.01, factor: 100, unidad: "%", vivo: (v) => ED.pro && ED.pro.vivoClip(i, { opacidad: v }) })),
        x.tipo !== "ajuste" ? cmp("Modo de fusión", inSel(FUSIONES, k.fusion || "normal", (v) => setR({ fusion: v === "normal" ? null : v })), "Cómo se mezcla con lo que está debajo (como en Premiere y After Effects)") : null);
      kfLista(c, k.opacidad_kf || [], "Opacidad animada", "%", 100, (kfs) => setR({ opacidad_kf: kfs.length ? kfs : null }), (tl) => ED.pro ? ED.pro.valorKf(k.opacidad_kf, tl, k.opacidad ?? 1) : (k.opacidad ?? 1), x);
      c.append(seccion("Máscaras"));
      editorMascaras(c, i, k, x);
      if (x.tipo !== "ajuste") {
        const otros = (V().clips || []).filter((q) => q.visual && q.i !== i && q.id && q.tipo !== "ajuste");
        const mt = k.mate || null;
        c.append(seccion("Mate de pista"),
          cmp("Usar como mate", inSel(otros.map((q) => [q.id, `${q.etiqueta || (q.fuente ? nombreFuente(q.fuente) : q.tipo)} (V${q.pista + 1})`]), mt ? mt.clip : "", (v) => setR({ mate: v ? { clip: v, tipo: (mt && mt.tipo) || "alfa" } : null }), { vacio: "Ninguno" }), "La forma de ese clip recorta a este; el clip mate deja de verse (como un mate de pista de After Effects)"),
          mt ? cmp("Tipo", botonesSeg([["alfa", "Alfa"], ["luma", "Luma"]], mt.tipo || "alfa", (v) => setR({ mate: { ...mt, tipo: v } }))) : null,
          mt ? cmp("Invertir", inBool(mt.invertir, (v) => { const n = { ...mt }; if (v) n.invertir = true; else delete n.invertir; setR({ mate: n }); })) : null,
          mt ? el("div", { class: "nota" }, "El visor en vivo lo aproxima; la vista previa renderizada es exacta.") : null);
      }
    }
    if (x.audio) {
      c.append(seccion("Audio"),
        cmp("Volumen", deslizador(k.volumen ?? 1, (v) => set({ volumen: v === 1 ? null : v }), { min: 0, max: 2, step: 0.01, factor: 100, unidad: "%" })),
        cmp("Entrada suave", deslizador(k.fade_in ?? 0, (v) => set({ fade_in: v || null }), { min: 0, max: Math.min(10, x.dur / 2), step: 0.05, unidad: "s" })),
        cmp("Salida suave", deslizador(k.fade_out ?? 0, (v) => set({ fade_out: v || null }), { min: 0, max: Math.min(10, x.dur / 2), step: 0.05, unidad: "s" })));
      kfLista(c, k.volumen_kf || [], "Volumen animado", "%", 100, (kfs) => setR({ volumen_kf: kfs.length ? kfs : null }), (tl) => ED.pro ? ED.pro.valorKf(k.volumen_kf, tl, 1) : 1, x);
      c.append(el("div", { class: "botones" }, boton("Fundido cruzado con el siguiente", () => hacer({ op: "audio_fundido_cruzado", i, dur: 1 }), "chico", "Solapa 1 s con el siguiente clip de la pista, con fundidos")));
    }
    c.append(seccion("Acciones"), el("div", { class: "botones" },
      boton("Dividir en el cabezal", ED.dividir, "chico"), boton("Duplicar", ED.duplicarSel, "chico"),
      boton("Borrar con ripple", () => hacer({ op: "clip_ripple_borrar", i }), "chico", "Borra y cierra el hueco en la pista (Shift+Supr)"),
      x.tipo === "video" && ED.pro ? boton(`${ED.ico("activity", 13)} Estabilizar`, () => ED.pro.estabilizar({ tipo: "clips", i }), "chico", "Quita la vibración de la cámara (vid.stab, como el Warp Stabilizer)") : null,
      boton("Borrar", ED.borrarSel, "chico peligro")));
  }
  function inspMarcador(c, i) {
    const m = (E.plan.marcadores || [])[i]; if (!m) return;
    const set = (props) => hacer({ op: "lista_props", lista: "marcadores", i, props }, { reInsp: false });
    c.append(cmp("Nombre", inTxt(m.nombre, (v) => set({ nombre: v }))), cmp("En", inNum(m.t, (v) => v !== null && set({ t: Math.max(0, v) }), { step: 0.04 })),
      cmp("Duración", inNum(m.dur || 0, (v) => set({ dur: v || null }), { min: 0, step: 0.1 })),
      cmp("Color", el("div", { class: "muestras" }, ...(ED.pro ? ED.pro.COLORES_MARCA : ["#3DD68C"]).map((h) => el("button", { style: { background: h }, title: h, class: m.color === h ? "on" : "", onclick: () => hacer({ op: "lista_props", lista: "marcadores", i, props: { color: h } }) })))),
      cmp("Nota", inTxt(m.nota, (v) => set({ nota: v }))), el("div", { class: "botones" }, boton("Borrar", ED.borrarSel, "peligro")));
  }

  // ================================================================== plantillas de texto
  const PLANTILLAS = {
    titulo: { nombre: "Título grande", desc: "Centro, con resplandor e impacto", estilo: { tipografia: "titulo", tamano: 150, color: "blanco", resplandor: { color: "#FFD23F", radio: 24, opacidad: 0.7 } },
      items: [{ texto: "TU TÍTULO", pos: "centro", anim: "slam" }], dur: 3 },
    subtitulo: { nombre: "Subtítulo", desc: "Abajo, con caja oscura", estilo: { tipografia: "titulo", tamano: 54, color: "blanco", sombra: false, borde: 0, caja: { color: "#000000", opacidad: 0.6, relleno: 16, radio: 10 } },
      items: [{ texto: "Escribe aquí lo que se dice", pos: "abajo", anim: "fade" }], dur: 3 },
    tercio: { nombre: "Tercio inferior", desc: "Nombre y cargo a la izquierda", estilo: { tipografia: "titulo", tamano: 70, color: "blanco", caja: { color: "#101010", opacidad: 0.75, relleno: 18, radio: 6 } },
      items: [{ texto: "NOMBRE APELLIDO", pos: "tercio_inferior", dy: -45, alinear: "izquierda", margen: 120, anim: "slide" },
        { texto: "Cargo o descripción", pos: "tercio_inferior", dy: 40, alinear: "izquierda", margen: 130, anim: "slide", tamano: 42, color: "acento" }], dur: 4 },
    cta: { nombre: "Llamada a la acción", desc: "Degradado cálido, golpe", estilo: { tipografia: "titulo", tamano: 110, color: "blanco", degradado: { desde: "#FFD23F", hasta: "#FF6B3D", angulo: 90 } },
      items: [{ texto: "¡SÍGUENOS!", pos: "abajo", anim: "punch" }], dur: 2.5 },
    neon: { nombre: "Neón", desc: "Brillo azul intenso", estilo: { tipografia: "titulo", tamano: 140, color: "#FFFFFF", borde: 3, borde_color: "#0A2A4A", resplandor: { color: "#3EC7FF", radio: 30, opacidad: 0.95 } },
      items: [{ texto: "NEÓN", pos: "centro", anim: "fade" }], dur: 3 },
    cita: { nombre: "Cita en dos líneas", desc: "Alineada a la izquierda", estilo: { tipografia: "titulo", tamano: 72, color: "blanco", alineacion: "izquierda", interlineado: 1.15 },
      items: [{ texto: "“Una frase que\nse queda contigo”", pos: "centro", alinear: "izquierda", margen: 160, anim: "fade" }], dur: 4 },
  };
  ED.aplicarPlantilla = async (clave, t = E.t, capa) => {
    const p = PLANTILLAS[clave]; if (!p || !E.plan) return;
    const nom = "plantilla_" + clave;
    const ops = [];
    if (!(E.plan.estilos || {})[nom]) ops.push({ op: "seccion_props", seccion: "estilos." + nom, props: p.estilo });
    const t_in = r3(Math.min(t, Math.max(0, V().total - 0.5))), t_out = r3(Math.min(V().total, t_in + p.dur));
    for (const it of p.items) ops.push({ op: "lista_nuevo", lista: "overlays", item: { ...it, estilo: nom, t_in, t_out, ...(capa && Number(capa) > 1 ? { pista: Number(capa) } : {}) } });
    const ok = await hacer(ops.length === 1 ? ops[0] : { op: "lote", desc: `plantilla ${p.nombre}`, ops });
    if (ok && (E.t < t_in || E.t >= t_out)) ED.ponerT(t_in + 0.4);
    return ok;
  };

  // ================================================================== pestañas de la biblioteca
  ED.bibExtra = (c, buscar, pasa) => {
    const tj = (ic, nom, des, datos, extra) => { const t = ED.tarjeta(el("div", { class: "ic", html: ic }), nom, des, datos); if (extra) t.addEventListener("dblclick", extra); return t; };
    const I = (n) => ED.ico(n, 15);
    if (E.bib === "textos") {
      c.append(buscar, el("div", { class: "botones" }, boton(`${ED.ico("type", 14)} Texto en el cabezal`, () => ED.nuevoTexto(), "acento", "Texto nuevo en el cabezal (T)")),
        el("div", { class: "nota" }, "Doble clic para agregar en el cabezal, o arrastra a una pista de texto (V2, V3…)."));
      c.append(el("div", { class: "bib-cat" }, "Plantillas"));
      const rej = el("div", { class: "bib-plantillas" });
      for (const [k, p] of Object.entries(PLANTILLAS)) if (pasa(p.nombre, p.desc)) {
        const e = p.estilo;
        const muestra = el("div", { class: "pl-muestra", style: { color: ED.hexDe(e.color), textShadow: e.resplandor ? `0 0 10px ${e.resplandor.color}` : "", background: e.caja ? "rgba(0,0,0,.55)" : "" } }, p.items[0].texto.split("\n")[0].slice(0, 14));
        if (e.degradado) Object.assign(muestra.style, { background: `linear-gradient(${e.degradado.angulo + 90}deg, ${e.degradado.desde}, ${e.degradado.hasta})`, webkitBackgroundClip: "text", color: "transparent" });
        const t = ED.arrastrable(el("div", { class: "pl", title: p.desc, ondblclick: () => ED.aplicarPlantilla(k) }, muestra, el("div", { class: "nom" }, p.nombre)), { k: "plantilla", nombre: k });
        rej.append(t);
      }
      c.append(rej);
      const est = Object.entries(ED.estilosTodos()).filter(([k]) => !k.startsWith("propio_") && !k.startsWith("plantilla_") && pasa(humano(k)));
      if (est.length) c.append(el("div", { class: "bib-cat" }, "Estilos"));
      for (const [k, e] of est) c.append(tj(`<b style="color:${ED.hexDe(e.color)}">Aa</b>`, humano(k), `${e.tamano || 120} px`, { k: "estilo", nombre: k }, () => ED.nuevoTexto(E.t, { estilo: k })));
      if (E.cat) {
        c.append(el("div", { class: "bib-cat" }, "Animaciones (arrastra sobre un texto)"));
        for (const a of E.cat.anims.filter((a) => (E.cat.anims_schema || []).includes(a.nombre) && pasa(humano(a.nombre), a.desc)))
          c.append(tj(I(a.letra ? "type" : "sparkles"), humano(a.nombre), a.desc, { k: "anim", nombre: a.nombre }));
      }
    } else if (E.bib === "efectos") {
      c.append(buscar, el("div", { class: "nota" }, "Arrastra a un clip, a la banda de una escena o a la pista Efectos."));
      if (!E.cat) return;
      const pr = E.cat.presets.filter((p) => pasa(humano(p.nombre), p.desc));
      if (pr.length) c.append(el("div", { class: "bib-cat" }, "Combinaciones"));
      for (const p of pr) c.append(tj(I("layers"), humano(p.nombre), p.desc, { k: "efecto", nombre: p.nombre }));
      for (const [cat, tit] of Object.entries(E.cat.categorias || {})) {
        const ls = E.cat.efectos.filter((e) => e.categoria === cat && pasa(humano(e.nombre), e.desc));
        if (!ls.length) continue;
        c.append(el("div", { class: "bib-cat" }, tit));
        for (const e of ls) c.append(tj(I(e.disparo ? "zap" : "wand-sparkles"), humano(e.nombre), e.desc, { k: "efecto", nombre: e.nombre }));
      }
    } else if (E.bib === "transiciones") {
      c.append(buscar, el("div", { class: "nota" }, "Arrastra sobre un clip de V1: la transición entra en ese corte."));
      if (!E.cat) return;
      for (const origen of ["catálogo", "xfade"]) {
        const ls = E.cat.transiciones.filter((t) => t.origen === origen && pasa(humano(t.nombre), t.desc)); if (!ls.length) continue;
        c.append(el("div", { class: "bib-cat" }, origen === "catálogo" ? "Especiales" : "Clásicas"));
        for (const t of ls) c.append(tj(I("arrow-right-left"), humano(t.nombre), t.desc, { k: "transicion", nombre: t.nombre }));
      }
    } else if (E.bib === "audio") {
      c.append(buscar, el("div", { class: "bib-cat" }, "Efectos de sonido"), el("div", { class: "nota" }, "Doble clic para ponerlo en el cabezal o arrástralo a la pista Sonidos."));
      for (const [k, n] of SFX) if (pasa(n)) {
        const t = tj(I("audio-lines"), n, "", { k: "sfx", nombre: k }, () => hacer({ op: "lista_nuevo", lista: "sfx", item: { tipo: k, t: r3(E.t) } }));
        t.append(el("button", { class: "ib", title: "Escuchar", "aria-label": "Escuchar " + n, html: ED.ico("play", 13), onclick: (ev) => { ev.stopPropagation(); new Audio(`/api/editor/sfx/${k}`).play(); } }));
        c.append(t);
      }
      const mus = ED.aliasDe("musica");
      if (mus.length) c.append(el("div", { class: "bib-cat" }, "Música del proyecto"));
      for (const a of mus) if (pasa(nombreFuente(a))) c.append(tj(I("music"), nombreFuente(a), E.fuentes[a].dur ? fmt(E.fuentes[a].dur) : "", { k: "medio", tipo: "musica", alias: a, dur: E.fuentes[a].dur }));
      c.append(el("div", { class: "nota" }, "Para agregar otra canción, impórtala en Medios."));
    }
  };
  ED.renderInspector = renderInspector;
  ED.PLANTILLAS = PLANTILLAS; ED.SFX = SFX; ED.FUSIONES = FUSIONES;
  // controles compartidos con otros módulos (editor_anim.js)
  ED.ui = { cmp, inNum, deslizador, inTxt, inSel, inBool, botonesSeg, inColor, boton, avanzado, seccion, plegar, editorKeyframes };
})();
