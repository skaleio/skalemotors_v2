// Descarga programática de un documento (Nota de Venta / Contrato de Consignación)
// como PDF A4, capturando el HTML ya renderizado (DocumentContractBody) con
// html2canvas y paginándolo con jsPDF. Reusa lo que el usuario ve en pantalla,
// así no se desincroniza con las plantillas dinámicas.

// Nombre de archivo ASCII (sin tildes/ñ) para que abra bien en Mac y Windows.
function safeFileName(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "documento"
  );
}

export async function downloadDocumentPdf(
  node: HTMLElement,
  documentNumber: string
): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;
  // JPEG en vez de PNG: para texto sobre fondo blanco la calidad es idéntica
  // a la vista, pero el archivo pesa ~20x menos (clave para enviar por WhatsApp/email).
  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  let heightLeft = imgH;
  let position = 0;
  pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
  heightLeft -= pageH;
  while (heightLeft > 0) {
    position = heightLeft - imgH;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
  }

  pdf.save(`${safeFileName(documentNumber)}.pdf`);
}
