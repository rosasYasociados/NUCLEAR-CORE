/* VISUAL DAMAGE (Update 07 · Fase 2). El laboratorio se degrada visualmente según la gravedad del estado general (todo ficticio).
   Nivel continuo 0..1 que sube rápido y baja despacio al resolverse la situación:
   ESTABLE (0) · INESTABLE (~.3) · ALERTA (~.6) · EMERGENCIA (.85+) · GAME OVER (transición especial).
   Sin temporizadores propios: todo se actualiza desde el bucle principal. Respeta Visual Effects y prefers-reduced-motion. */
(function (N) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var TAU = Math.PI * 2, rnd = function (a, b) { return a + Math.random() * (b - a); };
  var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var cv, cx, W = 1, H = 1, R = 1, dim, tint, pipes = [], nz, nzx, nzf = 0, panels = [];
  var lvl = 0, tgt = 0, t = 0, ot = 0, cls = '', lastDm = -1, clean = true, fxDt = 0, bandY = -60, collapse = false;
  var flick = [], glitch = [], smoke = [], sparks = [], nextFlick = 2, nextGlitch = 3, nextSpark = 2, sndT = -9, dimOp = 0;

  function el(tag, c, css, parent) { var e = document.createElement(tag); if (c) e.className = c; if (css) e.style.cssText = css; if (parent) parent.appendChild(e); return e; }

  // ---- Tuberías del laboratorio (decorativas; su aspecto dañado depende de --dm) ----
  function decorate(p, horiz, many) {
    var pos = horiz ? 'left' : 'top', i, k;
    (many ? [6, 20, 34, 48, 62, 76, 90] : [12, 38, 64, 88]).forEach(function (j) { el('i', 'lj', pos + ':' + j + '%', p); });
    (many ? [13, 28, 55, 70, 85] : [25, 52, 78]).forEach(function (d, n) {
      el('i', 'lrust', pos + ':' + d + '%', p);
      if (n % 2 === 0) { var c = el('span', 'lcrack', pos + ':' + (d + 3) + '%', p); c.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0l-4 7 5 5-5 6 3 6"/></svg>'; }
      if (n !== 1) { var w = el('span', 'steam-w', pos + ':' + d + '%', p); el('i', 'steam', '--sd:' + (n * 0.7).toFixed(1) + 's', w); }
      if (n === 2 || (many && n === 4)) { var s = el('span', 'spark-w', pos + ':' + (d + 1) + '%', p); el('i', 'lspark', '--sd:' + (n * 0.4).toFixed(1) + 's', s); }
    });
  }
  function build() {
    var wrap = document.querySelector('.core-wrap'), hd = document.querySelector('header.top');
    if (wrap && !$('labPipes')) {
      var g = el('div', 'lab-pipes', null, wrap); g.id = 'labPipes'; g.setAttribute('aria-hidden', 'true'); pipes.push(g);
      decorate(el('div', 'lp lv lp-l', null, g), false); decorate(el('div', 'lp lv lp-r', null, g), false); decorate(el('div', 'lp lh lp-t', null, g), true);
    }
    if (hd && !$('pipeRun')) {
      var r = el('div', 'lab-pipes pipe-run lp lh', null, null); r.id = 'pipeRun'; r.setAttribute('aria-hidden', 'true'); hd.parentNode.insertBefore(r, hd.nextSibling); pipes.push(r); decorate(r, true, true);
    }
  }

  // ---- Nivel objetivo según el estado general de la simulación ----
  function target(sim) {
    var m = sim.mode;
    if (m === 'failed') return 1;
    if (m === 'offline') return 0;
    if (m === 'blackout') return 0.6;
    var st = sim.state, v = st === 'UNSTABLE' ? 0.3 : st === 'RADIATION ALERT' ? 0.58 : st === 'EMERGENCY' ? 0.85 : st === 'CONTAINMENT FAILURE' ? 1 : 0, k, mx = 0;
    v = Math.max(v, Math.min(0.95, sim.risk / N.Engine.RISK_LIMIT * 0.9));              // el riesgo acumulado agrava el aspecto poco a poco
    for (k in N.Engine.fail) mx = Math.max(mx, N.Engine.fail[k]);
    if (mx) v = Math.max(v, [0, 0.3, 0.55, 0.8, 0.95][mx]);
    for (k in N.Engine.faults) if (N.Engine.faults[k]) v = Math.max(v, 0.3);
    return v;
  }

  function noiseTex() {
    var d = nzx.createImageData(192, 108), px = d.data, i, v;
    for (i = 0; i < px.length; i += 4) { v = Math.random(); px[i] = px[i + 1] = px[i + 2] = 255; px[i + 3] = v > 0.86 ? (v * 255) | 0 : 0; }
    nzx.putImageData(d, 0, 0);
  }
  function resize() {
    var w = window.innerWidth, h = window.innerHeight; R = Math.min(1, 900 / w);
    W = Math.max(1, Math.round(w * R)); H = Math.max(1, Math.round(h * R)); cv.width = W; cv.height = H;
  }
  function cleanup() {
    if (cx) cx.clearRect(0, 0, W, H);
    smoke.length = 0; sparks.length = 0; flick.length = 0;
    glitch.forEach(function (g) { g.el.classList.remove('dmg-glitch'); }); glitch.length = 0;
    if (dim && dimOp) { dim.style.opacity = 0; dimOp = 0; }
    clean = true;
  }

  function draw(dt, over, L) {
    cx.clearRect(0, 0, W, H);
    var i, a, S = H / 700;
    // Interferencia: ruido estático
    var na = Math.min(0.06, Math.max(0, (L - 0.3) * 0.08)) + (over ? 0.3 * Math.min(1, ot / 1.5) : 0);
    if (na > 0.01) { if (++nzf % 3 === 0) noiseTex(); cx.globalAlpha = na; cx.imageSmoothingEnabled = false; cx.drawImage(nz, 0, 0, W, H); cx.globalAlpha = 1; }
    // Barras de distorsión horizontales
    var nb = Math.floor(L * 6 * Math.random()) + (over ? 4 : 0);
    for (i = 0; i < nb; i++) {
      a = rnd(0.05, 0.12 + L * 0.18); var r = Math.random();
      cx.fillStyle = r < 0.5 ? 'rgba(90,220,255,' + a + ')' : r < 0.8 && L > 0.55 ? 'rgba(255,70,90,' + a + ')' : 'rgba(255,255,255,' + a * 0.6 + ')';
      cx.fillRect(rnd(0, W * 0.5), rnd(0, H), rnd(W * 0.15, W * 0.9), rnd(1, 4 + L * 9) * S);
    }
    // Banda de refresco rodante
    if (L > 0.18 || over) {
      bandY += H * 0.14 * dt * (0.6 + L); if (bandY > H + 60) bandY = -60;
      var g = cx.createLinearGradient(0, bandY - 40, 0, bandY + 40); a = 0.04 + L * 0.07;
      g.addColorStop(0, 'rgba(120,220,255,0)'); g.addColorStop(0.5, 'rgba(120,220,255,' + a + ')'); g.addColorStop(1, 'rgba(120,220,255,0)');
      cx.fillStyle = g; cx.fillRect(0, bandY - 40, W, 80);
    }
    // Destellos rojos de la transición final
    if (over && ot < 2.6) { cx.fillStyle = 'rgba(255,40,60,' + (0.16 * Math.abs(Math.sin(ot * 13))).toFixed(3) + ')'; cx.fillRect(0, 0, W, H); }
    // Humo ficticio desde los bordes inferiores
    if (L > 0.42 && smoke.length < 26 && Math.random() < (L - 0.35) * 6 * dt) {
      var side = Math.random();
      smoke.push({ x: (side < 0.4 ? rnd(0, 0.2) : side < 0.8 ? rnd(0.8, 1) : rnd(0.2, 0.8)) * W, y: H + 20, r: rnd(30, 70) * S, vx: rnd(-10, 10) * S, vy: -rnd(20, 45) * S, life: 0, max: rnd(3.5, 6) });
    }
    for (i = smoke.length - 1; i >= 0; i--) {
      var s = smoke[i]; s.life += dt;
      if (s.life >= s.max) { smoke.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.r += 14 * S * dt; var u = s.life / s.max, al = Math.sin(u * Math.PI) * (0.1 + L * 0.2);
      var sg = cx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r); var red = L > 0.8;
      sg.addColorStop(0, (red ? 'rgba(95,45,50,' : 'rgba(70,82,98,') + al.toFixed(3) + ')'); sg.addColorStop(1, 'rgba(30,36,48,0)');
      cx.fillStyle = sg; cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, TAU); cx.fill();
    }
    // Chispas
    if (L > 0.55 || over) {
      nextSpark -= dt;
      if (nextSpark <= 0 && sparks.length < 70) {
        nextSpark = rnd(0.5, 2.2) / (0.3 + L); var bx = rnd(0.04, 0.96) * W, by = rnd(0.04, 0.55) * H, n = 8 + ((Math.random() * 8) | 0);
        for (i = 0; i < n; i++) { var an = rnd(0, TAU), v = rnd(60, 220) * S; sparks.push({ x: bx, y: by, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 50 * S, life: 0, max: rnd(0.3, 0.7) }); }
        if (t - sndT > 1.6) { sndT = t; N.Audio.play('weld'); }
      }
    }
    cx.globalCompositeOperation = 'lighter'; cx.lineWidth = Math.max(1, 1.6 * R);
    for (i = sparks.length - 1; i >= 0; i--) {
      var p = sparks[i]; p.life += dt;
      if (p.life >= p.max) { sparks.splice(i, 1); continue; }
      p.vy += 520 * S * dt; p.x += p.vx * dt; p.y += p.vy * dt; var q = 1 - p.life / p.max;
      cx.strokeStyle = 'hsla(' + (28 + q * 14).toFixed(0) + ',100%,65%,' + q.toFixed(2) + ')';
      cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); cx.stroke();
    }
    cx.globalCompositeOperation = 'source-over';
  }

  N.Damage = {
    level: function () { return lvl; },
    name: function () { return cls === 'dmg-over' ? 'GAME OVER' : lvl < 0.05 ? 'ESTABLE' : lvl < 0.45 ? 'INESTABLE' : lvl < 0.72 ? 'ALERTA' : 'EMERGENCIA'; },
    init: function () {
      cv = $('dmgFx'); cx = cv.getContext('2d'); dim = $('dmgDim'); tint = $('dmgTint');
      nz = document.createElement('canvas'); nz.width = 192; nz.height = 108; nzx = nz.getContext('2d');
      build(); pipes.push(tint); resize(); window.addEventListener('resize', resize);
      panels = Array.prototype.slice.call(document.querySelectorAll('.grid > .panel, header.top'));
    },
    reset: function () {
      lvl = 0; tgt = 0; ot = 0; collapse = false; lastDm = -1; cleanup();
      document.body.classList.remove('dmg-0', 'dmg-1', 'dmg-2', 'dmg-3', 'dmg-over', 'dmg-collapse'); cls = '';
      pipes.forEach(function (p) { p.style.setProperty('--dm', 0); });
    },
    // Llamado en cada frame del bucle principal (dt real)
    frame: function (dt, sim) {
      t += dt;
      var over = sim.mode === 'failed', vfx = !(N.Settings && N.Settings.get('vfx') === false), b = document.body, i;
      tgt = target(sim); ot = over ? ot + dt : 0;
      var d = tgt - lvl; lvl = Math.abs(d) < 0.003 ? tgt : lvl + d * Math.min(1, dt * (d > 0 ? 1.6 : 0.5));    // sube rápido, baja despacio
      var L = RM ? Math.min(lvl, 0.35) : lvl;
      // Clases de iluminación y variable --dm de las tuberías (solo cuando cambian)
      var c = over ? 'dmg-over' : lvl < 0.05 ? 'dmg-0' : lvl < 0.45 ? 'dmg-1' : lvl < 0.72 ? 'dmg-2' : 'dmg-3';
      if (c !== cls) { b.classList.remove('dmg-0', 'dmg-1', 'dmg-2', 'dmg-3', 'dmg-over'); b.classList.add(c); cls = c; }
      if (Math.abs(lvl - lastDm) > 0.01) { lastDm = lvl; var dv = lvl.toFixed(2); for (i = 0; i < pipes.length; i++) pipes[i].style.setProperty('--dm', dv); }
      if (over && ot > 2.3 && !collapse) { collapse = true; b.classList.add('dmg-collapse'); }
      if (!vfx || (L < 0.02 && !over && !smoke.length && !sparks.length)) { if (!clean) cleanup(); return; }
      if (over && ot > 4) { if (!clean) cleanup(); return; }
      clean = false;
      if (!RM) {
        // Parpadeo de luces
        if (L > 0.12) {
          nextFlick -= dt;
          if (nextFlick <= 0) {
            nextFlick = rnd(0.4, 2.8) / (0.4 + L * 2.2);
            var n = L > 0.6 ? 1 + ((Math.random() * 3) | 0) : 1, at = t;
            for (i = 0; i < n; i++) { at += rnd(0.05, 0.16); flick.push({ s: at, e: at + rnd(0.04, 0.14), a: rnd(0.25, 0.75) * (0.5 + L * 0.6) }); }
          }
        }
        var op = 0;
        for (i = flick.length - 1; i >= 0; i--) { if (t > flick[i].e) { flick.splice(i, 1); continue; } if (t >= flick[i].s && flick[i].a > op) op = flick[i].a; }
        if (op !== dimOp) { dimOp = op; dim.style.opacity = op; }
        // Distorsiones breves en paneles
        for (i = glitch.length - 1; i >= 0; i--) if (t > glitch[i].e) { glitch[i].el.classList.remove('dmg-glitch'); glitch.splice(i, 1); }
        if (L > 0.2 && !(over && ot > 3.2)) {
          nextGlitch -= dt;
          if (nextGlitch <= 0) {
            nextGlitch = rnd(1.2, 5) / (0.4 + L * 2.5);
            var pe = panels[Math.floor(Math.random() * panels.length)];
            if (pe && !pe.classList.contains('dmg-glitch')) { pe.classList.add('dmg-glitch'); glitch.push({ el: pe, e: t + rnd(0.18, 0.34) }); }
          }
        }
      }
      // Canvas de interferencias, humo y chispas (con límite de fotogramas para ahorrar CPU)
      fxDt += dt;
      var step = over ? 0.016 : L < 0.4 ? 0.05 : 0.033;
      if (fxDt >= step) { draw(Math.min(fxDt, 0.1), over, over ? 1 : L); fxDt = 0; }
    }
  };
})(window.NCS = window.NCS || {});
