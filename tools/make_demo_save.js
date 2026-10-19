// Genera una partida avanzada de ejemplo (Acto III, Era 4) usando la simulación real.
// Uso:  node tools/make_demo_save.js   →  partidas/partida-avanzada.json
const fs = require('fs');
const path = require('path');
const vm = require('vm');
globalThis.window = globalThis;
const ROOT = path.join(__dirname, '..');
for (const f of ['js/core.js', 'js/data/items.js', 'js/data/buildings.js', 'js/data/tech.js', 'js/data/story.js', 'js/world.js',
  'js/sim/state.js', 'js/sim/factory.js', 'js/sim/power.js', 'js/sim/transport.js', 'js/sim/progress.js', 'js/save.js'])
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
const IE = globalThis.IE;
const W = IE.MAP_W;

const S = IE.newState(20261019);
const wd = S.world;

// ---------- Progreso de campaña ----------
for (let r = 0; r <= 4; r++) { S.regions[r] = true; S.flags['region' + r] = true; }
Object.assign(S.flags, { bridges: true, act1_power: true, dam_restored: true, archive_restored: true, depot_restored: true, city_supplied: true, city_full: true });
S.choices.policy = 'limpia';
for (const id of IE.TECH_IDS) if (IE.TECH[id].era <= 3) S.tech[id] = true;
for (const id of ['t_era4', 't_robots', 't_batteries', 't_solar2', 't_wind2', 't_control', 't_evehicles']) S.tech[id] = true;
S.logs = ['log_wake', 'log_power', 'log_river', 'log_dam', 'log_archive', 'log_depot', 'log_city'];
const cur = IE.MISSIONS.findIndex(m => m.id === 'm_auto');
IE.MISSIONS.slice(0, cur).forEach(m => S.missions.done[m.id] = true);
S.missions.main = cur;
S.missions.done.s_depot = true; S.missions.done.s_belts = true;
for (const e of S.ents.values()) {
  if ((e.type === 'ruin' && ['dam', 'archive', 'depot'].includes(e.ruin)) || e.type === 'city') {
    const need = IE.demandOf(e); for (const k in need) e.got[k] = need[k]; e.done = true;
  }
}
S.research = { cur: 't_robots2', prog: 0, saved: {} };
S.inv = {
  piedra: 2400, madera: 600, carbon: 1500, mineral_hierro: 800, mineral_cobre: 600, cuarzo: 300,
  lingote_hierro: 1800, lingote_cobre: 1200, ladrillo: 900, acero: 700, silicio: 200,
  placa_hierro: 1600, engranaje: 900, cable: 1400, motor: 160, circuito: 520, motor_electrico: 120,
  combustible: 300, quimicos: 120, polimero: 180, bateria: 90, procesador: 40,
  ciencia1: 200, ciencia2: 150, ciencia3: 120, ciencia4: 40,
};

// ---------- Terreno de la zona industrial ----------
function clear(x0, y0, w, h, keepWater) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (!IE.inMap(x, y) || S.grid[y * W + x]) continue;
    const i = y * W + x;
    wd.feat[i] = 0; wd.res[i] = 0; wd.amt[i] = 0;
    if (wd.terr[i] === IE.TERR.ROCK || (!keepWater && wd.terr[i] === IE.TERR.WATER)) wd.terr[i] = IE.TERR.GRASS;
  }
}
function ore(res, x0, y0) { for (let y = y0; y < y0 + 2; y++) for (let x = x0; x < x0 + 2; x++) { wd.res[y * W + x] = IE.RES_ID[res]; wd.amt[y * W + x] = 20000; } }
clear(4, 56, 48, 42);
clear(50, 88, 30, 6, true);
const P = (type, x, y, rot, tier) => {
  const why = IE.canPlace(S, type, x, y, rot || 0, tier || 1);
  if (why) throw new Error(type + ' en ' + x + ',' + y + ': ' + why);
  return IE.placeEntity(S, type, x, y, rot || 0, tier || 1);
};
// Cinta en línea recta (incluye ambos extremos)
function belt(x0, y0, x1, y1, rot, tier) {
  const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
  let x = x0, y = y0;
  for (;;) { P('belt', x, y, rot, tier); if (x === x1 && y === y1) break; x += dx; y += dy; }
}

// Línea A: hierro → lingotes → placas → Núcleo (fila 68)
ore('mineral_hierro', 44, 68);
P('miner', 44, 68, 2, 3);
belt(43, 68, 43, 69, 2, 3);
P('furnace', 41, 68, 2, 3);
belt(40, 68, 40, 69, 2, 3);
P('assembler', 38, 68, 2, 3).recipe = 'a_placa';
P('belt', 37, 69, 3, 3);
belt(37, 68, 25, 68, 2, 3);

// Línea B: cobre → lingotes → cable → Núcleo (fila 71, entra por abajo)
ore('mineral_cobre', 44, 71);
P('miner', 44, 71, 2, 2);
belt(43, 71, 43, 72, 2, 2);
P('furnace', 41, 71, 2, 2);
belt(40, 71, 40, 72, 2, 2);
P('assembler', 38, 71, 2, 2).recipe = 'a_cable';
P('belt', 37, 72, 3, 2);
belt(37, 71, 25, 71, 2, 2);
P('belt', 24, 71, 3, 2);

// Línea C: hierro + carbón por entradas separadas → acero → Núcleo (entra por arriba)
ore('mineral_hierro', 44, 64); ore('carbon', 44, 66);
P('miner', 44, 64, 2, 2);
P('belt', 43, 64, 2, 2);
P('miner', 44, 66, 2, 2);
P('belt', 43, 66, 2, 2); P('belt', 42, 66, 3, 2);
const steel = P('furnace', 41, 64, 2, 2); steel.recipe = 'f_acero';
P('belt', 40, 65, 3, 2);
belt(40, 64, 24, 64, 2, 2);
belt(23, 64, 23, 67, 1, 2);

// Central: carbón → cinta → brazos → turbinas de vapor V3, más solar, eólica y baterías
ore('carbon', 40, 74);
P('miner', 40, 74, 1, 3);
P('belt', 41, 76, 2, 2);
belt(40, 76, 40, 88, 1, 2);
P('chest', 40, 89, 0, 2);
for (const y of [77, 80, 83, 86]) {
  P('steam', 42, y, 0, 3).inv = { carbon: 8 };
  P('arm', 41, y, 0, 2);
}
for (const x of [26, 28, 30, 32]) for (const y of [76, 78]) P('solar', x, y, 0, 2);
for (const x of [26, 29, 32]) P('wind', x, 81, 0, 2);
P('battery', 35, 76, 0, 2).stored = 20000;
P('battery', 35, 78, 0, 2).stored = 20000;
P('pole', 37, 80, 0, 3);
P('pole', 30, 85, 0, 3);
P('pole', 34, 66, 0, 3);
P('pole', 47, 66, 0, 3);

// Laboratorios alimentados por brazos desde un almacén de paquetes
const packs = P('chest', 30, 61, 0, 3);
packs.inv = { ciencia2: 600, ciencia3: 600, ciencia4: 600 };
P('lab', 27, 60, 0, 3); P('arm', 29, 61, 2, 2);
P('lab', 33, 60, 0, 3); P('arm', 32, 61, 0, 2);
P('lab', 30, 58, 0, 3); P('arm', 30, 60, 3, 2);

// Robots: almacén de placas → ensambladoras de engranajes, sin cintas
P('pole', 24, 60, 0, 3);
P('pole', 12, 65, 0, 3);
P('robohub', 12, 61, 0, 2);
const plates = P('chest', 16, 61, 0, 3); plates.inv = { placa_hierro: 3500 };
P('chest', 16, 63, 0, 2);
P('assembler', 8, 58, 0, 2).recipe = 'a_engranaje';
P('assembler', 12, 57, 0, 2).recipe = 'a_engranaje';
P('assembler', 16, 57, 0, 2).recipe = 'a_motor';

// Ferrocarril: estación del valle → al otro lado del río (Delta)
for (let x = 24; x <= 75; x++) P(x === 47 || x === 64 ? 'signal' : 'rail', x, 92, 0);
const stA = P('trainstop', 26, 90, 0, 1); stA.name = 'Estación Valle';
stA.inv = { lingote_hierro: 1200, combustible: 100 };
const stB = P('trainstop', 70, 90, 3, 1); stB.name = 'Estación Delta';
stB.filter = '*';
P('belt', 70, 89, 3, 2); P('chest', 70, 87, 0, 3);

// Carretera con dos camiones
for (let x = 24; x <= 50; x++) P('road', x, 96, 0);
const tA = P('truckstop', 24, 94, 0, 1); tA.name = 'Parada Mina';
tA.inv = { carbon: 600 };
const tB = P('truckstop', 48, 94, 0, 1); tB.name = 'Parada Taller';

IE.updateTransport(S, IE.TICK);
let err = IE.buyTrain(S, stA, 2, 1, 3);
if (err) throw new Error(err);
S.trains[0].sched = [{ stop: stA.id, act: 'load', cond: 'full', t: 30 }, { stop: stB.id, act: 'unload', cond: 'empty', t: 30 }];
for (let k = 0; k < 2; k++) {
  err = IE.buyTruck(S, tA, 2);
  if (err) throw new Error(err);
  S.trucks[k].route = [{ stop: tA.id, act: 'load', item: null }, { stop: tB.id, act: 'unload', item: null }];
}
S.inv = Object.assign(S.inv, { lingote_hierro: 1800, acero: 700, motor_electrico: 120, circuito: 520 });

// ---------- Simular unos minutos para que todo esté en marcha ----------
const secs = 240;
for (let i = 0; i < secs / IE.TICK; i++) {
  if (i % 400 === 0) { stA.inv.lingote_hierro = Math.max(stA.inv.lingote_hierro || 0, 900); tA.inv.carbon = Math.max(tA.inv.carbon || 0, 300); }
  IE.step(S, IE.TICK);
}
// Historial creíble de una partida de unas 3 horas
const extra = { piedra: 5200, carbon: 9800, mineral_hierro: 14200, mineral_cobre: 8100, lingote_hierro: 12600, lingote_cobre: 7400,
  ladrillo: 2100, acero: 1900, placa_hierro: 9800, engranaje: 4300, cable: 11800, circuito: 2300, motor: 640, motor_electrico: 310,
  ciencia1: 1400, ciencia2: 900, ciencia3: 520, polimero: 380, bateria: 140, procesador: 60 };
for (const k in extra) S.stats.produced[k] = (S.stats.produced[k] || 0) + extra[k];
S.stats.manual += 214; S.stats.truckDelivered += 2400; S.stats.trainDelivered += 3600;
S.stats.playTime = 3 * 3600 + 12 * 60;
S.time = 11520 + secs; // de día
S.speed = 1; S.paused = false;

// ---------- Informe ----------
const st = {};
for (const e of S.ents.values()) if (e.status && e.status !== 'ok') st[e.status] = (st[e.status] || 0) + 1;
console.log('Energía', Math.round(S.power.gen), 'kW generados /', Math.round(S.power.dem), 'kW demanda, satisfacción', S.power.sat.toFixed(2));
console.log('Estados', st);
console.log('Por minuto', ['placa_hierro', 'cable', 'acero', 'engranaje', 'motor'].map(k => k + ' ' + Math.round(IE.ratePerMin(S, k))).join(', '));
console.log('Tren:', S.trains[0].state, '· camiones:', S.trucks.map(v => v.state).join(', '), '· robots:', IE.robotCount(S));
for (const e of S.ents.values()) if (['Salida bloqueada', 'Faltan materiales', 'Esperando'].includes(e.status)) console.log('  ', e.type, 'V' + e.tier, e.x + ',' + e.y, e.status, e.recipe || '', JSON.stringify(e.inv || {}));
console.log('Investigado t_robots2:', !!S.tech.t_robots2);
// Siguiente investigación elegida por el jugador, ya empezada
S.research = { cur: 't_smartgrid', prog: 34, saved: {} };
for (let i = 0; i < 30 / IE.TICK; i++) IE.step(S, IE.TICK);
console.log('Laboratorios:', [...S.ents.values()].filter(e => e.type === 'lab').map(e => e.status).join(', '), '· progreso', S.research.prog.toFixed(1));
console.log('Misión', IE.currentMission(S).title, '· entidades', S.ents.size);

S.time = 11520; // por la mañana
const outDir = path.join(ROOT, 'partidas');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'partida-avanzada.json'), JSON.stringify(IE.serialize(S)));
console.log('Guardado en partidas/partida-avanzada.json');
