import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function QuickBooksCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const realmId = urlParams.get('realmId');
        const state = urlParams.get('state');

        console.log("QuickBooks callback params:", { code: !!code, realmId: !!realmId, state: !!state });

        if (!code || !realmId || !state) {
          window.location.href = "#/auth/quickbooks#error=missing_params";
          return;
        }

        const token = localStorage.getItem("token");
        const response = await fetch(
          `/api/auth/quickbooks/callback?code=${code}&realmId=${realmId}&state=${state}`,
          {
            headers: token ? { "Authorization": `Bearer ${token}` } : {},
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
