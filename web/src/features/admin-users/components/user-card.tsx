import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { AdminUser } from "@sayaratak/shared/schemas/admin"
import { UserCell } from "./user-cell"
import { UserContact } from "./user-contact"
import { UserStatusBadge } from "./user-status-badge"

// One person below md: the name button, contact, role and status, then when they joined.
export function UserCard({
  user,
  onOpen,
}: {
  user: AdminUser
  onOpen: () => void
}) {
  const { t, locale } = useT()
  return (
    <article className="flex flex-col gap-2 border-b p-3 in-[li:last-child]:border-b-0">
      <UserCell user={user} onOpen={onOpen} />
      <span className="text-ui">
        <UserContact user={user} />
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption">{t(`dashboard.role_${user.role}`)}</span>
        <UserStatusBadge user={user} />
      </div>
      <p className="text-caption text-muted-foreground">
        {t("admin.user_joined", { date: formatDate(user.createdAt, locale) })}
      </p>
    </article>
  )
}
