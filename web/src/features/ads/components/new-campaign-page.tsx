import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "@tanstack/react-router"
import { FormProvider } from "react-hook-form"

import { PageHeader } from "@/components/app/page-header"
import { StepIndicator } from "@/components/app/step-indicator"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { ApiError } from "@/lib/api/client"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, localeHref } from "@/lib/navigation"
import type { User } from "@sayaratak/shared/schemas/user"
import { useCreateCampaign } from "../queries"
import { campaignFormSchema, stepFields, type CampaignForm } from "../schemas"
import { CreativePreview } from "./creative-preview"
import { CreativeStep } from "./creative-step"
import { DatesStep, toDay } from "./dates-step"
import { PagesStep } from "./pages-step"
import { ReviewStep } from "./review-step"
import { useAppForm } from "@/hooks/use-app-form"

const steps = [CreativeStep, DatesStep, PagesStep, ReviewStep]
const titles = [
  "ads.step_banner",
  "ads.step_dates",
  "ads.step_pages",
  "ads.step_review",
]

const tomorrow = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toDay(d)
}
const blankText = { heading: "", body: "", cta: "" }

// Banner, dates, pages, review; then the campaign is created unpaid and the Bankak checkout opens.
export function NewCampaignPage({ role }: { role: User["role"] }) {
  const { t, locale } = useT()
  const router = useRouter()
  const create = useCreateCampaign()
  const [step, setStep] = useState(0)
  usePageTitle(t("ads.new_title"))
  const form = useAppForm<CampaignForm>({
    resolver: zodResolver(campaignFormSchema),
    mode: "onTouched",
    defaultValues: {
      cover: null,
      copy: { en: blankText, ar: blankText },
      href: "",
      startDate: tomorrow(),
      weeks: 1,
      pages: [],
    },
  })
  const Step = steps[step] ?? CreativeStep
  const last = step === steps.length - 1
  const next = async () => {
    if (await form.trigger(stepFields[step])) setStep(step + 1)
  }
  const submit = form.handleSubmit(async (v) => {
    if (!v.cover) return
    try {
      const campaign = await create.mutateAsync({
        creative: { imageUrl: v.cover.url, copy: v.copy },
        href: v.href,
        pages: v.pages,
        startDate: v.startDate,
        weeks: v.weeks,
      })
      const item = new URLSearchParams({ item: `campaign:${campaign.id}` })
      router.history.push(
        localeHref(`${dashboardPath(role)}/billing/checkout?${item}`, locale)
      )
    } catch (e) {
      // Someone took the last slot meanwhile: back to the pages, which now show it full.
      if (e instanceof ApiError && e.code === "page_full") {
        toast.add({ title: t("ads.page_taken") })
        setStep(2)
      } else toast.add({ title: errorText(t, e) })
    }
  })
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("ads.new_title")} />
      <FormProvider {...form}>
        {/* Below xl: steps, preview, buttons. From xl the preview is a sticky column beside the steps and buttons. */}
        <form
          noValidate
          onSubmit={submit}
          className="grid items-start gap-6 xl:grid-cols-[minmax(0,42rem)_minmax(0,1fr)] xl:gap-x-12"
        >
          <div className="flex max-w-2xl flex-col gap-6">
            <StepIndicator current={step + 1} total={steps.length} />
            <h2 className="text-title font-semibold">
              {t(titles[step] ?? "")}
            </h2>
            <Step />
          </div>
          {step === 0 && (
            <div className="xl:sticky xl:top-20 xl:col-start-2 xl:row-span-2 xl:row-start-1">
              <CreativePreview />
            </div>
          )}
          <div className="flex max-w-2xl items-center gap-3 xl:col-start-1">
            {step > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(step - 1)}
              >
                {t("common.back")}
              </Button>
            )}
            <div className="ms-auto">
              {last ? (
                <SubmitButton size="lg" pending={create.isPending}>
                  {t("post.promo_continue")}
                </SubmitButton>
              ) : (
                <Button type="button" size="lg" onClick={() => void next()}>
                  {t("common.continue")}
                </Button>
              )}
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  )
}
