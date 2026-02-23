import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { PageRestore } from "@/components/PageRestore";
import { PageLoader } from "@/components/PageLoader";
import { GlobalQuickActions } from "@/components/GlobalQuickActions";
import FloatingChatButton from "@/components/FloatingChatButton";
import SupportChat from "@/components/SupportChat";
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
  
  return (
    <SidebarProvider>
      <PrefetchLeads />
      <div
        className={isReady && isMobileDevice ? "h-dvh min-h-dvh w-full flex flex-col overflow-hidden" : "min-h-screen w-full flex"}
        data-mobile-device={isReady && isMobileDevice ? "true" : undefined}
        data-layout-version={isReady && isMobileDevice ? "mobile" : "desktop"}
      >
        <AppSidebar />
        <div className="flex-1 flex flex-col relative z-0 min-w-0 min-h-0 overflow-hidden">
          <TopBar />
          <main className={isReady && isMobileDevice ? "flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-6 bg-muted/20 min-w-0 overscroll-contain" : "flex-1 p-6 bg-muted/20 min-w-0"}>
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