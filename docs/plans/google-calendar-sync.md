# Google Calendar Sincronización CRM → Google

## Objetivo

Al crear/editar/eliminar actividades tipo "reunión" en el CRM, sincronizar automáticamente con Google Calendar.

## ¿Qué tipos se sincronizan?

| Tipo | Sincronizar? |
|------|-------------|
| Reunión | ✅ Sí |
| Llamada | ❌ No |
| Correo | ❌ No |
| WhatsApp | ❌ No |
| Tarea | ❌ No (opcional: Google Tasks después) |

## Vinculación CRM ↔ Google

Guardar el `googleEventId` en la actividad del CRM para poder actualizar/eliminar después.

**Opción elegida:** metadata en `description` (sin migración).

```ts
// Al guardar, agregar al final de la descripción:
const description = `${data.description ?? ''}\n\n[googleEventId:${googleEvent.id}]`;

// Al leer, extraer:
const googleEventId = description.match(/\[googleEventId:(.*?)\]/)?.[1];
const cleanDescription = description.replace(/\n\n\[googleEventId:.*?\]/, '');
```

## Flujo completo

### 1. Crear actividad "reunión"

```
handleSaveEvent(data):
  1. createActivity(payload) → éxito
  2. Si googleConnected y data.type === 'reunion':
     a. createGoogleEvent({ summary, description, start, end })
     b. updateActivity(id, { description: desc + "[googleEventId:...]" })
```

### 2. Editar actividad "reunión"

```
handleSaveEvent(data) con editingEvent:
  1. Si editingEvent tiene googleEventId:
     updateGoogleEvent(googleEventId, nuevos datos)
  2. updateActivity(id, payload)
```

### 3. Eliminar actividad "reunión"

```
onDelete(ev):
  1. Si ev tiene googleEventId:
     deleteGoogleEvent(googleEventId)
  2. deleteActivity(ev.id)
```

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `Calendario.tsx` → `handleSaveEvent` | Después de createActivity/updateActivity, sincronizar con Google Calendar |
| `Calendario.tsx` → `onDelete` | Antes de deleteActivity, eliminar de Google Calendar si tiene googleEventId |
| `lib/activityApi.ts` | Helper: `extractGoogleEventId(description)` y `cleanGoogleEventId(description)` |

## APIs existentes

| Endpoint | Ya existe? |
|----------|-----------|
| `POST /google-calendar/events` | ✅ |
| `PATCH /google-calendar/events/:id` | ✅ |
| `DELETE /google-calendar/events/:id` | ✅ |

## Notas

- No sincronizar eventos que VINIERON de Google Calendar (evitar loop)
- Solo sincronizar cuando `googleConnected === true`
- La sincronización es unidireccional: CRM → Google
