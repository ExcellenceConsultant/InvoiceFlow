import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus, Trash2, NotebookPen, Save, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DEFAULT_USER_ID } from "@/lib/constants";

const invoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  dueDate: z.string().optional(),
  invoiceType: z.enum(["receivable", "payable"], {
    required_error: "Please select invoice type",
  }),
});

const lineItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  variantId: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
});

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function InvoiceForm({ onClose, onSuccess }: Props) {
  const [lineItems, setLineItems] = useState([
    { productId: "", variantId: "", description: "", quantity: 1, unitPrice: 0, lineTotal: 0 }
  ]);
  const [showSchemeItems, setShowSchemeItems] = useState<{ [key: number]: any[] }>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerId: "",
      invoiceNumber: `INV-${Date.now()}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: "",
      invoiceType: "receivable",
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

  const { data: products } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const response = await fetch(`/api/products?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
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

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/invoices", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Invoice created successfully",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    },
  });

  const syncToQuickBooksMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("POST", `/api/invoices/${invoiceId}/sync-quickbooks`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invoice synced to QuickBooks successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to sync invoice to QuickBooks",
        variant: "destructive",
      });
    },
  });

  const updateLineItem = (index: number, field: string, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Calculate line total
    if (field === 'quantity' || field === 'unitPrice') {
      updatedItems[index].lineTotal = updatedItems[index].quantity * updatedItems[index].unitPrice;
    }

    // Check for applicable schemes when product or quantity changes
    if ((field === 'productId' || field === 'quantity') && schemes) {
      const productId = updatedItems[index].productId;
      const quantity = updatedItems[index].quantity;
      
      const applicableScheme = schemes.find((scheme: any) => 
        scheme.productId === productId && 
        scheme.isActive && 
        quantity >= scheme.buyQuantity
      );

      if (applicableScheme) {
        const freeQuantity = Math.floor(quantity / applicableScheme.buyQuantity) * applicableScheme.freeQuantity;
        if (freeQuantity > 0) {
          setShowSchemeItems({
            ...showSchemeItems,
            [index]: [{
              description: `${updatedItems[index].description} (Free from scheme)`,
              quantity: freeQuantity,
              unitPrice: 0,
              lineTotal: 0,
              isFreeFromScheme: true,
              schemeId: applicableScheme.id,
            }]
          });
        }
      } else {
        const updatedSchemeItems = { ...showSchemeItems };
        delete updatedSchemeItems[index];
        setShowSchemeItems(updatedSchemeItems);
      }
    }
    
    setLineItems(updatedItems);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { productId: "", variantId: "", description: "", quantity: 1, unitPrice: 0, lineTotal: 0 }]);
  };

  const removeLineItem = (index: number) => {
    const updatedItems = lineItems.filter((_, i) => i !== index);
    setLineItems(updatedItems);
    
    // Remove associated scheme items
    const updatedSchemeItems = { ...showSchemeItems };
    delete updatedSchemeItems[index];
    setShowSchemeItems(updatedSchemeItems);
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  };

  const onSubmit = (data: z.infer<typeof invoiceSchema>) => {
    const total = calculateTotal();
    const subtotal = total;

    // Prepare all line items including scheme items
    const allLineItems: any[] = [];
    lineItems.forEach((item, index) => {
      allLineItems.push({
        productId: item.productId,
        variantId: item.variantId || null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        lineTotal: item.lineTotal.toString(),
        isFreeFromScheme: false,
        schemeId: null,
      });

      // Add scheme items if any
      if (showSchemeItems[index]) {
        showSchemeItems[index].forEach(schemeItem => {
          allLineItems.push({
            productId: item.productId,
            variantId: item.variantId || null,
            description: schemeItem.description,
            quantity: schemeItem.quantity,
            unitPrice: schemeItem.unitPrice.toString(),
            lineTotal: schemeItem.lineTotal.toString(),
            isFreeFromScheme: true,
            schemeId: schemeItem.schemeId,
          });
        });
      }
    });

    const invoiceData = {
      invoice: {
        ...data,
        subtotal: subtotal.toString(),
        total: total.toString(),
        status: "draft",
        invoiceType: data.invoiceType,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate || null,
        userId: DEFAULT_USER_ID,
      },
      lineItems: allLineItems,
    };

    createInvoiceMutation.mutate(invoiceData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="invoice-form-modal">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center" data-testid="invoice-form-title">
              <NotebookPen className="mr-2 text-primary" size={20} />
              Create New {form.watch("invoiceType") === "payable" ? "AP Bill" : "AR Invoice"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-invoice-form">
              <X size={20} />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Invoice Type Selection */}
              <div className="mb-6">
                <FormField
                  control={form.control}
                  name="invoiceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Invoice Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full md:w-64" data-testid="select-invoice-type">
                            <SelectValue placeholder="Select Invoice Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="receivable" data-testid="option-ar-invoice">
                            <div className="flex items-center">
                              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                              Accounts Receivable (AR) - Customer Invoice
                            </div>
                          </SelectItem>
                          <SelectItem value="payable" data-testid="option-ap-invoice">
                            <div className="flex items-center">
                              <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                              Accounts Payable (AP) - Vendor Bill
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Customer and Date Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {form.watch("invoiceType") === "payable" ? "Vendor" : "Customer"}
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-customer">
                            <SelectValue placeholder={
                              form.watch("invoiceType") === "payable" ? "Select Vendor" : "Select Customer"
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers?.map((customer: any) => (
                            <SelectItem key={customer.id} value={customer.id} data-testid={`option-customer-${customer.id}`}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="invoiceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-invoice-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Number</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-invoice-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-due-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-foreground">Invoice Items</label>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem} data-testid="button-add-line-item">
                    <Plus className="mr-1" size={14} />
                    Add Item
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={index}>
                      {/* Main line item */}
                      <div className="grid grid-cols-12 gap-3 items-end p-3 bg-muted/50 rounded-lg" data-testid={`line-item-${index}`}>
                        <div className="col-span-3">
                          <label className="block text-xs text-muted-foreground mb-1">Product</label>
                          <Select 
                            value={item.productId} 
                            onValueChange={(value) => {
                              updateLineItem(index, 'productId', value);
                              const product = products?.find((p: any) => p.id === value);
                              if (product) {
                                updateLineItem(index, 'description', product.name);
                                updateLineItem(index, 'unitPrice', parseFloat(product.basePrice));
                              }
                            }}
                          >
                            <SelectTrigger className="h-8" data-testid={`select-product-${index}`}>
                              <SelectValue placeholder="Select Product" />
                            </SelectTrigger>
                            <SelectContent>
                              {products?.map((product: any) => (
                                <SelectItem key={product.id} value={product.id} data-testid={`option-product-${product.id}`}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="col-span-2">
                          <label className="block text-xs text-muted-foreground mb-1">Description</label>
                          <Input 
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                            className="h-8"
                            data-testid={`input-description-${index}`}
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <label className="block text-xs text-muted-foreground mb-1">Qty</label>
                          <Input 
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 0)}
                            className="h-8"
                            data-testid={`input-quantity-${index}`}
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <label className="block text-xs text-muted-foreground mb-1">Rate</label>
                          <Input 
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="h-8"
                            data-testid={`input-unit-price-${index}`}
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <label className="block text-xs text-muted-foreground mb-1">Amount</label>
                          <Input 
                            value={item.lineTotal.toFixed(2)}
                            readOnly
                            className="h-8"
                            data-testid={`input-line-total-${index}`}
                          />
                        </div>
                        
                        <div className="col-span-1">
                          <Button 
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(index)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            data-testid={`button-remove-line-item-${index}`}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>

                      {/* Scheme items */}
                      {showSchemeItems[index] && (
                        <div className="ml-4 mt-2">
                          {showSchemeItems[index].map((schemeItem, schemeIndex) => (
                            <div key={schemeIndex} className="grid grid-cols-12 gap-3 items-end p-3 bg-accent/5 rounded-lg border-l-4 border-accent" data-testid={`scheme-item-${index}-${schemeIndex}`}>
                              <div className="col-span-3">
                                <span className="text-xs text-accent font-medium">Free Item (Scheme Applied)</span>
                              </div>
                              <div className="col-span-2">
                                <Input 
                                  value={schemeItem.description}
                                  readOnly
                                  className="h-8 text-xs"
                                  data-testid={`scheme-description-${index}-${schemeIndex}`}
                                />
                              </div>
                              <div className="col-span-2">
                                <Input 
                                  value={schemeItem.quantity}
                                  readOnly
                                  className="h-8"
                                  data-testid={`scheme-quantity-${index}-${schemeIndex}`}
                                />
                              </div>
                              <div className="col-span-2">
                                <Input 
                                  value="0.00"
                                  readOnly
                                  className="h-8"
                                  data-testid={`scheme-price-${index}-${schemeIndex}`}
                                />
                              </div>
                              <div className="col-span-2">
                                <Input 
                                  value="0.00"
                                  readOnly
                                  className="h-8"
                                  data-testid={`scheme-total-${index}-${schemeIndex}`}
                                />
                              </div>
                              <div className="col-span-1">
                                <Gift className="text-accent" size={16} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Invoice Total */}
                <div className="border-t border-border pt-4 mt-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-foreground">Total Amount:</span>
                    <span className="text-2xl font-bold text-primary" data-testid="invoice-total">
                      ${calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-6">
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={createInvoiceMutation.isPending}
                    data-testid="button-save-draft"
                  >
                    <Save className="mr-2" size={16} />
                    {createInvoiceMutation.isPending ? "Saving..." : "Save Draft"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="secondary"
                    onClick={onClose}
                    data-testid="button-cancel-invoice"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
