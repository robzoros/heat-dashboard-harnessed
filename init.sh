#!/usr/bin/env bash


# ──────────────────────────────────────────────────────────────────────────────
# PALETA DE OUTPUT  (sin dependencias externas)
# ──────────────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
 
ok()   { echo -e "  ${GREEN}✔${RESET}  $*"; }
fail() { echo -e "  ${RED}✘${RESET}  $*"; exit 1; }
warn() { echo -e "  ${YELLOW}▲${RESET}  $*"; }
info() { echo -e "  ${CYAN}→${RESET}  $*"; }
step() { echo -e "\n${BOLD}$*${RESET}"; }
 
#Existen los ficheros de infra
if [ -f "features_list.json" ]; then
  ok "features_list.json existe."
else
  fail "Error: El fichero features_list.json no existe."
fi

if [ -f "src/index.html" ]; then
  ok "Frontend estático existe."
else
  fail "Error: El fichero src/index.html no existe."
fi

if [ -f "src/app.js" ]; then
  ok "JavaScript estático existe."
else
  fail "Error: El fichero src/app.js no existe."
fi

if [ -f "src/data/heat-data.json" ]; then
  ok "JSON estático de datos existe."
else
  fail "Error: El fichero src/data/heat-data.json no existe."
fi

if [ -f ".github/workflows/weekly-data.yml" ]; then
  ok "Workflow semanal existe."
else
  fail "Error: El fichero .github/workflows/weekly-data.yml no existe."
fi

#Git repository check
DIR=$(pwd)

if git rev-parse --git-dir > /dev/null 2>&1; then
  git pull origin main
  ok "Repositorio git encontrado en: $DIR"
else
  warn "No hay repositorio git. Inicializando..."
  git init
  info "# $(basename "$DIR")" > README.md
  git add .
  git commit -m "init: first commit"
  git branch -M main
  git remote add origin https://github.com/robzoros/heat-dashboard-harnessed.git
  git remote set-url origin git@github.com:robzoros/heat-dashboard-harnessed.git
  git push -u origin main
  ok "Repositorio creado con README.md"
fi
