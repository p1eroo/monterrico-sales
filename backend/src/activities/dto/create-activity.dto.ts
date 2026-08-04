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
  contactoClienteId?: string;
  /** Vínculos múltiples */
  contactIds?: string[];
  companyIds?: string[];
  opportunityIds?: string[];
  clienteEmpresaIds?: string[];
  contactoClienteIds?: string[];
  /** Al completar una tarea: valida vínculos heredados sin re-aplicar cartera (agenteSync). */
  sourceTaskId?: string;
  /** Tarea vinculada tras registrar actividad: hereda vínculos de la actividad asignada al asesor. */
  sourceActivityId?: string;
}
