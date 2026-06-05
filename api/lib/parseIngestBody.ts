/** Normaliza body de Vercel / n8n (objeto, string, array, webhook anidado). */
export function normalizeIngestBody(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === "") return {};

  let data: unknown = raw;

  if (typeof data === "string") {
    const s = data.trim();
    if (!s) return {};
    try {
      data = JSON.parse(s) as unknown;
    } catch {
      return null;
    }
  }

  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
    try {
      data = JSON.parse(data.toString("utf8")) as unknown;
    } catch {
      return null;
    }
  }

  if (Array.isArray(data)) {
    data = data.length > 0 ? data[0] : {};
  }

  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;

  if (obj.body != null) {
    if (typeof obj.body === "string") {
      try {
        const inner = JSON.parse(obj.body) as unknown;
        if (inner && typeof inner === "object" && !Array.isArray(inner)) {
          return inner as Record<string, unknown>;
        }
      } catch {
        /* sigue con obj */
      }
    }
    if (typeof obj.body === "object" && !Array.isArray(obj.body)) {
      return obj.body as Record<string, unknown>;
    }
  }

  if (obj.json != null && typeof obj.json === "object" && !Array.isArray(obj.json)) {
    return obj.json as Record<string, unknown>;
  }

  return obj;
}

export function strField(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (v == null) return "";
  return String(v).trim();
}
