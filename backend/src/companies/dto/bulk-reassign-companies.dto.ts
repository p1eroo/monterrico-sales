/** Reasignación masiva de empresas: por ids o por filtros del listado (selectAll). */
export class BulkReassignCompaniesDto {
  newAssignedTo!: string;
  ids?: string[];
  selectAll?: boolean;
  search?: string;
  rubro?: string;
  tipo?: string;
  etapa?: string;
  fuente?: string;
  assignedTo?: string;
  excludeAssignedTo?: string;
  advisorPool?: string;
  lastInteraction?: string;
  lastInteractionFrom?: string;
  lastInteractionTo?: string;
  createdFrom?: string;
  createdTo?: string;
}
