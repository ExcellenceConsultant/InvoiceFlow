import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Invoice, InvoiceLineItem, Customer } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';

function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  // Fetch invoice data
  const { data: invoice, isLoading: invoiceLoading } = useQuery<Invoice>({
    queryKey: [`/api/invoices/${id}`],
    enabled: !!id
  });

  // Fetch line items
  const { data: lineItems, isLoading: lineItemsLoading } = useQuery<InvoiceLineItem[]>({
    queryKey: [`/api/invoices/${id}/line-items`],
    enabled: !!id
  });

  // Fetch customer data
  const { data: customer, isLoading: customerLoading } = useQuery<Customer>({
    queryKey: [`/api/customers/${invoice?.customerId}`],
    enabled: !!invoice?.customerId
  });

  const isLoading = invoiceLoading || lineItemsLoading || customerLoading;

  // Add print styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body * {
          visibility: hidden;
        }
        .invoice-print-content, .invoice-print-content * {
          visibility: visible;
        }
        .invoice-print-content {
          position: absolute;
          left: 0;
          top: 0;
          width: 210mm;
          height: auto;
          margin: 0;
          padding: 0;
          background: white;
        }
        .print-hide {
          display: none !important;
        }
        .summary-section {
          page-break-inside: avoid;
        }
        .amount-in-words {
          page-break-inside: avoid;
        }
        .terms-section {
          page-break-inside: avoid;
        }
        .signature-section {
          page-break-inside: avoid;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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

  const calculateTotalCartons = () => {
    return lineItems?.reduce((total: number, item: InvoiceLineItem) => total + item.quantity, 0) || 0;
  };

  const calculateSubtotal = () => {
    return lineItems?.reduce((total, item) => total + parseFloat(item.lineTotal), 0) || 0;
  };

  const calculateTotalNetWeight = () => {
    return lineItems?.reduce((total, item) => {
      return total + (item.netWeightKgs ? parseFloat(item.netWeightKgs) * item.quantity : 0);
    }, 0) || 0;
  };

  const calculateTotalGrossWeight = () => {
    return lineItems?.reduce((total, item) => {
      return total + (item.grossWeightKgs ? parseFloat(item.grossWeightKgs) * item.quantity : 0);
    }, 0) || 0;
  };

  const numberToWords = (amount: number) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (amount === 0) return 'Zero Dollars';

    const convertHundreds = (num: number): string => {
      let result = '';
      if (num >= 100) {
        result += ones[Math.floor(num / 100)] + ' Hundred ';
        num %= 100;
      }
      if (num >= 20) {
        result += tens[Math.floor(num / 10)] + ' ';
        num %= 10;
      } else if (num >= 10) {
        result += teens[num - 10] + ' ';
        num = 0;
      }
      if (num > 0) {
        result += ones[num] + ' ';
      }
      return result;
    };

    let integerPart = Math.floor(amount);
    const decimalPart = Math.round((amount - integerPart) * 100);

    let result = '';
    if (integerPart >= 1000000) {
      result += convertHundreds(Math.floor(integerPart / 1000000)) + 'Million ';
      integerPart %= 1000000;
    }
    if (integerPart >= 1000) {
      result += convertHundreds(Math.floor(integerPart / 1000)) + 'Thousand ';
      integerPart %= 1000;
    }
    if (integerPart > 0) {
      result += convertHundreds(integerPart);
    }

    result += 'Dollars';
    if (decimalPart > 0) {
      result += ' and ' + convertHundreds(decimalPart) + 'Cents';
    }

    return result.trim();
  };

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setLocation('/invoices')}
            data-testid="button-back-to-invoices"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
        </div>
        <div className="text-center py-8">Loading invoice...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setLocation('/invoices')}
            data-testid="button-back-to-invoices"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
        </div>
        <div className="text-center py-8">Invoice not found</div>
      </div>
    );
  }

  // Calculate pagination
  const itemsPerPage = 10;
  const totalItems = lineItems?.length || 0;
  
  // Handle zero items case - ensure at least one page
  const basePages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const pages = [];
  
  // Split items into pages, or create empty page for zero items
  if (totalItems === 0) {
    pages.push([]);
  } else {
    for (let i = 0; i < basePages; i++) {
      const startIndex = i * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
      pages.push(lineItems?.slice(startIndex, endIndex) || []);
    }
  }
  
  // Calculate if summary needs separate page
  // Rough calculation: summary section needs ~80mm height
  // Last page has header (15mm) + customer details (20mm if first page) + table header (10mm) + items (8mm each) + margin (8mm)
  const lastPageItems = pages[pages.length - 1]?.length || 0;
  const lastPageIsFirstPage = pages.length === 1;
  const lastPageUsedHeight = 15 + (lastPageIsFirstPage ? 20 : 0) + 10 + (lastPageItems * 8) + 8; // in mm
  const summaryHeight = 80; // approximate height needed for summary in mm
  const pageHeight = 297 - 50 - 40; // 297mm total - top margin - bottom margin
  
  const summaryNeedsSeparatePage = (lastPageUsedHeight + summaryHeight) > pageHeight;
  
  // Calculate total pages including potential summary page
  const totalPagesWithSummary = pages.length + (summaryNeedsSeparatePage ? 1 : 0);

  // Helper function to render table header
  const renderTableHeader = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '9.09mm 25.45mm 20.00mm 68.18mm 17.27mm 10.00mm 20.00mm', backgroundColor: 'transparent', border: 'none', fontSize: '11pt', fontWeight: 'bold', height: '10mm', lineHeight: '1' }}>
      <div style={{ border: 'none', padding: '1mm', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', wordBreak: 'break-word', overflow: 'hidden' }}>Sr. No</div>
      <div style={{ border: 'none', padding: '1mm', textAlign: 'left', display: 'flex', alignItems: 'center', wordBreak: 'break-word', overflow: 'hidden' }}>Item Code</div>
      <div style={{ border: 'none', padding: '1mm', textAlign: 'left', display: 'flex', alignItems: 'center', wordBreak: 'break-word', overflow: 'hidden' }}>Packing Size</div>
      <div style={{ border: 'none', padding: '1mm', textAlign: 'left', display: 'flex', alignItems: 'center', wordBreak: 'break-word', overflow: 'hidden' }}>Product Description</div>
      <div style={{ border: 'none', padding: '1mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', wordBreak: 'break-word', overflow: 'hidden', fontSize: '11pt', lineHeight: '1' }}>Qty<br/>(Cartons)</div>
      <div style={{ border: 'none', padding: '0.5mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', wordBreak: 'break-word', overflow: 'hidden', fontSize: '11pt', lineHeight: '1' }}>Rate Per<br/>Carton<br/>(USD)</div>
      <div style={{ border: 'none', padding: '0.5mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', wordBreak: 'break-word', overflow: 'hidden', fontSize: '11pt', lineHeight: '1' }}>Net Amount<br/>(USD)</div>
    </div>
  );

  // Helper function to render customer details section
  const renderCustomerDetails = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '56mm 56mm 58mm', gap: '0mm', marginBottom: '8mm', fontSize: '10pt', lineHeight: '1' }}>
      {/* Bill To Column */}
      <div>
        <div style={{ fontWeight: 'bold', marginBottom: '2mm', fontSize: '11pt' }}>Bill To</div>
        <div style={{ lineHeight: '1' }}>
          <div style={{ fontWeight: '500' }}>{customer?.name || 'Customer Name'}</div>
          {customer?.address && (
            <>
              <div>{customer.address.street}</div>
              <div>{customer.address.city}, {customer.address.state} {customer.address.zipCode}</div>
              <div>{customer.address.country}</div>
            </>
          )}
          <div>TEL : {customer?.phone || ''}</div>
        </div>
      </div>

      {/* Ship To Column */}
      <div>
        <div style={{ fontWeight: 'bold', marginBottom: '2mm', fontSize: '11pt' }}>Ship To</div>
        <div style={{ lineHeight: '1' }}>
          <div style={{ fontWeight: '500' }}>{customer?.name || 'Customer Name'}</div>
          {customer?.address && (
            <>
              <div>{customer.address.street}</div>
              <div>{customer.address.city}, {customer.address.state} {customer.address.zipCode}</div>
              <div>{customer.address.country}</div>
            </>
          )}
        </div>
      </div>

      {/* Invoice Details Column */}
      <div style={{ lineHeight: '1' }}>
        <div>Invoice No : {invoice?.invoiceNumber}</div>
        <div>Invoice Date : {formatDate(invoice?.invoiceDate?.toString())}</div>
        <div>Purchase Order No : -</div>
        <div>Payment Term : Net 30</div>
        <div>Shipping Info</div>
        <div>Ship Date : {invoice?.dueDate ? formatDate(invoice.dueDate.toString()) : formatDate(invoice?.invoiceDate?.toString())}</div>
      </div>
    </div>
  );

  // Helper function to render summary section
  const renderSummarySection = () => (
    <>
      {/* Summary Table - 2 column layout matching attached format - NO GAP */}
      <div className="summary-section" style={{ border: '1px solid black', width: '170mm', fontSize: '10pt', lineHeight: '1' }}>
        {/* Row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid black' }}>
          <div style={{ borderRight: '1px solid black', padding: '4mm', backgroundColor: '#f9f9f9' }}>
            <strong>Total Cartons</strong>
          </div>
          <div style={{ padding: '4mm', textAlign: 'right' }}>
            {calculateTotalCartons()}
          </div>
        </div>
        
        {/* Row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid black' }}>
          <div style={{ borderRight: '1px solid black', padding: '4mm' }}>
            <strong>Net Weight (KGS):</strong>
          </div>
          <div style={{ padding: '4mm', textAlign: 'right' }}>
            {calculateTotalNetWeight().toFixed(3)}
          </div>
        </div>
        
        {/* Row 3 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid black' }}>
          <div style={{ borderRight: '1px solid black', padding: '4mm', backgroundColor: '#f9f9f9' }}>
            <strong>Gross Weight (KGS):</strong>
          </div>
          <div style={{ padding: '4mm', textAlign: 'right' }}>
            {calculateTotalGrossWeight().toFixed(3)}
          </div>
        </div>
        
        {/* Row 4 - Amount in Words */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ borderRight: '1px solid black', padding: '4mm' }}>
            <strong>Amount in Words:</strong>
            <div style={{ marginTop: '2mm', fontSize: '10pt', fontWeight: 'normal' }}>
              {numberToWords(parseFloat(invoice?.total || '0'))}
            </div>
          </div>
          <div style={{ padding: '0mm' }}>
            {/* Right column nested table */}
            <div style={{ height: '100%' }}>
              {/* Net Amount */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid black', height: '33.33%' }}>
                <div style={{ padding: '4mm', backgroundColor: '#f9f9f9', borderRight: '1px solid black' }}>
                  <strong>Net Amount</strong>
                </div>
                <div style={{ padding: '4mm', textAlign: 'right' }}>
                  ${calculateSubtotal().toFixed(2)}
                </div>
              </div>
              
              {/* Freight */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid black', height: '33.33%' }}>
                <div style={{ padding: '4mm', borderRight: '1px solid black' }}>
                  <strong>Freight</strong>
                </div>
                <div style={{ padding: '4mm', textAlign: 'right' }}>
                  $0.00
                </div>
              </div>
              
              {/* Total Invoice Amount */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '33.34%' }}>
                <div style={{ padding: '4mm', backgroundColor: '#f9f9f9', borderRight: '1px solid black' }}>
                  <strong>Total Invoice Amount:</strong>
                </div>
                <div style={{ padding: '4mm', textAlign: 'right' }}>
                  ${parseFloat((invoice as any)?.total || '0').toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terms and Conditions - NO GAP */}
      <div className="terms-section" style={{ marginTop: '8mm', fontSize: '10pt', lineHeight: '1', textAlign: 'left' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '3mm', fontSize: '11pt' }}>Terms and Conditions:</div>
        <div>1. All Matters related to this invoice or the goods shall be governed by the laws of Pennsylvania, and all disputes related hereto shall be adjusted exclusively in the state or federal courts located in Pennsylvania.</div>
        <div>2. Overdues balances subject to finance charges of 2% per month.</div>
        <div>3. All Payments must be made to the company's official bank account only. The company will not be liable for cash payments or for overpayments exceeding the invoiced amount.</div>
        <div>4. Final Sale</div>
      </div>

      {/* Signature Lines - NO GAP */}
      <div className="signature-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15mm', marginTop: '8mm', fontSize: '10pt', lineHeight: '1' }}>
        <div>Received By (Name) : _____________</div>
        <div>Total Pallets : _____________</div>
        
        {/* Company Name - NO GAP */}
        <div style={{ gridColumn: '1 / -1', fontWeight: 'bold', fontSize: '12pt', textAlign: 'left', marginTop: '15mm' }}>
          Kitchen Xpress Overseas Inc.
        </div>
      </div>
    </>
  );

  return (
    <div className="container max-w-6xl mx-auto p-6">
      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4 mb-6 print-hide">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setLocation('/invoices')}
          data-testid="button-back-to-invoices"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>

        <div className="flex gap-2">
          <Button onClick={handlePrint} data-testid="button-print-invoice">
            <Printer className="h-4 w-4 mr-2" />
            Print Invoice
          </Button>
        </div>
      </div>

      {/* Invoice Content - Dynamic pagination */}
      <div className="invoice-print-content bg-white" style={{ width: '210mm', margin: '0 auto', fontFamily: 'Times New Roman, serif' }}>
        
        {/* Render data pages */}
        {pages.map((pageItems, pageIndex) => (
          <div 
            key={pageIndex} 
            style={{ 
              width: '210mm', 
              minHeight: '297mm', 
              padding: '50mm 20mm 40mm 20mm',
              pageBreakAfter: (pageIndex === pages.length - 1 && !summaryNeedsSeparatePage) ? 'auto' : 'always' 
            }}
          >
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10mm', fontSize: '12pt', fontWeight: 'bold', lineHeight: '1' }}>
              <div>INVOICE</div>
              <div style={{ fontSize: '10pt' }}>Page : {pageIndex + 1} of {totalPagesWithSummary}</div>
            </div>

            {/* Customer Details only on first page */}
            {pageIndex === 0 && renderCustomerDetails()}

            {/* Line Items Table - render even for zero items */}
            <div style={{ border: 'none', width: '170mm', marginLeft: '0', marginBottom: (pageIndex === pages.length - 1 && !summaryNeedsSeparatePage) ? '0' : '8mm' }}>
              {renderTableHeader()}
              
              {/* Table Rows - Data or empty row for zero items */}
              {pageItems.length > 0 ? (
                pageItems.map((item: InvoiceLineItem, itemIndex: number) => {
                  const globalIndex = pageIndex * itemsPerPage + itemIndex;
                  return (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '9.09mm 25.45mm 20.00mm 68.18mm 17.27mm 10.00mm 20.00mm', border: 'none', fontSize: '10pt', minHeight: '8mm', lineHeight: '1' }}>
                      <div style={{ border: 'none', padding: '1mm', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{globalIndex + 1}</div>
                      <div style={{ border: 'none', padding: '1mm', textAlign: 'left', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>{item.productCode || '-'}</div>
                      <div style={{ border: 'none', padding: '1mm', textAlign: 'left', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>{item.packingSize || '-'}</div>
                      <div style={{ border: 'none', padding: '1mm', textAlign: 'left', display: 'flex', alignItems: 'flex-start', overflow: 'hidden', lineHeight: '1', wordWrap: 'break-word', whiteSpace: 'normal' }}>
                        <div style={{ overflow: 'hidden' }}>{item.description}</div>
                      </div>
                      <div style={{ border: 'none', padding: '1mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>{item.quantity}</div>
                      <div style={{ border: 'none', padding: '0.5mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>{parseFloat(item.unitPrice).toFixed(2)}</div>
                      <div style={{ padding: '0.5mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>{parseFloat(item.lineTotal).toFixed(2)}</div>
                    </div>
                  );
                })
              ) : (
                // Empty row for zero items case
                <div style={{ display: 'grid', gridTemplateColumns: '9.09mm 25.45mm 20.00mm 68.18mm 17.27mm 10.00mm 20.00mm', border: 'none', fontSize: '10pt', minHeight: '20mm', lineHeight: '1' }}>
                  <div style={{ border: 'none', padding: '1mm', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>-</div>
                  <div style={{ border: 'none', padding: '1mm', textAlign: 'left', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>-</div>
                  <div style={{ border: 'none', padding: '1mm', textAlign: 'left', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>-</div>
                  <div style={{ border: 'none', padding: '1mm', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontStyle: 'italic' }}>No items</div>
                  <div style={{ border: 'none', padding: '1mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>-</div>
                  <div style={{ border: 'none', padding: '0.5mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>-</div>
                  <div style={{ padding: '0.5mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>-</div>
                </div>
              )}
            </div>

            {/* Summary section on last data page if it fits */}
            {pageIndex === pages.length - 1 && !summaryNeedsSeparatePage && renderSummarySection()}
          </div>
        ))}
        
        {/* Separate summary page if needed */}
        {summaryNeedsSeparatePage && (
          <div 
            style={{ 
              width: '210mm', 
              minHeight: '297mm', 
              padding: '50mm 20mm 40mm 20mm',
              pageBreakAfter: 'auto' 
            }}
          >
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10mm', fontSize: '12pt', fontWeight: 'bold' }}>
              <div>INVOICE</div>
              <div style={{ fontSize: '10pt' }}>Page : {totalPagesWithSummary} of {totalPagesWithSummary}</div>
            </div>

            {/* Summary section on dedicated page */}
            {renderSummarySection()}
          </div>
        )}

      </div>
    </div>
  );
}

export default InvoiceView;