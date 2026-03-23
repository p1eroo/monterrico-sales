/** Campos alineados con el modelo Prisma `Contact` (+ companyId para vínculo inicial) */
export class CreateContactDto {
  name!: string;
  phone!: string;
  email!: string;
  source!: string;
  cargo?: string;
  etapa?: string;
  assignedTo?: string;
  estimatedValue?: number;
  nextAction?: string;
  nextFollowUp?: string;
  notes?: string;
  tags?: string[];
  docType?: string;
  docNumber?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  clienteRecuperado?: string;
  /** Historial inicial (JSON); si se omite en create, el servicio puede inicializar */
  etapaHistory?: unknown;
  /** Vincular a empresa existente como principal */
  companyId?: string;
}
