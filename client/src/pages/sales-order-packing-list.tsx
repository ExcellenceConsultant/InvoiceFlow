import { Button } from "@/components/ui/button";
import { formatDateMMDDYYYY } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect } from "react";
import { useParams, useLocation } from "wouter";

interface SOLineItem {
  id: string;
  productCode?: string | null;
  cartoonBarcode?: string | null;
  packingSize?: string | null;
  description: string;
  quantity: number;
  category?: string | null;
  netWeightKgs?: number;
  grossWeightKgs?: number;
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  salesOrder?: string | null;
  createdAt: string;
  lineItems: SOLineItem[];
}

export default function SalesOrderPackingList() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: order } = useQuery<SalesOrder>({
    queryKey: [`/api/sales-orders/${id}`],
    staleTime: 0,
    refetchOnMount: "always",
    enabled: !!id,
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "so-packing-print-styles";
    style.textContent = `
      @media print {
        @page {
          size: A4;
          margin: 10mm 10mm 10mm 10mm;
          background: white;
        }
        body { margin: 0; padding: 0; background: white !important; }
        html { background: white !important; }
        * { box-shadow: none !important; background-color: inherit; }
        .container { background: white !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
        .packing-list-page { box-shadow: none; border: none; margin: 0 !important; padding: 0 !important; width: 100%; min-height: auto; background: white !important; }
        .packing-table { margin: 0 !important; padding: 0 !important; }
        .page-break { page-break-after: always; }
        .print-hide { display: none !important; }
        .print-hide-content { display: none !important; }
        .category-header { background-color: #f9f9f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .packing-table th { background-color: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }

      .packing-list-page {
        background: white;
        padding: 20px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        max-width: 210mm;
        margin: 0 auto;
        position: relative;
      }

      .invoice-header {
        text-align: center;
        font-size: 28px;
        font-weight: bold;
        margin-bottom: 20px;
      }

      .invoice-info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 20px;
        margin-bottom: 20px;
        font-size: 13px;
      }

      .info-section { line-height: 1.6; }
      .info-label { font-weight: bold; text-transform: uppercase; margin-bottom: 5px; font-size: 13px; color: #333; }
      .info-company { font-weight: 600; margin-bottom: 2px; }
      .info-detail { color: #555; margin: 1px 0; }

      .packing-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 15px;
        font-size: 13px;
        border: 1px solid #ddd;
      }

      .packing-table th {
        background-color: #f5f5f5;
        padding: 8px 6px;
        text-align: left;
        font-weight: 600;
        border-top: 1px solid #ddd;
        border-bottom: 1px solid #ddd;
        border-left: none;
        border-right: none;
        font-size: 13px;
      }

      .packing-table td {
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

      .totals-row { font-weight: 600; margin-top: 12px; }
      .letter-footer { text-align: center; font-size: 16px; margin-top: 30px; }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById("so-packing-print-styles");
      if (el) document.head.removeChild(el);
    };
  }, []);

  const handlePrint = () => window.print();

  if (!order) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  const customer = customers.find((c: any) => c.id === order.customerId);
  const billAddress = customer?.address
    ? (typeof customer.address === "string" ? JSON.parse(customer.address) : customer.address)
    : null;

  // Filter items (only items with a description)
  const lineItems = (order.lineItems || []).filter((item) => item.description?.trim());

  // Group by category
  const groupedItems: { [category: string]: SOLineItem[] } = {};
  let totalCartons = 0;
  let netWeightLbs = 0;
  let grossWeightLbs = 0;

  lineItems.forEach((item) => {
    const category = item.category || "Uncategorized";
    if (!groupedItems[category]) groupedItems[category] = [];
    groupedItems[category].push(item);
    const qty = Number(item.quantity) || 0;
    totalCartons += qty;
    netWeightLbs += (Number(item.netWeightKgs) || 0) * qty;
    grossWeightLbs += (Number(item.grossWeightKgs) || 0) * qty;
  });

  // Sort items alphabetically within each category
  Object.keys(groupedItems).forEach((cat) => {
    groupedItems[cat].sort((a, b) =>
      (a.description || "").toLowerCase().localeCompare((b.description || "").toLowerCase())
    );
  });

  // Category order
  const categoryOrder = ["Frozen Bulk", "Frozen Vegetable", "Frozen Fruit"];
  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    const ia = categoryOrder.indexOf(a);
    const ib = categoryOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  type PackingRow =
    | { type: "category"; category: string }
    | { type: "item"; item: SOLineItem; srNo: number };

  const allRows: PackingRow[] = [];
  let serialNumber = 1;
  sortedCategories.forEach((category) => {
    allRows.push({ type: "category", category });
    groupedItems[category].forEach((item) => {
      allRows.push({ type: "item", item, srNo: serialNumber++ });
    });
  });

  const ROWS_PER_PAGE = 25;
  const totalRows = allRows.length;

  const pages: { rows: PackingRow[]; showSummary: boolean }[] = [];

  if (totalRows <= ROWS_PER_PAGE) {
    pages.push({ rows: allRows, showSummary: true });
  } else {
    let currentIndex = 0;
    let currentCategory: string | null = null;

    while (currentIndex < totalRows) {
      let pageEndIndex = Math.min(currentIndex + ROWS_PER_PAGE, totalRows);
      let pageRows: PackingRow[] = [];

      if (pageEndIndex < totalRows && allRows[pageEndIndex - 1].type === "category") {
        pageEndIndex--;
      }

      const slicedRows = allRows.slice(currentIndex, pageEndIndex);
      if (slicedRows.length > 0 && slicedRows[0].type === "item" && currentCategory) {
        pageRows.push({ type: "category", category: currentCategory });
      }
      pageRows.push(...slicedRows);

      for (let i = pageRows.length - 1; i >= 0; i--) {
        if (pageRows[i].type === "category") {
          currentCategory = (pageRows[i] as { type: "category"; category: string }).category;
          break;
        }
      }

      const isLastPage = pageEndIndex >= totalRows;
      if (pageRows.length > 0) {
        pages.push({ rows: pageRows, showSummary: isLastPage });
      }
      currentIndex = pageEndIndex;
    }
  }

  if (pages.length === 0) pages.push({ rows: [], showSummary: true });

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6 print-hide">
        <Button variant="outline" onClick={() => setLocation(`/sales-orders/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Sales Order
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Print Packing List
        </Button>
      </div>

      {pages.map((page, pageIndex) => (
        <div
          key={pageIndex}
          className={`packing-list-page ${pageIndex < pages.length - 1 ? "page-break" : ""}`}
        >
          {/* Header */}
          <div className="invoice-header">PACKING SLIP</div>

          {/* Info Grid */}
          <div className="invoice-info-grid">
            {/* Billed To */}
            <div className="info-section">
              <div className="info-label">BILLED TO:</div>
              <div className="info-company">{customer?.name || order.customerName || "—"}</div>
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
              <div className="info-company">{customer?.name || order.customerName || "—"}</div>
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
            </div>
          </div>

          {/* Table */}
          <table className="packing-table">
            <thead>
              <tr>
                <th style={{ width: "8%" }}>Sr No.</th>
                <th style={{ width: "15%" }}>CARTOON BARCODE</th>
                <th style={{ width: "45%" }}>Product Description</th>
                <th style={{ width: "17%" }}>Packing Size</th>
                <th style={{ width: "15%" }}>Quantity (Carton)</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row, idx) => {
                if (row.type === "category") {
                  return (
                    <tr key={`cat-${pageIndex}-${idx}`}>
                      <td colSpan={5} className="category-header">{row.category}</td>
                    </tr>
                  );
                }
                return (
                  <tr key={`item-${pageIndex}-${idx}`}>
                    <td className="text-center">{row.srNo}</td>
                    <td>{row.item.cartoonBarcode || "—"}</td>
                    <td>{row.item.description}</td>
                    <td>
                      {row.item.packingSize
                        ? row.item.packingSize.replace(/GM/g, "G")
                        : "—"}
                    </td>
                    <td className="text-center">{row.item.quantity}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {page.showSummary && (
            <div className="text-right mt-4 space-y-1">
              <div><strong>Total Qty: {totalCartons}</strong></div>
              <div><strong>Total Carton: {totalCartons}</strong></div>
              <div><strong>Net Weight LBS: {netWeightLbs.toFixed(0)} LBS</strong></div>
              <div><strong>Gross Weight LBS: {grossWeightLbs.toFixed(0)} LBS</strong></div>
            </div>
          )}

          <div className="letter-footer print-hide-content">
            <strong>Letter Head Footer</strong>
          </div>
        </div>
      ))}
    </div>
  );
}
