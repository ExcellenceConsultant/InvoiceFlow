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
      console.log("Creating product with data:", req.body);
      
      const validation = insertProductSchema.extend({
        userId: z.string(),
      }).safeParse(req.body);
      
      if (!validation.success) {
        console.error("Product validation failed:", validation.error.errors);
        return res.status(400).json({ message: "Invalid product data", errors: validation.error.errors });
      }

      const product = await storage.createProduct(validation.data);
      console.log("Product created successfully:", product.id, product.name);
      res.json(product);
    } catch (error) {
      console.error("Product creation error:", error);
      const err = error as any;
      res.status(500).json({ message: "Failed to create product", error: err.message });
    }
  });

  app.delete("/api/products", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }
      
      const success = await storage.deleteAllProducts(userId);
      res.json({ success: true, message: "All products deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete all products" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const success = await storage.deleteProduct(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete product" });
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
      const usageCounts = await storage.getSchemeUsageCounts(userId);
      
      const schemesWithCounts = schemes.map(scheme => ({
        ...scheme,
        usageCount: usageCounts[scheme.id] || 0
      }));
      
      res.json(schemesWithCounts);
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
      console.log("Creating invoice with data:", JSON.stringify(req.body, null, 2));
      const { invoice, lineItems } = req.body;
      
      if (!invoice || !lineItems) {
        console.error("Missing invoice or lineItems in request body");
        return res.status(400).json({ message: "Invoice and line items are required" });
      }
      
      const invoiceValidation = insertInvoiceSchema.extend({
        userId: z.string(),
      }).safeParse(invoice);
      
      if (!invoiceValidation.success) {
        console.error("Invoice validation failed:", invoiceValidation.error.errors);
        return res.status(400).json({ message: "Invalid invoice data", errors: invoiceValidation.error.errors });
      }

      // Create invoice
      const createdInvoice = await storage.createInvoice(invoiceValidation.data);
      
      // Create line items with scheme application
      const createdLineItems = [];
      const hasFrontendFreeItems = lineItems.some(li => li.isFreeFromScheme);
      
      for (const item of lineItems) {
        // Skip line items with empty productId
        if (!item.productId || item.productId.trim() === '') {
          console.log('Skipping line item with empty productId:', item);
          continue;
        }

        const lineItemValidation = insertInvoiceLineItemSchema.safeParse({
          ...item,
          invoiceId: createdInvoice.id,
        });
        
        if (lineItemValidation.success) {
          const lineItem = await storage.createLineItem(lineItemValidation.data);
          createdLineItems.push(lineItem);
          
          // Check for applicable schemes only if no frontend free items exist
          if (item.productId && !hasFrontendFreeItems) {
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
                  description: `${item.description} & ${applicableScheme.name}`,
                  quantity: freeQuantity,
                  unitPrice: "0.00",
                  lineTotal: "0.00",
                  isFreeFromScheme: true,
                  schemeId: applicableScheme.id,
                  category: item.category,
                });
                createdLineItems.push(freeLineItem);
              }
            }
          }
        } else {
          console.error("Line item validation failed:", lineItemValidation.error.errors, "for item:", item);
        }
      }

      res.json({ invoice: createdInvoice, lineItems: createdLineItems });
    } catch (error) {
      console.error("Invoice creation error:", error);
      const err = error as any;
      res.status(500).json({ message: "Failed to create invoice", error: err.message });
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

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const success = await storage.deleteInvoice(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  app.post("/api/customers/:id/sync-quickbooks", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      let user = await storage.getUser(customer.userId!);
      if (!user || !user.quickbooksAccessToken || !user.quickbooksCompanyId) {
        return res.status(400).json({ message: "QuickBooks not connected" });
      }

      // Ensure tokens are valid and refresh if needed
      user = await ensureValidTokens(user);

      // Step 1: Try to find existing customer by DisplayName
      console.log(`Attempting to sync customer: "${customer.name}"`);
      
      let qbCustomer;
      try {
        qbCustomer = await quickBooksService.findCustomerByDisplayName(
          user!.quickbooksAccessToken!,
          user!.quickbooksCompanyId!,
          customer.name
        );
        
        if (qbCustomer) {
          console.log(`Found existing customer in QuickBooks:`, {
            Id: qbCustomer.Id,
            DisplayName: qbCustomer.DisplayName,
            Name: qbCustomer.Name
          });
        }
      } catch (lookupError: any) {
        console.error("Customer lookup failed:", lookupError.response?.data || lookupError.message);
        console.error("Lookup error details:", JSON.stringify(lookupError.response?.data, null, 2));
        // Continue to creation if lookup fails
        qbCustomer = null;
      }

      // Step 2: If customer doesn't exist, create it
      if (!qbCustomer) {
        console.log(`Customer "${customer.name}" not found in QuickBooks. Creating new customer...`);
        
        const qbCustomerData = {
          Name: customer.name,
          DisplayName: customer.name,
        };

        try {
          qbCustomer = await quickBooksService.createCustomer(
            user!.quickbooksAccessToken!,
            user!.quickbooksCompanyId!,
            qbCustomerData
          );
          
          console.log(`Successfully created new customer in QuickBooks:`, {
            Id: qbCustomer.Id,
            DisplayName: qbCustomer.DisplayName,
            Name: qbCustomer.Name
          });
        } catch (createError: any) {
          console.error("Customer creation failed:", createError.response?.data || createError.message);
          console.error("Creation error details:", JSON.stringify(createError.response?.data, null, 2));
          const errorMessage = createError.response?.data?.Fault?.Error?.[0]?.Detail || 
                              createError.response?.data?.Fault?.Error?.[0]?.code || 
                              "Failed to create customer in QuickBooks";
          return res.status(500).json({ message: errorMessage, action: 'create' });
        }
      }

      // Step 3: Update local customer record with QuickBooks ID
      await storage.updateCustomer(customer.id, {
        quickbooksCustomerId: qbCustomer.Id,
      });

      res.json({ 
        success: true, 
        quickbooksCustomerId: qbCustomer.Id,
        action: qbCustomer.Name === customer.name ? 'found' : 'created',
        displayName: qbCustomer.DisplayName
      });
    } catch (error: unknown) {
      const err = error as any;
      console.error("QuickBooks customer sync error:", err.response?.data || err.message);
      console.error("Full error details:", JSON.stringify(err.response?.data, null, 2));
      const errorMessage = err.response?.data?.Fault?.Error?.[0]?.Detail || 
                          err.response?.data?.Fault?.Error?.[0]?.code || 
                          "Failed to sync customer with QuickBooks";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.post("/api/products/:id/sync-quickbooks", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      let user = await storage.getUser(product.userId!);
      if (!user || !user.quickbooksAccessToken || !user.quickbooksCompanyId) {
        return res.status(400).json({ message: "QuickBooks not connected" });
      }

      // Ensure tokens are valid and refresh if needed
      user = await ensureValidTokens(user);

      // Create unique name to avoid conflicts
      const timestamp = Date.now();
      const qbItemData = {
        Name: `${product.name}_${timestamp}`,
        Type: "Service",
      };

      const qbItem = await quickBooksService.createItem(
        user!.quickbooksAccessToken!,
        user!.quickbooksCompanyId!,
        qbItemData
      );

      // Update product with QuickBooks ID
      await storage.updateProduct(product.id, {
        quickbooksItemId: qbItem.Id,
      });

      res.json({ success: true, quickbooksItemId: qbItem.Id });
    } catch (error: unknown) {
      const err = error as any;
      console.error("QuickBooks product sync error:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.Fault?.Error?.[0]?.Detail || "Failed to sync product with QuickBooks";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Helper function to ensure valid QuickBooks tokens
  async function ensureValidTokens(user: any) {
    if (!user.quickbooksRefreshToken) {
      throw new Error("No refresh token available. Please reconnect to QuickBooks.");
    }

    // Check if token is expired (expires in 1 hour, refresh if less than 5 minutes left)
    const tokenExpiry = user.quickbooksTokenExpiry ? new Date(user.quickbooksTokenExpiry) : new Date(0);
    const now = new Date();
    const timeUntilExpiry = tokenExpiry.getTime() - now.getTime();
    const fiveMinutes = 5 * 60 * 1000;

    if (timeUntilExpiry < fiveMinutes) {
      console.log('QuickBooks token expired or expiring soon, refreshing...');
      try {
        const refreshedTokens = await quickBooksService.refreshAccessToken(user.quickbooksRefreshToken);
        
        // Update user with new tokens
        const expiryTime = new Date(now.getTime() + (3600 * 1000)); // 1 hour from now
        await storage.updateUser(user.id, {
          quickbooksAccessToken: refreshedTokens.accessToken,
          quickbooksRefreshToken: refreshedTokens.refreshToken,
          quickbooksTokenExpiry: expiryTime,
        });

        console.log('QuickBooks tokens refreshed successfully');
        return {
          ...user,
          quickbooksAccessToken: refreshedTokens.accessToken,
          quickbooksRefreshToken: refreshedTokens.refreshToken,
          quickbooksTokenExpiry: expiryTime,
        };
      } catch (tokenError) {
        console.error('Failed to refresh QuickBooks tokens:', tokenError);
        throw new Error("QuickBooks token refresh failed. Please reconnect to QuickBooks.");
      }
    }

    return user;
  }

  app.post("/api/invoices/:id/sync-quickbooks", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      let user = await storage.getUser(invoice.userId!);
      if (!user || !user.quickbooksAccessToken || !user.quickbooksCompanyId) {
        return res.status(400).json({ message: "QuickBooks not connected" });
      }

      // Ensure tokens are valid and refresh if needed
      user = await ensureValidTokens(user);

      // Check invoice type to determine if it's AR or AP
      const invoiceType = (invoice as any).invoiceType || 'receivable'; // Default to receivable for backward compatibility
      console.log(`Syncing ${invoiceType} invoice ${invoice.invoiceNumber}`);

      if (invoiceType === 'receivable') {
        // Handle Accounts Receivable (AR) Invoice
        return await handleARInvoiceSync(invoice, user, storage, res);
      } else if (invoiceType === 'payable') {
        // Handle Accounts Payable (AP) Invoice (Bill)
        return await handleAPInvoiceSync(invoice, user, storage, res);
      } else {
        return res.status(400).json({ message: "Invalid invoice type. Must be 'receivable' or 'payable'" });
      }

    } catch (error: unknown) {
      const err = error as any;
      console.error("QuickBooks invoice sync error:", err.response?.data || err.message);
      console.error("Full error details:", JSON.stringify(err.response?.data, null, 2));
      
      // Extract detailed error information
      let errorMessage = "Failed to sync invoice to QuickBooks";
      let fullErrorDetails = null;
      
      if (err.response?.data?.Fault?.Error?.[0]) {
        const qbError = err.response.data.Fault.Error[0];
        
        errorMessage = qbError.Detail || qbError.code || errorMessage;
        fullErrorDetails = {
          code: qbError.code,
          detail: qbError.Detail,
          element: qbError.element || null
        };
        
        console.error("QuickBooks Error Code:", qbError.code);
        console.error("QuickBooks Error Detail:", qbError.Detail);
      }
      
      res.status(500).json({ 
        message: errorMessage,
        errorDetails: fullErrorDetails
      });
    }
  });

  // Helper function to handle AR invoice sync - Creates Journal Entry instead of Invoice
  async function handleARInvoiceSync(invoice: any, user: any, storage: any, res: any) {
    console.log(`Creating QuickBooks Journal Entry for AR invoice ${invoice.invoiceNumber}`);

    // Find or create customer in QuickBooks
    const customer = await storage.getCustomer(invoice.customerId!);
    if (!customer) {
      return res.status(400).json({ message: "Customer not found for this AR invoice" });
    }

    const qbCustomer = await findOrCreateCustomer(user, customer.name, customer.id, storage);

    // Get invoice line items to calculate total
    const lineItems = await storage.getInvoiceLineItems(invoice.id);
    
    console.log('Invoice data:', { id: invoice.id, total: invoice.total, invoiceNumber: invoice.invoiceNumber });
    console.log('Line items for amount calculation:', lineItems);
    
    // Calculate total from invoice total first, then fallback to line items
    let totalAmount = parseFloat(invoice.total) || 0;
    
    // If invoice total is 0, calculate from line items
    if (totalAmount === 0) {
      totalAmount = lineItems.reduce((sum: number, item: any) => {
        const itemTotal = parseFloat(item.lineTotal) || 0;
        console.log(`Line item ${item.description}: ${itemTotal}`);
        return sum + itemTotal;
      }, 0);
    }
    
    console.log('Final calculated total amount:', totalAmount);
    
    // Ensure we have a valid amount
    if (totalAmount === 0) {
      throw new Error('Invoice total amount is 0. Cannot create journal entry.');
    }
    
    // Create Journal Entry data with correct QuickBooks API format
    const journalEntryData = {
      TxnDate: invoice.invoiceDate.toISOString().split('T')[0],
      PrivateNote: `JE for Invoice #${invoice.invoiceNumber}`,
      Line: [
        // Debit Accounts Receivable
        {
          Id: "0",
          Description: "AR entry for Invoice",
          Amount: totalAmount,
          DetailType: "JournalEntryLineDetail",
          JournalEntryLineDetail: {
            PostingType: "Debit",
            AccountRef: {
              value: "1150040004",
              name: "Accounts Receivable (A/R)"
            },
            Entity: {
              Type: "Customer",
              EntityRef: {
                value: qbCustomer.Id,
                name: qbCustomer.DisplayName
              }
            }
          }
        },
        // Credit Sales
        {
          Id: "1", 
          Description: "Sales entry for Invoice",
          Amount: totalAmount,
          DetailType: "JournalEntryLineDetail",
          JournalEntryLineDetail: {
            PostingType: "Credit",
            AccountRef: {
              value: "135",
              name: "Sales of Product Income"
            }
          }
        }
      ]
    };

    console.log('Creating QuickBooks Journal Entry with data:', JSON.stringify(journalEntryData, null, 2));

    const qbJournalEntry = await quickBooksService.createJournalEntry(
      user!.quickbooksAccessToken!,
      user!.quickbooksCompanyId!,
      journalEntryData
    );

    // Update invoice with QuickBooks journal entry ID
    await storage.updateInvoice(invoice.id, {
      quickbooksInvoiceId: qbJournalEntry.Id,
      status: "sent",
    });

    return res.json({ 
      success: true, 
      quickbooksJournalEntryId: qbJournalEntry.Id,
      customerId: qbCustomer.Id,
      customerName: qbCustomer.DisplayName,
      invoiceType: 'receivable',
      totalAmount: totalAmount,
      debitAccount: "1150040004 - Accounts Receivable (A/R)",
      creditAccount: "135 - Sales", 
      message: "Journal Entry successfully created in QuickBooks"
    });
  }

  // Helper function to handle AP invoice sync
  async function handleAPInvoiceSync(invoice: any, user: any, storage: any, res: any) {
    // For AP invoices, we treat the "customer" as a vendor
    const vendor = await storage.getCustomer(invoice.customerId!);
    if (!vendor) {
      return res.status(400).json({ message: "Vendor not found for this AP invoice" });
    }

    console.log(`Syncing AP invoice ${invoice.invoiceNumber} for vendor: "${vendor.name}"`);

    // Step 2: Ensure vendor exists in QuickBooks and get Vendor ID
    let qbVendor = await findOrCreateVendor(user, vendor.name);

    // Step 3: Get invoice line items
    const lineItems = await storage.getInvoiceLineItems(invoice.id);
    
    // Step 4: Create QuickBooks AP bill
    const billData = {
      VendorRef: { 
        value: qbVendor.Id, 
        name: qbVendor.DisplayName 
      },
      TxnDate: invoice.invoiceDate.toISOString().split('T')[0],
      DueDate: invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : undefined,
      DocNumber: invoice.invoiceNumber,
      PrivateNote: `AP Bill ${invoice.invoiceNumber} from ${vendor.name}`,
      Line: []
    };

    // Add line items to the bill (expense lines)
    const EXPENSES_ACCOUNT_ID = "80"; // Typical expense account ID
    for (const lineItem of lineItems) {
      const lineData = {
        Amount: parseFloat(lineItem.lineTotal),
        DetailType: "AccountBasedExpenseLineDetail",
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: EXPENSES_ACCOUNT_ID, name: "Expenses" },
          BillableStatus: "NotBillable",
          Description: lineItem.description
        }
      };
      (billData.Line as any[]).push(lineData);
    }

    const qbBill = await quickBooksService.createBill(
      user.quickbooksAccessToken,
      user.quickbooksCompanyId,
      billData
    );

    // Update invoice with QuickBooks bill ID
    await storage.updateInvoice(invoice.id, {
      quickbooksInvoiceId: qbBill.Id,
      status: "sent",
    });

    return res.json({ 
      success: true, 
      quickbooksBillId: qbBill.Id,
      vendorId: qbVendor.Id,
      vendorName: qbVendor.DisplayName,
      invoiceType: 'payable',
      message: "AP Bill successfully synced to QuickBooks"
    });
  }

  // Helper function to find or create customer
  async function findOrCreateCustomer(user: any, customerName: string, customerId: string, storage: any) {
    let qbCustomer;
    try {
      qbCustomer = await quickBooksService.findCustomerByDisplayName(
        user.quickbooksAccessToken,
        user.quickbooksCompanyId,
        customerName
      );
      
      if (qbCustomer) {
        console.log(`Found existing customer in QuickBooks:`, {
          Id: qbCustomer.Id,
          DisplayName: qbCustomer.DisplayName
        });
        return qbCustomer;
      }
    } catch (lookupError: any) {
      console.error("Customer lookup failed:", lookupError.response?.data || lookupError.message);
    }

    // Create customer if not found
    console.log(`Creating customer "${customerName}" in QuickBooks...`);
    const qbCustomerData = {
      Name: customerName,
      DisplayName: customerName,
    };

    qbCustomer = await quickBooksService.createCustomer(
      user.quickbooksAccessToken,
      user.quickbooksCompanyId,
      qbCustomerData
    );
    
    // Update local customer record with QuickBooks ID
    await storage.updateCustomer(customerId, {
      quickbooksCustomerId: qbCustomer.Id,
    });

    return qbCustomer;
  }

  // Helper function to find or create vendor
  async function findOrCreateVendor(user: any, vendorName: string) {
    let qbVendor;
    try {
      qbVendor = await quickBooksService.findVendorByDisplayName(
        user.quickbooksAccessToken,
        user.quickbooksCompanyId,
        vendorName
      );
      
      if (qbVendor) {
        console.log(`Found existing vendor in QuickBooks:`, {
          Id: qbVendor.Id,
          DisplayName: qbVendor.DisplayName
        });
        return qbVendor;
      }
    } catch (lookupError: any) {
      console.error("Vendor lookup failed:", lookupError.response?.data || lookupError.message);
    }

    // Create vendor if not found
    console.log(`Creating vendor "${vendorName}" in QuickBooks...`);
    const qbVendorData = {
      Name: vendorName,
      DisplayName: vendorName,
    };

    qbVendor = await quickBooksService.createVendor(
      user.quickbooksAccessToken,
      user.quickbooksCompanyId,
      qbVendorData
    );

    return qbVendor;
  }

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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
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
