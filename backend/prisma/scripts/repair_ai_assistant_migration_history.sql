-- Reparación: drift entre historial Prisma en BD y carpetas locales.
--
-- Síntoma: migrate dev dice que hay migraciones "aplicadas en la BD pero ausentes
-- en el directorio local" (p. ej. 20260425130000_*, 20260425130100_*, 20260426120000_*)
-- y la tabla AiAssistantInstruction ya existe.
--
-- NO uses `prisma migrate reset` en una BD compartida o con datos de producción.
--
-- Pasos:
-- 1) Conecta a la misma base que DATABASE_URL (ej. psql).
-- 2) Revisa el historial:
--    SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at;
-- 3) Ejecuta el DELETE de abajo solo si esas migration_name no existen en tu
--    carpeta backend/prisma/migrations/ (solo quitas fantasmas del historial).
-- 4) Tras el DELETE, en el proyecto backend:
--    - Si "AiAssistantInstruction" YA existe y la estructura coincide con schema.prisma:
--        npx prisma migrate resolve --applied 20260428130000_ai_assistant_instructions
--    - Si la tabla NO existe:
--        npx prisma migrate deploy
-- 5) Opcional: comprueba permisos agentes_ia:
--    SELECT permission, COUNT(*) FROM "Authority" WHERE permission LIKE 'agentes_ia%' GROUP BY 1;

DELETE FROM "_prisma_migrations"
WHERE migration_name IN (
  '20260425130000_ai_assistant_instructions',
  '20260425130100_agentes_ia_permission_asesor',
  '20260426120000_ai_assistant_instructions'
);
