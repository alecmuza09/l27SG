import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

// Mock users for development
const MOCK_USERS = [
  {
    id: "1",
    email: "admin@luna27.com",
    name: "Admin Luna27",
    role: "admin",
  },
  {
    id: "2",
    email: "manager@luna27.com",
    name: "Manager Sucursal Centro",
    role: "manager",
    sucursalId: "1",
  },
  {
    id: "3",
    email: "staff@luna27.com",
    name: "María González",
    role: "staff",
    sucursalId: "1",
  },
]

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800))

    // Validate credentials
    const user = MOCK_USERS.find((u) => u.email === email)

    if (!user || password !== "demo123") {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })
    }

    // Create session token (in production, use JWT or secure session ID)
    const sessionData = JSON.stringify(user)
    const cookieStore = await cookies()

    // Set HTTP-only cookie for security
    cookieStore.set("luna27_session", sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    return NextResponse.json({ user, success: true })
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 })
  }
}
