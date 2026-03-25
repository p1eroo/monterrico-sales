-- Subtipo de tarea (llamada, reunion, correo, whatsapp). Las filas del módulo Tareas usan type = 'tarea' + taskKind.
ALTER TABLE "Activity" ADD COLUMN "taskKind" TEXT;

UPDATE "Activity"
SET "taskKind" = "type", "type" = 'tarea'
WHERE "type" IN ('llamada', 'reunion', 'correo', 'whatsapp');

UPDATE "Activity"
SET "taskKind" = 'llamada'
WHERE "type" = 'tarea' AND "taskKind" IS NULL;
