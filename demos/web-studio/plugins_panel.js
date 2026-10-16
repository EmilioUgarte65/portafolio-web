/* Web Studio — panel de PLUGINS (efectos y transiciones de usuario). Contrato en docs/plugins.md §9.
 *
 *   WDVS.plugins.montarPanel(contenedor, {tipo, alElegir(ref, plugin)})   biblioteca + "Crear con IA"
 *   WDVS.plugins.montarEditor(contenedor, {ref | manifest+codigo, alGuardar(plugin)})   modo Avanzado
 *   WDVS.plugins.controles(contenedor, parametros, valores, alCambiar)    controles del inspector por parámetros
 *   WDVS.plugins.visorGL(canvas) -> {cargar(shaderWebGL), dibujar({a, b, progress, tiempo, golpe, valores})}
 *   WDVS.plugins.visorJS(canvas, ref|codigo) -> {dibujar(t, valores, info)}  (Worker aislado)
 *   WDVS.plugins.listar(tipo) -> Promise<[resumen]>
 * Si existe WDVS.registrarPanel(def), se registra solo como {id:"plugins", titulo, icono, montar}.
 * No toca el DOM fuera del contenedor que le pasan (salvo un <style> propio con id "mnfx-css").
 */
(function () {
  "use strict";
  const WDVS = (window.WDVS = window.WDVS || {});
  const api = async (url, op = {}) => {
    const r = await fetch(url, { headers: op.body && !(op.body instanceof FormData) ? { "Content-Type": "application/json" } : {}, ...op,
      body: op.body && !(op.body instanceof FormData) && typeof op.body !== "string" ? JSON.stringify(op.body) : op.body });
    const tipo = r.headers.get("content-type") || "";
    const dato = tipo.includes("json") ? await r.json() : await r.text();
    if (!r.ok) throw new Error((dato && dato.detail) || dato || r.statusText);
    return dato;
  };
  const el = (tag, attrs = {}, ...hijos) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "html") e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
    }
    for (const h of hijos.flat()) if (h !== null && h !== undefined) e.append(h.nodeType ? h : document.createTextNode(String(h)));
    return e;
  };
  const aviso = (m, err) => (err ? (WDVS.errorToast || WDVS.toast || alert) : (WDVS.toast || console.log))(m);

  function css() {
    if (document.getElementById("mnfx-css")) return;
    const s = el("style", { id: "mnfx-css" });
    s.textContent = `
.mnfx{font:var(--fs-md,13px) var(--font,system-ui);color:var(--texto,#eee);display:flex;flex-direction:column;gap:10px;min-height:0}
.mnfx-barra{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.mnfx input,.mnfx select,.mnfx textarea{background:var(--panel2,#222);color:var(--texto,#eee);border:1px solid var(--borde,#444);border-radius:6px;padding:4px 6px;font:inherit}
.mnfx button{background:var(--panel3,#333);color:var(--texto,#eee);border:1px solid var(--borde,#444);border-radius:6px;padding:4px 10px;cursor:pointer;font:inherit}
.mnfx button.pri{background:var(--acento,#F5B82E);color:var(--on-ac,#111);border-color:transparent;font-weight:600}
.mnfx button:disabled{opacity:.5;cursor:default}
.mnfx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;overflow:auto}
.mnfx-card{background:var(--panel2,#222);border:1px solid var(--borde-suave,#333);border-radius:8px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column}
.mnfx-card:hover{border-color:var(--acento,#F5B82E)}
.mnfx-card .img{aspect-ratio:16/9;background:#000;position:relative}
.mnfx-card img,.mnfx-card video{width:100%;height:100%;object-fit:cover;display:block;position:absolute;inset:0}
.mnfx-card .t{padding:5px 7px;font-weight:600;font-size:var(--fs-sm,12px)}
.mnfx-card .s{padding:0 7px 6px;color:var(--tenue,#999);font-size:var(--fs-xs,11px)}
.mnfx-chip{font-size:10px;padding:1px 5px;border-radius:9px;background:var(--panel3,#333);margin-left:4px;color:var(--tenue,#aaa)}
.mnfx-ia{background:var(--panel,#1a1a1a);border:1px solid var(--borde-suave,#333);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px}
.mnfx-ia video{max-width:100%;border-radius:6px;background:#000}
.mnfx-ed{display:grid;grid-template-columns:220px 1fr 360px;gap:10px;min-height:420px}
.mnfx-ed>div{min-width:0;display:flex;flex-direction:column;gap:6px}
.mnfx-code{position:relative;flex:1;min-height:320px;border:1px solid var(--borde,#444);border-radius:6px;background:var(--panel2,#1d1d1d);overflow:hidden}
.mnfx-code pre,.mnfx-code textarea{position:absolute;inset:0;margin:0;padding:8px;font:12px/1.5 var(--mono,monospace);white-space:pre;overflow:auto;tab-size:4;border:0;border-radius:0}
.mnfx-code textarea{color:transparent;background:transparent;caret-color:var(--texto,#eee);resize:none;outline:none}
.mnfx-code pre{pointer-events:none;color:var(--texto,#ddd)}
.mnfx-code .k{color:#c792ea}.mnfx-code .n{color:#f78c6c}.mnfx-code .c{color:#6a737d;font-style:italic}.mnfx-code .f{color:#82aaff}.mnfx-code .s{color:#c3e88d}.mnfx-code .v{color:#ffcb6b}
.mnfx-param{display:flex;flex-direction:column;gap:2px;font-size:var(--fs-sm,12px)}
.mnfx-param label{color:var(--tenue,#aaa)}
.mnfx-param .fila{display:flex;gap:6px;align-items:center}.mnfx-param input[type=range]{flex:1}
.mnfx-prev canvas,.mnfx-prev video{width:100%;aspect-ratio:16/9;background:#000;border-radius:6px;display:block}
.mnfx-err{color:var(--error,#f66);font-size:var(--fs-sm,12px);white-space:pre-wrap}
.mnfx-ok{color:var(--ok,#3DD68C);font-size:var(--fs-sm,12px)}
@media (max-width:900px){.mnfx-ed{grid-template-columns:1fr}}`;
    document.head.append(s);
  }

  // ------------------------------------------------------------------ controles por parámetros (inspector)
  function controles(cont, parametros, valores = {}, alCambiar = () => {}) {
    cont.innerHTML = "";
    const vals = { ...valores };
    for (const p of parametros || []) {
      const v = vals[p.id] !== undefined ? vals[p.id] : p.defecto;
      vals[p.id] = v;
      const caja = el("div", { class: "mnfx-param" }, el("label", {}, p.nombre || p.id));
      const fila = el("div", { class: "fila" });
      const set = (x) => { vals[p.id] = x; alCambiar({ ...vals }, p.id); };
      if (p.tipo === "num" || p.tipo === "int") {
        const min = p.min ?? 0, max = p.max ?? Math.max(1, (typeof v === "number" ? v : 1) * 2);
        const paso = p.tipo === "int" ? 1 : (max - min) / 200;
        const r = el("input", { type: "range", min, max, step: paso, value: typeof v === "number" ? v : p.defecto });
        const n = el("input", { type: "number", min, max, step: paso, value: typeof v === "number" ? v : p.defecto, style: "width:70px" });
        r.oninput = () => { n.value = r.value; set(+r.value); };
        n.onchange = () => { r.value = n.value; set(+n.value); };
        fila.append(r, n);
        if (typeof v === "object" && v) fila.append(el("span", { class: "mnfx-chip", title: JSON.stringify(v) }, v.kf ? "keyframes" : "al beat"));
      } else if (p.tipo === "bool") {
        const c = el("input", { type: "checkbox" }); c.checked = !!v; c.onchange = () => set(c.checked); fila.append(c);
      } else if (p.tipo === "color") {
        const c = el("input", { type: "color", value: v }); c.oninput = () => set(c.value); fila.append(c);
      } else if (p.tipo === "enum") {
        const s = el("select", {}, (p.opciones || []).map((o) => el("option", { value: o, selected: o === v }, o)));
        s.onchange = () => set(s.value); fila.append(s);
      } else if (p.tipo && p.tipo.startsWith("vec")) {
        (v || []).forEach((x, i) => {
          const n = el("input", { type: "number", step: 0.05, value: x, style: "width:60px" });
          n.onchange = () => { const nv = [...vals[p.id]]; nv[i] = +n.value; set(nv); }; fila.append(n);
        });
      } else {
        const t = el("input", { type: "text", value: v || "" }); t.onchange = () => set(t.value); fila.append(t);
      }
      caja.append(fila);
      cont.append(caja);
    }
    return { valores: () => ({ ...vals }) };
  }

  // ------------------------------------------------------------------ visor WebGL (mismo shader que el render)
  const VERT = "attribute vec2 p;varying vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);}";
  function visorGL(canvas) {
    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL no disponible");
    let prog = null, unis = {};
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const tex = [gl.createTexture(), gl.createTexture()];
    tex.forEach((t) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); });
    const sh = (tipo, src) => { const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    function cargar(frag) {
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      prog = p; unis = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); unis[u.name] = { loc: gl.getUniformLocation(p, u.name), type: u.type }; }
    }
    function subir(i, fuente) {
      if (!fuente) return;
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[i]);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fuente); } catch (e) { /* video sin datos aún */ }
    }
    const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    function poner(nombre, v, parametros) {
      const u = unis[nombre]; if (!u) return;
      const p = (parametros || []).find((x) => x.id === nombre);
      if (p && p.tipo === "enum") v = Math.max(0, (p.opciones || []).indexOf(v));
      if (typeof v === "string" && v[0] === "#") v = hexRgb(v);
      if (typeof v === "boolean") v = v ? 1 : 0;
      const T = gl;
      switch (u.type) {
        case T.FLOAT: gl.uniform1f(u.loc, +v); break;
        case T.INT: case T.BOOL: gl.uniform1i(u.loc, Math.round(+v)); break;
        case T.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break; case T.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
        case T.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break; case T.INT_VEC2: gl.uniform2iv(u.loc, v.map(Math.round)); break;
      }
    }
    function dibujar({ a, b, progress = 0, tiempo = 0, golpe = 0, valores = {}, parametros = [] }) {
      if (!prog) return;
      canvas.width = canvas.clientWidth || 640; canvas.height = Math.round(canvas.width * 9 / 16);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      subir(0, a); subir(1, b);
      for (const [n, i] of [["mn_from", 0], ["mn_src", 0], ["mn_to", 1]]) if (unis[n]) gl.uniform1i(unis[n].loc, i);
      poner("progress", progress); poner("ratio", canvas.width / canvas.height); poner("tiempo", tiempo); poner("golpe", golpe);
      if (unis.resolucion) gl.uniform2f(unis.resolucion.loc, canvas.width, canvas.height);
      for (const [k, v] of Object.entries(valores)) poner(k, evaluar(v, tiempo), parametros);
      const loc = gl.getAttribLocation(prog, "p");
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    return { cargar, dibujar };
  }
  // mismo cálculo que videostudio/plugins/params.py::evaluar (keyframes lineales/suaves; al_beat aprox. cada 0.5 s)
  function evaluar(v, t) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return v;
    if (v.kf) {
      const kf = v.kf.map((k) => (Array.isArray(k) ? k : [k.t, k.v, k.ease]));
      if (t <= kf[0][0]) return kf[0][1];
      for (let i = 0; i < kf.length - 1; i++) {
        const [ta, va, e] = kf[i], [tb, vb] = kf[i + 1];
        if (t < tb) { let p = (t - ta) / Math.max(tb - ta, 1e-9);
          p = e === "suave" ? p * p * (3 - 2 * p) : e === "entrada" ? p * p : e === "salida" ? 1 - (1 - p) * (1 - p) : p;
          return va + (vb - va) * p; }
      }
      return kf[kf.length - 1][1];
    }
    if (v.al_beat || v.beat) { const b = v.beat || v; const d = t % 0.5; return b.base + (b.pico - b.base) * Math.exp(-d * (b.caida || 8)); }
    return v;
  }

  // ------------------------------------------------------------------ visor JS (Worker aislado)
  function visorJS(canvas, fuente) {
    let w = null, listo = false, pend = null;
    const ctx = canvas.getContext("2d");
    const url = fuente.ref ? `/api/plugins/${encodeURIComponent(fuente.ref)}/worker.js` : null;
    const arrancar = async () => {
      let src = url;
      if (!src) { const txt = await api("/api/plugins/worker", { method: "POST", body: { manifest: fuente.manifest || {}, codigo: fuente.codigo } });
        src = URL.createObjectURL(new Blob([txt], { type: "text/javascript" })); }
      w = new Worker(src);
      w.onmessage = (e) => { const d = e.data; if (d.listo) { listo = true; if (pend) enviar(pend); return; }
        if (d.error) { fuente.alError && fuente.alError(d.error); return; }
        if (d.bitmap) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(d.bitmap, 0, 0); } };
      w.postMessage({ init: { W: canvas.width, H: canvas.height } });
    };
    const enviar = (m) => w.postMessage({ ...m, bitmap: true });
    arrancar().catch((e) => fuente.alError && fuente.alError(String(e.message || e)));
    return {
      dibujar(t, valores, info) {
        const p = {}; for (const [k, v] of Object.entries(valores || {})) p[k] = evaluar(v, t);
        const m = { i: 0, t, p, info: { W: canvas.width, H: canvas.height, fps: 30, dur: 2, progreso: 0, golpe: 0, cuadro: 0, escala: canvas.width / 1920, ...info } };
        if (listo) enviar(m); else pend = m;
      },
      cerrar() { w && w.terminate(); },
    };
  }

  // ------------------------------------------------------------------ biblioteca
  const listar = async (tipo) => (await api("/api/plugins" + (tipo ? `?tipo=${tipo}` : ""))).plugins;

  function tarjeta(p, alElegir) {
    const img = el("div", { class: "img" });
    if (p.preview) img.append(el("img", { src: `/api/plugins/${encodeURIComponent(p.ref)}/archivo/miniatura.png`, loading: "lazy", alt: "" }));
    const c = el("div", { class: "mnfx-card", title: `${p.descripcion}\n${p.ref} · ${p.motor} · ${p.licencia} · ${p.autor}` }, img,
      el("div", { class: "t" }, p.nombre, el("span", { class: "mnfx-chip" }, p.tipo === "transicion" ? "trans." : p.tipo)),
      el("div", { class: "s" }, `${p.categoria} · v${p.version}${p.origen !== "incluida" ? " · " + p.origen : ""}`));
    c.onmouseenter = () => { if (!p.preview || img.querySelector("video")) return;
      img.append(el("video", { src: `/api/plugins/${encodeURIComponent(p.ref)}/archivo/preview.mp4`, autoplay: true, loop: true, muted: true, playsinline: true })); };
    c.onmouseleave = () => { const v = img.querySelector("video"); v && v.remove(); };
    c.onclick = () => alElegir && alElegir(p.ref, p);
    return c;
  }

  function montarPanel(cont, op = {}) {
    css();
    cont.innerHTML = "";
    const raiz = el("div", { class: "mnfx" });
    cont.append(raiz);
    const q = el("input", { type: "search", placeholder: "Buscar efecto o transición…", style: "flex:1;min-width:140px" });
    const selTipo = el("select", {}, ["", "transicion", "efecto", "generador", "texto"].map((t) => el("option", { value: t, selected: t === (op.tipo || "") }, t || "Todos")));
    const btnIA = el("button", { class: "pri" }, "✨ Crear con IA");
    const btnImp = el("button", {}, "Importar .mnfx");
    const btnNuevo = el("button", {}, "Código (Avanzado)");
    const grid = el("div", { class: "mnfx-grid" });
    const iaCaja = el("div", { class: "mnfx-ia", style: "display:none" });
    const detalle = el("div", { class: "mnfx-ia", style: "display:none" });
    raiz.append(el("div", { class: "mnfx-barra" }, q, selTipo, btnIA, btnNuevo, btnImp), iaCaja, detalle, grid);
    let todos = [];
    const pintar = () => {
      const t = q.value.trim().toLowerCase();
      grid.innerHTML = "";
      const lista = todos.filter((p) => (!selTipo.value || p.tipo === selTipo.value) &&
        (!t || `${p.nombre} ${p.id} ${p.categoria} ${p.descripcion}`.toLowerCase().includes(t)));
      lista.forEach((p) => grid.append(tarjeta(p, (ref) => (op.alElegir ? op.alElegir(ref, p) : verDetalle(p)))));
      if (!lista.length) grid.append(el("div", { class: "s" }, "Nada por aquí. Prueba “Crear con IA”."));
    };
    const cargar = async () => { todos = await listar(); pintar(); };
    q.oninput = pintar; selTipo.onchange = pintar;

    function verDetalle(p) {
      detalle.style.display = ""; detalle.innerHTML = "";
      detalle.append(el("div", { class: "mnfx-barra" }, el("b", {}, p.nombre), el("span", { class: "mnfx-chip" }, p.ref),
        el("span", { class: "mnfx-chip" }, p.motor), el("span", { class: "mnfx-chip" }, p.licencia),
        el("button", { onclick: () => { detalle.style.display = "none"; } }, "Cerrar")),
      el("div", {}, p.descripcion), el("div", { class: "s" }, `Autor: ${p.autor}`),
      p.preview ? el("video", { src: `/api/plugins/${encodeURIComponent(p.ref)}/archivo/preview.mp4`, autoplay: true, loop: true, muted: true, style: "max-width:420px" }) : null,
      el("div", { class: "mnfx-barra" },
        el("button", { onclick: () => abrirEditor({ ref: p.ref }) }, "Ver / editar código"),
        el("button", { onclick: () => pedirVariante(p) }, "Variante con IA"),
        el("a", { href: `/api/plugins/${encodeURIComponent(p.ref)}/exportar` }, el("button", {}, "Exportar .mnfx")),
        p.origen !== "incluida" ? el("button", { onclick: async () => { if (!confirm(`¿Borrar ${p.ref}?`)) return;
          await api(`/api/plugins/${encodeURIComponent(p.ref)}?origen=${p.origen}`, { method: "DELETE" }); detalle.style.display = "none"; cargar(); } }, "Borrar") : null));
    }

    function abrirEditor(fuente) {
      detalle.style.display = ""; detalle.innerHTML = "";
      const c = el("div"); detalle.append(el("div", { class: "mnfx-barra" }, el("b", {}, "Modo Avanzado"),
        el("button", { onclick: () => { detalle.style.display = "none"; } }, "Cerrar")), c);
      montarEditor(c, { ...fuente, alGuardar: () => cargar() });
    }
    btnNuevo.onclick = () => abrirEditor({});

    async function esperar(tid, info) {
      for (;;) {
        await new Promise((r) => setTimeout(r, 1500));
        const t = await api(`/api/plugins/trabajos/${tid}`);
        if (t.estado !== "trabajando") return t;
        info.textContent = `Creando… ${Math.round((Date.now() / 1000) - t.inicio)} s`;
      }
    }
    function mostrarBorrador(t) {
      iaCaja.innerHTML = "";
      const r = t.resultado || {};
      if (t.estado !== "listo") { iaCaja.append(el("div", { class: "mnfx-err" }, "No se pudo crear: " + (t.error || "")), el("button", { onclick: () => (iaCaja.style.display = "none") }, "Cerrar")); return; }
      const m = r.manifest; const u = r.uso || {};
      iaCaja.append(el("div", { class: "mnfx-barra" }, el("b", {}, m.nombre), el("span", { class: "mnfx-chip" }, `${m.id}@${m.version}`),
          el("span", { class: "mnfx-chip" }, m.motor), el("span", { class: "mnfx-chip", title: JSON.stringify(u.tokens) }, `${u.tokens_total} tokens · ${u.intentos} intento(s)`)),
        el("div", {}, m.descripcion),
        el("video", { src: r.preview_url, autoplay: true, loop: true, muted: true, style: "max-width:480px" }),
        el("div", { class: "mnfx-barra" },
          el("button", { class: "pri", onclick: async () => { const pl = await api(`/api/plugins/borradores/${r.borrador}/aceptar`, { method: "POST", body: {} });
            aviso(`Guardado en tu biblioteca: ${pl.ref}. Ya se usa sin IA.`); iaCaja.style.display = "none"; cargar(); } }, "Aceptar y guardar"),
          el("button", { onclick: () => { iaCaja.style.display = "none"; abrirEditor({ manifest: m, codigo: r.codigo, borrador: r.borrador }); } }, "Ajustar código"),
          el("button", { onclick: async () => { await api(`/api/plugins/borradores/${r.borrador}/descartar`, { method: "POST" }); iaCaja.style.display = "none"; } }, "Descartar")));
    }
    async function lanzar(url, body) {
      iaCaja.style.display = ""; iaCaja.innerHTML = "";
      const info = el("div", { class: "s" }, "Creando con IA…"); iaCaja.append(info);
      try { const { trabajo } = await api(url, { method: "POST", body }); mostrarBorrador(await esperar(trabajo, info)); }
      catch (e) { iaCaja.append(el("div", { class: "mnfx-err" }, String(e.message || e))); }
    }
    btnIA.onclick = () => {
      iaCaja.style.display = ""; iaCaja.innerHTML = "";
      const d = el("textarea", { rows: 2, placeholder: "Ej.: transición donde la imagen se rompe como vidrio · efecto de pantalla de Game Boy · zoom que late con la música con aberración cromática" });
      const t = el("select", {}, [["", "Que la IA decida"], ["transicion", "Transición"], ["efecto", "Efecto"], ["generador", "Overlay animado"]].map(([v, n]) => el("option", { value: v }, n)));
      iaCaja.append(el("b", {}, "Crear con IA (queda guardado como código: después se usa sin IA)"), d,
        el("div", { class: "mnfx-barra" }, t, el("button", { class: "pri", onclick: () => d.value.trim() && lanzar("/api/plugins/ia/crear", { descripcion: d.value.trim(), tipo: t.value || null }) }, "Crear"),
          el("button", { onclick: () => (iaCaja.style.display = "none") }, "Cancelar")));
      d.focus();
    };
    function pedirVariante(p) {
      const ins = prompt(`¿Qué ajuste quieres en "${p.nombre}"? (se guarda como nueva versión)`);
      if (ins) lanzar("/api/plugins/ia/variante", { ref: p.ref, instruccion: ins });
    }
    btnImp.onclick = () => {
      const f = el("input", { type: "file", accept: ".mnfx" });
      f.onchange = async () => { const fd = new FormData(); fd.append("archivo", f.files[0]);
        try { const r = await api("/api/plugins/importar", { method: "POST", body: fd }); aviso(`Instalados: ${r.instalados.map((x) => x.ref).join(", ")}`); cargar(); }
        catch (e) { aviso(String(e.message || e), true); } };
      f.click();
    };
    cargar().catch((e) => grid.append(el("div", { class: "mnfx-err" }, String(e.message || e))));
    return { recargar: cargar };
  }

  // ------------------------------------------------------------------ editor de código (modo Avanzado)
  const PALABRAS = /\b(uniform|float|int|bool|vec[234]|ivec2|return|if|else|for|const|void|function|let|var|true|false|mix|clamp|smoothstep|step|sin|cos|fract|floor|length|dot|abs|pow|max|min)\b/g;
  function resaltar(txt) {
    const esc = txt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc.replace(/(\/\/[^\n]*)|("[^"\n]*"|'[^'\n]*')|(\{[A-Za-z_]\w*\})|(\b\d+\.?\d*\b)|\b([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)/g,
      (m, c, s, v, n, f, w) => c ? `<span class="c">${c}</span>` : s ? `<span class="s">${s}</span>` : v ? `<span class="v">${v}</span>`
        : n ? `<span class="n">${n}</span>` : f ? (PALABRAS.test(f) ? (PALABRAS.lastIndex = 0, `<span class="k">${f}</span>`) : `<span class="f">${f}</span>`)
          : (PALABRAS.lastIndex = 0, PALABRAS.test(w) ? (PALABRAS.lastIndex = 0, `<span class="k">${w}</span>`) : w)) + "\n";
  }
  const PLANTILLAS = {
    "transicion/glsl": { p: [{ id: "suavidad", nombre: "Suavidad", tipo: "num", min: 0, max: 0.5, defecto: 0.1 }],
      c: "uniform float suavidad; // = 0.1\n\nvec4 transition(vec2 uv) {\n    float m = smoothstep(progress - suavidad, progress + suavidad, uv.x);\n    return mix(getToColor(uv), getFromColor(uv), m);\n}\n" },
    "efecto/glsl": { p: [{ id: "fuerza", nombre: "Fuerza", tipo: "num", min: 0, max: 1, defecto: 0.5 }],
      c: "uniform float fuerza; // = 0.5\n\nvec4 efecto(vec2 uv) {\n    vec4 c = getColor(uv);\n    return vec4(mix(c.rgb, 1.0 - c.rgb, fuerza * golpe), 1.0);\n}\n" },
    "efecto/ffmpeg": { p: [{ id: "sat", nombre: "Saturación", tipo: "num", min: 0, max: 3, defecto: 1.5 }],
      c: "eq=saturation='{sat}':eval=frame,hue=h='20*{golpe}'" },
    "transicion/ffmpeg": { p: [], c: "if(gt(X/W,{progreso}),A,B)" },
    "generador/js": { p: [{ id: "color", nombre: "Color", tipo: "color", defecto: "#FFD23F" }],
      c: "function dibujar(ctx, t, p, info) {\n  const r = 40 * info.escala * (1 + info.golpe);\n  ctx.fillStyle = p.color;\n  ctx.beginPath();\n  ctx.arc(info.W / 2 + Math.sin(t * 3) * info.W * 0.3, info.H / 2, r, 0, Math.PI * 2);\n  ctx.fill();\n}\n" },
  };

  function montarEditor(cont, op = {}) {
    css();
    cont.innerHTML = "";
    const raiz = el("div", { class: "mnfx" }); cont.append(raiz);
    const izq = el("div"), centro = el("div"), der = el("div", { class: "mnfx-prev" });
    raiz.append(el("div", { class: "mnfx-ed" }, izq, centro, der));
    let man = null, codigo = "", valores = {}, gl = null, vjs = null, anim = 0;
    const ta = el("textarea", { spellcheck: "false" }), pre = el("pre");
    const caja = el("div", { class: "mnfx-code" }, pre, ta);
    const estado = el("div", { class: "s" });
    const errores = el("div", { class: "mnfx-err" });
    const fId = el("input", { placeholder: "usr.mi_efecto" }), fNom = el("input", { placeholder: "Nombre" }), fVer = el("input", { value: "1.0.0", style: "width:70px" });
    const fTipo = el("select", {}, ["efecto", "transicion", "generador"].map((t) => el("option", { value: t }, t)));
    const fMotor = el("select", {}, ["glsl", "ffmpeg", "js"].map((t) => el("option", { value: t }, t)));
    const fDesc = el("input", { placeholder: "Descripción" }), fCat = el("input", { placeholder: "Categoría", value: "General" });
    const fParams = el("textarea", { rows: 6, style: "font:11px var(--mono,monospace)" });
    const ctrls = el("div");
    const canvas = el("canvas", { width: 640, height: 360 });
    const video = el("video", { controls: true, loop: true, muted: true, style: "display:none" });
    const vidA = el("video", { src: "/api/plugins/muestras/a.mp4", muted: true, loop: true, playsinline: true, crossorigin: "anonymous" });
    const vidB = el("video", { src: "/api/plugins/muestras/b.mp4", muted: true, loop: true, playsinline: true, crossorigin: "anonymous" });
    vidA.play().catch(() => {}); vidB.play().catch(() => {});
    centro.append(el("div", { class: "mnfx-barra" }, fId, fVer, fNom, fTipo, fMotor), el("div", { class: "mnfx-barra" }, fCat, fDesc), caja, errores,
      el("div", { class: "mnfx-barra" }, el("button", { onclick: () => validar() }, "Validar"),
        el("button", { onclick: () => renderReal() }, "Render real (ffmpeg)"),
        el("button", { class: "pri", onclick: () => guardar() }, "Guardar en mi biblioteca"), estado));
    izq.append(el("b", {}, "Parámetros"), ctrls, el("details", {}, el("summary", {}, "Definición (JSON)"), fParams));
    der.append(el("b", {}, "Vista previa en vivo"), canvas, video, el("div", { class: "s" }, "El visor usa el mismo shader que el render final (libplacebo). Para ffmpeg usa “Render real”."));

    const leerParams = () => { try { return JSON.parse(fParams.value || "[]"); } catch (e) { return null; } };
    const manifest = () => ({ formato: "mnfx/1", id: fId.value.trim(), version: fVer.value.trim(), nombre: fNom.value.trim() || fId.value.trim(),
      categoria: fCat.value.trim() || "General", tipo: fTipo.value, motor: fMotor.value, descripcion: fDesc.value.trim() || fNom.value.trim() || "Plugin",
      autor: (man && man.autor) || "yo", licencia: (man && man.licencia) || "propia", parametros: leerParams() || [],
      ...(man && man.duracion_sugerida ? { duracion_sugerida: man.duracion_sugerida } : {}) });
    const pintarCodigo = () => { pre.innerHTML = resaltar(ta.value); pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; };
    ta.addEventListener("input", () => { pintarCodigo(); programar(); });
    ta.addEventListener("scroll", () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
    ta.addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText("    ", s, ta.selectionEnd, "end"); pintarCodigo(); } });
    fParams.addEventListener("change", () => { pintarControles(); programar(); });
    [fTipo, fMotor].forEach((f) => f.addEventListener("change", () => { if (!ta.value.trim() || confirm("¿Cargar la plantilla de este tipo/motor?")) plantilla(); }));

    function pintarControles() { const ps = leerParams(); if (!ps) { errores.textContent = "JSON de parámetros inválido"; return; }
      controles(ctrls, ps, valores, (v) => { valores = v; }); }
    function plantilla() {
      const k = `${fTipo.value}/${fMotor.value}`; const pl = PLANTILLAS[k] || PLANTILLAS["efecto/glsl"];
      ta.value = pl.c; fParams.value = JSON.stringify(pl.p, null, 1); valores = {}; pintarCodigo(); pintarControles(); programar();
    }
    let t0 = 0;
    function programar() { clearTimeout(t0); t0 = setTimeout(recompilar, 400); }
    async function recompilar() {
      errores.textContent = ""; cancelAnimationFrame(anim); if (vjs) { vjs.cerrar(); vjs = null; }
      const m = manifest();
      canvas.style.display = ""; video.style.display = "none";
      if (m.motor === "glsl") {
        try { const frag = await api("/api/plugins/shader_webgl", { method: "POST", body: { manifest: m, codigo: ta.value } });
          gl = gl || visorGL(canvas); gl.cargar(frag); bucleGL(m); }
        catch (e) { errores.textContent = "Shader: " + (e.message || e); }
      } else if (m.motor === "js") {
        vjs = visorJS(canvas, { codigo: ta.value, manifest: m, alError: (x) => (errores.textContent = "JS: " + x) }); bucleJS();
      } else { estado.textContent = "Motor ffmpeg: usa “Render real” para ver el resultado."; }
    }
    function bucleGL(m) {
      const ini = performance.now();
      const paso = () => { const t = (performance.now() - ini) / 1000;
        const ciclo = m.tipo === "transicion" ? 2.0 : 4.0; const tt = t % ciclo;
        const prog = m.tipo === "transicion" ? Math.min(1, Math.max(0, (tt - 0.5) / 1.0)) : tt / ciclo;
        gl.dibujar({ a: vidA, b: vidB, progress: prog, tiempo: tt, golpe: Math.exp(-(tt % 0.5) * 8), valores: controlesVals(), parametros: leerParams() || [] });
        anim = requestAnimationFrame(paso); };
      paso();
    }
    function bucleJS() {
      const ini = performance.now();
      const paso = () => { const t = ((performance.now() - ini) / 1000) % 4; vjs && vjs.dibujar(t, controlesVals(), { progreso: t / 4, golpe: Math.exp(-(t % 0.5) * 8), dur: 4 });
        anim = requestAnimationFrame(paso); };
      paso();
    }
    const controlesVals = () => { const ps = leerParams() || []; const o = {}; ps.forEach((p) => (o[p.id] = valores[p.id] !== undefined ? valores[p.id] : p.defecto)); return o; };
    async function validar() {
      const r = await api("/api/plugins/validar", { method: "POST", body: { manifest: manifest(), codigo: ta.value } });
      errores.textContent = r.ok ? "" : r.errores.join("\n"); estado.textContent = r.ok ? "✓ válido" : "";
      return r.ok;
    }
    async function renderReal() {
      if (!(await validar())) return;
      estado.textContent = "Renderizando con el motor real…";
      try { const r = await api("/api/plugins/preview", { method: "POST", body: { manifest: manifest(), codigo: ta.value, valores: controlesVals() } });
        video.src = r.url; video.style.display = ""; canvas.style.display = "none"; video.play(); estado.textContent = `Render real en ${r.segundos} s`; }
      catch (e) { errores.textContent = String(e.message || e); estado.textContent = ""; }
    }
    async function guardar() {
      if (!(await validar())) return;
      estado.textContent = "Probando y guardando…";
      const m = manifest();
      try {
        const pl = op.borrador ? await api(`/api/plugins/borradores/${op.borrador}/aceptar`, { method: "POST", body: { manifest: m, codigo: ta.value } })
          : await api("/api/plugins/guardar", { method: "POST", body: { manifest: m, codigo: ta.value } });
        estado.textContent = `✓ Guardado ${pl.ref}`; aviso(`Guardado ${pl.ref}`); op.alGuardar && op.alGuardar(pl);
      } catch (e) { errores.textContent = String(e.message || e); estado.textContent = ""; }
    }
    (async () => {
      if (op.ref) { const d = await api(`/api/plugins/${encodeURIComponent(op.ref)}`); man = d.manifest; codigo = d.codigo;
        if (d.origen === "incluida" || true) { /* editar = nueva versión */ } }
      else if (op.manifest) { man = op.manifest; codigo = op.codigo || ""; }
      if (man) {
        fId.value = man.id; fNom.value = man.nombre || ""; fTipo.value = man.tipo; fMotor.value = man.motor; fDesc.value = man.descripcion || ""; fCat.value = man.categoria || "";
        fVer.value = op.ref ? man.version.replace(/(\d+)$/, (x) => String(+x + 1)) : man.version;
        if (op.ref && man.id.startsWith("gl.")) { fId.value = "usr." + man.id.slice(3); fVer.value = "1.0.0"; }
        fParams.value = JSON.stringify(man.parametros || [], null, 1); ta.value = codigo; pintarCodigo(); pintarControles(); recompilar();
      } else plantilla();
    })().catch((e) => (errores.textContent = String(e.message || e)));
    return { cerrar() { cancelAnimationFrame(anim); vjs && vjs.cerrar(); } };
  }

  WDVS.plugins = { montarPanel, montarEditor, controles, visorGL, visorJS, listar, evaluar, api };
  if (typeof WDVS.registrarPanel === "function") {
    WDVS.registrarPanel({ id: "plugins", titulo: "Efectos y transiciones", icono: "sparkles", montar: (c, op) => montarPanel(c, op) });
  }
})();
