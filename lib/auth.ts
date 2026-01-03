// Authentication system with HTTP-only cookies

export interface User {
  id: string
  email: string
  name: string
  role: "admin" | "manager" | "staff"
  sucursalId?: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
}

export async function login(email: string, password: string): Promise<User> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || "Credenciales inválidas")
  }

  // Also store in localStorage for client-side access
  if (typeof window !== "undefined") {
    localStorage.setItem("luna27_user", JSON.stringify(data.user))
  }

  return data.user
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
  })

  if (typeof window !== "undefined") {
    localStorage.removeItem("luna27_user")
  }
}

export async function getCurrentUserFromServer(): Promise<User | null> {
  try {
    const response = await fetch("/api/auth/me")
    if (!response.ok) return null

    const data = await response.json()
    return data.user
  } catch {
    return null
  }
}

// Keep client-side function for immediate access
export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null

  const stored = localStorage.getItem("luna27_user")
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

export function checkPermission(user: User | null, requiredRole: User["role"]): boolean {
  if (!user) return false

  const roleHierarchy = { admin: 3, manager: 2, staff: 1 }
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole]
}
