# NUCLEAR CORE SIMULATOR

Simulación visual, educativa y **ficticia** de una instalación nuclear futurista. No modela ni representa procedimientos, parámetros ni controles de reactores reales.

HTML5 + CSS3 + JavaScript vanilla + Canvas + SVG + Web Audio. Sin dependencias, CDNs ni conexión a internet.

## Archivos

```
nuclear-core-simulator/
├── index.html     versión autosuficiente (CSS y JS incrustados): ábrela sola y funciona
├── build.py       (opcional) regenera index.html desde src/
├── src/           código modular
│   ├── index.html
│   ├── css/style.css
│   └── js/  settings · audio · alarms · charts · engine · reactor · components · dashboard
│            emergency · failures · repair · repairgames · repairgames2 · sandbox · minigame · gameover · main
└── README.md
```

El `index.html` de la raíz no depende de carpetas ni de rutas: se puede copiar solo a cualquier sitio. Si editas `src/`, ejecuta `python3 build.py` para regenerarlo.
Los scripts usan el namespace `window.NCS` para funcionar con `file://`.

## Ejecutar en local

Abre `index.html` con doble clic en un navegador moderno. No hace falta servidor.

## Publicar en GitHub Pages

1. Sube `index.html` (y el resto si quieres) a la raíz del repositorio.
2. En **Settings → Pages**, elige la rama `main` y la carpeta `/ (root)`.

## Cómo se juega

- **REACTOR CONTROL PANEL** (siempre visible arriba): interruptor ON/OFF por módulo. Un módulo con **FAULT** se repara pulsando su interruptor (reinicio de ~1 s).
- **Inestabilidad:** aparece el aviso REACTOR UNSTABLE / STABILIZE THE REACTOR! con causa, control a corregir y consecuencia. Nunca se resuelve solo; sin intervención el riesgo sistémico sube hasta el fallo.
- **Apagón:** solo con inestabilidad y con probabilidad configurable (⚙). Abre ELECTRICAL EMERGENCY: haz clic en la caja y reproduce el patrón en 15–20 s. Si ganas, vuelves al dashboard con el mismo estado inestable; si pierdes, GAME OVER.
- **GAME OVER:** causa, tiempo de supervivencia, eventos y emergencias. REINICIAR restaura todo y empieza otra partida.
- **AUTO DEMO MODE:** acelera los eventos y añade un operador automático (sin apagones). Solo en este modo algo se repara solo.

## Fallas del sistema (ficticias)

- Aparecen al azar (máx. 2 a la vez, nunca en modo demo); cada una tiene su tarjeta con estado, nivel y temporizador, y **no se resuelve sola**: al agotarse el tiempo sube de nivel y la emergencia aumenta.
- **Cooling** (60–90 s): INICIAR REPARACIÓN abre la instalación; gira las 5 válvulas rojas arrastrando hasta el 100%.
- **Shields** (60–105 s): mantén pulsado sobre cada una de las 7–11 grietas (5–8 s según tamaño) para soldarla.
- **Short circuit** (30–40 s): arrastra 8 cables a su terminal; los erróneos se pueden corregir.
- **Overproduction:** baja la *Intensidad del reactor* a 70 % o menos, o desactiva el Core Module, 10–15 s seguidos.
- Si pierdes un minijuego, la falla continúa y puedes REINTENTAR.

## Minijuegos de emergencia (actualización 07)

- **CONTROLS FAILURE** (55–70 s): bloquea los interruptores de módulos y el slider de intensidad hasta reparar con **Code Breaker** (3 códigos con pistas y colores).
- **Apagón aleatorio:** ahora elige su recuperación entre ELECTRICAL EMERGENCY (el más habitual), **Memory Sequence** (55–60 s, 6 patrones), **Calibration** (40 s, 5 indicadores) y **Total Blackout** (llave 40–50 s → generador → **Generator to External Power**, 60 s compartidos en 3 escenarios). Si se agota el tiempo: GAME OVER con la causa.

## Modo Sandbox (pruebas)

- Botón **SANDBOX** junto a ⚙: abre un panel lateral (CERRAR ✕ o Esc para volver). No altera el modo normal mientras no lo uses; si dejas ajustes de prueba activos, el botón muestra un punto ámbar.
- **Eventos:** lista automática de todas las fallas, el fallo de módulo y las variantes de apagón (incluido Generator to External Power). Cada uno se puede INICIAR, abrir su MINIJUEGO original, FINALIZAR o REINICIAR (con confirmación). Un mismo evento no se duplica.
- **Simulación:** fallas/apagones/fallos de módulo aleatorios ON/OFF, forzar estados de emergencia, congelar el riesgo, restaurar el estado estable y reiniciar la simulación (con confirmación).
- Todo se registra en el Event Log con la categoría SANDBOX. Las fallas y apagones nuevos aparecen solos en la lista; otros eventos se añaden con `NCS.Sandbox.register({...})`.

## Update 07 · Fase 2: Advanced Systems

- **False Alarms:** aparecen alertas de sensores «SIN VERIFICAR» (tarjeta con borde discontinuo cian, distinta de las fallas ámbar/rojas). **INVESTIGAR ALERTA** abre una interfaz con 3 sensores redundantes (lectura, historial, calidad de señal, calibración), autodiagnóstico (2 por alerta) y verificación cruzada con los sistemas relacionados. Decide **ALERTA REAL** o **FALSA ALARMA**: acierto = puntos, error = penalización ficticia, ignorarla (75 s reales) también penaliza. Puedes cerrar y **REINVESTIGAR** mientras dure la ventana. Todo queda en el Event Log (categoría SENSOR) y la puntuación en la cabecera. Las alertas reales solo señalan fallas que ya existen; las falsas nunca crean fallas. No aparecen en modo demo, apagón ni emergencia grave.
- **Visual Damage:** el laboratorio se degrada según el estado: ESTABLE (normal) · INESTABLE (interferencias leves) · ALERTA (luz ámbar y efectos moderados) · EMERGENCIA (parpadeos, distorsiones, humo, chispas, baliza roja, tuberías agrietadas con vapor) · GAME OVER (transición especial). El nivel sube rápido y baja despacio al resolver la situación. Respeta *Visual Effects* y *reduced motion*.
- Los temporizadores de esta fase usan tiempo real (no dependen de la velocidad). Conocido y pendiente: la velocidad de la simulación aún altera los temporizadores de los minijuegos anteriores.

## Sonido y efectos

- Todo el audio se genera con Web Audio (sin archivos) y **empieza desactivado**: actívalo con el icono 🔇 de la cabecera o en ⚙ Settings.
- **Settings:** Master / Ambient / Alarm Volume, Sound Effects, Visual Effects, Screen Shake, tema y probabilidad de apagón. Se guardan en `localStorage` (el sonido siempre arranca apagado).
- Ambiente y zumbido eléctrico continuos; alarma en bucle según el estado (UNSTABLE, RADIATION ALERT, EMERGENCY, CONTAINMENT FAILURE); apagón, restauración, cuenta atrás, explosión y GAME OVER con sonido propio.

## Controles

- **START / PAUSE / RESET SIMULATION** y **MODO DEMO** (activa perturbaciones ficticias más frecuentes).
- **Intensidad visual** y **velocidad de animación**.
- Configuración (⚙): sonido ON/OFF y modo visual (cian, azul, violeta).

## Limitaciones

- Los valores y las alarmas son inventados y no tienen significado físico.
- El audio solo se activa tras pulsar el botón de sonido (restricción de los navegadores).
