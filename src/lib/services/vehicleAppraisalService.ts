import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export interface VehicleData {
  patente: string;
  marca: string;
  modelo: string;
  año: number;
  motor: string | null;
  combustible: string | null;
  transmision: string | null;
  fuente: string;
  kilometraje?: number | null;
}

export interface AppraisalResult {
  tasacion: {
    precio_minimo: number;
    precio_promedio: number;
    precio_maximo: number;
    precio_mediana: number;
    total_muestras: number;
    confianza: "alta" | "media" | "baja";
    fecha_consulta: string;
    tolerancia_años?: number;
  };
  muestras: {
    titulo: string;
    precio: number;
    año: number;
    kilometros: number | null;
    url: string;
  }[];
  uf_valor: number;
  resumen?: string | null;
  /** Precio de retoma sugerido por la API, si está disponible */
  precio_retoma?: number | null;
}

type EdgeErrorResponse = {
  error?: string;
  blocked?: boolean;
  found?: boolean;
};

function normalizePatente(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isFreshWithin24Hours(createdAt: string): boolean {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs <= 24 * 60 * 60 * 1000;
}

async function getAccessToken(): Promise<string> {
  // Refrescar y usar solo la sesión nueva; no usar caché (getSession) que puede tener JWT ya inválido en servidor
  const { data, error } = await supabase.auth.refreshSession();
  const session = data?.session;
  if (error || !session?.access_token) {
    throw new Error("Tu sesión expiró o no es válida. Cierra sesión y vuelve a iniciar sesión para usar la tasación.");
  }
  // Actualizar sesión en el cliente para que futuras llamadas usen el mismo token
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token ?? "",
  });
  return session.access_token;
}

async function getEdgeErrorMessage(error: unknown): Promise<string | null> {
  try {
    const edgeError = error as { context?: Response; message?: string };
    const response = edgeError?.context;
    const msg = edgeError?.message ?? "";
    if (response?.status === 401) {
      return "Sesión expirada o no válida. Cierra sesión y vuelve a iniciar sesión, luego intenta de nuevo.";
    }
    // Función no desplegada o URL incorrecta
    if (/Function not found|404|failed to fetch|Load failed|NetworkError/i.test(msg)) {
      return "La función no está desplegada en Supabase o no es accesible. Despliega/actualiza funciones con: npx supabase functions deploy <nombre-funcion>";
    }
    if (response) {
      const payload = (await response.json()) as EdgeErrorResponse;
      if (payload?.error) return payload.error;
      if (payload?.blocked) {
        return "La fuente externa bloqueó la consulta. Usa «Continuar con datos manuales» o intenta más tarde.";
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Respuesta de una sola petición GetAPI (vehículo + tasación por patente) */
export interface AppraisalByPatenteResult {
  vehicle: VehicleData;
  appraisal: AppraisalResult;
}

/**
 * Una sola petición: llama a la Edge Function getapi-appraisal (que hace GET GetAPI appraisal/{patente}).
 * Usa fetch + anon key para no depender de la sesión del usuario (evita 401).
 */
export async function getAppraisalByPatente(patente: string): Promise<AppraisalByPatenteResult> {
  const normalizedPatente = normalizePatente(patente);
  if (!/^[A-Z]{4}\d{2}$/.test(normalizedPatente)) {
    throw new Error("La patente debe tener formato chileno válido (4 letras + 2 números).");
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Faltan variables de Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }

  const url = `${supabaseUrl}/functions/v1/getapi-appraisal`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ patente: normalizedPatente }),
  });

  const data = (await res.json().catch(() => null)) as
    | (AppraisalResult & { ok?: boolean; error?: string; vehicle?: Partial<VehicleData> } & EdgeErrorResponse)
    | null;

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        "La función de tasación rechazó la petición. Revisa en Supabase que getapi-appraisal esté desplegada y que la anon key sea correcta.",
      );
    }
    const msg = data?.error ?? `Error ${res.status} al obtener la tasación.`;
    throw new Error(msg);
  }

  if (!data?.tasacion || !Array.isArray(data.muestras)) {
    const msg = data?.error ?? "GetAPI no devolvió tasación para esa patente.";
    throw new Error(msg);
  }

  const vehicleFromApi = data.vehicle;
  const vehicle: VehicleData = {
    patente: normalizedPatente,
    marca: vehicleFromApi?.marca ?? "",
    modelo: vehicleFromApi?.modelo ?? "",
    año: vehicleFromApi?.año ?? 0,
    motor: vehicleFromApi?.motor ?? null,
    combustible: vehicleFromApi?.combustible ?? null,
    transmision: vehicleFromApi?.transmision ?? null,
    fuente: "getapi",
    kilometraje: typeof (vehicleFromApi as any)?.kilometraje === "number" ? (vehicleFromApi as any).kilometraje : null,
  };

  const appraisal: AppraisalResult = {
    tasacion: data.tasacion,
    muestras: data.muestras,
    uf_valor: Number(data.uf_valor ?? 0),
    resumen: data.resumen ?? null,
    precio_retoma: (data as any).precio_retoma ?? null,
  };

  return { vehicle, appraisal };
}

/** @deprecated Usar getAppraisalByPatente(patente) para flujo simplificado */
export async function lookupVehicleByPatente(patente: string): Promise<VehicleData> {
  const result = await getAppraisalByPatente(patente);
  return result.vehicle;
}

/** @deprecated Usar getAppraisalByPatente(patente) y usar result.appraisal */
export async function getVehicleAppraisal(
  vehicle: VehicleData,
  _toleranciaAños = 2,
): Promise<AppraisalResult> {
  const result = await getAppraisalByPatente(vehicle.patente);
  return result.appraisal;
}

export async function getCachedAppraisal(
  patente: string,
  branchId: string,
): Promise<AppraisalResult | null> {
  const normalizedPatente = normalizePatente(patente);
  const { data, error } = await supabase
    .from("vehicle_appraisals")
    .select("*")
    .eq("branch_id", branchId)
    .eq("patente", normalizedPatente)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("No fue posible revisar la caché de tasaciones.");
  }

  if (!data || !data.created_at || !isFreshWithin24Hours(data.created_at)) {
    return null;
  }

  return {
    tasacion: {
      precio_minimo: Number(data.precio_minimo ?? 0),
      precio_promedio: Number(data.precio_promedio ?? 0),
      precio_maximo: Number(data.precio_maximo ?? 0),
      precio_mediana: Number(data.precio_mediana ?? 0),
      total_muestras: Number(data.total_muestras ?? 0),
      confianza: (data.confianza as "alta" | "media" | "baja") ?? "baja",
      fecha_consulta: data.created_at,
    },
    muestras: Array.isArray(data.muestras) ? (data.muestras as AppraisalResult["muestras"]) : [],
    uf_valor: Number(data.uf_valor ?? 0),
  };
}

export async function saveAppraisal(
  patente: string,
  vehicle: VehicleData,
  appraisal: AppraisalResult,
  branchId: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    branch_id: branchId,
    user_id: user?.id ?? null,
    patente: normalizePatente(patente),
    marca: vehicle.marca,
    modelo: vehicle.modelo,
    anio: vehicle.año,
    motor: vehicle.motor,
    combustible: vehicle.combustible,
    precio_minimo: appraisal.tasacion.precio_minimo,
    precio_promedio: appraisal.tasacion.precio_promedio,
    precio_maximo: appraisal.tasacion.precio_maximo,
    precio_mediana: appraisal.tasacion.precio_mediana,
    total_muestras: appraisal.tasacion.total_muestras,
    confianza: appraisal.tasacion.confianza,
    muestras: appraisal.muestras,
    uf_valor: appraisal.uf_valor,
  };

  const { error } = await supabase.from("vehicle_appraisals").insert(payload);

  if (error) {
    throw new Error("No fue posible guardar la tasación en Supabase.");
  }
}
