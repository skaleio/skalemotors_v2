import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 60;

import { SectionRenderer } from "@vitrina/components/SectionRenderer";
import { getRequestHost } from "@vitrina/lib/host";
import { fetchHome } from "@vitrina/lib/vitrinaApi";

export async function generateMetadata(): Promise<Metadata> {
  const host = getRequestHost();
  const data = await fetchHome(host);
  if (!data?.site) return { title: "Vitrina" };
  const site = data.site;
  return {
    title: site.seo_title ?? site.site_name ?? "Vitrina",
    description: site.seo_description ?? undefined,
    icons: site.favicon_url ? { icon: site.favicon_url } : undefined,
  };
}

export default async function HomePage() {
  const host = getRequestHost();
  const data = await fetchHome(host);
  if (!data?.site) notFound();

  const { site, vehicles } = data;

  return (
    <main>
      <SectionRenderer site={site} vehicles={vehicles ?? []} host={host} />
    </main>
  );
}
