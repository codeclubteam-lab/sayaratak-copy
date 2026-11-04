import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useDelayedFlag } from "@/lib/use-delayed-flag"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const run = (ms: number) => act(() => vi.advanceTimersByTime(ms))

describe("useDelayedFlag", () => {
  it("never shows a flag that is true for 100 ms", () => {
    const { result, rerender } = renderHook(
      ({ flag }) => useDelayedFlag(flag),
      {
        initialProps: { flag: true },
      }
    )
    run(100)
    rerender({ flag: false })
    run(1000)
    expect(result.current).toBe(false)
  })

  it("shows at 150 ms and stays at least 300 ms", () => {
    const { result, rerender } = renderHook(
      ({ flag }) => useDelayedFlag(flag),
      {
        initialProps: { flag: true },
      }
    )
    run(149)
    expect(result.current).toBe(false)
    run(1)
    expect(result.current).toBe(true)
    // The flag ends 50 ms after it was shown, so it holds for another 250 ms.
    run(50)
    rerender({ flag: false })
    run(249)
    expect(result.current).toBe(true)
    run(1)
    expect(result.current).toBe(false)
  })

  it("hides at once when the minimum has passed", () => {
    const { result, rerender } = renderHook(
      ({ flag }) => useDelayedFlag(flag),
      {
        initialProps: { flag: true },
      }
    )
    run(150)
    run(400)
    rerender({ flag: false })
    run(0)
    expect(result.current).toBe(false)
  })

  it("accepts its own delay and minimum", () => {
    const { result, rerender } = renderHook(
      ({ flag }) => useDelayedFlag(flag, { delayMs: 300, minMs: 0 }),
      { initialProps: { flag: true } }
    )
    run(299)
    expect(result.current).toBe(false)
    run(1)
    expect(result.current).toBe(true)
    rerender({ flag: false })
    run(0)
    expect(result.current).toBe(false)
  })
})
