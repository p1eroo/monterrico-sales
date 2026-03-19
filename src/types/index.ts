/** Etapa unificada para Contactos, Empresas y Oportunidades */
export type Etapa =
  | 'lead'                    // 0%
  | 'contacto'                // 10%
  | 'reunion_agendada'        // 30%
  | 'reunion_efectiva'        // 40%
  | 'propuesta_economica'     // 50%
  | 'negociacion'             // 70%
  | 'licitacion'              // 75%
  | 'licitacion_etapa_final'  // 85%
  | 'cierre_ganado'           // 90%
  | 'firma_contrato'          // 95%
  | 'activo'                  // 100%
  | 'cierre_perdido'          // -1%
  | 'inactivo';               // -5%

export type ContactPriority = 'alta' | 'media' | 'baja';
export type ContactSource = 'referido' | 'base' | 'entorno' | 'feria' | 'masivo';
export type CompanyRubro = 'mineria' | 'hoteleria' | 'banca' | 'construccion' | 'salud' | 'retail' | 'telecomunicaciones' | 'educacion' | 'energia' | 'consultoria' | 'diplomatico' | 'aviacion' | 'consumo_masivo' | 'otros';
export type CompanyTipo = 'A' | 'B' | 'C';

export interface LinkedCompany {
  name: string;
  /** Dominio web de la empresa (ej: empresa.com) */
  domain?: string;
  rubro?: CompanyRubro;
  tipo?: CompanyTipo;
  isPrimary?: boolean;
}

export type ActivityType = 'llamada' | 'reunion' | 'tarea' | 'correo' | 'seguimiento' | 'whatsapp';
export type ActivityStatus = 'pendiente' | 'completada' | 'en_progreso' | 'vencida';

export type CalendarEventType = 'llamada' | 'reunion' | 'tarea' | 'correo' | 'seguimiento' | 'whatsapp';
export type CalendarEventStatus = 'pendiente' | 'completada' | 'en_progreso' | 'vencida';
export type RelatedEntityType = 'contact' | 'company' | 'opportunity';

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  date: string;
  startTime: string;
  endTime: string;
  assignedTo: string;
  assignedToName: string;
  relatedEntityType?: RelatedEntityType;
  relatedEntityId?: string;
  relatedEntityName?: string;
  description?: string;
  status: CalendarEventStatus;
}

export type OpportunityStatus = 'abierta' | 'ganada' | 'perdida' | 'suspendida';

export type ClientStatus = 'activo' | 'inactivo' | 'potencial';
export type UserRole = 'admin' | 'gerente' | 'asesor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone: string;
  status: 'activo' | 'inactivo';
  contactsAssigned: number;
  opportunitiesActive: number;
  salesClosed: number;
  conversionRate: number;
  joinedAt: string;
}

export interface Contact {
  id: string;
  name: string;
  /** Cargo o puesto del contacto en la empresa */
  cargo?: string;
  /** Empresas vinculadas al contacto. Al menos una. La primera o con isPrimary es la principal. */
  companies: LinkedCompany[];
  phone: string;
  email: string;
  source: ContactSource;
  etapa: Etapa;
  priority: ContactPriority;
  assignedTo: string;
  assignedToName: string;
  estimatedValue: number;
  createdAt: string;
  nextAction: string;
  nextFollowUp: string;
  notes?: string;
  tags?: string[];
  docType?: 'dni' | 'cee';
  docNumber?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  /** IDs de otros contactos vinculados (ej. colegas de la misma empresa) */
  linkedContactIds?: string[];
  /** Historial de fechas en que el contacto estuvo en cada etapa */
  etapaHistory?: { etapa: Etapa; fecha: string }[];
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  contactId?: string;
  contactName?: string;
  opportunityId?: string;
  assignedTo: string;
  assignedToName: string;
  status: ActivityStatus;
  dueDate: string;
  /** Fecha de inicio (YYYY-MM-DD) */
  startDate?: string;
  /** Hora estimada (formato HH:mm) para mostrar en la columna Vence */
  startTime?: string;
  completedAt?: string;
  createdAt: string;
}

export interface Opportunity {
  id: string;
  title: string;
  contactId?: string;
  contactName?: string;
  clientId?: string;
  clientName?: string;
  amount: number;
  /** Probabilidad derivada de la etapa (0-100 o negativos para cierre/perdido/inactivo) */
  probability: number;
  etapa: Etapa;
  status: OpportunityStatus;
  expectedCloseDate: string;
  assignedTo: string;
  assignedToName: string;
  createdAt: string;
  description?: string;
}

export interface Client {
  id: string;
  company: string;
  companyRubro?: CompanyRubro;
  companyTipo?: CompanyTipo;
  contactName: string;
  phone: string;
  email: string;
  status: ClientStatus;
  assignedTo: string;
  assignedToName: string;
  service: string;
  createdAt: string;
  lastActivity?: string;
  totalRevenue: number;
  notes?: string;
}

export interface TimelineEvent {
  id: string;
  type: 'llamada' | 'correo' | 'reunion' | 'nota' | 'cambio_estado' | 'tarea' | 'archivo';
  title: string;
  description: string;
  user: string;
  date: string;
  metadata?: Record<string, string>;
}

export interface DashboardMetrics {
  totalContacts: number;
  newContacts: number;
  contactedContacts: number;
  activeOpportunities: number;
  closedSales: number;
  conversionRate: number;
  pendingActivities: number;
  overdueFollowUps: number;
  pipelineValue: number;
  monthlyRevenue: number;
}

export interface PipelineColumn {
  id: Etapa;
  title: string;
  contacts: Contact[];
  totalValue: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'info' | 'warning' | 'success' | 'error';
}
