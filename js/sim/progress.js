// Investigación, misiones, historia, estadísticas y bucle de simulación.
(function () {
  const IE = window.IE;

  // ---------- Investigación ----------
  IE.techAvailable = function (S, id) {
    const t = IE.TECH[id];
    if (S.tech[id]) return 'Investigada';
    for (const p of t.pre) if (!S.tech[p]) return 'Requiere ' + IE.TECH[p].name;
    if (t.needFlag && !S.flags[t.needFlag]) return t.needText;
    return null;
  };
  IE.setResearch = function (S, id) {
    if (IE.techAvailable(S, id)) return false;
    if (S.research.cur !== id) { S.research.cur = id; S.research.prog = S.research.saved && S.research.saved[id] || 0; }
    return true;
  };
  IE.addResearch = function (S, units) {
    const id = S.research.cur;
    if (!id) return;
    const t = IE.TECH[id];
    S.research.prog += units;
    S.research.saved = S.research.saved || {};
    S.research.saved[id] = S.research.prog;
    if (S.research.prog >= t.cost) {
      S.tech[id] = true;
      if (t.flag) S.flags[t.flag] = true;
      S.research.cur = null; S.research.prog = 0;
      delete S.research.saved[id];
      IE.emit('researched', t);
    }
  };
  IE.techUnlocks = function (id) {
    const out = [];
    for (const b in IE.BUILDINGS) IE.BUILDINGS[b].tiers.forEach((t, i) => { if (t.tech === id) out.push(t.name + ' (V' + (i + 1) + ')'); });
    IE.RECIPES.forEach(r => { if (r.tech === id) out.push('Receta: ' + r.name); });
    IE.TRUCKS.forEach((t, i) => { if (t && t.tech === id) out.push(t.name); });
    IE.LOCOS.forEach((t, i) => { if (t && t.tech === id) out.push(t.name); });
    IE.WAGONS.forEach((t, i) => { if (t && t.tech === id) out.push(t.name); });
    return out;
  };

  // ---------- Misiones ----------
  IE.currentMission = S => IE.MISSIONS[S.missions.main] || null;

  IE.startMission = function (S, m) {
    const base = {};
    m.obj.forEach((o, k) => {
      if (o.t === 'produce') base[k] = S.stats.produced[o.item] || 0;
      if (o.t === 'core') base[k] = S.stats.coreIn[o.item] || 0;
      if (o.t === 'truck') base[k] = S.stats.truckDelivered;
      if (o.t === 'train') base[k] = S.stats.trainDelivered;
      if (o.t === 'manual') base[k] = S.stats.manual;
    });
    S.missions.base[m.id] = base;
    S.missions.timers[m.id] = {};
    if (m.intro) IE.emit('dialog', { lines: m.intro, title: m.title });
  };

  function countBuilt(S, type, tier) {
    let n = 0;
    for (const e of S.ents.values()) if (e.type === type && (!tier || e.tier >= tier)) n++;
    return n;
  }
  function findEnt(S, pred) { for (const e of S.ents.values()) if (pred(e)) return e; return null; }

  // Devuelve [progreso actual, objetivo, cumplido]
  IE.objProgress = function (S, m, k, tick) {
    const o = m.obj[k];
    const base = (S.missions.base[m.id] || {})[k] || 0;
    const tm = (S.missions.timers[m.id] = S.missions.timers[m.id] || {});
    const P = S.power || { best: 0, bestSat: 0 };
    switch (o.t) {
      case 'manual': { const v = S.stats.manual - base; return [v, o.n, v >= o.n]; }
      case 'build': { const v = countBuilt(S, o.b, o.tier); return [v, o.n, v >= o.n]; }
      case 'produce': { const v = (S.stats.produced[o.item] || 0) - base; return [v, o.n, v >= o.n]; }
      case 'core': { const v = (S.stats.coreIn[o.item] || 0) - base; return [v, o.n, v >= o.n]; }
      case 'truck': { const v = S.stats.truckDelivered - base; return [v, o.n, v >= o.n]; }
      case 'train': { const v = S.stats.trainDelivered - base; return [v, o.n, v >= o.n]; }
      case 'research': return [S.tech[o.tech] ? 1 : 0, 1, !!S.tech[o.tech]];
      case 'flag': return [S.flags[o.flag] ? 1 : 0, 1, !!S.flags[o.flag]];
      case 'restore': { const e = findEnt(S, e => e.type === 'ruin' && e.ruin === o.ruin); return [e && e.done ? 1 : 0, 1, !!(e && e.done)]; }
      case 'city': { const e = findEnt(S, e => e.type === 'city'); return [e && e.done ? 1 : 0, 1, !!(e && e.done)]; }
      case 'horizon': { const e = findEnt(S, e => e.type === 'horizon'); return [e && e.done ? 1 : 0, 1, !!(e && e.done)]; }
      case 'power': {
        const ok = P.best >= o.kw;
        if (tick) tm[k] = ok ? (tm[k] || 0) + 1 : 0;
        return [Math.min(tm[k] || 0, o.secs), o.secs, (tm[k] || 0) >= o.secs];
      }
      case 'satisfied': {
        const ok = P.best >= o.kw && P.bestSat >= 0.999;
        if (tick) tm[k] = ok ? (tm[k] || 0) + 1 : 0;
        return [Math.min(tm[k] || 0, o.secs), o.secs, (tm[k] || 0) >= o.secs];
      }
      case 'rate': { const v = IE.ratePerMin(S, o.item); return [Math.floor(v), o.perMin, v >= o.perMin]; }
      case 'robots': { const v = IE.robotCount(S); return [v, o.n, v >= o.n]; }
      case 'stored': { const v = (P.storeCap || 0); return [Math.floor(v / 1000), Math.floor(o.kj / 1000), v >= o.kj]; }
      case 'path_req': { const r = IE.pathRequirement(S); return [r.ok ? 1 : 0, 1, r.ok]; }
    }
    return [0, 1, false];
  };
  // Requisito final según la decisión del Acto III
  IE.pathRequirement = function (S) {
    if (S.choices.path === 'armonia') {
      const v = (S.power && S.power.stored) || 0;
      return { ok: v >= 150000, text: 'Baterías cargadas: ' + IE.fmtEnergy(v) + ' / 150 MJ' };
    }
    if (S.choices.path === 'prometeo') {
      let on = false;
      for (const e of S.ents.values()) if (e.type === 'fusion' && e.outKW > 0) on = true;
      return { ok: on, text: on ? 'Generador experimental funcionando' : 'Ningún generador experimental produciendo' };
    }
    return { ok: false, text: 'Sin decisión' };
  };

  function applyReward(S, rw) {
    if (!rw) return;
    if (rw.items) for (const k in rw.items) IE.invAdd(S, k, rw.items[k]);
    if (rw.flags) rw.flags.forEach(f => S.flags[f] = true);
    if (rw.regions) rw.regions.forEach(r => { S.regions[r] = true; S.flags['region' + r] = true; IE.emit('region', r); });
    if (rw.log && !S.logs.includes(rw.log)) S.logs.push(rw.log);
  }

  IE.updateMissions = function (S) {
    const m = IE.currentMission(S);
    if (m) {
      if (!S.missions.base[m.id]) IE.startMission(S, m);
      let all = true;
      for (let k = 0; k < m.obj.length; k++) if (!IE.objProgress(S, m, k, true)[2]) all = false;
      if (all) {
        S.missions.done[m.id] = true;
        applyReward(S, m.reward);
        IE.emit('missionDone', m);
        if (m.outro) IE.emit('dialog', { lines: m.outro, title: m.title });
        if (m.final) IE.emit('victory');
        S.missions.main++;
      }
    }
    for (const sm of IE.SIDE_MISSIONS) {
      if (S.missions.done[sm.id]) continue;
      if (sm.need && !S.flags[sm.need]) continue;
      if (!S.missions.base[sm.id]) { const b = {}; sm.obj.forEach((o, k) => { if (o.t === 'produce') b[k] = S.stats.produced[o.item] || 0; }); S.missions.base[sm.id] = b; }
      let all = true;
      for (let k = 0; k < sm.obj.length; k++) if (!IE.objProgress(S, sm, k, true)[2]) all = false;
      if (all) { S.missions.done[sm.id] = true; applyReward(S, sm.reward); IE.emit('missionDone', sm); }
    }
    // Decisiones pendientes tras restaurar instalaciones
    for (const e of S.ents.values()) {
      if (e.type === 'ruin' && e.done) {
        const R = IE.RUINS[e.ruin];
        if (R.decision && !S.choices[R.decision] && !S._askedDecision) { S._askedDecision = true; IE.emit('decision', R.decision); }
      }
    }
  };
  IE.choose = function (S, decision, opt) {
    S.choices[decision] = opt;
    if (decision === 'path') S.flags.path_chosen = true;
    S._askedDecision = false;
    S.dirty.power = true;
  };

  // ---------- Activación del Complejo Horizonte ----------
  IE.horizonCheck = function (S, e) {
    const out = [];
    out.push({ ok: !!e.done, text: 'Componentes entregados' });
    out.push({ ok: !!S.tech.t_horizon, text: 'Tecnología «Proyecto Horizonte»' });
    out.push({ ok: !!e.net, text: 'Conectado a la red eléctrica' });
    const net = e.net && S.nets && S.nets.get(e.net);
    const free = net ? net.cap - (net.dem - (e.dem || 0)) : 0;
    out.push({ ok: free >= IE.HORIZON_POWER, text: 'Capacidad libre en su red: ' + IE.fmtPower(Math.max(0, free)) + ' / ' + IE.fmtPower(IE.HORIZON_POWER) });
    const pr = IE.pathRequirement(S);
    out.push({ ok: pr.ok, text: pr.text });
    return out;
  };
  IE.activateHorizon = function (S, e) {
    if (!IE.horizonCheck(S, e).every(c => c.ok)) return false;
    e.charging = true; e.charge = e.charge || 0;
    return true;
  };
  function updateHorizon(S, e, dt) {
    if (!e.charging || S.flags.horizon_active) { e.dem = S.flags.horizon_active ? IE.HORIZON_POWER * 0.2 : 0; return; }
    e.dem = IE.HORIZON_POWER;
    if (e.pf >= 0.995) e.charge += dt / 40;
    else e.charge = Math.max(0, e.charge - dt / 20);
    e.status = e.pf >= 0.995 ? 'Sincronizando' : 'Energía insuficiente: la sincronización retrocede';
    if (e.charge >= 1) { S.flags.horizon_active = true; e.charging = false; }
  }

  // ---------- Estadísticas ----------
  IE.ratePerMin = function (S, item) {
    const h = S.hist.rates[item];
    if (!h) return 0;
    let s = 0; for (const v of h) s += v;
    return s * 60 / Math.max(1, Math.min(60, h.length));
  };
  function sampleStats(S) {
    for (const k in S.hist.sec) {
      const h = S.hist.rates[k] = S.hist.rates[k] || [];
      h.push(S.hist.sec[k]);
      if (h.length > 60) h.shift();
    }
    for (const k in S.hist.rates) if (!(k in S.hist.sec)) { const h = S.hist.rates[k]; h.push(0); if (h.length > 60) h.shift(); }
    S.hist.sec = {};
    const P = S.power || {};
    S.hist.power.push([Math.round(P.gen || 0), Math.round(P.dem || 0), Math.round(P.stored || 0)]);
    if (S.hist.power.length > 180) S.hist.power.shift();
  }

  // ---------- Bucle de simulación ----------
  IE.rebuildLists = function (S) {
    const L = { belt: [], router: [], miner: [], machine: [], lab: [], storage: [], arm: [], horizon: [] };
    for (const e of S.ents.values()) {
      const k = IE.BUILDINGS[e.type].kind;
      if (k === 'belt') L.belt.push(e);
      else if (k === 'splitter' || k === 'crossing' || k === 'sorter') L.router.push(e);
      else if (k === 'miner') L.miner.push(e);
      else if (k === 'machine') L.machine.push(e);
      else if (k === 'lab') L.lab.push(e);
      else if (k === 'storage' || k === 'depot') L.storage.push(e);
      else if (k === 'arm') L.arm.push(e);
      else if (k === 'horizon') L.horizon.push(e);
    }
    S.lists = L; S.listsVer = S.gridVer;
  };

  IE.step = function (S, dt) {
    if (!S.lists || S.listsVer !== S.gridVer) IE.rebuildLists(S);
    S._poll = 0;
    IE.updatePower(S, dt);
    const L = S.lists;
    for (const e of L.miner) IE.updateMiner(S, e, dt);
    for (const e of L.machine) IE.updateMachine(S, e, dt);
    for (const e of L.lab) IE.updateLab(S, e, dt);
    for (const e of L.storage) IE.updateStorage(S, e, dt);
    for (const e of L.arm) IE.updateArm(S, e, dt);
    for (const e of L.router) IE.updateRouter(S, e, dt);
    for (const e of L.belt) IE.updateBelt(S, e, dt);
    for (const e of L.horizon) updateHorizon(S, e, dt);
    IE.updateTransport(S, dt);
    IE.updateHandCraft(S, dt);
    // Contaminación: se acumula y se disipa
    const decay = S.choices.policy === 'limpia' ? 0.004 : 0.002;
    const pm = S.choices.policy === 'intensiva' ? 1.3 : 1;
    S.pollution = Math.max(0, S.pollution + S._poll * pm * 3 - S.pollution * decay * dt);
    S.time += dt; S.tick++;
    if (!S.victory) S.stats.playTime += dt;
    if (S.tick % 20 === 0) { sampleStats(S); IE.updateMissions(S); }
  };
})();
