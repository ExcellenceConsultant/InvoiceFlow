import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDateWithoutTimezone } from "@/lib/dateUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn, formatCurrency } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  DollarSign,
  Eye,
  Percent,
  Package,
  Users,
  FileText,
  TrendingUp,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";

type DateFilterOption = "all" | "last_30_days" | "last_3_months" | "last_6_months" | "last_12_months" | "this_year" | "custom";

interface LineItem {
  id: string;
  productId: string;
  description: string;
  productCode: string;
  quantity: number;
  unitPrice: string;
  marginPerCarton: string | null;
  totalAmount: number;
  totalMargin: number;
}

interface InvoiceWithItems {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerId: string;
  customerName: string;
  status: string;
  lineItems: LineItem[];
  totalAmount: number;
  totalMargin: number;
  marginPercent: number;
}

interface CustomerReport {
  customerId: string;
  customerName: string;
  totalInvoices: number;
  totalCartons: number;
  totalAmount: number;
  totalMargin: number;
  marginPercent: number;
}

interface ProductReport {
  productId: string;
  itemCode: string;
  productName: string;
  category: string;
  totalQty: number;
  totalAmount: number;
  totalMargin: number;
  avgMarginPerCarton: number;
  marginPercent: number;
}

type SortOrder = "asc" | "desc";

interface SortConfig {
  field: string;
  order: SortOrder;
}

interface InventoryMarginItem {
  id: string;
  itemCode: string;
  name: string;
  category: string;
  packingSize: string;
  salesPrice: number;
  marginPerCarton: number | null;
  marginUpdatedBy: string | null;
  marginUpdatedAt: string | null;
}

const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

const calculateDateRange = (option: DateFilterOption, customRange?: DateRange) => {
  const now = new Date();
  const startOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const endOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  switch (option) {
    case "all":
      return { start: null, end: null };
    case "last_30_days": {
      const end = endOfDay(now);
      const start = startOfDay(new Date(now));
      start.setDate(start.getDate() - 29);
      return { start, end };
    }
    case "last_3_months": {
      const end = endOfDay(now);
      const start = startOfDay(new Date(now.getFullYear(), now.getMonth() - 2, 1));
      return { start, end };
    }
    case "last_6_months": {
      const end = endOfDay(now);
      const start = startOfDay(new Date(now.getFullYear(), now.getMonth() - 5, 1));
      return { start, end };
    }
    case "last_12_months": {
      const end = endOfDay(now);
      const start = startOfDay(new Date(now.getFullYear(), now.getMonth() - 11, 1));
      return { start, end };
    }
    case "this_year": {
      const start = startOfDay(new Date(now.getFullYear(), 0, 1));
      const end = endOfDay(new Date(now.getFullYear(), 11, 31));
      return { start, end };
    }
    case "custom": {
      if (customRange?.from && customRange?.to) {
        return { start: startOfDay(customRange.from), end: endOfDay(customRange.to) };
      }
      return { start: null, end: null };
    }
    default:
      return { start: null, end: null };
  }
};

export default function Profitability() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { canViewProfitInvoice } = usePermissions();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("invoices");
  const [dateFilterOption, setDateFilterOption] = useState<DateFilterOption>("last_12_months");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [editingMargin, setEditingMargin] = useState<{ itemId: string; value: string } | null>(null);
  const [isAddMarginOpen, setIsAddMarginOpen] = useState(false);
  const [marginSearch, setMarginSearch] = useState("");
  const [marginCategoryFilter, setMarginCategoryFilter] = useState<string>("all");
  const [selectedMarginItems, setSelectedMarginItems] = useState<Set<string>>(new Set());
  const [bulkMarginValue, setBulkMarginValue] = useState("");
  const [individualMargins, setIndividualMargins] = useState<Record<string, string>>({});
  const [marginDialogTab, setMarginDialogTab] = useState<"inventory" | "category">("inventory");
  const [catMarginCustomerCategory, setCatMarginCustomerCategory] = useState<string>("");
  const [catMarginProductMargins, setCatMarginProductMargins] = useState<Record<string, string>>({});
  const [catMarginGlobalValue, setCatMarginGlobalValue] = useState<string>("");
  const [catMarginSearch, setCatMarginSearch] = useState("");
  const [catMarginInventoryFilter, setCatMarginInventoryFilter] = useState<string>("all");
  
  // Sorting state for each tab
  const [invoiceSort, setInvoiceSort] = useState<SortConfig>({ field: "invoiceDate", order: "desc" });
  const [customerSort, setCustomerSort] = useState<SortConfig>({ field: "customerName", order: "asc" });
  const [productSort, setProductSort] = useState<SortConfig>({ field: "productName", order: "asc" });
  
  // Global category filter (applies to all tabs and KPI cards)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const isSuperAdmin = user?.role === "super_admin";

  const selectedDateRange = useMemo(
    () => calculateDateRange(dateFilterOption, customDateRange),
    [dateFilterOption, customDateRange]
  );

  const filterParams = useMemo(() => ({
    startDate: selectedDateRange.start?.toISOString() || null,
    endDate: selectedDateRange.end?.toISOString() || null,
    customerId: customerFilter !== "all" ? customerFilter : null,
    categories: selectedCategories.length > 0 ? selectedCategories.join(",") : null,
  }), [selectedDateRange, customerFilter, selectedCategories]);

  const buildQueryParamsString = () => {
    const params = new URLSearchParams();
    if (filterParams.startDate) params.append("startDate", filterParams.startDate);
    if (filterParams.endDate) params.append("endDate", filterParams.endDate);
    if (filterParams.customerId) params.append("customerId", filterParams.customerId);
    if (filterParams.categories) params.append("categories", filterParams.categories);
    return params.toString();
  };

  const { data: customers } = useQuery<any[]>({
    queryKey: ["/api/customers"],
    enabled: isSuperAdmin,
  });

  // Profitability summary for KPI cards
  const { data: summaryData, isLoading: summaryLoading } = useQuery<{
    totalInvoices: number;
    totalRevenue: number;
    totalMargin: number;
    marginPercent: number;
    categories: string[];
  }>({
    queryKey: ["/api/profitability/summary", filterParams],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (filterParams.startDate) params.append("startDate", filterParams.startDate);
      if (filterParams.endDate) params.append("endDate", filterParams.endDate);
      if (filterParams.customerId) params.append("customerId", filterParams.customerId);
      if (filterParams.categories) params.append("categories", filterParams.categories);
      const response = await fetch(`/api/profitability/summary?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch profitability summary");
      return response.json();
    },
    enabled: isSuperAdmin,
  });

  const availableCategories = summaryData?.categories || [];

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery<InvoiceWithItems[]>({
    queryKey: ["/api/profitability/invoices", filterParams, invoiceSort],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (filterParams.startDate) params.append("startDate", filterParams.startDate);
      if (filterParams.endDate) params.append("endDate", filterParams.endDate);
      if (filterParams.customerId) params.append("customerId", filterParams.customerId);
      if (filterParams.categories) params.append("categories", filterParams.categories);
      params.append("sort_by", invoiceSort.field);
      params.append("sort_order", invoiceSort.order);
      const response = await fetch(`/api/profitability/invoices?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch profitability data");
      return response.json();
    },
    enabled: isSuperAdmin,
  });

  const { data: customerReport, isLoading: customerReportLoading } = useQuery<CustomerReport[]>({
    queryKey: ["/api/profitability/reports/customer", filterParams, customerSort],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (filterParams.startDate) params.append("startDate", filterParams.startDate);
      if (filterParams.endDate) params.append("endDate", filterParams.endDate);
      if (filterParams.customerId) params.append("customerId", filterParams.customerId);
      if (filterParams.categories) params.append("categories", filterParams.categories);
      params.append("sort_by", customerSort.field);
      params.append("sort_order", customerSort.order);
      const response = await fetch(`/api/profitability/reports/customer?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch customer report");
      return response.json();
    },
    enabled: isSuperAdmin && activeTab === "customers",
  });

  const { data: productReportData, isLoading: productReportLoading } = useQuery<{ report: ProductReport[]; categories: string[] }>({
    queryKey: ["/api/profitability/reports/product", filterParams, productSort],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (filterParams.startDate) params.append("startDate", filterParams.startDate);
      if (filterParams.endDate) params.append("endDate", filterParams.endDate);
      if (filterParams.customerId) params.append("customerId", filterParams.customerId);
      if (filterParams.categories) params.append("categories", filterParams.categories);
      params.append("sort_by", productSort.field);
      params.append("sort_order", productSort.order);
      const response = await fetch(`/api/profitability/reports/product?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch product report");
      return response.json();
    },
    enabled: isSuperAdmin && activeTab === "products",
  });

  const productReport = productReportData?.report || [];

  const { data: inventoryMarginsData, isLoading: inventoryMarginsLoading } = useQuery<{ items: InventoryMarginItem[]; categories: string[] }>({
    queryKey: ["/api/inventory/margins"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/inventory/margins", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch inventory margins");
      return response.json();
    },
    enabled: isSuperAdmin && isAddMarginOpen,
  });

  const inventoryMargins = inventoryMarginsData?.items || [];

  const { data: customerCategories = [], refetch: refetchCustomerCategories } = useQuery<{ category: string; customerCount: number }[]>({
    queryKey: ["/api/customer-categories"],
    enabled: isSuperAdmin && isAddMarginOpen && marginDialogTab === "category",
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    enabled: isSuperAdmin && isAddMarginOpen && marginDialogTab === "category",
  });

  const { data: categoryMarginsData = [] } = useQuery<any[]>({
    queryKey: ["/api/category-margins/category", catMarginCustomerCategory],
    queryFn: async () => {
      if (!catMarginCustomerCategory) return [];
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/category-margins/category/${encodeURIComponent(catMarginCustomerCategory)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!catMarginCustomerCategory,
  });

  const saveCategoryMarginMutation = useMutation({
    mutationFn: async ({ customerCategory, productId, marginPercent }: { customerCategory: string; productId: string | null; marginPercent: number }) => {
      const response = await apiRequest("POST", "/api/category-margins", {
        customerCategory,
        productId,
        marginPercent,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/category-margins/category", catMarginCustomerCategory] });
      toast({ title: "Success", description: "Category margin saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save category margin", variant: "destructive" });
    },
  });

  const catMarginInventoryCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p: any) => { if (p.category) cats.add(p.category); });
    return Array.from(cats).sort();
  }, [products]);

  const filteredCatMarginProducts = useMemo(() => {
    return products.filter((p: any) => {
      const matchesSearch = catMarginSearch === "" ||
        p.name?.toLowerCase().includes(catMarginSearch.toLowerCase()) ||
        p.itemCode?.toLowerCase().includes(catMarginSearch.toLowerCase());
      const matchesCategory = catMarginInventoryFilter === "all" || p.category === catMarginInventoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, catMarginSearch, catMarginInventoryFilter]);

  const getCatMarginExisting = (productId: string | null): string => {
    const m = categoryMarginsData.find((r: any) => r.productId === productId);
    return m?.marginPercent || "";
  };

  const getCatMarginCurrent = (productId: string): string => {
    if (catMarginProductMargins[productId] !== undefined) return catMarginProductMargins[productId];
    return getCatMarginExisting(productId);
  };

  const handleSaveCatMarginProduct = (productId: string) => {
    const val = parseFloat(catMarginProductMargins[productId]);
    if (isNaN(val) || val < 0) {
      toast({ title: "Invalid value", description: "Please enter a valid margin %", variant: "destructive" });
      return;
    }
    saveCategoryMarginMutation.mutate({ customerCategory: catMarginCustomerCategory, productId, marginPercent: val });
  };

  const handleSaveCatMarginGlobal = () => {
    const val = parseFloat(catMarginGlobalValue);
    if (isNaN(val) || val < 0) {
      toast({ title: "Invalid value", description: "Please enter a valid margin %", variant: "destructive" });
      return;
    }
    saveCategoryMarginMutation.mutate({ customerCategory: catMarginCustomerCategory, productId: null, marginPercent: val });
  };

  const applyMarginMutation = useMutation({
    mutationFn: async (items: { id: string; marginPerCarton: number }[]) => {
      const response = await apiRequest("PUT", "/api/inventory/apply-margin", { items });
      if (!response.ok) throw new Error("Failed to apply margins");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/margins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profitability/invoices"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/profitability/reports/customer"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/profitability/reports/product"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/profitability/summary"], exact: false });
      toast({ title: "Success", description: `Updated margins for ${data.updated} products` });
      setIsAddMarginOpen(false);
      setSelectedMarginItems(new Set());
      setBulkMarginValue("");
      setIndividualMargins({});
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to apply margins", variant: "destructive" });
    },
  });

  const updateMarginMutation = useMutation({
    mutationFn: async ({ itemId, marginPerCarton }: { itemId: string; marginPerCarton: number }) => {
      const response = await apiRequest("PATCH", `/api/profitability/line-items/${itemId}/margin`, {
        marginPerCarton,
      });
      if (!response.ok) throw new Error("Failed to update margin");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profitability/invoices"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/profitability/reports/customer"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/profitability/reports/product"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/profitability/summary"], exact: false });
      toast({ title: "Success", description: "Margin updated successfully" });
      setEditingMargin(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update margin", variant: "destructive" });
    },
  });

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted to-secondary/20 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-bold text-destructive">Access Denied</h2>
            <p className="text-muted-foreground mt-2">
              This module is only accessible to Super Admins.
            </p>
            <Button className="mt-4" onClick={() => setLocation("/")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const toggleInvoiceExpand = (invoiceId: string) => {
    setExpandedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const handleMarginSave = (itemId: string) => {
    if (!editingMargin || editingMargin.itemId !== itemId) return;
    const value = parseFloat(editingMargin.value);
    if (isNaN(value) || value < 0) {
      toast({ title: "Invalid value", description: "Please enter a valid margin amount", variant: "destructive" });
      return;
    }
    updateMarginMutation.mutate({ itemId, marginPerCarton: value });
  };

  // Sorting handlers
  const handleInvoiceSort = (field: string) => {
    setInvoiceSort((prev) => ({
      field,
      order: prev.field === field && prev.order === "desc" ? "asc" : prev.field === field && prev.order === "asc" ? "desc" : "desc",
    }));
  };

  const handleCustomerSort = (field: string) => {
    setCustomerSort((prev) => ({
      field,
      order: prev.field === field && prev.order === "asc" ? "desc" : prev.field === field && prev.order === "desc" ? "asc" : "asc",
    }));
  };

  const handleProductSort = (field: string) => {
    setProductSort((prev) => ({
      field,
      order: prev.field === field && prev.order === "asc" ? "desc" : prev.field === field && prev.order === "desc" ? "asc" : "asc",
    }));
  };

  // Sortable header component
  const SortableHeader = ({ 
    field, 
    label, 
    currentSort, 
    onSort, 
    className = "" 
  }: { 
    field: string; 
    label: string; 
    currentSort: SortConfig; 
    onSort: (field: string) => void; 
    className?: string;
  }) => (
    <TableHead 
      className={cn("cursor-pointer select-none hover:bg-muted/50", className)}
      onClick={() => onSort(field)}
      data-testid={`sort-${field}`}
    >
      <div className="flex items-center gap-1">
        {label}
        {currentSort.field === field ? (
          currentSort.order === "asc" ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  // Use summary data from API for KPI cards (consistent with category filter)
  const totals = useMemo(() => {
    if (!summaryData) return { totalAmount: 0, totalMargin: 0, marginPercent: 0, invoiceCount: 0 };
    return {
      totalAmount: summaryData.totalRevenue,
      totalMargin: summaryData.totalMargin,
      marginPercent: summaryData.marginPercent,
      invoiceCount: summaryData.totalInvoices,
    };
  }, [summaryData]);

  const inventoryCategories = useMemo(() => {
    return inventoryMarginsData?.categories || [];
  }, [inventoryMarginsData]);

  const filteredInventoryMargins = useMemo(() => {
    if (!inventoryMargins || inventoryMargins.length === 0) return [];
    return inventoryMargins.filter((item) => {
      const matchesSearch = marginSearch === "" ||
        item.name.toLowerCase().includes(marginSearch.toLowerCase()) ||
        item.itemCode.toLowerCase().includes(marginSearch.toLowerCase());
      const matchesCategory = marginCategoryFilter === "all" || item.category === marginCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [inventoryMargins, marginSearch, marginCategoryFilter]);

  const handleSelectAllMargin = (checked: boolean) => {
    if (checked) {
      setSelectedMarginItems(new Set(filteredInventoryMargins.map((item) => item.id)));
    } else {
      setSelectedMarginItems(new Set());
    }
  };

  const handleToggleMarginItem = (itemId: string) => {
    setSelectedMarginItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleApplyBulkMargin = () => {
    const marginValue = parseFloat(bulkMarginValue);
    if (isNaN(marginValue) || marginValue < 0) {
      toast({ title: "Invalid value", description: "Please enter a valid margin amount", variant: "destructive" });
      return;
    }
    if (selectedMarginItems.size === 0) {
      toast({ title: "No items selected", description: "Please select at least one item", variant: "destructive" });
      return;
    }
    const items = Array.from(selectedMarginItems).map((id) => ({
      id,
      marginPerCarton: marginValue,
    }));
    applyMarginMutation.mutate(items);
  };

  const handleApplyIndividualMargins = () => {
    const items: { id: string; marginPerCarton: number }[] = [];
    for (const [id, value] of Object.entries(individualMargins)) {
      const marginValue = parseFloat(value);
      if (!isNaN(marginValue) && marginValue >= 0) {
        items.push({ id, marginPerCarton: marginValue });
      }
    }
    if (items.length === 0) {
      toast({ title: "No margins to apply", description: "Please enter margin values for at least one item", variant: "destructive" });
      return;
    }
    applyMarginMutation.mutate(items);
  };

  const exportToExcel = (type: "invoices" | "customers" | "products") => {
    let data: any[] = [];
    let filename = "";

    if (type === "invoices" && invoicesData) {
      data = invoicesData.flatMap((inv) =>
        inv.lineItems.map((item) => ({
          "Invoice #": inv.invoiceNumber || "",
          "Invoice Date": formatDateWithoutTimezone(inv.invoiceDate),
          Customer: inv.customerName || "",
          Status: inv.status || "",
          "Item Code": item.productCode || "",
          Description: item.description || "",
          Quantity: item.quantity || 0,
          "Unit Price": safeParseFloat(item.unitPrice),
          "Margin/Carton": safeParseFloat(item.marginPerCarton),
          Amount: safeParseFloat(item.totalAmount),
          Margin: safeParseFloat(item.totalMargin),
        }))
      );
      filename = "profitability_invoices.xlsx";
    } else if (type === "customers" && customerReport) {
      data = customerReport.map((c) => ({
        Customer: c.customerName || "",
        Invoices: c.totalInvoices || 0,
        "Total Cartons": c.totalCartons || 0,
        "Total Amount": safeParseFloat(c.totalAmount),
        "Total Margin": safeParseFloat(c.totalMargin),
        "Margin %": safeParseFloat(c.marginPercent).toFixed(2),
      }));
      filename = "profitability_customers.xlsx";
    } else if (type === "products" && productReport) {
      data = productReport.map((p) => ({
        "Item Code": p.itemCode || "",
        Product: p.productName || "",
        "Total Qty": p.totalQty || 0,
        "Total Amount": safeParseFloat(p.totalAmount),
        "Total Margin": safeParseFloat(p.totalMargin),
        "Avg Margin/Carton": safeParseFloat(p.avgMarginPerCarton).toFixed(2),
        "Margin %": safeParseFloat(p.marginPercent).toFixed(2),
      }));
      filename = "profitability_products.xlsx";
    }

    if (data.length === 0) {
      toast({ title: "No data", description: "No data available to export", variant: "destructive" });
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, filename);
    toast({ title: "Export Complete", description: `Exported ${data.length} rows to ${filename}` });
  };

  const dateFilterOptions = [
    { value: "all", label: "All dates" },
    { value: "last_30_days", label: "Last 30 days" },
    { value: "last_3_months", label: "Last 3 months" },
    { value: "last_6_months", label: "Last 6 months" },
    { value: "last_12_months", label: "Last 12 months" },
    { value: "this_year", label: "This year" },
    { value: "custom", label: "Custom" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-secondary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2" data-testid="page-title">
              <TrendingUp className="h-8 w-8 text-primary" />
              Profitability Analysis
            </h1>
            <p className="text-muted-foreground mt-1">Analyze margins and profitability by invoice, customer, and product</p>
          </div>
          <Button
            onClick={() => setIsAddMarginOpen(true)}
            data-testid="btn-add-margin"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Margin
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">AR Invoices</span>
              </div>
              <p className="text-2xl font-bold mt-1" data-testid="stat-invoices">{totals.invoiceCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <span className="text-sm text-muted-foreground">Total Revenue</span>
              </div>
              <p className="text-2xl font-bold mt-1" data-testid="stat-revenue">{formatCurrency(totals.totalAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <span className="text-sm text-muted-foreground">Total Margin</span>
              </div>
              <p className="text-2xl font-bold mt-1" data-testid="stat-margin">{formatCurrency(totals.totalMargin)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-purple-500" />
                <span className="text-sm text-muted-foreground">Margin %</span>
              </div>
              <p className="text-2xl font-bold mt-1" data-testid="stat-margin-percent">{totals.marginPercent.toFixed(2)}%</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <Popover open={isDateFilterOpen} onOpenChange={setIsDateFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-between" data-testid="date-filter-trigger">
                <CalendarDays className="h-4 w-4 mr-2" />
                {dateFilterOptions.find((o) => o.value === dateFilterOption)?.label || "Select date"}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-2 space-y-1">
                {dateFilterOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={dateFilterOption === option.value ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => {
                      if (option.value === "custom") {
                        setDateFilterOption("custom");
                      } else {
                        setDateFilterOption(option.value as DateFilterOption);
                        setIsDateFilterOpen(false);
                      }
                    }}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              {dateFilterOption === "custom" && (
                <div className="border-t p-2">
                  <Calendar
                    mode="range"
                    selected={customDateRange}
                    onSelect={(range) => {
                      setCustomDateRange(range);
                      if (range?.from && range?.to) {
                        setIsDateFilterOpen(false);
                      }
                    }}
                    numberOfMonths={2}
                  />
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="w-[200px]" data-testid="customer-filter">
              <SelectValue placeholder="All Customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers?.map((customer: any) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-between" data-testid="global-category-filter">
                <Package className="h-4 w-4 mr-2" />
                {selectedCategories.length > 0 
                  ? `${selectedCategories.length} Categories` 
                  : "All Categories"}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-2" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 pb-2 border-b">
                  <span className="text-sm font-medium">Filter by Category</span>
                  {selectedCategories.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs"
                      onClick={() => setSelectedCategories([])}
                      data-testid="clear-category-filter"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[200px]">
                  {availableCategories.map((category) => (
                    <div key={category} className="flex items-center space-x-2 py-1 px-2">
                      <Checkbox
                        id={`global-cat-${category}`}
                        checked={selectedCategories.includes(category)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCategories([...selectedCategories, category]);
                          } else {
                            setSelectedCategories(selectedCategories.filter((c) => c !== category));
                          }
                        }}
                        data-testid={`category-checkbox-${category}`}
                      />
                      <label htmlFor={`global-cat-${category}`} className="text-sm cursor-pointer flex-1">
                        {category}
                      </label>
                    </div>
                  ))}
                  {availableCategories.length === 0 && (
                    <p className="text-sm text-muted-foreground p-2">No categories available</p>
                  )}
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="invoices" data-testid="tab-invoices">
              <FileText className="h-4 w-4 mr-2" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">
              <Users className="h-4 w-4 mr-2" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">
              <Package className="h-4 w-4 mr-2" />
              Products
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Invoice Profitability</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportToExcel("invoices")} data-testid="export-invoices">
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </CardHeader>
              <CardContent>
                {invoicesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <SortableHeader field="invoiceNumber" label="Invoice #" currentSort={invoiceSort} onSort={handleInvoiceSort} />
                        <SortableHeader field="invoiceDate" label="Date" currentSort={invoiceSort} onSort={handleInvoiceSort} />
                        <SortableHeader field="customerName" label="Customer" currentSort={invoiceSort} onSort={handleInvoiceSort} />
                        <TableHead>Status</TableHead>
                        <SortableHeader field="totalAmount" label="Amount" currentSort={invoiceSort} onSort={handleInvoiceSort} className="text-right" />
                        <SortableHeader field="totalMargin" label="Margin" currentSort={invoiceSort} onSort={handleInvoiceSort} className="text-right" />
                        <TableHead className="text-right">Margin %</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoicesData?.map((invoice) => (
                        <Fragment key={invoice.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleInvoiceExpand(invoice.id)}
                            data-testid={`invoice-row-${invoice.id}`}
                          >
                            <TableCell>
                              {expandedInvoices.has(invoice.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                            <TableCell>{formatDateWithoutTimezone(invoice.invoiceDate)}</TableCell>
                            <TableCell>{invoice.customerName}</TableCell>
                            <TableCell>
                              <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                                {invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(invoice.totalAmount)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(invoice.totalMargin)}</TableCell>
                            <TableCell className="text-right">
                              <span className={cn(invoice.marginPercent >= 20 ? "text-green-600" : invoice.marginPercent >= 10 ? "text-yellow-600" : "text-red-600")}>
                                {invoice.marginPercent.toFixed(2)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {canViewProfitInvoice && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLocation(`/profitability/invoices/${invoice.id}`);
                                  }}
                                  data-testid={`button-view-profit-invoice-${invoice.id}`}
                                  title="View Profit Invoice"
                                >
                                  <Eye size={14} />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          {expandedInvoices.has(invoice.id) && (
                            <TableRow key={`${invoice.id}-items`}>
                              <TableCell colSpan={9} className="bg-muted/30 p-0">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/50">
                                      <TableHead className="pl-12">Item Code</TableHead>
                                      <TableHead>Description</TableHead>
                                      <TableHead className="text-right">Qty</TableHead>
                                      <TableHead className="text-right">Unit Price</TableHead>
                                      <TableHead className="text-right">Margin/Carton</TableHead>
                                      <TableHead className="text-right">Amount</TableHead>
                                      <TableHead className="text-right">Margin</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {invoice.lineItems.map((item) => (
                                      <TableRow key={item.id} data-testid={`line-item-${item.id}`}>
                                        <TableCell className="pl-12">{item.productCode}</TableCell>
                                        <TableCell>{item.description}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(safeParseFloat(item.unitPrice))}</TableCell>
                                        <TableCell className="text-right">
                                          {editingMargin?.itemId === item.id ? (
                                            <Input
                                              type="number"
                                              step="0.01"
                                              className="w-24 h-8 text-right inline-block"
                                              value={editingMargin.value}
                                              onChange={(e) => setEditingMargin({ itemId: item.id, value: e.target.value })}
                                              onBlur={() => handleMarginSave(item.id)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") handleMarginSave(item.id);
                                                if (e.key === "Escape") setEditingMargin(null);
                                              }}
                                              autoFocus
                                              onClick={(e) => e.stopPropagation()}
                                              data-testid={`input-margin-${item.id}`}
                                            />
                                          ) : (
                                            <span
                                              className="cursor-pointer hover:underline text-blue-600"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingMargin({ itemId: item.id, value: item.marginPerCarton || "0" });
                                              }}
                                              data-testid={`margin-value-${item.id}`}
                                            >
                                              {formatCurrency(safeParseFloat(item.marginPerCarton))}
                                            </span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.totalAmount)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.totalMargin)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                      {(!invoicesData || invoicesData.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No invoices found for the selected filters
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Customer Margin Report</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportToExcel("customers")} data-testid="export-customers">
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </CardHeader>
              <CardContent>
                {customerReportLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader field="customerName" label="Customer" currentSort={customerSort} onSort={handleCustomerSort} />
                        <TableHead className="text-right">Invoices</TableHead>
                        <SortableHeader field="totalCartons" label="Total Cartons" currentSort={customerSort} onSort={handleCustomerSort} className="text-right" />
                        <SortableHeader field="totalAmount" label="Total Amount" currentSort={customerSort} onSort={handleCustomerSort} className="text-right" />
                        <SortableHeader field="totalMargin" label="Total Margin" currentSort={customerSort} onSort={handleCustomerSort} className="text-right" />
                        <TableHead className="text-right">Margin %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerReport?.map((customer) => (
                        <TableRow key={customer.customerId} data-testid={`customer-row-${customer.customerId}`}>
                          <TableCell className="font-medium">{customer.customerName}</TableCell>
                          <TableCell className="text-right">{customer.totalInvoices}</TableCell>
                          <TableCell className="text-right">{customer.totalCartons}</TableCell>
                          <TableCell className="text-right">{formatCurrency(customer.totalAmount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(customer.totalMargin)}</TableCell>
                          <TableCell className="text-right">
                            <span className={cn(customer.marginPercent >= 20 ? "text-green-600" : customer.marginPercent >= 10 ? "text-yellow-600" : "text-red-600")}>
                              {customer.marginPercent.toFixed(2)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!customerReport || customerReport.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No customer data found for the selected filters
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Product Margin Report</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportToExcel("products")} data-testid="export-products">
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </CardHeader>
              <CardContent>
                {productReportLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Code</TableHead>
                        <SortableHeader field="productName" label="Product" currentSort={productSort} onSort={handleProductSort} />
                        <TableHead>Category</TableHead>
                        <SortableHeader field="totalQty" label="Total Qty" currentSort={productSort} onSort={handleProductSort} className="text-right" />
                        <SortableHeader field="totalAmount" label="Total Amount" currentSort={productSort} onSort={handleProductSort} className="text-right" />
                        <SortableHeader field="totalMargin" label="Total Margin" currentSort={productSort} onSort={handleProductSort} className="text-right" />
                        <TableHead className="text-right">Avg Margin/Carton</TableHead>
                        <TableHead className="text-right">Margin %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productReport?.map((product) => (
                        <TableRow key={product.productId} data-testid={`product-row-${product.productId}`}>
                          <TableCell className="font-medium">{product.itemCode}</TableCell>
                          <TableCell>{product.productName}</TableCell>
                          <TableCell>{product.category}</TableCell>
                          <TableCell className="text-right">{product.totalQty}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.totalAmount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.totalMargin)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.avgMarginPerCarton)}</TableCell>
                          <TableCell className="text-right">
                            <span className={cn(product.marginPercent >= 20 ? "text-green-600" : product.marginPercent >= 10 ? "text-yellow-600" : "text-red-600")}>
                              {product.marginPercent.toFixed(2)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!productReport || productReport.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No product data found for the selected filters
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {isSuperAdmin && (
        <Dialog open={isAddMarginOpen} onOpenChange={setIsAddMarginOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>Add Margin</DialogTitle>
              <DialogDescription>
                Set margins for products. Use Inventory tab for per-carton margins, or Category tab for customer category-wise margin percentages.
              </DialogDescription>
            </DialogHeader>

            <Tabs value={marginDialogTab} onValueChange={(v) => setMarginDialogTab(v as any)}>
              <TabsList className="mb-4">
                <TabsTrigger value="inventory">Inventory Margin</TabsTrigger>
                <TabsTrigger value="category">Category Margin</TabsTrigger>
              </TabsList>

              <TabsContent value="inventory">
                <div className="flex gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or item code..."
                      value={marginSearch}
                      onChange={(e) => setMarginSearch(e.target.value)}
                      className="pl-10"
                      data-testid="input-margin-search"
                    />
                  </div>
                  <Select value={marginCategoryFilter} onValueChange={setMarginCategoryFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-margin-category">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {inventoryCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-4 mb-4 items-center p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Bulk Apply:</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Margin value"
                    value={bulkMarginValue}
                    onChange={(e) => setBulkMarginValue(e.target.value)}
                    className="w-32"
                    data-testid="input-bulk-margin"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleApplyBulkMargin}
                    disabled={selectedMarginItems.size === 0 || applyMarginMutation.isPending}
                    data-testid="btn-apply-bulk"
                  >
                    Apply to {selectedMarginItems.size} selected
                  </Button>
                </div>

                <ScrollArea className="h-[350px] border rounded-lg">
                  {inventoryMarginsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={filteredInventoryMargins.length > 0 && selectedMarginItems.size === filteredInventoryMargins.length}
                              onCheckedChange={(checked) => handleSelectAllMargin(!!checked)}
                              data-testid="checkbox-select-all"
                            />
                          </TableHead>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Pack Size</TableHead>
                          <TableHead className="text-right">Current Margin</TableHead>
                          <TableHead className="text-right w-32">New Margin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInventoryMargins.map((item) => (
                            <TableRow key={item.id} data-testid={`margin-row-${item.id}`}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedMarginItems.has(item.id)}
                                  onCheckedChange={() => handleToggleMarginItem(item.id)}
                                  data-testid={`checkbox-item-${item.id}`}
                                />
                              </TableCell>
                              <TableCell className="font-mono text-sm">{item.itemCode}</TableCell>
                              <TableCell>{item.name}</TableCell>
                              <TableCell>{item.category || "-"}</TableCell>
                              <TableCell>{item.packingSize || "-"}</TableCell>
                              <TableCell className="text-right">
                                {item.marginPerCarton !== null ? formatCurrency(item.marginPerCarton) : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={individualMargins[item.id] || ""}
                                  onChange={(e) => setIndividualMargins((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))}
                                  className="w-24 h-8 text-right"
                                  title="Margin applies only when product is sold at non-zero price"
                                  data-testid={`input-individual-margin-${item.id}`}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        {filteredInventoryMargins.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No products found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>

                <DialogFooter className="gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddMarginOpen(false);
                      setSelectedMarginItems(new Set());
                      setBulkMarginValue("");
                      setIndividualMargins({});
                      setMarginSearch("");
                      setMarginCategoryFilter("all");
                    }}
                    data-testid="btn-cancel-margin"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleApplyIndividualMargins}
                    disabled={Object.keys(individualMargins).filter((k) => individualMargins[k]).length === 0 || applyMarginMutation.isPending}
                    data-testid="btn-apply-individual"
                  >
                    {applyMarginMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Apply Individual Margins
                  </Button>
                </DialogFooter>
              </TabsContent>

              <TabsContent value="category">
                <div className="flex items-center gap-4 mb-4">
                  <Select value={catMarginCustomerCategory} onValueChange={(v) => { setCatMarginCustomerCategory(v); setCatMarginProductMargins({}); setCatMarginGlobalValue(""); }}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Select Customer Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerCategories.map((cat) => (
                        <SelectItem key={cat.category} value={cat.category}>
                          {cat.category} ({cat.customerCount} customers)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => refetchCustomerCategories()}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>

                {catMarginCustomerCategory && (
                  <>
                    <div className="flex gap-4 mb-4 items-center p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">Global Category Margin %:</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 20"
                        value={catMarginGlobalValue || getCatMarginExisting(null)}
                        onChange={(e) => setCatMarginGlobalValue(e.target.value)}
                        className="w-28"
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveCatMarginGlobal}
                        disabled={!catMarginGlobalValue || saveCategoryMarginMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save Global
                      </Button>
                      {getCatMarginExisting(null) && (
                        <span className="text-xs text-muted-foreground">Current: {getCatMarginExisting(null)}%</span>
                      )}
                    </div>

                    <div className="flex gap-4 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or item code..."
                          value={catMarginSearch}
                          onChange={(e) => setCatMarginSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={catMarginInventoryFilter} onValueChange={setCatMarginInventoryFilter}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {catMarginInventoryCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <ScrollArea className="h-[300px] border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item Code</TableHead>
                            <TableHead>Product Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Pack Size</TableHead>
                            <TableHead className="text-right">Current %</TableHead>
                            <TableHead className="text-right w-28">Margin %</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCatMarginProducts.map((product: any) => (
                            <TableRow key={product.id}>
                              <TableCell className="font-mono text-sm">{product.itemCode || "-"}</TableCell>
                              <TableCell>{product.name}</TableCell>
                              <TableCell>{product.category || "-"}</TableCell>
                              <TableCell>{product.packingSize || "-"}</TableCell>
                              <TableCell className="text-right">
                                {getCatMarginExisting(product.id) ? `${getCatMarginExisting(product.id)}%` : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={getCatMarginCurrent(product.id)}
                                  onChange={(e) => setCatMarginProductMargins((prev) => ({ ...prev, [product.id]: e.target.value }))}
                                  className="w-24 h-8 text-right"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSaveCatMarginProduct(product.id)}
                                  disabled={!catMarginProductMargins[product.id] || saveCategoryMarginMutation.isPending}
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  Save
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {filteredCatMarginProducts.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                No products found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </>
                )}

                {!catMarginCustomerCategory && (
                  <p className="text-muted-foreground text-center py-8 text-sm">
                    Select a customer category to set margin percentages for products.
                  </p>
                )}

                <DialogFooter className="gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddMarginOpen(false);
                      setCatMarginCustomerCategory("");
                      setCatMarginProductMargins({});
                      setCatMarginGlobalValue("");
                      setCatMarginSearch("");
                      setCatMarginInventoryFilter("all");
                    }}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
        )}
      </div>
    </div>
  );
}
