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
      
      // Handle QuickBooks disconnection by keeping null values (don't convert to undefined)
      // This ensures the database fields are properly set to null for disconnection
      
      const user = await storage.updateUser(id, updateData);
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // NEW UNCACHED QuickBooks OAuth endpoint - BYPASSES INFRASTRUCTURE CACHING
  app.get("/api/oauth/quickbooks-connect", async (req, res) => {
    try {
      // Add cache control headers to prevent caching
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      const state = req.query.userId as string;
      const timestamp = Date.now();
      const authUrl = quickBooksService.getAuthUrl(state, timestamp);
      
      console.log(`Generated auth URL with timestamp ${timestamp}:`, authUrl);
      
      res.json({ authUrl });
    } catch (error) {
      console.error("Error creating QuickBooks auth URL:", error);
      res.status(500).json({ message: "Failed to create auth URL" });
    }
  });

  // QuickBooks OAuth callback
  app.get("/api/auth/quickbooks/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        console.error("OAuth error:", error);
        return res.redirect(`/?error=${encodeURIComponent(error as string)}`);
      }

      if (!code || !state) {
        console.error("Missing code or state in callback");
        return res.redirect("/?error=missing_params");
      }

      console.log("QuickBooks callback received:", { code, state });

      // Exchange code for tokens
      const tokens = await quickBooksService.exchangeCodeForTokens(code as string);
      console.log("Token exchange successful, company ID:", tokens.realmId);

      // Update user with QuickBooks info
      await storage.updateUser(state as string, {
        quickbooksAccessToken: tokens.access_token,
        quickbooksRefreshToken: tokens.refresh_token,
        quickbooksCompanyId: tokens.realmId,
      });

      console.log(`User ${state} connected to QuickBooks company ${tokens.realmId}`);

      // Redirect to success page
      res.redirect("/?quickbooks=connected");
    } catch (error) {
      console.error("Error in QuickBooks callback:", error);
      res.redirect("/?error=callback_failed");
    }
  });

  // QuickBooks disconnect endpoint
  app.post("/api/auth/quickbooks/disconnect", async (req, res) => {
    try {
      const { userId } = req.body;
      
      console.log(`Disconnecting QuickBooks for user: ${userId}`);
      
      // Update user to remove QuickBooks connection
      await storage.updateUser(userId, {
        quickbooksAccessToken: null,
        quickbooksRefreshToken: null, 
        quickbooksCompanyId: null,
      });

      console.log(`QuickBooks disconnected for user: ${userId}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting QuickBooks:", error);
      res.status(500).json({ message: "Failed to disconnect QuickBooks" });
    }
  });

  // Helper function to find or create a customer in QuickBooks
  async function findOrCreateCustomer(user: any, customerName: string, localCustomerId: string, storage: any) {
    console.log(`Finding or creating customer: ${customerName}`);
    
    // Try to find existing customer in QuickBooks
    const existingCustomer = await quickBooksService.findCustomerByName(
      user.quickbooksAccessToken,
      user.quickbooksCompanyId,
      customerName
    );

    if (existingCustomer) {
      console.log(`Found existing QuickBooks customer: ${existingCustomer.DisplayName} (ID: ${existingCustomer.Id})`);
      return existingCustomer;
    }

    // Customer doesn't exist, create new one
    console.log(`Creating new QuickBooks customer: ${customerName}`);
    
    // Get local customer data for address info
    const localCustomer = await storage.getCustomer(localCustomerId);
    
    const customerData = {
      Name: customerName,
      DisplayName: customerName,
      ...(localCustomer?.address && {
        BillAddr: {
          Line1: localCustomer.address.street || '',
          City: localCustomer.address.city || '',
          CountrySubDivisionCode: localCustomer.address.state || '',
          PostalCode: localCustomer.address.zipCode || '',
          Country: localCustomer.address.country || 'USA'
        }
      })
    };

    const newCustomer = await quickBooksService.createCustomer(
      user.quickbooksAccessToken,
      user.quickbooksCompanyId,
      customerData
    );

    console.log(`Created QuickBooks customer: ${newCustomer.DisplayName} (ID: ${newCustomer.Id})`);
    return newCustomer;
  }

  // Helper function to find or create a vendor in QuickBooks
  async function findOrCreateVendor(user: any, vendorName: string, localVendorId: string, storage: any) {
    console.log(`Finding or creating vendor: ${vendorName}`);
    
    // Try to find existing vendor in QuickBooks
    const existingVendor = await quickBooksService.findVendorByName(
      user.quickbooksAccessToken,
      user.quickbooksCompanyId,
      vendorName
    );

    if (existingVendor) {
      console.log(`Found existing QuickBooks vendor: ${existingVendor.DisplayName} (ID: ${existingVendor.Id})`);
      return existingVendor;
    }

    // Vendor doesn't exist, create new one
    console.log(`Creating new QuickBooks vendor: ${vendorName}`);
    
    // Get local vendor data for address info
    const localVendor = await storage.getCustomer(localVendorId); // Using customer table for vendors
    
    const vendorData = {
      DisplayName: vendorName,
      ...(localVendor?.address && {
        BillAddr: {
          Line1: localVendor.address.street || '',
          City: localVendor.address.city || '',
          CountrySubDivisionCode: localVendor.address.state || '',
          PostalCode: localVendor.address.zipCode || '',
          Country: localVendor.address.country || 'USA'
        }
      })
    };

    const newVendor = await quickBooksService.createVendor(
      user.quickbooksAccessToken,
      user.quickbooksCompanyId,
      vendorData
    );

    console.log(`Created QuickBooks vendor: ${newVendor.DisplayName} (ID: ${newVendor.Id})`);
    return newVendor;
  }

  // Helper function to handle AP invoice sync (Payable invoices create journal entries)
  async function handleAPInvoiceSync(invoice: any, user: any, storage: any, res: any) {
    console.log(`Creating QuickBooks Journal Entry for AP invoice ${invoice.invoiceNumber}`);

    // Find or create vendor in QuickBooks (AP invoices have vendors, not customers)
    const vendor = await storage.getCustomer(invoice.customerId!); // Using customer table for vendors
    if (!vendor) {
      return res.status(400).json({ message: "Vendor not found for this AP invoice" });
    }

    const qbVendor = await findOrCreateVendor(user, vendor.name, vendor.id, storage);

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
      PrivateNote: `JE for AP Invoice #${invoice.invoiceNumber}`,
      Line: [
        // Debit Cost of Goods Sold
        {
          Id: "0",
          Description: "COGS entry for AP Invoice",
          Amount: totalAmount,
          DetailType: "JournalEntryLineDetail",
          JournalEntryLineDetail: {
            PostingType: "Debit",
            AccountRef: {
              value: "173",
              name: "Cost of Goods Sold"
            }
          }
        },
        // Credit Accounts Payable
        {
          Id: "1", 
          Description: "AP entry for Invoice",
          Amount: totalAmount,
          DetailType: "JournalEntryLineDetail",
          JournalEntryLineDetail: {
            PostingType: "Credit",
            AccountRef: {
              value: "1150040005",
              name: "Accounts Payable (A/P)"
            },
            Entity: {
              Type: "Vendor",
              EntityRef: {
                value: qbVendor.Id,
                name: qbVendor.DisplayName
              }
            }
          }
        }
      ]
    };

    console.log('Creating AP QuickBooks Journal Entry with data:', JSON.stringify(journalEntryData, null, 2));

    // Call QuickBooks API to create journal entry
    const qbJournalEntry = await quickBooksService.createJournalEntry(
      user.quickbooksAccessToken!,
      user.quickbooksCompanyId!,
      journalEntryData
    );

    // Update invoice with QuickBooks Journal Entry ID
    await storage.updateInvoice(invoice.id, {
      quickbooksInvoiceId: qbJournalEntry.Id,
    });

    return res.json({
      success: true,
      quickbooksInvoiceId: qbJournalEntry.Id,
      invoiceType: 'payable',
      totalAmount: totalAmount,
      debitAccount: "173 - Cost of Goods Sold",
      creditAccount: "1150040005 - Accounts Payable (A/P)", 
      message: "AP Journal Entry successfully created in QuickBooks"
    });
  }

  // Helper function to handle AR invoice sync (Receivable invoices create journal entries)
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
              name: "Sales"
            }
          }
        }
      ]
    };

    console.log('Creating AR QuickBooks Journal Entry with data:', JSON.stringify(journalEntryData, null, 2));

    // Call QuickBooks API to create journal entry
    const qbJournalEntry = await quickBooksService.createJournalEntry(
      user.quickbooksAccessToken!,
      user.quickbooksCompanyId!,
      journalEntryData
    );

    // Update invoice with QuickBooks Journal Entry ID
    await storage.updateInvoice(invoice.id, {
      quickbooksInvoiceId: qbJournalEntry.Id,
    });

    return res.json({
      success: true,
      quickbooksInvoiceId: qbJournalEntry.Id,
      invoiceType: 'receivable',
      totalAmount: totalAmount,
      debitAccount: "1150040004 - Accounts Receivable (A/R)",
      creditAccount: "135 - Sales", 
      message: "Journal Entry successfully created in QuickBooks"
    });
  }

  // Sync invoice to QuickBooks (creates journal entries based on invoice type)
  app.post("/api/invoices/:id/sync-quickbooks", async (req, res) => {
    try {
      const user = await storage.getUser("user-1");
      if (!user || !user.quickbooksAccessToken || !user.quickbooksCompanyId) {
        return res.status(400).json({ message: "QuickBooks not connected" });
      }

      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Check if already synced
      if (invoice.quickbooksInvoiceId) {
        return res.json({
          success: true,
          quickbooksInvoiceId: invoice.quickbooksInvoiceId,
          message: "Invoice already synced to QuickBooks"
        });
      }

      // Handle based on invoice type
      if (invoice.invoiceType === 'payable') {
        return await handleAPInvoiceSync(invoice, user, storage, res);
      } else if (invoice.invoiceType === 'receivable') {
        return await handleARInvoiceSync(invoice, user, storage, res);
      } else {
        return res.status(400).json({ message: "Invalid invoice type" });
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Error syncing invoice to QuickBooks:", error);
      
      // Provide detailed error information for debugging
      if (error instanceof Error && error.message.includes('account')) {
        res.status(500).json({ 
          message: "QuickBooks account configuration error", 
          error: errorMessage,
          errorDetails: {
            code: "ACCOUNT_ERROR",
            detail: errorMessage,
            accountIds: {
              accountsReceivable: "1150040004",
              sales: "135",
              costOfGoodsSold: "173",
              accountsPayable: "1150040005"
            }
          }
        });
      } else {
        res.status(500).json({ 
          message: "Failed to sync invoice to QuickBooks", 
          error: errorMessage 
        });
      }
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Error fetching QuickBooks accounts:", error);
      res.status(500).json({ message: "Failed to fetch QuickBooks accounts" });
    }
  });

  // Dashboard stats endpoint
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

  // Customer CRUD routes
  app.get("/api/customers", async (req, res) => {
    try {
      const { userId } = req.query;
      const customers = await storage.getCustomers(userId as string);
      res.json(customers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      res.json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const updateData = req.body;
      const customer = await storage.updateCustomer(req.params.id, updateData);
      res.json(customer);
    } catch (error) {
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      await storage.deleteCustomer(req.params.id);
      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}