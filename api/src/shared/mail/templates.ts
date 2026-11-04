import type { Locale, MailTemplate } from "./send"

type CodeMail = { template: MailTemplate; locale: Locale; code: string }

export type RenderedMail = { subject: string; text: string; html: string }

type Words = { subject: string; lead: string }

const CODE_MINUTES = 10

// One subject and lead line per template and language. The code, its life
// and the "ignore this" line are the same in every mail.
const WORDS: Record<MailTemplate, Record<Locale, Words>> = {
  "email-verification": {
    ar: {
      subject: "رمز تأكيد بريدك في سيارتك",
      lead: "أدخل هذا الرمز لتأكيد بريدك الإلكتروني:",
    },
    en: {
      subject: "Your Sayaratak verification code",
      lead: "Enter this code to confirm your email:",
    },
  },
  "sign-in": {
    ar: {
      subject: "رمز الدخول إلى سيارتك",
      lead: "أدخل هذا الرمز لتسجيل الدخول:",
    },
    en: {
      subject: "Your Sayaratak sign-in code",
      lead: "Enter this code to sign in:",
    },
  },
  "forget-password": {
    ar: {
      subject: "رمز إعادة تعيين كلمة المرور",
      lead: "أدخل هذا الرمز لتعيين كلمة مرور جديدة:",
    },
    en: {
      subject: "Your Sayaratak password reset code",
      lead: "Enter this code to set a new password:",
    },
  },
  "change-email": {
    ar: {
      subject: "رمز تأكيد البريد الجديد",
      lead: "أدخل هذا الرمز لتأكيد بريدك الجديد:",
    },
    en: {
      subject: "Confirm your new email",
      lead: "Enter this code to confirm your new email:",
    },
  },
  "platform-admin": {
    ar: {
      subject: "رمز تأكيد تغيير حساب مدير المنصة",
      lead: "أدخل هذا الرمز لتأكيد التغيير على حساب مدير المنصة:",
    },
    en: {
      subject: "Confirm a change to the platform admin",
      lead: "Enter this code to confirm the change to the platform admin account:",
    },
  },
  "admin-code": {
    ar: {
      subject: "رمز دخول المشرف",
      lead: "أدخل هذا الرمز لإكمال دخول المشرف:",
    },
    en: {
      subject: "Your admin sign-in code",
      lead: "Enter this code to finish the admin sign-in:",
    },
  },
}

const FOOTER: Record<Locale, (minutes: number) => string> = {
  ar: (minutes) =>
    `ينتهي الرمز بعد ${minutes} دقائق. إذا لم تطلبه فتجاهل هذه الرسالة.`,
  en: (minutes) =>
    `The code expires in ${minutes} minutes. If you did not ask for it, ignore this email.`,
}

/** A code mail as text and simple HTML (A9): no images, no tracking, RTL root in Arabic. */
export function renderCode({ template, locale, code }: CodeMail): RenderedMail {
  const { subject, lead } = WORDS[template][locale]
  const footer = FOOTER[locale](CODE_MINUTES)
  const dir = locale === "ar" ? "rtl" : "ltr"
  const html = `<!doctype html><html lang="${locale}" dir="${dir}"><body style="font-family:Arial,sans-serif;line-height:1.5"><p>${lead}</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px" dir="ltr">${code}</p><p>${footer}</p></body></html>`
  return { subject, text: `${lead}\n\n${code}\n\n${footer}\n`, html }
}
