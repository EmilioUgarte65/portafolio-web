"use strict";
// Web Studio — paneles con contrato de otros módulos, montados en el editor (5-oct-2026). docs/editor.md §9.6.
// - «Reglas» (docs/reglas.md §4): panel derecho, WDVS.abrirReglas(pid, rid), evento wdvs:abrir-reglas, marcadores de
//   coincidencias en la línea de tiempo y re-aplicar tras una edición a mano.
// - «Interacciones» (docs/interacciones.md §3): panel derecho que edita guion.interacciones del overlay de escena y
//   recompone la escena (POST /api/anim/componer); marcadores de escena.interacciones.
// - Boca y expresión (docs/caras.md §5.3): sección del inspector para los actores `cara` (o un rig2d sin cara:
//   «Agregar cara animada»).
(() => {
  const ED = window.WDED; if (!ED) return;
  const { E, $, $$, el, esc, pedir, hacer, toast, r3, ico, pidURL, lsGet, lsSet } = ED;
  const V = () => E.vista;
  const WD = () => window.WDVS || {};
  const ic = (n, t = 14) => el("span", { class: "i", "aria-hidden": "true", html: ico(n, t) });
  const fmtS = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  const pidE = () => encodeURIComponent(E.pid);

  // ================================================================== Reglas
  const RG = { d: null, sel: null, auto: lsGet("wded_reglas_auto", true), t: null };
  const urlR = () => `/api/proyectos/${pidE()}/reglas`;
  async function cargarReglas() { const r = await pedir(urlR()); RG.d = r.ok ? r.d : null; dibujarMarcas(); return RG.d; }
  function resumen(r) {
    return [`${r.n || 0} momentos`, r.n_pendientes ? `${r.n_pendientes} pendientes` : null, r.n_fuera ? `${r.n_fuera} fuera de la edición` : null].filter(Boolean).join(" · ");
  }
  async function pintarReglas(c) {
    c.innerHTML = "";
    c.append(el("div", { class: "guion-cab" }, el("b", {}, "Reglas"), el("span", { class: "tenue" }, "«Cada vez que… haz…»: la app lo hace en todo el video")));
    const d = await cargarReglas();
    if (!d) return c.append(el("div", { class: "vacio-guia" }, ic("scroll-text", 26), el("b", {}, "Las reglas no están disponibles"), el("span", {}, "Falta el módulo de reglas en el servidor.")));
    const inp = el("input", { type: "text", placeholder: "Nueva: «cada vez que diga WD pon un ding»", "aria-label": "Nueva regla" });
    const nueva = async () => {
      const texto = inp.value.trim(); if (!texto) return inp.focus();
      inp.disabled = true;
      const r = await pedir(urlR(), { method: "POST", json: { texto } });
      inp.disabled = false;
      if (!r.ok) return toast(r.d.detail || "No pude crear la regla");
      inp.value = ""; RG.sel = (r.d.regla || r.d).id; pintarReglas(c);
    };
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") nueva(); });
    const auto = el("input", { type: "checkbox", checked: RG.auto, onchange: () => { RG.auto = auto.checked; lsSet("wded_reglas_auto", RG.auto); } });
    c.append(el("div", { class: "rg-nueva" }, inp, el("button", { class: "bt chico acento", onclick: nueva }, ic("plus", 12), "Crear")),
      el("div", { class: "guion-barra" },
        el("button", { class: "bt chico acento", onclick: aplicarReglas }, ic("check", 12), "Aplicar"),
        el("button", { class: "bt chico", onclick: async () => { const r = await pedir(`${urlR()}/quitar_todo`, { method: "POST" }); if (!r.ok) return toast(r.d.detail || "No se pudo"); window.dispatchEvent(new CustomEvent("wdvs:plan-cambiado", { detail: { pid: E.pid } })); pintarReglas(c); } }, "Quitar todo"),
        el("button", { class: "bt chico", onclick: () => desdePlantilla(c) }, ic("layout-template", 12), "Desde plantilla"),
        el("label", { class: "fila-ctl", title: "Al editar a mano, las reglas activas se vuelven a aplicar solas" }, auto, " Aplicar solas")));
    if (d.trabajando) c.append(el("div", { class: "nota" }, String(d.trabajando)));
    const lista = el("div", { class: "rg-lista" });
    if (!(d.reglas || []).length) lista.append(el("div", { class: "vacio-guia" }, ic("scroll-text", 24), el("b", {}, "Sin reglas todavía"), el("span", {}, "Escríbela arriba o pídesela a la IA en el chat.")));
    for (const r of d.reglas || []) {
      const sw = el("input", { type: "checkbox", checked: r.activa !== false, "aria-label": "Regla activa", onchange: async () => { await pedir(`${urlR()}/${r.id}`, { method: "PATCH", json: { activa: sw.checked } }); cargarReglas(); } });
      const fila = el("div", { class: "rg-it" + (RG.sel === r.id ? " sel" : "") },
        el("div", { class: "rg-cab" }, sw, el("button", { class: "enlace rg-nom", onclick: () => { RG.sel = RG.sel === r.id ? null : r.id; pintarReglas(c); } }, r.nombre || r.texto || r.id),
          el("button", { class: "ib", title: "Borrar regla", "aria-label": "Borrar regla", html: ico("trash-2", 13), onclick: async () => { if (!(WD().confirmar ? await WD().confirmar({ titulo: "¿Borrar la regla?", cuerpo: r.nombre || r.texto, si: "Borrar" }) : confirm("¿Borrar la regla?"))) return; await pedir(`${urlR()}/${r.id}`, { method: "DELETE" }); pintarReglas(c); } })),
        el("div", { class: "tenue rg-res" }, resumen(r)),
        r.error ? el("div", { class: "rg-err" }, r.error) : null,
        (r.faltan || []).length ? el("button", { class: "bt chico", onclick: async () => { const q = await pedir(`${urlR()}/${r.id}/preparar`, { method: "POST" }); toast(q.ok ? "Revisando tus videos en segundo plano…" : (q.d.detail || "No se pudo"), "info"); } }, ic("scan-search", 12), "Revisar mis videos") : null);
      if (RG.sel === r.id) fila.append(detalleRegla(r, c));
      lista.append(fila);
    }
    c.append(lista);
  }
  function detalleRegla(r, c) {
    const num = (k, et, paso = 0.1) => { const i = el("input", { type: "number", step: paso, value: r[k] ?? "", style: { width: "70px" }, onchange: async () => { await pedir(`${urlR()}/${r.id}`, { method: "PATCH", json: { [k]: i.value === "" ? null : +i.value } }); pintarReglas(c); } }); return el("label", { class: "fila-ctl" }, et, i); };
    const dis = r.disparador || {};
    const det = el("div", { class: "rg-det" },
      el("div", { class: "tenue" }, `Cuando: ${dis.tipo || "?"}${dis.valor ? ` «${dis.valor}»` : ""} → ${(r.acciones || []).map((a) => a.tipo + (a.sonido ? ` ${a.sonido}` : a.efecto ? ` ${a.efecto}` : "")).join(", ")}`),
      el("div", { class: "rg-nums" }, num("min_sep", "Separación (s)"), num("desfase", "Desfase (s)"), num("duracion", "Duración (s)")),
      el("div", { class: "botones" },
        el("button", { class: "bt chico", onclick: async () => { await pedir(`${urlR()}/${r.id}/todas`, { method: "POST", json: { estado: "aprobada" } }); pintarReglas(c); } }, "Aprobar todas"),
        el("button", { class: "bt chico", onclick: async () => { const n = prompt("Nombre de la plantilla", r.nombre || ""); if (n) { const q = await pedir(`${urlR()}/${r.id}/plantilla`, { method: "POST", json: { nombre: n } }); toast(q.ok ? "Plantilla guardada" : (q.d.detail || "No se pudo"), "info"); } } }, "Guardar como plantilla")));
    const cs = el("div", { class: "rg-cs" });
    for (const k of r.coincidencias || []) {
      const t = k.salida && k.salida[0] ? k.salida[0][0] : null;
      const est = (estado) => async () => { await pedir(`${urlR()}/${r.id}/coincidencias/${k.id}`, { method: "POST", json: { estado } }); pintarReglas(c); };
      cs.append(el("div", { class: `rg-c ${k.estado || "pendiente"}${k.en_edicion === false ? " fuera" : ""}` },
        el("button", { class: "enlace", disabled: t == null, onclick: () => t != null && ED.ponerT(t, { seguir: true }) }, t != null ? fmtS(t) : "fuera"),
        el("span", {}, String(k.valor ?? k.tipo ?? "")),
        el("button", { class: "ib", title: "Aprobar", "aria-label": "Aprobar", html: ico("check", 13), onclick: est("aprobada") }),
        el("button", { class: "ib", title: "Descartar", "aria-label": "Descartar", html: ico("x", 13), onclick: est("descartada") })));
    }
    det.append(cs);
    return det;
  }
  async function desdePlantilla(c) {
    const r = await pedir("/api/reglas/plantillas");
    const ps = r.ok ? (r.d.plantillas || r.d || []) : [];
    if (!ps.length) return toast("Aún no tienes plantillas de reglas", "info");
    const m = ED.modal("Reglas desde plantilla", el("div", { class: "ab-lista" }, ...ps.map((p) => el("button", { class: "ab-op", onclick: async () => { m.closest(".wd-modal").remove(); const q = await pedir(`${urlR()}/plantillas/${p.id}`, { method: "POST" }); if (!q.ok) return toast(q.d.detail || "No se pudo"); pintarReglas(c); } }, el("b", {}, p.nombre || p.id), el("span", { class: "tenue" }, p.texto || "")))));
  }
  async function aplicarReglas(silencioso) {
    const r = await pedir(`${urlR()}/aplicar`, { method: "POST" });
    if (!r.ok) { if (silencioso !== true) toast(r.d.detail || "No se pudieron aplicar las reglas"); return; }
    window.dispatchEvent(new CustomEvent("wdvs:plan-cambiado", { detail: { pid: E.pid } }));
    if (silencioso !== true) toast("Reglas aplicadas.", "info", 2000);
  }
  // re-aplicar tras una edición a mano (contrato §4), con retardo y solo si hay reglas activas
  window.addEventListener("wded:editado", (e) => {
    if (!RG.auto || !E.pid || /regla/i.test((e.detail && e.detail.desc) || "")) return;
    clearTimeout(RG.t);
    RG.t = setTimeout(async () => { const d = await cargarReglas(); if (d && (d.reglas || []).some((r) => r.activa !== false && r.n)) aplicarReglas(true); }, 8000);
  });
  WDVS.abrirReglas = (pid, rid) => { if (rid) RG.sel = rid; if (ED.abrirDer) ED.abrirDer("reglas"); const c = $("#der-x-reglas"); if (c) pintarReglas(c); };
  window.addEventListener("wdvs:abrir-reglas", (e) => WDVS.abrirReglas(e.detail && e.detail.pid, e.detail && e.detail.regla));
  ED.panelDerecho("reglas", { titulo: "Reglas automáticas", corto: "Reglas", icono: "scroll-text", montar: (c) => pintarReglas(c), alMostrar: (c) => pintarReglas(c) });

  // ================================================================== Interacciones
  const IN = { tipos: null, i: null };
  function escenaSel() {
    const s = E.sel;
    if (s && s.tipo === "overlays" && ED.esEscena(s.i)) return s.i;
    const ovs = (E.plan && E.plan.overlays) || [];
    const i = ovs.findIndex((o, k) => "escena" in o && o.guion && E.t >= (V().overlays[k] || {}).t_in && E.t < (V().overlays[k] || {}).t_out);
    return i >= 0 ? i : null;
  }
  async function pintarInter(c) {
    if (!IN.tipos) { const r = await pedir("/api/anim/interacciones/tipos"); IN.tipos = r.ok ? r.d : { predisenadas: [] }; }
    c.innerHTML = "";
    c.append(el("div", { class: "guion-cab" }, el("b", {}, "Interacciones"), el("span", { class: "tenue" }, "Qué pasa entre los personajes de la escena")));
    const i = escenaSel(); IN.i = i;
    const o = i != null ? E.plan.overlays[i] : null;
    if (!o || !o.guion) return c.append(el("div", { class: "vacio-guia" }, ic("mouse-pointer-click", 26), el("b", {}, "Elige una escena animada"), el("span", {}, "Selecciona en la línea de tiempo una escena compuesta por la IA (las que tienen guion).")));
    const esc_ = typeof o.escena === "object" ? o.escena : null;
    const pers = [...new Set(((esc_ && esc_.actores) || []).filter((a) => /rig|personaje|modelo|imagen/.test(a.tipo || "")).map((a) => a.id).filter(Boolean))];
    const lista = JSON.parse(JSON.stringify(o.guion.interacciones || []));
    const cont = el("div", { class: "in-lista" });
    const pintarLista = () => {
      cont.innerHTML = "";
      if (!lista.length) cont.append(el("div", { class: "tenue" }, "Sin interacciones. Agrega una abajo."));
      lista.forEach((it, k) => {
        const quitar = el("button", { class: "ib", "aria-label": "Quitar", title: "Quitar", html: ico("trash-2", 13), onclick: () => { lista.splice(k, 1); pintarLista(); } });
        if (typeof it === "string" || (it && it.regla === undefined && !it.tipo)) {
          const ta = el("textarea", { rows: 2, "aria-label": "Descríbelo" }); ta.value = typeof it === "string" ? it : JSON.stringify(it);
          ta.addEventListener("input", () => { lista[k] = ta.value; }); ta.addEventListener("keydown", (e) => e.stopPropagation());
          cont.append(el("div", { class: "in-it" }, el("div", { class: "rg-cab" }, el("b", {}, "Descríbelo"), quitar), ta));
          return;
        }
        const sel = (vals, v, on, et) => { const s = el("select", { "aria-label": et }, ...vals.map((x) => el("option", { value: x, selected: x === v }, x))); s.onchange = () => on(s.value); return s; };
        const num = (v, on, et) => { const n = el("input", { type: "number", step: 0.1, value: v ?? "", style: { width: "64px" }, "aria-label": et }); n.onchange = () => on(n.value === "" ? undefined : +n.value); n.addEventListener("keydown", (e) => e.stopPropagation()); return n; };
        const tipos = [...(IN.tipos.predisenadas || []), ...(IN.tipos.miradas || []), "regla"];
        const entre = it.entre || [];
        cont.append(el("div", { class: "in-it" },
          el("div", { class: "rg-cab" }, sel(tipos, it.tipo || "regla", (v) => { it.tipo = v; }, "Tipo"), quitar),
          pers.length ? el("div", { class: "fila-ctl" }, "Entre ", sel(["", ...pers], entre[0] || "", (v) => { it.entre = [v, entre[1]].filter(Boolean); }, "Personaje 1"), sel(["", ...pers], entre[1] || "", (v) => { it.entre = [entre[0], v].filter(Boolean); }, "Personaje 2")) : null,
          el("div", { class: "fila-ctl" }, "En ", num(it.t, (v) => { it.t = v; }, "Segundo"), " s · dura ", num(it.dur, (v) => { it.dur = v; }, "Duración"), " s"),
          it.tipo === "regla" || it.cuando ? el("div", { class: "tenue" }, `Cuando ${JSON.stringify(it.cuando || {})} → ${JSON.stringify(it.entonces || [])}`.slice(0, 160)) : null));
      });
    };
    pintarLista();
    const avisos = el("div", { class: "in-avisos" });
    const guardar = el("button", { class: "bt chico acento", onclick: async () => {
      guardar.disabled = true;
      const guion = { ...o.guion, interacciones: lista.filter((x) => (typeof x === "string" ? x.trim() : x)) };
      const pr = await pedir(pidURL()); const carpeta = pr.ok ? pr.d.carpeta : undefined;
      const v = V().overlays[i];
      const r = await pedir("/api/anim/componer", { method: "POST", json: { guion, ancho: V().W, alto: V().H, dur: r3(v.t_out - v.t_in), carpeta } });
      guardar.disabled = false;
      if (!r.ok) { avisos.textContent = r.d.detail || "No se pudo recomponer la escena"; return; }
      const props = { guion };
      if (typeof o.escena === "object") props.escena = r.d.escena;
      if (await hacer({ op: "lista_props", lista: "overlays", i, props, desc: "interacciones de la escena" })) {
        avisos.innerHTML = "";
        for (const a of ((r.d.informe || {}).avisos || [])) avisos.append(el("div", { class: "diag aviso" }, ic("triangle-alert", 13), String(a)));
        toast("Escena recompuesta con sus interacciones.", "info", 2500);
      }
    } }, ic("check", 12), "Guardar y recomponer");
    const prev = el("input", { type: "text", placeholder: "Describe: «M le pasa la pelota a N y N salta»", "aria-label": "Describir interacción" });
    prev.addEventListener("keydown", (e) => e.stopPropagation());
    c.append(cont,
      el("div", { class: "botones in-acc" },
        el("button", { class: "bt chico", onclick: () => { lista.push({ tipo: (IN.tipos.predisenadas || ["chocar_manos"])[0], entre: pers.slice(0, 2), t: 1, dur: 1 }); pintarLista(); } }, ic("plus", 12), "Prediseñada"),
        el("button", { class: "bt chico", onclick: () => { lista.push(""); pintarLista(); } }, ic("plus", 12), "Con tus palabras")),
      el("div", { class: "rg-nueva" }, prev, el("button", { class: "bt chico", title: "Muestra cómo la entendió la app", onclick: async () => {
        const r = await pedir("/api/anim/interacciones/interpretar", { method: "POST", json: { texto: prev.value } });
        if (!r.ok) return toast(r.d.detail || "No se pudo interpretar");
        for (const x of r.d.interacciones || []) lista.push(x); prev.value = ""; pintarLista();
      } }, "Entender")),
      el("div", { class: "botones" }, guardar), avisos);
    for (const a of ((esc_ && esc_.informe && esc_.informe.avisos) || [])) avisos.append(el("div", { class: "diag aviso" }, ic("triangle-alert", 13), String(a)));
  }
  ED.panelDerecho("interacciones", { titulo: "Interacciones de la escena", corto: "Interacciones", icono: "mouse-pointer-click", montar: (c) => pintarInter(c), alMostrar: (c) => pintarInter(c) });
  window.addEventListener("wded:editado", () => { const c = $("#der-x-interacciones"); if (c && !c.hidden && escenaSel() !== IN.i) pintarInter(c); });

  // ================================================================== marcadores (reglas e interacciones)
  function dibujarMarcas() {
    const cont = $("#tl-cont"); if (!cont || !V()) return;
    let capa = $("#tl-marcas-ext", cont);
    if (!capa) { capa = el("div", { class: "tl-marcas-ext", id: "tl-marcas-ext" }); cont.append(capa); }
    capa.innerHTML = "";
    for (const r of (RG.d && RG.d.reglas) || []) {
      if (r.activa === false) continue;
      for (const k of r.coincidencias || []) for (const [a] of (k.salida || []).slice(0, 1)) {
        capa.append(el("button", { class: `mx regla ${k.estado || "pendiente"}`, style: { left: ED.xDe(a) - 4 + "px" }, title: `${r.nombre || "Regla"}: ${k.valor ?? ""} (${k.estado || "pendiente"})`, "aria-label": `Regla ${r.nombre || ""} en ${fmtS(a)}`, onclick: () => WDVS.abrirReglas(E.pid, r.id) }));
      }
    }
    (E.plan && E.plan.overlays || []).forEach((o, i) => {
      const e = typeof o.escena === "object" ? o.escena : null; const v = V().overlays[i];
      if (!e || !v || !(e.interacciones || []).length) return;
      for (const x of e.interacciones) {
        const a = v.t_in + (+x.t || 0), b = v.t_in + (+x.hasta || +x.t || 0);
        capa.append(el("button", { class: "mx inter", style: { left: ED.xDe(a) + "px", width: Math.max(8, ED.xDe(b) - ED.xDe(a)) + "px" }, title: x.descripcion || x.tipo || "interacción", "aria-label": `Interacción: ${x.descripcion || x.tipo || ""}`, onclick: () => { ED.seleccionar({ tipo: "overlays", i }, "solo"); ED.abrirDer("interacciones"); } }));
      }
    });
  }
  ED.ganchosTimeline.push(dibujarMarcas);
  let pidR = null;
  setInterval(() => { if (E.abierto && E.plan && E.pid !== pidR) { pidR = E.pid; RG.d = null; cargarReglas(); } }, 1500);
  window.addEventListener("wdvs:plan-cambiado", () => setTimeout(cargarReglas, 1500));

  // ================================================================== Boca y expresión (caras)
  const CA = { cat: null };
  async function catalogo() { if (!CA.cat) { const r = await pedir("/api/caras/catalogo"); CA.cat = r.ok ? r.d : { expresiones: ["normal", "feliz", "triste", "enojado", "sorpresa", "miedo", "amor"] }; } return CA.cat; }
  function seccionCaras(cont, ctx) {
    const a = ctx.actor; if (!a || !a.actor) return;
    const act = a.actor, esc = a.escena;
    const esCara = act.tipo === "cara";
    const esRig = /rig2d/.test(act.tipo || "");
    if (!esCara && !esRig) return;
    const U = ED.ui;
    const caja = el("details", { class: "av", open: true }, el("summary", {}, "Boca y expresión"));
    cont.append(caja);
    const guardarP = (fn) => { const j = JSON.parse(JSON.stringify(esc)); const x = j.actores.find((y, n) => (y.id ?? `a${n}`) === a.id); fn(x.params = x.params || {}, j, x); return a.guardar(j); };
    if (esRig) {
      const ya = (esc.actores || []).find((y) => y.tipo === "cara" && (y.params || {}).sobre === act.id);
      if (ya) { caja.append(el("div", { class: "nota" }, "Este personaje ya tiene cara animada: elígela en el visor para ajustarla.")); return; }
      caja.append(el("button", { class: "bt chico acento", onclick: async () => {
        const rig = (act.params || {}).rig || act.rig;
        const r = rig ? await pedir(`/api/caras/rig/${encodeURIComponent(rig)}`) : { ok: false, d: { detail: "El personaje no tiene rig" } };
        if (!r.ok) return toast(r.d.detail || "No pude detectar la cara (¿está activo el módulo de caras?)");
        const j = JSON.parse(JSON.stringify(esc));
        j.actores.push({ id: `cara_${act.id}`, tipo: "cara", z: (act.z || 10) + 0.5, params: { sobre: act.id, rig_actor: { id: act.id, params: act.params, pivote: act.pivote, t_in: act.t_in }, cara: r.d.spec || r.d, emocion: "normal", parpadeo: true, mirada_viva: true, amplitud_boca: 1, transicion: 0.06, postura: true } });
        await a.guardar(j); toast("Cara animada agregada.", "info", 2000);
      } }, ic("smile", 13), "Agregar cara animada"));
      return;
    }
    const p = act.params || {};
    catalogo().then((cat) => {
      const exps = (cat.expresiones && (Array.isArray(cat.expresiones) ? cat.expresiones : Object.keys(cat.expresiones))) || ["normal"];
      const sel = el("select", { "aria-label": "Emoción base" }, ...exps.map((x) => el("option", { value: x, selected: (p.emocion || "normal") === x }, x)));
      sel.onchange = () => guardarP((q) => { q.emocion = sel.value; });
      const rango = (k, et, min, max, paso, def) => { const r = el("input", { type: "range", min, max, step: paso, value: p[k] ?? def, "aria-label": et }); r.onchange = () => guardarP((q) => { q[k] = +r.value; }); return el("label", { class: "fila-ctl" }, et, r); };
      const chk = (k, et, def) => { const c = el("input", { type: "checkbox", checked: p[k] ?? def }); c.onchange = () => guardarP((q) => { q[k] = c.checked; }); return el("label", { class: "fila-ctl" }, c, " " + et); };
      const tx = el("input", { type: "text", placeholder: "Texto que dice (lip-sync)", "aria-label": "Texto para mover la boca" });
      tx.addEventListener("keydown", (e) => e.stopPropagation());
      const t0 = () => r3(Math.max(0, E.t - (V().overlays[a.i] || {}).t_in || 0));
      const visemas = async (cuerpo, desc) => {
        const r = await pedir("/api/caras/visemas", { method: "POST", json: { inicio: t0(), ...cuerpo } });
        if (!r.ok) return toast(r.d.detail || "No pude calcular la boca");
        await guardarP((q) => { q.visemas = r.d.visemas; delete q.hablar; }); toast(`Boca sincronizada ${desc}.`, "info", 2000);
      };
      const vozItems = ((E.plan.voz || {}).continua || []).map((v, k) => ({ k, v }));
      caja.append(el("label", { class: "fila-ctl" }, "Emoción ", sel),
        el("div", { class: "exp-sec" }, el("b", {}, "Que hable")),
        el("div", { class: "botones" },
          el("button", { class: "bt chico", title: "La boca sigue los globos de diálogo (automático)", onclick: () => guardarP((q) => { q.hablar = "globos"; delete q.visemas; }) }, "Desde los globos"),
          vozItems.length ? el("button", { class: "bt chico", onclick: (ev) => { const b = ev.currentTarget.getBoundingClientRect(); ED.menu(b.left, b.bottom + 4, vozItems.map(({ k, v }) => [`Voz ${k + 1}${v._tts && v._tts.texto ? `: «${String(v._tts.texto).slice(0, 30)}»` : ""}`, () => visemas({ audio: v.fuente, inicio: r3((v.en || 0) - ((V().overlays[a.i] || {}).t_in || 0)) }, "con la voz")])); } }, "Desde una pista de voz…") : null),
        el("div", { class: "rg-nueva" }, tx, el("button", { class: "bt chico", onclick: () => tx.value.trim() && visemas({ texto: tx.value.trim() }, "con el texto") }, "Desde texto")),
        rango("amplitud_boca", "Apertura de la boca", 0.3, 1.8, 0.1, 1), rango("transicion", "Suavizado", 0.02, 0.2, 0.01, 0.06),
        chk("parpadeo", "Parpadea", true), rango("parpadeo_cada", "Cada (s)", 1.5, 8, 0.5, 4), chk("mirada_viva", "Mirada viva", true), chk("postura", "La emoción mueve la postura", true),
        typeof (act.params || {}).cara === "string" || ((act.params || {}).rig_actor || {}).params ? el("button", { class: "bt chico", onclick: async () => {
          const rig = (((act.params || {}).rig_actor || {}).params || {}).rig;
          if (!rig) return toast("No encuentro el rig de este personaje", "info");
          const r = await pedir(`/api/caras/rig/${encodeURIComponent(rig)}?redetectar=1`);
          if (!r.ok) return toast(r.d.detail || "No pude detectar la cara");
          await guardarP((q) => { q.cara = r.d.spec || r.d; }); toast("Cara detectada de nuevo.", "info", 2000);
        } }, ic("scan-face", 13), "Volver a detectar la cara") : null);
    });
  }
  if (WDVS.registrarSeccionInspector) WDVS.registrarSeccionInspector("caras", seccionCaras);
  else (WDVS._seccionesInsp = WDVS._seccionesInsp || {}).caras = seccionCaras;

  if (ED.comando) [
    { id: "reglas", titulo: "Reglas automáticas («cada vez que…»)", grupo: "Paneles", icono: "scroll-text", accion: () => WDVS.abrirReglas(E.pid) },
    { id: "interacciones", titulo: "Interacciones de la escena", grupo: "Paneles", icono: "mouse-pointer-click", accion: () => ED.abrirDer("interacciones") },
    { id: "voces", titulo: "Voces con IA (Audio › Voces)", grupo: "Paneles", icono: "mic", accion: () => ED.elegirBib("audio") },
  ].forEach(ED.comando);
  ED.escenaUI = { pintarReglas, pintarInter, cargarReglas, dibujarMarcas, seccionCaras, RG };
})();
