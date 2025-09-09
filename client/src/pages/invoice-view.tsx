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
  const { data: invoice, isLoading: invoiceLoading } = useQuery({
    queryKey: [`/api/invoices/${id}`],
    enabled: !!id
  });

  // Fetch line items
  const { data: lineItems, isLoading: lineItemsLoading } = useQuery({
    queryKey: [`/api/invoices/${id}/line-items`],
    enabled: !!id
  });

  // Fetch customer data
  const { data: customer, isLoading: customerLoading } = useQuery({
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
          height: 297mm;
          margin: 0;
          padding: 0;
          background: white;
        }
        .print-hide {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
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
    return lineItems?.reduce((total, item) => total + item.quantity, 0) || 0;
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

      {/* Invoice Content - Page Layout with Fixed Footer */}
      <div className="invoice-print-content bg-white" style={{ width: '210mm', minHeight: '297mm', margin: '0 auto', padding: '50mm 20mm 0mm 20mm', fontFamily: 'Arial, sans-serif', position: 'relative' }}>
        
        {/* Main Content Area */}
        <div style={{ minHeight: '180mm', paddingBottom: '10mm' }}>
          {/* Header Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10mm', fontSize: '16px', fontWeight: 'bold' }}>
            <div>INVOICE</div>
            <div style={{ fontSize: '14px' }}>Page : 1 of 1</div>
          </div>

          {/* Customer and Invoice Details Section - 3 column layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '56mm 56mm 58mm', gap: '0mm', marginBottom: '8mm', fontSize: '10px' }}>
            
            {/* Bill To Column */}
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '2mm' }}>Bill To</div>
              <div style={{ lineHeight: '1.2' }}>
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
              <div style={{ fontWeight: 'bold', marginBottom: '2mm' }}>Ship To</div>
              <div style={{ lineHeight: '1.2' }}>
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
            <div style={{ lineHeight: '1.3' }}>
              <div>Invoice No : {invoice.invoiceNumber}</div>
              <div>Invoice Date : {formatDate(invoice.invoiceDate.toString())}</div>
              <div>Purchase Order No : -</div>
              <div>Payment Term : Net 30</div>
              <div>Shipping Info</div>
              <div>Ship Date : {invoice.dueDate ? formatDate(invoice.dueDate.toString()) : formatDate(invoice.invoiceDate.toString())}</div>
            </div>
          </div>

          {/* Line Items Table - 7 columns with exact specifications (170mm total width) */}
          <div style={{ border: '1px solid black', marginBottom: '8mm', width: '170mm', marginLeft: '0' }}>
            
            {/* Table Header - Height 10mm, Font 9.5pt bold */}
            <div style={{ display: 'grid', gridTemplateColumns: '9.09mm 25.45mm 20.00mm 68.18mm 17.27mm 10.00mm 20.00mm', backgroundColor: '#f5f5f5', borderBottom: '1px solid black', fontSize: '9.5pt', fontWeight: 'bold', height: '10mm' }}>
              <div style={{ borderRight: '1px solid black', padding: '1mm', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', wordBreak: 'break-word', overflow: 'hidden' }}>Sr. No</div>
              <div style={{ borderRight: '1px solid black', padding: '1mm', textAlign: 'left', display: 'flex', alignItems: 'center', wordBreak: 'break-word', overflow: 'hidden' }}>Item Code</div>
              <div style={{ borderRight: '1px solid black', padding: '1mm', textAlign: 'left', display: 'flex', alignItems: 'center', wordBreak: 'break-word', overflow: 'hidden' }}>Packing Size</div>
              <div style={{ borderRight: '1px solid black', padding: '1mm', textAlign: 'left', display: 'flex', alignItems: 'center', wordBreak: 'break-word', overflow: 'hidden' }}>Product Description</div>
              <div style={{ borderRight: '1px solid black', padding: '1mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', wordBreak: 'break-word', overflow: 'hidden', fontSize: '8pt', lineHeight: '1.1' }}>Qty<br/>(Cartons)</div>
              <div style={{ borderRight: '1px solid black', padding: '0.5mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', wordBreak: 'break-word', overflow: 'hidden', fontSize: '7pt', lineHeight: '1.1' }}>Rate Per<br/>Carton<br/>(USD)</div>
              <div style={{ padding: '0.5mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', wordBreak: 'break-word', overflow: 'hidden', fontSize: '8pt', lineHeight: '1.1' }}>Net Amount<br/>(USD)</div>
            </div>

            {/* Table Rows - Data - Minimum height 8mm */}
            {lineItems?.map((item: InvoiceLineItem, index: number) => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '9.09mm 25.45mm 20.00mm 68.18mm 17.27mm 10.00mm 20.00mm', borderBottom: '1px solid black', fontSize: '8pt', minHeight: '8mm' }}>
                <div style={{ borderRight: '1px solid black', padding: '1mm', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{index + 1}</div>
                <div style={{ borderRight: '1px solid black', padding: '1mm', textAlign: 'left', display: 'flex', alignItems: 'center', overflow: 'hidden', fontSize: '7pt' }}>{item.productCode || '-'}</div>
                <div style={{ borderRight: '1px solid black', padding: '1mm', textAlign: 'left', display: 'flex', alignItems: 'center', overflow: 'hidden', fontSize: '7pt' }}>{item.packingSize || '-'}</div>
                <div style={{ borderRight: '1px solid black', padding: '1mm', textAlign: 'left', display: 'flex', alignItems: 'flex-start', overflow: 'hidden', fontSize: '7pt', lineHeight: '1.2', wordWrap: 'break-word', whiteSpace: 'normal' }}>
                  <div style={{ overflow: 'hidden' }}>{item.description}</div>
                </div>
                <div style={{ borderRight: '1px solid black', padding: '1mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>{item.quantity}</div>
                <div style={{ borderRight: '1px solid black', padding: '0.5mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', fontSize: '7pt' }}>{parseFloat(item.unitPrice).toFixed(2)}</div>
                <div style={{ padding: '0.5mm', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', fontSize: '7pt' }}>{parseFloat(item.lineTotal).toFixed(2)}</div>
              </div>
            ))}

            {/* Empty Rows */}
            {Array.from({ length: Math.max(0, 15 - (lineItems?.length || 0)) }).map((_, index) => (
              <div key={`empty-${index}`} style={{ display: 'grid', gridTemplateColumns: '9.09mm 25.45mm 20.00mm 68.18mm 17.27mm 10.00mm 20.00mm', borderBottom: '1px solid black', fontSize: '8pt', minHeight: '8mm' }}>
                <div style={{ borderRight: '1px solid black', padding: '1mm', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(lineItems?.length || 0) + index + 1}</div>
                <div style={{ borderRight: '1px solid black', padding: '1mm' }}></div>
                <div style={{ borderRight: '1px solid black', padding: '1mm' }}></div>
                <div style={{ borderRight: '1px solid black', padding: '1mm' }}></div>
                <div style={{ borderRight: '1px solid black', padding: '1mm' }}></div>
                <div style={{ borderRight: '1px solid black', padding: '1mm' }}></div>
                <div style={{ padding: '1mm' }}></div>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed Footer Section - Always visible on every page */}
        <div style={{ position: 'absolute', bottom: '40mm', left: '20mm', right: '20mm', fontSize: '10px' }}>
          
          {/* Summary Table - 2 rows with horizontal layout */}
          <div style={{ border: '1px solid black', marginBottom: '5mm', width: '170mm' }}>
            {/* Row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderBottom: '1px solid black', padding: '2mm', backgroundColor: '#f9f9f9' }}>
              <div style={{ borderRight: '1px solid black', paddingRight: '2mm' }}>
                <strong>Total Cartons:</strong> {calculateTotalCartons()}
              </div>
              <div style={{ borderRight: '1px solid black', paddingRight: '2mm', paddingLeft: '2mm' }}>
                <strong>Net Amount:</strong> ${calculateSubtotal().toFixed(2)}
              </div>
              <div style={{ borderRight: '1px solid black', paddingRight: '2mm', paddingLeft: '2mm' }}>
                <strong>Net Weight (KGS):</strong> {calculateTotalNetWeight().toFixed(3)}
              </div>
              <div style={{ paddingLeft: '2mm' }}>
                <strong>Freight:</strong> $0.00
              </div>
            </div>
            
            {/* Row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '2mm' }}>
              <div style={{ borderRight: '1px solid black', paddingRight: '2mm' }}>
                <strong>Gross Weight (KGS):</strong> {calculateTotalGrossWeight().toFixed(3)}
              </div>
              <div style={{ borderRight: '1px solid black', paddingRight: '2mm', paddingLeft: '2mm' }}>
                <strong>Total Invoice Amount:</strong> ${parseFloat(invoice.total).toFixed(2)}
              </div>
              <div style={{ borderRight: '1px solid black', paddingRight: '2mm', paddingLeft: '2mm' }}>
                <strong>Gross Weight (LBS):</strong> {(calculateTotalGrossWeight() * 2.20462).toFixed(3)}
              </div>
              <div style={{ paddingLeft: '2mm' }}>
                <strong>Amount In Words:</strong>
              </div>
            </div>
          </div>

          {/* Amount in Words - Full Width */}
          <div style={{ marginBottom: '5mm', padding: '2mm', border: '1px solid black', backgroundColor: '#f9f9f9' }}>
            <div style={{ fontWeight: 'bold', fontSize: '9px' }}>Amount In Words:</div>
            <div style={{ fontSize: '9px', marginTop: '1mm' }}>{numberToWords(parseFloat(invoice.total))}</div>
          </div>

          {/* Terms and Conditions */}
          <div style={{ marginBottom: '5mm', fontSize: '8px', lineHeight: '1.2' }}>
            <div>1. All Matters related to this invoice or the goods shall be governed by the laws of Pennsylvania, and all disputes related hereto shall be adjusted exclusively in the state or federal courts located in Pennsylvania.</div>
            <div>2. Overdues balances subject to finance charges of 2% per month.</div>
            <div>3. All Payments must be made to the company's official bank account only. The company will not be liable for cash payments or for overpayments exceeding the invoiced amount.</div>
            <div>4. Final Sale</div>
          </div>

          {/* Signature Lines */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10mm', marginBottom: '3mm' }}>
            <div>Received By (Name) : _____________</div>
            <div>Total Pallets : _____________</div>
          </div>

          {/* Company Name */}
          <div style={{ fontWeight: 'bold', fontSize: '12px', textAlign: 'center' }}>
            Kitchen Xpress Overseas Inc.
          </div>
        </div>

      </div>
    </div>
  );
}

export default InvoiceView;