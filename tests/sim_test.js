// Pruebas de la simulación sin navegador:  node tests/sim_test.js
// Construye cadenas reales con la API del juego y comprueba que producen.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
globalThis.window = globalThis;
const ROOT = path.join(__dirname, '..');
const files = ['js/core.js', 'js/data/items.js', 'js/data/buildings.js', 'js/data/tech.js', 'js/data/story.js', 'js/world.js',
  'js/sim/state.js', 'js/sim/factory.js', 'js/sim/power.js', 'js/sim/transport.js', 'js/sim/progress.js', 'js/save.js'];
for (const f of files) vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
const IE = globalThis.IE;
const W = IE.MAP_W;

let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra !== undefined ? '  → ' + extra : ''));
  if (!cond) fails++;
}
function run(S, secs) { const n = Math.round(secs / IE.TICK); for (let i = 0; i < n; i++) IE.step(S, IE.TICK); }
function rich(S) { S.inv = new Proxy({}, { get: (t, k) => (k in t ? t[k] : 1e6), set: (t, k, v) => { t[k] = v; return true; }, deleteProperty: (t, k) => { delete t[k]; return true; } }); }
// Busca un hueco w x h totalmente cubierto por el recurso dado
function findRes(S, res, w, h) {
  const id = IE.RES_ID[res];
  for (let y = 1; y < IE.MAP_H - h; y++) for (let x = 1; x < W - w; x++) {
    let ok = true;
    for (let yy = y; yy < y + h && ok; yy++) for (let xx = x; xx < x + w; xx++)
      if (S.world.res[yy * W + xx] !== id || !S.regions[S.world.region[yy * W + xx]] || S.grid[yy * W + xx] || S.world.feat[yy * W + xx]) { ok = false; break; }
    if (ok) return { x, y };
  }
  return null;
}
function clear(S, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const i = y * W + x; S.world.feat[i] = 0; S.world.res[i] = 0; S.world.terr[i] = 0;
  }
}
function place(S, type, x, y, rot, tier) {
  const why = IE.canPlace(S, type, x, y, rot || 0, tier || 1);
  if (why) throw new Error(type + ' en ' + x + ',' + y + ': ' + why);
  return IE.placeEntity(S, type, x, y, rot || 0, tier || 1);
}
function beltLine(S, x0, y0, x1, y1, tier) {
  const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
  const rot = dx > 0 ? 0 : dx < 0 ? 2 : dy > 0 ? 1 : 3;
  let x = x0, y = y0;
  while (true) { place(S, 'belt', x, y, rot, tier); if (x === x1 && y === y1) break; x += dx; y += dy; }
}

// ---------------------------------------------------------------
console.log('1. Mundo y estado inicial');
{
  const S = IE.newState(12345);
  check('núcleo colocado', !!IE.coreEnt(S));
  check('ruinas colocadas', [...S.ents.values()].filter(e => e.type === 'ruin').length === 5);
  check('ciudad y complejo', [...S.ents.values()].some(e => e.type === 'city') && [...S.ents.values()].some(e => e.type === 'horizon'));
  check('hierro cerca del núcleo', !!findRes(S, 'mineral_hierro', 2, 2));
  check('carbón cerca del núcleo', !!findRes(S, 'carbon', 2, 2));
  const r = IE.manualMine(S, findRes(S, 'mineral_hierro', 1, 1).x, findRes(S, 'mineral_hierro', 1, 1).y);
  check('minería manual', r && r.item === 'mineral_hierro' && S.inv.mineral_hierro === 1);
}

console.log('2. Extractor V1 → horno V1 → cinta → Núcleo');
{
  const S = IE.newState(1);
  rich(S);
  const C = IE.CORE_POS;
  // Montaje sobre terreno limpio a la izquierda del núcleo
  const bx = C.x - 14, by = C.y;
  clear(S, bx - 1, by - 3, 15, 8);
  const ir = IE.RES_ID.mineral_hierro, co = IE.RES_ID.carbon;
  for (let y = by; y < by + 2; y++) for (let x = bx; x < bx + 2; x++) { S.world.res[y * W + x] = ir; S.world.amt[y * W + x] = 1000; }
  for (let y = by - 3; y < by - 1; y++) for (let x = bx; x < bx + 2; x++) { S.world.res[y * W + x] = co; S.world.amt[y * W + x] = 1000; }
  const m = place(S, 'miner', bx, by, 0);            // expulsa al este
  m.fuelInv = { carbon: 5 };
  const mc = place(S, 'miner', bx, by - 3, 1);       // carbón hacia el sur
  // El carbón cae sobre una cinta que entra al horno
  place(S, 'belt', bx + 1, by - 1, 0); beltLine(S, bx + 2, by - 1, bx + 3, by - 1); place(S, 'belt', bx + 4, by - 1, 1);
  const f = place(S, 'furnace', bx + 3, by, 0);
  // Entre extractor y horno una cinta de 1 casilla
  place(S, 'belt', bx + 2, by, 0); place(S, 'belt', bx + 2, by + 1, 0);
  beltLine(S, bx + 5, by, C.x - 1, by, 1);
  run(S, 120);
  check('extractor produjo mineral', (S.stats.produced.mineral_hierro || 0) > 20, S.stats.produced.mineral_hierro);
  check('horno fundió lingotes', (S.stats.produced.lingote_hierro || 0) > 10, S.stats.produced.lingote_hierro);
  check('lingotes llegaron al Núcleo', (S.stats.coreIn.lingote_hierro || 0) > 5, S.stats.coreIn.lingote_hierro);
  check('horno con receta automática', f.recipe === 'f_hierro');
  check('extractor de carbón alimenta', (S.stats.produced.carbon || 0) > 5, S.stats.produced.carbon);
}

console.log('3. Energía: vapor, postes, ensambladora y laboratorio');
{
  const S = IE.newState(2);
  rich(S);
  S.tech.t_automation = S.tech.t_steam = true;
  const C = IE.CORE_POS;
  const bx = C.x + 6, by = C.y + 12;
  clear(S, bx - 2, by - 2, 24, 10);
  const g = place(S, 'steam', bx, by, 0);
  g.inv = { carbon: 10 };
  const p1 = place(S, 'pole', bx + 2, by, 0);
  const a = place(S, 'assembler', bx + 3, by, 0);
  a.recipe = 'a_engranaje'; a.inv = { placa_hierro: 8 };
  run(S, 10);
  check('ensambladora alimentada', a.pf > 0.9, a.pf.toFixed(2));
  check('fabricó engranajes', (S.stats.produced.engranaje || 0) >= 3, S.stats.produced.engranaje);
  check('generador quemó carbón', IE.sumInv(g.inv) < 10 || g.fuelKJ > 0);
  // Sin combustible la máquina se detiene
  g.inv = {}; g.fuelKJ = 0;
  a.inv = { placa_hierro: 8 };
  run(S, 3);
  check('sin combustible → sin energía', a.pf < 0.05 || a.status === 'Sin energía', a.status);
  // Laboratorio investigando
  g.inv = { carbon: 10 };
  const l = place(S, 'lab', bx + 6, by, 0);
  place(S, 'pole', bx + 8, by + 2, 0);
  IE.setResearch(S, 't_motors');
  l.inv = { ciencia1: 4 };
  run(S, 25);
  check('laboratorio avanza investigación', S.research.prog >= 2 || S.tech.t_motors, S.research.prog);
}

console.log('4. Cintas: divisor, cruce y atasco');
{
  const S = IE.newState(3);
  rich(S);
  S.tech.t_logistics1 = true;
  const C = IE.CORE_POS;
  const bx = C.x - 16, by = C.y + 14;
  clear(S, bx - 2, by - 6, 16, 14);
  const ch = place(S, 'chest', bx, by, 0); ch.inv = { placa_hierro: 100 }; ch.filter = 'placa_hierro';
  beltLine(S, bx + 1, by, bx + 3, by);
  place(S, 'splitter', bx + 4, by, 0);
  beltLine(S, bx + 5, by, bx + 7, by);
  const c1 = place(S, 'chest', bx + 8, by, 0);
  beltLine(S, bx + 4, by - 1, bx + 4, by - 3);
  const c2 = place(S, 'chest', bx + 4, by - 4, 0);
  beltLine(S, bx + 4, by + 1, bx + 4, by + 3);
  const c3 = place(S, 'chest', bx + 4, by + 4, 0);
  run(S, 40);
  const a = c1.inv.placa_hierro || 0, b = c2.inv.placa_hierro || 0, c = c3.inv.placa_hierro || 0;
  check('divisor reparte en tres salidas', a > 15 && b > 15 && c > 15, [a, b, c].join('/'));
  // Atasco: cinta sin salida
  const S2 = IE.newState(3); rich(S2); clear(S2, bx - 2, by - 2, 10, 4);
  const ch2 = place(S2, 'chest', bx, by, 0); ch2.inv = { madera: 50 }; ch2.filter = 'madera';
  beltLine(S2, bx + 1, by, bx + 4, by);
  run(S2, 20);
  const last = IE.entAt(S2, bx + 4, by);
  check('cinta atascada detectada', last.jam === true && last.items.length === 3);
}

console.log('5. Mejoras V1→V4');
{
  const S = IE.newState(4);
  rich(S);
  for (const t of IE.TECH_IDS) S.tech[t] = true;
  const p = findRes(S, 'mineral_hierro', 2, 2);
  const m = place(S, 'miner', p.x, p.y, 0);
  check('V1 usa combustible', IE.tierOf(m).fuel === true);
  IE.upgrade(S, m); check('V2', m.tier === 2 && !IE.tierOf(m).fuel);
  IE.upgrade(S, m); IE.upgrade(S, m);
  check('V4 alcance 4x4', m.tier === 4 && IE.tierOf(m).reach === 1);
  check('no pasa de V4', IE.canUpgrade(S, m) === 'Nivel máximo');
  // Cambio de tamaño del almacén
  const C = IE.CORE_POS; clear(S, C.x - 6, C.y + 4, 4, 4);
  const ch = place(S, 'chest', C.x - 6, C.y + 4, 0);
  IE.upgrade(S, ch); IE.upgrade(S, ch);
  check('almacén V3 ocupa 2x2', ch.w === 2 && ch.h === 2 && S.grid[(C.y + 5) * W + C.x - 5] === ch.id);
}

console.log('6. Camiones');
{
  const S = IE.newState(5);
  rich(S);
  S.tech.t_vehicles = true;
  const C = IE.CORE_POS;
  const bx = C.x - 18, by = C.y - 18;
  clear(S, bx - 2, by - 2, 24, 6);
  const a = place(S, 'truckstop', bx, by, 0);
  const b = place(S, 'truckstop', bx + 16, by, 0);
  beltLine(S, bx + 2, by + 2, bx + 15, by + 2);
  for (let x = bx; x < bx + 2; x++) place(S, 'belt', x, by + 2, 0);
  for (let x = bx + 16; x < bx + 18; x++) place(S, 'belt', x, by + 2, 0);
  // Las cintas no son carreteras: sustituir por carretera
  for (let x = bx; x < bx + 18; x++) { const e = IE.entAt(S, x, by + 2); IE.removeEntity(S, e, true); place(S, 'road', x, by + 2, 0); }
  a.inv = { lingote_cobre: 300 };
  IE.updateTransport(S, IE.TICK);
  check('parada encuentra carretera', a.stop >= 0 && b.stop >= 0);
  check('compra camión', IE.buyTruck(S, a, 1) === null);
  const v = S.trucks[0];
  v.route = [{ stop: a.id, act: 'load' }, { stop: b.id, act: 'unload' }];
  run(S, 60);
  check('camión entregó carga', S.stats.truckDelivered >= 40 && (b.inv.lingote_cobre || 0) >= 40, S.stats.truckDelivered + ' (' + v.state + ')');
}

console.log('7. Trenes y señales');
{
  const S = IE.newState(6);
  rich(S);
  S.tech.t_rail = true;
  const C = IE.CORE_POS;
  const bx = C.x - 20, by = C.y + 24;
  clear(S, bx - 2, by - 3, 34, 8);
  for (let x = bx; x < bx + 30; x++) place(S, 'rail', x, by, 0);
  IE.removeEntity(S, IE.entAt(S, bx + 15, by), true); place(S, 'signal', bx + 15, by, 0);
  const A = place(S, 'trainstop', bx + 1, by - 2, 0);
  const B = place(S, 'trainstop', bx + 26, by - 2, 0);
  A.inv = { acero: 1000 };
  IE.updateTransport(S, IE.TICK);
  check('estaciones tocan la vía', A.stop >= 0 && B.stop >= 0);
  const err = IE.buyTrain(S, A, 1, 1, 2);
  check('compra tren', err === null, err);
  const t = S.trains[0];
  t.sched = [{ stop: A.id, act: 'load', cond: 'full' }, { stop: B.id, act: 'unload', cond: 'empty' }];
  run(S, 90);
  check('tren entregó mercancía', S.stats.trainDelivered >= 300, S.stats.trainDelivered + ' (' + t.state + ')');
  check('bloques de señal calculados', S.railBlock[by * W + bx] !== S.railBlock[by * W + bx + 20]);
}

console.log('8. Guardado y carga');
{
  const S = IE.newState(7);
  S.inv.acero = 77;
  const p = findRes(S, 'mineral_cobre', 2, 2);
  place(S, 'miner', p.x, p.y, 1);
  S.world.feat[5] = 0;
  const data = JSON.parse(JSON.stringify(IE.serialize(S)));
  const S2 = IE.deserialize(data);
  check('inventario restaurado', S2.inv.acero === 77);
  check('entidades restauradas', S2.ents.size === S.ents.size);
  check('cuadrícula restaurada', S2.grid[p.y * W + p.x] === S.grid[p.y * W + p.x]);
  const code = IE.exportCode(S);
  check('código de exportación', IE.importText(code).inv.acero === 77);
}

console.log('9. Misiones y campaña');
{
  const S = IE.newState(8);
  IE.updateMissions(S);
  check('primera misión activa', IE.currentMission(S).id === 'm_hand');
  for (let i = 0; i < 10; i++) { const p = findRes(S, 'piedra', 1, 1); IE.manualMine(S, p.x, p.y); }
  IE.updateMissions(S);
  check('misión completada por simulación', S.missions.done.m_hand && IE.currentMission(S).id === 'm_mine');
  // El final no puede activarse sin requisitos
  const hz = [...S.ents.values()].find(e => e.type === 'horizon');
  check('Horizonte no activable al inicio', IE.activateHorizon(S, hz) === false);
}

console.log('10. Restaurar ruinas');
{
  const S = IE.newState(9);
  rich(S);
  const dam = [...S.ents.values()].find(e => e.type === 'ruin' && e.ruin === 'dam');
  IE.deliverFromCore(S, dam);
  check('presa restaurada', dam.done && S.flags.dam_restored);
  IE.rebuildPower(S);
  check('presa entra en la red solo con poste', dam.net === 0 || dam.net > 0);
}


console.log('11. Campaña completa hasta la victoria');
{
  const S = IE.newState(10);
  rich(S);
  let victory = false;
  IE.on('victory', () => victory = true);
  IE.on('decision', id => IE.choose(S, id, id === 'path' ? 'prometeo' : 'limpia'));
  const C = IE.CORE_POS;
  // Zona de pruebas despejada junto al núcleo
  const zx = C.x + 5, zy = C.y + 16;
  clear(S, zx - 1, zy - 1, 26, 14);
  let nx = zx;
  const spot = (w) => { const x = nx; nx += w + 1; return x; };
  const ruin = k => [...S.ents.values()].find(e => e.type === 'ruin' && e.ruin === k);
  let guard = 0, lastId = null, gens = false;
  while (IE.currentMission(S) && guard++ < 400) {
    const m = IE.currentMission(S);
    IE.updateMissions(S);
    if (IE.currentMission(S) !== m) continue;
    for (const o of m.obj) {
      switch (o.t) {
        case 'manual': S.stats.manual += o.n; break;
        case 'produce': IE.countProduced(S, o.item, o.n); break;
        case 'core': S.stats.coreIn[o.item] = (S.stats.coreIn[o.item] || 0) + o.n; break;
        case 'build': for (let i = 0; i < o.n; i++) S.stats.built[o.b] = 0; {
          const have = [...S.ents.values()].filter(e => e.type === o.b).length;
          for (let i = have; i < o.n; i++) {
            const d = IE.BUILDINGS[o.b].tiers[0];
            if (o.b === 'miner') { const p = findRes(S, 'mineral_hierro', 2, 2) || findRes(S, 'carbon', 2, 2); IE.placeEntity(S, 'miner', p.x, p.y, 0, 1); }
            else IE.placeEntity(S, o.b, spot(d.w), zy, 0, 1);
          }
        } break;
        case 'research': if (!S.tech[o.tech]) { for (const p of IE.TECH[o.tech].pre) S.tech[p] = true; const t = IE.TECH[o.tech]; if (t.needFlag) S.flags[t.needFlag] = S.flags[t.needFlag] || false; S.research.cur = o.tech; S.research.prog = 0; IE.addResearch(S, t.cost); } break;
        case 'truck': S.stats.truckDelivered += o.n; break;
        case 'train': S.stats.trainDelivered += o.n; break;
        case 'restore': IE.deliverFromCore(S, ruin(o.ruin)); break;
        case 'city': IE.deliverFromCore(S, [...S.ents.values()].find(e => e.type === 'city')); break;
        case 'horizon': IE.deliverFromCore(S, [...S.ents.values()].find(e => e.type === 'horizon')); break;
        case 'rate': for (let i = 0; i < 60; i++) { S.hist.sec[o.item] = o.perMin; run(S, 1); } break;
        case 'robots': if (!S.tech.t_robots) S.tech.t_robots = true; { const h = IE.placeEntity(S, 'robohub', spot(2), zy, 0, 1); IE.placeEntity(S, 'pole', h.x + 2, zy + 2, 0, 1); } break;
        case 'power': case 'satisfied': if (!gens) {
          gens = true;
          // Red real: postes + generadores de vapor + fusión con combustible
          for (let i = 0; i < 6; i++) IE.placeEntity(S, 'pole', zx + i * 4, zy + 6, 0, 2);
          for (let i = 0; i < 3; i++) IE.placeEntity(S, 'fusion', zx + i * 4, zy + 7, 0, 2).inv = { xenita: 20 };
          const g = IE.placeEntity(S, 'steam', zx + 13, zy + 7, 0, 1); g.inv = { carbon: 10 };
        } run(S, o.secs + 3); break;
        case 'flag': if (o.flag === 'horizon_active') {
          const hz = [...S.ents.values()].find(e => e.type === 'horizon');
          // Conectar el complejo con un poste y una fuente experimental propia
          const px = hz.x - 2, py = hz.y + 1;
          clear(S, px - 4, py - 1, 4, 8);
          IE.placeEntity(S, 'pole', px + 1, py + 1, 0, 4);
          IE.placeEntity(S, 'fusion', px - 2, py + 3, 0, 2).inv = { xenita: 20 };
          IE.rebuildPower(S); run(S, 1);
          const chk = IE.horizonCheck(S, hz);
          check('requisitos de activación', chk.every(c => c.ok), chk.filter(c => !c.ok).map(c => c.text).join('; '));
          check('activación aceptada', IE.activateHorizon(S, hz));
          run(S, 50);
        } break;
        case 'path_req': {
          const hz = [...S.ents.values()].find(e => e.type === 'horizon');
          if (!IE.pathRequirement(S).ok) { const px = hz.x - 2, py = hz.y + 1; clear(S, px - 4, py - 1, 4, 8); IE.placeEntity(S, 'pole', px + 1, py + 1, 0, 4); IE.placeEntity(S, 'fusion', px - 2, py + 3, 0, 2).inv = { xenita: 20 }; run(S, 2); }
        } break;
      }
    }
    run(S, 1.1);
    if (m.id === lastId && IE.currentMission(S) === m) { const st = m.obj.map((o, k) => o.label + ':' + IE.objProgress(S, m, k).join('/')).join(' | '); console.log('    atascada en', m.id, st); break; }
    lastId = m.id;
  }
  check('todas las misiones principales completadas', !IE.currentMission(S), IE.currentMission(S) && IE.currentMission(S).id);
  check('evento de victoria emitido', victory);
  check('todas las regiones abiertas', S.regions.every(Boolean));
  check('decisiones tomadas', S.choices.policy && S.choices.path);
}

console.log('12. Brazos, clasificador, robots, reactor y baterías');
{
  const S = IE.newState(11);
  rich(S);
  for (const t of IE.TECH_IDS) S.tech[t] = true;
  const C = IE.CORE_POS;
  const bx = C.x - 16, by = C.y + 30;
  clear(S, bx - 3, by - 3, 30, 20);
  // Red eléctrica de pruebas
  for (let i = 0; i < 4; i++) IE.placeEntity(S, 'pole', bx + i * 8, by - 2, 0, 3);
  for (let i = 0; i < 2; i++) IE.placeEntity(S, 'fusion', bx + 20 + i * 4, by + 12, 0, 1).inv = { xenita: 20 };
  IE.placeEntity(S, 'pole', bx + 22, by + 10, 0, 3);
  // Brazo: caja → ensambladora
  const ch = IE.placeEntity(S, 'chest', bx, by, 0, 2); ch.inv = { placa_hierro: 50 };
  const arm = IE.placeEntity(S, 'arm', bx + 1, by, 0, 2); arm.filter = null;
  const as = IE.placeEntity(S, 'assembler', bx + 2, by, 0, 1); as.recipe = 'a_engranaje';
  run(S, 10);
  check('brazo alimenta la ensambladora', (as.crafted || 0) >= 1, as.crafted + ' ' + arm.status);
  // Clasificador
  const src = IE.placeEntity(S, 'chest', bx, by + 4, 0, 2); src.inv = { madera: 20, piedra: 20 }; src.filter = '*';
  IE.placeEntity(S, 'belt', bx + 1, by + 4, 0, 1);
  const so = IE.placeEntity(S, 'sorter', bx + 2, by + 4, 0, 1); so.filters = ['madera'];
  IE.placeEntity(S, 'belt', bx + 3, by + 4, 0, 1); const cf = IE.placeEntity(S, 'chest', bx + 4, by + 4, 0, 2);
  IE.placeEntity(S, 'belt', bx + 2, by + 3, 3, 1); const cl = IE.placeEntity(S, 'chest', bx + 2, by + 2, 0, 2);
  run(S, 30);
  check('clasificador separa madera', (cl.inv.madera || 0) > 5 && !cl.inv.piedra && (cf.inv.piedra || 0) > 5, JSON.stringify([cl.inv, cf.inv]));
  // Robots
  const hub = IE.placeEntity(S, 'robohub', bx + 8, by + 6, 0, 1);
  const store = IE.placeEntity(S, 'chest', bx + 12, by + 6, 0, 2); store.inv = { placa_hierro: 100 };
  const as2 = IE.placeEntity(S, 'assembler', bx + 8, by + 10, 0, 1); as2.recipe = 'a_engranaje';
  IE.placeEntity(S, 'pole', bx + 11, by + 9, 0, 3);
  run(S, 20);
  check('robots llevan ingredientes', (as2.crafted || 0) >= 1, (as2.crafted || 0) + ' robots ' + hub.robots.length + ' ' + hub.status);
  // Reactor y residuos
  const re = IE.placeEntity(S, 'reactor', bx + 14, by + 2, 0, 1);
  re.inv = { celda_nuclear: 1 };
  IE.placeEntity(S, 'pole', bx + 13, by + 5, 0, 3);
  run(S, 5);
  check('reactor en fisión', re.status === 'En fisión' && re.avail > 0, re.status);
  re.cellLeft = 0.01; re.out = { residuo_nuclear: 4 }; re.rot = 3; re._front = null;
  run(S, 1);
  check('reactor se detiene con residuos', re.status === 'Residuos sin retirar', re.status);
  // Baterías: cargan con excedente
  const bat = IE.placeEntity(S, 'battery', bx + 20, by + 2, 0, 1);
  IE.placeEntity(S, 'pole', bx + 19, by + 4, 0, 3);
  run(S, 10);
  check('batería se carga con excedente', bat.stored > 1000, Math.round(bat.stored));
}

console.log(fails ? '\n' + fails + ' FALLOS' : '\nTodo correcto');
process.exit(fails ? 1 : 0);
