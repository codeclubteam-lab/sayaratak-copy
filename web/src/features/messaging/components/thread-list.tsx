import type { ReactNode } from "react"
import { InboxIcon, SearchXIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { useDelayedFlag } from "@/lib/use-delayed-flag"
import { useT } from "@/lib/i18n/use-t"
import type { Thread } from "@sayaratak/shared/schemas/messaging"
import { counterpart } from "../counterpart"
import type { MessagesSearch } from "../schemas"
import { ThreadItem } from "./thread-item"
import { ThreadToolbar } from "./thread-toolbar"

// Search text matches the name, the subject and the last words, in the page language.
function matches(thread: Thread, meId: string, q: string, locale: "ar" | "en") {
  const text = [
    counterpart(thread, meId)?.name,
    thread.subjectTitle[locale],
    thread.lastMessage.body,
  ]
    .join(" ")
    .toLocaleLowerCase(locale)
  return text.includes(q.toLocaleLowerCase(locale))
}

export function ThreadList({
  threads,
  loading,
  error,
  onRetry,
  meId,
  search,
  emptyTitle,
  emptyAction,
  onSearch,
  onFilter,
  onOpen,
}: {
  threads: Thread[] | undefined
  loading: boolean
  error: boolean
  onRetry: () => void
  meId: string
  search: MessagesSearch
  emptyTitle: string
  emptyAction: ReactNode
  onSearch: (value: string) => void
  onFilter: (filter: MessagesSearch["filter"]) => void
  onOpen: (id: string) => void
}) {
  const { t, locale } = useT()
  const skeleton = useDelayedFlag(loading)
  const shown = (threads ?? []).filter(
    (x) =>
      (search.filter === "all" || x.unreadCount > 0) &&
      (!search.q || matches(x, meId, search.q, locale))
  )
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ThreadToolbar
        q={search.q}
        filter={search.filter}
        onSearch={onSearch}
        onFilter={onFilter}
      />
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
        aria-busy={loading}
      >
        {error ? (
          <SectionError
            message={t("messages.threads_error")}
            onRetry={onRetry}
          />
        ) : loading ? (
          skeleton && (
            <ul aria-hidden="true" className="flex flex-col gap-1">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="flex gap-3 p-3">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : threads?.length === 0 ? (
          <div className="px-2">
            <EmptyState
              icon={InboxIcon}
              title={emptyTitle}
              body={t("messages.empty_body")}
              action={emptyAction}
            />
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={SearchXIcon}
            title={t("messages.no_match")}
            className="py-8"
          />
        ) : (
          <ul aria-label={t("messages.list_label")} className="flex flex-col">
            {shown.map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                meId={meId}
                active={thread.id === search.thread}
                onOpen={onOpen}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
