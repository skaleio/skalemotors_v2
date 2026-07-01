import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NOTIFICATION_EVENT_TYPES,
  getNotificationEventMeta,
  notificationEventsForRole,
  notificationLabelForType,
  type NotificationEventKey,
} from "@/lib/notificationEvents";
import { Bell, Building2, Check, Clock, Info, Loader2, User, UserCircle2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranchSellers } from "@/hooks/useBranchSellers";
import { useStaffBranchByName } from "@/hooks/useStaffBranchByName";
import { useNavigationWithLoading } from "@/hooks/useNavigationWithLoading";
import {
  useDismissNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { es as esLocale } from "date-fns/locale";

import { navigateFromNotification } from "@/lib/notificationNavigation";

type Filter = "all" | "unread" | NotificationEventKey;

function iconFor(type: string): JSX.Element {
  const meta = getNotificationEventMeta(type);
  if (meta) {
    const Icon = meta.icon;
    return <Icon className={`h-5 w-5 ${meta.iconClass}`} />;
  }
  return <Info className="h-5 w-5 text-gray-500" />;
}

function formatTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: esLocale });
  } catch {
    return "";
  }
}

type NotificationMeta = {
  assignee_name?: string | null;
  seller_name?: string | null;
  actor_name?: string | null;
  lead_full_name?: string | null;
  owner_name?: string | null;
  branch_name?: string | null;
};

function metaOf(n: Notification): NotificationMeta {
  const m = n.metadata;
  return m && typeof m === "object" && !Array.isArray(m) ? (m as NotificationMeta) : {};
}

/** Vendedor al que pertenece la alerta: primero el nombre real del metadata, luego actor_user_id. */
function sellerNameOf(n: Notification, fallbackById: Map<string, string>): string | null {
  const m = metaOf(n);
  const name =
    m.assignee_name?.trim() ||
    m.seller_name?.trim() ||
    m.actor_name?.trim() ||
    (n.actor_user_id ? fallbackById.get(n.actor_user_id) : "") ||
    "";
  return name || null;
}

/** Lead/cliente por el cual llega la notificación. */
function leadNameOf(n: Notification): string | null {
  const m = metaOf(n);
  return m.lead_full_name?.trim() || m.owner_name?.trim() || null;
}

/**
 * Sucursal a mostrar en el aviso: la del vendedor según Finanzas → Vendedores
 * (branch_sales_staff), buscada por nombre. Si el vendedor no está en la
 * plantilla, cae al branch_name que trae el metadata (sucursal del lead).
 */
function branchNameOf(
  n: Notification,
  sellerName: string | null,
  branchByName: Map<string, string>,
): string | null {
  if (sellerName) {
    const fromRoster = branchByName.get(sellerName.toLocaleLowerCase("es"));
    if (fromRoster) return fromRoster;
  }
  return metaOf(n).branch_name?.trim() || null;
}

export default function Alerts() {
  const { user } = useAuth();
  const { navigateWithLoading } = useNavigationWithLoading();
  const [filter, setFilter] = useState<Filter>("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [vendorFilter, setVendorFilter] = useState<string>("all");

  const isAdmin = user?.role === "admin";

  const { notifications, unreadCount, isLoading } = useNotifications({
    userId: user?.id,
    role: user?.role,
    limit: 100,
    includeArchived,
    syncStaleAlerts: true,
  });

  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const dismissMutation = useDismissNotification();

  // Nombres reales de los vendedores del tenant (solo admin), para etiquetar el
  // filtro con el nombre y no con "Vendedor" genérico.
  const { sellers } = useBranchSellers({
    tenantId: user?.tenant_id,
    scope: "tenant",
    enabled: isAdmin && !!user?.tenant_id,
  });

  const sellerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sellers) {
      if (s.full_name?.trim()) map.set(s.id, s.full_name.trim());
    }
    return map;
  }, [sellers]);

  // Sucursal del vendedor según Finanzas → Vendedores (branch_sales_staff),
  // fuente de verdad de la sucursal mostrada en cada aviso.
  const { branchByName } = useStaffBranchByName({
    tenantId: user?.tenant_id,
    enabled: isAdmin && !!user?.tenant_id,
  });

  // Cards visibles según el rol del usuario (solo las que le aplican).
  const visibleEvents = useMemo(
    () => notificationEventsForRole(user?.role),
    [user?.role],
  );

  // Vendedores presentes en las alertas (solo admin): el vendedor sale del
  // metadata real de cada notificación (assignee_name / seller_name / actor_name),
  // no de actor_user_id, que viene null en la mayoría de las alertas de leads.
  // Se deduplica por nombre para unir identidades (usuario CRM vs plantilla).
  const vendorOptions = useMemo(() => {
    if (!isAdmin) return [] as { key: string; name: string }[];
    const map = new Map<string, string>();
    for (const n of notifications) {
      const name = sellerNameOf(n, sellerNameById);
      if (!name) continue;
      const key = name.toLocaleLowerCase("es");
      if (!map.has(key)) map.set(key, name);
    }
    return [...map.entries()]
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [notifications, isAdmin, sellerNameById]);

  // El filtro por vendedor recorta el set base; sobre él se calculan tarjetas,
  // total no leídas e historial. El filtro por tipo se combina encima.
  const scopedNotifications = useMemo(() => {
    if (vendorFilter === "all") return notifications;
    return notifications.filter((n) => {
      const name = sellerNameOf(n, sellerNameById);
      return name ? name.toLocaleLowerCase("es") === vendorFilter : false;
    });
  }, [notifications, vendorFilter, sellerNameById]);

  const scopedUnreadCount = useMemo(
    () => scopedNotifications.filter((n) => !n.read_at && !n.archived_at).length,
    [scopedNotifications],
  );

  const countsByType = useMemo(() => {
    const acc: Record<string, { unread: number; total: number }> = {};
    for (const t of NOTIFICATION_EVENT_TYPES) {
      acc[t.key] = { unread: 0, total: 0 };
    }
    for (const n of scopedNotifications) {
      const bucket = acc[n.type];
      if (!bucket) continue;
      bucket.total += 1;
      if (!n.read_at && !n.archived_at) bucket.unread += 1;
    }
    return acc;
  }, [scopedNotifications]);

  const filtered = scopedNotifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read_at;
    return n.type === filter;
  });

  const openNotification = (n: Notification) => {
    if (!n.read_at) markReadMutation.mutate(n.id);
    navigateFromNotification(n, navigateWithLoading);
  };

  const emptyHint = (() => {
    if (user?.role === "vendedor") return "Aquí verás los leads que te asignen y recordatorios relevantes para tu día.";
    if (user?.role === "admin")
      return "Aquí aparecerán avisos de tu equipo: leads contactados, vendedores sin actividad, negocios cerrados y consignaciones.";
    if (user?.role === "jefe_sucursal")
      return "Aquí verás vendedores sin actividad en tu sucursal, leads estancados y avisos del equipo.";
    return "Aquí aparecerán los avisos importantes de tu sucursal y equipo.";
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alertas</h1>
          <p className="text-muted-foreground mt-2">
            Historial completo de notificaciones
            {unreadCount > 0 && (
              <span className="ml-2 text-pink-600 font-medium">({unreadCount} sin leer)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIncludeArchived((v) => !v)}>
            {includeArchived ? "Ocultar archivadas" : "Mostrar archivadas"}
          </Button>
          {unreadCount > 0 && user?.id && (
            <Button
              size="sm"
              onClick={() => markAllReadMutation.mutate(user.id)}
              disabled={markAllReadMutation.isPending}
            >
              Marcar todas como leídas
            </Button>
          )}
        </div>
      </div>

      {/* Resumen por tipo (clickeable, filtra el historial) */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {/* Card pivot: Total no leídas */}
        <Card
          role="button"
          onClick={() => setFilter("unread")}
          className={`cursor-pointer transition-shadow hover:shadow-md ${
            filter === "unread" ? "ring-2 ring-pink-500" : ""
          }`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-orange-500" />
              Total no leídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scopedUnreadCount}</div>
            <p className="text-xs text-muted-foreground">Click para filtrar</p>
          </CardContent>
        </Card>

        {visibleEvents.map((e) => {
          const Icon = e.icon;
          const { unread, total } = countsByType[e.key];
          const isActive = filter === e.key;
          return (
            <Card
              key={e.key}
              role="button"
              onClick={() => setFilter((prev) => (prev === e.key ? "all" : e.key))}
              className={`cursor-pointer transition-shadow hover:shadow-md ${
                isActive ? "ring-2 ring-pink-500" : ""
              }`}
              title={e.description}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon className={`h-4 w-4 ${e.iconClass}`} />
                  {e.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold">{unread}</div>
                  {total > unread && (
                    <span className="text-xs text-muted-foreground">/ {total}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{e.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Historial */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Historial
            </CardTitle>
            <CardDescription>
              Últimas 100 notificaciones
              {filter !== "all" && (
                <>
                  {" "}· filtrando por{" "}
                  <span className="font-medium">
                    {filter === "unread" ? "no leídas" : notificationLabelForType(filter)}
                  </span>
                </>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && vendorOptions.length > 0 && (
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los vendedores</SelectItem>
                  {vendorOptions.map((v) => (
                    <SelectItem key={v.key} value={v.key}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {filter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>
                Limpiar filtro
              </Button>
            )}
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger className="w-[230px]">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="unread">No leídas</SelectItem>
                {visibleEvents.map((e) => (
                  <SelectItem key={e.key} value={e.key}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="mb-2 font-medium text-foreground">
                {notifications.length === 0 ? "Todavía no hay notificaciones" : "Sin resultados para este filtro"}
              </p>
              <p className="text-sm max-w-md mx-auto">{emptyHint}</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((n) => {
                const unread = !n.read_at;
                const archived = !!n.archived_at;
                const sellerName = sellerNameOf(n, sellerNameById);
                const leadName = leadNameOf(n);
                const branchName = branchNameOf(n, sellerName, branchByName);
                return (
                  <div
                    key={n.id}
                    className={`p-4 flex items-start gap-3 ${unread ? "bg-pink-50/40 dark:bg-pink-900/10" : ""}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">{iconFor(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="cursor-pointer" onClick={() => openNotification(n)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold">{n.title}</h4>
                          <Badge variant="outline" className="text-xs font-normal">
                            {notificationLabelForType(n.type)}
                          </Badge>
                          {unread && <Badge variant="secondary">Nuevo</Badge>}
                          {archived && <Badge variant="outline">Archivada</Badge>}
                        </div>
                        {n.message && <p className="text-sm text-muted-foreground mt-1">{n.message}</p>}
                        {(sellerName || leadName || branchName) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                            {sellerName && (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <User className="h-3 w-3 text-pink-600" />
                                Vendedor: <span className="font-medium text-foreground">{sellerName}</span>
                              </span>
                            )}
                            {leadName && (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <UserCircle2 className="h-3 w-3 text-sky-600" />
                                Lead: <span className="font-medium text-foreground">{leadName}</span>
                              </span>
                            )}
                            {branchName && (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Building2 className="h-3 w-3 text-amber-600" />
                                Sucursal: <span className="font-medium text-foreground">{branchName}</span>
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <Clock className="h-3 w-3" />
                          <span>{formatTime(n.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {unread && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markReadMutation.mutate(n.id)}
                          title="Marcar como leída"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      {!archived && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => dismissMutation.mutate(n.id)}
                          title="Archivar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
