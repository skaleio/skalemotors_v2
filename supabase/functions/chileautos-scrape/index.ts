/// <reference path="../_shared/edge-runtime.d.ts" />
import * as cheerio from "npm:cheerio";
import { corsHeaders } from "../_shared/cors.ts";

const BASE_URL = "https://www.chileautos.cl/vehiculos/";
const CHILEAUTOS_ORIGIN = "https://www.chileautos.cl";

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: `${CHILEAUTOS_ORIGIN}/`,
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0",
};

type ChileAutosListing = {
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

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildSearchUrl(keyword: string, offset: number): string {
  const q = `(And.Servicio.chileautos._.CarAll.keyword(${keyword.trim().replace(/\s+/g, "+")}).)`;
  const params = new URLSearchParams({
    q,
    sort: "topdeal",
  });
  if (offset > 0) params.set("offset", String(offset));
  return `${BASE_URL}?${params.toString()}`;
}

function parseListings(html: string): ChileAutosListing[] {
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
    if (href) {
      link = href.startsWith("http") ? href : `https://www.chileautos.cl${href.startsWith("/") ? href : "/" + href}`;
    }

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Método no permitido" });
  }

  let body: { q?: string; offset?: number } = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Body JSON inválido" });
  }

  const keyword = typeof body.q === "string" ? body.q : "";
  const offset = Math.max(0, Number(body.offset) || 0);

  if (!keyword.trim()) {
    return jsonResponse(400, { error: "Parámetro 'q' (búsqueda) es requerido" });
  }

  try {
    const url = buildSearchUrl(keyword, offset);
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
    });

    if (!response.ok) {
      const status = response.status;
      let detail = `ChileAutos respondió con ${status}`;
      if (status === 403) detail = "ChileAutos bloqueó la petición (403). Puede ser WAF/antibot.";
      if (status === 503 || status === 502) detail = "ChileAutos no disponible o sobrecargado.";
      return jsonResponse(502, { error: detail, status });
    }

    const html = await response.text();
    if (!html || html.length < 500) {
      return jsonResponse(502, {
        error: "ChileAutos devolvió una página vacía o inesperada. El sitio pudo haber cambiado.",
      });
    }

    let listings: ChileAutosListing[];
    try {
      listings = parseListings(html);
    } catch (parseErr) {
      const parseMsg = parseErr instanceof Error ? parseErr.message : "Error al parsear HTML";
      return jsonResponse(500, {
        error: `Error al parsear listado: ${parseMsg}. ChileAutos pudo haber cambiado la estructura.`,
      });
    }

    return jsonResponse(200, {
      keyword,
      offset,
      total: listings.length,
      listings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse(500, {
      error: message.includes("fetch") ? "No se pudo conectar con ChileAutos. Revisa red o firewall." : `Error: ${message}`,
    });
  }
});
