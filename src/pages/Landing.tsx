import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OptimizedStarsBackground } from "@/components/OptimizedStarsBackground";
import { 
  Accordion, 
  AccordionItem, 
  AccordionButton, 
  AccordionPanel 
} from "@/components/animate-ui/components/headless/accordion";
import { 
  Menu, 
  X, 
  ArrowRight, 
  Car, 
  Users, 
  User,
  TrendingUp, 
  Shield, 
  Clock, 
  CheckCircle, 
  Star, 
  Phone, 
  Mail, 
  MapPin, 
  Facebook, 
  Instagram, 
  Linkedin,
  Award,
  Target,
  Zap,
  Globe,
  BarChart3,
  DollarSign,
  FileText,
  Calendar,
  CreditCard,
  Activity,
  Settings,
  Database,
  Cloud,
  Lock,
  Smartphone,
  Monitor,
  Headphones,
  Building2,
  Sparkles,
  Rocket,
  Layers,
  Cpu,
  Workflow,
  Bot,
  LineChart,
  PieChart,
  ArrowUpRight,
  CheckCircle2,
  Plus,
  Minus
} from "lucide-react";

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const keyFeatures = [
    {
      icon: BarChart3,
      title: "Dashboard Ejecutivo",
      description: "Métricas en tiempo real, KPIs automatizados y reportes inteligentes para tomar decisiones estratégicas."
    },
    {
      icon: Users,
      title: "CRM Avanzado",
      description: "Gestiona leads, clientes y oportunidades con herramientas de seguimiento y automatización."
    },
    {
      icon: Car,
      title: "Inventario Inteligente",
      description: "Control total de tu flota con alertas automáticas, seguimiento de ubicación y mantenimiento."
    },
    {
      icon: Phone,
      title: "Centro de Llamadas",
      description: "Sistema integrado de llamadas con grabación, seguimiento y métricas de performance."
    },
    {
      icon: Calendar,
      title: "Gestión de Citas",
      description: "Agenda inteligente con recordatorios automáticos y sincronización con calendarios."
    },
    {
      icon: FileText,
      title: "Documentación Digital",
      description: "Contratos, facturas y documentos legales digitalizados y automatizados."
    }
  ];

  const testimonials = [
    {
      name: "Carlos Mendoza",
      role: "CEO, AutoMax",
      content: "SKALE transformó completamente nuestra operación. Incrementamos las ventas un 40% en solo 6 meses.",
      rating: 5,
      avatar: "CM"
    },
    {
      name: "María González",
      role: "Gerente General, CarDealer Pro",
      content: "La plataforma más completa que hemos usado. Todo integrado en un solo lugar, súper fácil de usar.",
      rating: 5,
      avatar: "MG"
    },
    {
      name: "Roberto Silva",
      role: "Director Comercial, AutoCenter",
      content: "El ROI fue inmediato. Recuperamos la inversión en 3 meses y seguimos creciendo exponencialmente.",
      rating: 5,
      avatar: "RS"
    }
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "$99",
      period: "/mes",
      description: "Perfecto para automotoras pequeñas",
      features: [
        "Hasta 50 vehículos",
        "CRM básico",
        "Dashboard ejecutivo",
        "Soporte por email",
        "Reportes mensuales"
      ],
      popular: false
    },
    {
      name: "Professional",
      price: "$199",
      period: "/mes",
      description: "Ideal para automotoras en crecimiento",
      features: [
        "Hasta 200 vehículos",
        "CRM avanzado",
        "Centro de llamadas",
        "Soporte prioritario",
        "Reportes en tiempo real",
        "Integraciones API"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: "$399",
      period: "/mes",
      description: "Para grandes operaciones",
      features: [
        "Vehículos ilimitados",
        "CRM completo",
        "Sistema de fidelización",
        "Soporte 24/7",
        "Analytics avanzados",
        "Personalización total"
      ],
      popular: false
    }
  ];

  const faqItems = [
    {
      question: "¿Cómo funciona la integración con mi sistema actual?",
      answer: "SKALE se integra fácilmente con la mayoría de sistemas existentes a través de APIs robustas. Nuestro equipo técnico te ayuda con la migración sin interrupciones."
    },
    {
      question: "¿Qué tipo de soporte ofrecen?",
      answer: "Ofrecemos soporte técnico completo: chat en vivo, email, teléfono y videollamadas. Los planes Professional y Enterprise incluyen soporte prioritario."
    },
    {
      question: "¿Puedo cancelar mi suscripción en cualquier momento?",
      answer: "Sí, puedes cancelar tu suscripción en cualquier momento sin penalizaciones. Tus datos se mantienen disponibles por 30 días después de la cancelación."
    },
    {
      question: "¿Los datos están seguros?",
      answer: "Absolutamente. Utilizamos encriptación de grado bancario, respaldos automáticos y cumplimos con todas las regulaciones de protección de datos."
    },
    {
      question: "¿Hay período de prueba?",
      answer: "Sí, ofrecemos 14 días de prueba gratuita sin compromiso. Puedes explorar todas las funcionalidades antes de decidir."
    }
  ];

  const handleScrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const headerHeight = 100;
      const elementPosition = element.offsetTop - headerHeight;
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      });
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen relative">
      <OptimizedStarsBackground 
        className="fixed inset-0 z-0"
        starColor="#87CEEB"
        factor={0.02}
        speed={100}
        transition={{ stiffness: 30, damping: 15 }}
      />
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent backdrop-blur-md border-b border-cyan-400/30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo SKALE */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <span className="text-white font-bold text-xl">SKALEMOTORS</span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <button 
                onClick={() => handleScrollToSection('features')}
                className="text-white hover:text-cyan-400 transition-colors font-medium"
              >
                Características
              </button>
              <button 
                onClick={() => handleScrollToSection('video-demo')}
                className="text-white hover:text-cyan-400 transition-colors font-medium"
              >
                Demo
              </button>
              <button 
                onClick={() => handleScrollToSection('testimonials')}
                className="text-white hover:text-cyan-400 transition-colors font-medium"
              >
                Clientes
              </button>
              <button 
                onClick={() => handleScrollToSection('pricing')}
                className="text-white hover:text-cyan-400 transition-colors font-medium"
              >
                Planes
              </button>
              <button 
                onClick={() => handleScrollToSection('faq')}
                className="text-white hover:text-cyan-400 transition-colors font-medium"
              >
                FAQ
              </button>
            </nav>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <Button 
                variant="ghost"
                className="text-white hover:bg-cyan-500/20 hover:text-cyan-400 border border-white/30 hover:border-cyan-400/50"
                onClick={() => window.location.href = '/login'}
              >
                Login
              </Button>
              <Button 
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
                onClick={() => window.location.href = '/register'}
              >
                Start Free Trial
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-4">
              <div className="space-y-4">
                <button 
                  onClick={() => handleScrollToSection('features')}
                  className="block text-white hover:text-cyan-400 w-full text-left font-medium"
                >
                  Características
                </button>
                <button 
                  onClick={() => handleScrollToSection('video-demo')}
                  className="block text-white hover:text-cyan-400 w-full text-left font-medium"
                >
                  Demo
                </button>
                <button 
                  onClick={() => handleScrollToSection('testimonials')}
                  className="block text-white hover:text-cyan-400 w-full text-left font-medium"
                >
                  Clientes
                </button>
                <button 
                  onClick={() => handleScrollToSection('pricing')}
                  className="block text-white hover:text-cyan-400 w-full text-left font-medium"
                >
                  Planes
                </button>
                <button 
                  onClick={() => handleScrollToSection('faq')}
                  className="block text-white hover:text-cyan-400 w-full text-left font-medium"
                >
                  FAQ
                </button>
                <div className="pt-4 space-y-2">
                  <Button 
                    variant="ghost"
                    className="w-full text-white hover:bg-cyan-500/20 hover:text-cyan-400 border border-white/30 hover:border-cyan-400/50"
                    onClick={() => window.location.href = '/login'}
                  >
                    Login
                  </Button>
                  <Button 
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
                    onClick={() => window.location.href = '/register'}
                  >
                    Start Free Trial
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-4 pt-20 relative z-10">
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <Badge className="mb-6 bg-white/20 text-white border-white/30">
            🚀 La plataforma #1 para automotoras
          </Badge>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-8 leading-tight">
            <span className="block text-3xl md:text-4xl lg:text-5xl font-light mb-6">
              La plataforma que
            </span>
            <span className="block text-cyan-400 font-extrabold text-4xl md:text-5xl lg:text-6xl mb-6 tracking-wider uppercase">
              REVOLUCIONA
            </span>
            <span className="block text-3xl md:text-4xl lg:text-5xl font-light tracking-[0.2em]">
              tu a u t o m o t o r a
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-white max-w-4xl mx-auto mb-12 font-light leading-relaxed">
            Incrementa tus ventas un 40%, optimiza procesos y domina el mercado automotriz 
            con la plataforma más completa del sector.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-4 text-lg font-semibold"
              onClick={() => window.location.href = '/register'}
            >
              Empezar ahora!
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-2 border-white bg-white text-black hover:bg-gray-100 hover:border-gray-200 hover:text-black px-8 py-4 text-lg font-semibold"
              onClick={() => window.location.href = '/login'}
            >
              Probar Demo
            </Button>
          </div>

        </div>
      </section>

      {/* New Features Section */}
      <section className="py-20 px-4 bg-black relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-cyan-500/20 text-cyan-400 border-cyan-400/30">
              ⭐ Centraliza tus movimientos
            </Badge>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight">
              Todas tus operaciones
              <span className="block text-cyan-400 font-black">
                en un solo lugar
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-white/90 max-w-4xl mx-auto font-light leading-relaxed tracking-wide">
              Un sistema integral que reemplaza las hojas de cálculo y los programas dispersos por una única plataforma intuitiva.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Gestión de Inventario */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Car className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Gestión de Inventario</h3>
              <p className="text-white/85 leading-relaxed mb-8">
                Controla tu stock y seguimiento de cada uno, desde la consignación hasta la venta.
              </p>
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-600 shadow-2xl">
                <div className="text-left">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="text-white font-bold text-xl mb-1">Inventario Avanzado</div>
                      <div className="text-white/60 text-sm">Análisis profundo de inventario, rotación y predicción</div>
                    </div>
                    <div className="flex gap-2">
                      <div className="bg-cyan-500 text-white px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1">
                        <Plus className="h-4 w-4" />
                        Agregar
                      </div>
                      <div className="bg-slate-700 text-white px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1">
                        <ArrowUpRight className="h-4 w-4" />
                        Exportar
                      </div>
                    </div>
                  </div>

                  {/* Metrics Cards */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-white/60 text-xs">Total Vehículos</div>
                          <div className="text-white font-bold text-lg">156</div>
                          <div className="text-cyan-400 text-xs">89 disponibles</div>
                        </div>
                        <Car className="h-5 w-5 text-white/40" />
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-white/60 text-xs">Valor Total</div>
                          <div className="text-white font-bold text-lg">$2.85B</div>
                          <div className="text-cyan-400 text-xs">En inventario</div>
                        </div>
                        <DollarSign className="h-5 w-5 text-white/40" />
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-white/60 text-xs">Días Promedio</div>
                          <div className="text-white font-bold text-lg">45</div>
                          <div className="text-cyan-400 text-xs">En stock</div>
                        </div>
                        <Clock className="h-5 w-5 text-white/40" />
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-white/60 text-xs">Tasa de Rotación</div>
                          <div className="text-white font-bold text-lg">2.3x</div>
                          <div className="text-cyan-400 text-xs">Por año</div>
                        </div>
                        <TrendingUp className="h-5 w-5 text-white/40" />
                      </div>
                    </div>
                  </div>

                  {/* Alerts */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-white font-semibold text-sm">Alertas de Inventario</span>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <div className="text-white font-medium text-sm mb-1">Stock Bajo - Toyota Corolla</div>
                        <div className="text-white/70 text-xs mb-2">Solo quedan 2 unidades de Toyota Corolla 2023</div>
                        <div className="flex justify-between items-center">
                          <span className="text-white/60 text-xs">Toyota Corolla 2023 • 15 días en stock</span>
                          <span className="bg-red-500 text-white px-2 py-1 rounded text-xs">high</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Search and Filters */}
                  <div className="bg-slate-700/50 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 bg-slate-600 rounded"></div>
                      <span className="text-white/60 text-sm">Buscar por marca, modelo, VIN, PPU...</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="bg-slate-600 px-3 py-1 rounded text-xs text-white/80">Todos los estados</div>
                      <div className="bg-slate-600 px-3 py-1 rounded text-xs text-white/80">Todos los tipos</div>
                      <div className="bg-slate-600 px-3 py-1 rounded text-xs text-white/80">Todas las marcas</div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-4 mb-4">
                    <div className="text-cyan-400 font-semibold border-b-2 border-cyan-400 pb-1 text-sm">Resumen</div>
                    <div className="text-white/60 pb-1 text-sm">Vehículos</div>
                    <div className="text-white/60 pb-1 text-sm">Análisis</div>
                    <div className="text-white/60 pb-1 text-sm">Predicción</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Seguimiento de Clientes */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Seguimiento de Clientes</h3>
              <p className="text-white/85 leading-relaxed mb-8">
                Registra datos y leads desde la web, derivar entre sucursales y concretar más ventas.
              </p>
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-600 shadow-2xl">
                <div className="text-left">
                  <div className="text-cyan-400 text-sm mb-2 flex items-center gap-1">
                    <span>Configuración</span>
                    <span>&gt;</span>
                    <span>Sucursales</span>
                  </div>
                  <div className="text-white font-bold text-lg mb-4">Sucursales</div>
                  <div className="flex gap-4 mb-4">
                    <div className="text-cyan-400 font-semibold border-b-2 border-cyan-400 pb-1">Sucursales activas</div>
                    <div className="text-white/60 pb-1">Historial</div>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                      <div className="text-white font-medium mb-1">Costanera Sur, Las Condes</div>
                      <div className="text-white/60 text-sm mb-2">Región Metropolitana de Santiago</div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-cyan-400" />
                        <span className="text-white/80 text-sm">+56 2 1234 5678</span>
                      </div>
                    </div>
                    <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                      <div className="text-white font-medium mb-1">Av. Providencia 1234</div>
                      <div className="text-white/60 text-sm mb-2">Providencia, Santiago</div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-cyan-400" />
                        <span className="text-white/80 text-sm">+56 2 8765 4321</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard de Ventas */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Dashboard de Ventas</h3>
              <p className="text-white/85 leading-relaxed mb-8">
                Monitorea el rendimiento de ventas en tiempo real con métricas avanzadas y análisis predictivo.
              </p>
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-600 shadow-2xl">
                <div className="text-left">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-white font-bold text-lg">Dashboard de Ventas</div>
                      <div className="text-white/60 text-sm">Ventas del mes actual</div>
                    </div>
                    <div className="text-cyan-400 text-sm font-medium">Actualizado hace 2 min</div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                      <div className="text-white/60 text-xs mb-1">Ventas Hoy</div>
                      <div className="text-white font-bold text-lg">$2.4M</div>
                      <div className="text-green-400 text-xs flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        +12.5%
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                      <div className="text-white/60 text-xs mb-1">Vehículos Vendidos</div>
                      <div className="text-white font-bold text-lg">23</div>
                      <div className="text-green-400 text-xs flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        +8.2%
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                      <div className="text-white/60 text-xs mb-1">Conversión</div>
                      <div className="text-white font-bold text-lg">18.5%</div>
                      <div className="text-cyan-400 text-xs flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Meta: 15%
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                      <div className="text-white/60 text-xs mb-1">Ticket Promedio</div>
                      <div className="text-white font-bold text-lg">$104K</div>
                      <div className="text-green-400 text-xs flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        +5.1%
                      </div>
                    </div>
                  </div>

                  {/* Top Performers */}
                  <div className="mb-4">
                    <div className="text-white font-semibold text-sm mb-2">Top Vendedores</div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center bg-slate-700/50 p-2 rounded">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">1</span>
                          </div>
                          <span className="text-white text-sm">María González</span>
                        </div>
                        <span className="text-cyan-400 text-sm font-medium">$890K</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-700/50 p-2 rounded">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">2</span>
                          </div>
                          <span className="text-white text-sm">Carlos Ruiz</span>
                        </div>
                        <span className="text-cyan-400 text-sm font-medium">$720K</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="text-center">
                    <div className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-2 rounded-lg inline-block text-sm font-medium hover:from-cyan-600 hover:to-blue-700 transition-all duration-200 cursor-pointer">
                      Ver Reporte Completo
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Integración con Canales */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Globe className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Integración con Canales de Venta</h3>
              <p className="text-white/85 leading-relaxed mb-8">
                Sincroniza tu inventario con tu web e Instagram para que todo esté conectado.
              </p>
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-600 shadow-2xl">
                <div className="text-left">
                  <div className="text-cyan-400 text-sm mb-2 flex items-center gap-1">
                    <span>Configuración</span>
                    <span>&gt;</span>
                    <span>Redes sociales</span>
                  </div>
                  <div className="text-white font-bold text-lg mb-4">Redes sociales</div>
                  <div className="space-y-3">
                    <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 flex items-center gap-3 hover:bg-slate-700/70 transition-colors">
                      <div className="w-10 h-10 bg-gradient-to-br from-pink-500 via-purple-500 to-orange-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      </div>
                      <span className="text-white font-medium">Instagram</span>
                    </div>
                    <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 flex items-center gap-3 hover:bg-slate-700/70 transition-colors">
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </div>
                      <span className="text-white font-medium">Facebook</span>
                    </div>
                    <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 flex items-center gap-3 hover:bg-slate-700/70 transition-colors">
                      <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                        </svg>
                      </div>
                      <span className="text-white font-medium">WhatsApp</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="text-center mt-16">
            <Button 
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-4 text-lg font-semibold"
              onClick={() => window.location.href = '/register'}
            >
              Simplifica tu gestión ahora →
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-black relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight">
              HERRAMIENTAS QUE
              <span className="block text-cyan-400 font-black">
                TRANSFORMAN
              </span>
              TU NEGOCIO
            </h2>
            <p className="text-xl md:text-2xl text-white/90 max-w-4xl mx-auto font-light leading-relaxed tracking-wide">
              Todo lo que necesitas para dominar el mercado automotriz
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {keyFeatures.map((feature, index) => (
              <Card key={index} className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 transition-all duration-300">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
                    {feature.title}
                  </h3>
                  <p className="text-white/85 leading-relaxed font-light text-sm">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section id="video-demo" className="py-20 px-4 bg-black relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-cyan-500/20 text-cyan-400 border-cyan-400/30">
              🎥 Ve SKALE en acción
            </Badge>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight">
              DESCUBRE CÓMO
              <span className="block text-cyan-400 font-black">
                FUNCIONA SKALE
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-white/90 max-w-4xl mx-auto font-light leading-relaxed tracking-wide">
              Mira en 3 minutos cómo SKALE puede transformar tu automotora
            </p>
          </div>

          {/* Video Container */}
          <div className="max-w-5xl mx-auto">
            <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-600 shadow-2xl">
              {/* Video Placeholder - Aquí puedes reemplazar con tu video real */}
              <div className="relative aspect-video bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl overflow-hidden border border-slate-600">
                {/* Video Player */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    {/* Play Button */}
                    <button className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full flex items-center justify-center hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 shadow-2xl mb-4 group">
                      <svg className="w-8 h-8 text-white ml-1 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                    <p className="text-white/80 text-lg font-medium">Ver Demo de SKALE</p>
                    <p className="text-white/60 text-sm mt-2">3:45 minutos</p>
                  </div>
                </div>
                
                {/* Video Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                
                {/* Video Thumbnail/Preview */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                      </svg>
                    </div>
                    <p className="text-white/90 text-sm">SKALE MOTORS</p>
                  </div>
                </div>
              </div>

              {/* Video Description */}
              <div className="mt-8 text-center">
                <h3 className="text-2xl font-bold text-white mb-4">
                  ¿Qué verás en este video?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                  {/* Card 1 - Dashboard */}
                  <div className="group bg-gradient-to-br from-white/10 to-white/5 rounded-xl p-6 border border-white/20 hover:border-cyan-400/50 transition-all duration-300 hover:bg-gradient-to-br hover:from-white/15 hover:to-white/10 hover:shadow-lg hover:shadow-cyan-500/20">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <BarChart3 className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-lg">Dashboard Principal</h4>
                        <p className="text-cyan-400 text-sm font-medium">Métricas en tiempo real</p>
                      </div>
                    </div>
                    <p className="text-white/85 leading-relaxed">
                      Navegación por el dashboard ejecutivo con KPIs automatizados, gráficos interactivos y reportes inteligentes para tomar decisiones estratégicas.
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-green-400 text-xs font-medium">Tiempo real</span>
                    </div>
                  </div>
                  
                  {/* Card 2 - Inventario */}
                  <div className="group bg-gradient-to-br from-white/10 to-white/5 rounded-xl p-6 border border-white/20 hover:border-cyan-400/50 transition-all duration-300 hover:bg-gradient-to-br hover:from-white/15 hover:to-white/10 hover:shadow-lg hover:shadow-cyan-500/20">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <Car className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-lg">Gestión de Inventario</h4>
                        <p className="text-cyan-400 text-sm font-medium">Control total</p>
                      </div>
                    </div>
                    <p className="text-white/85 leading-relaxed">
                      Cómo agregar vehículos, gestionar stock, configurar alertas automáticas y realizar seguimiento completo de tu flota.
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      <span className="text-blue-400 text-xs font-medium">Alertas automáticas</span>
                    </div>
                  </div>
                  
                  {/* Card 3 - CRM */}
                  <div className="group bg-gradient-to-br from-white/10 to-white/5 rounded-xl p-6 border border-white/20 hover:border-cyan-400/50 transition-all duration-300 hover:bg-gradient-to-br hover:from-white/15 hover:to-white/10 hover:shadow-lg hover:shadow-cyan-500/20">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-lg">CRM y Ventas</h4>
                        <p className="text-cyan-400 text-sm font-medium">Conversión optimizada</p>
                      </div>
                    </div>
                    <p className="text-white/85 leading-relaxed">
                      Seguimiento de leads, gestión de clientes, automatización del proceso de ventas y herramientas de fidelización.
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                      <span className="text-purple-400 text-xs font-medium">Automatización</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-3 font-semibold"
                  onClick={() => window.location.href = '/register'}
                >
                  Probar SKALE Gratis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-2 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/50 px-8 py-3 font-semibold"
                  onClick={() => window.location.href = '/login'}
                >
                  Ver Demo Interactivo
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 bg-black relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight">
              ÉXITOS
              <span className="block text-cyan-400 font-black">
                COMPROBADOS
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-white/90 max-w-4xl mx-auto font-light leading-relaxed tracking-wide">
              Más de 500 automotoras ya transformaron su negocio
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 transition-all duration-300">
                <CardContent className="p-8">
                  <div className="flex items-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-white/90 mb-6 font-light leading-relaxed">
                    "{testimonial.content}"
                  </p>
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-4">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="text-white font-semibold">{testimonial.name}</div>
                      <div className="text-white/70 text-sm">{testimonial.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-black relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight">
              PLANES QUE
              <span className="block text-cyan-400 font-black">
                SE ADAPTAN
              </span>
              A TI
            </h2>
            <p className="text-xl md:text-2xl text-white/90 max-w-4xl mx-auto font-light leading-relaxed tracking-wide">
              Elige el plan perfecto para tu automotora
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <Card key={index} className={`bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 transition-all duration-300 relative ${plan.popular ? 'ring-2 ring-cyan-500' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-4 py-1">
                      Más Popular
                    </Badge>
                  </div>
                )}
                <CardContent className="p-8 text-center">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-white/70 mb-6">{plan.description}</p>
                  <div className="mb-8">
                    <span className="text-4xl font-black text-white">{plan.price}</span>
                    <span className="text-white/70">{plan.period}</span>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center text-white/90">
                        <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className={`w-full ${plan.popular ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700' : 'bg-white/20 hover:bg-white/30'} text-white`}
                    onClick={() => window.location.href = '/register'}
                  >
                    Empezar Ahora
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 bg-black relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight">
              PREGUNTAS
              <span className="block text-cyan-400 font-black">
                FRECUENTES
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-white/90 max-w-4xl mx-auto font-light leading-relaxed tracking-wide">
              Todo lo que necesitas saber sobre SKALE
            </p>
          </div>
          
          <div className="space-y-4">
            {faqItems.map((item, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-md border-white/20 rounded-lg overflow-hidden hover:bg-white/15 transition-all duration-300">
                <AccordionItem>
                  <AccordionButton className="w-full p-6 text-left flex items-center justify-between text-white font-semibold text-lg">
                    {item.question}
                  </AccordionButton>
                  <AccordionPanel className="px-6 pb-6">
                    <p className="text-white/90 leading-relaxed">{item.answer}</p>
                  </AccordionPanel>
                </AccordionItem>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final Section */}
      <section className="py-20 px-4 bg-black relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight">
            ¿LISTO PARA
            <span className="block text-cyan-400 font-black">
              REVOLUCIONAR
            </span>
            TU NEGOCIO?
          </h2>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto mb-12 font-light leading-relaxed">
            Únete a más de 500 automotoras que ya transformaron su operación con SKALE
          </p>
          
          {/* Formulario de Contacto Mejorado */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/30 rounded-3xl p-8 md:p-12 shadow-2xl shadow-cyan-500/10">
              {/* Header del Formulario */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-3xl font-bold text-white mb-2">
                  Solicita tu Demo Gratuito
                </h3>
                <p className="text-white/80 text-lg">
                  Descubre cómo SKALEMOTORS puede transformar tu automotora
                </p>
                <div className="flex items-center justify-center gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span className="text-white/70 text-sm">Demo personalizado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span className="text-white/70 text-sm">Sin compromiso</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span className="text-white/70 text-sm">Respuesta en 24h</span>
                  </div>
                </div>
              </div>

              <form className="space-y-8">
                {/* Información Personal */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="group">
                    <label htmlFor="nombre" className="block text-white/90 text-sm font-semibold mb-3 flex items-center gap-2">
                      <User className="h-4 w-4 text-cyan-400" />
                      Nombre Completo *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="nombre"
                        name="nombre"
                        required
                        className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 group-hover:bg-white/15"
                        placeholder="Tu nombre completo"
                      />
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 to-blue-600/0 group-hover:from-cyan-500/5 group-hover:to-blue-600/5 transition-all duration-300 pointer-events-none"></div>
                    </div>
                  </div>
                  
                  <div className="group">
                    <label htmlFor="email" className="block text-white/90 text-sm font-semibold mb-3 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-cyan-400" />
                      Email Corporativo *
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 group-hover:bg-white/15"
                        placeholder="tu@empresa.com"
                      />
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 to-blue-600/0 group-hover:from-cyan-500/5 group-hover:to-blue-600/5 transition-all duration-300 pointer-events-none"></div>
                    </div>
                  </div>
                </div>
                
                {/* Información de la Empresa */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="group">
                    <label htmlFor="empresa" className="block text-white/90 text-sm font-semibold mb-3 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-cyan-400" />
                      Nombre de la Empresa *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="empresa"
                        name="empresa"
                        required
                        className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 group-hover:bg-white/15"
                        placeholder="Tu automotora"
                      />
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 to-blue-600/0 group-hover:from-cyan-500/5 group-hover:to-blue-600/5 transition-all duration-300 pointer-events-none"></div>
                    </div>
                  </div>
                  
                  <div className="group">
                    <label htmlFor="telefono" className="block text-white/90 text-sm font-semibold mb-3 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-cyan-400" />
                      Teléfono
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        id="telefono"
                        name="telefono"
                        className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 group-hover:bg-white/15"
                        placeholder="+56 9 1234 5678"
                      />
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 to-blue-600/0 group-hover:from-cyan-500/5 group-hover:to-blue-600/5 transition-all duration-300 pointer-events-none"></div>
                    </div>
                  </div>
                </div>

                {/* Selector de Tamaño de Empresa */}
                <div className="group">
                  <label htmlFor="tamano" className="block text-white/90 text-sm font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-cyan-400" />
                    Tamaño de tu Automotora
                  </label>
                  <div className="relative">
                    <select
                      id="tamano"
                      name="tamano"
                      className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 group-hover:bg-white/15 appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-slate-800 text-white">Selecciona el tamaño de tu automotora</option>
                      <option value="pequena" className="bg-slate-800 text-white">Pequeña (1-10 vehículos)</option>
                      <option value="mediana" className="bg-slate-800 text-white">Mediana (11-50 vehículos)</option>
                      <option value="grande" className="bg-slate-800 text-white">Grande (51-200 vehículos)</option>
                      <option value="empresa" className="bg-slate-800 text-white">Empresa (200+ vehículos)</option>
                    </select>
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Mensaje */}
                <div className="group">
                  <label htmlFor="mensaje" className="block text-white/90 text-sm font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-cyan-400" />
                    ¿En qué podemos ayudarte?
                  </label>
                  <div className="relative">
                    <textarea
                      id="mensaje"
                      name="mensaje"
                      rows={4}
                      className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 resize-none group-hover:bg-white/15"
                      placeholder="Cuéntanos sobre tu negocio, tus desafíos actuales y cómo podemos ayudarte a crecer..."
                    />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 to-blue-600/0 group-hover:from-cyan-500/5 group-hover:to-blue-600/5 transition-all duration-300 pointer-events-none"></div>
                  </div>
                </div>

                {/* Checkbox de Términos */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="terminos"
                    name="terminos"
                    required
                    className="mt-1 w-5 h-5 text-cyan-500 bg-white/10 border-white/20 rounded focus:ring-cyan-500 focus:ring-2"
                  />
                  <label htmlFor="terminos" className="text-white/80 text-sm leading-relaxed">
                    Al enviar este formulario, acepto los{' '}
                    <a href="#" className="text-cyan-400 hover:text-cyan-300 underline">términos de servicio</a>
                    {' '}y{' '}
                    <a href="#" className="text-cyan-400 hover:text-cyan-300 underline">política de privacidad</a>
                    {' '}de SKALEMOTORS.
                  </label>
                </div>
                
                {/* Botón de Envío */}
                <div className="text-center pt-4">
                  <Button 
                    type="submit"
                    size="lg"
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-12 py-4 text-lg font-semibold w-full md:w-auto shadow-lg hover:shadow-xl hover:shadow-cyan-500/25 transition-all duration-300 transform hover:scale-105"
                  >
                    <Rocket className="mr-2 h-5 w-5" />
                    Solicitar Demo Gratuito
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <p className="text-white/60 text-sm mt-4">
                    🔒 Tus datos están seguros. No compartimos información personal.
                  </p>
                </div>
              </form>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg"
              variant="outline"
              className="border-2 border-white bg-white text-black hover:bg-gray-100 hover:border-gray-200 hover:text-black px-8 py-4 text-lg font-semibold"
              onClick={() => window.location.href = '/login'}
            >
              Ya tengo cuenta - Iniciar Sesión
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-4 bg-black relative z-10 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <span className="text-white font-bold text-xl">SKALEMOTORS</span>
              </div>
              <p className="text-white/85 mb-6 max-w-md font-light leading-relaxed">
                La plataforma integral para gestionar tu automotora. 
                Incrementa ventas, optimiza procesos y crece tu negocio.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-white/70 hover:text-white transition-colors">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href="#" className="text-white/70 hover:text-white transition-colors">
                  <Instagram className="h-5 w-5" />
                </a>
                <a href="#" className="text-white/70 hover:text-white transition-colors">
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Producto</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-white/70 hover:text-white transition-colors">Características</a></li>
                <li><a href="#" className="text-white/70 hover:text-white transition-colors">Precios</a></li>
                <li><a href="#" className="text-white/70 hover:text-white transition-colors">Demo</a></li>
                <li><a href="#" className="text-white/70 hover:text-white transition-colors">Integraciones</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Soporte</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-white/70 hover:text-white transition-colors">Centro de Ayuda</a></li>
                <li><a href="#" className="text-white/70 hover:text-white transition-colors">Contacto</a></li>
                <li><a href="#" className="text-white/70 hover:text-white transition-colors">Estado del Sistema</a></li>
                <li><a href="#" className="text-white/70 hover:text-white transition-colors">API Docs</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 mt-12 pt-8 text-center">
            <p className="text-white/70 font-light">
              © 2024 SKALEMOTORS. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;