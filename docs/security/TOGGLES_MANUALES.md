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

## 2. MFA TOTP (UI ya soportada por Supabase)

**Estado**: ya está habilitado a nivel de proveedor en `supabase/config.toml:288`:
```toml
[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
```

Lo que falta es la **UI en la app** para enrollar/verificar. Ver `src/lib/services/mfa.ts` (creado en esta fase) y `src/components/settings/MfaEnrollSection.tsx`.

Para obligar MFA por rol (admin, gerente, jefe_jefe), después del enroll básico:
- Agregar un guard en `AuthContext.tsx` que chequee `aal` (authentication assurance level) en la sesión y redirija a `/login/mfa` si rol crítico y `aal !== "aal2"`.

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
