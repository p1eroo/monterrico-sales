import type {
  Campaign,
  CampaignRecipient,
  CampaignMessageTemplate,
  CampaignRecipientResult,
} from '@/types';
import { contacts } from './mock';

/** Recipients derived from CRM contacts */
export function getRecipientsFromContacts(): CampaignRecipient[] {
  return contacts.slice(0, 12).map((c) => ({
    id: `r-${c.id}`,
    name: c.name,
    email: c.email,
    phone: c.phone,
    company: c.companies[0]?.name,
    etapa: c.etapa,
    contactId: c.id,
  }));
}

/** Message templates */
export const campaignTemplates: CampaignMessageTemplate[] = [
  {
    id: 't1',
    name: 'Presentación corporativa',
    subject: 'Taxi Monterrico - Servicio ejecutivo para {{empresa}}',
    body: 'Hola {{nombre}},\n\nSomos Taxi Monterrico, líderes en transporte ejecutivo en Lima.\n\nNos gustaría presentarle nuestros servicios corporativos diseñados para empresas como {{empresa}}.\n\n¿Podemos agendar una breve llamada esta semana?\n\nSaludos cordiales,\nEquipo Taxi Monterrico',
    channel: 'email',
    createdAt: '2026-02-15',
  },
  {
    id: 't2',
    name: 'Seguimiento post-reunión',
    subject: 'Resumen de nuestra reunión - {{empresa}}',
    body: 'Estimado {{nombre}},\n\nGracias por su tiempo en la reunión de hoy.\n\nAdjunto encontrará la propuesta comercial para {{empresa}}.\n\nQuedo atento a sus comentarios.\n\nSaludos,\nEquipo Taxi Monterrico',
    channel: 'email',
    createdAt: '2026-02-20',
  },
  {
    id: 't3',
    name: 'Recordatorio WhatsApp',
    body: 'Hola {{nombre}}, le recordamos que mañana tenemos agendada la reunión. ¿Confirma su asistencia?',
    channel: 'whatsapp',
    createdAt: '2026-03-01',
  },
];

/** Past campaigns with results */
export const campaigns: Campaign[] = [
  {
    id: 'camp1',
    name: 'Campaña Q1 - Leads Minería',
    status: 'sent',
    channel: 'email',
    message: {
      channel: 'email',
      subject: 'Taxi Monterrico - Servicio ejecutivo para su empresa',
      body: 'Hola {{nombre}},\n\nSomos Taxi Monterrico. Nos gustaría presentarle nuestros servicios corporativos para {{empresa}}.\n\n¿Podemos agendar una llamada?\n\nSaludos,\nEquipo Taxi Monterrico',
      variables: ['nombre', 'empresa'],
    },
    recipients: getRecipientsFromContacts().slice(0, 8),
    results: [
      { recipientId: 'r-l1', contactId: 'l1', name: 'Pedro Castillo', email: 'pcastillo@mineraandes.com', status: 'abierto', sentAt: '2026-03-01T09:00:00', deliveredAt: '2026-03-01T09:01:00', openedAt: '2026-03-01T10:15:00' },
      { recipientId: 'r-l2', contactId: 'l2', name: 'Sofía Vargas', email: 'svargas@belmondhotels.pe', status: 'clic', sentAt: '2026-03-01T09:00:00', deliveredAt: '2026-03-01T09:01:00', openedAt: '2026-03-01T11:30:00', clickedAt: '2026-03-01T11:32:00' },
      { recipientId: 'r-l3', contactId: 'l3', name: 'Miguel Ángel Ruiz', email: 'maruiz@gym.com.pe', status: 'entregado', sentAt: '2026-03-01T09:00:00', deliveredAt: '2026-03-01T09:02:00' },
      { recipientId: 'r-l4', contactId: 'l4', name: 'Laura Mendez', email: 'lmendez@clinicainternacional.pe', status: 'abierto', sentAt: '2026-03-01T09:00:00', deliveredAt: '2026-03-01T09:01:00', openedAt: '2026-03-01T14:00:00' },
      { recipientId: 'r-l5', contactId: 'l5', name: 'Fernando Ochoa', email: 'fochoa@bcp.com.pe', status: 'entregado', sentAt: '2026-03-01T09:00:00', deliveredAt: '2026-03-01T09:01:00' },
      { recipientId: 'r-l6', contactId: 'l6', name: 'Patricia Huamán', email: 'phuaman@pucp.edu.pe', status: 'fallido', sentAt: '2026-03-01T09:00:00', errorMessage: 'Mailbox full' },
      { recipientId: 'r-l7', contactId: 'l7', name: 'Ricardo Flores', email: 'rflores@embespana.pe', status: 'abierto', sentAt: '2026-03-01T09:00:00', deliveredAt: '2026-03-01T09:01:00', openedAt: '2026-03-01T09:45:00' },
      { recipientId: 'r-l8', contactId: 'l8', name: 'Carmen Aguilar', email: 'caguilar@cencosud.com.pe', status: 'rebote', sentAt: '2026-03-01T09:00:00', errorMessage: 'Invalid address' },
    ] as CampaignRecipientResult[],
    sentCount: 8,
    deliveredCount: 6,
    openedCount: 4,
    clickedCount: 1,
    failedCount: 1,
    bounceCount: 1,
    createdAt: '2026-02-28',
    sentAt: '2026-03-01T09:00:00',
    createdBy: 'u1',
    createdByName: 'Carlos Mendoza',
    relatedContactIds: ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8'],
  },
  {
    id: 'camp2',
    name: 'Seguimiento Banca y Retail',
    status: 'sent',
    channel: 'email',
    message: {
      channel: 'email',
      subject: 'Propuesta comercial - Taxi Monterrico',
      body: 'Estimado {{nombre}},\n\nLe enviamos la propuesta comercial para {{empresa}}.\n\nQuedamos atentos.\n\nSaludos,\nEquipo Taxi Monterrico',
      variables: ['nombre', 'empresa'],
    },
    recipients: getRecipientsFromContacts().slice(2, 7),
    results: [
      { recipientId: 'r-l3', contactId: 'l3', name: 'Miguel Ángel Ruiz', email: 'maruiz@gym.com.pe', status: 'entregado', sentAt: '2026-03-03T10:00:00', deliveredAt: '2026-03-03T10:01:00' },
      { recipientId: 'r-l4', contactId: 'l4', name: 'Laura Mendez', email: 'lmendez@clinicainternacional.pe', status: 'abierto', sentAt: '2026-03-03T10:00:00', deliveredAt: '2026-03-03T10:01:00', openedAt: '2026-03-03T15:20:00' },
      { recipientId: 'r-l5', contactId: 'l5', name: 'Fernando Ochoa', email: 'fochoa@bcp.com.pe', status: 'clic', sentAt: '2026-03-03T10:00:00', deliveredAt: '2026-03-03T10:01:00', openedAt: '2026-03-03T11:00:00', clickedAt: '2026-03-03T11:05:00' },
      { recipientId: 'r-l6', contactId: 'l6', name: 'Patricia Huamán', email: 'phuaman@pucp.edu.pe', status: 'entregado', sentAt: '2026-03-03T10:00:00', deliveredAt: '2026-03-03T10:02:00' },
      { recipientId: 'r-l7', contactId: 'l7', name: 'Ricardo Flores', email: 'rflores@embespana.pe', status: 'abierto', sentAt: '2026-03-03T10:00:00', deliveredAt: '2026-03-03T10:01:00', openedAt: '2026-03-03T10:30:00' },
    ] as CampaignRecipientResult[],
    sentCount: 5,
    deliveredCount: 5,
    openedCount: 3,
    clickedCount: 1,
    failedCount: 0,
    bounceCount: 0,
    createdAt: '2026-03-02',
    sentAt: '2026-03-03T10:00:00',
    createdBy: 'u2',
    createdByName: 'María García',
    relatedContactIds: ['l3', 'l4', 'l5', 'l6', 'l7'],
  },
  {
    id: 'camp3',
    name: 'Recordatorio reuniones - Borrador',
    status: 'draft',
    channel: 'whatsapp',
    message: {
      channel: 'whatsapp',
      body: 'Hola {{nombre}}, le recordamos la reunión de mañana. ¿Confirma asistencia?',
      variables: ['nombre'],
    },
    recipients: getRecipientsFromContacts().slice(0, 4),
    createdAt: '2026-03-05',
    createdBy: 'u3',
    createdByName: 'José Ramírez',
    relatedContactIds: ['l1', 'l2', 'l3', 'l4'],
  },
  {
    id: 'camp4',
    name: 'Campaña Interbank - Programada',
    status: 'scheduled',
    channel: 'email',
    message: {
      channel: 'email',
      subject: 'Taxi Monterrico - Servicio VIP para Interbank',
      body: 'Estimada {{nombre}},\n\nComo acordamos, adjunto la propuesta para {{empresa}}.\n\nSaludos,\nEquipo Taxi Monterrico',
      variables: ['nombre', 'empresa'],
    },
    recipients: getRecipientsFromContacts().filter((r) => r.company?.toLowerCase().includes('interbank')),
    createdAt: '2026-03-06',
    scheduledFor: '2026-03-08T09:00:00',
    createdBy: 'u1',
    createdByName: 'Carlos Mendoza',
    relatedContactIds: ['l10'],
    relatedOpportunityIds: ['o10'],
  },
];
