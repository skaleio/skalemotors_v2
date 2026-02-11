# Studio IA – Descripciones de vehículos

## Cómo funciona

1. **Formulario** (Studio IA → Descripciones de vehículos): el usuario completa marca, modelo, año, color, kilometraje, precio, tono, formato (portal / redes / catálogo) y opcionalmente características.
2. **Edge Function** `studio-ia-generate`: recibe el payload, opcionalmente **carga hasta 5 ejemplos** desde la tabla `studio_ia_description_examples`, y llama a OpenAI con un prompt fijo + esos ejemplos para imitar formato y tono.
3. La respuesta es solo el texto de la descripción, listo para copiar en posts de IG, Facebook, TikTok o en portal/catálogo.

## Cómo mejorar las descripciones (que el LLM imite vuestro estilo)

Cuantos más **ejemplos** guardéis en Supabase, más se parecerán las generaciones a vuestras descripciones reales.

### Añadir ejemplos desde Supabase

1. Dashboard Supabase → **Table Editor** → tabla **`studio_ia_description_examples`**.
2. **Insert** → New row:
   - **platform**: `general` (o `instagram`, `facebook`, `tiktok` si queréis ejemplos por red).
   - **content**: el texto completo de una descripción que os guste (como las que usáis en posts).
   - **vehicle_make** / **vehicle_model** (opcional): para referencia.

Podéis pegar varias descripciones de vuestro documento; la función usará las 5 más recientes para cada generación.

### Ejemplo SQL

```sql
INSERT INTO public.studio_ia_description_examples (platform, content, vehicle_make, vehicle_model)
VALUES (
  'general',
  '¡Toyota Corolla Cross 2024 en stock! 🚗 Full equipo, color blanco perla, 0 km. Ideal para familia y ciudad. Consulta por financiamiento. #Toyota #CorollaCross',
  'Toyota',
  'Corolla Cross'
);
```

## System prompts configurables (tabla `studio_prompts`)

El **system message** que usa la IA (descripciones y guiones de reels) se puede cambiar sin redesplegar la Edge Function.

### Tabla `studio_prompts`

- **type**: `vehicle_description` | `reel_script` (y futuros tipos si se agregan).
- **system_prompt**: texto del system message que recibe el modelo.
- **branch_id** (opcional): si se rellena, ese prompt se usa solo para esa sucursal; si es `NULL`, es el **default** para todas.

La Edge Function, antes de llamar a OpenAI, lee de esta tabla el `system_prompt` según el `type` (y, si el cliente envía `branch_id`, busca primero uno para esa sucursal). Si no hay fila, usa el prompt por defecto definido en código.

### Cómo cambiar el estilo

1. Dashboard Supabase → **Table Editor** → **`studio_prompts`**.
2. Para cambiar el **default** (todas las sucursales): editar la fila con `type = vehicle_description` o `reel_script` y `branch_id` vacío; cambiar **system_prompt**.
3. Para un estilo **por tienda**: Insert → New row → **type** = `vehicle_description` (o `reel_script`), **branch_id** = UUID de la sucursal, **system_prompt** = tu texto.

Así puedes afinar el tono, la estructura o las reglas (banderas, precios, contacto) por negocio o por sección sin tocar código ni redesplegar.

## Diagnóstico: logs y timeouts

En Supabase → **Edge Functions** → **studio-ia-generate** → **Logs** verás:

- **`LOG booted`** / **`LOG shutdown`**: arranque y apagado de la instancia (cold start o inactividad). No indican que una petición haya entrado.
- **`[studio-ia-generate] request start type=vehicle_description`**: la petición **sí llegó** al handler.
- **`[studio-ia-generate] calling OpenAI`**: se está llamando a la API de OpenAI (aquí puede tardar 10–60 s).
- **`[studio-ia-generate] success`** o **`[studio-ia-generate] error: ...`**: fin de la ejecución (éxito o error).

**Si solo ves "booted"/"shutdown" y nunca "request start"**: la petición no está llegando a la función (revisa que estés logueado en la app, que la URL del proyecto y la key en el frontend sean correctas, o errores en consola del navegador / red).

**Si ves "request start" y "calling OpenAI" pero luego timeout en el navegador**: la llamada a OpenAI está tardando más que el timeout del cliente (~95 s) o la API de OpenAI falla sin responder; revisa OPENAI_API_KEY y límites/créditos de OpenAI.

**Si ves "error: OPENAI_API_KEY no configurada"**: añade el secret en Project Settings → Edge Functions → Secrets.

## Requisitos

- **OPENAI_API_KEY** configurada en Supabase: Project Settings → Edge Functions → Secrets.
- Edge Function desplegada: `supabase functions deploy studio-ia-generate`.

## Archivos relevantes

- `supabase/functions/studio-ia-generate/index.ts`: lectura de `studio_prompts`, constantes por defecto, carga de ejemplos y llamada a OpenAI.
- `src/pages/studio-ia/DescripcionesVehiculos.tsx`: formulario y llamada a `generateVehicleDescription`.
- `src/lib/services/studioIaApi.ts`: cliente que invoca la Edge Function.
