// invoice-view.tsx
import { useEffect } from "react";
import React from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Invoice, InvoiceLineItem, Customer } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Package } from "lucide-react";

function formatCurrency(num: number) {
  if (Number.isNaN(num) || num === null || num === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}
function toNumber(v: any) {
  const n = typeof v === "number" ? v : parseFloat(String(v || "0"));
  return Number.isFinite(n) ? n : 0;
}
function numberToWords(num: number): string {
  if (num === 0) return "zero";
  const a = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const b = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  const thousand = ["", "thousand", "million", "billion"];
  function chunk(n: number) {
    const words: string[] = [];
    if (n >= 100) {
      words.push(a[Math.floor(n / 100)], "hundred");
      n = n % 100;
    }
    if (n >= 20) {
      words.push(b[Math.floor(n / 10)]);
      if (n % 10) words.push(a[n % 10]);
    } else if (n > 0) {
      words.push(a[n]);
    }
    return words.join(" ");
  }
  let wordParts: string[] = [];
  let i = 0;
  while (num > 0) {
    const rem = num % 1000;
    if (rem) {
      wordParts.unshift(chunk(rem) + (thousand[i] ? " " + thousand[i] : ""));
    }
    num = Math.floor(num / 1000);
    i++;
  }
  return wordParts.join(" ").replace(/\s+/g, " ").trim();
}

function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: invoice, isLoading: invoiceLoading } = useQuery<Invoice>({
    queryKey: [`/api/invoices/${id}`],
    enabled: !!id,
  });

  const { data: lineItemsRaw, isLoading: lineItemsLoading } = useQuery<
    InvoiceLineItem[]
  >({ queryKey: [`/api/invoices/${id}/line-items`], enabled: !!id });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["/api/products"],
    enabled: !!id,
  });

  const isLoading = invoiceLoading || lineItemsLoading || productsLoading;
  
  // Create a mapping from productId to product name
  const productMap = new Map();
  if (products) {
    products.forEach((product: any) => {
      productMap.set(product.id, product.name);
    });
  }
  
  const rawLineItems = (lineItemsRaw || []).map((item) => ({
    ...item,
    quantity: toNumber((item as any).quantity),
    unitPrice: toNumber((item as any).unitPrice),
    lineTotal: toNumber((item as any).lineTotal),
    packingSize: (item as any).packingSize || "",
    productCode: (item as any).productCode || "",
    netWeightKgs: toNumber((item as any).netWeightKgs),
    grossWeightKgs: toNumber((item as any).grossWeightKgs),
    category: (item as any).category || "",
  }));

  // fix Uncategorized by inheriting from matching product
  for (const item of rawLineItems) {
    if (!item.category || String(item.category).trim() === "") {
      const match = rawLineItems.find(
        (other) =>
          other.productCode &&
          other.productCode === item.productCode &&
          other.category,
      );
      if (match) {
        item.category = match.category;
      }
    }
  }

  // merge duplicates (like freebies showing multiple times)
  const itemMap = new Map<string, any>();
  for (const item of rawLineItems) {
    const key = `${item.productCode || item.description}::${item.unitPrice}`;
    if (itemMap.has(key)) {
      const acc = itemMap.get(key);
      acc.quantity = toNumber(acc.quantity) + toNumber(item.quantity);
      acc.lineTotal = toNumber(acc.lineTotal) + toNumber(item.lineTotal);
    } else {
      itemMap.set(key, { ...item });
    }
  }
  const lineItems = Array.from(itemMap.values());
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "invoice-print-styles";
    style.textContent = `
     @media print {
        /* more top & bottom margin to fit letterhead header/footer */
        @page { size: A4; margin: 35mm 15mm 30mm 15mm; }
        .invoice-page { box-shadow: none; border: none; margin: 0; width: auto; min-height: auto; }
        .page-break { page-break-after: always; }
        .print-hide { display: none !important; }
        
        /* Only remove table borders while preserving other formatting */
        table.invoice-table, table.invoice-table th, table.invoice-table td { 
          border: 0 !important; 
        }
        table.invoice-table { 
          border-collapse: separate !important; 
          border-spacing: 0 !important; 
        }
        table.invoice-table thead th {
          page-break-after: avoid;
        }
        table.invoice-table tbody tr { 
          page-break-inside: avoid; 
        }
      }
      .invoice-page {
        width: 210mm;
        min-height: 297mm;
        margin: 10px auto;
        /* padding adjusted to match header/footer blank area */
        padding: 35mm 16mm 30mm 16mm;
        background: white;
        box-sizing: border-box;
        font-family: Calibri, sans-serif;
        box-shadow: none; /* removes the outer border/shadow */
        border: none;     /* removes any border */
      }
      .small-label { font-size: 12px; color: #374151; }
      table.invoice-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        font-family: Calibri, sans-serif;
      }
      table.invoice-table th, table.invoice-table td {
        padding: 6px 8px;
        vertical-align: top;
        border: 0;
      }
      table.invoice-table thead th {
        background: #f3f4f6;
        font-weight: 600;
      }
      
      /* Add borders only for screen view */
      @media screen {
        table.invoice-table th, table.invoice-table td {
          border: 1px solid #d1d5db;
        }
      }
      .totals { width: 320px; float: right; margin-top: 12px; }
      .terms { font-size: 11px; color: #6b7280; margin-top: 12px; }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById("invoice-print-styles");
      if (el) document.head.removeChild(el);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation("/invoices")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>
        <div className="text-center py-8">Loading invoice...</div>
      </div>
    );
  }
  if (!invoice) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation("/invoices")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>
        <div className="text-center py-8">Invoice not found</div>
      </div>
    );
  }

  const totalCartons = lineItems.reduce((s, it) => s + (it.quantity || 0), 0);
  const netAmount = lineItems.reduce((s, it) => s + toNumber(it.lineTotal), 0);
  const netWeightKgs = lineItems.reduce(
    (s, it) => s + (it.netWeightKgs || 0) * (it.quantity || 0),
    0,
  );
  const grossWeightKgs = lineItems.reduce(
    (s, it) => s + (it.grossWeightKgs || 0) * (it.quantity || 0),
    0,
  );
  const freight = toNumber(
    (invoice as any).freight || (invoice as any).freightAmount || 0,
  );
  const totalInvoiceAmount = netAmount + freight;
  const grossWeightLbs = grossWeightKgs * 2.20462;

  // 14 rows first page, continuous SR numbers
  const firstPageRows = 14;
  const otherPageRows = 15;

  let pages: { rows: any[]; blanks: any[]; startIndex: number }[] = [];
  let start = 0;

  // page 1
  const sliceFirst = lineItems.slice(start, start + firstPageRows);
  const blanksFirst = Array.from({
    length: Math.max(0, firstPageRows - sliceFirst.length),
  }).map(() => null);
  pages.push({ rows: sliceFirst, blanks: blanksFirst, startIndex: start });
  start += sliceFirst.length;

  // pages 2+
  while (start < lineItems.length) {
    const slice = lineItems.slice(start, start + otherPageRows);
    const blanks = Array.from({
      length: Math.max(0, otherPageRows - slice.length),
    }).map(() => null);
    pages.push({ rows: slice, blanks, startIndex: start });
    start += slice.length;
  }

  const billAddress =
    (invoice as any).customer?.address || (invoice as any).billToAddress;
  const shipAddress = (invoice as any).shipToAddress;

  const handlePrint = () => window.print();

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between gap-4 mb-6 print-hide">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation("/invoices")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setLocation(`/invoices/${id}/packing-list`)}
            data-testid="button-packing-list"
          >
            <Package className="h-4 w-4 mr-2" />
            View Packing List
          </Button>
          <Button onClick={handlePrint} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />
            Print Invoice
          </Button>
        </div>
      </div>

      {pages.map((page, pageIndex) => (
        <div
          key={pageIndex}
          className={`invoice-page bg-white ${pageIndex < pages.length - 1 ? "page-break" : ""}`}
        >
          {/* Title & page number */}
          <div className="mb-2 relative">
            <div className="text-center font-bold text-lg">INVOICE</div>
            <div className="absolute right-0 top-0 small-label">
              Page : {pageIndex + 1} of {pages.length}
            </div>
          </div>

          {/* Bill To / Ship To / Invoice Details */}
          <div className="grid grid-cols-12 gap-4 mb-4">
            <div className="col-span-4">
              <div className="font-semibold">Bill To</div>
              <div className="mt-1">
                <div>
                  {(invoice as any).customer?.name ||
                    (invoice as any).billToName ||
                    "—"}
                </div>
                {billAddress && (
                  <div className="small-label">
                    {billAddress.street && <div>{billAddress.street}</div>}
                    {billAddress.city && (
                      <div>
                        {billAddress.city}
                        {billAddress.state ? `, ${billAddress.state}` : ""}{" "}
                        {billAddress.zipCode || ""}
                      </div>
                    )}
                    {billAddress.country && <div>{billAddress.country}</div>}
                  </div>
                )}
              </div>
            </div>
            <div className="col-span-4">
              <div className="font-semibold">Ship To</div>
              <div className="mt-1">
                <div>
                  {(invoice as any).shipToName ||
                    (invoice as any).customer?.name ||
                    "—"}
                </div>
                {shipAddress && (
                  <div className="small-label">
                    {typeof shipAddress === "string" ? (
                      shipAddress
                    ) : (
                      <>
                        {shipAddress.street && <div>{shipAddress.street}</div>}
                        {shipAddress.city && (
                          <div>
                            {shipAddress.city}
                            {shipAddress.state
                              ? `, ${shipAddress.state}`
                              : ""}{" "}
                            {shipAddress.zipCode || ""}
                          </div>
                        )}
                        {shipAddress.country && (
                          <div>{shipAddress.country}</div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="col-span-4 small-label">
              <div className="font-semibold">Invoice Details</div>
              <div>
                <strong>Invoice No. :</strong> {invoice.invoiceNumber}
              </div>
              <div>
                <strong>Shipping Info :</strong>{" "}
                {(invoice as any).purchaseOrderNo ||
                  (invoice as any).poNumber ||
                  "—"}
              </div>
              <div>
                <strong>Ship Date :</strong>{" "}
                {(invoice as any).shipDate
                  ? new Date((invoice as any).shipDate).toLocaleDateString()
                  : "—"}
              </div>
            </div>
          </div>

          {/* Table */}
          <table className="invoice-table">
            <thead>
              <tr>
                <th style={{ width: "10%" }}>Sr. No</th>
                <th style={{ width: "50%" }}>Product Name</th>
                <th style={{ width: "15%" }}>Qty</th>
                <th style={{ width: "15%" }}>Rate per Carton</th>
                <th style={{ width: "10%" }}>Net Amount</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((item, idx) => {
                const sr = page.startIndex + idx + 1;
                const qty = toNumber(item.quantity);
                const rate = toNumber(item.unitPrice);
                const netAmount = qty * rate;
                const prevItem = idx > 0 ? page.rows[idx - 1] : null;
                const isNewCategory =
                  idx === 0 || item.category !== (prevItem?.category || "");

                return (
                  <React.Fragment key={item.id || sr}>
                    {isNewCategory && (
                      <tr className="category-row">
                        <td
                          colSpan={5}
                          className="text-center font-semibold bg-gray-100"
                        >
                          {item.category || "Uncategorized"}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="text-center">{sr}</td>
                      <td>{productMap.get(item.productId) || item.description}</td>
                      <td className="text-center">{qty || "—"}</td>
                      <td className="text-right">{formatCurrency(rate)}</td>
                      <td className="text-right">
                        {formatCurrency(netAmount)}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {page.blanks.map((_, i) => (
                <tr key={`blank-${pageIndex}-${i}`}>
                  <td className="text-center">&nbsp;</td>
                  <td>&nbsp;</td>
                  <td className="text-center">&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary only on last page */}
          {pageIndex === pages.length - 1 && (
            <>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "Calibri, sans-serif",
                  fontSize: "13px",
                  marginTop: "0",
                }}
              >
                <tbody>
                  <tr>
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        width: "50%",
                      }}
                    >
                      <strong>Total Cartons :</strong> {totalCartons}
                    </td>
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        width: "50%",
                      }}
                    >
                      <strong>Net Amount :</strong> {formatCurrency(netAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                      }}
                    >
                      <strong>Net Weight (KGS) :</strong>{" "}
                      {netWeightKgs.toFixed(2)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                      }}
                    >
                      <strong>Freight :</strong> {formatCurrency(freight)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                      }}
                    >
                      <strong>Gross Weight (KGS) :</strong>{" "}
                      {grossWeightKgs.toFixed(2)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                      }}
                    >
                      <strong>Total Invoice Amount :</strong>{" "}
                      {formatCurrency(totalInvoiceAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                      }}
                    >
                      <strong>Gross Weight (LBS) :</strong>{" "}
                      {grossWeightLbs.toFixed(2)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                      }}
                    >
                      <strong>Amount In Words :</strong>{" "}
                      {`${numberToWords(Math.floor(totalInvoiceAmount)).toUpperCase()} DOLLARS${
                        totalInvoiceAmount % 1 > 0
                          ? ` AND ${Math.round((totalInvoiceAmount % 1) * 100)
                              .toString()
                              .padStart(2, "0")}/100`
                          : ""
                      }`}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div
                style={{
                  fontSize: "11px",
                  fontFamily: "Calibri, sans-serif",
                  marginTop: "2px",
                }}
              >
                <ol style={{ paddingLeft: "18px", margin: "4px 0" }}>
                  <li>
                    All Matters related to this invoice or the goods shall be
                    governed by the laws of Pennsylvania, and all disputes
                    related hereto shall be adjusted exclusively in the state or
                    federal courts located in Pennsylvania.
                  </li>
                  <li>
                    Overdues balances subject to finance charges of 2% per
                    month.
                  </li>
                  <li>
                    All Payments must be made to the company’s official bank
                    account only. The company will not be liable for cash
                    payments or for overpayments exceeding the invoiced amount.
                  </li>
                  <li>Final Sale</li>
                </ol>
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "Calibri, sans-serif",
                  fontSize: "13px",
                  marginTop: "2px",
                }}
              >
                <tbody>
                  <tr>
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        width: "33%",
                      }}
                    >
                      Received By (Name): ___________________
                    </td>
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        width: "33%",
                      }}
                    >
                      Total Pallets: ___________________
                    </td>
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 6px",
                        width: "34%",
                        textAlign: "center",
                      }}
                    >
                      Kitchen Xpress Overseas Inc.
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
export default InvoiceView;
