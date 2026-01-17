import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type User } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
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
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const fetchUserProfile = async (userId: string): Promise<boolean> => {
    try {
      console.log("🔍 Fetching user profile for userId:", userId);
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

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
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("📍 Sesión actual:", session ? "existe" : "no existe");
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
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
        await fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
        await fetchUserProfile(data.session.user.id);
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
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
      setNeedsOnboarding(false);
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setLoading(false);
    }
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
