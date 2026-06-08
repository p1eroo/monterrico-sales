-- Otorgar permiso archivos.ver al rol operador para descargar adjuntos desde Mensajes

INSERT INTO "Authority" ("id", "roleId", "permission")
SELECT substr(md5(random()::text || clock_timestamp()::text || 'archivos.ver'), 1, 25), r.id, 'archivos.ver'
FROM "Role" r
WHERE r.slug = 'operador'
  AND NOT EXISTS (
    SELECT 1 FROM "Authority" a WHERE a."roleId" = r.id AND a.permission = 'archivos.ver'
  );
