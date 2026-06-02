import { getCorsHeaders, isOriginAllowed } from "./cors.ts";

function withNoStore(headers: Record<string, string>): Record<string, string> {
  return {
    ...headers,
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
  };
}

export function zernioOptions(req: Request): Response {
  if (!isOriginAllowed(req)) {
    return new Response("Origin not allowed", {
      status: 403,
      headers: withNoStore(getCorsHeaders(req)),
    });
  }
  return new Response(null, {
    status: 204,
    headers: withNoStore(getCorsHeaders(req)),
  });
}

export function zernioJson(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: withNoStore({
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    }),
  });
}
