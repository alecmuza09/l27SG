import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("luna27_session")
  const isAuthenticated = !!sessionCookie

  console.log("[v0] Middleware - Path:", request.nextUrl.pathname)
  console.log("[v0] Middleware - Authenticated:", isAuthenticated)

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    if (!isAuthenticated) {
      console.log("[v0] Middleware - Redirecting to login (no session)")
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  // Redirect to dashboard if already authenticated and trying to access login
  if (request.nextUrl.pathname === "/" && isAuthenticated) {
    console.log("[v0] Middleware - Redirecting to dashboard (already authenticated)")
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
}
