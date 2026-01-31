import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Target, Phone, Mail, Filter } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLeads } from "@/hooks/useLeads";
import { leadService } from "@/lib/services/leads";

const CONSIGNACION_TAG_PREFIX = "consignacion:";

const normalizeTags = (tags: unknown) => {
  if (!Array.isArray(tags)) return [] as string[];
  return tags.filter((tag) => typeof tag === "string") as string[];
};

const statusLabels: Record<string, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  interesado: "Interesado",
  cotizando: "Cotizando",
  negociando: "Negociando",
  vendido: "Cerrado (Vendido)",
  perdido: "Cerrado (Perdido)",
};

const statusStyles: Record<string, { dot: string; text: string }> = {
  nuevo: { dot: "bg-slate-400", text: "text-slate-700" },
  contactado: { dot: "bg-blue-500", text: "text-blue-600" },
  interesado: { dot: "bg-indigo-500", text: "text-indigo-600" },
  cotizando: { dot: "bg-amber-500", text: "text-amber-600" },
  negociando: { dot: "bg-orange-500", text: "text-orange-600" },
  vendido: { dot: "bg-emerald-600", text: "text-emerald-700" },
  perdido: { dot: "bg-red-500", text: "text-red-600" },
};

const getStatusMeta = (value: string) => {
  const normalized = value || "nuevo";
  return {
    label: statusLabels[normalized] || normalized,
    styles: statusStyles[normalized] || statusStyles.nuevo,
  };
};

export default function Leads() {
  const { user } = useAuth();
  const { leads, loading, refetch } = useLeads({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch = !query
        || lead.full_name.toLowerCase().includes(query)
        || (lead.email || "").toLowerCase().includes(query)
        || (lead.phone || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "cerrado"
            ? ["vendido", "perdido"].includes(lead.status)
            : lead.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [leads, searchQuery, statusFilter]);

  const sourceLabels: Record<string, string> = {
    web: "Web",
    referido: "Referido",
    walk_in: "Walk-in",
    telefono: "Teléfono",
    redes_sociales: "Redes sociales",
    evento: "Evento",
    otro: "Otro",
  };

  const handleStatusChange = async (leadId: string, nextStatus: string) => {
    const currentLead = leads.find((item) => item.id === leadId);
    if (!currentLead || currentLead.status === nextStatus) return;

    try {
      await leadService.update(leadId, { status: nextStatus as any });
      await refetch();
    } catch (error: any) {
      console.error("Error actualizando estado del lead:", error);
      await refetch();
      alert(error?.message || "No se pudo actualizar el estado del lead.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona tus leads y oportunidades de venta
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Lead
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="nuevo">Nuevo</SelectItem>
                <SelectItem value="contactado">Contactado</SelectItem>
                <SelectItem value="interesado">Interesado</SelectItem>
                <SelectItem value="cerrado">Cerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Lista de Leads
          </CardTitle>
          <CardDescription>
            Gestiona y sigue el progreso de tus leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Cargando leads...
                  </TableCell>
                </TableRow>
              ) : filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay leads registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.full_name || "Sin nombre"}</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{lead.phone || "Sin telefono"}</span>
                        </div>
                        {lead.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{lead.email}</span>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const tags = normalizeTags(lead.tags);
                        const isConsignacion = tags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX));
                        const label = isConsignacion ? "Consignaciones" : (sourceLabels[lead.source] || lead.source);
                        return <Badge variant="secondary">{label}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const meta = getStatusMeta(lead.status);
                        return (
                          <Select
                            value={lead.status}
                            onValueChange={(value) => handleStatusChange(lead.id, value)}
                          >
                            <SelectTrigger
                              className="h-8 w-auto gap-2 rounded-full border px-3"
                              aria-label={`Estado ${meta.label}`}
                            >
                              <span className={`h-2 w-2 rounded-full ${meta.styles.dot}`} />
                              <span className={`text-xs font-medium ${meta.styles.text}`}>{meta.label}</span>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusLabels).map(([key, label]) => {
                                const styles = statusStyles[key] || statusStyles.nuevo;
                                return (
                                  <SelectItem key={key} value={key}>
                                    <span className="flex items-center gap-2">
                                      <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                                      <span className={styles.text}>{label}</span>
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {new Date(lead.created_at).toLocaleDateString("es-CL")}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      —
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
