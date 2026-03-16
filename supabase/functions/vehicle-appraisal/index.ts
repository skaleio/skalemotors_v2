/// <reference path="../_shared/edge-runtime.d.ts" />
import * as cheerio from "npm:cheerio";
import { corsHeaders } from "../_shared/cors.ts";

type AppraisalBody = {
  marca?: string;
  modelo?: string;
  año?: number;
  toleranciaAños?: number;
};

type AppraisalSample = {
  titulo: string;
  precio: number;
  año: number;
  kilometros: number | null;
  url: string;
};

type ParsedListing = {
  titulo: string;
  precioTexto: string;
  año: number;
  kilometros: number | null;
  url: string;
};

const CHILEAUTOS_ORIGIN = "https://www.chileautos.cl";
const YAPO_ORIGIN = "https://www.yapo.cl";

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-CL,es;q=0.9",
  Referer: `${CHILEAUTOS_ORIGIN}/`,
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...BROWSER_HEADERS,
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function buildChileAutosUrl(marca: string, modelo: string, año: number, toleranciaAños: number) {
  const from = año - toleranciaAños;
  const to = año + toleranciaAños;
  const params = new URLSearchParams({
    q: `${marca} ${modelo}`.trim(),
    YearRange: `${from}-${to}`,
  });
  return `${CHILEAUTOS_ORIGIN}/vehiculos/autos/?${params.toString()}`;
}

function buildYapoUrl(marca: string, modelo: string) {
  const params = new URLSearchParams({
    q: `keyword.${marca} ${modelo}`.trim(),
  });
  return `${YAPO_ORIGIN}/autos-usados?${params.toString()}`;
}

function absoluteUrl(origin: string, href: string | null | undefined): string | null {
  if (!href) return null;
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${origin}${href}`;
  return `${origin}/${href}`;
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function extractYear(text: string): number | null {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function extractKilometers(text: string): number | null {
  const match = text.match(/(\d{1,3}(?:[.\s]\d{3})+|\d+)\s*(km|kms|kil[oó]metros)/i);
  if (!match) return null;
  return Number(match[1].replace(/[.\s]/g, ""));
}

function parsePriceToClp(priceText: string, ufValor: number): number | null {
  const normalized = cleanText(priceText);
  if (!normalized) return null;

  if (/uf/i.test(normalized)) {
    const ufMatch = normalized.match(/uf\s*([\d.]+(?:,\d+)?)/i);
    if (!ufMatch) return null;
    const ufAmount = Number(ufMatch[1].replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(ufAmount)) return null;
    return Math.round(ufAmount * ufValor);
  }

  const pesoMatch = normalized.match(/\$?\s*([\d.]+(?:,\d+)?)/);
  if (!pesoMatch) return null;
  const amount = Number(pesoMatch[1].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(amount)) return null;

  // Si el sitio entrega "12.5" y no "12.500.000", asumir millones.
  if (amount > 0 && amount < 1000 && normalized.includes(".")) {
    return Math.round(amount * 1_000_000);
  }

  return Math.round(amount);
}

function isBlocked(status: number, html: string): boolean {
  if ([403, 429, 503].includes(status)) return true;
  const lowered = html.toLowerCase();
  return (
    lowered.includes("captcha") ||
    lowered.includes("cloudflare") ||
    lowered.includes("attention required") ||
    lowered.includes("access denied") ||
    lowered.includes("bot verification")
  );
}

function uniqueByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function parseChileAutosListings(html: string, fromYear: number, toYear: number): ParsedListing[] {
  const $ = cheerio.load(html);
  const nodes = [
    ...$("[data-webm-vr='search-result']").toArray(),
    ...$(".listing-item.card").toArray(),
    ...$(".listing-item").toArray(),
    ...$(".card-item").toArray(),
    ...$("article").toArray(),
  ];

  const parsed: ParsedListing[] = [];

  for (const node of nodes) {
    const $card = $(node);
    const title = cleanText(
      $card.find("h3 a").first().text() ||
        $card.find("h2 a").first().text() ||
        $card.find("[class*='title'] a").first().text() ||
        $card.find("a[title]").first().attr("title"),
    );
    const url = absoluteUrl(
      CHILEAUTOS_ORIGIN,
      $card.find("h3 a").first().attr("href") ||
        $card.find("h2 a").first().attr("href") ||
        $card.find("a[href*='/vehiculos/']").first().attr("href") ||
        $card.find("a[href]").first().attr("href"),
    );
    const priceText = cleanText(
      $card.find(".item-price .price").first().text() ||
        $card.find(".price").first().text() ||
        $card.find("[class*='price']").first().text(),
    );
    const detailsText = cleanText(
      [
        $card.attr("data-webm-year"),
        $card.find("ul.key-details").text(),
        $card.text(),
      ]
        .filter(Boolean)
        .join(" "),
    );
    const año = extractYear(detailsText) ?? extractYear(title);
    const kilometros = extractKilometers(detailsText);

    if (!title || !priceText || !url || !año) continue;
    if (año < fromYear || año > toYear) continue;
    if (!/^\$|uf/i.test(priceText)) continue;

    parsed.push({
      titulo: title,
      precioTexto: priceText,
      año,
      kilometros,
      url,
    });
  }

  return uniqueByUrl(parsed).slice(0, 20);
}

function parseYapoListings(html: string, fromYear: number, toYear: number): ParsedListing[] {
  const $ = cheerio.load(html);
  const anchors = $("a[href]").toArray();
  const parsed: ParsedListing[] = [];

  for (const anchor of anchors) {
    const $anchor = $(anchor);
    const title = cleanText(
      $anchor.attr("title") ||
        $anchor.find("h2, h3, [class*='title']").first().text() ||
        $anchor.text(),
    );
    const href = $anchor.attr("href");
    const url = absoluteUrl(YAPO_ORIGIN, href);
    const containerText = cleanText($anchor.closest("article, li, div").text() || $anchor.text());
    const priceTextMatch = containerText.match(/UF\s*[\d.]+(?:,\d+)?|\$\s*[\d.]+(?:,\d+)?/i);
    const priceText = cleanText(priceTextMatch?.[0] ?? "");
    const año = extractYear(containerText) ?? extractYear(title);
    const kilometros = extractKilometers(containerText);

    if (!url || !title || !priceText || !año) continue;
    if (año < fromYear || año > toYear) continue;

    parsed.push({
      titulo: title,
      precioTexto: priceText,
      año,
      kilometros,
      url,
    });
  }

  return uniqueByUrl(parsed).slice(0, 20);
}

async function getUfValue(): Promise<number> {
  const response = await fetchWithTimeout("https://mindicador.cl/api/uf", {
    headers: {
      Accept: "application/json",
      Referer: "https://mindicador.cl/",
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo obtener la UF (${response.status})`);
  }

  const payload = await response.json() as { serie?: Array<{ valor?: number }> };
  const value = payload?.serie?.[0]?.valor;
  if (!value || !Number.isFinite(value)) {
    throw new Error("La API de UF no devolvió un valor válido");
  }
  return value;
}

function trimOutliers(values: number[]): number[] {
  if (values.length < 10) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * 0.1);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  return trimmed.length > 0 ? trimmed : sorted;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle];
}

function confidenceFromSamples(total: number): "alta" | "media" | "baja" {
  if (total >= 15) return "alta";
  if (total >= 7) return "media";
  return "baja";
}

async function fetchHtml(url: string, referer: string) {
  const response = await fetchWithTimeout(url, {
    headers: {
      Referer: referer,
    },
    redirect: "follow",
  });
  const html = await response.text();
  console.log("[vehicle-appraisal] HTML preview:", html.slice(0, 500));
  return { response, html };
}

async function fetchViaScraperApi(url: string) {
  const apiKey = Deno.env.get("SCRAPER_API_KEY");
  if (!apiKey) return null;

  const proxyUrl = `https://api.scraperapi.com?api_key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(url)}`;
  const response = await fetchWithTimeout(proxyUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-CL,es;q=0.9",
    },
  });
  const html = await response.text();
  console.log("[vehicle-appraisal] Proxy HTML preview:", html.slice(0, 500));
  return { response, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Método no permitido" });
  }

  let body: AppraisalBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Body JSON inválido" });
  }

  const marca = cleanText(body.marca);
  const modelo = cleanText(body.modelo);
  const año = Number(body.año);
  const toleranciaAños = Math.min(3, Math.max(1, Number(body.toleranciaAños) || 2));

  if (!marca || !modelo || !Number.isFinite(año)) {
    return jsonResponse(400, {
      ok: false,
      error: "Debes enviar marca, modelo y año válidos para calcular la tasación.",
    });
  }

  const fromYear = año - toleranciaAños;
  const toYear = año + toleranciaAños;

  try {
    const ufValor = await getUfValue();
    const chileautosUrl = buildChileAutosUrl(marca, modelo, año, toleranciaAños);
    const directResult = await fetchHtml(chileautosUrl, `${CHILEAUTOS_ORIGIN}/`);
    const directBlocked = isBlocked(directResult.response.status, directResult.html);

    let parsedListings = directBlocked
      ? []
      : parseChileAutosListings(directResult.html, fromYear, toYear);
    let source = "chileautos";

    if (parsedListings.length === 0 && directBlocked) {
      try {
        const proxyResult = await fetchViaScraperApi(chileautosUrl);
        if (proxyResult && !isBlocked(proxyResult.response.status, proxyResult.html)) {
          parsedListings = parseChileAutosListings(proxyResult.html, fromYear, toYear);
          if (parsedListings.length > 0) {
            source = "chileautos-proxy";
          }
        }
      } catch (error) {
        console.warn("[vehicle-appraisal] proxy fallback falló:", error);
      }
    }

    if (parsedListings.length === 0) {
      try {
        const yapoUrl = buildYapoUrl(marca, modelo);
        const yapo = await fetchHtml(yapoUrl, `${YAPO_ORIGIN}/`);

        if (!isBlocked(yapo.response.status, yapo.html)) {
          parsedListings = parseYapoListings(yapo.html, fromYear, toYear);
          if (parsedListings.length > 0) {
            source = "yapo";
          }
        }
      } catch (error) {
        console.warn("[vehicle-appraisal] fallback Yapo falló:", error);
      }
    }

    if (parsedListings.length === 0) {
      if (directBlocked) {
        return jsonResponse(200, {
          blocked: true,
          source: "chileautos",
          error:
            "ChileAutos bloqueó la consulta y no hubo resultados válidos en los respaldos. Reintenta con proxy externo o usa comparables manuales.",
        });
      }

      return jsonResponse(404, {
        ok: false,
        error:
          "No se encontraron anuncios comparables para ese vehículo. Intenta ampliar la tolerancia de años o usar comparables manuales.",
      });
    }

    const muestras: AppraisalSample[] = parsedListings
      .map((listing) => {
        const precio = parsePriceToClp(listing.precioTexto, ufValor);
        if (!precio || precio <= 0) return null;
        return {
          titulo: listing.titulo,
          precio,
          año: listing.año,
          kilometros: listing.kilometros,
          url: listing.url,
        };
      })
      .filter((sample): sample is AppraisalSample => Boolean(sample))
      .sort((a, b) => a.precio - b.precio)
      .slice(0, 20);

    if (muestras.length === 0) {
      return jsonResponse(404, {
        ok: false,
        error: "Se encontraron anuncios, pero no fue posible extraer precios válidos.",
      });
    }

    const cleanedPrices = trimOutliers(muestras.map((sample) => sample.precio));
    const precioMinimo = Math.min(...cleanedPrices);
    const precioMaximo = Math.max(...cleanedPrices);
    const precioPromedio = Math.round(cleanedPrices.reduce((sum, value) => sum + value, 0) / cleanedPrices.length);
    const precioMediana = median(cleanedPrices);

    return jsonResponse(200, {
      source,
      tasacion: {
        precio_minimo: precioMinimo,
        precio_promedio: precioPromedio,
        precio_maximo: precioMaximo,
        precio_mediana: precioMediana,
        total_muestras: muestras.length,
        confianza: confidenceFromSamples(muestras.length),
        fecha_consulta: new Date().toISOString(),
        tolerancia_años: toleranciaAños,
      },
      muestras,
      uf_valor: ufValor,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("[vehicle-appraisal] error:", message);
    return jsonResponse(500, {
      ok: false,
      error: `No fue posible calcular la tasación. ${message}`,
    });
  }
});
