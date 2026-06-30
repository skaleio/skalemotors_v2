// PDF del informe diario consolidado de leads (para gerencia).
// Reusa el estilo del reporte de vendedores (logo Miami, paleta, autoTable) pero
// con layout de métricas (tablas de conteos), no de registros individuales.

import { MIAMI_LOGO_REPORT_DATA_URI } from "@/assets/miamiLogoReport";
import type { LeadsDailyConsolidated } from "@/lib/services/leadsDailyReport";

const PINK: [number, number, number] = [219, 39, 119];
const GRAY: [number, number, number] = [120, 120, 130];

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function safeFileName(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "informe"
  );
}

type AutoTable = (doc: unknown, options: Record<string, unknown>) => void;

async function loadPdf() {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable: autoTableMod.default as AutoTable };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lastY(doc: any): number {
  return doc.lastAutoTable?.finalY ?? MARGIN;
}

export async function downloadLeadsDailyReportPdf(data: LeadsDailyConsolidated): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  // Cabecera con logo
  const logoW = 50;
  let logoH = 9;
  try {
    const props = doc.getImageProperties(MIAMI_LOGO_REPORT_DATA_URI);
    if (props?.width) logoH = (props.height / props.width) * logoW;
  } catch {
    // altura por defecto si falla la lectura del logo
  }
  doc.addImage(MIAMI_LOGO_REPORT_DATA_URI, "PNG", MARGIN, y, logoW, logoH, "miamiLogo", "FAST");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text("Informe diario de Leads", MARGIN, y + logoH + 5);

  const infoY = y + logoH + 11;
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Alcance: ${data.scopeLabel}`, MARGIN, infoY);
  doc.text(`Total leads: ${data.totalLeads}`, MARGIN, infoY + 5);
  doc.text(`Fecha: ${formatDate(data.date)}`, PAGE_W - MARGIN, infoY, { align: "right" });

  doc.setDrawColor(220);
  doc.line(MARGIN, infoY + 9, PAGE_W - MARGIN, infoY + 9);
  y = infoY + 15;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const section = (num: number, title: string, reserve = 24) => {
    ensureSpace(reserve);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PINK);
    doc.text(`${num}.  ${title}`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    y += 3;
  };

  const table = (rows: [string, string][], pink = false) => {
    ensureSpace(10 + rows.length * 7);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2, textColor: 45, lineColor: pink ? PINK : [225, 225, 230] },
      columnStyles: {
        0: { textColor: GRAY, fontStyle: "bold" },
        1: { halign: "right", cellWidth: 30, fontStyle: "bold" },
      },
      body: rows.map(([k, v]) => [k, v]),
    });
    y = lastY(doc) + 5;
  };

  const emptyNote = (text: string) => {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(text, MARGIN + 2, y + 4);
    y += 9;
  };

  // 1. Resumen del día
  section(1, "Resumen del día");
  table([
    ["Leads nuevos hoy", String(data.resumen.nuevosHoy)],
    ["Activos en pipeline", String(data.resumen.activos)],
    ["Cerrados hoy (vendidos)", String(data.resumen.cerradosHoy)],
  ]);

  // 2. Leads por etapa
  section(2, "Leads activos por etapa");
  if (data.porEtapa.length) {
    table(data.porEtapa.map((e) => [e.label, String(e.count)]));
  } else {
    emptyNote("Sin leads activos en el pipeline.");
  }

  // 3. Leads por fuente
  section(3, "Leads activos por fuente");
  if (data.porFuente.length) {
    table(data.porFuente.map((f) => [f.label, String(f.count)]));
  } else {
    emptyNote("Sin datos de fuente.");
  }

  // 4. Alertas de gestión (rosado para resaltar)
  section(4, "Alertas de gestión");
  table(
    [
      ["Prioridad sin contactar", String(data.alertas.prioridadSinContactar)],
      ["Leads sin asignar", String(data.alertas.sinAsignar)],
      ["Seguimientos vencidos", String(data.alertas.seguimientosVencidos)],
    ],
    true
  );

  doc.save(`Informe_Leads_${safeFileName(data.scopeLabel)}_${data.date}.pdf`);
}
