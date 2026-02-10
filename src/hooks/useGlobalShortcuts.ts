import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigationWithLoading } from './useNavigationWithLoading';

export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const { navigateWithLoading } = useNavigationWithLoading();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
      if (isTyping) return;

      // Verificar si es Ctrl+K (o Cmd+K en Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        
        // Abrir la ventana de acciones rápidas
        // Esto se manejará desde el componente que tenga el modal
        const customEvent = new CustomEvent('openQuickActions');
        window.dispatchEvent(customEvent);
      }
      
      // Atajos adicionales para navegación rápida (siempre bajo /app)
      if ((event.ctrlKey || event.metaKey) && event.key === '1') {
        event.preventDefault();
        navigateWithLoading('/app');
      }

      if ((event.ctrlKey || event.metaKey) && event.key === '2') {
        event.preventDefault();
        navigateWithLoading('/app/crm');
      }

      if ((event.ctrlKey || event.metaKey) && event.key === '3') {
        event.preventDefault();
        navigateWithLoading('/app/inventory');
      }

      if ((event.ctrlKey || event.metaKey) && event.key === '4') {
        event.preventDefault();
        navigateWithLoading('/app/finance');
      }

      if ((event.ctrlKey || event.metaKey) && event.key === '5') {
        event.preventDefault();
        navigateWithLoading('/app/post-sale');
      }

      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault();
        navigateWithLoading('/app/settings');
      }

      // Atajos de Acción Rápida (Ctrl+L, Ctrl+P, Ctrl+Q, Ctrl+A, Ctrl+F, Ctrl+V, Ctrl+C, Ctrl+I)
      if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
        event.preventDefault();
        const onLeadsPage = window.location.pathname === '/app/leads' || window.location.pathname === '/leads';
        if (onLeadsPage) {
          window.dispatchEvent(new CustomEvent('openNewLeadForm'));
        } else {
          navigateWithLoading('/app/leads?new=true');
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
        event.preventDefault();
        navigateWithLoading('/app/crm');
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'q') {
        event.preventDefault();
        navigateWithLoading('/app/quotes');
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();
        navigateWithLoading('/app/appointments');
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        navigateWithLoading('/app/financial-calculator');
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        event.preventDefault();
        const onInventoryPage = window.location.pathname === '/app/inventory';
        if (onInventoryPage) {
          window.dispatchEvent(new CustomEvent('openNewVehicleForm'));
        } else {
          navigateWithLoading('/app/inventory?new=true');
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        event.preventDefault();
        const onConsignacionesPage = window.location.pathname === '/app/consignaciones';
        if (onConsignacionesPage) {
          window.dispatchEvent(new CustomEvent('openNewConsignacionForm'));
        } else {
          navigateWithLoading('/app/consignaciones?new=true');
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
        event.preventDefault();
        navigateWithLoading('/app/billing');
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
        event.preventDefault();
        const onSalesPage = window.location.pathname === '/app/sales';
        if (onSalesPage) {
          window.dispatchEvent(new CustomEvent('openNewSaleForm'));
        } else {
          navigateWithLoading('/app/sales?new=true');
        }
      }
    };

    // Agregar el event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate, navigateWithLoading]);
}
