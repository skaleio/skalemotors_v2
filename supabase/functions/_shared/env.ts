/** Entorno de despliegue (Edge / Deno). */
export function isProductionEnv(): boolean {
  const vercel = (Deno.env.get("VERCEL_ENV") ?? "").toLowerCase();
  if (vercel) return vercel === "production";
  const node = (Deno.env.get("NODE_ENV") ?? "").toLowerCase();
  if (node) return node === "production";
  const supabaseEnv = (Deno.env.get("ENVIRONMENT") ?? "").toLowerCase();
  if (supabaseEnv) return supabaseEnv === "production";
  return false;
}
