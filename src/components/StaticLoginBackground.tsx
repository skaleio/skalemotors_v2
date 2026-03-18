import { useMemo } from 'react'
import { cn } from '@/lib/utils'

/**
 * Fondo estático ligero para login (sin Framer Motion ni animaciones).
 * Mejora TTI y uso de CPU vs OptimizedStarsBackground.
 */
export function StaticLoginBackground({ className }: { className?: string }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 72 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() > 0.88 ? 2 : 1,
        opacity: 0.25 + Math.random() * 0.65,
        color: Math.random() > 0.55 ? '#87CEEB' : '#ffffff',
      })),
    [],
  )

  return (
    <div
      className={cn(
        'fixed inset-0 z-0 overflow-hidden bg-[radial-gradient(ellipse_at_bottom,_#262626_0%,_#000_100%)] pointer-events-none',
        className,
      )}
      aria-hidden
    >
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
            opacity: s.opacity,
          }}
        />
      ))}
    </div>
  )
}
