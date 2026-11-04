import { beforeAll, describe, test } from "bun:test"
import { sitePageSchema } from "@sayaratak/shared/schemas/admin"
import { z } from "zod"

import { resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)

// The mock lists in listing-array order and the api by id, which a search engine does not mind.
const sortByPath = (body: unknown) =>
  z
    .array(z.object({ path: z.string() }))
    .parse(body)
    .toSorted((a, b) => a.path.localeCompare(b.path))

test("GET /site matches the mock", async () => {
  await expectParity("/api/v1/site")
})

describe("GET /pages/:slug matches the mock", () => {
  test("each page and an unknown slug", async () => {
    for (const slug of [...sitePageSchema.shape.slug.options, "pricing"])
      await expectParity(`/api/v1/pages/${slug}`)
  })
})

describe("GET /banners matches the mock", () => {
  test("all live banners, each placement and an unknown one", async () => {
    for (const query of [
      "",
      "?placement=home_top",
      "?placement=home_middle",
      "?placement=search_top",
      "?placement=listing_aside",
      "?placement=directory_top",
      "?placement=nowhere",
    ])
      await expectParity(`/api/v1/banners${query}`)
  })
})

test("GET /sitemap matches the mock", async () => {
  await expectParity("/api/v1/sitemap", { ignore: sortByPath })
})

test("POST /contact matches the mock", async () => {
  const init = (body: unknown) => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  await expectParity("/api/v1/contact", {
    init: init({
      name: "Omar",
      contact: "omar@example.com",
      subject: "general",
      message: "My listing is not showing yet.",
    }),
  })
  await expectParity("/api/v1/contact", {
    init: init({ name: "O", message: "hi" }),
  })
})
