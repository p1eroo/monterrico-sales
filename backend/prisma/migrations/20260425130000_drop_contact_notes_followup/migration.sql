-- Eliminar campos de contacto no usados (seguimiento vía actividades/tareas)
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "notes";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "nextAction";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "nextFollowUp";
