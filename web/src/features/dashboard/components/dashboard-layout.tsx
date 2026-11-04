import { useQuery } from "@tanstack/react-query"
import { Outlet } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { SidebarProvider } from "@/components/ui/sidebar"
import { meQuery } from "@/features/auth/me-query"
import { PlanReminderDialog } from "@/features/billing/components/plan-reminder-dialog"
import { DashboardSidebar } from "./dashboard-sidebar"
import { DashboardTopbar } from "./dashboard-topbar"
import { PageTitleProvider } from "./page-title"
import { SuspendedNotice } from "./suspended-notice"

// The collapse state lives in the `sidebar_state` cookie that the Sidebar writes. The route is client-only, so the cookie is there at first render.
const sidebarOpen = () => !/(?:^|; )sidebar_state=false/.test(document.cookie)

// Every role mounts this under its own guarded route. The account comes from the session query, so it is gone the moment someone signs out.
export function DashboardLayout() {
  const { t } = useT()
  const { data: me } = useQuery(meQuery)
  if (!me) return null
  return (
    <PageTitleProvider>
      <SidebarProvider defaultOpen={sidebarOpen()}>
        <a
          href="#main-content"
          className="sr-only z-(--z-dialog) rounded-lg bg-primary px-4 py-3 text-ui font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-2"
          onClick={() => document.getElementById("main-content")?.focus()}
        >
          {t("nav.skip_to_content")}
        </a>
        <DashboardSidebar me={me} />
        {me.role !== "admin" && <PlanReminderDialog me={me} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardTopbar role={me.role} />
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1440px] flex-1 p-4 outline-none md:p-6 xl:p-8"
          >
            {me.role !== "user" && me.role !== "admin" && <SuspendedNotice />}
            <Outlet />
          </main>
        </div>
      </SidebarProvider>
    </PageTitleProvider>
  )
}
