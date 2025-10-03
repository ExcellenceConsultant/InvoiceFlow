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
          margin: 30mm 15mm 0 15mm;
        }
        body {
          background: white !important;
        }
        .packing-list-page { 
          box-shadow: none !important; 
          border: none !important; 
          margin: 0 !important; 
          padding: 0 !important;
          width: 100% !important; 
          min-height: auto !important;
          background: white !important;
        }
        .print-hide { display: none !important; }
        .print-hide-content { display: none !important; }
        
        /* Keep table structure for print to match PDF */
        table.packing-table { 
          border-collapse: collapse !important;
          background: white !important;
        }
        table.packing-table th, table.packing-table td {
          border: 1px solid #000 !important;
          background: white !important;
        }
        thead, tbody, tr { 
          page-break-inside: avoid;
          background: white !important;
        }
        .category-row {
          background: white !important;
        }
        .page-break { page-break-after: always; }
      }
      .packing-list-page {
        width: 210mm;
        min-height: 297mm;
        margin: 10px auto;
        padding: 30mm 16mm 0 16mm;
        background: white;
        box-sizing: border-box;
        font-family: Calibri, sans-serif;
        box-shadow: none;
        border: none;
      }
      .small-label { font-size: 12px; color: #374151; }
      table.packing-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        font-family: Calibri, sans-serif;
        margin-top: 20px;
      }
      table.packing-table th, table.packing-table td {
        padding: 6px 8px;
        vertical-align: top;
        border: 0;
      }
      table.packing-table thead th {
        font-weight: 600;
      }
      
      /* Add borders only for screen view */
      @media screen {
        table.packing-table th, table.packing-table td {
          border: 1px solid #d1d5db;
        }
      }
      .totals-row { 
        font-weight: 600; 
        margin-top: 12px; 
      }
      .category-header {
        font-weight: 600;
        text-align: center;
        padding-left: 0;
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

  // Group line items by category
  const groupedItems: { [category: string]: InvoiceLineItem[] } = {};
  let totalCartons = 0;

  lineItems.forEach((item: InvoiceLineItem) => {
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
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
            className={`packing-list-page bg-white ${pageIndex < pages.length - 1 ? 'page-break' : ''}`}
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
              <div className="text-right mt-4">
                <strong>Total Carton: {totalCartons}</strong>
              </div>
            )}

            {/* Letter Head Footer - hidden during print */}
            <div className="letter-footer print-hide-content">
              <strong>Letter Head Footer</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}