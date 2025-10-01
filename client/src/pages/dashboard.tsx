import { useState } from "react";
import { Plus, Download, Link as LinkIcon, DollarSign, History, Gift, Warehouse, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { DEFAULT_USER_ID, INVOICE_STATUS_COLORS } from "@/lib/constants";
import StatsCards from "@/components/stats-cards";
import InvoiceForm from "@/components/invoice-form";
import SchemeModal from "@/components/scheme-modal";
import InventoryModal from "@/components/inventory-modal";

export default function Dashboard() {
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showSchemeModal, setShowSchemeModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: user } = useQuery({
    queryKey: ["/api/users", DEFAULT_USER_ID],
    queryFn: async () => {
      const response = await fetch(`/api/users/${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch user");
      return response.json();
    },
  });

  const { data: recentInvoices } = useQuery({
    queryKey: ["/api/invoices"],
    queryFn: async () => {
      const response = await fetch(`/api/invoices?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch invoices");
      const invoices = await response.json();
      return invoices.slice(0, 3); // Get only the 3 most recent
    },
  });

  const { data: schemes } = useQuery({
    queryKey: ["/api/schemes"],
    queryFn: async () => {
      const response = await fetch(`/api/schemes?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch schemes");
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

  const isQuickBooksConnected = user?.quickbooksAccessToken && user?.quickbooksCompanyId;

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/users/${DEFAULT_USER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quickbooksAccessToken: null,
          quickbooksRefreshToken: null,
          quickbooksCompanyId: null,
          quickbooksTokenExpiry: null,
        }),
      });
      if (!response.ok) throw new Error("Failed to disconnect");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", DEFAULT_USER_ID] });
      toast({
        title: "Success",
        description: "QuickBooks account disconnected successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect QuickBooks account",
        variant: "destructive",
      });
    },
  });

  const handleConnectQuickBooks = () => {
    setLocation("/auth/quickbooks");
  };

  const handleDisconnectQuickBooks = () => {
    if (confirm("Are you sure you want to disconnect your QuickBooks account? This will stop all synchronization.")) {
      disconnectMutation.mutate();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage invoices, inventory, and product schemes</p>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Invoice Creation & QuickBooks Integration */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* QuickBooks Status */}
          <Card data-testid="quickbooks-integration-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <LinkIcon className="mr-2 text-primary" size={18} />
                QuickBooks Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">QB</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground" data-testid="quickbooks-company-name">
                      {isQuickBooksConnected ? "Tech Solutions LLC" : "Not Connected"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Company ID: <span data-testid="quickbooks-company-id">
                        {user?.quickbooksCompanyId || "Not Available"}
                      </span>
                    </p>
                  </div>
                </div>
                {isQuickBooksConnected ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive border-destructive hover:bg-destructive/10" 
                    data-testid="button-disconnect-quickbooks"
                    onClick={handleDisconnectQuickBooks}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    data-testid="button-connect-quickbooks"
                    onClick={handleConnectQuickBooks}
                  >
                    Connect
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-accent/5 rounded-lg">
                  <p className="text-2xl font-bold text-accent" data-testid="quickbooks-invoices-synced">156</p>
                  <p className="text-sm text-muted-foreground">Invoices Synced</p>
                </div>
                <div className="text-center p-3 bg-primary/5 rounded-lg">
                  <p className="text-2xl font-bold text-primary" data-testid="quickbooks-last-sync">2 min ago</p>
                  <p className="text-sm text-muted-foreground">Last Sync</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card data-testid="recent-invoices-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <History className="mr-2 text-primary" size={18} />
                  Recent Invoices
                </CardTitle>
                <Button variant="link" size="sm" data-testid="button-view-all-invoices">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentInvoices?.length ? (
                  recentInvoices.map((invoice: any) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors" data-testid={`invoice-item-${invoice.id}`}>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <DollarSign className="text-primary" size={14} />
                        </div>
                        <div>
                          <p className="font-medium text-foreground" data-testid={`invoice-number-${invoice.id}`}>
                            {invoice.invoiceNumber}
                          </p>
                          <p className="text-sm text-muted-foreground" data-testid={`invoice-customer-${invoice.id}`}>
                            Customer #{invoice.customerId}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground" data-testid={`invoice-total-${invoice.id}`}>
                          ${invoice.total}
                        </p>
                        <Badge className={INVOICE_STATUS_COLORS[invoice.status as keyof typeof INVOICE_STATUS_COLORS]} data-testid={`invoice-status-${invoice.id}`}>
                          {invoice.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">No invoices yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Create your first invoice to get started.</p>
                    <Button className="mt-4" onClick={() => setShowInvoiceForm(true)} data-testid="button-create-first-invoice">
                      <Plus className="mr-2" size={16} />
                      Create Invoice
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Schemes & Inventory */}
        <div className="space-y-8">
          
          {/* Product Schemes */}
          <Card data-testid="product-schemes-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Gift className="mr-2 text-accent" size={18} />
                  Product Schemes
                </CardTitle>
                <Button 
                  size="sm" 
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => setShowSchemeModal(true)}
                  data-testid="button-new-scheme"
                >
                  <Plus className="mr-1" size={14} />
                  New Scheme
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {schemes?.length ? (
                  schemes.slice(0, 3).map((scheme: any) => (
                    <div key={scheme.id} className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors" data-testid={`scheme-item-${scheme.id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-foreground" data-testid={`scheme-name-${scheme.id}`}>
                          {scheme.name}
                        </h3>
                        <Badge className={scheme.isActive ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"} data-testid={`scheme-status-${scheme.id}`}>
                          {scheme.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3" data-testid={`scheme-description-${scheme.id}`}>
                        {scheme.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-accent font-medium" data-testid={`scheme-rule-${scheme.id}`}>
                          Buy {scheme.buyQuantity} Get {scheme.freeQuantity} Free
                        </span>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" data-testid={`button-edit-scheme-${scheme.id}`}>
                            <span className="sr-only">Edit</span>
                            ✏️
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" data-testid={`button-delete-scheme-${scheme.id}`}>
                            <span className="sr-only">Delete</span>
                            🗑️
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Gift className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">No schemes yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Create product schemes to boost sales.</p>
                    <Button className="mt-4" variant="outline" onClick={() => setShowSchemeModal(true)} data-testid="button-create-first-scheme">
                      <Plus className="mr-2" size={16} />
                      Create Scheme
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Inventory Overview */}
          <Card data-testid="inventory-overview-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Warehouse className="mr-2 text-chart-3" size={18} />
                  Inventory Overview
                </CardTitle>
                <Button 
                  variant="link" 
                  size="sm"
                  onClick={() => setShowInventoryModal(true)}
                  data-testid="button-manage-inventory"
                >
                  Manage
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {products?.length ? (
                  products.slice(0, 3).map((product: any) => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg" data-testid={`inventory-item-${product.id}`}>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-chart-1 to-chart-2 rounded-lg flex items-center justify-center">
                          <Package className="text-white" size={16} />
                        </div>
                        <div>
                          <p className="font-medium text-foreground" data-testid={`product-name-${product.id}`}>
                            {product.name}
                          </p>
                          <p className="text-sm text-muted-foreground" data-testid={`product-category-${product.id}`}>
                            {product.category}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground" data-testid={`product-price-${product.id}`}>
                          ${product.basePrice}
                        </p>
                        <p className="text-xs text-accent" data-testid={`product-stock-status-${product.id}`}>
                          In Stock
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">No products yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Add products to track inventory.</p>
                  </div>
                )}
              </div>
              
              <Button 
                className="w-full mt-4" 
                variant="secondary"
                onClick={() => setShowInventoryModal(true)}
                data-testid="button-view-inventory-report"
              >
                <Warehouse className="mr-2" size={16} />
                View Inventory Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {showInvoiceForm && (
        <InvoiceForm 
          onClose={() => setShowInvoiceForm(false)} 
          onSuccess={() => setShowInvoiceForm(false)}
        />
      )}
      
      {showSchemeModal && (
        <SchemeModal 
          onClose={() => setShowSchemeModal(false)}
          onSuccess={() => setShowSchemeModal(false)}
        />
      )}
      
      {showInventoryModal && (
        <InventoryModal 
          onClose={() => setShowInventoryModal(false)}
        />
      )}
    </div>
  );
}
