import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/lib/i18n/use-t"
import { useDelayedFlag } from "@/lib/use-delayed-flag"
import type { Thread } from "@sayaratak/shared/schemas/messaging"
import type { ChatRow } from "../chat-row"
import { counterpart } from "../counterpart"
import { messagingQueries, useMarkThreadRead, useSendMessage } from "../queries"
import { Composer } from "./composer"
import { MessageList } from "./message-list"
import { ThreadHeader } from "./thread-header"

// One open conversation. Sending is optimistic: the line shows at once, and on failure it stays as "Not sent. Retry". Opening the thread, and every new message that arrives while it is open, marks it read.
export function ThreadView({
  thread,
  meId,
  onBack,
}: {
  thread: Thread
  meId: string
  onBack: () => void
}) {
  const { t } = useT()
  const messages = useQuery(messagingQueries.messages(thread.id))
  const skeleton = useDelayedFlag(messages.isPending)
  const { mutateAsync: sendMessage } = useSendMessage(thread.id)
  const { mutate: markRead } = useMarkThreadRead()
  const [outbox, setOutbox] = useState<ChatRow[]>([])
  const counter = useRef(0)

  const stored = messages.data?.items ?? []
  const unread = stored.filter((m) => m.senderId !== meId && !m.readAt)
  const newestUnread = unread.at(-1)?.id
  const marked = useRef<string>(undefined)
  useEffect(() => {
    if (!newestUnread || marked.current === newestUnread) return
    if (document.visibilityState !== "visible") return
    marked.current = newestUnread
    markRead({ id: thread.id, unread: unread.length })
  }, [newestUnread, unread.length, thread.id, markRead])

  const mark = (id: string, patch: Partial<ChatRow> | null) =>
    setOutbox((rows) =>
      patch
        ? rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
        : rows.filter((r) => r.id !== id)
    )
  const send = (body: string, id = `out-${counter.current++}`) => {
    const row: ChatRow = {
      id,
      senderId: meId,
      body,
      createdAt: new Date().toISOString(),
      state: "sending",
    }
    setOutbox((rows) => [...rows.filter((r) => r.id !== id), row])
    sendMessage({ body }).then(
      () => mark(id, null),
      () => mark(id, { state: "failed" })
    )
  }

  const other = counterpart(thread, meId)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ThreadHeader thread={thread} meId={meId} onBack={onBack} />
      {messages.isError && !messages.data ? (
        <div className="flex-1 p-3">
          <SectionError
            message={t("messages.thread_error")}
            onRetry={() => void messages.refetch()}
          />
        </div>
      ) : messages.isPending ? (
        <div className="flex-1 p-3" aria-busy="true">
          {skeleton && (
            <div aria-hidden="true" className="flex flex-col gap-3">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="ms-auto h-10 w-1/2" />
              <Skeleton className="h-10 w-3/5" />
            </div>
          )}
        </div>
      ) : (
        <MessageList
          rows={[...stored, ...outbox]}
          meId={meId}
          label={t("messages.thread_label", { name: other?.name ?? "" })}
          onRetry={(row) => send(row.body, row.id)}
          onDiscard={(row) => mark(row.id, null)}
        />
      )}
      <Composer onSend={(body) => send(body)} />
    </div>
  )
}
