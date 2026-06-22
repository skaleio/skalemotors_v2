// Single-flight para refresh de sesión.
//
// Con rotación de refresh token, dos refresh concurrentes (bootstrap +
// visibilitychange + online + auto-refresh del SDK) pueden usar el mismo token
// y, en redes malas, terminar en "Refresh Token Not Found" → deslogueo.
// createSingleFlight coalescea las llamadas concurrentes en una sola promesa:
// mientras hay un refresh en vuelo, todos reciben el mismo resultado.

export type AsyncThunk<T> = () => Promise<T>;

export function createSingleFlight<T>(fn: AsyncThunk<T>): AsyncThunk<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (inFlight) return inFlight;
    inFlight = fn().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
