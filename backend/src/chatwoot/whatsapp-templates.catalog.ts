export type WhatsappTemplateKind = 'standard' | 'flow';

export interface WhatsappTemplateDefinition {
  name: string;
  language: string;
  category: string;
  content: string;
  kind?: WhatsappTemplateKind;
  /** Plantillas con WhatsApp Flow no son enviables vía API de Chatwoot. */
  apiSendable?: boolean;
}

/** Plantillas aprobadas en la bandeja flota de Chatwoot / WhatsApp Business. */
export const FLOTA_WHATSAPP_TEMPLATES: WhatsappTemplateDefinition[] = [
  {
    name: 'afiliacion_atu',
    language: 'es_PE',
    category: 'UTILITY',
    kind: 'standard',
    apiSendable: true,
    content:
      'Hola estimado(a), reciba un cordial saludo de parte de Taxi Monterrico.\n\nHemos observado su interés en formar parte de nuestra flota.\n¿usted cuenta con vehiculo particular o tiene permiso de la ATU?',
  },
  {
    name: 'flota_afiliaciones',
    language: 'es_PE',
    category: 'MARKETING',
    kind: 'standard',
    apiSendable: true,
    content:
      '¡Hola! Completé el formulario y me gustaría obtener más información sobre tu negocio.',
  },
  {
    name: 'solicitar_taxi_flow',
    language: 'es',
    category: 'UTILITY',
    kind: 'flow',
    apiSendable: false,
    content:
      'Hola, solicita tu taxi con Taxi Monterrico en segundos. Toca el boton para comenzar.',
  },
  {
    name: 'si_atu',
    language: 'es_PE',
    category: 'MARKETING',
    kind: 'standard',
    apiSendable: true,
    content:
      'Perfecto, te comento que estamos dando un bono de 500 soles, por realizar servicios de lunes a viernes de 9 am hasta máximo 4 pm, cuentas con esa disponibilidad.',
  },
  {
    name: 'no_atu',
    language: 'es_PE',
    category: 'UTILITY',
    kind: 'standard',
    apiSendable: true,
    content:
      'Te informamos que se encuentra en pausa la afiliación de vehículos con placa particular, ya que actualmente estamos incorporando únicamente unidades que cuentan con autorización y permiso vigente de la ATU para la prestación de servicios a entidades del Estado. Agradecemos tu interés y, apenas se reabra la convocatoria para vehículos particulares, nos estaremos comunicando contigo a la brevedad.',
  },
];

/** Chatwoot/Meta son sensibles a mayúsculas en el código de idioma. */
export function normalizeTemplateLanguage(language: string): string {
  return language.trim().toLowerCase();
}

export function resolveWhatsappTemplate(
  name: string | undefined,
): WhatsappTemplateDefinition | undefined {
  if (!name?.trim()) return undefined;
  return FLOTA_WHATSAPP_TEMPLATES.find((t) => t.name === name);
}

export function isTemplateApiSendable(name: string | undefined): boolean {
  const tpl = resolveWhatsappTemplate(name);
  if (!tpl) return true;
  return tpl.apiSendable !== false;
}

export function buildTemplateProcessedParams(
  template: WhatsappTemplateDefinition,
): Record<string, unknown> {
  if (template.kind === 'flow') {
    return {};
  }
  return {};
}

export function mergeWhatsappTemplateLists(
  remote: WhatsappTemplateDefinition[],
): WhatsappTemplateDefinition[] {
  const byName = new Map<string, WhatsappTemplateDefinition>();
  for (const t of FLOTA_WHATSAPP_TEMPLATES) {
    byName.set(t.name, { ...t });
  }
  for (const t of remote) {
    if (!t.name) continue;
    const existing = byName.get(t.name);
    const isFlow = existing?.kind === 'flow' || t.name.endsWith('_flow');
    byName.set(t.name, {
      name: t.name,
      language: t.language || existing?.language || 'es_PE',
      category: t.category || existing?.category || 'UTILITY',
      content: t.content?.trim() || existing?.content || '',
      kind: isFlow ? 'flow' : (existing?.kind ?? 'standard'),
      apiSendable: isFlow ? false : (existing?.apiSendable ?? true),
    });
  }
  const order = FLOTA_WHATSAPP_TEMPLATES.map((t) => t.name);
  const extra = [...byName.keys()].filter((n) => !order.includes(n));
  return [...order, ...extra]
    .map((name) => byName.get(name))
    .filter((t): t is WhatsappTemplateDefinition => Boolean(t));
}
