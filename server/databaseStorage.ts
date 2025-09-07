import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  customers,
  products,
  productVariants,
  productSchemes,
  invoices,
  invoiceLineItems,
  type User,
  type Customer,
  type Product,
  type ProductVariant,
  type ProductScheme,
  type Invoice,
  type InvoiceLineItem,
  type InsertUser,
  type InsertCustomer,
  type InsertProduct,
  type InsertProductVariant,
  type InsertProductScheme,
  type InsertInvoice,
  type InsertInvoiceLineItem,
} from "@shared/schema";
import { IStorage } from "./storage";
import { randomUUID } from "crypto";

export class DatabaseStorage implements IStorage {
  private initialized = false;

  private async ensureInitialized() {
    if (this.initialized) return;
    
    try {
      // Create default user if none exists
      const existingUsers = await db.select().from(users).limit(1);
      if (existingUsers.length === 0) {
        const defaultUser: InsertUser = {
          username: "demo",
          password: "password",
          email: "demo@example.com",
          quickbooksCompanyId: null,
          quickbooksAccessToken: null,
          quickbooksRefreshToken: null,
          quickbooksTokenExpiry: null,
        };
        // Override ID after insert
        const [insertedUser] = await db.insert(users).values(defaultUser).returning();
        if (insertedUser.id !== "user-1") {
          await db.update(users).set({ id: "user-1" }).where(eq(users.id, insertedUser.id));
        }
        return;
      }
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize database:", error);
    }
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    await this.ensureInitialized();
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  // Customers
  async getCustomers(userId: string): Promise<Customer[]> {
    return await db.select().from(customers).where(eq(customers.userId, userId));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async createCustomer(insertCustomer: InsertCustomer & { userId: string }): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer | undefined> {
    const [customer] = await db.update(customers).set(updates).where(eq(customers.id, id)).returning();
    return customer;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const result = await db.delete(customers).where(eq(customers.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Products
  async getProducts(userId: string): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.userId, userId));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(insertProduct: InsertProduct & { userId: string }): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const [product] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return product;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Product Variants
  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    return await db.select().from(productVariants).where(eq(productVariants.productId, productId));
  }

  async getProductVariant(id: string): Promise<ProductVariant | undefined> {
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, id));
    return variant;
  }

  async getVariant(id: string): Promise<ProductVariant | undefined> {
    return this.getProductVariant(id);
  }

  async createProductVariant(insertVariant: InsertProductVariant): Promise<ProductVariant> {
    const [variant] = await db.insert(productVariants).values(insertVariant).returning();
    return variant;
  }

  async createVariant(insertVariant: InsertProductVariant): Promise<ProductVariant> {
    return this.createProductVariant(insertVariant);
  }

  async updateProductVariant(id: string, updates: Partial<ProductVariant>): Promise<ProductVariant | undefined> {
    const [variant] = await db.update(productVariants).set(updates).where(eq(productVariants.id, id)).returning();
    return variant;
  }

  async updateVariant(id: string, updates: Partial<ProductVariant>): Promise<ProductVariant | undefined> {
    return this.updateProductVariant(id, updates);
  }

  async deleteProductVariant(id: string): Promise<boolean> {
    const result = await db.delete(productVariants).where(eq(productVariants.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Product Schemes
  async getProductSchemes(userId: string): Promise<ProductScheme[]> {
    return await db.select().from(productSchemes).where(eq(productSchemes.userId, userId));
  }

  async getProductScheme(id: string): Promise<ProductScheme | undefined> {
    const [scheme] = await db.select().from(productSchemes).where(eq(productSchemes.id, id));
    return scheme;
  }

  async getScheme(id: string): Promise<ProductScheme | undefined> {
    return this.getProductScheme(id);
  }

  async createProductScheme(insertScheme: InsertProductScheme & { userId: string }): Promise<ProductScheme> {
    const [scheme] = await db.insert(productSchemes).values(insertScheme).returning();
    return scheme;
  }

  async createScheme(insertScheme: InsertProductScheme & { userId: string }): Promise<ProductScheme> {
    return this.createProductScheme(insertScheme);
  }

  async updateProductScheme(id: string, updates: Partial<ProductScheme>): Promise<ProductScheme | undefined> {
    const [scheme] = await db.update(productSchemes).set(updates).where(eq(productSchemes.id, id)).returning();
    return scheme;
  }

  async updateScheme(id: string, updates: Partial<ProductScheme>): Promise<ProductScheme | undefined> {
    return this.updateProductScheme(id, updates);
  }

  async deleteProductScheme(id: string): Promise<boolean> {
    const result = await db.delete(productSchemes).where(eq(productSchemes.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deleteScheme(id: string): Promise<boolean> {
    return this.deleteProductScheme(id);
  }

  // Invoices
  async getInvoices(userId: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.userId, userId));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async createInvoice(insertInvoice: InsertInvoice & { userId: string }): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(insertInvoice).returning();
    return invoice;
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice | undefined> {
    const [invoice] = await db.update(invoices).set(updates).where(eq(invoices.id, id)).returning();
    return invoice;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Invoice Line Items
  async getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
    return await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
  }

  async getInvoiceLineItem(id: string): Promise<InvoiceLineItem | undefined> {
    const [item] = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.id, id));
    return item;
  }

  async createInvoiceLineItem(insertItem: InsertInvoiceLineItem): Promise<InvoiceLineItem> {
    const [item] = await db.insert(invoiceLineItems).values(insertItem).returning();
    return item;
  }

  async createLineItem(insertItem: InsertInvoiceLineItem): Promise<InvoiceLineItem> {
    return this.createInvoiceLineItem(insertItem);
  }

  async updateInvoiceLineItem(id: string, updates: Partial<InvoiceLineItem>): Promise<InvoiceLineItem | undefined> {
    const [item] = await db.update(invoiceLineItems).set(updates).where(eq(invoiceLineItems.id, id)).returning();
    return item;
  }

  async deleteInvoiceLineItem(id: string): Promise<boolean> {
    const result = await db.delete(invoiceLineItems).where(eq(invoiceLineItems.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deleteLineItem(id: string): Promise<boolean> {
    return this.deleteInvoiceLineItem(id);
  }

  async deleteInvoiceLineItemsByInvoiceId(invoiceId: string): Promise<boolean> {
    const result = await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
    return (result.rowCount || 0) > 0;
  }
}