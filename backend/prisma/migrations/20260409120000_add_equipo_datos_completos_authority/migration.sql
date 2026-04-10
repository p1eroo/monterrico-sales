-- Permiso: ver datos CRM de todo el equipo (listados sin acotar por asignación).
-- Roles operativos tipo «asesor» no lo reciben; admin, supervisor y solo_lectura sí.

INSERT INTO "Authority" ("id", "roleId", "permission")
SELECT substr(md5(random()::text || clock_timestamp()::text), 1, 25), r.id, 'equipo.datos_completos'
FROM "Role" r
WHERE r.slug IN ('admin', 'supervisor', 'solo_lectura')
  AND NOT EXISTS (
    SELECT 1 FROM "Authority" a
    WHERE a."roleId" = r.id AND a.permission = 'equipo.datos_completos'
  );
