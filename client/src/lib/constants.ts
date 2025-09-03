export const DEFAULT_USER_ID = "user-1";

export const INVOICE_STATUSES = {
  DRAFT: "draft",
  SENT: "sent",
  PAID: "paid",
  OVERDUE: "overdue",
} as const;

export const INVOICE_STATUS_COLORS = {
  [INVOICE_STATUSES.DRAFT]: "bg-muted text-muted-foreground",
  [INVOICE_STATUSES.SENT]: "bg-accent text-accent-foreground",
  [INVOICE_STATUSES.PAID]: "bg-primary text-primary-foreground",
  [INVOICE_STATUSES.OVERDUE]: "bg-destructive text-destructive-foreground",
} as const;

export const PRODUCT_CATEGORIES = [
  "Subscription",
  "Services",
  "Software",
  "Hardware",
  "Consulting",
  "Training",
  "Support",
  "Other",
] as const;
