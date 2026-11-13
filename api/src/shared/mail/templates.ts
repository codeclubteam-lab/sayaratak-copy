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

const EXPIRY: Record<Locale, (minutes: number) => string> = {
  ar: (minutes) => `تنتهي صلاحية هذا الرمز خلال ${minutes} دقائق.`,
  en: (minutes) => `This code expires in ${minutes} minutes.`,
}
const SECURITY: Record<Locale, string> = {
  ar: "لا تشارك هذا الرمز مع أي شخص. إذا لم تطلبه، فتجاهل هذه الرسالة.",
  en: "Never share this code. If you didn't request it, you can ignore this email.",
}

/** No external assets or tracking; Arabic copy is RTL, codes are always LTR. */
export function renderCode({ template, locale, code }: CodeMail): RenderedMail {
  const { subject, lead } = WORDS[template][locale]
  const expiry = EXPIRY[locale](CODE_MINUTES)
  const security = SECURITY[locale]
  const dir = locale === "ar" ? "rtl" : "ltr"
  const brand = locale === "ar" ? "سيارتك" : "Sayaratak"
  const html = `<!doctype html><html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f6f8;color:#1d2533;font-family:Arial,sans-serif;line-height:1.6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-top:4px solid #3659e3;text-align:${locale === "ar" ? "right" : "left"}">
<tr><td style="padding:32px 24px 16px;font-size:22px;font-weight:bold;color:#3659e3">${brand}</td></tr>
<tr><td style="padding:0 24px"><h1 style="margin:0 0 16px;font-size:24px;line-height:1.4">${subject}</h1>
<p style="margin:0 0 24px;font-size:16px">${lead}</p></td></tr>
<tr><td style="padding:0 24px"><p dir="ltr" style="margin:0;padding:20px 12px;background-color:#ebefff;color:#203582;text-align:center;font-family:Consolas,monospace;font-size:36px;font-weight:bold;letter-spacing:8px;white-space:nowrap">${Bun.escapeHTML(code)}</p></td></tr>
<tr><td style="padding:16px 24px 32px"><p style="margin:0 0 24px;font-size:14px">${expiry}</p>
<p style="margin:0;padding-top:20px;border-top:1px solid #e3e7ed;color:#535f73;font-size:14px">${security}</p></td></tr>
</table></td></tr></table></body></html>`
  return {
    subject,
    text: `${brand}\n\n${subject}\n\n${lead}\n\n${code}\n\n${expiry}\n\n${security}\n`,
    html,
  }
}
