import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { FlagIcon } from "lucide-react"
import { Controller } from "react-hook-form"

import { useRequireAuth } from "@/features/auth/auth-gate"
import {
  reportReasons,
  reportSchema,
  type ReportForm,
} from "@sayaratak/shared/listings/schemas"
import { useReportListing } from "@/features/verification/queries"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ChipSingleSelect } from "./chip-single-select"
import { FormField } from "./form-field"
import { ResponsiveDialog } from "./responsive-dialog"
import { SubmitButton } from "./submit-button"
import { useAppForm } from "@/hooks/use-app-form"

// Owns its trigger (the "Report" text button) and sits behind the sign in gate.
export function ReportDialog({
  listingId,
  className,
}: {
  listingId: string
  className?: string
}) {
  const { t } = useT()
  const requireAuth = useRequireAuth()
  const [open, setOpen] = useState(false)
  const { mutate, isPending } = useReportListing()
  const form = useAppForm<ReportForm>({
    resolver: zodResolver(reportSchema),
    mode: "onTouched",
    defaultValues: { details: "" },
  })
  const chosen = form.watch("reason")
  const submit = form.handleSubmit(({ reason, details }) =>
    mutate(
      { listingId, reason, details: details || undefined },
      {
        onSuccess: () => {
          toast.add({ title: t("toast.report_sent") })
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
        variant="ghost"
        className={className}
        onClick={() => requireAuth(() => setOpen(true), "auth.reason_report")}
      >
        <FlagIcon
          aria-hidden="true"
          strokeWidth={1.5}
          data-icon="inline-start"
        />
        {t("listing.report")}
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={t("listing.report_title")}
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Controller
            control={form.control}
            name="reason"
            render={({ field, fieldState }) => (
              <ChipSingleSelect
                legend={t("listing.report_reason")}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                options={reportReasons.map((r) => ({
                  value: r,
                  label: t(
                    r === "other"
                      ? "listing.report_misc"
                      : `listing.report_${r}`
                  ),
                }))}
              />
            )}
          />
          <FormField
            label={t("listing.report_details")}
            optional={chosen !== "other"}
            error={form.formState.errors.details?.message}
          >
            {(control) => (
              <Textarea
                {...control}
                maxLength={500}
                {...form.register("details")}
              />
            )}
          </FormField>
          <SubmitButton pending={isPending}>
            {t("listing.report_send")}
          </SubmitButton>
        </form>
      </ResponsiveDialog>
    </>
  )
}
