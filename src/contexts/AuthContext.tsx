import { supabase, type User } from "@/lib/supabase";
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
  const sessionTimeoutRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const lastStorageWriteRef = useRef<number>(0);
  const loadingTimeoutRef = useRef<number | null>(null);

  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
  const AUTH_LOADING_TIMEOUT_MS = 12 * 1000; // evita loading infinito
  const SESSION_STORAGE_KEY = "skale.session_activity";
  const ACTIVITY_STORAGE_THROTTLE_MS = 5 * 1000;

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

  const buildFallbackUserFromSession = (sessionUser: Session["user"]): User => {
    const metadata = sessionUser.user_metadata || {};
    return {
      id: sessionUser.id,
      email: sessionUser.email || "",
      full_name: metadata.full_name || sessionUser.email?.split("@")[0] || "Usuario",
      phone: metadata.phone || undefined,
      role: (metadata.role as User["role"]) || "vendedor",
      branch_id: metadata.branch_id || undefined,
      is_active: true,
      avatar_url: metadata.avatar_url || undefined,
      onboarding_completed: metadata.onboarding_completed || false,
      created_at: sessionUser.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  const fetchUserProfile = async (userId: string): Promise<boolean> => {
    try {
      console.log("🔍 Fetching user profile for userId:", userId);
      const { data, error } = await withTimeout(
        supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .maybeSingle(),
        15000,
      );

      if (error && error.code !== 'PGRST116') {
        console.error("❌ Error fetching user profile:", error);
        setUser(null);
        setLoading(false);
        return false;
      }

      if (data) {
        console.log("✅ User profile fetched successfully:", data);
        // Crear un nuevo objeto para asegurar que React detecte el cambio
        const updatedUser: User = {
          ...data,
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          phone: data.phone || undefined,
          role: data.role,
          branch_id: data.branch_id || undefined,
          is_active: data.is_active,
          avatar_url: data.avatar_url || undefined,
          onboarding_completed: data.onboarding_completed || false,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        setUser(updatedUser);
        // Onboarding desactivado temporalmente
        setNeedsOnboarding(false);
        // setNeedsOnboarding(!data.onboarding_completed);
        setLoading(false);
        return true;
      }

      // Usuario no existe en public.users, intentar crearlo
      console.log("⚠️ Usuario no existe en public.users, intentando crear...");
      return await createUserFromAuth(userId);
    } catch (error) {
      console.error("❌ Error fetching user profile (catch):", error);
      setUser(null);
      setLoading(false);
      return false;
    }
  };

  const createUserFromAuth = async (userId: string): Promise<boolean> => {
    try {
      console.log("🔧 Creando usuario en public.users desde auth.users...");

      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        console.error("❌ No se pudo obtener el usuario de auth");
        setUser(null);
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
          role: authUser.user_metadata?.role || 'admin',
          branch_id: '550e8400-e29b-41d4-a716-446655440000',
          is_active: true,
          onboarding_completed: true,
        })
        .select()
        .single();

      if (error) {
        console.error("❌ Error creando usuario:", error);
        setUser(null);
        setLoading(false);
        return false;
      }

      if (data) {
        console.log("✅ Usuario creado exitosamente:", data);
        setUser(data as User);
        // Onboarding desactivado temporalmente
        setNeedsOnboarding(false);
        // setNeedsOnboarding(!data.onboarding_completed);
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
    } catch (error) {
      console.error("❌ Error en createUserFromAuth:", error);
      setUser(null);
      setLoading(false);
      return false;
    }
  };

  useEffect(() => {
    console.log("🔧 Inicializando AuthProvider...");

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log("📍 Sesión actual:", session ? "existe" : "no existe");
      setSession(session);
      if (session?.user) {
        const ok = await fetchUserProfile(session.user.id);
        if (!ok) {
          console.warn("⚠️ No se pudo obtener perfil, usando fallback de sesión");
          setUser(buildFallbackUserFromSession(session.user));
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔄 Auth state changed:", event, session ? "con sesión" : "sin sesión");
      setSession(session);
      if (session?.user) {
        const ok = await fetchUserProfile(session.user.id);
        if (!ok) {
          console.warn("⚠️ No se pudo obtener perfil, usando fallback de sesión");
          setUser(buildFallbackUserFromSession(session.user));
          setLoading(false);
        }
      } else {
        setUser(null);
        setNeedsOnboarding(false);
        setLoading(false);
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
      console.warn("⏱️ Loading auth timeout: liberando loading para evitar bloqueo");
      setLoading(false);
    }, AUTH_LOADING_TIMEOUT_MS);

    return () => {
      if (loadingTimeoutRef.current) {
        window.clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [loading]);

  useEffect(() => {
    if (!session?.user) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
      if (sessionTimeoutRef.current) {
        window.clearTimeout(sessionTimeoutRef.current);
        sessionTimeoutRef.current = null;
      }
      return;
    }

    if (typeof window === "undefined") return;

    const now = Date.now();
    let lastActivityAt = now;
    let storedUserId: string | null = null;

    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { userId?: string; lastActivityAt?: number };
        if (parsed?.userId) storedUserId = parsed.userId;
        if (parsed?.lastActivityAt) lastActivityAt = parsed.lastActivityAt;
      }
    } catch (error) {
      console.warn("⚠️ Error leyendo SESSION_STORAGE_KEY:", error);
    }

    if (storedUserId !== session.user.id) {
      lastActivityAt = now;
    }

    lastActivityRef.current = lastActivityAt;

    const elapsed = now - lastActivityAt;
    if (elapsed >= SESSION_TIMEOUT_MS) {
      console.log("⏱️ Sesión expirada por inactividad, cerrando sesión...");
      supabase.auth.signOut().finally(() => {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      });
      return;
    }

    const persistActivity = (timestamp: number) => {
      const shouldWrite = timestamp - lastStorageWriteRef.current >= ACTIVITY_STORAGE_THROTTLE_MS;
      if (!shouldWrite) return;

      lastStorageWriteRef.current = timestamp;
      try {
        window.localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({ userId: session.user.id, lastActivityAt: timestamp }),
        );
      } catch (error) {
        console.warn("⚠️ Error guardando SESSION_STORAGE_KEY:", error);
      }
    };

    const scheduleTimeout = (timestamp: number) => {
      if (sessionTimeoutRef.current) {
        window.clearTimeout(sessionTimeoutRef.current);
      }
      const remaining = SESSION_TIMEOUT_MS - (Date.now() - timestamp);
      sessionTimeoutRef.current = window.setTimeout(() => {
        console.log("⏱️ Sesión expirada por inactividad, cerrando sesión...");
        supabase.auth.signOut().finally(() => {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
        });
      }, Math.max(remaining, 0));
    };

    const handleActivity = () => {
      const timestamp = Date.now();
      lastActivityRef.current = timestamp;
      persistActivity(timestamp);
      scheduleTimeout(timestamp);
    };

    persistActivity(lastActivityAt);
    scheduleTimeout(lastActivityAt);

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      if (sessionTimeoutRef.current) {
        window.clearTimeout(sessionTimeoutRef.current);
        sessionTimeoutRef.current = null;
      }
    };
  }, [session]);

  const signIn: AuthContextType["signIn"] = async (email, password) => {
    try {
      console.log("🔐 Attempting to sign in with email:", email);
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("❌ Sign in error:", error);
        setLoading(false);
        return { error };
      }

      if (data.session?.user) {
        console.log("✅ Sign in successful, fetching user profile...");
        console.log("Session user ID:", data.session.user.id);

        // Intentar obtener el perfil del usuario
        const ok = await fetchUserProfile(data.session.user.id);
        if (!ok) {
          console.warn("⚠️ No se pudo obtener perfil, usando fallback de sesión");
          setUser(buildFallbackUserFromSession(data.session.user));
          setLoading(false);
        }
      } else {
        console.warn("⚠️ No session or user in sign in response");
        setLoading(false);
        return { error: new Error("No se recibió una sesión válida del servidor") };
      }

      return { error: null };
    } catch (error) {
      console.error("❌ Sign in exception:", error);
      setLoading(false);
      return { error };
    }
  };

  const signUp: AuthContextType["signUp"] = async (email, password, fullName, phone) => {
    try {
      console.log("🚀 Iniciando registro para:", email);
      setLoading(true);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone || null,
            role: 'vendedor'
          }
        },
      });

      if (authError) {
        console.error("❌ Error en auth.signUp:", authError);
        setLoading(false);
        return { error: authError };
      }

      if (authData.user) {
        console.log("✅ Usuario creado en auth.users:", authData.user.id);

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
          console.error("❌ Error verificando usuario en public.users:", checkError);
        }

        if (!userCheck) {
          console.log("⚠️ Usuario no creado por trigger, intentando inserción manual...");
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
            console.error("❌ Error creando perfil:", profileError);
            // Si falla, el usuario existe en auth pero no en public.users
            // El administrador tendrá que arreglarlo
            setLoading(false);
            return {
              error: new Error("Tu cuenta fue creada pero hay un problema de configuración. Por favor, contacta al administrador.")
            };
          }

          console.log("✅ Usuario creado manualmente en public.users");
        } else {
          console.log("✅ Usuario creado automáticamente por trigger");
        }

        // Obtener la sesión y el perfil
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSession(session);
          await fetchUserProfile(authData.user.id);
        }
      }

      return { error: null };
    } catch (error) {
      console.error("❌ Error en signUp:", error);
      setLoading(false);
      return { error };
    }
  };

  const signOut = async () => {
    setLoading(true);
    setIsSigningOut(true);

    const clearState = () => {
      setUser(null);
      setSession(null);
      setNeedsOnboarding(false);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
      if (sessionTimeoutRef.current) {
        window.clearTimeout(sessionTimeoutRef.current);
        sessionTimeoutRef.current = null;
      }
      setLoading(false);
      setIsSigningOut(false);
    };

    // Mostrar "Cerrando sesión..." brevemente y redirigir sin esperar al servidor (signOut en segundo plano)
    supabase.auth.signOut().catch((err) => console.error("Error signing out:", err));
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
      console.error("❌ No hay usuario para completar onboarding");
      throw new Error("No hay usuario autenticado");
    }
    try {
      console.log("🔄 Completando onboarding para usuario:", user.id);
      const { data, error } = await supabase
        .from("users")
        .update({ onboarding_completed: true })
        .eq("id", user.id)
        .select()
        .single();

      if (error) {
        console.error("❌ Error actualizando onboarding:", error);
        throw error;
      }

      if (data) {
        console.log("✅ Onboarding completado exitosamente:", data);
        const updatedUser = { ...user, onboarding_completed: true };
        setUser(updatedUser);
        setNeedsOnboarding(false);
      } else {
        throw new Error("No se recibió respuesta del servidor");
      }
    } catch (error) {
      console.error("❌ Error completing onboarding:", error);
      throw error; // Re-lanzar el error para que el componente pueda manejarlo
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
