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
    images: unknown;
  } | null;
};

export const consignacionesService = {
  async getAll(filters?: { branchId?: string; status?: string; search?: string }): Promise<ConsignacionWithRelations[]> {
    let query = supabase
      .from("consignaciones")
      .select(
        `
        *,
        lead:leads(id, full_name, phone, email, tags),
        vehicle:vehicles(id, make, model, year, vin, color, images)
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
      query = query.or(
        `owner_name.ilike.%${filters.search}%,owner_phone.ilike.%${filters.search}%,owner_email.ilike.%${filters.search}%,vehicle_make.ilike.%${filters.search}%,vehicle_model.ilike.%${filters.search}%,vehicle_vin.ilike.%${filters.search}%`
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
        vehicle:vehicles(id, make, model, year, vin, color, images)
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
