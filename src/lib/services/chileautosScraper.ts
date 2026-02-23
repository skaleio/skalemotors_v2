import { supabase, supabaseAnonKey } from "@/lib/supabase";

export type ChileAutosListing = {
  id: string | null;
  title: string | null;
  make: string | null;
  model: string | null;
  price: string | null;
  priceText: string | null;
  state: string | null;
  bodystyle: string | null;
  vehcategory: string | null;
  details: string[];
  sellerType: string | null;
  sellerLocation: string | null;
  url: string | null;
};

export type ChileAutosScrapeResponse = {
  keyword: string;
  offset: number;
  total: number;
  listings: ChileAutosListing[];
};

export async function scrapeChileAutos(
  keyword: string,
  offset: number = 0
): Promise<ChileAutosScrapeResponse> {
  const { data, error } = await supabase.functions.invoke<ChileAutosScrapeResponse & { error?: string }>(
    "chileautos-scrape",
    {
      body: { q: keyword.trim(), offset },
      // Evitar 401: enviar anon key explícitamente (la sesión puede estar expirada o inestable)
      headers: supabaseAnonKey ? { Authorization: `Bearer ${supabaseAnonKey}` } : undefined,
    }
  );
  if (error) {
    const msg = await getEdgeFunctionErrorMessage(error);
    throw new Error(msg ?? error.message ?? "Error al llamar al scraper");
  }
  if (data?.error) throw new Error(data.error);
  if (!data || !Array.isArray(data.listings)) {
    throw new Error("Respuesta inválida del scraper");
  }
  return data as ChileAutosScrapeResponse;
}

async function getEdgeFunctionErrorMessage(err: unknown): Promise<string | null> {
  try {
    const e = err as { context?: Response };
    const res = e?.context;
    if (!res || typeof res.json !== "function") return null;
    const body = await res.json();
    if (body?.error && typeof body.error === "string") return body.error;
    if (body?.status && body?.error) return `${body.error} (${body.status})`;
  } catch {
    try {
      const e = err as { context?: { text?: () => Promise<string> } };
      if (e?.context?.text) {
        const text = await e.context.text();
        const body = JSON.parse(text) as { error?: string };
        if (body?.error) return body.error;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export async function scrapeChileAutosMultiplePages(
  keyword: string,
  maxPages: number = 1
): Promise<ChileAutosListing[]> {
  const all: ChileAutosListing[] = [];
  const pageSize = 12;
  for (let page = 0; page < maxPages; page++) {
    const offset = page * pageSize;
    const result = await scrapeChileAutos(keyword, offset);
    result.listings.forEach((l) => all.push(l));
    if (result.listings.length < pageSize) break;
  }
  return all;
}
