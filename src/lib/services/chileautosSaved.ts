import { supabase } from "../supabase";
import type { Database } from "../types/database";

type SavedRow = Database["public"]["Tables"]["chileautos_saved_listings"]["Row"];
type SavedInsert = Database["public"]["Tables"]["chileautos_saved_listings"]["Insert"];

export type SavedListing = SavedRow;

export type CommercialMetric = {
  make: string;
  model: string;
  label: string;
  count: number;
};

export const chileautosSavedService = {
  async save(listing: {
    listing_id?: string | null;
    listing_url?: string | null;
    title?: string | null;
    make?: string | null;
    model?: string | null;
    price_text?: string | null;
    state?: string | null;
    notes?: string | null;
    branch_id?: string | null;
  }): Promise<SavedRow> {
    const { data: user } = await supabase.auth.getUser();
    const payload: SavedInsert = {
      source: "chileautos",
      listing_id: listing.listing_id ?? null,
      listing_url: listing.listing_url ?? null,
      title: listing.title ?? null,
      make: listing.make ?? null,
      model: listing.model ?? null,
      price_text: listing.price_text ?? null,
      state: listing.state ?? null,
      notes: listing.notes ?? null,
      branch_id: listing.branch_id ?? null,
      user_id: user.data.user?.id ?? null,
    };
    const { data, error } = await supabase
      .from("chileautos_saved_listings")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as SavedRow;
  },

  async getAll(filters?: { branchId?: string | null }): Promise<SavedRow[]> {
    let query = supabase
      .from("chileautos_saved_listings")
      .select("*")
      .order("created_at", { ascending: false });
    if (filters?.branchId) {
      query = query.or(`branch_id.eq.${filters.branchId},branch_id.is.null`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as SavedRow[];
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("chileautos_saved_listings")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  /** Métricas: marca/modelo más guardados (autos más comerciales) */
  async getCommercialMetrics(filters?: { branchId?: string | null }): Promise<CommercialMetric[]> {
    const rows = await this.getAll(filters);
    const byKey = new Map<string, number>();
    for (const r of rows) {
      const make = (r.make || "Sin marca").trim();
      const model = (r.model || "").trim();
      const label = model ? `${make} ${model}` : make;
      const key = `${make}|${model}`;
      byKey.set(key, (byKey.get(key) || 0) + 1);
    }
    return [...byKey.entries()]
      .map(([key, count]) => {
        const [make, model] = key.split("|");
        const label = model ? `${make} ${model}` : make;
        return { make, model, label, count };
      })
      .sort((a, b) => b.count - a.count);
  },
};
