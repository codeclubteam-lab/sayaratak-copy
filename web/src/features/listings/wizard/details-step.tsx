import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useFormContext } from "react-hook-form"

import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import { CollapsibleSection } from "@/components/app/collapsible-section"
import { FieldGrid } from "@/components/app/field-grid"
import { Button } from "@/components/ui/button"
import { FieldLegend, FieldSet } from "@/components/ui/field"
import {
  featureGroups,
  featureGroupsFor,
} from "@sayaratak/shared/schemas/listing-fields"
import { DescriptionBlock, PriceBlock, TitleField } from "./common-fields"
import { ConditionField } from "./condition-field"
import { DetailField } from "./details-field"
import { DetailsMakeModel } from "./details-make-model"
import {
  partSections,
  vehicleSections,
  type Custom,
  type FieldDef,
  type Item,
  type Section,
} from "./details-sections"
import { applies } from "./field-rules"
import { FeaturesField, FitsMakesField } from "./features-field"
import { useStepFields } from "./use-step-fields"

// The title starts as "{make} {model} {year}" and follows those fields until the person edits it.
function useTitleSuggestion() {
  const { locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const { getValues } = useFormContext()
  const { values, set } = useStepFields()
  const make =
    tax?.makes.find((m) => m.id === values.makeId)?.name[locale] ??
    values.makeOther
  const model =
    tax?.models.find((m) => m.id === values.modelId)?.name[locale] ??
    values.modelOther
  const suggestion =
    values.kind === "vehicle"
      ? [make, model, values.year].filter(Boolean).join(" ")
      : ""
  const last = useRef(suggestion)
  useEffect(() => {
    if (suggestion === last.current) return
    const title = getValues("title")
    if (title === "" || title === last.current) set("title", suggestion)
    last.current = suggestion
  }, [suggestion])
}

const isDef = (item: Item): item is FieldDef => typeof item !== "string"
const blank = (v: unknown) =>
  v == null || v === "" || (Array.isArray(v) && v.length === 0)

function Custom({ item }: { item: Custom }) {
  const { t } = useT()
  const { values } = useStepFields()
  switch (item) {
    case "makeModel":
      return values.kind === "part" ? (
        <FieldSet className="col-span-full">
          <FieldLegend variant="label">
            {t("post.part_make_legend")}
          </FieldLegend>
          <DetailsMakeModel />
        </FieldSet>
      ) : (
        <DetailsMakeModel vehicleType={values.vehicleType} inGrid />
      )
    case "condition":
      return <ConditionField />
    case "features":
      return (
        <div className="col-span-full">
          <FeaturesField />
        </div>
      )
    case "fitsMakes":
      return (
        <div className="col-span-full">
          <FitsMakesField />
        </div>
      )
    case "title":
      return <TitleField />
    case "description":
      return <DescriptionBlock />
    case "price":
      return <PriceBlock />
  }
}

// One section: its fields that apply to this listing, or nothing when none do. A closed section says how many of its fields are filled.
function SectionBlock({ section }: { section: Section }) {
  const { t } = useT()
  const { values } = useStepFields()
  const items = section.items.filter((item) =>
    isDef(item)
      ? applies(item.name, values)
      : item !== "features" || featureGroupsFor(values.vehicleType).length > 0
  )
  if (items.length === 0) return null
  const defs = items.filter(isDef)
  const [filled, total] = items.includes("features")
    ? [
        (values.features ?? []).length,
        featureGroupsFor(values.vehicleType).reduce(
          (sum, g) => sum + featureGroups[g].length,
          0
        ),
      ]
    : [defs.filter((d) => !blank(values[d.name])).length, defs.length]
  return (
    <CollapsibleSection
      title={t(section.title)}
      defaultOpen={section.open}
      summary={
        section.optional
          ? filled
            ? t("post.section_filled", { filled, total })
            : t("form.optional")
          : undefined
      }
    >
      <FieldGrid cols={3}>
        {items.map((item) =>
          isDef(item) ? (
            <DetailField key={item.name} def={item} />
          ) : (
            <Custom key={item} item={item} />
          )
        )}
      </FieldGrid>
    </CollapsibleSection>
  )
}

// Step `details`: sections of fields for the chosen type (see `details-sections.ts`), ending with title, description and price.
export function DetailsStep() {
  const { t } = useT()
  const { values } = useStepFields()
  const root = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  useTitleSuggestion()
  const toggle = () => {
    root.current
      ?.querySelectorAll("details")
      .forEach((d) => (d.open = !expanded))
    setExpanded(!expanded)
  }
  return (
    <div ref={root} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p aria-hidden="true" className="text-caption text-muted-foreground">
          {t("form.required_note")}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={toggle}>
          {t(expanded ? "post.collapse_all" : "post.expand_all")}
        </Button>
      </div>
      {(values.kind === "part" ? partSections : vehicleSections).map((s) => (
        <SectionBlock key={s.id} section={s} />
      ))}
    </div>
  )
}
