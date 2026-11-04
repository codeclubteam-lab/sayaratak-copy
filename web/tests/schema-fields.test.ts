import { expect, it } from "vitest"
import { z } from "zod"

import {
  bilingualSchema,
  emailSchema,
  geoSchema,
  hourSchema,
  idSchema,
  identifierSchema,
  imageFileSchema,
  latSchema,
  lngSchema,
  nameSchema,
  optionalInt,
  optionalText,
  pageOf,
  passwordSchema,
  phoneSchema,
  priceSchema,
  requiredInt,
  requiredText,
  roleSchema,
  weeklyHoursSchema,
  yearSchema,
} from "@sayaratak/shared/schemas/fields"
import { localeSchema } from "@sayaratak/shared/schemas/locale"
import { runCases } from "./schema-case"

const year = new Date().getFullYear()
const file = (type: string, size: number) =>
  new File([new Uint8Array(size)], "a", { type })
const day = (d: number, open = "08:00", close = "18:00") => ({
  day: d,
  closed: false,
  open,
  close,
})
const week = Array.from({ length: 7 }, (_, d) => day(d))

runCases([
  {
    name: "roleSchema",
    schema: roleSchema,
    valid: ["user", "admin"],
    bad: [["unknown role", "guest"]],
  },
  {
    name: "localeSchema",
    schema: localeSchema,
    valid: ["ar", "en"],
    bad: [["other language", "fr"]],
  },
  {
    name: "bilingualSchema",
    schema: bilingualSchema,
    valid: [{ ar: "ب", en: "b" }],
    bad: [["missing en", { ar: "ب" }]],
  },
  { name: "idSchema", schema: idSchema, valid: ["x"], bad: [["empty", ""]] },
  {
    name: "requiredText",
    schema: requiredText(5),
    valid: ["abc", "  abc  "],
    bad: [
      ["blank", "   ", "validation.required"],
      ["over max", "abcdef", "validation.too_long"],
    ],
  },
  {
    name: "optionalText",
    schema: optionalText(3),
    valid: ["", undefined, "abc"],
    bad: [["over max", "abcd", "validation.too_long"]],
  },
  {
    name: "nameSchema",
    schema: nameSchema,
    valid: ["Omar", "عمر"],
    bad: [
      ["one letter", "a", "validation.name_min"],
      ["over 80", "a".repeat(81), "validation.too_long"],
    ],
  },
  {
    name: "emailSchema",
    schema: emailSchema,
    valid: ["a@b.co", " A@B.CO "],
    bad: [["no at sign", "ab.co", "validation.email"]],
  },
  {
    name: "phoneSchema",
    schema: phoneSchema,
    valid: ["+249912345678"],
    bad: [
      ["local form", "0912345678", "validation.phone"],
      ["leading zero country", "+049912345678", "validation.phone"],
    ],
  },
  {
    name: "passwordSchema",
    schema: passwordSchema,
    valid: ["abcd1234", "كلمةسر12"],
    bad: [
      ["short", "ab1", "validation.password_min"],
      ["no letter", "12345678", "validation.password_letter"],
      ["no digit", "abcdefgh", "validation.password_digit"],
    ],
  },
  {
    name: "identifierSchema",
    schema: identifierSchema,
    valid: ["a@b.co", "0912345678", "٠٩١٢٣٤٥٦٧٨"],
    bad: [
      ["blank", " ", "validation.required"],
      ["neither", "abc", "validation.identifier"],
    ],
  },
  {
    name: "requiredInt",
    schema: requiredInt(1, 10, "validation.price_min"),
    valid: [1, 10],
    bad: [
      ["null", null, "validation.required"],
      ["decimal", 1.5, "validation.integer"],
      ["under min", 0, "validation.price_min"],
      ["over max", 11, "validation.too_large"],
    ],
  },
  {
    name: "optionalInt",
    schema: optionalInt(0, 10),
    valid: [null, 0],
    bad: [["under min", -1, "validation.number"]],
  },
  {
    name: "priceSchema",
    schema: priceSchema,
    valid: [1, 9_999_999_999],
    bad: [
      ["zero", 0, "validation.price_min"],
      ["too large", 10_000_000_000, "validation.too_large"],
    ],
  },
  {
    name: "yearSchema",
    schema: yearSchema,
    valid: [1970, year + 1],
    bad: [
      ["null", null, "validation.required"],
      ["decimal", 2000.5, "validation.integer"],
      ["before 1970", 1969, "validation.year_range"],
      ["after next year", year + 2, "validation.year_range"],
    ],
  },
  {
    name: "latSchema",
    schema: latSchema,
    valid: [-90, 15.5, 90],
    bad: [
      ["null", null, "validation.required"],
      ["under", -91, "validation.number"],
      ["over", 91, "validation.number"],
    ],
  },
  {
    name: "lngSchema",
    schema: lngSchema,
    valid: [-180, 32.5, 180],
    bad: [
      ["under", -181, "validation.number"],
      ["over", 181, "validation.number"],
    ],
  },
  {
    name: "geoSchema",
    schema: geoSchema,
    valid: [{ lat: 15.5, lng: 32.5 }],
    bad: [["bad lat", { lat: 100, lng: 32.5 }, "validation.number"]],
  },
  {
    name: "imageFileSchema",
    schema: imageFileSchema,
    valid: [file("image/png", 10)],
    bad: [
      ["not a file", "a.png", "validation.required"],
      ["not an image", file("application/pdf", 10), "validation.image_type"],
      ["svg", file("image/svg+xml", 10), "validation.image_type"],
      [
        "over 5 MB",
        file("image/png", 5 * 1024 * 1024 + 1),
        "validation.file_size_5mb",
      ],
    ],
  },
  {
    name: "hourSchema",
    schema: hourSchema,
    valid: [day(0), { ...day(6), closed: true }],
    bad: [
      ["day 7", day(7)],
      ["bad time", day(0, "8am")],
    ],
  },
  {
    name: "weeklyHoursSchema",
    schema: weeklyHoursSchema,
    valid: [
      week,
      [{ ...day(0, "18:00", "08:00"), closed: true }, ...week.slice(1)],
    ],
    bad: [
      ["six days", week.slice(1)],
      [
        "opens after it closes",
        [day(0, "18:00", "08:00"), ...week.slice(1)],
        "validation.hours_order",
      ],
    ],
  },
  {
    name: "pageOf",
    schema: pageOf(z.string()),
    valid: [{ items: ["a"], total: 1, page: 1, pageSize: 24 }],
    bad: [
      ["wrong item", { items: [1], total: 1, page: 1, pageSize: 24 }],
      ["no total", { items: [], page: 1, pageSize: 24 }],
    ],
  },
])

it("emailSchema lower-cases and trims", () => {
  expect(emailSchema.parse(" A@B.CO ")).toBe("a@b.co")
})
