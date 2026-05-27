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
