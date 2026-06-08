/** Campos alineados con el modelo Prisma `Opportunity` */
export class CreateOpportunityDto {
  title!: string;
  amount!: number;
  etapa!: string;
  /** baja | media | alta (default media en servidor si se omite) */
  priority?: string;
  /** Si no se envía, se calcula a partir de `etapa` */
  probability?: number;
  /** Ignorado en create: el estado se deriva solo de `etapa` (`ganada` únicamente si `etapa` es `activo`). */
  status?: string;
  /** Fecha ISO (YYYY-MM-DD o completa) */
  expectedCloseDate?: string;
  assignedTo?: string;
  /** Vincular a contacto existente (tabla `ContactOpportunity`) */
  contactId?: string;
  /** Vincular a empresa existente (tabla `CompanyOpportunity`) */
  companyId?: string;
  /** Slug de fuente (p. ej. import). La empresa toma la fuente de la oportunidad principal, no al revés. */
  fuente?: string;
}
