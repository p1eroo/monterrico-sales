import type { LucideIcon } from 'lucide-react';
import { Megaphone, ShieldCheck, Wrench } from 'lucide-react';

/**
 * Mock de WhatsApp Business (Meta) para el envío masivo.
 * Tipos y datos de ejemplo: al conectar la Cloud API se reemplazan por respuestas reales.
 */

export type WhatsAppTemplateCategory = 'marketing' | 'utility' | 'authentication';
export type WhatsAppTemplateStatus = 'approved' | 'pending' | 'rejected';
export type WhatsAppParameterFormat = 'named' | 'positional';
export type WhatsAppHeaderMedia = 'none' | 'image' | 'video' | 'document' | 'location';

export type WhatsAppTemplateButton =
  | { type: 'quick_reply'; text: string }
  | { type: 'url'; text: string; url: string }
  | { type: 'phone'; text: string; phone: string };

export type WhatsAppTemplate = {
  id: string;
  name: string;
  category: WhatsAppTemplateCategory;
  language: string;
  /** Encabezado de texto (máx. 60). Vacío si el header es multimedia. */
  header?: string;
  /** Cuerpo con variables {{1}} o {{nombre}}. */
  body: string;
  /** Pie de página (máx. 60). Meta no admite variables aquí. */
  footer?: string;
  headerMedia?: WhatsAppHeaderMedia;
  /** `named` = {{nombre}}; `positional` = {{1}}, {{2}}. */
  parameterFormat?: WhatsAppParameterFormat;
  /** Variables de ejemplo: etiqueta que se mapea al contacto. */
  sampleVariables: string[];
  status: WhatsAppTemplateStatus;
  qualityRating: 'alta' | 'media' | 'baja';
  buttons: WhatsAppTemplateButton[];
  createdAt: string;
  rejectionReason?: string;
};

const PLACEHOLDER_RE = /\{\{([a-z][a-z0-9_]*|\d+)\}\}/gi;

export function extractWhatsAppPlaceholders(...texts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(PLACEHOLDER_RE)) {
      const key = match[1];
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
  }
  return out;
}

export function slugifyWhatsAppParam(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[0-9]+/, '')
    .slice(0, 30);
}

export type WhatsAppContactSource = 'leads' | 'crm' | 'excel';

export type WhatsAppContact = {
  id: string;
  name: string;
  phone: string;
  company?: string;
  city?: string;
  platform?: 'fb' | 'ig' | 'msg' | 'an';
  source: WhatsAppContactSource;
  hasWhatsApp: boolean;
};

export type WhatsAppSendStatus = 'enviado' | 'entregado' | 'leido' | 'fallido';

export type WhatsAppSendResult = {
  contactId: string;
  name: string;
  phone: string;
  status: WhatsAppSendStatus;
  error?: string;
  sentAt?: string;
};

export const WHATSAPP_CATEGORY_META: Record<WhatsAppTemplateCategory, string> = {
  marketing: 'Marketing',
  utility: 'Utilidad',
  authentication: 'Autenticación',
};

export const WHATSAPP_CATEGORY_META_CODE: Record<WhatsAppTemplateCategory, string> = {
  marketing: 'MARKETING',
  utility: 'UTILITY',
  authentication: 'AUTHENTICATION',
};

export const WHATSAPP_STATUS_LABEL: Record<WhatsAppTemplateStatus, string> = {
  approved: 'Aprobada',
  pending: 'Pendiente',
  rejected: 'Rechazada',
};

export const WHATSAPP_STATUS_CLASS: Record<WhatsAppTemplateStatus, string> = {
  approved:
    'border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
  pending:
    'border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
  rejected:
    'border-red-300/60 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300',
};

export const WHATSAPP_CATEGORY_ICON: Record<WhatsAppTemplateCategory, LucideIcon> = {
  marketing: Megaphone,
  utility: Wrench,
  authentication: ShieldCheck,
};

export const MOCK_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Bienvenida Taxi Monterrico',
    category: 'marketing',
    language: 'es',
    body: 'Hola {{1}}, bienvenido a Taxi Monterrico 🚕\n\nDisfruta de {{2}} en tu primer viaje con nosotros. ¡Te esperamos!',
    sampleVariables: ['Nombre', 'Promoción'],
    status: 'approved',
    qualityRating: 'alta',
    buttons: [{ type: 'url', text: 'Ver promoción', url: 'https://taximonterrico.com/ofertas' }],
    createdAt: '2026-07-12',
  },
  {
    id: 'tpl-2',
    name: 'Recordatorio de pago',
    category: 'utility',
    language: 'es',
    body: 'Hola {{1}}, te recordamos que el pago de {{2}} (S/ {{3}}) vence el {{4}}.\n\nSi ya lo realizaste, ignora este mensaje.',
    sampleVariables: ['Nombre', 'Servicio', 'Monto', 'Fecha'],
    status: 'approved',
    qualityRating: 'alta',
    buttons: [{ type: 'quick_reply', text: 'Ya pagué' }],
    createdAt: '2026-06-20',
  },
  {
    id: 'tpl-3',
    name: 'Oferta Black Friday',
    category: 'marketing',
    language: 'es',
    body: '🔥 Black Friday en Taxi Monterrico\n\nHola {{1}}, aprovecha {{2}} con descuentos de hasta 40% este fin de semana.',
    sampleVariables: ['Nombre', 'Promoción'],
    status: 'approved',
    qualityRating: 'media',
    buttons: [
      { type: 'url', text: 'Ver ofertas', url: 'https://taximonterrico.com/blackfriday' },
      { type: 'quick_reply', text: 'Quiero más info' },
    ],
    createdAt: '2026-08-01',
  },
  {
    id: 'tpl-4',
    name: 'Confirmación de servicio',
    category: 'utility',
    language: 'es',
    body: 'Hola {{1}}, tu servicio del {{2}} a las {{3}} fue confirmado. Tu conductor llegará en 10 minutos.',
    sampleVariables: ['Nombre', 'Fecha', 'Hora'],
    status: 'approved',
    qualityRating: 'alta',
    buttons: [],
    createdAt: '2026-05-15',
  },
  {
    id: 'tpl-5',
    name: 'Encuesta de satisfacción',
    category: 'marketing',
    language: 'es',
    body: 'Hola {{1}}, ¿cómo fue tu experiencia con Taxi Monterrico?\n\nCuéntanos en una escala del 1 al 5.',
    sampleVariables: ['Nombre'],
    status: 'pending',
    qualityRating: 'media',
    buttons: [
      { type: 'quick_reply', text: '5' },
      { type: 'quick_reply', text: '4' },
      { type: 'quick_reply', text: '3' },
    ],
    createdAt: '2026-08-18',
  },
  {
    id: 'tpl-6',
    name: 'Promoción de verano',
    category: 'marketing',
    language: 'es',
    body: '☀️ Verano con Taxi Monterrico\n\nHola {{1}}, este mes viaja a {{2}} con 25% OFF usando el cupón VERANO25.',
    sampleVariables: ['Nombre', 'Destino'],
    status: 'pending',
    qualityRating: 'media',
    buttons: [{ type: 'quick_reply', text: 'Quiero el cupón' }],
    createdAt: '2026-08-20',
  },
  {
    id: 'tpl-7',
    name: 'Actualización de aplicación',
    category: 'utility',
    language: 'es',
    body: 'Hola {{1}}, actualizamos nuestra app con mejoras de seguridad.\n\nActualízala desde tu tienda de aplicaciones.',
    sampleVariables: ['Nombre'],
    status: 'approved',
    qualityRating: 'baja',
    buttons: [{ type: 'url', text: 'Actualizar', url: 'https://play.google.com/store' }],
    createdAt: '2026-04-02',
  },
  {
    id: 'tpl-8',
    name: 'Cupón de bienvenida',
    category: 'marketing',
    language: 'es',
    body: 'Hola {{1}}, te enviamos tu cupón de {{2}} para tu próximo viaje. ¡No olvides usarlo!',
    sampleVariables: ['Nombre', 'Descuento'],
    status: 'rejected',
    qualityRating: 'baja',
    buttons: [],
    createdAt: '2026-03-10',
    rejectionReason: 'El contenido no cumple las políticas de mensajería de Meta (falta opción de baja).',
  },
];

export const MOCK_WHATSAPP_CONTACTS: WhatsAppContact[] = [
  { id: 'c1', name: 'Carlos Mendoza', phone: '958921766', company: 'Formulario: Oferta Taxi', platform: 'fb', source: 'leads', hasWhatsApp: true },
  { id: 'c2', name: 'María Fernández', phone: '988777666', company: 'Formulario: Oferta Taxi', platform: 'ig', source: 'leads', hasWhatsApp: true },
  { id: 'c3', name: 'José Ramírez', phone: '977666555', company: 'Formulario: Bono de bienvenida', platform: 'fb', source: 'leads', hasWhatsApp: true },
  { id: 'c4', name: 'Lucía Torres', phone: '966555444', company: 'Formulario: Bono de bienvenida', platform: 'ig', source: 'leads', hasWhatsApp: true },
  { id: 'c5', name: 'Andrés Salazar', phone: '955444333', company: 'Formulario: Cotiza tu taxi', platform: 'fb', source: 'leads', hasWhatsApp: true },
  { id: 'c6', name: 'Valeria Rojas', phone: '944333222', company: 'Formulario: Cotiza tu taxi', platform: 'fb', source: 'leads', hasWhatsApp: true },
  { id: 'c7', name: 'Diego Paredes', phone: '933222111', company: 'Formulario: Oferta Taxi', platform: 'msg', source: 'leads', hasWhatsApp: true },
  { id: 'c8', name: 'Camila Vega', phone: '922111000', company: 'Transportes del Sur S.A.C.', platform: 'fb', source: 'crm', hasWhatsApp: true },
  { id: 'c9', name: 'Ricardo Luna', phone: '911000999', company: 'Transportes del Sur S.A.C.', platform: undefined, source: 'crm', hasWhatsApp: true },
  { id: 'c10', name: 'Paola Castillo', phone: '900999888', company: 'Grupo Andino EIRL', platform: 'ig', source: 'crm', hasWhatsApp: true },
  { id: 'c11', name: 'Miguel Ortiz', phone: '899888777', company: 'Grupo Andino EIRL', platform: undefined, source: 'crm', hasWhatsApp: false },
  { id: 'c12', name: 'Renata Flores', phone: '888777666', company: 'Formulario: Oferta Taxi', platform: 'ig', source: 'leads', hasWhatsApp: true },
  { id: 'c13', name: 'Fernando Chávez', phone: '877666555', company: 'Formulario: Cotiza tu taxi', platform: 'fb', source: 'leads', hasWhatsApp: true },
  { id: 'c14', name: 'Isabel Mendoza', phone: '866555444', company: 'Cliente recuperado', platform: 'fb', source: 'crm', hasWhatsApp: true },
  { id: 'c15', name: 'Gabriel Salas', phone: '855444333', company: 'Formulario: Bono de bienvenida', platform: 'fb', source: 'excel', hasWhatsApp: false },
];

export const MOCK_WHATSAPP_RESULTS: WhatsAppSendResult[] = [
  { contactId: 'c1', name: 'Carlos Mendoza', phone: '958921766', status: 'entregado', sentAt: '2026-08-24T10:02:11' },
  { contactId: 'c2', name: 'María Fernández', phone: '988777666', status: 'leido', sentAt: '2026-08-24T10:02:14' },
  { contactId: 'c3', name: 'José Ramírez', phone: '977666555', status: 'entregado', sentAt: '2026-08-24T10:02:17' },
  { contactId: 'c4', name: 'Lucía Torres', phone: '966555444', status: 'fallido', sentAt: '2026-08-24T10:02:20', error: 'El número no tiene WhatsApp activo' },
  { contactId: 'c5', name: 'Andrés Salazar', phone: '955444333', status: 'entregado', sentAt: '2026-08-24T10:02:23' },
  { contactId: 'c6', name: 'Valeria Rojas', phone: '944333222', status: 'leido', sentAt: '2026-08-24T10:02:26' },
  { contactId: 'c7', name: 'Diego Paredes', phone: '933222111', status: 'enviado', sentAt: '2026-08-24T10:02:29' },
  { contactId: 'c8', name: 'Camila Vega', phone: '922111000', status: 'entregado', sentAt: '2026-08-24T10:02:32' },
  { contactId: 'c9', name: 'Ricardo Luna', phone: '911000999', status: 'fallido', sentAt: '2026-08-24T10:02:35', error: 'Límite anti-spam de Meta excedido' },
  { contactId: 'c10', name: 'Paola Castillo', phone: '900999888', status: 'entregado', sentAt: '2026-08-24T10:02:38' },
  { contactId: 'c11', name: 'Miguel Ortiz', phone: '899888777', status: 'fallido', sentAt: '2026-08-24T10:02:41', error: 'Teléfono no registrado en WhatsApp' },
  { contactId: 'c12', name: 'Renata Flores', phone: '888777666', status: 'leido', sentAt: '2026-08-24T10:02:44' },
  { contactId: 'c13', name: 'Fernando Chávez', phone: '877666555', status: 'entregado', sentAt: '2026-08-24T10:02:47' },
  { contactId: 'c14', name: 'Isabel Mendoza', phone: '866555444', status: 'leido', sentAt: '2026-08-24T10:02:50' },
  { contactId: 'c15', name: 'Gabriel Salas', phone: '855444333', status: 'fallido', sentAt: '2026-08-24T10:02:53', error: 'Número inválido (formato incorrecto)' },
];

export const WHATSAPP_SEND_STATUS_LABEL: Record<WhatsAppSendStatus, string> = {
  enviado: 'Enviado',
  entregado: 'Entregado',
  leido: 'Leído',
  fallido: 'Fallido',
};

export const WHATSAPP_SEND_STATUS_CLASS: Record<WhatsAppSendStatus, string> = {
  enviado: 'border-blue-300/60 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200',
  entregado: 'border-slate-300/60 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300',
  leido: 'border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
  fallido: 'border-red-300/60 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300',
};

export const WHATSAPP_PLATFORM_LABEL: Record<string, string> = {
  fb: 'Facebook',
  ig: 'Instagram',
  msg: 'Messenger',
  an: 'Audience',
};

export const WHATSAPP_SOURCE_LABEL: Record<WhatsAppContactSource, string> = {
  leads: 'Leads',
  crm: 'CRM',
  excel: 'Excel',
};

export const WHATSAPP_HEADER_MEDIA_LABEL: Record<WhatsAppHeaderMedia, string> = {
  none: 'Ninguna',
  image: 'Imagen',
  video: 'Video',
  document: 'Documento',
  location: 'Ubicación',
};

export function countWhatsAppResults(results: WhatsAppSendResult[]) {
  return {
    total: results.length,
    enviados: results.filter((r) => r.status === 'enviado').length,
    entregados: results.filter((r) => r.status === 'entregado').length,
    leidos: results.filter((r) => r.status === 'leido').length,
    fallidos: results.filter((r) => r.status === 'fallido').length,
  };
}
