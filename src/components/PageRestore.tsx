import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface PageRestoreProps {
  children: React.ReactNode;
  onRestore?: () => void;
}

export function PageRestore({ children, onRestore }: PageRestoreProps) {
  const location = useLocation();
  const hasRestored = useRef(false);
  const pageKey = location.pathname + location.search;

  useEffect(() => {
    // Verificar si hay estado guardado para esta página
    const savedState = sessionStorage.getItem(`pageState_${pageKey}`);
    
    if (savedState && !hasRestored.current) {
      try {
        const parsedState = JSON.parse(savedState);
        
        // Restaurar posición de scroll
        if (parsedState.scrollPosition) {
          setTimeout(() => {
            window.scrollTo(0, parsedState.scrollPosition);
          }, 100);
        }

        // Llamar callback de restauración si existe
        if (onRestore) {
          setTimeout(() => {
            onRestore();
          }, 150);
        }

        hasRestored.current = true;
      } catch (error) {
        console.error('Error restoring page state:', error);
      }
    }

    // Reset flag cuando cambie la página
    return () => {
      hasRestored.current = false;
    };
  }, [pageKey, onRestore]);

  return <>{children}</>;
}
