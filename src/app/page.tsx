import Link from "next/link";
import { Card } from "@/components/ui";
import { StatusBadge } from "@/components/ui";
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
    icon: "📦",
  },
  {
    title: "Sales",
    href: "/sales",
    implemented: true,
    description: "Record sales, generate invoices, and track payments.",
    icon: "💰",
  },
  {
    title: "Purchases",
    href: "/purchases",
    implemented: true,
    description: "Manage purchase orders, receipts, and supplier deliveries.",
    icon: "🛒",
  },
  {
    title: "Customers",
    href: "/customers",
    implemented: true,
    description: "Manage customer details, order history, and contact information.",
    icon: "👥",
  },
  {
    title: "Suppliers",
    href: "/suppliers",
    implemented: true,
    description: "Manage suppliers, contacts, and procurement information.",
    icon: "🚛",
  },
  {
    title: "Reports",
    href: "/reports",
    implemented: true,
    description: "Business insights, stock reports, and financial summaries.",
    icon: "📊",
  },
] as const;

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome section */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 sm:text-3xl">
          Welcome to Skubase
        </h1>
        <p className="mt-2 text-base text-surface-500 max-w-2xl">
          Your tyre business management system. Select a module below to get started.
        </p>
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
              <div className="flex items-start gap-3">
                <span className="text-2xl" role="img" aria-hidden="true">
                  {mod.icon}
                </span>
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
