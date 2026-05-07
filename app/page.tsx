import { LoginForm } from "@/components/auth/login-form"

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="absolute inset-0 bg-[url('/spa-zen-stones-bamboo-subtle-pattern.jpg')] opacity-5 bg-cover bg-center" />
      <div className="relative z-10">
        <LoginForm />
      </div>
    </div>
  )
}
