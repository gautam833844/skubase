import Link from "next/link";
import { Button } from "@/components/ui";

// =============================================================================
// 404 — Not Found page
// =============================================================================

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-bold text-surface-300">404</h1>
      <h2 className="mt-4 text-xl font-semibold text-surface-800">
        Page not found
      </h2>
      <p className="mt-2 text-base text-surface-500 max-w-md">
        The page you are looking for does not exist or has not been built yet.
      </p>
      <Link href="/" className="mt-6">
        <Button variant="primary" size="md">
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}
