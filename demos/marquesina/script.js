/* ===== Render del catálogo (filas estilo Netflix) ===== */
const catalogEl = document.getElementById('catalog');

function cardMarkup(item) {
  const grad = `linear-gradient(150deg, ${item.color[0]}, ${item.color[1]})`;
  const bg = item.poster
    ? `background-image:url('${item.poster}');background-size:cover;background-position:center;`
    : `background:${grad};`;
  const badge = item.badge ? `<span class="ce-badge">${item.badge}</span>` : '';
  const preview = item.src.replace('assets/videos/', 'assets/previews/');
  return `
    <article class="card" tabindex="0"
      data-type="${item.type}" data-src="${item.src}" data-preview="${preview}"
      data-vertical="${item.vertical ? 'true' : 'false'}"
      data-title="${item.title}" data-desc="${item.desc}">
      <div class="card-media" style="${bg}"><div class="card-play">▶</div></div>
      <div class="card-expand">
        <div class="ce-media"><video class="ce-video" muted loop playsinline preload="none"></video>${badge}</div>
        <div class="ce-info">
          <button class="ce-play" aria-label="Reproducir">▶ Reproducir</button>
          <h4 class="ce-title">${item.title}</h4>
        </div>
      </div>
    </article>`;
}

function rowMarkup(section) {
  const cards = section.items.map(cardMarkup).join('');
  return `
    <section class="row ${section.layout}">
      <h3 class="row-title">${section.row}</h3>
      <div class="row-wrap">
        <button class="row-arrow left" aria-label="Anterior">‹</button>
        <div class="row-track">${cards}</div>
        <button class="row-arrow right" aria-label="Siguiente">›</button>
      </div>
    </section>`;
}

if (catalogEl && typeof CATALOG !== 'undefined') {
  catalogEl.innerHTML = CATALOG.map(rowMarkup).join('');
}

/* ===== Flechas de carrusel ===== */
document.querySelectorAll('.row-wrap').forEach((wrap) => {
  const track = wrap.querySelector('.row-track');
  const amount = () => Math.max(track.clientWidth * 0.8, 240);
  wrap.querySelector('.left').addEventListener('click', () =>
    track.scrollBy({ left: -amount(), behavior: 'smooth' })
  );
  wrap.querySelector('.right').addEventListener('click', () =>
    track.scrollBy({ left: amount(), behavior: 'smooth' })
  );
});

/* ===== Modal de video (Plyr) ===== */
const modal = document.getElementById('modal');
const modalBox = modal.querySelector('.modal-box');
const player = document.getElementById('modalPlayer');
const mTitle = document.getElementById('modalTitle');
const mDesc = document.getElementById('modalDesc');
let currentPlyr = null;

function openModal(data) {
  mTitle.textContent = data.title;
  mDesc.textContent = data.desc;
  modalBox.classList.toggle('vertical', !!data.vertical);
  if (data.type === 'mp4') {
    // El video SIEMPRE funciona con controles nativos; Plyr solo lo mejora si está disponible.
    player.innerHTML = `<video id="plyrVideo" class="${data.vertical ? 'is-vertical' : ''}" playsinline controls autoplay preload="auto"><source src="${data.src}" type="video/mp4"></video>`;
    try {
      if (typeof Plyr !== 'undefined') {
        currentPlyr = new Plyr('#plyrVideo', {
          iconUrl: './assets/plyr.svg',
          ratio: data.vertical ? '9:16' : '16:9',
          autoplay: true,
          controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'pip', 'fullscreen'],
          settings: ['speed'],
          speed: { selected: 1, options: [0.5, 1, 1.5, 2] },
          keyboard: { focused: true, global: true },
        });
      }
    } catch (e) { currentPlyr = null; }
  } else if (data.type === 'youtube') {
    player.innerHTML = `<div class="ratio169"><iframe src="https://www.youtube.com/embed/${data.src}?autoplay=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
  } else {
    player.innerHTML = `<div class="ratio169"><div class="modal-empty">🎬 Video próximamente</div></div>`;
  }
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function openModalFromCard(card) {
  openModal({
    type: card.dataset.type, src: card.dataset.src,
    title: card.dataset.title, desc: card.dataset.desc,
    vertical: card.dataset.vertical === 'true',
  });
}
function closeModal() {
  if (currentPlyr) { try { currentPlyr.destroy(); } catch (e) {} currentPlyr = null; }
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  player.innerHTML = '';
  document.body.style.overflow = '';
}
modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

/* ===== Hover estilo Netflix: la tarjeta crece desde adentro y empuja vecinas ===== */
const supportsHover = window.matchMedia('(hover: hover)').matches;
const INFO_H = 78;
let expandedCard = null, expandedTrack = null, enterTimer = null;

function resetSiblings() {
  if (expandedTrack) expandedTrack.querySelectorAll('.card').forEach((c) => { c.style.transform = ''; });
  expandedTrack = null;
}
function collapse(card) {
  const exp = card.querySelector('.card-expand');
  // Cierre instantáneo (sin animación) para que no se encime con la nueva tarjeta
  exp.style.transition = 'none';
  card.classList.remove('expanded');
  exp.style.width = ''; exp.style.height = ''; exp.style.left = ''; exp.style.top = '';
  void exp.offsetWidth; // forzar reflow
  exp.style.transition = '';
  const v = card.querySelector('.ce-video');
  if (v) v.pause();
  resetSiblings();
  if (expandedCard === card) expandedCard = null;
}
function expand(card) {
  if (expandedCard && expandedCard !== card) collapse(expandedCard);
  expandedCard = card;
  const exp = card.querySelector('.card-expand');
  const v = card.querySelector('.ce-video');
  const wide = card.dataset.vertical !== 'true';
  const Wc = card.offsetWidth, Hc = card.offsetHeight;
  // Misma altura que el póster (cubre el alto de la fila); el ancho se adapta al video
  const He = Hc;
  const We = wide ? (Hc - INFO_H) * 16 / 9 : Wc * 1.12;

  // Anclaje según posición en la fila: 1ª crece a la derecha, última a la izquierda, el resto al centro
  expandedTrack = card.closest('.row-track');
  const cards = [...expandedTrack.querySelectorAll('.card')];
  const i = cards.indexOf(card);
  const extra = Math.max(0, We - Wc);
  let leftExt, rightExt;
  if (i === 0) { leftExt = 0; rightExt = extra; }
  else if (i === cards.length - 1) { leftExt = extra; rightExt = 0; }
  else { leftExt = extra / 2; rightExt = extra / 2; }

  exp.style.width = We + 'px';
  exp.style.height = He + 'px';
  exp.style.left = (-leftExt) + 'px';
  exp.style.top = '0px';

  if (v.dataset.src !== card.dataset.preview) { v.src = card.dataset.preview; v.dataset.src = card.dataset.preview; }
  v.currentTime = 0;
  v.play().catch(() => {});
  card.classList.add('expanded');

  // Empujar a las vecinas justo lo que se extiende de cada lado
  cards.forEach((c, idx) => {
    if (idx < i) c.style.transform = `translateX(${-leftExt}px)`;
    else if (idx > i) c.style.transform = `translateX(${rightExt}px)`;
  });
}

document.querySelectorAll('.card').forEach((card) => {
  card.addEventListener('click', () => openModalFromCard(card));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModalFromCard(card); }
  });
  if (!supportsHover) return;
  card.addEventListener('mouseenter', () => {
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => expand(card), 320);
  });
  card.addEventListener('mouseleave', () => {
    clearTimeout(enterTimer);
    collapse(card);
  });
});

/* ===== Nav: fondo sólido al hacer scroll ===== */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
});
