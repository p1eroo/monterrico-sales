-- Permiso exportar oportunidades (plantilla + CSV), alineado con contactos/empresas

INSERT INTO "Authority" ("id", "roleId", "permission")
SELECT substr(md5(random()::text || clock_timestamp()::text || p), 1, 25), r.id, p
FROM "Role" r
CROSS JOIN LATERAL unnest(ARRAY['oportunidades.exportar']) AS p
WHERE r.slug IN ('admin', 'supervisor', 'asesor')
  AND NOT EXISTS (
    SELECT 1 FROM "Authority" a WHERE a."roleId" = r.id AND a.permission = p
  );
