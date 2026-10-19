// Núcleo: espacio de nombres, constantes y utilidades comunes.
// Todos los módulos cuelgan de window.IE para que el juego funcione abriendo
// index.html directamente (file://) sin servidor ni módulos ES.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const IE = root.IE = root.IE || {};

  IE.VERSION = '1.0.0';
  IE.SAVE_VERSION = 1;
  IE.TILE = 32;              // unidades de mundo por casilla
  IE.TICK = 1 / 20;          // simulación fija a 20 Hz
  IE.MAP_W = 200;
  IE.MAP_H = 140;

  // Direcciones: 0 = este, 1 = sur, 2 = oeste, 3 = norte
  IE.DX = [1, 0, -1, 0];
  IE.DY = [0, 1, 0, -1];
  IE.DIR_NAMES = ['este', 'sur', 'oeste', 'norte'];

  IE.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  IE.lerp = (a, b, t) => a + (b - a) * t;
  IE.idx = (x, y) => y * IE.MAP_W + x;
  IE.inMap = (x, y) => x >= 0 && y >= 0 && x < IE.MAP_W && y < IE.MAP_H;

  // Generador pseudoaleatorio determinista (mulberry32)
  IE.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Ruido de valor 2D suave (para terreno y viento)
  IE.makeNoise = function (seed) {
    const r = IE.rng(seed);
    const perm = new Uint8Array(512);
    const p = [];
    for (let i = 0; i < 256; i++) p.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const vals = new Float32Array(256);
    for (let i = 0; i < 256; i++) vals[i] = r();
    const fade = t => t * t * (3 - 2 * t);
    function n2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const h = (a, b) => vals[perm[(perm[a & 255] + b) & 255]];
      const v00 = h(xi, yi), v10 = h(xi + 1, yi), v01 = h(xi, yi + 1), v11 = h(xi + 1, yi + 1);
      const u = fade(xf), v = fade(yf);
      return IE.lerp(IE.lerp(v00, v10, u), IE.lerp(v01, v11, u), v);
    }
    return function (x, y, oct = 3) {
      let s = 0, amp = 1, f = 1, tot = 0;
      for (let o = 0; o < oct; o++) { s += n2(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; }
      return s / tot;
    };
  };

  IE.fmtNum = function (n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1e4) return Math.round(n / 1e3) + 'k';
    if (n >= 1000) return (n / 1e3).toFixed(1).replace('.0', '') + 'k';
    if (n >= 10 || n === Math.floor(n)) return String(Math.floor(n));
    return n.toFixed(1);
  };
  IE.fmtPower = function (kw) {
    if (Math.abs(kw) >= 1000) return (kw / 1000).toFixed(kw >= 10000 ? 1 : 2) + ' MW';
    return Math.round(kw) + ' kW';
  };
  IE.fmtEnergy = function (kj) {
    if (kj >= 1e6) return (kj / 1e6).toFixed(1) + ' GJ';
    if (kj >= 1000) return (kj / 1000).toFixed(1) + ' MJ';
    return Math.round(kj) + ' kJ';
  };
  IE.fmtTime = function (s) {
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? h + 'h ' : '') + (h || m ? m + 'm ' : '') + ss + 's';
  };

  // Bus de eventos mínimo entre simulación e interfaz
  const listeners = {};
  IE.on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
  IE.emit = (ev, data) => { (listeners[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); };
})();
