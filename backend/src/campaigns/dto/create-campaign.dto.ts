/** Cuerpo para persistir campaña: en `sent` solo métricas + resultados + subjectSnapshot (sin cuerpo ni lista en BD). */
export class CreateCampaignDto {
  name!: string;
  status!: string;
  channel!: string;
  /** Obligatorio salvo status `sent` (ahí puede ir mínimo). */
  message?: Record<string, unknown>;
  /** Obligatorio salvo `sent` (destinatarios inferidos por resultados). */
  recipients?: unknown[];
  /** Asunto para histórico cuando no se guarda message completo (máx. 500 caracteres). */
  subjectSnapshot?: string;
  results?: unknown[];
  sentCount?: number;
  deliveredCount?: number;
  openedCount?: number;
  clickedCount?: number;
  failedCount?: number;
  bounceCount?: number;
  relatedContactIds?: string[];
  /** ISO 8601 */
  sentAt?: string;
}
