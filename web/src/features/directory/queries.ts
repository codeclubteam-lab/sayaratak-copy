import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"

import { apiFetch, type ApiError } from "@/lib/api/client"
import { useApiMutation } from "@/lib/api/mutation"
import { keys } from "@/lib/api/query-keys"
import { okSchema } from "@sayaratak/shared/schemas/api"
import type { Media } from "@sayaratak/shared/schemas/listing"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import type {
  portfolioInputSchema,
  serviceInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import {
  dealershipSchema,
  mechanicSchema,
  workshopSchema,
} from "@sayaratak/shared/schemas/profile"

type Query = Record<string, unknown>
export type DirectoryType = "dealerships" | "workshops" | "mechanics"

// One typed pair per directory: a generic `type` argument loses the row type at the call site.
// Filters: dealerships q, city, verified, sort; workshops add service, openNow, lat and lng; mechanics add specialization, minYears, available.
const directory = <TSchema extends z.ZodType>(
  type: DirectoryType,
  schema: TSchema
) => ({
  list: (filters: Query = {}) =>
    queryOptions({
      queryKey: keys.directory.list(type, filters),
      queryFn: ({ signal }) =>
        apiFetch(`/${type}`, {
          query: filters,
          schema: pageOf(schema),
          signal,
        }),
      staleTime: 30_000,
      placeholderData: keepPreviousData,
    }),
  detail: (slug: string) =>
    queryOptions({
      queryKey: keys.directory.detail(type, slug),
      queryFn: ({ signal }) => apiFetch(`/${type}/${slug}`, { schema, signal }),
      staleTime: 5 * 60_000,
    }),
})
export const directoryQueries = {
  dealerships: directory("dealerships", dealershipSchema),
  workshops: directory("workshops", workshopSchema),
  mechanics: directory("mechanics", mechanicSchema),
}

const mineSchema = z.union([dealershipSchema, workshopSchema, mechanicSchema])
export const businessQueries = {
  mine: queryOptions({
    queryKey: keys.business.mine,
    queryFn: ({ signal }) =>
      apiFetch("/me/business", { schema: mineSchema, signal }),
  }),
  services: queryOptions({
    queryKey: keys.business.services,
    queryFn: ({ signal }) =>
      apiFetch("/me/services", {
        schema: workshopSchema.shape.services,
        signal,
      }),
  }),
  portfolio: queryOptions({
    queryKey: keys.business.portfolio,
    queryFn: ({ signal }) =>
      apiFetch("/me/portfolio", {
        schema: mechanicSchema.shape.portfolio,
        signal,
      }),
  }),
}

const touched = [
  keys.business.all,
  keys.directory.all("dealerships"),
  keys.directory.all("workshops"),
  keys.directory.all("mechanics"),
] as const
const serviceRow = workshopSchema.shape.services.element
const portfolioRow = mechanicSchema.shape.portfolio.element
type Input<T extends z.ZodType> = z.input<T>

export const useUpdateBusiness = () =>
  useApiMutation(
    (body: Record<string, unknown>) =>
      apiFetch("/me/business", { method: "PATCH", body, schema: mineSchema }),
    touched
  )
// Optimistic: the photos take the new list at once and go back if the save fails.
export function useSaveBusinessImages() {
  const qc = useQueryClient()
  const key = businessQueries.mine.queryKey
  type Mine = z.infer<typeof mineSchema>
  return useMutation<unknown, ApiError, Media[], Mine | undefined>({
    mutationFn: (images) =>
      apiFetch("/me/business/images", {
        method: "PUT",
        body: { ids: images.map((i) => i.id) },
        schema: workshopSchema,
      }),
    onMutate: async (images) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      const w = workshopSchema.safeParse(prev).data
      if (w) qc.setQueryData(keys.business.mine, { ...w, images })
      return prev
    },
    onError: (_error, _images, prev) => qc.setQueryData(key, prev),
    onSettled: () =>
      Promise.all(
        touched.map((queryKey) => qc.invalidateQueries({ queryKey }))
      ),
  })
}

export const useAddService = () =>
  useApiMutation(
    (body: Input<typeof serviceInputSchema>) =>
      apiFetch("/me/services", { method: "POST", body, schema: serviceRow }),
    touched
  )
export const useUpdateService = () =>
  useApiMutation(
    ({
      id,
      ...body
    }: { id: string } & Partial<Input<typeof serviceInputSchema>>) =>
      apiFetch(`/me/services/${id}`, {
        method: "PATCH",
        body,
        schema: serviceRow,
      }),
    touched
  )
export const useDeleteService = () =>
  useApiMutation(
    (id: string) =>
      apiFetch(`/me/services/${id}`, { method: "DELETE", schema: okSchema }),
    touched
  )
// Optimistic: the list takes the new order at once and goes back if the save fails.
function useReorder<T extends { id: string }>(
  path: string,
  key: readonly string[],
  schema: z.ZodType<T[]>
) {
  const qc = useQueryClient()
  return useMutation<T[], ApiError, string[], T[] | undefined>({
    mutationFn: (ids) =>
      apiFetch(path, { method: "POST", body: { ids }, schema }),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<T[]>(key)
      if (prev)
        qc.setQueryData(
          key,
          ids.flatMap((id) => prev.filter((s) => s.id === id))
        )
      return prev
    },
    onError: (_error, _ids, prev) => qc.setQueryData(key, prev),
    onSettled: () =>
      Promise.all(
        touched.map((queryKey) => qc.invalidateQueries({ queryKey }))
      ),
  })
}
export const useReorderServices = () =>
  useReorder(
    "/me/services/reorder",
    businessQueries.services.queryKey,
    workshopSchema.shape.services
  )

export const useAddPortfolioItem = () =>
  useApiMutation(
    (body: Input<typeof portfolioInputSchema>) =>
      apiFetch("/me/portfolio", { method: "POST", body, schema: portfolioRow }),
    touched
  )
export const useUpdatePortfolioItem = () =>
  useApiMutation(
    ({
      id,
      ...body
    }: { id: string } & Partial<Input<typeof portfolioInputSchema>>) =>
      apiFetch(`/me/portfolio/${id}`, {
        method: "PATCH",
        body,
        schema: portfolioRow,
      }),
    touched
  )
export const useDeletePortfolioItem = () =>
  useApiMutation(
    (id: string) =>
      apiFetch(`/me/portfolio/${id}`, { method: "DELETE", schema: okSchema }),
    touched
  )
export const useReorderPortfolio = () =>
  useReorder(
    "/me/portfolio/reorder",
    businessQueries.portfolio.queryKey,
    mechanicSchema.shape.portfolio
  )
