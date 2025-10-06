import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import * as XLSX from "xlsx";
import multer from "multer";
import { storage } from "./storage";
import { quickBooksService } from "./services/quickbooks";
import { insertCustomerSchema, insertProductSchema, insertProductVariantSchema, 
         insertProductSchemeSchema, insertInvoiceSchema, insertInvoiceLineItemSchema } from "@shared/schema";

// Configure multer for file uploads (memory storage) with limits
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Only accept Excel and CSV files
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  }
});

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
      
      // Filter out undefined values, keep null values for QuickBooks disconnection
      const filteredData: any = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          filteredData[key] = value;
        }
      }
      
      // Ensure we have at least one field to update
      if (Object.keys(filteredData).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }
      
      const user = await storage.updateUser(id, filteredData);
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
        return res.status(400).json({ message: "Missing required parameters" });
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

      res.json({ success: true });
    } catch (error) {
      console.error("QuickBooks callback error:", error);
      res.status(500).json({ message: "Authentication failed" });
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
        type: z.enum(["customer", "vendor"]).optional(),
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

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.updateCustomer(req.params.id, req.body);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const success = await storage.deleteCustomer(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Export customers/vendors to Excel
  app.get("/api/customers/export", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const customers = await storage.getCustomers(userId);

      // Prepare data for Excel
      const excelData = customers.map(customer => ({
        Name: customer.name,
        Email: customer.email || "",
        Phone: customer.phone || "",
        Address: customer.address ? JSON.stringify(customer.address) : "",
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(wb, ws, "Accounts");

      // Generate buffer
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      // Set response headers
      const filename = "accounts.xlsx";
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buffer);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Import customers/vendors from Excel/CSV
  app.post("/api/customers/import", upload.single("file"), async (req, res) => {
    try {
      const userId = req.body.userId;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "File is required" });
      }

      // Parse Excel/CSV file
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row: any = data[i];
        
        try {
          // Parse address if it exists
          let address = null;
          
          if (row.Address) {
            try {
              address = JSON.parse(row.Address);
            } catch {
              address = null;
            }
          }

          // Validate and create customer
          const customerData = {
            userId,
            name: row.Name,
            email: row.Email || null,
            phone: row.Phone || null,
            address,
          };

          const validation = insertCustomerSchema.extend({
            userId: z.string(),
          }).safeParse(customerData);

          if (!validation.success) {
            results.failed++;
            results.errors.push(`Row ${i + 2}: ${validation.error.errors.map(e => e.message).join(", ")}`);
            continue;
          }

          await storage.createCustomer(validation.data);
          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }

      res.json({
        message: `Import completed: ${results.success} succeeded, ${results.failed} failed`,
        ...results,
      });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ message: "Failed to import data" });
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

  app.put("/api/products/:id", async (req, res) => {
    try {
      console.log("Updating product with data:", req.body);
      
      const validation = insertProductSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        console.error("Product validation failed:", validation.error.errors);
        return res.status(400).json({ message: "Invalid product data", errors: validation.error.errors });
      }

      const product = await storage.updateProduct(req.params.id, validation.data);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      console.log("Product updated successfully:", product.id, product.name);
      res.json(product);
    } catch (error) {
      console.error("Product update error:", error);
      const err = error as any;
      res.status(500).json({ message: "Failed to update product", error: err.message });
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

  app.patch("/api/schemes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Ensure isActive is a boolean if provided
      if (updates.isActive !== undefined) {
        updates.isActive = Boolean(updates.isActive);
      }
      
      const updatedScheme = await storage.updateScheme(id, updates);
      if (!updatedScheme) {
        return res.status(404).json({ message: "Scheme not found" });
      }
      
      return res.status(200).json(updatedScheme);
    } catch (error) {
      console.error('Error updating scheme:', error);
      return res.status(500).json({ message: "Failed to update scheme" });
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

      // Check inventory for AR invoices before creating
      if (invoice.invoiceType === 'receivable') {
        const outOfStockProducts = [];
        
        for (const item of lineItems) {
          if (item.productId && item.productId.trim() !== '') {
            try {
              const product = await storage.getProduct(item.productId);
              if (product && product.qty === 0) {
                outOfStockProducts.push(product.name);
              }
            } catch (error) {
              console.error(`Failed to check inventory for product ${item.productId}:`, error);
            }
          }
        }
        
        if (outOfStockProducts.length > 0) {
          return res.status(400).json({ 
            message: "Product is out of stock",
            outOfStockProducts: outOfStockProducts
          });
        }
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

      // Update inventory based on invoice type
      for (const item of lineItems) {
        if (item.productId && item.productId.trim() !== '') {
          try {
            const currentProduct = await storage.getProduct(item.productId);
            if (currentProduct) {
              let newQty = currentProduct.qty;
              
              // AR Invoice (receivable): Reduce inventory (selling to customer)
              if (invoice.invoiceType === 'receivable') {
                newQty = Math.max(0, currentProduct.qty - item.quantity);
                console.log(`Reducing inventory for product ${currentProduct.name}: ${currentProduct.qty} → ${newQty} (sold ${item.quantity})`);
              }
              // AP Invoice (payable): Increase inventory (buying from supplier) 
              else if (invoice.invoiceType === 'payable') {
                newQty = currentProduct.qty + item.quantity;
                console.log(`Increasing inventory for product ${currentProduct.name}: ${currentProduct.qty} → ${newQty} (purchased ${item.quantity})`);
              }
              
              // Update the product quantity
              await storage.updateProduct(item.productId, { qty: newQty });
            }
          } catch (inventoryError) {
            console.error(`Failed to update inventory for product ${item.productId}:`, inventoryError);
            // Don't fail the entire invoice creation if inventory update fails
          }
        }
      }

      // Also update inventory for any auto-generated free scheme items
      for (const lineItem of createdLineItems) {
        if (lineItem.isFreeFromScheme && lineItem.productId && invoice.invoiceType === 'receivable') {
          try {
            const currentProduct = await storage.getProduct(lineItem.productId);
            if (currentProduct) {
              const newQty = Math.max(0, currentProduct.qty - lineItem.quantity);
              console.log(`Reducing inventory for free scheme item ${currentProduct.name}: ${currentProduct.qty} → ${newQty} (free quantity ${lineItem.quantity})`);
              await storage.updateProduct(lineItem.productId, { qty: newQty });
            }
          } catch (inventoryError) {
            console.error(`Failed to update inventory for free scheme item ${lineItem.productId}:`, inventoryError);
          }
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
      // Get invoice and line items before deletion for inventory adjustment
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      const lineItems = await storage.getInvoiceLineItems(req.params.id);
      
      // Revert inventory changes for AP invoices (subtract added quantity)
      if (invoice.invoiceType === 'payable') {
        for (const item of lineItems) {
          if (item.productId && item.productId.trim() !== '') {
            try {
              const currentProduct = await storage.getProduct(item.productId);
              if (currentProduct) {
                const newQty = Math.max(0, currentProduct.qty - item.quantity);
                console.log(`Reverting AP invoice deletion: Reducing inventory for product ${currentProduct.name}: ${currentProduct.qty} → ${newQty} (removing ${item.quantity})`);
                await storage.updateProduct(item.productId, { qty: newQty });
              }
            } catch (inventoryError) {
              console.error(`Failed to revert inventory for product ${item.productId}:`, inventoryError);
            }
          }
        }
      }
      
      // Revert inventory changes for AR invoices (add back sold quantity)
      if (invoice.invoiceType === 'receivable') {
        for (const item of lineItems) {
          if (item.productId && item.productId.trim() !== '') {
            try {
              const currentProduct = await storage.getProduct(item.productId);
              if (currentProduct) {
                const newQty = currentProduct.qty + item.quantity;
                console.log(`Reverting AR invoice deletion: Increasing inventory for product ${currentProduct.name}: ${currentProduct.qty} → ${newQty} (adding back ${item.quantity})`);
                await storage.updateProduct(item.productId, { qty: newQty });
              }
            } catch (inventoryError) {
              console.error(`Failed to revert inventory for product ${item.productId}:`, inventoryError);
            }
          }
        }
      }
      
      const success = await storage.deleteInvoice(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  app.patch("/api/invoices/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      const success = await storage.updateInvoiceStatus(req.params.id, status);
      if (!success) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to update invoice status", error: error.message });
    }
  });

  app.put("/api/invoices/:id", async (req, res) => {
    try {
      console.log("Updating invoice with data:", JSON.stringify(req.body, null, 2));
      const { invoice: invoiceData, lineItems } = req.body;
      const invoiceId = req.params.id;
      
      if (!invoiceData || !lineItems) {
        console.error("Missing invoice or lineItems in request body");
        return res.status(400).json({ message: "Invoice and line items are required" });
      }

      // Get existing invoice to check if it exists
      const existingInvoice = await storage.getInvoice(invoiceId);
      if (!existingInvoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Get existing line items for inventory adjustment
      const existingLineItems = await storage.getInvoiceLineItems(invoiceId);
      
      // For AP invoices, revert old inventory changes before applying new ones
      if (existingInvoice.invoiceType === 'payable') {
        for (const oldItem of existingLineItems) {
          if (oldItem.productId && oldItem.productId.trim() !== '') {
            try {
              const currentProduct = await storage.getProduct(oldItem.productId);
              if (currentProduct) {
                // Subtract the old quantity
                const newQty = Math.max(0, currentProduct.qty - oldItem.quantity);
                console.log(`Reverting old AP line item: Reducing inventory for product ${currentProduct.name}: ${currentProduct.qty} → ${newQty} (removing ${oldItem.quantity})`);
                await storage.updateProduct(oldItem.productId, { qty: newQty });
              }
            } catch (inventoryError) {
              console.error(`Failed to revert inventory for product ${oldItem.productId}:`, inventoryError);
            }
          }
        }
      }
      
      // For AR invoices, revert old inventory changes before applying new ones
      if (existingInvoice.invoiceType === 'receivable') {
        for (const oldItem of existingLineItems) {
          if (oldItem.productId && oldItem.productId.trim() !== '') {
            try {
              const currentProduct = await storage.getProduct(oldItem.productId);
              if (currentProduct) {
                // Add back the old quantity
                const newQty = currentProduct.qty + oldItem.quantity;
                console.log(`Reverting old AR line item: Increasing inventory for product ${currentProduct.name}: ${currentProduct.qty} → ${newQty} (adding back ${oldItem.quantity})`);
                await storage.updateProduct(oldItem.productId, { qty: newQty });
              }
            } catch (inventoryError) {
              console.error(`Failed to revert inventory for product ${oldItem.productId}:`, inventoryError);
            }
          }
        }
      }

      // Update invoice
      const updatedInvoice = await storage.updateInvoice(invoiceId, {
        customerId: invoiceData.customerId,
        invoiceNumber: invoiceData.invoiceNumber,
        invoiceDate: new Date(invoiceData.invoiceDate),
        dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : undefined,
        subtotal: invoiceData.subtotal,
        freight: invoiceData.freight,
        total: invoiceData.total,
        status: invoiceData.status,
        invoiceType: invoiceData.invoiceType,
        updatedAt: new Date(),
      });

      // Delete existing line items and create new ones
      await storage.deleteInvoiceLineItemsByInvoiceId(invoiceId);
      
      const createdLineItems = [];
      for (const item of lineItems) {
        if (!item.productId || item.productId.trim() === '') {
          console.log('Skipping line item with empty productId:', item);
          continue;
        }

        const lineItemValidation = insertInvoiceLineItemSchema.safeParse({
          ...item,
          invoiceId: invoiceId,
        });
        
        if (lineItemValidation.success) {
          const lineItem = await storage.createLineItem(lineItemValidation.data);
          createdLineItems.push(lineItem);
        } else {
          console.error("Line item validation failed:", lineItemValidation.error.errors, "for item:", item);
        }
      }

      // Apply new inventory changes for AP invoices
      if (invoiceData.invoiceType === 'payable') {
        for (const item of lineItems) {
          if (item.productId && item.productId.trim() !== '') {
            try {
              const currentProduct = await storage.getProduct(item.productId);
              if (currentProduct) {
                // Add the new quantity
                const newQty = currentProduct.qty + item.quantity;
                console.log(`Applying new AP line item: Increasing inventory for product ${currentProduct.name}: ${currentProduct.qty} → ${newQty} (adding ${item.quantity})`);
                await storage.updateProduct(item.productId, { qty: newQty });
              }
            } catch (inventoryError) {
              console.error(`Failed to update inventory for product ${item.productId}:`, inventoryError);
            }
          }
        }
      }
      
      // Apply new inventory changes for AR invoices
      if (invoiceData.invoiceType === 'receivable') {
        for (const item of lineItems) {
          if (item.productId && item.productId.trim() !== '') {
            try {
              const currentProduct = await storage.getProduct(item.productId);
              if (currentProduct) {
                // Subtract the new quantity
                const newQty = Math.max(0, currentProduct.qty - item.quantity);
                console.log(`Applying new AR line item: Reducing inventory for product ${currentProduct.name}: ${currentProduct.qty} → ${newQty} (removing ${item.quantity})`);
                await storage.updateProduct(item.productId, { qty: newQty });
              }
            } catch (inventoryError) {
              console.error(`Failed to update inventory for product ${item.productId}:`, inventoryError);
            }
          }
        }
      }

      res.json({ invoice: updatedInvoice, lineItems: createdLineItems });
    } catch (error) {
      console.error("Invoice update error:", error);
      const err = error as any;
      res.status(500).json({ message: "Failed to update invoice", error: err.message });
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
  // Handle AP Invoice Sync
  async function handleAPInvoiceSync(invoice: any, user: any, storage: any, res: any) {
    console.log(`Creating QuickBooks Journal Entry for AP invoice ${invoice.invoiceNumber}`);

    // Find or create vendor in QuickBooks
    const customer = await storage.getCustomer(invoice.customerId!);
    if (!customer) {
      return res.status(400).json({ message: "Vendor not found for this AP invoice" });
    }

    const qbVendor = await findOrCreateVendor(user, customer.name, customer.id, storage);

    // Get invoice line items to calculate total
    const lineItems = await storage.getInvoiceLineItems(invoice.id);
    
    console.log('AP Invoice data:', { id: invoice.id, total: invoice.total, invoiceNumber: invoice.invoiceNumber });
    console.log('AP Line items for amount calculation:', lineItems);
    
    // Calculate total from invoice total first, then fallback to line items
    let totalAmount = parseFloat(invoice.total) || 0;
    
    // If invoice total is 0, calculate from line items
    if (totalAmount === 0) {
      totalAmount = lineItems.reduce((sum: number, item: any) => {
        const itemTotal = parseFloat(item.lineTotal) || 0;
        console.log(`AP Line item ${item.description}: ${itemTotal}`);
        return sum + itemTotal;
      }, 0);
    }
    
    console.log('Final calculated AP total amount:', totalAmount);
    
    // Ensure we have a valid amount
    if (totalAmount === 0) {
      throw new Error('AP Invoice total amount is 0. Cannot create journal entry.');
    }
    
    // Create Journal Entry data for AP invoice - COGS dr to Account Payable cr
    const journalEntryData = {
      TxnDate: invoice.invoiceDate.toISOString().split('T')[0],
      PrivateNote: `JE for AP Invoice #${invoice.invoiceNumber}`,
      Line: [
        // Debit COGS
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
        // Credit Account Payable with Vendor entity reference
        {
          Id: "1", 
          Description: "Account Payable entry for AP Invoice",
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

  async function handleARInvoiceSync(invoice: any, user: any, storage: any, res: any) {
    const isUpdate = !!invoice.quickbooksInvoiceId;
    console.log(`${isUpdate ? 'Updating' : 'Creating'} QuickBooks Journal Entry for AR invoice ${invoice.invoiceNumber}`);

    // Find or create customer in QuickBooks
    const customer = await storage.getCustomer(invoice.customerId!);
    if (!customer) {
      return res.status(400).json({ message: "Customer not found for this AR invoice" });
    }

    const qbCustomer = await findOrCreateCustomer(user, customer.name, customer.id, storage);

    // Get amounts from invoice
    const subtotal = parseFloat(invoice.subtotal) || 0;
    const freight = parseFloat(invoice.freight) || 0;
    const discount = parseFloat(invoice.discount) || 0;
    const total = parseFloat(invoice.total) || 0;
    
    console.log('Invoice amounts:', { subtotal, freight, discount, total, invoiceNumber: invoice.invoiceNumber });
    
    // Ensure we have a valid total amount
    if (total === 0) {
      throw new Error('Invoice total amount is 0. Cannot create journal entry.');
    }
    
    // Build journal entry lines based on freight/discount combinations
    const journalLines: any[] = [];
    let lineId = 0;
    
    // Debit entries
    // 1. Freight (if present) - Debit
    if (freight > 0) {
      journalLines.push({
        Id: (lineId++).toString(),
        Description: "Freight charges",
        Amount: freight,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: "Debit",
          AccountRef: {
            value: "136",
            name: "Freight Income"
          }
        }
      });
    }
    
    // 2. Accounts Receivable - Always Debit (total amount)
    journalLines.push({
      Id: (lineId++).toString(),
      Description: "AR entry for Invoice",
      Amount: total,
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
    });
    
    // Credit entries
    // 3. Discount (if present) - Credit
    if (discount > 0) {
      journalLines.push({
        Id: (lineId++).toString(),
        Description: "Discount applied",
        Amount: discount,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: "Credit",
          AccountRef: {
            value: "137",
            name: "Discounts Given"
          }
        }
      });
    }
    
    // 4. Sales - Always Credit (subtotal amount)
    journalLines.push({
      Id: (lineId++).toString(),
      Description: "Sales entry for Invoice",
      Amount: subtotal,
      DetailType: "JournalEntryLineDetail",
      JournalEntryLineDetail: {
        PostingType: "Credit",
        AccountRef: {
          value: "135",
          name: "Sales of Product Income"
        }
      }
    });
    
    // Create or update journal entry
    let qbJournalEntry;
    
    if (isUpdate) {
      // Get existing journal entry to retrieve SyncToken
      console.log(`Retrieving existing journal entry ${invoice.quickbooksInvoiceId} for update`);
      const existingJE = await quickBooksService.getJournalEntry(
        user.quickbooksAccessToken!,
        user.quickbooksCompanyId!,
        invoice.quickbooksInvoiceId
      );
      
      const journalEntryData = {
        Id: existingJE.Id,
        SyncToken: existingJE.SyncToken,
        TxnDate: invoice.invoiceDate.toISOString().split('T')[0],
        PrivateNote: `JE for Invoice #${invoice.invoiceNumber}`,
        Line: journalLines
      };
      
      console.log('Updating QuickBooks Journal Entry with data:', JSON.stringify(journalEntryData, null, 2));
      
      qbJournalEntry = await quickBooksService.updateJournalEntry(
        user.quickbooksAccessToken!,
        user.quickbooksCompanyId!,
        journalEntryData
      );
    } else {
      const journalEntryData = {
        TxnDate: invoice.invoiceDate.toISOString().split('T')[0],
        PrivateNote: `JE for Invoice #${invoice.invoiceNumber}`,
        Line: journalLines
      };
      
      console.log('Creating QuickBooks Journal Entry with data:', JSON.stringify(journalEntryData, null, 2));
      
      qbJournalEntry = await quickBooksService.createJournalEntry(
        user.quickbooksAccessToken!,
        user.quickbooksCompanyId!,
        journalEntryData
      );
      
      // Update invoice with QuickBooks journal entry ID for first time
      await storage.updateInvoice(invoice.id, {
        quickbooksInvoiceId: qbJournalEntry.Id,
        status: "sent",
      });
    }

    // Build account details for response
    const accounts: string[] = [];
    if (freight > 0) accounts.push("Freight Dr");
    accounts.push("AR Dr");
    if (discount > 0) accounts.push("Discount Cr");
    accounts.push("Sales Cr");

    return res.json({ 
      success: true, 
      quickbooksInvoiceId: qbJournalEntry.Id,
      customerId: qbCustomer.Id,
      customerName: qbCustomer.DisplayName,
      invoiceType: 'receivable',
      totalAmount: total,
      accounts: accounts.join(", "),
      message: `Journal Entry successfully ${isUpdate ? 'updated' : 'created'} in QuickBooks`
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

  async function findOrCreateVendor(user: any, vendorName: string, customerId: string, storage: any) {
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
      DisplayName: vendorName,
    };

    qbVendor = await quickBooksService.createVendor(
      user.quickbooksAccessToken,
      user.quickbooksCompanyId,
      qbVendorData
    );
    
    // Update local customer record with QuickBooks Vendor ID (for AP invoices, customer record holds vendor info)
    await storage.updateCustomer(customerId, {
      quickbooksCustomerId: qbVendor.Id, // Store vendor ID in same field for AP invoices
    });

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
