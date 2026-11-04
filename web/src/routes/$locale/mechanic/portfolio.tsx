import { createFileRoute } from "@tanstack/react-router"

import { dashboardPage } from "@/features/dashboard/overview-route"
import { PortfolioPage } from "@/features/mechanic-portfolio/components/portfolio-page"

export const Route = createFileRoute("/$locale/mechanic/portfolio")({
  ...dashboardPage("/mechanic/portfolio", "dashboard.nav_portfolio"),
  component: PortfolioPage,
})
