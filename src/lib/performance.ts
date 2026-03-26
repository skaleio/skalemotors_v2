import { captureAppError } from "./observability";

export function setupPerformanceObservers() {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "largest-contentful-paint" || entry.entryType === "first-input") {
          // Métrica mínima para baseline de web vitals por módulo.
          console.info("[perf]", entry.entryType, Math.round(entry.startTime));
        }
      }
    });

    observer.observe({ entryTypes: ["largest-contentful-paint", "first-input"] });
  } catch (error) {
    captureAppError(error, { module: "performance-observer" });
  }
}
