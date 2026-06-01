import { createBrowserAuthStorage } from "@/lib/safeStorage";
import { clearTenantContext, clearTenantContextStorageOnly } from "@/lib/tenant";
import { supabaseUrl } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Margen antes de expiry del access token (no implica cerrar sesión si hay refresh_token). */
const EXPIRY_SKEW_SEC = 30;

/** Clave de storage que usa GoTrue (sb-<projectRef>-auth-token). */
export function getSupabaseAuthStorageKey(): string {
  if (!supabaseUrl) return "sb-auth-token";
  try {
    const host = new URL(supabaseUrl).hostname;
    const projectRef = host.split(".")[0];
    return `sb-${projectRef}-auth-token`;
  } catch {
    return "sb-auth-token";
  }
}

/** Lee la sesión persistida sin disparar refresh de red (solo storage). */
export function readPersistedAuthSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = createBrowserAuthStorage().getItem(getSupabaseAuthStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session | { currentSession?: Session | null } | null;
    if (!parsed || typeof parsed !== "object") return null;
    if ("currentSession" in parsed) {
      return parsed.currentSession ?? null;
    }
    if ("access_token" in parsed && typeof (parsed as Session).access_token === "string") {
      return parsed as Session;
    }
    return null;
  } catch {
    return null;
  }
}

/** Access JWT vencido (normal tras ~1h). Con refresh_token la sesión sigue siendo recuperable. */
export function isAccessTokenExpired(
  session: Pick<Session, "expires_at"> | null | undefined,
  skewSec = EXPIRY_SKEW_SEC,
): boolean {
  if (!session?.expires_at) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return session.expires_at <= nowSec + skewSec;
}

export function canRefreshPersistedSession(
  session: Pick<Session, "refresh_token"> | null | undefined,
): boolean {
  return Boolean(session?.refresh_token);
}

/**
 * Solo borra storage cuando no hay forma de renovar (sin refresh_token).
 * No usar cuando solo venció el access token: eso obliga a login diario.
 */
export async function purgeUnrecoverablePersistedSession(
  client: Pick<SupabaseClient, "auth">,
): Promise<boolean> {
  const persisted = readPersistedAuthSession();
  if (!persisted) return false;
  if (canRefreshPersistedSession(persisted)) return false;
  await fastLocalSignOut(client);
  return true;
}

/** @deprecated Usar purgeUnrecoverablePersistedSession — ya no purga por access token vencido. */
export async function purgeExpiredPersistedSession(
  client: Pick<SupabaseClient, "auth">,
): Promise<boolean> {
  return purgeUnrecoverablePersistedSession(client);
}

export type FastLocalSignOutOptions = {
  /** Conserva skale.user-profile.* (re-login rápido del mismo usuario en dev). */
  preserveProfileCaches?: boolean;
};

/** Cierra sesión solo en este navegador (sin round-trip de revocación). */
export async function fastLocalSignOut(
  client: Pick<SupabaseClient, "auth">,
  options?: FastLocalSignOutOptions,
): Promise<void> {
  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    // storage no disponible o ya limpio
  }
  if (options?.preserveProfileCaches) {
    clearTenantContextStorageOnly();
  } else {
    clearTenantContext();
  }
}
