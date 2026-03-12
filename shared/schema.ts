import { sql } from "drizzle-orm";
import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: varchar("username").notNull().unique(),
  email: varchar("email"), // Optional now
  mobile: varchar("mobile").notNull().unique(), // Required for password reset
  password: text("password").notNull(),
  role: text("role").notNull().default("viewer"), // super_admin, admin, poster, viewer
  invoiceEditLockHours: integer("invoice_edit_lock_hours").notNull().default(72), // Hours within which invoice can be edited
  quickbooksCompanyId: text("quickbooks_company_id"),
  quickbooksCompanyName: text("quickbooks_company_name"),
  quickbooksAccessToken: text("quickbooks_access_token"),
  quickbooksRefreshToken: text("quickbooks_refresh_token"),
  quickbooksTokenExpiry: timestamp("quickbooks_token_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// System-wide QuickBooks configuration (shared across all users)
export const systemSettings = pgTable("system_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const customers = pgTable("customers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: jsonb("address").$type<{
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  }>(),
  type: text("type").notNull().default("customer"), // "customer" or "vendor"
  customerCategory: text("customer_category"), // Manual text field for category
  isActive: boolean("is_active").default(true),
  quickbooksCustomerId: text("quickbooks_customer_id"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Product Name
  brand: text("brand"), // Brand
  date: timestamp("date").notNull(), // Date
  itemCode: text("item_code"), // Item Code
  packingSize: text("packing_size"), // Packing Size
  category: text("category"), // Category
  qty: integer("qty").notNull().default(0), // Qty
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(), // Base Price
  salesPrice: decimal("sales_price", { precision: 10, scale: 2 }), // Sales Price
  grossWeight: decimal("gross_weight", { precision: 10, scale: 3 }), // Gross Weight
  netWeight: decimal("net_weight", { precision: 10, scale: 3 }), // Net Weight
  description: text("description"),
  schemeDescription: text("scheme_description"), // Scheme Description
  cartoonBarcode: text("cartoon_barcode"), // Cartoon Barcode
  marginPerCarton: decimal("margin_per_carton", { precision: 10, scale: 2 }), // Margin per carton (inventory default)
  marginUpdatedBy: varchar("margin_updated_by"), // User who last updated margin
  marginUpdatedAt: timestamp("margin_updated_at"), // When margin was last updated
  quickbooksItemId: text("quickbooks_item_id"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productVariants = pgTable("product_variants", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stockQuantity: integer("stock_quantity").default(0),
  lowStockThreshold: integer("low_stock_threshold").default(10),
  attributes: jsonb("attributes").$type<Record<string, string>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productSchemes = pgTable("product_schemes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  productId: varchar("product_id").references(() => products.id), // Optional - schemes are now based on total qty
  productIds: text("product_ids").array(), // Multiple products for the scheme
  buyQuantity: integer("buy_quantity").notNull(),
  freeQuantity: integer("free_quantity").notNull(),
  isActive: boolean("is_active").default(true),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  purchaseOrder: text("purchase_order"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  freight: decimal("freight", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("draft"), // draft, sent, paid, overdue
  invoiceType: text("invoice_type").notNull().default("receivable"), // receivable (AR), payable (AP)
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date"),
  paymentTerms: integer("payment_terms").default(30).notNull(),
  notes: text("notes"),
  bankDetails: text("bank_details"),
  quickbooksInvoiceId: text("quickbooks_invoice_id"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  productId: varchar("product_id").references(() => products.id),
  variantId: varchar("variant_id").references(() => productVariants.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  productCode: text("product_code"),
  cartoonBarcode: text("cartoon_barcode"),
  packingSize: text("packing_size"),
  grossWeightKgs: decimal("gross_weight_kgs", { precision: 10, scale: 3 }),
  netWeightKgs: decimal("net_weight_kgs", { precision: 10, scale: 3 }),
  category: text("category"),
  isFreeFromScheme: boolean("is_free_from_scheme").default(false),
  isSchemeDescription: boolean("is_scheme_description").default(false),
  schemeId: varchar("scheme_id").references(() => productSchemes.id),
  marginPerCarton: decimal("margin_per_carton", { precision: 10, scale: 2 }),
  marginUpdatedBy: varchar("margin_updated_by"),
  marginUpdatedAt: timestamp("margin_updated_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const creditMemos = pgTable("credit_memos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  creditMemoNumber: text("credit_memo_number").notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  freight: decimal("freight", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("draft"), // draft, sent, paid
  invoiceType: text("invoice_type").notNull().default("receivable"), // receivable (AR), payable (AP)
  creditMemoDate: timestamp("credit_memo_date").notNull(),
  notes: text("notes"),
  quickbooksCreditMemoId: text("quickbooks_credit_memo_id"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const creditMemoLineItems = pgTable("credit_memo_line_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  creditMemoId: varchar("credit_memo_id").references(() => creditMemos.id),
  productId: varchar("product_id").references(() => products.id),
  variantId: varchar("variant_id").references(() => productVariants.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  productCode: text("product_code"),
  cartoonBarcode: text("cartoon_barcode"),
  packingSize: text("packing_size"),
  grossWeightKgs: decimal("gross_weight_kgs", { precision: 10, scale: 3 }),
  netWeightKgs: decimal("net_weight_kgs", { precision: 10, scale: 3 }),
  category: text("category"),
  isFreeFromScheme: boolean("is_free_from_scheme").default(false),
  isSchemeDescription: boolean("is_scheme_description").default(false),
  schemeId: varchar("scheme_id").references(() => productSchemes.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Price Rules - custom prices per customer category and product
export const priceRules = pgTable("price_rules", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  customerCategory: text("customer_category").notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  customPrice: decimal("custom_price", { precision: 10, scale: 2 }).notNull(),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Category Margins - customer category-wise margin settings
export const apiKeys = pgTable("api_keys", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const categoryMargins = pgTable("category_margins", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  customerCategory: text("customer_category").notNull(),
  productId: varchar("product_id").references(() => products.id),
  marginAmount: decimal("margin_amount", { precision: 10, scale: 2 }).notNull(),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sales Orders
export const salesOrders = pgTable("sales_orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  customerName: text("customer_name"), // stored for external/unmatched customers
  status: text("status").notNull().default("pending"), // pending, confirmed, converted, cancelled
  source: text("source").notNull().default("manual"), // manual, api
  externalId: text("external_id"), // third-party system's ID for sync
  notes: text("notes"),
  purchaseOrder: text("purchase_order"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  freight: decimal("freight", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
  convertedInvoiceId: varchar("converted_invoice_id").references(() => invoices.id),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const salesOrderLineItems = pgTable("sales_order_line_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  salesOrderId: varchar("sales_order_id").references(() => salesOrders.id),
  productId: varchar("product_id").references(() => products.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  productCode: text("product_code"),
  cartoonBarcode: text("cartoon_barcode"),
  packingSize: text("packing_size"),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  quickbooksCompanyId: true,
  quickbooksCompanyName: true,
  quickbooksAccessToken: true,
  quickbooksRefreshToken: true,
  quickbooksTokenExpiry: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products)
  .omit({
    id: true,
    userId: true,
    createdAt: true,
  })
  .extend({
    date: z.string().transform((str) => new Date(str)),
  });

export const insertProductVariantSchema = createInsertSchema(
  productVariants,
).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchemeSchema = createInsertSchema(
  productSchemes,
).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices)
  .omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    invoiceDate: z.string().transform((str) => new Date(str)),
    dueDate: z
      .string()
      .optional()
      .transform((str) => (str ? new Date(str) : null)),
    purchaseOrder: z.union([z.string(), z.null()]).optional(),
  });

export const insertInvoiceLineItemSchema = createInsertSchema(
  invoiceLineItems,
).omit({
  id: true,
  createdAt: true,
});

export const insertCreditMemoSchema = createInsertSchema(creditMemos)
  .omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    creditMemoDate: z.string().transform((str) => new Date(str)),
  });

export const insertCreditMemoLineItemSchema = createInsertSchema(
  creditMemoLineItems,
).omit({
  id: true,
  createdAt: true,
});

export const insertPriceRuleSchema = createInsertSchema(priceRules).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCategoryMarginSchema = createInsertSchema(categoryMargins).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  keyHash: true,
  keyPrefix: true,
  lastUsedAt: true,
  createdAt: true,
});

export const insertSalesOrderSchema = createInsertSchema(salesOrders).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  convertedInvoiceId: true,
});

export const insertSalesOrderLineItemSchema = createInsertSchema(salesOrderLineItems).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductVariant = typeof productVariants.$inferSelect;
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type ProductScheme = typeof productSchemes.$inferSelect;
export type InsertProductScheme = z.infer<typeof insertProductSchemeSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type CreditMemo = typeof creditMemos.$inferSelect;
export type InsertCreditMemo = z.infer<typeof insertCreditMemoSchema>;
export type CreditMemoLineItem = typeof creditMemoLineItems.$inferSelect;
export type InsertCreditMemoLineItem = z.infer<
  typeof insertCreditMemoLineItemSchema
>;
export type PriceRule = typeof priceRules.$inferSelect;
export type InsertPriceRule = z.infer<typeof insertPriceRuleSchema>;
export type CategoryMargin = typeof categoryMargins.$inferSelect;
export type InsertCategoryMargin = z.infer<typeof insertCategoryMarginSchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type SalesOrder = typeof salesOrders.$inferSelect;
export type InsertSalesOrder = z.infer<typeof insertSalesOrderSchema>;
export type SalesOrderLineItem = typeof salesOrderLineItems.$inferSelect;
export type InsertSalesOrderLineItem = z.infer<typeof insertSalesOrderLineItemSchema>;
