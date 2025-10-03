import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { Link } from "wouter";

interface InvoiceLineItem {
  id: string;
  quantity: number;
  isSchemeDescription?: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: {
    name: string;
    address: any;
  };
  shipToName?: string;
  shipAddress?: any;
}

export default function ShippingLabel() {
  const { id } = useParams<{ id: string }>();
  const [palletCount, setPalletCount] = useState("");

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
    style.id = "shipping-label-print-styles";
    style.textContent = `
      @media print {
        @page { 
          size: A4; 
          margin: 20mm;
          background: white;
        }
        body { margin: 0; padding: 0; background: white !important; }
        html { background: white !important; }
        * { box-shadow: none !important; background-color: inherit; }
        .container { background: white !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
        .shipping-label-page { box-shadow: none; border: none; margin: 0 !important; padding: 0 !important; width: 100%; min-height: auto; background: white !important; }
        .print-hide { display: none !important; }
      }

      .shipping-label-page {
        background: white;
        padding: 40px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        max-width: 210mm;
        margin: 0 auto;
        position: relative;
      }

      .shipping-label-title {
        text-align: center;
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 40px;
        text-transform: uppercase;
      }

      .label-section {
        margin-bottom: 30px;
        border: 2px solid #000;
        padding: 20px;
      }

      .label-header {
        font-weight: bold;
        font-size: 16px;
        margin-bottom: 10px;
        text-transform: uppercase;
        border-bottom: 1px solid #000;
        padding-bottom: 5px;
      }

      .label-content {
        font-size: 14px;
        line-height: 1.8;
      }

      .label-field {
        margin-bottom: 8px;
      }

      .field-label {
        font-weight: bold;
        display: inline-block;
        width: 150px;
      }

      .field-value {
        display: inline-block;
      }

      .blank-field {
        display: inline-block;
        border-bottom: 1px solid #000;
        min-width: 200px;
        height: 20px;
      }

      @media print {
        input {
          border: none;
          border-bottom: 1px solid #000;
          background: white !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById("shipping-label-print-styles");
      if (el) document.head.removeChild(el);
    };
  }, []);

  const handlePrint = () => window.print();

  if (!invoice || !lineItems) {
    return <div>Loading...</div>;
  }

  const filteredLineItems = lineItems.filter(item => !item.isSchemeDescription);
  const totalCartons = filteredLineItems.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0
  );

  const shipAddress = invoice.shipAddress
    ? (typeof invoice.shipAddress === "string"
        ? JSON.parse(invoice.shipAddress)
        : invoice.shipAddress)
    : (typeof invoice.customer?.address === "string"
        ? JSON.parse(invoice.customer.address)
        : invoice.customer?.address);

  const shipToName = invoice.shipToName || invoice.customer?.name || "";

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between gap-4 mb-6 print-hide">
        <Link href={`/invoices/${id}`}>
          <Button variant="outline" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoice
          </Button>
        </Link>
        <Button onClick={handlePrint} data-testid="button-print-label">
          <Printer className="h-4 w-4 mr-2" />
          Print Shipping Label
        </Button>
      </div>

      <div className="shipping-label-page">
        <div className="shipping-label-title">Shipping Label</div>

        <div className="label-section">
          <div className="label-header">Ship To</div>
          <div className="label-content">
            <div className="label-field">
              <span className="field-label">Customer Name:</span>
              <span className="field-value">{shipToName}</span>
            </div>
            {shipAddress && (
              <>
                {shipAddress.street && (
                  <div className="label-field">
                    <span className="field-label">Address:</span>
                    <span className="field-value">{shipAddress.street}</span>
                  </div>
                )}
                <div className="label-field">
                  <span className="field-label">City, State ZIP:</span>
                  <span className="field-value">
                    {shipAddress.city || ""}
                    {shipAddress.state ? `, ${shipAddress.state}` : ""}{" "}
                    {shipAddress.zipCode || ""}
                  </span>
                </div>
                {shipAddress.country && (
                  <div className="label-field">
                    <span className="field-label">Country:</span>
                    <span className="field-value">{shipAddress.country}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="label-section">
          <div className="label-header">Shipment Details</div>
          <div className="label-content">
            <div className="label-field">
              <span className="field-label">Invoice Number:</span>
              <span className="field-value">{invoice.invoiceNumber}</span>
            </div>
            <div className="label-field">
              <span className="field-label">Total Cartons:</span>
              <span className="field-value">{totalCartons}</span>
            </div>
            <div className="label-field">
              <span className="field-label">Total Pallets:</span>
              <input
                type="text"
                value={palletCount}
                onChange={(e) => setPalletCount(e.target.value)}
                className="blank-field px-2"
                placeholder="Enter pallet count"
                data-testid="input-pallet-count"
                style={{
                  border: "none",
                  borderBottom: "1px solid #000",
                  outline: "none",
                  background: "transparent",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
