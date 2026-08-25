/** Actualización parcial de borrador (no enviadas) */
export class UpdateCampaignDto {
  name?: string;
  status?: string;
  channel?: string;
  /** Área propietaria. Normalmente no se cambia; se respeta la del registro. */
  area?: 'comercial' | 'marketing';
  message?: Record<string, unknown>;
  recipients?: unknown[];
  subjectSnapshot?: string | null;
  results?: unknown[];
  sentCount?: number;
  deliveredCount?: number;
  openedCount?: number;
  clickedCount?: number;
  failedCount?: number;
  bounceCount?: number;
  relatedContactIds?: string[];
  sentAt?: string;
}
