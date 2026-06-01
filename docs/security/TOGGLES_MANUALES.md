# Toggles de seguridad que requieren acción manual en el Dashboard

Estos cambios no se pueden hacer por SQL/MCP — necesitás abrir el Supabase Dashboard del proyecto productivo `qszfkwshuhmedmzufalh` y activarlos desde la UI.

## 1. Leaked Password Protection (HaveIBeenPwned)

**Severidad**: WARN (advisor: `auth_leaked_password_protection`)

**Qué hace**: Cuando un usuario crea una cuenta o cambia su password, Supabase consulta el API de [HaveIBeenPwned.org](https://haveibeenpwned.com/) (k-anonymity, no envía la password real) y rechaza passwords que aparezcan en breaches conocidos.

**Cómo activarlo**:
1. Abrir https://supabase.com/dashboard/project/qszfkwshuhmedmzufalh/auth/policies
2. Sección **"Password Strength"** → **Pwned Password Check** → **Enable**
3. Save.

**Costo**: cero. Es un servicio gratuito.

---

## 2. MFA TOTP (UI en app — activar en producción)

**Estado**: TOTP habilitado en `supabase/config.toml` (`[auth.mfa.totp]`). UI: `MfaEnrollSection`, `/login/mfa`, `/app/mfa-required`, guard `useMfaGate` en `ProtectedRoute`.

**Activar en Vercel (producción)** — una de estas opciones:

```
VITE_FLAG_INVESTOR_READY_SECURITY=true
```

o de forma explícita:

```
VITE_MFA_GATE_ENABLED=true
VITE_MFA_ENROLLMENT_MANDATORY=true
```

Roles que deben enrollar TOTP: `admin`, `gerente`, `jefe_jefe` (`src/lib/mfaPolicy.ts`).

Tras el deploy, cada usuario privilegiado debe pasar por Settings → MFA o `/app/mfa-required` antes de usar el panel.

---

## 3. CORS narrowing en Edge Functions y endpoints Vercel

**Estado**: el código ya soporta restricción via env vars (no breaking change).

**Para activar en producción**:

### Supabase Edge Functions
En el dashboard de Supabase → **Edge Functions** → **Secrets**:
```
ALLOWED_ORIGINS=https://app.skalemotors.cl,https://skalemotors.cl
```
Las funciones que ya están migradas a `getCorsHeaders(req)` lo respetarán; las que usan `corsHeaders` (legacy) seguirán con `*` hasta que se migren.

### Vercel `/api/n8n-lead-ingest`
En Vercel → **Settings** → **Environment Variables**:
```
LEAD_INGEST_ALLOWED_ORIGINS=https://your-n8n-domain.com
```
Sin esta var seteada, el endpoint mantiene `*` (compatibilidad).

---

## 4. CAPTCHA en login (futuro)

Soportado por Supabase pero no configurado. Si llegás a 5+ tenants y empezás a ver intentos de brute force, activá hCaptcha en `[auth.captcha]` (config.toml).

---

## 5. Particionado y pg_cron (Fase B — escalabilidad)

Estos requieren SQL pero también una decisión operativa sobre cómo se quieren correr los jobs. Ver `docs/security/AUDITORIA_SEGURIDAD_PRE_MVP.md` para el plan.
