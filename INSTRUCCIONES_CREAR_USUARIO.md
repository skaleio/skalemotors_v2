# 🔐 Crear Usuario de Prueba: test@skale.io

## Opción 1: A través de la Interfaz Web de Supabase (Recomendado)

### Paso 1: Acceder a Supabase
1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Inicia sesión con tu cuenta
3. Selecciona el proyecto: **knczbjmiqhkopsytkauo**

### Paso 2: Crear el Usuario
1. En el menú lateral, ve a **Authentication** → **Users**
2. Haz clic en **"Add user"** o **"Invite user"**
3. Completa el formulario:
   - **Email**: `test@skale.io`
   - **Password**: `12345`
   - **Auto Confirm User**: ✅ (marcar esta casilla)
   - **User Metadata** (opcional):
     ```json
     {
       "full_name": "Usuario Test",
       "role": "admin"
     }
     ```
4. Haz clic en **"Create user"**

### Paso 3: Verificar la Creación
1. El usuario debería aparecer en la lista de usuarios
2. El trigger automáticamente creará el registro en `public.users`
3. Verifica en **Table Editor** → **users** que el usuario existe

## Opción 2: A través de SQL (Alternativa)

### Paso 1: Ejecutar el Script SQL
1. Ve a **SQL Editor** en Supabase
2. Ejecuta el archivo `crear_usuario_test.sql` que se creó
3. Esto preparará las tablas y políticas necesarias

### Paso 2: Crear Usuario Manualmente
Después de ejecutar el SQL, crea el usuario a través de la interfaz web como se describe en la Opción 1.

## Opción 3: A través de la API (Para Desarrolladores)

Si tienes la **Service Key** de Supabase, puedes usar el script `crear_usuario_test.js`:

```bash
# Instalar dependencias
npm install @supabase/supabase-js

# Editar el archivo y agregar tu service key real
# Luego ejecutar:
node crear_usuario_test.js
```

## ✅ Verificación Final

Una vez creado el usuario, deberías poder:

1. **Hacer login** en la aplicación con:
   - Email: `test@skale.io`
   - Contraseña: `12345`

2. **Acceder al dashboard** como administrador

3. **Ver el usuario** en la tabla `public.users` con:
   - Email: `test@skale.io`
   - Role: `admin`
   - Onboarding: `completed`
   - Branch: `Sucursal Principal`

## 🔧 Solución de Problemas

### Si el login no funciona:
1. Verifica que el usuario existe en **Authentication** → **Users**
2. Verifica que el usuario existe en **Table Editor** → **users**
3. Revisa la consola del navegador para errores
4. Asegúrate de que las políticas RLS están configuradas correctamente

### Si el trigger no funciona:
1. Verifica que la función `handle_new_user()` existe
2. Verifica que el trigger `on_auth_user_created` está activo
3. Puedes crear manualmente el registro en `public.users` si es necesario

## 📞 Soporte

Si tienes problemas, revisa:
- Los logs de Supabase en **Logs** → **Auth**
- La consola del navegador
- Los errores en **SQL Editor** si usaste esa opción



