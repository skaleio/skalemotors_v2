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
import { useChat } from "@/contexts/ChatContext";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isLandingPage = location.pathname === '/landing' || location.pathname === '/';
  const { isChatOpen, openChat, closeChat } = useChat();
  
  // Inicializar atajos globales
  useGlobalShortcuts();
  useKeyboardShortcuts();
  
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
      <div className="min-h-screen w-full flex">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 p-6 bg-muted/20">
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