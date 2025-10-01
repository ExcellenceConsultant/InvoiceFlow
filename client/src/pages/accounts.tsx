import { useState, useRef } from "react";
import { Plus, User, Building, Users, FileText, Package, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_USER_ID } from "@/lib/constants";
import CustomerVendorForm from "@/components/customer-vendor-form";

export default function Accounts() {
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showVendorForm, setShowVendorForm] = useState(false);
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

  const customerList = customers?.filter((c: any) => c.type === "customer") || [];
  const vendorList = customers?.filter((c: any) => c.type === "vendor") || [];

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
              disabled={importMutation.isPending}
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
              <CardTitle className="flex items-center">
                <Users className="mr-2 text-primary" size={20} />
                Customers ({customerList.length})
              </CardTitle>
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
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Phone</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerList.map((customer: any) => (
                        <tr 
                          key={customer.id} 
                          className="border-b border-border hover:bg-muted/20 transition-colors"
                          data-testid={`customer-row-${customer.id}`}
                        >
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
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                              Active
                            </span>
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

          {/* Placeholder Sections for Customers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card data-testid="customer-dashboard-placeholder">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Users className="mr-2 text-primary" size={18} />
                  Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Customer analytics and insights will appear here.
                </p>
              </CardContent>
            </Card>

            <Card data-testid="customer-invoices-placeholder">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <FileText className="mr-2 text-primary" size={18} />
                  Invoices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Customer invoice history will appear here.
                </p>
              </CardContent>
            </Card>

            <Card data-testid="customer-inventory-placeholder">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Package className="mr-2 text-primary" size={18} />
                  Inventory
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Customer-specific inventory data will appear here.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors" className="space-y-6">
          <Card data-testid="vendors-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="mr-2 text-primary" size={20} />
                Vendors ({vendorList.length})
              </CardTitle>
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
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Phone</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorList.map((vendor: any) => (
                        <tr 
                          key={vendor.id} 
                          className="border-b border-border hover:bg-muted/20 transition-colors"
                          data-testid={`vendor-row-${vendor.id}`}
                        >
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
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                              Active
                            </span>
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

          {/* Placeholder Sections for Vendors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card data-testid="vendor-dashboard-placeholder">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Building className="mr-2 text-primary" size={18} />
                  Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Vendor analytics and insights will appear here.
                </p>
              </CardContent>
            </Card>

            <Card data-testid="vendor-invoices-placeholder">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <FileText className="mr-2 text-primary" size={18} />
                  Invoices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Vendor invoice history will appear here.
                </p>
              </CardContent>
            </Card>

            <Card data-testid="vendor-inventory-placeholder">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Package className="mr-2 text-primary" size={18} />
                  Inventory
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Vendor-specific inventory data will appear here.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

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
