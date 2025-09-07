import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  basePrice: z.number().min(0, "Price must be positive"),
  category: z.string().optional(),
  itemCode: z.string().optional(),
  packingType: z.string().optional(),
  grossWeightKgs: z.number().min(0, "Gross weight must be positive").optional(),
  netWeightKgs: z.number().min(0, "Net weight must be positive").optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  onClose: () => void;
  product?: any;
}

export function ProductForm({ onClose, product }: ProductFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      basePrice: product ? parseFloat(product.basePrice) : 0,
      category: product?.category || "",
      itemCode: product?.itemCode || "",
      packingType: product?.packingType || "",
      grossWeightKgs: product?.grossWeightKgs ? parseFloat(product.grossWeightKgs) : 0,
      netWeightKgs: product?.netWeightKgs ? parseFloat(product.netWeightKgs) : 0,
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const endpoint = product ? `/api/products/${product.id}` : '/api/products';
      const method = product ? 'PUT' : 'POST';
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          basePrice: data.basePrice.toString(),
          grossWeightKgs: data.grossWeightKgs?.toString() || null,
          netWeightKgs: data.netWeightKgs?.toString() || null,
        }),
      });
      if (!response.ok) throw new Error('Failed to save product');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Success",
        description: `Product ${product ? 'updated' : 'created'} successfully`,
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProductFormData) => {
    createProductMutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="product-form-modal">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center" data-testid="product-form-title">
              <Package className="mr-2 text-primary" size={20} />
              {product ? 'Edit Product' : 'Add New Product'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-product-form">
              <X size={20} />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter product name"
                    data-testid="input-product-name"
                    {...form.register("name")}
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    placeholder="Enter category"
                    data-testid="input-product-category"
                    {...form.register("category")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter product description"
                  data-testid="input-product-description"
                  {...form.register("description")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="basePrice">Base Price (USD) *</Label>
                <Input
                  id="basePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  data-testid="input-product-price"
                  {...form.register("basePrice", { valueAsNumber: true })}
                />
                {form.formState.errors.basePrice && (
                  <p className="text-sm text-red-500">{form.formState.errors.basePrice.message}</p>
                )}
              </div>
            </div>

            {/* Inventory Specifications */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center">
                <Sparkles className="mr-2 text-orange-500" size={18} />
                Inventory Specifications
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="itemCode">Item Code</Label>
                  <Input
                    id="itemCode"
                    placeholder="Enter item code"
                    data-testid="input-item-code"
                    {...form.register("itemCode")}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="packingType">Packing Type</Label>
                  <Input
                    id="packingType"
                    placeholder="Enter packing type"
                    data-testid="input-packing-type"
                    {...form.register("packingType")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grossWeightKgs">Gross Weight (KGS)</Label>
                  <Input
                    id="grossWeightKgs"
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0.000"
                    data-testid="input-gross-weight"
                    {...form.register("grossWeightKgs", { valueAsNumber: true })}
                  />
                  {form.formState.errors.grossWeightKgs && (
                    <p className="text-sm text-red-500">{form.formState.errors.grossWeightKgs.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="netWeightKgs">Net Weight (KGS)</Label>
                  <Input
                    id="netWeightKgs"
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0.000"
                    data-testid="input-net-weight"
                    {...form.register("netWeightKgs", { valueAsNumber: true })}
                  />
                  {form.formState.errors.netWeightKgs && (
                    <p className="text-sm text-red-500">{form.formState.errors.netWeightKgs.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-6">
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-product">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createProductMutation.isPending}
                data-testid="button-save-product"
              >
                {createProductMutation.isPending ? "Saving..." : (product ? "Update Product" : "Create Product")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}