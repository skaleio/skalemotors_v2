import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { zernioFetch } from "./zernioClient.ts";

type ZernioProfileResponse = {
  profile?: { _id?: string };
  _id?: string;
};

export async function getOrCreateOrgZernioProfile(
  admin: SupabaseClient,
  tenantId: string,
  displayName: string,
): Promise<string> {
  const { data: existing } = await admin
    .from("zernio_org_profiles")
    .select("zernio_profile_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existing?.zernio_profile_id) {
    return existing.zernio_profile_id;
  }

  const created = await zernioFetch<ZernioProfileResponse>("/profiles", {
    method: "POST",
    body: {
      name: displayName.slice(0, 120) || `Automotora ${tenantId.slice(0, 8)}`,
      description: "Perfil organizacional Skale Motors",
    },
  });

  const zernioProfileId = created.profile?._id ?? created._id;
  if (!zernioProfileId) {
    throw new Error("Zernio no devolvió profile id");
  }

  const { error } = await admin.from("zernio_org_profiles").upsert(
    {
      tenant_id: tenantId,
      zernio_profile_id: zernioProfileId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error(error.message);

  return zernioProfileId;
}

export async function getOrCreateUserZernioProfile(
  admin: SupabaseClient,
  tenantId: string,
  userId: string,
  displayName: string,
): Promise<string> {
  const { data: existing } = await admin
    .from("zernio_user_profiles")
    .select("zernio_profile_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.zernio_profile_id) {
    return existing.zernio_profile_id;
  }

  const created = await zernioFetch<ZernioProfileResponse>("/profiles", {
    method: "POST",
    body: {
      name: displayName.slice(0, 120) || `Usuario ${userId.slice(0, 8)}`,
      description: "Perfil personal Skale Motors",
    },
  });

  const zernioProfileId = created.profile?._id ?? created._id;
  if (!zernioProfileId) {
    throw new Error("Zernio no devolvió profile id");
  }

  const { error } = await admin.from("zernio_user_profiles").upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      zernio_profile_id: zernioProfileId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);

  return zernioProfileId;
}

export async function resolveZernioProfileId(
  admin: SupabaseClient,
  tenantId: string,
  userId: string,
  scope: "org" | "personal",
  tenantName: string,
  userName: string,
): Promise<string> {
  if (scope === "org") {
    return getOrCreateOrgZernioProfile(admin, tenantId, tenantName);
  }
  return getOrCreateUserZernioProfile(admin, tenantId, userId, userName);
}
