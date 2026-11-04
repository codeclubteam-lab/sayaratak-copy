import { spyOn } from "bun:test"

/**
 * Makes the `nth` call of `module[name]` throw once and lets every other call run for real: the
 * "fail after the first batch" crash test of A10 (call 1 is the first batch, 2 the second).
 * Restore with the returned spy's `mockRestore()`.
 */
export function failOnCall<M extends object, K extends keyof M & string>(
  module: M,
  name: K,
  nth: number
) {
  const original = module[name] as (...args: unknown[]) => unknown
  let calls = 0
  return spyOn(module, name).mockImplementation(((...args: unknown[]) => {
    calls += 1
    if (calls === nth) throw new Error(`${name} crashed on call ${nth}`)
    return original(...args)
  }) as never)
}
