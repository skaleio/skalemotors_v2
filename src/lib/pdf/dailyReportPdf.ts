import { MIAMI_LOGO_REPORT_DATA_URI } from "@/assets/miamiLogoReport";
import type { DailySalesReportPayload } from "@/lib/types/dailySalesReport";

export interface DailyReportPdfData {
  fullName: string;
  branchName: string | null;
  reportDate: string; // YYYY-MM-DD
  payload: DailySalesReportPayload;
}

const PINK: [number, number, number] = [219, 39, 119];
const DARK_HEAD: [number, number, number] = [38, 38, 45];
const GRAY: [number, number, number] = [120, 120, 130];

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;

function hasData(row: Record<string, string>): boolean {
  return Object.values(row).some((v) => String(v ?? "").trim() !== "");
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

// Nombre de archivo ASCII (sin tildes/ñ) para que abra bien en Mac y Windows.
function safeFileName(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "reporte"
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

// Dibuja un informe completo a partir de startY y devuelve la Y final.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderReport(doc: any, autoTable: AutoTable, data: DailyReportPdfData, startY: number): number {
  let y = startY;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // Cabecera con logo oficial de Miami Motors
  const logoW = 50;
  let logoH = 9;
  try {
    const props = doc.getImageProperties(MIAMI_LOGO_REPORT_DATA_URI);
    if (props?.width) logoH = (props.height / props.width) * logoW;
  } catch {
    // si falla la lectura del logo, se usa la altura por defecto
  }
  doc.addImage(MIAMI_LOGO_REPORT_DATA_URI, "PNG", MARGIN, y, logoW, logoH, "miamiLogo", "FAST");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text("Reporte diario de ventas", MARGIN, y + logoH + 5);

  const infoY = y + logoH + 11;
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Vendedor: ${data.fullName}`, MARGIN, infoY);
  doc.text(`Sucursal: ${data.branchName ?? "—"}`, MARGIN, infoY + 5);
  doc.text(`Fecha: ${formatDate(data.reportDate)}`, PAGE_W - MARGIN, infoY, { align: "right" });

  doc.setDrawColor(220);
  doc.line(MARGIN, infoY + 9, PAGE_W - MARGIN, infoY + 9);
  y = infoY + 15;

  const section = (num: number, title: string) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PINK);
    doc.text(`${num}.  ${title}`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    y += 3;
  };

  const emptyNote = (text: string) => {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(text, MARGIN + 2, y + 4);
    y += 8;
  };

  const block = (label: string, fields: [string, string][], pink = false) => {
    ensureSpace(14 + fields.length * 6);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 1.6,
        textColor: 45,
        lineColor: pink ? PINK : [225, 225, 230],
      },
      columnStyles: { 0: { cellWidth: 42, textColor: GRAY, fontStyle: "bold" } },
      headStyles: {
        fillColor: pink ? PINK : DARK_HEAD,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      head: [[{ content: label, colSpan: 2 }]],
      body: fields.map(([k, v]) => [k, v?.trim() ? v : "—"]),
    });
    y = lastY(doc) + 4;
  };

  // 1. Llamados realizados
  section(1, "Llamados realizados");
  const calls = data.payload.calls.filter(hasData);
  if (!calls.length) emptyNote("Sin registros.");
  calls.forEach((c, i) =>
    block(`Registro ${i + 1}`, [
      ["Cliente", c.customer_name],
      ["Teléfono", c.phone],
      ["Vehículo", c.vehicle],
      ["Año", c.year],
      ["Motivo", c.reason],
      ["Resultado", c.result],
    ]),
  );

  // Bonus: consignaciones efectivas (rosado)
  const consignments = data.payload.effective_consignments.filter(hasData);
  consignments.forEach((c, i) =>
    block(
      `Consignación efectiva ${i + 1}  ·  BONUS`,
      [
        ["Cliente", c.customer_name],
        ["Patente", c.patente],
        ["Vehículo", c.vehicle],
        ["Observación", c.observation],
      ],
      true,
    ),
  );

  // 2. Créditos ingresados
  section(2, "Créditos ingresados");
  const credits = data.payload.credits.filter(hasData);
  if (!credits.length) emptyNote("Sin registros.");
  credits.forEach((c, i) =>
    block(`Registro ${i + 1}`, [
      ["Cliente", c.customer_name],
      ["RUT", c.rut],
      ["Financiera / banco", c.institution],
      ["Estado", c.status],
    ]),
  );

  // 3. Publicaciones en redes sociales
  section(3, "Publicaciones en redes sociales");
  const social = data.payload.social_posts.filter(hasData);
  if (!social.length) emptyNote("Sin registros.");
  social.forEach((s, i) =>
    block(`Registro ${i + 1}`, [
      ["Marca", s.brand],
      ["Modelo", s.model],
      ["Año", s.year],
      ["URL Facebook Marketplace", s.url],
    ]),
  );

  // 4. Observaciones del día
  section(4, "Observaciones del día");
  if (data.payload.daily_observations.trim()) {
    block("Observaciones", [["Notas", data.payload.daily_observations.trim()]]);
  } else {
    emptyNote("Sin observaciones.");
  }

  return y;
}

export async function downloadVendedorReportPdf(data: DailyReportPdfData): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  renderReport(doc, autoTable, data, MARGIN);
  const safeName = safeFileName(data.fullName);
  doc.save(`Reporte_Diario_${safeName}_${data.reportDate}.pdf`);
}

export async function downloadGeneralReportPdf(
  reportDate: string,
  reports: DailyReportPdfData[],
): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  if (reports.length === 0) {
    doc.setFontSize(12);
    doc.text("No hay informes enviados para esta fecha.", MARGIN, MARGIN + 10);
  } else {
    reports.forEach((r, i) => {
      if (i > 0) doc.addPage();
      renderReport(doc, autoTable, r, MARGIN);
    });
  }

  doc.save(`Reporte_General_${reportDate}.pdf`);
}

function triggerBlobDownload(bytes: Uint8Array, fileName: string, mime: string) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Genera un PDF por vendedor y los empaqueta en un único .zip (abre nativo en Mac y Windows).
export async function downloadAllVendedorReportsZip(
  reportDate: string,
  reports: DailyReportPdfData[],
): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const { zipSync, strToU8 } = await import("fflate");

  const files: Record<string, Uint8Array> = {};
  reports.forEach((r, i) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    renderReport(doc, autoTable, r, MARGIN);
    const safeName = safeFileName(r.fullName);
    files[`${String(i + 1).padStart(2, "0")}_${safeName}_${r.reportDate}.pdf`] = new Uint8Array(
      doc.output("arraybuffer"),
    );
  });

  if (Object.keys(files).length === 0) {
    files["SIN_INFORMES.txt"] = strToU8("No hay informes enviados para esta fecha.");
  }

  // level 0: los PDF ya vienen comprimidos, evita recomprimir sin ganancia.
  const zipped = zipSync(files, { level: 0 });
  triggerBlobDownload(zipped, `Reportes_Vendedores_${reportDate}.zip`, "application/zip");
}

export async function downloadUserHistoryPdf(
  fullName: string,
  reports: DailyReportPdfData[],
): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  if (reports.length === 0) {
    doc.setFontSize(12);
    doc.text("Sin informes enviados en el período.", MARGIN, MARGIN + 10);
  } else {
    reports.forEach((r, i) => {
      if (i > 0) doc.addPage();
      renderReport(doc, autoTable, r, MARGIN);
    });
  }

  const safeName = safeFileName(fullName);
  doc.save(`Historico_${safeName}.pdf`);
}
