// Render en Canvas 2D: terreno por trozos cacheados, cintas animadas, edificios con
// animaciones, vehículos, trenes, robots, partículas, ciclo día/noche y capas de análisis.
(function () {
  const IE = window.IE;
  const A = IE.Assets;
  const T = IE.TILE, W = IE.MAP_W, H = IE.MAP_H, DX = IE.DX, DY = IE.DY;
  const CH = 16; // casillas por trozo de terreno
  const R = IE.Render = { cam: { x: 0, y: 0, z: 1 }, chunks: new Map(), particles: [], view: 'normal', frame: 0 };
  let ctx, cv, dpr = 1, vw = 0, vh = 0, S = null, now = 0, lastNow = 0;

  R.init = function (canvas) {
    cv = canvas; ctx = cv.getContext('2d', { alpha: false });
    R.resize();
    IE.on('terrain', p => R.invalidate(p.x, p.y));
    IE.on('region', () => { R.chunks.clear(); R.mini = null; });
  };
  R.resize = function () {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = cv.clientWidth; vh = cv.clientHeight;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  };
  R.setState = s => { S = s; R.chunks.clear(); R.mini = null; R.particles = []; };
  R.invalidate = function (x, y) {
    R.chunks.delete(Math.floor(x / CH) + ',' + Math.floor(y / CH));
    R.mini = null;
  };
  R.screenToWorld = (sx, sy) => ({ x: (sx - vw / 2) / R.cam.z + R.cam.x, y: (sy - vh / 2) / R.cam.z + R.cam.y });
  R.screenToTile = (sx, sy) => { const w = R.screenToWorld(sx, sy); return { x: Math.floor(w.x / T), y: Math.floor(w.y / T) }; };
  R.clampCam = function () {
    const c = R.cam;
    c.z = IE.clamp(c.z, 0.18, 3);
    c.x = IE.clamp(c.x, 0, W * T); c.y = IE.clamp(c.y, 0, H * T);
  };
  R.centerOn = (tx, ty) => { R.cam.x = tx * T; R.cam.y = ty * T; };

  // ---------- Terreno ----------
  function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return (h ^ (h >> 16)) >>> 0; }
  R.hash = hash;
  function buildChunk(cx, cy) {
    const c = A.canvas(CH * T, CH * T);
    const g = c.getContext('2d');
    const wd = S.world;
    for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
      const x = cx * CH + tx, y = cy * CH + ty;
      if (!IE.inMap(x, y)) continue;
      const i = y * W + x, t = wd.terr[i], h = hash(x, y);
      const img = A.terrainTile(t, h & 1);
      if (img) g.drawImage(img, tx * T, ty * T, T + 0.5, T + 0.5);
      else { g.fillStyle = A.TERR_COLORS[t]; g.fillRect(tx * T, ty * T, T, T); }
      // Orillas
      if (t !== IE.TERR.WATER) {
        g.fillStyle = 'rgba(230,215,160,0.75)';
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d], ny = y + DY[d];
          if (IE.inMap(nx, ny) && wd.terr[ny * W + nx] === IE.TERR.WATER) {
            if (d === 0) g.fillRect(tx * T + T - 4, ty * T, 4, T); else if (d === 2) g.fillRect(tx * T, ty * T, 4, T);
            else if (d === 1) g.fillRect(tx * T, ty * T + T - 4, T, 4); else g.fillRect(tx * T, ty * T, T, 4);
          }
        }
      } else if (S.flags.bridges === undefined) { /* agua */ }
      // Yacimientos
      const r = wd.res[i];
      if (r) {
        const name = IE.RES[r];
        const s = name === 'crudo' ? 1.1 : 0.55 + Math.min(0.4, wd.amt[i] / 6000);
        const img2 = A.resSprite(name, h >> 3);
        if (img2) {
          const off = ((h >> 5) % 7 - 3);
          g.drawImage(img2, tx * T + T * (1 - s) / 2 + off, ty * T + T * (1 - s) / 2 - off / 2, T * s, T * s);
          if (name !== 'crudo' && ((h >> 9) & 1)) g.drawImage(img2, tx * T + 2, ty * T + T * 0.55, T * 0.35, T * 0.35);
        }
      }
      // Vegetación y rocas
      const f = wd.feat[i];
      if (f === IE.FEAT.TREE) {
        const reg = wd.region[i];
        const name = reg >= 4 ? ((h & 1) ? 'env_13' : 'env_14') : reg === 3 ? ((h & 1) ? 'env_09' : 'env_10') : ((h & 2) ? 'obj_tree_large' : 'obj_tree_small');
        const sz = T * (1.0 + ((h >> 4) & 3) * 0.1);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(tx * T + T / 2 + 3, ty * T + T * 0.75, sz * 0.36, sz * 0.18, 0, 0, 7); g.fill();
        A.draw(g, name, tx * T + (T - sz) / 2, ty * T + (T - sz) / 2 - 4, sz, sz, true);
      } else if (f === IE.FEAT.ROCK) {
        const name = ['obj_rock1', 'obj_rock2', 'obj_rock3', 'env_05'][h % 4];
        A.draw(g, name, tx * T + 3, ty * T + 3, T - 6, T - 6, true);
      }
      // Región bloqueada
      if (!S.regions[wd.region[i]]) {
        g.fillStyle = 'rgba(8,10,20,0.62)'; g.fillRect(tx * T, ty * T, T, T);
        if ((x + y) % 4 === 0) { g.strokeStyle = 'rgba(255,255,255,0.05)'; g.beginPath(); g.moveTo(tx * T, ty * T + T); g.lineTo(tx * T + T, ty * T); g.stroke(); }
      }
    }
    return c;
  }
  function chunk(cx, cy) {
    const k = cx + ',' + cy;
    let c = R.chunks.get(k);
    if (!c) {
      c = buildChunk(cx, cy);
      R.chunks.set(k, c);
      if (R.chunks.size > 70) R.chunks.delete(R.chunks.keys().next().value);
    }
    return c;
  }
  // Mapa en miniatura (1 píxel por casilla x2)
  R.minimap = function () {
    if (R.mini) return R.mini;
    const c = A.canvas(W * 2, H * 2), g = c.getContext('2d');
    const wd = S.world;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let col = A.TERR_COLORS[wd.terr[i]];
      if (wd.feat[i] === 1) col = '#2f6b2a';
      if (wd.res[i]) col = IE.ITEMS[IE.RES[wd.res[i]]].color;
      g.fillStyle = col; g.fillRect(x * 2, y * 2, 2, 2);
      if (!S.regions[wd.region[i]]) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x * 2, y * 2, 2, 2); }
    }
    R.mini = c;
    return c;
  };

  // ---------- Iconos para la barra ----------
  R.drawBeltIcon = function (g, tier) {
    const col = IE.BUILDINGS.belt.tiers[tier - 1].color;
    g.fillStyle = '#222'; g.fillRect(4, 10, 56, 44);
    g.fillStyle = col; g.fillRect(4, 14, 56, 36);
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 4;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(12 + i * 16, 20); g.lineTo(22 + i * 16, 32); g.lineTo(12 + i * 16, 44); g.stroke(); }
  };
  R.drawRailIcon = function (g, signal) {
    g.fillStyle = '#6b4a2a'; for (let i = 0; i < 5; i++) g.fillRect(10, 6 + i * 12, 44, 5);
    g.fillStyle = '#c0c6cc'; g.fillRect(18, 2, 5, 60); g.fillRect(41, 2, 5, 60);
    if (signal) { g.fillStyle = '#222'; g.fillRect(48, 10, 12, 26); g.fillStyle = '#3f3'; g.beginPath(); g.arc(54, 17, 4, 0, 7); g.fill(); g.fillStyle = '#f33'; g.beginPath(); g.arc(54, 29, 4, 0, 7); g.fill(); }
  };

  // ---------- Partículas ----------
  function emit(x, y, o) {
    if (R.particles.length > 350) return;
    R.particles.push(Object.assign({ x, y, vx: 0, vy: -10, life: 0, max: 2, size: 12, grow: 10, a: 0.6, spr: 'fx_smoke_01', col: '#ddd', rot: Math.random() * 6, vr: 0.5 }, o));
  }
  R.emit = emit;
  function drawParticles(dt) {
    const P = R.particles;
    for (let k = P.length - 1; k >= 0; k--) {
      const p = P[k];
      p.life += dt;
      if (p.life >= p.max) { P.splice(k, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const f = p.life / p.max, s = p.size + p.grow * f;
      const img = A.fx(p.spr, p.col);
      if (!img) continue;
      ctx.globalAlpha = p.a * (1 - f) * Math.min(1, f * 6);
      if (p.add) ctx.globalCompositeOperation = 'lighter';
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Cintas ----------
  R.beltPos = function (e, p) {
    const r = e.rot, cx = e.x * T + T / 2, cy = e.y * T + T / 2;
    if (!e.curve) return [cx + (p - 0.5) * T * DX[r], cy + (p - 0.5) * T * DY[r]];
    const s = e.curve === -1 ? (r + 3) % 4 : (r + 1) % 4;
    const kx = cx + (DX[r] + DX[s]) * T / 2, ky = cy + (DY[r] + DY[s]) * T / 2;
    const th = p * Math.PI / 2, c = Math.cos(th), sn = Math.sin(th);
    return [kx + (-DX[r] * c - DX[s] * sn) * T / 2, ky + (-DY[r] * c - DY[s] * sn) * T / 2];
  };
  function drawBelt(e, t) {
    const tier = IE.tierOf(e);
    const x0 = e.x * T, y0 = e.y * T;
    ctx.save();
    ctx.translate(x0 + T / 2, y0 + T / 2);
    ctx.rotate(e.rot * Math.PI / 2);
    const phase = (t * tier.speed) % 1;
    if (!e.curve) {
      ctx.fillStyle = '#1e1f22'; ctx.fillRect(-T / 2, -T * 0.44, T, T * 0.88);
      ctx.fillStyle = tier.color; ctx.fillRect(-T / 2, -T * 0.34, T, T * 0.68);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-T / 2, T * 0.2, T, T * 0.14);
      if (R.cam.z > 0.4) {
        ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const px = -T / 2 + ((k / 3 + phase) % 1) * T;
          ctx.moveTo(px - 4, -T * 0.22); ctx.lineTo(px + 2, 0); ctx.lineTo(px - 4, T * 0.22);
        }
        ctx.stroke();
      }
      ctx.fillStyle = '#9aa0a6'; ctx.fillRect(-T / 2, -T * 0.44, T, 2.5); ctx.fillRect(-T / 2, T * 0.44 - 2.5, T, 2.5);
    } else {
      const sy = e.curve === -1 ? -1 : 1;
      const kx = T / 2, ky = sy * T / 2;
      ctx.beginPath();
      const a0 = sy < 0 ? Math.PI / 2 : Math.PI, a1 = sy < 0 ? Math.PI : Math.PI * 1.5;
      ctx.arc(kx, ky, T * 0.94, a0, a1); ctx.arc(kx, ky, T * 0.06, a1, a0, true); ctx.closePath();
      ctx.fillStyle = '#1e1f22'; ctx.fill();
      ctx.beginPath(); ctx.arc(kx, ky, T * 0.84, a0, a1); ctx.arc(kx, ky, T * 0.16, a1, a0, true); ctx.closePath();
      ctx.fillStyle = tier.color; ctx.fill();
      if (R.cam.z > 0.4) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = T * 0.36;
        ctx.setLineDash([2.5, T * 0.785 / 3 - 2.5]);
        ctx.lineDashOffset = (sy < 0 ? 1 : -1) * phase * T * 0.785;
        ctx.beginPath(); ctx.arc(kx, ky, T / 2, a0, a1); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
    if (e.jam && R.view !== 'normal') { ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 2; ctx.strokeRect(x0 + 2, y0 + 2, T - 4, T - 4); }
  }
  function drawBeltItems(e) {
    const sz = T * 0.46;
    for (const it of e.items) {
      const [x, y] = R.beltPos(e, it.p);
      ctx.drawImage(A.icon(it.i, 32), x - sz / 2, y - sz / 2, sz, sz);
    }
  }

  // ---------- Carreteras y vías ----------
  function conn(e, types) {
    const n = [false, false, false, false];
    for (let d = 0; d < 4; d++) {
      const o = IE.entAt(S, e.x + DX[d], e.y + DY[d]);
      if (o && (types.includes(o.type) || (IE.BUILDINGS[o.type].kind === 'depot' && o.stop === (e.y * W + e.x)))) n[d] = true;
    }
    return n;
  }
  function drawRoad(e) {
    const x0 = e.x * T, y0 = e.y * T;
    ctx.fillStyle = '#44474c'; ctx.fillRect(x0, y0, T, T);
    ctx.fillStyle = '#383a3e'; ctx.fillRect(x0 + 2, y0 + 2, T - 4, T - 4);
    if (R.cam.z < 0.4) return;
    const n = conn(e, ['road']);
    ctx.strokeStyle = '#e8c84a'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    ctx.beginPath();
    for (let d = 0; d < 4; d++) if (n[d]) { ctx.moveTo(x0 + T / 2, y0 + T / 2); ctx.lineTo(x0 + T / 2 + DX[d] * T / 2, y0 + T / 2 + DY[d] * T / 2); }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
    for (let d = 0; d < 4; d++) if (!n[d]) {
      const ox = DX[d] * (T / 2 - 3), oy = DY[d] * (T / 2 - 3);
      ctx.beginPath(); ctx.moveTo(x0 + T / 2 + ox - DY[d] * T / 2, y0 + T / 2 + oy - DX[d] * T / 2); ctx.lineTo(x0 + T / 2 + ox + DY[d] * T / 2, y0 + T / 2 + oy + DX[d] * T / 2); ctx.stroke();
    }
  }
  function drawRail(e) {
    const x0 = e.x * T, y0 = e.y * T, cx = x0 + T / 2, cy = y0 + T / 2;
    const n = conn(e, ['rail', 'signal']);
    const cnt = n.filter(Boolean).length;
    const curve = cnt === 2 && !(n[0] && n[2]) && !(n[1] && n[3]);
    ctx.lineCap = 'butt';
    if (curve) {
      const d1 = n.indexOf(true), d2 = n.lastIndexOf(true);
      const kx = cx + (DX[d1] + DX[d2]) * T / 2, ky = cy + (DY[d1] + DY[d2]) * T / 2;
      const ang = (dx, dy) => Math.atan2(dy, dx);
      const a1 = ang(cx + DX[d1] * T / 2 - kx, cy + DY[d1] * T / 2 - ky), a2 = ang(cx + DX[d2] * T / 2 - kx, cy + DY[d2] * T / 2 - ky);
      let s = a1, en = a2; if (((en - s + Math.PI * 2) % (Math.PI * 2)) > Math.PI) { s = a2; en = a1; }
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 4;
      for (let k = 0; k < 4; k++) {
        const a = s + (en - s + (en < s ? Math.PI * 2 : 0)) * (k + 0.5) / 4;
        ctx.beginPath(); ctx.moveTo(kx + Math.cos(a) * T * 0.2, ky + Math.sin(a) * T * 0.2); ctx.lineTo(kx + Math.cos(a) * T * 0.8, ky + Math.sin(a) * T * 0.8); ctx.stroke();
      }
      ctx.strokeStyle = '#c3c9cf'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(kx, ky, T * 0.32, s, en); ctx.stroke();
      ctx.beginPath(); ctx.arc(kx, ky, T * 0.68, s, en); ctx.stroke();
    } else {
      const dirs = cnt === 0 ? [e.rot, (e.rot + 2) % 4] : (cnt === 1 ? [n.indexOf(true), (n.indexOf(true) + 2) % 4] : [0, 1, 2, 3].filter(d => n[d]));
      for (const d of dirs) {
        const px = -DY[d], py = DX[d];
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 4;
        for (let k = 0; k < 2; k++) {
          const f = 0.12 + k * 0.25;
          const bx = cx + DX[d] * T * f, by = cy + DY[d] * T * f;
          ctx.beginPath(); ctx.moveTo(bx - px * T * 0.34, by - py * T * 0.34); ctx.lineTo(bx + px * T * 0.34, by + py * T * 0.34); ctx.stroke();
        }
        ctx.strokeStyle = '#c3c9cf'; ctx.lineWidth = 2.5;
        for (const o of [-0.2, 0.2]) {
          ctx.beginPath(); ctx.moveTo(cx + px * T * o - DX[d] * 1.5, cy + py * T * o - DY[d] * 1.5); ctx.lineTo(cx + px * T * o + DX[d] * T / 2, cy + py * T * o + DY[d] * T / 2); ctx.stroke();
        }
      }
    }
    if (e.type === 'signal') {
      let red = false;
      for (let d = 0; d < 4; d++) {
        const nx = e.x + DX[d], ny = e.y + DY[d];
        if (!IE.inMap(nx, ny) || !S.railBlock) continue;
        const b = S.railBlock[ny * W + nx];
        if (b && S.blockRes && S.blockRes[b]) red = true;
      }
      ctx.fillStyle = '#222'; ctx.fillRect(x0 + T - 10, y0 + 1, 9, 16);
      ctx.fillStyle = red ? '#ff3b3b' : '#38ff6a';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x0 + T - 5.5, y0 + (red ? 12 : 6), 3, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // ---------- Edificios ----------
  const BAD = { 'Sin energía': '#ff3b3b', 'Sin combustible': '#ff8a3b', 'Faltan materiales': '#ffd23b', 'Salida bloqueada': '#ffd23b', 'Faltan paquetes': '#ffd23b', 'Sin receta': '#aaa', 'Yacimiento agotado': '#aaa', 'Energía insuficiente': '#ff8a3b', 'Residuos sin retirar': '#ff3b3b', 'Sin celdas': '#ff8a3b' };
  R.BAD = BAD;
  function rotor(x, y, r, a, col, n) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) { ctx.rotate(Math.PI * 2 / n); ctx.fillRect(-r * 0.12, -r, r * 0.24, r); }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, 7); ctx.fill();
    ctx.restore();
  }
  function frontArrow(e) {
    const tiles = IE.frontTiles(e);
    ctx.fillStyle = 'rgba(255,220,90,0.85)';
    for (const [tx, ty] of tiles) {
      const cx = tx * T + T / 2 - DX[e.rot] * T * 0.62, cy = ty * T + T / 2 - DY[e.rot] * T * 0.62;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(e.rot * Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-2, -5); ctx.lineTo(-2, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  const RUIN_SPR = { dam: 'st_06', archive: 'st_07', depot: 'st_05', pumping: 'st_03', observatory: 'st_07' };

  function drawSpecial(e, t) {
    const x0 = e.x * T, y0 = e.y * T, w = e.w * T, h = e.h * T;
    if (e.type === 'core') {
      ctx.drawImage(A.building('core', 1, 3, 3), x0, y0, w, h);
      const pulse = 0.5 + 0.5 * Math.sin(t * 2);
      ctx.strokeStyle = 'rgba(80,220,255,' + (0.4 + pulse * 0.4) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x0 + w / 2, y0 + h / 2 - 4, 10 + pulse * 3, 0, 7); ctx.stroke();
      ctx.fillStyle = '#7ff'; ctx.beginPath(); ctx.arc(x0 + w / 2, y0 + h / 2 - 4, 4, 0, 7); ctx.fill();
      return;
    }
    if (e.type === 'ruin') {
      const spr = RUIN_SPR[e.ruin];
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x0 + 2, y0 + 4, w - 2, h - 2);
      const img = e.done ? A.tinted(spr, '#fff', 0) : A.tinted(spr, '#4a3a2a', 0.55);
      ctx.drawImage(img, x0 + 4, y0, w - 8, h - 8);
      if (!e.done) {
        A.draw(ctx, 'env_05', x0 - 2, y0 + h - 18, 22, 22, true); A.draw(ctx, 'env_20', x0 + w - 18, y0 + h - 20, 20, 20, true);
        ctx.strokeStyle = 'rgba(20,10,0,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0 + w * 0.3, y0 + h * 0.2); ctx.lineTo(x0 + w * 0.4, y0 + h * 0.45); ctx.lineTo(x0 + w * 0.33, y0 + h * 0.7); ctx.stroke();
        const need = IE.demandOf(e); let got = 0, tot = 0; for (const k in need) { tot += need[k]; got += Math.min(need[k], e.got[k] || 0); }
        progressRing(x0 + w / 2, y0 + h / 2, 14, got / tot, '#ffb347');
      } else {
        ctx.fillStyle = 'rgba(120,255,200,' + (0.4 + 0.3 * Math.sin(t * 3)) + ')';
        ctx.beginPath(); ctx.arc(x0 + w - 10, y0 + 10, 4, 0, 7); ctx.fill();
        if (e.ruin === 'dam') { rotor(x0 + w / 2, y0 + h - 14, 12, t * 3, '#8ab4d8', 6); }
      }
      return;
    }
    if (e.type === 'city') {
      const parts = [['st_04', 0, 0, 2, 2], ['st_05', 2, 0, 2, 2], ['st_07', 0, 2, 2, 2], ['st_11', 2.2, 2.2, 1.6, 1.6], ['st_06', 1, 1, 2, 2]];
      for (const [spr, px, py, pw, ph] of parts) {
        const img = e.done ? A.tinted(spr, '#fff', 0) : A.tinted(spr, '#3a3040', 0.55);
        ctx.drawImage(img, x0 + px * T, y0 + py * T, pw * T, ph * T);
      }
      if (e.done) {
        const dl = IE.daylight(S);
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 10; k++) {
          const hx = x0 + ((hash(k, e.id) % 100) / 100) * w, hy = y0 + ((hash(e.id, k) % 100) / 100) * h;
          ctx.globalAlpha = 0.3 + (1 - dl) * 0.6;
          ctx.drawImage(A.fx('fx_light_01', '#ffd27a'), hx - 10, hy - 10, 20, 20);
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      } else {
        const need = IE.CITY_DEMAND; let got = 0, tot = 0; for (const k in need) { tot += need[k]; got += Math.min(need[k], e.got[k] || 0); }
        progressRing(x0 + w / 2, y0 + h / 2, 18, got / tot, '#ffb347');
      }
      return;
    }
    if (e.type === 'horizon') {
      const cx = x0 + w / 2, cy = y0 + h / 2;
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2;
        A.draw(ctx, 'td_180', cx + Math.cos(a) * w * 0.38 - 14, cy + Math.sin(a) * h * 0.38 - 14, 28, 28);
      }
      ctx.fillStyle = 'rgba(30,40,60,0.85)'; ctx.beginPath(); ctx.arc(cx, cy, w * 0.33, 0, 7); ctx.fill();
      const need = IE.HORIZON_DEMAND; let got = 0, tot = 0; for (const k in need) { tot += need[k]; got += Math.min(need[k], e.got[k] || 0); }
      const frac = got / tot;
      const img = A.tinted('st_07', e.done ? '#bff4ff' : '#405060', e.done ? 0.2 : 0.5);
      const s = 0.5 + 0.5 * frac;
      ctx.drawImage(img, cx - w * 0.3 * s, cy - h * 0.32 * s, w * 0.6 * s, h * 0.6 * s);
      progressRing(cx, cy, w * 0.42, frac, '#5fe0ff');
      if (e.charging || S.flags.horizon_active) {
        const ch = S.flags.horizon_active ? 1 : e.charge;
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 8; k++) {
          const a = k / 8 * Math.PI * 2 + t * 0.6;
          ctx.strokeStyle = 'rgba(120,230,255,' + (0.3 + 0.5 * ch) + ')'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * w * 0.38, cy + Math.sin(a) * h * 0.38); ctx.lineTo(cx, cy); ctx.stroke();
        }
        const gl = A.fx('fx_light_02', '#9ff4ff');
        ctx.globalAlpha = 0.5 + 0.5 * ch;
        ctx.drawImage(gl, cx - w * ch, cy - h * ch, w * 2 * ch, h * 2 * ch);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        if (Math.random() < 0.3) emit(cx, cy, { spr: 'fx_star_06', col: '#bff', vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, add: true, size: 8, grow: 4, max: 1, a: 0.9 });
      }
    }
  }
  function progressRing(cx, cy, r, f, col) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke();
  }

  function drawBuilding(e, t, dt, detail) {
    const def = IE.BUILDINGS[e.type];
    if (def.special) { drawSpecial(e, t); return; }
    const kind = def.kind, tier = e.tier, td = IE.tierOf(e), st = IE.TIER_STYLE[tier];
    const x0 = e.x * T, y0 = e.y * T, w = e.w * T, h = e.h * T, cx = x0 + w / 2, cy = y0 + h / 2;
    const working = e.working || (kind === 'gen' && e.outKW > 1) || (kind === 'battery' && e.flow);
    let sx = 0, sy = 0;
    if (working && (kind === 'miner') && detail) { sx = Math.sin(t * 40) * 0.6; sy = Math.cos(t * 37) * 0.6; }
    if (R.view === 'logistics' && !['storage', 'depot', 'splitter', 'crossing', 'sorter', 'arm'].includes(kind)) ctx.globalAlpha = 0.35;
    ctx.drawImage(A.building(e.type, tier, e.w, e.h), x0 + sx, y0 + sy, w, h);
    if (!detail) { ctx.globalAlpha = 1; return; }
    const rnd = Math.random;
    switch (e.type) {
      case 'miner':
        rotor(cx, cy + h * 0.18, T * 0.32, working ? t * (4 + tier * 3) : 0, tier >= 3 ? '#6dffb0' : '#d8d8d8', 4);
        if (working && rnd() < dt * 3) emit(cx + (rnd() - 0.5) * w * 0.8, y0 + h - 6, { spr: 'fx_dirt_01', col: '#8a7458', vy: -6, size: 8, grow: 10, max: 1.2, a: 0.45 });
        if (tier === 4 && working) { ctx.strokeStyle = 'rgba(120,230,255,0.5)'; ctx.lineWidth = 2; const a = t * 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * h); ctx.stroke(); }
        break;
      case 'pumpjack': {
        const a = working ? Math.sin(t * 2.5) * 0.35 : 0;
        ctx.save(); ctx.translate(x0 + w * 0.62, y0 + h * 0.3); ctx.rotate(a);
        ctx.fillStyle = tier >= 2 ? '#e0a020' : '#a0522d'; ctx.fillRect(-w * 0.42, -4, w * 0.6, 8);
        ctx.fillStyle = '#333'; ctx.fillRect(-w * 0.48, -8, 10, 18);
        ctx.restore();
        break;
      }
      case 'furnace': {
        const fl = working ? 0.6 + Math.sin(t * 17) * 0.2 + rnd() * 0.2 : 0.1;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fl;
        ctx.drawImage(A.fx('fx_flame_01', '#ff9a2a'), cx - 12, y0 + h * 0.48, 24, 24);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        if (working && rnd() < dt * (tier === 1 ? 4 : 2)) emit(cx + 6, y0 + 6, { col: tier === 1 ? '#555' : '#ccc', vy: -14, vx: 4, size: 12, grow: 20, max: 2.5, a: 0.5 });
        break;
      }
      case 'assembler': case 'precision': {
        const p = working ? Math.abs(Math.sin(t * 6)) : 0;
        ctx.fillStyle = '#cfd5db'; ctx.fillRect(x0 + w * 0.2, y0 + h * 0.22 + p * 8, 6, 10);
        rotor(x0 + w * 0.75, y0 + h * 0.3, T * 0.2, working ? t * 5 : 0, '#a9b3bd', 8);
        if (working && tier >= 3 && rnd() < dt * 6) emit(cx + (rnd() - 0.5) * 20, cy, { spr: 'fx_spark_01', col: '#ffd27a', vx: (rnd() - 0.5) * 60, vy: (rnd() - 0.5) * 60, size: 6, grow: 0, max: 0.4, a: 1, add: true });
        if (e.type === 'precision' && working && Math.sin(t * 9) > 0.6) { ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + 8, y0 + 8); ctx.lineTo(cx, cy); ctx.stroke(); }
        break;
      }
      case 'lab': {
        const era = S.research.cur ? IE.ERAS[IE.TECH[S.research.cur].era].color : '#888';
        if (working) {
          ctx.save(); ctx.translate(cx, cy - 6); ctx.rotate(t * 2);
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
          ctx.drawImage(A.fx('fx_trace_01', era), -w * 0.4, -6, w * 0.8, 12);
          ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fillStyle = working ? era : '#555'; ctx.beginPath(); ctx.arc(cx, cy - 6, 4, 0, 7); ctx.fill();
        break;
      }
      case 'steam': case 'combustion':
        if (working) {
          const load = e.outKW / td.out;
          if (rnd() < dt * (2 + load * 6)) emit(cx - 8 + rnd() * 16, y0 + 8, { col: e.type === 'steam' ? '#f0f0f0' : '#444', vy: -18, vx: 3, size: 10, grow: 22, max: 2, a: 0.55 });
          const p = Math.sin(t * (6 + load * 10));
          ctx.fillStyle = '#b8bec4'; ctx.fillRect(x0 + w - 16, y0 + h * 0.5 + p * 5, 8, 10);
          if (e.type === 'combustion') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 + load * 0.5; ctx.drawImage(A.fx('fx_light_01', '#ff5a2a'), cx - 14, cy - 4, 28, 28); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
        }
        break;
      case 'solar': {
        const dl = IE.daylight(S);
        if (dl > 0.1) {
          const ph = ((t * 0.3 + e.id * 0.17) % 1.6) - 0.3;
          ctx.save(); ctx.beginPath(); ctx.rect(x0 + 4, y0 + 2, w - 8, h - 10); ctx.clip();
          ctx.fillStyle = 'rgba(255,255,255,' + 0.25 * dl + ')';
          ctx.beginPath(); ctx.moveTo(x0 + ph * w, y0); ctx.lineTo(x0 + ph * w + 10, y0); ctx.lineTo(x0 + ph * w - h + 10, y0 + h); ctx.lineTo(x0 + ph * w - h, y0 + h); ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 'wind': {
        const sp = IE.wind(S) * 4 + 0.3;
        const col = tier >= 3 ? '#f4fbff' : '#e4e4e4';
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * sp + e.id);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.ellipse(0, -w * 0.25 - 4, 4 + tier, w * 0.27 + tier * 2, 0, 0, 7); ctx.fill(); }
        ctx.fillStyle = col;
        for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.ellipse(0, -w * 0.25, 3 + tier, w * 0.26 + tier * 2, 0, 0, 7); ctx.fill(); }
        ctx.fillStyle = st.badge; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
        ctx.restore();
        break;
      }
      case 'hydro':
        rotor(x0 + w * 0.5, y0 + h - 10, T * 0.36, t * 2.5, '#8ab4d8', 8);
        if (rnd() < dt * 3) emit(x0 + w * 0.5, y0 + h - 6, { spr: 'fx_circle_01', col: '#bfe3ff', vy: 4, size: 6, grow: 14, max: 1, a: 0.5 });
        break;
      case 'battery': {
        const f = e.stored / td.capKJ;
        ctx.fillStyle = '#111'; ctx.fillRect(x0 + 8, y0 + h - 18, w - 16, 7);
        ctx.fillStyle = f > 0.3 ? '#3fe07a' : '#e0b03f'; ctx.fillRect(x0 + 9, y0 + h - 17, (w - 18) * f, 5);
        if (e.flow) { ctx.fillStyle = e.flow > 0 ? '#3fe07a' : '#ffb347'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(e.flow > 0 ? '▲' : '▼', x0 + 6, y0 + 16); }
        break;
      }
      case 'reactor': {
        if (e.status === 'En fisión') {
          const p = 0.5 + 0.5 * Math.sin(t * 3);
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 + p * 0.4;
          ctx.drawImage(A.fx('fx_light_02', '#6bff4a'), cx - w * 0.5, cy - h * 0.5, w, h);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          if (rnd() < dt * 5) emit(x0 + w * 0.8, y0 + 8, { col: '#fff', vy: -20, size: 14, grow: 30, max: 3, a: 0.5 });
        }
        break;
      }
      case 'fusion':
        if (working) {
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 2);
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8;
          ctx.drawImage(A.fx('fx_twirl_01', '#c05cff'), -w * 0.45, -h * 0.45, w * 0.9, h * 0.9);
          ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
        break;
      case 'refinery':
        if (working) {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7 + rnd() * 0.3;
          ctx.drawImage(A.fx('fx_flame_04', '#ff8a2a'), x0 + w - 26, y0 - 14 + rnd() * 2, 20, 26);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          if (rnd() < dt * 3) emit(x0 + w - 16, y0 - 10, { col: '#333', vy: -16, size: 10, grow: 24, max: 2.5, a: 0.4 });
        }
        break;
      case 'chem': case 'centrifuge': case 'nanofab':
        if (working) {
          if (e.type === 'chem' && rnd() < dt * 8) emit(x0 + w * (0.25 + rnd() * 0.5), y0 + h * 0.5, { spr: 'fx_circle_05', col: '#9be04a', vy: -10, size: 4, grow: 3, max: 1.2, a: 0.8 });
          if (e.type === 'centrifuge') { ctx.strokeStyle = '#7dff5a'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 60; ctx.beginPath(); ctx.arc(cx, cy, w * 0.32, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
          if (e.type === 'nanofab') { ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 5; k++) { const a = t * 1.5 + k * 1.26; ctx.globalAlpha = 0.7; ctx.drawImage(A.fx('fx_star_06', '#e3a6ff'), cx + Math.cos(a) * w * 0.32 - 7, cy + Math.sin(a) * h * 0.32 - 7, 14, 14); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
        }
        break;
      case 'robohub':
        ctx.fillStyle = (Math.sin(t * 4) > 0 && e.pf > 0.05) ? '#6dffb0' : '#244'; ctx.beginPath(); ctx.arc(cx + 8, y0 + 10, 3.5, 0, 7); ctx.fill();
        break;
      case 'arm': drawArm(e, t); break;
      case 'pole': break;
    }
    // Dirección de salida
    if (['miner', 'machine'].includes(kind) || (['storage', 'depot'].includes(kind) && e.filter) || e.type === 'reactor') frontArrow(e);
    if (['splitter', 'sorter'].includes(kind)) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(e.rot * Math.PI / 2);
      ctx.fillStyle = '#ffd25a'; ctx.beginPath(); ctx.moveTo(T * 0.45, 0); ctx.lineTo(T * 0.25, -6); ctx.lineTo(T * 0.25, 6); ctx.fill();
      ctx.restore();
      for (const it of e.buf) ctx.drawImage(A.icon(it.i, 32), cx - 7, cy - 7, 14, 14);
    }
    if (kind === 'crossing') for (const it of e.buf) ctx.drawImage(A.icon(it.i, 32), cx - 7 + DX[it.d] * 4, cy - 7 + DY[it.d] * 4, 14, 14);
    // Receta (icono)
    if (kind === 'machine' && e.recipe && R.cam.z > 0.5) {
      const out = Object.keys(IE.RECIPE[e.recipe].out)[0];
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(x0 + 11, y0 + 11, 9, 0, 7); ctx.fill();
      ctx.drawImage(A.icon(out, 32), x0 + 3, y0 + 3, 16, 16);
    }
    // Avisos de estado
    const bad = BAD[e.status];
    if (bad && (R.view === 'problems' || e.status === 'Sin energía' || e.status === 'Sin combustible' || e.status === 'Residuos sin retirar')) {
      const blink = 0.6 + 0.4 * Math.sin(t * 6);
      ctx.globalAlpha = blink;
      ctx.fillStyle = bad; ctx.beginPath(); ctx.arc(cx, cy - 4, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(e.status === 'Sin energía' || e.status === 'Energía insuficiente' ? '⚡' : e.status === 'Sin combustible' ? '🔥' : '!', cx, cy - 4);
      ctx.globalAlpha = 1;
      if (e.missing && R.view === 'problems') ctx.drawImage(A.icon(e.missing, 32), cx + 6, cy - 16, 14, 14);
    }
    if (R.view === 'production' && (kind === 'machine' || kind === 'miner') && R.cam.z > 0.45) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x0, y0 + h - 12, w, 12);
      ctx.fillStyle = working ? '#7f7' : '#f77'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(working ? (e.status || '') : (e.status || ''), cx, y0 + h - 6);
    }
    ctx.globalAlpha = 1;
  }
  function drawArm(e, t) {
    const td = IE.tierOf(e);
    const cx = e.x * T + T / 2, cy = e.y * T + T / 2;
    const prog = Math.min(1, e.t / (td.period * 0.5));
    // El brazo gira de atrás (origen) al frente (destino)
    const base = e.rot * Math.PI / 2;
    const ang = e.hold ? base + Math.PI * (1 - prog) : base + Math.PI * prog;
    const len = T * 0.62;
    const hx = cx + Math.cos(ang) * len, hy = cy + Math.sin(ang) * len;
    ctx.strokeStyle = ['#c0a070', '#f0c040', '#5fe0a0', '#70d0ff'][e.tier - 1]; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(hx, hy, 3.5, 0, 7); ctx.fill();
    if (e.hold) ctx.drawImage(A.icon(e.hold, 32), hx - 7, hy - 7, 14, 14);
  }

  // ---------- Vehículos ----------
  function drawTruck(v) {
    const Tk = IE.TRUCKS[v.tier];
    const x = v.x * T + T / 2, y = v.y * T + T / 2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(v.ang + Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-T * 0.27 + 3, -T * 0.55 + 3, T * 0.54, T * 1.1);
    ctx.fillStyle = A.shade(Tk.bed, 0.7); A.rr(ctx, -T * 0.27, -T * 0.05, T * 0.54, T * 0.62, 3); ctx.fill();
    ctx.fillStyle = Tk.bed; A.rr(ctx, -T * 0.24, -T * 0.02, T * 0.48, T * 0.56, 3); ctx.fill();
    const n = IE.sumInv(v.cargo);
    if (n > 0) {
      const k = Object.keys(v.cargo)[0];
      const rows = Math.min(4, Math.ceil(n / Tk.cap * 4));
      for (let i = 0; i < rows; i++) ctx.drawImage(A.icon(k, 32), -T * 0.18 + (i % 2) * T * 0.18, i < 2 ? T * 0.04 : T * 0.27, T * 0.18, T * 0.18);
    }
    A.draw(ctx, Tk.spr, -T * 0.26, -T * 0.6, T * 0.52, T * 0.62, true);
    ctx.restore();
    if (v.state === 'Sin combustible') { ctx.fillStyle = '#ff8a3b'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('🔥', x - 6, y - 14); }
  }
  function carPose(t, k) {
    const a = t.tiles[k];
    const b = k === 0 ? (t.path && t.path[t.pi] != null ? t.path[t.pi] : null) : t.tiles[k - 1];
    const ax = (a % W) * T + T / 2, ay = ((a / W) | 0) * T + T / 2;
    if (b == null) {
      const c = t.tiles[k + 1] != null ? t.tiles[k + 1] : null;
      const ang = c != null ? Math.atan2(ay - (((c / W) | 0) * T + T / 2), ax - ((c % W) * T + T / 2)) : 0;
      return [ax, ay, ang];
    }
    const bx = (b % W) * T + T / 2, by = ((b / W) | 0) * T + T / 2;
    return [IE.lerp(ax, bx, t.prog), IE.lerp(ay, by, t.prog), Math.atan2(by - ay, bx - ax)];
  }
  function drawTrain(tr, time, dt) {
    const L = IE.LOCOS[tr.loco];
    const cap = IE.trainCap(tr), n = IE.sumInv(tr.cargo);
    const mainItem = Object.keys(tr.cargo).sort((a, b) => tr.cargo[b] - tr.cargo[a])[0];
    for (let k = tr.tiles.length - 1; k >= 0; k--) {
      const [x, y, ang] = carPose(tr, k);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      const len = T * 0.92, wid = T * 0.62;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; A.rr(ctx, -len / 2 + 3, -wid / 2 + 3, len, wid, 5); ctx.fill();
      if (k === 0) {
        ctx.fillStyle = L.color; A.rr(ctx, -len / 2, -wid / 2, len, wid, tr.loco === 4 ? 12 : 5); ctx.fill();
        ctx.fillStyle = A.shade(L.color, 0.75); A.rr(ctx, -len / 2 + 3, -wid / 2 + 3, len * 0.55, wid - 6, 3); ctx.fill();
        ctx.fillStyle = L.accent; ctx.fillRect(-len / 2, -2, len, 4);
        ctx.fillStyle = '#9fd8ff'; A.rr(ctx, len * 0.18, -wid / 2 + 4, len * 0.22, wid - 8, 3); ctx.fill();
        if (tr.loco === 1) { ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-len * 0.1, 0, 5, 0, 7); ctx.fill(); }
        if (tr.loco === 3) { ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-len * 0.2, -wid * 0.3); ctx.lineTo(-len * 0.05, wid * 0.3); ctx.moveTo(-len * 0.05, -wid * 0.3); ctx.lineTo(-len * 0.2, wid * 0.3); ctx.stroke(); }
        if (tr.loco === 4) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(A.fx('fx_light_01', '#36c9ff'), -len * 0.7, -wid, len * 1.4, wid * 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
        // Faros
        ctx.fillStyle = '#fff6b0'; ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 4); ctx.fillRect(len / 2 - 3, wid / 2 - 7, 3, 4);
      } else {
        ctx.fillStyle = tr.wagons[k - 1] === 2 ? '#5a6470' : '#6f6a62'; A.rr(ctx, -len / 2, -wid / 2, len, wid, 3); ctx.fill();
        ctx.fillStyle = '#3e3a35'; ctx.fillRect(-len / 2 + 3, -wid / 2 + 3, len - 6, wid - 6);
        const fill = cap ? n / cap : 0;
        if (mainItem && fill > 0.02) {
          const isOre = ['ore', 'crystal'].includes(IE.ITEMS[mainItem].icon);
          const cnt = Math.ceil(fill * 4);
          for (let i = 0; i < cnt; i++) {
            const px = -len / 2 + 5 + (i % 2) * (len / 2 - 5), py = -wid / 2 + 4 + Math.floor(i / 2) * (wid / 2 - 4);
            if (isOre) ctx.drawImage(A.icon(mainItem, 32), px, py, len / 2 - 6, wid / 2 - 5);
            else A.draw(ctx, i % 2 ? 'td_061' : 'td_084', px, py, len / 2 - 6, wid / 2 - 5);
          }
        }
      }
      ctx.restore();
    }
    if (tr.v > 0.5 && (tr.loco === 1 || tr.loco === 2)) {
      const [x, y] = carPose(tr, 0);
      if (Math.random() < dt * (tr.loco === 1 ? 8 : 4)) emit(x, y, { col: tr.loco === 1 ? '#eee' : '#444', vy: -12, size: 10, grow: 20, max: 2, a: 0.5 });
    }
  }
  function drawRobots(hub, t) {
    for (const r of hub.robots) {
      if (r.st === 'idle') continue;
      const x = r.x * T + T / 2, y = r.y * T + T / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 6, y + 10, 7, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = hub.tier === 2 ? '#e8f2ff' : '#d8d0b0';
      ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4;
        const rx = x + Math.cos(a) * 8, ry = y + Math.sin(a) * 8;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(rx, ry); ctx.stroke();
        ctx.fillStyle = 'rgba(200,200,200,0.5)'; ctx.beginPath(); ctx.ellipse(rx, ry, 4, 1.5, t * 30 + k, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#6dffb0'; ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill();
      if (r.carry) ctx.drawImage(A.icon(r.item, 32), x - 6, y + 4, 12, 12);
    }
  }

  // ---------- Fantasma de colocación y selección ----------
  function drawGhost(UI) {
    const g = UI.ghost;
    if (!g) return;
    for (const p of g.tiles) {
      const def = IE.BUILDINGS[g.type];
      const d = IE.dims(g.type, g.tier, p.rot);
      ctx.globalAlpha = 0.55;
      if (def.kind === 'belt') { drawBelt({ x: p.x, y: p.y, rot: p.rot, tier: g.tier, type: 'belt', curve: 0, items: [] }, 0); }
      else if (def.kind === 'rail' || def.kind === 'road') { ctx.fillStyle = '#888'; ctx.fillRect(p.x * T + 4, p.y * T + 4, T - 8, T - 8); }
      else ctx.drawImage(A.building(g.type, g.tier, d.w, d.h), p.x * T, p.y * T, d.w * T, d.h * T);
      ctx.globalAlpha = 1;
      ctx.fillStyle = p.ok ? 'rgba(60,255,120,0.22)' : 'rgba(255,60,60,0.35)';
      ctx.fillRect(p.x * T, p.y * T, d.w * T, d.h * T);
      ctx.strokeStyle = p.ok ? '#3f6' : '#f44'; ctx.lineWidth = 2; ctx.strokeRect(p.x * T + 1, p.y * T + 1, d.w * T - 2, d.h * T - 2);
      if (def.kind !== 'belt' && def.kind !== 'rail' && def.kind !== 'road' && def.kind !== 'pole') frontArrow({ x: p.x, y: p.y, w: d.w, h: d.h, rot: p.rot });
      const td = def.tiers[g.tier - 1];
      if (td.supply) { const r = td.supply; ctx.strokeStyle = 'rgba(90,200,255,0.8)'; ctx.setLineDash([6, 4]); ctx.strokeRect((p.x + d.w / 2 - r - 0.5) * T, (p.y + d.h / 2 - r - 0.5) * T, (2 * r + 1) * T, (2 * r + 1) * T); ctx.setLineDash([]); }
    }
    if (g.reason) { const p = g.tiles[g.tiles.length - 1]; if (p) { ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#000'; ctx.fillText(g.reason, p.x * T + 1, p.y * T - 5); ctx.fillStyle = '#ffb0b0'; ctx.fillText(g.reason, p.x * T, p.y * T - 6); } }
  }
  function drawSelection(UI, t) {
    const e = UI.selected && S.ents.get(UI.selected);
    if (!e) return;
    const x0 = e.x * T, y0 = e.y * T;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 + 0.4 * Math.sin(t * 5)) + ')'; ctx.lineWidth = 2.5;
    ctx.strokeRect(x0 - 2, y0 - 2, e.w * T + 4, e.h * T + 4);
    const td = IE.tierOf(e);
    if (td.supply) { const r = td.supply; ctx.strokeStyle = 'rgba(90,200,255,0.8)'; ctx.setLineDash([6, 4]); ctx.strokeRect((e.x + e.w / 2 - r - 0.5) * T, (e.y + e.h / 2 - r - 0.5) * T, (2 * r + 1) * T, (2 * r + 1) * T); ctx.setLineDash([]); }
    if (e.type === 'miner' || e.type === 'pumpjack') { const r = td.reach || 0; ctx.strokeStyle = 'rgba(255,220,90,0.8)'; ctx.strokeRect((e.x - r) * T, (e.y - r) * T, (e.w + 2 * r) * T, (e.h + 2 * r) * T); }
    if (e.type === 'robohub') { const r = td.radius; ctx.strokeStyle = 'rgba(110,255,180,0.7)'; ctx.setLineDash([6, 4]); ctx.strokeRect((e.x + 1 - r) * T, (e.y + 1 - r) * T, 2 * r * T, 2 * r * T); ctx.setLineDash([]); }
    if (IE.BUILDINGS[e.type].kind === 'depot' && e.stop >= 0) { ctx.strokeStyle = '#ffd25a'; ctx.strokeRect((e.stop % W) * T + 3, ((e.stop / W) | 0) * T + 3, T - 6, T - 6); }
  }

  // ---------- Fotograma ----------
  R.frame = function (state, UI, nowMs) {
    S = state;
    now = nowMs / 1000;
    const dt = Math.min(0.1, lastNow ? now - lastNow : 0.016);
    lastNow = now;
    R.fc = (R.fc || 0) + 1;
    const t = S.time;
    const c = R.cam;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, vw, vh);
    ctx.setTransform(dpr * c.z, 0, 0, dpr * c.z, dpr * (vw / 2 - c.x * c.z), dpr * (vh / 2 - c.y * c.z));
    ctx.imageSmoothingEnabled = true;
    const tl = R.screenToWorld(0, 0), br = R.screenToWorld(vw, vh);
    const x0 = Math.max(0, Math.floor(tl.x / T) - 1), y0 = Math.max(0, Math.floor(tl.y / T) - 1);
    const x1 = Math.min(W - 1, Math.ceil(br.x / T) + 1), y1 = Math.min(H - 1, Math.ceil(br.y / T) + 1);
    // Terreno
    if (c.z < 0.42) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(R.minimap(), 0, 0, W * T, H * T);
      ctx.imageSmoothingEnabled = true;
    } else {
      for (let cy = Math.floor(y0 / CH); cy <= Math.floor(y1 / CH); cy++) for (let cx = Math.floor(x0 / CH); cx <= Math.floor(x1 / CH); cx++)
        ctx.drawImage(chunk(cx, cy), cx * CH * T, cy * CH * T, CH * T + 0.5, CH * T + 0.5);
    }
    const detail = c.z >= 0.42;
    // Capa de cobertura eléctrica
    if (R.view === 'power' && S.cover) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const n = S.cover[y * W + x];
        if (n) { ctx.fillStyle = 'hsla(' + (n * 67 % 360) + ',80%,55%,0.18)'; ctx.fillRect(x * T, y * T, T, T); }
      }
    }
    // Recoger entidades visibles
    const seen = new Set(), ground = [], belts = [], blds = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const id = S.grid[y * W + x];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const e = S.ents.get(id);
      if (!e) continue;
      const k = IE.BUILDINGS[e.type].kind;
      if (k === 'road' || k === 'rail') ground.push(e);
      else if (k === 'belt') belts.push(e);
      else blds.push(e);
    }
    for (const e of ground) e.type === 'road' ? drawRoad(e) : drawRail(e);
    for (const e of belts) drawBelt(e, t);
    if (detail) for (const e of belts) drawBeltItems(e);
    blds.sort((a, b) => (a.y + a.h) - (b.y + b.h));
    for (const e of blds) drawBuilding(e, t, dt, detail);
    // Cables entre postes
    if (S.wires && detail) {
      ctx.strokeStyle = R.view === 'power' ? 'rgba(255,200,90,0.95)' : 'rgba(140,90,40,0.7)'; ctx.lineWidth = R.view === 'power' ? 2 : 1.2;
      ctx.beginPath();
      for (const [ax, ay, bx, by] of S.wires) {
        if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1 + 1 || Math.max(ay, by) < y0 || Math.min(ay, by) > y1 + 1) continue;
        ctx.moveTo(ax * T, ay * T); ctx.quadraticCurveTo((ax + bx) / 2 * T, (ay + by) / 2 * T + 8, bx * T, by * T);
      }
      ctx.stroke();
    }
    // Electricidad sin red
    if (R.view === 'power') for (const e of blds) if (IE.isElectric(e) && !e.net && !IE.BUILDINGS[e.type].special) { ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 3; ctx.strokeRect(e.x * T, e.y * T, e.w * T, e.h * T); }
    // Vehículos y trenes
    const inView = (x, y) => x >= x0 - 2 && x <= x1 + 2 && y >= y0 - 2 && y <= y1 + 2;
    for (const v of S.trucks) if (inView(v.x, v.y)) drawTruck(v);
    for (const tr of S.trains) { const h = tr.tiles[0]; if (inView(h % W, (h / W) | 0) || inView(tr.tiles[tr.tiles.length - 1] % W, (tr.tiles[tr.tiles.length - 1] / W) | 0)) drawTrain(tr, t, dt); }
    for (const e of S.ents.values()) if (e.type === 'robohub') drawRobots(e, t);
    drawParticles(dt);
    // Noche
    const dl = IE.daylight(S);
    const dark = (1 - dl) * 0.55 + Math.min(0.15, IE.smog(S) * 0.4);
    if (dark > 0.02) {
      ctx.fillStyle = 'rgba(8,14,40,' + dark + ')';
      ctx.fillRect(x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);
      if (detail && dl < 0.6) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.6 - dl) * 1.1;
        for (const e of blds) {
          const lit = e.type === 'core' || e.working || (e.outKW > 1) || (e.type === 'city' && e.done) || (e.type === 'ruin' && e.done);
          if (!lit) continue;
          const st = IE.TIER_STYLE[e.tier] || IE.TIER_STYLE[1];
          const sz = Math.max(e.w, e.h) * T * 1.6;
          ctx.drawImage(A.fx('fx_light_01', st.light), e.x * T + e.w * T / 2 - sz / 2, e.y * T + e.h * T / 2 - sz / 2, sz, sz);
        }
        for (const v of S.trucks) if (inView(v.x, v.y)) ctx.drawImage(A.fx('fx_light_01', '#fff4c0'), v.x * T + T / 2 + Math.cos(v.ang) * T * 0.8 - 16, v.y * T + T / 2 + Math.sin(v.ang) * T * 0.8 - 16, 32, 32);
        for (const tr of S.trains) { const [x, y, a] = carPose(tr, 0); ctx.drawImage(A.fx('fx_light_01', '#fff4c0'), x + Math.cos(a) * T - 20, y + Math.sin(a) * T - 20, 40, 40); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    }
    drawSelection(UI, now);
    drawGhost(UI);
    // Marcador de toque manual
    if (UI.tap && now - UI.tap.t < 0.6) {
      const f = (now - UI.tap.t) / 0.6;
      ctx.strokeStyle = 'rgba(255,255,255,' + (1 - f) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(UI.tap.x * T + T / 2, UI.tap.y * T + T / 2, 6 + f * 14, 0, 7); ctx.stroke();
      if (UI.tap.item) { ctx.globalAlpha = 1 - f; ctx.drawImage(A.icon(UI.tap.item, 32), UI.tap.x * T + 6, UI.tap.y * T - f * 24, 20, 20); ctx.globalAlpha = 1; }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };
})();
