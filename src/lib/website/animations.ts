// CSS de animaciones compartido por el preview del editor y la web pública.
// Se inyecta una sola vez vía SiteThemeProvider. Respeta prefers-reduced-motion.

export const SITE_ANIMATIONS_CSS = `
@keyframes smFadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes smFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes smZoomIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes smFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes smGlowPulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.9; }
}
@keyframes smScrollCue {
  0% { transform: translateY(0); opacity: 0.9; }
  50% { transform: translateY(7px); opacity: 0.35; }
  100% { transform: translateY(0); opacity: 0.9; }
}
@keyframes smShine {
  0% { transform: translateX(-130%) skewX(-20deg); }
  100% { transform: translateX(230%) skewX(-20deg); }
}

.sm-fade-up { animation: smFadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
.sm-fade-in { animation: smFadeIn 0.8s ease both; }
.sm-zoom-in { animation: smZoomIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
.sm-d1 { animation-delay: 0.08s; }
.sm-d2 { animation-delay: 0.18s; }
.sm-d3 { animation-delay: 0.30s; }
.sm-d4 { animation-delay: 0.44s; }
.sm-d5 { animation-delay: 0.58s; }

.sm-glow {
  position: absolute;
  border-radius: 9999px;
  filter: blur(80px);
  pointer-events: none;
  animation: smGlowPulse 6s ease-in-out infinite;
}

.sm-scroll-cue { animation: smScrollCue 1.8s ease-in-out infinite; }

.sm-card {
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease, border-color 0.35s ease;
  will-change: transform;
}
.sm-card:hover {
  transform: translateY(-6px);
  border-color: color-mix(in srgb, var(--sm-primary) 55%, var(--sm-border)) !important;
  box-shadow: 0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px color-mix(in srgb, var(--sm-primary) 30%, transparent);
}
.sm-card img { transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
.sm-card:hover img { transform: scale(1.07); }

.sm-shine {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  border-radius: inherit;
}
.sm-shine::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
  transform: translateX(-130%) skewX(-20deg);
}
.sm-card:hover .sm-shine::after { animation: smShine 0.9s ease; }

.sm-cta {
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
}
.sm-cta:hover {
  transform: translateY(-2px);
  filter: brightness(1.08);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--sm-primary) 45%, transparent);
}

.sm-underline-grow {
  position: relative;
}

@media (prefers-reduced-motion: reduce) {
  .sm-fade-up, .sm-fade-in, .sm-zoom-in, .sm-glow, .sm-scroll-cue,
  .sm-card, .sm-card img, .sm-shine::after, .sm-cta {
    animation: none !important;
    transition: none !important;
  }
}
`;
