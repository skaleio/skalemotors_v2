import type { Document } from "@/lib/services/documents";
import type { DocumentTemplate } from "@/lib/documents/templateTypes";
import { mergeLayoutSettings } from "@/lib/documents/templateTypes";

function formatCLP(amount: number | null | undefined): string {
  if (!amount) return "$0";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const densityClass = {
  normal: "text-sm space-y-4",
  compact: "text-xs space-y-3",
  minimal: "text-[10px] space-y-2 leading-snug",
};

export interface DocumentContractBodyProps {
  doc: Document;
  template?: DocumentTemplate | null;
  issuerName?: string;
  compact?: boolean;
}

export function DocumentContractBody({
  doc,
  template,
  issuerName,
  compact,
}: DocumentContractBodyProps) {
  const isVenta = doc.type === "contrato_venta";
  const today = new Date().toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const brand = issuerName?.trim() || "Automotora";
  const layout = mergeLayoutSettings(
    template?.settings ?? { sections: {}, density: "normal" },
    doc.layout_settings
  );
  const sections = layout.sections;
  const density = compact ? "compact" : layout.density;
  const clauses = template?.clauses?.length
    ? template.clauses
    : [];

  const title =
    layout.title ??
    template?.settings?.title ??
    (isVenta ? "CONTRATO DE COMPRAVENTA DE VEHÍCULO" : "CONTRATO DE CONSIGNACIÓN DE VEHÍCULO");

  return (
    <div className={densityClass[density]}>
      <div className="text-center mb-4">
        <h1 className={`font-bold mb-1 ${density === "minimal" ? "text-sm" : "text-xl"}`}>
          {title}
        </h1>
        <p className="text-gray-500 text-xs">{doc.document_number}</p>
        <p className="text-gray-400 text-xs">Santiago, {today}</p>
        <p className="text-gray-600 text-xs mt-1 font-medium">{brand}</p>
      </div>

      {sections.consignor && !isVenta && (
        <>
          <h2 className="font-bold border-b border-gray-300 pb-1">DATOS DEL CONSIGNANTE</h2>
          <table className="w-full border-collapse mb-2">
            <tbody>
              {[
                ["Nombre", doc.owner_name],
                ["RUT", doc.owner_rut],
                ["Teléfono", doc.owner_phone],
                ["Email", doc.owner_email],
                ["Dirección", doc.owner_address],
              ].map(([k, v]) => (
                <tr key={String(k)}>
                  <td className="border border-gray-200 p-1.5 bg-gray-50 font-semibold w-1/3">{k}</td>
                  <td className="border border-gray-200 p-1.5">{v || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {sections.buyer && isVenta && (
        <>
          <h2 className="font-bold border-b border-gray-300 pb-1">DATOS DEL COMPRADOR</h2>
          <table className="w-full border-collapse mb-2">
            <tbody>
              {[
                ["Nombre", doc.buyer_name],
                ["RUT", doc.buyer_rut],
                ["Teléfono", doc.buyer_phone],
                ["Email", doc.buyer_email],
                ["Dirección", doc.buyer_address],
              ].map(([k, v]) => (
                <tr key={String(k)}>
                  <td className="border border-gray-200 p-1.5 bg-gray-50 font-semibold w-1/3">{k}</td>
                  <td className="border border-gray-200 p-1.5">{v || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {sections.vehicle && (
        <>
          <h2 className="font-bold border-b border-gray-300 pb-1">DETALLES DEL VEHÍCULO</h2>
          <table className="w-full border-collapse mb-2">
            <tbody>
              {[
                ["Marca", doc.vehicle_make],
                ["Modelo", doc.vehicle_model],
                ["Año", doc.vehicle_year],
                ["Color", doc.vehicle_color],
                ["Patente", doc.vehicle_patente],
                ["Kilometraje", doc.vehicle_km ? `${doc.vehicle_km.toLocaleString("es-CL")} km` : ""],
                ["N° Motor", doc.vehicle_motor],
                ["N° Chasis", doc.vehicle_chasis ?? doc.vehicle_vin],
              ].map(([k, v]) => (
                <tr key={String(k)}>
                  <td className="border border-gray-200 p-1.5 bg-gray-50 font-semibold w-1/3">{k}</td>
                  <td className="border border-gray-200 p-1.5">{v || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {sections.consignment_details && !isVenta && (
        <>
          <h2 className="font-bold border-b border-gray-300 pb-1">DETALLES DE LA CONSIGNACIÓN</h2>
          <table className="w-full border-collapse mb-2">
            <tbody>
              {[
                ["Precio sugerido", formatCLP(doc.sale_price)],
                ["Precio mínimo", formatCLP(doc.min_sale_price ?? doc.sale_price)],
                ["Comisión (%)", doc.commission_percentage ? `${doc.commission_percentage}%` : "—"],
                ["Monto comisión", formatCLP(doc.commission_amount)],
              ].map(([k, v]) => (
                <tr key={String(k)}>
                  <td className="border border-gray-200 p-1.5 bg-gray-50 font-semibold w-1/3">{k}</td>
                  <td className="border border-gray-200 p-1.5 font-semibold">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {sections.economic && isVenta && (
        <>
          <h2 className="font-bold border-b border-gray-300 pb-1">CONDICIONES ECONÓMICAS</h2>
          <table className="w-full border-collapse mb-2">
            <tbody>
              {[
                ["Precio de venta", formatCLP(doc.sale_price)],
                ["Forma de pago", doc.payment_method ?? "—"],
              ].map(([k, v]) => (
                <tr key={String(k)}>
                  <td className="border border-gray-200 p-1.5 bg-gray-50 font-semibold w-1/3">{k}</td>
                  <td className="border border-gray-200 p-1.5 font-semibold">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {sections.observations && doc.notes && (
        <>
          <h2 className="font-bold border-b border-gray-300 pb-1">OBSERVACIONES</h2>
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{doc.notes}</p>
        </>
      )}

      {sections.terms && clauses.length > 0 && (
        <>
          <h2 className="font-bold border-b border-gray-300 pb-1 mt-4">TÉRMINOS Y CONDICIONES</h2>
          <div className="space-y-3">
            {clauses.map((c) => (
              <div key={c.id}>
                <p className="font-bold text-gray-800">{c.title}</p>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {sections.signatures && (
        <div className="flex justify-between mt-8 pt-4">
          <div className="text-center w-[42%]">
            <div className="border-t border-gray-800 pt-2 mt-10 text-xs">
              <p className="font-semibold">{isVenta ? "Firma vendedor" : "Firma consignante"}</p>
              <p className="text-gray-500">Nombre / RUT</p>
            </div>
          </div>
          <div className="text-center w-[42%]">
            <div className="border-t border-gray-800 pt-2 mt-10 text-xs">
              <p className="font-semibold">{isVenta ? "Firma comprador" : `Firma ${brand}`}</p>
              <p className="text-gray-500">Nombre / RUT</p>
            </div>
          </div>
        </div>
      )}

      {doc.id !== "preview" ? (
        <p className="text-center text-gray-400 text-xs mt-6 border-t border-gray-100 pt-3">
          {brand} — {doc.document_number} — Generado el {formatDate(doc.created_at)}
        </p>
      ) : (
        <p className="text-center text-amber-600 text-xs mt-4">Vista previa — aún no guardado</p>
      )}
    </div>
  );
}
