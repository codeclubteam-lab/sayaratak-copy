import { AlertCircleIcon, Loader2Icon } from "lucide-react"

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
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/50 bg-muted",
        className
      )}
    >
      {item.preview && (
        <img
          src={item.preview}
          width={320}
          height={320}
          alt=""
          className={cn(
            "size-full object-cover transition-opacity duration-200",
            uploading ? "opacity-60" : "opacity-30"
          )}
        />
      )}
      {uploading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/30 p-3 backdrop-blur-[1px]">
          <span className="flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-caption font-medium text-foreground shadow-sm">
            <Loader2Icon
              aria-hidden
              className="size-3.5 animate-spin text-primary"
            />
            <span>{t("common.uploading")}</span>
          </span>
          <Progress
            value={item.progress}
            aria-label={t("common.uploading")}
            className="h-1.5 w-4/5 max-w-44"
          />
        </div>
      ) : (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/85 p-2 text-center backdrop-blur-[2px]"
        >
          <div className="flex items-center gap-1 text-destructive">
            <AlertCircleIcon aria-hidden className="size-4 shrink-0" />
            <p className="text-caption font-medium">
              {t(item.error ?? "common.upload_failed")}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {item.job && (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                {t("common.retry")}
              </Button>
            )}
            <RemoveButton
              size="sm"
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
