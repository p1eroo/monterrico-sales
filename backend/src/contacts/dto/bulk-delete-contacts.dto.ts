/** Borrado masivo de contactos: por ids o por filtros del listado (selectAll). */
export class BulkDeleteContactsDto {
  ids?: string[];
  selectAll?: boolean;
  search?: string;
  etapa?: string;
  fuente?: string;
  assignedTo?: string;
  excludeAssignedTo?: string;
  advisorPool?: string;
  linkedToCompany?: string;
  excludeCompanyLink?: string;
  excludeOpportunityLink?: string;
  lastInteraction?: string;
  lastInteractionFrom?: string;
  lastInteractionTo?: string;
  createdFrom?: string;
  createdTo?: string;
}
