import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { supabase } from "@/lib/supabase";

type LeadIngestFunctions = Pick<
  Database["public"]["Functions"],
  "list_lead_ingest_keys" | "mint_lead_ingest_key" | "revoke_lead_ingest_key"
> & {
  // RPCs de claves de tenant (branch_id NULL) para el conector MCP. Aún no están en
  // database.ts generado; se tipan a mano para no forzar regen del schema completo.
  mint_lead_ingest_key_tenant: { Args: { p_label?: string }; Returns: unknown };
  list_lead_ingest_keys_tenant: { Args: Record<string, never>; Returns: unknown };
};

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

/** Clave de TENANT (branch_id NULL) para el conector MCP de Claude. */
export function rpcMintLeadIngestKeyTenant(p_label: string) {
  return leadIngestRpcClient.rpc("mint_lead_ingest_key_tenant", { p_label });
}

/** Lista las claves de tenant activas del concesionario del usuario. */
export function rpcListLeadIngestKeysTenant() {
  return leadIngestRpcClient.rpc("list_lead_ingest_keys_tenant", {});
}
