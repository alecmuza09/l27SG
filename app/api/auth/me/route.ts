import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("luna27_session")

    if (!sessionCookie) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const user = JSON.parse(sessionCookie.value)
    return NextResponse.json({ user })
  } catch (error) {
    console.error("[v0] Get user error:", error)
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
