/** Resumen de ingesta (n8n/WhatsApp) mostrado aparte del seguimiento del vendedor. */
export function formatIngestSummaryLabel(): string {
  return "Resumen del chat (WhatsApp / n8n)";
}

export function hasIngestSummary(ingestSummary: string | null | undefined): boolean {
  return (ingestSummary?.trim() ?? "").length > 0;
}
