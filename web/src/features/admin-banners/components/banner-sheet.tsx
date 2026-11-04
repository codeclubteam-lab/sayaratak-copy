import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { FormProvider } from "react-hook-form"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { useCreateBanner, useUpdateBanner } from "@/features/admin/queries"
import { EntitySheet } from "@/features/admin/components/entity-sheet"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useAppForm } from "@/hooks/use-app-form"
import { bannerFormSchema, toBannerInput, type BannerForm } from "../schemas"
import { BannerCopyFields } from "./banner-copy-fields"
import { BannerImageField } from "./banner-image-field"
import { BannerMainFields } from "./banner-main-fields"
import { BannerPreview } from "./banner-preview"

// `id` set: edit that banner; unset: a new one (blank, or a duplicate's values).
export type BannerDraft = { id?: string; values: Partial<BannerForm> }

// The form with a live preview above it (the sheet is one column wide).
export function BannerSheet({
  draft,
  onClose,
}: {
  draft: BannerDraft | undefined
  onClose: () => void
}) {
  const { t } = useT()
  const create = useCreateBanner()
  const update = useUpdateBanner()
  const form = useAppForm<BannerForm>({
    resolver: zodResolver(bannerFormSchema),
    mode: "onTouched",
  })
  useEffect(() => {
    if (draft) form.reset(draft.values)
  }, [draft, form])
  const formId = "banner-form"
  const onSubmit = form.handleSubmit((values) => {
    const body = toBannerInput(values)
    const options = {
      onSuccess: () => {
        toast.add({ title: t("admin.banners_saved") })
        onClose()
      },
      onError: (e: unknown) => toast.add({ title: errorText(t, e) }),
    }
    if (draft?.id) update.mutate({ id: draft.id, ...body }, options)
    else create.mutate(body, options)
  })
  return (
    <EntitySheet
      open={!!draft}
      onOpenChange={(open) => !open && onClose()}
      title={t(draft?.id ? "admin.banners_edit" : "admin.banners_new")}
      footer={
        <>
          <SubmitButton
            form={formId}
            pending={create.isPending || update.isPending}
          >
            {t("common.save")}
          </SubmitButton>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <form
          id={formId}
          noValidate
          onSubmit={(e) => void onSubmit(e)}
          className="flex flex-col gap-6"
        >
          <BannerPreview />
          <BannerImageField name="imageAr" />
          <BannerImageField name="imageEn" />
          <BannerMainFields />
          <BannerCopyFields lang="ar" />
          <BannerCopyFields lang="en" />
        </form>
      </FormProvider>
    </EntitySheet>
  )
}
