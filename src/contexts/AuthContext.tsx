import { passwordRecoveryRedirectUrl } from "@/lib/authAppOrigin";
import { supabase, type User } from "@/lib/supabase";
import { setObservabilityUserContext } from "@/lib/observability";
import { setTenantContext } from "@/lib/tenant";
import type { Session } from "@supabase/supabase-js";
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSigningOut: boolean;
  needsOnboarding: boolean;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
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

  /** Tiempo máx. esperando getSession (red lenta); no cerrar sesión por esto */
  const AUTH_LOADING_TIMEOUT_MS = 45 * 1000;
  const PROFILE_CACHE_KEY_PREFIX = "skale.user-profile";

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    let timeoutId: number | null = null;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error("Timeout al obtener el perfil"));
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

  const roleFromSessionUser = (sessionUser: Session["user"]): User["role"] => {
    const allowed: User["role"][] = [
      "admin",
      "gerente",
      "vendedor",
      "financiero",
      "servicio",
      "inventario",
      "jefe_jefe",
      "jefe_sucursal",
    ];
    const appMeta = sessionUser.app_metadata as { role?: string } | undefined;
    const raw = appMeta?.role ?? (sessionUser.user_metadata as { role?: string } | undefined)?.role;
    if (raw && (allowed as string[]).includes(raw)) return raw as User["role"];
    return "gerente";
  };

  const buildFallbackUserFromSession = (sessionUser: Session["user"]): User => {
    const metadata = sessionUser.user_metadata || {};
    return {
      id: sessionUser.id,
      email: sessionUser.email || "",
      full_name: metadata.full_name || sessionUser.email?.split("@")[0] || "Usuario",
      phone: metadata.phone || undefined,
      role: roleFromSessionUser(sessionUser),
      tenant_id: undefined,
      legacy_protected: false,
      branch_id: undefined,
      is_active: true,
      avatar_url: metadata.avatar_url || undefined,
      onboarding_completed: metadata.onboarding_completed || false,
      created_at: sessionUser.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  const getProfileCacheKey = (userId: string) => `${PROFILE_CACHE_KEY_PREFIX}.${userId}`;

  const readCachedProfile = (userId: string): User | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(getProfileCacheKey(userId));
      if (!raw) return null;
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  };

  const writeCachedProfile = (profile: User) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(getProfileCacheKey(profile.id), JSON.stringify(profile));
    } catch {
      // ignorar si localStorage no está disponible
    }
  };

  const fetchUserProfile = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .maybeSingle(),
        PROFILE_FETCH_TIMEOUT_MS,
      );

      if (error) {
        setLoading(false);
        return false;
      }

      if (data) {
        if (!data.is_active) {
          try { await supabase.auth.signOut(); } catch { /* ignore */ }
          setUser(null);
          currentUserRef.current = null;
          setSession(null);
          setNeedsOnboarding(false);
          setLoading(false);
          return false;
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
        return true;
      }

      // Trigger de signup puede tardar — reintentar con backoff
      return await retryFetchUserProfile(userId);
    } catch (error) {
      setLoading(false);
      return false;
    }
  };

  const retryFetchUserProfile = async (userId: string, maxRetries = 3): Promise<boolean> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt), 4000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

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
        return true;
      }
    }
    setLoading(false);
    return false;
  };

  useEffect(() => {
    currentUserRef.current = user;
  }, [user]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
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
      const initialUser = cachedProfile ?? buildFallbackUserFromSession(currentSession.user);
      setUser(initialUser);
      currentUserRef.current = initialUser;
      setTenantContext({
        tenantId: initialUser.tenant_id,
        role: initialUser.role,
        userId: initialUser.id,
        legacyProtected: initialUser.legacy_protected,
      });
      setObservabilityUserContext({
        id: initialUser.id,
        email: initialUser.email,
        role: initialUser.role,
        tenantId: initialUser.tenant_id,
      });
      setLoading(false);
      // NO llamar refreshSession() aquí: compite con autoRefreshToken y puede provocar
      // "Invalid Refresh Token: Already Used" → cierre de sesión al recargar (ver gotrue#1290).
      const ok = await fetchUserProfile(currentSession.user.id);
      if (!ok) {
        // se mantiene usuario fallback ya puesto arriba
      }
    });

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
        setUser(null);
        currentUserRef.current = null;
        setNeedsOnboarding(false);
        setLoading(false);
        return;
      }

      if (session?.user) {
        const sameUserAlreadyLoaded = currentUserRef.current?.id === session.user.id;
        const cachedProfile = readCachedProfile(session.user.id);

        if (sameUserAlreadyLoaded && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
          return;
        }

        if (!sameUserAlreadyLoaded) {
          const nextUser = cachedProfile ?? buildFallbackUserFromSession(session.user);
          setUser(nextUser);
          currentUserRef.current = nextUser;
        }

        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          const ok = await fetchUserProfile(session.user.id);
          if (!ok) {
            setUser(buildFallbackUserFromSession(session.user));
            setLoading(false);
          }
        }
      }
    });

    return () => subscription.unsubscribe();
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
        setUser(buildFallbackUserFromSession(pending.user));
        setSession(pending);
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
    signingInRef.current = true;
    try {
      // Destruir cualquier sesion previa del SDK antes de intentar un nuevo login.
      // Sin esto, si signInWithPassword falla, el SDK conserva la sesion vieja en
      // localStorage y su auto-refresh puede restaurar al usuario anterior.
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      setUser(null);
      currentUserRef.current = null;
      setSession(null);
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setUser(null);
        currentUserRef.current = null;
        setSession(null);
        setLoading(false);
        return { error };
      }

      if (data.session?.user) {
        const { data: profile } = await supabase
          .from("users")
          .select("is_active")
          .eq("id", data.session.user.id)
          .maybeSingle();

        if (profile && !profile.is_active) {
          await supabase.auth.signOut();
          setUser(null);
          currentUserRef.current = null;
          setSession(null);
          setLoading(false);
          return { error: new Error("ACCOUNT_DISABLED") };
        }

        setSession(data.session);
        const ok = await fetchUserProfile(data.session.user.id);
        if (!ok) {
          setUser(buildFallbackUserFromSession(data.session.user));
        }
      } else {
        setUser(null);
        currentUserRef.current = null;
        setSession(null);
        setLoading(false);
        return { error: new Error("No se recibió una sesión válida del servidor") };
      }

      return { error: null };
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
        setLoading(false);
        return { error: authError };
      }

      if (authData.user) {
        // El trigger debería crear el usuario automáticamente en public.users
        // Esperar un momento para que el trigger se ejecute
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verificar si el usuario fue creado en public.users
        const { data: userCheck, error: checkError } = await supabase
          .from("users")
          .select("id")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          // log silencioso en desarrollo
          if (import.meta.env.DEV) console.warn("Error verificando usuario en public.users");
        }

        if (!userCheck) {
          // Intentar crear el usuario manualmente
          const { error: profileError } = await supabase.from("users").insert({
            id: authData.user.id,
            email,
            full_name: fullName,
            phone: phone || null,
            role: "vendedor",
            is_active: true,
            onboarding_completed: false,
          });

          if (profileError) {
            setLoading(false);
            return {
              error: new Error("Tu cuenta fue creada pero hay un problema de configuración. Por favor, contacta al administrador.")
            };
          }

        }

        // Obtener la sesión y el perfil
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSession(session);
          await fetchUserProfile(authData.user.id);
        }
      }

      return { error: null };
    } catch {
      setLoading(false);
      return { error: new Error("Error inesperado en el registro.") };
    }
  };

  const signOut = async () => {
    setLoading(true);
    setIsSigningOut(true);

    // Limpiar cache del perfil en localStorage
    if (currentUserRef.current?.id) {
      try {
        window.localStorage.removeItem(getProfileCacheKey(currentUserRef.current.id));
      } catch { /* ignore */ }
    }

    const clearState = () => {
      setUser(null);
      currentUserRef.current = null;
      setSession(null);
      setNeedsOnboarding(false);
      setLoading(false);
      setIsSigningOut(false);
    };

    try {
      await supabase.auth.signOut();
    } catch { /* ignore */ }
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
    try {
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
    } catch (error) {
      throw error;
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
