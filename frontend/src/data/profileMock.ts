import type { ActivityLog } from '@/types';

/** Perfil extendido del usuario actual (mock) */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  cargo: string;
  empresa: string;
  role: string;
  avatar?: string;
  status: 'activo' | 'inactivo';
  createdAt: string;
  lastActivity: string;
}

export const currentUserProfile: UserProfile = {
  id: 'u1',
  name: 'Carlos Mendoza',
  email: 'carlos.mendoza@taximonterrico.com',
  phone: '+51 999 111 222',
  cargo: 'Gerente Comercial',
  empresa: 'Taxi Monterrico',
  role: 'Administrador',
  status: 'activo',
  createdAt: '2023-01-15',
  lastActivity: '2026-03-06T14:30:00',
};

/** Estadísticas de actividad del usuario */
export interface UserActivityStats {
  contactsCreated: number;
  opportunitiesManaged: number;
  activitiesCompleted: number;
  campaignsSent: number;
}

export const userActivityStats: UserActivityStats = {
  contactsCreated: 45,
  opportunitiesManaged: 28,
  activitiesCompleted: 156,
  campaignsSent: 12,
};

/** Timeline de actividad reciente del usuario */
export const userActivityTimeline: ActivityLog[] = [
  {
    id: 'al1',
    userId: 'u1',
    userName: 'Carlos Mendoza',
    action: 'crear',
    module: 'contactos',
    entityType: 'Contacto',
    entityName: 'Enrique Vásquez - EY',
    description: 'Creó el contacto Enrique Vásquez',
    timestamp: '2026-03-06T14:30:00',
    status: 'exito',
  },
  {
    id: 'al2',
    userId: 'u1',
    userName: 'Carlos Mendoza',
    action: 'cambiar_etapa',
    module: 'oportunidades',
    entityType: 'Oportunidad',
    entityId: 'o3',
    entityName: 'Flota Exclusiva BCP',
    description: 'Movió a etapa Negociación',
    timestamp: '2026-03-06T11:15:00',
    status: 'exito',
  },
  {
    id: 'al3',
    userId: 'u1',
    userName: 'Carlos Mendoza',
    action: 'actualizar',
    module: 'contactos',
    entityType: 'Contacto',
    entityId: 'l1',
    entityName: 'Pedro Castillo',
    description: 'Actualizó información del contacto',
    timestamp: '2026-03-05T16:45:00',
    status: 'exito',
  },
  {
    id: 'al4',
    userId: 'u1',
    userName: 'Carlos Mendoza',
    action: 'crear',
    module: 'oportunidades',
    entityType: 'Oportunidad',
    entityName: 'Interbank VIP',
    description: 'Creó la oportunidad Interbank VIP',
    timestamp: '2026-03-02T09:20:00',
    status: 'exito',
  },
  {
    id: 'al5',
    userId: 'u1',
    userName: 'Carlos Mendoza',
    action: 'crear',
    module: 'actividades',
    entityType: 'Campaña',
    entityName: 'Campaña Q1 - Leads Minería',
    description: 'Envió campaña a 8 destinatarios',
    timestamp: '2026-03-01T09:00:00',
    status: 'exito',
  },
];
