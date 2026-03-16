# Autofact Scraper

Servicio externo en Python para consultar `https://www.autofact.cl/buscar-patente` usando `FastAPI + Playwright`.

## Variables de entorno

Usa `services/autofact-scraper/.env.example` como base:

```env
AUTOFACT_SCRAPER_TOKEN=change-this-token
AUTOFACT_DEFAULT_EMAIL=consultas@tu-dominio.cl
AUTOFACT_BASE_URL=https://www.autofact.cl/buscar-patente
AUTOFACT_HEADLESS=true
AUTOFACT_TIMEOUT_MS=30000
AUTOFACT_DEBUG_HTML=false
PLAYWRIGHT_WS_ENDPOINT=
AUTOFACT_PROXY_SERVER=
AUTOFACT_PROXY_USERNAME=
AUTOFACT_PROXY_PASSWORD=
PORT=8001
```

## Instalación local

```bash
cd services/autofact-scraper
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m playwright install chromium
copy .env.example .env
```

## Ejecutar API

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Si Autofact responde 403

En pruebas reales desde este entorno, Autofact devolvió `403 Forbidden` incluso con Playwright local. Para producción necesitas una de estas opciones:

1. `PLAYWRIGHT_WS_ENDPOINT`
   - Conecta a Browserless o un Chromium remoto con IP distinta.

2. `AUTOFACT_PROXY_SERVER`
   - Usa un proxy residencial/datacenter limpio.
   - Si requiere auth, define también `AUTOFACT_PROXY_USERNAME` y `AUTOFACT_PROXY_PASSWORD`.

## Endpoint interno

`POST /lookup-patente`

Headers:

```http
X-Internal-Token: <AUTOFACT_SCRAPER_TOKEN>
Content-Type: application/json
```

Body:

```json
{
  "patente": "PFRR65"
}
```

Respuesta esperada:

```json
{
  "patente": "PFRR65",
  "marca": "Toyota",
  "modelo": "Corolla",
  "año": 2018,
  "motor": "1.8",
  "combustible": "Gasolina",
  "transmision": null,
  "fuente": "autofact"
}
```

## Prueba manual

```bash
python manual_test.py PFRR65
```

Si recibes `403 Forbidden`, no es un error del código: es bloqueo del sitio hacia tu IP/navegador automatizado actual.

## Integración con Supabase

Configura estos secrets en Supabase para que `vehicle-lookup` lo use:

```bash
supabase secrets set AUTOFACT_SCRAPER_URL=https://tu-servicio/lookup-patente
supabase secrets set AUTOFACT_SCRAPER_TOKEN=change-this-token
```

Luego redeploy:

```bash
supabase functions deploy vehicle-lookup
```
