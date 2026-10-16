/* Web Studio — panel de Voces (TTS, voces del perfil, efectos, diseño y clonación con consentimiento).
 * Contrato (docs/voces.md §6):
 *   WDVS.voces.montar(contenedor, {pid})   monta el panel (pestañas Generar · Mis voces · Diseñar · Clonar · Motores)
 *   WDVS.voces.decir(texto, voz, op)       -> Promise<locución> (POST /api/voces/decir)
 *   WDVS.voces.alPlan(pid, idLocucion, en, {subtitulos})  agrega a la pista de voz del plan y avisa "wdvs:plan-cambiado"
 *   Arrastre: application/x-wdvs = {k:"medio", tipo:"audio", rol:"voz", ruta, nombre, dur, voz_tts:{id,url,texto,voz,palabras,visemas}}
 * Si existe WDVS.registrarPanel(def), se registra como {id:"voces", titulo:"Voces", icono:"mic", montar}. */
(function () {
  "use strict";
  const WDVS = (window.WDVS = window.WDVS || {});
  const api = async (url, op = {}) => {
    const fd = op.body instanceof FormData;
    const r = await fetch(url, { method: op.method || (op.body ? "POST" : "GET"), headers: op.body && !fd ? { "Content-Type": "application/json" } : {},
      body: op.body && !fd ? JSON.stringify(op.body) : op.body });
    const d = (r.headers.get("content-type") || "").includes("json") ? await r.json() : await r.text();
    if (!r.ok) throw new Error((d && d.detail) || d || r.statusText);
    return d;
  };
  const el = (tag, attrs = {}, ...hijos) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "value") e.value = v; else if (k === "checked") e.checked = !!v;
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
    }
    for (const h of hijos.flat()) if (h !== null && h !== undefined && h !== false) e.append(h.nodeType ? h : document.createTextNode(String(h)));
    return e;
  };
  const sel = (opciones, valor, attrs = {}) => el("select", attrs, opciones.map(([v, t]) => { const o = el("option", { value: v }, t); if (String(v) === String(valor)) o.selected = true; return o; }));
  const aviso = (cont, msg, tipo = "info") => { const a = el("div", { class: "mnvoz-aviso " + tipo }, msg); cont.prepend(a); setTimeout(() => a.remove(), tipo === "error" ? 9000 : 4000); };
  const EMOCIONES = ["neutral", "alegre", "emocionado", "triste", "enojado", "calmado", "misterioso"];
  const fmt = (t) => (Math.round(t * 100) / 100).toFixed(2);

  function css() {
    if (document.getElementById("mnvoz-css")) return;
    const s = el("style", { id: "mnvoz-css" });
    s.textContent = `.mnvoz{font:var(--fs-md,13px) var(--font,system-ui);color:var(--texto,#eee);display:flex;flex-direction:column;gap:10px;padding:6px}
.mnvoz input,.mnvoz textarea,.mnvoz select{background:var(--panel2,#222);color:var(--texto,#eee);border:1px solid var(--borde,#444);border-radius:6px;padding:4px 6px;font:inherit;box-sizing:border-box;max-width:100%}
.mnvoz textarea{width:100%;min-height:70px;resize:vertical}
.mnvoz button{background:var(--panel3,#333);color:var(--texto,#eee);border:1px solid var(--borde,#444);border-radius:6px;padding:4px 10px;cursor:pointer;font:inherit}
.mnvoz button.pri{background:var(--acento,#6c5ce7);border-color:transparent;color:#fff}
.mnvoz button:disabled{opacity:.5;cursor:default}
.mnvoz .tabs{display:flex;gap:4px;flex-wrap:wrap}.mnvoz .tabs button[aria-selected=true]{background:var(--acento,#6c5ce7);color:#fff}
.mnvoz .fila{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.mnvoz .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.mnvoz label{display:flex;flex-direction:column;gap:2px;font-size:var(--fs-sm,12px);color:var(--texto2,#bbb)}
.mnvoz label.chk{flex-direction:row;align-items:flex-start;gap:6px}
.mnvoz .chips{display:flex;gap:4px;flex-wrap:wrap}.mnvoz .chip{padding:2px 8px;border-radius:12px;font-size:12px}
.mnvoz .chip[aria-pressed=true]{background:var(--acento,#6c5ce7);color:#fff}
.mnvoz .tarjeta{background:var(--panel,#1a1a1a);border:1px solid var(--borde-suave,#333);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px}
.mnvoz .clip{cursor:grab;border:1px dashed var(--acento,#6c5ce7)}
.mnvoz .pals{display:flex;flex-wrap:wrap;gap:3px;font-size:12px}.mnvoz .pals span{padding:1px 4px;border-radius:4px;cursor:pointer;background:var(--panel2,#222)}
.mnvoz .pals span.on{background:var(--acento,#6c5ce7);color:#fff}
.mnvoz .nota{font-size:12px;color:var(--texto2,#aaa)}.mnvoz .ok{color:#5fd38d}.mnvoz .mal{color:#ff7a7a}
.mnvoz .mnvoz-aviso{padding:6px 8px;border-radius:6px;background:#2b3a55}.mnvoz .mnvoz-aviso.error{background:#5a2330}
.mnvoz progress{width:100%}.mnvoz audio{width:100%}
.mnvoz .lista{display:flex;flex-direction:column;gap:6px;max-height:340px;overflow:auto}`;
    document.head.append(s);
  }

  const decir = (texto, voz, op = {}) => api("/api/voces/decir", { body: { texto, voz, ...op } });
  async function alPlan(pid, id, en, op = {}) {
    const r = await api(`/api/voces/plan/${encodeURIComponent(pid)}/agregar`, { body: { id, en: en || 0, subtitulos: !!op.subtitulos, volumen: op.volumen || 1 } });
    window.dispatchEvent(new CustomEvent("wdvs:plan-cambiado", { detail: { pid, origen: "voces" } }));
    return r;
  }
  const pidActual = (o) => (o && o.pid) || (window.WDED && window.WDED.E && window.WDED.E.pid) || null;
  const tActual = () => (window.WDED && window.WDED.E && typeof window.WDED.E.t === "number" ? window.WDED.E.t : 0);

  async function montar(cont, opciones = {}) {
    css();
    cont.innerHTML = "";
    const raiz = el("div", { class: "mnvoz" });
    cont.append(raiz);
    const S = { voces: [], efectos: {}, cadenas: {}, tab: "generar", efSel: [] };
    const cuerpo = el("div");
    const tabs = el("div", { class: "tabs", role: "tablist" });
    const TABS = [["generar", "Generar"], ["voces", "Mis voces"], ["disenar", "Diseñar"], ["clonar", "Clonar"], ["motores", "Motores"]];
    const pintarTabs = () => { tabs.innerHTML = ""; TABS.forEach(([id, t]) => tabs.append(el("button", { role: "tab", "aria-selected": String(S.tab === id), onclick: () => { S.tab = id; pintarTabs(); pintar(); } }, t))); };
    raiz.append(tabs, cuerpo);
    const err = (e) => aviso(raiz, e.message || String(e), "error");
    async function cargar() {
      const [p, ef] = await Promise.all([api("/api/voces/perfil"), api("/api/voces/efectos")]);
      S.voces = p.voces; S.efectos = ef.efectos; S.cadenas = ef.cadenas_perfil;
    }
    const opcionesVoz = () => S.voces.map((v) => [v.id, `${v.nombre || v.id}${v.personaje ? " (" + v.personaje + ")" : ""} · ${v.motor}${v.origen === "clonada" ? " · clonada" : ""}`]);

    // ------------------------------------------------------------ Generar
    function locucionUI(r) {
      const audio = el("audio", { controls: true, src: r.url + "?v=" + r.id });
      const pals = el("div", { class: "pals" }, r.palabras.map((p) => el("span", { title: `${fmt(p.t0)}–${fmt(p.t1)} s`, onclick: () => { audio.currentTime = p.t0; audio.play(); } }, p.texto)));
      audio.addEventListener("timeupdate", () => { const t = audio.currentTime; [...pals.children].forEach((s, i) => s.classList.toggle("on", t >= r.palabras[i].t0 && t < r.palabras[i].t1)); });
      const clip = el("div", { class: "tarjeta clip", draggable: "true", title: "Arrástrala a la línea de tiempo" },
        el("b", {}, `Voz: ${r.voz.nombre || r.voz.id || r.voz.motor} · ${fmt(r.dur)} s`), el("span", { class: "nota" }, r.texto.slice(0, 90)));
      clip.addEventListener("dragstart", (e) => {
        const d = { k: "medio", tipo: "audio", rol: "voz", ruta: r.ruta, nombre: `Voz IA: ${r.texto.slice(0, 40)}`, dur: r.dur,
          voz_tts: { id: r.id, url: r.url, texto: r.texto, voz: r.voz, palabras: r.palabras, visemas: r.visemas, clonada: r.clonada } };
        e.dataTransfer.setData("application/x-wdvs", JSON.stringify(d));
        e.dataTransfer.setData("text/uri-list", location.origin + r.url);
        e.dataTransfer.effectAllowed = "copy";
      });
      const subs = el("input", { type: "checkbox", checked: true });
      const pid = pidActual(opciones);
      const bPlan = el("button", { class: "pri", disabled: !pid, title: pid ? "" : "Abre un proyecto en el editor",
        onclick: async () => { try { const x = await alPlan(pidActual(opciones), r.id, tActual(), { subtitulos: subs.checked }); aviso(raiz, `Agregada a la pista de voz en ${fmt(x.item.en)} s${x.overlays.length ? " con subtítulos" : ""}`); } catch (e) { err(e); } } },
        "Agregar a la pista de voz");
      const srt = el("button", { onclick: () => { const a = el("a", { href: URL.createObjectURL(new Blob([r.srt], { type: "text/plain" })), download: `voz_${r.id}.srt` }); a.click(); } }, "SRT");
      return el("div", { class: "tarjeta" }, audio, pals, clip,
        el("div", { class: "fila" }, bPlan, el("label", { class: "chk" }, subs, "subtítulos"), srt,
          el("span", { class: "nota" }, `tiempos: ${r.tiempos}${r.clonada ? " · voz clonada (con consentimiento)" : ""} · marca de procedencia`)));
    }
    function pintarGenerar() {
      const texto = el("textarea", { placeholder: "Escribe lo que dirá la voz…" }, S.texto || "");
      texto.addEventListener("input", () => (S.texto = texto.value));
      const voz = sel(opcionesVoz(), S.vozSel || "narrador_mn");
      voz.addEventListener("change", () => (S.vozSel = voz.value));
      const emo = sel([["", "(la de la voz)"], ...EMOCIONES.map((e) => [e, e])], "");
      const vel = el("input", { type: "range", min: "0.5", max: "2", step: "0.05", value: "1" });
      const tono = el("input", { type: "range", min: "-12", max: "12", step: "0.5", value: "0" });
      const lv = el("span", {}, "1.00×"), lt = el("span", {}, "0 st");
      vel.oninput = () => (lv.textContent = Number(vel.value).toFixed(2) + "×"); tono.oninput = () => (lt.textContent = tono.value + " st");
      const chips = el("div", { class: "chips" }, Object.entries(S.efectos).filter(([k]) => !["volumen", "velocidad"].includes(k)).map(([k, d]) => {
        const b = el("button", { class: "chip", "aria-pressed": String(S.efSel.includes(k)), title: d.desc }, d.nombre);
        b.onclick = () => { const i = S.efSel.indexOf(k); i >= 0 ? S.efSel.splice(i, 1) : S.efSel.push(k); b.setAttribute("aria-pressed", String(i < 0)); };
        return b;
      }));
      const cad = sel([["", "(sin cadena)"], ...Object.keys(S.cadenas).map((c) => [c, c + (S.cadenas[c].propia ? " ★" : "")])], "");
      const salida = el("div");
      const bGen = el("button", { class: "pri" }, "Generar");
      bGen.onclick = async () => {
        if (!texto.value.trim()) return aviso(raiz, "Escribe un texto", "error");
        bGen.disabled = true; bGen.textContent = "Generando… (la 1.ª vez carga el modelo)";
        try {
          const efs = [...(cad.value ? S.cadenas[cad.value].efectos : []), ...S.efSel.map((t) => ({ tipo: t }))];
          const op = { efectos: efs, emocion: emo.value || null, proyecto: pidActual(opciones) };
          if (Number(vel.value) !== 1) op.velocidad = Number(vel.value);
          if (Number(tono.value) !== 0) op.tono = Number(tono.value);
          const r = await decir(texto.value, voz.value, op);
          S.ultima = r; salida.innerHTML = ""; salida.append(locucionUI(r));
        } catch (e) { err(e); } finally { bGen.disabled = false; bGen.textContent = "Generar"; }
      };
      const bCad = el("button", { onclick: async () => {
        const n = prompt("Nombre de la cadena de efectos:"); if (!n) return;
        try { await api("/api/voces/efectos/cadenas", { body: { nombre: n, efectos: S.efSel.map((t) => ({ tipo: t })) } }); await cargar(); pintar(); } catch (e) { err(e); }
      } }, "Guardar efectos como cadena");
      if (S.ultima) salida.append(locucionUI(S.ultima));
      cuerpo.append(texto, el("div", { class: "grid" }, el("label", {}, "Voz", voz), el("label", {}, "Emoción / estilo", emo),
        el("label", {}, el("span", {}, "Velocidad ", lv), vel), el("label", {}, el("span", {}, "Tono ", lt), tono)),
        el("label", {}, "Efectos", chips), el("div", { class: "fila" }, el("label", {}, "Cadena guardada", cad), bCad), el("div", { class: "fila" }, bGen), salida);
    }

    // ------------------------------------------------------------ Mis voces
    function pintarVoces() {
      const lista = el("div", { class: "lista" });
      S.voces.forEach((v) => {
        const det = el("details", { class: "tarjeta" }, el("summary", {}, el("b", {}, v.nombre || v.id), ` · ${v.motor}${v.personaje ? " · personaje " + v.personaje : ""} · ${v.origen}`));
        const f = { nombre: el("input", { value: v.nombre || "" }), voz: el("input", { value: typeof v.voz === "object" ? JSON.stringify(v.voz) : v.voz || "", disabled: v.origen === "clonada" }),
          motor: sel([["kokoro", "Kokoro"], ["piper", "Piper es-MX"], ["chatterbox", "Chatterbox"], ["elevenlabs", "ElevenLabs"]], v.motor, { disabled: v.origen === "clonada" }),
          velocidad: el("input", { type: "number", step: "0.05", value: v.velocidad }), tono: el("input", { type: "number", step: "0.5", value: v.tono }),
          emocion: sel(EMOCIONES.map((e) => [e, e]), v.emocion), personaje: el("input", { value: v.personaje || "", placeholder: "M, N…" }),
          efectos: el("textarea", {}, JSON.stringify(v.efectos || [])), descripcion: el("input", { value: v.descripcion || "" }) };
        const guardar = async () => {
          try {
            let vz = f.voz.value.trim(); if (vz.startsWith("{")) vz = JSON.parse(vz);
            await api(`/api/voces/perfil/${v.id}`, { method: "PUT", body: { voz: { ...v, nombre: f.nombre.value, motor: f.motor.value, voz: vz, velocidad: Number(f.velocidad.value), tono: Number(f.tono.value),
              emocion: f.emocion.value, personaje: f.personaje.value || null, efectos: JSON.parse(f.efectos.value || "[]"), descripcion: f.descripcion.value } } });
            await cargar(); aviso(raiz, "Voz guardada"); pintar();
          } catch (e) { err(e); }
        };
        const probar = async () => { try { const r = await decir(`Hola, soy ${f.nombre.value}.`, v.id); new Audio(r.url).play(); } catch (e) { err(e); } };
        det.append(el("div", { class: "grid" }, ...Object.entries(f).map(([k, i]) => el("label", {}, k, i))),
          el("div", { class: "fila" }, el("button", { class: "pri", onclick: guardar }, "Guardar"), el("button", { onclick: probar }, "Probar"),
            v.predefinida ? el("button", { onclick: async () => { await api(`/api/voces/perfil/${v.id}/restaurar`, { method: "POST" }); await cargar(); pintar(); } }, "Restaurar") : null,
            el("button", { onclick: async () => { if (!confirm(`¿Borrar la voz ${v.nombre}?`)) return; await api(`/api/voces/perfil/${v.id}`, { method: "DELETE" }); await cargar(); pintar(); } }, "Borrar")),
          v.consentimiento ? el("span", { class: "nota" }, `Consentimiento ${v.consentimiento}`) : null);
        lista.append(det);
      });
      cuerpo.append(el("p", { class: "nota" }, "Voces guardadas en tu perfil. El campo «personaje» enlaza la voz con la ficha del personaje (M, N…)."), lista);
    }

    // ------------------------------------------------------------ Diseñar
    async function pintarDisenar() {
      const op = await api("/api/voces/disenar/opciones");
      const NOM = { nino: "niño", rapido: "rápido" };
      const campos = Object.fromEntries(Object.entries(op).map(([k, vs]) => [k, sel([["", "—"], ...vs.map((v) => [v, NOM[v] || v])], "")]));
      const libre = el("input", { placeholder: "o descríbela: «voz grave y lenta de señor mayor»" });
      const nombre = el("input", { placeholder: "Nombre de la voz" });
      const salida = el("div");
      const desc = () => libre.value.trim() || Object.fromEntries(Object.entries(campos).filter(([, s]) => s.value).map(([k, s]) => [k, s.value]));
      const probar = async (guardar) => {
        try {
          const r = await api("/api/voces/disenar", { body: { descripcion: desc(), nombre: nombre.value || null, semilla: String(S.semilla || ""), guardar, probar: "Hola, esta es mi nueva voz para los videos de Grupo WD." } });
          salida.innerHTML = ""; salida.append(el("div", { class: "nota" }, `${r.voz.nombre} · mezcla ${JSON.stringify(r.voz.voz.mezcla)} · tono ${r.voz.tono} · vel ${r.voz.velocidad}`));
          if (r.prueba) { salida.append(el("audio", { controls: true, src: r.prueba.url })); salida.querySelector("audio").play(); }
          if (guardar) { await cargar(); aviso(raiz, "Voz diseñada guardada en Mis voces"); }
        } catch (e) { err(e); }
      };
      cuerpo.append(el("p", { class: "nota" }, "Crea una voz nueva mezclando voces del modelo Kokoro (no imita a ninguna persona real)."),
        el("div", { class: "grid" }, ...Object.entries(campos).map(([k, s]) => el("label", {}, k, s))), libre, nombre,
        el("div", { class: "fila" }, el("button", { onclick: () => probar(false) }, "Escuchar"), el("button", { onclick: () => { S.semilla = (S.semilla || 0) + 1; probar(false); } }, "Otra variante"),
          el("button", { class: "pri", onclick: () => probar(true) }, "Guardar en Mis voces")), salida);
      const eleven = await api("/api/voces/elevenlabs");
      if (eleven.activo) {
        const d = el("input", { placeholder: "Descripción en inglés o español para ElevenLabs Voice Design" });
        cuerpo.append(el("div", { class: "tarjeta" }, el("b", {}, "ElevenLabs Voice Design (de pago)"), d, el("button", { onclick: async () => {
          try { const r = await api("/api/voces/disenar/elevenlabs", { body: { descripcion: d.value } }); salida.innerHTML = ""; r.previews.forEach((p) => salida.append(el("audio", { controls: true, src: "data:audio/mpeg;base64," + p.audio_base64 }), el("span", { class: "nota" }, p.generated_voice_id))); } catch (e) { err(e); }
        } }, "Generar previews")));
      }
    }

    // ------------------------------------------------------------ Clonar (con consentimiento)
    async function pintarClonar() {
      const c = await api("/api/voces/consentimientos");
      const ahora = new Date(); const hoy = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const f = { nombre: el("input", { name: "nombre", placeholder: "Nombre completo de la persona" }), fecha: el("input", { name: "fecha", type: "date", value: hoy }),
        alcance: el("input", { name: "alcance", placeholder: "Para qué y dónde se usará su voz" }), registrado_por: el("input", { name: "registrado_por", placeholder: "Quién registra" }),
        relacion: sel([["empleado", "Empleado(a)"], ["equipo", "Equipo del proyecto"], ["propia", "Es mi propia voz"]], "empleado", { name: "relacion" }),
        proyectos: el("input", { name: "proyectos", value: "todos", placeholder: "todos o ids separados por coma" }), vence: el("input", { name: "vence", type: "date" }) };
      const usos = c.usos.map((u) => el("label", { class: "chk" }, el("input", { type: "checkbox", value: u, checked: ["clonar", "narracion"].includes(u), disabled: u === "clonar" }), u));
      const decl = Object.entries(c.declaraciones).map(([k, t]) => el("label", { class: "chk" }, el("input", { type: "checkbox", name: k }), t));
      const arch = { muestra: el("input", { type: "file", accept: "audio/*" }), autorizacion: el("input", { type: "file", accept: ".pdf,image/*" }), frase_grabada: el("input", { type: "file", accept: "audio/*" }) };
      const frase = el("div", { class: "nota" });
      const actFrase = () => (frase.textContent = "Frase que la persona debe grabar: «" + c.frase.replace("{nombre}", f.nombre.value || "…").replace("{alcance}", f.alcance.value || "…") + "»");
      f.nombre.oninput = actFrase; f.alcance.oninput = actFrase; actFrase();
      const registrar = async () => {
        const fd = new FormData();
        Object.entries(f).forEach(([k, i]) => fd.append(k, i.value));
        fd.append("usos", usos.map((l) => l.querySelector("input")).filter((i) => i.checked).map((i) => i.value).join(","));
        decl.forEach((l) => { const i = l.querySelector("input"); fd.append(i.name, i.checked ? "true" : "false"); });
        Object.entries(arch).forEach(([k, i]) => i.files[0] && fd.append(k, i.files[0]));
        try { const r = await api("/api/voces/consentimientos", { body: fd }); aviso(raiz, `Consentimiento ${r.id} registrado (verificación: ${r.verificacion})`); pintar(); } catch (e) { err(e); }
      };
      const vigentes = c.consentimientos.filter((x) => x.vigente);
      const cSel = sel(vigentes.map((x) => [x.id, `${x.nombre} · ${x.fecha} · ${x.alcance.slice(0, 40)}`]), "");
      const nVoz = el("input", { placeholder: "Nombre de la voz clonada" });
      const mot = sel([["chatterbox", "Chatterbox (local)"], ["elevenlabs", "ElevenLabs (de pago)"]], "chatterbox");
      const clonar = async () => { try { const v = await api("/api/voces/clonar", { body: { consentimiento: cSel.value, nombre: nVoz.value || "Voz clonada", motor: mot.value } }); await cargar(); aviso(raiz, `Voz ${v.nombre} creada`); } catch (e) { err(e); } };
      const lista = el("div", { class: "lista" }, c.consentimientos.map((x) => el("div", { class: "tarjeta" },
        el("div", {}, el("b", {}, x.nombre), ` · ${x.fecha} · ${x.alcance}`), el("span", { class: x.vigente ? "ok" : "mal" }, x.vigente ? "vigente" : x.motivo),
        el("span", { class: "nota" }, `usos: ${x.usos.join(", ")} · proyectos: ${[].concat(x.proyectos).join(", ")} · verificación: ${x.verificacion} · registró: ${x.registrado_por}`),
        x.vigente ? el("button", { onclick: async () => { const m = prompt("Motivo de la revocación:"); if (m === null) return; await api(`/api/voces/consentimientos/${x.id}/revocar`, { body: { motivo: m } }); pintar(); } }, "Revocar") : null)));
      const audit = await api("/api/voces/auditoria?limite=30");
      cuerpo.append(el("div", { class: "mnvoz-aviso" }, "Clonar una voz real exige el consentimiento registrado de esa persona (del equipo o la empresa). Prohibido: figuras públicas, personas ajenas, contenido sexual, difamatorio o engañoso. Todo audio lleva marca de procedencia y queda en la auditoría."),
        el("details", { class: "tarjeta" }, el("summary", {}, el("b", {}, "1. Registrar consentimiento")),
          el("div", { class: "grid" }, ...Object.entries(f).map(([k, i]) => el("label", {}, k.replace("_", " "), i))),
          el("div", { class: "chips" }, usos), ...decl, frase,
          el("div", { class: "grid" }, el("label", {}, "Muestra de voz (10 s – 5 min) *", arch.muestra), el("label", {}, "Autorización firmada (opcional)", arch.autorizacion), el("label", {}, "Grabación de la frase (opcional)", arch.frase_grabada)),
          el("button", { class: "pri", onclick: registrar }, "Registrar consentimiento")),
        el("div", { class: "tarjeta" }, el("b", {}, "2. Clonar"), vigentes.length ? el("div", { class: "fila" }, cSel, nVoz, mot, el("button", { class: "pri", onclick: clonar }, "Crear voz")) : el("span", { class: "nota" }, "Sin consentimientos vigentes: la clonación no se activa.")),
        el("b", {}, "Consentimientos"), lista,
        el("details", {}, el("summary", {}, "Auditoría"), el("div", { class: "lista nota" }, audit.map((a) => el("div", {}, `${a.ts} · ${a.usuario} · ${a.accion} ${a.persona || a.voz || ""} ${a.motivo || ""}`)))));
    }

    // ------------------------------------------------------------ Motores
    async function pintarMotores() {
      const m = await api("/api/voces/motores");
      const e = await api("/api/voces/elevenlabs");
      const mods = el("div", { class: "lista" });
      const pintarMods = (md) => { mods.innerHTML = ""; Object.entries(md).forEach(([id, x]) => {
        const p = el("progress", { max: x.total, value: x.bytes });
        mods.append(el("div", { class: "tarjeta" }, el("div", {}, el("b", {}, x.nombre), ` · ${(x.total / 1e6).toFixed(0)} MB`), el("span", { class: "nota" }, x.licencia),
          x.instalado ? el("span", { class: "ok" }, "instalado") : el("div", { class: "fila" }, p, el("button", { onclick: () => descargar(id) }, x.estado === "descargando" ? "Descargando…" : "Descargar"), x.error ? el("span", { class: "mal" }, x.error) : null)));
      }); };
      async function descargar(id) {
        await api(`/api/voces/modelos/${id}/descargar`, { method: "POST" });
        const t = setInterval(async () => { const md = await api("/api/voces/modelos"); pintarMods(md); if (!Object.values(md).some((x) => x.estado === "descargando")) { clearInterval(t); } }, 1000);
      }
      pintarMods(m.modelos);
      const clave = el("input", { type: "password", placeholder: e.tiene_clave ? `clave guardada (${e.clave_de})` : "xi-api-key" });
      const act = el("input", { type: "checkbox", checked: e.activo });
      cuerpo.append(el("div", { class: "lista" }, m.motores.map((x) => el("div", { class: "tarjeta" }, el("div", {}, el("b", {}, x.nombre), " ", el("span", { class: x.disponible ? "ok" : "mal" }, x.disponible ? "disponible" : "no disponible")),
        el("span", { class: "nota" }, `${x.licencia}${x.motivo ? " · " + x.motivo : ""}`),
        el("span", { class: "nota" }, Object.entries(x.capacidades).filter(([, v]) => v).map(([k]) => k).join(" · "))))),
        el("b", {}, "Modelos locales"), mods,
        el("div", { class: "tarjeta" }, el("b", {}, "ElevenLabs (opcional, de pago)"), el("span", { class: "nota" }, "Desactivado mientras no haya clave y no lo actives. Cada generación gasta créditos de tu cuenta."),
          el("div", { class: "fila" }, clave, el("label", { class: "chk" }, act, "activar"), el("button", { onclick: async () => {
            try { await api("/api/voces/elevenlabs", { body: { activo: act.checked, ...(clave.value ? { clave: clave.value } : {}) } }); aviso(raiz, "Guardado"); pintar(); } catch (er) { err(er); } } }, "Guardar"))));
    }

    async function pintar() {
      cuerpo.innerHTML = "";
      try {
        if (S.tab === "generar") pintarGenerar();
        else if (S.tab === "voces") pintarVoces();
        else if (S.tab === "disenar") await pintarDisenar();
        else if (S.tab === "clonar") await pintarClonar();
        else await pintarMotores();
      } catch (e) { err(e); }
    }
    pintarTabs();
    try { await cargar(); } catch (e) { err(e); }
    await pintar();
    return { recargar: async () => { await cargar(); await pintar(); } };
  }

  WDVS.voces = { montar, decir, alPlan, api };
  if (typeof WDVS.registrarPanel === "function") WDVS.registrarPanel({ id: "voces", titulo: "Voces", icono: "mic", montar });
})();
