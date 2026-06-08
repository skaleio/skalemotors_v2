import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationWithLoading } from "@/hooks/useNavigationWithLoading";
import {
  getSidebarCategoriesForRole,
  isPathActive,
  isSidebarItemLocked,
  SETTINGS_CATEGORY,
  shouldShowSettingsCategory,
  type SidebarMenuItem,
} from "@/lib/appSidebarMenu";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { useLocation } from "react-router-dom";

interface MobileToolsHubSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function HubMenuItem({
  item,
  role,
  currentPath,
  onNavigate,
}: {
  item: SidebarMenuItem;
  role: string | undefined;
  currentPath: string;
  onNavigate: (url: string) => void;
}) {
  const locked = isSidebarItemLocked(item.url, role);
  const active = !locked && isPathActive(currentPath, item.url);
  const Icon = item.icon;

  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => {
        if (locked) return;
        onNavigate(item.url);
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
        locked
          ? "cursor-not-allowed opacity-50"
          : active
            ? "bg-primary/10 text-primary font-medium"
            : "text-foreground hover:bg-muted/80 active:bg-muted",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      {locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
    </button>
  );
}

export function MobileToolsHubSheet({ open, onOpenChange }: MobileToolsHubSheetProps) {
  const { user } = useAuth();
  const location = useLocation();
  const { navigateWithLoading } = useNavigationWithLoading();
  const role = user?.role;
  const currentPath = location.pathname + location.search;

  const categories = getSidebarCategoriesForRole(role);
  const showSettings = shouldShowSettingsCategory(role);

  const handleNavigate = (url: string) => {
    navigateWithLoading(url);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[min(100vw,20rem)] flex-col gap-0 p-0 sm:max-w-xs"
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 py-4 text-left">
          <SheetTitle className="text-base">Hub</SheetTitle>
          <SheetDescription className="text-xs">
            Herramientas disponibles para tu rol
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {categories.map((category) => {
              const CategoryIcon = category.icon;
              return (
                <section key={category.title}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {category.title}
                    </h3>
                  </div>
                  <div className="space-y-0.5">
                    {category.items.map((item) => (
                      <HubMenuItem
                        key={item.url}
                        item={item}
                        role={role}
                        currentPath={currentPath}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {showSettings ? (
              <section>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <SETTINGS_CATEGORY.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {SETTINGS_CATEGORY.title}
                  </h3>
                </div>
                <div className="space-y-0.5">
                  {SETTINGS_CATEGORY.items.map((item) => (
                    <HubMenuItem
                      key={item.url}
                      item={item}
                      role={role}
                      currentPath={currentPath}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
