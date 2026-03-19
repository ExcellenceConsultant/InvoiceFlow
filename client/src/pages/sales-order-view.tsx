import { Button } from "@/components/ui/button";
import { formatDateMMDDYYYY } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package, Printer } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useParams } from "wouter";

function toNumber(v: any) {
  const n = typeof v === "number" ? v : parseFloat(String(v || "0"));
  return Number.isFinite(n) ? n : 0;
}

function numberToWords(num: number): string {
  if (num === 0) return "zero";
  const a = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
    "sixteen", "seventeen", "eighteen", "nineteen",
  ];
  const b = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const thousand = ["", "thousand", "million", "billion"];
  function chunk(n: number) {
    const words: string[] = [];
    if (n >= 100) { words.push(a[Math.floor(n / 100)], "hundred"); n = n % 100; }
    if (n >= 20) { words.push(b[Math.floor(n / 10)]); if (n % 10) words.push(a[n % 10]); }
    else if (n > 0) words.push(a[n]);
    return words.join(" ");
  }
  let wordParts: string[] = [];
  let i = 0;
  while (num > 0) {
    const rem = num % 1000;
    if (rem) wordParts.unshift(chunk(rem) + (thousand[i] ? " " + thousand[i] : ""));
    num = Math.floor(num / 1000);
    i++;
  }
  return wordParts.join(" ").replace(/\s+/g, " ").trim();
}

interface SalesOrderLineItem {
  id: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  productCode?: string | null;
  cartoonBarcode?: string | null;
  packingSize?: string | null;
  category?: string | null;
  netWeightKgs?: number;
  grossWeightKgs?: number;
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  status: string;
  source: string;
  notes?: string | null;
  salesOrder?: string | null;
  subtotal: string;
  freight: string;
  discount: string;
  total: string;
  convertedInvoiceId?: string | null;
  createdAt: string;
  lineItems: SalesOrderLineItem[];
}

export default function SalesOrderView() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: order, isLoading } = useQuery<SalesOrder>({
    queryKey: [`/api/sales-orders/${id}`],
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "so-print-styles";
    style.textContent = `
    @media print {
  @page {
    size: A4;
    margin: 40mm 10mm 30mm 10mm;
    background: white;
  }
  body { margin: 0; padding: 0; background: white !important; }
  html { background: white !important; }
  * { box-shadow: none !important; background-color: inherit; }
  .container { background: white !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
  .invoice-page { box-shadow: none; border: none; margin: 0 !important; padding: 0 !important; width: 100%; min-height: auto; background: white !important; }
  .invoice-header { margin: 0 !important; padding: 0 !important; margin-bottom: 5px !important; }
  .invoice-info-grid { margin: 0 !important; padding: 0 !important; margin-bottom: 5px !important; }
  .invoice-table { margin: 0 !important; padding: 0 !important; }
  .summary-section { margin: 0 !important; padding: 5px 0 !important; }
  .notes-section { margin: 0 !important; padding: 5px 0 !important; margin-bottom: 10px !important; }
  .footer-section { margin: 0 !important; padding: 0 !important; }
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

.info-section { line-height: 1.6; }
.info-label { font-weight: bold; text-transform: uppercase; margin-bottom: 5px; font-size: 11px; color: #333; }
.info-company { font-weight: 600; margin-bottom: 2px; }
.info-detail { color: #555; margin: 1px 0; }

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

.summary-section {
  display: grid;
  grid-template-columns: 74% auto;
  gap: 0;
  margin-bottom: 15px;
}

.summary-left { font-size: 11px; line-height: 1.8; }
.summary-right { font-size: 11px; line-height: 1.8; }
.summary-total { color: #000; }

.notes-section { margin-bottom: 30px; }
.notes-label { font-weight: bold; margin-bottom: 5px; font-size: 11px; }
.notes-box { padding: 0; min-height: 40px; font-size: 11px; color: #000; line-height: 1.6; }
.notes-line { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
.notes-number { font-weight: bold; min-width: 18px; }

.footer-section {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 15px;
  font-size: 11px;
}
.footer-item { display: flex; align-items: center; gap: 10px; }
.footer-company { text-align: right; font-weight: 600; }

@media print {
  .summary-total { color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .category-header { background-color: #f9f9f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .invoice-table th { background-color: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .notes-box { background-color: white !important; background: white !important; margin-left: 18px !important; border: none !important; padding: 0 !important; min-height: 0 !important; }
  .notes-line { display: flex !important; align-items: flex-start !important; gap: 8px !important; margin-bottom: 8px !important; }
  .notes-number { font-weight: bold !important; color: #000 !important; min-width: 18px !important; }
}
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById("so-print-styles");
      if (el) document.head.removeChild(el);
    };
  }, []);

  if (isLoading || !order) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div>Loading sales order...</div>
      </div>
    );
  }

  const lineItems = (order.lineItems || []).map((item) => ({
    ...item,
    quantity: toNumber(item.quantity),
    unitPrice: toNumber(item.unitPrice),
    lineTotal: toNumber(item.lineTotal),
    packingSize: item.packingSize || "",
    productCode: item.productCode || "",
    category: item.category || "",
    netWeightKgs: toNumber(item.netWeightKgs),
    grossWeightKgs: toNumber(item.grossWeightKgs),
  }));

  // Fix uncategorized by inheriting from matching product
  for (const item of lineItems) {
    if (!item.category || String(item.category).trim() === "") {
      const match = lineItems.find(
        (other) => other.productCode && other.productCode === item.productCode && other.category
      );
      if (match) item.category = match.category;
    }
  }

  // Calculate totals
  const netAmount = lineItems.reduce((s, it) => s + it.lineTotal, 0);
  const totalCartons = lineItems.reduce((s, it) => s + it.quantity, 0);
  const netWeightLbs = lineItems.reduce((s, it) => s + (it.netWeightKgs || 0) * it.quantity, 0);
  const grossWeightLbs = lineItems.reduce((s, it) => s + (it.grossWeightKgs || 0) * it.quantity, 0);
  const freight = toNumber(order.freight);
  const discount = toNumber(order.discount);
  const totalAmount = netAmount + freight - discount;

  // Customer address lookup
  const customer = customers.find((c: any) => c.id === order.customerId);
  const billAddress = customer?.address
    ? (typeof customer.address === "string" ? JSON.parse(customer.address) : customer.address)
    : null;

  const handlePrint = () => window.print();

  // Build categorized items
  const categorizedItems: { [key: string]: typeof lineItems } = {};
  lineItems.forEach((item) => {
    const cat = item.category || "Uncategorized";
    if (!categorizedItems[cat]) categorizedItems[cat] = [];
    categorizedItems[cat].push(item);
  });

  Object.keys(categorizedItems).forEach((cat) => {
    categorizedItems[cat].sort((a, b) =>
      (a.description || "").toLowerCase().localeCompare((b.description || "").toLowerCase())
    );
  });

  const categoryOrder = ["Frozen Vegetable", "Frozen Fruit", "Frozen Bulk"];
  const sortedCategories = Object.keys(categorizedItems).sort((a, b) => {
    const ia = categoryOrder.indexOf(a);
    const ib = categoryOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  type TableRow =
    | { type: "category"; category: string }
    | { type: "item"; item: (typeof lineItems)[0]; srNo: number };

  const allRows: TableRow[] = [];
  let srCounter = 0;
  sortedCategories.forEach((category) => {
    allRows.push({ type: "category", category });
    categorizedItems[category].forEach((item) => {
      srCounter++;
      allRows.push({ type: "item", item, srNo: srCounter });
    });
  });

  const ROWS_PER_PAGE = 22;
  const MAX_ROWS_WITH_SUMMARY = 12;
  const totalRows = allRows.length;

  const pages: { rows: TableRow[]; showSummary: boolean }[] = [];

  if (totalRows <= MAX_ROWS_WITH_SUMMARY) {
    pages.push({ rows: allRows, showSummary: true });
  } else {
    let currentPageRows: TableRow[] = [];
    let rowCount = 0;
    allRows.forEach((row) => {
      currentPageRows.push(row);
      rowCount++;
      if (rowCount === ROWS_PER_PAGE) {
        pages.push({ rows: currentPageRows, showSummary: false });
        currentPageRows = [];
        rowCount = 0;
      }
    });
    if (currentPageRows.length > 0) {
      pages.push({ rows: currentPageRows, showSummary: true });
    } else if (pages.length > 0) {
      pages.push({ rows: [], showSummary: true });
    }
  }

  if (pages.length === 0) pages.push({ rows: [], showSummary: true });

  const totalPages = pages.length;

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between gap-4 mb-6 print-hide">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation("/sales-orders")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Sales Orders
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setLocation(`/sales-orders/${id}/packing-list`)}
          >
            <Package className="h-4 w-4 mr-2" />
            View Packing List
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print Sales Order
          </Button>
        </div>
      </div>

      {pages.map((page, pageIndex) => (
        <div
          key={pageIndex}
          className={`invoice-page ${pageIndex < pages.length - 1 ? "page-break" : ""}`}
        >
          {/* Header */}
          <div className="invoice-header">SALES ORDER</div>

          {/* Info Grid */}
          <div className="invoice-info-grid">
            {/* Billed To */}
            <div className="info-section">
              <div className="info-label">BILLED TO:</div>
              <div className="info-company">
                {customer?.name || order.customerName || "—"}
              </div>
              {billAddress && (
                <>
                  {billAddress.street && <div className="info-detail">{billAddress.street}</div>}
                  {billAddress.city && (
                    <div className="info-detail">
                      {billAddress.city}
                      {billAddress.state ? `, ${billAddress.state}` : ""}{" "}
                      {billAddress.zipCode || ""}
                    </div>
                  )}
                  {billAddress.country && <div className="info-detail">{billAddress.country}</div>}
                </>
              )}
            </div>

            {/* Ship To */}
            <div className="info-section">
              <div className="info-label">SHIP TO:</div>
              <div className="info-company">
                {customer?.name || order.customerName || "—"}
              </div>
              {billAddress && (
                <>
                  {billAddress.street && <div className="info-detail">{billAddress.street}</div>}
                  {billAddress.city && (
                    <div className="info-detail">
                      {billAddress.city}
                      {billAddress.state ? `, ${billAddress.state}` : ""}{" "}
                      {billAddress.zipCode || ""}
                    </div>
                  )}
                  {billAddress.country && <div className="info-detail">{billAddress.country}</div>}
                </>
              )}
            </div>

            {/* Order Details */}
            <div className="info-section">
              <div className="info-detail">
                <strong>Order No.</strong> : {order.orderNumber}
              </div>
              <div className="info-detail">
                <strong>Order Date</strong> :{" "}
                {order.createdAt ? formatDateMMDDYYYY(order.createdAt) : "—"}
              </div>
              <div className="info-detail">
                <strong>Sales Order</strong> : {order.salesOrder || "—"}
              </div>
              <div className="info-detail">
                <strong>Status</strong> :{" "}
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </div>
            </div>
          </div>

          {/* Table */}
          {(pageIndex === 0 || page.rows.length > 0) && (
            <table className="invoice-table">
              <thead>
                <tr>
                  <th style={{ width: "5%", textAlign: "center" }}>Sr. No.</th>
                  <th style={{ width: "12%" }}>Product Code</th>
                  <th style={{ width: "12%" }}>Packing Size</th>
                  <th style={{ width: "36%" }}>Product Description</th>
                  <th style={{ width: "10%", textAlign: "center" }}>
                    Qty<br />(Carton)
                  </th>
                  <th style={{ width: "12%", textAlign: "center" }}>Rate per Carton</th>
                  <th style={{ width: "13%", textAlign: "center" }}>
                    Total<br />Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row, idx) => {
                  if (row.type === "category") {
                    return (
                      <tr key={`cat-${pageIndex}-${idx}`}>
                        <td colSpan={7} className="category-header">{row.category}</td>
                      </tr>
                    );
                  }
                  const item = row.item;
                  return (
                    <tr key={`item-${pageIndex}-${idx}`}>
                      <td style={{ textAlign: "center" }}>{row.srNo}</td>
                      <td>{item.productCode || "—"}</td>
                      <td>{item.packingSize ? item.packingSize.replace(/GM/g, "G") : "—"}</td>
                      <td>{item.description}</td>
                      <td style={{ textAlign: "center" }}>{item.quantity || "—"}</td>
                      <td style={{ textAlign: "center" }}>{formatCurrency(item.unitPrice)}</td>
                      <td style={{ textAlign: "center" }}>{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Summary on last page */}
          {page.showSummary && (
            <>
              <div className="summary-section">
                <div className="summary-left">
                  <div><strong>Total Carton:</strong> {totalCartons}</div>
                  <div><strong>Net Weight LBS:</strong> {netWeightLbs.toFixed(0)} LBS</div>
                  <div><strong>Gross Weight LBS:</strong> {grossWeightLbs.toFixed(0)} LBS</div>
                  <div style={{ marginTop: "10px" }}>
                    <strong>Amount in Words:</strong>
                  </div>
                  <div>
                    {numberToWords(Math.floor(totalAmount))
                      .split(" ")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")}{" "}
                    Dollars
                    {totalAmount % 1 > 0
                      ? ` and ${numberToWords(Math.round((totalAmount % 1) * 100))
                          .split(" ")
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(" ")} Cents`
                      : ""}
                  </div>
                </div>

                <div className="summary-right">
                  <div>
                    <strong>Subtotal:</strong>{" "}
                    <span style={{ float: "right" }}>{formatCurrency(netAmount)}</span>
                  </div>
                  <div>
                    <strong>Freight:</strong>{" "}
                    <span style={{ float: "right" }}>{formatCurrency(freight)}</span>
                  </div>
                  <div>
                    <strong>Discount:</strong>{" "}
                    <span style={{ float: "right", color: "#dc2626" }}>
                      -{formatCurrency(discount)}
                    </span>
                  </div>
                  <div className="summary-total">
                    <strong>Total Amount:</strong>{" "}
                    <span style={{ float: "right" }}>{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>

              {order.notes && (
                <div className="notes-section">
                  <div className="notes-label">Notes:</div>
                  <div className="notes-box">
                    {order.notes
                      .split("\n")
                      .filter((line) => line.trim())
                      .map((line, idx) => {
                        const cleanLine = line.replace(/^\d+\.\s*/, "").trim();
                        return (
                          <div className="notes-line" key={idx}>
                            <span className="notes-number">{idx + 1}.</span>
                            <span>{cleanLine}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="footer-section">
                <div className="footer-item">
                  <span>Received By:</span>
                  <span>___________________</span>
                </div>
                <div className="footer-item" style={{ textAlign: "center" }}>
                  <span>Total Pallet:</span>
                  <span></span>
                </div>
                <div className="footer-company">Kitchen Xpress Overseas Inc</div>
              </div>
            </>
          )}

          {/* Page Number */}
          <div
            style={{
              position: "absolute",
              top: "5px",
              right: "20px",
              fontSize: "11px",
              fontFamily: "Arial, sans-serif",
            }}
          >
            Page {pageIndex + 1} of {totalPages}
          </div>
        </div>
      ))}
    </div>
  );
}
