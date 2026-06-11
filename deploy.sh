#!/bin/bash
set -e
set -o pipefail

# ============================================================
#  Monterrico Sales - Deploy Script
#  Actualiza codigo, dependencias, compila y reinicia PM2
# ============================================================

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

header() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  $1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

ok()   { echo -e "  ${GREEN}✔${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✖${NC} $1"; }
info() { echo -e "  ${GRAY}→${NC} $1"; }

# ============================================================
header "Validando entorno"

cd "$SCRIPT_DIR"

if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
  fail "No se encontro backend/.env"
  exit 1
fi
ok "backend/.env encontrado"

if ! command -v pm2 &>/dev/null; then
  fail "PM2 no instalado. Instalalo con: npm install -g pm2"
  exit 1
fi
ok "PM2 disponible"

# ============================================================
header "Actualizando codigo"

if command -v git &>/dev/null && [ -d ".git" ]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  info "Rama: $BRANCH"

  git fetch origin 2>/dev/null || true

  LOCAL=$(git rev-parse HEAD 2>/dev/null)
  REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "")

  if [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
    git stash --include-untracked 2>/dev/null || true
    git pull origin "$BRANCH"
    git stash pop 2>/dev/null || true
    ok "Codigo actualizado"
  else
    ok "Codigo ya esta al dia"
  fi
else
  warn "No es un repositorio git, saltando pull"
fi

# ============================================================
header "Backend - dependencias y compilacion"

cd "$SCRIPT_DIR/backend"

info "Instalando dependencias..."
npm install 2>&1 | tail -1
ok "Dependencias instaladas"

info "Generando Prisma client..."
npx prisma generate 2>&1 | tail -3
ok "Prisma client generado"

info "Compilando TypeScript..."
npm run build 2>&1 | tail -3
ok "Backend compilado"

# ============================================================
header "Frontend - dependencias y compilacion"

cd "$SCRIPT_DIR/frontend"

info "Instalando dependencias..."
npm install 2>&1 | tail -1
ok "Dependencias instaladas"

info "Compilando (tsc + vite)..."
npm run build 2>&1 | tail -5
ok "Frontend compilado"

# ============================================================
header "Desplegando frontend"

rm -rf "$SCRIPT_DIR/backend/public"
cp -r "$SCRIPT_DIR/frontend/dist" "$SCRIPT_DIR/backend/public"
ok "Frontend copiado a backend/public/"

# ============================================================
header "Reiniciando servicio PM2"

if pm2 describe monterrico-api &>/dev/null; then
  pm2 restart monterrico-api
  ok "monterrico-api reiniciado"
else
  info "Proceso monterrico-api no encontrado en PM2, iniciando..."
  cd "$SCRIPT_DIR/backend"
  pm2 start dist/main.js \
    --name monterrico-api \
    --cwd "$SCRIPT_DIR/backend" \
    --max-memory-restart 500M \
    --time \
    2>&1 | tail -5
  pm2 save 2>/dev/null
  ok "monterrico-api iniciado"
fi

# ============================================================
header "Verificando servicio"

sleep 3

PORT=$(grep -oP '^PORT=\K\d+' "$SCRIPT_DIR/backend/.env" 2>/dev/null || echo "3000")

if curl -sf "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
  ok "Backend respondiendo en puerto $PORT"
else
  warn "Backend no responde aun, puede tardar unos segundos"
  info "Verifica con: curl http://127.0.0.1:${PORT}/"
  info "Logs: pm2 logs monterrico-api"
fi

# ============================================================
header "Despliegue completado"

echo ""
echo -e "  ${GREEN}${BOLD}Monterrico Sales actualizado exitosamente${NC}"
echo ""
echo -e "  ${BOLD}Comandos utiles:${NC}"
echo -e "  ${GRAY}├${NC} pm2 logs monterrico-api     ${GRAY}# Ver logs${NC}"
echo -e "  ${GRAY}├${NC} pm2 restart monterrico-api  ${GRAY}# Reiniciar${NC}"
echo -e "  ${GRAY}└${NC} pm2 status                  ${GRAY}# Estado${NC}"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
