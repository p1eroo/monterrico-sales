/** Cuerpo JSON para alta de base de conocimiento (Agentes IA). */
export class CreateKnowledgeBaseDto {
  title!: string;
  type?: string;
  /** text_only | upload | url | existing */
  sourceMode!: string;
  /** Texto completo, notas o descripción compuesta (sin secretos). */
  description!: string;
  /** Tamaño de fragmento en tokens (p. ej. 400). */
  chunkSize?: number;
  /** Solapamiento en tokens (p. ej. 64). */
  overlap?: number;
  linkedAgentId?: string | null;
  linkedAgentName?: string | null;
  /**
   * Metadatos opcionales: endpoint, method, authType (none|bearer|apikey),
   * apiKeyHeader, postBody (solo si no contiene secretos), scope CRM, etc.
   */
  source?: Record<string, unknown>;
}
