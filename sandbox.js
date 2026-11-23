/* Modo SANDBOX: panel de pruebas independiente. No tiene sistemas propios de eventos ni de temporizadores:
   solo llama a las mismas funciones que usa el modo normal (Failures, Emergency, apagones de main.js, Engine).
   Los eventos se listan dinámicamente (nuevas fallas o variantes de apagón aparecen solas); N.Sandbox.register() admite otros. */
(function (N) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var H = null, panel, evHost, msgEl, stEl, conf, confCb = null, opened = false, built = '', byId = {}, rowsEl = {}, extra = [];
  var FORCE = ['UNSTABLE', 'RADIATION ALERT', 'EMERGENCY', 'CONTAINMENT FAILURE'];

  function log(m, t) { N.Dashboard.log(m, t || 'info', 'SANDBOX'); }
  function say(m) { msgEl.textContent = m; }
  function press(el, on, label) { el.setAttribute('aria-pressed', on); el.textContent = label + (on ? 'ON' : 'OFF'); }

  // Lista de eventos disponibles (se recalcula si cambia el conjunto de ids)
  function entries() {
    var out = [];
    N.Failures.list().forEach(function (f) {
      out.push({
        g: 'Fallas del sistema', id: 'f-' + f.id, name: f.name, desc: f.msg,
        active: function () { return !!N.Failures.get(f.id); },
        detail: function () {
          var o = N.Failures.get(f.id); if (!o) return 'INACTIVA';
          return 'ACTIVA · NIVEL ' + o.sev + ' · ' + Math.ceil(o.left) + ' s' + (f.id === 'overload' ? ' · ' + Math.floor(o.hold) + '/' + o.need + ' s' : '');
        },
        start: function () {
          if (!H.ensureRunning()) return 'La simulación terminó: reiníciala.';
          if (H.sim().mode === 'blackout') return 'Hay un apagón activo.';
          return N.Failures.start(f.id) ? true : 'Esa falla ya está activa.';
        },
        end: function () { return N.Failures.end(f.id); },
        open: f.game ? function () { if (N.Failures.get(f.id)) N.Repair.open(f.id); } : null
      });
    });
    out.push({
      g: 'Instabilidad de módulos', id: 'm-fault', name: 'MODULE FAULT', desc: 'Un módulo aleatorio falla y desestabiliza el reactor (se repara con su interruptor).',
      active: function () { return !!N.Emergency.active(); },
      detail: function () { var a = N.Emergency.active(); return a ? 'ACTIVO · ' + a : 'INACTIVO'; },
      start: function () { if (!H.ensureRunning()) return 'La simulación terminó: reiníciala.'; return N.Emergency.start() ? true : 'Ya hay un fallo de módulo activo.'; },
      end: function () { return N.Emergency.end(); }
    });
    H.kinds().forEach(function (k) {
      out.push({
        g: 'Apagones y recuperación', id: 'b-' + k.id, name: k.name, desc: k.desc,
        active: function () { return H.blackoutKind() === k.id; },
        detail: function () { return H.blackoutKind() === k.id ? 'ACTIVO' : 'INACTIVO'; },
        start: function () { return H.startBlackout(k.id); },
        end: function () { return H.endBlackout(); }
      });
    });
    return out.concat(extra);
  }

  function build() {
    var list = entries(), sig = list.map(function (e) { return e.id; }).join('|');
    if (sig === built) return; built = sig; byId = {}; rowsEl = {}; evHost.innerHTML = '';
    var group = '', h;
    list.forEach(function (e) {
      if (e.g !== group) { group = e.g; h = document.createElement('h4'); h.textContent = group; evHost.appendChild(h); }
      byId[e.id] = e;
      var row = document.createElement('div'); row.className = 'sbx-row'; row.setAttribute('data-id', e.id);
      row.innerHTML = '<div class="sbx-info"><b></b><small></small><span class="sbx-chip mono"></span></div><div class="sbx-btns">' +
        '<button class="btn sm" type="button" data-a="start">INICIAR</button>' + (e.open ? '<button class="btn sm" type="button" data-a="open">MINIJUEGO</button>' : '') +
        '<button class="btn sm" type="button" data-a="end">FINALIZAR</button><button class="btn sm" type="button" data-a="restart">REINICIAR</button></div>';
      row.querySelector('b').textContent = e.name; row.querySelector('small').textContent = e.desc;
      evHost.appendChild(row); rowsEl[e.id] = row;
    });
  }
  function overrides() {
    return !N.Failures.auto || !N.Emergency.auto.events || !N.Emergency.auto.blackout || !!N.Engine.sbx.state || N.Engine.sbx.freezeRisk;
  }
  function ask(msg, cb) { $('sbxConfirmMsg').textContent = msg; confCb = cb; conf.hidden = false; $('sbxYes').focus(); }
  function closeConfirm() { conf.hidden = true; confCb = null; }

  function startEntry(e) {
    var r = e.start();
    if (r === true) { log('Evento iniciado desde Sandbox: ' + e.name, 'warn'); say('Iniciado: ' + e.name); } else say(r || 'No se pudo iniciar.');
    N.Sandbox.refresh();
  }
  function onEvent(ev) {
    var b = ev.target.closest('button[data-a]'); if (!b || b.disabled) return;
    var e = byId[b.closest('.sbx-row').getAttribute('data-id')], a = b.getAttribute('data-a');
    if (a === 'start') startEntry(e);
    else if (a === 'open') e.open();
    else if (a === 'end') ask('¿Finalizar «' + e.name + '»? El sistema volverá al estado que le corresponda.', function () {
      var ok = e.end(); if (ok !== false) { log('Evento finalizado desde Sandbox: ' + e.name, 'warn'); say('Finalizado: ' + e.name); } N.Sandbox.refresh();
    });
    else if (a === 'restart') ask('¿Reiniciar «' + e.name + '»? Se finalizará y se volverá a iniciar.', function () {
      e.end(); log('Evento reiniciado desde Sandbox: ' + e.name, 'warn'); startEntry(e);
    });
  }

  N.Sandbox = {
    // Permite añadir eventos de otros módulos: { g, id, name, desc, active(), detail(), start()->true|msg, end(), open? }
    register: function (def) { extra.push(def); built = ''; },
    init: function (hooks) {
      H = hooks; panel = $('sandbox'); evHost = $('sbxEvents'); msgEl = $('sbxMsg'); stEl = $('sbxStatus'); conf = $('sbxConfirm');
      var sb = $('sbxStates');
      FORCE.forEach(function (s) {
        var b = document.createElement('button'); b.className = 'btn sm'; b.type = 'button'; b.setAttribute('data-f', s); b.textContent = s; sb.appendChild(b);
      });
      var rel = document.createElement('button'); rel.className = 'btn sm'; rel.type = 'button'; rel.setAttribute('data-f', ''); rel.textContent = 'LIBERAR ESTADO'; sb.appendChild(rel);
      sb.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-f]'); if (!b) return; var s = b.getAttribute('data-f');
        if (s && !H.ensureRunning()) { say('La simulación terminó: reiníciala.'); return; }
        N.Engine.sbx.state = s || null;
        log(s ? 'Estado de emergencia forzado: ' + s : 'Estado forzado liberado', s ? 'warn' : 'info'); say(s ? 'Forzando: ' + s : 'Estado liberado'); N.Sandbox.refresh();
      });
      evHost.addEventListener('click', onEvent);
      panel.querySelector('.sbx-sim').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var s = b.getAttribute('data-s'), t = b.getAttribute('data-t');
        if (s === 'reset') ask('¿Reiniciar la simulación? Se perderá la partida actual.', function () { H.reset(); say('Simulación reiniciada'); N.Sandbox.refresh(); });
        else if (s === 'stable') ask('¿Restaurar el estado estable? Finaliza todos los eventos y repara los módulos.', function () { say(H.restoreStable() ? 'Estado estable restaurado' : 'La simulación terminó: reiníciala.'); N.Sandbox.refresh(); });
        else if (s === 'normal') {
          N.Failures.auto = true; N.Emergency.auto.events = true; N.Emergency.auto.blackout = true; N.Engine.sbx.state = null; N.Engine.sbx.freezeRisk = false;
          log('Ajustes de prueba restablecidos al modo normal'); say('Ajustes normales restablecidos'); N.Sandbox.refresh();
        } else if (t) {
          if (t === 'failures') N.Failures.auto = !N.Failures.auto;
          else if (t === 'blackout') N.Emergency.auto.blackout = !N.Emergency.auto.blackout;
          else if (t === 'module') N.Emergency.auto.events = !N.Emergency.auto.events;
          else if (t === 'risk') N.Engine.sbx.freezeRisk = !N.Engine.sbx.freezeRisk;
          log('Ajuste de prueba cambiado: ' + b.textContent.split(':')[0].trim()); N.Sandbox.refresh();
        }
      });
      $('sbxYes').addEventListener('click', function () { var f = confCb; closeConfirm(); if (f) f(); });
      $('sbxNo').addEventListener('click', closeConfirm);
      $('sbxClose').addEventListener('click', N.Sandbox.close);
      $('btnSandbox').addEventListener('click', function () { if (opened) N.Sandbox.close(); else N.Sandbox.open(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && opened) { if (!conf.hidden) closeConfirm(); else N.Sandbox.close(); } });
    },
    open: function () {
      opened = true; panel.hidden = false; $('btnSandbox').setAttribute('aria-expanded', 'true'); $('btnSandbox').classList.add('active');
      build(); N.Sandbox.refresh();
    },
    close: function () {
      opened = false; panel.hidden = true; closeConfirm(); $('btnSandbox').setAttribute('aria-expanded', 'false'); $('btnSandbox').classList.remove('active');
    },
    // Actualiza estado, interruptores y filas (se llama desde render(): sin temporizadores propios)
    refresh: function () {
      if (!H) return;
      $('btnSandbox').classList.toggle('sbx-on', overrides());               // punto: hay ajustes de prueba activos
      if (!opened) return;
      build();
      var sim = H.sim(), pct = Math.round(sim.risk / N.Engine.RISK_LIMIT * 100);
      stEl.textContent = 'MODO: ' + sim.mode.toUpperCase() + ' · ESTADO: ' + (sim.mode === 'running' || sim.mode === 'blackout' ? sim.state : sim.status) + ' · RIESGO: ' + pct + '%';
      var dead = sim.mode === 'failed';
      for (var id in rowsEl) {
        var e = byId[id], row = rowsEl[id], on = e.active();
        row.classList.toggle('on', on); row.querySelector('.sbx-chip').textContent = e.detail();
        row.querySelector('[data-a=start]').disabled = on || dead;
        row.querySelector('[data-a=end]').disabled = !on || dead;
        row.querySelector('[data-a=restart]').disabled = !on || dead;
        var op = row.querySelector('[data-a=open]'); if (op) op.disabled = !on || dead;
      }
      press(panel.querySelector('[data-t=failures]'), N.Failures.auto, 'FALLAS ALEATORIAS: ');
      press(panel.querySelector('[data-t=blackout]'), N.Emergency.auto.blackout, 'APAGONES ALEATORIOS: ');
      press(panel.querySelector('[data-t=module]'), N.Emergency.auto.events, 'FALLOS DE MÓDULO ALEATORIOS: ');
      press(panel.querySelector('[data-t=risk]'), N.Engine.sbx.freezeRisk, 'CONGELAR RIESGO: ');
      Array.prototype.forEach.call($('sbxStates').children, function (b) {
        var f = b.getAttribute('data-f'); b.classList.toggle('active', f ? N.Engine.sbx.state === f : !N.Engine.sbx.state);
      });
    }
  };
})(window.NCS = window.NCS || {});
