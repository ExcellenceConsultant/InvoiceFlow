import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, NotebookPen, Save } from "lucide-react";
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

const invoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  paymentTerms: z.string().min(1, "Payment terms are required"),
  invoiceType: z.enum(["receivable", "payable"], {
    required_error: "Please select invoice type",
  }),
});

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function InvoiceForm({ onClose, onSuccess }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerId: "",
      invoiceNumber: `INV-${Date.now()}`,
      invoiceDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 30 days from now
      paymentTerms: "Net 30",
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

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Submitting simplified invoice data:", data);
      const response = await apiRequest("POST", "/api/invoices", data);
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Invoice creation failed:", errorData);
        throw new Error(errorData.message || "Failed to create invoice");
      }
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

  const onSubmit = (data: z.infer<typeof invoiceSchema>) => {
    const invoiceData = {
      invoice: {
        customerId: data.customerId,
        invoiceNumber: data.invoiceNumber,
        subtotal: "0.00", // Simplified - no line items
        total: "0.00", // Simplified - no line items
        status: "draft",
        invoiceType: data.invoiceType,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        paymentTerms: data.paymentTerms,
        userId: DEFAULT_USER_ID,
      },
      lineItems: [], // Simplified - no line items
    };

    createInvoiceMutation.mutate(invoiceData);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      data-testid="invoice-form-modal"
    >
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle
              className="flex items-center"
              data-testid="invoice-form-title"
            >
              <NotebookPen className="mr-2 text-primary" size={20} />
              Create New{" "}
              {form.watch("invoiceType") === "payable"
                ? "AP Bill"
                : "AR Invoice"}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="button-close-invoice-form"
            >
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
                      <FormLabel className="text-base font-semibold">
                        Invoice Type
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger
                            className="w-full md:w-64"
                            data-testid="select-invoice-type"
                          >
                            <SelectValue placeholder="Select Invoice Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem
                            value="receivable"
                            data-testid="option-ar-invoice"
                          >
                            <div className="flex items-center">
                              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                              Accounts Receivable (AR) - Customer Invoice
                            </div>
                          </SelectItem>
                          <SelectItem
                            value="payable"
                            data-testid="option-ap-invoice"
                          >
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

              {/* Customer/Vendor Selection */}
              <div className="grid grid-cols-1">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {form.watch("invoiceType") === "payable"
                          ? "Vendor"
                          : "Customer"}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-customer">
                            <SelectValue
                              placeholder={
                                form.watch("invoiceType") === "payable"
                                  ? "Select Vendor"
                                  : "Select Customer"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers?.map((customer: any) => (
                            <SelectItem
                              key={customer.id}
                              value={customer.id}
                              data-testid={`option-customer-${customer.id}`}
                            >
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Invoice Number and Invoice Date */}
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
                  name="invoiceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-invoice-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Payment Terms and Due Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-payment-terms" placeholder="Net 30" />
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
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-due-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  {createInvoiceMutation.isPending
                    ? "Saving..."
                    : "Save Invoice"}
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
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}