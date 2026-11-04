import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { MessageSquareIcon, MessageSquareXIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { ShellLink } from "@/components/app/shell-link"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { meQuery } from "@/features/auth/me-query"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { businessQueries } from "@/features/directory/queries"
import { useT } from "@/lib/i18n/use-t"
import { messagingQueries } from "../queries"
import {
  messagesSearchSchema,
  pruneMessagesSearch,
  type MessagesSearch,
} from "../schemas"
import { ThreadList } from "./thread-list"
import { ThreadView } from "./thread-view"

const publicBase = {
  dealership: "dealerships",
  workshop: "workshops",
  mechanic: "mechanics",
} as const

// The inbox of every dashboard except admin (steps 9.6, 10.4, 11.6 and 12.5 mount it). Two panes from `lg`; below it one pane, chosen by `?thread=`. The URL holds the open thread, the search text and the unread switch.
export function MessagesPage({
  labelKey,
}: {
  labelKey: "messages" | "inquiries"
}) {
  const { t } = useT()
  const search = messagesSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  // Stable, so the search box keeps its pause between keystrokes.
  const onNavigate = useCallback(
    (next: ReturnType<typeof pruneMessagesSearch>, replace: boolean) =>
      void navigate({
        to: ".",
        search: next,
        replace,
        resetScroll: false,
        viewTransition: false,
      }),
    [navigate]
  )
  const title = t(`dashboard.nav_${labelKey}`)
  usePageTitle(title)
  const me = useQuery(meQuery).data
  const threads = useQuery(messagingQueries.threads)
  const business = useQuery({
    ...businessQueries.mine,
    enabled: !!me && me.role !== "user",
  }).data
  const go = (next: Partial<MessagesSearch>, replace: boolean) =>
    onNavigate(pruneMessagesSearch({ ...search, ...next }), replace)

  const base =
    me?.role === "dealership" ||
    me?.role === "workshop" ||
    me?.role === "mechanic"
      ? publicBase[me.role]
      : undefined
  const emptyAction = base ? (
    business && (
      <ShellLink
        path={`/${base}/${business.slug}`}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        {t("messages.empty_profile")}
      </ShellLink>
    )
  ) : (
    <ShellLink
      path="/vehicles/cars/sale"
      className={cn(buttonVariants({ variant: "outline" }))}
    >
      {t("messages.empty_browse")}
    </ShellLink>
  )

  const active = threads.data?.find((x) => x.id === search.thread)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <div className="grid h-[calc(100dvh-13rem)] min-h-120 gap-4 lg:grid-cols-[minmax(20rem,24rem)_1fr]">
        <section
          aria-label={t("messages.list_label")}
          className={`min-h-0 flex-col rounded-xl bg-card ${search.thread ? "hidden lg:flex" : "flex"}`}
        >
          {me && (
            <ThreadList
              threads={threads.data}
              loading={threads.isPending}
              error={threads.isError && !threads.data}
              onRetry={() => void threads.refetch()}
              meId={me.id}
              search={search}
              emptyTitle={t(
                labelKey === "inquiries"
                  ? "messages.empty_inquiries_title"
                  : "messages.empty_title"
              )}
              emptyAction={emptyAction}
              onSearch={(q) => go({ q: q.trim() || undefined }, true)}
              onFilter={(filter) => go({ filter }, true)}
              onOpen={(id) => go({ thread: id }, false)}
            />
          )}
        </section>
        <section
          className={`min-h-0 flex-col rounded-xl bg-card ${search.thread ? "flex" : "hidden lg:flex"}`}
        >
          {me && active ? (
            <ThreadView
              key={active.id}
              thread={active}
              meId={me.id}
              onBack={() => go({ thread: undefined }, false)}
            />
          ) : (
            <div className="px-4" aria-busy={threads.isPending}>
              {search.thread && threads.data ? (
                <EmptyState
                  icon={MessageSquareXIcon}
                  title={t("messages.thread_gone")}
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => go({ thread: undefined }, false)}
                    >
                      {t("messages.back")}
                    </Button>
                  }
                />
              ) : (
                !search.thread && (
                  <EmptyState
                    icon={MessageSquareIcon}
                    title={t("messages.pick_title")}
                    body={t("messages.pick_body")}
                  />
                )
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
