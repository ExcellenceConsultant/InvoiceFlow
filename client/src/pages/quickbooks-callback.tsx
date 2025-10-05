import { useEffect } from "react";
import { useLocation } from "wouter";
import { RefreshCw } from "lucide-react";
import { DEFAULT_USER_ID } from "@/lib/constants";

export default function QuickBooksCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const realmId = urlParams.get('realmId');
        const state = urlParams.get('state');

        if (!code || !realmId || !state) {
          setLocation("/auth/quickbooks?error=missing_params");
          return;
        }

        const response = await fetch(
          `/api/auth/quickbooks/callback?code=${code}&realmId=${realmId}&state=${state}`
        );

        if (response.ok) {
          setLocation("/auth/quickbooks?success=true");
        } else {
          setLocation("/auth/quickbooks?error=auth_failed");
        }
      } catch (error) {
        console.error("Callback error:", error);
        setLocation("/auth/quickbooks?error=auth_failed");
      }
    };

    handleCallback();
  }, [setLocation]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <RefreshCw className="mx-auto h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Connecting to QuickBooks...</p>
      </div>
    </div>
  );
}
