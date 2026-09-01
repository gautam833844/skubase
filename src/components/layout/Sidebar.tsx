"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { NavIcon } from "@/components/ui/NavIcon";
import { StatusBadge } from "@/components/ui/StatusBadge";

// =============================================================================
// Sidebar — Primary navigation
// =============================================================================

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        id="sidebar-navigation"
        className={`
          fixed top-0 left-0 z-40 h-full w-sidebar
          bg-white border-r border-surface-200 shadow-sidebar
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `.trim()}
        aria-label="Sidebar navigation"
      >
        {/* Logo / App Name */}
        <div className="flex items-center justify-between h-header px-5 border-b border-surface-200">
          <Link
            href="/"
            className="text-xl font-bold text-primary-600 tracking-tight"
            onClick={onClose}
          >
            Skubase
          </Link>

          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-surface-500 hover:bg-surface-100"
            aria-label="Close navigation"
          >
            <NavIcon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items */}
        <nav
          aria-label="Main navigation"
          className="p-3 space-y-1 overflow-y-auto"
          style={{ height: "calc(100% - 4rem)" }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.implemented ? item.href : "#"}
                onClick={(e) => {
                  if (!item.implemented) e.preventDefault();
                  else onClose();
                }}
                aria-current={isActive ? "page" : undefined}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-md text-[0.938rem] font-medium
                  transition-colors duration-150
                  ${
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : item.implemented
                        ? "text-surface-600 hover:bg-surface-50 hover:text-surface-900"
                        : "text-surface-400 cursor-default"
                  }
                `.trim()}
              >
                <NavIcon name={item.icon} className="w-5 h-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {!item.implemented && (
                  <StatusBadge label="Soon" variant="neutral" />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export { Sidebar };
