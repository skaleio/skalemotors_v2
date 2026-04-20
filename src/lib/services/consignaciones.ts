import { supabase } from "../supabase";
import type { Database } from "../types/database";

type Consignacion = Database["public"]["Tables"]["consignaciones"]["Row"];
type ConsignacionInsert = Database["public"]["Tables"]["consignaciones"]["Insert"];
type ConsignacionUpdate = Database["public"]["Tables"]["consignaciones"]["Update"];

type ConsignacionWithRelations = Consignacion & {
  lead?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    tags: unknown;
  } | null;
  vehicle?: {
    id: string;
    make: string | null;
    model: string | null;
    year: number | null;
    vin: string | null;
    color: string | null;
    primary_image_url: string | null;
  } | null;
};

/**
 * Servicio de consignaciones.
 * Las consignaciones son persistentes: no se resetean ni se filtran por mes al cerrar el período.
 * La lista siempre incluye todas las consignaciones (salvo filtros por sucursal, estado o búsqueda).
 */
export const consignacionesService = {
  async getAll(filters?: { branchId?: string; status?: string; search?: string }): Promise<ConsignacionWithRelations[]> {
    // No filtrar por fecha/mes: las consignaciones se mantienen históricamente.
    let query = supabase
      .from("consignaciones")
      .select(
        `
        *,
        lead:leads(id, full_name, phone, email, tags),
        vehicle:vehicles(id, make, model, year, vin, color, primary_image_url)
      `
      )
      .order("created_at", { ascending: false });

    if (filters?.branchId) {
      query = query.eq("branch_id", filters.branchId);
    }

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    if (filters?.search) {
      const q = filters.search;
      query = query.or(
        `owner_name.ilike.%${q}%,owner_phone.ilike.%${q}%,owner_email.ilike.%${q}%,vehicle_make.ilike.%${q}%,vehicle_model.ilike.%${q}%,vehicle_vin.ilike.%${q}%,patente.ilike.%${q}%,carroceria.ilike.%${q}%,motor.ilike.%${q}%,transmision.ilike.%${q}%,combustible.ilike.%${q}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching consignaciones:", error);
      throw error;
    }

    if (!data) {
      console.warn("No data returned from consignaciones query");
      return [];
    }

    return data as ConsignacionWithRelations[];
  },

  async create(payload: ConsignacionInsert): Promise<ConsignacionWithRelations> {
    const { data, error } = await supabase
      .from("consignaciones")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("Error creating consignacion:", error);
      throw error;
    }

    if (!data) {
      throw new Error("No data returned after creating consignacion");
    }

    return data as ConsignacionWithRelations;
  },

  async update(id: string, updates: ConsignacionUpdate): Promise<ConsignacionWithRelations> {
    const { data, error } = await supabase
      .from("consignaciones")
      .update(updates)
      .eq("id", id)
      .select(
        `
        *,
        lead:leads(id, full_name, phone, email, tags),
        vehicle:vehicles(id, make, model, year, vin, color, primary_image_url)
      `
      )
      .single();

    if (error) {
      console.error("Error updating consignacion:", error);
      throw error;
    }

    if (!data) {
      throw new Error("No data returned after updating consignacion");
    }

    return data as ConsignacionWithRelations;
  },

  async remove(id: string) {
    const { error } = await supabase.from("consignaciones").delete().eq("id", id);
    if (error) throw error;
  },
};
