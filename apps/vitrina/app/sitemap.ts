import type { MetadataRoute } from "next";

import { getRequestHost } from "@vitrina/lib/host";
import { fetchHome } from "@vitrina/lib/vitrinaApi";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = getRequestHost();
  let data: Awaited<ReturnType<typeof fetchHome>> = null;
  try {
    data = await fetchHome(host);
  } catch {
    return [];
  }
  if (!data) return [];
  const base = `https://${host}`;
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/vehiculos`, changeFrequency: "daily", priority: 0.9 },
  ];
  for (const v of data?.vehicles ?? []) {
    entries.push({
      url: `${base}/vehiculo/${v.id}`,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }
  return entries;
}
