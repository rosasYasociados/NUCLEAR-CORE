/* FALSE ALARMS (Update 07 · Fase 2). Alertas de sensores que pueden ser reales o falsas (todo ficticio).
   - Una sola alerta a la vez; NUNCA crea fallas reales ni toca Engine.fail/faults: las alertas reales solo "señalan" algo que ya existe.
   - Temporizadores en tiempo real (dt del bucle principal), independientes de la velocidad de animación. Sin setInterval/setTimeout propios.
   - Interfaz propia (escena #sceneFA); al cerrarla no queda nada animándose. */
(function (N) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var rnd = N.Engine.rnd;
  var WINDOW = 75, DIAG_MAX = 2, DIAG_TIME = 2.5, SAMPLE = 0.5, HIST = 40;
  var PTS = { falseOk: 15, realOk: 20, falseMiss: -10, realMiss: -20, ignored: -5, ignoredReal: -10 };
  var KINDS = {
    spike: 'daba picos intermitentes mientras los otros dos mantenían una lectura normal',
    stuck: 'estaba bloqueado en un valor fijo (señal plana, sin variación)',
    noisy: 'mostraba ruido errático con baja calidad de señal',
    drift: 'derivaba lentamente por descalibración mientras los otros dos no variaban'
  };

  function modSt(id, label) { var f = N.Engine.faults[id], on = N.Engine.mods[id]; return { l: label, v: f ? 'FAULT' : on ? 'ONLINE' : 'OFFLINE', c: f ? 'crit' : on ? 'ok' : 'warn' }; }
  function failSt(id, label) { var o = N.Failures.get(id); return { l: label, v: o ? 'ACTIVA · NIVEL ' + o.sev : 'SIN FALLAS', c: o ? 'crit' : 'ok' }; }

  var TYPES = [
    { id: 'thermal', name: 'PRIMARY LOOP TEMPERATURE CRITICAL', unit: 'ºS', lo: 0, hi: 110, thr: 68, dir: 1, code: 'TS', msg: 'Temperatura del circuito primario fuera de rango. Posible fallo de refrigeración.',
      val: function (s) { return s.temp; }, rel: function () { return [modSt('cooling', 'Cooling Module'), failSt('cooling', 'Cooling System')]; } },
    { id: 'rad', name: 'RADIATION LEAK DETECTED', unit: 'pts', lo: 0, hi: 100, thr: 45, dir: 1, code: 'RM', msg: 'Los RAD-POINTS de la cámara superan el límite. Posible fuga por el blindaje.',
      val: function (s) { return s.rad; }, rel: function () { return [modSt('shield', 'Shielding Module'), failSt('shields', 'Shields')]; } },
    { id: 'stab', name: 'FIELD STABILITY DROP', unit: '%', lo: 0, hi: 100, thr: 78, dir: -1, code: 'FS', msg: 'La estabilidad del campo cae bajo el mínimo. Posible cortocircuito o desfase.',
      val: function (s) { return s.stab; }, rel: function () { return [modSt('stabilizer', 'Stabilizer'), failSt('circuit', 'Short Circuit'), failSt('controls', 'Controls')]; } },
    { id: 'energy', name: 'POWER OUTPUT SURGE', unit: 'MSU', lo: 0, hi: 130, thr: 108, dir: 1, code: 'PW', msg: 'Salida de energía por encima del límite. Posible sobreproducción.',
      val: function (s) { return s.energy; }, rel: function () { return [modSt('energy', 'Energy Module'), failSt('overload', 'Overproduction')]; } },
    { id: 'press', name: 'COOLANT PRESSURE SPIKE', unit: 'KPS', lo: 20, hi: 120, thr: 78, dir: 1, code: 'CP', msg: 'Presión del refrigerante anómala. Posible obstrucción en tuberías.',
      val: function (s) { return 30 + s.temp * 0.6; }, rel: function () { return [modSt('cooling', 'Cooling Module'), failSt('cooling', 'Cooling System')]; } }
  ];
  function holds(t, v) { return t.dir > 0 ? v >= t.thr : v <= t.thr; }
  function calm(t, v) { return t.dir > 0 ? v < t.thr * 0.93 : v > t.thr + 6; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 0.75; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function log(m, type) { N.Dashboard.log(m, type || 'info', 'SENSOR'); }

  var a = null, view = null, score = 0, cnt = { ok: 0, bad: 0, ign: 0 }, cool = rnd(18, 30), sampleAcc = 0;
  var scene, body, card = null, list, isOpen = false, lastSec = -1, diagRun = null, cardSec = -1;

  function chip() {
    var c = $('saScore'); if (!c) return;
    c.textContent = 'SENSORES ' + (score > 0 ? '+' : '') + score + ' pts';
    c.title = 'Correctas: ' + cnt.ok + ' · Incorrectas: ' + cnt.bad + ' · Ignoradas: ' + cnt.ign;
  }
  function canSpawn(sim) {
    return sim.mode === 'running' && !sim.demo && !a && !view && !isOpen && cool <= 0 && !N.Repair.isOpen() && !N.Minigame.isOpen &&
      sim.state !== 'EMERGENCY' && sim.state !== 'CONTAINMENT FAILURE' && sim.state !== 'OFFLINE';
  }
  function fmt(t, v) { return v.toFixed(1) + ' ' + t.unit; }

  // ---- Lectura simulada de un sensor ----
  function base(sim) { return a.type.val(sim); }
  function read(i, sim) {
    var t = a.type, b = base(sim), sg = (t.hi - t.lo) * 0.008, n = gauss() * sg;
    if (a.real || i !== a.bad) return clamp(b + n, t.lo, t.hi);
    switch (a.kind) {
      case 'spike': return clamp((a.age % 4) < 2.2 ? a.alarm + gauss() * sg * 2 : b + n, t.lo, t.hi);
      case 'stuck': return a.alarm;
      case 'noisy': return clamp(a.alarm + (Math.random() - 0.5) * (t.hi - t.lo) * 0.3, t.lo, t.hi);
      default:      return clamp(b + (a.alarm - b) * Math.min(1, 0.85 + a.age / 60), t.lo, t.hi);
    }
  }

  // ---- Alerta (tarjeta del dashboard) ----
  function buildCard() {
    card = document.createElement('article'); card.className = 'sa-card'; card.setAttribute('data-id', a.type.id);
    card.innerHTML = '<div class="sa-head"><b class="sa-name"></b><span class="sa-badge mono">SENSOR · SIN VERIFICAR</span></div><p class="sa-msg"></p>' +
      '<p class="sa-note">Lectura sin confirmar: investiga antes de actuar. Puede ser un error del sensor.</p>' +
      '<div class="sa-meta mono"><span>VENTANA DE RESPUESTA <b class="sa-time">0</b> s</span></div><span class="bar"><i class="sa-bar"></i></span>' +
      '<button class="btn pri sa-btn" type="button">INVESTIGAR ALERTA</button>';
    card.querySelector('.sa-name').textContent = a.type.name;
    card.querySelector('.sa-msg').textContent = a.type.msg + ' Lectura reportada: ' + fmt(a.type, a.alarm) + '.';
    list.appendChild(card); list.hidden = false;
  }
  function paintCard() {
    if (!card) return;
    var sec = Math.ceil(Math.max(0, a.left));
    card.querySelector('.sa-time').textContent = sec;
    card.querySelector('.sa-bar').style.width = Math.max(0, a.left / WINDOW * 100) + '%';
    card.querySelector('.sa-btn').textContent = a.opened ? 'REINVESTIGAR' : 'INVESTIGAR ALERTA';
  }
  function dropCard() { if (card && card.parentNode) card.parentNode.removeChild(card); card = null; if (list) list.hidden = !list.children.length; }

  function spawn(sim) {
    var real = [], fake = [];
    TYPES.forEach(function (t) { var v = t.val(sim); if (holds(t, v)) real.push(t); else if (calm(t, v)) fake.push(t); });
    var truth = real.length && (Math.random() < 0.5 || !fake.length), t = truth ? pick(real) : fake.length ? pick(fake) : null;
    if (!t) { cool = 5; return false; }
    var alarm = t.dir > 0 ? t.thr * 1.12 + rnd(0, t.thr * 0.12) : t.thr * 0.72 - rnd(0, 6);
    a = { type: t, real: !!truth, kind: truth ? 'real' : pick(['spike', 'stuck', 'noisy', 'drift']), bad: Math.floor(Math.random() * 3), age: 0, left: WINDOW,
      alarm: clamp(truth ? t.val(sim) : alarm, t.lo, t.hi), opened: false, diag: [null, null, null], diagUsed: 0, h: [[], [], []], q: [], cal: [] };
    for (var i = 0; i < 3; i++) {
      var f = !a.real && i === a.bad;
      a.q.push(f ? (a.kind === 'spike' ? rnd(58, 70) : a.kind === 'stuck' ? rnd(24, 40) : a.kind === 'noisy' ? rnd(35, 55) : rnd(84, 91)) : rnd(93, 99));
      a.cal.push(f && Math.random() < 0.7 ? Math.round(rnd(38, 90)) : Math.round(rnd(1, 20)));
    }
    sampleAcc = 0; for (i = 0; i < 6; i++) sample(sim, true);
    cardSec = -1; buildCard(); paintCard();
    log('ALERTA: ' + t.name + ' — ' + t.msg + ' Lectura reportada ' + fmt(t, a.alarm) + ' (sin verificar).', 'warn');
    N.Audio.play('notify');
    return true;
  }
  function sample(sim, quiet) {
    for (var i = 0; i < 3; i++) { var h = a.h[i]; h.push(read(i, sim)); if (h.length > HIST) h.shift(); }
    if (!quiet && isOpen) paintLive(sim);
  }

  // ---- Interfaz de investigación ----
  function buildScene() {
    var t = a.type, h = '';
    for (var i = 0; i < 3; i++) {
      h += '<div class="fa-s" data-i="' + i + '"><div class="fa-s-top"><b>SENSOR ' + 'ABC'.charAt(i) + '</b><span class="mono">' + t.code + '-' + (101 + i) + '</span></div>' +
        '<div class="fa-val mono">--</div>' +
        '<svg class="fa-spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><line class="fa-thr" x1="0" x2="120"/><polyline points=""/></svg>' +
        '<dl class="fa-meta"><div><dt>SEÑAL</dt><dd class="fa-q"></dd></div><div><dt>CALIBRADO</dt><dd class="fa-cal"></dd></div><div><dt>AUTODIAGNÓSTICO</dt><dd class="fa-st">SIN EJECUTAR</dd></div></dl>' +
        '<button class="btn sm fa-diag" type="button" data-i="' + i + '">AUTODIAGNÓSTICO</button></div>';
    }
    body.innerHTML = '<div class="fa-sensors">' + h + '</div><div class="fa-cross"><h3 class="mono">VERIFICACIÓN CRUZADA</h3><dl class="fa-rows">' +
      '<div><dt>Umbral de alarma</dt><dd class="mono">' + (t.dir > 0 ? '> ' : '< ') + t.thr + ' ' + t.unit + '</dd></div>' +
      '<div><dt>Lectura que disparó la alerta</dt><dd class="mono">' + fmt(t, a.alarm) + '</dd></div>' +
      '<div><dt>Estado del reactor</dt><dd class="mono fa-gen"></dd></div></dl><div class="fa-rel"></div><p class="fa-dg mono"></p></div>';
    var thr = 35 - clamp((t.thr - t.lo) / (t.hi - t.lo), 0, 1) * 34;
    Array.prototype.forEach.call(body.querySelectorAll('.fa-thr'), function (l) { l.setAttribute('y1', thr); l.setAttribute('y2', thr); });
  }
  function paintLive(sim) {
    var v = view || a, t = v.type, i;
    var sv = body.querySelectorAll('.fa-s');
    for (i = 0; i < 3; i++) {
      var h = v.h[i], last = h[h.length - 1], pts = [];
      h.forEach(function (x, k) { pts.push((k / (HIST - 1) * 120).toFixed(1) + ',' + (35 - clamp((x - t.lo) / (t.hi - t.lo), 0, 1) * 34).toFixed(1)); });
      sv[i].querySelector('.fa-val').textContent = (last != null ? last.toFixed(1) : '--') + ' ' + t.unit;
      sv[i].querySelector('polyline').setAttribute('points', pts.join(' '));
      var q = sv[i].querySelector('.fa-q'), qv = clamp(v.q[i] + (v === a ? (Math.random() - 0.5) * 2 : 0), 0, 100);
      q.textContent = Math.round(qv) + '%'; q.className = 'fa-q ' + (qv < 70 ? 'crit' : qv < 90 ? 'warn' : 'ok');
      sv[i].querySelector('.fa-cal').textContent = 'hace ' + v.cal[i] + ' d';
    }
    var g = body.querySelector('.fa-gen'); if (g) g.textContent = sim.state + ' · estab ' + Math.round(sim.stab) + '%';
    var rel = body.querySelector('.fa-rel');
    if (rel) rel.innerHTML = t.rel().map(function (r) { return '<div class="fa-r"><span>' + r.l + '</span><b class="mono ' + r.c + '">' + r.v + '</b></div>'; }).join('');
  }
  function paintDiag() {
    var v = view || a, sv = body.querySelectorAll('.fa-s'), i, busy = !!diagRun, left = DIAG_MAX - v.diagUsed;
    for (i = 0; i < 3; i++) {
      var st = sv[i].querySelector('.fa-st'), bt = sv[i].querySelector('.fa-diag'), d = v.diag[i];
      if (diagRun && diagRun.i === i) { st.textContent = 'ANALIZANDO ' + Math.round(diagRun.t / DIAG_TIME * 100) + '%'; st.className = 'fa-st warn'; }
      else if (d) { st.textContent = d === 'ok' ? 'AUTOTEST OK' : 'FALLO DE CALIBRACIÓN'; st.className = 'fa-st ' + (d === 'ok' ? 'ok' : 'crit'); }
      bt.disabled = !!view || busy || !!d || left <= 0;
    }
    body.querySelector('.fa-dg').textContent = 'AUTODIAGNÓSTICOS RESTANTES: ' + left + '/' + DIAG_MAX;
  }
  function setActions(done) {
    $('faReal').hidden = done; $('faFalse').hidden = done;
    $('faBack').textContent = done ? 'VOLVER AL DASHBOARD' : 'VOLVER (SEGUIR INVESTIGANDO DESPUÉS)';
  }
  function openScene() {
    if (!a || isOpen) return;
    isOpen = true; lastSec = -1; diagRun = null;
    $('faResult').hidden = true; $('faTitle').textContent = a.type.name; $('faSub').textContent = 'Compara los 3 sensores redundantes, su historial y los sistemas relacionados. ¿La alerta es real o es un error de sensor?';
    buildScene(); setActions(false); paintLive(N.FalseAlarms._sim); paintDiag(); scene.hidden = false;
    log((a.opened ? 'Reinvestigando: ' : 'Investigación iniciada: ') + a.type.name, 'info'); a.opened = true; paintCard(); N.Audio.play('boxOpen');
    paintClock();
  }
  function closeScene() {
    isOpen = false; diagRun = null; view = null; if (scene) scene.hidden = true; if (body) body.innerHTML = '';
    if (a) paintCard(); chip();
  }
  function paintClock() {
    var v = a || view; if (!v) return;
    var rem = Math.max(0, v.left), sec = Math.ceil(rem);
    $('faCount').textContent = sec; $('faTime').style.width = (rem / WINDOW * 100) + '%';
    if (a && sec !== lastSec) { lastSec = sec; if (sec <= 10) N.Audio.countdown(sec); }
  }
  function showResult(ok, text, expl) {
    var r = $('faResult'); r.hidden = false; r.className = 'rp-result mono ' + (ok ? 'ok' : 'fail'); r.textContent = text; $('faSub').textContent = expl;
  }

  function explain(v) {
    if (!v.real) return 'Falsa alarma: el sensor ' + 'ABC'.charAt(v.bad) + ' ' + KINDS[v.kind] + '. Los otros dos sensores y los sistemas relacionados no mostraban ninguna anomalía.';
    return 'Alerta REAL: los tres sensores coincidían y el sistema relacionado confirmaba la anomalía. Corrígela con los controles habituales del reactor.';
  }
  function finish(kind, ans) {                                     // kind: 'ok' | 'bad' | 'ign'
    var v = a, pts, txt;
    if (kind === 'ok') { pts = v.real ? PTS.realOk : PTS.falseOk; cnt.ok++; }
    else if (kind === 'bad') { pts = v.real ? PTS.realMiss : PTS.falseMiss; cnt.bad++; }
    else { pts = v.real ? PTS.ignoredReal : PTS.ignored; cnt.ign++; }
    score += pts; view = isOpen ? v : null; a = null; dropCard(); cool = rnd(40, 75); lastSec = -1; chip();
    var sg = (pts > 0 ? '+' : '') + pts + ' pts';
    if (kind === 'ok') {
      txt = v.real ? 'ALERTA REAL CONFIRMADA' : 'FALSA ALARMA IDENTIFICADA';
      log(txt + ': ' + v.type.name + ' (' + sg + ')', 'ok'); N.Audio.play('win');
    } else if (kind === 'bad') {
      txt = 'CLASIFICACIÓN INCORRECTA';
      log(txt + ': ' + v.type.name + ' era ' + (v.real ? 'REAL y fue descartada' : 'una FALSA ALARMA y se trató como real') + ' (' + sg + ' penalización ficticia)', 'crit');
      N.Audio.play(v.real ? 'alarm' : 'wrong');
    } else {
      txt = 'TIEMPO AGOTADO — ALERTA IGNORADA';
      log('Alerta ignorada: ' + v.type.name + ' (era ' + (v.real ? 'REAL: el problema sigue activo' : 'una falsa alarma') + ') (' + sg + ')', 'warn'); N.Audio.play('warning');
    }
    if (isOpen) {
      showResult(kind === 'ok', txt + ' · ' + sg, explain(v)); setActions(true); diagRun = null; paintDiag(); $('faCount').textContent = '0'; $('faTime').style.width = '0%';
    }
  }
  function decide(ans) { if (a && isOpen && !diagRun) finish((ans === 'real') === a.real ? 'ok' : 'bad'); }

  function interrupt(why) {                                        // apagón, fallo final o reinicio: se cancela sin penalización
    if (a) { log('Alerta de sensores cancelada (' + why + '): ' + a.type.name, 'info'); }
    a = null; dropCard(); closeScene(); chip();
  }

  N.FalseAlarms = {
    _sim: null,
    stats: function () { return { score: score, correct: cnt.ok, wrong: cnt.bad, ignored: cnt.ign, active: !!a }; },
    isOpen: function () { return isOpen; },
    // Fuerza una alerta (pruebas); true si se creó
    start: function () { var s = N.FalseAlarms._sim; if (!s || !s.mode || s.mode !== 'running') return false; cool = 0; return spawn(s); },
    init: function () {
      scene = $('sceneFA'); body = $('faBody'); list = $('saList');
      list.addEventListener('click', function (e) { if (e.target.closest('.sa-btn')) openScene(); });
      $('faReal').addEventListener('click', function () { decide('real'); });
      $('faFalse').addEventListener('click', function () { decide('false'); });
      $('faBack').addEventListener('click', closeScene);
      body.addEventListener('click', function (e) {
        var b = e.target.closest('.fa-diag'); if (!b || b.disabled || !a || diagRun || a.diagUsed >= DIAG_MAX) return;
        diagRun = { i: +b.dataset.i, t: 0 }; N.Audio.play('toggle'); paintDiag();
      });
      chip();
    },
    reset: function () { a = null; view = null; dropCard(); closeScene(); score = 0; cnt = { ok: 0, bad: 0, ign: 0 }; cool = rnd(18, 30); sampleAcc = 0; chip(); },
    // Llamado en cada frame del bucle principal con dt REAL (no depende de la velocidad de la simulación)
    frame: function (dt, sim) {
      N.FalseAlarms._sim = sim;
      var m = sim.mode;
      if (m === 'blackout' || m === 'failed' || m === 'offline') { if (a || isOpen) interrupt(m === 'blackout' ? 'apagón' : m === 'failed' ? 'fallo final' : 'simulación detenida'); return; }
      if (m !== 'running') return;                                 // en pausa todo se congela
      if (!a) { if (!view) { cool = Math.max(0, cool - dt); if (canSpawn(sim)) spawn(sim); } return; }
      a.age += dt; a.left -= dt; sampleAcc += dt;
      if (diagRun) {
        diagRun.t += dt; if (isOpen) paintDiag();
        if (diagRun.t >= DIAG_TIME) {
          var i = diagRun.i; a.diag[i] = (!a.real && i === a.bad) ? 'fail' : 'ok'; a.diagUsed++; diagRun = null;
          log('Autodiagnóstico del sensor ' + 'ABC'.charAt(i) + ': ' + (a.diag[i] === 'ok' ? 'AUTOTEST OK' : 'FALLO DE CALIBRACIÓN'), 'info'); N.Audio.play(a.diag[i] === 'ok' ? 'toggleOn' : 'wrong'); if (isOpen) paintDiag();
        }
      }
      if (sampleAcc >= SAMPLE) { sampleAcc -= SAMPLE; sample(sim); }
      var cs = Math.ceil(a.left); if (cs !== cardSec) { cardSec = cs; paintCard(); }
      if (isOpen) paintClock();
      if (a.left <= 0) finish('ign');
    }
  };
})(window.NCS = window.NCS || {});
