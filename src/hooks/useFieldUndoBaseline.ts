import { useCallback, useRef } from "react";

/**
 * Agrupa ediciones de un campo de texto en un solo paso de deshacer:
 * al salir del campo (blur), guarda el estado previo al foco.
 */
export function useFieldUndoBaseline<T>(getSnapshot: () => T, pushUndo: (snapshot: T) => void) {
  const baselineRef = useRef<T | null>(null);

  const onFocus = useCallback(() => {
    baselineRef.current = JSON.parse(JSON.stringify(getSnapshot())) as T;
  }, [getSnapshot]);

  const onBlur = useCallback(() => {
    const baseline = baselineRef.current;
    baselineRef.current = null;
    if (baseline === null) return;
    const current = getSnapshot();
    if (JSON.stringify(baseline) !== JSON.stringify(current)) {
      pushUndo(baseline);
    }
  }, [getSnapshot, pushUndo]);

  return { onFocus, onBlur };
}
