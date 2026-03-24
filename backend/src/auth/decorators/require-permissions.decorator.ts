import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'crm_permissions';

/** Permisos al estilo frontend / tabla Authority: `contactos.ver`, `empresas.crear`, … */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
