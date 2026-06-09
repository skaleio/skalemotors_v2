import {
  SellerFollowUpActiveList,
  type SellerFollowUpActiveSeller,
} from "@/components/vendors/SellerFollowUpActiveList";
import { SellerFollowUpDayPanel } from "@/components/vendors/SellerFollowUpDayPanel";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useBranchSellers } from "@/hooks/useBranchSellers";
import {
  filterChecksForDate,
  filterNotesForDate,
  useSaveSellerFollowUpNote,
  useSellerFollowUpLeads,
  useSellerFollowUpMonthChecks,
  useSellerFollowUpMonthNotes,
  useToggleSellerFollowUpCheck,
} from "@/hooks/useSellerFollowUp";
import type { SellerFollowUpPeriod } from "@/lib/services/sellerFollowUp";
import { format, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

type SellerWithLeads = SellerFollowUpActiveSeller;

function dateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export default function SellerFollowUp() {
  const { user } = useAuth();
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [savingNoteSellerId, setSavingNoteSellerId] = useState<string | null>(null);

  const selectedDateKey = selectedDate ? dateKey(selectedDate) : null;

  const { sellers, loading: loadingSellers } = useBranchSellers({
    tenantId: user?.tenant_id,
    scope: "tenant",
    enabled: !!user?.tenant_id,
    roles: ["vendedor", "jefe_sucursal"],
  });

  const {
    data: activeLeads = [],
    isLoading: loadingLeads,
    isFetching: fetchingLeads,
  } = useSellerFollowUpLeads(!!user?.tenant_id);

  const {
    data: monthChecks = [],
    isLoading: loadingMonthChecks,
    isFetching: fetchingMonthChecks,
  } = useSellerFollowUpMonthChecks(calendarMonth, !!user?.tenant_id);

  const {
    data: monthNotes = [],
    isFetching: fetchingMonthNotes,
  } = useSellerFollowUpMonthNotes(calendarMonth, !!user?.tenant_id);

  const toggleCheck = useToggleSellerFollowUpCheck(calendarMonth);
  const saveNote = useSaveSellerFollowUpNote(calendarMonth);

  const sellersWithLeads: SellerWithLeads[] = useMemo(() => {
    const bySeller = new Map<string, SellerWithLeads>();

    for (const seller of sellers) {
      bySeller.set(seller.id, {
        id: seller.id,
        name: seller.full_name || seller.email || "Sin nombre",
        email: seller.email,
        crmColor: seller.crm_color ?? null,
        leads: [],
      });
    }

    for (const lead of activeLeads) {
      const sellerId = lead.assigned_to?.trim();
      if (!sellerId) continue;
      let row = bySeller.get(sellerId);
      if (!row) {
        row = {
          id: sellerId,
          name: lead.assigned_user?.full_name || "Vendedor",
          email: lead.assigned_user?.email ?? null,
          crmColor: lead.assigned_user?.crm_color ?? null,
          leads: [],
        };
        bySeller.set(sellerId, row);
      }
      row.leads.push({
        id: lead.id,
        full_name: lead.full_name,
        status: lead.status,
      });
    }

    return Array.from(bySeller.values())
      .filter((s) => s.leads.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [sellers, activeLeads]);

  const filteredSellers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sellersWithLeads;
    return sellersWithLeads.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        s.leads.some((l) => (l.full_name ?? "").toLowerCase().includes(q)),
    );
  }, [sellersWithLeads, searchQuery]);

  const checksByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of monthChecks) {
      if (!row.checked) continue;
      map.set(row.follow_up_date, (map.get(row.follow_up_date) ?? 0) + 1);
    }
    return map;
  }, [monthChecks]);

  const dayChecks = useMemo(() => {
    if (!selectedDateKey) return [];
    return filterChecksForDate(monthChecks, selectedDateKey);
  }, [monthChecks, selectedDateKey]);

  const dayNotes = useMemo(() => {
    if (!selectedDateKey) return [];
    return filterNotesForDate(monthNotes, selectedDateKey);
  }, [monthNotes, selectedDateKey]);

  const dayCheckMap = useMemo(() => {
    const map = new Map<string, { am: boolean; pm: boolean }>();
    for (const row of dayChecks) {
      const prev = map.get(row.seller_user_id) ?? { am: false, pm: false };
      if (row.period === "am") prev.am = row.checked;
      if (row.period === "pm") prev.pm = row.checked;
      map.set(row.seller_user_id, prev);
    }
    return map;
  }, [dayChecks]);

  const dayNoteMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of dayNotes) {
      map.set(row.seller_user_id, row.note ?? "");
    }
    return map;
  }, [dayNotes]);

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return;
    setSelectedDate(day);
    setSearchQuery("");
    setDayDialogOpen(true);
  };

  const handleToggle = (sellerUserId: string, period: SellerFollowUpPeriod, checked: boolean) => {
    if (!selectedDateKey) return;
    toggleCheck.mutate(
      { followUpDate: selectedDateKey, sellerUserId, period, checked },
      {
        onError: (err) => {
          toast({
            title: "No se pudo guardar",
            description: err instanceof Error ? err.message : "Intenta de nuevo.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleSaveNote = (sellerUserId: string, note: string) => {
    if (!selectedDateKey) return;
    setSavingNoteSellerId(sellerUserId);
    saveNote.mutate(
      { followUpDate: selectedDateKey, sellerUserId, note },
      {
        onSuccess: () => {
          toast({
            title: "Nota guardada",
            description: "La nota quedó registrada para este vendedor y fecha.",
          });
        },
        onError: (err) => {
          toast({
            title: "No se pudo guardar la nota",
            description: err instanceof Error ? err.message : "Intenta de nuevo.",
            variant: "destructive",
          });
        },
        onSettled: () => setSavingNoteSellerId(null),
      },
    );
  };

  const initialPageLoading =
    (loadingSellers || loadingLeads) && sellersWithLeads.length === 0;
  const syncingDay =
    (fetchingMonthChecks || fetchingMonthNotes || fetchingLeads) && !initialPageLoading;

  const followUpDateLabel = selectedDate
    ? format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })
    : "";

  const pendingCheckKey = toggleCheck.isPending
    ? `${toggleCheck.variables?.sellerUserId}-${toggleCheck.variables?.period}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Seguimiento de vendedores</h1>
          <p className="mt-2 text-muted-foreground">
            Calendario de supervisión AM/PM. Selecciona un día para revisar a los vendedores con leads
            activos, marcar seguimiento y dejar notas.
          </p>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <Link to="/app/vendors">Volver a Vendedores</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" />
              Calendario
            </CardTitle>
            <CardDescription>
              Haz clic en una fecha para abrir el checklist del día.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate ?? undefined}
              onSelect={handleDaySelect}
              onDayClick={handleDaySelect}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              locale={es}
              className="rounded-md border"
              modifiers={{
                hasChecks: (day) => {
                  if (!isSameMonth(day, calendarMonth)) return false;
                  return (checksByDate.get(dateKey(day)) ?? 0) > 0;
                },
              }}
              modifiersClassNames={{
                hasChecks:
                  "relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Vendedores con leads activos
            </CardTitle>
            <CardDescription>
              {initialPageLoading
                ? "Cargando plantilla y leads…"
                : selectedDate
                  ? `${sellersWithLeads.length} vendedor${sellersWithLeads.length === 1 ? "" : "es"} · seguimiento del ${format(selectedDate, "d 'de' MMMM", { locale: es })}`
                  : `${sellersWithLeads.length} vendedor${sellersWithLeads.length === 1 ? "" : "es"} con leads asignados.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SellerFollowUpActiveList
              sellers={sellersWithLeads}
              loading={initialPageLoading}
              checkMap={selectedDateKey ? dayCheckMap : null}
              followUpDateLabel={selectedDate ? followUpDateLabel : null}
            />
            {loadingMonthChecks ? null : (
              <p className="mt-4 text-xs text-muted-foreground">
                Los puntos en el calendario indican días con seguimientos marcados.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Seguimiento diario</DialogTitle>
            <DialogDescription>
              Marca AM/PM por vendedor (se guarda al instante). Usa{" "}
              <span className="font-medium">Guardar nota</span> para persistir las notas del día.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
            <SellerFollowUpDayPanel
              followUpDateLabel={followUpDateLabel}
              sellers={sellersWithLeads}
              filteredSellers={filteredSellers}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              loading={initialPageLoading}
              syncing={syncingDay}
              checkMap={dayCheckMap}
              noteMap={dayNoteMap}
              pendingCheckKey={pendingCheckKey}
              savingNoteSellerId={savingNoteSellerId}
              onToggleCheck={handleToggle}
              onSaveNote={handleSaveNote}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
