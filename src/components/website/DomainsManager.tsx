import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTenantDomains } from "@/hooks/useTenantSite";
import {
  useAddCustomDomain,
  useProvisionSubdomain,
  useRemoveDomain,
  useSetPrimaryDomain,
  useVerifyDomain,
} from "@/hooks/useVitrinaDomain";
import type { TenantDomain } from "@/lib/services/tenantSite";
import type { VitrinaDnsRecord } from "@/lib/services/vitrinaDomainApi";
import { vitrinaDomainApi } from "@/lib/services/vitrinaDomainApi";

const VERCEL_APEX = "76.76.21.21";
const VERCEL_CNAME = "cname.vercel-dns.com";

function statusBadge(status: TenantDomain["verification_status"]) {
  if (status === "verified") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Verificado</Badge>;
  }
  if (status === "error") {
    return <Badge variant="destructive">Error</Badge>;
  }
  return <Badge variant="secondary">Pendiente DNS</Badge>;
}

function kindLabel(kind: TenantDomain["kind"]) {
  return kind === "subdomain" ? "Subdominio Skale" : "Dominio propio";
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
  toast.success("Copiado al portapapeles");
}

export function DomainsManager() {
  const hasPendingCustom = useCallback(
    (list: TenantDomain[]) =>
      list.some((d) => d.kind === "custom" && d.verification_status === "pending"),
    [],
  );

  const { data: domains = [], isLoading, refetch } = useTenantDomains();
  const pendingPoll = hasPendingCustom(domains);

  useEffect(() => {
    if (!pendingPoll) return;
    const id = window.setInterval(() => {
      void refetch();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [pendingPoll, refetch]);

  const provision = useProvisionSubdomain();
  const addDomain = useAddCustomDomain();
  const verify = useVerifyDomain();
  const setPrimary = useSetPrimaryDomain();
  const remove = useRemoveDomain();

  const [customInput, setCustomInput] = useState("");
  const [dnsByDomainId, setDnsByDomainId] = useState<Record<string, VitrinaDnsRecord[]>>({});

  const subdomain = useMemo(
    () => domains.find((d) => d.kind === "subdomain"),
    [domains],
  );
  const customDomains = useMemo(
    () => domains.filter((d) => d.kind === "custom"),
    [domains],
  );

  const loadDnsForDomain = useCallback(async (domainId: string) => {
    try {
      const res = await vitrinaDomainApi.getDomainStatus(domainId);
      if (res.dns_records?.length) {
        setDnsByDomainId((prev) => ({ ...prev, [domainId]: res.dns_records! }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    for (const d of customDomains) {
      if (d.verification_status === "pending" && !dnsByDomainId[d.id]) {
        void loadDnsForDomain(d.id);
      }
    }
  }, [customDomains, dnsByDomainId, loadDnsForDomain]);

  const handleProvision = () => {
    provision.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(res.message ?? "Subdominio activado");
      },
      onError: (e) =>
        toast.error("No se pudo activar el subdominio", {
          description: e instanceof Error ? e.message : undefined,
        }),
    });
  };

  const handleAddCustom = () => {
    const value = customInput.trim();
    if (!value) return;
    addDomain.mutate(value, {
      onSuccess: (res) => {
        setCustomInput("");
        if (res.domain?.id && res.dns_records?.length) {
          setDnsByDomainId((prev) => ({
            ...prev,
            [res.domain!.id]: res.dns_records!,
          }));
        }
        toast.success("Dominio agregado. Configurá el DNS en tu registrador.");
      },
      onError: (e) =>
        toast.error("No se pudo agregar el dominio", {
          description: e instanceof Error ? e.message : undefined,
        }),
    });
  };

  const handleVerify = (domainId: string) => {
    verify.mutate(domainId, {
      onSuccess: (res) => {
        if (res.dns_records?.length) {
          setDnsByDomainId((prev) => ({ ...prev, [domainId]: res.dns_records! }));
        }
        const status = res.domain?.verification_status;
        if (status === "verified") {
          toast.success("Dominio verificado. Tu vitrina ya puede recibir visitas.");
        } else if (status === "error") {
          toast.error("Vercel no pudo verificar el dominio. Revisá los registros DNS.");
        } else {
          toast.message("Aún pendiente", {
            description: "La propagación DNS puede tardar hasta 48 horas.",
          });
        }
      },
      onError: (e) =>
        toast.error("Error al verificar", {
          description: e instanceof Error ? e.message : undefined,
        }),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando dominios...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Globe className="h-4 w-4" />
        <AlertTitle>Migrar tu dominio existente</AlertTitle>
        <AlertDescription>
          No necesitás transferir el dominio a Skale. Mantenelo en NIC Chile (u otro registrador) y
          solo cambiá los registros DNS para apuntar a Vercel. Cuando el estado sea{" "}
          <strong>Verificado</strong>, publicá el sitio y desactivá el proveedor anterior.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Subdominio Skale Motors</CardTitle>
          <CardDescription>
            Listo al instante si configuraste el wildcard <code>*.skalemotors.cl</code> en Vercel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subdomain ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-medium">{subdomain.domain}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {statusBadge(subdomain.verification_status)}
                  {subdomain.is_primary && <Badge variant="outline">Principal</Badge>}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyText(`https://${subdomain.domain}`)}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar URL
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <a
                  href={`https://${subdomain.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir
                </a>
              </Button>
            </div>
          ) : (
            <Button type="button" onClick={handleProvision} disabled={provision.isPending}>
              {provision.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Globe className="mr-2 h-4 w-4" />
              )}
              Activar subdominio automático
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dominio propio</CardTitle>
          <CardDescription>
            Ej: <span className="font-mono">www.miamimotors.cl</span> y también el apex{" "}
            <span className="font-mono">miamimotors.cl</span> (agregalos por separado si usás ambos).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="custom-domain">Hostname</Label>
              <Input
                id="custom-domain"
                placeholder="www.tuautomotora.cl"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCustom();
                }}
              />
            </div>
            <Button
              type="button"
              onClick={handleAddCustom}
              disabled={addDomain.isPending || !customInput.trim()}
            >
              {addDomain.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Conectar dominio
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Registros típicos en tu registrador</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                Apex (<code>@</code>): registro <strong>A</strong> → <code>{VERCEL_APEX}</code>
              </li>
              <li>
                <code>www</code>: registro <strong>CNAME</strong> → <code>{VERCEL_CNAME}</code>
              </li>
            </ul>
          </div>

          {customDomains.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no conectaste dominios propios.</p>
          ) : (
            <div className="space-y-4">
              {customDomains.map((d) => (
                <div key={d.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-medium">{d.domain}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {statusBadge(d.verification_status)}
                        <Badge variant="outline">{kindLabel(d.kind)}</Badge>
                        {d.is_primary && <Badge variant="outline">Principal</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {d.verification_status === "verified" && !d.is_primary && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={setPrimary.isPending}
                          onClick={() =>
                            setPrimary.mutate(d.id, {
                              onSuccess: () => toast.success("Dominio principal actualizado"),
                              onError: (e) =>
                                toast.error(e instanceof Error ? e.message : "Error"),
                            })
                          }
                        >
                          <Star className="mr-1 h-4 w-4" />
                          Principal
                        </Button>
                      )}
                      {d.verification_status !== "verified" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={verify.isPending}
                          onClick={() => handleVerify(d.id)}
                        >
                          {verify.isPending ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-1 h-4 w-4" />
                          )}
                          Verificar DNS
                        </Button>
                      )}
                      {d.verification_status === "verified" && (
                        <Button type="button" variant="outline" size="sm" asChild>
                          <a
                            href={`https://${d.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Visitar
                          </a>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (!window.confirm(`¿Quitar ${d.domain} de tu vitrina?`)) return;
                          remove.mutate(d.id, {
                            onSuccess: () => toast.success("Dominio eliminado"),
                            onError: (e) =>
                              toast.error(e instanceof Error ? e.message : "Error"),
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {(dnsByDomainId[d.id]?.length ?? 0) > 0 && d.verification_status !== "verified" && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dnsByDomainId[d.id].map((row, i) => (
                          <TableRow key={`${row.type}-${i}`}>
                            <TableCell className="font-mono text-xs">{row.type}</TableCell>
                            <TableCell className="font-mono text-xs">{row.name}</TableCell>
                            <TableCell className="font-mono text-xs break-all">{row.value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="rounded-lg border px-4">
        <AccordionItem value="migration">
          <AccordionTrigger>Guía de migración (sin transferir el dominio)</AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm text-muted-foreground pb-4">
            <ol className="list-decimal list-inside space-y-2">
              <li>Publicá la vitrina en Mi Web (toggle publicado + autos con &quot;En la web&quot;).</li>
              <li>Activá el subdominio Skale o conectá tu dominio propio aquí.</li>
              <li>
                En NIC Chile (o tu registrador), bajá el TTL a 300 s unos días antes del cambio.
              </li>
              <li>Reemplazá los DNS del sitio viejo por los registros A/CNAME de Vercel.</li>
              <li>Usá &quot;Verificar DNS&quot; hasta ver estado Verificado (SSL automático).</li>
              <li>Probá formulario de contacto y ficha de un vehículo en producción.</li>
              <li>Cancelá el plan del builder anterior cuando todo funcione.</li>
            </ol>
            <p>
              Si más adelante querés que Skale renueve el dominio por vos, eso será una
              transferencia al registrar de Vercel (flujo aparte, no obligatorio para migrar).
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
