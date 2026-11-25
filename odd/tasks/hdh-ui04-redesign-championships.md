# HDH-UI04 — Rediseño de la pestaña Campeonatos (rail compacto + chart protagonista)

## Specs
S1: La lista de campeonatos ("rail") sustituye al desplegable `#campeonatos-select`: cada campeonato es una tarjeta clicable con nombre, nº de participantes, nº de partidas, fecha de creación y líder (nombre + puntos + color de jugador como punto). Seleccionar tarjeta = `selectChampionship(id)`.
S2: Las acciones de la lista (`+ Nuevo Campeonato`, `⟳ Cargar`) se mantienen en la cabecera del rail con sus ids `#btn-create-campeonato` y `#btn-load-campeonatos`.
S3: El detalle usa la distribución del artboard: arriba `Clasificación` y `Evolución de puntos` lado a lado (grid 2 columnas), debajo `Partidas` a todo lo ancho. Se conservan las clases `.campeonato-detail-header`, `.standings-table`, los `data-play-date` y los ids de botones de acción (`#btn-import-plays-campeonato`, `#btn-add-manual-play`, `#btn-delete-campeonato`, `.remove-play[data-play-id]`).
S4: El chart de evolución es de LÍNEA ACUMULATIVA, siempre creciente: cada punto suma los puntos de la carrera (0–11) al total anterior por jugador.
S5: El eje Y del chart es adaptable al máximo acumulado del campeonato (no fijo), empezando en 0.
S6: Cada línea del chart usa el color de jugador real (`playerColor`) y la leyenda lista los jugadores trazados.
S7: Tokens del sistema: `design/system.md` (colores `--bg/--surface/--surface-2/--line/--text/--text-muted/--accent`, tipografía display condensed para títulos, radius 10px, borde hover `--accent`).
S8: Responsive: ≤1050px rail en scroll horizontal y paneles apilados; ≤720px gutters 16px, tabla con scroll horizontal, partidas en una columna, botones ≥38px de alto.
S9: Los tests que dependen del desplegable (`HDH-09`, `HDH-MIGRATION01`) se actualizan al rail de forma explícita (contando tarjetas del rail, no opciones del select); el resto de selectores del detalle se mantienen.

## Tasks
T1 [S1,S2] app.js: `championshipSummary` añade líder (nombre+pts desde `getChampionshipStandings` cuando hay plays); `renderChampionshipsSelect` → `renderChampionshipsRail` (tarjetas). ruta: inline, commit 1
T2 [S3,S4,S5,S6] app.js: `renderChampionshipDetail` reestructurado (badges + duo + partidas full width) y nuevo chart acumulativo con escala adaptativa en la pestaña (canvas `#chart-champ-evolution`). ruta: inline, commit 2
T3 [S7,S8] styles.css: rail, duo, partidas en grid, badges, responsive. ruta: inline, commit 2
T4 [S9,index.html] index.html: quitar select del toolbar, añadir contenedor rail. ruta: inline, commit 1
T5 [S9] e2e: actualizar HDH-09 y HDH-MIGRATION01 al rail; nuevo `e2e/tests/HDH-UI04.spec.js` con screenshots. ruta: inline, commit 3
T6 docs: features_list.json (in_progress→completed), PROGRESS.md, CHANGELOG.md. commit 3

## Log
L1: Usuario (vía gentle-design): "Implement the design artboard design/campeonatos/01-rail-compact.html ... map its parts to the project's existing components and styles, and do not copy the artboard HTML verbatim. Take colors, typography, spacing, radius and shadows from design/system.md".
L2: Comentarios de canvas ya aplicados al artboard y heredados como spec: cabecera con acceso administrador; arriba Clasificación y Evolución, debajo Partidas; campeonatos de ~4 carreras (los primeros de 3); móvil no se ve mal; escala del chart 0→ adaptable; puntos por carrera 0–11; chart acumulativo siempre creciente.

## Log — ejecución
L3: Implementación completada. Commits: T1+T4 y T2+T3 en un commit de código (rail + detalle + estilos), T5 en commit de tests. T6 en commit de documentación.
L4: Suite completa 150/150 tras actualizar FIX-HDH-06 (parseo de fecha desde `.play-main`) y FIX-HDH-07 ('👥 3 participantes'). Fix latente de `.hidden` genérica incluido y cubierto por la nueva madurez de tests de detalle.
L5: Resultado: 5/5 tests nuevos HDH-UI04 + 150/150 suite (Node 22, CI=true, chromium local). Screenshots en evidence/screenshots/HDH-UI04-*.png (no versionados, evidencia oficial en Actions).
