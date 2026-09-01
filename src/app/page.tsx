import { Card } from "@/components/ui";
import { StatusBadge } from "@/components/ui";

// =============================================================================
// Dashboard — Landing page
// =============================================================================

/** Future module cards displayed on the dashboard */
const DASHBOARD_MODULES = [
  {
    title: "Inventory",
    description: "Track tyre stock levels, sizes, brands, and locations.",
    icon: "📦",
  },
  {
    title: "Sales",
    description: "Record sales, generate invoices, and track revenue.",
    icon: "💰",
  },
  {
    title: "Purchases",
    description: "Manage purchase orders and supplier deliveries.",
    icon: "🛒",
  },
  {
    title: "Customers",
    description: "Customer database, order history, and contact details.",
    icon: "👥",
  },
  {
    title: "Suppliers",
    description: "Supplier directory, pricing, and communication.",
    icon: "🚛",
  },
  {
    title: "Reports",
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
          Your tyre business management system. Modules are being developed and
          will appear here as they become available.
        </p>
      </div>

      {/* Module cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DASHBOARD_MODULES.map((mod) => (
          <Card key={mod.title} className="relative">
            <div className="flex items-start gap-3">
              <span className="text-2xl" role="img" aria-hidden="true">
                {mod.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-surface-800">
                    {mod.title}
                  </h2>
                  <StatusBadge label="Coming soon" variant="neutral" />
                </div>
                <p className="mt-1 text-sm text-surface-500 leading-relaxed">
                  {mod.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
