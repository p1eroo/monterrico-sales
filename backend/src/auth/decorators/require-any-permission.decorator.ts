import { SetMetadata } from '@nestjs/common';

/** Metadata: el usuario debe tener al menos uno de estos permisos */
export const PERMISSIONS_ANY_KEY = 'crm_permissions_any';

/** OR lógico entre permisos (p. ej. dashboard.ver o reportes.ver). */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);
