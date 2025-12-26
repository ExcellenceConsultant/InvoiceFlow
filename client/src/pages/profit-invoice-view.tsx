import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, ShieldAlert } from "lucide-react";
import { useRef } from "react";
import { useLocation, useParams } from "wouter";

interface ProfitLineItem {
  srNo: number;
  productCode: string;
  packingSize: string;
  productDescription: string;
  qty: number;
  ratePerCarton: number;
  marginPerCarton: number;
  totalAmount: number;
  totalMargin: number;
}

interface ProfitInvoiceData {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  invoiceType: string;
  lineItems: ProfitLineItem[];
  totalAmount: number;
  totalMargin: number;
  marginPercent: number;
}

function ProfitInvoiceContent({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery<ProfitInvoiceData>({
    queryKey: ["/api/profitability/invoices", id],
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto mt-20">
          <CardContent className="flex flex-col items-center py-10 gap-4">
            <h2 className="text-xl font-semibold">Invoice Not Found</h2>
            <p className="text-muted-foreground text-center">
              The requested invoice could not be found or you don't have access to it.
            </p>
            <Button variant="outline" onClick={() => setLocation("/profitability")}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .profit-invoice-print, .profit-invoice-print * {
            visibility: visible;
          }
          .profit-invoice-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .total-margin-value {
            font-weight: bold !important;
            color: #16a34a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .text-right {
            text-align: right !important;
          }
        }
      `}</style>
      
      <div className="container mx-auto p-6">
        <div className="no-print mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setLocation("/profitability")}
            className="flex items-center gap-2"
            data-testid="button-back-to-profitability"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profitability
          </Button>
          <Button
            onClick={handlePrint}
            className="flex items-center gap-2"
            data-testid="button-print-profit-invoice"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>

        <div ref={printRef} className="profit-invoice-print bg-white rounded-lg shadow-sm border p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-center mb-2">
              Invoice Profitability Report
            </h1>
            <div className="text-center text-sm text-muted-foreground print:text-black">
              <span className="font-semibold">Confidential - Super Admin Only</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p><span className="font-semibold">Invoice Number:</span> {data.invoiceNumber}</p>
              <p><span className="font-semibold">Customer:</span> {data.customerName}</p>
            </div>
            <div className="text-right">
              <p><span className="font-semibold">Date:</span> {formatDate(data.invoiceDate)}</p>
              <p><span className="font-semibold">Type:</span> {data.invoiceType === "receivable" ? "AR Invoice" : "AP Bill"}</p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16">Sr No.</TableHead>
                <TableHead>Product Code</TableHead>
                <TableHead>Packing Size</TableHead>
                <TableHead>Product Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate Per Carton</TableHead>
                <TableHead className="text-right">Margin Per Carton</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right">Total Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lineItems.map((item) => (
                <TableRow key={item.srNo} data-testid={`row-line-item-${item.srNo}`}>
                  <TableCell>{item.srNo}</TableCell>
                  <TableCell>{item.productCode || "-"}</TableCell>
                  <TableCell>{item.packingSize || "-"}</TableCell>
                  <TableCell>{item.productDescription}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.ratePerCarton)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.marginPerCarton)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.totalAmount)}</TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {formatCurrency(item.totalMargin)}
                  </TableCell>
                </TableRow>
              ))}
              {data.lineItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No line items found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-8 pt-4 border-t">
            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Total Amount:</span>
                  <span>{formatCurrency(data.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Margin %:</span>
                  <span>{data.marginPercent.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-lg pt-2 border-t">
                  <span className="font-bold">Total Margin:</span>
                  <span className="font-bold text-green-600 total-margin-value" data-testid="text-total-margin">
                    {formatCurrency(data.totalMargin)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-muted-foreground print:text-gray-500">
            <p>Generated on {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ProfitInvoiceView() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { isLoading: authLoading } = useAuth();
  const { canViewProfitInvoice } = usePermissions();

  if (authLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!canViewProfitInvoice) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto mt-20">
          <CardContent className="flex flex-col items-center py-10 gap-4">
            <ShieldAlert className="w-16 h-16 text-destructive" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground text-center">
              You don't have permission to view this page. Only Super Admin users can access the Profit Invoice View.
            </p>
            <Button variant="outline" onClick={() => setLocation("/profitability")} data-testid="button-access-denied-back">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto mt-20">
          <CardContent className="flex flex-col items-center py-10 gap-4">
            <h2 className="text-xl font-semibold">Invalid Invoice</h2>
            <p className="text-muted-foreground text-center">
              No invoice ID was provided.
            </p>
            <Button variant="outline" onClick={() => setLocation("/profitability")}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ProfitInvoiceContent id={id} />;
}
