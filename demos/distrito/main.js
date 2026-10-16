/* Distrito — arranque. */
'use strict';

async function enviarCola() {
  const cola = store.get('cola', []);
  if (!cola.length || !esAsesor()) return;
  const pendientes = [];
  let enviados = 0;
  for (let i = 0; i < cola.length; i++) {
    const s = cola[i];
    try { await api('/api/seguimientos', { method: 'POST', body: JSON.stringify(s) }); enviados++; }
    catch (e) {
      if (!e.status || e.status === 401) { pendientes.push(...cola.slice(i)); break; }  // sin red o sesion vencida: se reintenta despues
      // 400/409 (duplicado, cliente invalido): se descarta, no tiene caso reintentar
    }
  }
  store.set('cola', pendientes);
  if (enviados) { toast(`${enviados} visita(s) guardadas sin conexión ya se enviaron`); if (S.vista === 'base') vistaBase(); }
}

/* Primera vez: tour; después, el cofre con lo ganado desde la última visita. */
async function arranqueJugador() {
  try {
    if (!S.base) await cargarBase();
    // el tutorial guiado nuevo se muestra una vez a todos, tambien a quien ya habia visto la bienvenida vieja
    if (S.base && (!S.base.perfil.tour || !store.get('guia2'))) { await tour(); store.set('guia2', 1); }
  } catch { /* sin red: se sigue con lo guardado */ }
  try { await ceremoniaAyer(); } catch { /* que nunca detenga la app */ }
  await revisarNovedades();
  enviarCola();
}

let ultimaRevision = Date.now();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !esAsesor()) return;
  setTimeout(revisarContactoPendiente, 400);          // volvio de WhatsApp o de la llamada
  if (Date.now() - ultimaRevision > 60_000) { ultimaRevision = Date.now(); revisarNovedades(); }
});
window.addEventListener('focus', () => setTimeout(revisarContactoPendiente, 400));
window.addEventListener('online', enviarCola);

if ('serviceWorker' in navigator) {
  // se registra un rato despues de abrir: en la primera visita su copia no compite con la carga de la app
  window.addEventListener('load', () => setTimeout(() => Promise.resolve().catch(() => {}), 4000));
  // Si llega una version nueva de la app NO se recarga sola a media partida (se sentía como "se recarga a cada rato"):
  // avisa con un botón y se actualiza solo si el jugador quiere (o la próxima vez que abra la app).
  const habiaControl = !!navigator.serviceWorker.controller;
  let avisado = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaControl || avisado) return;
    avisado = true;
    const a = document.createElement('button'); a.className = 'aviso-version'; a.type = 'button';
    a.textContent = 'Hay una versión nueva · toca para actualizar'; a.onclick = () => location.reload();
    document.body.appendChild(a);
  });
}

// Enlaces directos: #v=tienda&t=cuarto abre esa pantalla (para compartir o volver a donde estabas).
(() => {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('v')) S.vista = h.get('v');
  if (h.get('t')) { S.tiendaTab = h.get('t'); S.equipoTab = h.get('t'); S.adminTab = h.get('t'); }
  if (h.get('de')) S.visitando = h.get('de');
  // liga de acceso de un solo uso (correo de bienvenida): se lee y se borra de la dirección enseguida
  if (h.get('acceso')) {
    S.acceso = h.get('acceso');
    history.replaceState(null, '', location.pathname + location.search);
  }
})();

// Primero la fecha del servidor (puede estar simulada) y luego la app.
cargarEstado().finally(async () => {
  if (S.acceso) {   // entra directo con la liga del correo
    const token = S.acceso; S.acceso = null;
    try {
      const r = await api('/api/acceso', { method: 'POST', body: JSON.stringify({ token }) });
      S.sesion = r; store.set('sesion', r); store.set('ultimoCodigo', r.codigo); S.vista = r.rol === 'admin' ? 'admin' : 'base';
      // la liga se abrio en el navegador pero la pidio la app instalada: esa ya entro sola
      if (r.app_espera && !matchMedia('(display-mode: standalone)').matches && !navigator.standalone) S.avisoApp = true;
    } catch (e) { S.avisoEntrada = e.message; }
  }
  render();
  if (S.avisoApp) { S.avisoApp = false; setTimeout(() => toast('¡Listo! Si tienes la app instalada, regresa a ella: ya entró sola.'), 600); }
  if (esAsesor() && !/quieto=1/.test(location.hash)) setTimeout(arranqueJugador, 700);
});
