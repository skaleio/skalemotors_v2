import * as cheerio from "cheerio";

interface VercelRequest {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}
interface VercelResponse {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: unknown): void;
}

// H14: rate-limit en memoria por IP. No persiste entre cold starts (Vercel),
// pero limita abuso dentro de una invocation lambda. Para rate-limit duradero
// hace falta KV/Redis externo (out of scope de este fix).
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQ = 30;
const FETCH_TIMEOUT_MS = 8_000;
const ipHits = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length) return fwd[0].split(",")[0].trim();
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real.length) return real;
  return "unknown";
}

function checkRateLimit(ip: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }
  if (entry.count >= RATE_LIMIT_MAX_REQ) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { ok: true };
}

function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

const BASE_URL = "https://www.chileautos.cl/vehiculos/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const ACCEPT_LANGUAGE = "es-CL,es;q=0.9";

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

function buildSearchUrl(keyword: string, offset: number): string {
  const q = `(And.Servicio.chileautos._.CarAll.keyword(${keyword.trim().replace(/\s+/g, "+")}).)`;
  const params = new URLSearchParams({
    q,
    sort: "topdeal",
  });
  if (offset > 0) params.set("offset", String(offset));
  return `${BASE_URL}?${params.toString()}`;
}

function parseListings(html: string, baseUrl: string): ChileAutosListing[] {
  const $ = cheerio.load(html);
  const results: ChileAutosListing[] = [];

  $(".listing-item.card").each((_, el) => {
    const $card = $(el);
    const pid = $card.attr("id") ?? null;
    const make = $card.attr("data-webm-make") ?? null;
    const model = $card.attr("data-webm-model") ?? null;
    const price = $card.attr("data-webm-price") ?? null;
    const state = $card.attr("data-webm-state") ?? null;
    const bodystyle = $card.attr("data-webm-bodystyle") ?? null;
    const vehcategory = $card.attr("data-webm-vehcategory") ?? null;

    const titleEl = $card.find("h3 a[data-webm-clickvalue='sv-title']").first();
    const title = titleEl.length ? titleEl.text().trim() || null : null;
    let link: string | null = null;
    const href = titleEl.attr("href");
    if (href) link = href.startsWith("http") ? href : `https://www.chileautos.cl${href.startsWith("/") ? href : "/" + href}`;

    const priceEl = $card.find(".item-price .price a").first();
    const priceText = priceEl.length ? priceEl.text().trim() || null : null;

    const details: string[] = [];
    $card.find("ul.key-details li").each((_, li) => {
      const t = $(li).text().trim();
      if (t) details.push(t);
    });

    const sellerType = $card.find(".seller-type").first().text().trim() || null;
    const sellerLocation = $card.find(".seller-location").first().text().trim() || null;

    results.push({
      id: pid,
      title,
      make,
      model,
      price,
      priceText,
      state,
      bodystyle,
      vehcategory,
      details,
      sellerType,
      sellerLocation,
      url: link,
    });
  });

  return results;
}

function isProductionEnv(): boolean {
  const vercelEnv = (process.env.VERCEL_ENV ?? "").toLowerCase();
  if (vercelEnv) return vercelEnv === "production";
  return (process.env.NODE_ENV ?? "").toLowerCase() === "production";
}

function validateScrapeAuth(req: VercelRequest): boolean {
  const expected = process.env.CHILEAUTOS_SCRAPE_API_KEY?.trim();
  if (!expected) {
    return !isProductionEnv();
  }
  const provided =
    (req.headers["x-api-key"] as string | undefined)?.trim() ||
    (typeof req.query?.api_key === "string" ? req.query.api_key.trim() : "");
  return provided === expected;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método no permitido" });
  }

  if (!validateScrapeAuth(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // H14: rate-limit por IP.
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (rl.ok === false) {
    res.setHeader("Retry-After", String(rl.retryAfter));
    return res.status(429).json({ error: "Too many requests" });
  }

  const keyword = typeof req.query?.q === "string" ? req.query.q : "";
  const offset = Math.max(0, Math.min(1000, Number(req.query?.offset) || 0));

  if (!keyword.trim() || keyword.length > 200) {
    return res.status(400).json({ error: "Parámetro 'q' (búsqueda) es requerido (máx 200 chars)" });
  }

  try {
    const url = buildSearchUrl(keyword, offset);
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": ACCEPT_LANGUAGE,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      },
      FETCH_TIMEOUT_MS
    );

    if (!response.ok) {
      return res.status(502).json({
        error: `ChileAutos respondió con ${response.status}`,
        status: response.status,
      });
    }

    const html = await response.text();
    const baseUrl = "https://www.chileautos.cl";
    const listings = parseListings(html, baseUrl);

    return res.status(200).json({
      keyword,
      offset,
      total: listings.length,
      listings,
    });
  } catch (err) {
    // H14: no leakear err.message al cliente.
    console.error("[chileautos-scrape] fetch/parse error:", err);
    return res.status(500).json({ error: "Error al scrapear ChileAutos" });
  }
}
