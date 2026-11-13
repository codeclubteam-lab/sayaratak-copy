import { useQuery } from "@tanstack/react-query"
import { useLocation } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { User } from "@sayaratak/shared/schemas/user"
import { BrandLogo } from "@/components/app/brand-logo"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { SidebarPlanCard } from "@/features/billing/components/sidebar-plan-card"
import { countsQuery } from "@/features/notifications/counts-query"
import { navConfig, navHref } from "../nav-config"
import { SidebarNavItem } from "./sidebar-nav-item"
import { SidebarUser } from "./sidebar-user"

// The overview matches only itself; every other item also matches the pages below it.
const isActive = (pathname: string, href: string, root: boolean) => {
  const path = pathname.replace(/\/$/, "")
  return path === href || (!root && path.startsWith(`${href}/`))
}

export function DashboardSidebar({ me }: { me: User }) {
  const { t, locale } = useT()
  const pathname = useLocation({ select: (l) => l.pathname })
  const { data: counts } = useQuery(countsQuery)
  return (
    <Sidebar
      collapsible="icon"
      role="complementary"
      aria-label={t("dashboard.menu")}
      label={t("dashboard.menu")}
      className="[view-transition-name:dashboard-sidebar]"
    >
      <SidebarHeader className="px-4 py-4 group-data-[collapsible=icon]:h-14 group-data-[collapsible=icon]:p-0">
        <div className="flex items-center justify-center group-data-[collapsible=icon]:hidden">
          <BrandLogo />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label={t("dashboard.menu")} className="flex flex-col gap-2">
          {navConfig[me.role].map((group, i) => (
            <SidebarGroup key={i} className="not-first:mt-4">
              {group.key && (
                <SidebarGroupLabel>{t(group.key)}</SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const href = localeHref(navHref(me.role, item.path), locale)
                    return (
                      <SidebarNavItem
                        key={item.key}
                        icon={item.icon}
                        label={t(item.key)}
                        href={href}
                        active={isActive(pathname, href, !item.path)}
                        count={item.count && counts?.[item.count]}
                      />
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      {me.role !== "admin" && (
        <>
          <SidebarPlanCard me={me} />
          <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
        </>
      )}
      <SidebarUser me={me} />
    </Sidebar>
  )
}
