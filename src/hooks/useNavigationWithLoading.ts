import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useNavigationWithLoading() {
  const [isNavigating, setIsNavigating] = useState(false);
  const navigate = useNavigate();

  const navigateWithLoading = useCallback((path: string) => {
    setIsNavigating(true);
    
    // Pequeño delay para mostrar el loader
    setTimeout(() => {
      navigate(path);
      // El loader se ocultará automáticamente cuando el componente PageLoader detecte el cambio de ruta
    }, 100);
  }, [navigate]);

  return {
    isNavigating,
    navigateWithLoading
  };
}
