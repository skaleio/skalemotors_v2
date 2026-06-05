import { useState, useMemo, useEffect, useRef, useDeferredValue, memo } from "react";
import { Command, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useNavigationWithLoading } from "@/hooks/useNavigationWithLoading";
import { ShortcutsCustomizerModal } from "@/components/ShortcutsCustomizerModal";
import { useAuth } from "@/contexts/AuthContext";
import { getQuickActionsForRole, shortcutLabelForAction, type QuickActionDef } from "@/lib/quickActions";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

type QuickActionOption = {
  label: string;
  description: string;
  icon: QuickActionDef["icon"];
  color: string;
  category: string;
  keywords: string[];
  shortcut?: string;
  action: () => void;
};

/** Chips de icono con variantes light/dark (clases estáticas para Tailwind). */
const ICON_CHIP_CLASS: Record<string, string> = {
  "bg-blue-600": "bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  "bg-green-600": "bg-green-500/15 text-green-600 dark:bg-green-500/20 dark:text-green-400",
  "bg-purple-600": "bg-purple-500/15 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
  "bg-emerald-600": "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  "bg-indigo-600": "bg-indigo-500/15 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400",
  "bg-red-600": "bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-400",
  "bg-orange-600": "bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400",
  "bg-cyan-600": "bg-cyan-500/15 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400",
  "bg-teal-600": "bg-teal-500/15 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400",
  "bg-yellow-600": "bg-yellow-500/15 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400",
  "bg-gray-600": "bg-muted text-muted-foreground",
};

function iconChipClass(color: string): string {
  return ICON_CHIP_CLASS[color] ?? "bg-muted text-muted-foreground";
}

const QuickActionRow = memo(function QuickActionRow({
  option,
  onSelect,
}: {
  option: QuickActionOption;
  onSelect: () => void;
}) {
  const Icon = option.icon;
  return (
    <div
      role="button"
      tabIndex={0}
      className="group flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent p-2.5 hover:border-border/60 hover:bg-accent/80"
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          iconChipClass(option.color),
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{option.label}</div>
        <div className="truncate text-xs text-muted-foreground">{option.description}</div>
      </div>
      {option.shortcut && (
        <div className="flex shrink-0 text-xs text-muted-foreground">
          {option.shortcut.split("+").map((key, i) => (
            <span key={i} className="inline-flex items-center gap-0.5">
              {i > 0 && <span className="mx-0.5">+</span>}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {key.trim()}
              </kbd>
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

const QuickActionCategory = memo(function QuickActionCategory({
  category,
  options,
  onSelect,
}: {
  category: string;
  options: QuickActionOption[];
  onSelect: (action: () => void) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {category}
        </h3>
        <div className="h-px flex-1 bg-border" />
        <Badge variant="outline" className="px-1.5 py-0 text-xs">
          {options.length}
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-0.5">
        {options.map((option) => (
          <QuickActionRow
            key={option.label}
            option={option}
            onSelect={() => onSelect(option.action)}
          />
        ))}
      </div>
    </div>
  );
});

export function GlobalQuickActions() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { navigateWithLoading } = useNavigationWithLoading();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const createOptions = useMemo((): QuickActionOption[] => {
    const ctx = { navigateWithLoading, pathname };
    return getQuickActionsForRole(user?.role).map((def) => ({
      label: def.label,
      description: def.description,
      icon: def.icon,
      color: def.color,
      category: def.category,
      keywords: def.keywords,
      shortcut: shortcutLabelForAction(def),
      action: () => def.run(ctx),
    }));
  }, [navigateWithLoading, pathname, user?.role]);

  useEffect(() => {
    const handleOpenQuickActions = () => {
      setShowCreateDialog(true);
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    };

    window.addEventListener("openQuickActions", handleOpenQuickActions);
    return () => {
      window.removeEventListener("openQuickActions", handleOpenQuickActions);
    };
  }, []);

  const filteredOptions = useMemo(() => {
    if (!deferredSearchQuery.trim()) return createOptions;

    const query = deferredSearchQuery.toLowerCase();
    return createOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.description.toLowerCase().includes(query) ||
        option.category.toLowerCase().includes(query) ||
        option.keywords.some((keyword) => keyword.toLowerCase().includes(query)),
    );
  }, [createOptions, deferredSearchQuery]);

  const groupedOptions = useMemo(() => {
    const groups: { [key: string]: QuickActionOption[] } = {};
    filteredOptions.forEach((option) => {
      if (!groups[option.category]) {
        groups[option.category] = [];
      }
      groups[option.category].push(option);
    });
    return groups;
  }, [filteredOptions]);

  return (
    <>
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) setSearchQuery("");
        }}
      >
        <DialogContent
          className="flex max-h-[90vh] min-h-[75vh] max-w-4xl flex-col overflow-hidden rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl backdrop-blur-sm"
          aria-describedby={undefined}
        >
          <div className="flex-shrink-0 border-b border-border px-4 pb-3 pt-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                <Command className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold leading-tight">
                  Acciones Rápidas
                </DialogTitle>
                <DialogDescription className="truncate text-xs">
                  Solo módulos disponibles en tu cuenta
                </DialogDescription>
              </div>
            </div>
            <div className="group relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar acciones... (ej: lead, cita, inventario)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 rounded-lg border-border bg-muted/40 pl-9 text-sm focus:bg-background"
              />
            </div>
            {deferredSearchQuery && (
              <div className="mt-1.5 text-xs font-medium text-muted-foreground">
                {filteredOptions.length} resultado{filteredOptions.length !== 1 ? "s" : ""}{" "}
                encontrado{filteredOptions.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          <div className="min-h-[50vh] flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-3 [contain:strict]">
            {Object.keys(groupedOptions).length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mb-1 text-base font-medium text-foreground">Sin resultados</h3>
                <p className="text-sm text-muted-foreground">
                  Prueba con otros términos de búsqueda
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedOptions).map(([category, options]) => (
                  <QuickActionCategory
                    key={category}
                    category={category}
                    options={options}
                    onSelect={(action) => {
                      action();
                      setShowCreateDialog(false);
                      setSearchQuery("");
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex-shrink-0 border-t border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <span>Atajo:</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  Ctrl
                </kbd>
                <span>+</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  K
                </kbd>
                <span className="ml-2 text-border">•</span>
                <span className="ml-2">
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    Esc
                  </kbd>
                  <span className="ml-1">para cerrar</span>
                </span>
              </div>
              <button
                type="button"
                className="font-medium text-primary transition-colors hover:text-primary/80"
                onClick={() => setShowShortcutsModal(true)}
              >
                Personalizar atajos
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ShortcutsCustomizerModal open={showShortcutsModal} onOpenChange={setShowShortcutsModal} />
    </>
  );
}

/** Abre el modal global de acciones rápidas (mismo que Ctrl+K). */
export function openGlobalQuickActions() {
  window.dispatchEvent(new CustomEvent("openQuickActions"));
}
