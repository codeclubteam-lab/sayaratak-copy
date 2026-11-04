import { useQuery } from "@tanstack/react-query"
import { ImageIcon } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"

import { meQuery } from "@/features/auth/me-query"
import { useT } from "@/lib/i18n/use-t"
import type { CampaignForm } from "../schemas"
import { BannerPreview } from "./banner-preview"

const langs = ["en", "ar"] as const

// Step 1's live preview in both languages. The wizard puts it beside the form from xl and under it below.
export function CreativePreview() {
  const { t } = useT()
  const { control } = useFormContext<CampaignForm>()
  const [cover, copy] = useWatch({ control, name: ["cover", "copy"] })
  const me = useQuery(meQuery).data
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-ui font-semibold">{t("ads.preview_title")}</h2>
      {cover ? (
        langs.map((lang) => (
          <BannerPreview
            key={lang}
            lang={lang}
            imageUrl={cover.url}
            eyebrow={me?.fullName ?? ""}
            copy={copy[lang]}
          />
        ))
      ) : (
        <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl bg-muted p-6 text-center text-ui text-muted-foreground">
          <ImageIcon aria-hidden className="size-6" />
          {t("ads.preview_empty")}
        </div>
      )}
    </section>
  )
}
