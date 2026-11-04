import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useWatch } from "react-hook-form"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { useSendBroadcast } from "@/features/admin/queries"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { FormField } from "@/components/app/form-field"
import { LeaveGuard } from "@/components/app/leave-guard"
import { SubmitButton } from "@/components/app/submit-button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { useAppForm } from "@/hooks/use-app-form"
import {
  broadcastFormDefaults,
  broadcastFormSchema,
  toBroadcastInput,
  type BroadcastForm as Values,
} from "../schemas"
import { AudienceFields } from "./audience-fields"
import { BroadcastPreview } from "./broadcast-preview"
import { BroadcastTextFields } from "./broadcast-text-fields"
import { RecipientEstimate } from "./recipient-estimate"

// Message, audience and the live estimate on one side, the bell preview on the other. Send asks first, because a broadcast cannot be taken back.
export function BroadcastForm() {
  const { t } = useT()
  const send = useSendBroadcast()
  const [confirm, setConfirm] = useState<Values>()
  const form = useAppForm<Values>({
    resolver: zodResolver(broadcastFormSchema),
    mode: "onTouched",
    defaultValues: broadcastFormDefaults,
  })
  const [titleAr, titleEn, bodyAr, bodyEn, roles, cityId, verifiedOnly] =
    useWatch({
      control: form.control,
      name: [
        "titleAr",
        "titleEn",
        "bodyAr",
        "bodyEn",
        "roles",
        "cityId",
        "verifiedOnly",
      ],
    })
  const audience = { roles, cityId: cityId || undefined, verifiedOnly }
  const onConfirm = () => {
    if (!confirm) return
    send.mutate(toBroadcastInput(confirm), {
      onSuccess: () => {
        toast.add({ title: t("admin.broadcast_queued") })
        form.reset(broadcastFormDefaults)
      },
      onError: (e) => toast.add({ title: errorText(t, e) }),
      onSettled: () => setConfirm(undefined),
    })
  }
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form
        noValidate
        onSubmit={form.handleSubmit(setConfirm)}
        className="flex flex-col gap-6 rounded-xl bg-card p-4"
      >
        <BroadcastTextFields form={form} />
        <FormField
          optional
          label={t("admin.broadcast_link")}
          description={t("admin.broadcast_link_hint")}
          error={form.formState.errors.href?.message}
        >
          {(props) => (
            <Input
              {...props}
              dir="ltr"
              maxLength={200}
              {...form.register("href")}
            />
          )}
        </FormField>
        <AudienceFields form={form} />
        <div className="flex flex-wrap items-center gap-4 border-t pt-4">
          <SubmitButton pending={send.isPending}>
            {t("admin.broadcast_send")}
          </SubmitButton>
          <p className="text-ui text-muted-foreground">
            <RecipientEstimate audience={audience} />
          </p>
        </div>
      </form>
      <BroadcastPreview
        title={{ ar: titleAr, en: titleEn }}
        body={{ ar: bodyAr, en: bodyEn }}
      />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(undefined)}
        title={t("admin.broadcast_confirm_title")}
        description={
          <>
            <RecipientEstimate audience={audience} />{" "}
            {t("admin.broadcast_confirm_body")}
          </>
        }
        confirmLabel={t("admin.broadcast_send")}
        pending={send.isPending}
        onConfirm={onConfirm}
      />
      <LeaveGuard when={form.formState.isDirty && !confirm} />
    </div>
  )
}
