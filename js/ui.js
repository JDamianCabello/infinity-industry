// Interfaz: barra superior, barra de construcción, panel de información, paneles modales,
// diálogos de ATLAS, decisiones, notificaciones y secuencia final.
(function () {
  const IE = window.IE;
  const A = IE.Assets;
  const W = IE.MAP_W;
  const UI = IE.UI = {
    mode: 'select', place: null, selected: null, selVeh: null, ghost: null, drag: null, tap: null,
    cat: 'extraccion', tierSel: {}, modal: null, dialogQ: [], view: 'normal',
  };
  let S = null;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const iconURL = (() => { const m = new Map(); return (id, size) => { const k = id + size; if (!m.has(k)) { const c = A.icon(id, size || 32); m.set(k, toURL(c)); } return m.get(k); }; })();
  function toURL(c) {
    if (c.toDataURL) return c.toDataURL();
    const d = document.createElement('canvas'); d.width = c.width; d.height = c.height; d.getContext('2d').drawImage(c, 0, 0); return d.toDataURL();
  }
  const bIconURL = (() => { const m = new Map(); return (type, tier) => { const k = type + tier; if (!m.has(k)) m.set(k, toURL(A.buildIcon(type, tier))); return m.get(k); }; })();
  UI.iconURL = iconURL;
  const ic = (id, n, cls) => `<span class="it ${cls || ''}" title="${esc(IE.ITEMS[id] ? IE.ITEMS[id].name : id)}"><img src="${iconURL(id)}" alt="">${n !== undefined ? '<b>' + IE.fmtNum(n) + '</b>' : ''}</span>`;
  const costHTML = (cost, have) => Object.keys(cost).map(k => ic(k, cost[k], have && (S.inv[k] || 0) < cost[k] ? 'lack' : '')).join('');
  UI.ic = ic;

  // ---------- Inicialización ----------
  UI.init = function (state) {
    S = state;
    buildCats();
    $('tools').addEventListener('click', ev => {
      const b = ev.target.closest('[data-tool]');
      if (!b) return;
      const t = b.dataset.tool;
      if (t === 'rotate') UI.rotate();
      else if (t === 'cancel') UI.cancel();
      else UI.setMode(UI.mode === t ? 'select' : t);
    });
    $('cats').addEventListener('click', ev => { const b = ev.target.closest('[data-cat]'); if (b) { UI.cat = b.dataset.cat; buildItems(); markCats(); } });
    $('items').addEventListener('click', ev => {
      const t = ev.target.closest('[data-tier]');
      if (t) { ev.stopPropagation(); cycleTier(t.dataset.type); return; }
      const b = ev.target.closest('[data-build]');
      if (b) UI.startBuild(b.dataset.build);
    });
    $('side').addEventListener('click', ev => {
      const b = ev.target.closest('[data-side]');
      if (!b) return;
      const v = b.dataset.side;
      if (['power', 'logistics', 'production', 'problems'].includes(v)) { UI.view = IE.Render.view = IE.Render.view === v ? 'normal' : v; markSide(); toast(viewName(IE.Render.view)); }
      else UI.openModal(v);
    });
    $('top').addEventListener('click', ev => {
      const b = ev.target.closest('[data-top]');
      if (!b) return;
      const v = b.dataset.top;
      if (v === 'pause') UI.togglePause();
      else if (v === 'speed') { const sp = [1, 2, 4]; S.speed = sp[(sp.indexOf(S.speed) + 1) % sp.length]; S.paused = false; }
      else UI.openModal(v);
    });
    $('mission').addEventListener('click', () => UI.openModal('missions'));
    const info = $('info');
    info.addEventListener('pointerdown', () => { UI.infoTouch = true; });
    window.addEventListener('pointerup', () => { setTimeout(() => UI.infoTouch = false, 120); });
    info.addEventListener('click', ev => { const b = ev.target.closest('[data-a]'); if (b) act(b.dataset, b); });
    info.addEventListener('change', ev => { const b = ev.target.closest('[data-a]'); if (b) act(Object.assign({}, b.dataset, { value: b.value }), b); });
    $('modal').addEventListener('click', ev => {
      if (ev.target.id === 'modal') { UI.closeModal(); return; }
      const b = ev.target.closest('[data-a]'); if (b) act(b.dataset, b);
    });
    $('modal').addEventListener('change', ev => { const b = ev.target.closest('[data-a]'); if (b) act(Object.assign({}, b.dataset, { value: b.value }), b); });
    $('dialog').addEventListener('click', ev => { const b = ev.target.closest('[data-a]'); if (b) act(b.dataset, b); else nextDialog(); });

    IE.on('dialog', d => { UI.dialogQ.push(d); if (UI.dialogQ.length === 1) showDialog(); });
    IE.on('missionDone', m => toast('✅ Misión completada: ' + m.title, 'good'));
    IE.on('researched', t => { toast('🔬 Investigado: ' + t.name, 'good'); buildItems(); });
    IE.on('restored', d => {
      if (d.ruin) { toast('🏛 Restaurado: ' + d.ruin.name, 'good'); if (d.ruin.log) UI.dialogQ.push({ title: IE.LOGS[d.ruin.log].title, lines: [IE.LOGS[d.ruin.log].text] }); if (UI.dialogQ.length === 1) showDialog(); }
      if (d.city) toast('🌆 Nueva Aurora abastecida', 'good');
      if (d.horizon) toast('🌐 Complejo Horizonte construido', 'good');
    });
    IE.on('region', r => toast('🗺 Nueva región: ' + IE.REGIONS[r].name, 'good'));
    IE.on('decision', id => showDecision(id));
    IE.on('victory', () => setTimeout(() => IE.Cinematic.play(S), 1200));
    // Tocar un icono muestra el nombre del objeto
    document.addEventListener('click', ev => {
      const it = ev.target.closest('.it');
      if (it && it.title && !ev.target.closest('button')) toast(it.title, null, 1400);
    });
    $('items').addEventListener('pointerdown', () => { UI.barTouch = true; });
    window.addEventListener('pointerup', () => setTimeout(() => UI.barTouch = false, 200));
    UI.setMode('select');
    UI.refresh();
  };
  UI.setState = s => { S = s; UI.selected = null; UI.selVeh = null; UI.cancel(); buildItems(); UI.refresh(); };

  function viewName(v) { return { normal: 'Vista normal', power: 'Vista: redes eléctricas', logistics: 'Vista: transporte', production: 'Vista: producción', problems: 'Vista: problemas logísticos' }[v]; }

  // ---------- Barra de construcción ----------
  function buildCats() {
    $('cats').innerHTML = IE.CATEGORIES.map(c => `<button data-cat="${c.id}">${c.name}</button>`).join('');
    markCats(); buildItems();
  }
  function markCats() { [...$('cats').children].forEach(b => b.classList.toggle('on', b.dataset.cat === UI.cat)); }
  function bestTier(type) {
    const def = IE.BUILDINGS[type];
    let t = 0;
    def.tiers.forEach((d, i) => { if (IE.techDone(S, d.tech)) t = i + 1; });
    return t;
  }
  function selTier(type) {
    const b = bestTier(type);
    const s = UI.tierSel[type];
    return s && s <= b ? s : b;
  }
  function cycleTier(type) {
    const b = bestTier(type);
    if (b <= 1) return;
    const cur = selTier(type);
    UI.tierSel[type] = cur >= b ? 1 : cur + 1;
    if (UI.place && UI.place.type === type) UI.place.tier = UI.tierSel[type];
    buildItems();
  }
  function buildItems() {
    if (!S) return;
    const html = itemsHTML();
    if (html !== UI._itemsHTML) { $('items').innerHTML = html; UI._itemsHTML = html; }
  }
  function itemsHTML() {
    const list = Object.values(IE.BUILDINGS).filter(d => d.cat === UI.cat && !d.special);
    return list.map(d => {
      const b = bestTier(d.id);
      if (!b) {
        const t = d.tiers[0].tech;
        return `<div class="bitem locked"><img src="${bIconURL(d.id, 1)}"><span>${esc(d.name)}</span><small>🔒 ${esc(IE.TECH[t].name)}</small></div>`;
      }
      const tier = selTier(d.id), td = d.tiers[tier - 1];
      const ok = IE.canAfford(S, IE.costOf(S, d.id, tier));
      const on = UI.place && UI.place.type === d.id;
      return `<div class="bitem ${on ? 'on' : ''} ${ok ? '' : 'poor'}" data-build="${d.id}"><img src="${bIconURL(d.id, tier)}"><span>${esc(td.name)}</span>
        ${d.tiers.length > 1 ? `<i class="tier t${tier}" data-tier="1" data-type="${d.id}">V${tier}${b > 1 ? ' ⇄' : ''}</i>` : ''}<div class="cost">${costHTML(IE.costOf(S, d.id, tier), true)}</div></div>`;
    }).join('');
  }
  UI.buildItems = buildItems;

  UI.startBuild = function (type) {
    const tier = selTier(type);
    if (!tier) return;
    if (UI.place && UI.place.type === type) { UI.cancel(); return; }
    UI.place = { type, tier, rot: UI.place ? UI.place.rot : 0 };
    UI.mode = 'build';
    UI.selected = null; UI.selVeh = null;
    markTools(); buildItems(); hideInfo();
    const def = IE.BUILDINGS[type];
    toast(def.line ? 'Arrastra para trazar · ↻ gira' : 'Toca el mapa para colocar · ↻ gira', null, 1800);
  };
  UI.setMode = function (m) {
    UI.mode = m; UI.place = null; UI.ghost = null;
    markTools(); buildItems();
    if (m === 'hand') toast('✋ Toca recursos, árboles o rocas. Mantén pulsado para repetir.', null, 2200);
    if (m === 'demolish') toast('🗑 Toca o arrastra sobre lo que quieras retirar. Se recuperan los materiales.', null, 2200);
  };
  function markTools() {
    [...$('tools').querySelectorAll('[data-tool]')].forEach(b => b.classList.toggle('on', b.dataset.tool === UI.mode));
    $('tools').querySelector('[data-tool=cancel]').style.display = (UI.mode !== 'select') ? '' : 'none';
  }
  UI.cancel = function () {
    if (UI.modal) { UI.closeModal(); return; }
    UI.place = null; UI.ghost = null; UI.drag = null;
    if (UI.mode !== 'select') UI.setMode('select');
    else { UI.selected = null; UI.selVeh = null; hideInfo(); }
  };
  UI.rotate = function () {
    if (UI.place) { UI.place.rot = (UI.place.rot + 1) % 4; if (UI.ghost) UI.onHover(UI.lastHover || { x: 0, y: 0 }); return; }
    const e = UI.selected && S.ents.get(UI.selected);
    if (e && !IE.BUILDINGS[e.type].special && e.w === e.h) {
      e.rot = (e.rot + 1) % 4; e._front = null;
      IE.onGridChange(S, e);
      UI.refreshInfo(true);
    }
  };
  UI.togglePause = () => { S.paused = !S.paused; UI.refresh(); };

  // ---------- Interacción con el mapa ----------
  UI.wantsDrag = function () {
    if (UI.mode === 'demolish') return true;
    return UI.mode === 'build' && UI.place && IE.BUILDINGS[UI.place.type].line;
  };
  function placeOrigin(type, tier, rot, tile) {
    const d = IE.dims(type, tier, rot);
    return { x: tile.x - Math.floor((d.w - 1) / 2), y: tile.y - Math.floor((d.h - 1) / 2) };
  }
  UI.onHover = function (tile) {
    UI.lastHover = tile;
    if (UI.mode !== 'build' || !UI.place || UI.drag) return;
    const p = UI.place, o = placeOrigin(p.type, p.tier, p.rot, tile);
    const why = IE.canPlace(S, p.type, o.x, o.y, p.rot, p.tier) || (IE.canAfford(S, IE.costOf(S, p.type, p.tier)) ? null : 'Faltan materiales');
    UI.ghost = { type: p.type, tier: p.tier, tiles: [{ x: o.x, y: o.y, rot: p.rot, ok: !why }], reason: why };
  };
  UI.onTap = function (tile, repeat) {
    if (UI.mode === 'hand') {
      const r = IE.manualMine(S, tile.x, tile.y);
      UI.tap = { x: tile.x, y: tile.y, t: performance.now() / 1000, item: r && r.item };
      if (!r && !repeat) {
        const e = IE.entAt(S, tile.x, tile.y);
        if (e) { UI.setMode('select'); select(e); }
      }
      return;
    }
    if (UI.mode === 'build' && UI.place) {
      const p = UI.place, o = placeOrigin(p.type, p.tier, p.rot, tile);
      const why = IE.canPlace(S, p.type, o.x, o.y, p.rot, p.tier);
      const cost = IE.costOf(S, p.type, p.tier);
      if (why) {
        // Tocar una cinta existente con la herramienta de cinta la reorienta
        const ex = IE.entAt(S, tile.x, tile.y);
        if (ex && ex.type === p.type && ex.w === 1) { ex.rot = p.rot; IE.onGridChange(S, ex); return; }
        toast(why, 'bad'); UI.ghost = { type: p.type, tier: p.tier, tiles: [{ x: o.x, y: o.y, rot: p.rot, ok: false }], reason: why }; return;
      }
      if (!IE.canAfford(S, cost)) { toast('Faltan materiales: ' + missingText(cost), 'bad'); return; }
      IE.pay(S, cost);
      const e = IE.placeEntity(S, p.type, o.x, o.y, p.rot, p.tier);
      afterPlace(e);
      UI.ghost = { type: p.type, tier: p.tier, tiles: [{ x: o.x, y: o.y, rot: p.rot, ok: true }] };
      buildItems();
      return;
    }
    if (UI.mode === 'demolish') { demolishAt(tile); return; }
    // Selección: vehículos primero
    const v = vehicleAt(tile);
    if (v) { UI.selVeh = v; UI.selected = null; UI.refreshInfo(true); return; }
    const e = IE.entAt(S, tile.x, tile.y);
    if (e) select(e); else { UI.selected = null; UI.selVeh = null; hideInfo(); }
  };
  function select(e) { UI.selected = e.id; UI.selVeh = null; UI.refreshInfo(true); }
  UI.select = select;
  function vehicleAt(tile) {
    for (const v of S.trucks) if (Math.abs(v.x - tile.x) < 0.8 && Math.abs(v.y - tile.y) < 0.8) return { kind: 'truck', id: v.id };
    for (const t of S.trains) for (const i of t.tiles) if (i === tile.y * W + tile.x) return { kind: 'train', id: t.id };
    return null;
  }
  function afterPlace(e) {
    const def = IE.BUILDINGS[e.type];
    if (def.kind === 'depot') {
      const n = [...S.ents.values()].filter(x => x.type === e.type).length;
      e.name = (e.type === 'truckstop' ? 'Parada ' : 'Estación ') + n;
    }
    if (def.kind === 'machine' && def.mclass === 'assembler' && UI.lastRecipe) {
      const r = IE.RECIPE[UI.lastRecipe];
      if (r && r.m === 'assembler' && r.tier <= e.tier && IE.recipeUnlocked(S, r)) e.recipe = r.id;
    }
  }
  function missingText(cost) { return Object.keys(cost).filter(k => (S.inv[k] || 0) < cost[k]).map(k => IE.ITEMS[k].name + ' ' + (S.inv[k] || 0) + '/' + cost[k]).join(', '); }
  function demolishAt(tile) {
    const e = IE.entAt(S, tile.x, tile.y);
    if (!e) {
      const v = vehicleAt(tile);
      if (v) { if (v.kind === 'truck') IE.removeTruck(S, S.trucks.find(x => x.id === v.id)); else IE.removeTrain(S, S.trains.find(x => x.id === v.id)); toast('Vehículo retirado'); }
      return;
    }
    if (IE.BUILDINGS[e.type].special) { toast('No se puede demoler ' + IE.BUILDINGS[e.type].name, 'bad'); return; }
    if ((e.type === 'rail' || e.type === 'signal') && S.trainOcc && S.trainOcc[e.y * W + e.x]) { toast('Hay un tren encima', 'bad'); return; }
    IE.removeEntity(S, e);
    if (UI.selected === e.id) { UI.selected = null; hideInfo(); }
    buildItems();
  }

  // Trazado de líneas (cintas, carreteras, vías)
  function linePath(a, b) {
    const pts = [];
    const dx = b.x - a.x, dy = b.y - a.y;
    const horizFirst = Math.abs(dx) >= Math.abs(dy);
    const sx = Math.sign(dx), sy = Math.sign(dy);
    let x = a.x, y = a.y;
    pts.push({ x, y });
    if (horizFirst) { while (x !== b.x) { x += sx; pts.push({ x, y }); } while (y !== b.y) { y += sy; pts.push({ x, y }); } }
    else { while (y !== b.y) { y += sy; pts.push({ x, y }); } while (x !== b.x) { x += sx; pts.push({ x, y }); } }
    for (let i = 0; i < pts.length; i++) {
      const n = pts[i + 1], p = pts[i - 1];
      let r;
      if (n) r = n.x > pts[i].x ? 0 : n.x < pts[i].x ? 2 : n.y > pts[i].y ? 1 : 3;
      else if (p) r = pts[i].x > p.x ? 0 : pts[i].x < p.x ? 2 : pts[i].y > p.y ? 1 : 3;
      else r = UI.place.rot;
      pts[i].rot = r;
    }
    return pts;
  }
  UI.onDragStart = function (tile) {
    UI.drag = { a: tile, b: tile };
    if (UI.mode === 'demolish') { UI.drag.done = new Set(); demolishDrag(tile); return; }
    updateLineGhost();
  };
  function demolishDrag(tile) {
    const k = tile.y * W + tile.x;
    if (UI.drag.done.has(k)) return;
    UI.drag.done.add(k);
    const e = IE.entAt(S, tile.x, tile.y);
    if (e && !IE.BUILDINGS[e.type].special) demolishAt(tile);
  }
  UI.onDrag = function (tile) {
    if (!UI.drag) return;
    if (UI.mode === 'demolish') { demolishDrag(tile); return; }
    UI.drag.b = tile; updateLineGhost();
  };
  function updateLineGhost() {
    const p = UI.place;
    const pts = linePath(UI.drag.a, UI.drag.b);
    const cost = IE.costOf(S, p.type, p.tier);
    let budget = Object.assign({}, S.inv);
    UI.ghost = { type: p.type, tier: p.tier, tiles: pts.map(q => {
      let ok = !IE.canPlace(S, p.type, q.x, q.y, q.rot, p.tier);
      const ex = IE.entAt(S, q.x, q.y);
      if (!ok && ex && ex.type === p.type) ok = true;
      else if (ok) { for (const k in cost) { if ((budget[k] || 0) < cost[k]) ok = false; } if (ok) for (const k in cost) budget[k] -= cost[k]; }
      return Object.assign({}, q, { ok });
    }) };
    if (pts.length > 1) p.rot = pts[pts.length - 1].rot;
  }
  UI.onDragEnd = function (tile, moved) {
    if (!UI.drag) return;
    if (UI.mode === 'demolish') { UI.drag = null; return; }
    if (!moved) { UI.drag = null; UI.onTap(tile); return; }
    const p = UI.place;
    const pts = linePath(UI.drag.a, UI.drag.b);
    const cost = IE.costOf(S, p.type, p.tier);
    let n = 0, lack = false;
    for (const q of pts) {
      const ex = IE.entAt(S, q.x, q.y);
      if (ex && ex.type === p.type) { if (ex.rot !== q.rot) { ex.rot = q.rot; IE.onGridChange(S, ex); } continue; }
      if (IE.canPlace(S, p.type, q.x, q.y, q.rot, p.tier)) continue;
      if (!IE.canAfford(S, cost)) { lack = true; break; }
      IE.pay(S, cost);
      IE.placeEntity(S, p.type, q.x, q.y, q.rot, p.tier);
      n++;
    }
    if (lack) toast('Faltan materiales: ' + missingText(cost), 'bad');
    UI.drag = null; UI.ghost = null;
    buildItems();
  };
  UI.onDragCancel = function () { UI.drag = null; UI.ghost = null; };

  // ---------- Panel de información ----------
  function hideInfo() { $('info').classList.remove('show'); UI.infoKey = ''; }
  const statusClass = s => IE.Render.BAD[s] ? 'warn' : 'okc';
  function bar(f, col) { return `<div class="bar"><i style="width:${Math.round(IE.clamp(f, 0, 1) * 100)}%;${col ? 'background:' + col : ''}"></i></div>`; }
  function invHTML(o, empty) {
    const ks = Object.keys(o || {}).filter(k => o[k] > 0);
    return ks.length ? ks.map(k => ic(k, o[k])).join('') : `<small class="dim">${empty || 'vacío'}</small>`;
  }
  function powerLine(e) {
    if (!IE.isElectric(e)) return '';
    if (!e.net) return `<div class="row warn">⚡ Sin conexión a la red: coloca un poste cerca</div>`;
    const net = S.nets && S.nets.get(e.net);
    return `<div class="row">⚡ Red ${e.net}: ${net ? IE.fmtPower(net.gen) + ' / ' + IE.fmtPower(net.dem) + ' · ' + Math.round(net.sat * 100) + '%' : ''}${e.dem ? ' · consumo ' + IE.fmtPower(e.dem * e.pf) : ''}</div>`;
  }
  function upgradeHTML(e) {
    const def = IE.BUILDINGS[e.type];
    if (def.special || def.tiers.length < 2) return '';
    const nt = e.tier + 1;
    if (nt > def.tiers.length) return `<div class="row dim">Nivel máximo alcanzado</div>`;
    const nd = def.tiers[nt - 1];
    const why = IE.canUpgrade(S, e);
    return `<div class="upg"><div><b>Mejorar a V${nt}: ${esc(nd.name)}</b><br><small>${esc(nd.pros || '')} ${nd.cons ? '· ' + esc(nd.cons) : ''}</small><div class="cost">${costHTML(IE.costOf(S, e.type, nt), true)}</div></div>
      <button data-a="upgrade" ${why ? 'disabled' : ''}>${why ? esc(why) : 'Mejorar'}</button></div>`;
  }
  function tierStats(e) {
    const t = IE.tierOf(e), def = IE.BUILDINGS[e.type];
    const out = [];
    if (t.rate && def.kind === 'miner') out.push('⛏ ' + IE.fmtNum(t.rate * 60 * IE.speedMul(S)) + '/min');
    if (t.speed && def.kind !== 'belt') out.push('⚙ velocidad ' + t.speed + 'x');
    if (t.speed && def.kind === 'belt') out.push('➜ ' + (t.speed * t.cap).toFixed(1) + ' obj/s');
    if (t.power) out.push((t.fuel ? '🔥 ' : '⚡ ') + IE.fmtPower(t.power) + (t.fuel ? ' de combustible' : ''));
    if (t.out) out.push('⚡ hasta ' + IE.fmtPower(t.out));
    if (t.cap && def.kind !== 'belt') out.push('📦 ' + t.cap);
    if (t.capKJ) out.push('🔋 ' + IE.fmtEnergy(t.capKJ) + ' · ' + IE.fmtPower(t.rateKW));
    if (t.poll) out.push('🏭 contamina');
    return out.length ? `<div class="row dim">${out.join(' · ')}</div>` : '';
  }
  function itemSelect(a, cur, allowAll, list) {
    const items = list || IE.ITEM_IDS;
    return `<select data-a="${a}"><option value="">— ninguno —</option>${allowAll ? `<option value="*" ${cur === '*' ? 'selected' : ''}>Todo</option>` : ''}${items.map(k => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(IE.ITEMS[k].name)}</option>`).join('')}</select>`;
  }
  function knownItems() { return IE.ITEM_IDS.filter(k => S.stats.produced[k] || S.inv[k]); }

  function entityHTML(e) {
    const def = IE.BUILDINGS[e.type], t = IE.tierOf(e), kind = def.kind;
    const name = kind === 'ruin' ? IE.RUINS[e.ruin].name : (e.name || t.name);
    let h = `<div class="ihead"><img src="${def.special ? '' : bIconURL(e.type, e.tier)}" ${def.special ? 'style="display:none"' : ''}><div><b>${esc(name)}</b>${def.tiers.length > 1 ? ` <i class="tier t${e.tier}">V${e.tier}</i>` : ''}<br><small class="${statusClass(e.status)}">${esc(e.status && e.status !== 'ok' ? e.status : (def.desc || ''))}</small></div><button class="x" data-a="close">✕</button></div>`;
    h += tierStats(e);
    switch (kind) {
      case 'core':
        h += `<div class="row">Reserva de emergencia: ${IE.fmtPower(60)} · Almacén central de la colonia</div><div class="inv big">${invHTML(S.inv)}</div>
          <div class="btns"><button data-a="modal" data-m="craft">🔧 Taller (fabricar a mano)</button></div>`;
        break;
      case 'miner': {
        const res = {};
        if (e.tiles) for (const i of e.tiles) { const r = S.world.res[i]; if (r) res[IE.RES[r]] = (res[IE.RES[r]] || 0) + S.world.amt[i]; }
        h += `<div class="row">Yacimiento: ${invHTML(res, 'agotado')}</div><div class="row">Salida: ${invHTML(e.out)}</div>${bar(e.prog)}`;
        if (t.fuel) h += fuelHTML(e);
        break;
      }
      case 'machine': {
        const r = e.recipe && IE.RECIPE[e.recipe];
        const recs = IE.machineRecipes(S, e);
        h += `<div class="recs">${def.autoRecipe ? `<button data-a="recipe" data-r="" class="${!e.recipe || e.autoSet ? 'on' : ''}">Auto</button>` : ''}${recs.map(rc => {
          const out = Object.keys(rc.out)[0];
          return `<button data-a="recipe" data-r="${rc.id}" class="${e.recipe === rc.id && !e.autoSet ? 'on' : ''} ${rc.tier > e.tier ? 'lock' : ''}" title="${esc(rc.name)}"><img src="${iconURL(out)}">${rc.tier > e.tier ? '<small>V' + rc.tier + '</small>' : ''}</button>`;
        }).join('')}</div>`;
        if (r) {
          h += `<div class="row"><b>${esc(r.name)}</b></div><div class="recipe">${Object.keys(r.in).map(k => ic(k, r.in[k])).join('')} <span>➜ ${(r.t / (t.speed * IE.speedMul(S))).toFixed(1)}s ➜</span> ${Object.keys(r.out).map(k => ic(k, r.out[k])).join('')}</div>`;
          h += `<div class="row">Entrada: ${invHTML(e.inv)}</div>${bar(e.prog)}<div class="row">Salida: ${invHTML(e.out)}</div>`;
          h += `<div class="row dim">Fabricados: ${e.crafted || 0}</div>`;
        }
        if (t.fuel) h += fuelHTML(e);
        break;
      }
      case 'lab': {
        const tech = S.research.cur && IE.TECH[S.research.cur];
        h += tech ? `<div class="row">🔬 ${esc(tech.name)} · necesita ${tech.packs.map(p => ic(p)).join('')}</div>${bar(S.research.prog / tech.cost)}` : `<div class="row warn">Sin investigación activa</div>`;
        h += `<div class="row">Paquetes: ${invHTML(e.inv)}</div><div class="btns"><button data-a="modal" data-m="research">Abrir investigación</button></div>`;
        break;
      }
      case 'storage': case 'depot': {
        h += `<div class="row">${IE.sumInv(e.inv)} / ${t.cap}</div><div class="inv">${invHTML(e.inv)}</div>`;
        h += `<div class="row">Expulsar por el frente: ${itemSelect('filter', e.filter, true, knownItems())}</div>`;
        if (kind === 'depot') h += depotHTML(e);
        break;
      }
      case 'gen': {
        const ld = t.out ? (e.outKW || 0) / t.out : 0;
        h += `<div class="row">Producción: ${IE.fmtPower(e.outKW || 0)} / ${IE.fmtPower(e.avail || 0)} disponibles</div>${bar(ld)}`;
        if (def.gen === 'fuel' || def.gen === 'fusion') h += `<div class="row">Combustible: ${invHTML(e.inv)} ${e.fuelKJ ? '· ' + IE.fmtEnergy(e.fuelKJ) : ''}</div><div class="btns"><button data-a="fuel">Añadir combustible desde el Núcleo</button><button data-a="toggle">${e.on ? 'Apagar' : 'Encender'}</button></div>`;
        if (def.gen === 'nuclear') h += `<div class="row">Celdas: ${e.inv.celda_nuclear || 0} · celda actual ${Math.round(e.cellLeft || 0)} s · residuos ${(e.out && e.out.residuo_nuclear) || 0}/4</div><div class="row dim">El reactor quema celdas aunque no haya demanda. Retira los residuos con cinta o brazo por el frente.</div><div class="btns"><button data-a="cell">Cargar celda desde el Núcleo</button><button data-a="toggle">${e.on ? 'Apagar' : 'Encender'}</button></div>`;
        if (def.gen === 'solar') h += `<div class="row dim">Luz: ${Math.round(IE.daylight(S) * 100)}% · contaminación −${Math.round(IE.smog(S) * 100)}%</div>`;
        if (def.gen === 'wind') h += `<div class="row dim">Viento: ${Math.round(IE.wind(S) * 100)}%</div>`;
        if (def.gen === 'hydro') h += `<div class="row dim">Agua junto a la central: ${e.water || 0} casillas</div>`;
        h += powerLine(e);
        break;
      }
      case 'battery': h += `<div class="row">Carga: ${IE.fmtEnergy(e.stored)} / ${IE.fmtEnergy(t.capKJ)}</div>${bar(e.stored / t.capKJ, '#3fe07a')}` + powerLine(e); break;
      case 'pole': {
        const net = S.nets && S.nets.get(e.net);
        if (net) h += `<div class="row">Red ${net.id}: generación ${IE.fmtPower(net.gen)} · demanda ${IE.fmtPower(net.dem)} · capacidad ${IE.fmtPower(net.cap)}</div>${bar(net.sat, net.sat < 0.99 ? '#ff8a3b' : '#3fe07a')}<div class="row dim">${net.cons.length} consumidores · ${net.gens.length} generadores · ${net.bats.length} baterías</div>`;
        break;
      }
      case 'belt': h += `<div class="row">${e.items.length} objetos ${e.jam ? '<span class="warn">· atasco</span>' : ''}</div><div class="inv">${e.items.map(i => ic(i.i)).join('')}</div>`; break;
      case 'splitter': case 'crossing': h += `<div class="inv">${e.buf.map(i => ic(i.i)).join('')}</div>`; break;
      case 'sorter': {
        const nf = t.filters;
        for (let k = 0; k < nf; k++) h += `<div class="row">Filtro ${k + 1} (sale por la izquierda): ${itemSelect('sfilter', e.filters[k], false, knownItems()).replace('data-a="sfilter"', 'data-a="sfilter" data-k="' + k + '"')}</div>`;
        h += powerLine(e);
        break;
      }
      case 'arm':
        h += `<div class="row">Toma de detrás y deja delante. ${e.hold ? 'Lleva ' + ic(e.hold, e.holdN) : ''}</div>`;
        if (t.filter) h += `<div class="row">Filtro: ${itemSelect('filter', e.filter, false, knownItems())}</div>`;
        else h += `<div class="row dim">Para sacar objetos del Núcleo usa un brazo V2+ con filtro.</div>`;
        h += powerLine(e);
        break;
      case 'robohub': {
        const busy = e.robots.filter(r => r.st !== 'idle').length;
        h += `<div class="row">🤖 ${e.robots.length} robots · ${busy} trabajando · radio ${t.radius}</div><div class="row dim">Llevan ingredientes desde almacenes a máquinas y retiran la producción a almacenes dentro del área.</div>` + powerLine(e);
        break;
      }
      case 'ruin': case 'city': case 'horizon': h += demandHTML(e); break;
    }
    if (kind !== 'core' && !def.special && IE.isElectric(e) && kind !== 'gen' && kind !== 'battery' && kind !== 'pole' && kind !== 'sorter' && kind !== 'arm' && kind !== 'robohub') h += powerLine(e);
    if (S.flags.priorities && IE.isElectric(e) && !['gen', 'battery', 'pole'].includes(kind) && !def.special)
      h += `<div class="row">Prioridad energética: ${['Alta', 'Normal', 'Baja'].map((n, i) => `<button class="mini ${e.prio === i ? 'on' : ''}" data-a="prio" data-p="${i}">${n}</button>`).join('')}</div>`;
    h += upgradeHTML(e);
    if (!def.special) h += `<div class="btns">${e.w === e.h ? '<button data-a="rotate">↻ Girar</button>' : ''}<button data-a="demolish" class="danger">🗑 Retirar</button></div>`;
    return h;
  }
  function fuelHTML(e) {
    return `<div class="row">Combustible: ${invHTML(e.fuelInv, 'sin combustible')} ${e.fuelKJ > 0 ? '· ' + IE.fmtEnergy(e.fuelKJ) : ''}</div><div class="btns"><button data-a="fuel">Añadir carbón/madera del Núcleo</button></div>`;
  }
  function demandHTML(e) {
    const need = IE.demandOf(e);
    let h = '';
    if (e.type === 'ruin') h += `<div class="row dim">${esc(IE.RUINS[e.ruin].desc)}</div>`;
    if (e.type === 'city') h += `<div class="row dim">La antigua capital necesita suministros. Llévalos con cintas, camiones o trenes hasta su borde, o entrégalos desde el Núcleo.</div>`;
    if (e.type === 'horizon') h += `<div class="row dim">La instalación planetaria que resolverá la crisis.</div>`;
    h += '<div class="need">' + Object.keys(need).map(k => `<div>${ic(k)} <span>${esc(IE.ITEMS[k].name)} · ${IE.fmtNum(Math.min(need[k], e.got[k] || 0))} / ${IE.fmtNum(need[k])} <small class="dim">(Núcleo: ${IE.fmtNum(S.inv[k] || 0)})</small></span>${bar((e.got[k] || 0) / need[k])}</div>`).join('') + '</div>';
    if (!e.done) h += `<div class="btns"><button data-a="deliver">Entregar desde el Núcleo</button></div>`;
    else h += `<div class="row okc">✔ ${e.type === 'horizon' ? 'Componentes completos' : 'Restaurado'}</div>`;
    if (e.type === 'horizon') {
      const chk = IE.horizonCheck(S, e);
      h += '<div class="checks">' + chk.map(c => `<div class="${c.ok ? 'okc' : 'warn'}">${c.ok ? '✔' : '✖'} ${esc(c.text)}</div>`).join('') + '</div>';
      if (S.flags.horizon_active) h += `<div class="row okc">🌐 Complejo Horizonte ACTIVO</div>`;
      else if (e.charging) h += `<div class="row">Sincronización planetaria ${Math.round(e.charge * 100)}%</div>${bar(e.charge, '#5fe0ff')}<div class="row ${e.pf < 0.99 ? 'warn' : 'dim'}">${esc(e.status || '')}</div>`;
      else h += `<div class="btns"><button data-a="activate" class="big" ${chk.every(c => c.ok) ? '' : 'disabled'}>🌐 Activar Proyecto Horizonte</button></div>`;
      h += powerLine(e);
    }
    return h;
  }
  function depotHTML(e) {
    const isT = IE.BUILDINGS[e.type].depot === 'truck';
    let h = `<div class="row">Nombre: <b>${esc(e.name || '')}</b> <button class="mini" data-a="rename">Renombrar</button> ${e.stop < 0 ? '<span class="warn">· No toca ' + (isT ? 'carretera' : 'vía') + '</span>' : ''}</div>`;
    if (isT) {
      h += '<div class="buy">' + IE.TRUCKS.slice(1).map((T, i) => IE.techDone(S, T.tech) ? `<button data-a="buyTruck" data-t="${i + 1}"><b>${esc(T.name)}</b><small>${T.cap} carga · ${T.speed} c/s</small><div class="cost">${costHTML(T.cost, true)}</div></button>` : '').join('') + '</div>';
      const vs = S.trucks.filter(v => v.route.some(r => r.stop === e.id));
      if (vs.length) h += '<div class="row">Camiones: ' + vs.map(v => `<button class="mini" data-a="selveh" data-k="truck" data-id="${v.id}">#${v.id} ${esc(v.state)}</button>`).join('') + '</div>';
    } else {
      UI.trainCfg = UI.trainCfg || { l: 1, w: 1, n: 2 };
      const c = UI.trainCfg;
      const locos = IE.LOCOS.map((L, i) => L && IE.techDone(S, L.tech) ? i : 0).filter(Boolean);
      const wags = IE.WAGONS.map((L, i) => L && IE.techDone(S, L.tech) ? i : 0).filter(Boolean);
      if (!locos.includes(c.l)) c.l = locos[locos.length - 1] || 1;
      if (!wags.includes(c.w)) c.w = 1;
      const L = IE.LOCOS[c.l];
      c.n = IE.clamp(c.n, 1, L.maxWagons);
      const cost = Object.assign({}, L.cost); for (const k in IE.WAGONS[c.w].cost) cost[k] = (cost[k] || 0) + IE.WAGONS[c.w].cost[k] * c.n;
      h += `<div class="buy col"><div class="row">Locomotora: <select data-a="tcfg" data-k="l">${locos.map(i => `<option value="${i}" ${c.l === i ? 'selected' : ''}>V${i} ${esc(IE.LOCOS[i].name)}</option>`).join('')}</select></div>
        <div class="row">Vagones: <select data-a="tcfg" data-k="w">${wags.map(i => `<option value="${i}" ${c.w === i ? 'selected' : ''}>${esc(IE.WAGONS[i].name)} (${IE.WAGONS[i].cap})</option>`).join('')}</select> × <select data-a="tcfg" data-k="n">${Array.from({ length: L.maxWagons }, (_, i) => `<option ${c.n === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div>
        <div class="row dim">${L.speed} casillas/s · ${L.fuel ? 'carbón o combustible' : 'eléctrica: se recarga en estaciones con red'}</div>
        <div class="cost">${costHTML(cost, true)}</div><button data-a="buyTrain">🚆 Construir tren aquí</button></div>`;
      const ts = S.trains.filter(t => t.sched.some(r => r.stop === e.id));
      if (ts.length) h += '<div class="row">Trenes: ' + ts.map(t => `<button class="mini" data-a="selveh" data-k="train" data-id="${t.id}">#${t.id} ${esc(t.state)}</button>`).join('') + '</div>';
    }
    return h + powerLine(e);
  }
  function vehicleHTML(sv) {
    const isT = sv.kind === 'truck';
    const v = isT ? S.trucks.find(x => x.id === sv.id) : S.trains.find(x => x.id === sv.id);
    if (!v) return null;
    const D = isT ? IE.TRUCKS[v.tier] : IE.LOCOS[v.loco];
    const cap = isT ? D.cap : IE.trainCap(v);
    const stops = [...S.ents.values()].filter(e => IE.BUILDINGS[e.type].depot === (isT ? 'truck' : 'train'));
    const list = isT ? v.route : v.sched;
    const idx = isT ? v.ri : v.si;
    let h = `<div class="ihead"><div><b>${esc(D.name)} #${v.id}</b>${isT ? ` <i class="tier t${v.tier}">V${v.tier}</i>` : ` <i class="tier t${v.loco}">V${v.loco}</i> + ${v.wagons.length} vagones`}<br><small>${esc(v.state)}</small></div><button class="x" data-a="close">✕</button></div>`;
    h += `<div class="row">Carga ${IE.sumInv(v.cargo)} / ${cap}</div><div class="inv">${invHTML(v.cargo)}</div>`;
    h += `<div class="row">${D.fuel ? '🔥 Combustible' : '🔋 Batería'}: ${IE.fmtEnergy(Math.max(0, v.energy))} / ${IE.fmtEnergy(D.energy)}</div>${bar(v.energy / D.energy, v.energy < D.energy * 0.2 ? '#ff6a3b' : '#3fe07a')}`;
    h += `<div class="route"><b>${isT ? 'Ruta' : 'Horario'}</b>`;
    list.forEach((r, i) => {
      h += `<div class="rstep ${i === idx % Math.max(1, list.length) ? 'cur' : ''}"><select data-a="rstop" data-i="${i}">${stops.map(s => `<option value="${s.id}" ${s.id === r.stop ? 'selected' : ''}>${esc(s.name || ('#' + s.id))}</option>`).join('')}</select>
        <select data-a="ract" data-i="${i}"><option value="load" ${r.act === 'load' ? 'selected' : ''}>Cargar</option><option value="unload" ${r.act === 'unload' ? 'selected' : ''}>Descargar</option></select>
        ${isT ? '' : `<select data-a="rcond" data-i="${i}"><option value="full" ${r.cond === 'full' ? 'selected' : ''}>hasta lleno</option><option value="empty" ${r.cond === 'empty' ? 'selected' : ''}>hasta vacío</option><option value="time" ${r.cond === 'time' ? 'selected' : ''}>30 s</option></select>`}
        ${itemSelect('ritem', r.item, false, knownItems()).replace('data-a="ritem"', 'data-a="ritem" data-i="' + i + '"').replace('— ninguno —', 'cualquier objeto')}
        <button class="mini danger" data-a="rdel" data-i="${i}">✕</button></div>`;
    });
    h += `<button class="mini" data-a="radd">+ Añadir ${isT ? 'parada' : 'estación'}</button></div>`;
    h += `<div class="btns">${D.fuel ? '<button data-a="vfuel">Repostar desde el Núcleo</button>' : ''}<button data-a="vcenter">📍 Centrar</button><button data-a="vremove" class="danger">Retirar</button></div>`;
    return h;
  }

  UI.refreshInfo = function (force) {
    const el = $('info');
    if (!force && (UI.infoTouch || (document.activeElement && el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT'))) return;
    let html = null;
    if (UI.selVeh) html = vehicleHTML(UI.selVeh);
    else if (UI.selected) { const e = S.ents.get(UI.selected); if (e) html = entityHTML(e); }
    if (!html) { hideInfo(); return; }
    if (html !== UI.infoKey) { el.innerHTML = html; UI.infoKey = html; }
    el.classList.add('show');
  };

  // ---------- Acciones ----------
  function act(d, el) {
    const e = UI.selected && S.ents.get(UI.selected);
    const v = UI.selVeh && (UI.selVeh.kind === 'truck' ? S.trucks.find(x => x.id === UI.selVeh.id) : S.trains.find(x => x.id === UI.selVeh.id));
    const list = v && (UI.selVeh.kind === 'truck' ? v.route : v.sched);
    switch (d.a) {
      case 'close': UI.selected = null; UI.selVeh = null; hideInfo(); return;
      case 'modal': UI.openModal(d.m); return;
      case 'upgrade': if (e && IE.upgrade(S, e)) toast('⬆ ' + IE.tierOf(e).name, 'good'); buildItems(); break;
      case 'rotate': UI.rotate(); break;
      case 'demolish': if (e) { IE.removeEntity(S, e); UI.selected = null; hideInfo(); buildItems(); } return;
      case 'recipe': if (e) {
        if (!d.r) { e.recipe = null; e.autoSet = false; }
        else {
          const r = IE.RECIPE[d.r];
          if (r.tier > e.tier) { toast('Esta receta requiere ' + IE.BUILDINGS[e.type].name + ' V' + r.tier, 'bad'); return; }
          if (e.recipe !== d.r) { for (const k in e.inv) IE.invAdd(S, k, e.inv[k]); e.inv = {}; e.working = false; e.prog = 0; }
          e.recipe = d.r; e.autoSet = false; UI.lastRecipe = d.r;
        }
      } break;
      case 'fuel': if (e) {
        const tgt = IE.tierOf(e).fuel ? e.fuelInv : e.inv;
        const fuelItem = IE.tierOf(e).fuelItem;
        let moved = 0;
        const order = fuelItem ? [fuelItem] : (e.type === 'combustion' ? ['combustible', 'carbon', 'madera'] : ['carbon', 'madera', 'combustible']);
        for (const f of order) { while (moved < (fuelItem ? 10 : 5) && (S.inv[f] || 0) > 0) { IE.invAdd(S, f, -1); tgt[f] = (tgt[f] || 0) + 1; moved++; } }
        toast(moved ? 'Añadidos ' + moved + ' de combustible' : 'No hay combustible en el Núcleo', moved ? null : 'bad');
      } break;
      case 'cell': if (e) { if ((S.inv.celda_nuclear || 0) > 0 && (e.inv.celda_nuclear || 0) < 4) { IE.invAdd(S, 'celda_nuclear', -1); e.inv.celda_nuclear = (e.inv.celda_nuclear || 0) + 1; } else toast('No hay celdas en el Núcleo', 'bad'); } break;
      case 'toggle': if (e) { e.on = !e.on; } break;
      case 'filter': if (e) e.filter = d.value || null; break;
      case 'sfilter': if (e) { e.filters[+d.k] = d.value || null; e.filters = e.filters.slice(0, IE.tierOf(e).filters); } break;
      case 'prio': if (e) e.prio = +d.p; break;
      case 'deliver': if (e) { const n = IE.deliverFromCore(S, e); toast(n ? 'Entregados ' + n + ' objetos' : 'El Núcleo no tiene lo que falta', n ? 'good' : 'bad'); } break;
      case 'activate': if (e) { if (IE.activateHorizon(S, e)) toast('🌐 Sincronización iniciada: mantén la red al 100 %', 'good'); else toast('Faltan requisitos', 'bad'); } break;
      case 'rename': if (e) { const n = prompt('Nombre', e.name || ''); if (n) e.name = n.slice(0, 24); } break;
      case 'buyTruck': if (e) { const err = IE.buyTruck(S, e, +d.t); toast(err || 'Camión listo: edita su ruta', err ? 'bad' : 'good'); if (!err) { UI.selVeh = { kind: 'truck', id: S.trucks[S.trucks.length - 1].id }; UI.selected = null; } } break;
      case 'tcfg': UI.trainCfg[d.k] = +d.value; break;
      case 'buyTrain': if (e) { const c = UI.trainCfg; const err = IE.buyTrain(S, e, c.l, c.w, c.n); toast(err || 'Tren listo: añade estaciones a su horario', err ? 'bad' : 'good'); if (!err) { UI.selVeh = { kind: 'train', id: S.trains[S.trains.length - 1].id }; UI.selected = null; } } break;
      case 'selveh': UI.selVeh = { kind: d.k, id: +d.id }; UI.selected = null; break;
      case 'rstop': if (list) { list[+d.i].stop = +d.value; v.path = null; } break;
      case 'ract': if (list) list[+d.i].act = d.value; break;
      case 'rcond': if (list) list[+d.i].cond = d.value; break;
      case 'ritem': if (list) list[+d.i].item = d.value || null; break;
      case 'rdel': if (list) { list.splice(+d.i, 1); v.path = null; if (UI.selVeh.kind === 'truck') v.ri = 0; else v.si = 0; } break;
      case 'radd': if (list) {
        const kind = UI.selVeh.kind === 'truck' ? 'truck' : 'train';
        const stops = [...S.ents.values()].filter(x => IE.BUILDINGS[x.type].depot === kind);
        const cur = list.map(r => r.stop);
        const s = stops.find(x => !cur.includes(x.id)) || stops[0];
        if (s) list.push(kind === 'truck' ? { stop: s.id, act: 'unload', item: null } : { stop: s.id, act: 'unload', cond: 'empty', t: 30 });
      } break;
      case 'vfuel': if (v) { const D = UI.selVeh.kind === 'truck' ? IE.TRUCKS[v.tier] : IE.LOCOS[v.loco]; for (const f of ['combustible', 'carbon', 'madera']) while (v.energy < D.energy * 0.95 && (S.inv[f] || 0) > 0) { IE.invAdd(S, f, -1); v.energy += IE.ITEMS[f].fuel; } } break;
      case 'vcenter': if (v) { if (UI.selVeh.kind === 'truck') IE.Render.centerOn(v.x + 0.5, v.y + 0.5); else IE.Render.centerOn(v.tiles[0] % W + 0.5, ((v.tiles[0] / W) | 0) + 0.5); } break;
      case 'vremove': if (v) { if (UI.selVeh.kind === 'truck') IE.removeTruck(S, v); else IE.removeTrain(S, v); UI.selVeh = null; hideInfo(); } return;
      // Modales
      case 'research': if (IE.setResearch(S, d.t)) { toast('Investigando: ' + IE.TECH[d.t].name); UI.renderModal(); } break;
      case 'craft': { const n = IE.queueCraft(S, d.r, +d.n); toast(n ? 'En cola: ' + n : 'Faltan materiales', n ? null : 'bad'); UI.renderModal(); } break;
      case 'save': { const r = IE.saveLocal(S); toast(r.ok ? '💾 Partida guardada' : r.error, r.ok ? 'good' : 'bad'); } break;
      case 'exportFile': exportFile(); break;
      case 'exportCode': { const code = IE.exportCode(S); const ta = $('codebox'); if (ta) { ta.value = code; ta.select(); } try { navigator.clipboard.writeText(code); toast('Código copiado al portapapeles', 'good'); } catch (err) { toast('Código generado: cópialo del cuadro'); } } break;
      case 'importCode': { const ta = $('codebox'); if (ta && ta.value.trim()) importText(ta.value); } break;
      case 'importFile': { const inp = $('filein'); inp.onchange = () => { const f = inp.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => importText(rd.result); rd.readAsText(f); }; inp.click(); } break;
      case 'demoSave':
        if (!confirm('¿Cargar la partida avanzada de ejemplo? Se sustituirá la partida actual (expórtala antes si quieres conservarla).')) break;
        fetch('partidas/partida-avanzada.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
          .then(txt => { importText(txt); IE.saveLocal(IE.Main.state()); })
          .catch(err => toast('No se pudo descargar la partida de ejemplo (' + err.message + '). Impórtala como archivo desde partidas/partida-avanzada.json', 'bad', 5000));
        break;
      case 'newgame': if (confirm('¿Empezar una partida nueva? Se perderá la actual si no la has exportado.')) { IE.deleteLocal(); IE.Main.newGame(); UI.closeModal(); } break;
      case 'speed': if (+d.s === 0) S.paused = !S.paused; else { S.speed = +d.s; S.paused = false; } UI.renderModal(); break;
      case 'goto': UI.closeModal(); IE.Render.centerOn(+d.x, +d.y); break;
      case 'decide': IE.choose(S, d.d, d.o); $('dialog').classList.remove('show'); toast('Decisión tomada: ' + IE.DECISIONS[d.d].options.find(o => o.id === d.o).name, 'good'); UI.dialogQ.shift(); if (UI.dialogQ.length) showDialog(); break;
      case 'free': $('victory').classList.remove('show'); S.freeMode = true; toast('Modo libre: sigue optimizando tu megafactoría'); break;
      case 'tab': UI.tab = d.t; UI.renderModal(); break;
    }
    UI.refreshInfo(true);
    UI.refresh();
  }
  UI.act = act;

  function exportFile() {
    const blob = new Blob([JSON.stringify(IE.serialize(S))], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'industria-eterna-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importText(txt) {
    try { const ns = IE.importText(txt); IE.Main.setState(ns); UI.closeModal(); toast('Partida importada', 'good'); }
    catch (err) { toast('No se pudo importar: ' + err.message, 'bad'); }
  }

  // ---------- Modales ----------
  UI.openModal = function (m) { UI.modal = m; UI.tab = UI.tab || null; $('modal').classList.add('show'); UI.renderModal(); };
  UI.closeModal = function () { UI.modal = null; $('modal').classList.remove('show'); };
  UI.renderModal = function () {
    if (!UI.modal) return;
    const box = $('modalbox');
    if (UI.modalTouch) return;
    let h = '';
    const head = t => `<div class="mhead"><b>${t}</b><button class="x" data-a="closeModal">✕</button></div>`;
    switch (UI.modal) {
      case 'research': h = head('🔬 Investigación') + researchHTML(); break;
      case 'missions': h = head('📋 Misiones') + missionsHTML(); break;
      case 'stats': h = head('📊 Estadísticas') + statsHTML(); break;
      case 'logs': h = head('📜 Registros recuperados') + S.logs.map(l => `<div class="card"><b>${esc(IE.LOGS[l].title)}</b><p>${esc(IE.LOGS[l].text)}</p></div>`).join(''); break;
      case 'craft': h = head('🔧 Taller del Núcleo') + craftHTML(); break;
      case 'inv': h = head('📦 Almacén del Núcleo') + `<div class="inv big">${invHTML(S.inv)}</div><div class="btns"><button onclick="IE.UI.openModal('craft')">🔧 Taller</button></div>`; break;
      case 'menu': h = head('☰ Menú') + menuHTML(); break;
      case 'help': h = head('❓ Ayuda') + helpHTML(); break;
      case 'credits': h = head('🎨 Recursos gráficos') + creditsHTML(); break;
    }
    if (box.innerHTML !== h) box.innerHTML = h;
    box.querySelectorAll('[data-a=closeModal]').forEach(b => b.onclick = () => UI.closeModal());
    if (UI.modal === 'stats') drawPowerChart();
  };
  function researchHTML() {
    const cur = S.research.cur && IE.TECH[S.research.cur];
    let h = cur ? `<div class="card cur"><b>Investigando: ${esc(cur.name)}</b> ${Math.floor(S.research.prog)}/${cur.cost}${bar(S.research.prog / cur.cost)}<small>Cada unidad consume ${cur.packs.map(p => ic(p)).join('')} en un laboratorio · ${cur.time}s/unidad</small></div>`
      : `<div class="card warn">Elige una tecnología. Los laboratorios necesitan energía y paquetes de investigación.</div>`;
    const eraMax = Math.max(1, ...IE.TECH_IDS.filter(t => S.tech[t]).map(t => IE.TECH[t].era + (t.startsWith('t_era') ? 1 : 0)));
    for (let era = 1; era <= 6; era++) {
      const techs = IE.TECH_IDS.map(id => IE.TECH[id]).filter(t => t.era === era);
      const done = techs.filter(t => S.tech[t.id]).length;
      const open = era <= eraMax;
      h += `<details ${open && done < techs.length ? 'open' : ''}><summary style="border-color:${IE.ERAS[era].color}">Era ${era} · ${IE.ERAS[era].name} <small>${done}/${techs.length}</small></summary>`;
      if (!open) h += `<div class="dim pad">Investiga la puerta de era anterior para desbloquear.</div>`;
      else h += techs.map(t => {
        const av = IE.techAvailable(S, t.id), isDone = !!S.tech[t.id], isCur = S.research.cur === t.id;
        const un = IE.techUnlocks(t.id);
        const prog = (S.research.saved && S.research.saved[t.id]) || 0;
        return `<div class="tech ${isDone ? 'done' : av ? 'lock' : 'avail'} ${isCur ? 'cur' : ''}"><div><b>${esc(t.name)}</b> <small>${t.cost} × ${t.packs.map(p => `<img class="pk" src="${iconURL(p)}">`).join('')}</small><br><small>${esc(t.desc)}</small>${un.length ? `<br><small class="dim">${esc(un.join(' · '))}</small>` : ''}${!isDone && av ? `<br><small class="warn">${esc(av)}</small>` : ''}${prog && !isCur ? `<br><small>${Math.floor(prog)}/${t.cost} guardado</small>` : ''}</div>
          ${isDone ? '<span class="okc">✔</span>' : isCur ? '<span>⏳</span>' : !av ? `<button data-a="research" data-t="${t.id}">Investigar</button>` : ''}</div>`;
      }).join('');
      h += '</details>';
    }
    return h;
  }
  function objHTML(m, k) {
    const o = m.obj[k];
    const [v, n, ok] = IE.objProgress(S, m, k);
    return `<div class="obj ${ok ? 'okc' : ''}">${ok ? '✔' : '○'} ${esc(o.label)} <small>${n > 1 ? IE.fmtNum(Math.min(v, n)) + '/' + IE.fmtNum(n) : ''}</small>${n > 1 ? bar(v / n) : ''}</div>`;
  }
  function missionsHTML() {
    const m = IE.currentMission(S);
    const acts = ['', 'Acto I · Despertar', 'Acto II · Reconstrucción', 'Acto III · La verdad', 'Acto IV · Proyecto Horizonte'];
    const prog = Math.round(S.missions.main / IE.MISSIONS.length * 100);
    let h = `<div class="card"><b>Progreso de la campaña: ${prog}%</b>${bar(prog / 100, '#5fe0ff')}</div>`;
    if (m) {
      h += `<div class="card cur"><small>${acts[m.act]}</small><br><b>${esc(m.title)}</b>${m.intro ? `<p class="dim">${esc(m.intro.join(' '))}</p>` : ''}${m.obj.map((o, k) => objHTML(m, k)).join('')}${rewardHTML(m.reward)}</div>`;
      if (m.id === 'm_activate' || m.obj.some(o => o.t === 'path_req')) h += `<div class="card">${esc(IE.pathRequirement(S).text)}</div>`;
    } else h += `<div class="card okc">Campaña completada. ${S.freeMode ? 'Modo libre activo.' : ''}</div>`;
    const sides = IE.SIDE_MISSIONS.filter(s => !s.need || S.flags[s.need]);
    if (sides.length) h += '<h4>Misiones secundarias</h4>' + sides.map(s => `<div class="card ${S.missions.done[s.id] ? 'done' : ''}"><b>${esc(s.title)}</b> ${S.missions.done[s.id] ? '<span class="okc">✔</span>' : ''}${S.missions.done[s.id] ? '' : s.obj.map((o, k) => objHTML(s, k)).join('')}${rewardHTML(s.reward)}</div>`).join('');
    // Lugares de interés
    h += '<h4>Instalaciones conocidas</h4>';
    for (const e of S.ents.values()) {
      if (!['ruin', 'city', 'horizon'].includes(e.type)) continue;
      const reg = S.world.region[e.y * W + e.x];
      if (!S.regions[reg]) continue;
      const name = e.type === 'ruin' ? IE.RUINS[e.ruin].name : IE.BUILDINGS[e.type].name;
      h += `<div class="card row2"><span>${e.done ? '✔' : '🏚'} ${esc(name)} <small class="dim">${esc(IE.REGIONS[reg].name)}</small></span><button class="mini" data-a="goto" data-x="${e.x + 1.5}" data-y="${e.y + 1.5}">Ir</button></div>`;
    }
    h += `<div class="card done"><small>Completadas: ${IE.MISSIONS.filter(x => S.missions.done[x.id]).map(x => esc(x.title)).join(' · ') || '—'}</small></div>`;
    return h;
  }
  function rewardHTML(rw) {
    if (!rw) return '';
    const parts = [];
    if (rw.items) parts.push(Object.keys(rw.items).map(k => ic(k, rw.items[k])).join(''));
    if (rw.regions) parts.push('🗺 ' + rw.regions.map(r => IE.REGIONS[r].name).join(', '));
    if (rw.log) parts.push('📜 registro');
    if (rw.text) parts.push(esc(rw.text));
    return parts.length ? `<div class="reward">Recompensa: ${parts.join(' ')}</div>` : '';
  }
  function statsHTML() {
    UI.tab = UI.tab && ['prod', 'power', 'log', 'campaign'].includes(UI.tab) ? UI.tab : 'prod';
    const tabs = [['prod', 'Producción'], ['power', 'Energía'], ['log', 'Logística'], ['campaign', 'Campaña']];
    let h = '<div class="tabs">' + tabs.map(([k, n]) => `<button data-a="tab" data-t="${k}" class="${UI.tab === k ? 'on' : ''}">${n}</button>`).join('') + '</div>';
    if (UI.tab === 'prod') {
      const rows = IE.ITEM_IDS.map(k => [k, IE.ratePerMin(S, k)]).filter(r => r[1] > 0 || S.stats.produced[r[0]]).sort((a, b) => b[1] - a[1]);
      h += '<table class="tbl"><tr><th></th><th>/min</th><th>Total</th><th>Núcleo</th></tr>' + rows.map(([k, r]) => `<tr><td>${ic(k)} ${esc(IE.ITEMS[k].name)}</td><td>${IE.fmtNum(r)}</td><td>${IE.fmtNum(S.stats.produced[k] || 0)}</td><td>${IE.fmtNum(S.inv[k] || 0)}</td></tr>`).join('') + '</table>';
      // Cuellos de botella
      const st = {};
      for (const e of S.ents.values()) if (e.status && IE.Render.BAD[e.status]) st[e.status] = (st[e.status] || 0) + 1;
      let jams = 0; for (const e of S.ents.values()) if (e.type === 'belt' && e.jam) jams++;
      h += '<h4>Cuellos de botella</h4><div class="card">' + (Object.keys(st).map(k => `<div>${esc(k)}: <b>${st[k]}</b></div>`).join('') || 'Sin problemas detectados') + `<div>Cintas atascadas: <b>${jams}</b></div><small class="dim">Activa la vista ⚠ para verlos en el mapa.</small></div>`;
    } else if (UI.tab === 'power') {
      const P = S.power || {};
      const bySrc = {};
      for (const e of S.ents.values()) {
        const def = IE.BUILDINGS[e.type];
        if (def.kind === 'gen' || e.type === 'core' || (e.type === 'ruin' && e.done && IE.RUINS[e.ruin].gen)) {
          const n = e.type === 'core' ? 'Reserva ATLAS' : e.type === 'ruin' ? 'Presa de Aurora' : def.name;
          bySrc[n] = bySrc[n] || [0, 0, 0]; bySrc[n][0] += e.outKW || 0; bySrc[n][1] += e.avail || 0; bySrc[n][2]++;
        }
      }
      h += `<div class="card">Generación <b>${IE.fmtPower(P.gen || 0)}</b> · Demanda <b>${IE.fmtPower(P.dem || 0)}</b> · Capacidad ${IE.fmtPower(P.cap || 0)} · Satisfacción ${Math.round((P.sat || 1) * 100)}%<br>Baterías ${IE.fmtEnergy(P.stored || 0)} / ${IE.fmtEnergy(P.storeCap || 0)} · Pico ${IE.fmtPower(S.stats.peakPower)}<br>Luz ${Math.round(IE.daylight(S) * 100)}% · Viento ${Math.round(IE.wind(S) * 100)}% · Contaminación ${Math.round(S.pollution)} (−${Math.round(IE.smog(S) * 100)}% solar)</div>`;
      h += '<canvas id="pchart" width="600" height="160"></canvas><small class="dim"><span style="color:#3fe07a">■</span> generación <span style="color:#ff8a3b">■</span> demanda <span style="color:#5fb0ff">■</span> baterías (3 min)</small>';
      h += '<table class="tbl"><tr><th>Fuente</th><th>Uds.</th><th>Produce</th><th>Disponible</th></tr>' + Object.keys(bySrc).map(k => `<tr><td>${esc(k)}</td><td>${bySrc[k][2]}</td><td>${IE.fmtPower(bySrc[k][0])}</td><td>${IE.fmtPower(bySrc[k][1])}</td></tr>`).join('') + '</table>';
      h += `<div class="card"><small><b>Estrategias:</b> la solar es gratis pero cae de noche y con contaminación; la eólica varía; el vapor y la combustión son estables pero consumen y contaminan; la nuclear da muchísimo sin parar y genera residuos; las baterías cubren noches y picos. ${S.flags.priorities ? 'Con redes inteligentes puedes fijar prioridades por máquina.' : 'Investiga Redes inteligentes para fijar prioridades.'}</small></div>`;
      if (S.nets) h += '<h4>Redes</h4>' + [...S.nets.values()].map(n => `<div class="card">Red ${n.id}: ${IE.fmtPower(n.gen)} / ${IE.fmtPower(n.dem)} · ${Math.round(n.sat * 100)}% · ${n.cons.length} consumidores${bar(n.sat, n.sat < 0.99 ? '#ff8a3b' : '#3fe07a')}</div>`).join('');
    } else if (UI.tab === 'log') {
      h += '<h4>Camiones</h4>' + (S.trucks.map(v => `<div class="card row2"><span>#${v.id} ${esc(IE.TRUCKS[v.tier].name)} · ${esc(v.state)} · ${IE.sumInv(v.cargo)}/${IE.TRUCKS[v.tier].cap}</span><button class="mini" data-a="goto" data-x="${v.x + 0.5}" data-y="${v.y + 0.5}">Ir</button></div>`).join('') || '<div class="dim pad">Ninguno</div>');
      h += '<h4>Trenes</h4>' + (S.trains.map(t => `<div class="card row2"><span>#${t.id} ${esc(IE.LOCOS[t.loco].name)} +${t.wagons.length} · ${esc(t.state)} · ${IE.sumInv(t.cargo)}/${IE.trainCap(t)}</span><button class="mini" data-a="goto" data-x="${t.tiles[0] % W + 0.5}" data-y="${((t.tiles[0] / W) | 0) + 0.5}">Ir</button></div>`).join('') || '<div class="dim pad">Ninguno</div>');
      let belts = 0, items = 0; for (const e of S.ents.values()) if (e.type === 'belt') { belts++; items += e.items.length; }
      h += `<div class="card">Cintas: ${belts} casillas · ${items} objetos en tránsito · Robots: ${IE.robotCount(S)}<br>Entregas en camión: ${IE.fmtNum(S.stats.truckDelivered)} · en tren: ${IE.fmtNum(S.stats.trainDelivered)}</div>`;
      h += `<div class="card"><small><b>Comparativa:</b> las cintas son baratas y continuas en distancias cortas; los camiones no necesitan infraestructura cara pero mueven poco volumen; los trenes cuestan más pero mueven cientos de objetos por viaje en largas distancias.</small></div>`;
    } else {
      h += `<div class="card">Tiempo de juego: ${IE.fmtTime(S.stats.playTime)}<br>Misiones: ${S.missions.main}/${IE.MISSIONS.length} principales · ${IE.SIDE_MISSIONS.filter(s => S.missions.done[s.id]).length}/${IE.SIDE_MISSIONS.length} secundarias<br>Tecnologías: ${IE.TECH_IDS.filter(t => S.tech[t]).length}/${IE.TECH_IDS.length}<br>Regiones: ${S.regions.filter(Boolean).length}/6<br>Decisiones: ${S.choices.policy ? IE.DECISIONS.policy.options.find(o => o.id === S.choices.policy).name : '—'} · ${S.choices.path ? IE.DECISIONS.path.options.find(o => o.id === S.choices.path).name : '—'}</div>`;
    }
    return h;
  }
  function drawPowerChart() {
    const c = $('pchart');
    if (!c) return;
    const g = c.getContext('2d'), d = S.hist.power;
    g.fillStyle = '#10151c'; g.fillRect(0, 0, c.width, c.height);
    if (d.length < 2) return;
    const max = Math.max(1, ...d.map(x => Math.max(x[0], x[1]))) * 1.1;
    const maxS = Math.max(1, ...d.map(x => x[2]));
    const line = (k, col, m) => { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); d.forEach((x, i) => { const px = i / (d.length - 1) * c.width, py = c.height - x[k] / m * (c.height - 10) - 4; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); };
    line(2, '#5fb0ff', maxS); line(1, '#ff8a3b', max); line(0, '#3fe07a', max);
    g.fillStyle = '#aaa'; g.font = '12px sans-serif'; g.fillText(IE.fmtPower(max), 4, 14);
  }
  function craftHTML() {
    const recs = IE.handCraftable(S);
    let h = `<div class="card dim">Fabrica a mano con lo que hay en el Núcleo (más lento que una ensambladora).</div>`;
    if (S.handCraft.length) h += `<div class="card">En cola: ${S.handCraft.length} · ${esc(IE.RECIPE[S.handCraft[0].r].name)}${bar(S.handCraft[0].p)}</div>`;
    h += recs.map(r => `<div class="tech avail"><div>${Object.keys(r.in).map(k => ic(k, r.in[k], (S.inv[k] || 0) < r.in[k] ? 'lack' : '')).join('')} ➜ ${Object.keys(r.out).map(k => ic(k, r.out[k])).join('')}<br><small>${esc(r.name)} · ${(r.t * 1.5).toFixed(1)}s</small></div><div class="btn2"><button data-a="craft" data-r="${r.id}" data-n="1">×1</button><button data-a="craft" data-r="${r.id}" data-n="5">×5</button><button data-a="craft" data-r="${r.id}" data-n="20">×20</button></div></div>`).join('');
    return h;
  }
  function menuHTML() {
    return `<div class="card"><b>Partida</b><div class="btns"><button data-a="save">💾 Guardar ahora</button><button data-a="exportFile">⬇ Exportar archivo JSON</button><button data-a="importFile">⬆ Importar archivo</button></div>
      <textarea id="codebox" placeholder="Pega aquí un código de partida para importarlo"></textarea><div class="btns"><button data-a="exportCode">Generar y copiar código</button><button data-a="importCode">Importar código</button></div>
      <small class="dim">Autoguardado cada 30 s en este navegador. Versión de guardado ${IE.SAVE_VERSION}.</small></div>
      <div class="card"><b>Partida de ejemplo</b><p class="dim">Acto III, Era 4: fábrica en marcha, red eléctrica, tren, camiones, robots y laboratorios. Sustituye la partida actual.</p><div class="btns"><button data-a="demoSave">🎮 Cargar partida avanzada</button></div></div>
      <div class="card"><b>Velocidad de simulación</b><div class="btns">${[0, 1, 2, 4].map(s => `<button data-a="speed" data-s="${s}" class="${(s === 0 ? S.paused : (!S.paused && S.speed === s)) ? 'on' : ''}">${s === 0 ? '⏸ Pausa' : s + 'x'}</button>`).join('')}</div></div>
      <div class="card"><div class="btns"><button onclick="IE.UI.openModal('help')">❓ Ayuda</button><button onclick="IE.UI.openModal('logs')">📜 Registros</button><button onclick="IE.UI.openModal('credits')">🎨 Créditos</button></div></div>
      <div class="card"><button data-a="newgame" class="danger">Nueva partida</button></div>`;
  }
  function helpHTML() {
    return `<div class="card"><b>Controles</b><p>☝ Arrastra para mover la cámara · 🤏 pellizca para el zoom · toca un edificio para ver su información.<br>Barra inferior: elige categoría y edificio; toca el mapa para colocarlo. Las cintas, carreteras y vías se trazan arrastrando. ↻ gira antes de colocar. Toca la etiqueta V1/V2… de un edificio de la barra para elegir la generación.<br>✋ Mano: extrae recursos y tala. 🗑 Retirar: devuelve todos los materiales.<br>Teclado: R girar, Esc cancelar, Espacio pausa, H mano, X retirar, WASD mover.</p></div>
      <div class="card"><b>Cómo funciona</b><p>Los extractores expulsan por su frente (flecha amarilla). Las cintas que apuntan a un edificio le entregan objetos; los edificios expulsan su producción a la cinta o máquina de enfrente. Las cintas que entran por un lateral se incorporan. Todo lo que llega al Núcleo se suma al almacén de la colonia, que paga las construcciones.<br>Las máquinas V1 queman carbón o madera; desde V2 necesitan electricidad: coloca generadores y postes cuyo área cubra las máquinas. Sin energía suficiente las máquinas se ralentizan o paran.<br>Los camiones circulan por carreteras entre paradas; los trenes recorren vías entre estaciones. Las vías contiguas se conectan: deja una casilla entre vías paralelas. Usa señales para dividir la red en bloques y que varios trenes compartan vías sin chocar.</p></div>
      <div class="card"><b>Vistas</b><p>⚡ redes eléctricas y cobertura · 🚚 transporte y atascos · 🏭 estado de producción · ⚠ problemas y materiales que faltan.</p></div>`;
  }
  function creditsHTML() {
    return `<div class="card"><p>Todos los gráficos están incluidos localmente en <code>assets/</code>. Licencias en <code>CREDITOS.md</code>.</p>
      <ul><li><b>Kenney · Sci-Fi RTS</b> (CC0): edificios, terreno marciano, rocas, cristales, árboles alienígenas.</li><li><b>Kenney · Tower Defense Top-Down</b> (CC0): hierba, tierra, arena, roca, cajas, plataformas.</li><li><b>Kenney · Racing Pack</b> (CC0): vehículos, árboles, rocas, barriles, manchas de petróleo.</li><li><b>Kenney · Particle Pack</b> (CC0): humo, chispas, llamas, luces, remolinos.</li></ul>
      <p class="dim">Cintas, vías, carreteras, trenes, robots, iconos de objetos y aspas eólicas son ilustraciones propias dibujadas con Canvas.</p></div>`;
  }

  // ---------- Diálogos y decisiones ----------
  function showDialog() {
    const d = UI.dialogQ[0];
    if (!d) { $('dialog').classList.remove('show'); return; }
    if (d.decision) return renderDecision(d.decision);
    d.i = d.i || 0;
    $('dialog').innerHTML = `<div class="atlas"><canvas id="atlasface" width="56" height="56"></canvas></div><div class="dtext"><small>${esc(d.title || 'ATLAS')}</small><p>${esc(d.lines[d.i])}</p><span class="dim">${d.i + 1}/${d.lines.length} · toca para continuar</span></div>`;
    $('dialog').classList.add('show');
    drawFace();
  }
  function nextDialog() {
    const d = UI.dialogQ[0];
    if (!d || d.decision) return;
    d.i++;
    if (d.i >= d.lines.length) UI.dialogQ.shift();
    showDialog();
  }
  function showDecision(id) { UI.dialogQ.push({ decision: id }); if (UI.dialogQ.length === 1) showDialog(); }
  function renderDecision(id) {
    const D = IE.DECISIONS[id];
    if (S.choices[id]) { UI.dialogQ.shift(); showDialog(); return; }
    $('dialog').innerHTML = `<div class="atlas"><canvas id="atlasface" width="56" height="56"></canvas></div><div class="dtext"><small>DECISIÓN</small><b>${esc(D.title)}</b><p>${esc(D.text)}</p><div class="opts">${D.options.map(o => `<button data-a="decide" data-d="${id}" data-o="${o.id}"><b>${esc(o.name)}</b><small>${esc(o.desc)}</small></button>`).join('')}</div></div>`;
    $('dialog').classList.add('show');
    drawFace();
  }
  function drawFace() {
    const c = $('atlasface'); if (!c) return;
    const g = c.getContext('2d'), t = performance.now() / 1000;
    g.clearRect(0, 0, 56, 56);
    const grd = g.createRadialGradient(28, 28, 2, 28, 28, 26);
    grd.addColorStop(0, '#bff'); grd.addColorStop(0.35, '#2bd4ff'); grd.addColorStop(1, '#062030');
    g.fillStyle = grd; g.beginPath(); g.arc(28, 28, 26, 0, 7); g.fill();
    g.strokeStyle = '#7ff'; g.lineWidth = 2; g.beginPath(); g.arc(28, 28, 18 + Math.sin(t * 3) * 2, 0, 7); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(28, 28, 5, 0, 7); g.fill();
    if ($('dialog').classList.contains('show')) requestAnimationFrame(drawFace);
  }

  // ---------- Notificaciones ----------
  function toast(msg, cls, ms) {
    const el = document.createElement('div');
    el.className = 'toast ' + (cls || '');
    el.textContent = msg;
    $('alerts').appendChild(el);
    while ($('alerts').children.length > 4) $('alerts').firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms || 2600);
  }
  UI.toast = toast;

  // ---------- Barra superior y tarjeta de misión ----------
  const TOP_ITEMS = ['piedra', 'madera', 'carbon', 'lingote_hierro', 'placa_hierro', 'engranaje', 'lingote_cobre', 'cable', 'circuito', 'acero'];
  UI.refresh = function () {
    if (!S) return;
    const bh = $('bottom').offsetHeight;
    if (bh !== UI._bh) { UI._bh = bh; document.documentElement.style.setProperty('--bh', bh + 'px'); }
    const P = S.power || { gen: 0, dem: 0, sat: 1 };
    const shown = TOP_ITEMS.filter(k => S.inv[k] || ['piedra', 'carbon', 'placa_hierro'].includes(k)).slice(0, 6);
    const dl = IE.daylight(S);
    $('res').innerHTML = shown.map(k => ic(k, S.inv[k] || 0)).join('');
    $('pow').innerHTML = `<span class="${P.sat < 0.99 ? 'warn' : ''}">⚡ ${IE.fmtPower(P.gen)} / ${IE.fmtPower(P.dem)}</span>${bar(P.sat, P.sat < 0.6 ? '#ff4040' : P.sat < 0.99 ? '#ff8a3b' : '#3fe07a')}`;
    $('clock').textContent = (dl > 0.5 ? '☀️' : dl > 0.05 ? '🌅' : '🌙') + (S.research.cur ? ' 🔬' + Math.round(S.research.prog / IE.TECH[S.research.cur].cost * 100) + '%' : '');
    $('btnPause').textContent = S.paused ? '▶' : '⏸';
    $('btnSpeed').textContent = S.speed + 'x';
    const m = IE.currentMission(S);
    if (m) {
      let k = m.obj.findIndex((o, i) => !IE.objProgress(S, m, i)[2]);
      if (k < 0) k = 0;
      const [v, n] = IE.objProgress(S, m, k);
      $('mission').innerHTML = `<b>📋 ${esc(m.title)}</b><span>${esc(m.obj[k].label)}${n > 1 ? ' · ' + IE.fmtNum(Math.min(v, n)) + '/' + IE.fmtNum(n) : ''}</span>${bar(n > 1 ? v / n : 0)}`;
    } else $('mission').innerHTML = `<b>🌐 ${S.victory ? 'Campaña completada · modo libre' : '—'}</b>`;
  };
  function markSide() { [...$('side').querySelectorAll('[data-side]')].forEach(b => b.classList.toggle('on', b.dataset.side === IE.Render.view)); }

  UI.tick = function () {
    UI.refresh();
    UI.refreshInfo();
    if (UI.modal && UI.modal !== 'menu' && UI.modal !== 'research' && UI.modal !== 'craft') UI.renderModal();
    if (UI.modal === 'craft' || UI.modal === 'research') UI.renderModal();
    UI._barT = (UI._barT || 0) + 1;
    if (UI._barT % 6 === 0 && !UI.barTouch) buildItems();
  };
  // Evitar redibujar el modal mientras se toca
  document.addEventListener('DOMContentLoaded', () => {
    const mb = document.getElementById('modalbox');
    if (mb) { mb.addEventListener('pointerdown', () => UI.modalTouch = true); window.addEventListener('pointerup', () => setTimeout(() => UI.modalTouch = false, 150)); }
  });
})();
