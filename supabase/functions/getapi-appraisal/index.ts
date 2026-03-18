/// <reference path="../_shared/edge-runtime.d.ts" />
import { corsHeaders } from "../_shared/cors.ts";

type AppraisalBody = {
  patente?: string;
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
    vehicle?: {
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
    } | null;
  } | null;
};

type GetApiPlateResponse = {
  success?: boolean;
  status?: number;
  data?: {
    licensePlate?: string | null;
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
  } | null;
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

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function pickNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
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

  const patente = normalizePatente(body.patente ?? "");
  if (!isValidChileanPatente(patente)) {
    return jsonResponse(400, {
      ok: false,
      error: "La patente debe tener formato chileno válido, por ejemplo ABCD12.",
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

  try {
    const response = await fetch(`https://chile.getapi.cl/v1/vehicles/appraisal/${encodeURIComponent(patente)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
        Referer: "https://getapi.cl/",
      },
    });

    if (response.status === 404) {
      return jsonResponse(200, {
        ok: false,
        error: "GetAPI no encontró tasación para esa patente.",
      });
    }

    if (!response.ok) {
      const text = await response.text();
      return jsonResponse(response.status, {
        ok: false,
        error: `GetAPI respondió con ${response.status}. Respuesta: ${text.slice(0, 500)}`,
      });
    }

    const payload = (await response.json()) as GetApiAppraisalResponse;
    if (!payload?.success || !payload.data) {
      return jsonResponse(200, {
        ok: false,
        error: "La API de GetAPI no devolvió una tasación válida.",
      });
    }

    const fiscal = payload.data.informacionFiscal ?? {};
    const precioUsado = payload.data.precioUsado ?? {};
    const veh = payload.data.vehicle ?? {};
    const model = veh.model ?? {};
    const brand = model.brand ?? {};

    // Llamado adicional al endpoint de placa para obtener datos más detallados (especialmente kilometraje)
    let plate: GetApiPlateResponse["data"] | null = null;
    try {
      const plateResponse = await fetch(
        `https://chile.getapi.cl/v1/vehicles/plate/${encodeURIComponent(patente)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "X-Api-Key": apiKey,
            Referer: "https://getapi.cl/",
          },
        },
      );

      if (plateResponse.ok) {
        const platePayload = (await plateResponse.json()) as GetApiPlateResponse;
        if (platePayload?.success && platePayload.data) {
          plate = platePayload.data;
        }
      }
    } catch {
      // Si falla el endpoint de placa, seguimos con la tasación sin interrumpir el flujo
      plate = null;
    }

    const baseTasacion =
      pickNumber(precioUsado.precio) ??
      pickNumber(precioUsado.banda_min) ??
      pickNumber(precioUsado.banda_max) ??
      pickNumber(fiscal.tasacion);

    if (!baseTasacion) {
      return jsonResponse(200, {
        ok: false,
        error: "GetAPI devolvió información sin precios de tasación utilizables.",
      });
    }

    const precioMinimo =
      pickNumber(precioUsado.banda_min) ??
      pickNumber(precioUsado.precio) ??
      pickNumber(fiscal.tasacion) ??
      baseTasacion;
    const precioMaximo =
      pickNumber(precioUsado.banda_max) ??
      pickNumber(precioUsado.precio) ??
      pickNumber(fiscal.tasacion) ??
      baseTasacion;
    const precioPromedio = pickNumber(precioUsado.precio) ?? baseTasacion;
    const precioMediana = precioPromedio;

    const titulo = cleanText(
      `${brand.name ?? ""} ${model.name ?? ""} ${veh.version ?? ""}`.replace(/\s+/g, " "),
    );

    const searchBrand = cleanText(brand.name);
    const searchModel = cleanText(model.name);
    const searchYear = veh.year ?? fiscal.ano_info_fiscal ?? plate?.year ?? null;
    const searchKm = plate?.mileage ?? veh.mileage ?? null;

    // Construimos una URL de búsqueda a Chileautos usando el formato avanzado del parámetro q
    // Ejemplo: https://www.chileautos.cl/vehiculos/?q=(And.(C.Marca.Hyundai._.Modelo.Grand+I10.)_.Ano.range(2020..2023)._.Kilometraje.range(90000..110000).)
    let chileautosUrl = "https://www.chileautos.cl/vehiculos/";
    try {
      const marcaToken = searchBrand.split(" ")[0] ?? "";
      const modeloToken = searchModel.replace(/\s+/g, "+");
      const filters: string[] = [];

      if (marcaToken || modeloToken) {
        filters.push(`(C.Marca.${marcaToken}._.Modelo.${modeloToken}.)`);
      }

      if (typeof searchYear === "number" && Number.isFinite(searchYear)) {
        const yMin = searchYear - 1;
        const yMax = searchYear + 1;
        filters.push(`Ano.range(${yMin}..${yMax}).`);
      }

      if (typeof searchKm === "number" && Number.isFinite(searchKm) && searchKm > 0) {
        const kmMin = Math.max(0, Math.round(searchKm - 20000));
        const kmMax = Math.round(searchKm + 20000);
        filters.push(`Kilometraje.range(${kmMin}..${kmMax}).`);
      }

      if (filters.length > 0) {
        const qRaw = `(And.${filters.join("_.")})`;
        const encoded = encodeURIComponent(qRaw).replace(/%20/g, "+");
        chileautosUrl = `https://www.chileautos.cl/vehiculos/?q=${encoded}`;
      }
    } catch {
      // Si algo falla al construir la URL avanzada, dejamos la URL base de Chileautos
      chileautosUrl = "https://www.chileautos.cl/vehiculos/";
    }

    const muestra = {
      titulo: titulo || `Referencia GetAPI ${patente}`,
      precio: precioPromedio,
      año: veh.year ?? fiscal.ano_info_fiscal ?? plate?.year ?? new Date().getFullYear(),
      kilometros: plate?.mileage ?? veh.mileage ?? null,
      url: chileautosUrl,
    };

    return jsonResponse(200, {
      ok: true,
      tasacion: {
        precio_minimo: precioMinimo,
        precio_promedio: precioPromedio,
        precio_maximo: precioMaximo,
        precio_mediana: precioMediana,
        total_muestras: 1,
        confianza: "alta",
        fecha_consulta: new Date().toISOString(),
        tolerancia_años: 0,
      },
      muestras: [muestra],
      uf_valor: 0,
      vehicle: {
        patente,
        marca: cleanText(brand.name),
        modelo: cleanText(model.name),
        año: veh.year ?? fiscal.ano_info_fiscal ?? plate?.year ?? new Date().getFullYear(),
        motor: plate?.engine ?? veh.engine ?? null,
        combustible: cleanText(plate?.fuel ?? veh.fuel),
        transmision: cleanText(plate?.transmission ?? veh.transmission),
        version: cleanText(veh.version ?? plate?.version),
        kilometraje: plate?.mileage ?? veh.mileage ?? null,
      },
      fuente: "getapi",
      informacion_fiscal: fiscal,
      precio_retoma: payload.data.precioRetoma ?? null,
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

