---
name: ventas-miami-financiero
description: Modelo financiero del libro de ventas de vehículos (Miami / Scala Motors). Úsalo SIEMPRE que haya que calcular, desglosar o auditar una venta — utilidad bruta, gastos, comisión de gerencia y reparto Antonio/Juampi/Leonardo — o generar/validar planillas .xlsx de ventas para importar al software Scala Motors.
version: 1.0.0
---

# Ventas Miami / Scala Motors — Modelo financiero

## Propósito
Define cómo razonar y calcular sobre el libro de ventas de vehículos del negocio
(Miami / Scala Motors). Garantiza que toda venta se desglose en el orden correcto
y con los parámetros correctos.

## Definiciones de columnas

Campos que SE INGRESAN (entrada manual):
- N° venta, Fecha de pago total, Cliente, Vehículo
- Precio total, Pie, Precio consignación, Primer pago, Pago final
- Vendedor, Consignador
- Comisión venta (fijo), Comisión consignador (fijo), Gasto general

Campos que SE CALCULAN (nunca se ingresan a mano):
- Saldo precio, Utilidad bruta, Gasto total
- Utilidad antes de gerencia, Comisión gerencia, Utilidad post gerencia
- Antonio, Juampi, Leonardo, Utilidad final Miami

## Orden de cálculo (cascada — respetar SIEMPRE este orden)
1. Saldo precio               = Precio total − Pie
2. Utilidad bruta             = Precio total − Precio consignación
3. Gasto total                = Comisión venta + Comisión consignador + Gasto general
4. Utilidad antes de gerencia = Utilidad bruta − Gasto total
5. Comisión gerencia          = Utilidad antes de gerencia × % gerencia
6. Utilidad post gerencia     = Utilidad antes de gerencia − Comisión gerencia
7. Antonio                    = Utilidad post gerencia × % Antonio
8. Juampi                     = Utilidad post gerencia × % Juampi
9. Leonardo                   = Utilidad post gerencia × % Leonardo
10. Utilidad final Miami      = Utilidad post gerencia − Antonio − Juampi − Leonardo

## Parámetros (valores por defecto, editables)
- Comisión venta (fijo): $200.000  (puede subir a $300.000 en casos puntuales)
- Comisión consignador (fijo): $150.000  (puede bajar a $100.000 en casos puntuales)
- % Comisión gerencia: 10%  (sobre utilidad antes de gerencia)
- % Antonio: 3%   (sobre utilidad post gerencia)
- % Juampi: 3%    (sobre utilidad post gerencia)
- % Leonardo: 4%  (sobre utilidad post gerencia)
- Utilidad final Miami: 90% restante de la utilidad post gerencia

## Reglas clave de razonamiento
- Las comisiones de venta y consignador son MONTOS FIJOS, no porcentajes.
  Sólo gerencia y el reparto de socios son porcentajes.
- La base de gerencia es la utilidad ANTES de gerencia.
- La base de Antonio/Juampi/Leonardo es la utilidad POST gerencia.
- La utilidad bruta sale de Precio total − Precio consignación.
  Primer pago y Pago final son seguimiento de cobranza; NO entran al
  cálculo de utilidad.
- Antonio + Juampi + Leonardo = 10% de la post gerencia; Miami se queda el 90%.
- Los montos fijos se pueden sobrescribir por venta cuando un caso difiera.

## Al entregar planillas
- Generar siempre en formato .xlsx con fórmulas reales (no valores pegados),
  para que recalcule al cambiar datos.
- Cabeceras azules = campos que se ingresan; verdes = calculados.
- Incluir parámetros editables arriba y fila de totales abajo.
- Verificar cero errores de fórmula antes de entregar.
- La estructura debe quedar lista para importar al software Scala Motors;
  confirmar el orden de columnas que exige el importador antes de finalizar.

## Verificación obligatoria
Antes de dar por buena cualquier planilla o cálculo, contrastar con casos
conocidos del libro, por ejemplo:
- Una venta con utilidad antes de gerencia de $1.450.000 → gerencia $145.000
  → post gerencia $1.305.000 → Antonio $39.150 → utilidad final $1.174.500.

Si no cuadra, revisar la cascada antes de continuar.
