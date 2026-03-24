import type {
  User, Contact, Activity, Opportunity, Client,
  TimelineEvent, DashboardMetrics, NotificationItem,
  ChartDataPoint, Etapa, LinkedCompany, CompanyRubro, CompanyTipo,
  CalendarEvent, FileAttachment,
} from '@/types';

function leadCompanies(name: string, rubro?: CompanyRubro, tipo?: CompanyTipo, domain?: string): LinkedCompany[] {
  return [{ name, rubro, tipo, domain, isPrimary: true }];
}

const PIPELINE_ORDER: Etapa[] = ['lead', 'contacto', 'reunion_agendada', 'reunion_efectiva', 'propuesta_economica', 'negociacion', 'licitacion', 'licitacion_etapa_final', 'cierre_ganado', 'firma_contrato', 'activo'];
const PIPELINE_ORDER_WITH_LOST: Etapa[] = [...PIPELINE_ORDER, 'cierre_perdido', 'inactivo'];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildEtapaHistory(createdAt: string, currentEtapa: Etapa): { etapa: Etapa; fecha: string }[] {
  const order = ['cierre_perdido', 'inactivo'].includes(currentEtapa) ? PIPELINE_ORDER_WITH_LOST : PIPELINE_ORDER;
  const idx = order.indexOf(currentEtapa);
  if (idx < 0) return [{ etapa: currentEtapa, fecha: createdAt }];
  const history: { etapa: Etapa; fecha: string }[] = [];
  let d = createdAt;
  for (let i = 0; i <= idx; i++) {
    history.push({ etapa: order[i], fecha: d });
    d = addDays(d, 2 + (i % 2));
  }
  return history;
}

export const users: User[] = [
  { id: 'u1', name: 'Carlos Mendoza', username: 'cmendoza', email: 'carlos.mendoza@taximonterrico.com', role: 'admin', roleId: 'r1', phone: '+51 999 111 222', status: 'activo', contactsAssigned: 45, opportunitiesActive: 12, salesClosed: 28, conversionRate: 62, joinedAt: '2023-01-15', lastActivity: '2026-03-06T14:30:00' },
  { id: 'u2', name: 'María García', username: 'mgarcia', email: 'maria.garcia@taximonterrico.com', role: 'supervisor', roleId: 'r2', phone: '+51 999 333 444', status: 'activo', contactsAssigned: 38, opportunitiesActive: 9, salesClosed: 22, conversionRate: 58, joinedAt: '2023-03-20', lastActivity: '2026-03-06T11:15:00' },
  { id: 'u3', name: 'José Ramírez', username: 'jramirez', email: 'jose.ramirez@taximonterrico.com', role: 'asesor', roleId: 'r3', phone: '+51 999 555 666', status: 'activo', contactsAssigned: 32, opportunitiesActive: 7, salesClosed: 18, conversionRate: 56, joinedAt: '2023-06-10', lastActivity: '2026-03-06T09:45:00' },
  { id: 'u4', name: 'Ana Torres', username: 'atorres', email: 'ana.torres@taximonterrico.com', role: 'asesor', roleId: 'r3', phone: '+51 999 777 888', status: 'activo', contactsAssigned: 28, opportunitiesActive: 8, salesClosed: 15, conversionRate: 54, joinedAt: '2023-08-01', lastActivity: '2026-03-05T16:20:00' },
  { id: 'u5', name: 'Roberto Silva', username: 'rsilva', email: 'roberto.silva@taximonterrico.com', role: 'asesor', roleId: 'r3', phone: '+51 999 999 000', status: 'activo', contactsAssigned: 25, opportunitiesActive: 5, salesClosed: 12, conversionRate: 48, joinedAt: '2024-01-15', lastActivity: '2026-03-06T08:00:00' },
  { id: 'u6', name: 'Lucía Fernández', username: 'lfernandez', email: 'lucia.fernandez@taximonterrico.com', role: 'asesor', roleId: 'r3', phone: '+51 998 111 222', status: 'inactivo', contactsAssigned: 15, opportunitiesActive: 2, salesClosed: 8, conversionRate: 53, joinedAt: '2024-03-01', lastActivity: '2026-02-15T10:00:00' },
];

const rawContacts: Omit<Contact, 'etapaHistory'>[] = [
  { id: 'l1', name: 'Pedro Castillo', cargo: 'Gerente de Operaciones', companies: leadCompanies('Minera Los Andes SAC', 'mineria', 'A', 'mineraandes.com'), telefono: '+51 912 345 678', correo: 'pcastillo@mineraandes.com', fuente: 'base', etapa: 'lead', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', estimatedValue: 45000, createdAt: '2026-03-01', nextAction: 'Llamar para presentar servicios', nextFollowUp: '2026-03-07', tags: ['minería', 'corporativo'], linkedContactIds: ['l3'], clienteRecuperado: 'no' },
  { id: 'l2', name: 'Sofía Vargas', cargo: 'Directora de Compras', companies: leadCompanies('Hotel Belmond Miraflores', 'hoteleria', 'A', 'belmondhotels.pe'), telefono: '+51 923 456 789', correo: 'svargas@belmondhotels.pe', fuente: 'referido', etapa: 'contacto', assignedTo: 'u2', assignedToName: 'María García', estimatedValue: 38000, createdAt: '2026-02-28', nextAction: 'Enviar propuesta de servicio ejecutivo', nextFollowUp: '2026-03-06', tags: ['hotelería', 'turismo'], clienteRecuperado: 'si' },
  { id: 'l3', name: 'Miguel Ángel Ruiz', cargo: 'Jefe de Proyectos', companies: leadCompanies('Constructora Graña y Montero', 'construccion', 'A', 'gym.com.pe'), telefono: '+51 934 567 890', correo: 'maruiz@gym.com.pe', fuente: 'feria', etapa: 'reunion_agendada', assignedTo: 'u3', assignedToName: 'José Ramírez', estimatedValue: 62000, createdAt: '2026-02-25', nextAction: 'Reunión presencial en oficina', nextFollowUp: '2026-03-08', tags: ['construcción'] },
  { id: 'l4', name: 'Laura Mendez', cargo: 'Coordinadora de Servicios', companies: leadCompanies('Clínica Internacional', 'salud', 'A', 'clinicainternacional.pe'), telefono: '+51 945 678 901', correo: 'lmendez@clinicainternacional.pe', fuente: 'masivo', etapa: 'reunion_efectiva', assignedTo: 'u4', assignedToName: 'Ana Torres', estimatedValue: 55000, createdAt: '2026-02-20', nextAction: 'Demostración de flota ejecutiva', nextFollowUp: '2026-03-05', tags: ['salud', 'corporativo'] },
  { id: 'l5', name: 'Fernando Ochoa', cargo: 'Director de Compras', companies: leadCompanies('BCP - Banco de Crédito', 'banca', 'A', 'bcp.com.pe'), telefono: '+51 956 789 012', correo: 'fochoa@bcp.com.pe', fuente: 'entorno', etapa: 'propuesta_economica', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', estimatedValue: 120000, createdAt: '2026-02-15', nextAction: 'Negociar términos del contrato', nextFollowUp: '2026-03-04', tags: ['banca', 'corporativo'], clienteRecuperado: 'si' },
  { id: 'l6', name: 'Patricia Huamán', cargo: 'Gerente Administrativa', companies: leadCompanies('Universidad PUCP', 'educacion', 'B', 'pucp.edu.pe'), telefono: '+51 967 890 123', correo: 'phuaman@pucp.edu.pe', fuente: 'base', etapa: 'negociacion', assignedTo: 'u2', assignedToName: 'María García', estimatedValue: 35000, createdAt: '2026-02-10', nextAction: 'Ajustar propuesta de precios', nextFollowUp: '2026-03-06', tags: ['educación'] },
  { id: 'l7', name: 'Ricardo Flores', cargo: 'Consejero', companies: leadCompanies('Embajada de España', 'diplomatico', 'A', 'embespana.pe'), telefono: '+51 978 901 234', correo: 'rflores@embespana.pe', fuente: 'referido', etapa: 'activo', assignedTo: 'u3', assignedToName: 'José Ramírez', estimatedValue: 85000, createdAt: '2026-01-20', nextAction: 'Iniciar servicio', nextFollowUp: '2026-03-01', tags: ['diplomático', 'premium'], clienteRecuperado: 'si' },
  { id: 'l8', name: 'Carmen Aguilar', cargo: 'Supervisora de Compras', companies: leadCompanies('Cencosud Perú', 'retail', 'B', 'cencosud.com.pe'), telefono: '+51 989 012 345', correo: 'caguilar@cencosud.com.pe', fuente: 'masivo', etapa: 'cierre_perdido', assignedTo: 'u4', assignedToName: 'Ana Torres', estimatedValue: 28000, createdAt: '2026-01-15', nextAction: 'Archivar', nextFollowUp: '', tags: ['retail'] },
  { id: 'l9', name: 'Diego Sánchez', cargo: 'Gerente de Flota', companies: leadCompanies('Telefónica del Perú', 'telecomunicaciones', 'A', 'telefonica.pe'), telefono: '+51 990 123 456', correo: 'dsanchez@telefonica.pe', fuente: 'entorno', etapa: 'lead', assignedTo: 'u5', assignedToName: 'Roberto Silva', estimatedValue: 72000, createdAt: '2026-03-03', nextAction: 'Contactar por WhatsApp', nextFollowUp: '2026-03-07', tags: ['telecomunicaciones'] },
  { id: 'l10', name: 'Valentina Rojas', cargo: 'Gerente de Servicios', companies: leadCompanies('Interbank', 'banca', 'A', 'interbank.pe'), telefono: '+51 911 234 567', correo: 'vrojas@interbank.pe', fuente: 'feria', etapa: 'contacto', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', estimatedValue: 95000, createdAt: '2026-03-02', nextAction: 'Enviar brochure ejecutivo', nextFollowUp: '2026-03-06', tags: ['banca', 'corporativo'], clienteRecuperado: 'si' },
  { id: 'l11', name: 'Andrés Paredes', cargo: 'Director de Compras', companies: leadCompanies('Southern Copper Corp', 'mineria', 'A', 'southerncopper.com'), telefono: '+51 922 345 678', correo: 'aparedes@southerncopper.com', fuente: 'referido', etapa: 'reunion_agendada', assignedTo: 'u2', assignedToName: 'María García', estimatedValue: 150000, createdAt: '2026-02-22', nextAction: 'Preparar propuesta ejecutiva', nextFollowUp: '2026-03-07', tags: ['minería', 'premium'] },
  { id: 'l12', name: 'Gabriela Luna', cargo: 'Coordinadora de Viajes', companies: leadCompanies('LATAM Airlines Perú', 'aviacion', 'B', 'latam.com'), telefono: '+51 933 456 789', correo: 'gluna@latam.com', fuente: 'base', etapa: 'reunion_efectiva', assignedTo: 'u3', assignedToName: 'José Ramírez', estimatedValue: 48000, createdAt: '2026-02-18', nextAction: 'Coordinar prueba piloto', nextFollowUp: '2026-03-08', tags: ['aviación', 'transporte'] },
  { id: 'l13', name: 'Martín Delgado', cargo: 'Gerente de Compras', companies: leadCompanies('Alicorp SAA', 'consumo_masivo', 'A', 'alicorp.com.pe'), telefono: '+51 944 567 890', correo: 'mdelgado@alicorp.com.pe', fuente: 'entorno', etapa: 'propuesta_economica', assignedTo: 'u4', assignedToName: 'Ana Torres', estimatedValue: 42000, createdAt: '2026-02-12', nextAction: 'Presentar a directorio', nextFollowUp: '2026-03-05', tags: ['consumo masivo'] },
  { id: 'l14', name: 'Isabella Campos', cargo: 'Directora de Compras', companies: leadCompanies('Repsol Perú', 'energia', 'A', 'repsol.pe'), telefono: '+51 955 678 901', correo: 'icampos@repsol.pe', fuente: 'masivo', etapa: 'negociacion', assignedTo: 'u5', assignedToName: 'Roberto Silva', estimatedValue: 110000, createdAt: '2026-02-05', nextAction: 'Definir SLA y tarifas', nextFollowUp: '2026-03-06', tags: ['energía', 'corporativo'] },
  { id: 'l15', name: 'Enrique Vásquez', cargo: 'Socio Partner', companies: leadCompanies('EY Perú (Ernst & Young)', 'consultoria', 'A', 'ey.com'), telefono: '+51 966 789 012', correo: 'evasquez@ey.com', fuente: 'referido', etapa: 'lead', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', estimatedValue: 68000, createdAt: '2026-03-05', nextAction: 'Agendar llamada introductoria', nextFollowUp: '2026-03-08', tags: ['consultoría', 'Big Four'] },
  { id: 'l16', name: 'Roberto Díaz', cargo: 'Gerente Comercial', companies: leadCompanies('Scotiabank Perú', 'banca', 'A', 'scotiabank.pe'), telefono: '+51 977 111 222', correo: 'rdiaz@scotiabank.pe', fuente: 'base', etapa: 'inactivo', assignedTo: 'u5', assignedToName: 'Roberto Silva', estimatedValue: 45000, createdAt: '2025-03-01', nextAction: 'Evaluar renovación', nextFollowUp: '', tags: ['banca'], clienteRecuperado: 'si' },
];

export const contacts: Contact[] = rawContacts.map((c) => ({
  ...c,
  etapaHistory: buildEtapaHistory(c.createdAt, c.etapa),
}));

export const activities: Activity[] = [
  { id: 'a1', type: 'llamada', title: 'Llamada de presentación', description: 'Presentar servicios corporativos de Taxi Monterrico', contactId: 'l1', contactName: 'Pedro Castillo - Minera Los Andes', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', status: 'pendiente', dueDate: '2026-03-07', startDate: '2026-03-06', startTime: '10:00', createdAt: '2026-03-05' },
  { id: 'a2', type: 'correo', title: 'Enviar propuesta comercial', description: 'Propuesta de servicio ejecutivo para hotel', contactId: 'l2', contactName: 'Sofía Vargas - Hotel Belmond', assignedTo: 'u2', assignedToName: 'María García', status: 'completada', dueDate: '2026-03-06', startDate: '2026-03-04', completedAt: '2026-03-06', createdAt: '2026-03-04' },
  { id: 'a3', type: 'reunion', title: 'Reunión presencial', description: 'Visita a oficinas de Graña y Montero para demo', contactId: 'l3', contactName: 'Miguel Ángel Ruiz - GyM', assignedTo: 'u3', assignedToName: 'José Ramírez', status: 'pendiente', dueDate: '2026-03-08', startDate: '2026-03-08', startTime: '14:30', createdAt: '2026-03-05' },
  { id: 'a4', type: 'llamada', title: 'Seguimiento de propuesta', description: 'Revisar respuesta a propuesta enviada', contactId: 'l5', contactName: 'Fernando Ochoa - BCP', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', status: 'vencida', dueDate: '2026-03-04', createdAt: '2026-03-01' },
  { id: 'a5', type: 'whatsapp', title: 'Mensaje WhatsApp', description: 'Enviar información de flota y servicios', contactId: 'l9', contactName: 'Diego Sánchez - Telefónica', assignedTo: 'u5', assignedToName: 'Roberto Silva', status: 'pendiente', dueDate: '2026-03-07', createdAt: '2026-03-06' },
  { id: 'a6', type: 'tarea', title: 'Preparar brochure ejecutivo', description: 'Diseñar brochure personalizado para Interbank', contactId: 'l10', contactName: 'Valentina Rojas - Interbank', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', status: 'pendiente', dueDate: '2026-03-06', startDate: '2026-03-05', createdAt: '2026-03-05' },
  { id: 'a7', type: 'llamada', title: 'Llamada de negociación', description: 'Discutir términos de contrato con Repsol', contactId: 'l14', contactName: 'Isabella Campos - Repsol', assignedTo: 'u5', assignedToName: 'Roberto Silva', status: 'en_progreso', dueDate: '2026-03-09', startDate: '2026-03-09', startTime: '09:00', createdAt: '2026-03-03' },
  { id: 'a8', type: 'reunion', title: 'Demo de flota ejecutiva', description: 'Mostrar vehículos y app a Clínica Internacional', contactId: 'l4', contactName: 'Laura Mendez - Clínica Internacional', assignedTo: 'u4', assignedToName: 'Ana Torres', status: 'completada', dueDate: '2026-03-05', completedAt: '2026-03-05', createdAt: '2026-03-02' },
  { id: 'a9', type: 'correo', title: 'Enviar contrato', description: 'Enviar borrador de contrato a la universidad', contactId: 'l6', contactName: 'Patricia Huamán - PUCP', assignedTo: 'u2', assignedToName: 'María García', status: 'pendiente', dueDate: '2026-03-06', startDate: '2026-03-06', createdAt: '2026-03-05' },
  { id: 'a10', type: 'llamada', title: 'Follow-up Southern Copper', description: 'Verificar interés y agendar reunión', contactId: 'l11', contactName: 'Andrés Paredes - Southern Copper', assignedTo: 'u2', assignedToName: 'María García', status: 'vencida', dueDate: '2026-03-03', createdAt: '2026-02-28' },
  { id: 'a11', type: 'tarea', title: 'Actualizar CRM', description: 'Registrar notas de la reunión con EY', contactId: 'l15', contactName: 'Enrique Vásquez - EY', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', status: 'pendiente', dueDate: '2026-03-08', createdAt: '2026-03-06' },
  { id: 'a12', type: 'whatsapp', title: 'Confirmar reunión', description: 'Confirmar asistencia a reunión de mañana', contactId: 'l3', contactName: 'Miguel Ángel Ruiz - GyM', assignedTo: 'u3', assignedToName: 'José Ramírez', status: 'completada', dueDate: '2026-03-07', completedAt: '2026-03-07', createdAt: '2026-03-06' },
];

export const opportunities: Opportunity[] = [
  { id: 'o1', title: 'Servicio Corporativo Minera Los Andes', contactId: 'l1', contactName: 'Pedro Castillo', amount: 45000, probability: 30, etapa: 'reunion_agendada', status: 'abierta', priority: 'media', expectedCloseDate: '2026-04-15', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', createdAt: '2026-03-01' },
  { id: 'o2', title: 'Transporte Ejecutivo Hotel Belmond', contactId: 'l2', contactName: 'Sofía Vargas', amount: 38000, probability: 40, etapa: 'reunion_efectiva', status: 'abierta', priority: 'baja', expectedCloseDate: '2026-04-01', assignedTo: 'u2', assignedToName: 'María García', createdAt: '2026-02-28' },
  { id: 'o3', title: 'Flota Exclusiva BCP', contactId: 'l5', contactName: 'Fernando Ochoa', amount: 120000, probability: 70, etapa: 'negociacion', status: 'abierta', priority: 'alta', expectedCloseDate: '2026-03-30', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', createdAt: '2026-02-15' },
  { id: 'o4', title: 'Contrato Embajada España', contactId: 'l7', contactName: 'Ricardo Flores', amount: 85000, probability: 100, etapa: 'activo', status: 'ganada', priority: 'alta', expectedCloseDate: '2026-03-01', assignedTo: 'u3', assignedToName: 'José Ramírez', createdAt: '2026-01-20' },
  { id: 'o5', title: 'Transporte Clínica Internacional', contactId: 'l4', contactName: 'Laura Mendez', amount: 55000, probability: 50, etapa: 'propuesta_economica', status: 'abierta', priority: 'media', expectedCloseDate: '2026-04-10', assignedTo: 'u4', assignedToName: 'Ana Torres', createdAt: '2026-02-20' },
  { id: 'o6', title: 'Plan Universitario PUCP', contactId: 'l6', contactName: 'Patricia Huamán', amount: 35000, probability: 70, etapa: 'negociacion', status: 'abierta', priority: 'baja', expectedCloseDate: '2026-03-25', assignedTo: 'u2', assignedToName: 'María García', createdAt: '2026-02-10' },
  { id: 'o7', title: 'Southern Copper Premium', contactId: 'l11', contactName: 'Andrés Paredes', amount: 150000, probability: 30, etapa: 'reunion_agendada', status: 'abierta', priority: 'alta', expectedCloseDate: '2026-05-01', assignedTo: 'u2', assignedToName: 'María García', createdAt: '2026-02-22' },
  { id: 'o8', title: 'Repsol Corporate Fleet', contactId: 'l14', contactName: 'Isabella Campos', amount: 110000, probability: 70, etapa: 'negociacion', status: 'abierta', priority: 'media', expectedCloseDate: '2026-04-20', assignedTo: 'u5', assignedToName: 'Roberto Silva', createdAt: '2026-02-05' },
  { id: 'o9', title: 'Alicorp Ejecutivo', contactId: 'l13', contactName: 'Martín Delgado', amount: 42000, probability: 50, etapa: 'propuesta_economica', status: 'abierta', priority: 'baja', expectedCloseDate: '2026-04-05', assignedTo: 'u4', assignedToName: 'Ana Torres', createdAt: '2026-02-12' },
  { id: 'o10', title: 'Interbank VIP', contactId: 'l10', contactName: 'Valentina Rojas', amount: 95000, probability: 10, etapa: 'contacto', status: 'abierta', priority: 'media', expectedCloseDate: '2026-05-15', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', createdAt: '2026-03-02' },
];

export const clients: Client[] = [
  { id: 'c1', company: 'Embajada de España', companyRubro: 'diplomatico', companyTipo: 'A', contactName: 'Ricardo Flores', phone: '+51 978 901 234', email: 'rflores@embespana.pe', status: 'activo', assignedTo: 'u3', assignedToName: 'José Ramírez', service: 'Servicio Diplomático Premium', createdAt: '2026-03-01', lastActivity: '2026-03-05', totalRevenue: 85000, notes: 'Cliente VIP - prioridad máxima' },
  { id: 'c2', company: 'Marriott Hotel Lima', companyRubro: 'hoteleria', companyTipo: 'A', contactName: 'Andrea López', phone: '+51 912 222 333', email: 'alopez@marriott.com', status: 'activo', assignedTo: 'u2', assignedToName: 'María García', service: 'Transfer Aeropuerto VIP', createdAt: '2025-11-15', lastActivity: '2026-03-03', totalRevenue: 120000, notes: 'Contrato renovado anualmente' },
  { id: 'c3', company: 'BBVA Perú', companyRubro: 'banca', companyTipo: 'A', contactName: 'Rodrigo Paz', phone: '+51 923 333 444', email: 'rpaz@bbva.pe', status: 'activo', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', service: 'Flota Ejecutiva Corporativa', createdAt: '2025-08-20', lastActivity: '2026-03-04', totalRevenue: 250000, notes: 'Contrato marco por 2 años' },
  { id: 'c4', company: 'Pontificia Universidad Católica', companyRubro: 'educacion', companyTipo: 'B', contactName: 'Carmen Salas', phone: '+51 934 444 555', email: 'csalas@pucp.edu.pe', status: 'activo', assignedTo: 'u4', assignedToName: 'Ana Torres', service: 'Transporte Institucional', createdAt: '2025-06-10', lastActivity: '2026-02-28', totalRevenue: 75000 },
  { id: 'c5', company: 'Scotiabank Perú', companyRubro: 'banca', companyTipo: 'A', contactName: 'Luis Miguel Torres', phone: '+51 945 555 666', email: 'lmtorres@scotiabank.pe', status: 'inactivo', assignedTo: 'u5', assignedToName: 'Roberto Silva', service: 'Servicio Ejecutivo', createdAt: '2025-03-01', lastActivity: '2025-12-15', totalRevenue: 45000, notes: 'Contrato finalizado - posible renovación' },
  { id: 'c6', company: 'Deloitte Perú', companyRubro: 'consultoria', companyTipo: 'A', contactName: 'Mónica Reyes', phone: '+51 956 666 777', email: 'mreyes@deloitte.com', status: 'activo', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', service: 'Plan Corporate Plus', createdAt: '2025-09-01', lastActivity: '2026-03-06', totalRevenue: 180000 },
  { id: 'c7', company: 'Claro Perú', companyRubro: 'telecomunicaciones', companyTipo: 'A', contactName: 'Jorge Medina', phone: '+51 967 777 888', email: 'jmedina@claro.pe', status: 'activo', assignedTo: 'u3', assignedToName: 'José Ramírez', service: 'Transporte de Personal', createdAt: '2025-10-15', lastActivity: '2026-03-02', totalRevenue: 95000 },
  { id: 'c8', company: 'PWC Perú', companyRubro: 'consultoria', companyTipo: 'A', contactName: 'Daniela Quispe', phone: '+51 978 888 999', email: 'dquispe@pwc.com', status: 'activo', assignedTo: 'u2', assignedToName: 'María García', service: 'Servicio Premium Ejecutivo', createdAt: '2025-07-20', lastActivity: '2026-03-05', totalRevenue: 160000 },
];

export const calendarEvents: CalendarEvent[] = [
  { id: 'ce1', title: 'Llamada de presentación', type: 'llamada', date: '2026-03-07', startTime: '10:00', endTime: '10:30', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', relatedEntityType: 'contact', relatedEntityId: 'l1', relatedEntityName: 'Pedro Castillo - Minera Los Andes', description: 'Presentar servicios corporativos', status: 'pendiente' },
  { id: 'ce2', title: 'Enviar propuesta comercial', type: 'correo', date: '2026-03-06', startTime: '09:00', endTime: '09:30', assignedTo: 'u2', assignedToName: 'María García', relatedEntityType: 'contact', relatedEntityId: 'l2', relatedEntityName: 'Sofía Vargas - Hotel Belmond', description: 'Propuesta de servicio ejecutivo', status: 'completada' },
  { id: 'ce3', title: 'Reunión presencial GyM', type: 'reunion', date: '2026-03-08', startTime: '14:30', endTime: '16:00', assignedTo: 'u3', assignedToName: 'José Ramírez', relatedEntityType: 'contact', relatedEntityId: 'l3', relatedEntityName: 'Miguel Ángel Ruiz - GyM', description: 'Visita a oficinas para demo', status: 'pendiente' },
  { id: 'ce4', title: 'Seguimiento propuesta BCP', type: 'llamada', date: '2026-03-04', startTime: '11:00', endTime: '11:30', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', relatedEntityType: 'opportunity', relatedEntityId: 'o3', relatedEntityName: 'Flota Exclusiva BCP', description: 'Revisar respuesta a propuesta', status: 'vencida' },
  { id: 'ce5', title: 'Mensaje WhatsApp Telefónica', type: 'whatsapp', date: '2026-03-07', startTime: '15:00', endTime: '15:15', assignedTo: 'u5', assignedToName: 'Roberto Silva', relatedEntityType: 'contact', relatedEntityId: 'l9', relatedEntityName: 'Diego Sánchez - Telefónica', description: 'Enviar información de flota', status: 'pendiente' },
  { id: 'ce6', title: 'Preparar brochure Interbank', type: 'tarea', date: '2026-03-06', startTime: '08:00', endTime: '10:00', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', relatedEntityType: 'opportunity', relatedEntityId: 'o10', relatedEntityName: 'Interbank VIP', description: 'Diseñar brochure personalizado', status: 'pendiente' },
  { id: 'ce7', title: 'Llamada negociación Repsol', type: 'llamada', date: '2026-03-09', startTime: '09:00', endTime: '09:45', assignedTo: 'u5', assignedToName: 'Roberto Silva', relatedEntityType: 'opportunity', relatedEntityId: 'o8', relatedEntityName: 'Repsol Corporate Fleet', description: 'Discutir términos de contrato', status: 'en_progreso' },
  { id: 'ce8', title: 'Demo flota Clínica Internacional', type: 'reunion', date: '2026-03-05', startTime: '10:00', endTime: '11:30', assignedTo: 'u4', assignedToName: 'Ana Torres', relatedEntityType: 'contact', relatedEntityId: 'l4', relatedEntityName: 'Laura Mendez - Clínica Internacional', description: 'Mostrar vehículos y app', status: 'completada' },
  { id: 'ce9', title: 'Enviar contrato PUCP', type: 'correo', date: '2026-03-06', startTime: '14:00', endTime: '14:30', assignedTo: 'u2', assignedToName: 'María García', relatedEntityType: 'opportunity', relatedEntityId: 'o6', relatedEntityName: 'Plan Universitario PUCP', description: 'Enviar borrador de contrato', status: 'pendiente' },
  { id: 'ce10', title: 'Follow-up Southern Copper', type: 'llamada', date: '2026-03-03', startTime: '16:00', endTime: '16:30', assignedTo: 'u2', assignedToName: 'María García', relatedEntityType: 'opportunity', relatedEntityId: 'o7', relatedEntityName: 'Southern Copper Premium', description: 'Verificar interés y agendar reunión', status: 'vencida' },
  { id: 'ce11', title: 'Actualizar CRM post-reunión', type: 'tarea', date: '2026-03-08', startTime: '17:00', endTime: '17:30', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', relatedEntityType: 'contact', relatedEntityId: 'l15', relatedEntityName: 'Enrique Vásquez - EY', description: 'Registrar notas de la reunión', status: 'pendiente' },
  { id: 'ce12', title: 'Confirmar reunión GyM', type: 'whatsapp', date: '2026-03-07', startTime: '08:30', endTime: '08:45', assignedTo: 'u3', assignedToName: 'José Ramírez', relatedEntityType: 'contact', relatedEntityId: 'l3', relatedEntityName: 'Miguel Ángel Ruiz - GyM', description: 'Confirmar asistencia', status: 'completada' },
  { id: 'ce13', title: 'Reunión con Embajada España', type: 'reunion', date: '2026-03-10', startTime: '11:00', endTime: '12:00', assignedTo: 'u3', assignedToName: 'José Ramírez', relatedEntityType: 'opportunity', relatedEntityId: 'o4', relatedEntityName: 'Contrato Embajada España', description: 'Revisión de servicio activo', status: 'pendiente' },
  { id: 'ce14', title: 'Llamada presentación Minera', type: 'llamada', date: '2026-03-11', startTime: '10:00', endTime: '10:45', assignedTo: 'u1', assignedToName: 'Carlos Mendoza', relatedEntityType: 'opportunity', relatedEntityId: 'o1', relatedEntityName: 'Servicio Corporativo Minera Los Andes', description: 'Presentar servicios de transporte', status: 'pendiente' },
  { id: 'ce15', title: 'Enviar cotización Alicorp', type: 'correo', date: '2026-03-12', startTime: '09:00', endTime: '09:30', assignedTo: 'u4', assignedToName: 'Ana Torres', relatedEntityType: 'opportunity', relatedEntityId: 'o9', relatedEntityName: 'Alicorp Ejecutivo', description: 'Cotización para directores regionales', status: 'pendiente' },
];

export const timelineEvents: TimelineEvent[] = [
  { id: 'te1', type: 'llamada', title: 'Llamada de introducción', description: 'Se presentaron los servicios corporativos. El cliente mostró interés en el plan ejecutivo.', user: 'Carlos Mendoza', date: '2026-03-05 14:30' },
  { id: 'te2', type: 'correo', title: 'Propuesta enviada', description: 'Se envió la propuesta comercial con tarifas y condiciones de servicio.', user: 'María García', date: '2026-03-04 10:15' },
  { id: 'te3', type: 'reunion', title: 'Reunión con directivos', description: 'Reunión presencial en oficinas del cliente. Se presentó la flota ejecutiva.', user: 'José Ramírez', date: '2026-03-03 16:00' },
  { id: 'te4', type: 'nota', title: 'Nota interna', description: 'El cliente prefiere vehículos SUV para su equipo directivo. Requiere servicio 24/7.', user: 'Ana Torres', date: '2026-03-02 09:45' },
  { id: 'te5', type: 'cambio_estado', title: 'Etapa actualizada', description: 'Contacto movido de "Lead" a "Contacto" tras primera llamada exitosa.', user: 'Carlos Mendoza', date: '2026-03-01 11:00' },
  { id: 'te6', type: 'tarea', title: 'Tarea creada', description: 'Preparar presentación personalizada para reunión del próximo martes.', user: 'Roberto Silva', date: '2026-02-28 15:30' },
  { id: 'te7', type: 'archivo', title: 'Documento adjuntado', description: 'Se adjuntó el brochure corporativo actualizado 2026.', user: 'María García', date: '2026-02-27 14:00' },
  { id: 'te8', type: 'llamada', title: 'Follow-up telefónico', description: 'Se confirmó el interés del cliente. Solicita cotización formal.', user: 'Carlos Mendoza', date: '2026-02-26 10:30' },
];

export const dashboardMetrics: DashboardMetrics = {
  totalContacts: 156,
  newContacts: 23,
  contactedContacts: 45,
  activeOpportunities: 34,
  closedSales: 18,
  conversionRate: 32.5,
  pendingActivities: 28,
  overdueFollowUps: 7,
  pipelineValue: 875000,
  monthlyRevenue: 245000,
};

export const notifications: NotificationItem[] = [
  { id: 'n1', title: 'Nuevo contacto registrado', description: 'Enrique Vásquez de EY Perú acaba de registrarse.', time: 'Hace 5 min', read: false, type: 'info' },
  { id: 'n2', title: 'Tarea vencida', description: 'La tarea de Fernando Ochoa (BCP) está vencida.', time: 'Hace 1 hora', read: false, type: 'warning' },
  { id: 'n3', title: 'Oportunidad ganada', description: 'Se cerró el contrato con Embajada de España por S/ 85,000.', time: 'Hace 3 horas', read: false, type: 'success' },
  { id: 'n4', title: 'Reunión en 30 min', description: 'Reunión con Miguel Ángel Ruiz de Graña y Montero.', time: 'Hace 30 min', read: true, type: 'info' },
  { id: 'n5', title: 'Contacto perdido', description: 'Carmen Aguilar de Cencosud rechazó la propuesta.', time: 'Ayer', read: true, type: 'error' },
];

export const leadsBySourceData: ChartDataPoint[] = [
  { name: 'Referido', value: 35 },
  { name: 'Base', value: 28 },
  { name: 'Entorno', value: 22 },
  { name: 'Feria', value: 18 },
  { name: 'Masivo', value: 15 },
];

export const salesByMonthData: ChartDataPoint[] = [
  { name: 'Sep', value: 145000, ventas: 145000, meta: 180000 },
  { name: 'Oct', value: 198000, ventas: 198000, meta: 180000 },
  { name: 'Nov', value: 165000, ventas: 165000, meta: 200000 },
  { name: 'Dic', value: 220000, ventas: 220000, meta: 200000 },
  { name: 'Ene', value: 185000, ventas: 185000, meta: 220000 },
  { name: 'Feb', value: 210000, ventas: 210000, meta: 220000 },
  { name: 'Mar', value: 245000, ventas: 245000, meta: 250000 },
];

export const funnelData: ChartDataPoint[] = [
  { name: 'Lead', value: 45 },
  { name: 'Contacto', value: 35 },
  { name: 'Reunión Agendada', value: 22 },
  { name: 'Propuesta Económica', value: 15 },
  { name: 'Negociación', value: 10 },
  { name: 'Activo', value: 7 },
];

export const performanceByAdvisor: ChartDataPoint[] = [
  { name: 'Carlos M.', value: 45, leads: 45, ventas: 28, conversion: 62 },
  { name: 'María G.', value: 38, leads: 38, ventas: 22, conversion: 58 },
  { name: 'José R.', value: 32, leads: 32, ventas: 18, conversion: 56 },
  { name: 'Ana T.', value: 28, leads: 28, ventas: 15, conversion: 54 },
  { name: 'Roberto S.', value: 25, leads: 25, ventas: 12, conversion: 48 },
];

export const opportunitiesByStageData: ChartDataPoint[] = [
  { name: 'Lead', value: 95000, count: 1 },
  { name: 'Contacto', value: 95000, count: 1 },
  { name: 'Reunión Agendada', value: 195000, count: 2 },
  { name: 'Propuesta Económica', value: 97000, count: 2 },
  { name: 'Negociación', value: 265000, count: 3 },
  { name: 'Activo', value: 85000, count: 1 },
];

export const contactSourceLabels: Record<string, string> = {
  referido: 'Referido',
  base: 'Base',
  entorno: 'Entorno',
  feria: 'Feria',
  masivo: 'Masivo',
};

export const companyRubroLabels: Record<string, string> = {
  mineria: 'Minería',
  hoteleria: 'Hotelería',
  banca: 'Banca',
  construccion: 'Construcción',
  salud: 'Salud',
  retail: 'Retail',
  telecomunicaciones: 'Telecomunicaciones',
  educacion: 'Educación',
  energia: 'Energía',
  consultoria: 'Consultoría',
  diplomatico: 'Diplomático',
  aviacion: 'Aviación',
  consumo_masivo: 'Consumo masivo',
  otros: 'Otros',
};

export const companyTipoLabels: Record<string, string> = {
  A: 'A',
  B: 'B',
  C: 'C',
};

/** Etiquetas de etapa (Contactos, Empresas, Oportunidades) */
export const etapaLabels: Record<Etapa, string> = {
  lead: 'Lead',
  contacto: 'Contacto',
  reunion_agendada: 'Reunión Agendada',
  reunion_efectiva: 'Reunión Efectiva',
  propuesta_economica: 'Propuesta Económica',
  negociacion: 'Negociación',
  licitacion: 'Licitación',
  licitacion_etapa_final: 'Licitación Etapa Final',
  cierre_ganado: 'Cierre Ganado',
  firma_contrato: 'Firma de Contrato',
  activo: 'Activo',
  cierre_perdido: 'Cierre Perdido',
  inactivo: 'Inactivo',
};

/** Probabilidad por etapa (en oportunidades) */
export const etapaProbabilidad: Record<Etapa, number> = {
  lead: 0,
  contacto: 10,
  reunion_agendada: 30,
  reunion_efectiva: 40,
  propuesta_economica: 50,
  negociacion: 70,
  licitacion: 75,
  licitacion_etapa_final: 85,
  cierre_ganado: 90,
  firma_contrato: 95,
  activo: 100,
  cierre_perdido: -1,
  inactivo: -5,
};

export const activityTypeLabels: Record<string, string> = {
  llamada: 'Llamada',
  reunion: 'Reunión',
  tarea: 'Tarea',
  correo: 'Correo',
  whatsapp: 'WhatsApp',
};

export const priorityLabels: Record<string, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

/** Archivos adjuntos mock (vinculados a contactos, empresas, etc.) */
export const files: FileAttachment[] = [
  { id: 'f1', name: 'Propuesta_Taxi_Monterrico_2026.pdf', size: 2450000, mimeType: 'application/pdf', uploadedAt: '2026-03-05T10:30:00', uploadedBy: 'u1', uploadedByName: 'Carlos Mendoza', entityType: 'contact', entityId: 'l1', entityName: 'Pedro Castillo' },
  { id: 'f2', name: 'Contrato_Minera_Los_Andes.pdf', size: 1200000, mimeType: 'application/pdf', uploadedAt: '2026-03-04T14:20:00', uploadedBy: 'u1', uploadedByName: 'Carlos Mendoza', entityType: 'company', entityId: 'Minera Los Andes SAC', entityName: 'Minera Los Andes SAC' },
  { id: 'f3', name: 'foto_visita_oficina.jpg', size: 890000, mimeType: 'image/jpeg', uploadedAt: '2026-03-03T16:45:00', uploadedBy: 'u3', uploadedByName: 'José Ramírez', entityType: 'contact', entityId: 'l3', entityName: 'Miguel Ángel Ruiz', relatedEntityType: 'activity', relatedEntityId: 'a3', relatedEntityName: 'Reunión presencial' },
  { id: 'f4', name: 'Brochure_Ejecutivo.pdf', size: 3100000, mimeType: 'application/pdf', uploadedAt: '2026-03-02T09:15:00', uploadedBy: 'u2', uploadedByName: 'María García', entityType: 'contact', entityId: 'l2', entityName: 'Sofía Vargas' },
  { id: 'f5', name: 'Tarifas_BCP_2026.xlsx', size: 45000, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uploadedAt: '2026-03-01T11:00:00', uploadedBy: 'u1', uploadedByName: 'Carlos Mendoza', entityType: 'contact', entityId: 'l5', entityName: 'Fernando Ochoa' },
  { id: 'f6', name: 'logo_clinica.png', size: 120000, mimeType: 'image/png', uploadedAt: '2026-02-28T13:30:00', uploadedBy: 'u4', uploadedByName: 'Ana Torres', entityType: 'company', entityId: 'Clínica Internacional', entityName: 'Clínica Internacional' },
  { id: 'f7', name: 'Notas_reunion_Repsol.docx', size: 78000, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', uploadedAt: '2026-02-27T15:20:00', uploadedBy: 'u5', uploadedByName: 'Roberto Silva', entityType: 'contact', entityId: 'l14', entityName: 'Isabella Campos' },
];
