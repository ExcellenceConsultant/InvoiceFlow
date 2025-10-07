import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default("view_print_only"), // primary_admin, admin, invoice_creation, view_print_only
  quickbooksCompanyId: text("quickbooks_company_id"),
  quickbooksCompanyName: text("quickbooks_company_name"),
  quickbooksAccessToken: text("quickbooks_access_token"),
  quickbooksRefreshToken: text("quickbooks_refresh_token"),
  quickbooksTokenExpiry: timestamp("quickbooks_token_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  isActive: boolean("is_active").default(true),
  quickbooksCustomerId: text("quickbooks_customer_id"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Product Name
  date: timestamp("date").notNull(), // Date
  itemCode: text("item_code"), // Item Code
  packingSize: text("packing_size"), // Packing Size
  category: text("category"), // Category
  qty: integer("qty").notNull().default(0), // Qty
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(), // Base Price
  grossWeight: decimal("gross_weight", { precision: 10, scale: 3 }), // Gross Weight
  netWeight: decimal("net_weight", { precision: 10, scale: 3 }), // Net Weight
  description: text("description"),
  schemeDescription: text("scheme_description"), // Scheme Description
  quickbooksItemId: text("quickbooks_item_id"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productVariants = pgTable("product_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  productId: varchar("product_id").references(() => products.id), // Optional - schemes are now based on total qty
  buyQuantity: integer("buy_quantity").notNull(),
  freeQuantity: integer("free_quantity").notNull(),
  isActive: boolean("is_active").default(true),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  freight: decimal("freight", { precision: 10, scale: 2 }).default("0").notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("draft"), // draft, sent, paid, overdue
  invoiceType: text("invoice_type").notNull().default("receivable"), // receivable (AR), payable (AP)
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date"),
  notes: text("notes"),
  quickbooksInvoiceId: text("quickbooks_invoice_id"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  productId: varchar("product_id").references(() => products.id),
  variantId: varchar("variant_id").references(() => productVariants.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  productCode: text("product_code"),
  packingSize: text("packing_size"),
  grossWeightKgs: decimal("gross_weight_kgs", { precision: 10, scale: 3 }),
  netWeightKgs: decimal("net_weight_kgs", { precision: 10, scale: 3 }),
  category: text("category"),
  isFreeFromScheme: boolean("is_free_from_scheme").default(false),
  isSchemeDescription: boolean("is_scheme_description").default(false),
  schemeId: varchar("scheme_id").references(() => productSchemes.id),
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

// UpsertUser schema for Replit Auth
export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  date: z.string().transform((str) => new Date(str)),
});

export const insertProductVariantSchema = createInsertSchema(productVariants).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchemeSchema = createInsertSchema(productSchemes).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  invoiceDate: z.string().transform((str) => new Date(str)),
  dueDate: z.string().optional().transform((str) => str ? new Date(str) : null),
});

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
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
