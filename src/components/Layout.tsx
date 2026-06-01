import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { PageRestore } from "@/components/PageRestore";
import { PageLoader } from "@/components/PageLoader";
import { GlobalQuickActions } from "@/components/GlobalQuickActions";
import FloatingChatButton from "@/components/FloatingChatButton";
import SupportChat from "@/components/SupportChat";
import { LoginAlertsDialog } from "@/components/LoginAlertsDialog";
import { PrefetchLeads } from "@/components/PrefetchLeads";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useChat } from "@/contexts/ChatContext";
import { useDevice } from "@/contexts/DeviceContext";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isLandingPage = location.pathname === '/landing' || location.pathname === '/';
  const { isChatOpen, openChat, closeChat } = useChat();
  const { isMobileDevice, isReady } = useDevice();
  
  // Inicializar atajos globales
  useGlobalShortcuts();
  useKeyboardShortcuts();

  // Versión app móvil: fijar html/body para que no hagan zoom ni scroll (solo el contenido principal)
  useEffect(() => {
    if (!isReady || !isMobileDevice || isLandingPage) return;
    document.documentElement.dataset.mobileApp = "true";
    return () => {
      delete document.documentElement.dataset.mobileApp;
    };
  }, [isReady, isMobileDevice, isLandingPage]);
  
  // Si es la página de landing, renderizar sin sidebar ni topbar
  if (isLandingPage) {
    return (
      <>
        {children}
        <PageLoader />
      </>
    );
  }
  
  const isMobileLayout = isReady && isMobileDevice;

  return (
    <SidebarProvider>
      <LoginAlertsDialog />
      <PrefetchLeads />
      <div
        className={
          isMobileLayout
            ? "fixed inset-0 z-0 flex w-full flex-col overflow-hidden bg-background"
            : "flex h-svh min-h-0 w-full overflow-hidden bg-background"
        }
        style={isMobileLayout ? { height: "100dvh", maxHeight: "100dvh" } : undefined}
        data-mobile-device={isMobileLayout ? "true" : undefined}
        data-layout-version={isMobileLayout ? "mobile" : "desktop"}
      >
        <AppSidebar />
        <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0">
            <TopBar />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-muted/20 p-4 min-w-0 md:p-6">
            <PageRestore>
              {children}
            </PageRestore>
          </main>
        </div>
      </div>
      <PageLoader />
      <GlobalQuickActions />
      
      {/* Chat de soporte flotante global */}
      <FloatingChatButton onClick={openChat} />
      <SupportChat
        isOpen={isChatOpen}
        onClose={closeChat}
        platform={null}
      />
    </SidebarProvider>
  );
}