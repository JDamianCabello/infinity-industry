// Generación del mundo: terreno por regiones, yacimientos, vegetación y ruinas.
(function () {
  const IE = window.IE;
  const W = IE.MAP_W, H = IE.MAP_H;

  // Terrenos
  IE.TERR = { GRASS: 0, DIRT: 1, SAND: 2, RED: 3, ROCK: 4, WATER: 5, ICE: 6 };
  IE.TERR_NAMES = ['Pradera', 'Tierra', 'Arena', 'Arena roja', 'Roca', 'Agua', 'Cristal helado'];
  // Recursos del suelo
  IE.RES = [null, 'piedra', 'carbon', 'mineral_hierro', 'mineral_cobre', 'cuarzo', 'uranio', 'xenita', 'crudo'];
  IE.RES_ID = {}; IE.RES.forEach((r, i) => { if (r) IE.RES_ID[r] = i; });
  IE.FEAT = { NONE: 0, TREE: 1, ROCK: 2 };

  IE.CORE_POS = { x: 22, y: 68 };

  IE.generateWorld = function (seed) {
    const N = W * H;
    const w = {
      seed, terr: new Uint8Array(N), region: new Uint8Array(N), res: new Uint8Array(N),
      amt: new Uint16Array(N), feat: new Uint8Array(N), ruinSites: {},
    };
    const rnd = IE.rng(seed);
    const n1 = IE.makeNoise(seed + 11), n2 = IE.makeNoise(seed + 23), n3 = IE.makeNoise(seed + 37);

    // Fronteras onduladas entre regiones
    const riverX = y => 58 + (n1(y * 0.04, 3) - 0.5) * 10;
    const b3 = y => 100 + (n2(y * 0.05, 7) - 0.5) * 12;
    const b4 = y => 140 + (n2(y * 0.05, 19) - 0.5) * 12;
    const b5 = y => 172 + (n2(y * 0.06, 29) - 0.5) * 8;
    const split12 = x => 68 + (n3(x * 0.06, 5) - 0.5) * 14;
    w.riverX = riverX;

    for (let y = 0; y < H; y++) {
      const rx = riverX(y);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let reg;
        if (x < rx - 2) reg = 0;
        else if (x < b3(y)) reg = y < split12(x) ? 1 : 2;
        else if (x < b4(y)) reg = 3;
        else if (x < b5(y)) reg = 4;
        else reg = 5;
        w.region[i] = reg;
        const e = n1(x * 0.08, y * 0.08, 4), m = n2(x * 0.1, y * 0.1, 3);
        let t = IE.TERR.GRASS;
        if (reg === 0) t = e > 0.62 ? IE.TERR.DIRT : IE.TERR.GRASS;
        else if (reg === 1) t = e > 0.66 ? IE.TERR.DIRT : IE.TERR.GRASS;
        else if (reg === 2) t = m > 0.6 ? IE.TERR.SAND : (e > 0.65 ? IE.TERR.DIRT : IE.TERR.GRASS);
        else if (reg === 3) t = e > 0.7 ? IE.TERR.SAND : IE.TERR.RED;
        else if (reg === 4) t = e > 0.6 ? IE.TERR.ROCK : (m > 0.55 ? IE.TERR.DIRT : IE.TERR.SAND);
        else t = e > 0.68 ? IE.TERR.ROCK : IE.TERR.ICE;
        // Río principal
        if (Math.abs(x - rx) < 1.6 + n3(y * 0.1, 1) * 1.2) t = IE.TERR.WATER;
        w.terr[i] = t;
      }
    }
    // Brazos del delta (región 2): ríos horizontales que desembocan en el principal
    for (let k = 0; k < 2; k++) {
      let yy = 88 + k * 26 + rnd() * 6;
      for (let x = Math.floor(riverX(yy)); x < 99; x++) {
        yy += (n3(x * 0.07, k * 9) - 0.5) * 1.6;
        const yc = Math.round(yy);
        for (let dy = -1; dy <= 1; dy++) {
          const y = yc + dy;
          if (y > 0 && y < H && w.region[y * W + x] === 2) w.terr[y * W + x] = IE.TERR.WATER;
        }
      }
    }
    // Lagos pequeños
    const lake = (cx, cy, r) => {
      for (let y = cy - r - 2; y <= cy + r + 2; y++) for (let x = cx - r - 2; x <= cx + r + 2; x++) {
        if (!IE.inMap(x, y)) continue;
        const d = Math.hypot(x - cx, y - cy) + (n3(x * 0.3, y * 0.3) - 0.5) * 2;
        if (d < r) w.terr[y * W + x] = IE.TERR.WATER;
      }
    };
    lake(10, 30, 4); lake(36, 115, 3); lake(120, 20, 4); lake(186, 110, 3);

    // Yacimientos
    const patch = (res, cx, cy, r, rich) => {
      const id = IE.RES_ID[res];
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        if (!IE.inMap(x, y)) continue;
        const i = y * W + x;
        const t = w.terr[i];
        if (t === IE.TERR.WATER || t === IE.TERR.ROCK) continue;
        const d = Math.hypot(x - cx, y - cy) / r + (n2(x * 0.35, y * 0.35, 2) - 0.5) * 0.5;
        if (d < 1) {
          w.res[i] = id;
          w.amt[i] = Math.min(65000, Math.round(rich * (0.45 + (1 - d) * 0.9)));
        }
      }
    };
    const C = IE.CORE_POS;
    // Garantizados junto al Núcleo
    patch('mineral_hierro', C.x + 10, C.y - 6, 3.6, 1500);
    patch('mineral_cobre', C.x - 7, C.y + 8, 3.2, 1500);
    patch('carbon', C.x + 9, C.y + 8, 3.2, 1400);
    patch('piedra', C.x - 8, C.y - 8, 2.8, 1200);
    const scatter = (reg, res, count, rmin, rmax, rich) => {
      let placed = 0, tries = 0;
      while (placed < count && tries++ < 400) {
        const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
        if (w.region[y * W + x] !== reg) continue;
        if (Math.hypot(x - C.x, y - C.y) < 14) continue;
        if (w.terr[y * W + x] === IE.TERR.WATER) continue;
        patch(res, x, y, rmin + rnd() * (rmax - rmin), rich);
        placed++;
      }
    };
    scatter(0, 'mineral_hierro', 3, 2.5, 4, 1800); scatter(0, 'mineral_cobre', 3, 2.5, 4, 1800);
    scatter(0, 'carbon', 3, 2.5, 3.5, 1600); scatter(0, 'piedra', 2, 2, 3, 1500);
    scatter(1, 'mineral_hierro', 5, 4, 6, 4000); scatter(1, 'carbon', 4, 3.5, 5, 3500); scatter(1, 'piedra', 2, 3, 4, 3000);
    scatter(2, 'mineral_cobre', 4, 4, 6, 4000); scatter(2, 'carbon', 2, 3, 4, 3000); scatter(2, 'piedra', 2, 3, 4, 3000); scatter(2, 'cuarzo', 1, 2.5, 3, 2500);
    scatter(3, 'crudo', 8, 1, 1.8, 40000); scatter(3, 'mineral_cobre', 3, 4, 6, 6000); scatter(3, 'mineral_hierro', 2, 4, 6, 6000); scatter(3, 'cuarzo', 2, 3, 4, 4000);
    scatter(4, 'cuarzo', 4, 3, 5, 6000); scatter(4, 'uranio', 3, 2.5, 4, 5000); scatter(4, 'mineral_hierro', 2, 4, 6, 8000); scatter(4, 'carbon', 2, 4, 5, 8000);
    scatter(5, 'xenita', 5, 2.5, 4, 8000); scatter(5, 'uranio', 1, 3, 4, 6000); scatter(5, 'mineral_cobre', 1, 4, 5, 9000);

    // Vegetación y rocas
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (w.res[i] || w.terr[i] === IE.TERR.WATER) continue;
      if (Math.hypot(x - C.x - 1, y - C.y - 1) < 6) continue;
      const reg = w.region[i], f = n3(x * 0.12, y * 0.12, 3), r = rnd();
      const forest = reg === 1 ? 0.45 : reg === 0 ? 0.62 : reg === 2 ? 0.58 : 2;
      if (f > forest && r < (reg === 1 ? 0.55 : 0.35) && w.terr[i] !== IE.TERR.ROCK) w.feat[i] = IE.FEAT.TREE;
      else if ((reg >= 3 && r < 0.025) || (w.terr[i] === IE.TERR.ROCK && r < 0.08)) w.feat[i] = IE.FEAT.ROCK;
      else if (r < 0.006) w.feat[i] = IE.FEAT.ROCK;
    }

    // Sitios de ruinas
    const clearArea = (x0, y0, sw, sh) => {
      for (let y = y0 - 1; y <= y0 + sh; y++) for (let x = x0 - 1; x <= x0 + sw; x++) {
        if (!IE.inMap(x, y)) continue;
        const i = y * W + x;
        w.feat[i] = 0;
        if (y >= y0 && y < y0 + sh && x >= x0 && x < x0 + sw) {
          w.res[i] = 0; w.amt[i] = 0;
          if (w.terr[i] === IE.TERR.WATER || w.terr[i] === IE.TERR.ROCK) w.terr[i] = w.region[i] >= 3 ? IE.TERR.SAND : IE.TERR.DIRT;
        }
      }
    };
    const findSite = (reg, cx, cy, sw, sh, nearWater) => {
      for (let rad = 0; rad < 40; rad++) {
        for (let a = 0; a < 16; a++) {
          const x = Math.round(cx + Math.cos(a / 16 * Math.PI * 2) * rad), y = Math.round(cy + Math.sin(a / 16 * Math.PI * 2) * rad);
          if (x < 1 || y < 1 || x + sw >= W - 1 || y + sh >= H - 1) continue;
          let ok = true, water = 0;
          for (let yy = y; yy < y + sh && ok; yy++) for (let xx = x; xx < x + sw; xx++) {
            const i = yy * W + xx;
            if (w.region[i] !== reg || w.terr[i] === IE.TERR.WATER || w.terr[i] === IE.TERR.ROCK) { ok = false; break; }
          }
          if (!ok) continue;
          if (nearWater) {
            for (let yy = y - 1; yy <= y + sh; yy++) for (let xx = x - 1; xx <= x + sw; xx++)
              if (IE.inMap(xx, yy) && w.terr[yy * W + xx] === IE.TERR.WATER) water++;
            if (water < 3) continue;
          }
          return { x, y };
        }
      }
      return { x: cx, y: cy };
    };
    const site = (key, reg, cx, cy, sw, sh, nearWater) => {
      const p = findSite(reg, cx, cy, sw, sh, nearWater);
      clearArea(p.x, p.y, sw, sh);
      w.ruinSites[key] = { x: p.x, y: p.y, w: sw, h: sh };
    };
    site('dam', 2, Math.round(riverX(95)) + 3, 95, 3, 3, true);
    site('archive', 1, 78, 32, 3, 3);
    site('depot', 1, 88, 56, 3, 3);
    site('city', 3, 120, 72, 4, 4);
    site('pumping', 3, 112, 112, 3, 3);
    site('observatory', 4, 156, 40, 3, 3);
    site('horizon', 5, 186, 68, 5, 5);
    clearArea(C.x, C.y, 3, 3);
    return w;
  };

  // Cuántas casillas de agua tocan un rectángulo
  IE.waterAround = function (S, x0, y0, sw, sh) {
    let c = 0;
    for (let y = y0 - 1; y <= y0 + sh; y++) for (let x = x0 - 1; x <= x0 + sw; x++) {
      if (x >= x0 && x < x0 + sw && y >= y0 && y < y0 + sh) continue;
      if (IE.inMap(x, y) && S.world.terr[y * W + x] === IE.TERR.WATER) c++;
    }
    return c;
  };
})();
