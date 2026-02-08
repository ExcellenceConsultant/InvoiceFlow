import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { apiRequest } from "@/lib/queryClient";
import { RefreshCw, DollarSign, Save, Tag, Filter, X } from "lucide-react";
import type { Product, PriceRule } from "@shared/schema";

export default function PriceRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const canEdit = permissions.canManageProducts;

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [selectedInventoryCategories, setSelectedInventoryCategories] = useState<string[]>([]);

  const { data: categories = [], refetch: refetchCategories, isLoading: categoriesLoading } = useQuery<{ category: string; customerCount: number }[]>({
    queryKey: ["/api/customer-categories"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: priceRules = [], refetch: refetchPriceRules } = useQuery<PriceRule[]>({
    queryKey: ["/api/price-rules/category", selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const response = await fetch(`/api/price-rules/category/${encodeURIComponent(selectedCategory)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch price rules");
      return response.json();
    },
    enabled: !!selectedCategory,
  });

  const savePriceRuleMutation = useMutation({
    mutationFn: async ({ productId, customPrice }: { productId: string; customPrice: string }) => {
      const response = await apiRequest("POST", "/api/price-rules", {
        customerCategory: selectedCategory,
        productId,
        customPrice: parseFloat(customPrice),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-rules/category", selectedCategory] });
      toast({
        title: "Success",
        description: "Price rule saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save price rule",
        variant: "destructive",
      });
    },
  });

  const handleFetchCustomers = async () => {
    await refetchCategories();
    toast({
      title: "Success",
      description: "Customer categories refreshed",
    });
  };

  const inventoryCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedInventoryCategories.length === 0) return products;
    return products.filter((p) => p.category && selectedInventoryCategories.includes(p.category));
  }, [products, selectedInventoryCategories]);

  const toggleInventoryCategory = (cat: string) => {
    setSelectedInventoryCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const clearInventoryFilters = () => {
    setSelectedInventoryCategories([]);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setPriceInputs({});
  };

  const handlePriceChange = (productId: string, value: string) => {
    setPriceInputs((prev) => ({
      ...prev,
      [productId]: value,
    }));
  };

  const handleSavePrice = (productId: string) => {
    const price = priceInputs[productId];
    if (price && !isNaN(parseFloat(price))) {
      savePriceRuleMutation.mutate({ productId, customPrice: price });
    } else {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price",
        variant: "destructive",
      });
    }
  };

  const getExistingPrice = (productId: string): string => {
    const rule = priceRules.find((r) => r.productId === productId);
    return rule?.customPrice || "";
  };

  const getCurrentPrice = (productId: string): string => {
    if (priceInputs[productId] !== undefined) {
      return priceInputs[productId];
    }
    return getExistingPrice(productId);
  };

  return (
    <main className="flex-1 overflow-y-auto p-8" data-testid="price-rules-page">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center" data-testid="page-title">
            <DollarSign className="mr-2 text-primary" size={28} />
            Price Rules
          </h1>
          <p className="text-muted-foreground mt-2">
            Set custom product prices per customer category
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Tag className="mr-2 text-primary" size={20} />
              Customer Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button
                onClick={handleFetchCustomers}
                disabled={categoriesLoading}
                data-testid="button-fetch-customers"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${categoriesLoading ? "animate-spin" : ""}`} />
                Fetch Customers
              </Button>

              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-[300px]" data-testid="select-category">
                  <SelectValue placeholder="Select Customer Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.category} value={cat.category}>
                      {cat.category} ({cat.customerCount} customers)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {categories.length === 0 && (
              <p className="text-muted-foreground mt-4 text-sm">
                Click "Fetch Customers" to load customer categories. Categories are fetched from the Customer Category field in Customer records.
              </p>
            )}
          </CardContent>
        </Card>

        {selectedCategory && (
          <Card>
            <CardHeader>
              <CardTitle>
                Products - Category: {selectedCategory}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Filter by Inventory Category:</span>
                  {selectedInventoryCategories.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearInventoryFilters} className="h-6 px-2 text-xs">
                      <X className="h-3 w-3 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {inventoryCategories.map((cat) => (
                    <Badge
                      key={cat}
                      variant={selectedInventoryCategories.includes(cat) ? "default" : "outline"}
                      className="cursor-pointer select-none"
                      onClick={() => toggleInventoryCategory(cat)}
                    >
                      {cat}
                    </Badge>
                  ))}
                </div>
                {selectedInventoryCategories.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Showing {filteredProducts.length} of {products.length} products
                  </p>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Packing Size</TableHead>
                    <TableHead>Custom Price</TableHead>
                    {canEdit && <TableHead>Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono">{product.itemCode || "-"}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.category || "-"}</TableCell>
                      <TableCell>{product.packingSize || "-"}</TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={getCurrentPrice(product.id)}
                            onChange={(e) => handlePriceChange(product.id, e.target.value)}
                            placeholder="Enter price"
                            className="w-28"
                            data-testid={`input-price-${product.id}`}
                          />
                        ) : (
                          <span>${getExistingPrice(product.id) || "-"}</span>
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleSavePrice(product.id)}
                            disabled={savePriceRuleMutation.isPending || !priceInputs[product.id]}
                            data-testid={`button-save-${product.id}`}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredProducts.length === 0 && (
                <p className="text-muted-foreground text-center py-8">
                  {products.length === 0 ? "No products found in inventory." : "No products match the selected category filters."}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
