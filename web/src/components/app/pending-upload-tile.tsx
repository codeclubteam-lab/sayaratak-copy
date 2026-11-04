import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"
import type { PendingUpload } from "@/hooks/use-image-uploads"
import { Button } from "@/components/ui/button"
import { RemoveButton } from "@/components/app/remove-button"
import { Progress } from "@/components/ui/progress"

// One file on its way: progress while uploading, Retry and Remove when it failed.
export function PendingUploadTile({
  item,
  onRetry,
  onRemove,
  className,
}: {
  item: PendingUpload
  onRetry: () => void
  onRemove: () => void
  className?: string
}) {
  const { t } = useT()
  const uploading = item.status === "uploading"
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {item.preview && (
        <img
          src={item.preview}
          width={320}
          height={320}
          alt=""
          className={cn("size-full object-cover", !uploading && "opacity-40")}
        />
      )}
      {uploading ? (
        <Progress
          value={item.progress}
          aria-label={t("common.uploading")}
          className="absolute inset-x-2 bottom-2"
        />
      ) : (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center"
        >
          <p className="text-caption font-medium">
            {t(item.error ?? "common.upload_failed")}
          </p>
          <div className="flex">
            {item.job && (
              <Button variant="ghost" onClick={onRetry}>
                {t("common.retry")}
              </Button>
            )}
            <RemoveButton
              variant="ghost"
              title={t("common.remove_photo_title")}
              onConfirm={onRemove}
            >
              {t("common.remove")}
            </RemoveButton>
          </div>
        </div>
      )}
    </div>
  )
}
