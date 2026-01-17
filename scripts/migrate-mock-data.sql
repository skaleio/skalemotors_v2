-- =====================================================
-- Script de Migración de Datos Mock a Supabase
-- SKALEMOTORS - Ecosistema Automotriz #1
-- =====================================================
-- 
-- Este script migra los datos mock del archivo mock-data.ts
-- a la base de datos de Supabase
--
-- IMPORTANTE: Ejecutar este script solo en ambiente de desarrollo/demo
-- =====================================================

-- Limpiar datos existentes (opcional, solo para reset)
-- TRUNCATE TABLE public.vehicles CASCADE;
-- TRUNCATE TABLE public.leads CASCADE;
-- TRUNCATE TABLE public.appointments CASCADE;
-- TRUNCATE TABLE public.quotes CASCADE;

-- =====================================================
-- MIGRAR VEHÍCULOS
-- =====================================================

INSERT INTO public.vehicles (
    id, vin, make, model, year, color, mileage, fuel_type, 
    transmission, category, condition, price, cost, status, 
    branch_id, description, images
) VALUES
-- Vehículo 1: Toyota Corolla Cross
(
    '550e8400-e29b-41d4-a716-446655440010',
    'JTD1235ER45678901',
    'Toyota',
    'Corolla',
    2024,
    'Blanco',
    0,
    'híbrido',
    'cvt',
    'nuevo',
    'excelente',
    18990000,
    16500000,
    'disponible',
    '550e8400-e29b-41d4-a716-446655440000', -- Sucursal Providencia
    'Toyota Corolla Cross Híbrido 2024, equipamiento completo',
    '["/placeholder.svg"]'::jsonb
),
-- Vehículo 2: Hyundai Tucson
(
    '550e8400-e29b-41d4-a716-446655440011',
    'HYU9876TR54321098',
    'Hyundai',
    'Tucson',
    2020,
    'Gris Oscuro',
    45000,
    'gasolina',
    'automático',
    'usado',
    'bueno',
    16490000,
    14200000,
    'reservado',
    '550e8400-e29b-41d4-a716-446655440000',
    'Hyundai Tucson 2020, único dueño, mantenimientos al día',
    '["/placeholder.svg"]'::jsonb
),
-- Vehículo 3: Chevrolet Tracker
(
    '550e8400-e29b-41d4-a716-446655440012',
    'CHE5432GH78901234',
    'Chevrolet',
    'Tracker',
    2021,
    'Rojo',
    32000,
    'gasolina',
    'automático',
    'usado',
    'bueno',
    15990000,
    13800000,
    'disponible',
    '550e8400-e29b-41d4-a716-446655440001', -- Sucursal Las Condes
    'Chevrolet Tracker Premier 2021, turbo, full equipo',
    '["/placeholder.svg"]'::jsonb
),
-- Vehículo 4: Kia Sportage
(
    '550e8400-e29b-41d4-a716-446655440013',
    'KIA7890MN23456789',
    'Kia',
    'Sportage',
    2019,
    'Azul',
    58000,
    'gasolina',
    'automático',
    'consignado',
    'bueno',
    14990000,
    13200000,
    'vendido',
    '550e8400-e29b-41d4-a716-446655440000',
    'Kia Sportage EX 2019, automática, aire acondicionado',
    '["/placeholder.svg"]'::jsonb
),
-- Vehículo 5: Nissan Kicks
(
    '550e8400-e29b-41d4-a716-446655440014',
    'NIS3456QR89012345',
    'Nissan',
    'Kicks',
    2024,
    'Negro',
    0,
    'gasolina',
    'cvt',
    'nuevo',
    'excelente',
    16790000,
    14500000,
    'disponible',
    '550e8400-e29b-41d4-a716-446655440000',
    'Nissan Kicks Advance CVT 2024, 0 kilómetros',
    '["/placeholder.svg"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- NOTA: Para migrar leads, appointments y quotes,
-- primero necesitas crear usuarios en auth.users
-- y luego referenciarlos en las tablas correspondientes
-- =====================================================

-- =====================================================
-- VERIFICAR DATOS MIGRADOS
-- =====================================================

SELECT 
    COUNT(*) as total_vehicles,
    COUNT(CASE WHEN status = 'disponible' THEN 1 END) as disponibles,
    COUNT(CASE WHEN status = 'reservado' THEN 1 END) as reservados,
    COUNT(CASE WHEN status = 'vendido' THEN 1 END) as vendidos
FROM public.vehicles;


