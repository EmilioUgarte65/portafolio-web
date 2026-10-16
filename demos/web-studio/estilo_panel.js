/* Web Studio — Ajustes › Mi estilo (perfil de estilo del usuario). Contrato en docs/estilo.md.
 *   WDVS.estilo.montar(contenedor)       ver lo aprendido, editar preferencias, pausar, borrar, exportar/importar
 *   WDVS.estilo.registrar(evento, datos) atajo para que el editor registre eventos (POST /api/estilo/registrar)
 * Si existe WDVS.registrarPanel(def), se registra como {id:"mi_estilo", titulo:"Mi estilo", montar}. */
(function () {
  "use strict";
  const WDVS = (window.WDVS = window.WDVS || {});
  const api = async (url, op = {}) => {
    const r = await fetch(url, { ...op, headers: op.body && !(op.body instanceof FormData) ? { "Content-Type": "application/json" } : {},
      body: op.body && !(op.body instanceof FormData) ? JSON.stringify(op.body) : op.body });
    const d = (r.headers.get("content-type") || "").includes("json") ? await r.json() : await r.text();
    if (!r.ok) throw new Error((d && d.detail) || d);
    return d;
  };
  const el = (tag, attrs = {}, ...hijos) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
    }
    for (const h of hijos.flat()) if (h !== null && h !== undefined) e.append(h.nodeType ? h : document.createTextNode(String(h)));
    return e;
  };
  const ETIQ = { tipografia: "Tipografía", color_texto: "Color de texto", color_acento: "Color de acento", tamano_texto: "Tamaño de texto (px a 1920)",
    posicion_texto: "Posición de texto", anim_texto: "Animación de texto", transicion: "Transición favorita", dur_transicion: "Duración de transición (s)",
    dur_toma: "Duración de toma (s)", efectos: "Efectos favoritos (coma)", evitar: "Nunca usar (coma)", lut: "Look / LUT", formato: "Formato",
    duracion: "Duración del video (s)", musica: "Música", cierre: "Frase de cierre", logo: "Logo", notas: "Notas para la IA" };
  const CONT = { tipografias: "Tipografías", colores: "Colores", posiciones: "Posiciones de texto", anims_texto: "Animaciones de texto",
    transiciones: "Transiciones", transiciones_evitadas: "Transiciones que deshaces", efectos: "Efectos", efectos_evitados: "Efectos que deshaces",
    looks: "Looks", luts: "LUTs", musica: "Música", cierres: "Cierres", logos: "Logos", formatos: "Formatos", frases: "Lo que pides seguido",
    plugins: "Plugins usados", plugins_creados: "Plugins creados" };
  function css() {
    if (document.getElementById("mnest-css")) return;
    const s = el("style", { id: "mnest-css" });
    s.textContent = `.mnest{font:var(--fs-md,13px) var(--font,system-ui);color:var(--texto,#eee);display:flex;flex-direction:column;gap:12px}
.mnest input,.mnest textarea{background:var(--panel2,#222);color:var(--texto,#eee);border:1px solid var(--borde,#444);border-radius:6px;padding:4px 6px;font:inherit;width:100%;box-sizing:border-box}
.mnest button{background:var(--panel3,#333);color:var(--texto,#eee);border:1px solid var(--borde,#444);border-radius:6px;padding:4px 10px;cursor:pointer;font:inherit}
.mnest .barra{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.mnest .ia{background:var(--panel,#1a1a1a);border:1px solid var(--borde-suave,#333);border-radius:8px;padding:10px;white-space:pre-wrap;font-size:var(--fs-sm,12px)}
.mnest .campos{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.mnest .campos label{font-size:var(--fs-xs,11px);color:var(--tenue,#aaa);display:flex;flex-direction:column;gap:2px}
.mnest .chips span{display:inline-flex;gap:4px;align-items:center;background:var(--panel2,#222);border-radius:10px;padding:2px 8px;margin:2px;font-size:var(--fs-xs,11px)}
.mnest .chips b{cursor:pointer;color:var(--tenue,#999)} .mnest .s{color:var(--tenue,#999);font-size:var(--fs-xs,11px)}`;
    document.head.append(s);
  }
  async function montar(cont) {
    css();
    const raiz = el("div", { class: "mnest" });
    cont.innerHTML = ""; cont.append(raiz);
    const pintar = (v) => {
      raiz.innerHTML = "";
      const pausa = el("input", { type: "checkbox", style: "width:auto" }); pausa.checked = !v.aprendizaje;
      pausa.onchange = async () => pintar(await api("/api/estilo/pausar", { method: "POST", body: { pausado: pausa.checked } }));
      raiz.append(el("div", { class: "barra" }, el("b", {}, "Mi estilo"), el("span", { class: "s" }, `${v.resumen.n_planes} planes · ${v.resumen.n_eventos} eventos · ${v.ruta}`)),
        el("div", { class: "barra" }, el("label", { class: "barra" }, pausa, "Pausar el aprendizaje"),
          el("a", { href: "/api/estilo/exportar" }, el("button", {}, "Exportar")),
          el("button", { onclick: importar }, "Importar"),
          el("button", { onclick: async () => { if (confirm("¿Borrar todo lo aprendido de tu estilo?")) pintar(await api("/api/estilo/borrar", { method: "POST" })); } }, "Borrar todo")),
        el("div", {}, el("b", {}, "Lo que la IA recibe"), el("div", { class: "ia" }, v.para_ia || "Todavía no hay datos: se llena solo al aceptar planes y editar.")));
      const campos = el("div", { class: "campos" });
      const inputs = {};
      for (const k of v.editables) {
        const val = v.manual[k];
        const i = k === "notas" ? el("textarea", { rows: 2 }) : el("input", { placeholder: fmt(sugerido(v.resumen, k)) });
        i.value = Array.isArray(val) ? val.join(", ") : val ?? "";
        inputs[k] = i;
        campos.append(el("label", {}, ETIQ[k] || k, i));
      }
      raiz.append(el("div", {}, el("b", {}, "Preferencias fijadas a mano (mandan sobre lo aprendido; vacío = aprender solo)")), campos,
        el("div", { class: "barra" }, el("button", { onclick: async () => {
          const cambios = {};
          for (const [k, i] of Object.entries(inputs)) {
            let x = i.value.trim();
            if (k === "efectos" || k === "evitar") x = x ? x.split(",").map((s) => s.trim()).filter(Boolean) : [];
            else if (["tamano_texto", "dur_transicion", "dur_toma", "duracion"].includes(k)) x = x === "" ? "" : +x;
            cambios[k] = x;
          }
          pintar(await api("/api/estilo/manual", { method: "POST", body: { cambios } })); WDVS.toast && WDVS.toast("Estilo guardado");
        } }, "Guardar preferencias")));
      const aprend = el("div", {}, el("b", {}, "Lo aprendido (quita lo que no quieras)"));
      for (const [k, t] of Object.entries(CONT)) {
        const items = Object.entries(v.contadores[k] || {}).sort((a, b) => b[1] - a[1]).slice(0, 12);
        if (!items.length) continue;
        aprend.append(el("div", { class: "chips" }, el("span", { class: "s", style: "background:none" }, t + ":"),
          items.map(([n, c]) => el("span", {}, `${n} ×${Math.round(c * 10) / 10}`, el("b", { title: "Olvidar", onclick: async () =>
            pintar(await api("/api/estilo/olvidar", { method: "POST", body: { contador: k, clave: n } })) }, "✕")))));
      }
      raiz.append(aprend);
    };
    const fmt = (x) => (Array.isArray(x) ? x.join(", ") : x == null ? "" : String(x));
    const sugerido = (r, k) => ({ transicion: (r.transiciones || [])[0], lut: (r.looks || [])[0], anim_texto: (r.anims_texto || [])[0],
      color_texto: (r.colores || [])[0], efectos: r.efectos, evitar: r.efectos_evitados })[k] ?? r[k];
    const importar = () => {
      const f = el("input", { type: "file", accept: ".json" });
      f.onchange = async () => { const fd = new FormData(); fd.append("archivo", f.files[0]);
        const mezclar = confirm("¿Mezclar con tu estilo actual? (Cancelar = reemplazar)");
        pintar(await api(`/api/estilo/importar?mezclar=${mezclar}`, { method: "POST", body: fd })); };
      f.click();
    };
    pintar(await api("/api/estilo"));
  }
  const registrar = (evento, datos) => api("/api/estilo/registrar", { method: "POST", body: { evento, datos: datos || {} } }).catch(() => {});
  WDVS.estilo = { montar, registrar };
  if (typeof WDVS.registrarPanel === "function") WDVS.registrarPanel({ id: "mi_estilo", titulo: "Mi estilo", icono: "palette", montar });
})();
