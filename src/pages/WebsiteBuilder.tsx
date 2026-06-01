import { Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantSite, useCreateTenantSite } from "@/hooks/useTenantSite";
import { isPhotographerRole } from "@/lib/appRoles";
import { DomainsManager } from "@/components/website/DomainsManager";
import { VisualEditor } from "@/components/website/VisualEditor";
import { WebsiteVehiclePrices } from "@/components/website/WebsiteVehiclePrices";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function WebsiteBuilder() {
  const { user } = useAuth();
  const isPhotographer = isPhotographerRole(user?.role);
  const { data: site, isLoading } = useTenantSite();
  const createSite = useCreateTenantSite();

  const handleCreate = () => {
    createSite.mutate(undefined, {
      onSuccess: () => toast.success("Sitio web creado. Empezá a editarlo."),
      onError: (e) =>
        toast.error("No se pudo crear el sitio", {
          description: e instanceof Error ? e.message : undefined,
        }),
    });
  };

  const editorLayout = site && !isLoading;

  return (
    <div
      className={
        editorLayout
          ? "flex min-h-0 flex-col gap-3 lg:min-h-[calc(100dvh-10rem)] lg:flex-1"
          : "space-y-6"
      }
    >
      <div className="shrink-0">
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight lg:text-3xl">
          <Globe className="h-6 w-6" />
          {isPhotographer ? "Precios en la web" : "Mi Web"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground lg:mt-2">
          {isPhotographer
            ? "Actualizá los precios que verán los visitantes en la vitrina de tu automotora."
            : "Construí tu vitrina pública editando y reordenando secciones, con vista previa en vivo."}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando...
        </div>
      ) : isPhotographer ? (
        <WebsiteVehiclePrices />
      ) : !site ? (
        <Card>
          <CardHeader>
            <CardTitle>Estado del Sitio Web</CardTitle>
            <CardDescription>Aún no tienes una vitrina configurada</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Estado</p>
                  <p className="text-sm text-muted-foreground">
                    No hay sitio web configurado
                  </p>
                </div>
                <Badge variant="outline">Inactivo</Badge>
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={createSite.isPending}
              >
                {createSite.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="mr-2 h-4 w-4" />
                )}
                Crear Nuevo Sitio Web
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="editor" className="flex min-h-0 flex-1 flex-col gap-3">
          <TabsList className="w-full shrink-0 sm:w-auto">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="domains">Dominios</TabsTrigger>
          </TabsList>
          <TabsContent value="editor" className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
            <VisualEditor site={site} className="min-h-0 flex-1" />
          </TabsContent>
          <TabsContent value="domains" className="mt-0 data-[state=inactive]:hidden">
            <DomainsManager />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
