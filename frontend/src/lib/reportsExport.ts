import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { formatCurrency } from '@/lib/formatters';

type JsPdfWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

export type ReportsExportInput = {
  range: { from: string; to: string };
  meta: {
    advisorLabel: string;
    sourceLabel: string;
  };
  kpis: {
    totalContacts: number;
    conversionPct: number;
    closedSalesAmount: number;
    activitiesCompleted: number;
    changes: { contacts: string; sales: string };
  };
  contactsVsOpportunitiesByMonth: { name: string; contactos: number; oportunidades: number }[];
  contactsBySource: { name: string; value: number }[];
  conversionByMonth: { name: string; tasa: number }[];
  performanceByAdvisor: { name: string; oportunidades: number; contactos: number; empresas: number }[];
  salesByMonth: {
    name: string;
    ventas: number;
    meta: number;
    oportunidadesGanadas?: {
      id: string;
      title: string;
      amount: number;
      companyName: string | null;
    }[];
  }[];
  opportunitiesByStage: { name: string; count: number; value: number }[];
  activitiesByType: {
    name: string;
    llamadas: number;
    reuniones: number;
    correos: number;
  }[];
  followUpsByMonth: { name: string; completados: number; pendientes: number }[];
  /** Datos para tablas de nuevas secciones */
  companiesByStage?: { label: string; value: number }[];
  weeklyOppsData?: { name: string; avance: number; nuevoIngreso: number; atraso: number; sinCambios: number }[];
  sourcesByEntity?: { semana: string; fuente: string; empresas: number }[];
  wonSalesByMonth?: { name: string; ventas: number }[];
  activitiesComparison?: {
    previousMonth: {
      name: string;
      llamadas: number;
      reuniones: number;
      correos: number;
    };
    currentMonth: {
      name: string;
      llamadas: number;
      reuniones: number;
      correos: number;
    };
  };
  /** Layout del PDF: `reports` alinea secciones con la pantalla de Reportes */
  pdfLayout?: 'reports' | 'legacy';
  /** Imágenes de los gráficos (base64) capturadas desde el DOM */
  charts?: {
    contacts?: string;
    sources?: string;
    funnel?: string;
    weeklyOpps?: string;
    wonOpportunities?: string;
    sourcesByEntity?: string;
    conversion?: string;
    performance?: string;
    sales?: string;
    pipeline?: string;
    activities?: string;
    tasks?: string;
  };
  /** Encabezado en PDF / CSV / Excel (por defecto: Reporte comercial) */
  documentTitle?: string;
};

const UTF8_BOM = '\uFEFF';

const CHART_CAPTURE_DELAY_MS = 600;
const CHART_CAPTURE_TIMEOUT_MS = 4500;

export const REPORT_CHART_CARD_IDS = {
  weeklyOpps: 'chart-weekly-opps',
  contacts: 'chart-contacts',
  activities: 'chart-activities-donut',
  funnel: 'chart-funnel',
  wonOpportunities: 'chart-won-opportunities',
  sourcesByEntity: 'chart-sources-by-entity',
  tasks: 'chart-tasks',
} as const;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

type CaptureChartCardImagesOptions = {
  selectedKeys?: Set<string>;
  delayMs?: number;
  timeoutMs?: number;
};

/** Captura tarjetas de gráficos vía html2canvas (parcial si alguno falla o expira). */
export async function captureChartCardImages(
  chartIds: Record<string, string>,
  options?: CaptureChartCardImagesOptions,
): Promise<Record<string, string>> {
  const chartImages: Record<string, string> = {};
  const delayMs = options?.delayMs ?? CHART_CAPTURE_DELAY_MS;
  const timeoutMs = options?.timeoutMs ?? CHART_CAPTURE_TIMEOUT_MS;
  const selectedKeys = options?.selectedKeys;

  await new Promise((r) => setTimeout(r, delayMs));

  for (const [key, id] of Object.entries(chartIds)) {
    if (selectedKeys && !selectedKeys.has(key)) continue;
    const cardEl = document.getElementById(id);
    if (!cardEl) continue;

    const target =
      cardEl.querySelector('[data-chart-capture]') ??
      cardEl.querySelector('[data-slot="card-content"]');
    if (!target || !(target instanceof HTMLElement)) continue;

    try {
      const dataUrl = await withTimeout(
        html2canvas(target, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
        }).then((canvas) => canvas.toDataURL('image/png')),
        timeoutMs,
      );
      if (dataUrl) {
        chartImages[key] = dataUrl;
      }
    } catch (e) {
      console.warn(`No se pudo capturar gráfico ${id}:`, e);
    }
  }

  return chartImages;
}

/** Captura los gráficos visibles en Reportes vía html2canvas (parcial si alguno falla). */
export async function captureReportChartImages(): Promise<
  NonNullable<ReportsExportInput['charts']>
> {
  return captureChartCardImages(REPORT_CHART_CARD_IDS) as NonNullable<
    ReportsExportInput['charts']
  >;
}

type PdfSection = {
  title: string;
  head?: string[][];
  body?: (string | number)[][];
  chartKey: keyof NonNullable<ReportsExportInput['charts']>;
};

function buildReportsPdfSections(data: ReportsExportInput): PdfSection[] {
  const activitiesBody: (string | number)[][] = data.activitiesComparison
    ? [
        [
          data.activitiesComparison.previousMonth.name,
          data.activitiesComparison.previousMonth.llamadas,
          data.activitiesComparison.previousMonth.reuniones,
          data.activitiesComparison.previousMonth.correos,
        ],
        [
          data.activitiesComparison.currentMonth.name,
          data.activitiesComparison.currentMonth.llamadas,
          data.activitiesComparison.currentMonth.reuniones,
          data.activitiesComparison.currentMonth.correos,
        ],
      ]
    : data.activitiesByType.slice(-2).map((x) => [
        x.name,
        x.llamadas,
        x.reuniones,
        x.correos,
      ]);

  return [
    {
      title: 'Empresas',
      head: [['Semana', 'Avance', 'Nuevos', 'Atraso', 'Sin cambios']],
      body: data.weeklyOppsData?.map((x) => [
        x.name,
        x.avance,
        x.nuevoIngreso,
        x.atraso,
        x.sinCambios,
      ]),
      chartKey: 'weeklyOpps',
    },
    {
      title: 'Contactos y oportunidades',
      head: [['Mes', 'Contactos', 'Oportunidades']],
      body: data.contactsVsOpportunitiesByMonth.map((x) => [
        x.name,
        x.contactos,
        x.oportunidades,
      ]),
      chartKey: 'contacts',
    },
    {
      title: 'Actividades',
      head: [['Mes', 'Llamadas', 'Reuniones', 'Correos']],
      body: activitiesBody,
      chartKey: 'activities',
    },
    {
      title: 'Oportunidades por etapa',
      head: [['Etapa', 'Cantidad']],
      body: data.companiesByStage?.map((x) => [x.label, x.value]),
      chartKey: 'funnel',
    },
    {
      title: 'Oportunidades ganadas',
      head: [['Mes', 'Ventas']],
      body: data.wonSalesByMonth?.map((x) => [x.name, formatCurrency(x.ventas)]),
      chartKey: 'wonOpportunities',
    },
    {
      title: 'Fuentes: Empresas',
      head: [['Semana', 'Fuente', 'Empresas']],
      body: data.sourcesByEntity?.map((x) => [x.semana, x.fuente, x.empresas]),
      chartKey: 'sourcesByEntity',
    },
    {
      title: 'Tareas por mes',
      head: [['Mes', 'Completadas', 'Pendientes']],
      body: data.followUpsByMonth.map((x) => [
        x.name,
        x.completados,
        x.pendientes,
      ]),
      chartKey: 'tasks',
    },
  ];
}

function buildLegacyPdfSections(data: ReportsExportInput): PdfSection[] {
  return [
    {
      title: 'Contactos y oportunidades por mes',
      head: [['Mes', 'Contactos', 'Oportunidades']],
      body: data.contactsVsOpportunitiesByMonth.map((x) => [
        x.name,
        x.contactos,
        x.oportunidades,
      ]),
      chartKey: 'contacts',
    },
    {
      title: 'Contactos por fuente',
      head: [['Fuente', 'Cantidad']],
      body: data.contactsBySource.map((x) => [x.name, x.value]),
      chartKey: 'sources',
    },
    {
      title: 'Empresas por etapa',
      head: [['Etapa', 'Cantidad']],
      body: data.companiesByStage?.map((x) => [x.label, x.value]),
      chartKey: 'funnel',
    },
    {
      title: 'Avance semanal · Empresas',
      head: [['Semana', 'Avance', 'Nuevos', 'Atraso', 'Sin cambios']],
      body: data.weeklyOppsData?.map((x) => [
        x.name,
        x.avance,
        x.nuevoIngreso,
        x.atraso,
        x.sinCambios,
      ]),
      chartKey: 'weeklyOpps',
    },
    {
      title: 'Tasa de conversión por mes',
      head: [['Mes', 'Tasa %']],
      body: data.conversionByMonth.map((x) => [x.name, x.tasa]),
      chartKey: 'conversion',
    },
    {
      title: 'Rendimiento por asesor',
      head: [['Asesor', 'Contactos', 'Oportunidades', 'Empresas']],
      body: data.performanceByAdvisor.map((x) => [
        x.name,
        x.contactos,
        x.oportunidades,
        x.empresas,
      ]),
      chartKey: 'performance',
    },
    {
      title: 'Ventas cerradas por mes',
      head: [['Mes', 'Ventas', 'Meta']],
      body: data.salesByMonth.map((x) => [
        x.name,
        formatCurrency(x.ventas),
        formatCurrency(x.meta),
      ]),
      chartKey: 'sales',
    },
    {
      title: 'Pipeline por etapa',
      head: [['Etapa', 'Oport.', 'Valor']],
      body: data.opportunitiesByStage.map((x) => [
        x.name,
        x.count,
        formatCurrency(x.value),
      ]),
      chartKey: 'pipeline',
    },
    {
      title: 'Actividades por tipo',
      head: [['Mes', 'Llamadas', 'Reuniones', 'Correos']],
      body: data.activitiesByType.map((x) => [
        x.name,
        x.llamadas,
        x.reuniones,
        x.correos,
      ]),
      chartKey: 'activities',
    },
    {
      title: 'Tareas por mes',
      head: [['Mes', 'Completadas', 'Pendientes']],
      body: data.followUpsByMonth.map((x) => [
        x.name,
        x.completados,
        x.pendientes,
      ]),
      chartKey: 'tasks',
    },
  ];
}

function padExportStamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

export function reportExportBaseFilename() {
  return `reporte-comercial_${padExportStamp(new Date())}`;
}

export function dashboardExportBaseFilename() {
  return `reporte-dashboard_${padExportStamp(new Date())}`;
}

function escapeCsvCell(v: string | number): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(values: (string | number)[]) {
  return values.map(escapeCsvCell).join(',');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** CSV con varias tablas (secciones con línea # título). */
export function downloadReportsCsv(data: ReportsExportInput, baseName: string) {
  const lines: string[] = [];
  const title = data.documentTitle ?? 'Reporte comercial';
  const m = data.meta;
  const r = data.range;
  lines.push(csvRow([`# ${title}`]));
  lines.push(csvRow(['Periodo desde', r.from]));
  lines.push(csvRow(['Periodo hasta', r.to]));
  lines.push(csvRow(['Asesor', m.advisorLabel]));
  lines.push(csvRow(['Fuente', m.sourceLabel]));
  lines.push('');

  lines.push('# KPIs');
  lines.push(csvRow(['Métrica', 'Valor']));
  lines.push(
    csvRow([
      'Total contactos del periodo',
      data.kpis.totalContacts,
    ]),
  );
  lines.push(csvRow(['Tasa de conversión %', data.kpis.conversionPct]));
  lines.push(
    csvRow([
      'Ventas cerradas (monto)',
      formatCurrency(data.kpis.closedSalesAmount),
    ]),
  );
  lines.push(
    csvRow(['Tareas completadas', data.kpis.activitiesCompleted]),
  );
  lines.push(csvRow(['Cambio contactos (7 días)', data.kpis.changes.contacts]));
  lines.push(csvRow(['Cambio ventas (7 días)', data.kpis.changes.sales]));
  lines.push('');

  const tables: { title: string; headers: string[]; rows: (string | number)[][] }[] =
    [
      {
        title: 'Contactos y oportunidades por mes',
        headers: ['Mes', 'Contactos', 'Oportunidades'],
        rows: data.contactsVsOpportunitiesByMonth.map((x) => [
          x.name,
          x.contactos,
          x.oportunidades,
        ]),
      },
      {
        title: 'Contactos por fuente',
        headers: ['Fuente', 'Cantidad'],
        rows: data.contactsBySource.map((x) => [x.name, x.value]),
      },
      {
        title: 'Tasa de conversión por mes',
        headers: ['Mes', 'Tasa %'],
        rows: data.conversionByMonth.map((x) => [x.name, x.tasa]),
      },
      {
        title: 'Rendimiento por asesor',
        headers: ['Asesor', 'Contactos', 'Oportunidades', 'Empresas'],
        rows: data.performanceByAdvisor.map((x) => [
          x.name,
          x.contactos,
          x.oportunidades,
          x.empresas,
        ]),
      },
      {
        title: 'Ventas cerradas por mes',
        headers: ['Mes', 'Ventas', 'Meta'],
        rows: data.salesByMonth.map((x) => [
          x.name,
          formatCurrency(x.ventas),
          formatCurrency(x.meta),
        ]),
      },
      {
        title: 'Pipeline por etapa',
        headers: ['Etapa', 'Oportunidades', 'Valor'],
        rows: data.opportunitiesByStage.map((x) => [
          x.name,
          x.count,
          formatCurrency(x.value),
        ]),
      },
      {
        title: 'Actividades por tipo',
        headers: ['Mes', 'Llamadas', 'Reuniones', 'Correos'],
        rows: data.activitiesByType.map((x) => [
          x.name,
          x.llamadas,
          x.reuniones,
          x.correos,
        ]),
      },
      {
        title: 'Tareas por mes',
        headers: ['Mes', 'Completadas', 'Pendientes'],
        rows: data.followUpsByMonth.map((x) => [
          x.name,
          x.completados,
          x.pendientes,
        ]),
      },
    ];

  for (const t of tables) {
    lines.push(`# ${t.title}`);
    lines.push(csvRow(t.headers));
    for (const row of t.rows) lines.push(csvRow(row));
    lines.push('');
  }

  const blob = new Blob([UTF8_BOM + lines.join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  downloadBlob(blob, `${baseName}.csv`);
}

export function downloadReportsXlsx(data: ReportsExportInput, baseName: string) {
  const wb = XLSX.utils.book_new();
  const title = data.documentTitle ?? 'Reporte comercial';

  const overview = [
    [title],
    ['Periodo desde', data.range.from],
    ['Periodo hasta', data.range.to],
    ['Asesor', data.meta.advisorLabel],
    ['Fuente', data.meta.sourceLabel],
    [],
    ['Métrica', 'Valor'],
    ['Total contactos del periodo', data.kpis.totalContacts],
    ['Tasa de conversión %', data.kpis.conversionPct],
    ['Ventas cerradas (monto)', data.kpis.closedSalesAmount],
    ['Tareas completadas', data.kpis.activitiesCompleted],
    ['Cambio contactos vs anterior', data.kpis.changes.contacts],
    ['Cambio ventas vs anterior', data.kpis.changes.sales],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(overview),
    'Resumen',
  );

  const addSheet = (name: string, rows: Record<string, string | number>[]) => {
    if (!rows.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Sin datos']]), name.slice(0, 31));
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };

  addSheet(
    'Contactos y opps',
    data.contactsVsOpportunitiesByMonth.map((x) => ({
      Mes: x.name,
      Contactos: x.contactos,
      Oportunidades: x.oportunidades,
    })),
  );
  addSheet(
    'Contactos fuente',
    data.contactsBySource.map((x) => ({ Fuente: x.name, Cantidad: x.value })),
  );
  addSheet(
    'Conversión',
    data.conversionByMonth.map((x) => ({ Mes: x.name, 'Tasa %': x.tasa })),
  );
  addSheet(
    'Asesores',
    data.performanceByAdvisor.map((x) => ({
      Asesor: x.name,
      Contactos: x.contactos,
      Oportunidades: x.oportunidades,
      Empresas: x.empresas,
    })),
  );
  addSheet(
    'Ventas mes',
    data.salesByMonth.map((x) => ({
      Mes: x.name,
      Ventas: x.ventas,
      Meta: x.meta,
    })),
  );
  addSheet(
    'Pipeline',
    data.opportunitiesByStage.map((x) => ({
      Etapa: x.name,
      Oportunidades: x.count,
      Valor: x.value,
    })),
  );
  addSheet(
    'Actividades',
    data.activitiesByType.map((x) => ({
      Mes: x.name,
      Llamadas: x.llamadas,
      Reuniones: x.reuniones,
      Correos: x.correos,
    })),
  );
  addSheet(
    'Tareas',
    data.followUpsByMonth.map((x) => ({
      Mes: x.name,
      Completadas: x.completados,
      Pendientes: x.pendientes,
    })),
  );

  XLSX.writeFile(wb, `${baseName}.xlsx`);
}

export function downloadReportsPdf(data: ReportsExportInput, baseName: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const title = data.documentTitle ?? 'Reporte comercial';
  let y = 14;

  doc.setFontSize(16);
  doc.text(title, 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.text(`Periodo: ${data.range.from} — ${data.range.to}`, 14, y);
  y += 5;
  doc.text(`Asesor: ${data.meta.advisorLabel}`, 14, y);
  y += 5;
  doc.text(`Fuente: ${data.meta.sourceLabel}`, 14, y);
  y += 10;

  const kpiBody: (string | number)[][] =
    data.pdfLayout === 'reports'
      ? [
          ['Contactos creados en el periodo', data.kpis.totalContacts],
          ['Ganadas en el periodo %', data.kpis.conversionPct],
          ['Ventas cerradas', formatCurrency(data.kpis.closedSalesAmount)],
          ['Tareas completadas', data.kpis.activitiesCompleted],
          ['Cambio contactos vs anterior', data.kpis.changes.contacts],
          ['Cambio ventas vs anterior', data.kpis.changes.sales],
        ]
      : [
          ['Total contactos del periodo', data.kpis.totalContacts],
          ['Tasa de conversión %', data.kpis.conversionPct],
          ['Ventas cerradas (monto)', formatCurrency(data.kpis.closedSalesAmount)],
          ['Tareas completadas', data.kpis.activitiesCompleted],
          ['Cambio contactos vs anterior', data.kpis.changes.contacts],
          ['Cambio ventas vs anterior', data.kpis.changes.sales],
        ];
  autoTable(doc, {
    startY: y,
    head: [['Métrica', 'Valor']],
    body: kpiBody,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [19, 148, 76] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as JsPdfWithAutoTable).lastAutoTable.finalY + 12;

  const sections =
    data.pdfLayout === 'reports'
      ? buildReportsPdfSections(data)
      : buildLegacyPdfSections(data);

  const contentWidth = 182; // 210 - 14*2

  for (const sec of sections) {
    if (!sec.body?.length && !data.charts?.[sec.chartKey]) continue;

    // Empezar cada sección en una página nueva
    doc.addPage();
    y = 20;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(sec.title, 14, y);
    doc.setFont('helvetica', 'normal');
    y += 10;

    // 1. Gráfico (si existe)
    const chartImg = data.charts?.[sec.chartKey];
    if (chartImg) {
      const imgProps = doc.getImageProperties(chartImg);
      const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
      const maxH = 110;
      const h = Math.min(imgHeight, maxH);

      doc.addImage(chartImg, 'PNG', 14, y, contentWidth, h);
      y += h + 10;
    }

    // 2. Tabla
    if (sec.body?.length && sec.head) {
      autoTable(doc, {
        startY: y,
        head: sec.head,
        body: sec.body,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [19, 148, 76] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as JsPdfWithAutoTable).lastAutoTable.finalY + 12;
    }
  }

  doc.save(`${baseName}.pdf`);
}

export function downloadReport(
  format: 'PDF' | 'Excel' | 'CSV',
  data: ReportsExportInput,
  baseName: string,
) {
  if (format === 'CSV') downloadReportsCsv(data, baseName);
  else if (format === 'Excel') downloadReportsXlsx(data, baseName);
  else downloadReportsPdf(data, baseName);
}
