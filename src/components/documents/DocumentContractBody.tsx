import type { Document } from "@/lib/services/documents";
import type { DocumentTemplate } from "@/lib/documents/templateTypes";
import { mergeLayoutSettings } from "@/lib/documents/templateTypes";
import { MIAMI_LOGO_DATA_URI } from "@/assets/miamiLogo";

/**
 * Datos del emisor (automotora). Hoy fijos para Miami Motors; configurables por
 * tenant/sucursal más adelante. El logo se incrusta cuando esté el asset oficial.
 */
const ISSUER = {
  name: "Miami Motors",
  rut: "",
  phone: "+56947928875",
  email: "contreras3g@gmail.com",
  logoSrc: MIAMI_LOGO_DATA_URI as string | null,
};

function formatCLP(amount: number | null | undefined): string {
  if (!amount) return "$0";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Fecha tipo DATE ("YYYY-MM-DD") sin desfases de zona horaria. */
function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [yyyy, mm, dd] = dateStr.slice(0, 10).split("-");
  if (!yyyy || !mm || !dd) return formatDate(dateStr);
  return `${dd}-${mm}-${yyyy}`;
}

const densityClass = {
  normal: "text-[13px] leading-relaxed",
  compact: "text-[11px] leading-snug",
  minimal: "text-[10px] leading-snug",
};

const gapClass = {
  normal: "space-y-5",
  compact: "space-y-4",
  minimal: "space-y-3",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[12px] font-bold tracking-wide text-slate-600 uppercase border-b border-slate-200 pb-1 mb-3">
      {children}
    </h2>
  );
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-semibold text-slate-800">{value || "—"}</p>
    </div>
  );
}

export interface DocumentContractBodyProps {
  doc: Document;
  template?: DocumentTemplate | null;
  issuerName?: string;
  compact?: boolean;
}

export function DocumentContractBody({
  doc,
  template,
  compact,
}: DocumentContractBodyProps) {
  const isVenta = doc.type === "contrato_venta";
  const isReserva = doc.type === "nota_reserva";
  const isConsignacion = doc.type === "contrato_consignacion";
  const layout = mergeLayoutSettings(
    template?.settings ?? { sections: {}, density: "normal" },
    doc.layout_settings
  );
  const sections = layout.sections;
  const density = compact ? "compact" : layout.density;
  const clauses = template?.clauses?.length ? template.clauses : [];
  const issueDate = doc.id !== "preview" ? doc.created_at : new Date().toISOString();

  const title =
    layout.title ??
    template?.settings?.title ??
    (isVenta
      ? "NOTA DE VENTA"
      : isReserva
        ? "NOTA DE RESERVA"
        : "CONTRATO DE CONSIGNACIÓN");

  const price = doc.sale_price ?? 0;
  const downPayment = doc.down_payment ?? 0;
  const balance = price - downPayment;
  const reservedAmount = doc.down_payment ?? 0;
  const reservaBalance = price - reservedAmount;

  return (
    <div className={`${densityClass[density]} ${gapClass[density]} text-slate-700`}>
      {/* Encabezado: emisor a la izquierda, título y folio a la derecha */}
      <div className="flex items-start justify-between gap-6 pb-3 border-b border-slate-300">
        <div className="flex flex-col gap-2">
          {ISSUER.logoSrc ? (
            <img src={ISSUER.logoSrc} alt={ISSUER.name} className="h-10 w-auto rounded" />
          ) : null}
          <div>
            <p className="text-sm font-bold text-slate-800">{ISSUER.name}</p>
            {ISSUER.rut ? <p className="text-[10px] text-slate-400">RUT: {ISSUER.rut}</p> : null}
            <p className="text-[10px] text-slate-400">Tel: {ISSUER.phone}</p>
            <p className="text-[10px] text-slate-400">{ISSUER.email}</p>
          </div>
        </div>
        <div className="text-right">
          <h1 className={`font-bold text-slate-800 ${density === "minimal" ? "text-sm" : "text-lg"}`}>
            {title}
          </h1>
          <p className="text-[11px] text-rose-500 font-medium">N° {doc.document_number}</p>
          <p className="text-[11px] text-slate-400">Fecha: {formatDate(issueDate)}</p>
        </div>
      </div>

      {/* Partes: consignante (consignación) o cliente (venta) */}
      {sections.consignor && isConsignacion && (
        <section>
          <SectionTitle>Datos del consignante</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <Field label="Nombre" value={doc.owner_name} />
            <Field label="RUT" value={doc.owner_rut} />
            <Field label="Teléfono" value={doc.owner_phone} />
            {doc.owner_email ? <Field label="Email" value={doc.owner_email} /> : null}
            {doc.owner_address ? <Field label="Dirección" value={doc.owner_address} /> : null}
          </div>
        </section>
      )}

      {sections.buyer && (isVenta || isReserva) && (
        <section>
          <SectionTitle>Datos del cliente</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <Field label="Nombre" value={doc.buyer_name} />
            <Field label="RUT" value={doc.buyer_rut} />
            <Field label="Teléfono" value={doc.buyer_phone} />
            <Field label="Email" value={doc.buyer_email} />
            {(!isReserva || doc.buyer_address) && (
              <Field label="Dirección" value={doc.buyer_address} />
            )}
          </div>
        </section>
      )}

      {sections.vehicle && (
        <section>
          <SectionTitle>Detalles del vehículo</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <Field label="Marca" value={doc.vehicle_make} />
            <Field label="Modelo" value={doc.vehicle_model} />
            <Field label="Año" value={doc.vehicle_year} />
            <Field label="Color" value={doc.vehicle_color} />
            <Field label="Patente" value={doc.vehicle_patente} />
            <Field
              label="Kilometraje"
              value={doc.vehicle_km ? `${doc.vehicle_km.toLocaleString("es-CL")} km` : ""}
            />
            <Field label="N° Motor" value={doc.vehicle_motor} />
            <Field label="N° Chasis" value={doc.vehicle_chasis ?? doc.vehicle_vin} />
          </div>
        </section>
      )}

      {/* Consignación: precios sugerido y mínimo */}
      {sections.consignment_details && isConsignacion && (
        <section>
          <SectionTitle>Detalles de la consignación</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <Field label="Precio sugerido" value={formatCLP(doc.sale_price)} />
            <Field label="Precio mínimo" value={formatCLP(doc.min_sale_price ?? doc.sale_price)} />
          </div>
        </section>
      )}

      {/* Venta: detalle económico con pagos (PIE / saldo) */}
      {sections.economic && isVenta && (
        <section>
          <SectionTitle>Detalle de la venta</SectionTitle>
          <div className="space-y-1.5">
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span>Precio del vehículo</span>
              <span className="font-semibold text-slate-800">{formatCLP(price)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-1">
              <span className="font-bold text-slate-800">TOTAL</span>
              <span className="font-bold text-slate-800">{formatCLP(price)}</span>
            </div>
          </div>

          {downPayment > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] font-bold text-slate-600">Pagos Realizados</p>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>- PIE</span>
                <span className="font-semibold text-slate-800">{formatCLP(downPayment)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>- Saldo restante</span>
                <span className="font-semibold text-slate-800">{formatCLP(balance)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-1">
                <span className="font-bold text-slate-800">Total Pagado</span>
                <span className="font-bold text-slate-800">{formatCLP(price)}</span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Reserva: precio, monto reservado fijo y saldo pendiente */}
      {sections.economic && isReserva && (
        <section>
          <SectionTitle>Detalle de la reserva</SectionTitle>
          <div className="space-y-1.5">
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span>Precio del vehículo</span>
              <span className="font-semibold text-slate-800">{formatCLP(price)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="font-semibold text-rose-600">Monto reservado</span>
              <span className="font-bold text-rose-600">{formatCLP(reservedAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-1">
              <span className="font-bold text-slate-800">Saldo pendiente</span>
              <span className="font-bold text-slate-800">{formatCLP(reservaBalance)}</span>
            </div>
          </div>
          <div className="flex justify-between mt-3 pt-2 border-t border-slate-200">
            <span className="text-[11px] uppercase tracking-wide text-slate-400">
              Fecha de vencimiento
            </span>
            <span className="font-semibold text-slate-800">
              {formatDateOnly(doc.reservation_expires_at)}
            </span>
          </div>
        </section>
      )}

      {sections.observations && doc.notes && (
        <section>
          <SectionTitle>Observaciones</SectionTitle>
          <p className="text-slate-700 whitespace-pre-wrap">{doc.notes}</p>
        </section>
      )}

      {sections.terms && clauses.length > 0 && (
        <section>
          <SectionTitle>Términos y condiciones</SectionTitle>
          <div className="space-y-2.5">
            {clauses.map((c) => (
              <div key={c.id}>
                <p className="font-bold text-slate-700">{c.title}</p>
                <p className="text-slate-600 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {sections.signatures && (
        <div className="flex justify-between gap-8 pt-10">
          <div className="text-center w-[45%]">
            <div className="border-t border-slate-800 pt-2 mt-10 text-[11px]">
              <p className="font-semibold text-slate-800">{ISSUER.name}</p>
              <p className="text-slate-500">{isConsignacion ? "Consignatario" : "Vendedor"}</p>
            </div>
          </div>
          <div className="text-center w-[45%]">
            <div className="border-t border-slate-800 pt-2 mt-10 text-[11px]">
              <p className="font-semibold text-slate-800">
                {(isConsignacion ? doc.owner_name : doc.buyer_name) || "________________"}
              </p>
              <p className="text-slate-500">
                {isConsignacion ? "Consignante" : isReserva ? "Cliente" : "Comprador"}
              </p>
              <p className="text-slate-400">{isConsignacion ? doc.owner_rut : doc.buyer_rut}</p>
            </div>
          </div>
        </div>
      )}

      {doc.id === "preview" && (
        <p className="text-center text-amber-600 text-[11px] mt-4">Vista previa — aún no guardado</p>
      )}
    </div>
  );
}
