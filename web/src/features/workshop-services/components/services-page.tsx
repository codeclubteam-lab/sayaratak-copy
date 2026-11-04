import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PlusIcon, WrenchIcon } from "lucide-react"

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
  useDeleteService,
  useReorderServices,
} from "@/features/directory/queries"
import { taxonomyQuery } from "@/features/listings/queries"
import { errorText } from "@/lib/api/error-text"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { ServiceFormDialog, type ServiceDraft } from "./service-form-dialog"
import { ServiceRow } from "./service-row"
import { TemplateMenu } from "./template-menu"

const blank = { name: "", description: "", priceFrom: null, templateId: null }

// The workshop's services in the order the public page shows them: add (blank or from a template), edit, delete, move up and down.
export function ServicesPage() {
  const { t, locale } = useT()
  const title = t("dashboard.nav_services")
  usePageTitle(title)
  const list = useQuery(businessQueries.services)
  const taxonomy = useQuery(taxonomyQuery)
  const reorder = useReorderServices()
  const remove = useDeleteService()
  const [draft, setDraft] = useState<ServiceDraft>()
  const { data } = list
  const cap = useQuery(billingQueries.subscription).data?.plan?.serviceLimit
  const reached = cap !== undefined && (data?.length ?? 0) >= cap
  const fail = (error: unknown) => toast.add({ title: errorText(t, error) })

  // A moved row is re-inserted in the DOM, which drops focus; put it back on the same arrow, or on the other one when the row reached an end.
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

  const used = new Set(data?.map((s) => s.templateId))
  const templates = (taxonomy.data?.serviceTemplates ?? [])
    .filter((s) => !used.has(s.id))
    .map((s) => ({ id: s.id, name: s.name[locale] }))
  const addButton = (
    <Button onClick={() => setDraft({ values: blank })}>
      <PlusIcon data-icon="inline-start" aria-hidden="true" />
      {t("dashboard.services_add")}
    </Button>
  )
  const templateMenu = (
    <TemplateMenu
      templates={templates}
      onPick={(s) =>
        setDraft({ values: { ...blank, name: s.name, templateId: s.id } })
      }
    />
  )

  let body
  if (!data)
    body = list.isError ? (
      <SectionError
        message={t("dashboard.services_load_error")}
        onRetry={() => void list.refetch()}
      />
    ) : (
      <div
        role="status"
        aria-label={t("common.loading")}
        className="flex flex-col gap-3 rounded-xl bg-card p-4 md:p-5"
      >
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  else if (data.length === 0)
    body = (
      <EmptyState
        icon={WrenchIcon}
        title={t("dashboard.services_empty_title")}
        body={t("dashboard.services_empty_body")}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {addButton}
            {templateMenu}
          </div>
        }
      />
    )
  else
    body = (
      <section className="rounded-xl bg-card p-4 md:p-5">
        <h2 className="sr-only">{t("dashboard.services_list_title")}</h2>
        <ul className="flex flex-col divide-y divide-border">
          {data.map((s, i) => (
            <ServiceRow
              key={s.id}
              service={s}
              first={i === 0}
              last={i === data.length - 1}
              onMove={(step) => {
                const ids = data.map((r) => r.id)
                ids.splice(i, 1)
                ids.splice(i + step, 0, s.id)
                moved.current = { id: s.id, step }
                reorder.mutate(ids, { onError: fail })
              }}
              onEdit={() =>
                setDraft({
                  id: s.id,
                  values: {
                    name: s.name,
                    description: s.description,
                    priceFrom: s.priceFrom ?? null,
                    templateId: s.templateId,
                  },
                })
              }
              onDelete={() =>
                remove.mutate(s.id, {
                  onSuccess: () =>
                    toast.add({ title: t("toast.service_deleted") }),
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
        hint={t("dashboard.services_hint")}
      >
        {!!data?.length && !reached && (
          <>
            {templateMenu}
            {addButton}
          </>
        )}
      </PageHeader>
      {data && cap !== undefined && (
        <LimitMeter
          label={t("dashboard.services_limit_label")}
          used={data.length}
          limit={cap}
          action={
            <a
              href={localeHref("/workshop/billing", locale)}
              className={buttonVariants({ variant: "link", size: "sm" })}
            >
              {t("post.limit_upgrade")}
            </a>
          }
        />
      )}
      {body}
      <ServiceFormDialog draft={draft} onClose={() => setDraft(undefined)} />
    </div>
  )
}
