import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  trend?: {
    value: string
    positive: boolean
  }
  color?: "default" | "primary" | "success" | "warning" | "danger"
}

const colorVariants = {
  default: {
    icon: "text-muted-foreground",
    bg: "bg-muted/50",
    border: "border-border",
    value: "text-foreground",
  },
  primary: {
    icon: "text-indigo-600",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    border: "border-indigo-200 dark:border-indigo-800",
    value: "text-indigo-700 dark:text-indigo-300",
  },
  success: {
    icon: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    value: "text-green-700 dark:text-green-300",
  },
  warning: {
    icon: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    value: "text-amber-700 dark:text-amber-300",
  },
  danger: {
    icon: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    value: "text-red-700 dark:text-red-300",
  },
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  color = "default",
}: StatsCardProps) {
  const colors = colorVariants[color]

  return (
    <Card className={cn("relative overflow-hidden transition-all hover:shadow-lg", colors.border)}>
      <div className={cn("absolute inset-0 opacity-5", colors.bg)} />
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("rounded-lg p-2", colors.bg)}>
          <Icon className={cn("h-5 w-5", colors.icon)} />
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className={cn("text-3xl font-bold mb-2", colors.value)}>{value}</div>
        {(description || trend) && (
          <div className="flex items-center gap-2">
            {trend && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                  trend.positive
                    ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                )}
              >
                {trend.positive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.positive ? "+" : ""}
                {trend.value}
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
