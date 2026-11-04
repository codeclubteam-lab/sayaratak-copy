import { BannerCopy } from "@/components/app/banner-copy"
import type { Creative } from "@sayaratak/shared/schemas/ads"

// The banner as visitors will see it, without the link or the view tracking of `BannerItem`.
export function BannerPreview({
  imageUrl,
  copy,
  eyebrow,
  lang,
}: {
  imageUrl: string
  copy: Creative["copy"]["en"]
  eyebrow: string
  lang: "ar" | "en"
}) {
  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      lang={lang}
      className="overflow-hidden rounded-xl bg-deep text-deep-foreground"
    >
      <BannerCopy
        banner={{ sponsored: true, focus: 50 }}
        copy={{ eyebrow, ...copy }}
        src={imageUrl}
      />
    </div>
  )
}
