# Documentación del proyecto

| Documento | Contenido |
|-----------|-----------|
| [AUTH.md](./AUTH.md) | Auth local: migración, primer usuario, login, registro, cambio de contraseña (resumen). |
| [AUTH_Y_API.md](./AUTH_Y_API.md) | Integración paso a paso: JWT, `api()`, permisos, registro, usuarios y contraseña. |
| [USUARIOS_API.md](./USUARIOS_API.md) | CRUD de usuarios en API: `GET`/`POST`/`PATCH`, roles `r1`–`r4`, permisos **solo admin** para alta/edición. |
| [EMPRESAS_API.md](./EMPRESAS_API.md) | CRUD de empresas (`/companies`), Prisma `Company`, integración en Empresas / detalle. |
| [OPORTUNIDADES_API.md](./OPORTUNIDADES_API.md) | CRUD de oportunidades (`/opportunities`), Prisma `Opportunity`, listado y detalle. |
| [CONTACTOS_API.md](./CONTACTOS_API.md) | CRUD de contactos (`/contacts`), vínculo inicial con empresa, detalle con relaciones. |

## API vs mock (resumen frontend)

| Área | Fuente principal |
|------|------------------|
| Listados Contactos, Oportunidades | Solo API (`contactListPaginated` / `opportunityListAll`) |
| Altas contacto/oportunidad (UX inmediata) | API + filas temporales en `optimisticCrmStore` hasta reconciliar |
| Pipeline | Contactos `contactListAll` + oportunidades `opportunityListAll` (primera opp por contacto) |
| Dashboard “últimos contactos”, notificaciones (empresas inactivas) | `contactListAll` |
| Detalle contacto/oportunidad/empresa con id tipo **cuid** | API; `crmStore` no mezcla listados de servidor en esas vistas |
| Detalle por id mock, EmpresaDetail por **slug** sin cuid | Puede usar `crmStore` y merge API+local |
| Gráficos del Dashboard, campañas, informes, parte de Tareas/Calendario / `UserDetail` | Datos de negocio aún en `@/data/mock` o helpers (`weeklySales`, `monthlySales`) |
| Etiquetas y catálogos UI (`etapaLabels`, `contactSourceLabels`, `priorityLabels`, …) | `@/data/mock` como texto fijo (no sustituyen API) |

## Backend — permisos CRM

Los endpoints `POST`/`PATCH`/`DELETE` (y los `GET` de listado/detalle) de **contacts**, **companies**, **opportunities** y **activities** exigen permisos alineados con el frontend (`contactos.ver`, `empresas.crear`, etc.) según la tabla **Authority** del rol del usuario. **Factiliza:** DNI/CEE → `contactos.ver`; RUC → `empresas.ver`. **Users:** `usuarios.ver` / `usuarios.crear` / `usuarios.editar`. **Roles:** mutaciones con `roles.crear` / `roles.editar` / `roles.eliminar`; `GET /roles` está abierto a cualquier usuario autenticado (listados en formularios). La matriz de UI incluye además módulos `dashboard`, `clientes`, `correo`, `campanas`, `archivos`, `equipo`, `roles`, `auditoria` (clave interna `actividades` = tareas/calendario; etiqueta **Tareas**).

Migración **`20260324190000_expand_rbac_authorities`:** añade autoridades nuevas al rol `admin` y lecturas (`*.ver`) para slugs `supervisor`, `solo_lectura` y `asesor` si existen. Ejecutar `npx prisma migrate deploy` en el backend. Tras actualizar, conviene **nuevo login** para JWT con `roleId`.

Nueva documentación general: preferir añadir archivos bajo **`docs/`** y enlazarlos desde aquí si aplica.
