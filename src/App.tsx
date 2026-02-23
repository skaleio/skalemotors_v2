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
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Layout } from "@/components/Layout";
import ReloadOnPopState from "@/components/ReloadOnPopState";

// Imports estáticos para evitar "Failed to fetch dynamically imported module" en producción (chunk 404 tras deploy)
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
const CRM = lazy(() => import("./pages/CRM"));
const LeadsBoard = lazy(() => import("./pages/LeadsBoard"));
const SalesManagement = lazy(() => import("./pages/SalesManagement"));
const VendorManagement = lazy(() => import("./pages/VendorManagement"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Consignaciones = lazy(() => import("./pages/Consignaciones"));
const Tramites = lazy(() => import("./pages/Tramites"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Quotes = lazy(() => import("./pages/Quotes"));
const Finance = lazy(() => import("./pages/Finance"));
const FinancialTracking = lazy(() => import("./pages/FinancialTracking"));
const FinancialCalculator = lazy(() => import("./pages/FinancialCalculator"));
const Billing = lazy(() => import("./pages/Billing"));
const PostSaleCRM = lazy(() => import("./pages/PostSaleCRM"));
const AdvancedInventory = lazy(() => import("./pages/AdvancedInventory"));
const TradeIn = lazy(() => import("./pages/TradeIn"));
const Deliveries = lazy(() => import("./pages/Deliveries"));
const Listings = lazy(() => import("./pages/Listings"));
const ChileAutosScraper = lazy(() => import("./pages/ChileAutosScraper"));
const Messages = lazy(() => import("./pages/Messages"));
const WebsiteBuilder = lazy(() => import("./pages/WebsiteBuilder"));
const Reports = lazy(() => import("./pages/Reports"));
const Alerts = lazy(() => import("./pages/Alerts"));
const StudioIA = lazy(() => import("./pages/StudioIA"));
const GeneradorPosts = lazy(() => import("./pages/studio-ia/GeneradorPosts"));
const DescripcionesVehiculos = lazy(() => import("./pages/studio-ia/DescripcionesVehiculos"));
const ScriptsLlamadas = lazy(() => import("./pages/studio-ia/ScriptsLlamadas"));
const GeneradorGuiones = lazy(() => import("./pages/studio-ia/GeneradorGuiones"));
const SEOAutomotriz = lazy(() => import("./pages/studio-ia/SEOAutomotriz"));
const FacebookAds = lazy(() => import("./pages/studio-ia/FacebookAds"));
const GoogleAds = lazy(() => import("./pages/studio-ia/GoogleAds"));
const OptimizadorImagenes = lazy(() => import("./pages/studio-ia/OptimizadorImagenes"));
const GeneradorLogos = lazy(() => import("./pages/studio-ia/GeneradorLogos"));
const ConstructorAgentes = lazy(() => import("./pages/studio-ia/ConstructorAgentes"));
const OptimizadorPrecios = lazy(() => import("./pages/studio-ia/OptimizadorPrecios"));
const IdentidadMarca = lazy(() => import("./pages/studio-ia/IdentidadMarca"));
const EmailMarketing = lazy(() => import("./pages/studio-ia/EmailMarketing"));
const AnalisisClientes = lazy(() => import("./pages/studio-ia/AnalisisClientes"));
const ChatbotAutomotora = lazy(() => import("./pages/studio-ia/ChatbotAutomotora"));
const ScriptsVideos = lazy(() => import("./pages/studio-ia/ScriptsVideos"));
const Settings = lazy(() => import("./pages/Settings"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Users = lazy(() => import("./pages/Users"));
const Calls = lazy(() => import("./pages/Calls"));
const Profile = lazy(() => import("./pages/Profile"));
const Loyalty = lazy(() => import("./pages/Loyalty"));
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
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos (antes era cacheTime)
      refetchOnWindowFocus: false,
      retry: 2,
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
          <BrowserRouter>
            <ReloadOnPopState />
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
                    <Inventory />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/consignaciones" element={
                <ProtectedRoute>
                  <Layout>
                    <Consignaciones />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/tramites" element={
                <ProtectedRoute>
                  <Layout>
                    <Tramites />
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
              <Route path="/app/quotes" element={
                <ProtectedRoute>
                  <Layout>
                    <Quotes />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/finance" element={
                <ProtectedRoute>
                  <Layout>
                    <Finance />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/financial-tracking" element={
                <ProtectedRoute>
                  <Layout>
                    <FinancialTracking />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/financial-calculator" element={
                <ProtectedRoute>
                  <Layout>
                    <FinancialCalculator />
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
              <Route path="/app/post-sale" element={
                <ProtectedRoute>
                  <Layout>
                    <PostSaleCRM />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/inventory-advanced" element={
                <ProtectedRoute>
                  <Layout>
                    <AdvancedInventory />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/tradein" element={
                <ProtectedRoute>
                  <Layout>
                    <TradeIn />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/deliveries" element={
                <ProtectedRoute>
                  <Layout>
                    <Deliveries />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/listings" element={
                <ProtectedRoute>
                  <Layout>
                    <Listings />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/chileautos-scraper" element={
                <ProtectedRoute>
                  <Layout>
                    <ChileAutosScraper />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/messages" element={
                <ProtectedRoute>
                  <Layout>
                    <Messages />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/website" element={
                <ProtectedRoute>
                  <Layout>
                    <WebsiteBuilder />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/reports" element={
                <ProtectedRoute>
                  <Layout>
                    <Reports />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/alerts" element={
                <ProtectedRoute>
                  <Layout>
                    <Alerts />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia" element={
                <ProtectedRoute>
                  <Layout>
                    <StudioIA />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/content/posts" element={
                <ProtectedRoute>
                  <Layout>
                    <GeneradorPosts />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/content/descriptions" element={
                <ProtectedRoute>
                  <Layout>
                    <DescripcionesVehiculos />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/content/script-generator" element={
                <ProtectedRoute>
                  <Layout>
                    <GeneradorGuiones />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/content/video-scripts" element={
                <ProtectedRoute>
                  <Layout>
                    <ScriptsVideos />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/sales/call-scripts" element={
                <ProtectedRoute>
                  <Layout>
                    <ScriptsLlamadas />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/marketing/seo" element={
                <ProtectedRoute>
                  <Layout>
                    <SEOAutomotriz />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/marketing/facebook-ads" element={
                <ProtectedRoute>
                  <Layout>
                    <FacebookAds />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/marketing/google-ads" element={
                <ProtectedRoute>
                  <Layout>
                    <GoogleAds />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/marketing/email" element={
                <ProtectedRoute>
                  <Layout>
                    <EmailMarketing />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/visual/image-optimizer" element={
                <ProtectedRoute>
                  <Layout>
                    <OptimizadorImagenes />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/visual/logo-generator" element={
                <ProtectedRoute>
                  <Layout>
                    <GeneradorLogos />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/visual/brand-identity" element={
                <ProtectedRoute>
                  <Layout>
                    <IdentidadMarca />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/analytics/pricing-optimizer" element={
                <ProtectedRoute>
                  <Layout>
                    <OptimizadorPrecios />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/analytics/customer-insights" element={
                <ProtectedRoute>
                  <Layout>
                    <AnalisisClientes />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/automation/agent-builder" element={
                <ProtectedRoute>
                  <Layout>
                    <ConstructorAgentes />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/studio-ia/automation/chatbot" element={
                <ProtectedRoute>
                  <Layout>
                    <ChatbotAutomotora />
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
              <Route path="/app/calls" element={
                <ProtectedRoute>
                  <Layout>
                    <Calls />
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
              <Route path="/app/loyalty" element={
                <ProtectedRoute>
                  <Layout>
                    <Loyalty />
                  </Layout>
                </ProtectedRoute>
              } />
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
