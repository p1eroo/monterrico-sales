import type { ImportJob } from '@/lib/importExportApi';

export type MockImportScenario =
  | 'completed_clean'
  | 'completed_with_row_errors'
  | 'failed';

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Jobs de importación ficticios para previsualizar `ImportJobsPanel` / toasts en desarrollo.
 */
export function createMockImportJob(scenario: MockImportScenario): ImportJob {
  const t = isoNow();
  const id = `mock-import-${scenario}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  if (scenario === 'failed') {
    return {
      id,
      entity: 'contacts',
      filename: 'contactos-mal-formateados.xlsx',
      status: 'failed',
      totalRows: 84,
      processedRows: 31,
      created: 0,
      skipped: 0,
      errorCount: 53,
      percent: 37,
      startedAt: t,
      updatedAt: t,
      finishedAt: t,
      errorMessage:
        'El proceso se detuvo: cabeceras obligatorias ausentes (doc_numero, valor_estimado). Revisa la plantilla y vuelve a intentar.',
    };
  }

  if (scenario === 'completed_with_row_errors') {
    return {
      id,
      entity: 'companies',
      filename: 'empresas-abril-2026.xlsx',
      status: 'completed',
      totalRows: 156,
      processedRows: 156,
      created: 141,
      skipped: 11,
      errorCount: 4,
      percent: 100,
      startedAt: t,
      updatedAt: t,
      finishedAt: t,
      result: {
        totalRows: 156,
        created: 141,
        skipped: 11,
        errors: [
          {
            row: 8,
            name: 'Logística del Sur S.A.C.',
            message: 'RUC con formato inválido (debe tener 11 dígitos)',
          },
          {
            row: 22,
            name: 'Agunsa Perú',
            message: 'Razón social duplicada respecto a fila 5',
          },
          {
            row: 94,
            name: 'Minería Andina',
            message: 'Rubro no reconocido en el catálogo',
          },
          {
            row: 151,
            name: 'Retail Norte',
            message: 'Celda vacía: nombre comercial',
          },
        ],
      },
    };
  }

  return {
    id,
    entity: 'opportunities',
    filename: 'pipeline-q2-import.xlsx',
    status: 'completed',
    totalRows: 48,
    processedRows: 48,
    created: 48,
    skipped: 0,
    errorCount: 0,
    percent: 100,
    startedAt: t,
    updatedAt: t,
    finishedAt: t,
    result: {
      totalRows: 48,
      created: 48,
      skipped: 0,
      errors: [],
    },
  };
}
