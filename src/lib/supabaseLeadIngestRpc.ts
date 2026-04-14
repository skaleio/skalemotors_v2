import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { supabase } from "@/lib/supabase";

type LeadIngestFunctions = Pick<
  Database["public"]["Functions"],
  "list_lead_ingest_keys" | "mint_lead_ingest_key" | "revoke_lead_ingest_key"
>;

/**
 * El tipo `Database` del repo no declara `Relationships` en cada tabla; con supabase-js 2.57
 * eso hace que `public` no extienda `GenericSchema` y `rpc()` quede como `never`.
 * Este esquema mínimo solo para RPC de ingesta de leads.
 */
type LeadIngestRpcSchema = {
  public: {
    Tables: {
      _lead_ingest_rpc_placeholder: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: {
      _lead_ingest_rpc_placeholder: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
    };
    Functions: LeadIngestFunctions;
  };
};

const leadIngestRpcClient = supabase as unknown as SupabaseClient<LeadIngestRpcSchema>;

export function rpcListLeadIngestKeys(p_branch_id: string) {
  return leadIngestRpcClient.rpc("list_lead_ingest_keys", { p_branch_id });
}

export function rpcMintLeadIngestKey(args: { p_branch_id: string; p_label: string }) {
  return leadIngestRpcClient.rpc("mint_lead_ingest_key", args);
}

export function rpcRevokeLeadIngestKey(p_key_id: string) {
  return leadIngestRpcClient.rpc("revoke_lead_ingest_key", { p_key_id });
}
