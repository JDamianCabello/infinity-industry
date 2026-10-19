// Redes eléctricas: postes, cobertura, generación por fuentes, baterías y prioridades.
(function () {
  const IE = window.IE;
  const W = IE.MAP_W, H = IE.MAP_H;

  IE.DAY_LEN = 480; // segundos de juego por día
  IE.daylight = S => {
    const ph = ((S.time + IE.DAY_LEN * 0.1) % IE.DAY_LEN) / IE.DAY_LEN;
    return IE.clamp(0.5 + 0.9 * Math.sin(ph * Math.PI * 2), 0, 1);
  };
  let windNoise = null;
  IE.wind = S => {
    if (!windNoise) windNoise = IE.makeNoise(777);
    return IE.clamp(0.1 + 1.0 * (windNoise(S.time / 70, 3.3, 2) - 0.25) * 1.4, 0.05, 1);
  };
  IE.smog = S => Math.min(0.35, S.pollution / 20000);

  const isElectric = e => {
    const def = IE.BUILDINGS[e.type], t = IE.tierOf(e);
    if (def.kind === 'gen' || def.kind === 'battery' || def.kind === 'depot' || def.kind === 'horizon' || def.kind === 'robohub') return true;
    if (def.kind === 'ruin' && e.done && IE.RUINS[e.ruin].gen) return true;
    return !!t.power && !t.fuel;
  };
  IE.isElectric = isElectric;

  IE.rebuildPower = function (S) {
    S.dirty.power = false;
    const nodes = [];
    for (const e of S.ents.values()) {
      const def = IE.BUILDINGS[e.type];
      if (def.kind === 'pole' || def.kind === 'core') {
        const t = IE.tierOf(e);
        nodes.push({ e, cx: e.x + e.w / 2, cy: e.y + e.h / 2, s: t.supply, l: t.link, p: nodes.length });
      }
    }
    // Unión de postes por distancia de enlace (Kruskal: los cables forman un árbol limpio)
    const par = nodes.map((_, i) => i);
    const find = i => par[i] === i ? i : (par[i] = find(par[i]));
    const edges = [];
    for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
      const A = nodes[a], B = nodes[b];
      const dx = A.cx - B.cx, dy = A.cy - B.cy;
      const lim = Math.min(A.l, B.l);
      if (Math.abs(dx) > lim || Math.abs(dy) > lim) continue;
      const d = Math.hypot(dx, dy);
      if (d <= lim) edges.push([d, a, b]);
    }
    edges.sort((x, y) => x[0] - y[0]);
    const wires = [];
    for (const [d, a, b] of edges) {
      const ra = find(a), rb = find(b);
      if (ra === rb) continue;
      par[ra] = rb;
      wires.push([nodes[a].cx, nodes[a].cy - 0.6, nodes[b].cx, nodes[b].cy - 0.6]);
    }
    S.wires = wires;
    // Cobertura
    const cover = S.cover = new Int32Array(W * H);
    const nets = new Map();
    nodes.forEach((n, i) => {
      const id = find(i) + 1;
      n.e.net = id;
      if (!nets.has(id)) nets.set(id, { id, cons: [], gens: [], bats: [], poles: [], gen: 0, dem: 0, sat: 1, cap: 0, stored: 0, storeCap: 0 });
      nets.get(id).poles.push(n.e);
      const r = n.s;
      for (let y = Math.floor(n.cy - r - 0.5); y < Math.ceil(n.cy + r + 0.5); y++) for (let x = Math.floor(n.cx - r - 0.5); x < Math.ceil(n.cx + r + 0.5); x++) {
        if (IE.inMap(x, y) && !cover[y * W + x]) cover[y * W + x] = id;
      }
    });
    for (const e of S.ents.values()) {
      const def = IE.BUILDINGS[e.type];
      if (def.kind === 'pole') continue;
      if (!isElectric(e) && def.kind !== 'core') { e.net = 0; continue; }
      if (def.kind !== 'core') {
        e.net = 0;
        for (let y = e.y; y < e.y + e.h && !e.net; y++) for (let x = e.x; x < e.x + e.w; x++) if (cover[y * W + x]) { e.net = cover[y * W + x]; break; }
      }
      const net = nets.get(e.net);
      if (!net) { e.pf = 0; continue; }
      if (def.kind === 'gen' || def.kind === 'core' || (def.kind === 'ruin')) net.gens.push(e);
      else if (def.kind === 'battery') net.bats.push(e);
      if (def.kind !== 'gen' && def.kind !== 'battery' && def.kind !== 'ruin') net.cons.push(e);
    }
    S.nets = nets;
  };

  // Potencia disponible de un generador en este tick (kW) y su grupo de despacho
  function genAvail(S, e) {
    const def = IE.BUILDINGS[e.type], t = IE.tierOf(e);
    if (def.kind === 'core') return [t.out, 'must'];
    if (def.kind === 'ruin') return [IE.RUINS[e.ruin].gen || 0, 'must'];
    const renew = S.choices.policy === 'limpia' ? 1.15 : 1;
    switch (def.gen) {
      case 'solar': {
        const dl = IE.daylight(S);
        const f = Math.max(dl, t.night ? t.night : 0);
        return [t.out * f * (1 - IE.smog(S)) * renew, 'must'];
      }
      case 'wind': {
        const reg = S.world.region[e.y * W + e.x];
        const rm = reg === 4 ? 1.3 : reg === 1 ? 0.8 : 1;
        return [t.out * Math.max(IE.wind(S), t.minWind || 0) * rm * renew, 'must'];
      }
      case 'hydro': {
        if (e.water == null) e.water = IE.waterAround(S, e.x, e.y, e.w, e.h);
        return [t.out * Math.min(1, e.water / 6) * renew, 'must'];
      }
      case 'nuclear': {
        if (!e.on) return [0, 'must'];
        if (e.cellLeft > 0) return [t.out, 'must'];
        if ((e.out && e.out.residuo_nuclear || 0) >= 4) return [0, 'must'];
        return [(e.inv.celda_nuclear || 0) > 0 ? t.out : 0, 'must'];
      }
      case 'fusion':
        if (!e.on) return [0, 'disp'];
        return [(e.fuelKJ > 0 || (e.inv[t.fuelItem] || 0) > 0) ? t.out : 0, 'disp'];
      case 'fuel':
        if (!e.on) return [0, 'disp'];
        return [(e.fuelKJ > 0 || IE.sumInv(e.inv) > 0) ? t.out : 0, 'disp'];
    }
    return [0, 'must'];
  }

  function burnGen(S, e, kw, dt) {
    const def = IE.BUILDINGS[e.type], t = IE.tierOf(e);
    e.outKW = kw;
    if (kw <= 0) return;
    if (def.gen === 'fusion') {
      const need = kw * dt;
      while (e.fuelKJ < need && (e.inv[t.fuelItem] || 0) > 0) { e.inv[t.fuelItem]--; e.fuelKJ += t.out * t.fuelTime; }
      e.fuelKJ = Math.max(0, e.fuelKJ - need);
      return;
    }
    const need = kw * dt / t.eff;
    while (e.fuelKJ < need) {
      const f = Object.keys(e.inv).find(k => e.inv[k] > 0);
      if (!f) break;
      if (--e.inv[f] <= 0) delete e.inv[f];
      // El combustible refinado rinde un 30 % más en motores de combustión
      e.fuelKJ += IE.ITEMS[f].fuel * (e.type === 'combustion' && f === 'combustible' ? 1.3 : 1);
    }
    e.fuelKJ = Math.max(0, e.fuelKJ - need);
    S._poll += (t.poll || 0) * (kw / t.out) * dt;
  }

  // Reactores: queman celdas sin pausa mientras estén encendidos
  function runReactor(S, e, dt) {
    const t = IE.tierOf(e);
    e.out = e.out || {};
    if (e.out.residuo_nuclear > 0) { if (IE.pushOut(S, e, 'residuo_nuclear')) { if (--e.out.residuo_nuclear <= 0) delete e.out.residuo_nuclear; } }
    if (!e.on) { e.status = 'Apagado'; return; }
    if (!(e.cellLeft > 0)) {
      if ((e.out.residuo_nuclear || 0) >= 4) { e.status = 'Residuos sin retirar'; return; }
      if ((e.inv.celda_nuclear || 0) > 0) { e.inv.celda_nuclear--; e.cellLeft = t.cellTime; }
      else { e.status = 'Sin celdas'; return; }
    }
    e.cellLeft -= dt;
    e.status = 'En fisión';
    if (e.cellLeft <= 0) { e.cellLeft = 0; e.out.residuo_nuclear = (e.out.residuo_nuclear || 0) + 1; }
  }

  IE.updatePower = function (S, dt) {
    if (S.dirty.power || !S.nets) IE.rebuildPower(S);
    const prio = !!S.flags.priorities;
    let G = { gen: 0, dem: 0, cap: 0, stored: 0, storeCap: 0, sat: 1, best: 0, bestSat: 0 };
    for (const net of S.nets.values()) {
      // Demanda por prioridad
      const D = [0, 0, 0];
      for (const c of net.cons) D[prio ? c.prio : 1] += c.dem || 0;
      const dem = D[0] + D[1] + D[2];
      let must = 0, disp = 0;
      const dispList = [];
      for (const g of net.gens) {
        if (IE.BUILDINGS[g.type].gen === 'nuclear') runReactor(S, g, dt);
        const [a, grp] = genAvail(S, g);
        g.avail = a;
        if (grp === 'must') { must += a; g.outKW = a; } else { disp += a; dispList.push(g); }
      }
      // Fusión antes que combustión
      dispList.sort((a, b) => (IE.BUILDINGS[b.type].gen === 'fusion') - (IE.BUILDINGS[a.type].gen === 'fusion'));
      let batDis = 0, batChg = 0;
      for (const b of net.bats) {
        const t = IE.tierOf(b);
        batDis += Math.min(t.rateKW, b.stored / dt);
        batChg += Math.min(t.rateKW, (t.capKJ - b.stored) / dt);
      }
      const avail = must + disp;
      let supply, fromDisp = 0, fromBat = 0, toBat = 0;
      if (avail >= dem) {
        supply = dem;
        toBat = Math.min(batChg, avail - dem);
        fromDisp = Math.max(0, dem + toBat - must);
      } else {
        fromDisp = disp;
        fromBat = Math.min(batDis, dem - avail);
        supply = avail + fromBat;
      }
      // Despacho de generadores de combustible
      let left = fromDisp;
      for (const g of dispList) { const u = Math.min(left, g.avail); burnGen(S, g, u, dt); left -= u; }
      // Baterías
      for (const b of net.bats) {
        const t = IE.tierOf(b);
        if (toBat > 0 && batChg > 0) b.stored = Math.min(t.capKJ, b.stored + toBat * dt * (Math.min(t.rateKW, (t.capKJ - b.stored) / dt) / batChg));
        if (fromBat > 0 && batDis > 0) b.stored = Math.max(0, b.stored - fromBat * dt * (Math.min(t.rateKW, b.stored / dt) / batDis));
        b.flow = toBat > 0 ? 1 : fromBat > 0 ? -1 : 0;
        G.stored += b.stored; G.storeCap += t.capKJ;
      }
      // Reparto por prioridad
      let A = supply;
      const pfs = [1, 1, 1];
      for (let p = 0; p < 3; p++) {
        if (D[p] <= 0) continue;
        const give = Math.min(A, D[p]);
        pfs[p] = give / D[p];
        A -= give;
      }
      for (const c of net.cons) c.pf = (c.dem || 0) > 0 ? pfs[prio ? c.prio : 1] : 1;
      net.gen = Math.min(must, dem + toBat) + fromDisp + fromBat;
      net.dem = dem; net.cap = avail; net.sat = dem > 0 ? Math.min(1, supply / dem) : 1;
      net.stored = net.bats.reduce((s, b) => s + b.stored, 0);
      net.storeCap = net.bats.reduce((s, b) => s + IE.tierOf(b).capKJ, 0);
      G.gen += net.gen; G.dem += dem; G.cap += avail;
      if (avail > G.best) { G.best = avail; G.bestSat = net.sat; G.bestNet = net.id; }
    }
    G.sat = G.dem > 0 ? Math.min(1, G.gen / G.dem) : 1;
    // Entidades sin red: sin energía
    S.power = G;
    if (G.gen > S.stats.peakPower) S.stats.peakPower = G.gen;
  };

  // Para el visor: casillas cubiertas
  IE.coverAt = (S, x, y) => S.cover ? S.cover[y * W + x] : 0;
})();
