import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loginUser } from "@/services/auth.service";
import { getSessionCookieOptions } from "@/lib/auth/session";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { getUserMessage, isAppError } from "@/lib/errors";

// =============================================================================
// POST /api/auth/login — User Authentication Endpoint
// =============================================================================

export async function POST(request: Request) {
  // 1. CSRF Origin validation
  if (!validateRequestOrigin(request)) {
    return NextResponse.json(
      { success: false, error: "Invalid request origin." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { identifier, password } = body;

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "127.0.0.1";
    const userAgent = request.headers.get("user-agent");

    // 2. Execute login service
    const result = await loginUser({
      identifier,
      password,
      ipAddress,
      userAgent,
    });

    // 3. Set HttpOnly Session Cookie
    const cookieStore = await cookies();
    const cookieOpts = getSessionCookieOptions(result.rawSessionToken);

    cookieStore.set(cookieOpts.name, cookieOpts.value, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
      maxAge: cookieOpts.maxAge,
    });

    return NextResponse.json({
      success: true,
      user: result.user,
    });
  } catch (error) {
    const userMessage = getUserMessage(error);
    const statusCode = isAppError(error) ? error.statusCode : 500;

    return NextResponse.json(
      {
        success: false,
        error: userMessage,
      },
      { status: statusCode }
    );
  }
}
