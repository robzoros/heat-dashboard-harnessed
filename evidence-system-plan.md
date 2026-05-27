# Plan: Sistema de Evidencias Reales (Playwright + E2E Tests)

## Objetivo

Capturar evidencias reales (pantallazos, logs, reports) para cada feature del proyecto, almacenándolas en GitHub Actions artifacts y generándolas bajo demanda en local, sin comprometer el tamaño del repositorio con binarios.

---

## 1. Estructura nueva de directorios

```
e2e/
├── package.json                    # Dependencias aisladas de Playwright
├── package-lock.json               # Versionado para npm ci en CI
├── playwright.config.js            # Configuración de Playwright
├── tests/
│   ├── app.spec.js                 # Test base: la app carga correctamente
│   ├── fixtures/                   # Datos mock para tests offline
│   │   └── mock-data.json
│   ├── hdh-h04-filters.spec.js     # Tests + screenshots para filtros
│   ├── hdh-05a-kpis.spec.js        # Tests + screenshots para KPIs
│   └── ...                         # Un spec por feature
└── scripts/
    └── capture-evidence.sh         # Orquestación local: build → start → test → stop
evidence/
├── screenshots/                    # PNGs capturados (NO versionados en git)
│   └── .gitkeep
├── reports/                        # HTML reports de Playwright (NO versionados)
│   └── .gitkeep
└── logs/                           # Logs de verificación
    └── .gitkeep
```

---

## 2. Archivos a crear

### 2.1 `e2e/package.json`

```json
{
  "name": "heat-dashboard-e2e",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "devDependencies": {
    "@playwright/test": "^1.52.0"
  },
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "capture:evidence": "bash scripts/capture-evidence.sh"
  }
}
```

> **Nota:** `package-lock.json` se genera con `npm install` y se versiona en git para garantizar builds reproducibles en CI.

### 2.2 `e2e/playwright.config.js`

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../evidence/reports', open: 'never' }]
  ],
  use: {
    baseURL: 'http://localhost:8082',
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
});
```

### 2.3 `e2e/tests/app.spec.js` (test base)

- Verifica que la app carga (status 200)
- Verifica que existen los 4 tabs: Resumen, Jugadores, Circuitos, Historial
- Verifica que Chart.js está presente
- Verifica que el panel de filtros existe
- Captura screenshot inicial

### 2.4 `e2e/scripts/capture-evidence.sh`

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
EVIDENCE_DIR="$PROJECT_ROOT/evidence"

echo "=== Captura de Evidencias ==="
mkdir -p "$EVIDENCE_DIR/screenshots" "$EVIDENCE_DIR/logs" "$EVIDENCE_DIR/reports"

# Verificar que existe secrets.json
if [ ! -f "$PROJECT_ROOT/secrets.json" ]; then
  echo "ERROR: secrets.json no encontrado en $PROJECT_ROOT"
  echo "Copia secrets.json.example o genera el archivo antes de continuar."
  exit 1
fi

# 1. Instalar browsers (idempotente)
cd "$PROJECT_ROOT/e2e"
npx playwright install chromium

# 2. Build + start servicios
cd "$PROJECT_ROOT"
docker compose up -d --build

# 3. Esperar a que estén listos
echo "Esperando a servicios..."
curl --retry 30 --retry-delay 3 --retry-connrefused \
  --max-time 90 http://localhost:8082 > /dev/null 2>&1
echo "Servicios listos."

# 4. Ejecutar tests E2E (genera screenshots automáticamente)
cd "$PROJECT_ROOT/e2e"
npx playwright test --reporter=list,html || true

# 5. Guardar logs de Docker
docker compose logs > "$EVIDENCE_DIR/logs/docker-$(date +%s).log" 2>&1

# 6. Parar servicios (siempre, incluso si fallan tests)
cd "$PROJECT_ROOT"
docker compose down

echo "=== Evidencias capturadas en $EVIDENCE_DIR ==="
echo "Screenshots: $EVIDENCE_DIR/screenshots/"
echo "Reports:     $EVIDENCE_DIR/reports/"
echo "Logs:        $EVIDENCE_DIR/logs/"
```

### 2.5 `.gitignore` (actualizar)

Reemplazar `proxy/node_modules/` por reglas globales. El `.gitignore` final será:

```
secrets.json
node_modules/
proxy/package-lock.json
e2e/package-lock.json
evidence/screenshots/
evidence/reports/
evidence/logs/*.log
```

> **Nota:** `evidence/screenshots/` y `evidence/logs/*.log` se generan bajo demanda y se suben como artifacts en CI. No se versionan en git.

---

## 3. Archivos a modificar

### 3.1 `.github/workflows/auto-merge.yml`

Flujo actual:
1. Push → Crear PR → Merge inmediato

Nuevo flujo:
1. Push → Crear PR (sin merge aún)
2. Setup Node 20 con caché npm (usando `e2e/package-lock.json`)
3. `cd e2e && npm ci` + `npx playwright install chromium`
4. Crear `secrets.json` desde GitHub Secrets (forma segura)
5. `docker compose up -d --build`
6. Esperar a servicios (curl --retry extendido)
7. `cd e2e && npx playwright test`
8. Upload evidencias como artifacts (`actions/upload-artifact@v4`)
9. `docker compose down` (con `if: always()`)
10. Merge PR (solo si todo lo anterior OK)

```yaml
name: CI automa

on:
  push:
    branches:
      - '**'
      - '!main'

jobs:
  verify-and-merge:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Create Pull Request
        id: create
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GH_REPO: ${{ github.repository }}
        run: |
          gh pr create --base main --head ${{ github.ref_name }} \
            --title "Auto-merge: ${{ github.ref_name }}" \
            --body "Automated PR by CI" || echo "PR already exists"

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: e2e/package-lock.json

      - name: Install dependencies
        working-directory: e2e
        run: npm ci

      - name: Install Playwright browsers
        working-directory: e2e
        run: npx playwright install chromium

      - name: Create secrets.json
        working-directory: ${{ github.workspace }}
        env:
          BGG_USER: ${{ secrets.BGG_USER }}
          BGG_PASS: ${{ secrets.BGG_PASS }}
        run: |
          cat > secrets.json <<EOF
          {"user":"$BGG_USER","password":"$BGG_PASS"}
          EOF

      - name: Build & Start Docker
        run: docker compose up -d --build

      - name: Wait for services
        run: |
          curl --retry 30 --retry-delay 3 --retry-connrefused \
            --max-time 90 http://localhost:8082 > /dev/null 2>&1

      - name: Run E2E tests
        working-directory: e2e
        run: npx playwright test

      - name: Upload evidence artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: evidence-${{ github.ref_name }}-${{ github.run_id }}
          path: |
            evidence/screenshots/
            evidence/reports/
            evidence/logs/
          if-no-files-found: warn
          retention-days: 30

      - name: Stop Docker
        if: always()
        run: docker compose down

      - name: Merge Pull Request
        if: success()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GH_REPO: ${{ github.repository }}
        run: |
          PR_NUMBER=$(gh pr list --base main --head ${{ github.ref_name }} \
            --json number --jq '.[0].number')
          [ -n "$PR_NUMBER" ] && [ "$PR_NUMBER" != "null" ] || { echo "No PR"; exit 1; }
          gh pr merge $PR_NUMBER --squash
```

**Requiere configurar en GitHub:** Settings → Secrets → Actions → añadir `BGG_USER` y `BGG_PASS`.

> **Nota sobre branch protection:** Este workflow requiere que la rama `main` permita merge automático por el Action o que no haya reglas de protección que bloqueen el `gh pr merge`.

### 3.2 `features_list.json`

Para **features futuras** (HDH-H04 en adelante), el campo `evidence` usará un objeto estructurado:

```json
{
  "evidence": {
    "description": "Implementación de filtros dinámicos para el dashboard.",
    "artifacts": [
      "evidence/screenshots/hdh-h04/01-inicial-desktop.png",
      "evidence/screenshots/hdh-h04/02-filtros-expandidos-desktop.png",
      "evidence/screenshots/hdh-h04/03-filtros-aplicados-desktop.png"
    ]
  }
}
```

Las features ya completadas (HDH-00 a HDH-H03) conservan su evidencia textual actual.

### 3.3 `AGENTS.md`

Añadir al final de `## Reglas de Trabajo`:

> - Después de implementar una feature, crear/actualizar su spec en `e2e/tests/<feature-id>.spec.js`
> - Tras pasar la verificación local, ejecutar `cd e2e && npm run capture:evidence` para generar pantallazos
> - Los screenshots generados en local no se versionan en git; la evidencia oficial se almacena como artifacts en GitHub Actions

---

## 4. Patrón de test para cada feature

Cada `e2e/tests/<feature-id>.spec.js` seguirá esta estructura:

```js
import { test, expect } from '@playwright/test';

test.describe('HDH-XX: Nombre de la feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('debe mostrar el componente correctamente', async ({ page }) => {
    // Screenshot 1: estado inicial
    await page.screenshot({ path: 'evidence/screenshots/hdh-xx/01-inicial-desktop.png' });

    // Interacción con la UI
    // ...

    // Screenshot 2: después de interacción
    await page.screenshot({ path: 'evidence/screenshots/hdh-xx/02-interaccion-desktop.png' });

    // Assertions
    await expect(page.locator('.selector')).toBeVisible();
    await expect(page.locator('.selector')).toContainText('valor esperado');

    // Screenshot 3: estado final
    await page.screenshot({ path: 'evidence/screenshots/hdh-xx/03-final-desktop.png' });
  });
});
```

### Convención de nombres para screenshots

```
evidence/screenshots/<feature-id>/<orden>-<estado>-<viewport>.png
```

Ejemplos:
- `evidence/screenshots/hdh-h04/01-inicial-desktop.png`
- `evidence/screenshots/hdh-h04/02-filtros-expandidos-desktop.png`
- `evidence/screenshots/hdh-05a/01-kpis-visibles-desktop.png`

---

## 5. Modo Offline / Mock de BGG

Para reducir dependencia de la API externa y acelerar tests:

1. Crear `e2e/tests/fixtures/mock-data.json` con respuestas típicas de BGG.
2. Implementar soporte en el proxy para modo mock (variable de entorno `MOCK_BGG=true`).
3. En CI y local, usar mock por defecto para tests de UI; ejecutar tests contra BGG real en un job separado (opcional, periódico).

```yaml
# Ejemplo de uso en docker-compose.override.yml para tests
services:
  proxy:
    environment:
      - MOCK_BGG=true
```

---

## 6. Resumen de archivos

| Archivo | Acción |
|---|---|
| `e2e/package.json` | Crear |
| `e2e/package-lock.json` | Generar y versionar |
| `e2e/playwright.config.js` | Crear |
| `e2e/tests/app.spec.js` | Crear |
| `e2e/tests/fixtures/mock-data.json` | Crear |
| `e2e/scripts/capture-evidence.sh` | Crear |
| `evidence/screenshots/.gitkeep` | Crear |
| `evidence/reports/.gitkeep` | Crear |
| `evidence/logs/.gitkeep` | Crear |
| `.gitignore` | Modificar |
| `.github/workflows/auto-merge.yml` | Modificar |
| `AGENTS.md` | Modificar |

---

## 7. Dependencias externas

- `@playwright/test` ^1.52.0 (npm, en `e2e/`)
- Chromium browser (instalado vía `npx playwright install chromium`)
- Docker + Docker Compose (ya existente)
- Node.js 20+ (ya existente en CI y proxy)
- GitHub Secrets `BGG_USER` y `BGG_PASS` (configurar en Settings → Secrets → Actions)

---

## 8. Flujo de trabajo final

```
1. Agente implementa feature
2. Agente crea/actualiza e2e/tests/<feature-id>.spec.js
3. Agente ejecuta: cd e2e && npm run capture:evidence
   → Verifica secrets.json
   → docker compose build & up
   → playwright test (genera screenshots + assertions)
   → Guarda logs de Docker
   → docker compose down
4. Agente verifica evidence/screenshots/ generados localmente (no se versionan)
5. Commit (código + e2e/tests/ + evidence/.gitkeep)
6. Push → GitHub Action:
   a. Crea PR
   b. Re-ejecuta tests + captura evidencias
   c. Sube artifacts a GitHub
   d. Mergea PR solo si tests OK
```

---

## 9. Control de crecimiento del repo

- **Screenshots:** NO se versionan en git. Se generan localmente bajo demanda y se almacenan como artifacts en GitHub Actions (`retention-days: 30`).
- **Reports:** `evidence/reports/` está en `.gitignore` (HTML reports son regenerables).
- **Logs:** `evidence/logs/*.log` está en `.gitignore`.
- **package-lock.json:** Se versiona en `e2e/` para builds reproducibles en CI.

Si en el futuro se decide versionar screenshots, se debe usar **git-lfs obligatoriamente** para `evidence/screenshots/**/*.png`.

---

## 10. Troubleshooting

| Problema | Solución |
|---|---|
| `secrets.json no encontrado` | Copiar `secrets.json.example` a `secrets.json` o generar el archivo con credenciales válidas. |
| Playwright no encuentra Chromium | Ejecutar `cd e2e && npx playwright install chromium` |
| Puerto 8082 ocupado | Verificar con `lsof -i :8082` y matar el proceso, o cambiar el puerto en `docker-compose.yml` |
| Tests flaky por animaciones de Chart.js | Asegurar que `page.waitForLoadState('networkidle')` se usa en `beforeEach` |
| CI falla en "Wait for services" | El timeout es de 90s. Revisar logs de Docker en el artifact o ejecutar `docker compose logs` localmente. |
| Merge automático bloqueado | Verificar branch protection rules en GitHub; el workflow requiere permiso para mergear sin review manual. |

---

## 11. Rollback y limpieza

Si un test falla repetidamente y genera archivos huérfanos:

```bash
# Limpiar evidencias locales (no afecta código versionado)
rm -rf evidence/screenshots/* evidence/reports/* evidence/logs/*

# Reconstruir desde cero
cd e2e && npm run capture:evidence
```

---
