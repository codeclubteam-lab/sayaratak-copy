import { MediaImage } from "@/components/app/media-image"
import { RelativeTime } from "@/components/app/relative-time"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatNumber, initials } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Thread } from "@sayaratak/shared/schemas/messaging"
import { counterpart } from "../counterpart"

// One row of the inbox: who, what it is about, the last words, and how many are unread.
export function ThreadItem({
  thread,
  meId,
  active,
  onOpen,
}: {
  thread: Thread
  meId: string
  active: boolean
  onOpen: (id: string) => void
}) {
  const { t, locale } = useT()
  const other = counterpart(thread, meId)
  const { unreadCount, lastMessage, subjectImage } = thread
  const count = formatNumber(unreadCount, locale)
  return (
    <li>
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={() => onOpen(thread.id)}
        className={`flex min-h-14 w-full items-start gap-3 rounded-lg p-3 text-start motion-color hover:bg-muted ${active ? "bg-muted" : ""}`}
      >
        <Avatar size="lg">
          <AvatarImage src={other?.avatarUrl ?? undefined} alt="" />
          <AvatarFallback>{initials(other?.name ?? "")}</AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={`truncate text-ui ${unreadCount ? "font-semibold" : "font-medium"}`}
            >
              <bdi>{other?.name}</bdi>
            </span>
            <RelativeTime
              iso={lastMessage.createdAt}
              className="shrink-0 text-caption text-muted-foreground"
            />
          </span>
          <span className="flex items-center gap-2 text-caption text-muted-foreground">
            {subjectImage && (
              <MediaImage
                src={subjectImage}
                alt=""
                sizes="24px"
                className="aspect-square size-6 shrink-0 rounded-lg"
              />
            )}
            <span className="truncate">
              <bdi>{thread.subjectTitle[locale]}</bdi>
            </span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span
              className={`truncate text-ui ${unreadCount ? "text-foreground" : "text-muted-foreground"}`}
            >
              {lastMessage.senderId === meId && `${t("messages.you")} `}
              <bdi>{lastMessage.body}</bdi>
            </span>
            {unreadCount > 0 && (
              <>
                <span className="sr-only">
                  {t("dashboard.count_new", { number: count })}
                </span>
                <Badge variant="primary" aria-hidden="true" className="num">
                  {count}
                </Badge>
              </>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}
