import { beforeAll, describe, test } from "bun:test"

import { resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)

const map = (query: string) => expectParity(`/api/v1/map?${query}`)
// Greater Khartoum.
const KHARTOUM = "bbox=32.4,15.4,32.7,15.8"

describe("GET /map matches the mock", () => {
  test("every layer, and each layer alone", async () => {
    await map("")
    for (const layer of ["vehicles", "dealerships", "workshops", "mechanics"])
      await map(`layers=${layer}`)
  })

  test("a bbox, layers comma separated and repeated, an unknown layer", async () => {
    await map(KHARTOUM)
    await map(`layers=dealerships,workshops&${KHARTOUM}`)
    await map(`layers=vehicles&layers=mechanics&${KHARTOUM}`)
    await map("layers=boats")
    await map("bbox=-180,-90,180,90")
  })

  test("vehicle filters", async () => {
    await map("layers=vehicles&make=toyota&intent=sale")
    await map(`layers=vehicles&type=truck&minPrice=1000000&${KHARTOUM}`)
    await map("layers=vehicles&featured=true")
    await map("layers=vehicles&kind=part")
  })
})
