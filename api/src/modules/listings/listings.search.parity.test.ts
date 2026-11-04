import { beforeAll, describe, test } from "bun:test"
import { and, asc, eq, isNotNull } from "drizzle-orm"

import { db } from "~/shared/db/client"

import { resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"
import { listings } from "./listings.tables"

beforeAll(resetDb)

const search = (query: string) => expectParity(`/api/v1/listings?${query}`)

async function firstPart() {
  const [row] = await db
    .select()
    .from(listings)
    .where(
      and(
        eq(listings.kind, "part"),
        eq(listings.moderation, "approved"),
        isNotNull(listings.partCategoryId)
      )
    )
    .orderBy(asc(listings.id))
    .limit(1)
  if (!row) throw new Error("the seed has no approved part")
  return row
}

// Relevance turns Featured by a hash of id and hour; both sides must read the
// same hour, so a run in the last 15 seconds of an hour waits for the next.
async function sameHour() {
  const left = 3_600_000 - (Date.now() % 3_600_000)
  if (left < 15_000) await Bun.sleep(left + 100)
}

describe("GET /listings relevance matches the mock", () => {
  test("pages 1 to 3 of an unfiltered search", async () => {
    await sameHour()
    for (const page of [1, 2, 3]) await search(`page=${page}`)
  })

  test("a make filter with facets, Featured only, nearest without a point", async () => {
    await sameHour()
    await search("make=toyota")
    await search("featured=true")
    await search("featured=true&page=2")
    await search("sort=nearest&type=car")
  })

  test("a rail", async () => {
    await sameHour()
    const part = await firstPart()
    await search(`kind=part&limit=6&exclude=${part.id}`)
  })
})

describe("GET /listings matches the mock", () => {
  test("newest, and each sort", async () => {
    for (const sort of [
      "newest",
      "price_asc",
      "price_desc",
      "year_desc",
      "mileage_asc",
    ])
      await search(`sort=${sort}`)
  })

  test("kind, type and intent", async () => {
    await search("kind=vehicle&type=car&intent=sale&sort=price_asc")
    await search("intent=rent&sort=newest")
    await search("type=truck&sort=newest")
  })

  test("make, model, city and district", async () => {
    await search("make=toyota&model=toyota-corolla&sort=price_desc")
    await search("make=toyota&sort=newest")
    await search("city=khartoum&district=khartoum-riyadh&sort=newest")
    await search("city=omdurman&sort=newest")
  })

  test("price, year and mileage ranges", async () => {
    await search(
      "minPrice=1000000&maxPrice=50000000&minYear=2010&maxYear=2020&maxMileage=200000&sort=year_desc"
    )
  })

  test("fuel, transmission and condition (lists match any value)", async () => {
    await search(
      "fuel=petrol&fuel=diesel&transmission=automatic&condition=used&sort=mileage_asc"
    )
    await search("fuel=hybrid&sort=newest")
  })

  test("parts: category, fits type and year, part type", async () => {
    const part = await firstPart()
    await search(`kind=part&partCategory=${part.partCategoryId}&sort=newest`)
    await search("kind=part&type=car&fitsYear=2015&sort=newest")
    await search("kind=part&partType=genuine&sort=price_asc")
  })

  test("words in q, Latin and Arabic", async () => {
    await search("q=toyota&sort=newest")
    await search("q=clean%20car&sort=newest")
    await search(`q=${encodeURIComponent("تويوتا")}&sort=newest`)
    await search("q=50%25_x&sort=newest")
  })

  test("radius around a point and nearest first", async () => {
    await search("lat=15.5&lng=32.53&radius=25&sort=nearest")
    await search("lat=15.5&lng=32.53&sort=nearest&city=khartoum")
  })

  test("yes-only flags", async () => {
    await search("customs=true&accidentFree=true&sort=newest")
    await search("firstOwner=true&fullService=true&sort=newest")
    await search("warranty=true&exchange=true&sort=newest")
    await search("registered=true&financing=true&sort=newest")
  })

  test("spec lists, features and seats", async () => {
    await search("body=sedan&body=suv&drive=fwd&madeIn=japan&sort=newest")
    await search("features=air_conditioning&seatsMin=5&sort=newest")
    await search("driver=included&intent=rent&sort=newest")
  })

  test("verified sellers, video, Featured, sold and one seller", async () => {
    await search("verifiedOnly=true&sort=newest")
    await search("hasVideo=true&sort=newest")
    await search("featured=true&sort=newest")
    await search("includeSold=true&seller=u-dealer&sort=newest")
  })

  test("pages, past the last page, and a rail", async () => {
    await search("sort=newest&page=2")
    await search("sort=newest&page=999")
    const part = await firstPart()
    await search(`kind=part&limit=6&exclude=${part.id}&sort=newest`)
  })
})
