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
        
        /* Smart page breaks for summary and footer */
        .summary-page-break {
          page-break-before: auto;
        }
        
        .footer-page-break {
          page-break-before: auto;
        }
        
        /* PDF Print optimizations */
        @media print {
          .summary-page-break {
            page-break-before: always;
          }
          
          .footer-page-break {
            page-break-before: always;
          }
          
          /* Line items table pagination */
          .line-items-container {
            page-break-inside: auto;
          }
          
          .line-item-row {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          /* Table headers should repeat */
          .table-header {
            page-break-after: avoid;
          }
          
          /* Keep summary together on final page */
          .summary-section {
            page-break-before: always;
            page-break-inside: avoid;
          }
          
          /* Ensure footer always starts fresh page */
          .footer-page-break {
            page-break-before: always;
            page-break-inside: avoid;
          }
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
      // Step 1: A4 Layout Setup - Exact specifications
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',           // Use millimeters as primary unit
        format: 'a4',         // A4 format: 210mm x 297mm
        compress: true
      });

      // A4 paper dimensions in millimeters
      const pageWidth = 210;   // A4 width in mm
      const pageHeight = 297;  // A4 height in mm
      
      // Margins in millimeters
      const margins = {
        top: 50,     // Top margin: 50mm
        bottom: 40,  // Bottom margin: 40mm  
        left: 20,    // Left margin: 20mm
        right: 20    // Right margin: 20mm
      };
      
      // Safe content area as specified
      const safeContentArea = {
        x: 20,       // Origin X: 20mm (left margin)
        y: 50,       // Origin Y: 50mm (top margin)
        width: 170,  // Width: 170mm (210 - 20 - 20)
        height: 207  // Height: 207mm (297 - 50 - 40)
      };

      // Calculate line items pagination
      const itemsPerPage = 12; // Approximate items that fit per page after invoice details
      const totalItems = lineItems?.length || 0;
      const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
      const summaryPage = totalPages + 1; // Summary always goes on the page after last line items

      for (let pageNum = 1; pageNum <= summaryPage; pageNum++) {
        if (pageNum > 1) {
          pdf.addPage();
        }

        // No company header/footer graphics - will be printed on pre-printed letterhead
        // All content must stay within safe content area bounds
        let currentY = safeContentArea.y;

        if (pageNum <= totalPages) {
          // Line items pages
          
          // Invoice Header Section (matches Word document format)
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'bold');
          pdf.text('INVOICE', safeContentArea.x, currentY);
          pdf.text(`Page : ${pageNum} of ${summaryPage}`, safeContentArea.x + safeContentArea.width - 30, currentY, { align: 'right' });
          currentY += 10;

          // Customer and Invoice Details Section (matches Word document layout)
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          
          // Three column layout: Bill To | Ship To | Invoice Details
          const col1X = safeContentArea.x;                    // Bill To column
          const col2X = safeContentArea.x + 56;               // Ship To column  
          const col3X = safeContentArea.x + 112;              // Invoice Details column
          
          // Header row - matching Word document format
          pdf.text('Bill To', col1X, currentY);
          pdf.text('Ship To', col2X, currentY);
          currentY += 5;
          
          // Customer details
          pdf.setFont('helvetica', 'normal');
          const customerName = customer?.name || 'Customer Name';
          pdf.text(customerName, col1X, currentY);
          pdf.text(customerName, col2X, currentY);
          pdf.text(`Invoice No : ${invoice.invoiceNumber}`, col3X, currentY);
          currentY += 4;

          // Address and invoice details
          if (customer?.address) {
            pdf.text(customer.address.street || '', col1X, currentY);
            pdf.text(customer.address.street || '', col2X, currentY);
            pdf.text(`Invoice Date : ${formatDate(invoice.invoiceDate.toString())}`, col3X, currentY);
            currentY += 4;
            
            const cityLine = `${customer.address.city || ''}, ${customer.address.state || ''} ${customer.address.zipCode || ''}`;
            pdf.text(cityLine, col1X, currentY);
            pdf.text(cityLine, col2X, currentY);
            pdf.text('Purchase Order No : -', col3X, currentY);
            currentY += 4;
            
            pdf.text(customer.address.country || '', col1X, currentY);
            pdf.text(customer.address.country || '', col2X, currentY);
            pdf.text('Payment Term : Net 30', col3X, currentY);
            currentY += 4;
            
            pdf.text(`TEL : ${customer.phone || ''}`, col1X, currentY);
            pdf.text('', col2X, currentY);
            pdf.text('Shipping Info', col3X, currentY);
            currentY += 4;
            
            pdf.text('', col1X, currentY);
            pdf.text('', col2X, currentY);
            pdf.text(`Ship Date : ${formatDate((invoice.dueDate || invoice.invoiceDate).toString())}`, col3X, currentY);
            currentY += 8;
          }

          // Table headers (matches Word document format) - exact column specifications
          currentY = 90; // Fixed Y position at 90mm on every page (matching Word document)
          const tableStartY = currentY;
          
          // Use exact column widths from Word document (scaled to fit 170mm safe content width)
          const scaleFactor = safeContentArea.width / 187; // 170 / 187 = 0.909
          const colWidths = [
            10 * scaleFactor,  // Sr. No → 9.09 mm
            28 * scaleFactor,  // Item Code → 25.45 mm
            22 * scaleFactor,  // Packing Size → 20.00 mm
            75 * scaleFactor,  // Product Description → 68.18 mm
            19 * scaleFactor,  // Qty(Cartons) → 17.27 mm, right-aligned
            11 * scaleFactor,  // Rate PerCarton (USD) → 10.00 mm, right-aligned
            22 * scaleFactor   // Net Amount(USD) → 20.00 mm, right-aligned
          ];
          
          let xPos = safeContentArea.x;
          
          pdf.setFillColor(240, 240, 240);
          pdf.rect(safeContentArea.x, tableStartY, safeContentArea.width, 10, 'F');
          
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          
          // Table headers matching Word document exactly
          const headers = ['Sr. No', 'Item Code', 'Packing Size', 'Product Description', 'Qty(Cartons)', 'Rate PerCarton\n(USD)', 'Net Amount(USD)'];
          const headerAlignments = ['center', 'center', 'center', 'center', 'center', 'center', 'center'];
          
          headers.forEach((header, index) => {
            const align = headerAlignments[index];
            let textX;
            
            if (align === 'right') {
              textX = xPos + colWidths[index] - 2; // Right-aligned with 2mm padding
            } else {
              textX = xPos + colWidths[index] / 2; // Center-aligned
            }
            
            pdf.text(header, textX, tableStartY + 6, { align: align as 'center' | 'left' | 'right' });
            
            // Draw column borders
            if (index < headers.length - 1) {
              pdf.line(xPos + colWidths[index], tableStartY, xPos + colWidths[index], tableStartY + 10);
            }
            xPos += colWidths[index];
          });
          
          // Draw table border - within safe content area
          pdf.rect(safeContentArea.x, tableStartY, safeContentArea.width, 10);
          currentY = tableStartY + 10;

          // Add line items for this page
          const startIndex = (pageNum - 1) * itemsPerPage;
          const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
          
          pdf.setFont('helvetica', 'normal');
          
          for (let i = startIndex; i < endIndex; i++) {
            const item = lineItems?.[i];
            if (!item) continue;
            xPos = safeContentArea.x;
            
            const rowData = [
              (i + 1).toString(),
              item.productCode || '-',
              item.packingSize || '-',
              item.description.length > 45 ? item.description.substring(0, 45) + '...' : item.description,
              item.quantity.toString(),
              parseFloat(item.unitPrice).toFixed(2),
              parseFloat(item.lineTotal).toFixed(2)
            ];
            
            const rowHeight = 8; // Minimum 8mm row height (matching Word document)
            const dataAlignments = ['center', 'center', 'center', 'left', 'center', 'center', 'center'];
            
            rowData.forEach((data, colIndex) => {
              const align = dataAlignments[colIndex];
              let textX;
              
              if (align === 'left') {
                textX = xPos + 2; // Left-aligned with 2mm padding (Product Description)
              } else {
                textX = xPos + colWidths[colIndex] / 2; // Center-aligned (all other columns)
              }
              
              pdf.text(data, textX, currentY + 5, { align: align as 'center' | 'left' | 'right' });
              
              // Draw column borders (matching Word document table style)
              if (colIndex < rowData.length - 1) {
                pdf.line(xPos + colWidths[colIndex], currentY, xPos + colWidths[colIndex], currentY + rowHeight);
              }
              xPos += colWidths[colIndex];
            });
            
            // Draw row border - within safe content area
            pdf.rect(safeContentArea.x, currentY, safeContentArea.width, rowHeight);
            currentY += rowHeight;
          }

        } else {
          // Summary page
          currentY += 10;

          // Summary section
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          
          const summaryData = [
            ['Total Cartons', ':', calculateTotalCartons().toString()],
            ['Net Amount', ':', `$${calculateSubtotal().toFixed(2)}`],
            ['Net Weight (KGS)', ':', calculateTotalNetWeight().toFixed(3)],
            ['Freight', ':', '$0.00'],
            ['Gross Weight (KGS)', ':', calculateTotalGrossWeight().toFixed(3)],
            ['Total Invoice Amount', ':', `$${parseFloat(invoice.total).toFixed(2)}`],
            ['Gross Weight (LBS)', ':', (calculateTotalGrossWeight() * 2.20462).toFixed(3)]
          ];
          
          summaryData.forEach(([label, colon, value]) => {
            pdf.text(label, safeContentArea.x, currentY);
            pdf.text(colon, safeContentArea.x + 50, currentY);
            pdf.text(value, safeContentArea.x + 55, currentY);
            currentY += 6;
          });
          
          currentY += 10;
          
          // Amount in words - within safe content area
          pdf.setFont('helvetica', 'bold');
          pdf.text('Amount In Words :', safeContentArea.x, currentY);
          currentY += 5;
          pdf.setFont('helvetica', 'normal');
          pdf.text(numberToWords(parseFloat(invoice.total)), safeContentArea.x, currentY);
          currentY += 15;

          // Terms and conditions
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          
          const terms = [
            '1. All Matters related to this invoice or the goods shall be governed by the laws of Pennsylvania, and all disputes',
            '   related hereto shall be adjusted exclusively in the state or federal courts located in Pennsylvania.',
            '2. Overdues balances subject to finance charges of 2% per month.',
            '3. All Payments must be made to the company\'s official bank account only. The company will not be liable for cash',
            '   payments or for overpayments exceeding the invoiced amount.',
            '4. Final Sale'
          ];
          
          terms.forEach(term => {
            pdf.text(term, safeContentArea.x, currentY);
            currentY += 4;
          });
          
          currentY += 10;

          // Signature lines - within safe content area
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.text('Received By (Name) : _____________', safeContentArea.x, currentY);
          currentY += 6;
          pdf.text('Total Pallets      : _____________', safeContentArea.x, currentY);
          currentY += 15;

          // Company name - within safe content area
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Kitchen Xpress Overseas Inc.', safeContentArea.x, currentY);
        }
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
        <div className="grid grid-cols-2 gap-4 text-xs">
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

        </div>
      </div>

      {/* Invoice content */}
      <div className="invoice-content invoice-pdf-content max-w-4xl mx-auto bg-white p-8 print:p-6 print:max-w-full print:mx-0">
        {/* Company Header removed as requested */}

        {/* Header Section - matches Word document format exactly */}
        <div className="mb-6 print:mb-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold" data-testid="text-invoice-title">INVOICE</h1>
            <p className="text-sm font-medium" data-testid="text-page-number">Page : 1 of 1</p>
          </div>
        </div>

        {/* Customer and Invoice Details Section - matches Word document layout */}
        <div className="mb-6 print:mb-4">
          <div className="grid grid-cols-3 gap-6 text-sm">
            {/* Bill To Column */}
            <div>
              <h3 className="font-bold mb-2" data-testid="text-bill-to-header">Bill To</h3>
              <div className="space-y-1" data-testid="text-bill-to-info">
                <p className="font-medium">{customer?.name || 'Customer Name'}</p>
                {customer?.address && (
                  <>
                    <p>{customer.address.street}</p>
                    <p>{customer.address.city}, {customer.address.state} {customer.address.zipCode}</p>
                    <p>{customer.address.country}</p>
                  </>
                )}
                <p>TEL : {customer?.phone || ''}</p>
              </div>
            </div>

            {/* Ship To Column */}
            <div>
              <h3 className="font-bold mb-2" data-testid="text-ship-to-header">Ship To</h3>
              <div className="space-y-1" data-testid="text-ship-to-info">
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

            {/* Invoice Details Column */}
            <div>
              <div className="space-y-1">
                <div className="flex">
                  <span className="font-medium w-24">Invoice No :</span>
                  <span data-testid="text-invoice-number">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-24">Invoice Date :</span>
                  <span data-testid="text-invoice-date">{formatDate(invoice.invoiceDate.toString())}</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-24">Purchase Order No :</span>
                  <span data-testid="text-po-number">-</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-24">Payment Term :</span>
                  <span data-testid="text-payment-term">Net 30</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-24">Shipping Info</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-24">Ship Date :</span>
                  <span data-testid="text-ship-date">{invoice.dueDate ? formatDate(invoice.dueDate.toString()) : formatDate(invoice.invoiceDate.toString())}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table - matches Word document format exactly */}
        <div className="line-items-container border border-gray-300 print:border-black">
          {/* Table Header - 7 columns as per Word document */}
          <div className="grid grid-cols-7 bg-gray-50 print:bg-white border-b border-gray-300 print:border-black" style={{gridTemplateColumns: '10% 20% 15% 30% 12% 13% 15%'}}>
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

          {/* Table Rows - 7 columns as per Word document */}
          {lineItems?.map((item: InvoiceLineItem, index: number) => (
            <div key={item.id} className="line-item-row grid grid-cols-7 border-b border-gray-300 print:border-black min-h-[40px] page-break-avoid" style={{gridTemplateColumns: '10% 20% 15% 30% 12% 13% 15%'}} data-testid={`row-line-item-${index}`}>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs" data-testid={`text-sr-no-${index}`}>
                {index + 1}
              </div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs" data-testid={`text-item-code-${index}`}>
                {item.productCode || '-'}
              </div>
              <div className="p-2 border-r border-gray-300 print:border-black text-center text-xs" data-testid={`text-packing-size-${index}`}>
                {item.packingSize || '-'}
              </div>
              <div className="p-2 border-r border-gray-300 print:border-black text-left text-xs px-3" data-testid={`text-description-${index}`}>
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

          {/* Empty rows to match Word document format */}
          {Array.from({ length: Math.max(0, 15 - (lineItems?.length || 0)) }).map((_, index) => (
            <div key={`empty-${index}`} className="grid grid-cols-7 border-b border-gray-300 print:border-black min-h-[40px]" style={{gridTemplateColumns: '10% 20% 15% 30% 12% 13% 15%'}} data-testid={`row-empty-${index}`}>
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
        <div className="summary-section summary-page-break border border-gray-300 print:border-black mt-0">
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

        {/* Terms and Conditions - Smart page break */}
        <div className="mt-4 text-xs text-gray-700 print:text-black footer-page-break">
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
            <p className="text-sm font-semibold" data-testid="text-received-by-name">Received By (Name): _________________________</p>
          </div>
          <div>
            <div className="border-b border-gray-300 print:border-black w-48 mb-2"></div>
            <p className="text-sm font-semibold" data-testid="text-total-pallets">Total Pallets: _________________________</p>
            <div className="text-center mt-6">
              <p className="text-lg font-bold" data-testid="text-footer-company-name">Kitchen Xpress Overseas Inc.</p>
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