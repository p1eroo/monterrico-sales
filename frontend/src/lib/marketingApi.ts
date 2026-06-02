import { api } from '@/lib/api';

export interface MarketingLead {
  id: string;
  source: 'facebook' | 'tiktok';
  fullName: string;
  phone: string;
  email: string;
  campaignName: string;
  formId: string;
  createdAt: string;
}

export interface MarketingIntegration {
  id: string;
  name: string;
  icon: string;
  status: 'active' | 'inactive' | 'coming_soon';
  campaigns: { id: string; name: string; status: 'active' | 'inactive'; leads: number }[];
  webhookUrl?: string;
}

export async function fetchLeads(params?: { page?: number; campaign?: string }): Promise<{ data: MarketingLead[]; total: number }> {
  const mockLeads: MarketingLead[] = [
    { id: '1', source: 'facebook', fullName: 'Carlos Mendoza', phone: '51999888111', email: 'carlos@email.com', campaignName: 'Activación Bono', formId: 'form-1', createdAt: '2026-06-01T10:30:00Z' },
    { id: '2', source: 'facebook', fullName: 'María López', phone: '51999888222', email: 'maria@email.com', campaignName: 'Captación Leads', formId: 'form-2', createdAt: '2026-06-01T11:00:00Z' },
    { id: '3', source: 'facebook', fullName: 'Pedro García', phone: '51999888333', email: 'pedro@email.com', campaignName: 'Activación Bono', formId: 'form-1', createdAt: '2026-05-31T15:20:00Z' },
    { id: '4', source: 'facebook', fullName: 'Ana Torres', phone: '51999888444', email: 'ana@email.com', campaignName: 'Recordatorio', formId: 'form-3', createdAt: '2026-05-30T09:15:00Z' },
    { id: '5', source: 'facebook', fullName: 'Luis Fernández', phone: '51999888555', email: 'luis@email.com', campaignName: 'Captación Leads', formId: 'form-2', createdAt: '2026-05-29T14:00:00Z' },
    { id: '6', source: 'facebook', fullName: 'Rosa Martínez', phone: '51999888666', email: 'rosa@email.com', campaignName: 'Activación Bono', formId: 'form-1', createdAt: '2026-05-28T16:45:00Z' },
    { id: '7', source: 'facebook', fullName: 'Jorge Castillo', phone: '51999888777', email: 'jorge@email.com', campaignName: 'Oferta Especial', formId: 'form-4', createdAt: '2026-05-27T12:00:00Z' },
    { id: '8', source: 'facebook', fullName: 'Sofía Vega', phone: '51999888888', email: 'sofia@email.com', campaignName: 'Activación Bono', formId: 'form-1', createdAt: '2026-05-26T08:30:00Z' },
    { id: '9', source: 'facebook', fullName: 'Diego Rojas', phone: '51999888999', email: 'diego@email.com', campaignName: 'Captación Leads', formId: 'form-2', createdAt: '2026-05-25T17:00:00Z' },
    { id: '10', source: 'facebook', fullName: 'Valeria Paredes', phone: '51999888000', email: 'valeria@email.com', campaignName: 'Recordatorio', formId: 'form-3', createdAt: '2026-05-24T14:20:00Z' },
    { id: '11', source: 'facebook', fullName: 'Andrés Salazar', phone: '51999888011', email: 'andres@email.com', campaignName: 'Oferta Especial', formId: 'form-4', createdAt: '2026-05-23T11:10:00Z' },
    { id: '12', source: 'facebook', fullName: 'Camila Núñez', phone: '51999888022', email: 'camila@email.com', campaignName: 'Activación Bono', formId: 'form-1', createdAt: '2026-05-22T09:45:00Z' },
    { id: '13', source: 'facebook', fullName: 'Fernando Guerra', phone: '51999888033', email: 'fernando@email.com', campaignName: 'Captación Leads', formId: 'form-2', createdAt: '2026-05-21T16:30:00Z' },
    { id: '14', source: 'facebook', fullName: 'Gabriela Ríos', phone: '51999888044', email: 'gabriela@email.com', campaignName: 'Recordatorio', formId: 'form-3', createdAt: '2026-05-20T13:00:00Z' },
  ];

  let filtered = [...mockLeads];
  if (params?.campaign) {
    filtered = filtered.filter((l) => l.campaignName === params.campaign);
  }
  return { data: filtered, total: filtered.length };
}

export async function fetchIntegrations(): Promise<MarketingIntegration[]> {
  return [
    {
      id: 'facebook',
      name: 'Facebook',
      icon: 'facebook',
      status: 'active',
      webhookUrl: `${window.location.origin}/api/leads/import`,
      campaigns: [
        { id: 'camp-1', name: 'Activación Bono', status: 'active', leads: 34 },
        { id: 'camp-2', name: 'Captación Leads', status: 'active', leads: 18 },
        { id: 'camp-3', name: 'Recordatorio', status: 'inactive', leads: 0 },
      ],
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: 'tiktok',
      status: 'coming_soon',
      campaigns: [],
    },
  ];
}
