import { useT } from "@/lib/i18n/use-t"
import type { User } from "@sayaratak/shared/schemas/user"
import { AccountMenu } from "@/components/app/account-menu"
import { LanguageSwitcher } from "@/components/app/language-switcher"
import { NotificationBell } from "@/components/app/notification-bell"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { CommandMenu } from "./command-menu"
import { useTopbarTitle } from "./page-title"

export function DashboardTopbar({ role }: { role: User["role"] }) {
  const { t } = useT()
  const title = useTopbarTitle()
  return (
    <header className="sticky top-0 z-(--z-sticky) flex h-14 shrink-0 items-center gap-2 bg-card px-4 [view-transition-name:dashboard-topbar] md:px-6">
      <SidebarTrigger aria-label={t("dashboard.toggle_menu")} />
      <p className="min-w-0 flex-1 truncate text-body font-semibold">{title}</p>
      <CommandMenu role={role} />
      <LanguageSwitcher />
      <NotificationBell />
      <AccountMenu />
    </header>
  )
}
