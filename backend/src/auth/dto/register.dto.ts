export class RegisterDto {
  username!: string;
  password!: string;
  name!: string;
  /** Ej: admin, supervisor, asesor, solo_lectura (legacy: gerente → supervisor en UI) */
  role?: string;
}
