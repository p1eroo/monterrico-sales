/**
 * Mock local de cuentas WhatsApp Cloud API (Meta Graph).
 * Persiste en localStorage hasta conectar el backend.
 */

import { setActiveChannelAccountId, WABA_FINANZAS_ID } from './mockWhatsappTemplateSync';

export type WhatsAppCloudAccount = {
  id: string;
  displayName: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  isDefault: boolean;
  active: boolean;
  templateCount: number;
  approvedCount: number;
  marketingCount: number;
  utilityCount: number;
  lastSyncedAt: string | null;
  graphApiVersion: string;
  hasToken: boolean;
};

export type ConnectWhatsAppCloudDto = {
  displayName: string;
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  graphApiVersion: string;
  setAsDefault: boolean;
};

export type UpdateWhatsAppTokenDto = {
  id: string;
  accessToken: string;
};

const STORAGE_KEY = 'marketing_whatsapp_cloud_accounts_v1';

export const WHATSAPP_CLOUD_ACCOUNTS_CHANGED = 'whatsapp-cloud-accounts-changed';

export const MOCK_WHATSAPP_CLOUD_SEED: WhatsAppCloudAccount[] = [
  {
    id: 'wa-clientes',
    displayName: 'Taxi Monterrico Clientes',
    wabaId: '1552822609132164',
    phoneNumberId: '1270855672775899',
    displayPhoneNumber: '+51 999 123 456',
    verifiedName: 'Taxi Monterrico',
    isDefault: true,
    active: true,
    templateCount: 12,
    approvedCount: 11,
    marketingCount: 8,
    utilityCount: 4,
    lastSyncedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    graphApiVersion: 'v22.0',
    hasToken: true,
  },
  {
    id: 'wa-finanzas',
    displayName: 'Taxi Monterrico Finanzas',
    wabaId: '1552822609132165',
    phoneNumberId: '1270855672775890',
    displayPhoneNumber: '+51 988 654 321',
    verifiedName: 'Taxi Monterrico Finanzas',
    isDefault: false,
    active: true,
    templateCount: 3,
    approvedCount: 3,
    marketingCount: 1,
    utilityCount: 2,
    lastSyncedAt: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString(),
    graphApiVersion: 'v22.0',
    hasToken: true,
  },
];

function readStored(): WhatsAppCloudAccount[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WhatsAppCloudAccount[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(accounts: WhatsAppCloudAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  window.dispatchEvent(new CustomEvent(WHATSAPP_CLOUD_ACCOUNTS_CHANGED));
}

export function loadWhatsAppCloudAccounts(): WhatsAppCloudAccount[] {
  const accounts = readStored() ?? MOCK_WHATSAPP_CLOUD_SEED;
  const migrated = accounts.map((a) => {
    if (a.id === 'wa-finanzas' && a.wabaId === '1552822609132164') {
      return {
        ...a,
        wabaId: WABA_FINANZAS_ID,
        templateCount: 3,
        approvedCount: 3,
        marketingCount: 1,
        utilityCount: 2,
      };
    }
    return a;
  });
  if (readStored() && JSON.stringify(migrated) !== JSON.stringify(accounts)) {
    writeStored(migrated);
  }
  return migrated;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function mockPhoneFromId(phoneNumberId: string): string {
  const tail = phoneNumberId.slice(-4);
  return `+51 9${tail.slice(0, 2)} ${tail.slice(2)} …`;
}

export async function mockTestWhatsAppConnection(
  dto: Pick<ConnectWhatsAppCloudDto, 'wabaId' | 'accessToken'>,
): Promise<{ ok: true; templateCount: number; approvedCount: number }> {
  await delay(650);
  if (!dto.wabaId.trim() || !dto.accessToken.trim()) {
    throw new Error('WABA ID y token son obligatorios');
  }
  if (dto.accessToken.length < 20) {
    throw new Error('Token inválido o demasiado corto');
  }
  const seed = dto.wabaId === '1552822609132164' ? 12 : dto.wabaId === '1552822609132165' ? 3 : 4;
  return { ok: true, templateCount: seed, approvedCount: seed - 1 };
}

export async function mockConnectWhatsAppCloud(dto: ConnectWhatsAppCloudDto): Promise<WhatsAppCloudAccount> {
  const test = await mockTestWhatsAppConnection(dto);
  const accounts = loadWhatsAppCloudAccounts();
  const nextDefault = dto.setAsDefault || accounts.length === 0;
  const normalized = accounts.map((a) => (nextDefault ? { ...a, isDefault: false } : a));

  const account: WhatsAppCloudAccount = {
    id: `wa-${Date.now()}`,
    displayName: dto.displayName.trim(),
    wabaId: dto.wabaId.trim(),
    phoneNumberId: dto.phoneNumberId.trim(),
    displayPhoneNumber: mockPhoneFromId(dto.phoneNumberId.trim()),
    verifiedName: dto.displayName.trim(),
    isDefault: nextDefault,
    active: true,
    templateCount: test.templateCount,
    approvedCount: test.approvedCount,
    marketingCount: Math.max(1, Math.floor(test.approvedCount * 0.6)),
    utilityCount: Math.max(1, test.approvedCount - Math.floor(test.approvedCount * 0.6)),
    lastSyncedAt: new Date().toISOString(),
    graphApiVersion: dto.graphApiVersion.trim() || 'v22.0',
    hasToken: true,
  };

  writeStored([...normalized, account]);
  if (nextDefault) {
    setActiveChannelAccountId(account.id);
  }
  return account;
}

export async function mockUpdateWhatsAppToken(dto: UpdateWhatsAppTokenDto): Promise<void> {
  await delay(400);
  if (!dto.accessToken.trim()) throw new Error('Ingresa el token');
  const accounts = loadWhatsAppCloudAccounts().map((a) =>
    a.id === dto.id ? { ...a, hasToken: true, lastSyncedAt: new Date().toISOString() } : a,
  );
  writeStored(accounts);
}

export async function mockSyncWhatsAppTemplates(id: string): Promise<WhatsAppCloudAccount> {
  await delay(800);
  const accounts = loadWhatsAppCloudAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error('Cuenta no encontrada');
  const current = accounts[idx];
  const bump = Math.random() > 0.7 ? 1 : 0;
  const updated: WhatsAppCloudAccount = {
    ...current,
    templateCount: current.templateCount + bump,
    approvedCount: current.approvedCount + bump,
    lastSyncedAt: new Date().toISOString(),
  };
  accounts[idx] = updated;
  writeStored(accounts);
  return updated;
}

export function mockSetDefaultWhatsAppAccount(id: string): WhatsAppCloudAccount[] {
  const accounts = loadWhatsAppCloudAccounts().map((a) => ({
    ...a,
    isDefault: a.id === id,
  }));
  writeStored(accounts);
  setActiveChannelAccountId(id);
  return accounts;
}

export function mockDisconnectWhatsAppAccount(id: string): WhatsAppCloudAccount[] {
  let accounts = loadWhatsAppCloudAccounts().filter((a) => a.id !== id);
  if (accounts.length > 0 && !accounts.some((a) => a.isDefault)) {
    accounts = accounts.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a));
  }
  writeStored(accounts);
  return accounts;
}

export function formatRelativeSync(iso: string | null): string {
  if (!iso) return 'Nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}
