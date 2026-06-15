import { LibroDeVentas } from "@/components/finance/LibroDeVentas";

export default function LibroVentas() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Libro de Ventas</h1>
        <p className="text-muted-foreground mt-2">
          Versión digital del libro: cada venta desglosada con su cascada completa.
        </p>
      </div>
      <LibroDeVentas />
    </div>
  );
}
