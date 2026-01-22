# Guía de Instalación de n8n con Docker para SKALE Motors

Esta guía te ayudará a desplegar n8n usando Docker Compose para gestionar las automatizaciones de SKALE Motors.

## Requisitos Previos

- Docker y Docker Compose instalados
- Servidor con al menos 2GB RAM y 10GB de almacenamiento
- Dominio configurado (ej: `n8n.tudominio.com`)
- Certificado SSL (recomendado usar Let's Encrypt)

## Paso 1: Crear Estructura de Directorios

```bash
mkdir -p ~/n8n-skale-motors
cd ~/n8n-skale-motors
mkdir -p n8n-backups
```

## Paso 2: Crear archivo docker-compose.yml

Crea un archivo `docker-compose.yml` con el siguiente contenido:

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n-skale-motors
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      # Base de datos PostgreSQL
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=${POSTGRES_USER}
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD}
      
      # Configuración de n8n
      - N8N_BASIC_AUTH_ACTIVE=false
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      
      # Webhooks
      - WEBHOOK_URL=https://${N8N_HOST}/
      
      # Zona horaria
      - GENERIC_TIMEZONE=America/Santiago
      
      # Límites de ejecución
      - EXECUTIONS_TIMEOUT=300
      - EXECUTIONS_TIMEOUT_MAX=600
      
      # Logs
      - N8N_LOG_LEVEL=info
      - N8N_LOG_OUTPUT=console,file
      - N8N_LOG_FILE_LOCATION=/home/node/.n8n/logs/
      
    volumes:
      - n8n_data:/home/node/.n8n
      - ./n8n-backups:/backups
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - n8n-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:5678/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:15-alpine
    container_name: n8n-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=n8n
      - PGDATA=/var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - n8n-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d n8n"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Opcional: Nginx como reverse proxy
  nginx:
    image: nginx:alpine
    container_name: n8n-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - certbot_data:/var/www/certbot:ro
    depends_on:
      - n8n
    networks:
      - n8n-network

  # Opcional: Certbot para SSL automático
  certbot:
    image: certbot/certbot
    container_name: n8n-certbot
    volumes:
      - certbot_data:/var/www/certbot
      - ./ssl:/etc/letsencrypt
    command: certonly --webroot --webroot-path=/var/www/certbot --email tu@email.com --agree-tos --no-eff-email -d ${N8N_HOST}

volumes:
  n8n_data:
    driver: local
  postgres_data:
    driver: local
  certbot_data:
    driver: local

networks:
  n8n-network:
    driver: bridge
```

## Paso 3: Crear archivo .env

Crea un archivo `.env` con tus credenciales:

```env
# PostgreSQL
POSTGRES_USER=n8n_user
POSTGRES_PASSWORD=tu_password_muy_seguro_aqui_123456

# n8n
N8N_ENCRYPTION_KEY=tu_clave_encriptacion_muy_segura_de_32_caracteres
N8N_HOST=n8n.tudominio.com

# Email para certificados SSL
CERTBOT_EMAIL=tu@email.com
```

**IMPORTANTE:** Genera claves seguras:

```bash
# Generar password de PostgreSQL
openssl rand -base64 32

# Generar encryption key de n8n
openssl rand -base64 32
```

## Paso 4: Crear configuración de Nginx (Opcional)

Crea un archivo `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream n8n {
        server n8n:5678;
    }

    server {
        listen 80;
        server_name n8n.tudominio.com;

        # Redirigir a HTTPS
        location / {
            return 301 https://$host$request_uri;
        }

        # Para Let's Encrypt
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
    }

    server {
        listen 443 ssl http2;
        server_name n8n.tudominio.com;

        # Certificados SSL
        ssl_certificate /etc/nginx/ssl/live/n8n.tudominio.com/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/live/n8n.tudominio.com/privkey.pem;

        # Configuración SSL moderna
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Tamaño máximo de body (para uploads)
        client_max_body_size 50M;

        # Proxy a n8n
        location / {
            proxy_pass http://n8n;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket support
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            
            # Timeouts
            proxy_connect_timeout 300s;
            proxy_send_timeout 300s;
            proxy_read_timeout 300s;
        }
    }
}
```

## Paso 5: Iniciar los Servicios

```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f n8n

# Verificar estado
docker-compose ps
```

## Paso 6: Configuración Inicial de n8n

1. Accede a `https://n8n.tudominio.com`
2. Crea tu cuenta de administrador
3. Configura las credenciales:
   - Supabase (URL y Service Key)
   - WhatsApp Business API
   - OpenAI API Key
   - Instagram API (opcional)

## Paso 7: Importar Workflows Base

Los workflows base están en formato JSON. Para importarlos:

1. Ve a **Workflows** → **Import from File**
2. Importa cada workflow:
   - `whatsapp-to-crm.json`
   - `instagram-to-crm.json`
   - `lead-stage-automation.json`
   - `ai-agent-responder.json`
   - `lead-auto-assignment.json`

## Configuración de Credenciales en n8n

### Supabase

1. Ve a **Credentials** → **New**
2. Selecciona **Supabase**
3. Configura:
   - Host: `tu-proyecto.supabase.co`
   - Service Role Key: `tu_service_role_key`

### WhatsApp Business API

1. Ve a **Credentials** → **New**
2. Selecciona **HTTP Request**
3. Configura:
   - Authentication: Bearer Token
   - Token: `tu_whatsapp_api_token`

### OpenAI

1. Ve a **Credentials** → **New**
2. Selecciona **OpenAI**
3. API Key: `tu_openai_api_key`

## Configuración de Webhooks

### WhatsApp Business API

En tu cuenta de WhatsApp Business:

1. Ve a **Configuration** → **Webhooks**
2. Callback URL: `https://n8n.tudominio.com/webhook/whatsapp-to-crm`
3. Verify Token: Genera uno seguro y guárdalo
4. Suscríbete a: `messages`

### Verificar Webhook

```bash
curl -X POST https://n8n.tudominio.com/webhook-test/whatsapp-to-crm \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "56912345678",
            "text": { "body": "Hola, prueba" }
          }]
        }
      }]
    }]
  }'
```

## Monitoreo y Mantenimiento

### Ver logs en tiempo real

```bash
docker-compose logs -f n8n
```

### Backup de la base de datos

```bash
# Crear backup
docker exec n8n-postgres pg_dump -U n8n_user n8n > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker exec -i n8n-postgres psql -U n8n_user n8n < backup_20260122.sql
```

### Backup de workflows

Los workflows se guardan automáticamente en la base de datos. Para exportarlos:

1. Ve a cada workflow
2. **...** → **Download**
3. Guarda el JSON en `n8n-backups/workflows/`

### Actualizar n8n

```bash
# Detener servicios
docker-compose down

# Actualizar imagen
docker-compose pull

# Reiniciar
docker-compose up -d
```

## Solución de Problemas

### n8n no inicia

```bash
# Ver logs
docker-compose logs n8n

# Verificar variables de entorno
docker-compose config
```

### Error de conexión a PostgreSQL

```bash
# Verificar que PostgreSQL esté corriendo
docker-compose ps postgres

# Ver logs de PostgreSQL
docker-compose logs postgres

# Reiniciar PostgreSQL
docker-compose restart postgres
```

### Webhooks no funcionan

1. Verifica que el workflow esté **activo** (toggle verde)
2. Verifica la URL del webhook en n8n
3. Revisa los logs de ejecución en n8n
4. Verifica que el puerto 5678 esté accesible

### Limpiar datos de prueba

```bash
# Conectar a PostgreSQL
docker exec -it n8n-postgres psql -U n8n_user n8n

# Limpiar ejecuciones antiguas
DELETE FROM execution_entity WHERE "finishedAt" < NOW() - INTERVAL '30 days';
```

## Seguridad

### Recomendaciones

1. **Firewall**: Solo abre puertos 80 y 443
2. **SSL**: Usa siempre HTTPS
3. **Backups**: Automatiza backups diarios
4. **Actualizaciones**: Mantén Docker y n8n actualizados
5. **Secrets**: Usa Docker secrets para credenciales sensibles

### Rotar credenciales

```bash
# Generar nueva encryption key
NEW_KEY=$(openssl rand -base64 32)

# Actualizar .env
echo "N8N_ENCRYPTION_KEY=$NEW_KEY" >> .env

# Reiniciar
docker-compose restart n8n
```

## Escalabilidad

Para manejar más carga:

1. **Aumentar recursos del servidor**
2. **Usar Redis para queue**
3. **Escalar horizontalmente con múltiples workers**

Configuración con workers:

```yaml
services:
  n8n-main:
    # ... configuración base
    environment:
      - EXECUTIONS_MODE=queue
      - QUEUE_BULL_REDIS_HOST=redis
      
  n8n-worker:
    image: n8nio/n8n:latest
    command: worker
    environment:
      - EXECUTIONS_MODE=queue
      - QUEUE_BULL_REDIS_HOST=redis
    deploy:
      replicas: 3
      
  redis:
    image: redis:alpine
```

## Recursos Adicionales

- [Documentación oficial de n8n](https://docs.n8n.io/)
- [n8n Community](https://community.n8n.io/)
- [Ejemplos de workflows](https://n8n.io/workflows/)

## Soporte

Para problemas específicos de SKALE Motors:

1. Revisa los logs en `docker-compose logs`
2. Verifica la configuración en Supabase
3. Contacta al equipo de desarrollo
