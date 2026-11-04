import { Controller, useFormContext, useWatch } from "react-hook-form"

import { CoverUpload } from "@/components/app/cover-upload"
import { LogoUpload } from "@/components/app/logo-upload"
import { ProfilePreview } from "@/components/app/profile-preview"
import { mediaFromUrl } from "@/features/onboarding/media"
import { useT } from "@/lib/i18n/use-t"
import type { Dealership, Workshop } from "@sayaratak/shared/schemas/profile"

type Branding = { logoUrl: string; coverUrl: string }

// Logo and cover, with the public profile header beside them that follows each change before it is saved.
export function BrandingFields({
  business: d,
}: {
  business: Dealership | Workshop
}) {
  const { t, locale } = useT()
  const { control } = useFormContext<Branding>()
  const [logoUrl, coverUrl] = useWatch({
    control,
    name: ["logoUrl", "coverUrl"],
  })
  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        {(["logoUrl", "coverUrl"] as const).map((name) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field }) => {
              const Upload = name === "logoUrl" ? LogoUpload : CoverUpload
              return (
                <Upload
                  label={t(
                    name === "logoUrl"
                      ? "onboarding.logo_label"
                      : "onboarding.cover_label"
                  )}
                  value={field.value ? mediaFromUrl(field.value) : null}
                  onChange={(media) => field.onChange(media?.url ?? "")}
                />
              )
            }}
          />
        ))}
      </div>
      <ProfilePreview
        variant={"phones" in d ? "dealership" : "workshop"}
        name={d.name[locale] || d.name.ar}
        imageUrl={logoUrl}
        coverUrl={coverUrl}
        cityId={d.cityId}
        hours={d.hours}
      />
    </div>
  )
}
