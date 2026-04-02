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

  const buildFallbackUserFromSession = (sessionUser: Session["user"]): User => {
    const metadata = sessionUser.user_metadata || {};
    return {
      id: sessionUser.id,
      email: sessionUser.email || "",
      full_name: metadata.full_name || sessionUser.email?.split("@")[0] || "Usuario",
      phone: metadata.phone || undefined,
      role: "vendedor",
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

      // Usuario no existe en public.users, intentar crearlo
      return await createUserFromAuth(userId);
    } catch (error) {
      setLoading(false);
      return false;
    }
  };

  const createUserFromAuth = async (userId: string): Promise<boolean> => {
    try {

      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        setLoading(false);
        return false;
      }

      const { data, error } = await supabase
        .from("users")
        .insert({
          id: userId,
          email: authUser.email || '',
          full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuario',
          phone: authUser.user_metadata?.phone || null,
          role: 'vendedor',
          tenant_id: null,
          legacy_protected: false,
          branch_id: null,
          is_active: true,
          onboarding_completed: false,
        })
        .select()
        .single();

      if (error) {
        setLoading(false);
        return false;
      }

      if (data) {
        setUser(data as User);
        setTenantContext({
          tenantId: (data as User).tenant_id,
          role: (data as User).role,
          userId: (data as User).id,
          legacyProtected: (data as User).legacy_protected,
        });
        setNeedsOnboarding(!(data as User).onboarding_completed);
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
    } catch {
      setLoading(false);
      return false;
    }
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
      setSession(session ?? null);

      // INITIAL_SESSION lo resuelve getSession arriba; evita carreras y doble refresh de perfil
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

        // Abrir otra pestaña o refrescar token no debe "recargar" la pestaña ya abierta.
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
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoading(false);
        return { error };
      }

      if (data.session?.user) {
        setSession(data.session);
        setUser(buildFallbackUserFromSession(data.session.user));
        setLoading(false);
        // Perfil completo en segundo plano (igual que getSession inicial) — login no espera 20s
        void fetchUserProfile(data.session.user.id).then((ok) => {
          if (!ok) {
            setUser(buildFallbackUserFromSession(data.session.user));
          }
        });
      } else {
        setLoading(false);
        return { error: new Error("No se recibió una sesión válida del servidor") };
      }

      return { error: null };
    } catch {
      setLoading(false);
      return { error: new Error("Error inesperado. Intenta nuevamente.") };
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

    const clearState = () => {
      setUser(null);
      setSession(null);
      setNeedsOnboarding(false);
      setLoading(false);
      setIsSigningOut(false);
    };

    // Mostrar "Cerrando sesión..." brevemente y redirigir sin esperar al servidor (signOut en segundo plano)
    supabase.auth.signOut().catch(() => {});
    setTimeout(clearState, 400);
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
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
