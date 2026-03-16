/// <reference path="../_shared/edge-runtime.d.ts" />
import * as cheerio from "npm:cheerio";
import { corsHeaders } from "../_shared/cors.ts";

type VehicleLookupBody = {
  patente?: string;
};

type VehicleLookupResult = {
  patente: string;
  marca: string;
  modelo: string;
  año: number;
  motor: string | null;
  combustible: string | null;
  transmision: string | null;
  fuente: "autofact" | "boostr" | "chileautos" | "manual";
};

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
  "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
  Referer: "https://www.chileautos.cl/",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizePatente(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isValidChileanPatente(patente: string): boolean {
  return /^[A-Z]{4}\d{2}$/.test(patente);
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

function pickString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function pickNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.match(/\b(19|20)\d{2}\b/);
    if (match) return Number(match[0]);
  }
  return null;
}

function titleCase(value: string | null): string | null {
  if (!value) return null;
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function parseBoostrPayload(payload: unknown, patente: string): VehicleLookupResult | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  const rawData = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const marca = titleCase(
    pickString(rawData.brand) ??
      pickString(rawData.make) ??
      pickString(rawData.marca),
  );
  const modelo = titleCase(
    pickString(rawData.model) ??
      pickString(rawData.modelo),
  );
  const año =
    pickNumber(rawData.year) ??
    pickNumber(rawData.anio) ??
    pickNumber(rawData["año"]);

  if (!marca || !modelo || !año) {
    return null;
  }

  return {
    patente,
    marca,
    modelo,
    año,
    motor: pickString(rawData.engine) ?? pickString(rawData.motor),
    combustible: titleCase(pickString(rawData.fuel) ?? pickString(rawData.combustible)),
    transmision: titleCase(pickString(rawData.transmission) ?? pickString(rawData.transmision)),
    fuente: "boostr",
  };
}

function parseAutofactPayload(payload: unknown, patente: string): VehicleLookupResult | null {
  if (!payload || typeof payload !== "object") return null;

  const raw = payload as Record<string, unknown>;
  const marca = titleCase(pickString(raw.marca) ?? pickString(raw.brand) ?? pickString(raw.make));
  const modelo = titleCase(pickString(raw.modelo) ?? pickString(raw.model));
  const año =
    pickNumber(raw.año) ??
    pickNumber(raw.anio) ??
    pickNumber(raw.year);

  if (!marca || !modelo || !año) {
    return null;
  }

  return {
    patente,
    marca,
    modelo,
    año,
    motor: pickString(raw.motor) ?? pickString(raw.engine),
    combustible: titleCase(pickString(raw.combustible) ?? pickString(raw.fuel)),
    transmision: titleCase(pickString(raw.transmision) ?? pickString(raw.transmission)),
    fuente: "autofact",
  };
}

async function lookupViaAutofactScraper(patente: string): Promise<VehicleLookupResult | null> {
  const scraperUrl = Deno.env.get("AUTOFACT_SCRAPER_URL");
  const scraperToken = Deno.env.get("AUTOFACT_SCRAPER_TOKEN");

  if (!scraperUrl || !scraperToken) return null;

  const response = await fetchWithTimeout(
    scraperUrl,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Internal-Token": scraperToken,
      },
      body: JSON.stringify({ patente }),
    },
    20_000,
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Autofact scraper respondió con ${response.status}${text ? `: ${text}` : ""}`);
  }

  const payload = await response.json().catch(() => null);
  return parseAutofactPayload(payload, patente);
}

async function lookupViaBoostr(patente: string): Promise<VehicleLookupResult | null> {
  const url = `https://api.boostr.cl/vehicle/${encodeURIComponent(patente)}.json`;
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: "application/json,text/plain,*/*",
        Referer: "https://api.boostr.cl/",
      },
    },
    8_000,
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Boostr respondió con ${response.status}`);
  }

  const payload = await response.json().catch(() => null);
  return parseBoostrPayload(payload, patente);
}

async function lookupViaGetApi(patente: string): Promise<VehicleLookupResult | null> {
  const apiKey = Deno.env.get("GETAPI_API_KEY");
  if (!apiKey) return null;

  const response = await fetchWithTimeout(
    `https://chile.getapi.cl/v1/vehicles/plate/${encodeURIComponent(patente)}`,
    {
      headers: {
        Accept: "application/json,text/plain,*/*",
        "X-Api-Key": apiKey,
        Referer: "https://getapi.cl/",
      },
    },
    8_000,
  );

  if (response.status === 404 || response.status === 422) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GetAPI respondió con ${response.status}`);
  }

  const payload = await response.json().catch(() => null);
  return parseBoostrPayload(payload, patente);
}

async function fetchViaScraperApi(url: string) {
  const apiKey = Deno.env.get("SCRAPER_API_KEY");
  if (!apiKey) return null;

  const proxyUrl = `https://api.scraperapi.com?api_key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(url)}&render=true`;
  const response = await fetchWithTimeout(
    proxyUrl,
    {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-CL,es;q=0.9",
      },
    },
    8_000,
  );

  if (!response.ok) {
    throw new Error(`ScraperAPI respondió con ${response.status}`);
  }

  return await response.text();
}

function extractYear(text: string): number | null {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function extractVehicleFromListing(html: string, patente: string): VehicleLookupResult | null {
  const $ = cheerio.load(html);
  const cards = [
    ...$("[data-webm-vr='search-result']").toArray(),
    ...$(".listing-item.card").toArray(),
    ...$(".listing-item").toArray(),
    ...$(".card-item").toArray(),
    ...$("article").toArray(),
  ];

  for (const element of cards) {
    const $card = $(element);
    const cardText = $card.text().replace(/\s+/g, " ").trim();

    if (!cardText) continue;
    if (!cardText.toUpperCase().includes(patente)) {
      const href = $card.find("a[href]").first().attr("href") ?? "";
      if (!href.toUpperCase().includes(patente)) continue;
    }

    const marca = titleCase(
      $card.attr("data-webm-make") ??
        $card.attr("data-make") ??
        null,
    );
    const modelo = titleCase(
      $card.attr("data-webm-model") ??
        $card.attr("data-model") ??
        null,
    );
    const title =
      $card.find("h3 a").first().text().trim() ||
      $card.find("h2 a").first().text().trim() ||
      $card.find("[class*='title'] a").first().text().trim() ||
      $card.find("a[title]").first().attr("title") ||
      "";
    const detailsText = [
      title,
      cardText,
      $card.find("ul.key-details").text(),
    ]
      .filter(Boolean)
      .join(" ");
    const año = extractYear(detailsText);

    const rawTitle = title || cardText;
    const normalizedTitle = rawTitle.replace(/\s+/g, " ").trim();
    const titleWithoutYear = normalizedTitle.replace(/\b(19|20)\d{2}\b/g, "").trim();
    const parts = titleWithoutYear.split(" ").filter(Boolean);
    const fallbackMarca = marca ?? titleCase(parts[0] ?? null);
    const fallbackModelo =
      modelo ??
      titleCase(parts.slice(1).join(" ")) ??
      null;

    if (!fallbackMarca || !fallbackModelo || !año) {
      continue;
    }

    return {
      patente,
      marca: fallbackMarca,
      modelo: fallbackModelo,
      año,
      motor: null,
      combustible: null,
      transmision: null,
      fuente: "chileautos",
    };
  }

  return null;
}

async function lookupViaChileAutos(patente: string): Promise<VehicleLookupResult | null> {
  const urls = [
    `https://www.chileautos.cl/vehiculos/autos/?q=${encodeURIComponent(patente)}`,
    `https://www.chileautos.cl/busqueda/?q=${encodeURIComponent(patente)}`,
  ];

  for (const url of urls) {
    const response = await fetchWithTimeout(url, {}, 8_000);

    if (!response.ok) {
      if ([403, 429, 503].includes(response.status)) {
        try {
          const htmlFromProxy = await fetchViaScraperApi(url);
          if (htmlFromProxy) {
            const foundViaProxy = extractVehicleFromListing(htmlFromProxy, patente);
            if (foundViaProxy) return foundViaProxy;
          }
        } catch (error) {
          console.warn("[vehicle-lookup] proxy fallback falló:", error);
        }
        throw new Error(`ChileAutos bloqueó la búsqueda (${response.status})`);
      }
      continue;
    }

    const html = await response.text();
    const lowered = html.toLowerCase();
    if (
      lowered.includes("captcha") ||
      lowered.includes("cloudflare") ||
      lowered.includes("attention required")
    ) {
      try {
        const htmlFromProxy = await fetchViaScraperApi(url);
        if (htmlFromProxy) {
          const foundViaProxy = extractVehicleFromListing(htmlFromProxy, patente);
          if (foundViaProxy) return foundViaProxy;
        }
      } catch (e) {
        console.warn("[vehicle-lookup] proxy tras captcha falló:", e);
      }
      throw new Error("ChileAutos devolvió una página de protección anti-bot");
    }

    let found = extractVehicleFromListing(html, patente);
    if (found) return found;
    // Directo no encontró la patente; intentar por proxy por si el HTML era incompleto
    try {
      const htmlFromProxy = await fetchViaScraperApi(url);
      if (htmlFromProxy) {
        found = extractVehicleFromListing(htmlFromProxy, patente);
        if (found) return found;
      }
    } catch (e) {
      console.warn("[vehicle-lookup] proxy fallback (sin resultado directo) falló:", e);
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Método no permitido" });
  }

  let body: VehicleLookupBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Body JSON inválido" });
  }

  const patente = normalizePatente(body.patente ?? "");

  if (!isValidChileanPatente(patente)) {
    return jsonResponse(400, {
      ok: false,
      error: "La patente debe tener formato chileno válido, por ejemplo ABCD12.",
    });
  }

  try {
    try {
      const getApiResult = await lookupViaGetApi(patente);
      if (getApiResult) {
        return jsonResponse(200, getApiResult);
      }
    } catch (error) {
      console.warn("[vehicle-lookup] GetAPI falló:", error);
    }

    return jsonResponse(200, {
      found: false,
      error:
        "No se encontraron datos del vehículo para esa patente en GetAPI. Puedes continuar con datos manuales.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("[vehicle-lookup] error:", message);
    return jsonResponse(500, {
      ok: false,
      error: `No fue posible consultar la patente en este momento. ${message}`,
    });
  }
});
