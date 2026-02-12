import { supabase } from "../supabase";
import type { Database } from "../types/database";

type TramiteTipo = Database["public"]["Tables"]["tramite_tipos"]["Row"];
type Tramite = Database["public"]["Tables"]["tramites"]["Row"];
type TramiteInsert = Database["public"]["Tables"]["tramites"]["Insert"];
type TramiteUpdate = Database["public"]["Tables"]["tramites"]["Update"];
type AutofactConfig = Database["public"]["Tables"]["autofact_config"]["Row"];

export type TramiteWithRelations = Tramite & {
  tramite_tipo?: TramiteTipo | null;
  vehicle?: { id: string; make: string | null; model: string | null; year: number | null; vin: string } | null;
  lead?: { id: string; full_name: string | null; phone: string | null } | null;
};

export const tramitesService = {
  async getTipos(): Promise<TramiteTipo[]> {
    const { data, error } = await supabase
      .from("tramite_tipos")
      .select("*")
      .order("category");
    if (error) throw error;
    return (data ?? []) as TramiteTipo[];
  },

  async getAll(filters?: { branchId?: string; status?: string; tramiteTipoCode?: string }): Promise<TramiteWithRelations[]> {
    let query = supabase
      .from("tramites")
      .select(
        `
        *,
        tramite_tipo:tramite_tipos(*),
        vehicle:vehicles(id, make, model, year, vin),
        lead:leads(id, full_name, phone)
      `
      )
      .order("created_at", { ascending: false });

    if (filters?.branchId) query = query.eq("branch_id", filters.branchId);
    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.tramiteTipoCode) {
      const { data: tipos } = await supabase.from("tramite_tipos").select("id").eq("code", filters.tramiteTipoCode).single();
      if (tipos?.id) query = query.eq("tramite_tipo_id", tipos.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as TramiteWithRelations[];
    return rows.map((r) => ({
      ...r,
      tramite_tipo: (r as { tramite_tipo?: TramiteTipo }).tramite_tipo ?? null,
      vehicle: (r as { vehicle?: unknown }).vehicle ?? null,
      lead: (r as { lead?: unknown }).lead ?? null,
    }));
  },

  async create(payload: TramiteInsert): Promise<TramiteWithRelations> {
    const { data, error } = await supabase
      .from("tramites")
      .insert(payload)
      .select(
        `
        *,
        tramite_tipo:tramite_tipos(*),
        vehicle:vehicles(id, make, model, year, vin),
        lead:leads(id, full_name, phone)
      `
      )
      .single();
    if (error) throw error;
    return data as TramiteWithRelations;
  },

  async update(id: string, updates: TramiteUpdate): Promise<TramiteWithRelations> {
    const { data, error } = await supabase
      .from("tramites")
      .update(updates)
      .eq("id", id)
      .select(
        `
        *,
        tramite_tipo:tramite_tipos(*),
        vehicle:vehicles(id, make, model, year, vin),
        lead:leads(id, full_name, phone)
      `
      )
      .single();
    if (error) throw error;
    return data as TramiteWithRelations;
  },

  async getAutofactConfig(branchId: string): Promise<AutofactConfig | null> {
    const { data, error } = await supabase
      .from("autofact_config")
      .select("*")
      .eq("branch_id", branchId)
      .maybeSingle();
    if (error) throw error;
    return data as AutofactConfig | null;
  },
};

/** Calcula valor aproximado del permiso de circulación (Chile). Sin API. */
export function calcularValorPermisoCirculacion(avaluoFiscal: number): number {
  if (!avaluoFiscal || avaluoFiscal <= 0) return 0;
  const tasa = 0.025;
  return Math.round(avaluoFiscal * tasa);
}

/** Calcula valor aproximado de la transferencia (Chile). Sin API. */
export function calcularValorTransferencia(precioVenta: number): number {
  if (!precioVenta || precioVenta <= 0) return 0;
  const tasa = 0.015;
  return Math.round(precioVenta * tasa);
}

/** Simula costos de transferencia: timbres + permisos aproximados. Sin API. */
export function simularTransferencia(opts: {
  precioVenta: number;
  avaluoFiscal?: number;
  incluirPermiso?: boolean;
}): { transferencia: number; permiso: number; total: number } {
  const transferencia = calcularValorTransferencia(opts.precioVenta);
  const avaluo = opts.avaluoFiscal ?? Math.round(opts.precioVenta * 0.85);
  const permiso = opts.incluirPermiso !== false ? calcularValorPermisoCirculacion(avaluo) : 0;
  return { transferencia, permiso, total: transferencia + permiso };
}
