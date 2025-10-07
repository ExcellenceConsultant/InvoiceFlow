import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DEFAULT_USER_ID } from "@/lib/constants";

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
});

type UserFormValues = z.infer<typeof userFormSchema>;
type EditUserFormValues = z.infer<typeof editUserFormSchema>;

export default function UserManagement() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/users"],
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
    },
  });

  // Update edit form when editingUser changes
  useEffect(() => {
    if (editingUser) {
      editForm.reset({
        username: editingUser.username,
        mobile: editingUser.mobile || "",
        password: "",
        role: editingUser.role,
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
      toast({
        title: "Success",
        description: "User created successfully",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditUserFormValues }) => {
      let passwordChanged = false;
      
      // Update basic info
      const updateData: any = {
        username: data.username,
        mobile: data.mobile,
        role: data.role,
      };

      const response = await apiRequest("PATCH", `/api/users/${id}`, updateData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update user");
      }

      // If password is provided, reset it
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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}`, {});
      if (!response.ok) {
        throw new Error("Failed to delete user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UserFormValues) => {
    createUserMutation.mutate(data);
  };

  const onEditSubmit = (data: EditUserFormValues) => {
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data });
    }
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const getRoleColor = (role: string) => {
    return roleOptions.find((r) => r.value === role)?.color || "bg-gray-500";
  };

  const getRoleLabel = (role: string) => {
    return roleOptions.find((r) => r.value === role)?.label || role;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">User Management</h1>
          <p className="text-muted-foreground">
            Create and manage users with different access roles
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-user">
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
                        <Input
                          {...field}
                          placeholder="Enter username"
                          data-testid="input-username"
                        />
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
                        <Input
                          {...field}
                          type="tel"
                          placeholder="+919033316252"
                          data-testid="input-mobile"
                        />
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
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
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
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roleOptions.map((role) => (
                            <SelectItem
                              key={role.value}
                              value={role.value}
                              data-testid={`select-role-${role.value}`}
                            >
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createUserMutation.isPending}
                    data-testid="button-submit-user"
                  >
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
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found. Create your first user to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user: any) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`user-card-${user.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${getRoleColor(user.role || 'viewer')}`}>
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
                    <Badge
                      className={`${getRoleColor(user.role || 'viewer')} text-white`}
                      data-testid={`badge-role-${user.id}`}
                    >
                      {getRoleLabel(user.role || 'viewer')}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(user)}
                      data-testid={`button-edit-${user.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {user.id !== DEFAULT_USER_ID && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteUserMutation.mutate(user.id)}
                        disabled={deleteUserMutation.isPending}
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
                      <Input
                        {...field}
                        placeholder="Enter username"
                        data-testid="input-edit-username"
                      />
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
                      <Input
                        {...field}
                        type="tel"
                        placeholder="+919033316252"
                        data-testid="input-edit-mobile"
                      />
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
                          {showEditPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roleOptions.map((role) => (
                          <SelectItem
                            key={role.value}
                            value={role.value}
                            data-testid={`select-edit-role-${role.value}`}
                          >
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
                <Button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                  data-testid="button-edit-submit"
                >
                  {updateUserMutation.isPending ? "Updating..." : "Update User"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
