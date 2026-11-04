import { Controller, useFormContext } from "react-hook-form"

import { useT } from "@/lib/i18n/use-t"
import { FieldError } from "@/components/app/field-error"
import { ImageUploader } from "@/components/app/image-uploader"
import { mediaOf, type BannerForm } from "../schemas"

// An uploaded image's URL is a template; the banner stores the 1280 px one.
export function BannerImageField({ name }: { name: "imageAr" | "imageEn" }) {
  const { t } = useT()
  const { control } = useFormContext<BannerForm>()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-2">
          <ImageUploader
            mode="single"
            max={1}
            shape="wide"
            label={t(
              name === "imageAr"
                ? "admin.banners_image_ar"
                : "admin.banners_image_en"
            )}
            value={field.value ? [mediaOf(field.value)] : []}
            onChange={(next) =>
              field.onChange(next[0]?.url.replace("{w}", "1280") ?? "")
            }
          />
          <FieldError message={fieldState.error?.message} />
        </div>
      )}
    />
  )
}
