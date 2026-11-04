// A field whose ref RHF cannot reach (a custom control) still gets the focus. The errors render a frame or two later, so look again for a few frames. A field inside a closed <details> section opens it first, or the focus would go nowhere.
export function focusFirstInvalid(root: HTMLElement | null, frames = 10) {
  requestAnimationFrame(() => {
    const invalid = [
      ...(root?.querySelectorAll<HTMLElement>("[aria-invalid=true]") ?? []),
    ].find((el) => el.tabIndex >= 0)
    if (invalid) {
      for (
        let d = invalid.closest("details");
        d;
        d = d.parentElement?.closest("details") ?? null
      )
        d.open = true
      invalid.focus()
    } else if (frames > 0) focusFirstInvalid(root, frames - 1)
  })
}
