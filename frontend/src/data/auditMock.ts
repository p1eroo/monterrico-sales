import type { ActivityLog, AuditLog, AuditLogEntry } from '@/types';

export const activityLogs: ActivityLog[] = [
  { id: 'al1', userId: 'u1', userName: 'Carlos Mendoza', action: 'crear', module: 'contactos', entityType: 'Contacto', entityId: 'l15', entityName: 'Enrique Vásquez - EY', description: 'Creó contacto Enrique Vásquez', timestamp: '2026-03-06T14:30:00', status: 'exito' },
  { id: 'al2', userId: 'u2', userName: 'María García', action: 'actualizar', module: 'empresas', entityType: 'Empresa', entityId: 'e2', entityName: 'Hotel Belmond', description: 'Actualizó datos de Hotel Belmond', timestamp: '2026-03-06T13:15:00', status: 'exito' },
  { id: 'al3', userId: 'u3', userName: 'José Ramírez', action: 'cambiar_etapa', module: 'pipeline', entityType: 'Contacto', entityId: 'l3', entityName: 'Miguel Ángel Ruiz - GyM', description: 'Cambió etapa de Reunión Agendada a Reunión Efectiva', timestamp: '2026-03-06T11:45:00', status: 'exito', isCritical: true },
  { id: 'al4', userId: 'u1', userName: 'Carlos Mendoza', action: 'asignar', module: 'oportunidades', entityType: 'Oportunidad', entityId: 'o10', entityName: 'Interbank VIP', description: 'Asignó oportunidad a sí mismo', timestamp: '2026-03-06T10:20:00', status: 'exito' },
  { id: 'al5', userId: 'u4', userName: 'Ana Torres', action: 'crear', module: 'actividades', entityType: 'Actividad', entityId: 'a8', entityName: 'Demo flota Clínica Internacional', description: 'Creó actividad de tipo Reunión', timestamp: '2026-03-05T16:20:00', status: 'exito' },
  { id: 'al6', userId: 'u1', userName: 'Carlos Mendoza', action: 'login', module: 'sistema', entityType: 'Sistema', description: 'Inicio de sesión exitoso', timestamp: '2026-03-06T08:00:00', status: 'exito' },
  { id: 'al7', userId: 'u5', userName: 'Roberto Silva', action: 'actualizar', module: 'oportunidades', entityType: 'Oportunidad', entityId: 'o8', entityName: 'Repsol Corporate Fleet', description: 'Actualizó monto de oportunidad', timestamp: '2026-03-05T15:30:00', status: 'exito' },
  { id: 'al8', userId: 'u2', userName: 'María García', action: 'eliminar', module: 'contactos', entityType: 'Contacto', entityId: 'l99', entityName: 'Contacto duplicado', description: 'Eliminó contacto duplicado', timestamp: '2026-03-05T12:00:00', status: 'exito', isCritical: true },
  { id: 'al9', userId: 'u1', userName: 'Carlos Mendoza', action: 'desactivar_usuario', module: 'usuarios', entityType: 'Usuario', entityId: 'u6', entityName: 'Lucía Fernández', description: 'Desactivó usuario del sistema', timestamp: '2026-03-04T17:45:00', status: 'exito', isCritical: true },
  { id: 'al10', userId: 'u99', userName: 'IP desconocida', action: 'login_fallido', module: 'sistema', entityType: 'Sistema', description: 'Intento de login fallido - email no registrado', timestamp: '2026-03-06T09:30:00', status: 'fallido', isCritical: true },
  { id: 'al11', userId: 'u2', userName: 'María García', action: 'actualizar', module: 'configuracion', entityType: 'Configuración', entityName: 'Etapas del Pipeline', description: 'Añadió nueva etapa al pipeline', timestamp: '2026-03-04T10:00:00', status: 'exito' },
  { id: 'al12', userId: 'u3', userName: 'José Ramírez', action: 'crear', module: 'oportunidades', entityType: 'Oportunidad', entityId: 'o11', entityName: 'Servicio Embajada Francia', description: 'Creó nueva oportunidad', timestamp: '2026-03-05T09:15:00', status: 'exito' },
  { id: 'al13', userId: 'u1', userName: 'Carlos Mendoza', action: 'actualizar', module: 'roles', entityType: 'Rol', entityId: 'r3', entityName: 'Asesor Comercial', description: 'Modificó permisos del rol Asesor', timestamp: '2026-03-03T14:20:00', status: 'exito', isCritical: true },
  { id: 'al14', userId: 'u4', userName: 'Ana Torres', action: 'cambiar_etapa', module: 'pipeline', entityType: 'Contacto', entityId: 'l4', entityName: 'Laura Mendez - Clínica Internacional', description: 'Avanzó a Propuesta Económica', timestamp: '2026-03-05T11:00:00', status: 'exito', isCritical: true },
  { id: 'al15', userId: 'u2', userName: 'María García', action: 'login', module: 'sistema', entityType: 'Sistema', description: 'Inicio de sesión exitoso', timestamp: '2026-03-06T07:45:00', status: 'exito' },
];

const auditEntries1: AuditLogEntry[] = [
  { id: 'ae1', userId: 'u3', userName: 'José Ramírez', entityType: 'Contacto', entityId: 'l3', entityName: 'Miguel Ángel Ruiz - GyM', fieldChanged: 'Etapa', oldValue: 'Reunión Agendada', newValue: 'Reunión Efectiva', timestamp: '2026-03-06T11:45:00', actionId: 'al3' },
];
const auditEntries2: AuditLogEntry[] = [
  { id: 'ae2', userId: 'u5', userName: 'Roberto Silva', entityType: 'Oportunidad', entityId: 'o8', entityName: 'Repsol Corporate Fleet', fieldChanged: 'Monto', oldValue: '100000', newValue: '110000', timestamp: '2026-03-05T15:30:00', actionId: 'al7' },
  { id: 'ae3', userId: 'u5', userName: 'Roberto Silva', entityType: 'Oportunidad', entityId: 'o8', entityName: 'Repsol Corporate Fleet', fieldChanged: 'Fecha cierre', oldValue: '2026-04-15', newValue: '2026-04-20', timestamp: '2026-03-05T15:30:00', actionId: 'al7' },
];
const auditEntries3: AuditLogEntry[] = [
  { id: 'ae4', userId: 'u2', userName: 'María García', entityType: 'Empresa', entityId: 'e2', entityName: 'Hotel Belmond', fieldChanged: 'Teléfono', oldValue: '+51 1 234 5678', newValue: '+51 1 234 5699', timestamp: '2026-03-06T13:15:00', actionId: 'al2' },
  { id: 'ae5', userId: 'u2', userName: 'María García', entityType: 'Empresa', entityId: 'e2', entityName: 'Hotel Belmond', fieldChanged: 'Email', oldValue: 'info@belmond.com', newValue: 'reservas@belmond.com', timestamp: '2026-03-06T13:15:00', actionId: 'al2' },
];
const auditEntries4: AuditLogEntry[] = [
  { id: 'ae6', userId: 'u1', userName: 'Carlos Mendoza', entityType: 'Usuario', entityId: 'u6', entityName: 'Lucía Fernández', fieldChanged: 'Estado', oldValue: 'activo', newValue: 'inactivo', timestamp: '2026-03-04T17:45:00', actionId: 'al9' },
];
const auditEntries5: AuditLogEntry[] = [
  { id: 'ae7', userId: 'u4', userName: 'Ana Torres', entityType: 'Contacto', entityId: 'l4', entityName: 'Laura Mendez', fieldChanged: 'Etapa', oldValue: 'Reunión Efectiva', newValue: 'Propuesta Económica', timestamp: '2026-03-05T11:00:00', actionId: 'al14' },
];
const auditEntries6: AuditLogEntry[] = [
  { id: 'ae8', userId: 'u1', userName: 'Carlos Mendoza', entityType: 'Rol', entityId: 'r3', entityName: 'Asesor Comercial', fieldChanged: 'Permiso reportes', oldValue: 'false', newValue: 'true', timestamp: '2026-03-03T14:20:00', actionId: 'al13' },
];

export const auditLogs: AuditLog[] = [
  { id: 'au1', userId: 'u3', userName: 'José Ramírez', entityType: 'Contacto', entityId: 'l3', entityName: 'Miguel Ángel Ruiz - GyM', action: 'cambiar_etapa', timestamp: '2026-03-06T11:45:00', entries: auditEntries1 },
  { id: 'au2', userId: 'u5', userName: 'Roberto Silva', entityType: 'Oportunidad', entityId: 'o8', entityName: 'Repsol Corporate Fleet', action: 'actualizar', timestamp: '2026-03-05T15:30:00', entries: auditEntries2 },
  { id: 'au3', userId: 'u2', userName: 'María García', entityType: 'Empresa', entityId: 'e2', entityName: 'Hotel Belmond', action: 'actualizar', timestamp: '2026-03-06T13:15:00', entries: auditEntries3 },
  { id: 'au4', userId: 'u1', userName: 'Carlos Mendoza', entityType: 'Usuario', entityId: 'u6', entityName: 'Lucía Fernández', action: 'desactivar_usuario', timestamp: '2026-03-04T17:45:00', entries: auditEntries4 },
  { id: 'au5', userId: 'u4', userName: 'Ana Torres', entityType: 'Contacto', entityId: 'l4', entityName: 'Laura Mendez', action: 'cambiar_etapa', timestamp: '2026-03-05T11:00:00', entries: auditEntries5 },
  { id: 'au6', userId: 'u1', userName: 'Carlos Mendoza', entityType: 'Rol', entityId: 'r3', entityName: 'Asesor Comercial', action: 'actualizar', timestamp: '2026-03-03T14:20:00', entries: auditEntries6 },
];

export const actionLabels: Record<string, string> = {
  crear: 'Crear',
  actualizar: 'Actualizar',
  eliminar: 'Eliminar',
  asignar: 'Asignar',
  cambiar_etapa: 'Cambiar etapa',
  login: 'Inicio de sesión',
  login_fallido: 'Login fallido',
  cambiar_password: 'Cambiar contraseña',
  desactivar_usuario: 'Desactivar usuario',
};

export const moduleLabels: Record<string, string> = {
  contactos: 'Contactos',
  empresas: 'Empresas',
  oportunidades: 'Oportunidades',
  pipeline: 'Pipeline',
  actividades: 'Actividades',
  usuarios: 'Usuarios',
  roles: 'Roles y permisos',
  configuracion: 'Configuración',
  sistema: 'Sistema',
};
