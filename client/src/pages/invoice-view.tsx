// invoice-view.tsx
import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Invoice, InvoiceLineItem, Customer } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';

function formatCurrency(num: number) {
  if (Number.isNaN(num) || num === null || num === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

function toNumber(v: any) {
  const n = typeof v === 'number' ? v : parseFloat(String(v || '0'));
  return Number.isFinite(n) ? n : 0;
}

// Simple integer portion to words
function numberToWords(num: number): string {
  if (num === 0) return 'zero';
  const a = [
    '', 'one','two','three','four','five','six','seven','eight','nine','ten','eleven',
    'twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'
  ];
  const b = ['', '', 'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  const thousand = ['','thousand','million','billion'];
  function chunk(n: number) {
    const words: string[] = [];
    if (n >= 100) {
      words.push(a[Math.floor(n/100)], 'hundred');
      n = n % 100;
    }
    if (n >= 20) {
      words.push(b[Math.floor(n/10)]);
      if (n % 10) words.push(a[n % 10]);
    } else if (n > 0) {
      words.push(a[n]);
    }
    return words.join(' ');
  }
  let wordParts: string[] = [];
  let i = 0;
  while (num > 0) {
    const rem = num % 1000;
    if (rem) {
      wordParts.unshift(chunk(rem) + (thousand[i] ? ' ' + thousand[i] : ''));
    }
    num = Math.floor(num / 1000);
    i++;
  }
  return wordParts.join(' ').replace(/\s+/g, ' ').trim();
}

function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: invoice, isLoading: invoiceLoading } = useQuery<Invoice>({
    queryKey: [`/api/invoices/${id}`],
    enabled: !!id
  });

  const { data: lineItemsRaw, isLoading: lineItemsLoading } = useQuery<InvoiceLineItem[]>({
    queryKey: [`/api/invoices/${id}/line-items`],
    enabled: !!id
  });

  const { data: customer, isLoading: customerLoading } = useQuery<Customer>({
    queryKey: [`/api/customers/${invoice?.customerId}`],
    enabled: !!invoice?.customerId
  });

  const isLoading = invoiceLoading || lineItemsLoading || customerLoading;

  const lineItems = (lineItemsRaw || []).map(item => ({
    ...item,
    quantity: toNumber((item as any).quantity),
    unitPrice: toNumber((item as any).unitPrice),
    lineTotal: toNumber((item as any).lineTotal),
    packingSize: (item as any).packingSize || '',
    productCode: (item as any).productCode || '',
    netWeightKgs: toNumber((item as any).netWeightKgs),
    grossWeightKgs: toNumber((item as any).grossWeightKgs),
  }));

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'invoice-print-styles';
    style.textContent = `
      @media print {
        @page { size: A4; margin: 15mm; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .invoice-page { box-shadow: none; margin: 0; width: auto; min-height: auto; }
        .page-break { page-break-after: always; }
      }
      .invoice-page { width: 210mm; min-height: 297mm; margin: 10px auto; padding: 16mm; background: white; box-sizing: border-box; }
      .company-name { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
      .small-label { font-size: 12px; color: #374151; }
      table.invoice-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      table.invoice-table th, table.invoice-table td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top; }
      table.invoice-table thead th { background: #f3f4f6; font-weight: 600; }
      .totals { width: 320px; float: right; margin-top: 12px; }
      .terms { font-size: 11px; color: #6b7280; margin-top: 12px; }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById('invoice-print-styles');
      if (el) document.head.removeChild(el);
    };
  }, []);

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => setLocation('/invoices')}>
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
          <Button variant="outline" size="sm" onClick={() => setLocation('/invoices')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
        </div>
        <div className="text-center py-8">Invoice not found</div>
      </div>
    );
  }

  const totalCartons = lineItems.reduce((s, it) => s + (it.quantity || 0), 0);
  const netAmount = lineItems.reduce((s, it) => s + (toNumber(it.lineTotal)), 0);
  const netWeightKgs = lineItems.reduce((s, it) => s + ((it.netWeightKgs || 0) * (it.quantity || 0)), 0);
  const grossWeightKgs = lineItems.reduce((s, it) => s + ((it.grossWeightKgs || 0) * (it.quantity || 0)), 0);
  const freight = toNumber((invoice as any).freight || (invoice as any).freightAmount || 0);
  const totalInvoiceAmount = netAmount + freight;
  const grossWeightLbs = grossWeightKgs * 2.20462;

  const itemsPerPage = 14;
  const pageCount = Math.max(1, Math.ceil(lineItems.length / itemsPerPage));
  const pages = Array.from({ length: pageCount }).map((_, pIndex) =>
    lineItems.slice(pIndex * itemsPerPage, (pIndex + 1) * itemsPerPage)
  );

  // build address strings for Bill To / Ship To
  const billAddress = customer?.address || (invoice as any).billToAddress;
  const shipAddress = (invoice as any).shipToAddress;

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between gap-4 mb-6 print-hide">
        <Button variant="outline" size="sm" onClick={() => setLocation('/invoices')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>
        <div className="flex gap-2">
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print Invoice
          </Button>
        </div>
      </div>

      {pages.map((pageItems, pageIndex) => (
        <div key={pageIndex} className={`invoice-page bg-white ${pageIndex < pages.length - 1 ? 'page-break' : ''}`}>
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="company-name">Kitchen Xpress Overseas Inc.</div>
              <div className="small-label">14001 Townsend Rd. Philadelphia, PA 19154-1007</div>
              <div className="small-label">Phone - +1 (267) 667 4923 | Fax: +1 (445) 776 5416 | Email: info@kxol.us</div>
            </div>
            <div className="text-right">
              <div style={{ fontSize: 20, fontWeight: 700 }}>INVOICE</div>
              <div className="small-label">Page : {pageIndex + 1} of {pages.length}</div>
            </div>
          </div>

          {/* Bill To / Ship To */}
          <div className="grid grid-cols-12 gap-4 mb-4">
            <div className="col-span-5">
              <div className="font-semibold">Bill To</div>
              <div className="mt-1">
                <div>{customer?.name || (invoice as any).billToName || '—'}</div>
                {billAddress && (
                  <div className="small-label">
                    {billAddress.street && <div>{billAddress.street}</div>}
                    {billAddress.city && (
                      <div>{billAddress.city}{billAddress.state ? `, ${billAddress.state}` : ''} {billAddress.zipCode || ''}</div>
                    )}
                    {billAddress.country && <div>{billAddress.country}</div>}
                  </div>
                )}
                {((customer as any)?.phone || (invoice as any).billToPhone) && (
                  <div className="small-label">TEL : {(customer as any)?.phone || (invoice as any).billToPhone}</div>
                )}
              </div>
            </div>

            <div className="col-span-5">
              <div className="font-semibold">Ship To</div>
              <div className="mt-1">
                <div>{(invoice as any).shipToName || customer?.name || '—'}</div>
                {shipAddress && (
                  <div className="small-label">
                    {typeof shipAddress === 'string' ? shipAddress : (
                      <>
                        {shipAddress.street && <div>{shipAddress.street}</div>}
                        {shipAddress.city && (
                          <div>{shipAddress.city}{shipAddress.state ? `, ${shipAddress.state}` : ''} {shipAddress.zipCode || ''}</div>
                        )}
                        {shipAddress.country && <div>{shipAddress.country}</div>}
                      </>
                    )}
                  </div>
                )}
                {((invoice as any).shipToPhone) && (
                  <div className="small-label">TEL : {(invoice as any).shipToPhone}</div>
                )}
              </div>
            </div>

            <div className="col-span-2 text-right">
              <div className="small-label"><strong>Invoice No :</strong></div>
              <div className="mb-2">{invoice.invoiceNumber}</div>

              <div className="small-label"><strong>Invoice Date :</strong></div>
              <div className="mb-2">{new Date(invoice.invoiceDate).toLocaleDateString()}</div>

              <div className="small-label"><strong>Purchase Order No :</strong></div>
              <div className="mb-2">{(invoice as any).purchaseOrderNo || (invoice as any).poNumber || '—'}</div>

              <div className="small-label"><strong>Payment Term :</strong></div>
              <div className="mb-2">{(invoice as any).paymentTerm || '—'}</div>

              <div className="small-label"><strong>Ship Date :</strong></div>
              <div>{(invoice as any).shipDate ? new Date((invoice as any).shipDate).toLocaleDateString() : ((invoice as any).shipDateText || '—')}</div>
            </div>
          </div>

          {/* Table */}
          <table className="invoice-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>Sr. No</th>
                <th style={{ width: '13%' }}>Item Code</th>
                <th style={{ width: '12%' }}>Packing Size</th>
                <th style={{ width: '40%' }}>Product Description</th>
                <th style={{ width: '8%' }}>Qty (Cartons)</th>
                <th style={{ width: '11%' }}>Rate Per Carton (USD)</th>
                <th style={{ width: '11%' }}>Net Amount (USD)</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center small-label">No items</td>
                </tr>
              )}
              {pageItems.map((item, idx) => {
                const globalIndex = pageIndex * itemsPerPage + idx;
                const qty = toNumber(item.quantity);
                const rate = toNumber(item.unitPrice);
                const lineTotal = toNumber(item.lineTotal);
                const isFree = !!(item as any).isFreeFromScheme;
                return (
                  <tr key={item.id || globalIndex}>
                    <td className="text-center">{globalIndex + 1}</td>
                    <td>{item.productCode || (item as any).itemCode || '—'}</td>
                    <td>{item.packingSize || '—'}</td>
                    <td>
                      <div>{item.description}</div>
                      {isFree && <div className="small-label">FREE (Promotional)</div>}
                    </td>
                    <td className="text-center">{qty || '—'}</td>
                    <td className="text-right">{isFree ? 'FREE' : formatCurrency(rate)}</td>
                    <td className="text-right">{isFree ? 'FREE' : formatCurrency(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals (only on last page) */}
          {pageIndex === pages.length - 1 && (
            <>
              <div className="mt-4">
                <table style={{ width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '60%' }} className="small-label">
                        <div><strong>Total Cartons :</strong> {totalCartons} (Auto Cal)</div>
                        <div><strong>Net Weight (KGS) :</strong> {netWeightKgs.toFixed(2)} (Auto Cal)</div>
                        <div><strong>Gross Weight (KGS) :</strong> {grossWeightKgs.toFixed(2)} (Auto Cal)</div>
                        <div><strong>Gross Weight (LBS) :</strong> {grossWeightLbs.toFixed(2)}</div>
                      </td>
                      <td style={{ width: '40%', verticalAlign: 'top' }}>
                        <div className="totals">
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                              <tr>
                                <td style={{ padding: '6px 8px', border: '1px solid #d1d5db' }}>Net Amount</td>
                                <td style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'right' }}>{formatCurrency(netAmount)}</td>
                              </tr>
                              <tr>
                                <td style={{ padding: '6px 8px', border: '1px solid #d1d5db' }}>Freight</td>
                                <td style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'right' }}>{formatCurrency(freight)}</td>
                              </tr>
                              <tr>
                                <td style={{ padding: '6px 8px', border: '1px solid #d1d5db', fontWeight: 700 }}>Total Invoice Amount</td>
                                <td style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(totalInvoiceAmount)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 small-label">
                <div><strong>Amount In Words :</strong> {`${numberToWords(Math.floor(totalInvoiceAmount)).toUpperCase()} DOLLARS${((totalInvoiceAmount % 1) > 0) ? ` AND ${(Math.round((totalInvoiceAmount % 1)*100)).toString().padStart(2,'0')}/100` : ''}`}</div>
              </div>

              <div className="terms">
                <ol className="list-decimal pl-5">
                  <li>All Matters related to this invoice or the goods shall be governed by the laws of Pennsylvania, and all disputes related hereto shall be adjusted exclusively in the state or federal courts located in Pennsylvania.</li>
                  <li>Overdues balances subject to finance charges of 2% per month.</li>
                  <li>All Payments must be made to the company's official bank account only. The company will not be liable for cash payments or for overpayments exceeding the invoiced amount.</li>
                  <li>Final Sale.</li>
                </ol>

                <div className="mt-4">
                  <div>Received By (Name) : ____________________</div>
                  <div className="mt-2">Total Pallets : ____________</div>
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default InvoiceView;