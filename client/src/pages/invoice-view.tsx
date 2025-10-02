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

  const isLoading = invoiceLoading || lineItemsLoading;
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
    isFreeFromScheme: (item as any).isFreeFromScheme || false,
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
  @page { 
    size: A4; 
    margin: 50mm 10mm 40mm 10mm;
    background: white;
  }
  body { margin: 0; padding: 0; background: white !important; }
  html { background: white !important; }
  * { box-shadow: none !important; background-color: inherit; }
  .container { background: white !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
  .invoice-page { box-shadow: none; border: none; margin: 0; padding: 0; width: 100%; min-height: auto; background: white !important; }
  .page-break { page-break-after: always; }
  .print-hide { display: none !important; }
}

.invoice-page {
  background: white;
  padding: 20px;
  font-family: Arial, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  max-width: 210mm;
  margin: 0 auto;
  position: relative;
}

.invoice-header {
  text-align: center;
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
}

.invoice-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
  font-size: 11px;
}

.info-section {
  line-height: 1.6;
}

.info-label {
  font-weight: bold;
  text-transform: uppercase;
  margin-bottom: 5px;
  font-size: 11px;
  color: #333;
}

.info-company {
  font-weight: 600;
  margin-bottom: 2px;
}

.info-detail {
  color: #555;
  margin: 1px 0;
}

.invoice-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 15px;
  font-size: 11px;
  border: 1px solid #ddd;
}

.invoice-table th {
  background-color: #f5f5f5;
  padding: 8px 6px;
  text-align: left;
  font-weight: 600;
  border-top: 1px solid #ddd;
  border-bottom: 1px solid #ddd;
  border-left: none;
  border-right: none;
  font-size: 11px;
}

.invoice-table td {
  padding: 6px;
  border-top: 1px solid #ddd;
  border-bottom: 1px solid #ddd;
  border-left: none;
  border-right: none;
  vertical-align: top;
}

.category-header {
  background-color: #f9f9f9;
  font-weight: 600;
  text-align: center;
  padding: 6px;
  border-top: 1px solid #ddd;
  border-bottom: 1px solid #ddd;
  border-left: none;
  border-right: none;
}

.scheme-info {
  font-size: 10px;
  color: #666;
  margin-top: 2px;
  font-style: italic;
}

.summary-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 15px;
}

.summary-left {
  font-size: 11px;
  line-height: 1.8;
}

.summary-right {
  text-align: right;
  font-size: 12px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.summary-total {
  color: #0066cc;
  font-weight: bold;
  font-size: 16px;
  margin-top: 8px;
}

.notes-section {
  margin-bottom: 15px;
}

.notes-label {
  font-weight: 600;
  margin-bottom: 5px;
  font-size: 11px;
}

.notes-box {
  border: 1px solid #ddd;
  padding: 10px;
  min-height: 40px;
  background-color: #fafafa;
  font-size: 10px;
  color: #666;
}

.footer-section {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 15px;
  font-size: 11px;
}

.footer-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.footer-company {
  text-align: right;
  font-weight: 600;
}

@media print {
  .summary-total {
    color: #0066cc !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  .category-header {
    background-color: #f9f9f9 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  .invoice-table th {
    background-color: #f5f5f5 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  .notes-box {
    background-color: white !important;
    background: white !important;
    border: none !important;
    padding: 0 !important;
    min-height: 0 !important;
  }
}
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById("invoice-print-styles");
      if (el) document.head.removeChild(el);
    };
  }, []);

  if (isLoading || !invoice) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div>Loading invoice...</div>
      </div>
    );
  }

  // Calculate totals
  const netAmount = lineItems.reduce((s, it) => s + (it.lineTotal || 0), 0);
  const totalCartons = lineItems.reduce((s, it) => s + (it.quantity || 0), 0);
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
  const netWeightLbs = netWeightKgs * 2.20462;
  const grossWeightLbs = grossWeightKgs * 2.20462;

  const billAddress =
    (invoice as any).customer?.address || (invoice as any).billToAddress;
  const shipAddress = (invoice as any).shipToAddress || billAddress;

  const handlePrint = () => window.print();

  // Separate regular items from scheme items
  const regularItems = lineItems.filter(item => !item.isFreeFromScheme);
  const schemeItems = lineItems.filter(item => item.isFreeFromScheme);

  // Build flat list of rows (category headers + items)
  const categorizedItems: { [key: string]: any[] } = {};
  regularItems.forEach((item) => {
    const cat = item.category || "Uncategorized";
    if (!categorizedItems[cat]) {
      categorizedItems[cat] = [];
    }
    categorizedItems[cat].push(item);
  });

  type TableRow = { type: 'category'; category: string } | { type: 'item'; item: any; srNo: number; isScheme: boolean };
  
  // Build all rows first (category headers + items in order)
  const allRows: TableRow[] = [];
  let srCounter = 0;

  // Add regular items with their categories
  Object.entries(categorizedItems).forEach(([category, items]) => {
    allRows.push({ type: 'category', category });
    items.forEach((item) => {
      srCounter++;
      allRows.push({ type: 'item', item, srNo: srCounter, isScheme: false });
    });
  });

  // Add scheme items at the end if any exist (without Sr. No.)
  if (schemeItems.length > 0) {
    allRows.push({ type: 'category', category: 'Promotional Schemes' });
    schemeItems.forEach((item) => {
      allRows.push({ type: 'item', item, srNo: 0, isScheme: true });
    });
  }

  // Pagination: 13 PRODUCT ITEMS per page (category headers don't count)
  const ITEMS_PER_PAGE = 13;
  const pages: { rows: TableRow[]; emptyCount: number }[] = [];
  
  let currentPageRows: TableRow[] = [];
  let itemCountOnCurrentPage = 0;
  let pendingCategoryHeader: TableRow | null = null;

  allRows.forEach((row) => {
    if (row.type === 'category') {
      // Store category header to add before next item
      pendingCategoryHeader = row;
    } else {
      // This is an item
      // Add pending category header if exists
      if (pendingCategoryHeader) {
        currentPageRows.push(pendingCategoryHeader);
        pendingCategoryHeader = null;
      }
      
      currentPageRows.push(row);
      itemCountOnCurrentPage++;

      // If we've reached 13 items, create a page
      if (itemCountOnCurrentPage === ITEMS_PER_PAGE) {
        const emptyCount = pages.length === 0 ? ITEMS_PER_PAGE - itemCountOnCurrentPage : 0;
        pages.push({ rows: currentPageRows, emptyCount });
        currentPageRows = [];
        itemCountOnCurrentPage = 0;
      }
    }
  });

  // Add remaining items as last page
  if (currentPageRows.length > 0 || pendingCategoryHeader) {
    if (pendingCategoryHeader) {
      currentPageRows.push(pendingCategoryHeader);
    }
    const emptyCount = pages.length === 0 ? ITEMS_PER_PAGE - itemCountOnCurrentPage : 0;
    pages.push({ rows: currentPageRows, emptyCount });
  }

  // If no items, still create one page with 13 empty rows
  if (pages.length === 0) {
    pages.push({ rows: [], emptyCount: ITEMS_PER_PAGE });
  }

  // Always ensure at least 2 pages exist (page 2 for summary/notes)
  if (pages.length === 1) {
    pages.push({ rows: [], emptyCount: 0 });
  }

  const totalPages = pages.length;

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
          className={`invoice-page ${pageIndex < pages.length - 1 ? "page-break" : ""}`}
        >
          {/* Header */}
          <div className="invoice-header">INVOICE</div>

          {/* Info Grid */}
          <div className="invoice-info-grid">
            {/* Billed To */}
            <div className="info-section">
              <div className="info-label">BILLED TO:</div>
              <div className="info-company">
                {(invoice as any).customer?.name ||
                  (invoice as any).billToName ||
                  "Client Company LLC"}
              </div>
              {billAddress && (
                <>
                  {billAddress.street && (
                    <div className="info-detail">{billAddress.street}</div>
                  )}
                  {billAddress.city && (
                    <div className="info-detail">
                      {billAddress.city}
                      {billAddress.state ? `, ${billAddress.state}` : ""}{" "}
                      {billAddress.zipCode || ""}
                    </div>
                  )}
                  {billAddress.country && (
                    <div className="info-detail">{billAddress.country}</div>
                  )}
                </>
              )}
            </div>

            {/* Ship To */}
            <div className="info-section">
              <div className="info-label">SHIP TO:</div>
              <div className="info-company">
                {(invoice as any).shipToName ||
                  (invoice as any).customer?.name ||
                  "Client Company LLC"}
              </div>
              {shipAddress && (
                <>
                  {typeof shipAddress === "string" ? (
                    <div className="info-detail">{shipAddress}</div>
                  ) : (
                    <>
                      {shipAddress.street && (
                        <div className="info-detail">{shipAddress.street}</div>
                      )}
                      {shipAddress.city && (
                        <div className="info-detail">
                          {shipAddress.city}
                          {shipAddress.state ? `, ${shipAddress.state}` : ""}{" "}
                          {shipAddress.zipCode || ""}
                        </div>
                      )}
                      {shipAddress.country && (
                        <div className="info-detail">{shipAddress.country}</div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Invoice Details */}
            <div className="info-section">
              <div className="info-detail">
                <strong>Invoice No.</strong> : {invoice.invoiceNumber}
              </div>
              <div className="info-detail">
                <strong>Invoice Date</strong> :{" "}
                {invoice.invoiceDate
                  ? new Date(invoice.invoiceDate).toLocaleDateString()
                  : "—"}
              </div>
              <div className="info-detail">
                <strong>Payment Term</strong> : Net{" "}
                {(invoice as any).paymentTerms || 30}
              </div>
              <div className="info-detail">
                <strong>Due Date</strong> :{" "}
                {invoice.dueDate
                  ? new Date(invoice.dueDate).toLocaleDateString()
                  : "—"}
              </div>
            </div>
          </div>

          {/* Table - only show if page 1 OR if there are items on this page */}
          {(pageIndex === 0 || page.rows.length > 0 || page.emptyCount > 0) && (
            <table className="invoice-table">
              <thead>
                <tr>
                  <th style={{ width: "5%", textAlign: "center" }}>Sr. No.</th>
                  <th style={{ width: "12%" }}>Product Code</th>
                  <th style={{ width: "12%" }}>Packing Size</th>
                  <th style={{ width: "35%" }}>Product Description</th>
                  <th style={{ width: "10%", textAlign: "center" }}>
                    Qty
                    <br />
                    (Carton)
                  </th>
                  <th style={{ width: "13%", textAlign: "right" }}>
                    Rate per Carton
                  </th>
                  <th style={{ width: "13%", textAlign: "right" }}>
                    Total
                    <br />
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row, idx) => {
                  if (row.type === 'category') {
                    return (
                      <tr key={`cat-${pageIndex}-${idx}`}>
                        <td colSpan={7} className="category-header">
                          {row.category}
                        </td>
                      </tr>
                    );
                  } else {
                    const item = row.item;
                    
                    // Check if this is a scheme description line item
                    if (item.isSchemeDescription) {
                      return (
                        <tr key={`scheme-desc-${pageIndex}-${idx}`} className="scheme-description-row">
                          <td colSpan={7} style={{ 
                            paddingLeft: "2em",
                            fontStyle: "italic",
                            backgroundColor: "#f9fafb",
                            fontSize: "0.9em"
                          }}>
                            {item.description}
                          </td>
                        </tr>
                      );
                    }
                    
                    const qty = toNumber(item.quantity);
                    const rate = toNumber(item.unitPrice);
                    const lineTotal = toNumber(item.lineTotal);

                    return (
                      <tr key={`item-${pageIndex}-${idx}`}>
                        <td style={{ textAlign: "center" }}>
                          {row.isScheme ? "—" : row.srNo}
                        </td>
                        <td>{item.productCode || "—"}</td>
                        <td>
                          {item.packingSize
                            ? item.packingSize.replace(/GM/g, "G")
                            : "—"}
                        </td>
                        <td>{item.description}</td>
                        <td style={{ textAlign: "center" }}>{qty || "—"}</td>
                        <td style={{ textAlign: "right" }}>
                          {formatCurrency(rate)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {formatCurrency(lineTotal)}
                        </td>
                      </tr>
                    );
                  }
                })}

                {/* Empty rows to fill page */}
                {Array.from({ length: page.emptyCount }).map((_, idx) => (
                  <tr key={`empty-${pageIndex}-${idx}`}>
                    <td style={{ textAlign: "center" }}>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td style={{ textAlign: "center" }}>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Summary, Notes, Footer always on page 2 (pageIndex 1) */}
          {pageIndex === 1 && (
            <>
              {/* Summary Section */}
              <div className="summary-section">
                {/* Left side - Weights and Amount in words */}
                <div className="summary-left">
                  <div>
                    <strong>Total Carton:</strong> {totalCartons}
                  </div>
                  <div>
                    <strong>Net Weight LBS:</strong> {netWeightLbs.toFixed(0)} LBS
                  </div>
                  <div>
                    <strong>Gross Weight LBS:</strong> {grossWeightLbs.toFixed(0)}{" "}
                    LBS
                  </div>
                  <div style={{ marginTop: "10px" }}>
                    <strong>Amount in words:</strong>
                  </div>
                  <div>
                    {numberToWords(Math.floor(totalInvoiceAmount))
                      .split(" ")
                      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(" ")}{" "}
                    Dollars
                    {totalInvoiceAmount % 1 > 0
                      ? ` and ${numberToWords(Math.round((totalInvoiceAmount % 1) * 100))
                          .split(" ")
                          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(" ")} Cents`
                      : ""}
                  </div>
                </div>

                {/* Right side - Financial summary */}
                <div className="summary-right">
                  <div className="summary-row">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(netAmount)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Freight:</span>
                    <span>{formatCurrency(freight)}</span>
                  </div>
                  <div className="summary-row summary-total">
                    <span>Total Amount:</span>
                    <span>{formatCurrency(totalInvoiceAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="notes-section">
                <div className="notes-label">Notes:</div>
                <div className="notes-box">Enter notes here...</div>
              </div>

              {/* Footer */}
              <div className="footer-section">
                <div className="footer-item">
                  <span>Received By:</span>
                  <span>___________________</span>
                </div>
                <div className="footer-item">
                  <span>Total Pallet:</span>
                  <span>8</span>
                </div>
                <div className="footer-company">Kitchen Express Overseas Inc</div>
              </div>
            </>
          )}

          {/* Page Number */}
          <div style={{ 
            position: 'absolute', 
            top: '5px', 
            right: '20px', 
            fontSize: '11px',
            fontFamily: 'Arial, sans-serif'
          }}>
            Page {pageIndex + 1} of {totalPages}
          </div>
        </div>
      ))}
    </div>
  );
}
export default InvoiceView;
