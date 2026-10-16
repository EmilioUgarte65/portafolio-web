"use strict";
// Web Studio — Editor: guías de área segura POR PLATAFORMA en el visor y "Crear versión para…".
// Datos: GET /api/editor/formatos (engine/formatos.py: área segura, zonas de interfaz de TikTok/Reels/Shorts/feed,
// fuentes) y POST /api/proyectos/{pid}/editor/version_formato (pipeline/formatos.py). Ver docs/formatos.md.
// Módulo aparte (no reescribe editor.js). Enganche:
//   1) editor.js, cargaModulos: agregar "editor_guias.js" a la lista de módulos.
//   2) editor.js, menuExportar(): agregar el ítem ["Crear versión para 9:16 / 1:1 / 4:5…", () => ED.guias.menuVersiones(b.left, b.bottom)]
//      y poner ED.guias.sinBoton = true (quita el botón provisional «Versión para…» junto a Exportar).
// Con el botón «Área segura» del visor encendido se dibujan el área segura de la plataforma (línea ámbar) y sus
// zonas de interfaz (rojo); un selector elige la plataforma (la del plan o cualquier otra, solo para mirar). Los
// textos cuya tinta invade una zona o sale del área segura se marcan en rojo con el motivo en el tooltip.
(() => {
  const G = { info: new Map(), plataforma: "plan", tinta: new Map(), sinBoton: false, obs: null, pend: 0 };
  const css = `
  .visor-plataforma{position:absolute;inset:0;pointer-events:none;z-index:12;display:none}
  .visor.con-segura .visor-plataforma{display:block}
  .visor.con-segura.con-plataforma .visor-segura{display:none}
  .visor-plataforma .segura{position:absolute;border:1.5px dashed rgba(245,184,46,.9)}
  .visor-plataforma .zona{position:absolute;background:rgba(229,57,53,.18);border:1px solid rgba(229,57,53,.55)}
  .visor-plataforma .zona span{position:absolute;left:3px;top:2px;font:600 10px/1.2 system-ui,sans-serif;color:#fff;
    text-shadow:0 1px 2px #000;max-width:95%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .visor-plataforma .aviso{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);background:rgba(160,20,20,.9);
    color:#fff;font:600 11px/1.3 system-ui,sans-serif;padding:3px 8px;border-radius:6px;white-space:nowrap}
  #visor-ovs img.ov.invade{outline:2px dashed #ff5252;outline-offset:2px}
  #ed-plataforma{max-width:150px}`;

  function iniciar() {
    const ED = window.WDED;
    if (!ED || !ED.E) return setTimeout(iniciar, 250);
    const { E, $, el, pedir, toast } = ED;
    if (!document.getElementById("wded-guias-css")) {
      const st = document.createElement("style"); st.id = "wded-guias-css"; st.textContent = css; document.head.append(st);
    }
    try { G.plataforma = JSON.parse(sessionStorage.getItem("wded_plataforma") || '"plan"') || "plan"; } catch { G.plataforma = "plan"; }

    const dims = () => {
      const pr = (E.plan && E.plan.proyecto) || {};
      return { W: pr.ancho || 1920, H: pr.alto || 1080, plat: G.plataforma === "plan" ? (pr.plataforma || "") : G.plataforma };
    };
    async function info() {
      const { W, H, plat } = dims();
      const k = `${W}x${H}:${plat}`;
      if (!G.info.has(k)) {
        G.info.set(k, null);
        const r = await pedir(`/api/editor/formatos?ancho=${W}&alto=${H}` + (plat ? `&plataforma=${encodeURIComponent(plat)}` : ""));
        if (r.ok) G.info.set(k, r.d); else G.info.delete(k);
      }
      return G.info.get(k);
    }

    async function render() {
      const vis = $("#visor"); if (!vis || !E.plan) return;
      const d = await info(); if (!d) return;
      const f = d.formato, W = f.ancho, H = f.alto;
      let capa = vis.querySelector(".visor-plataforma");
      if (!capa) { capa = el("div", { class: "visor-plataforma", "aria-hidden": "true" }); vis.append(capa); }
      if (!vis.classList.contains("con-plataforma")) vis.classList.add("con-plataforma");
      const pct = (v, T) => (100 * v / T).toFixed(3) + "%";
      const [x0, y0, x1, y1] = f.area_segura;
      capa.innerHTML = "";
      capa.append(el("div", { class: "segura", title: `Área segura: ${f.nombre}`, style: { left: pct(x0, W), top: pct(y0, H), width: pct(x1 - x0, W), height: pct(y1 - y0, H) } }));
      for (const z of f.zonas || []) {
        const [a, b, c, e] = z.rect;
        capa.append(el("div", { class: "zona", title: z.nombre, style: { left: (100 * a).toFixed(2) + "%", top: (100 * b).toFixed(2) + "%", width: (100 * (c - a)).toFixed(2) + "%", height: (100 * (e - b)).toFixed(2) + "%" } }, el("span", {}, z.nombre)));
      }
      asegurarControles(d);
      revisar();
    }

    // tinta real del PNG (alfa > 40): el PNG trae relleno transparente alrededor del texto
    function tinta(img) {
      const u = img.src;
      if (G.tinta.has(u)) return G.tinta.get(u);
      if (!img.complete || !img.naturalWidth) return null;
      try {
        const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const cx = c.getContext("2d", { willReadFrequently: true }); cx.drawImage(img, 0, 0);
        const a = cx.getImageData(0, 0, c.width, c.height).data;
        let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
        for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
          if (a[(y * c.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        const r = x1 < 0 ? null : { x0: x0 / c.width, y0: y0 / c.height, x1: (x1 + 1) / c.width, y1: (y1 + 1) / c.height };
        G.tinta.set(u, r);
        return r;
      } catch { return null; }
    }

    async function revisar() {
      const vis = $("#visor"), cont = $("#visor-ovs"); if (!vis || !cont || !E.plan) return;
      const d = await info(); if (!d) return;
      const f = d.formato, [sx0, sy0, sx1, sy1] = f.area_segura;
      const malos = [];
      for (const im of cont.querySelectorAll("img.ov")) {
        const o = im._o; if (!o || o.w == null) continue;
        if (!im.complete) { im.addEventListener("load", () => revisar(), { once: true }); continue; }
        const t = tinta(im); if (!t) continue;
        const bx0 = o.cx - o.w / 2 + t.x0 * o.w, bx1 = o.cx - o.w / 2 + t.x1 * o.w;
        const by0 = o.cy - o.h / 2 + t.y0 * o.h, by1 = o.cy - o.h / 2 + t.y1 * o.h;
        const motivos = [];
        if (bx0 < sx0 - 1 || bx1 > sx1 + 1 || by0 < sy0 - 1 || by1 > sy1 + 1) motivos.push(`sale del área segura de ${f.nombre}`);
        for (const z of f.zonas || []) {
          const [a, b, c, e] = z.rect;
          if (bx1 > a * f.ancho && bx0 < c * f.ancho && by1 > b * f.alto && by0 < e * f.alto) motivos.push(`queda bajo «${z.nombre}»`);
        }
        im.classList.toggle("invade", motivos.length > 0);
        if (motivos.length) { im.title = "Texto: " + motivos.join("; "); malos.push(motivos[0]); } else if (im.title.startsWith("Texto: ")) im.title = "";
      }
      const capa = vis.querySelector(".visor-plataforma"); if (!capa) return;
      let av = capa.querySelector(".aviso");
      if (malos.length) {
        if (!av) { av = el("div", { class: "aviso" }); capa.append(av); }
        av.textContent = `Aviso: ${malos.length === 1 ? "un texto" : malos.length + " textos"} ${malos[0].replace(/^sale/, "sale(n)")}`;
      } else if (av) av.remove();
    }

    function asegurarControles(d) {
      const barra = $("#visor-barra");
      if (barra && !$("#ed-plataforma")) {
        const sel = el("select", { id: "ed-plataforma", title: "Plataforma de las guías de área segura (solo para mirar; la del video se cambia con «Crear versión para…»)", "aria-label": "Plataforma de las guías" });
        sel.append(el("option", { value: "plan" }, "Guía: la del video"));
        for (const [k, p] of Object.entries(d.plataformas || {})) sel.append(el("option", { value: k }, `${p.nombre}`));
        sel.value = G.plataforma;
        sel.onchange = () => { G.plataforma = sel.value; try { sessionStorage.setItem("wded_plataforma", JSON.stringify(sel.value)); } catch { /* sin almacenamiento */ } render(); };
        const seg = $("#ed-segura");
        if (seg && seg.nextSibling) barra.insertBefore(sel, seg.nextSibling); else barra.append(sel);
      }
      const exp = $("#ed-exportar");
      if (exp && !G.sinBoton && !$("#ed-version-formato")) {
        const b = el("button", { class: "bt", id: "ed-version-formato", title: "Crear versión para otro formato (9:16, 1:1, 4:5): duplica el plan como versión nueva, reencuadra las tomas y re-maqueta los textos" }, "Versión para…");
        b.onclick = () => { const r = b.getBoundingClientRect(); menuVersiones(r.left, r.bottom + 4); };
        exp.parentNode.insertBefore(b, exp);
      }
    }

    async function crearVersion(formato, plataforma) {
      toast(`Creando la versión ${formato}…`, "info", 2500);
      const r = await pedir(`${ED.pidURL()}/editor/version_formato`, { method: "POST", json: { formato, plataforma: plataforma || null } });
      if (!r.ok) return toast(r.d.detail || "No se pudo crear la versión");
      await ED.cargar(true);
      const c = (r.d.info && r.d.info.cambios) || [];
      toast(`Versión ${formato} creada (versión nueva en el historial). ${c.slice(0, 3).join(" · ")}`, "ok", 6000);
      G.info.clear(); render();
    }
    function menuVersiones(x, y) {
      ED.menu(x, y, [
        ["Vertical 9:16 (TikTok, Reels y Shorts)", () => crearVersion("9:16")],
        ["TikTok 9:16", () => crearVersion("9:16", "tiktok")],
        ["Reels 9:16", () => crearVersion("9:16", "reels")],
        ["YouTube Shorts 9:16", () => crearVersion("9:16", "shorts")],
        "-",
        ["Feed de Instagram 1:1", () => crearVersion("1:1")],
        ["Feed de Instagram 4:5", () => crearVersion("4:5")],
        "-",
        ["YouTube / evento 16:9", () => crearVersion("16:9")],
      ]);
    }

    // el visor y sus overlays se reconstruyen a menudo: se observa y se vuelve a pintar (con rebote)
    const pronto = () => { clearTimeout(G.pend); G.pend = setTimeout(render, 80); };
    G.obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.target.id === "visor-ovs" || (m.target.id === "visor" && m.type === "attributes") ||
            [...m.addedNodes].some((n) => n.id === "visor" || (n.querySelector && n.querySelector("#visor")))) { pronto(); return; }
      }
    });
    G.obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    Object.assign(G, { render, revisar, crearVersion, menuVersiones });
    ED.guias = G;
    pronto();
  }
  iniciar();
})();
