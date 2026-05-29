# PROGRESS.md

## Sesión 2026-05-26

### Feature trabajada: HDH-01 - Crear Esqueleto de la aplicación

**Estado**: Completada

#### Evidencia
- Archivos creados: `src/index.html`, `src/styles.css`, `src/app.js`, `proxy/server.js`, `proxy/package.json`
- `docker compose up -d --build` ejecutado sin errores
- HTTP 200 en http://localhost:8082
- Respuesta contiene `<!DOCTYPE html>`
- 4 tabs: Resumen, Jugadores, Circuitos, Historial
- Chart.js via CDN incluido
- Google Fonts: Bebas Neue, Barlow Condensed, Barlow
- Panel de filtros con jugadores, circuitos y localización
- Header stats con #filtrados/#totales
- Botón para cargar datos BGG con modal login
- Placeholder canvas para charts

#### Tareas completadas
1. Estructura HTML con 4 tabs creada
2. CSS base con diseño consistente
3. JavaScript mock con datos de ejemplo
4. Proxy BGG básico creado (server.js + package.json)
5. Docker compose funcionando con ambos servicios
6. Verificación de todos los checks pasada

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html

#### Próximo paso
- Feature siguiente: HDH-02 - Conexión con BGG

---

## Sesión 2026-05-27

### Feature trabajada: HDH-02 - Conexión con BGG

**Estado**: Completada

#### Evidencia
- Proxy server.js reescrito con flujo completo de autenticación BGG
- Login a BGG vía POST https://boardgamegeek.com/login/api/v1
- Paginación automática: detecta fin cuando respuesta tiene < 100 elementos
- Parseo XML con xml2js extrayendo id, date, location, comments de cada <play>
- Parseo de <player> extrayendo name, userid, score, win
- Extracción de circuito desde comments con regex: `/^([^#\\[]+?)(?:\\s*#|\\s*\\[)/`
- Objeto RAW construido con arrays: players (19), locations (7), boards (11), plays (102)
- Cada partida contiene: id, playDate, board, locationRefId, playerScores
- Cada playerScore contiene: playerRefId, score, scoreNum, winner
- proxy/package.json actualizado con dependencia xml2js
- docker-compose.yml actualizado para ejecutar `npm install` en el proxy
- Dockerfile corregido para copiar todos los archivos src/ (bug de HDH-01)
- Frontend app.js actualizado para manejar datos raw y loguear arrays en consola

#### Tareas completadas
1. Implementar autenticación con BGG en proxy (cookies de sesión)
2. Implementar paginación de plays para game ID 366013 (Heat)
3. Parsear XML y normalizar datos en arrays RAW
4. Corregir bug en Dockerfile (solo copiaba index.html)
5. Actualizar frontend para consumir datos reales
6. Verificación con credenciales reales: 102 partidas cargadas correctamente

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html
- POST /bgg-api/login con credenciales: success=true, arrays creados
- Players: 19, Locations: 7, Boards: 11, Plays: 102

#### Próximo paso
- Feature siguiente: HDH-H03 - Clasificación datos

---

## Sesión 2026-05-27

### Feature trabajada: HDH-H03 - Clasificación datos

**Estado**: Completada

#### Evidencia
- Creado proxy/classify.js con función classifyPlayers(players, plays)
- Reglas implementadas:
  - userid === '0' → isBot=true, isMain=false, isOther=false
  - Partidas < 3 → isBot=false, isMain=false, isOther=true
  - Resto → isBot=false, isMain=true, isOther=false
- Corregido bug en proxy/server.js: `p.$.userid || ''` convertía '0' a '', ahora usa `??`
- Creado proxy/test-classify.js con 4 tests:
  - testBots: bots detectados correctamente
  - testMainPlayers: jugadores con 3+ partidas son main
  - testOtherPlayers: jugadores con <3 partidas son other
  - testThresholdExactlyThree: umbral exacto en 3 partidas
- proxy/package.json actualizado con script "test"
- src/app.js mock data actualizado con isBot/isMain/isOther

#### Verificación final
- node --check proxy/server.js: OK
- docker compose config --quiet: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html
- npm test (proxy): 4/4 tests pasados
- docker compose exec bgg-proxy npm test: 4/4 tests pasados

#### Próximo paso
- Feature siguiente: HDH-H04 - Poblamiento de filtros

---

## Sesión 2026-05-27

### Tarea trabajada: Implementación del Plan de Evidencias

**Estado**: Completada

#### Evidencia
- Creada estructura `e2e/` con `package.json`, `playwright.config.js`, `tests/app.spec.js`, `tests/fixtures/mock-data.json`, `scripts/capture-evidence.sh`
- Creada estructura `evidence/` con `screenshots/`, `reports/`, `logs/` (solo `.gitkeep` versionados)
- Modificado `.gitignore` para ignorar binarios generados pero permitir `.gitkeep`
- Modificado `.github/workflows/auto-merge.yml` para ejecutar tests E2E antes del merge, subir artifacts y usar `secrets.json` seguro
- Modificado `AGENTS.md` con nuevas reglas de trabajo sobre evidencias
- Instaladas dependencias `@playwright/test` y generado `e2e/package-lock.json`
- Configurado `playwright.config.js` con proyecto `chromium` y `executablePath` del sistema para entorno local

#### Tareas completadas
1. Crear archivos nuevos del plan de evidencias
2. Modificar archivos existentes (.gitignore, auto-merge.yml, AGENTS.md)
3. Instalar dependencias y generar package-lock.json
4. Verificar funcionamiento local: 6/6 tests pasados, screenshot generado

#### Verificación final
- `npx playwright test` en local: 6/6 passed
- Screenshot generado en `evidence/screenshots/app-inicial-desktop.png`
- `docker compose up -d --build`: OK (servicios ya en ejecución)
- `node --version`: v24.16.0 (>=20)

#### Notas / Riesgos
- Playwright no soporta oficialmente `chromium` en Ubuntu 26.04. Solución aplicada: usar Chromium del sistema (`/usr/bin/chromium-browser`) en local.
- En CI (GitHub Actions, ubuntu-latest) Playwright podrá instalar su propio Chromium sin problemas.
- Requiere instalar Chromium en WSL si no está presente (`sudo apt install chromium-browser`).

#### Próximo paso
- Feature siguiente: HDH-H04 - Poblamiento de filtros

---

## Sesión 2026-05-27

### Feature trabajada: HDH-H04 - Poblamiento de filtros

**Estado**: Completada

#### Evidencia
- `src/app.js` actualizado con lógica completa de filtros:
  - `populateFilters` muestra solo main players en el panel
  - `getFilteredPlays` implementa filtrado por tracks, locations y jugadores
  - Modos de filtro por jugadores: `any` (alguno), `all` (todos), `exact` (solo estos)
  - `getFilteredPlayers` devuelve jugadores únicos presentes en partidas filtradas
  - `loadMockData` mejorado con 4 partidas realistas y `playerScores` completos
  - `window.App = App` expuesto para testabilidad desde e2e
- Creado `e2e/tests/HDH-H04.spec.js` con 9 tests:
  - Carga mock data y actualiza header-stats
  - Despliegue y plegado del panel de filtros
  - Activación/desactivación del filtro
  - Filtro jugadores modo any/all/exact
  - Filtro por circuitos y localizaciones
  - Actualización de header-stats al aplicar filtros
- Panel de filtros funcional: plegable, activable, con apply manual

#### Tareas completadas
1. Implementar lógica de filtros en frontend (tracks, locations, players con 3 modos)
2. Poblar filtros solo con main players
3. Actualizar header-stats con conteos filtrados/totales
4. Crear mock data robusto para tests
5. Crear tests E2E para verificar todos los escenarios de filtros
6. Verificación local con docker compose y Playwright

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html
- npx playwright test: 15/15 tests pasados (6 app base + 9 HDH-H04)
- Screenshot generado en `evidence/screenshots/app-inicial-desktop.png`

#### Notas / Riesgos
- `npm run capture:evidence` falla al instalar Chromium en Ubuntu 26.04 (Playwright no soporta esta versión). Workaround: usar Chromium del sistema y ejecutar `npx playwright test` directamente.
- En CI (GitHub Actions) Playwright instalará su propio Chromium sin problemas.

#### Próximo paso
- Feature siguiente: HDH-05a - Resumen KPIs

---

## Sesión 2026-05-27

### Feature trabajada: HDH-BUG01 - FIX: Filtros no muestran jugadores principales

**Estado**: Completada

#### Evidencia
- Diagnóstico: El proxy BGG devolvía jugadores sin campos de clasificación (`isBot`, `isMain`, `isOther`) porque el contenedor llevaba horas corriendo con una versión antigua de `server.js` (antes de integrar `classifyPlayers`).
- Fix aplicado:
  - Añadida dependencia `nodemon` en `proxy/package.json` como devDependency
  - Modificado `docker-compose.yml`: comando del proxy cambiado de `node server.js` a `npx nodemon server.js`
  - Verificado que nodemon detecta cambios en archivos del proxy y reinicia automáticamente el servidor
- `proxy/package-lock.json` actualizado tras `npm install`

#### Tareas completadas
1. Identificar la causa raíz: contenedor del proxy con código antiguo en caché
2. Añadir `nodemon` para reinicio automático del proxy ante cambios
3. Actualizar `docker-compose.yml` para usar nodemon
4. Verificar que nodemon reinicia el servidor al modificar archivos
5. Ejecutar tests E2E: 15/15 pasados

#### Verificación final
- docker compose config --quiet: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html
- POST /bgg-api/login con credenciales: success=true, players incluyen `isMain`
- npx playwright test: 15/15 tests pasados
- nodemon reinicia automáticamente al detectar cambios en proxy/

#### Notas / Riesgos
- Ninguno. El fix es puramente de infraestructura/despliegue.

#### Próximo paso
- Feature siguiente: HDH-05a - Resumen KPIs

---

## Sesión 2026-05-28

### Feature trabajada: HDH-05a - Resumen KPIs

**Estado**: Completada

#### Evidencia
- `src/app.js` actualizado con implementación completa de `renderKPIs`:
  - KPI Líder: main player con más victorias en partidas filtradas
  - KPI Track: circuito más frecuente con flag emoji (`getTrackFlag` soporta USA, Italy, France, UK, Germany, Poland, Mexico, Japan, Australia, Spain, Brazil, Canada, Netherlands)
  - KPI Streak: mejor racha consecutiva de victorias de un main player
  - KPI Last: fecha YYYY-MM-DD de la partida más reciente con nombre del vencedor
  - Manejo de empates: circuito alfabéticamente primero; streak conserva el primero encontrado
  - KPIs responden dinámicamente a filtros activos
- Creado `e2e/tests/HDH-05a.spec.js` con 4 tests:
  - KPIs con mock data por defecto
  - KPIs con datos custom (valores unívocos verificables)
  - Actualización de KPIs al aplicar/quitar filtros
  - KPIs muestran '-' cuando no hay partidas filtradas

#### Tareas completadas
1. Implementar lógica de KPIs en `renderKPIs()`
2. Implementar `getTrackFlag()` para emojis de circuitos
3. Crear tests E2E con datos inyectados para verificar cada KPI
4. Verificar que filtros actualizan KPIs correctamente
5. Verificar compatibilidad con tests existentes (HDH-H04, app base)

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html
- npx playwright test: 19/19 tests pasados (6 app base + 9 HDH-H04 + 4 HDH-05a)

#### Notas / Riesgos
- `npm run capture:evidence` fallaba en Ubuntu 26.04 porque `npx playwright install chromium` no está soportado. **Fix aplicado**: modificado `e2e/scripts/capture-evidence.sh` para que la instalación de browsers no sea fatal (`|| echo "WARNING..."`).
- Evidencia capturada exitosamente tras el fix: screenshot actualizado en `evidence/screenshots/app-inicial-desktop.png` y reporte HTML en `evidence/reports/index.html`.

#### Próximo paso
- Feature siguiente: HDH-05b - Panel podio

---

## Sesión 2026-05-28

### Feature trabajada: HDH-TEST_ENV01 - FIX: Tests usando un xml de prueba

**Estado**: Completada

#### Evidencia
- Script temporal `fetch-bgg-xml.js` ejecutado con credenciales de `secrets.json`
- XML de 102 partidas guardado en `proxy/test-data/bgg-plays.xml`
- Modificado `proxy/server.js` añadiendo ruta POST `/test-login` (entrada trasera) que lee el XML local y devuelve datos normalizados
- Creado `e2e/tests/HDH-TEST_ENV01.spec.js` con 3 tests:
  - Carga datos desde XML de prueba y captura screenshot (`HDH-TEST_ENV01-datos-cargados.png`)
  - Aplica filtro por circuito y captura screenshot (`HDH-TEST_ENV01-filtro-aplicado.png`)
  - Desactiva filtro y captura screenshot (`HDH-TEST_ENV01-filtro-desactivado.png`)
- Instaladas dependencias del sistema necesarias para ejecutar Chromium snap en tests (libnspr4, libnss3, libasound2t64)
- Downgrade de `@playwright/test` a 1.52.0 y uso de Node 20 (vía nvm) para compatibilidad con el entorno local
- Modificado `AGENTS.md` para reforzar la generación de screenshots de evidencia en cada spec

#### Tareas completadas
1. Obtener XML real de BGG usando credenciales de secrets.json
2. Guardar XML en proxy/test-data/bgg-plays.xml
3. Implementar entrada trasera /test-login en proxy/server.js
4. Crear spec E2E con screenshots de evidencia
5. Resolver problema de entorno local para ejecutar Playwright (Node 20 + libs del sistema)
6. Verificar que todos los tests existentes siguen pasando
7. Actualizar AGENTS.md con regla de screenshots en specs

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082/bgg-api/test-login: success=true, data con 102 plays
- Playwright E2E: 22/22 tests pasados
- Screenshots generados en evidence/screenshots/:
  - HDH-TEST_ENV01-datos-cargados.png
  - HDH-TEST_ENV01-filtro-aplicado.png
  - HDH-TEST_ENV01-filtro-desactivado.png

#### Notas / Riesgos
- Playwright 1.60.0 no es compatible con Node 24 ni con Ubuntu 26.04 para instalación de browsers. Solución: usar Node 20 vía nvm y Chromium del sistema (snap).
- El script `capture-evidence.sh` puede requerir ajustes para usar Node 20 en entornos con nvm.

#### Próximo paso
- Feature siguiente: HDH-05b - Panel podio

---

## Sesión 2026-05-28

### Feature trabajada: HDH-05b - Panel podio

**Estado**: Completada

#### Evidencia
- `src/app.js` actualizado con implementación completa de `renderPodium()`:
  - Calcula victorias por main player en partidas filtradas
  - Filtra jugadores con 0 victorias
  - Ordena por victorias descendente y toma top 3
  - Renderiza en orden visual: #2 (plata) | #1 (oro) | #3 (bronce)
  - Oro centrado con `transform: scale(1.15)` (15% más grande)
  - Medals: 🥇🥈🥉
  - Responde dinámicamente a filtros activos
- `src/styles.css` actualizado con estilos del podio:
  - `.podium-place.first` con borde dorado y scale(1.15)
  - `.podium-place.second` con borde plateado
  - `.podium-place.third` con bronce
  - Clases `.podium-medal`, `.podium-name`, `.podium-wins`
- Creado `e2e/tests/HDH-05b.spec.js` con 4 tests:
  - Podio con mock data por defecto (2 main players)
  - Podio con datos custom de 3 jugadores
  - Actualización de podio al aplicar filtros
  - Podio vacío cuando no hay partidas

#### Tareas completadas
1. Implementar lógica de podio en `renderPodium()`
2. Actualizar CSS para layout visual del podio (#2 | #1 | #3)
3. Crear tests E2E con datos inyectados
4. Verificar que filtros actualizan podio correctamente
5. Verificar compatibilidad con tests existentes (26/26 pasados)

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html
- npx playwright test: 26/26 tests pasados (6 app base + 4 HDH-H04 + 4 HDH-05a + 4 HDH-05b + 3 HDH-TEST_ENV01 + 9 HDH-H04)

#### Notas / Riesgos
- Ninguno. Implementación completa y compatible con tests existentes.

#### Próximo paso
- Feature siguiente: HDH-05c - Panel victorias

---

## Sesión 2026-05-28

### Feature trabajada: HDH-05c - Panel victorias

**Estado**: Completada

#### Evidencia
- `src/app.js` actualizado con implementación completa de `renderCharts()`:
  - Calcula victorias por main player en partidas filtradas
  - Filtra jugadores con 0 victorias
  - Ordena por victorias descendente
  - Actualiza el chart `wins` con labels y datos correctos
  - Responde dinámicamente a filtros activos
- Creado `e2e/tests/HDH-05c.spec.js` con 4 tests:
  - Gráfico con mock data por defecto
  - Gráfico con datos custom (valores verificables)
  - Actualización de gráfico al aplicar/quitar filtros
  - Gráfico vacío cuando no hay victorias

#### Tareas completadas
1. Implementar lógica de gráfico de victorias en `renderCharts()`
2. Crear tests E2E con datos inyectados
3. Verificar que filtros actualizan gráfico correctamente
4. Verificar compatibilidad con tests existentes (30/30 pasados)

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html
- npx playwright test: 30/30 tests pasados (6 app base + 9 HDH-H04 + 4 HDH-05a + 4 HDH-05b + 4 HDH-05c + 3 HDH-TEST_ENV01)

#### Notas / Riesgos
- Ninguno. Implementación completa y compatible con tests existentes.

#### Próximo paso
- Feature siguiente: HDH-05d - Panel partidas por mes

---

## Sesión 2026-05-28

### Feature trabajada: HDH-05d - Panel partidas por mes

**Estado**: Completada

#### Evidencia
- `src/app.js` actualizado con implementación de `renderPlaysMonth` dentro de `renderCharts()`:
  - Agrupa partidas filtradas por mes (YYYY-MM) usando `play.playDate.substring(0, 7)`
  - Ordena meses cronológicamente con `Object.keys().sort()`
  - Actualiza chart `playsMonth` con labels (meses) y datos (conteo por mes)
  - Responde dinámicamente a filtros activos
  - Chart ya inicializado como tipo 'line' con `stepSize: 1` en eje Y
- Creado `e2e/tests/HDH-05d.spec.js` con 4 tests:
  - Gráfico con mock data por defecto (4 meses, 1 partida cada uno)
  - Gráfico con datos custom (valores verificables: 3 en enero, 2 en marzo)
  - Actualización de gráfico al aplicar/quitar filtros
  - Gráfico vacío cuando no hay partidas

#### Tareas completadas
1. Implementar lógica de partidas por mes en `renderCharts()`
2. Crear tests E2E con datos inyectados
3. Verificar que filtros actualizan gráfico correctamente
4. Verificar compatibilidad con tests existentes (34/34 pasados)

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html
- npx playwright test: 34/34 tests pasados (6 app base + 9 HDH-H04 + 4 HDH-05a + 4 HDH-05b + 4 HDH-05c + 4 HDH-05d + 3 HDH-TEST_ENV01)

#### Notas / Riesgos
- Ninguno. Implementación completa y compatible con tests existentes.

#### Próximo paso
- Feature siguiente: HDH-05e - Panel puntos medios por jugador

---

## Sesión 2026-05-28

### Feature trabajada: HDH-05e - Panel puntos medios por jugador

**Estado**: Completada

#### Evidencia
- `src/app.js` actualizado con implementación de avg points en `renderCharts()`:
  - Calcula media de scores por main player: `totalScore / playCount`
  - Filtra jugadores con avg > 0
  - Ordena por media descendente
  - Muestra valores con 1 decimal usando `toFixed(1)`
  - Chart ya inicializado como horizontal bar con `indexAxis: 'y'`
- Creado `e2e/tests/HDH-05e.spec.js` con 4 tests:
  - Gráfico con mock data (Player1: 25.0, Player2: 24.7)
  - Gráfico con datos custom (Bob: 23.3, Alice: 20.0, Charlie: 16.7)
  - Actualización de gráfico al aplicar/quitar filtros
  - Gráfico vacío cuando no hay partidas

#### Tareas completadas
1. Implementar lógica de puntos medios en `renderCharts()`
2. Crear tests E2E con datos inyectados
3. Verificar que filtros actualizan gráfico correctamente
4. Verificar compatibilidad con tests existentes (38/38 pasados)

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html
- npx playwright test: 38/38 tests pasados

#### Notas / Riesgos
- Ninguno. Implementación completa y compatible con tests existentes.

#### Próximo paso
- Feature siguiente: HDH-06a - Pestaña Jugadores

---

## Sesión 2026-05-28

### Feature trabajada: HDH-06a - Pestaña Jugadores

**Estado**: Completada

#### Evidencia
- `src/app.js` actualizado con implementación completa de `renderPlayersTable()`:
  - Calcula estadísticas por main player: plays, wins, win%, avg, max, last10
  - Filtra solo main players (excluye bots y others)
  - Ordena por wins descendente, luego win% como desempate
  - Win% con barra de porcentaje visual (`.win-pct-bar` + `.win-pct-fill`)
  - Last 10: array de 10 booleans (más reciente primero), dots verdes=win, grises=loss
  - Media y max con 1 decimal
  - Responde dinámicamente a filtros activos
- `src/styles.css` actualizado con estilos:
  - `.win-pct-bar`: barra de fondo con overflow hidden
  - `.win-pct-fill`: relleno rojo (#e94560) con transición
  - `.win-pct-text`: texto centrado absolutamente
  - `.last10-dots`: flex container con gap
  - `.dot-win` (verde #4caf50) y `.dot-loss` (gris #555)
- Creado `e2e/tests/HDH-06a.spec.js` con 5 tests:
  - Tabla con mock data (2 main players)
  - Estadísticas correctas con datos custom (verifica plays, wins, win%, avg, max, dots)
  - Actualización al aplicar/quitar filtros
  - Exclusión de bots y otros jugadores
  - Tabla vacía cuando no hay partidas

#### Tareas completadas
1. Implementar lógica de tabla de jugadores en `renderPlayersTable()`
2. Añadir CSS para barra de win% y dots de last 10
3. Crear tests E2E con datos inyectados
4. Verificar que filtros actualizan tabla correctamente
5. Verificar compatibilidad con tests existentes (43/43 pasados)

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html
- npx playwright test: 43/43 tests pasados

#### Notas / Riesgos
- Ninguno. Implementación completa y compatible con tests existentes.

#### Próximo paso
- Feature siguiente: HDH-06b - Pestaña Circuitos

---

## Sesión 2026-05-28

### Feature trabajada: HDH-06b - Pestaña Circuitos

**Estado**: Completada

#### Evidencia
- `src/app.js` actualizado con dos implementaciones:
  1. **Doughnut chart** en `renderCharts()`: agrupa partidas filtradas por circuito, ordena alfabéticamente, actualiza chart `tracks`
  2. **Track list** en `renderTrackList()`: genera tarjetas por circuito con:
     - Nombre con flag emoji (`getTrackFlag`)
     - Número de partidas
     - Puntos medios (promedio de todos los scores)
     - Campeón (main player con más victorias en ese circuito)
- `src/styles.css` actualizado con estilos para `.track-card h4` y `.track-card p`
- Creado `e2e/tests/HDH-06b.spec.js` con 4 tests:
  - Doughnut chart con mock data (2 circuitos, 2 partidas cada uno)
  - Track list con stats correctas (verifica plays, avg, champion)
  - Actualización al aplicar/quitar filtros
  - Vacío cuando no hay partidas

#### Tareas completadas
1. Implementar doughnut chart de distribución en `renderCharts()`
2. Implementar track list con stats en `renderTrackList()`
3. Añadir CSS para track cards
4. Crear tests E2E con datos inyectados
5. Verificar compatibilidad con tests existentes (47/47 pasados)

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html
- npx playwright test: 47/47 tests pasados

#### Notas / Riesgos
- Ninguno. Implementación completa y compatible con tests existentes.

#### Próximo paso
- Feature siguiente: HDH-07 - Pestaña Historial

---

## Sesión 2026-05-28

### Feature trabajada: HDH-07 - Pestaña Historial

**Estado**: Completada

#### Evidencia
- `src/app.js` actualizado con dos implementaciones:
  1. **Play history list** en `renderPlaysHistory()`:
     - Partidas ordenadas por fecha descendente (más reciente primero)
     - Cada entrada muestra: fecha, circuito con flag emoji, ganador y puntos
     - Click expande/contrae panel de detalles
     - Winner destacado con clase `.player-winner` (borde verde)
     - Muestra puntuación de cada jugador
  2. **Wins evolution chart** en `renderCharts()`:
     - Chart line con evolución acumulada de victorias
     - Un dataset por main player (máx 10 primeros)
     - Data: victoria acumulada por fecha
     - Colores distintos por jugador
- Creado `e2e/tests/HDH-07.spec.js` con 5 tests:
  - Historial con mock data (4 entradas)
  - Detalles expandibles al pulsar entrada
  - Wins evolution chart con mock data
  - Actualización al aplicar/quitar filtros
  - Vacío cuando no hay partidas

#### Tareas completadas
1. Implementar lista de historial en `renderPlaysHistory()`
2. Implementar wins evolution chart en `renderCharts()`
3. Crear tests E2E con datos inyectados
4. Verificar compatibilidad con tests existentes (52/52 pasados)

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html
- npx playwright test: 52/52 tests pasados

#### Notas / Riesgos
- Ninguno. Implementación completa y compatible con tests existentes.
- **¡TODAS LAS FEATURES COMPLETADAS!**

---

## Sesión 2026-05-29

### Feature trabajada: HDH-BUG02 - FIX: Filtros comportamiento Solo estos y UI

**Estado**: Completada

#### Evidencia
- `src/app.js`: Modificado `getFilteredPlays` para modo `exact`. Ahora extrae solo los `playerRefId` de jugadores principales (`isMain`) de cada partida y compara ese conjunto con los seleccionados. Los bots y other players ya no afectan el filtro exact.
- `src/index.html`: Reestructurado panel de filtros:
  - Nuevo `.filter-header` con botón "Filtros" y checkbox "Activo" alineados horizontalmente.
  - Selector de modo de jugadores (`#player-filter-mode`) movido junto al título "Jugadores" dentro de `.filter-section-title`.
- `src/styles.css`: Añadidos/actualizados estilos `.filter-header`, `.filter-toggle-header`, `.filter-section-title`, `.filter-mode-select` para layout compacto sin scroll innecesario.

#### Tareas completadas
1. Corregir lógica de filtro "Solo estos" para que solo considere main players
2. Reubicar checkbox "Filtro Activo" al header del panel, alineado con el botón
3. Mover selector de modo a la derecha del título "Jugadores"
4. Ajustar CSS para ahorrar espacio y evitar barras de desplazamiento

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html

#### Notas / Riesgos
- Tests E2E no ejecutados en esta sesión por instrucciones del usuario. Se arreglarán en sesión futura.

#### Próximo paso
- Feature siguiente: HDH-BUG03 - FIX: KPIs Líder y Track añadir contadores

---

## Sesión 2026-05-29 (continuación)

### Feature trabajada: HDH-BUG03 - FIX: KPIs Líder y Track añadir contadores

**Estado**: Completada

#### Evidencia
- `src/app.js`: Modificado `renderKPIs`:
  - `leaderDisplay` ahora incluye `maxWins` entre paréntesis: `nombre (victorias)`
  - `trackDisplay` ahora incluye `trackMax` entre paréntesis: `flag nombre (partidas)`

#### Tareas completadas
1. Añadir número de victorias al KPI Líder
2. Añadir número de partidas al KPI Track

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html

#### Notas / Riesgos
- Tests E2E no ejecutados en esta sesión por instrucciones del usuario.

#### Próximo paso
- Feature siguiente: HDH-BUG04 - FIX: Panel Circuitos layout donut y stats

---

## Sesión 2026-05-29 (continuación)

### Feature trabajada: HDH-BUG04 - FIX: Panel Circuitos layout donut y stats

**Estado**: Completada

#### Evidencia
- `src/index.html`: Reemplazado `.charts-grid` por `.circuitos-layout` en pestaña Circuitos. `.donut-card` contiene el canvas, y `#track-list` queda a su derecha.
- `src/styles.css`: Añadidos `.circuitos-layout` (grid 1fr 2fr), `.donut-card` (max-width 400px) y `.donut-card canvas` (max-height 300px) para que el donut se vea completo.

#### Tareas completadas
1. Limitar tamaño del donut para que se visualice entero
2. Colocar track list a la derecha del donut en un grid de dos columnas

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html

#### Notas / Riesgos
- Tests E2E no ejecutados en esta sesión por instrucciones del usuario.

#### Próximo paso
- Feature siguiente: HDH-BUG05 - FIX: Historial paneles y banderas

---

## Sesión 2026-05-29 (continuación)

### Feature trabajada: HDH-BUG05 - FIX: Historial paneles y banderas

**Estado**: Completada

#### Evidencia
- `src/index.html`: Reorganizada pestaña Historial con `.historial-layout` de dos columnas. Izquierda: lista de partidas (`#plays-history`) con banderas de países. Derecha: chart de partidas por mes (`#chart-plays-month-historial`).
- `src/app.js`: Añadido chart `playsMonthHistorial` en `initCharts()` y sincronizado en `renderCharts()` con los mismos datos que el chart de Resumen.
- `src/styles.css`: Añadido `.historial-layout` con `grid-template-columns: 1fr 1fr`.

#### Tareas completadas
1. Crear layout de dos columnas en pestaña Historial
2. Mantener lista de partidas ordenada con banderas en panel izquierdo
3. Añadir gráfico lineal de partidas por mes en panel derecho

#### Verificación final
- docker compose config --quiet: OK
- node --check proxy/server.js: OK
- docker compose up -d --build: OK
- curl localhost:8082: HTTP 200 con DOCTYPE html

#### Notas / Riesgos
- Tests E2E no ejecutados en esta sesión por instrucciones del usuario.

#### Próximo paso
- Todas las features solicitadas implementadas.
