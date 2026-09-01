import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logoutUser } from "@/services/auth.service";
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from "@/lib/auth/session";
import { validateRequestOrigin } from "@/lib/auth/csrf";

// =============================================================================
// POST /api/auth/logout — User Session Termination Endpoint
// =============================================================================

export async function POST(request: Request) {
  // 1. CSRF Origin validation
  if (!validateRequestOrigin(request)) {
    return NextResponse.json(
      { success: false, error: "Invalid request origin." },
      { status: 403 }
    );
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (sessionCookie?.value) {
    await logoutUser(sessionCookie.value);
  }

  // Clear session cookie
  const clearOpts = getSessionCookieOptions("");
  cookieStore.set(clearOpts.name, "", {
    httpOnly: clearOpts.httpOnly,
    secure: clearOpts.secure,
    sameSite: clearOpts.sameSite,
    path: clearOpts.path,
    maxAge: 0,
  });

  return NextResponse.json({ success: true });
}
