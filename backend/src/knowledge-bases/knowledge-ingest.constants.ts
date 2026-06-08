/**
 * Límite previsto por archivo en «Subir archivos» (aún no implementado en API).
 * Usar en el endpoint de multipart cuando exista.
 */
export const MAX_KNOWLEDGE_UPLOAD_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Valores por defecto alineados con el formulario de Agentes IA. */
export const DEFAULT_CHUNK_SIZE_TOKENS = 400;
export const DEFAULT_OVERLAP_TOKENS = 64;
