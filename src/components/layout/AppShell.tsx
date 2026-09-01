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
    <div className="flex h-full min-h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={handleSidebarClose} />

      <div className="flex flex-col flex-1 min-w-0">
        <Header onMenuToggle={handleMenuToggle} />

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export { AppShell };
