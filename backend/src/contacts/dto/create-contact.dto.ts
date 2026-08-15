import { CreateCompanyDto } from '../../companies/dto/create-company.dto';

/** Campos alineados con el modelo Prisma `Contact` (+ companyId para vínculo inicial) */
export class CreateContactDto {
  name!: string;
  /** Si se omite o va vacío en import, el servicio usa "-" por defecto. */
  telefono?: string;
  /** Si se omite o va vacío, el servicio guarda cadena vacía. */
  correo?: string;
  /** Si se omite o va vacío, el servicio usa "base" por defecto. */
  fuente?: string;
  cargo?: string;
  etapa?: string;
  assignedTo?: string;
  /** Opcional en alta. 0 u omitido: hereda del grafo (empresa / oportunidad principal). */
  estimatedValue?: number;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  clienteRecuperado?: string;
  /** Historial inicial (JSON); si se omite en create, el servicio puede inicializar */
  etapaHistory?: unknown;
  /** Vincular a empresa existente como principal */
  companyId?: string;
  /**
   * Crear empresa en la misma transacción que el contacto.
   * No usar junto con `companyId`; si falla el contacto, la empresa no se persiste.
   */
  newCompany?: CreateCompanyDto;
}
