"use strict";
// Web Studio — IA dentro del editor (bloque B) y texto (bloque C), 5-oct-2026. docs/editor.md §9.
// - Clic derecho → «Pídele a la IA…» sobre un clip, texto o rango: manda a la conversación del chat el pedido con el
//   contexto de la selección (tiempos, tipo, texto) — WDVS.montarChat(...).enviar(texto).
// - Sugerencias proactivas discretas (foco con contador en la barra de la línea de tiempo), con «Arreglar» de un clic.
// - Revisión de director: ritmo, claridad, legibilidad y audio con arreglos de un clic.
// - Versiones A/B (secuencias nuevas), textos para publicar (título, descripción, hashtags y capítulos).
// - Traducción de los textos a otro idioma (en una secuencia nueva), revisión ortográfica y plantillas de títulos.
(() => {
  const ED = window.WDED; if (!ED) return;
  const { E, $, $$, el, esc, pedir, hacer, toast, r3, ico, pidURL, lsGet, lsSet } = ED;
  const V = () => E.vista;
  const ic = (n, t = 14) => el("span", { class: "i", "aria-hidden": "true", html: ico(n, t) });
  const WD = () => window.WDVS || {};
  const fmtS = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  const cerrar = () => { const m = $("#wd-modal"); if (m) m.remove(); };

  // ================================================================== B1: pídele a la IA
  function contexto(d) {
    const v = V(); if (!v) return "";
    const partes = [];
    if (E.rango) partes.push(`el tramo de ${fmtS(E.rango[0])} a ${fmtS(E.rango[1])}`);
    const items = E.multi.length ? E.multi : (d ? [d] : []);
    for (const s of items.slice(0, 6)) {
      if (s.tipo === "toma") { const t = v.grupos[s.g] && v.grupos[s.g].tomas[s.k]; if (t) partes.push(`el clip de video ${t.fuente || "negro"} (grupo ${s.g + 1}, toma ${s.k + 1}) de ${fmtS(t.t0)} a ${fmtS(t.t0 + t.dur)}${t.efectos.length ? `, con efectos ${t.efectos.join(", ")}` : ""}`); }
      else if (s.tipo === "overlays") { const o = v.overlays[s.i]; if (o) partes.push(`${o.tipo === "escena" ? "la animación" : "el texto"} «${o.etiqueta}» (overlays[${s.i}], ${fmtS(o.t_in)}-${fmtS(o.t_out)})`); }
      else if (s.tipo === "musica") partes.push(`el tramo de música ${s.i + 1}`);
      else if (s.tipo === "sfx") partes.push(`el sonido sfx[${s.i}]`);
      else if (s.tipo === "efectos") partes.push(`el efecto global efectos[${s.i}]`);
      else if (s.tipo === "clips") partes.push(`el clip libre clips[${s.i}]`);
    }
    if (!partes.length) partes.push(`el momento ${fmtS(E.t)} del video`);
    return partes.join("; ");
  }
  async function enviarAlChat(texto) {
    ED.abrirDer ? ED.abrirDer("ia") : ($('#der-tabs button[data-d="ia"]') || {}).click && $('#der-tabs button[data-d="ia"]').click();
    ED.montarIA && ED.montarIA();
    const c = $("#der-ia");
    for (let i = 0; i < 20 && !(c && c._chat && c._chat.enviar); i++) await new Promise((r) => setTimeout(r, 100));
    if (c && c._chat && c._chat.enviar) return c._chat.enviar(texto);
    const r = await pedir(`${pidURL()}/chat`, { method: "POST", json: { texto } });
    if (!r.ok) toast(r.d.detail || "No pude hablar con la IA");
  }
  ED.pedirIA = enviarAlChat;
  function pideleIA(d, x, y) {
    ED.cerrarMenus && ED.cerrarMenus();
    const ctx = contexto(d);
    const ta = el("textarea", { rows: 2, placeholder: "¿Qué le hago? p. ej. «hazlo más dinámico»", "aria-label": "Pedido para la IA" });
    const enviar = () => { const t = ta.value.trim(); if (!t) return ta.focus(); pop.remove(); enviarAlChat(`Sobre ${ctx}: ${t}`); };
    const chips = ["Hazlo más dinámico", "Ponle subtítulos", "Agrégale un efecto que combine", "Hazlo más corto", "Mejora el texto"]
      .map((c) => el("button", { class: "chip", onclick: () => { ta.value = c; enviar(); } }, c));
    const pop = el("div", { class: "wd-pop pide-ia", role: "dialog", "aria-label": "Pídele a la IA", style: { left: Math.min(x, innerWidth - 300) + "px", top: Math.min(y, innerHeight - 230) + "px", width: "290px" } },
      el("b", { html: `${ico("sparkles", 14)} Pídele a la IA` }), el("div", { class: "tenue", style: { fontSize: "var(--fs-xs)" } }, `Sobre ${ctx}`), ta,
      el("div", { class: "chips" }, ...chips), el("div", { class: "botones" }, el("span", { class: "espacio" }), el("button", { class: "bt chico", onclick: () => pop.remove() }, "Cancelar"), el("button", { class: "bt chico acento", onclick: enviar }, "Enviar")));
    document.body.append(pop);
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } if (e.key === "Escape") pop.remove(); e.stopPropagation(); });
    setTimeout(() => document.addEventListener("pointerdown", function f(ev) { if (!ev.target.closest(".pide-ia")) { pop.remove(); document.removeEventListener("pointerdown", f); } }), 0);
    ta.focus();
  }
  let ultimoMenu = { x: 200, y: 200 };
  document.addEventListener("contextmenu", (e) => { ultimoMenu = { x: e.clientX, y: e.clientY }; }, true);
  ED.ganchosMenu.push((items, d) => { items.unshift(["✦ Pídele a la IA…", () => pideleIA(d, ultimoMenu.x, ultimoMenu.y)], "-"); });

  // ================================================================== B2: sugerencias proactivas
  const S = { lista: [], ign: new Set(lsGet("wded_sug_ign", [])), t: null };
  function botonSug() {
    let b = $("#ed-sug");
    if (!b) {
      const est = $("#ed-estado"); if (!est) return null;
      b = el("button", { class: "ib sug-btn", id: "ed-sug", title: "Sugerencias de la IA", "aria-label": "Sugerencias de la IA", onclick: () => panelSug(b) });
      est.before(b);
    }
    return b;
  }
  async function revisarSug() {
    if (!E.plan || !E.abierto) return;
    const r = await pedir(`${pidURL()}/editor/sugerencias`); if (!r.ok) return;
    S.lista = (r.d.sugerencias || []).filter((s) => !S.ign.has(`${E.pid}:${s.id}`));
    const b = botonSug(); if (!b) return;
    b.innerHTML = ico("lightbulb", 15) + (S.lista.length ? `<span class="badge">${S.lista.length}</span>` : "");
    b.classList.toggle("hay", S.lista.length > 0);
    b.title = S.lista.length ? `${S.lista.length} sugerencia(s) para mejorar tu video` : "Sin sugerencias por ahora";
  }
  function panelSug(b) {
    const r = b.getBoundingClientRect();
    const old = $("#pop-sug"); if (old) return old.remove();
    const pop = el("div", { class: "wd-pop sug-pop", id: "pop-sug", role: "dialog", "aria-label": "Sugerencias", style: { left: Math.max(8, r.left - 140) + "px", bottom: innerHeight - r.top + 6 + "px", width: "330px" } });
    const pintar = () => {
      pop.innerHTML = "";
      pop.append(el("div", { class: "botones" }, el("b", {}, "Sugerencias"), el("span", { class: "espacio" }), el("button", { class: "bt chico", onclick: () => { pop.remove(); revisionDirector(); } }, ic("clapperboard", 13), "Revisión de director")));
      if (!S.lista.length) pop.append(el("div", { class: "nota" }, "Todo se ve bien. Te aviso si encuentro algo."));
      for (const s of S.lista.slice(0, 12)) {
        pop.append(el("div", { class: "sug " + s.gravedad },
          el("div", { class: "sug-tit" }, el("b", {}, s.titulo), el("button", { class: "enlace", onclick: () => { ED.ponerT(s.t, { seguir: true }); } }, fmtS(s.t))),
          el("div", { class: "tenue" }, s.detalle),
          el("div", { class: "botones" }, s.arreglo ? el("button", { class: "bt chico acento", onclick: async () => { if (await hacer(s.arreglo)) { S.lista = S.lista.filter((x) => x !== s); pintar(); revisarSug(); } } }, "Arreglar") : null,
            el("button", { class: "bt chico", onclick: () => { S.ign.add(`${E.pid}:${s.id}`); lsSet("wded_sug_ign", [...S.ign].slice(-300)); S.lista = S.lista.filter((x) => x !== s); pintar(); revisarSug(); } }, "Ignorar"))));
      }
    };
    pintar(); document.body.append(pop);
    setTimeout(() => document.addEventListener("pointerdown", function f(ev) { if (!ev.target.closest("#pop-sug, #ed-sug")) { pop.remove(); document.removeEventListener("pointerdown", f); } }), 0);
  }
  const revisarLuego = () => { clearTimeout(S.t); S.t = setTimeout(revisarSug, 2500); };
  window.addEventListener("wded:editado", revisarLuego);
  window.addEventListener("wdvs:plan-cambiado", revisarLuego);
  let pidVisto = null;
  setInterval(() => { if (E.abierto && E.plan && E.pid !== pidVisto) { pidVisto = E.pid; revisarSug(); } }, 1500);

  // ================================================================== B3: revisión de director
  const NOMBRES = { ritmo: "Ritmo", claridad: "Claridad del mensaje", legibilidad: "Legibilidad", audio: "Audio" };
  async function revisionDirector() {
    const r = await pedir(`${pidURL()}/editor/revision`); if (!r.ok) return toast(r.d.detail || "No se pudo revisar");
    const d = r.d;
    const color = (n) => (n >= 8 ? "ok" : n >= 6 ? "warn" : "err");
    const filas = Object.entries(d.notas).map(([k, n]) => el("div", { class: "dir-fila" },
      el("div", { class: "dir-nota " + color(n.nota), role: "img", "aria-label": `${NOMBRES[k]}: ${n.nota} de 10` }, String(n.nota)),
      el("div", {}, el("b", {}, NOMBRES[k] || k), ...n.comentarios.map((c) => el("div", { class: "tenue" }, c)),
        el("div", { class: "botones" }, ...d.arreglos.filter((a) => a.nota === k).map((a) => el("button", { class: "bt chico acento", onclick: async (ev) => { ev.currentTarget.disabled = true; if (await hacer(a.op)) { cerrar(); revisionDirector(); } } }, ic("wand-sparkles", 12), a.titulo))))));
    ED.modal("Revisión de director",
      el("div", { class: "dir-total" }, el("div", { class: "dir-nota grande " + color(d.puntaje) }, String(d.puntaje)), el("div", {}, el("b", {}, d.puntaje >= 8 ? "¡Va muy bien!" : d.puntaje >= 6 ? "Bien, con detalles por pulir" : "Necesita ajustes"), el("div", { class: "tenue" }, "Calificación de 0 a 10. Cada arreglo es de un clic y se deshace con Ctrl+Z."))),
      ...filas,
      el("div", { class: "botones" }, el("button", { class: "bt", onclick: () => { cerrar(); enviarAlChat("Haz una revisión de director de mi video (ritmo, claridad, legibilidad y audio) y aplica las mejoras más importantes."); } }, ic("sparkles", 13), "Pedirle a la IA una revisión más profunda"))).classList.add("ancha");
  }

  // ================================================================== B4: versiones A/B
  function versionesAB() {
    const vars = [["rapida", "Más rápida", "Clips más cortos y acelerados."], ["tranquila", "Más tranquila", "Sin destellos ni sacudidas, transiciones suaves."], ["corta", "Versión corta", "≈ 30 s para redes."]];
    ED.modal("Versiones A/B", el("div", { class: "nota" }, "Creo una copia del video como pestaña nueva de la línea de tiempo (arriba). La original no cambia; compara cambiando de pestaña."),
      el("div", { class: "ab-lista" }, ...vars.map(([id, t, d]) => el("button", { class: "ab-op", onclick: async () => { cerrar(); if (await hacer({ op: "version_ab", variante: id })) toast(`Lista la «Versión B · ${t.toLowerCase()}»: está en las pestañas de secuencias, arriba de la línea de tiempo.`, "info", 5000); } }, el("b", {}, t), el("span", { class: "tenue" }, d))),
        el("button", { class: "ab-op", onclick: () => { cerrar(); enviarAlChat("Crea una versión B de mi video con otro enfoque (distinto gancho al inicio y otro ritmo) en una secuencia nueva, sin tocar la original."); } }, el("b", {}, "Que la IA proponga otra"), el("span", { class: "tenue" }, "Otro gancho y otro ritmo, en el chat."))));
  }

  // ================================================================== B5: textos para publicar
  async function publicar(ia = false) {
    const caja = el("div", { class: "pub" }, el("div", { class: "nota" }, ia ? "La IA está escribiendo…" : "Preparando…"));
    if (!$("#wd-modal .pub")) ED.modal("Textos para publicar", caja).classList.add("ancha");
    else $("#wd-modal .pub").replaceWith(caja);
    const r = await pedir(`${pidURL()}/editor/publicacion`, { method: "POST", json: { ia } });
    if (!r.ok) { caja.innerHTML = ""; caja.append(el("div", { class: "nota" }, r.d.detail || "No se pudo")); return; }
    const d = r.d; caja.innerHTML = "";
    const campo = (et, val, filas = 1) => {
      const t = filas > 1 ? el("textarea", { rows: filas }) : el("input", { type: "text" }); t.value = val;
      return el("label", { class: "pub-campo" }, el("span", {}, et), t, el("button", { class: "bt chico", onclick: () => { navigator.clipboard && navigator.clipboard.writeText(t.value); toast("Copiado", "info", 1200); } }, ic("copy", 12), "Copiar"));
    };
    caja.append(d.aviso ? el("div", { class: "nota" }, d.aviso) : null,
      campo("Título", d.titulo), campo("Descripción", d.descripcion, 6), campo("Hashtags", (d.hashtags || []).join(" ")),
      d.capitulos && d.capitulos.length ? el("div", { class: "tenue" }, `${d.capitulos.length} capítulos incluidos en la descripción (YouTube).`) : el("div", { class: "tenue" }, "Capítulos: el video necesita al menos 3 secciones de 10 s con nombre."),
      el("div", { class: "botones" }, el("button", { class: "bt acento", onclick: () => publicar(true) }, ic("sparkles", 13), d.fuente === "ia" ? "Otra propuesta de la IA" : "Mejorar con la IA")));
  }

  // ================================================================== C2/C4: traducción y ortografía
  async function traducir() {
    const sel = el("select", { "aria-label": "Idioma" }, ...["inglés", "portugués", "francés", "alemán", "italiano"].map((x) => el("option", { value: x }, x)));
    const nota = el("div", { class: "nota" }, "Creo una secuencia nueva con todos los textos traducidos; la original se queda igual.");
    const btn = el("button", { class: "bt acento", onclick: async () => {
      btn.disabled = true; nota.textContent = "La IA está traduciendo…";
      const r = await pedir(`${pidURL()}/editor/traducir`, { method: "POST", json: { idioma: sel.value } });
      btn.disabled = false;
      if (!r.ok) { nota.textContent = r.d.detail || "No se pudo traducir"; return; }
      const ts = r.d.textos || []; if (!ts.length) { nota.textContent = "No hay textos para traducir."; return; }
      const ops = [{ op: "secuencia_nueva", duplicar: true, activar: true, nombre: `Versión en ${sel.value}` }, ...ts.map((t) => ({ op: "lista_props", lista: "overlays", i: t.i, props: { texto: t.texto } }))];
      cerrar();
      if (await hacer({ op: "lote", ops, desc: `versión en ${sel.value}` })) toast(`Lista la versión en ${sel.value} (${ts.length} textos).`, "info", 3500);
    } }, ic("languages", 14), "Traducir");
    ED.modal("Traducir el video", el("label", { class: "fila-ctl" }, "Idioma: ", sel), nota, el("div", { class: "botones" }, btn));
  }
  async function ortografia(conIA = false) {
    let caja = $("#wd-modal .orto-caja");
    if (!caja) { caja = el("div", { class: "orto-caja" }); ED.modal("Revisión ortográfica", caja).classList.add("ancha"); }
    caja.innerHTML = ""; caja.append(el("div", { class: "nota" }, conIA ? "La IA está revisando los textos…" : "Revisando los textos…"));
    const r = await pedir(`${pidURL()}/editor/ortografia?ia=${conIA ? 1 : 0}`, { method: "POST" });
    caja.innerHTML = "";
    if (!r.ok) return caja.append(el("div", { class: "nota" }, r.d.detail || "No se pudo revisar"));
    const cs = r.d.cambios || [];
    if (r.d.aviso) caja.append(el("div", { class: "nota" }, `La IA no respondió (${r.d.aviso}); solo revisé lo básico.`));
    const masIA = conIA ? null : el("button", { class: "bt", onclick: () => ortografia(true) }, ic("sparkles", 13), "Revisar también con la IA");
    if (!cs.length) return caja.append(el("div", { class: "nota" }, "No encontré errores en los textos en pantalla."), el("div", { class: "botones" }, masIA));
    const cks = cs.map(() => el("input", { type: "checkbox", checked: true }));
    caja.append(...cs.map((c, k) => el("label", { class: "orto" }, cks[k], el("span", { class: "antes" }, c.antes), el("span", { "aria-hidden": "true" }, "→"), el("b", {}, c.texto))),
      el("div", { class: "botones" }, el("button", { class: "bt acento", onclick: async () => {
        const ops = cs.filter((_c, k) => cks[k].checked).map((c) => ({ op: "lista_props", lista: "overlays", i: c.i, props: { texto: c.texto } }));
        if (!ops.length) return cerrar();
        cerrar(); if (await hacer({ op: "lote", ops, desc: `corregir ortografía (${ops.length})` })) toast(`${ops.length} texto(s) corregidos.`, "info", 2500);
      } }, "Aplicar las correcciones"), masIA));
  }

  // ================================================================== C3: plantillas de títulos animados
  const PLANT = [
    { nombre: "Tercio inferior animado", desc: "Nombre y cargo que entran deslizando", items: (t) => [{ texto: "Nombre Apellido", t_in: t, t_out: t + 4, anim: "slide", pos: "tercio_inferior", estilo: "barra" }] },
    { nombre: "Contador", desc: "Número que sube (ventas, seguidores…)", items: (t) => [{ texto: "1000", t_in: t, t_out: t + 3, anim: "contador", pos: "centro" }] },
    { nombre: "Top 5", desc: "Lista que aparece punto por punto", items: (t) => [5, 4, 3, 2, 1].map((n, k) => ({ texto: `#${n}  Punto ${n}`, t_in: r3(t + k * 1.6), t_out: r3(t + k * 1.6 + 1.5), anim: "punch", pos: "centro" })) },
    { nombre: "Máquina de escribir", desc: "Letra por letra", items: (t) => [{ texto: "Escribe tu mensaje", t_in: t, t_out: t + 3, anim: "maquina", pos: "centro" }] },
    { nombre: "Título con subrayado", desc: "Golpe y línea que se dibuja", items: (t) => [{ texto: "TÍTULO", t_in: t, t_out: t + 2.5, anim: "subrayado", pos: "centro" }] },
    { nombre: "Llamada a la acción final", desc: "«Síguenos» hasta el final", items: (t) => [{ texto: "¡Síguenos para más!", t_in: t, t_out: "fin", anim: "slide", pos: "abajo" }] },
  ];
  async function plantilla(p) {
    const t = r3(E.t), ops = p.items(t).map((it) => ({ op: "lista_nuevo", lista: "overlays", item: it }));
    await hacer(ops.length === 1 ? { ...ops[0], desc: `título: ${p.nombre}` } : { op: "lote", ops, desc: `título: ${p.nombre}` });
  }
  if (WD().registrarCategoria) WD().registrarCategoria("textos", { id: "titulos_animados", titulo: "Títulos animados", montar: (cont) => {
    cont.append(el("div", { class: "plant-lista" }, ...PLANT.map((p) => el("button", { class: "plant", title: p.desc, onclick: () => plantilla(p) }, el("b", {}, p.nombre), el("span", { class: "tenue" }, p.desc)))),
      el("div", { class: "botones", style: { marginTop: "8px" } }, el("button", { class: "bt chico", onclick: () => ED.subtitular && ED.subtitular("reels") }, ic("captions", 12), "Subtítulos reels"), el("button", { class: "bt chico", onclick: traducir }, ic("languages", 12), "Traducir"), el("button", { class: "bt chico", onclick: () => ortografia(false) }, ic("spell-check", 12), "Ortografía")));
  } });

  // ================================================================== comandos
  if (ED.comando) [
    { id: "pide_ia", titulo: "Pídele a la IA sobre la selección…", grupo: "IA", icono: "sparkles", accion: () => pideleIA(E.sel, innerWidth / 2 - 150, innerHeight / 3) },
    { id: "sugerencias", titulo: "Ver sugerencias", grupo: "IA", icono: "lightbulb", accion: () => { const b = botonSug(); if (b) panelSug(b); } },
    { id: "director", titulo: "Revisión de director", grupo: "IA", icono: "clapperboard", accion: revisionDirector, claves: "calificar ritmo claridad" },
    { id: "ab", titulo: "Crear versión A/B", grupo: "IA", icono: "git-compare", accion: versionesAB },
    { id: "publicar", titulo: "Título, descripción, hashtags y capítulos", grupo: "Publicar", icono: "megaphone", accion: () => publicar(false) },
    { id: "traducir", titulo: "Traducir los textos a otro idioma", grupo: "Texto", icono: "languages", accion: traducir, claves: "ingles english idioma" },
    { id: "ortografia", titulo: "Revisión ortográfica de los textos", grupo: "Texto", icono: "spell-check", accion: () => ortografia(false) },
    ...PLANT.map((p, k) => ({ id: "plant_" + k, titulo: `Título animado: ${p.nombre}`, grupo: "Texto", icono: "type", accion: () => plantilla(p) })),
  ].forEach(ED.comando);
  ED.ia = { pideleIA, contexto, enviarAlChat, revisarSug, panelSug, revisionDirector, versionesAB, publicar, traducir, ortografia, plantilla, S };
})();
