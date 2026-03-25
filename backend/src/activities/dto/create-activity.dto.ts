export class CreateActivityDto {
  type!: string;
  /** Obligatorio si type es `tarea`. También se acepta type = llamada|reunion|correo|whatsapp (legacy → se normaliza a tarea + taskKind). */
  taskKind?: string;
  title!: string;
  description?: string;
  assignedTo!: string;
  dueDate!: string;
  startDate?: string;
  startTime?: string;
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
}
