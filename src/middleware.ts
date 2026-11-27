import { NextResponse, type NextRequest } from "next/server";
import { PROJECT_COOKIE } from "@/lib/cookies";

export function middleware(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/p\/([^/]+)/);
  const response = NextResponse.next();
  const key = match?.[1];
  if (key) {
    response.cookies.set({
      name: PROJECT_COOKIE,
      value: decodeURIComponent(key).toUpperCase(),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  matcher: ["/p/:path*"],
};
