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

  async createJournalEntry(
    accessToken: string,
    companyId: string,
    journalData: any
  ): Promise<any> {
    try {
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
    } catch (error) {
      console.error('QuickBooks journal entry creation failed:', error);
      throw new Error('Failed to create journal entry in QuickBooks');
    }
  }
}

export const quickBooksService = new QuickBooksService();
