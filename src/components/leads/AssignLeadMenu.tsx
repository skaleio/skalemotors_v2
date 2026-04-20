import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useBranchSellers } from "@/hooks/useBranchSellers";
import { leadService } from "@/lib/services/leads";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, UserPlus, UserX } from "lucide-react";
import { memo, useState } from "react";

interface AssignLeadMenuProps {
  leadId: string;
  assignedTo: string | null | undefined;
  assignedLabel?: string | null;
  leadBranchId?: string | null;
}

const ROLES_CAN_DELEGATE = new Set([
  "admin",
  "gerente",
  "jefe_jefe",
  "jefe_sucursal",
  "financiero",
]);

function AssignLeadMenuBase({ leadId, assignedTo, assignedLabel, leadBranchId }: AssignLeadMenuProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const canDelegate = !!user?.role && ROLES_CAN_DELEGATE.has(user.role);

  const { sellers, loading } = useBranchSellers({
    tenantId: user?.tenant_id ?? null,
    branchId: leadBranchId ?? user?.branch_id ?? null,
    enabled: open && canDelegate,
  });

  const assignMutation = useMutation({
    mutationFn: async (vendorId: string | null) => {
      return leadService.update(leadId, { assigned_to: vendorId });
    },
    onSuccess: (_data, vendorId) => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: vendorId ? "Lead delegado" : "Lead sin asignar",
        description: vendorId ? "El vendedor asignado ya puede ver este lead." : "Se removió la asignación del lead.",
      });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({
        title: "No se pudo asignar",
        description: err.message || "Revisa permisos y vuelve a intentarlo.",
        variant: "destructive",
      });
    },
  });

  if (!canDelegate) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={(event) => event.stopPropagation()}
          aria-label="Delegar lead a vendedor"
          title={assignedLabel ? `Asignado a ${assignedLabel}` : "Asignar vendedor"}
        >
          {assignMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuLabel>Delegar a vendedor</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="px-2 py-3 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Cargando vendedores…
          </div>
        ) : sellers.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">
            No hay vendedores activos en esta sucursal.
          </div>
        ) : (
          sellers.map((seller) => {
            const isCurrent = seller.id === assignedTo;
            return (
              <DropdownMenuItem
                key={seller.id}
                disabled={assignMutation.isPending || isCurrent}
                onClick={() => assignMutation.mutate(seller.id)}
                className="gap-2"
              >
                {isCurrent ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <span className="w-3.5" />}
                <span className="truncate">{seller.full_name || seller.email || seller.id}</span>
              </DropdownMenuItem>
            );
          })
        )}
        {assignedTo ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={assignMutation.isPending}
              onClick={() => assignMutation.mutate(null)}
              className="gap-2 text-red-600 focus:text-red-600"
            >
              <UserX className="h-3.5 w-3.5" />
              Quitar asignación
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const AssignLeadMenu = memo(AssignLeadMenuBase);
