import { useEffect, useState } from "react";
import React from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { Link } from "wouter";

interface InvoiceLineItem {
  id: string;
  productCode: string;
  packingSize: string;
  description: string;
  quantity: number;
  category: string;
  netWeightKgs: number;
  grossWeightKgs: number;
  isSchemeDescription?: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customer: {
    name: string;
    address: any;
  };
  shipToName?: string;
  shipAddress?: any;
  purchaseOrderNo?: string;
  shipDate?: string;
}

export default function PackingList() {
  const { id } = useParams<{ id: string }>();

  const { data: invoice } = useQuery<Invoice>({
    queryKey: [`/api/invoices/${id}`],
    enabled: !!id,
  });

  const { data: lineItems } = useQuery<InvoiceLineItem[]>({
    queryKey: [`/api/invoices/${id}/line-items`],
    enabled: !!id,
  });

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "packing-list-print-styles";
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
        .packing-list-page { box-shadow: none; border: none; margin: 0 !important; padding: 0 !important; width: 100%; min-height: auto; background: white !important; }
        .packing-table { margin: 0 !important; padding: 0 !important; }
        .page-break { page-break-after: always; }
        .print-hide { display: none !important; }
        .print-hide-content { display: none !important; }
        
        .category-header {
          background-color: #f9f9f9 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        .packing-table th {
          background-color: #f5f5f5 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }

      .packing-list-page {
        background: white;
        padding: 20px;
        font-family: Arial, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        max-width: 210mm;
        margin: 0 auto;
        position: relative;
      }

      .packing-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 15px;
        font-size: 11px;
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
        font-size: 11px;
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

      .totals-row { 
        font-weight: 600; 
        margin-top: 12px; 
      }

      .letter-head {
        text-align: center;
        font-size: 14px;
        margin-bottom: 20px;
      }

      .letter-footer {
        text-align: center;
        font-size: 14px;
        margin-top: 30px;
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById("packing-list-print-styles");
      if (el) document.head.removeChild(el);
    };
  }, []);

  const handlePrint = () => window.print();

  if (!invoice || !lineItems) {
    return <div>Loading...</div>;
  }

  // Filter out scheme description items - they are only for invoice format, not packing list
  const filteredLineItems = lineItems.filter(item => !item.isSchemeDescription);

  // Group line items by category
  const groupedItems: { [category: string]: InvoiceLineItem[] } = {};
  let totalCartons = 0;

  filteredLineItems.forEach((item: InvoiceLineItem) => {
    const category = item.category || "Uncategorized";
    if (!groupedItems[category]) {
      groupedItems[category] = [];
    }
    groupedItems[category].push(item);
    totalCartons += item.quantity;
  });

  // Parse addresses
  const billAddress = typeof invoice.customer?.address === "string" 
    ? JSON.parse(invoice.customer.address) 
    : invoice.customer?.address;
    
  const shipAddress = invoice.shipAddress 
    ? (typeof invoice.shipAddress === "string" 
        ? JSON.parse(invoice.shipAddress) 
        : invoice.shipAddress)
    : billAddress;

  // Build flat list of rows (category + items)
  type PackingRow = { type: 'category'; category: string } | { type: 'item'; item: InvoiceLineItem; srNo: number };
  const allRows: PackingRow[] = [];
  let serialNumber = 1;

  Object.entries(groupedItems).forEach(([category, items]) => {
    allRows.push({ type: 'category', category });
    items.forEach((item) => {
      allRows.push({ type: 'item', item, srNo: serialNumber++ });
    });
  });

  // Pagination: 15 rows per page
  const ROWS_PER_PAGE = 15;
  const pages: PackingRow[][] = [];
  let currentPage: PackingRow[] = [];
  let rowCount = 0;

  allRows.forEach((row) => {
    currentPage.push(row);
    rowCount++;

    if (rowCount === ROWS_PER_PAGE) {
      pages.push(currentPage);
      currentPage = [];
      rowCount = 0;
    }
  });

  // Add remaining rows
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  // If no rows, create at least one empty page
  if (pages.length === 0) {
    pages.push([]);
  }

  return (
    <div className="container max-w-6xl mx-auto p-6">
      {/* Header with Back and Print buttons */}
      <div className="flex items-center justify-between mb-6 print-hide">
        <Link href={`/invoices/${invoice.id}`}>
          <Button variant="outline" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoice
          </Button>
        </Link>
        <Button onClick={handlePrint} data-testid="button-print">
          <Printer className="h-4 w-4 mr-2" />
          Print Packing List
        </Button>
      </div>

      {/* Packing List Content - Multiple Pages */}
      {pages.map((pageRows, pageIndex) => (
        <div 
          key={pageIndex} 
          className={`packing-list-page ${pageIndex < pages.length - 1 ? 'page-break' : ''}`}
        >
          {/* Letter Head Header - hidden during print */}
          <div className="letter-head print-hide-content">
            <strong>Letter Head Header</strong>
          </div>

          {/* Title */}
          <div className="text-center font-bold text-lg mb-6">
            Packing Slip
          </div>

          {/* Bill To / Ship To / Invoice Details */}
          <div className="grid grid-cols-12 gap-4 mb-6">
              <div className="col-span-4">
                <div className="font-semibold">Bill To :</div>
                <div className="mt-1">
                  <div>{invoice.customer?.name || "—"}</div>
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
                <div className="font-semibold">Ship To :</div>
                <div className="mt-1">
                  <div>{invoice.shipToName || invoice.customer?.name || "—"}</div>
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
                              {shipAddress.state ? `, ${shipAddress.state}` : ""}{" "}
                              {shipAddress.zipCode || ""}
                            </div>
                          )}
                          {shipAddress.country && <div>{shipAddress.country}</div>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-4">
                <div>
                  <strong>Invoice No :</strong> {invoice.invoiceNumber}
                </div>
                <div>
                  <strong>Invoice Date :</strong>{" "}
                  {new Date(invoice.invoiceDate).toLocaleDateString()}
                </div>
                <div>
                  <strong>Shipping Info :</strong>{" "}
                  {invoice.purchaseOrderNo || "—"}
                </div>
                <div>
                  <strong>Shipping Date :</strong>{" "}
                  {invoice.shipDate
                    ? new Date(invoice.shipDate).toLocaleDateString()
                    : "—"}
                </div>
              </div>
            </div>

          {/* Table */}
          <table className="packing-table">
              <thead>
                <tr>
                  <th style={{ width: "8%" }}>Sr No.</th>
                  <th style={{ width: "15%" }}>Item Code</th>
                  <th style={{ width: "45%" }}>Product Description</th>
                  <th style={{ width: "17%" }}>Packing Size</th>
                  <th style={{ width: "15%" }}>Quantity (Carton)</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => {
                  if (row.type === 'category') {
                    return (
                      <tr key={`cat-${pageIndex}-${idx}`} className="category-row">
                        <td colSpan={5} className="category-header">
                          {row.category}
                        </td>
                      </tr>
                    );
                  } else {
                    return (
                      <tr key={`item-${pageIndex}-${idx}`}>
                        <td className="text-center">{row.srNo}</td>
                        <td>{row.item.productCode ? row.item.productCode.slice(-5) : "—"}</td>
                        <td>{row.item.description}</td>
                        <td>{row.item.packingSize ? row.item.packingSize.replace(/GM/g, 'G') : "—"}</td>
                        <td className="text-center">{row.item.quantity}</td>
                      </tr>
                    );
                  }
                })}

                {/* Add empty rows to fill the page if it's the first page */}
                {pageIndex === 0 && Array.from({ length: ROWS_PER_PAGE - pageRows.length }).map((_, idx) => (
                  <tr key={`empty-${idx}`}>
                    <td colSpan={5}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>

          {/* Total Summary - only on last page */}
          {pageIndex === pages.length - 1 && (
            <div className="text-right mt-4 space-y-1">
              <div><strong>Total Carton: {totalCartons}</strong></div>
            </div>
          )}

          {/* Letter Head Footer - hidden during print */}
          <div className="letter-footer print-hide-content">
            <strong>Letter Head Footer</strong>
          </div>
        </div>
      ))}
    </div>
  );
}