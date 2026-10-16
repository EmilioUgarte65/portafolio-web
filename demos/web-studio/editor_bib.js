"use strict";
// Web Studio — Editor: biblioteca ordenada (panel izquierdo).
// - Categorías plegables tipo acordeón (una abierta a la vez, se recuerda por pestaña), miniaturas uniformes,
//   «Ver más» en lugar de listas largas, ayuda en tooltips.
// - Buscador GLOBAL (busca en todas las pestañas a la vez), Favoritos (estrella) y Recientes (lo último que usaste).
// - Medios = panel Proyecto: bandejas (carpetas), vista de lista o de iconos, orden, filtro por tipo o rol,
//   selección múltiple (clic, Ctrl y Shift) con contador, doble clic abre el MONITOR DE ORIGEN.
// - API para otros módulos: ED.bib.acordeon(cont, secciones, {clave}) y WDVS.registrarCategoria(pestaña, def)
//   (p. ej. «Mis efectos» del agente de plugins). Ver docs/editor.md §2.2.
(() => {
  const ED = window.WDED;
  const { E, $, $$, el, esc, hacer, toast, fmt, r3, humano, nombreFuente, lsGet, lsSet, debounce } = ED;
  const ico = (n, t = 14) => ED.ico(n, t);
  const MOSTRAR = 8;                 // tarjetas visibles por categoría antes de «Ver más»
  const B = {
    fav: new Set(lsGet("wded_bib_fav", [])), rec: lsGet("wded_bib_rec", []), abiertas: lsGet("wded_bib_abierta", {}),
    mas: {}, q: "", medSel: new Set(), ancla: null, band: { bandejas: [], asignacion: {}, vista: {} }, bandPid: null,
    vistaMed: lsGet("wded_med_vista", "iconos"), ordenMed: lsGet("wded_med_orden", "nombre"), filtroMed: "todos",
    presetsAnim: null, cats: (window.WDVS = window.WDVS || {})._categorias || (window.WDVS._categorias = {}),
  };
  // Íconos extra (trazo Lucide 24x24) que usa la interfaz pro; se agregan al set local sin tocar vendor/.
  const EXTRA = {
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
    "layout-grid": '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    "folder-plus": '<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    unlink: '<path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><line x1="8" x2="8" y1="2" y2="5"/><line x1="2" x2="5" y1="8" y2="8"/><line x1="16" x2="16" y1="19" y2="22"/><line x1="19" x2="22" y1="16" y2="16"/>',
    "circle-dot": '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    "pen-tool": '<path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/><path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/>',
    square: '<rect width="18" height="18" x="3" y="3" rx="2"/>',
    circle: '<circle cx="12" cy="12" r="10"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
    "arrow-right-to-line": '<path d="M17 12H3"/><path d="m11 18 6-6-6-6"/><path d="M21 5v14"/>',
    "unfold-horizontal": '<path d="M16 12h6"/><path d="M8 12H2"/><path d="M12 2v2"/><path d="M12 8v2"/><path d="M12 14v2"/><path d="M12 20v2"/><path d="m19 15 3-3-3-3"/><path d="m5 9-3 3 3 3"/>',
    "fold-horizontal": '<path d="M2 12h6"/><path d="M22 12h-6"/><path d="M12 2v2"/><path d="M12 8v2"/><path d="M12 14v2"/><path d="M12 20v2"/><path d="m19 9-3 3 3 3"/><path d="m5 15 3-3-3-3"/>',
    "chevrons-left-right": '<path d="m9 7-5 5 5 5"/><path d="m15 7 5 5-5 5"/>',
    "columns-2": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>',
    "log-in": '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>',
    "arrow-down-to-line": '<path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/>',
    replace: '<path d="M14 4a2 2 0 0 1 2-2"/><path d="M16 10a2 2 0 0 1-2-2"/><path d="M20 2a2 2 0 0 1 2 2"/><path d="M22 8a2 2 0 0 1-2 2"/><path d="m3 7 3 3 3-3"/><path d="M6 10V5a3 3 0 0 1 3-3h1"/><rect x="2" y="14" width="8" height="8" rx="2"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    "layout-panel-left": '<rect width="7" height="18" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/>',
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    "blend": '<circle cx="9" cy="9" r="7"/><circle cx="15" cy="15" r="7"/>',
    "sticker": '<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    waves: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    "party-popper": '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>',
  };
  if (window.WDVS && WDVS.iconos) for (const [k, v] of Object.entries(EXTRA)) if (!WDVS.iconos[k]) WDVS.iconos[k] = v;

  // ================================================================== favoritos y recientes
  function marcarReciente(id) {
    B.rec = [id, ...B.rec.filter((x) => x !== id)].slice(0, 12);
    lsSet("wded_bib_rec", B.rec);
  }
  function alternarFav(id) {
    if (B.fav.has(id)) B.fav.delete(id); else B.fav.add(id);
    lsSet("wded_bib_fav", [...B.fav]);
  }

  // ================================================================== acordeón genérico
  // secciones: [{id, titulo, icono, n?, items?: [item], montar?: (cuerpo) => void, abierta?}]
  // Una sola abierta a la vez (clave = pestaña); se recuerda cuál. Cada sección muestra sus primeras MOSTRAR
  // tarjetas y «Ver más (n)».
  function acordeon(cont, secciones, op = {}) {
    const clave = op.clave || E.bib;
    const abierta = B.abiertas[clave] ?? (secciones.find((s) => s.abierta) || secciones[0] || {}).id;
    const caja = el("div", { class: "acord", role: "list" });
    for (const s of secciones) {
      if (!s) continue;
      const on = s.id === abierta;
      const n = s.n ?? (s.items ? s.items.length : null);
      const cab = el("button", { class: "acord-cab", "aria-expanded": String(on), title: s.ayuda || "" },
        el("span", { class: "chev", html: ico("chevron-right", 13) }), s.icono ? el("span", { class: "ic", html: ico(s.icono, 14) }) : null,
        el("span", { class: "tit" }, s.titulo), n !== null && n !== undefined ? el("span", { class: "n" }, String(n)) : null);
      const cuerpo = el("div", { class: "acord-cuerpo", hidden: !on });
      cab.onclick = () => {
        const abrir = cab.getAttribute("aria-expanded") !== "true";
        for (const c of caja.querySelectorAll(":scope > .acord-sec > .acord-cab")) c.setAttribute("aria-expanded", "false");
        for (const c of caja.querySelectorAll(":scope > .acord-sec > .acord-cuerpo")) c.hidden = true;
        B.abiertas[clave] = abrir ? s.id : "";
        lsSet("wded_bib_abierta", B.abiertas);
        if (abrir) { cab.setAttribute("aria-expanded", "true"); cuerpo.hidden = false; if (!cuerpo._lleno) llenar(); requestAnimationFrame(() => cab.scrollIntoView({ block: "nearest" })); }
      };
      const llenar = () => {
        cuerpo._lleno = true; cuerpo.innerHTML = "";
        if (s.montar) return s.montar(cuerpo);
        if (s.items) rejilla(cuerpo, s.items, clave + ":" + s.id, s.vacio);
      };
      if (on) llenar();
      caja.append(el("div", { class: "acord-sec", "data-sec": s.id, role: "listitem" }, cab, cuerpo));
    }
    cont.append(caja);
    return caja;
  }
  function rejilla(cont, items, claveMas, vacio) {
    if (!items.length) { cont.append(el("div", { class: "acord-vacio" }, vacio || "Nada por aquí todavía.")); return; }
    const todo = !!B.mas[claveMas];
    const g = el("div", { class: "tiles" });
    for (const it of (todo ? items : items.slice(0, MOSTRAR))) g.append(tile(it));
    cont.append(g);
    if (items.length > MOSTRAR) cont.append(el("button", { class: "ver-mas", onclick: () => { B.mas[claveMas] = !todo; cont.innerHTML = ""; rejilla(cont, items, claveMas, vacio); } },
      todo ? "Ver menos" : `Ver más (${items.length - MOSTRAR})`));
  }
  // Tarjeta uniforme: miniatura 16:10 (ícono, muestra o imagen), nombre en una línea y descripción en el tooltip.
  function tile(it) {
    const mini = el("div", { class: "tile-mini" + (it.clase ? " " + it.clase : "") });
    if (it.mini instanceof Node) mini.append(it.mini); else mini.innerHTML = it.mini || ico(it.icono || "sparkles", 20);
    const estrella = el("button", { class: "tile-fav" + (B.fav.has(it.id) ? " on" : ""), title: B.fav.has(it.id) ? "Quitar de favoritos" : "Agregar a favoritos", "aria-label": "Favorito", html: ico("star", 12) });
    estrella.onclick = (ev) => { ev.stopPropagation(); alternarFav(it.id); estrella.classList.toggle("on", B.fav.has(it.id)); if (B.q === "" && ["fav"].includes(B.abiertas[E.bib])) ED.renderBiblio(); };
    const t = el("div", { class: "tile", title: it.desc ? `${it.nombre}\n${it.desc}${it.pista ? "\n" + it.pista : ""}` : (it.pista ? `${it.nombre}\n${it.pista}` : it.nombre), tabindex: "0", role: "button", "aria-label": it.nombre },
      mini, el("span", { class: "tile-nom" }, it.nombre), estrella);
    if (it.datos) ED.arrastrable(t, it.datos);
    t.addEventListener("dragstart", () => marcarReciente(it.id));
    const usar = () => { if (!it.accion) return; marcarReciente(it.id); it.accion(); };
    t.addEventListener("dblclick", usar);
    t.addEventListener("keydown", (e) => { if (e.key === "Enter") usar(); });
    if (it.extra) it.extra(t);
    return t;
  }

  // ================================================================== catálogo de todas las pestañas
  const CAT_EF = { camara: ["Cámara", "camera"], estilo: ["Glitch y estilo", "zap"], color: ["Color", "palette"], distorsion: ["Distorsión", "waves"], tiempo: ["Tiempo", "clock"], particulas: ["Partículas y overlays", "sparkles"] };
  const COLOR_EF = { camara: "#2D5F99", estilo: "#9E3C5F", color: "#8F5B1F", distorsion: "#2A756B", tiempo: "#24657F", particulas: "#7447B0", presets: "#6B6E75", plugins: "#3a6b3a" };
  const miniColor = (col, icono) => `<span class="tile-grad" style="--c:${col}">${ico(icono, 18)}</span>`;
  function trGrupo(n) {
    if (/^(fade|dissolve|fadeblack|fadewhite|fadegrays|hblur)$/.test(n)) return "suaves";
    if (/^(wipe|slide|smooth|cover|reveal|squeeze|hlwind|vuslice|hlslice)/.test(n)) return "barridos";
    if (/^(circle|rect|radial|diag|vertopen|horzopen|distance|pixelize|zoomin)/.test(n)) return "formas";
    return "especiales";
  }
  function itemsTab(tab) {
    const out = [];
    const cat = E.cat || { efectos: [], presets: [], transiciones: [], anims: [] };
    if (tab === "textos") {
      for (const [k, p] of Object.entries(ED.PLANTILLAS || {})) {
        const e = p.estilo;
        const m = el("div", { class: "pl-muestra", style: { color: ED.hexDe(e.color), textShadow: e.resplandor ? `0 0 8px ${e.resplandor.color}` : "", background: e.caja ? "rgba(0,0,0,.55)" : "" } }, p.items[0].texto.split("\n")[0].slice(0, 10));
        if (e.degradado) Object.assign(m.style, { background: `linear-gradient(${e.degradado.angulo + 90}deg, ${e.degradado.desde}, ${e.degradado.hasta})`, webkitBackgroundClip: "text", color: "transparent" });
        out.push({ id: "plantilla:" + k, tab, cat: "plantillas", nombre: p.nombre, desc: p.desc, mini: m, clase: "oscuro", datos: { k: "plantilla", nombre: k }, accion: () => ED.aplicarPlantilla(k), pista: "Doble clic: en el cabezal · arrastra a una pista V" });
      }
      for (const [k, e] of Object.entries(ED.estilosTodos ? ED.estilosTodos() : {}).filter(([k]) => !k.startsWith("propio_") && !k.startsWith("plantilla_")))
        out.push({ id: "estilo:" + k, tab, cat: "estilos", nombre: humano(k), desc: `${e.tamano || 120} px`, mini: `<b class="aa" style="color:${ED.hexDe(e.color)}">Aa</b>`, clase: "oscuro", datos: { k: "estilo", nombre: k }, accion: () => ED.nuevoTexto(E.t, { estilo: k }) });
      for (const a of (cat.anims || []).filter((a) => (cat.anims_schema || []).includes(a.nombre)))
        out.push({ id: "anim:" + a.nombre, tab, cat: "anims", nombre: humano(a.nombre), desc: a.desc, icono: a.letra ? "type" : "sparkles", datos: { k: "anim", nombre: a.nombre }, pista: "Arrastra sobre un texto" });
    } else if (tab === "efectos") {
      for (const p of cat.presets || []) out.push({ id: "efecto:" + p.nombre, tab, cat: "presets", nombre: humano(p.nombre), desc: p.desc, mini: miniColor(COLOR_EF.presets, "layers"), datos: { k: "efecto", nombre: p.nombre }, pista: "Arrastra a un clip, a una escena o a la pista Efectos" });
      for (const e of cat.efectos || []) out.push({ id: "efecto:" + e.nombre, tab, cat: e.categoria, nombre: humano(e.nombre), desc: e.desc, mini: miniColor(COLOR_EF[e.categoria] || "#555", (CAT_EF[e.categoria] || [0, "wand-sparkles"])[1]), datos: { k: "efecto", nombre: e.nombre }, pista: "Arrastra a un clip, a una escena o a la pista Efectos" });
      for (const prov of Object.values(B.cats.efectos || {})) for (const e of (prov._items || [])) out.push({ tab, cat: prov.id, mini: miniColor(COLOR_EF.plugins, "sticker"), ...e, id: e.id || "plugin:" + e.nombre });
    } else if (tab === "transiciones") {
      for (const t of cat.transiciones || []) {
        const g = t.origen === "catálogo" ? "especiales" : trGrupo(t.nombre);
        out.push({ id: "trans:" + t.nombre, tab, cat: g, nombre: humano(t.nombre), desc: t.desc, mini: `<span class="tile-trans t-${g}"></span>`, datos: { k: "transicion", nombre: t.nombre }, pista: "Arrastra sobre un clip de V1: entra en ese corte" });
      }
    } else if (tab === "audio") {
      for (const [k, n] of ED.SFX || []) {
        out.push({ id: "sfx:" + k, tab, cat: "sfx", nombre: n, icono: "audio-lines", datos: { k: "sfx", nombre: k }, accion: () => hacer({ op: "lista_nuevo", lista: "sfx", item: { tipo: k, t: r3(E.t) } }), pista: "Doble clic: en el cabezal · el botón ▶ lo escucha",
          extra: (t) => t.append(el("button", { class: "tile-play", title: "Escuchar", "aria-label": "Escuchar " + n, html: ico("play", 11), onclick: (ev) => { ev.stopPropagation(); new Audio(`/api/editor/sfx/${k}`).play(); } })) });
      }
      for (const a of ED.aliasDe("musica")) out.push({ id: "musica:" + a, tab, cat: "musica", nombre: nombreFuente(a), desc: E.fuentes[a].dur ? fmt(E.fuentes[a].dur) : "", icono: "music", datos: { k: "medio", tipo: "musica", alias: a, dur: E.fuentes[a].dur } });
      for (const m of (E.medios || []).filter((m) => m.rol === "voz")) out.push({ id: "voz:" + m.ruta, tab, cat: "voz", nombre: (m.nombre || m.ruta.split(/[\\/]/).pop()).replace(/\.[^.]+$/, ""), desc: m.nota || "", icono: "mic", datos: { k: "medio", tipo: "musica", ruta: m.ruta, rol: "voz", dur: m.dur } });
    } else if (tab === "animar" && B.presetsAnim) {
      for (const p of B.presetsAnim) out.push({ id: "animar:" + p.id, tab, cat: catAnimar(p.id), nombre: p.nombre, desc: p.descripcion, icono: "person-standing", accion: () => ED.anim && ED.anim.insertarPreset && ED.anim.insertarPreset(p.id) });
    }
    return out;
  }
  // Animar › Firmas y apariciones · Personajes · Presets de escena · Partículas · 3D
  function catAnimar(id) {
    if (/firma|logo|texto/.test(id)) return "firmas";
    if (/confeti|monedas|particula|chispa/.test(id)) return "particulas";
    if (/personaje|rig|sprite/.test(id)) return "personajes";
    return "escenas";
  }
  ED.catAnimar = catAnimar;
  const SECS = {
    textos: [["plantillas", "Plantillas de gráficos", "layout-panel-left", "Títulos, tercios inferiores y llamadas a la acción listos (como las MOGRT de Premiere)"], ["estilos", "Estilos", "type"], ["anims", "Animaciones de entrada", "sparkles"]],
    efectos: [["presets", "Combinaciones", "layers", "Varios efectos en uno"], ...Object.entries(CAT_EF).map(([k, [t, i]]) => [k, t, i]), ["plugins", "Mis efectos", "sticker", "Efectos propios (plugins) guardados en tu biblioteca"]],
    transiciones: [["suaves", "Suaves", "blend"], ["barridos", "Barridos y deslizamientos", "chevrons-left-right"], ["formas", "Formas", "circle"], ["especiales", "Especiales", "sparkles"], ["plugins", "Mis transiciones", "sticker", "Transiciones propias (plugins) guardadas en tu biblioteca"]],
    audio: [["sfx", "Efectos de sonido", "audio-lines"], ["musica", "Música del proyecto", "music"], ["voz", "Voz en off", "mic"]],
  };
  const TAB_TXT = { medios: "Medios", textos: "Texto", efectos: "Efectos", transiciones: "Transiciones", audio: "Audio", animar: "Animar" };

  // ================================================================== render de la pestaña
  function cabecera(c) {
    const q = el("input", { class: "bib-buscar", type: "search", placeholder: "Buscar en toda la biblioteca…", value: B.q, "aria-label": "Buscar en toda la biblioteca" });
    q.addEventListener("input", debounce(() => { B.q = q.value.trim(); ED.renderBiblio(); const b = $("#bib-lista .bib-buscar"); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }, 180));
    q.addEventListener("keydown", (e) => { if (e.key === "Escape" && q.value) { e.stopPropagation(); q.value = ""; B.q = ""; ED.renderBiblio(); } });
    c.append(el("div", { class: "bib-cabecera" }, el("span", { class: "bib-ic", html: ico("search", 14) }), q));
  }
  function render(c) {
    if (!E.plan && E.bib !== "medios") return false;
    cabecera(c);
    if (B.q) { resultados(c); return true; }
    if (E.bib === "medios") { proyecto(c); return true; }
    const items = itemsTab(E.bib);
    const secs = [];
    const favs = items.filter((i) => B.fav.has(i.id));
    const recs = B.rec.map((id) => items.find((i) => i.id === id)).filter(Boolean);
    if (E.bib === "textos") c.append(el("div", { class: "bib-acciones" }, el("button", { class: "bt acento", title: "Texto nuevo en el cabezal (T)", onclick: () => ED.nuevoTexto(), html: `${ico("type", 14)} Texto en el cabezal` })));
    if (E.bib === "audio") c.append(el("div", { class: "bib-acciones" }, el("button", { class: "bt", title: "Graba tu voz con el micrófono: queda como medio del proyecto y va directo a la pista A focalizada", onclick: () => ED.pro && ED.pro.grabarVoz(), html: `${ico("mic", 14)} Grabar voz en off` })));
    if (favs.length) secs.push({ id: "fav", titulo: "Favoritos", icono: "star", items: favs });
    if (recs.length) secs.push({ id: "rec", titulo: "Recientes", icono: "history", items: recs });
    for (const [id, tit, icono, ayuda] of SECS[E.bib] || []) {
      const its = items.filter((i) => i.cat === id);
      if (id === "plugins") {
        const ext = (window.WDVS._externos || {}).plugins;
        if (ext) { secs.push({ id, titulo: tit, icono, ayuda, montar: (cu) => montarPlugins(cu, ext, E.bib === "transiciones" ? "transicion" : "efecto") }); continue; }
        const provs = Object.values(B.cats[E.bib] || {});
        secs.push({ id, titulo: tit, icono, ayuda, n: its.length, montar: (cu) => {
          if (provs.some((p) => p.montar)) { for (const p of provs) if (p.montar) { try { p.montar(cu, { pid: E.pid, editor: ED }); } catch (e) { console.warn(e); } } return; }
          if (its.length) return rejilla(cu, its, "efectos:plugins");
          cu.append(el("div", { class: "acord-vacio" }, "Aún no tienes efectos propios. Cuando crees o importes uno, aparecerá aquí para siempre."));
        } });
        continue;
      }
      if (!its.length && !["voz"].includes(id)) continue;
      secs.push({ id, titulo: tit, icono, ayuda, items: its, vacio: id === "voz" ? "Graba tu voz con el botón de arriba o importa un audio con rol Voz." : undefined });
    }
    // categorías propias de otros módulos (WDVS.registrarCategoria) que no son «plugins», p. ej. Títulos animados
    for (const p of Object.values(B.cats[E.bib] || {})) {
      if (p.id === "plugins" || (SECS[E.bib] || []).some((s) => s[0] === p.id)) continue;
      secs.push({ id: p.id, titulo: p.titulo || p.id, icono: p.icono || "layers", ayuda: p.ayuda, n: p.montar ? undefined : (p._items || []).length,
        ...(p.montar ? { montar: (cu) => { try { p.montar(cu, { pid: E.pid, editor: ED }); } catch (e) { console.warn(e); } } } : { items: p._items || [] }) });
    }
    acordeon(c, secs);
    return true;
  }
  // Búsqueda global: resultados de todas las pestañas agrupados («Efectos · Cámara»)
  async function resultados(c) {
    const f = B.q.toLowerCase();
    const pasa = (it) => `${it.nombre} ${it.desc || ""}`.toLowerCase().includes(f);
    if (!B.presetsAnim) cargarAnim();
    const grupos = [];
    for (const tab of ["medios", "textos", "efectos", "transiciones", "audio", "animar"]) {
      const its = (tab === "medios" ? itemsMedios() : itemsTab(tab)).filter(pasa);
      if (its.length) grupos.push([tab, its]);
    }
    if (!grupos.length) { c.append(el("div", { class: "acord-vacio" }, `Nada coincide con «${B.q}».`)); return; }
    for (const [tab, its] of grupos) {
      c.append(el("div", { class: "bib-cat" }, `${TAB_TXT[tab]} · ${its.length}`));
      rejilla(c, its, "busca:" + tab);
    }
  }
  function cargarAnim() {
    if (B.presetsAnim) return;
    B.presetsAnim = [];
    ED.pedir("/api/anim/presets").then((r) => { B.presetsAnim = r.ok ? r.d.presets || [] : []; if (B.q) ED.renderBiblio(); });
  }

  // ================================================================== panel Proyecto (Medios con bandejas)
  const nr = (r) => String(r || "").replace(/\\/g, "/").toLowerCase();
  const TIPO_CAT = { video: "video", audio: "musica", imagen: "imagen" };
  function itemsMedios() {
    const vistos = new Set(), out = [];
    const medioDe = (ruta) => (E.medios || []).find((m) => nr(m.ruta) === nr(ruta)) || null;
    for (const [a, fu] of Object.entries(E.fuentes || {})) {
      if (fu.ruta) vistos.add(nr(fu.ruta));
      const md = medioDe(fu.ruta);
      out.push({ alias: a, ruta: fu.ruta, tipo: fu.tipo, dur: fu.dur, existe: fu.existe, medio: md, nombre: (fu.ruta || a).split(/[\\/]/).pop(), agregado: md && md.agregado });
    }
    for (const m of E.medios || []) if (!vistos.has(nr(m.ruta))) out.push({ alias: null, ruta: m.ruta, tipo: TIPO_CAT[m.tipo] || (m.rol === "logo" ? "imagen" : m.rol), dur: m.dur, existe: true, medio: m, nombre: m.nombre || m.ruta.split(/[\\/]/).pop(), agregado: m.agregado });
    for (const m of out) if (/[\\/]estabilizados[\\/]/i.test(m.ruta || "")) m.nombre = `Clip estabilizado (${m.alias || ""})`;
    return out.map((m) => ({ ...m, id: "medio:" + nr(m.ruta || m.alias), nombre: m.nombre.replace(/\.[^.]+$/, ""), desc: m.medio && m.medio.nota ? m.medio.nota : (m.dur ? fmt(m.dur) : ""), datos: { k: "medio", tipo: m.tipo, alias: m.alias, ruta: m.ruta, dur: m.dur, rol: m.medio ? m.medio.rol : null }, mini: miniMedio(m), accion: () => ED.pro && ED.pro.abrirOrigen(m) }));
  }
  function miniMedio(m) {
    if (m.tipo === "musica") return ico(m.medio && m.medio.rol === "voz" ? "mic" : "audio-lines", 20);
    const src = m.alias ? `media/poster.jpg` : `media/poster.jpg`;
    return `<img src="${esc(src)}" loading="lazy" draggable="false" alt="">`;
  }
  async function cargarBandejas() {
    if (B.bandPid === E.pid) return;
    B.bandPid = E.pid;
    const r = await ED.pedir(`${ED.pidURL()}/editor/bandejas`);
    if (r.ok) B.band = { bandejas: r.d.bandejas || [], asignacion: r.d.asignacion || {}, vista: r.d.vista || {} };
    if (E.bib === "medios") ED.renderBiblio();
  }
  const guardarBandejas = debounce(() => ED.pedir(`${ED.pidURL()}/editor/bandejas`, { method: "PUT", json: B.band }), 400);
  function nuevaBandeja(nombre) {
    const id = "b" + Date.now().toString(36);
    B.band.bandejas.push({ id, nombre: nombre || `Bandeja ${B.band.bandejas.length + 1}` });
    B.abiertas.medios = id; lsSet("wded_bib_abierta", B.abiertas);
    guardarBandejas(); return id;
  }
  function moverABandeja(rutas, id) {
    for (const r of rutas) { if (id) B.band.asignacion[nr(r)] = id; else delete B.band.asignacion[nr(r)]; }
    guardarBandejas(); ED.renderBiblio();
    toast(`${rutas.length} medio(s) movidos a «${id ? (B.band.bandejas.find((b) => b.id === id) || {}).nombre : "Sin bandeja"}»`, "info", 1600);
  }
  function proyecto(c) {
    if (B.bandPid !== E.pid) cargarBandejas();
    const inp = el("input", { type: "file", multiple: true, accept: "video/*,audio/*,image/*", style: { display: "none" } });
    inp.addEventListener("change", () => ED.subirArchivos && ED.subirArchivos([...inp.files]));
    let todos = itemsMedios();
    const filtro = B.filtroMed;
    if (filtro !== "todos") todos = todos.filter((m) => (filtro.startsWith("rol:") ? m.medio && m.medio.rol === filtro.slice(4) : m.tipo === filtro));
    const ord = { nombre: (a, b) => a.nombre.localeCompare(b.nombre, "es"), duracion: (a, b) => (b.dur || 0) - (a.dur || 0), tipo: (a, b) => String(a.tipo).localeCompare(String(b.tipo)) || a.nombre.localeCompare(b.nombre, "es"), fecha: (a, b) => String(b.agregado || "").localeCompare(String(a.agregado || "")) };
    todos.sort(ord[B.ordenMed] || ord.nombre);
    const selOrden = el("select", { class: "chico", "aria-label": "Ordenar medios", title: "Ordenar" }, ...[["nombre", "Nombre"], ["duracion", "Duración"], ["tipo", "Tipo"], ["fecha", "Recientes"]].map(([v, t]) => el("option", { value: v, selected: v === B.ordenMed }, t)));
    selOrden.onchange = () => { B.ordenMed = selOrden.value; lsSet("wded_med_orden", B.ordenMed); ED.renderBiblio(); };
    const roles = [...new Set((E.medios || []).map((m) => m.rol).filter(Boolean))];
    const selFiltro = el("select", { class: "chico", "aria-label": "Filtrar medios", title: "Filtrar por tipo o rol" },
      ...[["todos", "Todo"], ["video", "Videos"], ["musica", "Audio"], ["imagen", "Imágenes"], ...roles.map((r) => ["rol:" + r, "Rol: " + ((ED.ROL_TXT || {})[r] || r)])].map(([v, t]) => el("option", { value: v, selected: v === filtro }, t)));
    selFiltro.onchange = () => { B.filtroMed = selFiltro.value; ED.renderBiblio(); };
    const vista = (v, icono, tit) => el("button", { class: "ib" + (B.vistaMed === v ? " on" : ""), "aria-pressed": String(B.vistaMed === v), title: tit, "aria-label": tit, html: ico(icono, 14), onclick: () => { B.vistaMed = v; lsSet("wded_med_vista", v); ED.renderBiblio(); } });
    c.append(el("div", { class: "bib-acciones" },
      el("button", { class: "bt acento", title: "Elige videos, música o imágenes con la ventana de Windows (no se copian)", onclick: () => ED.importarNativo(false, inp), html: `${ico("upload", 14)} Importar` }),
      el("button", { class: "ib", title: "Agregar una carpeta completa (no se copian)", "aria-label": "Desde carpeta", onclick: () => ED.importarNativo(true, inp), html: ico("folder-open", 14) }),
      el("button", { class: "ib", title: "Nueva bandeja (carpeta para ordenar tus medios)", "aria-label": "Nueva bandeja", onclick: () => { const n = prompt("Nombre de la bandeja", `Bandeja ${B.band.bandejas.length + 1}`); if (n !== null) { const id = nuevaBandeja(n.trim()); if (B.medSel.size) moverABandeja([...B.medSel], id); else ED.renderBiblio(); } }, html: ico("folder-plus", 14) }),
      el("span", { class: "espacio" }), vista("iconos", "layout-grid", "Vista de iconos"), vista("lista", "list", "Vista de lista"), inp),
      el("div", { class: "bib-filtros" }, selFiltro, selOrden));
    const todosSinFiltro = itemsMedios();
    if (!todosSinFiltro.length) {
      c.append(el("div", { class: "vacio-medios vacio-guia" }, el("span", { html: ico("upload", 32) }), el("b", {}, "Arrastra tus videos aquí"), el("span", {}, "o pulsa Importar. También música, imágenes y tu logo. No se copian: se usan donde están.")));
      return;
    }
    // bandejas como secciones del acordeón (+ «Sin bandeja»)
    const deBandeja = (id) => todos.filter((m) => (B.band.asignacion[nr(m.ruta)] || "") === id && !(id && !B.band.bandejas.some((b) => b.id === id)));
    const huerf = todos.filter((m) => { const b = B.band.asignacion[nr(m.ruta)]; return !b || !B.band.bandejas.some((x) => x.id === b); });
    const secs = B.band.bandejas.map((b) => ({ id: b.id, titulo: b.nombre, icono: "folder", n: deBandeja(b.id).length, montar: (cu) => listaMedios(cu, deBandeja(b.id), b.id) }));
    secs.push({ id: "", titulo: B.band.bandejas.length ? "Sin bandeja" : "Todos los medios", icono: "film", n: huerf.length, montar: (cu) => listaMedios(cu, huerf, "") });
    if (!(B.abiertas.medios !== undefined && secs.some((s) => s.id === B.abiertas.medios))) B.abiertas.medios = secs[secs.length - 1].id;
    const acc = acordeon(c, secs, { clave: "medios" });
    // soltar medios sobre la cabecera de una bandeja = moverlos
    for (const s of acc.querySelectorAll(".acord-sec")) {
      const cab = s.querySelector(".acord-cab");
      cab.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("application/x-wdvs-medios")) { e.preventDefault(); cab.classList.add("drop"); } });
      cab.addEventListener("dragleave", () => cab.classList.remove("drop"));
      cab.addEventListener("drop", (e) => { cab.classList.remove("drop"); const d = e.dataTransfer.getData("application/x-wdvs-medios"); if (d) { e.preventDefault(); moverABandeja(JSON.parse(d), s.dataset.sec); } });
      if (s.dataset.sec) cab.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const b = B.band.bandejas.find((x) => x.id === s.dataset.sec);
        ED.menu(e.clientX, e.clientY, [["Renombrar bandeja", () => { const n = prompt("Nombre", b.nombre); if (n) { b.nombre = n.trim(); guardarBandejas(); ED.renderBiblio(); } }],
          ["Quitar bandeja (los medios pasan a «Sin bandeja»)", () => { B.band.bandejas = B.band.bandejas.filter((x) => x !== b); for (const [k, v] of Object.entries(B.band.asignacion)) if (v === b.id) delete B.band.asignacion[k]; guardarBandejas(); ED.renderBiblio(); }]]);
      });
    }
    const n = B.medSel.size;
    c.append(el("div", { class: "bib-pie", "aria-live": "polite" }, `${todos.length} elemento(s)${n ? ` · ${n} seleccionado(s)` : ""}`,
      n ? el("button", { class: "btn fantasma chico", onclick: () => { B.medSel.clear(); ED.renderBiblio(); } }, "Quitar selección") : null));
    if (n === 1 && ED.editorMedio) {
      const md = (E.medios || []).find((m) => nr(m.ruta) === [...B.medSel][0]);
      if (md) c.append(ED.editorMedio(md));
    }
  }
  function listaMedios(cu, lista, bandeja) {
    if (!lista.length) { cu.append(el("div", { class: "acord-vacio" }, bandeja ? "Arrastra medios aquí (a la cabecera de la bandeja)." : "Sin medios con este filtro.")); return; }
    const esLista = B.vistaMed === "lista";
    const g = el("div", { class: esLista ? "med-lista" : "tiles med-tiles", role: "listbox", "aria-multiselectable": "true", "aria-label": "Medios" });
    const orden = lista.map((m) => nr(m.ruta));
    for (const m of lista) {
      const k = nr(m.ruta);
      const sel = B.medSel.has(k);
      const insignia = m.medio ? el("span", { class: "rol r-" + m.medio.rol, title: "Rol: " + ((ED.ROL_TXT || {})[m.medio.rol] || m.medio.rol) }, (ED.ROL_CORTO || {})[m.medio.rol] || m.medio.rol) : null;
      const t = esLista
        ? el("div", { class: "med-fila" + (sel ? " sel" : "") + (m.existe === false ? " falta" : ""), role: "option", "aria-selected": String(sel), tabindex: "0", title: `${m.ruta || ""}\nDoble clic: abrir en el monitor de origen` },
          el("span", { class: "mm", html: m.mini }), el("span", { class: "nom" }, m.nombre), el("span", { class: "dur num" }, m.dur ? fmt(m.dur).replace(/\.\d+$/, "") : ""), insignia)
        : el("div", { class: "tile med" + (sel ? " sel" : "") + (m.existe === false ? " falta" : ""), role: "option", "aria-selected": String(sel), tabindex: "0", title: `${m.nombre}\n${m.ruta || ""}\nDoble clic: abrir en el monitor de origen` },
          el("div", { class: "tile-mini foto", html: m.mini }, m.dur ? el("span", { class: "dur" }, fmt(m.dur).replace(/\.\d+$/, "")) : null, insignia), el("span", { class: "tile-nom" }, m.nombre));
      t.addEventListener("click", (e) => {
        if (e.shiftKey && B.ancla) {
          const a = orden.indexOf(B.ancla), b = orden.indexOf(k);
          if (a >= 0 && b >= 0) { if (!e.ctrlKey) B.medSel.clear(); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) B.medSel.add(orden[i]); }
        } else if (e.ctrlKey || e.metaKey) { if (sel) B.medSel.delete(k); else B.medSel.add(k); B.ancla = k; }
        else { B.medSel = new Set(sel && B.medSel.size === 1 ? [] : [k]); B.ancla = k; }
        ED.renderBiblio();
      });
      t.addEventListener("dblclick", () => { marcarReciente(m.id); if (ED.pro) ED.pro.abrirOrigen(m); });
      t.addEventListener("keydown", (e) => { if (e.key === "Enter" && ED.pro) ED.pro.abrirOrigen(m); });
      t.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (!B.medSel.has(k)) { B.medSel = new Set([k]); ED.renderBiblio(); }
        const rutas = [...B.medSel];
        ED.menu(e.clientX, e.clientY, [
          ["Abrir en el monitor de origen", () => ED.pro && ED.pro.abrirOrigen(m), "Doble clic"],
          ...B.band.bandejas.map((b) => [`Mover a «${b.nombre}»`, () => moverABandeja(rutas, b.id)]),
          ["Mover a una bandeja nueva…", () => { const n = prompt("Nombre de la bandeja", `Bandeja ${B.band.bandejas.length + 1}`); if (n !== null) moverABandeja(rutas, nuevaBandeja(n.trim())); }],
          B.band.asignacion[k] ? ["Sacar de la bandeja", () => moverABandeja(rutas, "")] : null,
        ]);
      });
      ED.arrastrable(t, m.datos);
      t.addEventListener("dragstart", (e) => { const rs = B.medSel.has(k) ? [...B.medSel] : [k]; e.dataTransfer.setData("application/x-wdvs-medios", JSON.stringify(rs)); e.dataTransfer.effectAllowed = "copyMove"; });
      g.append(t);
    }
    cu.append(g);
  }

  // plugins (plugins_panel.js, docs/plugins.md §9): su panel dentro de la categoría; elegir uno lo aplica a la selección
  function montarPlugins(cu, def, tipo) {
    const alElegir = (ref) => {
      const s = E.sel;
      marcarReciente("plugin:" + ref);
      if (tipo === "transicion") {
        if (!(s && s.tipo === "toma")) return toast("Selecciona un clip de V1: la transición entra en su corte", "info");
        if (s.k === 0 && s.g === 0) return toast("El primer clip del video no lleva transición de entrada", "info");
        if (s.k === 0) return hacer({ op: "grupo_props", g: s.g, props: { transicion: { tipo: ref, dur: 0.4 } } });
        return hacer({ op: "lote", desc: "transición", ops: [{ op: "grupo_dividir", g: s.g, k: s.k }, { op: "grupo_props", g: s.g + 1, props: { transicion: { tipo: ref, dur: 0.4 } } }] });
      }
      if (s && s.tipo === "toma") return hacer({ op: "efecto_agregar", g: s.g, k: s.k, donde: "toma", efecto: ref });
      return hacer({ op: "lista_nuevo", lista: "efectos", item: { efecto: ref, desde: r3(E.t), hasta: r3(Math.min(ED.V().total, E.t + 2)) } });
    };
    try { def.montar(cu, { tipo, alElegir, pid: E.pid, editor: ED }); }
    catch (e) { console.warn(e); cu.append(el("div", { class: "acord-vacio" }, "No se pudo abrir tu biblioteca de efectos.")); }
  }
  function externo(def) { if (["efectos", "transiciones"].includes(E.bib)) ED.renderBiblio(); }

  ED.bib = { externo, montarPlugins, render, acordeon, rejilla, tile, itemsTab, marcarReciente, B, cargarAnim, seleccionMedios: () => [...B.medSel] };
  // Contrato para otros módulos: una categoría propia dentro de una pestaña (p. ej. «Mis efectos» de los plugins):
  // WDVS.registrarCategoria("efectos", {id: "plugins", items: [{nombre, desc, datos: {k: "efecto", nombre}}], montar?(cont, ctx)})
  window.WDVS.registrarCategoria = (tab, def) => {
    const t = (B.cats[tab] = B.cats[tab] || {});
    t[def.id || "plugins"] = { ...def, id: def.id || "plugins", _items: def.items || [] };
    if (E.bib === tab) ED.renderBiblio();
  };
  cargarAnim();
})();
