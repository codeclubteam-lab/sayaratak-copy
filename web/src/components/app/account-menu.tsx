import { useQuery } from "@tanstack/react-query"
import { useLocation, useRouter } from "@tanstack/react-router"
import {
  ArrowRightIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SettingsIcon,
  UserRound,
} from "lucide-react"

import { initials } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, isProtectedPath, localeHref } from "@/lib/navigation"
import { meQuery } from "@/features/auth/me-query"
import { useLogout } from "@/features/auth/queries"
import { businessQueries } from "@/features/directory/queries"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AccountMenu() {
  const { t, locale } = useT()
  const { data: me } = useQuery(meQuery)
  const logout = useLogout()
  const router = useRouter()
  const pathname = useLocation({ select: (l) => l.pathname })
  const isBusiness =
    me?.role === "mechanic" ||
    me?.role === "workshop" ||
    me?.role === "dealership"
  const { data: business } = useQuery({
    ...businessQueries.mine,
    enabled: Boolean(me && isBusiness),
  })
  if (!me)
    return (
      <a
        href={localeHref("/auth/login", locale)}
        aria-label={t("common.sign_in")}
        className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-2 text-ui font-medium hover:bg-muted md:h-10"
      >
        <UserRound
          className="size-5 xl:hidden"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <span className="hidden xl:inline">{t("common.sign_in")}</span>
      </a>
    )
  const base = dashboardPath(me.role)
  // An account that has not finished onboarding gets a dot and a first menu item that resumes it.
  const setup = !me.onboardingDone
  const businessPhoto =
    business && "photoUrl" in business
      ? business.photoUrl
      : business && "logoUrl" in business
        ? business.logoUrl
        : undefined
  const photo = me.avatarUrl || businessPhoto
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              setup
                ? `${t("nav.account")}, ${t("nav.finish_setup")}`
                : t("nav.account")
            }
          />
        }
      >
        {photo ? (
          <Avatar className="size-7">
            <AvatarImage src={photo} alt="" />
            <AvatarFallback className="bg-accent text-caption font-semibold text-accent-foreground">
              <bdi>{initials(me.fullName)}</bdi>
            </AvatarFallback>
          </Avatar>
        ) : (
          <UserRound className="size-5" strokeWidth={1.5} aria-hidden="true" />
        )}
        {setup && (
          <span
            aria-hidden="true"
            className="absolute end-2 top-2 size-2 rounded-full bg-primary"
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-2.5 px-3 py-2">
          {photo ? (
            <Avatar className="size-8 shrink-0">
              <AvatarImage src={photo} alt="" />
              <AvatarFallback className="bg-accent text-caption font-semibold text-accent-foreground">
                <bdi>{initials(me.fullName)}</bdi>
              </AvatarFallback>
            </Avatar>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-ui font-semibold" dir="auto">
              {me.fullName}
            </p>
            <p className="truncate text-caption text-muted-foreground">
              {t(`dashboard.role_${me.role}`)}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        {[
          ...(setup
            ? [
                {
                  key: "nav.finish_setup",
                  path: "/onboarding",
                  icon: ArrowRightIcon,
                },
              ]
            : []),
          { key: "nav.dashboard", path: base, icon: LayoutDashboardIcon },
          { key: "nav.settings", path: `${base}/settings`, icon: SettingsIcon },
        ].map((item) => (
          <DropdownMenuItem
            key={item.key}
            render={<a href={localeHref(item.path, locale)} />}
          >
            <item.icon
              className={`text-muted-foreground${item.icon === ArrowRightIcon ? "rtl:-scale-x-100" : ""}`}
            />
            {t(item.key)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          closeOnClick={false}
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, {
              // A public page stays and re-runs its loaders signed out; a protected one goes home.
              onSuccess: () => {
                if (isProtectedPath(pathname))
                  router.history.push(localeHref("/", locale))
                else void router.invalidate()
              },
            })
          }
        >
          <LogOutIcon className="text-muted-foreground rtl:-scale-x-100" />
          {t("common.sign_out")}
        </DropdownMenuItem>
        {logout.isError && (
          <p role="alert" className="px-3 py-2 text-ui text-destructive">
            {t("nav.sign_out_error")}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
