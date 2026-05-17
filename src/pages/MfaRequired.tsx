import { Navigate } from "react-router-dom";
import { MfaEnrollSection } from "@/components/settings/MfaEnrollSection";
import { useMfaGate } from "@/hooks/useMfaGate";
import DashboardLoader from "@/components/DashboardLoader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Pantalla bloqueante: roles privilegiados deben enrollar MFA antes de usar la app. */
export default function MfaRequired() {
  const { loading, mustEnroll, hasVerifiedFactor } = useMfaGate();

  if (loading) {
    return <DashboardLoader message="Verificando seguridad…" barLabel="Seguridad" />;
  }

  if (!mustEnroll && hasVerifiedFactor) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="container max-w-2xl py-10 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>MFA obligatorio</CardTitle>
          <CardDescription>
            Por política de seguridad, los perfiles admin, gerente y jefe deben activar autenticación en dos pasos antes de continuar.
          </CardDescription>
        </CardHeader>
      </Card>
      <MfaEnrollSection />
    </div>
  );
}
