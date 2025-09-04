import { useState } from "react";
import { CheckCircle, AlertCircle, Upload, Users, Package, FileText, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DEFAULT_USER_ID } from "@/lib/constants";

export default function QuickBooksSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAccounts, setShowAccounts] = useState(false);
  const [accounts, setAccounts] = useState([]);

  const { data: user } = useQuery({
    queryKey: ["/api/users", DEFAULT_USER_ID],
  });

  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch(`/api/customers?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
  });

  const { data: products } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const response = await fetch(`/api/products?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["/api/invoices"],
    queryFn: async () => {
      const response = await fetch(`/api/invoices?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch invoices");
      return response.json();
    },
  });

  const syncCustomerMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const response = await apiRequest("POST", `/api/customers/${customerId}/sync-quickbooks`, {});
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to sync customer");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Success",
        description: "Customer synced to QuickBooks successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sync customer to QuickBooks",
        variant: "destructive",
      });
    },
  });

  const syncProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await apiRequest("POST", `/api/products/${productId}/sync-quickbooks`, {});
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to sync product");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product synced to QuickBooks successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sync product to QuickBooks",
        variant: "destructive",
      });
    },
  });

  const isConnected = user?.quickbooksAccessToken && user?.quickbooksCompanyId;
  const syncedCustomers = customers?.filter((c: any) => c.quickbooksCustomerId) || [];
  const syncedProducts = products?.filter((p: any) => p.quickbooksItemId) || [];
  const syncedInvoices = invoices?.filter((i: any) => i.quickbooksInvoiceId) || [];

  const checkAccountsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/quickbooks/accounts');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch accounts");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setAccounts(data.accounts || []);
      setShowAccounts(true);
      toast({
        title: "Accounts Retrieved",
        description: `Found ${data.totalAccounts} QuickBooks accounts`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch QuickBooks accounts",
        variant: "destructive",
      });
    },
  });

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please connect to QuickBooks first before syncing data. Go to QuickBooks Auth page to connect.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">QuickBooks Sync Manager</h1>
        <p className="text-muted-foreground">
          Sync your customers, products, and invoices to QuickBooks in the correct order.
        </p>
        
        {/* Debug: Check QuickBooks Accounts */}
        <div className="flex gap-4 mt-4">
          <Button 
            onClick={() => checkAccountsMutation.mutate()}
            disabled={checkAccountsMutation.isPending}
            variant="outline"
            size="sm"
          >
            <Search className="mr-2 h-4 w-4" />
            {checkAccountsMutation.isPending ? "Loading..." : "Debug: Check QB Accounts"}
          </Button>
          {showAccounts && (
            <Button 
              onClick={() => setShowAccounts(false)}
              variant="ghost"
              size="sm"
            >
              Hide Accounts
            </Button>
          )}
        </div>
      </div>

      {/* QuickBooks Accounts Display */}
      {showAccounts && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>QuickBooks Chart of Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Account ID</th>
                    <th className="text-left p-2">Account Name</th>
                    <th className="text-left p-2">Account Type</th>
                    <th className="text-left p-2">Sub Type</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account: any, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2 font-mono">{account.id}</td>
                      <td className="p-2">{account.name}</td>
                      <td className="p-2">
                        <Badge variant={account.type === 'Accounts Receivable' || account.type === 'Income' ? 'default' : 'secondary'}>
                          {account.type}
                        </Badge>
                      </td>
                      <td className="p-2 text-muted-foreground">{account.subType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Customers Synced</p>
                <p className="text-2xl font-bold">{syncedCustomers.length}/{customers?.length || 0}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Products Synced</p>
                <p className="text-2xl font-bold">{syncedProducts.length}/{products?.length || 0}</p>
              </div>
              <Package className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Invoices Synced</p>
                <p className="text-2xl font-bold">{syncedInvoices.length}/{invoices?.length || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Workflow */}
      <div className="space-y-6">
        {/* Step 1: Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
              <Users className="h-5 w-5" />
              Sync Customers First
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Before creating invoices in QuickBooks, you must sync all customers first.
            </p>
            <div className="space-y-2">
              {customers?.map((customer: any) => (
                <div key={customer.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {customer.quickbooksCustomerId ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-muted-foreground">{customer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {customer.quickbooksCustomerId ? (
                      <Badge className="bg-green-500">Synced</Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => syncCustomerMutation.mutate(customer.id)}
                        disabled={syncCustomerMutation.isPending}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Sync
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight className="h-6 w-6 text-muted-foreground" />
        </div>

        {/* Step 2: Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
              <Package className="h-5 w-5" />
              Sync Products Second
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              After customers, sync all products before creating invoices.
            </p>
            <div className="space-y-2">
              {products?.map((product: any) => (
                <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {product.quickbooksItemId ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">${product.basePrice}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {product.quickbooksItemId ? (
                      <Badge className="bg-green-500">Synced</Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => syncProductMutation.mutate(product.id)}
                        disabled={syncProductMutation.isPending}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Sync
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight className="h-6 w-6 text-muted-foreground" />
        </div>

        {/* Step 3: Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
              <FileText className="h-5 w-5" />
              Sync Invoices Last
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Once customers and products are synced, you can sync invoices from the Invoices page.
            </p>
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                After syncing customers and products, go to the Invoices page and click the sync button (📤) next to each invoice.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}