import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "@tanstack/react-router"
import { SearchIcon } from "lucide-react"
import { Controller } from "react-hook-form"

import { CitySelect } from "@/components/app/city-select"
import { FormField } from "@/components/app/form-field"
import { MakeModelFields } from "@/components/app/make-model-fields"
import { NumberField } from "@/components/app/number-field"
import { SubmitButton } from "@/components/app/submit-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { searchPath } from "@/features/search/href"
import { setCookie } from "@/lib/cookie"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { intentSchema } from "@sayaratak/shared/schemas/listing"
import { heroSearchSchema, type HeroSearch as HeroValues } from "../schemas"
import { useAppForm } from "@/hooks/use-app-form"

const YEAR = 365 * 24 * 60 * 60

// The search card, with the page heading: vehicles or parts, buy or rent, city, make, model and the highest price. It builds the search URL and goes there; nothing is stored but the city, which the home and search pages remember.
export function HeroSearch({ city }: { city: string }) {
  const { t, locale } = useT()
  const router = useRouter()
  const { control, handleSubmit, watch, setValue, formState } =
    useAppForm<HeroValues>({
      resolver: zodResolver(heroSearchSchema),
      mode: "onTouched",
      defaultValues: {
        kind: "vehicle",
        intent: "sale",
        city,
        make: "",
        model: "",
        maxPrice: null,
      },
    })
  const kind = watch("kind")

  const go = (v: HeroValues) =>
    router.history.push(
      localeHref(
        searchPath({
          kind: v.kind,
          intent: v.kind === "vehicle" ? v.intent : undefined,
          city: v.city || undefined,
          make: v.make || undefined,
          model: v.model || undefined,
          maxPrice: v.maxPrice ?? undefined,
        }),
        locale
      )
    )

  return (
    <form
      noValidate
      onSubmit={handleSubmit(go)}
      aria-labelledby="home-title"
      className="rounded-xl bg-card p-4 md:px-5"
    >
      <Tabs
        value={kind}
        onValueChange={(v) =>
          setValue("kind", v === "part" ? "part" : "vehicle")
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h1 id="home-title" className="text-title font-semibold">
            {t("home.title")}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <TabsList>
              <TabsTrigger value="vehicle">
                {t("home.tab_vehicles")}
              </TabsTrigger>
              <TabsTrigger value="part">{t("home.tab_parts")}</TabsTrigger>
            </TabsList>
            {kind === "vehicle" && (
              <Controller
                control={control}
                name="intent"
                render={({ field }) => (
                  <ToggleGroup
                    aria-label={t("home.intent")}
                    spacing={1}
                    value={[field.value ?? "sale"]}
                    onValueChange={(next) => {
                      // A group of two never goes empty: pressing the chosen one again keeps it.
                      const intent = intentSchema.safeParse(next[0])
                      if (intent.success) field.onChange(intent.data)
                    }}
                  >
                    <ToggleGroupItem value="sale">
                      {t("home.buy")}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="rent">
                      {t("home.rent")}
                    </ToggleGroupItem>
                  </ToggleGroup>
                )}
              />
            )}
          </div>
        </div>
        <TabsContent value={kind} tabIndex={-1}>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end [&_[data-slot=field-label]]:sr-only [&_[data-slot=select-trigger]]:h-11! [&_[data-slot=select-trigger]]:text-ui! [&_input]:h-11">
            <div className="col-span-2 lg:col-span-1">
              <Controller
                control={control}
                name="city"
                render={({ field }) => (
                  <CitySelect
                    value={field.value ?? ""}
                    onChange={(id) => {
                      field.onChange(id)
                      if (id) setCookie("city", id, YEAR)
                    }}
                  />
                )}
              />
            </div>
            <MakeModelFields
              search
              className="contents"
              value={{
                makeId: watch("make") || null,
                modelId: watch("model") || null,
                makeOther: null,
                modelOther: null,
              }}
              onChange={(v) => {
                setValue("make", v.makeId ?? "")
                setValue("model", v.modelId ?? "")
              }}
            />
            <div className="lg:col-span-1">
              <Controller
                control={control}
                name="maxPrice"
                render={({ field }) => (
                  <FormField
                    label={t("search.max_price")}
                    error={formState.errors.maxPrice?.message}
                  >
                    {(c) => (
                      <NumberField
                        {...c}
                        grouping
                        placeholder={t("search.max_price")}
                        min={0}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  </FormField>
                )}
              />
            </div>
            <SubmitButton
              pending={formState.isSubmitting}
              className="h-11 w-full self-end md:h-11 lg:w-auto lg:px-8"
            >
              <SearchIcon data-icon="inline-start" />
              {t("common.search")}
            </SubmitButton>
          </div>
        </TabsContent>
      </Tabs>
    </form>
  )
}
