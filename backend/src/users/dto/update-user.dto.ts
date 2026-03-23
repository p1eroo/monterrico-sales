/**
 * Actualización parcial de usuario (sin contraseña; usar /auth/change-password).
 */
export class UpdateUserDto {
  name?: string;
  /** r1–r4 (mismo criterio que en alta) */
  roleId?: string;
  /** true = activo, false = inactivo */
  status?: boolean;
}
