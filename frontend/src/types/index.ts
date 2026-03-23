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
  /** ID de empresa cuando viene del API (para desvincular) */
  id?: string;
  /** Dominio web de la empresa (ej: empresa.com) */
  domain?: string;
  rubro?: CompanyRubro;
  tipo?: CompanyTipo;
  isPrimary?: boolean;
}

/** Empresa independiente (creada sola, sin contacto) */
export interface Company {
  id: string;
  name: string;
  domain?: string;
  rubro?: CompanyRubro;
  tipo?: CompanyTipo;
  createdAt: string;
}

export type ActivityType = 'llamada' | 'reunion' | 'tarea' | 'correo' | 'whatsapp';
export type ActivityStatus = 'pendiente' | 'completada' | 'en_progreso' | 'vencida';

/** Asociación de tarea con contacto, empresa u oportunidad */
export interface TaskAssociation {
  type: 'contacto' | 'empresa' | 'negocio';
  id: string;
  name: string;
}

export type CalendarEventType = 'llamada' | 'reunion' | 'tarea' | 'correo' | 'whatsapp';
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
export type UserRole = 'admin' | 'supervisor' | 'asesor' | 'solo_lectura';

/** RBAC: Módulos del CRM para permisos */
export type PermissionModule =
  | 'contactos'
  | 'empresas'
  | 'oportunidades'
  | 'pipeline'
  | 'actividades'
  | 'reportes'
  | 'usuarios'
  | 'configuracion';

/** RBAC: Tipos de permiso por módulo */
export type PermissionAction = 'ver' | 'crear' | 'editar' | 'eliminar' | 'asignar';

/** RBAC: Permiso = módulo + acción (ej: contactos.ver) */
export type PermissionKey = `${PermissionModule}.${PermissionAction}`;

/** RBAC: Rol del sistema */
export interface RBACRole {
  id: string;
  name: string;
  description: string;
  /** ID del template base (admin, supervisor, asesor, solo_lectura) o null si personalizado */
  templateId?: string;
  permissions: Record<PermissionKey, boolean>;
  userCount: number;
}

/** RBAC: Usuario con rol extendido */
export interface User {
  id: string;
  name: string;
  /** Identificador de inicio de sesión (mismo criterio que el backend). */
  username: string;
  /** Email de contacto opcional (datos históricos / UI). */
  email?: string;
  role: UserRole;
  /** ID del rol RBAC (para nuevo sistema) */
  roleId?: string;
  avatar?: string;
  phone?: string;
  status: 'activo' | 'inactivo';
  contactsAssigned: number;
  opportunitiesActive: number;
  salesClosed: number;
  conversionRate: number;
  joinedAt: string;
  /** Última actividad (mock) */
  lastActivity?: string;
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
  /** Indica si es un cliente recuperado (antes inactivo/cierre perdido) */
  clienteRecuperado?: 'si' | 'no';
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  contactId?: string;
  contactName?: string;
  companyId?: string;
  opportunityId?: string;
  opportunityTitle?: string;
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
  /** Prioridad comercial (mismos valores que en contactos/tareas) */
  priority?: ContactPriority;
  expectedCloseDate: string;
  assignedTo: string;
  assignedToName: string;
  createdAt: string;
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

export type NotificationType =
  | 'lead'
  | 'sistema'
  | 'exito'
  | 'alerta'
  | 'error'
  | 'info'
  | 'warning'
  | 'success';

export type NotificationPriority = 'alta' | 'media' | 'baja';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: NotificationType | 'info' | 'warning' | 'success' | 'error';
  /** Prioridad: alta=rojo, media=amarillo, baja=gris */
  priority?: NotificationPriority;
  /** Para acciones: ver contacto */
  contactId?: string;
  /** Para acciones: ver oportunidad */
  opportunityId?: string;
  /** Para acciones: reprogramar */
  activityId?: string;
  /** ISO string para agrupar por fecha */
  createdAt?: string;
  /** Marcar como importante */
  important?: boolean;
}

/** Audit: Módulo donde ocurrió la acción */
export type AuditModule =
  | 'contactos'
  | 'empresas'
  | 'oportunidades'
  | 'pipeline'
  | 'actividades'
  | 'usuarios'
  | 'roles'
  | 'configuracion'
  | 'sistema';

/** Audit: Tipo de acción realizada */
export type AuditActionType =
  | 'crear'
  | 'actualizar'
  | 'eliminar'
  | 'asignar'
  | 'cambiar_etapa'
  | 'login'
  | 'login_fallido'
  | 'cambiar_password'
  | 'desactivar_usuario';

/** Activity Log: registro de actividad general */
export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: AuditActionType;
  module: AuditModule;
  entityType: string;
  entityId?: string;
  entityName?: string;
  description: string;
  timestamp: string;
  status: 'exito' | 'fallido' | 'pendiente';
  isCritical?: boolean;
}

/** Audit Log: registro detallado de cambios (campo por campo) */
export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  entityType: string;
  entityId: string;
  entityName: string;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  timestamp: string;
  actionId?: string;
}

/** Audit Log: agrupación de cambios en una sola acción */
export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  entityType: string;
  entityId: string;
  entityName: string;
  action: AuditActionType;
  timestamp: string;
  entries: AuditLogEntry[];
}

/** Email: entidad de correo para inbox CRM */
export type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'trash';

export interface EmailAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
}

/** Tipo de entidad a la que puede estar vinculado un archivo */
export type FileEntityType = 'contact' | 'company' | 'opportunity' | 'activity' | 'email' | 'task';

/** Archivo adjunto en el CRM (vinculado a entidades) */
export interface FileAttachment {
  id: string;
  name: string;
  /** Tamaño en bytes */
  size: number;
  /** MIME type (ej: application/pdf, image/png) */
  mimeType: string;
  /** URL o blob para preview/descarga (mock: placeholder) */
  url?: string;
  /** Fecha de subida ISO */
  uploadedAt: string;
  /** ID del usuario que subió */
  uploadedBy: string;
  /** Nombre del usuario que subió */
  uploadedByName: string;
  /** Entidad principal a la que pertenece */
  entityType: FileEntityType;
  entityId: string;
  entityName?: string;
  /** Entidad relacionada opcional (ej: tarea, email) */
  relatedEntityType?: FileEntityType;
  relatedEntityId?: string;
  relatedEntityName?: string;
}

export interface EmailMessage {
  id: string;
  from: string;
  fromName: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  timestamp: string;
  isRead: boolean;
  isStarred: boolean;
  folder: EmailFolder;
  threadId: string;
  attachments?: EmailAttachment[];
}

/** Email thread: conversación agrupada */
export interface EmailThread {
  id: string;
  subject: string;
  messages: EmailMessage[];
  relatedEntityType?: RelatedEntityType;
  relatedEntityId?: string;
  relatedEntityName?: string;
}

/** Campaign: bulk messaging module */
export type CampaignChannel = 'email' | 'sms' | 'whatsapp';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
export type RecipientStatus = 'pendiente' | 'enviado' | 'entregado' | 'abierto' | 'clic' | 'fallido' | 'rebote';

export interface CampaignRecipient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  etapa?: Etapa;
  /** CRM contact ID if from CRM */
  contactId?: string;
  /** Validation warnings */
  hasInvalidEmail?: boolean;
  isDuplicate?: boolean;
}

export interface CampaignMessageTemplate {
  id: string;
  name: string;
  subject?: string;
  body: string;
  channel: CampaignChannel;
  createdAt: string;
}

export interface CampaignMessage {
  channel: CampaignChannel;
  subject?: string;
  body: string;
  /** Variables used: {{nombre}}, {{empresa}}, etc. */
  variables?: string[];
}

export interface CampaignRecipientResult {
  recipientId: string;
  contactId?: string;
  name: string;
  email: string;
  status: RecipientStatus;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  errorMessage?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  channel: CampaignChannel;
  message: CampaignMessage;
  recipients: CampaignRecipient[];
  results?: CampaignRecipientResult[];
  /** Metrics (computed from results) */
  sentCount?: number;
  deliveredCount?: number;
  openedCount?: number;
  clickedCount?: number;
  failedCount?: number;
  bounceCount?: number;
  createdAt: string;
  sentAt?: string;
  scheduledFor?: string;
  createdBy: string;
  createdByName: string;
  /** CRM links */
  relatedContactIds?: string[];
  relatedCompanyIds?: string[];
  relatedOpportunityIds?: string[];
}
