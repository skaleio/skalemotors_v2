import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { zernioAccountsQueryKey } from "@/hooks/useZernioAccounts";
import { syncZernioAccounts } from "@/lib/services/zernioApi";
import type { ZernioScope } from "@/lib/zernio/rbac";
import { toast } from "sonner";

type OAuthResult =
  | { type: "zernio-oauth-result"; ok: true; scope: ZernioScope; synced: number }
  | { type: "zernio-oauth-result"; ok: false; scope: ZernioScope; error: string };

export default function RedesSocialesCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("Sincronizando cuentas conectadas…");

  useEffect(() => {
    const stored = sessionStorage.getItem("zernio_connect_scope");
    const scopeParam = searchParams.get("scope") ?? stored;
    const scope: ZernioScope =
      scopeParam === "org" ? "org" : scopeParam === "personal" ? "personal" : "personal";
    sessionStorage.removeItem("zernio_connect_scope");

    const opener = typeof window !== "undefined" ? window.opener : null;
    const isPopup = !!opener && opener !== window;

    const notifyOpener = (result: OAuthResult) => {
      try {
        opener?.postMessage(result, window.location.origin);
      } catch {
        /* opener cerrado o de otro origen: ignoramos, el polling del padre refresca igual */
      }
    };

    let cancelled = false;

    (async () => {
      try {
        const { synced } = await syncZernioAccounts(scope);
        if (cancelled) return;

        if (isPopup) {
          notifyOpener({ type: "zernio-oauth-result", ok: true, scope, synced });
          setMessage("¡Listo! Puedes cerrar esta ventana.");
          window.close();
          return;
        }

        await queryClient.invalidateQueries({ queryKey: zernioAccountsQueryKey(scope) });
        const connected = searchParams.get("connected");
        if (connected) {
          toast.success(`Cuenta de ${connected} conectada.`);
        } else if (synced > 0) {
          toast.success(`Se sincronizaron ${synced} cuenta(s).`);
        } else {
          toast.success("Conexión completada.");
        }
        navigate(`/app/redes-sociales?tab=${scope}`, { replace: true });
      } catch (e) {
        if (cancelled) return;
        const err = (e as Error).message;

        if (isPopup) {
          notifyOpener({ type: "zernio-oauth-result", ok: false, scope, error: err });
          setMessage(err);
          window.close();
          return;
        }

        setMessage(err);
        toast.error(err);
        navigate(`/app/redes-sociales?tab=${scope}`, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, queryClient, searchParams]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
