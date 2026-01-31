import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeDecimalInput, sanitizeIntegerInput } from "@/lib/format";
import { Calculator } from "lucide-react";
import { useState } from "react";

export default function FinancialCalculator() {
  const [formData, setFormData] = useState({
    vehiclePrice: "",
    downPayment: "",
    term: "36",
    interestRate: ""
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Calculator className="h-6 w-6" />
          Calculadora Financiera
        </h1>
        <p className="text-muted-foreground mt-2">
          Calcula cuotas y financiamiento para tus vehículos
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos del Financiamiento</CardTitle>
            <CardDescription>
              Ingresa los valores para calcular la cuota
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="vehiclePrice">Precio del Vehículo (CLP)</Label>
              <Input
                id="vehiclePrice"
                type="text"
                inputMode="numeric"
                placeholder="15.990.000"
                value={formData.vehiclePrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    vehiclePrice: sanitizeIntegerInput(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="downPayment">Pie Inicial (CLP)</Label>
              <Input
                id="downPayment"
                type="text"
                inputMode="numeric"
                placeholder="3.000.000"
                value={formData.downPayment}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    downPayment: sanitizeIntegerInput(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="term">Plazo (meses)</Label>
              <Select value={formData.term} onValueChange={(value) => setFormData({ ...formData, term: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="24">24 meses</SelectItem>
                  <SelectItem value="36">36 meses</SelectItem>
                  <SelectItem value="48">48 meses</SelectItem>
                  <SelectItem value="60">60 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="interestRate">Tasa de Interés Anual (%)</Label>
              <Input
                id="interestRate"
                type="text"
                inputMode="decimal"
                placeholder="8.5"
                value={formData.interestRate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    interestRate: sanitizeDecimalInput(e.target.value),
                  })
                }
              />
            </div>

            <Button className="w-full">
              <Calculator className="h-4 w-4 mr-2" />
              Calcular Cuota
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado del Cálculo</CardTitle>
            <CardDescription>
              Detalle del financiamiento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between p-3 border rounded-lg">
                <span className="text-sm font-medium">Cuota Mensual</span>
                <span className="text-lg font-bold">-</span>
              </div>
              <div className="flex justify-between p-3 border rounded-lg">
                <span className="text-sm font-medium">Total a Financiar</span>
                <span className="font-semibold">-</span>
              </div>
              <div className="flex justify-between p-3 border rounded-lg">
                <span className="text-sm font-medium">Total de Intereses</span>
                <span className="font-semibold">-</span>
              </div>
              <div className="flex justify-between p-3 border rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Total a Pagar</span>
                <span className="font-bold text-lg">-</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
