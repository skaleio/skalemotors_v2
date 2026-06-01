import { getCorsHeaders } from "./cors.ts";

export function zernioOptions(req: Request): Response {
  return new Response("ok", { headers: getCorsHeaders(req) });
}

export function zernioJson(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}
