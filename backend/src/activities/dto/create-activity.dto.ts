export class CreateActivityDto {
  type!: string;
  /** Obligatorio si type es `tarea`. */
  taskKind?: string;
  title!: string;
  description?: string;
  assignedTo!: string;
  status?: string;
  /** alta | media | baja */
  priority?: string;
  dueDate!: string;
  startDate?: string;
  startTime?: string;
  completedAt?: string;
  /** Vínculo único (legacy) */
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
  clienteEmpresaId?: string;
  /** Vínculos múltiples */
  contactIds?: string[];
  companyIds?: string[];
  opportunityIds?: string[];
  clienteEmpresaIds?: string[];
}
