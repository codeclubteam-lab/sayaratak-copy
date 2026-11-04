import { useEffect, useRef, useState } from "react"
import { XIcon } from "lucide-react"

import type { ControlProps } from "@/components/app/form-field"
import { UploadDropzone } from "@/components/app/upload-dropzone"
import { imageFileTypes } from "@sayaratak/shared/schemas/fields"
import { RemoveButton } from "@/components/app/remove-button"
import { useT } from "@/lib/i18n/use-t"

// One image file: a dropzone, then a thumbnail with the file name and a remove button. The file is checked by the form's schema.
export function ImageFileInput({
  value,
  onChange,
  control,
  labels,
}: {
  value?: File
  onChange: (file?: File) => void
  control: ControlProps
  labels: { choose: string; preview: string; remove: string }
}) {
  const { t } = useT()
  const [preview, setPreview] = useState<string>()
  const current = useRef<string>(undefined)
  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current)
    },
    []
  )
  const pick = (file?: File) => {
    if (current.current) URL.revokeObjectURL(current.current)
    current.current = file?.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : undefined
    setPreview(current.current)
    onChange(file)
  }
  if (value)
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted p-2">
        {preview && (
          <img
            src={preview}
            width={64}
            height={64}
            alt={labels.preview}
            className="size-16 shrink-0 rounded-lg object-cover"
          />
        )}
        <span className="min-w-0 flex-1 truncate text-ui" dir="auto">
          {value.name}
        </span>
        <RemoveButton
          variant="ghost"
          size="icon"
          aria-label={labels.remove}
          title={t("common.remove_file_title")}
          onConfirm={() => {
            pick(undefined)
            // The button is gone after this: focus moves to the dropzone that replaces it.
            requestAnimationFrame(() =>
              document.getElementById(control.id)?.focus()
            )
          }}
        >
          <XIcon aria-hidden="true" />
        </RemoveButton>
      </div>
    )
  return (
    <UploadDropzone
      onFiles={(files) => pick(files[0])}
      inputProps={control}
      accept={imageFileTypes.join(",")}
      className="min-h-24 rounded-xl"
    >
      {labels.choose}
    </UploadDropzone>
  )
}
