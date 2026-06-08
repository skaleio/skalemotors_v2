import { openGlobalQuickActions } from "@/components/GlobalQuickActions";
import { MobileToolsHubSheet } from "@/components/MobileToolsHubSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationWithLoading } from "@/hooks/useNavigationWithLoading";
import { isPhotographerRole } from "@/lib/appRoles";
import { cn } from "@/lib/utils";
import { ClipboardList, LayoutDashboard, LayoutGrid, Plus, Target, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router-dom";

type NavTabId = "home" | "crm" | "consignaciones";

interface NavTab {
  id: NavTabId;
  label: string;
  url: string;
  icon: LucideIcon;
  photographerVisible: boolean;
}

const NAV_TABS: NavTab[] = [
  {
    id: "home",
    label: "Inicio",
    url: "/app",
    icon: LayoutDashboard,
    photographerVisible: false,
  },
  {
    id: "crm",
    label: "CRM",
    url: "/app/crm",
    icon: Target,
    photographerVisible: false,
  },
  {
    id: "consignaciones",
    label: "Consignaciones",
    url: "/app/consignaciones",
    icon: ClipboardList,
    photographerVisible: true,
  },
];

function isTabActive(pathname: string, tab: NavTab): boolean {
  const base = pathname.split("?")[0];
  if (tab.id === "home") {
    return base === "/app" || base === "/app/";
  }
  return base === tab.url || base.startsWith(`${tab.url}/`);
}

function isTabVisible(tab: NavTab, role: string | undefined | null): boolean {
  if (isPhotographerRole(role)) {
    return tab.photographerVisible;
  }
  return true;
}

function NavTabButton({
  tab,
  active,
  onNavigate,
}: {
  tab: NavTab;
  active: boolean;
  onNavigate: (url: string) => void;
}) {
  const Icon = tab.icon;

  return (
    <button
      type="button"
      onClick={() => onNavigate(tab.url)}
      className={cn(
        "group flex min-h-[52px] w-full flex-col items-center justify-center gap-1 px-1 pt-2",
        "touch-manipulation select-none transition-colors duration-200",
        active ? "text-primary" : "text-muted-foreground active:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
      aria-label={tab.label}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
          active
            ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]"
            : "group-active:bg-muted/80",
        )}
      >
        <Icon className={cn("h-[18px] w-[18px]", active ? "stroke-[2.25]" : "stroke-[1.75]")} />
      </span>
      <span
        className={cn(
          "max-w-full truncate text-[10px] leading-none tracking-tight",
          active ? "font-semibold" : "font-medium",
        )}
      >
        {tab.label}
      </span>
    </button>
  );
}

function HubTabButton({ active, onOpen }: { active: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex min-h-[52px] w-full flex-col items-center justify-center gap-1 px-1 pt-2",
        "touch-manipulation select-none transition-colors duration-200",
        active ? "text-primary" : "text-muted-foreground active:text-foreground",
      )}
      aria-expanded={active}
      aria-label="Hub de herramientas"
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
          active
            ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]"
            : "group-active:bg-muted/80",
        )}
      >
        <LayoutGrid className={cn("h-[18px] w-[18px]", active ? "stroke-[2.25]" : "stroke-[1.75]")} />
      </span>
      <span
        className={cn(
          "max-w-full truncate text-[10px] leading-none tracking-tight",
          active ? "font-semibold" : "font-medium",
        )}
      >
        Hub
      </span>
    </button>
  );
}

interface MobileBottomNavProps {
  className?: string;
}

/**
 * Barra inferior mobile: Inicio · CRM · (+) · Consignaciones · Hub.
 */
export function MobileBottomNav({ className }: MobileBottomNavProps) {
  const location = useLocation();
  const { navigateWithLoading } = useNavigationWithLoading();
  const { user } = useAuth();
  const role = user?.role;
  const pathname = location.pathname;
  const [hubOpen, setHubOpen] = useState(false);

  const leftTabs = NAV_TABS.slice(0, 2);
  const rightTabs = NAV_TABS.slice(2);

  const renderTabSlot = (tab: NavTab) => {
    if (!isTabVisible(tab, role)) {
      return <div key={tab.id} aria-hidden />;
    }

    return (
      <NavTabButton
        key={tab.id}
        tab={tab}
        active={isTabActive(pathname, tab)}
        onNavigate={(url) => {
          setHubOpen(false);
          navigateWithLoading(url);
        }}
      />
    );
  };

  return (
    <>
      <MobileToolsHubSheet open={hubOpen} onOpenChange={setHubOpen} />

      <nav
        className={cn("fixed inset-x-0 bottom-0 z-40 pointer-events-none", className)}
        aria-label="Navegación principal"
      >
        <div
          className={cn(
            "pointer-events-auto relative mx-auto w-full max-w-lg",
            "border-t border-border/60 bg-background/98 backdrop-blur-xl",
            "shadow-[0_-6px_24px_rgba(15,23,42,0.06)]",
            "dark:border-zinc-800 dark:bg-zinc-950/95 dark:shadow-[0_-8px_28px_rgba(0,0,0,0.35)]",
          )}
          style={{
            paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))",
            borderTopLeftRadius: "1.25rem",
            borderTopRightRadius: "1.25rem",
          }}
        >
          <div className="relative grid grid-cols-5 items-end px-0.5 pt-1">
            {leftTabs.map(renderTabSlot)}

            <div className="relative flex items-center justify-center pb-1">
              <button
                type="button"
                onClick={() => {
                  setHubOpen(false);
                  openGlobalQuickActions();
                }}
                className={cn(
                  "relative -mt-4 flex h-11 w-11 items-center justify-center rounded-full",
                  "bg-primary text-primary-foreground",
                  "shadow-[0_4px_14px_hsl(var(--primary)/0.35)]",
                  "transition-all duration-200 active:scale-95",
                )}
                aria-label="Acción rápida"
              >
                <Plus className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>

            {rightTabs.map(renderTabSlot)}
            <HubTabButton active={hubOpen} onOpen={() => setHubOpen(true)} />
          </div>
        </div>
      </nav>
    </>
  );
}

/** Altura reservada para que el contenido no quede bajo la barra + FAB. */
export const MOBILE_BOTTOM_NAV_OFFSET_CLASS = "pb-[calc(4.75rem+env(safe-area-inset-bottom))]";
