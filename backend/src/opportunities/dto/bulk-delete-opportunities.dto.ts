/** Borrado masivo de oportunidades: por ids o por filtros del listado (selectAll). */
export class BulkDeleteOpportunitiesDto {
  ids?: string[];
  selectAll?: boolean;
  search?: string;
  etapa?: string;
  status?: string;
  fuente?: string;
  assignedTo?: string;
  excludeAssignedTo?: string;
  advisorPool?: string;
  linkedToCompany?: string;
  excludeCompanyLink?: string;
  excludeContactLink?: string;
}
