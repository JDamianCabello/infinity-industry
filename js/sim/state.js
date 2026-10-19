// Estado de la partida, colocación/retirada de entidades e inventario del Núcleo.
(function () {
  const IE = window.IE;
  const W = IE.MAP_W, H = IE.MAP_H;

  IE.newState = function (seed) {
    const S = {
      version: IE.SAVE_VERSION,
      seed, time: 0, tick: 0, speed: 1, paused: false,
      world: IE.generateWorld(seed),
      grid: new Int32Array(W * H),     // id de entidad por casilla
      ents: new Map(), nextId: 1,
      inv: { piedra: 20, madera: 20, placa_hierro: 24, engranaje: 8, carbon: 10, lingote_cobre: 6 },
      regions: [true, false, false, false, false, false],
      tech: {}, research: { cur: null, prog: 0 },
      flags: {}, choices: {},
      missions: { main: 0, done: {}, base: {}, side: {}, timers: {} },
      stats: { produced: {}, coreIn: {}, manual: 0, truckDelivered: 0, trainDelivered: 0, built: {}, playTime: 0, peakPower: 0 },
      hist: { sec: {}, rates: {}, power: [] },
      pollution: 0,
      trucks: [], trains: [], robots: [],
      logs: ['log_wake'],
      victory: false, freeMode: false,
      dirty: { power: true, rail: true, belts: true },
      handCraft: [],
    };
    IE.START_TECH.forEach(t => S.tech[t] = true);
    // Núcleo y ruinas
    const C = IE.CORE_POS;
    IE.placeEntity(S, 'core', C.x, C.y, 0, 1, true);
    for (const key in S.world.ruinSites) {
      const s = S.world.ruinSites[key];
      if (key === 'city') IE.placeEntity(S, 'city', s.x, s.y, 0, 1, true);
      else if (key === 'horizon') IE.placeEntity(S, 'horizon', s.x, s.y, 0, 1, true);
      else { const e = IE.placeEntity(S, 'ruin', s.x, s.y, 0, 1, true); e.ruin = key; e.got = {}; }
    }
    return S;
  };

  IE.coreEnt = S => S.ents.get(S.coreId);

  // ---------- Inventario del Núcleo ----------
  IE.invCount = (S, item) => S.inv[item] || 0;
  IE.invAdd = (S, item, n) => { S.inv[item] = (S.inv[item] || 0) + n; if (S.inv[item] <= 0) delete S.inv[item]; };
  IE.canAfford = (S, cost) => { for (const k in cost) if ((S.inv[k] || 0) < cost[k]) return false; return true; };
  IE.pay = (S, cost) => { for (const k in cost) IE.invAdd(S, k, -cost[k]); };
  IE.refund = (S, cost, f = 1) => { for (const k in cost) { const n = Math.floor(cost[k] * f); if (n > 0) IE.invAdd(S, k, n); } };

  // Coste real teniendo en cuenta decisiones
  IE.costOf = function (S, type, tier) {
    return IE.BUILDINGS[type].tiers[tier - 1].cost || {};
  };

  IE.techDone = (S, t) => !t || !!S.tech[t];
  IE.tierUnlocked = (S, type, tier) => {
    const d = IE.BUILDINGS[type].tiers[tier - 1];
    return d && IE.techDone(S, d.tech);
  };
  IE.recipeUnlocked = (S, r) => IE.techDone(S, r.tech);

  IE.dims = function (type, tier, rot) {
    const d = IE.BUILDINGS[type].tiers[tier - 1];
    return (rot & 1) ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
  };

  // ---------- Comprobación de colocación ----------
  // Devuelve null si se puede, o un texto con el motivo.
  IE.canPlace = function (S, type, x, y, rot, tier, ignoreId) {
    const def = IE.BUILDINGS[type];
    const { w, h } = IE.dims(type, tier, rot);
    const wd = S.world;
    let resFound = false, oil = false;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (!IE.inMap(xx, yy)) return 'Fuera del mapa';
      const i = yy * W + xx;
      if (!S.regions[wd.region[i]]) return 'Región bloqueada';
      const other = S.grid[i];
      if (other && other !== ignoreId) return 'Ocupado';
      if (wd.feat[i]) return 'Hay ' + (wd.feat[i] === IE.FEAT.TREE ? 'un árbol' : 'una roca') + ': despéjalo con ✋';
      const t = wd.terr[i];
      if (t === IE.TERR.ROCK) return 'Terreno rocoso';
      if (t === IE.TERR.WATER) {
        const lineType = def.kind === 'belt' || def.kind === 'road' || def.kind === 'rail';
        if (!lineType) return 'No se puede construir en el agua';
        if (!S.flags.bridges) return 'Necesitas investigar Puentes';
      }
      if (wd.res[i]) { resFound = true; if (IE.RES[wd.res[i]] === 'crudo') oil = true; }
    }
    if (def.kind === 'miner') {
      if (def.onlyRes === 'crudo' && !oil) return 'Debe colocarse sobre petróleo';
      if (!def.onlyRes && !resFound) return 'No hay recursos debajo';
    }
    if (def.needWater && IE.waterAround(S, x, y, w, h) < def.needWater) return 'Debe tocar al menos ' + def.needWater + ' casillas de agua';
    return null;
  };

  // ---------- Crear y destruir entidades ----------
  IE.placeEntity = function (S, type, x, y, rot, tier, free) {
    const def = IE.BUILDINGS[type];
    const { w, h } = IE.dims(type, tier, rot);
    const e = { id: S.nextId++, type, x, y, w, h, rot: rot || 0, tier: tier || 1 };
    IE.initEntity(S, e);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) S.grid[yy * W + xx] = e.id;
    S.ents.set(e.id, e);
    if (type === 'core') S.coreId = e.id;
    if (!free) S.stats.built[type] = (S.stats.built[type] || 0) + 1;
    IE.onGridChange(S, e);
    return e;
  };

  IE.initEntity = function (S, e) {
    const def = IE.BUILDINGS[e.type];
    const k = def.kind;
    e.status = 'ok';
    e._front = null; e.tiles = null;
    if (k === 'belt') { e.items = []; e.curve = 0; }
    if (k === 'splitter' || k === 'crossing' || k === 'sorter') { e.buf = []; e.rr = 0; if (k === 'sorter') e.filters = e.filters || []; }
    if (k === 'machine' || k === 'lab' || k === 'miner') { e.inv = e.inv || {}; e.out = e.out || {}; e.prog = e.prog || 0; e.working = false; e.outRR = 0; }
    if (k === 'miner') { e.resRR = 0; }
    if (k === 'storage' || k === 'depot') { e.inv = e.inv || {}; e.filter = e.filter || null; e.outRR = 0; }
    if (k === 'gen' || k === 'battery') { e.inv = e.inv || {}; e.fuelKJ = e.fuelKJ || 0; e.outKW = 0; e.stored = e.stored || 0; e.on = e.on !== false; }
    if (k === 'arm') { e.hold = null; e.t = 0; e.filter = e.filter || null; }
    if (k === 'robohub') { e.robots = e.robots || []; }
    if (k === 'ruin' || k === 'city' || k === 'horizon') { e.got = e.got || {}; }
    if (IE.tierOf(e).fuel) { e.fuelKJ = e.fuelKJ || 0; e.fuelInv = e.fuelInv || {}; }
    if (e.prio == null) e.prio = 1;
    e.pf = 1; // factor de energía recibido (0..1)
  };

  // Al retirar: devuelve materiales y contenido al Núcleo
  IE.removeEntity = function (S, e, noRefund) {
    if (e.type === 'core' || IE.BUILDINGS[e.type].special) return false;
    for (let yy = e.y; yy < e.y + e.h; yy++) for (let xx = e.x; xx < e.x + e.w; xx++) S.grid[yy * W + xx] = 0;
    S.ents.delete(e.id);
    if (!noRefund) {
      IE.refund(S, IE.costOf(S, e.type, e.tier));
      const dump = o => { if (o) for (const k in o) if (o[k] > 0) IE.invAdd(S, k, Math.floor(o[k])); };
      dump(e.inv); dump(e.out); dump(e.fuelInv);
      if (e.items) e.items.forEach(it => IE.invAdd(S, it.i, 1));
      if (e.buf) e.buf.forEach(it => IE.invAdd(S, it.i || it, 1));
      if (e.hold) IE.invAdd(S, e.hold, e.holdN || 1);
    }
    // Vehículos asociados
    if (e.type === 'rail' || e.type === 'signal') {
      S.trains.forEach(t => { if (t.tiles.includes(IE.idx(e.x, e.y))) t.derailed = true; });
    }
    IE.onGridChange(S, e);
    return true;
  };

  IE.onGridChange = function (S, e) {
    const k = IE.BUILDINGS[e.type].kind;
    S.dirty.power = true;
    S.gridVer = (S.gridVer || 0) + 1;
    if (k === 'rail' || k === 'depot') S.dirty.rail = true;
    if (k === 'road' || k === 'depot') S.dirty.road = true;
    // Recalcular curvas de cintas vecinas
    for (let yy = e.y - 1; yy <= e.y + e.h; yy++) for (let xx = e.x - 1; xx <= e.x + e.w; xx++) {
      if (!IE.inMap(xx, yy)) continue;
      const n = S.ents.get(S.grid[yy * W + xx]);
      if (n && n.type === 'belt') IE.updateBeltCurve(S, n);
    }
    IE.emit('grid', e);
  };

  IE.entAt = (S, x, y) => IE.inMap(x, y) ? S.ents.get(S.grid[y * W + x]) : undefined;

  // Mejora in situ a la siguiente generación (V1→V2→V3→V4)
  IE.canUpgrade = function (S, e) {
    const def = IE.BUILDINGS[e.type];
    if (def.special) return 'No mejorable';
    const nt = e.tier + 1;
    if (nt > def.tiers.length) return 'Nivel máximo';
    if (!IE.tierUnlocked(S, e.type, nt)) return 'Investiga ' + IE.TECH[def.tiers[nt - 1].tech].name;
    const cost = IE.costOf(S, e.type, nt);
    // Al mejorar se recupera el coste del nivel anterior
    const old = IE.costOf(S, e.type, e.tier);
    for (const k in cost) if ((S.inv[k] || 0) + (old[k] || 0) < cost[k]) return 'Faltan materiales';
    const nd = IE.dims(e.type, nt, e.rot);
    if (nd.w !== e.w || nd.h !== e.h) {
      const why = IE.canPlace(S, e.type, e.x, e.y, e.rot, nt, e.id);
      if (why) return 'Sin espacio para el nuevo tamaño (' + why + ')';
    }
    return null;
  };
  IE.upgrade = function (S, e) {
    if (IE.canUpgrade(S, e)) return false;
    const nt = e.tier + 1;
    IE.refund(S, IE.costOf(S, e.type, e.tier));
    IE.pay(S, IE.costOf(S, e.type, nt));
    const nd = IE.dims(e.type, nt, e.rot);
    if (nd.w !== e.w || nd.h !== e.h) {
      for (let yy = e.y; yy < e.y + e.h; yy++) for (let xx = e.x; xx < e.x + e.w; xx++) S.grid[yy * W + xx] = 0;
      e.w = nd.w; e.h = nd.h;
      for (let yy = e.y; yy < e.y + e.h; yy++) for (let xx = e.x; xx < e.x + e.w; xx++) S.grid[yy * W + xx] = e.id;
    }
    e.tier = nt;
    IE.initEntity(S, e);
    // Un V1 de combustible pasa a eléctrico: devolver el combustible sobrante
    if (!IE.tierOf(e).fuel && e.fuelInv) { for (const k in e.fuelInv) IE.invAdd(S, k, e.fuelInv[k]); e.fuelInv = null; e.fuelKJ = 0; }
    IE.onGridChange(S, e);
    IE.emit('upgrade', e);
    return true;
  };

  // Extracción manual / tala
  IE.manualMine = function (S, x, y) {
    if (!IE.inMap(x, y)) return null;
    const wd = S.world, i = y * W + x;
    if (!S.regions[wd.region[i]]) return null;
    if (S.grid[i]) return null;
    if (wd.feat[i] === IE.FEAT.TREE) { wd.feat[i] = 0; IE.invAdd(S, 'madera', 4); S.stats.manual++; IE.emit('terrain', { x, y }); return { item: 'madera', n: 4 }; }
    if (wd.feat[i] === IE.FEAT.ROCK) { wd.feat[i] = 0; IE.invAdd(S, 'piedra', 6); S.stats.manual++; IE.emit('terrain', { x, y }); return { item: 'piedra', n: 6 }; }
    const r = wd.res[i];
    if (r && IE.RES[r] !== 'crudo' && IE.RES[r] !== 'xenita' && IE.RES[r] !== 'uranio') {
      const item = IE.RES[r];
      IE.invAdd(S, item, 1);
      IE.countProduced(S, item, 1);
      S.stats.manual++;
      if (--wd.amt[i] <= 0) { wd.res[i] = 0; IE.emit('terrain', { x, y }); }
      return { item, n: 1 };
    }
    return null;
  };

  IE.countProduced = function (S, item, n) {
    S.stats.produced[item] = (S.stats.produced[item] || 0) + n;
    S.hist.sec[item] = (S.hist.sec[item] || 0) + n;
  };
})();
