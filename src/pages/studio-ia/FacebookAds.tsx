import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Facebook,
  Target,
  DollarSign,
  Users,
  Eye,
  MousePointer,
  BarChart3,
  Zap,
  Play,
  Pause,
  Edit,
  Trash2,
  Plus,
  Settings,
  MessageSquare,
  Loader2,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMetaAdsStatus,
  getMetaAdsCampaigns,
  getMetaAdsInsights,
  type MetaAdsCampaign,
  type MetaAdsInsight,
} from "@/lib/services/metaAdsApi";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_TRAFFIC: "Tráfico",
  OUTCOME_AWARENESS: "Alcance",
  OUTCOME_ENGAGEMENT: "Interacción",
  OUTCOME_LEADS: "Leads",
  OUTCOME_SALES: "Conversiones",
  OUTCOME_APP_PROMOTION: "App",
  VIDEO_VIEWS: "Reproducciones de video",
};

function formatBudget(value: string | undefined): string {
  if (value == null || value === "") return "—";
  const n = parseFloat(value);
  if (Number.isNaN(n)) return value;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return value;
  }
}

export default function FacebookAds() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const branchId = user?.branch_id ?? null;

  const [activeTab, setActiveTab] = useState("campaigns");
  const [insightsDatePreset, setInsightsDatePreset] = useState("last_30d");

  const { data: metaAdsStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["meta-ads-status", branchId],
    queryFn: () => getMetaAdsStatus(branchId!),
    enabled: !!branchId,
  });

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ["meta-ads-campaigns", branchId],
    queryFn: () => getMetaAdsCampaigns(branchId!),
    enabled: !!branchId && !!metaAdsStatus?.connected,
  });

  const { data: insightsData, isLoading: insightsLoading } = useQuery({
    queryKey: ["meta-ads-insights", branchId, insightsDatePreset],
    queryFn: () =>
      getMetaAdsInsights(branchId!, { datePreset: insightsDatePreset }),
    enabled: !!branchId && !!metaAdsStatus?.connected,
  });

  const campaigns: MetaAdsCampaign[] = campaignsData?.campaigns ?? [];
  const insights: MetaAdsInsight[] = insightsData?.insights ?? [];

  const connected = metaAdsStatus?.connected ?? false;
  const notConfigured = !branchId || (!statusLoading && !connected);

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400">Activa</Badge>;
      case "paused":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400">Pausada</Badge>;
      case "archived":
      case "deleted":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400">Finalizada</Badge>;
      default:
        return <Badge variant="secondary">{status || "—"}</Badge>;
    }
  };

  const getObjectiveLabel = (objective: string | undefined) =>
    objective ? OBJECTIVE_LABELS[objective] ?? objective : "—";

  if (notConfigured) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app/studio-ia")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Facebook Ads</h1>
            <p className="text-muted-foreground">
              Ver métricas y campañas de Meta (Facebook e Instagram)
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Facebook className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Conecta tu cuenta de Meta Ads</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Para ver campañas y métricas aquí, conecta tu cuenta de Meta (Facebook/Instagram) Ads en Integraciones.
            </p>
            <Button asChild>
              <Link to="/app/integrations">
                <Settings className="h-4 w-4 mr-2" />
                Ir a Integraciones
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const aggregatedInsight = insights.length > 0
    ? insights.reduce(
        (acc, row) => {
          acc.impressions += parseFloat(String(row.impressions ?? 0)) || 0;
          acc.clicks += parseFloat(String(row.clicks ?? 0)) || 0;
          acc.spend += parseFloat(String(row.spend ?? 0)) || 0;
          acc.reach += parseFloat(String(row.reach ?? 0)) || 0;
          return acc;
        },
        { impressions: 0, clicks: 0, spend: 0, reach: 0 }
      )
    : null;

  const ctr = aggregatedInsight && aggregatedInsight.impressions > 0
    ? ((aggregatedInsight.clicks / aggregatedInsight.impressions) * 100).toFixed(2) + "%"
    : "—";
  const cpc = aggregatedInsight && aggregatedInsight.clicks > 0
    ? "$" + (aggregatedInsight.spend / aggregatedInsight.clicks).toFixed(2)
    : "—";

  const chartData = insights
    .filter((i) => i.date_start)
    .map((i) => ({
      date: i.date_start!.slice(0, 10),
      impresiones: parseFloat(String(i.impressions ?? 0)) || 0,
      clics: parseFloat(String(i.clicks ?? 0)) || 0,
      gasto: parseFloat(String(i.spend ?? 0)) || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/app/studio-ia")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facebook Ads</h1>
          <p className="text-muted-foreground">
            Campañas y métricas de Meta (Facebook e Instagram)
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="campaigns">Campañas</TabsTrigger>
          <TabsTrigger value="create">Crear Campaña</TabsTrigger>
          <TabsTrigger value="audiences">Audiencias</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Mis Campañas</h2>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://business.facebook.com/adsmanager"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Meta Ads Manager
              </a>
            </Button>
          </div>

          {campaignsLoading ? (
            <Card>
              <CardContent className="p-12 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : campaigns.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaña</TableHead>
                      <TableHead>Objetivo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Presupuesto diario</TableHead>
                      <TableHead>Presupuesto total</TableHead>
                      <TableHead>Inicio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{campaign.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{campaign.id}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {getObjectiveLabel(campaign.objective)}
                        </TableCell>
                        <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                        <TableCell>{formatBudget(campaign.daily_budget)}</TableCell>
                        <TableCell>{formatBudget(campaign.lifetime_budget)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(campaign.created_time)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Facebook className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No hay campañas en esta cuenta</h3>
                <p className="text-muted-foreground mb-4">
                  Crea campañas en Meta Ads Manager para verlas aquí.
                </p>
                <Button asChild variant="outline">
                  <a
                    href="https://business.facebook.com/adsmanager"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ir a Meta Ads Manager
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardContent className="p-12 text-center">
              <Zap className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Crear campaña</h3>
              <p className="text-muted-foreground mb-4">
                La creación de campañas se realiza en Meta Ads Manager. Desde aquí solo puedes ver métricas y campañas ya existentes.
              </p>
              <Button asChild>
                <a
                  href="https://business.facebook.com/adsmanager"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir Meta Ads Manager
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audiences" className="space-y-6">
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Audiencias</h3>
              <p className="text-muted-foreground">
                Gestiona audiencias en Meta Business Suite o Ads Manager.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <a
                  href="https://business.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Meta Business Suite
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Período:</span>
            <Select value={insightsDatePreset} onValueChange={setInsightsDatePreset}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_7d">Últimos 7 días</SelectItem>
                <SelectItem value="last_30d">Últimos 30 días</SelectItem>
                <SelectItem value="last_90d">Últimos 90 días</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {insightsLoading ? (
            <Card>
              <CardContent className="p-12 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Alcance</p>
                        <p className="text-2xl font-bold">
                          {aggregatedInsight ? Number(aggregatedInsight.reach).toLocaleString() : "—"}
                        </p>
                      </div>
                      <Eye className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Impresiones</p>
                        <p className="text-2xl font-bold">
                          {aggregatedInsight ? Number(aggregatedInsight.impressions).toLocaleString() : "—"}
                        </p>
                      </div>
                      <BarChart3 className="h-8 w-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Clics</p>
                        <p className="text-2xl font-bold">
                          {aggregatedInsight ? Number(aggregatedInsight.clicks).toLocaleString() : "—"}
                        </p>
                      </div>
                      <MousePointer className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Gasto</p>
                        <p className="text-2xl font-bold">
                          {aggregatedInsight ? `$${Number(aggregatedInsight.spend).toFixed(2)}` : "—"}
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-muted-foreground mb-1">CTR</p>
                    <p className="text-2xl font-bold">{ctr}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-muted-foreground mb-1">CPC</p>
                    <p className="text-2xl font-bold">{cpc}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Rendimiento en el tiempo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            formatter={(value: number) => [value.toLocaleString(), ""]}
                            labelFormatter={(label) => `Fecha: ${label}`}
                          />
                          <Bar dataKey="impresiones" name="Impresiones" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="clics" name="Clics" fill="#22c55e" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="gasto" name="Gasto" fill="#f97316" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay datos por día para el período seleccionado.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
