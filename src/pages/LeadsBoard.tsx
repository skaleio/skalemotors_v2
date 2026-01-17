import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LeadsBoard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tablero de Leads</h1>
          <p className="text-muted-foreground mt-2">
            Visualiza y gestiona tus leads por etapa
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Lead
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-sm">Nuevo</span>
              <Badge variant="secondary">0</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 min-h-[200px]">
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay leads en esta etapa
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-sm">Contactado</span>
              <Badge variant="secondary">0</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 min-h-[200px]">
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay leads en esta etapa
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-sm">Calificado</span>
              <Badge variant="secondary">0</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 min-h-[200px]">
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay leads en esta etapa
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-sm">Convertido</span>
              <Badge variant="secondary">0</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 min-h-[200px]">
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay leads en esta etapa
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
