/// <reference path="../_shared/edge-runtime.d.ts" />
import { corsHeaders } from "../_shared/cors.ts";

const CHILEAUTOS_BASE = "https://www.chileautos.cl/vehiculos/";
const CHILEAUTOS_ORIGIN = "https://www.chileautos.cl";

function buildSearchUrl(keyword: string, offset: number): string {
  const q = `(And.Servicio.chileautos._.CarAll.keyword(${keyword.trim().replace(/\s+/g, "+")}).)`;
  const params = new URLSearchParams({ q, sort: "topdeal" });
  if (offset > 0) params.set("offset", String(offset));
  return `${CHILEAUTOS_BASE}?${params.toString()}`;
}

function injectBaseTag(html: string): string {
  const baseTag = `<base href="${CHILEAUTOS_ORIGIN}/">`;
  if (/<head(\s[^>]*)?>/i.test(html)) {
    return html.replace(/(<head)(\s[^>]*)?>/i, `$1$2>${baseTag}`);
  }
  if (/<html/i.test(html)) {
    return html.replace(/(<html[^>]*>)/i, `$1${baseTag}`);
  }
  return baseTag + html;
}

/** Valida que la URL sea de chileautos.cl para evitar abuso del proxy */
function isSafeChileAutosUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.hostname === "www.chileautos.cl" || u.hostname === "chileautos.cl";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Método no permitido", {
      status: 405,
      headers: { ...corsHeaders },
    });
  }

  const reqUrl = new URL(req.url);
  const directUrl = reqUrl.searchParams.get("url")?.trim() ?? "";
  const keyword = reqUrl.searchParams.get("q")?.trim() ?? "";
  const offset = Math.max(0, Number(reqUrl.searchParams.get("offset")) || 0);

  let targetUrl: string;

  if (directUrl) {
    if (!isSafeChileAutosUrl(directUrl)) {
      return new Response("URL no permitida", { status: 400, headers: { ...corsHeaders } });
    }
    targetUrl = directUrl;
  } else if (keyword) {
    targetUrl = buildSearchUrl(keyword, offset);
  } else {
    return new Response("Falta parámetro url o q", {
      status: 400,
      headers: { ...corsHeaders },
    });
  }
  const scraperApiKey = Deno.env.get("SCRAPER_API_KEY");

  try {
    let res: Response;
    if (scraperApiKey) {
      const proxyUrl = `https://api.scraperapi.com?api_key=${encodeURIComponent(scraperApiKey)}&url=${encodeURIComponent(targetUrl)}`;
      res = await fetch(proxyUrl, {
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-CL,es;q=0.9",
        },
      });
    } else {
      res = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept-Language": "es-CL,es;q=0.9",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Referer": "https://www.chileautos.cl/",
        },
      });
    }

    if (!res.ok) {
      const text = await res.text();
      return new Response(
        `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p>ChileAutos respondió con ${res.status}. Si tienes ScraperAPI, configura SCRAPER_API_KEY en la Edge Function.</p><pre>${text.slice(0, 500)}</pre></body></html>`,
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const html = await res.text();
    const htmlWithBase = injectBaseTag(html);

    return new Response(htmlWithBase, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p>Error al obtener la página: ${message}</p></body></html>`,
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
});
