export type CaptionVehicle = {
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  mileage: number | null;
  transmision_display?: string | null;
  combustible_display?: string | null;
};

function formatCLP(value: number | null): string {
  if (value == null) return "";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatKm(value: number | null): string {
  if (value == null) return "";
  return `${new Intl.NumberFormat("es-CL").format(value)} km`;
}

/**
 * Plantilla base del caption a partir de los datos del vehículo.
 * El fotógrafo la edita antes de publicar; el estilo final se ajusta
 * cuando definamos el documento de referencia.
 */
export function buildVehicleCaption(v: CaptionVehicle): string {
  const titulo = [v.make, v.model, v.year].filter(Boolean).join(" ");
  const lines: string[] = [];
  if (titulo) lines.push(`🚗 ${titulo}`);

  const specs: string[] = [];
  if (v.mileage != null) specs.push(formatKm(v.mileage));
  if (v.transmision_display) specs.push(v.transmision_display);
  if (v.combustible_display) specs.push(v.combustible_display);
  if (specs.length) lines.push(specs.join(" · "));

  if (v.price != null) lines.push(`💰 ${formatCLP(v.price)}`);

  lines.push("");
  lines.push("📲 Escríbenos para más información o agenda tu visita.");
  return lines.join("\n");
}
