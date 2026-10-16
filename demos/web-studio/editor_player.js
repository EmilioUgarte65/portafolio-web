"use strict";
// Web Studio — Editor: reproducción en vivo aproximada en el navegador.
// Video: proxies de 480p por fuente (editor/proxies.py) en <video>, saltando entre clips según la línea de
// tiempo (velocidad, rampa, congelar), con la cámara (zoom/paneo y keyframes) como transform CSS, fundidos
// entre escenas, desenfoque y fundido a negro con CSS. Audio: música y sonidos con WebAudio (volumen,
// fundidos, silenciar/solo). Textos: PNG del motor con su animación y keyframes. Los efectos pesados no se ven
// en vivo (el transporte muestra "fx" y "Ver con efectos").
(() => {
  const ED = window.WDED;
  const { E, V, $, el, clamp } = ED;
  const N_VIDEOS = 3;
  const P = {
    proxies: {}, sondeo: null, pedido: false, videos: [], ctx: null, master: null, gan: {}, buffers: {}, nodos: [],
    ovs: null, ovsPend: null, imgs: new Map(), jugando: false, base: 0, t0: 0, raf: 0, flashes: [],
    stats: { raf: 0, vfr: 0, desde: 0, fps: 0, fpsVideo: 0, muestras: [] }, ultimoJpeg: 0,
  };

  // ------------------------------------------------------------------ proxies
  async function revisarProxies() {
    if (!E.pid || !E.plan) return;
    const r = await ED.pedir(`${ED.pidURL()}/editor/proxies?generar=${P.pedido ? 0 : 1}`);
    P.pedido = true;
    if (!r.ok) return;
    P.proxies = r.d.proxies || {};
    const vals = Object.values(P.proxies);
    const listos = vals.filter((p) => p.estado === "listo").length;
    const etq = $("#visor-etq");
    const T = window.WDVS && window.WDVS.tareas, idT = "proxies:" + E.pid;
    if (listos < vals.length) {
      const pct = vals.length ? Math.round(100 * vals.reduce((s, p) => s + (p.pct || 0), 0) / vals.length) : 0;
      if (etq && !E.reproduciendo) etq.textContent = `Preparando la reproducción fluida: ${listos}/${vals.length} videos (${pct}%)`;
      if (T) T.poner(idT, { titulo: "Vista fluida del editor", tipo: "proxies", texto: `${listos} de ${vals.length} videos listos (versiones ligeras para reproducir sin cortes)`, frac: pct / 100 });
      clearTimeout(P.sondeo); P.sondeo = setTimeout(revisarProxies, 1500);
    } else {
      if (T && T.lista.has(idT) && T.lista.get(idT).estado === "corriendo") T.terminar(idT, true, { texto: "La reproducción fluida está lista.", silenciosa: true });
      if (etq && /Preparando/.test(etq.textContent)) etq.textContent = "";
      ED.actualizarVisor();
    }
  }
  const listo = (alias) => P.proxies[alias] && P.proxies[alias].estado === "listo";
  const urlProxy = (alias) => `media/demo.mp4`;

  function asegurarVideos() {
    const cont = $("#visor-vids"); if (!cont) return false;
    if (P.videos.length && P.videos[0].isConnected) return true;
    cont.innerHTML = ""; P.videos = [];
    for (let i = 0; i < N_VIDEOS; i++) {
      const v = el("video", { muted: true, playsinline: true, preload: "auto" });
      v.muted = true; v._alias = null; v._clave = null;
      cont.append(v); P.videos.push(v);
    }
    return true;
  }
  const clave = (x) => `${x.g}:${x.k}`;
  function asignar(x, usados) {
    let v = P.videos.find((q) => q._clave === clave(x) && !usados.has(q));
    if (!v) v = P.videos.find((q) => !usados.has(q) && q._alias === x.fuente && !P.videos.some((o) => o !== q && o._clave === q._clave && usados.has(o)));
    if (!v) v = P.videos.find((q) => !usados.has(q) && !q._clave) || P.videos.find((q) => !usados.has(q));
    if (!v) return null;
    if (v._alias !== x.fuente) { v._alias = x.fuente; v.src = urlProxy(x.fuente); v._listo = false; v.addEventListener("loadeddata", () => { v._listo = true; }, { once: true }); }
    v._clave = clave(x);
    usados.add(v);
    return v;
  }
  // Segundo de la fuente que se ve tl segundos después del corte (velocidad, rampa, congelar).
  function tFuente(x, tl) {
    const ini = Number(x.inicio) || 0;
    if (x.congelar) return ini;
    if (x.rampa) { const { v1, v2, cambio } = x.rampa; return ini + (tl < cambio ? v1 * tl : v1 * cambio + v2 * (tl - cambio)); }
    return ini + tl * (x.velocidad || 1);
  }
  const velEn = (x, tl) => x.rampa ? (tl < x.rampa.cambio ? x.rampa.v1 : x.rampa.v2) : (x.velocidad || 1);

  // ------------------------------------------------------------------ composición de un instante
  function vecinos(t) {
    const planas = ED.tomasPlanas();
    let idx = planas.findIndex((y) => t >= y.t0 - 1e-6 && t < y.t0 + y.dur - 1e-6);
    if (idx < 0) idx = planas.length - 1;
    const x = planas[idx];
    const g = V().grupos[x.g];
    let prev = null, p = 1;
    if (x.k === 0 && g.transicion && t - g.t0 < g.transicion.dur && idx > 0) { prev = planas[idx - 1]; p = (t - g.t0) / g.transicion.dur; }
    return { x, prev, p, sig: planas[idx + 1] || null };
  }
  function camara(v, x, tl) {
    const c = ED.camToma(x, tl);
    const lx = (1 - 1 / c.z) / 2 * (1 + c.px), ly = (1 - 1 / c.z) / 2 * (1 + c.py);
    v.style.transform = `scale(${c.z}) translate(${-lx * 100}%, ${-ly * 100}%)`;
    const f = [];
    if (x.desenfoque) f.push(`blur(${Math.max(1, (x.desenfoque === true ? 18 : x.desenfoque) * (E.escVisor || 0.5))}px)`, "brightness(0.72)");
    if (x.oscurecer && x.dur - tl < x.oscurecer) f.push(`brightness(${clamp((x.dur - tl) / x.oscurecer, 0, 1)})`);
    v.style.filter = f.join(" ");
  }
  function componer(t, jugando) {
    if (!asegurarVideos() || !E.plan) return false;
    const { x, prev, p, sig } = vecinos(t);
    if (!x) return false;
    if (!x.negro && !listo(x.fuente)) return false;
    const usados = new Set();
    const papeles = [[x, "act"]];
    if (prev && !prev.negro && listo(prev.fuente)) papeles.push([prev, "prev"]);
    if (sig && !sig.negro && listo(sig.fuente) && jugando) papeles.push([sig, "pre"]);
    const vozOn = E.plan.voz && !E.mute.voz && (!E.solo || E.solo === "voz");
    for (const [y, rol] of papeles) {
      if (y.negro) continue;
      const v = asignar(y, usados); if (!v) continue;
      const tl = rol === "pre" ? 0 : t - y.t0;
      const dest = tFuente(y, tl);
      if (rol === "pre") {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - dest) > 0.05 && !v.seeking) v.currentTime = dest;
        v.style.opacity = 0; v.style.zIndex = 0; v.muted = true;
        continue;
      }
      if (jugando && !y.congelar) {
        const rate = clamp(velEn(y, tl), 0.0625, 16);
        if (Math.abs(v.playbackRate - rate) > 1e-3) v.playbackRate = rate;
        if (Math.abs(v.currentTime - dest) > 0.25 && !v.seeking) v.currentTime = dest;
        if (v.paused) v.play().catch(() => {});
      } else {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - dest) > 0.02) { if (!v.seeking) v.currentTime = dest; else v._pend = dest; }
      }
      v.muted = !(jugando && vozOn && y.voz && Math.abs(velEn(y, tl) - 1) < 1e-3);
      v.volume = 1;
      camara(v, y, tl);
      v.style.opacity = rol === "act" && prev ? p : 1;
      v.style.zIndex = rol === "act" ? 2 : 1;
    }
    for (const v of P.videos) if (!usados.has(v)) { if (!v.paused) v.pause(); v.style.opacity = 0; v._clave = null; }
    // destellos y fundidos del proyecto
    let s = 0;
    for (const [T, it, d] of P.flashes) if (t >= T && t < T + d) s += it * (1 - (t - T) / d);
    $("#visor-flash").style.opacity = Math.min(0.9, s * 0.85);
    const [fe, fs] = V().fundidos || [0.3, 1.3];
    let neg = 0;
    if (fe > 0 && t < fe) neg = 1 - t / fe;
    if (fs > 0 && t > V().total - fs) neg = Math.max(neg, (t - (V().total - fs)) / fs);
    $("#visor-negro").style.opacity = clamp(neg, 0, 1);
    const img = $("#visor-img"); if (img) img.style.visibility = "hidden";
    if (ED.pro) ED.pro.pintar(t, jugando);      // clips libres de V2+ (capas), editor_pro.js
    return true;
  }
  function flashesPlan() {
    const out = [];
    for (const f of E.plan.flashes || []) {
      if ("t" in f) out.push([f.t, f.intensidad ?? 0.5, f.dur ?? 0.13]);
      else for (let t = f.desde; t <= f.hasta + 1e-9; t += f.cada) out.push([t, f.intensidad ?? 0.45, f.dur ?? 0.13]);
    }
    P.flashes = out;
  }

  // ------------------------------------------------------------------ textos durante la reproducción
  async function cargarOvs() {
    if (P.ovs) return P.ovs;
    if (!P.ovsPend) P.ovsPend = ED.pedir(`${ED.pidURL()}/editor/overlays_todos`).then((r) => { P.ovs = r.ok ? r.d.overlays : []; P.ovsPend = null; for (const o of P.ovs) if (o.url && o.tipo !== "escena") { const im = new Image(); im.src = o.url; } return P.ovs; });
    return P.ovsPend;
  }
  function pintarOvs(t) {
    const cont = $("#visor-ovs-play"); if (!cont || !P.ovs) return;
    const f = E.escVisor || 0.5;
    const vivos = new Set();
    for (const o of P.ovs) {
      if (o.error || o.tipo === "escena" || !(t >= o.t_in - 1e-6 && t < o.t_out) || (E.oculto && E.oculto["capa" + (o.pista || 1)])) continue;
      let im = P.imgs.get(o.i);
      if (!im || im._url !== o.url) { if (im) im.remove(); im = el("img", { class: "ov-play", src: o.url, draggable: "false" }); im._url = o.url; P.imgs.set(o.i, im); cont.append(im); }
      im.style.zIndex = (o.pista || 1) * 1000 + o.i;
      ED.estiloOverlay(im, o, t - o.t_in, f, true);
      im.style.display = "";
      vivos.add(o.i);
    }
    for (const [i, im] of P.imgs) if (!vivos.has(i)) im.style.display = "none";
  }
  function limpiarOvs() { for (const im of P.imgs.values()) im.remove(); P.imgs.clear(); }

  // ------------------------------------------------------------------ audio (WebAudio)
  function ctxAudio() {
    if (!P.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      P.ctx = new AC();
      P.master = P.ctx.createGain(); P.master.gain.value = 0.9; P.master.connect(P.ctx.destination);
      for (const k of ["musica", "sfx", "voz"]) { P.gan[k] = P.ctx.createGain(); P.gan[k].connect(P.master); }
    }
    return P.ctx;
  }
  function mezcla() {
    if (!P.ctx) return;
    for (const k of Object.keys(P.gan)) P.gan[k].gain.value = (E.mute[k] || (E.solo && E.solo !== k)) ? 0 : 1;
  }
  function buffer(url) {
    if (!P.buffers[url]) P.buffers[url] = fetch(url).then((r) => r.ok ? r.arrayBuffer() : null).then((b) => b && ctxAudio().decodeAudioData(b)).catch(() => null);
    return P.buffers[url];
  }
  function precargarAudio() {
    if (!ctxAudio()) return;
    for (const m of V().musica) if (m.fuente && E.fuentes[m.fuente] && E.fuentes[m.fuente].existe) buffer(`${ED.pidURL()}/editor/audio?fuente=${encodeURIComponent(m.fuente)}`);
    for (const s of V().sfx) buffer(s.archivo ? `${ED.pidURL()}/editor/sfx_archivo?i=${s.i}` : `/api/editor/sfx/${s.tipo}`);
  }
  // Envolvente de volumen: vol·min(1, u/fi, (L−u)/fo) sobre el tiempo local u del clip.
  function envolvente(g, when, off, L, fi, fo, vol) {
    const val = (u) => vol * Math.max(0, Math.min(1, fi > 0 ? u / fi : 1, fo > 0 ? (L - u) / fo : 1));
    const T = (u) => when + (u - off);
    const u1 = Math.max(off, Math.min(fi, L)), u2 = Math.max(off, L - fo);
    g.gain.setValueAtTime(val(off), T(off));
    if (u1 > off) g.gain.linearRampToValueAtTime(val(u1), T(u1));
    if (u2 > u1) g.gain.linearRampToValueAtTime(val(u2), T(u2));
    g.gain.linearRampToValueAtTime(0, T(L));
  }
  async function programarAudio() {
    const ctx = ctxAudio(); if (!ctx) return;
    if (ctx.state === "suspended") { try { await ctx.resume(); } catch { return; } }
    if (!P.jugando) return;
    mezcla();
    const t = reloj() + 0.05;
    const desfase = () => ctx.currentTime - reloj();     // reloj de audio - reloj de la línea de tiempo
    const tramos = V().musica.map((m) => ({ ...m }));
    tramos.forEach((m, i) => {       // crossfade como engine/plan.py (centrado en "en")
      const cf = m.crossfade || 0;
      if (cf > 0 && i > 0) { m.a = Math.max(0, m.a - cf / 2); m.en = Math.max(0, m.en - cf / 2); m.fade_in = cf; }
      const sgte = tramos[i + 1];
      if (sgte && sgte.crossfade > 0) { m.b += sgte.crossfade / 2; m.fade_out = sgte.crossfade; }
      m.fin = m.en + (m.b - m.a);
    });
    for (const m of tramos) {
      if (m.fin <= t || !m.fuente) continue;
      const buf = await buffer(`${ED.pidURL()}/editor/audio?fuente=${encodeURIComponent(m.fuente)}`);
      if (!buf || !P.jugando) continue;
      const L = m.b - m.a, ahora = reloj() + 0.05;
      if (m.fin <= ahora) continue;
      const when = Math.max(m.en, ahora) + desfase();
      const off2 = Math.max(0, when - desfase() - m.en);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain(); src.connect(g); g.connect(P.gan.musica);
      if (off2 >= L) continue;
      envolvente(g, when, off2, L, m.fade_in || 0.008, m.fade_out || 0.012, m.vol ?? 1);
      src.start(when, m.a + off2, Math.max(0.01, L - off2));
      P.nodos.push(src);
    }
    for (const s of V().sfx) {
      if (s.t + s.dur <= t) continue;
      const buf = await buffer(s.archivo ? `${ED.pidURL()}/editor/sfx_archivo?i=${s.i}` : `/api/editor/sfx/${s.tipo}`);
      if (!buf || !P.jugando) continue;
      const off = Math.max(0, t - s.t);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain(); g.gain.value = s.volumen ?? 0.8; src.connect(g); g.connect(P.gan.sfx);
      const tl = reloj() + 0.03;
      if (s.t + s.dur <= tl) continue;
      src.start(Math.max(s.t, tl) + desfase(), Math.max(0, tl - s.t));
      P.nodos.push(src);
    }
    if (ED.pro) await ED.pro.programarAudio(P, reloj, desfase);    // clips de las pistas A (editor_pro.js)
  }
  function pararAudio() { for (const n of P.nodos) { try { n.stop(); } catch { /* ya terminó */ } } P.nodos = []; }

  // la voz sincronizada (audio de los proxies) pasa por WebAudio para que los medidores la midan
  function conectarVideos() {
    if (!P.ctx) return;
    for (const v of P.videos) {
      if (v._fuenteAudio) continue;
      try { v._fuenteAudio = P.ctx.createMediaElementSource(v); v._fuenteAudio.connect(P.gan.voz); } catch { v._fuenteAudio = true; }
    }
  }

  // ------------------------------------------------------------------ bucle
  function reloj() { return P.t0 + (performance.now() - P.baseMs) / 1000; }
  function paso() {
    if (!P.jugando) return;
    const t = reloj();
    if (t >= V().total - 1e-3) { ED.pausa(); ED.ponerT(V().total); return; }
    if (!componer(t, true)) {        // clip sin proxy todavía: cuadros del servidor, 4 por segundo
      const img = $("#visor-img");
      if (img && performance.now() - P.ultimoJpeg > 250) { P.ultimoJpeg = performance.now(); img.style.visibility = "visible"; img.src = `media/poster.jpg`; for (const v of P.videos) v.style.opacity = 0; }
    }
    pintarOvs(t);
    if (ED.anim) ED.anim.pintar(t);    // escenas animadas (lienzo encima del visor, editor_anim.js)
    ED.ponerT(t, { sinVisor: true, seguir: true });
    const st = P.stats; st.raf++;
    const ahora = performance.now();
    if (ahora - st.desde >= 1000) { st.fps = Math.round(st.raf * 1000 / (ahora - st.desde)); st.fpsVideo = Math.round(st.vfr * 1000 / (ahora - st.desde)); st.muestras.push([st.fps, st.fpsVideo]); if (st.muestras.length > 60) st.muestras.shift(); st.raf = 0; st.vfr = 0; st.desde = ahora; }
    P.raf = requestAnimationFrame(paso);
  }
  function contarCuadros(v) {
    if (!v.requestVideoFrameCallback) return;
    const cb = () => { if (!P.jugando) { v._rvfc = false; return; } if (v.style.opacity !== "0") P.stats.vfr++; v.requestVideoFrameCallback(cb); };
    if (!v._rvfc) { v._rvfc = true; v.requestVideoFrameCallback(cb); }
  }

  // ------------------------------------------------------------------ API
  ED.player = {
    reset() { this.pausa(); P.proxies = {}; P.pedido = false; P.ovs = null; P.buffers = {}; limpiarOvs(); for (const v of P.videos) { v.removeAttribute("src"); v._alias = null; } P.videos = []; clearTimeout(P.sondeo); },
    planCambiado() { P.ovs = null; limpiarOvs(); if (ED.anim) ED.anim.planCambiado(); if (!E.plan) return; flashesPlan(); revisarProxies(); if (P.ctx) precargarAudio(); },
    mezcla,
    mostrar(t) { if (P.jugando) return true; const ok = componer(t, false); if (!ok && ED.pro) ED.pro.pintar(t, false); const c = $("#visor-ovs-play"); if (c) c.hidden = true; return ok; },
    ocultar() { for (const v of P.videos) { if (!v.paused) v.pause(); v.style.opacity = 0; } },
    scrub() { /* el arrastre del cabezal ya llama a mostrar() en cada movimiento */ },
    play(t) {
      if (!E.plan) return false;
      const { x } = vecinos(t);
      if (x && !x.negro && !listo(x.fuente) && Object.values(P.proxies).every((p) => p.estado !== "listo")) { revisarProxies(); return false; }
      flashesPlan();
      P.jugando = true; P.t0 = t; P.baseMs = performance.now();
      P.stats = { raf: 0, vfr: 0, desde: performance.now(), fps: 0, fpsVideo: 0, muestras: [] };
      const c = $("#visor-ovs-play"); if (c) c.hidden = false;
      cargarOvs();
      precargarAudio();
      programarAudio();
      conectarVideos();
      if (ED.pro) ED.pro.alReproducir(P);
      componer(t, true);
      for (const v of P.videos) contarCuadros(v);
      cancelAnimationFrame(P.raf); P.raf = requestAnimationFrame(paso);
      return true;
    },
    pausa() {
      if (!P.jugando) return;
      P.jugando = false; cancelAnimationFrame(P.raf); pararAudio();
      for (const v of P.videos) { if (!v.paused) v.pause(); v.muted = true; }
      if (ED.pro) ED.pro.pausa();
      const c = $("#visor-ovs-play"); if (c) c.hidden = true;
      $("#visor-flash").style.opacity = 0;
    },
    stats() { return { ...P.stats, proxies: P.proxies, calidad: P.videos.map((v) => v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null).filter(Boolean).map((q) => ({ total: q.totalVideoFrames, perdidos: q.droppedVideoFrames })) }; },
    _P: P,
  };
})();
