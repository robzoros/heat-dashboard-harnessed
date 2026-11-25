# HDH-UI05 — Rediseño de la pestaña Circuitos (rail + panel de detalle)

## Specs
S1: La lista de circuitos es un rail lateral de ~300px (id `#track-list` conservado, clase contenedor `.track-rail`): una tarjeta `.track-card` por circuito con `h4.track-name` (nombre, clicable con `data-track`), nº de partidas, victorias de bots, barra de reparto (% de partidas sobre el total con title) y línea de campeón (nombre + victorias + punto de color de jugador vía `playerColor`).
S2: El click en la tarjeta alterna la selección como hoy (`selectedTrack` toggle; doble esfuerzo equivale a deseleccionar). Al cambiar la selección, el chart `#chart-tracks` alterna «Distribución» ↔ «Victorias — circuito» con el comportamiento actual intacto (`updateTracksChart`).
S3: A la derecha: cabecera de badges del circuito activo (🏆 campeón+V, 🏁 partidas, 📊 % del total, 🤖 victorias bots, 📅 última visita) y grid duo con el panel del chart (ids `#tracks-chart-title`, `#chart-tracks`) y un panel nuevo de pódio del circuito (top 3 jugadores principales por victorias con colores reales; bots se cuentan aparte). Debajo, panel de últimas visitas al circuito (hasta 5 partidas recientes con fecha, nº de jugadores, ganador y puntos).
S4: Sin circuito seleccionado: el donut muestra «Distribución» (como hoy) y los paneles de pódio/visitas muestran un estado vacío con la guía «haz clic en un circuito del rail».
S5: Tokens del sistema `design/system.md`; pódio con el patrón de `podium-place` (borde superior con `--pc`, gradiente mix); badges como los de campeonatos (`.detail-badge`).
S6: Datos derivados solo de `filteredPlays` existentes: reparto = plays de circuito / total filtrado; última visita = fecha máxima; victorias del campeón = `winsByPlayer`. Nada de nuevas llamadas externas.
S7: Responsive: ≤1050px el rail pasa a carrusel horizontal y el duo se apila; ≤720px compacto (gutters, botones/cards).
S8: Tests: `HDH-06b` se actualiza al nuevo markup de tarjeta (los `p` pasan a selectores del nuevo markup); `HDH-15` y `HDH-COL04` no cambian (solo usan título del chart). Nuevo `e2e/tests/HDH-UI05.spec.js` con screenshots.

## Tasks
T1 [S1,S2,S3,S4,S6] app.js: `renderTracks` reescrito (rail + badges + pódio + visitas) e `index.html`: estructura nueva del tab. route: inline, feat commit
T2 [S5,S7] styles.css: rail, badges de circuito, duo, pódio, visitas, responsive. route: inline, feat commit
T3 [S8] e2e: actualizar HDH-06b; nuevo HDH-UI05.spec.js; suite completa. route: inline, test commit
T4 docs: features_list.json, PROGRESS.md, CHANGELOG.md. route: inline, docs commit

## Log
L1: Usuario (vía gentle-design): "Implement the design artboard design/circuitos/02-rail-detalle.html ... map its parts to the project's existing components and styles, and do not copy the artboard HTML verbatim. Take colors, typography, spacing, radius and shadows from design/system.md".
L2: Contexto del brief: la lista de circuitos debe ocupar menos y dar espacio al chart; hoy hay 10 circuitos y se prevén 12–16 (el rail tiene scroll interno en el artboard).

## Log - ejecucion
L3: Implementado y verificado: suite 153/153. Commits: feat (app+styles+index), test (specs), docs. Fix soporte: main se desplaza 300px con body.panel-open >=721px. Fix movil: min-width:0 en .circuitos-layout > *.
L4: El pódio reutiliza .podium-place del Resumen; computeTrackStats devuelve championWins solo de principales (antes championName podia ser un bot con maxWins).
