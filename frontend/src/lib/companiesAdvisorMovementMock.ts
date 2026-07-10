import {
  buildAdvisorFunnelMovementView,
  type AdvisorFunnelMovementSnapshot,
  type CompaniesAdvisorFunnelMovementApi,
} from '@/lib/companiesAdvisorMovement';

/** Datos de ejemplo hasta conectar `companiesAdvisorFunnelMovement` del API. */
const MOCK_ADVISOR_FUNNEL_API: CompaniesAdvisorFunnelMovementApi = {
  fromWeekNumber: 26,
  toWeekNumber: 27,
  fromWeekLabel: 'W26',
  toWeekLabel: 'W27',
  currentWeekLabel: 'W27',
  title: 'Movimiento del funnel',
  advisors: [
    {
      id: 'mock-advisor-1',
      name: 'Ana García',
      activeProspects: 48,
      metrics: { nuevoIngreso: 6, avance: 9, atraso: 2, sinCambios: 31 },
    },
    {
      id: 'mock-advisor-2',
      name: 'Carlos Mendoza',
      activeProspects: 35,
      metrics: { nuevoIngreso: 4, avance: 5, atraso: 3, sinCambios: 23 },
    },
    {
      id: 'mock-advisor-3',
      name: 'Lucía Torres',
      activeProspects: 29,
      metrics: { nuevoIngreso: 3, avance: 4, atraso: 1, sinCambios: 21 },
    },
  ],
};

export function getMockAdvisorFunnelMovement(): AdvisorFunnelMovementSnapshot {
  return buildAdvisorFunnelMovementView(MOCK_ADVISOR_FUNNEL_API);
}
