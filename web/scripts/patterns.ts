// Physical direction classes (A1 rule 5), shared by check-rules.ts and audit-design.ts.
export const physical =
  /(?<!\w)-?(?:ml|mr|pl|pr|left|right)-\S|text-(?:left|right)\b|(?<![\w-])(?:border|rounded)-(?:l|r|tl|tr|bl|br)(?![\w])/
