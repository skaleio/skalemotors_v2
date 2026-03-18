import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface DashboardLoaderProps {
  message?: string;
  barLabel?: string;
}

export default function DashboardLoader({ message = "Cargando..." }: DashboardLoaderProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        // Reducir la velocidad conforme se acerca al 100%
        const increment = Math.random() * 2 + 0.5;
        if (prev + increment >= 99) return 99;
        return prev + increment;
      });
    }, 150);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-4 relative">
      {/* Resplandor ambiental refinado */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[20rem] bg-primary/5 rounded-[100%] blur-[120px] pointer-events-none opacity-50 dark:opacity-30" />
      
      <div className="w-full max-w-sm space-y-12 z-10 relative">
        <div className="text-center flex flex-col items-center justify-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden py-2"
          >
            <h1 className="skale-logo inline-block text-3xl sm:text-4xl text-primary">
              SKALEMOTORS
            </h1>
            
            {/* Efecto de brillo (shimmer) sobre el texto */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ 
                repeat: Infinity, 
                duration: 2.5, 
                ease: "linear",
                repeatDelay: 1.5
              }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 1 }}
            className="flex items-center gap-3 text-muted-foreground"
          >
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary/80"></span>
            </div>
            <p className="text-xs font-medium tracking-widest uppercase">
              {message}
            </p>
          </motion.div>
        </div>

        <motion.div 
          className="space-y-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex justify-between items-end px-1">
            <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground/50 uppercase">
              Iniciando sistema
            </span>
            <div className="flex items-end gap-[2px]">
              <span className="text-sm font-medium tabular-nums text-foreground/90 leading-none">
                {Math.round(progress)}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground/60 leading-none pb-[1px]">
                %
              </span>
            </div>
          </div>
          
          <div className="relative h-[2px] w-full overflow-hidden bg-muted/30 rounded-full">
            <motion.div
              className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-primary/40 via-primary/80 to-primary rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.3 }}
            >
              {/* Cabeza brillante de la barra */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-[2px] bg-white shadow-[0_0_8px_2px_rgba(var(--primary),0.8)] opacity-80" />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
