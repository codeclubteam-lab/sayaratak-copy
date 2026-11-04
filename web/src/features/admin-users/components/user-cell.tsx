import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initials } from "@/lib/format"
import type { AdminUser } from "@sayaratak/shared/schemas/admin"

// Avatar, name and id as one button that opens the person's sheet.
export function UserCell({
  user,
  onOpen,
}: {
  user: AdminUser
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 max-w-64 min-w-0 items-center gap-3 rounded-lg text-start motion-color hover:text-primary"
    >
      <Avatar className="size-10 shrink-0">
        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
        <AvatarFallback className="bg-accent text-caption font-semibold text-accent-foreground">
          <bdi>{initials(user.fullName)}</bdi>
        </AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-ui font-medium">
          <bdi>{user.fullName}</bdi>
        </span>
        <span className="text-caption text-muted-foreground">
          <bdi>{user.id}</bdi>
        </span>
      </span>
    </button>
  )
}
