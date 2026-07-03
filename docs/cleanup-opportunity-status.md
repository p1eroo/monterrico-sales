# Cleanup Plan: Eliminar `status` de oportunidades (backend + BD)

*Documentado el 2026-07-03 — Pendiente de ejecución*

## Estado actual
El campo `status` (abierta/ganada/perdida) está oculto en la UI desde el 03/07/2026.
Los usuarios no lo ven ni lo usan. Sin embargo, el backend y BD aún lo procesan.

## Dependencias actuales de `status`

### Analytics (`analytics.service.ts`)
- `status: 'ganada'` → filtrar oportunidades ganadas para reportes
- `status: { in: ['abierta', 'ganada', 'cerrada'] }` → cartera activa
- Se pueden reemplazar con `etapa === 'activo'` y `etapa !== 'cierre_perdido'`

### Notificaciones (`opportunities.service.ts`)
- `status === 'ganada'` → `notifyOpportunityWon()`
- Se puede reemplazar con `etapa === 'activo'`

### Sync (`entity-sync.service.ts`)
- Duplica `statusFromEtapa()` — se puede eliminar

## Plan de ejecución

### 1. Backend — Analytics
**Archivo:** `backend/src/analytics/analytics.service.ts`
- Reemplazar `where: { status: 'ganada' }` → `where: { etapa: 'activo' }`
- Reemplazar `where: { status: { in: ['abierta', 'ganada', 'cerrada'] } }` → `where: { etapa: { not: { in: ['cierre_perdido', 'inactivo'] } } }`

### 2. Backend — Opportunities service
**Archivo:** `backend/src/opportunities/opportunities.service.ts`
- Eliminar `PipelineOpportunityStatus` type
- Eliminar `statusFromEtapa()` method
- Eliminar `normalizeManualStatus()` method
- Eliminar `status` de create/update DTO y lógica
- Cambiar notificación: `status === 'ganada'` → `etapa === 'activo'`

### 3. Backend — Sync
**Archivo:** `backend/src/sync/entity-sync.service.ts`
- Eliminar `statusFromEtapa()` duplicado
- Eliminar `status` de las queries de create/update

### 4. Backend — Import/Export
**Archivo:** `backend/src/import-export/import-export.service.ts`
- Eliminar filtro por `status`

### 5. BD
**Archivo:** `backend/prisma/schema.prisma`
- Eliminar columna `status`
- Eliminar índice `@@index([status])`
- Migración: `npx prisma migrate dev --name remove-opportunity-status`

### 6. Prisma Client
**Comando:**
```bash
cd backend && npx prisma generate
```

### 7. Frontend — Tipos
**Archivo:** `frontend/src/types/index.ts`
- Eliminar `OpportunityStatus` type
- Eliminar `status` del interface `Opportunity`

### 8. Frontend — Store & API
- `frontend/src/lib/opportunityApi.ts`: eliminar `parseStatus()`, eliminar `status` de params y mapping
- `frontend/src/store/crmStore.ts`: eliminar `opportunityStatusFromEtapa()`, eliminar `status` de create/update

## Notas
- La UI ya no usa `status` (oculto desde 03/07/2026)
- Después de ejecutar este plan, eliminar este archivo
- No hay rollback posible después de la migración de BD
