// Transferencia de objetos, cintas, divisores, máquinas, extractores, almacenes y brazos.
(function () {
  const IE = window.IE;
  const W = IE.MAP_W, DX = IE.DX, DY = IE.DY;

  const sum = o => { let s = 0; for (const k in o) s += o[k]; return s; };
  IE.sumInv = sum;

  // Multiplicadores globales
  IE.speedMul = S => S.flags.autonomous ? 1.25 : 1;
  IE.powerMul = S => S.flags.autonomous ? 0.85 : 1;

  // ---------- Cintas ----------
  IE.updateBeltCurve = function (S, e) {
    const r = e.rot;
    const feeds = dir => { // ¿hay una cinta que entra en e desde el lado `dir`?
      const n = IE.entAt(S, e.x + DX[dir], e.y + DY[dir]);
      return n && n.type === 'belt' && n.rot === (dir + 2) % 4;
    };
    const back = feeds((r + 2) % 4);
    const left = feeds((r + 3) % 4), right = feeds((r + 1) % 4);
    e.curve = (!back && left !== right) ? (left ? -1 : 1) : 0;
  };

  // Intenta entregar `item` que viaja en dirección `d` a la entidad `t`.
  // dry = true solo comprueba.
  IE.accept = function (S, t, item, d, dry) {
    if (!t) return false;
    const def = IE.BUILDINGS[t.type];
    switch (def.kind) {
      case 'belt': {
        if (t.rot === (d + 2) % 4) return false;
        const cap = IE.tierOf(t).cap, gap = 1 / cap, it = t.items;
        const fromBack = t.rot === d || (t.curve === -1 && d === (t.rot + 1) % 4) || (t.curve === 1 && d === (t.rot + 3) % 4);
        if (fromBack) {
          if (it.length && it[0].p < gap) return false;
          if (it.length >= cap) return false;
          if (!dry) it.unshift({ i: item, p: 0 });
          return true;
        }
        // Entrada lateral en el centro de la cinta
        if (it.length >= cap) return false;
        let k = 0;
        while (k < it.length && it[k].p < 0.5) k++;
        if ((k > 0 && 0.5 - it[k - 1].p < gap) || (k < it.length && it[k].p - 0.5 < gap)) return false;
        if (!dry) it.splice(k, 0, { i: item, p: 0.5 });
        return true;
      }
      case 'splitter': case 'sorter':
        if (t.buf.length >= 2) return false;
        if (t.rot !== d) return false; // solo por detrás
        if (!dry) t.buf.push({ i: item, d });
        return true;
      case 'crossing':
        if (t.buf.filter(b => b.d === d).length >= 1) return false;
        if (!dry) t.buf.push({ i: item, d });
        return true;
      default:
        return IE.acceptItem(S, t, item, dry);
    }
  };

  // Aceptación para edificios (sin dirección)
  IE.acceptItem = function (S, t, item, dry) {
    const def = IE.BUILDINGS[t.type], tier = IE.tierOf(t);
    const k = def.kind;
    // Combustible para máquinas V1
    if (tier.fuel && IE.ITEMS[item].fuel && (k === 'machine' || k === 'miner')) {
      const r = t.recipe && IE.RECIPE[t.recipe];
      if (!(r && r.in[item])) {
        if (sum(t.fuelInv) >= 6) return false;
        if (!dry) t.fuelInv[item] = (t.fuelInv[item] || 0) + 1;
        return true;
      }
    }
    switch (k) {
      case 'core':
        if (!dry) { IE.invAdd(S, item, 1); S.stats.coreIn[item] = (S.stats.coreIn[item] || 0) + 1; }
        return true;
      case 'machine': {
        let r = t.recipe && IE.RECIPE[t.recipe];
        if (!r && def.autoRecipe) {
          r = IE.autoFurnaceRecipe(S, t, item);
          if (!r) return false;
          if (!dry) { t.recipe = r.id; t.autoSet = true; }
        } else if (r && def.autoRecipe && t.autoSet && !r.in[item] && !t.working && sum(t.inv) === 0 && sum(t.out) === 0) {
          const r2 = IE.autoFurnaceRecipe(S, t, item);
          if (!r2) return false;
          if (!dry) t.recipe = r2.id;
          r = r2;
        }
        if (!r || !r.in[item]) return false;
        if ((t.inv[item] || 0) >= Math.max(r.in[item] * 3, 4)) return false;
        if (!dry) t.inv[item] = (t.inv[item] || 0) + 1;
        return true;
      }
      case 'lab': {
        const tech = S.research.cur && IE.TECH[S.research.cur];
        if (!tech || !tech.packs.includes(item)) return false;
        if ((t.inv[item] || 0) >= 4) return false;
        if (!dry) t.inv[item] = (t.inv[item] || 0) + 1;
        return true;
      }
      case 'storage': case 'depot':
        if (sum(t.inv) >= tier.cap) return false;
        if (!dry) t.inv[item] = (t.inv[item] || 0) + 1;
        return true;
      case 'gen': {
        if (def.gen === 'fuel') {
          if (!IE.ITEMS[item].fuel || sum(t.inv) >= 10) return false;
        } else if (def.gen === 'nuclear') {
          if (item !== 'celda_nuclear' || (t.inv.celda_nuclear || 0) >= 4) return false;
        } else if (def.gen === 'fusion') {
          if (item !== tier.fuelItem || (t.inv[item] || 0) >= 20) return false;
        } else return false;
        if (!dry) t.inv[item] = (t.inv[item] || 0) + 1;
        return true;
      }
      case 'ruin': case 'city': case 'horizon': {
        const need = IE.demandOf(t);
        if (!need || !need[item] || (t.got[item] || 0) >= need[item] || t.done) return false;
        if (!dry) { t.got[item] = (t.got[item] || 0) + 1; IE.checkRestore(S, t); }
        return true;
      }
    }
    return false;
  };

  IE.demandOf = function (t) {
    if (t.type === 'ruin') return IE.RUINS[t.ruin].cost;
    if (t.type === 'city') return IE.CITY_DEMAND;
    if (t.type === 'horizon') return IE.HORIZON_DEMAND;
    return null;
  };

  IE.autoFurnaceRecipe = function (S, t, item) {
    const tier = t.tier;
    return IE.RECIPES.find(r => r.m === 'furnace' && Object.keys(r.in).length === 1 && r.in[item] && r.tier <= tier && IE.recipeUnlocked(S, r)) || null;
  };

  // Casillas frontales por las que expulsa un edificio
  IE.frontTiles = function (e) {
    const out = [], d = e.rot;
    if (d === 0) for (let y = e.y; y < e.y + e.h; y++) out.push([e.x + e.w, y]);
    else if (d === 1) for (let x = e.x + e.w - 1; x >= e.x; x--) out.push([x, e.y + e.h]);
    else if (d === 2) for (let y = e.y + e.h - 1; y >= e.y; y--) out.push([e.x - 1, y]);
    else for (let x = e.x; x < e.x + e.w; x++) out.push([x, e.y - 1]);
    return out;
  };
  // Expulsa un objeto por el frente (rotando entre casillas)
  IE.pushOut = function (S, e, item) {
    const tiles = e._front || (e._front = IE.frontTiles(e));
    for (let k = 0; k < tiles.length; k++) {
      const j = ((e.outRR || 0) + k) % tiles.length;
      const t = IE.entAt(S, tiles[j][0], tiles[j][1]);
      if (t && t !== e && IE.accept(S, t, item, e.rot)) { e.outRR = j + 1; return true; }
    }
    return false;
  };

  function pushOutputs(S, e, n) {
    for (let c = 0; c < n; c++) {
      let moved = false;
      for (const k in e.out) {
        if (e.out[k] > 0 && IE.pushOut(S, e, k)) {
          if (--e.out[k] <= 0) delete e.out[k];
          moved = true; break;
        }
      }
      if (!moved) return;
    }
  }

  // Consumo de combustible de máquinas V1. Devuelve true si hay energía.
  function burn(S, e, kw, dt) {
    const need = kw * dt;
    while (e.fuelKJ < need) {
      const f = Object.keys(e.fuelInv).find(k => e.fuelInv[k] > 0);
      if (!f) return false;
      if (--e.fuelInv[f] <= 0) delete e.fuelInv[f];
      e.fuelKJ += IE.ITEMS[f].fuel;
    }
    e.fuelKJ -= need;
    return true;
  }
  IE.burn = burn;

  // ---------- Actualización por tick ----------
  IE.updateBelt = function (S, e, dt) {
    const it = e.items;
    if (!it.length) { e.jam = false; return; }
    const tier = IE.tierOf(e), dp = tier.speed * dt, gap = 1 / tier.cap;
    let n = it.length;
    const head = it[n - 1];
    head.p = Math.min(1, head.p + dp);
    e.jam = false;
    if (head.p >= 1) {
      const t = IE.entAt(S, e.x + DX[e.rot], e.y + DY[e.rot]);
      if (t && IE.accept(S, t, head.i, e.rot)) { it.pop(); n--; }
      else e.jam = true;
    }
    for (let k = n - 2; k >= 0; k--) {
      const lim = it[k + 1].p - gap;
      const np = Math.min(it[k].p + dp, lim);
      if (np > it[k].p) it[k].p = np;
    }
  };

  IE.updateRouter = function (S, e, dt) {
    const def = IE.BUILDINGS[e.type], tier = IE.tierOf(e);
    if (!e.buf.length) return;
    let pf = 1;
    if (tier.power) { e.dem = tier.power * IE.powerMul(S); pf = e.pf; }
    e.acc = (e.acc || 0) + tier.rate * dt * pf;
    let moves = 0;
    while (e.acc >= 1 && e.buf.length && moves < 4) {
      let moved = false;
      for (let b = 0; b < e.buf.length && !moved; b++) {
        const it = e.buf[b];
        let dirs;
        if (def.kind === 'crossing') dirs = [it.d];
        else if (def.kind === 'sorter') dirs = (e.filters || []).includes(it.i) ? [(it.d + 3) % 4] : [it.d];
        else dirs = [it.d, (it.d + 3) % 4, (it.d + 1) % 4];
        for (let k = 0; k < dirs.length; k++) {
          const d = dirs[(e.rr + k) % dirs.length];
          const t = IE.entAt(S, e.x + DX[d], e.y + DY[d]);
          if (t && IE.accept(S, t, it.i, d)) { e.buf.splice(b, 1); e.rr = (e.rr + k + 1) % 3; moved = true; break; }
        }
      }
      if (!moved) break;
      e.acc -= 1; moves++;
    }
    if (e.acc > 2) e.acc = 2;
    e.jam = e.buf.length >= 2;
  };

  IE.updateMiner = function (S, e, dt) {
    const tier = IE.tierOf(e), def = IE.BUILDINGS[e.type];
    if (!e.tiles) {
      const r = tier.reach || 0;
      e.tiles = [];
      for (let y = e.y - r; y < e.y + e.h + r; y++) for (let x = e.x - r; x < e.x + e.w + r; x++)
        if (IE.inMap(x, y)) e.tiles.push(y * W + x);
    }
    const wd = S.world;
    pushOutputs(S, e, tier.dualOut ? 2 : 1);
    const full = sum(e.out) >= tier.buf;
    // ¿Queda algo que extraer?
    let any = false, blockedTier = false;
    for (const i of e.tiles) {
      const r = wd.res[i];
      if (!r) continue;
      const item = IE.RES[r];
      if (def.onlyRes ? item !== def.onlyRes : item === 'crudo') continue;
      if (!def.onlyRes && (item === 'uranio' || item === 'xenita') && e.tier < 2) { blockedTier = true; continue; }
      any = true; break;
    }
    e.working = false;
    if (!any) { e.status = blockedTier ? 'Necesita extractor V2 o superior' : 'Yacimiento agotado'; e.dem = 0; return; }
    if (full) { e.status = 'Salida bloqueada'; e.dem = tier.power ? tier.power * 0.05 : 0; return; }
    let f = IE.speedMul(S) * (S.choices.policy === 'intensiva' ? 1.2 : 1);
    if (tier.fuel) {
      if (!burn(S, e, tier.power, dt)) {
        // Autoalimentación si extrae carbón
        const ci = e.tiles.find(i => wd.res[i] === IE.RES_ID.carbon);
        if (e.out.carbon > 0) { e.out.carbon--; if (!e.out.carbon) delete e.out.carbon; e.fuelKJ += IE.ITEMS.carbon.fuel; }
        else if (ci !== undefined) { e.fuelKJ += IE.ITEMS.carbon.fuel; if (--wd.amt[ci] <= 0) wd.res[ci] = 0; }
        else { e.status = 'Sin combustible'; return; }
      }
      S._poll += (tier.poll || 0) * dt;
    } else {
      e.dem = tier.power * IE.powerMul(S);
      f *= e.pf;
      if (e.pf < 0.05) { e.status = 'Sin energía'; return; }
    }
    e.working = true;
    e.status = e.pf < 0.99 && !tier.fuel ? 'Energía insuficiente' : 'Extrayendo';
    e.prog += dt * tier.rate * f;
    while (e.prog >= 1) {
      e.prog -= 1;
      // Recorre los yacimientos de forma rotatoria
      for (let k = 0; k < e.tiles.length; k++) {
        const j = (e.resRR + k) % e.tiles.length, i = e.tiles[j];
        const r = wd.res[i];
        if (!r) continue;
        const item = IE.RES[r];
        if (def.onlyRes ? item !== def.onlyRes : item === 'crudo') continue;
        if ((item === 'uranio' || item === 'xenita') && e.tier < 2 && !def.onlyRes) continue;
        e.resRR = j + 1;
        e.out[item] = (e.out[item] || 0) + 1;
        IE.countProduced(S, item, 1);
        if (--wd.amt[i] <= 0) { wd.res[i] = 0; IE.emit('terrain', { x: i % W, y: Math.floor(i / W) }); }
        break;
      }
    }
  };

  IE.machineRecipes = function (S, e) {
    const def = IE.BUILDINGS[e.type];
    return IE.RECIPES.filter(r => r.m === def.mclass && IE.recipeUnlocked(S, r) &&
      !(r.id === 'x_nucleo_a' && S.choices.path === 'prometeo') && !(r.id === 'x_nucleo_p' && S.choices.path === 'armonia'));
  };

  IE.updateMachine = function (S, e, dt) {
    const tier = IE.tierOf(e);
    const r = e.recipe && IE.RECIPE[e.recipe];
    pushOutputs(S, e, 1);
    e.dem = 0;
    if (!r) { e.status = 'Sin receta'; e.working = false; return; }
    if (r.tier > e.tier) { e.status = 'Receta requiere V' + r.tier; e.working = false; return; }
    if (!e.working) {
      for (const k in r.out) if ((e.out[k] || 0) + r.out[k] > Math.max(20, r.out[k] * 2)) { e.status = 'Salida bloqueada'; e.dem = tier.power && !tier.fuel ? tier.power * 0.05 : 0; return; }
      for (const k in r.in) if ((e.inv[k] || 0) < r.in[k]) { e.status = 'Faltan materiales'; e.missing = k; e.dem = tier.power && !tier.fuel ? tier.power * 0.05 : 0; return; }
      for (const k in r.in) { e.inv[k] -= r.in[k]; if (e.inv[k] <= 0) delete e.inv[k]; }
      e.working = true; e.prog = 0;
    }
    let f = IE.speedMul(S);
    if (tier.fuel) {
      if (!burn(S, e, tier.power, dt)) { e.status = 'Sin combustible'; return; }
      S._poll += (tier.poll || 0) * dt;
    } else {
      e.dem = tier.power * IE.powerMul(S);
      f *= e.pf;
      if (e.pf < 0.05) { e.status = 'Sin energía'; return; }
      if (tier.poll) S._poll += tier.poll * dt;
    }
    e.status = (!tier.fuel && e.pf < 0.99) ? 'Energía insuficiente' : 'Produciendo';
    e.prog += dt * tier.speed * f / r.t;
    if (e.prog >= 1) {
      for (const k in r.out) { e.out[k] = (e.out[k] || 0) + r.out[k]; IE.countProduced(S, k, r.out[k]); }
      e.working = false; e.prog = 0;
      e.crafted = (e.crafted || 0) + 1;
    }
  };

  IE.updateLab = function (S, e, dt) {
    const tier = IE.tierOf(e);
    const tech = S.research.cur && IE.TECH[S.research.cur];
    e.dem = 0;
    if (!tech) { e.status = 'Sin investigación activa'; e.working = false; return; }
    if (!e.working) {
      for (const p of tech.packs) if (!(e.inv[p] > 0)) { e.status = 'Faltan paquetes'; e.missing = p; e.dem = tier.power * 0.05; return; }
      for (const p of tech.packs) { if (--e.inv[p] <= 0) delete e.inv[p]; }
      e.working = true; e.prog = 0; e.workTech = tech.id;
    }
    e.dem = tier.power * IE.powerMul(S);
    if (e.pf < 0.05) { e.status = 'Sin energía'; return; }
    e.status = e.pf < 0.99 ? 'Energía insuficiente' : 'Investigando';
    e.prog += dt * tier.speed * IE.speedMul(S) * e.pf / tech.time;
    if (e.prog >= 1) {
      e.working = false; e.prog = 0;
      if (S.research.cur === e.workTech) IE.addResearch(S, 1);
    }
  };

  IE.updateStorage = function (S, e, dt) {
    const tier = IE.tierOf(e);
    if (!e.filter) return;
    if (tier.power) { e.dem = tier.power; if (e.pf < 0.05) return; }
    const n = tier.outRate || 1;
    for (let c = 0; c < n; c++) {
      let item = e.filter;
      if (item === '*') {
        const ks = Object.keys(e.inv).filter(k => e.inv[k] > 0);
        if (!ks.length) return;
        e.allRR = ((e.allRR || 0) + 1) % ks.length;
        item = ks[e.allRR];
      }
      if (!(e.inv[item] > 0)) return;
      if (!IE.pushOut(S, e, item)) return;
      if (--e.inv[item] <= 0) delete e.inv[item];
    }
  };

  // Tomar un objeto de una entidad origen (para brazos). pred(item) decide si sirve.
  IE.takeFrom = function (S, src, pred, filter, maxN) {
    if (!src) return null;
    const kind = IE.BUILDINGS[src.type].kind;
    const ok = k => (!filter || k === filter) && pred(k);
    if (kind === 'belt') {
      for (let k = src.items.length - 1; k >= 0; k--) {
        const it = src.items[k];
        if (it.p > 0.35 && ok(it.i)) { src.items.splice(k, 1); return { i: it.i, n: 1 }; }
      }
      return null;
    }
    let pool = null;
    if (kind === 'machine' || kind === 'miner') pool = src.out;
    else if (kind === 'storage' || kind === 'depot') pool = src.inv;
    else if (kind === 'gen' && src.out) pool = src.out;
    else if (kind === 'core') { if (!filter) return null; pool = S.inv; }
    if (!pool) return null;
    for (const k in pool) {
      if (pool[k] > 0 && ok(k)) {
        const n = Math.min(maxN, pool[k]);
        pool[k] -= n;
        if (pool[k] <= 0) delete pool[k];
        return { i: k, n };
      }
    }
    return null;
  };

  IE.updateArm = function (S, e, dt) {
    const tier = IE.tierOf(e);
    e.dem = tier.power * IE.powerMul(S);
    if (e.pf < 0.05) { e.status = 'Sin energía'; return; }
    e.t += dt * e.pf * IE.speedMul(S);
    const d = e.rot;
    const src = IE.entAt(S, e.x - DX[d], e.y - DY[d]);
    const dst = IE.entAt(S, e.x + DX[d], e.y + DY[d]);
    if (!e.hold) {
      e.dem = tier.power * 0.1;
      if (e.t < tier.period * 0.5) return;
      if (!dst) { e.status = 'Sin destino'; return; }
      const got = IE.takeFrom(S, src, k => IE.accept(S, dst, k, d, true), tier.filter ? e.filter : null, tier.stack);
      if (got) { e.hold = got.i; e.holdN = got.n; e.t = 0; e.status = 'Moviendo'; }
      else e.status = 'Esperando';
    } else if (e.t >= tier.period * 0.5) {
      while (e.holdN > 0 && dst && IE.accept(S, dst, e.hold, d)) e.holdN--;
      if (e.holdN <= 0) { e.hold = null; e.t = 0; e.status = 'Moviendo'; }
      else e.status = 'Destino lleno';
    }
  };

  // Restauración de ruinas y entregas a la ciudad / complejo
  IE.checkRestore = function (S, t) {
    const need = IE.demandOf(t);
    for (const k in need) if ((t.got[k] || 0) < need[k]) return false;
    if (t.done) return true;
    t.done = true;
    if (t.type === 'ruin') {
      const R = IE.RUINS[t.ruin];
      if (R.flag) S.flags[R.flag] = true;
      if (R.log && !S.logs.includes(R.log)) S.logs.push(R.log);
      if (R.grantTech) S.tech[R.grantTech] = true;
      if (R.grantItems) for (const k in R.grantItems) IE.invAdd(S, k, R.grantItems[k]);
      S.dirty.power = true;
      IE.emit('restored', { ent: t, ruin: R });
    } else if (t.type === 'city') {
      S.flags.city_full = true;
      IE.emit('restored', { ent: t, city: true });
    } else if (t.type === 'horizon') {
      S.flags.horizon_built = true;
      S.dirty.power = true;
      IE.emit('restored', { ent: t, horizon: true });
    }
    return true;
  };
  // Entregar desde el Núcleo todo lo que falte y haya disponible
  IE.deliverFromCore = function (S, t) {
    const need = IE.demandOf(t);
    let n = 0;
    for (const k in need) {
      const miss = need[k] - (t.got[k] || 0);
      const give = Math.min(miss, S.inv[k] || 0);
      if (give > 0) { IE.invAdd(S, k, -give); t.got[k] = (t.got[k] || 0) + give; n += give; }
    }
    IE.checkRestore(S, t);
    return n;
  };

  // Fabricación manual en el Taller del Núcleo (cola)
  IE.handCraftable = S => IE.RECIPES.filter(r => r.hand && IE.recipeUnlocked(S, r));
  IE.queueCraft = function (S, rid, n) {
    const r = IE.RECIPE[rid];
    let q = 0;
    for (let c = 0; c < n; c++) {
      if (!IE.canAfford(S, r.in)) break;
      IE.pay(S, r.in);
      S.handCraft.push({ r: rid, p: 0 });
      q++;
    }
    return q;
  };
  IE.updateHandCraft = function (S, dt) {
    const job = S.handCraft[0];
    if (!job) return;
    const r = IE.RECIPE[job.r];
    job.p += dt / (r.t * 1.5);
    if (job.p >= 1) {
      for (const k in r.out) { IE.invAdd(S, k, r.out[k]); IE.countProduced(S, k, r.out[k]); }
      S.handCraft.shift();
    }
  };
})();
