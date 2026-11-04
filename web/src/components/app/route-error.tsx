import type { ErrorComponentProps } from "@tanstack/react-router"
import { useRouteContext, useRouter } from "@tanstack/react-router"

import { buttonVariants, Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api/client"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, localeHref } from "@/lib/navigation"
import { NotFound } from "./not-found"
import { StatePanel } from "./state-panel"

// A12: 404 shows the not-found page, 403 the forbidden state, anything else (5xx, network, render crash) offers a retry.
export function RouteError({ error }: ErrorComponentProps) {
  const { t, locale } = useT()
  const router = useRouter()
  const me = useRouteContext({ from: "__root__", select: (c) => c.me })
  const home = (
    <a
      href={localeHref("/", locale)}
      className={cn(buttonVariants({ variant: "outline" }))}
    >
      {t("error.go_home")}
    </a>
  )
  if (error instanceof ApiError && error.status === 404) return <NotFound />
  if (error instanceof ApiError && error.status === 403) {
    return (
      <StatePanel title={t("error.forbidden")} role="alert">
        {me && (
          <a
            href={localeHref(dashboardPath(me.role), locale)}
            className={buttonVariants()}
          >
            {t("nav.account")}
          </a>
        )}
        {home}
      </StatePanel>
    )
  }
  return (
    <StatePanel
      title={t("error.load_title")}
      body={t("error.load")}
      role="alert"
    >
      <Button onClick={() => void router.invalidate()}>
        {t("common.retry")}
      </Button>
      {home}
    </StatePanel>
  )
}
