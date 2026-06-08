import type { EmailMessage, EmailThread } from '@/types';

const thread1: EmailMessage[] = [
  {
    id: 'em1',
    from: 'pcastillo@mineraandes.com',
    fromName: 'Pedro Castillo',
    to: ['carlos.mendoza@taximonterrico.com'],
    subject: 'Re: Propuesta de servicio corporativo',
    body: 'Estimado Carlos,\n\nGracias por la propuesta enviada. Hemos revisado los términos y nos interesa agendar una reunión para la próxima semana. ¿Tiene disponibilidad el martes 14 de marzo?\n\nSaludos cordiales,\nPedro Castillo\nGerente de Operaciones\nMinera Los Andes SAC',
    timestamp: '2026-03-06T14:30:00',
    isRead: false,
    isStarred: true,
    folder: 'inbox',
    threadId: 'thread1',
  },
  {
    id: 'em2',
    from: 'carlos.mendoza@taximonterrico.com',
    fromName: 'Carlos Mendoza',
    to: ['pcastillo@mineraandes.com'],
    subject: 'Re: Propuesta de servicio corporativo',
    body: 'Estimado Pedro,\n\nLe envié la propuesta de servicio ejecutivo la semana pasada. Quedo atento a sus comentarios.\n\nSaludos,\nCarlos Mendoza\nTaxi Monterrico',
    timestamp: '2026-03-06T10:15:00',
    isRead: true,
    isStarred: false,
    folder: 'inbox',
    threadId: 'thread1',
  },
  {
    id: 'em3',
    from: 'pcastillo@mineraandes.com',
    fromName: 'Pedro Castillo',
    to: ['carlos.mendoza@taximonterrico.com'],
    subject: 'Propuesta de servicio corporativo',
    body: 'Estimado Carlos,\n\nSolicito información sobre su servicio de transporte ejecutivo para nuestro equipo directivo.\n\nSaludos,\nPedro Castillo',
    timestamp: '2026-03-06T09:00:00',
    isRead: true,
    isStarred: false,
    folder: 'inbox',
    threadId: 'thread1',
  },
];

const thread2: EmailMessage[] = [
  {
    id: 'em4',
    from: 'svargas@belmondhotels.pe',
    fromName: 'Sofía Vargas',
    to: ['maria.garcia@taximonterrico.com'],
    subject: 'Confirmación reunión - Hotel Belmond',
    body: 'Estimada María,\n\nConfirmo nuestra reunión para el jueves 9 de marzo a las 10:00 am en nuestras oficinas. Por favor traiga el brochure ejecutivo y las tarifas para transfer aeropuerto.\n\nSaludos,\nSofía Vargas\nDirectora de Compras\nHotel Belmond Miraflores',
    timestamp: '2026-03-06T11:45:00',
    isRead: false,
    isStarred: false,
    folder: 'inbox',
    threadId: 'thread2',
  },
];

const thread3: EmailMessage[] = [
  {
    id: 'em5',
    from: 'fochoa@bcp.com.pe',
    fromName: 'Fernando Ochoa',
    to: ['carlos.mendoza@taximonterrico.com'],
    subject: 'Re: Negociación contrato flota BCP',
    body: 'Carlos,\n\nAdjunto el documento con los términos revisados. Necesitamos la firma antes del viernes.\n\nFernando',
    timestamp: '2026-03-06T08:20:00',
    isRead: false,
    isStarred: true,
    folder: 'inbox',
    threadId: 'thread3',
    attachments: [
      { id: 'att1', name: 'contrato_bcp_v2.pdf', size: 245000, type: 'application/pdf' },
    ],
  },
];

const thread4: EmailMessage[] = [
  {
    id: 'em6',
    from: 'vrojas@interbank.pe',
    fromName: 'Valentina Rojas',
    to: ['carlos.mendoza@taximonterrico.com'],
    subject: 'Información servicio VIP',
    body: 'Buenos días,\n\nMe gustaría recibir información sobre su servicio premium para ejecutivos. ¿Podrían enviarme un brochure?\n\nValentina Rojas\nGerente de Servicios\nInterbank',
    timestamp: '2026-03-05T16:00:00',
    isRead: true,
    isStarred: false,
    folder: 'inbox',
    threadId: 'thread4',
  },
];

const thread5: EmailMessage[] = [
  {
    id: 'em7',
    from: 'carlos.mendoza@taximonterrico.com',
    fromName: 'Carlos Mendoza',
    to: ['maruiz@gym.com.pe'],
    subject: 'Recordatorio reunión mañana',
    body: 'Estimado Miguel Ángel,\n\nLe recuerdo nuestra reunión de mañana a las 2:30 pm en sus oficinas. Llevaré la demostración de flota.\n\nSaludos,\nCarlos Mendoza',
    timestamp: '2026-03-06T14:00:00',
    isRead: true,
    isStarred: false,
    folder: 'sent',
    threadId: 'thread5',
  },
];

const thread6: EmailMessage[] = [
  {
    id: 'em8',
    from: 'phuaman@pucp.edu.pe',
    fromName: 'Patricia Huamán',
    to: ['maria.garcia@taximonterrico.com'],
    subject: 'Re: Propuesta Universidad PUCP',
    body: 'María,\n\nEl comité aprobó la propuesta. Necesitamos el contrato firmado para el siguiente paso.\n\nPatricia',
    timestamp: '2026-03-05T15:30:00',
    isRead: false,
    isStarred: false,
    folder: 'inbox',
    threadId: 'thread6',
  },
];

export const emailThreads: EmailThread[] = [
  {
    id: 'thread1',
    subject: 'Propuesta de servicio corporativo',
    messages: thread1,
    relatedEntityType: 'contact',
    relatedEntityId: 'l1',
    relatedEntityName: 'Pedro Castillo - Minera Los Andes',
  },
  {
    id: 'thread2',
    subject: 'Confirmación reunión - Hotel Belmond',
    messages: thread2,
    relatedEntityType: 'contact',
    relatedEntityId: 'l2',
    relatedEntityName: 'Sofía Vargas - Hotel Belmond',
  },
  {
    id: 'thread3',
    subject: 'Re: Negociación contrato flota BCP',
    messages: thread3,
    relatedEntityType: 'opportunity',
    relatedEntityId: 'o3',
    relatedEntityName: 'Flota Exclusiva BCP',
  },
  {
    id: 'thread4',
    subject: 'Información servicio VIP',
    messages: thread4,
    relatedEntityType: 'contact',
    relatedEntityId: 'l10',
    relatedEntityName: 'Valentina Rojas - Interbank',
  },
  {
    id: 'thread5',
    subject: 'Recordatorio reunión mañana',
    messages: thread5,
    relatedEntityType: 'contact',
    relatedEntityId: 'l3',
    relatedEntityName: 'Miguel Ángel Ruiz - GyM',
  },
  {
    id: 'thread6',
    subject: 'Re: Propuesta Universidad PUCP',
    messages: thread6,
    relatedEntityType: 'opportunity',
    relatedEntityId: 'o6',
    relatedEntityName: 'Plan Universitario PUCP',
  },
];

export const folderLabels: Record<string, string> = {
  inbox: 'Recibidos',
  sent: 'Enviados',
  drafts: 'Borradores',
  starred: 'Destacados',
  trash: 'Papelera',
};

export const entityTypeLabels: Record<string, string> = {
  contact: 'Contacto',
  company: 'Empresa',
  opportunity: 'Oportunidad',
};
