import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ExternalLinkIcon } from "lucide-react"
import { useWatch, type FieldErrors } from "react-hook-form"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"
import { useUpdatePage } from "@/features/admin/queries"
import type { SitePage } from "@sayaratak/shared/schemas/admin"
import { LeaveGuard } from "@/components/app/leave-guard"
import { ShellLink } from "@/components/app/shell-link"
import { SubmitButton } from "@/components/app/submit-button"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import { useAppForm } from "@/hooks/use-app-form"
import {
  fromPage,
  pageFormSchema,
  toPagePatch,
  type PageForm as Values,
} from "../schemas"
import { PageFields } from "./page-fields"
import { PagePreview } from "./page-preview"

const langs = ["ar", "en"] as const
type Lang = (typeof langs)[number]

// Arabic and English tabs over one form; the preview follows the open tab. A save goes live at once in both languages.
export function PageForm({ page }: { page: SitePage }) {
  const { t } = useT()
  const update = useUpdatePage()
  const [lang, setLang] = useState<Lang>("ar")
  const form = useAppForm<Values>({
    resolver: zodResolver(pageFormSchema),
    mode: "onTouched",
    defaultValues: fromPage(page),
  })
  const draft = useWatch({ control: form.control })
  const title = (lang === "ar" ? draft.titleAr : draft.titleEn) ?? ""
  const body = (lang === "ar" ? draft.bodyAr : draft.bodyEn) ?? ""
  const onSubmit = (v: Values) =>
    update.mutate(
      { slug: page.slug, ...toPagePatch(v) },
      {
        onSuccess: () => toast.add({ title: t("admin.pages_saved") }),
        onError: (e) => toast.add({ title: errorText(t, e) }),
      }
    )
  // The first error may sit in the hidden tab: open it, then focus the field.
  const onInvalid = (errors: FieldErrors<Values>) => {
    const first = (
      Object.keys(pageFormSchema.shape) as Array<keyof Values>
    ).find((k) => errors[k])
    if (!first) return
    setLang(first.endsWith("Ar") ? "ar" : "en")
    setTimeout(() => form.setFocus(first))
  }
  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        className="flex min-w-0 flex-col gap-4 rounded-xl bg-card p-4"
      >
        <Tabs value={lang} onValueChange={(v: Lang) => setLang(v)}>
          <TabsList aria-label={t("admin.pages_language")}>
            {langs.map((l) => (
              <TabsTrigger key={l} value={l}>
                {t(`admin.pages_tab_${l}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {langs.map((l) => (
            <TabsContent key={l} value={l} keepMounted className="pt-2">
              <PageFields form={form} lang={l} />
            </TabsContent>
          ))}
        </Tabs>
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <SubmitButton pending={update.isPending}>
            {t("admin.pages_save")}
          </SubmitButton>
          <ShellLink
            path={`/${page.slug}`}
            newTab
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ExternalLinkIcon aria-hidden="true" />
            {t("admin.open_public_page")}
          </ShellLink>
        </div>
      </form>
      <PagePreview lang={lang} title={title} body={body} />
      <LeaveGuard when={form.formState.isDirty && !update.isPending} />
    </div>
  )
}
