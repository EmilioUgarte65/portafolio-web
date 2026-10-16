"use strict";
// Web Studio — Editor de video (espacio de trabajo principal). JS propio, sin dependencias.
// Núcleo: estado, layout, línea de tiempo, selección múltiple, portapapeles, teclado, biblioteca, Asistente IA,
// versiones y exportación. Módulos: editor_insp.js (inspector) y editor_player.js (reproducción en vivo).
// Contrato: window.WDVS.abrirEditor(pid, contenedor) / window.WDVS.cerrarEditor(); el evento de ventana
// 'wdvs:plan-cambiado' (detail: {pid}) hace que el editor recargue el plan. Ver docs/editor.md.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CAB = 132;
  const ALTO = { regla: 24, video: 58, carril: 21, musica: 44, sfx: 26, voz: 28 };
  const IMAN_PX = 8;
  const E = {
    pid: null, plan: null, hash: "", vista: null, fuentes: {}, medios: [], errores: [], avisos: [], version: null,
    cat: null, sesion: nuevaSesion(), undo: [], redo: [], sel: null, multi: [], t: 0, pps: 0, iman: true, rango: null, marcaIn: null,
    abierto: false, cola: Promise.resolve(), ondas: {}, vivo: null, borrador: null, todaSerie: true, ripple: false,
    herramienta: "sel", reproduciendo: false, bib: "medios", filtroBib: "", bloqueado: null, tareaVigilada: null,
    ovsVisor: [], guardado: null, marcadores: [], mute: {}, solo: null, calidad: "fluida", raiz: null, sinPlan: false,
    bloq: {}, oculto: {}, altos: {}, altoGlobal: 1, zoomVisor: 0, segura: false, guias: false,
    destV: 0, destA: 1, enlazado: true, monitor: "programa",
  };
  const pidURL = () => `/api/proyectos/${encodeURIComponent(E.pid)}`;
  function nuevaSesion() { return "ed-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function fmt(t) {
    t = Math.max(0, t || 0);
    const m = Math.floor(t / 60), s = t - m * 60;
    return `${m}:${s.toFixed(2).padStart(5, "0")}`;
  }
  function timecode(t, fps = 30) {
    t = Math.max(0, t || 0);
    const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = Math.floor(t) % 60, f = Math.floor((t - Math.floor(t)) * fps + 1e-6);
    const p = (x) => String(x).padStart(2, "0");
    return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`;
  }
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function el(tag, attrs = {}, ...hijos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "html") e.innerHTML = v;
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const h of hijos.flat()) if (h !== null && h !== undefined && h !== false) e.append(h instanceof Node ? h : document.createTextNode(h));
    return e;
  }
  function toast(msg, tipo = "error", ms = 4500) {
    const WD = window.WDVS || {};
    if (WD.toast) return WD.toast(String(msg), tipo === "info" ? "info" : "error", { ms: tipo === "info" ? ms : Math.max(ms, 7000) });
    const t = el("div", { class: "toast-ed " + (tipo === "info" ? "info" : "") }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), ms);
  }
  async function pedir(ruta, opts = {}) {
    const o = { ...opts };
    if (o.json !== undefined) { o.body = JSON.stringify(o.json); o.headers = { "Content-Type": "application/json" }; delete o.json; }
    const r = await fetch(ruta, o);
    const txt = await r.text();
    let d; try { d = txt ? JSON.parse(txt) : {}; } catch { d = { detail: txt }; }
    return { ok: r.ok, status: r.status, d };
  }
  function debounce(fn, ms) { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; }
  const lsGet = (k, d) => { try { const v = sessionStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const lsSet = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

  // Nombres humanos (sin claves internas).
  function humano(s) {
    if (!s) return "";
    const d = { push: "Acercar", pull: "Alejar", pan_izq: "Paneo a la izquierda", pan_der: "Paneo a la derecha", pan_arriba: "Paneo hacia arriba",
      pan_abajo: "Paneo hacia abajo", fijo: "Fija", fade: "Aparecer", punch: "Golpe", slam: "Impacto", slide: "Deslizar", ninguna: "Ninguna",
      maquina: "Máquina de escribir", glitch_texto: "Glitch", contador: "Contador", temblor: "Temblor", caida: "Caída letra a letra",
      subrayado: "Subrayado", marco: "Marco", boom: "Golpe grave", golpe: "Golpe", hit: "Golpe", riser: "Subida (tensión)", whoosh: "Whoosh",
      barra_inferior: "Barra inferior", barra_superior: "Barra superior", tercio_inferior: "Tercio inferior", centro: "Centro", arriba: "Arriba", abajo: "Abajo" };
    if (d[s]) return d[s];
    const t = String(s).replace(/^propio_.*/, "Estilo propio").replace(/^plantilla_/, "").replace(/_/g, " ");
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function nombreFuente(alias) {
    const f = E.fuentes[alias];
    const n = f && f.ruta ? f.ruta.split(/[\\/]/).pop() : alias;
    return n ? n.replace(/\.[^.]+$/, "") : "";
  }
  // Mensajes del motor en lenguaje llano ("plan.overlays[3]" -> "Texto/capa 4").
  function llano(m) {
    return String(m)
      .replace(/plan\.timeline\[(\d+)\]\.tomas\[(\d+)\](\.serie\[(\d+)\])?/g, (_, g, t) => `Clip ${+t + 1} de la escena ${+g + 1}`)
      .replace(/plan\.timeline\[(\d+)\]/g, (_, g) => `Escena ${+g + 1}`)
      .replace(/plan\.overlays\[(\d+)\]/g, (_, i) => `Texto/capa ${+i + 1}`)
      .replace(/plan\.musica\.tramos\[(\d+)\]/g, (_, i) => `Música ${+i + 1}`)
      .replace(/plan\.sfx\[(\d+)\]/g, (_, i) => `Sonido ${+i + 1}`)
      .replace(/plan\.efectos\[(\d+)\]/g, (_, i) => `Efecto ${+i + 1}`)
      .replace(/plan\.proyecto\./g, "Proyecto: ").replace(/plan\./g, "");
  }

  // Iconos SVG (trazos de 24x24).
  const IC = {
    undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3", redo: "m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
    cursor: "M5 3l14 8-6 2-2 6z", blade: "M6 3v18M18 3 9 12l9 9", text: "M5 5h14M12 5v14M9 19h6",
    magnet: "M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3zM6 7h4M14 7h4", ripple: "M3 12h6l3-6 3 12 3-6h3",
    zin: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M8 11h6M11 8v6", zout: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M8 11h6",
    fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5", play: "M7 4v16l13-8z", pause: "M7 4h4v16H7zM14 4h4v16h-4z",
    prev: "M6 5v14M19 5 9 12l10 7z", next: "M18 5v14M5 5l10 7-10 7z", ini: "M5 5v14M19 5l-9 7 9 7z", fin: "M19 5v14M5 5l9 7-9 7z",
    full: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5", exp: "M12 3v12M7 8l5-5 5 5M4 15v5h16v-5", hist: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3",
    help: "M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V14M12 17.5v.5", spark: "M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z",
    up: "M12 16V4M7 9l5-5 5 5M4 20h16", folder: "M3 6h6l2 2h10v11H3z", split: "M12 3v18M5 8l-3 4 3 4M19 8l3 4-3 4",
    copy: "M8 8h12v12H8zM4 16V4h12", trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13", film: "M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4",
  };
  // Un solo set de iconos: Lucide (vendor/lucide/lucide.js). Los nombres viejos se traducen; IC queda de respaldo.
  const LUCIDE = { // íconos de los módulos del 5-oct sin equivalente en el subconjunto de vendor/lucide
    "arrow-left": "chevron-left", "audio-waveform": "audio-lines", "battery-low": "gauge", captions: "type", "chart-column": "gauge", "file-text": "message-square", flag: "bookmark", "folder-input": "folder", "folder-search": "search", "git-compare": "layers", "graduation-cap": "circle-help", images: "image", instagram: "square-play", "layout-template": "layers", lightbulb: "zap", link: "paperclip", linkedin: "user", "maximize-2": "maximize", megaphone: "share", "message-circle": "message-square", "minimize-2": "minimize", "mouse-pointer-click": "mouse-pointer-2", palette: "sliders-horizontal", presentation: "monitor-play", "refresh-cw": "rotate-ccw", "scan-face": "scan", "scan-search": "search", "scroll-text": "list-checks", smartphone: "file-video", youtube: "square-play", square: "square-dashed", smile: "user", "spell-check": "check", split: "square-split-horizontal", "sun-moon": "eye", "toggle-left": "sliders-horizontal", trash: "trash-2", users: "user", languages: "message-square", "mic-vocal": "mic",
    undo: "undo-2", redo: "redo-2", cursor: "mouse-pointer-2", blade: "scissors", text: "type", magnet: "magnet", ripple: "arrow-right-left",
    zin: "zoom-in", zout: "zoom-out", fit: "scan", play: "play", pause: "pause", prev: "step-back", next: "step-forward", ini: "skip-back", fin: "skip-forward",
    full: "maximize", exp: "share", hist: "history", help: "circle-help", spark: "sparkles", up: "upload", folder: "folder-open", split: "square-split-horizontal",
    copy: "copy", trash: "trash-2", film: "film" };
  const ico = (n, tam = 16) => {
    const WD = window.WDVS || {};
    if (WD.icono) return WD.icono(LUCIDE[n] || n, tam);
    return `<svg class="ico" viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${IC[n] || ""}"/></svg>`;
  };
  const bIco = (id, n, tit, extra = "") => `<button class="ib${extra ? " " + extra : ""}" id="${id}" title="${esc(tit)}"${/\bon\b/.test(extra) ? ' aria-pressed="true"' : ""}>${ico(n)}</button>`;

  // ================================================================== layout
  function asegurarCSS() {
    const base = BASE_JS || "";
    if (!$('link[href$="tokens.css"]')) document.head.prepend(el("link", { rel: "stylesheet", href: base + "tokens.css" }));
    if (!$('link[href$="editor.css"]')) document.head.append(el("link", { rel: "stylesheet", href: base + "editor.css" }));
  }
  // Acciones principales del proyecto: van en la barra única de la app (#appbar-editor); sin app, en una barra propia.
  const htmlAcciones = () => `
      <span class="wd-guardado" id="wd-guardado" aria-live="polite"></span>
      <button class="bt" id="ed-versiones" title="Versiones anteriores del video">${ico("hist")}<span class="txt">Versiones</span></button>
      <button class="bt" id="ed-preview" title="Vista previa exacta con efectos del rango marcado (I/O) o de todo el video">${ico("monitor-play")}<span class="txt">Vista previa</span></button>
      <button class="bt acento" id="ed-exportar" aria-haspopup="menu">${ico("exp")}<span class="txt">Exportar</span>${ico("chevron-down", 14)}</button>`;
  function montar(cont) {
    asegurarCSS();
    E.raiz = cont;
    const slot = document.getElementById("appbar-editor");
    if (slot) slot.innerHTML = htmlAcciones();
    cont.innerHTML = `
<div class="wded${slot ? "" : " con-top"}" id="wded">
  ${slot ? "" : `<div class="wd-top">${htmlAcciones()}</div>`}
  <div class="wd-mid" id="wd-mid">
    <div class="wd-panel wd-izq" id="wd-izq" aria-label="Biblioteca">
      <div class="wd-tabs pestanas" id="bib-tabs" role="tablist" aria-label="Biblioteca">
        <button data-b="medios" class="activa" role="tab" aria-selected="true">${ico("film", 14)}<span>Medios</span></button><button data-b="textos" role="tab" aria-selected="false">${ico("type", 14)}<span>Texto</span></button><button data-b="efectos" role="tab" aria-selected="false">${ico("wand-sparkles", 14)}<span>Efectos</span></button><button data-b="transiciones" role="tab" aria-selected="false">${ico("arrow-right-left", 14)}<span>Transiciones</span></button><button data-b="audio" role="tab" aria-selected="false">${ico("music", 14)}<span>Audio</span></button><button data-b="animar" role="tab" aria-selected="false">${ico("person-standing", 14)}<span>Animar</span></button>
      </div>
      <div class="wd-scroll" id="bib-lista" role="tabpanel"></div>
      <div class="wd-scroll bib-panel" id="bib-panel-animar" data-panel="animar" role="tabpanel" hidden></div>
    </div>
    <div class="wd-split" data-split="izq" role="separator" aria-orientation="vertical" aria-label="Cambiar el ancho de la biblioteca"></div>
    <div class="wd-centro">
      <div class="visor-barra" id="visor-barra">
        <div class="segmentado mon-sel" id="mon-sel" role="group" aria-label="Monitor"><button data-mon="programa" aria-pressed="true" title="Monitor de programa: la secuencia">Programa</button><button data-mon="origen" aria-pressed="false" title="Monitor de origen: revisa un medio y marca entrada y salida (doble clic en un medio)">Origen</button><button data-mon="dividido" aria-pressed="false" title="Origen y programa lado a lado">${ico("columns-2", 14)}</button></div>
        <span class="tenue vb-info" id="vb-info"></span><span class="espacio"></span>
        <button class="ib" id="ed-segura" title="Área segura: márgenes donde el texto se ve bien en cualquier pantalla" aria-pressed="false">${ico("square-dashed", 15)}</button>
        <button class="ib" id="ed-guias" title="Guías: tercios y centro" aria-pressed="false">${ico("grid-3x3", 15)}</button>
        <select id="ed-zoom-visor" title="Zoom del visor" aria-label="Zoom del visor"><option value="0">Ajustar</option><option value="0.25">25 %</option><option value="0.5">50 %</option><option value="1">100 %</option><option value="2">200 %</option></select>
      </div>
      <div class="monitores" id="monitores">
      <div class="mon-origen" id="mon-origen" hidden></div>
      <div class="mon-prog" id="mon-prog">
      <div class="visor-caja" id="visor-caja"><div class="visor" id="visor"></div></div>
      <div class="transporte" id="transporte">
        <span class="tc" id="ed-tiempo" aria-label="Posición del cabezal">00:00:00:00</span>
        <div class="tr-ctl">
          ${bIco("ed-inicio", "ini", "Al inicio (Inicio)")}${bIco("ed-cuadro-ant", "prev", "Cuadro anterior (←)")}
          <button class="ib play" id="ed-play" title="Reproducir / pausa (Espacio)">${ico("play", 18)}</button>
          ${bIco("ed-cuadro-sig", "next", "Cuadro siguiente (→)")}${bIco("ed-final-t", "fin", "Al final (Fin)")}
        </div>
        <div class="tr-der">
          <span class="solo-avanzado tr-rango"><button class="bt chico" id="ed-in" title="Marcar entrada del rango (I)">I</button><button class="bt chico" id="ed-out" title="Marcar salida del rango (O)">O</button>
          <span class="tenue num" id="ed-rango-txt"></span></span>
          <span class="fxb-visor" id="ed-fx" hidden title="Este clip tiene efectos que solo se ven en la vista previa renderizada">fx</span>
          <button class="bt chico" id="ed-ver-fx" hidden title="Renderiza este tramo con todos los efectos y lo reproduce">${ico("monitor-play", 13)} Ver con efectos</button>
          <select id="ed-calidad" class="solo-avanzado" title="Calidad del visor: fluido (versiones ligeras) o cuadro exacto (lo que sale en el render)" aria-label="Calidad del visor"><option value="fluida">Fluido</option><option value="exacta">Cuadro exacto</option></select>
          ${bIco("ed-pantalla", "full", "Pantalla completa (F)")}
          <div class="progreso-ed" id="ed-progreso" hidden><div></div></div><span class="tenue" id="ed-tarea"></span>
        </div>
      </div>
      </div>
      </div>
    </div>
    <div class="wd-split" data-split="der" role="separator" aria-orientation="vertical" aria-label="Cambiar el ancho del inspector"></div>
    <div class="wd-panel wd-der" id="wd-der">
      <div class="wd-tabs pestanas" id="der-tabs" role="tablist"><button data-d="insp" class="activa" role="tab" aria-selected="true">${ico("sliders-horizontal", 14)}<span>Inspector</span></button><button data-d="ia" role="tab" aria-selected="false">${ico("spark", 14)}<span>Asistente IA</span><kbd class="solo-avanzado">Ctrl+K</kbd></button></div>
      <div class="wd-der-cont" id="der-insp" role="tabpanel"><div class="tit-insp" id="insp-tit">Inspector</div><div class="wd-scroll insp" id="insp"></div></div>
      <div class="wd-der-cont" id="der-ia" role="tabpanel" hidden></div>
    </div>
  </div>
  <div class="wd-split-h" data-split="tl" role="separator" aria-orientation="horizontal" aria-label="Cambiar el alto de la línea de tiempo"></div>
  <div class="tl" id="tl" aria-label="Línea de tiempo">
    <div class="tl-secs" id="tl-secs" role="tablist" aria-label="Secuencias del proyecto"></div>
    <div class="tl-barra" id="tl-barra" role="toolbar" aria-label="Herramientas de la línea de tiempo">
      <div class="grupo">${bIco("ed-deshacer", "undo", "Deshacer (Ctrl+Z)")}${bIco("ed-rehacer", "redo", "Rehacer (Ctrl+Y)")}</div>
      <div class="grupo herr" id="tl-herr">${bIco("ed-h-sel", "cursor", "Seleccionar y mover (V)", "on")}${bIco("ed-h-cortar", "blade", "Cuchilla: clic en un clip lo divide (C)")}${bIco("ed-nuevo-texto", "text", "Texto nuevo en el cabezal (T)")}</div>
      <div class="grupo">${bIco("ed-iman", "magnet", "Imán: pegar a beats y bordes (N)", "on")}<span class="solo-avanzado">${bIco("ed-ripple", "ripple", "Ripple: al cambiar la duración de un clip, lo que viene después se recorre (R)")}${bIco("ed-enlazado", "link", "Selección enlazada: el video y su audio se mueven, recortan y borran juntos (Ctrl+L enlaza o desenlaza la selección)", "on")}</span></div>
      <div class="grupo">${bIco("ed-dividir", "split", "Dividir en el cabezal (S)")}${bIco("ed-copiar", "copy", "Copiar (Ctrl+C)")}${bIco("ed-borrar", "trash", "Borrar (Supr)")}<span class="solo-avanzado">${bIco("ed-marcador", "bookmark", "Marcador en el cabezal (M)")}</span></div>
      <span class="ed-estado" id="ed-estado"></span>
      <div class="grupo zoom">${bIco("ed-zoom-menos", "zout", "Alejar (−)")}<input type="range" id="ed-zoom-rango" min="0" max="100" step="1" value="0" aria-label="Zoom de la línea de tiempo" title="Zoom de la línea de tiempo (Ctrl + rueda)">${bIco("ed-zoom-mas", "zin", "Acercar (+)")}${bIco("ed-zoom-ajustar", "fit", "Ver todo (Shift+Z)")}</div>
      <div class="segmentado alto-pistas" role="group" aria-label="Altura de las pistas"><button data-alto="0.75" title="Pistas compactas">S</button><button data-alto="1" title="Pistas normales">M</button><button data-alto="1.5" title="Pistas altas (miniaturas y ondas más grandes)">L</button></div>
    </div>
    <div class="tl-cuerpo"><div class="tl-scroll" id="tl-scroll"><div class="tl-cont" id="tl-cont"></div></div>
    <div class="tl-medidores" id="tl-medidores" aria-label="Medidores de audio"></div></div>
  </div>
</div>`;
    // paneles de la biblioteca registrados antes de montar el editor (Buscar, módulos de otros equipos)
    for (const [nombre, reg] of Object.entries(PANELES)) {
      if ($(`#bib-tabs button[data-b="${nombre}"]`)) continue;
      $("#bib-tabs").append(el("button", { "data-b": nombre, role: "tab", "aria-selected": "false", html: `${ico(reg.icono || "layers", 14)}<span>${esc(reg.titulo || nombre)}</span>` }));
      $("#wd-izq").append(el("div", { class: "wd-scroll bib-panel", "data-panel": nombre, role: "tabpanel", hidden: true }));
    }
    const tam = lsGet("wded_tam", {});
    const mid = $("#wd-mid");
    if (tam.izq) mid.style.setProperty("--izq", tam.izq + "px");
    if (tam.der) mid.style.setProperty("--der", tam.der + "px");
    if (tam.tl) $("#wded").style.setProperty("--tl", tam.tl + "px");
    enlazar();
  }
  // Paneles redimensionables.
  function enlazarSplits() {
    for (const s of $$(".wd-split, .wd-split-h", E.raiz)) {
      s.addEventListener("pointerdown", (e) => {
        e.preventDefault(); s.setPointerCapture(e.pointerId);
        const cual = s.dataset.split, mid = $("#wd-mid"), raiz = $("#wded");
        const x0 = e.clientX, y0 = e.clientY;
        const izq = $("#wd-izq").offsetWidth, der = $("#wd-der").offsetWidth, tl = $("#tl").offsetHeight;
        const mover = (ev) => {
          if (cual === "izq") mid.style.setProperty("--izq", clamp(izq + ev.clientX - x0, 170, 480) + "px");
          else if (cual === "der") mid.style.setProperty("--der", clamp(der - (ev.clientX - x0), 240, 560) + "px");
          else raiz.style.setProperty("--tl", clamp(tl - (ev.clientY - y0), 150, window.innerHeight - 260) + "px");
        };
        const soltar = () => {
          s.removeEventListener("pointermove", mover); s.removeEventListener("pointerup", soltar);
          lsSet("wded_tam", { izq: $("#wd-izq").offsetWidth, der: $("#wd-der").offsetWidth, tl: $("#tl").offsetHeight });
          dimensionarVisor(); renderTimeline();
        };
        s.addEventListener("pointermove", mover); s.addEventListener("pointerup", soltar);
      });
    }
  }

  // ================================================================== carga y guardado
  async function cargar(silencioso) {
    if (!E.plan) {   // proyecto sin video todavía: se evita pedir /editor (daría 404 en la consola)
      const p = await pedir(pidURL());
      if (p.ok && !p.d.tiene_plan) { E.sinPlan = true; E.medios = p.d.medios || []; E.salidas = p.d.salidas || {}; renderSinPlan(); return; }
    }
    const r = await pedir(`${pidURL()}/editor`);
    if (!r.ok) {
      E.plan = null; E.sinPlan = r.status === 404;
      await cargarMedios();
      renderSinPlan(r.d.detail);
      return;
    }
    E.sinPlan = false;
    const cambio = E.hash && r.d.hash !== E.hash;
    if (cambio) limpiarVivo();
    aplicarRespuesta(r.d);
    E.medios = r.d.medios || [];
    E.bloqueado = r.d.bloqueado;
    if (cambio && !silencioso) {
      E.undo = []; E.redo = []; E.sesion = nuevaSesion();
      toast("El video cambió (la IA o una versión anterior). Se cargó la versión nueva.", "info");
    }
    if (!E.pps) ajustarZoom();
    renderTodo();
    if (ED.player) ED.player.planCambiado();
  }
  function renderSinPlan(detalle) {
    $("#tl-cont").innerHTML = "";
    $("#tl-cont").style.width = "100%";
    const hayMedios = (E.medios || []).length > 0;
    $("#tl-cont").append(el("div", { class: "vacio-tl vacio-guia" }, el("span", { html: ico("clapperboard", 34) }), el("b", {}, "Tu línea de tiempo está vacía"),
      el("span", {}, hayMedios ? "Arrastra tus videos aquí desde Medios, o pídele a la IA que arme el primer corte con lo que ya subiste." : "Importa tus videos (o arrástralos a la ventana) y luego pídele a la IA que arme el primer corte."),
      el("div", { class: "acciones" },
        el("button", { class: "btn" + (hayMedios ? "" : " primario"), html: `${ico("up", 14)} Importar videos`, onclick: () => importarNativo(false, { click() {} }) }),
        el("button", { class: "btn" + (hayMedios ? " primario" : ""), html: `${ico("spark", 14)} Pídele a la IA…`, onclick: () => { const t = $('#der-tabs button[data-d="ia"]'); if (t) t.click(); } }))));
    $("#insp").innerHTML = `<div class="vacio-guia">${ico("sliders-horizontal", 28)}<span>${esc(detalle && !/plan/i.test(detalle) ? detalle : "Cuando haya video, aquí verás las opciones de lo que selecciones.")}</span></div>`;
    $("#visor").innerHTML = `<div class="vacio-visor vacio-guia">${ico("film", 40)}<b>Tu video aparecerá aquí</b><span>Importa tus videos o pídele a la IA que arme el primer corte.</span></div>`;
    renderBiblio(); renderEstado();
  }
  function aplicarRespuesta(d) {
    E.plan = d.plan; E.hash = d.hash; E.vista = d.vista; E.fuentes = d.fuentes || {};
    E.errores = d.errores || []; E.avisos = d.avisos || []; E.version = d.version;
    if (ED.pro) ED.pro.planCargado();
    if (E.t > E.vista.total) E.t = E.vista.total;
    const valida = (s) => s && (s.tipo === "toma" ? tomasPlanas().some((x) => x.g === s.g && x.k === s.k) : s.tipo === "grupo" ? !!V().grupos[s.g] : !!(listaVista(s.tipo) || [])[s.i]);
    E.multi = E.multi.filter(valida);
    if (E.sel && !valida(E.sel)) E.sel = null;
  }
  function marcarGuardado(estado) {
    const g = $("#wd-guardado"); if (!g) return;
    if (estado === "guardando") { g.textContent = "Guardando…"; g.className = "wd-guardado"; return; }
    if (estado === "error") { g.textContent = "✖ No se guardó"; g.className = "wd-guardado err"; return; }
    E.guardado = new Date();
    g.textContent = `✓ Guardado ${E.guardado.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    g.className = "wd-guardado ok";
  }

  // Envía una operación (en cola, para que cada una parta del hash vigente).
  function hacer(op, opc = {}) {
    if (!E.plan) return Promise.resolve(false);
    if (E.bloqueado) { toast("La IA está trabajando en el video; espera a que termine."); return Promise.resolve(false); }
    const rizo = E.ripple || E.herramienta === "ripple";     // modo ripple o herramienta de rizo (B)
    if (op && rizo && /^toma_/.test(op.op || "")) op = { ...op, ripple: true };
    if (op && op.op === "lote" && rizo) op = { ...op, ops: op.ops.map((o) => /^toma_/.test(o.op) ? { ...o, ripple: true } : o) };
    E.cola = E.cola.then(async () => {
      const previo = { plan: E.plan, sel: E.sel };
      marcarGuardado("guardando");
      const r = opc.planEntero
        ? await pedir(`${pidURL()}/editor/plan`, { method: "PUT", json: { plan: opc.planEntero, base: E.hash, sesion: E.sesion, desc: opc.desc || "deshacer/rehacer" } })
        : await pedir(`${pidURL()}/editor/op`, { method: "POST", json: { op, base: E.hash, sesion: E.sesion } });
      if (r.status === 409 && r.d.conflicto) { toast("El video cambió fuera del editor; se recargó.", "info"); await cargar(true); E.undo = []; E.redo = []; marcarGuardado("ok"); return false; }
      if (!r.ok) { marcarGuardado("error"); toast(llano(r.d.detail || "No se pudo aplicar el cambio")); if (opc.alFallar) opc.alFallar(); renderTimeline(); return false; }
      if (!opc.sinHistorial) { E.undo.push(previo); if (E.undo.length > 150) E.undo.shift(); E.redo = []; }
      aplicarRespuesta(r.d);
      marcarGuardado("ok");
      const info = r.d.info || {};
      // perfil de estilo del usuario (estilo_panel.js): aprende de las ediciones a mano (no de deshacer/rehacer)
      if (op && window.WDVS && WDVS.estilo && WDVS.estilo.registrar) try { WDVS.estilo.registrar("edicion_manual", { op: op.op, desc: info.desc || op.op, lista: op.lista, props: op.props }); } catch { /* sin perfil */ }
      if (info.sel && !opc.mantenerSel) { E.sel = info.sel; E.multi = [info.sel]; }
      if (info.nuevos) E.multi = info.nuevos.i.map((i) => ({ tipo: info.nuevos.lista, i }));
      if (info.avisos && info.avisos.length) toast(info.avisos.map(llano).join("\n"), "info", 3500);
      window.dispatchEvent(new CustomEvent("wded:editado", { detail: { desc: info.desc || (op && op.op) || opc.desc || "cambio", op, previo } }));
      renderTimeline(); renderEstado(); actualizarVisor();
      if (ED.player) ED.player.planCambiado();
      if (opc.reInsp !== false) renderInspector();
      return true;
    }).catch((e) => { marcarGuardado("error"); toast(String(e)); return false; });
    return E.cola;
  }
  // la vista en vivo del texto que se estaba escribiendo deja de valer si el plan cambia por deshacer/rehacer o recarga
  function limpiarVivo() { if (E.vivo && E.vivo.url) URL.revokeObjectURL(E.vivo.url); E.vivo = null; E.borrador = null; }
  async function deshacer() {
    const u = E.undo.pop(); if (!u) return toast("Nada que deshacer", "info", 1500);
    limpiarVivo();
    const actualP = { plan: E.plan, sel: E.sel };
    const ok = await hacer(null, { planEntero: u.plan, desc: "deshacer", sinHistorial: true });
    if (ok) { E.redo.push(actualP); E.sel = u.sel; E.multi = u.sel ? [u.sel] : []; renderTodo(); } else E.undo.push(u);
  }
  async function rehacer() {
    const u = E.redo.pop(); if (!u) return toast("Nada que rehacer", "info", 1500);
    limpiarVivo();
    const actualP = { plan: E.plan, sel: E.sel };
    const ok = await hacer(null, { planEntero: u.plan, desc: "rehacer", sinHistorial: true });
    if (ok) { E.undo.push(actualP); E.sel = u.sel; E.multi = u.sel ? [u.sel] : []; renderTodo(); } else E.redo.push(u);
  }

  // ================================================================== utilidades del modelo
  const V = () => E.vista;
  function tomasPlanas() { return V().grupos.flatMap((g) => g.tomas); }
  function tomaCruda(g, k) {
    const x = V().grupos[g] && V().grupos[g].tomas[k]; if (!x) return null;
    const t = E.plan.timeline[g].tomas[x.ti];
    if (x.si === null || x.si === undefined) return t;
    const it = t.serie[x.si]; const [a, ini] = Array.isArray(it) ? it : [it.fuente, it.inicio];
    const c = { ...t }; delete c.serie; return { ...c, fuente: a, inicio: ini };
  }
  function listaCruda(nombre) {
    const p = E.plan;
    return { overlays: p.overlays, efectos: p.efectos, sfx: p.sfx, flashes: p.flashes, musica: (p.musica || {}).tramos, voz: (p.voz || {}).continua, clips: p.clips, marcadores: p.marcadores }[nombre] || [];
  }
  function listaVista(nombre) {
    const v = V(); if (!v) return [];
    return { overlays: v.overlays, efectos: v.efectos, sfx: v.sfx, flashes: v.flashes, musica: v.musica, voz: v.voz ? v.voz.continua : [], clips: v.clips || [], marcadores: v.marcadores || [] }[nombre];
  }
  function intervaloVista(tipo, it) {
    if (tipo === "overlays") return [it.t_in, it.t_out];
    if (tipo === "musica" || tipo === "voz") return [it.en, it.fin];
    if (tipo === "sfx") return [it.t, it.t + it.dur];
    if (tipo === "clips") return [it.a, it.b];
    if (tipo === "marcadores") return [it.t, it.t + (it.dur || 0)];
    return [it.desde, it.hasta];
  }
  function cortes() {
    const s = new Set([0, V().total]);
    for (const x of tomasPlanas()) { s.add(r3(x.t0)); s.add(r3(x.t0 + x.dur)); }
    return [...s].sort((a, b) => a - b);
  }
  const BASE = () => (E.cat && E.cat.base) || { estilos: {}, tipografias: {}, colores: {} };
  const estilosTodos = () => ({ ...BASE().estilos, ...(E.plan.estilos || {}) });
  const aliasDe = (tipo) => Object.entries(E.fuentes).filter(([, f]) => f.tipo === tipo).map(([a]) => a);
  function catEfecto(nombre) {
    if (!E.cat) return null;
    return E.cat.efectos.find((e) => e.nombre === nombre || (e.alias || []).includes(nombre))
      || (E.cat.presets.find((p) => p.nombre === nombre) ? { preset: true, ...E.cat.presets.find((p) => p.nombre === nombre) } : null);
  }
  function tomaEn(t) { return tomasPlanas().find((x) => t >= x.t0 - 1e-6 && t < x.t0 + x.dur - 1e-6) || null; }
  function hexDe(c) {
    if (!c) return "#ffffff";
    const cols = { blanco: "#FFFFFF", white: "#FFFFFF", negro: "#000000", black: "#000000", ...BASE().colores, ...Object.fromEntries(Object.entries(E.plan.colores || {}).map(([k, v]) => [k.toLowerCase(), v])) };
    const h = cols[String(c).toLowerCase()] || c;
    return /^#[0-9a-f]{6}$/i.test(h) ? h : "#ffffff";
  }

  // Keyframes: mismas curvas e interpolación que el motor (engine/plan.py: EASES, interpolar).
  const EASE = { lineal: (p) => p, entrada: (p) => p * p, salida: (p) => 1 - (1 - p) * (1 - p), suave: (p) => p * p * (3 - 2 * p), mantener: () => 0 };
  function interp(kfs, prop, t, def) {
    const ks = (kfs || []).filter((k) => k[prop] !== undefined && k[prop] !== null).sort((a, b) => a.t - b.t);
    if (!ks.length) return def;
    if (t <= ks[0].t) return ks[0][prop];
    const u = ks[ks.length - 1]; if (t >= u.t) return u[prop];
    for (let i = 0; i < ks.length - 1; i++) {
      const a = ks[i], b = ks[i + 1];
      if (t >= a.t && t < b.t) { const p = (t - a.t) / Math.max(1e-9, b.t - a.t); return a[prop] + (b[prop] - a[prop]) * (EASE[a.ease || "suave"] || EASE.suave)(p); }
    }
    return u[prop];
  }
  // Transformación de un overlay en el segundo local tl (keyframes + anim de entrada/salida como final.py).
  function tfOverlay(o, tl, conAnim = true) {
    const tf = o.tf || {}, kf = tf.keyframes || [];
    let esc_ = interp(kf, "escala", tl, tf.escala ?? 1), op = interp(kf, "opacidad", tl, tf.opacidad ?? 1);
    let dx = interp(kf, "dx", tl, 0);
    const dy = interp(kf, "dy", tl, 0), rot = interp(kf, "rotacion", tl, tf.rotacion ?? 0);
    if (conAnim) {
      const anim = o.anim || "fade", dur = o.t_out - o.t_in;
      if (anim !== "ninguna") {
        const fi = anim === "punch" || anim === "slam" ? 0.06 : 0.35, fo = anim === "fade" ? 0.35 : 0.12;
        if (["fade", "punch", "slam", "slide"].includes(anim) || o.letra) op *= clamp(tl / fi, 0, 1);
        op *= clamp((dur - tl) / fo, 0, 1);
      }
      if (anim === "punch") esc_ *= 1 + 0.45 * Math.pow(Math.max(0, 1 - tl / 0.14), 2);
      if (anim === "slam") esc_ *= 1 + 1.1 * Math.pow(Math.max(0, 1 - tl / 0.18), 3);
      if (anim === "slide") dx += 700 * V().W / 1920 * Math.pow(Math.max(0, 1 - tl / 0.25), 3);
    }
    return { escala: esc_, opacidad: op, dx, dy, rotacion: rot };
  }
  // Cámara de una toma en el segundo local tl: zoom (≥1) y paneo (−1..1), como video.py.
  function camToma(x, tl) {
    const [z0, z1, px, py] = x.cam || [1, 1, [0, 0], [0, 0]];
    const d = Math.max(1e-6, x.dur), p = clamp(tl / d, 0, 1), eo = 1 - (1 - p) * (1 - p);
    const kf = x.keyframes || [];
    return { z: Math.max(1, interp(kf, "zoom", tl, z0 + (z1 - z0) * eo)), px: interp(kf, "pan_x", tl, px[0] + (px[1] - px[0]) * p), py: interp(kf, "pan_y", tl, py[0] + (py[1] - py[0]) * p) };
  }
  function tieneFx(x) { return !!(x && ((x.efectos && x.efectos.length) || x.fx_grupo)) || V().efectos.some((e) => E.t >= e.desde && E.t < e.hasta); }

  // ================================================================== render general
  function renderTodo() {
    if (!E.plan) return;
    renderTimeline(); renderInspector(); renderBiblio(); renderEstado(); dimensionarVisor(); actualizarVisor(true);
    const pn = $("#wd-proy"); if (pn) pn.textContent = E.plan.titulo || E.pid;
  }
  function renderEstado() {
    const est = $("#ed-estado"); if (!est) return;
    if (!E.plan) { est.textContent = ""; return; }
    const errs = E.errores.length ? `<span class="chip err" title="${esc(E.errores.map(llano).join("\n"))}">${ico("triangle-alert", 12)} ${E.errores.length} problema(s)</span>` : "";
    est.innerHTML = `${errs}<span class="num">${fmt(V().total)}</span><span class="muy-tenue">·</span><span>${tomasPlanas().length} clips</span>${E.bloqueado ? `<span class="chip ac"><span class="giro"></span> La IA está trabajando…</span>` : ""}`;
    const vb = $("#vb-info"); if (vb) vb.textContent = `${V().W}×${V().H} · ${V().fps} fps`;
    $("#ed-deshacer").disabled = !E.undo.length; $("#ed-rehacer").disabled = !E.redo.length;
    $("#ed-tiempo").textContent = timecode(E.t, V().fps);
    $("#ed-rango-txt").textContent = E.rango ? `${fmt(E.rango[0])}–${fmt(E.rango[1])}` : (E.marcaIn !== null ? `desde ${fmt(E.marcaIn)}` : "");
    const x = tomaEn(E.t), fx = tieneFx(x);
    $("#ed-fx").hidden = !fx; $("#ed-ver-fx").hidden = !fx;
  }
  function renderInspector() { if (ED.renderInspector) ED.renderInspector(); }

  // ================================================================== línea de tiempo
  const xDe = (t) => CAB + t * E.pps;
  const tDe = (x) => (x - CAB) / E.pps;
  function ajustarZoom() {
    const w = ($("#tl-scroll").clientWidth || 1000) - CAB - 30;
    E.pps = clamp(w / Math.max(1, V().total), 2, 400);
    E.zoomAjustado = true;
  }
  // deslizador de zoom (escala logarítmica entre el zoom mínimo y el máximo)
  const zoomLim = () => [Math.max(1, Math.min(2, (($("#tl-scroll").clientWidth || 1000) - CAB - 30) / Math.max(1, V().total))), Math.min(600, 60000 / Math.max(1, V().total))];
  function sincZoom() {
    const r = $("#ed-zoom-rango"); if (!r || !E.plan) return;
    const [a, b] = zoomLim();
    r.value = Math.round(100 * clamp(Math.log(E.pps / a) / Math.log(b / a || 2), 0, 1));
    if (window.WDVS && WDVS.pintarRango) WDVS.pintarRango(r);
  }
  function zoom(f, tCentro) {
    const sc = $("#tl-scroll");
    const tc = tCentro ?? tDe(sc.scrollLeft + sc.clientWidth / 2);
    const xVent = xDe(tc) - sc.scrollLeft;
    E.pps = clamp(E.pps * f, 2, Math.min(600, 60000 / Math.max(1, V().total)));
    E.zoomAjustado = false;
    renderTimeline();
    sc.scrollLeft = xDe(tc) - xVent;
  }
  function zoomSeleccion() {
    const iv = E.multi.map(intervaloSel).filter(Boolean);
    if (!iv.length) return;
    const a = Math.min(...iv.map((x) => x[0])), b = Math.max(...iv.map((x) => x[1]));
    const sc = $("#tl-scroll");
    E.pps = clamp((sc.clientWidth - CAB - 60) / Math.max(0.2, b - a), 2, 600);
    renderTimeline();
    sc.scrollLeft = a * E.pps - 30;
  }
  function intervaloSel(s) {
    if (!s) return null;
    if (s.tipo === "toma") { const x = tomasPlanas().find((y) => y.g === s.g && y.k === s.k); return x && [x.t0, x.t0 + x.dur]; }
    if (s.tipo === "grupo") { const g = V().grupos[s.g]; return g && [g.t0, g.t0 + g.dur]; }
    const it = (listaVista(s.tipo) || [])[s.i]; return it && intervaloVista(s.tipo, it);
  }
  function carriles(items) {
    const fin = []; const out = new Map();
    for (const it of [...items].sort((a, b) => a.a - b.a)) {
      let c = fin.findIndex((f) => f <= it.a + 1e-6);
      if (c < 0) { c = fin.length; fin.push(0); }
      fin[c] = it.b; out.set(it, c);
    }
    return { n: Math.max(1, fin.length), de: out };
  }
  const pistaAudio = (p) => ["musica", "sfx", "voz", "audio"].includes(p);
  // Altura de una pista: base × altura propia (asa de la cabecera) × altura global (S/M/L de la barra).
  const altoDe = (clave, base) => Math.round(base * (E.altos[clave] || 1) * (E.altoGlobal || 1));
  // Cabecera de pista: nombre, candado, ojo (visuales) o silencio/solo (audio) y asa para cambiar la altura.
  function fila(pista, titulo, sub, alto, ancho, clave = pista, color = "", dest = null) {
    const car = el("div", { class: "tl-carril", style: { width: ancho + "px", height: alto + "px" } });
    const cab = el("div", { class: "tl-cab", style: { height: alto + "px" } }, color ? el("span", { class: "tl-color", style: { background: `var(--clip-${color})` } }) : null,
      el("div", { class: "nom" }, el("b", {}, titulo), sub ? el("span", {}, sub) : null));
    if (dest) {   // focalización de pista (track targeting): destino de insertar/sobrescribir y de pegar
      const on = dest.tipo === "v" ? E.destV === dest.n : E.destA === dest.n;
      const b = el("button", { class: "tl-dest" + (on ? " on" : ""), title: `${on ? "Pista de destino" : "Usar como pista de destino"} para insertar y sobrescribir desde el origen (${dest.tipo === "v" ? "video" : "audio"})`, "aria-pressed": String(on), "aria-label": `Destino ${titulo}` }, dest.tipo === "v" ? "V" : "A");
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      b.onclick = (e) => { e.stopPropagation(); if (dest.tipo === "v") E.destV = on ? null : dest.n; else E.destA = on ? null : dest.n; guardarPistas(); renderTimeline(); };
      cab.prepend(b);
    }
    const btns = el("div", { class: "msb" });
    const boton = (cls, on, tit, icono, fn) => {
      const b = el("button", { class: "ms " + cls + (on ? " on" : ""), title: tit, "aria-label": tit, "aria-pressed": on ? "true" : "false", html: ico(icono, 12) });
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      b.onclick = (e) => { e.stopPropagation(); fn(); guardarPistas(); renderTimeline(); };
      btns.append(b);
    };
    if (pista !== "regla") {
      boton("candado", E.bloq[clave], E.bloq[clave] ? "Pista bloqueada: no se puede mover ni recortar (clic para desbloquear)" : "Bloquear la pista", E.bloq[clave] ? "lock" : "lock-open", () => { E.bloq[clave] = !E.bloq[clave]; });
      if (pistaAudio(pista)) {
        boton("mute", E.mute[clave], E.mute[clave] ? "Pista silenciada al editar (clic para oír)" : "Silenciar esta pista mientras editas (no afecta el render)", E.mute[clave] ? "volume-x" : "volume-2", () => { E.mute[clave] = !E.mute[clave]; guardarMezcla(); });
        boton("solo solo-avanzado", E.solo === clave, "Escuchar solo esta pista", "headphones", () => { E.solo = E.solo === clave ? null : clave; guardarMezcla(); });
        if (pista === "audio" && ED.pro) boton("mic", false, "Grabar voz en off en esta pista desde el cabezal", "mic", () => ED.pro.grabarVoz(Number(clave.slice(1))));
        cab.append(el("span", { class: "tl-vu", "data-vu": clave, "aria-hidden": "true" }, el("i")));
      } else if (pista === "video" || pista === "overlays") {
        boton("ojo", E.oculto[clave], E.oculto[clave] ? "Pista oculta en el visor (clic para mostrar; no afecta el render)" : "Ocultar en el visor mientras editas (no afecta el render)", E.oculto[clave] ? "eye-off" : "eye", () => { E.oculto[clave] = !E.oculto[clave]; aplicarOcultos(); });
      }
      cab.append(btns);
      const asa = el("div", { class: "tl-cab-asa", title: "Arrastra para cambiar la altura de la pista (doble clic: normal)" });
      asa.addEventListener("pointerdown", (e) => {
        e.stopPropagation(); e.preventDefault(); asa.setPointerCapture(e.pointerId);
        const y0 = e.clientY, f0 = E.altos[clave] || 1, h0 = alto;
        const mover = (ev) => { const f = clamp(f0 * (h0 + ev.clientY - y0) / h0, 0.6, 3); E.altos[clave] = Math.round(f * 100) / 100; cab.style.height = car.style.height = Math.round(h0 * f / f0) + "px"; };
        const soltar = () => { asa.removeEventListener("pointermove", mover); asa.removeEventListener("pointerup", soltar); guardarPistas(); renderTimeline(); };
        asa.addEventListener("pointermove", mover); asa.addEventListener("pointerup", soltar);
      });
      asa.addEventListener("dblclick", (e) => { e.stopPropagation(); delete E.altos[clave]; guardarPistas(); renderTimeline(); });
      cab.append(asa);
    }
    const apagada = pistaAudio(pista) && (E.mute[clave] || (E.solo && E.solo !== clave));
    const f = el("div", { class: "tl-fila" + (apagada ? " apagada" : "") + (E.bloq[clave] ? " bloqueada" : "") + (E.oculto[clave] ? " oculta" : ""), "data-pista": pista, "data-clave": clave }, cab, car);
    return { f, car };
  }
  function guardarMezcla() { lsSet("wded_mezcla_" + E.pid, { mute: E.mute, solo: E.solo }); if (ED.player) ED.player.mezcla(); }
  function guardarPistas() { lsSet("wded_pistas_" + E.pid, { bloq: E.bloq, oculto: E.oculto, altos: E.altos, destV: E.destV, destA: E.destA }); }
  const filaBloqueada = (obj) => { const f = obj && obj.closest(".tl-fila"); return !!(f && E.bloq[f.dataset.clave]); };
  // ocultar pistas en el visor (solo al editar): V1 oculta la imagen de video; V2, V3… ocultan sus capas
  function aplicarOcultos() { const v = $("#visor"); if (v) v.classList.toggle("sin-v1", !!E.oculto.video); colocarOverlays(); }
  let ventana = [0, 0];
  function enVentana(a, b) { return b >= ventana[0] && a <= ventana[1]; }
  function clip(car, cls, a, b, top, alto, texto, datosClip, titulo) {
    if (!enVentana(a, b)) return null;
    const w = Math.max(3, (b - a) * E.pps);
    const c = el("div", { class: "clip " + cls + (esSel(datosClip) ? " sel" : ""), title: titulo || texto, style: { left: (a * E.pps) + "px", width: w + "px", top: top + "px", height: alto ? alto + "px" : undefined } },
      el("span", { class: "t" }, texto), el("div", { class: "asa i" }), el("div", { class: "asa f" }));
    c._d = datosClip;
    car.append(c);
    return c;
  }
  const claveSel = (d) => d.tipo === "toma" ? `toma:${d.g}:${d.k}` : d.tipo === "grupo" ? `grupo:${d.g}` : `${d.tipo}:${d.i}`;
  function esSel(d) { if (!d) return false; const k = claveSel(d); return E.multi.some((s) => claveSel(s) === k); }
  function rombos(c, kfs, dur, t0) {
    if (!c || !kfs || !kfs.length) return;
    for (const k of kfs) {
      if (k.t < -1e-6 || k.t > dur + 1e-6) continue;
      const r = el("span", { class: "rombo", title: `Fotograma clave en ${fmt(t0 + k.t)}`, style: { left: (k.t * E.pps - 4) + "px" } });
      r._t = t0 + k.t; c.append(r);
    }
  }

  function renderTimeline() {
    if (!E.plan || !E.abierto) return;
    const v = V(), cont = $("#tl-cont"), sc = $("#tl-scroll");
    const scroll = sc.scrollLeft;
    const ancho = Math.ceil(v.total * E.pps) + 300;
    const vis = (sc.clientWidth || 1200) / E.pps;
    const t0v = Math.max(0, (scroll - CAB) / E.pps);
    ventana = [t0v - vis, t0v + 2 * vis];
    cont.innerHTML = "";
    cont.style.width = (CAB + ancho) + "px";
    const R = fila("regla", "", "", ALTO.regla, ancho);
    R.f.classList.add("tl-regla");
    const cv = el("canvas", { height: ALTO.regla });
    cv.style.position = "absolute"; cv.style.top = "0";
    R.car.append(cv);
    R.f.querySelector(".tl-cab").innerHTML = `<span class="tl-tc num" id="tl-tc">${timecode(E.t, v.fps)}</span>${v.bpm ? `<span class="muy-tenue solo-avanzado" title="Pulsos por minuto de la música">${v.bpm} bpm</span>` : ""}`;
    cont.append(R.f);

    // capas de texto e imágenes (V2, V3…): una fila por pista, arriba la más alta (+ una vacía para capa nueva)
    const ovs = v.overlays.map((o) => ({ ...o, a: o.t_in, b: o.t_out }));
    const cvs = (v.clips || []).filter((c) => c.visual).map((c) => ({ ...c, esClip: true }));
    const maxP = Math.max(1, ...ovs.map((o) => o.pista || 1), ...cvs.map((c) => c.pista || 1));
    for (let p = maxP + 1; p >= 1; p--) {
      const de = ovs.filter((o) => (o.pista || 1) === p);
      const dc = cvs.filter((c) => c.pista === p);
      const L = carriles([...de, ...dc]);
      const hL = altoDe("capa" + p, dc.length ? 30 : ALTO.carril);
      const F = fila("overlays", `V${p + 1}`, p === maxP + 1 ? "capa nueva" : dc.length ? "video" : (p === 1 ? "textos" : de.length && de.every((o) => o.tipo === "escena") ? "animación" : "capa"), ((de.length || dc.length) ? L.n : 1) * hL + 6, ancho, "capa" + p, dc.length ? "video" : "texto", { tipo: "v", n: p });
      F.f.dataset.capa = p;
      for (const c of dc) if (ED.pro) ED.pro.dibujarClip(F.car, c, 3 + L.de.get(c) * hL, hL - 3, clip);
      for (const o of de) {
        const nom = o.tipo === "resplandor" ? "Resplandor" : String(o.etiqueta || "").replace(/^[\p{Extended_Pictographic}✨☀-➿️\s]+/u, "");
        const c = clip(F.car, `overlays ${o.tipo}`, o.a, o.b, 3 + L.de.get(o) * hL, hL - 3, nom,
          { tipo: "overlays", i: o.i, a: o.a, b: o.b }, o.tipo === "escena" ? `Animación: ${nom}\n${fmt(o.a)} – ${fmt(o.b)}` : `${o.tipo === "texto" ? "Texto" : o.tipo === "imagen" ? "Imagen" : "Resplandor"}: ${nom}\n${fmt(o.a)} – ${fmt(o.b)} · ${humano(o.anim)}`);
        rombos(c, o.keyframes, o.b - o.a, o.a);
      }
      cont.append(F.f);
    }
    // video (V1)
    const hV = altoDe("video", ALTO.video), hClipV = hV - 16;
    const Fv = fila("video", "V1", "video", hV, ancho, "video", "video", { tipo: "v", n: 0 });
    for (const g of v.grupos) {
      if (!enVentana(g.t0, g.t0 + g.dur)) continue;
      const nombreG = g.etiqueta || `Escena ${g.g + 1}`;
      const b = el("div", { class: "grupo-banda" + (esSel({ tipo: "grupo", g: g.g }) ? " sel" : ""), title: `${nombreG} (${g.dur.toFixed(2)} s)${g.efectos.length ? "\nefectos: " + g.efectos.map(humano).join(", ") : ""}`,
        style: { left: (g.t0 * E.pps) + "px", width: Math.max(4, g.dur * E.pps - 2) + "px" } }, `${nombreG}${g.efectos.length ? " · fx" : ""}`);
      b._d = { tipo: "grupo", g: g.g };
      Fv.car.append(b);
      for (const x of g.tomas) {
        const txt = x.negro ? "Negro" : nombreFuente(x.fuente);
        const c = clip(Fv.car, "toma" + (x.negro ? " negro" : ""), x.t0, x.t0 + x.dur, 14, hClipV, txt,
          { tipo: "toma", g: x.g, k: x.k, a: x.t0, b: x.t0 + x.dur }, `${txt} · ${x.dur.toFixed(2)} s${x.efectos.length ? "\nefectos: " + x.efectos.map(humano).join(", ") : ""}`);
        if (!c) continue;
        if (!x.negro && x.fuente && x.dur * E.pps > 26 && E.fuentes[x.fuente] && E.fuentes[x.fuente].existe) {
          c.prepend(el("img", { loading: "lazy", draggable: "false", src: `media/poster.jpg` }));
        }
        const vel = x.rampa ? `${x.rampa.v1}→${x.rampa.v2}x` : (x.velocidad !== 1 ? `${x.velocidad}x` : "");
        if (vel && x.dur * E.pps > 34) c.append(el("span", { class: "vel" }, vel));
        if ((x.efectos.length || x.fx_grupo) && x.dur * E.pps > 20) c.append(el("span", { class: "fxb" }, "fx"));
        rombos(c, x.keyframes, x.dur, x.t0);
      }
      if (g.transicion) {
        const w = Math.max(8, g.transicion.dur * E.pps);
        const tr = el("div", { class: "trans", title: `Transición: ${humano(g.transicion.tipo)} (${g.transicion.dur} s)`, style: { left: (g.t0 * E.pps - w / 2) + "px", width: w + "px", height: hClipV + "px" } });
        tr._d = { tipo: "grupo", g: g.g, trans: true };
        Fv.car.append(tr);
      }
    }
    cont.append(Fv.f);
    // efectos globales + destellos
    const efs = v.efectos.map((e) => ({ ...e, a: e.desde, b: Math.max(e.hasta, e.desde + 0.1), lista: "efectos" }))
      .concat(v.flashes.map((f) => ({ ...f, a: f.desde, b: Math.max(f.hasta, f.desde + 0.1), lista: "flashes" })));
    const Le = carriles(efs);
    const hE = altoDe("efectos", ALTO.carril);
    const Fe = fila("efectos", "Efectos", "", Le.n * hE + 6, ancho, "efectos", "efecto");
    for (const e of efs) {
      const flash = e.lista === "flashes";
      clip(Fe.car, `${e.lista}${e.preset ? " preset" : ""}`, e.a, e.b, 3 + Le.de.get(e) * hE, flash ? Math.min(16, hE - 3) : hE - 3,
        flash ? (e.serie ? `destellos` : "") : `${humano(e.nombre)}${e.todo ? " (todo)" : ""}`, { tipo: e.lista, i: e.i, a: e.a, b: e.b },
        flash ? "Destello" : `${humano(e.nombre)}: ${fmt(e.a)} – ${fmt(e.b)}`);
    }
    cont.append(Fe.f);
    // música
    const hM = altoDe("musica", ALTO.musica);
    const Fm = fila("musica", "Música", "", hM, ancho, "musica", "musica");
    for (const m of v.musica) {
      const c = clip(Fm.car, "musica audio", m.en, m.fin, 3, hM - 6, `${m.etiqueta || nombreFuente(m.fuente)}`,
        { tipo: "musica", i: m.i, a: m.en, b: m.fin }, `Música: ${nombreFuente(m.fuente)} · ${fmt(m.en)} – ${fmt(m.fin)}\nvolumen ${Math.round((m.vol ?? 1) * 100)}%`);
      if (c) { dibujarOnda(c, m, hM - 6); controlesAudio(c, m.vol ?? 1, m.fade_in, m.fade_out, hM - 6, m.fin - m.en); }
    }
    cont.append(Fm.f);
    // sonidos (sfx)
    const sfx = v.sfx.map((s) => ({ ...s, a: s.t, b: s.t + s.dur }));
    const Ls = carriles(sfx);
    const hS = altoDe("sfx", ALTO.carril);
    const Fs = fila("sfx", "Sonidos", "", Ls.n * hS + 6, ancho, "sfx", "sfx");
    for (const s of sfx) {
      const nomS = s.nombre || humano(s.tipo);
      const c = clip(Fs.car, "sfx audio", s.a, s.b, 3 + Ls.de.get(s) * hS, hS - 3, nomS, { tipo: "sfx", i: s.i, a: s.a, b: s.b }, `Sonido: ${nomS} · volumen ${Math.round(s.volumen * 100)}%`);
      if (c) controlesAudio(c, s.volumen, null, null, hS - 3, s.dur);
    }
    cont.append(Fs.f);
    // voz
    const hZ = altoDe("voz", ALTO.voz);
    const Fz = fila("voz", "Voz", v.voz ? "" : "sin voz", hZ, ancho, "voz", "voz");
    if (v.voz) {
      for (const c0 of v.voz.continua) {
        const tts = (((E.plan.voz || {}).continua || [])[c0.i] || {})._tts;   // locución del módulo de voces (docs/voces.md §6)
        const esIA = !!(tts && (tts.sintetica || tts.clonada));
        const c = clip(Fz.car, "voz audio" + (esIA ? " voz-ia" : ""), c0.en, c0.fin, 3, hZ - 6, esIA ? `voz IA${tts.clonada ? " (clonada)" : ""} · ${String(tts.texto || "").slice(0, 40)}` : `Voz en off`, { tipo: "voz", i: c0.i, a: c0.en, b: c0.fin });
        if (c && esIA) c.append(el("span", { class: "etq-voz-ia", title: tts.clonada ? "Voz clonada con IA" : "Voz generada con IA" }, "voz IA"));
        if (c) controlesAudio(c, c0.volumen ?? 1, c0.fundido, c0.fundido, hZ - 6, c0.fin - c0.en);
      }
      if (v.voz.sincronizada) for (const x of tomasPlanas()) if (x.voz && enVentana(x.t0, x.t0 + x.dur)) Fz.car.append(el("div", { class: "voz-sinc", style: { left: (x.t0 * E.pps) + "px", width: Math.max(1, x.dur * E.pps - 1) + "px" } }));
    }
    cont.append(Fz.f);
    // pistas de audio libres A1, A2… (+ una vacía para soltar o grabar)
    const cas = (v.clips || []).filter((c) => c.audio);
    const maxA = Math.max(1, ...cas.map((c) => c.pista));
    for (let p = 1; p <= maxA + (cas.length ? 1 : 0); p++) {
      const da = cas.filter((c) => c.pista === p);
      const La = carriles(da);
      const hA = altoDe("a" + p, ALTO.musica);
      const Fa = fila("audio", `A${p}`, da.length ? "" : (p === 1 ? "suelta o graba audio" : "pista nueva"), (da.length ? La.n : 1) * hA, ancho, "a" + p, "voz", { tipo: "a", n: p });
      Fa.f.dataset.apista = p;
      for (const c of da) if (ED.pro) ED.pro.dibujarClip(Fa.car, c, 3 + La.de.get(c) * hA, hA - 6, clip);
      cont.append(Fa.f);
    }
    for (const [t, compas] of v.beats) if (compas && t >= ventana[0] && t <= ventana[1] && E.pps * (v.spb || 0.5) * (v.bpc || 4) > 12) cont.append(el("div", { class: "tl-beat", style: { left: xDe(t) + "px" } }));
    if (E.rango) cont.append(el("div", { class: "tl-rango", style: { left: xDe(E.rango[0]) + "px", width: ((E.rango[1] - E.rango[0]) * E.pps) + "px" } }));
    for (const m of marcas()) cont.append(el("div", { class: "tl-marca", title: m.nombre || "", style: { left: xDe(m.t) + "px", background: m.color || "#3ecf8e" } }));
    cont.append(el("div", { class: "tl-cabezal", id: "tl-cabezal", style: { left: xDe(E.t) + "px" } }));
    sc.scrollLeft = scroll;
    dibujarRegla(); sincZoom();
    for (const f of cont.querySelectorAll(".tl-fila[data-pista]")) {
      f.addEventListener("dragover", (e) => { e.preventDefault(); f.classList.add("drop"); });
      f.addEventListener("dragleave", () => f.classList.remove("drop"));
      f.addEventListener("drop", (e) => { e.preventDefault(); f.classList.remove("drop"); soltarBiblio(e, f.dataset.pista, f.dataset.capa, f.dataset.apista); });
    }
    if (ED.pro) ED.pro.trasTimeline();
    for (const f of ED.ganchosTimeline || []) try { f(); } catch (err) { console.error(err); }
  }
  // Línea de volumen (arrastrable en vertical) y asas de fundido.
  function controlesAudio(c, vol, fi, fo, h, dur) {
    const y = clamp((1 - vol / 2) * h, 0, h - 1);
    c.append(el("div", { class: "vol-linea", style: { top: y + "px" }, title: `Volumen ${Math.round(vol * 100)}% (arrastra arriba/abajo)` }));
    if (fi !== null && fi !== undefined) {
      const wi = clamp(fi * E.pps, 0, dur * E.pps), wo = clamp(fo * E.pps, 0, dur * E.pps);
      if (wi > 1) c.append(el("div", { class: "fade-zona i", style: { width: wi + "px" } }));
      if (wo > 1) c.append(el("div", { class: "fade-zona f", style: { width: wo + "px" } }));
      c.append(el("div", { class: "fade-asa i", style: { left: Math.max(0, wi - 5) + "px" }, title: `Fundido de entrada ${(+fi).toFixed(2)} s (arrastra)` }));
      c.append(el("div", { class: "fade-asa f", style: { right: Math.max(0, wo - 5) + "px" }, title: `Fundido de salida ${(+fo).toFixed(2)} s (arrastra)` }));
    }
  }
  function dibujarRegla() {
    const cv = $("#tl-cont canvas"); if (!cv || !E.plan) return;
    const sc = $("#tl-scroll");
    const w = sc.clientWidth - CAB;
    const x0 = sc.scrollLeft;
    cv.width = Math.max(10, w); cv.style.left = x0 + "px";
    const c = cv.getContext("2d"), v = V();
    c.fillStyle = "#16171A"; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = "#2A2C31"; c.fillRect(0, cv.height - 1, cv.width, 1);
    const pasos = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
    const paso = pasos.find((p) => p * E.pps >= 70) || 120;
    const t0 = x0 / E.pps, t1 = (x0 + w) / E.pps;
    for (const [t, compas] of v.beats) {
      if (t < t0 || t > t1) continue;
      const x = t * E.pps - x0;
      c.fillStyle = compas ? "#b89a2e" : "#4a4a4a";
      c.fillRect(Math.round(x), compas ? 14 : 19, 1, compas ? 10 : 5);
    }
    c.font = "500 10.5px 'Inter var', 'Segoe UI', sans-serif";
    const sub = paso / 5;
    c.fillStyle = "#3E4148";
    for (let t = Math.floor(t0 / sub) * sub; t <= t1; t += sub) c.fillRect(Math.round(t * E.pps - x0), cv.height - 5, 1, 4);
    for (let t = Math.floor(t0 / paso) * paso; t <= t1; t += paso) {
      const x = t * E.pps - x0;
      c.fillStyle = "#5B5F68"; c.fillRect(Math.round(x), cv.height - 10, 1, 9);
      c.fillStyle = "#A9ACB4"; c.fillText(fmt(t).replace(/\.00$/, ""), x + 4, 11);
    }
    const aw = v.area_trabajo;
    if (aw && aw.hasta > aw.desde) { c.fillStyle = "rgba(169,172,180,.55)"; c.fillRect(aw.desde * E.pps - x0, 0, (aw.hasta - aw.desde) * E.pps, 5); c.fillStyle = "#ECEDEF"; c.fillRect(aw.desde * E.pps - x0 - 1, 0, 3, 7); c.fillRect(aw.hasta * E.pps - x0 - 2, 0, 3, 7); }
    for (const m of marcas()) {
      const x = m.t * E.pps - x0; c.fillStyle = m.color || "#3ecf8e";
      if (m.dur) { c.globalAlpha = 0.35; c.fillRect(x, 10, m.dur * E.pps, 8); c.globalAlpha = 1; }
      c.beginPath(); c.moveTo(x - 5, 9); c.lineTo(x + 5, 9); c.lineTo(x + 5, 14); c.lineTo(x, 19); c.lineTo(x - 5, 14); c.fill();
      if (m.nombre && E.pps * 2 > 40) { c.fillStyle = "#ECEDEF"; c.font = "500 10px 'Inter var', 'Segoe UI', sans-serif"; c.fillText(m.nombre.slice(0, 24), x + 7, 18); }
    }
    if (E.rango) { c.fillStyle = "rgba(76,141,255,.55)"; c.fillRect(E.rango[0] * E.pps - x0, 20, (E.rango[1] - E.rango[0]) * E.pps, 4); }
    c.fillStyle = "#444"; c.fillRect(v.total * E.pps - x0, 0, 2, cv.height);
  }
  async function dibujarOnda(c, m, hOnda) {
    if (!m.fuente || !E.fuentes[m.fuente] || !E.fuentes[m.fuente].existe) return;
    const key = m.fuente;
    if (!E.ondas[key]) E.ondas[key] = pedir(`${pidURL()}/editor/onda?fuente=${encodeURIComponent(key)}&por_s=100`).then((r) => r.ok ? r.d : null);
    const d = await E.ondas[key]; if (!d || !c.isConnected) return;
    const cv = el("canvas"); c.prepend(cv);
    const w = Math.max(2, Math.min(8000, Math.round((m.fin - m.en) * E.pps))), h = hOnda || ALTO.musica - 6;
    cv.width = w; cv.height = h;
    const g = cv.getContext("2d"); g.fillStyle = "rgba(190,245,215,.42)";
    const n = d.picos.length, a = m.a * d.por_s, b = m.b * d.por_s, vol = Math.min(2, m.vol ?? 1);
    for (let x = 0; x < w; x++) {
      const i0 = Math.floor(a + (b - a) * x / w), i1 = Math.max(i0 + 1, Math.floor(a + (b - a) * (x + 1) / w));
      let p = 0, s = 0, k = 0; for (let i = i0; i < i1 && i < n; i++) { const q = d.picos[i] || 0; p = Math.max(p, q); s += q; k++; }
      const y = Math.min(h / 2 - 1, p * vol * (h / 2 - 2)), ym = Math.min(y, (k ? s / k : 0) * vol * (h / 2 - 2));
      g.globalAlpha = 0.45; g.fillRect(x, h / 2 - y, 1, Math.max(1, 2 * y));
      g.globalAlpha = 1; g.fillRect(x, h / 2 - ym, 1, Math.max(1, 2 * ym));
    }
  }

  // ----------------------------------------------------------------- cabezal
  function ponerT(t, opc = {}) {
    if (!E.plan) return;
    E.t = clamp(t, 0, V().total);
    const c = $("#tl-cabezal"); if (c) c.style.left = xDe(E.t) + "px";
    const tc = $("#ed-tiempo"); if (tc) tc.textContent = timecode(E.t, V().fps);
    const tt = $("#tl-tc"); if (tt) tt.textContent = tc ? tc.textContent : timecode(E.t, V().fps);
    if (opc.seguir) {
      const sc = $("#tl-scroll"), x = xDe(E.t);
      if (x < sc.scrollLeft + CAB || x > sc.scrollLeft + sc.clientWidth - 40) sc.scrollLeft = x - CAB - 60;
    }
    if (!opc.sinVisor) { actualizarVisor(); const x = tomaEn(E.t), fx = tieneFx(x); $("#ed-fx").hidden = !fx; $("#ed-ver-fx").hidden = !fx; }
  }

  // ----------------------------------------------------------------- imán
  let puntosIman = [];
  function prepararIman(excluir) {
    const pts = new Set(cortes());
    pts.add(r3(E.t));
    for (const o of V().overlays) { pts.add(o.t_in); pts.add(o.t_out); }
    for (const m of V().musica) { pts.add(m.en); pts.add(m.fin); }
    for (const m of marcas()) pts.add(m.t);
    for (const c of V().clips || []) { pts.add(c.a); pts.add(c.b); }
    if (E.iman) for (const [t] of V().beats) pts.add(t);
    if (excluir) for (const x of excluir) pts.delete(r3(x));
    puntosIman = [...pts];
  }
  function iman(t, e) {
    quitarGuiaIman();
    if (!E.iman || (e && e.altKey)) return t;
    const lim = IMAN_PX / E.pps;
    let mejor = null, dm = lim;
    for (const p of puntosIman) { const d = Math.abs(p - t); if (d < dm) { dm = d; mejor = p; } }
    if (mejor === null) return t;
    $("#tl-cont").append(el("div", { class: "tl-iman", id: "tl-iman", style: { left: xDe(mejor) + "px" } }));
    return mejor;
  }
  function quitarGuiaIman() { const g = $("#tl-iman"); if (g) g.remove(); }

  // ----------------------------------------------------------------- selección
  function seleccionar(d, modo) {    // modo: "solo" | "alternar"
    const s = d.trans ? { tipo: "grupo", g: d.g, trans: true } : { tipo: d.tipo, g: d.g, k: d.k, i: d.i };
    if (modo === "alternar") {
      const k = claveSel(s);
      if (E.multi.some((x) => claveSel(x) === k)) { E.multi = E.multi.filter((x) => claveSel(x) !== k); E.sel = E.multi[E.multi.length - 1] || null; }
      else { E.multi.push(s); E.sel = s; }
    } else { E.multi = [s]; E.sel = s; }
    E.borrador = null; E.vivo = null;
    for (const c of $$("#tl-cont .clip, #tl-cont .grupo-banda")) c.classList.toggle("sel", esSel(c._d));
    renderInspector(); actualizarVisor(true);
  }

  // ----------------------------------------------------------------- arrastres en la línea de tiempo
  let arr = null;
  function enlazarTimeline() {
    const sc = $("#tl-scroll"), cont = $("#tl-cont");
    let rafScroll = 0;
    sc.addEventListener("scroll", () => {
      dibujarRegla();
      if (!E.plan || arr) return;
      const vis = sc.clientWidth / E.pps, t0v = Math.max(0, (sc.scrollLeft - CAB) / E.pps);
      if (t0v < ventana[0] + vis * 0.2 && ventana[0] > 0 || t0v + vis > ventana[1] - vis * 0.2) {
        cancelAnimationFrame(rafScroll); rafScroll = requestAnimationFrame(() => renderTimeline());
      }
    });
    sc.addEventListener("wheel", (e) => {
      if (!E.plan) return;
      if (e.ctrlKey) { e.preventDefault(); const r = cont.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.25 : 0.8, tDe(e.clientX - r.left)); }
      else if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); sc.scrollLeft += e.deltaY; }
    }, { passive: false });
    cont.addEventListener("contextmenu", (e) => {
      if (!E.plan) return;
      const obj = e.target.closest(".clip, .grupo-banda");
      e.preventDefault();
      if (obj && obj._d && !esSel(obj._d)) seleccionar(obj._d, "solo");
      menuContextual(e.clientX, e.clientY, obj && obj._d);
    });
    cont.addEventListener("pointerdown", (e) => {
      if (!E.plan || e.button !== 0) return;
      const r = cont.getBoundingClientRect();
      const x = e.clientX - r.left, t = tDe(x);
      if (e.target.classList.contains("rombo")) { ponerT(e.target._t, { seguir: true }); return; }
      const regla = e.target.closest(".tl-regla");
      if (regla) {
        if (ED.pro && ED.pro.reglaDown(e, t, regla)) return;
        const m = marcas().find((mm) => Math.abs(mm.t - t) * E.pps < 6);
        if (m && !e.shiftKey) { ponerT(m.t); if (e.detail >= 2 && ED.pro) ED.pro.editarMarcador(m, e.clientX, e.clientY); return; }
        arr = e.shiftKey ? { modo: "rango", t0: clamp(t, 0, V().total) } : { modo: "cabezal" };
        if (!e.shiftKey) { if (ED.player) ED.player.scrub(true); ponerT(t); }
        cont.setPointerCapture(e.pointerId);
        return;
      }
      const obj = e.target.closest(".clip, .grupo-banda, .trans");
      if (ED.pro && ED.pro.tlDown(e, obj, obj && obj._d, t, x)) return;
      if (!obj || !obj._d) {
        if (e.target.closest(".tl-carril")) {
          if (!e.shiftKey && !e.ctrlKey) { E.multi = []; E.sel = null; }
          arr = { modo: "recuadro", x0: e.clientX, y0: e.clientY, t };
          cont.setPointerCapture(e.pointerId);
        }
        return;
      }
      const d = obj._d;
      if (filaBloqueada(obj)) {   // pista con candado: se puede seleccionar para verla, pero no mover, recortar ni cortar
        if (!esSel(d)) seleccionar(d, "solo");
        if (E.herramienta === "cortar" || !e.shiftKey) toast("Esa pista está bloqueada: quita el candado de su cabecera para editarla.", "info", 2200);
        return;
      }
      if (E.herramienta === "cortar" && d.a !== undefined && !d.trans) {
        const tc = r3(clamp(t, d.a + 0.04, d.b - 0.04));
        if (d.tipo === "toma") hacer({ op: "toma_dividir", t: tc });
        else if (["overlays", "efectos", "musica", "voz", "flashes", "clips"].includes(d.tipo)) hacer({ op: "lista_dividir", lista: d.tipo, i: d.i, t: tc, solo: !E.enlazado || undefined });
        return;
      }
      if (e.target.classList.contains("vol-linea")) {
        arr = { modo: "vol", d, obj, y0: e.clientY, h: obj.clientHeight, linea: e.target };
        seleccionar(d, "solo"); cont.setPointerCapture(e.pointerId); return;
      }
      if (e.target.classList.contains("fade-asa")) {
        arr = { modo: "fade", lado: e.target.classList.contains("i") ? "i" : "f", d, obj, x0: e.clientX, asa: e.target };
        seleccionar(d, "solo"); cont.setPointerCapture(e.pointerId); return;
      }
      if (e.shiftKey || e.ctrlKey || e.metaKey) { seleccionar(d, "alternar"); return; }
      if (!esSel(d)) {
        seleccionar(d, "solo");
        if (d.a !== undefined && (E.t < d.a - 1e-6 || E.t >= d.b) && d.tipo !== "overlays") ponerT(d.a + Math.min(0.05, (d.b - d.a) / 2));
      } else { E.sel = E.multi.find((s) => claveSel(s) === claveSel(d)) || E.sel; renderInspector(); }
      if (d.trans) return;
      let modo = "mover";
      if (e.target.classList.contains("asa")) modo = e.target.classList.contains("i") ? "trim-i" : "trim-f";
      if (d.tipo === "sfx" && modo !== "mover") modo = "mover";
      if (d.tipo === "flashes" && modo !== "mover" && V().flashes[d.i] && !V().flashes[d.i].serie) modo = "mover";
      const grupo = modo === "mover" && E.multi.length > 1 && !["toma", "grupo"].includes(d.tipo)
        ? E.multi.filter((s) => !["toma", "grupo"].includes(s.tipo)).map((s) => ({ s, obj: $$("#tl-cont .clip").find((c) => c._d && claveSel(c._d) === claveSel(s)) }))
        : null;
      arr = { modo, d, obj, x0: x, y0: e.clientY, t0: t, movido: false, grupo };
      prepararIman(d.a !== undefined ? [d.a, d.b] : []);
      cont.setPointerCapture(e.pointerId);
    });
    cont.addEventListener("pointermove", (e) => {
      if (!arr) return;
      const r = cont.getBoundingClientRect();
      const x = e.clientX - r.left, t = tDe(x);
      if (arr.modo === "cabezal") return ponerT(t);
      if (arr.modo === "rango") { const a = Math.min(arr.t0, t), b = Math.max(arr.t0, t); E.rango = b - a > 0.05 ? [r3(clamp(a, 0, V().total)), r3(clamp(b, 0, V().total))] : null; dibujarRegla(); renderEstado(); return; }
      if (arr.modo === "recuadro") {
        if (!arr.movido && Math.abs(e.clientX - arr.x0) < 4 && Math.abs(e.clientY - arr.y0) < 4) return;
        let rc = $("#tl-recuadro"); if (!rc) { rc = el("div", { id: "tl-recuadro", class: "tl-recuadro" }); cont.append(rc); }
        const x0 = Math.min(arr.x0, e.clientX) - r.left, y0 = Math.min(arr.y0, e.clientY) - r.top;
        Object.assign(rc.style, { left: x0 + "px", top: y0 + "px", width: Math.abs(e.clientX - arr.x0) + "px", height: Math.abs(e.clientY - arr.y0) + "px" });
        arr.movido = true; arr.x1 = e.clientX; arr.y1 = e.clientY; return;
      }
      if (arr.modo === "vol") {
        const top = arr.obj.getBoundingClientRect().top;
        const y = clamp(e.clientY - top, 0, arr.h - 1);
        arr.vol = r3(clamp(2 * (1 - y / arr.h), 0, 2)); arr.linea.style.top = y + "px";
        mostrarPista(e, `Volumen ${Math.round(arr.vol * 100)}%`); return;
      }
      if (arr.modo === "fade") {
        const dur = arr.d.b - arr.d.a, rr = arr.obj.getBoundingClientRect();
        const px = arr.lado === "i" ? e.clientX - rr.left : rr.right - e.clientX;
        arr.valor = r3(clamp(px / E.pps, 0, dur / 2));
        if (arr.lado === "i") arr.asa.style.left = Math.max(0, arr.valor * E.pps - 5) + "px"; else arr.asa.style.right = Math.max(0, arr.valor * E.pps - 5) + "px";
        mostrarPista(e, `Fundido ${arr.valor.toFixed(2)} s`); return;
      }
      if (!arr.movido && Math.abs(x - arr.x0) < 3 && Math.abs(e.clientY - arr.y0) < 4) return;
      arr.movido = true;
      const d = arr.d, o = arr.obj;
      if (arr.modo === "mover") {
        if (d.tipo === "toma" || d.tipo === "grupo") {
          o.style.transform = `translateX(${x - arr.x0}px)`; o.style.opacity = .6; o.style.zIndex = 10;
          const dest = destinoToma(t, d);
          let ins = $("#tl-ins"); if (!ins) { ins = el("div", { class: "tl-ins", id: "tl-ins" }); cont.append(ins); }
          const fv = cont.querySelector('.tl-fila[data-pista="video"]');
          ins.style.top = (fv.offsetTop + 12) + "px"; ins.style.height = (fv.offsetHeight - 12) + "px";
          ins.style.left = (xDe(dest.x) - 1) + "px";
          arr.dest = dest;
        } else {
          let a = d.a + (t - arr.t0);
          const b = d.b + (t - arr.t0);
          const aa = iman(a, e);
          if (aa !== a) a = aa; else { const bb = iman(b, e); if (bb !== b) a += bb - b; }
          a = Math.max(0, a);
          arr.nuevoA = a;
          const dx = (a - d.a) * E.pps;
          if (arr.grupo) { for (const g of arr.grupo) if (g.obj) g.obj.style.transform = `translateX(${dx}px)`; }
          else o.style.left = (a * E.pps) + "px";
          if (d.tipo === "overlays" && !arr.grupo) {      // capa destino (arrastre vertical entre V2, V3…)
            const f = document.elementFromPoint(e.clientX, e.clientY);
            const fila_ = f && f.closest(".tl-fila[data-capa]");
            arr.capa = fila_ ? Number(fila_.dataset.capa) : null;
            for (const ff of $$(".tl-fila[data-capa]")) ff.classList.toggle("drop", ff === fila_ && Number(ff.dataset.capa) !== (V().overlays[d.i].pista || 1));
          }
          if (d.tipo === "clips" && !arr.grupo) {         // clip libre: a otra pista del mismo tipo (V2+ o A)
            const cv = V().clips[d.i], sel = cv && cv.audio ? ".tl-fila[data-apista]" : ".tl-fila[data-capa]";
            const f = document.elementFromPoint(e.clientX, e.clientY);
            const fila_ = f && f.closest(sel);
            arr.capa = fila_ ? Number(fila_.dataset.capa || fila_.dataset.apista) : null;
            for (const ff of $$(sel)) ff.classList.toggle("drop", ff === fila_ && arr.capa !== cv.pista);
          }
          mostrarPista(e, fmt(a));
        }
      } else if (arr.modo === "trim-i") {
        let a = iman(Math.min(d.b - 0.034, d.a + (t - arr.t0)), e);
        if (d.tipo !== "toma") a = Math.max(0, a);
        arr.nuevoA = a;
        o.style.left = (a * E.pps) + "px"; o.style.width = Math.max(3, (d.b - a) * E.pps) + "px";
        mostrarPista(e, `${(d.b - a).toFixed(2)} s`);
      } else if (arr.modo === "trim-f") {
        const b = iman(Math.max(d.a + 0.034, d.b + (t - arr.t0)), e);
        arr.nuevoB = b;
        o.style.width = Math.max(3, (b - d.a) * E.pps) + "px";
        mostrarPista(e, `${(b - d.a).toFixed(2)} s`);
      }
    });
    cont.addEventListener("pointerup", async () => {
      const a = arr; arr = null;
      quitarGuiaIman(); quitarPista(); const ins = $("#tl-ins"); if (ins) ins.remove();
      for (const ff of $$(".tl-fila.drop")) ff.classList.remove("drop");
      if (!a) return;
      if (a.modo === "cabezal") { if (ED.player) ED.player.scrub(false); return; }
      if (a.modo === "rango") { if (E.rango) { E.marcaIn = null; renderTimeline(); } return; }
      if (a.modo === "recuadro") {
        const rc = $("#tl-recuadro"); if (rc) rc.remove();
        if (!a.movido) { renderTimeline(); renderInspector(); ponerT(a.t); return; }
        const x0 = Math.min(a.x0, a.x1), x1 = Math.max(a.x0, a.x1), y0 = Math.min(a.y0, a.y1), y1 = Math.max(a.y0, a.y1);
        for (const c of $$("#tl-cont .clip")) {
          const b = c.getBoundingClientRect();
          if (b.right >= x0 && b.left <= x1 && b.bottom >= y0 && b.top <= y1 && c._d && !esSel(c._d)) E.multi.push({ tipo: c._d.tipo, g: c._d.g, k: c._d.k, i: c._d.i });
        }
        E.sel = E.multi[E.multi.length - 1] || null;
        renderTimeline(); renderInspector();
        if (E.multi.length > 1) toast(`${E.multi.length} elementos seleccionados`, "info", 1500);
        return;
      }
      if (a.modo === "vol" && a.vol !== undefined) return hacer({ op: "lista_props", lista: a.d.tipo, i: a.d.i, props: { volumen: a.vol } });
      if (a.modo === "fade" && a.valor !== undefined) {
        const props = a.d.tipo === "voz" ? { fundido: a.valor } : { [a.lado === "i" ? "fade_in" : "fade_out"]: Math.max(0.008, a.valor) };
        return hacer({ op: "lista_props", lista: a.d.tipo, i: a.d.i, props });
      }
      if (!a.movido) return;
      const d = a.d;
      if (a.modo === "mover") {
        if (d.tipo === "toma" && a.dest) {
          if (a.dest.g === d.g && (a.dest.k === d.k || a.dest.k === d.k + 1)) return renderTimeline();
          return hacer({ op: "toma_mover", g: d.g, k: d.k, a_g: a.dest.g, a_k: a.dest.k });
        }
        if (d.tipo === "grupo" && a.dest) {
          const ag = a.dest.antesDeGrupo;
          if (ag === d.g || ag === d.g + 1) return renderTimeline();
          return hacer({ op: "grupo_mover", g: d.g, a: ag });
        }
        const delta = a.nuevoA !== undefined ? r3(a.nuevoA - d.a) : 0;
        if (a.grupo && Math.abs(delta) > 1e-4) return hacer({ op: "lote", desc: "mover varios", ops: a.grupo.map((g) => ({ op: "lista_mover", lista: g.s.tipo, i: g.s.i, delta })) }, { mantenerSel: true });
        const ops = [];
        if (d.tipo === "clips") {
          const cv = V().clips[d.i];
          if (Math.abs(delta) > 1e-4 || (a.capa && a.capa !== cv.pista)) ops.push({ op: "lista_mover", lista: "clips", i: d.i, a: r3(a.nuevoA ?? d.a), pista: a.capa && a.capa !== cv.pista ? a.capa : undefined, solo: !E.enlazado || undefined });
        } else if (Math.abs(delta) > 1e-4) ops.push({ op: "lista_mover", lista: d.tipo, i: d.i, a: r3(a.nuevoA) });
        if (d.tipo === "overlays" && a.capa && a.capa !== (V().overlays[d.i].pista || 1)) ops.push({ op: "lista_props", lista: "overlays", i: d.i, props: { pista: a.capa === 1 ? null : a.capa } });
        if (ops.length) return hacer(ops.length === 1 ? ops[0] : { op: "lote", desc: "mover", ops });
        return renderTimeline();
      }
      if (a.modo === "trim-i" && a.nuevoA !== undefined) {
        if (d.tipo === "toma") return hacer({ op: "toma_recortar", g: d.g, k: d.k, lado: "inicio", delta: r3(a.nuevoA - d.a) });
        return hacer({ op: "lista_recortar", lista: d.tipo, i: d.i, lado: "inicio", t: r3(a.nuevoA), solo: !E.enlazado || undefined });
      }
      if (a.modo === "trim-f" && a.nuevoB !== undefined) {
        if (d.tipo === "toma") return hacer({ op: "toma_recortar", g: d.g, k: d.k, lado: "fin", delta: r3(a.nuevoB - d.b) });
        return hacer({ op: "lista_recortar", lista: d.tipo, i: d.i, lado: "fin", t: r3(a.nuevoB), solo: !E.enlazado || undefined });
      }
    });
  }
  function mostrarPista(e, txt) {
    let p = $("#tl-pista"); if (!p) { p = el("div", { id: "tl-pista", class: "tl-pista" }); document.body.append(p); }
    p.textContent = txt; p.style.left = (e.clientX + 12) + "px"; p.style.top = (e.clientY - 26) + "px";
  }
  function quitarPista() { const p = $("#tl-pista"); if (p) p.remove(); }
  function destinoToma(t, d) {
    const v = V();
    if (d.tipo === "grupo") {
      const g = v.grupos.find((x) => t >= x.t0 && t < x.t0 + x.dur) || v.grupos[v.grupos.length - 1];
      const antes = t < g.t0 + g.dur / 2;
      return { antesDeGrupo: antes ? g.g : g.g + 1, x: antes ? g.t0 : g.t0 + g.dur };
    }
    const planas = tomasPlanas();
    const x = planas.find((p) => t >= p.t0 && t < p.t0 + p.dur) || (t < 0 ? planas[0] : planas[planas.length - 1]);
    const antes = t < x.t0 + x.dur / 2;
    return { g: x.g, k: antes ? x.k : x.k + 1, x: antes ? x.t0 : x.t0 + x.dur };
  }

  // ================================================================== acciones
  // clave de pista (para el candado) de un elemento seleccionado
  function clavePista(s) {
    if (s.tipo === "toma" || s.tipo === "grupo") return "video";
    if (s.tipo === "overlays") { const o = V().overlays[s.i]; return "capa" + ((o && o.pista) || 1); }
    if (s.tipo === "clips") { const c = (V().clips || [])[s.i]; return c ? (c.audio ? "a" : "capa") + c.pista : "clips"; }
    return s.tipo === "flashes" ? "efectos" : s.tipo;
  }
  async function borrarSel() {
    let sels = E.multi.length ? E.multi : (E.sel ? [E.sel] : []);
    const libres = sels.filter((s) => !E.bloq[clavePista(s)]);
    if (libres.length < sels.length) toast("Lo que está en pistas bloqueadas no se borra.", "info", 2200);
    sels = libres;
    if (!sels.length) return;
    const ops = [];
    const tomas = sels.filter((s) => s.tipo === "toma").sort((a, b) => b.g - a.g || b.k - a.k);
    const grupos = sels.filter((s) => s.tipo === "grupo").sort((a, b) => b.g - a.g);
    const listas = sels.filter((s) => !["toma", "grupo"].includes(s.tipo)).sort((a, b) => b.i - a.i);
    for (const s of listas) ops.push({ op: "lista_borrar", lista: s.tipo, i: s.i, solo: s.tipo === "clips" && (!E.enlazado || listas.length > 1) ? true : undefined });
    for (const s of grupos) {
      const g = V().grupos[s.g]; if (!g) continue;
      const pregunta = { titulo: `¿Borrar la escena «${g.etiqueta || "Escena " + (s.g + 1)}»?`, cuerpo: `Se borran sus ${g.tomas.length} clips. Puedes deshacerlo con Ctrl+Z.`, si: "Borrar escena", peligro: true };
      if (!(window.WDVS && WDVS.confirmar ? await WDVS.confirmar(pregunta) : confirm(pregunta.titulo))) return;
      for (const x of [...g.tomas].reverse()) ops.push({ op: "toma_borrar", g: s.g, k: x.k });
    }
    for (const s of tomas) if (!grupos.some((g) => g.g === s.g)) ops.push({ op: "toma_borrar", g: s.g, k: s.k });
    if (!ops.length) return;
    E.multi = []; E.sel = null;
    return hacer(ops.length === 1 ? ops[0] : { op: "lote", desc: `borrar ${ops.length}`, ops });
  }
  function duplicarSel() {
    const s = E.sel; if (!s) return;
    if (s.tipo === "toma") return hacer({ op: "toma_duplicar", g: s.g, k: s.k });
    if (s.tipo === "grupo") return;
    const it = listaVista(s.tipo)[s.i]; if (!it) return;
    const [a, b] = intervaloVista(s.tipo, it);
    return hacer({ op: "lista_duplicar", lista: s.tipo, i: s.i, delta: r3(s.tipo === "sfx" ? 1 : b - a) });
  }
  function dividir() {
    const s = E.sel, t = r3(E.t);
    if (s && ["overlays", "efectos", "musica", "voz", "flashes", "clips"].includes(s.tipo)) {
      const it = listaVista(s.tipo)[s.i];
      const [a, b] = it ? intervaloVista(s.tipo, it) : [0, 0];
      if (it && t > a && t < b) return hacer({ op: "lista_dividir", lista: s.tipo, i: s.i, t, solo: s.tipo === "clips" && !E.enlazado ? true : undefined });
    }
    return hacer({ op: "toma_dividir", t });
  }
  function nuevoTexto(t = E.t, extra = {}) {
    const est = Object.keys(E.plan.estilos || {}).filter((k) => !k.startsWith("propio_")).concat(["frase", "barra"].filter((k) => BASE().estilos[k]));
    const fin = Math.min(V().total, t + 2.5);
    const t_in = r3(Math.min(t, Math.max(0, V().total - 0.5)));
    const item = { texto: "TU TEXTO", t_in, t_out: r3(Math.max(t_in + 0.5, fin)), anim: "fade", pos: "centro", ...(est.length ? { estilo: est[0] } : { tamano: 120, color: "blanco" }), ...extra };
    return hacer({ op: "lista_nuevo", lista: "overlays", item }).then((ok) => {
      if (ok) { if (E.t < item.t_in || E.t >= item.t_out) ponerT(item.t_in + 0.05); setTimeout(() => { const ta = $("#insp textarea.texto-grande"); if (ta) { ta.focus(); ta.select(); } }, 50); }
      return ok;
    });
  }
  function saltarCorte(dir) {
    const cs = cortes();
    const t = dir > 0 ? cs.find((c) => c > E.t + 1e-3) : [...cs].reverse().find((c) => c < E.t - 1e-3);
    if (t !== undefined) ponerT(t, { seguir: true });
  }
  // ---- portapapeles (Ctrl+C / Ctrl+V; también entre proyectos vía sessionStorage)
  function copiar() {
    const sels = E.multi.length ? E.multi : (E.sel ? [E.sel] : []);
    const items = [], tomas = [];
    let base = Infinity;
    for (const s of sels) {
      if (s.tipo === "toma") { const x = tomasPlanas().find((y) => y.g === s.g && y.k === s.k); const t = tomaCruda(s.g, s.k); if (t && x) { const c = JSON.parse(JSON.stringify(t)); delete c.id; tomas.push({ t0: x.t0, toma: c }); } continue; }
      if (s.tipo === "grupo") continue;
      const it = listaCruda(s.tipo)[s.i], iv = listaVista(s.tipo)[s.i];
      if (it === undefined || !iv) continue;
      base = Math.min(base, intervaloVista(s.tipo, iv)[0]);
      items.push({ lista: s.tipo, item: JSON.parse(JSON.stringify(it)) });
    }
    if (!items.length && !tomas.length) return toast("Selecciona algo para copiar", "info", 1500);
    tomas.sort((a, b) => a.t0 - b.t0);
    const clipb = { base: isFinite(base) ? base : 0, items, tomas: tomas.map((x) => x.toma), fuentes: {} };
    for (const t of clipb.tomas) if (t.fuente && E.plan.fuentes[t.fuente]) clipb.fuentes[t.fuente] = E.plan.fuentes[t.fuente];
    lsSet("wded_portapapeles", clipb);
    toast(`Copiado: ${items.length + tomas.length} elemento(s)`, "info", 1400);
  }
  function pegar() {
    const clipb = lsGet("wded_portapapeles", null);
    if (!clipb) return toast("El portapapeles está vacío", "info", 1500);
    const ops = [];
    const dt = r3(E.t - clipb.base);
    const porLista = {};
    for (const x of clipb.items) (porLista[x.lista] = porLista[x.lista] || []).push(x.item);
    for (const [lista, items] of Object.entries(porLista)) ops.push({ op: "lista_pegar", lista, items, dt });
    if (clipb.tomas.length) {
      for (const [a, f] of Object.entries(clipb.fuentes || {})) if (!E.plan.fuentes[a]) ops.unshift({ op: "seccion_props", seccion: "fuentes", props: { [a]: f } });
      const dest = destinoToma(E.t, { tipo: "toma" });
      for (const t of [...clipb.tomas].reverse()) ops.push({ op: "toma_insertar", g: dest.g, k: dest.k, toma: t });
    }
    return hacer(ops.length === 1 ? ops[0] : { op: "lote", desc: "pegar", ops });
  }
  // ---- marcadores (M)
  // marcadores de la secuencia (en el plan: nombre, color y nota; se editan con doble clic en la regla)
  function marcas() { return (V() && V().marcadores) || []; }
  function marcador() {
    if (!E.plan) return;
    const t = r3(E.t);
    const m = marcas().find((mm) => Math.abs(mm.t - t) < 0.05);
    if (m) return hacer({ op: "lista_borrar", lista: "marcadores", i: m.i });
    return hacer({ op: "lista_nuevo", lista: "marcadores", item: { t, nombre: `Marcador ${marcas().length + 1}`, color: "#3DD68C" } }, { mantenerSel: true });
  }

  // ================================================================== menús, modales y ayuda
  function cerrarMenus() { for (const m of $$(".wd-menu")) m.remove(); }
  function menu(x, y, items) {
    cerrarMenus();
    const m = el("div", { class: "wd-menu", style: { left: x + "px", top: y + "px" } });
    for (const it of items) {
      if (!it) continue;
      if (it === "-") { m.append(el("div", { class: "sep" })); continue; }
      m.append(el("button", { onclick: () => { cerrarMenus(); it[1](); }, disabled: it[3] }, el("span", {}, it[0]), it[2] ? el("kbd", {}, it[2]) : null));
    }
    document.body.append(m);
    const r = m.getBoundingClientRect();
    if (r.right > innerWidth) m.style.left = (innerWidth - r.width - 6) + "px";
    if (r.bottom > innerHeight) m.style.top = (innerHeight - r.height - 6) + "px";
    setTimeout(() => document.addEventListener("pointerdown", function f(ev) { if (!ev.target.closest(".wd-menu")) { cerrarMenus(); document.removeEventListener("pointerdown", f); } }), 0);
    return m;
  }
  function menuContextual(x, y, d) {
    const varios = E.multi.length > 1;
    const items = [
      ["Dividir en el cabezal", dividir, "S"], ["Duplicar", duplicarSel, "Ctrl+D", varios], ["Copiar", copiar, "Ctrl+C"], ["Pegar en el cabezal", pegar, "Ctrl+V"],
      ["Borrar" + (varios ? ` (${E.multi.length})` : ""), borrarSel, "Supr", !d && !varios], "-",
      ["Acercar a la selección", zoomSeleccion, "Z"],
    ];
    if (d && d.tipo === "toma") items.push(["Separar escena aquí", () => d.k > 0 ? hacer({ op: "grupo_dividir", g: d.g, k: d.k }) : toast("Ya es el inicio de una escena", "info"), "", d.k === 0],
      ["Ver este clip con efectos", () => vistaPreviaRango(d.a, d.b)]);
    if (d && d.tipo === "overlays") items.push(["Traer al frente", () => hacer({ op: "lista_orden", lista: "overlays", i: d.i, a: (E.plan.overlays || []).length - 1 })],
      ["Enviar atrás", () => hacer({ op: "lista_orden", lista: "overlays", i: d.i, a: 0 })],
      ["Añadir fotograma clave aquí", () => ED.agregarKeyframe && ED.agregarKeyframe()]);
    if (d && pistaAudio(d.tipo)) items.push([E.mute[d.tipo] ? "Activar sonido de la pista" : "Silenciar esta pista", () => { E.mute[d.tipo] = !E.mute[d.tipo]; guardarMezcla(); renderTimeline(); }]);
    if (ED.pro) ED.pro.menuClip(items, d);
    for (const f of ED.ganchosMenu || []) try { f(items, d); } catch (err) { console.error(err); }
    items.push("-", ["Añadir / quitar marcador", marcador, "M"]);
    menu(x, y, items);
  }
  const ATAJOS = [["Espacio", "Reproducir / pausa"], ["J / K / L", "Atrás 1 s / pausa / adelante 1 s"], ["← / →", "Un cuadro (Shift: 1 s)"], ["↑ / ↓", "Corte anterior / siguiente"],
    ["Ctrl+K", "Asistente IA"], ["Tab / Shift+Tab", "Moverte entre controles"],
    ["Inicio / Fin", "Principio / final"], ["V", "Herramienta de selección"], ["C", "Herramienta de corte"], ["S", "Dividir en el cabezal"], ["T", "Texto nuevo"],
    ["Supr", "Borrar la selección"], ["Ctrl+C / Ctrl+V", "Copiar / pegar en el cabezal"], ["Ctrl+D", "Duplicar"], ["Ctrl+Z / Ctrl+Y", "Deshacer / rehacer"],
    ["Ctrl+A", "Seleccionar todo lo de la misma pista"], ["Shift o Ctrl + clic", "Agregar a la selección"], ["Arrastrar en vacío", "Seleccionar con un recuadro"],
    ["Clic derecho", "Menú del clip"], ["N", "Imán"], ["R", "Ripple"], ["M", "Marcador"], ["I / O / X", "Entrada / salida del rango / quitar rango"], ["+ / −", "Zoom de la línea de tiempo"],
    ["Z / Shift+Z", "Zoom a la selección / ver todo"], ["F", "Pantalla completa"], ["Alt al arrastrar", "Sin imán"], ["?", "Esta ayuda"]];
  function modal(titulo, ...hijos) {
    cerrarModal();
    const m = el("div", { class: "wd-modal", id: "wd-modal", onclick: (e) => { if (e.target.id === "wd-modal") cerrarModal(); } },
      el("div", { class: "caja", role: "dialog", "aria-modal": "true", "aria-label": titulo }, el("div", { class: "cab" }, el("b", {}, titulo), el("button", { class: "ib", onclick: cerrarModal, "aria-label": "Cerrar", html: ico("x", 16) })), ...hijos));
    document.body.append(m);
    return m.firstChild;
  }
  function ayuda() {
    if (window.WDVS && WDVS.ayuda) return WDVS.ayuda();
    modal("Atajos de teclado", el("div", { class: "atajos" }, ...ATAJOS.map(([k, d]) => el("div", {}, el("kbd", {}, k), el("span", {}, d)))));
  }
  function cerrarModal() { const m = $("#wd-modal"); if (m) m.remove(); }

  // ================================================================== teclado
  function teclado(e) {
    if (!E.abierto || !E.raiz || !E.raiz.isConnected || E.raiz.closest("[hidden]")) return;
    if (!e.target || typeof e.target.closest !== "function") return;   // eventos sintéticos sobre document
    const enCampo = e.target.closest("input, textarea, select, [contenteditable]");
    // el chat del asistente (cajón de la app) y los diálogos de la app no reciben atajos del editor
    if (e.target.closest("#cajon-ia, #der-ia, dialog[open]") || (document.querySelector("dialog[open]") && e.key !== "Escape")) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === "Escape") { cerrarMenus(); cerrarModal(); }
    for (const f of ED.ganchosTecla || []) if (f(e, ctrl, !!enCampo)) return;
    if (!E.plan) return;
    if (enCampo && e.target.closest("#der-ia")) return;
    if (ctrl && (e.key === "z" || e.key === "Z") && !e.shiftKey) { if (enCampo) return; e.preventDefault(); return deshacer(); }
    if (ctrl && (e.key === "y" || e.key === "Y" || ((e.key === "z" || e.key === "Z") && e.shiftKey))) { if (enCampo) return; e.preventDefault(); return rehacer(); }
    if (enCampo) { if (e.key === "Escape") e.target.blur(); return; }
    if (ctrl && (e.key === "d" || e.key === "D")) { e.preventDefault(); return duplicarSel(); }
    if (ctrl && (e.key === "c" || e.key === "C")) { e.preventDefault(); return copiar(); }
    if (ctrl && (e.key === "v" || e.key === "V")) { e.preventDefault(); return pegar(); }
    if (ED.pro && ED.pro.tecla(e, ctrl)) return;
    if (ctrl && (e.key === "a" || e.key === "A")) {
      e.preventDefault();
      const tipo = E.sel ? E.sel.tipo : "overlays";
      if (tipo === "toma" || tipo === "grupo") E.multi = tomasPlanas().map((x) => ({ tipo: "toma", g: x.g, k: x.k }));
      else E.multi = (listaVista(tipo) || []).map((x) => ({ tipo, i: x.i }));
      E.sel = E.multi[0] || null; renderTimeline(); renderInspector(); return;
    }
    if (ctrl) return;
    const fr = 1 / (V().fps || 30);
    switch (e.key) {
      case " ": e.preventDefault(); return alternarPlay();
      case "k": case "K": if (E.reproduciendo) pausa(); return;
      case "j": case "J": return ponerT(E.t - 1, { seguir: true });
      case "l": case "L": return ponerT(E.t + 1, { seguir: true });
      case "s": case "S": e.preventDefault(); return dividir();
      case "Delete": case "Backspace": e.preventDefault(); return borrarSel();
      case "t": case "T": e.preventDefault(); return nuevoTexto();
      case "v": case "V": return herramienta("sel");
      case "c": case "C": return herramienta("cortar");
      case "a": case "A": return herramienta("pista");
      case "b": return herramienta("ripple");
      case "B": return herramienta("roll");
      case "y": case "Y": return herramienta("slip");
      case "u": case "U": return herramienta("slide");
      case "p": case "P": return herramienta("pluma");
      case "h": case "H": return herramienta("mano");
      case "n": case "N": E.iman = !E.iman; marcarBoton("#ed-iman", E.iman); return;
      case "r": case "R": E.ripple = !E.ripple; marcarBoton("#ed-ripple", E.ripple); toast(E.ripple ? "Ripple activado: los textos, sonidos y efectos siguen a los clips" : "Ripple desactivado", "info", 1800); return;
      case "m": case "M": if (document.body.classList.contains("modo-simple")) return; return marcador();
      case "f": case "F": return pantallaCompleta();
      case "z": return zoomSeleccion();
      case "Z": ajustarZoom(); return renderTimeline();
      case "?": return ayuda();
      case "ArrowLeft": e.preventDefault(); return ponerT(E.t - (e.shiftKey ? 1 : fr), { seguir: true });
      case "ArrowRight": e.preventDefault(); return ponerT(E.t + (e.shiftKey ? 1 : fr), { seguir: true });
      case "ArrowUp": e.preventDefault(); return saltarCorte(-1);
      case "ArrowDown": e.preventDefault(); return saltarCorte(1);
      case "Home": e.preventDefault(); return ponerT(0, { seguir: true });
      case "End": e.preventDefault(); return ponerT(V().total, { seguir: true });
      case "i": case "I": return marcarIn();
      case "o": case "O": return marcarOut();
      case "x": case "X": E.rango = null; E.marcaIn = null; renderTimeline(); renderEstado(); return;
      case "+": case "=": return zoom(1.4);
      case "-": return zoom(1 / 1.4);
      case "Escape": E.sel = null; E.multi = []; renderTimeline(); renderInspector(); return;
    }
  }
  function marcarBoton(sel, on) { const b = $(sel); if (b) { b.classList.toggle("on", !!on); b.setAttribute("aria-pressed", String(!!on)); } }
  function herramienta(h) {
    E.herramienta = h;
    marcarBoton("#ed-h-sel", h === "sel"); marcarBoton("#ed-h-cortar", h === "cortar");
    const c = $("#tl-cont"); if (c) { c.classList.toggle("modo-cortar", h === "cortar"); c.dataset.herr = h; }
    if (ED.pro) ED.pro.marcarHerramienta(h);
  }
  function marcarIn() { E.marcaIn = r3(E.t); if (E.rango && E.rango[1] > E.marcaIn) E.rango = [E.marcaIn, E.rango[1]]; else E.rango = null; renderTimeline(); renderEstado(); }
  function marcarOut() {
    const a = E.marcaIn ?? (E.rango ? E.rango[0] : 0);
    if (E.t - a > 0.2) { E.rango = [a, r3(E.t)]; E.marcaIn = null; } else toast("La salida debe ir después de la entrada", "info", 2000);
    renderTimeline(); renderEstado();
  }
  function pantallaCompleta() {
    const c = $("#visor-caja");
    if (document.fullscreenElement) document.exitFullscreen(); else if (c.requestFullscreen) c.requestFullscreen();
  }

  // ================================================================== visor (en pausa)
  function dimensionarVisor() {
    if (!E.plan) return;
    const caja = $("#visor-caja"), v = V();
    const W = caja.clientWidth - 8, H = caja.clientHeight - 8;
    if (W <= 0 || H <= 0) return;
    const ajuste = Math.min(W / v.W, H / v.H);
    const esc_ = E.zoomVisor > 0 ? E.zoomVisor : ajuste;
    caja.classList.toggle("zoom", esc_ > ajuste + 1e-3);
    const vis = $("#visor");
    vis.style.width = Math.round(v.W * esc_) + "px"; vis.style.height = Math.round(v.H * esc_) + "px";
    E.escVisor = esc_;
    if (!vis.querySelector(".img-area")) {
      vis.innerHTML = "";
      vis.append(el("div", { class: "img-area" }, el("img", { id: "visor-img", draggable: "false", alt: "" }), el("div", { class: "vids", id: "visor-vids" }), el("div", { class: "vineta", id: "visor-vineta" })),
        el("div", { id: "visor-ovs" }), el("div", { id: "visor-ovs-play" }), el("div", { class: "velo", id: "visor-flash" }), el("div", { class: "velo negro", id: "visor-negro" }), el("span", { class: "etq", id: "visor-etq" }),
        el("div", { class: "visor-segura", "aria-hidden": "true" }, el("div", { class: "accion" }), el("div", { class: "titulos" })),
        el("div", { class: "visor-guias", "aria-hidden": "true" }, el("i", { class: "v1" }), el("i", { class: "v2" }), el("i", { class: "h1" }), el("i", { class: "h2" }), el("b", {})));
      vis.classList.toggle("con-segura", !!E.segura); vis.classList.toggle("con-guias", !!E.guias); vis.classList.toggle("sin-v1", !!E.oculto.video);
    }
    const area = vis.querySelector(".img-area");
    area.style.top = (v.pad_y * esc_) + "px"; area.style.height = (v.VH * esc_) + "px";
    const lk = v.look || {};
    area.style.filter = `contrast(${lk.contraste ?? 1}) saturate(${lk.saturacion ?? 1}) brightness(${1 + (lk.brillo ?? 0)})`;
    $("#visor-vineta").style.display = lk.vineta ? "block" : "none";
    colocarOverlays();
  }
  let visorOcupado = false, visorPend = false, ovsOcupado = false, ovsPend = false;
  function actualizarVisor() {
    if (!E.plan || !E.abierto || E.reproduciendo) return;
    const usado = E.calidad === "fluida" && ED.player && ED.player.mostrar(E.t);
    const img = $("#visor-img"); if (img) img.style.visibility = usado ? "hidden" : "visible";
    if (!usado) { if (ED.player) ED.player.ocultar(); pedirCuadro(); }
    pedirOverlays();
    if (ED.pro && !usado) ED.pro.pintar(E.t, false);
    if (ED.anim) ED.anim.pintar(E.t);
  }
  function pedirCuadro() {
    if (visorOcupado) { visorPend = true; return; }
    visorOcupado = true;
    const w = Math.min(1280, Math.max(320, Math.round(($("#visor").clientWidth || 640) * (window.devicePixelRatio > 1 ? 1.3 : 1))));
    const img = new Image();
    img.onload = img.onerror = () => {
      visorOcupado = false;
      const vi = $("#visor-img"); if (vi && img.naturalWidth) vi.src = img.src;
      if (visorPend) { visorPend = false; pedirCuadro(); }
    };
    img.src = `media/poster.jpg`;
  }
  async function pedirOverlays() {
    if (ovsOcupado) { ovsPend = true; return; }
    ovsOcupado = true;
    try {
      const r = await pedir(`${pidURL()}/editor/overlays?t=${E.t.toFixed(3)}`);
      if (r.ok) E.ovsVisor = r.d.overlays;
    } finally {
      ovsOcupado = false;
      colocarOverlays();
      if (ovsPend) { ovsPend = false; pedirOverlays(); }
    }
  }
  function estiloOverlay(im, o, tl, f, conAnim = false) {
    const tr = tfOverlay(o, tl, conAnim);
    im.style.left = ((o.cx - o.w / 2) * f) + "px"; im.style.top = ((o.cy - o.h / 2) * f) + "px"; im.style.width = (o.w * f) + "px";
    im.style.transform = `translate(${tr.dx * f}px, ${tr.dy * f}px) rotate(${tr.rotacion}deg) scale(${tr.escala})`;
    im.style.opacity = tr.opacidad;
  }
  function colocarOverlays() {
    const cont = $("#visor-ovs"); if (!cont || !E.plan) return;
    cont.hidden = E.reproduciendo;
    if (E.reproduciendo) return;
    const f = E.escVisor || 0.5;
    cont.innerHTML = "";
    const lista = [...(E.ovsVisor || [])];
    if (E.vivo) {
      const o = E.vivo;
      const idx = lista.findIndex((x) => x.i === o.i);
      const vis = E.t >= o.t_in - 1e-6 && E.t < o.t_out;
      if (idx >= 0) lista[idx] = { ...lista[idx], ...o.geom, url: o.url, error: undefined };
      else if (vis) lista.push({ i: o.i, ...o.geom, url: o.url, t_in: o.t_in, t_out: o.t_out });
    }
    lista.sort((a, b) => (a.pista || 1) - (b.pista || 1));
    for (const o of lista) {
      if (E.oculto["capa" + (o.pista || 1)] || o.tipo === "escena") continue;   // las escenas van en su lienzo (editor_anim.js)
      if (o.error) { cont.append(el("div", { class: "ov error", style: { left: "4px", top: "30px" } }, `Este texto tiene un problema: ${llano(o.error)}`)); continue; }
      const im = el("img", { class: "ov" + (E.multi.some((s) => s.tipo === "overlays" && s.i === o.i) ? " sel" : ""), src: o.url, draggable: "false" });
      estiloOverlay(im, o, E.t - o.t_in, f);
      im._o = o;
      cont.append(im);
    }
  }
  // arrastrar textos en el visor (con keyframes: crea o actualiza el fotograma clave del cabezal)
  let arrOv = null;
  function enlazarVisor() {
    const vis = $("#visor");
    vis.addEventListener("pointerdown", (e) => {
      const im = e.target.closest(".ov"); if (!im || !im._o) return;
      e.preventDefault();
      const o = im._o;
      if (!(E.sel && E.sel.tipo === "overlays" && E.sel.i === o.i)) seleccionar({ tipo: "overlays", i: o.i }, "solo");
      const tr = tfOverlay(o, E.t - o.t_in, false);
      arrOv = { im, o, x0: e.clientX, y0: e.clientY, cx: o.cx, cy: o.cy, dx: tr.dx, dy: tr.dy, tr, movido: false, kf: !!(o.tf && o.tf.keyframes && o.tf.keyframes.length) };
      vis.setPointerCapture(e.pointerId);
    });
    vis.addEventListener("pointermove", (e) => {
      if (!arrOv) return;
      const f = E.escVisor, v = V();
      const ddx = (e.clientX - arrOv.x0) / f, ddy = (e.clientY - arrOv.y0) / f;
      arrOv.movido = true;
      for (const g of $$("#visor .guia")) g.remove();
      if (arrOv.kf) {
        arrOv.ndx = Math.round(arrOv.dx + ddx); arrOv.ndy = Math.round(arrOv.dy + ddy);
        arrOv.im.style.transform = `translate(${arrOv.ndx * f}px, ${arrOv.ndy * f}px) rotate(${arrOv.tr.rotacion}deg) scale(${arrOv.tr.escala})`;
        return;
      }
      let cx = clamp(arrOv.cx + ddx, 0, v.W), cy = clamp(arrOv.cy + ddy, 0, v.H);
      arrOv.pos = null; arrOv.centrado = false;
      if (!e.altKey) {
        if (Math.abs(cx - v.W / 2) < 12 / f) { cx = v.W / 2; arrOv.centrado = true; vis.append(el("div", { class: "guia", style: { left: (cx * f) + "px", top: 0, bottom: 0, width: "1px" } })); }
        for (const [nom, y] of Object.entries(v.posiciones)) if (Math.abs(cy - y) < 10 / f) { cy = y; arrOv.pos = nom; vis.append(el("div", { class: "guia", style: { top: (cy * f) + "px", left: 0, right: 0, height: "1px" } })); break; }
      }
      arrOv.ncx = cx; arrOv.ncy = cy;
      arrOv.im.style.left = ((cx - arrOv.o.w / 2) * f) + "px"; arrOv.im.style.top = ((cy - arrOv.o.h / 2) * f) + "px";
    });
    vis.addEventListener("pointerup", () => {
      const a = arrOv; arrOv = null; for (const g of $$("#visor .guia")) g.remove();
      if (!a || !a.movido) return;
      if (a.kf && ED.ponerKeyframe) return ED.ponerKeyframe(a.o.i, E.t - a.o.t_in, { dx: a.ndx, dy: a.ndy });
      const props = { pos: a.pos || Math.round(a.ncy), dy: null, dx: null, x: a.centrado ? null : Math.round(a.ncx), alinear: null, linea: null };
      hacer({ op: "lista_props", lista: "overlays", i: a.o.i, props }).then(() => { E.vivo = null; });
    });
    new ResizeObserver(() => { if (E.abierto) { dimensionarVisor(); dibujarRegla(); } }).observe($("#visor-caja"));
    new ResizeObserver(debounce(() => { if (E.abierto && E.plan && E.zoomAjustado) { ajustarZoom(); renderTimeline(); } }, 150)).observe($("#tl"));
  }

  // ----------------------------------------------------------------- reproducción
  function alternarPlay() { if (E.reproduciendo) return pausa(); play(); }
  function play(fuente) {
    if (!E.plan) return;
    if (E.t >= V().total - 0.05) ponerT(0);
    if (fuente === "rango" && E.rangoVideo) return playVideo(E.rangoVideo.url, E.rangoVideo.a, "vista previa con efectos");
    if (!fuente && ED.antesDePlay && ED.antesDePlay()) return;   // render de fondo listo en este tramo (editor_export.js)
    if (ED.player && ED.player.play(E.t)) { E.reproduciendo = true; $("#ed-play").innerHTML = ico("pause", 18); $("#ed-play").classList.add("on"); $("#visor-ovs").hidden = true; return; }
    toast("Preparando la reproducción fluida… (se crean versiones ligeras de tus videos una sola vez)", "info", 3000);
  }
  function playVideo(src, offset, etiqueta) {
    const vis = $("#visor");
    E.reproduciendo = true; $("#ed-play").innerHTML = ico("pause", 18); $("#ed-play").classList.add("on");
    const vid = el("video", { src, preload: "auto", class: "vid-render" });
    if (ED.anim) ED.anim.ocultar();     // el render ya trae las escenas
    vis.append(vid); E.video = vid;
    vis.append(el("span", { class: "etq abajo", id: "etq-video" }, etiqueta));
    vid.addEventListener("loadedmetadata", () => { vid.currentTime = Math.max(0, E.t - offset); vid.play().catch(() => {}); });
    vid.addEventListener("ended", pausa);
    const paso = () => { if (!E.reproduciendo || !E.video) return; ponerT(offset + vid.currentTime, { sinVisor: true, seguir: true }); requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }
  function pausa() {
    const estaba = E.reproduciendo;
    E.reproduciendo = false; const b = $("#ed-play"); if (b) { b.innerHTML = ico("play", 18); b.classList.remove("on"); }
    if (E.video) { E.video.pause(); E.video.remove(); E.video = null; const q = $("#etq-video"); if (q) q.remove(); }
    if (ED.player) ED.player.pausa();
    if (estaba) { actualizarVisor(); renderEstado(); }
  }

  // ================================================================== biblioteca (panel izquierdo)
  function arrastrable(item, datosArr) {
    item.setAttribute("draggable", "true");
    item.addEventListener("dragstart", (e) => { e.dataTransfer.setData("application/x-wdvs", JSON.stringify(datosArr)); e.dataTransfer.effectAllowed = "copy"; });
    return item;
  }
  async function cargarMedios() {
    const r = await pedir(pidURL());
    if (r.ok) { E.medios = r.d.medios || []; E.salidas = r.d.salidas || {}; }
  }
  function tarjeta(vis, nom, des, datos, tit) {
    return arrastrable(el("div", { class: "bib-item", "data-k": datos && datos.k, title: tit || (des ? nom + " — " + des : nom) }, vis, el("div", { class: "txt" }, el("div", { class: "nom" }, nom), des ? el("div", { class: "des" }, des) : null)), datos);
  }
  function renderBiblio() {
    const c = $("#bib-lista"); if (!c) return;
    const sc = c.scrollTop;
    c.innerHTML = "";
    if (ED.bib && ED.bib.render(c)) { c.scrollTop = sc; return; }
    const buscar = el("input", { class: "bib-buscar", placeholder: "Buscar…", value: E.filtroBib });
    buscar.addEventListener("input", debounce(() => { E.filtroBib = buscar.value; renderBiblio(); const b = $("#bib-lista .bib-buscar"); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }, 200));
    const f = E.filtroBib.toLowerCase();
    const pasa = (...t) => !f || t.join(" ").toLowerCase().includes(f);
    if (E.bib === "medios") return renderMedios(c, buscar, pasa);
    if (ED.bibExtra) ED.bibExtra(c, buscar, pasa);
  }
  function renderMedios(c, buscar, pasa) {
    const inp = el("input", { type: "file", multiple: true, accept: "video/*,audio/*,image/*", style: { display: "none" } });
    inp.addEventListener("change", () => subirArchivos([...inp.files]));
    c.append(el("div", { class: "bib-acciones" },
      el("button", { class: "bt acento", title: "Elige videos, música o imágenes con la ventana de Windows (no se copian)", onclick: () => importarNativo(false, inp), html: `${ico("up", 14)} Importar` }),
      el("button", { class: "bt", title: "Agrega todos los videos, audios e imágenes de una carpeta (no se copian)", onclick: () => importarNativo(true, inp), html: `${ico("folder", 14)} Desde carpeta` }), inp), buscar);
    const nr = (r) => String(r || "").replace(/\\/g, "/").toLowerCase();
    const medioDe = (ruta) => E.medios.find((m) => nr(m.ruta) === nr(ruta)) || null;
    const vistos = new Set();
    const items = [];
    for (const [a, fu] of Object.entries(E.fuentes)) { if (fu.ruta) vistos.add(nr(fu.ruta)); items.push({ alias: a, ...fu, nombre: (fu.ruta || a).split(/[\\/]/).pop(), medio: medioDe(fu.ruta) }); }
    for (const m of E.medios) if (!vistos.has(nr(m.ruta))) items.push({ alias: null, ruta: m.ruta, tipo: TIPO_CAT[m.tipo] || (m.rol === "logo" ? "imagen" : m.rol), nombre: m.nombre || m.ruta.split(/[\\/]/).pop(), existe: true, dur: m.dur, medio: m });
    if (!items.length) {
      c.append(el("div", { class: "vacio-medios vacio-guia" }, el("span", { html: ico("up", 32) }), el("b", {}, "Arrastra tus videos aquí"), el("span", {}, "o pulsa Importar. También música, imágenes y tu logo. No se copian: se usan donde están.")));
      return;
    }
    for (const tipo of ["video", "musica", "imagen"]) {
      const ls = items.filter((x) => x.tipo === tipo && pasa(x.nombre, x.medio ? x.medio.nota || "" : "", x.medio ? ROL_TXT[x.medio.rol] || "" : "")); if (!ls.length) continue;
      c.append(el("div", { class: "bib-cat" }, { video: "Videos", musica: "Audio", imagen: "Imágenes" }[tipo]));
      const rej = el("div", { class: "bib-rejilla" });
      let sel = null;
      for (const m of ls) {
        const src = m.alias ? `media/poster.jpg` : `media/poster.jpg`;
        const md = m.medio;
        const insignia = md ? el("span", { class: "rol r-" + md.rol, title: "Rol: " + (ROL_TXT[md.rol] || md.rol) }, ROL_CORTO[md.rol] || md.rol) : null;
        const conNota = md && md.nota ? el("span", { class: "con-nota", title: "Nota: " + md.nota, html: ico("message-square", 11) }) : null;
        const vis = tipo === "musica" ? el("div", { class: "mini ic", html: ico("audio-lines", 22) }, insignia, conNota) : el("div", { class: "mini" }, el("img", { src, loading: "lazy", draggable: "false", alt: "" }), m.dur ? el("span", { class: "dur" }, fmt(m.dur).replace(/\.\d+$/, "")) : null, insignia, conNota);
        const activo = md && E.medioSel && nr(E.medioSel) === nr(md.ruta);
        if (activo) sel = md;
        const tarj = el("div", { class: "bib-medio" + (m.existe === false ? " falta" : "") + (activo ? " sel" : ""), title: (m.ruta || "") + (md ? "\nClic: rol y cómo usarlo" : ""),
          onclick: () => { if (!md) return toast("Este archivo solo está en el plan (no en los archivos del proyecto).", "info"); E.medioSel = activo ? null : md.ruta; renderBiblio(); } },
        vis, el("div", { class: "nom" }, m.nombre.replace(/\.[^.]+$/, "")));
        rej.append(arrastrable(tarj, { k: "medio", tipo, alias: m.alias, ruta: m.ruta, dur: m.dur, rol: md ? md.rol : null }));
      }
      c.append(rej);
      if (sel) { const caja = editorMedio(sel); c.append(caja); requestAnimationFrame(() => caja.scrollIntoView({ block: "nearest" })); }
    }
  }
  // Rol y «¿Cómo te gustaría usarlo?» de un archivo del proyecto (se guardan en proyecto.json -> medios[i]).
  const TIPO_CAT = { video: "video", audio: "musica", imagen: "imagen" };
  const ROLES_TIPO = { video: ["video"], audio: ["musica", "voz", "efecto"], imagen: ["imagen", "logo", "fondo", "personaje", "marca_agua"] };
  const ROL_TXT = { video: "Gameplay / toma", musica: "Música", voz: "Voz", efecto: "Efecto de sonido", imagen: "Imagen", logo: "Logo", fondo: "Fondo", personaje: "Personaje", marca_agua: "Marca de agua" };
  const ROL_CORTO = { video: "toma", musica: "música", voz: "voz", efecto: "efecto", imagen: "imagen", logo: "LOGO", fondo: "fondo", personaje: "personaje", marca_agua: "marca" };
  const NOTA_PH = "Opcional. Ej.: usar al final con el logo; solo los primeros 30 s; música de fondo suave. Si lo dejas en blanco, la IA decide.";
  async function guardarMedio(md, cambios, estado) {
    if (estado) estado.textContent = "Guardando…";
    const r = await pedir(`${pidURL()}/medios`, { method: "PATCH", json: { ruta: md.ruta, ...cambios } });
    if (!r.ok) { if (estado) estado.textContent = ""; toast(r.d.detail || "No se pudo guardar"); return false; }
    const i = E.medios.findIndex((x) => x.ruta === md.ruta);
    if (i >= 0) { const { cambios: _c, ...m } = r.d; E.medios[i] = { ...E.medios[i], ...m }; Object.assign(md, E.medios[i]); }
    if (estado) estado.textContent = "Guardado ✓";
    return true;
  }
  function editorMedio(md) {
    const estado = el("span", { class: "estado" });
    const selRol = el("select", { class: "rol-sel", "aria-label": "Rol del archivo" },
      ...(ROLES_TIPO[md.tipo] || [md.rol]).map((r) => el("option", { value: r, selected: r === md.rol }, ROL_TXT[r] || r)));
    selRol.addEventListener("change", async () => {
      const otroLogo = selRol.value === "logo" && E.medios.some((x) => x.rol === "logo" && x.ruta !== md.ruta);
      if (await guardarMedio(md, { rol: selRol.value }, estado)) {
        if (otroLogo) toast("Ya había otro logo: la IA usará el primero de la lista como logo principal.", "info");
        renderBiblio();
      }
    });
    const nota = el("textarea", { class: "nota-medio", rows: 3, maxlength: 600, placeholder: NOTA_PH, "aria-label": "¿Cómo te gustaría usarlo?" });
    nota.value = md.nota || "";
    let ultimo = nota.value;
    const guardarNota = async () => { const v = nota.value.trim(); if (v === ultimo.trim()) return; ultimo = nota.value; await guardarMedio(md, { nota: v }, estado); };
    nota.addEventListener("input", debounce(guardarNota, 900));
    nota.addEventListener("blur", () => guardarNota().then(() => { const b = document.querySelector(".bib-medio.sel .con-nota"); if (!!md.nota !== !!b) renderBiblio(); }));
    const sug = md.rol_origen === "sugerido" ? el("div", { class: "sug" }, `Sugerido por el nombre del archivo: ${ROL_TXT[md.rol] || md.rol}. Cámbialo si no es así.`) : null;
    return el("div", { class: "bib-medio-edit" },
      el("div", { class: "cab" }, el("b", { title: md.ruta }, md.nombre || md.ruta.split(/[\\/]/).pop()),
        el("button", { class: "ib", "aria-label": "Cerrar", onclick: () => { E.medioSel = null; renderBiblio(); }, html: ico("x", 14) })),
      el("label", {}, "Rol", selRol), sug,
      el("label", {}, "¿Cómo te gustaría usarlo?", nota), estado);
  }
  async function subirArchivos(files) {
    if (!files.length || !E.pid) return;
    for (const f of files) {
      const fd = new FormData(); fd.append("archivo", f); fd.append("rol", "");
      $("#ed-tarea").textContent = `Importando ${f.name}…`;
      const r = await fetch(`${pidURL()}/subir`, { method: "POST", body: fd });
      if (!r.ok) { const d = await r.json().catch(() => ({})); toast(`No se pudo importar ${f.name}: ${d.detail || r.statusText}`); }
    }
    $("#ed-tarea").textContent = "";
    await cargarMedios(); renderBiblio();
    toast(`${files.length} archivo(s) importado(s). Arrástralos a la línea de tiempo o pídele a la IA que arme el video.`, "info");
  }
  // Importar con la ventana nativa de Windows (WDVS.elegirMedios de app.js): usa los archivos donde están.
  async function importarNativo(carpeta, inp) {
    const WD = window.WDVS || {};
    if (!WD.elegirMedios) return inp.click();
    const ms = await WD.elegirMedios(E.pid, { carpeta });
    if (!ms.length) return;
    await cargarMedios(); renderBiblio();
    pedir(`${pidURL()}/chat/evento`, { method: "POST", json: { tipo: "adjunto", texto: "Agregaste: " + ms.map((m) => m.nombre).join(", ") } }).catch(() => {});
    toast(`${ms.length} archivo(s) agregados. Arrástralos a la línea de tiempo o pídele a la IA que arme el video.`, "info");
  }
  async function soltarBiblio(e, pista, capa, apista) {
    if (e.dataTransfer.files && e.dataTransfer.files.length) return subirArchivos([...e.dataTransfer.files]);
    let d; try { d = JSON.parse(e.dataTransfer.getData("application/x-wdvs")); } catch { return; }
    if (!E.plan) return toast("Primero pide a la IA que arme el video", "info");
    const r = $("#tl-cont").getBoundingClientRect();
    prepararIman([]);
    const t = r3(clamp(iman(tDe(e.clientX - r.left), e), 0, V().total));
    quitarGuiaIman();
    const sobre = document.elementFromPoint(e.clientX, e.clientY);
    const objetivo = sobre && sobre.closest(".clip, .grupo-banda");
    const od = objetivo && objetivo._d;
    const conCapa = (item) => capa && Number(capa) > 1 ? { ...item, pista: Number(capa) } : item;
    if (d.k === "origen" && ED.pro) return ED.pro.soltarOrigen(d, pista, capa, apista, t);
    // locución del panel Voces: va a la pista de voz (voz.continua), no a una pista de audio común
    if (d.voz_tts && d.voz_tts.id && window.WDVS && WDVS.voces && WDVS.voces.alPlan) {
      try { await WDVS.voces.alPlan(E.pid, d.voz_tts.id, t); } catch (err) { toast(String(err.message || err)); }
      return;
    }
    if (d.k === "medio") {
      let alias = d.alias;
      if (!alias) {
        const ok = await hacer({ op: "fuente_agregar", ruta: d.ruta, rol: d.tipo === "imagen" ? (d.rol === "logo" ? "logo" : "imagen") : d.tipo }, { reInsp: false });
        if (!ok) return;
        alias = Object.entries(E.fuentes).find(([, f]) => f.ruta && f.ruta.toLowerCase() === d.ruta.toLowerCase());
        alias = alias ? alias[0] : null; if (!alias) return;
      }
      if (ED.pro && (pista === "audio" || (pista === "overlays" && d.tipo !== "imagen"))) return ED.pro.soltarMedio(d, alias, pista, capa, apista, t);
      if (d.tipo === "video") {
        if (pista !== "video") return toast("Suelta los videos en V1 (pista principal), en V2+ (capas) o su audio en una pista A", "info");
        const dest = destinoToma(t, { tipo: "toma" });
        return hacer({ op: "toma_insertar", g: dest.g, k: dest.k, toma: { fuente: alias, inicio: 0, dur: V().spb ? r3(V().spb * 4) : 2 } });
      }
      if (d.tipo === "musica") {
        const largo = Math.min(d.dur || 10, Math.max(4, V().total - t));
        return hacer({ op: "lista_nuevo", lista: "musica", item: { fuente: alias, desde: 0, hasta: r3(largo), en: t } });
      }
      if (d.tipo === "imagen") return hacer({ op: "lista_nuevo", lista: "overlays", item: { imagen: alias, ancho: 600, t_in: t, t_out: r3(Math.min(V().total, t + 3)), anim: "fade", pos: "centro", pista: capa && Number(capa) > 1 ? Number(capa) : 2 } });
    }
    if (d.k === "efecto") {
      if (od && od.tipo === "toma") return hacer({ op: "efecto_agregar", g: od.g, k: od.k, donde: "toma", efecto: d.nombre });
      if (od && od.tipo === "grupo") return hacer({ op: "efecto_agregar", g: od.g, k: 0, donde: "grupo", efecto: d.nombre });
      if (pista === "efectos") {
        const pre = E.cat && E.cat.presets.some((p) => p.nombre === d.nombre);
        return hacer({ op: "lista_nuevo", lista: "efectos", item: { [pre ? "preset" : "efecto"]: d.nombre, desde: t, hasta: r3(Math.min(V().total, t + 2)) } });
      }
      return toast("Suelta el efecto sobre un clip, sobre la banda de una escena o en la pista Efectos", "info");
    }
    if (d.k === "transicion") {
      if (!(od && od.tipo === "toma")) return toast("Suelta la transición sobre un clip de la pista V1", "info");
      if (od.k === 0) {
        if (od.g === 0) return toast("El primer clip del video no lleva transición de entrada", "info");
        return hacer({ op: "grupo_props", g: od.g, props: { transicion: { tipo: d.nombre, dur: 0.4 } } });
      }
      return hacer({ op: "lote", desc: "transición", ops: [{ op: "grupo_dividir", g: od.g, k: od.k }, { op: "grupo_props", g: od.g + 1, props: { transicion: { tipo: d.nombre, dur: 0.4 } } }] });
    }
    if (d.k === "estilo") {
      if (od && od.tipo === "overlays") return hacer({ op: "lista_props", lista: "overlays", i: od.i, props: { estilo: d.nombre, tamano: null, color: null, tipografia: null } });
      return nuevoTexto(t, conCapa({ estilo: d.nombre }));
    }
    if (d.k === "plantilla" && ED.aplicarPlantilla) return ED.aplicarPlantilla(d.nombre, t, capa);
    if (d.k === "anim") {
      if (od && od.tipo === "overlays") return hacer({ op: "lista_props", lista: "overlays", i: od.i, props: { anim: d.nombre } });
      return toast("Suelta la animación sobre un texto", "info");
    }
    if (d.k === "sfx") return hacer({ op: "lista_nuevo", lista: "sfx", item: { tipo: d.nombre, t } });
  }

  // ================================================================== tareas, vista previa, exportar, versiones
  // Tareas largas del editor: el progreso se ve en el centro de tareas de la app (no bloquea); aquí solo se espera el
  // final para reproducir o recargar. Sin la app, se usa la barrita del transporte.
  function vigilarTarea(alTerminar, etiqueta) {
    clearInterval(E.tareaVigilada);
    const conCentro = !!(window.WDVS && WDVS.tareas);
    if (conCentro && WDVS.vigilar) WDVS.vigilar();
    $("#ed-progreso").hidden = conCentro;
    let visto = false;
    E.tareaVigilada = setInterval(async () => {
      const r = await pedir(`${pidURL()}/estado`); if (!r.ok) return;
      const e = r.d;
      const p = (e.pasos || []).find((x) => x.estado === "en_curso") || (e.pasos || []).slice(-1)[0];
      if (e.corriendo) visto = true;
      if (!conCentro) {
        $("#ed-progreso > div").style.width = ((p ? p.progreso : 0) * 100) + "%";
        $("#ed-tarea").textContent = etiqueta ? `${etiqueta}… ${Math.round((p ? p.progreso : 0) * 100)}%` : (p ? p.nombre : "");
      }
      if (!e.corriendo && (visto || e.fin)) {
        clearInterval(E.tareaVigilada); $("#ed-progreso").hidden = true; $("#ed-tarea").textContent = "";
        if (e.ok) { if (alTerminar) alTerminar(e); } else if (!conCentro) toast(`No se pudo terminar: ${llano(e.error || "error desconocido")}`);
      }
    }, 800);
  }
  async function vistaPreviaRango(a, b) {
    pausa();
    const r = await pedir(`${pidURL()}/editor/rango`, { method: "POST", json: { a, b } });
    if (!r.ok) return toast(r.d.detail || "No se pudo lanzar la vista previa");
    vigilarTarea(() => { E.rangoVideo = { a, b, url: `${pidURL()}/editor/rango/video?t=${Date.now()}` }; ponerT(a, { sinVisor: true }); play("rango"); }, "Vista previa con efectos");
  }
  async function vistaPrevia() {
    if (E.rango) return vistaPreviaRango(E.rango[0], E.rango[1]);
    const aw = V() && V().area_trabajo;
    if (aw && aw.hasta > aw.desde) return vistaPreviaRango(aw.desde, Math.min(V().total, aw.hasta));
    pausa();
    const r = await pedir(`${pidURL()}/tareas/preview`, { method: "POST", json: {} });
    if (!r.ok) return toast(r.d.detail || "No se pudo lanzar la vista previa");
    vigilarTarea(() => { ponerT(0, { sinVisor: true }); playVideo(`${pidURL()}/video/preview?t=${Date.now()}`, 0, "vista previa renderizada (con efectos)"); }, "Vista previa");
  }
  function verConEfectos() {
    const x = tomaEn(E.t);
    const a = E.rango ? E.rango[0] : (x ? x.t0 : Math.max(0, E.t - 1));
    const b = E.rango ? E.rango[1] : (x ? Math.min(V().total, Math.max(x.t0 + x.dur, x.t0 + 1)) : Math.min(V().total, E.t + 2));
    vistaPreviaRango(r3(a), r3(b));
  }
  function menuExportar() {
    if (ED.exp && ED.exp.abrir) return ED.exp.abrir();
    const b = $("#ed-exportar").getBoundingClientRect();
    const m = menu(b.left, b.bottom + 4, [
      ["Video MP4 (calidad final, 1080p)", renderFinal],
      ["Proyecto editable para Premiere / DaVinci Resolve", exportarNLE],
      ED.guias && ED.guias.menuVersiones ? ["Crear versión para 9:16 / 1:1 / 4:5…", () => ED.guias.menuVersiones(b.left, b.bottom)] : null,
      V() && V().area_trabajo ? ["Vista previa exacta del área de trabajo", () => vistaPreviaRango(V().area_trabajo.desde, Math.min(V().total, V().area_trabajo.hasta))] : null,
      "-", ["Abrir la última exportación", () => pedir(`${pidURL()}/editor/exportar/abrir`, { method: "POST", json: { que: "carpeta" } }).then((r) => { if (!r.ok) toast(r.d.detail || "Todavía no hay exportación", "info"); })],
    ]);
    m.style.left = Math.max(4, Math.min(b.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + "px";
  }
  async function renderFinal() {
    const pregunta = { titulo: "El video tiene problemas", cuerpo: "La exportación podría fallar. ¿Intentar de todos modos?", si: "Exportar igual" };
    if (E.errores.length && !(window.WDVS && WDVS.confirmar ? await WDVS.confirmar(pregunta) : confirm(pregunta.cuerpo))) return;
    const r = await pedir(`${pidURL()}/tareas/final`, { method: "POST", json: {} });
    if (!r.ok) return toast(r.d.detail || "No se pudo exportar");
    if (window.WDVS && WDVS.tareas) WDVS.toast("Exportando el MP4 en segundo plano. Sigue editando; te aviso al terminar.", "info", { ms: 3500 });
    vigilarTarea(() => { if (!(window.WDVS && WDVS.tareas)) toast("Tu video está listo (carpeta salidas del proyecto, final.mp4)", "info", 7000); }, "Exportando MP4");
  }
  async function exportarNLE() {
    const r = await pedir(`${pidURL()}/editor/exportar`, { method: "POST", json: { formato: "todos" } });
    if (!r.ok) return toast(r.d.detail || "No se pudo exportar");
    if (window.WDVS && WDVS.tareas) WDVS.toast("Exportando para Premiere / DaVinci en segundo plano. Te aviso al terminar.", "info", { ms: 3500 });
    vigilarTarea(async () => {
      if (window.WDVS && WDVS.tareas) return;   // el centro de tareas ya avisó, con «Abrir carpeta»
      const e = (await pedir(`${pidURL()}/editor/exportar`)).d;
      modal("Exportación para Premiere / DaVinci",
        el("p", {}, e.ok ? "✔ Listo y verificado. Abre la carpeta e importa el archivo en tu editor." : "Listo, pero la verificación encontró detalles: revisa las instrucciones."),
        el("div", { class: "nota" }, e.destino || ""),
        el("div", { class: "botones" }, el("button", { class: "bt acento", onclick: () => pedir(`${pidURL()}/editor/exportar/abrir`, { method: "POST", json: { que: "carpeta" } }) }, "Abrir carpeta"),
          e.leeme ? el("button", { class: "bt", onclick: () => window.open(`${pidURL()}/editor/exportar/leeme`, "_blank") }, "Ver instrucciones") : null));
    }, "Exportando para Premiere / DaVinci");
  }
  async function menuVersiones() {
    const r = await pedir(`${pidURL()}/editor/versiones`);
    if (!r.ok || !(r.d.versiones || []).length) return toast("Todavía no hay versiones", "info");
    const lista = el("div", { class: "versiones" });
    for (const v of r.d.versiones) {
      lista.append(el("div", { class: "version" + (v.actual ? " actual" : "") },
        el("img", { src: `${pidURL()}/editor/version_mini?n=${v.n}&w=160`, loading: "lazy", alt: "", onerror: (e) => { const im = e.target; if (!im._r) { im._r = 1; setTimeout(() => { im.src = im.src + "&r=1"; }, 1500); } } }),
        el("div", { class: "txt" }, el("div", { class: "nom" }, v.descripcion || "Versión"), el("div", { class: "des" }, `${v.ts ? new Date(v.ts).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : ""}${v.tokens ? ` · IA: ${v.tokens.toLocaleString("es-MX")} tokens` : ""}`)),
        v.actual ? el("span", { class: "chip" }, "Actual") : el("button", { class: "bt", onclick: async () => {
          const q = await pedir(`${pidURL()}/version/${v.n}`, { method: "POST" });
          if (!q.ok) return toast(q.d.detail || "No se pudo cambiar de versión");
          cerrarModal(); await cargar(true); toast("Se cargó esa versión", "info", 2000);
        } }, "Usar esta versión")));
    }
    modal("Versiones del video", el("div", { class: "nota" }, "Cada cambio de la IA y cada sesión en el editor guardan una versión. Puedes volver a cualquiera."), lista).classList.add("ancha");
  }

  // ================================================================== Asistente IA (panel derecho)
  function montarIA() {
    const c = $("#der-ia"); if (!c || c._montado === E.pid) return;
    if (c._chat) { try { c._chat.desmontar(); } catch { /* */ } c._chat = null; }
    c._montado = E.pid; c.innerHTML = "";
    const WD = window.WDVS || {};
    if (typeof WD.montarChat === "function") {
      try {
        c._chat = WD.montarChat(E.pid, c, {
          bienvenida: "¿Qué le cambio al video? Dímelo con tus palabras, por ejemplo «textos más grandes» o «más rápido al final».",
          opciones: E.plan ? ["Haz los textos más grandes", "Más rápido al final", "Render final"] : ["Ármalo con lo que ya subí"],
        });
        return;
      } catch (e) { console.error(e); c.innerHTML = ""; }
    }
    // Respaldo mínimo mientras no exista el chat del agente de interfaz.
    const msgs = el("div", { class: "ia-msgs" }, el("div", { class: "ia-msg" }, "Hola. Dime qué quieres cambiar de tu video y lo ajusto."));
    const ta = el("textarea", { rows: 3, placeholder: "Ej.: \"baja los textos\", \"más rápido al inicio\"…" });
    const enviar = async () => {
      const txt = ta.value.trim(); if (!txt) return;
      msgs.append(el("div", { class: "ia-msg yo" }, txt)); ta.value = "";
      const r = await pedir(`${pidURL()}/tareas/ajustar`, { method: "POST", json: { instruccion: txt } });
      if (!r.ok) return msgs.append(el("div", { class: "ia-msg err" }, r.d.detail || "No se pudo enviar"));
      const pens = el("div", { class: "ia-msg" }, "Trabajando en tu video…"); msgs.append(pens);
      vigilarTarea(async () => { await cargar(true); const v = (await pedir(`${pidURL()}/editor/versiones`)).d.versiones || []; pens.textContent = (v[0] && v[0].descripcion) || "Listo."; }, "La IA está ajustando");
    };
    c.append(el("div", { class: "ia-cab" }, el("b", {}, "Asistente IA"),
      el("button", { class: "bt acento", onclick: async () => {
        const MNr = window.WDVS || {};
        if (typeof MNr.regenerar === "function") return MNr.regenerar(E.pid);
        if (typeof MNr.nuevoProyecto === "function") return MNr.nuevoProyecto(E.pid);
        if (E.plan && !(window.WDVS && WDVS.confirmar ? await WDVS.confirmar({ titulo: "¿Crear el video desde cero con la IA?", cuerpo: "La versión actual queda guardada en Versiones.", si: "Crear de nuevo" }) : confirm("¿Crear el video desde cero con la IA?"))) return;
        const r = await pedir(`${pidURL()}/tareas/generar`, { method: "POST", json: {} });
        if (!r.ok) return toast(r.d.detail || "No se pudo generar");
        vigilarTarea(() => cargar(true), "La IA está armando tu video");
      } }, E.plan ? "Regenerar" : "Generar video")),
      msgs, el("div", { class: "ia-enviar" }, ta, el("button", { class: "bt acento", onclick: enviar }, "Enviar")));
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } });
  }

  // ================================================================== enlaces
  function enlazar() {
    enlazarSplits(); enlazarTimeline(); enlazarVisor();
    $("#bib-tabs").addEventListener("click", (ev) => { const b = ev.target.closest("button[data-b]"); if (b) elegirBib(b.dataset.b); });
    $("#bib-tabs").addEventListener("keydown", (ev) => {   // flechas entre pestañas (patrón tablist)
      if (!["ArrowLeft", "ArrowRight"].includes(ev.key)) return;
      const bs = $$("#bib-tabs button"), i = bs.indexOf(document.activeElement); if (i < 0) return;
      const n = bs[(i + (ev.key === "ArrowRight" ? 1 : -1) + bs.length) % bs.length]; n.focus(); n.click();
    });
    $$("#der-tabs button").forEach((b) => b.onclick = () => {
      $$("#der-tabs button").forEach((x) => { x.classList.toggle("activa", x === b); x.setAttribute("aria-selected", String(x === b)); });
      $("#der-insp").hidden = b.dataset.d !== "insp"; $("#der-ia").hidden = b.dataset.d !== "ia";
      if (b.dataset.d === "ia") montarIA();
      window.dispatchEvent(new CustomEvent("wdvs:panel-derecho", { detail: { panel: b.dataset.d } }));
    });
    $("#ed-segura").onclick = () => { E.segura = !E.segura; marcarBoton("#ed-segura", E.segura); $("#visor").classList.toggle("con-segura", E.segura); lsSet("wded_visor", { segura: E.segura, guias: E.guias }); };
    $("#ed-guias").onclick = () => { E.guias = !E.guias; marcarBoton("#ed-guias", E.guias); $("#visor").classList.toggle("con-guias", E.guias); lsSet("wded_visor", { segura: E.segura, guias: E.guias }); };
    $("#ed-zoom-visor").onchange = (ev) => { E.zoomVisor = Number(ev.target.value) || 0; dimensionarVisor(); actualizarVisor(); };
    $("#ed-marcador").onclick = marcador;
    $("#ed-zoom-rango").addEventListener("input", (ev) => {
      if (!E.plan) return;
      const [a, b] = zoomLim(), sc = $("#tl-scroll"), tc = tDe(sc.scrollLeft + sc.clientWidth / 2);
      E.pps = a * Math.pow(b / a, Number(ev.target.value) / 100); E.zoomAjustado = false;
      renderTimeline(); sc.scrollLeft = xDe(tc) - sc.clientWidth / 2;
    });
    $$(".alto-pistas button").forEach((b) => b.onclick = () => { E.altoGlobal = Number(b.dataset.alto); lsSet("wded_alto", E.altoGlobal); marcarAlto(); renderTimeline(); });
    const izq = $("#wd-izq");
    izq.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); izq.classList.add("drop"); } });
    izq.addEventListener("dragleave", () => izq.classList.remove("drop"));
    izq.addEventListener("drop", (e) => { izq.classList.remove("drop"); if (e.dataTransfer.files.length) { e.preventDefault(); subirArchivos([...e.dataTransfer.files]); } });
    $("#ed-deshacer").onclick = deshacer; $("#ed-rehacer").onclick = rehacer;
    $("#ed-dividir").onclick = dividir; $("#ed-copiar").onclick = copiar; $("#ed-borrar").onclick = borrarSel;
    $("#ed-nuevo-texto").onclick = () => nuevoTexto();
    $("#ed-h-sel").onclick = () => herramienta("sel"); $("#ed-h-cortar").onclick = () => herramienta("cortar");
    $("#ed-iman").onclick = () => { E.iman = !E.iman; marcarBoton("#ed-iman", E.iman); };
    $("#ed-ripple").onclick = () => { E.ripple = !E.ripple; marcarBoton("#ed-ripple", E.ripple); };
    $("#ed-enlazado").onclick = () => { E.enlazado = !E.enlazado; marcarBoton("#ed-enlazado", E.enlazado); lsSet("wded_enlazado", E.enlazado); };
    $$("#mon-sel button").forEach((b) => b.onclick = () => ED.pro && ED.pro.monitor(b.dataset.mon));
    $("#ed-zoom-mas").onclick = () => zoom(1.4); $("#ed-zoom-menos").onclick = () => zoom(1 / 1.4);
    $("#ed-zoom-ajustar").onclick = () => { ajustarZoom(); renderTimeline(); };
    $("#ed-preview").onclick = vistaPrevia; $("#ed-exportar").onclick = menuExportar; $("#ed-versiones").onclick = menuVersiones;
    $("#ed-play").onclick = alternarPlay; $("#ed-inicio").onclick = () => ponerT(0, { seguir: true }); $("#ed-final-t").onclick = () => ponerT(V().total, { seguir: true });
    $("#ed-cuadro-ant").onclick = () => ponerT(E.t - 1 / (V().fps || 30), { seguir: true }); $("#ed-cuadro-sig").onclick = () => ponerT(E.t + 1 / (V().fps || 30), { seguir: true });
    $("#ed-in").onclick = marcarIn; $("#ed-out").onclick = marcarOut; $("#ed-ver-fx").onclick = verConEfectos; $("#ed-pantalla").onclick = pantallaCompleta;
    $("#ed-calidad").value = E.calidad;
    $("#ed-calidad").onchange = (e) => { E.calidad = e.target.value; lsSet("wded_calidad", E.calidad); actualizarVisor(); };
  }
  function marcarAlto() { $$(".alto-pistas button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.alto) === (E.altoGlobal || 1)))); }
  // Biblioteca: pestañas propias (renderBiblio) y paneles registrados por otros módulos (WDVS.registrarPanel)
  function elegirBib(nombre) {
    E.bib = nombre;
    $$("#bib-tabs button").forEach((x) => { x.classList.toggle("activa", x.dataset.b === nombre); x.setAttribute("aria-selected", String(x.dataset.b === nombre)); });
    const panel = $(`#wd-izq .bib-panel[data-panel="${nombre}"]`);
    $("#bib-lista").hidden = !!panel;
    for (const p of $$("#wd-izq .bib-panel")) p.hidden = p !== panel;
    if (panel) montarPanel(nombre, panel); else renderBiblio();
  }
  // ---- paneles de la biblioteca registrados desde fuera (p. ej. «Animar», del equipo de animación)
  const PANELES = (window.WDVS = window.WDVS || {})._paneles = (window.WDVS._paneles || {});
  function montarPanel(nombre, cont) {
    const reg = PANELES[nombre];
    if (!reg) {   // espacio preparado: estado vacío mientras el módulo no se registra
      if (!cont.dataset.vacio) {
        cont.dataset.vacio = "1";
        cont.innerHTML = nombre === "animar"
          ? `<div class="vacio-guia">${ico("person-standing", 32)}<b>Animar personajes</b><span>Aquí podrás animar personajes 2D y 3D y ponerlos en tu video.</span>
             <div class="acciones"><button class="btn" id="bib-abrir-huesos">${ico("bone", 14)} Editor de huesos</button></div>
             <span class="muy-tenue pequeno">El editor de huesos se abre en una pestaña nueva.</span></div>`
          : `<div class="vacio-guia"><b>${esc(nombre)}</b><span>Este panel todavía no está disponible.</span></div>`;
        const h = cont.querySelector("#bib-abrir-huesos"); if (h) h.onclick = () => abrirEditorHuesos();
      }
      return;
    }
    if (cont._montado === E.pid + "|" + reg.v) return;
    cont.innerHTML = ""; delete cont.dataset.vacio;
    try { reg.montar(cont, { pid: E.pid, editor: ED }); cont._montado = E.pid + "|" + reg.v; }
    catch (err) { console.error(err); cont.innerHTML = `<div class="vacio-guia"><b>No se pudo abrir el panel</b><span>${esc(err.message || err)}</span></div>`; }
  }
  // Editor de huesos del equipo de rigging (/anim/rig/editor.html?rig=<id>)
  // dentro de la app a pantalla completa (editor_anim.js define WDVS.abrirEditorHuesos(rig, modo) con «Volver»); sin ese
  // módulo, respaldo en una pestaña nueva
  function abrirEditorHuesos(rig, modo = "huesos") {
    const f = window.WDVS && window.WDVS.abrirEditorHuesos;
    if (typeof f === "function" && f !== abrirEditorHuesos) return f(rig, modo);
    window.open(`anim/rig/editor.html${rig ? "?rig=" + encodeURIComponent(rig) : ""}`, "_blank", "noopener");
  }
  // Contrato público: window.WDVS.registrarPanel(nombre, montarFn, {titulo, icono}) (ver docs/editor.md §1)
  window.WDVS.registrarPanel = (nombre, montarFn, op = {}) => {
    // forma de objeto {id, titulo, icono, montar} (plugins_panel.js, estilo_panel.js): los plugins van como categoría
    // «Mis efectos» / «Mis transiciones» de la biblioteca y «Mi estilo» en el menú del espacio de trabajo (editor_bib.js)
    if (nombre && typeof nombre === "object" && nombre.id === "voces" && window.WDVS.registrarCategoria) {   // panel de voces: Audio › Voces con IA
      const def = nombre;
      return window.WDVS.registrarCategoria("audio", { id: "voces_ia", titulo: def.titulo || "Voces", icono: def.icono || "mic", montar: (cu) => def.montar(cu, { pid: E.pid, editor: ED }) });
    }
    if (nombre && typeof nombre === "object") { const def = nombre; (window.WDVS._externos = window.WDVS._externos || {})[def.id] = def; if (ED.bib && ED.bib.externo) ED.bib.externo(def); return; }
    PANELES[nombre] = { montar: montarFn, v: ((PANELES[nombre] || {}).v || 0) + 1, ...op };
    const tabs = $("#bib-tabs"); if (!tabs) return;
    if (!tabs.querySelector(`button[data-b="${nombre}"]`)) {
      tabs.append(el("button", { "data-b": nombre, role: "tab", "aria-selected": "false", html: `${ico(op.icono || "layers", 14)}<span>${esc(op.titulo || nombre)}</span>` }));
      $("#wd-izq").append(el("div", { class: "wd-scroll bib-panel", "data-panel": nombre, role: "tabpanel", hidden: true }));
    }
    const cont = $(`#wd-izq .bib-panel[data-panel="${nombre}"]`); if (cont) cont._montado = null;
    if (E.bib === nombre && cont) montarPanel(nombre, cont);
  };
  if (typeof window.WDVS.abrirEditorHuesos !== "function") window.WDVS.abrirEditorHuesos = abrirEditorHuesos;
  document.addEventListener("keydown", teclado);
  window.addEventListener("wdvs:plan-cambiado", (e) => { if (E.abierto && (!e.detail || !e.detail.pid || e.detail.pid === E.pid)) cargar(true); });
  window.addEventListener("wdvs:modo", () => { if (E.abierto && E.plan) { renderInspector(); renderTimeline(); } });
  window.addEventListener("wdvs:ver-resultado", (e) => { if (!E.abierto || !E.plan || (e.detail && e.detail.pid !== E.pid)) return; pausa(); ponerT(0, { seguir: true }); play(); });

  // ================================================================== módulos y API pública
  const BASE_JS = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/editor\.js(\?.*)?$/, "") : "";
  const cargarJS = (src) => new Promise((ok) => {
    const s = document.createElement("script"); s.src = BASE_JS + src; s.onload = ok; s.onerror = () => { console.error("no cargó " + src); ok(); };
    document.head.append(s);
  });
  // editor_bib.js (biblioteca ordenada) y editor_pro.js (pistas, herramientas, origen, secuencias, audio y espacios
  // de trabajo) van después del inspector; los módulos opcionales de otros agentes (editor_guias.js, plugins_panel.js)
  // se cargan solo si existen (GET /api/editor/modulos), para no dejar errores 404 en la consola.
  const cargaModulos = Promise.all(["editor_insp.js", "editor_player.js", "editor_anim.js"].map(cargarJS))
    .then(() => Promise.all(["editor_bib.js", "editor_pro.js"].map(cargarJS)))
    // mejoras del 5-oct-2026: edición rápida, IA en el editor, exportación y organización/UX (docs/editor.md §9)
    .then(() => ["editor_rapida.js", "editor_ia.js", "editor_export.js", "editor_extra.js", "editor_escena_ui.js"].reduce((pr, m) => pr.then(() => cargarJS(m)), Promise.resolve()))
    .then(() => fetch("/api/editor/modulos").then((r) => (r.ok ? r.json() : { modulos: [] })).catch(() => ({ modulos: [] })))
    .then((d) => Promise.all((d.modulos || []).filter((m) => !document.querySelector(`script[src$="${m}"]`)).map(cargarJS)));
  const ED = window.WDED = {
    E, V, $, $$, el, esc, pedir, hacer, toast, fmt, timecode, r3, clamp, debounce, humano, llano, nombreFuente, ico, lsGet, lsSet,
    ponerT, renderTimeline, renderTodo, renderEstado, actualizarVisor, colocarOverlays, estiloOverlay, dimensionarVisor, cargar,
    tomasPlanas, tomaCruda, listaCruda, listaVista, catEfecto, estilosTodos, BASE, aliasDe, hexDe, tomaEn, cortes, seleccionar,
    dividir, duplicarSel, borrarSel, nuevoTexto, copiar, pegar, pidURL, interp, EASE, tfOverlay, camToma, vistaPreviaRango, pausa,
    menu, modal, cerrarModal, arrastrable, tarjeta, renderBiblio, marcador, zoomSeleccion, ATAJOS, elegirBib, abrirEditorHuesos,
    subirArchivos, importarNativo, editorMedio, ROL_TXT, ROL_CORTO, herramienta, marcarBoton, fila, clip, carriles, altoDe, xDe, tDe,
    dibujarOnda, dibujarRegla, marcas, iman, prepararIman, quitarGuiaIman, mostrarPista, quitarPista, intervaloVista, esSel, claveSel,
    guardarPistas, vistaPrevia, play, playVideo, soltarBiblio, llano, filaBloqueada, clavePista, destinoToma, cortes,
    deshacer, rehacer, renderFinal, exportarNLE, montarIA, menuExportar, cerrarMenus, ayuda,
    ganchosMenu: [], ganchosTecla: [], ganchosTimeline: [], playVideo,
    esEscena: (i) => !!(E.plan && (E.plan.overlays || [])[i] && "escena" in E.plan.overlays[i]),
  };
  async function abrir(pid, contenedor) {
    if (!pid) return;
    await cargaModulos;
    if (contenedor && (E.raiz !== contenedor || !contenedor.querySelector("#wded"))) montar(contenedor);
    E.abierto = true;
    if (E.pid !== pid) {
      Object.assign(E, { pid, plan: null, hash: "", undo: [], redo: [], sel: null, multi: [], t: 0, pps: 0, rango: null, ondas: {}, vivo: null, borrador: null, sesion: nuevaSesion(), ovsVisor: [], medios: [] });
      const mz = lsGet("wded_mezcla_" + pid, {}); E.mute = mz.mute || {}; E.solo = mz.solo || null;
      const pz = lsGet("wded_pistas_" + pid, {}); E.bloq = pz.bloq || {}; E.oculto = pz.oculto || {}; E.altos = pz.altos || {};
      E.destV = pz.destV === undefined ? 0 : pz.destV; E.destA = pz.destA === undefined ? 1 : pz.destA;
      E.enlazado = lsGet("wded_enlazado", true); marcarBoton("#ed-enlazado", E.enlazado);
      const vz = lsGet("wded_visor", {}); E.segura = !!vz.segura; E.guias = !!vz.guias;
      E.altoGlobal = lsGet("wded_alto", 1); marcarAlto(); marcarBoton("#ed-segura", E.segura); marcarBoton("#ed-guias", E.guias);
      for (const p of $$("#wd-izq .bib-panel")) p._montado = null;
      E.calidad = lsGet("wded_calidad", "fluida"); $("#ed-calidad").value = E.calidad;
      E.marcadores = [];
      const ia = $("#der-ia"); if (ia) ia._montado = null;
      if (ED.player) ED.player.reset();
    }
    if (!E.cat) { const r = await pedir("/api/editor/catalogo"); if (r.ok) E.cat = r.d; }
    await cargar(true);
    if (!E.medios.length) cargarMedios().then(() => { if (E.bib === "medios") renderBiblio(); });
    if (E.plan) ponerT(E.t);
    if (!$("#der-ia").hidden) montarIA();
    if (window.WDVS && WDVS.hidratarIconos) WDVS.hidratarIconos(document.getElementById("appbar-editor") || document);
    const pnl = $(`#wd-izq .bib-panel[data-panel="${E.bib}"]`); if (pnl) montarPanel(E.bib, pnl);
    if (ED.pro) ED.pro.abierto();
  }
  function cerrar() { E.abierto = false; pausa(); }
  // Si la app (app.js) ya definió WDVS.abrirEditor, esa se queda (muestra el espacio de trabajo y la barra del
  // proyecto) y llama a WDVS.editorMontar; sin app, abrirEditor es directamente el montaje del editor.
  window.WDVS = window.WDVS || {};
  window.WDVS.editorMontar = abrir;
  if (typeof window.WDVS.abrirEditor !== "function") window.WDVS.abrirEditor = abrir;
  window.WDVS.cerrarEditor = cerrar;
  // Compatibilidad con la app anterior (pestaña "Editor" de index.html).
  window.Editor = {
    async abrir(pid) { const tab = $("#tab-editor") || $("#workspace"); if (tab) await abrir(pid, tab); },
    async refrescar() { if (E.abierto && E.pid) { const r = await pedir(`${pidURL()}/editor`); if (r.ok && r.d.hash !== E.hash) await cargar(false); else if (r.ok) { E.bloqueado = r.d.bloqueado; renderEstado(); } } },
    cerrar,
    _estado: E,
  };
})();
