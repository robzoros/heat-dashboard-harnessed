#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
EVIDENCE_DIR="$PROJECT_ROOT/evidence"

echo "=== Captura de Evidencias ==="
mkdir -p "$EVIDENCE_DIR/screenshots" "$EVIDENCE_DIR/logs" "$EVIDENCE_DIR/reports"

cd "$PROJECT_ROOT/e2e"
npx playwright install chromium || echo "WARNING: No se pudo instalar Chromium via Playwright. Usando sistema si está disponible."

cd "$PROJECT_ROOT"
python3 -m http.server 8082 --directory src > "$EVIDENCE_DIR/logs/static-server-$(date +%s).log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

echo "Esperando al sitio estático..."
curl --retry 20 --retry-delay 1 --retry-connrefused \
  --max-time 30 http://localhost:8082 > /dev/null 2>&1

cd "$PROJECT_ROOT/e2e"
npx playwright test --reporter=list,html

echo "=== Evidencias capturadas en $EVIDENCE_DIR ==="
echo "Screenshots: $EVIDENCE_DIR/screenshots/"
echo "Reports:     $EVIDENCE_DIR/reports/"
echo "Logs:        $EVIDENCE_DIR/logs/"
