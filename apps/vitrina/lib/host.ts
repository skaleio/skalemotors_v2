import { headers } from "next/headers";

/** Hostname público del request (o DEFAULT_HOST en localhost). */
export function getRequestHost(): string {
  const h = headers();
  const raw = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const host = raw.split(":")[0].toLowerCase();

  const fallback = process.env.NEXT_PUBLIC_DEFAULT_HOST?.trim().toLowerCase();
  if (
    fallback &&
    (host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app"))
  ) {
    return fallback;
  }
  return host || fallback || "localhost";
}
