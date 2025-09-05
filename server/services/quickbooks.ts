import axios from 'axios';

export interface QuickBooksTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  companyId: string;
}

export interface QuickBooksInvoiceData {
  CustomerRef: { value: string };
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

export class QuickBooksService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly sandboxBaseUrl = 'https://sandbox-quickbooks.api.intuit.com';
  private readonly oauthBaseUrl = 'https://oauth.platform.intuit.com';

  constructor() {
    this.clientId = process.env.QUICKBOOKS_CLIENT_ID || '';
    this.clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET || '';
    this.redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || '';
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
      const response = await axios.post(
        `${this.sandboxBaseUrl}/v3/company/${companyId}/invoice`,
        invoiceData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      return response.data.QueryResponse?.Invoice?.[0];
    } catch (error) {
      console.error('QuickBooks invoice creation failed:', error);
      throw new Error('Failed to create invoice in QuickBooks');
    }
  }

  async getCompanyInfo(accessToken: string, companyId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.sandboxBaseUrl}/v3/company/${companyId}/companyinfo/${companyId}`,
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
      const response = await axios.post(
        `${this.sandboxBaseUrl}/v3/company/${companyId}/customer`,
        customerData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      return response.data.QueryResponse?.Customer?.[0];
    } catch (error) {
      console.error('QuickBooks customer creation failed:', error);
      throw new Error('Failed to create customer in QuickBooks');
    }
  }

  async createItem(
    accessToken: string,
    companyId: string,
    itemData: any
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.sandboxBaseUrl}/v3/company/${companyId}/item`,
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
      const response = await axios.get(
        `${this.sandboxBaseUrl}/v3/company/${companyId}/query?query=SELECT * FROM Account WHERE Active = true`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      return response.data.QueryResponse?.Account || [];
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
        `${this.sandboxBaseUrl}/v3/company/${companyId}/query?query=SELECT * FROM Customer WHERE DisplayName = '${escapedName}'`,
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
        `${this.sandboxBaseUrl}/v3/company/${companyId}/query?query=SELECT * FROM Customer`,
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
        `${this.sandboxBaseUrl}/v3/company/${companyId}/query?query=SELECT * FROM Customer WHERE Name = '${escapedName}'`,
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
        `${this.sandboxBaseUrl}/v3/company/${companyId}/query?query=SELECT * FROM Customer`,
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
    journalData: any
  ): Promise<any> {
    try {
      console.log('Creating journal entry with data:', JSON.stringify(journalData, null, 2));
      
      const response = await axios.post(
        `${this.sandboxBaseUrl}/v3/company/${companyId}/journalentry`,
        journalData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      return response.data.QueryResponse?.JournalEntry?.[0] || response.data.JournalEntry;
    } catch (error: any) {
      console.error('QuickBooks journal entry creation failed:', error.response?.data || error.message);
      console.error('Request data that failed:', JSON.stringify(journalData, null, 2));
      
      // Preserve the original error structure for better error handling
      if (error.response) {
        const enhancedError = new Error('Failed to create journal entry in QuickBooks');
        (enhancedError as any).response = error.response;
        throw enhancedError;
      }
      
      throw new Error('Failed to create journal entry in QuickBooks');
    }
  }
}

export const quickBooksService = new QuickBooksService();
