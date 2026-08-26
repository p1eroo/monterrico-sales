export type WhatsAppTemplateCategory = 'marketing' | 'utility' | 'authentication';

export interface WhatsAppEstimatedCost {
  /** Mensajes aceptados por Meta (status sent). Los fallidos no cuentan. */
  billableCount: number;
  amountPen: number;
  ratePen: number;
  templateCategory: WhatsAppTemplateCategory;
  currency: 'PEN';
}

/** Tarifas Meta Perú (USD), julio 2025 — https://developers.facebook.com/docs/whatsapp/pricing */
const DEFAULT_RATES_USD: Record<WhatsAppTemplateCategory, number> = {
  marketing: 0.0703,
  utility: 0.0200,
  authentication: 0.0200,
};

function parseCategory(raw: string): WhatsAppTemplateCategory {
  const v = raw.toLowerCase();
  if (v === 'marketing') return 'marketing';
  if (v === 'authentication') return 'authentication';
  return 'utility';
}

function ratePenForCategory(category: WhatsAppTemplateCategory): number {
  const penEnv = process.env[`WHATSAPP_META_RATE_${category.toUpperCase()}_PEN`];
  if (penEnv) {
    const parsed = Number.parseFloat(penEnv);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }

  const usdEnv = process.env[`WHATSAPP_META_RATE_${category.toUpperCase()}_USD`];
  const usd = usdEnv
    ? Number.parseFloat(usdEnv)
    : DEFAULT_RATES_USD[category];
  const fx = Number.parseFloat(process.env.WHATSAPP_USD_TO_PEN ?? '3.75');
  const safeUsd = Number.isFinite(usd) && usd >= 0 ? usd : DEFAULT_RATES_USD[category];
  const safeFx = Number.isFinite(fx) && fx > 0 ? fx : 3.75;
  return Math.round(safeUsd * safeFx * 10000) / 10000;
}

/** Estima costo según tarifas Meta; solo cuenta envíos exitosos (`sent`). */
export function estimateWhatsAppCampaignCost(
  sentCount: number,
  templateCategory: string,
): WhatsAppEstimatedCost {
  const category = parseCategory(templateCategory);
  const ratePen = ratePenForCategory(category);
  const billableCount = Math.max(0, Math.floor(sentCount));
  const amountPen = Math.round(billableCount * ratePen * 100) / 100;

  return {
    billableCount,
    amountPen,
    ratePen,
    templateCategory: category,
    currency: 'PEN',
  };
}
