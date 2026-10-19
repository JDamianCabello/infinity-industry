// Guardado: serialización versionada, autoguardado, exportación e importación.
(function () {
  const IE = window.IE;
  const KEY = 'industria_eterna_save';
  const SKIP = new Set(['_front', 'tiles', 'net', 'pf', 'dem', 'avail', 'outKW', 'water', 'scan', 'flow', 'jam', 'acc', 'missing']);

  function b64FromBytes(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function bytesFromB64(b64) {
    const s = atob(b64), u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  }

  IE.serialize = function (S) {
    const ents = [];
    for (const e of S.ents.values()) {
      const o = {};
      for (const k in e) {
        if (SKIP.has(k)) continue;
        if (k === 'robots') { o.robots = e.robots.length; continue; }
        o[k] = e[k];
      }
      ents.push(o);
    }
    const w = S.world;
    return {
      v: IE.SAVE_VERSION, game: 'industria-eterna', savedAt: Date.now(),
      seed: S.seed, time: S.time, tick: S.tick, speed: S.speed, nextId: S.nextId,
      res: b64FromBytes(w.res), amt: b64FromBytes(new Uint8Array(w.amt.buffer)), feat: b64FromBytes(w.feat),
      ents, inv: S.inv, regions: S.regions, tech: S.tech, research: S.research, flags: S.flags, choices: S.choices,
      missions: S.missions, stats: S.stats, pollution: S.pollution, logs: S.logs, victory: S.victory, freeMode: S.freeMode,
      handCraft: S.handCraft,
      trucks: S.trucks.map(v => Object.assign({}, v, { path: null })),
      trains: S.trains.map(t => Object.assign({}, t, { path: null, res: [] })),
    };
  };

  // Migraciones entre versiones de guardado
  const MIGRATIONS = {
    // 1: data => { ...; data.v = 2; return data; }
  };
  IE.deserialize = function (data) {
    if (!data || data.game !== 'industria-eterna') throw new Error('No es una partida de Industria Eterna');
    if (data.v > IE.SAVE_VERSION) throw new Error('La partida es de una versión más nueva del juego');
    while (data.v < IE.SAVE_VERSION) {
      const m = MIGRATIONS[data.v];
      if (!m) throw new Error('No se puede migrar la versión ' + data.v);
      data = m(data);
    }
    const S = IE.newState(data.seed);
    S.ents.clear(); S.grid.fill(0);
    const w = S.world;
    w.res.set(bytesFromB64(data.res));
    w.amt.set(new Uint16Array(bytesFromB64(data.amt).buffer));
    w.feat.set(bytesFromB64(data.feat));
    for (const k of ['time', 'tick', 'speed', 'nextId', 'inv', 'regions', 'tech', 'research', 'flags', 'choices', 'missions', 'stats', 'pollution', 'logs', 'victory', 'freeMode', 'handCraft'])
      if (data[k] !== undefined) S[k] = data[k];
    for (const o of data.ents) {
      const e = Object.assign({}, o);
      if (typeof o.robots === 'number') e.robots = [];
      IE.initEntity(S, e);
      if (e.type === 'robohub') { const n = o.robots || 0; for (let i = 0; i < n; i++) e.robots.push({ x: e.x + 1, y: e.y + 1, st: 'idle' }); }
      S.ents.set(e.id, e);
      for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) S.grid[y * IE.MAP_W + x] = e.id;
      if (e.type === 'core') S.coreId = e.id;
    }
    S.trucks = data.trucks || [];
    S.trains = (data.trains || []).map(t => Object.assign(t, { path: null, res: [] }));
    S.dirty = { power: true, rail: true, road: true };
    S.gridVer = 1;
    for (const e of S.ents.values()) if (e.type === 'belt') IE.updateBeltCurve(S, e);
    return S;
  };

  IE.saveLocal = function (S) {
    try {
      const txt = JSON.stringify(IE.serialize(S));
      const prev = localStorage.getItem(KEY);
      if (prev) localStorage.setItem(KEY + '_bak', prev);
      localStorage.setItem(KEY, txt);
      return { ok: true, size: txt.length };
    } catch (e) {
      console.error(e);
      return { ok: false, error: e && e.name === 'QuotaExceededError' ? 'Sin espacio en el navegador para guardar' : 'Error al guardar: ' + (e.message || e) };
    }
  };
  IE.loadLocal = function (backup) {
    try {
      const txt = localStorage.getItem(backup ? KEY + '_bak' : KEY);
      if (!txt) return null;
      return IE.deserialize(JSON.parse(txt));
    } catch (e) {
      console.error(e);
      if (!backup) return IE.loadLocal(true);
      return null;
    }
  };
  IE.hasLocalSave = () => { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };
  IE.deleteLocal = () => { try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '_bak'); } catch (e) { } };

  // Código de partida: JSON en base64 (UTF-8)
  IE.exportCode = S => b64FromBytes(new TextEncoder().encode(JSON.stringify(IE.serialize(S))));
  IE.importText = function (txt) {
    txt = txt.trim();
    let data;
    if (txt.startsWith('{')) data = JSON.parse(txt);
    else data = JSON.parse(new TextDecoder().decode(bytesFromB64(txt.replace(/\s+/g, ''))));
    return IE.deserialize(data);
  };
})();
