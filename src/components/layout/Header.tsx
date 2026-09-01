"use client";

import { useRouter } from "next/navigation";
import { NavIcon } from "@/components/ui/NavIcon";

// =============================================================================
// Header — Top application bar
// =============================================================================

interface HeaderProps {
  onMenuToggle: () => void;
}

function Header({ onMenuToggle }: HeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 flex items-center h-header px-4 bg-white border-b border-surface-200 lg:px-6">
      {/* Hamburger menu — mobile only */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 -ml-2 rounded-md text-surface-600 hover:bg-surface-100"
        aria-label="Open navigation menu"
      >
        <NavIcon name="menu" className="w-6 h-6" />
      </button>

      {/* Mobile app name */}
      <span className="lg:hidden ml-3 text-lg font-bold text-primary-600 tracking-tight">
        Skubase
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User menu and Logout */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-semibold"
          aria-label="User account"
        >
          U
        </div>
        <button
          onClick={async () => {
            try {
              await fetch("/api/auth/logout", { method: "POST" });
            } finally {
              router.push("/login");
              router.refresh();
            }
          }}
          className="text-xs font-medium text-surface-500 hover:text-surface-800 px-2 py-1 rounded hover:bg-surface-100 transition-colors cursor-pointer"
          aria-label="Sign out"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

export { Header };

