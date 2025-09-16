import { type User, type InsertUser, type Customer, type InsertCustomer, 
         type Product, type InsertProduct, type ProductVariant, type InsertProductVariant,
         type ProductScheme, type InsertProductScheme, type Invoice, type InsertInvoice,
         type InvoiceLineItem, type InsertInvoiceLineItem } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Customers
  getCustomers(userId: string): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer & { userId: string }): Promise<Customer>;
  updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer | undefined>;

  // Products
  getProducts(userId: string): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct & { userId: string }): Promise<Product>;
  updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  deleteAllProducts(userId: string): Promise<boolean>;

  // Product Variants
  getProductVariants(productId: string): Promise<ProductVariant[]>;
  getVariant(id: string): Promise<ProductVariant | undefined>;
  createVariant(variant: InsertProductVariant): Promise<ProductVariant>;
  updateVariant(id: string, updates: Partial<ProductVariant>): Promise<ProductVariant | undefined>;

  // Product Schemes
  getProductSchemes(userId: string): Promise<ProductScheme[]>;
  getSchemeUsageCounts(userId: string): Promise<{ [key: string]: number }>;
  getScheme(id: string): Promise<ProductScheme | undefined>;
  createScheme(scheme: InsertProductScheme & { userId: string }): Promise<ProductScheme>;
  updateScheme(id: string, updates: Partial<ProductScheme>): Promise<ProductScheme | undefined>;
  deleteScheme(id: string): Promise<boolean>;

  // Invoices
  getInvoices(userId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice & { userId: string }): Promise<Invoice>;
  updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;

  // Invoice Line Items
  getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;
  createLineItem(lineItem: InsertInvoiceLineItem): Promise<InvoiceLineItem>;
  deleteLineItem(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private customers: Map<string, Customer> = new Map();
  private products: Map<string, Product> = new Map();
  private productVariants: Map<string, ProductVariant> = new Map();
  private productSchemes: Map<string, ProductScheme> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private invoiceLineItems: Map<string, InvoiceLineItem> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Create default user only
    const defaultUser: User = {
      id: "user-1",
      username: "demo",
      password: "password",
      email: "demo@example.com",
      quickbooksCompanyId: null,
      quickbooksAccessToken: null,
      quickbooksRefreshToken: null,
      quickbooksTokenExpiry: null,
      createdAt: new Date(),
    };
    this.users.set(defaultUser.id, defaultUser);

    // No demo data - start clean
    // Users can add their own customers, products, and schemes
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      quickbooksCompanyId: null,
      quickbooksAccessToken: null,
      quickbooksRefreshToken: null,
      quickbooksTokenExpiry: null,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    // Handle undefined values explicitly (for QuickBooks disconnection)
    const updatedUser = { ...user };
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        updatedUser[key as keyof User] = null as any;
      } else {
        updatedUser[key as keyof User] = value as any;
      }
    }
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Customers
  async getCustomers(userId: string): Promise<Customer[]> {
    return Array.from(this.customers.values()).filter(customer => customer.userId === userId);
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async createCustomer(customerData: InsertCustomer & { userId: string }): Promise<Customer> {
    const id = randomUUID();
    const customer: Customer = {
      name: customerData.name,
      email: customerData.email || null,
      phone: customerData.phone || null,
      address: customerData.address ? {
        street: customerData.address.street || undefined,
        city: customerData.address.city || undefined,
        state: customerData.address.state || undefined,
        zipCode: customerData.address.zipCode || undefined,
        country: customerData.address.country || undefined,
      } : null,
      userId: customerData.userId,
      id,
      quickbooksCustomerId: null,
      createdAt: new Date(),
    };
    this.customers.set(id, customer);
    return customer;
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    if (!customer) return undefined;
    const updatedCustomer = { ...customer, ...updates };
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  // Products
  async getProducts(userId: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(product => product.userId === userId);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(productData: InsertProduct & { userId: string }): Promise<Product> {
    const id = randomUUID();
    const product: Product = {
      name: productData.name,
      description: productData.description || null,
      basePrice: productData.basePrice,
      category: productData.category || null,
      itemCode: productData.itemCode || null,
      packingType: productData.packingType || null,
      grossWeightKgs: productData.grossWeightKgs || null,
      netWeightKgs: productData.netWeightKgs || null,
      userId: productData.userId,
      id,
      quickbooksItemId: null,
      createdAt: new Date(),
    };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    const updatedProduct = { ...product, ...updates };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(id: string): Promise<boolean> {
    return this.products.delete(id);
  }

  async deleteAllProducts(userId: string): Promise<boolean> {
    const userProducts = Array.from(this.products.values()).filter(product => product.userId === userId);
    for (const product of userProducts) {
      this.products.delete(product.id);
    }
    return true;
  }

  // Product Variants
  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    return Array.from(this.productVariants.values()).filter(variant => variant.productId === productId);
  }

  async getVariant(id: string): Promise<ProductVariant | undefined> {
    return this.productVariants.get(id);
  }

  async createVariant(variantData: InsertProductVariant): Promise<ProductVariant> {
    const id = randomUUID();
    const variant: ProductVariant = {
      productId: variantData.productId || null,
      name: variantData.name,
      sku: variantData.sku,
      price: variantData.price,
      stockQuantity: variantData.stockQuantity || null,
      lowStockThreshold: variantData.lowStockThreshold || null,
      attributes: variantData.attributes || null,
      id,
      createdAt: new Date(),
    };
    this.productVariants.set(id, variant);
    return variant;
  }

  async updateVariant(id: string, updates: Partial<ProductVariant>): Promise<ProductVariant | undefined> {
    const variant = this.productVariants.get(id);
    if (!variant) return undefined;
    const updatedVariant = { ...variant, ...updates };
    this.productVariants.set(id, updatedVariant);
    return updatedVariant;
  }

  // Product Schemes
  async getProductSchemes(userId: string): Promise<ProductScheme[]> {
    return Array.from(this.productSchemes.values()).filter(scheme => scheme.userId === userId);
  }

  async getSchemeUsageCounts(userId: string): Promise<{ [key: string]: number }> {
    const counts: { [key: string]: number } = {};
    const userInvoices = Array.from(this.invoices.values()).filter(inv => inv.userId === userId);
    
    for (const invoice of userInvoices) {
      const lineItems = Array.from(this.invoiceLineItems.values()).filter(item => 
        item.invoiceId === invoice.id && item.schemeId && item.isFreeFromScheme
      );
      
      lineItems.forEach(item => {
        if (item.schemeId) {
          counts[item.schemeId] = (counts[item.schemeId] || 0) + 1;
        }
      });
    }
    
    return counts;
  }

  async getScheme(id: string): Promise<ProductScheme | undefined> {
    return this.productSchemes.get(id);
  }

  async createScheme(schemeData: InsertProductScheme & { userId: string }): Promise<ProductScheme> {
    const id = randomUUID();
    const scheme: ProductScheme = {
      name: schemeData.name,
      description: schemeData.description || null,
      productId: schemeData.productId || null,
      buyQuantity: schemeData.buyQuantity,
      freeQuantity: schemeData.freeQuantity,
      isActive: schemeData.isActive !== undefined ? schemeData.isActive : true,
      userId: schemeData.userId,
      id,
      createdAt: new Date(),
    };
    this.productSchemes.set(id, scheme);
    return scheme;
  }

  async updateScheme(id: string, updates: Partial<ProductScheme>): Promise<ProductScheme | undefined> {
    const scheme = this.productSchemes.get(id);
    if (!scheme) return undefined;
    const updatedScheme = { ...scheme, ...updates };
    this.productSchemes.set(id, updatedScheme);
    return updatedScheme;
  }

  async deleteScheme(id: string): Promise<boolean> {
    return this.productSchemes.delete(id);
  }

  // Invoices
  async getInvoices(userId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(invoice => invoice.userId === userId);
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const invoice = this.invoices.get(id);
    if (!invoice) return undefined;
    
    // Include customer data in the invoice response
    const customer = invoice.customerId ? this.customers.get(invoice.customerId) : null;
    
    return {
      ...invoice,
      customer: customer || null
    } as any;
  }

  async createInvoice(invoiceData: InsertInvoice & { userId: string }): Promise<Invoice> {
    const id = randomUUID();
    const invoice: Invoice = {
      invoiceNumber: invoiceData.invoiceNumber,
      customerId: invoiceData.customerId || null,
      subtotal: invoiceData.subtotal,
      total: invoiceData.total,
      status: invoiceData.status || "draft",
      invoiceType: invoiceData.invoiceType || "receivable",
      invoiceDate: invoiceData.invoiceDate,
      dueDate: invoiceData.dueDate || null,
      userId: invoiceData.userId,
      id,
      quickbooksInvoiceId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.invoices.set(id, invoice);
    return invoice;
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice | undefined> {
    const invoice = this.invoices.get(id);
    if (!invoice) return undefined;
    const updatedInvoice = { ...invoice, ...updates, updatedAt: new Date() };
    this.invoices.set(id, updatedInvoice);
    return updatedInvoice;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    return this.invoices.delete(id);
  }

  // Invoice Line Items
  async getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
    return Array.from(this.invoiceLineItems.values()).filter(item => item.invoiceId === invoiceId);
  }

  async createLineItem(lineItemData: InsertInvoiceLineItem): Promise<InvoiceLineItem> {
    const id = randomUUID();
    const lineItem: InvoiceLineItem = {
      invoiceId: lineItemData.invoiceId || null,
      productId: lineItemData.productId || null,
      variantId: lineItemData.variantId || null,
      description: lineItemData.description,
      quantity: lineItemData.quantity,
      unitPrice: lineItemData.unitPrice,
      lineTotal: lineItemData.lineTotal,
      category: (lineItemData as any).category || null,
      isFreeFromScheme: lineItemData.isFreeFromScheme || null,
      schemeId: lineItemData.schemeId || null,
      id,
      createdAt: new Date(),
    };
    this.invoiceLineItems.set(id, lineItem);
    return lineItem;
  }

  async deleteLineItem(id: string): Promise<boolean> {
    return this.invoiceLineItems.delete(id);
  }
}

// Import the database storage implementation
import { DatabaseStorage } from "./databaseStorage";

export const storage = new DatabaseStorage();
