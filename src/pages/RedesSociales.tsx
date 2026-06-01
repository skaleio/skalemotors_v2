import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { prefetchZernioAccounts } from "@/hooks/useZernioAccounts";
import { showOrgTab, type ZernioScope } from "@/lib/zernio/rbac";
import { ZernioScopePanel } from "@/components/zernio/ZernioScopePanel";

export default function RedesSociales() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const orgVisible = showOrgTab(user?.role);

  useEffect(() => {
    const scopes: ZernioScope[] = orgVisible ? ["org", "personal"] : ["personal"];
    prefetchZernioAccounts(queryClient, scopes);
  }, [queryClient, orgVisible]);
  const defaultTab: ZernioScope = orgVisible ? "org" : "personal";
  const tabParam = searchParams.get("tab");
  const activeTab: ZernioScope =
    tabParam === "org" && orgVisible ? "org" : tabParam === "personal" ? "personal" : defaultTab;

  const tabs = useMemo(() => {
    const list: { value: ZernioScope; label: string }[] = [];
    if (orgVisible) list.push({ value: "org", label: "Automotora" });
    list.push({ value: "personal", label: "Mis cuentas" });
    return list;
  }, [orgVisible]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Redes sociales</h1>
        <p className="max-w-2xl text-muted-foreground">
          Conecta cuentas con OAuth y publica desde un solo lugar. La automotora y tus redes
          personales están separadas para que cada equipo publique donde corresponde.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {orgVisible && (
          <TabsContent value="org" className="mt-6">
            <ZernioScopePanel scope="org" label="Automotora" />
          </TabsContent>
        )}
        <TabsContent value="personal" className="mt-6">
          <ZernioScopePanel scope="personal" label="Mis cuentas" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
