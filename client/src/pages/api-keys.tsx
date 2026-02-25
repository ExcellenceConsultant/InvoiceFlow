import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Key, Plus, Trash2, Copy, Clock, CheckCircle } from "lucide-react";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

export default function ApiKeys() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newKeyName, setNewKeyName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newKeySecret, setNewKeySecret] = useState<{ name: string; rawKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("POST", "/api/api-keys", { name }),
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

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "API key revoked", description: "The key has been deactivated." });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke API key", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!newKeyName.trim()) {
      toast({ title: "Name required", description: "Please enter a name for the API key.", variant: "destructive" });
      return;
    }
    createMutation.mutate(newKeyName.trim());
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const activeKeys = keys.filter((k) => k.isActive);
  const revokedKeys = keys.filter((k) => !k.isActive);

  const baseUrl = window.location.origin;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
        <p className="text-muted-foreground mt-1">
          Generate API keys to allow external applications to access your inventory products and customers.
        </p>
      </div>

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
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="max-w-sm"
            />
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Generating..." : "Generate Key"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* External API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">External API Endpoints</CardTitle>
          <CardDescription>
            Share these endpoint details with the other developer. All requests require an API key in the Authorization header.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-md p-3 text-sm font-mono space-y-1">
            <p className="text-muted-foreground text-xs mb-2 font-sans font-medium">Authorization header (required on all requests):</p>
            <p>Authorization: Bearer {"<your_api_key>"}</p>
          </div>

          <div className="space-y-3">
            <div className="border rounded-md p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs">GET</Badge>
                <code className="text-sm font-mono">{baseUrl}/api/external/products</code>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto" onClick={() => copyToClipboard(`${baseUrl}/api/external/products`)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Returns all inventory products. Response: <code>{"{ success, count, data: [...] }"}</code></p>
            </div>

            <div className="border rounded-md p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs">GET</Badge>
                <code className="text-sm font-mono">{baseUrl}/api/external/customers</code>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto" onClick={() => copyToClipboard(`${baseUrl}/api/external/customers`)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Returns all customers. Response: <code>{"{ success, count, data: [...] }"}</code></p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Example request (curl):</p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all">
{`curl -H "Authorization: Bearer if_xxxxx..." \\
  ${baseUrl}/api/external/products`}
            </pre>
          </div>
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
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : activeKeys.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active API keys. Generate one above.</p>
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
                      onClick={() => setDeleteId(key.id)}
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

      {/* Revoked Keys */}
      {revokedKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">Revoked Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {revokedKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between border rounded-md px-4 py-3 opacity-60">
                  <div>
                    <p className="font-medium text-sm">{key.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{key.keyPrefix}•••••••••••</p>
                  </div>
                  <Badge variant="outline" className="text-xs text-muted-foreground">Revoked</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revoke Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Any external application using this key will immediately lose access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && revokeMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Key
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
            <p className="text-sm text-muted-foreground">Key name: <span className="font-medium text-foreground">{newKeySecret?.name}</span></p>
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
            <Button className="w-full" onClick={() => setNewKeySecret(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
