import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"

import { FieldError } from "@/components/app/field-error"
import { FormField } from "@/components/app/form-field"
import { ImageUploader } from "@/components/app/image-uploader"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import {
  useAddPortfolioItem,
  useUpdatePortfolioItem,
} from "@/features/directory/queries"
import { useAppForm } from "@/hooks/use-app-form"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { Media } from "@sayaratak/shared/schemas/listing"
import { portfolioFormSchema, type PortfolioForm } from "../schemas"

// A new item (photo and caption) or a saved one (its id; only the caption changes).
export type PortfolioDraft = { id?: string; caption: string }

function PortfolioFormBody({
  draft,
  onDone,
}: {
  draft: PortfolioDraft
  onDone: () => void
}) {
  const { t } = useT()
  const add = useAddPortfolioItem()
  const update = useUpdatePortfolioItem()
  const [image, setImage] = useState<Media[]>([])
  const form = useAppForm<PortfolioForm>({
    resolver: zodResolver(portfolioFormSchema),
    mode: "onTouched",
    // A saved item keeps its photo, so the id only fills the required field.
    defaultValues: { imageId: draft.id ?? "", caption: draft.caption },
  })
  const { errors } = form.formState
  const done = (key: string) => () => {
    toast.add({ title: t(key) })
    onDone()
  }
  const fail = (error: unknown) => toast.add({ title: errorText(t, error) })
  const submit = form.handleSubmit((values) =>
    draft.id
      ? update.mutate(
          { id: draft.id, caption: values.caption },
          { onSuccess: done("toast.portfolio_saved"), onError: fail }
        )
      : add.mutate(values, {
          onSuccess: done("toast.portfolio_added"),
          onError: fail,
        })
  )
  const caption = form.watch("caption")
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {!draft.id && (
        <div className="flex flex-col gap-1">
          <ImageUploader
            mode="single"
            shape="wide"
            label={t("dashboard.portfolio_photo")}
            value={image}
            onChange={(next) => {
              setImage(next)
              form.setValue("imageId", next[0]?.id ?? "", {
                shouldValidate: form.formState.isSubmitted,
              })
            }}
          />
          <FieldError message={errors.imageId?.message} />
        </div>
      )}
      <FormField
        label={t("dashboard.portfolio_caption")}
        error={errors.caption?.message}
        description={`${caption.length}/120`}
      >
        {(c) => <Input {...c} maxLength={120} {...form.register("caption")} />}
      </FormField>
      <div className="flex gap-3">
        <SubmitButton pending={add.isPending || update.isPending}>
          {t("common.save")}
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  )
}

export function PortfolioFormDialog({
  draft,
  onClose,
}: {
  draft: PortfolioDraft | undefined
  onClose: () => void
}) {
  const { t } = useT()
  return (
    <ResponsiveDialog
      open={!!draft}
      onOpenChange={(open) => !open && onClose()}
      title={t(
        draft?.id
          ? "dashboard.portfolio_edit_title"
          : "dashboard.portfolio_add_title"
      )}
    >
      {draft && <PortfolioFormBody draft={draft} onDone={onClose} />}
    </ResponsiveDialog>
  )
}
