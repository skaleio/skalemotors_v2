import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export interface FinancePeriod {
  year: number;
  month: number; // 1-12
}

export interface FinanceMonthSelectorProps {
  /** Período seleccionado (año y mes 1-12) */
  period: FinancePeriod;
  onPeriodChange: (period: FinancePeriod) => void;
  /** Año mínimo para el selector (ej. 2020) */
  minYear?: number;
  /** Año máximo (ej. 2033) */
  maxYear?: number;
  /** Si true, muestra opción "Ver por día" o agrupación por día (solo visual en lista) */
  showDayFilter?: boolean;
  className?: string;
}

/**
 * Selector de mes/año para Finanzas. Permite navegar mes a mes (← / →) y elegir mes/año en dropdown.
 * No elimina datos: solo filtra lo que se muestra por el período seleccionado.
 */
export function FinanceMonthSelector({
  period,
  onPeriodChange,
  minYear = 2026,
  maxYear = 2033,
  showDayFilter = false,
  className = "",
}: FinanceMonthSelectorProps) {
  const goPrev = () => {
    if (period.month === 1) {
      onPeriodChange({ year: period.year - 1, month: 12 });
    } else {
      onPeriodChange({ year: period.year, month: period.month - 1 });
    }
  };

  const goNext = () => {
    if (period.month === 12) {
      onPeriodChange({ year: period.year + 1, month: 1 });
    } else {
      onPeriodChange({ year: period.year, month: period.month + 1 });
    }
  };

  const isCurrentMonth =
    period.year === new Date().getFullYear() &&
    period.month === new Date().getMonth() + 1;

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i).sort(
    (a, b) => b - a
  );

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={goPrev}
        aria-label="Mes anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1">
        <Select
          value={String(period.month)}
          onValueChange={(v) => onPeriodChange({ ...period, month: Number(v) })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={i} value={String(i + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(period.year)}
          onValueChange={(v) => onPeriodChange({ ...period, year: Number(v) })}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={goNext}
        aria-label="Mes siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {isCurrentMonth && (
        <span className="text-muted-foreground text-sm">(mes actual)</span>
      )}
    </div>
  );
}

/** Devuelve el primer y último día del mes en YYYY-MM-DD (fechas locales). */
export function getMonthDateRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

/** Período del mes actual (año y mes 1-12). */
export function getCurrentPeriod(): FinancePeriod {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}
