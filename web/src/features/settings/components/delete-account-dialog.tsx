import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "@tanstack/react-router"

import { FormField } from "@/components/app/form-field"
import { SubmitButton } from "@/components/app/submit-button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDeleteAccount } from "@/features/auth/queries"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { Role } from "@sayaratak/shared/schemas/fields"
import { deleteAccountSchema, type DeleteAccountForm } from "../schemas"
import { useAppForm } from "@/hooks/use-app-form"

// The person types the word to confirm. Success signs out and goes to the home page.
export function DeleteAccountDialog({ role }: { role: Role }) {
  const { t, locale } = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const remove = useDeleteAccount()
  const form = useAppForm<DeleteAccountForm>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { phrase: "" },
  })
  const submit = form.handleSubmit(() =>
    remove.mutate(undefined, {
      onSuccess: () => router.history.push(localeHref("/", locale)),
    })
  )
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          form.reset()
          remove.reset()
        }
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        {t("settings.delete_button")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={submit} noValidate className="contents">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.delete_dialog_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                role === "user"
                  ? "settings.delete_dialog_user"
                  : "settings.delete_dialog_business"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FormField
            label={t("settings.delete_phrase_label", {
              word: t("settings.delete_phrase_word"),
            })}
            error={form.formState.errors.phrase?.message}
          >
            {(c) => (
              <Input
                {...c}
                {...form.register("phrase")}
                autoComplete="off"
                autoCapitalize="off"
              />
            )}
          </FormField>
          {remove.isError && (
            <p role="alert" className="text-ui text-destructive">
              {t("settings.delete_error")}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <SubmitButton variant="destructive" pending={remove.isPending}>
              {t("settings.delete_confirm")}
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
