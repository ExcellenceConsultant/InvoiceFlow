import { useState } from "react";
import { Plus, Search, Gift, Edit, Trash2, ToggleLeft, ToggleRight, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DEFAULT_USER_ID } from "@/lib/constants";
import SchemeModal from "@/components/scheme-modal";
import { usePermissions } from "@/hooks/usePermissions";

export default function Schemes() {
  const permissions = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [showSchemeModal, setShowSchemeModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schemes, isLoading: schemesLoading } = useQuery({
    queryKey: ["/api/schemes"],
    queryFn: async () => {
      const response = await fetch(`/api/schemes?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch schemes");
      return response.json();
    },
  });

  const { data: products } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const response = await fetch(`/api/products?userId=${DEFAULT_USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const toggleSchemeMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/schemes/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schemes"] });
      toast({
        title: "Success",
        description: "Scheme status updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update scheme status",
        variant: "destructive",
      });
    },
  });

  const deleteSchemeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/schemes/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schemes"] });
      toast({
        title: "Success",
        description: "Scheme deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete scheme",
        variant: "destructive",
      });
    },
  });

  const getProductName = (productId: string) => {
    const product = products?.find((p: any) => p.id === productId);
    return product?.name || "Unknown Product";
  };

  const filteredSchemes = schemes?.filter((scheme: any) => {
    const matchesSearch = scheme.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         scheme.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && scheme.isActive) ||
                         (statusFilter === "inactive" && !scheme.isActive);
    const matchesProduct = productFilter === "all" || scheme.productId === productFilter;
    
    return matchesSearch && matchesStatus && matchesProduct;
  }) || [];

  const handleToggleScheme = (id: string, currentStatus: boolean) => {
    toggleSchemeMutation.mutate({ id, isActive: !currentStatus });
  };

  const handleDeleteScheme = (id: string) => {
    if (confirm("Are you sure you want to delete this scheme? This action cannot be undone.")) {
      deleteSchemeMutation.mutate(id);
    }
  };

  // Calculate scheme stats
  const totalSchemes = schemes?.length || 0;
  const activeSchemes = schemes?.filter((s: any) => s.isActive).length || 0;
  const inactiveSchemes = totalSchemes - activeSchemes;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">Product Schemes</h1>
            <p className="text-muted-foreground mt-1">Create and manage promotional schemes for your products</p>
          </div>
          
          <div className="flex items-center space-x-3 mt-4 lg:mt-0">
            <Button 
              variant="secondary" 
              disabled={activeSchemes === 0}
              data-testid="button-bulk-actions"
            >
              <Target className="mr-2" size={16} />
              Bulk Actions
            </Button>
            <Button 
              onClick={() => setShowSchemeModal(true)}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={!permissions.canManageSchemes}
              data-testid="button-create-scheme"
            >
              <Plus className="mr-2" size={16} />
              Create Scheme
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="stats-card" data-testid="stats-total-schemes">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Total Schemes</p>
                <p className="text-2xl font-bold text-foreground" data-testid="total-schemes-value">
                  {totalSchemes}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Gift className="text-primary" size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-muted-foreground">All promotional schemes</span>
            </div>
          </CardContent>
        </Card>

        <Card className="stats-card" data-testid="stats-active-schemes">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Active Schemes</p>
                <p className="text-2xl font-bold text-foreground" data-testid="active-schemes-value">
                  {activeSchemes}
                </p>
              </div>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <ToggleRight className="text-accent" size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-accent font-medium">Currently running</span>
            </div>
          </CardContent>
        </Card>

        <Card className="stats-card" data-testid="stats-inactive-schemes">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Inactive Schemes</p>
                <p className="text-2xl font-bold text-foreground" data-testid="inactive-schemes-value">
                  {inactiveSchemes}
                </p>
              </div>
              <div className="w-12 h-12 bg-muted/50 rounded-lg flex items-center justify-center">
                <ToggleLeft className="text-muted-foreground" size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-muted-foreground">Paused or draft</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6" data-testid="schemes-filters-card">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Search schemes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-schemes"
                />
              </div>
            </div>
            
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-48">
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger data-testid="select-product-filter">
                  <SelectValue placeholder="Filter by product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products?.map((product: any) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schemes List */}
      <Card data-testid="schemes-list-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Gift className="mr-2 text-accent" size={20} />
            Product Schemes ({filteredSchemes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {schemesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-24 bg-muted/30 rounded-lg animate-pulse" data-testid={`scheme-skeleton-${i}`} />
              ))}
            </div>
          ) : filteredSchemes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSchemes.map((scheme: any) => (
                <Card 
                  key={scheme.id} 
                  className="hover:shadow-md transition-shadow border-border hover:border-primary/50"
                  data-testid={`scheme-card-${scheme.id}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1" data-testid={`scheme-name-${scheme.id}`}>
                          {scheme.name}
                        </h3>
                        {scheme.description && (
                          <p className="text-sm text-muted-foreground mb-2" data-testid={`scheme-description-${scheme.id}`}>
                            {scheme.description}
                          </p>
                        )}
                      </div>
                      <Badge 
                        className={scheme.isActive 
                          ? "bg-accent text-accent-foreground" 
                          : "bg-muted text-muted-foreground"
                        }
                        data-testid={`scheme-status-${scheme.id}`}
                      >
                        {scheme.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-accent/5 rounded-lg">
                        <span className="text-sm text-muted-foreground">Product:</span>
                        <span className="text-sm font-medium text-foreground" data-testid={`scheme-product-${scheme.id}`}>
                          {getProductName(scheme.productId)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                        <span className="text-sm text-muted-foreground">Offer:</span>
                        <span className="text-sm font-medium text-primary" data-testid={`scheme-offer-${scheme.id}`}>
                          Buy {scheme.buyQuantity} Get {scheme.freeQuantity} Free
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm text-muted-foreground">Applied:</span>
                        <span className="text-sm font-medium text-foreground" data-testid={`scheme-usage-${scheme.id}`}>
                          {(scheme as any).usageCount || 0} times
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                      <div className="flex space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          disabled={!permissions.canManageSchemes}
                          data-testid={`button-edit-scheme-${scheme.id}`}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteScheme(scheme.id)}
                          disabled={deleteSchemeMutation.isPending || !permissions.canManageSchemes}
                          data-testid={`button-delete-scheme-${scheme.id}`}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleScheme(scheme.id, scheme.isActive)}
                        disabled={toggleSchemeMutation.isPending || !permissions.canManageSchemes}
                        className={scheme.isActive ? "text-muted-foreground" : "text-accent"}
                        data-testid={`button-toggle-scheme-${scheme.id}`}
                      >
                        {scheme.isActive ? (
                          <>
                            <ToggleLeft className="mr-1" size={14} />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <ToggleRight className="mr-1" size={14} />
                            Activate
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Gift className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No schemes found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || statusFilter !== "all" || productFilter !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : "Create your first product scheme to boost sales."
                }
              </p>
              <Button 
                className="mt-4" 
                onClick={() => setShowSchemeModal(true)}
                data-testid="button-create-first-scheme"
              >
                <Plus className="mr-2" size={16} />
                Create Scheme
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheme Modal */}
      {showSchemeModal && (
        <SchemeModal 
          onClose={() => setShowSchemeModal(false)}
          onSuccess={() => setShowSchemeModal(false)}
        />
      )}
    </div>
  );
}
