import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { useLocation } from "wouter";
import type { Invoice, Customer, InvoiceLineItem } from "@shared/schema";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function InvoiceView() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ["/api/invoices", id],
  });

  const { data: lineItems } = useQuery<InvoiceLineItem[]>({
    queryKey: ["/api/invoices", id, "line-items"],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/${id}/line-items`);
      if (!response.ok) throw new Error("Failed to fetch line items");
      return response.json();
    },
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

    // Add print-specific styles with multi-page support
    const printStyle = document.createElement('style');
    printStyle.id = 'print-style';
    printStyle.textContent = `
      @media print {
        @page {
          margin: 0.5in 0.5in 1in 0.5in !important;
          size: A4 !important;
        }
        
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        /* Hide screen-only elements */
        .no-print {
          display: none !important;
        }
        
        /* Company header on every page */
        .print-company-header {
          display: block;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: white;
          z-index: 1000;
          padding: 10px;
          border-bottom: 1px solid #000;
        }
        
        /* Customer details header on every page */
        .print-customer-header {
          display: block;
          position: fixed;
          top: 70px;
          left: 0;
          right: 0;
          background: white;
          z-index: 999;
          padding: 8px;
          border-bottom: 1px solid #000;
        }
        
        /* Main content with proper top margin */
        .invoice-content {
          margin-top: 180px !important;
        }
        
        /* Table headers should also be fixed for multi-page */
        .table-header {
          position: sticky;
          top: 180px;
          background: white;
          z-index: 998;
        }
        
        /* Page break control */
        .page-break-before {
          page-break-before: always;
        }
        
        .page-break-avoid {
          page-break-inside: avoid;
        }
        
        /* Ensure line items stay together but allow breaks between them */
        .line-item-row {
          page-break-inside: avoid;
        }
        
        /* Keep summary together */
        .summary-section {
          page-break-inside: avoid;
        }
        
        /* Page numbers */
        @page {
          @bottom-right {
            content: "Page " counter(page);
            font-size: 10px;
          }
        }
      }
    `;
    
    document.head.appendChild(printStyle);
    
    // Update page numbers dynamically
    updatePageNumbers();
    
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

  const updatePageNumbers = () => {
    // Better page calculation based on line items and content
    const lineItemsCount = lineItems?.length || 0;
    const itemsPerPage = 15; // Approximate line items per page
    const totalPages = Math.max(1, Math.ceil(lineItemsCount / itemsPerPage));
    
    // Update all page number elements
    const pageElements = document.querySelectorAll('.page-number');
    pageElements.forEach((element, index) => {
      element.textContent = `Page: ${index + 1} of ${totalPages}`;
    });
    
    // Add page numbers to print footer
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        @page {
          @bottom-right {
            content: "Page " counter(page) " of " counter(pages);
            font-size: 10px;
          }
        }
      }
    `;
    document.head.appendChild(style);
  };

  const handleGeneratePDF = async () => {
    try {
      // Create PDF with A4 dimensions (210mm x 297mm)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // A4 dimensions in mm
      const pageWidth = 210;
      const pageHeight = 297;
      
      // Content area as specified
      const contentArea = {
        x: 20, // Left margin
        y: 50, // Top margin  
        width: 170, // 210 - 20 - 20
        height: 207 // 297 - 50 - 40
      };

      // Get invoice content element
      const invoiceElement = document.querySelector('.invoice-pdf-content');
      if (!invoiceElement) {
        throw new Error('Invoice content not found');
      }

      // Clone the element and prepare it for PDF
      const clonedElement = invoiceElement.cloneNode(true) as HTMLElement;
      clonedElement.style.width = '170mm';
      clonedElement.style.padding = '0';
      clonedElement.style.margin = '0';
      clonedElement.style.backgroundColor = '#ffffff';
      
      // Hide the cloned element
      clonedElement.style.position = 'absolute';
      clonedElement.style.left = '-9999px';
      clonedElement.style.top = '0';
      document.body.appendChild(clonedElement);

      // Capture with high quality settings
      const canvas = await html2canvas(clonedElement, {
        scale: 3, // Higher scale for better quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: clonedElement.offsetWidth,
        height: clonedElement.offsetHeight,
        windowWidth: clonedElement.offsetWidth,
        windowHeight: clonedElement.offsetHeight
      });

      // Remove cloned element
      document.body.removeChild(clonedElement);

      // Calculate proper scaling
      const imgData = canvas.toDataURL('image/png', 1.0);
      const imgWidth = contentArea.width;
      const imgHeight = (canvas.height * contentArea.width) / canvas.width;

      // Handle multi-page content properly
      const pageContentHeight = contentArea.height;
      let currentPosition = 0;
      let pageNumber = 1;

      while (currentPosition < imgHeight) {
        if (pageNumber > 1) {
          pdf.addPage();
        }

        // Add letterhead background areas
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        
        // Add header and footer placeholders
        pdf.setFillColor(248, 248, 248);
        pdf.rect(0, 0, pageWidth, 50, 'F');
        pdf.rect(0, 257, pageWidth, 40, 'F');

        // Calculate remaining content height for this page
        const remainingHeight = imgHeight - currentPosition;
        const currentPageHeight = Math.min(remainingHeight, pageContentHeight);

        // Add content to current page
        if (currentPageHeight > 0) {
          // Create a temporary canvas for the current page content
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          
          tempCanvas.width = canvas.width;
          tempCanvas.height = (currentPageHeight * canvas.width) / contentArea.width;
          
          if (tempCtx) {
            tempCtx.drawImage(
              canvas,
              0, (currentPosition * canvas.width) / contentArea.width, // Source position
              canvas.width, tempCanvas.height, // Source dimensions
              0, 0, // Destination position
              tempCanvas.width, tempCanvas.height // Destination dimensions
            );
            
            pdf.addImage(
              tempCanvas.toDataURL('image/png', 1.0),
              'PNG',
              contentArea.x,
              contentArea.y,
              imgWidth,
              currentPageHeight
            );
          }
        }

        currentPosition += pageContentHeight;
        pageNumber++;
      }

      // Save the PDF
      const fileName = `Invoice_${invoice.invoiceNumber}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
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

  const calculateTotalGrossWeight = () => {
    return lineItems?.reduce((sum: number, item: InvoiceLineItem) => {
      const weight = parseFloat(item.grossWeightKgs || '0');
      return sum + (weight * item.quantity);
    }, 0) || 0;
  };

  const calculateTotalNetWeight = () => {
    return lineItems?.reduce((sum: number, item: InvoiceLineItem) => {
      const weight = parseFloat(item.netWeightKgs || '0');
      return sum + (weight * item.quantity);
    }, 0) || 0;
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
        <div className="flex gap-2">
          <Button onClick={handlePrint} data-testid="button-print-invoice">
            <Printer className="w-4 h-4 mr-2" />
            Print Invoice
          </Button>
          <Button onClick={handleGeneratePDF} variant="outline" data-testid="button-generate-pdf">
            <Download className="w-4 h-4 mr-2" />
            Generate PDF
          </Button>
        </div>
      </div>

      {/* Print-only headers that repeat on every page - Company details removed */}
      <div className="print-company-header hidden print:block">
        <div className="text-center">
          <h2 className="text-lg font-bold mb-2">INVOICE</h2>
        </div>
      </div>

      <div className="print-customer-header hidden print:block">
        <div className="grid grid-cols-3 gap-4 text-xs">
          {/* Bill To */}
          <div>
            <h3 className="font-semibold mb-1">Bill To</h3>
            <div className="space-y-0">
              <p className="font-medium">{customer?.name || 'Customer Name'}</p>
              {customer?.address && (
                <>
                  <p>{customer.address.street}</p>
                  <p>{customer.address.city}, {customer.address.state} {customer.address.zipCode}</p>
                  <p>{customer.address.country}</p>
                </>
              )}
              {customer?.phone && <p>TEL: {customer.phone}</p>}
            </div>
          </div>

          {/* Ship To */}
          <div>
            <h3 className="font-semibold mb-1">Ship To</h3>
            <div className="space-y-0">
              <p className="font-medium">{customer?.name || 'Customer Name'}</p>
              {customer?.address && (
                <>
                  <p>{customer.address.street}</p>
                  <p>{customer.address.city}, {customer.address.state} {customer.address.zipCode}</p>
                  <p>{customer.address.country}</p>
                </>
              )}
            </div>
          </div>

          {/* Invoice Details */}
          <div>
            <div className="space-y-0">
              <div className="flex justify-between">
                <span className="font-medium">Invoice No:</span>
                <span>{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Invoice Date:</span>
                <span>{formatDate(invoice.invoiceDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Payment Term:</span>
                <span>Net 30</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice content */}
      <div className="invoice-content invoice-pdf-content max-w-4xl mx-auto bg-white p-8 print:p-6 print:max-w-full print:mx-0">
        {/* Company Header removed as requested */}

        {/* Header - Hide on print since we have fixed headers */}
        <div className="text-center mb-8 print:mb-6 print:hidden">
          <h1 className="text-3xl font-bold print:text-2xl" data-testid="text-invoice-title">INVOICE</h1>
          <p className="text-right text-sm mt-2 page-number" data-testid="text-page-number">Page: 1 of 1</p>
        </div>

        {/* Main Info Section - Hide on print since we have fixed headers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 print:gap-4 print:mb-6 print:hidden">
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
          <div className="grid grid-cols-9 bg-gray-50 print:bg-white border-b border-gray-300 print:border-black">
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
            <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs font-semibold" data-testid="header-gross-weight">
              Gross Weight<br/>(KGS)
            </div>
            <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs font-semibold" data-testid="header-net-weight">
              Net Weight<br/>(KGS)
            </div>
            <div className="p-2 text-center text-xs font-semibold" data-testid="header-net-amount">
              Net Amount(USD)
            </div>
          </div>

          {/* Table Rows */}
          {lineItems?.map((item: InvoiceLineItem, index: number) => (
            <div key={item.id} className="line-item-row grid grid-cols-9 border-b border-gray-300 print:border-black min-h-[40px] page-break-avoid" data-testid={`row-line-item-${index}`}>
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
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs" data-testid={`text-gross-weight-${index}`}>
                {item.grossWeightKgs ? parseFloat(item.grossWeightKgs).toFixed(3) : '-'}
              </div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs" data-testid={`text-net-weight-${index}`}>
                {item.netWeightKgs ? parseFloat(item.netWeightKgs).toFixed(3) : '-'}
              </div>
              <div className="p-2 text-center text-xs" data-testid={`text-amount-${index}`}>
                {parseFloat(item.lineTotal).toFixed(2)}
              </div>
            </div>
          ))}

          {/* Empty rows to match format */}
          {Array.from({ length: Math.max(0, 10 - (lineItems?.length || 0)) }).map((_, index) => (
            <div key={`empty-${index}`} className="grid grid-cols-9 border-b border-gray-300 print:border-black min-h-[40px]" data-testid={`row-empty-${index}`}>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs">
                {(lineItems?.length || 0) + index + 1}
              </div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs"></div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs"></div>
              <div className="p-2 border-r border-gray-300 print:border-black text-xs"></div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs"></div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs"></div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs"></div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs"></div>
              <div className="p-2 text-center text-xs"></div>
            </div>
          ))}
        </div>

        {/* Summary Table - After line items */}
        <div className="summary-section border border-gray-300 print:border-black mt-0">
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
                  <span className="text-sm" data-testid="text-net-weight">{calculateTotalNetWeight().toFixed(3)}</span>
                </div>
              </div>
              <div className="border-b border-gray-300 print:border-black p-3 bg-gray-50 print:bg-white">
                <div className="flex justify-between">
                  <span className="font-semibold text-sm">Gross Weight (KGS):</span>
                  <span className="text-sm" data-testid="text-gross-weight-kgs">{calculateTotalGrossWeight().toFixed(3)}</span>
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