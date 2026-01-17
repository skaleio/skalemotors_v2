import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import { Layout } from "@/components/Layout";
import Dashboard from "./pages/Dashboard";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import CRM from "./pages/CRM";
import Leads from "./pages/Leads";
import LeadsBoard from "./pages/LeadsBoard";
import SalesManagement from "./pages/SalesManagement";
import VendorManagement from "./pages/VendorManagement";
import Inventory from "./pages/Inventory";
import Appointments from "./pages/Appointments";
import Quotes from "./pages/Quotes";
import Finance from "./pages/Finance";
import FinancialTracking from "./pages/FinancialTracking";
import FinancialCalculator from "./pages/FinancialCalculator";
import Billing from "./pages/Billing";
import PostSaleCRM from "./pages/PostSaleCRM";
import AdvancedInventory from "./pages/AdvancedInventory";
import TradeIn from "./pages/TradeIn";
import Deliveries from "./pages/Deliveries";
import Listings from "./pages/Listings";
import Messages from "./pages/Messages";
import WebsiteBuilder from "./pages/WebsiteBuilder";
import Reports from "./pages/Reports";
import Alerts from "./pages/Alerts";
import StudioIA from "./pages/StudioIA";
import GeneradorPosts from "./pages/studio-ia/GeneradorPosts";
import DescripcionesVehiculos from "./pages/studio-ia/DescripcionesVehiculos";
import ScriptsLlamadas from "./pages/studio-ia/ScriptsLlamadas";
import GeneradorGuiones from "./pages/studio-ia/GeneradorGuiones";
import SEOAutomotriz from "./pages/studio-ia/SEOAutomotriz";
import FacebookAds from "./pages/studio-ia/FacebookAds";
import GoogleAds from "./pages/studio-ia/GoogleAds";
import OptimizadorImagenes from "./pages/studio-ia/OptimizadorImagenes";
import GeneradorLogos from "./pages/studio-ia/GeneradorLogos";
import ConstructorAgentes from "./pages/studio-ia/ConstructorAgentes";
import OptimizadorPrecios from "./pages/studio-ia/OptimizadorPrecios";
import IdentidadMarca from "./pages/studio-ia/IdentidadMarca";
import EmailMarketing from "./pages/studio-ia/EmailMarketing";
import AnalisisClientes from "./pages/studio-ia/AnalisisClientes";
import ChatbotAutomotora from "./pages/studio-ia/ChatbotAutomotora";
import ScriptsVideos from "./pages/studio-ia/ScriptsVideos";
import Settings from "./pages/Settings";
import Integrations from "./pages/Integrations";
import Users from "./pages/Users";
import Calls from "./pages/Calls";
import Profile from "./pages/Profile";
import Loyalty from "./pages/Loyalty";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Onboarding from "./pages/Onboarding";

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
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Rutas públicas */}
              <Route path="/" element={<Landing />} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/onboarding" element={<Onboarding />} />
              
              {/* Rutas protegidas */}
              <Route path="/app" element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/app/executive" element={
                <ProtectedRoute requiredRole={['admin', 'gerente']}>
                  <Layout>
                    <ExecutiveDashboard />
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
              <Route path="/app/appointments" element={
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
                <ProtectedRoute requiredRole={['admin', 'gerente']}>
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
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;