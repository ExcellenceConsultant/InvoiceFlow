import { useState, useEffect } from "react";
import { Link as LinkIcon, CheckCircle, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

export default function QuickBooksAuth() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  const initializeAuthMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/auth/quickbooks");
      return await response.json();
    },
    onSuccess: (data: any) => {
      window.location.href = data.authUrl;
    },
    onError: (error) => {
      console.error("QuickBooks auth initialization error:", error);
      setAuthError("Failed to initialize QuickBooks authentication");
      setIsConnecting(false);
      toast({
        title: "Error",
        description: "Failed to start QuickBooks authentication",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/quickbooks/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: "QuickBooks account disconnected successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect QuickBooks account",
        variant: "destructive",
      });
    },
  });

  const handleConnect = () => {
    setIsConnecting(true);
    setAuthError(null);
    initializeAuthMutation.mutate();
  };

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect your QuickBooks account? This will stop all synchronization.")) {
      disconnectMutation.mutate();
    }
  };

  const isConnected = (user as any)?.quickbooksAccessToken && (user as any)?.quickbooksCompanyId;
  const tokenExpiry = (user as any)?.quickbooksTokenExpiry ? new Date((user as any).quickbooksTokenExpiry) : null;
  const isTokenExpired = tokenExpiry ? tokenExpiry < new Date() : false;

  // Handle OAuth callback
  useEffect(() => {
    // Parse hash parameters (format: #/auth/quickbooks#success=true)
    const hash = window.location.hash;
    const lastHashIndex = hash.lastIndexOf('#');
    
    if (lastHashIndex > 0) {
      const params = hash.substring(lastHashIndex + 1);
      const urlParams = new URLSearchParams(params);
      const success = urlParams.get('success');
      const error = urlParams.get('error');

      if (success === 'true') {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        toast({
          title: "Success",
          description: "QuickBooks connected successfully!",
        });
        setIsConnecting(false);
        // Clear the success parameter from hash
        window.location.hash = '/auth/quickbooks';
        return;
      }

      if (error) {
        let errorMessage = "QuickBooks authentication failed";
        if (error === 'missing_params') {
          errorMessage = "Missing required parameters from QuickBooks";
        } else if (error === 'auth_failed') {
          errorMessage = "Failed to complete QuickBooks authentication";
        }
        setAuthError(errorMessage);
        setIsConnecting(false);
        // Clear the error parameter from hash
        window.location.hash = '/auth/quickbooks';
        return;
      }
    }
  }, [queryClient, toast]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">QuickBooks Integration</h1>
        <p className="text-muted-foreground mt-1">Connect your QuickBooks Online account to sync invoices and customer data</p>
      </div>

      {/* Connection Status */}
      <Card className="mb-8" data-testid="connection-status-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <LinkIcon className="mr-2 text-primary" size={20} />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">QB</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground" data-testid="connection-status-title">
                  {isConnected ? "QuickBooks Online Connected" : "QuickBooks Online"}
                </h3>
                <p className="text-sm text-muted-foreground" data-testid="connection-status-description">
                  {isConnected 
                    ? `Company ID: ${(user as any).quickbooksCompanyId}` 
                    : "Not connected"
                  }
                </p>
                {isConnected && tokenExpiry && (
                  <p className="text-xs text-muted-foreground" data-testid="token-expiry">
                    Token expires: {tokenExpiry.toLocaleDateString()}
                    {isTokenExpired && <span className="text-destructive ml-1">(Expired)</span>}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge 
                className={isConnected && !isTokenExpired
                  ? "bg-accent text-accent-foreground" 
                  : "bg-destructive text-destructive-foreground"
                }
                data-testid="connection-badge"
              >
                {isConnected && !isTokenExpired ? "Connected" : "Disconnected"}
              </Badge>
              
              {isConnected ? (
                <Button 
                  variant="outline" 
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                  data-testid="button-disconnect"
                >
                  {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
                </Button>
              ) : (
                <Button 
                  onClick={handleConnect}
                  disabled={isConnecting || initializeAuthMutation.isPending}
                  data-testid="button-connect"
                >
                  {isConnecting || initializeAuthMutation.isPending ? "Connecting..." : "Connect"}
                </Button>
              )}
            </div>
          </div>
          
          {authError && (
            <Alert className="mt-4" variant="destructive" data-testid="auth-error-alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Integration Benefits */}
      <Card className="mb-8" data-testid="integration-benefits-card">
        <CardHeader>
          <CardTitle>Why Connect QuickBooks?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-accent mt-1" size={20} />
              <div>
                <h4 className="font-medium text-foreground">Automatic Invoice Sync</h4>
                <p className="text-sm text-muted-foreground">Invoices created in InvoiceFlow are automatically sent to QuickBooks</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-accent mt-1" size={20} />
              <div>
                <h4 className="font-medium text-foreground">Customer Data Sync</h4>
                <p className="text-sm text-muted-foreground">Customer information stays synchronized between both platforms</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-accent mt-1" size={20} />
              <div>
                <h4 className="font-medium text-foreground">Accounts Integration</h4>
                <p className="text-sm text-muted-foreground">Invoices are properly categorized in accounts receivable and payable</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-accent mt-1" size={20} />
              <div>
                <h4 className="font-medium text-foreground">Real-time Updates</h4>
                <p className="text-sm text-muted-foreground">Payment status and invoice changes are reflected in real-time</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="mb-8" data-testid="how-it-works-card">
        <CardHeader>
          <CardTitle>How the Integration Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <h4 className="font-medium text-foreground">Create Invoice in InvoiceFlow</h4>
                <p className="text-sm text-muted-foreground">Use our intuitive interface to create invoices with product schemes</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <h4 className="font-medium text-foreground">Automatic Format Conversion</h4>
                <p className="text-sm text-muted-foreground">Invoice data is transformed to QuickBooks format while preserving all details</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-medium text-foreground">Sync to QuickBooks</h4>
                <p className="text-sm text-muted-foreground">Invoice appears in your QuickBooks account under the appropriate accounts</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Information */}
      <Card data-testid="security-info-card">
        <CardHeader>
          <CardTitle>Security & Privacy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-accent mt-1" size={16} />
              <div>
                <p className="text-sm text-foreground">
                  We use OAuth 2.0 authentication, the industry standard for secure API access
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-accent mt-1" size={16} />
              <div>
                <p className="text-sm text-foreground">
                  Your QuickBooks credentials are never stored on our servers
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-accent mt-1" size={16} />
              <div>
                <p className="text-sm text-foreground">
                  Access tokens are encrypted and automatically refreshed as needed
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-accent mt-1" size={16} />
              <div>
                <p className="text-sm text-foreground">
                  You can disconnect at any time to revoke access immediately
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <ExternalLink className="inline mr-1" size={14} />
              Learn more about{" "}
              <a 
                href="https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary hover:underline"
                data-testid="link-quickbooks-security"
              >
                QuickBooks API security
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
