import type { AdminPayment } from "@sayaratak/shared/schemas/responses"

// The payment reference as the button that opens the payment's sheet.
export function PaymentReferenceCell({
  payment,
  onOpen,
}: {
  payment: AdminPayment
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 items-center rounded-lg text-start text-ui font-medium motion-color hover:text-primary"
    >
      <bdi dir="ltr" className="num">
        {payment.reference}
      </bdi>
    </button>
  )
}
