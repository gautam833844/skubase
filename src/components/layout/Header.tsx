"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { NavIcon } from "@/components/ui/NavIcon";

// =============================================================================
// Header — Feature-Rich, Full-Stretch Top Navigation Bar
// =============================================================================

interface HeaderProps {
  onMenuToggle: () => void;
}

interface QuickSearchResult {
  title: string;
  subtitle: string;
  href: string;
  category: "Module" | "Action" | "Shortcut";
  icon: string;
}

const SEARCH_ITEMS: QuickSearchResult[] = [
  { title: "Dashboard", subtitle: "Shop KPIs & Business Overview", href: "/", category: "Module", icon: "dashboard" },
  { title: "Sales & Invoices", subtitle: "Manage sales, draft invoices & receipts", href: "/sales", category: "Module", icon: "sales" },
  { title: "New Sale Invoice", subtitle: "Create new counter or retail sale", href: "/sales/new", category: "Action", icon: "plus" },
  { title: "Inventory Catalog", subtitle: "Stock levels, tyres, batch tracking", href: "/inventory", category: "Module", icon: "inventory" },
  { title: "Alignment & Services", subtitle: "Wheel alignment, balancing, tyre rotation", href: "/alignment", category: "Module", icon: "alignment" },
  { title: "New Alignment Job", subtitle: "Log vehicle wheel alignment or service", href: "/alignment/new", category: "Action", icon: "plus" },
  { title: "Purchase Orders", subtitle: "Supplier POs and stock inwards", href: "/purchases", category: "Module", icon: "purchases" },
  { title: "Customers Directory", subtitle: "Customer vehicle database & ledger", href: "/customers", category: "Module", icon: "customers" },
  { title: "Suppliers & Vendors", subtitle: "Distributor directory & balances", href: "/suppliers", category: "Module", icon: "suppliers" },
  { title: "Warranty Claims", subtitle: "Tyre claims & brand replacement tracking", href: "/warranty", category: "Module", icon: "warranty" },
  { title: "Business Reports", subtitle: "Profit & loss, sales analysis, tax reports", href: "/reports", category: "Module", icon: "reports" },
  { title: "Store Settings", subtitle: "Shop profile, taxes, users, preferences", href: "/settings", category: "Module", icon: "settings" },
];

function getPageMetadata(pathname: string): { title: string; subtitle: string; icon: string } {
  if (pathname === "/") return { title: "Dashboard", subtitle: "Shop KPIs & Overview", icon: "dashboard" };
  if (pathname.startsWith("/sales/new")) return { title: "New Sale", subtitle: "Counter Sale & Invoicing", icon: "sales" };
  if (pathname.startsWith("/sales")) return { title: "Sales & POS", subtitle: "Billing & Transactions", icon: "sales" };
  if (pathname.startsWith("/inventory")) return { title: "Inventory", subtitle: "Tyre Stock & Catalog", icon: "inventory" };
  if (pathname.startsWith("/alignment/new")) return { title: "New Alignment", subtitle: "Vehicle Inspection & Service", icon: "alignment" };
  if (pathname.startsWith("/alignment")) return { title: "Alignment & Services", subtitle: "Wheel Alignment & Bay Management", icon: "alignment" };
  if (pathname.startsWith("/purchases")) return { title: "Purchases", subtitle: "Stock Inward & Orders", icon: "purchases" };
  if (pathname.startsWith("/customers")) return { title: "Customers", subtitle: "Customer Directory & Vehicles", icon: "customers" };
  if (pathname.startsWith("/suppliers")) return { title: "Suppliers", subtitle: "Distributors & Vendors", icon: "suppliers" };
  if (pathname.startsWith("/warranty")) return { title: "Warranties", subtitle: "Claims & Inspections", icon: "warranty" };
  if (pathname.startsWith("/reports")) return { title: "Reports", subtitle: "Business Analytics", icon: "reports" };
  if (pathname.startsWith("/settings")) return { title: "Settings", subtitle: "Store Configuration", icon: "settings" };
  return { title: "KMR Group", subtitle: "Tyre & Business Management", icon: "dashboard" };
}

function Header({ onMenuToggle }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pageMeta = getPageMetadata(pathname);

  // States for dropdowns and interactive search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickActionRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut listener ('/' or 'Ctrl+K' / 'Cmd+K' to focus search)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        setMobileSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === "Escape") {
        setSearchFocused(false);
        setMobileSearchOpen(false);
        setQuickActionOpen(false);
        setNotificationsOpen(false);
        setUserMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Click outside listener for all popovers
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
      if (quickActionRef.current && !quickActionRef.current.contains(e.target as Node)) {
        setQuickActionOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter search results
  const filteredSearchResults = searchQuery.trim()
    ? SEARCH_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : SEARCH_ITEMS.slice(0, 6);

  const handleSignOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  return (
    <header
      id="main-header"
      className="sticky top-0 z-20 w-full shrink-0 bg-white/95 backdrop-blur-md border-b border-surface-200 shadow-sm transition-all duration-200"
    >
      <div className="flex items-center justify-between h-header px-3 sm:px-4 lg:px-6 gap-2 sm:gap-4 max-w-full">
        {/* ================================================================= */}
        {/* LEFT: Mobile Menu Toggle & Route Context / Breadcrumb            */}
        {/* ================================================================= */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Mobile hamburger menu toggle */}
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 -ml-1 text-surface-600 hover:text-surface-900 rounded-lg hover:bg-surface-100 transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
            aria-label="Open navigation menu"
          >
            <NavIcon name="menu" className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Mobile App Brand */}
          <Link
            href="/"
            className="lg:hidden flex items-center gap-2"
          >
            <Image
              src="/kmr-logo.png"
              alt="KMR Group Logo"
              width={120}
              height={70}
              priority
              className="h-8 w-auto object-contain max-w-[120px]"
            />
            <span className="text-sm font-bold text-surface-900 tracking-tight">KMR Group</span>
          </Link>

          {/* Desktop Active Section Context Indicator */}
          <div className="hidden lg:flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-primary-50 text-primary-600 border border-primary-100/60 shadow-xs">
              <NavIcon name={pageMeta.icon} className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-surface-900 tracking-tight leading-tight">
                {pageMeta.title}
              </h1>
              <p className="text-[0.688rem] text-surface-500 leading-tight">
                {pageMeta.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* CENTER: Global Search Bar                                         */}
        {/* ================================================================= */}
        <div
          ref={searchContainerRef}
          className="relative flex-1 max-w-xs md:max-w-md lg:max-w-lg hidden md:block"
        >
          <div className="relative flex items-center">
            <div className="absolute left-3 text-surface-400 pointer-events-none">
              <NavIcon name="search" className="w-4 h-4" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search inventory, sales, customers, modules... ('/' or 'Ctrl+K')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredSearchResults.length > 0) {
                  router.push(filteredSearchResults[0].href);
                  setSearchFocused(false);
                  setSearchQuery("");
                }
              }}
              aria-label="Global quick search"
              className="w-full pl-9 pr-14 py-1.5 text-xs sm:text-sm bg-surface-50/80 hover:bg-surface-50 focus:bg-white text-surface-800 placeholder-surface-400 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-xs"
            />
            <div className="absolute right-2.5 hidden sm:flex items-center gap-0.5">
              <kbd className="px-1.5 py-0.5 text-[0.625rem] font-semibold text-surface-400 bg-surface-200/70 border border-surface-300/60 rounded">
                /
              </kbd>
            </div>
          </div>

          {/* Quick Search Dropdown Overlay */}
          {searchFocused && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-surface-200 overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-100">
              <div className="p-2 border-b border-surface-100 flex items-center justify-between text-xs text-surface-500 bg-surface-50/50">
                <span className="font-medium">
                  {searchQuery ? `Results for "${searchQuery}"` : "Quick Navigation & Shortcuts"}
                </span>
                <span className="text-[0.688rem] text-surface-400">Esc to close</span>
              </div>
              <ul className="max-h-72 overflow-y-auto p-1.5 space-y-0.5" role="listbox">
                {filteredSearchResults.length > 0 ? (
                  filteredSearchResults.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => {
                          setSearchFocused(false);
                          setSearchQuery("");
                        }}
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-xs hover:bg-primary-50 hover:text-primary-700 text-surface-700 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1 rounded bg-surface-100 group-hover:bg-primary-100 text-surface-600 group-hover:text-primary-600 transition-colors">
                            <NavIcon name={item.icon} className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-medium text-surface-900 group-hover:text-primary-900">
                              {item.title}
                            </div>
                            <div className="text-[0.688rem] text-surface-400 group-hover:text-primary-600/80">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>
                        <span className="text-[0.625rem] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-100 group-hover:bg-primary-100 text-surface-500 group-hover:text-primary-700">
                          {item.category}
                        </span>
                      </Link>
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-6 text-center text-xs text-surface-400">
                    No matching items found for &quot;{searchQuery}&quot;
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* RIGHT: Actions, Store Badge, Notifications & Profile              */}
        {/* ================================================================= */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Mobile Search Toggle Button */}
          <button
            onClick={() => setMobileSearchOpen((prev) => !prev)}
            className="md:hidden p-2 text-surface-600 hover:text-surface-900 hover:bg-surface-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Toggle mobile search"
          >
            <NavIcon name="search" className="w-5 h-5" />
          </button>

          {/* Quick Action Button (+ New) */}
          <div ref={quickActionRef} className="relative">
            <button
              onClick={() => setQuickActionOpen((prev) => !prev)}
              aria-expanded={quickActionOpen}
              aria-label="Quick action menu"
              className="flex items-center gap-1 sm:gap-1.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <NavIcon name="plus" className="w-4 h-4" />
              <span className="hidden sm:inline">Quick Action</span>
              <NavIcon name="chevron-down" className="w-3 h-3 opacity-80" />
            </button>

            {quickActionOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-surface-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[0.688rem] font-semibold text-surface-400 uppercase tracking-wider">
                  Create New
                </div>
                <Link
                  href="/sales/new"
                  onClick={() => setQuickActionOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-surface-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                >
                  <NavIcon name="sales" className="w-4 h-4 text-primary-600" />
                  <span>New Sale / Invoice</span>
                </Link>
                <Link
                  href="/alignment/new"
                  onClick={() => setQuickActionOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-surface-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                >
                  <NavIcon name="alignment" className="w-4 h-4 text-primary-600" />
                  <span>New Alignment Job</span>
                </Link>
                <Link
                  href="/inventory"
                  onClick={() => setQuickActionOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-surface-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                >
                  <NavIcon name="inventory" className="w-4 h-4 text-primary-600" />
                  <span>Add Tyre Stock</span>
                </Link>
                <Link
                  href="/customers"
                  onClick={() => setQuickActionOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-surface-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                >
                  <NavIcon name="customers" className="w-4 h-4 text-primary-600" />
                  <span>New Customer</span>
                </Link>
              </div>
            )}
          </div>

          {/* Store Branch Indicator Pill (Tablet & Desktop) */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-surface-100/80 border border-surface-200/80 rounded-full text-xs text-surface-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-surface-700">Main Branch</span>
          </div>

          {/* Notifications Center */}
          <div ref={notificationsRef} className="relative">
            <button
              onClick={() => setNotificationsOpen((prev) => !prev)}
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              className="relative p-2 text-surface-500 hover:text-surface-800 hover:bg-surface-100 rounded-lg transition-colors cursor-pointer"
            >
              <NavIcon name="bell" className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-1.5 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-surface-200 overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="p-3 border-b border-surface-100 flex items-center justify-between bg-surface-50/70">
                  <div className="font-semibold text-xs text-surface-800 flex items-center gap-1.5">
                    <NavIcon name="bell" className="w-3.5 h-3.5 text-primary-600" />
                    <span>Operational Alerts</span>
                  </div>
                  <span className="text-[0.688rem] px-1.5 py-0.5 bg-rose-100 text-rose-700 font-medium rounded-full">
                    2 Active
                  </span>
                </div>
                <div className="p-2 divide-y divide-surface-100 max-h-64 overflow-y-auto">
                  <Link
                    href="/inventory"
                    onClick={() => setNotificationsOpen(false)}
                    className="block p-2 rounded-lg hover:bg-surface-50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="p-1 rounded bg-amber-100 text-amber-700 mt-0.5">
                        <NavIcon name="alert-triangle" className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <p className="text-xs font-medium text-surface-900">Low Tyre Stock Alert</p>
                        <p className="text-[0.688rem] text-surface-500">
                          Bridgestone 205/55 R16 is below reorder threshold (3 units left).
                        </p>
                      </div>
                    </div>
                  </Link>

                  <Link
                    href="/warranty"
                    onClick={() => setNotificationsOpen(false)}
                    className="block p-2 rounded-lg hover:bg-surface-50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="p-1 rounded bg-primary-100 text-primary-700 mt-0.5">
                        <NavIcon name="warranty" className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <p className="text-xs font-medium text-surface-900">Pending Warranty Review</p>
                        <p className="text-[0.688rem] text-surface-500">
                          1 claim pending manufacturer technical inspection.
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>
                <div className="p-2 border-t border-surface-100 bg-surface-50/50 text-center">
                  <Link
                    href="/reports"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-[0.688rem] font-medium text-primary-600 hover:text-primary-800"
                  >
                    View All Activity Reports &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Account Menu */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              aria-label="User account"
              aria-expanded={userMenuOpen}
              className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-surface-100 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold ring-2 ring-primary-100 shadow-xs">
                AU
              </div>
              <div className="hidden lg:block text-left leading-tight">
                <div className="text-xs font-semibold text-surface-800">Admin User</div>
                <div className="text-[0.688rem] text-surface-500">Store Manager</div>
              </div>
              <NavIcon name="chevron-down" className="hidden lg:block w-3.5 h-3.5 text-surface-400" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-surface-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-2 border-b border-surface-100">
                  <p className="text-xs font-semibold text-surface-900">Admin User</p>
                  <p className="text-[0.688rem] text-surface-500">admin@skubase.local</p>
                  <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-[0.625rem] font-medium text-primary-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />
                    Manager / Owner
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-surface-700 hover:bg-surface-50 transition-colors"
                  >
                    <NavIcon name="settings" className="w-4 h-4 text-surface-500" />
                    <span>Store Settings</span>
                  </Link>
                  <Link
                    href="/reports"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-surface-700 hover:bg-surface-50 transition-colors"
                  >
                    <NavIcon name="reports" className="w-4 h-4 text-surface-500" />
                    <span>Financial Reports</span>
                  </Link>
                </div>

                <div className="border-t border-surface-100 pt-1">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-danger-600 hover:bg-danger-50 transition-colors text-left cursor-pointer"
                    aria-label="Sign out"
                  >
                    <NavIcon name="logout" className="w-4 h-4 text-danger-600" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MOBILE SEARCH EXPANDABLE DRAWER                                    */}
      {/* =================================================================== */}
      {mobileSearchOpen && (
        <div className="md:hidden px-3 py-2.5 bg-surface-50 border-t border-surface-200">
          <div className="relative flex items-center">
            <div className="absolute left-3 text-surface-400 pointer-events-none">
              <NavIcon name="search" className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search tyres, sales, customers, invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredSearchResults.length > 0) {
                  router.push(filteredSearchResults[0].href);
                  setMobileSearchOpen(false);
                  setSearchQuery("");
                }
              }}
              autoFocus
              className="w-full pl-9 pr-8 py-2 text-xs bg-white text-surface-800 placeholder-surface-400 border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
            />
            <button
              onClick={() => {
                setMobileSearchOpen(false);
                setSearchQuery("");
              }}
              className="absolute right-2 p-1 text-surface-400 hover:text-surface-700"
              aria-label="Close search"
            >
              <NavIcon name="close" className="w-3.5 h-3.5" />
            </button>
          </div>

          {searchQuery && (
            <ul className="mt-2 bg-white rounded-lg border border-surface-200 max-h-48 overflow-y-auto divide-y divide-surface-100 shadow-sm">
              {filteredSearchResults.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      setMobileSearchOpen(false);
                      setSearchQuery("");
                    }}
                    className="flex items-center justify-between p-2.5 text-xs text-surface-700 hover:bg-primary-50 hover:text-primary-700"
                  >
                    <div className="flex items-center gap-2">
                      <NavIcon name={item.icon} className="w-4 h-4 text-primary-600" />
                      <div>
                        <div className="font-medium text-surface-900">{item.title}</div>
                        <div className="text-[0.625rem] text-surface-400">{item.subtitle}</div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </header>
  );
}

export { Header };
