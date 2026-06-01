import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 60;
import { notFound } from "next/navigation";

import { VehiclesBlock } from "@/components/website/blocks/VehiclesBlock";
import { VitrinaShell } from "@vitrina/components/VitrinaShell";
import { getRequestHost } from "@vitrina/lib/host";
import { toPreviewVehicle } from "@vitrina/lib/mapVehicle";
import { fetchHome, fetchVehicles } from "@vitrina/lib/vitrinaApi";

export async function generateMetadata(): Promise<Metadata> {
  const host = getRequestHost();
  const home = await fetchHome(host);
  if (!home?.site) return { title: "Vehículos" };
  return {
    title: `Vehículos | ${home.site.site_name ?? "Vitrina"}`,
    icons: home.site.favicon_url ? { icon: home.site.favicon_url } : undefined,
  };
}

export default async function VehiculosPage() {
  const host = getRequestHost();
  const home = await fetchHome(host);
  if (!home?.site) notFound();

  const list = await fetchVehicles(host);
  const vehicles = (list?.vehicles ?? home.vehicles ?? []).map(toPreviewVehicle);
  const site = home.site;

  return (
    <VitrinaShell
      site={{
        theme: site.theme,
        primary_color: site.primary_color,
        secondary_color: site.secondary_color,
        font: site.font,
      }}
    >
      <main>
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--sm-border)" }}>
          <Link href="/" className="text-sm" style={{ color: "var(--sm-primary)" }}>
            ← Inicio
          </Link>
        </div>
        <VehiclesBlock
          props={{ title: "Todo el stock", limit: 48 }}
          vehicles={vehicles}
          linkBasePath="/vehiculo"
        />
      </main>
    </VitrinaShell>
  );
}
