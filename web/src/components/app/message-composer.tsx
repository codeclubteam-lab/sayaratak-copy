import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { MailIcon } from "lucide-react"

import { useRequireAuth } from "@/features/auth/auth-gate"
import { useStartThread } from "@/features/messaging/queries"
import { messageSchema, type MessageForm } from "@/features/messaging/schemas"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { FormField } from "./form-field"
import { ResponsiveDialog } from "./responsive-dialog"
import { SubmitButton } from "./submit-button"
import { useAppForm } from "@/hooks/use-app-form"

export type MessageSubject = {
  type: "listing" | "dealership" | "workshop" | "mechanic"
  id: string
  title: string
}

// Owns its trigger: the click goes through the sign in gate, then the first message of a thread is sent.
export function MessageComposer({
  subject,
  variant = "outline",
  className,
}: {
  subject: MessageSubject
  variant?: "outline" | "default"
  className?: string
}) {
  const { t } = useT()
  const requireAuth = useRequireAuth()
  const [open, setOpen] = useState(false)
  const { mutate, isPending } = useStartThread()
  const form = useAppForm<MessageForm>({
    resolver: zodResolver(messageSchema),
    mode: "onTouched",
    defaultValues: { body: "" },
  })
  const submit = form.handleSubmit(({ body }) =>
    mutate(
      { subjectType: subject.type, subjectId: subject.id, body },
      {
        onSuccess: () => {
          toast.add({ title: t("toast.message_sent") })
          form.reset()
          setOpen(false)
        },
        onError: (error) => toast.add({ title: errorText(t, error) }),
      }
    )
  )
  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={() => requireAuth(() => setOpen(true), "auth.reason_message")}
      >
        <MailIcon
          aria-hidden="true"
          strokeWidth={1.5}
          data-icon="inline-start"
        />
        {t("listing.message")}
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={t("listing.message_title")}
        description={t("listing.message_about", { title: subject.title })}
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FormField
            label={t("listing.message_label")}
            error={form.formState.errors.body?.message}
          >
            {(control) => (
              <Textarea
                {...control}
                maxLength={1000}
                autoComplete="off"
                {...form.register("body")}
              />
            )}
          </FormField>
          <SubmitButton pending={isPending}>
            {t("listing.message_send")}
          </SubmitButton>
        </form>
      </ResponsiveDialog>
    </>
  )
}
