import { useQuery } from "@tanstack/react-query"
import { createStore, useSelector } from "@tanstack/react-store"
import { Check, Circle, X } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { businessQueries } from "@/features/directory/queries"
import { verificationQuery } from "@/features/verification/queries"
import { UsageMeter } from "@/components/app/usage-meter"
import { Button } from "@/components/ui/button"
import { setupItems } from "../setup-items"

// Client only: the dashboards do not server-render, so nothing here reaches a visitor's HTML.
export const setupDismissed = createStore(false)

// The card on top of every business dashboard overview. It recomputes from the profile on each visit, hides at 100 percent and can be hidden until the tab closes.
export function SetupChecklist() {
  const { t, locale } = useT()
  const business = useQuery(businessQueries.mine)
  const verification = useQuery(verificationQuery)
  const dismissed = useSelector(setupDismissed, (s) => s)
  if (dismissed || !business.data || verification.isPending) return null
  const items = setupItems(
    business.data,
    verification.data?.status === "pending"
  )
  // A turned-down request reopens the item; its reason shows so the owner knows what to fix.
  const rejected =
    verification.data?.status === "rejected" && !business.data.verified
      ? verification.data
      : undefined
  const done = items.filter((i) => i.done).length
  if (done === items.length) return null
  return (
    <section
      aria-labelledby="setup-title"
      className="flex flex-col gap-4 rounded-xl bg-card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="setup-title" className="text-title font-semibold">
          {t("dashboard.setup_title")}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("dashboard.setup_dismiss")}
          onClick={() => setupDismissed.setState(() => true)}
        >
          <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </Button>
      </div>
      <UsageMeter
        label={t("dashboard.setup_progress")}
        used={done}
        limit={items.length}
      />
      <ul className="flex flex-col">
        {items.map((item) => {
          const Icon = item.done ? Check : Circle
          const row = (
            <>
              <Icon
                className={`size-5 shrink-0 ${item.done ? "text-success" : "text-muted-foreground"}`}
                strokeWidth={1.5}
                aria-hidden="true"
              />
              {rejected && item.key === "dashboard.setup_verification" ? (
                <span className="flex flex-col">
                  <span>{t("dashboard.setup_verification_again")}</span>
                  {rejected.rejectionReason && (
                    <span
                      dir="auto"
                      className="text-caption font-normal text-muted-foreground"
                    >
                      {t("verification.rejected_reason", {
                        reason: rejected.rejectionReason,
                      })}
                    </span>
                  )}
                </span>
              ) : (
                <span>{t(item.key)}</span>
              )}
              {item.done && (
                <span className="sr-only">{t("dashboard.setup_done")}</span>
              )}
            </>
          )
          return (
            <li key={item.key}>
              {item.done ? (
                <p className="flex min-h-11 items-center gap-3 text-ui text-muted-foreground">
                  {row}
                </p>
              ) : (
                <a
                  href={localeHref(item.href, locale)}
                  className="flex min-h-11 items-center gap-3 text-ui font-medium hover:underline"
                >
                  {row}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
