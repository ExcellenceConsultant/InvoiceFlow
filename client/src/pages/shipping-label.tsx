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
          size: A4 landscape; 
          margin: 10mm;
          background: white;
        }
        body { margin: 0; padding: 0; background: white !important; }
        html { background: white !important; }
        * { box-shadow: none !important; background-color: white !important; }
        .container { background: white !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
        .shipping-label-page { 
          box-shadow: none; 
          border: none; 
          margin: 0 !important; 
          padding: 3mm !important; 
          width: 100%; 
          height: 100%;
          min-height: auto; 
          background: white !important; 
          display: flex;
          flex-direction: column;
        }
        .shipping-label-title {
          font-size: 36px !important;
          margin-bottom: 8mm !important;
        }
        .label-container {
          padding: 12mm 20mm !important;
          border-width: 4px !important;
          flex: 1;
        }
        .section-title {
          font-size: 24px !important;
          margin-bottom: 6mm !important;
        }
        .label-field {
          margin-bottom: 5mm !important;
        }
        .print-hide { display: none !important; }
      }

      .shipping-label-page {
        background: white;
        padding: 40px;
        font-family: Arial, sans-serif;
        font-size: 20px;
        line-height: 1.6;
        max-width: 100%;
        margin: 0 auto;
        position: relative;
      }

      .shipping-label-title {
        text-align: center;
        font-size: 36px;
        font-weight: bold;
        margin-bottom: 30px;
      }

      .label-container {
        border: 4px solid #000;
        padding: 40px 50px;
        background: white;
      }

      .section-title {
        font-weight: bold;
        font-size: 24px;
        margin-bottom: 20px;
      }

      .label-field {
        margin-bottom: 18px;
        display: flex;
        align-items: baseline;
      }

      .field-label {
        display: inline-block;
        min-width: 200px;
        font-size: 20px;
      }

      .field-value {
        display: inline-block;
        font-size: 20px;
      }

      .field-value-bold {
        display: inline-block;
        font-size: 20px;
        font-weight: bold;
      }

      @media print {
        .field-label {
          font-size: 20px !important;
        }
        .field-value,
        .field-value-bold {
          font-size: 20px !important;
        }
        input {
          border: none;
          background: white !important;
          font-size: 20px !important;
          outline: none;
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
    <div className="container max-w-6xl mx-auto p-6">
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

        <div className="label-container">
          <div className="section-title">Ship To</div>
          
          <div className="label-field">
            <span className="field-label">Customer Name :</span>
            <span className="field-value-bold">{shipToName}</span>
          </div>

          {shipAddress && (
            <>
              {shipAddress.street && (
                <div className="label-field">
                  <span className="field-label">Address :</span>
                  <span className="field-value">{shipAddress.street}</span>
                </div>
              )}
              
              <div className="label-field">
                <span className="field-label">City, State, ZIP :</span>
                <span className="field-value">
                  {shipAddress.city || ""}
                  {shipAddress.state ? `, ${shipAddress.state}` : ""}{" "}
                  {shipAddress.zipCode || ""}
                </span>
              </div>

              {shipAddress.country && (
                <div className="label-field">
                  <span className="field-label">Country :</span>
                  <span className="field-value">{shipAddress.country}</span>
                </div>
              )}
            </>
          )}

          <div className="label-field">
            <span className="field-label">Total Cartons :</span>
            <span className="field-value">{totalCartons}</span>
          </div>

          <div className="label-field">
            <span className="field-label">Total Pallets :</span>
            <input
              type="text"
              value={palletCount}
              onChange={(e) => setPalletCount(e.target.value)}
              className="field-value"
              placeholder=""
              data-testid="input-pallet-count"
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                width: "200px",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
