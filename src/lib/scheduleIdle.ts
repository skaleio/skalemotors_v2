/**
 * Ejecuta trabajo de baja prioridad sin bloquear pintado (Chrome, Safari 15.4+, Firefox).
 * En Safari antiguo u otros entornos sin requestIdleCallback → setTimeout.
 */
export type IdleScheduleCancel = () => void;

export function scheduleWhenIdle(
  callback: () => void,
  options?: { idleTimeoutMs?: number; fallbackDelayMs?: number },
): IdleScheduleCancel {
  const idleTimeoutMs = options?.idleTimeoutMs ?? 1500;
  const fallbackDelayMs = options?.fallbackDelayMs ?? 400;

  if (typeof window === "undefined") {
    return () => {};
  }

  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(() => callback(), { timeout: idleTimeoutMs });
    return () => {
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(id);
      }
    };
  }

  const timeoutId = window.setTimeout(() => callback(), fallbackDelayMs);
  return () => window.clearTimeout(timeoutId);
}
