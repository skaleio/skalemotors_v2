import { supabase } from "@/lib/supabase";

export interface VehicleData {
  patente: string;
  marca: string;
  modelo: string;
  año: number;
  motor: string | null;
  combustible: string | null;
  transmision: string | null;
  fuente: string;
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

export async function lookupVehicleByPatente(patente: string): Promise<VehicleData> {
  const normalizedPatente = normalizePatente(patente);
  const accessToken = await getAccessToken();
  const { data, error } = await supabase.functions.invoke<VehicleData & EdgeErrorResponse>("vehicle-lookup", {
    body: { patente: normalizedPatente },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    const message = await getEdgeErrorMessage(error);
    throw new Error(message ?? "No fue posible consultar la patente. Revisa que la función vehicle-lookup esté desplegada.");
  }

  if (!data || ("found" in data && !(data as { found?: boolean }).found)) {
    const msg = (data as { error?: string })?.error ?? "No se encontraron datos para esa patente. Puedes continuar con datos manuales.";
    throw new Error(msg);
  }

  return data;
}

export async function getVehicleAppraisal(
  vehicle: VehicleData,
  toleranciaAños = 2,
): Promise<AppraisalResult> {
  const accessToken = await getAccessToken();

  const valuationInvoke = await supabase.functions.invoke<
    {
      tasacion?: AppraisalResult["tasacion"];
      muestras?: AppraisalResult["muestras"];
      uf_valor?: number;
      resumen?: string | null;
      error?: string;
      blocked?: boolean;
    } & EdgeErrorResponse
  >("vehicle-valuation", {
    body: {
      patente: vehicle.patente,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      año: vehicle.año,
      toleranciaAños,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!valuationInvoke.error) {
    const valuationData = valuationInvoke.data;
    if (valuationData?.tasacion && Array.isArray(valuationData.muestras)) {
      return {
        tasacion: valuationData.tasacion,
        muestras: valuationData.muestras,
        uf_valor: Number(valuationData.uf_valor ?? 0),
        resumen: valuationData.resumen ?? null,
      };
    }
    if (valuationData?.blocked) {
      throw new Error(
        valuationData.error ??
          "La fuente externa bloqueó la consulta. Intenta nuevamente o usa comparables manuales.",
      );
    }
    if (valuationData?.error) {
      throw new Error(valuationData.error);
    }
  } else {
    const rawMessage = (valuationInvoke.error as { message?: string } | null)?.message ?? "";
    const missingFunction = /Function not found|404/i.test(rawMessage);
    if (!missingFunction) {
      const message = await getEdgeErrorMessage(valuationInvoke.error);
      throw new Error(message ?? "No fue posible calcular la tasación.");
    }
  }

  // Fallback legacy si vehicle-valuation aún no está desplegada.
  const { data, error } = await supabase.functions.invoke<
    AppraisalResult & EdgeErrorResponse & { source?: string }
  >("vehicle-appraisal", {
    body: {
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      año: vehicle.año,
      toleranciaAños,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    const message = await getEdgeErrorMessage(error);
    throw new Error(message ?? "No fue posible calcular la tasación.");
  }

  if (!data?.tasacion || !Array.isArray(data.muestras)) {
    if (data?.blocked) {
      throw new Error(
        data.error ??
          "La fuente externa bloqueó la consulta. Intenta nuevamente o usa un flujo manual.",
      );
    }
    throw new Error(data?.error ?? "La función devolvió una respuesta inválida.");
  }

  return data;
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
