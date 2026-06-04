import type { CSSProperties } from "react";
import { ArrowRight, Gauge } from "lucide-react";
import type { VehiculosProps } from "@/lib/website/sections";
import { getThemeLayout } from "@/lib/website/theme";

export interface PreviewVehicle {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  mileage: number | null;
  primary_image_url: string | null;
  images: unknown;
  /** Solo vitrina pública: muestra badge si es reservado. */
  status?: string | null;
}

function VehicleReservadoBadge({ status }: { status?: string | null }) {
  if (status !== "reservado") return null;
  return (
    <span
      className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm"
      style={{
        backgroundColor: "color-mix(in srgb, var(--sm-primary) 85%, transparent)",
        color: "var(--sm-bg)",
      }}
    >
      Reservado
    </span>
  );
}

interface VehiclesBlockProps {
  props: VehiculosProps;
  vehicles: PreviewVehicle[];
  loading?: boolean;
  theme?: string | null;
  /** Si se define, cada card enlaza a `{linkBasePath}/{id}` (web pública). */
  linkBasePath?: string;
  anchorId?: string;
}

function firstImage(v: PreviewVehicle): string | null {
  if (v.primary_image_url) return v.primary_image_url;
  if (Array.isArray(v.images) && v.images.length > 0) {
    const first = v.images[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in first) {
      return String((first as { url: unknown }).url);
    }
  }
  return null;
}

function formatClp(value: number | null): string {
  if (value === null || value === undefined) return "Consultar";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

const cardStyle: CSSProperties = {
  backgroundColor: "var(--sm-surface)",
  border: "1px solid var(--sm-border)",
  borderRadius: "var(--sm-radius)",
  boxShadow: "var(--sm-shadow)",
};

function LuxuryVehicleCard({
  v,
  linkBasePath,
  index = 0,
}: {
  v: PreviewVehicle;
  linkBasePath?: string;
  index?: number;
}) {
  const img = firstImage(v);
  const label = [v.make, v.model].filter(Boolean).join(" ") || "Vehículo";
  const delayClass = ["sm-d1", "sm-d2", "sm-d3", "sm-d4", "sm-d5"][index % 5];

  const inner = (
    <article
      className={`sm-card sm-fade-up ${delayClass} group relative overflow-hidden`}
      style={cardStyle}
    >
      <div className="relative aspect-[16/10] overflow-hidden" style={{ backgroundColor: "var(--sm-border)" }}>
        {img ? (
          <img src={img} alt={label} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div
            className="flex h-full items-center justify-center text-sm"
            style={{ color: "var(--sm-muted)" }}
          >
            Sin foto
          </div>
        )}
        {/* Degradado inferior + brillo al hover */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }}
        />
        <span className="sm-shine" />
        <VehicleReservadoBadge status={v.status} />
        {v.year ? (
          <span
            className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm"
            style={{
              backgroundColor: "color-mix(in srgb, var(--sm-bg) 70%, transparent)",
              color: "var(--sm-fg)",
            }}
          >
            {v.year}
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <h3
          className="font-semibold"
          style={{ color: "var(--sm-fg)", fontFamily: "var(--sm-font-heading)" }}
        >
          {label}
        </h3>
        <div className="mt-2 flex flex-wrap gap-3 text-xs" style={{ color: "var(--sm-muted)" }}>
          {v.mileage ? (
            <span className="inline-flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5" />
              {new Intl.NumberFormat("es-CL").format(v.mileage)} km
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xl font-bold" style={{ color: "var(--sm-primary)" }}>
            {formatClp(v.price)}
          </p>
          <span
            className="inline-flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ color: "var(--sm-fg)" }}
          >
            Ver <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </article>
  );

  if (linkBasePath) {
    return (
      <a href={`${linkBasePath}/${v.id}`} className="block">
        {inner}
      </a>
    );
  }
  return inner;
}

export function VehiclesBlock({
  props,
  vehicles,
  loading,
  linkBasePath,
  theme,
  anchorId = "stock",
}: VehiclesBlockProps) {
  const layout = getThemeLayout(theme);
  const items = vehicles.slice(0, props.limit || 12);

  const sectionStyle: CSSProperties = {
    paddingTop: "var(--sm-space-section)",
    paddingBottom: "var(--sm-space-section)",
  };

  if (layout === "classic") {
    return (
      <section id={anchorId} className="px-4 md:px-8" style={sectionStyle}>
        <div className="mx-auto max-w-5xl">
          <h2
            className="text-center text-2xl font-semibold md:text-3xl"
            style={{ color: "var(--sm-fg)", fontFamily: "var(--sm-font-heading)" }}
          >
            {props.title || "Nuestro stock"}
          </h2>
          <div className="mx-auto my-6 h-px w-16" style={{ backgroundColor: "var(--sm-primary)" }} />
          {loading ? (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="animate-pulse border p-4" style={{ borderColor: "var(--sm-border)" }}>
                  <div className="aspect-[16/10] bg-muted" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm" style={{ color: "var(--sm-muted)" }}>
              Próximamente publicaremos vehículos.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {items.map((v) => {
                const img = firstImage(v);
                const label = [v.make, v.model].filter(Boolean).join(" ") || "Vehículo";
                const inner = (
                  <article
                    className="overflow-hidden border-2 transition-shadow hover:shadow-md"
                    style={{ borderColor: "var(--sm-border)", backgroundColor: "var(--sm-bg)" }}
                  >
                    <div className="relative aspect-[16/10]" style={{ backgroundColor: "var(--sm-border)" }}>
                      {img ? (
                        <img src={img} alt={label} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--sm-muted)" }}>
                          Sin foto
                        </div>
                      )}
                      <VehicleReservadoBadge status={v.status} />
                    </div>
                    <div className="border-t p-5" style={{ borderColor: "var(--sm-border)" }}>
                      <p className="text-lg font-semibold" style={{ fontFamily: "var(--sm-font-heading)" }}>
                        {label}
                      </p>
                      <p className="mt-1 text-sm" style={{ color: "var(--sm-muted)" }}>
                        {[v.year, v.mileage ? `${new Intl.NumberFormat("es-CL").format(v.mileage)} km` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-3 text-xl font-bold" style={{ color: "var(--sm-primary)" }}>
                        {formatClp(v.price)}
                      </p>
                    </div>
                  </article>
                );
                return linkBasePath ? (
                  <a key={v.id} href={`${linkBasePath}/${v.id}`} className="block">
                    {inner}
                  </a>
                ) : (
                  <div key={v.id}>{inner}</div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (layout === "luxury") {
    return (
      <section id={anchorId} className="px-4 md:px-6" style={sectionStyle}>
        <div className="mx-auto max-w-7xl">
          <p
            className="sm-fade-up text-xs font-semibold uppercase tracking-[0.3em]"
            style={{ color: "var(--sm-primary)" }}
          >
            Inventario
          </p>
          <h2
            className="sm-fade-up sm-d1 mt-2 text-2xl font-bold uppercase tracking-wide md:text-3xl"
            style={{ color: "var(--sm-fg)", fontFamily: "var(--sm-font-heading)" }}
          >
            {props.title || "Nuestro stock"}
          </h2>

          {loading ? (
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse aspect-[4/5] rounded-xl" style={cardStyle} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="mt-8 text-center text-sm" style={{ color: "var(--sm-muted)" }}>
              Próximamente publicaremos vehículos. Consultanos por WhatsApp.
            </p>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((v, i) => (
                <LuxuryVehicleCard key={v.id} v={v} linkBasePath={linkBasePath} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section id={anchorId} className="px-6" style={sectionStyle}>
      <h2
        className="text-center text-2xl font-bold md:text-3xl"
        style={{ color: "var(--sm-fg)", fontFamily: "var(--sm-font-heading)" }}
      >
        {props.title || "Nuestro stock"}
      </h2>
      <span
        className="mx-auto mb-8 mt-3 block h-1 w-12 rounded-full"
        style={{ backgroundColor: "var(--sm-primary)" }}
      />

      {loading ? (
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden" style={cardStyle}>
              <div className="aspect-[4/3]" style={{ backgroundColor: "var(--sm-border)" }} />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 rounded" style={{ backgroundColor: "var(--sm-border)" }} />
                <div className="h-4 w-1/3 rounded" style={{ backgroundColor: "var(--sm-border)" }} />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm" style={{ color: "var(--sm-muted)" }}>
          Aún no hay vehículos publicados. Marcá autos como "Mostrar en mi web" desde el inventario.
        </p>
      ) : (
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((v) => {
            const img = firstImage(v);
            const card = (
              <div className="overflow-hidden" style={cardStyle}>
                <div className="relative aspect-[4/3]" style={{ backgroundColor: "var(--sm-border)" }}>
                  {img ? (
                    <img
                      src={img}
                      alt={`${v.make ?? ""} ${v.model ?? ""}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-sm"
                      style={{ color: "var(--sm-muted)" }}
                    >
                      Sin foto
                    </div>
                  )}
                  <VehicleReservadoBadge status={v.status} />
                </div>
                <div className="p-4">
                  <p className="font-semibold" style={{ color: "var(--sm-fg)" }}>
                    {[v.make, v.model].filter(Boolean).join(" ") || "Vehículo"}
                    {v.year ? (
                      <span style={{ color: "var(--sm-muted)" }}> · {v.year}</span>
                    ) : null}
                  </p>
                  {v.mileage ? (
                    <p className="text-xs" style={{ color: "var(--sm-muted)" }}>
                      {new Intl.NumberFormat("es-CL").format(v.mileage)} km
                    </p>
                  ) : null}
                  <p className="mt-2 text-lg font-bold" style={{ color: "var(--sm-primary)" }}>
                    {formatClp(v.price)}
                  </p>
                </div>
              </div>
            );
            if (linkBasePath) {
              return (
                <a
                  key={v.id}
                  href={`${linkBasePath}/${v.id}`}
                  className="block transition-opacity hover:opacity-90"
                >
                  {card}
                </a>
              );
            }
            return <div key={v.id}>{card}</div>;
          })}
        </div>
      )}
    </section>
  );
}
