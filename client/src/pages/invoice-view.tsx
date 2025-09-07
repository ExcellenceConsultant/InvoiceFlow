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
    // Remove any existing print styles
    const existingStyle = document.getElementById('print-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Add print-specific styles to hide browser headers/footers
    const printStyle = document.createElement('style');
    printStyle.id = 'print-style';
    printStyle.textContent = `
      @media print {
        @page {
          margin: 0 !important;
          size: A4 !important;
        }
        
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        /* Hide all browser chrome */
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
      }
      
      @page {
        margin: 0 !important;
        @top-left { content: none !important; }
        @top-center { content: none !important; }
        @top-right { content: none !important; }
        @bottom-left { content: none !important; }
        @bottom-center { content: none !important; }
        @bottom-right { content: none !important; }
      }
    `;
    
    document.head.appendChild(printStyle);
    
    // Small delay to ensure styles are applied
    setTimeout(() => {
      window.print();
      
      // Clean up after printing
      setTimeout(() => {
        const styleToRemove = document.getElementById('print-style');
        if (styleToRemove) {
          styleToRemove.remove();
        }
      }, 1000);
    }, 100);
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

  const calculateTotalCartons = () => {
    return lineItems?.reduce((sum: number, item: InvoiceLineItem) => sum + item.quantity, 0) || 0;
  };

  const numberToWords = (num: number): string => {
    if (num === 0) return "Zero";
    
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const thousands = ["", "Thousand", "Million"];

    const convertHundreds = (n: number): string => {
      let result = "";
      if (Math.floor(n / 100) > 0) {
        result += ones[Math.floor(n / 100)] + " Hundred ";
        n %= 100;
      }
      if (n >= 10 && n <= 19) {
        result += teens[n - 10] + " ";
      } else {
        if (Math.floor(n / 10) > 0) {
          result += tens[Math.floor(n / 10)] + " ";
        }
        if (n % 10 > 0) {
          result += ones[n % 10] + " ";
        }
      }
      return result.trim();
    };

    const dollars = Math.floor(num);
    const cents = Math.round((num - dollars) * 100);
    
    let result = "";
    let thousandCounter = 0;
    let temp = dollars;
    
    while (temp > 0) {
      const chunk = temp % 1000;
      if (chunk !== 0) {
        const chunkWords = convertHundreds(chunk);
        result = chunkWords + (thousands[thousandCounter] ? " " + thousands[thousandCounter] : "") + (result ? " " + result : "");
      }
      temp = Math.floor(temp / 1000);
      thousandCounter++;
    }
    
    result = result || "Zero";
    result += " Dollar" + (dollars !== 1 ? "s" : "");
    
    if (cents > 0) {
      result += " and " + convertHundreds(cents) + " Cent" + (cents !== 1 ? "s" : "");
    }
    
    return result;
  };

  return (
    <div className="min-h-screen bg-white print:bg-white">
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
        {/* Company Header - Only for AR invoices */}
        {invoice.invoiceType === "receivable" && (
          <div className="text-center mb-6 print:mb-4">
            <h2 className="text-lg font-bold mb-2" data-testid="text-company-name">Kitchen Xpress Overseas Inc.</h2>
            <p className="text-sm mb-1" data-testid="text-company-address">14001 Townsend Rd. Philadelphia, PA 19154-1007</p>
            <p className="text-sm" data-testid="text-company-contact">Phone - +1 (267) 667 4923 | Fax: +1 (445) 776 5416 | Email: info@kxol.us</p>
          </div>
        )}

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

        {/* Summary Table - After line items */}
        <div className="border border-gray-300 print:border-black mt-0">
          <div className="grid grid-cols-2">
            {/* Left Column */}
            <div className="border-r border-gray-300 print:border-black">
              <div className="border-b border-gray-300 print:border-black p-3 bg-gray-50 print:bg-white">
                <div className="flex justify-between">
                  <span className="font-semibold text-sm">Total Cartons</span>
                  <span className="text-sm" data-testid="text-total-cartons">{calculateTotalCartons()}</span>
                </div>
              </div>
              <div className="border-b border-gray-300 print:border-black p-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-sm">Net Weight (KGS):</span>
                  <span className="text-sm" data-testid="text-net-weight">-</span>
                </div>
              </div>
              <div className="border-b border-gray-300 print:border-black p-3 bg-gray-50 print:bg-white">
                <div className="flex justify-between">
                  <span className="font-semibold text-sm">Gross Weight (KGS):</span>
                  <span className="text-sm" data-testid="text-gross-weight-kgs">-</span>
                </div>
              </div>
              <div className="border-b border-gray-300 print:border-black p-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-sm">Gross Weight (LBS):</span>
                  <span className="text-sm" data-testid="text-gross-weight-lbs">-</span>
                </div>
              </div>
              <div className="p-3 bg-gray-50 print:bg-white">
                <div>
                  <span className="font-semibold text-sm">Amount in Words:</span>
                  <div className="text-sm mt-1 leading-tight" data-testid="text-amount-words">
                    {numberToWords(parseFloat(invoice.total))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div>
              <div className="border-b border-gray-300 print:border-black p-3 bg-gray-50 print:bg-white">
                <div className="flex justify-between">
                  <span className="font-semibold text-sm">Net Amount</span>
                  <span className="text-sm" data-testid="text-net-amount-summary">${calculateSubtotal().toFixed(2)}</span>
                </div>
              </div>
              <div className="border-b border-gray-300 print:border-black p-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-sm">Freight</span>
                  <span className="text-sm" data-testid="text-freight">$0.00</span>
                </div>
              </div>
              <div className="p-3 bg-gray-50 print:bg-white">
                <div className="flex justify-between">
                  <span className="font-semibold text-sm">Total Invoice Amount:</span>
                  <span className="font-bold text-sm" data-testid="text-total-invoice-amount">${parseFloat(invoice.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="mt-4 text-xs text-gray-700 print:text-black">
          <p className="mb-2">
            <strong>1.</strong> All Matters related to this invoice or the goods shall be governed by the laws of Pennsylvania, and all disputes 
            related hereto shall be adjudicated exclusively in the state or federal courts located in Pennsylvania.
          </p>
          <p className="mb-2">
            <strong>2.</strong> Overdue balances subject to finance charges of 2% per month.
          </p>
          <p className="mb-2">
            <strong>3.</strong> In the event any collection costs are incurred by liability. The company will not be liable for cash 
            payments or for overpayments exceeding the invoiced amount.
          </p>
          <p>
            <strong>4.</strong> Final Sale
          </p>
        </div>

        {/* Footer Signature Section */}
        <div className="grid grid-cols-2 mt-6 print:mt-4 border-t border-gray-300 print:border-black pt-4">
          <div>
            <div className="border-b border-gray-300 print:border-black w-48 mb-2"></div>
            <p className="text-sm font-semibold">Received By (Name):_______</p>
          </div>
          <div>
            <div className="border-b border-gray-300 print:border-black w-48 mb-2"></div>
            <p className="text-sm font-semibold">Total Pallets:_______</p>
            <div className="text-right mt-4">
              <p className="text-sm font-semibold">Kitchen Xpress Overseas Inc.</p>
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