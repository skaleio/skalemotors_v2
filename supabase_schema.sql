-- =====================================================
-- SKALEMOTORS - Ecosistema Automotriz #1
-- Schema SQL para Supabase
-- Proyecto: knczbjmiqhkopsytkauo
-- =====================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABLAS DE USUARIOS Y AUTENTICACIÓN
-- =====================================================

-- Tabla de sucursales (crear primero para evitar dependencias circulares)
CREATE TABLE public.branches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    manager_id UUID, -- Se agregará la referencia después de crear users
    city TEXT NOT NULL,
    region TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de usuarios extendida
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'gerente', 'vendedor', 'financiero', 'servicio', 'inventario')),
    branch_id UUID REFERENCES public.branches(id),
    is_active BOOLEAN DEFAULT true,
    avatar_url TEXT,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agregar la referencia de manager_id después de crear users
ALTER TABLE public.branches ADD CONSTRAINT fk_branches_manager 
    FOREIGN KEY (manager_id) REFERENCES public.users(id);

-- =====================================================
-- TABLAS DE VEHÍCULOS E INVENTARIO
-- =====================================================

-- Tabla de vehículos
CREATE TABLE public.vehicles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    vin TEXT UNIQUE NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    color TEXT NOT NULL,
    mileage INTEGER,
    fuel_type TEXT CHECK (fuel_type IN ('gasolina', 'diesel', 'híbrido', 'eléctrico')),
    transmission TEXT CHECK (transmission IN ('manual', 'automático', 'cvt')),
    engine_size TEXT,
    doors INTEGER,
    seats INTEGER,
    category TEXT NOT NULL CHECK (category IN ('nuevo', 'usado', 'consignado')),
    condition TEXT CHECK (condition IN ('excelente', 'bueno', 'regular', 'malo')),
    price DECIMAL(12,2) NOT NULL,
    cost DECIMAL(12,2),
    margin DECIMAL(12,2),
    status TEXT DEFAULT 'disponible' CHECK (status IN ('disponible', 'reservado', 'vendido', 'en_reparacion', 'fuera_de_servicio')),
    branch_id UUID REFERENCES public.branches(id),
    location TEXT,
    description TEXT,
    features JSONB DEFAULT '[]',
    images JSONB DEFAULT '[]',
    documents JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de marcas
CREATE TABLE public.brands (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    country TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLAS DE LEADS Y CRM
-- =====================================================

-- Tabla de leads
CREATE TABLE public.leads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('web', 'referido', 'walk_in', 'telefono', 'redes_sociales', 'evento', 'otro')),
    status TEXT DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'contactado', 'interesado', 'cotizando', 'negociando', 'vendido', 'perdido')),
    priority TEXT DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta')),
    assigned_to UUID REFERENCES public.users(id),
    branch_id UUID REFERENCES public.branches(id),
    budget_min DECIMAL(12,2),
    budget_max DECIMAL(12,2),
    preferred_vehicle_id UUID REFERENCES public.vehicles(id),
    notes TEXT,
    tags JSONB DEFAULT '[]',
    last_contact_at TIMESTAMP WITH TIME ZONE,
    next_follow_up TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de actividades de leads
CREATE TABLE public.lead_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    type TEXT NOT NULL CHECK (type IN ('llamada', 'email', 'whatsapp', 'reunion', 'test_drive', 'cotizacion', 'nota')),
    subject TEXT,
    description TEXT,
    outcome TEXT,
    duration_minutes INTEGER,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLAS DE VENTAS
-- =====================================================

-- Tabla de ventas
CREATE TABLE public.sales (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id),
    vehicle_id UUID REFERENCES public.vehicles(id),
    seller_id UUID REFERENCES public.users(id),
    branch_id UUID REFERENCES public.branches(id),
    sale_price DECIMAL(12,2) NOT NULL,
    cost DECIMAL(12,2),
    margin DECIMAL(12,2),
    commission DECIMAL(12,2),
    financing_type TEXT CHECK (financing_type IN ('contado', 'financiamiento_directo', 'leasing', 'credito_bancario')),
    financing_amount DECIMAL(12,2),
    down_payment DECIMAL(12,2),
    monthly_payment DECIMAL(12,2),
    interest_rate DECIMAL(5,2),
    term_months INTEGER,
    status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobada', 'rechazada', 'completada', 'cancelada')),
    sale_date DATE,
    delivery_date DATE,
    notes TEXT,
    documents JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de cotizaciones
CREATE TABLE public.quotes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id),
    vehicle_id UUID REFERENCES public.vehicles(id),
    seller_id UUID REFERENCES public.users(id),
    base_price DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    final_price DECIMAL(12,2) NOT NULL,
    financing_options JSONB DEFAULT '[]',
    accessories JSONB DEFAULT '[]',
    warranty_options JSONB DEFAULT '[]',
    valid_until TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'enviada', 'aceptada', 'rechazada', 'expirada')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLAS DE CITAS Y TEST DRIVES
-- =====================================================

-- Tabla de citas
CREATE TABLE public.appointments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id),
    vehicle_id UUID REFERENCES public.vehicles(id),
    user_id UUID REFERENCES public.users(id),
    branch_id UUID REFERENCES public.branches(id),
    type TEXT NOT NULL CHECK (type IN ('consulta', 'test_drive', 'entrega', 'servicio', 'financiamiento')),
    title TEXT NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status TEXT DEFAULT 'programada' CHECK (status IN ('programada', 'confirmada', 'en_progreso', 'completada', 'cancelada', 'no_show')),
    location TEXT,
    notes TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLAS DE SERVICIOS POST-VENTA
-- =====================================================

-- Tabla de servicios
CREATE TABLE public.services (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID REFERENCES public.leads(id),
    vehicle_id UUID REFERENCES public.vehicles(id),
    service_type TEXT NOT NULL CHECK (service_type IN ('mantenimiento', 'reparacion', 'garantia', 'accesorios', 'inspeccion')),
    title TEXT NOT NULL,
    description TEXT,
    technician_id UUID REFERENCES public.users(id),
    branch_id UUID REFERENCES public.branches(id),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_duration INTEGER, -- en minutos
    actual_duration INTEGER, -- en minutos
    status TEXT DEFAULT 'programado' CHECK (status IN ('programado', 'en_progreso', 'completado', 'cancelado')),
    cost DECIMAL(10,2),
    parts_cost DECIMAL(10,2),
    labor_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLAS DE FIDELIZACIÓN
-- =====================================================

-- Tabla de códigos QR
CREATE TABLE public.qr_codes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    url TEXT NOT NULL,
    qr_image_url TEXT,
    scans INTEGER DEFAULT 0,
    new_members INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    last_scan_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de clientes leales
CREATE TABLE public.loyal_customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id),
    card_number TEXT UNIQUE NOT NULL,
    qr_source TEXT,
    points INTEGER DEFAULT 0,
    tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    total_spent DECIMAL(12,2) DEFAULT 0,
    visits INTEGER DEFAULT 0,
    digital_card BOOLEAN DEFAULT false,
    notifications_enabled BOOLEAN DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_visit TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de ofertas
CREATE TABLE public.offers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('descuento', 'puntos', 'servicio_gratis', 'accesorio', 'garantia_extendida')),
    points_required INTEGER,
    discount_percentage DECIMAL(5,2),
    discount_amount DECIMAL(10,2),
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    max_redemptions INTEGER,
    current_redemptions INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLAS DE LLAMADAS Y COMUNICACIÓN
-- =====================================================

-- Tabla de llamadas
CREATE TABLE public.calls (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id),
    user_id UUID REFERENCES public.users(id),
    type TEXT NOT NULL CHECK (type IN ('entrante', 'saliente')),
    duration_seconds INTEGER,
    status TEXT CHECK (status IN ('contestada', 'no_contestada', 'ocupada', 'cancelada')),
    outcome TEXT,
    notes TEXT,
    recording_url TEXT,
    transcript TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de mensajes
CREATE TABLE public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id),
    user_id UUID REFERENCES public.users(id),
    type TEXT NOT NULL CHECK (type IN ('whatsapp', 'email', 'sms', 'chat')),
    direction TEXT NOT NULL CHECK (direction IN ('entrante', 'saliente')),
    subject TEXT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'enviado' CHECK (status IN ('enviado', 'entregado', 'leido', 'fallido')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLAS DE REPORTES Y ANALÍTICAS
-- =====================================================

-- Tabla de métricas diarias
CREATE TABLE public.daily_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    date DATE NOT NULL,
    branch_id UUID REFERENCES public.branches(id),
    leads_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    sales_revenue DECIMAL(12,2) DEFAULT 0,
    appointments_count INTEGER DEFAULT 0,
    services_count INTEGER DEFAULT 0,
    services_revenue DECIMAL(12,2) DEFAULT 0,
    calls_count INTEGER DEFAULT 0,
    messages_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

-- Índices para búsquedas frecuentes
CREATE INDEX idx_vehicles_status ON public.vehicles(status);
CREATE INDEX idx_vehicles_branch ON public.vehicles(branch_id);
CREATE INDEX idx_vehicles_category ON public.vehicles(category);
CREATE INDEX idx_vehicles_make_model ON public.vehicles(make, model);

CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_branch ON public.leads(branch_id);
CREATE INDEX idx_leads_created_at ON public.leads(created_at);

CREATE INDEX idx_sales_seller ON public.sales(seller_id);
CREATE INDEX idx_sales_branch ON public.sales(branch_id);
CREATE INDEX idx_sales_date ON public.sales(sale_date);

CREATE INDEX idx_appointments_scheduled ON public.appointments(scheduled_at);
CREATE INDEX idx_appointments_user ON public.appointments(user_id);

CREATE INDEX idx_services_status ON public.services(status);
CREATE INDEX idx_services_technician ON public.services(technician_id);

-- =====================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_qr_codes_updated_at BEFORE UPDATE ON public.qr_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loyal_customers_updated_at BEFORE UPDATE ON public.loyal_customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para calcular margen automáticamente
CREATE OR REPLACE FUNCTION calculate_vehicle_margin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cost IS NOT NULL AND NEW.price IS NOT NULL THEN
        NEW.margin = NEW.price - NEW.cost;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_vehicle_margin_trigger 
    BEFORE INSERT OR UPDATE ON public.vehicles 
    FOR EACH ROW EXECUTE FUNCTION calculate_vehicle_margin();

-- Función para calcular margen de venta
CREATE OR REPLACE FUNCTION calculate_sale_margin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cost IS NOT NULL AND NEW.sale_price IS NOT NULL THEN
        NEW.margin = NEW.sale_price - NEW.cost;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_sale_margin_trigger 
    BEFORE INSERT OR UPDATE ON public.sales 
    FOR EACH ROW EXECUTE FUNCTION calculate_sale_margin();

-- =====================================================
-- RLS (ROW LEVEL SECURITY) POLICIES
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyal_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all users" ON public.users FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Políticas para sucursales
CREATE POLICY "Users can view branches" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Admins can manage branches" ON public.branches FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Políticas para vehículos
CREATE POLICY "Users can view vehicles" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "Staff can manage vehicles" ON public.vehicles FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'gerente', 'inventario'))
);

-- Políticas para leads
CREATE POLICY "Users can view assigned leads" ON public.leads FOR SELECT USING (
    assigned_to = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'gerente'))
);
CREATE POLICY "Users can manage assigned leads" ON public.leads FOR ALL USING (
    assigned_to = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'gerente'))
);

-- Políticas para ventas
CREATE POLICY "Users can view own sales" ON public.sales FOR SELECT USING (
    seller_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'gerente'))
);
CREATE POLICY "Users can create sales" ON public.sales FOR INSERT WITH CHECK (
    seller_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'gerente'))
);

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Insertar sucursal principal
INSERT INTO public.branches (id, name, address, phone, email, city, region) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Sucursal Providencia', 'Av. Providencia 1234, Santiago', '+56 2 2345 6789', 'providencia@skalemotors.com', 'Santiago', 'Región Metropolitana'),
('550e8400-e29b-41d4-a716-446655440001', 'Sucursal Las Condes', 'Av. Las Condes 5678, Santiago', '+56 2 2345 6790', 'lascondes@skalemotors.com', 'Santiago', 'Región Metropolitana');

-- Insertar marcas populares
INSERT INTO public.brands (name, country) VALUES
('Toyota', 'Japón'),
('Nissan', 'Japón'),
('Hyundai', 'Corea del Sur'),
('Chevrolet', 'Estados Unidos'),
('Kia', 'Corea del Sur'),
('Ford', 'Estados Unidos'),
('Volkswagen', 'Alemania'),
('Honda', 'Japón'),
('Mazda', 'Japón'),
('Suzuki', 'Japón');

-- Insertar ofertas de fidelización
INSERT INTO public.offers (name, description, category, points_required, discount_percentage, valid_until) VALUES
('Descuento 20% Accesorios', 'Descuento especial en accesorios para vehículos', 'descuento', 500, 20.00, NOW() + INTERVAL '30 days'),
('Mantenimiento Gratis', 'Mantenimiento básico sin costo', 'servicio_gratis', 1000, 0, NOW() + INTERVAL '60 days'),
('Test Drive Premium', 'Test drive extendido con vehículo premium', 'servicio_gratis', 300, 0, NOW() + INTERVAL '15 days'),
('Garantía Extendida', 'Extensión de garantía por 1 año adicional', 'garantia_extendida', 2000, 0, NOW() + INTERVAL '90 days'),
('Lavado Premium', 'Servicio de lavado premium completo', 'servicio_gratis', 200, 0, NOW() + INTERVAL '7 days');

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de dashboard ejecutivo
CREATE VIEW public.executive_dashboard AS
SELECT 
    DATE_TRUNC('month', s.sale_date) as month,
    COUNT(s.id) as total_sales,
    SUM(s.sale_price) as total_revenue,
    AVG(s.sale_price) as average_sale_price,
    SUM(s.margin) as total_margin,
    COUNT(DISTINCT s.seller_id) as active_sellers,
    COUNT(DISTINCT l.id) as total_leads,
    COUNT(DISTINCT CASE WHEN l.status = 'vendido' THEN l.id END) as converted_leads
FROM public.sales s
LEFT JOIN public.leads l ON s.lead_id = l.id
WHERE s.sale_date >= DATE_TRUNC('month', NOW() - INTERVAL '12 months')
GROUP BY DATE_TRUNC('month', s.sale_date)
ORDER BY month DESC;

-- Vista de performance por vendedor
CREATE VIEW public.seller_performance AS
SELECT 
    u.id,
    u.full_name,
    u.email,
    b.name as branch_name,
    COUNT(s.id) as total_sales,
    SUM(s.sale_price) as total_revenue,
    SUM(s.commission) as total_commission,
    AVG(s.sale_price) as average_sale_price,
    COUNT(DISTINCT l.id) as total_leads,
    COUNT(DISTINCT CASE WHEN l.status = 'vendido' THEN l.id END) as converted_leads,
    ROUND(
        (COUNT(DISTINCT CASE WHEN l.status = 'vendido' THEN l.id END)::DECIMAL / 
         NULLIF(COUNT(DISTINCT l.id), 0)) * 100, 2
    ) as conversion_rate
FROM public.users u
LEFT JOIN public.sales s ON u.id = s.seller_id
LEFT JOIN public.leads l ON u.id = l.assigned_to
LEFT JOIN public.branches b ON u.branch_id = b.id
WHERE u.role = 'vendedor'
GROUP BY u.id, u.full_name, u.email, b.name;

-- Vista de inventario por sucursal
CREATE VIEW public.inventory_by_branch AS
SELECT 
    b.name as branch_name,
    COUNT(v.id) as total_vehicles,
    COUNT(CASE WHEN v.status = 'disponible' THEN 1 END) as available_vehicles,
    COUNT(CASE WHEN v.status = 'reservado' THEN 1 END) as reserved_vehicles,
    COUNT(CASE WHEN v.status = 'vendido' THEN 1 END) as sold_vehicles,
    SUM(v.price) as total_inventory_value,
    AVG(v.price) as average_price,
    COUNT(CASE WHEN v.category = 'nuevo' THEN 1 END) as new_vehicles,
    COUNT(CASE WHEN v.category = 'usado' THEN 1 END) as used_vehicles,
    COUNT(CASE WHEN v.category = 'consignado' THEN 1 END) as consigned_vehicles
FROM public.branches b
LEFT JOIN public.vehicles v ON b.id = v.branch_id
GROUP BY b.id, b.name;

-- =====================================================
-- FUNCIONES DE UTILIDAD
-- =====================================================

-- Función para obtener estadísticas de leads
CREATE OR REPLACE FUNCTION get_lead_stats(user_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_leads BIGINT,
    new_leads BIGINT,
    contacted_leads BIGINT,
    interested_leads BIGINT,
    quoted_leads BIGINT,
    sold_leads BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_leads,
        COUNT(CASE WHEN l.status = 'nuevo' THEN 1 END) as new_leads,
        COUNT(CASE WHEN l.status = 'contactado' THEN 1 END) as contacted_leads,
        COUNT(CASE WHEN l.status = 'interesado' THEN 1 END) as interested_leads,
        COUNT(CASE WHEN l.status = 'cotizando' THEN 1 END) as quoted_leads,
        COUNT(CASE WHEN l.status = 'vendido' THEN 1 END) as sold_leads
    FROM public.leads l
    WHERE (user_id IS NULL OR l.assigned_to = user_id)
    AND l.created_at >= DATE_TRUNC('month', NOW());
END;
$$ LANGUAGE plpgsql;

-- Función para obtener métricas de ventas
CREATE OR REPLACE FUNCTION get_sales_metrics(user_id UUID DEFAULT NULL, days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_sales BIGINT,
    total_revenue DECIMAL,
    average_sale_price DECIMAL,
    total_margin DECIMAL,
    total_commission DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(s.sale_price), 0) as total_revenue,
        COALESCE(AVG(s.sale_price), 0) as average_sale_price,
        COALESCE(SUM(s.margin), 0) as total_margin,
        COALESCE(SUM(s.commission), 0) as total_commission
    FROM public.sales s
    WHERE (user_id IS NULL OR s.seller_id = user_id)
    AND s.sale_date >= NOW() - INTERVAL '1 day' * days;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================

COMMENT ON DATABASE postgres IS 'SKALEMOTORS - Ecosistema Automotriz #1 - Base de datos completa para gestión de automotoras';
COMMENT ON SCHEMA public IS 'Esquema principal de SKALEMOTORS con todas las tablas del ecosistema automotriz';

-- =====================================================
-- FIN DEL SCHEMA
-- =====================================================
