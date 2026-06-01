import { corsHeaders } from "../_shared/cors.ts";
import { requireZernioAuth } from "../_shared/zernioAuth.ts";
import { zernioFetch } from "../_shared/zernioClient.ts";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
]);

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type PresignBody = {
  filename?: string;
  content_type?: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const auth = await requireZernioAuth(req);
  if (auth instanceof Response) return auth;

  let body: PresignBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "JSON inválido" });
  }

  const filename = (body.filename ?? "upload.jpg").trim();
  const contentType = (body.content_type ?? "image/jpeg").trim().toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) {
    return jsonResponse(400, { ok: false, error: "Tipo de archivo no permitido" });
  }

  try {
    const presign = await zernioFetch<{
      uploadUrl?: string;
      publicUrl?: string;
      key?: string;
      type?: string;
    }>("/media/presign", {
      method: "POST",
      body: { filename, contentType },
    });

    if (!presign.uploadUrl || !presign.publicUrl) {
      return jsonResponse(502, { ok: false, error: "Respuesta presign incompleta" });
    }

    return jsonResponse(200, { ok: true, ...presign });
  } catch (e) {
    return jsonResponse(500, { ok: false, error: (e as Error).message });
  }
}
