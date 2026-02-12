import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useNavigationWithLoading } from "./useNavigationWithLoading";
import { useShortcutsPreferences } from "@/contexts/ShortcutsPreferencesContext";
import { formatKeyCombo } from "@/lib/shortcuts-defaults";

type ActionHandler = () => void;

function useShortcutHandlers() {
  const navigate = useNavigate();
  const { navigateWithLoading } = useNavigationWithLoading();

  const handlersRef = useRef<Record<string, ActionHandler>>({});
  handlersRef.current = {
    new_lead: () => {
      const onLeadsPage = window.location.pathname === "/app/leads" || window.location.pathname === "/leads";
      if (onLeadsPage) window.dispatchEvent(new CustomEvent("openNewLeadForm"));
      else navigateWithLoading("/app/leads?new=true");
    },
    crm: () => navigateWithLoading("/app/crm"),
    quotes: () => navigateWithLoading("/app/quotes"),
    new_sale: () => {
      const onSalesPage = window.location.pathname === "/app/sales";
      if (onSalesPage) window.dispatchEvent(new CustomEvent("openNewSaleForm"));
      else navigateWithLoading("/app/sales?new=true");
    },
    appointments: () => navigateWithLoading("/app/appointments"),
    financial_calculator: () => navigateWithLoading("/app/financial-calculator"),
    inventory: () => {
      const onInventoryPage = window.location.pathname === "/app/inventory";
      if (onInventoryPage) window.dispatchEvent(new CustomEvent("openNewVehicleForm"));
      else navigateWithLoading("/app/inventory?new=true");
    },
    consignaciones: () => {
      const onConsignacionesPage = window.location.pathname === "/app/consignaciones";
      if (onConsignacionesPage) window.dispatchEvent(new CustomEvent("openNewConsignacionForm"));
      else navigateWithLoading("/app/consignaciones?new=true");
    },
    billing: () => navigateWithLoading("/app/billing"),
  };
  return handlersRef;
}

export function useGlobalShortcuts() {
  const { navigateWithLoading } = useNavigationWithLoading();
  const { shortcuts } = useShortcutsPreferences();
  const handlersRef = useShortcutHandlers();

  useEffect(() => {
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

      // Ctrl+K siempre abre Acciones Rápidas (fijo)
      if ((ctrl || meta) && key === "k") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("openQuickActions"));
        return;
      }

      // Atajos numéricos y coma (fijos)
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
          navigateWithLoading("/app/inventory");
          return;
        }
        if (key === "4") {
          event.preventDefault();
          navigateWithLoading("/app/finance");
          return;
        }
        if (key === "5") {
          event.preventDefault();
          navigateWithLoading("/app/post-sale");
          return;
        }
        if (key === ",") {
          event.preventDefault();
          navigateWithLoading("/app/settings");
          return;
        }
      }

      // Atajos personalizables: comparar combo con preferencias
      if (ctrl || meta) {
        const combo = formatKeyCombo(ctrl, meta, key);
        const actionId = Object.entries(shortcuts).find(([, v]) => v === combo)?.[0];
        if (actionId && handlersRef.current[actionId]) {
          event.preventDefault();
          handlersRef.current[actionId]!();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, navigateWithLoading]);
}
