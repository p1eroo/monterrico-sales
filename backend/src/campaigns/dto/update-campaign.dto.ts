/** Actualización parcial de borrador (no enviadas) */
export class UpdateCampaignDto {
  name?: string;
  status?: string;
  channel?: string;
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
