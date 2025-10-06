import axios from 'axios';

export interface QuickBooksTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  companyId: string;
}

export interface QuickBooksInvoiceData {
  CustomerRef: { value: string; name?: string };
  TxnDate?: string;
  DueDate?: string;
  DocNumber?: string;
  PrivateNote?: string;
  Line: Array<{
    Amount: number;
    DetailType: string;
    SalesItemLineDetail: {
      ItemRef: { value: string; name: string };
      UnitPrice: number;
      Qty: number;
    };
  }>;
}

export interface QuickBooksBillData {
  VendorRef: { value: string; name?: string };
  TxnDate?: string;
  DueDate?: string;
  DocNumber?: string;
  PrivateNote?: string;
  Line: Array<{
    Amount: number;
    DetailType: string;
    AccountBasedExpenseLineDetail: {
      AccountRef: { value: string; name?: string };
    };
  }>;
}

export class QuickBooksService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly sandboxBaseUrl = 'https://sandbox-quickbooks.api.intuit.com';
  private readonly productionBaseUrl = 'https://quickbooks.api.intuit.com';
  private readonly oauthBaseUrl = 'https://oauth.platform.intuit.com';
  private readonly isProduction: boolean;

  constructor() {
    this.clientId = process.env.QUICKBOOKS_CLIENT_ID || '';
    this.clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET || '';
    this.redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || '';
    this.isProduction = process.env.QUICKBOOKS_ENVIRONMENT === 'production';
  }

  private getBaseUrl(): string {
    return this.isProduction ? this.productionBaseUrl : this.sandboxBaseUrl;
  }

  getAuthorizationUrl(state: string): string {
    const scope = 'com.intuit.quickbooks.accounting';
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      state,
    });

    return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, realmId: string): Promise<QuickBooksTokens> {
    try {
      const tokenData = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      };

      const response = await axios.post(
        `${this.oauthBaseUrl}/oauth2/v1/tokens/bearer`,
        new URLSearchParams(tokenData),
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        companyId: realmId,
      };
    } catch (error) {
      console.error('QuickBooks token exchange failed:', error);
      throw new Error('Failed to exchange code for tokens');
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const tokenData = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      };

      const response = await axios.post(
        `${this.oauthBaseUrl}/oauth2/v1/tokens/bearer`,
        new URLSearchParams(tokenData),
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
      };
    } catch (error) {
      console.error('QuickBooks token refresh failed:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  async createInvoice(
    accessToken: string,
    companyId: string,
    invoiceData: QuickBooksInvoiceData
  ): Promise<any> {
    try {
      console.log('Creating QuickBooks AR invoice with data:', JSON.stringify(invoiceData, null, 2));
      
      const response = await axios.post(
        `${this.getBaseUrl()}/v3/company/${companyId}/invoice`,
        invoiceData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      const invoice = response.data.QueryResponse?.Invoice?.[0] || response.data.Invoice;
      console.log('Successfully created QuickBooks AR invoice:', {
        Id: invoice?.Id,
        DocNumber: invoice?.DocNumber,
        TotalAmt: invoice?.TotalAmt
      });
      
      return invoice;
    } catch (error: any) {
      console.error('QuickBooks AR invoice creation failed:', error.response?.data || error.message);
      console.error('Request data that failed:', JSON.stringify(invoiceData, null, 2));
      
      // Preserve the original error structure for better error handling
      if (error.response) {
        const enhancedError = new Error('Failed to create AR invoice in QuickBooks');
        (enhancedError as any).response = error.response;
        throw enhancedError;
      }
      
      throw new Error('Failed to create AR invoice in QuickBooks');
    }
  }

  async createBill(
    accessToken: string,
    companyId: string,
    billData: QuickBooksBillData
  ): Promise<any> {
    try {
      console.log('Creating QuickBooks AP bill with data:', JSON.stringify(billData, null, 2));
      
      const response = await axios.post(
        `${this.getBaseUrl()}/v3/company/${companyId}/bill`,
        billData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      const bill = response.data.QueryResponse?.Bill?.[0] || response.data.Bill;
      console.log('Successfully created QuickBooks AP bill:', {
        Id: bill?.Id,
        DocNumber: bill?.DocNumber,
        TotalAmt: bill?.TotalAmt
      });
      
      return bill;
    } catch (error: any) {
      console.error('QuickBooks AP bill creation failed:', error.response?.data || error.message);
      console.error('Request data that failed:', JSON.stringify(billData, null, 2));
      
      // Preserve the original error structure for better error handling
      if (error.response) {
        const enhancedError = new Error('Failed to create AP bill in QuickBooks');
        (enhancedError as any).response = error.response;
        throw enhancedError;
      }
      
      throw new Error('Failed to create AP bill in QuickBooks');
    }
  }

  async getCompanyInfo(accessToken: string, companyId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.getBaseUrl()}/v3/company/${companyId}/companyinfo/${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      return response.data.QueryResponse?.CompanyInfo?.[0];
    } catch (error) {
      console.error('QuickBooks company info fetch failed:', error);
      throw new Error('Failed to fetch company info from QuickBooks');
    }
  }

  async createCustomer(
    accessToken: string,
    companyId: string,
    customerData: any
  ): Promise<any> {
    try {
      console.log('Creating QuickBooks customer with data:', JSON.stringify(customerData, null, 2));
      
      const response = await axios.post(
        `${this.getBaseUrl()}/v3/company/${companyId}/customer`,
        customerData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      const customer = response.data.QueryResponse?.Customer?.[0] || response.data.Customer;
      console.log('Successfully created QuickBooks customer:', {
        Id: customer?.Id,
        DisplayName: customer?.DisplayName,
        Name: customer?.Name
      });
      
      return customer;
    } catch (error: any) {
      console.error('QuickBooks customer creation failed:', error.response?.data || error.message);
      console.error('Request data that failed:', JSON.stringify(customerData, null, 2));
      
      // Preserve the original error structure for better error handling
      if (error.response) {
        const enhancedError = new Error('Failed to create customer in QuickBooks');
        (enhancedError as any).response = error.response;
        throw enhancedError;
      }
      
      throw new Error('Failed to create customer in QuickBooks');
    }
  }

  async findVendorByDisplayName(accessToken: string, companyId: string, vendorName: string): Promise<any> {
    try {
      // First try exact DisplayName match for vendors
      const escapedName = vendorName.replace(/'/g, "''");
      
      console.log(`Searching for vendor with DisplayName: "${vendorName}"`);
      
      const response = await axios.get(
        `${this.getBaseUrl()}/v3/company/${companyId}/query?query=SELECT * FROM Vendor WHERE DisplayName = '${escapedName}'`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      const vendors = response.data.QueryResponse?.Vendor || [];
      if (vendors.length > 0) {
        console.log(`Found vendor by exact DisplayName match:`, {
          Id: vendors[0].Id,
          DisplayName: vendors[0].DisplayName,
          Name: vendors[0].Name
        });
        return vendors[0];
      }

      console.log('Exact DisplayName match failed, trying case-insensitive search...');
      
      // If exact match fails, try to get all vendors and find by DisplayName
      const allVendorsResponse = await axios.get(
        `${this.getBaseUrl()}/v3/company/${companyId}/query?query=SELECT * FROM Vendor`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      const allVendors = allVendorsResponse.data.QueryResponse?.Vendor || [];
      console.log(`Found ${allVendors.length} total vendors, searching for: "${vendorName}"`);
      
      // Try to find vendor by DisplayName (case insensitive)
      const matchingVendor = allVendors.find((vendor: any) => 
        vendor.DisplayName?.toLowerCase() === vendorName.toLowerCase()
      );
      
      if (matchingVendor) {
        console.log(`Found vendor by case-insensitive DisplayName match:`, {
          Id: matchingVendor.Id,
          DisplayName: matchingVendor.DisplayName,
          Name: matchingVendor.Name
        });
        return matchingVendor;
      }

      console.log('No vendor found with DisplayName matching approach');
      console.log('Available vendor DisplayNames:', allVendors.map((v: any) => v.DisplayName).slice(0, 10));
      return null;
      
    } catch (error: any) {
      console.error('QuickBooks vendor search failed:', error.response?.data || error.message);
      console.error('Full error details:', JSON.stringify(error.response?.data, null, 2));
      throw error; // Throw error so calling code can handle it appropriately
    }
  }

  async createVendor(
    accessToken: string,
    companyId: string,
    vendorData: any
  ): Promise<any> {
    try {
      console.log('Creating QuickBooks vendor with data:', JSON.stringify(vendorData, null, 2));
      
      const response = await axios.post(
        `${this.getBaseUrl()}/v3/company/${companyId}/vendor`,
        vendorData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      const vendor = response.data.QueryResponse?.Vendor?.[0] || response.data.Vendor;
      console.log('Successfully created QuickBooks vendor:', {
        Id: vendor?.Id,
        DisplayName: vendor?.DisplayName,
        Name: vendor?.Name
      });
      
      return vendor;
    } catch (error: any) {
      console.error('QuickBooks vendor creation failed:', error.response?.data || error.message);
      console.error('Request data that failed:', JSON.stringify(vendorData, null, 2));
      
      // Preserve the original error structure for better error handling
      if (error.response) {
        const enhancedError = new Error('Failed to create vendor in QuickBooks');
        (enhancedError as any).response = error.response;
        throw enhancedError;
      }
      
      throw new Error('Failed to create vendor in QuickBooks');
    }
  }

  async createItem(
    accessToken: string,
    companyId: string,
    itemData: any
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.getBaseUrl()}/v3/company/${companyId}/item`,
        itemData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      return response.data.QueryResponse?.Item?.[0];
    } catch (error) {
      console.error('QuickBooks item creation failed:', error);
      throw new Error('Failed to create item in QuickBooks');
    }
  }

  async getAccounts(accessToken: string, companyId: string): Promise<any> {
    try {
      const allAccounts: any[] = [];
      let startPosition = 1;
      const maxResults = 1000;
      let hasMore = true;

      while (hasMore) {
        const query = `SELECT * FROM Account WHERE Active = true STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
        const response = await axios.get(
          `${this.getBaseUrl()}/v3/company/${companyId}/query?query=${encodeURIComponent(query)}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          }
        );

        const accounts = response.data.QueryResponse?.Account || [];
        allAccounts.push(...accounts);

        // Check if there are more results
        if (accounts.length < maxResults) {
          hasMore = false;
        } else {
          startPosition += maxResults;
        }
      }

      return allAccounts;
    } catch (error) {
      console.error('QuickBooks accounts fetch failed:', error);
      throw new Error('Failed to fetch accounts from QuickBooks');
    }
  }

  async findCustomerByDisplayName(accessToken: string, companyId: string, customerName: string): Promise<any> {
    try {
      // First try exact DisplayName match (this is what QuickBooks uses for customer matching)
      const escapedName = customerName.replace(/'/g, "''");
      
      console.log(`Searching for customer with DisplayName: "${customerName}"`);
      
      const response = await axios.get(
        `${this.getBaseUrl()}/v3/company/${companyId}/query?query=SELECT * FROM Customer WHERE DisplayName = '${escapedName}'`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      const customers = response.data.QueryResponse?.Customer || [];
      if (customers.length > 0) {
        console.log(`Found customer by exact DisplayName match:`, {
          Id: customers[0].Id,
          DisplayName: customers[0].DisplayName,
          Name: customers[0].Name
        });
        return customers[0];
      }

      console.log('Exact DisplayName match failed, trying case-insensitive search...');
      
      // If exact match fails, try to get all customers and find by DisplayName
      const allCustomersResponse = await axios.get(
        `${this.getBaseUrl()}/v3/company/${companyId}/query?query=SELECT * FROM Customer`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      const allCustomers = allCustomersResponse.data.QueryResponse?.Customer || [];
      console.log(`Found ${allCustomers.length} total customers, searching for: "${customerName}"`);
      
      // Try to find customer by DisplayName (case insensitive)
      const matchingCustomer = allCustomers.find((customer: any) => 
        customer.DisplayName?.toLowerCase() === customerName.toLowerCase()
      );
      
      if (matchingCustomer) {
        console.log(`Found customer by case-insensitive DisplayName match:`, {
          Id: matchingCustomer.Id,
          DisplayName: matchingCustomer.DisplayName,
          Name: matchingCustomer.Name
        });
        return matchingCustomer;
      }

      console.log('No customer found with DisplayName matching approach');
      console.log('Available customer DisplayNames:', allCustomers.map((c: any) => c.DisplayName).slice(0, 10));
      return null;
      
    } catch (error: any) {
      console.error('QuickBooks customer search failed:', error.response?.data || error.message);
      console.error('Full error details:', JSON.stringify(error.response?.data, null, 2));
      throw error; // Throw error so calling code can handle it appropriately
    }
  }

  async findCustomerByName(accessToken: string, companyId: string, customerName: string): Promise<any> {
    try {
      // First try exact name match
      const escapedName = customerName.replace(/'/g, "''");
      
      console.log(`Searching for customer with exact name: "${customerName}"`);
      
      const response = await axios.get(
        `${this.getBaseUrl()}/v3/company/${companyId}/query?query=SELECT * FROM Customer WHERE Name = '${escapedName}'`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      const customers = response.data.QueryResponse?.Customer || [];
      if (customers.length > 0) {
        console.log(`Found customer by exact match:`, customers[0]);
        return customers[0];
      }

      console.log('Exact match failed, trying to list all customers...');
      
      // If exact match fails, try to get all customers and find by name
      const allCustomersResponse = await axios.get(
        `${this.getBaseUrl()}/v3/company/${companyId}/query?query=SELECT * FROM Customer`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      const allCustomers = allCustomersResponse.data.QueryResponse?.Customer || [];
      console.log(`Found ${allCustomers.length} total customers`);
      
      // Try to find customer by name (case insensitive)
      const matchingCustomer = allCustomers.find((customer: any) => 
        customer.Name?.toLowerCase() === customerName.toLowerCase()
      );
      
      if (matchingCustomer) {
        console.log(`Found customer by case-insensitive match:`, matchingCustomer);
        return matchingCustomer;
      }

      // Try partial match
      const partialMatch = allCustomers.find((customer: any) => 
        customer.Name?.toLowerCase().includes(customerName.toLowerCase()) ||
        customerName.toLowerCase().includes(customer.Name?.toLowerCase())
      );
      
      if (partialMatch) {
        console.log(`Found customer by partial match:`, partialMatch);
        return partialMatch;
      }

      console.log('No customer found with any matching approach');
      return null;
      
    } catch (error: any) {
      console.error('QuickBooks customer search failed:', error.response?.data || error.message);
      console.error('Full error details:', JSON.stringify(error.response?.data, null, 2));
      return null; // Return null instead of throwing to handle gracefully
    }
  }

  async createJournalEntry(
    accessToken: string,
    companyId: string,
    journalEntryData: any
  ): Promise<any> {
    try {
      console.log('Posting Journal Entry to QuickBooks:', JSON.stringify(journalEntryData, null, 2));
      
      const response = await axios.post(
        `${this.getBaseUrl()}/v3/company/${companyId}/journalentry`,
        journalEntryData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      console.log('QuickBooks Journal Entry Response:', JSON.stringify(response.data, null, 2));
      return response.data.JournalEntry || response.data.QueryResponse?.JournalEntry?.[0];
    } catch (error: any) {
      console.error('QuickBooks journal entry creation failed:', error.response?.data || error.message);
      console.error('Full error details:', JSON.stringify(error.response?.data, null, 2));
      
      // Preserve the original error structure for better error handling
      if (error.response) {
        const enhancedError = new Error('Failed to create journal entry in QuickBooks');
        (enhancedError as any).response = error.response;
        throw enhancedError;
      }
      
      throw new Error('Failed to create journal entry in QuickBooks');
    }
  }

  async getJournalEntry(
    accessToken: string,
    companyId: string,
    journalEntryId: string
  ): Promise<any> {
    try {
      console.log(`Getting Journal Entry ${journalEntryId} from QuickBooks`);
      
      const response = await axios.get(
        `${this.getBaseUrl()}/v3/company/${companyId}/journalentry/${journalEntryId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      console.log('QuickBooks Get Journal Entry Response:', JSON.stringify(response.data, null, 2));
      return response.data.JournalEntry;
    } catch (error: any) {
      console.error('QuickBooks journal entry get failed:', error.response?.data || error.message);
      console.error('Full error details:', JSON.stringify(error.response?.data, null, 2));
      
      if (error.response) {
        const enhancedError = new Error('Failed to get journal entry from QuickBooks');
        (enhancedError as any).response = error.response;
        throw enhancedError;
      }
      
      throw new Error('Failed to get journal entry from QuickBooks');
    }
  }

  async updateJournalEntry(
    accessToken: string,
    companyId: string,
    journalEntryData: any
  ): Promise<any> {
    try {
      console.log('Updating Journal Entry in QuickBooks:', JSON.stringify(journalEntryData, null, 2));
      
      const response = await axios.post(
        `${this.getBaseUrl()}/v3/company/${companyId}/journalentry?operation=update`,
        journalEntryData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      console.log('QuickBooks Journal Entry Update Response:', JSON.stringify(response.data, null, 2));
      return response.data.JournalEntry;
    } catch (error: any) {
      console.error('QuickBooks journal entry update failed:', error.response?.data || error.message);
      console.error('Full error details:', JSON.stringify(error.response?.data, null, 2));
      
      if (error.response) {
        const enhancedError = new Error('Failed to update journal entry in QuickBooks');
        (enhancedError as any).response = error.response;
        throw enhancedError;
      }
      
      throw new Error('Failed to update journal entry in QuickBooks');
    }
  }

}

export const quickBooksService = new QuickBooksService();
