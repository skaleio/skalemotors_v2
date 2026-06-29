import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useOverdueAppointments } from "@/hooks/useOverdueAppointments";
import { appointmentService } from "@/lib/services/appointments";
import type { Database } from "@/lib/types/database";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, CalendarClock, Loader2 } from "lucide-react";
import { useState } from "react";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"] & {
  lead?: { full_name?: string | null; phone?: string | null } | null;
  vehicle?: { make?: string | null; model?: string | null; year?: number | null } | null;
};

type Outcome = "completada" | "no_asistio" | "cancelada";

const OUTCOMES: { value: Outcome; label: string; hint: string }[] = [
  { value: "completada", label: "Se concretó", hint: "El cliente asistió y avanzó" },
  { value: "no_asistio", label: "No asistió", hint: "El cliente no se presentó" },
  { value: "cancelada", label: "No se concretó / cancelada", hint: "Se cae la cita" },
];

const NOTE_MIN = 3;

function GateContent({ appointments }: { appointments: Appointment[] }) {
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState(appointments);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const current = queue[0];
  if (!current) return null;

  const total = appointments.length;
  const resolved = total - queue.length;
  const clientName = current.lead?.full_name?.trim() || current.title?.trim() || "Sin nombre";
  const vehicle = current.vehicle
    ? `${current.vehicle.make ?? ""} ${current.vehicle.model ?? ""} ${current.vehicle.year ?? ""}`.trim()
    : null;
  const when = format(new Date(current.scheduled_at), "EEEE dd-MM-yyyy 'a las' HH:mm", { locale: es });
  const canSave = !!outcome && note.trim().length >= NOTE_MIN && !saving;

  const handleSave = async () => {
    if (!outcome || note.trim().length < NOTE_MIN) return;
    setSaving(true);
    try {
      await appointmentService.resolveOverdue(current.id, outcome, note, current.description);
      setQueue((prev) => prev.slice(1));
      setOutcome(null);
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Cita registrada" });
    } catch (err) {
      toast({
        title: "No se pudo guardar",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-[460px] [&>button]:hidden"
      >
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            ¿Qué pasó con esta cita?
          </DialogTitle>
          <DialogDescription>
            Tenés {total} cita{total !== 1 ? "s" : ""} vencida{total !== 1 ? "s" : ""} sin cerrar.
            Registrá el resultado para continuar.
            {total > 1 ? ` (${resolved + 1} de ${total})` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
            <div className="font-medium">{clientName}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              <span className="capitalize">{when}</span>
            </div>
            {vehicle ? (
              <div className="mt-0.5 text-xs text-muted-foreground">{vehicle}</div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Resultado</Label>
            <RadioGroup
              value={outcome ?? ""}
              onValueChange={(v) => setOutcome(v as Outcome)}
              className="gap-2"
            >
              {OUTCOMES.map((o) => (
                <Label
                  key={o.value}
                  htmlFor={`outcome-${o.value}`}
                  className="flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-sm font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                >
                  <RadioGroupItem id={`outcome-${o.value}`} value={o.value} className="mt-0.5" />
                  <span>
                    <span className="block font-medium">{o.label}</span>
                    <span className="block text-xs text-muted-foreground">{o.hint}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="overdue-note" className="text-sm">
              Nota (obligatoria)
            </Label>
            <Textarea
              id="overdue-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: el cliente reagendó para la próxima semana / no contestó el teléfono…"
              rows={3}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" className="w-full" disabled={!canSave} onClick={handleSave}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar y continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OverdueAppointmentsGate() {
  const { user } = useAuth();
  const { overdue } = useOverdueAppointments(user?.id);

  if (!user || overdue.length === 0) return null;

  return <GateContent key={overdue[0].id} appointments={overdue as Appointment[]} />;
}
