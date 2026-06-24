import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("Error 404: se intentó acceder a una ruta inexistente:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Uy, no encontramos esta página</p>
        <a href="/" className="text-primary underline hover:opacity-80">
          Volver al inicio
        </a>
      </div>
    </div>
  );
};

export default NotFound;
