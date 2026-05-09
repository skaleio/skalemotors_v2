import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface TeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  avatar_url: string | null;
}

/**
 * Devuelve los users del "equipo" del caller: él mismo + los que él creó
 * (users.created_by_user_id = caller.id). Usado por la UI de reasignación
 * de consignaciones.
 */
export function useMyTeam(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-team", userId ?? null],
    queryFn: async (): Promise<TeamMember[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, role, avatar_url")
        .or(`id.eq.${userId},created_by_user_id.eq.${userId}`)
        .eq("is_active", true)
        .order("role", { ascending: true })
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
