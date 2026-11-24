#!/usr/bin/env bash
#
# decide si un conjunto de cambios toca código ejecutable y, por tanto, si
# merece la pena ejecutar los tests E2E.
#
# Uso:
#   .github/scripts/detect-code-changes.sh [base-ref]
#
#   base-ref  referencia contra la que comparar (por defecto origin/main).
#
# Entrada alternativa para pruebas locales (sin git):
#   CHANGED_FILES=$'PROGRESS.md\nsrc/app.js' .github/scripts/detect-code-changes.sh
#
# Salida: líneas "code_changed=true|false", el motivo y la lista de archivos.
# Si existe $GITHUB_OUTPUT escribe ahí code_changed=<bool> (formato de Actions).
# Siempre termina con código 0 salvo error de git.

set -uo pipefail

BASE_REF="${1:-origin/main}"

# Rutas que contienen código ejecutable o configuración que puede romper la app.
# Todo lo que no encaje aquí (documentación, artefactos de proceso, evidencias,
# skills, datos generados) no obliga a ejecutar tests.
is_code_path() {
    case "$1" in
        src/*|e2e/*|scripts/*|proxy/*) return 0 ;;
        .github/workflows/*|.github/scripts/*) return 0 ;;
        package.json|package-lock.json) return 0 ;;
        */package.json|*/package-lock.json) return 0 ;;
        init.sh|Dockerfile*|docker-compose.yml|nginx*.conf) return 0 ;;
        *.js|*.mjs|*.cjs|*.ts|*.html|*.css) return 0 ;;
        *) return 1 ;;
    esac
}

if [ -n "${CHANGED_FILES:-}" ]; then
    FILES="$CHANGED_FILES"
else
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        echo "Aviso: no es un repositorio git; se asume cambio de código." >&2
        echo "code_changed=true"
        [ -n "${GITHUB_OUTPUT:-}" ] && echo "code_changed=true" >> "$GITHUB_OUTPUT"
        exit 0
    fi
    # diff --name-only: archivos tocados desde la base (merge-base si es posible).
    if FILES=$(git diff --name-only "${BASE_REF}...HEAD" 2>/dev/null); then
        :
    else
        echo "Aviso: no se pudo comparar con ${BASE_REF}; se asume cambio de código." >&2
        echo "code_changed=true"
        [ -n "${GITHUB_OUTPUT:-}" ] && echo "code_changed=true" >> "$GITHUB_OUTPUT"
        exit 0
    fi
fi

CODE=0
CODE_FILES=()
OTHER_FILES=()

while IFS= read -r file; do
    [ -n "$file" ] || continue
    if is_code_path "$file"; then
        CODE=1
        CODE_FILES+=("$file")
    else
        OTHER_FILES+=("$file")
    fi
done <<< "$FILES"

if [ "$CODE" -eq 1 ]; then
    echo "code_changed=true"
    echo "Motivo: el cambio toca código ejecutable."
    printf '  código: %s\n' "${CODE_FILES[@]}"
else
    echo "code_changed=false"
    echo "Motivo: solo documentación, artefactos de proceso o evidencias; se omiten los tests E2E."
    if [ ${#OTHER_FILES[@]} -gt 0 ]; then
        printf '  sin código: %s\n' "${OTHER_FILES[@]}"
    else
        echo "  (sin archivos)"
    fi
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
    {
        echo "code_changed=$([ "$CODE" -eq 1 ] && echo true || echo false)"
        if [ "$CODE" -eq 1 ]; then
            echo "code_files<<EOF"
            printf '%s\n' "${CODE_FILES[@]}"
            echo "EOF"
        else
            echo "code_files<<EOF"
            printf '%s\n' "${OTHER_FILES[@]}"
            echo "EOF"
        fi
    } >> "$GITHUB_OUTPUT"
fi
