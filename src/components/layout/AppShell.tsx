"use client";

import { useState, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

// =============================================================================
// AppShell — Main application layout wrapper
// =============================================================================

interface AppShellProps {
  children: ReactNode;
}

function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleMenuToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // Standalone public routes (e.g. /login) render without sidebar/header shell
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-surface-50">
      {/* Fixed Sidebar — stationary on desktop, animated drawer on mobile */}
      <Sidebar isOpen={sidebarOpen} onClose={handleSidebarClose} />

      {/* Main Content Viewport */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Full-stretch pinned Header */}
        <Header onMenuToggle={handleMenuToggle} />

        {/* Scrollable page body — internal scrolling keeps navigation stationary */}
        <main
          id="main-content"
          className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto overscroll-y-contain focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export { AppShell };
