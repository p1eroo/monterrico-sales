-- No-op: el SQL de permisos extendidos está en 20260327120002_expand_rbac_authorities
-- (debe ejecutarse después de crear Role y Authority en 20260327120000).
-- Evita P3006 en shadow DB y mantiene el id de migración para BDs que ya la tenían registrada.
SELECT 1;
