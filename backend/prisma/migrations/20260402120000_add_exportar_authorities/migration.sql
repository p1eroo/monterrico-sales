-- Permiso exportar (plantillas / descargas) en módulos con UI de exportación
-- admin y supervisor: incluye reportes.exportar; asesor: sin reportes.exportar

INSERT INTO "Authority" ("id", "roleId", "permission")
SELECT substr(md5(random()::text || clock_timestamp()::text || p), 1, 25), r.id, p
FROM "Role" r
CROSS JOIN LATERAL unnest(ARRAY[
  'dashboard.exportar',
  'contactos.exportar',
  'empresas.exportar',
  'reportes.exportar',
  'clientes.exportar',
  'campanas.exportar'
]) AS p
WHERE r.slug IN ('admin', 'supervisor')
  AND NOT EXISTS (
    SELECT 1 FROM "Authority" a WHERE a."roleId" = r.id AND a.permission = p
  );

INSERT INTO "Authority" ("id", "roleId", "permission")
SELECT substr(md5(random()::text || clock_timestamp()::text || p), 1, 25), r.id, p
FROM "Role" r
CROSS JOIN LATERAL unnest(ARRAY[
  'dashboard.exportar',
  'contactos.exportar',
  'empresas.exportar',
  'clientes.exportar',
  'campanas.exportar'
]) AS p
WHERE r.slug = 'asesor'
  AND NOT EXISTS (
    SELECT 1 FROM "Authority" a WHERE a."roleId" = r.id AND a.permission = p
  );
