import { useAuth } from "@/contexts/AuthContext";
import { isVendorRole } from "@/lib/appRoles";
import { supabase } from "@/lib/supabase";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const PRESENCE_ROLES = new Set([
  "vendedor",
  "admin",
  "gerente",
  "jefe_jefe",
  "jefe_sucursal",
  "financiero",
]);

/** Registra navegación en la app para el score de engagement (throttle ~2 min). */
export function useSellerPresence() {
  const { user } = useAuth();
  const location = useLocation();
  const lastPingRef = useRef(0);

  useEffect(() => {
    if (!user?.id || !user.tenant_id) return;
    if (!PRESENCE_ROLES.has(user.role) && !isVendorRole(user.role)) return;

    const now = Date.now();
    if (now - lastPingRef.current < 120_000) return;
    lastPingRef.current = now;

    const path = `${location.pathname}${location.search}`;
    void supabase.rpc("upsert_seller_app_presence" as never, { p_path: path } as never);
  }, [location.pathname, location.search, user?.id, user?.tenant_id, user?.role]);
}
