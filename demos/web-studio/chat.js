"use strict";
// Web Studio — chat con la IA (componente reutilizable).
//   const c = WDVS.montarChat(proyectoId, contenedor, { bienvenida, opciones, grande, alTerminar(tarea, ok) });
//   c.adjuntar(files) · c.enviar(texto) · c.enfocar() · c.desmontar()
// La conversación vive en el servidor (<proyecto>/chat.json + UNA sesión de Claude Code por proyecto); aquí solo
// se pinta. El modal «Nuevo video con IA» y la pestaña «Asistente IA» del editor muestran el MISMO historial; los
// eventos de la app (ediciones a mano, archivos, renders) salen discretos (rol "evento"). Usa WDVS.api, WDVS.toast,
// WDVS.progresoTarea y WDVS.subirVarios de app.js.
(() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ESPECIALES = new Set(["Deshacer", "Render final", "Descargar", "Me gusta", "Intentar de nuevo", "Reintentar sin IA",
    "Ver en Reglas", "Quitar la regla"]);
  const ic = (n, t = 16) => (window.WDVS && WDVS.icono ? WDVS.icono(n, t) : "");
  const ICO_CLIP = ic("paperclip", 17), ICO_ENVIAR = ic("send-horizontal", 16);
  // íconos de los eventos (el servidor manda un carácter; aquí se traduce al set Lucide)
  const ICO_EV = { "✎": "type", "📎": "paperclip", "✓": "check", "⇪": "share", "↶": "undo-2", "!": "circle-alert", "•": "info" };

  // nombre humano del rol de un medio (el servidor manda rol_texto; si no, se traduce la clave interna)
  const ROLES = { video: "video", musica: "música", logo: "logo", imagen: "imagen", marca_agua: "marca de agua", fondo: "fondo",
    personaje: "personaje", voz: "voz", sfx: "efecto de sonido" };
  const rolTexto = (m) => (m.rol_texto || ROLES[m.rol] || String(m.rol || "archivo").replace(/_/g, " ")).toLowerCase();
  window.WDVS = window.WDVS || {};
  WDVS.montarChat = (pid, cont, op = {}) => {
    const url = `/api/proyectos/${encodeURIComponent(pid)}`;
    cont.innerHTML = `<div class="chat ${op.grande ? "grande" : ""}">
      <div class="chat-barra"><span class="chat-titulo">${ic("sparkles", 14)} Asistente IA <span class="chat-prov muy-tenue" hidden></span></span><button type="button" class="btn fantasma chico chat-nueva" title="Empieza otra conversación con la IA; el proyecto, sus archivos y el video se quedan">${ic("rotate-ccw", 13)} Nueva conversación</button></div>
      <div class="chat-msgs" role="log" aria-live="polite" aria-label="Conversación con la IA"></div>
      <div class="chat-compositor">
        <div class="chat-chips" aria-label="Sugerencias"></div>
        <form class="chat-pie">
          <textarea rows="1" placeholder="Pídele a la IA… por ejemplo «textos más grandes»" aria-label="Mensaje para la IA"></textarea>
          <div class="chat-pie-barra">
            <button type="button" class="icono-btn chat-adj" title="Agregar videos, música o logo (no se copian)">${ICO_CLIP}</button>
            <span class="muy-tenue chat-hint"><kbd>Enter</kbd> envía · <kbd>Shift+Enter</kbd> nueva línea</span>
            <button class="btn primario chico chat-enviar" title="Enviar (Enter)" aria-label="Enviar">${ICO_ENVIAR}</button>
          </div>
          <input type="file" multiple hidden accept="video/*,audio/*,image/png,.mkv,.mov">
        </form>
      </div>
      <div class="chat-soltar" hidden>${ic("upload", 28)}<b>Suelta aquí tus archivos</b></div></div>`;
    const $c = (s) => cont.querySelector(s);
    const msgs = $c(".chat-msgs"), chips = $c(".chat-chips"), ta = $c("textarea"), fin = $c("input[type=file]");
    let estado = { mensajes: [] }, vivo = true, sondeo = null, esperando = false, ultimoUsuario = "", nMsgs = -1, sondeoTrabajos = null;
    const extras = [];   // burbujas locales (subidas, respuestas sin servidor)

    function burbuja(m, idx) {
      if (m.rol === "sistema") return `<div class="msg sistema">${esc(m.texto)}</div>`;
      if (m.rol === "evento") return m.oculto ? "" : `<div class="msg evento" title="${m.enviado ? "La IA ya lo sabe" : "La IA lo sabrá en tu próximo mensaje"}">${ic(ICO_EV[m.icono] || "info", 13)}<span>${esc(m.texto)}</span></div>`;
      if (m.rol === "usuario") return `<div class="msg yo"><div class="texto">${esc(m.texto)}</div></div>`;
      // acciones en línea tras un cambio de la IA: ver la vista previa y deshacer
      let acciones = m.evento === "listo" && ["ajustar", "generar"].includes(m.tarea)
        ? `<div class="msg-acciones"><button type="button" class="btn chico" data-accion="ver">${ic("play", 13)} Ver el resultado</button>${m.tarea === "ajustar" ? `<button type="button" class="btn chico fantasma" data-accion="deshacer">${ic("undo-2", 13)} Deshacer</button>` : ""}</div>` : "";
      // tarea que falló DESPUÉS de la IA (el motor guardó su trabajo): retomar sin volver a llamarla
      if (m.recuperable) acciones = `<div class="msg-acciones"><button type="button" class="btn chico" data-accion="reintentar-sin-ia" title="Usa el plan que ya hizo la IA; no gasta tokens">${ic("rotate-cw", 13)} Reintentar sin IA</button></div>`;
      // regla automática: abrir el panel Reglas del editor en esa regla
      if (m.regla) acciones = `<div class="msg-acciones"><button type="button" class="btn chico" data-accion="reglas" data-regla="${esc(m.regla)}">${ic("list-checks", 13)} Ver en Reglas</button></div>`;
      return `<div class="msg ia ${m.evento === "error" ? "error" : ""} ${m.recuperable ? "recuperable" : ""}"><span class="avatar" aria-hidden="true">${ic(m.evento === "error" ? "circle-alert" : "sparkles", 13)}</span><div class="cuerpo"><div class="texto">${esc(m.texto)}</div>${acciones}</div></div>`;
    }
    function pintar(progreso) {
      const ms = estado.mensajes || [];
      let html = !ms.length && op.bienvenida ? burbuja({ rol: "ia", texto: op.bienvenida }) : "";
      html += ms.map((m, i) => burbuja(m, i)).join("") + extras.map((x) => x.html).join("");
      if (!(estado.medios || []).length && !esperando) html += `<div class="chat-vacio">${ic("upload", 26)}<b>Arrastra aquí tus videos, música o logo</b>
        <span class="tenue">o <button type="button" class="enlace chat-explorar">elígelos de tu PC</button> (no se copian: se usan donde están)</span></div>`;
      if (esperando) html += `<div class="msg ia escribiendo"><span class="avatar" aria-hidden="true">${ic("sparkles", 13)}</span><div class="cuerpo"><div class="texto" aria-label="La IA está escribiendo"><i></i><i></i><i></i></div></div></div>`;
      for (const tr of (estado.trabajando || [])) html += `<div class="msg progreso trabajo"><div class="p-txt"><span class="giro"></span><span>${esc(tr)}…</span></div><div class="muy-tenue pequeno">Puedes seguir platicando; te aviso aquí.</div></div>`;
      if (progreso) html += `<div class="msg progreso"><div class="p-txt"><span class="giro"></span><span>${esc(progreso.texto)}…</span><span class="num">${Math.round(progreso.frac * 100)}%</span>
        <span class="tenue">${WDVS.fmtEta ? WDVS.fmtEta(progreso.eta) : ""}</span><button type="button" class="btn fantasma chico chat-cancelar">Cancelar</button></div><div class="barra"><div style="width:${progreso.frac * 100}%"></div></div>
        <div class="muy-tenue pequeno">Puedes seguir editando; te aviso al terminar.</div></div>`;
      msgs.innerHTML = html;
      const b = msgs.querySelector(".chat-cancelar"); if (b) b.onclick = cancelar;
      const ex = msgs.querySelector(".chat-explorar"); if (ex) ex.onclick = explorarPC;
      msgs.querySelectorAll("[data-accion]").forEach((x) => x.onclick = () => {
        if (x.dataset.accion === "deshacer") return evento("deshacer");
        if (x.dataset.accion === "reintentar-sin-ia") return evento("reintentar_sin_ia");
        if (x.dataset.accion === "reglas") return abrirReglas(x.dataset.regla);
        window.dispatchEvent(new CustomEvent("wdvs:ver-resultado", { detail: { pid } }));
        if (!(window.WDED && window.WDED.E && window.WDED.E.pid === pid)) WDVS.toast && WDVS.toast("Abre el proyecto en el editor para verlo.", "info");
      });
      msgs.scrollTop = msgs.scrollHeight;
      const ultimo = ms.filter((m) => m.rol !== "evento").pop();
      const ops = esperando || progreso ? [] : (ultimo && ultimo.rol === "ia" ? ultimo.opciones || [] : !ms.length ? op.opciones || [] : []);
      chips.innerHTML = ops.map((o) => `<button class="chip-op" type="button">${esc(o)}</button>`).join("");
      chips.querySelectorAll(".chip-op").forEach((b) => b.onclick = () => chip(b.textContent));
    }
    async function cargar() {
      try { estado = await WDVS.api(`${url}/chat`); } catch (e) { return; }
      if (!vivo) return;
      const nuevos = estado.mensajes.slice(Math.max(0, nMsgs));
      if (nMsgs >= 0) for (const m of nuevos) if (m.evento && m.tarea) terminado(m.tarea, m.evento === "listo");
      nMsgs = estado.mensajes.length;
      const pv = $c(".chat-prov");   // con otro cerebro (ChatGPT u OpenAI) se ve discreto junto al título
      if (pv) { pv.hidden = !estado.proveedor || estado.proveedor === "claude"; pv.textContent = estado.proveedor_nombre ? "· " + estado.proveedor_nombre : ""; }
      pintar();
      if (estado.ocupado || estado.pendiente) vigilar();
      clearTimeout(sondeoTrabajos);   // trabajos del chat en segundo plano (regla que revisa videos, efecto nuevo)
      if ((estado.trabajando || []).length) sondeoTrabajos = setTimeout(() => vivo && cargar(), 2000);
    }
    function terminado(tarea, ok) {
      if (ok && ["generar", "ajustar", "preview"].includes(tarea)) planCambiado(tarea);
      op.alTerminar && op.alTerminar(tarea, ok);
    }
    // Avisa al editor (y a quien escuche) que el plan cambió: generar, ajustar, deshacer y la vista previa posterior.
    let ultimoAviso = { tarea: "", t: 0 };   // un solo aviso por tarea aunque dos sondeos vean el mismo mensaje
    function planCambiado(tarea) {
      const ahora = Date.now();
      if (ultimoAviso.tarea === tarea && ahora - ultimoAviso.t < 3000) return;
      ultimoAviso = { tarea, t: ahora };
      window.dispatchEvent(new CustomEvent("wdvs:plan-cambiado", { detail: { pid, tarea } }));
    }
    function vigilar() {
      if (sondeo) return;
      const f = async () => {
        if (!vivo) return;
        let e; try { e = await WDVS.api(`${url}/estado`); } catch { return; }
        if (e.corriendo) { pintar(WDVS.progresoTarea(e)); return; }
        clearInterval(sondeo); sondeo = null;
        await cargar();
      };
      sondeo = setInterval(f, 1200); f();
    }
    async function enviar(texto) {
      texto = (texto || "").trim();
      if (!texto || esperando) return;
      ultimoUsuario = texto;
      estado.mensajes = [...(estado.mensajes || []), { rol: "usuario", texto }]; nMsgs = estado.mensajes.length + 1;
      esperando = true; pintar(); ta.value = ""; ajustarAlto();
      const idT = "chat:" + pid;
      WDVS.tareas && WDVS.tareas.poner(idT, { titulo: "La IA está respondiendo", tipo: "chat", texto: texto.slice(0, 80), frac: null });
      try {
        const r = await WDVS.api(`${url}/chat`, { method: "POST", json: { texto } });
        esperando = false;
        WDVS.tareas && WDVS.tareas.terminar(idT, true, { texto: "Respondió en el chat.", silenciosa: true });
        await cargar();
        if (r.tarea) { WDVS.vigilar && WDVS.proyectoActual && WDVS.proyectoActual() === pid && WDVS.vigilar(); vigilar(); }
      } catch (e) {
        esperando = false;
        WDVS.tareas && WDVS.tareas.terminar(idT, false, { texto: "No pude hablar con la IA.", silenciosa: true });
        const s = WDVS.sugerir ? WDVS.sugerir(e.message, e.datos || {}) : {};
        estado.mensajes.push({ rol: "ia", evento: "error", texto: (s.titulo ? s.titulo + ". " : "") + e.message.split("\nDetalle")[0], opciones: ["Intentar de nuevo"] });
        pintar();
        if (s.accion) WDVS.toast(s.titulo || "No pude hablar con la IA", "error", { accion: s.accion });
      }
    }
    async function evento(tipo, texto = "") {
      try {
        const r = await WDVS.api(`${url}/chat/evento`, { method: "POST", json: { tipo, texto } });
        if (tipo === "deshacer") planCambiado("deshacer");
        await cargar(); if (r.tarea) vigilar();
      }
      catch (e) { WDVS.errorToast(e); }
    }
    function chip(t) {
      if (!ESPECIALES.has(t)) return enviar(t);
      if (t === "Deshacer") return evento("deshacer");
      if (t === "Render final") return evento("final");
      if (t === "Intentar de nuevo") { estado.mensajes.pop(); return enviar(ultimoUsuario || (estado.mensajes.filter((m) => m.rol === "usuario").pop() || {}).texto); }
      if (t === "Descargar") { const a = document.createElement("a"); a.href = `${url}/video/final`; a.download = `${pid}.mp4`; return a.click(); }
      if (t === "Me gusta") return evento("me_gusta");   // el estilo aprende que esta versión le gustó
      if (t === "Reintentar sin IA") return evento("reintentar_sin_ia");
      const ultimaRegla = (estado.mensajes.filter((m) => m.regla).pop() || {}).regla;
      if (t === "Ver en Reglas") return abrirReglas(ultimaRegla);
      if (t === "Quitar la regla" && ultimaRegla) return evento("quitar_regla", ultimaRegla);
    }
    // Panel «Reglas» del editor (contrato en docs/reglas.md): WDVS.abrirReglas(pid, regla) si existe; si no, el evento.
    function abrirReglas(regla) {
      window.dispatchEvent(new CustomEvent("wdvs:abrir-reglas", { detail: { pid, regla } }));
      if (WDVS.abrirReglas) return WDVS.abrirReglas(pid, regla);
      if (!(window.WDED && window.WDED.E && window.WDED.E.pid === pid)) WDVS.toast && WDVS.toast("Abre el proyecto en el editor para ver sus reglas.", "info");
    }
    async function cancelar() { if (WDVS.cancelarTarea && WDVS.proyectoActual() === pid) return WDVS.cancelarTarea();
      try { await WDVS.api(`${url}/cancelar`, { method: "POST" }); } catch (e) { WDVS.errorToast(e); } }
    async function adjuntar(files) {
      files = [...files]; if (!files.length) return;
      const x = { html: "" }; extras.push(x);
      const pint = (fr, nom) => { x.html = `<div class="msg progreso"><div class="p-txt">Subiendo ${esc(nom || "archivos")}… ${Math.round(fr * 100)}%</div><div class="barra"><div style="width:${fr * 100}%"></div></div></div>`; pintar(); };
      pint(0, files[0].name);
      const ok = await WDVS.subirVarios(pid, files, pint);
      extras.splice(extras.indexOf(x), 1);
      if (!ok.length) return pintar();
      await evento("adjunto", "Agregaste: " + ok.map((m) => `${m.nombre} (${rolTexto(m)})`).join(", "));
      WDVS.refrescar && WDVS.proyectoActual && WDVS.proyectoActual() === pid && WDVS.refrescar();
    }
    // Ventana de Windows (sin copiar: se usa el archivo donde está); si no se puede abrir, el selector del navegador.
    async function explorarPC() {
      const nuevos = WDVS.elegirMedios ? await WDVS.elegirMedios(pid) : [];
      if (!nuevos.length) return;
      await evento("adjunto", "Agregaste: " + nuevos.map((m) => `${m.nombre} (${rolTexto(m)})`).join(", "));
      WDVS.refrescar && WDVS.proyectoActual && WDVS.proyectoActual() === pid && WDVS.refrescar();
      WDVS.refrescarMediosNuevo && WDVS.refrescarMediosNuevo();
    }
    async function nuevaConversacion() {
      const ok = WDVS.confirmar ? await WDVS.confirmar({ titulo: "¿Empezar una conversación nueva?", cuerpo: "La IA olvidará lo platicado (queda guardado en el proyecto). Tus archivos y el video no cambian.", si: "Empezar de nuevo" })
        : confirm("¿Empezar una conversación nueva? La IA olvidará lo platicado; tus archivos y el video no cambian.");
      if (!ok) return;
      try { await WDVS.api(`${url}/chat/evento`, { method: "POST", json: { tipo: "reiniciar" } }); nMsgs = 0; await cargar(); }
      catch (e) { WDVS.errorToast(e); }
    }
    function ajustarAlto() { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; }

    $c(".chat-pie").onsubmit = (e) => { e.preventDefault(); enviar(ta.value); };
    ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(ta.value); } };
    ta.oninput = ajustarAlto;
    $c(".chat-adj").onclick = () => WDVS.elegirMedios ? explorarPC() : fin.click();
    $c(".chat-nueva").onclick = nuevaConversacion;
    fin.onchange = () => { adjuntar(fin.files); fin.value = ""; };
    const zona = $c(".chat");
    zona.addEventListener("dragover", (e) => { e.preventDefault(); $c(".chat-soltar").hidden = false; });
    zona.addEventListener("dragleave", (e) => { if (!zona.contains(e.relatedTarget)) $c(".chat-soltar").hidden = true; });
    zona.addEventListener("drop", (e) => { e.preventDefault(); e.stopPropagation(); $c(".chat-soltar").hidden = true;
      const s = document.getElementById("soltar"); if (s) s.hidden = true; adjuntar(e.dataTransfer.files); });
    cargar();
    return {
      pid, adjuntar, enviar, recargar: cargar,
      enfocar: () => ta.focus(),
      desmontar: () => { vivo = false; clearInterval(sondeo); clearTimeout(sondeoTrabajos); cont.innerHTML = ""; },
    };
  };
})();
