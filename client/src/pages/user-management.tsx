import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Shield, Eye, EyeOff, Key, Copy, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { usePermissions } from "@/hooks/usePermissions";

const roleOptions = [
  { value: "super_admin", label: "Super Admin", color: "bg-purple-500" },
  { value: "admin", label: "Admin", color: "bg-blue-500" },
  { value: "poster", label: "Poster", color: "bg-green-500" },
  { value: "viewer", label: "Viewer", color: "bg-gray-500" },
];

const userFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  mobile: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid mobile number (use format: +919033316252)"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["super_admin", "admin", "poster", "viewer"]),
});

const editUserFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  mobile: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid mobile number (use format: +919033316252)"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  role: z.enum(["super_admin", "admin", "poster", "viewer"]),
  invoiceEditLockHours: z.number().min(0, "Must be 0 or greater").default(72),
});

type UserFormValues = z.infer<typeof userFormSchema>;
type EditUserFormValues = z.infer<typeof editUserFormSchema>;

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

export default function UserManagement() {
  const { toast } = useToast();
  const permissions = usePermissions();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // API Keys state
  const [newKeyName, setNewKeyName] = useState("");
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [newKeySecret, setNewKeySecret] = useState<{ name: string; rawKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: apiKeys = [], isLoading: isLoadingKeys } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      mobile: "",
      password: "",
      role: "viewer",
    },
  });

  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      username: "",
      mobile: "",
      password: "",
      role: "viewer",
      invoiceEditLockHours: 72,
    },
  });

  useEffect(() => {
    if (editingUser) {
      editForm.reset({
        username: editingUser.username,
        mobile: editingUser.mobile || "",
        password: "",
        role: editingUser.role,
        invoiceEditLockHours: editingUser.invoiceEditLockHours ?? 72,
      });
    }
  }, [editingUser, editForm]);

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormValues) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Success", description: "User created successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditUserFormValues }) => {
      const updateData: any = {
        username: data.username,
        mobile: data.mobile,
        role: data.role,
        invoiceEditLockHours: data.invoiceEditLockHours,
      };
      const response = await apiRequest("PATCH", `/api/users/${id}`, updateData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update user");
      }
      let passwordChanged = false;
      if (data.password && data.password.trim() !== "") {
        passwordChanged = true;
        const passwordResponse = await apiRequest("POST", `/api/auth/reset-password/${id}`, {
          newPassword: data.password,
        });
        if (!passwordResponse.ok) {
          const error = await passwordResponse.json();
          throw new Error(error.message || "Failed to update password");
        }
      }
      return { user: await response.json(), passwordChanged };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: result.passwordChanged
          ? "User and password updated successfully. The new password is now active."
          : "User updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingUser(null);
      setShowEditPassword(false);
      editForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}`, {});
      if (!response.ok) throw new Error("Failed to delete user");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Success", description: "User deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete user", variant: "destructive" });
    },
  });

  // API Key mutations
  const createKeyMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/api-keys", { name }),
    onSuccess: async (res) => {
      const data = await res.json();
      setNewKeySecret({ name: data.name, rawKey: data.rawKey });
      setNewKeyName("");
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create API key", variant: "destructive" });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "API key deleted", description: "The key has been permanently deleted." });
      setDeleteKeyId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete API key", variant: "destructive" });
    },
  });

  const onSubmit = (data: UserFormValues) => createUserMutation.mutate(data);
  const onEditSubmit = (data: EditUserFormValues) => {
    if (editingUser) updateUserMutation.mutate({ id: editingUser.id, data });
  };
  const handleEdit = (user: any) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const getRoleColor = (role: string) => roleOptions.find((r) => r.value === role)?.color || "bg-gray-500";
  const getRoleLabel = (role: string) => roleOptions.find((r) => r.value === role)?.label || role;

  const handleGenerateKey = () => {
    if (!newKeyName.trim()) {
      toast({ title: "Name required", description: "Please enter a name for the API key.", variant: "destructive" });
      return;
    }
    createKeyMutation.mutate(newKeyName.trim());
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const activeKeys = apiKeys as ApiKey[];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">User / Development</h1>
        <p className="text-muted-foreground">Manage users, roles, and API access for external integrations</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-6">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
        </TabsList>

        {/* ── Users Tab ── */}
        <TabsContent value="users">
          <div className="flex justify-end mb-4">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-user" disabled={!permissions.canManageUsers}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter username" data-testid="input-username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mobile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mobile Number</FormLabel>
                          <FormControl>
                            <Input {...field} type="tel" placeholder="+919033316252" data-testid="input-mobile" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter password"
                                data-testid="input-password"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                                data-testid="button-toggle-password"
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-role">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {roleOptions.map((role) => (
                                <SelectItem key={role.value} value={role.value} data-testid={`select-role-${role.value}`}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-submit-user">
                        {createUserMutation.isPending ? "Creating..." : "Create User"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading users...</div>
              ) : (users as any[]).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No users found. Create your first user to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {(users as any[]).map((user: any) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`user-card-${user.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${getRoleColor(user.role || "viewer")}`}>
                          <Shield className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold" data-testid={`text-username-${user.id}`}>
                            {user.username}
                          </h3>
                          <p className="text-sm text-muted-foreground" data-testid={`text-mobile-${user.id}`}>
                            {user.mobile || "No mobile number"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${getRoleColor(user.role || "viewer")} text-white`} data-testid={`badge-role-${user.id}`}>
                          {getRoleLabel(user.role || "viewer")}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(user)}
                          disabled={!permissions.canEditUsers}
                          data-testid={`button-edit-${user.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {user.id !== DEFAULT_USER_ID && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteUserMutation.mutate(user.id)}
                            disabled={deleteUserMutation.isPending || !permissions.canEditUsers}
                            data-testid={`button-delete-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── API Keys Tab ── */}
        <TabsContent value="api-keys" className="space-y-6">
          {/* Generate New Key */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Generate New API Key
              </CardTitle>
              <CardDescription>
                Give your key a descriptive name so you can identify it later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  placeholder="e.g. Sales Order App"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerateKey()}
                  className="max-w-sm"
                />
                <Button onClick={handleGenerateKey} disabled={createKeyMutation.isPending}>
                  {createKeyMutation.isPending ? "Generating..." : "Generate Key"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* API Endpoint URLs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4" />
                Available API Endpoints
              </CardTitle>
              <CardDescription>Use your API key as a Bearer token to access these endpoints from external systems.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sales Order endpoints */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sales Orders</p>
                <div className="space-y-2">
                  {[
                    { label: "GET — List all sales orders", path: "/api/external/sales-orders", key: "so-get" },
                    { label: "POST — Create / sync sales order", path: "/api/external/sales-orders", key: "so-post" },
                  ].map(({ label, path, key }) => {
                    const url = `${window.location.origin}${path}`;
                    return (
                      <div key={key} className="flex items-center justify-between bg-muted rounded-md px-3 py-2 gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
                          <code className="text-xs font-mono break-all">{url}</code>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => copyToClipboard(url)}>
                          {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Price Rule endpoints */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Price Rules</p>
                <div className="space-y-2">
                  {[
                    { label: "GET — List all price rules", path: "/api/external/price-rules", key: "pr-get" },
                    { label: "GET — Rules by category", path: "/api/external/price-rules/category/:category", key: "pr-cat" },
                    { label: "POST — Create / update price rule", path: "/api/external/price-rules", key: "pr-post" },
                    { label: "DELETE — Delete price rule by ID", path: "/api/external/price-rules/:id", key: "pr-delete" },
                  ].map(({ label, path, key }) => {
                    const url = `${window.location.origin}${path}`;
                    return (
                      <div key={key} className="flex items-center justify-between bg-muted rounded-md px-3 py-2 gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
                          <code className="text-xs font-mono break-all">{url}</code>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => copyToClipboard(url)}>
                          {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reference endpoints */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Reference Data</p>
                <div className="space-y-2">
                  {[
                    { label: "Products (with item codes)", path: "/api/external/products", key: "products" },
                    { label: "Customers", path: "/api/external/customers", key: "customers" },
                  ].map(({ label, path, key }) => {
                    const url = `${window.location.origin}${path}`;
                    return (
                      <div key={key} className="flex items-center justify-between bg-muted rounded-md px-3 py-2 gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
                          <code className="text-xs font-mono break-all">{url}</code>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => copyToClipboard(url)}>
                          {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price Rule API — cURL Examples */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4" />
                Price Rule API — cURL Examples
              </CardTitle>
              <CardDescription>
                Replace <code className="text-xs bg-muted px-1 rounded">YOUR_API_KEY</code> with your actual API key below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  title: "1. List all price rules",
                  curl: `curl -X GET "${window.location.origin}/api/external/price-rules" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
                },
                {
                  title: "2. Get price rules for a specific customer category",
                  curl: `curl -X GET "${window.location.origin}/api/external/price-rules/category/Wholesale" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
                },
                {
                  title: "3. Create or update a price rule (using product item code)",
                  curl: `curl -X POST "${window.location.origin}/api/external/price-rules" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customerCategory": "Wholesale",
    "productCode": "ITEM-001",
    "customPrice": "45.00"
  }'`,
                },
                {
                  title: "4. Create or update a price rule (using product ID)",
                  curl: `curl -X POST "${window.location.origin}/api/external/price-rules" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customerCategory": "Retail",
    "productId": "PRODUCT-UUID-HERE",
    "customPrice": "55.00"
  }'`,
                },
                {
                  title: "5. Delete a price rule by ID",
                  curl: `curl -X DELETE "${window.location.origin}/api/external/price-rules/PRICE-RULE-UUID" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
                },
              ].map(({ title, curl }) => (
                <div key={title} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{title}</p>
                  <div className="relative bg-muted rounded-md p-3">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all pr-8">{curl}</pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0"
                      onClick={() => copyToClipboard(curl)}
                    >
                      {copied ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Active Keys */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4" />
                Active API Keys {activeKeys.length > 0 && <Badge variant="outline">{activeKeys.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingKeys ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : activeKeys.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No API keys yet. Use the "Generate New API Key" section above to create one. Once created, a delete button will appear next to each key.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between border rounded-md px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="font-medium text-sm">{key.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {key.keyPrefix}••••••••••••••••••••••••••••••••••••••
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Created {new Date(key.createdAt).toLocaleDateString()}
                          </span>
                          {key.lastUsedAt && (
                            <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-green-600 border-green-300 text-xs">Active</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteKeyId(key.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter username" data-testid="input-edit-username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" placeholder="+919033316252" data-testid="input-edit-mobile" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password (leave empty to keep current)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showEditPassword ? "text" : "password"}
                          placeholder="Enter new password or leave empty"
                          data-testid="input-edit-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowEditPassword(!showEditPassword)}
                          data-testid="button-toggle-edit-password"
                        >
                          {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roleOptions.map((role) => (
                          <SelectItem key={role.value} value={role.value} data-testid={`select-edit-role-${role.value}`}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="invoiceEditLockHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Edit Lock (Hours)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        placeholder="72"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-edit-lock-hours"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Hours within which this user can edit invoices (0 = no edit allowed, Super Admin always has unlimited access)
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingUser(null);
                    editForm.reset();
                  }}
                  data-testid="button-edit-cancel"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending} data-testid="button-edit-submit">
                  {updateUserMutation.isPending ? "Updating..." : "Update User"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Key Confirmation */}
      <AlertDialog open={!!deleteKeyId} onOpenChange={(open) => !open && setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This key will be permanently deleted. Any external application using it will immediately lose access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteKeyId && deleteKeyMutation.mutate(deleteKeyId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Key Secret Dialog */}
      <Dialog open={!!newKeySecret} onOpenChange={(open) => !open && setNewKeySecret(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy your API key now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Key name: <span className="font-medium text-foreground">{newKeySecret?.name}</span>
            </p>
            <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
              <code className="text-sm font-mono flex-1 break-all">{newKeySecret?.rawKey}</code>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => newKeySecret && copyToClipboard(newKeySecret.rawKey)}
              >
                {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded p-2">
              Store this key securely. Once you close this dialog, you won't be able to see the full key again.
            </p>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Use this key with these endpoints:</p>
              {["/api/external/products", "/api/external/customers"].map((path) => (
                <div key={path} className="flex items-center gap-2 bg-muted rounded px-2 py-1.5">
                  <code className="text-xs font-mono flex-1 break-all">{window.location.origin}{path}</code>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => copyToClipboard(`${window.location.origin}${path}`)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={() => setNewKeySecret(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
