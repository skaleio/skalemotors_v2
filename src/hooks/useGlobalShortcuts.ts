import { useEffect, useRef } from "react";
import { useNavigationWithLoading } from "./useNavigationWithLoading";
import { useShortcutsPreferences } from "@/contexts/ShortcutsPreferencesContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatKeyCombo, type ShortcutActionId } from "@/lib/shortcuts-defaults";
import { getQuickActionsForRole, isShortcutActionAvailable } from "@/lib/quickActions";
import { hasPermission } from "@/lib/rbac";

type ActionHandler = () => void;

function useShortcutHandlers() {
  const { navigateWithLoading } = useNavigationWithLoading();
  const { user } = useAuth();

  const handlersRef = useRef<Record<string, ActionHandler>>({});

  const ctx = {
    navigateWithLoading,
    pathname: typeof window !== "undefined" ? window.location.pathname : "",
  };

  handlersRef.current = {};
  for (const action of getQuickActionsForRole(user?.role)) {
    if (!action.shortcutId) continue;
    handlersRef.current[action.shortcutId] = () => action.run(ctx);
  }

  return handlersRef;
}

export function useGlobalShortcuts() {
  const { navigateWithLoading } = useNavigationWithLoading();
  const { shortcuts, shortcutsEnabled } = useShortcutsPreferences();
  const { user } = useAuth();
  const handlersRef = useShortcutHandlers();

  useEffect(() => {
    if (!shortcutsEnabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isTyping) return;

      const ctrl = event.ctrlKey;
      const meta = event.metaKey;
      const key = event.key.toLowerCase();
      if (key === "control" || key === "meta") return;

      if ((ctrl || meta) && key === "k") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("openQuickActions"));
        return;
      }

      if (ctrl || meta) {
        if (key === "1") {
          event.preventDefault();
          navigateWithLoading("/app");
          return;
        }
        if (key === "2") {
          event.preventDefault();
          navigateWithLoading("/app/crm");
          return;
        }
        if (key === "3") {
          event.preventDefault();
          navigateWithLoading("/app/consignaciones");
          return;
        }
        if (key === "4") {
          event.preventDefault();
          if (hasPermission(user?.role, "finance:read")) {
            navigateWithLoading("/app/finance");
          } else {
            navigateWithLoading("/app/appointments");
          }
          return;
        }
        if (key === "5") {
          event.preventDefault();
          navigateWithLoading("/app/tasks");
          return;
        }
        if (key === ",") {
          event.preventDefault();
          navigateWithLoading("/app/settings");
          return;
        }
      }

      if (ctrl || meta) {
        const combo = formatKeyCombo(ctrl, meta, key);
        const actionId = Object.entries(shortcuts).find(([, v]) => v === combo)?.[0];
        if (
          actionId &&
          isShortcutActionAvailable(actionId as ShortcutActionId, user?.role) &&
          handlersRef.current[actionId]
        ) {
          event.preventDefault();
          handlersRef.current[actionId]!();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, shortcutsEnabled, navigateWithLoading, user?.role]);
}
