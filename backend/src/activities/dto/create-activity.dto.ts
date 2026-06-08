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
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
}
