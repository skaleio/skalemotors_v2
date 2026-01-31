import DashboardLoader from "@/components/DashboardLoader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { formatCLP } from "@/lib/format";
import { AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Calendar, Car, CheckCircle2, Clock, DollarSign, FileText, Mail, MapPin, Phone, Send, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const categoryLabels: Record<string, string> = {
  nuevo: 'Nuevos',
  usado: 'Usados',
  consignado: 'Consignados'
};

const statusLabels: Record<string, string> = {
  nuevo: 'Nuevos',
  contactado: 'Contactados',
  interesado: 'Interesados',
  cotizando: 'Cotizando',
  negociando: 'Negociando',
  vendido: 'Vendidos',
  perdido: 'Perdidos'
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: stats, isLoading, error } = useDashboardStats(user?.branch_id);

  // Estados para los diálogos
  const [showNewAppointmentDialog, setShowNewAppointmentDialog] = useState(false);
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [showCompleteAppointmentDialog, setShowCompleteAppointmentDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showConfirmTestDriveDialog, setShowConfirmTestDriveDialog] = useState(false);
  const [showContactLeadDialog, setShowContactLeadDialog] = useState(false);
  const [showCallLeadDialog, setShowCallLeadDialog] = useState(false);

  // Estados para los formularios
  const [newAppointment, setNewAppointment] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    appointmentType: 'test_drive',
    date: '',
    time: '',
    vehicle: '',
    notes: ''
  });

  const [quoteData, setQuoteData] = useState({
    clientName: 'Ana Martínez',
    clientEmail: '',
    vehicle: 'Mazda CX-5 2023',
    price: '',
    notes: ''
  });

  const [contactData, setContactData] = useState({
    leadName: '',
    contactMethod: 'phone',
    notes: ''
  });

  console.log('📊 Dashboard - user:', user);
  console.log('📊 Dashboard - stats:', stats);
  console.log('📊 Dashboard - isLoading:', isLoading);
  console.log('📊 Dashboard - error:', error);

  // Funciones para manejar las acciones
  const handleCreateAppointment = () => {
    // TODO: Integrar con Supabase
    toast({
      title: "✅ Cita agendada",
      description: `Cita con ${newAppointment.clientName} agendada para ${newAppointment.date} a las ${newAppointment.time}`,
    });
    setShowNewAppointmentDialog(false);
    setNewAppointment({
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      appointmentType: 'test_drive',
      date: '',
      time: '',
      vehicle: '',
      notes: ''
    });
  };

  const handleSendQuote = () => {
    // TODO: Integrar con Supabase y envío de email
    toast({
      title: "✅ Cotización enviada",
      description: `Cotización enviada a ${quoteData.clientEmail}`,
    });
    setShowQuoteDialog(false);
  };

  const handleCompleteAppointment = () => {
    // TODO: Integrar con Supabase
    toast({
      title: "✅ Cita completada",
      description: "La cita ha sido marcada como completada",
    });
    setShowCompleteAppointmentDialog(false);
  };

  const handleReschedule = () => {
    // TODO: Integrar con Supabase
    toast({
      title: "✅ Cita reagendada",
      description: "La cita ha sido reagendada exitosamente",
    });
    setShowRescheduleDialog(false);
  };

  const handleConfirmTestDrive = () => {
    // TODO: Integrar con Supabase
    toast({
      title: "✅ Test drive confirmado",
      description: "El test drive con Carlos López ha sido confirmado",
    });
    setShowConfirmTestDriveDialog(false);
  };

  const handleContactLead = () => {
    // TODO: Integrar con Supabase
    toast({
      title: "✅ Lead contactado",
      description: `Contacto con ${contactData.leadName} registrado`,
    });
    setShowContactLeadDialog(false);
    setContactData({ leadName: '', contactMethod: 'phone', notes: '' });
  };

  const salesChange = useMemo(() => {
    if (!stats?.salesByMonth || stats.salesByMonth.length < 2) {
      return 0;
    }
    const current = stats.salesByMonth[stats.salesByMonth.length - 1].sales;
    const previous = stats.salesByMonth[stats.salesByMonth.length - 2].sales;
    if (!previous) {
      return 0;
    }
    return ((current - previous) / previous) * 100;
  }, [stats?.salesByMonth]);

  if (isLoading) {
    return <DashboardLoader message="Cargando estadísticas" />;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Vista general de tu automotora
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-green-50/30 dark:from-gray-900 dark:to-green-950/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ventas del Mes</CardTitle>
            </div>
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg shadow-green-500/20">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold tracking-tight">{formatCLP(stats?.salesRevenue || 0)}</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">{stats?.salesThisMonth || 0} vehículos</span>
              {salesChange !== 0 && (
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${salesChange > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                  {salesChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(salesChange).toFixed(1)}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-900 dark:to-blue-950/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inventario</CardTitle>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
              <Car className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold tracking-tight">{stats?.totalVehicles || 0}</div>
            <p className="text-xs text-muted-foreground font-medium">
              {stats?.availableVehicles || 0} disponibles
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-purple-50/30 dark:from-gray-900 dark:to-purple-950/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Leads Activos</CardTitle>
            </div>
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg shadow-purple-500/20">
              <Users className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold tracking-tight">{stats?.activeLeads || 0}</div>
            <p className="text-xs text-muted-foreground font-medium">
              En conversión
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-amber-50/30 dark:from-gray-900 dark:to-amber-950/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Citas</CardTitle>
            </div>
            <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg shadow-amber-500/20">
              <Calendar className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold tracking-tight">{stats?.scheduledAppointments || 0}</div>
            <p className="text-xs text-muted-foreground font-medium">
              Programadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Próximas Citas y Tareas - Lado a lado */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Próximas Citas */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-900 dark:to-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                  Próximas Citas
                </CardTitle>
                <CardDescription className="text-xs">Tus citas programadas</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/appointments')}>
                Ver todas
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {stats?.scheduledAppointments && stats.scheduledAppointments > 0 ? (
              <div className="space-y-4">
                {/* Ejemplo de cita - Reemplazar con datos reales */}
                <div className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col items-center gap-1 min-w-[60px]">
                    <Badge variant="default" className="bg-blue-500">HOY</Badge>
                    <span className="text-2xl font-bold">14:00</span>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Test Drive</h4>
                      <Badge variant="outline">Programada</Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>Juan Pérez</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        <span>Toyota Corolla 2024</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>Sucursal Providencia</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="default" onClick={() => setShowCompleteAppointmentDialog(true)}>
                        Marcar completada
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowRescheduleDialog(true)}>
                        Reagendar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Mensaje si no hay más citas */}
                <div className="text-center py-4 text-sm text-muted-foreground">
                  <p>Tienes {stats.scheduledAppointments} cita(s) programada(s)</p>
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                <Calendar className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No tienes citas programadas</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowNewAppointmentDialog(true)}
                >
                  Agendar nueva cita
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tareas Pendientes */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-900 dark:to-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-orange-500 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-white" />
                  </div>
                  Tareas Pendientes
                </CardTitle>
                <CardDescription className="text-xs">Acciones que requieren tu atención</CardDescription>
              </div>
              <Badge variant="destructive" className="text-sm">3 urgentes</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {/* Tareas Urgentes */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">URGENTE</Badge>
                  <span className="text-sm font-semibold">Requieren atención inmediata</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-sm font-medium">Contactar a Juan Pérez</p>
                      <p className="text-xs text-muted-foreground">Lead nuevo sin contactar - Hace 2 horas</p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-shrink-0"
                      onClick={() => {
                        setContactData({ ...contactData, leadName: 'Juan Pérez' });
                        setShowContactLeadDialog(true);
                      }}
                    >
                      Contactar
                    </Button>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
                    <Clock className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-sm font-medium">Seguimiento vencido: María González</p>
                      <p className="text-xs text-muted-foreground">Último contacto hace 8 días</p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-shrink-0"
                      onClick={() => {
                        setContactData({ ...contactData, leadName: 'María González' });
                        setShowCallLeadDialog(true);
                      }}
                    >
                      Llamar
                    </Button>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
                    <Calendar className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-sm font-medium">Confirmar test drive Carlos López</p>
                      <p className="text-xs text-muted-foreground">Programado para mañana - Sin confirmar</p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-shrink-0"
                      onClick={() => setShowConfirmTestDriveDialog(true)}
                    >
                      Confirmar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tareas de Hoy */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">HOY</Badge>
                  <span className="text-sm font-semibold">Para completar hoy</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-sm font-medium">Enviar cotización a Ana Martínez</p>
                      <p className="text-xs text-muted-foreground">Mazda CX-5 2023 - Solicitada ayer</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0"
                      onClick={() => setShowQuoteDialog(true)}
                    >
                      Enviar
                    </Button>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <Users className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-sm font-medium">Llamar a Pedro Sánchez</p>
                      <p className="text-xs text-muted-foreground">Seguimiento programado para hoy</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0"
                      onClick={() => {
                        setContactData({ ...contactData, leadName: 'Pedro Sánchez' });
                        setShowCallLeadDialog(true);
                      }}
                    >
                      Llamar
                    </Button>
                  </div>
                </div>
              </div>

              <div className="text-center pt-4 border-t">
                <Button variant="link" onClick={() => navigate('/leads')}>
                  Ver todas las tareas →
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ventas por Mes */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-900 dark:to-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  Tendencia de Ventas
                </CardTitle>
                <CardDescription className="text-xs">Últimos 6 meses</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {stats?.salesByMonth && stats.salesByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={stats.salesByMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      padding: '12px'
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'sales') return [value, 'Ventas'];
                      return [formatCLP(value), 'Ingresos'];
                    }}
                    labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', r: 4, strokeWidth: 3, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff' }}
                    fill="url(#colorSales)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay datos de ventas disponibles</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventario por Categoría */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-900 dark:to-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <BarChart3 className="h-4 w-4 text-white" />
                  </div>
                  Distribución de Inventario
                </CardTitle>
                <CardDescription className="text-xs">Por categoría de vehículo</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {stats?.vehiclesByCategory && stats.vehiclesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={stats.vehiclesByCategory.map(item => ({
                      ...item,
                      name: categoryLabels[item.category] || item.category
                    }))}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                      const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="white"
                          textAnchor={x > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          className="text-xs font-bold"
                        >
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                    paddingAngle={3}
                  >
                    {stats.vehiclesByCategory.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        stroke="hsl(var(--background))"
                        strokeWidth={3}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      padding: '12px'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span className="text-xs font-medium">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <Car className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay vehículos en inventario</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leads por Estado y Ventas Recientes */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Ventas Recientes */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-900 dark:to-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-amber-500 rounded-lg">
                    <DollarSign className="h-4 w-4 text-white" />
                  </div>
                  Ventas Recientes
                </CardTitle>
                <CardDescription className="text-xs">Últimas 5 transacciones</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {stats?.recentSales && stats.recentSales.length > 0 ? (
              <div className="space-y-3">
                {stats.recentSales.map((sale, index) => (
                  <div
                    key={sale.id}
                    className="group flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-green-500/30 hover:bg-green-50/30 dark:hover:bg-green-950/10 transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20 text-white font-bold text-sm flex-shrink-0">
                        {index + 1}
                        <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <p className="text-sm font-semibold tracking-tight">{sale.vehicle}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium">
                            <Users className="h-3 w-3" />
                            {sale.seller}
                          </span>
                          <span className="text-muted-foreground/50">•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(sale.date).toLocaleDateString('es-CL', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-bold text-green-600 dark:text-green-400 tracking-tight">
                        {formatCLP(sale.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <DollarSign className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay ventas recientes</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads por Estado */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-900 dark:to-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  Pipeline de Ventas
                </CardTitle>
                <CardDescription className="text-xs">Leads por estado</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {stats?.leadsByStatus && stats.leadsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={stats.leadsByStatus.map(item => ({
                    ...item,
                    name: statusLabels[item.status] || item.status
                  }))}
                  margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
                >
                  <defs>
                    <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.6}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 500 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      padding: '12px'
                    }}
                    formatter={(value: any) => [value, 'Leads']}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                    labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                  />
                  <Bar
                    dataKey="count"
                    fill="url(#colorBar)"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <Users className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay leads registrados</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Diálogos */}
      {/* Diálogo: Agendar Nueva Cita */}
      <Dialog open={showNewAppointmentDialog} onOpenChange={setShowNewAppointmentDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Agendar Nueva Cita
            </DialogTitle>
            <DialogDescription>
              Completa los datos para agendar una nueva cita con un cliente
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Nombre del cliente *</Label>
                <Input
                  id="clientName"
                  placeholder="Ej: Juan Pérez"
                  value={newAppointment.clientName}
                  onChange={(e) => setNewAppointment({ ...newAppointment, clientName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientPhone">Teléfono *</Label>
                <Input
                  id="clientPhone"
                  placeholder="+56 9 1234 5678"
                  value={newAppointment.clientPhone}
                  onChange={(e) => setNewAppointment({ ...newAppointment, clientPhone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Email</Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="cliente@ejemplo.com"
                value={newAppointment.clientEmail}
                onChange={(e) => setNewAppointment({ ...newAppointment, clientEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointmentType">Tipo de cita *</Label>
              <Select
                value={newAppointment.appointmentType}
                onValueChange={(value) => setNewAppointment({ ...newAppointment, appointmentType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test_drive">Test Drive</SelectItem>
                  <SelectItem value="cotizacion">Cotización</SelectItem>
                  <SelectItem value="entrega">Entrega de Vehículo</SelectItem>
                  <SelectItem value="servicio">Servicio Técnico</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Fecha *</Label>
                <Input
                  id="date"
                  type="date"
                  value={newAppointment.date}
                  onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Hora *</Label>
                <Input
                  id="time"
                  type="time"
                  value={newAppointment.time}
                  onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehículo de interés</Label>
              <Input
                id="vehicle"
                placeholder="Ej: Toyota Corolla 2024"
                value={newAppointment.vehicle}
                onChange={(e) => setNewAppointment({ ...newAppointment, vehicle: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas adicionales</Label>
              <Textarea
                id="notes"
                placeholder="Información adicional sobre la cita..."
                value={newAppointment.notes}
                onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewAppointmentDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateAppointment}>
              <Calendar className="h-4 w-4 mr-2" />
              Agendar Cita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Enviar Cotización */}
      <Dialog open={showQuoteDialog} onOpenChange={setShowQuoteDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              Enviar Cotización
            </DialogTitle>
            <DialogDescription>
              Confirma los datos antes de enviar la cotización al cliente
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quoteClientName">Cliente</Label>
              <Input
                id="quoteClientName"
                value={quoteData.clientName}
                onChange={(e) => setQuoteData({ ...quoteData, clientName: e.target.value })}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quoteClientEmail">Email del cliente *</Label>
              <Input
                id="quoteClientEmail"
                type="email"
                placeholder="cliente@ejemplo.com"
                value={quoteData.clientEmail}
                onChange={(e) => setQuoteData({ ...quoteData, clientEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quoteVehicle">Vehículo</Label>
              <Input
                id="quoteVehicle"
                value={quoteData.vehicle}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quotePrice">Precio cotizado *</Label>
              <Input
                id="quotePrice"
                placeholder="Ej: 15000000"
                value={quoteData.price}
                onChange={(e) => setQuoteData({ ...quoteData, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quoteNotes">Notas adicionales</Label>
              <Textarea
                id="quoteNotes"
                placeholder="Condiciones especiales, descuentos, etc..."
                value={quoteData.notes}
                onChange={(e) => setQuoteData({ ...quoteData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuoteDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendQuote}>
              <Send className="h-4 w-4 mr-2" />
              Enviar Cotización
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Marcar Cita como Completada */}
      <Dialog open={showCompleteAppointmentDialog} onOpenChange={setShowCompleteAppointmentDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Marcar Cita como Completada
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas marcar esta cita como completada?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-semibold">Test Drive</p>
              <p className="text-xs text-muted-foreground">Cliente: Juan Pérez</p>
              <p className="text-xs text-muted-foreground">Vehículo: Toyota Corolla 2024</p>
              <p className="text-xs text-muted-foreground">Fecha: Hoy, 14:00</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteAppointmentDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCompleteAppointment}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Marcar como Completada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Reagendar Cita */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              Reagendar Cita
            </DialogTitle>
            <DialogDescription>
              Selecciona una nueva fecha y hora para la cita
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-semibold">Cita actual</p>
              <p className="text-xs text-muted-foreground">Test Drive - Juan Pérez</p>
              <p className="text-xs text-muted-foreground">Hoy, 14:00</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rescheduleDate">Nueva fecha *</Label>
                <Input
                  id="rescheduleDate"
                  type="date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rescheduleTime">Nueva hora *</Label>
                <Input
                  id="rescheduleTime"
                  type="time"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rescheduleReason">Motivo del cambio</Label>
              <Textarea
                id="rescheduleReason"
                placeholder="Razón por la que se reagenda la cita..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRescheduleDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleReschedule}>
              <Calendar className="h-4 w-4 mr-2" />
              Reagendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Confirmar Test Drive */}
      <Dialog open={showConfirmTestDriveDialog} onOpenChange={setShowConfirmTestDriveDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Confirmar Test Drive
            </DialogTitle>
            <DialogDescription>
              Confirma el test drive con el cliente
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-semibold">Test Drive - Carlos López</p>
              <p className="text-xs text-muted-foreground">Programado para: Mañana</p>
              <p className="text-xs text-muted-foreground">Estado: Sin confirmar</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNotes">Notas de confirmación</Label>
              <Textarea
                id="confirmNotes"
                placeholder="Detalles adicionales para el cliente..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmTestDriveDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmTestDrive}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirmar Test Drive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Contactar Lead */}
      <Dialog open={showContactLeadDialog} onOpenChange={setShowContactLeadDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              Registrar Contacto con Lead
            </DialogTitle>
            <DialogDescription>
              Registra el contacto realizado con {contactData.leadName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contactMethod">Método de contacto *</Label>
              <Select
                value={contactData.contactMethod}
                onValueChange={(value) => setContactData({ ...contactData, contactMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Teléfono</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactNotes">Resumen del contacto *</Label>
              <Textarea
                id="contactNotes"
                placeholder="¿Qué se habló? ¿Cuál es el siguiente paso?..."
                value={contactData.notes}
                onChange={(e) => setContactData({ ...contactData, notes: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactLeadDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleContactLead}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Registrar Contacto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Llamar Lead */}
      <Dialog open={showCallLeadDialog} onOpenChange={setShowCallLeadDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-500" />
              Registrar Llamada
            </DialogTitle>
            <DialogDescription>
              Registra la llamada realizada con {contactData.leadName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                💡 Tip: Registra los puntos clave de la conversación y define el próximo paso
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="callNotes">Resumen de la llamada *</Label>
              <Textarea
                id="callNotes"
                placeholder="¿Qué se habló? ¿Mostró interés? ¿Cuál es el siguiente paso?..."
                value={contactData.notes}
                onChange={(e) => setContactData({ ...contactData, notes: e.target.value })}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCallLeadDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleContactLead}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Registrar Llamada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
