import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Verificar si estamos en un input, textarea o contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      // Atajos de teclado
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case 'p':
            if (event.shiftKey) {
              event.preventDefault();
              navigate('/app/profile');
            }
            break;
          case 'b':
            event.preventDefault();
            navigate('/app/billing');
            break;
          case 's':
            event.preventDefault();
            navigate('/app/settings');
            break;
          case 'k':
            event.preventDefault();
            // Aquí podrías abrir un modal con todos los atajos
            console.log('Mostrar atajos de teclado');
            break;
          case 't':
            if (event.shiftKey) {
              event.preventDefault();
              // Funcionalidad de nuevo equipo
              console.log('Crear nuevo equipo');
            }
            break;
          case 'q':
            if (event.shiftKey) {
              event.preventDefault();
              if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
                signOut();
                navigate('/login');
              }
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate, signOut]);
}


