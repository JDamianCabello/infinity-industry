// Entrada táctil y de ratón: arrastrar para mover, pellizcar para zoom, tocar para actuar.
(function () {
  const IE = window.IE;
  const I = IE.Input = {};

  I.init = function (cv, UI) {
    const R = IE.Render;
    const P = new Map();
    let start = null, moved = false, mode = null, pinch = null, holdTimer = null;

    const pos = ev => { const r = cv.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
    const tileAt = p => R.screenToTile(p.x, p.y);
    function clearHold() { if (holdTimer) { clearInterval(holdTimer); holdTimer = null; } }

    cv.addEventListener('pointerdown', ev => {
      cv.setPointerCapture(ev.pointerId);
      const p = pos(ev);
      P.set(ev.pointerId, p);
      if (P.size === 1) {
        start = { x: p.x, y: p.y, cx: R.cam.x, cy: R.cam.y, t: performance.now() };
        moved = false;
        mode = UI.wantsDrag(ev.pointerType) ? 'action' : 'pan';
        if (mode === 'action') UI.onDragStart(tileAt(p));
        if (UI.mode === 'hand') {
          clearHold();
          holdTimer = setInterval(() => { if (!moved && P.size === 1) UI.onTap(tileAt(start), true); }, 380);
        }
      } else if (P.size === 2) {
        clearHold();
        if (mode === 'action') UI.onDragCancel();
        mode = 'pinch';
        const [a, b] = [...P.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, z: R.cam.z, cx: R.cam.x, cy: R.cam.y };
      }
    });
    cv.addEventListener('pointermove', ev => {
      const p = pos(ev);
      if (!P.has(ev.pointerId)) { if (ev.pointerType === 'mouse') UI.onHover(tileAt(p)); return; }
      P.set(ev.pointerId, p);
      if (mode === 'pinch' && P.size >= 2) {
        const [a, b] = [...P.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const z = IE.clamp(pinch.z * d / Math.max(10, pinch.d), 0.18, 3);
        // Mantener fijo el punto bajo el centro del pellizco
        const wx = (pinch.mx - cv.clientWidth / 2) / pinch.z + pinch.cx;
        const wy = (pinch.my - cv.clientHeight / 2) / pinch.z + pinch.cy;
        R.cam.z = z;
        R.cam.x = wx - (mx - cv.clientWidth / 2) / z;
        R.cam.y = wy - (my - cv.clientHeight / 2) / z;
        R.clampCam();
        moved = true;
        return;
      }
      if (!start) return;
      if (Math.hypot(p.x - start.x, p.y - start.y) > 9) moved = true;
      if (mode === 'pan' && moved) {
        R.cam.x = start.cx - (p.x - start.x) / R.cam.z;
        R.cam.y = start.cy - (p.y - start.y) / R.cam.z;
        R.clampCam();
      } else if (mode === 'action') UI.onDrag(tileAt(p));
      if (ev.pointerType === 'mouse') UI.onHover(tileAt(p));
    });
    const up = ev => {
      if (!P.has(ev.pointerId)) return;
      const p = P.get(ev.pointerId);
      P.delete(ev.pointerId);
      clearHold();
      if (P.size === 0) {
        if (mode === 'action') UI.onDragEnd(tileAt(p), moved);
        else if (mode === 'pan' && !moved && start && ev.type === 'pointerup') UI.onTap(tileAt(p));
        mode = null; start = null; pinch = null;
      } else if (P.size === 1 && mode === 'pinch') {
        // Continuar como desplazamiento con el dedo restante
        const q = [...P.values()][0];
        start = { x: q.x, y: q.y, cx: R.cam.x, cy: R.cam.y };
        mode = 'pan'; moved = true;
      }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', ev => {
      ev.preventDefault();
      const p = pos(ev);
      const before = R.screenToWorld(p.x, p.y);
      R.cam.z = IE.clamp(R.cam.z * Math.pow(1.0015, -ev.deltaY), 0.18, 3);
      const after = R.screenToWorld(p.x, p.y);
      R.cam.x += before.x - after.x; R.cam.y += before.y - after.y;
      R.clampCam();
    }, { passive: false });
    cv.addEventListener('contextmenu', ev => { ev.preventDefault(); UI.cancel(); });
    window.addEventListener('keydown', ev => {
      if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA' || ev.target.tagName === 'SELECT')) return;
      const k = ev.key.toLowerCase();
      if (k === 'r') UI.rotate();
      else if (k === 'escape') UI.cancel();
      else if (k === ' ') { UI.togglePause(); ev.preventDefault(); }
      else if (k === 'x' || k === 'delete') UI.setMode(UI.mode === 'demolish' ? 'select' : 'demolish');
      else if (k === 'h') UI.setMode(UI.mode === 'hand' ? 'select' : 'hand');
      else if (k === '+' || k === '=') { R.cam.z = IE.clamp(R.cam.z * 1.2, 0.18, 3); }
      else if (k === '-') { R.cam.z = IE.clamp(R.cam.z / 1.2, 0.18, 3); }
      else if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        const st = 120 / R.cam.z;
        if (k === 'w' || k === 'arrowup') R.cam.y -= st; if (k === 's' || k === 'arrowdown') R.cam.y += st;
        if (k === 'a' || k === 'arrowleft') R.cam.x -= st; if (k === 'd' || k === 'arrowright') R.cam.x += st;
        R.clampCam();
      }
    });
  };
})();
