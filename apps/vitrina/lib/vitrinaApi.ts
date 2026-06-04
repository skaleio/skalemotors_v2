export interface PublicSite {
  is_published: boolean;
  theme: string;
  site_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  font: string | null;
  primary_color: string;
  secondary_color: string | null;
  theme_custom?: Record<string, string> | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  about_text: string | null;
  whatsapp_phone: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  social: unknown;
  sections: unknown;
  videos: unknown;
  seo_title: string | null;
  seo_description: string | null;
}

export interface PublicVehicle {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  mileage: number | null;
  fuel_type: string | null;
  transmission: string | null;
  price: number | null;
  description: string | null;
  features: unknown;
  images: unknown;
  primary_image_url: string | null;
  carroceria: string | null;
  branch_id: string | null;
  status?: string | null;
  created_at: string;
}

function functionsBase(): string {
  const explicit = process.env.VITRINA_FUNCTIONS_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!supabase) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return `${supabase}/functions/v1`;
}

async function vitrinaFetch<T>(
  host: string,
  path: string,
  extra?: Record<string, string>,
): Promise<T | null> {
  const url = new URL(`${functionsBase()}/public-vitrina`);
  url.searchParams.set("host", host);
  url.searchParams.set("path", path);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`public-vitrina ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function fetchHome(host: string) {
  return vitrinaFetch<{
    site: PublicSite;
    branches: unknown[];
    vehicles: PublicVehicle[];
  }>(host, "home");
}

export async function fetchVehicles(host: string) {
  return vitrinaFetch<{ vehicles: PublicVehicle[] }>(host, "vehicles");
}

export async function fetchVehicle(host: string, id: string) {
  return vitrinaFetch<{ vehicle: PublicVehicle }>(host, "vehicle", { id });
}

export async function submitLead(
  host: string,
  payload: Record<string, unknown>,
): Promise<{ ok?: boolean; error?: string }> {
  const url = `${functionsBase()}/vitrina-lead`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, host }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? "Error al enviar" };
  }
  return { ok: true };
}
