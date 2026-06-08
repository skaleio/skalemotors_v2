import { ContactAttemptsBar } from "@/components/leads/ContactAttemptsBar";

export interface CrmLeadContactTrackingBlockProps {
  leadId: string;
  value: number;
  /** Modo edición del diálogo: actualiza al instante y persiste al guardar. */
  localOnly?: boolean;
  onChange?: (next: number) => void;
}

export function CrmLeadContactTrackingBlock({
  leadId,
  value,
  localOnly = false,
  onChange,
}: CrmLeadContactTrackingBlockProps) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2.5">
      <p className="text-sm font-medium text-foreground mb-1">Seguimiento de llamadas</p>
      <p className="text-[11px] text-muted-foreground mb-2.5 leading-relaxed">
        Deben hacer dos llamados y enviar el mensaje al cliente. Si no contesta, marca la primera
        barrita para dejar claro que llamaste y el cliente no respondió.
      </p>
      <ContactAttemptsBar
        leadId={leadId}
        value={value}
        showLabel={false}
        localOnly={localOnly}
        onChange={onChange}
      />
      <p className="text-[11px] text-muted-foreground mt-1.5">
        Meta: 3 contactos. Al llegar a 3 el lead baja al final de su columna.
      </p>
    </div>
  );
}
