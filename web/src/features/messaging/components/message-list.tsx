import { useLayoutEffect, useMemo, useRef, useState } from "react"

import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { motionAllowed } from "@/lib/motion"
import { useNow } from "@/lib/now"
import type { ChatRow } from "../chat-row"
import { MessageBubble } from "./message-bubble"
import { NewMessagesChip } from "./new-messages-chip"

const NEAR_BOTTOM_PX = 120
const DAY_MS = 86_400_000

// Messages grouped by day, oldest first. A new message scrolls into view only when the reader is within 120 px of the bottom or sent it; otherwise the "New messages" chip offers the jump (A5b).
export function MessageList({
  rows,
  meId,
  label,
  onRetry,
  onDiscard,
}: {
  rows: ChatRow[]
  meId: string
  label: string
  onRetry: (row: ChatRow) => void
  onDiscard: (row: ChatRow) => void
}) {
  const { t, locale } = useT()
  const now = useNow()
  const box = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const lastId = useRef<string>(undefined)
  const [unseen, setUnseen] = useState(false)

  const days = useMemo(() => {
    const today = formatDate(new Date(now).toISOString(), locale)
    const yesterday = formatDate(new Date(now - DAY_MS).toISOString(), locale)
    const groups: { label: string; rows: ChatRow[] }[] = []
    for (const row of rows) {
      const date = formatDate(row.createdAt, locale)
      const name =
        date === today
          ? t("messages.today")
          : date === yesterday
            ? t("messages.yesterday")
            : date
      const last = groups.at(-1)
      if (last?.label === name) last.rows.push(row)
      else groups.push({ label: name, rows: [row] })
    }
    return groups
  }, [rows, now, locale, t])

  const toBottom = (smooth: boolean) => {
    const el = box.current
    if (!el) return
    if (smooth && motionAllowed() && typeof el.scrollTo === "function")
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    else el.scrollTop = el.scrollHeight
  }
  const onScroll = () => {
    const el = box.current
    if (!el) return
    atBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX
    if (atBottom.current) setUnseen(false)
  }

  useLayoutEffect(() => {
    const last = rows.at(-1)
    const previous = lastId.current
    lastId.current = last?.id
    if (!last || last.id === previous) return
    // The first paint, a message of the reader's own, or a reader already near the end: follow the thread.
    if (previous === undefined || last.senderId === meId || atBottom.current)
      toBottom(false)
    else setUnseen(true)
  }, [rows, meId])

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={box}
        role="log"
        aria-label={label}
        tabIndex={0}
        onScroll={onScroll}
        className="h-full overflow-y-auto overscroll-contain p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ol className="flex flex-col gap-4">
          {days.map((day) => (
            <li key={day.label}>
              <h3 className="mb-2 text-center text-caption text-muted-foreground">
                {day.label}
              </h3>
              <ul className="flex flex-col gap-2">
                {day.rows.map((row) => (
                  <MessageBubble
                    key={row.id}
                    row={row}
                    own={row.senderId === meId}
                    onRetry={onRetry}
                    onDiscard={onDiscard}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
      {unseen && (
        <NewMessagesChip
          onPress={() => {
            toBottom(true)
            setUnseen(false)
          }}
        />
      )}
    </div>
  )
}
