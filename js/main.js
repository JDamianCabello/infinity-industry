// Arranque, bucle principal (simulación a paso fijo), autoguardado y secuencia final.
(function () {
  const IE = window.IE;
  const M = IE.Main = {};
  let S = null, acc = 0, last = 0, uiT = 0, saveT = 0;

  M.setState = function (s) {
    S = s; window.S = s;
    IE.Render.setState(S);
    IE.UI.setState(S);
    const c = IE.coreEnt(S);
    IE.Render.centerOn(c.x + 1.5, c.y + 1.5);
    IE.Render.cam.z = 1.1;
    if (S.victory) document.getElementById('victory').classList.remove('show');
  };
  M.newGame = function () {
    const seed = (Math.random() * 1e9) | 0;
    M.setState(IE.newState(seed));
    IE.saveLocal(S);
  };

  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.25, last ? (ts - last) / 1000 : 0);
    last = ts;
    if (!S) return;
    if (!S.paused) {
      acc += dt * S.speed;
      let steps = 0;
      while (acc >= IE.TICK && steps < 24) { IE.step(S, IE.TICK); acc -= IE.TICK; steps++; }
      if (steps >= 24) acc = 0; // el dispositivo no da abasto: ralentizar en vez de acumular
    }
    IE.Render.frame(S, IE.UI, ts);
    uiT += dt; saveT += dt;
    if (uiT > 0.3) { uiT = 0; IE.UI.tick(); }
    if (saveT > 30) { saveT = 0; const r = IE.saveLocal(S); if (!r.ok) IE.UI.toast(r.error, 'bad'); }
  }

  M.boot = function () {
    const cv = document.getElementById('cv');
    IE.Render.init(cv);
    window.addEventListener('resize', () => IE.Render.resize());
    IE.Assets.load(() => {
      const saved = IE.loadLocal();
      const st = document.getElementById('start');
      document.getElementById('btnContinue').style.display = saved ? '' : 'none';
      document.getElementById('btnContinue').onclick = () => { st.classList.remove('show'); begin(saved); };
      document.getElementById('btnNew').onclick = () => {
        if (saved && !confirm('Hay una partida guardada. ¿Empezar una nueva?')) return;
        st.classList.remove('show');
        begin(null);
      };
      document.getElementById('loading').style.display = 'none';
      st.classList.add('show');
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && S) IE.saveLocal(S); });
    window.addEventListener('pagehide', () => { if (S) IE.saveLocal(S); });
  };
  function begin(saved) {
    if (!IE.UI._inited) {
      IE.UI.init(saved || IE.newState((Math.random() * 1e9) | 0));
      IE.UI._inited = true;
      IE.Input.init(document.getElementById('cv'), IE.UI);
    }
    if (saved) M.setState(saved);
    else M.newGame();
    requestAnimationFrame(loop);
  }

  // ---------- Secuencia final ----------
  IE.Cinematic = {
    play(S) {
      if (S.victory) return;
      S.victory = true;
      const el = document.getElementById('cine');
      const cv = document.getElementById('cinecv');
      el.classList.add('show');
      const g = cv.getContext('2d');
      const lines = IE.ENDINGS[S.choices.path || 'armonia'];
      const t0 = performance.now();
      let done = false;
      const finish = () => { if (done) return; done = true; el.classList.remove('show'); showVictory(S); };
      el.onclick = () => { if (performance.now() - t0 > 1500) finish(); };
      const stars = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random()]);
      function frame() {
        if (done) return;
        const t = (performance.now() - t0) / 1000;
        const w = cv.width = cv.clientWidth * Math.min(2, devicePixelRatio || 1), h = cv.height = cv.clientHeight * Math.min(2, devicePixelRatio || 1);
        g.fillStyle = '#02040a'; g.fillRect(0, 0, w, h);
        for (const [x, y, b] of stars) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + b * 0.7) * (0.6 + 0.4 * Math.sin(t * 2 + b * 9)) + ')'; g.fillRect(x * w, y * h, 2, 2); }
        const cx = w / 2, cy = h * 0.45, r = Math.min(w, h) * 0.3;
        const k = IE.clamp((t - 4) / 6, 0, 1); // recuperación
        const mix = (a, b) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
        const c1 = mix([120, 80, 70], [60, 150, 230]), c2 = mix([60, 40, 40], [20, 90, 60]);
        const grd = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        grd.addColorStop(0, `rgb(${c1})`); grd.addColorStop(1, `rgb(${c2})`);
        g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
        // Continentes
        g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();
        g.fillStyle = `rgba(${mix([90, 70, 50], [60, 140, 60])},0.9)`;
        for (let i = 0; i < 6; i++) { const a = i * 1.1 + t * 0.05; g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a * 1.3) * r * 0.4, r * 0.28, r * 0.16, a, 0, 7); g.fill(); }
        if (k > 0) { g.fillStyle = `rgba(255,255,255,${0.5 * k})`; for (let i = 0; i < 9; i++) { const a = i * 0.7 + t * 0.12; g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 0.65, cy + Math.sin(a * 1.7) * r * 0.55, r * 0.22, r * 0.05, a, 0, 7); g.fill(); } }
        g.restore();
        // Atmósfera
        g.strokeStyle = `rgba(120,220,255,${0.2 + 0.5 * k})`; g.lineWidth = 6 + 10 * k; g.beginPath(); g.arc(cx, cy, r + 4, 0, 7); g.stroke();
        // Haz del complejo
        const b = IE.clamp((t - 1) / 3, 0, 1);
        if (b > 0) {
          const px = cx + r * 0.2, py = cy - r * 0.55;
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = `rgba(150,240,255,${0.6 * b})`; g.beginPath(); g.moveTo(px - 6, py); g.lineTo(px + 6, py); g.lineTo(px + 30, 0); g.lineTo(px - 30, 0); g.fill();
          for (let i = 0; i < 4; i++) { const rr = ((t * 0.6 + i * 0.25) % 1) * r * 2.4; g.strokeStyle = `rgba(150,240,255,${(1 - rr / (r * 2.4)) * 0.6 * b})`; g.lineWidth = 3; g.beginPath(); g.arc(px, py, rr, 0, 7); g.stroke(); }
          g.globalCompositeOperation = 'source-over';
        }
        // Texto
        const li = Math.min(lines.length - 1, Math.floor(t / 3.5));
        const la = IE.clamp((t - li * 3.5) / 0.8, 0, 1) * IE.clamp((li * 3.5 + 3.5 - t) / 0.5 + (li === lines.length - 1 ? 9 : 0), 0, 1);
        g.fillStyle = `rgba(230,245,255,${la})`; g.textAlign = 'center';
        g.font = `${Math.round(Math.min(w, h) * 0.035)}px sans-serif`;
        wrap(g, lines[li], cx, h * 0.86, w * 0.85, Math.min(w, h) * 0.045);
        if (t > lines.length * 3.5 + 1.5) { finish(); return; }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    },
  };
  function wrap(g, text, x, y, maxW, lh) {
    const words = text.split(' '); let line = '', yy = y;
    for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
    g.fillText(line, x, yy);
  }
  function showVictory(S) {
    const st = S.stats;
    let total = 0; for (const k in st.produced) total += st.produced[k];
    const el = document.getElementById('victory');
    const path = S.choices.path ? IE.DECISIONS.path.options.find(o => o.id === S.choices.path).name : '—';
    const pol = S.choices.policy ? IE.DECISIONS.policy.options.find(o => o.id === S.choices.policy).name : '—';
    el.innerHTML = `<div class="vbox"><h1>🌐 Planeta restaurado</h1><p>El Proyecto Horizonte está activo. La crisis energética ha terminado.</p>
      <table class="tbl"><tr><td>Tiempo de campaña</td><td>${IE.fmtTime(st.playTime)}</td></tr><tr><td>Objetos producidos</td><td>${IE.fmtNum(total)}</td></tr>
      <tr><td>Pico de potencia</td><td>${IE.fmtPower(st.peakPower)}</td></tr><tr><td>Tecnologías</td><td>${IE.TECH_IDS.filter(t => S.tech[t]).length}/${IE.TECH_IDS.length}</td></tr>
      <tr><td>Entregas por tren / camión</td><td>${IE.fmtNum(st.trainDelivered)} / ${IE.fmtNum(st.truckDelivered)}</td></tr><tr><td>Edificios</td><td>${S.ents.size}</td></tr>
      <tr><td>Política energética</td><td>${pol}</td></tr><tr><td>Corazón del proyecto</td><td>${path}</td></tr><tr><td>Contaminación final</td><td>${Math.round(S.pollution)}</td></tr></table>
      <p class="dim">Puedes seguir jugando en modo libre: optimiza la megafactoría y bate tus récords.</p>
      <button data-a="free" onclick="IE.UI.act({a:'free'})">Continuar en modo libre</button></div>`;
    el.classList.add('show');
    IE.saveLocal(S);
  }
})();
