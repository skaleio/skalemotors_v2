import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  isCanonicalLeadTransmission,
  LEAD_TRANSMISSION_OPTIONS,
  LEAD_TRANSMISSION_UNSET,
  leadTransmissionFromSelectValue,
  leadTransmissionToSelectValue,
} from "@/lib/leadTransmission";

type LeadTransmissionSelectProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function LeadTransmissionSelect({
  id = "lead-transmision",
  label = "Transmisión",
  value,
  onChange,
  disabled,
}: LeadTransmissionSelectProps) {
  const selectValue = leadTransmissionToSelectValue(value);
  const showLegacy =
    value.trim().length > 0 && !isCanonicalLeadTransmission(value.trim());

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={selectValue}
        onValueChange={(v) => onChange(leadTransmissionFromSelectValue(v))}
        disabled={disabled}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Selecciona transmisión" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={LEAD_TRANSMISSION_UNSET}>Sin especificar</SelectItem>
          {LEAD_TRANSMISSION_OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
          {showLegacy ? (
            <SelectItem value={value.trim()}>
              {value.trim()} (anterior)
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}
