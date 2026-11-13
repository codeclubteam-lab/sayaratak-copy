import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ImagesIcon, PlusIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { LimitMeter } from "@/components/app/limit-meter"
import { PageHeader } from "@/components/app/page-header"
import { SectionError } from "@/components/app/section-error"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { billingQueries } from "@/features/billing/queries"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import {
  businessQueries,
  useDeletePortfolioItem,
  useReorderPortfolio,
} from "@/features/directory/queries"
import { errorText } from "@/lib/api/error-text"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import {
  PortfolioFormDialog,
  type PortfolioDraft,
} from "./portfolio-form-dialog"
import { PortfolioItem } from "./portfolio-item"

// Photos of finished jobs in the order the public page shows them: add, edit caption, move earlier and later, delete.
export function PortfolioPage() {
  const { t, locale } = useT()
  const title = t("dashboard.nav_portfolio")
  usePageTitle(title)
  const list = useQuery(businessQueries.portfolio)
  const reorder = useReorderPortfolio()
  const remove = useDeletePortfolioItem()
  const [draft, setDraft] = useState<PortfolioDraft>()
  const { data } = list
  const cap = useQuery(billingQueries.subscription).data?.plan?.portfolioLimit
  const reached = cap !== undefined && (data?.length ?? 0) >= cap
  const fail = (error: unknown) => toast.add({ title: errorText(t, error) })

  // A moved item is re-inserted in the DOM, which drops focus; put it back on the same arrow, or on the other one when the item reached an end.
  const moved = useRef<{ id: string; step: number }>(undefined)
  useEffect(() => {
    const m = moved.current
    if (!m) return
    moved.current = undefined
    const button = (step: number) =>
      document.querySelector<HTMLButtonElement>(`[data-move="${m.id}:${step}"]`)
    const same = button(m.step)
    ;(same && !same.disabled ? same : button(-m.step))?.focus()
  }, [data])

  const addButton = (
    <Button onClick={() => setDraft({ caption: "" })}>
      <PlusIcon data-icon="inline-start" aria-hidden="true" />
      {t("dashboard.portfolio_add")}
    </Button>
  )

  let body
  if (!data)
    body = list.isError ? (
      <SectionError
        message={t("dashboard.portfolio_load_error")}
        onRetry={() => void list.refetch()}
      />
    ) : (
      <div
        role="status"
        aria-label={t("common.loading")}
        className="grid grid-cols-2 gap-4 rounded-xl bg-card p-4 sm:grid-cols-3 md:p-5 lg:grid-cols-4"
      >
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
        ))}
      </div>
    )
  else if (data.length === 0)
    body = (
      <EmptyState
        icon={ImagesIcon}
        title={t("dashboard.portfolio_empty_title")}
        body={t("dashboard.portfolio_empty_body")}
        action={addButton}
      />
    )
  else
    body = (
      <section className="rounded-xl bg-card p-4 md:p-5">
        <h2 className="sr-only">{t("dashboard.portfolio_list_title")}</h2>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((p, i) => (
            <PortfolioItem
              key={p.id}
              item={p}
              first={i === 0}
              last={i === data.length - 1}
              onMove={(step) => {
                const ids = data.map((r) => r.id)
                ids.splice(i, 1)
                ids.splice(i + step, 0, p.id)
                moved.current = { id: p.id, step }
                reorder.mutate(ids, { onError: fail })
              }}
              onEdit={() =>
                setDraft({
                  id: p.id,
                  caption: p.caption,
                  image: {
                    id: p.id,
                    url: p.url,
                    width: p.width,
                    height: p.height,
                    placeholderColor: p.placeholderColor,
                    type: "image",
                    posterUrl: null,
                  },
                })
              }
              onDelete={() =>
                remove.mutate(p.id, {
                  onSuccess: () =>
                    toast.add({ title: t("toast.portfolio_deleted") }),
                  onError: fail,
                })
              }
            />
          ))}
        </ul>
      </section>
    )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        count={data?.length ? formatNumber(data.length, locale) : undefined}
        hint={t("dashboard.portfolio_hint")}
      >
        {!!data?.length && !reached && addButton}
      </PageHeader>
      {data && cap !== undefined && (
        <LimitMeter
          label={t("dashboard.portfolio_limit_label")}
          used={data.length}
          limit={cap}
          action={
            <a
              href={localeHref("/mechanic/billing", locale)}
              className={buttonVariants({ variant: "link", size: "sm" })}
            >
              {t("post.limit_upgrade")}
            </a>
          }
        />
      )}
      {body}
      <PortfolioFormDialog draft={draft} onClose={() => setDraft(undefined)} />
    </div>
  )
}
