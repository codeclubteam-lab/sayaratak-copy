import { createFileRoute } from "@tanstack/react-router"

import { requireRole } from "@/features/auth/guards"
import { DashboardLayout } from "@/features/dashboard/components/dashboard-layout"

// Client-only behind the guard (A6): the dashboards never render on the server.
export const Route = createFileRoute("/$locale/admin")({
  ssr: false,
  beforeLoad: requireRole("admin"),
  component: DashboardLayout,
})
