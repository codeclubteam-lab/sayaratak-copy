import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { Bilingual } from "@sayaratak/shared/schemas/fields"
import {
  useCreateTaxonomyRow,
  useUpdateTaxonomyRow,
} from "@/features/admin/queries"
import { FormField } from "@/components/app/form-field"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { useAppForm } from "@/hooks/use-app-form"
import { categoryFormSchema, type CategoryForm } from "../schemas"

export type CategoryDraft = { id?: string; name?: Bilingual }

// Both names of a part category. A new one (no `id`) is added; its slug comes from the English name on the server.
export function CategoryDialog({
  draft,
  onClose,
}: {
  draft: CategoryDraft | undefined
  onClose: () => void
}) {
  const { t } = useT()
  const create = useCreateTaxonomyRow("part-categories")
  const update = useUpdateTaxonomyRow("part-categories")
  const form = useAppForm<CategoryForm>({
    resolver: zodResolver(categoryFormSchema),
    mode: "onTouched",
    defaultValues: { nameAr: "", nameEn: "" },
  })
  useEffect(() => {
    if (draft)
      form.reset({ nameAr: draft.name?.ar ?? "", nameEn: draft.name?.en ?? "" })
  }, [draft, form])
  const { errors } = form.formState
  const editing = !!draft?.id
  const pending = create.isPending || update.isPending
  return (
    <ResponsiveDialog
      open={!!draft}
      onOpenChange={(open) => !open && onClose()}
      title={t(
        editing
          ? "admin.categories_edit_part_categories"
          : "admin.categories_add_part_categories"
      )}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(({ nameAr, nameEn }) => {
          const body = { name: { ar: nameAr, en: nameEn } }
          const options = {
            onSuccess: () => {
              toast.add({ title: t("admin.categories_saved") })
              onClose()
            },
            onError: (e: unknown) => toast.add({ title: errorText(t, e) }),
          }
          if (draft?.id) update.mutate({ id: draft.id, ...body }, options)
          else create.mutate(body, options)
        })}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t("admin.plan_name_ar")}
            error={errors.nameAr?.message}
          >
            {(props) => (
              <Input
                {...props}
                dir="rtl"
                lang="ar"
                maxLength={40}
                {...form.register("nameAr")}
              />
            )}
          </FormField>
          <FormField
            label={t("admin.plan_name_en")}
            error={errors.nameEn?.message}
          >
            {(props) => (
              <Input
                {...props}
                dir="ltr"
                lang="en"
                maxLength={40}
                {...form.register("nameEn")}
              />
            )}
          </FormField>
        </div>
        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={pending}>{t("common.save")}</SubmitButton>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  )
}
