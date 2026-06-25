import type { ZernioScope } from "@/lib/zernio/rbac";
import {
  disconnectZernioAccountInDb,
  listZernioAccountsFromDb,
  listZernioPostsFromDb,
} from "./zernioAccounts";
import { invokeZernioFunction } from "./zernioInvoke";

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

function extractZernioAuthUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  const direct = row.authUrl ?? row.auth_url ?? row.url;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = row.data;
  if (nested && typeof nested === "object") {
    const inner = nested as Record<string, unknown>;
    const nestedUrl = inner.authUrl ?? inner.auth_url ?? inner.url;
    if (typeof nestedUrl === "string" && nestedUrl.trim()) return nestedUrl.trim();
  }
  return null;
}

export async function getZernioConnectUrl(
  scope: ZernioScope,
  platform: string,
  redirectUrl: string,
): Promise<{ authUrl: string }> {
  const data = await invokeZernioFunction<{
    ok: boolean;
    authUrl?: string;
    auth_url?: string;
    error?: string;
  }>("zernio-connect-url", { scope, platform, redirect_url: redirectUrl }, 18_000);

  const authUrl = extractZernioAuthUrl(data);
  if (!authUrl) throw new Error("No se recibió URL de conexión");
  if (!/^https?:\/\//i.test(authUrl)) {
    throw new Error("La URL de OAuth recibida no es válida");
  }
  return { authUrl };
}

export async function syncZernioAccounts(scope: ZernioScope): Promise<{ synced: number }> {
  const data = await invokeZernioFunction<{ ok: boolean; synced?: number; error?: string }>(
    "zernio-accounts-sync",
    { scope },
  );
  return { synced: data.synced ?? 0 };
}

export async function listZernioAccounts(scope: ZernioScope): Promise<ZernioAccountRow[]> {
  return listZernioAccountsFromDb(scope);
}

export async function disconnectZernioAccount(
  scope: ZernioScope,
  zernioAccountId: string,
): Promise<void> {
  await disconnectZernioAccountInDb(scope, zernioAccountId);
}

export async function createZernioPost(params: {
  scope: ZernioScope;
  content: string;
  platforms: Array<{ platform: string; accountId: string }>;
  publishNow?: boolean;
  scheduledFor?: string;
  mediaUrls?: string[];
  vehicleId?: string | null;
}): Promise<{ postId: string; status: string }> {
  const data = await invokeZernioFunction<{
    ok: boolean;
    post_id?: string;
    status?: string;
    error?: string;
  }>("zernio-posts-create", {
    scope: params.scope,
    content: params.content,
    platforms: params.platforms,
    publish_now: params.publishNow ?? false,
    scheduled_for: params.scheduledFor,
    media_urls: params.mediaUrls,
    vehicle_id: params.vehicleId ?? null,
  });
  return { postId: data.post_id ?? "", status: data.status ?? "draft" };
}

export async function listZernioPosts(scope: ZernioScope, limit = 20): Promise<ZernioPostRow[]> {
  return listZernioPostsFromDb(scope, limit);
}

export async function getZernioMediaPresign(
  filename: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const data = await invokeZernioFunction<{
    ok: boolean;
    uploadUrl?: string;
    publicUrl?: string;
    error?: string;
  }>("zernio-media-presign", {
    filename,
    content_type: contentType,
  });
  if (!data.uploadUrl || !data.publicUrl) {
    throw new Error("Presign incompleto");
  }
  return { uploadUrl: data.uploadUrl, publicUrl: data.publicUrl };
}
