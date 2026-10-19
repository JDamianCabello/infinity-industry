// Transporte: camiones por carretera, trenes por vías con bloques de señales y robots logísticos.
(function () {
  const IE = window.IE;
  const W = IE.MAP_W, H = IE.MAP_H, DX = IE.DX, DY = IE.DY;

  // Búsqueda en anchura sobre la cuadrícula. passable(i) decide las casillas válidas.
  IE.bfs = function (start, goal, passable, banned) {
    if (start === goal) return [];
    const prev = new Int32Array(W * H).fill(-1);
    const q = new Int32Array(W * H);
    let h = 0, t = 0;
    q[t++] = start; prev[start] = start;
    while (h < t) {
      const c = q[h++];
      const cx = c % W, cy = (c / W) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (prev[n] !== -1 || n === banned || !passable(n)) continue;
        prev[n] = c;
        if (n === goal) {
          const path = [];
          let k = n;
          while (k !== start) { path.push(k); k = prev[k]; }
          return path.reverse();
        }
        q[t++] = n;
      }
    }
    return null;
  };

  const isType = (S, i, types) => { const e = S.ents.get(S.grid[i]); return e && types.includes(e.type); };
  IE.isRoad = (S, i) => isType(S, i, ['road']);
  IE.isRail = (S, i) => isType(S, i, ['rail', 'signal']);

  // Casilla de parada de un depósito: primera carretera/vía adyacente
  IE.depotStop = function (S, e) {
    const want = IE.BUILDINGS[e.type].depot === 'truck' ? IE.isRoad : IE.isRail;
    for (let y = e.y - 1; y <= e.y + e.h; y++) for (let x = e.x - 1; x <= e.x + e.w; x++) {
      const corner = (x === e.x - 1 || x === e.x + e.w) && (y === e.y - 1 || y === e.y + e.h);
      if (corner || !IE.inMap(x, y)) continue;
      if (x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h) continue;
      const i = y * W + x;
      if (want(S, i)) return i;
    }
    return -1;
  };
  function refreshStops(S, kind) {
    for (const e of S.ents.values()) if (IE.BUILDINGS[e.type].depot === kind) e.stop = IE.depotStop(S, e);
  }

  // Transferencia entre depósito y vehículo. Devuelve objetos movidos.
  function transfer(S, depot, cargo, capLeft, act, maxN, filter) {
    let moved = 0;
    if (act === 'load') {
      for (const k in depot.inv) {
        if (filter && k !== filter) continue;
        while (moved < maxN && capLeft - moved > 0 && depot.inv[k] > 0) {
          depot.inv[k]--; cargo[k] = (cargo[k] || 0) + 1; moved++;
        }
        if (depot.inv[k] <= 0) delete depot.inv[k];
        if (moved >= maxN) break;
      }
    } else {
      const cap = IE.tierOf(depot).cap;
      let room = cap - IE.sumInv(depot.inv);
      for (const k in cargo) {
        if (filter && k !== filter) continue;
        while (moved < maxN && room > 0 && cargo[k] > 0) {
          cargo[k]--; depot.inv[k] = (depot.inv[k] || 0) + 1; moved++; room--;
        }
        if (cargo[k] <= 0) delete cargo[k];
      }
    }
    return moved;
  }
  // Repostar vehículos de combustible desde el depósito
  function refuel(depot, v, maxE) {
    for (const f of ['combustible', 'carbon', 'madera']) {
      while (v.energy < maxE * 0.9 && depot.inv[f] > 0) {
        depot.inv[f]--; v.energy += IE.ITEMS[f].fuel; if (depot.inv[f] <= 0) delete depot.inv[f];
      }
    }
  }

  // ---------- Camiones ----------
  IE.buyTruck = function (S, depot, tier) {
    const T = IE.TRUCKS[tier];
    if (!IE.techDone(S, T.tech)) return 'Investiga ' + IE.TECH[T.tech].name;
    if (!IE.canAfford(S, T.cost)) return 'Faltan materiales';
    if (depot.stop < 0) return 'La parada no toca ninguna carretera';
    IE.pay(S, T.cost);
    const i = depot.stop;
    S.trucks.push({ id: S.nextId++, tier, x: i % W, y: (i / W) | 0, tile: i, path: null, pi: 0, ang: 0,
      route: [{ stop: depot.id, act: 'load', item: null }], ri: 0, cargo: {}, energy: T.energy, state: 'Esperando', wait: 0, idle: 0 });
    return null;
  };

  function updateTruck(S, v, dt) {
    const T = IE.TRUCKS[v.tier];
    if (!v.route.length) { v.state = 'Sin ruta'; return; }
    const stopEnt = S.ents.get(v.route[v.ri % v.route.length].stop);
    if (!stopEnt) { v.route.splice(v.ri % v.route.length, 1); v.path = null; return; }
    const goal = stopEnt.stop;
    if (goal < 0) { v.state = 'Parada sin carretera'; return; }
    if (v.tile === goal && !v.path) {
      // En la parada: cargar / descargar
      const step = v.route[v.ri % v.route.length];
      if (T.fuel) refuel(stopEnt, v, T.energy);
      else if (stopEnt.net && v.energy < T.energy) {
        stopEnt.dem = (stopEnt.dem || 0) + T.charge;
        v.energy = Math.min(T.energy, v.energy + T.charge * (stopEnt.pf || 0) * dt);
      }
      v.acc = (v.acc || 0) + IE.tierOf(stopEnt).xfer * dt;
      const n = Math.floor(v.acc);
      v.acc -= n;
      const capLeft = T.cap - IE.sumInv(v.cargo);
      const moved = n > 0 ? transfer(S, stopEnt, v.cargo, capLeft, step.act, n, step.item) : 0;
      if (step.act === 'unload') S.stats.truckDelivered += moved;
      v.state = step.act === 'load' ? 'Cargando' : 'Descargando';
      if (moved > 0) v.idle = 0; else v.idle += dt;
      const done = step.act === 'load' ? IE.sumInv(v.cargo) >= T.cap : IE.sumInv(v.cargo) === 0;
      const charged = T.fuel || v.energy > T.energy * 0.6 || !stopEnt.net;
      if ((done || v.idle > (T.smart ? 0.5 : 4)) && charged) { v.ri = (v.ri + 1) % v.route.length; v.idle = 0; }
      return;
    }
    if (!v.path) {
      v.path = IE.bfs(v.tile, goal, i => IE.isRoad(S, i));
      v.pi = 0;
      if (!v.path) { v.state = 'Sin camino'; v.path = null; v.retry = (v.retry || 0) + dt; if (v.retry > 3) { v.retry = 0; v.ri = (v.ri + 1) % v.route.length; } return; }
    }
    if (v.energy <= 0) { v.state = 'Sin combustible'; return; }
    v.state = 'En ruta';
    let move = T.speed * dt;
    while (move > 0 && v.pi < v.path.length) {
      const n = v.path[v.pi];
      if (!IE.isRoad(S, n)) { v.path = null; return; }
      const tx = n % W, ty = (n / W) | 0;
      const dx = tx - v.x, dy = ty - v.y, dist = Math.hypot(dx, dy);
      if (dist > 1e-4) v.ang = Math.atan2(dy, dx);
      if (dist <= move) { v.x = tx; v.y = ty; v.tile = n; v.pi++; move -= dist; v.energy -= T.use; }
      else { v.x += dx / dist * move; v.y += dy / dist * move; move = 0; }
    }
    if (v.pi >= v.path.length) v.path = null;
  }

  // ---------- Trenes ----------
  IE.rebuildRail = function (S) {
    S.dirty.rail = false;
    const blk = S.railBlock = new Int32Array(W * H);
    let id = 0;
    for (const e of S.ents.values()) {
      if (e.type !== 'rail') continue;
      const s = e.y * W + e.x;
      if (blk[s]) continue;
      id++;
      const st = [s]; blk[s] = id;
      while (st.length) {
        const c = st.pop(), cx = c % W, cy = (c / W) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = cx + DX[d], ny = cy + DY[d];
          if (!IE.inMap(nx, ny)) continue;
          const n = ny * W + nx;
          if (blk[n]) continue;
          const ne = S.ents.get(S.grid[n]);
          if (ne && ne.type === 'rail') { blk[n] = id; st.push(n); }
        }
      }
    }
    S.blockRes = {};
    refreshStops(S, 'train');
    // Reconstruir ocupación
    S.trainOcc = new Int32Array(W * H);
    for (const t of S.trains) for (const i of t.tiles) S.trainOcc[i] = t.id;
    for (const t of S.trains) { t.path = null; t.res = []; }
  };

  IE.buyTrain = function (S, depot, locoTier, wagonTier, nW) {
    const L = IE.LOCOS[locoTier], Wg = IE.WAGONS[wagonTier];
    if (!IE.techDone(S, L.tech)) return 'Investiga ' + IE.TECH[L.tech].name;
    if (!IE.techDone(S, Wg.tech)) return 'Investiga ' + IE.TECH[Wg.tech].name;
    if (nW < 1 || nW > L.maxWagons) return 'Esta locomotora arrastra 1-' + L.maxWagons + ' vagones';
    const cost = Object.assign({}, L.cost);
    for (const k in Wg.cost) cost[k] = (cost[k] || 0) + Wg.cost[k] * nW;
    if (!IE.canAfford(S, cost)) return 'Faltan materiales';
    if (S.dirty.rail || !S.railBlock) IE.rebuildRail(S);
    if (depot.stop < 0) return 'La estación no toca ninguna vía';
    // Buscar un tramo de vía libre desde la estación
    const tiles = [depot.stop];
    const occ = S.trainOcc;
    if (occ[depot.stop]) return 'Hay un tren en la estación';
    while (tiles.length < nW + 1) {
      const c = tiles[tiles.length - 1], cx = c % W, cy = (c / W) | 0;
      let nxt = -1;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (!IE.inMap(nx, ny)) continue;
        const n = ny * W + nx;
        if (tiles.includes(n) || occ[n] || !IE.isRail(S, n)) continue;
        nxt = n; break;
      }
      if (nxt < 0) return 'No hay vía suficiente junto a la estación (' + (nW + 1) + ' casillas)';
      tiles.push(nxt);
    }
    IE.pay(S, cost);
    const t = { id: S.nextId++, loco: locoTier, wagons: new Array(nW).fill(wagonTier), tiles, prog: 0, v: 0, path: null, pi: 0,
      sched: [{ stop: depot.id, act: 'load', cond: 'full', t: 30 }], si: 0, cargo: {}, energy: L.energy, state: 'Esperando', wait: 0, idle: 0, res: [] };
    S.trains.push(t);
    for (const i of tiles) occ[i] = t.id;
    return null;
  };
  IE.trainCap = t => t.wagons.reduce((s, w) => s + IE.WAGONS[w].cap, 0);

  function releaseBlocks(S, t, keep) {
    const under = new Set();
    for (const i of t.tiles) { const b = S.railBlock[i]; if (b) under.add(b); }
    if (keep) under.add(keep);
    t.res = t.res.filter(b => {
      if (under.has(b)) return true;
      if (S.blockRes[b] === t.id) delete S.blockRes[b];
      return false;
    });
    for (const b of under) { if (!S.blockRes[b]) S.blockRes[b] = t.id; if (S.blockRes[b] === t.id && !t.res.includes(b)) t.res.push(b); }
  }

  function updateTrain(S, t, dt) {
    const L = IE.LOCOS[t.loco];
    if (t.derailed) { t.state = 'Descarrilado: retíralo'; return; }
    if (!t.sched.length) { t.state = 'Sin horario'; return; }
    const step = t.sched[t.si % t.sched.length];
    const st = S.ents.get(step.stop);
    if (!st) { t.sched.splice(t.si % t.sched.length, 1); t.path = null; return; }
    const head = t.tiles[0];
    if (st.stop < 0) { t.state = 'Estación sin vía'; return; }
    if (head === st.stop && !t.path) {
      t.v = 0;
      if (L.fuel) refuel(st, t, L.energy);
      else if (st.net && t.energy < L.energy) {
        st.dem = (st.dem || 0) + L.charge;
        t.energy = Math.min(L.energy, t.energy + L.charge * (st.pf || 0) * dt);
      }
      t.acc = (t.acc || 0) + IE.tierOf(st).xfer * dt;
      const n = Math.floor(t.acc); t.acc -= n;
      const cap = IE.trainCap(t);
      const moved = n > 0 ? transfer(S, st, t.cargo, cap - IE.sumInv(t.cargo), step.act, n, step.item) : 0;
      if (step.act === 'unload') S.stats.trainDelivered += moved;
      t.wait += dt;
      t.state = (step.act === 'load' ? 'Cargando' : 'Descargando') + ' en estación';
      let go = false;
      if (step.cond === 'full') go = IE.sumInv(t.cargo) >= cap;
      else if (step.cond === 'empty') go = IE.sumInv(t.cargo) === 0;
      else go = t.wait >= (step.t || 30);
      if (moved > 0) t.idle = 0; else t.idle += dt;
      if (step.cond !== 'time' && t.idle > 60) go = true; // evita bloqueos eternos
      const charged = L.fuel || t.energy > L.energy * 0.5 || !st.net;
      if (go && charged && t.sched.length > 1) { t.si = (t.si + 1) % t.sched.length; t.wait = 0; t.idle = 0; }
      return;
    }
    if (!t.path) {
      const pass = i => IE.isRail(S, i) && S.trainOcc[i] !== t.id;
      let p = IE.bfs(head, st.stop, pass, t.tiles[1]);
      if (!p && t.tiles.length > 1) {
        // Cambio de sentido (locomotora reversible)
        const rev = t.tiles.slice().reverse();
        const p2 = IE.bfs(rev[0], st.stop, pass, rev[1]);
        if (p2) { t.tiles = rev; p = p2; t.prog = 0; }
      }
      if (!p) { t.state = 'Sin ruta hasta ' + (st.name || 'la estación'); t.retry = (t.retry || 0) + dt; if (t.retry > 5) { t.retry = 0; if (t.sched.length > 1) t.si = (t.si + 1) % t.sched.length; } return; }
      t.path = p; t.pi = 0;
    }
    if (t.energy <= 0) { t.state = 'Sin combustible'; t.v = 0; return; }
    const next = t.path[t.pi];
    if (next == null) { t.path = null; return; }
    if (!IE.isRail(S, next)) { t.path = null; return; }
    // Señales: reserva de bloque y ocupación
    const occ = S.trainOcc[next];
    const b = S.railBlock[next];
    const myBlock = S.railBlock[t.tiles[0]];
    if ((occ && occ !== t.id) || (b && b !== myBlock && S.blockRes[b] && S.blockRes[b] !== t.id)) {
      t.v = 0; t.state = occ ? 'Vía ocupada por otro tren' : 'Esperando señal';
      t.blockedT = (t.blockedT || 0) + dt;
      if (t.blockedT > 20) { t.blockedT = 0; t.path = null; }
      return;
    }
    t.blockedT = 0;
    if (b && !S.blockRes[b]) { S.blockRes[b] = t.id; t.res.push(b); }
    // Aceleración y frenado al acercarse a la estación
    const remaining = t.path.length - t.pi - t.prog;
    const vmax = Math.min(L.speed, Math.max(1.2, remaining * 1.5));
    t.v = Math.min(vmax, t.v + 3 * dt);
    t.prog += t.v * dt;
    t.state = 'En marcha';
    while (t.prog >= 1) {
      t.prog -= 1;
      const nx = t.path[t.pi];
      t.tiles.unshift(nx);
      const old = t.tiles.pop();
      if (S.trainOcc[old] === t.id) S.trainOcc[old] = 0;
      S.trainOcc[nx] = t.id;
      t.energy -= L.use * (1 + t.wagons.length * 0.3);
      t.pi++;
      releaseBlocks(S, t, t.path[t.pi] != null ? S.railBlock[t.path[t.pi]] : 0);
      if (t.pi >= t.path.length) { t.path = null; t.prog = 0; break; }
      const n2 = t.path[t.pi];
      const o2 = S.trainOcc[n2], b2 = S.railBlock[n2];
      if ((o2 && o2 !== t.id) || (b2 && b2 !== S.railBlock[nx] && S.blockRes[b2] && S.blockRes[b2] !== t.id)) { t.prog = 0; break; }
    }
  }

  IE.removeTrain = function (S, t) {
    for (const i of t.tiles) if (S.trainOcc[i] === t.id) S.trainOcc[i] = 0;
    for (const b of t.res) if (S.blockRes[b] === t.id) delete S.blockRes[b];
    S.trains = S.trains.filter(x => x !== t);
    const L = IE.LOCOS[t.loco];
    IE.refund(S, L.cost);
    t.wagons.forEach(w => IE.refund(S, IE.WAGONS[w].cost));
    for (const k in t.cargo) IE.invAdd(S, k, t.cargo[k]);
  };
  IE.removeTruck = function (S, v) {
    S.trucks = S.trucks.filter(x => x !== v);
    IE.refund(S, IE.TRUCKS[v.tier].cost);
    for (const k in v.cargo) IE.invAdd(S, k, v.cargo[k]);
  };

  // ---------- Robots logísticos ----------
  function inRadius(hub, e, r) {
    const cx = hub.x + hub.w / 2, cy = hub.y + hub.h / 2;
    return Math.abs(e.x + e.w / 2 - cx) <= r && Math.abs(e.y + e.h / 2 - cy) <= r;
  }
  function updateHub(S, hub, dt) {
    const t = IE.tierOf(hub);
    while (hub.robots.length < t.robots) hub.robots.push({ x: hub.x + 1, y: hub.y + 1, st: 'idle' });
    const active = hub.robots.some(r => r.st !== 'idle');
    hub.dem = t.power * (active ? 1 : 0.2) * IE.powerMul(S);
    const pf = hub.pf;
    hub.status = pf < 0.05 ? 'Sin energía' : active ? 'Robots trabajando' : 'Robots en espera';
    if (pf < 0.05) return;
    hub.scan = (hub.scan || 0) - dt;
    if (hub.scan <= 0) {
      hub.scan = 0.5;
      const idle = hub.robots.filter(r => r.st === 'idle');
      if (idle.length) {
        const near = [];
        for (const e of S.ents.values()) if (e !== hub && inRadius(hub, e, t.radius)) near.push(e);
        const stores = near.filter(e => IE.BUILDINGS[e.type].kind === 'storage');
        const busy = new Set(hub.robots.filter(r => r.st !== 'idle').map(r => r.dst + ':' + r.item));
        for (const e of near) {
          if (!idle.length) break;
          const kind = IE.BUILDINGS[e.type].kind;
          // Abastecer ingredientes
          if (kind === 'machine' && e.recipe) {
            const r = IE.RECIPE[e.recipe];
            for (const k in r.in) {
              if ((e.inv[k] || 0) >= r.in[k] * 2 || busy.has(e.id + ':' + k)) continue;
              const src = stores.find(s => s.inv[k] > 0);
              if (!src) continue;
              const rb = idle.pop();
              Object.assign(rb, { st: 'src', src: src.id, dst: e.id, item: k, n: Math.max(r.in[k] * 3, 4) - (e.inv[k] || 0), carry: 0 });
              busy.add(e.id + ':' + k);
              if (!idle.length) break;
            }
          }
          // Retirar producción
          if ((kind === 'machine' || kind === 'miner') && idle.length) {
            for (const k in e.out) {
              if (e.out[k] < 4 || busy.has('o' + e.id + ':' + k)) continue;
              const dst = stores.find(s => s.inv[k] > 0 && IE.sumInv(s.inv) < IE.tierOf(s).cap) || stores.find(s => IE.sumInv(s.inv) < IE.tierOf(s).cap);
              if (!dst) continue;
              const rb = idle.pop();
              Object.assign(rb, { st: 'src', src: e.id, dst: dst.id, item: k, n: 10, carry: 0, pick: true });
              busy.add('o' + e.id + ':' + k);
              break;
            }
          }
        }
      }
    }
    const sp = t.rspeed * pf * dt;
    for (const r of hub.robots) {
      if (r.st === 'idle') { r.x += (hub.x + 0.5 - r.x) * 0.1; r.y += (hub.y + 0.5 - r.y) * 0.1; continue; }
      const target = S.ents.get(r.st === 'src' ? r.src : r.st === 'dst' ? r.dst : hub.id);
      if (!target) { r.st = r.st === 'home' ? 'idle' : 'home'; continue; }
      const tx = target.x + target.w / 2 - 0.5, ty = target.y + target.h / 2 - 0.5;
      const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
      r.ang = Math.atan2(dy, dx);
      if (d > sp) { r.x += dx / d * sp; r.y += dy / d * sp; continue; }
      r.x = tx; r.y = ty;
      if (r.st === 'src') {
        const pool = r.pick ? target.out : target.inv;
        const n = Math.min(r.n, (pool && pool[r.item]) || 0);
        if (n > 0) { pool[r.item] -= n; if (pool[r.item] <= 0) delete pool[r.item]; r.carry = n; r.st = 'dst'; }
        else r.st = 'home';
      } else if (r.st === 'dst') {
        while (r.carry > 0 && IE.acceptItem(S, target, r.item)) r.carry--;
        if (r.carry > 0) { r.st = 'back'; r.back = r.src; } else r.st = 'home';
      } else if (r.st === 'home') r.st = 'idle';
      if (r.st === 'back') {
        const src = S.ents.get(r.back);
        const pool = src ? (r.pick ? src.out : src.inv) : null;
        if (pool) pool[r.item] = (pool[r.item] || 0) + r.carry; else IE.invAdd(S, r.item, r.carry);
        r.carry = 0; r.st = 'home';
      }
    }
  }
  IE.robotCount = S => {
    let n = 0;
    for (const e of S.ents.values()) if (e.type === 'robohub' && e.pf > 0.05) n += e.robots.length;
    return n;
  };

  IE.updateTransport = function (S, dt) {
    if (S.dirty.rail || !S.railBlock) IE.rebuildRail(S);
    if (S.dirty.road) { S.dirty.road = false; refreshStops(S, 'truck'); S.trucks.forEach(v => v.path = null); }
    for (const e of S.ents.values()) if (IE.BUILDINGS[e.type].kind === 'depot') e.dem = 0;
    for (const v of S.trucks) updateTruck(S, v, dt);
    for (const t of S.trains) updateTrain(S, t, dt);
    for (const e of S.ents.values()) if (e.type === 'robohub') updateHub(S, e, dt);
  };
})();
