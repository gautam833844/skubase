import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/context";

// =============================================================================
// GET /api/auth/me — Current Authenticated Session Information
// =============================================================================

export async function GET() {
  const auth = await getCurrentUser();

  if (!auth) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: auth.user,
  });
}
