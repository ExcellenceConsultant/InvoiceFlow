import { useState } from "react";
import { formatDateMMDDYYYY } from "@/lib/dateUtils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Search,
  FileText,
  ArrowRight,
  Trash2,
  Eye,
  Edit,
  RefreshCw,
  ShoppingCart,
  Globe,
  CheckCircle,
} from "lucide-react";
import { useLocation } from "wouter";
import type { Customer, Product } from "@shared/schema";

type SOStatus = "pending" | "confirmed" | "converted" | "cancelled";

interface LineItem {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  productCode?: string | null;
  cartoonBarcode?: string | null;
  packingSize?: string | null;
  category?: string | null;
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  status: SOStatus;
  source: string;
  externalId?: string | null;
  notes?: string | null;
  salesOrder?: string | null;
  subtotal: string;
  freight: string;
  discount: string;
  total: string;
  convertedInvoiceId?: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems?: LineItem[];
}

const STATUS_COLORS: Record<SOStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  converted: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

function StatusBadge({ status }: { status: SOStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

const emptyLineItem = (): LineItem => ({
  description: "",
  quantity: 1,
  unitPrice: "0",
  lineTotal: "0",
  productId: null,
  productCode: null,
});

export default function SalesOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null);
  const [editOrder, setEditOrder] = useState<SalesOrder | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SalesOrder | null>(null);
  const [convertTarget, setConvertTarget] = useState<SalesOrder | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const canEdit = user?.role !== "viewer";
  const canDelete = ["super_admin", "admin"].includes(user?.role || "");
  const canConvert = user?.role !== "viewer";

  // Form state for create/edit
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formCustomerName, setFormCustomerName] = useState("");
  const [formStatus, setFormStatus] = useState<SOStatus>("pending");
  const [formPO, setFormPO] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formFreight, setFormFreight] = useState("0");
  const [formDiscount, setFormDiscount] = useState("0");
  const [formLineItems, setFormLineItems] = useState<LineItem[]>([emptyLineItem()]);
  const [lineItemCategoryFilter, setLineItemCategoryFilter] = useState("__all__");

  const { data: orders = [], isLoading, refetch } = useQuery<SalesOrder[]>({
    queryKey: ["/api/sales-orders"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sales-orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders"] });
      setCreateOpen(false);
      resetForm();
      toast({ title: "Sales order created" });
    },
    onError: () => toast({ title: "Failed to create sales order", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PUT", `/api/sales-orders/${id}`, data),
    onSuccess: (_: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders"] });
      queryClient.invalidateQueries({ queryKey: [`/api/sales-orders/${variables.id}`] });
      setEditOrder(null);
      resetForm();
      toast({ title: "Sales order updated" });
    },
    onError: () => toast({ title: "Failed to update sales order", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/sales-orders/${id}`),
    onSuccess: (_: any, id: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders"] });
      queryClient.invalidateQueries({ queryKey: [`/api/sales-orders/${id}`] });
      setDeleteTarget(null);
      toast({ title: "Sales order deleted" });
    },
    onError: () => toast({ title: "Failed to delete sales order", variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/sales-orders/${id}/convert`, {}),
    onSuccess: async (res: any, id: string) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders"] });
      queryClient.invalidateQueries({ queryKey: [`/api/sales-orders/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setConvertTarget(null);
      toast({
        title: `Converted to Invoice #${data.invoiceNumber}`,
        description: "Sales order converted successfully.",
      });
    },
    onError: () => toast({ title: "Failed to convert sales order", variant: "destructive" }),
  });

  function resetForm() {
    setFormCustomerId("");
    setFormCustomerName("");
    setFormStatus("pending");
    setFormPO("");
    setFormNotes("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormFreight("0");
    setFormDiscount("0");
    setFormLineItems([emptyLineItem()]);
    setLineItemCategoryFilter("__all__");
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
  }

  async function openEdit(order: SalesOrder) {
    setEditLoading(true);
    try {
      const res = await apiRequest("GET", `/api/sales-orders/${order.id}`);
      const fullOrder: SalesOrder = await res.json();
      setFormCustomerId(fullOrder.customerId || "");
      setFormCustomerName(fullOrder.customerName || "");
      setFormStatus(fullOrder.status);
      setFormPO(fullOrder.salesOrder || "");
      setFormNotes(fullOrder.notes || "");
      setFormDate(fullOrder.orderDate ? fullOrder.orderDate.split("T")[0] : new Date().toISOString().split("T")[0]);
      setFormFreight(fullOrder.freight || "0");
      setFormDiscount(fullOrder.discount || "0");
      setFormLineItems(
        (fullOrder.lineItems || []).length > 0
          ? fullOrder.lineItems!.map((li) => ({ ...li }))
          : [emptyLineItem()]
      );
      setEditOrder(fullOrder);
    } catch {
      toast({ title: "Failed to load sales order details", variant: "destructive" });
    } finally {
      setEditLoading(false);
    }
  }

  function calcTotals() {
    const subtotal = formLineItems.reduce((sum, li) => sum + parseFloat(li.lineTotal || "0"), 0);
    const total = subtotal + parseFloat(formFreight || "0") - parseFloat(formDiscount || "0");
    return { subtotal: subtotal.toFixed(2), total: Math.max(0, total).toFixed(2) };
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string | number | null) {
    setFormLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        const qty = field === "quantity" ? Number(value) : Number(item.quantity);
        const price = field === "unitPrice" ? String(value) : item.unitPrice;
        item.lineTotal = (qty * parseFloat(price || "0")).toFixed(2);
      }
      updated[index] = item;
      return updated;
    });
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setFormLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      item.productId = productId;
      item.description = product.name;
      item.productCode = product.itemCode || null;
      item.packingSize = product.packingSize || null;
      item.category = product.category || null;
      item.cartoonBarcode = product.cartoonBarcode || null;
      item.unitPrice = product.salesPrice || product.basePrice || "0";
      item.lineTotal = (Number(item.quantity) * parseFloat(item.unitPrice)).toFixed(2);
      updated[index] = item;
      return updated;
    });
  }

  function buildPayload() {
    const { subtotal, total } = calcTotals();
    const customerId = formCustomerId || null;
    const customer = customers.find((c) => c.id === formCustomerId);
    const customerName = formCustomerName || (customer?.name ?? null);
    return {
      order: {
        customerId,
        customerName,
        status: formStatus,
        salesOrder: formPO || null,
        orderDate: formDate || null,
        notes: formNotes || null,
        freight: formFreight || "0",
        discount: formDiscount || "0",
        subtotal,
        total,
      },
      lineItems: formLineItems.filter((li) => li.description.trim()),
    };
  }

  const filtered = orders.filter((o) => {
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      o.orderNumber.toLowerCase().includes(q) ||
      (o.customerName || "").toLowerCase().includes(q) ||
      (customers.find((c) => c.id === o.customerId)?.name || "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    confirmed: orders.filter((o) => o.status === "confirmed").length,
    converted: orders.filter((o) => o.status === "converted").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Sales Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage and convert sales orders into invoices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          {canEdit && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              New Sales Order
            </Button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "pending", "confirmed", "converted", "cancelled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}{" "}
            <span className="ml-1 opacity-70">({counts[s]})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by order number or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingCart className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">
                {orders.length === 0
                  ? "No sales orders yet. Create your first one or sync from a third-party app."
                  : "No orders match your filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Order #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => {
                    const customer = customers.find((c) => c.id === order.customerId);
                    const displayName = customer?.name || order.customerName || "—";
                    return (
                      <tr key={order.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-foreground">{displayName}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3">
                          {order.source === "api" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                              <Globe className="h-3 w-3" />
                              API
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Manual</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          ${parseFloat(order.total || "0").toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {formatDateMMDDYYYY(order.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="View"
                              onClick={() => setLocation(`/sales-orders/${order.id}`)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canEdit && order.status !== "converted" && order.status !== "cancelled" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="Edit"
                                onClick={() => openEdit(order)}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canConvert && order.status !== "converted" && order.status !== "cancelled" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Convert to Invoice"
                                onClick={() => setConvertTarget(order)}
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {order.status === "converted" && order.convertedInvoiceId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-green-600"
                                title="View Invoice"
                                onClick={() => setLocation(`/invoices/${order.convertedInvoiceId}`)}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Invoice
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Delete"
                                onClick={() => setDeleteTarget(order)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── View Dialog ── */}
      <Dialog open={!!viewOrder} onOpenChange={(o) => !o && setViewOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Sales Order {viewOrder?.orderNumber}
            </DialogTitle>
            <DialogDescription>
              {viewOrder && (
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={viewOrder.status} />
                  {viewOrder.source === "api" && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                      <Globe className="h-3 w-3" />
                      From external API
                    </span>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          {viewOrder && <OrderDetail order={viewOrder} customers={customers} />}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {canConvert &&
              viewOrder?.status !== "converted" &&
              viewOrder?.status !== "cancelled" && (
                <Button
                  className="gap-2"
                  onClick={() => {
                    setConvertTarget(viewOrder);
                    setViewOrder(null);
                  }}
                >
                  <ArrowRight className="h-4 w-4" />
                  Convert to Invoice
                </Button>
              )}
            {viewOrder?.status === "converted" && viewOrder.convertedInvoiceId && (
              <Button
                variant="outline"
                onClick={() => setLocation(`/invoices/${viewOrder.convertedInvoiceId}`)}
              >
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                View Invoice
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewOrder(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create / Edit Dialog ── */}
      <Dialog
        open={createOpen || !!editOrder}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setEditOrder(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editOrder ? `Edit Sales Order ${editOrder.orderNumber}` : "New Sales Order"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Customer */}
              <div className="space-y-1.5">
                <Label>Customer</Label>
                <Select
                  value={formCustomerId || "__none__"}
                  onValueChange={(v) => setFormCustomerId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— No customer —</SelectItem>
                    {customers
                      .filter((c) => c.type === "customer" && c.isActive)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Customer name fallback */}
              {!formCustomerId && (
                <div className="space-y-1.5">
                  <Label>Customer Name (if not in list)</Label>
                  <Input
                    placeholder="e.g. Acme Corp"
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                  />
                </div>
              )}

              {/* Order Date */}
              <div className="space-y-1.5">
                <Label>Order Date</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as SOStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* PO */}
              <div className="space-y-1.5">
                <Label>Sales Order</Label>
                <Input placeholder="Optional" value={formPO} onChange={(e) => setFormPO(e.target.value)} />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>

            <Separator />

            {/* Line Items */}
            <div>
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">Invoice Items</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Filter by Category:</span>
                  <Select
                    value={lineItemCategoryFilter}
                    onValueChange={setLineItemCategoryFilter}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {Array.from(new Set(products.map((p) => p.category).filter(Boolean))).map((cat) => (
                        <SelectItem key={cat!} value={cat!}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[2fr_2fr_80px_100px_100px_36px] gap-2 mb-1 px-1">
                <span className="text-xs text-muted-foreground font-medium">Product</span>
                <span className="text-xs text-muted-foreground font-medium">Description</span>
                <span className="text-xs text-muted-foreground font-medium">Qty</span>
                <span className="text-xs text-muted-foreground font-medium">Rate</span>
                <span className="text-xs text-muted-foreground font-medium">Amount</span>
                <span />
              </div>

              {/* Rows */}
              <div className="space-y-1.5">
                {formLineItems.map((item, idx) => {
                  const filteredProducts = lineItemCategoryFilter === "__all__"
                    ? products
                    : products.filter((p) => p.category === lineItemCategoryFilter);
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-[2fr_2fr_80px_100px_100px_36px] gap-2 items-center"
                    >
                      {/* Product */}
                      <Select
                        value={item.productId || "__none__"}
                        onValueChange={(v) => {
                          if (v && v !== "__none__") selectProduct(idx, v);
                          else updateLineItem(idx, "productId", null);
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Select Product" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Select Product</SelectItem>
                          {filteredProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} {p.itemCode ? `(${p.itemCode})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Description */}
                      <Input
                        className="h-9 text-xs"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                      />

                      {/* Qty */}
                      <Input
                        type="number"
                        min={1}
                        className="h-9 text-xs text-center"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(idx, "quantity", parseInt(e.target.value) || 1)}
                      />

                      {/* Rate */}
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        className="h-9 text-xs"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(idx, "unitPrice", e.target.value)}
                      />

                      {/* Amount */}
                      <div className="h-9 flex items-center justify-center px-2 bg-muted rounded-md text-xs font-medium border border-border">
                        ${parseFloat(item.lineTotal || "0").toFixed(2)}
                      </div>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          setFormLineItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        disabled={formLineItems.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Add Item button */}
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setFormLineItems((prev) => [...prev, emptyLineItem()])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Item
              </Button>
            </div>

            <Separator />

            {/* Totals */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Freight ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formFreight}
                  onChange={(e) => setFormFreight(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Discount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formDiscount}
                  onChange={(e) => setFormDiscount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Total Qty</Label>
                <div className="h-10 flex items-center px-3 bg-muted rounded-md font-semibold">
                  {formLineItems.reduce((sum, li) => sum + (Number(li.quantity) || 0), 0)}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Total</Label>
                <div className="h-10 flex items-center px-3 bg-muted rounded-md font-bold text-lg">
                  ${calcTotals().total}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setEditOrder(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={createMutation.isPending || updateMutation.isPending}
              onClick={() => {
                const payload = buildPayload();
                if (editOrder) {
                  updateMutation.mutate({ id: editOrder.id, data: payload });
                } else {
                  createMutation.mutate(payload);
                }
              }}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editOrder
                ? "Save Changes"
                : "Create Sales Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Convert Confirmation ── */}
      <AlertDialog open={!!convertTarget} onOpenChange={(o) => !o && setConvertTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-green-600" />
              Convert to Invoice
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new AR invoice from sales order{" "}
              <strong>{convertTarget?.orderNumber}</strong> and mark the order as converted. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={() => convertTarget && convertMutation.mutate(convertTarget.id)}
              disabled={convertMutation.isPending}
            >
              {convertMutation.isPending ? "Converting..." : "Convert to Invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sales Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete order{" "}
              <strong>{deleteTarget?.orderNumber}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OrderDetail({ order, customers }: { order: SalesOrder; customers: Customer[] }) {
  const customer = customers.find((c) => c.id === order.customerId);
  const displayName = customer?.name || order.customerName || "—";

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-muted-foreground text-xs">Customer</p>
          <p className="font-medium">{displayName}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Sales Order</p>
          <p className="font-medium">{order.salesOrder || "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Created</p>
          <p className="font-medium">{formatDateMMDDYYYY(order.createdAt)}</p>
        </div>
        {order.externalId && (
          <div>
            <p className="text-muted-foreground text-xs">External ID</p>
            <p className="font-mono text-xs">{order.externalId}</p>
          </div>
        )}
        {order.convertedInvoiceId && (
          <div>
            <p className="text-muted-foreground text-xs">Converted</p>
            <p className="font-medium text-green-600">Invoice created</p>
          </div>
        )}
      </div>

      {order.notes && (
        <div>
          <p className="text-muted-foreground text-xs mb-1">Notes</p>
          <p className="bg-muted rounded p-2 text-xs">{order.notes}</p>
        </div>
      )}

      {/* Line Items */}
      {order.lineItems && order.lineItems.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">LINE ITEMS</p>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                  <th className="text-left px-3 py-2 font-medium">Code</th>
                  <th className="text-right px-3 py-2 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 font-medium">Unit Price</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.lineItems.map((li, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{li.description}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{li.productCode || "—"}</td>
                    <td className="px-3 py-2 text-right">{li.quantity}</td>
                    <td className="px-3 py-2 text-right">${parseFloat(li.unitPrice || "0").toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-medium">${parseFloat(li.lineTotal || "0").toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="flex flex-col items-end gap-1 text-xs">
        <div className="flex gap-8">
          <span className="text-muted-foreground">Subtotal</span>
          <span>${parseFloat(order.subtotal || "0").toFixed(2)}</span>
        </div>
        {parseFloat(order.freight || "0") > 0 && (
          <div className="flex gap-8">
            <span className="text-muted-foreground">Freight</span>
            <span>${parseFloat(order.freight).toFixed(2)}</span>
          </div>
        )}
        {parseFloat(order.discount || "0") > 0 && (
          <div className="flex gap-8">
            <span className="text-muted-foreground">Discount</span>
            <span>−${parseFloat(order.discount).toFixed(2)}</span>
          </div>
        )}
        <div className="flex gap-8 font-bold text-sm border-t pt-1 mt-1">
          <span>Total</span>
          <span>${parseFloat(order.total || "0").toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
