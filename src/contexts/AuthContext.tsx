import { passwordRecoveryRedirectUrl } from "@/lib/authAppOrigin";
import {
  canRefreshPersistedSession,
  fastLocalSignOut,
  isAccessTokenExpired,
  readPersistedAuthSession,
} from "@/lib/authSessionCleanup";
import { supabase, type User } from "@/lib/supabase";
import { toast } from "sonner";
import { captureAppError, clearObservabilityUserContext, setObservabilityUserContext } from "@/lib/observability";
import { clearTenantContext, setTenantContext } from "@/lib/tenant";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";

type ProfileFetchReason = "ok" | "disabled" | "no-profile" | "error";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSigningOut: boolean;
  needsOnboarding: boolean;
  signIn: (email: string, password: string) => Promise<{ error: unknown; role?: User["role"] }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone?: string,
  ) => Promise<{ error: unknown }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: unknown }>;
  completeOnboarding: () => Promise<void>;
  fetchUserProfile: (userId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const loadingTimeoutRef = useRef<number | null>(null);
  const pendingSessionRef = useRef<Session | null>(null);
  const currentUserRef = useRef<User | null>(null);
  // Bloquea onAuthStateChange mientras signIn esta en progreso
  const signingInRef = useRef(false);
  // Deduplica fetchUserProfile en vuelo (evita N requests cuando el SDK
  // dispara múltiples eventos: SIGNED_IN + TOKEN_REFRESHED + USER_UPDATED)
  const inFlightProfileFetch = useRef<Map<string, Promise<ProfileFetchReason>>>(new Map());
  // Canal para sincronizar login/logout entre pestañas del mismo navegador
  const authChannelRef = useRef<BroadcastChannel | null>(null);
  // Última vez que se revalidó el perfil (para throttle en visibilitychange)
  const lastProfileRevalidateRef = useRef<number>(0);

  /** Tiempo máx. esperando getSession (red lenta); no cerrar sesión por esto */
  const AUTH_LOADING_TIMEOUT_MS = 45 * 1000;
  /** Bootstrap: margen para refresh de sesión tras días sin abrir la app */
  const AUTH_BOOTSTRAP_TIMEOUT_MS = 20 * 1000;
  const PROFILE_CACHE_KEY_PREFIX = "skale.user-profile";

  const withTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage = "Timeout al obtener el perfil",
  ): Promise<T> => {
    let timeoutId: number | null = null;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    }
  };

  const PROFILE_FETCH_TIMEOUT_MS = 20 * 1000; // 20 s para redes lentas
  // Sin timeout, signInWithPassword puede colgarse indefinidamente (red flaky,
  // proxy, captura). El botón "Iniciando sesión..." queda stuck porque el
  // finally de Login no corre hasta que el await resuelva. 15s da margen real
  // sin quedar atorado.
  const SIGNIN_TIMEOUT_MS = 15 * 1000;

  const getProfileCacheKey = (userId: string) => `${PROFILE_CACHE_KEY_PREFIX}.${userId}`;
  const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

  type ProfileCacheEnvelope = { profile: User; cachedAt: number };

  const readCachedProfile = (userId: string): User | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(getProfileCacheKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ProfileCacheEnvelope | User;
      if (parsed && typeof parsed === "object" && "cachedAt" in parsed && "profile" in parsed) {
        const env = parsed as ProfileCacheEnvelope;
        if (Date.now() - env.cachedAt > PROFILE_CACHE_TTL_MS) return null;
        return env.profile;
      }
      return parsed as User;
    } catch {
      return null;
    }
  };

  const writeCachedProfile = (profile: User) => {
    if (typeof window === "undefined") return;
    try {
      const envelope: ProfileCacheEnvelope = { profile, cachedAt: Date.now() };
      window.localStorage.setItem(getProfileCacheKey(profile.id), JSON.stringify(envelope));
    } catch {
      // ignorar si localStorage no está disponible
    }
  };

  const fetchUserProfile = async (userId: string): Promise<boolean> => {
    const r = await fetchUserProfileWithReason(userId);
    return r === "ok";
  };

  const fetchUserProfileWithReason = async (userId: string): Promise<ProfileFetchReason> => {
    // Dedup: si ya hay un fetch en vuelo para este userId, reutilizarlo.
    // Esto evita ráfagas cuando SDK dispara SIGNED_IN + TOKEN_REFRESHED + USER_UPDATED.
    const existing = inFlightProfileFetch.current.get(userId);
    if (existing) return existing;
    const p = doFetchUserProfile(userId).finally(() => {
      inFlightProfileFetch.current.delete(userId);
    });
    inFlightProfileFetch.current.set(userId, p);
    return p;
  };

  const doFetchUserProfile = async (userId: string): Promise<ProfileFetchReason> => {
    // Network retry: si la query throwa por timeout o red caída, reintenta
    // con backoff exponencial (1s, 2s) hasta 3 intentos. Error de BD (RLS,
    // constraint, etc.) NO se reintenta — no es transitorio.
    const NETWORK_RETRIES = 3;
    let lastNetworkError: unknown = null;
    let data: Awaited<ReturnType<typeof supabase.from<"users">["select"]>>["data"] | null = null;
    let error: Awaited<ReturnType<typeof supabase.from<"users">["select"]>>["error"] | null = null;
    for (let attempt = 0; attempt < NETWORK_RETRIES; attempt++) {
      try {
        const result = await withTimeout(
          supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .maybeSingle(),
          PROFILE_FETCH_TIMEOUT_MS,
        );
        data = result.data;
        error = result.error;
        lastNetworkError = null;
        break;
      } catch (e) {
        lastNetworkError = e;
        if (attempt < NETWORK_RETRIES - 1) {
          if (attempt === 1) {
            toast.message("La conexión está lenta", {
              description: "Reintentando cargar tu perfil...",
              duration: 4000,
            });
          }
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 4000);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }

    if (lastNetworkError) {
      setLoading(false);
      captureAppError(lastNetworkError, { area: "auth.fetchProfile.network", userId });
      toast.error("Sin conexión", {
        description: "Verificá tu internet y recargá la página.",
      });
      return "error";
    }

    try {
      if (error) {
        setLoading(false);
        captureAppError(error, { area: "auth.fetchProfile.db", userId });
        toast.error("Error cargando tu perfil", {
          description: "Recargá la página o pedí ayuda al admin si persiste.",
        });
        return "error";
      }

      if (data) {
        if (!data.is_active) {
          try { await supabase.auth.signOut(); } catch { /* ignore */ }
          setUser(null);
          currentUserRef.current = null;
          setSession(null);
          setNeedsOnboarding(false);
          setLoading(false);
          return "disabled";
        }

        const updatedUser: User = {
          ...data,
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          phone: data.phone || undefined,
          role: data.role,
          tenant_id: (data as { tenant_id?: string }).tenant_id || undefined,
          legacy_protected: Boolean((data as { legacy_protected?: boolean }).legacy_protected),
          branch_id: data.branch_id || undefined,
          is_active: data.is_active,
          avatar_url: data.avatar_url || undefined,
          crm_color: (data as { crm_color?: string | null }).crm_color ?? null,
          onboarding_completed: data.onboarding_completed || false,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        setUser(updatedUser);
        currentUserRef.current = updatedUser;
        setTenantContext({
          tenantId: updatedUser.tenant_id,
          role: updatedUser.role,
          userId: updatedUser.id,
          legacyProtected: updatedUser.legacy_protected,
        });
        setObservabilityUserContext({
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          tenantId: updatedUser.tenant_id,
        });
        writeCachedProfile(updatedUser);
        setNeedsOnboarding(!data.onboarding_completed);
        setLoading(false);
        return "ok";
      }

      // Trigger de signup puede tardar — reintentar con backoff
      return await retryFetchUserProfile(userId);
    } catch {
      setLoading(false);
      return "error";
    }
  };

  const retryFetchUserProfile = async (userId: string, maxRetries = 3): Promise<ProfileFetchReason> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt), 4000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // Wrappear con timeout para que un retry no cuelgue indefinidamente la
      // cascada de auth si la red se cae a la mitad del backoff.
      let data: { id: string; [k: string]: unknown } | null = null;
      try {
        const result = await withTimeout(
          supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .maybeSingle(),
          PROFILE_FETCH_TIMEOUT_MS,
        );
        data = result.data as typeof data;
      } catch {
        // Network/timeout en este retry: probar siguiente intento.
        continue;
      }

      if (data) {
        const updatedUser: User = {
          ...data,
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          phone: data.phone || undefined,
          role: data.role,
          tenant_id: (data as { tenant_id?: string }).tenant_id || undefined,
          legacy_protected: Boolean((data as { legacy_protected?: boolean }).legacy_protected),
          branch_id: data.branch_id || undefined,
          is_active: data.is_active,
          avatar_url: data.avatar_url || undefined,
          crm_color: (data as { crm_color?: string | null }).crm_color ?? null,
          onboarding_completed: data.onboarding_completed || false,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        setUser(updatedUser);
        currentUserRef.current = updatedUser;
        setTenantContext({
          tenantId: updatedUser.tenant_id,
          role: updatedUser.role,
          userId: updatedUser.id,
          legacyProtected: updatedUser.legacy_protected,
        });
        setNeedsOnboarding(!data.onboarding_completed);
        setLoading(false);
        return "ok";
      }
    }
    setLoading(false);
    return "no-profile";
  };

  useEffect(() => {
    currentUserRef.current = user;
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      let session: Session | null = null;
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_BOOTSTRAP_TIMEOUT_MS,
          "AUTH_BOOTSTRAP_TIMEOUT",
        );
        session = data.session;
      } catch {
        const persisted = readPersistedAuthSession();
        if (persisted && canRefreshPersistedSession(persisted)) {
          try {
            const { data } = await withTimeout(
              supabase.auth.refreshSession(),
              AUTH_BOOTSTRAP_TIMEOUT_MS,
              "AUTH_REFRESH_TIMEOUT",
            );
            session = data.session ?? persisted;
          } catch {
            session = persisted;
          }
        } else {
          session = null;
        }
      }

      if (cancelled) return;

      if (!session?.user) {
        pendingSessionRef.current = null;
        setSession(null);
        setLoading(false);
        return;
      }
      const currentSession = session;
      pendingSessionRef.current = currentSession;
      setSession(currentSession);

      const cachedProfile = readCachedProfile(currentSession.user.id);
      // Cache válido = con tenant_id OR legacy_protected (hessen y similares)
      const hasValidCache = !!(cachedProfile?.tenant_id || cachedProfile?.legacy_protected);
      if (hasValidCache && cachedProfile) {
        // Cache válido: renderizar inmediatamente, luego verificar en background
        setUser(cachedProfile);
        currentUserRef.current = cachedProfile;
        setTenantContext({
          tenantId: cachedProfile.tenant_id,
          role: cachedProfile.role,
          userId: cachedProfile.id,
          legacyProtected: cachedProfile.legacy_protected,
        });
        setObservabilityUserContext({
          id: cachedProfile.id,
          email: cachedProfile.email,
          role: cachedProfile.role,
          tenantId: cachedProfile.tenant_id,
        });
        setLoading(false);
        // NO llamar refreshSession() aquí: compite con autoRefreshToken y puede provocar
        // "Invalid Refresh Token: Already Used" → cierre de sesión al recargar (ver gotrue#1290).
        const reason = await fetchUserProfileWithReason(currentSession.user.id);
        if (reason === "disabled" || reason === "no-profile") {
          try { await supabase.auth.signOut(); } catch { /* ignore */ }
          try { window.localStorage.removeItem(getProfileCacheKey(currentSession.user.id)); } catch { /* ignore */ }
          setUser(null);
          currentUserRef.current = null;
          setSession(null);
        }
        // "error" de red: conservar sesión + cache (no forzar login diario por Wi‑Fi lenta)
      } else {
        // Sin cache válido: verificar DB antes de dar acceso (no mostrar app con fallback)
        // pendingSessionRef ya está seteado; el timeout guard lleva la carga si la red falla
        const ok = await fetchUserProfile(currentSession.user.id);
        if (!ok) {
          try { await supabase.auth.signOut(); } catch { /* ignore */ }
          setUser(null);
          currentUserRef.current = null;
          setSession(null);
          setLoading(false);
        }
        // Si ok: fetchUserProfile ya llamó setUser + setLoading(false)
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Mientras signIn() esta ejecutandose, ignorar eventos del listener
      // para evitar que una sesion previa (auto-refresh) restaure el estado
      // que signIn() acaba de limpiar intencionalmente.
      if (signingInRef.current) {
        return;
      }

      setSession(session ?? null);

      if (event === "INITIAL_SESSION") {
        return;
      }

      if (event === "SIGNED_OUT") {
        try { queryClient.clear(); } catch { /* ignore */ }
        clearTenantContext();
        setUser(null);
        currentUserRef.current = null;
        setNeedsOnboarding(false);
        setLoading(false);
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        // Avisar a otras tabs antes de seguir el flujo. Sin esto, dos tabs
        // pueden refrescar simultáneamente y la segunda recibe "Already Used"
        // → ambas pierden sesión. El listener en la otra tab releerá la
        // sesión del storage (ya actualizada) y evitará el race.
        try { authChannelRef.current?.postMessage({ type: "TOKEN_REFRESHED" }); } catch { /* ignore */ }
      }

      if (session?.user) {
        const sameUserAlreadyLoaded = currentUserRef.current?.id === session.user.id;
        const cachedProfile = readCachedProfile(session.user.id);

        if (sameUserAlreadyLoaded && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
          return;
        }

        const cacheIsValid = !!(cachedProfile?.tenant_id || cachedProfile?.legacy_protected);
        if (!sameUserAlreadyLoaded && cacheIsValid && cachedProfile) {
          setUser(cachedProfile);
          currentUserRef.current = cachedProfile;
        }

        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          const ok = await fetchUserProfile(session.user.id);
          if (!ok) {
            // Sin perfil en DB y sin cache válido → no otorgar acceso
            if (!cacheIsValid) {
              try { await supabase.auth.signOut(); } catch { /* ignore */ }
              setUser(null);
              currentUserRef.current = null;
              setSession(null);
            }
            setLoading(false);
          }
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // ==========================================================================
  // Cross-tab sync (BroadcastChannel): logout en una pestaña propaga a todas.
  // Crítico cuando varios vendedores comparten navegador (modo kiosko) o cuando
  // un admin desactiva a un vendedor desde otra pestaña.
  // ==========================================================================
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("skale.auth");
    authChannelRef.current = ch;
    ch.onmessage = (ev) => {
      const msg = ev.data as { type?: string; userId?: string } | null;
      if (!msg?.type) return;
      if (msg.type === "SIGNED_OUT") {
        // Otra pestaña cerró sesión → limpiar esta también (incluido cache cross-tenant)
        try { queryClient.clear(); } catch { /* ignore */ }
        clearTenantContext();
        setUser(null);
        currentUserRef.current = null;
        setSession(null);
        setNeedsOnboarding(false);
        setLoading(false);
      } else if (msg.type === "PROFILE_UPDATED" && msg.userId && currentUserRef.current?.id === msg.userId) {
        // Otra pestaña actualizó el perfil → refrescar acá también
        void fetchUserProfile(msg.userId);
      } else if (msg.type === "TOKEN_REFRESHED") {
        // Otra pestaña refrescó el token. Releer storage para que esta tab
        // use el access_token nuevo y NO mande el refresh_token viejo en su
        // próximo intento (Supabase responde "Already Used" y ambas pierden
        // sesión). El storage es compartido entre tabs, getSession lee fresco.
        void supabase.auth.getSession().then(({ data }) => {
          if (data.session) {
            pendingSessionRef.current = data.session;
            setSession(data.session);
          }
        }).catch(() => { /* ignore: cross-tab best effort */ });
      }
    };
    return () => {
      ch.close();
      authChannelRef.current = null;
    };
  }, []);

  // ==========================================================================
  // Al volver a la pestaña: renovar JWT vencido (sesión guardada en el dispositivo)
  // y revalidar perfil. Tras un día sin abrir, el access token suele estar vencido
  // pero el refresh_token sigue válido — hay que renovar, no borrar la sesión.
  // ==========================================================================
  useEffect(() => {
    const REVALIDATE_THROTTLE_MS = 30 * 1000;
    const REFRESH_THROTTLE_MS = 5 * 1000;
    let lastRefreshAttempt = 0;

    const tryRefreshAuthSession = async () => {
      const now = Date.now();
      if (now - lastRefreshAttempt < REFRESH_THROTTLE_MS) return;
      const persisted = readPersistedAuthSession();
      if (!persisted || !canRefreshPersistedSession(persisted)) return;
      if (!isAccessTokenExpired(persisted)) return;
      lastRefreshAttempt = now;
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) return;
        pendingSessionRef.current = data.session;
        setSession(data.session);
        try {
          authChannelRef.current?.postMessage({ type: "TOKEN_REFRESHED" });
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore: autoRefreshToken o siguiente visibility lo reintenta */
      }
    };

    const tryRevalidateProfile = () => {
      const uid = currentUserRef.current?.id;
      if (!uid) return;
      const now = Date.now();
      if (now - lastProfileRevalidateRef.current < REVALIDATE_THROTTLE_MS) return;
      lastProfileRevalidateRef.current = now;
      void fetchUserProfile(uid);
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void tryRefreshAuthSession();
      tryRevalidateProfile();
    };
    const onOnline = () => {
      void tryRefreshAuthSession();
      tryRevalidateProfile();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      if (loadingTimeoutRef.current) {
        window.clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      return;
    }

    if (loadingTimeoutRef.current) {
      window.clearTimeout(loadingTimeoutRef.current);
    }

    loadingTimeoutRef.current = window.setTimeout(() => {
      const pending = pendingSessionRef.current;
      if (pending?.user) {
        const cached = readCachedProfile(pending.user.id);
        const hasValidCache = !!(cached?.tenant_id || cached?.legacy_protected);
        if (!hasValidCache) {
          supabase.auth.signOut().catch(() => {});
          setUser(null);
          currentUserRef.current = null;
          setSession(null);
        } else if (cached) {
          setUser(cached);
          currentUserRef.current = cached;
        }
      } else {
        setUser(null);
        currentUserRef.current = null;
        setSession(null);
      }
      setLoading(false);
    }, AUTH_LOADING_TIMEOUT_MS);

    return () => {
      if (loadingTimeoutRef.current) {
        window.clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [loading]);

  const signIn: AuthContextType["signIn"] = async (email, password) => {
    // Guard: ignorar doble submit (click repetido, race entre tabs)
    if (signingInRef.current) {
      return { error: new Error("SIGNIN_IN_PROGRESS") };
    }
    signingInRef.current = true;
    const log = (step: string, extra?: unknown) => {
      if (import.meta.env.DEV) console.info(`[signIn] ${step}`, extra ?? "");
    };
    try {
      log("start");
      // Limpieza local rápida (sin revocar refresh en servidor): evita que un token
      // viejo dispare refresh en red y retrase signInWithPassword.
      await fastLocalSignOut(supabase);
      log("pre-local-signOut done");
      // Si había un usuario cargado (cambio de cuenta en mismo tab), purgar cache
      // de TanStack para que datos del user previo no aparezcan al loguearse
      // el nuevo. Las query keys que no incluyen tenant_id (sales, appointments,
      // expense-types, etc.) podrían mezclarse sin esto.
      try { queryClient.clear(); } catch { /* ignore */ }
      clearTenantContext();
      setUser(null);
      currentUserRef.current = null;
      setSession(null);
      setLoading(true);

      let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"];
      let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["error"];
      try {
        const result = await withTimeout(
          supabase.auth.signInWithPassword({ email, password }),
          SIGNIN_TIMEOUT_MS,
          "SIGNIN_TIMEOUT",
        );
        data = result.data;
        error = result.error;
      } catch (timeoutErr) {
        setUser(null);
        currentUserRef.current = null;
        setSession(null);
        setLoading(false);
        const msg = timeoutErr instanceof Error && timeoutErr.message === "SIGNIN_TIMEOUT"
          ? "La conexión está demorando demasiado. Verificá tu internet e intentá de nuevo."
          : "Error de conexión al iniciar sesión. Intentá de nuevo.";
        return { error: new Error(msg) };
      }
      log("signInWithPassword done", { hasSession: !!data?.session, hasError: !!error });

      if (error) {
        setUser(null);
        currentUserRef.current = null;
        setSession(null);
        setLoading(false);
        return { error };
      }

      if (data.session?.user) {
        setSession(data.session);
        const uid = data.session.user.id;
        const cachedProfile = readCachedProfile(uid);
        const hasValidCache = !!(cachedProfile?.tenant_id || cachedProfile?.legacy_protected);
        if (hasValidCache && cachedProfile) {
          setUser(cachedProfile);
          currentUserRef.current = cachedProfile;
          setTenantContext({
            tenantId: cachedProfile.tenant_id,
            role: cachedProfile.role,
            userId: cachedProfile.id,
            legacyProtected: cachedProfile.legacy_protected,
          });
          setObservabilityUserContext({
            id: cachedProfile.id,
            email: cachedProfile.email,
            role: cachedProfile.role,
            tenantId: cachedProfile.tenant_id,
          });
          setLoading(false);
        }
        log("fetching profile", { uid });
        const reason = await fetchUserProfileWithReason(uid);
        log("fetchUserProfile done", { reason });
        if (reason !== "ok") {
          try { await supabase.auth.signOut(); } catch { /* ignore */ }
          setUser(null);
          currentUserRef.current = null;
          setSession(null);
          setLoading(false);
          return { error: new Error(reason === "disabled" ? "ACCOUNT_DISABLED" : "NO_PROFILE") };
        }
        log("success, role=", currentUserRef.current?.role);
      } else {
        setUser(null);
        currentUserRef.current = null;
        setSession(null);
        setLoading(false);
        return { error: new Error("No se recibió una sesión válida del servidor") };
      }

      return { error: null, role: currentUserRef.current?.role };
    } catch {
      setUser(null);
      currentUserRef.current = null;
      setSession(null);
      setLoading(false);
      return { error: new Error("Error inesperado. Intenta nuevamente.") };
    } finally {
      signingInRef.current = false;
    }
  };

  const signUp: AuthContextType["signUp"] = async (email, password, fullName, phone) => {
    try {
      setLoading(true);
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone || null,
            role: 'admin',
          }
        },
      });

      if (authError) {
        return { error: authError };
      }

      if (authData.user) {
        // El trigger handle_new_user_signup (SECURITY DEFINER) crea el row en
        // public.users a partir de pending_vendor_provisions. Esperamos a que
        // termine, sin fallback manual: el insert directo desde cliente bypasseaba
        // la cola pending_vendor_provisions y permitia signups con role hardcoded.
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data: userCheck } = await supabase
          .from("users")
          .select("id")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (!userCheck) {
          return {
            error: new Error(
              "No pudimos completar el alta de tu cuenta. Pedile al administrador que te invite desde el panel de equipo."
            ),
          };
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSession(session);
          await fetchUserProfile(authData.user.id);
        }
      }

      return { error: null };
    } catch {
      return { error: new Error("Error inesperado en el registro.") };
    } finally {
      // Garantía: cualquier path (éxito, error de auth, getSession fallido,
      // exception) deja loading=false. Antes el happy path final dejaba
      // loading=true si getSession devolvía null y fetchUserProfile no se
      // llegaba a invocar — spinner infinito hasta el guard de 45s.
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setIsSigningOut(true);

    // Cross-tenant safety: borrar TODO el cache de TanStack Query antes de
    // que el próximo login pueda repintar UI con datos del usuario anterior.
    // Sin esto, queries cacheadas con keys que no incluyen tenant_id (sales,
    // appointments, expense-types, etc.) podrían mezclarse entre logins.
    try { queryClient.clear(); } catch { /* ignore */ }

    // Limpiar tenant-context global y todos los profile caches en localStorage.
    clearTenantContext();

    const clearState = () => {
      setUser(null);
      currentUserRef.current = null;
      setSession(null);
      setNeedsOnboarding(false);
      setLoading(false);
      setIsSigningOut(false);
      clearObservabilityUserContext();
    };

    try {
      await supabase.auth.signOut();
    } catch { /* ignore */ }
    // Notificar a otras pestañas del mismo navegador para que también cierren.
    try { authChannelRef.current?.postMessage({ type: "SIGNED_OUT" }); } catch { /* ignore */ }
    clearState();
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: passwordRecoveryRedirectUrl(),
      });
      if (error) return { error };
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const completeOnboarding = async () => {
    if (!user) {
      throw new Error("No hay usuario autenticado");
    }
    const { data, error } = await supabase
      .from("users")
      .update({ onboarding_completed: true })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (data) {
      const updatedUser = { ...user, onboarding_completed: true };
      setUser(updatedUser);
      setNeedsOnboarding(false);
    } else {
      throw new Error("No se recibió respuesta del servidor");
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    isSigningOut,
    needsOnboarding,
    signIn,
    signUp,
    signOut,
    resetPassword,
    completeOnboarding,
    fetchUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
