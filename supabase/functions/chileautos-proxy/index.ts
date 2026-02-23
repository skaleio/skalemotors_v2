/// <reference path="../_shared/edge-runtime.d.ts" />
import { corsHeaders } from "../_shared/cors.ts";

const CHILEAUTOS_BASE = "https://www.chileautos.cl/vehiculos/";

function buildSearchUrl(keyword: string, offset: number): string {
  const q = `(And.Servicio.chileautos._.CarAll.keyword(${keyword.trim().replace(/\s+/g, "+")}).)`;
  const params = new URLSearchParams({ q, sort: "topdeal" });
  if (offset > 0) params.set("offset", String(offset));
  return `${CHILEAUTOS_BASE}?${params.toString()}`;
}

function injectBaseTag(html: string): string {
  const baseTag = '<base href="https://www.chileautos.cl/">';
  if (/<head(\s[^>]*)?>/i.test(html)) {
    return html.replace(/(<head)(\s[^>]*)?>/i, `$1$2>${baseTag}`);
  }
  if (/<html/i.test(html)) {
    return html.replace(/(<html[^>]*>)/i, `$1${baseTag}`);
  }
  return baseTag + html;
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

  const url = new URL(req.url);
  const keyword = url.searchParams.get("q")?.trim() ?? "";
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  if (!keyword) {
    return new Response("Falta parámetro q (búsqueda)", {
      status: 400,
      headers: { ...corsHeaders },
    });
  }

  const targetUrl = buildSearchUrl(keyword, offset);
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
