import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { useOauthLogin } from "../queries"
import type { Provider } from "./social-buttons"

// The mock handler signs in (or creates) the user whose name is the accountId.
const accounts = {
  google: [
    { name: "Sara Ahmed", email: "sara.ahmed@gmail.com" },
    { name: "Omar Hassan", email: "omar.hassan@gmail.com" },
  ],
  facebook: [
    { name: "Mona Ibrahim", email: "mona.ibrahim@facebook.com" },
    { name: "Khalid Osman", email: "khalid.osman@facebook.com" },
  ],
} as const

export function MockOAuthDialog({
  provider,
  onClose,
  onDone,
}: {
  provider: Provider | null
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useT()
  const oauth = useOauthLogin()
  // Keeps the title and list while the dialog animates out.
  const shown = provider ?? "google"
  return (
    <ResponsiveDialog
      open={provider !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t(`auth.oauth_title_${shown}`)}
    >
      <ul className="flex flex-col gap-1">
        {accounts[shown].map(({ name, email }) => (
          <li key={email}>
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start gap-3 py-2"
              disabled={oauth.isPending}
              onClick={() =>
                oauth.mutate(
                  { provider: shown, accountId: name },
                  {
                    onSuccess: () => {
                      onClose()
                      onDone()
                    },
                  }
                )
              }
            >
              <Avatar>
                <AvatarFallback>{name[0]}</AvatarFallback>
              </Avatar>
              <span className="flex flex-col items-start text-start">
                <bdi className="text-ui">{name}</bdi>
                <bdi className="text-caption text-muted-foreground">
                  {email}
                </bdi>
              </span>
            </Button>
          </li>
        ))}
      </ul>
      {oauth.isError && (
        <p role="alert" className="text-ui text-destructive">
          {errorText(t, oauth.error)}
        </p>
      )}
      {import.meta.env.VITE_DEMO === "true" && (
        <p className="text-caption text-muted-foreground">
          {t("auth.oauth_demo_note")}
        </p>
      )}
      <Button type="button" variant="ghost" onClick={onClose}>
        {t("common.cancel")}
      </Button>
    </ResponsiveDialog>
  )
}
