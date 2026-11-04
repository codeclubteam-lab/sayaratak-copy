import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { Bilingual } from "@sayaratak/shared/schemas/fields"
import {
  useCreateTaxonomyRow,
  useUpdateTaxonomyRow,
} from "@/features/admin/queries"
import { NameFields } from "@/features/admin-locations/components/name-fields"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useAppForm } from "@/hooks/use-app-form"
import { modelSchema, type ModelForm } from "../schemas"

export type ModelDraft = { id?: string; makeId: string; name?: Bilingual }

// Both names of a model. A new one (no `id`) goes under the open make.
export function ModelDialog({
  draft,
  onClose,
}: {
  draft: ModelDraft | undefined
  onClose: () => void
}) {
  const { t } = useT()
  const create = useCreateTaxonomyRow("models")
  const update = useUpdateTaxonomyRow("models")
  const form = useAppForm<ModelForm>({
    resolver: zodResolver(modelSchema),
    mode: "onTouched",
    defaultValues: { nameAr: "", nameEn: "" },
  })
  useEffect(() => {
    if (draft)
      form.reset({ nameAr: draft.name?.ar ?? "", nameEn: draft.name?.en ?? "" })
  }, [draft, form])
  const { errors } = form.formState
  return (
    <ResponsiveDialog
      open={!!draft}
      onOpenChange={(open) => !open && onClose()}
      title={t(draft?.id ? "admin.models_edit" : "admin.models_add")}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(({ nameAr, nameEn }) => {
          if (!draft) return
          const name = { ar: nameAr, en: nameEn }
          const options = {
            onSuccess: () => {
              toast.add({ title: t("admin.makes_saved") })
              onClose()
            },
            onError: (e: unknown) => toast.add({ title: errorText(t, e) }),
          }
          if (draft.id) update.mutate({ id: draft.id, name }, options)
          else create.mutate({ makeId: draft.makeId, name }, options)
        })}
      >
        <NameFields
          ar={form.register("nameAr")}
          en={form.register("nameEn")}
          errorAr={errors.nameAr?.message}
          errorEn={errors.nameEn?.message}
        />
        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={create.isPending || update.isPending}>
            {t("common.save")}
          </SubmitButton>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  )
}
