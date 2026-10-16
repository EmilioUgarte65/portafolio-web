/* Distrito — festejos: cofre de recompensas, desbloqueos y tour de bienvenida.
   Reglas que siguen (ver docs/INVESTIGACION-GAMIFICACION.md):
   - premio variable pero NUNCA vacio y sin girar numeros (nada de mecanicas de tragamonedas);
   - celebraciones grandes solo en hitos (nivel, insignia, jefe vencido); lo rutinario es breve;
   - todo se puede saltar. */
'use strict';

function festejo(texto, el) {
  Juego.celebrar('logro', { el });
  flotante(texto);
}

/* Cada mañana, cuando el sistema ya trajo las ventas de ayer: se sellan una por una las misiones confirmadas, antes del
   cofre. Así el esfuerzo de ayer tiene su momento aunque el ERP vaya un día atrás. Una vez por día. */
function ceremoniaAyer() {
  const a = S.base?.misiones?.ayer;
  if (!a || !esAsesor() || store.get('ayerVisto') === a.fecha) return Promise.resolve();
  const hubo = a.cumplidas || a.lista.some((x) => x.propio || x.actual);
  store.set('ayerVisto', a.fecha);
  if (!hubo) return Promise.resolve();
  return new Promise((ok) => {
    const todas = a.cumplidas === a.lista.length;
    const velo = document.createElement('div');
    velo.className = 'cofre-velo ' + (todas ? 'dorado' : '');
    velo.innerHTML = `<div class="escena"><div class="paso">
        <span class="etiqueta">${ic('calendario')} El sistema confirmó tu ${fechaCorta(a.fecha)}</span>
        <h2>${todas ? '¡Ayer cumpliste todo!' : 'Así te fue ayer'}</h2>
        <div class="sellos">${a.lista.map((x) => `<div class="sello-fila ${x.hecha ? 'si' : 'no'}"><span>${esc(x.texto)}</span>
          <b class="sello">${x.hecha ? 'CONFIRMADO' : `${x.actual}/${x.meta}`}</b></div>`).join('')}</div>
        <p class="sellos-pie">${todas ? `Tu racha sigue viva${a.cofre ? ` y tu cofre te dio +${a.cofre}` : ''}. ¡Hoy repite!` : `Cumpliste ${a.cumplidas} de ${a.lista.length}. Hoy vas por las ${a.lista.length}.`}</p>
      </div></div><button class="b3 grande ${todas ? 'blanco' : 'verde'}" id="sellos-ok" disabled>¡Vamos por hoy!</button>`;
    document.body.appendChild(velo);
    const filas = $$('.sello-fila', velo);
    (async () => {
      Juego.Sonido.init?.();
      for (const [i, f] of filas.entries()) {
        await espera(i ? 650 : 900);
        f.classList.add('ver');
        if (f.classList.contains('si')) { Juego.Sonido.sello?.() || Juego.Sonido.exito?.(0.3 + i * 0.1); Juego.vibrar?.([25, 30, 60]); Juego.estrellas?.(f.querySelector('.sello'), 10); }
        else Juego.Sonido.pop?.();
      }
      await espera(500);
      if (todas) { Juego.confeti?.({ cantidad: 160, origenY: 0.4 }); Juego.Sonido.nivel?.(); }
      $('#sellos-ok', velo).disabled = false;
    })();
    $('#sellos-ok', velo).onclick = () => { velo.classList.add('saliendo'); setTimeout(() => { velo.remove(); ok(); }, 250); };
  });
}

let revisando = false;
async function revisarNovedades(trasAccion = false) {
  if (revisando || !esAsesor() || document.querySelector('.cofre-velo, .tour, .guia')) return false;
  revisando = true;
  try {
    const d = await api('/api/novedades');
    if (!d.hay) return false;
    await mostrarRecompensas(d, trasAccion);
    return true;
  } catch { return false; } finally { revisando = false; }
}

/* Materiales que dejaron las actividades del cofre (para construir en la ciudad). */
function materialesGanados() { return ''; }
function _materialesCiudad(grupos) {
  const g = S.base?.ciudad?.ganancia;
  if (!g) return '';
  const tot = {};
  for (const x of grupos) if (g[x.tipo]) tot[g[x.tipo].material] = (tot[g[x.tipo].material] || 0) + g[x.tipo].cantidad * x.n;
  const items = Object.entries(tot).filter(([, v]) => v > 0);
  return items.length ? `<div class="costos" style="margin:4px 0 0">${items.map(([k, v]) => `<span class="costo ok">${mat(k)}<b class="num">+${nf.format(v)}</b></span>`).join('')}</div>
    <p style="font-size:13px;margin:0">Materiales para construir en tu ciudad</p>` : '';
}

const COLOR_RAREZA = { comun: '#5b8cff', rara: '#9d5cff', epica: '#ff4fd8', legendaria: '#ffc21a' };
const COLOR_NIVEL = { Bronce: ['#f0a36a', '#9a4e1c'], Plata: ['#f2f5ff', '#8d97b5'], Oro: ['#ffe27a', '#d48a00'], Platino: ['#bff7ff', '#3aa7c4'], Diamante: ['#c7d6fa', '#4b7df0'] };
const TIPO_DESBLOQUEO = { monstruo: 'Nueva mascota', pelaje: 'Nuevo pelaje', ojos: 'Nuevos ojos', titulo: 'Nuevo título', color: 'Nuevo color', marco: 'Nuevo marco',
  cabeza: 'Para la cabeza', cara: 'Para la cara', cuello: 'Para el cuello', espalda: 'Para la espalda', torso: 'Ropa nueva',
  tapete: 'Tapete nuevo', cama: 'Cama nueva', sillon: 'Sillón nuevo', planta: 'Planta nueva', lampara: 'Lámpara nueva', cuadro: 'Cuadro nuevo',
  tech: 'Tecnología nueva', deco: 'Decoración nueva', pared: 'Pared nueva', piso: 'Piso nuevo' };
const PISTA_DESBLOQUEO = (t) => (['cabeza', 'cara', 'cuello', 'espalda', 'torso', 'pelaje', 'ojos', 'monstruo'].includes(t) ? 'Pónselo a tu mascota desde tu cuarto.'
  : t === 'titulo' ? 'Ya aparece en tu perfil.' : t === 'color' || t === 'marco' ? 'Equípalo en tu perfil.' : 'Ponlo en tu cuarto con el botón Decorar.');

const COFRE_SVG = `<svg class="cofre-svg" viewBox="0 0 140 120" aria-hidden="true">
  <g class="tapa"><rect x="12" y="24" width="116" height="32" rx="8" fill="#ff7a1a"/><rect x="62" y="24" width="16" height="32" fill="#ffe57a"/>
    <rect x="12" y="24" width="116" height="8" rx="4" fill="#ffad4d"/></g>
  <rect x="18" y="56" width="104" height="58" rx="8" fill="#c24e0a"/><rect x="18" y="56" width="104" height="8" fill="#a8430a"/>
  <rect x="62" y="56" width="16" height="58" fill="#ffcc2e"/><rect x="58" y="64" width="24" height="18" rx="4" fill="#fff6c9"/><circle cx="70" cy="73" r="3" fill="#a8430a"/>
</svg>`;

function mostrarRecompensas(d, trasAccion) {
  return new Promise((terminar) => {
    const So = Juego.Sonido;
    const pasos = [];
    const otros = d.grupos.filter((g) => !['sorpresa', 'aplauso', 'racha'].includes(g.tipo));

    // 1) Anticipacion: el cofre se agita; se abre con un toque
    pasos.push({
      boton: '¡Abrir!',
      html: `<div class="rayos"></div><div class="cofre-3d" id="cofre-3d">${COFRE_SVG}</div>
        <h2>${d.primera ? `¡Bienvenido, ${esc(primerNombre(d.nombre))}!` : '¡Tienes recompensas!'}</h2>
        <p>${d.primera ? 'Esto es lo que ya construiste. Abre tu cofre.' : trasAccion ? 'Tu esfuerzo tiene premio.' : 'Lo que ganaste desde tu última visita'}</p>`,
      alMostrar: (el) => {
        el.querySelector('.cofre-svg').classList.add('agitar');
        // en 3D si el telefono puede; si no, se queda el dibujo
        cuandoMonstruos().then((M) => { const box = el.querySelector('#cofre-3d'); if (M.disponible && box?.isConnected) { el._cofre = M.montarCofre(box); el._cofre.agitar(true); } });
      },
      // al abrir: la tapa se abre, salen las monedas y el total cuenta hacia arriba JUSTO bajo el cofre (que se vea que
      // estaba lleno) antes de pasar al detalle
      alPulsar: async (el) => {
        So.init(); So.abrir(); Juego.vibrar([20, 30, 60]);
        const c = el.querySelector('.cofre-svg'); if (c) { c.classList.remove('agitar'); c.classList.add('abierto'); }
        el._cofre?.abrir();
        el.querySelector('.rayos').classList.add('ver');
        Juego.confeti({ cantidad: 150, origenY: 0.42, fuerza: 1.1 });
        if (d.puntos > 0) {
          const txt = el.querySelector('h2'); if (txt) txt.innerHTML = '¡Estaba lleno!';
          const p = el.querySelector('p'); if (p) p.remove();
          el.querySelector('#cofre-3d').insertAdjacentHTML('afterend', `<div class="sale-del-cofre">${coin()}<b class="num" id="sale">+0</b><small>monedas</small></div>`);
          Juego.lluviaMonedas({ n: Math.min(48, 14 + Math.round(Math.sqrt(d.puntos))), dur: 2200 }); So.moneda(0.2);
          const sale = el.querySelector('#sale');
          await espera(250);
          await Juego.contar(sale, 0, d.puntos, 1100, true); sale.textContent = '+' + nf.format(d.puntos);
          So.exito(); el.querySelector('.sale-del-cofre').classList.add('rebote');
          await espera(900);
        } else await espera(850);
      },
    });

    // 2) Cofre del dia: premio variable revelado de golpe (sin giros)
    for (const sor of d.sorpresas) {
      pasos.push({
        clase: 'dorado', boton: '¡Guardar!',
        html: `<span class="etiqueta">${ic('cofre')} Cofre del día · ${fechaCorta(sor.fecha)}</span>
          <div class="tragamonedas" id="tm"><span>?</span></div><p>Cumpliste las visitas del día</p>`,
        alMostrar: async (el) => {
          So.revelar(); await espera(650);
          const tm = el.querySelector('#tm');
          tm.innerHTML = `<span>+${sor.puntos}</span>`; tm.classList.add('premio-listo');
          Juego.celebrar('cofre', { puntos: sor.puntos }); So.exito(0.45); Juego.estrellas(tm, 16); Juego.confeti({ cantidad: 110, origenY: 0.45 });
        },
      });
    }

    // 3) Racha
    for (const r of d.rachas || []) {
      pasos.push({
        clase: 'dorado', boton: '¡Que siga!',
        html: `<div class="flama">${ic('fuego')}</div><h2>${r.dias} días seguidos</h2><p>Racha cumpliendo tus 3 misiones · <b>+${r.puntos} monedas</b></p>
          <p style="font-size:13px">Tu mascota crece con cada día de racha a tu lado. Cada 5 días ganas un protector.</p>`,
        alMostrar: (el) => Juego.celebrar('racha', { el: el.querySelector('.flama') }),
      });
    }

    // 4) Reconocimiento del equipo
    if (d.aplausos.length) {
      pasos.push({
        clase: 'rosa', boton: 'Gracias, equipo',
        html: `<div class="corazon-grande">${ic('aplauso')}</div><h2>Tu equipo te aplaudio</h2>
          <div class="lista-aplausos">${d.aplausos.map((a) => `<div><b>${esc(a.titulo.replace(' te aplaudio', ''))}</b><span>${esc(a.por || '')}</span></div>`).join('')}</div>`,
        alMostrar: (el) => { So.aplauso(); Juego.vibrar([60, 120, 60]); Juego.corazones(el.querySelector('.corazon-grande'), 10); },
      });
    }

    // 5) Resumen: cada actividad entra con su moneda; el total sube contando
    if (otros.length) {
      pasos.push({
        boton: 'Continuar',
        html: `<h2>${d.primera ? 'Lo que llevas construido' : 'Lo que ganaste'}</h2>
          <div class="filas-premio">${otros.map((g) => `<div class="fila-premio"><span class="ic-box" style="background:${COLOR_TIPO[g.tipo] || '#e1211c'}">${ic(ICONO_TIPO[g.tipo] || 'estrella')}</span>
            <span class="txt">${esc(NOMBRE_TIPO[g.tipo] || g.nombre)} <small>x${nf.format(g.n)}</small></span><b>+${nf.format(g.puntos)}</b></div>`).join('')}</div>
          ${d.destacados.length ? `<div class="destacados">${d.destacados.map((x) => `<div>${ic(ICONO_TIPO[x.tipo])}<span>${esc(tituloJuego({ tipo: x.tipo, titulo: x.titulo }).replace('Despertó a', 'Despertaste a'))}</span></div>`).join('')}</div>` : ''}
          <div class="total-premio">${coin()}<b class="num" id="tot">0</b></div>
          ${materialesGanados(d.grupos)}`,
        alMostrar: async (el) => {
          const filas = $$('.fila-premio', el);
          for (const [i, f] of filas.entries()) { await espera(240); f.classList.add('ver'); So.filaPremio?.(otros[i]?.tipo, [0, 2, 4, 7, 9, 12][Math.min(5, i)]); Juego.vibrar(12); }   // cada tipo de logro con su jingle, un paso mas arriba
          await espera(180);
          el.querySelector('#tot').textContent = nf.format(d.puntos);   // ya se contó al abrir el cofre: aquí solo se confirma
          So.exito(); So.reaccion?.(0.6); el.querySelector('.total-premio').classList.add('rebote');
        },
      });
    }

    // 6) Lo que se desbloqueo: la foto 3D sale de un destello con los rayos y el color de su rareza
    for (const x of d.desbloqueos || []) {
      const r = x.rareza || 'comun', col = COLOR_RAREZA[r] || COLOR_RAREZA.comun;
      const foto = x.tipo === 'titulo' ? `<span class="titulo-chip rv-titulo">${esc(x.nombre)}</span>`
        : x.tipo === 'color' || x.tipo === 'marco' ? avatar(d.nombre, x.tipo === 'color' ? { color: x.clave } : { color: S.base?.perfil?.color, marco: x.clave }, 150)
        : fotoDe({ tipo: x.tipo, clave: x.clave }, 260);
      pasos.push({
        clase: 'revela', boton: '¡Genial!',
        html: `<div class="rv" style="--rc:${col}"><div class="rv-rayos"></div><div class="rv-halo"></div>
            <div class="rv-carta r-${r}"><span class="rv-rareza">${esc(RAREZA[r] || 'Común')}</span><div class="rv-foto">${foto}</div><i class="rv-brillo"></i></div></div>
          <span class="etiqueta">${ic('candado')} ${esc(TIPO_DESBLOQUEO[x.tipo] || 'Nuevo objeto')}</span>
          <h2>${esc(x.nombre)}</h2><p>${esc(PISTA_DESBLOQUEO(x.tipo))}</p>`,
        alMostrar: async (el) => {
          fotosPendientes(el);
          So.revelar?.(); await espera(520);
          el.querySelector('.rv').classList.add('ver');
          if (r === 'legendaria') Juego.celebrar('legendaria'); else So.insignia();
          Juego.estrellas(el.querySelector('.rv-carta'), r === 'comun' ? 10 : 22, col);
          Juego.confeti({ cantidad: { comun: 60, rara: 90, epica: 130, legendaria: 200 }[r], origenY: 0.36, fuerza: 0.9 });
          Juego.vibrar(r === 'legendaria' ? [40, 40, 40, 40, 160] : [30, 40, 60]);
        },
      });
    }

    // 7) Insignias
    for (const ins of d.insignias) {
      pasos.push({
        clase: 'dorado', boton: 'A la vitrina',
        html: `<span class="etiqueta">${ic('insignia')} Insignia nueva</span><div class="medalla-grande">${ic('insignia')}</div><h2>${esc(ins.nombre)}</h2><p>${esc(ins.descripcion)}</p>`,
        alMostrar: (el) => Juego.celebrar('insignia', { el: el.querySelector('.medalla-grande') }),
      });
    }

    // 8) Nivel: el gran momento. La medalla del nivel viejo se rompe y sale la nueva, con su color
    if (d.nivel) {
      const na = d.nivel_actual || {}, cn = COLOR_NIVEL[d.nivel.ahora] || COLOR_NIVEL.Oro, cv = COLOR_NIVEL[d.nivel.antes] || COLOR_NIVEL.Bronce;
      const falta = na.meta ? Math.max(0, na.meta - d.total) : 0;
      pasos.push({
        clase: 'nivel-velo', boton: '¡Vamos por más!',
        html: `<span class="etiqueta">${ic('subir')} ¡Subiste de nivel!</span>
          <div class="nvl" style="--a:${cn[0]};--b:${cn[1]};--va:${cv[0]};--vb:${cv[1]}"><div class="rv-rayos"></div>
            <div class="nv-medalla vieja"><span>${esc(d.nivel.antes)}</span></div>
            <div class="nv-medalla nueva">${ic('corona', 'nv-corona')}<span>${esc(d.nivel.ahora)}</span><i class="rv-brillo"></i></div></div>
          <h2>¡Ya eres ${esc(d.nivel.ahora)}!</h2>
          <p><b class="num" id="nv-xp">0</b> puntos en total</p>
          ${na.siguiente ? `<div class="nv-barra"><i style="width:0" data-w="${Math.round((na.avance || 0) * 100)}%"></i></div><p class="nv-sig">Te faltan ${nf.format(falta)} para ${esc(na.siguiente)}</p>` : '<p class="nv-sig">¡Llegaste al nivel más alto!</p>'}`,
        alMostrar: async (el) => {
          So.revelar?.(); await espera(600);
          el.querySelector('.nvl').classList.add('rompe');
          await espera(450);
          Juego.celebrar('nivel', { texto: d.nivel.ahora });
          Juego.estrellas(el.querySelector('.nv-medalla.nueva'), 26, cn[0]);
          const xp = el.querySelector('#nv-xp'); Juego.contar?.(xp, Math.max(0, d.total - 800), d.total, 1200);
          const b = el.querySelector('.nv-barra i'); if (b) setTimeout(() => { b.style.width = b.dataset.w; }, 300);
        },
      });
    }

    // 9) Subir de lugar
    if (d.posicion) {
      pasos.push({
        clase: 'verde', boton: 'Seguir subiendo',
        html: `<div class="sube-grande">${ic('subir')}</div><h2>Subiste al #${d.posicion.ahora}</h2><p>Estabas en el #${d.posicion.antes} de la arena.</p>`,
        alMostrar: (el) => Juego.celebrar('sube', { el: el.querySelector('.sube-grande') }),
      });
    }

    // 10) Jefe vencido entre todos
    if (d.equipo) {
      pasos.push({
        clase: 'rosa', boton: '¡Lo logramos!',
        html: `<div class="jefe-3d chico" data-jefe-vencido></div><h2>¡${esc(jefeDelMes(d.equipo.semana?.desde, d.equipo.jefe).nombre)} derrotado!</h2><p>${esc(d.equipo.gremio_nombre)} de ${esc(tiendaNombre(d.equipo.tienda))} lo venció con ${nf.format(d.equipo.puntos)} monedas entre ${d.equipo.asesores} constructores. Gracias por tu parte.</p>`,
        alMostrar: (el) => { Juego.celebrar('jefe', { texto: d.equipo.gremio_nombre }); Juego.corazones(el.querySelector('.jefe-3d'), 12);
          cuandoMonstruos().then((M) => { const c = el.querySelector('[data-jefe-vencido]'); if (M.disponible && c) M.montarJefe(c, { tipo: jefeDelMes(d.equipo.semana?.desde, d.equipo.jefe).tipo, derrotado: true }); }); },
      });
    }

    const velo = document.createElement('div');
    velo.className = 'cofre-velo';
    velo.innerHTML = `<button class="saltar" type="button">Saltar</button><div class="escena" id="escena"></div><button class="b3 grande" id="escena-btn" type="button"></button>`;
    document.body.appendChild(velo);
    const escena = $('#escena', velo), btn = $('#escena-btn', velo);
    let i = 0, ocupado = false;
    const cerrar = async () => {
      velo.classList.add('saliendo');
      try { await api('/api/novedades/visto', { method: 'POST' }); } catch { /* se reintenta en la proxima visita */ }
      const antes = S.base?.saldo.monedas;
      setTimeout(async () => {
        velo.remove();
        try { await cargarBase(); if (antes !== undefined) animarSaldo(antes, S.base.saldo.monedas); } catch { /* sin red */ }
        if (S.vista === 'base') vistaBase();
        terminar();
      }, 250);
    };
    const mostrar = async () => {
      const p = pasos[i];
      velo.className = 'cofre-velo ' + (p.clase || '');
      escena.innerHTML = `<div class="paso">${p.html}</div>`;
      btn.textContent = p.boton; btn.className = 'b3 grande ' + (p.clase === 'dorado' ? 'blanco' : p.clase ? 'oro' : 'verde');
      btn.disabled = true; ocupado = true;
      try { await Promise.race([p.alMostrar?.(escena), espera(4000)]); } finally { btn.disabled = false; ocupado = false; btn.focus(); }
    };
    btn.onclick = async () => {
      if (ocupado) return;
      ocupado = true; btn.disabled = true;
      await Promise.race([pasos[i].alPulsar?.(escena), espera(4500)]);
      i++;
      if (i >= pasos.length) cerrar(); else mostrar();
    };
    $('.saltar', velo).onclick = () => { So.init(); cerrar(); };
    mostrar();
  });
}

/* ------------------------------------------------------------ tutorial guiado (primera vez y desde Perfil)
   Recorre la app de verdad: va a cada pantalla, ilumina la parte de la que habla y explica qué hace. Se puede
   regresar, saltar y volver a ver cuando quieras. Si algo no está (por ejemplo, sin encargos), el paso se muestra
   centrado sin iluminar nada. */
const misionesEl = () => $$('.seccion').find((x) => x.querySelector('.seccion-cab h2')?.textContent.includes('Misiones'));
const GUIA = [
  { vista: 'base', icono: 'trofeo', titulo: '¡Bienvenido a Distrito!', texto: 'Este es tu juego: lo que haces con tus clientes en la vida real te da monedas, cartas y una mascota que crece contigo. Te enseño todo en un minuto.' },
  { vista: 'base', el: '#hud-monedas', titulo: 'Tus monedas', texto: 'Cada punto que ganas con tus ventas, cotizaciones y seguimientos te da una moneda. Las gastas en cajas, comida y cartas. Tus puntos del ranking nunca se gastan.' },
  { vista: 'base', el: '.hud-pill.fuego', titulo: 'Tu racha', texto: 'Cumple tus 3 misiones cada día para que suba. Desde 3 días seguidos ganas monedas extra (×1.2, y sube más con la racha).' },
  { vista: 'base', el: '#cuarto-3d', titulo: 'Tu mascota y su cuarto', texto: 'Tócala y te hace caso. Pasea sola, duerme en su cama, juega con tus muebles... Arrastra para girar el cuarto y pellizca para acercarte.' },
  { vista: 'base', el: '#b-comer', titulo: 'Darle de comer', texto: 'Si tiene hambre, dale galletas, pastel o fruta. Las ganas con tus visitas; si se te acaban, ahí mismo las compras.' },
  { vista: 'base', el: '#b-jugar', titulo: 'Jugar con ella', texto: 'Lánzale la pelota cinco veces: se pone feliz.' },
  { vista: 'base', el: '#b-banar', titulo: 'Bañarla', texto: 'Con el tiempo se ensucia y deja popós en el piso (tócalas para recogerlas). Báñala para que esté contenta.' },
  { vista: 'base', el: '#b-decorar', titulo: 'Decorar su cuarto', texto: 'Mueve tus muebles a donde quieras. Los muebles, la ropa y las mascotas nuevas salen de las cajas de la Tienda.' },
  { vista: 'base', el: '.crecer', titulo: 'Cómo crece', texto: 'Sube de nivel con tus puntos y crece con los días de racha que pasa contigo. Abajo ves si tiene hambre, si está feliz y qué tan limpia está.' },
  { vista: 'base', el: misionesEl, titulo: 'Misiones del día', texto: 'Tres misiones cada día. Cúmplelas todas para abrir el cofre del día y mantener tu racha.' },
  { vista: 'encargos', el: '.tabbar [data-v="encargos"]', titulo: 'Encargos', texto: 'Aquí están tus clientes para hoy: cotizaciones por vencer y clientes que dejaron de comprar.' },
  { vista: 'encargos', el: '.panel.encargo', titulo: 'Cómo se cumple un encargo', texto: 'Escríbele por WhatsApp o llámale desde aquí y reporta la visita: ganas monedas al reportar y muchas más si te compra. Grande o chica, toda venta cuenta.' },
  { vista: 'encargos', el: '#b-mensajes', titulo: 'Tus mensajes', texto: 'Deja listos tus mensajes de WhatsApp para cotizaciones y clientes dormidos: se llenan solos con el nombre del cliente.' },
  { vista: 'encargos', el: '.tabbar [data-jugar]', titulo: 'El botón Jugar', texto: 'El atajo más rápido: te da el siguiente encargo listo para escribir o llamar, o reportar la visita a cualquier cliente.' },
  { vista: 'equipo', tab: 'jefe', el: '#seg-eq', titulo: 'Tu equipo', texto: 'Jefe: tu gremio de tu tienda le pega a un jefe cada semana con sus puntos. Cartas: junta las cartas de tus compañeros. Ciudad: visita sus casas y dales corazón. Ranking y Muro.' },
  { vista: 'tienda', el: '#modo-tienda', titulo: 'Tienda y Decorar', texto: 'En Cajas abres botes sorpresa con mascotas, ropa, muebles y objetos con acabados especiales. En Decorar te pones lo que ya tienes.' },
  { vista: 'tienda', el: '#hud-yo', titulo: 'Tu perfil', texto: 'Tu carta, tus insignias y tu temporada. Desde ahí puedes volver a ver este tutorial cuando quieras.' },
  { vista: 'base', icono: 'rayo', titulo: '¡Listo, a jugar!', texto: 'Empieza por tus encargos de hoy y cumple tus 3 misiones. ¡Cada cliente cuenta!' },
];

function tour() { return guia(true); }
function guia(primeraVez = false) {
  return new Promise((ok) => {
    if ($('.guia')) return ok();
    let i = 0, objetivo = null, vivo = true;
    const el = document.createElement('div');
    el.className = 'guia';
    el.innerHTML = `<div class="guia-foco" hidden></div><div class="guia-globo" role="dialog" aria-live="polite"></div>`;
    document.body.appendChild(el);
    const foco = $('.guia-foco', el), globo = $('.guia-globo', el);
    const buscar = (paso) => (typeof paso.el === 'function' ? paso.el() : paso.el ? $(paso.el) : null);
    const esperar = async (paso) => {   // la pantalla carga sola: se espera a que aparezca lo que se va a iluminar
      for (let t = 0; t < 40 && vivo; t++) { const x = buscar(paso); if (x && x.getBoundingClientRect().height) return x; await espera(150); }
      return null;
    };
    // en filas de botones (pestañas) se ilumina solo lo que ocupan los botones, sin el relleno de abajo del scroll
    const caja = (o) => {
      const r = o?.getBoundingClientRect();
      if (!r || !o.matches('.chips-scroll, .segmentos') || !o.children.length) return r;
      const hs = [...o.children].map((h) => h.getBoundingClientRect()).filter((h) => h.width && h.right > r.left && h.left < r.right);
      if (!hs.length) return r;
      const top = Math.min(...hs.map((h) => h.top)), bottom = Math.max(...hs.map((h) => h.bottom));
      return { left: r.left, right: r.right, width: r.width, top, bottom, height: bottom - top };
    };
    const colocar = () => {
      if (!vivo) return;
      const r = caja(objetivo);
      if (!r || !r.height) { foco.hidden = true; globo.className = 'guia-globo centro'; globo.style.top = ''; globo.style.left = ''; return; }
      const m = 8;
      foco.hidden = false;
      Object.assign(foco.style, { left: `${r.left - m}px`, top: `${r.top - m}px`, width: `${r.width + m * 2}px`, height: `${r.height + m * 2}px` });
      const alto = globo.offsetHeight, abajo = innerHeight - r.bottom - m, arriba = r.top - m;
      const ponAbajo = abajo >= alto + 16 || abajo > arriba;
      globo.className = 'guia-globo ' + (ponAbajo ? 'abajo' : 'arriba');
      const top = ponAbajo ? Math.min(innerHeight - alto - 10, r.bottom + m + 12) : Math.max(10, r.top - m - 12 - alto);
      globo.style.top = `${top}px`;
      const ancho = globo.offsetWidth, cx = r.left + r.width / 2;
      globo.style.left = `${Math.max(10, Math.min(innerWidth - ancho - 10, cx - ancho / 2))}px`;
      globo.style.setProperty('--flecha', `${Math.max(18, Math.min(ancho - 18, cx - Math.max(10, Math.min(innerWidth - ancho - 10, cx - ancho / 2))))}px`);
    };
    const mostrar = async () => {
      const paso = GUIA[i];
      globo.innerHTML = `<div class="guia-cargando">${ic('reloj')}</div>`; globo.className = 'guia-globo centro'; foco.hidden = true;
      if (paso.tab) S.equipoTab = paso.tab;
      if (paso.vista && (S.vista !== paso.vista || (paso.tab && paso.vista === 'equipo'))) {
        if (S.vista === paso.vista) render(); else irA(paso.vista);
      }
      objetivo = paso.el ? await esperar(paso) : null;
      if (!vivo) return;
      if (objetivo) { objetivo.scrollIntoView({ block: 'center', behavior: 'instant' }); await espera(60); }
      const ult = i === GUIA.length - 1;
      globo.innerHTML = `<button class="guia-x" data-g="saltar" aria-label="Salir del tutorial" title="Salir del tutorial">${ic('cerrar')}</button>${paso.icono && !objetivo ? (i === 0 ? '<picture><source srcset="./img/web-dev-eyes.svg" type="image/webp"><img class="guia-logo" src="./img/web-dev-eyes.svg" alt=""></picture>' : `<div class="guia-icono">${ic(paso.icono)}</div>`) : ''}
        <b class="guia-titulo">${esc(paso.titulo)}</b><p>${esc(paso.texto)}</p>
        <div class="guia-pie"><span class="guia-paso">${i + 1} de ${GUIA.length}</span>
          ${i ? `<button class="guia-btn gris" data-g="atras">Atrás</button>` : `<button class="guia-btn gris" data-g="saltar">Saltar</button>`}
          <button class="guia-btn" data-g="sig">${ult ? '¡Empezar!' : 'Siguiente'}</button></div>`;
      colocar();
      globo.classList.add('entra'); Juego.Sonido.swoosh?.();
    };
    const fin = () => {
      vivo = false; el.remove(); removeEventListener('resize', colocar); removeEventListener('scroll', colocar, true);
      if (primeraVez) api('/api/perfil/tour', { method: 'POST' }).catch(() => {});
      if (S.vista !== 'base') irA('base');
      Juego.Sonido.exito?.(); ok();
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      Juego.Sonido.init?.();
      if (b.dataset.g === 'saltar') return fin();
      if (b.dataset.g === 'atras') { i = Math.max(0, i - 1); return mostrar(); }
      if (++i >= GUIA.length) return fin();
      mostrar();
    });
    addEventListener('resize', colocar); addEventListener('scroll', colocar, true);
    // la pantalla sigue cargando (fotos, el jefe, listas) y lo iluminado se recorre: se vuelve a medir seguido
    let ultimo = '';
    const seguir = () => {
      if (!vivo) return;
      const r = caja(objetivo), firma = r ? `${r.left | 0},${r.top | 0},${r.width | 0},${r.height | 0}` : '';
      if (firma !== ultimo) { ultimo = firma; colocar(); }
      requestAnimationFrame(seguir);
    };
    requestAnimationFrame(seguir);
    mostrar();
  });
}
