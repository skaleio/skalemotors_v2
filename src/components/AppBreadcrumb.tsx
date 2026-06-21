import { Link, useLocation } from "react-router-dom";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  "/app": "Inicio",
  "/app/executive": "Dashboard ejecutivo",
  "/app/crm": "CRM",
  "/app/leads": "Leads",
  "/app/leads/board": "Tablero",
  "/app/tasks": "Tareas pendientes",
  "/app/appointments": "Citas",
  "/app/mis-tareas": "Tareas pendientes",
  "/app/website": "Mi web",
  "/app/ranking": "Ranking vendedores",
  "/app/sales": "Ventas",
  "/app/libro-ventas": "Libro de ventas",
  "/app/vendors": "Vendedores",
  "/app/vendors/seguimiento": "Seguimiento",
  "/app/inventory": "Inventario",
  "/app/consignaciones": "Inventario",
  "/app/tasacion": "Tasación",
  "/app/albums": "Álbumes",
  "/app/documents": "Documentos",
  "/app/documents/venta": "Contratos de venta",
  "/app/documents/consignacion": "Contratos de consignación",
  "/app/finance": "Finanzas",
  "/app/fund-management": "Gestión de fondos",
  "/app/financial-tracking": "Seguimiento financiero",
  "/app/financial-calculator": "Calculadora financiera",
  "/app/salary-distribution": "Distribución de salarios",
  "/app/billing": "Facturación",
  "/app/settings": "Configuración",
  "/app/settings/monitor": "Monitor del sistema",
  "/app/integrations": "Integraciones",
  "/app/redes-sociales": "Redes sociales",
  "/app/whatsapp": "WhatsApp",
  "/app/mfa-required": "Verificación MFA",
  "/app/users": "Usuarios",
  "/app/profile": "Perfil",
  "/app/alerts": "Alertas",
};

function labelForSegment(fullPath: string, segment: string): string {
  if (ROUTE_LABELS[fullPath]) return ROUTE_LABELS[fullPath];
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

function buildCrumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return [];
  if (parts[0] !== "app") return [];

  const crumbs: Array<{ href: string; label: string; isLast: boolean }> = [];
  let accum = "";
  for (let i = 0; i < parts.length; i++) {
    accum += "/" + parts[i];
    crumbs.push({
      href: accum,
      label: labelForSegment(accum, parts[i]),
      isLast: i === parts.length - 1,
    });
  }
  return crumbs;
}

interface AppBreadcrumbProps {
  className?: string;
}

export function AppBreadcrumb({ className }: AppBreadcrumbProps) {
  const location = useLocation();
  const crumbs = buildCrumbs(location.pathname);

  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb className={cn("min-w-0", className)}>
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, idx) => (
          <BreadcrumbItem key={crumb.href} className="min-w-0">
            {crumb.isLast ? (
              <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
            ) : (
              <>
                <BreadcrumbLink asChild>
                  <Link to={crumb.href} className="truncate hover:text-foreground">
                    {crumb.label}
                  </Link>
                </BreadcrumbLink>
                {idx < crumbs.length - 1 && <BreadcrumbSeparator />}
              </>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
