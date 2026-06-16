import { requireZernioAuth } from "../_shared/zernioAuth.ts";
import { zernioFetch } from "../_shared/zernioClient.ts";
import { zernioJson, zernioOptions } from "../_shared/zernioHttp.ts";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
]);

type PresignBody = {
  filename?: string;
  content_type?: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return zernioOptions(req);
  if (req.method !== "POST") return zernioJson(req, 405, { ok: false, error: "Method not allowed" });

  const auth = await requireZernioAuth(req);
  if (auth instanceof Response) return auth;

  let body: PresignBody;
  try {
    body = await req.json();
  } catch {
    return zernioJson(req, 400, { ok: false, error: "JSON inválido" });
  }

  const filename = (body.filename ?? "upload.jpg").trim();
  const contentType = (body.content_type ?? "image/jpeg").trim().toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) {
    return zernioJson(req, 400, { ok: false, error: "Tipo de archivo no permitido" });
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
      return zernioJson(req, 502, { ok: false, error: "Respuesta presign incompleta" });
    }

    return zernioJson(req, 200, { ok: true, ...presign });
  } catch (e) {
    return zernioJson(req, 500, { ok: false, error: (e as Error).message });
  }
}

Deno.serve((req) => handler(req));
