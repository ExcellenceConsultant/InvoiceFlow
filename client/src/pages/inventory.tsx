import React, { useState, useRef } from "react";
import { Plus, Search, Package, Edit, Trash2, AlertTriangle, TrendingUp, BarChart3, Upload, ChevronLeft, ChevronRight, FileDown, FileUp, DollarSign } from "lucide-react";
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { ProductForm } from "@/components/product-form";

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete product');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.refetchQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Cannot delete product", 
        description: "Product is used in existing invoices and cannot be deleted",
        variant: "destructive" 
      });
    },
  });

  const deleteSelectedMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      const responses = await Promise.all(productIds.map(id => 
        fetch(`/api/products/${id}`, { method: 'DELETE' })
      ));
      const failedDeletes = responses.filter(response => !response.ok);
      if (failedDeletes.length > 0) {
        throw new Error(`${failedDeletes.length} products could not be deleted`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.refetchQueries({ queryKey: ["/api/products"] });
      setSelectedProducts([]);
      toast({ title: "Selected products deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Cannot delete some products", 
        description: "Some products are used in existing invoices and cannot be deleted",
        variant: "destructive" 
      });
    },
  });

  const handleDeleteProduct = (productId: string) => {
    deleteMutation.mutate(productId);
  };

  const handleDeleteSelected = () => {
    if (selectedProducts.length > 0) {
      deleteSelectedMutation.mutate(selectedProducts);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      let errorCount = 0;

      for (const row of jsonData) {
        try {
          const product = {
            name: (row as any)['Product Name'] || '',
            description: '',
            basePrice: parseFloat((row as any)['Base Price'] || '0'),
            category: (row as any)['Category'] || 'Uncategorized',
            itemCode: (row as any)['Item Code'] || '',
            qty: parseInt((row as any)['Qty'] || '0'),
            date: (row as any)['Date'] || new Date().toISOString().split('T')[0],
            packingType: (row as any)['Packing Size'] || null,
            grossWeightKgs: (row as any)['Gross Weight(LBS)'] ? parseFloat((row as any)['Gross Weight(LBS)']) * 0.453592 : null,
            netWeightKgs: (row as any)['Net Weight(LBS)'] ? parseFloat((row as any)['Net Weight(LBS)']) * 0.453592 : null,
            userId: DEFAULT_USER_ID
          };

          const response = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
          });
          
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (rowError) {
          errorCount++;
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      
      if (errorCount === 0) {
        toast({ title: `Successfully imported ${successCount} products` });
      } else {
        toast({ 
          title: `Import completed: ${successCount} success, ${errorCount} failed`,
          variant: errorCount > successCount ? "destructive" : "default"
        });
      }
    } catch (error) {
      toast({ title: "Failed to read Excel file", variant: "destructive" });
    }
    
    // Reset file input
    if (event.target) event.target.value = '';
  };

  const handleGenerateReport = async () => {
    try {
      const response = await fetch('/api/inventory/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: DEFAULT_USER_ID })
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (error) {
      toast({ title: "Failed to generate report", variant: "destructive" });
    }
  };

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const response = await fetch(`/api/products?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const isLoading = productsLoading;

  const filteredProducts = products?.filter((product: any) => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.itemCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  }) || [];

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, stockFilter]);

  // Clear selection when page changes
  React.useEffect(() => {
    setSelectedProducts([]);
  }, [currentPage]);

  // Calculate dashboard metrics
  const totalValue = filteredProducts.reduce((sum: number, product: any) => {
    return sum + ((product.qty || 0) * parseFloat(product.basePrice || 0));
  }, 0);
  const totalSKUs = filteredProducts.length;
  const totalQuantity = filteredProducts.reduce((sum: number, product: any) => {
    return sum + (product.qty || 0);
  }, 0);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(paginatedProducts.map((product: any) => product.id));
    } else {
      setSelectedProducts([]);
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, productId]);
    } else {
      setSelectedProducts(prev => prev.filter(id => id !== productId));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            Manage your product inventory
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleImport}
            data-testid="button-import"
          >
            <FileUp className="mr-2" size={16} />
            Import
          </Button>
          <Button
            variant="outline"
            onClick={handleGenerateReport}
            data-testid="button-generate-report"
          >
            <FileDown className="mr-2" size={16} />
            Generate Report
          </Button>
          <Button
            onClick={() => setShowProductForm(true)}
            data-testid="button-add-product"
          >
            <Plus className="mr-2" size={16} />
            Add Product
          </Button>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium text-muted-foreground">Total Value</div>
            </div>
            <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium text-muted-foreground">Total SKUs</div>
            </div>
            <div className="text-2xl font-bold">{totalSKUs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium text-muted-foreground">Total Quantity</div>
            </div>
            <div className="text-2xl font-bold">{totalQuantity}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {selectedProducts.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                  disabled={deleteSelectedMutation.isPending}
                  data-testid="button-delete-selected"
                >
                  <Trash2 className="mr-2" size={14} />
                  Delete Selected ({selectedProducts.length})
                </Button>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                  data-testid="input-search-products"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48" data-testid="select-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Electronics">Electronics</SelectItem>
                  <SelectItem value="Clothing">Clothing</SelectItem>
                  <SelectItem value="Food">Food</SelectItem>
                  <SelectItem value="Books">Books</SelectItem>
                  <SelectItem value="Home">Home</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" data-testid={`inventory-skeleton-${i}`} />
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="inventory-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground w-12">
                      <Checkbox
                        checked={paginatedProducts.length > 0 && paginatedProducts.every((product: any) => selectedProducts.includes(product.id))}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Product Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Item Code</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Category</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Qty</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Base Price</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product: any) => {
                    const isSelected = selectedProducts.includes(product.id);
                    return (
                      <tr 
                        key={product.id} 
                        className={`border-b border-border hover:bg-muted/20 transition-colors ${isSelected ? 'bg-muted/10' : ''}`}
                        data-testid={`inventory-row-${product.id}`}
                      >
                        <td className="py-3 px-4 text-sm text-foreground w-12">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                            data-testid={`checkbox-select-${product.id}`}
                          />
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground" data-testid={`product-name-${product.id}`}>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-xs text-muted-foreground">{product.description}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`product-date-${product.id}`}>
                          {product.date ? new Date(product.date).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm font-mono text-muted-foreground" data-testid={`product-item-code-${product.id}`}>
                          {product.itemCode || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`product-category-${product.id}`}>
                          <Badge variant="secondary" className="text-xs">
                            {product.category || 'Uncategorized'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`product-qty-${product.id}`}>
                          {product.qty || 0}
                        </td>
                        <td className="py-3 px-4 text-sm font-mono text-muted-foreground" data-testid={`product-price-${product.id}`}>
                          ${parseFloat(product.basePrice || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setEditingProduct(product);
                                setShowProductForm(true);
                              }}
                              data-testid={`button-edit-product-${product.id}`}
                            >
                              <Edit size={14} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteProduct(product.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-product-${product.id}`}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </Button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 p-0"
                          data-testid={`button-page-${pageNum}`}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
            </>
          ) : (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No inventory items found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || categoryFilter !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : "Add your first product to get started."
                }
              </p>
              <Button 
                className="mt-4" 
                onClick={() => {
                  setEditingProduct(null);
                  setShowProductForm(true);
                }}
                data-testid="button-add-first-product"
              >
                <Plus className="mr-2" size={16} />
                Add Product
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showProductForm && (
        <ProductForm
          product={editingProduct}
          onClose={() => {
            setShowProductForm(false);
            setEditingProduct(null);
          }}
        />
      )}
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
      />
    </div>
  );
}