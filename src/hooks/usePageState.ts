import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface PageState {
  scrollPosition: number;
  formData?: Record<string, any>;
  selectedTab?: string;
  filters?: Record<string, any>;
  timestamp: number;
}

interface UsePageStateOptions {
  persistFormData?: boolean;
  persistScrollPosition?: boolean;
  persistTab?: boolean;
  persistFilters?: boolean;
}

export function usePageState(options: UsePageStateOptions = {}) {
  const location = useLocation();
  const [pageState, setPageState] = useState<PageState | null>(null);
  const isInitialLoad = useRef(true);
  
  const {
    persistFormData = true,
    persistScrollPosition = true,
    persistTab = true,
    persistFilters = true
  } = options;

  // Generar una clave única para la página actual
  const pageKey = location.pathname + location.search;

  // Cargar estado guardado al montar el componente
  useEffect(() => {
    const savedState = sessionStorage.getItem(`pageState_${pageKey}`);
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        setPageState(parsedState);
        
        // Restaurar posición de scroll
        if (persistScrollPosition && parsedState.scrollPosition) {
          setTimeout(() => {
            window.scrollTo(0, parsedState.scrollPosition);
          }, 100);
        }
      } catch (error) {
        console.error('Error loading page state:', error);
      }
    }
    isInitialLoad.current = false;
  }, [pageKey, persistScrollPosition]);

  // Guardar estado cuando cambie
  const savePageState = (newState: Partial<PageState>) => {
    const currentState: PageState = {
      scrollPosition: window.scrollY,
      timestamp: Date.now(),
      ...pageState,
      ...newState
    };

    setPageState(currentState);
    sessionStorage.setItem(`pageState_${pageKey}`, JSON.stringify(currentState));
  };

  // Guardar posición de scroll antes de salir de la página
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!isInitialLoad.current) {
        savePageState({ scrollPosition: window.scrollY });
      }
    };

    const handleScroll = () => {
      if (!isInitialLoad.current) {
        savePageState({ scrollPosition: window.scrollY });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pageState]);

  // Limpiar estado al desmontar
  useEffect(() => {
    return () => {
      if (!isInitialLoad.current) {
        savePageState({ scrollPosition: window.scrollY });
      }
    };
  }, []);

  return {
    pageState,
    savePageState,
    restoreFormData: (defaultData: Record<string, any> = {}) => {
      if (persistFormData && pageState?.formData) {
        return { ...defaultData, ...pageState.formData };
      }
      return defaultData;
    },
    restoreTab: (defaultTab: string = '') => {
      if (persistTab && pageState?.selectedTab) {
        return pageState.selectedTab;
      }
      return defaultTab;
    },
    restoreFilters: (defaultFilters: Record<string, any> = {}) => {
      if (persistFilters && pageState?.filters) {
        return { ...defaultFilters, ...pageState.filters };
      }
      return defaultFilters;
    },
    clearPageState: () => {
      sessionStorage.removeItem(`pageState_${pageKey}`);
      setPageState(null);
    }
  };
}
