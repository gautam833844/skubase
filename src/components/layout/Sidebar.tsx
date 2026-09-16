"use client";

import { useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type NavItem } from "@/lib/constants";
import { NavIcon } from "@/components/ui/NavIcon";
import { StatusBadge } from "@/components/ui/StatusBadge";

// =============================================================================
// Sidebar — Stationary Primary Navigation & Mobile Sliding Drawer
// =============================================================================

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Group nav items logically for enhanced visual hierarchy and fast scanning
const NAV_GROUPS = [
  {
    title: "Operations",
    items: ["/", "/sales", "/inventory", "/alignment", "/purchases"],
  },
  {
    title: "Directory & Care",
    items: ["/customers", "/suppliers", "/warranty"],
  },
  {
    title: "Intelligence & Admin",
    items: ["/reports", "/settings"],
  },
];

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  // Escape key handler to dismiss mobile drawer
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel — Stationary on desktop, slide drawer on mobile */}
      <aside
        id="sidebar-navigation"
        className={`
          fixed top-0 left-0 z-40 h-full w-sidebar shrink-0
          bg-white border-r border-surface-200 shadow-sidebar
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `.trim()}
        aria-label="Sidebar navigation"
      >
        {/* Top Brand & Logo */}
        <div className="flex items-center justify-between h-header px-4 border-b border-surface-200 shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2.5 tracking-tight group"
            onClick={onClose}
          >
            <Image
              src="/kmr-logo.png"
              alt="KMR Group Logo"
              width={140}
              height={90}
              priority
              className="h-10 w-auto object-contain max-w-[140px] drop-shadow-xs transition-transform group-hover:scale-105"
            />
            <span className="text-base font-bold text-surface-900 tracking-tight">KMR Group</span>
          </Link>

          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-surface-500 hover:text-surface-800 hover:bg-surface-100 transition-colors"
            aria-label="Close navigation"
          >
            <NavIcon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Store Identifier Pill */}
        <div className="px-4 pt-3 pb-1 shrink-0">
          <div className="p-2.5 rounded-xl bg-surface-50 border border-surface-200/80 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white border border-surface-200 text-primary-600 shadow-2xs">
              <NavIcon name="store" className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-surface-800 truncate">Apex Tyres & Service</div>
              <div className="text-[0.688rem] text-surface-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">Main Retail Bay #1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items (Categorized with smooth scrolling) */}
        <nav
          aria-label="Main navigation"
          className="flex-1 px-3 py-2 space-y-4 overflow-y-auto overscroll-contain"
        >
          {NAV_GROUPS.map((group) => {
            const groupItems = NAV_ITEMS.filter((item) =>
              group.items.includes(item.href)
            );

            if (groupItems.length === 0) return null;

            return (
              <div key={group.title} className="space-y-1">
                <div className="px-3 text-[0.688rem] font-bold text-surface-400 uppercase tracking-wider">
                  {group.title}
                </div>
                <div className="space-y-0.5">
                  {groupItems.map((item: NavItem) => {
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
                          flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                          transition-all duration-150 group
                          ${
                            isActive
                              ? "bg-primary-600 text-white font-semibold shadow-xs shadow-primary-500/20"
                              : item.implemented
                                ? "text-surface-600 hover:bg-surface-100 hover:text-surface-900"
                                : "text-surface-400 cursor-default"
                          }
                        `.trim()}
                      >
                        <NavIcon
                          name={item.icon}
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive
                              ? "text-white"
                              : "text-surface-400 group-hover:text-surface-700"
                          }`}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {!item.implemented && (
                          <StatusBadge label="Soon" variant="neutral" />
                        )}
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white/80 shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom Sidebar Status Widget */}
        <div className="p-3 border-t border-surface-200 shrink-0 bg-surface-50/50">
          <div className="flex items-center justify-between text-[0.688rem] text-surface-500 px-2 py-1">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>System Online</span>
            </span>
            <span className="font-mono text-surface-400">v0.1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export { Sidebar };
