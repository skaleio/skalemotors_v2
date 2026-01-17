import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Gift, Star, TrendingUp } from "lucide-react";

export default function Loyalty() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fidelización</h1>
        <p className="text-muted-foreground mt-2">
          Programa de lealtad y recompensas para clientes
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Fieles</CardTitle>
            <Heart className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Cargando datos...</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Puntos Acumulados</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Cargando datos...</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recompensas Entregadas</CardTitle>
            <Gift className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Cargando datos...</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Retención</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Cargando datos...</p>
          </CardContent>
        </Card>
      </div>

      {/* Program Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Programa de Puntos</CardTitle>
            <CardDescription>
              Sistema de recompensas por compras
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <p className="text-sm font-medium mb-1">Nivel Bronce</p>
                <p className="text-xs text-muted-foreground">0-999 puntos</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm font-medium mb-1">Nivel Plata</p>
                <p className="text-xs text-muted-foreground">1000-4999 puntos</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm font-medium mb-1">Nivel Oro</p>
                <p className="text-xs text-muted-foreground">5000+ puntos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clientes Destacados</CardTitle>
            <CardDescription>
              Top clientes del programa de fidelización
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Heart className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No hay clientes en el programa aún</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
