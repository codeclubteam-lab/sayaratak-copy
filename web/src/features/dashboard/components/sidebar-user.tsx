import { useRouter } from "@tanstack/react-router"
import { GlobeIcon, LogOutIcon } from "lucide-react"

import { initials } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { User } from "@sayaratak/shared/schemas/user"
import { useLogout } from "@/features/auth/queries"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { accountPath } from "../nav-config"
import { SidebarNavItem, itemClass } from "./sidebar-nav-item"

// User card (links to the role's settings or account page), the way back to the public site, and sign out.
export function SidebarUser({ me }: { me: User }) {
  const { t, locale } = useT()
  const router = useRouter()
  const logout = useLogout()
  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarNavItem
          icon={GlobeIcon}
          label={t("dashboard.view_site")}
          href={localeHref("/", locale)}
          active={false}
        />
        <SidebarMenuItem>
          <SidebarMenuButton
            className={itemClass}
            disabled={logout.isPending}
            tooltip={{ children: t("common.sign_out"), side: "inline-end" }}
            onClick={() =>
              logout.mutate(undefined, {
                onSuccess: () => router.history.push(localeHref("/", locale)),
              })
            }
          >
            <LogOutIcon aria-hidden="true" className="rtl:-scale-x-100" />
            <span className="text-ui">{t("common.sign_out")}</span>
          </SidebarMenuButton>
          {logout.isError && (
            <p role="alert" className="px-2 py-1 text-caption text-destructive">
              {t("nav.sign_out_error")}
            </p>
          )}
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip={{ children: me.fullName, side: "inline-end" }}
            className="gap-3 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10!"
            render={<a href={localeHref(accountPath(me.role), locale)} />}
          >
            <Avatar className="size-8">
              {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt="" />}
              <AvatarFallback className="bg-accent text-caption font-semibold text-accent-foreground">
                <bdi>{initials(me.fullName)}</bdi>
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col text-start">
              <span className="truncate text-ui font-semibold">
                <bdi>{me.fullName}</bdi>
              </span>
              <span className="truncate text-caption text-muted-foreground">
                {t(`dashboard.role_${me.role}`)}
              </span>
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}
