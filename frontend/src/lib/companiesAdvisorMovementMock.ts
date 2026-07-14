import {
  buildAdvisorFunnelMovementBundle,
  type AdvisorFunnelMovementBundle,
  type CompaniesAdvisorFunnelMovementApi,
} from '@/lib/companiesAdvisorMovement';

/** Datos de ejemplo hasta conectar `companiesAdvisorFunnelMovement` del API. */
const MOCK_ADVISOR_FUNNEL_API: CompaniesAdvisorFunnelMovementApi = {
  currentWeekLabel: 'W29',
  periods: [
    {
      fromWeekNumber: 27,
      toWeekNumber: 28,
      fromWeekLabel: 'W27',
      toWeekLabel: 'W28',
      title: 'Movimiento del funnel — Semana 27 a Semana 28',
      advisors: [
        {
          id: 'mock-advisor-1',
          name: 'Ana García',
          activeProspects: 48,
          metrics: { nuevoIngreso: 6, avance: 9, atraso: 2, sinCambios: 31 },
        },
      ],
    },
  ],
};

export function getMockAdvisorFunnelMovement(): AdvisorFunnelMovementBundle {
  return buildAdvisorFunnelMovementBundle(MOCK_ADVISOR_FUNNEL_API);
}
