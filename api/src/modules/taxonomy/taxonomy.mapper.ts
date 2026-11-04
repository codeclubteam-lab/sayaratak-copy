import type { Taxonomy } from "@sayaratak/shared/schemas/taxonomy"

import type {
  CityRow,
  CountryRow,
  DistrictRow,
  MakeRow,
  ModelRow,
  PartCategoryRow,
  RowOf,
  ServiceTemplateRow,
  SpecializationRow,
  VehicleTypeRow,
} from "./taxonomy.tables"
import type { TaxonomyType } from "./taxonomy.types"

export type TaxonomyRows = {
  cities: CityRow[]
  districts: DistrictRow[]
  makes: MakeRow[]
  models: ModelRow[]
  vehicleTypes: VehicleTypeRow[]
  partCategories: PartCategoryRow[]
  specializations: SpecializationRow[]
  serviceTemplates: ServiceTemplateRow[]
}

export function toTaxonomy(rows: TaxonomyRows): Taxonomy {
  return {
    cities: rows.cities.map(toCity),
    districts: rows.districts.map(toDistrict),
    makes: rows.makes.map(toMake),
    models: rows.models.map(toModel),
    vehicleTypes: rows.vehicleTypes.map(toVehicleType),
    partCategories: rows.partCategories.map(toPartCategory),
    specializations: rows.specializations.map(toNamed),
    serviceTemplates: rows.serviceTemplates.map(toNamed),
  }
}

const ADMIN_ROWS: { [K in TaxonomyType]: (row: RowOf[K]) => unknown } = {
  cities: toCity,
  districts: toDistrict,
  makes: toMake,
  models: toModel,
  "vehicle-types": toVehicleType,
  "part-categories": toPartCategory,
  countries: toCountry,
}

/** The rows of one admin-managed list as the admin pages read them. */
export function toAdminRows<K extends TaxonomyType>(
  type: K,
  rows: RowOf[NoInfer<K>][]
) {
  return rows.map(ADMIN_ROWS[type])
}

function toCity({ id, slug, countryId, name, lat, lng }: CityRow) {
  return { id, slug, countryId, name, center: { lat, lng } }
}

function toDistrict({ id, cityId, name }: DistrictRow) {
  return { id, cityId, name }
}

// A make without an uploaded mark has no logoUrl key, as in the mock.
function toMake({ id, slug, name, logoUrl, vehicleTypes }: MakeRow) {
  return { id, slug, name, logoUrl: logoUrl ?? undefined, vehicleTypes }
}

function toModel({ id, makeId, name }: ModelRow) {
  return { id, makeId, name }
}

function toVehicleType({ id, name, enabled }: VehicleTypeRow) {
  return { id, name, enabled }
}

function toPartCategory({ id, slug, name }: PartCategoryRow) {
  return { id, slug, name }
}

function toCountry({ id, name, dialCode, enabled }: CountryRow) {
  return { id, name, dialCode, enabled }
}

function toNamed({ id, name }: SpecializationRow | ServiceTemplateRow) {
  return { id, name }
}
