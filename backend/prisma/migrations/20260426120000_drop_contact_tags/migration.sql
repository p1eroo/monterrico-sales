-- Eliminar etiquetas en contactos (no usadas en producto)
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "tags";
