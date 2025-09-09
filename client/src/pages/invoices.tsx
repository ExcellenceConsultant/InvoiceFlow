import { useState } from "react";
import { Plus, Search, Filter, Eye, Edit, Trash2, Send, FileText, Download, Upload, User, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { DEFAULT_USER_ID, INVOICE_STATUS_COLORS, INVOICE_STATUSES } from "@/lib/constants";
import InvoiceForm from "@/components/invoice-form";
import CustomerVendorForm from "@/components/customer-vendor-form";

export default function Invoices() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["/api/invoices"],
    queryFn: async () => {
      const response = await fetch(`/api/invoices?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch invoices");
      return response.json();
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch(`/api/customers?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
  });

  const syncToQuickBooksMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("POST", `/api/invoices/${invoiceId}/sync-quickbooks`, {});
      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Journal Entry Posted",
        description: "Invoice journal entry created in QuickBooks (Debit AR, Credit Sales)",
      });
    },
    onError: (error: any) => {
      console.error("Invoice sync error:", error);
      
      const showDetails = () => {
        const errorData = error.response?.data || error;
        if (errorData.errorDetails) {
          alert(`QuickBooks Error Details:
          
Code: ${errorData.errorDetails.code}
Detail: ${errorData.errorDetails.detail}
          
Account IDs Used:
- Accounts Receivable: ${errorData.errorDetails.accountIds.accountsReceivable}
- Sales: ${errorData.errorDetails.accountIds.sales}

This shows exactly what data was sent to QuickBooks and which accounts were used.`);
        } else {
          alert(`Error: ${errorData.message || error.message}\n\nNo detailed error information available.`);
        }
      };

      const errorData = error.response?.data || error;
      toast({
        title: "Journal Entry Failed",
        description: (
          <div>
            <p>{errorData.message || "Failed to create journal entry in QuickBooks"}</p>
            <button 
              onClick={showDetails}
              className="mt-2 text-xs underline text-blue-400 hover:text-blue-300"
            >
              Show Error Details
            </button>
          </div>
        ),
        variant: "destructive",
      });
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
      toast({
        title: "Success",
        description: "Customer synced to QuickBooks successfully",
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
      toast({
        title: "Success", 
        description: "Product synced to QuickBooks successfully",
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

  const bulkSyncMutation = useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      const promises = invoiceIds.map(id => 
        apiRequest("POST", `/api/invoices/${id}/sync-quickbooks`, {}).then(r => r.json())
      );
      return Promise.all(promises);
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      const successCount = results.filter(r => r.success).length;
      toast({
        title: "Journal Entries Posted",
        description: `${successCount} invoice journal entries created in QuickBooks`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Some invoices failed to sync to QuickBooks",
        variant: "destructive",
      });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("DELETE", `/api/invoices/${invoiceId}`, {});
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete invoice");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete invoice",
        variant: "destructive",
      });
    },
  });

  const filteredInvoices = invoices?.filter((invoice: any) => {
    const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const getCustomerName = (customerId: string) => {
    const customer = customers?.find((c: any) => c.id === customerId);
    return customer?.name || "Unknown Customer";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleSyncToQuickBooks = (invoiceId: string, event?: React.MouseEvent) => {
    // Prevent event propagation to avoid triggering bulk sync
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    console.log('Syncing individual invoice:', invoiceId);
    syncToQuickBooksMutation.mutate(invoiceId);
  };

  const handleBulkSync = () => {
    const unsyncedInvoices = filteredInvoices.filter((invoice: any) => !invoice.quickbooksInvoiceId);
    if (unsyncedInvoices.length === 0) {
      toast({
        title: "No Action Needed",
        description: "All invoices are already synced to QuickBooks",
      });
      return;
    }
    
    const invoiceIds = unsyncedInvoices.map((invoice: any) => invoice.id);
    bulkSyncMutation.mutate(invoiceIds);
  };

  const handleDeleteInvoice = (invoiceId: string, event?: React.MouseEvent) => {
    // Prevent event propagation
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) {
      deleteInvoiceMutation.mutate(invoiceId);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">Invoices</h1>
            <p className="text-muted-foreground mt-1">Manage and track all your invoices</p>
          </div>
          
          <div className="flex items-center space-x-3 mt-4 lg:mt-0">
            <Button variant="secondary" data-testid="button-export-invoices">
              <Download className="mr-2" size={16} />
              Export
            </Button>
            <Button 
              variant="outline" 
              onClick={handleBulkSync}
              disabled={bulkSyncMutation.isPending}
              data-testid="button-bulk-sync-quickbooks"
              title="Create journal entries in QuickBooks for all invoices (Debit AR, Credit Sales)"
            >
              <Upload className="mr-2" size={16} />
              {bulkSyncMutation.isPending ? "Creating Journal Entries..." : "Post Journal Entries to QB"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowCustomerForm(true)} 
              data-testid="button-create-customer"
            >
              <User className="mr-2" size={16} />
              Add Customer
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowVendorForm(true)} 
              data-testid="button-create-vendor"
            >
              <Building className="mr-2" size={16} />
              Add Vendor
            </Button>
            <Button onClick={() => setShowInvoiceForm(true)} data-testid="button-create-invoice">
              <Plus className="mr-2" size={16} />
              Create Invoice
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6" data-testid="invoice-filters-card">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-invoices"
                />
              </div>
            </div>
            
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value={INVOICE_STATUSES.DRAFT}>Draft</SelectItem>
                  <SelectItem value={INVOICE_STATUSES.SENT}>Sent</SelectItem>
                  <SelectItem value={INVOICE_STATUSES.PAID}>Paid</SelectItem>
                  <SelectItem value={INVOICE_STATUSES.OVERDUE}>Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <Card data-testid="invoices-list-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="mr-2 text-primary" size={20} />
            Invoices ({filteredInvoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 bg-muted/30 rounded-lg animate-pulse" data-testid={`invoice-skeleton-${i}`} />
              ))}
            </div>
          ) : filteredInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="invoices-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Invoice #</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Customer</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Journal Entry</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice: any) => (
                    <tr 
                      key={invoice.id} 
                      className="border-b border-border hover:bg-muted/20 transition-colors"
                      data-testid={`invoice-row-${invoice.id}`}
                    >
                      <td className="py-3 px-4 text-sm font-medium text-foreground" data-testid={`invoice-number-${invoice.id}`}>
                        {invoice.invoiceNumber}
                      </td>
                      <td className="py-3 px-4" data-testid={`invoice-type-${invoice.id}`}>
                        <Badge 
                          className={invoice.invoiceType === "payable" 
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100" 
                            : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                          }
                        >
                          <div className="flex items-center">
                            <div 
                              className={`w-2 h-2 rounded-full mr-2 ${
                                invoice.invoiceType === "payable" ? "bg-orange-500" : "bg-green-500"
                              }`}
                            ></div>
                            {invoice.invoiceType === "payable" ? "AP" : "AR"}
                          </div>
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground" data-testid={`invoice-customer-${invoice.id}`}>
                        {getCustomerName(invoice.customerId)}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`invoice-date-${invoice.id}`}>
                        {formatDate(invoice.invoiceDate)}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-foreground" data-testid={`invoice-amount-${invoice.id}`}>
                        ${parseFloat(invoice.total).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge 
                          className={INVOICE_STATUS_COLORS[invoice.status as keyof typeof INVOICE_STATUS_COLORS]}
                          data-testid={`invoice-status-${invoice.id}`}
                        >
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {invoice.quickbooksInvoiceId ? (
                          <Badge className="bg-accent text-accent-foreground" data-testid={`quickbooks-synced-${invoice.id}`}>
                            Journal Entry Posted
                          </Badge>
                        ) : (
                          <Badge variant="outline" data-testid={`quickbooks-not-synced-${invoice.id}`}>
                            No Journal Entry
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => setLocation(`/invoices/${invoice.id}`)}
                            data-testid={`button-view-invoice-${invoice.id}`}
                          >
                            <Eye size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            data-testid={`button-edit-invoice-${invoice.id}`}
                          >
                            <Edit size={14} />
                          </Button>
                          {!invoice.quickbooksInvoiceId && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-primary hover:text-primary"
                              onClick={(e) => handleSyncToQuickBooks(invoice.id, e)}
                              disabled={syncToQuickBooksMutation.isPending}
                              data-testid={`button-sync-quickbooks-${invoice.id}`}
                              title="Post journal entry to QuickBooks (Debit AR, Credit Sales)"
                            >
                              <Send size={14} />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => handleDeleteInvoice(invoice.id, e)}
                            disabled={deleteInvoiceMutation.isPending}
                            data-testid={`button-delete-invoice-${invoice.id}`}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No invoices found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || statusFilter !== "all" 
                  ? "Try adjusting your search or filter criteria." 
                  : "Create your first invoice to get started."
                }
              </p>
              <Button className="mt-4" onClick={() => setShowInvoiceForm(true)} data-testid="button-create-first-invoice">
                <Plus className="mr-2" size={16} />
                Create Invoice
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Form Modal */}
      {showInvoiceForm && (
        <InvoiceForm 
          onClose={() => setShowInvoiceForm(false)} 
          onSuccess={() => setShowInvoiceForm(false)}
        />
      )}

      {/* Customer Form Modal */}
      {showCustomerForm && (
        <CustomerVendorForm 
          type="customer"
          onClose={() => setShowCustomerForm(false)} 
          onSuccess={() => setShowCustomerForm(false)}
        />
      )}

      {/* Vendor Form Modal */}
      {showVendorForm && (
        <CustomerVendorForm 
          type="vendor"
          onClose={() => setShowVendorForm(false)} 
          onSuccess={() => setShowVendorForm(false)}
        />
      )}
    </div>
  );
}
