import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 60;
import { notFound } from "next/navigation";

import { LeadForm } from "@vitrina/components/LeadForm";
import { VitrinaShell } from "@vitrina/components/VitrinaShell";
import { getRequestHost } from "@vitrina/lib/host";
import { fetchHome, fetchVehicle } from "@vitrina/lib/vitrinaApi";

function formatClp(value: number | null): string {
  if (value === null || value === undefined) return "Consultar";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function vehicleImages(v: { primary_image_url: string | null; images: unknown }): string[] {
  const out: string[] = [];
  if (v.primary_image_url) out.push(v.primary_image_url);
  if (Array.isArray(v.images)) {
    for (const item of v.images) {
      if (typeof item === "string" && !out.includes(item)) out.push(item);
      else if (item && typeof item === "object" && "url" in item) {
        const url = String((item as { url: unknown }).url);
        if (!out.includes(url)) out.push(url);
      }
    }
  }
  return out;
}

type PageProps = { params: { id: string } };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const host = getRequestHost();
  const data = await fetchVehicle(host, params.id);
  if (!data?.vehicle) return { title: "Vehículo" };
  const v = data.vehicle;
  const title = [v.make, v.model, v.year].filter(Boolean).join(" ");
  const home = await fetchHome(host);
  return {
    title: `${title} | ${home?.site?.site_name ?? "Vitrina"}`,
    description: v.description?.slice(0, 160) ?? undefined,
    openGraph: {
      title,
      images: v.primary_image_url ? [{ url: v.primary_image_url }] : undefined,
    },
    icons: home?.site?.favicon_url ? { icon: home.site.favicon_url } : undefined,
  };
}

export default async function VehiculoPage({ params }: PageProps) {
  const host = getRequestHost();
  const home = await fetchHome(host);
  if (!home?.site) notFound();

  const data = await fetchVehicle(host, params.id);
  if (!data?.vehicle) notFound();

  const v = data.vehicle;
  const site = home.site;
  const imgs = vehicleImages(v);
  const label = [v.make, v.model, v.year].filter(Boolean).join(" ");

  return (
    <VitrinaShell
      site={{
        theme: site.theme,
        primary_color: site.primary_color,
        secondary_color: site.secondary_color,
        font: site.font,
        theme_custom: site.theme_custom,
      }}
    >
      <main>
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--sm-border)" }}>
          <Link href="/vehiculos" className="text-sm" style={{ color: "var(--sm-primary)" }}>
            ← Volver al stock
          </Link>
        </div>

        <article
          className="mx-auto max-w-5xl px-6 py-10"
          style={{ paddingBottom: "var(--sm-space-section)" }}
        >
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-3">
              {imgs.length ? (
                imgs.map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt={label}
                    className="w-full rounded-lg object-cover"
                    style={{ borderRadius: "var(--sm-radius)" }}
                  />
                ))
              ) : (
                <div
                  className="flex aspect-[4/3] items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--sm-border)", color: "var(--sm-muted)" }}
                >
                  Sin fotos
                </div>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1
                  className="text-2xl font-bold md:text-3xl"
                  style={{ fontFamily: "var(--sm-font-heading)", color: "var(--sm-fg)" }}
                >
                  {label || "Vehículo"}
                </h1>
                {v.status === "reservado" ? (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ backgroundColor: "var(--sm-primary)", color: "var(--sm-bg)" }}
                  >
                    Reservado
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-2xl font-bold" style={{ color: "var(--sm-primary)" }}>
                {formatClp(v.price)}
              </p>
              <ul className="mt-6 space-y-1 text-sm" style={{ color: "var(--sm-muted)" }}>
                {v.mileage ? <li>Kilometraje: {new Intl.NumberFormat("es-CL").format(v.mileage)} km</li> : null}
                {v.fuel_type ? <li>Combustible: {v.fuel_type}</li> : null}
                {v.transmission ? <li>Transmisión: {v.transmission}</li> : null}
                {v.color ? <li>Color: {v.color}</li> : null}
              </ul>
              {v.description ? (
                <p className="mt-6 text-sm leading-relaxed" style={{ color: "var(--sm-fg)" }}>
                  {v.description}
                </p>
              ) : null}
            </div>
          </div>
        </article>

        <section className="px-6 pb-12" style={{ backgroundColor: "var(--sm-surface)" }}>
          <h2
            className="mb-4 text-center text-lg font-semibold"
            style={{ fontFamily: "var(--sm-font-heading)", color: "var(--sm-fg)" }}
          >
            Consultar por este auto
          </h2>
          <LeadForm host={host} vehicleId={v.id} vehicleLabel={label} />
        </section>
      </main>
    </VitrinaShell>
  );
}
