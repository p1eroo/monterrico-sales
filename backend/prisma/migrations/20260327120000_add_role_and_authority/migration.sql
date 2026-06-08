-- CreateTable: Role
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");

-- CreateTable: Authority
CREATE TABLE "Authority" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,

    CONSTRAINT "Authority_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Authority_roleId_permission_key" ON "Authority"("roleId", "permission");

-- Solo rol admin inicial (el resto se crea desde la UI cuando lo indiques)
INSERT INTO "Role" ("id", "name", "slug", "description", "isSystem", "createdAt", "updatedAt") VALUES
  ('croleadmin000000000000001', 'Administrador', 'admin', 'Acceso total al CRM', true, NOW(), NOW());

-- Permisos de admin
INSERT INTO "Authority" ("id", "roleId", "permission")
SELECT 'c' || substr(md5('admin-' || p), 1, 24), 'croleadmin000000000000001', p
FROM unnest(ARRAY[
  'contactos.ver','contactos.crear','contactos.editar','contactos.eliminar','contactos.asignar',
  'empresas.ver','empresas.crear','empresas.editar','empresas.eliminar','empresas.asignar',
  'oportunidades.ver','oportunidades.crear','oportunidades.editar','oportunidades.eliminar','oportunidades.asignar',
  'pipeline.ver','pipeline.crear','pipeline.editar','pipeline.eliminar','pipeline.asignar',
  'actividades.ver','actividades.crear','actividades.editar','actividades.eliminar','actividades.asignar',
  'reportes.ver','reportes.crear','reportes.editar','reportes.eliminar','reportes.asignar',
  'usuarios.ver','usuarios.crear','usuarios.editar','usuarios.eliminar','usuarios.asignar',
  'configuracion.ver','configuracion.crear','configuracion.editar','configuracion.eliminar','configuracion.asignar'
]) AS p;

-- Add new roleId column to User
ALTER TABLE "User" ADD COLUMN "roleIdNew" TEXT;

-- Backfill: map User.role a Role.id (solo admin existe; el resto va a admin)
UPDATE "User" u SET "roleIdNew" = COALESCE(
  (SELECT r."id" FROM "Role" r WHERE LOWER(TRIM(r.slug)) = LOWER(TRIM(u."role")) LIMIT 1),
  (SELECT r."id" FROM "Role" r WHERE r.slug = 'admin' LIMIT 1)
);

-- Usuarios sin rol asignado -> admin
UPDATE "User" SET "roleIdNew" = (SELECT "id" FROM "Role" WHERE slug = 'admin' LIMIT 1) WHERE "roleIdNew" IS NULL;

-- Drop old columns
ALTER TABLE "User" DROP COLUMN IF EXISTS "roleId";
ALTER TABLE "User" DROP COLUMN "role";

-- Rename new column
ALTER TABLE "User" RENAME COLUMN "roleIdNew" TO "roleId";

-- Add FK and NOT NULL
ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
