import { useState } from "react";
import { X, Package, Edit, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_USER_ID } from "@/lib/constants";

interface Props {
  onClose: () => void;
}

export default function InventoryModal({ onClose }: Props) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: products, isLoading } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const response = await fetch(`/api/products?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const { data: allVariants } = useQuery({
    queryKey: ["/api/product-variants"],
    queryFn: async () => {
      if (!products) return [];
      
      const allVariants = [];
      for (const product of products) {
        const response = await fetch(`/api/products/${product.id}/variants`);
        if (response.ok) {
          const variants = await response.json();
          allVariants.push(...variants.map((variant: any) => ({ ...variant, product })));
        }
      }
      return allVariants;
    },
    enabled: !!products,
  });

  const filteredVariants = allVariants?.filter((variant: any) =>
    variant.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    variant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    variant.sku.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getStockStatus = (variant: any) => {
    if (variant.stockQuantity <= 0) {
      return { label: "Out of Stock", className: "bg-destructive text-destructive-foreground" };
    } else if (variant.stockQuantity <= variant.lowStockThreshold) {
      return { label: "Low Stock", className: "bg-yellow-500 text-white" };
    } else {
      return { label: "In Stock", className: "bg-accent text-accent-foreground" };
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="inventory-modal">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center" data-testid="inventory-modal-title">
              <Package className="mr-2 text-chart-3" size={20} />
              Inventory Management
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-inventory-modal">
              <X size={20} />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="h-full overflow-y-auto">
          {/* Search and Actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1 max-w-md">
              <Input
                placeholder="Search products, variants, or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-inventory-search"
              />
            </div>
            <Button className="ml-4" data-testid="button-add-product">
              <Plus className="mr-2" size={16} />
              Add Product
            </Button>
          </div>

          {/* Inventory Table */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" data-testid={`inventory-skeleton-${i}`} />
              ))}
            </div>
          ) : filteredVariants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="inventory-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Product</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Variant</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">SKU</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Stock</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Price</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVariants.map((variant: any) => {
                    const stockStatus = getStockStatus(variant);
                    return (
                      <tr 
                        key={variant.id} 
                        className="border-b border-border hover:bg-muted/20 transition-colors"
                        data-testid={`inventory-row-${variant.id}`}
                      >
                        <td className="py-3 px-4 text-sm text-foreground" data-testid={`product-name-${variant.id}`}>
                          {variant.product.name}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`variant-name-${variant.id}`}>
                          {variant.name}
                        </td>
                        <td className="py-3 px-4 text-sm font-mono text-muted-foreground" data-testid={`variant-sku-${variant.id}`}>
                          {variant.sku}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-foreground" data-testid={`variant-stock-${variant.id}`}>
                          {variant.stockQuantity || 0}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground" data-testid={`variant-price-${variant.id}`}>
                          ${parseFloat(variant.price).toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={stockStatus.className} data-testid={`variant-status-${variant.id}`}>
                            {stockStatus.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              data-testid={`button-edit-variant-${variant.id}`}
                            >
                              <Edit size={14} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              data-testid={`button-delete-variant-${variant.id}`}
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
                {searchTerm ? "Try adjusting your search terms." : "Add your first product to get started."}
              </p>
              <Button className="mt-4" data-testid="button-add-first-product">
                <Plus className="mr-2" size={16} />
                Add Product
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
