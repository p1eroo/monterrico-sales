import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  contactsByPeriod: { name: string; leads: number; nuevos: number }[];
  contactsBySource: { name: string; value: number }[];
  conversionByMonth: { name: string; tasa: number }[];
  performanceByAdvisor: { name: string; empresas: number; ventas: number }[];
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
  /** Encabezado en PDF / CSV / Excel (por defecto: Reporte comercial) */
  documentTitle?: string;
};

const UTF8_BOM = '\uFEFF';

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
  lines.push(csvRow(['Cambio contactos vs anterior', data.kpis.changes.contacts]));
  lines.push(csvRow(['Cambio ventas vs anterior', data.kpis.changes.sales]));
  lines.push('');

  const tables: { title: string; headers: string[]; rows: (string | number)[][] }[] =
    [
      {
        title: 'Contactos por periodo',
        headers: ['Periodo', 'Total contactos', 'Nuevos'],
        rows: data.contactsByPeriod.map((x) => [x.name, x.leads, x.nuevos]),
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
        headers: ['Asesor', 'Empresas', 'Ventas'],
        rows: data.performanceByAdvisor.map((x) => [
          x.name,
          x.empresas,
          x.ventas,
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
    'Contactos periodo',
    data.contactsByPeriod.map((x) => ({
      Periodo: x.name,
      'Total contactos': x.leads,
      Nuevos: x.nuevos,
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
      Empresas: x.empresas,
      Ventas: x.ventas,
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

  const kpiBody: (string | number)[][] = [
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

  const sections: { title: string; head: string[][]; body: (string | number)[][] }[] =
    [
      {
        title: 'Contactos por periodo',
        head: [['Periodo', 'Total', 'Nuevos']],
        body: data.contactsByPeriod.map((x) => [x.name, x.leads, x.nuevos]),
      },
      {
        title: 'Contactos por fuente',
        head: [['Fuente', 'Cantidad']],
        body: data.contactsBySource.map((x) => [x.name, x.value]),
      },
      {
        title: 'Tasa de conversión por mes',
        head: [['Mes', 'Tasa %']],
        body: data.conversionByMonth.map((x) => [x.name, x.tasa]),
      },
      {
        title: 'Rendimiento por asesor',
        head: [['Asesor', 'Empresas', 'Ventas']],
        body: data.performanceByAdvisor.map((x) => [
          x.name,
          x.empresas,
          x.ventas,
        ]),
      },
      {
        title: 'Ventas cerradas por mes',
        head: [['Mes', 'Ventas', 'Meta']],
        body: data.salesByMonth.map((x) => [
          x.name,
          formatCurrency(x.ventas),
          formatCurrency(x.meta),
        ]),
      },
      {
        title: 'Pipeline por etapa',
        head: [['Etapa', 'Oport.', 'Valor']],
        body: data.opportunitiesByStage.map((x) => [
          x.name,
          x.count,
          formatCurrency(x.value),
        ]),
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
      },
      {
        title: 'Tareas por mes',
        head: [['Mes', 'Completadas', 'Pendientes']],
        body: data.followUpsByMonth.map((x) => [
          x.name,
          x.completados,
          x.pendientes,
        ]),
      },
    ];

  const pageMaxY = 280;
  for (const sec of sections) {
    if (!sec.body.length) continue;
    if (y > pageMaxY - 20) {
      doc.addPage();
      y = 14;
    }
    doc.setFontSize(11);
    doc.text(sec.title, 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: sec.head,
      body: sec.body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as JsPdfWithAutoTable).lastAutoTable.finalY + 10;
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
