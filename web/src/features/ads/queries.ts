import { queryOptions } from "@tanstack/react-query"
import { z } from "zod"

import { apiFetch } from "@/lib/api/client"
import { useApiMutation } from "@/lib/api/mutation"
import { keys } from "@/lib/api/query-keys"
import {
  adminCampaignSchema,
  adPageSchema,
  adTargetSchema,
  campaignSchema,
  type AdminCampaign,
  type AdPage,
} from "@sayaratak/shared/schemas/ads"
import { bannerSchema } from "@sayaratak/shared/schemas/admin"
import type {
  adPagePatchSchema,
  campaignInputSchema,
} from "@sayaratak/shared/schemas/inputs"

export type { AdminCampaign }

export const adsQueries = {
  // Free slots follow the dates; without dates every slot counts as free.
  pages: (range: { startDate?: string; weeks?: number }) =>
    queryOptions({
      queryKey: keys.ads.pages(range),
      queryFn: ({ signal }) =>
        apiFetch("/ad-pages", {
          query: range,
          schema: z.array(adPageSchema),
          signal,
        }),
    }),
  targets: queryOptions({
    queryKey: keys.ads.targets,
    queryFn: ({ signal }) =>
      apiFetch("/me/ad-targets", { schema: z.array(adTargetSchema), signal }),
  }),
  mine: queryOptions({
    queryKey: keys.ads.mine,
    queryFn: ({ signal }) =>
      apiFetch("/me/campaigns", { schema: z.array(campaignSchema), signal }),
  }),
  // Public: the paid banner of a page, or none.
  serve: (page: string) =>
    queryOptions({
      queryKey: keys.content.ad(page),
      queryFn: ({ signal }) =>
        apiFetch("/ads", {
          query: { page },
          schema: z.array(bannerSchema),
          signal,
        }),
      staleTime: 5 * 60_000,
    }),
  adminCampaigns: queryOptions({
    queryKey: keys.admin.list("campaigns"),
    queryFn: ({ signal }) =>
      apiFetch("/admin/campaigns", {
        schema: z.array(adminCampaignSchema),
        signal,
      }),
  }),
  adminPages: queryOptions({
    queryKey: keys.admin.list("ad-pages"),
    queryFn: ({ signal }) =>
      apiFetch("/admin/ad-pages", { schema: z.array(adPageSchema), signal }),
  }),
}

export const useCreateCampaign = () =>
  useApiMutation(
    (body: z.input<typeof campaignInputSchema>) =>
      apiFetch("/campaigns", { method: "POST", body, schema: campaignSchema }),
    [keys.ads.all]
  )

export const useReviewCampaign = () =>
  useApiMutation(
    (
      v: { id: string } & (
        { action: "approve" } | { action: "reject"; reason: string }
      )
    ) =>
      apiFetch(`/admin/campaigns/${v.id}/${v.action}`, {
        method: "POST",
        body: v.action === "reject" ? { reason: v.reason } : undefined,
        schema: campaignSchema,
      }),
    [keys.admin.all, keys.ads.all]
  )

export const useUpdateAdPage = () =>
  useApiMutation(
    ({
      id,
      ...body
    }: { id: AdPage["id"] } & z.input<typeof adPagePatchSchema>) =>
      apiFetch(`/admin/ad-pages/${id}`, {
        method: "PATCH",
        body,
        schema: adPageSchema,
      }),
    [keys.admin.all, keys.ads.all]
  )
