import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import type { Invoice, Customer, InvoiceLineItem } from "@shared/schema";

export default function InvoiceView() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ["/api/invoices", id],
  });

  const { data: lineItems } = useQuery<InvoiceLineItem[]>({
    queryKey: ["/api/invoices", id, "line-items"],
  });

  const { data: customer } = useQuery<Customer>({
    queryKey: ["/api/customers", invoice?.customerId],
    enabled: !!invoice?.customerId,
  });

  if (isLoading) {
    return <div>Loading invoice...</div>;
  }

  if (!invoice) {
    return <div>Invoice not found</div>;
  }

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const calculateSubtotal = () => {
    return lineItems?.reduce((sum: number, item: InvoiceLineItem) => sum + parseFloat(item.lineTotal), 0) || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Action buttons - hidden when printing */}
      <div className="flex justify-between items-center p-4 print:hidden bg-white border-b">
        <Button
          variant="ghost"
          onClick={() => setLocation("/invoices")}
          data-testid="button-back-invoices"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Invoices
        </Button>
        <Button onClick={handlePrint} data-testid="button-print-invoice">
          <Printer className="w-4 h-4 mr-2" />
          Print Invoice
        </Button>
      </div>

      {/* Invoice content */}
      <div className="max-w-4xl mx-auto bg-white p-8 print:p-6 print:max-w-full print:mx-0">
        {/* Header */}
        <div className="text-center mb-8 print:mb-6">
          <h1 className="text-3xl font-bold print:text-2xl" data-testid="text-invoice-title">INVOICE</h1>
          <p className="text-right text-sm mt-2" data-testid="text-page-number">Page: 1 of 1</p>
        </div>

        {/* Main Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 print:gap-4 print:mb-6">
          {/* Bill To */}
          <div>
            <h3 className="font-semibold mb-2 text-sm" data-testid="text-bill-to-header">Bill To</h3>
            <div className="text-sm space-y-1" data-testid="text-bill-to-info">
              <p className="font-medium">{customer?.name || 'Customer Name'}</p>
              {customer?.address && (
                <div>
                  <p>{customer.address.street}</p>
                  <p>{customer.address.city}, {customer.address.state} {customer.address.zipCode}</p>
                  <p>{customer.address.country}</p>
                </div>
              )}
              {customer?.phone && <p>TEL: {customer.phone}</p>}
            </div>
          </div>

          {/* Ship To */}
          <div>
            <h3 className="font-semibold mb-2 text-sm" data-testid="text-ship-to-header">Ship To</h3>
            <div className="text-sm space-y-1" data-testid="text-ship-to-info">
              <p className="font-medium">{customer?.name || 'Customer Name'}</p>
              {customer?.address && (
                <div>
                  <p>{customer.address.street}</p>
                  <p>{customer.address.city}, {customer.address.state} {customer.address.zipCode}</p>
                  <p>{customer.address.country}</p>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Details */}
          <div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Invoice No:</span>
                <span data-testid="text-invoice-number">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Invoice Date:</span>
                <span data-testid="text-invoice-date">{formatDate(invoice.invoiceDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Purchase Order No:</span>
                <span data-testid="text-po-number">-</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Payment Term:</span>
                <span data-testid="text-payment-term">Net 30</span>
              </div>
              <div className="mt-4">
                <h4 className="font-semibold mb-1">Shipping Info</h4>
                <div className="flex justify-between">
                  <span className="font-medium">Ship Date:</span>
                  <span data-testid="text-ship-date">{invoice.dueDate ? formatDate(invoice.dueDate) : formatDate(invoice.invoiceDate)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="border border-gray-300 print:border-black">
          {/* Table Header */}
          <div className="grid grid-cols-7 bg-gray-50 print:bg-white border-b border-gray-300 print:border-black">
            <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs font-semibold" data-testid="header-sr-no">
              Sr. No
            </div>
            <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs font-semibold" data-testid="header-item-code">
              Item Code
            </div>
            <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs font-semibold" data-testid="header-packing-size">
              Packing Size
            </div>
            <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs font-semibold" data-testid="header-product-description">
              Product Description
            </div>
            <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs font-semibold" data-testid="header-qty">
              Qty(Cartons)
            </div>
            <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs font-semibold" data-testid="header-rate">
              Rate PerCarton<br/>(USD)
            </div>
            <div className="p-2 text-center text-xs font-semibold" data-testid="header-net-amount">
              Net Amount(USD)
            </div>
          </div>

          {/* Table Rows */}
          {lineItems?.map((item: InvoiceLineItem, index: number) => (
            <div key={item.id} className="grid grid-cols-7 border-b border-gray-300 print:border-black min-h-[40px]" data-testid={`row-line-item-${index}`}>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs" data-testid={`text-sr-no-${index}`}>
                {index + 1}
              </div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs" data-testid={`text-item-code-${index}`}>
                {item.productCode || '-'}
              </div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs" data-testid={`text-packing-size-${index}`}>
                {item.packingSize || '-'}
              </div>
              <div className="p-2 border-r border-gray-300 print:border-black text-xs" data-testid={`text-description-${index}`}>
                {item.description}
                {item.isFreeFromScheme && <span className="text-green-600 ml-1">(Free)</span>}
              </div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs" data-testid={`text-qty-${index}`}>
                {item.quantity}
              </div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs" data-testid={`text-rate-${index}`}>
                {parseFloat(item.unitPrice).toFixed(2)}
              </div>
              <div className="p-2 text-center text-xs" data-testid={`text-amount-${index}`}>
                {parseFloat(item.lineTotal).toFixed(2)}
              </div>
            </div>
          ))}

          {/* Empty rows to match format */}
          {Array.from({ length: Math.max(0, 10 - (lineItems?.length || 0)) }).map((_, index) => (
            <div key={`empty-${index}`} className="grid grid-cols-7 border-b border-gray-300 print:border-black min-h-[40px]" data-testid={`row-empty-${index}`}>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs">
                {(lineItems?.length || 0) + index + 1}
              </div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs"></div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs"></div>
              <div className="p-2 border-r border-gray-300 print:border-black text-xs"></div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs"></div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs"></div>
              <div className="p-2 text-center text-xs"></div>
            </div>
          ))}
        </div>

        {/* Total Section */}
        <div className="mt-6 print:mt-4">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between border-b pb-2">
                <span className="font-medium">Subtotal:</span>
                <span data-testid="text-subtotal">${calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span data-testid="text-total">${parseFloat(invoice.total).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 print:mt-6 text-center text-xs text-gray-600 print:text-black">
          <p>Thank you for your business!</p>
        </div>
      </div>
    </div>
  );
}