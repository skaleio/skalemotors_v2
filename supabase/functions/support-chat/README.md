# support-chat (Cerebro del negocio)

Edge Function que usa OpenAI para responder preguntas sobre métricas del negocio (ventas, inventario, leads, finanzas).

## Despliegue (importante)

Para que el chat funcione **desde el navegador** (localhost o producción), el preflight OPTIONS no puede ser rechazado por JWT. Despliega **sin verificación JWT**:

```bash
npx supabase functions deploy support-chat --no-verify-jwt
```

## Requisitos

- **OPENAI_API_KEY** en Supabase: Dashboard → Project Settings → Edge Functions → Secrets (o `supabase secrets set OPENAI_API_KEY=sk-...`).
- Proyecto enlazado: `npx supabase link --project-ref <tu-ref>` si hace falta.

## Probar

1. Despliega con el comando de arriba.
2. Abre la app, inicia sesión y abre el chat "Cerebro del negocio".
3. Pregunta por ejemplo: "¿Cuánto he gastado esta semana?" o "¿Cuántas ventas llevamos?".
