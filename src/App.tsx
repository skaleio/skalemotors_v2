import DashboardLoader from "@/components/DashboardLoader";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DeviceProvider } from "@/contexts/DeviceContext";
import { ShortcutsPreferencesProvider } from "@/contexts/ShortcutsPreferencesContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "@/components/Layout";

// Import estático para evitar "Failed to fetch dynamically imported module" en producción (chunk 404 tras deploy)
import Dashboard from "./pages/Dashboard";
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
const CRM = lazy(() => import("./pages/CRM"));
const Leads = lazy(() => import("./pages/Leads"));
const LeadsBoard = lazy(() => import("./pages/LeadsBoard"));
const SalesManagement = lazy(() => import("./pages/SalesManagement"));
const VendorManagement = lazy(() => import("./pages/VendorManagement"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Finance = lazy(() => import("./pages/Finance"));
const FundManagement = lazy(() => import("./pages/FundManagement"));
const FinancialTracking = lazy(() => import("./pages/FinancialTracking"));
const FinancialCalculator = lazy(() => import("./pages/FinancialCalculator"));
const SalaryDistribution = lazy(() => import("./pages/SalaryDistribution"));
const Billing = lazy(() => import("./pages/Billing"));
const VehicleAppraisal = lazy(() => import("./pages/VehicleAppraisal"));
const Documents = lazy(() => import("./pages/Documents"));
const Settings = lazy(() => import("./pages/Settings"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Users = lazy(() => import("./pages/Users"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
// Landing se importa estático: es la ruta principal y evita errores de "Failed to fetch dynamically imported module"
import Landing from "./pages/Landing";
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min: menos refetches, métricas estables
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
      // Mantener datos previos al refetch: las métricas no desaparecen en producción
      placeholderData: (previousData: unknown) => previousData,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
<ThemeProvider>
        <DeviceProvider>
        <AuthProvider>
        <ShortcutsPreferencesProvider>
        <ChatProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<DashboardLoader message="Cargando..." />}>
            <Routes>
              {/* Rutas públicas */}
              <Route path="/" element={<Landing />} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/onboarding" element={<Onboarding />} />

              {/* Rutas protegidas: rutas más específicas primero para que /app/executive no sea capturada por /app */}
              <Route path="/app/executive" element={
                <ProtectedRoute>
                  <Layout>
                    <ExecutiveDashboard />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app" element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/crm" element={
                <ProtectedRoute>
                  <Layout>
                    <CRM />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/leads" element={
                <ProtectedRoute>
                  <Layout>
                    <Leads />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/leads" element={
                <ProtectedRoute>
                  <Layout>
                    <Leads />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/leads/board" element={
                <ProtectedRoute>
                  <Layout>
                    <LeadsBoard />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/sales" element={
                <ProtectedRoute>
                  <Layout>
                    <SalesManagement />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/vendors" element={
                <ProtectedRoute>
                  <Layout>
                    <VendorManagement />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/inventory" element={
                <ProtectedRoute>
                  <Layout>
                    <Navigate to="/app/consignaciones" replace />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/consignaciones" element={
                <ProtectedRoute>
                  <Layout>
                    <Inventory />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/appointments" element={
                <ProtectedRoute>
                  <Layout>
                    <Appointments />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/appointments" element={
                <ProtectedRoute>
                  <Layout>
                    <Appointments />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/finance" element={
                <ProtectedRoute requiredPermission="finance:read">
                  <Layout>
                    <Finance />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/fund-management" element={
                <ProtectedRoute requiredPermission="finance:write">
                  <Layout>
                    <FundManagement />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/financial-tracking" element={
                <ProtectedRoute requiredPermission="finance:read">
                  <Layout>
                    <FinancialTracking />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/financial-calculator" element={
                <ProtectedRoute requiredPermission="finance:read">
                  <Layout>
                    <FinancialCalculator />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/salary-distribution" element={
                <ProtectedRoute requiredPermission="finance:read">
                  <Layout>
                    <SalaryDistribution />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/billing" element={
                <ProtectedRoute>
                  <Layout>
                    <Billing />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/tasacion" element={
                <ProtectedRoute>
                  <Layout>
                    <VehicleAppraisal />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/documents/venta" element={
                <ProtectedRoute>
                  <Layout>
                    <Documents />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/documents/consignacion" element={
                <ProtectedRoute>
                  <Layout>
                    <Documents />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/settings" element={
                <ProtectedRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/integrations" element={
                <ProtectedRoute>
                  <Layout>
                    <Integrations />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/users" element={
                <ProtectedRoute requiredRole={['admin', 'gerente']}>
                  <Layout>
                    <Users />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/profile" element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
          </TooltipProvider>
        </ChatProvider>
        </ShortcutsPreferencesProvider>
      </AuthProvider>
        </DeviceProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
