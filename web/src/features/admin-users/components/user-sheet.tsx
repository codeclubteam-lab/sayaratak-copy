import { useState } from "react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { AdminUser } from "@sayaratak/shared/schemas/admin"
import { BanDialog } from "@/features/admin/components/ban-dialog"
import { EntitySheet } from "@/features/admin/components/entity-sheet"
import { useBanUser, useUnbanUser } from "@/features/admin/queries"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { UserDetails } from "./user-details"

// One person with Ban or Unban. Both ask first; an admin account cannot be banned, so it has no footer.
export function UserSheet({
  open,
  user,
  missing,
  onClose,
}: {
  open: boolean
  user: AdminUser | undefined
  // The `id` in the URL matches nobody.
  missing: boolean
  onClose: () => void
}) {
  const { t } = useT()
  const [dialog, setDialog] = useState<"ban" | "unban" | null>(null)
  const ban = useBanUser()
  const unban = useUnbanUser()
  const settle = (done: string) => ({
    onSuccess: () => {
      setDialog(null)
      toast.add({ title: done })
    },
    onError: (e: unknown) => toast.add({ title: errorText(t, e) }),
  })
  const footer =
    user && user.role !== "admin" ? (
      user.banned ? (
        <Button type="button" onClick={() => setDialog("unban")}>
          {t("admin.unban")}
        </Button>
      ) : (
        <Button
          type="button"
          variant="destructive"
          onClick={() => setDialog("ban")}
        >
          {t("admin.ban")}
        </Button>
      )
    ) : undefined

  return (
    <>
      <EntitySheet
        open={open}
        onOpenChange={(next) => !next && onClose()}
        title={t("admin.user_sheet_title")}
        footer={footer}
      >
        {missing ? (
          <p className="text-body text-muted-foreground">
            {t("admin.user_not_found")}
          </p>
        ) : !user ? (
          <div className="flex flex-col gap-4" aria-hidden="true">
            <Skeleton className="h-14" />
            <Skeleton className="h-40" />
            <Skeleton className="h-28" />
          </div>
        ) : (
          <UserDetails user={user} />
        )}
      </EntitySheet>
      {user && (
        <>
          <BanDialog
            open={dialog === "ban"}
            onOpenChange={(next) => !next && setDialog(null)}
            name={user.fullName}
            pending={ban.isPending}
            onConfirm={(value) =>
              ban.mutate(
                { id: user.id, ...value },
                settle(t("admin.user_banned_toast"))
              )
            }
          />
          <ConfirmDialog
            open={dialog === "unban"}
            onOpenChange={(next) => !next && setDialog(null)}
            title={t("admin.unban_title", { name: user.fullName })}
            description={t("admin.unban_body")}
            confirmLabel={t("admin.unban")}
            pending={unban.isPending}
            onConfirm={() =>
              unban.mutate(user.id, settle(t("admin.user_unbanned_toast")))
            }
          />
        </>
      )}
    </>
  )
}
