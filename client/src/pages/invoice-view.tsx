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
          width: 100%;
          height: 100%;
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
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handlePrint = () => {
    window.print();
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

      {/* Invoice Content - Ready for your custom formatting */}
      <div className="invoice-print-content bg-white">
        {/* 
          TODO: Add your custom invoice formatting here
          Available data:
          - invoice: Contains invoice details (invoiceNumber, invoiceDate, total, etc.)
          - customer: Contains customer information (name, address, phone, etc.)
          - lineItems: Array of invoice line items
        */}
        
        <div className="p-8">
          <h1 className="text-2xl font-bold mb-6">Invoice Preview</h1>
          
          {/* Basic invoice info for reference */}
          <div className="mb-4">
            <p><strong>Invoice Number:</strong> {invoice.invoiceNumber}</p>
            <p><strong>Date:</strong> {new Date(invoice.invoiceDate).toLocaleDateString()}</p>
            <p><strong>Total:</strong> ${parseFloat(invoice.total).toFixed(2)}</p>
          </div>
          
          {customer && (
            <div className="mb-4">
              <p><strong>Customer:</strong> {customer.name}</p>
              {customer.address && (
                <div>
                  <p>{customer.address.street}</p>
                  <p>{customer.address.city}, {customer.address.state} {customer.address.zipCode}</p>
                  <p>{customer.address.country}</p>
                </div>
              )}
            </div>
          )}
          
          {lineItems && lineItems.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Line Items:</h3>
              <ul>
                {lineItems.map((item, index) => (
                  <li key={item.id} className="mb-1">
                    {index + 1}. {item.description} - Qty: {item.quantity} - ${parseFloat(item.lineTotal).toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="mt-8 p-4 bg-gray-100 rounded">
            <p className="text-sm text-gray-600">
              This is a placeholder view. Add your custom invoice formatting code here.
              The Print button will print whatever content is in this invoice-print-content div.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InvoiceView;