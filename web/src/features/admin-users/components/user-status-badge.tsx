import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { User } from "@sayaratak/shared/schemas/user"

// Active, or banned with the day a timed ban ends.
export function UserStatusBadge({ user }: { user: User }) {
  const { t, locale } = useT()
  if (!user.banned)
    return <Badge variant="success">{t("admin.user_active")}</Badge>
  return (
    <Badge variant="destructive">
      {user.bannedUntil
        ? t("admin.user_banned_until", {
            date: formatDate(user.bannedUntil, locale),
          })
        : t("admin.user_banned")}
    </Badge>
  )
}
