"use strict";
// Web Studio — Editor: funciones de Premiere / After Effects (ver docs/paridad-premiere-ae.md).
// - Pistas libres: clips de video/imagen/ajuste/secuencia en V2+ y de audio en A1+ (lista `clips` del plan), con
//   focalización de pista (V/A de destino), video y audio enlazados y visor en vivo por capas (fusión, opacidad,
//   máscaras, capas de ajuste y mates aproximados con CSS; el render es exacto: engine/capas.py).
// - Herramientas: selección, seleccionar pista hacia adelante (A), rizo/ripple (B), rodillo/roll (Shift+B), cuchilla (C),
//   deslizar contenido/slip (Y), deslizar clip/slide (U), pluma de keyframes de volumen y opacidad (P), mano (H).
// - Monitor de ORIGEN con entrada/salida (I/O), Insertar (,) y Sobrescribir (.) en las pistas focalizadas, arrastrar
//   solo video o solo audio, exportar fotograma y calidad.
// - Secuencias en pestañas (nueva, duplicar, renombrar, anidar = precomp), barra de área de trabajo, marcadores con
//   nombre, color y nota.
// - Audio: medidores dB en vivo (WebAudio) generales y por pista, voz en off con el micrófono (MediaRecorder).
// - Estabilizar (vid.stab) con progreso en el centro de tareas. Espacios de trabajo Importar / Editar / Animar /
//   Exportar con diseños guardables.
(() => {
  const ED = window.WDED;
  const { E, V, $, $$, el, esc, hacer, toast, fmt, r3, clamp, lsGet, lsSet, humano, nombreFuente, pedir } = ED;
  const ico = (n, t = 16) => ED.ico(n, t);
  const P = { capas: new Map(), origen: null, rec: null, vu: null, rafVu: 0, ws: lsGet("wded_ws", "editar"), pluma: null, vivo: null, arr: null };
  const COLORES_MARCA = ["#3DD68C", "#F5B82E", "#FF6B70", "#6AA8FF", "#B57BFF", "#FF9F43", "#2BD1C4", "#ECEDEF"];
  const FUSION_CSS = { multiplicar: "multiply", pantalla: "screen", superponer: "overlay", agregar: "plus-lighter", aclarar: "lighten", oscurecer: "darken",
    diferencia: "difference", luz_suave: "soft-light", luz_fuerte: "hard-light", exclusion: "exclusion", sobreexponer: "color-dodge", subexponer: "color-burn" };
  const valorKf = (kfs, tl, def) => ED.interp(kfs || [], "v", tl, def);

  // ================================================================== herramientas (paleta con grupos desplegables)
  const HERR = {
    sel: ["mouse-pointer-2", "Selección", "V"], pista: ["arrow-right-to-line", "Seleccionar pista hacia adelante", "A"],
    ripple: ["unfold-horizontal", "Edición de rizo (ripple): recorta y corre lo que sigue", "B"], roll: ["fold-horizontal", "Edición de rodillo (roll): mueve el corte entre dos clips", "Shift+B"],
    cortar: ["scissors", "Cuchilla: clic en un clip lo divide", "C"],
    slip: ["chevrons-left-right", "Deslizar contenido (slip): cambia qué parte del medio se ve", "Y"], slide: ["move-horizontal", "Deslizar clip (slide): mueve el clip y ajusta sus vecinos", "U"],
    pluma: ["pen-tool", "Pluma: fotogramas clave de volumen (audio) y opacidad (video) sobre el clip", "P"], mano: ["hand", "Mano: desplaza la línea de tiempo", "H"],
  };
  const GRUPOS = [["sel", "pista"], ["ripple", "roll"], ["cortar"], ["slip", "slide"], ["pluma"], ["mano"]];
  const grupoAct = lsGet("wded_herr_grupos", {});
  function pintarHerramientas() {
    const c = $("#tl-herr"); if (!c) return;
    c.innerHTML = "";
    for (const g of GRUPOS) {
      const act = g.includes(E.herramienta) ? E.herramienta : (grupoAct[g[0]] && g.includes(grupoAct[g[0]]) ? grupoAct[g[0]] : g[0]);
      const [ic, tit, k] = HERR[act];
      const b = el("button", { class: "ib" + (E.herramienta === act ? " on" : ""), id: act === "sel" ? "ed-h-sel" : act === "cortar" ? "ed-h-cortar" : "ed-h-" + act,
        title: `${tit} (${k})`, "aria-label": tit, "aria-pressed": String(E.herramienta === act), html: ico(ic, 16), onclick: () => ED.herramienta(act) });
      const caja = el("span", { class: "herr-g" }, b);
      if (g.length > 1) {
        const m = el("button", { class: "herr-mas", title: "Más herramientas de este grupo", "aria-label": "Más herramientas", "aria-haspopup": "menu", html: ico("chevron-down", 10) });
        m.onclick = () => { const r = m.getBoundingClientRect(); ED.menu(r.left, r.bottom + 2, g.map((h) => [`${HERR[h][1].split(":")[0]}`, () => { grupoAct[g[0]] = h; lsSet("wded_herr_grupos", grupoAct); ED.herramienta(h); }, HERR[h][2]])); };
        caja.append(m);
      }
      c.append(caja);
    }
    c.append(el("button", { class: "ib", id: "ed-nuevo-texto", title: "Texto nuevo en el cabezal (T)", "aria-label": "Texto nuevo", html: ico("type", 16), onclick: () => ED.nuevoTexto() }));
  }
  function marcarHerramienta(h) {
    for (const g of GRUPOS) if (g.includes(h) && g.length > 1) { grupoAct[g[0]] = h; lsSet("wded_herr_grupos", grupoAct); }
    pintarHerramientas();
    const c = $("#tl-cont"); if (c) c.dataset.herr = h;
    if (h === "pluma") ED.renderTimeline();
  }

  // ================================================================== clips libres en la línea de tiempo
  function nombreClip(c) {
    if (c.etiqueta) return c.etiqueta;
    if (c.tipo === "ajuste") return "Capa de ajuste";
    if (c.tipo === "secuencia") { const s = (V().secuencias || []).find((q) => q.id === c.secuencia); return `Secuencia: ${s ? s.nombre : c.secuencia}`; }
    return nombreFuente(c.fuente) || c.fuente || "Clip";
  }
  function dibujarClip(car, c, top, alto, clipFn) {
    const nom = nombreClip(c);
    const cls = `clips t-${c.tipo}${c.audio ? " audio" : ""}${c.enlace ? " enl" : ""}${c.deshabilitado ? " off" : ""}`;
    const pista = c.audio ? `A${c.pista}` : `V${c.pista + 1}`;
    const extra = [c.fusion && c.fusion !== "normal" ? `fusión: ${c.fusion}` : "", c.mascaras.length ? `${c.mascaras.length} máscara(s)` : "", c.mate ? "con mate de pista" : "", c.enlace ? "enlazado" : ""].filter(Boolean).join(" · ");
    const d = clipFn(car, cls, c.a, c.b, top, alto, nom, { tipo: "clips", i: c.i, a: c.a, b: c.b }, `${nom} (${pista})\n${fmt(c.a)} – ${fmt(c.b)}${extra ? "\n" + extra : ""}`);
    if (!d) return null;
    if (c.enlace) d.querySelector(".t").prepend(el("span", { class: "enl-ic", html: ico("link", 10) }));
    if (c.tipo === "video" && c.fuente && E.fuentes[c.fuente] && E.fuentes[c.fuente].existe && (c.b - c.a) * E.pps > 26)
      d.prepend(el("img", { loading: "lazy", draggable: "false", src: `media/poster.jpg` }));
    if ((c.mascaras.length || (c.fusion && c.fusion !== "normal") || c.mate) && (c.b - c.a) * E.pps > 20) d.append(el("span", { class: "fxb" }, "fx"));
    if (c.audio) {
      const f = c.fuente || null;
      if (f) ED.dibujarOnda(d, { fuente: f, a: c.inicio, b: c.inicio + c.dur * (c.velocidad || 1), en: c.a, fin: c.b, vol: c.volumen ?? 1 }, alto);
      d.append(el("div", { class: "vol-linea", style: { top: clamp((1 - (c.volumen ?? 1) / 2) * alto, 0, alto - 1) + "px" }, title: `Volumen ${Math.round((c.volumen ?? 1) * 100)}% (arrastra arriba/abajo)` }));
      const wi = clamp((c.fade_in || 0) * E.pps, 0, c.dur * E.pps), wo = clamp((c.fade_out || 0) * E.pps, 0, c.dur * E.pps);
      if (wi > 1) d.append(el("div", { class: "fade-zona i", style: { width: wi + "px" } }));
      if (wo > 1) d.append(el("div", { class: "fade-zona f", style: { width: wo + "px" } }));
      d.append(el("div", { class: "fade-asa i", style: { left: Math.max(0, wi - 5) + "px" }, title: "Fundido de entrada (arrastra)" }), el("div", { class: "fade-asa f", style: { right: Math.max(0, wo - 5) + "px" }, title: "Fundido de salida (arrastra)" }));
    }
    const kfs = c.audio ? c.volumen_kf : (c.tipo !== "ajuste" ? c.opacidad_kf : []);
    if ((kfs && kfs.length) || E.herramienta === "pluma") lineaKf(d, c, kfs || [], alto);
    return d;
  }
  // línea de fotogramas clave (volumen 0-200 % en audio, opacidad 0-100 % en video) con puntos arrastrables
  function lineaKf(d, c, kfs, alto) {
    const w = Math.max(3, c.dur * E.pps), maxV = c.audio ? 2 : 1, def = c.audio ? 1 : (c.opacidad ?? 1);
    const y = (v) => clamp((1 - v / maxV) * (alto - 4) + 2, 1, alto - 1);
    const pts = kfs.length ? [...kfs].sort((a, b) => a.t - b.t) : [{ t: 0, v: def }];
    const xy = [[0, y(pts[0].v)], ...pts.map((k) => [k.t * E.pps, y(k.v)]), [w, y(pts[pts.length - 1].v)]];
    const svg = `<svg class="kf-linea" width="${w}" height="${alto}" viewBox="0 0 ${w} ${alto}" aria-hidden="true"><polyline points="${xy.map((p) => p.join(",")).join(" ")}" /></svg>`;
    d.insertAdjacentHTML("beforeend", svg);
    for (const k of kfs) {
      const p = el("span", { class: "kf-pt", title: `${c.audio ? "Volumen" : "Opacidad"} ${Math.round(k.v * 100)}% en ${fmt(c.a + k.t)} (arrastra; Alt+clic lo quita)`, style: { left: (k.t * E.pps - 4) + "px", top: (y(k.v) - 4) + "px" } });
      p._k = k; d.append(p);
    }
  }
  function trasTimeline() {
    const c = $("#tl-cont"); if (c) c.dataset.herr = E.herramienta;
    pintarSecuencias();
    pintarContenidoTimeline();
  }

  // ================================================================== herramientas pro sobre la línea de tiempo
  const tomaPlana = (g, k) => ED.tomasPlanas().find((x) => x.g === g && x.k === k);
  function tlDown(e, obj, d, t) {
    const h = E.herramienta;
    if (h === "mano") {
      const sc = $("#tl-scroll"), x0 = e.clientX, s0 = sc.scrollLeft;
      arrastre(e, (ev) => { sc.scrollLeft = s0 - (ev.clientX - x0); }, () => {});
      return true;
    }
    if (h === "pista") { seleccionarAdelante(e, t); return true; }
    if (!obj || !d || d.trans || !["ripple", "roll", "slip", "slide", "pluma"].includes(h)) {
      if (e.target.classList.contains("kf-pt") && obj && d) return arrastrarKf(e, obj, d);
      return false;
    }
    if (ED.filaBloqueada(obj)) return false;
    if (e.target.classList.contains("kf-pt")) return arrastrarKf(e, obj, d);
    const asa = e.target.classList.contains("asa") ? (e.target.classList.contains("i") ? "i" : "f") : null;
    if (h === "pluma") return pluma(e, obj, d, t);
    if (h === "ripple") {
      if (!asa) return false;
      if (d.tipo === "toma") return false;           // la toma ya es magnética: el recorte normal + ripple (hacer lo marca)
      if (d.tipo !== "clips") return false;
      return recorteRipple(e, obj, d, asa, t);
    }
    if (h === "roll") {
      if (!asa) return false;
      return rodillo(e, obj, d, asa, t);
    }
    if (h === "slip" || h === "slide") {
      if (asa || !["toma", "clips"].includes(d.tipo)) return false;
      ED.seleccionar(d, "solo");
      const t0 = t;
      let delta = 0;
      arrastre(e, (ev) => {
        const r = $("#tl-cont").getBoundingClientRect();
        delta = r3(ED.tDe(ev.clientX - r.left) - t0);
        obj.classList.add("editando");
        if (h === "slide") obj.style.transform = `translateX(${delta * E.pps}px)`;
        ED.mostrarPista(ev, h === "slip" ? `Contenido ${delta >= 0 ? "−" : "+"}${Math.abs(delta).toFixed(2)} s` : `Deslizar ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} s`);
      }, () => {
        ED.quitarPista(); obj.style.transform = ""; obj.classList.remove("editando");
        if (Math.abs(delta) < 1e-3) return;
        if (d.tipo === "toma") hacer({ op: h === "slip" ? "toma_slip" : "toma_slide", g: d.g, k: d.k, delta: h === "slip" ? -delta : delta });
        else hacer({ op: h === "slip" ? "clip_slip" : "clip_slide", i: d.i, delta: h === "slip" ? -delta : delta });
      });
      return true;
    }
    return false;
  }
  function arrastre(e, mover, soltar) {
    e.preventDefault();
    const m = (ev) => mover(ev), u = (ev) => { window.removeEventListener("pointermove", m); window.removeEventListener("pointerup", u); soltar(ev); };
    window.addEventListener("pointermove", m); window.addEventListener("pointerup", u);
  }
  function seleccionarAdelante(e, t) {
    const f = e.target.closest(".tl-fila"); if (!f) return;
    const todas = e.shiftKey;
    const sel = [];
    const v = V();
    const filaDe = (tipo) => todas || f.dataset.pista === tipo;
    if (filaDe("video")) for (const x of ED.tomasPlanas()) if (x.t0 >= t - 1e-3) sel.push({ tipo: "toma", g: x.g, k: x.k });
    for (const o of v.overlays) if (o.t_in >= t - 1e-3 && (todas || (f.dataset.capa && Number(f.dataset.capa) === (o.pista || 1)))) sel.push({ tipo: "overlays", i: o.i });
    for (const c of v.clips || []) if (c.a >= t - 1e-3 && (todas || (c.audio ? Number(f.dataset.apista) === c.pista : Number(f.dataset.capa) === c.pista))) sel.push({ tipo: "clips", i: c.i });
    for (const [lista, it] of [["musica", v.musica], ["sfx", v.sfx], ["efectos", v.efectos], ["voz", v.voz ? v.voz.continua : []]])
      for (const x of it || []) if (ED.intervaloVista(lista, x)[0] >= t - 1e-3 && (todas || f.dataset.pista === lista || (lista === "efectos" && f.dataset.pista === "efectos"))) sel.push({ tipo: lista, i: x.i });
    E.multi = sel; E.sel = sel[0] || null;
    ED.renderTimeline(); ED.renderInspector();
    toast(`${sel.length} elemento(s) desde ${fmt(t)}${todas ? " en todas las pistas" : ""} (Shift = todas las pistas)`, "info", 1600);
  }
  function recorteRipple(e, obj, d, asa, t) {
    const c = V().clips[d.i]; if (!c) return false;
    ED.seleccionar(d, "solo");
    let nt = null;
    arrastre(e, (ev) => {
      const r = $("#tl-cont").getBoundingClientRect(), tt = ED.tDe(ev.clientX - r.left);
      nt = asa === "i" ? clamp(tt, Math.max(0, c.a - c.inicio / (c.velocidad || 1)), c.b - 0.034) : Math.max(c.a + 0.034, tt);
      if (asa === "i") { obj.style.left = (nt * E.pps) + "px"; obj.style.width = ((c.b - nt) * E.pps) + "px"; } else obj.style.width = ((nt - c.a) * E.pps) + "px";
      ED.mostrarPista(ev, `Rizo: ${(asa === "i" ? c.b - nt : nt - c.a).toFixed(2)} s`);
    }, () => {
      ED.quitarPista(); if (nt === null) return ED.renderTimeline();
      const delta = asa === "i" ? r3(nt - c.a) : r3(nt - c.b);            // lo que cambia la duración (con signo)
      const ops = [];
      if (asa === "i") ops.push({ op: "lista_props", lista: "clips", i: c.i, props: { inicio: r3(Math.max(0, c.inicio + delta * (c.velocidad || 1))), dur: r3(c.dur - delta) } });
      else ops.push({ op: "lista_props", lista: "clips", i: c.i, props: { dur: r3(nt - c.a) } });
      const corr = asa === "i" ? -delta : delta;
      for (const o of V().clips) if (o.i !== c.i && o.audio === c.audio && o.pista === c.pista && o.a >= c.b - 1e-3) ops.push({ op: "lista_mover", lista: "clips", i: o.i, delta: corr, solo: true });
      hacer(ops.length === 1 ? ops[0] : { op: "lote", desc: "recorte con rizo", ops });
    });
    return true;
  }
  function rodillo(e, obj, d, asa, t) {
    let delta = 0;
    const r0 = $("#tl-cont").getBoundingClientRect();
    ED.seleccionar(d, "solo");
    const guia = el("div", { class: "tl-iman", style: { left: ED.xDe(asa === "i" ? d.a : d.b) + "px" } }); $("#tl-cont").append(guia);
    arrastre(e, (ev) => {
      delta = r3(ED.tDe(ev.clientX - r0.left) - t);
      guia.style.left = ED.xDe((asa === "i" ? d.a : d.b) + delta) + "px";
      ED.mostrarPista(ev, `Rodillo ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} s`);
    }, () => {
      guia.remove(); ED.quitarPista();
      if (Math.abs(delta) < 1e-3) return;
      if (d.tipo === "toma") {
        if (asa === "f") return hacer({ op: "toma_roll", g: d.g, k: d.k, delta });
        const planas = ED.tomasPlanas(), j = planas.findIndex((x) => x.g === d.g && x.k === d.k);
        if (j <= 0) return toast("No hay un clip antes de este", "info");
        return hacer({ op: "toma_roll", g: planas[j - 1].g, k: planas[j - 1].k, delta });
      }
      if (d.tipo === "clips") {
        if (asa === "f") return hacer({ op: "clip_roll", i: d.i, delta });
        const c = V().clips[d.i];
        const prev = V().clips.find((o) => o.i !== c.i && o.audio === c.audio && o.pista === c.pista && Math.abs(o.b - c.a) < 2e-3);
        if (!prev) return toast("No hay un clip pegado antes de este en la pista", "info");
        return hacer({ op: "clip_roll", i: prev.i, delta });
      }
      toast("El rodillo funciona entre clips de video o de las pistas libres", "info");
    });
    return true;
  }
  function pluma(e, obj, d, t) {
    if (d.tipo !== "clips") { toast("La pluma pone fotogramas clave de volumen y opacidad en los clips de las pistas V2+ y A", "info", 2600); return true; }
    const c = V().clips[d.i], k = (E.plan.clips || [])[d.i]; if (!c || !k) return true;
    if (c.tipo === "ajuste") return true;
    const r = obj.getBoundingClientRect();
    const maxV = c.audio ? 2 : 1, lista = c.audio ? "volumen_kf" : "opacidad_kf";
    const v = r3(clamp((1 - (e.clientY - r.top - 2) / (r.height - 4)) * maxV, 0, maxV));
    const tl = r3(clamp(t - c.a, 0, c.dur));
    const kfs = [...(k[lista] || []).filter((q) => Math.abs(q.t - tl) > 1 / 60), { t: tl, v }].sort((a, b) => a.t - b.t);
    ED.seleccionar(d, "solo");
    hacer({ op: "lista_props", lista: "clips", i: d.i, props: { [lista]: kfs } }, { mantenerSel: true });
    return true;
  }
  function arrastrarKf(e, obj, d) {
    const c = V().clips[d.i], k = (E.plan.clips || [])[d.i], kf = e.target._k; if (!c || !k || !kf) return false;
    const lista = c.audio ? "volumen_kf" : "opacidad_kf", maxV = c.audio ? 2 : 1;
    if (e.altKey) { hacer({ op: "lista_props", lista: "clips", i: d.i, props: { [lista]: (k[lista] || []).filter((q) => !(Math.abs(q.t - kf.t) < 1e-4 && q.v === kf.v)) || null } }); return true; }
    const r = obj.getBoundingClientRect(), pt = e.target;
    let nt = kf.t, nv = kf.v;
    arrastre(e, (ev) => {
      nt = r3(clamp((ev.clientX - r.left) / E.pps, 0, c.dur)); nv = r3(clamp((1 - (ev.clientY - r.top - 2) / (r.height - 4)) * maxV, 0, maxV));
      pt.style.left = (nt * E.pps - 4) + "px"; pt.style.top = (clamp((1 - nv / maxV) * (r.height - 4) + 2, 1, r.height - 1) - 4) + "px";
      ED.mostrarPista(ev, `${c.audio ? "Volumen" : "Opacidad"} ${Math.round(nv * 100)}% · ${fmt(c.a + nt)}`);
    }, () => {
      ED.quitarPista();
      const nuevas = (k[lista] || []).map((q) => (Math.abs(q.t - kf.t) < 1e-4 && q.v === kf.v ? { ...q, t: nt, v: nv } : q)).sort((a, b) => a.t - b.t);
      hacer({ op: "lista_props", lista: "clips", i: d.i, props: { [lista]: nuevas } }, { mantenerSel: true });
    });
    return true;
  }

  // ================================================================== regla: área de trabajo y marcadores
  function reglaDown(e, t, regla) {
    const y = e.clientY - regla.getBoundingClientRect().top;
    if (y > 7 && !e.altKey) return false;
    const aw = V().area_trabajo;
    const px = (tt) => Math.abs(tt - t) * E.pps < 7;
    let modo = "nueva", a0 = t, b0 = t;
    if (aw && px(aw.desde)) { modo = "desde"; a0 = aw.desde; b0 = aw.hasta; }
    else if (aw && px(aw.hasta)) { modo = "hasta"; a0 = aw.desde; b0 = aw.hasta; }
    else if (aw && t > aw.desde && t < aw.hasta) { modo = "mover"; a0 = aw.desde; b0 = aw.hasta; }
    if (e.detail >= 2 && aw) { hacer({ op: "area_trabajo", quitar: true }, { mantenerSel: true }); return true; }
    const r0 = $("#tl-cont").getBoundingClientRect();
    let a = a0, b = b0;
    arrastre(e, (ev) => {
      const tt = clamp(ED.tDe(ev.clientX - r0.left), 0, V().total);
      if (modo === "nueva") { a = Math.min(t, tt); b = Math.max(t, tt); }
      else if (modo === "desde") a = Math.min(tt, b - 0.1);
      else if (modo === "hasta") b = Math.max(tt, a + 0.1);
      else { const dd = tt - t; a = clamp(a0 + dd, 0, V().total - (b0 - a0)); b = a + (b0 - a0); }
      V().area_trabajo = { desde: r3(a), hasta: r3(b) }; ED.dibujarRegla();
      ED.mostrarPista(ev, `Área de trabajo ${fmt(a)} – ${fmt(b)}`);
    }, () => {
      ED.quitarPista();
      if (b - a >= 0.1) hacer({ op: "area_trabajo", desde: r3(a), hasta: r3(b) }, { mantenerSel: true });
      else { V().area_trabajo = aw; ED.dibujarRegla(); }
    });
    return true;
  }
  function editarMarcador(m, x, y) {
    cerrarPop();
    const pop = el("div", { class: "wd-pop", role: "dialog", "aria-label": "Marcador" });
    const nom = el("input", { type: "text", value: m.nombre || "", "aria-label": "Nombre del marcador", placeholder: "Nombre" });
    const nota = el("textarea", { rows: 2, placeholder: "Nota (opcional)", "aria-label": "Nota" }); nota.value = m.nota || "";
    let color = m.color || COLORES_MARCA[0];
    const cols = el("div", { class: "muestras" }, ...COLORES_MARCA.map((h) => { const b = el("button", { style: { background: h }, title: h, class: h === color ? "on" : "", "aria-label": "Color " + h }); b.onclick = () => { color = h; for (const q of cols.children) q.classList.toggle("on", q === b); }; return b; }));
    const guardar = () => { cerrarPop(); hacer({ op: "lista_props", lista: "marcadores", i: m.i, props: { nombre: nom.value.trim() || null, nota: nota.value.trim() || null, color } }, { mantenerSel: true }); };
    nom.addEventListener("keydown", (e) => { if (e.key === "Enter") guardar(); if (e.key === "Escape") cerrarPop(); });
    pop.append(el("b", {}, `Marcador en ${fmt(m.t)}`), nom, cols, nota,
      el("div", { class: "botones" }, el("button", { class: "btn chico peligro", onclick: () => { cerrarPop(); hacer({ op: "lista_borrar", lista: "marcadores", i: m.i }); } }, "Borrar"), el("span", { class: "espacio" }),
        el("button", { class: "btn chico", onclick: cerrarPop }, "Cancelar"), el("button", { class: "btn chico primario", onclick: guardar }, "Guardar")));
    document.body.append(pop);
    pop.style.left = Math.min(x, innerWidth - 270) + "px"; pop.style.top = Math.min(y + 8, innerHeight - pop.offsetHeight - 8) + "px";
    nom.focus(); nom.select();
    setTimeout(() => document.addEventListener("pointerdown", function f(ev) { if (!ev.target.closest(".wd-pop")) { cerrarPop(); document.removeEventListener("pointerdown", f); } }), 0);
  }
  function cerrarPop() { for (const p of $$(".wd-pop")) p.remove(); }

  // ================================================================== secuencias (pestañas)
  function ordenSecs() {
    const ids = (V().secuencias || []).map((s) => s.id);
    let o = lsGet("wded_secs_" + E.pid, []).filter((id) => ids.includes(id));
    for (const id of ids) if (!o.includes(id)) o.push(id);
    lsSet("wded_secs_" + E.pid, o);
    return o.map((id) => V().secuencias.find((s) => s.id === id));
  }
  function pintarSecuencias() {
    const bar = $("#tl-secs"); if (!bar || !E.plan) return;
    const secs = ordenSecs();
    bar.innerHTML = "";
    for (const s of secs) {
      const b = el("button", { class: "sec-tab" + (s.activa ? " activa" : ""), role: "tab", "aria-selected": String(s.activa), title: s.activa ? `${s.nombre} (abierta). Doble clic: renombrar · clic derecho: más opciones` : `Abrir «${s.nombre}»` },
        el("span", { html: ico("film", 12) }), el("span", { class: "nom" }, s.nombre));
      b.onclick = () => { if (!s.activa) hacer({ op: "secuencia_activar", id: s.id }).then((ok) => ok && toast(`Secuencia «${s.nombre}»`, "info", 1400)); };
      b.ondblclick = () => renombrarSec(s);
      b.oncontextmenu = (e) => { e.preventDefault(); menuSec(e.clientX, e.clientY, s); };
      bar.append(b);
    }
    const mas = el("button", { class: "sec-mas", title: "Nueva secuencia", "aria-label": "Nueva secuencia", html: ico("plus", 13) });
    mas.onclick = () => { const r = mas.getBoundingClientRect(); ED.menu(r.left, r.bottom + 2, [["Secuencia nueva (vacía)", () => nuevaSec(false)], ["Duplicar la secuencia abierta", () => nuevaSec(true)]]); };
    bar.append(mas, el("span", { class: "espacio" }), el("span", { class: "sec-ayuda muy-tenue" }, secs.length > 1 ? "Clic derecho en una pestaña: anidar, renombrar, borrar" : ""));
  }
  async function nuevaSec(duplicar) {
    const n = prompt("Nombre de la secuencia", duplicar ? `${(V().secuencias.find((s) => s.activa) || {}).nombre || "Secuencia"} (copia)` : `Secuencia ${(V().secuencias || []).length + 1}`);
    if (n === null) return;
    await hacer({ op: "secuencia_nueva", nombre: n.trim(), duplicar, activar: true });
  }
  function renombrarSec(s) { const n = prompt("Nombre de la secuencia", s.nombre); if (n && n.trim()) hacer({ op: "secuencia_renombrar", id: s.id, nombre: n.trim() }); }
  function menuSec(x, y, s) {
    ED.menu(x, y, [
      s.activa ? null : ["Abrir", () => hacer({ op: "secuencia_activar", id: s.id })],
      ["Renombrar…", () => renombrarSec(s)],
      s.activa ? null : ["Anidar en la secuencia abierta (en el cabezal)", () => hacer({ op: "secuencia_anidar", id: s.id, t: r3(E.t), pista: E.destV && E.destV > 0 ? E.destV : 1, destino_a: E.destA || 1 })],
      ["Duplicar", () => hacer({ op: "secuencia_nueva", nombre: s.nombre + " (copia)", duplicar: true, activar: false }).then(() => s.activa || toast("Se duplicó la secuencia abierta", "info"))],
      "-", s.activa ? null : ["Borrar la secuencia", async () => {
        const q = { titulo: `¿Borrar «${s.nombre}»?`, cuerpo: "Puedes deshacerlo con Ctrl+Z.", si: "Borrar", peligro: true };
        if (window.WDVS && WDVS.confirmar ? await WDVS.confirmar(q) : confirm(q.titulo)) hacer({ op: "secuencia_borrar", id: s.id });
      }],
    ]);
  }

  // ================================================================== menú del clip y teclado
  function menuClip(items, d) {
    if (!d) return;
    const sels = E.multi.filter((s) => s.tipo === "clips").map((s) => s.i);
    if (d.tipo === "clips") {
      const c = V().clips[d.i]; if (!c) return;
      items.push("-",
        c.enlace ? ["Desenlazar video y audio", () => hacer({ op: "clips_desenlazar", is: [d.i] }), "Ctrl+L"] : ["Enlazar la selección", () => hacer({ op: "clips_enlazar", is: sels }), "Ctrl+L", sels.length < 2],
        ["Borrar con ripple (cierra el hueco)", () => hacer({ op: "clip_ripple_borrar", i: d.i }), "Shift+Supr"],
        c.tipo === "video" ? ["Estabilizar", () => estabilizar({ tipo: "clips", i: d.i })] : null,
        c.audio ? ["Fundido cruzado con el siguiente", () => hacer({ op: "audio_fundido_cruzado", i: d.i, dur: 1 })] : null,
        c.fuente && !c.audio ? ["Abrir en el monitor de origen", () => abrirOrigen({ alias: c.fuente, tipo: E.fuentes[c.fuente] ? E.fuentes[c.fuente].tipo : "video", dur: E.fuentes[c.fuente] && E.fuentes[c.fuente].dur, t: c.inicio })] : null,
        c.tipo === "secuencia" ? ["Abrir la secuencia", () => hacer({ op: "secuencia_activar", id: c.secuencia })] : null);
    }
    if (d.tipo === "toma") {
      const x = tomaPlana(d.g, d.k);
      if (x && !x.negro) items.push("-", ["Estabilizar", () => estabilizar({ tipo: "toma", g: d.g, k: d.k })],
        ["Abrir en el monitor de origen", () => abrirOrigen({ alias: x.fuente, tipo: "video", dur: E.fuentes[x.fuente] && E.fuentes[x.fuente].dur, t: x.inicio })]);
    }
  }
  function tecla(e, ctrl) {
    const k = e.key;
    if (ctrl && (k === "l" || k === "L")) {
      e.preventDefault();
      const sels = E.multi.filter((s) => s.tipo === "clips").map((s) => s.i);
      if (!sels.length) { toast("Selecciona clips de las pistas V2+ o A para enlazarlos", "info"); return true; }
      const cs = sels.map((i) => V().clips[i]);
      if (cs.every((c) => c && c.enlace)) hacer({ op: "clips_desenlazar", is: sels });
      else if (sels.length >= 2) hacer({ op: "clips_enlazar", is: sels });
      else toast("Selecciona al menos dos clips para enlazarlos", "info");
      return true;
    }
    if (ctrl) return false;
    if ((k === "Delete" || k === "Backspace") && e.shiftKey && E.sel && E.sel.tipo === "clips") { e.preventDefault(); hacer({ op: "clip_ripple_borrar", i: E.sel.i }); return true; }
    if (e.altKey && /^[1-4]$/.test(k)) { e.preventDefault(); espacio(["importar", "editar", "animar", "exportar"][Number(k) - 1]); return true; }
    if (k === ",") { e.preventDefault(); colocar("insertar"); return true; }
    if (k === ".") { e.preventDefault(); colocar("sobrescribir"); return true; }
    if (P.origen && P.enfoque === "origen" && !$("#mon-origen").hidden) {
      const o = P.origen;
      if (k === "i" || k === "I") { marcaO("in"); return true; }
      if (k === "o" || k === "O") { marcaO("out"); return true; }
      if (k === " ") { e.preventDefault(); playO(); return true; }
      if (k === "ArrowLeft" || k === "ArrowRight") { e.preventDefault(); irO(o.t + (k === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : 1 / (V().fps || 30))); return true; }
      if (k === "j" || k === "J") { irO(o.t - 1); return true; }
      if (k === "l" || k === "L") { irO(o.t + 1); return true; }
      if (k === "k" || k === "K") { if (o.vid) o.vid.pause(); return true; }
    }
    if (P.pluma && (k === "Enter" || k === "Escape")) { terminarPluma(k === "Enter"); return true; }
    return false;
  }

  // ================================================================== monitor de origen
  function monitor(modo) {
    const ancho = ($("#wd-mid .wd-centro") || { clientWidth: 1000 }).clientWidth;
    if (modo === "dividido" && ancho < 620) { toast("Hay poco espacio para dividir: se muestra solo el origen", "info", 1800); modo = "origen"; }
    E.monitor = modo; lsSet("wded_monitor", modo);
    $$("#mon-sel button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mon === modo)));
    $("#monitores").classList.toggle("dividido", modo === "dividido");
    $("#mon-origen").hidden = modo === "programa";
    $("#mon-prog").hidden = modo === "origen";
    if (modo !== "programa") { if (!P.origen) pintarOrigenVacio(); P.enfoque = "origen"; } else P.enfoque = "programa";
    requestAnimationFrame(() => { ED.dimensionarVisor(); ajustarOrigen(); });
  }
  function pintarOrigenVacio() {
    $("#mon-origen").innerHTML = `<div class="vacio-guia">${ico("monitor-play", 30)}<b>Monitor de origen</b><span>Haz doble clic en un medio (panel Medios) para revisarlo aquí, marcar entrada (I) y salida (O), e insertarlo (,) o sobrescribir (.) en las pistas de destino.</span></div>`;
  }
  async function abrirOrigen(m) {
    if (!m) return;
    const alias = m.alias || null, ruta = m.ruta || (alias && E.fuentes[alias] ? E.fuentes[alias].ruta : null);
    const tipo = m.tipo || (alias && E.fuentes[alias] ? E.fuentes[alias].tipo : "video");
    const dur = m.dur || (alias && E.fuentes[alias] ? E.fuentes[alias].dur : null) || (tipo === "imagen" ? 5 : null);
    const prev = P.origen && P.origen.ruta === ruta ? P.origen : null;
    P.origen = { alias, ruta, tipo, dur: dur || 0, nombre: (m.nombre || (ruta || alias || "").split(/[\\/]/).pop()).replace(/\.[^.]+$/, ""), t: m.t ?? (prev ? prev.t : 0),
      in: prev ? prev.in : null, out: prev ? prev.out : null, calidad: lsGet("wded_origen_calidad", "auto") };
    if (E.monitor === "programa") monitor(($("#wd-mid .wd-centro").clientWidth || 0) >= 900 ? "dividido" : "origen");
    pintarOrigen();
  }
  function srcOrigen() {
    const o = P.origen, pr = ED.player && ED.player._P.proxies;
    const hayProxy = o.alias && pr && pr[o.alias] && pr[o.alias].estado === "listo";
    const usarProxy = o.calidad === "ligera" ? hayProxy : o.calidad === "original" ? false : hayProxy;
    if (usarProxy) return { url: `media/demo.mp4`, calidad: "Ligera (1/2)" };
    return { url: `${ED.pidURL()}/editor/audio?fuente=${encodeURIComponent(o.alias || o.ruta)}`, calidad: "Completa" };
  }
  function pintarOrigen() {
    const o = P.origen, cont = $("#mon-origen"); if (!o || !cont) return;
    cont.innerHTML = "";
    pintarBarraO._ya = null;
    const src = srcOrigen();
    const vis = el("div", { class: "mo-vis", id: "mo-vis" });
    if (o.tipo === "imagen") vis.append(el("img", { src: src.url, alt: "", draggable: "false" }));
    else if (o.tipo === "musica") { vis.append(el("canvas", { class: "mo-onda", id: "mo-onda" })); o.aud = el("audio", { src: src.url, preload: "auto" }); vis.append(o.aud); }
    else { o.vid = el("video", { src: src.url, preload: "auto", playsinline: true }); o.vid.muted = false; vis.append(o.vid); }
    const medio = o.vid || o.aud;
    if (medio) {
      medio.addEventListener("loadedmetadata", () => { if (!o.dur && medio.duration && isFinite(medio.duration)) { o.dur = medio.duration; pintarBarraO(); } medio.currentTime = o.t; ajustarOrigen(); });
      medio.addEventListener("timeupdate", () => { o.t = medio.currentTime; pintarBarraO(); });
      medio.addEventListener("play", () => { const b = $("#mo-play"); if (b) { b.innerHTML = ico("pause", 16); b.classList.add("on"); } });
      medio.addEventListener("pause", () => { const b = $("#mo-play"); if (b) { b.innerHTML = ico("play", 16); b.classList.remove("on"); } });
    }
    const selCal = el("select", { class: "chico", title: "Calidad del origen: ligera (1/2, fluida) o completa (el archivo original)", "aria-label": "Calidad del monitor de origen" },
      ...[["auto", "Auto"], ["ligera", "1/2"], ["original", "Completa"]].map(([v, t]) => el("option", { value: v, selected: v === o.calidad }, t)));
    selCal.onchange = () => { o.calidad = selCal.value; lsSet("wded_origen_calidad", o.calidad); pintarOrigen(); };
    const barra = el("div", { class: "mo-barra", id: "mo-barra", title: "Arrastra para buscar" }, el("div", { class: "mo-io", id: "mo-io" }), el("div", { class: "mo-cab", id: "mo-cab" }));
    barra.addEventListener("pointerdown", (e) => {
      const r = barra.getBoundingClientRect();
      const ir = (ev) => irO(clamp((ev.clientX - r.left) / r.width, 0, 1) * (o.dur || 0));
      ir(e); arrastre(e, ir, () => {});
    });
    const tc = el("span", { class: "tc num", id: "mo-tc" }, ED.timecode(o.t, V() ? V().fps : 30));
    const bt = (id, icono, tit, fn, cls = "ib") => el("button", { class: cls, id, title: tit, "aria-label": tit, html: ico(icono, 15), onclick: fn });
    const drag = (tipo, icono, tit) => {
      const b = el("span", { class: "mo-drag", draggable: "true", title: tit, "aria-label": tit, html: ico(icono, 14) });
      b.addEventListener("dragstart", (e) => {
        const [a, bb] = rangoO();
        e.dataTransfer.setData("application/x-wdvs", JSON.stringify({ k: "origen", alias: o.alias, ruta: o.ruta, tipo: o.tipo, in: a, out: bb, video: tipo !== "audio" && o.tipo !== "musica", audio: tipo !== "video" && o.tipo !== "imagen" }));
        e.dataTransfer.effectAllowed = "copy";
      });
      return b;
    };
    cont.append(
      el("div", { class: "mo-top" }, el("b", { class: "mo-nom", title: o.ruta || o.alias }, o.nombre), el("span", { class: "tenue num", id: "mo-rango" }), el("span", { class: "espacio" }), selCal,
        bt("mo-cerrar", "x", "Cerrar el monitor de origen", () => { P.origen = null; if (o.vid) o.vid.pause(); monitor("programa"); })),
      vis, barra,
      el("div", { class: "mo-trans" }, tc,
        el("div", { class: "mo-ctl" }, bt("mo-in", "log-in", "Marcar entrada (I)", () => marcaO("in")), bt("mo-ir-in", "skip-back", "Ir a la entrada", () => irO(rangoO()[0])),
          bt("mo-play", "play", "Reproducir / pausa (Espacio)", playO, "ib play"), bt("mo-ir-out", "skip-forward", "Ir a la salida", () => irO(rangoO()[1])), bt("mo-out", "log-out", "Marcar salida (O)", () => marcaO("out"))),
        el("div", { class: "mo-acc" },
          bt("mo-insertar", "arrow-down-to-line", "Insertar en el cabezal, en las pistas de destino (,)", () => colocar("insertar"), "ib acento"),
          bt("mo-sobrescribir", "replace", "Sobrescribir en el cabezal, en las pistas de destino (.)", () => colocar("sobrescribir"), "ib acento"),
          o.tipo !== "musica" ? drag("video", "film", "Arrastra solo el video a una pista V") : null,
          o.tipo !== "imagen" ? drag("audio", "audio-lines", "Arrastra solo el audio a una pista A") : null,
          o.tipo === "video" ? bt("mo-foto", "camera", "Exportar fotograma (PNG del cuadro actual a resolución completa)", exportarFotograma) : null)));
    cont.addEventListener("pointerdown", () => { P.enfoque = "origen"; }, { capture: true });
    if (o.tipo === "musica" && o.alias) ondaOrigen();
    pintarBarraO(); ajustarOrigen();
  }
  function ajustarOrigen() { /* el video usa object-fit: contain dentro de .mo-vis (equivale a «Ajustar») */ }
  function rangoO() { const o = P.origen; const a = o.in ?? 0, b = o.out ?? (o.dur || (o.tipo === "imagen" ? 5 : 0)); return [r3(a), r3(Math.max(a, b))]; }
  function marcaO(cual) {
    const o = P.origen; if (!o) return;
    if (cual === "in") { o.in = r3(o.t); if (o.out !== null && o.out <= o.in) o.out = null; }
    else { o.out = r3(o.t); if (o.in !== null && o.in >= o.out) o.in = null; }
    pintarBarraO();
  }
  function irO(t) {
    const o = P.origen; if (!o) return;
    o.t = clamp(t, 0, o.dur || t); const m = o.vid || o.aud; if (m) m.currentTime = o.t;
    pintarBarraO();
  }
  function playO() { const o = P.origen, m = o && (o.vid || o.aud); if (!m) return; if (m.paused) { if (E.reproduciendo) ED.pausa(); const [, b] = rangoO(); if (o.out !== null && m.currentTime >= b - 0.05) m.currentTime = rangoO()[0]; m.play().catch(() => {}); } else m.pause(); }
  function pintarBarraO() {
    const o = P.origen; if (!o) return;
    const d = o.dur || 1, [a, b] = rangoO();
    const io = $("#mo-io"), cab = $("#mo-cab");
    if (io) { io.style.left = (100 * a / d) + "%"; io.style.width = (100 * (b - a) / d) + "%"; io.classList.toggle("marcado", o.in !== null || o.out !== null); }
    if (cab) cab.style.left = (100 * o.t / d) + "%";
    const tc = $("#mo-tc"); if (tc) tc.textContent = ED.timecode(o.t, V() ? V().fps : 30);
    const rg = $("#mo-rango"); if (rg) rg.textContent = o.in !== null || o.out !== null ? `${fmt(a)} → ${fmt(b)} · ${(b - a).toFixed(2)} s` : (o.dur ? fmt(o.dur) : "");
    const m = o.vid || o.aud; if (m && !m.paused && o.out !== null && m.currentTime >= b) m.pause();
    if (!pintarBarraO._ya || pintarBarraO._ya !== o) { pintarBarraO._ya = o; contenidoOrigen(); }
  }
  async function ondaOrigen() {
    const o = P.origen, cv = $("#mo-onda"); if (!cv) return;
    const r = await pedir(`${ED.pidURL()}/editor/onda?fuente=${encodeURIComponent(o.alias)}&por_s=40`); if (!r.ok || !cv.isConnected) return;
    cv.width = cv.clientWidth || 400; cv.height = cv.clientHeight || 120;
    const g = cv.getContext("2d"), n = r.d.picos.length, h = cv.height;
    g.fillStyle = "rgba(190,245,215,.6)";
    for (let x = 0; x < cv.width; x++) { const p = r.d.picos[Math.floor(x / cv.width * n)] || 0; g.fillRect(x, h / 2 - p * h / 2, 1, Math.max(1, p * h)); }
  }
  function exportarFotograma() {
    const o = P.origen; if (!o) return;
    const a = el("a", { href: `media/poster.jpg`, download: `${o.nombre}_${o.t.toFixed(2).replace(".", "_")}.jpg` });
    document.body.append(a); a.click(); a.remove();
    toast("Fotograma exportado (carpeta de descargas)", "info", 2000);
  }
  // alias del medio de origen en el plan (lo agrega a fuentes si hace falta)
  async function aliasDe(o) {
    if (o.alias && E.fuentes[o.alias]) return o.alias;
    const nr = (r) => String(r || "").replace(/\\/g, "/").toLowerCase();
    const ya = Object.entries(E.fuentes).find(([, f]) => nr(f.ruta) === nr(o.ruta));
    if (ya) return (o.alias = ya[0]);
    const ok = await hacer({ op: "fuente_agregar", ruta: o.ruta, rol: o.tipo === "imagen" ? "imagen" : o.tipo === "musica" ? "musica" : "video" }, { reInsp: false });
    if (!ok) return null;
    const f = Object.entries(E.fuentes).find(([, f2]) => nr(f2.ruta) === nr(o.ruta));
    return f ? (o.alias = f[0]) : null;
  }
  async function colocar(modo, extra = {}) {
    const o = extra.origen || P.origen;
    if (!o) return toast("Abre un medio en el monitor de origen (doble clic en Medios)", "info");
    if (!E.plan) return toast("Primero crea el video", "info");
    const [a, b] = extra.rango || rangoO();
    if (b - a < 0.04) return toast("Marca una entrada (I) y una salida (O) en el origen", "info");
    const conV = (extra.video ?? true) && o.tipo !== "musica", conA = (extra.audio ?? true) && o.tipo !== "imagen";
    let dv = extra.destino_v !== undefined ? extra.destino_v : (conV ? E.destV : null);
    const da = extra.destino_a !== undefined ? extra.destino_a : (conA ? E.destA : null);
    if (dv === 0 && o.tipo === "imagen") dv = 1;
    if (dv === null && (da === null || !conA)) return toast("Enciende una pista de destino (botón V o A en la cabecera de la pista)", "info", 3000);
    const alias = await aliasDe(o); if (!alias) return;
    const t = extra.t ?? r3(E.t);
    const ok = await hacer({ op: "clip_colocar", fuente: alias, inicio: a, dur: r3(b - a), t, modo, destino_v: conV ? dv : null, destino_a: conA ? da : null,
      video: conV, audio: conA && da !== null, tipo: o.tipo === "imagen" ? "imagen" : undefined });
    if (ok && extra.t === undefined) ED.ponerT(t + (b - a), { seguir: true });
    return ok;
  }
  function soltarOrigen(d, pista, capa, apista, t) {
    const o = { alias: d.alias, ruta: d.ruta, tipo: d.tipo, nombre: "" };
    const ext = { origen: o, rango: [d.in, d.out], t, video: d.video, audio: d.audio };
    if (pista === "video") { ext.destino_v = 0; ext.destino_a = d.audio ? (E.destA || 1) : null; }
    else if (pista === "overlays") { ext.destino_v = Number(capa); ext.destino_a = d.audio ? (E.destA || 1) : null; }
    else if (pista === "audio") { ext.video = false; ext.destino_v = null; ext.destino_a = Number(apista); }
    else return toast("Suelta en una pista V o A", "info");
    return colocar("sobrescribir", ext);
  }
  function soltarMedio(d, alias, pista, capa, apista, t) {
    const dur = d.tipo === "musica" ? (d.dur || 10) : Math.min(d.dur || 5, d.tipo === "video" ? 10 : 5);
    const o = { alias, ruta: d.ruta || (E.fuentes[alias] || {}).ruta, tipo: d.tipo };
    if (pista === "audio") return colocar("sobrescribir", { origen: o, rango: [0, r3(Math.min(dur, Math.max(1, V().total - t)))], t, video: false, destino_v: null, destino_a: Number(apista) });
    return colocar("sobrescribir", { origen: o, rango: [0, r3(dur)], t, destino_v: Number(capa), destino_a: d.tipo === "video" ? (E.destA || null) : null, audio: d.tipo === "video" && !!E.destA });
  }

  // ================================================================== visor en vivo por capas (aproximado con CSS)
  function capasCont() {
    const area = $("#visor .img-area"); if (!area) return null;
    let c = area.querySelector("#visor-capas");
    if (!c) { c = el("div", { id: "visor-capas", class: "visor-capas" }); area.append(c); P.capas.clear(); }
    return c;
  }
  // máscaras del clip como SVG de luminancia (mask-image): blanco = se ve; el calado es un desenfoque gaussiano
  function svgMascara(ms, w, h, tl) {
    if (!ms || !ms.length) return null;
    const suma = ms.some((m) => (m.modo || "sumar") === "sumar");
    let defs = "", cuerpo = `<rect width="${w}" height="${h}" fill="${suma ? "black" : "white"}"/>`;
    ms.forEach((m0, j) => {
      const m = { ...m0 };
      for (const p of ["x", "y", "w", "h", "feather", "expansion", "opacidad"]) if ((m0.keyframes || []).some((k) => k[p] !== undefined)) m[p] = ED.interp(m0.keyframes, p, tl, m0[p] ?? (p === "opacidad" ? 1 : 0));
      const e = m.expansion || 0, f = m.feather || 0, op = m.opacidad ?? 1;
      const dentro = m.modo === "restar" ? "black" : "white", otro = dentro === "white" ? "black" : "white";
      const relleno = m.invertir ? otro : dentro;
      let forma;
      if (m.tipo === "pluma") forma = `<polygon points="${(m.puntos || []).map((q) => `${q[0] * w},${q[1] * h}`).join(" ")}" fill="${relleno}" stroke="${relleno}" stroke-width="${Math.max(0, 2 * e)}" stroke-linejoin="round"/>`;
      else {
        const x = (m.x ?? 0) * w - e, y = (m.y ?? 0) * h - e, ww = (m.w ?? 1) * w + 2 * e, hh = (m.h ?? 1) * h + 2 * e;
        forma = m.tipo === "elipse" ? `<ellipse cx="${x + ww / 2}" cy="${y + hh / 2}" rx="${Math.abs(ww / 2)}" ry="${Math.abs(hh / 2)}" fill="${relleno}"/>` : `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${relleno}"/>`;
      }
      defs += `<filter id="f${j}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f / 2}"/></filter>`;
      const fondo = m.invertir ? `<rect x="${-w}" y="${-h}" width="${3 * w}" height="${3 * h}" fill="${dentro}"/>` : "";
      cuerpo += `<g filter="url(#f${j})" opacity="${op}">${fondo}${forma}</g>`;
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none"><defs>${defs}</defs>${cuerpo}</svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }
  function geometria(c, sw, sh) {
    const v = V(), fit = Math.min(v.VW / Math.max(1, sw), v.VH / Math.max(1, sh)), e = (c.escala ?? 1);
    const cw = sw * fit * e, ch = sh * fit * e;
    return { cw, ch, cx: v.VW / 2 + (c.x || 0), cy: v.VH / 2 + (c.y || 0) };
  }
  function pintar(t, jugando) {
    const cont = capasCont(); if (!cont || !E.plan) return;
    const v = V(), f = (cont.clientWidth || 1) / v.VW;
    const vivos = new Set();
    const mates = new Set((v.clips || []).filter((c) => c.mate && c.mate.clip).map((c) => c.mate.clip));
    const porId = Object.fromEntries((v.clips || []).filter((c) => c.id).map((c) => [c.id, c]));
    for (const c0 of (v.clips || []).filter((c) => c.visual && !c.deshabilitado && t >= c.a - 1e-6 && t < c.b).sort((a, b) => a.pista - b.pista)) {
      if (E.oculto["capa" + c0.pista] || mates.has(c0.id)) continue;
      const c = P.vivo && P.vivo.i === c0.i ? { ...c0, ...P.vivo.props } : c0;
      const key = `${c.i}:${c.tipo}:${c.fuente || c.secuencia || ""}`;
      let n = P.capas.get(key);
      if (!n) {
        if (c.tipo === "video") { n = el("video", { muted: true, playsinline: true, preload: "auto", class: "capa-clip" }); n.muted = true; }
        else if (c.tipo === "imagen") n = el("img", { class: "capa-clip", draggable: "false", alt: "" });
        else if (c.tipo === "ajuste") n = el("div", { class: "capa-clip capa-ajuste" });
        else n = el("div", { class: "capa-clip capa-sec" }, el("span", {}, nombreClip(c)), el("small", {}, "Vista exacta con «Vista previa»"));
        n._key = key; P.capas.set(key, n); cont.append(n);
      }
      vivos.add(key);
      const tl = t - c.a;
      // fuente
      if (c.tipo === "video" || c.tipo === "imagen") {
        const pr = ED.player && ED.player._P.proxies, listo = pr && pr[c.fuente] && pr[c.fuente].estado === "listo";
        const url = c.tipo === "video" && listo ? `media/demo.mp4` : `${ED.pidURL()}/editor/audio?fuente=${encodeURIComponent(c.fuente)}`;
        if (n._url !== url) { n._url = url; n.src = url; }
      }
      if (c.tipo === "video") {
        const dest = (c.inicio || 0) + tl * (c.velocidad || 1);
        if (jugando) {
          if (Math.abs((n.playbackRate || 1) - (c.velocidad || 1)) > 1e-3) n.playbackRate = clamp(c.velocidad || 1, 0.0625, 16);
          if (Math.abs(n.currentTime - dest) > 0.25 && !n.seeking) n.currentTime = dest;
          if (n.paused) n.play().catch(() => {});
        } else { if (!n.paused) n.pause(); if (Math.abs(n.currentTime - dest) > 0.03 && !n.seeking) n.currentTime = dest; }
      }
      // geometría
      let sw = v.VW, sh = v.VH;
      if (c.tipo === "video" && n.videoWidth) { sw = n.videoWidth; sh = n.videoHeight; }
      if (c.tipo === "imagen" && n.naturalWidth) { sw = n.naturalWidth; sh = n.naturalHeight; }
      if (c.tipo === "ajuste") { Object.assign(n.style, { left: 0, top: 0, width: "100%", height: "100%" }); }
      else {
        const g = geometria(c, sw, sh);
        Object.assign(n.style, { left: ((g.cx - g.cw / 2) * f) + "px", top: ((g.cy - g.ch / 2) * f) + "px", width: (g.cw * f) + "px", height: (g.ch * f) + "px" });
        n._g = g;
        if (c.mascaras.length) { const mk = svgMascara(c.mascaras, Math.round(g.cw), Math.round(g.ch), tl); n.style.maskImage = n.style.webkitMaskImage = mk; n.style.maskMode = "luminance"; n.style.maskSize = "100% 100%"; }
        else n.style.maskImage = n.style.webkitMaskImage = "";
        // mate de pista con una imagen: se aproxima con mask-image (alfa o luma)
        const mt = c.mate && porId[c.mate.clip];
        if (mt && mt.tipo === "imagen" && t >= mt.a && t < mt.b) {
          const im = `${ED.pidURL()}/editor/audio?fuente=${encodeURIComponent(mt.fuente)}`;
          const mn = P.capas.get("dims:" + mt.fuente) || { w: 1, h: 1 };
          const gm = geometria(mt, mn.w, mn.h);
          n.style.maskImage = n.style.webkitMaskImage = `url("${im}")`; n.style.maskMode = mt && c.mate.tipo === "luma" ? "luminance" : "alpha";
          n.style.maskSize = `${gm.cw * f}px ${gm.ch * f}px`; n.style.maskRepeat = "no-repeat";
          n.style.maskPosition = `${(gm.cx - gm.cw / 2 - (g.cx - g.cw / 2)) * f}px ${(gm.cy - gm.ch / 2 - (g.cy - g.ch / 2)) * f}px`;
          if (!P.capas.has("dims:" + mt.fuente)) { const img = new Image(); img.onload = () => { P.capas.set("dims:" + mt.fuente, { w: img.naturalWidth, h: img.naturalHeight }); }; img.src = im; P.capas.set("dims:" + mt.fuente, { w: 1, h: 1 }); }
        }
      }
      n.style.transform = c.rotacion ? `rotate(${c.rotacion}deg)` : "";
      n.style.opacity = valorKf(c.opacidad_kf, tl, c.opacidad ?? 1);
      n.style.mixBlendMode = FUSION_CSS[c.fusion] || "normal";
      n.style.zIndex = String(10 + c.pista);
      if (c.tipo === "ajuste") {
        const a = c.ajuste || {}, fl = [];
        if (a.contraste !== undefined) fl.push(`contrast(${a.contraste})`);
        if (a.saturacion !== undefined) fl.push(`saturate(${a.saturacion})`);
        if (a.brillo) fl.push(`brightness(${1 + a.brillo})`);
        if (a.tono) fl.push(`hue-rotate(${a.tono}deg)`);
        if (a.desenfoque) fl.push(`blur(${a.desenfoque * f}px)`);
        if (a.byn) fl.push("grayscale(1)");
        if (a.invertir) fl.push("invert(1)");
        n.style.backdropFilter = n.style.webkitBackdropFilter = fl.join(" ") || "none";
        n.style.boxShadow = a.vineta ? "inset 0 0 120px rgba(0,0,0,.65)" : "";
        if (c.mascaras.length) { const mk = svgMascara(c.mascaras, v.VW, v.VH, tl); n.style.maskImage = n.style.webkitMaskImage = mk; n.style.maskMode = "luminance"; n.style.maskSize = "100% 100%"; } else n.style.maskImage = n.style.webkitMaskImage = "";
      }
      n.classList.toggle("sel", !jugando && E.multi.some((s) => s.tipo === "clips" && s.i === c.i));
      n._c = c; n.style.display = "";
    }
    for (const [k, n] of P.capas) if (!k.startsWith("dims:") && !vivos.has(k)) { if (n.tagName === "VIDEO" && !n.paused) n.pause(); n.style.display = "none"; }
    if (P.capas.size > 40) for (const [k, n] of [...P.capas]) if (!k.startsWith("dims:") && !vivos.has(k)) { n.remove(); P.capas.delete(k); }
  }
  function pausaCapas() { for (const n of P.capas.values()) if (n.tagName === "VIDEO" && !n.paused) n.pause(); }
  function vivoClip(i, props) { P.vivo = { i, props: { ...(P.vivo && P.vivo.i === i ? P.vivo.props : {}), ...props } }; pintar(E.t, false); clearTimeout(P.vivoT); P.vivoT = setTimeout(() => { P.vivo = null; }, 1500); }
  // arrastrar un clip en el visor = mover X/Y
  function enlazarVisor() {
    const vis = $("#visor"); if (!vis || vis._pro) return; vis._pro = true;
    vis.addEventListener("pointerdown", (e) => {
      if (P.pluma) return puntoPluma(e);
      const n = e.target.closest(".capa-clip"); if (!n || !n._c || E.reproduciendo || n.classList.contains("capa-ajuste")) return;
      e.preventDefault(); e.stopPropagation();
      const c = n._c;
      if (!E.multi.some((s) => s.tipo === "clips" && s.i === c.i)) ED.seleccionar({ tipo: "clips", i: c.i, a: c.a, b: c.b }, "solo");
      const f = ($("#visor-capas").clientWidth || 1) / V().VW, x0 = e.clientX, y0 = e.clientY, cx = c.x || 0, cy = c.y || 0;
      let nx = cx, ny = cy;
      arrastre(e, (ev) => { nx = Math.round(cx + (ev.clientX - x0) / f); ny = Math.round(cy + (ev.clientY - y0) / f); vivoClip(c.i, { x: nx, y: ny }); }, () => {
        if (nx !== cx || ny !== cy) hacer({ op: "lista_props", lista: "clips", i: c.i, props: { x: nx || null, y: ny || null } }, { mantenerSel: true });
      });
    }, { capture: true });
  }
  // máscara con la pluma: clics en el visor sobre el clip seleccionado
  function dibujarPluma(i, j) {
    const c = V().clips[i]; if (!c) return;
    if (!(E.t >= c.a && E.t < c.b)) ED.ponerT(c.a + Math.min(0.5, c.dur / 2));
    P.pluma = { i, j, pts: [] };
    const vis = $("#visor");
    vis.classList.add("dibujando");
    let svg = vis.querySelector("#pluma-svg"); if (!svg) { svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.id = "pluma-svg"; vis.append(svg); }
    toast("Pluma: haz clic en el visor para poner puntos sobre el clip. Enter o doble clic cierra la máscara; Esc cancela.", "info", 5000);
  }
  function puntoPluma(e) {
    const pl = P.pluma; if (!pl) return;
    e.preventDefault(); e.stopPropagation();
    const n = [...P.capas.values()].find((q) => q._c && q._c.i === pl.i && q.style.display !== "none");
    if (!n) return toast("El clip no está en el visor en este instante", "info");
    const r = n.getBoundingClientRect();
    if (e.detail >= 2) return terminarPluma(true);
    pl.pts.push([r3(clamp((e.clientX - r.left) / r.width, -0.5, 1.5)), r3(clamp((e.clientY - r.top) / r.height, -0.5, 1.5))]);
    const vr = $("#visor").getBoundingClientRect(), svg = $("#pluma-svg");
    svg.setAttribute("width", vr.width); svg.setAttribute("height", vr.height);
    svg.innerHTML = `<polyline points="${pl.pts.map((p) => `${r.left - vr.left + p[0] * r.width},${r.top - vr.top + p[1] * r.height}`).join(" ")}" />` + pl.pts.map((p) => `<circle r="4" cx="${r.left - vr.left + p[0] * r.width}" cy="${r.top - vr.top + p[1] * r.height}"/>`).join("");
  }
  function terminarPluma(ok) {
    const pl = P.pluma; P.pluma = null;
    const vis = $("#visor"); vis.classList.remove("dibujando"); const s = $("#pluma-svg"); if (s) s.remove();
    if (!ok || !pl || pl.pts.length < 3) { if (ok) toast("Pon al menos 3 puntos", "info"); return; }
    const k = (E.plan.clips || [])[pl.i]; if (!k) return;
    const ms = [...(k.mascaras || [])]; ms[pl.j] = { ...(ms[pl.j] || {}), tipo: "pluma", puntos: pl.pts, feather: (ms[pl.j] || {}).feather ?? 12 };
    hacer({ op: "lista_props", lista: "clips", i: pl.i, props: { mascaras: ms } });
  }

  // ================================================================== audio: clips A en vivo y medidores dB
  function ganancia(Pp, k) {
    if (!Pp.gan[k]) { Pp.gan[k] = Pp.ctx.createGain(); Pp.gan[k].connect(Pp.master); }
    Pp.gan[k].gain.value = (E.mute[k] || (E.solo && E.solo !== k)) ? 0 : 1;
    return Pp.gan[k];
  }
  async function programarAudio(Pp, reloj, desfase) {
    const ctx = Pp.ctx; if (!ctx) return;
    const t = reloj() + 0.05;
    for (const c of (V().clips || []).filter((x) => x.audio && !x.deshabilitado && x.b > t && x.fuente)) {
      const url = `${ED.pidURL()}/editor/audio_ext?fuente=${encodeURIComponent(c.fuente)}`;
      if (!Pp.buffers[url]) Pp.buffers[url] = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => b && ctx.decodeAudioData(b)).catch(() => null);
      const buf = await Pp.buffers[url];
      if (!buf || !Pp.jugando) continue;
      const ahora = reloj() + 0.05; if (c.b <= ahora) continue;
      const vel = c.velocidad || 1, off = Math.max(0, ahora - c.a), L = c.dur;
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = vel;
      const g = ctx.createGain(); src.connect(g); g.connect(ganancia(Pp, "a" + c.pista));
      const when = Math.max(c.a, ahora) + desfase();
      // envolvente: volumen × keyframes × fundidos, muestreada cada 50 ms
      const vol = (u) => (c.volumen ?? 1) * valorKf(c.volumen_kf, u, 1) * Math.max(0, Math.min(1, c.fade_in > 0 ? u / c.fade_in : 1, c.fade_out > 0 ? (L - u) / c.fade_out : 1));
      g.gain.setValueAtTime(vol(off), when);
      for (let u = off + 0.05; u < L; u += 0.05) g.gain.linearRampToValueAtTime(vol(u), when + (u - off));
      g.gain.linearRampToValueAtTime(0, when + (L - off));
      src.start(when, (c.inicio || 0) + off * vel, Math.max(0.01, (L - off) * vel));
      Pp.nodos.push(src);
    }
  }
  // medidores: analizadores en el master (L/R) y por pista; se leen con requestAnimationFrame mientras suena algo
  function medidores(Pp) {
    if (!Pp.ctx || P.vu) return;
    const ctx = Pp.ctx;
    const sp = ctx.createChannelSplitter(2);
    const an = [ctx.createAnalyser(), ctx.createAnalyser()];
    for (const a of an) { a.fftSize = 1024; a.smoothingTimeConstant = 0; }
    Pp.master.connect(sp); sp.connect(an[0], 0); sp.connect(an[1], 1);
    P.vu = { an, pistas: {}, pico: [-60, -60], buf: new Float32Array(1024), Pp };
  }
  function dbDe(a, buf) {
    a.getFloatTimeDomainData(buf);
    let s = 0, pk = 0; for (let i = 0; i < buf.length; i++) { s += buf[i] * buf[i]; pk = Math.max(pk, Math.abs(buf[i])); }
    return [20 * Math.log10(Math.sqrt(s / buf.length) + 1e-9), 20 * Math.log10(pk + 1e-9)];
  }
  const pct = (db) => clamp((db + 60) / 60, 0, 1) * 100;
  function pintarMedidores() {
    const m = $("#tl-medidores"); if (!m) return;
    if (!m.firstChild) {
      m.innerHTML = `<div class="vu-cab" title="Medidores de audio (dBFS)">dB</div><div class="vu-canales"><div class="vu-c"><i class="vu-rms"></i><i class="vu-pico"></i></div><div class="vu-c"><i class="vu-rms"></i><i class="vu-pico"></i></div>
        <div class="vu-escala">${[0, -6, -12, -24, -48].map((d) => `<span style="bottom:${pct(d)}%">${d}</span>`).join("")}</div></div><div class="vu-lr"><span>L</span><span>R</span></div>`;
    }
  }
  function bucleVu() {
    cancelAnimationFrame(P.rafVu);
    const paso = () => {
      const vu = P.vu; if (!vu) return;
      const activo = E.reproduciendo || P.rec;
      const cs = $$("#tl-medidores .vu-c");
      vu.an.forEach((a, i) => {
        const [rms, pk] = activo ? dbDe(a, vu.buf) : [-90, -90];
        vu.pico[i] = Math.max(pk, vu.pico[i] - 0.6);
        const c = cs[i]; if (!c) return;
        c.firstChild.style.height = pct(rms) + "%"; c.lastChild.style.bottom = pct(vu.pico[i]) + "%";
        c.classList.toggle("sat", vu.pico[i] > -0.5);
      });
      for (const [k, g] of Object.entries(vu.Pp.gan || {})) {
        if (!vu.pistas[k]) { const a = vu.Pp.ctx.createAnalyser(); a.fftSize = 512; g.connect(a); vu.pistas[k] = a; }
        const b = document.querySelector(`.tl-vu[data-vu="${k}"] > i`);
        if (b) b.style.height = pct(activo ? dbDe(vu.pistas[k], new Float32Array(512))[0] : -90) + "%";
      }
      if (P.rec && P.rec.an) { const b = document.querySelector(`.tl-vu[data-vu="a${P.rec.pista}"] > i`); if (b) b.style.height = pct(dbDe(P.rec.an, new Float32Array(512))[0]) + "%"; }
      if (activo || vu.pico.some((x) => x > -59)) P.rafVu = requestAnimationFrame(paso);
    };
    P.rafVu = requestAnimationFrame(paso);
  }
  function alReproducir(Pp) { medidores(Pp); pintarMedidores(); bucleVu(); }

  // ================================================================== voz en off (micrófono)
  async function grabarVoz(pista) {
    if (P.rec) return pararGrabacion();
    if (!E.plan) return toast("Primero crea el video", "info");
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast("Este navegador no puede grabar audio", "error");
    const p = pista || E.destA || 1;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { return toast("No se pudo usar el micrófono: " + (e.message || e.name) + ". Revisa el permiso del navegador.", "error"); }
    const tipo = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
    const mr = new MediaRecorder(stream, tipo ? { mimeType: tipo } : {});
    const partes = [];
    mr.ondataavailable = (ev) => { if (ev.data.size) partes.push(ev.data); };
    const t0 = r3(E.t);
    const AC = window.AudioContext || window.webkitAudioContext;
    let an = null, actx = null;
    try { actx = new AC(); an = actx.createAnalyser(); an.fftSize = 512; actx.createMediaStreamSource(stream).connect(an); } catch { /* sin medidor */ }
    P.rec = { mr, stream, t0, pista: p, an, actx, inicio: performance.now() };
    mr.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop()); if (actx) actx.close().catch(() => {});
      const blob = new Blob(partes, { type: tipo || "audio/webm" });
      const r = P.rec; P.rec = null; indicadorRec(false);
      const T = window.WDVS && WDVS.tareas, id = "voz:" + Date.now();
      if (T) T.poner(id, { titulo: "Voz en off", tipo: "subir", texto: "Guardando la grabación…", frac: null });
      const fd = new FormData(); fd.append("archivo", blob, "voz.webm");
      const q = await fetch(`${ED.pidURL()}/editor/grabar`, { method: "POST", body: fd });
      const d = await q.json().catch(() => ({}));
      if (!q.ok) { if (T) T.terminar(id, false, { texto: d.detail || "No se pudo guardar la grabación" }); else toast(d.detail || "No se pudo guardar la grabación"); return; }
      const o = { ruta: d.ruta, tipo: "musica", nombre: d.nombre };
      const dur = r3(d.dur || (performance.now() - r.inicio) / 1000);
      const ok = await colocar("sobrescribir", { origen: o, rango: [0, dur], t: r.t0, video: false, destino_v: null, destino_a: r.pista });
      await ED.cargar(true);
      if (T) T.terminar(id, !!ok, { texto: ok ? `Voz en off de ${dur.toFixed(1)} s en A${r.pista}` : "La grabación se guardó en Medios, pero no se pudo poner en la pista" });
    };
    mr.start(250);
    indicadorRec(true);
    if (!E.reproduciendo) ED.play();
    alReproducir(ED.player._P.ctx ? ED.player._P : { ctx: null });
    bucleVu();
  }
  function pararGrabacion() { if (!P.rec) return; if (E.reproduciendo) ED.pausa(); try { P.rec.mr.stop(); } catch { /* ya paró */ } }
  function indicadorRec(on) {
    let b = $("#ed-rec");
    if (!on) { if (b) b.remove(); clearInterval(P.recT); return; }
    b = el("button", { class: "rec-ind", id: "ed-rec", title: "Grabando voz en off: clic para detener", html: `<span class="punto"></span><span class="num" id="ed-rec-t">0:00</span>${ico("square", 12)}` });
    b.onclick = pararGrabacion;
    const tr = $("#transporte .tr-der"); if (tr) tr.prepend(b);
    P.recT = setInterval(() => { const s = $("#ed-rec-t"); if (s && P.rec) s.textContent = fmt((performance.now() - P.rec.inicio) / 1000).replace(/\.\d+$/, ""); }, 250);
  }

  // ================================================================== estabilizar (vid.stab)
  async function estabilizar(dest) {
    let fuente, inicio, dur;
    if (dest.tipo === "toma") { const x = tomaPlana(dest.g, dest.k); if (!x || x.negro) return; fuente = x.fuente; inicio = Number(x.inicio) || 0; dur = x.consumo || x.dur; }
    else { const c = V().clips[dest.i]; if (!c) return; fuente = c.fuente; inicio = c.inicio || 0; dur = c.dur * (c.velocidad || 1); }
    const r = await pedir(`${ED.pidURL()}/editor/estabilizar`, { method: "POST", json: { fuente, inicio, dur } });
    if (!r.ok) return toast(r.d.detail || "No se pudo estabilizar");
    const T = window.WDVS && WDVS.tareas, id = "estab:" + r.d.clave, clave = r.d.clave;
    const aplicar = (ruta) => hacer({ op: "estabilizado_aplicar", ruta, destino: dest });
    if (r.d.estado === "listo") { await aplicar(r.d.ruta); if (T) T.terminar(id, true, { titulo: "Estabilizar clip", texto: "Clip estabilizado (desde caché)" }); return; }
    if (T) T.poner(id, { titulo: "Estabilizar clip", tipo: "analizar", texto: `${nombreFuente(fuente)}: analizando el movimiento…`, frac: 0 });
    else toast("Estabilizando el clip en segundo plano…", "info");
    const h = setInterval(async () => {
      const q = await pedir(`${ED.pidURL()}/editor/estabilizar?clave=${encodeURIComponent(clave)}`); if (!q.ok) return;
      const e = q.d;
      if (e.estado === "trabajando" && T) T.poner(id, { titulo: "Estabilizar clip", tipo: "analizar", texto: `${nombreFuente(fuente)}: ${e.pct < 0.45 ? "analizando el movimiento" : "suavizando la cámara"}`, frac: e.pct });
      if (e.estado === "listo") { clearInterval(h); const ok = await aplicar(e.ruta); if (T) T.terminar(id, !!ok, { texto: ok ? "Clip estabilizado. Ctrl+Z vuelve al original." : "Se estabilizó, pero no se pudo aplicar al clip" }); else toast("Clip estabilizado", "info"); }
      if (e.estado === "error") { clearInterval(h); if (T) T.terminar(id, false, { texto: "No se pudo estabilizar: " + (e.error || "").slice(-160) }); else toast("No se pudo estabilizar"); }
    }, 700);
  }

  // ================================================================== espacios de trabajo
  const WS = {
    importar: { nombre: "Importar", icono: "upload", izq: () => clamp(Math.round(innerWidth * 0.34), 300, 620), der: 250, tl: 210, bib: "medios", monitor: () => (innerWidth >= 1300 ? "dividido" : "origen") },
    editar: { nombre: "Editar", icono: "scissors", izq: 272, der: 320, tl: () => (innerHeight <= 800 ? 270 : 290), monitor: "programa" },
    animar: { nombre: "Animar", icono: "person-standing", izq: () => clamp(Math.round(innerWidth * 0.25), 300, 460), der: 340, tl: 230, bib: "animar", monitor: "programa" },
    exportar: { nombre: "Exportar", icono: "share", izq: 236, der: 360, tl: 190, monitor: "programa", der_panel: "exp" },
  };
  const val = (x) => (typeof x === "function" ? x() : x);
  function pintarEspacios() {
    const slot = document.getElementById("appbar-editor") || $(".wded .wd-top");
    if (!slot) return;
    let c = slot.querySelector(".ws-tabs");
    if (!c) { c = el("div", { class: "ws-tabs segmentado", role: "tablist", "aria-label": "Espacios de trabajo" }); slot.prepend(c); }
    c.innerHTML = "";
    for (const [k, w] of Object.entries(WS)) {
      const b = el("button", { role: "tab", "aria-selected": String(P.ws === k), "aria-pressed": String(P.ws === k), title: `Espacio de trabajo: ${w.nombre} (Alt+${Object.keys(WS).indexOf(k) + 1})` }, w.nombre);
      b.onclick = () => espacio(k);
      c.append(b);
    }
    const m = el("button", { class: "ws-menu", title: "Diseño del espacio de trabajo", "aria-label": "Opciones del espacio de trabajo", html: ico("chevron-down", 12) });
    m.onclick = () => {
      const r = m.getBoundingClientRect(), est = (window.WDVS._externos || {}).mi_estilo;
      ED.menu(r.left, r.bottom + 4, [["Guardar este diseño en «" + WS[P.ws].nombre + "»", guardarDiseno], ["Restablecer «" + WS[P.ws].nombre + "»", restablecerDiseno],
        est ? "-" : null, est ? ["Mi estilo (lo que la app aprendió de cómo editas)…", () => { const c = el("div", { class: "mi-estilo" }); ED.modal("Mi estilo", c).classList.add("ancha"); try { est.montar(c); } catch (e) { console.warn(e); } }] : null]);
    };
    c.append(m);
  }
  function espacio(k, silencioso) {
    if (!WS[k]) return;
    P.ws = k; lsSet("wded_ws", k);
    const w = WS[k], guardado = (lsGet("wded_ws_disenos", {}))[k] || {};
    const mid = $("#wd-mid"), raiz = $("#wded"); if (!mid) return;
    mid.style.setProperty("--izq", (guardado.izq ?? val(w.izq)) + "px");
    mid.style.setProperty("--der", (guardado.der ?? val(w.der)) + "px");
    raiz.style.setProperty("--tl", (guardado.tl ?? val(w.tl)) + "px");
    const bib = guardado.bib || w.bib; if (bib && E.bib !== bib && $(`#bib-tabs button[data-b="${bib}"]`)) ED.elegirBib(bib);
    monitor(guardado.monitor || val(w.monitor) || "programa");
    panelExportar(k === "exportar");
    pintarEspacios();
    requestAnimationFrame(() => { ED.dimensionarVisor(); ED.renderTimeline(); });
    if (!silencioso) toast(`Espacio de trabajo: ${w.nombre}`, "info", 1200);
  }
  function guardarDiseno() {
    const d = lsGet("wded_ws_disenos", {});
    d[P.ws] = { izq: $("#wd-izq").offsetWidth, der: $("#wd-der").offsetWidth, tl: $("#tl").offsetHeight, bib: E.bib, monitor: E.monitor };
    lsSet("wded_ws_disenos", d); toast(`Diseño guardado en «${WS[P.ws].nombre}»`, "info", 1600);
  }
  function restablecerDiseno() { const d = lsGet("wded_ws_disenos", {}); delete d[P.ws]; lsSet("wded_ws_disenos", d); espacio(P.ws); }
  function panelExportar(on) {
    const tabs = $("#der-tabs"); if (!tabs) return;
    let b = tabs.querySelector('button[data-d="exp"]'), cont = $("#der-exp");
    if (!on) { if (b) { if (b.classList.contains("activa")) tabs.querySelector('button[data-d="insp"]').click(); b.remove(); } if (cont) cont.remove(); return; }
    if (!b) {
      b = el("button", { "data-d": "exp", role: "tab", "aria-selected": "false", html: `${ico("share", 14)}<span>Exportar</span>` });
      tabs.append(b);
      cont = el("div", { class: "wd-der-cont", id: "der-exp", role: "tabpanel", hidden: true });
      $("#wd-der").append(cont);
      b.onclick = () => {
        $$("#der-tabs button").forEach((x) => { x.classList.toggle("activa", x === b); x.setAttribute("aria-selected", String(x === b)); });
        for (const p of $$("#wd-der .wd-der-cont")) p.hidden = p !== cont;
        pintarExportar(cont);
      };
    }
    b.click();
  }
  function pintarExportar(cont) {
    const v = V(); cont.innerHTML = "";
    const aw = v && v.area_trabajo;
    const fila = (icono, tit, desc, fn, prim) => el("button", { class: "exp-op" + (prim ? " prim" : ""), onclick: fn }, el("span", { class: "ic", html: ico(icono, 18) }), el("span", {}, el("b", {}, tit), el("small", {}, desc)));
    cont.append(el("div", { class: "wd-scroll insp" },
      el("div", { class: "nota" }, v ? `${v.W}×${v.H} · ${v.fps} fps · ${fmt(v.total)}${aw ? ` · área de trabajo ${fmt(aw.desde)}–${fmt(aw.hasta)}` : ""}` : ""),
      fila("film", "Video MP4 final", "Calidad final a resolución completa, con todos los efectos", () => $("#ed-exportar") && ($("#ed-exportar").click()), true),
      fila("monitor-play", aw ? "Vista previa del área de trabajo" : "Vista previa exacta", aw ? "Renderiza solo la barra gris de la regla" : "Renderiza el rango I/O o todo el video", () => ED.vistaPrevia()),
      fila("share", "Proyecto para Premiere / DaVinci", "Carpeta con el proyecto editable y los medios", () => { const b = $("#ed-exportar"); if (b) b.click(); }),
      ED.guias && ED.guias.menuVersiones ? fila("layout-grid", "Versiones 9:16, 1:1 y 4:5", "Reencuadra el video para cada red", (e) => ED.guias.menuVersiones(e.clientX, e.clientY)) : null,
      el("div", { class: "nota" }, "Las tareas corren en segundo plano: sigue editando y mira su avance en el centro de tareas.")));
  }

  // ================================================================== mapa de contenido del análisis (marcadores de contenido)
  // GET …/editor/contenido: tramos de cada medio («Sobres», «Construcción de casa», «EVITAR: anuncio»…) con su clase.
  // Se ven sobre los clips de la línea de tiempo y en la barra del monitor de origen; filtro por categoría.
  const CLASE = { clave: ["Momentos clave", "#3DD68C"], accion: ["Acción", "#F5B82E"], neutra: ["Neutros", "#8B8F98"], evitar: ["EVITAR", "#FF6B70"] };
  const MAPA = { pid: null, porRuta: {}, porAlias: {}, ocultas: new Set(lsGet("wded_contenido_ocultas", [])), ver: lsGet("wded_contenido_ver", true) };
  const nrm = (r) => String(r || "").replace(/\\/g, "/").toLowerCase();
  async function cargarContenido() {
    if (MAPA.pid === E.pid) return;
    MAPA.pid = E.pid; MAPA.porRuta = {}; MAPA.porAlias = {};
    const r = await pedir(`${ED.pidURL()}/editor/contenido`); if (!r.ok) return;
    for (const m of r.d.medios || []) { MAPA.porRuta[nrm(m.ruta)] = m.tramos; if (m.alias) MAPA.porAlias[m.alias] = m.tramos; }
    ED.renderTimeline(); pintarBotonContenido();
  }
  function tramosDe(alias, ruta) {
    const ts = (alias && MAPA.porAlias[alias]) || MAPA.porRuta[nrm(ruta || (alias && E.fuentes[alias] ? E.fuentes[alias].ruta : ""))] || [];
    return ts.filter((x) => !MAPA.ocultas.has(x.clase));
  }
  const hayMapa = () => Object.keys(MAPA.porRuta).length > 0;
  function etiquetaTramo(x) { return `${x.clase === "evitar" ? "EVITAR: " : ""}${x.valor}${x.conf < 0.6 ? " (?)" : ""}`; }
  function pintarContenidoTimeline() {
    if (!MAPA.ver || !hayMapa()) return;
    const fv = $('#tl-cont .tl-fila[data-pista="video"] .tl-carril'); if (!fv) return;
    for (const x of ED.tomasPlanas()) {
      if (x.negro || !x.fuente) continue;
      const vel = x.velocidad || 1, ini = Number(x.inicio) || 0, fin = ini + (x.consumo || x.dur * vel);
      for (const s of tramosDe(x.fuente)) {
        const a = Math.max(ini, s.t0), b = Math.min(fin, s.t1); if (b <= a) continue;
        const ta = x.t0 + (a - ini) / vel, tb = x.t0 + (b - ini) / vel;
        if ((tb - ta) * E.pps < 2) continue;
        fv.append(el("div", { class: "cont-seg c-" + s.clase, title: `${etiquetaTramo(s)}\n${fmt(s.t0)}–${fmt(s.t1)} del medio`, style: { left: (ta * E.pps) + "px", width: ((tb - ta) * E.pps) + "px", background: CLASE[s.clase] ? CLASE[s.clase][1] : "#888" } },
          (tb - ta) * E.pps > 60 ? el("span", {}, etiquetaTramo(s)) : null));
      }
    }
  }
  function pintarBotonContenido() {
    const g = $("#tl-barra .grupo:nth-of-type(4)"); if (!g || $("#ed-contenido")) return;
    const b = el("button", { class: "ib" + (MAPA.ver ? " on" : ""), id: "ed-contenido", title: "Mapa de contenido del análisis: momentos del video sobre los clips (clic derecho: elegir categorías)", "aria-pressed": String(MAPA.ver), html: ico("scan", 16) });
    b.onclick = () => { MAPA.ver = !MAPA.ver; lsSet("wded_contenido_ver", MAPA.ver); ED.marcarBoton("#ed-contenido", MAPA.ver); ED.renderTimeline(); if (P.origen) pintarBarraO(); };
    b.oncontextmenu = (e) => {
      e.preventDefault();
      ED.menu(e.clientX, e.clientY, Object.entries(CLASE).map(([k, [t]]) => [`${MAPA.ocultas.has(k) ? "○" : "●"} ${t}`, () => {
        if (MAPA.ocultas.has(k)) MAPA.ocultas.delete(k); else MAPA.ocultas.add(k);
        lsSet("wded_contenido_ocultas", [...MAPA.ocultas]); ED.renderTimeline(); if (P.origen) pintarBarraO();
      }]));
    };
    b.hidden = !hayMapa();
    g.append(b);
  }
  // en el monitor de origen: tramos sobre la barra; clic = marca entrada/salida con ese tramo
  function contenidoOrigen() {
    const o = P.origen, barra = $("#mo-barra"); if (!o || !barra) return;
    for (const s of barra.querySelectorAll(".cont-seg")) s.remove();
    if (!MAPA.ver || !o.dur) return;
    for (const s of tramosDe(o.alias, o.ruta)) {
      const d = el("div", { class: "cont-seg c-" + s.clase, title: `${etiquetaTramo(s)} (${fmt(s.t0)}–${fmt(s.t1)})\nClic: usar este tramo como entrada y salida`, style: { left: (100 * s.t0 / o.dur) + "%", width: (100 * (s.t1 - s.t0) / o.dur) + "%", background: CLASE[s.clase] ? CLASE[s.clase][1] : "#888" } });
      d.addEventListener("pointerdown", (e) => { e.stopPropagation(); o.in = r3(s.t0); o.out = r3(s.t1); irO(s.t0); });
      barra.append(d);
    }
    const acc = $("#mon-origen .mo-acc");
    if (acc && !$("#mo-buenos") && tramosDe(o.alias, o.ruta).some((s) => s.clase === "clave" || s.clase === "accion"))
      acc.append(el("button", { class: "ib", id: "mo-buenos", title: "Insertar solo los momentos buenos (clave y acción, sin EVITAR) en el cabezal, uno tras otro", "aria-label": "Insertar momentos buenos", html: ico("sparkles", 15), onclick: insertarBuenos }));
  }
  async function insertarBuenos() {
    const o = P.origen; if (!o) return;
    const buenos = tramosDe(o.alias, o.ruta).filter((s) => (s.clase === "clave" || s.clase === "accion") && s.t1 - s.t0 >= 0.5).sort((a, b) => a.t0 - b.t0);
    if (!buenos.length) return toast("Este medio no tiene momentos marcados como buenos", "info");
    const alias = await aliasDe(o); if (!alias) return;
    let t = r3(E.t);
    const ops = [];
    for (const s of buenos) { const d = r3(Math.min(8, s.t1 - s.t0)); ops.push({ op: "clip_colocar", fuente: alias, inicio: r3(s.t0), dur: d, t, modo: "insertar", destino_v: E.destV ?? 0, destino_a: null, video: true, audio: false }); t = r3(t + d); }
    const ok = await hacer({ op: "lote", desc: `${buenos.length} momentos buenos`, ops });
    if (ok) toast(`${buenos.length} momentos buenos insertados (máx. 8 s cada uno)`, "info", 2500);
  }

  // ================================================================== ciclo de vida
  function centrarV1() {
    const sc = $("#tl-scroll"), f = $('#tl-cont .tl-fila[data-pista="video"]'); if (!sc || !f) return;
    if (f.offsetTop + f.offsetHeight > sc.scrollTop + sc.clientHeight - 20 || f.offsetTop < sc.scrollTop + 24)
      sc.scrollTop = Math.max(0, f.offsetTop - Math.round(sc.clientHeight * 0.4));
  }
  function planCargado() { /* vista nueva: nada que hacer aquí (el visor de capas se repinta con pintar) */ }
  function abierto() {
    if (ED.guias) { ED.guias.sinBoton = true; const vb = $("#ed-version-formato"); if (vb) vb.remove(); }
    pintarHerramientas(); pintarSecuencias(); pintarEspacios(); enlazarVisor(); pintarMedidores();
    cargarContenido().then(pintarBotonContenido);
    // V1 (pista principal) a la vista: con muchas pistas V2+ quedaría debajo del borde (como Premiere, V arriba y A abajo)
    requestAnimationFrame(() => centrarV1());
    const m = lsGet("wded_monitor", "programa");
    espacio(P.ws, true);
    if (m !== E.monitor && P.ws === "editar") monitor(m);
  }

  ED.pro = { dibujarClip, trasTimeline, tlDown, reglaDown, editarMarcador, menuClip, tecla, marcarHerramienta, monitor, abrirOrigen, colocar,
    soltarOrigen, soltarMedio, pintar, pausa: pausaCapas, vivoClip, valorKf, dibujarPluma, grabarVoz, pararGrabacion, estabilizar, espacio,
    programarAudio, alReproducir, planCargado, abierto, centrarV1, COLORES_MARCA, _P: P, WS };
  window.WDVS = window.WDVS || {};
  window.WDVS.espacioTrabajo = espacio;
})();
