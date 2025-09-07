import { useState, useRef } from "react";
import { Plus, Search, Package, Edit, Trash2, AlertTriangle, TrendingUp, BarChart3, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const response = await fetch(`/api/products?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const isLoading = productsLoading;

  const getStockStatus = (variant: any) => {
    if (variant.stockQuantity <= 0) {
      return { 
        label: "Out of Stock", 
        className: "bg-destructive text-destructive-foreground",
        priority: 3 
      };
    } else if (variant.stockQuantity <= variant.lowStockThreshold) {
      return { 
        label: "Low Stock", 
        className: "bg-yellow-500 text-white",
        priority: 2 
      };
    } else {
      return { 
        label: "In Stock", 
        className: "bg-accent text-accent-foreground",
        priority: 1 
      };
    }
  };

  const filteredProducts = products?.filter((product: any) => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.itemCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  }) || [];

  // Calculate inventory stats
  const totalProducts = products?.length || 0;
  const totalValue = products?.reduce((sum: number, product: any) => 
    sum + parseFloat(product.basePrice || 0), 0) || 0;

  // Excel import mutation
  const importExcelMutation = useMutation({
    mutationFn: async (products: any[]) => {
      const promises = products.map(product =>
        apiRequest('POST', '/api/products', { ...product, userId: DEFAULT_USER_ID })
      );
      return Promise.all(promises);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Import Successful",
        description: `Successfully imported ${data.length} products`,
      });
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: "Failed to import products from Excel file",
        variant: "destructive",
      });
    },
  });

  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast({
            title: "Invalid File",
            description: "Excel file must contain header row and data rows",
            variant: "destructive",
          });
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const products = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          if (values.length >= 6) {
            // Expected format: Packing Type, Packaging Title, Qty, G.W., N.W., Item Code
            const product = {
              name: values[1] || 'Unnamed Product',
              basePrice: values[2] || '0.00',
              packingType: values[0] || null,
              grossWeightKgs: values[3] || null,
              netWeightKgs: values[4] || null,
              itemCode: values[5] || null,
              category: 'Imported',
              description: 'Imported from Excel',
            };
            products.push(product);
          }
        }

        if (products.length > 0) {
          importExcelMutation.mutate(products);
        } else {
          toast({
            title: "No Valid Data",
            description: "No valid products found in Excel file",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Parse Error",
          description: "Failed to parse Excel file. Please ensure it's a valid CSV format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    
    // Reset the file input
    event.target.value = '';
  };

  // Get unique categories
  const categories = Array.from(new Set(products?.map((p: any) => p.category).filter(Boolean))) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">Inventory Management</h1>
            <p className="text-muted-foreground mt-1">Track and manage your product inventory</p>
          </div>
          
          <div className="flex items-center space-x-3 mt-4 lg:mt-0">
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} data-testid="button-import-excel">
              <Upload className="mr-2" size={16} />
              Import Excel
            </Button>
            <Button variant="secondary" data-testid="button-inventory-report">
              <BarChart3 className="mr-2" size={16} />
              Generate Report
            </Button>
            <Button 
              onClick={() => {
                setEditingProduct(null);
                setShowProductForm(true);
              }}
              data-testid="button-add-product"
            >
              <Plus className="mr-2" size={16} />
              Add Product
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="stats-card" data-testid="stats-total-products">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Total Products</p>
                <p className="text-2xl font-bold text-foreground" data-testid="total-products-value">
                  {totalProducts}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Package className="text-primary" size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-muted-foreground">Active products</span>
            </div>
          </CardContent>
        </Card>

        <Card className="stats-card" data-testid="stats-inventory-value">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Inventory Value</p>
                <p className="text-2xl font-bold text-foreground" data-testid="inventory-value">
                  ${totalValue.toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-chart-1/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-chart-1" size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-accent font-medium">+8.2%</span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="stats-card" data-testid="stats-avg-price">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Average Price</p>
                <p className="text-2xl font-bold text-foreground" data-testid="avg-price">
                  ${totalProducts > 0 ? (totalValue / totalProducts).toFixed(2) : '0.00'}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <AlertTriangle className="text-yellow-500" size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-muted-foreground">Per product</span>
            </div>
          </CardContent>
        </Card>

        <Card className="stats-card" data-testid="stats-categories">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Categories</p>
                <p className="text-2xl font-bold text-foreground" data-testid="categories-count">
                  {categories.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-chart-3/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-chart-3" size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-muted-foreground">Active categories</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6" data-testid="inventory-filters-card">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Search products, variants, or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-inventory"
                />
              </div>
            </div>
            
            <div className="w-full md:w-48">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="select-category-filter">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {(categories as string[]).map((category: string) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-48">
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger data-testid="select-stock-filter">
                  <SelectValue placeholder="Filter by stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock Levels</SelectItem>
                  <SelectItem value="in">In Stock</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="out">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card data-testid="inventory-table-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="mr-2 text-chart-3" size={20} />
            Inventory Items ({filteredProducts.length})
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
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="inventory-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Product Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Item Code</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Packing Size</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Category</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Base Price</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Gross Weight</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Net Weight</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product: any) => {
                    return (
                      <tr 
                        key={product.id} 
                        className="border-b border-border hover:bg-muted/20 transition-colors"
                        data-testid={`inventory-row-${product.id}`}
                      >
                        <td className="py-3 px-4 text-sm text-foreground" data-testid={`product-name-${product.id}`}>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-xs text-muted-foreground">{product.description}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm font-mono text-muted-foreground" data-testid={`product-item-code-${product.id}`}>
                          {product.itemCode || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`product-packing-type-${product.id}`}>
                          {product.packingType || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`product-category-${product.id}`}>
                          {product.category || "Uncategorized"}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground" data-testid={`product-price-${product.id}`}>
                          ${parseFloat(product.basePrice || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`product-gross-weight-${product.id}`}>
                          {product.grossWeightKgs ? `${product.grossWeightKgs} kg` : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`product-net-weight-${product.id}`}>
                          {product.netWeightKgs ? `${product.netWeightKgs} kg` : '-'}
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

      {/* Hidden File Input for Excel Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleExcelImport}
        accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }}
      />

      {/* Product Form Modal */}
      {showProductForm && (
        <ProductForm
          product={editingProduct}
          onClose={() => {
            setShowProductForm(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}
