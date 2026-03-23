/**
 * Creación de usuario por administrador (alineado con roleId del frontend RBAC).
 */
export class CreateUserDto {
  username!: string;
  name!: string;
  password!: string;
  /** r1–r4 desde INITIAL_ROLES */
  roleId!: string;
  /** Si es false, usuario inactivo (no puede iniciar sesión) */
  status?: boolean;
}
