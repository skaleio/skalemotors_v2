import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OptimizedStarsBackground } from "@/components/OptimizedStarsBackground";
import {
  Menu, X, ArrowRight, Car, Users, TrendingUp, Clock,
  CheckCircle, Star, Phone, Mail, Facebook, Instagram,
  Linkedin, DollarSign, Calendar, Globe, BarChart3,
  FileText, Zap, Shield, Plus, ChevronDown, ChevronUp
} from "lucide-react";

/* ─────────────────────────────────────────────
   APPOINTMENT CALENDAR (animated)
───────────────────────────────────────────── */
function AppointmentCalendar() {
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [notifVisible, setNotifVisible] = useState(false);
  const [notifDay, setNotifDay] = useState(0);
  const [pulse, setPulse] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const days = ["L", "M", "X", "J", "V", "S", "D"];
  const weeks = [[1,2,3,4,5,6,7],[8,9,10,11,12,13,14],[15,16,17,18,19,20,21],[22,23,24,25,26,27,28]];
  const appointments: Record<number, { label: string; color: string; car: string; type: string }> = {
    5:  { label: "10:00", color: "bg-pink-500",   car: "Toyota Corolla", type: "Test Drive" },
    12: { label: "15:30", color: "bg-violet-500", car: "BMW X3",         type: "Entrega"    },
    19: { label: "09:00", color: "bg-pink-400",   car: "Hyundai Tucson", type: "Test Drive" },
    20: { label: "11:00", color: "bg-rose-400",   car: "Audi A4",        type: "Revisión"   },
    26: { label: "16:00", color: "bg-violet-400", car: "Ford Ranger",    type: "Test Drive" },
  };

  useEffect(() => {
    const apptDays = Object.keys(appointments).map(Number);
    let i = 0;
    const show = () => {
      const day = apptDays[i % apptDays.length];
      setActiveDay(day); setNotifDay(day); setNotifVisible(true); setPulse(true);
      setTimeout(() => setPulse(false), 800);
      timerRef.current = setTimeout(() => {
        setNotifVisible(false);
        timerRef.current = setTimeout(() => { i++; show(); }, 1400);
      }, 3000);
    };
    const init = setTimeout(show, 900);
    return () => { clearTimeout(init); if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const today = 15;

  return (
    <div className="bg-[#0d0d11] rounded-3xl p-5 border border-white/8 shadow-[0_0_60px_-10px_rgba(236,72,153,0.15)] w-full max-w-[380px] mx-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white font-bold text-sm">Agenda de Citas</p>
          <p className="text-white/40 text-[11px]">Marzo 2026</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center">
            <ChevronDown className="h-3 w-3 text-white/40" />
          </div>
          <div className="w-7 h-7 rounded-full bg-pink-500 flex items-center justify-center shadow-[0_0_10px_rgba(236,72,153,0.6)]">
            <Plus className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
      </div>

      {/* Notification */}
      <div className={`overflow-hidden transition-all duration-500 ease-out ${notifVisible ? "max-h-20 opacity-100 mb-4" : "max-h-0 opacity-0 mb-0"}`}>
        <div className={`flex items-center gap-3 bg-pink-500/10 border ${pulse ? "border-pink-500/80 shadow-[0_0_12px_rgba(236,72,153,0.3)]" : "border-pink-500/30"} rounded-2xl px-3 py-2.5 transition-all duration-300`}>
          <div className="w-9 h-9 bg-pink-500 rounded-xl flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(236,72,153,0.5)]">
            <Car className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold truncate">{appointments[notifDay]?.type} — {appointments[notifDay]?.car}</p>
            <p className="text-pink-400 text-[11px] mt-0.5">Día {notifDay} · {appointments[notifDay]?.label} hrs</p>
          </div>
          <span className="text-[10px] bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full font-medium shrink-0 border border-pink-500/30">Nuevo</span>
        </div>
      </div>

      {/* Days header */}
      <div className="grid grid-cols-7 mb-2">
        {days.map(d => <div key={d} className="text-center text-[10px] text-white/25 font-medium py-1">{d}</div>)}
      </div>

      {/* Grid */}
      <div className="space-y-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map(day => {
              const appt = appointments[day];
              const isToday = day === today;
              const isActive = day === activeDay;
              return (
                <div key={day} className={`relative rounded-xl flex flex-col items-center justify-start pt-1.5 pb-2 min-h-[42px] transition-all duration-300
                  ${isToday ? "bg-violet-600/40 ring-1 ring-violet-400/50" : "bg-white/4 hover:bg-white/8"}
                  ${isActive ? "ring-2 ring-pink-500/80 scale-105 z-10 bg-pink-500/15 shadow-[0_0_14px_rgba(236,72,153,0.3)]" : ""}
                `}>
                  <span className={`text-[11px] font-bold leading-none mb-1.5 ${isToday ? "text-violet-300" : isActive ? "text-white" : "text-white/40"}`}>{day}</span>
                  {appt && (
                    <div className={`w-4/5 h-[3px] rounded-full ${appt.color} transition-all duration-300 ${isActive ? "shadow-[0_0_8px_2px_rgba(236,72,153,0.7)]" : "opacity-70"}`} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-white/6 flex items-center justify-between">
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-pink-500" /><span className="text-white/40 text-[10px]">Test Drive</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-violet-500" /><span className="text-white/40 text-[10px]">Entrega</span></div>
        </div>
        <span className="text-pink-400 text-[10px] font-medium">5 citas este mes</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   STAT COUNTER (animated)
───────────────────────────────────────────── */
/* hook reutilizable: cuenta desde 0 hasta `end` cuando el elemento entra en viewport */
function useCountUp(end: number, duration = 2000, decimals = 0) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const steps = 60;
      const inc = end / steps;
      let cur = 0;
      const timer = setInterval(() => {
        cur = Math.min(cur + inc, end);
        setValue(parseFloat(cur.toFixed(decimals)));
        if (cur >= end) clearInterval(timer);
      }, duration / steps);
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [end, duration, decimals]);
  return { value, ref };
}

function MetricCard({ label, end, format, delta }: { label: string; end: number; format: (v: number) => string; delta: string }) {
  const { value, ref } = useCountUp(end, 2200, end % 1 !== 0 ? 1 : 0);
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="bg-white/4 rounded-2xl p-3.5 border border-white/6">
      <p className="text-white/40 text-[11px] mb-1">{label}</p>
      <p className="text-white font-bold text-lg leading-none mb-1 tabular-nums">{format(value)}</p>
      <p className="text-[11px] flex items-center gap-1 text-green-400">
        <TrendingUp className="h-3 w-3" />{delta}
      </p>
    </div>
  );
}

function SellerRow({ rank, name, end, color }: { rank: string; name: string; end: number; color: string }) {
  const { value, ref } = useCountUp(end, 2600);
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className={`w-6 h-6 ${color} rounded-full flex items-center justify-center shrink-0`}>
          <span className="text-white text-[10px] font-black">{rank}</span>
        </div>
        <span className="text-white/70 text-xs font-medium">{name}</span>
      </div>
      <span className="text-pink-400 text-xs font-bold tabular-nums">${Math.round(value).toLocaleString()}K</span>
    </div>
  );
}

function DashboardMetrics() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <MetricCard label="Ventas hoy"        end={2.4}  format={v=>`$${v.toFixed(1)}M`} delta="+12.5%" />
        <MetricCard label="Vehículos vendidos" end={23}   format={v=>`${v}`}              delta="+8.2%"  />
        <MetricCard label="Tasa conversión"    end={18.5} format={v=>`${v.toFixed(1)}%`}  delta="Meta: 15%" />
        <MetricCard label="Ticket promedio"    end={104}  format={v=>`$${v}K`}            delta="+5.1%"  />
      </div>
      <div className="bg-white/3 rounded-2xl p-3.5 border border-white/6">
        <p className="text-white/40 text-[11px] mb-3">Top Vendedores — Marzo</p>
        <div className="space-y-2.5">
          <SellerRow rank="1" name="María González" end={890} color="bg-pink-500"   />
          <SellerRow rank="2" name="Carlos Ruiz"    end={720} color="bg-violet-500" />
          <SellerRow rank="3" name="Ana Torres"     end={610} color="bg-rose-400"   />
        </div>
      </div>
    </>
  );
}

function StatCounter({ end, suffix, label }: { end: number; suffix: string; label: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const duration = 1800;
      const steps = 60;
      const increment = end / steps;
      let current = 0;
      const timer = setInterval(() => {
        current = Math.min(current + increment, end);
        setCount(Math.round(current));
        if (current >= end) clearInterval(timer);
      }, duration / steps);
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl md:text-5xl font-black text-white mb-1 tabular-nums">
        {count.toLocaleString()}<span className="text-pink-400">{suffix}</span>
      </div>
      <p className="text-white/40 text-sm">{label}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CRM PIPELINE (animated)
───────────────────────────────────────────── */
type PipelineLead = { id: number; name: string; car: string; avatar: string; source: string; hot?: boolean };
type PipelineStage = { id: string; label: string; color: string; dot: string; leads: PipelineLead[] };

const INITIAL_PIPELINE: PipelineStage[] = [
  {
    id:"nuevo", label:"Nuevo", color:"border-white/10 bg-white/3", dot:"bg-white/30",
    leads:[
      { id:1, name:"Carlos M.", car:"Toyota Corolla 2023", avatar:"CM", source:"Instagram", hot:true },
      { id:2, name:"Daniela P.", car:"Hyundai Tucson", avatar:"DP", source:"Facebook" },
    ],
  },
  {
    id:"contactado", label:"Contactado", color:"border-pink-500/20 bg-pink-500/5", dot:"bg-pink-400",
    leads:[
      { id:3, name:"Rodrigo S.", car:"BMW X3 xDrive", avatar:"RS", source:"WhatsApp", hot:true },
    ],
  },
  {
    id:"interes", label:"Interesado", color:"border-violet-500/20 bg-violet-500/5", dot:"bg-violet-400",
    leads:[
      { id:4, name:"Valentina G.", car:"Audi A4 2022", avatar:"VG", source:"Chile Autos" },
      { id:5, name:"Felipe O.", car:"Ford Ranger 4x4", avatar:"FO", source:"Mercado Libre" },
    ],
  },
  {
    id:"negociacion", label:"Negociación", color:"border-amber-500/20 bg-amber-500/5", dot:"bg-amber-400",
    leads:[
      { id:6, name:"Javiera T.", car:"Kia Sportage", avatar:"JT", source:"Instagram" },
    ],
  },
  {
    id:"cerrado", label:"Cerrado ✓", color:"border-green-500/20 bg-green-500/5", dot:"bg-green-400",
    leads:[],
  },
];

function CRMPipeline() {
  const [pipeline, setPipeline] = useState<PipelineStage[]>(INITIAL_PIPELINE);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ name: string; from: string; to: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stageOrder = ["nuevo","contactado","interes","negociacion","cerrado"];

  useEffect(() => {
    const tick = () => {
      setPipeline(prev => {
        // Si todos los leads llegaron a "cerrado", reinicia
        const totalLeads = prev.reduce((acc, s) => acc + s.leads.length, 0);
        const closedLeads = prev.find(s => s.id === "cerrado")?.leads.length ?? 0;
        if (totalLeads === closedLeads) {
          setTimeout(() => setPipeline(INITIAL_PIPELINE), 1200);
          return prev;
        }

        // Avanza el lead más rezagado: busca la etapa más a la derecha (sin cerrado) que tenga leads
        let pickStageIdx = -1;
        for (let si = prev.length - 2; si >= 0; si--) {
          if (prev[si].leads.length > 0) { pickStageIdx = si; break; }
        }
        if (pickStageIdx === -1) return prev;

        const lead = prev[pickStageIdx].leads[prev[pickStageIdx].leads.length - 1];
        const nextStageIdx = pickStageIdx + 1;

        setMovingId(lead.id);
        setNotification({ name: lead.name, from: prev[pickStageIdx].label, to: prev[nextStageIdx].label });

        const next = prev.map((s, si) => {
          if (si === pickStageIdx) return { ...s, leads: s.leads.slice(0, -1) };
          if (si === nextStageIdx) return { ...s, leads: [lead, ...s.leads] };
          return s;
        });

        setTimeout(() => { setMovingId(null); setNotification(null); }, 1800);
        return next;
      });
    };

    intervalRef.current = setInterval(tick, 2800);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const sourceColors: Record<string, string> = {
    Instagram:"bg-pink-500/20 text-pink-300 border-pink-500/30",
    Facebook:"bg-blue-500/20 text-blue-300 border-blue-500/30",
    WhatsApp:"bg-green-500/20 text-green-300 border-green-500/30",
    "Chile Autos":"bg-red-500/20 text-red-300 border-red-500/30",
    "Mercado Libre":"bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  };

  return (
    <div className="relative">
      {/* Notification toast */}
      <div className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 transition-all duration-500 ${notification ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}`}>
        <div className="flex items-center gap-2.5 bg-white/8 backdrop-blur-xl border border-white/12 rounded-full px-4 py-2 shadow-xl whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
          <span className="text-white/70 text-xs">
            <span className="text-white font-semibold">{notification?.name}</span>
            {" avanzó a "}
            <span className="text-pink-400 font-semibold">{notification?.to}</span>
          </span>
          <Zap className="h-3 w-3 text-pink-400" />
        </div>
      </div>

      {/* Pipeline columns */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {pipeline.map((stage) => (
          <div key={stage.id} className={`rounded-2xl border p-3 ${stage.color} transition-all duration-300`}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
              <span className="text-white/70 text-[11px] font-semibold tracking-wide">{stage.label}</span>
              <span className="ml-auto text-white/30 text-[10px] bg-white/6 rounded-full px-2 py-0.5">{stage.leads.length}</span>
            </div>

            {/* Cards */}
            <div className="space-y-2 min-h-[80px]">
              {stage.leads.map(lead => (
                <div
                  key={lead.id}
                  className={`bg-white/5 border rounded-xl p-2.5 transition-all duration-500 ${movingId === lead.id ? "scale-95 opacity-60 border-pink-500/40" : "border-white/8 hover:border-white/16 hover:bg-white/8"}`}
                >
                  <div className="flex items-start gap-2 mb-1.5">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black text-white shrink-0 ${lead.hot ? "bg-gradient-to-br from-pink-500 to-rose-600" : "bg-white/15"}`}>
                      {lead.avatar}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-[10px] font-semibold leading-tight truncate">{lead.name}</p>
                      <p className="text-white/35 text-[9px] truncate leading-tight">{lead.car}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[8px] border rounded-full px-1.5 py-0.5 ${sourceColors[lead.source] || "bg-white/10 text-white/40 border-white/10"}`}>{lead.source}</span>
                  </div>
                </div>
              ))}
              {stage.leads.length === 0 && (
                <div className="border border-dashed border-white/8 rounded-xl h-14 flex items-center justify-center">
                  <span className="text-white/15 text-[10px]">Sin leads</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="mt-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          {[{c:"bg-pink-400",l:"Hot lead"},{c:"bg-amber-400",l:"En negociación"},{c:"bg-green-400",l:"Cerrado"}].map(({c,l})=>(
            <div key={l} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${c}`} />
              <span className="text-white/30 text-[10px]">{l}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/30 text-[10px]">Pipeline en tiempo real</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FAQ ITEM
───────────────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen(!open)} className="w-full text-left">
      <div className={`border rounded-2xl transition-all duration-300 overflow-hidden ${open ? "border-pink-500/40 bg-pink-500/5" : "border-white/10 bg-white/3 hover:border-white/20"}`}>
        <div className="flex items-center justify-between px-6 py-5 gap-4">
          <span className="text-white font-medium text-sm md:text-base">{q}</span>
          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${open ? "bg-pink-500 text-white" : "bg-white/10 text-white/40"}`}>
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </div>
        </div>
        <div className={`px-6 overflow-hidden transition-all duration-300 ${open ? "max-h-40 pb-5 opacity-100" : "max-h-0 opacity-0"}`}>
          <p className="text-white/60 text-sm leading-relaxed">{a}</p>
        </div>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────
   MAIN LANDING
───────────────────────────────────────────── */
const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  const features = [
    { icon: Car,       title: "Inventario Inteligente",   desc: "Control total de tu flota con alertas automáticas, predicción de rotación y análisis en tiempo real." },
    { icon: Users,     title: "CRM Automotriz",           desc: "Pipeline visual de leads, seguimiento automático y herramientas de conversión integradas." },
    { icon: BarChart3, title: "Analytics Ejecutivo",      desc: "KPIs, reportes y dashboards diseñados para gerentes que toman decisiones basadas en datos." },
    { icon: Calendar,  title: "Agenda Inteligente",       desc: "Test drives, entregas y reuniones que se agendan solos con recordatorios automáticos." },
    { icon: Globe,     title: "Canales de Venta",         desc: "Publica en Instagram, Facebook Marketplace y Chile Autos con un solo clic desde la plataforma." },
    { icon: DollarSign,title: "Finanzas Integradas",      desc: "Comisiones, gastos, facturación electrónica y flujo de caja en un solo panel." },
  ];

  const testimonials = [
    { name: "Carlos Mendoza", role: "CEO · AutoMax Santiago", content: "Triplicamos la velocidad de cierre de ventas. El CRM y el dashboard son una locura de potentes.", rating: 5, avatar: "CM" },
    { name: "María González",  role: "Gerente · CarDealer Pro",  content: "Pasamos de manejar todo en Excel a tener visibilidad total. El cambio fue inmediato y brutal.", rating: 5, avatar: "MG" },
    { name: "Roberto Silva",   role: "Director · AutoCenter",    content: "ROI recuperado en 3 meses. Ahora abrimos la segunda sucursal con confianza gracias a SKALE.", rating: 5, avatar: "RS" },
  ];


  const faqs = [
    { q: "¿Cuánto tiempo toma implementar SKALE?", a: "La mayoría de automotoras están operando en menos de 48 horas. Nuestro equipo te acompaña en la migración sin interrumpir tu operación actual." },
    { q: "¿Puedo importar mis datos desde Excel o Google Sheets?", a: "Sí. Tenemos importadores inteligentes para inventario, clientes y leads. El proceso es guiado y no requiere conocimientos técnicos." },
    { q: "¿Funciona para multisucursal?", a: "Absolutamente. SKALE tiene gestión multisucursal nativa con permisos por roles y visibilidad consolidada para la gerencia." },
    { q: "¿Tienen app móvil?", a: "Sí, la plataforma es 100% responsive. También tenemos app nativa (iOS y Android) incluida en todos los planes." },
    { q: "¿Puedo cancelar cuando quiera?", a: "Sí, sin penalizaciones. Tus datos quedan disponibles por 30 días para exportarlos. Pero la mayoría que prueba SKALE no se va." },
  ];

  return (
    <div className="min-h-screen bg-[#060608] relative overflow-x-hidden">
      <OptimizedStarsBackground className="fixed inset-0 z-0" starColor="#a78bfa" factor={0.015} speed={120} transition={{ stiffness: 20, damping: 12 }} />

      {/* ── AMBIENT GLOWS ── */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-pink-500/8 blur-[120px] pointer-events-none z-0" />
      <div className="fixed top-1/3 left-0 w-[400px] h-[400px] bg-violet-600/6 blur-[100px] pointer-events-none z-0" />

      {/* ──────────────────── HEADER ──────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50">
        <div className="mx-4 mt-4 rounded-2xl bg-white/4 backdrop-blur-xl border border-white/8 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
          <div className="max-w-7xl mx-auto px-5 py-3.5 grid grid-cols-3 items-center">
            {/* Nav desktop / placeholder mobile */}
            <nav className="hidden md:flex items-center gap-8">
              {[["Características","features"],["Clientes","testimonials"],["FAQ","faq"]].map(([l,id])=>(
                <button key={id} onClick={()=>scrollTo(id)} className="text-white/60 hover:text-white text-sm font-medium transition-colors duration-200">{l}</button>
              ))}
            </nav>
            <div className="md:hidden" />

            {/* Logo — center column */}
            <div className="flex justify-center">
              <span className="skale-logo text-xl tracking-[0.18em]">SKALEMOTORS</span>
            </div>

            {/* CTA desktop / Hamburger mobile */}
            <div className="flex items-center justify-end gap-3">
              <div className="hidden md:flex items-center gap-3">
                <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/8 text-sm h-9 px-4" onClick={()=>window.location.href='/login'}>Iniciar sesión</Button>
                <Button className="bg-pink-500 hover:bg-pink-600 text-white text-sm h-9 px-5 rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-all duration-200 hover:shadow-[0_0_28px_rgba(236,72,153,0.45)] hover:scale-105" onClick={()=>window.location.href='/register'}>
                  Prueba gratis <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
              <button onClick={()=>setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-white/70 hover:text-white transition-colors">
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-white/8 px-5 py-4 space-y-3">
              {[["Características","features"],["Clientes","testimonials"],["FAQ","faq"]].map(([l,id])=>(
                <button key={id} onClick={()=>scrollTo(id)} className="block w-full text-left text-white/70 hover:text-white text-sm font-medium py-1.5 transition-colors">{l}</button>
              ))}
              <div className="pt-2 space-y-2">
                <Button variant="ghost" className="w-full text-white/70 border border-white/10" onClick={()=>window.location.href='/login'}>Iniciar sesión</Button>
                <Button className="w-full bg-pink-500 hover:bg-pink-600 text-white rounded-xl" onClick={()=>window.location.href='/register'}>Prueba gratis →</Button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ──────────────────── HERO ──────────────────── */}
      <section className="relative z-10 min-h-screen flex items-center justify-center px-4 pt-28 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white leading-[1.04] tracking-tight mb-7">
            El sistema que hace<br />
            <span className="relative inline-block">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500" style={{ filter: "drop-shadow(0 0 30px rgba(236,72,153,0.4))" }}>
                escalar tu automotora
              </span>
            </span>
            {" "}inevitable.
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Centraliza inventario, ventas, finanzas y citas en una sola plataforma diseñada exclusivamente para concesionarios de alto rendimiento.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button size="lg" className="w-full sm:w-auto bg-pink-500 hover:bg-pink-600 text-white px-8 py-6 text-base font-semibold rounded-2xl shadow-[0_0_30px_rgba(236,72,153,0.3)] hover:shadow-[0_0_40px_rgba(236,72,153,0.5)] hover:scale-105 transition-all duration-300" onClick={()=>window.location.href='/register'}>
              Comenzar prueba gratis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/15 bg-white/4 text-white/80 hover:bg-white/8 hover:text-white hover:border-white/25 px-8 py-6 text-base font-semibold rounded-2xl backdrop-blur-sm transition-all duration-300" onClick={()=>window.location.href='/login'}>
              Iniciar sesión
            </Button>
          </div>

          {/* Social proof (removed per request) */}
        </div>
      </section>

      {/* STATS removed per request */}

      {/* ──────────────────── FEATURES ──────────────────── */}
      <section id="features" className="relative z-10 pt-32 pb-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-5 px-4 py-1.5 text-xs font-medium bg-pink-500/10 text-pink-400 border-pink-400/20 rounded-full">Funcionalidades</Badge>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-5 leading-tight tracking-tight">
              Todo lo que necesitas<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400">en un solo lugar.</span>
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">Fin a las hojas de cálculo, los sistemas dispersos y la información que se pierde.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div key={i} className="group relative rounded-3xl p-6 bg-white/3 border border-white/8 hover:border-pink-500/30 hover:bg-white/5 transition-all duration-300 cursor-default overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 to-pink-500/0 group-hover:from-pink-500/5 group-hover:to-violet-500/5 transition-all duration-500" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-pink-500/15 border border-pink-500/20 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-pink-500/25 transition-all duration-300">
                    <f.icon className="h-5 w-5 text-pink-400" />
                  </div>
                  <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────── PRODUCT MOCKUP ──────────────────── */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Left copy */}
            <div className="w-full lg:w-1/2 text-center lg:text-left order-2 lg:order-1">
              <Badge className="mb-5 px-4 py-1.5 text-xs font-medium bg-violet-500/10 text-violet-300 border-violet-400/20 rounded-full">Dashboard Ejecutivo</Badge>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight tracking-tight">
                Todos tus números,<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-pink-400">siempre visibles.</span>
              </h2>
              <p className="text-white/40 text-base leading-relaxed mb-8">Ventas del mes, conversión de leads, rotación de inventario y performance del equipo en un solo pantallazo. Sin reportes manuales, sin esperas.</p>
              <ul className="space-y-3 mb-10 text-left inline-block">
                {["KPIs actualizados en tiempo real","Comparativo mes a mes automático","Alertas inteligentes de stock bajo","Ranking de vendedores y sucursales"].map(item=>(
                  <li key={item} className="flex items-center gap-3 text-white/60 text-sm">
                    <div className="w-5 h-5 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-3 w-3 text-pink-400" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Button className="bg-pink-500 hover:bg-pink-600 text-white rounded-xl px-6 py-3 shadow-[0_0_20px_rgba(236,72,153,0.25)] hover:scale-105 transition-all duration-200" onClick={()=>window.location.href='/register'}>
                Ver demo en vivo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Right: fake dashboard card */}
            <div className="w-full lg:w-1/2 order-1 lg:order-2">
              <div className="bg-[#0f0f14] rounded-3xl p-5 border border-white/8 shadow-[0_0_80px_-20px_rgba(236,72,153,0.2)]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white font-bold text-sm">Dashboard de Ventas</p>
                    <p className="text-white/30 text-[11px]">Marzo 2026 · Actualizado hace 2 min</p>
                  </div>
                  <span className="text-[10px] bg-green-500/15 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-full">● En vivo</span>
                </div>
                <DashboardMetrics />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────── INTEGRATIONS ──────────────────── */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Left: integrations card */}
            <div className="w-full lg:w-1/2">
              <div className="bg-[#0f0f14] rounded-3xl p-5 border border-white/8 shadow-[0_0_60px_-15px_rgba(139,92,246,0.2)]">
                <div className="mb-4">
                  <p className="text-white/30 text-[11px] mb-0.5">Configuración › Canales de venta</p>
                  <p className="text-white font-bold text-sm">Canales conectados</p>
                </div>
                <div className="space-y-2.5">
                  {([
                    {
                      name:"Instagram", sub:"@tumarca · 3.2K seguidores", status:"Activo",
                      color:"from-[#f58529] via-[#dd2a7b] to-[#8134af]",
                      icon: (
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                      ),
                    },
                    {
                      name:"Facebook Marketplace", sub:"Cuenta verificada", status:"Activo",
                      color:"from-[#1877f2] to-[#0c5fcd]",
                      icon: (
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.02 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.514c-1.491 0-1.956.93-1.956 1.875v2.28h3.328l-.532 3.49h-2.796v8.437C19.612 23.093 24 18.099 24 12.073z"/></svg>
                      ),
                    },
                    {
                      name:"WhatsApp Business", sub:"+56 9 1234 5678 · API conectada", status:"Activo",
                      color:"from-[#25d366] to-[#128c7e]",
                      icon: (
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      ),
                    },
                    {
                      name:"Mercado Libre", sub:"Publicaciones Premium activas", status:"Activo",
                      color:"from-[#ffe600] to-[#f5c800]",
                      icon: (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none"><circle cx="12" cy="12" r="12" fill="#ffe600"/><path d="M12 4.5C8.134 4.5 5 7.634 5 11.5c0 1.636.556 3.14 1.481 4.337L5 19.5h14l-1.481-3.663A7.474 7.474 0 0019 11.5c0-3.866-3.134-7-7-7z" fill="#333"/><path d="M9 11.5s.667 1.5 3 1.5 3-1.5 3-1.5" stroke="#ffe600" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      ),
                    },
                    {
                      name:"Chile Autos", sub:"89 publicaciones activas", status:"Activo",
                      color:"from-[#e63946] to-[#c1121f]",
                      icon: (
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M21 10.5l-1.5-4.5H4.5L3 10.5H1.5V12H3v7.5h3V18h12v1.5h3V12h1.5v-1.5H21zm-15.75-.75L6.75 6h10.5l1.5 3.75H5.25zM6 15a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm12 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/></svg>
                      ),
                    },
                  ] as const).map((ch,i)=>(
                    <div key={i} className="flex items-center gap-3 bg-white/4 rounded-2xl px-4 py-3 border border-white/6 hover:border-white/14 hover:bg-white/6 transition-all duration-200">
                      <div className={`w-9 h-9 bg-gradient-to-br ${ch.color} rounded-xl flex items-center justify-center shrink-0 shadow-lg`}>
                        {ch.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold">{ch.name}</p>
                        <p className="text-white/35 text-[10px] truncate">{ch.sub}</p>
                      </div>
                      <span className="text-[10px] bg-green-500/15 text-green-400 border border-green-500/20 px-2.5 py-0.5 rounded-full shrink-0 font-medium">{ch.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right copy */}
            <div className="w-full lg:w-1/2 text-center lg:text-left">
              <Badge className="mb-5 px-4 py-1.5 text-xs font-medium bg-green-500/10 text-green-400 border-green-400/20 rounded-full">Integraciones</Badge>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight tracking-tight">
                Publica en todos lados<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">desde un solo lugar.</span>
              </h2>
              <p className="text-white/40 text-base leading-relaxed mb-8">Sincroniza tu inventario con Instagram, Facebook Marketplace, WhatsApp, Mercado Libre y Chile Autos. Un cambio de precio, actualizado en todos los canales al instante.</p>
              <ul className="space-y-3 mb-10 text-left inline-block">
                {["Publicación automática con fotos y descripción","Actualización de stock en tiempo real","Consultas de WhatsApp directo al CRM","Métricas de cada canal en un solo dashboard"].map(item=>(
                  <li key={item} className="flex items-center gap-3 text-white/60 text-sm">
                    <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-3 w-3 text-green-400" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────── CRM PIPELINE ──────────────────── */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-5 px-4 py-1.5 text-xs font-medium bg-pink-500/10 text-pink-400 border-pink-400/20 rounded-full">CRM Pipeline</Badge>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
              Tus leads avanzan solos.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400">Tú solo cierras.</span>
            </h2>
            <p className="text-white/40 text-base max-w-xl mx-auto leading-relaxed">
              El pipeline detecta señales de interés y mueve cada oportunidad automáticamente entre etapas, sin que tu equipo tenga que hacer nada.
            </p>
          </div>
          <CRMPipeline />
        </div>
      </section>

      {/* ──────────────────── APPOINTMENT CALENDAR ──────────────────── */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Right copy first on mobile */}
            <div className="w-full lg:w-1/2 text-center lg:text-left order-2 lg:order-1">
              <Badge className="mb-5 px-4 py-1.5 text-xs font-medium bg-pink-500/10 text-pink-400 border-pink-400/20 rounded-full">Agenda Inteligente</Badge>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight tracking-tight">
                Citas que se agendan<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400">solas. Siempre.</span>
              </h2>
              <p className="text-white/40 text-base leading-relaxed mb-8">Tus clientes reservan test drives y entregas directamente desde tu catálogo online. Tú recibes la alerta, apareces y cierras.</p>
              <ul className="space-y-3 mb-10 text-left inline-block">
                {["Recordatorios automáticos por WhatsApp","Vista unificada para todo el equipo","Sincronización con Google Calendar","Alertas de nueva reserva en tiempo real"].map(item=>(
                  <li key={item} className="flex items-center gap-3 text-white/60 text-sm">
                    <div className="w-5 h-5 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-3 w-3 text-pink-400" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Calendar */}
            <div className="w-full lg:w-1/2 flex justify-center order-1 lg:order-2">
              <AppointmentCalendar />
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────── TESTIMONIALS ──────────────────── */}
      <section id="testimonials" className="relative z-10 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-5 px-4 py-1.5 text-xs font-medium bg-pink-500/10 text-pink-400 border-pink-400/20 rounded-full">Testimonios</Badge>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
              Los resultados hablan
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400"> solos.</span>
            </h2>
            <p className="text-white/40 max-w-lg mx-auto">Más de 500 automotoras ya transformaron su operación. Aquí algunos de ellos.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t,i)=>(
              <div key={i} className="relative rounded-3xl p-6 bg-white/3 border border-white/8 hover:border-white/14 hover:bg-white/5 transition-all duration-300 flex flex-col">
                <div className="flex mb-4">
                  {[...Array(t.rating)].map((_,j)=><Star key={j} className="h-4 w-4 text-pink-400 fill-current" />)}
                </div>
                <p className="text-white/70 text-sm leading-relaxed flex-1 mb-6">"{t.content}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0">{t.avatar}</div>
                  <div>
                    <p className="text-white text-sm font-semibold">{t.name}</p>
                    <p className="text-white/30 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ──────────────────── FAQ ──────────────────── */}
      <section id="faq" className="relative z-10 py-24 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Preguntas frecuentes</h2>
            <p className="text-white/40">Si tienes otra duda, escríbenos al chat.</p>
          </div>
          <div className="space-y-3">
            {faqs.map((f,i)=><FaqItem key={i} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* ──────────────────── CTA FINAL ──────────────────── */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-violet-500/10 p-12 text-center shadow-[0_0_80px_-20px_rgba(236,72,153,0.2)]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.08),transparent_70%)]" />
            <div className="relative">
              <h2 className="text-4xl md:text-5xl font-black text-white mb-5 tracking-tight leading-tight">
                Tu automotora puede<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400">vender más desde hoy.</span>
              </h2>
              <p className="text-white/40 text-base mb-10 max-w-md mx-auto">Únete a más de 500 automotoras que ya operan con SKALE. Setup en 48 horas, sin contratos.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="bg-pink-500 hover:bg-pink-600 text-white px-10 py-6 text-base font-semibold rounded-2xl shadow-[0_0_30px_rgba(236,72,153,0.35)] hover:scale-105 transition-all duration-300" onClick={()=>window.location.href='/register'}>
                  Comenzar 14 días gratis <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="border-white/15 bg-white/4 text-white/70 hover:text-white hover:bg-white/8 px-10 py-6 text-base rounded-2xl transition-all duration-300" onClick={()=>window.location.href='/login'}>
                  Ya tengo cuenta
                </Button>
              </div>
              <p className="text-white/20 text-xs mt-6">Sin tarjeta de crédito · Cancela cuando quieras · Soporte incluido</p>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────── FOOTER ──────────────────── */}
      <footer className="relative z-10 py-16 px-4 border-t border-white/6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-12">
            <div className="max-w-xs">
              <span className="skale-logo text-lg tracking-[0.18em] block mb-3">SKALEMOTORS</span>
              <p className="text-white/30 text-sm leading-relaxed">El ecosistema definitivo para automotoras de alto rendimiento. Diseñado en Chile, usado en toda Latinoamérica.</p>
              <div className="flex gap-4 mt-5">
                {[Facebook, Instagram, Linkedin].map((Icon,i)=>(
                  <a key={i} href="#" className="text-white/20 hover:text-pink-400 transition-colors duration-200"><Icon className="h-4 w-4" /></a>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
              <div>
                <p className="text-white/50 font-semibold mb-3 text-xs uppercase tracking-wider">Producto</p>
                <ul className="space-y-2">
                  {["Características","Planes","Integraciones","Roadmap"].map(l=><li key={l}><a href="#" className="text-white/25 hover:text-white/70 transition-colors">{l}</a></li>)}
                </ul>
              </div>
              <div>
                <p className="text-white/50 font-semibold mb-3 text-xs uppercase tracking-wider">Empresa</p>
                <ul className="space-y-2">
                  {["Nosotros","Blog","Casos de éxito","Careers"].map(l=><li key={l}><a href="#" className="text-white/25 hover:text-white/70 transition-colors">{l}</a></li>)}
                </ul>
              </div>
              <div>
                <p className="text-white/50 font-semibold mb-3 text-xs uppercase tracking-wider">Soporte</p>
                <ul className="space-y-2">
                  {["Centro de ayuda","Contacto","Status","API Docs"].map(l=><li key={l}><a href="#" className="text-white/25 hover:text-white/70 transition-colors">{l}</a></li>)}
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-white/6 pt-8 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-white/20 text-xs">© 2026 SKALEMOTORS. Todos los derechos reservados.</p>
            <div className="flex gap-5 text-xs text-white/20">
              <a href="#" className="hover:text-white/50 transition-colors">Privacidad</a>
              <a href="#" className="hover:text-white/50 transition-colors">Términos</a>
              <a href="#" className="hover:text-white/50 transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
