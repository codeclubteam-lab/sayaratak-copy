/**
 * The one source of the current time (A1 rule 17). Services pass
 * `clock.now()` into SQL as a parameter instead of calling `now()` there.
 * Tests move time with `spyOn(clock, "now").mockReturnValue(date)`.
 */
export const clock = {
  now: () => new Date(),
}
