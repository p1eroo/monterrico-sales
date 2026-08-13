export class CreateWebLeadDto {
  /** Nombres y apellidos del contacto (opcional; si falta solo se crea empresa+oportunidad). */
  name?: string;
  /** Nombre comercial o RUC de la empresa (opcional; si falta solo se crea contacto). */
  company?: string;
  email?: string;
  phone?: string;
}
