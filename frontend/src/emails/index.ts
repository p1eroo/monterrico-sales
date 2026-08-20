import type { CampaignMessageTemplate } from '@/types';
import { aeropuertoEjecutivoDoc, AEROPUERTO_SUBJECT } from './templates/aeropuertoEjecutivo';
import {
  PRESENTACION_SUBJECT,
  presentacionCorporativaDoc,
} from './templates/presentacionCorporativa';

export { BRAND, EMAIL_ASSETS } from './brand';

export const designEmailTemplates: CampaignMessageTemplate[] = [
  {
    id: 'design-presentacion-corporativa',
    name: 'Presentación corporativa',
    subject: PRESENTACION_SUBJECT,
    body: '<p>Hola {{nombre}}. Movilidad corporativa de confianza para {{empresa}}.</p>',
    channel: 'email',
    createdAt: '2026-08-20',
    editorJson: presentacionCorporativaDoc as Record<string, unknown>,
  },
  {
    id: 'design-aeropuerto-ejecutivo',
    name: 'Aeropuerto ejecutivo',
    subject: AEROPUERTO_SUBJECT,
    body: '<p>Hola {{nombre}}. Traslados al aeropuerto para {{empresa}}, sin imprevistos.</p>',
    channel: 'email',
    createdAt: '2026-08-20',
    editorJson: aeropuertoEjecutivoDoc as Record<string, unknown>,
  },
];
