import { useState } from "react";

import { Input } from "@/components/ui/input";
import { formatCLP } from "@/lib/format";

const toNumberString = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "";
  return String(Math.round(value));
};

export function parseVehiclePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? null : n;
}

/** Input de precio CLP con formato al perder foco (mismo patrón que Consignaciones). */
export function VehiclePriceInput({
  value,
  onBlur,
  className,
  disabled,
}: {
  value: number | null;
  onBlur: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState("");

  return (
    <Input
      type="text"
      disabled={disabled}
      value={isFocused ? displayValue : formatCLP(value ?? 0)}
      onFocus={() => {
        setIsFocused(true);
        setDisplayValue(toNumberString(value));
      }}
      onBlur={(e) => {
        setIsFocused(false);
        setDisplayValue("");
        onBlur(e.target.value);
      }}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^\d]/g, "");
        setDisplayValue(cleaned);
      }}
      className={className}
      placeholder="—"
    />
  );
}
