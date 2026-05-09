import { useState } from "react";
import { UserCog, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { consignacionesService } from "@/lib/services/consignaciones";
import { useMyTeam, type TeamMember } from "@/hooks/useMyTeam";

interface ReasignarConsignacionMenuProps {
  consignacionId: string;
  currentCreatorId: string | null | undefined;
  /** ID del user logueado (admin que reasigna). */
  ownerUserId: string | null | undefined;
  /** Callback al éxito — para refetch del padre. */
  onReassigned: () => void;
  /** Compact: botón sólo con icono. */
  compact?: boolean;
}

const roleShort: Record<string, string> = {
  admin: "Admin",
  jefe_jefe: "Jefe",
  vendedor: "Vendedor",
  jefe_sucursal: "Jefe sucursal",
  financiero: "Financiero",
  servicio: "Servicio",
  inventario: "Inventario",
};

function memberLabel(m: TeamMember): string {
  return m.full_name?.trim() || m.email?.trim() || "Sin nombre";
}

export function ReasignarConsignacionMenu({
  consignacionId,
  currentCreatorId,
  ownerUserId,
  onReassigned,
  compact = false,
}: ReasignarConsignacionMenuProps) {
  const { data: team, isLoading } = useMyTeam(ownerUserId);
  const [busy, setBusy] = useState(false);

  const handleReassign = async (newCreatorId: string) => {
    if (newCreatorId === currentCreatorId) return;
    setBusy(true);
    try {
      await consignacionesService.update(consignacionId, { created_by: newCreatorId });
      toast({ title: "Consignación reasignada", description: "El nuevo dueño ya tiene acceso." });
      onReassigned();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo reasignar";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={compact ? "icon" : "sm"} disabled={busy} title="Reasignar a otra persona">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />}
          {!compact && <span className="ml-2">Reasignar</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Reasignar a…</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <DropdownMenuItem disabled>
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Cargando equipo…
          </DropdownMenuItem>
        ) : !team || team.length === 0 ? (
          <DropdownMenuItem disabled>Sin equipo disponible</DropdownMenuItem>
        ) : (
          team.map((m) => {
            const isCurrent = m.id === currentCreatorId;
            return (
              <DropdownMenuItem
                key={m.id}
                disabled={isCurrent || busy}
                onClick={() => handleReassign(m.id)}
                className="flex items-start gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{memberLabel(m)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {roleShort[m.role] ?? m.role}
                    {m.email ? ` · ${m.email}` : ""}
                  </div>
                </div>
                {isCurrent && <Check className="h-3.5 w-3.5 mt-1 text-emerald-600" />}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
