import * as XLSX from "xlsx";

export type ExportRow = Record<string, string | number | null | undefined>;

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function writeWorkbook(workbook: XLSX.WorkBook, fileName: string) {
  const out = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  if (blob.size === 0) throw new Error("El archivo XLSX quedó vacío.");
  downloadBlob(blob, fileName);
}

export function exportRowsToXlsx(rows: ExportRow[], sheetName: string, fileName: string) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName.slice(0, 31));
  writeWorkbook(workbook, fileName);
}

export interface XlsxSheet {
  name: string;
  rows: ExportRow[];
}

export function exportSheetsToXlsx(sheets: XlsxSheet[], fileName: string) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet, i) => {
    const safeName = (sheet.name || `Hoja ${i + 1}`).slice(0, 31);
    const data = sheet.rows.length > 0 ? sheet.rows : [{ "Sin datos": "" }];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), safeName);
  });
  writeWorkbook(workbook, fileName);
}
