-- Nuevos permisos CRM (dashboard, clientes, correo, campanas, archivos, equipo, roles, auditoria)
-- 1) Rol admin: conjunto completo por acción
-- 2) Roles supervisor / solo_lectura: lectura de nuevos módulos + usuarios/roles.ver donde aplica
-- 3) Rol asesor: lectura de módulos operativos sin usuarios/roles/auditoría

INSERT INTO "Authority" ("id", "roleId", "permission")
SELECT substr(md5(random()::text || clock_timestamp()::text || p), 1, 25), r.id, p
FROM "Role" r
CROSS JOIN LATERAL unnest(ARRAY[
  'dashboard.ver', 'dashboard.crear', 'dashboard.editar', 'dashboard.eliminar', 'dashboard.asignar',
  'clientes.ver', 'clientes.crear', 'clientes.editar', 'clientes.eliminar', 'clientes.asignar',
  'correo.ver', 'correo.crear', 'correo.editar', 'correo.eliminar', 'correo.asignar',
  'campanas.ver', 'campanas.crear', 'campanas.editar', 'campanas.eliminar', 'campanas.asignar',
  'archivos.ver', 'archivos.crear', 'archivos.editar', 'archivos.eliminar', 'archivos.asignar',
  'equipo.ver', 'equipo.crear', 'equipo.editar', 'equipo.eliminar', 'equipo.asignar',
  'roles.ver', 'roles.crear', 'roles.editar', 'roles.eliminar', 'roles.asignar',
  'auditoria.ver', 'auditoria.crear', 'auditoria.editar', 'auditoria.eliminar', 'auditoria.asignar'
]) AS p
WHERE r.slug = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM "Authority" a WHERE a."roleId" = r.id AND a.permission = p
  );

INSERT INTO "Authority" ("id", "roleId", "permission")
SELECT substr(md5(random()::text || clock_timestamp()::text || p), 1, 25), r.id, p
FROM "Role" r
CROSS JOIN LATERAL unnest(ARRAY[
  'dashboard.ver',
  'clientes.ver',
  'correo.ver',
  'campanas.ver',
  'archivos.ver',
  'equipo.ver',
  'roles.ver',
  'auditoria.ver',
  'usuarios.ver'
]) AS p
WHERE r.slug IN ('supervisor', 'solo_lectura')
  AND NOT EXISTS (
    SELECT 1 FROM "Authority" a WHERE a."roleId" = r.id AND a.permission = p
  );

INSERT INTO "Authority" ("id", "roleId", "permission")
SELECT substr(md5(random()::text || clock_timestamp()::text || p), 1, 25), r.id, p
FROM "Role" r
CROSS JOIN LATERAL unnest(ARRAY[
  'dashboard.ver',
  'clientes.ver',
  'correo.ver',
  'campanas.ver',
  'archivos.ver',
  'equipo.ver',
  'usuarios.ver'
]) AS p
WHERE r.slug = 'asesor'
  AND NOT EXISTS (
    SELECT 1 FROM "Authority" a WHERE a."roleId" = r.id AND a.permission = p
  );
