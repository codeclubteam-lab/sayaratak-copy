import type { ComponentType } from "react"

import type { Checkout } from "@sayaratak/shared/schemas/responses"
import { PaymentForm } from "./components/payment-form"
import { TransferInstructions } from "./components/transfer-instructions"

// A way to pay: what the customer reads and the form that takes the proof. Bankak transfer is the only one for now; a gateway joins by adding an entry here (the checkout page only reads `defaultProvider`).
export type PaymentProvider = {
  id: string
  labelKey: string
  Instructions: ComponentType<{ checkout: Checkout }>
  Form: ComponentType<{ checkout: Checkout }>
}

export const paymentProviders = {
  bankak_transfer: {
    id: "bankak_transfer",
    labelKey: "billing.provider_bankak_transfer",
    Instructions: TransferInstructions,
    Form: PaymentForm,
  },
} satisfies Record<string, PaymentProvider>

export const defaultProvider: PaymentProvider = paymentProviders.bankak_transfer
