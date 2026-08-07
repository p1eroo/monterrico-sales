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
    'Interacciones completadas (llamadas, reuniones y correos) por tipo y semana dentro del periodo filtrado.',
  tasks:
    'Tareas completadas por tipo (llamada, reunión y correo) y semana dentro del periodo filtrado.',
} as const;

export const flotaDashboardKpiDescriptions = {
  nuevosProspectos:
    'Prospectos de flota registrados en el mes en curso, comparado con el mes anterior.',
  contactados:
    'Prospectos que ya fueron contactados (total menos nuevos sin contactar y afiliados).',
  sinContactar:
    'Prospectos en estado Nuevo que aún no han sido contactados.',
  conductoresActivos:
    'Conductores con estado ACTIVO o DISPONIBLE en la flota.',
} as const;

export const flotaDashboardChartDescriptions = {
  nuevosConductores:
    'Altas de conductores agrupadas por semana según fecha de registro. Activos: conductores no retirados. Nuevos: total de altas en la semana. Respeta el rango de fechas seleccionado.',
  sunatGestion:
    'Servicios de clientes SUNAT e Intendencia Lima en el periodo. Barras: servicios por día. Línea: conductores únicos autorizados (móvil con prefijo 0S, 1S, 3S, 5S o 9S). Las métricas inferiores resumen el rango filtrado.',
  prospectosRecientes:
    'Los cinco prospectos de flota más recientes por fecha de registro. Haz clic en una fila para abrir su ficha.',
  distribucionEstado:
    'Composición de prospectos por estado actual. Tasa de afiliación: porcentaje en estado Afiliado. Sin contactar: prospectos en estado Nuevo.',
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
    'Actividad de empresas del año en etapas 10%–100% durante la semana anterior al corte (altas y cambios de etapa). Al ampliar, compara las dos semanas previas con el mismo criterio.',
  companiesWeekly: dashboardChartDescriptions.companies,
  contactsOpportunities:
    'Evolución mensual de contactos y oportunidades creados en el periodo filtrado, agrupados por mes.',
  sourcesByEntity:
    'Empresas del año en curso en etapas activas (10%–100%), acumuladas por fuente de origen en las últimas 6 semanas.',
  activities: dashboardChartDescriptions.activities,
  tasks: dashboardChartDescriptions.tasks,
} as const;
