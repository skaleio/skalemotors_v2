import { supabase } from "../supabase";
import type { ZernioScope } from "@/lib/zernio/rbac";

export type ZernioAccountRow = {
  id: string;
  scope: ZernioScope;
  platform: string;
  zernio_account_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  status: string;
  connected_at: string;
};

export type ZernioPostRow = {
  id: string;
  scope: ZernioScope;
  content: string;
  platforms: Array<{ platform: string; accountId: string }>;
  media_urls: string[];
  scheduled_for: string | null;
  status: string;
  zernio_post_id: string | null;
  published_at: string | null;
  created_at: string;
  created_by: string;
};

function throwIfNotOk(data: unknown, error: unknown): void {
  if (error) throw error;
  if (data && typeof data === "object" && "ok" in data && (data as { ok?: boolean }).ok === false) {
    throw new Error((data as { error?: string }).error ?? "Error en Zernio");
  }
}

export async function getZernioConnectUrl(
  scope: ZernioScope,
  platform: string,
  redirectUrl: string,
): Promise<{ authUrl: string }> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; authUrl?: string; error?: string }>(
    "zernio-connect-url",
    { body: { scope, platform, redirect_url: redirectUrl } },
  );
  throwIfNotOk(data, error);
  if (!data?.authUrl) throw new Error("No se recibió URL de conexión");
  return { authUrl: data.authUrl };
}

export async function syncZernioAccounts(scope: ZernioScope): Promise<{ synced: number }> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; synced?: number; error?: string }>(
    "zernio-accounts-sync",
    { body: { scope } },
  );
  throwIfNotOk(data, error);
  return { synced: data?.synced ?? 0 };
}

export async function listZernioAccounts(scope: ZernioScope): Promise<ZernioAccountRow[]> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; accounts?: ZernioAccountRow[]; error?: string }>(
    "zernio-accounts-list",
    { body: { scope } },
  );
  throwIfNotOk(data, error);
  return data?.accounts ?? [];
}

export async function disconnectZernioAccount(
  scope: ZernioScope,
  zernioAccountId: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("zernio-accounts-disconnect", {
    body: { scope, zernio_account_id: zernioAccountId },
  });
  throwIfNotOk(data, error);
}

export async function createZernioPost(params: {
  scope: ZernioScope;
  content: string;
  platforms: Array<{ platform: string; accountId: string }>;
  publishNow?: boolean;
  scheduledFor?: string;
  mediaUrls?: string[];
}): Promise<{ postId: string; status: string }> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    post_id?: string;
    status?: string;
    error?: string;
  }>("zernio-posts-create", {
    body: {
      scope: params.scope,
      content: params.content,
      platforms: params.platforms,
      publish_now: params.publishNow ?? false,
      scheduled_for: params.scheduledFor,
      media_urls: params.mediaUrls,
    },
  });
  throwIfNotOk(data, error);
  return { postId: data?.post_id ?? "", status: data?.status ?? "draft" };
}

export async function listZernioPosts(scope: ZernioScope, limit = 20): Promise<ZernioPostRow[]> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; posts?: ZernioPostRow[]; error?: string }>(
    "zernio-posts-list",
    { body: { scope, limit } },
  );
  throwIfNotOk(data, error);
  return data?.posts ?? [];
}

export async function getZernioMediaPresign(
  filename: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    uploadUrl?: string;
    publicUrl?: string;
    error?: string;
  }>("zernio-media-presign", {
    body: { filename, content_type: contentType },
  });
  throwIfNotOk(data, error);
  if (!data?.uploadUrl || !data?.publicUrl) {
    throw new Error("Presign incompleto");
  }
  return { uploadUrl: data.uploadUrl, publicUrl: data.publicUrl };
}
