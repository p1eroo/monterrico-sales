import type { WhatsAppTemplate } from './whatsapp/mockData';
import { MOCK_WHATSAPP_TEMPLATES } from './whatsapp/mockData';
import {
  loadWhatsAppCloudAccounts,
  type WhatsAppCloudAccount,
} from './mockWhatsappIntegrations';

export const WHATSAPP_TEMPLATES_CHANGED = 'whatsapp-templates-changed';
export const WABA_CLIENTES_ID = '1552822609132164';
/** WABA demo Finanzas (catálogo reducido). */
export const WABA_FINANZAS_ID = '1552822609132165';

const TEMPLATE_CACHE_KEY = 'marketing_whatsapp_templates_by_waba_v1';
const ACTIVE_CHANNEL_KEY = 'marketing_whatsapp_active_channel_v1';

const FINANZAS_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl-fin-1',
    name: 'Recordatorio de factura',
    category: 'utility',
    language: 'es',
    body: 'Hola {{1}}, la factura {{2}} por S/ {{3}} vence el {{4}}. Puedes pagar en nuestra web.',
    sampleVariables: ['Nombre', 'N° factura', 'Monto', 'Fecha'],
    status: 'approved',
    qualityRating: 'alta',
    buttons: [{ type: 'url', text: 'Pagar ahora', url: 'https://taximonterrico.com/pagos' }],
    createdAt: '2026-07-01',
  },
  {
    id: 'tpl-fin-2',
    name: 'Comprobante enviado',
    category: 'utility',
    language: 'es',
    body: 'Hola {{1}}, enviamos tu comprobante {{2}} al correo registrado. Revisa spam si no lo ves.',
    sampleVariables: ['Nombre', 'Comprobante'],
    status: 'approved',
    qualityRating: 'alta',
    buttons: [],
    createdAt: '2026-06-15',
  },
  {
    id: 'tpl-fin-3',
    name: 'Aviso de mora',
    category: 'marketing',
    language: 'es',
    body: 'Hola {{1}}, tu cuenta tiene un saldo pendiente de S/ {{2}}. Contáctanos para regularizar.',
    sampleVariables: ['Nombre', 'Saldo'],
    status: 'approved',
    qualityRating: 'media',
    buttons: [{ type: 'quick_reply', text: 'Quiero pagar' }],
    createdAt: '2026-05-20',
  },
];

const GENERIC_WABA_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl-gen-1',
    name: 'Saludo inicial',
    category: 'utility',
    language: 'es',
    body: 'Hola {{1}}, gracias por contactar a {{2}}. En breve te atenderemos.',
    sampleVariables: ['Nombre', 'Empresa'],
    status: 'approved',
    qualityRating: 'media',
    buttons: [],
    createdAt: '2026-08-01',
  },
  {
    id: 'tpl-gen-2',
    name: 'Promoción general',
    category: 'marketing',
    language: 'es',
    body: 'Hola {{1}}, tenemos una novedad para ti: {{2}}.',
    sampleVariables: ['Nombre', 'Oferta'],
    status: 'pending',
    qualityRating: 'media',
    buttons: [],
    createdAt: '2026-08-10',
  },
];

const CLIENTES_EXTRA: WhatsAppTemplate = {
  id: 'tpl-meta-bienvenida',
  name: 'mensaje_bienvenida',
  category: 'utility',
  language: 'es_PE',
  body:
    'Hola, {{name_user}}. Somos *Taxi Monterrico*. Nos comunicamos con usted para realizar coordinaciones relacionadas con su servicio *#{{reservation_id}}*.\n\n*Fecha:* {{reservation_date}}\n*Hora:* {{reservation_time}}\n*Origen:* {{route_origin}}',
  sampleVariables: ['name_user', 'reservation_id', 'reservation_date', 'reservation_time', 'route_origin'],
  parameterFormat: 'named',
  status: 'approved',
  qualityRating: 'alta',
  buttons: [],
  createdAt: '2026-08-20',
};

function readCache(): Record<string, WhatsAppTemplate[]> {
  try {
    const raw = localStorage.getItem(TEMPLATE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, WhatsAppTemplate[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, WhatsAppTemplate[]>) {
  localStorage.setItem(TEMPLATE_CACHE_KEY, JSON.stringify(cache));
}

function dispatchTemplatesChanged() {
  window.dispatchEvent(new CustomEvent(WHATSAPP_TEMPLATES_CHANGED));
}

export function getCatalogForWaba(wabaId: string): WhatsAppTemplate[] {
  if (wabaId === WABA_CLIENTES_ID) {
    return [CLIENTES_EXTRA, ...MOCK_WHATSAPP_TEMPLATES];
  }
  if (wabaId === WABA_FINANZAS_ID) {
    return [...FINANZAS_TEMPLATES];
  }
  return [...GENERIC_WABA_TEMPLATES];
}

export function getDefaultWhatsAppAccount(): WhatsAppCloudAccount | null {
  const accounts = loadWhatsAppCloudAccounts().filter((a) => a.active);
  return accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;
}

export function getActiveChannelAccountId(): string | null {
  const accounts = loadWhatsAppCloudAccounts().filter((a) => a.active);
  if (accounts.length === 0) return null;

  const stored = localStorage.getItem(ACTIVE_CHANNEL_KEY);
  if (stored && accounts.some((a) => a.id === stored)) {
    return stored;
  }

  return getDefaultWhatsAppAccount()?.id ?? accounts[0]?.id ?? null;
}

export function setActiveChannelAccountId(accountId: string) {
  localStorage.setItem(ACTIVE_CHANNEL_KEY, accountId);
  dispatchTemplatesChanged();
}

export function getAccountById(accountId: string): WhatsAppCloudAccount | undefined {
  return loadWhatsAppCloudAccounts().find((a) => a.id === accountId);
}

export function loadTemplatesForWaba(wabaId: string): WhatsAppTemplate[] {
  const cache = readCache();
  if (cache[wabaId]?.length) {
    return cache[wabaId];
  }
  const catalog = getCatalogForWaba(wabaId);
  writeCache({ ...cache, [wabaId]: catalog });
  return catalog;
}

export function loadTemplatesForAccount(accountId: string): WhatsAppTemplate[] {
  const account = getAccountById(accountId);
  if (!account) return [];
  return loadTemplatesForWaba(account.wabaId);
}

export function saveTemplatesForWaba(wabaId: string, templates: WhatsAppTemplate[]) {
  const cache = readCache();
  cache[wabaId] = templates;
  writeCache(cache);
  dispatchTemplatesChanged();
}

export function saveTemplatesForAccount(accountId: string, templates: WhatsAppTemplate[]) {
  const account = getAccountById(accountId);
  if (!account) return;
  saveTemplatesForWaba(account.wabaId, templates);
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Simula GET /{WABA_ID}/message_templates desde Graph. */
export async function mockSyncTemplatesFromMeta(wabaId: string): Promise<WhatsAppTemplate[]> {
  await delay(900);
  const fresh = getCatalogForWaba(wabaId);
  saveTemplatesForWaba(wabaId, fresh);
  return fresh;
}

export function countTemplatesByStatus(templates: WhatsAppTemplate[]) {
  return {
    total: templates.length,
    approved: templates.filter((t) => t.status === 'approved').length,
    marketing: templates.filter((t) => t.category === 'marketing').length,
    utility: templates.filter((t) => t.category === 'utility').length,
  };
}
