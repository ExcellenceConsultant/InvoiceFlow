import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { quickBooksService } from "./services/quickbooks";
import { insertCustomerSchema, insertProductSchema, insertProductVariantSchema, 
         insertProductSchemeSchema, insertInvoiceSchema, insertInvoiceLineItemSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // User routes
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Handle null values for QuickBooks disconnection by converting to undefined
      if (updateData.quickbooksAccessToken === null) {
        updateData.quickbooksAccessToken = undefined;
      }
      if (updateData.quickbooksRefreshToken === null) {
        updateData.quickbooksRefreshToken = undefined;
      }
      if (updateData.quickbooksCompanyId === null) {
        updateData.quickbooksCompanyId = undefined;
      }
      if (updateData.quickbooksTokenExpiry === null) {
        updateData.quickbooksTokenExpiry = undefined;
      }
      
      const user = await storage.updateUser(id, updateData);
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // QuickBooks OAuth routes
  app.get("/api/auth/quickbooks", async (req, res) => {
    try {
      const state = req.query.userId as string;
      if (!state) {
        return res.status(400).json({ message: "User ID required" });
      }

      const authUrl = quickBooksService.getAuthorizationUrl(state);
      res.json({ authUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate auth URL" });
    }
  });

  app.get("/api/auth/quickbooks/callback", async (req, res) => {
    try {
      const { code, realmId, state } = req.query;
      
      if (!code || !realmId || !state) {
        return res.redirect("/#/quickbooks-auth?error=missing_params");
      }

      const tokens = await quickBooksService.exchangeCodeForTokens(
        code as string,
        realmId as string
      );

      // Update user with QuickBooks tokens
      await storage.updateUser(state as string, {
        quickbooksCompanyId: tokens.companyId,
        quickbooksAccessToken: tokens.accessToken,
        quickbooksRefreshToken: tokens.refreshToken,
        quickbooksTokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
      });

      res.redirect("/#/quickbooks-auth?success=true");
    } catch (error) {
      console.error("QuickBooks callback error:", error);
      res.redirect("/#/quickbooks-auth?error=auth_failed");
    }
  });

  // Customer routes
  app.get("/api/customers", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }
      
      const customers = await storage.getCustomers(userId);
      res.json(customers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const validation = insertCustomerSchema.extend({
        userId: z.string(),
      }).safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid customer data", errors: validation.error.errors });
      }

      const customer = await storage.createCustomer(validation.data);
      res.json(customer);
    } catch (error) {
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  // Product routes
  app.get("/api/products", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }
      
      const products = await storage.getProducts(userId);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const validation = insertProductSchema.extend({
        userId: z.string(),
      }).safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid product data", errors: validation.error.errors });
      }

      const product = await storage.createProduct(validation.data);
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  // Product variant routes
  app.get("/api/products/:productId/variants", async (req, res) => {
    try {
      const variants = await storage.getProductVariants(req.params.productId);
      res.json(variants);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product variants" });
    }
  });

  app.post("/api/variants", async (req, res) => {
    try {
      const validation = insertProductVariantSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid variant data", errors: validation.error.errors });
      }

      const variant = await storage.createVariant(validation.data);
      res.json(variant);
    } catch (error) {
      res.status(500).json({ message: "Failed to create variant" });
    }
  });

  // Product scheme routes
  app.get("/api/schemes", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }
      
      const schemes = await storage.getProductSchemes(userId);
      res.json(schemes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schemes" });
    }
  });

  app.post("/api/schemes", async (req, res) => {
    try {
      const validation = insertProductSchemeSchema.extend({
        userId: z.string(),
      }).safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid scheme data", errors: validation.error.errors });
      }

      const scheme = await storage.createScheme(validation.data);
      res.json(scheme);
    } catch (error) {
      res.status(500).json({ message: "Failed to create scheme" });
    }
  });

  app.delete("/api/schemes/:id", async (req, res) => {
    try {
      const success = await storage.deleteScheme(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Scheme not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete scheme" });
    }
  });

  // Invoice routes
  app.get("/api/invoices", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }
      
      const invoices = await storage.getInvoices(userId);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const { invoice, lineItems } = req.body;
      
      const invoiceValidation = insertInvoiceSchema.extend({
        userId: z.string(),
      }).safeParse(invoice);
      
      if (!invoiceValidation.success) {
        return res.status(400).json({ message: "Invalid invoice data", errors: invoiceValidation.error.errors });
      }

      // Create invoice
      const createdInvoice = await storage.createInvoice(invoiceValidation.data);
      
      // Create line items with scheme application
      const createdLineItems = [];
      for (const item of lineItems) {
        const lineItemValidation = insertInvoiceLineItemSchema.safeParse({
          ...item,
          invoiceId: createdInvoice.id,
        });
        
        if (lineItemValidation.success) {
          const lineItem = await storage.createLineItem(lineItemValidation.data);
          createdLineItems.push(lineItem);
          
          // Check for applicable schemes
          if (item.productId) {
            const schemes = await storage.getProductSchemes(invoice.userId);
            const applicableScheme = schemes.find(
              scheme => scheme.productId === item.productId && 
                       scheme.isActive && 
                       item.quantity >= scheme.buyQuantity
            );
            
            if (applicableScheme) {
              const freeQuantity = Math.floor(item.quantity / applicableScheme.buyQuantity) * applicableScheme.freeQuantity;
              if (freeQuantity > 0) {
                const freeLineItem = await storage.createLineItem({
                  invoiceId: createdInvoice.id,
                  productId: item.productId,
                  variantId: item.variantId,
                  description: `${item.description} (Free from scheme)`,
                  quantity: freeQuantity,
                  unitPrice: "0.00",
                  lineTotal: "0.00",
                  isFreeFromScheme: true,
                  schemeId: applicableScheme.id,
                });
                createdLineItems.push(freeLineItem);
              }
            }
          }
        }
      }

      res.json({ invoice: createdInvoice, lineItems: createdLineItems });
    } catch (error) {
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.get("/api/invoices/:id/line-items", async (req, res) => {
    try {
      const lineItems = await storage.getInvoiceLineItems(req.params.id);
      res.json(lineItems);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch line items" });
    }
  });

  app.post("/api/customers/:id/sync-quickbooks", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const user = await storage.getUser(customer.userId!);
      if (!user || !user.quickbooksAccessToken || !user.quickbooksCompanyId) {
        return res.status(400).json({ message: "QuickBooks not connected" });
      }

      // Create unique name to avoid conflicts
      const timestamp = Date.now();
      const qbCustomerData = {
        Name: `${customer.name}_${timestamp}`,
      };

      const qbCustomer = await quickBooksService.createCustomer(
        user.quickbooksAccessToken,
        user.quickbooksCompanyId,
        qbCustomerData
      );

      // Update customer with QuickBooks ID
      await storage.updateCustomer(customer.id, {
        quickbooksCustomerId: qbCustomer.Id,
      });

      res.json({ success: true, quickbooksCustomerId: qbCustomer.Id });
    } catch (error: any) {
      console.error("QuickBooks customer sync error:", error.response?.data || error.message);
      console.error("Full error details:", JSON.stringify(error.response?.data, null, 2));
      const errorMessage = error.response?.data?.Fault?.Error?.[0]?.Detail || error.response?.data?.Fault?.Error?.[0]?.code || "Failed to sync customer with QuickBooks";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.post("/api/products/:id/sync-quickbooks", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const user = await storage.getUser(product.userId!);
      if (!user || !user.quickbooksAccessToken || !user.quickbooksCompanyId) {
        return res.status(400).json({ message: "QuickBooks not connected" });
      }

      // Create unique name to avoid conflicts
      const timestamp = Date.now();
      const qbItemData = {
        Name: `${product.name}_${timestamp}`,
        Type: "Service",
      };

      const qbItem = await quickBooksService.createItem(
        user.quickbooksAccessToken,
        user.quickbooksCompanyId,
        qbItemData
      );

      // Update product with QuickBooks ID
      await storage.updateProduct(product.id, {
        quickbooksItemId: qbItem.Id,
      });

      res.json({ success: true, quickbooksItemId: qbItem.Id });
    } catch (error: any) {
      console.error("QuickBooks product sync error:", error.response?.data || error.message);
      const errorMessage = error.response?.data?.Fault?.Error?.[0]?.Detail || "Failed to sync product with QuickBooks";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.post("/api/invoices/:id/sync-quickbooks", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const user = await storage.getUser(invoice.userId!);
      if (!user || !user.quickbooksAccessToken || !user.quickbooksCompanyId) {
        return res.status(400).json({ message: "QuickBooks not connected" });
      }

      // Get customer for reference only (not required to be synced)
      const customer = await storage.getCustomer(invoice.customerId!);
      const customerName = customer?.name || "Unknown Customer";

      // Get total invoice amount
      const totalAmount = parseFloat(invoice.total);

      // Use the correct account IDs from your QuickBooks sandbox
      const AR_ACCOUNT_ID = "1150040004";  // Accounts Receivable
      const SALES_ACCOUNT_ID = "135";      // Income/Sales

      // Create journal entry for the invoice
      // Debit Accounts Receivable, Credit Sales Revenue
      const journalEntryData = {
        TxnDate: invoice.invoiceDate.toISOString().split('T')[0],
        PrivateNote: `Invoice ${invoice.invoiceNumber} - ${customerName}`,
        Line: [
          {
            Description: `Invoice ${invoice.invoiceNumber} - Accounts Receivable`,
            Amount: totalAmount,
            DetailType: "JournalEntryLineDetail",
            JournalEntryLineDetail: {
              PostingType: "Debit",
              AccountRef: { value: AR_ACCOUNT_ID }
            }
          },
          {
            Description: `Invoice ${invoice.invoiceNumber} - Sales Revenue`,
            Amount: totalAmount,
            DetailType: "JournalEntryLineDetail",
            JournalEntryLineDetail: {
              PostingType: "Credit",
              AccountRef: { value: SALES_ACCOUNT_ID }
            }
          }
        ]
      };

      const qbJournalEntry = await quickBooksService.createJournalEntry(
        user.quickbooksAccessToken,
        user.quickbooksCompanyId,
        journalEntryData
      );

      // Update invoice with QuickBooks journal entry ID
      await storage.updateInvoice(invoice.id, {
        quickbooksInvoiceId: qbJournalEntry.Id || qbJournalEntry.JournalEntry?.Id,
        status: "sent",
      });

      res.json({ 
        success: true, 
        quickbooksJournalId: qbJournalEntry.Id || qbJournalEntry.JournalEntry?.Id,
        message: "Invoice synced as journal entry to QuickBooks"
      });
    } catch (error: any) {
      console.error("QuickBooks journal entry sync error:", error.response?.data || error.message);
      console.error("Full error details:", JSON.stringify(error.response?.data, null, 2));
      
      // Extract detailed error information
      let errorMessage = "Failed to sync invoice to QuickBooks";
      if (error.response?.data?.Fault?.Error?.[0]) {
        const qbError = error.response.data.Fault.Error[0];
        errorMessage = qbError.Detail || qbError.code || errorMessage;
        console.error("QuickBooks Error Code:", qbError.code);
        console.error("QuickBooks Error Detail:", qbError.Detail);
      }
      
      res.status(500).json({ 
        message: errorMessage,
        details: error.response?.data?.Fault?.Error?.[0] || null
      });
    }
  });

  // Debug endpoint to list QuickBooks accounts
  app.get("/api/quickbooks/accounts", async (req, res) => {
    try {
      const user = await storage.getUser("user-1");
      if (!user || !user.quickbooksAccessToken || !user.quickbooksCompanyId) {
        return res.status(400).json({ message: "QuickBooks not connected" });
      }

      const accounts = await quickBooksService.getAccounts(
        user.quickbooksAccessToken,
        user.quickbooksCompanyId
      );

      // Format accounts for easy reading
      const formattedAccounts = accounts.map((acc: any) => ({
        id: acc.Id,
        name: acc.Name,
        type: acc.AccountType,
        subType: acc.AccountSubType || 'N/A',
        active: acc.Active
      }));

      res.json({
        totalAccounts: formattedAccounts.length,
        accounts: formattedAccounts
      });
    } catch (error: any) {
      console.error("Error fetching QuickBooks accounts:", error);
      res.status(500).json({ message: "Failed to fetch QuickBooks accounts" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const invoices = await storage.getInvoices(userId);
      const products = await storage.getProducts(userId);
      const schemes = await storage.getProductSchemes(userId);
      
      // Calculate total revenue
      const totalRevenue = invoices.reduce((sum, invoice) => 
        sum + parseFloat(invoice.total), 0
      );

      // Count active invoices
      const activeInvoices = invoices.filter(invoice => 
        invoice.status === "sent" || invoice.status === "draft"
      ).length;

      // Count products in stock
      let totalStock = 0;
      let lowStockCount = 0;
      
      for (const product of products) {
        const variants = await storage.getProductVariants(product.id);
        for (const variant of variants) {
          totalStock += variant.stockQuantity || 0;
          if ((variant.stockQuantity || 0) <= (variant.lowStockThreshold || 10)) {
            lowStockCount++;
          }
        }
      }

      // Count active schemes
      const activeSchemes = schemes.filter(scheme => scheme.isActive).length;

      res.json({
        totalRevenue: totalRevenue.toFixed(2),
        activeInvoices,
        productsInStock: totalStock,
        lowStockCount,
        activeSchemes,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
