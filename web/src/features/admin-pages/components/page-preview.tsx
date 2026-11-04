import { useT } from "@/lib/i18n/use-t"
import { PageBody } from "@/features/pages/components/page-body"

// The draft as the public page shows it, in the language of the open tab.
export function PagePreview({
  lang,
  title,
  body,
}: {
  lang: "ar" | "en"
  title: string
  body: string
}) {
  const { t } = useT()
  return (
    <section
      aria-labelledby="page-preview"
      className="flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4"
    >
      <h2
        id="page-preview"
        className="text-caption font-medium text-muted-foreground"
      >
        {t(`admin.pages_preview_${lang}`)}
      </h2>
      <div
        dir={lang === "ar" ? "rtl" : "ltr"}
        lang={lang}
        className="flex flex-col gap-6 rounded-lg bg-background p-4"
      >
        <p className="text-page font-semibold">{title.trim() || "—"}</p>
        <PageBody body={body} />
      </div>
    </section>
  )
}
