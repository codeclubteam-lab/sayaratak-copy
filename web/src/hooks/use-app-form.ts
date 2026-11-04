import { useRef } from "react"
import {
  useForm,
  type FieldValues,
  type UseFormProps,
  type UseFormRegister,
  type UseFormReturn,
} from "react-hook-form"

// `useForm` for every form in the app (A7: on touched, then on change), with one change: leaving an empty text field before the first submit does nothing. It is not marked touched and shows no error, so an autofocused field the person clicks away from stays quiet. A field with text still validates on blur, and after a submit every field validates as before.
export function useAppForm<
  TFieldValues extends FieldValues = FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues,
>(
  props?: UseFormProps<TFieldValues, TContext, TTransformedValues>
): UseFormReturn<TFieldValues, TContext, TTransformedValues> {
  const form = useForm(props)
  const patched = useRef(false)
  if (!patched.current) {
    patched.current = true
    const register = form.register
    // The form object is stable across renders, so it is patched once.
    const wrapped: UseFormRegister<TFieldValues> = (name, options) => {
      const field = register(name, options)
      return {
        ...field,
        onBlur: async (event) => {
          const value: unknown = event.target?.value
          const blank = typeof value === "string" && value.trim() === ""
          if (blank && !form.formState.isSubmitted) return
          return field.onBlur(event)
        },
      }
    }
    form.register = wrapped
  }
  return form
}
