import { useState } from "react"

import { PriceText } from "@/components/app/price-text"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { errorText } from "@/lib/api/error-text"
import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import { ReasonDialog } from "@/features/admin/components/reason-dialog"
import { campaignState, stateVariant } from "../campaign-state"
import { useReviewCampaign, type AdminCampaign } from "../queries"
import { BannerPreview } from "./banner-preview"

// One campaign for the admin: the banner as it will run, who pays, where, when and the receipt. Approving checks banner and receipt together.
export function AdminCampaignRow({ campaign: c }: { campaign: AdminCampaign }) {
  const { t, locale } = useT()
  const state = campaignState(c, useNow())
  const review = useReviewCampaign()
  const [rejecting, setRejecting] = useState(false)
  const done = (key: string) => ({
    onSuccess: () => {
      setRejecting(false)
      toast.add({ title: t(key) })
    },
    onError: (e: unknown) => toast.add({ title: errorText(t, e) }),
  })
  return (
    <article className="flex flex-col gap-4 rounded-xl bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-ui font-semibold">{c.ownerName}</h2>
          <Badge variant={stateVariant[state]}>{t(`ads.state_${state}`)}</Badge>
        </div>
        <PriceText price={c.amount} size="table" />
      </div>
      <BannerPreview
        lang={locale}
        imageUrl={c.creative.imageUrl}
        eyebrow={c.ownerName}
        copy={c.creative.copy[locale]}
      />
      <p className="text-ui text-muted-foreground">
        {c.pages.map((p) => t(`ads.page_${p}`)).join(" · ")} ·{" "}
        {formatDate(c.startsAt, locale)} – {formatDate(c.endsAt, locale)}
      </p>
      <p className="text-caption text-muted-foreground">
        {t("ads.links_to")} <bdi dir="ltr">{c.href}</bdi>
      </p>
      {c.status === "under_review" && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={review.isPending}
            onClick={() =>
              review.mutate(
                { id: c.id, action: "approve" },
                done("ads.approved")
              )
            }
          >
            {t("ads.approve")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRejecting(true)}
          >
            {t("ads.reject")}
          </Button>
          {c.receiptUrl && (
            <a
              href={c.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "link" })}
            >
              {t("billing.view_receipt")}
            </a>
          )}
        </div>
      )}
      <ReasonDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={t("ads.reject_title")}
        label={t("ads.reject_reason")}
        confirmLabel={t("ads.reject")}
        pending={review.isPending}
        onConfirm={(reason) =>
          review.mutate(
            { id: c.id, action: "reject", reason },
            done("ads.rejected")
          )
        }
      />
    </article>
  )
}
