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

# 1. Instalar browsers (idempotente) - ignorar errores en entornos no soportados
cd "$PROJECT_ROOT/e2e"
npx playwright install chromium || echo "WARNING: No se pudo instalar Chromium via Playwright. Usando sistema si está disponible."

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
