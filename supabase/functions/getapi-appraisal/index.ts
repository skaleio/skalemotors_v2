/// <reference path="../_shared/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { summarizeListings, type RawListing } from "./market.ts";

type AppraisalBody = {
  patente?: string;
  /**
   * "appraisal" (default): requiere tasación con precio (página de Tasación).
   * "vehicle": solo datos del vehículo para autollenar consignación/inventario;
   * devuelve ok:true aunque GetAPI no tenga precio de tasación.
   */
  mode?: "appraisal" | "vehicle";
};

type GetApiVehicle = {
  licensePlate?: string | null;
  modelId?: string | null;
  version?: string | null;
  mileage?: number | null;
  color?: string | null;
  year?: number | null;
  vinNumber?: string | null;
  engineNumber?: string | null;
  engine?: string | null;
  fuel?: string | null;
  transmission?: string | null;
  doors?: number | null;
  urlImage?: string | null;
  model?: {
    name?: string | null;
    brand?: {
      name?: string | null;
    } | null;
    typeVehicle?: {
      name?: string | null;
    } | null;
  } | null;
  monthRT?: string | null;
};

type GetApiAppraisalResponse = {
  success?: boolean;
  status?: number;
  data?: {
    vehicleId?: string;
    informacionFiscal?: {
      codigo?: string | null;
      permiso?: string | null;
      tasacion?: number | null;
      ano_info_fiscal?: number | null;
    } | null;
    precioUsado?: {
      precio?: number | null;
      banda_max?: number | null;
      banda_min?: number | null;
    } | null;
    precioRetoma?: number | null;
    vehicle?: GetApiVehicle | null;
  } | null;
};

type GetApiPlateResponse = {
  success?: boolean;
  status?: number;
  data?: (GetApiVehicle & { version?: string | null }) | null;
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

// Acepta los formatos PPU chilenos: auto antiguo (AB1234), auto actual
// (BCDF12), comercial (ABC123) y motos (AB123 / ABC12).
function isValidChileanPatente(patente: string): boolean {
  return /^([A-Z]{2}\d{4}|[A-Z]{4}\d{2}|[A-Z]{3}\d{3}|[A-Z]{2}\d{3}|[A-Z]{3}\d{2})$/.test(patente);
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function pickNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

const CHILEAUTOS_BASE = "https://www.chileautos.cl/vehiculos/";
const SCRAPE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SCRAPE_TIMEOUT_MS = 8000;

function buildChileautosSearchUrl(keyword: string): string {
  const q = `(And.Servicio.chileautos._.CarAll.keyword(${keyword.trim().replace(/\s+/g, "+")}).)`;
  const params = new URLSearchParams({ q, sort: "topdeal" });
  return `${CHILEAUTOS_BASE}?${params.toString()}`;
}

/**
 * Scrapea anuncios reales de Chileautos por palabra clave (marca + modelo).
 * Devuelve [] ante cualquier error/bloqueo: el flujo cae a la tasación GetAPI.
 */
async function scrapeChileautosListings(keyword: string): Promise<RawListing[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
  try {
    const res = await fetch(buildChileautosSearchUrl(keyword), {
      headers: {
        "User-Agent": SCRAPE_USER_AGENT,
        "Accept-Language": "es-CL,es;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) return [];

    const listings: RawListing[] = [];
    doc.querySelectorAll(".listing-item.card").forEach((node) => {
      const el = node as unknown as Element;
      const precioRaw =
        el.getAttribute("data-webm-price") ||
        el.querySelector(".item-price .price a")?.textContent?.trim() ||
        null;
      const titleEl = el.querySelector("h3 a[data-webm-clickvalue='sv-title']");
      const titulo = titleEl?.textContent?.trim() ?? "";
      const href = titleEl?.getAttribute("href") ?? null;
      const url = href
        ? href.startsWith("http")
          ? href
          : `https://www.chileautos.cl${href.startsWith("/") ? href : "/" + href}`
        : null;
      const detalles: string[] = [];
      el.querySelectorAll("ul.key-details li").forEach((li) => {
        const t = (li as unknown as Element).textContent?.trim();
        if (t) detalles.push(t);
      });
      if (titulo || precioRaw) {
        listings.push({ precioRaw, titulo, detalles, url });
      }
    });
    return listings;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Método no permitido" });
  }

  // verify_jwt:false en config.toml porque el gateway rechaza JWT ES256 del proyecto.
  // Validamos manualmente: rechaza anon key y cualquier request sin sesión de usuario.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse(500, { ok: false, error: "Supabase no configurado" });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return jsonResponse(401, { ok: false, error: "Authorization header required" });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: userData, error: authError } = await adminClient.auth.getUser(jwt);
  if (authError || !userData?.user) {
    return jsonResponse(401, { ok: false, error: "Invalid or expired token" });
  }

  // Rate limit por usuario: 30/min (protege la API paga GetAPI de abuso).
  const limited = await enforceRateLimit(
    adminClient,
    { identifier: `user:${userData.user.id}`, route: "getapi-appraisal", max: 30, windowSeconds: 60 },
    corsHeaders,
  );
  if (limited) return limited;

  let body: AppraisalBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Body JSON inválido" });
  }

  const mode: "appraisal" | "vehicle" = body.mode === "vehicle" ? "vehicle" : "appraisal";

  const patente = normalizePatente(body.patente ?? "");
  if (!isValidChileanPatente(patente)) {
    return jsonResponse(400, {
      ok: false,
      error: "La patente debe tener formato chileno válido (ej: BCDF12, AB1234 o ABC12).",
    });
  }

  const apiKey = Deno.env.get("GETAPI_API_KEY");
  if (!apiKey) {
    return jsonResponse(503, {
      ok: false,
      error:
        "GETAPI_API_KEY no está configurada en Supabase. Configura tu API key de GetAPI en los secrets de Edge Functions.",
    });
  }

  const getApiHeaders = {
    Accept: "application/json",
    "X-Api-Key": apiKey,
    Referer: "https://getapi.cl/",
  };

  try {
    const response = await fetch(
      `https://chile.getapi.cl/v1/vehicles/appraisal/${encodeURIComponent(patente)}`,
      { method: "GET", headers: getApiHeaders },
    );

    // En modo "appraisal" un error del endpoint de tasación es terminal.
    // En modo "vehicle" seguimos: el endpoint de placa puede tener los datos.
    if (response.status === 404) {
      if (mode === "appraisal") {
        return jsonResponse(200, { ok: false, error: "GetAPI no encontró tasación para esa patente." });
      }
    } else if (!response.ok) {
      const text = await response.text();
      if (mode === "appraisal") {
        return jsonResponse(response.status, {
          ok: false,
          error: `GetAPI respondió con ${response.status}. Respuesta: ${text.slice(0, 500)}`,
        });
      }
    }

    let payload: GetApiAppraisalResponse | null = null;
    if (response.ok) {
      payload = (await response.json()) as GetApiAppraisalResponse;
      if ((!payload?.success || !payload.data) && mode === "appraisal") {
        return jsonResponse(200, { ok: false, error: "La API de GetAPI no devolvió una tasación válida." });
      }
    }

    const data = payload?.success ? (payload.data ?? null) : null;
    const fiscal = data?.informacionFiscal ?? {};
    const precioUsado = data?.precioUsado ?? {};
    const veh = data?.vehicle ?? {};
    const model = veh.model ?? {};
    const brand = model.brand ?? {};

    // Llamado adicional al endpoint de placa para obtener datos más detallados (especialmente kilometraje).
    let plate: GetApiPlateResponse["data"] | null = null;
    let plateStatus = 0;
    try {
      const plateResponse = await fetch(
        `https://chile.getapi.cl/v1/vehicles/plate/${encodeURIComponent(patente)}`,
        { method: "GET", headers: getApiHeaders },
      );
      plateStatus = plateResponse.status;

      if (plateResponse.ok) {
        const platePayload = (await plateResponse.json()) as GetApiPlateResponse;
        if (platePayload?.success && platePayload.data) {
          plate = platePayload.data;
        }
      }
    } catch {
      // Si falla el endpoint de placa, seguimos sin interrumpir el flujo.
      plate = null;
    }

    // 401/403 = la key de GetAPI está rechazada/bloqueada (no es "patente inexistente").
    const sourceAuthBlocked = [401, 403].includes(response.status) || [401, 403].includes(plateStatus);

    const plateModel = plate?.model ?? {};
    const plateBrand = plateModel.brand ?? {};
    const plateType = plateModel.typeVehicle ?? {};
    const apiType = model.typeVehicle ?? {};

    // Datos del vehículo: priorizamos placa (registro civil) y caemos a tasación.
    const vehicle = {
      patente,
      marca: cleanText(brand.name ?? plateBrand.name),
      modelo: cleanText(model.name ?? plateModel.name),
      año: veh.year ?? fiscal.ano_info_fiscal ?? plate?.year ?? null,
      motor: plate?.engine ?? veh.engine ?? null,
      combustible: cleanText(plate?.fuel ?? veh.fuel),
      transmision: cleanText(plate?.transmission ?? veh.transmission),
      version: cleanText(veh.version ?? plate?.version),
      kilometraje: plate?.mileage ?? veh.mileage ?? null,
      color: cleanText(plate?.color ?? veh.color),
      n_motor: cleanText(plate?.engineNumber ?? veh.engineNumber),
      n_chasis: cleanText(plate?.vinNumber ?? veh.vinNumber),
      // Campos adicionales que entrega GetAPI
      tipo_vehiculo: cleanText(apiType.name ?? plateType.name),
      puertas: plate?.doors ?? veh.doors ?? null,
      mes_revision_tecnica: cleanText(plate?.monthRT ?? veh.monthRT),
      foto_url: cleanText(plate?.urlImage ?? veh.urlImage),
      tasacion_fiscal: pickNumber(fiscal.tasacion),
      codigo_sii: cleanText(fiscal.codigo),
    };

    const baseTasacion =
      pickNumber(precioUsado.precio) ??
      pickNumber(precioUsado.banda_min) ??
      pickNumber(precioUsado.banda_max) ??
      pickNumber(fiscal.tasacion);

    // ── Modo vehicle: autollenado de consignación/inventario (no requiere precio) ──
    if (mode === "vehicle") {
      const hasVehicleData = Boolean(vehicle.marca || vehicle.modelo || vehicle.n_chasis || vehicle.año);
      if (!hasVehicleData) {
        if (sourceAuthBlocked) {
          return jsonResponse(200, {
            ok: false,
            code: "SOURCE_UNAVAILABLE",
            error:
              "El servicio de datos por patente (GetAPI) rechazó la consulta: la API key no es válida o está bloqueada. Avisá a soporte para renovarla — no es un problema de la patente.",
          });
        }
        return jsonResponse(200, {
          ok: false,
          code: "NOT_FOUND",
          error: "GetAPI no tiene datos de este vehículo para esa patente.",
        });
      }
      return jsonResponse(200, {
        ok: true,
        vehicle: {
          ...vehicle,
          año: vehicle.año ?? new Date().getFullYear(),
        },
        fuente: "getapi",
        precio_retoma: data?.precioRetoma ?? null,
        tasacion_disponible: Boolean(baseTasacion),
      });
    }

    // ── Modo appraisal: tasación completa (página de Tasación) ──
    if (!baseTasacion) {
      return jsonResponse(200, {
        ok: false,
        error: "GetAPI devolvió información sin precios de tasación utilizables.",
      });
    }

    const currentYear = new Date().getFullYear();
    const añoVehiculo = veh.year ?? fiscal.ano_info_fiscal ?? plate?.year ?? null;

    // Referencia GetAPI / fiscal: siempre disponible, se muestra junto al mercado.
    const referencia = {
      precio_getapi: pickNumber(precioUsado.precio),
      banda_min: pickNumber(precioUsado.banda_min),
      banda_max: pickNumber(precioUsado.banda_max),
      tasacion_fiscal: pickNumber(fiscal.tasacion),
      precio_retoma: pickNumber(data?.precioRetoma),
      permiso_circulacion: cleanText(fiscal.permiso) || null,
      ano_info_fiscal: pickNumber(fiscal.ano_info_fiscal),
    };

    // Valor de mercado real: anuncios reales de Chileautos filtrados por año ±2.
    const searchKeyword = cleanText(
      `${brand.name ?? plateBrand.name ?? ""} ${model.name ?? plateModel.name ?? ""}`,
    );
    const rawListings = searchKeyword ? await scrapeChileautosListings(searchKeyword) : [];
    const market = summarizeListings(
      rawListings,
      typeof añoVehiculo === "number" ? añoVehiculo : null,
      currentYear,
      2,
    );
    const mercadoDisponible = market.total_muestras > 0;

    // Tasación primaria: mercado real si hay muestras; si no, fallback a GetAPI.
    const tasacion = mercadoDisponible
      ? {
          precio_minimo: market.precio_minimo,
          precio_promedio: market.precio_promedio,
          precio_maximo: market.precio_maximo,
          precio_mediana: market.precio_mediana,
          total_muestras: market.total_muestras,
          confianza: market.confianza,
          fecha_consulta: new Date().toISOString(),
          tolerancia_años: 2,
          fuente: "mercado" as const,
        }
      : {
          precio_minimo:
            pickNumber(precioUsado.banda_min) ?? pickNumber(precioUsado.precio) ?? baseTasacion,
          precio_promedio: pickNumber(precioUsado.precio) ?? baseTasacion,
          precio_maximo:
            pickNumber(precioUsado.banda_max) ?? pickNumber(precioUsado.precio) ?? baseTasacion,
          precio_mediana: pickNumber(precioUsado.precio) ?? baseTasacion,
          total_muestras: 0,
          confianza: "baja" as const,
          fecha_consulta: new Date().toISOString(),
          tolerancia_años: 0,
          fuente: "getapi" as const,
        };

    return jsonResponse(200, {
      ok: true,
      tasacion,
      muestras: market.muestras,
      mercado_disponible: mercadoDisponible,
      referencia,
      uf_valor: 0,
      vehicle: {
        ...vehicle,
        año: vehicle.año ?? currentYear,
      },
      fuente: "getapi",
      informacion_fiscal: fiscal,
      precio_retoma: data?.precioRetoma ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("[getapi-appraisal] error:", message);
    return jsonResponse(500, {
      ok: false,
      error: `No fue posible obtener la tasación desde GetAPI. ${message}`,
    });
  }
});
