/** Campos alineados con el modelo Prisma `Company` */
export class CreateCompanyDto {
  name!: string;
  razonSocial?: string;
  ruc?: string;
  telefono?: string;
  domain?: string;
  rubro?: string;
  tipo?: string;
  linkedin?: string;
  correo?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  direccion?: string;
  /** Facturación / ingreso estimado (obligatorio en alta) */
  facturacionEstimada!: number;
  /** Origen del lead a nivel cuenta */
  fuente!: string;
  /** Cliente recuperado a nivel cuenta (si | no) */
  clienteRecuperado?: string;
  etapa?: string;
  assignedTo?: string;
}
