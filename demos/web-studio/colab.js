"use strict";
// Web Studio — colaboración y revisión (docs/colaboracion.md): enlace de revisión en la red local con comentarios
// por tiempo, versiones lado a lado, aprobaciones, historial de quién cambió qué y .wsproj. Usa window.WDVS.
//   WDVS.colab.abrir(pid, "revision" | "comparar" | "aprobacion" | "historial" | "mnproj")
//   WDVS.colab.importar()
(() => {
  const WD = window.WDVS;
  const q = (s, el = document) => el.querySelector(s);
  const qq = (s, el = document) => [...el.querySelectorAll(s)];
  const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ic = (n, t = 16) => (WD.icono ? WD.icono(n, t) : "");
  const api = (...a) => WD.api(...a);
  const enc = encodeURIComponent;
  const tc = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${Math.floor((s % 1) * 10)}`;
  const hora = (iso) => iso ? new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const ESTADO = { aprobado: ["Aprobado · listo para publicar", "ok"], cambios: ["Cambios pedidos", "aviso"], pendiente: ["Sin aprobar", ""] };
  let pid = null, datos = null, pestana = "revision";

  function dlg() {
    let d = q("#dlg-colab");
    if (d) return d;
    d = document.createElement("dialog"); d.id = "dlg-colab"; d.className = "dlg-grande dlg-colab"; d.setAttribute("aria-label", "Revisión y versiones");
    d.innerHTML = `<div class="dlg-cab"><div class="dlg-cab-tit"><span class="t-ico">${ic("users", 18)}</span><div><h2>Revisión y versiones</h2><div class="tenue pequeno" id="co-sub"></div></div></div>
        <button class="icono-btn" data-cerrar aria-label="Cerrar">${ic("x")}</button></div>
      <nav class="co-tabs" role="tablist">${[["revision", "message-square-text", "Revisión"], ["comparar", "columns-2", "Comparar versiones"], ["aprobacion", "badge-check", "Aprobación"], ["historial", "history", "Quién cambió qué"], ["mnproj", "package", "Exportar / importar"]]
        .map(([k, i, t]) => `<button role="tab" data-tab="${k}">${ic(i, 15)}<span>${t}</span></button>`).join("")}</nav>
      <div class="co-cuerpo" id="co-cuerpo"></div>`;
    document.body.appendChild(d);
    q("[data-cerrar]", d).onclick = () => d.close();
    d.addEventListener("close", () => qq("video", d).forEach((v) => v.pause()));
    qq("[data-tab]", d).forEach((b) => b.onclick = () => ir(b.dataset.tab));
    return d;
  }

  async function abrir(p, tab = "revision") {
    pid = p; pestana = { comparar: "comparar", historial: "historial", mnproj: "mnproj", aprobacion: "aprobacion" }[tab] || "revision";
    const d = dlg();
    await cargar();
    if (!d.open) d.showModal();
    ir(pestana);
  }
  async function cargar() {
    try { datos = await api(`/api/proyectos/${enc(pid)}/revision`); } catch (err) { WD.errorToast(err); datos = null; }
    const a = datos?.aprobacion || {};
    q("#co-sub").innerHTML = `Estado: <span class="insignia-apr ${ESTADO[a.estado || "pendiente"][1]}">${ESTADO[a.estado || "pendiente"][0]}</span>`;
  }
  function ir(tab) {
    pestana = tab;
    qq("#dlg-colab [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    qq("#dlg-colab video").forEach((v) => v.pause());
    ({ revision: pintarRevision, comparar: pintarComparar, aprobacion: pintarAprobacion, historial: pintarHistorial, mnproj: pintarMnproj })[tab]();
  }
  const urlVer = (vid) => `/api/proyectos/${enc(pid)}/versiones_video/${enc(vid)}`;

  // ------------------------------------------------------------------ Revisión: servidor LAN, enlaces y comentarios
  function pintarRevision() {
    const c = q("#co-cuerpo"), s = datos.servidor, enl = datos.enlaces.filter((x) => x.vigente);
    const vers = datos.versiones;
    const verSel = enl[0]?.version || (vers.find((v) => !v.vivo) || vers[0] || {}).id;
    c.innerHTML = `<div class="co-dos"><div class="co-izq">
        <div class="co-servidor ${s.activo ? "on" : ""}"><div class="fila entre"><b>${ic("wifi", 15)} Revisión en la red local</b>
          <label class="interruptor"><input type="checkbox" id="co-lan" ${s.activo ? "checked" : ""}> <span>${s.activo ? "Encendida" : "Apagada"}</span></label></div>
          ${s.activo ? `<div class="pequeno">Abierta en <code>${e(s.base)}</code> desde ${hora(s.desde)} · apágala cuando terminen de revisar.</div>`
            : `<div class="pequeno tenue">Para que otras personas de tu red (misma Wi-Fi u oficina) vean el video y comenten sin instalar nada. Se enciende a mano.</div>`}</div>
        <div class="fila entre"><h4>Enlaces</h4><span class="fila sin-margen"><select id="co-ver" aria-label="Versión a revisar"><option value="">Nueva versión con el render actual</option>${vers.filter((v) => !v.vivo).map((v) => `<option value="${e(v.id)}">${e(v.nombre)} · ${hora(v.ts)}</option>`).join("")}</select>
          <button class="btn chico primario" id="co-nuevo">${ic("link", 13)} Crear enlace</button></span></div>
        <div class="co-enlaces">${enl.map((x) => `<div class="co-enlace"><div><b>${e(x.version)}</b> <span class="tenue pequeno">${hora(x.creado)} · ${x.n_comentarios} comentario(s)${x.pendientes ? `, ${x.pendientes} pendiente(s)` : ""}</span>
            <div class="pequeno">${x.url ? `<code class="co-url">${e(x.url)}</code>` : '<span class="tenue">Enciende la revisión en la red local para tener el enlace.</span>'}</div></div>
            <span class="fila sin-margen">${x.url ? `<button class="btn chico" data-copiar="${e(x.url)}">${ic("copy", 13)} Copiar</button>` : ""}
            <button class="btn chico" data-ver="${e(x.version)}" data-tok="${e(x.token)}">${ic("play", 13)} Ver</button>
            <button class="icono-btn" data-desactivar="${e(x.token)}" title="Desactivar enlace" aria-label="Desactivar enlace">${ic("link-2-off", 14)}</button></span></div>`).join("") || '<p class="tenue pequeno">Todavía no hay enlaces de revisión.</p>'}</div>
      </div><div class="co-der">
        <div class="co-visor"><video id="co-video" controls preload="metadata" ${verSel ? `src="${urlVer(verSel)}"` : ""}></video>
          <div class="co-marcas" id="co-marcas"></div></div>
        ${enl.length ? `<form class="co-comentar" id="co-comentar"><input id="co-texto" maxlength="1000" placeholder="Comentario en el tiempo actual…" aria-label="Comentario"><button class="btn chico primario">${ic("message-square-plus", 13)} Comentar</button></form>` : ""}
        <h4>Comentarios</h4><div class="co-coms" id="co-coms"></div></div></div>`;
    WD.hidratarIconos && WD.hidratarIconos(c);
    const v = q("#co-video", c); v.dataset.tok = enl[0]?.token || "";
    const coms = () => datos.comentarios.filter((x) => !v.dataset.ver || x.version === v.dataset.ver);
    v.dataset.ver = verSel || "";
    const pintarComs = () => {
      const lista = coms();
      q("#co-coms", c).innerHTML = lista.map((x) => `<div class="co-com ${x.resuelto ? "resuelto" : ""}"><button class="co-t" data-t="${x.t}">${tc(x.t)}</button>
          <div><b>${e(x.autor)}</b> <span class="muy-tenue pequeno">${hora(x.ts)} · ${e(x.version)}</span><div>${e(x.texto)}</div></div>
          <label class="pequeno" title="Resuelto"><input type="checkbox" data-resolver="${e(x.id)}" data-tok="${e(x.token)}" ${x.resuelto ? "checked" : ""}> listo</label></div>`).join("") || '<p class="tenue pequeno">Sin comentarios en esta versión.</p>';
      const d = v.duration || 0;
      q("#co-marcas", c).innerHTML = d ? lista.map((x) => `<span class="co-marca ${x.resuelto ? "resuelto" : ""}" style="left:${(x.t / d) * 100}%" title="${e(x.autor)}: ${e(x.texto)}"></span>`).join("") : "";
      qq("[data-t]", c).forEach((b) => b.onclick = () => { v.currentTime = +b.dataset.t; v.play(); });
      qq("[data-resolver]", c).forEach((i) => i.onchange = async () => { await api(`/api/proyectos/${enc(pid)}/revision/comentarios/${enc(i.dataset.resolver)}`, { method: "POST", json: { token: i.dataset.tok, resuelto: i.checked } }); await cargar(); pintarComs(); });
    };
    v.onloadedmetadata = pintarComs; pintarComs();
    q("#co-lan", c).onchange = async (ev) => {
      if (ev.target.checked) {
        const ok = await WD.confirmar({ titulo: "¿Encender la revisión en la red local?", si: "Encender",
          cuerpo: `Cualquier persona <b>conectada a tu misma red</b> (Wi-Fi u oficina) que tenga un enlace podrá ver ese video y comentar.
            Solo se comparte la página de revisión (no tus archivos ni el resto de la app) y cada enlace tiene una clave aleatoria.
            Windows puede preguntarte si permites el acceso de Python a la red: elige <b>redes privadas</b>. Apágala al terminar.` });
        if (!ok) { ev.target.checked = false; return; }
      }
      try { datos.servidor = await api("/api/colab/servidor", { method: "POST", json: { activo: ev.target.checked, confirmado: true } }); await cargar(); pintarRevision(); }
      catch (err) { ev.target.checked = false; WD.errorToast(err, "No se pudo encender"); }
    };
    q("#co-nuevo", c).onclick = async () => {
      try { await api(`/api/proyectos/${enc(pid)}/revision`, { method: "POST", json: { version: q("#co-ver", c).value || null } }); await cargar(); pintarRevision(); WD.toast("Enlace creado", "ok", { ms: 2000 }); }
      catch (err) { WD.errorToast(err, "No se creó el enlace"); }
    };
    qq("[data-copiar]", c).forEach((b) => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copiar); WD.toast("Enlace copiado", "ok", { ms: 1500 }); } catch { WD.toast(b.dataset.copiar); } });
    qq("[data-ver]", c).forEach((b) => b.onclick = () => { v.src = urlVer(b.dataset.ver); v.dataset.ver = b.dataset.ver; v.dataset.tok = b.dataset.tok; pintarComs(); });
    qq("[data-desactivar]", c).forEach((b) => b.onclick = async () => { await api(`/api/proyectos/${enc(pid)}/revision/${enc(b.dataset.desactivar)}`, { method: "DELETE" }); await cargar(); pintarRevision(); });
    const f = q("#co-comentar", c);
    if (f) f.onsubmit = async (ev) => {
      ev.preventDefault(); const t = q("#co-texto", c).value.trim(); if (!t) return;
      try { await api(`/api/revision/${enc(v.dataset.tok || enl[0].token)}/comentarios`, { method: "POST", json: { t: v.currentTime || 0, texto: t } }); q("#co-texto", c).value = ""; await cargar(); pintarComs(); }
      catch (err) { WD.errorToast(err); }
    };
  }

  // ------------------------------------------------------------------ Comparar versiones lado a lado
  function pintarComparar() {
    const c = q("#co-cuerpo"), vs = datos.versiones;
    if (vs.length < 1) { c.innerHTML = '<div class="vacio-guia"><b>Todavía no hay versiones</b><span>Haz una vista previa o el render final y pulsa «Fijar versión».</span></div>'; return; }
    const op = (sel) => vs.map((v) => `<option value="${e(v.id)}" ${v.id === sel ? "selected" : ""}>${e(v.nombre)}${v.ts ? " · " + hora(v.ts) : ""}</option>`).join("");
    const fijas = vs.filter((v) => !v.vivo);
    const a = (fijas[fijas.length - 2] || fijas[0] || vs[0]).id, b = (vs.find((v) => v.vivo) || vs[vs.length - 1]).id;
    c.innerHTML = `<div class="fila entre"><span class="tenue pequeno">Las dos se reproducen sincronizadas. Fija el render actual como versión para compararlo después.</span>
        <button class="btn chico" id="co-fijar">${ic("pin", 13)} Fijar versión</button></div>
      <div class="co-lado"><div><select id="co-a">${op(a)}</select><video id="co-va" src="${urlVer(a)}" preload="metadata" muted></video></div>
        <div><select id="co-b">${op(b)}</select><video id="co-vb" src="${urlVer(b)}" preload="metadata"></video></div></div>
      <div class="co-ctrl"><button class="btn chico" id="co-play">${ic("play", 14)} Reproducir</button><input type="range" id="co-pos" min="0" max="1000" value="0" aria-label="Posición"><span id="co-tc" class="pequeno tenue">0:00.0</span>
        <label class="pequeno"><input type="checkbox" id="co-audio-a"> audio de la izquierda</label></div>`;
    WD.hidratarIconos && WD.hidratarIconos(c);
    const va = q("#co-va", c), vb = q("#co-vb", c), pos = q("#co-pos", c);
    const durMax = () => Math.max(va.duration || 0, vb.duration || 0) || 1;
    q("#co-a", c).onchange = (ev) => { va.src = urlVer(ev.target.value); };
    q("#co-b", c).onchange = (ev) => { vb.src = urlVer(ev.target.value); };
    q("#co-play", c).onclick = () => { if (vb.paused) { va.currentTime = vb.currentTime; va.play(); vb.play(); } else { va.pause(); vb.pause(); } };
    vb.ontimeupdate = () => { pos.value = (vb.currentTime / durMax()) * 1000; q("#co-tc", c).textContent = tc(vb.currentTime); if (Math.abs(va.currentTime - vb.currentTime) > 0.25 && !va.paused) va.currentTime = vb.currentTime; };
    pos.oninput = () => { const t = (pos.value / 1000) * durMax(); va.currentTime = Math.min(t, va.duration || t); vb.currentTime = Math.min(t, vb.duration || t); };
    q("#co-audio-a", c).onchange = (ev) => { va.muted = !ev.target.checked; vb.muted = ev.target.checked; };
    q("#co-fijar", c).onclick = async () => { try { const v = await api(`/api/proyectos/${enc(pid)}/versiones_video`, { method: "POST", json: {} }); WD.toast(`${v.nombre} fijada`, "ok"); await cargar(); pintarComparar(); } catch (err) { WD.errorToast(err); } };
  }

  // ------------------------------------------------------------------ Aprobación
  function pintarAprobacion() {
    const c = q("#co-cuerpo"), a = datos.aprobacion || {};
    const hist = (a.historial || []).slice().reverse();
    c.innerHTML = `<div class="co-apr"><div class="co-apr-estado ${ESTADO[a.estado || "pendiente"][1]}">${ic(a.estado === "aprobado" ? "badge-check" : a.estado === "cambios" ? "message-square-warning" : "circle-dashed", 28)}
        <div><b>${ESTADO[a.estado || "pendiente"][0]}</b>${a.por ? `<div class="pequeno tenue">por ${e(a.por)} · ${hora(a.ts)}${a.version ? " · " + e(a.version) : ""}${a.via === "enlace" ? " · desde el enlace" : ""}</div>` : ""}${a.nota ? `<div class="pequeno">«${e(a.nota)}»</div>` : ""}</div></div>
      <label class="campo">Nota (opcional)<input id="co-nota" maxlength="300" placeholder="p. ej. listo para Instagram el lunes"></label>
      <div class="fila"><button class="btn primario" data-estado="aprobado">${ic("badge-check", 14)} Aprobar: listo para publicar</button>
        <button class="btn" data-estado="cambios">${ic("message-square-warning", 14)} Pedir cambios</button>
        <button class="btn fantasma" data-estado="pendiente">Quitar aprobación</button></div>
      <h4>Historial</h4><div class="co-hist">${hist.map((x) => `<div class="pequeno"><span class="insignia-apr ${ESTADO[x.estado][1]}">${ESTADO[x.estado][0]}</span> ${e(x.por)} · ${hora(x.ts)}${x.nota ? ` — ${e(x.nota)}` : ""}</div>`).join("") || '<p class="tenue pequeno">Sin decisiones todavía.</p>'}</div></div>`;
    WD.hidratarIconos && WD.hidratarIconos(c);
    qq("[data-estado]", c).forEach((b) => b.onclick = async () => {
      try { await api(`/api/proyectos/${enc(pid)}/aprobacion`, { method: "POST", json: { estado: b.dataset.estado, nota: q("#co-nota", c).value } }); await cargar(); pintarAprobacion(); WD.refrescarInicio && WD.refrescarInicio(); }
      catch (err) { WD.errorToast(err); }
    });
  }

  // ------------------------------------------------------------------ Historial: quién cambió qué
  async function pintarHistorial() {
    const c = q("#co-cuerpo");
    c.innerHTML = '<p class="tenue">Cargando…</p>';
    let h; try { h = (await api(`/api/proyectos/${enc(pid)}/historial_cambios`)).cambios; } catch (err) { return WD.errorToast(err); }
    c.innerHTML = `<div class="co-cambios">${h.map((x) => `<div class="co-cambio ${x.tipo === "version" ? "ver" : ""}"><span class="co-punto" style="--c:${e(x.color || "#8B8F98")}"></span>
        <div><b>${e(x.nombre || x.perfil || "—")}</b> ${e(x.accion)}${x.veces > 1 ? ` <span class="tenue">(${x.veces} veces)</span>` : ""}
        ${x.detalle && x.tipo === "version" ? `<span class="tenue"> · ${e(x.detalle)}</span>` : ""}<div class="muy-tenue pequeno">${hora(x.ts)}${x.ts_fin ? " – " + new Date(x.ts_fin).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : ""}</div></div></div>`).join("") || '<p class="tenue">Sin cambios registrados todavía.</p>'}</div>`;
  }

  // ------------------------------------------------------------------ .wsproj
  function pintarMnproj() {
    const c = q("#co-cuerpo");
    c.innerHTML = `<div class="co-mnproj"><section><h4>${ic("package", 15)} Exportar este proyecto (.wsproj)</h4>
        <p class="pequeno tenue">Un solo archivo con el plan, el historial, el chat, el brief y los medios para abrirlo en otra PC con Web Studio.</p>
        <label class="interruptor"><input type="checkbox" id="mp-medios" checked> <span>Incluir los videos agregados desde otras carpetas (puede pesar varios GB)</span></label>
        <label class="interruptor"><input type="checkbox" id="mp-renders"> <span>Incluir los renders (vista previa y final)</span></label>
        <div class="fila"><button class="btn primario" id="mp-carpeta">${ic("folder-output", 14)} Guardar en una carpeta…</button><a class="btn" id="mp-descargar" href="#">${ic("download", 14)} Descargar</a></div></section>
      <section><h4>${ic("package-open", 15)} Importar un .wsproj</h4><p class="pequeno tenue">Se agrega como proyecto nuevo de tu perfil; no reemplaza nada.</p>
        <button class="btn" id="mp-importar">${ic("upload", 14)} Importar…</button></section></div>`;
    WD.hidratarIconos && WD.hidratarIconos(c);
    const opc = () => `medios=${q("#mp-medios", c).checked}&renders=${q("#mp-renders", c).checked}`;
    q("#mp-descargar", c).onclick = (ev) => { ev.preventDefault(); const a = document.createElement("a"); a.href = `/api/proyectos/${enc(pid)}/mnproj?${opc()}`; a.download = `${pid}.wsproj`; a.click(); WD.toast("Preparando el archivo… la descarga empieza al terminar.", "info"); };
    q("#mp-carpeta", c).onclick = async () => {
      const r = await WD.elegirNativo({ tipo: "carpeta", filtro: "todo", titulo: "¿Dónde guardo el .wsproj?" });
      if (!r || !r.length) return;
      const id = "mnproj:" + pid; WD.tareas.poner(id, { titulo: "Exportando .wsproj", frac: null });
      try { const x = await api(`/api/proyectos/${enc(pid)}/mnproj`, { method: "POST", json: { destino: r[0], medios: q("#mp-medios", c).checked, renders: q("#mp-renders", c).checked } });
        WD.tareas.terminar(id, true, { texto: `${(x.bytes / 1e6).toFixed(1)} MB` }); WD.toast(x.ruta, "ok", { titulo: "Proyecto exportado", ms: 9000 }); }
      catch (err) { WD.tareas.terminar(id, false, { texto: err.message }); WD.errorToast(err); }
    };
    q("#mp-importar", c).onclick = importar;
  }

  async function importar() {
    const r = await WD.elegirNativo({ tipo: "archivos", filtro: "todo", multiple: false, titulo: "Elige el proyecto .wsproj" });
    const id = "mnproj-importar";
    try {
      let x;
      if (r && r.length) { WD.tareas.poner(id, { titulo: "Importando proyecto", frac: null }); x = await api("/api/mnproj/importar", { method: "POST", json: { ruta: r[0] } }); }
      else if (r === null) {
        const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".wsproj,.zip";
        const f = await new Promise((ok) => { inp.onchange = () => ok(inp.files[0]); inp.click(); }); if (!f) return;
        WD.tareas.poner(id, { titulo: "Importando proyecto", frac: null });
        const fd = new FormData(); fd.append("archivo", f); x = await api("/api/mnproj/subir", { method: "POST", body: fd });
      } else return;
      WD.tareas.terminar(id, true, { texto: x.nombre });
      WD.toast(x.medios_faltantes?.length ? `Faltan ${x.medios_faltantes.length} medio(s) que no venían incluidos.` : "Listo.", x.medios_faltantes?.length ? "aviso" : "ok",
        { titulo: `Proyecto «${x.nombre}» importado`, accion: { etiqueta: "Abrir", fn: () => WD.abrirEditor(x.id, q("#workspace")) } });
      if (q("#dlg-colab")?.open) q("#dlg-colab").close();
      WD.refrescarInicio && WD.refrescarInicio();
    } catch (err) { WD.tareas.terminar(id, false, { texto: err.message }); WD.errorToast(err, "No se pudo importar"); }
  }

  WD.colab = { abrir, importar };
})();
