export class RegisterDto {
  username!: string;
  password!: string;
  name!: string;
  /** Ej: admin, gerente, asesor */
  role?: string;
}
