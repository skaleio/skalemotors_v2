import { supabase } from "../supabase";
import type { ZernioScope } from "@/lib/zernio/rbac";
import type { ZernioAccountRow, ZernioPostRow } from "./zernioApi";

const ACCOUNT_COLUMNS =
  "id, scope, platform, zernio_account_id, display_name, username, avatar_url, status, connected_at";

const POST_COLUMNS =
  "id, scope, content, platforms, media_urls, scheduled_for, status, zernio_post_id, published_at, created_at, created_by";

/** Listado rápido vía Postgres + RLS (sin Edge Function). */
export async function listZernioAccountsFromDb(scope: ZernioScope): Promise<ZernioAccountRow[]> {
  const { data, error } = await supabase
    .from("zernio_accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("scope", scope)
    .eq("status", "active")
    .order("connected_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ZernioAccountRow[];
}

export async function disconnectZernioAccountInDb(
  scope: ZernioScope,
  zernioAccountId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("zernio_accounts")
    .update({ status: "disconnected" })
    .eq("scope", scope)
    .eq("zernio_account_id", zernioAccountId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Cuenta no encontrada");
}

export async function listZernioPostsFromDb(scope: ZernioScope, limit = 20): Promise<ZernioPostRow[]> {
  const { data, error } = await supabase
    .from("zernio_posts")
    .select(POST_COLUMNS)
    .eq("scope", scope)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as ZernioPostRow[];
}
