// Sprites: carga del atlas local, tintado, variantes por generación e iconos de objetos.
(function () {
  const IE = window.IE;
  const A = IE.Assets = { img: null, cache: new Map(), ready: false };
  const PX = 64; // resolución de las composiciones por casilla

  A.load = function (cb) {
    const img = new Image();
    img.onload = () => { A.img = img; A.ready = true; cb(); };
    img.onerror = () => { console.error('No se pudo cargar assets/atlas.png'); A.ready = true; cb(); };
    img.src = 'assets/atlas.png';
  };
  const F = name => IE.ATLAS_FRAMES[name];
  A.has = name => !!F(name);

  function canvas(w, h) {
    const c = typeof OffscreenCanvas !== 'undefined' && !/iP(hone|ad)/.test(navigator.userAgent) ? new OffscreenCanvas(w, h) : document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  A.canvas = canvas;

  // Dibuja un fotograma del atlas ajustado a la caja (manteniendo proporción)
  A.draw = function (ctx, name, x, y, w, h, fit) {
    const f = F(name);
    if (!f || !A.img) return;
    if (fit) {
      const s = Math.min(w / f[2], h / f[3]);
      const dw = f[2] * s, dh = f[3] * s;
      ctx.drawImage(A.img, f[0], f[1], f[2], f[3], x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    } else ctx.drawImage(A.img, f[0], f[1], f[2], f[3], x, y, w, h);
  };

  // Sprite tintado (cacheado)
  A.tinted = function (name, color, alpha, mode) {
    const key = 't|' + name + '|' + color + '|' + alpha + '|' + (mode || '');
    let c = A.cache.get(key);
    if (c) return c;
    const f = F(name);
    if (!f) return null;
    c = canvas(f[2], f[3]);
    const g = c.getContext('2d');
    g.drawImage(A.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    g.globalCompositeOperation = mode || 'source-atop';
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(0, 0, f[2], f[3]);
    A.cache.set(key, c);
    return c;
  };
  // Partícula blanca tintada (los sprites de partículas son blancos con alfa)
  A.fx = function (name, color) {
    const key = 'fx|' + name + '|' + color;
    let c = A.cache.get(key);
    if (c) return c;
    const f = F(name);
    if (!f) return null;
    c = canvas(f[2], f[3]);
    const g = c.getContext('2d');
    g.drawImage(A.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, f[2], f[3]);
    A.cache.set(key, c);
    return c;
  };

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  A.rr = rr;
  function hazard(g, x, y, w, h, c1, c2) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = c1; g.fillRect(x, y, w, h);
    g.fillStyle = c2;
    for (let i = -h; i < w + h; i += 10) { g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + 5, y + h); g.lineTo(x + i + 5 + h, y); g.lineTo(x + i + h, y); g.fill(); }
    g.restore();
  }

  // Aspecto de cada tipo de edificio: sprite base y tinte propio
  const LOOK = {
    core: { spr: 'st_01' },
    miner: { tint: null }, pumpjack: { proc: 'pumpjack' },
    furnace: {}, assembler: {}, lab: {},
    refinery: { extra: ['td_226', 'td_228'] }, chem: { tint: '#3fbf4f', a: 0.25 }, centrifuge: { tint: '#5fe04a', a: 0.3 },
    precision: { tint: '#7a5cff', a: 0.25 }, nanofab: { tint: '#c05cff', a: 0.35 },
    pole: {}, steam: {}, combustion: { tint: '#c0392b', a: 0.2 }, solar: { tile: true }, wind: { proc: 'wind' },
    hydro: { tint: '#3a8fe0', a: 0.25 }, battery: { tint: '#2e9be0', a: 0.3 }, reactor: { tint: '#5fe04a', a: 0.22 }, fusion: { tint: '#9b59ff', a: 0.35 },
    chest: {}, truckstop: { proc: 'truckstop' }, trainstop: { proc: 'trainstop' }, robohub: {},
    splitter: { proc: 'router' }, crossing: { proc: 'router' }, sorter: { proc: 'router' }, arm: { proc: 'armbase' },
    ruin: {}, city: {}, horizon: {},
  };
  A.LOOK = LOOK;

  // Composición del edificio para un nivel concreto (sin animaciones, cacheado)
  A.building = function (type, tier, w, h, variant) {
    const key = 'b|' + type + '|' + tier + '|' + w + 'x' + h + '|' + (variant || '');
    let c = A.cache.get(key);
    if (c) return c;
    c = canvas(w * PX, h * PX);
    const g = c.getContext('2d');
    const def = IE.BUILDINGS[type], td = def.tiers[tier - 1], st = IE.TIER_STYLE[tier];
    const look = LOOK[type] || {};
    const W = w * PX, H = h * PX;
    const special = def.special;
    // Plataforma con colores de generación
    if (!special && def.kind !== 'pole' && def.kind !== 'arm') {
      g.fillStyle = 'rgba(0,0,0,0.25)'; rr(g, 3, 6, W - 4, H - 4, 10); g.fill();
      const pad = { 1: ['#6d5a45', '#4e3f30'], 2: ['#5d6670', '#3f464e'], 3: ['#4f6a5d', '#33463d'], 4: ['#4f6f86', '#2f4658'] }[tier];
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, pad[0]); grd.addColorStop(1, pad[1]);
      g.fillStyle = grd; rr(g, 2, 2, W - 4, H - 6, 9); g.fill();
      g.strokeStyle = st.badge; g.lineWidth = 3; rr(g, 3, 3, W - 6, H - 8, 8); g.stroke();
      if (tier === 2) { hazard(g, 8, H - 12, W - 16, 5, '#f0c020', '#2a2a2a'); }
      if (tier >= 3) { g.fillStyle = st.light; for (let i = 0; i < w * 2; i++) { g.beginPath(); g.arc(12 + i * (W - 24) / Math.max(1, w * 2 - 1), H - 10, 2.5, 0, 7); g.fill(); } }
      if (tier === 4) { g.shadowColor = '#36c9ff'; g.shadowBlur = 10; g.strokeStyle = 'rgba(120,230,255,0.9)'; g.lineWidth = 2; rr(g, 6, 6, W - 12, H - 14, 7); g.stroke(); g.shadowBlur = 0; }
    }
    if (look.proc) A.proc[look.proc](g, W, H, tier, type);
    else if (look.tile && td.spr) {
      // Paneles solares: mosaico de sprites reales
      const n = w * 2;
      for (let yy = 0; yy < h * 2; yy++) for (let xx = 0; xx < n; xx++) {
        const s = A.tinted(td.spr, st.tint, tier === 1 ? 0 : st.tintA * 0.6);
        if (s) g.drawImage(s, 4 + xx * (W - 8) / n, 2 + yy * (H - 10) / (h * 2), (W - 8) / n, (H - 10) / (h * 2));
      }
      if (tier >= 3) { g.fillStyle = 'rgba(160,220,255,0.25)'; g.fillRect(4, 2, W - 8, H - 10); }
    } else {
      const spr = td.spr || look.spr || (def.tiers[0] && def.tiers[0].spr);
      if (spr) {
        let img = A.tinted(spr, look.tint || st.tint, look.tint ? look.a : (tier === 1 && type !== 'core' ? st.tintA : st.tintA * 0.7));
        if (special) img = A.tinted(spr, '#000', 0);
        const f = F(spr);
        const s = Math.min((W - 8) / f[2], (H - 8) / f[3]) * (def.kind === 'pole' && tier <= 2 ? 1.1 : 1);
        const dw = f[2] * s, dh = f[3] * s;
        g.drawImage(img, (W - dw) / 2, (H - dh) / 2 - 3, dw, dh);
      }
      if (look.extra) look.extra.forEach((e, i) => A.draw(g, e, i ? W - 30 : 4, H - 34, 26, 26));
    }
    // Detalles por generación
    if (!special && def.kind !== 'pole') {
      if (td.arms) A.proc.armsDeco(g, W, H);
      if (tier === 4) { g.fillStyle = 'rgba(54,201,255,0.18)'; rr(g, 6, 6, W - 12, H - 14, 7); g.fill(); }
      // Distintivo de generación
      if (def.tiers.length > 1) {
        g.fillStyle = st.badge; rr(g, W - 25, 4, 21, 14, 4); g.fill();
        g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(st.label, W - 14.5, 11.5);
      }
    }
    A.cache.set(key, c);
    return c;
  };

  // Ilustraciones procedimentales para piezas sin sprite equivalente
  A.proc = {
    armsDeco(g, W, H) {
      g.strokeStyle = '#2fbf71'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(10, H - 18); g.lineTo(16, H * 0.55); g.lineTo(26, H * 0.48); g.stroke();
      g.beginPath(); g.moveTo(W - 10, H - 18); g.lineTo(W - 16, H * 0.55); g.lineTo(W - 26, H * 0.48); g.stroke();
      g.fillStyle = '#6dffb0';
      g.beginPath(); g.arc(26, H * 0.48, 3, 0, 7); g.arc(W - 26, H * 0.48, 3, 0, 7); g.fill();
    },
    pumpjack(g, W, H, tier) {
      g.fillStyle = '#2b2b2b'; g.beginPath(); g.ellipse(W * 0.3, H * 0.62, 18, 12, 0, 0, 7); g.fill();
      A.draw(g, tier >= 2 ? 'obj_barrel_red' : 'obj_barrel_blue', W - 40, H - 44, 30, 30, true);
      g.fillStyle = tier >= 2 ? '#c98a12' : '#8a5a2b';
      g.fillRect(W * 0.55, H * 0.25, 10, H * 0.5);
      g.fillStyle = '#555'; g.fillRect(W * 0.5, H * 0.68, 26, 10);
    },
    wind(g, W, H, tier) {
      const c = ['#ccc', '#ddd', '#e8f6ee', '#e6f6ff'][tier - 1];
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(W / 2 + 6, H / 2 + 10, 14, 8, 0, 0, 7); g.fill();
      g.fillStyle = '#9aa3ab'; g.beginPath(); g.arc(W / 2, H / 2, 16, 0, 7); g.fill();
      g.fillStyle = c; g.beginPath(); g.arc(W / 2, H / 2, 11, 0, 7); g.fill();
      g.strokeStyle = IE.TIER_STYLE[tier].badge; g.lineWidth = 3; g.stroke();
    },
    truckstop(g, W, H, tier) {
      g.fillStyle = '#3d4248'; g.fillRect(8, 8, W - 16, H - 20);
      hazard(g, 8, H - 22, W - 16, 8, '#f0c020', '#2a2a2a');
      A.draw(g, tier >= 2 ? 'td_084' : 'td_061', 14, 14, 34, 34);
      A.draw(g, tier >= 2 ? 'td_084' : 'td_061', 50, 20, 30, 30);
      A.draw(g, 'td_107', 30, 52, 30, 30);
      A.draw(g, 'st_10', W - 44, 6, 36, 36, true);
    },
    trainstop(g, W, H, tier) {
      g.fillStyle = '#7a6e62'; g.fillRect(6, 6, W - 12, H - 16);
      g.fillStyle = '#bba98f'; for (let i = 0; i < 6; i++) g.fillRect(10 + i * (W - 20) / 6, 10, (W - 20) / 6 - 3, H - 24);
      hazard(g, 6, H - 18, W - 12, 6, '#f0f0f0', '#c0392b');
      A.draw(g, tier >= 2 ? 'st_12' : 'st_11', W * 0.18, H * 0.12, W * 0.64, H * 0.64, true);
    },
    router(g, W, H, tier, type) {
      g.fillStyle = '#2d3238'; rr(g, 4, 4, W - 8, H - 8, 8); g.fill();
      g.strokeStyle = IE.TIER_STYLE[tier].badge; g.lineWidth = 3; g.stroke();
      g.fillStyle = type === 'sorter' ? '#3a7fe0' : type === 'crossing' ? '#999' : '#e0a020';
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.18, 0, 7); g.fill();
      g.strokeStyle = '#ddd'; g.lineWidth = 3;
      g.beginPath();
      if (type === 'crossing') { g.moveTo(8, H / 2); g.lineTo(W - 8, H / 2); g.moveTo(W / 2, 8); g.lineTo(W / 2, H - 8); }
      else { g.moveTo(10, H / 2); g.lineTo(W - 12, H / 2); g.moveTo(W / 2, H / 2); g.lineTo(W / 2, 10); if (type === 'splitter') { g.moveTo(W / 2, H / 2); g.lineTo(W / 2, H - 10); } }
      g.stroke();
    },
    armbase(g, W, H, tier) {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(W / 2 + 3, H / 2 + 4, W * 0.3, 0, 7); g.fill();
      g.fillStyle = ['#8a6a4a', '#c98a12', '#2f8f5a', '#2f7fb6'][tier - 1];
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.28, 0, 7); g.fill();
      g.fillStyle = '#333'; g.beginPath(); g.arc(W / 2, H / 2, W * 0.12, 0, 7); g.fill();
    },
  };

  // ---------- Terreno ----------
  const TERR_SPR = [['td_024', 'td_157'], ['td_050', 'td_158'], ['td_186', 'td_160'], ['tile_41', 'tile_42'], ['td_159', 'td_257'], ['tile_13', 'tile_14'], ['tile_13', 'tile_14']];
  A.terrainTile = function (t, v) {
    const key = 'terr|' + t + '|' + v;
    let c = A.cache.get(key);
    if (c) return c;
    const name = TERR_SPR[t][v & 1];
    if (t === IE.TERR.WATER) c = A.tinted(name, '#1f6fb8', 0.55);
    else if (t === IE.TERR.ICE) c = A.tinted(name, '#e8f4ff', 0.35);
    else if (t === IE.TERR.GRASS) c = A.tinted(name, '#3c7a36', 0.35);
    else if (t === IE.TERR.DIRT) c = A.tinted(name, '#5a3d22', 0.2);
    else c = A.tinted(name, '#000', 0.04);
    A.cache.set(key, c);
    return c;
  };
  A.TERR_COLORS = ['#4f9c43', '#9a6a3a', '#d8c08a', '#c4623a', '#8a8f96', '#2a78c0', '#d6ecf8'];

  // Decoración de yacimientos
  const RES_LOOK = {
    piedra: ['td_135', 'td_136', 'td_137'], carbon: ['env_04', 'env_05', 'env_03'], mineral_hierro: ['env_06', 'env_07', 'env_08'],
    mineral_cobre: ['env_18', 'env_19', 'env_20'], cuarzo: ['env_11', 'env_12', 'env_16'], uranio: ['env_11', 'env_12', 'env_16'],
    xenita: ['env_12', 'env_11', 'env_16'], crudo: ['obj_oil'],
  };
  const RES_TINT = { carbon: ['#141418', 0.75], cuarzo: ['#f3eeff', 0.7], uranio: ['#58e83a', 0.6], xenita: null, piedra: null, mineral_hierro: ['#9fb5d0', 0.15], mineral_cobre: null, crudo: ['#000', 0.5] };
  A.resSprite = function (res, v) {
    const arr = RES_LOOK[res];
    const name = arr[v % arr.length];
    const t = RES_TINT[res];
    return t ? A.tinted(name, t[0], t[1]) : A.tinted(name, '#000', 0);
  };

  // ---------- Iconos de objetos ----------
  A.icon = function (id, size) {
    size = size || 32;
    const key = 'i|' + id + '|' + size;
    let c = A.cache.get(key);
    if (c) return c;
    c = canvas(size, size);
    const g = c.getContext('2d');
    g.scale(size / 32, size / 32);
    const it = IE.ITEMS[id] || { color: '#f0f', icon: 'ore' };
    drawIcon(g, it);
    A.cache.set(key, c);
    return c;
  };
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
    r = Math.round(IE.clamp(r * f, 0, 255)); gg = Math.round(IE.clamp(gg * f, 0, 255)); b = Math.round(IE.clamp(b * f, 0, 255));
    return '#' + ((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1);
  }
  A.shade = shade;
  function drawIcon(g, it) {
    const c = it.color, d = shade(c, 0.6), l = shade(c, 1.35);
    g.lineJoin = 'round';
    switch (it.icon) {
      case 'ore': case 'crystal': case 'barrel': {
        if (it.spr && A.has(it.spr)) {
          const img = it.tint ? A.tinted(it.spr, it.tint, 0.7) : A.tinted(it.spr, '#000', 0);
          const f = F(it.spr); const s = Math.min(30 / f[2], 30 / f[3]);
          g.drawImage(img, 16 - f[2] * s / 2, 16 - f[3] * s / 2, f[2] * s, f[3] * s);
        } else { g.fillStyle = c; g.beginPath(); g.arc(16, 16, 11, 0, 7); g.fill(); }
        if (it.icon === 'crystal') { g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(16, 4); g.lineTo(20, 14); g.lineTo(16, 12); g.fill(); }
        break;
      }
      case 'wood':
        g.fillStyle = '#7a4f28'; rr(g, 3, 9, 26, 7, 3); g.fill(); rr(g, 3, 17, 26, 7, 3); g.fill();
        g.fillStyle = '#d7a86e'; g.beginPath(); g.arc(27, 12.5, 3, 0, 7); g.arc(27, 20.5, 3, 0, 7); g.fill(); break;
      case 'ingot': {
        g.fillStyle = d; g.beginPath(); g.moveTo(4, 22); g.lineTo(28, 22); g.lineTo(24, 12); g.lineTo(8, 12); g.closePath(); g.fill();
        g.fillStyle = c; g.beginPath(); g.moveTo(8, 12); g.lineTo(24, 12); g.lineTo(21, 7); g.lineTo(11, 7); g.closePath(); g.fill();
        g.fillStyle = l; g.fillRect(11, 8, 10, 2); break;
      }
      case 'plate':
        g.fillStyle = d; rr(g, 5, 9, 22, 16, 2); g.fill(); g.fillStyle = c; rr(g, 4, 7, 22, 16, 2); g.fill();
        g.strokeStyle = l; g.lineWidth = 1.5; g.beginPath(); g.moveTo(7, 10); g.lineTo(23, 10); g.stroke(); break;
      case 'brick':
        g.fillStyle = c; rr(g, 3, 10, 26, 13, 2); g.fill(); g.strokeStyle = d; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(3, 16.5); g.lineTo(29, 16.5); g.moveTo(16, 10); g.lineTo(16, 16.5); g.moveTo(9, 16.5); g.lineTo(9, 23); g.moveTo(22, 16.5); g.lineTo(22, 23); g.stroke(); break;
      case 'beam':
        g.fillStyle = d; g.fillRect(4, 8, 24, 4); g.fillRect(4, 20, 24, 4); g.fillStyle = c; g.fillRect(13, 10, 6, 12); g.fillStyle = l; g.fillRect(4, 8, 24, 1.5); break;
      case 'wafer':
        g.fillStyle = c; g.beginPath(); g.arc(16, 16, 12, 0, 7); g.fill(); g.strokeStyle = l; g.lineWidth = 1;
        for (let i = 8; i <= 24; i += 4) { g.beginPath(); g.moveTo(i, 7); g.lineTo(i, 25); g.moveTo(7, i); g.lineTo(25, i); g.stroke(); } break;
      case 'gear': {
        g.fillStyle = c; g.beginPath();
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 9 : 13; g.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r); }
        g.closePath(); g.fill(); g.strokeStyle = d; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = d; g.beginPath(); g.arc(16, 16, 4, 0, 7); g.fill(); break;
      }
      case 'cable':
        g.strokeStyle = c; g.lineWidth = 3;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(16, 16, 11 - i * 3, 8 - i * 2, 0, 0, 7); g.stroke(); }
        g.fillStyle = '#333'; g.fillRect(24, 14, 6, 4); break;
      case 'motor':
        g.fillStyle = d; rr(g, 5, 9, 20, 15, 4); g.fill(); g.fillStyle = c; rr(g, 5, 8, 20, 13, 4); g.fill();
        g.fillStyle = it.accent || '#ccc'; g.fillRect(25, 13, 5, 4);
        g.strokeStyle = d; g.lineWidth = 1.5; for (let i = 9; i < 23; i += 4) { g.beginPath(); g.moveTo(i, 9); g.lineTo(i, 20); g.stroke(); } break;
      case 'circuit':
        g.fillStyle = '#1f6b2a'; rr(g, 4, 5, 24, 22, 3); g.fill(); g.strokeStyle = '#e8c36a'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(7, 10); g.lineTo(14, 10); g.lineTo(18, 16); g.lineTo(25, 16); g.moveTo(7, 22); g.lineTo(16, 22); g.lineTo(20, 18); g.stroke();
        g.fillStyle = '#222'; g.fillRect(12, 13, 6, 6); break;
      case 'chip':
        g.fillStyle = '#bbb'; for (let i = 0; i < 4; i++) { g.fillRect(9 + i * 4, 3, 2, 26); g.fillRect(3, 9 + i * 4, 26, 2); }
        g.fillStyle = c; rr(g, 7, 7, 18, 18, 2); g.fill(); g.fillStyle = l; g.fillRect(11, 11, 10, 10); break;
      case 'module':
        g.fillStyle = d; rr(g, 4, 4, 24, 24, 4); g.fill(); g.fillStyle = c; rr(g, 6, 6, 20, 20, 3); g.fill();
        g.fillStyle = it.accent || '#fff'; g.beginPath(); g.arc(16, 16, 5, 0, 7); g.fill(); break;
      case 'flask':
        g.fillStyle = 'rgba(220,240,255,0.6)'; g.beginPath(); g.moveTo(13, 4); g.lineTo(19, 4); g.lineTo(19, 12); g.lineTo(27, 27); g.lineTo(5, 27); g.lineTo(13, 12); g.closePath(); g.fill();
        g.fillStyle = c; g.beginPath(); g.moveTo(9, 19); g.lineTo(23, 19); g.lineTo(27, 27); g.lineTo(5, 27); g.closePath(); g.fill(); break;
      case 'sheet':
        g.fillStyle = '#c9c9c9'; rr(g, 6, 9, 22, 17, 3); g.fill(); g.fillStyle = c; rr(g, 4, 6, 22, 17, 3); g.fill(); break;
      case 'battery':
        g.fillStyle = '#333'; rr(g, 7, 6, 18, 23, 3); g.fill(); g.fillStyle = c; rr(g, 9, 14, 14, 13, 2); g.fill(); g.fillStyle = '#ddd'; g.fillRect(13, 3, 6, 3); break;
      case 'coil':
        g.strokeStyle = c; g.lineWidth = 3; for (let i = 6; i < 28; i += 5) { g.beginPath(); g.ellipse(i, 16, 2.5, 9, 0, 0, 7); g.stroke(); }
        g.fillStyle = '#444'; g.fillRect(2, 15, 28, 2); break;
      case 'cell':
        g.fillStyle = '#555'; rr(g, 8, 3, 16, 26, 4); g.fill(); g.fillStyle = c; rr(g, 11, 7, 10, 18, 3); g.fill();
        g.fillStyle = it.accent || '#fff'; g.globalAlpha = 0.5; g.fillRect(13, 9, 3, 14); g.globalAlpha = 1; break;
      case 'orb': {
        const grd = g.createRadialGradient(13, 12, 2, 16, 16, 13);
        grd.addColorStop(0, it.accent || '#fff'); grd.addColorStop(0.5, c); grd.addColorStop(1, d);
        g.fillStyle = grd; g.beginPath(); g.arc(16, 16, 12, 0, 7); g.fill(); break;
      }
      case 'pack':
        g.fillStyle = 'rgba(220,240,255,0.7)'; rr(g, 9, 3, 14, 6, 2); g.fill();
        g.fillStyle = 'rgba(230,240,255,0.5)'; g.beginPath(); g.moveTo(11, 8); g.lineTo(21, 8); g.lineTo(27, 28); g.lineTo(5, 28); g.closePath(); g.fill();
        g.fillStyle = c; g.beginPath(); g.moveTo(9, 15); g.lineTo(23, 15); g.lineTo(27, 28); g.lineTo(5, 28); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(9, 17, 3, 8); break;
      default:
        g.fillStyle = c; g.beginPath(); g.arc(16, 16, 11, 0, 7); g.fill();
    }
  }

  // Icono de un edificio para la barra de construcción
  A.buildIcon = function (type, tier) {
    const def = IE.BUILDINGS[type], td = def.tiers[tier - 1];
    const key = 'bi|' + type + '|' + tier;
    let c = A.cache.get(key);
    if (c) return c;
    c = canvas(64, 64);
    const g = c.getContext('2d');
    if (def.kind === 'belt') { IE.Render && IE.Render.drawBeltIcon(g, tier); }
    else if (def.kind === 'road') { g.fillStyle = '#4a4d52'; g.fillRect(4, 4, 56, 56); g.strokeStyle = '#f0d24a'; g.setLineDash([8, 6]); g.lineWidth = 3; g.beginPath(); g.moveTo(32, 4); g.lineTo(32, 60); g.stroke(); }
    else if (def.kind === 'rail') { IE.Render && IE.Render.drawRailIcon(g, def.signal); }
    else {
      const img = A.building(type, tier, td.w, td.h);
      const s = 60 / Math.max(td.w, td.h) / 64;
      g.drawImage(img, 2 + (60 - td.w * 64 * s) / 2, 2 + (60 - td.h * 64 * s) / 2, td.w * 64 * s, td.h * 64 * s);
      if (type === 'wind') { g.strokeStyle = '#eee'; g.lineWidth = 4; for (let i = 0; i < 3; i++) { const a = i * 2.09; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26); g.stroke(); } }
    }
    A.cache.set(key, c);
    return c;
  };
})();
