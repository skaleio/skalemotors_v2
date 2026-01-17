import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigationWithLoading } from './useNavigationWithLoading';

export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const { navigateWithLoading } = useNavigationWithLoading();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Verificar si es Ctrl+K (o Cmd+K en Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        
        // Abrir la ventana de acciones rápidas
        // Esto se manejará desde el componente que tenga el modal
        const customEvent = new CustomEvent('openQuickActions');
        window.dispatchEvent(customEvent);
      }
      
      // Atajos adicionales para navegación rápida
      if ((event.ctrlKey || event.metaKey) && event.key === '1') {
        event.preventDefault();
        navigateWithLoading('/');
      }
      
      if ((event.ctrlKey || event.metaKey) && event.key === '2') {
        event.preventDefault();
        navigateWithLoading('/crm');
      }
      
      if ((event.ctrlKey || event.metaKey) && event.key === '3') {
        event.preventDefault();
        navigateWithLoading('/inventory');
      }
      
      if ((event.ctrlKey || event.metaKey) && event.key === '4') {
        event.preventDefault();
        navigateWithLoading('/finance');
      }
      
      if ((event.ctrlKey || event.metaKey) && event.key === '5') {
        event.preventDefault();
        navigateWithLoading('/post-sale-crm');
      }
      
      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault();
        navigateWithLoading('/settings');
      }

      // Atajos específicos para acciones rápidas
      if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
        event.preventDefault();
        navigateWithLoading('/leads?new=true');
      }
      
      if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
        event.preventDefault();
        navigateWithLoading('/crm');
      }
      
      if ((event.ctrlKey || event.metaKey) && event.key === 'q') {
        event.preventDefault();
        navigateWithLoading('/crm');
      }
      
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();
        navigateWithLoading('/appointments');
      }
      
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        navigateWithLoading('/financial-calculator');
      }
      
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        event.preventDefault();
        navigateWithLoading('/inventory');
      }
      
      if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
        event.preventDefault();
        navigateWithLoading('/billing');
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
