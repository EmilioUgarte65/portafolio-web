/* Puntos DE — capa de recompensa: sonido sintetizado (Web Audio, sin archivos), confeti,
   monedas, vibracion y la secuencia del cofre de recompensas.
   Cada festejo esta pensado para un estimulo distinto:
     - anticipacion y recompensa variable (cofre, caja sorpresa con giro)  -> dopamina
     - logro y estatus (nivel, insignia, subir de lugar, racha)             -> serotonina
     - reconocimiento del equipo (aplausos, meta de la tienda)              -> oxitocina  */
'use strict';

const Juego = (() => {
  const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pref = (k, d) => { try { const v = sessionStorage.getItem('pmn.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const guardar = (k, v) => { try { sessionStorage.setItem('pmn.' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

  /* ------------------------------------------------------------ sonido */
  let ctx = null, master = null, eco = null, sala = null, ruidoBuf = null;
  const ahoraMs = () => (window.performance?.now ? performance.now() : Date.now());
  const azar = (a, b) => a + Math.random() * (b - a);
  /* Voces de las mascotas: una "silaba" por especie. (So, t, k = altura, fin = hacia donde va el tono al final
     (>1 sube = feliz, <1 baja = queja), d = alargar, v = volumen) -> devuelve cuanto dura. */
  const VOCES = {
    // animales
    patito: (So, t, k, fin, d, v) => { const dur = 0.15 * d;   // cuac
      So._vox(t, 560 * k, 450 * k * fin, dur, { tipo: 'square', vol: 0.05 * v, formantes: [[1100, 5, 2.2, 800], [2600, 6, 0.8]], ataque: 0.008 });
      So.golpeRuido(t, 0.03, 0.02 * v, { tipo: 'bandpass', f: 2000, q: 2 }); return dur; },
    gatito: (So, t, k, fin, d, v) => { const dur = 0.28 * d;   // miau corto: la boca se abre (formante sube) y se cierra
      So._vox(t, 520 * k, 560 * k * fin, dur, { vol: 0.05 * v, medio: 760 * k, vib: 6, vibF: 5, formantes: [[600, 4, 2.4, 900], [1800, 5, 0.9, 1300]], ataque: 0.03 }); return dur; },
    xolo: (So, t, k, fin, d, v) => { const dur = 0.09 * d;   // ladridito
      So._vox(t, 680 * k, 480 * k * fin, dur, { vol: 0.065 * v, formantes: [[1200, 3, 2.2], [2500, 5, 0.8]], ataque: 0.004 });
      So.golpeRuido(t, 0.04, 0.03 * v, { tipo: 'bandpass', f: 1600, q: 1.5 }); return dur + 0.04; },
    pinguino: (So, t, k, fin, d, v) => { const dur = 0.26 * d;   // graznido rasposo
      So._vox(t, 330 * k, 400 * k * fin, dur, { tipo: 'square', vol: 0.045 * v, vib: 35, vibF: 28, formantes: [[850, 4, 2], [1900, 5, 0.7]] }); return dur; },
    panda: (So, t, k, fin, d, v) => { const dur = 0.24 * d;   // grunidito tierno
      So._vox(t, 190 * k, 240 * k * fin, dur, { vol: 0.065 * v, vib: 14, vibF: 20, formantes: [[480, 3, 2.4], [1100, 5, 0.6]] });
      So.tono(900 * k * fin, t + dur * 0.8, 0.07, { vol: 0.018 * v, hasta: 1200 * k, conEco: false }); return dur; },
    unicornio: (So, t, k, fin, d, v) => { const dur = 0.5 * d;   // relincho magico con brillo
      So._vox(t, 950 * k, 620 * k * fin, dur, { vol: 0.045 * v, medio: 1150 * k, vib: 70, vibF: 10, formantes: [[1300, 4, 2], [2700, 6, 0.7]], conSala: true });
      [2637, 3136, 3951].forEach((f, i) => So.tono(f, t + dur * 0.6 + i * 0.06, 0.4, { vol: 0.014 * v, conSala: true, conEco: false, ataque: 0.002 })); return dur; },
    murcielago: (So, t, k, fin, d, v) => {   // chillido agudo: 3 chirps
      for (let i = 0; i < 3; i++) So.tono((2900 + i * 280) * k, t + i * 0.05 * d, 0.035, { vol: 0.022 * v, hasta: 4000 * k * fin, conEco: false, ataque: 0.002 });
      return 0.17 * d; },
    tiburon: (So, t, k, fin, d, v) => {   // chomp-chomp burbujeante
      for (let i = 0; i < 2; i++) { So.tono(220 * k, t + i * 0.13, 0.1, { vol: 0.11 * v, hasta: 70, conEco: false, ataque: 0.002 }); So.golpeRuido(t + i * 0.13, 0.06, 0.07 * v, { tipo: 'lowpass', f: 900 }); }
      for (let i = 0; i < 3; i++) { const f = (420 + i * 160) * k; So.tono(f, t + 0.26 + i * 0.06, 0.08, { vol: 0.04 * v, hasta: f * 2.4 * fin, conEco: false, ataque: 0.004 }); }
      return 0.45 * d; },
    capibara: (So, t, k, fin, d, v) => { const dur = 0.18 * d;   // chirrido grave
      So._vox(t, 300 * k, 360 * k * fin, dur, { tipo: 'triangle', vol: 0.08 * v, formantes: [[650, 3, 2.4], [1500, 5, 0.6]] });
      So.golpeRuido(t + dur, 0.02, 0.02 * v, { tipo: 'bandpass', f: 1800, q: 3 }); return dur + 0.03; },
    mapache: (So, t, k, fin, d, v) => { const dur = 0.28 * d;   // trino nasal
      So._vox(t, 950 * k, 1050 * k * fin, dur, { tipo: 'square', vol: 0.04 * v, vib: 110, vibF: 24, formantes: [[1400, 7, 2.2], [2800, 6, 0.6]] }); return dur; },
    ajolote: (So, t, k, fin, d, v) => {   // burbujitas + "pip"
      for (let i = 0; i < 3; i++) { const f = (380 + i * 140) * k; So.tono(f, t + i * 0.055 * d, 0.07, { vol: 0.045 * v, hasta: f * 2.5, conEco: false, ataque: 0.004 }); }
      So.tono(1150 * k, t + 0.18 * d, 0.09, { vol: 0.035 * v, hasta: 1500 * k * fin, conEco: false }); return 0.28 * d; },
    conejito: (So, t, k, fin, d, v) => {   // sniff-sniff + chillidito
      for (let i = 0; i < 2; i++) So.golpeRuido(t + i * 0.08, 0.05, 0.04 * v, { tipo: 'bandpass', f: 3600, q: 1.5, ataque: 0.01 });
      So.tono(1700 * k, t + 0.18, 0.07 * d, { vol: 0.03 * v, hasta: 2100 * k * fin, conEco: false }); return 0.27 * d; },
    cocodrilo: (So, t, k, fin, d, v) => { const dur = 0.42 * d;   // grunido grave
      So._vox(t, 95 * k, 80 * k * fin, dur, { vol: 0.085 * v, vib: 7, vibF: 22, formantes: [[380, 2.5, 2.6], [900, 4, 0.6]], ataque: 0.04 });
      So.golpeRuido(t, dur, 0.022 * v, { tipo: 'lowpass', f: 420, ataque: 0.06 }); return dur; },
    // las 5 de gremio: voces "de material"
    obra: (So, t, k, fin, d, v) => {   // ladrillo: toc de barro + "¡jo!"
      So.tono(380, t, 0.06, { vol: 0.08 * v, hasta: 240, conEco: false, ataque: 0.002 }); So.golpeRuido(t, 0.03, 0.05 * v, { tipo: 'bandpass', f: 900, q: 3 });
      So._vox(t + 0.07, 300 * k, 380 * k * fin, 0.14 * d, { tipo: 'triangle', vol: 0.07 * v, formantes: [[650, 3, 2.4]] }); return 0.07 + 0.14 * d; },
    pisos: (So, t, k, fin, d, v) => {   // azulejo: "tink" de ceramica + vocecita aguda
      So.tono(2400 * k, t, 0.25, { vol: 0.03 * v, conSala: true, conEco: false, ataque: 0.001 }); So.tono(2400 * 2.76 * k, t, 0.12, { vol: 0.01 * v, conEco: false });
      So._vox(t + 0.05, 680 * k, 820 * k * fin, 0.14 * d, { tipo: 'triangle', vol: 0.06 * v, formantes: [[1200, 4, 2.2]] }); return 0.05 + 0.14 * d; },
    pintura: (So, t, k, fin, d, v) => {   // brocha: brochazo + "¡pi!"
      So.golpeRuido(t, 0.14, 0.04 * v, { tipo: 'bandpass', f: 1800, hasta: 4500, q: 1.2, ataque: 0.05 });
      So._vox(t + 0.08, 780 * k, 960 * k * fin, 0.13 * d, { tipo: 'triangle', vol: 0.06 * v, formantes: [[1400, 4, 2.2]] }); return 0.08 + 0.13 * d; },
    plomeria: (So, t, k, fin, d, v) => {   // gota: "plip" + voz que tiembla como agua
      So.tono(500 * k, t, 0.07, { vol: 0.07 * v, hasta: 1500 * k, conEco: false, ataque: 0.003 });
      So._vox(t + 0.08, 600 * k, 700 * k * fin, 0.15 * d, { tipo: 'triangle', vol: 0.06 * v, vib: 18, vibF: 9, formantes: [[900, 3, 2.4]] }); return 0.08 + 0.15 * d; },
    ferreteria: (So, t, k, fin, d, v) => {   // tuerca: clink metalico + vocecita robot
      So.tono(1800 * k, t, 0.3, { vol: 0.025 * v, conEco: false, ataque: 0.001 }); So.tono(1800 * 2.76 * k, t, 0.18, { vol: 0.012 * v, conEco: false, ataque: 0.001 });
      So._vox(t + 0.05, 420 * k, 500 * k * fin, 0.16 * d, { tipo: 'square', vol: 0.04 * v, vib: 20, vibF: 40, formantes: [[1000, 5, 2]] }); return 0.05 + 0.16 * d; },
  };

  /* Sonidos de la mascota con sus muebles (cuarto 3D): Sonido.cuarto(nombre, k). Son de ambiente (se repiten solos mientras
     la ves): bajitos, cortos, con la altura un poco al azar (j) y nunca dos iguales seguidos. [ms minimos entre dos iguales, fn(So, j, k)] */
  const boing = (So, t, f, v) => { So._vox(t, f, f * 2.25, 0.32, { tipo: 'triangle', vol: v, vib: 28, vibF: 15, formantes: [[500, 0.7, 1.8]], ataque: 0.004 }); So.golpeRuido(t, 0.05, v * 0.5, { tipo: 'lowpass', f: 500 }); };
  const grito = (So, t, j) => So._vox(t, 700 * j, 1450 * j, 0.17, { tipo: 'triangle', vol: 0.05, formantes: [[1500, 3, 2.2]], ataque: 0.005 });   // "¡iih!" del susto
  const cascabeles = (So, t, j) => {
    for (let i = 0; i < 5; i++) { const f = azar(3200, 4600) * j, tt = t + i * 0.035 + Math.random() * 0.02; So.tono(f, tt, 0.09, { vol: 0.012, conEco: false, ataque: 0.001, pan: azar(-0.4, 0.4) }); So.tono(f * 1.5, tt, 0.05, { vol: 0.005, conEco: false, ataque: 0.001 }); }
    So.golpeRuido(t, 0.2, 0.012, { tipo: 'highpass', f: 6000, ataque: 0.01 });
  };
  const VILLANCICO_NOTAS = [659, 659, 659, 0, 659, 659, 659, 0, 659, 784, 523, 587, 659, 0, 0, 0];   // "Navidad, Navidad" (Jingle Bells)
  const EFECTOS_CUARTO = {
    // subir / bajar de la cama o el sillón y caer al piso
    brinco: [250, (So, j) => { So.tono(300 * j, 0, 0.16, { tipo: 'triangle', vol: 0.04, hasta: 680 * j, conEco: false }); So.golpeRuido(0, 0.12, 0.015, { tipo: 'bandpass', f: 1200, hasta: 3200, q: 1.2, ataque: 0.04 }); }],
    bajar: [250, (So, j) => So.tono(620 * j, 0, 0.16, { tipo: 'triangle', vol: 0.035, hasta: 280 * j, conEco: false })],
    aterrizar: [200, (So, j) => { So.tono(190 * j, 0, 0.09, { vol: 0.06, hasta: 85, conEco: false, ataque: 0.002 }); So.golpeRuido(0, 0.06, 0.03, { tipo: 'lowpass', f: 700, hasta: 250 }); }],
    colchon: [250, (So, j) => { So.golpeRuido(0, 0.14, 0.05, { tipo: 'lowpass', f: 600, hasta: 200, ataque: 0.004 }); boing(So, 0, 190 * j, 0.03); }],
    resorte: [200, (So, j, k = 1) => boing(So, 0, 150 * j, 0.05 * k)],   // brincar en la cama: ¡boing!
    cojin: [250, (So, j) => { So.golpeRuido(0, 0.2, 0.05, { tipo: 'lowpass', f: 1400, hasta: 250, ataque: 0.01 }); So.ruido(0.02, 0.25, 0.02, 1800, 500); So.tono(150 * j, 0, 0.1, { vol: 0.04, hasta: 80, conEco: false }); }],
    puff: [300, (So, j) => {   // se hunde en el puff de frijolitos
      So.golpeRuido(0, 0.26, 0.05, { tipo: 'bandpass', f: 800 * j, hasta: 260, q: 1.6, ataque: 0.02 }); So.tono(140 * j, 0, 0.14, { vol: 0.04, hasta: 85, conEco: false });
      for (let i = 0; i < 7; i++) So.golpeRuido(0.03 + Math.random() * 0.25, 0.015, 0.01, { tipo: 'highpass', f: azar(3500, 6000) }); }],
    boing: [250, (So, j) => boing(So, 0, 170 * j, 0.04)],
    // dormir: ronquido al ritmo de la respiración (inhala con la nariz, exhala con silbidito); k = volumen (cabecear: más bajito)
    ronquido: [2500, (So, j, k = 1) => {
      So.golpeRuido(0, 1.3, 0.03 * k, { tipo: 'bandpass', f: 260, hasta: 520, q: 2.2, ataque: 0.7 });
      So._vox(0.3, 62 * j, 70 * j, 1.0, { tipo: 'sawtooth', vol: 0.03 * k, formantes: [[380, 3, 2]], vib: 6, vibF: 24, ataque: 0.45 });
      So.tono(820 * j, 1.75, 0.9, { vol: 0.012 * k, hasta: 560 * j, ataque: 0.25, conEco: false }); So.ruido(1.7, 1.0, 0.018 * k, 1400, 500); }],
    despierta: [800, (So, j) => { So.tono(480 * j, 0, 0.13, { tipo: 'triangle', vol: 0.05, hasta: 1150 * j, conEco: false }); So.campana(1568 * j, 0.1, 0.4, 0.025); }],
    // sillones
    pagina: [500, (So) => { So.golpeRuido(0, 0.14, 0.03, { tipo: 'bandpass', f: 2200, hasta: 5200, q: 1, ataque: 0.04, pan: 0.2 }); So.golpeRuido(0.12, 0.03, 0.02, { tipo: 'highpass', f: 4000, pan: -0.2 }); }],
    sorbo: [1200, (So, j) => {   // sorbito de chocolate... ¡ahh!
      So.golpeRuido(0, 0.3, 0.025, { tipo: 'bandpass', f: 1400, hasta: 3200, q: 3, ataque: 0.1 }); So.tono(520 * j, 0.05, 0.22, { vol: 0.02, hasta: 900 * j, conEco: false, ataque: 0.05 });
      So._vox(0.45, 520 * j, 430 * j, 0.3, { tipo: 'triangle', vol: 0.03, formantes: [[800, 3, 2]] }); }],
    reina: [2000, (So, j) => { [523, 659, 784].forEach((f, i) => So.metal(f * j, i * 0.09, 0.09, 0.025)); So.metal(1047 * j, 0.27, 0.45, 0.03); So.campana(2093 * j, 0.3, 0.9, 0.025); }],
    magia: [1000, (So, j) => [1568, 2093, 2637].forEach((f, i) => So.campana(f * j, i * 0.06, 0.8, 0.022))],
    flotar: [3000, (So, j) => { So.coro([523 * j, 784 * j], 0, 1.6, 0.01); So.tono(660 * j, 0, 0.9, { vol: 0.012, hasta: 990 * j, conSala: true, conEco: false, ataque: 0.2 }); }],
    // plantas
    regar: [1000, (So, j, k = 1.6) => {   // chorrito de la regadera (k segundos) con gotitas
      So.golpeRuido(0, k, 0.03, { tipo: 'lowpass', f: 2600, hasta: 1900, q: 0.6, ataque: 0.2 }); So.golpeRuido(0, k, 0.015, { tipo: 'bandpass', f: 700, hasta: 1000, q: 1.2, ataque: 0.2 });
      for (let i = 0; i < 4; i++) { const tt = 0.2 + Math.random() * (k - 0.3), f = azar(500, 900); So.tono(f, tt, 0.06, { vol: 0.015, hasta: f * 2, conEco: false, ataque: 0.004 }); } }],
    olfatear: [700, (So, j) => { for (let i = 0; i < 3; i++) So.golpeRuido(i * 0.13, 0.08, 0.025, { tipo: 'bandpass', f: (1800 + i * 300) * j, hasta: 3200 * j, q: 1.6, ataque: 0.02 }); }],
    preEstornudo: [2000, (So, j) => { So._vox(0, 380 * j, 520 * j, 0.35, { tipo: 'triangle', vol: 0.03, formantes: [[800, 3, 2]], ataque: 0.1 }); So._vox(0.55, 420 * j, 640 * j, 0.4, { tipo: 'triangle', vol: 0.035, formantes: [[800, 3, 2]], ataque: 0.1 }); }],
    estornudo: [1500, (So, j) => { So.golpeRuido(0, 0.28, 0.08, { tipo: 'bandpass', f: 3200, hasta: 1800, q: 0.9, ataque: 0.005 }); So._vox(0, 640 * j, 300 * j, 0.24, { tipo: 'sawtooth', vol: 0.04, formantes: [[700, 3, 2], [1200, 4, 1]] }); }],
    ay: [800, (So, j) => { So.tono(2600 * j, 0, 0.04, { tipo: 'triangle', vol: 0.03, conEco: false }); So._vox(0.03, 950 * j, 620 * j, 0.2, { tipo: 'triangle', vol: 0.05, formantes: [[1100, 3, 2.2]] }); boing(So, 0.2, 260 * j, 0.03); }],
    petalo: [300, (So, j) => So.campana([1568, 1760, 2093, 2349, 2637][Math.floor(Math.random() * 5)] * j, 0, 0.9, 0.02, azar(-0.5, 0.5))],
    cascabel: [250, (So, j) => cascabeles(So, 0, j)],
    // lámparas
    clic: [80, (So, j, k = 1) => { So.golpeRuido(0, 0.015, 0.05, { tipo: 'highpass', f: 3500 }); So.tono((k ? 1500 : 1100) * j, 0, 0.035, { tipo: 'triangle', vol: 0.03, conEco: false, ataque: 0.001, hasta: (k ? 1300 : 900) * j }); }],
    cadena: [200, (So) => { for (let i = 0; i < 4; i++) So.tono(azar(2800, 4200), i * 0.025, 0.04, { vol: 0.01, conEco: false, ataque: 0.001 }); }],
    esporas: [500, (So, j) => {
      for (let i = 0; i < 4; i++) { const f = azar(400, 800) * j; So.tono(f, i * 0.06, 0.08, { vol: 0.03, hasta: f * 2.4, conEco: false, ataque: 0.004 }); }
      [1568, 2093, 2637].forEach((f, i) => So.tono(f * j, 0.15 + i * 0.07, 0.25, { vol: 0.015, conSala: true, conEco: false, ataque: 0.002 })); }],
    aullido: [2500, (So, j) => So._vox(0, 330 * j, 400 * j, 1.9, { tipo: 'sawtooth', vol: 0.03, medio: 560 * j, formantes: [[450, 4, 2.4], [900, 6, 0.6]], vib: 9, vibF: 5.5, ataque: 0.3, conSala: true })],
    sustito: [1500, (So, j) => {   // la calabaza se prende de golpe: "fuum" de flama + acorde de miedo de caricatura + "¡iih!"
      So.golpeRuido(0, 0.25, 0.05, { tipo: 'lowpass', f: 1500, hasta: 300, ataque: 0.005 });
      for (const f of [110, 116]) So.tono(f, 0, 0.35, { tipo: 'sawtooth', vol: 0.025, hasta: f * 2, conEco: false, filtro: 900 });
      grito(So, 0.08, j); }],
    grito: [500, (So, j) => grito(So, 0, j)],
    // cuadros
    pajaros: [800, (So, j) => {
      const n = 2 + Math.floor(Math.random() * 2), pan = azar(-0.6, 0.6);
      for (let i = 0; i < n; i++) { const f = azar(2600, 3400) * j; So.tono(f, i * 0.11, 0.07, { vol: 0.014, hasta: f * 1.25, conEco: false, ataque: 0.004, pan }); So.tono(f * 1.2, i * 0.11 + 0.05, 0.04, { vol: 0.01, hasta: f * 0.9, conEco: false, ataque: 0.003, pan }); } }],
    pincel: [300, (So, j) => So.golpeRuido(0, 0.16, 0.025, { tipo: 'bandpass', f: 1700 * j, hasta: 4200 * j, q: 1.2, ataque: 0.06, pan: azar(-0.2, 0.2) })],
    tic: [80, (So, j, k = 0) => { const f = k ? 1250 : 1750; So.tono(f, 0, 0.04, { tipo: 'triangle', vol: 0.035, conEco: false, ataque: 0.001 }); So.golpeRuido(0, 0.02, 0.025, { tipo: 'bandpass', f: f * 1.6, q: 4 }); }],   // k = 1: tac
    cucu: [2000, (So) => { So.golpeRuido(0, 0.04, 0.03, { tipo: 'bandpass', f: 1500, q: 3 });
      for (const t of [0.05, 0.55]) { So._vox(t, 784, 784, 0.16, { tipo: 'triangle', vol: 0.045, formantes: [[900, 2, 2]] }); So._vox(t + 0.2, 659, 640, 0.24, { tipo: 'triangle', vol: 0.045, formantes: [[800, 2, 2]] }); } }],
    ritmo: [300, (So, j, k = 0) => {   // fiesta de neón: bombo, hi-hat y bajo (k = tiempo del compás)
      So.tono(120, 0, 0.14, { vol: 0.07, hasta: 48, conEco: false, ataque: 0.002 }); So.golpeRuido(0.25, 0.03, 0.015, { tipo: 'highpass', f: 7000 });
      So.tono([110, 110, 147, 131][k % 4], 0.25, 0.12, { tipo: 'square', vol: 0.015, conEco: false, filtro: 900 });
      if (k % 4 === 3) So.golpeRuido(0, 0.08, 0.04, { tipo: 'bandpass', f: 1500, q: 1 }); }],
    arana: [3000, (So, j) => { So._vox(0, 1500 * j, 380 * j, 1.5, { tipo: 'sine', vol: 0.022, vib: 25, vibF: 7, formantes: [[900, 0.5, 1.6]], ataque: 0.1 });
      for (let i = 0; i < 8; i++) So.tono(azar(3000, 4000), i * 0.18, 0.02, { vol: 0.006, conEco: false, ataque: 0.001 }); }],
    aleteo: [300, (So, j) => { for (let i = 0; i < 6; i++) So.golpeRuido(i * 0.05, 0.04, 0.022, { tipo: 'bandpass', f: azar(800, 1400), q: 1.6, pan: azar(-0.6, 0.6) });
      So.tono(4200 * j, 0.1, 0.04, { vol: 0.007, hasta: 5200 * j, conEco: false, ataque: 0.002 }); }],
    pisoton: [200, (So, j, k = 0) => { So.tono(110 * j, 0, 0.12, { vol: 0.07, hasta: 55, conEco: false, ataque: 0.002 }); So.golpeRuido(0, 0.07, 0.04, { tipo: 'lowpass', f: 900, hasta: 300 }); if (k) cascabeles(So, 0.02, j); }],
    firmes: [1000, (So, j) => { for (let i = 0; i < 3; i++) So.golpeRuido(i * 0.06, 0.04, 0.03, { tipo: 'bandpass', f: 2200, q: 1.4 }); So.campana(1047 * j, 0.2, 0.7, 0.03); }],
    tarareo: [300, (So, j, k = 0) => {   // "mmm" con la melodía del villancico (k = nota)
      const f = VILLANCICO_NOTAS[k % VILLANCICO_NOTAS.length]; if (!f) return;
      So._vox(0, f * 0.5, f * 0.5, 0.36, { tipo: 'triangle', vol: 0.035, formantes: [[350, 3, 2.6], [f, 4, 1]], ataque: 0.04 }); if (k % 4 === 0) cascabeles(So, 0, 1); }],
    // tele, consola, acuario
    risita: [250, (So, j, k = 1) => { So._vox(0, 680 * j, 860 * j, 0.09, { tipo: 'triangle', vol: 0.04 * k, formantes: [[1000, 3, 2.2]], ataque: 0.004 }); So._vox(0.12, 720 * j, 900 * j, 0.08, { tipo: 'triangle', vol: 0.032 * k, formantes: [[1000, 3, 2.2]], ataque: 0.004 }); }],
    tele: [1500, (So, j) => {   // efectos de caricatura que salen de la tele
      const r = Math.random();
      if (r < 0.4) So.tono(500 * j, 0, 0.35, { vol: 0.018, hasta: 1500 * j, conEco: false, ataque: 0.03 });
      else if (r < 0.75) boing(So, 0, 200 * j, 0.03);
      else { So.tono(900, 0, 0.06, { tipo: 'triangle', vol: 0.02, hasta: 300, conEco: false }); So.golpeRuido(0, 0.03, 0.02, { tipo: 'bandpass', f: 1200, q: 3 }); } }],
    botones: [200, (So) => { for (let i = 0; i < 2; i++) So.tono([523, 659, 784, 988, 1175][Math.floor(Math.random() * 5)], i * 0.08, 0.05, { tipo: 'square', vol: 0.012, conEco: false, filtro: 3500, ataque: 0.002 }); So.golpeRuido(0, 0.01, 0.012, { tipo: 'highpass', f: 5000 }); }],
    victoria8: [1500, (So) => { [523, 659, 784, 1047].forEach((f, i) => So.tono(f, i * 0.07, i === 3 ? 0.3 : 0.07, { tipo: 'square', vol: 0.02, conEco: false, filtro: 4000 })); So.tono(1319, 0.28, 0.25, { tipo: 'square', vol: 0.015, filtro: 4000 }); }],
    vidrio: [400, (So, j) => { [[3100, 0.03], [7440, 0.01]].forEach(([f, v]) => So.tono(f * j, 0, 0.12, { vol: v, conEco: false, ataque: 0.001 }));
      for (let i = 0; i < 4; i++) { const f = azar(500, 1000); So.tono(f, 0.12 + i * 0.09 + Math.random() * 0.05, 0.07, { vol: 0.018, hasta: f * 2.5, conEco: false, ataque: 0.004 }); } }],
    burbujita: [150, (So, j) => { const f = azar(500, 1000) * j; So.tono(f, 0, 0.07, { vol: 0.015, hasta: f * 2.4, conEco: false, ataque: 0.004 }); }],
    // decoraciones
    apapacho: [800, (So, j) => { So.tono(850 * j, 0, 0.14, { tipo: 'triangle', vol: 0.03, hasta: 1250 * j, conEco: false, ataque: 0.02 }); So.tono(1250 * j, 0.14, 0.08, { tipo: 'triangle', vol: 0.02, hasta: 1000 * j, conEco: false });
      So.golpeRuido(0, 0.12, 0.012, { tipo: 'bandpass', f: 1200, q: 3, ataque: 0.03 }); }],
    pinata: [300, (So, j) => { So.golpeRuido(0, 0.09, 0.08, { tipo: 'lowpass', f: 1600, hasta: 400, ataque: 0.002 }); So.tono(200 * j, 0, 0.1, { vol: 0.06, hasta: 90, conEco: false, ataque: 0.002 });
      for (let i = 0; i < 8; i++) So.golpeRuido(0.05 + i * 0.045 + Math.random() * 0.02, 0.02, 0.015, { tipo: 'bandpass', f: azar(2500, 5000), q: 2, pan: azar(-0.4, 0.4) }); }],
    tada: [1500, (So, j) => { So.metal(784 * j, 0, 0.1, 0.03); So.metal(1047 * j, 0.11, 0.5, 0.035); [1568, 2093, 2637].forEach((f, i) => So.campana(f * j, 0.15 + i * 0.06, 0.8, 0.02)); }],
    destello: [300, (So, j) => So.campana(azar(1800, 2600) * j, 0, 0.7, 0.02, azar(-0.4, 0.4))],
    inspira: [800, (So) => So.ruido(0, 0.6, 0.02, 300, 1400)],
    soplido: [1000, (So) => { So.golpeRuido(0, 0.55, 0.045, { tipo: 'bandpass', f: 1800, hasta: 700, q: 0.8, ataque: 0.05 }); So.golpeRuido(0.5, 0.05, 0.02, { tipo: 'highpass', f: 2500 }); }],
    deseo: [2000, (So) => { So.golpeRuido(0, 0.12, 0.03, { tipo: 'bandpass', f: 600, hasta: 1800, q: 1.5, ataque: 0.02 }); [1047, 1319, 1568, 2093].forEach((f, i) => So.campana(f, 0.1 + i * 0.09, 1.0, 0.022)); So.coro([523, 784], 0.1, 1.2, 0.012); }],
    toc: [200, (So, j) => { So.tono(240 * j, 0, 0.09, { tipo: 'triangle', vol: 0.06, hasta: 180 * j, conEco: false, ataque: 0.001 }); So.golpeRuido(0, 0.05, 0.035, { tipo: 'bandpass', f: 650 * j, q: 4 }); }],
    bu: [1000, (So, j) => { So._vox(0, 330 * j, 240 * j, 0.32, { tipo: 'sawtooth', vol: 0.04, formantes: [[420, 3, 2.4]], ataque: 0.01 }); So.tono(600, 0, 0.06, { vol: 0.03, hasta: 300, conEco: false }); }],
    fantasma: [1500, (So, j) => { So.ruido(0, 0.6, 0.03, 400, 2200); So._vox(0.05, 260 * j, 150 * j, 0.75, { tipo: 'sawtooth', vol: 0.035, medio: 300 * j, formantes: [[450, 3, 2.2], [900, 5, 0.8]], vib: 14, vibF: 6, ataque: 0.06, conSala: true }); }],
    burbujeo: [400, (So, j) => { for (let i = 0; i < 4; i++) { const f = azar(160, 380) * j; So.tono(f, Math.random() * 0.5, 0.1, { vol: 0.03, hasta: f * 2.2, conEco: false, ataque: 0.005 }); } So.golpeRuido(0, 0.5, 0.008, { tipo: 'lowpass', f: 500, ataque: 0.1 }); }],
    puf: [1000, (So, j) => { So.golpeRuido(0, 0.35, 0.06, { tipo: 'lowpass', f: 2200, hasta: 300, ataque: 0.005 }); So.tono(160, 0, 0.18, { vol: 0.05, hasta: 70, conEco: false });
      [1568, 1760, 2093, 2349, 2637].forEach((f, i) => So.campana(f * j, 0.12 + i * 0.05, 0.6, 0.016, -0.6 + i * 0.3)); }],
    sonaja: [300, (So) => { for (let i = 0; i < 6; i++) So.golpeRuido(i * 0.05 + Math.random() * 0.02, 0.03, 0.025, { tipo: 'bandpass', f: azar(1200, 2600), q: 2, pan: azar(-0.3, 0.3) }); }],
    abrirRegalo: [1500, (So, j) => { So.tono(620 * j, 0, 0.08, { vol: 0.06, hasta: 200, conEco: false, ataque: 0.001 }); So.golpeRuido(0, 0.04, 0.05, { tipo: 'highpass', f: 2200 });
      for (let i = 0; i < 5; i++) So.golpeRuido(0.04 + i * 0.03, 0.04, 0.025, { tipo: 'bandpass', f: azar(2000, 5000), q: 1.5 });
      [1047, 1319, 1568, 2093].forEach((f, i) => So.campana(f * j, 0.15 + i * 0.06, 0.8, 0.022, -0.45 + i * 0.3)); }],
    nieve: [250, (So) => { for (let i = 0; i < 3; i++) So.golpeRuido(i * 0.035 + Math.random() * 0.02, 0.05, 0.022, { tipo: 'highpass', f: azar(1500, 3000), q: 0.8 }); So.golpeRuido(0, 0.12, 0.015, { tipo: 'lowpass', f: 900 }); }],
    avienta: [500, (So, j) => { So.ruido(0, 0.3, 0.035, 500, 2800); So._vox(0, 420 * j, 520 * j, 0.1, { tipo: 'triangle', vol: 0.03, formantes: [[700, 3, 2]] }); }],
    paf: [500, (So) => { So.golpeRuido(0, 0.16, 0.07, { tipo: 'lowpass', f: 1800, hasta: 300, ataque: 0.002 }); for (let i = 0; i < 4; i++) So.golpeRuido(0.02 + i * 0.03, 0.04, 0.02, { tipo: 'highpass', f: azar(2500, 4500) }); }],
    // tapetes y lo que hace donde está
    pasito: [250, (So, j, k = 0) => { const f = [523, 587, 659, 784, 880, 784, 659, 587][k % 8];   // baile: cada brinco, una nota de marimba
      So.tono(f, 0, 0.16, { tipo: 'triangle', vol: 0.03, conEco: false, ataque: 0.003 }); So.tono(f * 4, 0, 0.04, { vol: 0.006, conEco: false, ataque: 0.001 }); So.tono(180, 0, 0.05, { vol: 0.03, hasta: 110, conEco: false, ataque: 0.002 }); }],
    pujido: [600, (So, j) => So._vox(0, 380 * j, 330 * j, 0.14, { tipo: 'triangle', vol: 0.03, formantes: [[650, 3, 2]], ataque: 0.01 })],
    estiron: [2000, (So, j) => So._vox(0, 300 * j, 260 * j, 1.0, { tipo: 'triangle', vol: 0.028, medio: 480 * j, formantes: [[500, 3, 2.2]], ataque: 0.15 })],
    bostezo: [2500, (So, j) => { So._vox(0, 420 * j, 260 * j, 1.1, { tipo: 'sawtooth', vol: 0.025, medio: 620 * j, formantes: [[750, 3, 2, 450]], ataque: 0.2 }); So.ruido(0.1, 1.0, 0.012, 500, 300); }],
    mareo: [2000, (So, j) => { So._vox(0, 900 * j, 500 * j, 0.9, { tipo: 'sine', vol: 0.022, vib: 60, vibF: 6, formantes: [[800, 0.5, 1.5]], ataque: 0.05 }); [2093, 2637, 3136].forEach((f, i) => So.tono(f, 0.1 + i * 0.18, 0.15, { vol: 0.01, conEco: false, ataque: 0.002 })); }],
    nota: [200, (So, j, k = 0) => { const f = [523, 587, 659, 784, 880, 1047][Math.max(0, Math.min(5, k))]; So.campana(f, 0, 0.6, 0.035); So.tono(f / 2, 0, 0.1, { tipo: 'triangle', vol: 0.02, conEco: false }); }],   // arcoíris: una por banda
    arcoirisFin: [1500, (So) => { [1047, 1319, 1568, 2093].forEach((f, i) => So.campana(f, i * 0.05, 0.9, 0.025, -0.5 + i * 0.33)); boing(So, 0, 220, 0.035); }],
    brr: [1500, (So, j) => So._vox(0, 280 * j, 250 * j, 0.6, { tipo: 'sawtooth', vol: 0.03, vib: 45, vibF: 26, formantes: [[600, 3, 2]], ataque: 0.03 })],
    viento: [1500, (So) => So.golpeRuido(0, 1.6, 0.015, { tipo: 'bandpass', f: 400, hasta: 900, q: 2, ataque: 0.6 })],
    fuchi: [1500, (So, j) => So._vox(0, 560 * j, 380 * j, 0.42, { tipo: 'sawtooth', vol: 0.028, formantes: [[350, 4, 2], [2300, 6, 1.2]], ataque: 0.03 })],
    zumbido: [600, (So, j) => So._vox(0, 210 * j, 240 * j, 0.7, { tipo: 'sawtooth', vol: 0.01, vib: 25, vibF: 9, formantes: [[1500, 1, 1.5]], ataque: 0.1, pan: azar(-0.6, 0.6) })],
    manotazo: [300, (So) => So.golpeRuido(0, 0.04, 0.03, { tipo: 'bandpass', f: 1500, q: 1.2 })],
    tripas: [1500, (So, j) => { So.tono(95 * j, 0, 0.5, { tipo: 'triangle', vol: 0.05, hasta: 68, conEco: false, ataque: 0.05 }); So._vox(0.05, 70 * j, 60 * j, 0.45, { tipo: 'sawtooth', vol: 0.02, vib: 12, vibF: 14, formantes: [[220, 2, 2]], ataque: 0.06 });
      So.golpeRuido(0, 0.45, 0.02, { tipo: 'lowpass', f: 260, ataque: 0.08 }); }],
    mordida: [300, (So) => { for (let i = 0; i < 3; i++) So.golpeRuido(i * 0.014, 0.03, 0.03, { tipo: 'highpass', f: azar(2500, 4500), q: 0.9 }); So.tono(300, 0, 0.05, { vol: 0.03, hasta: 180, conEco: false }); }],
    audifonos: [150, (So, j, k = 0) => { So.golpeRuido(0, 0.02, 0.008, { tipo: 'highpass', f: 6000 }); if (k % 2 === 0) So.tono(90, 0, 0.08, { vol: 0.025, hasta: 50, conEco: false }); }],   // la música que se sale de los audífonos
    vuelta: [600, (So) => So.golpeRuido(0, 0.3, 0.02, { tipo: 'bandpass', f: 700, hasta: 2400, q: 1.5, ataque: 0.1 })],
    saludo: [1500, (So) => So.voz(null, 'saludo')],
  };

  const Sonido = {
    activo: pref('sonido', true),
    alternar() { this.activo = !this.activo; guardar('sonido', this.activo); if (this.activo) { this.init(); this.encendido(); } return this.activo; },
    // anti-saturacion: la misma clave no suena dos veces antes de `ms` (ticks de ruleta, contadores, pops)
    _t: {},
    _puede(clave, ms) { const a = ahoraMs(); if (a - (this._t[clave] ?? -1e9) < ms) return false; this._t[clave] = a; return true; },
    init() {
      if (!this.activo) return;
      try {
        if (!ctx) {
          ctx = new (window.AudioContext || window.webkitAudioContext)();
          // master -> compresor/limitador -> salida: las capas que se enciman ya no saturan la bocina del telefono
          let salidaFinal = ctx.destination;
          try {
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.18;
            comp.connect(ctx.destination); salidaFinal = comp;
          } catch { /* sin compresor: directo */ }
          master = ctx.createGain(); master.gain.value = 0.55; master.connect(salidaFinal);
          // un solo buffer de ruido (2 s) reutilizado por todos los sonidos de ruido: sin basura ni picos de CPU
          const nr = Math.floor(ctx.sampleRate * 2); ruidoBuf = ctx.createBuffer(1, nr, ctx.sampleRate);
          const dr = ruidoBuf.getChannelData(0); for (let i = 0; i < nr; i++) dr[i] = Math.random() * 2 - 1;
          // eco suave: da brillo y "espacio" a campanas y fanfarrias
          eco = ctx.createDelay(0.5); eco.delayTime.value = 0.16;
          const fb = ctx.createGain(); fb.gain.value = 0.28;
          const ret = ctx.createGain(); ret.gain.value = 0.22;
          eco.connect(fb); fb.connect(eco); eco.connect(ret); ret.connect(master);
          // sala: reverberación de 2.2 s (ruido estéreo que decae) para campanas, coros y fanfarrias
          sala = ctx.createConvolver();
          // la cola de la sala (~200 mil muestras) se calcula en un rato libre: el primer toque (Jugar) ya no se traba por ella
          const salaIr = sala, llenarSala = () => {
            const n = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, n, ctx.sampleRate);
            for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
            salaIr.buffer = ir;
          };
          if (window.requestIdleCallback) requestIdleCallback(llenarSala, { timeout: 1200 }); else setTimeout(llenarSala, 300);
          const sret = ctx.createGain(); sret.gain.value = 0.32; sala.connect(sret); sret.connect(master);
        }
        if (ctx.state === 'suspended') ctx.resume();
      } catch { ctx = null; }
    },
    tono(freq, t = 0, dur = 0.2, { tipo = 'sine', vol = 0.2, ataque = 0.006, hasta = null, conEco = true, conSala = false, pan = 0, filtro = 0, bus = null } = {}) {
      if (!this.activo || !ctx) return;
      ataque = Math.max(0.001, Math.min(ataque, dur * 0.95));
      const t0 = ctx.currentTime + t;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = tipo; o.frequency.setValueAtTime(freq, t0);
      if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + ataque);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      let salida = g;
      if (filtro) {   // brillo que se abre (metales de la fanfarria)
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
        lp.frequency.setValueAtTime(filtro * 0.3, t0); lp.frequency.exponentialRampToValueAtTime(filtro, t0 + Math.min(0.12, dur * 0.5));
        g.connect(lp); salida = lp;
      }
      if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; salida.connect(p); salida = p; }
      o.connect(g); salida.connect(bus || master); if (conEco && !bus) salida.connect(eco); if (conSala && sala) salida.connect(sala);
      o.start(t0); o.stop(t0 + dur + 0.05);
    },
    ruido(t = 0, dur = 0.4, vol = 0.12, desde = 400, hasta = 4000) {
      if (!this.activo || !ctx || !ruidoBuf) return;
      const t0 = ctx.currentTime + t;
      const src = ctx.createBufferSource(); src.buffer = ruidoBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(desde, t0); f.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(master); if (sala && vol > 0.05) g.connect(sala);
      src.start(t0, Math.random() * 1.9); src.stop(t0 + dur + 0.02);
    },
    // ruido percusivo con filtro a elegir (chasquidos, golpes, salpicones, rasgados): ataque casi instantaneo y caida rapida
    golpeRuido(t = 0, dur = 0.03, vol = 0.1, { tipo = 'highpass', f = 3000, hasta = 0, q = 0.8, pan = 0, ataque = 0.0015, conSala = false, bus = null } = {}) {
      if (!this.activo || !ctx || !ruidoBuf) return;
      const t0 = ctx.currentTime + t; ataque = Math.max(0.001, Math.min(ataque, dur * 0.95));
      const src = ctx.createBufferSource(); src.buffer = ruidoBuf; src.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = tipo; fl.Q.value = q;
      fl.frequency.setValueAtTime(f, t0); if (hasta) fl.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      let s = g;
      if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); s = p; }
      src.connect(fl); fl.connect(g); s.connect(bus || master); if (conSala && sala) s.connect(sala);
      src.start(t0, Math.random() * 1.9); src.stop(t0 + dur + 0.02);
    },
    // un "bus" propio para capas largas que hay que poder apagar de golpe (la tension de la ruleta)
    _bus() { if (!ctx) return null; const g = ctx.createGain(); g.gain.value = 1; g.connect(master); return g; },
    _apagar(bus, ms = 120) {
      if (!bus || !ctx) return;
      try { const n = ctx.currentTime; bus.gain.cancelScheduledValues(n); bus.gain.setValueAtTime(bus.gain.value, n); bus.gain.linearRampToValueAtTime(0.0001, n + ms / 1000); } catch { /* nada */ }
      setTimeout(() => { try { bus.disconnect(); } catch { /* ya */ } }, ms + 300);
    },
    /* ---------- instrumentos ---------- */
    // campana / glockenspiel: parciales inarmónicos que decaen lento, con sala
    campana(f, t = 0, dur = 1.4, vol = 0.09, pan = 0) {
      [[1, 1], [2.0, 0.42], [3.01, 0.22], [4.21, 0.1], [5.43, 0.05]].forEach(([k, v], i) =>
        this.tono(f * k, t, dur * (1 - i * 0.14), { vol: vol * v, ataque: 0.002, conSala: true, conEco: false, pan }));
    },
    // metales de fanfarria: sierra con filtro que se abre + octava suave
    metal(f, t = 0, dur = 0.3, vol = 0.06) {
      this.tono(f, t, dur, { tipo: 'sawtooth', vol, ataque: 0.02, filtro: 3200, conSala: true, conEco: false });
      this.tono(f * 1.005, t, dur, { tipo: 'sawtooth', vol: vol * 0.6, ataque: 0.02, filtro: 2400, conSala: true, conEco: false });
      this.tono(f / 2, t, dur, { tipo: 'triangle', vol: vol * 0.8, ataque: 0.02, conEco: false });
    },
    // coro mágico: senos desafinados con ataque lento (colchón)
    coro(notas, t = 0, dur = 2.2, vol = 0.035) {
      for (const f of notas) for (const d of [-4, 0, 5]) this.tono(f * Math.pow(2, d / 1200), t, dur, { vol, ataque: 0.35, conSala: true, conEco: false, pan: d / 8 });
    },
    // tambor de festejo: golpe grave + chasquido
    tambor(t = 0, vol = 0.3) { this.tono(140, t, 0.32, { vol, conEco: false, hasta: 48 }); this.ruido(t, 0.08, 0.12, 2500, 900); },
    platillo(t = 0, dur = 1.6) { this.ruido(t, dur, 0.08, 6000, 9000); },
    brillos(n = 12, t = 0, base = 1568) {   // cascada de campanitas en escala pentatónica, de izquierda a derecha
      const esc = [1, 1.125, 1.25, 1.5, 1.667, 2, 2.25, 2.5];
      for (let i = 0; i < n; i++) this.campana(base * esc[i % esc.length] * (i >= esc.length ? 2 : 1), t + i * 0.055, 0.7, 0.035, -0.7 + 1.4 * i / Math.max(1, n - 1));
    },
    soplo(t = 0, dur = 0.5, sube = true) { this.ruido(t, dur, 0.09, sube ? 300 : 4000, sube ? 4000 : 300); },
    /* ---------- melodías de festejo ---------- */
    // misión cumplida: tres campanas que suben (la i-ésima misión suena más alta)
    mision(i = 0) { this.init(); const b = [659, 784, 988][Math.min(2, i)]; this.campana(b, 0, 1.0, 0.1); this.campana(b * 1.5, 0.11, 1.2, 0.08); this.brillos(5, 0.2, b * 2); },
    // las 3 misiones: fanfarria corta + acorde + cascada
    misiones() { this.init(); this.soplo(0, 0.35); [523, 659, 784].forEach((f, i) => this.metal(f, 0.25 + i * 0.1, 0.22, 0.05)); this.metal(1047, 0.55, 0.9, 0.06);
      [523, 659, 784, 1047].forEach((f) => this.campana(f, 0.55, 1.8, 0.05)); this.brillos(10, 0.7); this.tambor(0.55); this.platillo(0.55, 1.2); },
    // compra: pagar (monedas que BAJAN: salen de tu saldo) y desenvolver el objeto segun su rareza
    compra(rareza = 'comun') { this.init(); if (!this._puede('compra', 400)) return; this.pagar(); this.desenvolver(rareza, 0.22); },
    pagar(t = 0) {
      this.init();
      [1319, 1175, 988].forEach((f, i) => this.tono(f, t + i * 0.06, 0.12, { tipo: 'square', vol: 0.035, conEco: false, filtro: 3000, pan: 0.3 - i * 0.3 }));
      this.golpeRuido(t + 0.17, 0.09, 0.07, { tipo: 'bandpass', f: 800, q: 1.4 });   // la bolsa
    },
    desenvolver(rareza = 'comun', t = 0) {
      this.init();
      for (let i = 0; i < 6; i++) this.golpeRuido(t + i * 0.035, 0.05, 0.05, { tipo: 'bandpass', f: azar(2000, 5000), q: 1.5, pan: azar(-0.4, 0.4) });   // papel
      if (rareza === 'comun') { this.listo(t + 0.22); return; }
      if (rareza === 'rara') { [784, 988, 1175, 1568].forEach((f, i) => this.campana(f, t + 0.2 + i * 0.07, 0.9, 0.05)); return; }
      const leg = rareza === 'legendaria';
      this.tono(330, t, leg ? 0.7 : 0.4, { tipo: 'triangle', vol: 0.05, hasta: 1320, conSala: true, ataque: 0.1 });
      const t1 = t + (leg ? 0.7 : 0.4);
      this.coro(leg ? [523, 659, 784, 988, 1175] : [523, 659, 784, 1047], t1, 1.8, 0.028);
      this.brillos(leg ? 16 : 10, t1 + 0.05);
      if (leg) { this.tambor(t1, 0.3); this.platillo(t1, 1.6); [1047, 1319, 1568, 2093].forEach((f, i) => this.campana(f, t1 + i * 0.1, 1.4, 0.055)); }
    },
    // carta legendaria: subida mágica + coro + cascada
    legendaria() { this.init(); this.tono(220, 0, 1.1, { tipo: 'triangle', vol: 0.05, hasta: 1760, conSala: true }); this.soplo(0, 1.0); this.coro([523, 659, 784, 988, 1175], 0.9, 2.6, 0.03);
      this.tambor(0.95, 0.35); this.platillo(0.95, 2); this.brillos(16, 1.0); [1047, 1319, 1568, 2093].forEach((f, i) => this.campana(f, 1.0 + i * 0.13, 1.6, 0.07)); },
    // carta ICONO (la mas alta): la de leyenda + golpe grave, fanfarria de metales, acorde de coro mas alto y campanas que caen
    icono() { this.init(); this.legendaria();
      this.tono(55, 0.9, 1.4, { vol: 0.16, hasta: 41, conEco: false }); this.tambor(0.9, 0.5); this.tambor(1.25, 0.3);
      [[523, 1.15, 0.16], [659, 1.3, 0.16], [784, 1.45, 0.16], [1047, 1.62, 1.4]].forEach(([f, t, d]) => this.metal(f, t, d, 0.06));
      this.coro([784, 988, 1175, 1568], 1.62, 2.8, 0.026); this.platillo(1.62, 2.6);
      [2637, 2349, 2093, 1760, 1568, 1319].forEach((f, i) => this.campana(f, 1.8 + i * 0.11, 1.8, 0.05, -0.6 + i * 0.24)); this.brillos(22, 1.9); },
    // jefe derrotado: redoble, fanfarria de victoria y aplauso de multitud
    jefe() { this.init(); for (let i = 0; i < 6; i++) this.tambor(i * 0.09, 0.15 + i * 0.03);
      const m = [[523, 0.6, 0.18], [523, 0.8, 0.12], [523, 0.95, 0.12], [698, 1.1, 0.6], [587, 1.75, 0.18], [698, 1.95, 0.18], [880, 2.15, 1.2]];
      for (const [f, t, d] of m) this.metal(f, t, d, 0.055);
      [698, 880, 1047].forEach((f) => this.campana(f, 2.15, 2.2, 0.05)); this.tambor(2.15, 0.4); this.platillo(2.15, 2.2); this.brillos(14, 2.25);
      for (let i = 0; i < 40; i++) this.ruido(2.4 + Math.random() * 1.8, 0.05, 0.05 + Math.random() * 0.06, 1000, 3000); },
    // Moneda clasica: dos notas ascendentes, brillantes y cortas
    // semitonos: la moneda sube de tono en cadenas (filas del resumen, monedas seguidas)
    moneda(t = 0, semitonos = 0) { this.init(); const k = Math.pow(2, Math.min(12, semitonos) / 12) * Math.pow(2, azar(-0.2, 0.2) / 12);
      this.tono(988 * k, t, 0.09, { tipo: 'square', vol: 0.065, conEco: false }); this.tono(1319 * k, t + 0.075, 0.32, { tipo: 'square', vol: 0.065 }); },
    // tick de moneda que llega al contador: cada una un poco mas aguda
    tick(i = null) { this.init(); if (!this._puede('tick', 28)) return;
      const f = i == null ? 2200 + Math.random() * 400 : 2000 * Math.pow(1.0595, Math.min(i, 14));
      this.tono(f, 0, 0.03, { tipo: 'triangle', vol: 0.033, conEco: false, pan: azar(-0.3, 0.3) }); },
    // tick del contador que sube (k = avance 0..1): tono creciente y determinista, como el cofre de Clash Royale
    contadorTick(k = 0) { if (!this._puede('contador', 45)) return; this.init();
      const f = 900 + 1300 * Math.min(1, k);
      this.tono(f, 0, 0.035, { tipo: 'square', vol: 0.022, conEco: false, filtro: 4000 }); this.golpeRuido(0, 0.012, 0.025, { tipo: 'highpass', f: 5000 }); },
    // ganar monedas: 1 a 6 monedas en escalera pentatonica segun el monto real + campana final; mas de 100: brillos
    ganar(monto = 10, t = 0) {
      this.init();
      const n = monto >= 200 ? 6 : monto >= 100 ? 5 : monto >= 50 ? 4 : monto >= 20 ? 3 : monto >= 8 ? 2 : 1, esc = [0, 2, 4, 7, 9, 12];
      for (let i = 0; i < n; i++) this.moneda(t + i * 0.075, esc[i]);
      this.campana(2093, t + n * 0.075 + 0.05, 0.9, 0.04);
      if (monto > 100) this.brillos(8, t + n * 0.075 + 0.1);
    },
    // Logro: arpegio mayor ascendente (resolucion "todo bien")
    exito(t = 0) { this.init(); [523, 659, 784, 1047].forEach((f, i) => { this.tono(f, t + i * 0.075, 0.35, { tipo: 'triangle', vol: 0.1 }); this.campana(f * 2, t + i * 0.075, 0.8, 0.03, -0.4 + i * 0.27); }); },
    // Nivel: fanfarria con acorde sostenido y destellos
    nivel() {   // subida + fanfarria de metales + acorde grande con coro, campanas, tambor y platillo
      this.init(); this.soplo(0, 0.45);
      [392, 523, 659].forEach((f, i) => this.metal(f, 0.3 + i * 0.13, 0.2, 0.055));
      this.metal(784, 0.69, 0.25, 0.06); this.metal(1047, 0.95, 1.5, 0.065);
      this.coro([523, 659, 784, 1047], 0.95, 2.4, 0.03); [1047, 1319, 1568, 2093].forEach((f, i) => this.campana(f, 0.95 + i * 0.07, 1.8, 0.06));
      this.tambor(0.95, 0.4); this.platillo(0.95, 2.2); this.brillos(14, 1.2);
    },
    // Insignia: campana (parciales inarmonicos que decaen lento)
    insignia(t = 0) {
      this.init(); [784, 1047, 1319, 1568].forEach((f, i) => this.campana(f, t + 0.25 + i * 0.12, 1.4, 0.06)); this.brillos(8, t + 0.8); this.coro([523, 784], t + 0.25, 1.8, 0.025);
      [[1568, 0.12], [1568 * 2.76, 0.03], [1568 * 5.4, 0.015]].forEach(([f, v]) => this.tono(f, t, 1.6, { vol: v, ataque: 0.002 }));
      [[2093, 0.08], [2093 * 2.76, 0.02]].forEach(([f, v]) => this.tono(f, t + 0.18, 1.4, { vol: v, ataque: 0.002 }));
    },
    // Aplauso recibido: acorde calido y lento con "latido" grave (cercania, no euforia)
    aplauso() {
      this.init();
      [80, 80].forEach((f, i) => this.tono(f, i * 0.22, 0.18, { vol: 0.25, conEco: false, hasta: 55 }));
      [349, 440, 523, 698].forEach((f, i) => this.tono(f, 0.35 + i * 0.05, 1.3, { tipo: 'triangle', vol: 0.07, ataque: 0.08 }));
    },
    // Dar un aplauso: chasquidos suaves
    palmada() { this.init(); for (let i = 0; i < 3; i++) this.ruido(i * 0.09, 0.07, 0.18, 1200, 2500); this.tono(880, 0.25, 0.25, { tipo: 'triangle', vol: 0.06 }); },
    // Sorpresa: subida de tension y estallido de destellos
    tension(dur = 1.2) { this.init(); this.tono(220, 0, dur, { tipo: 'sawtooth', vol: 0.035, hasta: 880, conEco: false }); this.ruido(0, dur, 0.05, 300, 3000); },
    destellos(n = 10, t = 0) { this.init(); for (let i = 0; i < n; i++) this.tono(1800 + Math.random() * 1800, t + i * 0.05, 0.25, { vol: 0.035 }); },
    racha() { this.init(); this.ruido(0, 0.7, 0.16, 150, 3500); this.ruido(0.1, 0.6, 0.08, 800, 6000);
      [523, 698, 880, 1175, 1397].forEach((f, i) => { this.metal(f, 0.3 + i * 0.07, 0.18, 0.04); this.campana(f * 2, 0.3 + i * 0.07, 0.7, 0.03); }); this.tambor(0.65); this.brillos(8, 0.7, 2093); },
    // aviso suave (no castiga): dos notas de marimba que bajan, sin eco; nunca se repite en rafaga
    error() { this.init(); if (!this._puede('error', 350)) return;
      [[659, 0], [523, 0.12]].forEach(([f, t]) => { this.tono(f, t, 0.22, { tipo: 'triangle', vol: 0.07, conEco: false, ataque: 0.003 }); this.tono(f * 4, t, 0.06, { vol: 0.012, conEco: false, ataque: 0.001 }); }); },
    // dos notas suaves "listo" para lo cotidiano (no es un logro)
    listo(t = 0) { this.init(); this.tono(659, t, 0.18, { tipo: 'triangle', vol: 0.06, conEco: false }); this.tono(784, t + 0.08, 0.28, { tipo: 'triangle', vol: 0.06 }); },
    encendido() { this.init(); this.tono(784, 0, 0.12, { vol: 0.06, conEco: false }); this.tono(1047, 0.08, 0.22, { vol: 0.06 }); },
    // tab de la barra inferior: seno corto con un clic de 15 ms (sustituye al pop y evita el swoosh doble)
    tab() { this.init(); if (!this._puede('tab', 60)) return; this.tono(660 * Math.pow(2, azar(-0.3, 0.3) / 12), 0, 0.06, { vol: 0.04, conEco: false, hasta: 560 }); this.golpeRuido(0, 0.015, 0.03, { tipo: 'highpass', f: 4000 }); },
    abrir() { this.init(); this.ruido(0, 0.35, 0.16, 500, 5000); this.tono(110, 0, 0.25, { vol: 0.2, hasta: 55, conEco: false }); this.brillos(12, 0.2); this.coro([659, 988], 0.25, 1.2, 0.025); },
    // Pop de boton: corto, suave y grave para no cansar (se oye en cada toque)
    // round-robin de 3 alturas y ±50 cents para que no canse; nunca dos pops en menos de 40 ms
    pop() { if (!ctx || !this._puede('pop', 40)) return; this._rr = ((this._rr || 0) + 1) % 3;
      const f = [520, 490, 550][this._rr] * Math.pow(2, azar(-0.5, 0.5) / 12);
      this.tono(f, 0, 0.07, { tipo: 'sine', vol: 0.05, conEco: false, hasta: f * 0.58 }); },
    // Cambio de pantalla: soplido breve (si acaba de sonar el tab, no se encima)
    swoosh() { this.init(); if (ahoraMs() - (this._t.tab ?? -1e9) < 250 || !this._puede('swoosh', 90)) return; this.ruido(0, 0.18, 0.05, 600, 2400); },
    // higiene de la mascota: burbuja que hace "blup", recoger una popó y el baño (agua corriendo con burbujas)
    burbuja(t = 0) { const f = 300 + Math.random() * 500; this.tono(f, t, 0.09, { vol: 0.07, conEco: false, hasta: f * 2.6, ataque: 0.004 }); },
    limpiar() { this.init(); this.ruido(0, 0.16, 0.08, 4000, 900); this.burbuja(0.05); this.campana(1760, 0.12, 0.5, 0.04); },
    // baño completo (dura lo mismo que la tina, ~3.6 s): la llave abre y el agua corre, se talla con espuma
    // (squish ritmico al compas del meneo), chapoteos y burbujas; la sacudida final va en limpio()
    banio(dur = 3.6) {
      this.init(); if (!this.activo || !ctx) return;
      this.golpeRuido(0, 0.05, 0.06, { tipo: 'bandpass', f: 1200, q: 3 }); this.tono(900, 0, 0.06, { tipo: 'triangle', vol: 0.03, hasta: 1300, conEco: false });   // la llave
      this.golpeRuido(0.05, 1.3, 0.05, { tipo: 'lowpass', f: 3000, hasta: 1800, q: 0.5, ataque: 0.25 });   // chorro que llena la tina
      this.golpeRuido(0.05, 1.3, 0.03, { tipo: 'bandpass', f: 600, hasta: 900, q: 1, ataque: 0.25 });
      this.ruido(0.8, dur - 0.8, 0.03, 1800, 2400);   // agua de fondo, suave
      for (let tt = 0.5; tt < dur - 0.3; tt += 0.13 + Math.random() * 0.05)   // tallar: espuma que hace squish
        this.golpeRuido(tt, 0.09, 0.03 + Math.random() * 0.02, { tipo: 'bandpass', f: azar(900, 1600), hasta: azar(2200, 3200), q: 2.5, ataque: 0.03, pan: azar(-0.4, 0.4) });
      for (let i = 0; i < 4; i++) { const tt = azar(0.6, dur - 0.4); this.golpeRuido(tt, 0.18, 0.06, { tipo: 'lowpass', f: 1800, hasta: 500, ataque: 0.004 }); this.burbuja(tt + 0.04); }   // chapoteos
      for (let i = 0; i < dur * 7; i++) this.burbuja(0.3 + Math.random() * (dur - 0.4));
      this._t.voz = -1e9; this.voz(null, 'feliz', 1.6);   // a media tallada la mascota esta contenta
    },
    // sacudida de agua al salir de la tina + su voz de "¡limpio!" + campanitas de brillo
    limpio(t = 0) {
      this.init();
      for (let i = 0; i < 10; i++) this.golpeRuido(t + i * 0.045, 0.06, 0.035 + 0.02 * Math.sin(i / 9 * Math.PI), { tipo: 'bandpass', f: azar(1500, 3200), q: 1.2, pan: i % 2 ? 0.5 : -0.5 });
      for (let i = 0; i < 6; i++) { const tt = t + 0.1 + Math.random() * 0.5, f = azar(900, 1700); this.tono(f, tt, 0.05, { vol: 0.025, hasta: f * 1.8, conEco: false, pan: azar(-0.8, 0.8) }); }
      this._t.voz = -1e9; this.voz(null, 'feliz', t + 0.55);
      [1047, 1319, 1568, 2093].forEach((f, i) => this.campana(f, t + 0.6 + i * 0.08, 0.9, 0.04));
    },
    // Construccion: martillazos y un acorde de logro (nuevo edificio en la ciudad)
    construir() { this.init(); [0, 0.16, 0.32].forEach((t) => { this.ruido(t, 0.06, 0.25, 1500, 900); this.tono(180, t, 0.08, { tipo: 'square', vol: 0.05, conEco: false }); }); this.exito(0.5); },
    // Revelar premio: subida corta (sin girar numeros: nada de mecanicas tipo tragamonedas)
    revelar() { this.init(); this.tono(440, 0, 0.35, { tipo: 'triangle', vol: 0.06, hasta: 1320, conSala: true }); this.brillos(8, 0.3); },
    // sello de goma "CONFIRMADO" (ceremonia de ayer): baja con aire, "thunk" grave de goma sobre papel, se despega y brilla.
    // t: cuando pega (la animación CSS del sello cae en ~0.25 s). Devuelve true: recompensas.js hace `sello?.() || exito()`
    sello(t = 0.24) {
      this.init(); if (!this._puede('sello', 120)) return true;
      this.golpeRuido(Math.max(0, t - 0.12), 0.12, 0.025, { tipo: 'bandpass', f: 700, hasta: 2400, q: 1, ataque: 0.08 });
      this.tono(120, t, 0.2, { vol: 0.2, hasta: 50, conEco: false, ataque: 0.002 });
      this.golpeRuido(t, 0.12, 0.12, { tipo: 'lowpass', f: 800, hasta: 200, ataque: 0.002 }); this.golpeRuido(t, 0.07, 0.05, { tipo: 'bandpass', f: 420, q: 2 });
      this.golpeRuido(t + 0.06, 0.08, 0.02, { tipo: 'bandpass', f: 2600, hasta: 1200, q: 1.5, ataque: 0.01 });
      this.campana(1568, t + 0.1, 0.7, 0.03); this.campana(2093, t + 0.18, 0.8, 0.025);
      return true;
    },
    // se abre una hoja (el panel que sube desde abajo): "fwip" de papel suave y una notita
    hoja() { this.init(); if (ahoraMs() - (this._t.swoosh ?? -1e9) < 250 || !this._puede('hoja', 250)) return; this.golpeRuido(0, 0.16, 0.035, { tipo: 'bandpass', f: 500, hasta: 1800, q: 1, ataque: 0.05 }); this.tono(520, 0.05, 0.08, { tipo: 'triangle', vol: 0.03, hasta: 700, conEco: false }); },
    // "+1 Lo vendí": dos notitas que suben (más agudas mientras más cerca de la meta, k = 0..1) y un brillito; "−": una que baja
    sumar(k = 0) { this.init(); if (!this._puede('sumar', 120)) return; const f = 587 * Math.pow(2, Math.round(Math.max(0, Math.min(1, k)) * 7) / 12);
      this.tono(f, 0, 0.1, { tipo: 'triangle', vol: 0.06, conEco: false }); this.tono(f * 1.5, 0.07, 0.22, { tipo: 'triangle', vol: 0.06 }); this.campana(f * 3, 0.1, 0.6, 0.025); },
    restar() { this.init(); if (!this._puede('restar', 120)) return; this.tono(523, 0, 0.12, { tipo: 'triangle', vol: 0.04, hasta: 440, conEco: false }); },
    // la mascota con sus muebles (ver EFECTOS_CUARTO): solo si el audio ya está despierto (no lo arranca un cuadro de animación)
    cuarto(ev, k) {
      if (!this.activo || !ctx || ctx.state !== 'running') return false;
      const e = EFECTOS_CUARTO[ev]; if (!e || !this._puede('c:' + ev, e[0])) return false;
      try { e[1](this, Math.pow(2, azar(-0.6, 0.6) / 12), k); } catch { /* nada */ }
      return true;
    },

    /* ================= RULETA DE CAJAS (estilo CS) ================= */
    // tick de cada casilla que cruza la marca. vel: 0 (casi parada) .. 1 (maxima velocidad); tier: azul/morado/rosa/rojo/oro.
    // Rapido = clic brillante y agudo; lento = clic con cuerpo y "thock" grave (trinquete que pesa).
    ruletaTick(vel = 0.5, tier = 'azul') {
      if (!this.activo || !ctx) return;
      vel = Math.max(0, Math.min(1, +vel || 0));
      if (!this._puede('ruleta', 26)) return;   // a mas de ~38 casillas/s se funden en un repiqueteo (no se apilan)
      const j = Math.pow(2, azar(-0.45, 0.45) / 12), lento = 1 - vel;
      this._lado = -(this._lado || 0.14); const pan = this._lado;
      this.golpeRuido(0, 0.01 + lento * 0.014, 0.06 + lento * 0.05, { tipo: 'highpass', f: (2400 + vel * 3600) * j, q: 0.7, pan });
      const f = (720 + vel * 760) * j;
      this.tono(f, 0, 0.03 + lento * 0.035, { tipo: 'triangle', vol: 0.028 + lento * 0.022, hasta: f * 0.6, conEco: false, pan, ataque: 0.001 });
      if (vel < 0.35) this.tono(250 * j, 0, 0.08, { vol: 0.03 + 0.08 * (1 - vel / 0.35), hasta: 130, conEco: false, ataque: 0.002 });
      // tinte por rareza de la casilla (sutil: se siente, no se oye como premio)
      if (tier === 'morado') this.tono(f * 2, 0, 0.05, { tipo: 'triangle', vol: 0.01, conEco: false, pan, ataque: 0.001 });
      else if (tier === 'rosa') this.tono(f * 2.5, 0, 0.07, { vol: 0.014, conEco: false, pan, ataque: 0.001 });
      else if (tier === 'rojo') { this.tono(f * 1.5, 0, 0.08, { vol: 0.013, conEco: false, pan, ataque: 0.001 }); this.tono(f * 3, 0, 0.06, { vol: 0.008, conEco: false, pan }); }
      else if (tier === 'oro' && this._puede('ruletaOro', 110)) {   // la "★" que pasa: un destello que brilla y se va
        [2637, 3520, 4186].forEach((g, i) => this.tono(g * j, i * 0.025, 0.35, { vol: 0.012, conEco: false, conSala: true, pan: -pan, ataque: 0.002 }));
      }
    },
    // capa de anticipacion del frenado final: zumbido que sube, aire que crece y un latido que se alarga con la tira.
    // Devuelve { parar() } para cortarla con un fade de 120 ms al aterrizar.
    ruletaTension(dur = 3) {
      this.init(); if (!this.activo || !ctx) return null;
      const bus = this._bus(); if (!bus) return null;
      dur = Math.max(0.6, dur);
      for (const d of [-8, 8]) this.tono(98 * Math.pow(2, d / 1200), 0, dur, { tipo: 'sawtooth', vol: 0.028, ataque: dur * 0.9, hasta: 147, conEco: false, filtro: 1100, bus, pan: d / 20 });
      this.tono(880, 0, dur, { tipo: 'triangle', vol: 0.008, ataque: dur * 0.92, hasta: 1760, conEco: false, bus });
      this.golpeRuido(0, dur, 0.045, { tipo: 'bandpass', f: 300, hasta: 2800, q: 1.3, ataque: dur * 0.9, bus });
      let tt = 0.2, gap = 0.48, k = 0;
      while (tt < dur - 0.25 && k < 12) {   // lub-dub que se hace mas lento (como la tira)
        const v = 0.12 + 0.06 * (tt / dur);
        this.tono(78, tt, 0.15, { vol: v, hasta: 44, conEco: false, ataque: 0.004, bus });
        this.tono(70, tt + 0.15, 0.13, { vol: v * 0.65, hasta: 42, conEco: false, ataque: 0.004, bus });
        tt += gap; gap *= 1.13; k++;
      }
      return { parar: () => this._apagar(bus, 120) };
    },
    // la tira se detiene: "thunk" grave + clac de la marca
    ruletaAterriza() {
      this.init(); if (!this._puede('aterriza', 300)) return;
      this.tono(150, 0, 0.32, { vol: 0.22, hasta: 48, conEco: false, ataque: 0.002 });
      this.golpeRuido(0, 0.1, 0.12, { tipo: 'lowpass', f: 900, hasta: 300 });
      this.golpeRuido(0, 0.02, 0.07, { tipo: 'highpass', f: 3600 });
      this.tono(1250, 0, 0.06, { tipo: 'triangle', vol: 0.03, hasta: 700, conEco: false, ataque: 0.001 });
    },
    // golpe de premio segun la rareza: cada tier suena distinto y mas grande (recompensa variable)
    ruletaPremio(tier = 'azul', t = 0.08) {
      this.init(); if (!this._puede('premioRuleta', 600)) return;
      if (tier === 'azul') {   // agradable: dos campanas y un brillito
        this.tono(392, t, 0.35, { tipo: 'triangle', vol: 0.06 }); this.campana(784, t, 0.9, 0.07); this.campana(1175, t + 0.09, 1.1, 0.06); this.brillos(4, t + 0.18, 1568);
      } else if (tier === 'morado') {   // arpegio que sube + colchon magico
        [523, 659, 784, 1047].forEach((f, i) => { this.tono(f, t + i * 0.06, 0.32, { tipo: 'triangle', vol: 0.07 }); this.campana(f * 2, t + i * 0.06, 0.8, 0.035, -0.4 + i * 0.27); });
        this.coro([659, 988], t + 0.2, 1.3, 0.022); this.brillos(6, t + 0.3, 1568);
      } else if (tier === 'rosa') {   // mas grande: soplo, tambor, metales cortos y cascada
        this.soplo(t, 0.3); this.tambor(t + 0.25, 0.28);
        this.metal(659, t + 0.25, 0.14, 0.045); this.metal(784, t + 0.36, 0.14, 0.045); this.metal(1047, t + 0.47, 0.8, 0.055);
        [1047, 1319, 1568, 2093].forEach((f, i) => this.campana(f, t + 0.47 + i * 0.08, 1.4, 0.05));
        this.coro([523, 659, 784], t + 0.45, 1.6, 0.024); this.brillos(10, t + 0.55);
      } else {   // rojo (epico) y oro/★ (enorme)
        const oro = tier === 'oro', k = oro ? Math.pow(2, 2 / 12) : 1;   // el oro sube un tono: se siente "mas"
        this.tono(90, t, 1.0, { vol: 0.24, hasta: 34, conEco: false });   // boom
        this.golpeRuido(t, 0.5, 0.14, { tipo: 'lowpass', f: 1600, hasta: 200 });
        this.soplo(t, 0.35); this.tambor(t + 0.05, 0.32); this.tambor(t + 0.32, 0.36);
        const fan = [[523, 0.3, 0.13], [659, 0.42, 0.13], [784, 0.54, 0.13], [1047, 0.66, oro ? 1.9 : 1.3]];
        for (const [f, tt, d] of fan) this.metal(f * k, t + tt, d, 0.055);
        this.coro((oro ? [523, 659, 784, 988, 1175] : [523, 659, 784, 1047]).map((f) => f * k), t + 0.66, oro ? 3.0 : 2.2, 0.028);
        [1047, 1319, 1568, 2093].forEach((f, i) => this.campana(f * k, t + 0.66 + i * 0.09, 1.8, 0.055));
        this.platillo(t + 0.66, oro ? 2.4 : 1.8); this.tambor(t + 0.66, 0.4);
        this.brillos(oro ? 16 : 12, t + 0.75);
        if (oro) {   // cola de destellos: pings agudos al azar que se van apagando (2.4 s)
          for (let i = 0; i < 26; i++) this.tono(azar(2400, 5200), t + 1.0 + i * 0.09 + azar(0, 0.05), 0.4, { vol: 0.03 * (1 - i / 30), conEco: false, conSala: true, pan: azar(-0.8, 0.8), ataque: 0.002 });
          this.tono(220 * k, t + 0.66, 2.6, { tipo: 'triangle', vol: 0.04, ataque: 0.4, conSala: true, conEco: false });
        }
      }
    },
    // la ventana de la ruleta aparece
    ruletaAbre() { this.init(); this.ruido(0, 0.22, 0.05, 500, 3000); this.golpeRuido(0.18, 0.02, 0.05, { tipo: 'highpass', f: 3000 }); },

    /* ================= CUBETA DE PINTURA (bote de la caja) ================= */
    // traqueteo metalico que crece: golpecitos de lamina cada vez mas rapidos y fuertes + retumbe grave
    boteTiembla(dur = 0.9, t = 0) {
      this.init(); if (!this.activo || !ctx) return;
      let tt = 0, k = 0;
      while (tt < dur && k < 30) {
        const p = tt / dur, v = 0.02 + 0.07 * p;
        this.golpeRuido(t + tt, 0.025, v, { tipo: 'bandpass', f: azar(2600, 4600), q: 3, pan: azar(-0.3, 0.3) });
        const f = azar(1250, 1600);
        this.tono(f, t + tt, 0.05, { tipo: 'triangle', vol: v * 0.35, conEco: false, ataque: 0.001, hasta: f * 0.92 });
        if (k % 2 === 0) this.tono(200 + p * 70, t + tt, 0.07, { vol: 0.04 + 0.08 * p, hasta: 135, conEco: false, ataque: 0.002 });
        tt += 0.075 - 0.042 * p; k++;
      }
      this.ruido(t, dur, 0.05, 120, 420);
    },
    // la tapa sale volando: "pok" + aire + la lamina que queda vibrando (parciales inarmonicos)
    botePop(t = 0) {
      this.init();
      this.tono(720, t, 0.09, { vol: 0.17, hasta: 160, conEco: false, ataque: 0.001 });
      this.golpeRuido(t, 0.06, 0.15, { tipo: 'highpass', f: 1800 });
      this.golpeRuido(t, 0.2, 0.07, { tipo: 'bandpass', f: 1400, hasta: 5200, q: 1 });
      [[1, 0.045], [2.76, 0.028], [5.4, 0.016], [8.93, 0.009]].forEach(([k, v], i) =>
        this.tono(587 * k, t + 0.01, 1.4 - i * 0.25, { vol: v, ataque: 0.001, conSala: true, conEco: false, pan: 0.25 }));
      this.ruido(t + 0.03, 0.45, 0.06, 600, 3600);   // la tapa sube silbando
    },
    // salpicon de pintura: chapoteo humedo + gotitas
    salpicar(t = 0) {
      this.init();
      this.golpeRuido(t, 0.24, 0.13, { tipo: 'lowpass', f: 2200, hasta: 450, q: 0.7, ataque: 0.004 });
      this.golpeRuido(t + 0.02, 0.12, 0.07, { tipo: 'bandpass', f: 900, q: 2 });
      for (let i = 0; i < 7; i++) {
        const tt = t + 0.06 + Math.random() * 0.45, f = azar(450, 1100), pan = azar(-0.7, 0.7);
        this.tono(f, tt, 0.06, { vol: 0.035, hasta: f * 2.3, conEco: false, ataque: 0.003, pan });
        this.golpeRuido(tt, 0.03, 0.025, { tipo: 'bandpass', f: azar(1400, 3000), q: 2, pan });
      }
    },
    // haz de luz que sale del bote: acorde agudo que crece, aire brillante y destellos que titilan
    haz(t = 0, dur = 1.6) {
      this.init();
      for (const f of [1047, 1319, 1568, 2093]) for (const d of [-6, 6]) this.tono(f * Math.pow(2, d / 1200), t, dur, { vol: 0.012, ataque: dur * 0.4, conSala: true, conEco: false, pan: d / 10 });
      this.golpeRuido(t, dur, 0.025, { tipo: 'highpass', f: 5000, hasta: 8500, q: 0.5, ataque: dur * 0.35 });
      for (let i = 0; i < 10; i++) this.tono(2637 * [1, 1.25, 1.5][i % 3], t + 0.1 + i * 0.11, 0.3, { vol: 0.011, conSala: true, conEco: false, pan: i % 2 ? 0.5 : -0.5, ataque: 0.002 });
    },
    // el premio sube del bote girando (1.1 s, igual que la animacion): barrido magico ascendente + brillos al llegar
    premioSube(tier = 'azul', t = 0) {
      this.init();
      const dur = 1.1, n = { azul: 4, morado: 6, rosa: 8, rojo: 10, oro: 12 }[tier] || 4;
      this.tono(330, t, dur, { tipo: 'triangle', vol: 0.045, hasta: 1320, conSala: true, ataque: 0.3 });
      this.tono(495, t, dur, { vol: 0.022, hasta: 1980, conSala: true, ataque: 0.3, conEco: false });
      this.soplo(t, dur);
      this.brillos(n, t + dur * 0.75, 1568);
    },

    /* ================= SOBRES Y CARTAS ================= */
    // carga del sobre: tension + crujido de papel metalizado cada vez mas denso (lo que anuncia es lo que da)
    sobreCarga(seg = 0.8, mejor = 'bronce') {
      this.init(); this.tension(seg);
      let tt = 0, k = 0;
      while (tt < seg && k < 24) { const p = tt / seg; this.golpeRuido(tt, 0.04, 0.025 + 0.05 * p, { tipo: 'bandpass', f: azar(3000, 7000), q: 1.2, pan: azar(-0.5, 0.5) }); tt += 0.09 - 0.05 * p; k++; }
      if (mejor === 'leyenda') for (let i = 0; i < 3; i++) this.tono(72, 0.2 + i * 0.42, 0.15, { vol: 0.14, hasta: 44, conEco: false });
      if (mejor === 'icono') {   // latidos graves que se aceleran y un coro que sube con la carga
        for (let i = 0, t = 0.15; t < seg - 0.1 && i < 10; i++, t += Math.max(0.16, 0.5 - i * 0.05)) this.tono(66, t, 0.16, { vol: 0.16, hasta: 40, conEco: false });
        this.coro([392, 523, 659], 0.2, seg, 0.014); this.tono(196, 0, seg, { tipo: 'triangle', vol: 0.03, hasta: 1568, conSala: true, ataque: seg * 0.6 });
      }
    },
    // se rasga la tira del sobre: cremallera de papel + jalon
    rasgar(t = 0) {
      this.init();
      for (let i = 0; i < 12; i++) this.golpeRuido(t + i * 0.022, 0.035, 0.05 + i * 0.004, { tipo: 'bandpass', f: 1800 + i * 300, q: 2, pan: -0.5 + i / 12 });
      this.golpeRuido(t + 0.26, 0.12, 0.08, { tipo: 'highpass', f: 2500, hasta: 6000 });
    },
    // voltear carta: chasquido de carton y golpe segun el nivel (bronce, plata, oro; la leyenda tiene su propio festejo)
    cartaVoltea(nivel = 'bronce') {
      this.init(); if (!this._puede('voltea', 60)) return;
      this.golpeRuido(0, 0.06, 0.07, { tipo: 'bandpass', f: 2600, hasta: 1100, q: 1 });
      this.tono(520, 0, 0.07, { vol: 0.045, hasta: 300, conEco: false });
      if (nivel === 'plata') { this.campana(1568, 0.04, 0.6, 0.06); this.campana(2093, 0.12, 0.7, 0.04); }
      else if (nivel === 'oro') { [784, 988, 1175, 1568].forEach((f, i) => this.campana(f, 0.04 + i * 0.07, 1.0, 0.055, -0.4 + i * 0.27)); this.coro([784, 1175], 0.2, 1.2, 0.02); this.brillos(8, 0.3); }
      else if (nivel === 'leyenda') this.golpeRuido(0, 0.3, 0.06, { tipo: 'highpass', f: 3000, hasta: 9000 });
    },
    // cambio de cartas: remolino (soplos que van de lado a lado y suben)
    remolino(dur = 1.1) {
      this.init();
      for (let i = 0; i < 6; i++) this.golpeRuido(i * dur / 6, 0.32, 0.05, { tipo: 'bandpass', f: 600 + i * 250, hasta: 1800 + i * 450, q: 2, pan: i % 2 ? 0.6 : -0.6, ataque: 0.12 });
      this.tono(220, 0, dur, { tipo: 'triangle', vol: 0.035, hasta: 880, conSala: true, ataque: 0.2 });
    },

    /* ================= JEFE ================= */
    // ¡Atacar!: tajo de espada + golpe + "auch" del jefe
    golpe() {
      this.init(); if (!this._puede('golpe', 200)) return;
      this.ruido(0, 0.12, 0.08, 800, 5000);
      this.tambor(0.1, 0.32); this.golpeRuido(0.1, 0.05, 0.14, { tipo: 'bandpass', f: 2000, q: 1 });
      this.tono(240, 0.16, 0.26, { tipo: 'sawtooth', vol: 0.05, hasta: 120, conEco: false, filtro: 1000 });
    },

    /* ================= MASCOTA: VOZ POR ESPECIE ================= */
    // la especie de tu mascota (perfil.monstruo o la del gremio); 'obra' si no hay sesion
    _especie() { try { const b = typeof S !== 'undefined' ? S.base : null; return b?.perfil?.monstruo || b?.gremio?.clave || 'obra'; } catch { return 'obra'; } },
    // "cuerda vocal": oscilador con glissando (f0 -> medio -> f1), vibrato opcional y formantes (filtros pasabanda en paralelo)
    _vox(t, f0, f1, dur, { tipo = 'sawtooth', vol = 0.06, formantes = [[800, 4, 2]], vib = 0, vibF = 6, medio = null, pan = 0, ataque = 0.015, conSala = false } = {}) {
      if (!this.activo || !ctx) return;
      const t0 = ctx.currentTime + t; ataque = Math.min(ataque, dur * 0.4);
      const o = ctx.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f0, t0);
      if (medio) o.frequency.exponentialRampToValueAtTime(medio, t0 + dur * 0.4);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
      if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vibF; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + ataque);
      g.gain.linearRampToValueAtTime(vol * 0.75, t0 + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      for (const [f, q, ganancia, fHasta] of formantes) {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(f, t0);
        if (fHasta) bp.frequency.exponentialRampToValueAtTime(fHasta, t0 + dur);
        const fg = ctx.createGain(); fg.gain.value = ganancia; o.connect(bp); bp.connect(fg); fg.connect(g);
      }
      let s = g; if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); s = p; }
      s.connect(master); if (conSala && sala) s.connect(sala);
      o.start(t0); o.stop(t0 + dur + 0.05);
    },
    // una frase de la mascota segun su especie y su animo:
    // feliz / saludo / caricia / comer / hambre / sucio / popo / queja / aburrido / dormido / tranquilo
    voz(especie = null, animo = 'feliz', t = 0) {
      this.init(); if (!this.activo || !ctx) return;
      if (!this._puede('voz', 220)) return;
      const e0 = especie || this._especie(), esp = VOCES[e0] ? e0 : 'obra', f = VOCES[esp];
      const syl = (tt, k, fin, d, v) => f(this, tt, k * Math.pow(2, azar(-1, 1) / 12), fin, d, v) || 0.2;
      switch (animo) {
        case 'saludo': { const a = syl(t, 1, 1.15, 1, 1); syl(t + a + 0.06, 1.25, 1.1, 0.9, 0.9); break; }
        case 'comer': syl(t, 0.92, 0.9, 1.1, 0.75); break;
        case 'hambre': case 'sucio': case 'popo': case 'queja': case 'aburrido': {   // queja: dos silabas que bajan, lentas (nunca llanto)
          const a = syl(t, 0.92, 0.74, 1.45, 0.75); const b = syl(t + a + 0.08, 0.84, 0.72, 1.25, 0.55);
          const tf = t + a + b + 0.12;
          if (animo === 'hambre') { this.tono(95, tf, 0.45, { tipo: 'triangle', vol: 0.06, hasta: 70, conEco: false, ataque: 0.05 }); this.golpeRuido(tf, 0.45, 0.025, { tipo: 'lowpass', f: 260, ataque: 0.08 }); }   // pancita que gruñe
          else if (animo === 'sucio' || animo === 'popo') this.golpeRuido(tf, 0.22, 0.035, { tipo: 'bandpass', f: 900, hasta: 380, q: 1.5, ataque: 0.03 });   // "puaj"
          break;
        }
        case 'dormido': syl(t, 0.72, 0.85, 1.6, 0.35); this.ruido(t + 0.45, 1.1, 0.03, 300, 650); break;
        case 'tranquilo': syl(t, 1, 1.02, 1, 0.8); break;
        default: {   // feliz y caricia
          const a = syl(t, 1.05, 1.18, 1, 1); syl(t + a + 0.05, 1.22, 1.22, 0.85, 0.85);
          if (animo === 'caricia' && ['gatito', 'panda', 'capibara', 'conejito', 'xolo', 'mapache'].includes(esp))   // ronroneo
            this._vox(t, 27, 25, 1.1, { tipo: 'sawtooth', vol: 0.05, formantes: [[320, 1.4, 2.2]], ataque: 0.2 });
        }
      }
    },
    // compatibilidad: mascota('feliz'|'comer') -> su voz
    mascota(tipo = 'feliz') { this.voz(null, tipo); },

    /* ================= CUIDADOS ================= */
    // masticar segun la comida: galleta crujiente, fruta jugosa, pastel suavecito; al final la voz satisfecha
    masticar(comida = 'galleta', t = 0) {
      this.init(); if (!this.activo || !ctx) return;
      if (comida === 'fruta') {
        for (let i = 0; i < 4; i++) { const tt = t + i * 0.2; this.golpeRuido(tt, 0.12, 0.05, { tipo: 'bandpass', f: azar(700, 1100), hasta: 400, q: 2, ataque: 0.01 }); this.burbuja(tt + 0.05); }
        this.tono(900, t + 0.85, 0.18, { vol: 0.03, hasta: 300, conEco: false });   // sorbito del jugo
      } else if (comida === 'pastel') {
        for (let i = 0; i < 3; i++) { const tt = t + i * 0.24; this.golpeRuido(tt, 0.14, 0.05, { tipo: 'lowpass', f: 700, hasta: 300, ataque: 0.02 }); this.tono(260, tt, 0.1, { vol: 0.05, hasta: 170, conEco: false }); }
        this.campana(1568, t + 0.8, 0.6, 0.03);   // "¡dulce!"
      } else {   // galleta: crunch crujiente e irregular
        for (let i = 0; i < 5; i++) { const tt = t + i * 0.16 + azar(0, 0.04); for (let j = 0; j < 3; j++) this.golpeRuido(tt + j * 0.012, 0.03, 0.05, { tipo: 'highpass', f: azar(2500, 4500), q: 0.9 }); this.tono(300, tt, 0.05, { vol: 0.04, hasta: 180, conEco: false }); }
      }
      this._t.voz = -1e9; this.voz(null, 'comer', t + 1.05);
    },
    // pelota: lanzar (whoosh + "hup"), atrapar (squish de goma que sube un semitono por atrapada), rebote al volver
    lanzar(n = 1) { this.init(); this.ruido(0, 0.3, 0.05, 500, 3200); this.tono(320, 0, 0.08, { tipo: 'triangle', vol: 0.03, hasta: 480, conEco: false }); },
    pelota(n = 1) {
      this.init(); const k = Math.pow(2, Math.min(7, n - 1) / 12);
      this.golpeRuido(0, 0.05, 0.06, { tipo: 'lowpass', f: 900 });
      this.tono(700 * k, 0, 0.09, { vol: 0.05, hasta: 1100 * k, conEco: false });   // squeak de la pelota de goma
      this.voz(null, n >= 5 ? 'saludo' : 'feliz', 0.12);
    },
    rebote(t = 0) { this.init(); this.tono(180, t, 0.13, { vol: 0.08, hasta: 420, conEco: false }); this.golpeRuido(t, 0.03, 0.04, { tipo: 'lowpass', f: 700 }); this.tono(220, t + 0.16, 0.08, { vol: 0.035, hasta: 380, conEco: false }); },
    // al terminar las 5 atrapadas: fanfarrita + voz
    pelotaFin() { this.init(); [784, 988, 1175, 1568].forEach((f, i) => this.tono(f, 0.05 + i * 0.07, 0.25, { tipo: 'triangle', vol: 0.06 })); this.brillos(5, 0.3); this._t.voz = -1e9; this.voz(null, 'saludo', 0.45); },
    // popo: "plop" suave al aparecer; al recogerla, squish + silbato que sube + pop + campanita (gracioso, sin asco)
    plop(t = 0) { this.init(); if (!this._puede('plop', 250)) return; this.tono(260, t, 0.12, { vol: 0.07, hasta: 90, conEco: false }); this.golpeRuido(t, 0.09, 0.04, { tipo: 'lowpass', f: 600, hasta: 250 }); },
    recogerPopo() {
      this.init(); if (!this._puede('recoger', 150)) return;
      this.golpeRuido(0, 0.12, 0.06, { tipo: 'bandpass', f: 500, hasta: 1400, q: 2, ataque: 0.01 });
      this.tono(420, 0.08, 0.28, { vol: 0.045, hasta: 1700, conEco: false });   // silbato de embolo
      this.tono(1800, 0.37, 0.05, { vol: 0.05, hasta: 900, conEco: false }); this.campana(1760, 0.42, 0.5, 0.035);
    },

    /* ================= METRICAS CUMPLIDAS (jingles cortos, de menor a mayor) ================= */
    // la mascota reacciona al final del jingle con su voz feliz
    reaccion(t = 0.8) { this._t.voz = -1e9; this.voz(null, 'feliz', t); },
    seguimiento() { this.init(); this.moneda(); [784, 988].forEach((f, i) => this.campana(f, 0.12 + i * 0.09, 0.8, 0.055)); },   // visita reportada
    cobro(t = 0) {   // cotizacion cobrada / venta: "ka-CHING" de caja registradora (aqui si: es una venta real del asesor)
      this.init(); this.golpeRuido(t, 0.09, 0.12, { tipo: 'highpass', f: 3000 }); this.tono(160, t, 0.08, { tipo: 'square', vol: 0.04, conEco: false, filtro: 1200 });
      this.campana(2637, t + 0.08, 0.6, 0.06); this.campana(3520, t + 0.16, 0.9, 0.06); this.moneda(t + 0.26, 4);
    },
    despertar(t = 0) {   // cliente reactivado: ronquidito, "ding-ding" de despertador y silbido que sube
      this.init(); this.golpeRuido(t, 0.3, 0.04, { tipo: 'bandpass', f: 380, hasta: 180, q: 2, ataque: 0.1 });
      for (let i = 0; i < 3; i++) this.campana(2093, t + 0.32 + i * 0.07, 0.4, 0.045);
      this.tono(600, t + 0.55, 0.3, { vol: 0.045, hasta: 1800, conSala: true, conEco: false });
    },
    contrato(t = 0) {   // reto semanal (contrato) cumplido: firma (rasgueo de pluma) + sello + acorde
      this.init(); for (let i = 0; i < 4; i++) this.golpeRuido(t + i * 0.05, 0.05, 0.035, { tipo: 'bandpass', f: azar(3000, 5000), q: 2 });
      this.tono(140, t + 0.25, 0.15, { vol: 0.14, hasta: 70, conEco: false }); this.golpeRuido(t + 0.25, 0.05, 0.08, { tipo: 'lowpass', f: 1200 });
      [523, 659, 784, 1047].forEach((f) => this.campana(f, t + 0.35, 1.2, 0.04)); this.metal(1047, t + 0.35, 0.5, 0.035);
    },
    rachaRiesgo() {   // recordatorio amable (sin alarma ni tic-tac): dos notas que "preguntan" y una brasita
      this.init(); if (!this._puede('rachaRiesgo', 3000)) return;
      this.tono(659, 0, 0.25, { tipo: 'triangle', vol: 0.045 }); this.tono(784, 0.18, 0.4, { tipo: 'triangle', vol: 0.045 });
      this.ruido(0.1, 0.5, 0.025, 300, 1200);
    },
    // fila del resumen del cofre: cada tipo de logro suena distinto (y sube un paso en la escala)
    filaPremio(tipo = '', paso = 0) {
      this.init();
      if (tipo === 'cotizacion' || tipo === 'seguimiento_efectivo' || tipo === 'ventas_pequenas') return this.cobro();
      if (tipo === 'reactivacion') return this.despertar();
      if (tipo === 'reto') return this.contrato();
      if (tipo === 'mision') { this.campana([659, 784, 988][paso % 3], 0, 0.9, 0.07); return; }
      if (tipo === 'racha') { this.ruido(0, 0.35, 0.08, 200, 3000); this.metal(698, 0.12, 0.2, 0.04); return; }
      if (tipo === 'qr') { this.tono(1800, 0, 0.06, { vol: 0.04, conEco: false }); this.moneda(0.08, paso); return; }
      if (tipo === 'complementos') { this.moneda(0, paso); this.moneda(0.1, paso + 4); return; }
      if (tipo === 'aplauso') { this.palmada(); return; }
      this.moneda(0, paso);
    },
  };

  /* ------------------------------------------------------------ vibracion */
  const vibrar = (p) => { try { if (navigator.vibrate && Sonido.activo) navigator.vibrate(p); } catch { /* sin soporte */ } };

  /* ------------------------------------------------------------ confeti */
  const COLORES = ['#f26b1d', '#ffb347', '#d9a520', '#1f8a55', '#2d6cb5', '#6b3fc0', '#ffffff'];
  function confeti({ cantidad = 120, origenY = 0.35, duracion = 2600, fuerza = 1 } = {}) {
    if (reducido()) return;
    const cv = document.createElement('canvas');
    cv.className = 'confeti';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    document.body.appendChild(cv);
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    const ps = Array.from({ length: cantidad }, () => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const v = (6 + Math.random() * 9) * fuerza;
      return { x: innerWidth / 2 + (Math.random() - 0.5) * 60, y: innerHeight * origenY, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
        col: COLORES[Math.floor(Math.random() * COLORES.length)], forma: Math.random() < 0.3 ? 'c' : 'r' };
    });
    const t0 = performance.now();
    (function cuadro(t) {
      const k = (t - t0) / duracion;
      c.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) {
        p.vy += 0.32; p.vx *= 0.99; p.vy *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        c.save(); c.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4);
        c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.col;
        if (p.forma === 'c') { c.beginPath(); c.arc(0, 0, p.w / 2, 0, 7); c.fill(); }
        else c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        c.restore();
      }
      if (k < 1) requestAnimationFrame(cuadro); else cv.remove();
    })(t0);
  }

  /* ------------------------------------------------------------ monedas que vuelan al contador */
  function monedas(desde, hasta, n = 8, alLlegar = () => {}) {
    if (!desde || !hasta || reducido()) { alLlegar(n); return; }
    const a = desde.getBoundingClientRect(), b = hasta.getBoundingClientRect();
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
    for (let i = 0; i < n; i++) {
      const m = document.createElement('div');
      m.className = 'moneda';
      document.body.appendChild(m);
      const dx = (Math.random() - 0.5) * 140, retraso = i * 70, dur = 650 + Math.random() * 200;
      setTimeout(() => {
        const t0 = performance.now();
        (function paso(t) {
          const k = Math.max(0, Math.min(1, (t - t0) / dur)), e = k * k * (3 - 2 * k);
          const cx = x0 + dx, cy = Math.min(y0, y1) - 90;
          const x = (1 - e) ** 2 * x0 + 2 * (1 - e) * e * cx + e * e * x1;
          const y = (1 - e) ** 2 * y0 + 2 * (1 - e) * e * cy + e * e * y1;
          m.style.transform = `translate(${x - 11}px, ${y - 11}px) scale(${1 - e * 0.35})`;
          if (k < 1) requestAnimationFrame(paso);
          else { m.remove(); Sonido.tick(i); hasta.classList.remove('rebote'); void hasta.offsetWidth; hasta.classList.add('rebote'); alLlegar(i + 1); }
        })(t0);
      }, retraso);
    }
  }

  /* ------------------------------------------------------------ contador animado */
  function contar(el, desde, hasta, dur = 900, conTick = false) {
    const nf = new Intl.NumberFormat('es-MX');
    const t0 = performance.now();
    let ultimo = desde, pasoTick = -1;
    return new Promise((ok) => {
      let listo = false;
      const fin = () => { if (listo) return; listo = true; el.textContent = nf.format(hasta); ok(); };
      setTimeout(fin, dur + 250); // respaldo: si el navegador pausa las animaciones, el numero igual termina
      (function paso(t) {
        if (listo) return;
        const k = Math.max(0, Math.min(1, (t - t0) / dur)), v = Math.round(desde + (hasta - desde) * (1 - Math.pow(1 - k, 3)));
        el.textContent = nf.format(v);
        // tick determinista: uno cada ~1/14 del recorrido, con tono que sube (honesto: solo cuenta lo ya ganado)
        if (conTick && v !== ultimo) { const paso = Math.floor(k * 14); if (paso !== pasoTick) { pasoTick = paso; Sonido.contadorTick(k); } }
        ultimo = v;
        if (k < 1) requestAnimationFrame(paso); else fin();
      })(t0);
    });
  }

  /* ------------------------------------------------------------ rafaga de corazones (aplausos) */
  function corazones(el, n = 7) {
    if (!el || reducido()) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const h = document.createElement('div');
      h.className = 'corazon';
      h.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.1C1 8.4 3.2 5 6.6 5c2 0 3.6 1.1 4.4 2.6h2C13.8 6.1 15.4 5 17.4 5 20.8 5 23 8.4 21.5 11.9 19.5 16.4 12 21 12 21z"/></svg>';
      h.style.left = r.left + r.width / 2 + 'px'; h.style.top = r.top + 'px';
      h.style.setProperty('--dx', (Math.random() - 0.5) * 120 + 'px');
      h.style.animationDelay = i * 60 + 'ms';
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1500 + i * 60);
    }
  }

  /* ------------------------------------------------------------ lienzo de efectos (uno a la vez, se borra solo) */
  function lienzo(dur) {
    const cv = document.createElement('canvas'); cv.className = 'confeti';
    const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    document.body.appendChild(cv); const c = cv.getContext('2d'); c.scale(dpr, dpr);
    setTimeout(() => cv.remove(), dur + 500); return c;
  }
  const PALETA = ['#ffd43b', '#ff6b9d', '#4dabf7', '#69db7c', '#b197fc', '#ffa94d', '#ffffff'];
  // fuegos artificiales: cohetes que suben con estela y estallan en anillos de chispas que brillan y caen
  function fuegos({ n = 5, dur = 3200, colores = PALETA } = {}) {
    if (reducido()) return;
    const c = lienzo(dur), cohetes = [], chispas = [], t0 = performance.now();
    for (let i = 0; i < n; i++) cohetes.push({ x: innerWidth * (0.18 + 0.64 * Math.random()), y: innerHeight + 10, vy: -(9 + Math.random() * 4),
      alto: innerHeight * (0.15 + Math.random() * 0.3), sale: i * (dur * 0.5 / n), col: colores[i % colores.length], vivo: true });
    (function cuadro(t) {
      const ms = t - t0; c.globalCompositeOperation = 'destination-out'; c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(0, 0, innerWidth, innerHeight);
      c.globalCompositeOperation = 'lighter';
      for (const k of cohetes) {
        if (!k.vivo || ms < k.sale) continue;
        k.y += k.vy; k.vy *= 0.985; c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(k.x, k.y, 2.6, 0, 7); c.fill();
        if (k.y <= k.alto || k.vy > -2) {
          k.vivo = false; Sonido.activo && Sonido.campana(1200 + Math.random() * 900, 0, 0.5, 0.025);
          const m = 46 + Math.floor(Math.random() * 20);
          for (let j = 0; j < m; j++) { const a = (j / m) * Math.PI * 2, v = 2.2 + Math.random() * 2.6;
            chispas.push({ x: k.x, y: k.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 1, col: Math.random() < 0.2 ? '#ffffff' : k.col }); }
        }
      }
      for (const p of chispas) {
        if (p.vida <= 0) continue;
        p.vy += 0.05; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.vida -= 0.012;
        c.globalAlpha = Math.max(0, p.vida); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, 1.4 + p.vida * 1.8, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
      if (ms < dur) requestAnimationFrame(cuadro);
    })(t0);
  }
  // lluvia de monedas doradas que giran y rebotan suave
  function lluviaMonedas({ n = 40, dur = 2600 } = {}) {
    if (reducido()) return;
    const c = lienzo(dur), t0 = performance.now();
    const ms = Array.from({ length: n }, () => ({ x: Math.random() * innerWidth, y: -40 - Math.random() * innerHeight * 0.6, vy: 3 + Math.random() * 3,
      g: Math.random() * 6, vg: 0.12 + Math.random() * 0.15, r: 9 + Math.random() * 7 }));
    (function cuadro(t) {
      const k = (t - t0) / dur; c.clearRect(0, 0, innerWidth, innerHeight);
      for (const m of ms) {
        m.vy += 0.18; m.y += m.vy; m.g += m.vg; const w = Math.abs(Math.cos(m.g)) * m.r + 1.5;
        c.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.75) / 0.25);
        const grad = c.createLinearGradient(m.x - w, m.y - m.r, m.x + w, m.y + m.r); grad.addColorStop(0, '#fff3a3'); grad.addColorStop(0.5, '#ffc928'); grad.addColorStop(1, '#d98a00');
        c.fillStyle = grad; c.beginPath(); c.ellipse(m.x, m.y, w, m.r, 0, 0, 7); c.fill();
        c.strokeStyle = 'rgba(160,90,0,.55)'; c.lineWidth = 1.5; c.stroke();
        if (w > m.r * 0.6) { c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(m.x - w * 0.3, m.y - m.r * 0.35, w * 0.18, m.r * 0.22, 0, 0, 7); c.fill(); }
      }
      c.globalAlpha = 1;
      if (k < 1) requestAnimationFrame(cuadro);
    })(t0);
  }
  // destello de pantalla: flash suave + rayos girando detrás del centro
  function rafaga(color = '#ffe066') {
    if (reducido()) return;
    const d = document.createElement('div'); d.className = 'fx-rafaga'; d.style.setProperty('--c', color);
    d.innerHTML = '<i class="fx-rayos"></i><i class="fx-flash"></i>'; document.body.appendChild(d); setTimeout(() => d.remove(), 2600);
  }
  // estrellas que salen disparadas de un elemento (o del centro)
  function estrellas(el, n = 14, color = '#ffd43b') {
    if (reducido()) return;
    const r = el?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div'); s.className = 'fx-estrella'; s.style.left = r.left + r.width / 2 + 'px'; s.style.top = r.top + r.height / 2 + 'px';
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3, dist = 70 + Math.random() * 90;
      s.style.setProperty('--dx', Math.cos(a) * dist + 'px'); s.style.setProperty('--dy', Math.sin(a) * dist + 'px'); s.style.setProperty('--c', i % 3 ? color : '#ffffff');
      s.style.setProperty('--rot', (Math.random() * 360 | 0) + 'deg'); s.style.animationDelay = (Math.random() * 120 | 0) + 'ms';
      document.body.appendChild(s); setTimeout(() => s.remove(), 1400);
    }
  }
  // ondas de luz que se expanden desde un elemento
  function ondas(el, color = '#ffffff') {
    if (reducido() || !el) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 3; i++) { const o = document.createElement('div'); o.className = 'fx-onda'; o.style.left = r.left + r.width / 2 + 'px'; o.style.top = r.top + r.height / 2 + 'px';
      o.style.setProperty('--c', color); o.style.animationDelay = i * 160 + 'ms'; document.body.appendChild(o); setTimeout(() => o.remove(), 1400); }
  }
  // letrero grande que entra rebotando con brillo que lo cruza (¡NIVEL!, ¡MISIONES!, ¡DERROTADO!)
  function letrero(texto, sub = '', color = '#ffcc2e') {
    const d = document.createElement('div'); d.className = 'fx-letrero'; d.style.setProperty('--c', color);
    d.innerHTML = `<b>${texto}</b>${sub ? `<small>${sub}</small>` : ''}`; document.body.appendChild(d); setTimeout(() => d.remove(), 2400);
  }
  /* festejos listos para cada logro: sonido + efectos coordinados */
  const CELEBRAR = {
    mision: (o) => { Sonido.mision(o.i || 0); Sonido.reaccion(0.9); estrellas(o.el, 10, '#69db7c'); ondas(o.el, '#69db7c'); vibrar([20, 30, 20]); },
    misiones: (o) => { Sonido.misiones(); Sonido.reaccion(2.0); rafaga('#69db7c'); letrero('¡Misiones completas!', 'Abre tu cofre del día', '#38d9a9'); fuegos({ n: 4 }); confeti({ cantidad: 120, origenY: 0.4 }); vibrar([40, 40, 40, 40, 120]); },
    logro: (o) => { Sonido.seguimiento(); Sonido.exito(0.3); Sonido.reaccion(0.95); confeti({ cantidad: 80, origenY: 0.5, fuerza: 0.8 }); estrellas(o.el, 12); vibrar([30, 40, 30]); },
    diario: (o) => { Sonido.ganar(o.puntos || 10); Sonido.listo(0.45); Sonido.voz(null, 'saludo', 0.8); lluviaMonedas({ n: 22, dur: 2000 }); estrellas(o.el, 10); vibrar([20, 30, 40]); },
    cofre: (o) => { Sonido.ganar(o.puntos || 20); rafaga('#ffd43b'); lluviaMonedas({ n: 36 }); vibrar([40, 30, 80]); },
    racha: (o) => { Sonido.racha(); Sonido.reaccion(1.3); rafaga('#ff922b'); estrellas(o.el, 16, '#ff922b'); confeti({ cantidad: 90, origenY: 0.45, fuerza: 0.9 }); vibrar([30, 30, 30, 30, 60]); },
    insignia: (o) => { Sonido.insignia(); Sonido.reaccion(1.7); rafaga('#ffd43b'); estrellas(o.el, 18); ondas(o.el, '#ffe066'); confeti({ cantidad: 100, origenY: 0.35, fuerza: 0.9 }); vibrar([20, 60, 20]); },
    nivel: (o) => { Sonido.nivel(); Sonido.reaccion(2.8); rafaga('#ffd43b'); letrero('¡Subiste de nivel!', o.texto || '', '#ffcc2e'); fuegos({ n: 7, dur: 3600 }); confeti({ cantidad: 220, origenY: 0.4, fuerza: 1.35, duracion: 3400 }); vibrar([80, 50, 80, 50, 200]); },
    sube: (o) => { [523, 659, 784, 1047].slice(0, 4).forEach((f, i) => Sonido.metal(f, i * 0.09, 0.16, 0.04)); Sonido.campana(1568, 0.36, 1.1, 0.06); Sonido.brillos(8, 0.4); Sonido.reaccion(1.1); estrellas(o.el, 12, '#69db7c'); vibrar([30, 30, 60]); },
    jefe: (o) => { Sonido.jefe(); Sonido.reaccion(3.6); rafaga('#ff6b9d'); setTimeout(() => letrero('¡Jefe derrotado!', o.texto || '', '#ff6b9d'), 1000); setTimeout(() => fuegos({ n: 9, dur: 4200 }), 900);
      confeti({ cantidad: 240, fuerza: 1.4, duracion: 3600 }); vibrar([60, 40, 60, 40, 60, 40, 200]); },
    compra: (o) => { const r = o.rareza || 'comun'; Sonido.compra(r); estrellas(o.el, r === 'legendaria' ? 22 : r === 'epica' ? 16 : 10, r === 'legendaria' ? '#ffd43b' : r === 'epica' ? '#b197fc' : '#4dabf7');
      if (r === 'epica' || r === 'legendaria') { rafaga(r === 'legendaria' ? '#ffd43b' : '#b197fc'); fuegos({ n: r === 'legendaria' ? 6 : 3 }); }
      confeti({ cantidad: r === 'legendaria' ? 220 : r === 'epica' ? 150 : 90, origenY: 0.3, fuerza: 1 }); vibrar([30, 40, 80]); },
    legendaria: () => { Sonido.legendaria(); rafaga('#ffd43b'); setTimeout(() => fuegos({ n: 6, dur: 3400 }), 900); },
  };
  function celebrar(tipo, o = {}) { Sonido.init(); try { (CELEBRAR[tipo] || CELEBRAR.logro)(o); } catch { /* un efecto nunca rompe la pantalla */ } }

  return { Sonido, vibrar, confeti, monedas, contar, corazones, reducido, fuegos, lluviaMonedas, rafaga, estrellas, ondas, letrero, celebrar };
})();
