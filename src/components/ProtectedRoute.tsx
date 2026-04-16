import DashboardLoader from "@/components/DashboardLoader";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { type AppPermission, hasPermission, isFinancePermission } from "@/lib/rbac";
import { ReactNode, useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string[];
  requiredPermission?: AppPermission;
}

function postAuthHomeForRole(role: string | undefined): string {
  return role === "vendedor" ? "/app/crm" : "/app";
}

function AccessDeniedRedirect({ variant }: { variant: "finance" | "generic" }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (variant === "finance") {
      toast({
        title: "Sin acceso a Finanzas",
        description:
          "Tu perfil no tiene permiso para módulos financieros (gastos, fondos, ventas, comisiones, facturación, etc.). Si necesitas acceso, pide a un administrador que actualice tu rol.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Acceso restringido",
        description: "No tienes permiso para entrar a esta sección.",
        variant: "destructive",
      });
    }
    navigate(postAuthHomeForRole(user?.role), { replace: true });
  }, [variant, navigate, toast, user?.role]);

  return <DashboardLoader message="Redirigiendo…" barLabel="Redirigiendo" />;
}

export default function ProtectedRoute({ children, requiredRole, requiredPermission }: ProtectedRouteProps) {
  const { user, loading, isSigningOut, needsOnboarding, signOut } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (user && !user.is_active) {
      void signOut();
    }
  }, [user, signOut]);

  if (loading) {
    return (
      <DashboardLoader
        message={isSigningOut ? "Cerrando sesión..." : "Cargando..."}
        barLabel={isSigningOut ? "Cerrando sesión" : "Cargando"}
      />
    );
  }

  if (!user || !user.is_active) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (needsOnboarding && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  if (!needsOnboarding && location.pathname === "/onboarding") {
    return <Navigate to="/app" replace />;
  }

  if (requiredRole && !requiredRole.includes(user.role)) {
    return <AccessDeniedRedirect variant="generic" />;
  }

  if (requiredPermission && !hasPermission(user.role, requiredPermission)) {
    return <AccessDeniedRedirect variant={isFinancePermission(requiredPermission) ? "finance" : "generic"} />;
  }

  return <>{children}</>;
}
