import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Gift, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

const schemeSchema = z.object({
  name: z.string().min(1, "Scheme name is required"),
  description: z.string().optional(),
  buyQuantity: z.number().min(1, "Buy quantity must be at least 1"),
  freeQuantity: z.number().min(1, "Free quantity must be at least 1"),
});

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  scheme?: any;
}

export default function SchemeModal({ onClose, onSuccess, scheme }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProducts, setSelectedProducts] = useState<string[]>(
    scheme?.productIds ?? (scheme?.productId ? [scheme.productId] : [])
  );
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const form = useForm<z.infer<typeof schemeSchema>>({
    resolver: zodResolver(schemeSchema),
    defaultValues: {
      name: scheme?.name || "",
      description: scheme?.description || "",
      buyQuantity: scheme?.buyQuantity || 1,
      freeQuantity: scheme?.freeQuantity || 1,
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

  const createSchemeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof schemeSchema>) => {
      const endpoint = scheme ? `/api/schemes/${scheme.id}` : "/api/schemes";
      const method = scheme ? "PATCH" : "POST";
      const response = await apiRequest(method, endpoint, {
        ...data,
        productIds: selectedProducts,
        userId: DEFAULT_USER_ID,
        isActive: scheme?.isActive ?? true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schemes"] });
      toast({
        title: "Success",
        description: `Product scheme ${scheme ? 'updated' : 'created'} successfully`,
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: `Failed to ${scheme ? 'update' : 'create'} product scheme`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof schemeSchema>) => {
    createSchemeMutation.mutate(data);
  };

  const handleAddProduct = () => {
    if (selectedProductId && !selectedProducts.includes(selectedProductId)) {
      setSelectedProducts([...selectedProducts, selectedProductId]);
      setSelectedProductId("");
    }
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(id => id !== productId));
  };

  const getProductName = (productId: string) => {
    const product = products?.find((p: any) => p.id === productId);
    return product?.name || productId;
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      data-testid="scheme-modal"
    >
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle
              className="flex items-center"
              data-testid="scheme-modal-title"
            >
              <Gift className="mr-2 text-accent" size={20} />
              {scheme ? 'Edit Product Scheme' : 'Create Product Scheme'}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="button-close-scheme-modal"
            >
              <X size={20} />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheme Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Holiday Special"
                        {...field}
                        data-testid="input-scheme-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Brief description of the scheme"
                        {...field}
                        data-testid="input-scheme-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="buyQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Buy Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="15"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                          data-testid="input-buy-quantity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="freeQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Get Free</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                          data-testid="input-free-quantity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <FormLabel>Products (Optional)</FormLabel>
                <div className="flex gap-2">
                  <Select
                    value={selectedProductId}
                    onValueChange={setSelectedProductId}
                  >
                    <SelectTrigger className="flex-1" data-testid="select-product">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product: any) => (
                        <SelectItem 
                          key={product.id} 
                          value={product.id}
                          data-testid={`product-option-${product.id}`}
                        >
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={handleAddProduct}
                    disabled={!selectedProductId}
                    data-testid="button-add-product-to-scheme"
                  >
                    <Plus size={16} />
                  </Button>
                </div>
                {selectedProducts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedProducts.map((productId) => (
                      <Badge
                        key={productId}
                        variant="secondary"
                        className="flex items-center gap-1"
                        data-testid={`selected-product-${productId}`}
                      >
                        {getProductName(productId)}
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(productId)}
                          className="ml-1 hover:text-destructive"
                          data-testid={`button-remove-product-${productId}`}
                        >
                          <X size={12} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createSchemeMutation.isPending}
                  data-testid="button-create-scheme"
                >
                  {createSchemeMutation.isPending
                    ? (scheme ? "Updating..." : "Creating...")
                    : (scheme ? "Update Scheme" : "Create Scheme")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  data-testid="button-cancel-scheme"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
