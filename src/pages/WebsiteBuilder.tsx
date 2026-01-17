import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, Layout, Palette, Settings, Eye } from "lucide-react";

export default function WebsiteBuilder() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Globe className="h-6 w-6" />
          Website Builder
        </h1>
        <p className="text-muted-foreground mt-2">
          Construye sitios web profesionales para tu automotora
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layout className="h-5 w-5 text-blue-500" />
              Plantillas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Elige una plantilla</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-5 w-5 text-purple-500" />
              Personalizar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Personaliza tu sitio</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-5 w-5 text-green-500" />
              Configuración
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Ajusta la configuración</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-5 w-5 text-orange-500" />
              Vista Previa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Vista previa del sitio</p>
          </CardContent>
        </Card>
      </div>

      {/* Website Status */}
      <Card>
        <CardHeader>
          <CardTitle>Estado del Sitio Web</CardTitle>
          <CardDescription>
            Información sobre tu sitio web actual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Estado</p>
                <p className="text-sm text-muted-foreground">No hay sitio web configurado</p>
              </div>
              <Badge variant="outline">Inactivo</Badge>
            </div>
            <Button className="w-full">
              <Globe className="h-4 w-4 mr-2" />
              Crear Nuevo Sitio Web
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
