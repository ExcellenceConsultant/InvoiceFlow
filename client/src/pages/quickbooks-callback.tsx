import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function QuickBooksCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log("=== QuickBooks Callback Debug ===");
        console.log("Full URL:", window.location.href);
        console.log("URL search (before hash):", window.location.search);
        console.log("URL hash:", window.location.hash);
        console.log("URL pathname:", window.location.pathname);
        
        // Handle query params both before and after hash
        // Try window.location.search first (params before hash or no hash)
        let urlParams = new URLSearchParams(window.location.search);
        let code = urlParams.get('code');
        let realmId = urlParams.get('realmId');
        let state = urlParams.get('state');
        let paramsSource = 'search';

        // If params not found in search, check if they're in the hash
        if (!code || !realmId || !state) {
          const hash = window.location.hash;
          if (hash.includes('?')) {
            const hashParams = hash.split('?')[1];
            urlParams = new URLSearchParams(hashParams);
            code = urlParams.get('code');
            realmId = urlParams.get('realmId');
            state = urlParams.get('state');
            paramsSource = 'hash';
          }
        }

        console.log("Params extracted from:", paramsSource);
        console.log("Params found:", { code: !!code, realmId: !!realmId, state: !!state });
        console.log("=================================");

        if (!code || !realmId || !state) {
          window.location.href = "#/auth/quickbooks#error=missing_params";
          return;
        }

        const token = localStorage.getItem("token");
        const headers: Record<string, string> = {
          "Accept": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        
        const response = await fetch(
          `/api/auth/quickbooks/callback?code=${code}&realmId=${realmId}&state=${state}`,
          {
            headers,
            credentials: "include",
          }
        );

        console.log("QuickBooks callback response:", response.status);

        if (response.ok) {
          window.location.href = "#/auth/quickbooks#success=true";
        } else {
          // Try to get error from response
          let errorType = 'auth_failed';
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorType = errorData.error;
            }
          } catch (e) {
            // If can't parse JSON, use default error
          }
          window.location.href = `#/auth/quickbooks#error=${errorType}`;
        }
      } catch (error) {
        console.error("Callback error:", error);
        window.location.href = "#/auth/quickbooks#error=auth_failed";
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <RefreshCw className="mx-auto h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Connecting to QuickBooks...</p>
      </div>
    </div>
  );
}
