# Integración Completa con SimpleFactura.cl

Esta guía te ayudará a configurar la integración completa con SimpleFactura.cl para la facturación electrónica en tu SaaS, siguiendo la [documentación oficial](https://documentacion.simplefactura.cl).

## 📋 Requisitos Previos

1. **Cuenta en SimpleFactura.cl**: Regístrate en [https://simplefactura.cl](https://simplefactura.cl)
2. **API Key**: Obtén tu clave API desde el panel de administración
3. **RUT de la empresa**: Necesitas el RUT de tu empresa (sin puntos ni guión)

## 🔧 Configuración

### 1. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# SimpleFactura API Configuration
REACT_APP_SIMPLEFACTURA_API_KEY=tu-api-key-aqui
REACT_APP_SIMPLEFACTURA_ENV=sandbox
REACT_APP_COMPANY_RUT=761234567

# Configuración de la empresa
REACT_APP_COMPANY_NAME=SKALE MOTORS SPA
REACT_APP_COMPANY_ADDRESS=Av. Providencia 1234, Providencia, Santiago
REACT_APP_COMPANY_ACTIVITY=Venta de vehículos automotores

# Configuración de facturación
REACT_APP_DEFAULT_IVA=19
REACT_APP_DEFAULT_CITY=Santiago
REACT_APP_DEFAULT_COMMUNE=Providencia
```

### 2. Obtener API Key

1. Ve a [https://simplefactura.cl](https://simplefactura.cl)
2. Inicia sesión en tu cuenta
3. Ve a "Configuración" → "API"
4. Genera una nueva API Key
5. Copia la clave y pégala en tu archivo `.env`

### 3. Configurar Ambiente

- **Sandbox**: Para pruebas (recomendado para desarrollo)
- **Production**: Para uso en producción

## 🚀 Funcionalidades Implementadas

### ✅ Emisión de Documentos (Según Documentación Oficial)
- **Facturas**: Para ventas de vehículos
- **Boletas**: Para servicios post-venta
- **Boletas de Honorarios**: Para servicios profesionales
- **Notas de Crédito**: Para devoluciones
- **Notas de Débito**: Para ajustes

### ✅ Gestión de Documentos (API Completa)
- Consulta de estado de documentos
- Descarga de PDF y XML
- Anulación de documentos
- Seguimiento de folios
- Validación automática con SII

### ✅ Consultas SII
- Consulta de contribuyentes por RUT
- Validación de datos fiscales
- Estado de documentos en SII

### ✅ Reportes
- Resumen de ventas por período
- Documentos emitidos
- Estados de documentos

## 📱 Uso en la Aplicación

### 1. Verificar Conexión
```typescript
const { verificarConexion, isConnected } = useSimpleFactura();

// Verificar conexión
await verificarConexion();
```

### 2. Emitir Factura
```typescript
const { emitirFactura } = useSimpleFactura();

const datosFactura = {
  clienteRut: '12.345.678-9',
  clienteNombre: 'Pedro González',
  clienteDireccion: 'Av. Las Condes 1234',
  items: [
    {
      descripcion: 'Toyota Corolla 2023',
      cantidad: 1,
      precio: 18500000
    }
  ],
  neto: 15546218,
  iva: 2953782,
  total: 18500000
};

await emitirFactura(datosFactura);
```

### 3. Emitir Boleta
```typescript
const { emitirBoleta } = useSimpleFactura();

const datosBoleta = {
  clienteRut: '11.222.333-4',
  clienteNombre: 'Carlos Mendoza',
  items: [
    {
      descripcion: 'Mantenimiento 10,000 km',
      cantidad: 1,
      precio: 500000
    }
  ],
  neto: 420168,
  iva: 79832,
  total: 500000
};

await emitirBoleta(datosBoleta);
```

### 4. Consultar Contribuyente
```typescript
const { consultarContribuyente } = useSimpleFactura();

const contribuyente = await consultarContribuyente('12.345.678-9');
```

## 🔍 Estructura de Datos

### DTE (Documento Tributario Electrónico)
```typescript
interface DTE {
  tipo: 'factura' | 'boleta' | 'nota_credito' | 'nota_debito';
  folio: number;
  fecha_emision: string;
  receptor: {
    rut: string;
    razon_social: string;
    direccion: string;
    comuna: string;
    ciudad: string;
  };
  items: Array<{
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    descuento?: number;
  }>;
  totales: {
    neto: number;
    iva: number;
    total: number;
  };
}
```

## 🛠️ Desarrollo

### Archivos Principales
- `src/lib/simplefactura-api.ts`: Cliente de la API
- `src/hooks/useSimpleFactura.ts`: Hook personalizado
- `src/pages/Finance.tsx`: Interfaz de usuario

### Testing
```bash
# Ejecutar en modo sandbox
REACT_APP_SIMPLEFACTURA_ENV=sandbox npm start
```

## 📞 Soporte

- **Documentación**: [https://documentacion.simplefactura.cl](https://documentacion.simplefactura.cl)
- **Soporte**: Contacta al equipo de SimpleFactura para ayuda técnica
- **API Status**: Verifica el estado de la API en su panel de administración

## 🔒 Seguridad

- Nunca expongas tu API Key en el código fuente
- Usa variables de entorno para credenciales
- Implementa validación de datos en el frontend
- Usa HTTPS en producción

## 📊 Monitoreo

La aplicación incluye:
- Estados de conexión en tiempo real
- Logs de errores detallados
- Notificaciones de éxito/error
- Indicadores de carga

## 🚨 Troubleshooting

### Error de Conexión
1. Verifica tu API Key
2. Confirma que el ambiente sea correcto
3. Revisa la conectividad de red
4. Consulta los logs de la consola

### Error de Validación
1. Verifica el formato del RUT
2. Confirma que los datos del cliente sean correctos
3. Revisa los cálculos de IVA
4. Valida los folios disponibles

### Error de SII
1. Verifica que el documento cumpla con las normas del SII
2. Confirma que el contribuyente esté activo
3. Revisa las fechas de emisión
4. Consulta el estado en el portal del SII
