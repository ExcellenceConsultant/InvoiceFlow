import { useState, useRef } from "react";
import { Plus, User, Building, Users, FileText, Package, Download, Upload, Edit, Trash2, Power, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_USER_ID } from "@/lib/constants";
import CustomerVendorForm from "@/components/customer-vendor-form";
import { usePermissions } from "@/hooks/usePermissions";

export default function Accounts() {
  const permissions = usePermissions();
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch(`/api/customers?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
    refetchOnMount: "always",
  });

  const { data: invoices } = useQuery({
    queryKey: ["/api/invoices"],
    queryFn: async () => {
      const response = await fetch(`/api/invoices?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch invoices");
      return response.json();
    },
  });

  // Fetch all line items for calculating quantities
  const { data: allLineItems } = useQuery({
    queryKey: ["/api/invoices/line-items"],
    queryFn: async () => {
      const invoiceList = invoices || [];
      if (invoiceList.length === 0) return [];
      
      const lineItemsPromises = invoiceList.map((inv: any) =>
        fetch(`/api/invoices/${inv.id}/line-items`)
          .then(res => res.ok ? res.json() : [])
          .catch(() => [])
      );
      
      const lineItemsArrays = await Promise.all(lineItemsPromises);
      return lineItemsArrays.flat();
    },
    enabled: !!invoices && invoices.length > 0,
  });

  // Filter customers and vendors by type
  const customerList = (customers || []).filter((c: any) => c.type === "customer");
  const vendorList = (customers || []).filter((c: any) => c.type === "vendor");

  // Calculate customer stats
  const customerInvoices = (invoices || []).filter((inv: any) => inv.invoiceType === "receivable");
  const customerInvoiceCount = customerInvoices.length;
  const customerInvoiceValue = customerInvoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.total || 0), 0);
  const activeCustomers = customerList.filter((c: any) => c.isActive !== false).length;

  // Calculate total quantity sold (from customer/AR invoices)
  const customerInvoiceIds = customerInvoices.map((inv: any) => inv.id);
  const customerLineItems = (allLineItems || []).filter((item: any) => customerInvoiceIds.includes(item.invoiceId));
  const totalQtySold = customerLineItems.reduce((sum: number, item: any) => sum + parseInt(item.quantity || 0), 0);

  // Calculate vendor stats
  const vendorInvoices = (invoices || []).filter((inv: any) => inv.invoiceType === "payable");
  const vendorInvoiceCount = vendorInvoices.length;
  const vendorInvoiceValue = vendorInvoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.total || 0), 0);
  const activeVendors = vendorList.filter((v: any) => v.isActive !== false).length;

  // Calculate total quantity purchased (from vendor/AP invoices)
  const vendorInvoiceIds = vendorInvoices.map((inv: any) => inv.id);
  const vendorLineItems = (allLineItems || []).filter((item: any) => vendorInvoiceIds.includes(item.invoiceId));
  const totalQtyPurchased = vendorLineItems.reduce((sum: number, item: any) => sum + parseInt(item.quantity || 0), 0);

  // Helper function to get open balance total value for a customer/vendor
  const getOpenBalanceValue = (customerId: string, type: "customer" | "vendor") => {
    const relevantInvoices = (invoices || []).filter((inv: any) => 
      inv.customerId === customerId && 
      inv.invoiceType === (type === "customer" ? "receivable" : "payable") &&
      inv.status !== "paid"
    );
    const totalValue = relevantInvoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.total || 0), 0);
    return totalValue;
  };

  // Export handler
  const handleExport = async () => {
    try {
      const response = await fetch(`/api/customers/export?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "accounts.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: "Accounts exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export accounts",
        variant: "destructive",
      });
    }
  };

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", DEFAULT_USER_ID);
      
      const response = await fetch("/api/customers/import", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Import failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Import Complete",
        description: data.message,
      });
      if (data.errors && data.errors.length > 0) {
        console.log("Import errors:", data.errors);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import accounts",
        variant: "destructive",
      });
    },
  });

  // Import handler
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importMutation.mutate(file);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/customers/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Delete failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Success",
        description: "Account deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete account",
        variant: "destructive",
      });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!response.ok) throw new Error("Update failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Success",
        description: "Account status updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update account status",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setShowCustomerForm(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    toggleActiveMutation.mutate({ id, isActive });
  };

  const handleCloseForm = () => {
    setShowCustomerForm(false);
    setShowVendorForm(false);
    setEditingCustomer(null);
  };

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const promises = ids.map(id => 
        fetch(`/api/customers/${id}`, { method: "DELETE" })
      );
      const results = await Promise.allSettled(promises);
      const failed = results.filter(r => r.status === "rejected").length;
      if (failed > 0) {
        throw new Error(`Failed to delete ${failed} account(s)`);
      }
      return results;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setSelectedCustomers([]);
      setSelectedVendors([]);
      toast({
        title: "Success",
        description: `${ids.length} account(s) deleted successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete some accounts",
        variant: "destructive",
      });
    },
  });

  // Customer selection handlers
  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSelectAllCustomers = () => {
    if (selectedCustomers.length === customerList.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customerList.map((c: any) => c.id));
    }
  };

  const handleBulkDeleteCustomers = () => {
    if (selectedCustomers.length === 0) return;
    const confirmMessage = `Are you sure you want to delete ${selectedCustomers.length} customer(s)? This action cannot be undone.`;
    if (confirm(confirmMessage)) {
      bulkDeleteMutation.mutate(selectedCustomers);
    }
  };

  // Vendor selection handlers
  const handleSelectVendor = (vendorId: string) => {
    setSelectedVendors(prev => 
      prev.includes(vendorId) 
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  const handleSelectAllVendors = () => {
    if (selectedVendors.length === vendorList.length) {
      setSelectedVendors([]);
    } else {
      setSelectedVendors(vendorList.map((v: any) => v.id));
    }
  };

  const handleBulkDeleteVendors = () => {
    if (selectedVendors.length === 0) return;
    const confirmMessage = `Are you sure you want to delete ${selectedVendors.length} vendor(s)? This action cannot be undone.`;
    if (confirm(confirmMessage)) {
      bulkDeleteMutation.mutate(selectedVendors);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">Accounts</h1>
            <p className="text-muted-foreground mt-1">Manage customers, vendors, and account information</p>
          </div>
          
          <div className="flex items-center space-x-3 mt-4 lg:mt-0">
            <Button 
              variant="secondary" 
              onClick={handleExport}
              data-testid="button-export-accounts"
            >
              <Download className="mr-2" size={16} />
              Export
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending || !permissions.canManageCustomers}
              data-testid="button-import-accounts"
            >
              <Upload className="mr-2" size={16} />
              {importMutation.isPending ? "Importing..." : "Import"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              style={{ display: "none" }}
              data-testid="input-import-file"
            />
            <Button 
              variant="outline" 
              onClick={() => setShowCustomerForm(true)}
              disabled={!permissions.canManageCustomers}
              data-testid="button-create-customer"
            >
              <User className="mr-2" size={16} />
              Add Customer
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowVendorForm(true)}
              disabled={!permissions.canManageCustomers}
              data-testid="button-create-vendor"
            >
              <Building className="mr-2" size={16} />
              Add Vendor
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="customers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="customers" data-testid="tab-customers">
            <User className="mr-2" size={16} />
            Customers
          </TabsTrigger>
          <TabsTrigger value="vendors" data-testid="tab-vendors">
            <Building className="mr-2" size={16} />
            Vendors
          </TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6">
          <Card data-testid="customers-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Users className="mr-2 text-primary" size={20} />
                  Customers ({customerList.length})
                </CardTitle>
                {selectedCustomers.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedCustomers.length} selected
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setSelectedCustomers([])}
                      data-testid="button-clear-customer-selection"
                      title="Clear selection"
                    >
                      <X size={14} />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleBulkDeleteCustomers}
                      disabled={bulkDeleteMutation.isPending}
                      data-testid="button-bulk-delete-customers"
                    >
                      <Trash2 className="mr-2" size={14} />
                      Delete Selected
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {customersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted/30 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : customerList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-3 px-4 text-sm font-medium text-muted-foreground w-12">
                          <input 
                            type="checkbox"
                            checked={customerList.length > 0 && selectedCustomers.length === customerList.length}
                            onChange={handleSelectAllCustomers}
                            className="w-4 h-4 cursor-pointer"
                            data-testid="checkbox-select-all-customers"
                          />
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Phone</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Open Balance</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerList.map((customer: any) => (
                        <tr 
                          key={customer.id} 
                          className="border-b border-border hover:bg-muted/20 transition-colors"
                          data-testid={`customer-row-${customer.id}`}
                        >
                          <td className="py-3 px-4">
                            <input 
                              type="checkbox"
                              checked={selectedCustomers.includes(customer.id)}
                              onChange={() => handleSelectCustomer(customer.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 cursor-pointer"
                              data-testid={`checkbox-customer-${customer.id}`}
                            />
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-foreground">
                            {customer.name}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {customer.email || "N/A"}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {customer.phone || "N/A"}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              customer.isActive !== false 
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" 
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
                            }`}>
                              {customer.isActive !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-foreground" data-testid={`open-balance-customer-${customer.id}`}>
                            ${getOpenBalanceValue(customer.id, "customer").toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => handleEdit(customer)}
                                disabled={!permissions.canManageCustomers}
                                data-testid={`button-edit-customer-${customer.id}`}
                                title="Edit"
                              >
                                <Edit size={14} />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className={`h-8 w-8 p-0 ${
                                  customer.isActive !== false ? "text-orange-600" : "text-green-600"
                                }`}
                                onClick={() => handleToggleActive(customer.id, customer.isActive !== false)}
                                disabled={toggleActiveMutation.isPending || !permissions.canManageCustomers}
                                data-testid={`button-toggle-active-customer-${customer.id}`}
                                title={customer.isActive !== false ? "Mark as Inactive" : "Mark as Active"}
                              >
                                <Power size={14} />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(customer.id, customer.name)}
                                disabled={deleteMutation.isPending || !permissions.canManageCustomers}
                                data-testid={`button-delete-customer-${customer.id}`}
                                title="Delete"
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
                  <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-2 text-sm font-medium text-foreground">No customers found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create your first customer to get started.
                  </p>
                  <Button className="mt-4" onClick={() => setShowCustomerForm(true)} data-testid="button-create-first-customer">
                    <Plus className="mr-2" size={16} />
                    Add Customer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Data Sections for Customers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card data-testid="customer-dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Users className="mr-2 text-primary" size={18} />
                  Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Total Customers</p>
                    <p className="text-xl font-bold" data-testid="total-customers">{customerList.length}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Active Customers</p>
                    <p className="text-lg font-semibold text-accent" data-testid="active-customers">{activeCustomers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="customer-invoices-card">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <FileText className="mr-2 text-primary" size={18} />
                  Invoices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Total AR Invoices</p>
                    <p className="text-xl font-bold" data-testid="customer-invoice-count">{customerInvoiceCount}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="text-lg font-semibold text-chart-1" data-testid="customer-invoice-value">${customerInvoiceValue.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="customer-inventory-card">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Package className="mr-2 text-primary" size={18} />
                  Inventory
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Products Sold</p>
                    <p className="text-xl font-bold" data-testid="customer-products-sold">{totalQtySold}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Revenue Generated</p>
                    <p className="text-lg font-semibold text-chart-3" data-testid="customer-revenue">${customerInvoiceValue.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors" className="space-y-6">
          <Card data-testid="vendors-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Building className="mr-2 text-primary" size={20} />
                  Vendors ({vendorList.length})
                </CardTitle>
                {selectedVendors.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedVendors.length} selected
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setSelectedVendors([])}
                      data-testid="button-clear-vendor-selection"
                      title="Clear selection"
                    >
                      <X size={14} />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleBulkDeleteVendors}
                      disabled={bulkDeleteMutation.isPending}
                      data-testid="button-bulk-delete-vendors"
                    >
                      <Trash2 className="mr-2" size={14} />
                      Delete Selected
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {customersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted/30 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : vendorList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-3 px-4 text-sm font-medium text-muted-foreground w-12">
                          <input 
                            type="checkbox"
                            checked={vendorList.length > 0 && selectedVendors.length === vendorList.length}
                            onChange={handleSelectAllVendors}
                            className="w-4 h-4 cursor-pointer"
                            data-testid="checkbox-select-all-vendors"
                          />
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Phone</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Open Balance</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorList.map((vendor: any) => (
                        <tr 
                          key={vendor.id} 
                          className="border-b border-border hover:bg-muted/20 transition-colors"
                          data-testid={`vendor-row-${vendor.id}`}
                        >
                          <td className="py-3 px-4">
                            <input 
                              type="checkbox"
                              checked={selectedVendors.includes(vendor.id)}
                              onChange={() => handleSelectVendor(vendor.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 cursor-pointer"
                              data-testid={`checkbox-vendor-${vendor.id}`}
                            />
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-foreground">
                            {vendor.name}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {vendor.email || "N/A"}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {vendor.phone || "N/A"}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              vendor.isActive !== false 
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" 
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
                            }`}>
                              {vendor.isActive !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-foreground" data-testid={`open-balance-vendor-${vendor.id}`}>
                            ${getOpenBalanceValue(vendor.id, "vendor").toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => handleEdit(vendor)}
                                disabled={!permissions.canManageCustomers}
                                data-testid={`button-edit-vendor-${vendor.id}`}
                                title="Edit"
                              >
                                <Edit size={14} />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className={`h-8 w-8 p-0 ${
                                  vendor.isActive !== false ? "text-orange-600" : "text-green-600"
                                }`}
                                onClick={() => handleToggleActive(vendor.id, vendor.isActive !== false)}
                                disabled={toggleActiveMutation.isPending || !permissions.canManageCustomers}
                                data-testid={`button-toggle-active-vendor-${vendor.id}`}
                                title={vendor.isActive !== false ? "Mark as Inactive" : "Mark as Active"}
                              >
                                <Power size={14} />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(vendor.id, vendor.name)}
                                disabled={deleteMutation.isPending || !permissions.canManageCustomers}
                                data-testid={`button-delete-vendor-${vendor.id}`}
                                title="Delete"
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
                  <Building className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-2 text-sm font-medium text-foreground">No vendors found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create your first vendor to get started.
                  </p>
                  <Button className="mt-4" onClick={() => setShowVendorForm(true)} data-testid="button-create-first-vendor">
                    <Plus className="mr-2" size={16} />
                    Add Vendor
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Data Sections for Vendors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card data-testid="vendor-dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Building className="mr-2 text-primary" size={18} />
                  Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Total Vendors</p>
                    <p className="text-xl font-bold" data-testid="total-vendors">{vendorList.length}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Active Vendors</p>
                    <p className="text-lg font-semibold text-accent" data-testid="active-vendors">{activeVendors}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="vendor-invoices-card">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <FileText className="mr-2 text-primary" size={18} />
                  Invoices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Total AP Invoices</p>
                    <p className="text-xl font-bold" data-testid="vendor-invoice-count">{vendorInvoiceCount}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="text-lg font-semibold text-chart-1" data-testid="vendor-invoice-value">${vendorInvoiceValue.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="vendor-inventory-card">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Package className="mr-2 text-primary" size={18} />
                  Inventory
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Products Purchased</p>
                    <p className="text-xl font-bold" data-testid="vendor-products-purchased">{totalQtyPurchased}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Total Spent</p>
                    <p className="text-lg font-semibold text-chart-3" data-testid="vendor-spent">${vendorInvoiceValue.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Customer Form Modal */}
      {showCustomerForm && (
        <CustomerVendorForm 
          type="customer"
          customer={editingCustomer}
          onClose={handleCloseForm} 
          onSuccess={handleCloseForm}
        />
      )}

      {/* Vendor Form Modal */}
      {showVendorForm && (
        <CustomerVendorForm 
          type="vendor"
          customer={editingCustomer}
          onClose={handleCloseForm} 
          onSuccess={handleCloseForm}
        />
      )}
    </div>
  );
}
