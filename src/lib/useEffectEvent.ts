import { useCallback, useRef } from "react";

// Minimal useEffectEvent polyfill for React 19 style behavior
export function useEffectEvent<T extends (...args: any[]) => any>(handler: T): T {
  const ref = useRef<T>(handler);
  ref.current = handler;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((...args: any[]) => ref.current(...args)) as T, []);
}
