import { useCallback, useRef, useState } from "react";

const MAX_STACK = 50;

/** Pila de snapshots para deshacer (LIFO). */
export function useUndoStack<T>() {
  const stackRef = useRef<T[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const push = useCallback((snapshot: T) => {
    const stack = stackRef.current;
    const last = stack[stack.length - 1];
    if (last !== undefined && JSON.stringify(last) === JSON.stringify(snapshot)) {
      return;
    }
    stackRef.current = [...stack.slice(-(MAX_STACK - 1)), snapshot];
    setCanUndo(true);
  }, []);

  const pop = useCallback((): T | null => {
    const stack = stackRef.current;
    if (stack.length === 0) return null;
    const snapshot = stack[stack.length - 1]!;
    stackRef.current = stack.slice(0, -1);
    setCanUndo(stackRef.current.length > 0);
    return snapshot;
  }, []);

  const clear = useCallback(() => {
    stackRef.current = [];
    setCanUndo(false);
  }, []);

  return { push, pop, clear, canUndo };
}
