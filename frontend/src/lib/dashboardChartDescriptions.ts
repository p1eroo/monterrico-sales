export const dashboardKpiDescriptions = {
  totalContacts:
    'Contactos creados en el periodo filtrado (fecha de creación), según asesores y fuente seleccionados. La variación compara los últimos 7 días con los 7 días anteriores.',
  activeOpportunities:
    'Oportunidades creadas en el periodo que siguen en curso en el pipeline comercial. La variación compara los últimos 7 días con los 7 días anteriores.',
  closedSales:
    'Suma del monto de oportunidades ganadas en etapa Activo con fecha de cierre en el periodo. La variación compara los últimos 7 días con los 7 días anteriores.',
} as const;

export const dashboardChartDescriptions = {
  teamGoals:
    'Meta comercial asignada frente al avance real del equipo (ventas cerradas), agrupado por semana o mes.',
  myGoals:
    'Meta comercial asignada frente a tu avance real (ventas cerradas), agrupado por semana o mes.',
  opportunitiesBySource:
    'Oportunidades creadas en el periodo que están en etapas activas del pipeline (10%–100%), agrupadas por fuente de origen.',
  salesFunnel:
    'Oportunidades creadas en el periodo que siguen en curso, distribuidas por etapa activa del pipeline (10%–100%).',
  companies:
    'Empresas de la cartera clasificadas por semana según movimiento de etapa: avance, ingreso nuevo, atraso o sin cambios.',
  activities:
    'Interacciones completadas (llamadas, reuniones, correos y notas) por tipo y semana dentro del periodo filtrado.',
  tasks:
    'Tareas completadas por tipo (llamada, reunión, correo, WhatsApp) y semana dentro del periodo filtrado.',
} as const;

export const reportsKpiDescriptions = {
  contactsCreated:
    'Contactos creados en el rango de fechas filtrado, según asesores y fuente seleccionados.',
  wonInPeriod:
    'Cantidad de oportunidades ganadas en etapa Activo con fecha de cierre en el periodo. Es un conteo, no un porcentaje de conversión.',
  closedSales: dashboardKpiDescriptions.closedSales,
  tasksCompleted:
    'Tareas con fecha de completado dentro del periodo filtrado, según asesores seleccionados.',
} as const;

export const reportsChartDescriptions = {
  activeProspects:
    'Empresas creadas en el año en curso en etapas de prospecto (10%–100%), con distribución semanal en las últimas 6 semanas.',
  advancedContacts:
    'Empresas creadas en el año en etapas avanzadas del pipeline (30%–100%), con evolución semanal en las últimas 6 semanas.',
  estimatedBilling:
    'Suma de facturación estimada de empresas creadas en el año que están en etapas 10%–100%, con tendencia en las últimas 6 semanas.',
  companiesByStage:
    'Embudo de empresas en etapas de prospecto activas (10%–100%) al cierre de la última semana del periodo, según la cartera filtrada.',
  companiesWeekly: dashboardChartDescriptions.companies,
  contactsOpportunities:
    'Evolución mensual de contactos y oportunidades creados en el periodo filtrado, agrupados por mes.',
  sourcesByEntity:
    'Empresas del año en curso en etapas activas (10%–100%), acumuladas por fuente de origen en las últimas 6 semanas.',
  activities: dashboardChartDescriptions.activities,
  tasks: dashboardChartDescriptions.tasks,
} as const;
