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

  const { data: journalEntryCount } = useQuery({
    queryKey: ["/api/quickbooks/journal-entry-count"],
    queryFn: async () => {
      const response = await fetch(`/api/quickbooks/journal-entry-count?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch journal entry count");
      const data = await response.json();
      return data.count;
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
          quickbooksCompanyName: null,
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

      <div className="space-y-8">
          
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
                      {isQuickBooksConnected ? (user?.quickbooksCompanyName || "Connected") : "Not Connected"}
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
                  <p className="text-2xl font-bold text-accent" data-testid="quickbooks-journal-entry-sync">
                    {journalEntryCount !== undefined ? journalEntryCount : '...'}
                  </p>
                  <p className="text-sm text-muted-foreground">Journal Entry Sync</p>
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
