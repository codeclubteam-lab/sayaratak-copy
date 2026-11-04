import { describe, expect, it } from "vitest"
import type { z } from "zod"

// One valid value, then one failing value per rule. A key, when given, must be one of the issue messages.
export type SchemaCase = {
  name: string
  schema: z.ZodType
  valid: unknown[]
  bad: [rule: string, value: unknown, key?: string][]
}

export const messages = (schema: z.ZodType, value: unknown) =>
  schema.safeParse(value).error?.issues.map((i) => i.message) ?? []

export function runCases(cases: SchemaCase[]) {
  describe.each(cases)("$name", ({ schema, valid, bad }) => {
    it.each(valid.map((v, i) => [i, v]))("valid %i parses", (_, value) => {
      expect(schema.safeParse(value).error?.issues ?? []).toEqual([])
    })
    if (bad.length)
      it.each(bad)("fails: %s", (_, value, key) => {
        const result = schema.safeParse(value)
        expect(result.success).toBe(false)
        if (key) expect(messages(schema, value)).toContain(key)
      })
  })
}
