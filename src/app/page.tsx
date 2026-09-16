import Link from "next/link";
import Image from "next/image";
import { Card, StatusBadge } from "@/components/ui";
import { NavIcon } from "@/components/ui/NavIcon";
import { DashboardKpis } from "@/components/dashboard/DashboardKpis";

// =============================================================================
// Dashboard — Landing page
// =============================================================================

interface DashboardModule {
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly href: string;
  readonly implemented: boolean;
}

/** Module cards displayed on the dashboard */
const DASHBOARD_MODULES: readonly DashboardModule[] = [
  {
    title: "Inventory",
    href: "/inventory",
    implemented: true,
    description: "Track tyre stock levels, sizes, brands, and stock movements.",
    icon: "inventory",
  },
  {
    title: "Sales",
    href: "/sales",
    implemented: true,
    description: "Record sales, generate invoices, and track payments.",
    icon: "sales",
  },
  {
    title: "Alignment & Services",
    href: "/alignment",
    implemented: true,
    description: "Wheel alignment, balancing, tyre fitting & job cards.",
    icon: "alignment",
  },
  {
    title: "Purchases",
    href: "/purchases",
    implemented: true,
    description: "Manage purchase orders, receipts, and supplier deliveries.",
    icon: "purchases",
  },
  {
    title: "Customers",
    href: "/customers",
    implemented: true,
    description: "Manage customer details, vehicle records, and balance ledgers.",
    icon: "customers",
  },
  {
    title: "Suppliers",
    href: "/suppliers",
    implemented: true,
    description: "Manage suppliers, distributors, and procurement information.",
    icon: "suppliers",
  },
  {
    title: "Warranties",
    href: "/warranty",
    implemented: true,
    description: "Tyre warranty registration, claim filing & manufacturer review.",
    icon: "warranty",
  },
  {
    title: "Reports",
    href: "/reports",
    implemented: true,
    description: "Business insights, stock reports, and financial summaries.",
    icon: "reports",
  },
  {
    title: "Settings",
    href: "/settings",
    implemented: true,
    description: "Store profile, taxes, users, and business preferences.",
    icon: "settings",
  },
] as const;

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome section with KMR Group Brand */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-surface-200 shadow-xs">
        <div className="flex items-center gap-4">
          <Image
            src="/kmr-logo.png"
            alt="KMR Group Logo"
            width={120}
            height={78}
            priority
            className="h-16 w-auto object-contain drop-shadow-sm shrink-0"
          />
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-surface-900 tracking-tight">
              Welcome to KMR Group
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-surface-500">
              Tyre & Automotive Business Operations System. Select an operational module to begin.
            </p>
          </div>
        </div>
      </div>

      {/* Business Performance KPIs */}
      <DashboardKpis />

      {/* Module cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DASHBOARD_MODULES.map((mod) => {
          const cardContent = (
            <Card
              className={`relative h-full transition-all duration-200 ${
                mod.implemented
                  ? "group-hover:border-primary-300 group-hover:shadow-card-hover cursor-pointer"
                  : "opacity-75"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 group-hover:bg-primary-600 group-hover:text-white transition-colors shrink-0">
                  <NavIcon name={mod.icon} className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2
                      className={`text-base font-semibold ${
                        mod.implemented
                          ? "text-surface-800 group-hover:text-primary-700 transition-colors"
                          : "text-surface-600"
                      }`}
                    >
                      {mod.title}
                    </h2>
                    {!mod.implemented && (
                      <StatusBadge label="Coming soon" variant="neutral" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-surface-500 leading-relaxed">
                    {mod.description}
                  </p>
                </div>
              </div>
            </Card>
          );

          if (mod.implemented) {
            return (
              <Link
                key={mod.title}
                href={mod.href}
                className="group block rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {cardContent}
              </Link>
            );
          }

          return (
            <div key={mod.title} className="block rounded-lg cursor-not-allowed">
              {cardContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
