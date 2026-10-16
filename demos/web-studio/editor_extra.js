"use strict";
// Web Studio — organización (G), experiencia de uso (K), scopes (E5) y paneles de otros módulos, 5-oct-2026.
// docs/editor.md §9.
// - Pestaña «Buscar» de la biblioteca: búsqueda por contenido (voz, escenas, textos), estrellas y etiquetas por medio,
//   colecciones inteligentes, consolidar proyecto, relinkear y papelera con recuperación.
// - Panel derecho «Historial»: deshacer visual con miniaturas.
// - Apariencia y accesibilidad: tema claro/oscuro, tamaño de letra, alto contraste, menos movimiento; modo «Mínimo»
//   (solo chat, vista previa y exportar); atajos compatibles con Premiere o CapCut; tutoriales por función.
// - Contratos para otros agentes: WDVS.registrarPanelDerecho(id, {titulo, icono, montar}),
//   WDVS.registrarSeccionInspector(id, fn(cont, {sel, actor, editor})) y los paneles con nombre fijo
//   WDVS.montarReglas / montarInteracciones / montarVoces (panel derecho) y WDVS.montarPersonajes (pantalla completa).
(() => {
  const ED = window.WDED; if (!ED) return;
  const { E, $, $$, el, esc, pedir, hacer, toast, r3, ico, pidURL, lsGet, lsSet } = ED;
  const V = () => E.vista;
  const ic = (n, t = 14) => el("span", { class: "i", "aria-hidden": "true", html: ico(n, t) });
  const WD = () => window.WDVS || {};
  const fmtS = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // ================================================================== contratos para otros módulos
  window.WDVS = window.WDVS || {};
  WDVS.registrarPanelDerecho = (id, def) => ED.panelDerecho && ED.panelDerecho(id, def);
  WDVS.registrarSeccionInspector = (id, fn) => { (WDVS._seccionesInsp = WDVS._seccionesInsp || {})[id] = fn; if (E.plan && ED.renderInspector) ED.renderInspector(); };
  const EXTERNOS = [];   // Reglas, Interacciones y Voces ya tienen contrato: los monta editor_escena_ui.js / Audio › Voces

  const montados = new Set();
  function revisarExternos() {
    for (const x of EXTERNOS) if (!montados.has(x.id) && typeof WD()[x.fn] === "function") {
      montados.add(x.id);
      ED.panelDerecho(x.id, { titulo: x.titulo, corto: x.corto, icono: x.icono, montar: (c) => WD()[x.fn](c, { pid: E.pid, editor: ED }) });
      ajustarTabs();
    }
  }
  setInterval(revisarExternos, 2000);
  function abrirExterno(x) {
    revisarExternos();
    if (montados.has(x.id)) return ED.abrirDer(x.id);
    ED.modal(x.titulo, el("div", { class: "vacio-guia" }, el("span", { html: ico(x.icono, 28) }), el("b", {}, "Todavía no está instalado"), el("span", {}, x.vacio)));
  }
  function personajes() {
    if (typeof WD().montarPersonajes !== "function") return ED.modal("Personajes", el("div", { class: "vacio-guia" }, el("span", { html: ico("users", 28) }), el("b", {}, "Todavía no está instalado"), el("span", {}, "Aquí vas a ver y editar los personajes de tus videos. Llega con el módulo de personajes.")));
    const cont = el("div", { class: "wded-pantalla", role: "dialog", "aria-label": "Personajes" });
    const cerrar = () => { cont.remove(); document.removeEventListener("keydown", esc_); };
    const esc_ = (e) => { if (e.key === "Escape" && !e.target.closest("input, textarea")) cerrar(); };
    const barra = el("div", { class: "wded-pantalla-barra" }, el("button", { class: "bt", onclick: cerrar }, ic("arrow-left", 14), "Volver al editor"), el("b", {}, "Personajes"));
    const cuerpo = el("div", { class: "wded-pantalla-cuerpo" });
    cont.append(barra, cuerpo); document.body.append(cont); document.addEventListener("keydown", esc_);
    try { WD().montarPersonajes(cuerpo, { pid: E.pid, editor: ED, cerrar }); } catch (e) { console.error(e); cuerpo.append(el("div", { class: "vacio-guia" }, el("b", {}, "No se pudo abrir"), el("span", {}, String(e.message || e)))); }
  }
  ED.personajes = personajes;
  function ajustarTabs() { const t = $("#der-tabs"); if (t) t.classList.toggle("muchos", t.children.length > 3); }

  // ================================================================== G: pestaña Buscar / Organizar
  const O = { meta: { medios: {}, papelera: [] }, q: "", filtro: "todos", res: null, cargado: null };
  async function cargarMeta() { if (O.cargado === E.pid) return; const r = await pedir(`${pidURL()}/editor/medios_meta`); if (r.ok) O.meta = { medios: r.d.medios || {}, papelera: r.d.papelera || [] }; O.cargado = E.pid; }
  const guardarMeta = ED.debounce(() => pedir(`${pidURL()}/editor/medios_meta`, { method: "PUT", json: O.meta }), 500);
  const mm = (ruta) => (O.meta.medios[ruta] = O.meta.medios[ruta] || { estrellas: 0, etiquetas: [] });
  const usados = () => new Set(Object.values(E.fuentes || {}).map((f) => (f.ruta || "").toLowerCase()));
  const COLECCIONES = [
    ["todos", "Todos", () => true],
    ["fav", "4★ o más", (m) => (O.meta.medios[m.ruta] || {}).estrellas >= 4],
    ["sinusar", "Sin usar en el video", (m) => !usados().has((m.ruta || "").toLowerCase())],
    ["videos", "Videos", (m) => m.tipo === "video"],
    ["audio", "Música y audio", (m) => m.tipo === "audio" || m.rol === "musica"],
    ["etiquetados", "Con etiquetas", (m) => ((O.meta.medios[m.ruta] || {}).etiquetas || []).length > 0],
  ];
  async function montarBuscar(c) {
    await cargarMeta();
    c.innerHTML = "";
    const inp = el("input", { type: "search", placeholder: "Busca lo que se ve o se dice: «ruleta», «WD»…", "aria-label": "Buscar por contenido", value: O.q });
    const res = el("div", { class: "org-res", "aria-live": "polite" });
    const buscar = ED.debounce(async () => {
      O.q = inp.value.trim(); res.innerHTML = "";
      if (O.q.length < 2) return;
      const r = await pedir(`${pidURL()}/editor/buscar?q=${encodeURIComponent(O.q)}`);
      const rs = r.ok ? r.d.resultados : [];
      if (!rs.length) return res.append(el("div", { class: "tenue" }, "Sin resultados. Para buscar en lo que se dice, transcribe la voz en el panel Guion."));
      const IC = { voz: "message-square-quote", escena: "clapperboard", imagen: "eye", texto: "type" };
      for (const x of rs.slice(0, 60)) res.append(el("button", { class: "org-hit", onclick: () => { if (x.salida != null) { ED.ponerT(x.salida, { seguir: true }); if (x.i != null) ED.seleccionar({ tipo: "overlays", i: x.i }, "solo"); } else toast(`Está en ${x.medio} (${fmtS(x.t0)}), pero no se usa en el video. Ábrelo en el monitor de origen.`, "info", 4000); } },
        el("span", { html: ico(IC[x.tipo] || "search", 14) }), el("span", { class: "org-hit-txt" }, String(x.texto || "").slice(0, 90)), el("span", { class: "tenue" }, x.salida != null ? fmtS(x.salida) : "fuera")));
    }, 300);
    inp.addEventListener("input", buscar);
    const cols = el("div", { class: "chips org-cols", role: "radiogroup", "aria-label": "Colecciones" }, ...COLECCIONES.map(([id, t]) => el("button", { class: "chip" + (O.filtro === id ? " on" : ""), role: "radio", "aria-checked": String(O.filtro === id), onclick: () => { O.filtro = id; montarBuscar(c); } }, t)));
    const etqs = [...new Set(Object.values(O.meta.medios).flatMap((x) => x.etiquetas || []))].sort();
    if (etqs.length) cols.append(...etqs.map((t) => el("button", { class: "chip" + (O.filtro === "etq:" + t ? " on" : ""), onclick: () => { O.filtro = "etq:" + t; montarBuscar(c); } }, "#" + t)));
    const filtro = O.filtro.startsWith("etq:") ? (m) => ((O.meta.medios[m.ruta] || {}).etiquetas || []).includes(O.filtro.slice(4)) : (COLECCIONES.find((x) => x[0] === O.filtro) || COLECCIONES[0])[2];
    const lista = el("div", { class: "org-lista" });
    for (const m of (E.medios || []).filter(filtro)) {
      const d = O.meta.medios[m.ruta] || { estrellas: 0, etiquetas: [] };
      const estrellas = el("span", { class: "estrellas", role: "radiogroup", "aria-label": "Calificación" }, ...[1, 2, 3, 4, 5].map((n) => el("button", { class: "est" + (n <= d.estrellas ? " on" : ""), role: "radio", "aria-checked": String(n === d.estrellas), "aria-label": `${n} estrella${n > 1 ? "s" : ""}`, onclick: () => { const x = mm(m.ruta); x.estrellas = x.estrellas === n ? 0 : n; guardarMeta(); montarBuscar(c); } }, "★")));
      const tags = el("span", { class: "org-tags" }, ...(d.etiquetas || []).map((t) => el("button", { class: "chip mini", title: "Quitar etiqueta", onclick: () => { const x = mm(m.ruta); x.etiquetas = x.etiquetas.filter((y) => y !== t); guardarMeta(); montarBuscar(c); } }, "#" + t + " ×")),
        el("button", { class: "chip mini", "aria-label": "Agregar etiqueta", onclick: (ev) => {
          const inp = el("input", { type: "text", class: "etq-in", placeholder: "intro, toma buena…", "aria-label": "Etiqueta nueva" });
          const listo = () => { const t = inp.value.trim(); if (t) { const x = mm(m.ruta); x.etiquetas = [...new Set([...(x.etiquetas || []), t.toLowerCase().replace(/\s+/g, "_")])]; guardarMeta(); } montarBuscar(c); };
          inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") listo(); if (e.key === "Escape") montarBuscar(c); });
          inp.addEventListener("blur", listo); ev.currentTarget.replaceWith(inp); inp.focus();
        } }, "+ etiqueta"));
      lista.append(el("div", { class: "org-medio" }, el("div", { class: "org-nom", title: m.ruta }, m.nombre || m.ruta), estrellas, tags,
        el("button", { class: "ib", title: "Quitar del proyecto (va a la papelera)", "aria-label": "Quitar del proyecto", html: ico("trash-2", 14), onclick: () => papelera(m, c) })));
    }
    if (!lista.children.length) lista.append(el("div", { class: "tenue" }, "No hay medios en esta colección."));
    const acciones = el("div", { class: "bib-acciones org-acc" },
      el("button", { class: "bt chico", title: "Copia todos los archivos del video a la carpeta del proyecto para moverlo o respaldarlo", onclick: consolidar }, ic("folder-input", 13), "Consolidar"),
      el("button", { class: "bt chico", title: "Busca los archivos que se movieron o renombraron", onclick: relinkearTodo }, ic("link", 13), "Relinkear"),
      el("button", { class: "bt chico", onclick: () => verPapelera(c) }, ic("trash", 13), `Papelera (${O.meta.papelera.length})`));
    c.append(el("div", { class: "org-busca" }, inp), res, el("div", { class: "org-sec" }, "Colecciones"), cols, lista, acciones);
    if (O.q) buscar();
  }
  async function papelera(m, c) {
    const r = await pedir(`/api/proyectos/${encodeURIComponent(E.pid)}/medios?ruta=${encodeURIComponent(m.ruta)}`, { method: "DELETE" });
    if (!r.ok) return toast(r.d.detail || "No se pudo quitar");
    O.meta.papelera.push({ ruta: m.ruta, nombre: m.nombre, rol: m.rol, nota: m.nota, fecha: Date.now() }); guardarMeta();
    E.medios = E.medios.filter((x) => x.ruta !== m.ruta);
    WD().toast ? WD().toast(`«${m.nombre}» está en la papelera.`, "info", { accion: { etiqueta: "Deshacer", fn: () => restaurar(O.meta.papelera[O.meta.papelera.length - 1], c) } }) : toast("Movido a la papelera", "info");
    if (c) montarBuscar(c);
    if (E.bib === "medios") ED.renderBiblio();
  }
  async function restaurar(p, c) {
    if (!p) return;
    const r = await pedir(`/api/proyectos/${encodeURIComponent(E.pid)}/medios`, { method: "POST", json: { ruta: p.ruta, rol: p.rol || null, nota: p.nota || null } });
    if (!r.ok) return toast(r.d.detail || "No se pudo recuperar (¿se borró el archivo?)");
    O.meta.papelera = O.meta.papelera.filter((x) => x !== p); guardarMeta();
    const q = await pedir(pidURL()); if (q.ok) E.medios = q.d.medios || E.medios;
    toast(`Recuperado: ${p.nombre}`, "info", 2000);
    if (c && c.isConnected) montarBuscar(c);
  }
  function verPapelera(c) {
    const m = ED.modal("Papelera", O.meta.papelera.length ? el("div", { class: "org-lista" }, ...[...O.meta.papelera].reverse().map((p) => el("div", { class: "org-medio" }, el("div", { class: "org-nom" }, p.nombre), el("span", { class: "tenue" }, new Date(p.fecha).toLocaleDateString("es-MX")),
      el("button", { class: "bt chico", onclick: () => { m.closest(".wd-modal").remove(); restaurar(p, c); } }, "Recuperar")))) : el("div", { class: "nota" }, "La papelera está vacía."),
    el("div", { class: "nota" }, "Quitar un medio no borra el archivo de tu PC: solo lo saca del proyecto."));
  }
  async function consolidar() {
    if (!(WD().confirmar ? await WD().confirmar({ titulo: "¿Consolidar el proyecto?", cuerpo: "Copio todos los archivos del video a la carpeta del proyecto (medios_consolidados) y el video los usa desde ahí. Así puedes moverlo o respaldarlo completo.", si: "Consolidar" }) : confirm("¿Consolidar el proyecto?"))) return;
    const T = WD().tareas, idT = "consolidar:" + E.pid;
    if (T) T.poner(idT, { titulo: "Consolidando el proyecto", tipo: "render", frac: null });
    const r = await pedir(`${pidURL()}/editor/consolidar`, { method: "POST", json: {} });
    if (T) T.terminar(idT, r.ok, { texto: r.ok ? `${r.d.mb} MB copiados` : (r.d.detail || "No se pudo"), silenciosa: true });
    if (!r.ok) return toast(r.d.detail || "No se pudo consolidar");
    if (Object.keys(r.d.fuentes).length) await hacer({ op: "seccion_props", seccion: "fuentes", props: r.d.fuentes, desc: "consolidar proyecto" });
    toast(`Proyecto consolidado en ${r.d.carpeta} (${r.d.mb} MB).${r.d.faltan.length ? ` Faltan: ${r.d.faltan.join(", ")}` : ""}`, "info", 6000);
  }
  async function relinkearTodo() {
    const r = await pedir(`${pidURL()}/editor/diagnostico`);
    const faltan = (r.ok ? r.d.problemas : []).filter((p) => p.relinkear);
    if (!faltan.length) return toast("Todos los archivos están en su lugar.", "info", 2500);
    for (const f of faltan) { if (ED.relinkear) await ED.relinkear(f.relinkear); }
  }
  if (WD().registrarPanel) WD().registrarPanel("buscar", (cont) => montarBuscar(cont), { titulo: "Buscar", icono: "folder-search" });

  // ================================================================== K3: historial con miniaturas
  const H = [];
  window.addEventListener("wded:editado", async (e) => {
    const it = { desc: (e.detail && e.detail.desc) || "cambio", hora: new Date(), nivel: E.undo.length, img: null, pid: E.pid };
    H.push(it); if (H.length > 80) H.shift();
    try { const r = await fetch(`media/poster.jpg`); if (r.ok) { it.img = URL.createObjectURL(await r.blob()); } } catch { /* sin miniatura */ }
    const c = $("#der-x-historial"); if (c && !c.hidden) pintarHistorial(c);
  });
  function pintarHistorial(c) {
    c.innerHTML = "";
    const hs = H.filter((h) => h.pid === E.pid);
    c.append(el("div", { class: "guion-cab" }, el("b", {}, "Historial"), el("span", { class: "tenue" }, "Clic en un paso para volver a él")));
    if (!hs.length) return c.append(el("div", { class: "vacio-guia" }, el("span", { html: ico("history", 26) }), el("b", {}, "Aún no hay cambios"), el("span", {}, "Cada edición aparece aquí con una miniatura.")));
    const lista = el("div", { class: "hist-lista" });
    lista.append(el("button", { class: "hist-it" + (E.undo.length === 0 ? " actual" : ""), onclick: () => irA(0, c) }, el("span", { class: "hist-mini vacio", html: ico("flag", 14) }), el("span", {}, "Al abrir el proyecto")));
    for (const h of hs) lista.append(el("button", { class: "hist-it" + (h.nivel === E.undo.length ? " actual" : "") + (h.nivel > E.undo.length ? " deshecho" : ""), onclick: () => irA(h.nivel, c), title: h.nivel > E.undo.length ? "Deshecho (Ctrl+Y lo rehace)" : "" },
      h.img ? el("img", { class: "hist-mini", src: h.img, alt: "" }) : el("span", { class: "hist-mini vacio" }), el("span", {}, h.desc), el("span", { class: "tenue" }, h.hora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }))));
    c.append(lista);
    lista.lastChild.scrollIntoView({ block: "nearest" });
  }
  async function irA(nivel, c) {
    while (E.undo.length > nivel) { const n = E.undo.length; await ED.deshacer(); if (E.undo.length === n) break; }
    while (E.undo.length < nivel && E.redo.length) { const n = E.undo.length; await ED.rehacer(); if (E.undo.length === n) break; }
    pintarHistorial(c);
  }
  ED.panelDerecho("historial", { titulo: "Historial de cambios", corto: "Historial", icono: "history", montar: (c) => pintarHistorial(c), alMostrar: (c) => pintarHistorial(c) });
  ajustarTabs();

  // ================================================================== K: apariencia, accesibilidad y modo mínimo
  const AP = Object.assign({ tema: "oscuro", letra: 1, contraste: false, movimiento: false }, lsGet("wdvs_apariencia", {}));
  function aplicarApariencia() {
    const r = document.documentElement;
    const claro = AP.tema === "claro" || (AP.tema === "sistema" && matchMedia("(prefers-color-scheme: light)").matches);
    r.classList.toggle("tema-claro", claro);
    r.classList.toggle("alto-contraste", !!AP.contraste);
    r.classList.toggle("menos-movimiento", !!AP.movimiento);
    const base = { xs: 11, sm: 12, md: 13, lg: 15, xl: 18, "2xl": 22 };
    for (const [k, v] of Object.entries(base)) { if (AP.letra === 1) r.style.removeProperty(`--fs-${k}`); else r.style.setProperty(`--fs-${k}`, Math.round(v * AP.letra) + "px"); }
    lsSet("wdvs_apariencia", AP);
  }
  aplicarApariencia();
  function apariencia() {
    const seg = (clave, ops) => el("div", { class: "segmentado", role: "radiogroup" }, ...ops.map(([v, t]) => el("button", { role: "radio", "aria-checked": String(AP[clave] === v), onclick: (e) => { AP[clave] = v; aplicarApariencia(); $$("button", e.currentTarget.parentNode).forEach((b) => b.setAttribute("aria-checked", String(b === e.currentTarget))); } }, t)));
    const chk = (clave, t) => { const c = el("input", { type: "checkbox", checked: !!AP[clave], onchange: () => { AP[clave] = c.checked; aplicarApariencia(); } }); return el("label", { class: "fila-ctl" }, c, " " + t); };
    const atj = lsGet("wded_atajos", "mn");
    ED.modal("Apariencia y accesibilidad",
      el("div", { class: "exp-sec" }, el("b", {}, "Tema")), seg("tema", [["oscuro", "Oscuro"], ["claro", "Claro"], ["sistema", "Como Windows"]]),
      el("div", { class: "exp-sec" }, el("b", {}, "Tamaño de letra")), seg("letra", [[1, "Normal"], [1.12, "Grande"], [1.25, "Muy grande"]]),
      chk("contraste", "Alto contraste (textos y bordes más marcados)"), chk("movimiento", "Menos movimiento (sin animaciones)"),
      el("div", { class: "exp-sec" }, el("b", {}, "Atajos de teclado")), el("div", { class: "segmentado", role: "radiogroup" }, ...[["mn", "WD (normal)"], ["premiere", "Premiere"], ["capcut", "CapCut"]].map(([v, t]) => el("button", { role: "radio", "aria-checked": String(atj === v), onclick: (e) => { lsSet("wded_atajos", v); $$("button", e.currentTarget.parentNode).forEach((b) => b.setAttribute("aria-checked", String(b === e.currentTarget))); toast(`Atajos: ${t}`, "info", 1500); } }, t))),
      el("div", { class: "nota" }, "Premiere: Ctrl+K divide, Q/W recortan hasta el cabezal, Ctrl+M exporta. CapCut: Ctrl+B divide, Q/W borran a la izquierda/derecha del cabezal, Ctrl+E exporta. El Asistente IA queda en Ctrl+Shift+K."),
      el("div", { class: "nota" }, "El idioma inglés de la interfaz llegará en una siguiente versión."));
  }
  function minimo(on) {
    document.body.classList.toggle("wded-minimo", on); lsSet("wded_minimo", on);
    let b = $("#wded-salir-min");
    if (on && !b) { b = el("button", { class: "bt wded-salir-min", id: "wded-salir-min", onclick: () => minimo(false) }, ic("maximize-2", 14), "Ver el editor completo"); document.body.append(b); }
    if (!on && b) b.remove();
    if (on && ED.abrirDer) ED.abrirDer("ia");
    setTimeout(() => { ED.dimensionarVisor && ED.dimensionarVisor(); ED.actualizarVisor && ED.actualizarVisor(); }, 50);
  }
  ED.minimo = minimo;
  if (lsGet("wded_minimo", false)) setTimeout(() => minimo(true), 500);
  // atajos compatibles con Premiere / CapCut
  function recortarHastaCabezal(lado) {
    const t = ED.tomaEn(E.t); if (!t) return;
    const [a, b] = lado === "izq" ? [t.t0, E.t] : [E.t, t.t0 + t.dur];
    if (b - a < 0.04) return;
    hacer({ op: "tramos_quitar", tramos: [[r3(a), r3(b)]], desc: lado === "izq" ? "recortar inicio hasta el cabezal" : "recortar final desde el cabezal" }).then((ok) => { if (ok && lado === "izq") ED.ponerT(a); });
  }
  ED.ganchosTecla.push((e, ctrl, enCampo) => {
    if (enCampo || !E.plan) return false;
    const p = lsGet("wded_atajos", "mn"), k = e.key.toLowerCase();
    if (p === "mn") return false;
    if (ctrl && e.shiftKey && k === "k") { e.preventDefault(); ED.abrirDer("ia"); return true; }
    if (p === "premiere" && ctrl && !e.shiftKey && k === "k") { e.preventDefault(); ED.dividir(); return true; }
    if (p === "capcut" && ctrl && k === "b") { e.preventDefault(); ED.dividir(); return true; }
    if ((p === "premiere" && ctrl && k === "m") || (p === "capcut" && ctrl && k === "e")) { e.preventDefault(); ED.menuExportar(); return true; }
    if (!ctrl && !e.altKey && (k === "q" || k === "w")) { e.preventDefault(); recortarHastaCabezal(k === "q" ? "izq" : "der"); return true; }
    return false;
  });

  // ================================================================== K1: tutoriales por función
  const TUTORIALES = {
    guion: { titulo: "Editar con texto", pasos: [["#der-tabs [data-dx=guion]", "Abre el Guion", "Aquí ves todo lo que se dice en tu video, palabra por palabra.", () => ED.abrirDer("guion")], ["#der-x-guion", "Borra palabras", "Selecciona palabras y pulsa Supr: el video se corta solo. Las pausas largas aparecen como cápsulas grises."], ["#tl", "Revisa la línea de tiempo", "Cada corte queda aquí. Ctrl+Z lo deshace."]] },
    exportar: { titulo: "Exportar a varias redes", pasos: [["#ed-exportar", "Exportar", "Elige calidad y una o varias redes: cada una sale con su formato y volumen ideales.", null], ["#ed-diag", "Antes de exportar", "Si algo podría fallar (un archivo que se movió, un clip que se acaba), aparece aquí."]] },
    ia: { titulo: "La IA dentro del editor", pasos: [["#tl", "Clic derecho", "Sobre cualquier clip o texto: «Pídele a la IA…» y escribe qué quieres."], ["#ed-sug", "Sugerencias", "El foco te avisa de tomas repetidas, textos difíciles de leer o audio saturado, con «Arreglar»."]] },
    paleta: { titulo: "Paleta de comandos", pasos: [["#wded", "Ctrl+P", "Pulsa Ctrl+P y escribe lo que quieres hacer: «silencios», «exportar», «beat»…", () => ED.paleta && ED.paleta()]] },
  };
  function tutorial(id) {
    const tu = TUTORIALES[id]; if (!tu) return;
    let i = 0;
    const capa = el("div", { class: "tuto", role: "dialog", "aria-label": tu.titulo });
    const foco = el("div", { class: "tuto-foco" }), caja = el("div", { class: "tuto-caja" });
    capa.append(foco, caja); document.body.append(capa);
    const fin = () => { capa.remove(); lsSet("wded_tuto_" + id, 1); };
    const pintar = () => {
      const [sel, tit, txt, antes] = tu.pasos[i];
      if (antes) try { antes(); } catch { /* */ }
      setTimeout(() => {
        const n = $(sel); const r = n && n.getClientRects().length ? n.getBoundingClientRect() : { left: innerWidth / 2 - 100, top: innerHeight / 2 - 40, width: 200, height: 80, right: innerWidth / 2 + 100, bottom: innerHeight / 2 + 40 };
        Object.assign(foco.style, { left: r.left - 4 + "px", top: r.top - 4 + "px", width: r.width + 8 + "px", height: r.height + 8 + "px" });
        caja.innerHTML = "";
        caja.append(el("div", { class: "tenue" }, `${tu.titulo} · ${i + 1} de ${tu.pasos.length}`), el("b", {}, tit), el("p", {}, txt),
          el("div", { class: "botones" }, el("button", { class: "bt chico", onclick: fin }, "Saltar"), el("span", { class: "espacio" }), i ? el("button", { class: "bt chico", onclick: () => { i--; pintar(); } }, "Atrás") : null,
            el("button", { class: "bt chico acento", onclick: () => { if (++i >= tu.pasos.length) return fin(); pintar(); } }, i === tu.pasos.length - 1 ? "Entendido" : "Siguiente")));
        const w = 300; let left = Math.min(innerWidth - w - 10, Math.max(10, r.left)), top = r.bottom + 10;
        if (top + 160 > innerHeight) top = Math.max(10, r.top - 170);
        Object.assign(caja.style, { left: left + "px", top: top + "px", width: w + "px" });
        caja.querySelector(".acento").focus();
      }, antes ? 250 : 0);
    };
    capa.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); fin(); } });
    pintar();
  }
  ED.tutorial = tutorial;

  // ================================================================== E5: scopes (modo Avanzado)
  const SC = { on: false, raf: 0, t: 0 };
  function scopes(on = !SC.on) {
    SC.on = on;
    let p = $("#wded-scopes");
    if (!on) { if (p) p.remove(); cancelAnimationFrame(SC.raf); return; }
    if (!p) {
      p = el("div", { class: "wded-scopes", id: "wded-scopes", "aria-label": "Scopes: histograma y forma de onda" },
        el("div", { class: "botones" }, el("b", {}, "Scopes"), el("span", { class: "espacio" }), el("button", { class: "ib", "aria-label": "Cerrar scopes", html: ico("x", 13), onclick: () => scopes(false) })),
        el("canvas", { width: 256, height: 90, id: "sc-hist", "aria-label": "Histograma" }), el("canvas", { width: 256, height: 90, id: "sc-onda", "aria-label": "Forma de onda de luminancia" }));
      ($("#visor-caja") || document.body).append(p);
    }
    const tmp = document.createElement("canvas"); tmp.width = 128; tmp.height = 72;
    const cx = tmp.getContext("2d", { willReadFrequently: true });
    const paso = (ts) => {
      if (!SC.on) return;
      SC.raf = requestAnimationFrame(paso);
      if (ts - SC.t < 200) return; SC.t = ts;
      const vids = $$("#visor video").filter((v) => v.readyState >= 2 && v.offsetParent !== null && getComputedStyle(v).opacity !== "0");
      const img = $("#visor img:not([hidden])");
      const src = vids[0] || img; if (!src) return;
      try { cx.drawImage(src, 0, 0, 128, 72); } catch { return; }
      let d; try { d = cx.getImageData(0, 0, 128, 72).data; } catch { return; }
      const hr = new Uint32Array(64), hg = new Uint32Array(64), hb = new Uint32Array(64), onda = Array.from({ length: 128 }, () => new Uint16Array(45));
      for (let i = 0, px = 0; i < d.length; i += 4, px++) {
        hr[d[i] >> 2]++; hg[d[i + 1] >> 2]++; hb[d[i + 2] >> 2]++;
        const y = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) | 0;
        onda[px % 128][Math.min(44, (y * 45 / 256) | 0)]++;
      }
      const h = $("#sc-hist").getContext("2d"), mx = Math.max(1, ...hr, ...hg, ...hb);
      h.clearRect(0, 0, 256, 90); h.globalCompositeOperation = "lighter";
      for (const [arr, col] of [[hr, "rgba(255,80,80,.7)"], [hg, "rgba(80,255,120,.7)"], [hb, "rgba(90,140,255,.7)"]]) { h.fillStyle = col; for (let k = 0; k < 64; k++) { const v = arr[k] / mx * 88; h.fillRect(k * 4, 90 - v, 4, v); } }
      h.globalCompositeOperation = "source-over";
      const o = $("#sc-onda").getContext("2d"); o.fillStyle = "#000"; o.fillRect(0, 0, 256, 90);
      for (let x = 0; x < 128; x++) for (let y = 0; y < 45; y++) { const n = onda[x][y]; if (n) { o.fillStyle = `rgba(140,255,160,${Math.min(1, n / 6)})`; o.fillRect(x * 2, 88 - y * 2, 2, 2); } }
    };
    SC.raf = requestAnimationFrame(paso);
  }
  ED.scopes = scopes;

  // ================================================================== comandos
  if (ED.comando) [
    { id: "buscar", titulo: "Buscar en el contenido de los videos", grupo: "Organizar", icono: "folder-search", accion: () => ED.elegirBib("buscar"), claves: "donde aparece dice" },
    { id: "consolidar", titulo: "Consolidar proyecto (copiar medios)", grupo: "Organizar", icono: "folder-input", accion: consolidar, claves: "respaldo mover" },
    { id: "relinkear", titulo: "Relinkear medios perdidos", grupo: "Organizar", icono: "link", accion: relinkearTodo },
    { id: "papelera", titulo: "Papelera de medios", grupo: "Organizar", icono: "trash", accion: () => cargarMeta().then(() => verPapelera(null)) },
    { id: "historial", titulo: "Historial de cambios (deshacer visual)", grupo: "Edición", icono: "history", accion: () => ED.abrirDer("historial") },
    { id: "apariencia", titulo: "Apariencia y accesibilidad (tema claro, letra, atajos)", grupo: "Vista", icono: "palette", accion: apariencia, claves: "tema claro oscuro contraste letra premiere capcut" },
    { id: "tema", titulo: "Cambiar tema claro / oscuro", grupo: "Vista", icono: "sun-moon", accion: () => { AP.tema = document.documentElement.classList.contains("tema-claro") ? "oscuro" : "claro"; aplicarApariencia(); } },
    { id: "minimo", titulo: "Modo mínimo: solo chat, vista previa y exportar", grupo: "Vista", icono: "minimize-2", accion: () => minimo(!document.body.classList.contains("wded-minimo")), claves: "simple facil" },
    { id: "scopes", titulo: "Scopes: histograma y forma de onda", grupo: "Color", icono: "chart-column", accion: () => scopes(), cuando: () => !document.body.classList.contains("modo-simple") },
    { id: "personajes", titulo: "Abrir Personajes", grupo: "Paneles", icono: "users", accion: personajes },
    ...EXTERNOS.map((x) => ({ id: "panel_" + x.id, titulo: `Abrir: ${x.titulo}`, grupo: "Paneles", icono: x.icono, accion: () => abrirExterno(x) })),
    ...Object.entries(TUTORIALES).map(([id, t]) => ({ id: "tuto_" + id, titulo: `Tutorial: ${t.titulo}`, grupo: "Ayuda", icono: "graduation-cap", accion: () => tutorial(id) })),
  ].forEach(ED.comando);
  ED.extra = { montarBuscar, apariencia, minimo, tutorial, scopes, personajes, H, O, AP };
})();
