#!/bin/bash
set -e
set -o pipefail

# ============================================================
#  Monterrico Sales - Deploy Script
#  Frontend → /var/www/crm-client/
#  Backend  → PM2 monterrico-api
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
header "Frontend - dependencias y compilacion"

cd "$SCRIPT_DIR/frontend"

info "Instalando dependencias..."
npm install 2>&1 | tail -1
ok "Frontend dependencias instaladas"

info "Compilando..."
npm run build 2>&1 | tail -5
ok "Frontend compilado"

info "Copiando a /var/www/crm-client/..."
cp -r dist/* /var/www/crm-client/
ok "Frontend desplegado en /var/www/crm-client/"

# ============================================================
header "Backend - dependencias y compilacion"

cd "$SCRIPT_DIR/backend"

info "Instalando dependencias..."
npm install 2>&1 | tail -1
ok "Backend dependencias instaladas"

info "Generando cliente Prisma..."
npx prisma generate 2>&1 | tail -3
ok "Cliente Prisma generado"

info "Compilando con memoria extendida..."
NODE_OPTIONS="--max-old-space-size=4096" npm run build 2>&1 | tail -5
ok "Backend compilado"

# ============================================================
header "Reiniciando servicio"

pm2 restart monterrico-api
ok "monterrico-api reiniciado"

# ============================================================
header "Verificando"

sleep 2

PORT=$(grep -oP '^PORT=\K\d+' "$SCRIPT_DIR/backend/.env" 2>/dev/null || echo "3000")

if curl -sf "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
  ok "Backend respondiendo en puerto $PORT"
else
  warn "Backend no responde aun"
  info "Logs: pm2 logs monterrico-api"
fi

# ============================================================
header "Listo"
echo ""
echo -e "  ${GREEN}${BOLD}Monterrico Sales actualizado${NC}"
echo ""
