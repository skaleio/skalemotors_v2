import { useNavigationWithLoading } from "@/hooks/useNavigationWithLoading";

export function PageLoader() {
  const { isLoading } = useNavigationWithLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-8">
        {/* Logo con icono del favicon */}
        <div className="flex flex-col items-center space-y-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg overflow-hidden animate-pulse">
              <svg width="48" height="48" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:"#1e40af",stopOpacity:1}} />
                    <stop offset="50%" style={{stopColor:"#3b82f6",stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:"#1e40af",stopOpacity:1}} />
                  </linearGradient>
                  <linearGradient id="carGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:"#ffffff",stopOpacity:1}} />
                    <stop offset="50%" style={{stopColor:"#f8fafc",stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:"#e2e8f0",stopOpacity:1}} />
                  </linearGradient>
                  <linearGradient id="wheelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:"#1f2937",stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:"#111827",stopOpacity:1}} />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
                    <feMerge> 
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <circle cx="16" cy="16" r="16" fill="url(#bgGradient)"/>
                <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
                <rect x="6" y="18" width="20" height="8" rx="2" fill="url(#carGradient)"/>
                <path d="M8 18 L11 10 L21 10 L24 18 Z" fill="url(#carGradient)"/>
                <rect x="9" y="11" width="6" height="5" rx="1" fill="rgba(30,64,175,0.3)" stroke="rgba(30,64,175,0.5)" strokeWidth="0.5"/>
                <rect x="17" y="11" width="6" height="5" rx="1" fill="rgba(30,64,175,0.3)" stroke="rgba(30,64,175,0.5)" strokeWidth="0.5"/>
                <circle cx="10" cy="26" r="3" fill="url(#wheelGradient)"/>
                <circle cx="22" cy="26" r="3" fill="url(#wheelGradient)"/>
                <circle cx="10" cy="26" r="2" fill="#374151"/>
                <circle cx="22" cy="26" r="2" fill="#374151"/>
                <circle cx="10" cy="26" r="1.5" fill="#6b7280"/>
                <circle cx="22" cy="26" r="1.5" fill="#6b7280"/>
                <circle cx="7" cy="21" r="1.5" fill="#fbbf24" filter="url(#glow)"/>
                <circle cx="25" cy="21" r="1.5" fill="#fbbf24" filter="url(#glow)"/>
                <circle cx="7" cy="23" r="1" fill="#ef4444"/>
                <circle cx="25" cy="23" r="1" fill="#ef4444"/>
                <rect x="7" y="19" width="1" height="2" fill="#1e40af"/>
                <rect x="24" y="19" width="1" height="2" fill="#1e40af"/>
                <path d="M8 16 L24 16" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
                <path d="M4 12 L6 14" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
                <path d="M4 8 L5 10" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                <path d="M28 12 L26 14" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
                <path d="M28 8 L27 10" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
              </svg>
            </div>
            <div className="skale-logo text-4xl font-bold tracking-wider text-slate-800 animate-pulse">
              SKALEMOTORS
            </div>
          </div>
          
          {/* Círculo de carga profesional */}
          <div className="relative w-12 h-12">
            {/* Círculo exterior */}
            <div className="absolute inset-0 rounded-full border-3 border-gray-200"></div>
            
            {/* Círculo de progreso - slate */}
            <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-slate-800 border-r-slate-800 animate-spin"></div>
            
            {/* Círculo interior */}
            <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Barra de progreso sutil */}
        <div className="w-48 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-slate-600 to-slate-800 rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}
