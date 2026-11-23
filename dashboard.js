/* Paneles de estado, instrumentación, monitor de radiación, reloj y registro de eventos. */
(function (N) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var gT, gE, gS, gR, chart, radChart, logEl;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hms(s) { s = Math.floor(s); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); }
  function themeColor() { return 'hsl(' + (N.hue || 190) + ',100%,60%)'; }
  function radColor() {
    var l = $('radPanel').getAttribute('data-lvl');
    return l === 'CRITICAL' ? '#ff4560' : l === 'HIGH' ? '#ff8a3d' : l === 'ELEVATED' ? '#ffc83d' : '#3dffb0';
  }

  N.Dashboard = {
    init: function () {
      logEl = $('log');
      gT = new N.Charts.Gauge($('gTemp'), 'TEMP', '', 100);
      gE = new N.Charts.Gauge($('gEnergy'), 'ENERGY', '%', 100);
      gS = new N.Charts.Gauge($('gStab'), 'STABILITY', '%', 100);
      gR = new N.Charts.Gauge($('gRad'), 'RAD-PTS', '', 100);
      chart = new N.Charts.Line($('chart'), [themeColor, '#3dffb0', '#ffc83d'], 40);
      radChart = new N.Charts.Line($('radChart'), [radColor], 60);
      var clock = $('clock');
      var tick = function () { var d = new Date(); clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
      tick(); setInterval(tick, 1000);
      this.render({ status: 'OFFLINE', temp: 0, energy: 0, particles: 0, stab: 100, rad: 0, risk: 0, runtime: 0 });
    },

    // Añade una entrada al registro: hora, categoría y descripción (máximo 80, la más reciente arriba)
    log: function (msg, type, cat) {
      if (!logEl) return;
      var d = new Date(), li = document.createElement('li');
      li.className = type || 'info';
      var t = document.createElement('time'); t.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      var c = document.createElement('em'); c.textContent = cat || 'SISTEMA';
      var s = document.createElement('span'); s.textContent = msg;
      li.appendChild(t); li.appendChild(c); li.appendChild(s);
      logEl.insertBefore(li, logEl.firstChild);
      while (logEl.children.length > 80) logEl.removeChild(logEl.lastChild);
    },

    // Actualiza todos los valores visibles desde la única simulación
    render: function (s) {
      var st = $('vStatus'); st.textContent = s.status; st.classList.toggle('long', s.status.length > 12);
      $('vTemp').textContent = s.temp.toFixed(1) + ' ºS';
      $('vEnergy').textContent = s.energy.toFixed(1) + ' MSU';
      $('vParticles').textContent = Math.round(s.particles).toLocaleString('en-US');
      $('vStability').textContent = s.stab.toFixed(1) + ' %';
      $('vRuntime').textContent = hms(s.runtime);
      $('coreTag').textContent = 'CORE ' + s.status;
      gT.set(s.temp); gE.set(s.energy / 1.2); gS.set(s.stab);
      var load = Math.min(100, s.energy / 1.2), on = s.status !== 'OFFLINE';
      $('bField').style.width = s.stab + '%';
      $('bLoad').style.width = load + '%';
      $('bLink').style.width = (on ? 92 + Math.sin(s.runtime) * 6 : 0) + '%';
      var states = [
        on ? (s.temp > 75 ? 'warn' : 'ok') : '', on ? (s.energy > 95 ? 'warn' : 'ok') : '',
        on ? (s.stab < 72 ? 'warn' : 'ok') : '', on ? (s.stab < 45 ? 'crit' : 'ok') : '',
        on ? 'ok' : '', on ? (s.stab < 45 ? 'warn' : 'ok') : ''
      ];
      for (var i = 0; i < 6; i++) $('l' + i).className = 'lamp ' + states[i];

      // Monitor de radiación (puntos ficticios)
      var lvl = N.Engine.radLevel(s.rad);
      $('radPanel').setAttribute('data-lvl', lvl);
      $('radState').textContent = lvl;
      $('vRad').textContent = s.rad.toFixed(1);
      $('bRad').style.width = s.rad + '%';
      gR.set(s.rad);

      // Riesgo sistémico
      var rp = Math.round(s.risk / N.Engine.RISK_LIMIT * 100);
      $('vRisk').textContent = rp + '%';
      $('bRisk').style.width = rp + '%';
      $('bRisk').parentNode.parentNode.setAttribute('data-lvl', rp > 60 ? 'high' : rp > 25 ? 'mid' : 'low');
    },

    pushChart: function (s) {
      chart.push([s.temp, Math.min(100, s.energy / 1.2), s.stab]);
      radChart.push([s.rad]);
    },
    clearChart: function () { chart.clear(); radChart.clear(); },
    redrawChart: function () { chart.draw(); radChart.draw(); }
  };
})(window.NCS = window.NCS || {});
